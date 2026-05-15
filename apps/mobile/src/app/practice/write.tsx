import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PracticeFeedbackContent } from "@/components/practice-feedback-content";
import FeedbackLoadingOverlay from "@/components/feedback-loading-overlay";
import {
  ApiError,
  deleteWritingDraft,
  getDailyPrompts,
  getPromptHints,
  getPrompts,
  getWritingDraft,
  requestCoachHelp,
  saveExpression,
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
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";
import type {
  CoachHelpResponse,
  DailyDifficulty,
  DailyPromptRecommendation,
  Feedback,
  Prompt,
  PromptHint,
  SaveWritingDraftRequest,
  WritingDraft,
  WritingDraftType
} from "@/lib/types";

function getPromptNotFoundMessage() {
  return "선택한 질문을 찾지 못했어요. 질문 목록으로 돌아가 다시 골라 주세요.";
}

type WritingGuideChecklistItem = {
  title: string;
  description: string;
};

type WritingGuide = {
  title: string;
  description: string;
  starter: string;
  checklist: WritingGuideChecklistItem[];
};

type WritingGuideHintCard = {
  id: string;
  content: string;
  meaningKo?: string | null;
};

function getWritingGuide(difficulty: DailyDifficulty, starterHint?: string | null): WritingGuide {
  switch (difficulty) {
    case "I":
      return {
        title: "짧게라도 바로 영어로 시작해 보세요.",
        description: "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각부터 익히면 됩니다.",
        starter: starterHint ?? "I usually ...",
        checklist: [
          {
            title: "핵심 답 한 줄 쓰기",
            description: "질문에 대한 내 답을 아주 짧게 먼저 써 보세요."
          },
          {
            title: "이유 한 줄 붙이기",
            description: "because 뒤에 짧은 이유만 더해도 훨씬 자연스러워져요."
          },
          {
            title: "쉬운 표현으로 끝내기",
            description: "어려운 문장보다 익숙한 표현으로 끝까지 써 보는 게 더 중요해요."
          }
        ]
      };
    case "A":
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
        starter: starterHint ?? "I think ... because ...",
        checklist: [
          {
            title: "생각 먼저 적기",
            description: "먼저 내 생각을 짧고 분명하게 적어 보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 문장만 덧붙여도 충분해요."
          },
          {
            title: "짧은 예시 더하기",
            description: "간단한 경험이나 상황을 하나 넣으면 더 자연스러워져요."
          }
        ]
      };
    case "B":
      return {
        title: "생각, 이유, 예시를 흐름 있게 적어 보세요.",
        description: "한 문장씩 차근차근 이어 가면 답이 더 안정적으로 들려요.",
        starter: starterHint ?? "In my opinion, ... One reason is that ...",
        checklist: [
          {
            title: "내 입장 먼저 밝히기",
            description: "질문에 대한 내 생각을 첫 문장에 분명하게 적어 보세요."
          },
          {
            title: "이유 하나 설명하기",
            description: "왜 그런지 구체적인 이유를 한두 문장으로 이어 가요."
          },
          {
            title: "예시나 경험 붙이기",
            description: "짧은 예시를 붙이면 답이 더 살아 있는 느낌이 나요."
          }
        ]
      };
    case "C":
      return {
        title: "주장과 근거를 구조적으로 보여 주세요.",
        description: "길게 쓰기보다 흐름이 보이게 정리하면 더 설득력 있어요.",
        starter: starterHint ?? "I believe ... because ... For example, ...",
        checklist: [
          {
            title: "주장 먼저 세우기",
            description: "답의 중심 생각을 첫 문장에 분명하게 적어 주세요."
          },
          {
            title: "근거를 한 단계 더 풀기",
            description: "이유를 한 문장으로 끝내지 말고 한 번 더 풀어 보세요."
          },
          {
            title: "예시나 비교 붙이기",
            description: "구체적인 예시나 비교를 더하면 답이 더 탄탄해져요."
          }
        ]
      };
    default:
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
        starter: starterHint ?? "I think ... because ...",
        checklist: [
          {
            title: "생각 먼저 적기",
            description: "내 생각을 한 문장으로 먼저 적어 보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 줄을 이어 보세요."
          },
          {
            title: "짧은 예시 더하기",
            description: "짧은 경험이나 상황을 더해 답을 완성해 보세요."
          }
        ]
      };
  }
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

const PRACTICE_EXPRESSION_TRAILING_WEAK_TOKENS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "to",
  "with",
  "your",
  "his",
  "her"
]);

function isLikelyCompletePracticeExpression(expression: string) {
  const normalized = expression.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const tokens = normalized.toLowerCase().split(" ");
  const lastToken = tokens[tokens.length - 1];
  return !PRACTICE_EXPRESSION_TRAILING_WEAK_TOKENS.has(lastToken);
}

function parsePracticeExpressionsParam(value?: string | string[]) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const dedupedExpressions = new Set<string>();
    const expressions: string[] = [];

    parsed.forEach((item) => {
      if (typeof item !== "string") {
        return;
      }

      const normalized = normalizeExpressionKey(item);
      if (
        !normalized ||
        dedupedExpressions.has(normalized) ||
        !isLikelyCompletePracticeExpression(item)
      ) {
        return;
      }

      dedupedExpressions.add(normalized);
      expressions.push(item.trim());
    });

    return expressions;
  } catch {
    return [];
  }
}

function formatDraftSavedAt(updatedAt: string) {
  return new Date(updatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDraftStatusBadgeLabel(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("실패")) {
    return "임시저장 실패";
  }

  if (normalized.startsWith("임시저장됨")) {
    return normalized;
  }

  if (normalized.includes("이 기기에 저장됨") || normalized.includes("이 기기에 임시저장됨")) {
    return "이 기기에 저장됨";
  }

  return normalized;
}

function trimNullableText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimNullableText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

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
  const safeAreaInsets = useSafeAreaInsets();
  const coachModalHeaderTopPadding = Math.max(safeAreaInsets.top + 12, 24);
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
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [savedCoachExpressionKeys, setSavedCoachExpressionKeys] = useState<string[]>([]);
  const [savingCoachExpressionKeys, setSavingCoachExpressionKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const selectedPrompt = useMemo(() => {
    const prompts = recommendation?.prompts ?? [];
    return prompts.find((prompt) => prompt.id === requestedPromptId) ?? null;
  }, [recommendation?.prompts, requestedPromptId]);

  const coachQuickQuestions = useMemo(() => {
    const topic = selectedPrompt?.topic?.trim();
    return Array.from(
      new Set([
        topic ? `${topic} 주제에 어울리는 표현 3개 알려줘.` : "이 질문에 어울리는 표현 3개 알려줘.",
        "첫 문장을 어떻게 시작하면 좋을까?",
        "이유를 자연스럽게 붙이는 표현을 알려줘.",
        "마무리 문장을 어떻게 쓰면 좋을까?"
      ])
    );
  }, [selectedPrompt?.topic]);

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
  const feedbackLoadingStages = useMemo(
    () =>
      feedback
        ? [
            {
              title: "다시 쓴 답변을 읽고 있어요",
              message: "이전 피드백이 얼마나 반영됐는지 살펴보는 중이에요. 잠시만 기다려 주세요."
            },
            {
              title: "문장 흐름을 비교하고 있어요",
              message: "좋아진 부분과 더 다듬을 부분을 차근차근 보고 있어요."
            },
            {
              title: "더 자연스러운 표현을 고르고 있어요",
              message: "답을 더 매끄럽게 만들어 줄 표현을 정리하고 있어요."
            },
            {
              title: "다음 다시쓰기 힌트를 만들고 있어요",
              message: "한 번 더 써 볼 때 바로 쓸 수 있는 팁까지 챙기고 있어요."
            }
          ]
        : [
            {
              title: "피드백을 만들고 있어요",
              message: "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."
            },
            {
              title: "문장을 찬찬히 읽고 있어요",
              message: "잘한 점과 먼저 고칠 점을 나눠 보고 있어요."
            },
            {
              title: "더 자연스러운 표현을 찾고 있어요",
              message: "바로 써먹을 수 있는 표현도 함께 고르고 있어요."
            },
            {
              title: "표현을 하나 더 보탤 아이디어를 만들고 있어요",
              message: "다음 다시쓰기에서 써 볼 힌트까지 챙기고 있어요."
            }
          ],
    [feedback]
  );
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
    feedback?.rewriteWorkspace?.targetTextHint,
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
  }, [selectedPrompt?.id]);

  async function handleSubmit() {
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
      const nextFeedback = await submitFeedback({
        promptId: selectedPrompt.id,
        answer: trimmedAnswer,
        sessionId: feedback?.sessionId,
        attemptType: feedback ? "REWRITE" : "INITIAL",
        guestId: guestId || undefined
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
      await clearPersistedDraft(selectedPrompt.id, activeDraftType);
      setDraftStatusMessage("");
      setFeedback(nextFeedback);
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
    setIsDraftPersistencePaused(false);
    setAnswer((current) => {
      if (!current.trim()) {
        return expression;
      }

      return /\s$/.test(current) ? `${current}${expression}` : `${current} ${expression}`;
    });
  }

  async function handleSaveCoachExpression(
    expression: CoachHelpResponse["expressions"][number]
  ) {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey || !selectedPrompt) {
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

    if (
      savedCoachExpressionKeys.includes(normalizedKey) ||
      savingCoachExpressionKeys.includes(normalizedKey)
    ) {
      return;
    }

    setSavingCoachExpressionKeys((current) =>
      current.includes(normalizedKey) ? current : [...current, normalizedKey]
    );

    try {
      await saveExpression({
        expression: expression.expression,
        meaningKo: expression.meaningKo,
        usageTipKo: expression.usageTip,
        exampleEn: expression.example,
        tags: expression.tags?.length ? expression.tags : undefined,
        sourceType: "COACH_RECOMMENDATION",
        promptId: selectedPrompt.id,
        coachInteractionId: coachHelp?.interactionId
      });
      setSavedCoachExpressionKeys((current) =>
        current.includes(normalizedKey) ? current : [...current, normalizedKey]
      );
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요.",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingCoachExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
  }

  async function handleRequestCoachHelp(questionOverride?: string) {
    if (!selectedPrompt) {
      setError(getPromptNotFoundMessage());
      return;
    }

    const nextQuestion = (questionOverride ?? coachQuestion).trim();
    if (!nextQuestion) {
      setCoachHelpError("코치에게 물어볼 내용을 먼저 적어 주세요.");
      setIsCoachOpen(true);
      return;
    }

    try {
      setIsCoachOpen(true);
      setIsLoadingCoachHelp(true);
      setCoachHelp(null);
      setCoachHelpError("");
      const nextCoachHelp = await requestCoachHelp({
        promptId: selectedPrompt.id,
        question: nextQuestion,
        sessionId: feedback?.sessionId,
        answer: answer.trim() || undefined,
        attemptType: feedback ? "REWRITE" : "INITIAL"
      });
      setCoachQuestion(nextQuestion);
      setCoachHelp(nextCoachHelp);
    } catch (caughtError) {
      setCoachHelpError(caughtError instanceof Error ? caughtError.message : "AI 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
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

  async function cancelCurrentWriting() {
    if (!selectedPrompt) {
      handleBackToQuestions();
      return;
    }

    setIsDraftPersistencePaused(true);
    cancelDraftAutosave();
    Keyboard.dismiss();

    try {
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

  /*
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
          updateDraftStatus(`임시저장됨 · ${formatDraftSavedAt(savedDraft.updatedAt)}`);
          return;
        }

        await saveLocalWritingDraft({
          promptId: prompt.id,
          updatedAt: new Date().toISOString(),
          ...draftPayload
        });
        updateDraftStatus("이 기기에 임시저장됨");
      } catch {
        try {
          await saveLocalWritingDraft({
            promptId: prompt.id,
            updatedAt: new Date().toISOString(),
            ...draftPayload
          });
          updateDraftStatus(
            currentUser ? "서버 저장이 불안정해 이 기기에 임시저장했어요." : "이 기기에 임시저장됨"
          );
        } catch {
          updateDraftStatus(
            currentUser ? "임시저장에 실패했어요." : "이 기기에 임시저장하지 못했어요."
          );
        }
      }
    },
    [
      activeDraftType,
      buildDraftPayload,
      clearPersistedDraft,
      cancelDraftAutosave,
      currentUser,
      isDraftPersistencePaused,
      isLoading,
      isSubmitting
    ]
  );

  */

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
    await persistDraftSnapshot(latestAnswerRef.current, latestSelectedPromptRef.current, false);
  }, [cancelDraftAutosave, persistDraftSnapshot]);

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

      void persist();
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
    selectedPrompt
  ]);

  useEffect(() => {
    return () => {
      void flushPendingDraft();
    };
  }, [flushPendingDraft]);

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

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#E38B12" />
            </View>
          ) : selectedPrompt ? (
            <>
              <View style={styles.practiceFlowCard}>
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

                <View style={styles.practiceFlowDivider} />

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
                      editable={!isAnswerLocked}
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

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <Pressable
                    style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                    onPress={() => {
                      if (canViewLatestFeedback) {
                        handleOpenLatestFeedback();
                        return;
                      }

                      void handleSubmit();
                    }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#2E2416" />
                    ) : (
                      <Text style={styles.submitButtonText}>{primaryActionLabel}</Text>
                    )}
                  </Pressable>
                  {!isAnswerLocked ? (
                    <Pressable
                      style={[styles.cancelWritingButton, isSubmitting && styles.disabledButton]}
                      onPress={handleCancelWriting}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel="작문 취소"
                    >
                      <Text style={styles.cancelWritingButtonText}>작문 취소</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>질문을 다시 골라 주세요</Text>
              <Text style={styles.emptyStateBody}>
                선택한 질문을 찾지 못했어요. 질문 목록으로 돌아가 다시 선택하면 바로 이어서 쓸 수 있어요.
              </Text>
              <Pressable style={styles.submitButton} onPress={handleBackToQuestions}>
                <Text style={styles.submitButtonText}>질문 목록으로 돌아가기</Text>
              </Pressable>
            </View>
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

      <Modal
        visible={isPreviousFeedbackOpen}
        animationType="slide"
        onRequestClose={() => setIsPreviousFeedbackOpen(false)}
      >
        <SafeAreaView style={styles.feedbackModalRoot} edges={["top", "bottom"]}>
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
                <PracticeFeedbackContent feedbackState={previousFeedbackState} />
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
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isGuideOpen}
        animationType="slide"
        onRequestClose={() => setIsGuideOpen(false)}
      >
        <SafeAreaView style={styles.guideModalRoot} edges={["top", "bottom"]}>
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
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isCoachOpen}
        animationType="slide"
        onRequestClose={() => setIsCoachOpen(false)}
      >
        <SafeAreaView style={styles.coachModalRoot} edges={["bottom"]}>
          <KeyboardAvoidingView
            style={styles.coachModalKeyboardFrame}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
            <View style={[styles.coachModalHeader, { paddingTop: coachModalHeaderTopPadding }]}>
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
        </SafeAreaView>
      </Modal>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 18
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
  loadingCard: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  practiceFlowCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 16
  },
  promptSummaryCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 10
  },
  promptSummaryEn: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    color: "#2B2620"
  },
  promptSummaryKo: {
    fontSize: 15,
    lineHeight: 22,
    color: "#756757"
  },
  tagPracticeCard: {
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8D8C5",
    backgroundColor: "#FFF8EF",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  tagPracticeEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
    color: "#A56B1F"
  },
  tagPracticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5A46",
    fontWeight: "700"
  },
  tagPracticeExpressionScroller: {
    flexGrow: 0
  },
  tagPracticeExpressionList: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 12
  },
  tagPracticeExpressionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7D6C1",
    backgroundColor: "#FFFDF9",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  tagPracticeExpressionChipPrimary: {
    borderColor: "#E9AF63",
    backgroundColor: "#FFF1DC"
  },
  tagPracticeExpressionChipText: {
    fontSize: 14,
    lineHeight: 19,
    color: "#5F5244",
    fontWeight: "700"
  },
  tagPracticeExpressionChipTextPrimary: {
    fontSize: 15,
    lineHeight: 21,
    color: "#2C2924",
    fontWeight: "900"
  },
  questionActionRow: {
    display: "none"
  },
  practiceFlowDivider: {
    height: 1,
    backgroundColor: "#EEE0CF"
  },
  promptToolRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    flexWrap: "wrap"
  },
  translationButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF"
  },
  translationButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  composerCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 16
  },
  rewriteContextCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8D6BE",
    backgroundColor: "#FFF8EA",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8
  },
  rewriteContextEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#A56B1F"
  },
  rewriteContextTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
    color: "#2F2A24"
  },
  rewriteContextBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5B4B39"
  },
  rewriteContextButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2CEB3",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  rewriteContextButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#755E42"
  },
  composerToolRow: {
    display: "none"
  },
  composerToolButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF9F2"
  },
  composerToolButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  answerInputFrame: {
    position: "relative",
    minHeight: 252,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4"
  },
  composerFooterRow: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 60
  },
  composerMetaBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1
  },
  composerStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF3DA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#8E652E",
    overflow: "hidden"
  },
  composerStatusBadgeError: {
    backgroundColor: "#FDE6DF",
    color: "#B34A2B"
  },
  composerWordCount: {
    borderRadius: 999,
    backgroundColor: "#F7EFE6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#7A6853",
    overflow: "hidden"
  },
  coachTriggerDock: {
    position: "relative",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 54,
    minHeight: 54
  },
  coachTriggerDockWithBubble: {
    paddingTop: 60
  },
  coachTriggerBubble: {
    position: "absolute",
    right: 0,
    bottom: 62,
    width: 156,
    minWidth: 156,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#C1761E",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  coachTriggerBubbleText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#7B5A35",
    textAlign: "left"
  },
  coachTriggerBubbleTail: {
    position: "absolute",
    right: 18,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    transform: [{ rotate: "45deg" }]
  },
  coachTriggerMascotFrame: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#C1761E",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  coachTriggerMascot: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(193, 118, 30, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.96)"
  },
  guideModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  guideModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  guideModalHeaderText: {
    gap: 4,
    flex: 1
  },
  guideModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  guideModalScroll: {
    flex: 1
  },
  guideModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 14
  },
  guideIntroCard: {
    borderRadius: 28,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 20,
    gap: 8
  },
  guideIntroLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#A56B1F"
  },
  guideIntroTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  guideIntroBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  },
  guideStarterCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0DFC8",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  guideStarterText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2B2620"
  },
  guideHintSection: {
    gap: 12
  },
  guideHintGroups: {
    gap: 14
  },
  guideHintGroup: {
    gap: 8
  },
  guideHintGroupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A6431"
  },
  guideHintWordCardList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  guideHintWordCard: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0DFC8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    maxWidth: "100%"
  },
  guideHintWordLine: {
    fontSize: 14,
    lineHeight: 19
  },
  guideHintWordContent: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: "#2B2620"
  },
  guideHintWordMeaningInline: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7A6A59"
  },
  guideHintPhraseCardList: {
    gap: 10
  },
  guideHintPhraseCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0DFC8",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  guideHintPhraseLine: {
    fontSize: 15,
    lineHeight: 22
  },
  guideHintPhraseContent: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#2B2620"
  },
  guideHintCardMeaningInline: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7A6A59"
  },
  guideHintEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8B7761"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  feedbackModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  feedbackModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  feedbackModalHeaderText: {
    gap: 4,
    flex: 1
  },
  feedbackModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  feedbackModalBody: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  feedbackModalScroll: {
    flex: 1
  },
  feedbackModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28
  },
  feedbackModalEmptyCard: {
    borderRadius: 24,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 18,
    gap: 10
  },
  feedbackModalEmptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#232128"
  },
  feedbackModalEmptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6D6050"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  coachModalHeaderText: {
    gap: 4,
    flex: 1
  },
  coachModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  coachModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  coachModalBody: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  coachModalScroll: {
    flex: 1
  },
  coachModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28
  },
  coachPanel: {
    gap: 14
  },
  coachEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#B27B2E"
  },
  coachPanelTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#232128"
  },
  coachCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  coachInput: {
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#232128"
  },
  coachQuickActionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachQuickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  coachQuickChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D5A45"
  },
  coachPrimaryButton: {
    borderRadius: 18,
    backgroundColor: "#FFD08A",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  coachPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5A3A00"
  },
  coachMetaText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6B58"
  },
  coachErrorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  },
  coachResultStack: {
    gap: 12
  },
  coachReplyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachReplyBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  coachReplyText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2F2A23"
  },
  coachExpressionList: {
    gap: 10
  },
  coachExpressionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachExpressionActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  coachExpressionTop: {
    gap: 4
  },
  coachExpressionText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2620"
  },
  coachExpressionMeaning: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8C7355"
  },
  coachExpressionTip: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5D5143"
  },
  coachExpressionExample: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8A775E"
  },
  coachExpressionInsertButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFF4E2",
    borderWidth: 1,
    borderColor: "#EBCB97",
    paddingVertical: 12
  },
  coachExpressionInsertButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A5A19"
  },
  coachExpressionSaveButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFBF4",
    borderWidth: 1,
    borderColor: "#E3C39B",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  coachExpressionSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachExpressionSaveButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A5A19"
  },
  coachExpressionSaveButtonTextSaved: {
    color: "#2F7A46"
  },
  answerInput: {
    minHeight: 252,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 92,
    fontSize: 16,
    color: "#232128"
  },
  answerInputDisabled: {
    color: "#7B6B59"
  },
  submitButton: {
    borderRadius: 22,
    backgroundColor: "#E38B12",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  cancelWritingButton: {
    borderRadius: 22,
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#E4CDB4",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelWritingButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8F5D35"
  },
  disabledButton: {
    opacity: 0.7
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
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
