import fs from "fs";
import path from "path";

const INPUT_SQL = path.join("infra", "mysql", "schema", "077-replace-intro-prompts-with-foundation-set.sql");
const OUTPUT_SQL = path.join("infra", "mysql", "schema", "078-add-intro-foundation-vocab-hints.sql");
const CACHE_JSON = path.join("tools", "prompt-seed", ".intro-foundation-vocab-hints-cache.json");
const WORD_HINT_COUNT = 10;
const PHRASE_HINT_COUNT = 5;

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

function outputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function unescapeSql(value) {
  return value.replace(/''/g, "'");
}

function readPromptRows() {
  const text = fs.readFileSync(INPUT_SQL, "utf8");
  const rows = [];
  const rowPattern = /^\s*\('([^']+)', '([^']+)', \d+, '((?:[^']|'')*)', '((?:[^']|'')*)', '((?:[^']|'')*)', \d+, '([^']+)', '([^']+)',/;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(rowPattern);
    if (!match || !match[1].startsWith("prompt-intro-v2-")) {
      continue;
    }
    rows.push({
      promptId: match[1],
      topic: match[2],
      questionEn: unescapeSql(match[3]),
      questionKo: unescapeSql(match[4]),
      tipKo: unescapeSql(match[5]),
      mode: match[6],
      expectedTense: match[7],
    });
  }
  if (rows.length !== 400) {
    throw new Error(`Expected 400 prompt rows from ${INPUT_SQL}, got ${rows.length}`);
  }
  return rows;
}

async function generateHintBatch(env, batch) {
  const body = {
    model: env.OPENAI_FEEDBACK_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "intro_foundation_hint_batch",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  promptId: { type: "string" },
                  words: {
                    type: "array",
                    minItems: WORD_HINT_COUNT,
                    maxItems: WORD_HINT_COUNT,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        content: { type: "string" },
                        meaningKo: { type: "string" },
                        exampleEn: { type: "string" },
                      },
                      required: ["content", "meaningKo", "exampleEn"],
                    },
                  },
                  phrases: {
                    type: "array",
                    minItems: PHRASE_HINT_COUNT,
                    maxItems: PHRASE_HINT_COUNT,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        content: { type: "string" },
                        meaningKo: { type: "string" },
                        exampleEn: { type: "string" },
                      },
                      required: ["content", "meaningKo", "exampleEn"],
                    },
                  },
                },
                required: ["promptId", "words", "phrases"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    input: [
      {
        role: "system",
        content: [
          "You create beginner-friendly vocabulary and phrase hints for a Korean English-learning app.",
          `For each prompt, return exactly ${WORD_HINT_COUNT} WORD hints and exactly ${PHRASE_HINT_COUNT} PHRASE hints.`,
          "WORD hints should be single words or very short everyday chunks, not full sentences.",
          "PHRASE hints should be 2-7 word chunks learners can reuse directly in their answer.",
          "Avoid rare, academic, formal, or abstract expressions.",
          "Do not repeat the same hint too much within one prompt.",
          "meaningKo must be concise natural Korean.",
          "exampleEn must be a short beginner-level sentence using the hint.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({ prompts: batch }, null, 2),
      },
    ],
  };

  const response = await fetch(env.OPENAI_API_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240000),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI status ${response.status}: ${raw.slice(0, 500)}`);
  }
  const data = JSON.parse(raw);
  const text = outputText(data);
  if (!text) {
    throw new Error(`OpenAI returned no output text: ${raw.slice(0, 500)}`);
  }
  return JSON.parse(text).items;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateHintBatchWithRetry(env, batch, batchLabel) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await generateHintBatch(env, batch);
    } catch (error) {
      lastError = error;
      console.error(`hint batch ${batchLabel} failed attempt ${attempt}/3: ${error.message}`);
      if (attempt < 3) {
        await sleep(2000 * attempt);
      }
    }
  }
  throw lastError;
}

function loadCache() {
  if (!fs.existsSync(CACHE_JSON)) {
    return new Map();
  }
  const parsed = JSON.parse(fs.readFileSync(CACHE_JSON, "utf8"));
  return new Map((parsed.items || []).map((item) => [item.promptId, item]));
}

function saveCache(hintsByPromptId) {
  const items = [...hintsByPromptId.values()].sort((left, right) => left.promptId.localeCompare(right.promptId));
  fs.writeFileSync(CACHE_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2), "utf8");
}

function normalizeHintText(value, fallback) {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function fallbackWords(row) {
  const byMode = {
    ROUTINE: ["usually", "morning", "night", "after", "before", "routine", "time", "home", "work", "weekend"],
    PREFERENCE: ["favorite", "like", "reason", "comfortable", "useful", "simple", "fun", "calm", "taste", "choice"],
    GOAL_PLAN: ["want", "plan", "try", "soon", "goal", "practice", "learn", "future", "change", "dream"],
    PROBLEM_SOLUTION: ["problem", "tired", "rest", "help", "better", "stress", "focus", "sleep", "habit", "easy"],
    GENERAL_DESCRIPTION: ["place", "person", "thing", "feeling", "reason", "memory", "home", "city", "small", "important"],
  };
  return byMode[row.mode] || byMode.GENERAL_DESCRIPTION;
}

function fallbackPhrases(row) {
  const byMode = {
    ROUTINE: ["I usually ...", "after I ...", "before I ...", "in the morning", "at night"],
    PREFERENCE: ["I like ... because ...", "my favorite ...", "it feels ...", "I prefer ...", "it is useful for me"],
    GOAL_PLAN: ["I want to ...", "I will try to ...", "my small goal is ...", "next time, I will ...", "I hope to ..."],
    PROBLEM_SOLUTION: ["when that happens", "I usually try to ...", "it helps me ...", "when I feel ...", "I take a short break"],
    GENERAL_DESCRIPTION: ["one thing is ...", "I think ...", "it is important to me", "for example", "it makes me feel ..."],
  };
  return byMode[row.mode] || byMode.GENERAL_DESCRIPTION;
}

function normalizeGeneratedItem(item, fallbackContent, fallbackMeaning, fallbackExample) {
  return {
    content: normalizeHintText(item?.content, fallbackContent),
    meaningKo: normalizeHintText(item?.meaningKo, fallbackMeaning),
    exampleEn: normalizeHintText(item?.exampleEn, fallbackExample),
  };
}

function appendUnique(target, seen, item) {
  const key = item.content.toLowerCase();
  if (seen.has(key)) {
    return false;
  }
  seen.add(key);
  target.push(item);
  return true;
}

function fillHints(target, seen, fallbackContents, targetCount, kind) {
  for (let index = 0; target.length < targetCount; index += 1) {
    const fallbackContent = fallbackContents[index % fallbackContents.length];
    const exampleEn = kind === "word"
      ? `I use ${fallbackContent} in my answer.`
      : fallbackContent.includes("...")
        ? fallbackContent.replace("...", "something")
        : `I can say, "${fallbackContent}."`;
    appendUnique(target, seen, normalizeGeneratedItem(
      {},
      fallbackContent,
      kind === "word" ? `${fallbackContent} 관련 단어` : `${fallbackContent} 라는 표현`,
      exampleEn,
    ));
    if (index > fallbackContents.length + targetCount) {
      throw new Error(`Could not fill unique ${kind} hints`);
    }
  }
}

function ensureHintShape(row, generated) {
  const fallbackWordContents = fallbackWords(row);
  const fallbackPhraseContents = fallbackPhrases(row);
  const words = [];
  const phrases = [];
  const seenWords = new Set();
  const seenPhrases = new Set();

  for (let index = 0; index < WORD_HINT_COUNT; index += 1) {
    const fallbackContent = fallbackWordContents[index % fallbackWordContents.length];
    appendUnique(words, seenWords, normalizeGeneratedItem(
      generated?.words?.[index],
      fallbackContent,
      `${fallbackContent} 관련 단어`,
      `I use ${fallbackContent} in my answer.`,
    ));
  }

  for (let index = 0; index < PHRASE_HINT_COUNT; index += 1) {
    const fallbackContent = fallbackPhraseContents[index % fallbackPhraseContents.length];
    appendUnique(phrases, seenPhrases, normalizeGeneratedItem(
      generated?.phrases?.[index],
      fallbackContent,
      `${fallbackContent} 라는 표현`,
      fallbackContent.includes("...")
        ? fallbackContent.replace("...", "something")
        : `I can say, "${fallbackContent}."`,
    ));
  }

  fillHints(words, seenWords, fallbackWordContents, WORD_HINT_COUNT, "word");
  fillHints(phrases, seenPhrases, fallbackPhraseContents, PHRASE_HINT_COUNT, "phrase");

  return { promptId: row.promptId, words, phrases };
}

async function generateAllHints(rows) {
  const env = loadEnv(".env");
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in .env");
  }
  const hintsByPromptId = loadCache();
  const batchSize = 5;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const missingRows = batch.filter((row) => !hintsByPromptId.has(row.promptId));
    if (missingRows.length === 0) {
      console.error(`generated hints ${Math.min(start + batchSize, rows.length)}/${rows.length} (cached)`);
      continue;
    }
    const generated = await generateHintBatchWithRetry(env, missingRows, `${start + 1}-${start + missingRows.length}`);
    const generatedById = new Map(generated.map((item) => [item.promptId, item]));
    for (const row of missingRows) {
      hintsByPromptId.set(row.promptId, ensureHintShape(row, generatedById.get(row.promptId)));
    }
    saveCache(hintsByPromptId);
    console.error(`generated hints ${Math.min(start + batchSize, rows.length)}/${rows.length}`);
  }
  const hints = rows.map((row) => hintsByPromptId.get(row.promptId));
  if (hints.some((hint) => !hint)) {
    throw new Error("Some prompt hints were not generated");
  }
  fs.rmSync(CACHE_JSON, { force: true });
  return hints;
}

function sql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function buildMigration(hints) {
  const hintRows = [];
  const itemRows = [];
  for (const hint of hints) {
    hintRows.push({
      id: `hint-${hint.promptId}-word`,
      promptId: hint.promptId,
      hintType: "VOCAB_WORD",
      title: "추천 단어",
      displayOrder: 2,
    });
    hintRows.push({
      id: `hint-${hint.promptId}-phrase`,
      promptId: hint.promptId,
      hintType: "VOCAB_PHRASE",
      title: "추천 표현",
      displayOrder: 3,
    });
    hint.words.forEach((item, index) => {
      itemRows.push({
        id: `hint-${hint.promptId}-word-item-${index + 1}`,
        hintId: `hint-${hint.promptId}-word`,
        itemType: "WORD",
        displayOrder: index + 1,
        expressionFamily: "INTRO_FOUNDATION_WORD",
        ...item,
        usageTipKo: "질문에 답할 때 쓸 수 있는 쉬운 단어예요.",
      });
    });
    hint.phrases.forEach((item, index) => {
      itemRows.push({
        id: `hint-${hint.promptId}-phrase-item-${index + 1}`,
        hintId: `hint-${hint.promptId}-phrase`,
        itemType: "PHRASE",
        displayOrder: index + 1,
        expressionFamily: "INTRO_FOUNDATION_PHRASE",
        ...item,
        usageTipKo: "문장 안에 그대로 넣어 쓰면 자연스럽게 이어져요.",
      });
    });
  }

  const lines = [];
  lines.push("-- Add word and phrase hint packs for the 400 intro foundation prompts.");
  lines.push("-- Generated from prompt-intro-v2-* question text on 2026-05-12.");
  lines.push("");
  lines.push("SET NAMES utf8mb4;");
  lines.push("");
  lines.push("START TRANSACTION;");
  lines.push("");
  lines.push(`UPDATE prompt_hint_items item
JOIN prompt_hints hint ON hint.id = item.hint_id
SET item.is_active = 0
WHERE hint.prompt_id LIKE 'prompt-intro-v2-%'
  AND hint.hint_type IN ('VOCAB_WORD', 'VOCAB_PHRASE');`);
  lines.push("");
  lines.push(`UPDATE prompt_hints
SET is_active = 0
WHERE prompt_id LIKE 'prompt-intro-v2-%'
  AND hint_type IN ('VOCAB_WORD', 'VOCAB_PHRASE');`);
  lines.push("");
  lines.push("INSERT INTO prompt_hints (id, prompt_id, hint_type, title, display_order, is_active)");
  lines.push("VALUES");
  lines.push(hintRows.map((row) => `    (${[sql(row.id), sql(row.promptId), sql(row.hintType), sql(row.title), row.displayOrder, 1].join(", ")})`).join(",\n"));
  lines.push("ON DUPLICATE KEY UPDATE");
  lines.push("    prompt_id = VALUES(prompt_id),");
  lines.push("    hint_type = VALUES(hint_type),");
  lines.push("    title = VALUES(title),");
  lines.push("    display_order = VALUES(display_order),");
  lines.push("    is_active = VALUES(is_active);");
  lines.push("");
  lines.push("INSERT INTO prompt_hint_items (id, hint_id, item_type, content, meaning_ko, usage_tip_ko, example_en, expression_family, display_order, is_active)");
  lines.push("VALUES");
  lines.push(itemRows.map((row) => `    (${[
    sql(row.id),
    sql(row.hintId),
    sql(row.itemType),
    sql(row.content),
    sql(row.meaningKo),
    sql(row.usageTipKo),
    sql(row.exampleEn),
    sql(row.expressionFamily),
    row.displayOrder,
    1,
  ].join(", ")})`).join(",\n"));
  lines.push("ON DUPLICATE KEY UPDATE");
  lines.push("    hint_id = VALUES(hint_id),");
  lines.push("    item_type = VALUES(item_type),");
  lines.push("    content = VALUES(content),");
  lines.push("    meaning_ko = VALUES(meaning_ko),");
  lines.push("    usage_tip_ko = VALUES(usage_tip_ko),");
  lines.push("    example_en = VALUES(example_en),");
  lines.push("    expression_family = VALUES(expression_family),");
  lines.push("    display_order = VALUES(display_order),");
  lines.push("    is_active = VALUES(is_active);");
  lines.push("");
  lines.push("COMMIT;");
  lines.push("");

  return {
    sql: lines.join("\n"),
    summary: {
      prompts: hints.length,
      hintRows: hintRows.length,
      itemRows: itemRows.length,
      sample: hints.slice(0, 3),
    },
  };
}

const rows = readPromptRows();
const hints = await generateAllHints(rows);
const migration = buildMigration(hints);
fs.writeFileSync(OUTPUT_SQL, migration.sql, "utf8");
console.log(JSON.stringify({ output: OUTPUT_SQL, ...migration.summary }, null, 2));
