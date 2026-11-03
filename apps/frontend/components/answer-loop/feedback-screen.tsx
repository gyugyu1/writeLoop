"use client";

import Image from "next/image";
import styles from "../../app/page.module.css";
import { canBuildCoachMoveDiff, hasCoachMove } from "../../lib/coach-move";
import { buildInlineFeedbackSegments, type RenderedInlineFeedbackSegment } from "../../lib/inline-feedback";
import { trimNullable } from "../../lib/text";
import type { Feedback, PreviousMissionResult } from "../../lib/types";
import type { FeedbackView } from "./feedback-view";
import type { SavedExpressionsState } from "./use-saved-expressions";

function renderCoachMoveDiffSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <span key={`${mode}-equal-${index}`}>{segment.text}</span>;
    case "replace":
      return mode === "original" ? (
        <span key={`${mode}-replace-${index}`} className={styles.coachMoveBeforeHighlight}>
          {segment.removed}
        </span>
      ) : (
        <span key={`${mode}-replace-${index}`} className={styles.coachMoveAfterHighlight}>
          {segment.added}
        </span>
      );
    case "remove":
      return mode === "original" ? (
        <span key={`${mode}-remove-${index}`} className={styles.coachMoveBeforeHighlight}>
          {segment.text}
        </span>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <span key={`${mode}-add-${index}`} className={styles.coachMoveAfterHighlight}>
          {segment.text}
        </span>
      ) : null;
    default:
      return null;
  }
}

function renderCoachMoveDiffText(original: string, revised: string, mode: "original" | "revised") {
  if (original && revised && original !== revised && canBuildCoachMoveDiff(original, revised)) {
    const segments = buildInlineFeedbackSegments(original, revised, null);
    if (segments.some((segment) => segment.kind !== "equal")) {
      return segments.map((segment, index) => renderCoachMoveDiffSegment(segment, mode, index));
    }
  }

  return mode === "original" ? original : revised;
}

export type FeedbackSummaryProps = {
  feedback: Feedback | null;
  view: FeedbackView;
  savedExpressions: SavedExpressionsState;
  areAllLanguageCorrectionsVisible: boolean;
  setAreAllLanguageCorrectionsVisible: (updater: boolean | ((current: boolean) => boolean)) => void;
  // 문장 교정 미션에서 학습자가 눌러 연 교정 줄(번호)과 고친 문장 전체. 새 피드백을 받으면 다시 가린다.
  revealedLanguageCorrectionIndexes: number[];
  setRevealedLanguageCorrectionIndexes: (updater: number[] | ((current: number[]) => number[])) => void;
  isRevisedSentenceRevealed: boolean;
  setIsRevisedSentenceRevealed: (value: boolean) => void;
};

// 피드백 요약: 잘한 점, 코치 피드백 구간, 보충 표현 구간, 마무리 표현, 모범 답안.
// 피드백 화면과 다시 쓰기 화면의 이전 피드백이 함께 쓴다.
export function FeedbackSummary({
  feedback,
  view,
  savedExpressions,
  areAllLanguageCorrectionsVisible,
  setAreAllLanguageCorrectionsVisible,
  revealedLanguageCorrectionIndexes,
  setRevealedLanguageCorrectionIndexes,
  isRevisedSentenceRevealed,
  setIsRevisedSentenceRevealed
}: FeedbackSummaryProps) {
  const {
    coachHeadline,
    coachInstruction,
    coachMove,
    coachSkeleton,
    coachSkeletonKo,
    coachSuggestedPhrases,
    hiddenLanguageCorrectionCount,
    isLanguageFix,
    languageCorrections,
    shouldShowCoachMoveCard,
    shouldShowCoachMoveComparison,
    shouldShowCorrectionReasonLabel,
    enrichment,
    enrichmentPhrases,
    hasEnrichment,
    isSessionCompleted,
    completionRefinementExpressions,
    isLoopReadyToFinish,
    visibleModelAnswer,
    visibleModelAnswerKo,
    visibleStrength
  } = view;

  function renderCoachMoveSection() {
    if (!shouldShowCoachMoveCard) {
      return null;
    }

    const before = trimNullable(coachMove?.before);
    const after = trimNullable(coachMove?.after);

    return (
      <section className={styles.coachMoveCard}>
        <h2 className={styles.coachMoveHeadline}>{coachHeadline}</h2>

        {hasCoachMove(coachMove) ? (
          <div className={styles.coachMoveBody}>
            {shouldShowCoachMoveComparison ? (
              <div className={styles.coachMoveSwap}>
                {before ? (
                  <div className={`${styles.coachMoveSwapRow} ${styles.coachMoveBeforeRow}`}>
                    <span className={styles.coachMoveSwapLabel}>지금</span>
                    <p className={styles.coachMoveBefore}>{renderCoachMoveDiffText(before, after ?? "", "original")}</p>
                  </div>
                ) : null}
                {after && isLanguageFix && !isRevisedSentenceRevealed ? (
                  <button
                    type="button"
                    className={styles.revisedSentenceReveal}
                    onClick={() => setIsRevisedSentenceRevealed(true)}
                  >
                    고친 문장 전체 보기
                  </button>
                ) : after ? (
                  <div className={`${styles.coachMoveSwapRow} ${styles.coachMoveAfterRow}`}>
                    <span className={styles.coachMoveSwapLabel}>
                      {isLanguageFix ? "이번에 고친 문장" : "적용"}
                    </span>
                    <p className={styles.coachMoveAfter}>{renderCoachMoveDiffText(before ?? "", after, "revised")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {languageCorrections.length > 0 ? (
              <div className={styles.languageCorrectionList}>
                {languageCorrections.map((correction, index) => (
                  <article
                    key={`${correction.kind}-${correction.before ?? ""}-${index}`}
                    className={styles.languageCorrectionItem}
                  >
                    <span
                      className={`${styles.languageCorrectionBadge} ${
                        correction.kind === "STRUCTURE"
                          ? styles.languageCorrectionBadgeStructure
                          : correction.kind === "GRAMMAR_BLOCKING"
                            ? styles.languageCorrectionBadgeCore
                            : styles.languageCorrectionBadgeDetail
                      }`}
                    >
                      {correction.label}
                    </span>
                    {trimNullable(correction.before) || trimNullable(correction.after) ? (
                      <p className={styles.languageCorrectionSwap}>
                        {trimNullable(correction.before) ? (
                          <del>{correction.before}</del>
                        ) : null}
                        <span aria-hidden="true">→</span>
                        {!trimNullable(correction.after) ? null : !isLanguageFix
                          || revealedLanguageCorrectionIndexes.includes(index) ? (
                          <strong>{correction.after}</strong>
                        ) : (
                          <button
                            type="button"
                            className={styles.languageCorrectionReveal}
                            aria-label={`${index + 1}번째 교정${trimNullable(correction.before) ? ` ${trimNullable(correction.before)}` : ""}의 고친 표현 보기`}
                            onClick={() =>
                              setRevealedLanguageCorrectionIndexes((current) =>
                                current.includes(index) ? current : [...current, index]
                              )
                            }
                          >
                            고친 표현 보기
                          </button>
                        )}
                      </p>
                    ) : null}
                    <p className={styles.languageCorrectionReason}>{correction.reason}</p>
                  </article>
                ))}
                {hiddenLanguageCorrectionCount > 0 ? (
                  <button
                    type="button"
                    className={styles.languageCorrectionToggle}
                    aria-expanded={areAllLanguageCorrectionsVisible}
                    onClick={() =>
                      setAreAllLanguageCorrectionsVisible((current) => !current)
                    }
                  >
                    {areAllLanguageCorrectionsVisible
                      ? "추가 교정 접기"
                      : `교정 ${hiddenLanguageCorrectionCount}개 더 보기`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {trimNullable(coachMove?.why) ? (
              <div className={styles.coachMoveWhyBox}>
                {shouldShowCorrectionReasonLabel ? (
                  <span className={styles.coachMoveWhyLabel}>왜 고치나요</span>
                ) : null}
                <p className={styles.coachMoveWhy}>{coachMove?.why}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {false && trimNullable(coachMove?.successCheck) ? (
          <div className={styles.coachMoveSuccessBox}>
            <span className={styles.coachMoveSuccessLabel}>성공 기준</span>
            <p className={styles.coachMoveSuccess}>{coachMove?.successCheck}</p>
          </div>
        ) : null}

        <div className={styles.coachMoveInstructionBox}>
          <span className={styles.coachMoveInstructionLabel}>다시 쓸 때</span>
          <p className={styles.coachMoveInstruction}>{coachInstruction}</p>
          {coachSkeleton ? (
            <div className={styles.coachMoveSkeletonBox}>
              <span className={styles.coachMoveSkeletonLabel}>문장 틀</span>
              <p className={styles.coachMoveSkeleton}>{coachSkeleton}</p>
              {coachSkeletonKo ? <p className={styles.coachMoveSkeletonMeaning}>{coachSkeletonKo}</p> : null}
            </div>
          ) : null}
          {coachSuggestedPhrases.length > 0 ? (
            <div className={styles.coachMovePhraseBox}>
              <span className={styles.coachMovePhraseLabel}>넣어볼 표현</span>
              <div className={styles.coachMovePhraseList}>
                {coachSuggestedPhrases.map((phrase, index) => {
                  const saved = savedExpressions.isSaved(phrase.phrase);
                  const saving = savedExpressions.isSaving(phrase.phrase);
                  return (
                    <button
                      key={`${phrase.phrase}-${index}`}
                      type="button"
                      className={`${styles.coachMovePhraseChip} ${saved ? styles.coachMovePhraseChipSaved : ""}`}
                      aria-label={saved ? `${phrase.phrase} 저장 취소` : `${phrase.phrase} 저장`}
                      aria-pressed={saved}
                      onClick={() =>
                        void savedExpressions.toggle({
                          expression: phrase.phrase,
                          meaningKo: phrase.meaningKo,
                          usageTipKo: "문장틀에 넣어볼 수 있는 표현이에요.",
                          tags: ["넣어볼 표현"],
                          sourceType: "COACH_RECOMMENDATION"
                        })
                      }
                      disabled={saving}
                    >
                      <strong>{phrase.phrase}</strong>
                      {phrase.meaningKo ? <small>{phrase.meaningKo}</small> : null}
                      <em>{saving ? "저장 중" : saved ? "저장됨" : "저장"}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderEnrichmentSection() {
    if (!hasEnrichment) {
      return null;
    }

    return (
      <section className={styles.coachMoveCard}>
        <span className={styles.enrichmentEyebrow}>더 풍부하게 써 보기 · 선택</span>
        <h2 className={styles.enrichmentHeadline}>{enrichment?.focus}</h2>
        {trimNullable(enrichment?.why) ? (
          <div className={styles.coachMoveWhyBox}>
            <p className={styles.coachMoveWhy}>{enrichment?.why}</p>
          </div>
        ) : null}
        <div className={styles.coachMoveInstructionBox}>
          <span className={styles.coachMoveInstructionLabel}>다시 쓸 때</span>
          {trimNullable(enrichment?.instruction) ? (
            <p className={styles.coachMoveInstruction}>{enrichment?.instruction}</p>
          ) : null}
          <div className={styles.coachMoveSkeletonBox}>
            <span className={styles.coachMoveSkeletonLabel}>문장 틀</span>
            <p className={styles.coachMoveSkeleton}>{enrichment?.skeletonEn}</p>
            {trimNullable(enrichment?.skeletonKo) ? (
              <p className={styles.coachMoveSkeletonMeaning}>{enrichment?.skeletonKo}</p>
            ) : null}
          </div>
          {enrichmentPhrases.length > 0 ? (
            <div className={styles.coachMovePhraseBox}>
              <span className={styles.coachMovePhraseLabel}>넣어볼 표현</span>
              <div className={styles.coachMovePhraseList}>
                {enrichmentPhrases.map((phrase, index) => {
                  const saved = savedExpressions.isSaved(phrase.phrase);
                  const saving = savedExpressions.isSaving(phrase.phrase);
                  return (
                    <button
                      key={`${phrase.phrase}-${index}`}
                      type="button"
                      className={`${styles.coachMovePhraseChip} ${saved ? styles.coachMovePhraseChipSaved : ""}`}
                      aria-label={saved ? `${phrase.phrase} 저장 취소` : `${phrase.phrase} 저장`}
                      aria-pressed={saved}
                      onClick={() =>
                        void savedExpressions.toggle({
                          expression: phrase.phrase,
                          meaningKo: phrase.meaningKo,
                          usageTipKo: "문장틀에 넣어볼 수 있는 표현이에요.",
                          tags: ["넣어볼 표현"],
                          sourceType: "COACH_RECOMMENDATION"
                        })
                      }
                      disabled={saving}
                    >
                      <strong>{phrase.phrase}</strong>
                      {phrase.meaningKo ? <small>{phrase.meaningKo}</small> : null}
                      <em>{saving ? "저장 중" : saved ? "저장됨" : "저장"}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        {isSessionCompleted ? (
          <p className={styles.coachMoveWhy}>이 질문은 완료했어요. 다음 답변에서 이 내용을 넣어 써 보세요.</p>
        ) : null}
      </section>
    );
  }

  function renderVisibleFeedbackSummary() {
    if (!feedback) {
      return null;
    }

    return (
      <div className={styles.visibleFeedbackStack}>
        {visibleStrength ? (
          <section className={styles.visibleStrengthCard}>
            <span>잘한 점</span>
            <p>{visibleStrength}</p>
          </section>
        ) : null}

        {renderCoachMoveSection()}

        {renderEnrichmentSection()}

        {isLoopReadyToFinish && completionRefinementExpressions.length > 0 ? (
          <section className={styles.visibleExpressionCard}>
            <span className={styles.visibleExpressionLabel}>가볍게 넣어볼 표현</span>
            <div className={styles.visibleExpressionList}>
              {completionRefinementExpressions.map((expression) => {
                const saved = savedExpressions.isSaved(expression.expression);
                const saving = savedExpressions.isSaving(expression.expression);
                return (
                  <button
                    key={expression.expression}
                    type="button"
                    className={`${styles.visibleExpressionChip} ${
                      saved ? styles.visibleExpressionChipSaved : ""
                    }`}
                    onClick={() =>
                      void savedExpressions.toggle({
                        expression: expression.expression,
                        meaningKo: expression.meaningKo,
                        exampleEn: expression.exampleEn,
                        usageTipKo: expression.guidanceKo,
                        tags: ["표현 더하기"],
                        sourceType: "REFINEMENT_EXPRESSION"
                      })
                    }
                    disabled={saving}
                  >
                    <strong>{expression.expression}</strong>
                    {expression.meaningKo ? <small>{expression.meaningKo}</small> : null}
                    <em>{saving ? "저장 중" : saved ? "저장됨" : "저장"}</em>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {isLoopReadyToFinish && visibleModelAnswer ? (
          <details className={styles.visibleModelAnswerCard}>
            <summary>
              <span>
                <small>참고용</small>
                <strong>모범답안</strong>
              </span>
              <span className={styles.visibleModelAnswerToggle}>펼쳐보기</span>
            </summary>
            <div className={styles.visibleModelAnswerBody}>
              <p>{visibleModelAnswer}</p>
              {visibleModelAnswerKo ? <p>{visibleModelAnswerKo}</p> : null}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  return renderVisibleFeedbackSummary();
}

// 피드백 화면: 진행 상태, 피드백 요약, 다시 써 보기·루프 마치기.
const PREVIOUS_MISSION_STATUS_CLASS: Record<string, string> = {
  RESOLVED: styles.previousMissionResolved,
  PARTIAL: styles.previousMissionPartial,
  UNRESOLVED: styles.previousMissionUnresolved
};

const PREVIOUS_MISSION_STATUS_MARK: Record<string, string> = {
  RESOLVED: "✓",
  PARTIAL: "△",
  UNRESOLVED: "·"
};

// 다시 쓴 답의 피드백 맨 위에 지난 미션을 이번 답이 해결했는지 한 줄로 보여 준다.
function PreviousMissionResultCard({ result }: { result?: PreviousMissionResult | null }) {
  if (!result?.message) {
    return null;
  }
  const statusClass = PREVIOUS_MISSION_STATUS_CLASS[result.status] ?? styles.previousMissionUnresolved;
  return (
    <div className={`${styles.previousMissionCard} ${statusClass}`} data-status={result.status}>
      <span className={styles.previousMissionLabel}>
        {result.title ? `지난 미션: ${result.title}` : "지난 미션"}
      </span>
      <span className={styles.previousMissionMessage}>
        <span aria-hidden="true">{PREVIOUS_MISSION_STATUS_MARK[result.status] ?? "·"} </span>
        {result.message}
      </span>
    </div>
  );
}

export function FeedbackStep({
  summaryProps,
  isFinishingLoop,
  onFinishLoop,
  onRewriteFromCurrentAnswer
}: {
  summaryProps: FeedbackSummaryProps;
  isFinishingLoop: boolean;
  onFinishLoop: () => void | Promise<void>;
  onRewriteFromCurrentAnswer: () => void;
}) {
  const { feedback, view } = summaryProps;
  const { feedbackLevel, isLoopReadyToFinish, isSessionCompleted, visibleFeedback } = view;

  function renderFeedbackStep() {
    const resolvedLoopStatus = view.loopStatus;
    const showRewriteCta = Boolean(feedback) && !isSessionCompleted;
    const showFinishCta = isLoopReadyToFinish;
    const completionHeadline =
      visibleFeedback?.completion?.headline ??
      resolvedLoopStatus?.headline ??
      feedback?.completionMessage ??
      feedbackLevel?.summary ??
      "좋아요. 지금 단계에서 마무리해도 충분해요.";

    return (
      <section className={`${styles.stage} ${styles.premiumFeedbackTheme}`}>
        {feedback ? (
          <div className={styles.feedbackBody}>
            <div className={styles.feedbackAttemptMetaRow}>
              <span className={styles.feedbackAttemptMetaOnly}>{`${feedback.attemptNo}번째 시도`}</span>
            </div>
            <PreviousMissionResultCard result={feedback.previousMissionResult} />
            <FeedbackSummary {...summaryProps} />
          </div>
        ) : (
          <p className={styles.placeholderText}>답변을 제출하면 여기에 피드백이 표시됩니다.</p>
        )}
        {feedback ? (
          <div className={`${styles.stageFooter} ${styles.feedbackCompletionFooter}`}>
            {showFinishCta ? (
              <div className={styles.feedbackCompletionCard}>
                <div className={styles.feedbackCompletionSpeechRow}>
                  <div className={styles.feedbackCompletionBubble}>
                    <strong className={styles.feedbackCompletionHeadline}>{completionHeadline}</strong>
                  </div>
                  <div className={styles.feedbackCompletionMascotFrame}>
                    <Image
                      src="/feedback/good.png"
                      alt=""
                      width={88}
                      height={88}
                      className={styles.feedbackCompletionMascot}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {showFinishCta ? (
              <button
                type="button"
                className={styles.footerButtonRewrite}
                onClick={() => void onFinishLoop()}
                disabled={isFinishingLoop}
              >
                {isFinishingLoop
                  ? "완료하는 중..."
                  : isSessionCompleted
                    ? "완료 화면으로 돌아가기"
                    : resolvedLoopStatus?.finishCtaLabel ?? "루프 완료하기"}
              </button>
            ) : null}
            {showRewriteCta ? (
              <button
                type="button"
                className={
                  showFinishCta
                    ? `${styles.footerButtonSecondary} ${styles.footerButtonOutline}`
                    : styles.footerButtonRewrite
                }
                onClick={onRewriteFromCurrentAnswer}
                disabled={!feedback}
              >
                {resolvedLoopStatus?.rewriteCtaLabel ??
                  (showFinishCta ? "그래도 더 다듬어서 써보기" : "다시 써보기")}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return renderFeedbackStep();
}

// 답을 제출하는 동안 보이는 피드백 기다림 화면.
export function FeedbackLoadingOverlay({
  isSubmitting,
  feedbackLoadingStages,
  activeFeedbackLoadingStageIndex
}: {
  isSubmitting: boolean;
  feedbackLoadingStages: { title: string; message: string }[];
  activeFeedbackLoadingStageIndex: number;
}) {
  function renderFeedbackLoadingOverlay() {
    if (!isSubmitting) {
      return null;
    }

    const activeStage =
      feedbackLoadingStages[Math.min(activeFeedbackLoadingStageIndex, feedbackLoadingStages.length - 1)] ??
      feedbackLoadingStages[0] ?? {
        title: "피드백을 만들고 있어요",
        message: "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."
      };

    return (
      <div className={styles.feedbackLoadingOverlay} role="status" aria-live="polite" aria-busy="true">
        <div className={styles.feedbackLoadingCard}>
          <div className={styles.feedbackLoadingIllustration}>
            <div className={styles.feedbackLoadingHalo} aria-hidden="true" />
            <div className={styles.feedbackLoadingMascotFrame}>
              <Image
                src="/coach/mascote-face.png"
                alt=""
                width={132}
                height={132}
                className={styles.feedbackLoadingMascot}
              />
            </div>
          </div>
          <strong className={styles.feedbackLoadingTitle}>{activeStage.title}</strong>
          <p className={styles.feedbackLoadingMessage}>{activeStage.message}</p>
          <div className={styles.feedbackLoadingDots} aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={`feedback-loading-dot-${index}`}
                className={styles.feedbackLoadingDot}
                style={{ animationDelay: `${index * 0.14}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return renderFeedbackLoadingOverlay();
}
