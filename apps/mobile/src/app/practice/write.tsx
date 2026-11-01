import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedbackLoadingOverlay, {
  INITIAL_FEEDBACK_LOADING_STAGES,
  REWRITE_FEEDBACK_LOADING_STAGES
} from "@/components/feedback-loading-overlay";
import {
  CoachModal,
  ComposerCard,
  GuideModal,
  PreviousFeedbackModal,
  PromptSummaryCard,
  WriteEmptyState,
  WriteHeader
} from "@/components/practice-write/write-sections";
import { styles } from "@/components/practice-write/write-styles";
import {
  getPromptNotFoundMessage,
  type WritingGuideHintCard,
  getWritingGuide,
  countWords,
  normalizeExpressionKey,
  isLikelyCompletePracticeExpression,
  parsePracticeExpressionsParam,
  formatDraftSavedAt,
  toDraftStatusBadgeLabel,
  pickFirstNonEmpty
} from "@/components/practice-write/write-helpers";
import { useWriteCoach } from "@/components/practice-write/use-write-coach";
import {
  ApiError,
  deleteWritingDraft,
  getDailyPrompts,
  getPromptHints,
  getPrompts,
  getWritingDraft,
  saveWritingDraft,
  submitFeedback
} from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import {
  buildIncompleteLoopPromptSnapshot,
  clearIncompleteLoopForPrompt,
  saveIncompleteLoop,
  type IncompleteLoopStep
} from "@/lib/incomplete-loop";
import {
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState
} from "@/lib/practice-feedback-state";
import {
  buildDistinctCategoryPromptSelection,
  isDailyDifficulty,
  isPromptCompatibleWithDailyDifficulty,
  resolvePracticeDifficulty
} from "@/lib/practice";
import { getPromptHintMeaningFallback } from "@/lib/prompt-hint-meanings";
import { useSession } from "@/lib/session";
import {
  deleteLocalWritingDraft,
  getLocalWritingDraft,
  saveLocalWritingDraft
} from "@/lib/writing-drafts";
import type {
  DailyDifficulty,
  DailyPromptRecommendation,
  Feedback,
  Prompt,
  PromptHint,
  SaveWritingDraftRequest,
  WritingDraft,
  WritingDraftType
} from "@/lib/types";

export default function PracticeWriteScreen() {
  const params = useLocalSearchParams<{
    difficulty?: string;
    promptId?: string;
    mode?: string;
    resume?: string;
    prefillExpression?: string;
    practiceTag?: string;
    practiceTagLabel?: string;
    practiceExpressions?: string;
  }>();
  const navigation = useNavigation();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "I";
  const requestedPromptId = typeof params.promptId === "string" ? params.promptId : "";
  const isRewriteMode = params.mode === "rewrite";
  const shouldRestoreRewriteDraft = params.resume === "1";
  const prefillExpression =
    typeof params.prefillExpression === "string" ? params.prefillExpression.trim() : "";
  const practiceTagLabel =
    typeof params.practiceTagLabel === "string" ? params.practiceTagLabel.trim() : "";
  const practiceExpressions = useMemo(() => {
    const parsedExpressions = parsePracticeExpressionsParam(params.practiceExpressions);
    const dedupedExpressions = new Set<string>();
    const expressions: string[] = [];

    const prioritizedExpressions =
      parsedExpressions.length > 0 ? parsedExpressions : prefillExpression ? [prefillExpression] : [];

    prioritizedExpressions.forEach((expression) => {
      if (!isLikelyCompletePracticeExpression(expression)) {
        return;
      }

      const normalized = normalizeExpressionKey(expression);
      if (!normalized || dedupedExpressions.has(normalized)) {
        return;
      }

      dedupedExpressions.add(normalized);
      expressions.push(expression.trim());
    });

    return expressions;
  }, [params.practiceExpressions, prefillExpression]);
  const primaryPracticeExpression = practiceExpressions[0] ?? prefillExpression;
  const { currentUser, isHydrating: isSessionHydrating, refreshSession } = useSession();
  const isFocused = useIsFocused();

  const [recommendation, setRecommendation] = useState<DailyPromptRecommendation | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isPreviousFeedbackOpen, setIsPreviousFeedbackOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 작문 취소가 도는 동안(진행 중인 저장과 지우기를 기다리는 동안) 버튼·답 칸·코치 넣기를 막는다.
  // 다시 그리기 전에 들어온 누르기도 막으려고 ref로도 둔다.
  const [isCancellingWriting, setIsCancellingWriting] = useState(false);
  const isCancellingWritingRef = useRef(false);
  const [promptHints, setPromptHints] = useState<PromptHint[]>([]);
  const [isLoadingPromptHints, setIsLoadingPromptHints] = useState(false);
  const [rewriteSeedAnswer, setRewriteSeedAnswer] = useState("");
  const [initialAnswer, setInitialAnswer] = useState("");
  const [latestFeedbackAnswer, setLatestFeedbackAnswer] = useState("");
  const [draftStatusMessage, setDraftStatusMessage] = useState("");
  const [isDraftPersistencePaused, setIsDraftPersistencePaused] = useState(false);
  const [error, setError] = useState("");
  const latestAnswerRef = useRef("");
  const latestSelectedPromptRef = useRef<Prompt | null>(null);
  const draftAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftSavesRef = useRef(new Set<Promise<void>>());
  const pendingSubmissionRef = useRef<{ answer: string; submissionId: string } | null>(null);

  const selectedPrompt = useMemo(() => {
    const prompts = recommendation?.prompts ?? [];
    return prompts.find((prompt) => prompt.id === requestedPromptId) ?? null;
  }, [recommendation?.prompts, requestedPromptId]);

  const {
    coachQuestion,
    setCoachQuestion,
    coachHelp,
    setCoachHelp,
    coachHelpError,
    setCoachHelpError,
    isLoadingCoachHelp,
    savedCoachExpressionKeys,
    setSavedCoachExpressionKeys,
    savingCoachExpressionKeys,
    setSavingCoachExpressionKeys,
    coachQuickQuestions,
    handleSaveCoachExpression,
    handleRequestCoachHelp
  } = useWriteCoach({
    currentUser,
    selectedPrompt,
    feedback,
    answer,
    setError,
    setIsCoachOpen
  });

  const vocabularyWordHintItems = useMemo<WritingGuideHintCard[]>(
    () =>
      promptHints
        .filter((hint) => hint.hintType === "VOCAB_WORD")
        .flatMap((hint) =>
          (hint.items ?? [])
            .filter((item) => item.content.trim().length > 0)
            .map((item) => ({
              id: item.id,
              content: item.content,
              meaningKo: item.meaningKo?.trim() || getPromptHintMeaningFallback(item.content)
            }))
        ),
    [promptHints]
  );
  const vocabularyPhraseHintItems = useMemo<WritingGuideHintCard[]>(
    () =>
      promptHints
        .filter((hint) => hint.hintType === "VOCAB_PHRASE")
        .flatMap((hint) =>
          (hint.items ?? [])
            .filter((item) => item.content.trim().length > 0)
            .map((item) => ({
              id: item.id,
              content: item.content,
              meaningKo: item.meaningKo?.trim() || getPromptHintMeaningFallback(item.content)
            }))
        ),
    [promptHints]
  );
  const starterHint = useMemo(
    () =>
      promptHints
        .filter((hint) => hint.hintType === "STARTER")
        .flatMap((hint) => hint.items ?? [])
        .map((item) => item.content.trim())
        .find((content) => content.length > 0) ?? null,
    [promptHints]
  );
  const answerGuide = useMemo(
    () => getWritingGuide(resolvePracticeDifficulty(requestedDifficulty, selectedPrompt?.difficulty), starterHint),
    [requestedDifficulty, selectedPrompt?.difficulty, starterHint]
  );

  const activeDraftType: WritingDraftType = isRewriteMode ? "REWRITE" : "ANSWER";
  const answerWordCount = useMemo(() => countWords(answer), [answer]);
  const draftStatusBadgeLabel = useMemo(
    () => (draftStatusMessage ? toDraftStatusBadgeLabel(draftStatusMessage) : ""),
    [draftStatusMessage]
  );
  const feedbackLoadingStages = feedback
    ? REWRITE_FEEDBACK_LOADING_STAGES
    : INITIAL_FEEDBACK_LOADING_STAGES;
  const previousFeedbackState = useMemo(() => {
    if (!selectedPrompt || !feedback || !rewriteSeedAnswer.trim()) {
      return null;
    }

    return {
      difficulty: requestedDifficulty,
      prompt: selectedPrompt,
      initialAnswer: pickFirstNonEmpty(initialAnswer, rewriteSeedAnswer),
      answer: rewriteSeedAnswer,
      feedback
    };
  }, [feedback, initialAnswer, requestedDifficulty, rewriteSeedAnswer, selectedPrompt]);
  const normalizedCurrentAnswer = useMemo(() => answer.trim(), [answer]);
  const normalizedLatestFeedbackAnswer = useMemo(() => latestFeedbackAnswer.trim(), [latestFeedbackAnswer]);
  const canViewLatestFeedback = useMemo(
    () =>
      Boolean(
        feedback &&
          normalizedCurrentAnswer &&
          normalizedCurrentAnswer === normalizedLatestFeedbackAnswer
      ),
    [feedback, normalizedCurrentAnswer, normalizedLatestFeedbackAnswer]
  );
  const isAnswerLocked = canViewLatestFeedback;
  const feedbackReferenceLabel = canViewLatestFeedback ? "피드백 보기" : "이전 피드백 보기";
  const rewriteCoachTitle = pickFirstNonEmpty(
    feedback?.coachMove?.focus,
    feedback?.loop?.headline,
    "이번엔 한 가지만 적용해 봐요"
  );
  const rewriteCoachBody = pickFirstNonEmpty(
    feedback?.coachMove?.instruction,
    feedback?.completionMessage,
    feedback?.summary,
    "방금 받은 피드백을 반영해 다시 써 보세요."
  );
  const primaryActionLabel = canViewLatestFeedback
    ? "피드백 보기"
    : feedback
      ? "다시 쓴 답변 제출하기"
      : "피드백 받기";
  const resolveFeedbackGuestId = useCallback(async () => {
    const resolvedUser = currentUser ?? (await refreshSession().catch(() => null));
    return resolvedUser ? undefined : (await getOrCreateGuestId()) || undefined;
  }, [currentUser, refreshSession]);

  const loadPrompt = useCallback(async () => {
    if (isSessionHydrating) {
      return;
    }

    if (!requestedPromptId) {
      setError(getPromptNotFoundMessage());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const guestId = await resolveFeedbackGuestId();
      const nextRecommendation = await getDailyPrompts(requestedDifficulty, guestId);
      let sameDifficultyPromptPool: Prompt[] | null = null;
      let nextPrompt = nextRecommendation.prompts.find((prompt) => prompt.id === requestedPromptId) ?? null;

      if (!nextPrompt) {
        const promptPool = await getPrompts();
        sameDifficultyPromptPool = promptPool.filter((prompt) =>
          isPromptCompatibleWithDailyDifficulty(prompt.difficulty, requestedDifficulty)
        );
        nextPrompt =
          sameDifficultyPromptPool.find((prompt) => prompt.id === requestedPromptId) ?? null;
      }

      const savedFeedbackState =
        getPracticeFeedbackState(requestedDifficulty, requestedPromptId) ??
        (await hydratePracticeFeedbackState(requestedDifficulty, requestedPromptId));
      const fallbackPromptPool = sameDifficultyPromptPool ?? nextRecommendation.prompts;
      const primaryPromptCandidates = nextPrompt
        ? [nextPrompt, ...nextRecommendation.prompts]
        : nextRecommendation.prompts;
      const desiredPromptCount = Math.min(
        3,
        Math.max(primaryPromptCandidates.length, fallbackPromptPool.length)
      );
      const normalizedRecommendation = {
        ...nextRecommendation,
        prompts: buildDistinctCategoryPromptSelection(
          primaryPromptCandidates,
          fallbackPromptPool,
          desiredPromptCount
        )
      };

      let restoredAnswer = isRewriteMode ? savedFeedbackState?.answer ?? "" : "";
      let restoredDraftStatusMessage = "";

      try {
        let restoredDraft: WritingDraft | null = null;

        if (currentUser) {
          restoredDraft = await getWritingDraft(requestedPromptId, activeDraftType);
        }

        if (!restoredDraft) {
          restoredDraft = await getLocalWritingDraft(requestedPromptId, activeDraftType);
        }

        if (restoredDraft && (!isRewriteMode || shouldRestoreRewriteDraft)) {
          restoredAnswer =
            activeDraftType === "REWRITE"
              ? restoredDraft.rewrite || restoredDraft.answer
              : restoredDraft.answer;
          restoredDraftStatusMessage =
            currentUser && restoredDraft.updatedAt
              ? `임시저장됨 · ${formatDraftSavedAt(restoredDraft.updatedAt)}`
              : "이 기기에 임시저장됨";
        } else if (restoredDraft && isRewriteMode && !shouldRestoreRewriteDraft) {
          try {
            if (currentUser) {
              await deleteWritingDraft(requestedPromptId, "REWRITE");
            }
          } catch {
            // Ignore server cleanup failures and still clear any local fallback.
          }

          try {
            await deleteLocalWritingDraft(requestedPromptId, "REWRITE");
          } catch {
            // Ignore local cleanup failures as well.
          }
        }
      } catch {
        restoredDraftStatusMessage = "";
      }

      if (!isRewriteMode && primaryPracticeExpression) {
        restoredAnswer = primaryPracticeExpression;
        restoredDraftStatusMessage = "";
      }

      latestAnswerRef.current = restoredAnswer;
      latestSelectedPromptRef.current = nextPrompt;
      setRecommendation(normalizedRecommendation);
      setFeedback(isRewriteMode ? savedFeedbackState?.feedback ?? null : null);
      setInitialAnswer(savedFeedbackState?.initialAnswer ?? savedFeedbackState?.answer ?? "");
      setRewriteSeedAnswer(savedFeedbackState?.answer ?? "");
      setLatestFeedbackAnswer("");
      setAnswer(restoredAnswer);
      setDraftStatusMessage(restoredDraftStatusMessage);
      setIsDraftPersistencePaused(false);
      setIsTranslationVisible(false);
      setIsGuideOpen(false);
      setIsCoachOpen(false);
      setIsPreviousFeedbackOpen(false);
      setCoachQuestion("");
      setCoachHelp(null);
      setCoachHelpError("");

      if (!nextPrompt) {
        setError(getPromptNotFoundMessage());
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeDraftType,
    currentUser,
    isSessionHydrating,
    isRewriteMode,
    primaryPracticeExpression,
    requestedDifficulty,
    requestedPromptId,
    resolveFeedbackGuestId,
    setCoachHelp,
    setCoachHelpError,
    setCoachQuestion,
    shouldRestoreRewriteDraft
  ]);

  useEffect(() => {
    void loadPrompt();
  }, [loadPrompt]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedPromptHints() {
      if (!selectedPrompt) {
        setPromptHints([]);
        setIsLoadingPromptHints(false);
        return;
      }

      try {
        setIsLoadingPromptHints(true);
        setPromptHints([]);
        const nextHints = await getPromptHints(selectedPrompt.id);
        if (!cancelled) {
          setPromptHints(nextHints);
        }
      } catch {
        if (!cancelled) {
          setPromptHints([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPromptHints(false);
        }
      }
    }

    void loadSelectedPromptHints();

    return () => {
      cancelled = true;
    };
  }, [selectedPrompt]);

  useEffect(() => {
    setSavedCoachExpressionKeys([]);
    setSavingCoachExpressionKeys([]);
  }, [selectedPrompt?.id, setSavedCoachExpressionKeys, setSavingCoachExpressionKeys]);

  async function handleSubmit() {
    if (isCancellingWritingRef.current) {
      return;
    }

    if (!selectedPrompt) {
      setError(getPromptNotFoundMessage());
      return;
    }

    if (!answer.trim()) {
      setError("영어 답안을 입력해 주세요.");
      return;
    }

    try {
      Keyboard.dismiss();
      setIsSubmitting(true);
      setError("");
      const trimmedAnswer = answer.trim();
      const guestId = await resolveFeedbackGuestId();
      const pendingSubmission =
        pendingSubmissionRef.current?.answer === trimmedAnswer
          ? pendingSubmissionRef.current
          : {
              answer: trimmedAnswer,
              submissionId: randomUUID()
            };
      pendingSubmissionRef.current = pendingSubmission;
      const nextFeedback = await submitFeedback({
        promptId: selectedPrompt.id,
        answer: trimmedAnswer,
        sessionId: feedback?.sessionId,
        attemptType: feedback ? "REWRITE" : "INITIAL",
        guestId: guestId || undefined,
        submissionId: pendingSubmission.submissionId
      });

      savePracticeFeedbackState({
        difficulty: requestedDifficulty,
        prompt: selectedPrompt,
        initialAnswer: feedback ? pickFirstNonEmpty(initialAnswer, rewriteSeedAnswer, trimmedAnswer) : trimmedAnswer,
        answer: trimmedAnswer,
        feedback: nextFeedback
      });
      setIsDraftPersistencePaused(true);
      cancelDraftAutosave();
      await waitForPendingDraftSaves();
      await clearPersistedDraft(selectedPrompt.id, activeDraftType);
      setDraftStatusMessage("");
      setFeedback(nextFeedback);
      pendingSubmissionRef.current = null;
      setInitialAnswer(feedback ? pickFirstNonEmpty(initialAnswer, rewriteSeedAnswer, trimmedAnswer) : trimmedAnswer);
      setRewriteSeedAnswer(trimmedAnswer);
      setLatestFeedbackAnswer(trimmedAnswer);
      await saveIncompleteLoopSnapshot("feedback", selectedPrompt, new Date().toISOString(), {
        sessionId: nextFeedback.sessionId
      });
      router.push({
        pathname: "/practice/feedback",
        params: {
          difficulty: requestedDifficulty,
          promptId: selectedPrompt.id
        }
      });
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === "GUEST_LIMIT_REACHED") {
        setError(
          "게스트는 질문 1개와 다시쓰기 1회까지만 체험할 수 있어요. 이어서 학습하려면 로그인해 주세요."
        );
        // 로그인하면 이 루프와 쓰던 글을 그대로 이어받는다.
        Alert.alert(
          "로그인하고 이어서 써 보세요",
          "로그인하면 지금 쓰던 답변을 그대로 이어서 쓸 수 있어요.",
          [
            { text: "나중에", style: "cancel" },
            { text: "로그인하기", onPress: () => router.push("/login") }
          ]
        );
        return;
      }

      setError(caughtError instanceof Error ? caughtError.message : "피드백을 생성하지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenLatestFeedback() {
    if (!selectedPrompt || !feedback) {
      setError(getPromptNotFoundMessage());
      return;
    }

    router.push({
      pathname: "/practice/feedback",
      params: {
        difficulty: requestedDifficulty,
        promptId: selectedPrompt.id
      }
    });
  }

  function appendCoachExpression(expression: string) {
    if (isCancellingWritingRef.current) {
      return;
    }

    setIsDraftPersistencePaused(false);
    setAnswer((current) => {
      if (!current.trim()) {
        return expression;
      }

      return /\s$/.test(current) ? `${current}${expression}` : `${current} ${expression}`;
    });
  }

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

  const clearPersistedDraft = useCallback(
    async (promptId: string, draftType: WritingDraftType) => {
      try {
        if (currentUser) {
          await deleteWritingDraft(promptId, draftType);
        }
      } catch {
        // Ignore server cleanup failures and still clear any local fallback.
      }

      try {
        await deleteLocalWritingDraft(promptId, draftType);
      } catch {
        // Ignore local cleanup failures as well.
      }
    },
    [currentUser]
  );

  const cancelDraftAutosave = useCallback(() => {
    if (draftAutosaveTimeoutRef.current) {
      clearTimeout(draftAutosaveTimeoutRef.current);
      draftAutosaveTimeoutRef.current = null;
    }
  }, []);

  // 진행 중인 임시저장(서버·이 기기 초안, 이어 쓰기 상태)을 모아 둔다.
  // 작문 취소·제출은 이 저장이 끝난 뒤 지워야, 늦게 끝난 저장이 지운 것을 다시 남기지 않는다.
  const trackDraftSave = useCallback((save: Promise<void>) => {
    const tracked = save
      .catch(() => undefined)
      .finally(() => {
        pendingDraftSavesRef.current.delete(tracked);
      });
    pendingDraftSavesRef.current.add(tracked);
    return tracked;
  }, []);

  const waitForPendingDraftSaves = useCallback(async () => {
    while (pendingDraftSavesRef.current.size > 0) {
      await Promise.all(pendingDraftSavesRef.current);
    }
  }, []);

  async function cancelCurrentWriting() {
    if (!selectedPrompt) {
      handleBackToQuestions();
      return;
    }

    if (isCancellingWritingRef.current) {
      return;
    }

    // 질문 목록으로 돌아가면 이 화면이 사라지므로 다시 풀지 않는다.
    isCancellingWritingRef.current = true;
    setIsCancellingWriting(true);
    setIsDraftPersistencePaused(true);
    cancelDraftAutosave();
    Keyboard.dismiss();

    try {
      await waitForPendingDraftSaves();
      await clearPersistedDraft(selectedPrompt.id, activeDraftType);
      await clearIncompleteLoopForPrompt(selectedPrompt.id);
    } finally {
      latestAnswerRef.current = "";
      setAnswer("");
      setDraftStatusMessage("");
      handleBackToQuestions();
    }
  }

  function handleCancelWriting() {
    if (isCancellingWritingRef.current) {
      return;
    }

    if (!selectedPrompt) {
      handleBackToQuestions();
      return;
    }

    if (!answer.trim() && !draftStatusMessage && !feedback) {
      void cancelCurrentWriting();
      return;
    }

    Alert.alert(
      "작문을 취소할까요?",
      "작성 중인 내용과 임시저장이 삭제되고 질문 목록으로 돌아가요.",
      [
        { text: "계속 쓰기", style: "cancel" },
        {
          text: "작문 취소",
          style: "destructive",
          onPress: () => void cancelCurrentWriting()
        }
      ]
    );
  }

  const buildDraftPayload = useCallback(
    (currentText: string): SaveWritingDraftRequest => ({
      draftType: activeDraftType,
      selectedDifficulty: requestedDifficulty,
      sessionId: feedback?.sessionId ?? "",
      answer: activeDraftType === "REWRITE" ? rewriteSeedAnswer : currentText,
      rewrite: activeDraftType === "REWRITE" ? currentText : "",
      lastSubmittedAnswer: activeDraftType === "REWRITE" ? rewriteSeedAnswer : "",
      feedback: null,
      step: activeDraftType === "REWRITE" ? "rewrite" : "answer"
    }),
    [activeDraftType, feedback?.sessionId, requestedDifficulty, rewriteSeedAnswer]
  );

  const saveIncompleteLoopSnapshot = useCallback(
    async (
      step: IncompleteLoopStep,
      prompt: Prompt,
      updatedAt: string,
      options?: {
        draftType?: WritingDraftType | null;
        sessionId?: string | null;
      }
    ) => {
      await saveIncompleteLoop({
        promptId: prompt.id,
        difficulty: requestedDifficulty,
        step,
        draftType: options?.draftType ?? null,
        sessionId: options?.sessionId ?? feedback?.sessionId ?? undefined,
        updatedAt,
        promptSnapshot: buildIncompleteLoopPromptSnapshot(prompt)
      });
    },
    [feedback?.sessionId, requestedDifficulty]
  );

  const persistDraftSnapshot = useCallback(
    async (draftText: string, prompt: Prompt | null, allowUiUpdate = true) => {
      if (isDraftPersistencePaused || isLoading || isSubmitting || !prompt) {
        return;
      }

      const updateDraftStatus = (message: string) => {
        if (allowUiUpdate) {
          setDraftStatusMessage(message);
        }
      };

      if (!draftText.trim()) {
        cancelDraftAutosave();
        await clearPersistedDraft(prompt.id, activeDraftType);
        if (activeDraftType === "REWRITE" && feedback) {
          await saveIncompleteLoopSnapshot("feedback", prompt, new Date().toISOString(), {
            sessionId: feedback.sessionId
          });
        } else {
          await clearIncompleteLoopForPrompt(
            prompt.id,
            activeDraftType === "REWRITE" ? "rewrite" : "answer"
          );
        }
        updateDraftStatus("");
        return;
      }

      const draftPayload = buildDraftPayload(draftText);

      try {
        if (currentUser) {
          const savedDraft = await saveWritingDraft(prompt.id, draftPayload);
          await deleteLocalWritingDraft(prompt.id, activeDraftType);
          await saveIncompleteLoopSnapshot(
            activeDraftType === "REWRITE" ? "rewrite" : "answer",
            prompt,
            savedDraft.updatedAt,
            {
              draftType: activeDraftType,
              sessionId: draftPayload.sessionId
            }
          );
          updateDraftStatus(`??? ? ${formatDraftSavedAt(savedDraft.updatedAt)}`);
          return;
        }

        const localUpdatedAt = new Date().toISOString();
        await saveLocalWritingDraft({
          promptId: prompt.id,
          updatedAt: localUpdatedAt,
          ...draftPayload
        });
        await saveIncompleteLoopSnapshot(
          activeDraftType === "REWRITE" ? "rewrite" : "answer",
          prompt,
          localUpdatedAt,
          {
            draftType: activeDraftType,
            sessionId: draftPayload.sessionId
          }
        );
        updateDraftStatus("? ??? ???");
      } catch {
        try {
          const localUpdatedAt = new Date().toISOString();
          await saveLocalWritingDraft({
            promptId: prompt.id,
            updatedAt: localUpdatedAt,
            ...draftPayload
          });
          await saveIncompleteLoopSnapshot(
            activeDraftType === "REWRITE" ? "rewrite" : "answer",
            prompt,
            localUpdatedAt,
            {
              draftType: activeDraftType,
              sessionId: draftPayload.sessionId
            }
          );
          updateDraftStatus(
            currentUser ? "Server sync failed, but the draft was saved on this device." : "? ??? ???"
          );
        } catch {
          updateDraftStatus(
            currentUser ? "??? ???." : "? ??? ?? ? ??."
          );
        }
      }
    },
    [
      activeDraftType,
      buildDraftPayload,
      clearPersistedDraft,
      feedback,
      saveIncompleteLoopSnapshot,
      cancelDraftAutosave,
      currentUser,
      isDraftPersistencePaused,
      isLoading,
      isSubmitting
    ]
  );

  const flushPendingDraft = useCallback(async () => {
    cancelDraftAutosave();
    await trackDraftSave(persistDraftSnapshot(latestAnswerRef.current, latestSelectedPromptRef.current, false));
  }, [cancelDraftAutosave, persistDraftSnapshot, trackDraftSave]);

  useEffect(() => {
    latestAnswerRef.current = answer;
    latestSelectedPromptRef.current = selectedPrompt;
  }, [answer, selectedPrompt]);

  useEffect(() => {
    if (!isFocused || isDraftPersistencePaused || isLoading || isSubmitting || !selectedPrompt) {
      return;
    }

    let cancelled = false;
    cancelDraftAutosave();
    const timeoutId = setTimeout(() => {
      const persist = async () => {
        if (!answer.trim()) {
          await clearPersistedDraft(selectedPrompt.id, activeDraftType);
          if (activeDraftType === "REWRITE" && feedback) {
            await saveIncompleteLoopSnapshot("feedback", selectedPrompt, new Date().toISOString(), {
              sessionId: feedback.sessionId
            });
          } else {
            await clearIncompleteLoopForPrompt(
              selectedPrompt.id,
              activeDraftType === "REWRITE" ? "rewrite" : "answer"
            );
          }
          if (!cancelled) {
            setDraftStatusMessage("");
          }
          return;
        }

        const draftPayload = buildDraftPayload(answer);

        try {
          if (currentUser) {
            const savedDraft = await saveWritingDraft(selectedPrompt.id, draftPayload);
            await deleteLocalWritingDraft(selectedPrompt.id, activeDraftType);
            await saveIncompleteLoopSnapshot(
              activeDraftType === "REWRITE" ? "rewrite" : "answer",
              selectedPrompt,
              savedDraft.updatedAt,
              {
                draftType: activeDraftType,
                sessionId: draftPayload.sessionId
              }
            );
            if (!cancelled) {
              setDraftStatusMessage(`임시저장됨 · ${formatDraftSavedAt(savedDraft.updatedAt)}`);
            }
            return;
          }

          const localUpdatedAt = new Date().toISOString();
          await saveLocalWritingDraft({
            promptId: selectedPrompt.id,
            updatedAt: localUpdatedAt,
            ...draftPayload
          });
          await saveIncompleteLoopSnapshot(
            activeDraftType === "REWRITE" ? "rewrite" : "answer",
            selectedPrompt,
            localUpdatedAt,
            {
              draftType: activeDraftType,
              sessionId: draftPayload.sessionId
            }
          );
          if (!cancelled) {
            setDraftStatusMessage("이 기기에 임시저장됨");
          }
        } catch {
          try {
            const localUpdatedAt = new Date().toISOString();
            await saveLocalWritingDraft({
              promptId: selectedPrompt.id,
              updatedAt: localUpdatedAt,
              ...draftPayload
            });
            await saveIncompleteLoopSnapshot(
              activeDraftType === "REWRITE" ? "rewrite" : "answer",
              selectedPrompt,
              localUpdatedAt,
              {
                draftType: activeDraftType,
                sessionId: draftPayload.sessionId
              }
            );
            if (!cancelled) {
              setDraftStatusMessage(
                currentUser ? "서버 저장이 불안정해 이 기기에 임시저장했어요." : "이 기기에 임시저장됨"
              );
            }
          } catch {
            if (!cancelled) {
              setDraftStatusMessage(
                currentUser ? "임시저장에 실패했어요." : "이 기기에 임시저장하지 못했어요."
              );
            }
          }
        }
      };

      void trackDraftSave(persist());
    }, 900);
    draftAutosaveTimeoutRef.current = timeoutId;

    return () => {
      cancelled = true;
      if (draftAutosaveTimeoutRef.current === timeoutId) {
        draftAutosaveTimeoutRef.current = null;
      }
      clearTimeout(timeoutId);
    };
  }, [
    activeDraftType,
    answer,
    buildDraftPayload,
    clearPersistedDraft,
    cancelDraftAutosave,
    currentUser,
    feedback,
    isDraftPersistencePaused,
    isFocused,
    isLoading,
    isSubmitting,
    requestedDifficulty,
    rewriteSeedAnswer,
    saveIncompleteLoopSnapshot,
    selectedPrompt,
    trackDraftSave
  ]);

  // 화면을 떠날 때(언마운트) 한 번만, 그때의 최신 저장 함수로 쓰던 답을 저장한다.
  // 저장 함수가 바뀔 때마다 돌게 두면 작문 취소·제출 직후 정리 단계에서 옛 함수가 쓰던 답을 다시 저장한다.
  const flushPendingDraftRef = useRef(flushPendingDraft);
  useEffect(() => {
    flushPendingDraftRef.current = flushPendingDraft;
  }, [flushPendingDraft]);
  const flushLatestPendingDraft = useCallback(() => flushPendingDraftRef.current(), []);

  useEffect(() => {
    return () => {
      void flushLatestPendingDraft();
    };
  }, [flushLatestPendingDraft]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") {
        void flushPendingDraft();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [flushPendingDraft]);

  const handleAnswerChange = useCallback((nextValue: string) => {
    if (isCancellingWritingRef.current) {
      return;
    }

    setIsDraftPersistencePaused(false);
    latestAnswerRef.current = nextValue;
    setAnswer(nextValue);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <WriteHeader
            handleHeaderBack={handleHeaderBack}
          />

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#E38B12" />
            </View>
          ) : selectedPrompt ? (
            <>
              <View style={styles.practiceFlowCard}>
                <PromptSummaryCard
                  feedback={feedback}
                  feedbackReferenceLabel={feedbackReferenceLabel}
                  isTranslationVisible={isTranslationVisible}
                  practiceExpressions={practiceExpressions}
                  practiceTagLabel={practiceTagLabel}
                  selectedPrompt={selectedPrompt}
                  setIsGuideOpen={setIsGuideOpen}
                  setIsPreviousFeedbackOpen={setIsPreviousFeedbackOpen}
                  setIsTranslationVisible={setIsTranslationVisible}
                />

                <View style={styles.practiceFlowDivider} />

                <ComposerCard
                  answer={answer}
                  answerWordCount={answerWordCount}
                  canViewLatestFeedback={canViewLatestFeedback}
                  draftStatusBadgeLabel={draftStatusBadgeLabel}
                  draftStatusMessage={draftStatusMessage}
                  error={error}
                  feedback={feedback}
                  feedbackReferenceLabel={feedbackReferenceLabel}
                  handleAnswerChange={handleAnswerChange}
                  handleCancelWriting={handleCancelWriting}
                  handleOpenLatestFeedback={handleOpenLatestFeedback}
                  handleSubmit={handleSubmit}
                  isAnswerLocked={isAnswerLocked}
                  isCancellingWriting={isCancellingWriting}
                  isCoachOpen={isCoachOpen}
                  isSubmitting={isSubmitting}
                  primaryActionLabel={primaryActionLabel}
                  rewriteCoachBody={rewriteCoachBody}
                  rewriteCoachTitle={rewriteCoachTitle}
                  setIsCoachOpen={setIsCoachOpen}
                  setIsGuideOpen={setIsGuideOpen}
                  setIsPreviousFeedbackOpen={setIsPreviousFeedbackOpen}
                />
              </View>
            </>
          ) : (
            <WriteEmptyState
              handleBackToQuestions={handleBackToQuestions}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <FeedbackLoadingOverlay
        visible={isSubmitting}
        title={feedbackLoadingStages[0]?.title ?? "피드백을 만들고 있어요"}
        message={
          feedbackLoadingStages[0]?.message ??
          "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."
        }
        stages={feedbackLoadingStages}
      />

      <PreviousFeedbackModal
        feedbackReferenceLabel={feedbackReferenceLabel}
        isPreviousFeedbackOpen={isPreviousFeedbackOpen}
        previousFeedbackState={previousFeedbackState}
        setIsPreviousFeedbackOpen={setIsPreviousFeedbackOpen}
      />

      <GuideModal
        answerGuide={answerGuide}
        isGuideOpen={isGuideOpen}
        isLoadingPromptHints={isLoadingPromptHints}
        setIsGuideOpen={setIsGuideOpen}
        vocabularyPhraseHintItems={vocabularyPhraseHintItems}
        vocabularyWordHintItems={vocabularyWordHintItems}
      />

      <CoachModal
        appendCoachExpression={appendCoachExpression}
        coachHelp={coachHelp}
        coachHelpError={coachHelpError}
        coachQuestion={coachQuestion}
        coachQuickQuestions={coachQuickQuestions}
        handleRequestCoachHelp={handleRequestCoachHelp}
        handleSaveCoachExpression={handleSaveCoachExpression}
        isCoachOpen={isCoachOpen}
        isLoadingCoachHelp={isLoadingCoachHelp}
        savedCoachExpressionKeys={savedCoachExpressionKeys}
        savingCoachExpressionKeys={savingCoachExpressionKeys}
        setCoachHelp={setCoachHelp}
        setCoachHelpError={setCoachHelpError}
        setCoachQuestion={setCoachQuestion}
        setIsCoachOpen={setIsCoachOpen}
      />
    </SafeAreaView>
  );
}
