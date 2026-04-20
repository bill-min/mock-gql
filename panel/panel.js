const ruleUtils = window.MockGQLRuleUtils;

if (!ruleUtils) {
  throw new Error('MockGQL rule utilities are unavailable');
}

// State
let requests = [];
let mockRules = {};
let mockingEnabled = false;
let selectedRequestId = null;
let editingRuleId = null;

// DOM Elements
const requestList = document.getElementById('requestList');
const requestDetail = document.getElementById('requestDetail');
const rulesList = document.getElementById('rulesList');
const mockingToggle = document.getElementById('mockingEnabled');
const clearBtn = document.getElementById('clearBtn');
const addRuleBtn = document.getElementById('addRuleBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const operationNameInput = document.getElementById('operationName');
const enableVariableMatchInput = document.getElementById('enableVariableMatch');
const variableMatchSection = document.getElementById('variableMatchSection');
const matchVariablesInput = document.getElementById('matchVariables');
const mockResponseInput = document.getElementById('mockResponse');
const mockDelayInput = document.getElementById('mockDelay');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize
async function init() {
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

      if (selectedRequestId && !requests.some((request) => request.id === selectedRequestId)) {
        selectedRequestId = null;
        requestDetail.innerHTML = '<div class="empty-state">Select a request to view details</div>';
      }
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
      mockRules = ruleUtils.normalizeMockRules(response.mockRules);
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

  requestList.innerHTML = requests.map((req) => `
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

  requestList.querySelectorAll('.request-item').forEach((item) => {
    item.addEventListener('click', () => selectRequest(item.dataset.id));
  });
}

// Select a request
function selectRequest(id) {
  selectedRequestId = id;
  const request = requests.find((item) => item.id === id);

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
      ${request.mocked && request.mockRuleMatch ? `
        <div class="detail-row">
          <span class="label">Rule:</span>
          <span class="value">${escapeHtml(request.mockRuleMatch)}</span>
        </div>
      ` : ''}
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
      <button class="btn btn-secondary" id="createMockRuleBtn">
        Create Mock Rule
      </button>
    </div>
  `;

  const setupCopyBtn = (btnId, text) => {
    const btn = document.getElementById(btnId);
    if (!btn) {
      return;
    }

    btn.addEventListener('click', async () => {
      const copied = await copyToClipboard(text);

      if (copied) {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 1500);
      }
    });
  };

  setupCopyBtn('copyQueryBtn', request.query || 'N/A');
  setupCopyBtn('copyVariablesBtn', JSON.stringify(request.variables ?? null, null, 2));
  setupCopyBtn('copyResponseBtn', JSON.stringify(request.response, null, 2));

  const createMockRuleBtn = document.getElementById('createMockRuleBtn');
  if (createMockRuleBtn) {
    createMockRuleBtn.addEventListener('click', () => {
      operationNameInput.value = request.operationName;
      enableVariableMatchInput.checked = false;
      matchVariablesInput.value = '';
      if (request.variables !== undefined) {
        matchVariablesInput.value = JSON.stringify(request.variables, null, 2);
      }
      mockResponseInput.value = JSON.stringify(request.response, null, 2);
      mockDelayInput.value = '';
      editingRuleId = null;
      addRuleBtn.textContent = 'Add Rule';
      cancelEditBtn.style.display = 'none';
      syncVariableMatchState();
      switchTab('mock-rules');
      operationNameInput.focus();
    });
  }
}

function getSortedRules() {
  return Object.values(mockRules).sort((ruleA, ruleB) =>
    ruleA.operationName.localeCompare(ruleB.operationName) ||
    ruleUtils.compareRulesByPriority(ruleA, ruleB),
  );
}

// Render mock rules
function renderRules() {
  const rules = getSortedRules();

  if (rules.length === 0) {
    rulesList.innerHTML = '<h3>Active Rules</h3><div class="empty-state">No mock rules defined</div>';
    return;
  }

  rulesList.innerHTML = `
    <h3>Active Rules</h3>
    ${rules.map((rule) => {
      const isEnabled = rule.enabled !== false;
      const delay = rule.delay || 0;
      const matchSummary = ruleUtils.describeRuleMatch(rule, 90);

      return `
        <div class="rule-item ${isEnabled ? '' : 'rule-disabled'}">
          <div class="rule-header">
            <label class="toggle-switch toggle-small">
              <input type="checkbox" class="rule-toggle" data-rule-id="${escapeHtml(rule.id)}" ${isEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <div class="rule-meta">
              <div class="rule-name">${escapeHtml(rule.operationName)}</div>
              <div class="rule-match">${escapeHtml(matchSummary)}</div>
            </div>
            ${delay > 0 ? `<span class="rule-delay">${delay}ms</span>` : ''}
          </div>
          ${rule.hasVariableMatcher ? `
            <div class="rule-condition">
              <div class="rule-condition-label">Match Variables</div>
              <pre class="rule-condition-value">${formatJson(rule.matchVariables)}</pre>
            </div>
          ` : ''}
          <pre class="rule-response">${formatJson(rule.response)}</pre>
          <div class="rule-actions">
            <button class="btn btn-secondary btn-small edit-rule-btn" data-rule-id="${escapeHtml(rule.id)}">Edit</button>
            <button class="btn btn-danger btn-small delete-rule-btn" data-rule-id="${escapeHtml(rule.id)}">Delete</button>
          </div>
        </div>
      `;
    }).join('')}
  `;

  rulesList.querySelectorAll('.rule-toggle').forEach((toggle) => {
    toggle.addEventListener('change', () => {
      toggleRule(toggle.dataset.ruleId, toggle.checked);
    });
  });

  rulesList.querySelectorAll('.edit-rule-btn').forEach((button) => {
    button.addEventListener('click', () => {
      editRule(button.dataset.ruleId);
    });
  });

  rulesList.querySelectorAll('.delete-rule-btn').forEach((button) => {
    button.addEventListener('click', () => {
      deleteRule(button.dataset.ruleId);
    });
  });
}

async function persistMockRules() {
  mockRules = ruleUtils.normalizeMockRules(mockRules);

  await chrome.runtime.sendMessage({
    type: 'UPDATE_MOCK_RULES',
    mockRules
  });
}

function syncVariableMatchState() {
  variableMatchSection.classList.toggle('is-hidden', !enableVariableMatchInput.checked);
}

function resetRuleForm() {
  operationNameInput.value = '';
  enableVariableMatchInput.checked = false;
  matchVariablesInput.value = '';
  mockResponseInput.value = '';
  mockDelayInput.value = '';
  editingRuleId = null;
  addRuleBtn.textContent = 'Add Rule';
  cancelEditBtn.style.display = 'none';
  syncVariableMatchState();
}

// Add or update mock rule
async function addRule() {
  const operationName = operationNameInput.value.trim();
  const hasVariableMatcher = enableVariableMatchInput.checked;
  const matchVariablesRaw = matchVariablesInput.value.trim();
  const responseRaw = mockResponseInput.value.trim();
  const delay = parseInt(mockDelayInput.value, 10) || 0;

  if (!operationName) {
    alert('Please enter an operation name');
    return;
  }

  if (!responseRaw) {
    alert('Please enter a mock response');
    return;
  }

  let matchVariables = null;
  let response;

  if (hasVariableMatcher && !matchVariablesRaw) {
    alert('Please enter match variables JSON or turn off variable match');
    return;
  }

  if (matchVariablesRaw) {
    try {
      matchVariables = JSON.parse(matchVariablesRaw);
    } catch {
      alert('Invalid match variables JSON');
      return;
    }
  }

  try {
    response = JSON.parse(responseRaw);
  } catch {
    alert('Invalid JSON response');
    return;
  }

  const existingRule = editingRuleId ? mockRules[editingRuleId] : null;
  const ruleId = editingRuleId || ruleUtils.createRuleId(operationName);
  const now = Date.now();

  mockRules[ruleId] = {
    id: ruleId,
    operationName,
    response,
    enabled: existingRule ? existingRule.enabled !== false : true,
    delay,
    hasVariableMatcher,
    matchVariables,
    createdAt: existingRule?.createdAt || now,
    updatedAt: now
  };

  await persistMockRules();
  resetRuleForm();
  renderRules();
}

// Toggle individual rule
async function toggleRule(ruleId, enabled) {
  if (!mockRules[ruleId]) {
    return;
  }

  mockRules[ruleId] = {
    ...mockRules[ruleId],
    enabled,
    updatedAt: Date.now()
  };

  await persistMockRules();
  renderRules();
}

// Edit rule
function editRule(ruleId) {
  const rule = mockRules[ruleId];

  if (!rule) {
    return;
  }

  operationNameInput.value = rule.operationName;
  enableVariableMatchInput.checked = Boolean(rule.hasVariableMatcher);
  matchVariablesInput.value = rule.matchVariables === null || rule.matchVariables === undefined
    ? ''
    : JSON.stringify(rule.matchVariables, null, 2);
  mockResponseInput.value = JSON.stringify(rule.response, null, 2);
  mockDelayInput.value = rule.delay || '';
  editingRuleId = ruleId;
  addRuleBtn.textContent = 'Update Rule';
  cancelEditBtn.style.display = 'inline-block';
  syncVariableMatchState();
  operationNameInput.focus();
  switchTab('mock-rules');
}

// Cancel editing
function cancelEdit() {
  resetRuleForm();
}

// Delete mock rule
async function deleteRule(ruleId) {
  delete mockRules[ruleId];

  await persistMockRules();
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
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  tabContents.forEach((content) => {
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
  if (!str) {
    return '';
  }

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatJson(obj) {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  try {
    return escapeHtml(JSON.stringify(obj, null, 2));
  } catch {
    return 'Invalid JSON';
  }
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleTimeString();
}

// Resizable panels
function makeResizable(resizerId, panelId) {
  const resizer = document.getElementById(resizerId);
  const panel = document.getElementById(panelId);

  if (!resizer || !panel) {
    return;
  }

  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (event) => {
    startX = event.clientX;
    startWidth = panel.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(moveEvent) {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(
        parseInt(getComputedStyle(panel).minWidth, 10) || 150,
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

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

mockingToggle.addEventListener('change', toggleMocking);
clearBtn.addEventListener('click', clearRequests);
addRuleBtn.addEventListener('click', addRule);
cancelEditBtn.addEventListener('click', cancelEdit);
enableVariableMatchInput.addEventListener('change', syncVariableMatchState);

syncVariableMatchState();
init();
