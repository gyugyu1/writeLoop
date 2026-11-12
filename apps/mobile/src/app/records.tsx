import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
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
  getLatestAttempt,
  getLatestSessionTimestamp,
  formatHistoryDateKey,
  normalizeRecordsContentTab,
  getVisibleSavedExpressionTags,
  isEligibleTagPracticeExpression,
  collectTagPracticeExpressions,
  trimSavedExpressionLookupValue,
  resolveSavedExpressionPracticeTarget,
  buildHistoryFeedbackState
} from "@/components/records/records-helpers";
import { styles } from "@/components/records/records-styles";
import { useNowEnglishRecords } from "@/components/records/use-now-english-records";
import { useRecordsData } from "@/components/records/use-records-data";
import { useRecordsDateScroll } from "@/components/records/use-records-date-scroll";
import { useRecordsMonthCalendar } from "@/components/records/use-records-month-calendar";
import { useSavedExpressionFilters } from "@/components/records/use-saved-expression-filters";
import { deleteSavedExpression } from "@/lib/api";
import { savePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { HistorySession, SavedExpression } from "@/lib/types";

export default function RecordsScreen() {
  const params = useLocalSearchParams<{ date?: string; tab?: string }>();
  const requestedDateKey = typeof params.date === "string" ? params.date : "";
  const requestedTab = normalizeRecordsContentTab(params.tab);
  const highlightedDateKey = /^\d{4}-\d{2}-\d{2}$/.test(requestedDateKey) ? requestedDateKey : "";
  const { currentUser, isHydrating, refreshSession } = useSession();
  const [activeTab, setActiveTab] = useState<RecordsContentTab>(requestedTab);
  const [deletingSavedExpressionIds, setDeletingSavedExpressionIds] = useState<Record<number, boolean>>({});
  const [savedExpressionSearchQuery, setSavedExpressionSearchQuery] = useState("");
  const [selectedSavedExpressionTag, setSelectedSavedExpressionTag] = useState<string | null>(null);
  const [selectedSavedExpressionTagAnchorId, setSelectedSavedExpressionTagAnchorId] = useState<number | null>(
    null
  );
  const [openSavedExpressionPrompts, setOpenSavedExpressionPrompts] = useState<Record<number, boolean>>(
    {}
  );
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [showAllDateGroups, setShowAllDateGroups] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(highlightedDateKey);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const {
    isNowEnglishLoading,
    loadNowEnglishRecords,
    nowEnglishEntries,
    nowEnglishError,
    nowEnglishRecordGroups
  } = useNowEnglishRecords(currentUser?.id ?? null);

  const {
    handleRefresh,
    hasMoreHistory,
    history,
    historyError,
    isHistoryLoading,
    isLoadingMoreHistory,
    isRefreshing,
    isSavedExpressionsLoading,
    loadMoreHistory,
    savedExpressionError,
    savedExpressions,
    setSavedExpressions,
    todayStatus
  } = useRecordsData({
    currentUser,
    loadNowEnglishRecords,
    refreshSession,
    setSavedExpressionSearchQuery,
    setSelectedSavedExpressionTag,
    setSelectedSavedExpressionTagAnchorId,
    setSelectedSession,
    setShowAllDateGroups
  });

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
  const {
    canGoToNextCalendarMonth,
    canGoToPreviousCalendarMonth,
    handleCloseCalendar,
    handleOpenCalendar,
    handleSelectCalendarDate,
    isCalendarOpen,
    monthCalendar,
    setCalendarMonthCursor
  } = useRecordsMonthCalendar({
    groupedHistoryEntries,
    selectedDateKey,
    setOpenDates,
    setSelectedDateKey
  });

  useEffect(() => {
    setSelectedDateKey(highlightedDateKey);
  }, [highlightedDateKey]);

  const {
    handleResetSavedExpressionControls,
    handleSelectSavedExpressionTag,
    normalizedSavedExpressionSearch,
    savedExpressionSectionMeta,
    savedExpressionTagOptions,
    selectedSavedExpressionTagLabel,
    visibleSavedExpressions
  } = useSavedExpressionFilters({
    savedExpressionSearchQuery,
    savedExpressions,
    selectedSavedExpressionTag,
    setSavedExpressionSearchQuery,
    setSelectedSavedExpressionTag,
    setSelectedSavedExpressionTagAnchorId
  });

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

  const {
    handleDateFeedLayout,
    handleDateGroupLayout,
    handleHistoryBoardLayout,
    scrollViewRef
  } = useRecordsDateScroll({
    groupedHistoryEntries,
    openDates,
    selectedDateKey
  });

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
      setDeletingSavedExpressionIds((current) => ({ ...current, [savedExpressionId]: true }));
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
      setDeletingSavedExpressionIds((current) => {
        const next = { ...current };
        delete next[savedExpressionId];
        return next;
      });
    }
  }

  function toggleSavedExpressionPrompt(savedExpressionId: number) {
    setOpenSavedExpressionPrompts((current) => ({
      ...current,
      [savedExpressionId]: !current[savedExpressionId]
    }));
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
                  handleDateFeedLayout={handleDateFeedLayout}
                  handleDateGroupLayout={handleDateGroupLayout}
                  handleHistoryBoardLayout={handleHistoryBoardLayout}
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
                    deletingSavedExpressionIds={deletingSavedExpressionIds}
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
