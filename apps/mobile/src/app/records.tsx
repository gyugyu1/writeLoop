import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Alert, type LayoutChangeEvent, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar from "@/components/mobile-nav-bar";
import MobileScreenHeader from "@/components/mobile-screen-header";
import {
  RecordsContentTabRow,
  RecordsDiaryTab,
  RecordsErrorMessages,
  RecordsHistoryTab,
  RecordsLoadingState,
  RecordsLoginCard,
  RecordsMonthCalendarModal,
  RecordsNowTab,
  RecordsProfileCard,
  RecordsSavedExpressionsTab
} from "@/components/records/records-sections";
import { HistorySessionDetailModal } from "@/components/records/records-detail-modal";
import {
  type RecordsContentTab,
  INITIAL_VISIBLE_DATE_GROUPS,
  HISTORY_PAGE_SIZE,
  getLatestAttempt,
  getLatestSessionTimestamp,
  formatHistoryDateKey,
  parseHistoryDateKeyAsDate,
  getCalendarMonthStart,
  isSameCalendarMonth,
  buildRecordsMonthCalendar,
  normalizeRecordsContentTab,
  buildNowEnglishRecordGroups,
  normalizeSavedExpressionTag,
  formatSavedExpressionTagLabel,
  getVisibleSavedExpressionTags,
  normalizeSavedExpressionSearchQuery,
  isEligibleTagPracticeExpression,
  buildSavedExpressionSearchText,
  collectTagPracticeExpressions,
  trimSavedExpressionLookupValue,
  resolveSavedExpressionPracticeTarget,
  buildHistoryFeedbackState
} from "@/components/records/records-helpers";
import { styles } from "@/components/records/records-styles";
import {
  deleteSavedExpression,
  getAnswerHistory,
  getSavedExpressions,
  getTodayWritingStatus
} from "@/lib/api";
import { savePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import { getNowInEnglishSummary, type NowInEnglishEntry } from "@/lib/now-in-english";
import type { HistorySession, SavedExpression, TodayWritingStatus } from "@/lib/types";

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
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
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
        getAnswerHistory({ limit: HISTORY_PAGE_SIZE }),
        getTodayWritingStatus().catch(() => null)
      ]);
      setHistory(historyResponse);
      setHasMoreHistory(historyResponse.length >= HISTORY_PAGE_SIZE);
      setTodayStatus(status);
    } catch (caughtError) {
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "작문 기록을 불러오지 못했어요."
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const oldestCreatedAt = history.reduce<string | null>(
    (oldest, session) => (!oldest || session.createdAt < oldest ? session.createdAt : oldest),
    null
  );

  const loadMoreHistory = useCallback(async () => {
    if (!oldestCreatedAt || isLoadingMoreHistory) {
      return;
    }
    try {
      setIsLoadingMoreHistory(true);
      const nextPage = await getAnswerHistory({ limit: HISTORY_PAGE_SIZE, before: oldestCreatedAt });
      setHistory((current) => {
        const knownIds = new Set(current.map((session) => session.sessionId));
        return [...current, ...nextPage.filter((session) => !knownIds.has(session.sessionId))];
      });
      setHasMoreHistory(nextPage.length >= HISTORY_PAGE_SIZE);
      setShowAllDateGroups(true);
    } catch (caughtError) {
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "이전 기록을 불러오지 못했어요."
      );
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }, [isLoadingMoreHistory, oldestCreatedAt]);

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
  }

  function handleCloseSessionModal() {
    setSelectedSession(null);
  }

  function handleResumeSession(session: HistorySession) {
    const latestAttempt = getLatestAttempt(session);
    if (!latestAttempt?.visibleFeedback || session.status === "COMPLETED") {
      return;
    }

    const nextState = buildHistoryFeedbackState(session, latestAttempt);
    savePracticeFeedbackState(nextState);
    setSelectedSession(null);
    router.push({
      pathname: "/practice/feedback",
      params: {
        difficulty: session.difficulty,
        promptId: session.promptId
      }
    });
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
      <RecordsLoadingState />
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
              <RecordsLoginCard />
            ) : (
              <>
                <RecordsProfileCard
                  currentUser={currentUser}
                  history={history}
                  todayStatus={todayStatus}
                />

                <RecordsContentTabRow
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />

                {activeTab === "history" ? (
                <RecordsHistoryTab
                  groupedHistoryEntries={groupedHistoryEntries}
                  handleDateGroupLayout={handleDateGroupLayout}
                  handleOpenCalendar={handleOpenCalendar}
                  handleOpenSession={handleOpenSession}
                  hasMoreHistory={hasMoreHistory}
                  hiddenDateGroupCount={hiddenDateGroupCount}
                  history={history}
                  isHistoryLoading={isHistoryLoading}
                  isLoadingMoreHistory={isLoadingMoreHistory}
                  loadMoreHistory={loadMoreHistory}
                  openDates={openDates}
                  setOpenDates={setOpenDates}
                  setShowAllDateGroups={setShowAllDateGroups}
                  showAllDateGroups={showAllDateGroups}
                  todayStatus={todayStatus}
                  visibleGroupedHistoryEntries={visibleGroupedHistoryEntries}
                />
                ) : activeTab === "diary" ? (
                  <RecordsDiaryTab />
                ) : activeTab === "now" ? (
                  <RecordsNowTab
                    isNowEnglishLoading={isNowEnglishLoading}
                    nowEnglishEntries={nowEnglishEntries}
                    nowEnglishRecordGroups={nowEnglishRecordGroups}
                  />
                ) : (
                  <RecordsSavedExpressionsTab
                    deletingSavedExpressionId={deletingSavedExpressionId}
                    findHistorySessionForSavedExpression={findHistorySessionForSavedExpression}
                    handleDeleteSavedExpression={handleDeleteSavedExpression}
                    handleOpenSavedExpressionHistory={handleOpenSavedExpressionHistory}
                    handlePracticeSavedExpression={handlePracticeSavedExpression}
                    handlePracticeSelectedSavedExpressionTag={handlePracticeSelectedSavedExpressionTag}
                    handleResetSavedExpressionControls={handleResetSavedExpressionControls}
                    handleSelectSavedExpressionTag={handleSelectSavedExpressionTag}
                    isSavedExpressionsLoading={isSavedExpressionsLoading}
                    normalizedSavedExpressionSearch={normalizedSavedExpressionSearch}
                    openSavedExpressionPrompts={openSavedExpressionPrompts}
                    savedExpressionSearchQuery={savedExpressionSearchQuery}
                    savedExpressionSectionMeta={savedExpressionSectionMeta}
                    savedExpressionTagOptions={savedExpressionTagOptions}
                    savedExpressions={savedExpressions}
                    selectedSavedExpressionTag={selectedSavedExpressionTag}
                    selectedSavedExpressionTagLabel={selectedSavedExpressionTagLabel}
                    selectedTagPracticeCandidate={selectedTagPracticeCandidate}
                    setSavedExpressionSearchQuery={setSavedExpressionSearchQuery}
                    toggleSavedExpressionPrompt={toggleSavedExpressionPrompt}
                    visibleSavedExpressions={visibleSavedExpressions}
                  />
                )}

                <RecordsErrorMessages
                  activeTab={activeTab}
                  historyError={historyError}
                  nowEnglishError={nowEnglishError}
                  savedExpressionError={savedExpressionError}
                />
              </>
            )}
          </ScrollView>

          <MobileNavBar activeTab="records" />
        </View>
      </SafeAreaView>

      <HistorySessionDetailModal
        onClose={handleCloseSessionModal}
        onResume={handleResumeSession}
        session={selectedSession}
      />

      <RecordsMonthCalendarModal
        canGoToNextCalendarMonth={canGoToNextCalendarMonth}
        canGoToPreviousCalendarMonth={canGoToPreviousCalendarMonth}
        handleCloseCalendar={handleCloseCalendar}
        handleSelectCalendarDate={handleSelectCalendarDate}
        isCalendarOpen={isCalendarOpen}
        monthCalendar={monthCalendar}
        setCalendarMonthCursor={setCalendarMonthCursor}
      />
    </>
  );
}
