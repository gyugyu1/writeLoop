import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const reportPath = path.resolve(
  process.cwd(),
  process.argv[2] ?? ".codex_logs/feedback-completion-gate-150/latest.json"
);
const outputPath = path.resolve(
  process.cwd(),
  process.argv[3] ?? ".codex_logs/feedback-completion-gate-150/summary.json"
);

const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
const results = report.results ?? [];
const contentMissionKinds = new Set(["SLOT", "TASK_RESET"]);

const expectedOpen = results.filter((result) => result.expectedLoopComplete === false);
const offTopic = byCategory("OFF_TOPIC");
const fragment = byCategory("FRAGMENT");
const grammar = byCategory("GRAMMAR");
const complete = byCategory("COMPLETE");
const targetExpected = results.filter((result) => result.expectedTargetSlots?.length > 0);
const actualContentMissions = results.filter((result) => (
  !result.loopComplete && contentMissionKinds.has(result.missionKind)
));

const summary = {
  source: path.relative(process.cwd(), reportPath).replaceAll("\\", "/"),
  generatedAt: new Date().toISOString(),
  runtime: report.runtime,
  overall: {
    total: results.length,
    passed: report.passed,
    failed: report.failed,
    passRate: rate(report.passed, results.length),
    requestFailures: results.flatMap((result) => result.failures ?? [])
      .filter((failure) => failure.code === "request_failed").length,
    latencyMs: report.latencyMs
  },
  releaseGates: {
    earlyCompletion: {
      target: "0 cases",
      actualCount: expectedOpen.filter((result) => result.loopComplete).length,
      totalExpectedOpen: expectedOpen.length,
      rate: rate(expectedOpen.filter((result) => result.loopComplete).length, expectedOpen.length),
      passed: expectedOpen.every((result) => !result.loopComplete)
    },
    offTopicTaskReset: ratioGate(
      offTopic.filter((result) => !result.loopComplete && result.missionKind === "TASK_RESET").length,
      offTopic.length,
      100
    ),
    grammarClassification: ratioGate(
      grammar.filter((result) => !result.loopComplete && result.missionKind === "LANGUAGE_FIX").length,
      grammar.length,
      95
    ),
    contentMissionScaffold: ratioGate(
      actualContentMissions.filter((result) => result.hasScaffold).length,
      actualContentMissions.length,
      100
    )
  },
  supportingMetrics: {
    canonicalTargetSlot: ratio(
      targetExpected.filter((result) => result.expectedTargetSlots.includes(result.targetSlot)).length,
      targetExpected.length
    ),
    strongAnswerCompletion: ratio(
      complete.filter((result) => result.loopComplete).length,
      complete.length
    ),
    fragmentStructureFix: ratio(
      fragment.filter((result) => !result.loopComplete && result.missionKind === "LANGUAGE_FIX").length,
      fragment.length
    ),
    groundedGrammarRepair: ratio(
      grammar.filter((result) => result.pass).length,
      grammar.length
    ),
    intendedContentEndToEndScaffold: ratio(
      results.filter((result) => ["MISSING_SLOT", "GENERIC_CONTENT"].includes(result.category)
        && !result.loopComplete
        && result.hasScaffold).length,
      results.filter((result) => ["MISSING_SLOT", "GENERIC_CONTENT"].includes(result.category)).length
    )
  },
  categories: [...new Set(results.map((result) => result.category))]
    .sort()
    .map(buildCategorySummary),
  contentScaffoldByMission: [...contentMissionKinds]
    .map((missionKind) => {
      const group = actualContentMissions.filter((result) => result.missionKind === missionKind);
      return {
        missionKind,
        total: group.length,
        withScaffold: group.filter((result) => result.hasScaffold).length,
        rate: rate(group.filter((result) => result.hasScaffold).length, group.length)
      };
    })
    .filter((row) => row.total > 0),
  failureCounts: report.failureCounts,
  topMissionConfusions: report.missionConfusions?.slice(0, 12) ?? [],
  topTargetSlotConfusions: report.targetSlotConfusions?.slice(0, 12) ?? []
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

function byCategory(category) {
  return results.filter((result) => result.category === category);
}

function buildCategorySummary(category) {
  const group = byCategory(category);
  const expectedTargets = group.filter((result) => result.expectedTargetSlots?.length > 0);
  return {
    category,
    total: group.length,
    passed: group.filter((result) => result.pass).length,
    passRate: rate(group.filter((result) => result.pass).length, group.length),
    loopComplete: group.filter((result) => result.loopComplete).length,
    expectedTargetCount: expectedTargets.length,
    targetMatch: expectedTargets.filter((result) => result.expectedTargetSlots.includes(result.targetSlot)).length,
    scaffoldPresent: group.filter((result) => result.hasScaffold).length
  };
}

function ratioGate(numerator, denominator, minimumPercent) {
  return {
    target: `>= ${minimumPercent}%`,
    numerator,
    denominator,
    rate: rate(numerator, denominator),
    passed: denominator > 0 && (numerator / denominator) * 100 >= minimumPercent
  };
}

function ratio(numerator, denominator) {
  return { numerator, denominator, rate: rate(numerator, denominator) };
}

function rate(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}
