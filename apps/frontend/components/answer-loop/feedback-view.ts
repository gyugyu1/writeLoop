"use client";

import { pickFirstNonEmpty, trimNullable } from "../../lib/text";
import {
  hasCoachMove,
  isCoachMoveComparison,
  isDirectCorrectionCoachMove,
  normalizeSuggestedPhrase
} from "../../lib/coach-move";
import { getFeedbackLevelInfo } from "../../lib/feedback-level";
import { getFeedbackSlotUiCopy } from "../../lib/feedback-slot-ui";
import { filterSuggestedRefinementExpressions } from "../../lib/refinement-recommendations";
import type { Feedback, FeedbackLoopStatus } from "../../lib/types";

// 웹 주 화면의 피드백 응답에서 화면에 쓰는 값을 계산한다(순수 계산). 피드백 화면, 다시 쓰기 화면의 이전 피드백,
// 완료 화면이 이 결과를 쓴다.
export function deriveFeedbackView({
  feedback,
  areAllLanguageCorrectionsVisible,
  sessionId,
  completedSessionId,
  lastSubmittedAnswer
}: {
  feedback: Feedback | null;
  areAllLanguageCorrectionsVisible: boolean;
  sessionId: string;
  completedSessionId: string;
  lastSubmittedAnswer: string;
}) {
  const feedbackLevel = feedback ? getFeedbackLevelInfo(feedback.loopComplete) : null;
  const visibleFeedback = feedback?.visibleFeedback ?? null;
  const loopExperience = feedback?.loop ?? null;
  const coachMove = visibleFeedback?.coachMove ?? feedback?.coachMove ?? null;
  const allLanguageCorrections = Array.isArray(coachMove?.languageCorrections)
    ? coachMove.languageCorrections
    : [];
  const languageCorrections = areAllLanguageCorrectionsVisible
    ? allLanguageCorrections
    : allLanguageCorrections.slice(0, 4);
  const hiddenLanguageCorrectionCount = Math.max(
    0,
    allLanguageCorrections.length - 4
  );
  const isLanguageFix = trimNullable(coachMove?.focusType)?.toUpperCase() === "LANGUAGE_FIX";
  const isLoopReadyToFinish =
    visibleFeedback?.state === "READY_TO_FINISH" ||
    Boolean(feedback?.loopComplete) ||
    loopExperience?.nextAction === "finish" ||
    loopExperience?.status === "READY_TO_FINISH";
  const isSessionCompleted = Boolean(sessionId) && completedSessionId === sessionId;
  const visibleStrength = pickFirstNonEmpty(visibleFeedback?.strength, feedback?.strengths?.[0]);
  const completionRefinementExpressions = filterSuggestedRefinementExpressions(
    visibleFeedback?.refinementExpressions ?? feedback?.refinementExpressions,
    lastSubmittedAnswer,
    feedback?.revisedAnswer
  );
  const visibleModelAnswer = pickFirstNonEmpty(visibleFeedback?.modelAnswer, feedback?.modelAnswer);
  const visibleModelAnswerKo = pickFirstNonEmpty(
    visibleFeedback?.modelAnswerKo,
    feedback?.modelAnswerKo
  );
  const enrichment = isLoopReadyToFinish
    ? (visibleFeedback?.completion ?? feedback?.completion)?.enrichment ?? null
    : null;
  const hasEnrichment = Boolean(trimNullable(enrichment?.focus) && trimNullable(enrichment?.skeletonEn));
  const enrichmentPhrases =
    hasEnrichment && Array.isArray(enrichment?.suggestedPhrases)
      ? enrichment.suggestedPhrases.map(normalizeSuggestedPhrase).filter((phrase) => phrase !== null).slice(0, 4)
      : [];
  const shouldShowCoachMoveCard = !isLoopReadyToFinish && hasCoachMove(coachMove);
  const shouldShowCoachMoveComparison = isCoachMoveComparison(coachMove);
  const shouldShowCorrectionReasonLabel = isDirectCorrectionCoachMove(coachMove);
  const coachSlotUiCopy = getFeedbackSlotUiCopy(coachMove?.targetSlot);
  const coachHeadline = pickFirstNonEmpty(
    coachSlotUiCopy?.title,
    coachMove?.focus,
    loopExperience?.headline,
    isLoopReadyToFinish
      ? "좋아요. 지금 단계에서 마무리해도 충분해요."
      : "지금은 한 가지만 먼저 고쳐서 다시 써 보세요."
  );
  const coachInstruction = pickFirstNonEmpty(
    coachMove?.instruction,
    feedback?.rewriteChallenge,
    isLoopReadyToFinish
      ? "이미 충분히 좋아요. 원하면 표현 하나만 가볍게 다듬어 보세요."
      : "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영해 다시 써 보세요."
  );
  const coachSkeleton = shouldShowCorrectionReasonLabel
    ? null
    : pickFirstNonEmpty(coachMove?.skeletonEn, coachSlotUiCopy?.skeletonEn);
  const coachSkeletonKo = shouldShowCorrectionReasonLabel
    ? null
    : pickFirstNonEmpty(coachMove?.skeletonKo, coachSlotUiCopy?.skeletonKo);
  const coachSuggestedPhrases =
    !shouldShowCorrectionReasonLabel && Array.isArray(coachMove?.suggestedPhrases)
      ? coachMove.suggestedPhrases.map(normalizeSuggestedPhrase).filter((phrase) => phrase !== null).slice(0, 6)
      : [];

  function resolveLoopStatus(): FeedbackLoopStatus | null {
    if (!feedback) {
      return null;
    }

    return (
      feedback.ui?.loopStatus ?? {
        badge: feedback.loopComplete ? "루프 완료 가능" : "다시 써보기 추천",
        headline:
          feedback.completionMessage?.trim() ??
          (feedback.loopComplete
            ? "지금 단계에서 마무리해도 괜찮아요."
            : "지금은 한 가지만 먼저 고쳐서 다시 써 보세요."),
        supportText: feedback.loopComplete
          ? "원하면 한 번 더 다듬어 볼 수 있어요."
          : "위 starter를 바탕으로 바로 다시 써 볼 수 있어요.",
        rewriteCtaLabel: feedback.loopComplete
          ? hasEnrichment
            ? "이 내용 넣어서 다시 써 보기"
            : "그래도 더 다듬어서 써보기"
          : "다시 써보기",
        finishCtaLabel: feedback.loopComplete ? "오늘 루프 완료하고 도장 받기" : null,
        cancelCtaLabel: "답변 취소"
      }
    );
  }

  return {
    feedbackLevel,
    visibleFeedback,
    loopExperience,
    coachMove,
    allLanguageCorrections,
    languageCorrections,
    hiddenLanguageCorrectionCount,
    isLanguageFix,
    isLoopReadyToFinish,
    isSessionCompleted,
    visibleStrength,
    completionRefinementExpressions,
    visibleModelAnswer,
    visibleModelAnswerKo,
    enrichment,
    hasEnrichment,
    enrichmentPhrases,
    shouldShowCoachMoveCard,
    shouldShowCoachMoveComparison,
    shouldShowCorrectionReasonLabel,
    coachSlotUiCopy,
    coachHeadline,
    coachInstruction,
    coachSkeleton,
    coachSkeletonKo,
    coachSuggestedPhrases,
    loopStatus: resolveLoopStatus()
  };
}

export type FeedbackView = ReturnType<typeof deriveFeedbackView>;
