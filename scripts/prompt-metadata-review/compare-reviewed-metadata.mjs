import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const beforePath = path.join(root, ".codex_logs", "prompt-metadata-review", "before.json");
const afterPath = path.join(root, "infra", "mysql", "data", "prompt-task-metadata-reviewed.json");
const outputPath = path.join(root, ".codex_logs", "prompt-metadata-review", "comparison.json");

const before = JSON.parse(await fs.readFile(beforePath, "utf8"));
const after = JSON.parse(await fs.readFile(afterPath, "utf8"));
const beforeById = new Map(before.map((item) => [item.promptId, item]));
const changes = [];

for (const current of after) {
  const previous = beforeById.get(current.promptId);
  if (!previous) {
    changes.push({ promptId: current.promptId, changeTypes: ["NEW_REVIEW"], before: null, after: current });
    continue;
  }
  const changeTypes = [];
  if (previous.answerMode !== current.answerMode) changeTypes.push("ANSWER_MODE");
  if (previous.minimumDepthSlots !== current.minimumDepthSlots) changeTypes.push("MINIMUM_DEPTH");
  if (!sameArray(previous.requiredSlots, current.requiredSlots)) changeTypes.push("REQUIRED_SLOTS");
  if (!sameArray(previous.optionalSlots, current.optionalSlots)) changeTypes.push("OPTIONAL_SLOTS");
  if (changeTypes.length > 0) {
    changes.push({
      promptId: current.promptId,
      difficulty: current.difficulty,
      questionEn: current.questionEn,
      changeTypes,
      before: pickMetadata(previous),
      after: pickMetadata(current),
      rationale: current.rationale
    });
  }
}

const comparison = {
  total: after.length,
  changedPrompts: changes.length,
  unchangedPrompts: after.length - changes.length,
  changeTypeCounts: countFlat(changes.flatMap((item) => item.changeTypes)),
  beforeDepthByDifficulty: depthByDifficulty(after, beforeById),
  afterDepthByDifficulty: depthByDifficulty(after),
  beforeModeCounts: count(before, (item) => item.answerMode),
  afterModeCounts: count(after, (item) => item.answerMode),
  changes
};

await fs.writeFile(outputPath, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  total: comparison.total,
  changedPrompts: comparison.changedPrompts,
  unchangedPrompts: comparison.unchangedPrompts,
  changeTypeCounts: comparison.changeTypeCounts,
  beforeDepthByDifficulty: comparison.beforeDepthByDifficulty,
  afterDepthByDifficulty: comparison.afterDepthByDifficulty,
  beforeModeCounts: comparison.beforeModeCounts,
  afterModeCounts: comparison.afterModeCounts
}, null, 2));
console.log(`Full comparison: ${path.relative(root, outputPath)}`);

function sameArray(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function pickMetadata(item) {
  return {
    answerMode: item.answerMode,
    requiredSlots: item.requiredSlots,
    optionalSlots: item.optionalSlots,
    minimumDepthSlots: item.minimumDepthSlots
  };
}

function count(items, keyOf) {
  return Object.fromEntries([...items.reduce((map, item) => {
    const key = keyOf(item);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function countFlat(values) {
  return count(values, (value) => value);
}

function depthByDifficulty(sourceRows, metadataById = null) {
  return count(sourceRows, (item) => {
    const metadata = metadataById?.get(item.promptId) ?? item;
    return `${item.difficulty}:${metadata.minimumDepthSlots}`;
  });
}
