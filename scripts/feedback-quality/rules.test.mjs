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

// [spec] 055 ①: 회귀 케이스의 이어 쓴 답(followUps). 시나리오 F1~F3, R1~R19, G1~G3과 결정 Q1~Q5
// (private 작업 055/02 의 02-qa-scenarios.md, 03-main-decision.md). OpenAI를 부르지 않는다.
// 가짜 /api/feedback 서버가 받은 요청을 도착 순서대로 기록하고 (attemptType, answer)로 정한 응답을 돌려준다.
const SPEC_FU_PROMPT = "prompt-spec-followup";
const SPEC_FU_SESSION = "sess-qa-055";
const SPEC_FU_A0 = "I like hiking.";
const SPEC_FU_A1 = "I like hiking because it is fun.";
const SPEC_FU_A2 = "I like hiking because it clears my mind after a long week.";
const specFollowUpPhrases = [
  { phrase: "it relaxes me", meaningKo: "마음이 편해져서" },
  { phrase: "with my family", meaningKo: "가족과 함께" }
];

function specFuPmr(status) {
  return { focusType: "SLOT", title: "이유 더하기", targetSlot: "REASON", status, message: "이유를 더 구체적으로 써 보세요" };
}

function specFuSlot(slot, prev, coachOverrides = {}) {
  return {
    sessionId: SPEC_FU_SESSION,
    loopComplete: false,
    coachMove: {
      focus: "이유 더하기",
      focusType: "SLOT",
      targetSlot: slot,
      why: "이유가 있으면 답이 더 분명해져요.",
      instruction: "because로 이유를 하나 더 붙여 보세요.",
      skeletonEn: "I like hiking because ____.",
      skeletonKo: "나는 ____ 때문에 하이킹을 좋아해요.",
      suggestedPhrases: specFollowUpPhrases,
      ...coachOverrides
    },
    ...(prev ? { previousMissionResult: prev } : {})
  };
}

function specFuComplete(prev) {
  return {
    sessionId: SPEC_FU_SESSION,
    loopComplete: true,
    ui: {},
    completion: { headline: "잘 마무리했어요" },
    ...(prev ? { previousMissionResult: prev } : {})
  };
}

function specFuLanguageFix(before, after) {
  return {
    sessionId: SPEC_FU_SESSION,
    loopComplete: false,
    revisedAnswer: after,
    coachMove: {
      focus: "문장 다듬기",
      focusType: "LANGUAGE_FIX",
      instruction: "고친 문장을 보고 다시 써 보세요.",
      before,
      after,
      languageCorrections: [
        { kind: "GRAMMAR_LOCAL", before: "it is fun", after: "it is really fun", reason: "느낌을 더 분명하게 해요." }
      ]
    }
  };
}

function specFuKey(attemptType, answer) {
  return `${attemptType}|${answer}`;
}

function specFuCase(overrides = {}) {
  return {
    name: "spec followup case",
    promptId: SPEC_FU_PROMPT,
    answer: SPEC_FU_A0,
    expectedMissionKinds: ["SLOT"],
    expectedTargetSlots: ["REASON"],
    ...overrides
  };
}

const SPEC_FU_R2_FOLLOWUPS = [
  { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedTargetSlots: ["REASON"], expectedPreviousMissionStatus: "PARTIAL" },
  { answer: SPEC_FU_A2, expectedMissionKinds: ["COMPLETE"], expectedLoopComplete: true, expectedPreviousMissionStatus: "RESOLVED" }
];

function specFuR2Responses() {
  return {
    [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
    [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("REASON", specFuPmr("PARTIAL")),
    [specFuKey("REWRITE", SPEC_FU_A2)]: specFuComplete(specFuPmr("RESOLVED"))
  };
}

function specFuEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("WRITELOOP_FEEDBACK_")) {
      delete env[key];
    }
  }
  return env;
}

async function specFuPaths() {
  const pathMod = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const testDir = pathMod.dirname(fileURLToPath(import.meta.url));
  const repoRoot = pathMod.resolve(testDir, "..", "..");
  return { pathMod, testDir, repoRoot, scriptPath: pathMod.join(repoRoot, "scripts", "run-feedback-quality-check.mjs") };
}

function specFuExec(args, cwd) {
  return import("node:child_process").then(({ execFile }) => new Promise((resolve) => {
    execFile(process.execPath, args, { cwd, env: specFuEnv(), timeout: 120000, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr }));
  }));
}

// 케이스 파일(배열이나 경로)을 --dry-run으로 돌린다.
async function runSpecFuDryRun(casesOrPath, extraArgs = []) {
  const os = await import("node:os");
  const fsp = await import("node:fs/promises");
  const { pathMod, repoRoot, scriptPath } = await specFuPaths();
  let casesPath = casesOrPath;
  let tempDir = null;
  if (typeof casesOrPath !== "string") {
    tempDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "wl-spec-followup-dry-"));
    casesPath = pathMod.join(tempDir, "cases.spec-followup.json");
    await fsp.writeFile(casesPath, JSON.stringify(casesOrPath), "utf8");
  }
  try {
    return await specFuExec([scriptPath, "--cases", casesPath, "--dry-run", ...extraArgs], repoRoot);
  } finally {
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  }
}

// 가짜 서버로 실제 실행. responses가 함수면 respond(body)가 { status, json | text, delayMs } 또는 응답 JSON을 돌려준다.
// 객체면 (attemptType, answer) 키로 응답을 고르고, 없으면 HTTP 500.
async function runSpecFuCheck(cases, responses, extraArgs = [], options = {}) {
  const http = await import("node:http");
  const os = await import("node:os");
  const fsp = await import("node:fs/promises");
  const { pathMod, repoRoot, scriptPath } = await specFuPaths();
  const tempDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "wl-spec-followup-"));
  const requests = [];
  const respond = typeof responses === "function"
    ? responses
    : (body) => responses[specFuKey(body.attemptType, body.answer)] ?? { status: 500, json: { error: `no fake payload for ${body.answer}` } };

  const server = http.createServer((request, response) => {
    const arrivedAt = process.hrtime.bigint();
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => {
      if (request.method !== "POST" || request.url !== "/api/feedback") {
        requests.push({ method: request.method, url: request.url, body: null, arrivedAt, sentAt: null });
        response.writeHead(404, { "content-type": "application/json" });
        response.end("{}");
        return;
      }
      const body = JSON.parse(raw);
      const record = { method: request.method, url: request.url, body, arrivedAt, sentAt: null };
      requests.push(record);
      let planned = respond(body, requests.length - 1);
      if (!planned || (planned.status === undefined && planned.json === undefined && planned.text === undefined)) {
        planned = { status: 200, json: planned };
      }
      const send = () => {
        const status = planned.status ?? 200;
        response.writeHead(status, { "content-type": "application/json" });
        response.end(planned.text !== undefined ? planned.text : JSON.stringify(planned.json));
        record.sentAt = process.hrtime.bigint();
      };
      const delayMs = planned.delayMs ?? options.delayMs ?? 0;
      if (delayMs > 0) {
        setTimeout(send, delayMs);
      } else {
        send();
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const casesPath = typeof cases === "string" ? cases : pathMod.join(tempDir, "cases.spec-followup.json");
    if (typeof cases !== "string") {
      await fsp.writeFile(casesPath, JSON.stringify(cases), "utf8");
    }
    const reportDir = pathMod.join(tempDir, "report");
    const run = await specFuExec([
      scriptPath,
      "--cases", casesPath,
      "--base-url", `http://127.0.0.1:${port}`,
      "--report-dir", reportDir,
      "--skip-prompt-preflight",
      "--include-pass-payloads",
      "--timeout-ms", "10000",
      ...extraArgs
    ], repoRoot);
    let report = null;
    try {
      report = JSON.parse(await fsp.readFile(pathMod.join(reportDir, "latest.json"), "utf8"));
    } catch {
      report = null;
    }
    const detail = `exit ${run.code}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`;
    return { report, requests, run, detail };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

function specFuFailureText(item) {
  return (item?.failures ?? []).map((failure) => `${failure.code ?? ""} ${failure.message ?? ""}`).join(" | ");
}

function specFuStepPasses(report) {
  return (report?.results?.[0]?.steps ?? []).map((step) => step.pass);
}

// ---------------------------------------------------------------- F. 케이스 형식

const SPEC_FU_G1 = [
  ["cases.ambiguous-bare-verb-fragments-10.json", 10, 0],
  ["cases.completion-gate-150-v2.json", 150, 0],
  ["cases.completion-gate-150-v3.json", 150, 0],
  ["cases.completion-gate-150.json", 150, 0],
  ["cases.generated-100-2026-05-07.json", 100, 1],
  ["cases.mixed-errors-100.json", 100, 0],
  ["cases.prompt-refactor-50.json", 50, 0],
  ["cases.question-slot-relations-60.json", 60, 0],
  ["cases.regression.json", 55, 0],
  ["cases.release.json", 60, 2],
  ["cases.slot-specificity-30.json", 30, 0],
  ["cases.slot-unification-100.json", 100, 0],
  ["cases.smoke.json", 6, 0]
];

test("[spec] F1 existing case files still dry-run with the same executions and warnings", async () => {
  const { pathMod, testDir } = await specFuPaths();
  for (const [file, executions, warningLines] of SPEC_FU_G1) {
    const run = await runSpecFuDryRun(pathMod.join(testDir, file));
    assert.equal(run.code, 0, `${file}: ${run.stdout}${run.stderr}`);
    const match = run.stdout.match(/= (\d+) execution\(s\)/);
    assert.ok(match, `${file}: no execution count in ${run.stdout}`);
    assert.equal(Number(match[1]), executions, file);
    assert.match(run.stdout, /x 1 repetition\(s\)/, file);
    const warnings = run.stderr.split(/\r?\n/).filter((line) => line.startsWith("- "));
    assert.equal(warnings.length, warningLines, `${file}: ${run.stderr}`);
    // followUps가 없으면 요청 수는 실행 수와 같다(명세 3).
    const requests = run.stdout.match(/(\d+) request\(s\)/);
    if (requests) {
      assert.equal(Number(requests[1]), executions, file);
    }
  }
});

test("[spec] F2 followUps with every expectation field and a single or array previous status are valid", async () => {
  const run = await runSpecFuDryRun([specFuCase({
    followUps: [
      {
        answer: SPEC_FU_A1,
        expectedMissionKinds: ["SLOT"],
        expectedTargetSlots: ["REASON"],
        forbiddenMissionKinds: ["LANGUAGE_FIX"],
        forbiddenTargetSlots: ["DETAIL"],
        expectedLoopComplete: false,
        mustContainAny: { "coachMove.instruction": ["because"] },
        mustNotContainAny: { "coachMove.instruction": ["sorry"] },
        expectedPreviousMissionStatus: "PARTIAL"
      },
      {
        answer: SPEC_FU_A2,
        expectedMissionKinds: ["COMPLETE"],
        expectedLoopComplete: true,
        expectedPreviousMissionStatus: ["RESOLVED", "PARTIAL"]
      }
    ]
  })]);
  assert.equal(run.code, 0, run.stdout + run.stderr);
  assert.doesNotMatch(run.stdout + run.stderr, /validation failed/);
});

for (const [label, testCase] of [
  ["followUps is not an array", specFuCase({ followUps: { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"] } })],
  ["a followUp answer is blank", specFuCase({ followUps: [{ answer: "  ", expectedMissionKinds: ["SLOT"] }] })],
  ["a followUp has no expected mission", specFuCase({ followUps: [{ answer: SPEC_FU_A1 }] })],
  ["a followUp previous status is unknown", specFuCase({ followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: "DONE" }] })],
  ["a followUp previous status array has an unknown value", specFuCase({ followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: ["PARTIAL", "DONE"] }] })],
  ["the first answer has expectedPreviousMissionStatus", specFuCase({ expectedPreviousMissionStatus: "PARTIAL", followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"] }] })]
]) {
  test(`[spec] F3 (Q1) dry-run fails when ${label}`, async () => {
    const run = await runSpecFuDryRun([testCase]);
    assert.notEqual(run.code, 0, run.stdout + run.stderr);
    assert.match(run.stderr, /validation failed/);
  });
}

test("[spec] F3 (Q1) a followUp without an expected mission follows the first-answer rule", async () => {
  // 최상위에서 기대 미션이 없으면 실패이므로, 항목도 실패다.
  const top = await runSpecFuDryRun([specFuCase({ expectedMissionKinds: undefined, expectedTargetSlots: undefined })]);
  const item = await runSpecFuDryRun([specFuCase({ followUps: [{ answer: SPEC_FU_A1 }] })]);
  assert.notEqual(top.code, 0);
  assert.notEqual(item.code, 0);
  assert.match(top.stderr, /validation failed/);
  assert.match(item.stderr, /validation failed/);
});

// ---------------------------------------------------------------- R. 실행·채점·리포트

test("[spec] R1 a case without followUps sends one FIRST request with the same body keys", async () => {
  const { report, requests, run, detail } = await runSpecFuCheck(
    [specFuCase()],
    { [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON") }
  );
  assert.equal(run.code, 0, detail);
  assert.equal(requests.length, 1);
  assert.deepEqual(Object.keys(requests[0].body).sort(), ["answer", "attemptType", "guestId", "promptId"]);
  assert.equal(requests[0].body.attemptType, "FIRST");
  assert.equal(requests[0].body.answer, SPEC_FU_A0);
  assert.equal("sessionId" in requests[0].body, false);
  assert.equal(report.results[0].pass, true);
});

test("[spec] R2 R3 followUps are sent in order as REWRITE with the session and guest, each step uses its own expectations", async () => {
  const { report, requests, run, detail } = await runSpecFuCheck(
    [specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })],
    specFuR2Responses()
  );
  assert.equal(requests.length, 3, detail);
  assert.deepEqual(requests.map((request) => request.body.answer), [SPEC_FU_A0, SPEC_FU_A1, SPEC_FU_A2]);
  assert.equal(requests[0].body.attemptType, "FIRST");
  for (const request of requests.slice(1)) {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/feedback");
    assert.equal(request.body.attemptType, "REWRITE");
    assert.equal(request.body.sessionId, SPEC_FU_SESSION);
    assert.equal(request.body.guestId, requests[0].body.guestId);
    assert.equal(request.body.promptId, SPEC_FU_PROMPT);
  }
  assert.equal(typeof requests[0].body.guestId, "string");
  assert.ok(requests[0].body.guestId.length > 0);
  assert.equal(report.results[0].pass, true, detail);
  assert.equal(report.total, 1);
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 0);
  assert.equal(run.code, 0, detail);
});

test("[spec] R4 a wrong mission kind on the rewrite step fails the case", async () => {
  const { report, run, detail } = await runSpecFuCheck(
    [specFuCase({ followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["LANGUAGE_FIX"] }] })],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("REASON")
    }
  );
  assert.deepEqual(specFuStepPasses(report), [true, false], detail);
  assert.equal(report.results[0].pass, false);
  assert.equal(report.failed, 1);
  assert.notEqual(run.code, 0);
});

for (const [id, followUp, response, expectedStepPass] of [
  ["R5a forbiddenMissionKinds", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT", "LANGUAGE_FIX"], forbiddenMissionKinds: ["SLOT"] }, specFuSlot("REASON"), false],
  ["R5b expectedTargetSlots", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedTargetSlots: ["DETAIL"] }, specFuSlot("REASON"), false],
  ["R5c forbiddenTargetSlots", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], forbiddenTargetSlots: ["REASON"] }, specFuSlot("REASON"), false],
  ["R6a mustContainAny matched", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], mustContainAny: { "coachMove.instruction": ["because"] } }, specFuSlot("REASON"), true],
  ["R6b mustContainAny missing", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], mustContainAny: { "coachMove.instruction": ["feeling"] } }, specFuSlot("REASON"), false],
  ["R6c mustNotContainAny", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], mustNotContainAny: { "coachMove.instruction": ["because"] } }, specFuSlot("REASON"), false],
  ["R7a expectedLoopComplete true", { answer: SPEC_FU_A1, expectedMissionKinds: ["COMPLETE"], expectedLoopComplete: true }, specFuComplete(), true],
  ["R7b expectedLoopComplete false", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT", "COMPLETE"], expectedLoopComplete: false }, specFuComplete(), false],
  ["R8a previous status matched", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: "PARTIAL" }, specFuSlot("REASON", specFuPmr("PARTIAL")), true],
  ["R8b previous status different", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: "PARTIAL" }, specFuSlot("REASON", specFuPmr("RESOLVED")), false],
  ["R9a previous status array matched", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: ["PARTIAL", "RESOLVED"] }, specFuSlot("REASON", specFuPmr("RESOLVED")), true],
  ["R9b previous status array different", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: ["PARTIAL", "RESOLVED"] }, specFuSlot("REASON", specFuPmr("UNRESOLVED")), false],
  ["R10 previous status expected but missing", { answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"], expectedPreviousMissionStatus: "PARTIAL" }, specFuSlot("REASON"), false],
  // R19(Q3): 다시 쓴 답 단계의 LANGUAGE_FIX 기본 검사는 그 단계에서 보낸 답으로 한다.
  ["R19a rewrite LANGUAGE_FIX quoting the rewrite answer", { answer: SPEC_FU_A1, expectedMissionKinds: ["LANGUAGE_FIX"] }, specFuLanguageFix(SPEC_FU_A1, "I like hiking because it is really fun."), true],
  ["R19b rewrite LANGUAGE_FIX quoting the first answer", { answer: SPEC_FU_A1, expectedMissionKinds: ["LANGUAGE_FIX"] }, specFuLanguageFix(SPEC_FU_A0, "I like hiking a lot."), false]
]) {
  test(`[spec] ${id} is checked on the rewrite step`, async () => {
    const { report, requests, run, detail } = await runSpecFuCheck(
      [specFuCase({ followUps: [followUp] })],
      {
        [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
        [specFuKey("REWRITE", SPEC_FU_A1)]: response
      }
    );
    assert.equal(requests.length, 2, detail);
    assert.deepEqual(specFuStepPasses(report), [true, expectedStepPass], detail);
    assert.equal(report.results[0].pass, expectedStepPass, detail);
    if (expectedStepPass) {
      assert.equal(run.code, 0, detail);
    } else {
      assert.notEqual(run.code, 0, detail);
    }
  });
}

test("[spec] R11 an expectation failure on the first answer does not stop the rewrite step", async () => {
  const { report, requests, detail } = await runSpecFuCheck(
    [specFuCase({ expectedMissionKinds: ["LANGUAGE_FIX"], expectedTargetSlots: undefined, followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"] }] })],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("REASON")
    }
  );
  assert.equal(requests.length, 2, detail);
  assert.equal(requests[1].body.answer, SPEC_FU_A1);
  assert.deepEqual(specFuStepPasses(report), [false, true], detail);
  assert.equal(report.results[0].pass, false);
});

test("[spec] R12 a failed first request stops the case before the followUps", async () => {
  const responses = specFuR2Responses();
  responses[specFuKey("FIRST", SPEC_FU_A0)] = { status: 500, json: { error: "boom" } };
  const { report, requests, run, detail } = await runSpecFuCheck([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], responses);
  assert.equal(requests.length, 1, detail);
  assert.equal(report.results[0].pass, false);
  assert.match(specFuFailureText(report.results[0]), /HTTP 500/);
  assert.notEqual(run.code, 0);
});

test("[spec] R13 a failed middle request stops the later steps", async () => {
  const responses = specFuR2Responses();
  responses[specFuKey("REWRITE", SPEC_FU_A1)] = { status: 500, json: { error: "boom" } };
  const { report, requests, run, detail } = await runSpecFuCheck([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], responses);
  assert.equal(requests.length, 2, detail);
  assert.deepEqual(requests.map((request) => request.body.answer), [SPEC_FU_A0, SPEC_FU_A1]);
  assert.equal(report.results[0].pass, false);
  assert.match(specFuFailureText(report.results[0]), /HTTP 500/);
  assert.notEqual(run.code, 0);
});

test("[spec] R14 a middle response that is not JSON stops the later steps", async () => {
  const responses = specFuR2Responses();
  responses[specFuKey("REWRITE", SPEC_FU_A1)] = { status: 200, text: "not json" };
  const { report, requests, run, detail } = await runSpecFuCheck([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], responses);
  assert.equal(requests.length, 2, detail);
  assert.equal(report.results[0].pass, false);
  assert.notEqual(run.code, 0);
});

test("[spec] R15 steps of one case are sent one after another even with concurrency", async () => {
  const cases = [
    specFuCase({ name: "spec followup concurrent 1", followUps: SPEC_FU_R2_FOLLOWUPS }),
    specFuCase({ name: "spec followup concurrent 2", followUps: SPEC_FU_R2_FOLLOWUPS })
  ];
  const { report, requests, detail } = await runSpecFuCheck(cases, specFuR2Responses(), ["--concurrency", "2"], { delayMs: 200 });
  assert.equal(requests.length, 6, detail);
  const byGuest = new Map();
  for (const request of requests) {
    const list = byGuest.get(request.body.guestId) ?? [];
    list.push(request);
    byGuest.set(request.body.guestId, list);
  }
  assert.equal(byGuest.size, 2, "the two cases should use different guestIds");
  for (const list of byGuest.values()) {
    assert.deepEqual(list.map((request) => request.body.answer), [SPEC_FU_A0, SPEC_FU_A1, SPEC_FU_A2]);
    for (let n = 1; n < list.length; n += 1) {
      assert.ok(list[n - 1].sentAt != null);
      assert.ok(list[n].arrivedAt > list[n - 1].sentAt, `step ${n + 1} arrived before step ${n} was answered`);
    }
  }
  assert.deepEqual(report.results.map((result) => result.pass), [true, true], detail);
});

test("[spec] R16 the report keeps one result per sent answer in order", async () => {
  const passing = await runSpecFuCheck([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], specFuR2Responses());
  const steps = passing.report.results[0].steps;
  assert.ok(Array.isArray(steps), passing.detail);
  assert.equal(steps.length, 3);
  const numbers = steps.map((step) => step.step);
  assert.equal(new Set(numbers).size, 3);
  assert.ok(numbers[0] < numbers[1] && numbers[1] < numbers[2], `step numbers ${numbers}`);
  assert.deepEqual(steps.map((step) => step.answer), [SPEC_FU_A0, SPEC_FU_A1, SPEC_FU_A2]);
  assert.deepEqual(steps.map((step) => step.missionKind), ["SLOT", "SLOT", "COMPLETE"]);
  assert.deepEqual(steps.map((step) => step.targetSlot ?? null), ["REASON", "REASON", null]);
  assert.deepEqual(steps.map((step) => step.loopComplete), [false, false, true]);
  assert.equal(steps[0].previousMissionResult ?? null, null);
  assert.deepEqual(steps[1].previousMissionResult, specFuPmr("PARTIAL"));
  assert.deepEqual(steps[2].previousMissionResult, specFuPmr("RESOLVED"));
  assert.deepEqual(steps.map((step) => step.pass), [true, true, true]);
  for (const step of steps) {
    assert.deepEqual(step.failures, []);
  }

  const failing = await runSpecFuCheck(
    [specFuCase({ followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["LANGUAGE_FIX"] }] })],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("REASON")
    }
  );
  const failingSteps = failing.report.results[0].steps;
  assert.equal(failingSteps.length, 2, failing.detail);
  assert.ok(failingSteps[0].step < failingSteps[1].step);
  assert.deepEqual(failingSteps.map((step) => step.answer), [SPEC_FU_A0, SPEC_FU_A1]);
  assert.deepEqual(failingSteps.map((step) => step.missionKind), ["SLOT", "SLOT"]);
  assert.deepEqual(failingSteps.map((step) => step.targetSlot), ["REASON", "REASON"]);
  assert.deepEqual(failingSteps.map((step) => step.loopComplete), [false, false]);
  assert.equal(failingSteps[0].pass, true);
  assert.deepEqual(failingSteps[0].failures, []);
  assert.equal(failingSteps[1].pass, false);
  const reason = specFuFailureText(failingSteps[1]);
  assert.match(reason, /SLOT/);
  assert.match(reason, /LANGUAGE_FIX/);
});

test("[spec] R17 totals count cases, not steps", async () => {
  const { report, run, detail } = await runSpecFuCheck(
    [
      specFuCase({ name: "spec followup none" }),
      specFuCase({ name: "spec followup wrong rewrite", followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["LANGUAGE_FIX"] }] })
    ],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("REASON")
    }
  );
  assert.equal(report.total, 2, detail);
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 1);
  assert.deepEqual(report.failedSnapshots.map((snapshot) => snapshot.name), ["spec followup wrong rewrite"]);
  assert.match(run.stderr, /Feedback quality check failed: 1\/2 passed/);
  assert.notEqual(run.code, 0);
});

const SPEC_FU_G2_TOP = ["suite", "casesPath", "baseUrl", "startedAt", "finishedAt", "baseCaseCount", "repetitions", "total", "passed", "failed", "runtime", "latencyMs", "failureCounts", "warningCounts", "missionConfusions", "targetSlotConfusions", "repeatStability", "failedSnapshots", "results"];
const SPEC_FU_G2_RESULT = ["index", "caseIndex", "repetition", "name", "category", "promptId", "answer", "elapsedMs", "missionKind", "targetSlot", "loopComplete", "fixPointCount", "hasComparison", "hasScaffold", "pass", "failures", "warnings", "expectedMissionKinds", "forbiddenMissionKinds", "legacyExpectedFocusTypes", "expectedTargetSlots", "forbiddenTargetSlots", "expectedLoopComplete", "requiresScaffold", "expectedBehavior", "badBehavior", "actual"];
const SPEC_FU_G2_SNAPSHOT = ["index", "caseIndex", "repetition", "name", "category", "promptId", "answer", "expectedMissionKinds", "actualMissionKind", "expectedTargetSlots", "actualTargetSlot", "failures", "expectedBehavior", "badBehavior", "actual"];

test("[spec] R18 G2 a case without followUps keeps the same report keys", async () => {
  const ok = await runSpecFuCheck([specFuCase()], { [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON") });
  assert.deepEqual(Object.keys(ok.report), SPEC_FU_G2_TOP, ok.detail);
  assert.deepEqual(Object.keys(ok.report.results[0]), SPEC_FU_G2_RESULT);

  const failed = await runSpecFuCheck([specFuCase()], { [specFuKey("FIRST", SPEC_FU_A0)]: { status: 500, json: { error: "boom" } } });
  assert.deepEqual(Object.keys(failed.report), SPEC_FU_G2_TOP, failed.detail);
  assert.deepEqual(Object.keys(failed.report.results[0]), SPEC_FU_G2_RESULT);
  assert.equal(failed.report.failedSnapshots.length, 1);
  assert.deepEqual(Object.keys(failed.report.failedSnapshots[0]), SPEC_FU_G2_SNAPSHOT);
});

// ---------------------------------------------------------------- 결정 Q2, Q4, Q5

test("[spec] Q2 a followUp does not inherit the first answer's expectations", async () => {
  const { report, detail } = await runSpecFuCheck(
    [specFuCase({
      forbiddenTargetSlots: ["DETAIL"],
      forbiddenMissionKinds: ["LANGUAGE_FIX"],
      mustContainAny: { "coachMove.instruction": ["because"] },
      followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["LANGUAGE_FIX"] }]
    })],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuLanguageFix(SPEC_FU_A1, "I like hiking because it is really fun.")
    }
  );
  assert.deepEqual(specFuStepPasses(report), [true, true], detail);
  assert.equal(report.results[0].pass, true);

  const slotRewrite = await runSpecFuCheck(
    [specFuCase({
      forbiddenTargetSlots: ["DETAIL"],
      mustContainAny: { "coachMove.instruction": ["because"] },
      followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"] }]
    })],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON"),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("DETAIL", null, { instruction: "언제 하는지 한 문장 더 써 보세요." })
    }
  );
  assert.deepEqual(specFuStepPasses(slotRewrite.report), [true, true], slotRewrite.detail);
});

test("[spec] Q2 a followUp does not inherit the first answer's scoring settings", async () => {
  const noScaffold = { suggestedPhrases: [], skeletonEn: "", skeletonKo: "" };
  const { report, detail } = await runSpecFuCheck(
    [specFuCase({
      allowMissingScaffold: true,
      followUps: [{ answer: SPEC_FU_A1, expectedMissionKinds: ["SLOT"] }]
    })],
    {
      [specFuKey("FIRST", SPEC_FU_A0)]: specFuSlot("REASON", null, noScaffold),
      [specFuKey("REWRITE", SPEC_FU_A1)]: specFuSlot("REASON", null, noScaffold)
    }
  );
  assert.deepEqual(specFuStepPasses(report), [true, false], detail);
  assert.equal(report.results[0].pass, false);
});

test("[spec] Q4 --repeat multiplies the requests and opens a new session each time", async () => {
  const dry = await runSpecFuDryRun([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], ["--repeat", "2"]);
  assert.equal(dry.code, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /\b6 request\(s\)/);

  let firstCount = 0;
  const base = specFuR2Responses();
  const { report, requests, detail } = await runSpecFuCheck(
    [specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })],
    (body) => {
      const payload = base[specFuKey(body.attemptType, body.answer)];
      if (!payload) {
        return { status: 500, json: { error: "no fake payload" } };
      }
      if (body.attemptType === "FIRST") {
        firstCount += 1;
        return { status: 200, json: { ...payload, sessionId: `${SPEC_FU_SESSION}-${firstCount}` } };
      }
      return { status: 200, json: { ...payload, sessionId: body.sessionId } };
    },
    ["--repeat", "2"]
  );
  assert.equal(requests.length, 6, detail);
  assert.deepEqual(requests.map((request) => request.body.attemptType), ["FIRST", "REWRITE", "REWRITE", "FIRST", "REWRITE", "REWRITE"]);
  assert.deepEqual(requests.map((request) => request.body.sessionId ?? null), [
    null, `${SPEC_FU_SESSION}-1`, `${SPEC_FU_SESSION}-1`, null, `${SPEC_FU_SESSION}-2`, `${SPEC_FU_SESSION}-2`
  ]);
  assert.equal(report.total, 2);
  assert.equal(report.passed, 2);
});

test("[spec] Q5 a first response without sessionId fails the case and sends nothing more", async () => {
  const responses = specFuR2Responses();
  const { sessionId: _omitFirst, ...firstWithoutSession } = responses[specFuKey("FIRST", SPEC_FU_A0)];
  responses[specFuKey("FIRST", SPEC_FU_A0)] = firstWithoutSession;
  const { report, requests, run, detail } = await runSpecFuCheck([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], responses);
  assert.equal(requests.length, 1, detail);
  assert.equal(report.results[0].pass, false);
  assert.notEqual(run.code, 0);
});

test("[spec] Q5 a middle response without sessionId fails the case and stops the later steps", async () => {
  const responses = specFuR2Responses();
  const { sessionId: _omitMiddle, ...middleWithoutSession } = responses[specFuKey("REWRITE", SPEC_FU_A1)];
  responses[specFuKey("REWRITE", SPEC_FU_A1)] = middleWithoutSession;
  const { report, requests, run, detail } = await runSpecFuCheck([specFuCase({ followUps: SPEC_FU_R2_FOLLOWUPS })], responses);
  assert.equal(requests.length, 2, detail);
  assert.equal(report.results[0].pass, false);
  assert.notEqual(run.code, 0);
});

// ---------------------------------------------------------------- G3. 6건 세트의 판정 그대로

for (const [label, payload, expectedCodes, expectedPassed] of [
  ["a slot response", specFuSlot("REASON"), [
    ["missing_expected_keyword"], [], ["missing_expected_keyword"], ["missing_expected_keyword", "missing_expected_keyword"], ["missing_comparison"], []
  ], 2],
  ["a completion response", specFuComplete(), [
    ["wrong_mission_kind"], ["wrong_mission_kind"], ["wrong_mission_kind"], ["wrong_mission_kind"], ["wrong_mission_kind", "missing_comparison"], ["wrong_mission_kind"]
  ], 0]
]) {
  test(`[spec] G3 the 6-case smoke set is judged the same for ${label}`, async () => {
    const { testDir, pathMod } = await specFuPaths();
    const { sessionId: _omitSession, ...plain } = payload;
    const { report, requests, detail } = await runSpecFuCheck(pathMod.join(testDir, "cases.smoke.json"), () => ({ status: 200, json: plain }));
    assert.equal(requests.length, 6, detail);
    for (const request of requests) {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/api/feedback");
      assert.deepEqual(Object.keys(request.body).sort(), ["answer", "attemptType", "guestId", "promptId"]);
      assert.equal(request.body.attemptType, "FIRST");
    }
    assert.deepEqual(report.results.map((result) => result.failures.map((failure) => failure.code)), expectedCodes, detail);
    assert.equal(report.total, 6);
    assert.equal(report.passed, expectedPassed);
    assert.equal(report.failed, 6 - expectedPassed);
  });
}
