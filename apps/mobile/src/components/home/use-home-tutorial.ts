import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, View } from "react-native";
import {
  HOME_TUTORIAL_STEP_COUNT,
  type HomeTutorialSpotlight
} from "@/components/home-feature-tutorial";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import {
  completeHomeTutorial,
  consumeHomeTutorialReplay,
  hasCompletedHomeTutorial
} from "@/lib/home-tutorial";
import { useSession } from "@/lib/session";

// 홈 화면의 기능 튜토리얼: 띄울지 정하기(포커스마다), 대상 구역을 재서 강조 영역 잡기, 단계 진행·닫기.
// 효과 ⑦~⑨를 원래 순서대로 담는다. 데이터 훅 뒤, 월 달력 훅 앞에서 부른다.
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

export function useHomeTutorial({
  appUpdateNoticePhase,
  currentUser,
  isCalendarOpen,
  isFeaturedRecommendationLoading,
  isGuideOpen,
  isInitialHomeLoadComplete,
  windowHeight,
  windowWidth
}: {
  appUpdateNoticePhase: ReturnType<typeof useAppOverlayStatus>["appUpdateNoticePhase"];
  currentUser: ReturnType<typeof useSession>["currentUser"];
  isCalendarOpen: boolean;
  isFeaturedRecommendationLoading: boolean;
  isGuideOpen: boolean;
  isInitialHomeLoadComplete: boolean;
  windowHeight: number;
  windowWidth: number;
}) {
  const [isHomeTutorialRequested, setIsHomeTutorialRequested] = useState(false);
  const [isHomeTutorialVisible, setIsHomeTutorialVisible] = useState(false);
  const [homeTutorialStepIndex, setHomeTutorialStepIndex] = useState(0);
  const [homeTutorialSpotlight, setHomeTutorialSpotlight] =
    useState<HomeTutorialSpotlight | null>(null);
  const [isHomeTutorialPositioning, setIsHomeTutorialPositioning] = useState(false);
  const homeScrollRef = useRef<ScrollView | null>(null);
  const homeScrollViewportRef = useRef<View | null>(null);
  const homeScrollOffsetRef = useRef(0);
  const nowEnglishTutorialSectionRef = useRef<View | null>(null);
  const featuredTutorialSectionRef = useRef<View | null>(null);
  const difficultyTutorialSectionRef = useRef<View | null>(null);
  const diaryTutorialSectionRef = useRef<View | null>(null);
  const tutorialPositionRequestIdRef = useRef(0);

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

  return {
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
  };
}
