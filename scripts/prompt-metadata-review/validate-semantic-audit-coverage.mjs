import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reviewDir = path.join(root, "scripts", "prompt-metadata-review", "reviews");
const semanticDir = path.join(root, "scripts", "prompt-metadata-review", "semantic-reviews");
const auditDir = path.join(root, "scripts", "prompt-metadata-review", "semantic-audits");
const rationalePath = path.join(root, "scripts", "prompt-metadata-review", "rationales-ko.json");
const resolutionPath = path.join(auditDir, "resolutions.json");

const auditFiles = (await fs.readdir(auditDir))
  .filter((name) => /^part-\d{2}\.json$/.test(name))
  .sort();
if (auditFiles.length !== 12) {
  throw new Error(`Expected 12 semantic audit files, found ${auditFiles.length}`);
}

const rationales = JSON.parse(await fs.readFile(rationalePath, "utf8"));
const rationaleById = new Map(rationales.map((item) => [item.promptId, item]));
const primaryById = new Map();
const reviewById = new Map();
for (let part = 1; part <= 12; part++) {
  const number = String(part).padStart(2, "0");
  const reviews = JSON.parse(
    await fs.readFile(path.join(reviewDir, `part-${number}.json`), "utf8")
  );
  const primary = [
    ...JSON.parse(await fs.readFile(path.join(semanticDir, `part-${number}-a.json`), "utf8")),
    ...JSON.parse(await fs.readFile(path.join(semanticDir, `part-${number}-b.json`), "utf8"))
  ];
  reviews.forEach((item) => reviewById.set(item.promptId, item));
  primary.forEach((item) => primaryById.set(item.promptId, item));
}

const changes = [];
const seenAuditIds = new Set();
let auditCount = 0;
for (const file of auditFiles) {
  const audits = JSON.parse(await fs.readFile(path.join(auditDir, file), "utf8"));
  for (const audit of audits) {
    auditCount++;
    if (seenAuditIds.has(audit.promptId)) {
      throw new Error(`Duplicate semantic audit promptId: ${audit.promptId}`);
    }
    seenAuditIds.add(audit.promptId);
    if (audit.verdict === "CHANGE") {
      changes.push(audit);
    }
  }
}
if (auditCount !== 1446) {
  throw new Error(`Expected 1446 semantic audit rows, found ${auditCount}`);
}

const resolutions = JSON.parse(await fs.readFile(resolutionPath, "utf8"));
const resolutionById = new Map();
for (const resolution of resolutions) {
  if (resolutionById.has(resolution.promptId)) {
    throw new Error(`Duplicate semantic audit resolution: ${resolution.promptId}`);
  }
  if (!["ACCEPTED", "REJECTED"].includes(resolution.decision)) {
    throw new Error(`${resolution.promptId}: resolution decision must be ACCEPTED or REJECTED`);
  }
  if (typeof resolution.reasonKo !== "string"
      || resolution.reasonKo.trim().length < 15
      || !/[가-힣]/.test(resolution.reasonKo)) {
    throw new Error(`${resolution.promptId}: resolution reasonKo must be a specific Korean explanation`);
  }
  resolutionById.set(resolution.promptId, resolution);
}

const changeIds = new Set(changes.map((item) => item.promptId));
for (const promptId of resolutionById.keys()) {
  if (!changeIds.has(promptId)) {
    throw new Error(`Resolution targets a prompt without a CHANGE verdict: ${promptId}`);
  }
}

let accepted = 0;
let rejected = 0;
for (const change of changes) {
  const resolution = resolutionById.get(change.promptId);
  if (!resolution) {
    throw new Error(`Unresolved semantic audit CHANGE: ${change.promptId}`);
  }
  if (resolution.decision === "REJECTED") {
    rejected++;
    continue;
  }
  accepted++;
  const primary = primaryById.get(change.promptId);
  if (!primary) {
    throw new Error(`Missing primary semantic review for ${change.promptId}`);
  }
  for (const [slot, replacement] of Object.entries(change.replacementSlotContracts ?? {})) {
    if (JSON.stringify(primary.slotContracts?.[slot]) !== JSON.stringify(replacement)) {
      throw new Error(`Accepted replacement was not applied: ${change.promptId}/${slot}`);
    }
  }
  if (change.reviewOverride) {
    const base = reviewById.get(change.promptId);
    const rationale = rationaleById.get(change.promptId);
    const effective = primary.reviewOverride ?? {
      ...base,
      rationaleKo: rationale?.rationaleKo
    };
    for (const field of [
      "answerMode",
      "requiredSlots",
      "optionalSlots",
      "minimumDepthSlots",
      "rationale",
      "rationaleKo"
    ]) {
      if (JSON.stringify(effective?.[field]) !== JSON.stringify(change.reviewOverride[field])) {
        throw new Error(`Accepted reviewOverride was not applied: ${change.promptId}/${field}`);
      }
    }
  }
}

console.log(
  `Semantic audits resolved: ${auditCount} prompts, ${changes.length} changes`
  + ` (${accepted} accepted, ${rejected} rejected)`
);
