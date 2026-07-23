import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, ".codex_logs", "prompt-metadata-review", "input", "prompts-all.json");
const reviewsDir = path.join(root, "scripts", "prompt-metadata-review", "reviews");
const semanticReviewsDir = path.join(root, "scripts", "prompt-metadata-review", "semantic-reviews");
const rationalesKoPath = path.join(root, "scripts", "prompt-metadata-review", "rationales-ko.json");
const dataDir = path.join(root, "infra", "mysql", "data");
const combinedPath = path.join(dataDir, "prompt-task-metadata-reviewed.json");
const migrationPath = path.join(root, "infra", "mysql", "schema", "087-apply-manually-reviewed-prompt-task-metadata.sql");
const rationaleMigrationPath = path.join(root, "infra", "mysql", "schema", "088-add-prompt-task-review-rationale.sql");
const slotContractMigrationPath = path.join(root, "infra", "mysql", "schema", "093-add-prompt-slot-contracts.sql");

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
  "ACTION",
  "CHOICE",
  "GOAL",
  "PROBLEM",
  "OPINION",
  "PLAN",
  "SOLUTION",
  "ADVANTAGE",
  "DISADVANTAGE",
  "BEFORE_STATE",
  "NOW_STATE",
  "CHANGE_CAUSE",
  "ADDITIONAL_ACTION",
  "SPECIFIC_TIME",
  "PLACE",
  "REASON",
  "DETAIL",
  "EXAMPLE",
  "FEELING",
  "RESULT"
]);

const source = JSON.parse(await fs.readFile(inputPath, "utf8"));
const reviewFiles = (await fs.readdir(reviewsDir))
  .filter((name) => /^part-\d{2}\.json$/.test(name))
  .sort();

if (reviewFiles.length !== 12) {
  throw new Error(`Expected 12 review files, found ${reviewFiles.length}: ${reviewFiles.join(", ")}`);
}

const baseReviews = [];
for (const file of reviewFiles) {
  const items = JSON.parse(await fs.readFile(path.join(reviewsDir, file), "utf8"));
  if (!Array.isArray(items)) {
    throw new Error(`${file} must contain a JSON array`);
  }
  baseReviews.push(...items);
}

const rationalesKo = JSON.parse(await fs.readFile(rationalesKoPath, "utf8"));
const semanticReviewFiles = (await fs.readdir(semanticReviewsDir))
  .filter((name) => /^part-\d{2}-[ab]\.json$/.test(name))
  .sort();
if (semanticReviewFiles.length !== 24) {
  throw new Error(
    `Expected 24 semantic review files, found ${semanticReviewFiles.length}: ${semanticReviewFiles.join(", ")}`
  );
}
const semanticReviews = [];
for (const file of semanticReviewFiles) {
  const items = JSON.parse(await fs.readFile(path.join(semanticReviewsDir, file), "utf8"));
  if (!Array.isArray(items)) {
    throw new Error(`${file} must contain a JSON array`);
  }
  semanticReviews.push(...items);
}

const semanticById = new Map();
for (const [index, item] of semanticReviews.entries()) {
  const label = `semanticReview[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`${label} must be an object`);
  }
  for (const field of Object.keys(item)) {
    if (!["promptId", "slotContracts", "reviewOverride"].includes(field)) {
      throw new Error(`${label} contains unexpected field ${field}`);
    }
  }
  if (typeof item.promptId !== "string" || item.promptId.trim().length === 0) {
    throw new Error(`${label} must contain promptId`);
  }
  if (semanticById.has(item.promptId)) {
    throw new Error(`${label} duplicates promptId ${item.promptId}`);
  }
  semanticById.set(item.promptId, item);
}

const baseRationaleKoById = new Map(rationalesKo.map((item) => [item.promptId, item]));
const rationaleKoById = new Map(baseRationaleKoById);
const reviews = baseReviews.map((item) => {
  const semanticReview = semanticById.get(item.promptId);
  const override = semanticReview?.reviewOverride;
  if (override == null) {
    return item;
  }
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    throw new Error(`${item.promptId}: reviewOverride must be an object`);
  }
  const requiredOverrideFields = [
    "answerMode",
    "requiredSlots",
    "optionalSlots",
    "minimumDepthSlots",
    "rationale",
    "rationaleKo"
  ];
  for (const field of requiredOverrideFields) {
    if (!(field in override)) {
      throw new Error(`${item.promptId}: reviewOverride is missing ${field}`);
    }
  }
  rationaleKoById.set(item.promptId, {
    promptId: item.promptId,
    sourceRationale: override.rationale,
    rationaleKo: override.rationaleKo
  });
  return {
    ...item,
    answerMode: override.answerMode,
    requiredSlots: override.requiredSlots,
    optionalSlots: override.optionalSlots,
    minimumDepthSlots: override.minimumDepthSlots,
    rationale: override.rationale
  };
});

const errors = [];
if (source.length !== 1446) {
  errors.push(`Source must contain 1446 prompts, found ${source.length}`);
}
if (reviews.length !== source.length) {
  errors.push(`Review count ${reviews.length} does not match source count ${source.length}`);
}
if (semanticReviews.length !== source.length) {
  errors.push(`Semantic review count ${semanticReviews.length} does not match source count ${source.length}`);
}
if (rationalesKo.length !== source.length) {
  errors.push(`Korean rationale count ${rationalesKo.length} does not match source count ${source.length}`);
}

const sourceIds = new Set(source.map((item) => item.promptId));
for (const promptId of semanticById.keys()) {
  if (!sourceIds.has(promptId)) {
    errors.push(`Semantic review has unknown promptId ${promptId}`);
  }
}
const seenIds = new Set();
const reviewById = new Map();

for (const [index, item] of reviews.entries()) {
  const label = `review[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    errors.push(`${label} must be an object`);
    continue;
  }
  if (!sourceIds.has(item.promptId)) {
    errors.push(`${label} has unknown promptId ${item.promptId}`);
  }
  if (seenIds.has(item.promptId)) {
    errors.push(`${label} duplicates promptId ${item.promptId}`);
  }
  seenIds.add(item.promptId);
  reviewById.set(item.promptId, item);

  if (!allowedModes.has(item.answerMode)) {
    errors.push(`${item.promptId}: invalid answerMode ${item.answerMode}`);
  }
  validateSlots(item.promptId, "requiredSlots", item.requiredSlots, errors);
  validateSlots(item.promptId, "optionalSlots", item.optionalSlots, errors);

  const required = new Set(item.requiredSlots ?? []);
  for (const slot of item.optionalSlots ?? []) {
    if (required.has(slot)) {
      errors.push(`${item.promptId}: slot ${slot} appears in both requiredSlots and optionalSlots`);
    }
  }
  if ((item.requiredSlots?.length ?? 0) === 0) {
    errors.push(`${item.promptId}: requiredSlots must not be empty`);
  }
  if (!Number.isInteger(item.minimumDepthSlots)
      || item.minimumDepthSlots < 0
      || item.minimumDepthSlots > 2) {
    errors.push(`${item.promptId}: minimumDepthSlots must be an integer from 0 to 2`);
  }
  if (item.minimumDepthSlots > (item.optionalSlots?.length ?? 0)) {
    errors.push(`${item.promptId}: minimumDepthSlots exceeds optionalSlots count`);
  }
  if (typeof item.rationale !== "string" || item.rationale.trim().length < 35) {
    errors.push(`${item.promptId}: rationale must specifically explain the manual decision (minimum 35 characters)`);
  }
  const rationaleKo = rationaleKoById.get(item.promptId);
  if (!rationaleKo) {
    errors.push(`${item.promptId}: Korean rationale is missing`);
  } else {
    if (rationaleKo.sourceRationale !== item.rationale) {
      errors.push(`${item.promptId}: Korean rationale was translated from an outdated English rationale`);
    }
    if (typeof rationaleKo.rationaleKo !== "string"
        || rationaleKo.rationaleKo.trim().length < 20
        || !/[가-힣]/.test(rationaleKo.rationaleKo)) {
      errors.push(`${item.promptId}: rationaleKo must contain a substantive Korean explanation`);
    }
    const allowedLatinTokens = new Set([...allowedModes, ...allowedSlots, "A", "B", "C", "I"]);
    const unexpectedLatinTokens = (rationaleKo.rationaleKo.match(/[A-Za-z][A-Za-z_]*/g) ?? [])
      .filter((token) => !allowedLatinTokens.has(token));
    if (unexpectedLatinTokens.length > 0) {
      errors.push(`${item.promptId}: rationaleKo contains unexpected English tokens: ${unexpectedLatinTokens.join(", ")}`);
    }
  }

  validateSlotContracts(item, semanticById.get(item.promptId), errors);
}

for (const prompt of source) {
  if (!reviewById.has(prompt.promptId)) {
    errors.push(`Missing review for ${prompt.promptId}`);
  }
  const review = reviewById.get(prompt.promptId);
  if (review && ["I", "A"].includes(prompt.difficulty) && review.minimumDepthSlots > 1) {
    errors.push(`${prompt.promptId}: difficulty ${prompt.difficulty} cannot require depth 2`);
  }
  if (!semanticById.has(prompt.promptId)) {
    errors.push(`Missing semantic review for ${prompt.promptId}`);
  }
}

if (errors.length > 0) {
  console.error(`Manual metadata validation failed with ${errors.length} error(s):`);
  errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 200) {
    console.error(`- ... ${errors.length - 200} more`);
  }
  process.exit(1);
}

const combined = source.map((prompt) => {
  const review = reviewById.get(prompt.promptId);
  return {
    ...prompt,
    ...review,
    rationaleKo: rationaleKoById.get(prompt.promptId).rationaleKo.trim(),
    slotContracts: semanticById.get(prompt.promptId).slotContracts,
    expectedTense: expectedTense(review.answerMode),
    expectedPov: expectedPov(review.answerMode)
  };
});

await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(combinedPath, `${JSON.stringify(combined, null, 2)}\n`, "utf8");
await fs.writeFile(migrationPath, buildMigration(combined), "utf8");
await fs.writeFile(rationaleMigrationPath, buildRationaleMigration(combined), "utf8");
await fs.writeFile(slotContractMigrationPath, buildSlotContractMigration(combined), "utf8");

const modeCounts = countBy(combined, (item) => item.answerMode);
const depthCounts = countBy(combined, (item) => `${item.difficulty}:${item.minimumDepthSlots}`);
const roleCounts = combined.reduce((counts, item) => {
  counts.required += item.requiredSlots.length;
  counts.optional += item.optionalSlots.length;
  return counts;
}, { required: 0, optional: 0 });

console.log(`Validated ${combined.length} manually reviewed prompts.`);
console.log(`Wrote ${path.relative(root, combinedPath)}.`);
console.log(`Wrote ${path.relative(root, migrationPath)}.`);
console.log(`Wrote ${path.relative(root, rationaleMigrationPath)}.`);
console.log(`Wrote ${path.relative(root, slotContractMigrationPath)}.`);
console.log(`Modes: ${JSON.stringify(modeCounts)}`);
console.log(`Depth by difficulty: ${JSON.stringify(depthCounts)}`);
console.log(`Slot assignments: ${JSON.stringify(roleCounts)}`);

function validateSlots(promptId, field, slots, target) {
  if (!Array.isArray(slots)) {
    target.push(`${promptId}: ${field} must be an array`);
    return;
  }
  const seen = new Set();
  for (const slot of slots) {
    if (!allowedSlots.has(slot)) {
      target.push(`${promptId}: ${field} contains invalid slot ${slot}`);
    }
    if (seen.has(slot)) {
      target.push(`${promptId}: ${field} duplicates ${slot}`);
    }
    seen.add(slot);
  }
}

function validateSlotContracts(review, semanticReview, target) {
  if (!semanticReview) {
    target.push(`${review.promptId}: semantic review is missing`);
    return;
  }
  const contracts = semanticReview.slotContracts;
  if (!contracts || typeof contracts !== "object" || Array.isArray(contracts)) {
    target.push(`${review.promptId}: slotContracts must be an object`);
    return;
  }
  const expectedSlots = [...review.requiredSlots, ...review.optionalSlots];
  const actualSlots = Object.keys(contracts);
  const missing = expectedSlots.filter((slot) => !actualSlots.includes(slot));
  const unexpected = actualSlots.filter((slot) => !expectedSlots.includes(slot));
  if (missing.length > 0 || unexpected.length > 0) {
    target.push(
      `${review.promptId}: slotContracts do not match reviewed slots`
      + ` (missing=${missing.join(",")}, unexpected=${unexpected.join(",")})`
    );
  }
  const fields = [
    "semanticRoleEn",
    "satisfiedWhenEn",
    "semanticRoleKo",
    "satisfiedWhenKo"
  ];
  for (const slot of expectedSlots) {
    const contract = contracts[slot];
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      target.push(`${review.promptId}/${slot}: slot contract must be an object`);
      continue;
    }
    const unexpectedFields = Object.keys(contract).filter((field) => !fields.includes(field));
    if (unexpectedFields.length > 0) {
      target.push(
        `${review.promptId}/${slot}: unexpected contract fields ${unexpectedFields.join(",")}`
      );
    }
    for (const field of fields) {
      const value = contract[field];
      const minimumLength = field.startsWith("semanticRole") ? 4 : 12;
      if (typeof value !== "string" || value.trim().length < minimumLength) {
        target.push(`${review.promptId}/${slot}: ${field} must be a substantive string`);
      }
    }
    if (typeof contract.semanticRoleKo === "string"
        && !/[가-힣]/.test(contract.semanticRoleKo)) {
      target.push(`${review.promptId}/${slot}: semanticRoleKo must contain Korean text`);
    }
    if (typeof contract.satisfiedWhenKo === "string"
        && !/[가-힣]/.test(contract.satisfiedWhenKo)) {
      target.push(`${review.promptId}/${slot}: satisfiedWhenKo must contain Korean text`);
    }
  }
}

function countBy(items, keyOf) {
  return Object.fromEntries([...items.reduce((map, item) => {
    const key = keyOf(item);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function expectedTense(answerMode) {
  if (answerMode === "GOAL_PLAN") return "FUTURE_PLAN";
  if (answerMode === "CHANGE_REFLECTION") return "MIXED_PAST_PRESENT";
  return "PRESENT_SIMPLE";
}

function expectedPov(answerMode) {
  if (["BALANCED_OPINION", "OPINION_REASON"].includes(answerMode)) {
    return "GENERAL_OR_FIRST_PERSON";
  }
  return "FIRST_PERSON";
}

function buildMigration(items) {
  const profileRows = items.map((item) => `    (${sql(item.promptId)}, ${sql(item.answerMode)}, ${item.minimumDepthSlots})`).join(",\n");
  const slotRows = items.flatMap((item) => [
    ...item.requiredSlots.map((slot, index) => `    (${sql(item.promptId)}, ${sql(slot)}, 'REQUIRED', ${index + 1})`),
    ...item.optionalSlots.map((slot, index) => `    (${sql(item.promptId)}, ${sql(slot)}, 'OPTIONAL', ${index + 1})`)
  ]).join(",\n");

  return `-- Manually reviewed prompt learning contracts for all 1,446 prompts.\n`
    + `-- Generated from infra/mysql/data/prompt-task-metadata-reviewed.json.\n`
    + `-- Do not replace these explicit decisions with regex or prompt-ID family inference.\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_profiles;\n`
    + `CREATE TEMPORARY TABLE tmp_reviewed_prompt_profiles (\n`
    + `    prompt_id VARCHAR(64) NOT NULL PRIMARY KEY,\n`
    + `    answer_mode_code VARCHAR(64) NOT NULL,\n`
    + `    minimum_depth_slots INT NOT NULL\n`
    + `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`
    + `INSERT INTO tmp_reviewed_prompt_profiles (prompt_id, answer_mode_code, minimum_depth_slots) VALUES\n${profileRows};\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_slots;\n`
    + `CREATE TEMPORARY TABLE tmp_reviewed_prompt_slots (\n`
    + `    prompt_id VARCHAR(64) NOT NULL,\n`
    + `    slot_code VARCHAR(64) NOT NULL,\n`
    + `    slot_role VARCHAR(16) NOT NULL,\n`
    + `    display_order INT NOT NULL,\n`
    + `    PRIMARY KEY (prompt_id, slot_code)\n`
    + `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`
    + `INSERT INTO tmp_reviewed_prompt_slots (prompt_id, slot_code, slot_role, display_order) VALUES\n${slotRows};\n\n`
    + `UPDATE prompt_task_profiles profile\n`
    + `JOIN tmp_reviewed_prompt_profiles reviewed ON reviewed.prompt_id = profile.prompt_id\n`
    + `JOIN prompt_answer_modes mode ON mode.code = reviewed.answer_mode_code\n`
    + `SET profile.answer_mode_id = mode.id,\n`
    + `    profile.expected_tense = CASE reviewed.answer_mode_code\n`
    + `        WHEN 'GOAL_PLAN' THEN 'FUTURE_PLAN'\n`
    + `        WHEN 'CHANGE_REFLECTION' THEN 'MIXED_PAST_PRESENT'\n`
    + `        ELSE 'PRESENT_SIMPLE'\n`
    + `    END,\n`
    + `    profile.expected_pov = CASE reviewed.answer_mode_code\n`
    + `        WHEN 'BALANCED_OPINION' THEN 'GENERAL_OR_FIRST_PERSON'\n`
    + `        WHEN 'OPINION_REASON' THEN 'GENERAL_OR_FIRST_PERSON'\n`
    + `        ELSE 'FIRST_PERSON'\n`
    + `    END,\n`
    + `    profile.minimum_depth_slots = reviewed.minimum_depth_slots,\n`
    + `    profile.is_active = 1;\n\n`
    + `UPDATE prompt_task_profile_slots assignment\n`
    + `JOIN tmp_reviewed_prompt_profiles reviewed ON reviewed.prompt_id = assignment.prompt_id\n`
    + `SET assignment.is_active = 0;\n\n`
    + `INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)\n`
    + `SELECT reviewed.prompt_id, slot.id, reviewed.slot_role, reviewed.display_order, 1\n`
    + `FROM tmp_reviewed_prompt_slots reviewed\n`
    + `JOIN prompt_task_slots slot ON slot.code = reviewed.slot_code\n`
    + `ON DUPLICATE KEY UPDATE\n`
    + `    slot_role = VALUES(slot_role),\n`
    + `    display_order = VALUES(display_order),\n`
    + `    is_active = VALUES(is_active);\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_slots;\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_profiles;\n`;
}

function buildRationaleMigration(items) {
  const rationaleRows = items
    .map((item) => `    (${sql(item.promptId)}, ${sql(item.rationaleKo.trim())})`)
    .join(",\n");

  return `-- Manual review rationale for each prompt learning contract.\n`
    + `-- Generated from infra/mysql/data/prompt-task-metadata-reviewed.json.\n\n`
    + `DELIMITER $$\n\n`
    + `DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_task_review_rationale $$\n`
    + `CREATE PROCEDURE sp_writeloop_add_prompt_task_review_rationale()\n`
    + `BEGIN\n`
    + `    IF NOT EXISTS (\n`
    + `        SELECT 1\n`
    + `        FROM information_schema.COLUMNS\n`
    + `        WHERE TABLE_SCHEMA = DATABASE()\n`
    + `          AND TABLE_NAME = 'prompt_task_profiles'\n`
    + `          AND COLUMN_NAME = 'review_rationale'\n`
    + `    ) THEN\n`
    + `        ALTER TABLE prompt_task_profiles\n`
    + `            ADD COLUMN review_rationale TEXT NULL\n`
    + `                COMMENT 'Manual rationale for the question learning contract'\n`
    + `                AFTER minimum_depth_slots;\n`
    + `    END IF;\n`
    + `END $$\n\n`
    + `CALL sp_writeloop_add_prompt_task_review_rationale() $$\n`
    + `DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_task_review_rationale $$\n\n`
    + `DELIMITER ;\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_rationales;\n`
    + `CREATE TEMPORARY TABLE tmp_reviewed_prompt_rationales (\n`
    + `    prompt_id VARCHAR(64) NOT NULL PRIMARY KEY,\n`
    + `    review_rationale TEXT NOT NULL\n`
    + `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`
    + `INSERT INTO tmp_reviewed_prompt_rationales (prompt_id, review_rationale) VALUES\n${rationaleRows};\n\n`
    + `UPDATE prompt_task_profiles profile\n`
    + `JOIN tmp_reviewed_prompt_rationales reviewed ON reviewed.prompt_id = profile.prompt_id\n`
    + `SET profile.review_rationale = reviewed.review_rationale;\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_rationales;\n`;
}

function buildSlotContractMigration(items) {
  const contractRows = items.flatMap((item) => {
    const rows = [];
    for (const [role, slots] of [
      ["REQUIRED", item.requiredSlots],
      ["OPTIONAL", item.optionalSlots]
    ]) {
      slots.forEach((slot) => {
        const contract = item.slotContracts[slot];
        rows.push(
          `    (${sql(item.promptId)}, ${sql(slot)}, ${sql(role)}, `
          + `${sql(contract.semanticRoleEn.trim())}, ${sql(contract.satisfiedWhenEn.trim())}, `
          + `${sql(contract.semanticRoleKo.trim())}, ${sql(contract.satisfiedWhenKo.trim())})`
        );
      });
    }
    return rows;
  }).join(",\n");

  return `-- Question-specific semantic contracts for every manually reviewed prompt-slot assignment.\n`
    + `-- Generated only from manually authored files in scripts/prompt-metadata-review/semantic-reviews.\n`
    + `-- English fields are authoritative at runtime; Korean fields are reviewer references.\n\n`
    + `DELIMITER $$\n\n`
    + `DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_slot_contracts $$\n`
    + `CREATE PROCEDURE sp_writeloop_add_prompt_slot_contracts()\n`
    + `BEGIN\n`
    + `    IF NOT EXISTS (\n`
    + `        SELECT 1 FROM information_schema.COLUMNS\n`
    + `        WHERE TABLE_SCHEMA = DATABASE()\n`
    + `          AND TABLE_NAME = 'prompt_task_profile_slots'\n`
    + `          AND COLUMN_NAME = 'semantic_role_en'\n`
    + `    ) THEN\n`
    + `        ALTER TABLE prompt_task_profile_slots\n`
    + `            ADD COLUMN semantic_role_en TEXT NULL AFTER display_order;\n`
    + `    END IF;\n`
    + `    IF NOT EXISTS (\n`
    + `        SELECT 1 FROM information_schema.COLUMNS\n`
    + `        WHERE TABLE_SCHEMA = DATABASE()\n`
    + `          AND TABLE_NAME = 'prompt_task_profile_slots'\n`
    + `          AND COLUMN_NAME = 'satisfied_when_en'\n`
    + `    ) THEN\n`
    + `        ALTER TABLE prompt_task_profile_slots\n`
    + `            ADD COLUMN satisfied_when_en TEXT NULL AFTER semantic_role_en;\n`
    + `    END IF;\n`
    + `    IF NOT EXISTS (\n`
    + `        SELECT 1 FROM information_schema.COLUMNS\n`
    + `        WHERE TABLE_SCHEMA = DATABASE()\n`
    + `          AND TABLE_NAME = 'prompt_task_profile_slots'\n`
    + `          AND COLUMN_NAME = 'semantic_role_ko'\n`
    + `    ) THEN\n`
    + `        ALTER TABLE prompt_task_profile_slots\n`
    + `            ADD COLUMN semantic_role_ko TEXT NULL AFTER satisfied_when_en;\n`
    + `    END IF;\n`
    + `    IF NOT EXISTS (\n`
    + `        SELECT 1 FROM information_schema.COLUMNS\n`
    + `        WHERE TABLE_SCHEMA = DATABASE()\n`
    + `          AND TABLE_NAME = 'prompt_task_profile_slots'\n`
    + `          AND COLUMN_NAME = 'satisfied_when_ko'\n`
    + `    ) THEN\n`
    + `        ALTER TABLE prompt_task_profile_slots\n`
    + `            ADD COLUMN satisfied_when_ko TEXT NULL AFTER semantic_role_ko;\n`
    + `    END IF;\n`
    + `END $$\n\n`
    + `CALL sp_writeloop_add_prompt_slot_contracts() $$\n`
    + `DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_slot_contracts $$\n\n`
    + `DELIMITER ;\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_slot_contracts;\n`
    + `CREATE TEMPORARY TABLE tmp_reviewed_prompt_slot_contracts (\n`
    + `    prompt_id VARCHAR(64) NOT NULL,\n`
    + `    slot_code VARCHAR(64) NOT NULL,\n`
    + `    slot_role VARCHAR(16) NOT NULL,\n`
    + `    semantic_role_en TEXT NOT NULL,\n`
    + `    satisfied_when_en TEXT NOT NULL,\n`
    + `    semantic_role_ko TEXT NOT NULL,\n`
    + `    satisfied_when_ko TEXT NOT NULL,\n`
    + `    PRIMARY KEY (prompt_id, slot_code, slot_role)\n`
    + `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`
    + `INSERT INTO tmp_reviewed_prompt_slot_contracts (\n`
    + `    prompt_id, slot_code, slot_role,\n`
    + `    semantic_role_en, satisfied_when_en, semantic_role_ko, satisfied_when_ko\n`
    + `) VALUES\n${contractRows};\n\n`
    + `UPDATE prompt_task_profile_slots assignment\n`
    + `JOIN prompt_task_slots slot ON slot.id = assignment.slot_id\n`
    + `JOIN tmp_reviewed_prompt_slot_contracts reviewed\n`
    + `  ON reviewed.prompt_id = assignment.prompt_id\n`
    + ` AND reviewed.slot_code = slot.code\n`
    + ` AND reviewed.slot_role = assignment.slot_role\n`
    + `SET assignment.semantic_role_en = reviewed.semantic_role_en,\n`
    + `    assignment.satisfied_when_en = reviewed.satisfied_when_en,\n`
    + `    assignment.semantic_role_ko = reviewed.semantic_role_ko,\n`
    + `    assignment.satisfied_when_ko = reviewed.satisfied_when_ko\n`
    + `WHERE assignment.is_active = 1;\n\n`
    + `DROP TEMPORARY TABLE IF EXISTS tmp_reviewed_prompt_slot_contracts;\n`;
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
