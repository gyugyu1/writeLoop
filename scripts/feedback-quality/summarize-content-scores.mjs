// 피드백 내용 채점(scores.json)을 항목별로 모은다(content-rubric.md).
//
//   node scripts/feedback-quality/summarize-content-scores.mjs --scores <scores.json> [--items <review-items.json>] [--compare <다른 scores.json>]
//
// --items를 주면 난이도별·미션 종류별 평균도 보이고, 채점되지 않은 항목이나 묶음에 없는 id를 알린다.
// --compare를 주면 그 실행(앞) 대비 이번(뒤)의 항목별 평균 차이와, 같은 id에서 2점 이상 달라진 항목을 보인다.
import fs from "node:fs/promises";
import process from "node:process";

const RUBRIC_KEYS = [
  "correctionAccuracy",
  "correctionExplanation",
  "missionFit",
  "supportMaterials",
  "strength",
  "completionMaterials"
];
const LABELS = {
  correctionAccuracy: "① 교정 정확성",
  correctionExplanation: "② 교정 설명",
  missionFit: "③ 미션 적절성",
  supportMaterials: "④ 도움 자료",
  strength: "⑤ 잘한 점",
  completionMaterials: "⑥ 완료 화면 자료"
};

const options = parseArgs(process.argv.slice(2));
if (!options.scores) {
  console.error("Usage: summarize-content-scores.mjs --scores <scores.json> [--items <review-items.json>] [--compare <scores.json>]");
  process.exit(2);
}

const scores = await readScores(options.scores);
const items = options.items ? JSON.parse(await fs.readFile(options.items, "utf8")).items ?? [] : null;
const errors = validateScores(scores, items);
if (errors.length > 0) {
  console.error("scores.json is invalid:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
// 비교할 파일도 요약을 찍기 전에 검사한다(틀리면 아무것도 찍지 않고 끝낸다).
const before = options.compare ? await readScores(options.compare) : null;
if (before) {
  const compareErrors = validateScores(before, null);
  if (compareErrors.length > 0) {
    console.error(`--compare scores are invalid (${options.compare}):`);
    for (const error of compareErrors) console.error(`- ${error}`);
    process.exit(1);
  }
}

console.log(`채점 ${scores.length}건 (${options.scores})`);
console.log("\n== 항목별 평균 (해당 없음 제외)");
for (const key of RUBRIC_KEYS) {
  const values = scores.map((entry) => entry.scores[key]).filter((value) => value != null);
  console.log(`${LABELS[key]}: ${formatMean(values)} (채점 ${values.length}건) 분포 ${distribution(values)}`);
}

if (items) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  printGrouped("난이도별", (entry) => itemById.get(entry.id)?.question?.difficulty ?? "?");
  printGrouped("미션 종류별", (entry) => {
    const feedback = itemById.get(entry.id)?.feedback;
    return feedback?.loopComplete ? "COMPLETE" : feedback?.mission?.focusType ?? "?";
  });
}

console.log("\n== 항목별 낮은 점수 (2점 이하)");
for (const key of RUBRIC_KEYS) {
  const low = scores.filter((entry) => entry.scores[key] != null && entry.scores[key] <= 2);
  if (low.length === 0) continue;
  console.log(`${LABELS[key]}:`);
  for (const entry of low) console.log(`  ${entry.scores[key]}  ${entry.id} — ${entry.notes?.[key] ?? ""}`);
}

if (before) {
  const beforeById = new Map(before.map((entry) => [entry.id, entry]));
  console.log(`\n== 비교: ${options.compare}(앞) → ${options.scores}(뒤)`);
  for (const key of RUBRIC_KEYS) {
    const a = before.map((entry) => entry.scores[key]).filter((value) => value != null);
    const b = scores.map((entry) => entry.scores[key]).filter((value) => value != null);
    const diff = a.length && b.length ? (mean(b) - mean(a)).toFixed(2) : "-";
    console.log(`${LABELS[key]}: ${formatMean(a)} → ${formatMean(b)} (${diff.startsWith("-") || diff === "-" ? diff : `+${diff}`})`);
  }
  console.log("같은 id에서 2점 이상 달라진 것:");
  for (const entry of scores) {
    const previous = beforeById.get(entry.id);
    if (!previous) continue;
    for (const key of RUBRIC_KEYS) {
      const a = previous.scores[key];
      const b = entry.scores[key];
      if (a != null && b != null && Math.abs(b - a) >= 2) {
        console.log(`  ${entry.id} ${LABELS[key]}: ${a} → ${b} — ${entry.notes?.[key] ?? ""}`);
      }
    }
  }
}

function printGrouped(title, groupOf) {
  const groups = new Map();
  for (const entry of scores) {
    const group = groupOf(entry);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry);
  }
  console.log(`\n== ${title} 평균`);
  for (const [group, entries] of [...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))) {
    const parts = RUBRIC_KEYS.map((key) => {
      const values = entries.map((entry) => entry.scores[key]).filter((value) => value != null);
      return `${LABELS[key].slice(0, 1)} ${formatMean(values)}`;
    });
    console.log(`${group} (${entries.length}건): ${parts.join("  ")}`);
  }
}

function validateScores(entries, reviewItems) {
  const errors = [];
  if (!Array.isArray(entries)) return ["scores must be an array"];
  const ids = new Set();
  entries.forEach((entry, index) => {
    const label = entry?.id ?? `#${index + 1}`;
    if (typeof entry?.id !== "string" || entry.id.trim() === "") errors.push(`${label}: id is required`);
    if (ids.has(entry?.id)) errors.push(`${label}: duplicate id`);
    ids.add(entry?.id);
    if (!entry?.scores || typeof entry.scores !== "object") {
      errors.push(`${label}: scores is required`);
      return;
    }
    for (const key of Object.keys(entry.scores)) {
      if (!RUBRIC_KEYS.includes(key)) errors.push(`${label}: unknown rubric key ${key}`);
    }
    // notes는 선택이지만, 있으면 같은 여섯 키만 쓴다.
    if (entry.notes != null) {
      if (typeof entry.notes !== "object" || Array.isArray(entry.notes)) {
        errors.push(`${label}: notes must be an object`);
      } else {
        for (const key of Object.keys(entry.notes)) {
          if (!RUBRIC_KEYS.includes(key)) errors.push(`${label}: unknown notes key ${key}`);
        }
      }
    }
    for (const key of RUBRIC_KEYS) {
      const value = entry.scores[key];
      if (value === undefined) errors.push(`${label}: missing ${key} (use null for not applicable)`);
      else if (value !== null && !(Number.isInteger(value) && value >= 1 && value <= 5)) {
        errors.push(`${label}: ${key} must be an integer 1-5 or null, got ${JSON.stringify(value)}`);
      }
    }
  });
  if (reviewItems) {
    const itemIds = new Set(reviewItems.map((item) => item.id));
    for (const entry of entries) {
      if (entry?.id && !itemIds.has(entry.id)) errors.push(`${entry.id}: not in review items`);
    }
    for (const id of itemIds) {
      if (!ids.has(id)) errors.push(`${id}: review item was not scored`);
    }
  }
  return errors;
}

async function readScores(file) {
  // 최상위는 배열이어야 한다(content-rubric.md). 아니면 validateScores가 오류로 알린다.
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMean(values) {
  return values.length ? mean(values).toFixed(2) : "-";
}

function distribution(values) {
  const counts = [1, 2, 3, 4, 5].map((score) => values.filter((value) => value === score).length);
  return counts.map((count, index) => `${index + 1}:${count}`).join(" ");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--scores") parsed.scores = args[++index];
    else if (arg === "--items") parsed.items = args[++index];
    else if (arg === "--compare") parsed.compare = args[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}
