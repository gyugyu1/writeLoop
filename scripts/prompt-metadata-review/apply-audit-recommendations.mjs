import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reviewsDir = path.join(root, "scripts", "prompt-metadata-review", "reviews");
const auditsDir = path.join(root, "scripts", "prompt-metadata-review", "audits");
const reviewFiles = (await fs.readdir(reviewsDir))
  .filter((name) => /^part-\d{2}\.json$/.test(name))
  .sort();
const auditFiles = (await fs.readdir(auditsDir))
  .filter((name) => /^audit-\d{2}\.json$/.test(name))
  .sort();

if (reviewFiles.length !== 12 || auditFiles.length !== 6) {
  throw new Error(`Expected 12 review files and 6 audit files, found ${reviewFiles.length} and ${auditFiles.length}`);
}

const recommendations = new Map();
for (const file of auditFiles) {
  const audit = JSON.parse(await fs.readFile(path.join(auditsDir, file), "utf8"));
  for (const issue of audit.issues ?? []) {
    if (recommendations.has(issue.promptId)) {
      throw new Error(`Duplicate audit recommendation for ${issue.promptId}`);
    }
    recommendations.set(issue.promptId, issue);
  }
}

const applied = new Set();
for (const file of reviewFiles) {
  const filePath = path.join(reviewsDir, file);
  const reviews = JSON.parse(await fs.readFile(filePath, "utf8"));
  let changed = false;
  const updated = reviews.map((review) => {
    const issue = recommendations.get(review.promptId);
    if (!issue) {
      return review;
    }
    applied.add(review.promptId);
    changed = true;
    return {
      ...review,
      answerMode: issue.recommended.answerMode,
      requiredSlots: issue.recommended.requiredSlots,
      optionalSlots: issue.recommended.optionalSlots,
      minimumDepthSlots: issue.recommended.minimumDepthSlots,
      rationale: issue.reason
    };
  });
  if (changed) {
    await fs.writeFile(filePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  }
}

const missing = [...recommendations.keys()].filter((promptId) => !applied.has(promptId));
if (missing.length > 0) {
  throw new Error(`Audit recommendations refer to missing reviews: ${missing.join(", ")}`);
}

console.log(`Applied ${applied.size} independent audit recommendation(s) to the reviewed metadata.`);
