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

test("language missions explain each correction row instead of coachMove.why", () => {
  const languageResult = evaluatePayload(
    {
      ...baseCase,
      answer: "At the gym.",
      expectedMissionKinds: ["LANGUAGE_FIX"],
      expectedTargetSlots: []
    },
    languagePayload({ coachMove: { why: null } })
  );
  const slotResult = evaluatePayload(baseCase, slotPayload({ why: "" }));

  assert.equal(languageResult.pass, true);
  assert.equal(slotResult.pass, false);
  assert.ok(slotResult.failures.some((failure) => failure.code === "missing_coach_reason"));
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

// [spec] 050: 회귀 리포트의 completion 줄임이 서버 응답의 실제 필드(FeedbackCompletionDto)를 남기는지.
// OpenAI를 부르지 않는다. 가짜 /api/feedback 서버로 run-feedback-quality-check.mjs를 돌리고 리포트를 읽는다.
async function runQualityCheckWithFakeFeedback(payloadByAnswer) {
  const http = await import("node:http");
  const os = await import("node:os");
  const fsp = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { execFile } = await import("node:child_process");

  const testDir = pathMod.dirname(fileURLToPath(import.meta.url));
  const repoRoot = pathMod.resolve(testDir, "..", "..");
  const scriptPath = pathMod.join(repoRoot, "scripts", "run-feedback-quality-check.mjs");
  const tempDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "wl-spec-completion-"));

  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (request.method !== "POST" || request.url !== "/api/feedback") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end("{}");
        return;
      }
      const answer = JSON.parse(body).answer;
      const payload = payloadByAnswer[answer];
      if (!payload) {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: `no fake payload for ${answer}` }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const cases = Object.keys(payloadByAnswer).map((answer, index) => ({
      name: `spec completion case ${index + 1}`,
      promptId: "prompt-spec-completion",
      answer,
      expectedMissionKinds: ["COMPLETE"],
      expectedLoopComplete: true
    }));
    const casesPath = pathMod.join(tempDir, "cases.spec-completion.json");
    const reportDir = pathMod.join(tempDir, "report");
    await fsp.writeFile(casesPath, JSON.stringify(cases), "utf8");

    const env = { ...process.env };
    delete env.WRITELOOP_FEEDBACK_AUTH_TOKEN;
    const run = await new Promise((resolve) => {
      execFile(
        process.execPath,
        [
          scriptPath,
          "--cases", casesPath,
          "--base-url", `http://127.0.0.1:${port}`,
          "--report-dir", reportDir,
          "--skip-prompt-preflight",
          "--include-pass-payloads",
          "--timeout-ms", "10000"
        ],
        { cwd: repoRoot, env, timeout: 60000 },
        (error, stdout, stderr) => resolve({ error, stdout, stderr })
      );
    });

    let report;
    try {
      report = JSON.parse(await fsp.readFile(pathMod.join(reportDir, "latest.json"), "utf8"));
    } catch (error) {
      throw new Error(`report was not written: ${error.message}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    }
    const actualByAnswer = Object.fromEntries(report.results.map((result) => [result.answer, result.actual]));
    return { report, actualByAnswer, run };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

const specSuggestedPhrases = [
  { phrase: "on weekends", meaningKo: "주말마다" },
  { phrase: "with my sister", meaningKo: "언니와 함께" }
];

test("[spec] report completion keeps headline, improvedPoint, encouragement, nextTinyGoal and enrichment", async () => {
  const completedAnswer = "I like hiking because it clears my mind.";
  const coachAnswer = "I like hiking.";
  const { actualByAnswer } = await runQualityCheckWithFakeFeedback({
    [completedAnswer]: {
      loopComplete: true,
      ui: {},
      completion: {
        headline: "질문에 끝까지 답했어요",
        improvedPoint: "이유를 because로 이어 붙였어요.",
        encouragement: "이 흐름 그대로 계속 써 보세요.",
        nextTinyGoal: "다음에는 언제 하는지도 덧붙여 보세요.",
        enrichment: {
          focus: "언제 하는지 더하기",
          focusType: "SLOT",
          why: "언제 하는지 쓰면 답이 더 풍부해져요.",
          instruction: "문장 끝에 언제 하는지 붙여 보세요.",
          skeletonEn: "I like hiking ____.",
          skeletonKo: "나는 ____ 하이킹을 좋아해요.",
          suggestedPhrases: specSuggestedPhrases,
          targetSlot: "TIME"
        }
      }
    },
    [coachAnswer]: {
      loopComplete: false,
      ui: {},
      coachMove: {
        focus: "이유 더하기",
        focusType: "SLOT",
        targetSlot: "REASON",
        why: "왜 좋아하는지가 빠졌어요.",
        instruction: "because로 이유를 붙여 보세요.",
        skeletonEn: "I like hiking because ____.",
        skeletonKo: "나는 ____ 때문에 하이킹을 좋아해요.",
        suggestedPhrases: specSuggestedPhrases
      }
    }
  });

  const completion = actualByAnswer[completedAnswer].completion;
  const coachPhrases = actualByAnswer[coachAnswer].coachMove.suggestedPhrases;
  // enrichment.suggestedPhrases는 리포트의 coachMove.suggestedPhrases와 같은 줄임이어야 한다(같은 입력이면 같은 결과).
  assert.equal(coachPhrases.length, 2);
  assert.deepEqual(completion, {
    headline: "질문에 끝까지 답했어요",
    improvedPoint: "이유를 because로 이어 붙였어요.",
    encouragement: "이 흐름 그대로 계속 써 보세요.",
    nextTinyGoal: "다음에는 언제 하는지도 덧붙여 보세요.",
    enrichment: {
      focus: "언제 하는지 더하기",
      focusType: "SLOT",
      why: "언제 하는지 쓰면 답이 더 풍부해져요.",
      instruction: "문장 끝에 언제 하는지 붙여 보세요.",
      skeletonEn: "I like hiking ____.",
      skeletonKo: "나는 ____ 하이킹을 좋아해요.",
      suggestedPhrases: coachPhrases,
      targetSlot: "TIME"
    }
  });
});

test("[spec] report completion no longer keeps title, message, nextActionLabel", async () => {
  const answer = "I read novels before bed because it relaxes me.";
  const { actualByAnswer } = await runQualityCheckWithFakeFeedback({
    [answer]: {
      loopComplete: true,
      ui: {},
      completion: {
        headline: "잘 마무리했어요",
        title: "old title",
        message: "old message",
        nextActionLabel: "old label"
      }
    }
  });

  assert.deepEqual(actualByAnswer[answer].completion, { headline: "잘 마무리했어요" });
});

test("[spec] report completion drops missing values the same way as other fields", async () => {
  const answer = "I cook pasta on Sundays with my family.";
  const { actualByAnswer } = await runQualityCheckWithFakeFeedback({
    [answer]: {
      loopComplete: true,
      ui: {},
      completion: {
        headline: null,
        improvedPoint: "",
        encouragement: "   ",
        nextTinyGoal: "왜 좋아하는지도 써 보세요.",
        enrichment: {
          focus: "이유 더하기",
          focusType: null,
          why: "",
          suggestedPhrases: []
        }
      }
    }
  });

  assert.deepEqual(actualByAnswer[answer].completion, {
    nextTinyGoal: "왜 좋아하는지도 써 보세요.",
    enrichment: { focus: "이유 더하기" }
  });
});

test("[spec] report completion text is normalized and length-limited like other fields", async () => {
  const answer = "I walk my dog every morning before work.";
  const longText = "a".repeat(5000);
  const { actualByAnswer } = await runQualityCheckWithFakeFeedback({
    [answer]: {
      loopComplete: true,
      ui: {},
      completion: {
        headline: "  잘   썼어요\n오늘도  ",
        improvedPoint: longText,
        encouragement: longText,
        nextTinyGoal: longText,
        enrichment: {
          focus: longText,
          why: longText,
          instruction: longText,
          skeletonEn: longText,
          skeletonKo: longText
        }
      }
    }
  });

  const completion = actualByAnswer[answer].completion;
  assert.equal(completion.headline, "잘 썼어요 오늘도");
  for (const value of [
    completion.improvedPoint,
    completion.encouragement,
    completion.nextTinyGoal,
    completion.enrichment?.focus,
    completion.enrichment?.why,
    completion.enrichment?.instruction,
    completion.enrichment?.skeletonEn,
    completion.enrichment?.skeletonKo
  ]) {
    assert.equal(typeof value, "string");
    assert.ok(value.length < longText.length, `expected a length limit, got ${value.length} chars`);
    assert.ok(value.endsWith("..."), "expected the same truncation marker as other fields");
  }
});
