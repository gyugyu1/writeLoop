import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputDir = path.join(root, ".codex_logs", "prompt-metadata-review", "input");
const auditsDir = path.join(root, "scripts", "prompt-metadata-review", "audits");
const allowedModes = new Set([
  "ROUTINE",
  "PREFERENCE",
  "GOAL_PLAN",
  "PROBLEM_SOLUTION",
  "BALANCED_OPINION",
  "OPINION_REASON",
  "CHANGE_REFLECTION",
  "GENERAL_DESCRIPTION"
]);
const allowedSlots = new Set([
  "ACTION", "CHOICE", "GOAL", "PROBLEM", "OPINION", "PLAN", "SOLUTION",
  "ADVANTAGE", "DISADVANTAGE", "BEFORE_STATE", "NOW_STATE", "CHANGE_CAUSE",
  "ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "REASON", "DETAIL", "EXAMPLE",
  "FEELING", "RESULT"
]);

const partFiles = (await fs.readdir(inputDir))
  .filter((name) => /^part-\d{2}\.json$/.test(name))
  .sort();
const auditFiles = (await fs.readdir(auditsDir))
  .filter((name) => /^audit-\d{2}\.json$/.test(name))
  .sort();

if (partFiles.length !== 12) {
  throw new Error(`Expected 12 source parts, found ${partFiles.length}`);
}
if (auditFiles.length !== 6) {
  throw new Error(`Expected 6 audit files, found ${auditFiles.length}`);
}

const promptsByPart = new Map();
const partByPrompt = new Map();
for (const file of partFiles) {
  const part = file.match(/(\d{2})/)[1];
  const prompts = JSON.parse(await fs.readFile(path.join(inputDir, file), "utf8"));
  promptsByPart.set(part, prompts);
  for (const prompt of prompts) {
    if (partByPrompt.has(prompt.promptId)) {
      throw new Error(`Duplicate source prompt ${prompt.promptId}`);
    }
    partByPrompt.set(prompt.promptId, part);
  }
}

const errors = [];
const auditedParts = new Set();
const issueIds = new Set();
let auditedCount = 0;
let issueCount = 0;

for (const file of auditFiles) {
  const audit = JSON.parse(await fs.readFile(path.join(auditsDir, file), "utf8"));
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    errors.push(`${file}: top level must be an object`);
    continue;
  }
  if (!Array.isArray(audit.auditedParts) || audit.auditedParts.length === 0) {
    errors.push(`${file}: auditedParts must be a non-empty array`);
    continue;
  }

  let expectedCount = 0;
  const ownedParts = new Set();
  for (const part of audit.auditedParts) {
    if (!promptsByPart.has(part)) {
      errors.push(`${file}: unknown audited part ${part}`);
      continue;
    }
    if (auditedParts.has(part)) {
      errors.push(`${file}: part ${part} was audited more than once`);
    }
    auditedParts.add(part);
    ownedParts.add(part);
    expectedCount += promptsByPart.get(part).length;
  }
  if (audit.auditedCount !== expectedCount) {
    errors.push(`${file}: auditedCount ${audit.auditedCount} does not match assigned source count ${expectedCount}`);
  }
  auditedCount += expectedCount;

  if (!Array.isArray(audit.issues)) {
    errors.push(`${file}: issues must be an array`);
    continue;
  }
  issueCount += audit.issues.length;
  for (const [index, issue] of audit.issues.entries()) {
    const label = `${file}.issues[${index}]`;
    if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
      errors.push(`${label}: issue must be an object`);
      continue;
    }
    const sourcePart = partByPrompt.get(issue.promptId);
    if (!sourcePart) {
      errors.push(`${label}: unknown promptId ${issue.promptId}`);
    } else if (!ownedParts.has(sourcePart)) {
      errors.push(`${label}: prompt ${issue.promptId} belongs to unassigned part ${sourcePart}`);
    }
    if (issueIds.has(issue.promptId)) {
      errors.push(`${label}: duplicate issue for ${issue.promptId}`);
    }
    issueIds.add(issue.promptId);
    if (!new Set(["ERROR", "WARNING"]).has(issue.severity)) {
      errors.push(`${label}: severity must be ERROR or WARNING`);
    }
    validateRecommendation(label, issue.recommended, errors);
    if (typeof issue.reason !== "string" || issue.reason.trim().length < 25) {
      errors.push(`${label}: reason must explain the audit finding`);
    }
  }
}

for (const part of promptsByPart.keys()) {
  if (!auditedParts.has(part)) {
    errors.push(`Part ${part} has no independent audit`);
  }
}
if (auditedCount !== partByPrompt.size) {
  errors.push(`Audited source count ${auditedCount} does not match prompt count ${partByPrompt.size}`);
}

if (errors.length > 0) {
  console.error(`Audit coverage validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Validated independent audit coverage for ${auditedCount} prompts across ${auditedParts.size} parts.`);
console.log(`Auditors reported ${issueCount} unique issue(s).`);

function validateRecommendation(label, recommendation, target) {
  if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation)) {
    target.push(`${label}: recommended must be an object`);
    return;
  }
  if (!allowedModes.has(recommendation.answerMode)) {
    target.push(`${label}: invalid recommended answerMode ${recommendation.answerMode}`);
  }
  for (const field of ["requiredSlots", "optionalSlots"]) {
    if (!Array.isArray(recommendation[field])) {
      target.push(`${label}: recommended.${field} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const slot of recommendation[field]) {
      if (!allowedSlots.has(slot)) {
        target.push(`${label}: recommended.${field} contains invalid slot ${slot}`);
      }
      if (seen.has(slot)) {
        target.push(`${label}: recommended.${field} duplicates ${slot}`);
      }
      seen.add(slot);
    }
  }
  const required = new Set(recommendation.requiredSlots ?? []);
  for (const slot of recommendation.optionalSlots ?? []) {
    if (required.has(slot)) {
      target.push(`${label}: recommended slot ${slot} appears in both roles`);
    }
  }
  if ((recommendation.requiredSlots?.length ?? 0) === 0) {
    target.push(`${label}: recommended.requiredSlots must not be empty`);
  }
  if (!Number.isInteger(recommendation.minimumDepthSlots)
      || recommendation.minimumDepthSlots < 0
      || recommendation.minimumDepthSlots > 2) {
    target.push(`${label}: recommended.minimumDepthSlots must be 0, 1, or 2`);
  }
}
