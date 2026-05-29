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
import { requestCoachHelp, requestNowInEnglishReflection } from "@/lib/api";
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
  type NowInEnglishEntry,
  type NowInEnglishIntervalHours,
  type NowInEnglishQuietHours,
  type NowInEnglishReminderSettings,
  type NowInEnglishScheduleMode,
  updateNowInEnglishScheduleMode,
  updateNowInEnglishQuietHours,
  saveNowInEnglishEntry
} from "@/lib/now-in-english";
import type { CoachExpression, CoachHelpResponse } from "@/lib/types";

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
                <Text style={styles.entryText}>{entry.text}</Text>
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
  representativeEntry,
  aiReflection,
  isLoadingAiReflection,
  aiReflectionError,
  onRefreshAiReflection,
  onWriteToday
}: {
  entries: NowInEnglishEntry[];
  representativeEntry: NowInEnglishEntry;
  aiReflection: NowInEnglishAiReflection | null;
  isLoadingAiReflection: boolean;
  aiReflectionError: string;
  onRefreshAiReflection: () => void;
  onWriteToday: () => void;
}) {
  const hasReflectionExpressions = (aiReflection?.expressions.length ?? 0) > 0;

  return (
    <View style={styles.reflectionCard}>
      <Text style={styles.reflectionKicker}>어제의 영어 조각</Text>
      <Text style={styles.reflectionTitle}>어제 {entries.length}개의 순간을 영어로 남겼어요.</Text>
      <Text style={styles.reflectionBody}>하루가 지나도 어제의 생각이 이렇게 남아 있어요.</Text>

      <View style={styles.reflectionHighlight}>
        <Text style={styles.reflectionHighlightLabel}>대표 문장</Text>
        <Text style={styles.reflectionHighlightText}>{representativeEntry.text}</Text>
      </View>

      <View style={styles.reflectionAiCard}>
        <View style={styles.reflectionAiHeader}>
          <Text style={styles.reflectionAiTitle}>{aiReflection?.headlineKo ?? "AI 회고"}</Text>
          {isLoadingAiReflection ? <ActivityIndicator size="small" color="#EA920D" /> : null}
        </View>

        {aiReflection ? (
          <>
            <Text style={styles.reflectionAiBody}>{aiReflection.summaryKo}</Text>
            {aiReflection.highlightsKo.length > 0 ? (
              <View style={styles.reflectionHighlightList}>
                {aiReflection.highlightsKo.map((highlight, index) => (
                  <View key={`${highlight}-${index}`} style={styles.reflectionHighlightItem}>
                    <Text style={styles.reflectionHighlightBullet}>{index + 1}</Text>
                    <Text style={styles.reflectionHighlightItemText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {aiReflection.patternKo ? (
              <View style={styles.reflectionInsightCard}>
                <Text style={styles.reflectionInsightLabel}>보이는 흐름</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.patternKo}</Text>
              </View>
            ) : null}
            {aiReflection.gentleCorrectionKo ? (
              <View style={styles.reflectionInsightCard}>
                <Text style={styles.reflectionInsightLabel}>가볍게 다듬기</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.gentleCorrectionKo}</Text>
              </View>
            ) : null}
            {aiReflection.nextActionKo ? (
              <View style={styles.reflectionNextActionCard}>
                <Text style={styles.reflectionInsightLabel}>오늘 이어 쓰기</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.nextActionKo}</Text>
                {aiReflection.nextActionExampleEn ? (
                  <Text style={styles.reflectionNextActionExample}>{aiReflection.nextActionExampleEn}</Text>
                ) : null}
              </View>
            ) : null}
            {hasReflectionExpressions ? (
              <View style={styles.reflectionExpressionList}>
                <Text style={styles.reflectionExpressionTitle}>오늘 이어 써볼 표현</Text>
                {aiReflection.expressions.map((expression, index) => (
                  <View key={`${expression.expression}-${index}`} style={styles.reflectionExpressionCard}>
                    <Text style={styles.reflectionExpressionText}>{expression.expression}</Text>
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
              ? "어제 남긴 문장들을 살펴보고 있어요."
              : "어제 기록을 AI가 짧게 돌아봐 줄 수 있어요."}
          </Text>
        )}

        {aiReflectionError ? <Text style={styles.reflectionAiError}>{aiReflectionError}</Text> : null}
        {!isLoadingAiReflection ? (
          <Pressable style={styles.reflectionAiRefreshButton} onPress={onRefreshAiReflection}>
            <Text style={styles.reflectionAiRefreshText}>
              {aiReflection ? "AI 회고 다시 받기" : "AI 회고 받기"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.reflectionTimeline}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.reflectionTimelineItem}>
            <Text style={styles.reflectionTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
            <Text style={styles.reflectionEntryText}>{entry.text}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.reflectionButton} onPress={onWriteToday}>
        <Text style={styles.reflectionButtonText}>오늘도 한 줄 남기기</Text>
      </Pressable>
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
  const shouldOpenReminderSettings = params.reminder === "open";
  const didOpenReminderSettingsFromParamRef = useRef(false);
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
  const [yesterdayAiReflection, setYesterdayAiReflection] = useState<NowInEnglishAiReflection | null>(null);
  const [yesterdayAiReflectionError, setYesterdayAiReflectionError] = useState("");
  const [isLoadingYesterdayAiReflection, setIsLoadingYesterdayAiReflection] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<NowInEnglishHistoryFilter>("today");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getCalendarMonthStart(new Date()));
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
      entries
        .filter((entry) => entry.dateKey === yesterdayKey)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [entries, yesterdayKey]
  );
  const yesterdayRepresentativeEntry = useMemo(
    () =>
      yesterdayEntries
        .slice()
        .sort((left, right) => right.text.length - left.text.length || left.createdAt.localeCompare(right.createdAt))[0] ??
      null,
    [yesterdayEntries]
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
      if (yesterdayEntries.length === 0 || !yesterdayEntrySignature) {
        setYesterdayAiReflection(null);
        setYesterdayAiReflectionError("");
        return;
      }

      try {
        setIsLoadingYesterdayAiReflection(true);
        setYesterdayAiReflectionError("");

        if (!forceRefresh) {
          const cachedReflection = await getNowInEnglishAiReflection(yesterdayKey);
          if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
            setYesterdayAiReflection(cachedReflection);
            return;
          }
        }

        const response = await requestNowInEnglishReflection({
          dateKey: yesterdayKey,
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
        const cachedReflection = await getNowInEnglishAiReflection(yesterdayKey);
        if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
          setYesterdayAiReflection(cachedReflection);
        }
        setYesterdayAiReflectionError(error instanceof Error ? error.message : "AI 회고를 불러오지 못했어요.");
      } finally {
        setIsLoadingYesterdayAiReflection(false);
      }
    },
    [yesterdayEntries, yesterdayEntrySignature, yesterdayKey]
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

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert("한 줄을 적어볼까요?", "지금 하고 있는 일이나 떠오른 생각을 영어로 짧게 남겨보세요.");
      return;
    }

    try {
      setIsSaving(true);
      await saveNowInEnglishEntry(trimmed);
      setText("");
      setStatusMessage("좋아요. 오늘의 영어 조각이 하나 쌓였어요.");
      await loadSummary();
    } catch (error) {
      Alert.alert("저장하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
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

  async function handleRequestCoachHelp(questionOverride?: string) {
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
        answer: text.trim() || undefined,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
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

          <View style={styles.writeSection}>
            {isLoading ? (
              <View style={styles.writeHeader}>
                <ActivityIndicator color="#EA920D" />
              </View>
            ) : null}

            <View style={styles.composerCard}>
              <Text style={styles.heroTitle}>지금 뭐하고 있나요, 무슨 생각하고 있나요?</Text>
              <View style={styles.composerDivider} />
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                autoCapitalize="sentences"
                autoCorrect
                placeholder="I’m drinking coffee and thinking about dinner."
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
            </View>

            {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={isSaving}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? "저장 중..." : "저장하기"}</Text>
            </Pressable>
          </View>

          {yesterdayRepresentativeEntry ? (
            <YesterdayReflectionCard
              entries={yesterdayEntries}
              representativeEntry={yesterdayRepresentativeEntry}
              aiReflection={yesterdayAiReflection}
              isLoadingAiReflection={isLoadingYesterdayAiReflection}
              aiReflectionError={yesterdayAiReflectionError}
              onRefreshAiReflection={() => void loadOrCreateYesterdayAiReflection(true)}
              onWriteToday={handleWriteTodayFromReflection}
            />
          ) : null}

          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderHeaderCopy}>
                <Text style={styles.reminderTitle}>원하는 주기로 영어 생각 꺼내기</Text>
              </View>
              <View style={[styles.reminderBadge, remindersEnabled && styles.reminderBadgeOn]}>
                <Text style={[styles.reminderBadgeText, remindersEnabled && styles.reminderBadgeTextOn]}>
                  {remindersEnabled ? "ON" : "OFF"}
                </Text>
              </View>
            </View>
            <Text style={styles.reminderMeta}>{reminderLabel}</Text>

            <View style={styles.reminderActions}>
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
                    <Text style={styles.scheduleModeKicker}>고급 설정</Text>
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
  reflectionHighlightText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2B2620"
  },
  reflectionAiCard: {
    borderRadius: 24,
    backgroundColor: "#FDF8EF",
    borderWidth: 1,
    borderColor: "#EFD8BB",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 10
  },
  reflectionAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  reflectionAiTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  reflectionAiBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#65533F"
  },
  reflectionHighlightList: {
    gap: 8
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
  reflectionInsightCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECD9C1",
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 5
  },
  reflectionInsightLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#C8750D"
  },
  reflectionInsightText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#4F4031"
  },
  reflectionNextActionCard: {
    borderRadius: 20,
    backgroundColor: "#FFF7E9",
    borderWidth: 1,
    borderColor: "#F0C993",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 7
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
    lineHeight: 21,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionAiError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#B84836"
  },
  reflectionAiRefreshButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  reflectionAiRefreshText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionExpressionList: {
    gap: 8
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
  reflectionExpressionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B2620"
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
  reflectionTimeline: {
    gap: 10
  },
  reflectionTimelineItem: {
    borderLeftWidth: 4,
    borderLeftColor: "#F3A342",
    paddingLeft: 12,
    gap: 4
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
  reminderCard: {
    borderRadius: 30,
    backgroundColor: "#FFF4DF",
    borderWidth: 1,
    borderColor: "#F0C993",
    padding: 20,
    gap: 14
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  reminderHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  reminderTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#2B241D"
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
  reminderActions: {
    gap: 10
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
  scheduleModeKicker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#C77606"
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A26A25"
  },
  entryText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    color: "#2B2620"
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
