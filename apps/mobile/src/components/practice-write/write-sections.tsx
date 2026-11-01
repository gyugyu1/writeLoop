import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import ProblemReportLink from "@/components/problem-report-link";
import { VisiblePracticeFeedbackContent } from "@/components/visible-practice-feedback-content";
import { normalizeExpressionKey } from "./write-helpers";
import type { Prompt } from "@/lib/types";
import type { WriteScreenValues } from "./write-screen-values";
import { styles } from "./write-styles";

const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

type WriteHeaderProps = Pick<WriteScreenValues, "handleHeaderBack">;
type PromptSummaryCardProps = Pick<
  WriteScreenValues,
  | "feedback"
  | "feedbackReferenceLabel"
  | "isTranslationVisible"
  | "practiceExpressions"
  | "practiceTagLabel"
  | "setIsGuideOpen"
  | "setIsPreviousFeedbackOpen"
  | "setIsTranslationVisible"
> & { selectedPrompt: Prompt };
type ComposerCardProps = Pick<
  WriteScreenValues,
  | "answer"
  | "answerWordCount"
  | "canViewLatestFeedback"
  | "draftStatusBadgeLabel"
  | "draftStatusMessage"
  | "error"
  | "feedback"
  | "feedbackReferenceLabel"
  | "handleAnswerChange"
  | "handleCancelWriting"
  | "handleOpenLatestFeedback"
  | "handleSubmit"
  | "isAnswerLocked"
  | "isCancellingWriting"
  | "isCoachOpen"
  | "isSubmitting"
  | "primaryActionLabel"
  | "rewriteCoachBody"
  | "rewriteCoachTitle"
  | "setIsCoachOpen"
  | "setIsGuideOpen"
  | "setIsPreviousFeedbackOpen"
>;
type WriteEmptyStateProps = Pick<WriteScreenValues, "handleBackToQuestions">;
type PreviousFeedbackModalProps = Pick<
  WriteScreenValues,
  | "feedbackReferenceLabel"
  | "isPreviousFeedbackOpen"
  | "previousFeedbackState"
  | "setIsPreviousFeedbackOpen"
>;
type GuideModalProps = Pick<
  WriteScreenValues,
  | "answerGuide"
  | "isGuideOpen"
  | "isLoadingPromptHints"
  | "setIsGuideOpen"
  | "vocabularyPhraseHintItems"
  | "vocabularyWordHintItems"
>;
type CoachModalProps = Pick<
  WriteScreenValues,
  | "appendCoachExpression"
  | "coachHelp"
  | "coachHelpError"
  | "coachQuestion"
  | "coachQuickQuestions"
  | "handleRequestCoachHelp"
  | "handleSaveCoachExpression"
  | "isCoachOpen"
  | "isLoadingCoachHelp"
  | "savedCoachExpressionKeys"
  | "savingCoachExpressionKeys"
  | "setCoachHelp"
  | "setCoachHelpError"
  | "setCoachQuestion"
  | "setIsCoachOpen"
>;

// 머리: 뒤로가기와 제목
export function WriteHeader({
  handleHeaderBack
}: WriteHeaderProps) {
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
      <Text style={styles.headerTitle}>작문</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// 질문 요약 카드: 질문·해석, 태그 연습, 도구 줄
export function PromptSummaryCard({
  feedback,
  feedbackReferenceLabel,
  isTranslationVisible,
  practiceExpressions,
  practiceTagLabel,
  selectedPrompt,
  setIsGuideOpen,
  setIsPreviousFeedbackOpen,
  setIsTranslationVisible
}: PromptSummaryCardProps) {
  return (
    <View style={styles.promptSummaryCard}>
      <Text style={styles.promptSummaryEn}>{selectedPrompt.questionEn}</Text>
      {isTranslationVisible ? (
        <Text style={styles.promptSummaryKo}>{selectedPrompt.questionKo}</Text>
      ) : null}
      {practiceTagLabel && practiceExpressions.length > 0 && !feedback ? (
        <View style={styles.tagPracticeCard}>
          <Text style={styles.tagPracticeEyebrow}>태그 연습</Text>
          <Text style={styles.tagPracticeBody}>
            {`${practiceTagLabel} 태그로 저장한 표현을 활용해 새 문장을 써보세요.`}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagPracticeExpressionList}
            style={styles.tagPracticeExpressionScroller}
          >
            {practiceExpressions.map((expression, index) => (
              <View
                key={`${expression}-${index}`}
                style={[
                  styles.tagPracticeExpressionChip,
                  index === 0 && styles.tagPracticeExpressionChipPrimary
                ]}
              >
                <Text
                  style={[
                    styles.tagPracticeExpressionChipText,
                    index === 0 && styles.tagPracticeExpressionChipTextPrimary
                  ]}
                >
                  {expression}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.promptToolRow}>
        {feedback ? (
          <Pressable
            style={styles.translationButton}
            onPress={() => setIsPreviousFeedbackOpen(true)}
          >
            <Text style={styles.translationButtonText}>{feedbackReferenceLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.translationButton} onPress={() => setIsGuideOpen(true)}>
          <Text style={styles.translationButtonText}>가이드 보기</Text>
        </Pressable>
        <Pressable
          style={styles.translationButton}
          onPress={() => setIsTranslationVisible((current) => !current)}
        >
          <Text style={styles.translationButtonText}>
            {isTranslationVisible ? "해석 숨기기" : "해석 보기"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// 답 쓰기 카드: 다시 쓰기 안내, 입력, 임시저장 배지·단어 수, AI 코치 열기, 오류, 제출, 작문 취소
export function ComposerCard({
  answer,
  answerWordCount,
  canViewLatestFeedback,
  draftStatusBadgeLabel,
  draftStatusMessage,
  error,
  feedback,
  feedbackReferenceLabel,
  handleAnswerChange,
  handleCancelWriting,
  handleOpenLatestFeedback,
  handleSubmit,
  isAnswerLocked,
  isCancellingWriting,
  isCoachOpen,
  isSubmitting,
  primaryActionLabel,
  rewriteCoachBody,
  rewriteCoachTitle,
  setIsCoachOpen,
  setIsGuideOpen,
  setIsPreviousFeedbackOpen
}: ComposerCardProps) {
  return (
    <View style={styles.composerCard}>
      {feedback ? (
        <View style={styles.rewriteContextCard}>
          <Text style={styles.rewriteContextEyebrow}>오늘의 한 가지 적용</Text>
          <Text style={styles.rewriteContextTitle}>{rewriteCoachTitle}</Text>
          <Text style={styles.rewriteContextBody}>{rewriteCoachBody}</Text>
          <Pressable
            style={styles.rewriteContextButton}
            onPress={() => setIsPreviousFeedbackOpen(true)}
          >
            <Text style={styles.rewriteContextButtonText}>{feedbackReferenceLabel}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composerToolRow}>
        <Pressable style={styles.composerToolButton} onPress={() => setIsGuideOpen(true)}>
          <Text style={styles.composerToolButtonText}>가이드 보기</Text>
        </Pressable>
      </View>

      <View style={styles.answerInputFrame}>
        <TextInput
          style={[styles.answerInput, isAnswerLocked && styles.answerInputDisabled]}
          multiline
          textAlignVertical="top"
          placeholder="영어로 답안을 써 보세요."
          placeholderTextColor="#AE9A87"
          value={answer}
          onChangeText={handleAnswerChange}
          editable={!isAnswerLocked && !isCancellingWriting}
        />

        <View pointerEvents="box-none" style={styles.composerFooterRow}>
          <View style={styles.composerMetaBadges}>
            {draftStatusBadgeLabel ? (
              <Text
                style={[
                  styles.composerStatusBadge,
                  draftStatusMessage.includes("실패") && styles.composerStatusBadgeError
                ]}
              >
                {draftStatusBadgeLabel}
              </Text>
            ) : null}
            <Text style={styles.composerWordCount}>{answerWordCount}단어</Text>
          </View>

          {!isCoachOpen ? (
            <Pressable
              style={[
                styles.coachTriggerDock,
                !answer.trim() && styles.coachTriggerDockWithBubble
              ]}
              accessibilityRole="button"
              accessibilityLabel="AI 코치 열기"
              accessibilityHint="표현 추천 패널을 엽니다."
              onPress={() => setIsCoachOpen(true)}
            >
              {!answer.trim() ? (
                <View style={styles.coachTriggerBubble}>
                  <Text style={styles.coachTriggerBubbleText}>표현이 막히면 AI 코치에게 물어봐요.</Text>
                  <View style={styles.coachTriggerBubbleTail} />
                </View>
              ) : null}

              <View style={styles.coachTriggerMascotFrame}>
                <Image source={coachMascotImage} style={styles.coachTriggerMascot} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      {error ? (
        <View>
          <Text style={styles.errorText}>{error}</Text>
          <ProblemReportLink source="practice_write" errorCode="PRACTICE_SCREEN_ERROR" />
        </View>
      ) : null}

      <Pressable
        style={[styles.submitButton, (isSubmitting || isCancellingWriting) && styles.disabledButton]}
        onPress={() => {
          if (canViewLatestFeedback) {
            handleOpenLatestFeedback();
            return;
          }

          void handleSubmit();
        }}
        disabled={isSubmitting || isCancellingWriting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#2E2416" />
        ) : (
          <Text style={styles.submitButtonText}>{primaryActionLabel}</Text>
        )}
      </Pressable>
      {!isAnswerLocked ? (
        <Pressable
          style={[styles.cancelWritingButton, (isSubmitting || isCancellingWriting) && styles.disabledButton]}
          onPress={handleCancelWriting}
          disabled={isSubmitting || isCancellingWriting}
          accessibilityRole="button"
          accessibilityLabel="작문 취소"
        >
          {isCancellingWriting ? (
            <ActivityIndicator color="#8F5D35" />
          ) : (
            <Text style={styles.cancelWritingButtonText}>작문 취소</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

// 질문을 찾지 못했을 때의 안내
export function WriteEmptyState({
  handleBackToQuestions
}: WriteEmptyStateProps) {
  return (
    <View style={styles.emptyStateCard}>
      <Text style={styles.emptyStateTitle}>질문을 다시 골라 주세요</Text>
      <Text style={styles.emptyStateBody}>
        선택한 질문을 찾지 못했어요. 질문 목록으로 돌아가 다시 선택하면 바로 이어서 쓸 수 있어요.
      </Text>
      <Pressable style={styles.submitButton} onPress={handleBackToQuestions}>
        <Text style={styles.submitButtonText}>질문 목록으로 돌아가기</Text>
      </Pressable>
    </View>
  );
}

// 이전 피드백 창
export function PreviousFeedbackModal({
  feedbackReferenceLabel,
  isPreviousFeedbackOpen,
  previousFeedbackState,
  setIsPreviousFeedbackOpen
}: PreviousFeedbackModalProps) {
  return (
    <Modal
      visible={isPreviousFeedbackOpen}
      animationType="slide"
      onRequestClose={() => setIsPreviousFeedbackOpen(false)}
    >
      <ModalSafeAreaView style={styles.feedbackModalRoot}>
        <View style={styles.feedbackModalHeader}>
          <View style={styles.feedbackModalHeaderText}>
            <Text style={styles.feedbackModalTitle}>{feedbackReferenceLabel}</Text>
          </View>
          <Pressable
            style={styles.coachModalCloseButton}
            onPress={() => setIsPreviousFeedbackOpen(false)}
          >
            <Text style={styles.coachCloseText}>닫기</Text>
          </Pressable>
        </View>

        <View style={styles.feedbackModalBody}>
          <ScrollView
            style={styles.feedbackModalScroll}
            contentContainerStyle={styles.feedbackModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {previousFeedbackState ? (
              <VisiblePracticeFeedbackContent
                snapshot={previousFeedbackState.feedback.visibleFeedback}
                learnerAnswer={previousFeedbackState.answer}
              />
            ) : (
              <View style={styles.feedbackModalEmptyCard}>
                <Text style={styles.feedbackModalEmptyTitle}>이전 피드백을 찾지 못했어요</Text>
                <Text style={styles.feedbackModalEmptyBody}>
                  다시쓰기용 이전 피드백 정보가 초기화됐을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ModalSafeAreaView>
    </Modal>
  );
}

// 작성 가이드 창
export function GuideModal({
  answerGuide,
  isGuideOpen,
  isLoadingPromptHints,
  setIsGuideOpen,
  vocabularyPhraseHintItems,
  vocabularyWordHintItems
}: GuideModalProps) {
  return (
    <Modal
      visible={isGuideOpen}
      animationType="slide"
      onRequestClose={() => setIsGuideOpen(false)}
    >
      <ModalSafeAreaView style={styles.guideModalRoot}>
        <View style={styles.guideModalHeader}>
          <View style={styles.guideModalHeaderText}>
            <Text style={styles.guideModalTitle}>작성 가이드</Text>
          </View>
          <Pressable style={styles.coachModalCloseButton} onPress={() => setIsGuideOpen(false)}>
            <Text style={styles.coachCloseText}>닫기</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.guideModalScroll}
          contentContainerStyle={styles.guideModalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.guideIntroCard}>
            <Text style={styles.guideIntroLabel}>최고의 팁!</Text>
            <Text style={styles.guideIntroTitle}>{answerGuide.title}</Text>
            {answerGuide.description ? (
              <Text style={styles.guideIntroBody}>{answerGuide.description}</Text>
            ) : null}
          </View>

          <View style={styles.guideHintGroup}>
            <Text style={styles.guideHintGroupTitle}>첫 문장 스타터</Text>
            <View style={styles.guideStarterCard}>
              <Text style={styles.guideStarterText}>{answerGuide.starter}</Text>
            </View>
          </View>

          <View style={styles.guideHintSection}>
            {isLoadingPromptHints ? (
              <Text style={styles.guideHintEmptyText}>지금 추천 단어와 표현을 준비하고 있어요.</Text>
            ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
              <View style={styles.guideHintGroups}>
                {vocabularyWordHintItems.length > 0 ? (
                  <View style={styles.guideHintGroup}>
                    <Text style={styles.guideHintGroupTitle}>추천 단어</Text>
                    <View style={styles.guideHintWordCardList}>
                      {vocabularyWordHintItems.map((hint) => (
                        <View key={hint.id} style={styles.guideHintWordCard}>
                          <Text style={styles.guideHintWordLine}>
                            <Text style={styles.guideHintWordContent}>{hint.content}</Text>
                            {hint.meaningKo ? (
                              <Text style={styles.guideHintWordMeaningInline}>{` · ${hint.meaningKo}`}</Text>
                            ) : null}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {vocabularyPhraseHintItems.length > 0 ? (
                  <View style={styles.guideHintGroup}>
                    <Text style={styles.guideHintGroupTitle}>추천 표현</Text>
                    <View style={styles.guideHintPhraseCardList}>
                      {vocabularyPhraseHintItems.map((hint) => (
                        <View key={hint.id} style={styles.guideHintPhraseCard}>
                          <Text style={styles.guideHintPhraseLine}>
                            <Text style={styles.guideHintPhraseContent}>{hint.content}</Text>
                            {hint.meaningKo ? (
                              <Text style={styles.guideHintCardMeaningInline}>{` · ${hint.meaningKo}`}</Text>
                            ) : null}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.guideHintEmptyText}>이 질문에는 아직 추천 단어와 표현이 없어요.</Text>
            )}
          </View>


        </ScrollView>
      </ModalSafeAreaView>
    </Modal>
  );
}

// AI 코치 창
export function CoachModal({
  appendCoachExpression,
  coachHelp,
  coachHelpError,
  coachQuestion,
  coachQuickQuestions,
  handleRequestCoachHelp,
  handleSaveCoachExpression,
  isCoachOpen,
  isLoadingCoachHelp,
  savedCoachExpressionKeys,
  savingCoachExpressionKeys,
  setCoachHelp,
  setCoachHelpError,
  setCoachQuestion,
  setIsCoachOpen
}: CoachModalProps) {
  return (
    <Modal
      visible={isCoachOpen}
      animationType="slide"
      onRequestClose={() => setIsCoachOpen(false)}
    >
      <ModalSafeAreaView style={styles.coachModalRoot}>
        <KeyboardAvoidingView
          style={styles.coachModalKeyboardFrame}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View style={styles.coachModalHeader}>
            <View style={styles.coachModalHeaderText}>
              <Text style={styles.coachModalTitle}>표현 추천 받기</Text>
            </View>
            <Pressable style={styles.coachModalCloseButton} onPress={() => setIsCoachOpen(false)}>
              <Text style={styles.coachCloseText}>닫기</Text>
            </Pressable>
          </View>

          <View style={styles.coachModalBody}>
            <ScrollView
              style={styles.coachModalScroll}
              contentContainerStyle={styles.coachModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.coachPanel}>
                <TextInput
                  style={styles.coachInput}
                  multiline
                  textAlignVertical="top"
                  placeholder='예: "근력을 키우고 싶다"를 어떻게 말해?'
                  placeholderTextColor="#AE9A87"
                  value={coachQuestion}
                  onChangeText={(value) => {
                    setCoachQuestion(value);
                    setCoachHelp(null);
                    setCoachHelpError("");
                  }}
                />

                <View style={styles.coachQuickActionWrap}>
                  {coachQuickQuestions.map((question) => (
                    <Pressable
                      key={question}
                      style={styles.coachQuickChip}
                      onPress={() => {
                        setCoachQuestion(question);
                        setCoachHelp(null);
                        setCoachHelpError("");
                      }}
                    >
                      <Text style={styles.coachQuickChipText}>{question}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[styles.coachPrimaryButton, isLoadingCoachHelp && styles.disabledButton]}
                  onPress={() => void handleRequestCoachHelp()}
                  disabled={isLoadingCoachHelp}
                >
                  {isLoadingCoachHelp ? (
                    <ActivityIndicator color="#2E2416" />
                  ) : (
                    <Text style={styles.coachPrimaryButtonText}>표현 추천받기</Text>
                  )}
                </Pressable>

                <Text style={styles.coachMetaText}>
                  표현을 그대로 붙이지 말고, 내 문장 안에서 자연스럽게 풀어 써 보세요.
                </Text>

                {coachHelpError ? <Text style={styles.coachErrorText}>{coachHelpError}</Text> : null}

                {coachHelp ? (
                  <View style={styles.coachResultStack}>
                    <View style={styles.coachReplyCard}>
                      <Text style={styles.coachReplyBadge}>코치 답변</Text>
                      <Text style={styles.coachReplyText}>{coachHelp.coachReply}</Text>
                    </View>

                    <View style={styles.coachExpressionList}>
                      {coachHelp.expressions.map((expression) => (
                        <View key={expression.id} style={styles.coachExpressionCard}>
                          <View style={styles.coachExpressionTop}>
                            <Text style={styles.coachExpressionText}>{expression.expression}</Text>
                            <Text style={styles.coachExpressionMeaning}>{expression.meaningKo}</Text>
                          </View>
                          <Text style={styles.coachExpressionTip}>{expression.usageTip}</Text>
                          <Text style={styles.coachExpressionExample}>{expression.example}</Text>
                          <View style={styles.coachExpressionActionRow}>
                            <Pressable
                              style={styles.coachExpressionInsertButton}
                              onPress={() => appendCoachExpression(expression.expression)}
                            >
                              <Text style={styles.coachExpressionInsertButtonText}>문장에 넣기</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.coachExpressionSaveButton,
                                savedCoachExpressionKeys.includes(
                                  normalizeExpressionKey(expression.expression)
                                ) && styles.coachExpressionSaveButtonSaved
                              ]}
                              onPress={() => void handleSaveCoachExpression(expression)}
                              disabled={
                                savedCoachExpressionKeys.includes(
                                  normalizeExpressionKey(expression.expression)
                                ) ||
                                savingCoachExpressionKeys.includes(
                                  normalizeExpressionKey(expression.expression)
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.coachExpressionSaveButtonText,
                                  savedCoachExpressionKeys.includes(
                                    normalizeExpressionKey(expression.expression)
                                  ) && styles.coachExpressionSaveButtonTextSaved
                                ]}
                              >
                                {savingCoachExpressionKeys.includes(
                                  normalizeExpressionKey(expression.expression)
                                )
                                  ? "저장 중"
                                  : savedCoachExpressionKeys.includes(
                                        normalizeExpressionKey(expression.expression)
                                      )
                                    ? "저장됨"
                                    : "저장"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </ModalSafeAreaView>
    </Modal>
  );
}
