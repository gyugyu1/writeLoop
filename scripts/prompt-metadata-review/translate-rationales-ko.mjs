import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const reviewsDir = path.join(root, "scripts", "prompt-metadata-review", "reviews");
const outputPath = path.join(root, "scripts", "prompt-metadata-review", "rationales-ko.json");
const env = {
  ...(await readEnvFile(path.join(root, "env_files", "dev.env"))),
  ...process.env
};
const apiKey = env.OPENAI_API_KEY?.trim();
const apiUrl = (env.OPENAI_API_URL || "https://api.openai.com/v1/responses").trim();
const model = argument("--model") || env.OPENAI_MODEL || "gpt-4o";
const batchSize = Math.max(1, Number(argument("--batch-size") || 32));
const concurrency = Math.max(1, Number(argument("--concurrency") || 2));
const force = process.argv.includes("--force");

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required in the environment or env_files/dev.env");
}

const reviewFiles = (await fs.readdir(reviewsDir))
  .filter((name) => /^part-\d{2}\.json$/.test(name))
  .sort();
const reviews = [];
for (const file of reviewFiles) {
  reviews.push(...JSON.parse(await fs.readFile(path.join(reviewsDir, file), "utf8")));
}

const existing = await readExisting(outputPath);
const translations = new Map(existing.map((item) => [item.promptId, item]));
const pending = reviews.filter((review) => {
  if (force) return true;
  const translated = translations.get(review.promptId);
  return !translated
    || translated.sourceRationale !== review.rationale
    || !isValidKoreanRationale(translated.rationaleKo);
});

console.log(`Korean rationales: ${reviews.length - pending.length} reusable, ${pending.length} pending.`);
console.log(`Model: ${model}, batch size: ${batchSize}, concurrency: ${concurrency}`);

const batches = chunk(pending, batchSize);
await runPool(batches, concurrency, async (batch, index) => {
  const translated = await translateBatch(batch);
  for (const item of translated) {
    const source = batch.find((review) => review.promptId === item.promptId);
    translations.set(item.promptId, {
      promptId: item.promptId,
      sourceRationale: source.rationale,
      rationaleKo: item.rationaleKo.trim()
    });
  }
  await writeTranslations();
  console.log(`Translated batch ${index + 1}/${batches.length} (${batch.length} items).`);
});

await writeTranslations();
console.log(`Wrote ${path.relative(root, outputPath)} with ${reviews.length} Korean rationales.`);

async function translateBatch(batch) {
  const ids = batch.map((item) => item.promptId);
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        minItems: batch.length,
        maxItems: batch.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            promptId: { type: "string", enum: ids },
            rationaleKo: { type: "string" }
          },
          required: ["promptId", "rationaleKo"]
        }
      }
    },
    required: ["items"]
  };
  const payload = {
    model,
    input: [
      {
        role: "developer",
        content: [{
          type: "input_text",
          text: [
            "You translate English manual-review rationales for an English-learning question metadata system into Korean.",
            "Translate every rationale faithfully and naturally for Korean developers and content reviewers.",
            "Preserve the reason for the answer mode, required content, optional depth, and learner level exactly.",
            "Do not add a new judgment or omit any comparison, condition, or metadata code.",
            "Write ordinary words entirely in Korean. Do not leave English conjunctions such as 'and' or 'or'.",
            "Only canonical metadata codes written in uppercase, such as ACTION, CHOICE, GOAL, or REASON, may remain in English.",
            "Translate prompt as '질문', response or answer as '답변', and account as '설명' unless it literally means a user account.",
            "Prefer natural Korean over word-for-word translation, while preserving the original decision exactly.",
            "Use concise Korean declarative prose ending naturally with forms such as '-이다', '-한다', or '-필요하다'.",
            "Return exactly one item for every supplied promptId."
          ].join("\n")
        }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify(batch.map((item) => ({
            promptId: item.promptId,
            questionEn: item.questionEn ?? "",
            rationaleEn: item.rationale
          })))
        }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "prompt_rationale_ko_batch",
        strict: true,
        schema
      }
    }
  };

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`OpenAI ${response.status}: ${body.slice(0, 500)}`);
      }
      const parsed = JSON.parse(extractOutputText(JSON.parse(body)));
      validateBatch(batch, parsed.items);
      return parsed.items;
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

function validateBatch(source, translated) {
  if (!Array.isArray(translated) || translated.length !== source.length) {
    throw new Error(`Expected ${source.length} translations, received ${translated?.length ?? 0}`);
  }
  const expected = new Set(source.map((item) => item.promptId));
  const seen = new Set();
  for (const item of translated) {
    if (!expected.has(item.promptId) || seen.has(item.promptId)) {
      throw new Error(`Unexpected or duplicate promptId: ${item.promptId}`);
    }
    if (!isValidKoreanRationale(item.rationaleKo)) {
      throw new Error(`Invalid Korean rationale for ${item.promptId}`);
    }
    seen.add(item.promptId);
  }
}

function isValidKoreanRationale(value) {
  return typeof value === "string"
    && value.trim().length >= 20
    && /[가-힣]/.test(value)
    && !/[a-z]{2,}/.test(value);
}

async function writeTranslations() {
  const ordered = reviews.map((review) => {
    const translated = translations.get(review.promptId);
    if (!translated) {
      return null;
    }
    return {
      promptId: review.promptId,
      sourceRationale: review.rationale,
      rationaleKo: translated.rationaleKo
    };
  }).filter(Boolean);
  await fs.writeFile(outputPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

function extractOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI response did not include output_text");
}

async function readExisting(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readEnvFile(file) {
  const values = {};
  try {
    const content = await fs.readFile(file, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return values;
}

async function runPool(items, limit, worker) {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
