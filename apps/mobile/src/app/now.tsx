import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import {
  deleteSavedExpression,
  getSavedExpressions,
  requestCoachHelp,
  requestNowInEnglishCoachFeedback,
  requestNowInEnglishReflection,
  saveExpression
} from "@/lib/api";
import {
  disableNowInEnglishReminders,
  enableNowInEnglishReminders,
  formatNowInEnglishQuietHours,
  formatNowInEnglishDateLabel,
  formatNowInEnglishTime,
  buildNowInEnglishEntrySignature,
  getNowInEnglishAiReflection,
  getNextNowInEnglishReminderAt,
  getNowInEnglishDateKey,
  getNowInEnglishRelativeDateKey,
  getNowInEnglishSummary,
  saveNowInEnglishAiReflection,
  type NowInEnglishAiReflection,
  type NowInEnglishAiReflectionExpression,
  type NowInEnglishEntry,
  type NowInEnglishIntervalHours,
  type NowInEnglishQuietHours,
  type NowInEnglishReminderSettings,
  type NowInEnglishScheduleMode,
  updateNowInEnglishScheduleMode,
  updateNowInEnglishQuietHours,
  saveNowInEnglishEntry
} from "@/lib/now-in-english";
import { useSession } from "@/lib/session";
import type { CoachExpression, CoachHelpResponse, NowInEnglishCoachFeedbackResponse } from "@/lib/types";

const NOW_IN_ENGLISH_COACH_PROMPT_ID = "diary-free-writing";
const coachMascotImage = require("@/assets/images/coach-mascote-face.png");
const DEFAULT_QUIET_HOURS: NowInEnglishQuietHours = {
  enabled: true,
  startHour: 23,
  endHour: 8
};
const HISTORY_FILTERS = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "all", label: "전체" }
] as const;

const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const NOW_IN_ENGLISH_TEXT_LIMIT = 500;

type NowInEnglishHistoryFilter = (typeof HISTORY_FILTERS)[number]["key"] | "selected";
type NowInEnglishEntryGroup = {
  dateKey: string;
  label: string;
  entries: NowInEnglishEntry[];
};
type NowInEnglishCalendarCell = {
  key: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEntries: boolean;
  entryCount: number;
};
type PendingPolishSource = {
  entryId: string;
  text: string;
  createdAt: string;
  dateKey: string;
};

function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeCoachSuggestionComparison(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
}

function hasUsefulCoachSuggestion(originalText: string, suggestionEn: string) {
  const normalizedSuggestion = normalizeCoachSuggestionComparison(suggestionEn);
  if (!normalizedSuggestion) {
    return false;
  }

  return normalizedSuggestion !== normalizeCoachSuggestionComparison(originalText);
}

function buildSavedExpressionIdMap(expressions: { id: number; expression: string }[]) {
  return expressions.reduce<Record<string, number>>((map, expression) => {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (normalizedKey) {
      map[normalizedKey] = expression.id;
    }
    return map;
  }, {});
}

function mergeSavedNowInEnglishEntry(entries: NowInEnglishEntry[], savedEntry: NowInEnglishEntry) {
  return [savedEntry, ...entries.filter((entry) => entry.id !== savedEntry.id)].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function clampReminderIntervalHours(value: number) {
  return Math.min(12, Math.max(1, Math.trunc(value)));
}

function formatNextReminderAt(date: Date | null) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getReminderLabel(enabled: boolean, nextReminderAt: Date | null) {
  if (!enabled) {
    return "알림이 꺼져 있어요";
  }

  const nextReminderTime = formatNextReminderAt(nextReminderAt);
  return nextReminderTime ? `다음 알림 · ${nextReminderTime}` : "다음 알림을 준비하고 있어요";
}

function getScheduleModeBody(scheduleMode: NowInEnglishScheduleMode) {
  return scheduleMode === "HOURLY_ANCHOR"
    ? "정각 기준으로 알림을 맞춰요."
    : "설정한 순간부터 간격을 세요.";
}

function parseNowInEnglishDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day, 12);
}

function addDays(date: Date, days: number) {
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
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function buildNowInEnglishMonthCalendar(
  visibleMonth: Date,
  entryCountsByDate: Map<string, number>,
  selectedDateKey: string | null,
  todayKey: string
): NowInEnglishCalendarCell[] {
  const monthStart = getCalendarMonthStart(visibleMonth);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12);
  const calendarStart = addDays(monthStart, -monthStart.getDay());
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const cells: NowInEnglishCalendarCell[] = [];

  for (
    let currentDate = new Date(calendarStart);
    currentDate <= calendarEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    const dateKey = getNowInEnglishDateKey(currentDate);
    const entryCount = entryCountsByDate.get(dateKey) ?? 0;
    cells.push({
      key: dateKey,
      day: currentDate.getDate(),
      isCurrentMonth: isSameCalendarMonth(currentDate, visibleMonth),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      hasEntries: entryCount > 0,
      entryCount
    });
  }

  return cells;
}

function buildEntryGroups(entries: NowInEnglishEntry[]): NowInEnglishEntryGroup[] {
  const groups = new Map<string, NowInEnglishEntry[]>();
  entries.forEach((entry) => {
    const groupedEntries = groups.get(entry.dateKey) ?? [];
    groupedEntries.push(entry);
    groups.set(entry.dateKey, groupedEntries);
  });

  return Array.from(groups.entries())
    .sort(([leftDateKey], [rightDateKey]) => rightDateKey.localeCompare(leftDateKey))
    .map(([dateKey, groupedEntries]) => ({
      dateKey,
      label: formatNowInEnglishDateLabel(dateKey),
      entries: groupedEntries
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }));
}

function EntryTimeline({
  groups,
  emptyTitle,
  emptyBody
}: {
  groups: NowInEnglishEntryGroup[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (groups.length === 0) {
    return (
      <View style={styles.emptyListCard}>
        <Text style={styles.emptyListTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyListBody}>{emptyBody}</Text>
      </View>
    );
  }

  return (
    <View style={styles.timelineList}>
      {groups.map((group) => (
        <View key={group.dateKey} style={styles.timelineGroup}>
          <View style={styles.timelineGroupHeader}>
            <Text style={styles.timelineDateLabel}>{group.label}</Text>
            <Text style={styles.timelineCount}>{group.entries.length}개 남겼어요</Text>
          </View>
          <View style={styles.entryList}>
            {group.entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <Text style={styles.entryTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
                {entry.polishedFromText ? (
                  <View style={styles.polishedComparison}>
                    <Text style={styles.polishedKicker}>다듬은 문장</Text>
                    <View style={styles.polishedRow}>
                      <Text style={styles.polishedLabel}>수정 전</Text>
                      <Text style={styles.polishedBeforeText}>{entry.polishedFromText}</Text>
                    </View>
                    <View style={[styles.polishedRow, styles.polishedAfterRow]}>
                      <Text style={styles.polishedLabel}>수정 후</Text>
                      <Text style={styles.polishedAfterText}>{entry.text}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.entryText}>{entry.text}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function YesterdayReflectionCard({
  entries,
  dateLabel,
  aiReflection,
  isLoadingAiReflection,
  aiReflectionError,
  onWriteToday,
  onToggleExpression,
  isExpressionSaved,
  isSavingExpression
}: {
  entries: NowInEnglishEntry[];
  dateLabel: string;
  aiReflection: NowInEnglishAiReflection | null;
  isLoadingAiReflection: boolean;
  aiReflectionError: string;
  onWriteToday: () => void;
  onToggleExpression: (expression: NowInEnglishAiReflectionExpression) => void;
  isExpressionSaved: (expression: string) => boolean;
  isSavingExpression: (expression: string) => boolean;
}) {
  const hasReflectionExpressions = (aiReflection?.expressions.length ?? 0) > 0;

  return (
    <View style={styles.reflectionStack}>
      <View style={styles.reflectionCard}>
        <Text style={styles.reflectionKicker}>{dateLabel}의 영어 조각</Text>
        <Text style={styles.reflectionTitle}>{dateLabel} {entries.length}개의 순간을 영어로 남겼어요.</Text>
        <Text style={styles.reflectionBody}>그날의 생각이 이렇게 남아 있어요.</Text>

        <View style={styles.reflectionHighlight}>
          <Text style={styles.reflectionHighlightLabel}>남긴 문장</Text>
          <View style={styles.reflectionSentenceList}>
            {entries.map((entry, index) => (
              <View
                key={entry.id}
                style={[styles.reflectionSentenceItem, index > 0 && styles.reflectionSentenceItemWithBorder]}
              >
                <Text style={styles.reflectionTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
                <Text style={styles.reflectionEntryText}>{entry.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.reflectionAiCard}>
        <View style={styles.reflectionAiHeader}>
          <Text style={styles.reflectionAiKicker}>AI 회고</Text>
          {isLoadingAiReflection ? <ActivityIndicator size="small" color="#EA920D" /> : null}
        </View>

        {aiReflection ? (
          <>
            <Text style={styles.reflectionAiTitle}>{aiReflection.headlineKo}</Text>
            <Text style={styles.reflectionAiBody}>{aiReflection.summaryKo}</Text>

            {aiReflection.highlightsKo.length > 0 ? (
              <View style={styles.reflectionFeedbackBox}>
                <Text style={styles.reflectionInsightLabel}>잘 남긴 점</Text>
                {aiReflection.highlightsKo.map((highlight, index) => (
                  <View key={`${highlight}-${index}`} style={styles.reflectionHighlightItem}>
                    <Text style={styles.reflectionHighlightBullet}>{index + 1}</Text>
                    <Text style={styles.reflectionHighlightItemText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {aiReflection.patternKo ? (
              <View style={styles.reflectionPlainSection}>
                <Text style={styles.reflectionInsightLabel}>오늘의 흐름</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.patternKo}</Text>
              </View>
            ) : null}

            {aiReflection.gentleCorrectionKo ? (
              <View style={styles.reflectionPlainSection}>
                <Text style={styles.reflectionInsightLabel}>가볍게 다듬기</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.gentleCorrectionKo}</Text>
              </View>
            ) : null}

            {aiReflection.nextActionKo ? (
              <View style={styles.reflectionPlainSection}>
                <Text style={styles.reflectionInsightLabel}>다음에 살 붙여보기</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.nextActionKo}</Text>
                {aiReflection.nextActionExampleEn ? (
                  <Text style={styles.reflectionNextActionExample}>{aiReflection.nextActionExampleEn}</Text>
                ) : null}
              </View>
            ) : null}

            {hasReflectionExpressions ? (
              <View style={styles.reflectionExpressionList}>
                <Text style={styles.reflectionExpressionTitle}>다음에 써먹을 표현</Text>
                {aiReflection.expressions.map((expression, index) => (
                  <View
                    key={`${expression.expression}-${index}`}
                    style={[
                      styles.reflectionExpressionCard,
                      index > 0 && styles.reflectionExpressionItemWithBorder
                    ]}
                  >
                    <View style={styles.reflectionExpressionHeader}>
                      <Text style={styles.reflectionExpressionText}>{expression.expression}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isExpressionSaved(expression.expression) ? "저장한 표현 취소" : "표현 저장"
                        }
                        style={[
                          styles.reflectionExpressionSaveButton,
                          isExpressionSaved(expression.expression) && styles.reflectionExpressionSaveButtonSaved
                        ]}
                        onPress={() => onToggleExpression(expression)}
                        disabled={isSavingExpression(expression.expression)}
                      >
                        <Text
                          style={[
                            styles.reflectionExpressionSaveText,
                            isExpressionSaved(expression.expression) && styles.reflectionExpressionSaveTextSaved
                          ]}
                        >
                          {isSavingExpression(expression.expression)
                            ? "저장 중"
                            : isExpressionSaved(expression.expression)
                              ? "저장됨"
                              : "저장"}
                        </Text>
                      </Pressable>
                    </View>
                    {expression.meaningKo ? (
                      <Text style={styles.reflectionExpressionMeaning}>{expression.meaningKo}</Text>
                    ) : null}
                    {expression.example ? (
                      <Text style={styles.reflectionExpressionExample}>{expression.example}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {aiReflection.closingKo ? (
              <Text style={styles.reflectionAiClosing}>{aiReflection.closingKo}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.reflectionAiBody}>
            {isLoadingAiReflection
              ? "남긴 문장들을 살펴보고 있어요."
              : "이 날의 기록을 AI가 짧게 돌아봐 줄 수 있어요."}
          </Text>
        )}

        {aiReflectionError ? <Text style={styles.reflectionAiError}>{aiReflectionError}</Text> : null}
      </View>

      <Pressable style={styles.reflectionButton} onPress={onWriteToday}>
        <Text style={styles.reflectionButtonText}>오늘도 한 줄 남기기</Text>
      </Pressable>
    </View>
  );
}

function InstantCoachFeedbackCard({
  entry,
  feedback,
  isLoading,
  error,
  onAskCoach,
  onRevise,
  onKeep,
  onRetry
}: {
  entry: NowInEnglishEntry;
  feedback: NowInEnglishCoachFeedbackResponse | null;
  isLoading: boolean;
  error: string;
  onAskCoach: () => void;
  onRevise: () => void;
  onKeep: () => void;
  onRetry: () => void;
}) {
  const hasUsefulSuggestion = feedback ? hasUsefulCoachSuggestion(entry.text, feedback.suggestionEn) : false;

  return (
    <View style={styles.instantCoachCard}>
      <View style={styles.instantCoachHeader}>
        <Text style={styles.instantCoachKicker}>방금 문장 AI 코치</Text>
        {isLoading ? <ActivityIndicator size="small" color="#EA920D" /> : null}
      </View>

      <Text style={styles.instantCoachOriginal}>{entry.text}</Text>

      {feedback ? (
        <>
          <Text style={styles.instantCoachTitle}>{feedback.headlineKo}</Text>
          <Text style={styles.instantCoachBody}>{feedback.praiseKo}</Text>

          {hasUsefulSuggestion ? (
            <View style={styles.instantCoachSuggestionBox}>
              <Text style={styles.instantCoachLabel}>이렇게도 말해요</Text>
              <Text style={styles.instantCoachSuggestion}>{feedback.suggestionEn}</Text>
              {feedback.suggestionTranslationKo ? (
                <Text style={styles.instantCoachSuggestionTranslation}>{feedback.suggestionTranslationKo}</Text>
              ) : null}
            </View>
          ) : null}

          {hasUsefulSuggestion && feedback.suggestionKo ? (
            <View style={styles.instantCoachSection}>
              <Text style={styles.instantCoachSectionLabel}>왜 이렇게 말하나요</Text>
              <Text style={styles.instantCoachSectionBody}>{feedback.suggestionKo}</Text>
            </View>
          ) : null}

          {feedback.nextQuestionKo ? (
            <View style={styles.instantCoachSection}>
              <Text style={styles.instantCoachSectionLabel}>살 더 붙여보기</Text>
              <Text style={styles.instantCoachInstruction}>{feedback.nextQuestionKo}</Text>
            </View>
          ) : null}

          {feedback.expression ? (
            <View style={styles.instantCoachExpression}>
              <Text style={styles.instantCoachExpressionText}>{feedback.expression}</Text>
              {feedback.expressionMeaningKo ? (
                <Text style={styles.instantCoachExpressionMeaning}>{feedback.expressionMeaningKo}</Text>
              ) : null}
              {feedback.expressionExampleEn ? (
                <Text style={styles.instantCoachExpressionExample}>{feedback.expressionExampleEn}</Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.instantCoachBody}>
          {isLoading ? "저장은 끝났고, AI가 문장을 짧게 살펴보고 있어요." : "저장은 완료됐어요."}
        </Text>
      )}

      {error ? <Text style={styles.instantCoachError}>{error}</Text> : null}

      {!isLoading ? (
        <View style={styles.instantCoachActions}>
          {error ? (
            <Pressable style={styles.instantCoachRetryButton} onPress={onRetry}>
              <Text style={styles.instantCoachRetryButtonText}>AI 코치 다시 시도</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.instantCoachReviseButton} onPress={onRevise}>
            <Text style={styles.instantCoachReviseButtonText}>수정해보기</Text>
          </Pressable>
          <Pressable style={styles.instantCoachKeepButton} onPress={onKeep}>
            <Text style={styles.instantCoachKeepButtonText}>이대로 남기기</Text>
          </Pressable>
          <Pressable style={styles.instantCoachAskButton} onPress={onAskCoach}>
            <Text style={styles.instantCoachAskButtonText}>AI 코치에게 더 물어보기</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function QuietHourStepper({
  label,
  hour,
  onDecrease,
  onIncrease,
  disabled
}: {
  label: string;
  hour: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.quietHourStepper}>
      <Text style={styles.quietHourLabel}>{label}</Text>
      <View style={styles.quietHourControl}>
        <Pressable
          style={[styles.quietHourButton, disabled && styles.buttonDisabled]}
          onPress={onDecrease}
          disabled={disabled}
        >
          <Text style={styles.quietHourButtonText}>-</Text>
        </Pressable>
        <Text style={styles.quietHourValue}>{hour.toString().padStart(2, "0")}:00</Text>
        <Pressable
          style={[styles.quietHourButton, disabled && styles.buttonDisabled]}
          onPress={onIncrease}
          disabled={disabled}
        >
          <Text style={styles.quietHourButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReminderIntervalStepper({
  intervalHours,
  onDecrease,
  onIncrease,
  disabled
}: {
  intervalHours: NowInEnglishIntervalHours;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.intervalStepper}>
      <Text style={styles.intervalStepperLabel}>알림 주기</Text>
      <View style={styles.intervalStepperControl}>
        <Pressable
          style={[styles.intervalStepperButton, disabled && styles.buttonDisabled]}
          onPress={onDecrease}
          disabled={disabled || intervalHours <= 1}
        >
          <Text style={styles.intervalStepperButtonText}>-</Text>
        </Pressable>
        <Text style={styles.intervalStepperValue}>{intervalHours}시간마다</Text>
        <Pressable
          style={[styles.intervalStepperButton, disabled && styles.buttonDisabled]}
          onPress={onIncrease}
          disabled={disabled || intervalHours >= 12}
        >
          <Text style={styles.intervalStepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function NowInEnglishScreen() {
  const params = useLocalSearchParams<{ reminder?: string }>();
  const { currentUser } = useSession();
  const shouldOpenReminderSettings = params.reminder === "open";
  const didOpenReminderSettingsFromParamRef = useRef(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const writeSectionYRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<NowInEnglishEntry[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState<NowInEnglishIntervalHours>(2);
  const [scheduleMode, setScheduleMode] = useState<NowInEnglishScheduleMode>("HOURLY_ANCHOR");
  const [reminderUpdatedAt, setReminderUpdatedAt] = useState("");
  const [scheduledReminderAts, setScheduledReminderAts] = useState<string[]>([]);
  const [quietHours, setQuietHours] = useState<NowInEnglishQuietHours>(DEFAULT_QUIET_HOURS);
  const [reminderClockTick, setReminderClockTick] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>({});
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);
  const [instantCoachEntry, setInstantCoachEntry] = useState<NowInEnglishEntry | null>(null);
  const [instantCoachFeedback, setInstantCoachFeedback] = useState<NowInEnglishCoachFeedbackResponse | null>(null);
  const [instantCoachFeedbackError, setInstantCoachFeedbackError] = useState("");
  const [isLoadingInstantCoachFeedback, setIsLoadingInstantCoachFeedback] = useState(false);
  const [pendingPolishSource, setPendingPolishSource] = useState<PendingPolishSource | null>(null);
  const [yesterdayAiReflection, setYesterdayAiReflection] = useState<NowInEnglishAiReflection | null>(null);
  const [yesterdayAiReflectionError, setYesterdayAiReflectionError] = useState("");
  const [isLoadingYesterdayAiReflection, setIsLoadingYesterdayAiReflection] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<NowInEnglishHistoryFilter>("today");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getCalendarMonthStart(new Date()));
  const instantCoachRequestIdRef = useRef(0);
  const applyReminderSettings = useCallback((settings: NowInEnglishReminderSettings) => {
    setRemindersEnabled(settings.enabled);
    setIntervalHours(settings.intervalHours);
    setScheduleMode(settings.scheduleMode);
    setReminderUpdatedAt(settings.updatedAt);
    setScheduledReminderAts(settings.scheduledReminderAts);
    setQuietHours(settings.quietHours);
  }, []);

  const todayKey = getNowInEnglishDateKey();
  const yesterdayKey = getNowInEnglishRelativeDateKey(-1);
  const reflectionDateKey =
    historyFilter === "today"
      ? todayKey
      : historyFilter === "yesterday"
        ? yesterdayKey
        : historyFilter === "selected" && selectedDateKey
          ? selectedDateKey
          : null;
  const reflectionDateLabel = reflectionDateKey
    ? reflectionDateKey === todayKey
      ? "오늘"
      : reflectionDateKey === yesterdayKey
        ? "어제"
        : formatNowInEnglishDateLabel(reflectionDateKey)
    : "";
  const entryCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      counts.set(entry.dateKey, (counts.get(entry.dateKey) ?? 0) + 1);
    });
    return counts;
  }, [entries]);
  const calendarCells = useMemo(
    () => buildNowInEnglishMonthCalendar(calendarMonthCursor, entryCountsByDate, selectedDateKey, todayKey),
    [calendarMonthCursor, entryCountsByDate, selectedDateKey, todayKey]
  );
  const yesterdayEntries = useMemo(
    () =>
      reflectionDateKey
        ? entries
            .filter((entry) => entry.dateKey === reflectionDateKey)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        : [],
    [entries, reflectionDateKey]
  );
  const yesterdayEntrySignature = useMemo(
    () => buildNowInEnglishEntrySignature(yesterdayEntries),
    [yesterdayEntries]
  );
  const filteredEntries = useMemo(() => {
    if (historyFilter === "today") {
      return entries.filter((entry) => entry.dateKey === todayKey);
    }
    if (historyFilter === "yesterday") {
      return entries.filter((entry) => entry.dateKey === yesterdayKey);
    }
    if (historyFilter === "selected" && selectedDateKey) {
      return entries.filter((entry) => entry.dateKey === selectedDateKey);
    }

    return entries;
  }, [entries, historyFilter, selectedDateKey, todayKey, yesterdayKey]);
  const entryGroups = useMemo(() => buildEntryGroups(filteredEntries), [filteredEntries]);
  const historyMeta = useMemo(() => {
    if (historyFilter === "all") {
      return `총 ${entries.length}개의 영어 조각`;
    }

    return `${filteredEntries.length}개를 남겼어요`;
  }, [entries.length, filteredEntries.length, historyFilter]);
  const historyTitle = useMemo(() => {
    if (historyFilter === "yesterday") {
      return "어제 남긴 문장";
    }
    if (historyFilter === "selected" && selectedDateKey) {
      return formatNowInEnglishDateLabel(selectedDateKey);
    }
    if (historyFilter === "all") {
      return "영어 조각 기록";
    }

    return "오늘 남긴 문장";
  }, [historyFilter, selectedDateKey]);
  const emptyTimelineCopy = useMemo(() => {
    if (historyFilter === "yesterday") {
      return {
        title: "어제 남긴 문장이 없어요.",
        body: "괜찮아요. 오늘 지금 떠오른 생각부터 다시 한 줄로 꺼내 보면 돼요."
      };
    }
    if (historyFilter === "selected") {
      return {
        title: "이 날짜에는 남긴 문장이 없어요.",
        body: "달력에서 다른 날짜를 골라보거나, 오늘의 한 줄을 새로 남겨보세요."
      };
    }
    if (historyFilter === "all") {
      return {
        title: "아직 쌓인 영어 조각이 없어요.",
        body: "완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요."
      };
    }

    return {
      title: "오늘의 첫 영어 조각을 남겨보세요.",
      body: "완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요."
    };
  }, [historyFilter]);

  const nextReminderAt = useMemo(
    () =>
      getNextNowInEnglishReminderAt(
        {
          enabled: remindersEnabled,
          intervalHours,
          scheduleMode,
          notificationIds: [],
          scheduledReminderAts,
          quietHours,
          updatedAt: reminderUpdatedAt
        },
        new Date(reminderClockTick)
      ),
    [intervalHours, quietHours, reminderClockTick, reminderUpdatedAt, remindersEnabled, scheduleMode, scheduledReminderAts]
  );
  const reminderLabel = useMemo(
    () => getReminderLabel(remindersEnabled, nextReminderAt),
    [nextReminderAt, remindersEnabled]
  );
  const coachQuickQuestions = useMemo(
    () => [
      "지금 하고 있는 일을 영어 한 줄로 어떻게 말해?",
      "내 문장이 자연스러운지 봐줘.",
      "이 뒤에 한 문장 더 붙이고 싶어.",
      "짧고 자연스러운 표현 3개 알려줘."
    ],
    []
  );

  function handleSelectHistoryFilter(nextFilter: (typeof HISTORY_FILTERS)[number]["key"]) {
    setHistoryFilter(nextFilter);
    setSelectedDateKey(null);
  }

  function handleOpenCalendar() {
    const baseDate = selectedDateKey ? parseNowInEnglishDateKey(selectedDateKey) : new Date();
    setCalendarMonthCursor(getCalendarMonthStart(baseDate));
    setIsCalendarOpen(true);
  }

  function handleSelectCalendarDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setHistoryFilter("selected");
    setIsCalendarOpen(false);
  }

  function handleWriteTodayFromReflection() {
    setHistoryFilter("today");
    setSelectedDateKey(null);
    inputRef.current?.focus();
  }

  const loadOrCreateYesterdayAiReflection = useCallback(
    async (forceRefresh = false) => {
      if (!reflectionDateKey || yesterdayEntries.length === 0 || !yesterdayEntrySignature) {
        setYesterdayAiReflection(null);
        setYesterdayAiReflectionError("");
        return;
      }

      try {
        setIsLoadingYesterdayAiReflection(true);
        setYesterdayAiReflectionError("");

        if (!forceRefresh) {
          const cachedReflection = await getNowInEnglishAiReflection(reflectionDateKey);
          if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
            setYesterdayAiReflection(cachedReflection);
            return;
          }
        }

        const response = await requestNowInEnglishReflection({
          dateKey: reflectionDateKey,
          forceRefresh,
          entries: yesterdayEntries.map((entry) => ({
            text: entry.text,
            createdAt: entry.createdAt
          }))
        });
        const nextReflection: NowInEnglishAiReflection = {
          ...response,
          entrySignature: yesterdayEntrySignature,
          createdAt: new Date().toISOString()
        };

        await saveNowInEnglishAiReflection(nextReflection);
        setYesterdayAiReflection(nextReflection);
      } catch (error) {
        const cachedReflection = await getNowInEnglishAiReflection(reflectionDateKey);
        if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
          setYesterdayAiReflection(cachedReflection);
        }
        setYesterdayAiReflectionError(error instanceof Error ? error.message : "AI 회고를 불러오지 못했어요.");
      } finally {
        setIsLoadingYesterdayAiReflection(false);
      }
    },
    [yesterdayEntries, yesterdayEntrySignature, reflectionDateKey]
  );

  const loadSummary = useCallback(async () => {
    const summary = await getNowInEnglishSummary();
    setEntries(summary.entries);
    applyReminderSettings(summary.settings);
  }, [applyReminderSettings]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const summary = await getNowInEnglishSummary();
        if (cancelled) {
          return;
        }
        setEntries(summary.entries);
        applyReminderSettings(summary.settings);
      } catch {
        if (!cancelled) {
          setStatusMessage("기록을 불러오지 못했어요. 잠시 후 다시 열어 확인해 주세요.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [applyReminderSettings]);

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      setSavingExpressionKeys([]);
      return;
    }

    let cancelled = false;

    void getSavedExpressions()
      .then((savedExpressions) => {
        if (cancelled) {
          return;
        }

        setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSavedExpressionIdsByKey({});
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!shouldOpenReminderSettings || didOpenReminderSettingsFromParamRef.current || isLoading) {
      return;
    }

    didOpenReminderSettingsFromParamRef.current = true;
    setIsReminderSettingsOpen(true);
  }, [isLoading, shouldOpenReminderSettings]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (yesterdayEntries.length === 0) {
      setYesterdayAiReflection(null);
      setYesterdayAiReflectionError("");
      return;
    }

    void loadOrCreateYesterdayAiReflection(false);
  }, [isLoading, loadOrCreateYesterdayAiReflection, yesterdayEntries.length]);

  useEffect(() => {
    if (!remindersEnabled) {
      return undefined;
    }

    const timerId = setInterval(() => {
      setReminderClockTick(Date.now());
    }, 60 * 1000);

    return () => clearInterval(timerId);
  }, [remindersEnabled]);

  const loadInstantCoachFeedback = useCallback(async (entry: NowInEnglishEntry) => {
    const requestId = instantCoachRequestIdRef.current + 1;
    instantCoachRequestIdRef.current = requestId;
    setInstantCoachEntry(entry);
    setInstantCoachFeedback(null);
    setInstantCoachFeedbackError("");
    setIsLoadingInstantCoachFeedback(true);

    try {
      const feedback = await requestNowInEnglishCoachFeedback({
        text: entry.text,
        createdAt: entry.createdAt
      });
      if (instantCoachRequestIdRef.current !== requestId) {
        return;
      }
      setInstantCoachFeedback(feedback);
    } catch (error) {
      if (instantCoachRequestIdRef.current !== requestId) {
        return;
      }
      setInstantCoachFeedbackError(
        error instanceof Error
          ? error.message
          : "저장은 완료됐어요. AI 코치는 잠시 후 다시 시도해 주세요."
      );
    } finally {
      if (instantCoachRequestIdRef.current === requestId) {
        setIsLoadingInstantCoachFeedback(false);
      }
    }
  }, []);

  async function handleToggleReflectionExpression(expression: NowInEnglishAiReflectionExpression) {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey) {
      return;
    }

    if (!currentUser) {
      Alert.alert("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
        { text: "취소", style: "cancel" },
        {
          text: "로그인하기",
          onPress: () => router.push("/login")
        }
      ]);
      return;
    }

    if (savingExpressionKeys.includes(normalizedKey)) {
      return;
    }

    const savedExpressionId = savedExpressionIdsByKey[normalizedKey];
    setSavingExpressionKeys((current) =>
      current.includes(normalizedKey) ? current : [...current, normalizedKey]
    );

    try {
      if (savedExpressionId) {
        await deleteSavedExpression(savedExpressionId);
        setSavedExpressionIdsByKey((current) => {
          const next = { ...current };
          delete next[normalizedKey];
          return next;
        });
        return;
      }

      const savedExpression = await saveExpression({
        expression: expression.expression,
        meaningKo: expression.meaningKo || undefined,
        usageTipKo: expression.usageTip || undefined,
        exampleEn: expression.example || undefined,
        sourceType: "COACH_RECOMMENDATION"
      });
      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [normalizedKey]: savedExpression.id
      }));
    } catch (error) {
      Alert.alert("표현 저장에 실패했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingExpressionKeys((current) => current.filter((key) => key !== normalizedKey));
    }
  }

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert("한 줄을 적어볼까요?", "지금 하고 있는 일이나 떠오른 생각을 영어로 짧게 남겨보세요.");
      return;
    }

    try {
      setIsSaving(true);
      const polishSource = pendingPolishSource;
      let savedEntry: NowInEnglishEntry;
      try {
        savedEntry = await saveNowInEnglishEntry(trimmed, {
          entryId: polishSource?.entryId ?? undefined,
          createdAt: polishSource?.createdAt ?? undefined,
          dateKey: polishSource?.dateKey ?? undefined,
          polishedFromEntryId: polishSource?.entryId ?? null,
          polishedFromText: polishSource?.text ?? null
        });
      } catch (error) {
        Alert.alert("저장하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
        return;
      }

      setText("");
      setPendingPolishSource(null);
      setEntries((current) => mergeSavedNowInEnglishEntry(current, savedEntry));
      setStatusMessage(polishSource ? "좋아요. 다듬은 문장의 전후를 기록했어요." : "좋아요. 오늘의 영어 조각이 하나 쌓였어요.");
      void loadInstantCoachFeedback(savedEntry);
      try {
        await loadSummary();
      } catch {
        setStatusMessage("저장은 됐어요. 기록 목록은 잠시 후 다시 갱신해 주세요.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEnableReminder(nextIntervalHours: NowInEnglishIntervalHours) {
    try {
      setIsScheduling(true);
      const normalizedIntervalHours = clampReminderIntervalHours(nextIntervalHours);
      const settings = await enableNowInEnglishReminders(normalizedIntervalHours, quietHours, scheduleMode);
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage(`${normalizedIntervalHours}시간마다 지금 영어로 알림을 보내드릴게요.`);
    } catch (error) {
      Alert.alert("알림을 켜지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleDisableReminder() {
    try {
      setIsScheduling(true);
      const settings = await disableNowInEnglishReminders();
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage("지금 영어로 알림을 껐어요.");
    } catch (error) {
      Alert.alert("알림을 끄지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleUpdateScheduleMode(nextScheduleMode: NowInEnglishScheduleMode) {
    try {
      setIsScheduling(true);
      const settings = await updateNowInEnglishScheduleMode(nextScheduleMode);
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage(
        nextScheduleMode === "HOURLY_ANCHOR"
          ? "정각 기준으로 알림을 맞췄어요."
          : "지금부터 n시간마다 알림을 맞췄어요."
      );
    } catch (error) {
      Alert.alert("알림 기준을 바꾸지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleUpdateQuietHours(nextQuietHours: NowInEnglishQuietHours) {
    try {
      setIsScheduling(true);
      const settings = await updateNowInEnglishQuietHours(nextQuietHours);
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage(
        nextQuietHours.enabled
          ? `방해금지 시간을 ${formatNowInEnglishQuietHours(nextQuietHours)}로 설정했어요.`
          : "방해금지 시간을 껐어요."
      );
    } catch (error) {
      Alert.alert("방해금지 시간을 바꾸지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  function shiftQuietHour(kind: "start" | "end", direction: -1 | 1) {
    const key = kind === "start" ? "startHour" : "endHour";
    const nextQuietHours = {
      ...quietHours,
      [key]: (quietHours[key] + direction + 24) % 24
    };
    void handleUpdateQuietHours(nextQuietHours);
  }

  function shiftReminderInterval(direction: -1 | 1) {
    const nextIntervalHours = clampReminderIntervalHours(intervalHours + direction);
    if (!remindersEnabled) {
      setIntervalHours(nextIntervalHours);
      return;
    }

    void handleEnableReminder(nextIntervalHours);
  }

  function appendCoachExpression(expression: string) {
    const normalizedExpression = expression.trim();
    if (!normalizedExpression) {
      return;
    }

    setText((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent) {
        return normalizedExpression;
      }

      return `${trimmedCurrent}\n${normalizedExpression}`;
    });
    setIsCoachOpen(false);
    setStatusMessage("코치 표현을 한 줄 기록에 넣었어요.");
  }

  async function handleRequestCoachHelp(questionOverride?: string, answerOverride?: string) {
    const nextQuestion = (questionOverride ?? coachQuestion).trim();
    if (!nextQuestion) {
      setCoachHelpError("코치에게 물어볼 내용을 먼저 적어 주세요.");
      setIsCoachOpen(true);
      return;
    }

    try {
      setIsCoachOpen(true);
      setIsLoadingCoachHelp(true);
      setCoachHelp(null);
      setCoachHelpError("");
      const nextCoachHelp = await requestCoachHelp({
        promptId: NOW_IN_ENGLISH_COACH_PROMPT_ID,
        question: nextQuestion,
        answer: (answerOverride ?? text).trim() || undefined,
        attemptType: "INITIAL"
      });
      setCoachQuestion(nextQuestion);
      setCoachHelp(nextCoachHelp);
    } catch (error) {
      setCoachHelpError(error instanceof Error ? error.message : "AI 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  function handleAskCoachAboutInstantEntry() {
    setCoachQuestion("");
    setCoachHelp(null);
    setCoachHelpError("");
    setIsCoachOpen(true);
  }

  function handleReviseInstantEntry() {
    if (!instantCoachEntry) {
      return;
    }

    setText(instantCoachEntry.text);
    setPendingPolishSource({
      entryId: instantCoachEntry.id,
      text: instantCoachEntry.text,
      createdAt: instantCoachEntry.createdAt,
      dateKey: instantCoachEntry.dateKey
    });
    setIsCoachOpen(false);
    setStatusMessage("AI 제안을 참고해서 직접 다듬어 보세요.");
    scrollViewRef.current?.scrollTo({
      y: Math.max(writeSectionYRef.current - 8, 0),
      animated: true
    });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleCancelPolish() {
    setText("");
    setPendingPolishSource(null);
    setStatusMessage("수정을 취소했어요. 새 영어 조각을 남겨볼까요?");
  }

  function handleRetryInstantCoachFeedback() {
    if (!instantCoachEntry) {
      return;
    }

    void loadInstantCoachFeedback(instantCoachEntry);
  }

  function handleKeepInstantEntry() {
    instantCoachRequestIdRef.current += 1;
    setInstantCoachEntry(null);
    setInstantCoachFeedback(null);
    setInstantCoachFeedbackError("");
    setIsLoadingInstantCoachFeedback(false);
    setPendingPolishSource(null);
    setStatusMessage("좋아요. 이 문장은 그대로 남겨둘게요.");
  }

  const isPolishingEntry = pendingPolishSource !== null;
  const isSaveDisabled = isSaving || isLoading;
  const saveButtonLabel = isSaving
    ? isPolishingEntry
      ? "수정 저장 중..."
      : "저장 중..."
    : isPolishingEntry
      ? "수정 저장하기"
      : "저장하기";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
              <Text style={styles.backButtonText}>{"<"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>지금 영어로</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View
            style={styles.writeSection}
            onLayout={(event) => {
              writeSectionYRef.current = event.nativeEvent.layout.y;
            }}
          >
            {isLoading ? (
              <View style={styles.writeHeader}>
                <ActivityIndicator color="#EA920D" />
              </View>
            ) : null}

            <View style={styles.composerCard}>
              <Text style={styles.heroTitle}>지금 뭐하고 있나요?, 무슨 생각하고 있나요?</Text>
              <View style={styles.composerDivider} />
              {isPolishingEntry ? (
                <View style={styles.polishModeBanner}>
                  <View style={styles.polishModeCopy}>
                    <Text style={styles.polishModeLabel}>기존 기록 수정 중</Text>
                    <Text style={styles.polishModeBody}>저장하면 방금 남긴 문장이 수정되고 전후 비교가 남아요.</Text>
                  </View>
                  <Pressable style={styles.polishCancelButton} onPress={handleCancelPolish}>
                    <Text style={styles.polishCancelButtonText}>취소</Text>
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                maxLength={NOW_IN_ENGLISH_TEXT_LIMIT}
                multiline
                textAlignVertical="top"
                autoCapitalize="sentences"
                autoCorrect
                placeholder="I’m doing something small right now."
                placeholderTextColor="#B7A693"
                style={styles.input}
              />

              {!isCoachOpen ? (
                <Pressable
                  style={[styles.coachTriggerDock, !text.trim() && styles.coachTriggerDockWithBubble]}
                  accessibilityRole="button"
                  accessibilityLabel="AI 코치 열기"
                  accessibilityHint="지금 영어로 한 줄 기록을 도와주는 AI 코치를 엽니다."
                  onPress={() => setIsCoachOpen(true)}
                >
                  {!text.trim() ? (
                    <View style={styles.coachTriggerBubble}>
                      <Text style={styles.coachTriggerBubbleText}>막히면 AI 코치에게 물어봐요.</Text>
                      <View style={styles.coachTriggerBubbleTail} />
                    </View>
                  ) : null}

                  <View style={styles.coachTriggerMascotFrame}>
                    <Image source={coachMascotImage} style={styles.coachTriggerMascot} />
                  </View>
                </Pressable>
              ) : null}
              <Text style={styles.inputCounter}>{text.length}/{NOW_IN_ENGLISH_TEXT_LIMIT}</Text>
            </View>

            {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isSaveDisabled && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={isSaveDisabled}
            >
              <Text style={styles.primaryButtonText}>{saveButtonLabel}</Text>
            </Pressable>

            {instantCoachEntry ? (
              <InstantCoachFeedbackCard
                entry={instantCoachEntry}
                feedback={instantCoachFeedback}
                isLoading={isLoadingInstantCoachFeedback}
                error={instantCoachFeedbackError}
                onAskCoach={handleAskCoachAboutInstantEntry}
                onRevise={handleReviseInstantEntry}
                onKeep={handleKeepInstantEntry}
                onRetry={handleRetryInstantCoachFeedback}
              />
            ) : null}
          </View>

          <Pressable
            style={[styles.reminderSummaryButton, (isScheduling || isLoading) && styles.buttonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="알림 설정 열기"
            onPress={() => setIsReminderSettingsOpen(true)}
            disabled={isScheduling || isLoading}
          >
            <View style={styles.reminderSummaryCopy}>
              <Text style={styles.reminderSummaryTitle}>알림 설정</Text>
              <Text style={styles.reminderSummaryMeta}>{reminderLabel}</Text>
            </View>
            <View style={[styles.reminderBadge, remindersEnabled && styles.reminderBadgeOn]}>
              <Text style={[styles.reminderBadgeText, remindersEnabled && styles.reminderBadgeTextOn]}>
                {remindersEnabled ? "ON" : "OFF"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.listSection}>
            <View style={styles.listHeaderRow}>
              <View style={styles.listHeaderCopy}>
                <Text style={styles.sectionTitle}>{historyTitle}</Text>
                <Text style={styles.listMeta}>{historyMeta}</Text>
              </View>
              <Pressable style={styles.calendarOpenButton} onPress={handleOpenCalendar}>
                <Text style={styles.calendarOpenButtonText}>달력</Text>
              </Pressable>
            </View>
            <View style={styles.historyTabs}>
              {HISTORY_FILTERS.map((filter) => {
                const isActive = historyFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    style={[styles.historyTab, isActive && styles.historyTabActive]}
                    onPress={() => handleSelectHistoryFilter(filter.key)}
                  >
                    <Text style={[styles.historyTabText, isActive && styles.historyTabTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {reflectionDateKey && yesterdayEntries.length > 0 ? (
              <YesterdayReflectionCard
                entries={yesterdayEntries}
                dateLabel={reflectionDateLabel}
                aiReflection={yesterdayAiReflection}
                isLoadingAiReflection={isLoadingYesterdayAiReflection}
                aiReflectionError={yesterdayAiReflectionError}
                onWriteToday={handleWriteTodayFromReflection}
                onToggleExpression={(expression) => void handleToggleReflectionExpression(expression)}
                isExpressionSaved={(expression) => Boolean(savedExpressionIdsByKey[normalizeExpressionKey(expression)])}
                isSavingExpression={(expression) => savingExpressionKeys.includes(normalizeExpressionKey(expression))}
              />
            ) : null}
            <EntryTimeline
              groups={entryGroups}
              emptyTitle={emptyTimelineCopy.title}
              emptyBody={emptyTimelineCopy.body}
            />
          </View>
        </ScrollView>
        <MobileNavBar activeTab="home" />
      </KeyboardAvoidingView>

      <Modal
        visible={isReminderSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderSettingsOpen(false)}
      >
        <View style={styles.reminderSettingsOverlay}>
          <Pressable style={styles.reminderSettingsBackdrop} onPress={() => setIsReminderSettingsOpen(false)} />
          <SafeAreaView style={styles.reminderSettingsFrame} edges={["top", "bottom"]}>
            <View style={styles.reminderSettingsCard}>
              <View style={styles.reminderSettingsHeader}>
                <View style={styles.reminderSettingsHeaderCopy}>
                  <Text style={styles.reminderSettingsTitle}>언제마다 알려드릴까요?</Text>
                </View>
                <Pressable
                  style={styles.reminderSettingsCloseButton}
                  onPress={() => setIsReminderSettingsOpen(false)}
                >
                  <Text style={styles.reminderSettingsCloseText}>닫기</Text>
                </Pressable>
              </View>

              <Text style={styles.reminderSettingsBody}>
                지금 하고 있는 일이나 떠오른 생각을 영어로 남길 수 있게 가볍게 알려드릴게요.
              </Text>
              <Text style={styles.reminderMeta}>{reminderLabel}</Text>

              <View style={styles.reminderSettingsActions}>
                <ReminderIntervalStepper
                  intervalHours={intervalHours}
                  onDecrease={() => shiftReminderInterval(-1)}
                  onIncrease={() => shiftReminderInterval(1)}
                  disabled={isScheduling}
                />
                <Pressable
                  style={[
                    styles.reminderPowerButton,
                    !remindersEnabled && styles.reminderPowerButtonOn,
                    isScheduling && styles.buttonDisabled
                  ]}
                  onPress={() => void (remindersEnabled ? handleDisableReminder() : handleEnableReminder(intervalHours))}
                  disabled={isScheduling}
                >
                  <Text
                    style={[
                      styles.reminderPowerButtonText,
                      !remindersEnabled && styles.reminderPowerButtonTextOn
                    ]}
                  >
                    {remindersEnabled ? "알림 끄기" : "알림 켜기"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.scheduleModeCard}>
                <View style={styles.scheduleModeHeader}>
                  <View style={styles.scheduleModeCopy}>
                    <Text style={styles.scheduleModeTitle}>알림 기준</Text>
                    <Text style={styles.scheduleModeBody}>{getScheduleModeBody(scheduleMode)}</Text>
                  </View>
                </View>
                <View style={styles.scheduleModeOptions}>
                  <Pressable
                    style={[
                      styles.scheduleModeOption,
                      scheduleMode === "HOURLY_ANCHOR" && styles.scheduleModeOptionActive
                    ]}
                    onPress={() => void handleUpdateScheduleMode("HOURLY_ANCHOR")}
                    disabled={isScheduling}
                  >
                    <Text
                      style={[
                        styles.scheduleModeOptionText,
                        scheduleMode === "HOURLY_ANCHOR" && styles.scheduleModeOptionTextActive
                      ]}
                    >
                      정각 기준
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.scheduleModeOption,
                      scheduleMode === "FROM_NOW" && styles.scheduleModeOptionActive
                    ]}
                    onPress={() => void handleUpdateScheduleMode("FROM_NOW")}
                    disabled={isScheduling}
                  >
                    <Text
                      style={[
                        styles.scheduleModeOptionText,
                        scheduleMode === "FROM_NOW" && styles.scheduleModeOptionTextActive
                      ]}
                    >
                      지금부터
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.quietHoursCard}>
                <View style={styles.quietHoursHeader}>
                  <View style={styles.quietHoursCopy}>
                    <Text style={styles.quietHoursTitle}>방해금지 시간</Text>
                    <Text style={styles.quietHoursBody}>
                      {quietHours.enabled
                        ? `${formatNowInEnglishQuietHours(quietHours)}에는 알림을 쉬어요.`
                        : "밤에도 알림을 받을 수 있어요."}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.quietHoursToggle, quietHours.enabled && styles.quietHoursToggleActive]}
                    onPress={() => void handleUpdateQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
                    disabled={isScheduling}
                  >
                    <Text
                      style={[
                        styles.quietHoursToggleText,
                        quietHours.enabled && styles.quietHoursToggleTextActive
                      ]}
                    >
                      {quietHours.enabled ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                </View>

                {quietHours.enabled ? (
                  <View style={styles.quietHourStepperRow}>
                    <QuietHourStepper
                      label="시작"
                      hour={quietHours.startHour}
                      onDecrease={() => shiftQuietHour("start", -1)}
                      onIncrease={() => shiftQuietHour("start", 1)}
                      disabled={isScheduling}
                    />
                    <QuietHourStepper
                      label="종료"
                      hour={quietHours.endHour}
                      onDecrease={() => shiftQuietHour("end", -1)}
                      onIncrease={() => shiftQuietHour("end", 1)}
                      disabled={isScheduling}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={isCoachOpen} animationType="slide" onRequestClose={() => setIsCoachOpen(false)}>
        <SafeAreaView style={styles.coachModalRoot} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={styles.coachModalKeyboardFrame}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
            <View style={styles.coachModalHeader}>
              <Text style={styles.coachModalTitle}>AI 코치</Text>
              <Pressable style={styles.coachModalCloseButton} onPress={() => setIsCoachOpen(false)}>
                <Text style={styles.coachCloseText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.coachModalBody}>
              <ScrollView
                style={styles.coachModalScroll}
                contentContainerStyle={styles.coachModalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.coachPanel}>
                  <Text style={styles.coachPanelTitle}>지금 상황을 영어로 쓰는 걸 도와드릴게요.</Text>
                  <TextInput
                    style={styles.coachInput}
                    multiline
                    textAlignVertical="top"
                    placeholder='예: "퇴근길에 피곤해"를 영어로 어떻게 말해?'
                    placeholderTextColor="#AE9A87"
                    value={coachQuestion}
                    onChangeText={(value) => {
                      setCoachQuestion(value);
                      setCoachHelp(null);
                      setCoachHelpError("");
                    }}
                  />

                  <View style={styles.coachQuickActionWrap}>
                    {coachQuickQuestions.map((question) => (
                      <Pressable
                        key={question}
                        style={styles.coachQuickChip}
                        onPress={() => {
                          setCoachQuestion(question);
                          setCoachHelp(null);
                          setCoachHelpError("");
                        }}
                      >
                        <Text style={styles.coachQuickChipText}>{question}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    style={[styles.coachPrimaryButton, isLoadingCoachHelp && styles.buttonDisabled]}
                    onPress={() => void handleRequestCoachHelp()}
                    disabled={isLoadingCoachHelp}
                  >
                    {isLoadingCoachHelp ? (
                      <ActivityIndicator color="#24180B" />
                    ) : (
                      <Text style={styles.coachPrimaryButtonText}>코치에게 물어보기</Text>
                    )}
                  </Pressable>

                  <Text style={styles.coachMetaText}>
                    코치 답변은 힌트예요. 그대로 복사하기보다 지금 내 상황에 맞게 한 줄로 바꿔 보세요.
                  </Text>

                  {coachHelpError ? <Text style={styles.coachErrorText}>{coachHelpError}</Text> : null}

                  {coachHelp ? (
                    <View style={styles.coachResultStack}>
                      <View style={styles.coachReplyCard}>
                        <Text style={styles.coachReplyBadge}>코치 답변</Text>
                        <Text style={styles.coachReplyText}>{coachHelp.coachReply}</Text>
                      </View>

                      <View style={styles.coachExpressionList}>
                        {coachHelp.expressions.map((expression: CoachExpression) => (
                          <View key={expression.id} style={styles.coachExpressionCard}>
                            <Text style={styles.coachExpressionText}>{expression.expression}</Text>
                            <Text style={styles.coachExpressionMeaning}>{expression.meaningKo}</Text>
                            <Text style={styles.coachExpressionTip}>{expression.usageTip}</Text>
                            <Text style={styles.coachExpressionExample}>{expression.example}</Text>
                            <Pressable
                              style={styles.coachExpressionInsertButton}
                              onPress={() => appendCoachExpression(expression.expression)}
                            >
                              <Text style={styles.coachExpressionInsertButtonText}>한 줄에 넣기</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarOpen(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <Pressable style={styles.calendarModalBackdrop} onPress={() => setIsCalendarOpen(false)} />
          <SafeAreaView style={styles.calendarModalFrame} edges={["top", "bottom"]}>
            <View style={styles.calendarModalCard}>
              <View style={styles.calendarModalHeader}>
                <Pressable
                  style={styles.monthButton}
                  onPress={() =>
                    setCalendarMonthCursor((current) =>
                      getCalendarMonthStart(new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))
                    )
                  }
                >
                  <Text style={styles.monthButtonText}>{"<"}</Text>
                </Pressable>
                <Text style={styles.monthTitle}>{formatCalendarMonthLabel(calendarMonthCursor)}</Text>
                <Pressable
                  style={styles.monthButton}
                  onPress={() =>
                    setCalendarMonthCursor((current) =>
                      getCalendarMonthStart(new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))
                    )
                  }
                >
                  <Text style={styles.monthButtonText}>{">"}</Text>
                </Pressable>
              </View>

              <View style={styles.calendarWeekHeader}>
                {WEEK_LABELS.map((label) => (
                  <Text key={label} style={styles.calendarWeekLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarCells.map((cell) => (
                  <View key={cell.key} style={styles.calendarCellWrap}>
                    <Pressable
                      style={[
                        styles.calendarCell,
                        cell.hasEntries && styles.calendarCellHasEntries,
                        cell.isToday && styles.calendarCellToday,
                        cell.isSelected && styles.calendarCellSelected,
                        !cell.isCurrentMonth && styles.calendarCellOutside
                      ]}
                      onPress={() => handleSelectCalendarDate(cell.key)}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          cell.hasEntries && styles.calendarCellTextHasEntries,
                          cell.isToday && styles.calendarCellTextToday,
                          cell.isSelected && styles.calendarCellTextSelected,
                          !cell.isCurrentMonth && styles.calendarCellTextOutside
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {cell.hasEntries ? <View style={styles.calendarDot} /> : null}
                    </Pressable>
                  </View>
                ))}
              </View>

              <Text style={styles.calendarFooterMeta}>날짜를 누르면 그날 남긴 영어 조각을 바로 볼 수 있어요.</Text>
              <Pressable style={styles.calendarCloseButton} onPress={() => setIsCalendarOpen(false)}>
                <Text style={styles.calendarCloseButtonText}>닫기</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  screen: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 24,
    gap: 18
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    color: "#4A4035"
  },
  headerTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "900",
    color: "#2A2521"
  },
  headerSpacer: {
    width: 42
  },
  composerCard: {
    position: "relative",
    borderRadius: 34,
    backgroundColor: "#FDFDFB",
    borderWidth: 1,
    borderColor: "#EBDCCB",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 0,
    gap: 18,
    overflow: "hidden",
    shadowColor: "#D18634",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontWeight: "900",
    color: "#25211D"
  },
  composerDivider: {
    height: 1,
    backgroundColor: "#EAD8C2"
  },
  polishModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0C993",
    backgroundColor: "#FFF4DF",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  polishModeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  polishModeLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#A46412"
  },
  polishModeBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#6A5945"
  },
  polishCancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  polishCancelButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  writeSection: {
    gap: 14
  },
  writeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  input: {
    minHeight: 230,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 82,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "800",
    color: "#2B2620"
  },
  coachTriggerDock: {
    position: "absolute",
    right: 14,
    bottom: 14,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 54,
    minHeight: 54
  },
  coachTriggerDockWithBubble: {
    minWidth: 216
  },
  coachTriggerBubble: {
    position: "absolute",
    right: 44,
    bottom: 48,
    width: 166,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#C1761E",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  coachTriggerBubbleText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#7B5A35"
  },
  coachTriggerBubbleTail: {
    position: "absolute",
    right: 18,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    transform: [{ rotate: "45deg" }]
  },
  coachTriggerMascotFrame: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#C1761E",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  coachTriggerMascot: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(193, 118, 30, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.96)"
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#2F7A54"
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: "#24180B"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  instantCoachCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 18,
    paddingVertical: 17,
    gap: 11,
    shadowColor: "#D18634",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  instantCoachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  instantCoachKicker: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#C8750D"
  },
  instantCoachOriginal: {
    borderRadius: 18,
    backgroundColor: "#F7EFE5",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#6A5945"
  },
  instantCoachTitle: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontWeight: "900",
    color: "#25211D"
  },
  instantCoachBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#6A5945"
  },
  instantCoachSuggestionBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0C993",
    backgroundColor: "#FFF4DF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 7
  },
  instantCoachLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46412"
  },
  instantCoachSuggestion: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "900",
    color: "#2B2620"
  },
  instantCoachSuggestionTranslation: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#7A6650"
  },
  instantCoachSection: {
    gap: 6
  },
  instantCoachSectionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  instantCoachSectionBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "#6D6050"
  },
  instantCoachInstruction: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "800",
    color: "#3C342B"
  },
  instantCoachExpression: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECD9C1",
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4
  },
  instantCoachExpressionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B2620"
  },
  instantCoachExpressionMeaning: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8A5A1E"
  },
  instantCoachExpressionExample: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    fontWeight: "700",
    color: "#756554"
  },
  instantCoachError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#B84836"
  },
  instantCoachActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  instantCoachRetryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  instantCoachRetryButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  instantCoachReviseButton: {
    borderRadius: 999,
    backgroundColor: "#EA920D",
    paddingHorizontal: 15,
    paddingVertical: 9
  },
  instantCoachReviseButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#24180B"
  },
  instantCoachKeepButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFF7E9",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  instantCoachKeepButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  instantCoachAskButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  instantCoachAskButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionStack: {
    gap: 14
  },
  reflectionCard: {
    borderRadius: 30,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EAD8C2",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
    shadowColor: "#D18634",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  reflectionKicker: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  reflectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontWeight: "900",
    color: "#27231F"
  },
  reflectionBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#756554"
  },
  reflectionHighlight: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#F0C993",
    backgroundColor: "#FFF4DF",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8
  },
  reflectionHighlightLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#A46412"
  },
  reflectionSentenceList: {
    gap: 10
  },
  reflectionSentenceItem: {
    gap: 4
  },
  reflectionSentenceItemWithBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F0D5AF",
    paddingTop: 10
  },
  reflectionAiCard: {
    borderRadius: 30,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EAD8C2",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
    shadowColor: "#D18634",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  reflectionAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  reflectionAiKicker: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  reflectionAiTitle: {
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.35,
    fontWeight: "900",
    color: "#25211D"
  },
  reflectionAiBody: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800",
    color: "#6D6050"
  },
  reflectionFeedbackBox: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 13,
    gap: 9
  },
  reflectionHighlightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  reflectionHighlightBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A5A1E",
    backgroundColor: "#FFF1D9"
  },
  reflectionHighlightItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#4F4031"
  },
  reflectionPlainSection: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 13,
    gap: 6
  },
  reflectionInsightLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  reflectionInsightText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800",
    color: "#4F4031"
  },
  reflectionNextActionExample: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    fontWeight: "800",
    color: "#2B2620"
  },
  reflectionAiClosing: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "900",
    color: "#756554"
  },
  reflectionAiError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#B84836"
  },
  reflectionExpressionList: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 13,
    gap: 9
  },
  reflectionExpressionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionExpressionCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECD9C1",
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4
  },
  reflectionExpressionItemWithBorder: {
    marginTop: 2
  },
  reflectionExpressionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  reflectionExpressionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B2620"
  },
  reflectionExpressionSaveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  reflectionExpressionSaveButtonSaved: {
    backgroundColor: "#EA920D",
    borderColor: "#EA920D"
  },
  reflectionExpressionSaveText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionExpressionSaveTextSaved: {
    color: "#24180B"
  },
  reflectionExpressionMeaning: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8A5A1E"
  },
  reflectionExpressionExample: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    fontWeight: "700",
    color: "#756554"
  },
  reflectionTime: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A26A25"
  },
  reflectionEntryText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#3A3128"
  },
  reflectionButton: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  reflectionButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#24180B"
  },
  reminderSummaryButton: {
    minHeight: 70,
    borderRadius: 24,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EAD8C2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14
  },
  reminderSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  reminderSummaryTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B241D"
  },
  reminderSummaryMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8A7560"
  },
  reminderBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    backgroundColor: "#FFF9F2",
    justifyContent: "center",
    minWidth: 54,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  reminderBadgeOn: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  reminderBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8B6B49"
  },
  reminderBadgeTextOn: {
    color: "#24180B"
  },
  reminderMeta: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalStepper: {
    gap: 8
  },
  intervalStepperLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalStepperControl: {
    width: "100%",
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5C49F",
    backgroundColor: "#FFFEFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    gap: 8
  },
  intervalStepperButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E2"
  },
  intervalStepperButtonText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalStepperValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B241D"
  },
  scheduleModeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EACBA6",
    backgroundColor: "rgba(255, 253, 248, 0.68)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  scheduleModeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  scheduleModeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  scheduleModeTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  scheduleModeBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#7B6A58"
  },
  scheduleModeOptions: {
    flexDirection: "row",
    gap: 8
  },
  scheduleModeOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  scheduleModeOptionActive: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  scheduleModeOptionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#805D37"
  },
  scheduleModeOptionTextActive: {
    color: "#24180B"
  },
  quietHoursCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EACBA6",
    backgroundColor: "rgba(255, 253, 248, 0.68)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  quietHoursHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  quietHoursCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  quietHoursTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  quietHoursBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#7B6A58"
  },
  quietHoursToggle: {
    minWidth: 52,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  quietHoursToggleActive: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  quietHoursToggleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#8B6B49"
  },
  quietHoursToggleTextActive: {
    color: "#24180B"
  },
  quietHourStepperRow: {
    flexDirection: "row",
    gap: 10
  },
  quietHourStepper: {
    flex: 1,
    gap: 7
  },
  quietHourLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#9A6A22"
  },
  quietHourControl: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E5C49F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    gap: 4
  },
  quietHourButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E2"
  },
  quietHourButtonText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  quietHourValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#2B241D"
  },
  reminderPowerButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9F2"
  },
  reminderPowerButtonOn: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  reminderPowerButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#805D37"
  },
  reminderPowerButtonTextOn: {
    color: "#24180B"
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9F2"
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#805D37"
  },
  reminderSettingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(34, 25, 16, 0.35)",
    justifyContent: "flex-end"
  },
  reminderSettingsBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  reminderSettingsFrame: {
    justifyContent: "flex-end"
  },
  reminderSettingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 30,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EBD5B9",
    padding: 22,
    gap: 16,
    shadowColor: "#5E3A12",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  reminderSettingsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  reminderSettingsHeaderCopy: {
    flex: 1,
    gap: 4
  },
  reminderSettingsTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    color: "#27231F",
    letterSpacing: -0.5
  },
  reminderSettingsCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "#FFF9F2"
  },
  reminderSettingsCloseText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#805D37"
  },
  reminderSettingsBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#6F5E4B"
  },
  reminderSettingsActions: {
    gap: 10
  },
  listSection: {
    gap: 14
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  listHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#27231F"
  },
  listMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8A6F52"
  },
  calendarOpenButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2C5A6",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  calendarOpenButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  historyTabs: {
    flexDirection: "row",
    borderRadius: 999,
    backgroundColor: "#EFE4D6",
    padding: 4,
    gap: 4
  },
  historyTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  historyTabActive: {
    backgroundColor: "#EA920D"
  },
  historyTabText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#7B6348"
  },
  historyTabTextActive: {
    color: "#24180B"
  },
  timelineList: {
    gap: 18
  },
  timelineGroup: {
    gap: 10
  },
  timelineGroupHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 2
  },
  timelineDateLabel: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  timelineCount: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#9A7140"
  },
  entryList: {
    gap: 10
  },
  entryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8
  },
  entryTime: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: "#A26A25"
  },
  entryText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    color: "#2B2620"
  },
  inputCounter: {
    position: "absolute",
    left: 22,
    bottom: 18,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#A89785"
  },
  polishedComparison: {
    gap: 9
  },
  polishedKicker: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#C8750D"
  },
  polishedRow: {
    gap: 4
  },
  polishedAfterRow: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 9
  },
  polishedLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#8B6A45"
  },
  polishedBeforeText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#8F3D30"
  },
  polishedAfterText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "900",
    color: "#1F6B35"
  },
  emptyListCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8
  },
  emptyListTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  emptyListBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#786858"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  coachModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  coachModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  coachCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  coachModalBody: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  coachModalScroll: {
    flex: 1
  },
  coachModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28
  },
  coachPanel: {
    gap: 14
  },
  coachPanelTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    color: "#232128"
  },
  coachInput: {
    minHeight: 96,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    color: "#232128"
  },
  coachQuickActionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachQuickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  coachQuickChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#6D5A45"
  },
  coachPrimaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFD08A",
    alignItems: "center",
    justifyContent: "center"
  },
  coachPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5A3A00"
  },
  coachMetaText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6B58"
  },
  coachErrorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  },
  coachResultStack: {
    gap: 12
  },
  coachReplyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachReplyBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  coachReplyText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2F2A23"
  },
  coachExpressionList: {
    gap: 10
  },
  coachExpressionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachExpressionText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2620"
  },
  coachExpressionMeaning: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8C7355"
  },
  coachExpressionTip: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5D5143"
  },
  coachExpressionExample: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8A775E"
  },
  coachExpressionInsertButton: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFF4E2",
    borderWidth: 1,
    borderColor: "#EBCB97",
    paddingVertical: 12
  },
  coachExpressionInsertButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A5A19"
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 26, 15, 0.36)"
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
    borderRadius: 30,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14,
    shadowColor: "#2A1A0A",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  monthButtonText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  monthTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2A2521"
  },
  calendarWeekHeader: {
    flexDirection: "row"
  },
  calendarWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: "#A28D78"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  calendarCellWrap: {
    width: "14.285%",
    alignItems: "center"
  },
  calendarCell: {
    width: 38,
    height: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  calendarCellOutside: {
    opacity: 0.45
  },
  calendarCellHasEntries: {
    backgroundColor: "#FFF0D7"
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  calendarCellSelected: {
    backgroundColor: "#F2A14A"
  },
  calendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  calendarCellTextOutside: {
    color: "#B4A392"
  },
  calendarCellTextHasEntries: {
    color: "#8A5A1E"
  },
  calendarCellTextToday: {
    color: "#2E2416"
  },
  calendarCellTextSelected: {
    color: "#21160A"
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#EA920D"
  },
  calendarFooterMeta: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#8A6F52"
  },
  calendarCloseButton: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2C5A6",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarCloseButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  }
});
