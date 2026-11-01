import { Redirect, router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HomeFeatureTutorial from "@/components/home-feature-tutorial";
import MobileNavBar from "@/components/mobile-nav-bar";
import {
  DifficultySectionContent,
  FeaturedRecommendationContent,
  HomeDiarySectionContent,
  HomeGuideModal,
  HomeLoadingState,
  HomeStatusPanel,
  HomeUtilityRow,
  MonthCalendarModal,
  NowInEnglishSectionContent,
  QuestionSectionHeader
} from "@/components/home/home-sections";
import { styles } from "@/components/home/home-styles";
import {
  type HomeDiaryCalendarCell,
  toDateKey,
  parseDateKey,
  getIncompleteLoopCopy,
  getIncompleteLoopInlineTitle,
  formatIncompleteLoopSavedAt,
  getMonthStart,
  isSameMonth,
  formatDiaryMonthLabel,
  calculateDiaryStreakDays,
  buildHomeDiaryMonthCalendar,
  buildWeekChips
} from "@/components/home/home-helpers";
import { useHomeData } from "@/components/home/use-home-data";
import { useHomeMonthCalendar } from "@/components/home/use-home-month-calendar";
import { useHomeTutorial } from "@/components/home/use-home-tutorial";
import { trackDailyPromptClick } from "@/lib/api";
import { getDifficultyMeta } from "@/lib/difficulty";
import { buildLoginHref } from "@/lib/login-redirect";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { useSession } from "@/lib/session";
import { getStreakMascotStage } from "@/lib/streak-mascot";
import type { DailyDifficulty, DiaryCalendarSummary } from "@/lib/types";

export default function HomeScreen() {
  const { currentUser, isHydrating, refreshSession } = useSession();
  const { appUpdateNoticePhase } = useAppOverlayStatus();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    diaryCalendarError,
    diaryCalendarSummary,
    featuredRecommendation,
    featuredRecommendationDifficulty,
    featuredRecommendationError,
    featuredRecommendationItem,
    featuredRecommendationPrompt,
    handleRefresh,
    incompleteLoop,
    isDiaryCalendarLoading,
    isFeaturedRecommendationLoading,
    isFeaturedRecommendationTranslationVisible,
    isInitialHomeLoadComplete,
    isRefreshing,
    nowInEnglishSummary,
    setIsFeaturedRecommendationTranslationVisible,
    statusError,
    todayStatus
  } = useHomeData({
    currentUser,
    refreshSession
  });
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [diaryMonthCursor, setDiaryMonthCursor] = useState(() => getMonthStart(new Date()));
  const historyRoute: Href = currentUser ? "/records" : buildLoginHref("/records");
  const diaryOverviewRoute: Href = currentUser ? "/diary" : buildLoginHref("/diary");
  const featuredDifficultyMeta = getDifficultyMeta(
    featuredRecommendation?.difficulty ?? featuredRecommendationDifficulty
  );

  const displayedStreakDays = Math.max(todayStatus?.streakDays ?? 0, todayStatus?.completed ? 1 : 0);
  const homeStatusMascot = useMemo(
    () => getStreakMascotStage(displayedStreakDays),
    [displayedStreakDays]
  );

  const weekChips = useMemo(() => buildWeekChips(todayStatus), [todayStatus]);
  const incompleteLoopCopy = useMemo(
    () => (incompleteLoop ? getIncompleteLoopCopy(incompleteLoop.step) : null),
    [incompleteLoop]
  );
  const incompleteLoopSavedAt = useMemo(
    () => (incompleteLoop ? formatIncompleteLoopSavedAt(incompleteLoop.updatedAt) : ""),
    [incompleteLoop]
  );
  const incompleteLoopInlineNote = useMemo(() => {
    if (!incompleteLoop) {
      return "";
    }

    return [getIncompleteLoopInlineTitle(incompleteLoop.step), incompleteLoopSavedAt]
      .filter(Boolean)
      .join(" · ");
  }, [incompleteLoop, incompleteLoopSavedAt]);
  const diaryTodayKey = useMemo(() => toDateKey(new Date()), []);
  const diaryDaysByDate = useMemo(() => {
    const grouped = new Map<string, DiaryCalendarSummary["days"][number]>();
    (diaryCalendarSummary?.days ?? []).forEach((day) => {
      grouped.set(day.date, day);
    });

    return grouped;
  }, [diaryCalendarSummary?.days]);
  const diaryEntryDateKeys = useMemo(() => new Set(diaryDaysByDate.keys()), [diaryDaysByDate]);
  const nowInEnglishDateKeys = useMemo(
    () => new Set((nowInEnglishSummary?.entries ?? []).map((entry) => entry.dateKey)),
    [nowInEnglishSummary?.entries]
  );
  const diaryStreakDays = useMemo(
    () => calculateDiaryStreakDays(diaryEntryDateKeys, diaryTodayKey),
    [diaryEntryDateKeys, diaryTodayKey]
  );
  const answerHistoryCount = todayStatus?.totalAnswerSessions ?? 0;
  const writingStreakBadgeLabel =
    displayedStreakDays > 0 ? `작문 ${displayedStreakDays}일 연속` : "작문 대기 중";
  const diaryStreakBadgeLabel =
    diaryStreakDays > 0 ? `일기 ${diaryStreakDays}일 연속` : "일기 대기 중";
  const statusMetaLines = [
    `총 ${answerHistoryCount.toLocaleString("ko-KR")}문항 작성 · 총 ${(diaryCalendarSummary?.totalEntries ?? 0).toLocaleString("ko-KR")}개의 일기 작성`,
    `총 ${(nowInEnglishSummary?.entries.length ?? 0).toLocaleString("ko-KR")}개의 영어조각`
  ];
  const todayDiaryEntry = diaryDaysByDate.get(diaryTodayKey) ?? null;
  const nowInEnglishTodayCount = nowInEnglishSummary?.todayCount ?? 0;
  const nowInEnglishReminderEnabled = nowInEnglishSummary?.settings.enabled ?? false;
  const homeDiaryCalendar = useMemo(
    () => buildHomeDiaryMonthCalendar(diaryMonthCursor, diaryEntryDateKeys, diaryTodayKey),
    [diaryEntryDateKeys, diaryMonthCursor, diaryTodayKey]
  );
  const diaryMonthLabel = useMemo(() => formatDiaryMonthLabel(diaryMonthCursor), [diaryMonthCursor]);
  const canGoToNextDiaryMonth = useMemo(
    () => !isSameMonth(diaryMonthCursor, getMonthStart(parseDateKey(diaryTodayKey))),
    [diaryMonthCursor, diaryTodayKey]
  );
  const incompleteLoopRoute = useMemo<Href | null>(() => {
    if (!incompleteLoop) {
      return null;
    }

    if (incompleteLoop.step === "feedback") {
      return {
        pathname: "/practice/feedback",
        params: {
          difficulty: incompleteLoop.difficulty,
          promptId: incompleteLoop.promptId
        }
      };
    }

    if (incompleteLoop.step === "rewrite") {
      return {
        pathname: "/practice/write",
        params: {
          difficulty: incompleteLoop.difficulty,
          promptId: incompleteLoop.promptId,
          mode: "rewrite",
          resume: "1"
        }
      };
    }

    return {
      pathname: "/practice/write",
      params: {
        difficulty: incompleteLoop.difficulty,
        promptId: incompleteLoop.promptId
      }
    };
  }, [incompleteLoop]);

  const {
    diaryTutorialSectionRef,
    difficultyTutorialSectionRef,
    featuredTutorialSectionRef,
    handleAdvanceHomeTutorial,
    handleCloseHomeTutorial,
    homeScrollOffsetRef,
    homeScrollRef,
    homeScrollViewportRef,
    homeTutorialSpotlight,
    homeTutorialStepIndex,
    isHomeTutorialPositioning,
    isHomeTutorialVisible,
    nowEnglishTutorialSectionRef
  } = useHomeTutorial({
    appUpdateNoticePhase,
    currentUser,
    isCalendarOpen,
    isFeaturedRecommendationLoading,
    isGuideOpen,
    isInitialHomeLoadComplete,
    windowHeight,
    windowWidth
  });

  const {
    calendarError,
    calendarFooterLabel,
    calendarSummaryText,
    canGoToNextCalendarMonth,
    handleChangeCalendarMonth,
    handleCloseCalendar,
    handleOpenCalendar,
    handleOpenCalendarDate,
    isCalendarLoading,
    monthCalendar
  } = useHomeMonthCalendar({
    currentUser,
    diaryDaysByDate,
    isCalendarOpen,
    setIsCalendarOpen,
    todayStatus
  });

  const handleStart = useCallback((difficulty: DailyDifficulty) => {
    router.push({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty
      }
    });
  }, []);

  const handleOpenNowInEnglish = useCallback(() => {
    router.push("/now" as Href);
  }, []);

  const handleOpenNowInEnglishReminder = useCallback(() => {
    router.push({
      pathname: "/now",
      params: { reminder: "open" }
    } as Href);
  }, []);

  const handleOpenNowInEnglishRecords = useCallback(() => {
    router.push({
      pathname: "/records",
      params: { tab: "now" }
    } as Href);
  }, []);

  const handleChangeDiaryMonth = useCallback((direction: -1 | 1) => {
    setDiaryMonthCursor((current) =>
      getMonthStart(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12))
    );
  }, []);

  const handleOpenDiaryDate = useCallback(
    (cell: HomeDiaryCalendarCell) => {
      if (cell.isFuture) {
        return;
      }

      if (!currentUser) {
        router.push(buildLoginHref("/diary"));
        return;
      }

      const diaryDay = diaryDaysByDate.get(cell.key);
      if (diaryDay) {
        router.push({
          pathname: "/diary/[entryId]",
          params: { entryId: diaryDay.entryId }
        } as Href);
        return;
      }

      if (cell.isToday) {
        router.push("/diary/write" as never);
      } else {
        router.push("/diary" as never);
      }
    },
    [currentUser, diaryDaysByDate]
  );

  const handleWriteTodayDiary = useCallback(() => {
    if (!currentUser) {
      router.push(buildLoginHref("/diary"));
      return;
    }

    if (todayDiaryEntry) {
      router.push({
        pathname: "/diary/[entryId]",
        params: { entryId: todayDiaryEntry.entryId }
      } as Href);
      return;
    }

    router.push("/diary/write" as never);
  }, [currentUser, todayDiaryEntry]);

  const handleResumeLoop = useCallback(() => {
    if (!incompleteLoopRoute) {
      return;
    }

    router.push(incompleteLoopRoute);
  }, [incompleteLoopRoute]);

  const handleStartFeaturedPrompt = useCallback(() => {
    if (!featuredRecommendationPrompt) {
      return;
    }

    void trackDailyPromptClick(featuredRecommendationPrompt.id).catch(() => undefined);
    router.push({
      pathname: "/practice/write",
      params: {
        difficulty: featuredRecommendation?.difficulty ?? featuredRecommendationDifficulty,
        promptId: featuredRecommendationPrompt.id
      }
    });
  }, [
    featuredRecommendation?.difficulty,
    featuredRecommendationDifficulty,
    featuredRecommendationPrompt
  ]);

  if (isHydrating) {
    return (
      <HomeLoadingState />
    );
  }

  if (!currentUser) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View ref={homeScrollViewportRef} collapsable={false} style={styles.homeScrollViewport}>
          <ScrollView
            ref={homeScrollRef}
            contentContainerStyle={styles.content}
            onScroll={(event) => {
              homeScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
          >
        <HomeUtilityRow />
        <HomeStatusPanel
          diaryStreakBadgeLabel={diaryStreakBadgeLabel}
          handleOpenCalendar={handleOpenCalendar}
          handleResumeLoop={handleResumeLoop}
          historyRoute={historyRoute}
          homeStatusMascot={homeStatusMascot}
          incompleteLoop={incompleteLoop}
          incompleteLoopCopy={incompleteLoopCopy}
          incompleteLoopInlineNote={incompleteLoopInlineNote}
          statusError={statusError}
          statusMetaLines={statusMetaLines}
          weekChips={weekChips}
          writingStreakBadgeLabel={writingStreakBadgeLabel}
        />

        <View
          ref={nowEnglishTutorialSectionRef}
          collapsable={false}
          style={styles.nowEnglishSection}
        >
          <NowInEnglishSectionContent
            handleOpenNowInEnglish={handleOpenNowInEnglish}
            handleOpenNowInEnglishRecords={handleOpenNowInEnglishRecords}
            handleOpenNowInEnglishReminder={handleOpenNowInEnglishReminder}
            nowInEnglishReminderEnabled={nowInEnglishReminderEnabled}
            nowInEnglishTodayCount={nowInEnglishTodayCount}
          />
        </View>

        <View style={styles.sectionDivider} />

        <QuestionSectionHeader
          setIsGuideOpen={setIsGuideOpen}
        />

        <View
          ref={featuredTutorialSectionRef}
          collapsable={false}
          style={styles.featuredRecommendationSection}
        >
          <FeaturedRecommendationContent
            featuredDifficultyMeta={featuredDifficultyMeta}
            featuredRecommendationError={featuredRecommendationError}
            featuredRecommendationItem={featuredRecommendationItem}
            featuredRecommendationPrompt={featuredRecommendationPrompt}
            handleStartFeaturedPrompt={handleStartFeaturedPrompt}
            isFeaturedRecommendationLoading={isFeaturedRecommendationLoading}
            isFeaturedRecommendationTranslationVisible={isFeaturedRecommendationTranslationVisible}
            setIsFeaturedRecommendationTranslationVisible={setIsFeaturedRecommendationTranslationVisible}
          />
        </View>

        <View
          ref={difficultyTutorialSectionRef}
          collapsable={false}
          style={styles.difficultyTutorialSection}
        >
          <DifficultySectionContent
            handleStart={handleStart}
          />
        </View>

        <View style={styles.sectionDivider} />

        <View
          ref={diaryTutorialSectionRef}
          collapsable={false}
          style={styles.homeDiarySection}
        >
          <HomeDiarySectionContent
            canGoToNextDiaryMonth={canGoToNextDiaryMonth}
            diaryCalendarError={diaryCalendarError}
            diaryMonthLabel={diaryMonthLabel}
            diaryOverviewRoute={diaryOverviewRoute}
            handleChangeDiaryMonth={handleChangeDiaryMonth}
            handleOpenDiaryDate={handleOpenDiaryDate}
            handleWriteTodayDiary={handleWriteTodayDiary}
            homeDiaryCalendar={homeDiaryCalendar}
            isDiaryCalendarLoading={isDiaryCalendarLoading}
            todayDiaryEntry={todayDiaryEntry}
          />
        </View>
          </ScrollView>
        </View>
        <MobileNavBar activeTab="home" />
      </View>

      <MonthCalendarModal
        calendarError={calendarError}
        calendarFooterLabel={calendarFooterLabel}
        calendarSummaryText={calendarSummaryText}
        canGoToNextCalendarMonth={canGoToNextCalendarMonth}
        diaryEntryDateKeys={diaryEntryDateKeys}
        handleChangeCalendarMonth={handleChangeCalendarMonth}
        handleCloseCalendar={handleCloseCalendar}
        handleOpenCalendarDate={handleOpenCalendarDate}
        isCalendarLoading={isCalendarLoading}
        isCalendarOpen={isCalendarOpen}
        monthCalendar={monthCalendar}
        nowInEnglishDateKeys={nowInEnglishDateKeys}
      />

      <HomeGuideModal
        isGuideOpen={isGuideOpen}
        setIsGuideOpen={setIsGuideOpen}
      />

      <HomeFeatureTutorial
        visible={isHomeTutorialVisible}
        stepIndex={homeTutorialStepIndex}
        spotlight={homeTutorialSpotlight}
        isPositioning={isHomeTutorialPositioning}
        onNext={handleAdvanceHomeTutorial}
        onSkip={handleCloseHomeTutorial}
      />
    </SafeAreaView>
  );
}

