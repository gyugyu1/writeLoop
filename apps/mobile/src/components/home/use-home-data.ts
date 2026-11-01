import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getMobileHomeSnapshot,
  getTodayWritingStatus,
  getWritingDraft
} from "@/lib/api";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import { useSession } from "@/lib/session";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import type {
  DailyDifficulty,
  DiaryCalendarSummary,
  FeaturedDailyPromptRecommendation,
  TodayWritingStatus
} from "@/lib/types";

// 홈 화면의 데이터: 학습 일지·추천 질문·일기 달력·Now in English 요약 불러오기, 이어 쓰기 상태 확인(포커스마다),
// 당겨서 새로고침. 효과 ①~⑥을 원래 순서대로 담는다. 화면의 첫 효과 자리(상태 선언 자리)에서 부른다.
export function useHomeData({
  currentUser,
  refreshSession
}: {
  currentUser: ReturnType<typeof useSession>["currentUser"];
  refreshSession: ReturnType<typeof useSession>["refreshSession"];
}) {
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
  const [diaryCalendarSummary, setDiaryCalendarSummary] = useState<DiaryCalendarSummary | null>(null);
  const [isDiaryCalendarLoading, setIsDiaryCalendarLoading] = useState(false);
  const [diaryCalendarError, setDiaryCalendarError] = useState("");
  const [nowInEnglishSummary, setNowInEnglishSummary] = useState<NowInEnglishSummary | null>(null);
  const [isInitialHomeLoadComplete, setIsInitialHomeLoadComplete] = useState(false);
  const featuredRecommendationRequestIdRef = useRef(0);
  const homeSnapshotRequestIdRef = useRef(0);
  const diaryCalendarLoadPromiseRef = useRef<Promise<void> | null>(null);
  const hasCompletedInitialHomeLoadRef = useRef(false);
  const featuredRecommendationDifficulty = incompleteLoop?.difficulty ?? "I";
  const featuredRecommendationItem = featuredRecommendation?.featured ?? null;
  const featuredRecommendationPrompt = featuredRecommendationItem?.prompt ?? null;

  useEffect(() => {
    hasCompletedInitialHomeLoadRef.current = false;
    setIsInitialHomeLoadComplete(false);
  }, [currentUser?.id]);

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

  return {
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
  };
}
