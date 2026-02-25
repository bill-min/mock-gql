// State
let requests = [];
let mockRules = {};
let mockingEnabled = false;
let selectedRequestId = null;
let currentTabId = null;
let editingRule = null; // Track which rule is being edited

// DOM Elements
const requestList = document.getElementById('requestList');
const requestDetail = document.getElementById('requestDetail');
const rulesList = document.getElementById('rulesList');
const mockingToggle = document.getElementById('mockingEnabled');
const clearBtn = document.getElementById('clearBtn');
const addRuleBtn = document.getElementById('addRuleBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const operationNameInput = document.getElementById('operationName');
const mockResponseInput = document.getElementById('mockResponse');
const mockDelayInput = document.getElementById('mockDelay');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize
async function init() {
  // Get current tab ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id || chrome.devtools.inspectedWindow.tabId;

  // Load initial state
  loadRequests();
  loadMockState();

  // Poll for new requests
  setInterval(loadRequests, 1000);
}

// Load requests from service worker
async function loadRequests() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_REQUESTS',
      tabId: chrome.devtools.inspectedWindow.tabId
    });
    if (response?.requests) {
      requests = response.requests;
      renderRequests();
    }
  } catch (e) {
    console.error('Failed to load requests:', e);
  }
}

// Load mock state
async function loadMockState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_MOCK_STATE' });
    if (response) {
      mockRules = response.mockRules || {};
      mockingEnabled = response.mockingEnabled || false;
      mockingToggle.checked = mockingEnabled;
      renderRules();
    }
  } catch (e) {
    console.error('Failed to load mock state:', e);
  }
}

// Render requests list
function renderRequests() {
  if (requests.length === 0) {
    requestList.innerHTML = '<div class="empty-state">No GraphQL requests captured yet</div>';
    return;
  }

  requestList.innerHTML = requests.map(req => `
    <div class="request-item ${req.id === selectedRequestId ? 'selected' : ''} ${req.mocked ? 'mocked' : ''}"
         data-id="${req.id}">
      <div class="request-type ${req.operationType}">${req.operationType.charAt(0).toUpperCase()}</div>
      <div class="request-info">
        <div class="request-name">${escapeHtml(req.operationName)}</div>
        <div class="request-time">${formatTime(req.timestamp)}</div>
      </div>
      ${req.mocked ? '<span class="badge">MOCKED</span>' : ''}
    </div>
  `).join('');

  // Add click handlers
  requestList.querySelectorAll('.request-item').forEach(item => {
    item.addEventListener('click', () => selectRequest(item.dataset.id));
  });
}

// Select a request
function selectRequest(id) {
  selectedRequestId = id;
  const request = requests.find(r => r.id === id);

  renderRequests();

  if (!request) {
    requestDetail.innerHTML = '<div class="empty-state">Select a request to view details</div>';
    return;
  }

  requestDetail.innerHTML = `
    <div class="detail-section">
      <h4>Operation</h4>
      <div class="detail-row">
        <span class="label">Name:</span>
        <span class="value">${escapeHtml(request.operationName)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Type:</span>
        <span class="value">${escapeHtml(request.operationType)}</span>
      </div>
      <div class="detail-row">
        <span class="label">URL:</span>
        <span class="value">${escapeHtml(request.url)}</span>
      </div>
      ${request.mocked ? '<div class="detail-row"><span class="badge">MOCKED RESPONSE</span></div>' : ''}
    </div>

    <div class="detail-row-split">
      <div class="detail-section">
        <h4>Query <button class="btn btn-small btn-secondary" id="copyQueryBtn">Copy</button></h4>
        <pre class="code-block code-block-small">${escapeHtml(request.query || 'N/A')}</pre>
      </div>
      <div class="detail-section">
        <h4>Variables <button class="btn btn-small btn-secondary" id="copyVariablesBtn">Copy</button></h4>
        <pre class="code-block code-block-small">${formatJson(request.variables)}</pre>
      </div>
    </div>

    <div class="detail-section">
      <h4>Response <button class="btn btn-small btn-secondary" id="copyResponseBtn">Copy</button></h4>
      <pre class="code-block">${formatJson(request.response)}</pre>
    </div>

    <div class="detail-actions">
      <button class="btn btn-secondary" id="createMockRuleBtn" data-operation="${escapeHtml(request.operationName)}">
        Create Mock Rule
      </button>
    </div>
  `;

  // Add event listener for copy buttons
  const setupCopyBtn = (btnId, text) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', async () => {
        const copied = await copyToClipboard(text);
        if (copied) {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }
      });
    }
  };
  setupCopyBtn('copyQueryBtn', request.query || 'N/A');
  setupCopyBtn('copyVariablesBtn', JSON.stringify(request.variables ?? null, null, 2));
  setupCopyBtn('copyResponseBtn', JSON.stringify(request.response, null, 2));

  // Add event listener for create mock rule button
  const createMockRuleBtn = document.getElementById('createMockRuleBtn');
  if (createMockRuleBtn) {
    createMockRuleBtn.addEventListener('click', () => {
      operationNameInput.value = request.operationName;
      mockResponseInput.value = JSON.stringify(request.response, null, 2);
      editingRule = null;
      addRuleBtn.textContent = 'Add Rule';
      cancelEditBtn.style.display = 'none';
      switchTab('mock-rules');
    });
  }
}

// Render mock rules
function renderRules() {
  const ruleNames = Object.keys(mockRules);

  if (ruleNames.length === 0) {
    rulesList.innerHTML = '<h3>Active Rules</h3><div class="empty-state">No mock rules defined</div>';
    return;
  }

  rulesList.innerHTML = `
    <h3>Active Rules</h3>
    ${ruleNames.map(name => {
      const rule = mockRules[name];
      const isEnabled = rule.enabled !== false;
      const delay = rule.delay || 0;
      return `
      <div class="rule-item ${isEnabled ? '' : 'rule-disabled'}">
        <div class="rule-header">
          <label class="toggle-switch toggle-small">
            <input type="checkbox" class="rule-toggle" data-rule="${escapeHtml(name)}" ${isEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <div class="rule-name">${escapeHtml(name)}</div>
          ${delay > 0 ? `<span class="rule-delay">${delay}ms</span>` : ''}
        </div>
        <pre class="rule-response">${formatJson(rule.response)}</pre>
        <div class="rule-actions">
          <button class="btn btn-secondary btn-small edit-rule-btn" data-rule="${escapeHtml(name)}">Edit</button>
          <button class="btn btn-danger btn-small delete-rule-btn" data-rule="${escapeHtml(name)}">Delete</button>
        </div>
      </div>
    `}).join('')}
  `;

  // Add event listeners for toggles
  rulesList.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      toggleRule(toggle.dataset.rule, toggle.checked);
    });
  });

  // Add event listeners for edit buttons
  rulesList.querySelectorAll('.edit-rule-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editRule(btn.dataset.rule);
    });
  });

  // Add event listeners for delete buttons
  rulesList.querySelectorAll('.delete-rule-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteRule(btn.dataset.rule);
    });
  });
}

// Add or update mock rule
async function addRule() {
  const name = operationNameInput.value.trim();
  const responseStr = mockResponseInput.value.trim();
  const delay = parseInt(mockDelayInput.value) || 0;

  if (!name) {
    alert('Please enter an operation name');
    return;
  }

  let response;
  try {
    response = JSON.parse(responseStr);
  } catch {
    alert('Invalid JSON response');
    return;
  }

  // Preserve enabled state if editing existing rule
  const existingRule = mockRules[name];
  mockRules[name] = {
    response,
    enabled: existingRule ? existingRule.enabled !== false : true,
    delay
  };

  await chrome.runtime.sendMessage({
    type: 'UPDATE_MOCK_RULES',
    mockRules
  });

  operationNameInput.value = '';
  mockResponseInput.value = '';
  mockDelayInput.value = '';
  editingRule = null;
  addRuleBtn.textContent = 'Add Rule';
  cancelEditBtn.style.display = 'none';
  renderRules();
}

// Toggle individual rule
async function toggleRule(name, enabled) {
  if (mockRules[name]) {
    mockRules[name].enabled = enabled;

    await chrome.runtime.sendMessage({
      type: 'UPDATE_MOCK_RULES',
      mockRules
    });

    renderRules();
  }
}

// Edit rule - populate form with existing rule data
function editRule(name) {
  const rule = mockRules[name];
  if (rule) {
    operationNameInput.value = name;
    mockResponseInput.value = JSON.stringify(rule.response, null, 2);
    mockDelayInput.value = rule.delay || '';
    editingRule = name;
    addRuleBtn.textContent = 'Update Rule';
    cancelEditBtn.style.display = 'inline-block';
    // Scroll to form
    operationNameInput.focus();
  }
}

// Cancel editing
function cancelEdit() {
  operationNameInput.value = '';
  mockResponseInput.value = '';
  mockDelayInput.value = '';
  editingRule = null;
  addRuleBtn.textContent = 'Add Rule';
  cancelEditBtn.style.display = 'none';
}

// Delete mock rule
async function deleteRule(name) {
  delete mockRules[name];

  await chrome.runtime.sendMessage({
    type: 'UPDATE_MOCK_RULES',
    mockRules
  });

  renderRules();
}

// Toggle mocking
async function toggleMocking() {
  mockingEnabled = mockingToggle.checked;

  await chrome.runtime.sendMessage({
    type: 'SET_MOCKING_ENABLED',
    enabled: mockingEnabled
  });
}

// Clear requests
async function clearRequests() {
  await chrome.runtime.sendMessage({
    type: 'CLEAR_REQUESTS',
    tabId: chrome.devtools.inspectedWindow.tabId
  });

  requests = [];
  selectedRequestId = null;
  renderRequests();
  requestDetail.innerHTML = '<div class="empty-state">Select a request to view details</div>';
}

// Tab switching
function switchTab(tabName) {
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Utility functions
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // navigator.clipboard.writeText fails in DevTools panel (e.g. "Document is not focused")
  }
  // Fallback for extension contexts using execCommand
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatJson(obj) {
  if (obj === null || obj === undefined) return 'null';
  try {
    return escapeHtml(JSON.stringify(obj, null, 2));
  } catch {
    return 'Invalid JSON';
  }
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// Resizable panels
function makeResizable(resizerId, panelId) {
  const resizer = document.getElementById(resizerId);
  const panel = document.getElementById(panelId);
  if (!resizer || !panel) return;

  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      const delta = e.clientX - startX;
      const newWidth = Math.max(
        parseInt(getComputedStyle(panel).minWidth) || 150,
        startWidth + delta
      );
      panel.style.width = `${newWidth}px`;
    }

    function onMouseUp() {
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

makeResizable('requestsResizer', 'requestList');
makeResizable('mockRulesResizer', 'addRuleForm');

// Event listeners
tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

mockingToggle.addEventListener('change', toggleMocking);
clearBtn.addEventListener('click', clearRequests);
addRuleBtn.addEventListener('click', addRule);
cancelEditBtn.addEventListener('click', cancelEdit);

// Initialize
init();
