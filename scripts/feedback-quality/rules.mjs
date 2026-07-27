export const KNOWN_MISSION_KINDS = new Set([
  "SLOT",
  "TASK_RESET",
  "LANGUAGE_FIX",
  "COMPLETE"
]);

export const KNOWN_TARGET_SLOTS = new Set([
  "ACTION",
  "CHOICE",
  "GOAL",
  "PROBLEM",
  "OPINION",
  "PLAN",
  "SOLUTION",
  "ADVANTAGE",
  "DISADVANTAGE",
  "BEFORE_STATE",
  "NOW_STATE",
  "CHANGE_CAUSE",
  "ADDITIONAL_ACTION",
  "SPECIFIC_TIME",
  "PLACE",
  "REASON",
  "DETAIL",
  "EXAMPLE",
  "FEELING",
  "RESULT"
]);

const LEGACY_FOCUS_TYPES = new Set([
  "REASON",
  "DETAIL",
  "SITUATION",
  "EXAMPLE",
  "FEELING",
  "RESULT",
  "STRUCTURE_FIX",
  "GRAMMAR_FIX",
  "TASK_RESET",
  "EXPRESSION_POLISH"
]);
const LEGACY_CONTENT_FOCUS_TYPES = new Set([
  "REASON",
  "DETAIL",
  "SITUATION",
  "EXAMPLE",
  "FEELING",
  "RESULT"
]);
const RETIRED_RESPONSE_FIELDS = [
  "score",
  "corrections",
  "grammarFeedback",
  "answerBand",
  "taskCompletion",
  "finishable",
  "meaningClarity",
  "grammarSeverity",
  "correctionSupport",
  "missionDecision",
  "chosenType",
  "actionType"
];
const RETIRED_UI_FIELDS = [
  "focusCard",
  "primaryFix",
  "nextStepPractice",
  "secondaryLearningPoints",
  "modelAnswerVariants",
  "fixPoints"
];
const KNOWN_LANGUAGE_CORRECTION_KINDS = new Set([
  "STRUCTURE",
  "GRAMMAR_BLOCKING",
  "GRAMMAR_LOCAL"
]);

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

export function containsHangul(value) {
  return isNonBlank(value) && /[\uAC00-\uD7A3]/u.test(value);
}

export function normalizeText(value) {
  return textOf(value).replace(/\s+/g, " ").trim().toLowerCase();
}

export function hasOwn(object, key) {
  return object != null && Object.prototype.hasOwnProperty.call(object, key);
}

export function hasCoachComparisonPair(payload) {
  return isMeaningfulPair(payload?.coachMove?.before, payload?.coachMove?.after);
}

export function hasContentScaffold(payload) {
  const move = payload?.coachMove;
  const validPhraseChoices = Array.isArray(move?.suggestedPhrases)
    ? move.suggestedPhrases.filter((item) => isNonBlank(item?.phrase) && containsHangul(item?.meaningKo))
    : [];
  return isNonBlank(move?.skeletonEn)
    && containsHangul(move?.skeletonKo)
    && validPhraseChoices.length >= 2;
}

export function resolveExpectedMissionKinds(testCase) {
  if (Array.isArray(testCase?.expectedMissionKinds) && testCase.expectedMissionKinds.length > 0) {
    return unique(testCase.expectedMissionKinds.map(normalizeExpectedMissionKind));
  }

  const resolved = [];
  for (const focusType of testCase?.expectedFocusTypes ?? []) {
    const missionKind = legacyFocusToMissionKind(focusType);
    if (missionKind) {
      resolved.push(missionKind);
    }
  }
  if (testCase?.expectedLoopComplete === true) {
    resolved.push("COMPLETE");
  }
  return unique(resolved);
}

export function resolveForbiddenMissionKinds(testCase) {
  if (Array.isArray(testCase?.forbiddenMissionKinds)) {
    return unique(testCase.forbiddenMissionKinds.map(normalizeExpectedMissionKind));
  }

  // Coarse legacy content types cannot safely forbid the canonical SLOT mission.
  return unique((testCase?.forbiddenFocusTypes ?? [])
    .filter((focusType) =>
      focusType === "STRUCTURE_FIX"
      || focusType === "GRAMMAR_FIX"
      || focusType === "TASK_RESET")
    .map(legacyFocusToMissionKind)
    .filter(Boolean));
}

export function evaluatePayload(testCase, payload) {
  const failures = [];
  const warnings = [];
  const loopComplete = payload?.loopComplete === true;
  const rawMissionKind = payload?.coachMove?.focusType ?? null;
  const missionKind = loopComplete ? "COMPLETE" : rawMissionKind;
  const targetSlot = payload?.coachMove?.targetSlot ?? null;
  const expectedMissionKinds = resolveExpectedMissionKinds(testCase);
  const forbiddenMissionKinds = resolveForbiddenMissionKinds(testCase);
  const expectedTargetSlots = testCase.expectedTargetSlots ?? [];
  const forbiddenTargetSlots = testCase.forbiddenTargetSlots ?? [];
  const acceptableRevision = testCase.expectedLoopComplete === true
    && testCase.allowAcceptedRevision !== false
    && !loopComplete
    && expectedMissionKinds.includes(missionKind);

  if (!loopComplete) {
    requireNonBlank(payload?.coachMove?.focus, "missing_coach_focus", "coachMove.focus is blank", failures);
    requireNonBlank(payload?.coachMove?.why, "missing_coach_reason", "coachMove.why is blank", failures);
    requireNonBlank(payload?.coachMove?.instruction, "missing_coach_instruction", "coachMove.instruction is blank", failures);

    if (!KNOWN_MISSION_KINDS.has(missionKind)) {
      failures.push({
        code: "unknown_mission_kind",
        message: `missionKind ${missionKind || "(blank)"} is not canonical`
      });
    }
  }

  if (expectedMissionKinds.length > 0 && !expectedMissionKinds.includes(missionKind)) {
    failures.push({
      code: "wrong_mission_kind",
      message: `missionKind ${missionKind || "(blank)"} is not one of ${expectedMissionKinds.join(", ")}`
    });
  }

  if (forbiddenMissionKinds.includes(missionKind)) {
    failures.push({
      code: "forbidden_mission_kind",
      message: `missionKind ${missionKind} is forbidden for this case`
    });
  }

  if ((missionKind === "SLOT" || missionKind === "TASK_RESET") && !KNOWN_TARGET_SLOTS.has(targetSlot)) {
    failures.push({
      code: "missing_canonical_target_slot",
      message: `${missionKind} requires a canonical targetSlot`
    });
  }

  if (!loopComplete && expectedTargetSlots.length > 0 && !expectedTargetSlots.includes(targetSlot)) {
    failures.push({
      code: "wrong_target_slot",
      message: `targetSlot ${targetSlot || "(blank)"} is not one of ${expectedTargetSlots.join(", ")}`
    });
  }

  if (!loopComplete && forbiddenTargetSlots.includes(targetSlot)) {
    failures.push({
      code: "forbidden_target_slot",
      message: `targetSlot ${targetSlot} is forbidden for this case`
    });
  }

  const comparisonRequired = testCase.requiresComparison === true
    || missionKind === "LANGUAGE_FIX";
  if (comparisonRequired && !testCase.allowMissingComparison && !hasCoachComparisonPair(payload)) {
    failures.push({
      code: "missing_comparison",
      message: "direct correction mission has no coachMove before/after pair"
    });
  }

  if (comparisonRequired && hasCoachComparisonPair(payload)
      && normalizeText(testCase.answer) !== normalizeText(payload?.coachMove?.before)) {
    failures.push({
      code: "ungrounded_comparison",
      message: "coachMove.before must be the complete learner answer"
    });
  }

  const languageCorrections = Array.isArray(payload?.coachMove?.languageCorrections)
    ? payload.coachMove.languageCorrections
    : [];
  if (missionKind === "LANGUAGE_FIX") {
    const revisedAnswer = textOf(payload?.revisedAnswer).trim();
    const comparisonAfter = textOf(payload?.coachMove?.after).trim();
    if (!revisedAnswer) {
      failures.push({
        code: "missing_revised_answer",
        message: "LANGUAGE_FIX requires one authoritative revisedAnswer"
      });
    } else if (normalizeText(revisedAnswer) !== normalizeText(comparisonAfter)) {
      failures.push({
        code: "language_revision_mismatch",
        message: "revisedAnswer and coachMove.after must match"
      });
    }
    if (languageCorrections.length < 1 || languageCorrections.length > 25) {
      failures.push({
        code: "invalid_language_correction_count",
        message: "LANGUAGE_FIX requires one to 25 languageCorrections"
      });
    }
    languageCorrections.forEach((correction, index) => {
      const hasBefore = isNonBlank(correction?.before);
      const hasAfter = isNonBlank(correction?.after);
      const hasDistinctChange = (hasBefore || hasAfter)
        && normalizeText(correction?.before) !== normalizeText(correction?.after);
      const grammarPairIsComplete = correction?.kind === "STRUCTURE" || (hasBefore && hasAfter);
      if (!KNOWN_LANGUAGE_CORRECTION_KINDS.has(correction?.kind)
          || !hasDistinctChange
          || !grammarPairIsComplete
          || !isNonBlank(correction?.reason)) {
        failures.push({
          code: "invalid_language_correction",
          message: `languageCorrections[${index}] needs a canonical kind, an explained change, and a reason`
        });
      }
    });
  } else if (hasOwn(payload, "revisedAnswer") && isNonBlank(payload?.revisedAnswer)) {
    failures.push({
      code: "unexpected_revised_answer",
      message: "Only LANGUAGE_FIX may expose revisedAnswer"
    });
  }

  const scaffoldRequired = testCase.requiresScaffold === true
    || missionKind === "SLOT"
    || missionKind === "TASK_RESET";
  if (scaffoldRequired && !testCase.allowMissingScaffold && !hasContentScaffold(payload)) {
    failures.push({
      code: "missing_content_scaffold",
      message: "content mission needs skeletonEn, a Korean skeletonKo, and at least two phrase choices with Korean meanings"
    });
  }

  if (testCase.expectedLoopComplete === true && !loopComplete && !acceptableRevision) {
    failures.push({
      code: "loop_not_complete",
      message: "Expected completion or an explicitly accepted revision mission"
    });
  }
  if (testCase.expectedLoopComplete === false && loopComplete) {
    failures.push({
      code: "loop_completed_too_early",
      message: "loopComplete was expected to be false"
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

  if (!loopComplete) {
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
    missionKind: missionKind ?? null,
    targetSlot,
    expectedMissionKinds,
    forbiddenMissionKinds,
    loopComplete,
    fixPointCount: languageCorrections.length,
    hasComparison: hasCoachComparisonPair(payload),
    hasScaffold: hasContentScaffold(payload)
  };
}

export function validateCases(cases) {
  const failures = [];
  const warnings = [];
  const caseIds = new Set();
  const promptAnswers = new Set();

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
    if (isNonBlank(testCase?.caseId)) {
      if (caseIds.has(testCase.caseId)) {
        failures.push(`${label}: duplicate caseId ${testCase.caseId}`);
      }
      caseIds.add(testCase.caseId);
    }
    const promptAnswerKey = `${testCase?.promptId || ""}\u0000${normalizeText(testCase?.answer)}`;
    if (promptAnswers.has(promptAnswerKey)) {
      warnings.push(`${label}: duplicate promptId + answer pair`);
    }
    promptAnswers.add(promptAnswerKey);

    const expectedMissionKinds = resolveExpectedMissionKinds(testCase);
    if (expectedMissionKinds.length === 0) {
      failures.push(`${label}: expectedMissionKinds or legacy expectedFocusTypes must define at least one outcome`);
    }
    for (const missionKind of expectedMissionKinds) {
      if (!KNOWN_MISSION_KINDS.has(missionKind)) {
        failures.push(`${label}: unknown expected mission kind ${missionKind}`);
      }
    }
    for (const missionKind of resolveForbiddenMissionKinds(testCase)) {
      if (!KNOWN_MISSION_KINDS.has(missionKind)) {
        failures.push(`${label}: unknown forbidden mission kind ${missionKind}`);
      }
    }
    for (const focusType of testCase?.expectedFocusTypes ?? []) {
      if (!LEGACY_FOCUS_TYPES.has(focusType)) {
        warnings.push(`${label}: legacy expectedFocusTypes contains unknown focus type ${focusType}`);
      }
    }
    for (const targetSlot of testCase?.expectedTargetSlots ?? []) {
      if (!KNOWN_TARGET_SLOTS.has(targetSlot)) {
        warnings.push(`${label}: expectedTargetSlots contains unknown canonical slot ${targetSlot}`);
      }
    }
    for (const targetSlot of testCase?.forbiddenTargetSlots ?? []) {
      if (!KNOWN_TARGET_SLOTS.has(targetSlot)) {
        warnings.push(`${label}: forbiddenTargetSlots contains unknown canonical slot ${targetSlot}`);
      }
    }
  });

  return { failures, warnings };
}

function legacyFocusToMissionKind(focusType) {
  if (LEGACY_CONTENT_FOCUS_TYPES.has(focusType)) {
    return "SLOT";
  }
  if (focusType === "GRAMMAR_FIX" || focusType === "STRUCTURE_FIX") {
    return "LANGUAGE_FIX";
  }
  if (focusType === "TASK_RESET") {
    return "TASK_RESET";
  }
  if (focusType === "EXPRESSION_POLISH") {
    return "COMPLETE";
  }
  return null;
}

function normalizeExpectedMissionKind(missionKind) {
  return missionKind === "GRAMMAR_FIX" || missionKind === "STRUCTURE_FIX"
    ? "LANGUAGE_FIX"
    : missionKind;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
