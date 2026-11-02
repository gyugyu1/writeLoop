import {
  Image,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import {
  hasCoachMove,
  normalizeExpressionKey,
  pickFirstNonEmpty,
  renderCoachMoveDiffText,
  renderFeedbackExpressionSaveIcon,
  trimText
} from "./feedback-helpers";
import { styles } from "./feedback-styles";
import type { FeedbackScreenValues, SavedExpressionProps } from "./feedback-screen-values";

const completionMascotImage = require("@/assets/images/feedback-completion-mascot.png");

type FeedbackHeaderProps = Pick<FeedbackScreenValues, "handleHeaderBack">;
type StrengthCardProps = Pick<FeedbackScreenValues, "visibleStrength">;
type CoachMoveCardProps = Pick<
  FeedbackScreenValues,
  | "areAllLanguageCorrectionsVisible"
  | "setAreAllLanguageCorrectionsVisible"
  | "revealedLanguageCorrectionIndexes"
  | "setRevealedLanguageCorrectionIndexes"
  | "isRevisedSentenceRevealed"
  | "setIsRevisedSentenceRevealed"
  | "savedExpressionIdsByKey"
  | "savingExpressionKeys"
  | "coachMove"
  | "languageCorrections"
  | "hiddenLanguageCorrectionCount"
  | "isLanguageFix"
  | "shouldShowCoachMoveCard"
  | "shouldShowCoachMoveComparison"
  | "shouldShowCorrectionReasonLabel"
  | "coachHeadline"
  | "coachInstruction"
  | "coachSkeleton"
  | "coachSkeletonKo"
  | "coachSuggestedPhrases"
  | "handleToggleFeedbackExpression"
>;
type InlineRewriteCardProps = Pick<
  FeedbackScreenValues,
  | "setInlineRewriteY"
  | "rewriteSubmissionIdRef"
  | "rewriteDraft"
  | "setRewriteDraft"
  | "isRewriteDraftRestored"
  | "setIsRewriteDraftRestored"
  | "hasEditedRewriteRef"
  | "rewriteError"
  | "setRewriteError"
  | "isSubmittingRewrite"
  | "rewriteWorkspace"
  | "isLanguageFix"
  | "shouldShowInlineRewriteWorkspace"
  | "inlineRewriteSubmitLabel"
  | "inlineRewriteHelpText"
  | "handleSubmitInlineRewrite"
>;
type CompletionFooterProps = Pick<
  FeedbackScreenValues,
  | "isCompletionRewriteOpen"
  | "isModelAnswerOpen"
  | "setIsModelAnswerOpen"
  | "isFinishing"
  | "savedExpressionIdsByKey"
  | "savingExpressionKeys"
  | "isLoopReadyToFinish"
  | "completionRefinementPhrases"
  | "enrichment"
  | "hasEnrichment"
  | "enrichmentPhrases"
  | "isSessionCompleted"
  | "shouldShowCompletionRewriteChoice"
  | "rewriteButtonLabel"
  | "finishButtonLabel"
  | "shouldShowCompletionFooter"
  | "completionHeadline"
  | "modelAnswer"
  | "modelAnswerKo"
  | "handleToggleFeedbackExpression"
  | "handleOpenCompletionRewrite"
  | "handleFinishLoop"
>;
type FeedbackEmptyStateProps = Pick<FeedbackScreenValues, "handleBackToQuestions">;

// 넣어볼 표현 칩(코치 피드백 카드와 보충 표현 카드). 누르면 표현을 저장하거나 저장을 취소한다.
export function SuggestedPhraseChip({
  phrase,
  savedExpressionIdsByKey,
  savingExpressionKeys,
  handleToggleFeedbackExpression
}: {
  phrase: { phrase: string; meaningKo?: string | null };
} & SavedExpressionProps) {
  const normalizedPhraseKey = normalizeExpressionKey(phrase.phrase);
  const isPhraseSaved = Boolean(savedExpressionIdsByKey[normalizedPhraseKey]);
  const isPhraseSaving = savingExpressionKeys.includes(normalizedPhraseKey);

  return (
    <Pressable
      style={[styles.coachMovePhraseChip, isPhraseSaved && styles.coachMovePhraseChipSaved]}
      onPress={() =>
        handleToggleFeedbackExpression(
          phrase.phrase,
          "COACH_RECOMMENDATION",
          phrase.meaningKo || undefined,
          undefined,
          "문장틀에 넣어볼 수 있는 표현이에요.",
          ["넣어볼 표현"]
        )
      }
      disabled={isPhraseSaving}
      accessibilityRole="button"
      accessibilityLabel={isPhraseSaved ? `${phrase.phrase} 저장 취소` : `${phrase.phrase} 저장`}
      accessibilityState={{ disabled: isPhraseSaving, selected: isPhraseSaved }}
    >
      <View style={styles.coachMovePhraseContent}>
        <Text style={styles.coachMovePhraseText}>{phrase.phrase}</Text>
        {phrase.meaningKo ? (
          <Text style={styles.coachMovePhraseMeaning}>{phrase.meaningKo}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.coachMovePhraseSaveButton,
          isPhraseSaved && styles.coachMovePhraseSaveButtonSaved
        ]}
      >
        {renderFeedbackExpressionSaveIcon(isPhraseSaved, isPhraseSaving)}
      </View>
    </Pressable>
  );
}

// 머리: 뒤로가기와 제목
export function FeedbackHeader({
  handleHeaderBack
}: FeedbackHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.headerBackButton}
        onPress={handleHeaderBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로가기"
      >
        <Text style={styles.headerBackIcon}>{"<"}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>피드백</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// 잘한 점 카드
export function StrengthCard({
  visibleStrength
}: StrengthCardProps) {
  return visibleStrength ? (
    <View style={styles.strengthCard}>
      <Text style={styles.strengthLabel}>잘한 점</Text>
      <Text style={styles.strengthText}>{visibleStrength}</Text>
    </View>
  ) : null;
}

// 코치 피드백 카드: 비교와 바뀐 곳 표시, 고친 표현 목록, 이유, 다시 쓸 때·문장 틀·넣어볼 표현
export function CoachMoveCard({
  areAllLanguageCorrectionsVisible,
  setAreAllLanguageCorrectionsVisible,
  revealedLanguageCorrectionIndexes,
  setRevealedLanguageCorrectionIndexes,
  isRevisedSentenceRevealed,
  setIsRevisedSentenceRevealed,
  savedExpressionIdsByKey,
  savingExpressionKeys,
  coachMove,
  languageCorrections,
  hiddenLanguageCorrectionCount,
  isLanguageFix,
  shouldShowCoachMoveCard,
  shouldShowCoachMoveComparison,
  shouldShowCorrectionReasonLabel,
  coachHeadline,
  coachInstruction,
  coachSkeleton,
  coachSkeletonKo,
  coachSuggestedPhrases,
  handleToggleFeedbackExpression
}: CoachMoveCardProps) {
  return shouldShowCoachMoveCard ? (
  <View style={styles.coachMoveCard}>
    <Text style={styles.coachMoveHeadline}>{coachHeadline}</Text>

    {hasCoachMove(coachMove) ? (
      <View style={styles.coachMoveBody}>
        {shouldShowCoachMoveComparison ? (
          <View style={styles.coachMoveSwap}>
            {trimText(coachMove?.before) ? (
              <View style={[styles.coachMoveSwapRow, styles.coachMoveBeforeRow]}>
                <Text style={styles.coachMoveSwapLabel}>지금</Text>
                <Text style={styles.coachMoveBefore}>
                  {renderCoachMoveDiffText(
                    trimText(coachMove?.before),
                    trimText(coachMove?.after),
                    "original"
                  )}
                </Text>
              </View>
            ) : null}
            {trimText(coachMove?.after) && isLanguageFix && !isRevisedSentenceRevealed ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsRevisedSentenceRevealed(true)}
                style={({ pressed }) => [
                  styles.languageCorrectionToggle,
                  pressed ? styles.languageCorrectionTogglePressed : null
                ]}
              >
                <Text style={styles.languageCorrectionToggleText}>고친 문장 전체 보기</Text>
              </Pressable>
            ) : trimText(coachMove?.after) ? (
              <View style={[styles.coachMoveSwapRow, styles.coachMoveAfterRow]}>
                <Text style={styles.coachMoveSwapLabel}>
                  {isLanguageFix ? "이번에 고친 문장" : "적용"}
                </Text>
                <Text style={styles.coachMoveAfter}>
                  {renderCoachMoveDiffText(
                    trimText(coachMove?.before),
                    trimText(coachMove?.after),
                    "revised"
                  )}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {languageCorrections.length > 0 ? (
          <View style={styles.languageCorrectionList}>
            {languageCorrections.map((correction, index) => (
              <View
                key={`${correction.kind}-${correction.before ?? ""}-${index}`}
                style={styles.languageCorrectionItem}
              >
                <View
                  style={[
                    styles.languageCorrectionBadge,
                    correction.kind === "STRUCTURE"
                      ? styles.languageCorrectionBadgeStructure
                      : correction.kind === "GRAMMAR_BLOCKING"
                        ? styles.languageCorrectionBadgeCore
                        : styles.languageCorrectionBadgeDetail
                  ]}
                >
                  <Text style={styles.languageCorrectionBadgeText}>
                    {correction.label}
                  </Text>
                </View>
                {trimText(correction.before) || trimText(correction.after) ? (
                  <View style={styles.languageCorrectionSwap}>
                    {trimText(correction.before) ? (
                      <Text style={styles.languageCorrectionBefore}>
                        {correction.before}
                      </Text>
                    ) : null}
                    <Text style={styles.languageCorrectionArrow}>→</Text>
                    {!trimText(correction.after) ? null : !isLanguageFix
                      || revealedLanguageCorrectionIndexes.includes(index) ? (
                      <Text style={styles.languageCorrectionAfter}>
                        {correction.after}
                      </Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${trimText(correction.before) || `교정 ${index + 1}`}의 고친 표현 보기`}
                        onPress={() =>
                          setRevealedLanguageCorrectionIndexes((current) =>
                            current.includes(index) ? current : [...current, index]
                          )
                        }
                        style={({ pressed }) => [
                          styles.languageCorrectionReveal,
                          pressed ? styles.languageCorrectionTogglePressed : null
                        ]}
                      >
                        <Text style={styles.languageCorrectionToggleText}>고친 표현 보기</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
                <Text style={styles.languageCorrectionReason}>
                  {correction.reason}
                </Text>
              </View>
            ))}
            {hiddenLanguageCorrectionCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  expanded: areAllLanguageCorrectionsVisible
                }}
                onPress={() =>
                  setAreAllLanguageCorrectionsVisible((current) => !current)
                }
                style={({ pressed }) => [
                  styles.languageCorrectionToggle,
                  pressed ? styles.languageCorrectionTogglePressed : null
                ]}
              >
                <Text style={styles.languageCorrectionToggleText}>
                  {areAllLanguageCorrectionsVisible
                    ? "추가 교정 접기"
                    : `교정 ${hiddenLanguageCorrectionCount}개 더 보기`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {trimText(coachMove?.why) ? (
          <View style={styles.coachMoveWhyBox}>
            {shouldShowCorrectionReasonLabel ? (
              <Text style={styles.coachMoveWhyLabel}>왜 고치나요</Text>
            ) : null}
            <Text style={styles.coachMoveWhy}>{coachMove?.why}</Text>
          </View>
        ) : null}
      </View>
    ) : null}

    {false && trimText(coachMove?.successCheck) ? (
      <View style={styles.coachMoveSuccessBox}>
        <Text style={styles.coachMoveSuccessLabel}>성공 기준</Text>
        <Text style={styles.coachMoveSuccess}>{coachMove?.successCheck}</Text>
      </View>
    ) : null}

    <View style={styles.coachMoveInstructionBox}>
      <Text style={styles.coachMoveInstructionLabel}>다시 쓸 때</Text>
      <Text style={styles.coachMoveInstruction}>{coachInstruction}</Text>
      {coachSkeleton ? (
        <View style={styles.coachMoveSkeletonBox}>
          <Text style={styles.coachMoveSkeletonLabel}>문장 틀</Text>
          <Text style={styles.coachMoveSkeleton}>{coachSkeleton}</Text>
          {coachSkeletonKo ? (
            <Text style={styles.coachMoveSkeletonMeaning}>{coachSkeletonKo}</Text>
          ) : null}
        </View>
      ) : null}
      {coachSuggestedPhrases.length > 0 ? (
        <View style={styles.coachMovePhraseBox}>
          <Text style={styles.coachMovePhraseLabel}>넣어볼 표현</Text>
          <View style={styles.coachMovePhraseList}>
            {coachSuggestedPhrases.map((phrase, index) => (
              <SuggestedPhraseChip
                key={`${phrase.phrase}-${index}`}
                phrase={phrase}
                savedExpressionIdsByKey={savedExpressionIdsByKey}
                savingExpressionKeys={savingExpressionKeys}
                handleToggleFeedbackExpression={handleToggleFeedbackExpression}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  </View>
  ) : null;
}

// 다시 쓰기 칸
export function InlineRewriteCard({
  setInlineRewriteY,
  rewriteSubmissionIdRef,
  rewriteDraft,
  setRewriteDraft,
  isRewriteDraftRestored,
  setIsRewriteDraftRestored,
  hasEditedRewriteRef,
  rewriteError,
  setRewriteError,
  isSubmittingRewrite,
  rewriteWorkspace,
  isLanguageFix,
  shouldShowInlineRewriteWorkspace,
  inlineRewriteSubmitLabel,
  inlineRewriteHelpText,
  handleSubmitInlineRewrite
}: InlineRewriteCardProps) {
  return shouldShowInlineRewriteWorkspace ? (
    <View
      style={styles.inlineRewriteCard}
      onLayout={(event) => setInlineRewriteY(event.nativeEvent.layout.y)}
    >
      <Text style={styles.inlineRewriteHelp}>{inlineRewriteHelpText}</Text>
      <TextInput
        style={styles.inlineRewriteInput}
        value={rewriteDraft}
        onChangeText={(value) => {
          setRewriteDraft(value);
          hasEditedRewriteRef.current = true;
          setIsRewriteDraftRestored(false);
          rewriteSubmissionIdRef.current = null;
          if (rewriteError) {
            setRewriteError("");
          }
        }}
        multiline
        textAlignVertical="top"
        placeholder={pickFirstNonEmpty(
          // 문장 교정 미션의 서버 자리 표시 문구는 고친 문장 전체라, 칸을 비우면 정답이 보이지 않게 쓰지 않는다.
          isLanguageFix ? null : rewriteWorkspace?.placeholder,
          "코치 포인트를 반영해서 다시 써보세요."
        )}
        placeholderTextColor="#B7A58F"
      />
      {isRewriteDraftRestored ? (
        <Text style={styles.inlineRewriteHelp}>이전에 쓰던 다시쓰기를 불러왔어요.</Text>
      ) : null}
      {rewriteError ? (
        <Text style={styles.inlineRewriteError}>{rewriteError}</Text>
      ) : null}
      <Pressable
        style={[
          styles.primaryButton,
          isSubmittingRewrite && styles.primaryButtonDisabled
        ]}
        onPress={() => void handleSubmitInlineRewrite()}
        disabled={isSubmittingRewrite}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmittingRewrite, busy: isSubmittingRewrite }}
      >
        <Text style={styles.primaryButtonText}>{inlineRewriteSubmitLabel}</Text>
      </Pressable>
    </View>
  ) : null;
}

// 마무리 구간: 완료 말풍선, 보충 표현, 가볍게 넣어볼 표현, 모범답안, 다시 다듬기·완료 버튼
export function CompletionFooter({
  isCompletionRewriteOpen,
  isModelAnswerOpen,
  setIsModelAnswerOpen,
  isFinishing,
  savedExpressionIdsByKey,
  savingExpressionKeys,
  isLoopReadyToFinish,
  completionRefinementPhrases,
  enrichment,
  hasEnrichment,
  enrichmentPhrases,
  isSessionCompleted,
  shouldShowCompletionRewriteChoice,
  rewriteButtonLabel,
  finishButtonLabel,
  shouldShowCompletionFooter,
  completionHeadline,
  modelAnswer,
  modelAnswerKo,
  handleToggleFeedbackExpression,
  handleOpenCompletionRewrite,
  handleFinishLoop
}: CompletionFooterProps) {
  return (
    <View style={styles.completionFooter}>
      {shouldShowCompletionFooter ? (
        <View style={styles.completionCard}>
          <View style={styles.completionSpeechRow}>
            <View style={styles.completionBubbleWrap}>
              <View style={styles.completionBubble}>
                <Text style={styles.completionHeadline}>{completionHeadline}</Text>
              </View>
            </View>

            <View style={styles.completionMascotFrame}>
              <Image source={completionMascotImage} style={styles.completionMascot} />
            </View>
          </View>
        </View>
      ) : null}

      {hasEnrichment ? (
        <View style={styles.coachMoveCard}>
          <Text style={styles.enrichmentEyebrow}>더 풍부하게 써 보기 · 선택</Text>
          <Text style={styles.enrichmentHeadline}>{enrichment?.focus}</Text>
          {trimText(enrichment?.why) ? (
            <View style={styles.coachMoveWhyBox}>
              <Text style={styles.coachMoveWhy}>{enrichment?.why}</Text>
            </View>
          ) : null}
          <View style={styles.coachMoveInstructionBox}>
            <Text style={styles.coachMoveInstructionLabel}>다시 쓸 때</Text>
            {trimText(enrichment?.instruction) ? (
              <Text style={styles.coachMoveInstruction}>{enrichment?.instruction}</Text>
            ) : null}
            <View style={styles.coachMoveSkeletonBox}>
              <Text style={styles.coachMoveSkeletonLabel}>문장 틀</Text>
              <Text style={styles.coachMoveSkeleton}>{enrichment?.skeletonEn}</Text>
              {trimText(enrichment?.skeletonKo) ? (
                <Text style={styles.coachMoveSkeletonMeaning}>{enrichment?.skeletonKo}</Text>
              ) : null}
            </View>
            {enrichmentPhrases.length > 0 ? (
              <View style={styles.coachMovePhraseBox}>
                <Text style={styles.coachMovePhraseLabel}>넣어볼 표현</Text>
                <View style={styles.coachMovePhraseList}>
                  {enrichmentPhrases.map((phrase, index) => (
                    <SuggestedPhraseChip
                      key={`${phrase.phrase}-${index}`}
                      phrase={phrase}
                      savedExpressionIdsByKey={savedExpressionIdsByKey}
                      savingExpressionKeys={savingExpressionKeys}
                      handleToggleFeedbackExpression={handleToggleFeedbackExpression}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
          {isSessionCompleted ? (
            <Text style={styles.coachMoveWhy}>
              이 질문은 완료했어요. 다음 답변에서 이 내용을 넣어 써 보세요.
            </Text>
          ) : !isCompletionRewriteOpen ? (
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={handleOpenCompletionRewrite}
            >
              <Text style={styles.secondaryButtonText}>이 내용 넣어서 다시 써 보기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isLoopReadyToFinish && completionRefinementPhrases.length > 0 ? (
        <View style={styles.completionSuggestionBox}>
          <Text style={styles.completionSuggestionLabel}>가볍게 넣어볼 표현</Text>
          <View style={styles.completionSuggestionList}>
            {completionRefinementPhrases.map((phrase, index) => {
              const normalizedPhraseKey = normalizeExpressionKey(phrase.phrase);
              const isPhraseSaved = Boolean(savedExpressionIdsByKey[normalizedPhraseKey]);
              const isPhraseSaving = savingExpressionKeys.includes(normalizedPhraseKey);

              return (
                <Pressable
                  key={`${phrase.phrase}-${index}`}
                  style={[
                    styles.completionSuggestionChip,
                    isPhraseSaved && styles.coachMovePhraseChipSaved
                  ]}
                  onPress={() =>
                    handleToggleFeedbackExpression(
                      phrase.phrase,
                      "REFINEMENT_EXPRESSION",
                      phrase.meaningKo || undefined,
                      phrase.exampleEn || undefined,
                      phrase.guidanceKo || undefined,
                      ["표현 더하기"]
                    )
                  }
                  disabled={isPhraseSaving}
                  accessibilityRole="button"
                  accessibilityLabel={isPhraseSaved ? `${phrase.phrase} 저장 취소` : `${phrase.phrase} 저장`}
                  accessibilityState={{ disabled: isPhraseSaving, selected: isPhraseSaved }}
                >
                  <View style={styles.coachMovePhraseContent}>
                    <Text style={styles.coachMovePhraseText}>{phrase.phrase}</Text>
                    {phrase.meaningKo ? (
                      <Text style={styles.coachMovePhraseMeaning}>{phrase.meaningKo}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.coachMovePhraseSaveButton,
                      isPhraseSaved && styles.coachMovePhraseSaveButtonSaved
                    ]}
                  >
                    {renderFeedbackExpressionSaveIcon(isPhraseSaved, isPhraseSaving)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {isLoopReadyToFinish && modelAnswer ? (
        <View style={styles.modelAnswerCard}>
          <Pressable
            style={styles.modelAnswerToggle}
            onPress={() => setIsModelAnswerOpen((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={isModelAnswerOpen ? "모범답안 접기" : "모범답안 펼치기"}
            accessibilityState={{ expanded: isModelAnswerOpen }}
          >
            <View>
              <Text style={styles.modelAnswerEyebrow}>참고용</Text>
              <Text style={styles.modelAnswerTitle}>모범답안</Text>
            </View>
            <Text style={styles.modelAnswerToggleIcon}>
              {isModelAnswerOpen ? "−" : "+"}
            </Text>
          </Pressable>
          {isModelAnswerOpen ? (
            <View style={styles.modelAnswerBody}>
              <Text style={styles.modelAnswerEn}>{modelAnswer}</Text>
              {modelAnswerKo ? (
                <Text style={styles.modelAnswerKo}>{modelAnswerKo}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {isLoopReadyToFinish ? (
        <>
          {shouldShowCompletionRewriteChoice && !isCompletionRewriteOpen ? (
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={handleOpenCompletionRewrite}
            >
              <Text style={styles.secondaryButtonText}>{rewriteButtonLabel}</Text>
            </Pressable>
          ) : null}

        <Pressable
          style={[styles.primaryButton, isFinishing && styles.primaryButtonDisabled]}
          onPress={() => void handleFinishLoop()}
          disabled={isFinishing}
          accessibilityRole="button"
          accessibilityState={{ disabled: isFinishing, busy: isFinishing }}
        >
          <Text style={styles.primaryButtonText}>
            {isFinishing
              ? "완료하는 중..."
              : pickFirstNonEmpty(finishButtonLabel, "루프 완료하기")}
          </Text>
        </Pressable>
        </>
      ) : null}

    </View>
  );
}

// 피드백을 찾지 못했을 때의 안내
export function FeedbackEmptyState({
  handleBackToQuestions
}: FeedbackEmptyStateProps) {
  return (
    <View style={styles.emptyStateCard}>
      <Text style={styles.emptyStateTitle}>피드백을 찾지 못했어요</Text>
      <Text style={styles.emptyStateBody}>
        방금 작성한 피드백이 초기화되었을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.
      </Text>
      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={handleBackToQuestions}>
        <Text style={styles.primaryButtonText}>질문 목록으로 돌아가기</Text>
      </Pressable>
    </View>
  );
}
