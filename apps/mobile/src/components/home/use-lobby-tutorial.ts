import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  HOME_TUTORIAL_STEP_COUNT,
  type HomeTutorialSpotlight
} from "@/components/home-feature-tutorial";
import type { LobbyProjection } from "@/components/lobby3d/lobby3d-canvas";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import {
  completeHomeTutorial,
  consumeHomeTutorialReplay,
  hasCompletedHomeTutorial
} from "@/lib/home-tutorial";
import type { MarkId } from "@/lib/lobby3d/engine";
import { useSession } from "@/lib/session";

// 홈(로비) 첫 안내: 띄울지 정하기(포커스마다), 짚을 장소 정하기, 단계 진행·닫기.
// 띄우는 규칙(첫 불러오기 뒤, 앱 업데이트 안내·다른 창이 열린 동안 기다림, 저장소 오류 처리)은 옛 홈 튜토리얼과 같다.
// 짚는 대상만 화면 구역에서 방의 장소 이름표로 바뀌었다.

/** 단계마다 짚는 장소. home-feature-tutorial의 단계 순서와 같다. */
const TUTORIAL_MARKS: MarkId[] = ["board", "desk", "window"];
/** 장소 이름표 둘레로 짚는 영역(화면 점 단위). 이름표 아래 가구까지 들어가게 아래로 길다. */
const SPOT_WIDTH = 150;
const SPOT_ABOVE = 24;
const SPOT_BELOW = 120;
const EDGE = 8;
/** 3D가 장소 좌표를 이만큼 기다려도 보내지 않으면, 옛 튜토리얼처럼 저장하지 않고 조용히 닫는다(다음에 다시 뜬다). */
const POSITION_TIMEOUT_MS = 3000;

export function lobbyTutorialSpotlight(
  projection: LobbyProjection | null,
  stepIndex: number,
  windowWidth: number,
  windowHeight: number
): HomeTutorialSpotlight | null {
  const mark = TUTORIAL_MARKS[stepIndex];
  const label = mark ? projection?.labels[mark] : undefined;
  if (!label) return null;
  // 카메라가 가까우면 장소가 화면 밖에 있을 수 있다. 짚는 영역을 화면 안으로 끌어와, 카드와 버튼이 늘 나오게 한다.
  const maxLeft = Math.max(EDGE, windowWidth - EDGE - SPOT_WIDTH);
  const maxTop = Math.max(EDGE, windowHeight - EDGE - SPOT_ABOVE - SPOT_BELOW);
  const left = Math.min(maxLeft, Math.max(EDGE, label.x - SPOT_WIDTH / 2));
  const top = Math.min(maxTop, Math.max(EDGE, label.y - SPOT_ABOVE));
  const width = Math.min(SPOT_WIDTH, windowWidth - EDGE * 2);
  const height = Math.min(SPOT_ABOVE + SPOT_BELOW, windowHeight - EDGE * 2);
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

export function useLobbyTutorial({
  appUpdateNoticePhase,
  currentUser,
  isOverlayOpen,
  isFeaturedRecommendationLoading,
  isInitialHomeLoadComplete,
  projection,
  windowHeight,
  windowWidth
}: {
  appUpdateNoticePhase: ReturnType<typeof useAppOverlayStatus>["appUpdateNoticePhase"];
  currentUser: ReturnType<typeof useSession>["currentUser"];
  /** 시트·월 달력처럼 로비 위에 다른 창이 열려 있으면 안내를 기다린다. */
  isOverlayOpen: boolean;
  isFeaturedRecommendationLoading: boolean;
  isInitialHomeLoadComplete: boolean;
  projection: LobbyProjection | null;
  windowHeight: number;
  windowWidth: number;
}) {
  const [isRequested, setIsRequested] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const closedRef = useRef(false);

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
            setIsRequested(true);
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

  useEffect(() => {
    if (
      !isRequested ||
      isVisible ||
      !isInitialHomeLoadComplete ||
      isFeaturedRecommendationLoading ||
      appUpdateNoticePhase !== "settled" ||
      isOverlayOpen
    ) {
      return;
    }

    const timerId = setTimeout(() => {
      closedRef.current = false;
      setStepIndex(0);
      setIsVisible(true);
    }, 180);

    return () => {
      clearTimeout(timerId);
    };
  }, [
    appUpdateNoticePhase,
    isFeaturedRecommendationLoading,
    isInitialHomeLoadComplete,
    isOverlayOpen,
    isRequested,
    isVisible
  ]);

  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setIsVisible(false);
    setIsRequested(false);
    void completeHomeTutorial().catch(() => undefined);
  }, []);

  const spotlight = isVisible ? lobbyTutorialSpotlight(projection, stepIndex, windowWidth, windowHeight) : null;

  // 짚을 곳을 끝내 구하지 못하면(3D가 장소 좌표를 보내지 못함) 도는 표시만 남아 홈이 막힌다. 저장하지 않고 닫는다.
  const waitingForPosition = isVisible && !spotlight;
  useEffect(() => {
    if (!waitingForPosition) return;
    const timerId = setTimeout(() => {
      closedRef.current = true;
      setIsVisible(false);
      setIsRequested(false);
    }, POSITION_TIMEOUT_MS);
    return () => clearTimeout(timerId);
  }, [waitingForPosition]);

  const handleAdvance = useCallback(() => {
    if (stepIndex >= HOME_TUTORIAL_STEP_COUNT - 1) {
      handleClose();
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [handleClose, stepIndex]);

  return {
    handleAdvanceHomeTutorial: handleAdvance,
    handleCloseHomeTutorial: handleClose,
    homeTutorialSpotlight: spotlight,
    homeTutorialStepIndex: stepIndex,
    // 3D가 아직 장소 좌표를 보내지 않았으면 짚을 곳이 없어 기다린다.
    isHomeTutorialPositioning: waitingForPosition,
    isHomeTutorialVisible: isVisible
  };
}
