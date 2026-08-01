import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { randomUUID } from "expo-crypto";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedbackLoadingOverlay, {
  REWRITE_FEEDBACK_LOADING_STAGES
} from "@/components/feedback-loading-overlay";
import {
  ApiError,
  completeFeedbackSession,
  deleteSavedExpression,
  getSavedExpressions,
  saveExpression,
  submitFeedback
} from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import { getFeedbackSlotUiCopy } from "@/lib/feedback-slot-ui";
import {
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { isDailyDifficulty } from "@/lib/practice";
import { useSession } from "@/lib/session";
import type {
  DailyDifficulty,
  FeedbackCoachMove,
  RefinementExpression,
  SavedExpressionSourceType
} from "@/lib/types";

const completionMascotImage = require("@/assets/images/feedback-completion-mascot.png");
const COACH_MOVE_DIFF_MAX_CHARS = 700;
const COACH_MOVE_DIFF_MAX_TOKENS = 140;
const REWRITE_FEEDBACK_BUTTON_LABEL = "다시 피드백 받아보기";
const REWRITE_OPEN_BUTTON_LABEL = "다시 다듬어 보기";
const COMPLETION_READY_HEADLINE = "좋아요! 원하면 표현 하나만 더해 보세요.";

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeSuggestedPhrase(value: unknown) {
  if (typeof value === "string") {
    const phrase = trimText(value);
    return phrase ? { phrase, meaningKo: "" } : null;
  }
  if (value && typeof value === "object") {
    const candidate = value as { phrase?: unknown; meaningKo?: unknown };
    const phrase = typeof candidate.phrase === "string" ? trimText(candidate.phrase) : "";
    const meaningKo = typeof candidate.meaningKo === "string" ? trimText(candidate.meaningKo) : "";
    return phrase ? { phrase, meaningKo } : null;
  }
  return null;
}

function normalizeCompletionRefinementPhrase(value?: RefinementExpression | null) {
  if (!value || value.displayable === false) {
    return null;
  }

  const phrase = trimText(value.expression);
  if (!phrase) {
    return null;
  }

  return {
    phrase,
    meaningKo: trimText(value.meaningKo),
    guidanceKo: trimText(value.guidanceKo),
    exampleEn: trimText(value.exampleEn)
  };
}

function buildCompletionRefinementPhrases(expressions?: RefinementExpression[] | null) {
  if (!Array.isArray(expressions)) {
    return [];
  }

  const seen = new Set<string>();
  const phrases: NonNullable<ReturnType<typeof normalizeCompletionRefinementPhrase>>[] = [];

  for (const expression of expressions) {
    const phrase = normalizeCompletionRefinementPhrase(expression);
    if (!phrase) {
      continue;
    }

    const key = normalizeExpressionKey(phrase.phrase);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    phrases.push(phrase);
  }

  return phrases;
}

function renderFeedbackExpressionSaveIcon(saved: boolean, saving: boolean) {
  if (saving) {
    return <ActivityIndicator color="#8A5A1E" size="small" />;
  }

  return (
    <SymbolView
      name={{
        ios: saved ? "bookmark.fill" : "bookmark",
        android: saved ? "bookmark" : "bookmark_border",
        web: saved ? "bookmark" : "bookmark_border"
      }}
      size={16}
      weight="semibold"
      tintColor={saved ? "#2F7A46" : "#8A5A1E"}
      type="hierarchical"
    />
  );
}

function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

function hasCoachMove(coachMove?: FeedbackCoachMove | null) {
  return Boolean(
    trimText(coachMove?.focus) ||
      trimText(coachMove?.why) ||
      trimText(coachMove?.before) ||
      trimText(coachMove?.after) ||
      trimText(coachMove?.instruction) ||
      trimText(coachMove?.skeletonEn) ||
      (Array.isArray(coachMove?.languageCorrections) &&
        coachMove.languageCorrections.length > 0) ||
      (Array.isArray(coachMove?.suggestedPhrases) &&
        coachMove.suggestedPhrases.some((phrase) => normalizeSuggestedPhrase(phrase)))
  );
}

function isCoachMoveComparison(coachMove?: FeedbackCoachMove | null) {
  const before = trimText(coachMove?.before);
  const after = trimText(coachMove?.after);
  if (!before || !after) {
    return false;
  }

  const focusType = trimText(coachMove?.focusType).toUpperCase();
  if (!focusType) {
    return true;
  }

  return [
    "MICRO_FIX",
    "LANGUAGE_FIX",
    "STRUCTURE_FIX",
    "GRAMMAR",
    "GRAMMAR_FIX",
    "LOCAL_GRAMMAR",
    "FIX_LOCAL_GRAMMAR",
    "BLOCKING_GRAMMAR",
    "FIX_BLOCKING_GRAMMAR",
    "EXPRESSION",
    "EXPRESSION_POLISH"
  ].includes(focusType);
}

function isDirectCorrectionCoachMove(coachMove?: FeedbackCoachMove | null) {
  const focusType = trimText(coachMove?.focusType).toUpperCase();
  return [
    "MICRO_FIX",
    "LANGUAGE_FIX",
    "STRUCTURE_FIX",
    "GRAMMAR",
    "GRAMMAR_FIX",
    "LOCAL_GRAMMAR",
    "FIX_LOCAL_GRAMMAR",
    "BLOCKING_GRAMMAR",
    "FIX_BLOCKING_GRAMMAR",
    "EXPRESSION",
    "EXPRESSION_POLISH"
  ].includes(focusType);
}

function countDiffTokens(text: string) {
  return text.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9']+|\s+/g)?.length ?? 0;
}

function countComparableWords(text: string) {
  return text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g)?.length ?? 0;
}

function isCoachMoveDiffScopeAligned(original: string, revised: string) {
  const originalWords = countComparableWords(original);
  const revisedWords = countComparableWords(revised);
  if (!originalWords || !revisedWords) {
    return true;
  }

  const shorter = Math.min(originalWords, revisedWords);
  const longer = Math.max(originalWords, revisedWords);
  const wordDelta = longer - shorter;

  // Phrase-vs-sentence comparisons create misleading highlights.
  return wordDelta <= 3 || longer / shorter <= 1.45;
}

function canBuildCoachMoveDiff(original: string, revised: string) {
  return (
    original.length + revised.length <= COACH_MOVE_DIFF_MAX_CHARS &&
    countDiffTokens(original) + countDiffTokens(revised) <= COACH_MOVE_DIFF_MAX_TOKENS &&
    isCoachMoveDiffScopeAligned(original, revised)
  );
}

function renderCoachMoveDiffSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={styles.coachMoveBeforeHighlight}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={styles.coachMoveAfterHighlight}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={styles.coachMoveBeforeHighlight}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={styles.coachMoveAfterHighlight}>
          {segment.text}
        </Text>
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

function buildSavedExpressionIdMap(
  expressions: { id: number; expression: string }[]
): Record<string, number> {
  return expressions.reduce<Record<string, number>>((map, expression) => {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey) {
      return map;
    }

    map[normalizedKey] = expression.id;
    return map;
  }, {});
}

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
  const [rewriteError, setRewriteError] = useState("");
  const [isSubmittingRewrite, setIsSubmittingRewrite] = useState(false);
  const [areAllLanguageCorrectionsVisible, setAreAllLanguageCorrectionsVisible] =
    useState(false);
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>(
    {}
  );
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);

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
        visibleFeedback?.refinementExpressions ?? feedback?.refinementExpressions
      )
    : [];
  const shouldShowCompletionRewriteChoice = isLoopReadyToFinish;
  const shouldShowCoachMoveComparison = isCoachMoveComparison(coachMove);
  const shouldShowCorrectionReasonLabel = isDirectCorrectionCoachMove(coachMove);
  const shouldShowInlineRewriteWorkspace =
    Boolean(feedbackState) && (!isLoopReadyToFinish || isCompletionRewriteOpen);
  const rewriteButtonLabel = REWRITE_OPEN_BUTTON_LABEL;
  const finishButtonLabel = pickFirstNonEmpty(
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
    ? "이미 충분히 좋아요. 원하면 표현 하나만 가볍게 다듬어 보세요."
    : "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영하면 돼요.";

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

    void hydratePracticeFeedbackState(requestedDifficulty, requestedPromptId).then((nextState) => {
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

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      return;
    }

    let cancelled = false;

    void getSavedExpressions()
      .then((savedExpressions) => {
        if (cancelled) {
          return;
        }

        setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSavedExpressionIdsByKey({});
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    setInlineRewriteY(null);
    setSavingExpressionKeys([]);
    setIsCompletionRewriteOpen(false);
    setIsModelAnswerOpen(false);
    rewriteSubmissionIdRef.current = null;
  }, [requestedDifficulty, requestedPromptId]);

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

  async function handleToggleFeedbackExpression(
    expression: string,
    sourceType: SavedExpressionSourceType,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) {
    const normalizedKey = normalizeExpressionKey(expression);
    if (!normalizedKey || !feedbackState) {
      return;
    }

    if (!currentUser) {
      Alert.alert(
        "로그인이 필요해요",
        "표현 저장은 로그인 후 사용할 수 있어요.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "로그인하기",
            onPress: () => router.push("/login")
          }
        ]
      );
      return;
    }

    if (savingExpressionKeys.includes(normalizedKey)) {
      return;
    }

    const savedExpressionId = savedExpressionIdsByKey[normalizedKey];

    setSavingExpressionKeys((current) =>
      current.includes(normalizedKey) ? current : [...current, normalizedKey]
    );

    try {
      if (savedExpressionId) {
        await deleteSavedExpression(savedExpressionId);
        setSavedExpressionIdsByKey((current) => {
          const next = { ...current };
          delete next[normalizedKey];
          return next;
        });
        return;
      }

      const savedExpression = await saveExpression({
        expression,
        meaningKo: meaningKo ?? undefined,
        exampleEn: exampleEn ?? undefined,
        usageTipKo: usageTip ?? undefined,
        tags: tags?.length ? tags : undefined,
        sourceType,
        promptId: feedbackState.prompt.id,
        answerSessionId: feedbackState.feedback.sessionId,
        answerAttemptNo: feedbackState.feedback.attemptNo
      });
      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [normalizedKey]: savedExpression.id
      }));
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
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

          {isHydratingFeedbackState ? (
            <View style={styles.emptyStateCard}>
              <ActivityIndicator color="#E38B12" />
            </View>
          ) : feedbackState ? (
            <>
              {visibleStrength ? (
                <View style={styles.strengthCard}>
                  <Text style={styles.strengthLabel}>잘한 점</Text>
                  <Text style={styles.strengthText}>{visibleStrength}</Text>
                </View>
              ) : null}

              {shouldShowCoachMoveCard ? (
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
                        {trimText(coachMove?.after) ? (
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
                                {trimText(correction.after) ? (
                                  <Text style={styles.languageCorrectionAfter}>
                                    {correction.after}
                                  </Text>
                                ) : null}
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
                        {coachSuggestedPhrases.map((phrase, index) => {
                          const normalizedPhraseKey = normalizeExpressionKey(phrase.phrase);
                          const isPhraseSaved = Boolean(savedExpressionIdsByKey[normalizedPhraseKey]);
                          const isPhraseSaving = savingExpressionKeys.includes(normalizedPhraseKey);

                          return (
                            <Pressable
                              key={`${phrase.phrase}-${index}`}
                              style={[
                                styles.coachMovePhraseChip,
                                isPhraseSaved && styles.coachMovePhraseChipSaved
                              ]}
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
                              accessibilityLabel={isPhraseSaved ? "표현 저장 취소" : "표현 저장"}
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
                </View>
              </View>
              ) : null}

              {shouldShowInlineRewriteWorkspace ? (
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
                      rewriteSubmissionIdRef.current = null;
                      if (rewriteError) {
                        setRewriteError("");
                      }
                    }}
                    multiline
                    textAlignVertical="top"
                    placeholder={pickFirstNonEmpty(
                      rewriteWorkspace?.placeholder,
                      "코치 포인트를 반영해서 다시 써보세요."
                    )}
                    placeholderTextColor="#B7A58F"
                  />
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
                  >
                    <Text style={styles.primaryButtonText}>{inlineRewriteSubmitLabel}</Text>
                  </Pressable>
                </View>
              ) : null}

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
                            accessibilityLabel={isPhraseSaved ? "표현 저장 취소" : "표현 저장"}
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
                      <Pressable style={styles.secondaryButton} onPress={handleOpenCompletionRewrite}>
                        <Text style={styles.secondaryButtonText}>{rewriteButtonLabel}</Text>
                      </Pressable>
                    ) : null}

                  <Pressable
                    style={[styles.primaryButton, isFinishing && styles.primaryButtonDisabled]}
                    onPress={() => void handleFinishLoop()}
                    disabled={isFinishing}
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
            </>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>피드백을 찾지 못했어요</Text>
              <Text style={styles.emptyStateBody}>
                방금 작성한 피드백이 초기화되었을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.
              </Text>
              <Pressable style={styles.primaryButton} onPress={handleBackToQuestions}>
                <Text style={styles.primaryButtonText}>질문 목록으로 돌아가기</Text>
              </Pressable>
            </View>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  keyboardFrame: {
    flex: 1
  },
  screen: {
    flex: 1,
    position: "relative"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 180,
    gap: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerBackButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBackIcon: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700",
    color: "#4A4033"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
    color: "#2F312D"
  },
  headerSpacer: {
    width: 42,
    height: 42
  },
  strengthCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E9D9C6",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 14,
    shadowColor: "#C58A43",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 2
  },
  strengthLabel: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  strengthText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "800",
    color: "#3D342B"
  },
  modelAnswerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5D4BE",
    backgroundColor: "#FFFCF7",
    overflow: "hidden"
  },
  modelAnswerToggle: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modelAnswerEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A56A1C"
  },
  modelAnswerTitle: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#3D3227"
  },
  modelAnswerToggleIcon: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
    color: "#A56A1C"
  },
  modelAnswerBody: {
    borderTopWidth: 1,
    borderTopColor: "#EEDFCB",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8
  },
  modelAnswerEn: {
    fontSize: 17,
    lineHeight: 27,
    fontWeight: "800",
    color: "#382F27"
  },
  modelAnswerKo: {
    fontSize: 14,
    lineHeight: 22,
    color: "#826E58"
  },
  stickyTabOverlay: {
    position: "absolute",
    top: 8,
    left: 20,
    right: 20,
    zIndex: 20
  },
  stickyTabBar: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
    backgroundColor: "#F7F2EB"
  },
  stickyTabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    backgroundColor: "#FFFBF4",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D89A51",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  },
  stickyTabButtonActive: {
    backgroundColor: "#F2A14A",
    borderColor: "#E09128"
  },
  stickyTabButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#7A6244"
  },
  stickyTabButtonTextActive: {
    color: "#2E2416"
  },
  coachMoveCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E9D9C6",
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 16,
    shadowColor: "#C58A43",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 2
  },
  coachMoveHeadline: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  coachMoveBody: {
    gap: 12
  },
  coachMoveSwap: {
    gap: 10
  },
  coachMoveSwapRow: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 7
  },
  coachMoveBeforeRow: {
    backgroundColor: "#FDEDE9"
  },
  coachMoveAfterRow: {
    backgroundColor: "#EAF7EA"
  },
  coachMoveSwapLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    color: "#8B6A45"
  },
  coachMoveBefore: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#A23B2B"
  },
  coachMoveBeforeHighlight: {
    backgroundColor: "#F8CFC7",
    color: "#8F2F23",
    fontWeight: "900"
  },
  coachMoveAfter: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#1F6B35"
  },
  coachMoveAfterHighlight: {
    backgroundColor: "#BDEAC7",
    color: "#145F2A",
    fontWeight: "900"
  },
  languageCorrectionList: {
    gap: 10
  },
  languageCorrectionItem: {
    gap: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EADBC8",
    backgroundColor: "#FFFFFF",
    padding: 14
  },
  languageCorrectionBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  languageCorrectionBadgeStructure: {
    backgroundColor: "#F7E4C5"
  },
  languageCorrectionBadgeCore: {
    backgroundColor: "#F8D8D1"
  },
  languageCorrectionBadgeDetail: {
    backgroundColor: "#DCEEE5"
  },
  languageCorrectionBadgeText: {
    color: "#47382B",
    fontSize: 12,
    fontWeight: "900"
  },
  languageCorrectionSwap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7
  },
  languageCorrectionBefore: {
    color: "#9B3B2E",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    textDecorationLine: "line-through"
  },
  languageCorrectionArrow: {
    color: "#A67A48",
    fontSize: 15,
    fontWeight: "900"
  },
  languageCorrectionAfter: {
    color: "#1F6B35",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "900"
  },
  languageCorrectionReason: {
    color: "#67594B",
    fontSize: 14,
    lineHeight: 21
  },
  languageCorrectionToggle: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDBB8E",
    backgroundColor: "#FFF9F0",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  languageCorrectionTogglePressed: {
    opacity: 0.72
  },
  languageCorrectionToggleText: {
    color: "#8D5617",
    fontSize: 14,
    fontWeight: "900"
  },
  coachMoveWhyBox: {
    gap: 6
  },
  coachMoveWhyLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveWhy: {
    fontSize: 15,
    lineHeight: 24,
    color: "#6D6050"
  },
  coachMoveInstructionBox: {
    paddingVertical: 2,
    gap: 8
  },
  coachMoveInstructionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveInstruction: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "800",
    color: "#3C342B"
  },
  coachMoveSkeletonBox: {
    marginTop: 2,
    gap: 4
  },
  coachMoveSkeletonLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveSkeleton: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "800",
    color: "#5A4630"
  },
  coachMoveSkeletonMeaning: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#8B7358"
  },
  coachMovePhraseBox: {
    marginTop: 6,
    gap: 8
  },
  coachMovePhraseLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMovePhraseList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachMovePhraseChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7CDAA",
    backgroundColor: "#FFF9EF",
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  coachMovePhraseChipSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachMovePhraseContent: {
    gap: 2,
    flexShrink: 1
  },
  coachMovePhraseText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#6B5138"
  },
  coachMovePhraseMeaning: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#9A8066"
  },
  coachMovePhraseSaveText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    color: "#A76518"
  },
  coachMovePhraseSaveTextSaved: {
    color: "#2F7A46"
  },
  coachMovePhraseSaveButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3C39B",
    backgroundColor: "#FFFBF4",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  coachMovePhraseSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachMoveSuccessBox: {
    gap: 6
  },
  coachMoveSuccessLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveSuccess: {
    fontSize: 14,
    lineHeight: 22,
    color: "#7B6A55"
  },
  detailToggleButton: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8B17A",
    backgroundColor: "#FFFBF4",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  detailToggleButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A5A19"
  },
  inlineRewriteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 13
  },
  inlineRewriteHelp: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  },
  inlineRewriteInput: {
    minHeight: 170,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E1D0BC",
    backgroundColor: "#FFFCF7",
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    lineHeight: 26,
    color: "#2F2A24",
    fontWeight: "600"
  },
  inlineRewriteError: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B6402D",
    fontWeight: "800"
  },
  completionFooter: {
    gap: 14
  },
  completionCard: {
    paddingTop: 4
  },
  completionSuggestionBox: {
    backgroundColor: "#FFFEFC",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10
  },
  completionSuggestionLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#A46612"
  },
  completionSuggestionList: {
    gap: 8
  },
  completionSuggestionChip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7CDAA",
    backgroundColor: "#FFF9EF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  completionSpeechRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14
  },
  completionBubbleWrap: {
    flex: 1
  },
  completionBubble: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#F2994A",
    paddingHorizontal: 22,
    paddingVertical: 20
  },
  completionHeadline: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "900",
    color: "#2F312D"
  },
  completionMascotFrame: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: "#E0A45E",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    flexShrink: 0
  },
  completionMascot: {
    width: 104,
    height: 104,
    resizeMode: "contain"
  },
  primaryButton: {
    borderRadius: 22,
    backgroundColor: "#E38B12",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.58
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  secondaryButton: {
    borderRadius: 22,
    backgroundColor: "#FFFBF4",
    borderWidth: 1,
    borderColor: "#D8B17A",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A5A19"
  },
  emptyStateCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyStateBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  }
});
