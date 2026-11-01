import { isDailyDifficulty, normalizeDailyDifficulty } from "@/lib/practice";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import { formatNowInEnglishDateLabel, type NowInEnglishEntry } from "@/lib/now-in-english";
import type {
  Feedback,
  HistoryAttempt,
  HistorySession,
  Prompt,
  SavedExpression
} from "@/lib/types";

// 기록 화면의 타입, 상수, 기록 날짜·월 달력·저장 표현(출처·태그·검색·태그 연습)·기록에서 피드백 다시 만들기 계산(순수 함수).
export type RecordsMonthCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  hasRecords: boolean;
  isSelected: boolean;
};

export type RecordsMonthCalendarData = {
  monthLabel: string;
  cells: RecordsMonthCalendarCell[];
};

export type RecordsContentTab = "history" | "diary" | "now" | "expressions";
export type NowEnglishRecordGroup = {
  dateKey: string;
  label: string;
  entries: NowInEnglishEntry[];
};

export const INITIAL_VISIBLE_DATE_GROUPS = 5;
// 기록은 한 번에 이만큼씩 받는다. 끝까지 받았는지는 받은 개수로 안다.
export const HISTORY_PAGE_SIZE = 30;
export const TAG_PRACTICE_EXPRESSION_LIMIT = 5;
export const CALENDAR_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function getLatestAttempt(session: HistorySession) {
  return session.attempts[session.attempts.length - 1] ?? null;
}

export function getLatestSessionTimestamp(session: HistorySession) {
  return getLatestAttempt(session)?.createdAt ?? session.updatedAt ?? session.createdAt;
}

export function formatHistoryDateKey(dateTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date(dateTime));
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function formatHistoryDateHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${dateKey}T00:00:00+09:00`));

  return `${year}년 ${month}월 ${day}일 ${weekday}`;
}

export function formatHistoryTime(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

export function parseHistoryDateKeyAsDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+09:00`);
}

export function addCalendarDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getCalendarMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function formatCalendarMonthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function buildRecordsMonthCalendar(
  recordDateKeys: Set<string>,
  visibleMonth: Date,
  selectedDateKey: string
): RecordsMonthCalendarData {
  const monthStart = getCalendarMonthStart(visibleMonth);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12);
  const calendarStart = addCalendarDays(monthStart, -monthStart.getDay());
  const calendarEnd = addCalendarDays(monthEnd, 6 - monthEnd.getDay());
  const cells: RecordsMonthCalendarCell[] = [];

  for (
    let currentDate = new Date(calendarStart);
    currentDate <= calendarEnd;
    currentDate = addCalendarDays(currentDate, 1)
  ) {
    const key = formatHistoryDateKey(currentDate.toISOString());
    cells.push({
      key,
      dayNumber: currentDate.getDate(),
      isCurrentMonth:
        currentDate.getFullYear() === visibleMonth.getFullYear() &&
        currentDate.getMonth() === visibleMonth.getMonth(),
      hasRecords: recordDateKeys.has(key),
      isSelected: key === selectedDateKey
    });
  }

  return {
    monthLabel: formatCalendarMonthLabel(visibleMonth),
    cells
  };
}

export function normalizeRecordsContentTab(value: unknown): RecordsContentTab {
  if (value === "diary" || value === "now" || value === "expressions") {
    return value;
  }

  return "history";
}

export function buildNowEnglishRecordGroups(entries: NowInEnglishEntry[]): NowEnglishRecordGroup[] {
  const grouped = new Map<string, NowInEnglishEntry[]>();
  entries.forEach((entry) => {
    grouped.set(entry.dateKey, [...(grouped.get(entry.dateKey) ?? []), entry]);
  });

  return Array.from(grouped.entries())
    .sort(([leftDateKey], [rightDateKey]) => rightDateKey.localeCompare(leftDateKey))
    .map(([dateKey, groupedEntries]) => ({
      dateKey,
      label: formatNowInEnglishDateLabel(dateKey),
      entries: groupedEntries
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }));
}

export function getHistoryWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getAttemptLabel(value?: string | null) {
  return value === "REWRITE" ? "다시쓰기" : "첫 답변";
}

export function getAttemptCardLabel(attempt: HistoryAttempt) {
  return `${attempt.attemptNo}차 ${attempt.attemptType === "REWRITE" ? "다시쓰기" : "초안"}`;
}

export function getSavedExpressionSourceLabel(sourceType: SavedExpression["sourceType"]) {
  switch (sourceType) {
    case "USED_EXPRESSION":
      return "내가 쓴 표현";
    case "COACH_RECOMMENDATION":
      return "AI 코치 추천";
    case "REFINEMENT_EXPRESSION":
      return "표현 더하기";
    case "DIARY_EXPRESSION":
      return "영어일기 표현";
    default:
      return "저장한 표현";
  }
}

export function formatSavedExpressionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function normalizeSavedExpressionTag(tag?: string | null) {
  return tag?.trim().toLowerCase() ?? "";
}

export function normalizeSavedExpressionTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => normalizeSavedExpressionTag(tag))
        .filter(Boolean)
    )
  );
}

export function getSavedExpressionSourceTag(sourceType: SavedExpression["sourceType"]) {
  switch (sourceType) {
    case "USED_EXPRESSION":
      return "used_expression";
    case "COACH_RECOMMENDATION":
      return "coach_recommendation";
    case "REFINEMENT_EXPRESSION":
      return "refinement_expression";
    case "DIARY_EXPRESSION":
      return "diary_expression";
    default:
      return null;
  }
}

export const SAVED_EXPRESSION_TAG_LABELS: Record<string, string> = {
  used_expression: "내가 쓴 표현",
  refinement_expression: "표현 더하기",
  coach_recommendation: "AI 코치 추천",
  diary_expression: "영어일기 표현",
  verb_phrase: "동사 표현",
  noun_phrase: "명사 표현",
  adjective_phrase: "형용사 표현",
  sentence_starter: "첫 문장 스타터",
  frequency_expression: "빈도 표현",
  time_expression: "시간 표현",
  place_expression: "장소 표현",
  reason_expression: "이유 표현",
  example_expression: "예시 표현",
  opinion_expression: "의견 표현",
  comparison_expression: "비교 표현",
  feeling_expression: "감정 표현",
  daily_routine: "일상 루틴",
  home: "집",
  school: "학교",
  work: "일",
  study: "공부",
  meal: "식사",
  exercise: "운동",
  hobby: "취미",
  travel: "여행",
  shopping: "쇼핑",
  sleep: "수면",
  health: "건강",
  relationship: "관계",
  technology: "기술",
  present_habit: "현재 습관",
  past_experience: "과거 경험",
  future_plan: "미래 계획"
};

export function formatSavedExpressionTagLabel(tag: string) {
  const normalizedTag = tag.trim().toLowerCase();
  return (
    SAVED_EXPRESSION_TAG_LABELS[normalizedTag] ??
    tag.trim().replace(/[_-]+/g, " ")
  );
}

export function getVisibleSavedExpressionTags(savedExpression: SavedExpression) {
  const sourceTag = getSavedExpressionSourceTag(savedExpression.sourceType);
  return normalizeSavedExpressionTags(savedExpression.tags).filter((tag) => tag !== sourceTag);
}

export function normalizeSavedExpressionSearchValue(value?: string | null) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function normalizeSavedExpressionSearchQuery(value: string) {
  return normalizeSavedExpressionSearchValue(value);
}

export function normalizeSavedExpressionTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export const TAG_PRACTICE_TRAILING_WEAK_TOKENS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "to",
  "with",
  "your",
  "his",
  "her"
]);

export function isEligibleTagPracticeExpression(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const tokens = normalized.toLowerCase().split(" ");
  const lastToken = tokens[tokens.length - 1];
  return !TAG_PRACTICE_TRAILING_WEAK_TOKENS.has(lastToken);
}

export function buildSavedExpressionSearchText(savedExpression: SavedExpression) {
  const visibleTags = getVisibleSavedExpressionTags(savedExpression);
  const sourceTag = getSavedExpressionSourceTag(savedExpression.sourceType);

  return [
    savedExpression.expression,
    savedExpression.meaningKo,
    savedExpression.exampleEn,
    savedExpression.promptQuestionEn,
    savedExpression.promptQuestionKo,
    savedExpression.promptTopic,
    sourceTag,
    getSavedExpressionSourceLabel(savedExpression.sourceType),
    ...visibleTags,
    ...visibleTags.map((tag) => formatSavedExpressionTagLabel(tag))
  ]
    .map((value) => normalizeSavedExpressionSearchValue(value))
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function collectTagPracticeExpressions(
  tag: string,
  anchorExpression: SavedExpression,
  savedExpressions: SavedExpression[]
) {
  const normalizedTag = normalizeSavedExpressionTag(tag);
  const anchorPromptId = trimSavedExpressionLookupValue(anchorExpression.promptId);
  const uniqueExpressions = new Set<string>();
  const collectedExpressions: string[] = [];

  const prioritizedExpressions = [
    anchorExpression,
    ...savedExpressions.filter(
      (item) =>
        item.id !== anchorExpression.id &&
        getVisibleSavedExpressionTags(item).includes(normalizedTag) &&
        trimSavedExpressionLookupValue(item.promptId) === anchorPromptId
    ),
    ...savedExpressions.filter(
      (item) =>
        item.id !== anchorExpression.id &&
        getVisibleSavedExpressionTags(item).includes(normalizedTag) &&
        trimSavedExpressionLookupValue(item.promptId) !== anchorPromptId
    )
  ];

  for (const item of prioritizedExpressions) {
    const expression = item.expression.trim();
    const normalizedExpression = normalizeSavedExpressionTextKey(expression);

    if (
      !expression ||
      uniqueExpressions.has(normalizedExpression) ||
      !isEligibleTagPracticeExpression(expression)
    ) {
      continue;
    }

    uniqueExpressions.add(normalizedExpression);
    collectedExpressions.push(expression);

    if (collectedExpressions.length >= TAG_PRACTICE_EXPRESSION_LIMIT) {
      break;
    }
  }

  return collectedExpressions;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getSavedExpressionPromptText(savedExpression: SavedExpression) {
  return (
    savedExpression.promptQuestionEn?.trim() ||
    savedExpression.promptQuestionKo?.trim() ||
    savedExpression.promptTopic?.trim() ||
    ""
  );
}

export function trimSavedExpressionLookupValue(value?: string | null) {
  return value?.trim() ?? "";
}

export function resolveSavedExpressionPracticeTarget(
  savedExpression: SavedExpression,
  linkedSession?: HistorySession | null
) {
  const promptId =
    trimSavedExpressionLookupValue(savedExpression.promptId) ||
    trimSavedExpressionLookupValue(linkedSession?.promptId);
  const difficultyCandidate =
    trimSavedExpressionLookupValue(savedExpression.promptDifficulty) ||
    trimSavedExpressionLookupValue(linkedSession?.difficulty);
  const normalizedDifficulty = normalizeDailyDifficulty(difficultyCandidate, "I");

  if (!promptId || !isDailyDifficulty(normalizedDifficulty)) {
    return null;
  }

  return {
    promptId,
    difficulty: normalizedDifficulty
  };
}

export function buildHistoryPrompt(session: HistorySession): Prompt {
  return {
    id: session.promptId,
    topic: session.topic,
    topicCategory: "",
    topicDetail: "",
    difficulty: session.difficulty,
    questionEn: session.questionEn,
    questionKo: session.questionKo,
    tip: ""
  };
}

export function buildHistoryFeedback(session: HistorySession, attempt: HistoryAttempt): Feedback {
  const visibleFeedback = attempt.visibleFeedback ?? null;
  const readyToFinish = visibleFeedback?.state === "READY_TO_FINISH";
  return {
    promptId: session.promptId,
    sessionId: session.sessionId,
    attemptNo: attempt.attemptNo,
    loopComplete: readyToFinish,
    completionMessage: visibleFeedback?.completion?.headline ?? null,
    summary: attempt.feedbackSummary ?? "",
    strengths: visibleFeedback?.strength ? [visibleFeedback.strength] : [],
    inlineFeedback: null,
    revisedAnswer: null,
    refinementExpressions: visibleFeedback?.refinementExpressions ?? [],
    modelAnswer: visibleFeedback?.modelAnswer ?? "",
    modelAnswerKo: visibleFeedback?.modelAnswerKo ?? null,
    rewriteChallenge:
      visibleFeedback?.coachMove?.instruction ?? visibleFeedback?.coachMove?.focus ?? "",
    ui: null,
    loop: {
      status: visibleFeedback?.state ?? "NEEDS_REWRITE",
      nextAction: readyToFinish ? "finish" : "rewrite",
      nextActionLabel: readyToFinish ? "루프 완료하기" : "다시 써보기"
    },
    coachMove: visibleFeedback?.coachMove ?? null,
    completion: visibleFeedback?.completion ?? null,
    visibleFeedback
  };
}

export function buildHistoryFeedbackState(
  session: HistorySession,
  attempt: HistoryAttempt
): PracticeFeedbackState {
  return {
    difficulty: session.difficulty,
    prompt: buildHistoryPrompt(session),
    answer: attempt.answerText,
    feedback: buildHistoryFeedback(session, attempt)
  };
}
