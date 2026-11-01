import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { deleteWritingDraft, getWritingDraft, saveWritingDraft } from "../../lib/api";
import { saveHomeDraftForLogin, takeHomeDraftForLogin } from "../../lib/auth-flow";
import {
  deleteLocalWritingDraft,
  getPreferredLocalWritingDraft,
  saveLocalWritingDraft
} from "../../lib/home-writing-drafts";
import {
  buildIncompleteLoopPromptSnapshot,
  clearIncompleteLoopForPrompt,
  getIncompleteLoop,
  saveIncompleteLoop,
  type IncompleteLoopState,
  type IncompleteLoopStep
} from "../../lib/incomplete-loop";
import { getIncompleteLoopCopy, formatIncompleteLoopSavedAt } from "../../lib/incomplete-loop-copy";
import type {
  AuthUser,
  DailyDifficulty,
  Feedback,
  HomeDraftSnapshot,
  HomeFlowStep,
  Prompt,
  WritingDraft,
  WritingDraftType
} from "../../lib/types";
import type { PickFlowScreen } from "./pick-step";
import type { Step } from "./types";

type Setter<T> = Dispatch<SetStateAction<T>>;

// 초안 훅이 읽고 바꾸는 주 화면의 흐름 상태. AnswerLoop가 한 번 만들어 두 훅에 같은 것을 넘긴다.
export type WritingDraftFlow = {
  currentUser: AuthUser | null;
  isResolvingCurrentUser: boolean;
  selectedDifficulty: DailyDifficulty;
  setSelectedDifficulty: Setter<DailyDifficulty>;
  selectedPromptId: string;
  setSelectedPromptId: Setter<string>;
  sessionId: string;
  setSessionId: Setter<string>;
  answer: string;
  setAnswer: Setter<string>;
  rewrite: string;
  setRewrite: Setter<string>;
  lastSubmittedAnswer: string;
  setLastSubmittedAnswer: Setter<string>;
  feedback: Feedback | null;
  setFeedback: Setter<Feedback | null>;
  step: Step;
  setStep: Setter<Step>;
  setPickFlowScreen: Setter<PickFlowScreen>;
  setShowLoginWall: Setter<boolean>;
  closeCoachAssistant: () => void;
  setShowHelpSheet: Setter<boolean>;
  setError: Setter<string>;
  setShowRewriteFeedback: Setter<boolean>;
  setShowPreviousRewriteAnswer: Setter<boolean>;
  setShowAnswerTranslation: Setter<boolean>;
};

// 초안 상태와 함수, 그리고 로그인한 뒤 초안 되살리기·이어 쓰기 불러오기 효과.
// 효과의 실행 순서를 지키려고 AnswerLoop의 로그인 사용자 확인 효과 바로 뒤에서 부른다.
export function useWritingDrafts(flow: WritingDraftFlow) {
  const {
    currentUser,
    isResolvingCurrentUser,
    selectedDifficulty,
    setSelectedDifficulty,
    selectedPromptId,
    setSelectedPromptId,
    sessionId,
    setSessionId,
    answer,
    setAnswer,
    rewrite,
    setRewrite,
    lastSubmittedAnswer,
    setLastSubmittedAnswer,
    feedback,
    setFeedback,
    step,
    setStep,
    setPickFlowScreen,
    setShowLoginWall,
    closeCoachAssistant,
    setShowHelpSheet,
    setError,
    setShowRewriteFeedback,
    setShowPreviousRewriteAnswer,
    setShowAnswerTranslation
  } = flow;
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [didAttemptPersistedDraftRestore, setDidAttemptPersistedDraftRestore] = useState(false);
  const [draftStatusMessage, setDraftStatusMessage] = useState("");
  const [incompleteLoop, setIncompleteLoop] = useState<IncompleteLoopState | null>(null);
  const [isLoadingIncompleteLoop, setIsLoadingIncompleteLoop] = useState(true);
  const knownPersistedDraftKeysRef = useRef<Set<string>>(new Set());
  const isLoggedIn = Boolean(currentUser);

  useEffect(() => {
    if (!currentUser || didRestoreDraft) {
      return;
    }

    const draft = takeHomeDraftForLogin();
    setDidRestoreDraft(true);

    if (!draft) {
      return;
    }

    setSelectedDifficulty(draft.selectedDifficulty);
    setSelectedPromptId(draft.selectedPromptId);
    setSessionId(draft.sessionId);
    setAnswer(draft.answer);
    setRewrite(draft.rewrite);
    setLastSubmittedAnswer(draft.lastSubmittedAnswer);
    setFeedback(draft.feedback);
    setStep(draft.step);
    setPickFlowScreen("prompt");
    setShowLoginWall(false);
    closeCoachAssistant();
    setError("");
    setShowRewriteFeedback(false);
    setShowAnswerTranslation(false);
  }, [
    closeCoachAssistant,
    currentUser,
    didRestoreDraft,
    setAnswer,
    setError,
    setFeedback,
    setLastSubmittedAnswer,
    setPickFlowScreen,
    setRewrite,
    setSelectedDifficulty,
    setSelectedPromptId,
    setSessionId,
    setShowAnswerTranslation,
    setShowLoginWall,
    setShowRewriteFeedback,
    setStep
  ]);

  useEffect(() => {
    if (isResolvingCurrentUser) {
      return;
    }

    setIncompleteLoop(getIncompleteLoop(currentUser?.id ?? null));
    setIsLoadingIncompleteLoop(false);
  }, [currentUser?.id, isResolvingCurrentUser]);

  useEffect(() => {
    setDidAttemptPersistedDraftRestore(false);
  }, [selectedDifficulty, currentUser?.id]);

  const incompleteLoopCopy = useMemo(
    () => (incompleteLoop ? getIncompleteLoopCopy(incompleteLoop.step) : null),
    [incompleteLoop]
  );
  const incompleteLoopSavedAt = useMemo(
    () => (incompleteLoop ? formatIncompleteLoopSavedAt(incompleteLoop.updatedAt) : ""),
    [incompleteLoop]
  );

  const applyDraftSnapshot = useCallback((
    draft: HomeDraftSnapshot | WritingDraft,
    message = "이전 초안을 복원했어요."
  ) => {
    const nextPromptId = "promptId" in draft ? draft.promptId : draft.selectedPromptId;
    const restoredLastSubmittedAnswer =
      draft.lastSubmittedAnswer.trim() ||
      ((draft.step === "feedback" || draft.step === "rewrite")
        ? draft.answer.trim() || draft.rewrite.trim()
        : "");

    setSelectedDifficulty(draft.selectedDifficulty);
    setSelectedPromptId(nextPromptId);
    setSessionId(draft.sessionId);
    setAnswer(draft.answer);
    setRewrite(draft.rewrite);
    setLastSubmittedAnswer(restoredLastSubmittedAnswer);
    setFeedback(draft.feedback);
    setStep(draft.step as Step);
    setPickFlowScreen("prompt");
    setShowLoginWall(false);
    closeCoachAssistant();
    setShowHelpSheet(false);
    setError("");
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
    setDraftStatusMessage(message);
  }, [
    closeCoachAssistant,
    setAnswer,
    setError,
    setFeedback,
    setLastSubmittedAnswer,
    setPickFlowScreen,
    setRewrite,
    setSelectedDifficulty,
    setSelectedPromptId,
    setSessionId,
    setShowAnswerTranslation,
    setShowHelpSheet,
    setShowLoginWall,
    setShowPreviousRewriteAnswer,
    setShowRewriteFeedback,
    setStep
  ]);

  const buildHomeDraft = useCallback((): HomeDraftSnapshot => {
    return {
      selectedDifficulty,
      selectedPromptId,
      sessionId,
      answer,
      rewrite,
      lastSubmittedAnswer,
      feedback,
      step: step as HomeFlowStep
    };
  }, [answer, feedback, lastSubmittedAnswer, rewrite, selectedDifficulty, selectedPromptId, sessionId, step]);

  function persistDraftForLogin() {
    saveHomeDraftForLogin(buildHomeDraft());
  }

  const buildPersistedDraftKey = useCallback(
    (promptId: string, draftType: WritingDraftType) => `${promptId}:${draftType}`,
    []
  );

  const markPersistedDraftKnown = useCallback(
    (promptId: string, draftType: WritingDraftType, exists: boolean) => {
      const key = buildPersistedDraftKey(promptId, draftType);
      if (exists) {
        knownPersistedDraftKeysRef.current.add(key);
        return;
      }

      knownPersistedDraftKeysRef.current.delete(key);
    },
    [buildPersistedDraftKey]
  );

  const hasKnownPersistedDraft = useCallback(
    (promptId: string, draftType: WritingDraftType) =>
      knownPersistedDraftKeysRef.current.has(buildPersistedDraftKey(promptId, draftType)),
    [buildPersistedDraftKey]
  );

  const buildSaveDraftRequest = useCallback((draftType: WritingDraftType) => {
    const snapshot = buildHomeDraft();

    return {
      draftType,
      selectedDifficulty: snapshot.selectedDifficulty,
      sessionId: snapshot.sessionId,
      answer: snapshot.answer,
      rewrite: snapshot.rewrite,
      lastSubmittedAnswer: snapshot.lastSubmittedAnswer,
      feedback: snapshot.feedback,
      step: snapshot.step
    } as const;
  }, [buildHomeDraft]);

  const loadPersistedDraft = useCallback(async (promptId: string): Promise<WritingDraft | null> => {
    if (isLoggedIn) {
      try {
        const rewriteDraft = await getWritingDraft(promptId, "REWRITE");
        if (rewriteDraft) {
          markPersistedDraftKnown(promptId, "REWRITE", true);
          return rewriteDraft;
        }

        markPersistedDraftKnown(promptId, "REWRITE", false);

        const answerDraft = await getWritingDraft(promptId, "ANSWER");
        if (answerDraft) {
          markPersistedDraftKnown(promptId, "ANSWER", true);
          return answerDraft;
        }

        markPersistedDraftKnown(promptId, "ANSWER", false);
      } catch {
        // Fall back to a local draft if the server-side draft store is temporarily unavailable.
      }
    }

    const localDraft = getPreferredLocalWritingDraft(promptId, currentUser?.id ?? null);
    if (localDraft) {
      markPersistedDraftKnown(promptId, localDraft.draftType, true);
      return localDraft;
    }

    markPersistedDraftKnown(promptId, "ANSWER", false);
    markPersistedDraftKnown(promptId, "REWRITE", false);
    return null;
  }, [currentUser?.id, isLoggedIn, markPersistedDraftKnown]);

  const clearPersistedDraft = useCallback(async (promptId: string, draftType: WritingDraftType) => {
    if (isLoggedIn) {
      try {
        await deleteWritingDraft(promptId, draftType);
      } finally {
        deleteLocalWritingDraft(promptId, draftType, currentUser?.id ?? null);
        markPersistedDraftKnown(promptId, draftType, false);
      }
      return;
    }

    deleteLocalWritingDraft(promptId, draftType, currentUser?.id ?? null);
    markPersistedDraftKnown(promptId, draftType, false);
  }, [currentUser?.id, isLoggedIn, markPersistedDraftKnown]);

  const clearVisibleIncompleteLoop = useCallback((promptId: string, step?: IncompleteLoopStep) => {
    clearIncompleteLoopForPrompt(promptId, step, currentUser?.id ?? null);
    setIncompleteLoop((current) => {
      if (!current || current.promptId !== promptId) {
        return current;
      }

      if (step && current.step !== step) {
        return current;
      }

      return null;
    });
  }, [currentUser?.id]);

  const restorePersistedDraft = useCallback(async (
    promptId: string,
    message?: string
  ): Promise<boolean> => {
    try {
      const draft = await loadPersistedDraft(promptId);
      if (!draft) {
        return false;
      }

      applyDraftSnapshot(draft, message);
      return true;
    } catch {
      return false;
    }
  }, [applyDraftSnapshot, loadPersistedDraft]);

  const handleResumeIncompleteLoop = useCallback(async () => {
    if (!incompleteLoop) {
      return;
    }

    const resumeMessage = "이어서 쓰던 흐름을 불러왔어요.";

    if (incompleteLoop.step !== "feedback") {
      const restored = await restorePersistedDraft(incompleteLoop.promptId, resumeMessage);
      if (restored) {
        return;
      }
    }

    if (incompleteLoop.snapshot) {
      applyDraftSnapshot(incompleteLoop.snapshot, resumeMessage);
      return;
    }

    setSelectedDifficulty(incompleteLoop.difficulty);
    setSelectedPromptId(incompleteLoop.promptId);
    setPickFlowScreen("prompt");
    setError("이전 내용을 바로 불러오지 못해 질문부터 다시 열어두었어요.");
  }, [
    applyDraftSnapshot,
    incompleteLoop,
    restorePersistedDraft,
    setError,
    setPickFlowScreen,
    setSelectedDifficulty,
    setSelectedPromptId
  ]);

  return {
    draftStatusMessage,
    setDraftStatusMessage,
    didAttemptPersistedDraftRestore,
    setDidAttemptPersistedDraftRestore,
    incompleteLoop,
    setIncompleteLoop,
    isLoadingIncompleteLoop,
    incompleteLoopCopy,
    incompleteLoopSavedAt,
    buildHomeDraft,
    persistDraftForLogin,
    hasKnownPersistedDraft,
    markPersistedDraftKnown,
    buildSaveDraftRequest,
    clearPersistedDraft,
    clearVisibleIncompleteLoop,
    restorePersistedDraft,
    handleResumeIncompleteLoop
  };
}

export type WritingDraftsState = ReturnType<typeof useWritingDrafts>;

// 고른 질문의 초안 자동 복원, 이어 쓰기 저장, 자동 임시저장 효과.
// 효과의 실행 순서를 지키려고 AnswerLoop의 handleSubmit 바로 앞에서 부른다.
export function useWritingDraftAutosave(
  drafts: WritingDraftsState,
  flow: WritingDraftFlow,
  selectedPrompt: Prompt | null
) {
  const {
    currentUser,
    isResolvingCurrentUser,
    selectedDifficulty,
    selectedPromptId,
    sessionId,
    answer,
    rewrite,
    lastSubmittedAnswer,
    feedback,
    step
  } = flow;
  const {
    setDraftStatusMessage,
    didAttemptPersistedDraftRestore,
    setDidAttemptPersistedDraftRestore,
    incompleteLoop,
    setIncompleteLoop,
    isLoadingIncompleteLoop,
    buildHomeDraft,
    hasKnownPersistedDraft,
    markPersistedDraftKnown,
    buildSaveDraftRequest,
    clearPersistedDraft,
    clearVisibleIncompleteLoop,
    restorePersistedDraft
  } = drafts;
  const isLoggedIn = Boolean(currentUser);
  const activeDraftType: WritingDraftType | null =
    step === "answer" ? "ANSWER" : step === "rewrite" ? "REWRITE" : null;

  useEffect(() => {
    if (
      isResolvingCurrentUser ||
      isLoadingIncompleteLoop ||
      incompleteLoop ||
      didAttemptPersistedDraftRestore ||
      step !== "pick" ||
      !selectedPromptId ||
      answer.trim() ||
      rewrite.trim() ||
      feedback
    ) {
      return;
    }

    let cancelled = false;
    setDidAttemptPersistedDraftRestore(true);

    async function tryRestorePersistedDraft() {
      const restored = await restorePersistedDraft(selectedPromptId);
      if (!restored && !cancelled) {
        setDraftStatusMessage("");
      }
    }

    void tryRestorePersistedDraft();

    return () => {
      cancelled = true;
    };
  }, [
    answer,
    didAttemptPersistedDraftRestore,
    feedback,
    incompleteLoop,
    isLoadingIncompleteLoop,
    isResolvingCurrentUser,
    rewrite,
    restorePersistedDraft,
    selectedPromptId,
    setDidAttemptPersistedDraftRestore,
    setDraftStatusMessage,
    step
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || isResolvingCurrentUser || !selectedPromptId) {
      return;
    }

    if (step === "complete") {
      clearVisibleIncompleteLoop(selectedPromptId);
      return;
    }

    if (step !== "answer" && step !== "feedback" && step !== "rewrite") {
      return;
    }

    if (!selectedPrompt) {
      return;
    }

    const snapshot = buildHomeDraft();
    const hasResumeContent =
      step === "feedback"
        ? Boolean(snapshot.feedback)
        : step === "rewrite"
          ? Boolean(snapshot.rewrite.trim() || snapshot.lastSubmittedAnswer.trim() || snapshot.feedback)
          : Boolean(snapshot.answer.trim() || snapshot.feedback);

    if (!hasResumeContent) {
      clearVisibleIncompleteLoop(selectedPromptId, step);
      return;
    }

    const nextLoop: IncompleteLoopState = {
      promptId: selectedPromptId,
      difficulty: selectedDifficulty,
      step,
      draftType: activeDraftType ?? (step === "rewrite" ? "REWRITE" : "ANSWER"),
      sessionId: sessionId || undefined,
      updatedAt: new Date().toISOString(),
      promptSnapshot: buildIncompleteLoopPromptSnapshot(selectedPrompt),
      snapshot
    };

    saveIncompleteLoop(nextLoop, currentUser?.id ?? null);
    setIncompleteLoop(nextLoop);
  }, [
    activeDraftType,
    answer,
    buildHomeDraft,
    clearVisibleIncompleteLoop,
    feedback,
    isResolvingCurrentUser,
    lastSubmittedAnswer,
    rewrite,
    selectedDifficulty,
    selectedPrompt,
    selectedPromptId,
    sessionId,
    setIncompleteLoop,
    currentUser?.id,
    step
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || isResolvingCurrentUser || !selectedPromptId || !activeDraftType) {
      return;
    }

    const currentContent = activeDraftType === "ANSWER" ? answer : rewrite;
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      const persist = async () => {
        if (!currentContent.trim()) {
          if (!hasKnownPersistedDraft(selectedPromptId, activeDraftType)) {
            if (!cancelled) {
              setDraftStatusMessage("");
            }
            return;
          }

          try {
            await clearPersistedDraft(selectedPromptId, activeDraftType);
            if (!cancelled) {
              setDraftStatusMessage("");
            }
          } catch {
            if (!cancelled) {
              setDraftStatusMessage("");
            }
          }
          return;
        }

        try {
          if (isLoggedIn) {
            try {
              const savedDraft = await saveWritingDraft(
                selectedPromptId,
                buildSaveDraftRequest(activeDraftType)
              );
              deleteLocalWritingDraft(selectedPromptId, activeDraftType, currentUser?.id ?? null);
              if (!cancelled) {
                markPersistedDraftKnown(selectedPromptId, activeDraftType, true);
                const savedAt = new Date(savedDraft.updatedAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit"
                });
                setDraftStatusMessage(`임시저장됨 · ${savedAt}`);
              }
              return;
            } catch {
              saveLocalWritingDraft(selectedPromptId, activeDraftType, buildHomeDraft(), currentUser?.id ?? null);
              if (!cancelled) {
                markPersistedDraftKnown(selectedPromptId, activeDraftType, true);
                setDraftStatusMessage("서버 저장이 불안정해 이 기기에 임시저장했어요.");
              }
            }

            return;
          }

          saveLocalWritingDraft(selectedPromptId, activeDraftType, buildHomeDraft(), currentUser?.id ?? null);
          if (!cancelled) {
            markPersistedDraftKnown(selectedPromptId, activeDraftType, true);
            setDraftStatusMessage("이 기기에 임시저장됨");
          }
        } catch {
          if (!cancelled) {
            setDraftStatusMessage(
              isLoggedIn ? "임시저장에 실패했어요." : "이 기기에 임시저장하지 못했어요."
            );
          }
        }
      };

      void persist();
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeDraftType,
    answer,
    buildHomeDraft,
    buildSaveDraftRequest,
    clearPersistedDraft,
    feedback,
    hasKnownPersistedDraft,
    isLoggedIn,
    isResolvingCurrentUser,
    lastSubmittedAnswer,
    markPersistedDraftKnown,
    rewrite,
    selectedDifficulty,
    selectedPromptId,
    sessionId,
    setDraftStatusMessage,
    currentUser?.id,
    step
  ]);
}
