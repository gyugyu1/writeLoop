import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const options = parseArgs(process.argv.slice(2));
const reportRoot = path.resolve(
  process.cwd(),
  options.reportRoot ?? ".codex_logs/feedback-slot-specificity-30-2026-07-17"
);
const runCount = Math.max(1, Number(options.runs ?? 3));
const reports = [];

for (let run = 1; run <= runCount; run += 1) {
  const reportPath = path.join(reportRoot, `run-${run}`, "latest.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  reports.push({ run, reportPath, report });
}

const runSummaries = reports.map(({ run, reportPath, report }) => ({
  run,
  reportPath: path.relative(process.cwd(), reportPath),
  ...summarizeResults(report.results ?? [])
}));
const allResults = reports.flatMap(({ run, report }) =>
  (report.results ?? []).map((result) => ({ ...result, run }))
);

const summary = {
  reportRoot: path.relative(process.cwd(), reportRoot),
  runCount,
  totalRequests: allResults.length,
  requestFailures: allResults.filter(isRequestFailure).length,
  evaluatedResponses: allResults.filter((result) => !isRequestFailure(result)).length,
  runs: runSummaries,
  aggregate: summarizeResults(allResults),
  consistency: summarizeConsistency(reports)
};

const output = `${JSON.stringify(summary, null, 2)}\n`;
if (options.output) {
  const outputPath = path.resolve(process.cwd(), options.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, "utf8");
  console.log(`Summary: ${path.relative(process.cwd(), outputPath)}`);
} else {
  process.stdout.write(output);
}

function summarizeResults(results) {
  const evaluated = results.filter((result) => !isRequestFailure(result));
  const generic = evaluated.filter((result) => result.category === "GENERIC_CONTENT");
  const concrete = evaluated.filter((result) => result.category === "COMPLETE");

  return {
    total: results.length,
    requestFailures: results.filter(isRequestFailure).length,
    evaluated: evaluated.length,
    passed: evaluated.filter((result) => result.pass === true).length,
    generic: {
      evaluated: generic.length,
      passed: generic.filter((result) => result.pass === true).length,
      completedTooEarly: generic.filter((result) => result.loopComplete === true).length
    },
    concrete: {
      evaluated: concrete.length,
      passed: concrete.filter((result) => result.pass === true).length,
      unnecessarilyKeptOpen: concrete.filter((result) => result.loopComplete !== true).length
    },
    bySlot: Object.fromEntries(
      ["BEFORE_STATE", "REASON", "PLACE"].map((slot) => {
        const slotResults = evaluated.filter((result) => result.name?.startsWith(`${slot} `));
        return [slot, {
          evaluated: slotResults.length,
          passed: slotResults.filter((result) => result.pass === true).length,
          genericPassed: slotResults.filter((result) =>
            result.category === "GENERIC_CONTENT" && result.pass === true
          ).length,
          concretePassed: slotResults.filter((result) =>
            result.category === "COMPLETE" && result.pass === true
          ).length
        }];
      })
    )
  };
}

function summarizeConsistency(reportEntries) {
  const byName = new Map();
  for (const { run, report } of reportEntries) {
    for (const result of report.results ?? []) {
      const entries = byName.get(result.name) ?? [];
      entries.push({ run, result });
      byName.set(result.name, entries);
    }
  }

  let comparableCases = 0;
  let stableCases = 0;
  const unstableCases = [];
  for (const [name, entries] of byName) {
    if (entries.length !== reportEntries.length || entries.some(({ result }) => isRequestFailure(result))) {
      continue;
    }
    comparableCases += 1;
    const signatures = new Set(entries.map(({ result }) =>
      `${result.missionKind ?? "(none)"}/${result.targetSlot ?? "(none)"}/${result.loopComplete === true}`
    ));
    if (signatures.size === 1) {
      stableCases += 1;
    } else {
      unstableCases.push({
        name,
        outcomes: entries.map(({ run, result }) => ({
          run,
          missionKind: result.missionKind,
          targetSlot: result.targetSlot,
          loopComplete: result.loopComplete
        }))
      });
    }
  }

  return { comparableCases, stableCases, unstableCases };
}

function isRequestFailure(result) {
  return (result.failures ?? []).some((failure) => failure.code === "request_failed");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--report-root") {
      parsed.reportRoot = args[++index];
    } else if (arg === "--runs") {
      parsed.runs = args[++index];
    } else if (arg === "--output") {
      parsed.output = args[++index];
    }
  }
  return parsed;
}
