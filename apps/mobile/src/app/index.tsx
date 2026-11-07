import { useFocusEffect } from "@react-navigation/native";
import { Redirect, router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import HomeFeatureTutorial from "@/components/home-feature-tutorial";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import LobbySheet from "@/components/home/lobby-sheet";
import {
  DifficultySectionContent,
  FeaturedRecommendationContent,
  HomeDiarySectionContent,
  HomeLoadingState,
  HomeStatusPanel,
  MonthCalendarModal,
  NowInEnglishSectionContent
} from "@/components/home/home-sections";
import type { LobbyProjection } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type LobbyMenuId } from "@/components/lobby3d/lobby3d-screen";
import type { MarkId } from "@/lib/lobby3d/engine";
import { styles } from "@/components/home/home-styles";
import {
  type HomeDiaryCalendarCell,
  toDateKey,
  parseDateKey,
  getMonthStart,
  isSameMonth,
  formatDiaryMonthLabel,
  calculateDiaryStreakDays,
  buildHomeDiaryMonthCalendar,
  buildWeekChips
} from "@/components/home/home-helpers";
import { useHomeData } from "@/components/home/use-home-data";
import { useHomeMonthCalendar } from "@/components/home/use-home-month-calendar";
import { useLobbyTutorial } from "@/components/home/use-lobby-tutorial";
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    diaryCalendarError,
    diaryCalendarSummary,
    featuredRecommendation,
    featuredRecommendationDifficulty,
    featuredRecommendationError,
    featuredRecommendationItem,
    featuredRecommendationPrompt,
    incompleteLoop,
    isDiaryCalendarLoading,
    isFeaturedRecommendationLoading,
    isFeaturedRecommendationTranslationVisible,
    isInitialHomeLoadComplete,
    nowInEnglishSummary,
    setIsFeaturedRecommendationTranslationVisible,
    statusError,
    todayStatus
  } = useHomeData({
    currentUser,
    refreshSession
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // 로비 위로 올라오는 판(질문·일기·생각). 한 번에 하나만 연다.
  const [openSheet, setOpenSheet] = useState<LobbyMenuId | null>(null);
  // 다른 화면이 홈 위에 있는 동안은 3D를 멈추고 판도 숨긴다(iOS에서 판이 새 화면을 덮지 않게).
  // 판은 닫지 않아서, 돌아오면 보던 판이 그대로 있다.
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );
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

  // 로비 안내가 장소를 짚으려면 3D가 보낸 장소 좌표가 있어야 한다. 좌표는 초당 15번쯤 오므로, 안내를 띄울 때만 화면 상태로 둔다.
  const latestProjectionRef = useRef<LobbyProjection | null>(null);
  const tutorialVisibleRef = useRef(false);
  const [tutorialProjection, setTutorialProjection] = useState<LobbyProjection | null>(null);
  const handleProjection = useCallback((projection: LobbyProjection) => {
    latestProjectionRef.current = projection;
    if (tutorialVisibleRef.current) setTutorialProjection(projection);
  }, []);

  const {
    handleAdvanceHomeTutorial,
    handleCloseHomeTutorial,
    homeTutorialSpotlight,
    homeTutorialStepIndex,
    isHomeTutorialPositioning,
    isHomeTutorialVisible
  } = useLobbyTutorial({
    appUpdateNoticePhase,
    currentUser,
    isFeaturedRecommendationLoading,
    isInitialHomeLoadComplete,
    isOverlayOpen: isCalendarOpen || openSheet !== null,
    projection: tutorialProjection,
    windowHeight,
    windowWidth
  });

  useEffect(() => {
    tutorialVisibleRef.current = isHomeTutorialVisible;
    if (isHomeTutorialVisible) setTutorialProjection(latestProjectionRef.current);
  }, [isHomeTutorialVisible]);

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

  // 내비게이션 바는 화면 아래에 떠 있다. 로비 메뉴는 그 위로 올린다(내비게이션 바의 아래 여백 계산과 같게).
  const lobbyBottomInset = MOBILE_NAV_BOTTOM_SPACING + Math.max(insets.bottom - 24, 0);
  const streakChipLabel = displayedStreakDays > 0 ? `연속 ${displayedStreakDays}일` : "작문 대기 중";
  const closeSheet = () => setOpenSheet(null);
  // 장소에 도착해 말풍선 버튼을 누르면 그 장소의 판을 연다. 문(밖으로)은 처리하지 않아 로비의 안내가 뜬다.
  const sheetForMark: Partial<Record<MarkId, LobbyMenuId>> = { board: "question", desk: "diary", window: "thought" };
  const handleEnterMark = (mark: MarkId) => {
    const sheet = sheetForMark[mark];
    if (!sheet) return false;
    setOpenSheet(sheet);
    return true;
  };

  return (
    <View style={styles.lobbyScreen}>
      <View style={styles.lobbyArea}>
        <Lobby3dScreen
          devPanel={false}
          // 개발하는 동안 홈에서도 초당 프레임을 본다(2026-11-07 사용자 결정). 출시 빌드에서는 보이지 않는다.
          showFps={__DEV__}
          streakLabel={streakChipLabel}
          onStreakPress={() => router.push(historyRoute)}
          onMenu={setOpenSheet}
          onEnterMark={handleEnterMark}
          idleButton={incompleteLoopRoute ? { label: "이어 쓰기", onPress: handleResumeLoop } : null}
          inputBlocked={openSheet !== null || isCalendarOpen}
          onProjection={handleProjection}
          bottomInset={lobbyBottomInset}
          paused={!isFocused}
        />
      </View>
      <MobileNavBar activeTab="home" />

      <LobbySheet visible={isFocused && openSheet === "question"} title="질문에 답하기" onClose={closeSheet}>
        <HomeStatusPanel
          diaryStreakBadgeLabel={diaryStreakBadgeLabel}
          handleOpenCalendar={handleOpenCalendar}
          handleResumeLoop={handleResumeLoop}
          historyRoute={historyRoute}
          homeStatusMascot={homeStatusMascot}
          incompleteLoop={null}
          incompleteLoopCopy={null}
          incompleteLoopInlineNote=""
          statusError={statusError}
          statusMetaLines={statusMetaLines}
          weekChips={weekChips}
          writingStreakBadgeLabel={writingStreakBadgeLabel}
        />
        <View style={styles.featuredRecommendationSection}>
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
        <View style={styles.difficultyTutorialSection}>
          <DifficultySectionContent handleStart={handleStart} />
        </View>
        {/* 판 안에서 여는 창이라 판 안에 둔다(판과 나란히 두면 iOS에서 겹쳐 열리지 않는다). */}
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
      </LobbySheet>

      <LobbySheet visible={isFocused && openSheet === "diary"} title="영어일기" onClose={closeSheet}>
        <View style={styles.statusBadgeRow}>
          <View style={[styles.statusBadge, styles.statusBadgeSecondary]}>
            <Text style={styles.statusBadgeText}>{diaryStreakBadgeLabel}</Text>
          </View>
        </View>
        <View style={styles.homeDiarySection}>
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
      </LobbySheet>

      <LobbySheet visible={isFocused && openSheet === "thought"} title="지금 생각나는대로" onClose={closeSheet}>
        <View style={styles.nowEnglishSection}>
          <NowInEnglishSectionContent
            handleOpenNowInEnglish={handleOpenNowInEnglish}
            handleOpenNowInEnglishRecords={handleOpenNowInEnglishRecords}
            handleOpenNowInEnglishReminder={handleOpenNowInEnglishReminder}
            nowInEnglishReminderEnabled={nowInEnglishReminderEnabled}
            nowInEnglishTodayCount={nowInEnglishTodayCount}
          />
        </View>
      </LobbySheet>

      <HomeFeatureTutorial
        visible={isHomeTutorialVisible}
        stepIndex={homeTutorialStepIndex}
        spotlight={homeTutorialSpotlight}
        isPositioning={isHomeTutorialPositioning}
        onNext={handleAdvanceHomeTutorial}
        onSkip={handleCloseHomeTutorial}
      />
    </View>
  );
}

