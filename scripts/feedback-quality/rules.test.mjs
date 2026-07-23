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
      skeletonKo: "\uB9E4\uC77C ____\uC744 \uACF5\uBD80\uD574\uC694.",
      suggestedPhrases: [
        { phrase: "new words", meaningKo: "\uC0C8 \uB2E8\uC5B4" },
        { phrase: "grammar", meaningKo: "\uBB38\uBC95" }
      ],
      ...overrides
    },
    ui: { fixPoints: [{ kind: overrides.targetSlot ?? "DETAIL" }] }
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
    { loopComplete: true, ui: { fixPoints: [] } }
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

test("grammar missions must quote the current answer", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      expectedMissionKinds: ["GRAMMAR_FIX"],
      expectedTargetSlots: []
    },
    {
      loopComplete: false,
      coachMove: {
        focus: "Fix the tense",
        focusType: "GRAMMAR_FIX",
        why: "Use present tense for a routine.",
        instruction: "Replace the verb form.",
        before: "I studied yesterday",
        after: "I study every day"
      },
      ui: { fixPoints: [{ kind: "GRAMMAR_FIX" }] }
    }
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "ungrounded_comparison"));
});

test("structure missions require a grounded before and after pair", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      answer: "At the gym.",
      expectedMissionKinds: ["STRUCTURE_FIX"],
      expectedTargetSlots: [],
      requiresComparison: true
    },
    {
      loopComplete: false,
      correctedAnswer: "I exercise at the gym.",
      coachMove: {
        focus: "문장 완성하기",
        focusType: "STRUCTURE_FIX",
        why: "주어와 서술어가 있는 문장으로 완성해야 해요.",
        instruction: "질문의 틀을 활용해 완전한 문장으로 바꿔 보세요.",
        before: "At the gym.",
        after: "I exercise at the gym."
      },
      ui: {
        fixPoints: [{ kind: "STRUCTURE_FIX", revisedText: "I exercise at the gym." }]
      }
    }
  );

  assert.equal(result.pass, true);
  assert.equal(result.missionKind, "STRUCTURE_FIX");
});

test("structure missions require one corrected answer shared by the UI comparison", () => {
  const result = evaluatePayload(
    {
      ...baseCase,
      answer: "At the gym.",
      expectedMissionKinds: ["STRUCTURE_FIX"],
      expectedTargetSlots: []
    },
    {
      loopComplete: false,
      correctedAnswer: "I exercise at the gym.",
      coachMove: {
        focus: "문장 완성하기",
        focusType: "STRUCTURE_FIX",
        why: "주어와 서술어가 필요해요.",
        instruction: "완전한 문장으로 바꿔 보세요.",
        before: "At the gym.",
        after: "I work out at the gym."
      },
      ui: {
        fixPoints: [{ kind: "STRUCTURE_FIX", revisedText: "I exercise at the gym." }]
      }
    }
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "structure_correction_mismatch"));
});

test("explicit continue cases reject early completion", () => {
  const result = evaluatePayload(baseCase, { loopComplete: true, ui: { fixPoints: [] } });

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "loop_completed_too_early"));
});

test("canonical target slots are checked independently from mission kind", () => {
  const result = evaluatePayload(baseCase, slotPayload({ targetSlot: "ADVANTAGE" }));

  assert.equal(result.pass, false);
  assert.equal(result.targetSlot, "ADVANTAGE");
  assert.ok(result.failures.some((failure) => failure.code === "wrong_target_slot"));
});

test("the first fix point follows the canonical target slot", () => {
  const payload = slotPayload();
  payload.ui.fixPoints = [{ kind: "REASON" }];
  const result = evaluatePayload(baseCase, payload);

  assert.equal(result.pass, true);
  assert.ok(result.warnings.some((warning) => warning.code === "first_fix_mission_mismatch"));
});

test("legacy focus oracles map to canonical mission kinds", () => {
  assert.deepEqual(
    resolveExpectedMissionKinds({
      expectedFocusTypes: ["DETAIL", "GRAMMAR_FIX", "EXPRESSION_POLISH"],
      expectedLoopComplete: true
    }),
    ["SLOT", "GRAMMAR_FIX", "COMPLETE"]
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
    { loopComplete: true, score: 90, ui: { fixPoints: [] } }
  );

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === "legacy_field_leak"));
});
