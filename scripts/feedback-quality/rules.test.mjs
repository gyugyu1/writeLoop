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

// git에 있는 케이스 파일만 둔다. .gitignore로 빠진 cases.generated-*.json은 로컬 전용이라 CI에 없다.
const SPEC_FU_G1 = [
  ["cases.ambiguous-bare-verb-fragments-10.json", 10, 0],
  ["cases.completion-gate-150-v2.json", 150, 0],
  ["cases.completion-gate-150-v3.json", 150, 0],
  ["cases.completion-gate-150.json", 150, 0],
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

// [spec] 056: 피드백 내용 품질 채점 도구. 시나리오 A·B·C·D·X(private 작업 056의 02-qa-scenarios.md)와
// 결정 04(추천 표현의 응답 이름), 05 Q1~Q15(05-main-decision.md). OpenAI를 부르지 않는다.
// 가짜 /api/feedback 서버로 run-feedback-quality-check.mjs를 돌린 리포트를 export-content-review.mjs로 내보내고,
// 그 review-items.json의 id로 만든 가짜 scores.json을 summarize-content-scores.mjs로 모은다.
const SPEC_CQ_PROMPTS = {
  "prompt-a-1": {
    en: "What do you usually do after dinner, and why do you do it?",
    ko: "저녁 식사 후에 보통 무엇을 하며, 왜 그 일을 하나요?",
    difficulty: "I"
  },
  "prompt-b-1": {
    en: "What is one challenge you often face at work or school, and how do you deal with it?",
    ko: "직장이나 학교에서 자주 겪는 어려움 한 가지와 그에 어떻게 대응하는지 말해 주세요.",
    difficulty: "B"
  }
};
const SPEC_CQ_A_SL = "After dinner I watch TV.";
const SPEC_CQ_A_LF = "After dinner I usually take walk because it help me relax.";
const SPEC_CQ_A_CM = "After dinner, I usually read a novel because it calms my mind before bed.";
const SPEC_CQ_A_CM2 = "One challenge I often face at work is too many meetings. I deal with it by blocking focus time on my calendar, so I can finish my tasks.";
const SPEC_CQ_A_SL2 = "I have a problem at work. It is hard.";
const SPEC_CQ_A_FAIL = "I go to bed early after dinner.";
const SPEC_CQ_A_MIN = "I relax after dinner.";
const SPEC_CQ_EB = {
  R1: "이유가 빠졌으니 이유를 더하게 해야 한다. 표현 다듬기만 하면 안 된다.",
  R2: "take walk와 it help 두 곳만 고치고 나머지는 그대로 둬야 한다.",
  R3: "완성 답이다. 자연스러운 표현을 문법 오류로 고치지 않아야 한다.",
  R4: "어떤 어려움인지와 대응 방법을 구체적으로 쓰게 해야 한다.",
  R5: "요청 실패용"
};
const SPEC_CQ_NAMES = {
  R1: "spec content slot I",
  R2: "spec content language fix I",
  R3: "spec content complete B",
  R4: "spec content slot B graded fail",
  R5: "spec content request failed"
};
const SPEC_CQ_ANSWERS = { R1: SPEC_CQ_A_SL, R2: SPEC_CQ_A_LF, R3: SPEC_CQ_A_CM2, R4: SPEC_CQ_A_SL2, R5: SPEC_CQ_A_FAIL };

function specCqPSL() {
  return {
    loopComplete: false, completionMessage: null,
    summary: "저녁 뒤에 하는 일은 썼지만 이유가 없어요.",
    strengths: ["저녁 뒤에 하는 일을 분명히 말했어요."],
    revisedAnswer: null,
    refinementExpressions: [{ expression: "unwind", meaningKo: "긴장을 풀다", usageTipKo: "쉬는 이유를 말할 때 써요.", exampleEn: "I watch TV to unwind.", source: "MODEL_ANSWER" }],
    modelAnswer: "After dinner, I watch TV because it helps me unwind.",
    modelAnswerKo: "저녁을 먹은 뒤에는 긴장을 풀 수 있어서 TV를 봐요.",
    rewriteChallenge: null, ui: {},
    coachMove: {
      focus: "이유 더하기", focusType: "SLOT", targetSlot: "REASON",
      why: "왜 TV를 보는지가 빠졌어요.", before: null, after: null,
      instruction: "because로 TV를 보는 이유를 한 문장 더해 보세요.",
      skeletonEn: "I watch TV after dinner because ____.", skeletonKo: "저녁을 먹고 ____ 때문에 TV를 봐요.",
      suggestedPhrases: [{ phrase: "it helps me relax", meaningKo: "긴장을 풀어 줘서" }, { phrase: "I like comedy shows", meaningKo: "예능을 좋아해서" }],
      languageCorrections: []
    },
    rewriteWorkspace: { seedText: "After dinner I watch TV.", starterText: "After dinner I watch TV because", enabled: true },
    completion: null, revealLater: null
  };
}

function specCqPLF() {
  return {
    promptId: "prompt-a-1", sessionId: "spec-s-1", attemptNo: 1,
    loopComplete: false, completionMessage: null,
    summary: "저녁 뒤 활동은 썼지만 문장에 고칠 곳이 있어요.",
    strengths: ["저녁 뒤에 하는 일과 이유를 함께 말했어요."],
    inlineFeedback: [],
    revisedAnswer: "After dinner, I usually take a walk because it helps me relax.",
    refinementExpressions: [], modelAnswer: null, modelAnswerKo: null, rewriteChallenge: null,
    ui: { loopStatus: { badge: "다시 써보기 추천", headline: "두 곳만 고쳐 보세요." } },
    loop: null,
    coachMove: {
      focus: "동사 형태 고치기", focusType: "LANGUAGE_FIX", targetSlot: null, why: "",
      before: "After dinner I usually take walk because it help me relax.",
      after: "After dinner, I usually take a walk because it helps me relax.",
      instruction: "표시된 두 곳을 고쳐 다시 써 보세요.",
      skeletonEn: null, skeletonKo: null, suggestedPhrases: [],
      languageCorrections: [
        { kind: "GRAMMAR_LOCAL", label: "관사", before: "take walk", after: "take a walk", reason: "walk 앞에 a가 필요해요." },
        { kind: "GRAMMAR_BLOCKING", label: "주어와 동사", before: "it help", after: "it helps", reason: "it 뒤에는 helps를 써요." }
      ]
    },
    rewriteWorkspace: { seedText: "After dinner I usually take walk because it help me relax.", starterText: null, enabled: true },
    completion: null, revealLater: null, visibleFeedback: null
  };
}

function specCqPCM() {
  return {
    promptId: "prompt-a-1", sessionId: "spec-s-2", attemptNo: 1,
    loopComplete: true, completionMessage: "질문에 끝까지 답했어요.",
    summary: "활동과 이유가 모두 분명해요.",
    strengths: ["calms my mind로 이유를 구체적으로 썼어요."],
    revisedAnswer: null,
    refinementExpressions: [{ expression: "wind down", meaningKo: "긴장을 풀다", usageTipKo: "하루를 마무리할 때 써요.", exampleEn: "I read to wind down.", source: "MODEL_ANSWER" }],
    modelAnswer: "After dinner, I usually read a novel to wind down before bed.",
    modelAnswerKo: "저녁을 먹은 뒤에는 보통 잠들기 전에 긴장을 풀려고 소설을 읽어요.",
    rewriteChallenge: null, ui: {}, coachMove: null, rewriteWorkspace: null,
    completion: {
      headline: "질문에 끝까지 답했어요",
      enrichment: {
        focus: "언제 읽는지 더하기", focusType: "SLOT", targetSlot: "SPECIFIC_TIME",
        why: "읽는 시간을 쓰면 장면이 그려져요.", instruction: "몇 시쯤 읽는지 덧붙여 보세요.",
        skeletonEn: "I usually read a novel around ____.", skeletonKo: "나는 보통 ____쯤 소설을 읽어요.",
        suggestedPhrases: [{ phrase: "around 10 p.m.", meaningKo: "밤 10시쯤" }, { phrase: "right before bed", meaningKo: "자기 바로 전에" }]
      }
    },
    revealLater: null
  };
}

function specCqPMIN() {
  return { loopComplete: true, ui: {} };
}

function specCqPCM2() {
  return {
    loopComplete: true, completionMessage: "질문에 끝까지 답했어요.",
    summary: "어려움과 대응 방법이 모두 분명해요.",
    strengths: ["blocking focus time으로 대응 방법을 구체적으로 썼어요."],
    revisedAnswer: null,
    refinementExpressions: [
      { expression: "carve out time", meaningKo: "시간을 따로 떼어 두다", usageTipKo: "일정을 일부러 비워 둘 때 써요.", exampleEn: "I carve out time for deep work.", source: "MODEL_ANSWER" },
      { expression: "stay on track", meaningKo: "계획대로 해 나가다", usageTipKo: "일이 밀리지 않게 할 때 써요.", exampleEn: "It helps me stay on track.", source: "MODEL_ANSWER" }
    ],
    modelAnswer: "One challenge I often face at work is having too many meetings. I deal with it by carving out focus time on my calendar so I can stay on track.",
    modelAnswerKo: "직장에서 자주 겪는 어려움은 회의가 너무 많다는 거예요. 저는 달력에 집중 시간을 따로 떼어 두는 방법으로 대응해서 일을 계획대로 해 나가요.",
    ui: {}, coachMove: null, rewriteWorkspace: null,
    completion: {
      headline: "질문에 끝까지 답했어요",
      enrichment: {
        focus: "결과 더하기", focusType: "SLOT", targetSlot: "RESULT",
        why: "그렇게 했을 때 무엇이 나아졌는지 쓰면 답이 더 설득력 있어요.",
        instruction: "집중 시간을 만든 뒤 달라진 점을 한 문장 더해 보세요.",
        skeletonEn: "As a result, ____.", skeletonKo: "그 결과 ____.",
        suggestedPhrases: [{ phrase: "I finish my work on time", meaningKo: "제시간에 일을 끝내요" }, { phrase: "I feel less stressed", meaningKo: "스트레스를 덜 받아요" }]
      }
    },
    revealLater: null
  };
}

function specCqPSL2() {
  return {
    loopComplete: false, completionMessage: null,
    summary: "어려움이 무엇인지 아직 막연해요.",
    strengths: ["직장에서 겪는 어려움이 있다는 것부터 말했어요."],
    revisedAnswer: null, refinementExpressions: [], modelAnswer: null, modelAnswerKo: null, ui: {},
    coachMove: {
      focus: "어려움 구체적으로 쓰기", focusType: "SLOT", targetSlot: "PROBLEM",
      why: "어떤 어려움인지 알 수 없어요.",
      instruction: "어떤 일이 어려운지 한 가지를 콕 집어 써 보세요.",
      skeletonEn: "One challenge I often face at work is ____.", skeletonKo: "직장에서 자주 겪는 어려움 하나는 ____예요.",
      suggestedPhrases: [{ phrase: "too many meetings", meaningKo: "너무 많은 회의" }, { phrase: "tight deadlines", meaningKo: "빠듯한 마감" }]
    },
    rewriteWorkspace: { seedText: "I have a problem at work. It is hard.", enabled: true },
    completion: null, revealLater: null
  };
}

// 부록 A: 기준 커밋 ee524ad의 스냅숏(strengths 없음).
const SPEC_CQ_APPENDIX_KEYS = ["loopComplete", "completionMessage", "summary", "revisedAnswer", "modelAnswer", "modelAnswerKo", "rewriteChallenge", "coachMove", "rewriteWorkspace", "completion", "revealLater", "ui", "refinementExpressions"];
const SPEC_CQ_APPENDIX = {
  [SPEC_CQ_A_LF]: {"loopComplete":false,"completionMessage":null,"summary":"저녁 뒤 활동은 썼지만 문장에 고칠 곳이 있어요.","revisedAnswer":"After dinner, I usually take a walk because it helps me relax.","modelAnswer":null,"modelAnswerKo":null,"rewriteChallenge":null,"coachMove":{"focus":"동사 형태 고치기","focusType":"LANGUAGE_FIX","before":"After dinner I usually take walk because it help me relax.","after":"After dinner, I usually take a walk because it helps me relax.","instruction":"표시된 두 곳을 고쳐 다시 써 보세요.","languageCorrections":[{"kind":"GRAMMAR_LOCAL","label":"관사","before":"take walk","after":"take a walk","reason":"walk 앞에 a가 필요해요."},{"kind":"GRAMMAR_BLOCKING","label":"주어와 동사","before":"it help","after":"it helps","reason":"it 뒤에는 helps를 써요."}]},"rewriteWorkspace":{"seedText":"After dinner I usually take walk because it help me relax.","enabled":true},"completion":{},"revealLater":{},"ui":{"loopStatus":{"badge":"다시 써보기 추천","headline":"두 곳만 고쳐 보세요."}},"refinementExpressions":[]},
  [SPEC_CQ_A_CM]: {"loopComplete":true,"completionMessage":"질문에 끝까지 답했어요.","summary":"활동과 이유가 모두 분명해요.","revisedAnswer":null,"modelAnswer":"After dinner, I usually read a novel to wind down before bed.","modelAnswerKo":"저녁을 먹은 뒤에는 보통 잠들기 전에 긴장을 풀려고 소설을 읽어요.","rewriteChallenge":null,"coachMove":{},"rewriteWorkspace":{},"completion":{"headline":"질문에 끝까지 답했어요","enrichment":{"focus":"언제 읽는지 더하기","focusType":"SLOT","targetSlot":"SPECIFIC_TIME","why":"읽는 시간을 쓰면 장면이 그려져요.","instruction":"몇 시쯤 읽는지 덧붙여 보세요.","skeletonEn":"I usually read a novel around ____.","skeletonKo":"나는 보통 ____쯤 소설을 읽어요.","suggestedPhrases":[{"phrase":"around 10 p.m.","meaningKo":"밤 10시쯤"},{"phrase":"right before bed","meaningKo":"자기 바로 전에"}]}},"revealLater":{},"ui":{},"refinementExpressions":[{"expression":"wind down","meaningKo":"긴장을 풀다","usageTipKo":"하루를 마무리할 때 써요.","exampleEn":"I read to wind down.","source":"MODEL_ANSWER"}]},
  [SPEC_CQ_A_SL]: {"loopComplete":false,"completionMessage":null,"summary":"저녁 뒤에 하는 일은 썼지만 이유가 없어요.","revisedAnswer":null,"modelAnswer":"After dinner, I watch TV because it helps me unwind.","modelAnswerKo":"저녁을 먹은 뒤에는 긴장을 풀 수 있어서 TV를 봐요.","rewriteChallenge":null,"coachMove":{"focus":"이유 더하기","focusType":"SLOT","targetSlot":"REASON","why":"왜 TV를 보는지가 빠졌어요.","instruction":"because로 TV를 보는 이유를 한 문장 더해 보세요.","skeletonEn":"I watch TV after dinner because ____.","skeletonKo":"저녁을 먹고 ____ 때문에 TV를 봐요.","suggestedPhrases":[{"phrase":"it helps me relax","meaningKo":"긴장을 풀어 줘서"},{"phrase":"I like comedy shows","meaningKo":"예능을 좋아해서"}]},"rewriteWorkspace":{"seedText":"After dinner I watch TV.","starterText":"After dinner I watch TV because","enabled":true},"completion":{},"revealLater":{},"ui":{},"refinementExpressions":[{"expression":"unwind","meaningKo":"긴장을 풀다","usageTipKo":"쉬는 이유를 말할 때 써요.","exampleEn":"I watch TV to unwind.","source":"MODEL_ANSWER"}]},
  [SPEC_CQ_A_MIN]: {"loopComplete":true,"completionMessage":null,"summary":null,"revisedAnswer":null,"modelAnswer":null,"modelAnswerKo":null,"rewriteChallenge":null,"coachMove":{},"rewriteWorkspace":{},"completion":{},"revealLater":{},"ui":{},"refinementExpressions":[]}
};

function specCqCase(name, promptId, answer, expectedMissionKinds, expectedBehavior, extra = {}) {
  const prompt = SPEC_CQ_PROMPTS[promptId];
  return {
    name,
    promptId,
    answer,
    expectedMissionKinds,
    expectedBehavior,
    promptQuestionEn: prompt.en,
    promptQuestionKo: prompt.ko,
    difficulty: prompt.difficulty,
    ...extra
  };
}

// 0.3 가짜 리포트 R-A의 케이스 5건(R1~R5).
function specCqRaCases() {
  return [
    specCqCase(SPEC_CQ_NAMES.R1, "prompt-a-1", SPEC_CQ_A_SL, ["SLOT"], SPEC_CQ_EB.R1),
    specCqCase(SPEC_CQ_NAMES.R2, "prompt-a-1", SPEC_CQ_A_LF, ["LANGUAGE_FIX"], SPEC_CQ_EB.R2),
    specCqCase(SPEC_CQ_NAMES.R3, "prompt-b-1", SPEC_CQ_A_CM2, ["COMPLETE"], SPEC_CQ_EB.R3),
    specCqCase(SPEC_CQ_NAMES.R4, "prompt-b-1", SPEC_CQ_A_SL2, ["LANGUAGE_FIX"], SPEC_CQ_EB.R4),
    specCqCase(SPEC_CQ_NAMES.R5, "prompt-a-1", SPEC_CQ_A_FAIL, ["SLOT"], SPEC_CQ_EB.R5)
  ];
}

const SPEC_CQ_FAIL_500 = { status: 500, json: { error: "boom" } };

function specCqOk(payload) {
  return { status: 200, json: payload };
}

// 답으로 응답을 고른다. 없으면 HTTP 500.
function specCqByAnswer(table) {
  return (body) => table[body.answer] ?? { status: 500, json: { error: `no fake payload for ${body.answer}` } };
}

function specCqRaResponder() {
  return specCqByAnswer({
    [SPEC_CQ_A_SL]: specCqOk(specCqPSL()),
    [SPEC_CQ_A_LF]: specCqOk(specCqPLF()),
    [SPEC_CQ_A_CM2]: specCqOk(specCqPCM2()),
    [SPEC_CQ_A_SL2]: specCqOk(specCqPSL2()),
    [SPEC_CQ_A_FAIL]: SPEC_CQ_FAIL_500
  });
}

async function specCqPaths() {
  const pathMod = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const testDir = pathMod.dirname(fileURLToPath(import.meta.url));
  const repoRoot = pathMod.resolve(testDir, "..", "..");
  return {
    pathMod,
    testDir,
    repoRoot,
    checkScript: pathMod.join(repoRoot, "scripts", "run-feedback-quality-check.mjs"),
    exportScript: pathMod.join(testDir, "export-content-review.mjs"),
    summarizeScript: pathMod.join(testDir, "summarize-content-scores.mjs")
  };
}

function specCqEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("WRITELOOP_FEEDBACK_")) {
      delete env[key];
    }
  }
  return env;
}

async function specCqExec(args) {
  const { execFile } = await import("node:child_process");
  const { repoRoot } = await specCqPaths();
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: repoRoot, env: specCqEnv(), timeout: 120000, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({
        code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        stdout,
        stderr,
        detail: `exit ${error ? error.code : 0}\nstdout:\n${stdout}\nstderr:\n${stderr}`
      }));
  });
}

// 가짜 서버로 run-feedback-quality-check.mjs를 돌리고 latest.json의 원문과 내용을 돌려준다.
async function specCqRunCheck(cases, respond, { passPayloads = true, extraArgs = [] } = {}) {
  const http = await import("node:http");
  const os = await import("node:os");
  const fsp = await import("node:fs/promises");
  const { pathMod, checkScript } = await specCqPaths();
  const tempDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "wl-spec-content-check-"));
  const requests = [];
  const server = http.createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => {
      if (request.method !== "POST" || request.url !== "/api/feedback") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end("{}");
        return;
      }
      const body = JSON.parse(raw);
      requests.push(body);
      const planned = respond(body);
      response.writeHead(planned.status ?? 200, { "content-type": "application/json" });
      response.end(JSON.stringify(planned.json));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const casesPath = pathMod.join(tempDir, "cases.spec-content.json");
    const reportDir = pathMod.join(tempDir, "report");
    await fsp.writeFile(casesPath, JSON.stringify(cases), "utf8");
    const run = await specCqExec([
      checkScript,
      "--cases", casesPath,
      "--base-url", `http://127.0.0.1:${port}`,
      "--report-dir", reportDir,
      "--skip-prompt-preflight",
      "--timeout-ms", "10000",
      ...(passPayloads ? ["--include-pass-payloads"] : []),
      ...extraArgs
    ]);
    let reportText = null;
    try {
      reportText = await fsp.readFile(pathMod.join(reportDir, "latest.json"), "utf8");
    } catch {
      reportText = null;
    }
    return { report: reportText ? JSON.parse(reportText) : null, reportText, run, requests, detail: run.detail };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

// export-content-review.mjs를 돌린다. cases가 null이면 --cases 없이.
async function specCqExport({ reportText, cases = null }) {
  const os = await import("node:os");
  const fsp = await import("node:fs/promises");
  const { pathMod, exportScript } = await specCqPaths();
  const tempDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "wl-spec-content-export-"));
  try {
    const reportPath = pathMod.join(tempDir, "latest.json");
    const casesPath = pathMod.join(tempDir, "cases.spec-content.json");
    const outDir = pathMod.join(tempDir, "review");
    await fsp.writeFile(reportPath, reportText, "utf8");
    if (cases) {
      await fsp.writeFile(casesPath, JSON.stringify(cases), "utf8");
    }
    const run = await specCqExec([
      exportScript,
      "--report", reportPath,
      ...(cases ? ["--cases", casesPath] : []),
      "--out", outDir
    ]);
    const read = async (name) => {
      try {
        return await fsp.readFile(pathMod.join(outDir, name), "utf8");
      } catch {
        return null;
      }
    };
    const jsonText = await read("review-items.json");
    const md = await read("review-items.md");
    return { ...run, jsonText, json: jsonText ? JSON.parse(jsonText) : null, md };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

// summarize-content-scores.mjs를 돌린다. scores·compare는 값(파일에 JSON으로 씀), itemsText는 review-items.json 원문.
async function specCqSummarize({ scores, itemsText = null, compare = undefined }) {
  const os = await import("node:os");
  const fsp = await import("node:fs/promises");
  const { pathMod, summarizeScript } = await specCqPaths();
  const tempDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "wl-spec-content-sum-"));
  try {
    const scoresPath = pathMod.join(tempDir, "scores.json");
    const itemsPath = pathMod.join(tempDir, "review-items.json");
    const comparePath = pathMod.join(tempDir, "scores.before.json");
    await fsp.writeFile(scoresPath, JSON.stringify(scores, null, 2), "utf8");
    if (itemsText != null) {
      await fsp.writeFile(itemsPath, itemsText, "utf8");
    }
    if (compare !== undefined) {
      await fsp.writeFile(comparePath, JSON.stringify(compare, null, 2), "utf8");
    }
    return await specCqExec([
      summarizeScript,
      "--scores", scoresPath,
      ...(itemsText != null ? ["--items", itemsPath] : []),
      ...(compare !== undefined ? ["--compare", comparePath] : [])
    ]);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

// R-A를 한 번 만들어 B·C 시나리오가 같이 쓴다(시나리오 C: review-items.json은 B의 출력).
let specCqPipelinePromise = null;
function specCqPipeline() {
  specCqPipelinePromise ??= (async () => {
    const cases = specCqRaCases();
    const check = await specCqRunCheck(cases, specCqRaResponder());
    assert.ok(check.reportText, `R-A report was not written\n${check.detail}`);
    const exported = await specCqExport({ reportText: check.reportText, cases });
    assert.equal(exported.code, 0, exported.detail);
    assert.ok(exported.json, `review-items.json was not written\n${exported.detail}`);
    return { cases, check, exported, ids: specCqIds(exported.json) };
  })();
  return specCqPipelinePromise;
}

function specCqItems(json) {
  return Array.isArray(json) ? json : json?.items ?? [];
}

function specCqItemByAnswer(json, answer) {
  return specCqItems(json).find((item) => item.answer === answer);
}

// 학생 답으로 R1~R4 항목의 id를 찾는다(시나리오 B).
function specCqIds(json) {
  const ids = {};
  for (const r of ["R1", "R2", "R3", "R4"]) {
    const item = specCqItemByAnswer(json, SPEC_CQ_ANSWERS[r]);
    if (item) {
      ids[r] = item.id;
    }
  }
  return ids;
}

function specCqBlank(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0)
    || (typeof value === "object" && !Array.isArray(value) && Object.values(value).every(specCqBlank));
}

function specCqEmptyCompletion(completion) {
  return completion == null || (
    completion.modelAnswer == null
    && completion.modelAnswerKo == null
    && (completion.refinementExpressions ?? []).length === 0
    && specCqBlank(completion.enrichment)
  );
}

function specCqAssertQuestion(item, promptId) {
  const prompt = SPEC_CQ_PROMPTS[promptId];
  assert.equal(item.question?.en, prompt.en);
  assert.equal(item.question?.ko, prompt.ko);
  assert.equal(item.question?.difficulty, prompt.difficulty);
}

function specCqPhrasePairs(phrases) {
  return (phrases ?? []).map((phrase) => [phrase.phrase, phrase.meaningKo]);
}

// B10: SLOT 미완료 R1
function specCqAssertR1Item(item) {
  assert.ok(item, "R1 item is missing");
  specCqAssertQuestion(item, "prompt-a-1");
  assert.equal(item.answer, SPEC_CQ_A_SL);
  assert.equal(item.expectedBehavior, SPEC_CQ_EB.R1);
  const feedback = item.feedback;
  assert.deepEqual(feedback.strengths, ["저녁 뒤에 하는 일을 분명히 말했어요."]);
  assert.equal(feedback.mission?.title, "이유 더하기");
  assert.equal(feedback.mission?.why, "왜 TV를 보는지가 빠졌어요.");
  assert.equal(feedback.mission?.instruction, "because로 TV를 보는 이유를 한 문장 더해 보세요.");
  assert.equal(feedback.mission?.skeletonEn, "I watch TV after dinner because ____.");
  assert.equal(feedback.mission?.skeletonKo, "저녁을 먹고 ____ 때문에 TV를 봐요.");
  assert.deepEqual(specCqPhrasePairs(feedback.mission?.suggestedPhrases), [
    ["it helps me relax", "긴장을 풀어 줘서"],
    ["I like comedy shows", "예능을 좋아해서"]
  ]);
  assert.equal((feedback.languageCorrections ?? []).length, 0);
  assert.ok(feedback.revisedAnswer == null || feedback.revisedAnswer === "", `revisedAnswer should be empty: ${feedback.revisedAnswer}`);
  assert.equal(feedback.loopComplete, false);
}

// B11: LANGUAGE_FIX R2
function specCqAssertR2Item(item) {
  assert.ok(item, "R2 item is missing");
  specCqAssertQuestion(item, "prompt-a-1");
  assert.equal(item.answer, SPEC_CQ_A_LF);
  assert.equal(item.expectedBehavior, SPEC_CQ_EB.R2);
  const feedback = item.feedback;
  assert.deepEqual(feedback.strengths, ["저녁 뒤에 하는 일과 이유를 함께 말했어요."]);
  assert.equal(feedback.mission?.title, "동사 형태 고치기");
  assert.equal(feedback.mission?.instruction, "표시된 두 곳을 고쳐 다시 써 보세요.");
  assert.ok(feedback.mission?.why == null || feedback.mission.why === "", `why should be empty: ${feedback.mission?.why}`);
  assert.deepEqual((feedback.languageCorrections ?? []).map((row) => [row.kind, row.before, row.after, row.reason]), [
    ["GRAMMAR_LOCAL", "take walk", "take a walk", "walk 앞에 a가 필요해요."],
    ["GRAMMAR_BLOCKING", "it help", "it helps", "it 뒤에는 helps를 써요."]
  ]);
  assert.equal(feedback.revisedAnswer, "After dinner, I usually take a walk because it helps me relax.");
  assert.equal(feedback.loopComplete, false);
}

// B12: 완료 R3
function specCqAssertR3Item(item) {
  assert.ok(item, "R3 item is missing");
  specCqAssertQuestion(item, "prompt-b-1");
  assert.equal(item.answer, SPEC_CQ_A_CM2);
  assert.equal(item.expectedBehavior, SPEC_CQ_EB.R3);
  const feedback = item.feedback;
  const expected = specCqPCM2();
  assert.deepEqual(feedback.strengths, ["blocking focus time으로 대응 방법을 구체적으로 썼어요."]);
  assert.equal(feedback.loopComplete, true);
  assert.equal(feedback.completion?.modelAnswer, expected.modelAnswer);
  assert.equal(feedback.completion?.modelAnswerKo, expected.modelAnswerKo);
  assert.deepEqual((feedback.completion?.refinementExpressions ?? []).map((row) => [row.expression, row.meaningKo]), [
    ["carve out time", "시간을 따로 떼어 두다"],
    ["stay on track", "계획대로 해 나가다"]
  ]);
  const enrichment = feedback.completion?.enrichment;
  assert.equal(enrichment?.focus, "결과 더하기");
  assert.equal(enrichment?.why, "그렇게 했을 때 무엇이 나아졌는지 쓰면 답이 더 설득력 있어요.");
  assert.equal(enrichment?.instruction, "집중 시간을 만든 뒤 달라진 점을 한 문장 더해 보세요.");
  assert.equal(enrichment?.skeletonEn, "As a result, ____.");
  assert.equal(enrichment?.skeletonKo, "그 결과 ____.");
  assert.deepEqual(specCqPhrasePairs(enrichment?.suggestedPhrases), [
    ["I finish my work on time", "제시간에 일을 끝내요"],
    ["I feel less stressed", "스트레스를 덜 받아요"]
  ]);
  assert.ok(specCqBlank(feedback.mission), `mission should be empty: ${JSON.stringify(feedback.mission)}`);
  assert.equal((feedback.languageCorrections ?? []).length, 0);
}

// B13: SLOT 미완료 R4
function specCqAssertR4Item(item) {
  assert.ok(item, "R4 item is missing");
  specCqAssertQuestion(item, "prompt-b-1");
  assert.equal(item.answer, SPEC_CQ_A_SL2);
  assert.equal(item.expectedBehavior, SPEC_CQ_EB.R4);
  const feedback = item.feedback;
  assert.deepEqual(feedback.strengths, ["직장에서 겪는 어려움이 있다는 것부터 말했어요."]);
  assert.equal(feedback.mission?.title, "어려움 구체적으로 쓰기");
  assert.equal(feedback.mission?.why, "어떤 어려움인지 알 수 없어요.");
  assert.equal(feedback.mission?.instruction, "어떤 일이 어려운지 한 가지를 콕 집어 써 보세요.");
  assert.equal(feedback.mission?.skeletonEn, "One challenge I often face at work is ____.");
  assert.equal(feedback.mission?.skeletonKo, "직장에서 자주 겪는 어려움 하나는 ____예요.");
  assert.deepEqual(specCqPhrasePairs(feedback.mission?.suggestedPhrases), [
    ["too many meetings", "너무 많은 회의"],
    ["tight deadlines", "빠듯한 마감"]
  ]);
  assert.equal(feedback.loopComplete, false);
}

function specCqSkippedNames(json) {
  return (json?.skipped ?? []).map((entry) => entry.name);
}

// ---------------------------------------------------------------- C. 점수 모으기의 준비와 읽기

const SPEC_CQ_KEYS = ["correctionAccuracy", "correctionExplanation", "missionFit", "supportMaterials", "strength", "completionMaterials"];
const SPEC_CQ_MARKS = ["①", "②", "③", "④", "⑤", "⑥"];
const SPEC_CQ_S1 = {
  R1: [null, null, 4, 3, 5, null],
  R2: [2, 3, 5, 4, 4, null],
  R3: [null, null, null, null, 3, 4],
  R4: [null, null, 3, 2, 4, null]
};
const SPEC_CQ_S0 = {
  R1: [null, null, 2, 3, 4, null],
  R2: [4, 3, 5, 4, 4, null],
  R3: [null, null, null, null, 3, 1],
  R4: [null, null, 5, 5, 4, null]
};

function specCqScores(table, ids) {
  return Object.entries(table).map(([r, values]) => ({
    id: ids[r],
    scores: Object.fromEntries(SPEC_CQ_KEYS.map((key, index) => [key, values[index]])),
    notes: Object.fromEntries(SPEC_CQ_KEYS.map((key, index) => [key, values[index] == null ? "해당 없음" : `${r} ${key} 근거`]))
  }));
}

function specCqWithScore(scores, index, key, value) {
  const copy = JSON.parse(JSON.stringify(scores));
  copy[index].scores[key] = value;
  return copy;
}

// 표준 출력을 빈 줄로 나눈 묶음(첫 줄이 제목).
function specCqBlocks(stdout) {
  return stdout.split(/\r?\n[ \t]*\r?\n/).map((block) => block.split(/\r?\n/).filter((line) => line.trim() !== "")).filter((lines) => lines.length > 0);
}

function specCqBlock(stdout, keyword) {
  const block = specCqBlocks(stdout).find((lines) => lines[0].includes(keyword));
  assert.ok(block, `no "${keyword}" section in:\n${stdout}`);
  return block;
}

function specCqKeyOf(line) {
  const index = SPEC_CQ_KEYS.findIndex((key, keyIndex) => line.includes(SPEC_CQ_MARKS[keyIndex]) || line.includes(key));
  return index >= 0 ? SPEC_CQ_KEYS[index] : null;
}

function specCqKeyLine(lines, key) {
  return lines.find((line) => !/^\s/.test(line) && specCqKeyOf(line) === key);
}

function specCqIsNumber(token) {
  return /^[+-]?\d+(\.\d+)?$/.test(token);
}

// 평균 칸: 값이 있으면 소수 둘째 자리(Q6), 채점 수 0이면 0·NaN이 아닌 "없음".
function specCqAssertMean(token, expected, context) {
  if (expected === null) {
    assert.ok(token != null && !specCqIsNumber(token) && !/nan/i.test(token), `expected no mean, got ${token}: ${context}`);
  } else {
    assert.equal(token, expected.toFixed(2), context);
  }
}

function specCqOverallLine(stdout, key) {
  const block = specCqBlock(stdout, "항목별 평균");
  const line = specCqKeyLine(block.slice(1), key);
  assert.ok(line, `no ${key} line in:\n${block.join("\n")}`);
  return line;
}

function specCqMeanToken(line) {
  return line.slice(line.indexOf(":") + 1).trim().split(/\s+/)[0];
}

function specCqCount(line) {
  const match = line.match(/(\d+)\s*건/);
  return match ? Number(match[1]) : null;
}

function specCqDistribution(line) {
  const tail = line.includes("분포") ? line.slice(line.indexOf("분포")) : line.slice(line.indexOf("건") + 1);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const match of tail.matchAll(/([1-5])\s*[:=]\s*(\d+)/g)) {
    distribution[match[1]] = Number(match[2]);
  }
  return distribution;
}

// C2: [채점 수, 평균, 분포]
const SPEC_CQ_C2 = {
  correctionAccuracy: [1, 2, { 2: 1 }],
  correctionExplanation: [1, 3, { 3: 1 }],
  missionFit: [3, 4, { 3: 1, 4: 1, 5: 1 }],
  supportMaterials: [3, 3, { 2: 1, 3: 1, 4: 1 }],
  strength: [4, 4, { 3: 1, 4: 2, 5: 1 }],
  completionMaterials: [1, 4, { 4: 1 }]
};

function specCqAssertOverall(stdout, expected) {
  for (const [key, [count, mean, distribution]] of Object.entries(expected)) {
    const line = specCqOverallLine(stdout, key);
    assert.equal(specCqCount(line), count, `${key} count: ${line}`);
    specCqAssertMean(specCqMeanToken(line), mean, `${key} mean: ${line}`);
    if (distribution) {
      assert.deepEqual(specCqDistribution(line), { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...distribution }, `${key} distribution: ${line}`);
    }
  }
}

// C3 (Q5: 그룹마다 루브릭 항목별 평균, null은 없음)
const SPEC_CQ_C3 = {
  I: [2, 3, 4.5, 3.5, 4.5, null],
  B: [null, null, 3, 2, 3.5, 4]
};
// C4 (Q4: mission.focusType, 완료는 COMPLETE)
const SPEC_CQ_C4 = {
  SLOT: [null, null, 3.5, 2.5, 4.5, null],
  LANGUAGE_FIX: [2, 3, 5, 4, 4, null],
  COMPLETE: [null, null, null, null, 3, 4]
};

function specCqAssertGroups(stdout, keyword, expected) {
  const block = specCqBlock(stdout, keyword);
  for (const [group, values] of Object.entries(expected)) {
    const line = block.slice(1).find((candidate) => candidate.startsWith(`${group} `) || candidate.startsWith(`${group}(`) || candidate.startsWith(`${group}:`));
    assert.ok(line, `no ${group} line in:\n${block.join("\n")}`);
    SPEC_CQ_KEYS.forEach((key, index) => {
      const match = line.match(new RegExp(`${SPEC_CQ_MARKS[index]}\\s*(\\S+)`)) ?? line.match(new RegExp(`${key}\\s*[:=]?\\s*(\\S+)`));
      assert.ok(match, `no ${key} value for ${group}: ${line}`);
      specCqAssertMean(match[1], values[index], `${keyword} ${group} ${key}: ${line}`);
    });
  }
}

// 낮은 점수 목록: 루브릭 항목마다 그 아래 들여 쓴 줄들.
function specCqLowLists(stdout) {
  const block = specCqBlock(stdout, "낮은");
  const lists = Object.fromEntries(SPEC_CQ_KEYS.map((key) => [key, []]));
  let current = null;
  for (const line of block.slice(1)) {
    if (!/^\s/.test(line)) {
      current = specCqKeyOf(line);
      continue;
    }
    if (current) {
      lists[current].push(line);
    }
  }
  return lists;
}

// C5 (Q7: 2점 이하를 scores.json 순서대로 모두). S1에서는 cA의 R2(2점)와 sM의 R4(2점)만 해당한다.
const SPEC_CQ_C5_Q7 = {
  correctionAccuracy: [["R2", "R2 correctionAccuracy 근거"]],
  supportMaterials: [["R4", "R4 supportMaterials 근거"]]
};

function specCqAssertLow(stdout, ids, expected) {
  const lists = specCqLowLists(stdout);
  for (const key of SPEC_CQ_KEYS) {
    const expectedRows = expected[key] ?? [];
    assert.equal(lists[key].length, expectedRows.length, `${key} low list: ${JSON.stringify(lists[key])}\n${stdout}`);
    expectedRows.forEach(([r, note], index) => {
      assert.ok(lists[key][index].includes(ids[r]), `${key} low #${index + 1} should be ${r} (${ids[r]}): ${lists[key][index]}`);
      if (note) {
        assert.ok(lists[key][index].includes(note), `${key} low #${index + 1} should carry the note "${note}": ${lists[key][index]}`);
      }
    });
  }
}

// "같은 id에서 2점 이상 달라진 것" 아래 들여 쓴 줄들.
function specCqChangedLines(stdout) {
  const lines = stdout.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes("2점 이상"));
  assert.ok(start >= 0, `no "2점 이상" list in:\n${stdout}`);
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) {
      break;
    }
    rows.push(line);
  }
  return rows;
}

function specCqChangedMatches(line, id, key, before, after) {
  const mark = SPEC_CQ_MARKS[SPEC_CQ_KEYS.indexOf(key)];
  return line.includes(id)
    && (line.includes(mark) || line.includes(key))
    && new RegExp(`(^|[^\\d.])${before}\\s*(→|->)\\s*${after}([^\\d.]|$)`).test(line);
}

function specCqAssertChanged(stdout, ids, expectedTuples) {
  const rows = specCqChangedLines(stdout);
  assert.equal(rows.length, expectedTuples.length, `changed rows:\n${rows.join("\n")}\n---\n${stdout}`);
  for (const [r, key, before, after] of expectedTuples) {
    const matched = rows.filter((row) => specCqChangedMatches(row, ids[r], key, before, after));
    assert.equal(matched.length, 1, `expected one row for (${r}, ${key}, ${before}→${after}) in:\n${rows.join("\n")}`);
  }
  return rows;
}

function specCqAssertRejected(out, needle) {
  assert.notEqual(out.code, 0, out.detail);
  if (needle) {
    assert.ok(out.stderr.includes(needle), `stderr should name ${needle}\n${out.detail}`);
  }
  assert.doesNotMatch(out.stderr, /\n\s+at .+:\d+:\d+/, `should be a reported format error, not a crash\n${out.detail}`);
}

// ---------------------------------------------------------------- A. 리포트 스냅숏의 잘한 점

test("[spec] content A1 the report snapshot keeps the response strengths", async () => {
  const { report, detail } = await specCqRunCheck(
    [
      specCqCase("spec content a1 language fix", "prompt-a-1", SPEC_CQ_A_LF, ["LANGUAGE_FIX"], SPEC_CQ_EB.R2),
      specCqCase("spec content a1 complete", "prompt-a-1", SPEC_CQ_A_CM, ["COMPLETE"], "완성 답")
    ],
    specCqByAnswer({ [SPEC_CQ_A_LF]: specCqOk(specCqPLF()), [SPEC_CQ_A_CM]: specCqOk(specCqPCM()) })
  );
  assert.ok(report, detail);
  const byAnswer = Object.fromEntries(report.results.map((result) => [result.answer, result]));
  assert.equal(byAnswer[SPEC_CQ_A_LF].pass, true, detail);
  assert.equal(byAnswer[SPEC_CQ_A_CM].pass, true, detail);
  assert.deepEqual(byAnswer[SPEC_CQ_A_LF].actual.strengths, ["저녁 뒤에 하는 일과 이유를 함께 말했어요."]);
  assert.deepEqual(byAnswer[SPEC_CQ_A_CM].actual.strengths, ["calms my mind로 이유를 구체적으로 썼어요."]);
});

test("[spec] content A2 a failed case keeps strengths in its result and failed snapshot", async () => {
  const { report, detail } = await specCqRunCheck(
    [specCqCase("spec content a2 slot as language fix", "prompt-a-1", SPEC_CQ_A_SL, ["LANGUAGE_FIX"], SPEC_CQ_EB.R1)],
    specCqByAnswer({ [SPEC_CQ_A_SL]: specCqOk(specCqPSL()) }),
    { passPayloads: false }
  );
  assert.ok(report, detail);
  assert.equal(report.results[0].pass, false, detail);
  assert.deepEqual(report.results[0].actual.strengths, ["저녁 뒤에 하는 일을 분명히 말했어요."]);
  assert.deepEqual(report.failedSnapshots[0].actual.strengths, ["저녁 뒤에 하는 일을 분명히 말했어요."]);
});

test("[spec] content A3 a passing case without --include-pass-payloads still has no snapshot", async () => {
  const { report, detail } = await specCqRunCheck(
    [specCqCase("spec content a3 language fix", "prompt-a-1", SPEC_CQ_A_LF, ["LANGUAGE_FIX"], SPEC_CQ_EB.R2)],
    specCqByAnswer({ [SPEC_CQ_A_LF]: specCqOk(specCqPLF()) }),
    { passPayloads: false }
  );
  assert.ok(report, detail);
  assert.equal(report.results[0].pass, true, detail);
  assert.equal(report.results[0].actual, null);
});

test("[spec] content A4 the other snapshot keys and the report keys stay the same", async () => {
  const { report, detail } = await specCqRunCheck(
    [
      specCqCase("spec content a4 language fix", "prompt-a-1", SPEC_CQ_A_LF, ["LANGUAGE_FIX"], SPEC_CQ_EB.R2),
      specCqCase("spec content a4 complete", "prompt-a-1", SPEC_CQ_A_CM, ["COMPLETE"], "완성 답"),
      specCqCase("spec content a4 slot", "prompt-a-1", SPEC_CQ_A_SL, ["SLOT"], SPEC_CQ_EB.R1),
      specCqCase("spec content a4 minimal", "prompt-a-1", SPEC_CQ_A_MIN, ["COMPLETE"], "최소 응답")
    ],
    specCqByAnswer({
      [SPEC_CQ_A_LF]: specCqOk(specCqPLF()),
      [SPEC_CQ_A_CM]: specCqOk(specCqPCM()),
      [SPEC_CQ_A_SL]: specCqOk(specCqPSL()),
      [SPEC_CQ_A_MIN]: specCqOk(specCqPMIN())
    })
  );
  assert.ok(report, detail);
  assert.deepEqual(Object.keys(report), SPEC_FU_G2_TOP);
  assert.deepEqual(Object.keys(report.results[0]), SPEC_FU_G2_RESULT);
  for (const result of report.results) {
    const { strengths: _strengths, ...withoutStrengths } = result.actual;
    assert.deepEqual(withoutStrengths, SPEC_CQ_APPENDIX[result.answer], result.answer);
    assert.deepEqual(Object.keys(result.actual).sort(), [...SPEC_CQ_APPENDIX_KEYS, "strengths"].sort(), result.answer);
  }
});

test("[spec] content A5 scoring does not depend on strengths", async () => {
  const slotCase = [specCqCase("spec content a5 slot", "prompt-a-1", SPEC_CQ_A_SL, ["SLOT"], SPEC_CQ_EB.R1)];
  const first = await specCqRunCheck(slotCase, specCqByAnswer({ [SPEC_CQ_A_SL]: specCqOk(specCqPSL()) }));
  const second = await specCqRunCheck(slotCase, specCqByAnswer({ [SPEC_CQ_A_SL]: specCqOk({ ...specCqPSL(), strengths: ["가", "나"] }) }));
  assert.ok(first.report, first.detail);
  assert.ok(second.report, second.detail);
  const pick = (result) => ({
    pass: result.pass,
    failures: result.failures.map((failure) => [failure.code, failure.message]),
    warnings: result.warnings,
    missionKind: result.missionKind,
    targetSlot: result.targetSlot,
    hasScaffold: result.hasScaffold,
    hasComparison: result.hasComparison,
    fixPointCount: result.fixPointCount
  });
  assert.deepEqual(pick(second.report.results[0]), pick(first.report.results[0]));
});

test("[spec] content A6 a failed request still has request_failed and no snapshot", async () => {
  const { report, detail } = await specCqRunCheck(
    [specCqCase(SPEC_CQ_NAMES.R5, "prompt-a-1", SPEC_CQ_A_FAIL, ["SLOT"], SPEC_CQ_EB.R5)],
    () => SPEC_CQ_FAIL_500
  );
  assert.ok(report, detail);
  assert.equal(report.results[0].failures[0].code, "request_failed");
  assert.equal(report.results[0].actual, null);
});

// 결정 Q11: 배열, 앞 3개까지, 공백 정리·500자(다른 칸과 같은 방식), 없으면 빈 배열, completionMessage 뒤.
test("[spec] content Q11 snapshot strengths keep the first three, normalized and limited like other fields", async () => {
  const longText = "a".repeat(5000);
  const { report, detail } = await specCqRunCheck(
    [specCqCase("spec content q11 limits", "prompt-a-1", SPEC_CQ_A_LF, ["LANGUAGE_FIX"], SPEC_CQ_EB.R2)],
    specCqByAnswer({
      [SPEC_CQ_A_LF]: specCqOk({
        ...specCqPLF(),
        completionMessage: longText,
        strengths: ["  잘   썼어요\n오늘도  ", longText, "셋째", "넷째"]
      })
    })
  );
  assert.ok(report, detail);
  const actual = report.results[0].actual;
  assert.equal(actual.strengths.length, 3);
  assert.equal(actual.strengths[0], "잘 썼어요 오늘도");
  assert.equal(actual.strengths[1], actual.completionMessage, "same 500-char limit as completionMessage");
  assert.ok(actual.strengths[1].length <= 500, `got ${actual.strengths[1].length} chars`);
  assert.equal(actual.strengths[2], "셋째");
});

test("[spec] content Q11 missing strengths become an empty array placed after completionMessage", async () => {
  const answers = ["I relax after dinner.", "I relax after dinner with tea.", "I relax after dinner with music."];
  const { strengths: _omit, ...withoutStrengths } = specCqPLF();
  const { report, detail } = await specCqRunCheck(
    answers.map((answer, index) => specCqCase(`spec content q11 missing ${index + 1}`, "prompt-a-1", answer, ["LANGUAGE_FIX", "SLOT", "COMPLETE"], "빈 잘한 점")),
    specCqByAnswer({
      [answers[0]]: specCqOk(withoutStrengths),
      [answers[1]]: specCqOk({ ...specCqPLF(), strengths: null }),
      [answers[2]]: specCqOk({ ...specCqPLF(), strengths: [] })
    })
  );
  assert.ok(report, detail);
  for (const result of report.results) {
    assert.deepEqual(result.actual.strengths, [], result.answer);
    const keys = Object.keys(result.actual);
    assert.equal(keys.indexOf("strengths"), keys.indexOf("completionMessage") + 1, keys.join(","));
  }
});

// 결정 04: 추천 표현의 설명·예문은 응답 이름(guidance·example)으로 오고, 스냅숏 키(usageTipKo·exampleEn)는 그대로.
test("[spec] content 04 refinement guidance and example from the response names reach the snapshot and the review item", async () => {
  const cases = [specCqCase("spec content 04 complete", "prompt-b-1", SPEC_CQ_A_CM2, ["COMPLETE"], SPEC_CQ_EB.R3)];
  const payload = {
    ...specCqPCM2(),
    refinementExpressions: [
      { expression: "carve out time", meaningKo: "시간을 따로 떼어 두다", guidance: "일정을 일부러 비워 둘 때 써요.", example: "I carve out time for deep work.", source: "MODEL_ANSWER" }
    ]
  };
  const { report, reportText, detail } = await specCqRunCheck(cases, specCqByAnswer({ [SPEC_CQ_A_CM2]: specCqOk(payload) }));
  assert.ok(report, detail);
  assert.deepEqual(report.results[0].actual.refinementExpressions, [
    { expression: "carve out time", meaningKo: "시간을 따로 떼어 두다", usageTipKo: "일정을 일부러 비워 둘 때 써요.", exampleEn: "I carve out time for deep work.", source: "MODEL_ANSWER" }
  ]);
  const exported = await specCqExport({ reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  const completionText = JSON.stringify(specCqItems(exported.json)[0]?.feedback?.completion ?? null);
  assert.ok(completionText.includes("일정을 일부러 비워 둘 때 써요."), completionText);
  assert.ok(completionText.includes("I carve out time for deep work."), completionText);
});

// 결정 Q12: 단계 결과에도 strengths, export는 첫 답만 항목으로.
test("[spec] content Q12 followUp steps keep strengths and export makes one item from the first answer", async () => {
  const rewrite = "After dinner I watch TV because it helps me relax.";
  const cases = [specCqCase("spec content q12 followup", "prompt-a-1", SPEC_CQ_A_SL, ["SLOT"], SPEC_CQ_EB.R1, {
    followUps: [{ answer: rewrite, expectedMissionKinds: ["COMPLETE"] }]
  })];
  const { report, reportText, detail } = await specCqRunCheck(cases, specCqByAnswer({
    [SPEC_CQ_A_SL]: specCqOk({ ...specCqPSL(), sessionId: "spec-s-q12" }),
    [rewrite]: specCqOk({ ...specCqPCM(), sessionId: "spec-s-q12", strengths: ["because로 이유를 붙였어요."] })
  }));
  assert.ok(report, detail);
  assert.equal(report.results.length, 1, detail);
  const steps = report.results[0].steps ?? [];
  assert.equal(steps.length, 2, detail);
  assert.deepEqual(steps[0].actual.strengths, ["저녁 뒤에 하는 일을 분명히 말했어요."]);
  assert.deepEqual(steps[1].actual.strengths, ["because로 이유를 붙였어요."]);

  const exported = await specCqExport({ reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  const items = specCqItems(exported.json);
  assert.equal(items.length, 1, exported.jsonText);
  assert.equal(items[0].answer, SPEC_CQ_A_SL);
  assert.deepEqual(items[0].feedback.strengths, ["저녁 뒤에 하는 일을 분명히 말했어요."]);
  assert.equal(items[0].feedback.loopComplete, false);
});

// ---------------------------------------------------------------- B. 채점 묶음 만들기

test("[spec] content B1 export writes review-items.json and review-items.md", async () => {
  const { exported } = await specCqPipeline();
  assert.equal(exported.code, 0, exported.detail);
  assert.ok(exported.json, "review-items.json should be JSON");
  assert.equal(typeof exported.md, "string");
  assert.ok(exported.md.length > 0, "review-items.md should not be empty");
});

test("[spec] content Q2 review-items.json is { source, itemCount, skipped, items }", async () => {
  const { exported } = await specCqPipeline();
  assert.deepEqual(Object.keys(exported.json), ["source", "itemCount", "skipped", "items"]);
  assert.equal(exported.json.itemCount, 4);
  assert.equal(exported.json.items.length, 4);
  for (const entry of exported.json.skipped) {
    assert.deepEqual(Object.keys(entry).sort(), ["name", "reason"]);
  }
});

test("[spec] content B2 a failed request is not a review item", async () => {
  const { exported } = await specCqPipeline();
  const items = specCqItems(exported.json);
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((item) => item.answer).sort(), [SPEC_CQ_A_SL, SPEC_CQ_A_LF, SPEC_CQ_A_CM2, SPEC_CQ_A_SL2].sort());
  assert.equal(items.some((item) => item.answer === SPEC_CQ_A_FAIL), false);
});

test("[spec] content B3 a failed request is listed apart from the items", async () => {
  const { exported } = await specCqPipeline();
  const skipped = specCqSkippedNames(exported.json);
  assert.ok(skipped.includes(SPEC_CQ_NAMES.R5), JSON.stringify(exported.json.skipped));
  for (const r of ["R1", "R2", "R3", "R4"]) {
    assert.equal(skipped.includes(SPEC_CQ_NAMES[r]), false, `${r} should not be skipped`);
  }
});

test("[spec] content B4 B13 a graded failure is still a review item", async () => {
  const { check, exported } = await specCqPipeline();
  const r4Result = check.report.results.find((result) => result.answer === SPEC_CQ_A_SL2);
  assert.equal(r4Result.pass, false);
  assert.ok(r4Result.failures.some((failure) => failure.code === "wrong_mission_kind"), JSON.stringify(r4Result.failures));
  specCqAssertR4Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_SL2));
});

test("[spec] content B5 Q15 ids are the case names, unique and the same on a second export", async () => {
  const { check, cases, exported, ids } = await specCqPipeline();
  const items = specCqItems(exported.json);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.deepEqual(ids, { R1: SPEC_CQ_NAMES.R1, R2: SPEC_CQ_NAMES.R2, R3: SPEC_CQ_NAMES.R3, R4: SPEC_CQ_NAMES.R4 });
  const again = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(again.code, 0, again.detail);
  assert.deepEqual(specCqIds(again.json), ids);
});

test("[spec] content B6 another run of the same cases gives the same ids", async () => {
  const { ids } = await specCqPipeline();
  const cases = specCqRaCases();
  const other = (payload) => specCqOk({ ...payload, strengths: ["다른 실행"], summary: "다른 실행의 요약" });
  const check = await specCqRunCheck(cases, specCqByAnswer({
    [SPEC_CQ_A_SL]: other(specCqPSL()),
    [SPEC_CQ_A_LF]: SPEC_CQ_FAIL_500,
    [SPEC_CQ_A_CM2]: other(specCqPCM2()),
    [SPEC_CQ_A_SL2]: other(specCqPSL2()),
    [SPEC_CQ_A_FAIL]: SPEC_CQ_FAIL_500
  }));
  assert.ok(check.reportText, check.detail);
  const exported = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  assert.equal(specCqItems(exported.json).length, 3);
  const otherIds = specCqIds(exported.json);
  assert.equal(otherIds.R1, ids.R1);
  assert.equal(otherIds.R3, ids.R3);
  assert.equal(otherIds.R4, ids.R4);
  const skipped = specCqSkippedNames(exported.json);
  assert.ok(skipped.includes(SPEC_CQ_NAMES.R2), JSON.stringify(exported.json.skipped));
  assert.ok(skipped.includes(SPEC_CQ_NAMES.R5), JSON.stringify(exported.json.skipped));
});

test("[spec] content B7 Q15 repeated executions of one case get different ids", async () => {
  const cases = [specCqRaCases()[0]];
  const check = await specCqRunCheck(cases, specCqRaResponder(), { extraArgs: ["--repeat", "2"] });
  assert.ok(check.report, check.detail);
  assert.deepEqual(check.report.results.map((result) => [result.name, result.repetition]), [[SPEC_CQ_NAMES.R1, 1], [SPEC_CQ_NAMES.R1, 2]]);
  const exported = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  assert.deepEqual(specCqItems(exported.json).map((item) => item.id), [SPEC_CQ_NAMES.R1, `${SPEC_CQ_NAMES.R1} (2)`]);
});

test("[spec] content B8 Q15 two cases with the same name get different ids", async () => {
  const cases = [
    specCqCase("spec same name", "prompt-a-1", SPEC_CQ_A_SL, ["SLOT"], SPEC_CQ_EB.R1),
    specCqCase("spec same name", "prompt-b-1", SPEC_CQ_A_SL2, ["LANGUAGE_FIX"], SPEC_CQ_EB.R4)
  ];
  const check = await specCqRunCheck(cases, specCqRaResponder());
  assert.ok(check.reportText, check.detail);
  const exported = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  const items = specCqItems(exported.json);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.id), ["spec same name", "spec same name (2)"]);
});

test("[spec] content B9 names that differ only in symbols and case get different ids", async () => {
  const cases = [
    specCqCase("Spec: Case A!", "prompt-a-1", SPEC_CQ_A_SL, ["SLOT"], SPEC_CQ_EB.R1),
    specCqCase("spec case a", "prompt-a-1", SPEC_CQ_A_LF, ["LANGUAGE_FIX"], SPEC_CQ_EB.R2)
  ];
  const check = await specCqRunCheck(cases, specCqRaResponder());
  assert.ok(check.reportText, check.detail);
  const exported = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  const ids = specCqItems(exported.json).map((item) => item.id);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(ids, ["Spec: Case A!", "spec case a"]);
});

test("[spec] content B10 the slot item R1 shows the question, answer, strength and mission", async () => {
  const { exported } = await specCqPipeline();
  specCqAssertR1Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_SL));
});

test("[spec] content B11 the language fix item R2 shows the correction rows and the revised answer", async () => {
  const { exported } = await specCqPipeline();
  specCqAssertR2Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_LF));
});

test("[spec] content B12 the completed item R3 shows the completion materials", async () => {
  const { exported } = await specCqPipeline();
  specCqAssertR3Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_CM2));
});

test("[spec] content B14 unfinished items carry no completion materials", async () => {
  const { exported } = await specCqPipeline();
  const r1 = specCqItemByAnswer(exported.json, SPEC_CQ_A_SL);
  const r1Text = JSON.stringify(r1);
  assert.equal(r1Text.includes("After dinner, I watch TV because it helps me unwind."), false, r1Text);
  assert.equal(r1Text.includes("저녁을 먹은 뒤에는 긴장을 풀 수 있어서 TV를 봐요."), false, r1Text);
  assert.equal(r1Text.includes("unwind"), false, r1Text);
  for (const answer of [SPEC_CQ_A_SL, SPEC_CQ_A_LF, SPEC_CQ_A_SL2]) {
    const item = specCqItemByAnswer(exported.json, answer);
    assert.ok(specCqEmptyCompletion(item.feedback.completion), `${answer}: ${JSON.stringify(item.feedback.completion)}`);
  }
});

test("[spec] content B15 Q2 review-items.md has each item and the skipped cases at the end", async () => {
  const { exported, ids } = await specCqPipeline();
  const md = exported.md;
  const starts = ["R1", "R2", "R3", "R4"].map((r) => [r, md.indexOf(ids[r])]);
  for (const [r, start] of starts) {
    assert.ok(start >= 0, `${r} id is not in the md`);
  }
  const sorted = [...starts].sort((left, right) => left[1] - right[1]);
  const section = Object.fromEntries(sorted.map(([r, start], index) => [r, md.slice(start, sorted[index + 1]?.[1] ?? md.length)]));
  const common = {
    R1: ["prompt-a-1", SPEC_CQ_A_SL, SPEC_CQ_EB.R1, "저녁 뒤에 하는 일을 분명히 말했어요."],
    R2: ["prompt-a-1", SPEC_CQ_A_LF, SPEC_CQ_EB.R2, "저녁 뒤에 하는 일과 이유를 함께 말했어요."],
    R3: ["prompt-b-1", SPEC_CQ_A_CM2, SPEC_CQ_EB.R3, "blocking focus time으로 대응 방법을 구체적으로 썼어요."],
    R4: ["prompt-b-1", SPEC_CQ_A_SL2, SPEC_CQ_EB.R4, "직장에서 겪는 어려움이 있다는 것부터 말했어요."]
  };
  const extra = {
    R1: ["because로 TV를 보는 이유를 한 문장 더해 보세요.", "I watch TV after dinner because ____.", "it helps me relax"],
    R2: ["take walk", "take a walk", "walk 앞에 a가 필요해요.", "After dinner, I usually take a walk because it helps me relax."],
    R3: [specCqPCM2().modelAnswer, specCqPCM2().modelAnswerKo, "carve out time", "결과 더하기"],
    R4: ["어떤 일이 어려운지 한 가지를 콕 집어 써 보세요."]
  };
  for (const r of ["R1", "R2", "R3", "R4"]) {
    const [promptId, answer, expectedBehavior, strength] = common[r];
    for (const text of [SPEC_CQ_PROMPTS[promptId].en, answer, expectedBehavior, strength, ...extra[r]]) {
      assert.ok(section[r].includes(text), `${r} section should include "${text}":\n${section[r]}`);
    }
  }
  const skippedAt = md.indexOf("뺀 케이스");
  assert.ok(skippedAt >= 0, "md should have the skipped-case section");
  assert.ok(md.indexOf(SPEC_CQ_NAMES.R5, skippedAt) > skippedAt, "the failed request should be listed in the skipped-case section");
});

// 결정 Q1: 질문 문장·난이도는 --cases의 케이스 이름으로. 없거나 맞는 케이스가 없으면 null.
test("[spec] content Q1 without --cases or a matching case the question text and difficulty are null", async () => {
  const { check } = await specCqPipeline();
  const withoutCases = await specCqExport({ reportText: check.reportText });
  assert.equal(withoutCases.code, 0, withoutCases.detail);
  const unmatched = await specCqExport({
    reportText: check.reportText,
    cases: specCqRaCases().map((testCase) => ({ ...testCase, name: `${testCase.name} (other file)` }))
  });
  assert.equal(unmatched.code, 0, unmatched.detail);
  for (const exported of [withoutCases, unmatched]) {
    const items = specCqItems(exported.json);
    assert.equal(items.length, 4);
    for (const item of items) {
      assert.equal(item.question?.en ?? null, null, JSON.stringify(item.question));
      assert.equal(item.question?.ko ?? null, null, JSON.stringify(item.question));
      assert.equal(item.question?.difficulty ?? null, null, JSON.stringify(item.question));
    }
  }
});

// 결정 Q13: --include-pass-payloads 없이 만든 리포트의 통과 케이스는 skipped(reason "no payload snapshot").
test("[spec] content Q13 passing cases without a snapshot are skipped as no payload snapshot", async () => {
  const cases = specCqRaCases();
  const check = await specCqRunCheck(cases, specCqRaResponder(), { passPayloads: false });
  assert.ok(check.reportText, check.detail);
  const exported = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  assert.deepEqual(specCqItems(exported.json).map((item) => item.answer), [SPEC_CQ_A_SL2]);
  const skipped = exported.json.skipped ?? [];
  for (const r of ["R1", "R2", "R3"]) {
    const entry = skipped.find((candidate) => candidate.name === SPEC_CQ_NAMES[r]);
    assert.ok(entry, `${r} should be skipped: ${JSON.stringify(skipped)}`);
    assert.equal(entry.reason, "no payload snapshot");
  }
  assert.ok(skipped.some((candidate) => candidate.name === SPEC_CQ_NAMES.R5), JSON.stringify(skipped));
});

// ---------------------------------------------------------------- C. 점수 모으기

test("[spec] content C1 C2 well-formed scores with many nulls summarize per rubric item", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), itemsText: exported.jsonText });
  assert.equal(out.code, 0, out.detail);
  specCqAssertOverall(out.stdout, SPEC_CQ_C2);
});

test("[spec] content C3 Q5 averages per difficulty for each rubric item", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), itemsText: exported.jsonText });
  assert.equal(out.code, 0, out.detail);
  specCqAssertGroups(out.stdout, "난이도", SPEC_CQ_C3);
});

test("[spec] content C4 Q4 Q5 averages per mission kind for each rubric item", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), itemsText: exported.jsonText });
  assert.equal(out.code, 0, out.detail);
  specCqAssertGroups(out.stdout, "미션 종류", SPEC_CQ_C4);
});

test("[spec] content C5 Q7 low scores list every score of 2 or less with its id and note", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), itemsText: exported.jsonText });
  assert.equal(out.code, 0, out.detail);
  specCqAssertLow(out.stdout, ids, SPEC_CQ_C5_Q7);
});

test("[spec] content Q7 low scores keep the scores.json order, not the score order", async () => {
  const { ids } = await specCqPipeline();
  const scores = specCqScores({
    R4: [null, null, 2, 3, 4, null],
    R2: [3, 3, 4, 4, 4, null],
    R1: [null, null, 1, 3, 4, null],
    R3: [null, null, null, null, 3, 4]
  }, ids);
  const out = await specCqSummarize({ scores });
  assert.equal(out.code, 0, out.detail);
  specCqAssertLow(out.stdout, ids, { missionFit: [["R4", "R4 missionFit 근거"], ["R1", "R1 missionFit 근거"]] });
});

test("[spec] content C6 not applicable is not a low score", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), itemsText: exported.jsonText });
  assert.equal(out.code, 0, out.detail);
  const lists = specCqLowLists(out.stdout);
  const absent = {
    correctionAccuracy: ["R1", "R3", "R4"],
    completionMaterials: ["R1", "R2", "R4"],
    missionFit: ["R3"],
    supportMaterials: ["R3"]
  };
  for (const [key, rows] of Object.entries(absent)) {
    for (const r of rows) {
      assert.equal(lists[key].some((line) => line.includes(ids[r])), false, `${key} should not list ${r}: ${lists[key].join(" | ")}`);
    }
  }
});

test("[spec] content C7 without review items the per-item summary is the same", async () => {
  const { ids } = await specCqPipeline();
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids) });
  assert.equal(out.code, 0, out.detail);
  specCqAssertOverall(out.stdout, SPEC_CQ_C2);
  specCqAssertLow(out.stdout, ids, SPEC_CQ_C5_Q7);
  const lists = specCqLowLists(out.stdout);
  assert.equal(lists.correctionAccuracy.some((line) => [ids.R1, ids.R3, ids.R4].some((id) => line.includes(id))), false);
  assert.equal(lists.completionMaterials.some((line) => [ids.R1, ids.R2, ids.R4].some((id) => line.includes(id))), false);
});

test("[spec] content C8 a rubric item with no scores shows no mean instead of 0 or NaN", async () => {
  const { ids } = await specCqPipeline();
  const { R2: _dropR2, ...withoutR2 } = SPEC_CQ_S1;
  const out = await specCqSummarize({ scores: specCqScores(withoutR2, ids) });
  assert.equal(out.code, 0, out.detail);
  assert.doesNotMatch(out.stdout, /NaN/);
  specCqAssertOverall(out.stdout, {
    correctionAccuracy: [0, null, null],
    correctionExplanation: [0, null, null]
  });
  const lists = specCqLowLists(out.stdout);
  assert.deepEqual(lists.correctionAccuracy, []);
  assert.deepEqual(lists.correctionExplanation, []);
});

// C9 (Q10: --compare가 앞, --scores가 뒤, 차이는 뒤 − 앞): [앞 평균, 뒤 평균, 차이]
const SPEC_CQ_C9 = {
  correctionAccuracy: [4, 2, -2],
  correctionExplanation: [3, 3, 0],
  missionFit: [4, 4, 0],
  supportMaterials: [4, 3, -1],
  strength: [3.75, 4, 0.25],
  completionMaterials: [1, 4, 3]
};

test("[spec] content C9 Q10 --compare shows each rubric item's mean before, after and the difference", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({
    scores: specCqScores(SPEC_CQ_S1, ids),
    itemsText: exported.jsonText,
    compare: specCqScores(SPEC_CQ_S0, ids)
  });
  assert.equal(out.code, 0, out.detail);
  const block = specCqBlock(out.stdout, "비교");
  for (const [key, [before, after, diff]] of Object.entries(SPEC_CQ_C9)) {
    const line = specCqKeyLine(block.slice(1), key);
    assert.ok(line, `no ${key} line in:\n${block.join("\n")}`);
    const numbers = line.slice(line.indexOf(":") + 1).match(/[+-]?\d+(?:\.\d+)?/g) ?? [];
    assert.equal(numbers[0], before.toFixed(2), `${key} before: ${line}`);
    assert.equal(numbers[1], after.toFixed(2), `${key} after: ${line}`);
    if (diff > 0) {
      assert.equal(numbers[2], `+${diff.toFixed(2)}`, `${key} diff: ${line}`);
    } else if (diff < 0) {
      assert.equal(numbers[2], diff.toFixed(2), `${key} diff: ${line}`);
    } else {
      assert.ok(["0.00", "+0.00"].includes(numbers[2]), `${key} diff should be 0: ${line}`);
    }
  }
});

test("[spec] content C10 --compare lists the same-id cells that moved by 2 or more", async () => {
  const { exported, ids } = await specCqPipeline();
  const out = await specCqSummarize({
    scores: specCqScores(SPEC_CQ_S1, ids),
    itemsText: exported.jsonText,
    compare: specCqScores(SPEC_CQ_S0, ids)
  });
  assert.equal(out.code, 0, out.detail);
  const rows = specCqAssertChanged(out.stdout, ids, [
    ["R1", "missionFit", 2, 4],
    ["R2", "correctionAccuracy", 4, 2],
    ["R3", "completionMaterials", 1, 4],
    ["R4", "missionFit", 5, 3],
    ["R4", "supportMaterials", 5, 2]
  ]);
  assert.equal(rows.some((row) => specCqChangedMatches(row, ids.R1, "strength", 4, 5)), false);
});

test("[spec] content Q10 cells null on one side are left out of the 2-point list", async () => {
  const { ids } = await specCqPipeline();
  const before = specCqScores({ ...SPEC_CQ_S0, R1: [5, null, 2, 3, 4, null], R3: [null, null, null, null, 3, null] }, ids);
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), compare: before });
  assert.equal(out.code, 0, out.detail);
  specCqAssertChanged(out.stdout, ids, [
    ["R1", "missionFit", 2, 4],
    ["R2", "correctionAccuracy", 4, 2],
    ["R4", "missionFit", 5, 3],
    ["R4", "supportMaterials", 5, 2]
  ]);
});

test("[spec] content Q8 Q10 an id only on one side of --compare is not an error and not listed", async () => {
  const { ids } = await specCqPipeline();
  const { R4: _dropR4, ...withoutR4 } = SPEC_CQ_S0;
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), compare: specCqScores(withoutR4, ids) });
  assert.equal(out.code, 0, out.detail);
  specCqAssertChanged(out.stdout, ids, [
    ["R1", "missionFit", 2, 4],
    ["R2", "correctionAccuracy", 4, 2],
    ["R3", "completionMaterials", 1, 4]
  ]);
});

test("[spec] content C11 an unknown key in scores is an error naming it", async () => {
  const { ids } = await specCqPipeline();
  const scores = specCqScores(SPEC_CQ_S1, ids);
  scores[0].scores.grammar = 3;
  specCqAssertRejected(await specCqSummarize({ scores }), "grammar");
});

test("[spec] content C12 an unknown key in notes is an error naming it", async () => {
  const { ids } = await specCqPipeline();
  const scores = specCqScores(SPEC_CQ_S1, ids);
  scores[0].notes.overall = "x";
  specCqAssertRejected(await specCqSummarize({ scores }), "overall");
});

for (const value of [6, 0, -1]) {
  test(`[spec] content C13 a score of ${value} is an error naming the rubric key`, async () => {
    const { ids } = await specCqPipeline();
    const scores = specCqWithScore(specCqScores(SPEC_CQ_S1, ids), 1, "missionFit", value);
    specCqAssertRejected(await specCqSummarize({ scores }), "missionFit");
  });
}

for (const value of [3.5, "4"]) {
  test(`[spec] content C14 a non-integer score ${JSON.stringify(value)} is an error naming the rubric key`, async () => {
    const { ids } = await specCqPipeline();
    const scores = specCqWithScore(specCqScores(SPEC_CQ_S1, ids), 1, "missionFit", value);
    specCqAssertRejected(await specCqSummarize({ scores }), "missionFit");
  });
}

test("[spec] content C15 Q8 a missing id or an id not in the review items is an error", async () => {
  const { exported, ids } = await specCqPipeline();
  const noId = specCqScores(SPEC_CQ_S1, ids);
  delete noId[0].id;
  specCqAssertRejected(await specCqSummarize({ scores: noId }));

  const unknownId = specCqScores(SPEC_CQ_S1, ids);
  unknownId[0].id = "spec-no-such-id";
  specCqAssertRejected(await specCqSummarize({ scores: unknownId, itemsText: exported.jsonText }), "spec-no-such-id");
});

test("[spec] content Q8 a review item that was not scored is an error naming it", async () => {
  const { exported, ids } = await specCqPipeline();
  const { R2: _dropR2, ...withoutR2 } = SPEC_CQ_S1;
  specCqAssertRejected(await specCqSummarize({ scores: specCqScores(withoutR2, ids), itemsText: exported.jsonText }), ids.R2);
});

test("[spec] content C16 scores.json that is not an array is an error", async () => {
  const { ids } = await specCqPipeline();
  specCqAssertRejected(await specCqSummarize({ scores: { items: specCqScores(SPEC_CQ_S1, ids) } }));
});

test("[spec] content C17 the --compare file is checked the same way", async () => {
  const { ids } = await specCqPipeline();
  const before = specCqWithScore(specCqScores(SPEC_CQ_S0, ids), 1, "missionFit", 6);
  specCqAssertRejected(await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), compare: before }), "missionFit");
});

// 결정 Q9: 빠진 키, 중복 id, scores 칸 없음은 오류. notes는 선택.
test("[spec] content Q9 a missing rubric key is an error naming it", async () => {
  const { ids } = await specCqPipeline();
  const scores = specCqScores(SPEC_CQ_S1, ids);
  delete scores[0].scores.completionMaterials;
  specCqAssertRejected(await specCqSummarize({ scores }), "completionMaterials");
});

test("[spec] content Q9 a duplicate id is an error naming it", async () => {
  const { ids } = await specCqPipeline();
  const scores = specCqScores(SPEC_CQ_S1, ids);
  scores.push(JSON.parse(JSON.stringify(scores[0])));
  specCqAssertRejected(await specCqSummarize({ scores }), ids.R1);
});

test("[spec] content Q9 an entry without scores is an error", async () => {
  const { ids } = await specCqPipeline();
  const scores = specCqScores(SPEC_CQ_S1, ids);
  delete scores[0].scores;
  specCqAssertRejected(await specCqSummarize({ scores }));
});

test("[spec] content Q9 notes are optional", async () => {
  const { exported, ids } = await specCqPipeline();
  const noNotes = specCqScores(SPEC_CQ_S1, ids).map(({ notes: _notes, ...entry }) => entry);
  const withoutNotes = await specCqSummarize({ scores: noNotes, itemsText: exported.jsonText });
  assert.equal(withoutNotes.code, 0, withoutNotes.detail);
  specCqAssertOverall(withoutNotes.stdout, SPEC_CQ_C2);

  const partialNotes = specCqScores(SPEC_CQ_S1, ids).map((entry) => ({ ...entry, notes: { strength: entry.notes.strength } }));
  const withPartialNotes = await specCqSummarize({ scores: partialNotes, itemsText: exported.jsonText });
  assert.equal(withPartialNotes.code, 0, withPartialNotes.detail);
});

// ---------------------------------------------------------------- D. 루브릭 문서의 채점 출력 형식

test("[spec] content D1 the rubric's output format section names id, scores, notes and the six keys", async () => {
  const fsp = await import("node:fs/promises");
  const { pathMod, testDir } = await specCqPaths();
  const doc = await fsp.readFile(pathMod.join(testDir, "content-rubric.md"), "utf8");
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#+\s/.test(line) && line.includes("출력 형식"));
  assert.ok(start >= 0, "no output format section");
  const level = lines[start].match(/^#+/)[0].length;
  const endOffset = lines.slice(start + 1).findIndex((line) => {
    const match = line.match(/^(#+)\s/);
    return match && match[1].length <= level;
  });
  const section = lines.slice(start, endOffset < 0 ? lines.length : start + 1 + endOffset).join("\n");
  for (const word of ["scores.json", "id", "scores", "notes", "null", ...SPEC_CQ_KEYS]) {
    assert.ok(section.includes(word), `output format section should mention ${word}`);
  }
});

// ---------------------------------------------------------------- X. 끝에서 끝

test("[spec] content X1 report snapshot, export and summarize chain end to end", async () => {
  const cases = specCqRaCases();
  const check = await specCqRunCheck(cases, specCqRaResponder());
  assert.ok(check.reportText, check.detail);
  const r1Result = check.report.results.find((result) => result.answer === SPEC_CQ_A_SL);
  assert.deepEqual(r1Result.actual.strengths, ["저녁 뒤에 하는 일을 분명히 말했어요."]);

  const exported = await specCqExport({ reportText: check.reportText, cases });
  assert.equal(exported.code, 0, exported.detail);
  const items = specCqItems(exported.json);
  assert.equal(items.length, 4);
  assert.ok(specCqSkippedNames(exported.json).includes(SPEC_CQ_NAMES.R5));
  specCqAssertR1Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_SL));
  specCqAssertR2Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_LF));
  specCqAssertR3Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_CM2));
  specCqAssertR4Item(specCqItemByAnswer(exported.json, SPEC_CQ_A_SL2));

  const ids = specCqIds(exported.json);
  const out = await specCqSummarize({ scores: specCqScores(SPEC_CQ_S1, ids), itemsText: exported.jsonText });
  assert.equal(out.code, 0, out.detail);
  specCqAssertOverall(out.stdout, SPEC_CQ_C2);
  specCqAssertGroups(out.stdout, "난이도", SPEC_CQ_C3);
  specCqAssertGroups(out.stdout, "미션 종류", SPEC_CQ_C4);
  specCqAssertLow(out.stdout, ids, SPEC_CQ_C5_Q7);
});
