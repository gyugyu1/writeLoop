// 회귀 리포트에서 학생에게 보인 피드백을 채점 묶음으로 뽑는다(내용 품질 채점용, content-rubric.md).
//
//   node scripts/feedback-quality/export-content-review.mjs --report <latest.json> --cases <케이스 파일> --out <폴더>
//
// 리포트는 --include-pass-payloads로 만든 것이어야 한다(통과한 케이스의 피드백도 있어야 채점할 수 있다).
// 질문 문장은 리포트에 없어서 케이스 파일의 promptQuestionEn·promptQuestionKo·difficulty를 케이스 이름으로 맞춰 가져온다.
// 출력: review-items.json(채점 에이전트가 읽음), review-items.md(사람이 읽음).
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const options = parseArgs(process.argv.slice(2));
if (!options.report || !options.out) {
  console.error("Usage: export-content-review.mjs --report <latest.json> [--cases <cases.json>] --out <dir>");
  process.exit(2);
}

const report = JSON.parse(await fs.readFile(options.report, "utf8"));
const casesByName = new Map();
if (options.cases) {
  const raw = JSON.parse(await fs.readFile(options.cases, "utf8"));
  for (const testCase of Array.isArray(raw) ? raw : raw.cases ?? []) {
    casesByName.set(testCase.name, testCase);
  }
}

const items = [];
const skipped = [];
// id는 건너뛰기 전에 리포트 순서대로 모든 결과에 매긴다. 그래야 앞 케이스의 요청이 실패해도 뒤 케이스의 id가 실행마다 같다.
const usedIds = new Set();
for (const result of report.results ?? []) {
  const id = uniqueId(result.name, usedIds);
  const failedRequest = (result.failures ?? []).some((failure) => failure.code === "request_failed");
  if (failedRequest || !result.actual) {
    skipped.push({ name: result.name, reason: failedRequest ? "request_failed" : "no payload snapshot" });
    continue;
  }
  const testCase = casesByName.get(result.name) ?? {};
  items.push({
    id,
    name: result.name,
    question: {
      promptId: result.promptId,
      en: testCase.promptQuestionEn ?? null,
      ko: testCase.promptQuestionKo ?? null,
      difficulty: testCase.difficulty ?? null
    },
    answer: result.answer,
    expectedBehavior: result.expectedBehavior ?? testCase.expectedBehavior ?? null,
    feedback: visibleFeedback(result.actual)
  });
}

await fs.mkdir(options.out, { recursive: true });
await fs.writeFile(
  path.join(options.out, "review-items.json"),
  `${JSON.stringify({ source: options.report, itemCount: items.length, skipped, items }, null, 2)}\n`
);
await fs.writeFile(path.join(options.out, "review-items.md"), renderMarkdown(items, skipped));
console.log(`review items: ${items.length}, skipped: ${skipped.length} -> ${options.out}`);

// 학생 화면에 보이는 것만 남긴다. 완료면 미션 대신 완료 화면 자료를 본다.
function visibleFeedback(actual) {
  const complete = actual.loopComplete === true;
  const coachMove = actual.coachMove ?? {};
  const feedback = {
    loopComplete: complete,
    strengths: actual.strengths ?? []
  };
  if (!complete) {
    feedback.mission = {
      focusType: coachMove.focusType ?? null,
      targetSlot: coachMove.targetSlot ?? null,
      title: coachMove.focus ?? null,
      why: coachMove.why ?? null,
      instruction: coachMove.instruction ?? null,
      skeletonEn: coachMove.skeletonEn ?? null,
      skeletonKo: coachMove.skeletonKo ?? null,
      suggestedPhrases: coachMove.suggestedPhrases ?? []
    };
    feedback.languageCorrections = coachMove.languageCorrections ?? [];
    feedback.revisedAnswer = actual.revisedAnswer ?? null;
  } else {
    feedback.completion = {
      modelAnswer: actual.modelAnswer ?? null,
      modelAnswerKo: actual.modelAnswerKo ?? null,
      refinementExpressions: actual.refinementExpressions ?? [],
      enrichment: actual.completion?.enrichment ?? null
    };
  }
  return feedback;
}

function renderMarkdown(reviewItems, skippedItems) {
  const lines = [`# 피드백 내용 채점 묶음 (${reviewItems.length}건)`, ""];
  for (const item of reviewItems) {
    const f = item.feedback;
    lines.push(`## ${item.id}`, "");
    lines.push(`- 질문(${item.question.difficulty ?? "?"}): ${item.question.en ?? item.question.promptId}`);
    if (item.question.ko) lines.push(`  - ${item.question.ko}`);
    lines.push(`- 학생 답: ${item.answer}`);
    if (item.expectedBehavior) lines.push(`- 볼 점: ${item.expectedBehavior}`);
    lines.push(`- 잘한 점: ${f.strengths.join(" / ") || "(없음)"}`);
    if (f.loopComplete) {
      lines.push("- 완료", `  - 모범 답안: ${f.completion.modelAnswer ?? ""}`, `  - 해석: ${f.completion.modelAnswerKo ?? ""}`);
      for (const expression of f.completion.refinementExpressions) {
        lines.push(`  - 추천 표현: ${expression.expression} — ${expression.meaningKo ?? ""} (${expression.usageTipKo ?? ""}) 예: ${expression.exampleEn ?? ""}`);
      }
      const enrichment = f.completion.enrichment;
      if (enrichment) {
        lines.push(`  - 풍부하게 써 보기: ${enrichment.focus ?? ""}`);
        if (enrichment.why) lines.push(`    - 이유: ${enrichment.why}`);
        if (enrichment.instruction) lines.push(`    - 다시 쓸 때: ${enrichment.instruction}`);
        if (enrichment.skeletonEn) lines.push(`    - 문장 틀: ${enrichment.skeletonEn} / ${enrichment.skeletonKo ?? ""}`);
        for (const phrase of enrichment.suggestedPhrases ?? []) {
          lines.push(`    - 넣어볼 표현: ${phrase.phrase} — ${phrase.meaningKo ?? ""}`);
        }
      }
    } else {
      const m = f.mission;
      lines.push(`- 미션 ${m.focusType ?? ""}${m.targetSlot ? `/${m.targetSlot}` : ""}: ${m.title ?? ""}`);
      if (m.why) lines.push(`  - 이유: ${m.why}`);
      if (m.instruction) lines.push(`  - 다시 쓸 때: ${m.instruction}`);
      if (m.skeletonEn) lines.push(`  - 문장 틀: ${m.skeletonEn} / ${m.skeletonKo ?? ""}`);
      for (const phrase of m.suggestedPhrases) lines.push(`  - 넣어볼 표현: ${phrase.phrase} — ${phrase.meaningKo ?? ""}`);
      for (const correction of f.languageCorrections) {
        lines.push(`  - 교정(${correction.kind ?? ""}): ${correction.before ?? "∅"} → ${correction.after ?? "∅"} — ${correction.reason ?? ""}`);
      }
      if (f.revisedAnswer) lines.push(`  - 고친 문장: ${f.revisedAnswer}`);
    }
    lines.push("");
  }
  if (skippedItems.length > 0) {
    lines.push("## 뺀 케이스", "");
    for (const item of skippedItems) lines.push(`- ${item.name}: ${item.reason}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

// 처음 나온 이름은 그대로, 이미 쓴 id면 " (2)", " (3)"…에서 아직 안 쓴 것을 쓴다("foo (2)"라는 이름과도 겹치지 않는다).
function uniqueId(name, used) {
  let id = name;
  for (let count = 2; used.has(id); count += 1) {
    id = `${name} (${count})`;
  }
  used.add(id);
  return id;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--report") parsed.report = args[++index];
    else if (arg === "--cases") parsed.cases = args[++index];
    else if (arg === "--out") parsed.out = args[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}
