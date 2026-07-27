import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePayload,
  resolveExpectedMissionKinds,
  validateCases
} from "./rules.mjs";

const baseCase = {
  name: "quality contract",
  promptId: "prompt-test",
  answer: "I study English every day.",
  expectedMissionKinds: ["SLOT"],
  expectedTargetSlots: ["DETAIL"],
  expectedLoopComplete: false
};

function slotPayload(overrides = {}) {
  return {
    loopComplete: false,
    coachMove: {
      focus: "Add one detail",
      focusType: "SLOT",
      targetSlot: "DETAIL",
      why: "The answer needs one concrete detail.",
      instruction: "Add what you study after the sentence.",
      skeletonEn: "I study ____ every day.",
      skeletonKo: "매일 ____을 공부해요.",
      suggestedPhrases: [
        { phrase: "new words", meaningKo: "새 단어" },
        { phrase: "grammar", meaningKo: "문법" }
      ],
      ...overrides
    },
    ui: {}
  };
}

function languagePayload(overrides = {}) {
  return {
    loopComplete: false,
    revisedAnswer: "I exercise at the gym.",
    coachMove: {
      focus: "문장 완성하기",
      focusType: "LANGUAGE_FIX",
      why: "주어와 서술어가 있는 문장으로 완성해야 해요.",
      instruction: "질문에 답하는 완전한 문장으로 바꿔 보세요.",
      before: "At the gym.",
      after: "I exercise at the gym.",
      languageCorrections: [{
        kind: "STRUCTURE",
        label: "문장 구조",
        before: "At the gym.",
        after: "I exercise at the gym.",
        reason: "Complete the fragment as a sentence."
      }],
      ...(overrides.coachMove ?? {})
    },
    ui: {},
    ...overrides,
    coachMove: {
      focus: "문장 완성하기",
      focusType: "LANGUAGE_FIX",
      why: "주어와 서술어가 있는 문장으로 완성해야 해요.",
      instruction: "질문에 답하는 완전한 문장으로 바꿔 보세요.",
      before: "At the gym.",
      after: "I exercise at the gym.",
      languageCorrections: [{
        kind: "STRUCTURE",
        label: "문장 구조",
        before: "At the gym.",
        after: "I exercise at the gym.",
        reason: "Complete the fragment as a sentence."
      }],
      ...(overrides.coachMove ?? {})
    }
  };
}

test("completed responses do not require a hidden coach move", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      expectedMissionKinds: ["COMPLETE"],
      expectedTargetSlots: [],
      expectedLoopComplete: true
    },
    { loopComplete: true, ui: {} }
  );

  assert.equal(result.pass, true);
  assert.equal(result.missionKind, "COMPLETE");
});

test("completion-acceptable cases also allow an explicitly accepted slot revision", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      expectedMissionKinds: ["COMPLETE", "SLOT"],
      expectedLoopComplete: true
    },
    slotPayload()
  );

  assert.equal(result.pass, true);
});

test("slot missions require the complete bilingual scaffold", () => {
  const result = evaluatePayload(baseCase, slotPayload());

  assert.equal(result.pass, true);
  assert.equal(result.hasScaffold, true);
});

test("rewrite starter text cannot replace a missing Korean scaffold", () => {
  const payload = slotPayload({ skeletonKo: "I study ____ every day." });
  payload.rewriteWorkspace = { starterText: "I study" };
  const result = evaluatePayload(baseCase, payload);

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "missing_content_scaffold"));
});

test("language missions must quote the complete learner answer", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      expectedMissionKinds: ["LANGUAGE_FIX"],
      expectedTargetSlots: []
    },
    {
      loopComplete: false,
      revisedAnswer: "I study every day.",
      coachMove: {
        focus: "Fix the tense",
        focusType: "LANGUAGE_FIX",
        why: "Use present tense for a routine.",
        instruction: "Replace the verb form.",
        before: "I studied yesterday.",
        after: "I study every day.",
        languageCorrections: [{
          kind: "GRAMMAR_LOCAL",
          label: "세부 교정",
          before: "studied",
          after: "study",
          reason: "Use the present tense for a routine."
        }]
      },
      ui: {}
    }
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "ungrounded_comparison"));
});

test("language missions require a grounded before and after pair", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      answer: "At the gym.",
      expectedMissionKinds: ["LANGUAGE_FIX"],
      expectedTargetSlots: [],
      requiresComparison: true
    },
    languagePayload()
  );

  assert.equal(result.pass, true);
  assert.equal(result.missionKind, "LANGUAGE_FIX");
  assert.equal(result.fixPointCount, 1);
});

test("language missions require one revised answer shared by the UI comparison", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      answer: "At the gym.",
      expectedMissionKinds: ["LANGUAGE_FIX"],
      expectedTargetSlots: []
    },
    languagePayload({
      coachMove: { after: "I work out at the gym." }
    })
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "language_revision_mismatch"));
});

test("language missions reject more than 25 correction rows", () => {
  const corrections = Array.from({ length: 26 }, (_, index) => ({
    kind: "GRAMMAR_LOCAL",
    label: "세부 교정",
    before: `before-${index}`,
    after: `after-${index}`,
    reason: "A reason"
  }));
  const result = evaluatePayload(
    {
      ...baseCase,
      answer: "At the gym.",
      expectedMissionKinds: ["LANGUAGE_FIX"],
      expectedTargetSlots: []
    },
    languagePayload({ coachMove: { languageCorrections: corrections } })
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "invalid_language_correction_count"));
});

test("explicit continue cases reject early completion", () => {
  const result = evaluatePayload(baseCase, { loopComplete: true, ui: {} });

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "loop_completed_too_early"));
});

test("canonical target slots are checked independently from mission kind", () => {
  const result = evaluatePayload(baseCase, slotPayload({ targetSlot: "ADVANTAGE" }));

  assert.equal(result.pass, false);
  assert.equal(result.targetSlot, "ADVANTAGE");
  assert.ok(result.failures.some((failure) => failure.code === "wrong_target_slot"));
});

test("legacy fix points are rejected from the public response", () => {
  const payload = slotPayload();
  payload.ui.fixPoints = [{ kind: "REASON" }];
  const result = evaluatePayload(baseCase, payload);

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "legacy_field_leak"));
});

test("legacy language mission oracles map to LANGUAGE_FIX", () => {
  assert.deepEqual(
    resolveExpectedMissionKinds({
      expectedFocusTypes: ["DETAIL", "GRAMMAR_FIX", "EXPRESSION_POLISH"],
      expectedLoopComplete: true
    }),
    ["SLOT", "LANGUAGE_FIX", "COMPLETE"]
  );
  assert.deepEqual(
    resolveExpectedMissionKinds({
      expectedMissionKinds: ["STRUCTURE_FIX", "GRAMMAR_FIX"]
    }),
    ["LANGUAGE_FIX"]
  );

  const validation = validateCases([{
    name: "legacy case",
    promptId: "prompt-test",
    answer: "I study English.",
    expectedFocusTypes: ["DETAIL"]
  }]);
  assert.deepEqual(validation.failures, []);
});

test("retired score fields fail the public response contract", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      expectedMissionKinds: ["COMPLETE"],
      expectedTargetSlots: [],
      expectedLoopComplete: true
    },
    { loopComplete: true, score: 90, ui: {} }
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "legacy_field_leak"));
});
