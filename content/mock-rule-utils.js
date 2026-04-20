(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.MockGQLRuleUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function hasOwn(target, key) {
    return Object.prototype.hasOwnProperty.call(target, key);
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function looksLikeStoredRule(value) {
    return (
      isPlainObject(value) &&
      (hasOwn(value, "operationName") ||
        hasOwn(value, "enabled") ||
        hasOwn(value, "delay") ||
        hasOwn(value, "matchVariables") ||
        hasOwn(value, "hasVariableMatcher") ||
        hasOwn(value, "createdAt") ||
        hasOwn(value, "updatedAt"))
    );
  }

  function parseDelay(value) {
    const delay = Number(value);
    return Number.isFinite(delay) && delay > 0 ? delay : 0;
  }

  function parseTimestamp(value, fallbackValue) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : fallbackValue;
  }

  function createRuleId(operationName) {
    const safeName = String(operationName || "rule")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "rule";

    return `${safeName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeRule(ruleId, rawRule, index) {
    const isStoredRule = looksLikeStoredRule(rawRule);
    const sourceRule = isStoredRule ? rawRule : {};
    const fallbackOperationName =
      typeof sourceRule.operationName === "string" && sourceRule.operationName.trim()
        ? sourceRule.operationName.trim()
        : String(ruleId || "").trim() || "Unknown";
    const createdAt = parseTimestamp(sourceRule.createdAt, index);
    const updatedAt = parseTimestamp(sourceRule.updatedAt, createdAt);

    return {
      id: String(ruleId || sourceRule.id || createRuleId(fallbackOperationName)),
      operationName: fallbackOperationName,
      response:
        isStoredRule && hasOwn(sourceRule, "response") ? sourceRule.response : rawRule,
      enabled: isStoredRule ? sourceRule.enabled !== false : true,
      delay: isStoredRule ? parseDelay(sourceRule.delay) : 0,
      hasVariableMatcher: isStoredRule
        ? hasOwn(sourceRule, "hasVariableMatcher")
          ? Boolean(sourceRule.hasVariableMatcher)
          : hasOwn(sourceRule, "matchVariables")
        : false,
      matchVariables:
        isStoredRule && hasOwn(sourceRule, "matchVariables")
          ? sourceRule.matchVariables
          : null,
      createdAt,
      updatedAt,
    };
  }

  function normalizeMockRules(rawRules) {
    const normalizedRules = {};

    if (!rawRules || typeof rawRules !== "object") {
      return normalizedRules;
    }

    Object.entries(rawRules).forEach(([ruleId, rawRule], index) => {
      const rule = normalizeRule(ruleId, rawRule, index);
      normalizedRules[rule.id] = rule;
    });

    return normalizedRules;
  }

  function matchesVariableSubset(expected, actual) {
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || actual.length !== expected.length) {
        return false;
      }

      return expected.every((expectedItem, index) =>
        matchesVariableSubset(expectedItem, actual[index]),
      );
    }

    if (isPlainObject(expected)) {
      if (!isPlainObject(actual)) {
        return false;
      }

      return Object.keys(expected).every((key) =>
        matchesVariableSubset(expected[key], actual[key]),
      );
    }

    return Object.is(expected, actual);
  }

  function countMatcherLeaves(value) {
    if (Array.isArray(value)) {
      return value.reduce(
        (total, item) => total + countMatcherLeaves(item),
        0,
      );
    }

    if (isPlainObject(value)) {
      return Object.keys(value).reduce(
        (total, key) => total + countMatcherLeaves(value[key]),
        0,
      );
    }

    return 1;
  }

  function getRuleSpecificity(rule) {
    return rule.hasVariableMatcher ? countMatcherLeaves(rule.matchVariables) : -1;
  }

  function compareRulesByPriority(ruleA, ruleB) {
    const matcherPriority =
      Number(Boolean(ruleB.hasVariableMatcher)) -
      Number(Boolean(ruleA.hasVariableMatcher));

    if (matcherPriority !== 0) {
      return matcherPriority;
    }

    const specificityPriority =
      getRuleSpecificity(ruleB) - getRuleSpecificity(ruleA);

    if (specificityPriority !== 0) {
      return specificityPriority;
    }

    const updatedPriority =
      Number(ruleB.updatedAt || 0) - Number(ruleA.updatedAt || 0);

    if (updatedPriority !== 0) {
      return updatedPriority;
    }

    return String(ruleA.id).localeCompare(String(ruleB.id));
  }

  function getMatchingMockRule(rawRules, operationName, variables) {
    const rules = Object.values(normalizeMockRules(rawRules))
      .filter((rule) => rule.enabled !== false && rule.operationName === operationName)
      .filter(
        (rule) =>
          !rule.hasVariableMatcher ||
          matchesVariableSubset(rule.matchVariables, variables),
      )
      .sort(compareRulesByPriority);

    return rules[0] || null;
  }

  function safeJsonStringify(value, spacing = 0) {
    try {
      return JSON.stringify(value, null, spacing);
    } catch {
      return String(value);
    }
  }

  function summarizeMatchVariables(matchVariables, hasVariableMatcher, maxLength) {
    if (!hasVariableMatcher) {
      return "All variables";
    }

    const summary = safeJsonStringify(matchVariables, 0);

    if (typeof maxLength === "number" && maxLength > 3 && summary.length > maxLength) {
      return `${summary.slice(0, maxLength - 3)}...`;
    }

    return summary;
  }

  function describeRuleMatch(rule, maxLength) {
    if (!rule) {
      return "All variables";
    }

    return summarizeMatchVariables(
      rule.matchVariables,
      rule.hasVariableMatcher,
      maxLength,
    );
  }

  return {
    compareRulesByPriority,
    createRuleId,
    describeRuleMatch,
    getMatchingMockRule,
    matchesVariableSubset,
    normalizeMockRules,
    safeJsonStringify,
    summarizeMatchVariables,
  };
});
