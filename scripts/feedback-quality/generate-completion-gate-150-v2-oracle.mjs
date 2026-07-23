import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = path.resolve(
  process.cwd(),
  "scripts/feedback-quality/cases.completion-gate-150.json"
);
const outputPath = path.resolve(
  process.cwd(),
  "scripts/feedback-quality/cases.completion-gate-150-v2.json"
);

const GENERIC_SLOT_REVISION = "v2-generic-slot-concretization";

const revisions = new Map([
  ["completion-gate-010", revision(
    "DETAIL",
    "CHOICE",
    "The required CHOICE is present only as the placeholder 'something easy', so the learner should name the actual meal before adding another depth slot."
  )],
  ["completion-gate-022", revision(
    "REASON",
    "REASON",
    "The required REASON is present but 'it is nice' carries no specific cause, so the same REASON should be made concrete."
  )],
  ["completion-gate-028", revision(
    "DETAIL",
    "SOLUTION",
    "The required SOLUTION is represented only by 'somehow', so the next mission should specify the actual coping action."
  )],
  ["completion-gate-034", revision(
    "REASON",
    "REASON",
    "The required REASON is present as the vague phrase 'it is good for me'; it should be clarified before optional planning detail is requested."
  )],
  ["completion-gate-040", revision(
    "DETAIL",
    "PLAN",
    "The required PLAN is represented only by 'practice somehow', so the learner should name a concrete practice method."
  )],
  ["completion-gate-046", revision(
    "DETAIL",
    "BEFORE_STATE",
    "The first required comparison slot is only 'used to meet differently'; the earlier state should be described concretely before optional evidence is added."
  )],
  ["completion-gate-052", revision(
    "REASON",
    "REASON",
    "The opinion is clear, but the depth REASON is only 'it is important'; the same reason should be made informative."
  )],
  ["completion-gate-058", revision(
    "REASON",
    "CHANGE_CAUSE",
    "The required CHANGE_CAUSE is present only as 'an experience', so the learner should identify what experience caused the change."
  )],
  ["completion-gate-064", revision(
    "REASON",
    "REASON",
    "The required REASON is only 'that is better'; the learner should explain what makes putting the food away better."
  )],
  ["completion-gate-076", revision(
    "REASON",
    "REASON",
    "The required REASON is present only as 'it is nice', so it should be made specific instead of opening a different optional slot."
  )],
  ["completion-gate-082", revision(
    "DETAIL",
    "CHOICE",
    "The required CHOICE is still an unnamed placeholder, 'somewhere nice'; the learner should name the place first."
  )],
  ["completion-gate-088", revision(
    "DETAIL",
    "CHOICE",
    "The required CHOICE is still 'something delicious', so the learner should identify the food before adding preference details."
  )],
  ["completion-gate-094", revision(
    "DETAIL",
    "PLAN",
    "The required PLAN says only 'exercise more'; the next mission should make the exercise method or schedule concrete."
  )],
  ["completion-gate-100", revision(
    "DETAIL",
    "SOLUTION",
    "The required SOLUTION is represented only by 'handle it somehow', so the actual time-management action should be specified."
  )],
  ["completion-gate-106", revision(
    "DETAIL",
    "SOLUTION",
    "The required SOLUTION is only 'do something about it'; the learner should name the response to the delayed bus."
  )],
  ["completion-gate-112", revision(
    "DETAIL",
    "DISADVANTAGE",
    "The required DISADVANTAGE is present only as 'some problems', so that negative side should be made concrete."
  )],
  ["completion-gate-118", revision(
    "DETAIL",
    "DISADVANTAGE",
    "The required DISADVANTAGE is present only as 'can also be bad', so the drawback should be identified explicitly."
  )],
  ["completion-gate-124", revision(
    "REASON",
    "REASON",
    "The required REASON is only 'it is good', so the learner should explain what they like about spicy food."
  )],
  ["completion-gate-130", revision(
    "REASON",
    "CHANGE_CAUSE",
    "The required CHANGE_CAUSE is only 'life changed', so the event or experience behind the change should be specified."
  )],
  ["completion-gate-136", revision(
    "REASON",
    "CHANGE_CAUSE",
    "The before and now states are clear, but the configured depth requirement is still unmet; CHANGE_CAUSE is the highest-priority missing depth slot."
  )],
  ["completion-gate-142", revision(
    "SITUATION",
    "PLACE",
    "The required PLACE is only 'a nice area', which does not identify a location; the learner should provide a concrete place."
  )],
  ["completion-gate-148", revision(
    "REASON",
    "REASON",
    "The required REASON is only 'it is useful', so the learner should say what English is useful for."
  )]
]);

const cases = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const revisedCaseIds = new Set();

const revisedCases = cases.map((testCase) => {
  const override = revisions.get(testCase.caseId);
  if (!override) {
    return testCase;
  }

  if (testCase.category !== "GENERIC_CONTENT") {
    throw new Error(`${testCase.caseId} must remain a GENERIC_CONTENT case`);
  }

  revisedCaseIds.add(testCase.caseId);
  return {
    ...testCase,
    expectedMissionKinds: ["SLOT"],
    expectedTargetSlots: [override.targetSlot],
    expectedBehavior: `Keep the loop open, target ${override.targetSlot}, and make the vague content already occupying that slot concrete with a usable scaffold.`,
    oracleRevision: GENERIC_SLOT_REVISION,
    oracleRationale: override.rationale
  };
});

const missingCaseIds = [...revisions.keys()].filter((caseId) => !revisedCaseIds.has(caseId));
if (missingCaseIds.length > 0) {
  throw new Error(`Missing source cases: ${missingCaseIds.join(", ")}`);
}

if (revisedCases.length !== 150) {
  throw new Error(`Expected 150 cases, found ${revisedCases.length}`);
}

const invalidContentMissionCases = revisedCases.filter((testCase) => (
  ["MISSING_SLOT", "GENERIC_CONTENT"].includes(testCase.category)
  && (testCase.expectedMissionKinds?.length !== 1 || testCase.expectedMissionKinds[0] !== "SLOT")
));
if (invalidContentMissionCases.length > 0) {
  throw new Error(`Content cases must expect SLOT: ${invalidContentMissionCases.map((item) => item.caseId).join(", ")}`);
}

await fs.writeFile(outputPath, `${JSON.stringify(revisedCases, null, 2)}\n`, "utf8");
console.log(`Wrote ${revisedCases.length} cases to ${path.relative(process.cwd(), outputPath)}`);
console.log(`Revised ${revisedCaseIds.size} GENERIC_CONTENT oracle entries`);

function revision(_legacyFocusType, targetSlot, rationale) {
  return { targetSlot, rationale };
}
