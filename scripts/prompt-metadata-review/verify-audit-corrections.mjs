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

const reviewById = new Map();
for (const file of reviewFiles) {
  const reviews = JSON.parse(await fs.readFile(path.join(reviewsDir, file), "utf8"));
  reviews.forEach((review) => reviewById.set(review.promptId, review));
}

const errors = [];
let issueCount = 0;
for (const file of auditFiles) {
  const audit = JSON.parse(await fs.readFile(path.join(auditsDir, file), "utf8"));
  for (const issue of audit.issues ?? []) {
    issueCount++;
    const review = reviewById.get(issue.promptId);
    if (!review) {
      errors.push(`${file}: missing reviewed prompt ${issue.promptId}`);
      continue;
    }
    for (const field of ["answerMode", "requiredSlots", "optionalSlots", "minimumDepthSlots"]) {
      if (JSON.stringify(review[field]) !== JSON.stringify(issue.recommended[field])) {
        errors.push(`${issue.promptId}: ${field} does not match the independent audit recommendation`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Audit correction verification failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Verified all ${issueCount} independent audit recommendation(s) in the reviewed metadata.`);
