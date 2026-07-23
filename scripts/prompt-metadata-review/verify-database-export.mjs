import fs from "node:fs/promises";
import path from "node:path";

const [profilesFile, slotsFile] = process.argv.slice(2);
if (!profilesFile || !slotsFile) {
  throw new Error("Usage: node verify-database-export.mjs <profiles.tsv> <slots.tsv>");
}

const root = process.cwd();
const metadata = JSON.parse(await fs.readFile(
  path.join(root, "infra", "mysql", "data", "prompt-task-metadata-reviewed.json"),
  "utf8"
));
const actualProfiles = lines(await fs.readFile(path.resolve(root, profilesFile), "utf8"));
const actualSlots = lines(await fs.readFile(path.resolve(root, slotsFile), "utf8"));

const expectedProfiles = metadata.map((item) => [
  item.promptId,
  item.answerMode,
  item.expectedTense,
  item.expectedPov,
  String(item.minimumDepthSlots),
  Buffer.from(item.rationaleKo, "utf8").toString("hex").toUpperCase()
].join("\t"));
const expectedSlots = metadata.flatMap((item) => [
  ...item.requiredSlots.map((slot, index) => [item.promptId, slot, "REQUIRED", index + 1].join("\t")),
  ...item.optionalSlots.map((slot, index) => [item.promptId, slot, "OPTIONAL", index + 1].join("\t"))
]);

assertEqual("profiles", expectedProfiles, actualProfiles);
assertEqual("slot assignments", expectedSlots, actualSlots);
console.log(`Database export exactly matches ${expectedProfiles.length} reviewed profiles and ${expectedSlots.length} active slot assignments.`);

function lines(value) {
  return value.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
}

function assertEqual(label, expected, actual) {
  const expectedSorted = [...expected].sort();
  const actualSorted = [...actual].sort();
  if (expectedSorted.length !== actualSorted.length) {
    throw new Error(`${label}: expected ${expectedSorted.length} rows, found ${actualSorted.length}`);
  }
  for (let index = 0; index < expectedSorted.length; index++) {
    if (expectedSorted[index] !== actualSorted[index]) {
      throw new Error(`${label}: mismatch at row ${index + 1}\nexpected: ${expectedSorted[index]}\nactual:   ${actualSorted[index]}`);
    }
  }
}
