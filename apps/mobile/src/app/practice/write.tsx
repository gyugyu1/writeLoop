import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  ActivityIndicator,
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
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import { PracticeFeedbackContent } from "@/components/practice-feedback-content";
import FeedbackLoadingOverlay from "@/components/feedback-loading-overlay";
import {
  ApiError,
  deleteWritingDraft,
  getDailyPrompts,
  getPrompts,
  getWritingDraft,
  requestCoachHelp,
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
  countDistinctPromptCategories,
  isDailyDifficulty
} from "@/lib/practice";
import { useSession } from "@/lib/session";
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";
import type {
  CoachHelpResponse,
  DailyDifficulty,
  DailyPromptRecommendation,
  Feedback,
  Prompt,
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
  sentenceRange: [number, number];
  wordRange: [number, number];
  starter: string;
  checklist: WritingGuideChecklistItem[];
};

function getWritingGuide(difficulty: DailyDifficulty): WritingGuide {
  switch (difficulty) {
    case "A":
      return {
        title: "짧고 분명한 답변부터 시작해 보세요.",
        description: "완벽한 표현보다 내 의견을 한 줄로 말하는 게 먼저예요.",
        sentenceRange: [2, 3],
        wordRange: [20, 40],
        starter: "I think ... because ...",
        checklist: [
          {
            title: "의견 한 줄 쓰기",
            description: "먼저 내 생각을 짧고 분명하게 적어보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 문장만 더해도 충분해요."
          },
          {
            title: "짧은 예시 더하기",
            description: "내 경험이나 간단한 상황을 하나 넣으면 더 자연스러워져요."
          }
        ]
      };
    case "B":
      return {
        title: "의견, 이유, 예시를 한 흐름으로 묶어보세요.",
        description: "한 문장씩 차근차근 이어 쓰면 훨씬 안정적인 답변이 돼요.",
        sentenceRange: [3, 4],
        wordRange: [35, 60],
        starter: "In my opinion, ... One reason is that ...",
        checklist: [
          {
            title: "내 입장 먼저 밝히기",
            description: "질문에 대한 내 생각을 첫 문장에 분명히 적어보세요."
          },
          {
            title: "이유 하나 설명하기",
            description: "왜 그런지 구체적인 이유를 한두 문장으로 이어가세요."
          },
          {
            title: "예시나 경험 추가하기",
            description: "짧은 사례를 붙이면 답변이 더 설득력 있어져요."
          }
        ]
      };
    case "C":
      return {
        title: "주장과 근거를 구조적으로 풀어보세요.",
        description: "길게 쓰기보다 흐름이 보이게 정리하면 훨씬 강한 답변이 돼요.",
        sentenceRange: [4, 6],
        wordRange: [55, 90],
        starter: "I believe ... because ... For example, ...",
        checklist: [
          {
            title: "주장을 먼저 세우기",
            description: "답변의 중심 생각을 첫 문장에 분명하게 잡아주세요."
          },
          {
            title: "근거를 두텁게 만들기",
            description: "이유를 한 문장으로 끝내지 말고 한 번 더 풀어보세요."
          },
          {
            title: "예시나 비교 넣기",
            description: "구체적인 사례나 다른 관점을 덧붙이면 답변이 깊어져요."
          }
        ]
      };
    default:
      return {
        title: "의견을 한 줄로 시작해 보세요.",
        description: "짧게 시작해도 충분히 좋은 첫 답변이 될 수 있어요.",
        sentenceRange: [2, 3],
        wordRange: [20, 40],
        starter: "I think ... because ...",
        checklist: [
          {
            title: "의견 먼저 쓰기",
            description: "내 생각을 한 문장으로 먼저 적어보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 줄을 이어보세요."
          },
          {
            title: "예시 하나 더하기",
            description: "짧은 경험이나 상황을 덧붙여 답변을 완성해 보세요."
          }
        ]
      };
  }
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
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

  if (normalized.includes("이 기기에 임시저장")) {
    return "이 기기에 임시저장";
  }

  return normalized;
}

const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

export default function PracticeWriteScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; promptId?: string; mode?: string }>();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "A";
  const requestedPromptId = typeof params.promptId === "string" ? params.promptId : "";
  const isRewriteMode = params.mode === "rewrite";
  const { currentUser } = useSession();
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rewriteSeedAnswer, setRewriteSeedAnswer] = useState("");
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

  const answerGuide = useMemo(
    () => getWritingGuide(selectedPrompt?.difficulty ?? requestedDifficulty),
    [requestedDifficulty, selectedPrompt?.difficulty]
  );

  const activeDraftType: WritingDraftType = isRewriteMode ? "REWRITE" : "ANSWER";
  const answerWordCount = useMemo(() => countWords(answer), [answer]);
  const draftStatusBadgeLabel = useMemo(
    () => (draftStatusMessage ? toDraftStatusBadgeLabel(draftStatusMessage) : ""),
    [draftStatusMessage]
  );
  const feedbackLoadingTitle = feedback ? "다시 쓴 답변을 읽고 있어요" : "피드백을 만들고 있어요";
  const feedbackLoadingMessage = feedback
    ? "이전 피드백이 얼마나 반영됐는지 살펴보고 있어요. 잠시만 기다려 주세요."
    : "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요.";
  const previousFeedbackState = useMemo(() => {
    if (!selectedPrompt || !feedback || !rewriteSeedAnswer.trim()) {
      return null;
    }

    return {
      difficulty: requestedDifficulty,
      prompt: selectedPrompt,
      answer: rewriteSeedAnswer,
      feedback
    };
  }, [feedback, requestedDifficulty, rewriteSeedAnswer, selectedPrompt]);
  const answerChecklistSummary = useMemo(
    () => answerGuide.checklist.map((item) => item.title).join(" · "),
    [answerGuide]
  );
  const answerProgressMessage = useMemo(() => {
    if (!answer.trim()) {
      return "첫 문장은 짧게 시작해도 괜찮아요.";
    }

    if (answerWordCount < answerGuide.wordRange[0]) {
      return `${answerGuide.wordRange[0]}단어쯤까지 가면 더 안정적인 답변이 돼요.`;
    }

    if (answerWordCount <= answerGuide.wordRange[1]) {
      return "지금 분량이면 흐름이 잘 보이고 있어요.";
    }

    return "분량은 충분해요. 문장 연결만 한 번 더 다듬어 보세요.";
  }, [answer, answerGuide, answerWordCount]);

  const loadPrompt = useCallback(async () => {
    if (!requestedPromptId) {
      setError(getPromptNotFoundMessage());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const [nextRecommendation, promptPool] = await Promise.all([
        getDailyPrompts(requestedDifficulty),
        getPrompts()
      ]);
      const sameDifficultyPromptPool = promptPool.filter(
        (prompt) => prompt.difficulty === requestedDifficulty
      );
      const fallbackPrompt =
        sameDifficultyPromptPool.find((prompt) => prompt.id === requestedPromptId) ?? null;
      const nextPrompt =
        nextRecommendation.prompts.find((prompt) => prompt.id === requestedPromptId) ?? fallbackPrompt;

      const savedFeedbackState =
        getPracticeFeedbackState(requestedDifficulty, requestedPromptId) ??
        (await hydratePracticeFeedbackState(requestedDifficulty, requestedPromptId));
      const desiredPromptCount = Math.min(3, countDistinctPromptCategories(sameDifficultyPromptPool));
      const normalizedRecommendation = {
        ...nextRecommendation,
        prompts: buildDistinctCategoryPromptSelection(
          nextPrompt ? [nextPrompt, ...nextRecommendation.prompts] : nextRecommendation.prompts,
          sameDifficultyPromptPool,
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

        if (restoredDraft) {
          restoredAnswer =
            activeDraftType === "REWRITE"
              ? restoredDraft.rewrite || restoredDraft.answer
              : restoredDraft.answer;
          restoredDraftStatusMessage =
            currentUser && restoredDraft.updatedAt
              ? `임시저장됨 · ${formatDraftSavedAt(restoredDraft.updatedAt)}`
              : "이 기기에 임시저장됨";
        }
      } catch {
        restoredDraftStatusMessage = "";
      }

      latestAnswerRef.current = restoredAnswer;
      latestSelectedPromptRef.current = nextPrompt;
      setRecommendation(normalizedRecommendation);
      setFeedback(isRewriteMode ? savedFeedbackState?.feedback ?? null : null);
      setRewriteSeedAnswer(savedFeedbackState?.answer ?? "");
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
  }, [activeDraftType, currentUser, isRewriteMode, requestedDifficulty, requestedPromptId]);

  useEffect(() => {
    void loadPrompt();
  }, [loadPrompt]);

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
      const guestId = currentUser ? undefined : await getOrCreateGuestId();
      const nextFeedback = await submitFeedback({
        promptId: selectedPrompt.id,
        answer: trimmedAnswer,
        sessionId: feedback?.sessionId,
        attemptType: feedback ? "REWRITE" : "INITIAL",
        guestId
      });

      savePracticeFeedbackState({
        difficulty: requestedDifficulty,
        prompt: selectedPrompt,
        answer: trimmedAnswer,
        feedback: nextFeedback
      });
      setIsDraftPersistencePaused(true);
      cancelDraftAutosave();
      await clearPersistedDraft(selectedPrompt.id, activeDraftType);
      setDraftStatusMessage("");
      setFeedback(nextFeedback);
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

  function appendCoachExpression(expression: string) {
    setIsDraftPersistencePaused(false);
    setAnswer((current) => {
      if (!current.trim()) {
        return expression;
      }

      return /\s$/.test(current) ? `${current}${expression}` : `${current} ${expression}`;
    });
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
          updateDraftStatus(`?꾩떆??λ맖 쨌 ${formatDraftSavedAt(savedDraft.updatedAt)}`);
          return;
        }

        await saveLocalWritingDraft({
          promptId: prompt.id,
          updatedAt: new Date().toISOString(),
          ...draftPayload
        });
        updateDraftStatus("??湲곌린???꾩떆??λ맖");
      } catch {
        try {
          await saveLocalWritingDraft({
            promptId: prompt.id,
            updatedAt: new Date().toISOString(),
            ...draftPayload
          });
          updateDraftStatus(
            currentUser ? "?쒕쾭 ??μ씠 遺덉븞?뺥빐 ??湲곌린???꾩떆??ν뻽?댁슂." : "??湲곌린???꾩떆??λ맖"
          );
        } catch {
          updateDraftStatus(
            currentUser ? "?꾩떆??μ뿉 ?ㅽ뙣?덉뼱??" : "??湲곌린???꾩떆??ν븯吏 紐삵뻽?댁슂."
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
          updateDraftStatus(`Saved at ${formatDraftSavedAt(savedDraft.updatedAt)}`);
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
        updateDraftStatus("Saved on this device");
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
            currentUser ? "Server sync failed, but the draft was saved on this device." : "Saved on this device"
          );
        } catch {
          updateDraftStatus(
            currentUser ? "Draft save failed." : "Could not save the draft on this device."
          );
        }
      }
    },
    [
      activeDraftType,
      buildDraftPayload,
      clearPersistedDraft,
      clearIncompleteLoopForPrompt,
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
    clearIncompleteLoopForPrompt,
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
                  <View style={styles.promptToolRow}>
                    {feedback ? (
                      <Pressable
                        style={styles.translationButton}
                        onPress={() => setIsPreviousFeedbackOpen(true)}
                      >
                        <Text style={styles.translationButtonText}>이전 피드백 보기</Text>
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
                      <Text style={styles.rewriteContextEyebrow}>REWRITE MODE</Text>
                      <Text style={styles.rewriteContextBody}>
                        {feedback.completionMessage ?? feedback.summary ?? "방금 받은 피드백을 반영해 다시 써 보세요."}
                      </Text>
                      <Pressable
                        style={styles.rewriteContextButton}
                        onPress={() => setIsPreviousFeedbackOpen(true)}
                      >
                        <Text style={styles.rewriteContextButtonText}>이전 피드백 보기</Text>
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
                      style={styles.answerInput}
                      multiline
                      textAlignVertical="top"
                      placeholder="영어로 답안을 써 보세요."
                      placeholderTextColor="#AE9A87"
                      value={answer}
                      onChangeText={handleAnswerChange}
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
                    onPress={() => void handleSubmit()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#2E2416" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {feedback ? "다시 쓴 답변 제출하기" : "피드백 받기"}
                      </Text>
                    )}
                  </Pressable>
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

      <MobileNavBar activeTab="home" />
      <FeedbackLoadingOverlay
        visible={isSubmitting}
        title={feedbackLoadingTitle}
        message={feedbackLoadingMessage}
      />

      <Modal
        visible={isPreviousFeedbackOpen}
        animationType="slide"
        onRequestClose={() => setIsPreviousFeedbackOpen(false)}
      >
        <SafeAreaView style={styles.feedbackModalRoot} edges={["top", "bottom"]}>
          <View style={styles.feedbackModalHeader}>
            <View style={styles.feedbackModalHeaderText}>
              <Text style={styles.feedbackModalTitle}>이전 피드백 보기</Text>
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
              <Text style={styles.coachEyebrow}>WRITING GUIDE</Text>
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
              <Text style={styles.guideIntroTitle}>{answerGuide.title}</Text>
              <Text style={styles.guideIntroBody}>{answerGuide.description}</Text>
            </View>

            <View style={styles.guideStarterCard}>
              <Text style={styles.guideCardLabel}>첫 문장 스타터</Text>
              <Text style={styles.guideStarterText}>{answerGuide.starter}</Text>
            </View>

            <View style={styles.guideTipCard}>
              <Text style={styles.guideCardLabel}>권장 분량</Text>
              <Text style={styles.guideTipHeadline}>
                {`${answerGuide.sentenceRange[0]}-${answerGuide.sentenceRange[1]}문장 / ${answerGuide.wordRange[0]}-${answerGuide.wordRange[1]}단어`}
              </Text>
              <Text style={styles.guideTipBody}>짧아도 흐름만 보이면 충분해요.</Text>
            </View>

            <View style={styles.guideTipCard}>
              <Text style={styles.guideCardLabel}>지금 체크할 것</Text>
              <Text style={styles.guideTipHeadline}>{answerChecklistSummary}</Text>
              <Text style={styles.guideTipBody}>{answerProgressMessage}</Text>
            </View>

            <View style={styles.guideChecklistCard}>
              {answerGuide.checklist.map((item, index) => (
                <View key={item.title} style={styles.guideChecklistItem}>
                  <View style={styles.guideChecklistIndex}>
                    <Text style={styles.guideChecklistIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.guideChecklistCopy}>
                    <Text style={styles.guideChecklistTitle}>{item.title}</Text>
                    <Text style={styles.guideChecklistBody}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.guideFooterCard}>
              <Text style={styles.guideFooterTitle}>표현이 막히면 AI 코치를 눌러도 좋아요.</Text>
              <Text style={styles.guideFooterBody}>
                첫 문장이나 이유를 어떻게 붙일지 막힐 때는 입력창 안 마스코트에서 바로 도움을 받을 수 있어요.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isCoachOpen}
        animationType="slide"
        onRequestClose={() => setIsCoachOpen(false)}
      >
        <SafeAreaView style={styles.coachModalRoot} edges={["top", "bottom"]}>
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
                          <Pressable
                            key={expression.id}
                            style={styles.coachExpressionCard}
                            onPress={() => appendCoachExpression(expression.expression)}
                          >
                            <View style={styles.coachExpressionTop}>
                              <Text style={styles.coachExpressionText}>{expression.expression}</Text>
                              <Text style={styles.coachExpressionMeaning}>{expression.meaningKo}</Text>
                            </View>
                            <Text style={styles.coachExpressionTip}>{expression.usageTip}</Text>
                            <Text style={styles.coachExpressionExample}>{expression.example}</Text>
                          </Pressable>
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
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 28,
    gap: 18
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  ghostButton: {
    borderRadius: 999,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#75624B"
  },
  loadingCard: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  practiceFlowCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 18
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
    backgroundColor: "#FFF9F2"
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
    display: "none"
  },
  rewriteContextEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#A56B1F"
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
    borderRadius: 24,
    backgroundColor: "#FFF6E8",
    borderWidth: 1,
    borderColor: "#ECD5B5",
    padding: 18,
    gap: 8
  },
  guideCardLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#A56B1F"
  },
  guideStarterText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    color: "#4F3A21"
  },
  guideTipCard: {
    borderRadius: 24,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 18,
    gap: 8
  },
  guideTipHeadline: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  guideTipBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6E6151"
  },
  guideChecklistCard: {
    borderRadius: 28,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 18,
    gap: 14
  },
  guideChecklistItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  guideChecklistIndex: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    alignItems: "center",
    justifyContent: "center"
  },
  guideChecklistIndexText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#A76518"
  },
  guideChecklistCopy: {
    flex: 1,
    gap: 4
  },
  guideChecklistTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2C2520"
  },
  guideChecklistBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6D6050"
  },
  guideFooterCard: {
    borderRadius: 24,
    backgroundColor: "#FFF7EA",
    borderWidth: 1,
    borderColor: "#ECD5B5",
    padding: 18,
    gap: 8
  },
  guideFooterTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#5B4427"
  },
  guideFooterBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "#705E48"
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
  answerInput: {
    minHeight: 252,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 92,
    fontSize: 16,
    color: "#232128"
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
