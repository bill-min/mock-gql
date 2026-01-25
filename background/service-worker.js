// Store requests per tab
const tabRequests = new Map();

// Store mock rules (operation name -> mock response)
let mockRules = {};
let mockingEnabled = false;

// Load mock rules from storage on startup
chrome.storage.local.get(['mockRules', 'mockingEnabled'], (result) => {
  if (result.mockRules) {
    mockRules = result.mockRules;
  }
  if (result.mockingEnabled !== undefined) {
    mockingEnabled = result.mockingEnabled;
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  tabRequests.delete(tabId);
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id || message.tabId;

  switch (message.type) {
    case 'GRAPHQL_REQUEST':
      // Store request from content script
      if (tabId) {
        if (!tabRequests.has(tabId)) {
          tabRequests.set(tabId, []);
        }
        const requests = tabRequests.get(tabId);
        requests.push(message.data);
        // Keep only last 100 requests per tab
        if (requests.length > 100) {
          requests.shift();
        }
      }
      break;

    case 'GET_REQUESTS':
      // Panel requesting all requests for current tab
      sendResponse({
        requests: tabRequests.get(tabId) || []
      });
      return true;

    case 'CLEAR_REQUESTS':
      // Clear requests for tab
      if (tabId) {
        tabRequests.set(tabId, []);
      }
      sendResponse({ success: true });
      return true;

    case 'GET_MOCK_STATE':
      // Return current mock rules and enabled state
      sendResponse({
        mockRules,
        mockingEnabled
      });
      return true;

    case 'UPDATE_MOCK_RULES':
      // Update mock rules
      mockRules = message.mockRules;
      chrome.storage.local.set({ mockRules });
      // Notify all tabs about the update
      broadcastMockState();
      sendResponse({ success: true });
      return true;

    case 'SET_MOCKING_ENABLED':
      // Toggle mocking
      mockingEnabled = message.enabled;
      chrome.storage.local.set({ mockingEnabled });
      // Notify all tabs about the update
      broadcastMockState();
      sendResponse({ success: true });
      return true;

    case 'GET_TAB_ID':
      // Content script requesting its tab ID
      sendResponse({ tabId: sender.tab?.id });
      return true;
  }
});

// Broadcast mock state to all tabs
function broadcastMockState() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'MOCK_STATE_UPDATE',
        mockRules,
        mockingEnabled
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    });
  });
}
