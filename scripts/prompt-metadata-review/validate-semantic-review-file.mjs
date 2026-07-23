import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requestedPath = process.argv[2];
if (!requestedPath) {
  throw new Error("Usage: node scripts/prompt-metadata-review/validate-semantic-review-file.mjs <semantic-review-file>");
}

const semanticPath = path.resolve(root, requestedPath);
const match = path.basename(semanticPath).match(/^part-(\d{2})-([ab])\.json$/);
if (!match) {
  throw new Error(`Unexpected semantic review filename: ${path.basename(semanticPath)}`);
}

const part = match[1];
const half = match[2];
const reviewPath = path.join(
  root,
  "scripts",
  "prompt-metadata-review",
  "reviews",
  `part-${part}.json`
);
const reviews = JSON.parse(await fs.readFile(reviewPath, "utf8"));
const expected = half === "a" ? reviews.slice(0, 60) : reviews.slice(60);
const semantic = JSON.parse(await fs.readFile(semanticPath, "utf8"));
const errors = [];

if (!Array.isArray(semantic)) {
  errors.push("Semantic review must be a JSON array");
} else if (semantic.length !== expected.length) {
  errors.push(`Expected ${expected.length} prompts, found ${semantic.length}`);
}

const expectedById = new Map(expected.map((item) => [item.promptId, item]));
const seen = new Set();
let contractCount = 0;
let overrideCount = 0;

for (const [index, item] of (Array.isArray(semantic) ? semantic : []).entries()) {
  const label = `item[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    errors.push(`${label} must be an object`);
    continue;
  }
  if (expected[index]?.promptId !== item.promptId) {
    errors.push(
      `${label} must preserve prompt order`
      + ` (expected=${expected[index]?.promptId}, actual=${item.promptId})`
    );
  }
  for (const field of Object.keys(item)) {
    if (!["promptId", "slotContracts", "reviewOverride"].includes(field)) {
      errors.push(`${item.promptId}: unexpected root field ${field}`);
    }
  }
  const review = expectedById.get(item.promptId);
  if (!review) {
    errors.push(`${label} has unexpected promptId ${item.promptId}`);
    continue;
  }
  if (seen.has(item.promptId)) {
    errors.push(`${label} duplicates ${item.promptId}`);
  }
  seen.add(item.promptId);

  const effective = item.reviewOverride ?? review;
  if (item.reviewOverride) {
    overrideCount++;
    for (const field of [
      "answerMode",
      "requiredSlots",
      "optionalSlots",
      "minimumDepthSlots",
      "rationale",
      "rationaleKo"
    ]) {
      if (!(field in item.reviewOverride)) {
        errors.push(`${item.promptId}: reviewOverride is missing ${field}`);
      }
    }
  }
  const expectedSlots = [
    ...(effective.requiredSlots ?? []),
    ...(effective.optionalSlots ?? [])
  ];
  const contracts = item.slotContracts;
  if (!contracts || typeof contracts !== "object" || Array.isArray(contracts)) {
    errors.push(`${item.promptId}: slotContracts must be an object`);
    continue;
  }
  const actualSlots = Object.keys(contracts);
  const missing = expectedSlots.filter((slot) => !actualSlots.includes(slot));
  const unexpected = actualSlots.filter((slot) => !expectedSlots.includes(slot));
  if (missing.length > 0 || unexpected.length > 0) {
    errors.push(
      `${item.promptId}: slot keys mismatch`
      + ` (missing=${missing.join(",")}, unexpected=${unexpected.join(",")})`
    );
  }
  for (const slot of expectedSlots) {
    contractCount++;
    const contract = contracts[slot];
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      errors.push(`${item.promptId}/${slot}: contract must be an object`);
      continue;
    }
    const contractFields = [
      "semanticRoleEn",
      "satisfiedWhenEn",
      "semanticRoleKo",
      "satisfiedWhenKo"
    ];
    const unexpectedFields = Object.keys(contract).filter((field) => !contractFields.includes(field));
    if (unexpectedFields.length > 0) {
      errors.push(`${item.promptId}/${slot}: unexpected fields ${unexpectedFields.join(",")}`);
    }
    for (const field of contractFields) {
      const minimumLength = field.startsWith("semanticRole") ? 4 : 12;
      if (typeof contract[field] !== "string" || contract[field].trim().length < minimumLength) {
        errors.push(`${item.promptId}/${slot}: ${field} is missing or too short`);
      }
    }
    if (typeof contract.semanticRoleKo === "string"
        && !/[가-힣]/.test(contract.semanticRoleKo)) {
      errors.push(`${item.promptId}/${slot}: semanticRoleKo has no Korean text`);
    }
    if (typeof contract.satisfiedWhenKo === "string"
        && !/[가-힣]/.test(contract.satisfiedWhenKo)) {
      errors.push(`${item.promptId}/${slot}: satisfiedWhenKo has no Korean text`);
    }
  }
}

for (const item of expected) {
  if (!seen.has(item.promptId)) {
    errors.push(`Missing promptId ${item.promptId}`);
  }
}

if (errors.length > 0) {
  console.error(`${path.basename(semanticPath)} failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `${path.basename(semanticPath)}: ${semantic.length} prompts, `
  + `${contractCount} slot contracts, ${overrideCount} metadata override(s)`
);
