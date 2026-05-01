export const KNOWN_FOCUS_TYPES = new Set([
  "REASON",
  "DETAIL",
  "SITUATION",
  "EXAMPLE",
  "FEELING",
  "RESULT",
  "GRAMMAR_FIX",
  "TASK_RESET",
  "EXPRESSION_POLISH"
]);

const RETIRED_RESPONSE_FIELDS = ["corrections", "grammarFeedback"];
const RETIRED_UI_FIELDS = ["secondaryLearningPoints", "modelAnswerVariants"];
const COMPARISON_FOCUS_TYPES = new Set(["GRAMMAR_FIX", "EXPRESSION_POLISH"]);

export function getPath(value, dottedPath) {
  if (!dottedPath) {
    return value;
  }

  return dottedPath.split(".").reduce((current, part) => {
    if (current == null) {
      return undefined;
    }
    return current[part];
  }, value);
}

export function textOf(value) {
  if (value == null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(textOf).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value).map(textOf).join(" ");
  }
  return String(value);
}

export function isNonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeText(value) {
  return textOf(value).replace(/\s+/g, " ").trim().toLowerCase();
}

export function hasOwn(object, key) {
  return object != null && Object.prototype.hasOwnProperty.call(object, key);
}

export function hasComparisonPair(payload) {
  const coachBefore = payload?.coachMove?.before;
  const coachAfter = payload?.coachMove?.after;
  if (isMeaningfulPair(coachBefore, coachAfter)) {
    return true;
  }

  const primaryFix = payload?.ui?.primaryFix;
  if (isMeaningfulPair(primaryFix?.originalText, primaryFix?.revisedText)) {
    return true;
  }

  const nextStepPractice = payload?.ui?.nextStepPractice;
  if (isMeaningfulPair(nextStepPractice?.originalText, nextStepPractice?.revisedText)) {
    return true;
  }

  const fixPoints = Array.isArray(payload?.ui?.fixPoints) ? payload.ui.fixPoints : [];
  return fixPoints.some((point) => isMeaningfulPair(point?.originalText, point?.revisedText));
}

export function evaluatePayload(testCase, payload) {
  const failures = [];
  const warnings = [];
  const focusType = payload?.coachMove?.focusType;
  const expectedFocusTypes = testCase.expectedFocusTypes ?? [];
  const forbiddenFocusTypes = testCase.forbiddenFocusTypes ?? [];

  requireNonBlank(payload?.coachMove?.focus, "missing_coach_focus", "coachMove.focus is blank", failures);
  requireNonBlank(payload?.coachMove?.instruction, "missing_coach_instruction", "coachMove.instruction is blank", failures);
  requireNonBlank(payload?.coachMove?.successCheck, "missing_success_check", "coachMove.successCheck is blank", failures);

  if (expectedFocusTypes.length > 0 && !expectedFocusTypes.includes(focusType)) {
    failures.push({
      code: "wrong_focus_type",
      message: `focusType ${focusType || "(blank)"} is not one of ${expectedFocusTypes.join(", ")}`
    });
  }

  if (forbiddenFocusTypes.includes(focusType)) {
    failures.push({
      code: "forbidden_focus_type",
      message: `focusType ${focusType} is forbidden for this case`
    });
  }

  const fixPoints = Array.isArray(payload?.ui?.fixPoints) ? payload.ui.fixPoints : [];
  if (testCase.expectFixPoints !== false && !testCase.expectedLoopComplete && fixPoints.length === 0) {
    failures.push({
      code: "empty_fix_points",
      message: "ui.fixPoints is empty"
    });
  }

  const comparisonRequired = testCase.requiresComparison === true
    || (payload?.loopComplete !== true && COMPARISON_FOCUS_TYPES.has(focusType));
  if (comparisonRequired && !testCase.allowMissingComparison && !hasComparisonPair(payload)) {
    failures.push({
      code: "missing_comparison",
      message: "comparison mission has no before/after pair"
    });
  }

  if (testCase.expectedLoopComplete === true && payload?.loopComplete !== true) {
    failures.push({
      code: "loop_not_complete",
      message: "loopComplete was expected to be true"
    });
  }

  for (const field of RETIRED_RESPONSE_FIELDS) {
    if (hasOwn(payload, field)) {
      failures.push({
        code: "legacy_field_leak",
        message: `retired response field ${field} leaked`
      });
    }
  }

  for (const field of RETIRED_UI_FIELDS) {
    if (hasOwn(payload?.ui, field)) {
      failures.push({
        code: "legacy_field_leak",
        message: `retired ui field ${field} leaked`
      });
    }
  }

  for (const [fieldPath, needles] of Object.entries(testCase.mustContainAny ?? {})) {
    const haystack = normalizeText(getPath(payload, fieldPath));
    if (!needles.some((needle) => haystack.includes(normalizeText(needle)))) {
      failures.push({
        code: "missing_expected_keyword",
        message: `${fieldPath} does not contain any of: ${needles.join(", ")}`
      });
    }
  }

  for (const [fieldPath, needles] of Object.entries(testCase.mustNotContainAny ?? {})) {
    const haystack = normalizeText(getPath(payload, fieldPath));
    const matched = needles.find((needle) => haystack.includes(normalizeText(needle)));
    if (matched) {
      failures.push({
        code: "forbidden_keyword",
        message: `${fieldPath} contains forbidden text: ${matched}`
      });
    }
  }

  const instructionLength = textOf(payload?.coachMove?.instruction).trim().length;
  const minimumInstructionChars = testCase.minimumInstructionChars ?? 12;
  if (instructionLength > 0 && instructionLength < minimumInstructionChars) {
    warnings.push({
      code: "short_instruction",
      message: `coachMove.instruction is short (${instructionLength} chars)`
    });
  }

  return {
    pass: failures.length === 0,
    failures,
    warnings,
    focusType: focusType ?? null,
    loopComplete: payload?.loopComplete === true,
    fixPointCount: fixPoints.length,
    hasComparison: hasComparisonPair(payload)
  };
}

export function validateCases(cases) {
  const failures = [];
  const warnings = [];

  cases.forEach((testCase, index) => {
    const label = testCase?.name || `case ${index + 1}`;
    if (!isNonBlank(testCase?.name)) {
      failures.push(`${label}: name is required`);
    }
    if (!isNonBlank(testCase?.promptId)) {
      failures.push(`${label}: promptId is required`);
    }
    if (!isNonBlank(testCase?.answer)) {
      failures.push(`${label}: answer is required`);
    }
    if (!Array.isArray(testCase?.expectedFocusTypes) || testCase.expectedFocusTypes.length === 0) {
      failures.push(`${label}: expectedFocusTypes must be a non-empty array`);
    } else {
      for (const focusType of testCase.expectedFocusTypes) {
        if (!KNOWN_FOCUS_TYPES.has(focusType)) {
          warnings.push(`${label}: expectedFocusTypes contains unknown focus type ${focusType}`);
        }
      }
    }
    for (const focusType of testCase?.forbiddenFocusTypes ?? []) {
      if (!KNOWN_FOCUS_TYPES.has(focusType)) {
        warnings.push(`${label}: forbiddenFocusTypes contains unknown focus type ${focusType}`);
      }
    }
  });

  return { failures, warnings };
}

function requireNonBlank(value, code, message, failures) {
  if (!isNonBlank(value)) {
    failures.push({ code, message });
  }
}

function isMeaningfulPair(left, right) {
  if (!isNonBlank(left) || !isNonBlank(right)) {
    return false;
  }
  return normalizeText(left) !== normalizeText(right);
}
