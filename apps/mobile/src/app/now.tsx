import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar from "@/components/mobile-nav-bar";
import {
  NowCalendarModal,
  NowCoachModal,
  NowComposerCard,
  NowHeaderRow,
  NowHistorySection,
  NowReminderSettingsModal,
  NowReminderSummaryButton,
  NowSaveArea
} from "@/components/now/now-sections";
import {
  NOW_IN_ENGLISH_COACH_PROMPT_ID,
  DEFAULT_QUIET_HOURS,
  HISTORY_FILTERS,
  type NowInEnglishHistoryFilter,
  type PendingPolishSource,
  normalizeExpressionKey,
  buildSavedExpressionIdMap,
  mergeSavedNowInEnglishEntry,
  clampReminderIntervalHours,
  getReminderLabel,
  parseNowInEnglishDateKey,
  getCalendarMonthStart,
  buildNowInEnglishMonthCalendar,
  buildEntryGroups
} from "@/components/now/now-helpers";
import { styles } from "@/components/now/now-styles";
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
import type { CoachHelpResponse, NowInEnglishCoachFeedbackResponse } from "@/lib/types";

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

  // 회고를 받는 사이 보는 날짜가 바뀌면 늦게 온 응답을 버린다. 다른 날짜의 회고가 화면에 남지 않게 한다.
  const shownReflectionDateKeyRef = useRef(reflectionDateKey);
  useEffect(() => {
    shownReflectionDateKeyRef.current = reflectionDateKey;
  }, [reflectionDateKey]);

  const loadOrCreateYesterdayAiReflection = useCallback(
    async (forceRefresh = false) => {
      if (!reflectionDateKey || yesterdayEntries.length === 0 || !yesterdayEntrySignature) {
        setYesterdayAiReflection(null);
        setYesterdayAiReflectionError("");
        return;
      }

      const requestedDateKey = reflectionDateKey;
      const isStillShown = () => shownReflectionDateKeyRef.current === requestedDateKey;
      try {
        setIsLoadingYesterdayAiReflection(true);
        setYesterdayAiReflectionError("");

        if (!forceRefresh) {
          const cachedReflection = await getNowInEnglishAiReflection(reflectionDateKey);
          if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
            if (isStillShown()) {
              setYesterdayAiReflection(cachedReflection);
            }
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
        if (isStillShown()) {
          setYesterdayAiReflection(nextReflection);
        }
      } catch (error) {
        const cachedReflection = await getNowInEnglishAiReflection(reflectionDateKey);
        if (!isStillShown()) {
          return;
        }
        if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
          setYesterdayAiReflection(cachedReflection);
        }
        setYesterdayAiReflectionError(error instanceof Error ? error.message : "AI 회고를 불러오지 못했어요.");
      } finally {
        if (isStillShown()) {
          setIsLoadingYesterdayAiReflection(false);
        }
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
          <NowHeaderRow />

          <View
            style={styles.writeSection}
            onLayout={(event) => {
              writeSectionYRef.current = event.nativeEvent.layout.y;
            }}
          >
            <NowComposerCard
              handleCancelPolish={handleCancelPolish}
              inputRef={inputRef}
              isCoachOpen={isCoachOpen}
              isLoading={isLoading}
              isPolishingEntry={isPolishingEntry}
              setIsCoachOpen={setIsCoachOpen}
              setText={setText}
              text={text}
            />

            <NowSaveArea
              handleAskCoachAboutInstantEntry={handleAskCoachAboutInstantEntry}
              handleKeepInstantEntry={handleKeepInstantEntry}
              handleRetryInstantCoachFeedback={handleRetryInstantCoachFeedback}
              handleReviseInstantEntry={handleReviseInstantEntry}
              handleSave={handleSave}
              instantCoachEntry={instantCoachEntry}
              instantCoachFeedback={instantCoachFeedback}
              instantCoachFeedbackError={instantCoachFeedbackError}
              isLoadingInstantCoachFeedback={isLoadingInstantCoachFeedback}
              isSaveDisabled={isSaveDisabled}
              saveButtonLabel={saveButtonLabel}
              statusMessage={statusMessage}
            />
          </View>

          <NowReminderSummaryButton
            isLoading={isLoading}
            isScheduling={isScheduling}
            reminderLabel={reminderLabel}
            remindersEnabled={remindersEnabled}
            setIsReminderSettingsOpen={setIsReminderSettingsOpen}
          />

          <NowHistorySection
            emptyTimelineCopy={emptyTimelineCopy}
            entryGroups={entryGroups}
            handleOpenCalendar={handleOpenCalendar}
            handleSelectHistoryFilter={handleSelectHistoryFilter}
            handleToggleReflectionExpression={handleToggleReflectionExpression}
            handleWriteTodayFromReflection={handleWriteTodayFromReflection}
            historyFilter={historyFilter}
            historyMeta={historyMeta}
            historyTitle={historyTitle}
            isLoadingYesterdayAiReflection={isLoadingYesterdayAiReflection}
            reflectionDateKey={reflectionDateKey}
            reflectionDateLabel={reflectionDateLabel}
            savedExpressionIdsByKey={savedExpressionIdsByKey}
            savingExpressionKeys={savingExpressionKeys}
            yesterdayAiReflection={yesterdayAiReflection}
            yesterdayAiReflectionError={yesterdayAiReflectionError}
            yesterdayEntries={yesterdayEntries}
          />
        </ScrollView>
        <MobileNavBar activeTab="home" />
      </KeyboardAvoidingView>

      <NowReminderSettingsModal
        handleDisableReminder={handleDisableReminder}
        handleEnableReminder={handleEnableReminder}
        handleUpdateQuietHours={handleUpdateQuietHours}
        handleUpdateScheduleMode={handleUpdateScheduleMode}
        intervalHours={intervalHours}
        isReminderSettingsOpen={isReminderSettingsOpen}
        isScheduling={isScheduling}
        quietHours={quietHours}
        reminderLabel={reminderLabel}
        remindersEnabled={remindersEnabled}
        scheduleMode={scheduleMode}
        setIsReminderSettingsOpen={setIsReminderSettingsOpen}
        shiftQuietHour={shiftQuietHour}
        shiftReminderInterval={shiftReminderInterval}
      />

      <NowCoachModal
        appendCoachExpression={appendCoachExpression}
        coachHelp={coachHelp}
        coachHelpError={coachHelpError}
        coachQuestion={coachQuestion}
        coachQuickQuestions={coachQuickQuestions}
        handleRequestCoachHelp={handleRequestCoachHelp}
        isCoachOpen={isCoachOpen}
        isLoadingCoachHelp={isLoadingCoachHelp}
        setCoachHelp={setCoachHelp}
        setCoachHelpError={setCoachHelpError}
        setCoachQuestion={setCoachQuestion}
        setIsCoachOpen={setIsCoachOpen}
      />

      <NowCalendarModal
        calendarCells={calendarCells}
        calendarMonthCursor={calendarMonthCursor}
        handleSelectCalendarDate={handleSelectCalendarDate}
        isCalendarOpen={isCalendarOpen}
        setCalendarMonthCursor={setCalendarMonthCursor}
        setIsCalendarOpen={setIsCalendarOpen}
      />
    </SafeAreaView>
  );
}

