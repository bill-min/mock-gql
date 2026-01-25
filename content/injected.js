(function() {
  'use strict';

  // Mock state
  let mockRules = {};
  let mockingEnabled = false;

  // Listen for mock state updates from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'MOCK_STATE_UPDATE') {
      mockRules = event.data.mockRules || {};
      mockingEnabled = event.data.mockingEnabled || false;
      console.log('[MockGQL] State updated:', { mockingEnabled, rules: Object.keys(mockRules) });
    }
  });

  // Check if URL is a GraphQL endpoint
  function isGraphQLEndpoint(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname.includes('/graphql') || urlObj.pathname.includes('/gql');
    } catch {
      return false;
    }
  }

  // Parse GraphQL request body
  function parseGraphQLBody(body) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      if (!parsed) return null;

      // Handle batched queries
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          operationName: item.operationName || extractOperationName(item.query),
          query: item.query,
          variables: item.variables
        }));
      }

      return {
        operationName: parsed.operationName || extractOperationName(parsed.query),
        query: parsed.query,
        variables: parsed.variables
      };
    } catch {
      return null;
    }
  }

  // Extract operation name from query string
  function extractOperationName(query) {
    if (!query) return 'Unknown';
    const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
    return match ? match[1] : 'Anonymous';
  }

  // Get operation type from query
  function getOperationType(query) {
    if (!query) return 'query';
    const trimmed = query.trim().toLowerCase();
    if (trimmed.startsWith('mutation')) return 'mutation';
    if (trimmed.startsWith('subscription')) return 'subscription';
    return 'query';
  }

  // Check if request should be mocked
  function getMockRule(operationName) {
    if (!mockingEnabled || !operationName) return null;
    const rule = mockRules[operationName];
    if (!rule) return null;
    // Check if rule is enabled (new format: { response, enabled, delay })
    if (rule.enabled === false) return null;
    // Return full rule object
    return {
      response: rule.response !== undefined ? rule.response : rule,
      delay: rule.delay || 0
    };
  }

  // Send request data to content script
  function reportRequest(data) {
    window.postMessage({
      type: 'GRAPHQL_REQUEST',
      data: {
        ...data,
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString()
      }
    }, '*');
  }

  // Patch fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;

    if (!isGraphQLEndpoint(url)) {
      return originalFetch.apply(this, arguments);
    }

    const body = init.body || (input instanceof Request ? await input.clone().text() : null);
    const parsed = parseGraphQLBody(body);

    if (!parsed) {
      return originalFetch.apply(this, arguments);
    }

    // Handle single or batched requests
    const operations = Array.isArray(parsed) ? parsed : [parsed];
    const operationName = operations[0]?.operationName || 'Unknown';
    const operationType = getOperationType(operations[0]?.query);

    // Check for mock
    console.log('[MockGQL] Fetch:', operationName, '| Mocking:', mockingEnabled, '| Has rule:', !!mockRules[operationName]);
    const mockRule = getMockRule(operationName);
    if (mockRule) {
      console.log('[MockGQL] Returning mocked response for:', operationName, '| Delay:', mockRule.delay);
      const responseData = {
        url,
        operationName,
        operationType,
        query: operations[0]?.query,
        variables: operations[0]?.variables,
        response: mockRule.response,
        mocked: true
      };
      reportRequest(responseData);

      // Apply delay if specified
      if (mockRule.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, mockRule.delay));
      }

      return new Response(JSON.stringify(mockRule.response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Make actual request
    try {
      const response = await originalFetch.apply(this, arguments);
      const clonedResponse = response.clone();

      clonedResponse.json().then((responseBody) => {
        reportRequest({
          url,
          operationName,
          operationType,
          query: operations[0]?.query,
          variables: operations[0]?.variables,
          response: responseBody,
          mocked: false
        });
      }).catch(() => {
        reportRequest({
          url,
          operationName,
          operationType,
          query: operations[0]?.query,
          variables: operations[0]?.variables,
          response: null,
          mocked: false
        });
      });

      return response;
    } catch (error) {
      reportRequest({
        url,
        operationName,
        operationType,
        query: operations[0]?.query,
        variables: operations[0]?.variables,
        response: { error: error.message },
        mocked: false
      });
      throw error;
    }
  };

  // Patch XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._graphqlUrl = url;
    this._graphqlMethod = method;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const url = this._graphqlUrl;

    if (!isGraphQLEndpoint(url)) {
      return originalXHRSend.apply(this, arguments);
    }

    const parsed = parseGraphQLBody(body);

    if (!parsed) {
      return originalXHRSend.apply(this, arguments);
    }

    const operations = Array.isArray(parsed) ? parsed : [parsed];
    const operationName = operations[0]?.operationName || 'Unknown';
    const operationType = getOperationType(operations[0]?.query);

    // Check for mock
    console.log('[MockGQL] XHR:', operationName, '| Mocking:', mockingEnabled, '| Has rule:', !!mockRules[operationName]);
    const mockRule = getMockRule(operationName);
    if (mockRule) {
      console.log('[MockGQL] Returning mocked XHR response for:', operationName, '| Delay:', mockRule.delay);
      const responseData = {
        url,
        operationName,
        operationType,
        query: operations[0]?.query,
        variables: operations[0]?.variables,
        response: mockRule.response,
        mocked: true
      };
      reportRequest(responseData);

      // Simulate XHR response
      const xhr = this;
      Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
      Object.defineProperty(xhr, 'status', { value: 200, writable: true });
      Object.defineProperty(xhr, 'statusText', { value: 'OK', writable: true });
      Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(mockRule.response), writable: true });
      Object.defineProperty(xhr, 'response', { value: JSON.stringify(mockRule.response), writable: true });

      // Apply delay if specified
      const delay = mockRule.delay || 0;
      setTimeout(() => {
        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.dispatchEvent(new Event('load'));
        xhr.dispatchEvent(new Event('loadend'));
      }, delay);
      return;
    }

    // Listen for response
    this.addEventListener('load', () => {
      try {
        const responseBody = JSON.parse(this.responseText);
        reportRequest({
          url,
          operationName,
          operationType,
          query: operations[0]?.query,
          variables: operations[0]?.variables,
          response: responseBody,
          mocked: false
        });
      } catch {
        reportRequest({
          url,
          operationName,
          operationType,
          query: operations[0]?.query,
          variables: operations[0]?.variables,
          response: null,
          mocked: false
        });
      }
    });

    return originalXHRSend.apply(this, arguments);
  };

  console.log('[MockGQL] Interceptor initialized');
})();
