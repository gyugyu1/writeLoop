import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { evaluatePayload, normalizeText, validateCases } from "./feedback-quality/rules.mjs";
import { writeReport } from "./feedback-quality/report-writer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SUITE = "smoke";
const DEFAULT_BASE_URL = "http://localhost:8080";

const options = parseArgs(process.argv.slice(2));
const suite = options.suite ?? inferSuiteName(options.cases) ?? DEFAULT_SUITE;
const casesPath = options.cases
  ? path.resolve(process.cwd(), options.cases)
  : path.join(__dirname, "feedback-quality", `cases.${suite}.json`);
const baseUrl = (options.baseUrl ?? process.env.WRITELOOP_FEEDBACK_API_BASE_URL ?? DEFAULT_BASE_URL)
  .replace(/\/+$/, "");
const reportDir = path.resolve(
  process.cwd(),
  options.reportDir ?? process.env.WRITELOOP_FEEDBACK_REPORT_DIR ?? "reports/feedback-quality"
);
const authToken = process.env.WRITELOOP_FEEDBACK_AUTH_TOKEN || "";
const stableGuestId = options.stableGuestId === true || process.env.WRITELOOP_FEEDBACK_STABLE_GUEST_ID === "true";
const configuredGuestId = process.env.WRITELOOP_FEEDBACK_GUEST_ID || "";
const guestIdPrefix = normalizeGuestIdPrefix(
  process.env.WRITELOOP_FEEDBACK_GUEST_ID_PREFIX || `guest-quality-${Date.now().toString(36)}-`
);
const concurrency = Math.max(1, Number(options.concurrency ?? process.env.WRITELOOP_FEEDBACK_QUALITY_CONCURRENCY ?? 1));
const timeoutMs = Math.max(1000, Number(options.timeoutMs ?? process.env.WRITELOOP_FEEDBACK_QUALITY_TIMEOUT_MS ?? 120000));
const dryRun = options.dryRun === true;
const shouldWriteReport = options.report !== false && !dryRun;
const includePassPayloads = options.includePassPayloads === true || process.env.WRITELOOP_FEEDBACK_INCLUDE_PASS_PAYLOADS === "true";
const skipPromptPreflight = options.skipPromptPreflight === true
  || process.env.WRITELOOP_FEEDBACK_SKIP_PROMPT_PREFLIGHT === "true";

const cases = await loadCases(casesPath);
const validation = validateCases(cases);
if (validation.warnings.length > 0) {
  console.warn("Feedback quality case warnings:");
  for (const warning of validation.warnings) {
    console.warn(`- ${warning}`);
  }
}

if (validation.failures.length > 0) {
  console.error("Feedback quality case validation failed:");
  for (const failure of validation.failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (dryRun) {
  console.log(`Feedback quality cases are valid: ${cases.length} case(s) from ${displayPath(casesPath)}`);
  process.exit(0);
}

if (!skipPromptPreflight) {
  const promptValidation = await validatePromptCoverage(cases, baseUrl);
  if (promptValidation.warnings.length > 0) {
    console.warn("Feedback quality prompt warnings:");
    for (const warning of promptValidation.warnings) {
      console.warn(`- ${warning}`);
    }
  }
  if (promptValidation.failures.length > 0) {
    console.error("Feedback quality prompt preflight failed:");
    for (const failure of promptValidation.failures) {
      console.error(`- ${failure}`);
    }
    console.error("Use --skip-prompt-preflight only when intentionally testing inactive or ad-hoc prompts.");
    process.exit(1);
  }
}

const startedAt = new Date().toISOString();
console.log(`Running feedback quality suite "${suite}" against ${baseUrl}`);
console.log(`Cases: ${cases.length}, concurrency: ${concurrency}, timeoutMs: ${timeoutMs}`);

const results = await runPool(cases, concurrency, async (testCase, index) => {
  const startedAtMs = Date.now();
  try {
    const payload = await review(testCase, index);
    const evaluation = evaluatePayload(testCase, payload);
    const elapsedMs = Date.now() - startedAtMs;
    const status = evaluation.pass ? "ok" : "not ok";

    console.log(`${status} ${index + 1}/${cases.length}: ${testCase.name} -> ${evaluation.focusType ?? "(blank)"} (${elapsedMs}ms)`);
    return {
      index: index + 1,
      name: testCase.name,
      category: testCase.category ?? null,
      promptId: testCase.promptId,
      answer: testCase.answer,
      elapsedMs,
      focusType: evaluation.focusType,
      loopComplete: evaluation.loopComplete,
      fixPointCount: evaluation.fixPointCount,
      hasComparison: evaluation.hasComparison,
      pass: evaluation.pass,
      failures: evaluation.failures,
      warnings: evaluation.warnings,
      expectedFocusTypes: testCase.expectedFocusTypes,
      forbiddenFocusTypes: testCase.forbiddenFocusTypes ?? [],
      expectedBehavior: testCase.expectedBehavior ?? null,
      badBehavior: testCase.badBehavior ?? null,
      actual: evaluation.pass && !includePassPayloads ? null : buildPayloadSnapshot(payload)
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAtMs;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`not ok ${index + 1}/${cases.length}: ${testCase.name} (${elapsedMs}ms)`);
    return {
      index: index + 1,
      name: testCase.name,
      category: testCase.category ?? null,
      promptId: testCase.promptId,
      answer: testCase.answer,
      elapsedMs,
      focusType: null,
      loopComplete: false,
      fixPointCount: 0,
      hasComparison: false,
      pass: false,
      failures: [{ code: "request_failed", message }],
      warnings: [],
      expectedFocusTypes: testCase.expectedFocusTypes,
      forbiddenFocusTypes: testCase.forbiddenFocusTypes ?? [],
      expectedBehavior: testCase.expectedBehavior ?? null,
      badBehavior: testCase.badBehavior ?? null,
      actual: null
    };
  }
});

const finishedAt = new Date().toISOString();
const failureCounts = countByCode(results.flatMap((result) => result.failures));
const warningCounts = countByCode(results.flatMap((result) => result.warnings));
const passed = results.filter((result) => result.pass).length;
const failed = results.length - passed;
const report = {
  suite,
  casesPath: displayPath(casesPath),
  baseUrl,
  startedAt,
  finishedAt,
  total: results.length,
  passed,
  failed,
  failureCounts,
  warningCounts,
  focusConfusions: buildFocusConfusions(results),
  failedSnapshots: results
    .filter((result) => !result.pass)
    .map((result) => ({
      index: result.index,
      name: result.name,
      category: result.category,
      promptId: result.promptId,
      answer: result.answer,
      expectedFocusTypes: result.expectedFocusTypes,
      actualFocusType: result.focusType,
      failures: result.failures,
      expectedBehavior: result.expectedBehavior,
      badBehavior: result.badBehavior,
      actual: result.actual
    })),
  results
};

if (shouldWriteReport) {
  const written = await writeReport(report, reportDir);
  console.log(`Report: ${displayPath(written.latestPath)}`);
}

if (failed > 0) {
  console.error(`\nFeedback quality check failed: ${passed}/${results.length} passed`);
  for (const result of results.filter((item) => !item.pass)) {
    console.error(`- ${result.name}: ${result.failures.map((failure) => failure.message).join("; ")}`);
  }
  process.exit(1);
}

console.log(`\nFeedback quality check passed: ${passed}/${results.length}`);

async function review(testCase, index) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { "content-type": "application/json" };
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  try {
    const requestBody = {
      promptId: testCase.promptId,
      answer: testCase.answer,
      attemptType: testCase.attemptType ?? "FIRST",
      guestId: guestIdForCase(testCase, index)
    };
    if (testCase.sessionId) {
      requestBody.sessionId = testCase.sessionId;
    }

    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${text.slice(0, 500)}`);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`invalid_json ${text.slice(0, 500)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCases(filePath, seen = new Set()) {
  const resolvedPath = path.resolve(filePath);
  if (seen.has(resolvedPath)) {
    throw new Error(`Circular feedback quality suite reference: ${displayPath(resolvedPath)}`);
  }
  seen.add(resolvedPath);

  const raw = JSON.parse(await fs.readFile(resolvedPath, "utf8"));
  if (Array.isArray(raw)) {
    return raw;
  }

  const parentSuites = raw.extends ?? [];
  const parentCases = [];
  for (const parentSuite of parentSuites) {
    const parentPath = path.isAbsolute(parentSuite)
      ? parentSuite
      : path.join(path.dirname(resolvedPath), parentSuite.includes(".json") ? parentSuite : `cases.${parentSuite}.json`);
    parentCases.push(...await loadCases(parentPath, seen));
  }

  return [...parentCases, ...(raw.cases ?? [])];
}

async function runPool(items, size, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, runNext));
  return results;
}

function parseArgs(args) {
  const parsed = {
    suite: null,
    cases: null,
    baseUrl: null,
    reportDir: null,
    concurrency: null,
    timeoutMs: null,
    dryRun: false,
    report: true,
    stableGuestId: false,
    includePassPayloads: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--suite":
        parsed.suite = args[++index];
        break;
      case "--cases":
        parsed.cases = args[++index];
        break;
      case "--base-url":
        parsed.baseUrl = args[++index];
        break;
      case "--report-dir":
        parsed.reportDir = args[++index];
        break;
      case "--concurrency":
        parsed.concurrency = args[++index];
        break;
      case "--timeout-ms":
        parsed.timeoutMs = args[++index];
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--no-report":
        parsed.report = false;
        break;
      case "--stable-guest-id":
        parsed.stableGuestId = true;
        break;
      case "--include-pass-payloads":
        parsed.includePassPayloads = true;
        break;
      case "--skip-prompt-preflight":
        parsed.skipPromptPreflight = true;
        break;
      case "--help":
        printHelpAndExit();
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

async function validatePromptCoverage(testCases, apiBaseUrl) {
  const failures = [];
  const warnings = [];
  let prompts;
  try {
    const response = await fetch(`${apiBaseUrl}/api/prompts`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    prompts = await response.json();
  } catch (error) {
    warnings.push(`Could not fetch active prompts from ${apiBaseUrl}/api/prompts: ${error instanceof Error ? error.message : String(error)}`);
    return { failures, warnings };
  }

  const promptById = new Map((Array.isArray(prompts) ? prompts : []).map((prompt) => [prompt.id, prompt]));
  for (const testCase of testCases) {
    const prompt = promptById.get(testCase.promptId);
    if (!prompt) {
      failures.push(`${testCase.name}: promptId ${testCase.promptId} is not in active /api/prompts`);
      continue;
    }

    const question = normalizeText(prompt.questionEn);
    const expectedQuestionNeedles = testCase.promptQuestionIncludesAny ?? [];
    if (expectedQuestionNeedles.length > 0 && !expectedQuestionNeedles.some((needle) => question.includes(normalizeText(needle)))) {
      failures.push(`${testCase.name}: promptId ${testCase.promptId} question "${prompt.questionEn}" does not match any promptQuestionIncludesAny value`);
    }
  }

  return { failures, warnings };
}

function countByCode(items) {
  return items.reduce((counts, item) => {
    counts[item.code] = (counts[item.code] ?? 0) + 1;
    return counts;
  }, {});
}

function buildFocusConfusions(results) {
  const counts = new Map();
  for (const result of results) {
    if (result.pass) {
      continue;
    }
    const expected = result.expectedFocusTypes?.join("/") || "(none)";
    const actual = result.focusType || "(none)";
    const key = `${actual} -> ${expected}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern));
}

function buildPayloadSnapshot(payload) {
  return {
    score: payload?.score ?? null,
    loopComplete: payload?.loopComplete === true,
    completionMessage: limitText(payload?.completionMessage, 500),
    summary: limitText(payload?.summary, 800),
    correctedAnswer: limitText(payload?.correctedAnswer, 1200),
    modelAnswer: limitText(payload?.modelAnswer, 1200),
    modelAnswerKo: limitText(payload?.modelAnswerKo, 1200),
    rewriteChallenge: limitText(payload?.rewriteChallenge, 800),
    coachMove: compactObject({
      focus: limitText(payload?.coachMove?.focus, 500),
      focusType: payload?.coachMove?.focusType ?? null,
      why: limitText(payload?.coachMove?.why, 800),
      before: limitText(payload?.coachMove?.before, 800),
      after: limitText(payload?.coachMove?.after, 800),
      instruction: limitText(payload?.coachMove?.instruction, 800),
      successCheck: limitText(payload?.coachMove?.successCheck, 800)
    }),
    rewriteWorkspace: compactObject({
      seedText: limitText(payload?.rewriteWorkspace?.seedText, 1200),
      starterText: limitText(payload?.rewriteWorkspace?.starterText, 800),
      targetHint: limitText(payload?.rewriteWorkspace?.targetHint, 800),
      enabled: payload?.rewriteWorkspace?.enabled ?? null
    }),
    completion: compactObject({
      title: limitText(payload?.completion?.title, 500),
      message: limitText(payload?.completion?.message, 800),
      nextActionLabel: limitText(payload?.completion?.nextActionLabel, 300)
    }),
    revealLater: compactObject({
      label: limitText(payload?.revealLater?.label, 300),
      reason: limitText(payload?.revealLater?.reason, 800)
    }),
    ui: compactObject({
      loopStatus: payload?.ui?.loopStatus ?? null,
      screenPolicy: payload?.ui?.screenPolicy ?? null,
      fixPoints: sliceArray(payload?.ui?.fixPoints, 5).map((point) => compactObject({
        kind: point?.kind ?? null,
        title: limitText(point?.title, 300),
        headline: limitText(point?.headline, 500),
        supportText: limitText(point?.supportText, 800),
        originalText: limitText(point?.originalText, 800),
        revisedText: limitText(point?.revisedText, 800),
        meaningKo: limitText(point?.meaningKo, 500),
        guidanceKo: limitText(point?.guidanceKo, 800),
        exampleEn: limitText(point?.exampleEn, 800)
      })),
      nextStepPractice: compactObject({
        kind: payload?.ui?.nextStepPractice?.kind ?? null,
        title: limitText(payload?.ui?.nextStepPractice?.title, 300),
        headline: limitText(payload?.ui?.nextStepPractice?.headline, 500),
        supportText: limitText(payload?.ui?.nextStepPractice?.supportText, 800),
        originalText: limitText(payload?.ui?.nextStepPractice?.originalText, 800),
        revisedText: limitText(payload?.ui?.nextStepPractice?.revisedText, 800),
        guidanceKo: limitText(payload?.ui?.nextStepPractice?.guidanceKo, 800),
        exampleEn: limitText(payload?.ui?.nextStepPractice?.exampleEn, 800)
      }),
      rewriteSuggestions: sliceArray(payload?.ui?.rewriteSuggestions, 3).map((suggestion) => compactObject({
        title: limitText(suggestion?.title, 300),
        text: limitText(suggestion?.text, 800),
        reason: limitText(suggestion?.reason, 800)
      }))
    }),
    refinementExpressions: sliceArray(payload?.refinementExpressions, 5).map((expression) => compactObject({
      expression: limitText(expression?.expression, 300),
      meaningKo: limitText(expression?.meaningKo, 300),
      usageTipKo: limitText(expression?.usageTipKo, 500),
      exampleEn: limitText(expression?.exampleEn, 800),
      source: expression?.source ?? null
    }))
  };
}

function sliceArray(value, maxItems) {
  return Array.isArray(value) ? value.slice(0, maxItems) : [];
}

function limitText(value, maxLength) {
  if (typeof value !== "string") {
    return value ?? null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null) {
        return false;
      }
      if (Array.isArray(entry)) {
        return entry.length > 0;
      }
      if (typeof entry === "object") {
        return Object.keys(entry).length > 0;
      }
      if (typeof entry === "string") {
        return entry.trim().length > 0;
      }
      return true;
    })
  );
}

function guestIdForCase(testCase, index) {
  if (authToken) {
    return undefined;
  }
  if (testCase.guestId) {
    return testCase.guestId;
  }
  if (stableGuestId && configuredGuestId) {
    return configuredGuestId;
  }
  return `${guestIdPrefix}${String(index + 1).padStart(3, "0")}`;
}

function normalizeGuestIdPrefix(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  if (normalized.startsWith("guest-") && normalized.length >= 24) {
    return normalized.endsWith("-") ? normalized : `${normalized}-`;
  }
  return `guest-quality-${Date.now().toString(36)}-`;
}

function inferSuiteName(casesOption) {
  if (!casesOption) {
    return null;
  }

  const basename = path.basename(casesOption);
  return basename
    .replace(/^cases\./, "")
    .replace(/\.json$/i, "") || null;
}

function displayPath(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

function printHelpAndExit() {
  console.log(`
Usage:
  npm run feedback:quality -- --suite smoke
  npm run feedback:quality -- --suite regression --base-url http://localhost:8080
  npm run feedback:quality -- --cases scripts/feedback-quality/cases.release.json

Environment:
  WRITELOOP_FEEDBACK_API_BASE_URL   Backend URL, default http://localhost:8080
  WRITELOOP_FEEDBACK_AUTH_TOKEN     Optional bearer token
  WRITELOOP_FEEDBACK_GUEST_ID       Optional guest id for unauthenticated runs

Options:
  --suite <name>        smoke, regression, or release
  --cases <path>        Use a specific case file
  --base-url <url>      Override backend URL
  --concurrency <n>     Request concurrency, default 1
  --timeout-ms <n>      Per-case timeout, default 120000
  --dry-run             Validate cases without calling the backend
  --no-report           Do not write JSON report
  --stable-guest-id     Reuse WRITELOOP_FEEDBACK_GUEST_ID instead of per-case guest ids
  --skip-prompt-preflight
                        Do not check promptId values against /api/prompts before calling feedback
  --include-pass-payloads
                         Store payload snapshots for passing cases too
`);
  process.exit(0);
}
