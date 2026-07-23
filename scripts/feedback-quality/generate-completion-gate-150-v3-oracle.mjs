import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = path.resolve(
  process.cwd(),
  "scripts/feedback-quality/cases.completion-gate-150-v2.json"
);
const outputPath = path.resolve(
  process.cwd(),
  "scripts/feedback-quality/cases.completion-gate-150-v3.json"
);

const revisions = new Map([
  ["completion-gate-004", {
    answer: "I usually relax after dinner because it is nice.",
    targetSlot: "REASON",
    rationale: "ACTION is concrete, while the required REASON is attempted only as the vague phrase 'because it is nice'."
  }],
  ["completion-gate-005", {
    answer: "After dinner, I usually washes the dishes because it helps me reset."
  }],
  ["completion-gate-016", {
    answer: "I usually take a nap somewhere on weekends.",
    targetSlot: "PLACE",
    rationale: "ACTION is concrete, while the required PLACE is attempted only as the placeholder 'somewhere'."
  }],
  ["completion-gate-017", {
    answer: "On weekends, I usually taking a nap at home."
  }],
  ["completion-gate-136", {
    answer: "I used to want many friends, but now I prefer fewer friends because life changed.",
    targetSlot: "CHANGE_CAUSE",
    rationale: "Both friendship states are concrete, while the required CHANGE_CAUSE is attempted only as the vague phrase 'life changed'."
  }],
  ["completion-gate-137", {
    answer: "I used to want many friends, but now I prefers a few people I can trust because one close friend supported me during a difficult time."
  }],
  ["completion-gate-138", {
    answer: "I used to value having many friends, but now I prefer a few people I can trust because a close friend supported me during a difficult year."
  }]
]);

const weekendCaseIds = new Set([
  "completion-gate-013",
  "completion-gate-014",
  "completion-gate-015",
  "completion-gate-016",
  "completion-gate-017",
  "completion-gate-018"
]);

const cases = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const revisedCases = cases.map((testCase) => {
  const revision = revisions.get(testCase.caseId);
  const next = {
    ...testCase,
    ...(weekendCaseIds.has(testCase.caseId)
      ? { promptQuestionIncludesAny: ["usually do on weekends"] }
      : {}),
    ...(revision?.answer ? { answer: revision.answer } : {})
  };

  if (!revision?.targetSlot) {
    return next;
  }

  return {
    ...next,
    expectedMissionKinds: ["SLOT"],
    expectedTargetSlots: [revision.targetSlot],
    expectedBehavior: `Keep the loop open, target ${revision.targetSlot}, and make the vague content already occupying that slot concrete with a usable scaffold.`,
    oracleRevision: "v3-explicit-question-slot-alignment",
    oracleRationale: revision.rationale
  };
});

if (revisedCases.length !== 150) {
  throw new Error(`Expected 150 cases, found ${revisedCases.length}`);
}

for (const caseId of revisions.keys()) {
  if (!revisedCases.some((testCase) => testCase.caseId === caseId)) {
    throw new Error(`Missing source case: ${caseId}`);
  }
}

await fs.writeFile(outputPath, `${JSON.stringify(revisedCases, null, 2)}\n`, "utf8");
console.log(`Wrote ${revisedCases.length} cases to ${path.relative(process.cwd(), outputPath)}`);
console.log(`Adjusted ${revisions.size} cases for the three explicit question-slot contracts`);
