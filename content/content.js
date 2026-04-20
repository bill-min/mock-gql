// Inject a script into the page context
function injectScript(path) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = function() {
      this.remove();
      resolve();
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

// Initialize
async function init() {
  // Wait for injected script to load
  await injectScript('content/mock-rule-utils.js');
  await injectScript('content/injected.js');

  // Give the script a moment to set up listeners
  await new Promise(r => setTimeout(r, 10));

  // Get initial mock state and send to page
  try {
    chrome.runtime.sendMessage({ type: 'GET_MOCK_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response) {
        window.postMessage({
          type: 'MOCK_STATE_UPDATE',
          mockRules: response.mockRules,
          mockingEnabled: response.mockingEnabled
        }, '*');
      }
    });
  } catch (e) {
    // Extension context not ready
  }
}

init();

// Listen for messages from injected script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'GRAPHQL_REQUEST') {
    // Forward to service worker
    try {
      chrome.runtime.sendMessage({
        type: 'GRAPHQL_REQUEST',
        data: event.data.data
      });
    } catch (e) {
      // Extension context invalidated - ignore
    }
  }
});

// Listen for mock state updates from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MOCK_STATE_UPDATE') {
    // Forward to injected script
    window.postMessage({
      type: 'MOCK_STATE_UPDATE',
      mockRules: message.mockRules,
      mockingEnabled: message.mockingEnabled
    }, '*');
  }
});
