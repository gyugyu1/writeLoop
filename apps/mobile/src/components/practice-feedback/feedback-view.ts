import { getFeedbackSlotUiCopy } from "@/lib/feedback-slot-ui";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import { filterSuggestedRefinementExpressions } from "@/lib/refinement-recommendations";
import {
  buildCompletionRefinementPhrases,
  COMPLETION_READY_HEADLINE,
  hasCoachMove,
  isCoachMoveComparison,
  isDirectCorrectionCoachMove,
  normalizeSuggestedPhrase,
  pickFirstNonEmpty,
  REWRITE_FEEDBACK_BUTTON_LABEL,
  REWRITE_OPEN_BUTTON_LABEL,
  trimText
} from "./feedback-helpers";

// 피드백 화면이 피드백 상태와 화면 상태로 계산하는 값. 화면은 렌더마다 이 함수를 부른다.
export function derivePracticeFeedbackView({
  feedbackState,
  areAllLanguageCorrectionsVisible,
  isCompletionRewriteOpen,
  isSubmittingRewrite
}: {
  feedbackState: PracticeFeedbackState | null;
  areAllLanguageCorrectionsVisible: boolean;
  isCompletionRewriteOpen: boolean;
  isSubmittingRewrite: boolean;
}) {
  const feedback = feedbackState?.feedback ?? null;
  const visibleFeedback = feedback?.visibleFeedback ?? null;
  const loopStatus = feedback?.ui?.loopStatus ?? null;
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
  const isLanguageFix = trimText(coachMove?.focusType).toUpperCase() === "LANGUAGE_FIX";
  const rewriteWorkspace = feedback?.rewriteWorkspace ?? null;
  const completion = visibleFeedback?.completion ?? feedback?.completion ?? null;
  const visibleStrength = pickFirstNonEmpty(
    visibleFeedback?.strength,
    feedback?.strengths?.[0]
  );
  const isLoopReadyToFinish =
    visibleFeedback?.state === "READY_TO_FINISH" ||
    feedback?.loopComplete ||
    loopExperience?.nextAction === "finish" ||
    loopExperience?.status === "READY_TO_FINISH";
  const shouldShowCoachMoveCard = !isLoopReadyToFinish && hasCoachMove(coachMove);
  const completionRefinementPhrases = isLoopReadyToFinish
    ? buildCompletionRefinementPhrases(
        filterSuggestedRefinementExpressions(
          visibleFeedback?.refinementExpressions ?? feedback?.refinementExpressions,
          feedbackState?.answer,
          feedback?.revisedAnswer
        )
      )
    : [];
  const enrichment = isLoopReadyToFinish ? completion?.enrichment ?? null : null;
  const hasEnrichment = Boolean(trimText(enrichment?.focus) && trimText(enrichment?.skeletonEn));
  const enrichmentPhrases =
    hasEnrichment && Array.isArray(enrichment?.suggestedPhrases)
      ? enrichment.suggestedPhrases
          .map(normalizeSuggestedPhrase)
          .filter((phrase) => phrase !== null)
          .slice(0, 4)
      : [];
  // 완료 화면에서 "마지막 피드백 다시 보기"로 돌아온 경우. 서버가 다시쓰기를 거부하므로 쓰기 버튼을 숨긴다.
  const isSessionCompleted = Boolean(feedbackState?.sessionCompleted);
  // 제안 카드에 자체 다시쓰기 버튼이 있으므로, 제안이 있으면 일반 다시쓰기 버튼은 숨긴다.
  const shouldShowCompletionRewriteChoice =
    isLoopReadyToFinish && !hasEnrichment && !isSessionCompleted;
  const shouldShowCoachMoveComparison = isCoachMoveComparison(coachMove);
  const shouldShowCorrectionReasonLabel = isDirectCorrectionCoachMove(coachMove);
  const shouldShowInlineRewriteWorkspace =
    Boolean(feedbackState) &&
    !isSessionCompleted &&
    (!isLoopReadyToFinish || isCompletionRewriteOpen);
  const rewriteButtonLabel = REWRITE_OPEN_BUTTON_LABEL;
  const finishButtonLabel = isSessionCompleted
    ? "완료 화면으로 돌아가기"
    : pickFirstNonEmpty(
        loopExperience?.nextAction === "finish" ? loopExperience?.nextActionLabel : null,
        loopStatus?.finishCtaLabel,
        feedback?.loopComplete ? "루프 완료하기" : ""
      );
  const shouldShowFinishButton = Boolean(finishButtonLabel);
  const shouldShowCompletionFooter = shouldShowFinishButton;
  const completionHeadline = isLoopReadyToFinish
    ? completionRefinementPhrases.length > 0
      ? COMPLETION_READY_HEADLINE
      : "좋아요! 지금 단계에서 마무리해도 충분해요."
    : pickFirstNonEmpty(
        completion?.headline,
        loopExperience?.headline,
        loopStatus?.headline,
        feedback?.completionMessage,
        feedback?.summary,
        COMPLETION_READY_HEADLINE
      );
  const coachSlotUiCopy = getFeedbackSlotUiCopy(coachMove?.targetSlot);
  const coachHeadline = pickFirstNonEmpty(
    coachSlotUiCopy?.title,
    coachMove?.focus,
    loopExperience?.headline,
    "오늘은 이것 하나만 적용해 볼게요."
  );
  const coachInstruction = pickFirstNonEmpty(
    coachMove?.instruction,
    feedback?.rewriteChallenge,
    "의미는 유지하고 오늘의 한 가지 코치만 반영해 다시 써보세요."
  );
  const coachSkeleton = shouldShowCorrectionReasonLabel
    ? ""
    : pickFirstNonEmpty(coachMove?.skeletonEn, coachSlotUiCopy?.skeletonEn);
  const coachSkeletonKo = shouldShowCorrectionReasonLabel
    ? ""
    : pickFirstNonEmpty(coachMove?.skeletonKo, coachSlotUiCopy?.skeletonKo);
  const coachSuggestedPhrases = !shouldShowCorrectionReasonLabel && Array.isArray(coachMove?.suggestedPhrases)
    ? coachMove.suggestedPhrases.map(normalizeSuggestedPhrase).filter((phrase) => phrase !== null).slice(0, 6)
    : [];
  const modelAnswer = pickFirstNonEmpty(visibleFeedback?.modelAnswer, feedback?.modelAnswer);
  const modelAnswerKo = pickFirstNonEmpty(visibleFeedback?.modelAnswerKo, feedback?.modelAnswerKo);
  const inlineRewriteSubmitLabel = isSubmittingRewrite
    ? "피드백 받는 중..."
    : REWRITE_FEEDBACK_BUTTON_LABEL;
  const inlineRewriteHelpText = isLoopReadyToFinish
    ? hasEnrichment
      ? "지금 답변은 그대로 두고, 위 제안처럼 내용 한 가지만 더해 보세요."
      : "이미 충분히 좋아요. 원하면 표현 하나만 가볍게 다듬어 보세요."
    : "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영하면 돼요.";

  return {
    feedback,
    visibleFeedback,
    loopStatus,
    loopExperience,
    coachMove,
    allLanguageCorrections,
    languageCorrections,
    hiddenLanguageCorrectionCount,
    isLanguageFix,
    rewriteWorkspace,
    completion,
    visibleStrength,
    isLoopReadyToFinish,
    shouldShowCoachMoveCard,
    completionRefinementPhrases,
    enrichment,
    hasEnrichment,
    enrichmentPhrases,
    isSessionCompleted,
    shouldShowCompletionRewriteChoice,
    shouldShowCoachMoveComparison,
    shouldShowCorrectionReasonLabel,
    shouldShowInlineRewriteWorkspace,
    rewriteButtonLabel,
    finishButtonLabel,
    shouldShowFinishButton,
    shouldShowCompletionFooter,
    completionHeadline,
    coachSlotUiCopy,
    coachHeadline,
    coachInstruction,
    coachSkeleton,
    coachSkeletonKo,
    coachSuggestedPhrases,
    modelAnswer,
    modelAnswerKo,
    inlineRewriteSubmitLabel,
    inlineRewriteHelpText
  };
}
