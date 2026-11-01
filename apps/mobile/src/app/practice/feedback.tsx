import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedbackLoadingOverlay, {
  REWRITE_FEEDBACK_LOADING_STAGES
} from "@/components/feedback-loading-overlay";
import {
  CoachMoveCard,
  CompletionFooter,
  FeedbackEmptyState,
  FeedbackHeader,
  InlineRewriteCard,
  StrengthCard
} from "@/components/practice-feedback/feedback-sections";
import { styles } from "@/components/practice-feedback/feedback-styles";
import { derivePracticeFeedbackView } from "@/components/practice-feedback/feedback-view";
import { useFeedbackSavedExpressions } from "@/components/practice-feedback/use-feedback-saved-expressions";
import { ApiError, completeFeedbackSession, submitFeedback } from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";
import {
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { isDailyDifficulty } from "@/lib/practice";
import { useSession } from "@/lib/session";
import type { DailyDifficulty } from "@/lib/types";

export default function PracticeFeedbackScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; promptId?: string }>();
  const navigation = useNavigation();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "I";
  const requestedPromptId = typeof params.promptId === "string" ? params.promptId : "";
  const { currentUser, refreshSession } = useSession();
  const [feedbackState, setFeedbackState] = useState<PracticeFeedbackState | null>(() =>
    getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [isHydratingFeedbackState, setIsHydratingFeedbackState] = useState(
    () => !getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [inlineRewriteY, setInlineRewriteY] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const rewriteSubmissionIdRef = useRef<string | null>(null);
  const [isCompletionRewriteOpen, setIsCompletionRewriteOpen] = useState(false);
  const [isModelAnswerOpen, setIsModelAnswerOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [rewriteDraft, setRewriteDraft] = useState(() => feedbackState?.answer ?? "");
  const [isRewriteDraftRestored, setIsRewriteDraftRestored] = useState(false);
  // 학습자가 직접 고친 뒤에만 임시저장한다. 화면을 열 때 채운 처음 글은 저장하지 않는다.
  const hasEditedRewriteRef = useRef(false);
  const [rewriteError, setRewriteError] = useState("");
  const [isSubmittingRewrite, setIsSubmittingRewrite] = useState(false);
  const [areAllLanguageCorrectionsVisible, setAreAllLanguageCorrectionsVisible] =
    useState(false);
  const {
    feedback,
    coachMove,
    languageCorrections,
    hiddenLanguageCorrectionCount,
    isLanguageFix,
    rewriteWorkspace,
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
    shouldShowCompletionFooter,
    completionHeadline,
    coachHeadline,
    coachInstruction,
    coachSkeleton,
    coachSkeletonKo,
    coachSuggestedPhrases,
    modelAnswer,
    modelAnswerKo,
    inlineRewriteSubmitLabel,
    inlineRewriteHelpText
  } = derivePracticeFeedbackView({
    feedbackState,
    areAllLanguageCorrectionsVisible,
    isCompletionRewriteOpen,
    isSubmittingRewrite
  });

  useEffect(() => {
    setAreAllLanguageCorrectionsVisible(false);
  }, [feedback?.attemptNo]);

  useEffect(() => {
    const inMemoryState = getPracticeFeedbackState(requestedDifficulty, requestedPromptId);
    if (inMemoryState) {
      setFeedbackState(inMemoryState);
      setIsHydratingFeedbackState(false);
      return;
    }

    let cancelled = false;
    setIsHydratingFeedbackState(true);

    // 저장된 상태를 읽지 못해도 로딩을 끝낸다. 상태가 없으면 화면이 빈 상태 안내를 보여 준다.
    void hydratePracticeFeedbackState(requestedDifficulty, requestedPromptId)
      .catch(() => null)
      .then((nextState) => {
      if (cancelled) {
        return;
      }

      setFeedbackState(nextState);
      setIsHydratingFeedbackState(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requestedDifficulty, requestedPromptId]);

  const {
    savedExpressionIdsByKey,
    savingExpressionKeys,
    setSavingExpressionKeys,
    handleToggleFeedbackExpression
  } = useFeedbackSavedExpressions({ currentUser, feedbackState });

  useEffect(() => {
    setInlineRewriteY(null);
    setSavingExpressionKeys([]);
    setIsCompletionRewriteOpen(false);
    setIsModelAnswerOpen(false);
    rewriteSubmissionIdRef.current = null;
  }, [requestedDifficulty, requestedPromptId, setSavingExpressionKeys]);

  useEffect(() => {
    setRewriteDraft(
      feedbackState?.answer ??
        feedbackState?.feedback.rewriteWorkspace?.seedText ??
        ""
    );
    setRewriteError("");
    setIsCompletionRewriteOpen(false);
    setInlineRewriteY(null);
  }, [
    feedbackState?.answer,
    feedbackState?.feedback.attemptNo,
    feedbackState?.feedback.rewriteWorkspace?.seedText,
    feedbackState?.prompt.id
  ]);

  // 다시쓰기 입력은 이 기기에 임시저장한다(쓰기 화면과 같은 REWRITE 임시저장). 앱이 꺼지거나 화면을 나갔다 와도 쓰던 글을 되살린다.
  const rewriteDraftPromptId = feedbackState?.prompt.id ?? "";
  const rewriteDraftSessionId = feedbackState?.feedback.sessionId ?? "";
  const rewriteDraftSeed = feedbackState?.answer ?? "";

  useEffect(() => {
    hasEditedRewriteRef.current = false;
    setIsRewriteDraftRestored(false);
    if (!rewriteDraftPromptId || !rewriteDraftSessionId) {
      return;
    }

    let cancelled = false;
    void getLocalWritingDraft(rewriteDraftPromptId, "REWRITE")
      .catch(() => null)
      .then((draft) => {
        if (cancelled || hasEditedRewriteRef.current || !draft || draft.sessionId !== rewriteDraftSessionId) {
          return;
        }
        const restoredText = draft.rewrite.trim();
        if (restoredText && restoredText !== rewriteDraftSeed.trim()) {
          setRewriteDraft(draft.rewrite);
          setIsRewriteDraftRestored(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rewriteDraftPromptId, rewriteDraftSessionId, rewriteDraftSeed]);

  useEffect(() => {
    if (!hasEditedRewriteRef.current || !rewriteDraftPromptId || !rewriteDraftSessionId) {
      return;
    }

    const text = rewriteDraft;
    const timer = setTimeout(() => {
      if (!text.trim()) {
        void deleteLocalWritingDraft(rewriteDraftPromptId, "REWRITE").catch(() => undefined);
        return;
      }
      void saveLocalWritingDraft({
        promptId: rewriteDraftPromptId,
        draftType: "REWRITE",
        selectedDifficulty: requestedDifficulty,
        sessionId: rewriteDraftSessionId,
        answer: rewriteDraftSeed,
        rewrite: text,
        lastSubmittedAnswer: rewriteDraftSeed,
        feedback: null,
        step: "rewrite",
        updatedAt: new Date().toISOString()
      }).catch(() => undefined);
    }, 800);

    return () => clearTimeout(timer);
  }, [rewriteDraft, rewriteDraftPromptId, rewriteDraftSessionId, rewriteDraftSeed, requestedDifficulty]);

  useEffect(() => {
    if (!isCompletionRewriteOpen || inlineRewriteY == null) {
      return;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(inlineRewriteY - 12, 0),
        animated: true
      });
    });
  }, [inlineRewriteY, isCompletionRewriteOpen]);

  function handleBackToQuestions() {
    router.replace({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty: requestedDifficulty
      }
    });
  }

  function handleHeaderBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    handleBackToQuestions();
  }

  function handleOpenCompletionRewrite() {
    setInlineRewriteY(null);
    setIsCompletionRewriteOpen(true);
  }

  async function handleSubmitInlineRewrite() {
    if (!feedbackState) {
      handleBackToQuestions();
      return;
    }

    const trimmedAnswer = rewriteDraft.trim();
    if (!trimmedAnswer) {
      setRewriteError("다시 쓴 답변을 입력해 주세요.");
      return;
    }

    try {
      Keyboard.dismiss();
      setIsSubmittingRewrite(true);
      setRewriteError("");

      const resolvedUser = currentUser ?? (await refreshSession().catch(() => null));
      const guestId = resolvedUser ? undefined : await getOrCreateGuestId();
      const submissionId = rewriteSubmissionIdRef.current ?? randomUUID();
      rewriteSubmissionIdRef.current = submissionId;
      const nextFeedback = await submitFeedback({
        promptId: feedbackState.prompt.id,
        answer: trimmedAnswer,
        sessionId: feedbackState.feedback.sessionId,
        attemptType: "REWRITE",
        guestId: guestId || undefined,
        submissionId
      });
      const nextState: PracticeFeedbackState = {
        difficulty: requestedDifficulty,
        prompt: feedbackState.prompt,
        initialAnswer: feedbackState.initialAnswer ?? feedbackState.answer,
        answer: trimmedAnswer,
        feedback: nextFeedback
      };

      savePracticeFeedbackState(nextState);
      hasEditedRewriteRef.current = false;
      void deleteLocalWritingDraft(feedbackState.prompt.id, "REWRITE").catch(() => undefined);
      setFeedbackState(nextState);
      rewriteSubmissionIdRef.current = null;
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      });
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === "GUEST_LIMIT_REACHED") {
        setRewriteError(
          "게스트는 질문 1개와 다시쓰기 1회까지만 체험할 수 있어요. 이어서 학습하려면 로그인해 주세요."
        );
        // 로그인하면 이 루프와 쓰던 글을 그대로 이어받는다.
        Alert.alert(
          "로그인하고 이어서 써 보세요",
          "로그인하면 지금 쓰던 답변을 그대로 이어서 다시 쓸 수 있어요.",
          [
            { text: "나중에", style: "cancel" },
            { text: "로그인하기", onPress: () => router.push("/login") }
          ]
        );
        return;
      }

      setRewriteError(
        caughtError instanceof Error ? caughtError.message : "피드백을 생성하지 못했어요."
      );
    } finally {
      setIsSubmittingRewrite(false);
    }
  }

  async function handleFinishLoop() {
    if (!feedbackState) {
      handleBackToQuestions();
      return;
    }

    try {
      setIsFinishing(true);
      const resolvedUser = currentUser ?? (await refreshSession().catch(() => null));
      const guestId = resolvedUser ? undefined : await getOrCreateGuestId();
      await completeFeedbackSession(feedbackState.feedback.sessionId, guestId || undefined);
      const completedState = { ...feedbackState, sessionCompleted: true };
      savePracticeFeedbackState(completedState);
      setFeedbackState(completedState);
      router.push({
        pathname: "/practice/complete",
        params: {
          difficulty: requestedDifficulty,
          promptId: feedbackState.prompt.id
        }
      });
    } catch (caughtError) {
      Alert.alert(
        "완료하지 못했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.screen}>
          <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <FeedbackHeader
            handleHeaderBack={handleHeaderBack}
          />

          {isHydratingFeedbackState ? (
            <View style={styles.emptyStateCard}>
              <ActivityIndicator color="#E38B12" />
            </View>
          ) : feedbackState ? (
            <>
              <StrengthCard
                visibleStrength={visibleStrength}
              />

              <CoachMoveCard
                areAllLanguageCorrectionsVisible={areAllLanguageCorrectionsVisible}
                setAreAllLanguageCorrectionsVisible={setAreAllLanguageCorrectionsVisible}
                savedExpressionIdsByKey={savedExpressionIdsByKey}
                savingExpressionKeys={savingExpressionKeys}
                coachMove={coachMove}
                languageCorrections={languageCorrections}
                hiddenLanguageCorrectionCount={hiddenLanguageCorrectionCount}
                isLanguageFix={isLanguageFix}
                shouldShowCoachMoveCard={shouldShowCoachMoveCard}
                shouldShowCoachMoveComparison={shouldShowCoachMoveComparison}
                shouldShowCorrectionReasonLabel={shouldShowCorrectionReasonLabel}
                coachHeadline={coachHeadline}
                coachInstruction={coachInstruction}
                coachSkeleton={coachSkeleton}
                coachSkeletonKo={coachSkeletonKo}
                coachSuggestedPhrases={coachSuggestedPhrases}
                handleToggleFeedbackExpression={handleToggleFeedbackExpression}
              />

              <InlineRewriteCard
                setInlineRewriteY={setInlineRewriteY}
                rewriteSubmissionIdRef={rewriteSubmissionIdRef}
                rewriteDraft={rewriteDraft}
                setRewriteDraft={setRewriteDraft}
                isRewriteDraftRestored={isRewriteDraftRestored}
                setIsRewriteDraftRestored={setIsRewriteDraftRestored}
                hasEditedRewriteRef={hasEditedRewriteRef}
                rewriteError={rewriteError}
                setRewriteError={setRewriteError}
                isSubmittingRewrite={isSubmittingRewrite}
                rewriteWorkspace={rewriteWorkspace}
                shouldShowInlineRewriteWorkspace={shouldShowInlineRewriteWorkspace}
                inlineRewriteSubmitLabel={inlineRewriteSubmitLabel}
                inlineRewriteHelpText={inlineRewriteHelpText}
                handleSubmitInlineRewrite={handleSubmitInlineRewrite}
              />

              <CompletionFooter
                isCompletionRewriteOpen={isCompletionRewriteOpen}
                isModelAnswerOpen={isModelAnswerOpen}
                setIsModelAnswerOpen={setIsModelAnswerOpen}
                isFinishing={isFinishing}
                savedExpressionIdsByKey={savedExpressionIdsByKey}
                savingExpressionKeys={savingExpressionKeys}
                isLoopReadyToFinish={isLoopReadyToFinish}
                completionRefinementPhrases={completionRefinementPhrases}
                enrichment={enrichment}
                hasEnrichment={hasEnrichment}
                enrichmentPhrases={enrichmentPhrases}
                isSessionCompleted={isSessionCompleted}
                shouldShowCompletionRewriteChoice={shouldShowCompletionRewriteChoice}
                rewriteButtonLabel={rewriteButtonLabel}
                finishButtonLabel={finishButtonLabel}
                shouldShowCompletionFooter={shouldShowCompletionFooter}
                completionHeadline={completionHeadline}
                modelAnswer={modelAnswer}
                modelAnswerKo={modelAnswerKo}
                handleToggleFeedbackExpression={handleToggleFeedbackExpression}
                handleOpenCompletionRewrite={handleOpenCompletionRewrite}
                handleFinishLoop={handleFinishLoop}
              />
            </>
          ) : (
            <FeedbackEmptyState
              handleBackToQuestions={handleBackToQuestions}
            />
          )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <FeedbackLoadingOverlay
        visible={isSubmittingRewrite}
        title={REWRITE_FEEDBACK_LOADING_STAGES[0]?.title ?? "피드백을 만들고 있어요"}
        message={
          REWRITE_FEEDBACK_LOADING_STAGES[0]?.message ??
          "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."
        }
        stages={REWRITE_FEEDBACK_LOADING_STAGES}
      />
    </SafeAreaView>
  );
}
