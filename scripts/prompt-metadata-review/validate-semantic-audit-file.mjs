import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requestedPath = process.argv[2];
if (!requestedPath) {
  throw new Error("Usage: node scripts/prompt-metadata-review/validate-semantic-audit-file.mjs <audit-file>");
}

const auditPath = path.resolve(root, requestedPath);
const match = path.basename(auditPath).match(/^part-(\d{2})\.json$/);
if (!match) {
  throw new Error(`Unexpected audit filename: ${path.basename(auditPath)}`);
}

const part = match[1];
const reviewPath = path.join(root, "scripts", "prompt-metadata-review", "reviews", `part-${part}.json`);
const semanticDir = path.join(root, "scripts", "prompt-metadata-review", "semantic-reviews");
const reviews = JSON.parse(await fs.readFile(reviewPath, "utf8"));
const primary = [
  ...JSON.parse(await fs.readFile(path.join(semanticDir, `part-${part}-a.json`), "utf8")),
  ...JSON.parse(await fs.readFile(path.join(semanticDir, `part-${part}-b.json`), "utf8"))
];
const audits = JSON.parse(await fs.readFile(auditPath, "utf8"));
const errors = [];

if (!Array.isArray(audits)) {
  errors.push("Audit must be a JSON array");
} else if (audits.length !== reviews.length) {
  errors.push(`Expected ${reviews.length} audit rows, found ${audits.length}`);
}
if (primary.length !== reviews.length) {
  errors.push(`Primary semantic review has ${primary.length} rows, expected ${reviews.length}`);
}

const primaryById = new Map(primary.map((item) => [item.promptId, item]));
let changeCount = 0;
for (const [index, audit] of (Array.isArray(audits) ? audits : []).entries()) {
  const expectedId = reviews[index]?.promptId;
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    errors.push(`audit[${index}] must be an object`);
    continue;
  }
  if (audit.promptId !== expectedId) {
    errors.push(`audit[${index}] expected ${expectedId}, found ${audit.promptId}`);
  }
  if (!["PASS", "CHANGE"].includes(audit.verdict)) {
    errors.push(`${audit.promptId}: verdict must be PASS or CHANGE`);
  }
  if (typeof audit.auditReasonKo !== "string"
      || audit.auditReasonKo.trim().length < 15
      || !/[가-힣]/.test(audit.auditReasonKo)) {
    errors.push(`${audit.promptId}: auditReasonKo must be a specific Korean explanation`);
  }
  const allowedFields = new Set([
    "promptId",
    "verdict",
    "auditReasonKo",
    "replacementSlotContracts",
    "reviewOverride"
  ]);
  for (const field of Object.keys(audit)) {
    if (!allowedFields.has(field)) {
      errors.push(`${audit.promptId}: unexpected field ${field}`);
    }
  }
  if (audit.verdict === "PASS") {
    if (audit.replacementSlotContracts || audit.reviewOverride) {
      errors.push(`${audit.promptId}: PASS cannot include replacements or overrides`);
    }
    continue;
  }

  changeCount++;
  if (!audit.replacementSlotContracts && !audit.reviewOverride) {
    errors.push(`${audit.promptId}: CHANGE requires a replacement or reviewOverride`);
  }
  if (audit.reviewOverride) {
    for (const field of [
      "answerMode",
      "requiredSlots",
      "optionalSlots",
      "minimumDepthSlots",
      "rationale",
      "rationaleKo"
    ]) {
      if (!(field in audit.reviewOverride)) {
        errors.push(`${audit.promptId}: reviewOverride is missing ${field}`);
      }
    }
  }
  const primaryItem = primaryById.get(audit.promptId);
  const finalSlots = audit.reviewOverride
      && Array.isArray(audit.reviewOverride.requiredSlots)
      && Array.isArray(audit.reviewOverride.optionalSlots)
    ? [...audit.reviewOverride.requiredSlots, ...audit.reviewOverride.optionalSlots]
    : Object.keys(primaryItem?.slotContracts ?? {});
  if (audit.replacementSlotContracts) {
    for (const [slot, contract] of Object.entries(audit.replacementSlotContracts)) {
      if (!finalSlots.includes(slot)) {
        errors.push(`${audit.promptId}: replacement targets unconfigured slot ${slot}`);
      }
      for (const field of [
        "semanticRoleEn",
        "satisfiedWhenEn",
        "semanticRoleKo",
        "satisfiedWhenKo"
      ]) {
        if (typeof contract?.[field] !== "string" || contract[field].trim().length < 4) {
          errors.push(`${audit.promptId}/${slot}: replacement ${field} is incomplete`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`${path.basename(auditPath)} failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`${path.basename(auditPath)}: ${audits.length} prompts, ${changeCount} change(s)`);
