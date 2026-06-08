import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import MobileScreenHeader from "@/components/mobile-screen-header";
import { PracticeFeedbackContent } from "@/components/practice-feedback-content";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import {
  deleteSavedExpression,
  getAnswerHistory,
  getSavedExpressions,
  getTodayWritingStatus
} from "@/lib/api";
import { getDifficultyLabel } from "@/lib/difficulty";
import { buildLoginHref } from "@/lib/login-redirect";
import { isDailyDifficulty, normalizeDailyDifficulty } from "@/lib/practice";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import {
  formatNowInEnglishDateLabel,
  formatNowInEnglishTime,
  getNowInEnglishSummary,
  type NowInEnglishEntry
} from "@/lib/now-in-english";
import type {
  Feedback,
  HistoryAttempt,
  HistorySession,
  Prompt,
  SavedExpression,
  TodayWritingStatus
} from "@/lib/types";

type HistoryComparisonView = {
  initialAttempt: HistoryAttempt;
  rewriteAttempt: HistoryAttempt;
  segments: RenderedInlineFeedbackSegment[];
};

type HistorySessionDetailModalProps = {
  feedbackState: PracticeFeedbackState | null;
  onClose: () => void;
  onOpenFeedback: (attempt: HistoryAttempt) => void;
  onReturnToHistory: () => void;
  session: HistorySession | null;
};

type RecordsMonthCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  hasRecords: boolean;
  isSelected: boolean;
};

type RecordsMonthCalendarData = {
  monthLabel: string;
  cells: RecordsMonthCalendarCell[];
};

type RecordsContentTab = "history" | "diary" | "now" | "expressions";
type NowEnglishRecordGroup = {
  dateKey: string;
  label: string;
  entries: NowInEnglishEntry[];
};

const INITIAL_VISIBLE_DATE_GROUPS = 5;
const TAG_PRACTICE_EXPRESSION_LIMIT = 5;
const CALENDAR_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function getLatestAttempt(session: HistorySession) {
  return session.attempts[session.attempts.length - 1] ?? null;
}

function getLatestSessionTimestamp(session: HistorySession) {
  return getLatestAttempt(session)?.createdAt ?? session.updatedAt ?? session.createdAt;
}

function formatHistoryDateKey(dateTime: string) {
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

function formatHistoryDateHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${dateKey}T00:00:00+09:00`));

  return `${year}년 ${month}월 ${day}일 ${weekday}`;
}

function formatHistoryTime(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

function parseHistoryDateKeyAsDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+09:00`);
}

function addCalendarDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getCalendarMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatCalendarMonthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildRecordsMonthCalendar(
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

function normalizeRecordsContentTab(value: unknown): RecordsContentTab {
  if (value === "diary" || value === "now" || value === "expressions") {
    return value;
  }

  return "history";
}

function buildNowEnglishRecordGroups(entries: NowInEnglishEntry[]): NowEnglishRecordGroup[] {
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

function getHistoryWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getAttemptLabel(value?: string | null) {
  return value === "REWRITE" ? "다시쓰기" : "첫 답변";
}

function getAttemptCardLabel(attempt: HistoryAttempt) {
  return `${attempt.attemptNo}차 ${attempt.attemptType === "REWRITE" ? "다시쓰기" : "초안"}`;
}

function getSavedExpressionSourceLabel(sourceType: SavedExpression["sourceType"]) {
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

function formatSavedExpressionDate(value: string) {
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

function normalizeSavedExpressionTag(tag?: string | null) {
  return tag?.trim().toLowerCase() ?? "";
}

function normalizeSavedExpressionTags(tags?: string[] | null) {
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

function getSavedExpressionSourceTag(sourceType: SavedExpression["sourceType"]) {
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

const SAVED_EXPRESSION_TAG_LABELS: Record<string, string> = {
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

function formatSavedExpressionTagLabel(tag: string) {
  const normalizedTag = tag.trim().toLowerCase();
  return (
    SAVED_EXPRESSION_TAG_LABELS[normalizedTag] ??
    tag.trim().replace(/[_-]+/g, " ")
  );
}

function getVisibleSavedExpressionTags(savedExpression: SavedExpression) {
  const sourceTag = getSavedExpressionSourceTag(savedExpression.sourceType);
  return normalizeSavedExpressionTags(savedExpression.tags).filter((tag) => tag !== sourceTag);
}

function normalizeSavedExpressionSearchValue(value?: string | null) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function normalizeSavedExpressionSearchQuery(value: string) {
  return normalizeSavedExpressionSearchValue(value);
}

function normalizeSavedExpressionTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const TAG_PRACTICE_TRAILING_WEAK_TOKENS = new Set([
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

function isEligibleTagPracticeExpression(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const tokens = normalized.toLowerCase().split(" ");
  const lastToken = tokens[tokens.length - 1];
  return !TAG_PRACTICE_TRAILING_WEAK_TOKENS.has(lastToken);
}

function buildSavedExpressionSearchText(savedExpression: SavedExpression) {
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

function collectTagPracticeExpressions(
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderSavedExpressionExample(exampleEn?: string | null, expression?: string | null) {
  const trimmedExample = exampleEn?.trim() ?? "";
  const trimmedExpression = expression?.trim() ?? "";

  if (!trimmedExample) {
    return null;
  }

  if (!trimmedExpression) {
    return <Text style={styles.savedExpressionExample}>{trimmedExample}</Text>;
  }

  const expressionPattern = new RegExp(`(${escapeRegExp(trimmedExpression)})`, "gi");
  if (!expressionPattern.test(trimmedExample)) {
    return <Text style={styles.savedExpressionExample}>{trimmedExample}</Text>;
  }

  const segments = trimmedExample.split(expressionPattern);

  return (
    <Text style={styles.savedExpressionExample}>
      {segments.map((segment, index) =>
        index % 2 === 1 ? (
          <Text key={`saved-expression-example-match-${index}`} style={styles.savedExpressionExampleHighlight}>
            {segment}
          </Text>
        ) : (
          segment
        )
      )}
    </Text>
  );
}

function getSavedExpressionPromptText(savedExpression: SavedExpression) {
  return (
    savedExpression.promptQuestionEn?.trim() ||
    savedExpression.promptQuestionKo?.trim() ||
    savedExpression.promptTopic?.trim() ||
    ""
  );
}

function trimSavedExpressionLookupValue(value?: string | null) {
  return value?.trim() ?? "";
}

function resolveSavedExpressionPracticeTarget(
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

function buildHistoryPrompt(session: HistorySession): Prompt {
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

function buildHistoryFeedback(session: HistorySession, attempt: HistoryAttempt): Feedback {
  return {
    promptId: session.promptId,
    sessionId: session.sessionId,
    attemptNo: attempt.attemptNo,
    score: attempt.score,
    loopComplete: attempt.feedback.loopComplete,
    completionMessage: attempt.feedback.completionMessage,
    summary: attempt.feedback.summary ?? attempt.feedbackSummary ?? "",
    strengths: attempt.feedback.strengths ?? [],
    inlineFeedback: attempt.feedback.inlineFeedback ?? null,
    correctedAnswer: attempt.feedback.correctedAnswer,
    usedExpressions:
      attempt.usedExpressions?.map((expression) => ({
        expression: expression.expression,
        matchedText: expression.matchedText ?? null
      })) ?? [],
    modelAnswer: attempt.feedback.modelAnswer ?? "",
    modelAnswerKo: attempt.feedback.modelAnswerKo ?? null,
    rewriteChallenge: attempt.feedback.rewriteChallenge ?? "",
    ui: attempt.feedback.ui ?? null
  };
}

function buildHistoryFeedbackState(
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

function buildHistoryComparisonView(session: HistorySession): HistoryComparisonView | null {
  const initialAttempt =
    session.attempts.find((attempt) => attempt.attemptType === "INITIAL") ?? session.attempts[0];
  const rewriteAttempts = session.attempts.filter((attempt) => attempt.attemptType === "REWRITE");
  const rewriteAttempt = rewriteAttempts[rewriteAttempts.length - 1];

  if (!initialAttempt || !rewriteAttempt) {
    return null;
  }

  const original = initialAttempt.answerText.trim();
  const revised = rewriteAttempt.answerText.trim();

  if (!original || !revised || original === revised) {
    return null;
  }

  return {
    initialAttempt,
    rewriteAttempt,
    segments: buildInlineFeedbackSegments(initialAttempt.answerText, rewriteAttempt.answerText, null)
  };
}

function renderComparisonSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={styles.diffRemovedText}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={styles.diffAddedText}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={styles.diffRemovedText}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={styles.diffAddedText}>
          {segment.text}
        </Text>
      ) : null;
    default:
      return null;
  }
}

function HistorySessionDetailModal({
  feedbackState,
  onClose,
  onOpenFeedback,
  onReturnToHistory,
  session
}: HistorySessionDetailModalProps) {
  const orderedAttempts = useMemo(
    () =>
      session
        ? [...session.attempts].sort(
            (left, right) =>
              left.attemptNo - right.attemptNo ||
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          )
        : [],
    [session]
  );

  const latestAttempt = useMemo(() => (session ? getLatestAttempt(session) : null), [session]);
  const comparisonView = useMemo(() => (session ? buildHistoryComparisonView(session) : null), [session]);
  const isFeedbackView = Boolean(feedbackState);

  if (!session) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={isFeedbackView ? onReturnToHistory : onClose}
    >
      <SafeAreaView style={styles.modalSafeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderCopy}>
            <Text style={styles.modalTitle}>{isFeedbackView ? "피드백 보기" : "질문 기록"}</Text>
          </View>
          <Pressable
            style={styles.modalCloseButton}
            hitSlop={10}
            onPress={isFeedbackView ? onReturnToHistory : onClose}
          >
            <Text style={styles.modalCloseText}>{isFeedbackView ? "목록으로" : "닫기"}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {feedbackState ? (
            <PracticeFeedbackContent
              feedbackState={feedbackState}
              showCompletionSummary={false}
            />
          ) : (
            <View style={styles.sessionDetailStack}>
              <View style={styles.promptCard}>
                <View style={styles.chipRow}>
                  <View style={styles.topicChip}>
                    <Text style={styles.topicChipText}>{session.topic}</Text>
                  </View>
                  <View style={styles.neutralChip}>
                    <Text style={styles.neutralChipText}>
                      {getDifficultyLabel(session.difficulty)}
                    </Text>
                  </View>
                  {latestAttempt ? (
                    <View style={styles.neutralChip}>
                      <Text style={styles.neutralChipText}>
                        {getAttemptLabel(latestAttempt.attemptType)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.promptQuestionEn}>{session.questionEn}</Text>
                <Text style={styles.promptQuestionKo}>{session.questionKo}</Text>
              </View>

              {comparisonView ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>최종 답안</Text>
                    <Text style={styles.detailMeta}>
                      {`${getHistoryWordCount(comparisonView.initialAttempt.answerText)}단어 → ${getHistoryWordCount(comparisonView.rewriteAttempt.answerText)}단어`}
                    </Text>
                  </View>
                  <View style={styles.comparisonStack}>
                    <View style={[styles.comparisonCard, styles.comparisonCardOriginal]}>
                      <Text style={styles.comparisonLabel}>내 초안</Text>
                      <Text style={styles.comparisonBody}>
                        {comparisonView.segments.map((segment, index) =>
                          renderComparisonSegment(segment, "original", index)
                        )}
                      </Text>
                    </View>
                    <View style={[styles.comparisonCard, styles.comparisonCardRevised]}>
                      <Text style={[styles.comparisonLabel, styles.comparisonLabelPrimary]}>
                        최종 답안
                      </Text>
                      <Text style={[styles.comparisonBody, styles.comparisonBodyPrimary]}>
                        {comparisonView.segments.map((segment, index) =>
                          renderComparisonSegment(segment, "revised", index)
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.detailNoticeCard}>
                  <Text style={styles.detailNoticeTitle}>아직 최종 답안이 없어요</Text>
                  <Text style={styles.detailNoticeBody}>
                    이 질문에서는 아직 다시쓰기 답변이 없어요. 아래 답변 기록에서 각 시도의
                    피드백을 열어 흐름을 확인해 보세요.
                  </Text>
                </View>
              )}

              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>이 질문에 남긴 답변</Text>
                  <Text style={styles.detailMeta}>{`${orderedAttempts.length}개 시도`}</Text>
                </View>

                <View style={styles.attemptStack}>
                  {orderedAttempts.map((attempt, attemptIndex) => {
                    const isLatest = latestAttempt?.id === attempt.id;

                    return (
                      <View
                        key={attempt.id}
                        style={[
                          styles.attemptCard,
                          attemptIndex > 0 && styles.attemptCardSeparated,
                          attempt.attemptType === "REWRITE"
                            ? styles.attemptCardRewrite
                            : styles.attemptCardInitial
                        ]}
                      >
                        <View style={styles.attemptHeader}>
                          <View style={styles.attemptHeaderCopy}>
                            <View style={styles.attemptChipRow}>
                              <View
                                style={[
                                  styles.attemptTypeChip,
                                  attempt.attemptType === "REWRITE"
                                    ? styles.attemptTypeChipRewrite
                                    : styles.attemptTypeChipInitial
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.attemptTypeChipText,
                                    attempt.attemptType === "REWRITE"
                                      ? styles.attemptTypeChipTextRewrite
                                      : styles.attemptTypeChipTextInitial
                                  ]}
                                >
                                  {getAttemptCardLabel(attempt)}
                                </Text>
                              </View>
                              {isLatest ? (
                                <View style={styles.latestChip}>
                                  <Text style={styles.latestChipText}>마지막 답변</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.attemptMeta}>
                              {`${formatHistoryTime(attempt.createdAt)} · ${getHistoryWordCount(attempt.answerText)}단어`}
                            </Text>
                          </View>

                          <Pressable
                            style={({ pressed }) => [
                              styles.inlineButton,
                              pressed && styles.inlineButtonPressed
                            ]}
                            onPress={() => onOpenFeedback(attempt)}
                          >
                            <Text style={styles.inlineButtonText}>피드백 보기</Text>
                          </Pressable>
                        </View>

                        <Text style={styles.attemptAnswer}>{attempt.answerText}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F2EB" },
  screen: { flex: 1 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 28,
    gap: 20
  },
  heroSection: { gap: 10 },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  heroUnderline: {
    width: 160,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  profileCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  name: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: "#232128" },
  email: { fontSize: 15, color: "#6A5D4E" },
  metricRow: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#FBF5EE",
    paddingVertical: 14,
    alignItems: "center",
    gap: 4
  },
  metricValue: { fontSize: 20, fontWeight: "900", color: "#2A2620" },
  metricLabel: { fontSize: 12, fontWeight: "800", color: "#856C53" },
  diaryShortcutButton: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: "#FFF4E1",
    borderWidth: 1,
    borderColor: "#EACFA9",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  diaryShortcutButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  diaryShortcutButtonArrow: {
    fontSize: 18,
    fontWeight: "900",
    color: "#A76518"
  },
  emptyCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyBody: { fontSize: 15, lineHeight: 23, color: "#6A5D4E" },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#F5A33B",
    alignSelf: "flex-start"
  },
  primaryButtonText: { fontSize: 16, fontWeight: "900", color: "#232128" },
  outlineButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#E2C5A6",
    backgroundColor: "#FFFEFC",
    alignSelf: "flex-start"
  },
  outlineButtonText: { fontSize: 16, fontWeight: "900", color: "#8A5A1E" },
  recordActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  errorText: { fontSize: 14, lineHeight: 20, color: "#B34A2B" }
});
const listStyles = StyleSheet.create({
  contentTabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  contentTabButton: {
    flexGrow: 1,
    flexBasis: "22%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingVertical: 11,
    paddingHorizontal: 10
  },
  contentTabButtonActive: {
    backgroundColor: "#F5A33B",
    borderColor: "#E49A3B"
  },
  contentTabButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#7A6244"
  },
  contentTabButtonTextActive: {
    color: "#232128"
  },
  historyBoard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 16
  },
  sectionHeader: { gap: 6 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 6
  },
  sectionTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -1, color: "#232128" },
  sectionMeta: { fontSize: 14, fontWeight: "700", color: "#88745A" },
  savedExpressionControls: {
    gap: 10
  },
  savedExpressionSearchInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    color: "#2C2924"
  },
  savedExpressionFilterRow: {
    gap: 8,
    paddingRight: 2
  },
  savedExpressionFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D8C7",
    backgroundColor: "#F7EEE4",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  savedExpressionFilterChipActive: {
    borderColor: "#E49A3B",
    backgroundColor: "#F5A33B"
  },
  savedExpressionFilterChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7A6244"
  },
  savedExpressionFilterChipTextActive: {
    color: "#232128"
  },
  savedExpressionFilterChipCount: {
    fontSize: 11,
    fontWeight: "900",
    color: "#A18A72"
  },
  savedExpressionFilterChipCountActive: {
    color: "#232128"
  },
  savedExpressionFilterSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  savedExpressionFilterSummaryGroup: {
    gap: 6
  },
  savedExpressionFilterSummaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#8A7259",
    fontWeight: "700"
  },
  savedExpressionFilterClearText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    fontWeight: "900"
  },
  savedExpressionTagPracticeLink: {
    alignSelf: "flex-start",
    paddingVertical: 2
  },
  savedExpressionTagPracticeLinkText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    textDecorationLine: "underline",
    fontWeight: "800"
  },
  savedExpressionTagPracticeLinkTextDisabled: {
    color: "#B3A08B",
    textDecorationLine: "none"
  },
  savedExpressionList: {
    gap: 0
  },
  savedExpressionCard: {
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E6D8C8"
  },
  savedExpressionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  savedExpressionHeaderAside: {
    alignItems: "flex-end",
    gap: 8
  },
  savedExpressionMetaWrap: {
    flex: 1,
    gap: 8
  },
  savedExpressionText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2520"
  },
  savedExpressionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  savedExpressionSourceBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  savedExpressionSourceBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  savedExpressionSaveCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A7259"
  },
  savedExpressionDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0C5B4",
    backgroundColor: "#FFF0EA",
    alignItems: "center",
    justifyContent: "center"
  },
  savedExpressionMeaning: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F5D49",
    fontWeight: "700"
  },
  savedExpressionTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  savedExpressionTagChip: {
    borderRadius: 999,
    backgroundColor: "#F4EADF",
    borderWidth: 1,
    borderColor: "#E6D8C7",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  savedExpressionTagChipActive: {
    backgroundColor: "#FFF0D7",
    borderColor: "#F0B468"
  },
  savedExpressionTagChipText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#7A6244",
    fontWeight: "800"
  },
  savedExpressionTagChipTextActive: {
    color: "#A76518"
  },
  savedExpressionExample: {
    fontSize: 13,
    lineHeight: 20,
    color: "#866F56"
  },
  savedExpressionExampleHighlight: {
    fontWeight: "900",
    color: "#866F56"
  },
  savedExpressionActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  savedExpressionPromptLink: {
    paddingVertical: 2
  },
  savedExpressionPromptLinkText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    textDecorationLine: "underline",
    fontWeight: "700"
  },
  savedExpressionPracticeButton: {
    paddingVertical: 2
  },
  savedExpressionPracticeButtonInline: {
    paddingVertical: 2
  },
  savedExpressionPracticeButtonHidden: {
    display: "none"
  },
  savedExpressionPracticeButtonText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    textDecorationLine: "underline",
    fontWeight: "700"
  },
  savedExpressionHistoryButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0D1BD",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  savedExpressionHistoryButtonDisabled: {
    backgroundColor: "#F6F1EB",
    borderColor: "#E7DDD2"
  },
  savedExpressionHistoryButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7A6244"
  },
  savedExpressionHistoryButtonTextDisabled: {
    color: "#B2A08B"
  },
  savedExpressionPrompt: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6244"
  },
  savedExpressionDate: {
    fontSize: 12,
    lineHeight: 18,
    color: "#9A856D",
    textAlign: "right"
  },
  calendarOpenButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  calendarOpenButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7A6244"
  },
  dateFeed: { gap: 0 },
  showMoreButton: {
    alignSelf: "center",
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  showMoreButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  dateGroup: {
    backgroundColor: "transparent"
  },
  dateGroupSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E7D7C4",
    marginTop: 12,
    paddingTop: 12
  },
  dateHeading: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  dateHeadingCopy: { flex: 1, gap: 4 },
  dateTitle: { fontSize: 18, fontWeight: "900", color: "#2A2520" },
  dateMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  dateToggle: { fontSize: 26, lineHeight: 28, fontWeight: "700", color: "#8C5D24" },
  questionStack: { paddingHorizontal: 0, paddingBottom: 0 },
  questionCard: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 10
  },
  questionCardSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E9DCCF"
  },
  questionCardInteractive: {},
  questionCardPressed: { opacity: 0.72 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  topicChipText: { fontSize: 12, fontWeight: "900", color: "#A76518" },
  neutralChip: {
    borderRadius: 999,
    backgroundColor: "#EFE7DD",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  neutralChipText: { fontSize: 12, fontWeight: "800", color: "#7C6B57" },
  questionEn: { fontSize: 21, lineHeight: 29, fontWeight: "800", color: "#2A2520" },
  questionKo: { fontSize: 15, lineHeight: 22, color: "#756757" },
  nowRecordCard: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 8
  },
  nowRecordTime: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: "#A26A25"
  },
  nowRecordText: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "800",
    color: "#2A2520"
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(35, 33, 40, 0.18)"
  },
  calendarModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  calendarModalFrame: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  calendarModalCard: {
    borderRadius: 28,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  calendarMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  calendarMonthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2"
  },
  calendarMonthNavButtonDisabled: {
    opacity: 0.35
  },
  calendarMonthNavButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7A6244"
  },
  calendarMonthNavButtonTextDisabled: {
    color: "#A99987"
  },
  calendarModalTitle: {
    minWidth: 120,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#232128",
    textAlign: "center"
  },
  calendarModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  calendarModalCloseText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7A6244"
  },
  calendarWeekHeader: {
    flexDirection: "row"
  },
  calendarWeekLabel: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: "#9C7A49"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarCellWrap: {
    width: "14.2857%",
    padding: 4
  },
  calendarCell: {
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(216, 185, 133, 0.22)"
  },
  calendarCellHasRecords: {
    backgroundColor: "#FFF1D7",
    borderColor: "#EACFA9"
  },
  calendarCellSelected: {
    backgroundColor: "#F2A14A",
    borderColor: "#E09128"
  },
  calendarCellOutside: {
    opacity: 0.42
  },
  calendarCellText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6E573A"
  },
  calendarCellTextHasRecords: {
    color: "#8A5A1E"
  },
  calendarCellTextSelected: {
    color: "#2E2416"
  },
  calendarCellTextOutside: {
    color: "#BCA98B"
  },
  calendarFooterMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8A765D",
    textAlign: "center"
  }
});
const detailStyles = StyleSheet.create({
  modalSafeArea: { flex: 1, backgroundColor: "#F7F2EB" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8DACB"
  },
  modalHeaderCopy: { flex: 1, gap: 4 },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  modalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  modalCloseText: { fontSize: 14, fontWeight: "800", color: "#7B6752" },
  modalContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  sessionDetailStack: { gap: 16 },
  promptCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  promptQuestionEn: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  promptQuestionKo: { fontSize: 15, lineHeight: 23, color: "#6E6153" },
  detailCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900", letterSpacing: -0.6, color: "#232128" },
  detailMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  detailNoticeCard: {
    backgroundColor: "#FFF8EE",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D8C2",
    gap: 8
  },
  detailNoticeTitle: { fontSize: 18, fontWeight: "900", color: "#232128" },
  detailNoticeBody: { fontSize: 15, lineHeight: 22, color: "#6A5D4E" },
  comparisonStack: { gap: 0 },
  comparisonCard: {
    paddingVertical: 12,
    gap: 10
  },
  comparisonCardOriginal: {
    backgroundColor: "transparent"
  },
  comparisonCardRevised: {
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: "#E8DACB",
    paddingTop: 16,
    marginTop: 4
  },
  comparisonLabel: { fontSize: 14, fontWeight: "900", color: "#A06213" },
  comparisonLabelPrimary: { color: "#345891" },
  comparisonBody: { fontSize: 15, lineHeight: 24, color: "#4C4134" },
  comparisonBodyPrimary: { color: "#223654" },
  diffRemovedText: {
    color: "#8C5549",
    backgroundColor: "#F8DED7",
    textDecorationLine: "line-through"
  },
  diffAddedText: {
    color: "#244F7A",
    backgroundColor: "#DCE8FF"
  },
  attemptStack: { gap: 0 },
  attemptCard: {
    paddingVertical: 16,
    gap: 14
  },
  attemptCardInitial: {
    backgroundColor: "transparent"
  },
  attemptCardRewrite: {
    backgroundColor: "transparent"
  },
  attemptCardSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E8DACB"
  },
  attemptHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  attemptHeaderCopy: { flex: 1, gap: 8 },
  attemptChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attemptTypeChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  attemptTypeChipInitial: { backgroundColor: "#EFE7DD" },
  attemptTypeChipRewrite: { backgroundColor: "#FFF0D7" },
  attemptTypeChipText: { fontSize: 12, fontWeight: "900" },
  attemptTypeChipTextInitial: { color: "#6F6253" },
  attemptTypeChipTextRewrite: { color: "#A76518" },
  latestChip: {
    borderRadius: 999,
    backgroundColor: "#F5A33B",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  latestChipText: { fontSize: 12, fontWeight: "900", color: "#232128" },
  attemptMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  inlineButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E0D1BD",
    backgroundColor: "#FFFEFC"
  },
  inlineButtonPressed: { opacity: 0.86 },
  inlineButtonText: { fontSize: 13, fontWeight: "900", color: "#7A6244" },
  attemptAnswer: { fontSize: 16, lineHeight: 24, color: "#2C2924" }
});

const styles = {
  ...baseStyles,
  ...listStyles,
  ...detailStyles
};

export default function RecordsScreen() {
  const params = useLocalSearchParams<{ date?: string; tab?: string }>();
  const requestedDateKey = typeof params.date === "string" ? params.date : "";
  const requestedTab = normalizeRecordsContentTab(params.tab);
  const highlightedDateKey = /^\d{4}-\d{2}-\d{2}$/.test(requestedDateKey) ? requestedDateKey : "";
  const { currentUser, isHydrating, refreshSession } = useSession();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const dateGroupOffsetsRef = useRef<Record<string, number>>({});
  const lastScrolledDateRef = useRef("");
  const [activeTab, setActiveTab] = useState<RecordsContentTab>(requestedTab);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>([]);
  const [isSavedExpressionsLoading, setIsSavedExpressionsLoading] = useState(false);
  const [nowEnglishEntries, setNowEnglishEntries] = useState<NowInEnglishEntry[]>([]);
  const [isNowEnglishLoading, setIsNowEnglishLoading] = useState(true);
  const [nowEnglishError, setNowEnglishError] = useState("");
  const [savedExpressionError, setSavedExpressionError] = useState("");
  const [deletingSavedExpressionId, setDeletingSavedExpressionId] = useState<number | null>(null);
  const [savedExpressionSearchQuery, setSavedExpressionSearchQuery] = useState("");
  const [selectedSavedExpressionTag, setSelectedSavedExpressionTag] = useState<string | null>(null);
  const [selectedSavedExpressionTagAnchorId, setSelectedSavedExpressionTagAnchorId] = useState<number | null>(
    null
  );
  const [openSavedExpressionPrompts, setOpenSavedExpressionPrompts] = useState<Record<number, boolean>>(
    {}
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [showAllDateGroups, setShowAllDateGroups] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() =>
    getCalendarMonthStart(new Date())
  );
  const [selectedDateKey, setSelectedDateKey] = useState(highlightedDateKey);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);
  const [selectedHistoryFeedback, setSelectedHistoryFeedback] =
    useState<PracticeFeedbackState | null>(null);
  const deferredSavedExpressionSearchQuery = useDeferredValue(savedExpressionSearchQuery);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const groupedHistoryEntries = useMemo(() => {
    const grouped = history.reduce<Record<string, HistorySession[]>>((accumulator, session) => {
      const dateKey = formatHistoryDateKey(getLatestSessionTimestamp(session));
      accumulator[dateKey] = [...(accumulator[dateKey] ?? []), session];
      return accumulator;
    }, {});

    return Object.keys(grouped)
      .sort((left, right) => right.localeCompare(left))
      .map((dateKey) => ({
        dateKey,
        sessions: [...grouped[dateKey]].sort((left, right) =>
          getLatestSessionTimestamp(right).localeCompare(getLatestSessionTimestamp(left))
        )
      }));
  }, [history]);

  const visibleGroupedHistoryEntries = useMemo(() => {
    if (
      showAllDateGroups ||
      groupedHistoryEntries.length <= INITIAL_VISIBLE_DATE_GROUPS
    ) {
      return groupedHistoryEntries;
    }

    const highlightedIndex = selectedDateKey
      ? groupedHistoryEntries.findIndex((entry) => entry.dateKey === selectedDateKey)
      : -1;
    const visibleCount =
      highlightedIndex >= 0
        ? Math.max(INITIAL_VISIBLE_DATE_GROUPS, highlightedIndex + 1)
        : INITIAL_VISIBLE_DATE_GROUPS;

    return groupedHistoryEntries.slice(0, visibleCount);
  }, [groupedHistoryEntries, selectedDateKey, showAllDateGroups]);

  const hiddenDateGroupCount = Math.max(
    groupedHistoryEntries.length - visibleGroupedHistoryEntries.length,
    0
  );
  const recordDateKeySet = useMemo(() => {
    const next = new Set<string>();
    groupedHistoryEntries.forEach((entry) => next.add(entry.dateKey));
    return next;
  }, [groupedHistoryEntries]);
  const latestRecordMonth = useMemo(
    () =>
      groupedHistoryEntries.length > 0
        ? getCalendarMonthStart(parseHistoryDateKeyAsDate(groupedHistoryEntries[0].dateKey))
        : getCalendarMonthStart(new Date()),
    [groupedHistoryEntries]
  );
  const earliestRecordMonth = useMemo(
    () =>
      groupedHistoryEntries.length > 0
        ? getCalendarMonthStart(
            parseHistoryDateKeyAsDate(
              groupedHistoryEntries[groupedHistoryEntries.length - 1].dateKey
            )
          )
        : getCalendarMonthStart(new Date()),
    [groupedHistoryEntries]
  );
  const monthCalendar = useMemo(
    () => buildRecordsMonthCalendar(recordDateKeySet, calendarMonthCursor, selectedDateKey),
    [calendarMonthCursor, recordDateKeySet, selectedDateKey]
  );
  const canGoToPreviousCalendarMonth = useMemo(
    () => !isSameCalendarMonth(calendarMonthCursor, earliestRecordMonth),
    [calendarMonthCursor, earliestRecordMonth]
  );
  const canGoToNextCalendarMonth = useMemo(
    () => !isSameCalendarMonth(calendarMonthCursor, latestRecordMonth),
    [calendarMonthCursor, latestRecordMonth]
  );
  const normalizedSavedExpressionSearch = useMemo(
    () => normalizeSavedExpressionSearchQuery(deferredSavedExpressionSearchQuery),
    [deferredSavedExpressionSearchQuery]
  );
  const savedExpressionTagOptions = useMemo(() => {
    const counts = new Map<string, number>();

    savedExpressions.forEach((item) => {
      getVisibleSavedExpressionTags(item).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((left, right) => {
        const countCompare = right[1] - left[1];
        if (countCompare !== 0) {
          return countCompare;
        }

        return formatSavedExpressionTagLabel(left[0]).localeCompare(
          formatSavedExpressionTagLabel(right[0]),
          "ko"
        );
      })
      .map(([tag, count]) => ({
        tag,
        count,
        label: formatSavedExpressionTagLabel(tag)
      }));
  }, [savedExpressions]);
  const visibleSavedExpressions = useMemo(() => {
    const sortedByLatest = [...savedExpressions].sort((left, right) => {
      const timeCompare = right.lastSavedAt.localeCompare(left.lastSavedAt);
      if (timeCompare !== 0) {
        return timeCompare;
      }

      return right.id - left.id;
    });
    const filteredExpressions = normalizedSavedExpressionSearch
      ? sortedByLatest.filter((item) =>
          buildSavedExpressionSearchText(item).includes(normalizedSavedExpressionSearch)
        )
      : sortedByLatest;

    if (!selectedSavedExpressionTag) {
      return filteredExpressions;
    }

    return [...filteredExpressions].sort((left, right) => {
      const leftMatchesTag = getVisibleSavedExpressionTags(left).includes(selectedSavedExpressionTag);
      const rightMatchesTag = getVisibleSavedExpressionTags(right).includes(selectedSavedExpressionTag);

      if (leftMatchesTag !== rightMatchesTag) {
        return leftMatchesTag ? -1 : 1;
      }

      const timeCompare = right.lastSavedAt.localeCompare(left.lastSavedAt);
      if (timeCompare !== 0) {
        return timeCompare;
      }

      return right.id - left.id;
    });
  }, [normalizedSavedExpressionSearch, savedExpressions, selectedSavedExpressionTag]);
  const savedExpressionSectionMeta = useMemo(() => {
    if (!normalizedSavedExpressionSearch && !selectedSavedExpressionTag) {
      return `${savedExpressions.length}개의 표현`;
    }

    return `${visibleSavedExpressions.length}개 결과 · 전체 ${savedExpressions.length}개`;
  }, [
    normalizedSavedExpressionSearch,
    savedExpressions.length,
    selectedSavedExpressionTag,
    visibleSavedExpressions.length
  ]);
  const nowEnglishRecordGroups = useMemo(
    () => buildNowEnglishRecordGroups(nowEnglishEntries),
    [nowEnglishEntries]
  );

  const loadHistory = useCallback(async () => {
    try {
      setIsHistoryLoading(true);
      setHistoryError("");
      const [historyResponse, status] = await Promise.all([
        getAnswerHistory(),
        getTodayWritingStatus().catch(() => null)
      ]);
      setHistory(historyResponse);
      setTodayStatus(status);
    } catch (caughtError) {
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "작문 기록을 불러오지 못했어요."
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const loadSavedExpressions = useCallback(async () => {
    try {
      setIsSavedExpressionsLoading(true);
      setSavedExpressionError("");
      const response = await getSavedExpressions();
      setSavedExpressions(response);
    } catch (caughtError) {
      setSavedExpressionError(
        caughtError instanceof Error ? caughtError.message : "저장한 표현을 불러오지 못했어요."
      );
    } finally {
      setIsSavedExpressionsLoading(false);
    }
  }, []);

  const loadNowEnglishRecords = useCallback(async () => {
    try {
      setIsNowEnglishLoading(true);
      setNowEnglishError("");
      const summary = await getNowInEnglishSummary();
      setNowEnglishEntries(summary.entries);
    } catch (caughtError) {
      setNowEnglishError(
        caughtError instanceof Error ? caughtError.message : "영어조각 기록을 불러오지 못했어요."
      );
    } finally {
      setIsNowEnglishLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNowEnglishRecords();
  }, [loadNowEnglishRecords]);

  useEffect(() => {
    if (!currentUser) {
      setIsHistoryLoading(false);
      setIsSavedExpressionsLoading(false);
      setTodayStatus(null);
      setHistory([]);
      setHistoryError("");
      setSavedExpressions([]);
      setSavedExpressionError("");
      setSavedExpressionSearchQuery("");
      setSelectedSavedExpressionTag(null);
      setSelectedSavedExpressionTagAnchorId(null);
      setSelectedSession(null);
      setSelectedHistoryFeedback(null);
      return;
    }

    void loadHistory();
    void loadSavedExpressions();
  }, [currentUser, loadHistory, loadSavedExpressions]);

  useEffect(() => {
    setSelectedDateKey(highlightedDateKey);
  }, [highlightedDateKey]);

  useEffect(() => {
    if (!selectedSavedExpressionTag) {
      setSelectedSavedExpressionTagAnchorId(null);
      return;
    }

    if (savedExpressionTagOptions.some((option) => option.tag === selectedSavedExpressionTag)) {
      return;
    }

    setSelectedSavedExpressionTag(null);
    setSelectedSavedExpressionTagAnchorId(null);
  }, [savedExpressionTagOptions, selectedSavedExpressionTag]);

  useEffect(() => {
    setOpenDates((current) => {
      const next: Record<string, boolean> = {};
      let changed = Object.keys(current).length !== groupedHistoryEntries.length;
      const hasHighlightedDate = selectedDateKey
        ? groupedHistoryEntries.some((entry) => entry.dateKey === selectedDateKey)
        : false;

      groupedHistoryEntries.forEach(({ dateKey }, index) => {
        const nextValue =
          dateKey === selectedDateKey
            ? true
            : current[dateKey] ?? (hasHighlightedDate ? false : index === 0);
        next[dateKey] = nextValue;
        if (current[dateKey] !== nextValue) {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [groupedHistoryEntries, selectedDateKey]);

  useEffect(() => {
    lastScrolledDateRef.current = "";
  }, [selectedDateKey]);

  useEffect(() => {
    if (!selectedDateKey) {
      return;
    }

    if (!groupedHistoryEntries.some((entry) => entry.dateKey === selectedDateKey)) {
      return;
    }

    if (!(openDates[selectedDateKey] ?? false)) {
      return;
    }

    const targetOffset = dateGroupOffsetsRef.current[selectedDateKey];
    if (typeof targetOffset !== "number" || lastScrolledDateRef.current === selectedDateKey) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(targetOffset - 12, 0),
        animated: true
      });
      lastScrolledDateRef.current = selectedDateKey;
    }, 80);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [groupedHistoryEntries, openDates, selectedDateKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const [user] = await Promise.all([refreshSession(), loadNowEnglishRecords()]);
    if (user) {
      await Promise.all([loadHistory(), loadSavedExpressions()]);
    } else {
      setSavedExpressions([]);
    }
    setIsRefreshing(false);
  }, [loadHistory, loadNowEnglishRecords, loadSavedExpressions, refreshSession]);

  function handleOpenSession(session: HistorySession) {
    setSelectedSession(session);
    setSelectedHistoryFeedback(null);
  }

  function handleCloseSessionModal() {
    setSelectedHistoryFeedback(null);
    setSelectedSession(null);
  }

  function handleOpenFeedback(attempt: HistoryAttempt) {
    if (!selectedSession) {
      return;
    }

    setSelectedHistoryFeedback(buildHistoryFeedbackState(selectedSession, attempt));
  }

  function handleDeleteSavedExpression(savedExpression: SavedExpression) {
    Alert.alert(
      "저장한 표현을 삭제할까요?",
      "삭제하면 이 표현은 저장 목록에서 사라져요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => void confirmDeleteSavedExpression(savedExpression.id)
        }
      ]
    );
  }

  async function confirmDeleteSavedExpression(savedExpressionId: number) {
    try {
      setDeletingSavedExpressionId(savedExpressionId);
      await deleteSavedExpression(savedExpressionId);
      setSavedExpressions((current) => current.filter((item) => item.id !== savedExpressionId));
      setOpenSavedExpressionPrompts((current) => {
        const next = { ...current };
        delete next[savedExpressionId];
        return next;
      });
    } catch (caughtError) {
      Alert.alert(
        "삭제에 실패했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setDeletingSavedExpressionId(null);
    }
  }

  function toggleSavedExpressionPrompt(savedExpressionId: number) {
    setOpenSavedExpressionPrompts((current) => ({
      ...current,
      [savedExpressionId]: !current[savedExpressionId]
    }));
  }

  function handleResetSavedExpressionControls() {
    setSavedExpressionSearchQuery("");
    setSelectedSavedExpressionTag(null);
    setSelectedSavedExpressionTagAnchorId(null);
  }

  function handleSelectSavedExpressionTag(tag: string, anchorSavedExpressionId?: number) {
    const normalizedTag = normalizeSavedExpressionTag(tag);
    if (!normalizedTag) {
      return;
    }

    setSelectedSavedExpressionTag((current) => {
      if (current === normalizedTag) {
        setSelectedSavedExpressionTagAnchorId(null);
        return null;
      }

      setSelectedSavedExpressionTagAnchorId(anchorSavedExpressionId ?? null);
      return normalizedTag;
    });
  }

  const findHistorySessionForSavedExpression = useCallback((savedExpression: SavedExpression) => {
    const promptId = trimSavedExpressionLookupValue(savedExpression.promptId);
    const promptQuestionEn = trimSavedExpressionLookupValue(savedExpression.promptQuestionEn);
    const promptQuestionKo = trimSavedExpressionLookupValue(savedExpression.promptQuestionKo);
    const promptTopic = trimSavedExpressionLookupValue(savedExpression.promptTopic);

    const matches = history.filter((session) => {
      if (promptId && session.promptId === promptId) {
        return true;
      }
      if (promptQuestionEn && session.questionEn.trim() === promptQuestionEn) {
        return true;
      }
      if (promptQuestionKo && session.questionKo.trim() === promptQuestionKo) {
        return true;
      }
      return Boolean(promptTopic && session.topic.trim() === promptTopic);
    });

    if (matches.length === 0) {
      return null;
    }

    return [...matches].sort((left, right) =>
      getLatestSessionTimestamp(right).localeCompare(getLatestSessionTimestamp(left))
    )[0];
  }, [history]);

  function handleOpenSavedExpressionHistory(savedExpression: SavedExpression) {
    const targetSession = findHistorySessionForSavedExpression(savedExpression);
    if (!targetSession) {
      Alert.alert("기록을 찾지 못했어요", "이 질문의 작문 기록을 아직 찾지 못했어요.");
      return;
    }

    const dateKey = formatHistoryDateKey(getLatestSessionTimestamp(targetSession));
    setActiveTab("history");
    setShowAllDateGroups(true);
    setSelectedDateKey(dateKey);
    setOpenDates((current) => ({
      ...current,
      [dateKey]: true
    }));
    setSelectedHistoryFeedback(null);
    setSelectedSession(targetSession);
  }

  function handlePracticeSavedExpression(savedExpression: SavedExpression) {
    const linkedSession = findHistorySessionForSavedExpression(savedExpression);
    const practiceTarget = resolveSavedExpressionPracticeTarget(savedExpression, linkedSession);
    const expression = savedExpression.expression.trim();

    if (!practiceTarget || !expression) {
      Alert.alert(
        "연습을 시작할 수 없어요",
        "이 표현을 다시 써볼 질문 정보를 아직 찾지 못했어요."
      );
      return;
    }

    router.push({
      pathname: "/practice/write",
      params: {
        difficulty: practiceTarget.difficulty,
        promptId: practiceTarget.promptId,
        prefillExpression: expression
      }
    });
  }

  const selectedTagPracticeCandidate = useMemo(() => {
    if (!selectedSavedExpressionTag) {
      return null;
    }

    const anchorSavedExpression =
      selectedSavedExpressionTagAnchorId == null
        ? null
        : visibleSavedExpressions.find((item) => item.id === selectedSavedExpressionTagAnchorId) ?? null;

    const prioritizedSavedExpressions = anchorSavedExpression
      ? [
          anchorSavedExpression,
          ...visibleSavedExpressions.filter((item) => item.id !== anchorSavedExpression.id)
        ]
      : visibleSavedExpressions;

    for (const savedExpression of prioritizedSavedExpressions) {
      if (!getVisibleSavedExpressionTags(savedExpression).includes(selectedSavedExpressionTag)) {
        continue;
      }

      const linkedSession = findHistorySessionForSavedExpression(savedExpression);
      const practiceTarget = resolveSavedExpressionPracticeTarget(savedExpression, linkedSession);
      const expression = savedExpression.expression.trim();
      const expressions = collectTagPracticeExpressions(
        selectedSavedExpressionTag,
        savedExpression,
        visibleSavedExpressions
      );

      if (practiceTarget && expression && isEligibleTagPracticeExpression(expression) && expressions.length > 0) {
        return {
          savedExpression,
          practiceTarget,
          expression: expressions[0] ?? expression,
          expressions
        };
      }
    }

    return null;
  }, [
    findHistorySessionForSavedExpression,
    selectedSavedExpressionTag,
    selectedSavedExpressionTagAnchorId,
    visibleSavedExpressions
  ]);
  const selectedSavedExpressionTagLabel = selectedSavedExpressionTag
    ? formatSavedExpressionTagLabel(selectedSavedExpressionTag)
    : "";

  function handlePracticeSelectedSavedExpressionTag() {
    if (!selectedSavedExpressionTag) {
      return;
    }

    if (!selectedTagPracticeCandidate) {
      Alert.alert(
        "연습을 시작할 수 없어요",
        "이 태그에 연결된 다시 써보기 표현을 아직 찾지 못했어요."
      );
      return;
    }

    router.push({
      pathname: "/practice/write",
      params: {
        difficulty: selectedTagPracticeCandidate.practiceTarget.difficulty,
        promptId: selectedTagPracticeCandidate.practiceTarget.promptId,
        prefillExpression:
          selectedTagPracticeCandidate.expressions[0] ?? selectedTagPracticeCandidate.expression,
        practiceTag: selectedSavedExpressionTag,
        practiceTagLabel: selectedSavedExpressionTagLabel,
        practiceExpressions: JSON.stringify(selectedTagPracticeCandidate.expressions)
      }
    });
  }

  function handleOpenCalendar() {
    const baseDate =
      selectedDateKey && recordDateKeySet.has(selectedDateKey)
        ? parseHistoryDateKeyAsDate(selectedDateKey)
        : groupedHistoryEntries.length > 0
          ? parseHistoryDateKeyAsDate(groupedHistoryEntries[0].dateKey)
          : new Date();
    setCalendarMonthCursor(getCalendarMonthStart(baseDate));
    setIsCalendarOpen(true);
  }

  function handleCloseCalendar() {
    setIsCalendarOpen(false);
  }

  function handleSelectCalendarDate(dateKey: string) {
    if (!recordDateKeySet.has(dateKey)) {
      return;
    }

    setSelectedDateKey(dateKey);
    setOpenDates((current) => ({
      ...current,
      [dateKey]: true
    }));
    setIsCalendarOpen(false);
  }

  const handleDateGroupLayout = useCallback(
    (dateKey: string, event: LayoutChangeEvent) => {
      const nextOffset = event.nativeEvent.layout.y;
      dateGroupOffsetsRef.current[dateKey] = nextOffset;

      if (dateKey !== selectedDateKey || !(openDates[dateKey] ?? false)) {
        return;
      }

      if (lastScrolledDateRef.current === selectedDateKey) {
        return;
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(nextOffset - 12, 0),
          animated: true
        });
        lastScrolledDateRef.current = selectedDateKey;
      }, 80);
    },
    [openDates, selectedDateKey]
  );

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <View style={styles.loadingState}>
            <ActivityIndicator color="#E38B12" />
          </View>
          <MobileNavBar activeTab="records" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
            }
          >
            <MobileScreenHeader title="기록" />

            {!currentUser && activeTab !== "now" ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
                <Text style={styles.emptyBody}>
                  작문과 일기 기록은 로그인한 뒤 날짜별로 모아볼 수 있어요.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push(buildLoginHref("/records"))}
                >
                  <Text style={styles.primaryButtonText}>로그인 하기</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {currentUser ? (
                  <View style={styles.profileCard}>
                    <Text style={styles.name}>{currentUser.displayName}</Text>
                    <Text style={styles.email}>{currentUser.email}</Text>
                    <View style={styles.metricRow}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricValue}>{todayStatus?.streakDays ?? 0}</Text>
                        <Text style={styles.metricLabel}>연속 루프</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricValue}>{history.length}</Text>
                        <Text style={styles.metricLabel}>질문 기록</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricValue}>
                          {(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}
                        </Text>
                        <Text style={styles.metricLabel}>총 문장</Text>
                      </View>
                    </View>

                    <Pressable style={styles.diaryShortcutButton} onPress={() => router.push("/diary" as never)}>
                      <Text style={styles.diaryShortcutButtonText}>오늘 일기 쓰기</Text>
                      <Text style={styles.diaryShortcutButtonArrow}>{">"}</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.contentTabRow}>
                  <Pressable
                    style={[
                      styles.contentTabButton,
                      activeTab === "history" && styles.contentTabButtonActive
                    ]}
                    onPress={() => setActiveTab("history")}
                  >
                    <Text
                      style={[
                        styles.contentTabButtonText,
                        activeTab === "history" && styles.contentTabButtonTextActive
                      ]}
                    >
                      영어 답변
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.contentTabButton,
                      activeTab === "now" && styles.contentTabButtonActive
                    ]}
                    onPress={() => setActiveTab("now")}
                  >
                    <Text
                      style={[
                        styles.contentTabButtonText,
                        activeTab === "now" && styles.contentTabButtonTextActive
                      ]}
                    >
                      영어조각
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.contentTabButton,
                      activeTab === "diary" && styles.contentTabButtonActive
                    ]}
                    onPress={() => setActiveTab("diary")}
                  >
                    <Text
                      style={[
                        styles.contentTabButtonText,
                        activeTab === "diary" && styles.contentTabButtonTextActive
                      ]}
                    >
                      일기
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.contentTabButton,
                      activeTab === "expressions" && styles.contentTabButtonActive
                    ]}
                    onPress={() => setActiveTab("expressions")}
                  >
                    <Text
                      style={[
                        styles.contentTabButtonText,
                        activeTab === "expressions" && styles.contentTabButtonTextActive
                      ]}
                    >
                      저장 표현
                    </Text>
                  </Pressable>
                </View>

                {activeTab === "history" ? (
                <View style={styles.historyBoard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.sectionTitle}>날짜별 기록</Text>
                        <Text style={styles.sectionMeta}>{history.length}개의 질문</Text>
                      </View>
                      <Pressable style={styles.calendarOpenButton} onPress={handleOpenCalendar}>
                        <Text style={styles.calendarOpenButtonText}>달력</Text>
                      </Pressable>
                    </View>
                  </View>

                  {isHistoryLoading ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>작문 기록을 불러오고 있어요</Text>
                      <Text style={styles.emptyBody}>잠시만 기다려 주세요.</Text>
                    </View>
                  ) : groupedHistoryEntries.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
                      <Text style={styles.emptyBody}>오늘의 질문으로 첫 작문을 시작해 보세요.</Text>
                      <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
                        <Text style={styles.primaryButtonText}>홈으로 가기</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.dateFeed}>
                      {visibleGroupedHistoryEntries.map(({ dateKey, sessions }, groupIndex) => {
                        const isOpen = openDates[dateKey] ?? false;

                        return (
                          <View
                            key={dateKey}
                            onLayout={(event) => handleDateGroupLayout(dateKey, event)}
                            style={[
                              styles.dateGroup,
                              groupIndex > 0 && styles.dateGroupSeparated
                            ]}
                          >
                            <Pressable
                              style={styles.dateHeading}
                              onPress={() =>
                                setOpenDates((current) => ({
                                  ...current,
                                  [dateKey]: !(current[dateKey] ?? false)
                                }))
                              }
                            >
                              <View style={styles.dateHeadingCopy}>
                                <Text style={styles.dateTitle}>{formatHistoryDateHeading(dateKey)}</Text>
                                <Text style={styles.dateMeta}>{`${sessions.length}개 질문`}</Text>
                              </View>
                              <Text style={styles.dateToggle}>{isOpen ? "-" : "+"}</Text>
                            </Pressable>

                            {isOpen ? (
                              <View style={styles.questionStack}>
                                {sessions.map((session, sessionIndex) => {
                                  const latestAttempt = getLatestAttempt(session);

                                  return (
                                    <Pressable
                                      key={session.sessionId}
                                      style={({ pressed }) => [
                                        styles.questionCard,
                                        sessionIndex > 0 && styles.questionCardSeparated,
                                        latestAttempt && styles.questionCardInteractive,
                                        pressed && latestAttempt && styles.questionCardPressed
                                      ]}
                                      disabled={!latestAttempt}
                                      onPress={() =>
                                        latestAttempt ? handleOpenSession(session) : undefined
                                      }
                                    >
                                      <View style={styles.chipRow}>
                                        <View style={styles.topicChip}>
                                          <Text style={styles.topicChipText}>{session.topic}</Text>
                                        </View>
                                        <View style={styles.neutralChip}>
                                          <Text style={styles.neutralChipText}>
                                            {getDifficultyLabel(session.difficulty)}
                                          </Text>
                                        </View>
                                        {latestAttempt ? (
                                          <View style={styles.neutralChip}>
                                            <Text style={styles.neutralChipText}>
                                              {getAttemptLabel(latestAttempt.attemptType)}
                                            </Text>
                                          </View>
                                        ) : null}
                                      </View>

                                      <Text style={styles.questionEn}>{session.questionEn}</Text>
                                      <Text style={styles.questionKo}>{session.questionKo}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {groupedHistoryEntries.length > INITIAL_VISIBLE_DATE_GROUPS ? (
                    <Pressable
                      style={styles.showMoreButton}
                      onPress={() => setShowAllDateGroups((current) => !current)}
                    >
                      <Text style={styles.showMoreButtonText}>
                        {showAllDateGroups
                          ? "최근 기록만 보기"
                          : `전체 보기${hiddenDateGroupCount > 0 ? ` (${hiddenDateGroupCount}일 더)` : ""}`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                ) : activeTab === "diary" ? (
                  <View style={styles.historyBoard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.sectionTitle}>영어일기 기록</Text>
                        <Text style={styles.sectionMeta}>일기는 날짜별 달력에서 이어서 볼 수 있어요.</Text>
                      </View>
                    </View>

                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>일기 기록은 일기 달력에 모아둘게요</Text>
                      <Text style={styles.emptyBody}>
                        긴 글은 일기 화면에서 종이 노트처럼 읽고, 날짜별로 다시 열어볼 수 있어요.
                      </Text>
                      <View style={styles.recordActionRow}>
                        <Pressable
                          style={styles.primaryButton}
                          onPress={() => router.push("/diary" as never)}
                        >
                          <Text style={styles.primaryButtonText}>일기 기록 보기</Text>
                        </Pressable>
                        <Pressable
                          style={styles.outlineButton}
                          onPress={() => router.push("/diary/write" as never)}
                        >
                          <Text style={styles.outlineButtonText}>오늘 일기 쓰기</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : activeTab === "now" ? (
                  <View style={styles.historyBoard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderCopy}>
                          <Text style={styles.sectionTitle}>영어조각 기록</Text>
                          <Text style={styles.sectionMeta}>{nowEnglishEntries.length}개의 한 줄</Text>
                        </View>
                        <Pressable style={styles.calendarOpenButton} onPress={() => router.push("/now" as never)}>
                          <Text style={styles.calendarOpenButtonText}>지금 쓰기</Text>
                        </Pressable>
                      </View>
                    </View>

                    {isNowEnglishLoading ? (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>영어조각 기록을 불러오고 있어요</Text>
                        <Text style={styles.emptyBody}>잠시만 기다려 주세요.</Text>
                      </View>
                    ) : nowEnglishRecordGroups.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>아직 남긴 영어조각이 없어요</Text>
                        <Text style={styles.emptyBody}>
                          지금 하고 있는 일이나 떠오른 생각을 한 줄로 먼저 남겨보세요.
                        </Text>
                        <Pressable style={styles.primaryButton} onPress={() => router.push("/now" as never)}>
                          <Text style={styles.primaryButtonText}>지금 쓰기</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.dateFeed}>
                        {nowEnglishRecordGroups.map((group, groupIndex) => (
                          <View
                            key={group.dateKey}
                            style={[
                              styles.dateGroup,
                              groupIndex > 0 && styles.dateGroupSeparated
                            ]}
                          >
                            <View style={styles.dateHeading}>
                              <View style={styles.dateHeadingCopy}>
                                <Text style={styles.dateTitle}>{group.label}</Text>
                                <Text style={styles.dateMeta}>{`${group.entries.length}개 한 줄`}</Text>
                              </View>
                            </View>

                            <View style={styles.questionStack}>
                              {group.entries.map((entry, entryIndex) => (
                                <View
                                  key={entry.id}
                                  style={[
                                    styles.nowRecordCard,
                                    entryIndex > 0 && styles.questionCardSeparated
                                  ]}
                                >
                                  <Text style={styles.nowRecordTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
                                  <Text style={styles.nowRecordText}>{entry.text}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.historyBoard}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.sectionTitle}>저장한 표현</Text>
                        <Text style={styles.sectionMeta}>{savedExpressionSectionMeta}</Text>
                      </View>
                    </View>

                    {savedExpressions.length > 0 ? (
                      <View style={styles.savedExpressionControls}>
                        <TextInput
                          value={savedExpressionSearchQuery}
                          onChangeText={setSavedExpressionSearchQuery}
                          placeholder="표현, 뜻, 예문, 질문, 태그 검색"
                          placeholderTextColor="#B9A58C"
                          style={styles.savedExpressionSearchInput}
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType="search"
                        />

                        {savedExpressionTagOptions.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.savedExpressionFilterRow}
                          >
                            {savedExpressionTagOptions.map((tagOption) => {
                              const isSelected = selectedSavedExpressionTag === tagOption.tag;

                              return (
                                <Pressable
                                  key={tagOption.tag}
                                  style={[
                                    styles.savedExpressionFilterChip,
                                    isSelected && styles.savedExpressionFilterChipActive
                                  ]}
                                  onPress={() => handleSelectSavedExpressionTag(tagOption.tag)}
                                >
                                  <Text
                                    style={[
                                      styles.savedExpressionFilterChipText,
                                      isSelected && styles.savedExpressionFilterChipTextActive
                                    ]}
                                  >
                                    {tagOption.label}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.savedExpressionFilterChipCount,
                                      isSelected && styles.savedExpressionFilterChipCountActive
                                    ]}
                                  >
                                    {tagOption.count}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        ) : null}

                        {normalizedSavedExpressionSearch || selectedSavedExpressionTag ? (
                          <View style={styles.savedExpressionFilterSummaryGroup}>
                            <View style={styles.savedExpressionFilterSummaryRow}>
                              <Text style={styles.savedExpressionFilterSummaryText}>
                                {[
                                  normalizedSavedExpressionSearch
                                    ? `"${savedExpressionSearchQuery.trim()}" 검색`
                                    : null,
                                  selectedSavedExpressionTag
                                    ? `${selectedSavedExpressionTagLabel} 상단 우선 정렬`
                                    : null
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </Text>
                              <Pressable onPress={handleResetSavedExpressionControls}>
                                <Text style={styles.savedExpressionFilterClearText}>초기화</Text>
                              </Pressable>
                            </View>

                            {selectedSavedExpressionTag ? (
                              <Pressable
                                onPress={handlePracticeSelectedSavedExpressionTag}
                                disabled={!selectedTagPracticeCandidate}
                                style={styles.savedExpressionTagPracticeLink}
                              >
                                <Text
                                  style={[
                                    styles.savedExpressionTagPracticeLinkText,
                                    !selectedTagPracticeCandidate &&
                                      styles.savedExpressionTagPracticeLinkTextDisabled
                                  ]}
                                >
                                  이 태그로 다시 써보기
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {isSavedExpressionsLoading ? (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>표현 목록을 불러오고 있어요</Text>
                        <Text style={styles.emptyBody}>잠시만 기다려 주세요.</Text>
                      </View>
                    ) : savedExpressions.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>아직 저장한 표현이 없어요</Text>
                        <Text style={styles.emptyBody}>
                          피드백 화면이나 AI 코치 추천 카드에서 마음에 드는 표현을 저장해 보세요.
                        </Text>
                        <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
                          <Text style={styles.primaryButtonText}>질문 풀러 가기</Text>
                        </Pressable>
                      </View>
                    ) : visibleSavedExpressions.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
                        <Text style={styles.emptyBody}>
                          다른 검색어로 다시 찾아보거나 태그 정렬을 초기화해 보세요.
                        </Text>
                        <Pressable
                          style={styles.primaryButton}
                          onPress={handleResetSavedExpressionControls}
                        >
                          <Text style={styles.primaryButtonText}>검색 초기화</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.savedExpressionList}>
                        {visibleSavedExpressions.map((item) => {
                          const promptText = getSavedExpressionPromptText(item);
                          const linkedHistorySession = findHistorySessionForSavedExpression(item);
                          const practiceTarget = resolveSavedExpressionPracticeTarget(
                            item,
                            linkedHistorySession
                          );
                          const savedExpressionTags = getVisibleSavedExpressionTags(item);
                          const isPromptOpen = Boolean(openSavedExpressionPrompts[item.id]);
                          const hasLinkedHistory = Boolean(linkedHistorySession);

                          return (
                            <View key={item.id} style={styles.savedExpressionCard}>
                              <View style={styles.savedExpressionHeaderRow}>
                                <View style={styles.savedExpressionMetaWrap}>
                                  {savedExpressionTags.length > 0 || item.saveCount > 1 ? (
                                    <View style={styles.savedExpressionTagRow}>
                                      {savedExpressionTags.map((tag) => {
                                        const isSelected = selectedSavedExpressionTag === tag;

                                        return (
                                          <Pressable
                                            key={`${item.id}-${tag}`}
                                            style={[
                                              styles.savedExpressionTagChip,
                                              isSelected && styles.savedExpressionTagChipActive
                                            ]}
                                            onPress={() => handleSelectSavedExpressionTag(tag, item.id)}
                                          >
                                            <Text
                                              style={[
                                                styles.savedExpressionTagChipText,
                                                isSelected && styles.savedExpressionTagChipTextActive
                                              ]}
                                            >
                                              {formatSavedExpressionTagLabel(tag)}
                                            </Text>
                                          </Pressable>
                                        );
                                      })}
                                      {item.saveCount > 1 ? (
                                        <Text style={styles.savedExpressionSaveCount}>
                                          {`${item.saveCount}번 저장`}
                                        </Text>
                                      ) : null}
                                    </View>
                                  ) : null}
                                  <Text style={styles.savedExpressionText}>{item.expression}</Text>
                                </View>

                                <View style={styles.savedExpressionHeaderAside}>
                                  <Text style={styles.savedExpressionDate}>
                                    {formatSavedExpressionDate(item.lastSavedAt)}
                                  </Text>
                                  <Pressable
                                    style={styles.savedExpressionDeleteButton}
                                    onPress={() => handleDeleteSavedExpression(item)}
                                    disabled={deletingSavedExpressionId === item.id}
                                  >
                                    {deletingSavedExpressionId === item.id ? (
                                      <ActivityIndicator color="#A3371A" size="small" />
                                    ) : (
                                      <SymbolView
                                        name={{ ios: "trash", android: "delete", web: "delete" }}
                                        size={16}
                                        weight="semibold"
                                        tintColor="#B95A36"
                                        type="hierarchical"
                                      />
                                    )}
                                  </Pressable>
                                </View>
                              </View>

                              {item.meaningKo ? (
                                <Text style={styles.savedExpressionMeaning}>{item.meaningKo}</Text>
                              ) : null}
                              {renderSavedExpressionExample(item.exampleEn, item.expression)}
                              {practiceTarget ? (
                                <Pressable
                                  style={[
                                    styles.savedExpressionPracticeButton,
                                    promptText && styles.savedExpressionPracticeButtonHidden
                                  ]}
                                  onPress={() => handlePracticeSavedExpression(item)}
                                >
                                  <Text style={styles.savedExpressionPracticeButtonText}>
                                    이 표현으로 한 문장 써보기
                                  </Text>
                                </Pressable>
                              ) : null}
                              {promptText ? (
                                <>
                                  <View style={styles.savedExpressionActionRow}>
                                  <Pressable
                                    style={styles.savedExpressionPromptLink}
                                    onPress={() => toggleSavedExpressionPrompt(item.id)}
                                  >
                                    <Text style={styles.savedExpressionPromptLinkText}>
                                      {isPromptOpen
                                        ? "질문 숨기기"
                                        : "어떤 질문에서 저장했는지 보기"}
                                    </Text>
                                  </Pressable>
                                    {practiceTarget ? (
                                      <Pressable
                                        style={styles.savedExpressionPracticeButtonInline}
                                        onPress={() => handlePracticeSavedExpression(item)}
                                      >
                                        <Text style={styles.savedExpressionPracticeButtonText}>
                                          이 표현으로 한 문장 써보기
                                        </Text>
                                      </Pressable>
                                    ) : null}
                                  </View>
                                  {isPromptOpen ? (
                                    <>
                                      <Text style={styles.savedExpressionPrompt}>{promptText}</Text>
                                      <Pressable
                                        style={[
                                          styles.savedExpressionHistoryButton,
                                          !hasLinkedHistory && styles.savedExpressionHistoryButtonDisabled
                                        ]}
                                        onPress={() => handleOpenSavedExpressionHistory(item)}
                                        disabled={!hasLinkedHistory}
                                      >
                                        <Text
                                          style={[
                                            styles.savedExpressionHistoryButtonText,
                                            !hasLinkedHistory && styles.savedExpressionHistoryButtonTextDisabled
                                          ]}
                                        >
                                          질문 히스토리로 가기
                                        </Text>
                                      </Pressable>
                                    </>
                                  ) : null}
                                </>
                              ) : null}

                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "history" && historyError ? (
                  <Text style={styles.errorText}>{historyError}</Text>
                ) : null}
                {activeTab === "expressions" && savedExpressionError ? (
                  <Text style={styles.errorText}>{savedExpressionError}</Text>
                ) : null}
                {activeTab === "now" && nowEnglishError ? (
                  <Text style={styles.errorText}>{nowEnglishError}</Text>
                ) : null}
              </>
            )}
          </ScrollView>

          <MobileNavBar activeTab="records" />
        </View>
      </SafeAreaView>

      <HistorySessionDetailModal
        feedbackState={selectedHistoryFeedback}
        onClose={handleCloseSessionModal}
        onOpenFeedback={handleOpenFeedback}
        onReturnToHistory={() => setSelectedHistoryFeedback(null)}
        session={selectedSession}
      />

      <Modal visible={isCalendarOpen} transparent animationType="fade" onRequestClose={handleCloseCalendar}>
        <View style={styles.calendarModalOverlay}>
          <Pressable style={styles.calendarModalBackdrop} onPress={handleCloseCalendar} />
          <SafeAreaView style={styles.calendarModalFrame} edges={["top", "bottom"]}>
            <View style={styles.calendarModalCard}>
              <View style={styles.calendarModalHeader}>
                <View style={styles.calendarMonthNavRow}>
                  <Pressable
                    style={[
                      styles.calendarMonthNavButton,
                      !canGoToPreviousCalendarMonth && styles.calendarMonthNavButtonDisabled
                    ]}
                    disabled={!canGoToPreviousCalendarMonth}
                    onPress={() =>
                      setCalendarMonthCursor(
                        (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12)
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.calendarMonthNavButtonText,
                        !canGoToPreviousCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                      ]}
                    >
                      {"<"}
                    </Text>
                  </Pressable>
                  <Text style={styles.calendarModalTitle}>{monthCalendar.monthLabel}</Text>
                  <Pressable
                    style={[
                      styles.calendarMonthNavButton,
                      !canGoToNextCalendarMonth && styles.calendarMonthNavButtonDisabled
                    ]}
                    disabled={!canGoToNextCalendarMonth}
                    onPress={() =>
                      setCalendarMonthCursor(
                        (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12)
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.calendarMonthNavButtonText,
                        !canGoToNextCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                      ]}
                    >
                      {">"}
                    </Text>
                  </Pressable>
                </View>
                <Pressable style={styles.calendarModalCloseButton} onPress={handleCloseCalendar}>
                  <Text style={styles.calendarModalCloseText}>닫기</Text>
                </Pressable>
              </View>

              <View style={styles.calendarWeekHeader}>
                {CALENDAR_WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.calendarWeekLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {monthCalendar.cells.map((cell) => (
                  <View key={cell.key} style={styles.calendarCellWrap}>
                    <Pressable
                      style={[
                        styles.calendarCell,
                        cell.hasRecords && styles.calendarCellHasRecords,
                        cell.isSelected && styles.calendarCellSelected,
                        !cell.isCurrentMonth && styles.calendarCellOutside
                      ]}
                      disabled={!cell.hasRecords}
                      onPress={() => handleSelectCalendarDate(cell.key)}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          cell.hasRecords && styles.calendarCellTextHasRecords,
                          cell.isSelected && styles.calendarCellTextSelected,
                          !cell.isCurrentMonth && styles.calendarCellTextOutside
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <Text style={styles.calendarFooterMeta}>기록이 있는 날짜만 바로 이동할 수 있어요.</Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
