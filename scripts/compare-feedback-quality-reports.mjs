import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { evaluatePayload } from "./feedback-quality/rules.mjs";

const options = parseArgs(process.argv.slice(2));
const cases = JSON.parse(await fs.readFile(path.resolve(options.cases), "utf8"));
const before = JSON.parse(await fs.readFile(path.resolve(options.before), "utf8"));
const after = JSON.parse(await fs.readFile(path.resolve(options.after), "utf8"));

const beforeResults = reevaluate(cases, before);
const afterResults = reevaluate(cases, after);
const comparison = {
  generatedAt: new Date().toISOString(),
  cases: cases.length,
  before: summarize(beforeResults),
  after: summarize(afterResults),
  paired: comparePairs(beforeResults, afterResults)
};

const output = `${JSON.stringify(comparison, null, 2)}\n`;
if (options.output) {
  const outputPath = path.resolve(options.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, "utf8");
}
process.stdout.write(output);

function reevaluate(testCases, report) {
  const reportByName = new Map((report.results ?? []).map((result) => [result.name, result]));
  return testCases.map((testCase) => {
    const stored = reportByName.get(testCase.name);
    if (!stored?.actual) {
      return {
        testCase,
        stored,
        evaluation: null,
        qualityScore: 0,
        dimensions: { request: false }
      };
    }
    const evaluation = evaluatePayload(testCase, stored.actual);
    const dimensions = scoreDimensions(testCase, stored.actual, evaluation);
    return {
      testCase,
      stored,
      evaluation,
      qualityScore: Object.values(dimensions).filter(Boolean).length,
      dimensions
    };
  });
}

function scoreDimensions(testCase, payload, evaluation) {
  const complete = payload?.loopComplete === true;
  const missionKind = evaluation.missionKind;
  const missionAccepted = evaluation.expectedMissionKinds.includes(missionKind);
  const completionAccepted = testCase.expectedLoopComplete == null
    || (testCase.expectedLoopComplete === true
      ? payload?.loopComplete === true || missionAccepted
      : payload?.loopComplete !== true);
  const failureCodes = new Set((evaluation.failures ?? []).map((failure) => failure.code));
  return {
    request: true,
    mission: missionAccepted,
    allowed: !evaluation.forbiddenMissionKinds.includes(missionKind),
    coachCore: complete || !["missing_coach_focus", "missing_coach_reason", "missing_coach_instruction"]
      .some((code) => failureCodes.has(code)),
    missionSupport: complete || (!failureCodes.has("missing_comparison")
      && !failureCodes.has("ungrounded_comparison")
      && !failureCodes.has("missing_content_scaffold")),
    fixPoint: complete || Number(evaluation.fixPointCount) > 0,
    completion: completionAccepted
  };
}

function summarize(results) {
  const successful = results.filter((result) => result.evaluation != null);
  const latencies = successful
    .map((result) => Number(result.stored?.elapsedMs))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const contentResults = successful.filter((result) => isContentMission(result.evaluation.missionKind)
    && !result.evaluation.loopComplete);
  const comparisonResults = successful.filter((result) => isComparisonMission(result.evaluation.missionKind)
    && !result.evaluation.loopComplete);
  const completionLabeled = successful.filter((result) => result.testCase.expectedLoopComplete != null);
  const scoreValues = successful.map((result) => result.qualityScore);
  return {
    requestSuccess: successful.length,
    strictPass: successful.filter((result) => result.evaluation.pass).length,
    acceptableMission: successful.filter((result) => result.dimensions.mission).length,
    forbiddenMission: successful.filter((result) => !result.dimensions.allowed).length,
    coachCoreComplete: successful.filter((result) => result.dimensions.coachCore).length,
    missionSupportComplete: successful.filter((result) => result.dimensions.missionSupport).length,
    fixPointPresent: successful.filter((result) => result.dimensions.fixPoint).length,
    completionAccuracy: completionLabeled.length === 0
      ? null
      : ratio(completionLabeled.filter((result) => result.dimensions.completion).length, completionLabeled.length),
    contentScaffoldRate: contentResults.length === 0
      ? null
      : ratio(contentResults.filter((result) => result.evaluation.hasScaffold).length, contentResults.length),
    groundedComparisonRate: comparisonResults.length === 0
      ? null
      : ratio(comparisonResults.filter((result) => result.evaluation.hasComparison).length, comparisonResults.length),
    averageQualityScore: scoreValues.length === 0
      ? null
      : round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length),
    averageRefinementCount: successful.length === 0
      ? null
      : round(successful.reduce((sum, result) => sum + (result.stored?.actual?.refinementExpressions?.length ?? 0), 0) / successful.length),
    firstFixMismatchWarnings: successful.reduce(
      (sum, result) => sum + result.evaluation.warnings.filter((warning) => warning.code === "first_fix_mission_mismatch").length,
      0
    ),
    failureCounts: countCodes(successful.flatMap((result) => result.evaluation.failures)),
    missionDistribution: countValues(successful.map((result) => result.evaluation.missionKind ?? "(none)")),
    latencyMs: latencySummary(latencies)
  };
}

function comparePairs(beforeResults, afterResults) {
  const afterByName = new Map(afterResults.map((result) => [result.testCase.name, result]));
  const pairs = beforeResults.map((left) => {
    const right = afterByName.get(left.testCase.name);
    const delta = (right?.qualityScore ?? 0) - left.qualityScore;
    return {
      caseId: left.testCase.caseId ?? null,
      name: left.testCase.name,
      category: left.testCase.category ?? null,
      beforeMission: left.evaluation?.missionKind ?? null,
      afterMission: right?.evaluation?.missionKind ?? null,
      beforeScore: left.qualityScore,
      afterScore: right?.qualityScore ?? 0,
      delta,
      beforeFailures: left.evaluation?.failures.map((failure) => failure.code) ?? ["request_failed"],
      afterFailures: right?.evaluation?.failures.map((failure) => failure.code) ?? ["request_failed"]
    };
  });
  return {
    improved: pairs.filter((pair) => pair.delta > 0).length,
    unchanged: pairs.filter((pair) => pair.delta === 0).length,
    regressed: pairs.filter((pair) => pair.delta < 0).length,
    totalScoreDelta: pairs.reduce((sum, pair) => sum + pair.delta, 0),
    largestImprovements: pairs.filter((pair) => pair.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10),
    regressions: pairs.filter((pair) => pair.delta < 0).sort((a, b) => a.delta - b.delta),
    missionChanges: pairs.filter((pair) => pair.beforeMission !== pair.afterMission).map((pair) => ({
      caseId: pair.caseId,
      name: pair.name,
      category: pair.category,
      beforeMission: pair.beforeMission,
      afterMission: pair.afterMission
    }))
  };
}

function isContentMission(value) {
  return value === "SLOT" || value === "TASK_RESET";
}

function isComparisonMission(value) {
  return value === "LANGUAGE_FIX" || value === "GRAMMAR_FIX" || value === "STRUCTURE_FIX";
}

function latencySummary(values) {
  if (values.length === 0) {
    return { count: 0, mean: null, p50: null, p95: null };
  }
  return {
    count: values.length,
    mean: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95)
  };
}

function percentile(values, ratioValue) {
  return values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratioValue) - 1))];
}

function countCodes(items) {
  return countValues(items.map((item) => item.code));
}

function countValues(values) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1]));
}

function ratio(numerator, denominator) {
  return round(numerator / denominator);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function parseArgs(args) {
  const parsed = { cases: null, before: null, after: null, output: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--cases") parsed.cases = args[++index];
    else if (arg === "--before") parsed.before = args[++index];
    else if (arg === "--after") parsed.after = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!parsed.cases || !parsed.before || !parsed.after) {
    throw new Error("Usage: --cases <path> --before <report> --after <report> [--output <path>]");
  }
  return parsed;
}
