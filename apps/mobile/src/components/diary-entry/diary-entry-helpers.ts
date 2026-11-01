import type { DiaryDraft } from "@/lib/diary-drafts";
import type { DiaryEntry, DiaryFeedback } from "@/lib/types";

// 영어일기 화면의 타입, 상수, 날짜·문구·표현 키·흐름 코칭 계산(순수 함수).
export type DiaryEntryScreenProps = {
  initialEntryId?: string | null;
};

export type DiaryStep = "write" | "feedback" | "rewrite";

// 임시 저장에서 비교하는 편집 내용. 서버에 저장된 상태(새 일기는 빈 상태)와 같으면 저장할 필요가 없다.
export type DiaryEditableState = Pick<DiaryDraft, "entryDate" | "title" | "moodTags" | "content" | "rewriteText">;

export function buildDiaryEditableSignature(state: DiaryEditableState) {
  return JSON.stringify([state.entryDate, state.title, state.moodTags, state.content, state.rewriteText]);
}

export const DIARY_COACH_PROMPT_ID = "diary-free-writing";
export const MOOD_OPTIONS = [
  "calm",
  "happy",
  "grateful",
  "excited",
  "proud",
  "relaxed",
  "focused",
  "hopeful",
  "refreshed",
  "tired",
  "sleepy",
  "busy",
  "stressed",
  "worried",
  "sad",
  "lonely"
];

export function todayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

export function countWords(text: string) {
  const trimmed = trimText(text);
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

export function getLatestFeedback(entry: DiaryEntry | null): DiaryFeedback | null {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.feedback ?? null;
}

export function getLatestAttemptText(entry: DiaryEntry | null) {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.diaryText ?? entry?.content ?? "";
}

export function formatDiaryDate(value?: string | null) {
  return value || todayDateKey();
}

export function buildDefaultDiaryTitle(entryDate: string) {
  const matched = entryDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return `${entryDate || todayDateKey()}의 일기`;
  }

  const [, year, month, day] = matched;
  return `${year}년 ${Number(month)}월 ${Number(day)}일의 일기`;
}

export function firstText(...values: (string | null | undefined)[]) {
  return values.map((value) => trimText(value)).find(Boolean) ?? "";
}

export function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeMoodTags(tags: (string | null | undefined)[]) {
  const seen = new Set<string>();
  return tags
    .map((tag) => trimText(tag))
    .filter((tag) => {
      if (!tag || seen.has(tag)) {
        return false;
      }

      seen.add(tag);
      return true;
    });
}

export function getDiaryMoodTags(entry: DiaryEntry) {
  const tags = normalizeMoodTags(entry.tags ?? []);
  return tags.length > 0 ? tags : normalizeMoodTags([entry.mood]);
}

export function buildSavedExpressionIdMap(expressions: { id: number; expression: string }[]) {
  return expressions.reduce<Record<string, number>>((map, expression) => {
    const key = normalizeExpressionKey(expression.expression);
    if (key) {
      map[key] = expression.id;
    }
    return map;
  }, {});
}

export function isActionableFlowSuggestion(value?: string | null) {
  const text = trimText(value);
  if (!text) {
    return false;
  }

  return /(더|추가|붙|넣|써|사용|이어|정리|마무리|보세요|해보세요|바꿔|늘려|구체|try|add|use|connect|include)/i.test(text);
}

export function getNextFlowSuggestion(kind: "emotion" | "reflection", value?: string | null) {
  if (isActionableFlowSuggestion(value)) {
    return trimText(value);
  }

  if (kind === "emotion") {
    return "다음에는 그때 기분이 어떻게 바뀌었는지 한 문장 더 붙여 보세요.";
  }

  return "마지막에 오늘 일로 무엇을 느꼈는지 짧게 정리해 보세요.";
}

export function formatConnectionTipSuggestion(tips?: string[] | null) {
  const cleanedTips = (tips ?? []).map((tip) => trimText(tip)).filter(Boolean);
  if (cleanedTips.length === 0) {
    return "Then, after that 같은 표현으로 장면을 이어 보세요.";
  }

  const hasSentenceLikeTip = cleanedTips.some((tip) =>
    tip.length > 24 || /[가-힣].*(보세요|좋아요|자연스러워요|맞춰|이어)/.test(tip)
  );
  if (hasSentenceLikeTip) {
    return cleanedTips.join(" ");
  }

  return `다음에는 ${cleanedTips.join(" · ")} 같은 표현으로 장면을 이어 보세요.`;
}

export function getDiaryFeedbackHeadline(feedback: DiaryFeedback) {
  switch (feedback.diaryAnswerBand) {
    case "DIARY_TOO_SHORT":
      return "조금만 더 쓰면 좋은 일기가 돼요";
    case "DIARY_NOT_ENGLISH":
      return "쉬운 영어 문장으로 옮겨보면 좋아요";
    case "DIARY_GRAMMAR_BLOCKING":
      return "의미가 보이도록 문장을 먼저 정리했어요";
    case "DIARY_FLOW_THIN":
      return "일기의 흐름을 더 살릴 수 있어요";
    case "DIARY_NATURAL_COMPLETE":
      return "이미 자연스러운 일기예요";
    default:
      return "일기를 더 자연스럽게 다듬었어요";
  }
}
