import { Redirect, router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HomeFeatureTutorial, {
  HOME_TUTORIAL_STEP_COUNT,
  type HomeTutorialSpotlight
} from "@/components/home-feature-tutorial";
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
  parseStatusDate,
  getMonthStart,
  isSameMonth,
  buildFallbackCompletedDateKeys,
  buildMonthCalendar,
  formatDiaryMonthLabel,
  calculateDiaryStreakDays,
  buildHomeDiaryMonthCalendar,
  buildWeekChips
} from "@/components/home/home-helpers";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWritingDraft,
  trackDailyPromptClick
} from "@/lib/api";
import { getDifficultyMeta } from "@/lib/difficulty";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import { buildLoginHref } from "@/lib/login-redirect";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import {
  completeHomeTutorial,
  consumeHomeTutorialReplay,
  hasCompletedHomeTutorial
} from "@/lib/home-tutorial";
import { useSession } from "@/lib/session";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { getStreakMascotStage } from "@/lib/streak-mascot";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import type {
  DailyDifficulty,
  DiaryCalendarSummary,
  FeaturedDailyPromptRecommendation,
  TodayWritingStatus
} from "@/lib/types";

type MeasurableTutorialTarget = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

function measureTutorialTarget(target: MeasurableTutorialTarget | null) {
  return new Promise<HomeTutorialSpotlight | null>((resolve) => {
    if (!target) {
      resolve(null);
      return;
    }

    target.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }

      resolve({ x, y, width, height });
    });
  });
}

function waitForTutorialLayout(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export default function HomeScreen() {
  const { currentUser, isHydrating, refreshSession } = useSession();
  const { appUpdateNoticePhase } = useAppOverlayStatus();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [incompleteLoop, setIncompleteLoop] = useState<IncompleteLoopState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [featuredRecommendation, setFeaturedRecommendation] =
    useState<FeaturedDailyPromptRecommendation | null>(null);
  const [isFeaturedRecommendationLoading, setIsFeaturedRecommendationLoading] = useState(false);
  const [featuredRecommendationError, setFeaturedRecommendationError] = useState("");
  const [isFeaturedRecommendationTranslationVisible, setIsFeaturedRecommendationTranslationVisible] =
    useState(false);
  const [isResolvingIncompleteLoop, setIsResolvingIncompleteLoop] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getMonthStart(new Date()));
  const [calendarCompletedDateKeys, setCalendarCompletedDateKeys] = useState<string[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [diaryCalendarSummary, setDiaryCalendarSummary] = useState<DiaryCalendarSummary | null>(null);
  const [diaryMonthCursor, setDiaryMonthCursor] = useState(() => getMonthStart(new Date()));
  const [isDiaryCalendarLoading, setIsDiaryCalendarLoading] = useState(false);
  const [diaryCalendarError, setDiaryCalendarError] = useState("");
  const [nowInEnglishSummary, setNowInEnglishSummary] = useState<NowInEnglishSummary | null>(null);
  const [isInitialHomeLoadComplete, setIsInitialHomeLoadComplete] = useState(false);
  const [isHomeTutorialRequested, setIsHomeTutorialRequested] = useState(false);
  const [isHomeTutorialVisible, setIsHomeTutorialVisible] = useState(false);
  const [homeTutorialStepIndex, setHomeTutorialStepIndex] = useState(0);
  const [homeTutorialSpotlight, setHomeTutorialSpotlight] =
    useState<HomeTutorialSpotlight | null>(null);
  const [isHomeTutorialPositioning, setIsHomeTutorialPositioning] = useState(false);
  const featuredRecommendationRequestIdRef = useRef(0);
  const homeSnapshotRequestIdRef = useRef(0);
  const diaryCalendarLoadPromiseRef = useRef<Promise<void> | null>(null);
  const hasCompletedInitialHomeLoadRef = useRef(false);
  const homeScrollRef = useRef<ScrollView | null>(null);
  const homeScrollViewportRef = useRef<View | null>(null);
  const homeScrollOffsetRef = useRef(0);
  const nowEnglishTutorialSectionRef = useRef<View | null>(null);
  const featuredTutorialSectionRef = useRef<View | null>(null);
  const difficultyTutorialSectionRef = useRef<View | null>(null);
  const diaryTutorialSectionRef = useRef<View | null>(null);
  const tutorialPositionRequestIdRef = useRef(0);
  const historyRoute: Href = currentUser ? "/records" : buildLoginHref("/records");
  const diaryOverviewRoute: Href = currentUser ? "/diary" : buildLoginHref("/diary");
  const featuredRecommendationDifficulty = incompleteLoop?.difficulty ?? "I";
  const featuredRecommendationItem = featuredRecommendation?.featured ?? null;
  const featuredRecommendationPrompt = featuredRecommendationItem?.prompt ?? null;
  const featuredDifficultyMeta = getDifficultyMeta(
    featuredRecommendation?.difficulty ?? featuredRecommendationDifficulty
  );

  useEffect(() => {
    hasCompletedInitialHomeLoadRef.current = false;
    setIsInitialHomeLoadComplete(false);
  }, [currentUser?.id]);

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
  const calendarCompletedDateKeySet = useMemo(() => {
    const nextSet = buildFallbackCompletedDateKeys(todayStatus);
    calendarCompletedDateKeys.forEach((key) => nextSet.add(key));
    return nextSet;
  }, [calendarCompletedDateKeys, todayStatus]);
  const calendarReferenceMonth = useMemo(
    () => getMonthStart(parseStatusDate(todayStatus?.date)),
    [todayStatus?.date]
  );
  const monthCalendar = useMemo(
    () => buildMonthCalendar(todayStatus, calendarCompletedDateKeySet, calendarMonthCursor),
    [calendarCompletedDateKeySet, calendarMonthCursor, todayStatus]
  );
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
  const calendarFooterLabel = useMemo(() => {
    if (currentUser) {
      return `총 ${(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성`;
    }

    return "학습을 시작하면 달력에 기록이 쌓여요.";
  }, [currentUser, todayStatus?.totalWrittenSentences]);
  const calendarSummaryText = useMemo(() => {
    if (monthCalendar.isReferenceMonth && monthCalendar.streakDays > 1) {
      return `현재 ${monthCalendar.streakDays}일 연속 학습 중`;
    }

    if (monthCalendar.isReferenceMonth && todayStatus?.completed) {
      return "오늘도 학습 기록이 쌓였어요";
    }

    if (monthCalendar.completedCount > 0) {
      return `${monthCalendar.completedCount}일 기록이 있어요`;
    }

    return "기록이 없어요";
  }, [monthCalendar.completedCount, monthCalendar.isReferenceMonth, monthCalendar.streakDays, todayStatus?.completed]);
  const canGoToNextCalendarMonth = useMemo(
    () => !isSameMonth(calendarMonthCursor, calendarReferenceMonth),
    [calendarMonthCursor, calendarReferenceMonth]
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

  const loadTodayStatus = useCallback(async () => {
    try {
      setStatusError("");
      setTodayStatus(await getTodayWritingStatus());
    } catch (caughtError) {
      setStatusError(
        caughtError instanceof Error ? caughtError.message : "학습 일지를 불러오지 못했어요."
      );
    }
  }, []);

  const loadDiaryEntries = useCallback(async () => {
    if (!currentUser) {
      setDiaryCalendarSummary(null);
      setDiaryCalendarError("");
      setIsDiaryCalendarLoading(false);
      return;
    }

    if (diaryCalendarLoadPromiseRef.current) {
      await diaryCalendarLoadPromiseRef.current;
      return;
    }

    const loadPromise = (async () => {
      try {
        setIsDiaryCalendarLoading(true);
        setDiaryCalendarError("");
        setDiaryCalendarSummary(await getDiaryCalendarSummary());
      } catch (caughtError) {
        setDiaryCalendarError(
          caughtError instanceof Error ? caughtError.message : "영어일기 달력을 불러오지 못했어요."
        );
      } finally {
        setIsDiaryCalendarLoading(false);
      }
    })();

    diaryCalendarLoadPromiseRef.current = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (diaryCalendarLoadPromiseRef.current === loadPromise) {
        diaryCalendarLoadPromiseRef.current = null;
      }
    }
  }, [currentUser]);

  const loadNowInEnglishSummary = useCallback(async () => {
    setNowInEnglishSummary(await getNowInEnglishSummary());
  }, []);

  const loadFeaturedRecommendation = useCallback(
    async (difficulty: DailyDifficulty = featuredRecommendationDifficulty) => {
      if (!currentUser) {
        setFeaturedRecommendation(null);
        setFeaturedRecommendationError("");
        setIsFeaturedRecommendationLoading(false);
        return;
      }

      if (isResolvingIncompleteLoop) {
        return;
      }

      const requestId = featuredRecommendationRequestIdRef.current + 1;
      featuredRecommendationRequestIdRef.current = requestId;

      try {
        setIsFeaturedRecommendationLoading(true);
        setFeaturedRecommendationError("");
        const nextRecommendation = await getFeaturedDailyPrompt(difficulty);
        if (featuredRecommendationRequestIdRef.current !== requestId) {
          return;
        }
        setFeaturedRecommendation(nextRecommendation);
      } catch (caughtError) {
        if (featuredRecommendationRequestIdRef.current !== requestId) {
          return;
        }
        setFeaturedRecommendation(null);
        setFeaturedRecommendationError(
          caughtError instanceof Error ? caughtError.message : "오늘의 추천 질문을 불러오지 못했어요."
        );
      } finally {
        if (featuredRecommendationRequestIdRef.current === requestId) {
          setIsFeaturedRecommendationLoading(false);
        }
      }
    },
    [currentUser, featuredRecommendationDifficulty, isResolvingIncompleteLoop]
  );

  const loadHomeSnapshot = useCallback(
    async (difficulty: DailyDifficulty = featuredRecommendationDifficulty) => {
      if (!currentUser) {
        setTodayStatus(null);
        setStatusError("");
        setFeaturedRecommendation(null);
        setFeaturedRecommendationError("");
        setDiaryCalendarSummary(null);
        setDiaryCalendarError("");
        setIsFeaturedRecommendationLoading(false);
        setIsDiaryCalendarLoading(false);
        hasCompletedInitialHomeLoadRef.current = false;
        setIsInitialHomeLoadComplete(false);
        return;
      }

      if (isResolvingIncompleteLoop) {
        return;
      }

      const requestId = homeSnapshotRequestIdRef.current + 1;
      homeSnapshotRequestIdRef.current = requestId;

      try {
        setStatusError("");
        setDiaryCalendarError("");
        setFeaturedRecommendationError("");
        setIsDiaryCalendarLoading(true);
        setIsFeaturedRecommendationLoading(true);

        const snapshot = await getMobileHomeSnapshot(difficulty);
        if (homeSnapshotRequestIdRef.current !== requestId) {
          return;
        }

        setTodayStatus(snapshot.todayStatus ?? null);
        setDiaryCalendarSummary(snapshot.diaryCalendarSummary ?? null);
        setFeaturedRecommendation(snapshot.featuredRecommendation ?? null);
      } catch {
        if (homeSnapshotRequestIdRef.current !== requestId) {
          return;
        }

        await Promise.allSettled([
          loadTodayStatus(),
          loadDiaryEntries(),
          loadFeaturedRecommendation(difficulty)
        ]);
      } finally {
        if (homeSnapshotRequestIdRef.current === requestId) {
          setIsDiaryCalendarLoading(false);
          setIsFeaturedRecommendationLoading(false);
          hasCompletedInitialHomeLoadRef.current = true;
          setIsInitialHomeLoadComplete(true);
        }
      }
    },
    [
      currentUser,
      featuredRecommendationDifficulty,
      isResolvingIncompleteLoop,
      loadDiaryEntries,
      loadFeaturedRecommendation,
      loadTodayStatus
    ]
  );

  useEffect(() => {
    if (!currentUser) {
      hasCompletedInitialHomeLoadRef.current = false;
      setIsInitialHomeLoadComplete(false);
      setTodayStatus(null);
      setStatusError("");
      setFeaturedRecommendation(null);
      setFeaturedRecommendationError("");
      setDiaryCalendarSummary(null);
      setDiaryCalendarError("");
      return;
    }

    if (isResolvingIncompleteLoop) {
      return;
    }

    void loadHomeSnapshot(featuredRecommendationDifficulty);
  }, [
    currentUser,
    featuredRecommendationDifficulty,
    isResolvingIncompleteLoop,
    loadHomeSnapshot
  ]);

  useEffect(() => {
    setIsFeaturedRecommendationTranslationVisible(false);
  }, [featuredRecommendationPrompt?.id]);

  useEffect(() => {
    void loadNowInEnglishSummary();
  }, [loadNowInEnglishSummary]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsResolvingIncompleteLoop(true);

      const loadIncompleteLoop = async () => {
        try {
          const nextLoop = await getIncompleteLoop();
          if (!nextLoop) {
            if (!cancelled) {
              setIncompleteLoop(null);
            }
            return;
          }

          if (nextLoop.step === "feedback") {
            const feedbackState = await hydratePracticeFeedbackState(nextLoop.difficulty, nextLoop.promptId);
            if (!feedbackState) {
              await clearIncompleteLoop();
              if (!cancelled) {
                setIncompleteLoop(null);
              }
              return;
            }
          } else {
            const draftType = nextLoop.draftType ?? (nextLoop.step === "rewrite" ? "REWRITE" : "ANSWER");
            const localDraft = await getLocalWritingDraft(nextLoop.promptId, draftType);

            if (currentUser) {
              try {
                const serverDraft = await getWritingDraft(nextLoop.promptId, draftType);
                if (!localDraft && !serverDraft) {
                  await clearIncompleteLoop();
                  if (!cancelled) {
                    setIncompleteLoop(null);
                  }
                  return;
                }
              } catch {
                // Keep the card when the server check fails temporarily.
              }
            } else if (!localDraft) {
              await clearIncompleteLoop();
              if (!cancelled) {
                setIncompleteLoop(null);
              }
              return;
            }
          }

          if (!cancelled) {
            setIncompleteLoop(nextLoop);
          }
        } finally {
          if (!cancelled) {
            setIsResolvingIncompleteLoop(false);
          }
        }
      };

      void loadIncompleteLoop();

      return () => {
        cancelled = true;
      };
    }, [currentUser])
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasCompletedInitialHomeLoadRef.current) {
        return;
      }

      void loadDiaryEntries();
      void loadNowInEnglishSummary();
    }, [loadDiaryEntries, loadNowInEnglishSummary])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) {
        return;
      }

      let cancelled = false;
      const resolveTutorialRequest = async () => {
        try {
          const shouldReplay = await consumeHomeTutorialReplay();
          const hasCompleted = shouldReplay ? true : await hasCompletedHomeTutorial();
          if (!cancelled && (shouldReplay || !hasCompleted)) {
            setIsHomeTutorialRequested(true);
          }
        } catch {
          // 저장소를 읽지 못해도 홈 진입 자체는 막지 않습니다.
        }
      };

      void resolveTutorialRequest();

      return () => {
        cancelled = true;
      };
    }, [currentUser])
  );

  const positionHomeTutorialStep = useCallback(
    async (stepIndex: number, animated: boolean) => {
      const requestId = tutorialPositionRequestIdRef.current + 1;
      tutorialPositionRequestIdRef.current = requestId;
      setIsHomeTutorialPositioning(true);
      setHomeTutorialSpotlight(null);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const target =
          stepIndex === 0
            ? nowEnglishTutorialSectionRef.current
            : stepIndex === 1
              ? featuredTutorialSectionRef.current
              : stepIndex === 2
                ? difficultyTutorialSectionRef.current
                : diaryTutorialSectionRef.current;
        const [scrollRect, targetRect] = await Promise.all([
          measureTutorialTarget(homeScrollViewportRef.current),
          measureTutorialTarget(target)
        ]);

        if (tutorialPositionRequestIdRef.current !== requestId) {
          return;
        }

        if (!scrollRect || !targetRect) {
          await waitForTutorialLayout(100);
          continue;
        }

        const targetTopInContent =
          homeScrollOffsetRef.current + targetRect.y - scrollRect.y;
        const desiredTopInset = Math.max(18, Math.min(64, windowHeight * 0.06));
        homeScrollRef.current?.scrollTo({
          y: Math.max(0, targetTopInContent - desiredTopInset),
          animated
        });

        await waitForTutorialLayout(animated ? 520 : 120);
        const measuredTarget = await measureTutorialTarget(target);
        if (tutorialPositionRequestIdRef.current !== requestId) {
          return;
        }
        if (!measuredTarget) {
          continue;
        }

        const horizontalPadding = 7;
        const topPadding = 7;
        const bottomPadding = 16;
        const edgeMargin = 8;
        const left = Math.max(edgeMargin, measuredTarget.x - horizontalPadding);
        const top = Math.max(edgeMargin, measuredTarget.y - topPadding);
        const right = Math.min(
          windowWidth - edgeMargin,
          measuredTarget.x + measuredTarget.width + horizontalPadding
        );
        const bottom = Math.min(
          windowHeight - edgeMargin,
          measuredTarget.y + measuredTarget.height + bottomPadding
        );

        setHomeTutorialSpotlight({
          x: left,
          y: top,
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top)
        });
        setIsHomeTutorialPositioning(false);
        return;
      }

      if (tutorialPositionRequestIdRef.current === requestId) {
        setIsHomeTutorialPositioning(false);
        setIsHomeTutorialVisible(false);
        setIsHomeTutorialRequested(false);
      }
    }, [windowHeight, windowWidth]
  );

  useEffect(() => {
    if (
      !isHomeTutorialRequested ||
      isHomeTutorialVisible ||
      !isInitialHomeLoadComplete ||
      isFeaturedRecommendationLoading ||
      appUpdateNoticePhase !== "settled" ||
      isCalendarOpen ||
      isGuideOpen
    ) {
      return;
    }

    const timerId = setTimeout(() => {
      setHomeTutorialStepIndex(0);
      setIsHomeTutorialVisible(true);
      void positionHomeTutorialStep(0, false);
    }, 180);

    return () => {
      clearTimeout(timerId);
    };
  }, [
    appUpdateNoticePhase,
    isCalendarOpen,
    isFeaturedRecommendationLoading,
    isGuideOpen,
    isHomeTutorialRequested,
    isHomeTutorialVisible,
    isInitialHomeLoadComplete,
    positionHomeTutorialStep
  ]);

  useEffect(
    () => () => {
      tutorialPositionRequestIdRef.current += 1;
    },
    []
  );

  const handleCloseHomeTutorial = useCallback(() => {
    tutorialPositionRequestIdRef.current += 1;
    setIsHomeTutorialVisible(false);
    setIsHomeTutorialRequested(false);
    setIsHomeTutorialPositioning(false);
    setHomeTutorialSpotlight(null);
    void completeHomeTutorial().catch(() => undefined);
  }, []);

  const handleAdvanceHomeTutorial = useCallback(() => {
    if (homeTutorialStepIndex >= HOME_TUTORIAL_STEP_COUNT - 1) {
      handleCloseHomeTutorial();
      return;
    }

    const nextStepIndex = homeTutorialStepIndex + 1;
    setHomeTutorialStepIndex(nextStepIndex);
    void positionHomeTutorialStep(nextStepIndex, true);
  }, [handleCloseHomeTutorial, homeTutorialStepIndex, positionHomeTutorialStep]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const user = await refreshSession();
    await loadNowInEnglishSummary();
    if (user) {
      await loadHomeSnapshot();
    } else {
      setTodayStatus(null);
      setStatusError("");
      setFeaturedRecommendation(null);
      setFeaturedRecommendationError("");
      setDiaryCalendarSummary(null);
      setDiaryCalendarError("");
    }
    setIsRefreshing(false);
  }, [
    loadNowInEnglishSummary,
    loadHomeSnapshot,
    refreshSession
  ]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    if (!currentUser) {
      setCalendarCompletedDateKeys([]);
      setCalendarError("");
      setIsCalendarLoading(false);
      return;
    }

    let cancelled = false;

    const loadCalendarStatus = async () => {
      try {
        setIsCalendarLoading(true);
        setCalendarError("");
        const monthStatus = await getMonthWritingStatus(
          calendarMonthCursor.getFullYear(),
          calendarMonthCursor.getMonth() + 1
        );
        if (cancelled) {
          return;
        }

        const nextKeys = (monthStatus?.days ?? [])
          .filter((day) => day.completed)
          .map((day) => day.date);
        setCalendarCompletedDateKeys(nextKeys);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setCalendarError(caughtError instanceof Error ? caughtError.message : "달력을 불러오지 못했어요.");
      } finally {
        if (!cancelled) {
          setIsCalendarLoading(false);
        }
      }
    };

    void loadCalendarStatus();

    return () => {
      cancelled = true;
    };
  }, [calendarMonthCursor, currentUser, isCalendarOpen]);

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

  const handleOpenCalendar = useCallback(() => {
    setCalendarMonthCursor(calendarReferenceMonth);
    setIsCalendarOpen(true);
  }, [calendarReferenceMonth]);

  const handleCloseCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, []);

  const handleChangeCalendarMonth = useCallback((direction: -1 | 1) => {
    setCalendarMonthCursor((current) => getMonthStart(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)));
  }, []);

  const handleOpenCalendarDate = useCallback(
    (dateKey: string, hasWritingActivity: boolean, hasDiaryActivity: boolean, hasNowInEnglishActivity: boolean) => {
      setIsCalendarOpen(false);
      if (currentUser && hasDiaryActivity && !hasWritingActivity && !hasNowInEnglishActivity) {
        const diaryDay = diaryDaysByDate.get(dateKey);
        if (diaryDay) {
          router.push({
            pathname: "/diary/[entryId]",
            params: { entryId: diaryDay.entryId }
          } as Href);
          return;
        }
      }

      if (hasNowInEnglishActivity && !hasWritingActivity) {
        router.push({
          pathname: "/records",
          params: { tab: "now" }
        } as Href);
        return;
      }

      const nextHref: Href = currentUser
        ? ({
            pathname: "/records",
            params: {
              date: dateKey
            }
          } as Href)
        : buildLoginHref(`/records?date=${dateKey}`);
      router.push(nextHref);
    },
    [currentUser, diaryDaysByDate]
  );

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

