const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMatchingMockRule,
  matchesVariableSubset,
  normalizeMockRules,
} = require('../content/mock-rule-utils.js');

test('normalizeMockRules keeps legacy operation-name keyed rules working', () => {
  const normalized = normalizeMockRules({
    GetUser: {
      response: { data: { user: { id: '1' } } },
      enabled: true,
      delay: 150,
    },
  });

  assert.deepEqual(normalized.GetUser, {
    id: 'GetUser',
    operationName: 'GetUser',
    response: { data: { user: { id: '1' } } },
    enabled: true,
    delay: 150,
    hasVariableMatcher: false,
    matchVariables: null,
    createdAt: 0,
    updatedAt: 0,
  });
});

test('matchesVariableSubset supports deep object matching', () => {
  assert.equal(
    matchesVariableSubset(
      { input: { id: '1', filters: { active: true } } },
      { input: { id: '1', filters: { active: true, role: 'admin' }, page: 2 } },
    ),
    true,
  );
});

test('getMatchingMockRule returns null when the variable matcher does not match', () => {
  const rule = getMatchingMockRule(
    {
      'rule-1': {
        operationName: 'GetUser',
        response: { data: { user: null } },
        hasVariableMatcher: true,
        matchVariables: { id: '2' },
      },
    },
    'GetUser',
    { id: '1' },
  );

  assert.equal(rule, null);
});

test('getMatchingMockRule prefers the most specific matching rule over a generic fallback', () => {
  const rule = getMatchingMockRule(
    {
      generic: {
        operationName: 'GetUser',
        response: { data: { user: { id: 'fallback' } } },
        updatedAt: 1,
      },
      conditional: {
        operationName: 'GetUser',
        response: { data: { user: { id: 'conditional' } } },
        hasVariableMatcher: true,
        matchVariables: { input: { id: '1', includePosts: true } },
        updatedAt: 2,
      },
      nested: {
        operationName: 'GetUser',
        response: { data: { user: { id: 'nested' } } },
        hasVariableMatcher: true,
        matchVariables: { input: { id: '1' } },
        updatedAt: 3,
      },
    },
    'GetUser',
    { input: { id: '1', includePosts: true } },
  );

  assert.equal(rule.id, 'conditional');
  assert.deepEqual(rule.response, { data: { user: { id: 'conditional' } } });
});
