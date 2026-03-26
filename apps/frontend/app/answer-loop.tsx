"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  ApiError,
  deleteWritingDraft,
  getCurrentUser,
  getDailyPrompts,
  getPromptHints,
  getTodayWritingStatus,
  getWritingDraft,
  saveWritingDraft,
  submitFeedback
} from "../lib/api";
import { saveHomeDraftForLogin, takeHomeDraftForLogin } from "../lib/auth-flow";
import {
  deleteLocalWritingDraft,
  getPreferredLocalWritingDraft,
  saveLocalWritingDraft
} from "../lib/home-writing-drafts";
import { getDifficultyLabel } from "../lib/difficulty";
import { getFeedbackLevelInfo } from "../lib/feedback-level";
import type {
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  Feedback,
  HomeDraftSnapshot,
  HomeFlowStep,
  PromptHint,
  TodayWritingStatus,
  WritingDraft,
  WritingDraftType
} from "../lib/types";
import { InlineFeedbackPreview } from "../components/inline-feedback-preview";
import styles from "./page.module.css";

const GUEST_ID_KEY = "writeloop_guest_id";
const GUEST_SESSION_ID_KEY = "writeloop_guest_session_id";
const GUEST_PROMPT_ID_KEY = "writeloop_guest_prompt_id";
const HOME_RETURN_TO = "/";

type Step = "pick" | "answer" | "feedback" | "rewrite" | "complete";
type PickFlowScreen = "difficulty" | "prompt";

const DIFFICULTY_OPTIONS: Array<{
  value: DailyDifficulty;
  label: string;
  description: string;
}> = [
  {
    value: "A",
    label: "EASY",
    description: "짧고 분명한 문장으로 가볍게 시작하기 좋아요."
  },
  {
    value: "B",
    label: "MEDIUM",
    description: "이유와 예시를 덧붙여 조금 더 길게 표현해보기 좋아요."
  },
  {
    value: "C",
    label: "HARD",
    description: "생각과 근거를 구조적으로 풀어내는 연습에 잘 맞아요."
  }
];

function getOrCreateGuestId() {
  if (typeof window === "undefined") {
    return "";
  }

  const saved = window.localStorage.getItem(GUEST_ID_KEY);
  if (saved) {
    return saved;
  }

  const created =
    window.crypto?.randomUUID?.() ??
    `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(GUEST_ID_KEY, created);
  return created;
}

type WritingGuide = {
  title: string;
  description: string;
  sentenceRange: [number, number];
  wordRange: [number, number];
  starter: string;
  checklist: Array<{
    title: string;
    description: string;
  }>;
};

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getWritingGuide(difficulty: DailyDifficulty, starterHint?: string | null): WritingGuide {
  switch (difficulty) {
    case "A":
      return {
        title: "짧고 분명한 답변부터 시작해 보세요.",
        description: "완벽한 표현보다 내 의견을 한 줄로 말하는 게 먼저예요.",
        sentenceRange: [2, 3],
        wordRange: [20, 40],
        starter: starterHint ?? "I think ... because ...",
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
        starter: starterHint ?? "In my opinion, ... One reason is that ...",
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
        starter: starterHint ?? "I believe ... because ... For example, ...",
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
        starter: starterHint ?? "I think ... because ...",
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

export function AnswerLoop() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DailyDifficulty>("A");
  const [pendingDifficultySelection, setPendingDifficultySelection] = useState<DailyDifficulty | null>(null);
  const [dailyRecommendation, setDailyRecommendation] =
    useState<DailyPromptRecommendation | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [guestSessionId, setGuestSessionId] = useState("");
  const [guestPromptId, setGuestPromptId] = useState("");
  const [answer, setAnswer] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [pickFlowScreen, setPickFlowScreen] = useState<PickFlowScreen>("difficulty");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isResolvingCurrentUser, setIsResolvingCurrentUser] = useState(true);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [showRewriteFeedback, setShowRewriteFeedback] = useState(false);
  const [showWritingGuide, setShowWritingGuide] = useState(false);
  const [showPreviousRewriteAnswer, setShowPreviousRewriteAnswer] = useState(false);
  const [showAnswerTranslation, setShowAnswerTranslation] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<PromptHint[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [didAttemptPersistedDraftRestore, setDidAttemptPersistedDraftRestore] = useState(false);
  const [draftStatusMessage, setDraftStatusMessage] = useState("");
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const celebrationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mobileComposerBarRef = useRef<HTMLDivElement | null>(null);
  const inlineHintDrawerRef = useRef<HTMLDivElement | null>(null);
  const knownPersistedDraftKeysRef = useRef<Set<string>>(new Set());
  const [mobileComposerBarHeight, setMobileComposerBarHeight] = useState(0);
  const [mobileInlineHintHeight, setMobileInlineHintHeight] = useState(0);

  useEffect(() => {
    setGuestId(getOrCreateGuestId());
    if (typeof window !== "undefined") {
      const storedSessionId = window.localStorage.getItem(GUEST_SESSION_ID_KEY) ?? "";
      const storedPromptId = window.localStorage.getItem(GUEST_PROMPT_ID_KEY) ?? "";
      setGuestSessionId(storedSessionId);
      setGuestPromptId(storedPromptId);
      setSessionId(storedSessionId);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsResolvingCurrentUser(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

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
    setPendingDifficultySelection(draft.selectedDifficulty);
    setSelectedPromptId(draft.selectedPromptId);
    setSessionId(draft.sessionId);
    setAnswer(draft.answer);
    setRewrite(draft.rewrite);
    setLastSubmittedAnswer(draft.lastSubmittedAnswer);
    setFeedback(draft.feedback);
    setStep(draft.step);
    setPickFlowScreen("prompt");
    setShowLoginWall(false);
    setError("");
    setShowRewriteFeedback(false);
    setShowAnswerTranslation(false);
    setShowHints(false);
  }, [currentUser, didRestoreDraft]);

  useEffect(() => {
    setDidAttemptPersistedDraftRestore(false);
  }, [selectedDifficulty, currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadTodayStatus() {
      if (!currentUser) {
        if (isMounted) {
          setTodayStatus(null);
        }
        return;
      }

      try {
        const status = await getTodayWritingStatus();
        if (isMounted) {
          setTodayStatus(status);
        }
      } catch {
        if (isMounted) {
          setTodayStatus(null);
        }
      }
    }

    void loadTodayStatus();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    async function loadDailyPrompts() {
      try {
        setIsLoadingPrompts(true);
        setError("");
        const recommendation = await getDailyPrompts(selectedDifficulty);
        if (!isMounted) {
          return;
        }

        setDailyRecommendation(recommendation);
        setRevealedTranslations({});
        setSelectedPromptId((current) => {
          if (recommendation.prompts.some((prompt) => prompt.id === current)) {
            return current;
          }
          return recommendation.prompts[0]?.id ?? "";
        });
      } catch {
        if (isMounted) {
          setDailyRecommendation(null);
          setSelectedPromptId("");
          setError("오늘의 질문을 불러오지 못했어요.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPrompts(false);
        }
      }
    }

    void loadDailyPrompts();

    return () => {
      isMounted = false;
    };
  }, [selectedDifficulty]);

  useEffect(() => {
    let isMounted = true;

    async function loadHints() {
      if (!selectedPromptId) {
        if (isMounted) {
          setHints([]);
          setShowHints(false);
          setIsLoadingHints(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setIsLoadingHints(true);
          setShowHints(false);
        }
        const nextHints = await getPromptHints(selectedPromptId);
        if (isMounted) {
          setHints(nextHints);
        }
      } catch {
        if (isMounted) {
          setHints([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingHints(false);
        }
      }
    }

    void loadHints();

    return () => {
      isMounted = false;
    };
  }, [selectedPromptId]);

  const prompts = useMemo(() => dailyRecommendation?.prompts ?? [], [dailyRecommendation]);
  const pendingDifficultyOption = useMemo(
    () => DIFFICULTY_OPTIONS.find((option) => option.value === pendingDifficultySelection) ?? null,
    [pendingDifficultySelection]
  );
  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId]
  );
  const vocabularyHints = useMemo(
    () => hints.filter((hint) => hint.hintType === "VOCAB"),
    [hints]
  );
  const starterHint = useMemo(
    () => hints.find((hint) => hint.hintType === "STARTER")?.content ?? null,
    [hints]
  );
  const answerGuide = useMemo(
    () => getWritingGuide(selectedPrompt?.difficulty ?? selectedDifficulty, starterHint),
    [selectedDifficulty, selectedPrompt?.difficulty, starterHint]
  );
  const answerWordCount = useMemo(() => countWords(answer), [answer]);
  const answerProgressMessage = useMemo(() => {
    if (!answer.trim()) {
      return "완벽하게 쓰려고 하기보다 의견 한 줄부터 적어보세요.";
    }

    if (answerWordCount < answerGuide.wordRange[0]) {
      return "좋아요. 이제 이유 한 줄만 더하면 권장 길이에 가까워져요.";
    }

    if (answerWordCount <= answerGuide.wordRange[1]) {
      return "지금 길이가 딱 좋아요. 짧은 예시를 하나 더하면 더 탄탄해져요.";
    }

    return "충분히 잘 쓰고 있어요. 표현만 한번 다듬고 제출해 보세요.";
  }, [answer, answerGuide, answerWordCount]);
  const answerChecklistSummary = useMemo(
    () => answerGuide.checklist.map((item) => item.title).join(" · "),
    [answerGuide]
  );
  const rewriteWordCount = useMemo(() => countWords(rewrite), [rewrite]);
  const mobileComposerBarStyle = useMemo(
    () =>
      ({
        "--mobile-composer-bar-height": `${mobileComposerBarHeight}px`,
        "--mobile-inline-hint-height": `${mobileInlineHintHeight}px`
      }) as CSSProperties,
    [mobileComposerBarHeight, mobileInlineHintHeight]
  );
  const suggestedFollowUpPrompt = useMemo(() => {
    if (prompts.length < 2) {
      return null;
    }

    const currentIndex = prompts.findIndex((prompt) => prompt.id === selectedPromptId);
    if (currentIndex < 0) {
      return prompts[0] ?? null;
    }

    for (let offset = 1; offset < prompts.length; offset += 1) {
      const candidate = prompts[(currentIndex + offset) % prompts.length];
      if (candidate && candidate.id !== selectedPromptId) {
        return candidate;
      }
    }

    return null;
  }, [prompts, selectedPromptId]);

  const isLoggedIn = Boolean(currentUser);
  const activeDraftType: WritingDraftType | null =
    step === "answer" ? "ANSWER" : step === "rewrite" ? "REWRITE" : null;
  const isGuestCycleComplete = Boolean(feedback && guestSessionId && feedback.attemptNo >= 2);
  const shouldSuggestFinish = Boolean(feedback?.loopComplete);
  const feedbackLevel = feedback ? getFeedbackLevelInfo(feedback.score, feedback.loopComplete) : null;
  const streakDays = todayStatus?.streakDays ?? 0;
  useEffect(() => {
    if (step !== "complete") {
      return;
    }

    const canvas = celebrationCanvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    async function runCelebration() {
      const { default: confetti } = await import("canvas-confetti");
      if (cancelled || !celebrationCanvasRef.current) {
        return;
      }

      const fire = confetti.create(celebrationCanvasRef.current, {
        resize: true,
        useWorker: true
      });

      const colors = ["#ff9f1a", "#ffd57a", "#2f7cf6", "#173058", "#ffffff"];
      const endAt = Date.now() + 2600;

      const launch = () => {
        fire({
          particleCount: 38,
          angle: 58,
          spread: 72,
          startVelocity: 56,
          gravity: 0.92,
          scalar: 1.18,
          origin: { x: 0.04, y: 0.92 },
          colors,
          zIndex: 0
        });

        fire({
          particleCount: 38,
          angle: 122,
          spread: 72,
          startVelocity: 56,
          gravity: 0.92,
          scalar: 1.18,
          origin: { x: 0.96, y: 0.92 },
          colors,
          zIndex: 0
        });

        fire({
          particleCount: 24,
          angle: 90,
          spread: 110,
          startVelocity: 46,
          gravity: 0.88,
          scalar: 0.96,
          origin: { x: 0.5, y: 0.78 },
          colors,
          zIndex: 0
        });

        if (Date.now() < endAt && !cancelled) {
          timeoutId = window.setTimeout(launch, 260);
        }
      };

      launch();
    }

    void runCelebration();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [step]);

  useEffect(() => {
    const node = mobileComposerBarRef.current;
    if (!node || typeof window === "undefined") {
      return;
    }

    const updateHeight = () => {
      setMobileComposerBarHeight(Math.ceil(node.getBoundingClientRect().height));
    };

    updateHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateHeight()) : null;

    resizeObserver?.observe(node);
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [step, answerWordCount, rewriteWordCount, isSubmitting]);

  useEffect(() => {
    if (!showHints) {
      setMobileInlineHintHeight(0);
      return;
    }

    const node = inlineHintDrawerRef.current;
    if (!node || typeof window === "undefined") {
      return;
    }

    const updateHeight = () => {
      setMobileInlineHintHeight(Math.ceil(node.getBoundingClientRect().height));
    };

    updateHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateHeight()) : null;

    resizeObserver?.observe(node);
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [showHints, step, vocabularyHints.length, isLoadingHints]);

  function togglePromptTranslation(promptId: string) {
    setRevealedTranslations((current) => ({
      ...current,
      [promptId]: !current[promptId]
    }));
  }

  const applyDraftSnapshot = useCallback((
    draft: HomeDraftSnapshot | WritingDraft,
    message = "이전 초안을 복원했어요."
  ) => {
    const nextPromptId = "promptId" in draft ? draft.promptId : draft.selectedPromptId;

    setSelectedDifficulty(draft.selectedDifficulty);
    setPendingDifficultySelection(draft.selectedDifficulty);
    setSelectedPromptId(nextPromptId);
    setSessionId(draft.sessionId);
    setAnswer(draft.answer);
    setRewrite(draft.rewrite);
    setLastSubmittedAnswer(draft.lastSubmittedAnswer);
    setFeedback(draft.feedback);
    setStep(draft.step as Step);
    setPickFlowScreen("prompt");
    setShowLoginWall(false);
    setError("");
    setShowRewriteFeedback(false);
    setShowWritingGuide(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
    setShowHints(false);
    setDraftStatusMessage(message);
  }, []);

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

    const localDraft = getPreferredLocalWritingDraft(promptId);
    if (localDraft) {
      markPersistedDraftKnown(promptId, localDraft.draftType, true);
      return localDraft;
    }

    markPersistedDraftKnown(promptId, "ANSWER", false);
    markPersistedDraftKnown(promptId, "REWRITE", false);
    return null;
  }, [isLoggedIn, markPersistedDraftKnown]);

  const clearPersistedDraft = useCallback(async (promptId: string, draftType: WritingDraftType) => {
    if (isLoggedIn) {
      try {
        await deleteWritingDraft(promptId, draftType);
      } finally {
        deleteLocalWritingDraft(promptId, draftType);
        markPersistedDraftKnown(promptId, draftType, false);
      }
      return;
    }

    deleteLocalWritingDraft(promptId, draftType);
    markPersistedDraftKnown(promptId, draftType, false);
  }, [isLoggedIn, markPersistedDraftKnown]);

  const restorePersistedDraft = useCallback(async (promptId: string): Promise<boolean> => {
    try {
      const draft = await loadPersistedDraft(promptId);
      if (!draft) {
        return false;
      }

      applyDraftSnapshot(draft);
      return true;
    } catch {
      return false;
    }
  }, [applyDraftSnapshot, loadPersistedDraft]);

  function resetFlowForPrompt(promptId: string) {
    setSelectedPromptId(promptId);
    setSessionId(promptId === guestPromptId ? guestSessionId : "");
    setFeedback(null);
    setAnswer("");
    setRewrite("");
    setLastSubmittedAnswer("");
    setError("");
    setShowLoginWall(false);
    setShowRewriteFeedback(false);
    setShowWritingGuide(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
    setShowHints(false);
    setDraftStatusMessage("");
    setStep("answer");
  }

  async function handlePickPrompt(promptId: string) {
    if (!isLoggedIn && guestSessionId && guestPromptId && promptId !== guestPromptId) {
      setShowLoginWall(true);
      setError(
        "게스트는 질문 1개만 시작할 수 있어요. 다른 질문으로 이어서 학습하려면 로그인해 주세요."
      );
      return;
    }

    if (await restorePersistedDraft(promptId)) {
      return;
    }

    resetFlowForPrompt(promptId);
  }

  function handleSelectDifficulty(nextDifficulty: DailyDifficulty) {
    setPendingDifficultySelection((current) => (current === nextDifficulty ? null : nextDifficulty));
    setError("");
  }

  function handleConfirmDifficultySelection() {
    if (!pendingDifficultySelection) {
      return;
    }

    if (pendingDifficultySelection !== selectedDifficulty) {
      setDailyRecommendation(null);
      setSelectedPromptId("");
      setIsLoadingPrompts(true);
    }

    setSelectedDifficulty(pendingDifficultySelection);
    setPickFlowScreen("prompt");
    setError("");
  }

  function handleFinishLoop() {
    setShowLoginWall(false);
    setError("");
    setStep("complete");
  }

  function handleTryAnotherPrompt() {
    setFeedback(null);
    setAnswer("");
    setRewrite("");
    setLastSubmittedAnswer("");
    setError("");
    setShowLoginWall(false);
    setShowRewriteFeedback(false);
    setShowWritingGuide(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
    setDraftStatusMessage("");
    setPendingDifficultySelection(selectedDifficulty);
    setPickFlowScreen("prompt");
    setStep("pick");
  }

  useEffect(() => {
    if (
      isResolvingCurrentUser ||
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
    isResolvingCurrentUser,
    rewrite,
    restorePersistedDraft,
    selectedPromptId,
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
              deleteLocalWritingDraft(selectedPromptId, activeDraftType);
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
              saveLocalWritingDraft(selectedPromptId, activeDraftType, buildHomeDraft());
              if (!cancelled) {
                markPersistedDraftKnown(selectedPromptId, activeDraftType, true);
                setDraftStatusMessage("서버 저장이 불안정해 이 기기에 임시저장했어요.");
              }
            }

            return;
          }

          saveLocalWritingDraft(selectedPromptId, activeDraftType, buildHomeDraft());
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
    step
  ]);

  function handleSubmit(nextAnswer: string, mode: "INITIAL" | "REWRITE") {
    if (!selectedPromptId || !nextAnswer.trim()) {
      setError("영어 답변을 먼저 입력해 주세요.");
      return;
    }

    if (!isLoggedIn && mode === "REWRITE" && isGuestCycleComplete) {
      setShowLoginWall(true);
      setError(
        "게스트는 질문 1개와 다시쓰기 1회까지만 체험할 수 있어요. 이어서 학습하려면 로그인해 주세요."
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    void submitFeedback({
      promptId: selectedPromptId,
      answer: nextAnswer.trim(),
      sessionId: sessionId || undefined,
      attemptType: mode,
      guestId: isLoggedIn ? undefined : guestId || undefined
    })
      .then((result) => {
        setFeedback(result);
        setSessionId(result.sessionId);
        setLastSubmittedAnswer(nextAnswer.trim());
        setStep("feedback");
        setDraftStatusMessage("");

        void clearPersistedDraft(selectedPromptId, mode === "INITIAL" ? "ANSWER" : "REWRITE").catch(
          () => undefined
        );

        if (isLoggedIn && result.loopComplete) {
          setTodayStatus((current) => ({
            date: current?.date ?? new Date().toISOString().slice(0, 10),
            completed: true,
            completedSessions: Math.max(1, current?.completedSessions ?? 0),
            startedSessions: Math.max(1, current?.startedSessions ?? 0),
            streakDays: Math.max(1, current?.streakDays ?? 0)
          }));
        }

        if (!isLoggedIn && !guestSessionId) {
          setGuestSessionId(result.sessionId);
          setGuestPromptId(selectedPromptId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(GUEST_SESSION_ID_KEY, result.sessionId);
            window.localStorage.setItem(GUEST_PROMPT_ID_KEY, selectedPromptId);
          }
        }

        setShowLoginWall(false);
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof ApiError && caughtError.code === "GUEST_LIMIT_REACHED") {
          setShowLoginWall(true);
          setError(caughtError.message);
          return;
        }

        setError("지금은 피드백을 생성할 수 없어요.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  function renderStepNavigation() {
    const labels = [
      { id: "difficulty", label: "난이도" },
      { id: "prompt", label: "질문 선택" },
      { id: "answer", label: "첫 답변" },
      { id: "feedback", label: "피드백" },
      { id: "rewrite", label: "다시쓰기" },
      { id: "complete", label: "완료" }
    ];
    const activeStepId =
      step === "pick" ? (pickFlowScreen === "difficulty" ? "difficulty" : "prompt") : step;
    const activeIndex = labels.findIndex((item) => item.id === activeStepId);

    return (
      <div className={styles.stepRail}>
        {labels.map((item, index) => {
          const isActive = item.id === activeStepId;
          const isComplete = activeIndex > index;

          return (
            <div
              key={item.id}
              className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ""} ${
                isComplete ? styles.stepItemComplete : ""
              }`}
            >
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
            </div>
          );
        })}
      </div>
    );
  }

  function renderStageHeader({
    stepNumber,
    title,
    description,
    meta,
    action
  }: {
    stepNumber: number;
    title: string;
    description?: string;
    meta?: string;
    action?: ReactNode;
  }) {
    return (
      <div className={styles.stageHeader}>
        <div className={styles.stageHeaderMain}>
          <div className={styles.stageHeaderTopRow}>
            <div className={styles.stageHeaderLead}>
              <span className={styles.stageStepLabel}>{stepNumber}단계</span>
              <h2>{title}</h2>
            </div>
            {meta ? <span className={styles.stageHeaderMeta}>{meta}</span> : null}
          </div>
          {description ? <p className={styles.stageHeaderDescription}>{description}</p> : null}
        </div>
        {action ? <div className={styles.stageHeaderAction}>{action}</div> : null}
      </div>
    );
  }

  function renderPickStep() {
    if (pickFlowScreen === "difficulty") {
      return (
        <section className={styles.pickFlow}>
          <article className={styles.welcomeCard}>
            <h1>{currentUser ? `${currentUser.displayName}님, 반가워요.` : "writeLoop에 온 걸 환영해요!"}</h1>
            <p>
              어느 정도 난이도로 시작할지 먼저 골라볼까요? 원하는 난이도를 고른 뒤 확인 버튼을 누르면
              질문 고르기로 넘어갑니다.
            </p>
          </article>

          <section className={styles.pickStage}>
            {renderStageHeader({
              stepNumber: 1,
              title: "난이도 선택",
              description: "오늘은 어느 정도 길이와 난이도로 시작할지 먼저 골라보세요."
            })}

            <div className={styles.difficultyStageGrid}>
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    pendingDifficultySelection === option.value
                      ? styles.difficultyStageButtonActive
                      : styles.difficultyStageButton
                  }
                  onClick={() => handleSelectDifficulty(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            <div className={styles.stageFooter}>
              <p>
                {pendingDifficultyOption
                  ? `${pendingDifficultyOption.label} 난이도로 시작할 준비가 됐어요.`
                  : "원하는 난이도를 먼저 선택해 주세요."}
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleConfirmDifficultySelection}
                disabled={!pendingDifficultySelection}
              >
                이 난이도로 시작하기
              </button>
            </div>
          </section>
        </section>
      );
    }

    return (
      <section className={styles.pickStage}>
        {renderStageHeader({
          stepNumber: 2,
          title: "질문 선택",
          description: dailyRecommendation
            ? `${dailyRecommendation.recommendedDate} 기준 추천 질문이에요.`
            : "선택한 난이도에 맞는 질문을 준비하고 있어요.",
          meta: getDifficultyLabel(selectedDifficulty),
          action: (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setPendingDifficultySelection(selectedDifficulty);
                setPickFlowScreen("difficulty");
              }}
            >
              난이도 다시 고르기
            </button>
          )
        })}

        <div className={styles.promptList}>
          {prompts.map((prompt) => {
            const isSelected = prompt.id === selectedPromptId;
            const isTranslationVisible = Boolean(revealedTranslations[prompt.id]);

            return (
              <article
                key={prompt.id}
                className={isSelected ? styles.promptActive : styles.promptCard}
                onClick={() => setSelectedPromptId(prompt.id)}
              >
                <strong>{prompt.topic}</strong>
                <span>{getDifficultyLabel(prompt.difficulty)}</span>
                <p>{prompt.questionEn}</p>
                {isTranslationVisible ? (
                  <small className={styles.translationText}>{prompt.questionKo}</small>
                ) : null}
                <div className={styles.promptActionRow}>
                  <button
                    type="button"
                    className={styles.promptTranslationButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePromptTranslation(prompt.id);
                    }}
                  >
                    {isTranslationVisible ? "번역 숨기기" : "번역 보기"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.stageFooter}>
          <p>
            {isLoadingPrompts
              ? "오늘의 질문을 준비하고 있어요."
              : "추천 질문 3개 중 하나를 골라 오늘의 작문을 시작해 보세요."}
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handlePickPrompt(selectedPromptId)}
            disabled={!selectedPromptId || isLoadingPrompts}
          >
            이 질문으로 시작하기
          </button>
        </div>
      </section>
    );
  }

  function renderVocabularyHintDrawer(emptyMessage: string) {
    if (vocabularyHints.length === 0) {
      return (
        <div ref={inlineHintDrawerRef} className={styles.inlineHintDrawer}>
          <p className={styles.inlineHintEmpty}>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div ref={inlineHintDrawerRef} className={styles.inlineHintDrawer}>
        <span className={styles.inlineHintBadge}>단어 힌트</span>
        <div className={styles.inlineHintList}>
          {vocabularyHints.map((hint) => (
            <p key={hint.id} className={styles.inlineHintItem}>
              {hint.content}
            </p>
          ))}
        </div>
      </div>
    );
  }

  function renderMobileComposerBar({
    wordCount,
    secondaryLabel,
    onSecondary,
    primaryLabel,
    onPrimary,
    primaryDisabled
  }: {
    wordCount: number;
    secondaryLabel: string;
    onSecondary: () => void;
    primaryLabel: string;
    onPrimary: () => void;
    primaryDisabled: boolean;
  }) {
    return (
      <div ref={mobileComposerBarRef} className={styles.mobileComposerBar}>
        <div className={styles.mobileComposerMeta}>
          <strong>{wordCount}단어</strong>
        </div>
        <div className={styles.mobileComposerActions}>
          <button type="button" className={styles.mobileComposerGhost} onClick={onSecondary}>
            {secondaryLabel}
          </button>
          <button
            type="button"
            className={styles.mobileComposerPrimary}
            onClick={onPrimary}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    );
  }

  function renderWritingComposer({
    value,
    onChange,
    placeholder
  }: {
    value: string;
    onChange: (nextValue: string) => void;
    placeholder: string;
  }) {
    return (
      <section className={styles.writingComposer}>
        <div className={styles.writingComposerQuestion}>
          <div className={styles.writingComposerHeader}>
            <span className={styles.writingComposerBadge}>{selectedPrompt?.topic ?? "오늘의 질문"}</span>
            <button
              type="button"
              className={`${styles.promptTranslationButton} ${styles.writingComposerToggle}`}
              onClick={() => setShowAnswerTranslation((current) => !current)}
            >
              {showAnswerTranslation ? "번역 숨기기" : "번역 보기"}
            </button>
          </div>
          <p className={styles.writingComposerQuestionText}>
            {selectedPrompt?.questionEn ?? "질문을 불러오는 중입니다."}
          </p>
          {showAnswerTranslation ? (
            <small className={styles.writingComposerTranslation}>
              {selectedPrompt?.questionKo ?? "질문 해석을 불러오는 중입니다."}
            </small>
          ) : null}
        </div>
        <div className={styles.writingComposerAnswer}>
          <textarea
            className={`${styles.textarea} ${styles.composerTextarea}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={8}
          />
        </div>
      </section>
    );
  }

  function renderAnswerStep() {
    return (
      <section className={styles.stage} style={mobileComposerBarStyle}>
        {renderStageHeader({
          stepNumber: 3,
          title: "첫 답변",
          description: "질문을 보고 영어로 짧고 분명하게 답해 보세요.",
          meta: selectedPrompt ? getDifficultyLabel(selectedPrompt.difficulty) : "..."
        })}
        {renderWritingComposer({
          value: answer,
          onChange: setAnswer,
          placeholder: "여기에 영어로 첫 답변을 작성해 주세요."
        })}
        <div className={styles.writingGuideToggleRow}>
          <button
            type="button"
            className={styles.writingGuideButton}
            onClick={() => setShowWritingGuide((current) => !current)}
          >
            {showWritingGuide ? "가이드 숨기기" : "가이드 보기"}
          </button>
          <span className={styles.writingGuideToggleMeta}>막힐 때만 짧게 열어보면 돼요.</span>
        </div>
        {showWritingGuide ? (
          <>
            <div className={`${styles.writingGuideTipLine} ${styles.writingGuideStarterTip}`}>
              <span className={styles.writingGuideStarterIcon} aria-hidden="true">
                &gt;
              </span>
              <div className={styles.writingGuideTipCopy}>
                <strong>첫 문장 스타터</strong>
                <span className={styles.writingGuideStarterValue}>{answerGuide.starter}</span>
              </div>
            </div>
            <section className={styles.writingGuidePanel}>
            <div className={styles.writingGuideTipLine}>
              <span className={styles.writingGuideTipIcon} aria-hidden="true">
                !
              </span>
              <div className={styles.writingGuideTipCopy}>
                <strong>
                  {answerGuide.sentenceRange[0]}-{answerGuide.sentenceRange[1]}문장 /{" "}
                  {answerGuide.wordRange[0]}-{answerGuide.wordRange[1]}단어 권장
                </strong>
                <span>짧아도 흐름만 보이면 충분해요.</span>
              </div>
            </div>
            <div className={styles.writingGuideTipLine}>
              <span className={styles.writingGuideTipIcon} aria-hidden="true">
                !
              </span>
              <div className={styles.writingGuideTipCopy}>
                <strong>{answerChecklistSummary}</strong>
                <span>{answerProgressMessage}</span>
              </div>
            </div>
            </section>
          </>
        ) : null}
        <div className={styles.inlineHintRow}>
          <button
            type="button"
            className={styles.inlineHintButton}
            onClick={() => setShowHints((current) => !current)}
            disabled={isLoadingHints || vocabularyHints.length === 0}
          >
            {isLoadingHints
              ? "단어 힌트 불러오는 중..."
              : showHints
                ? "단어 힌트 숨기기"
                : "단어 힌트 보기"}
          </button>
          <span className={styles.inlineHintMeta}>
            {isLoadingHints
              ? "지금 단어 힌트를 준비하고 있어요."
              : vocabularyHints.length > 0
                ? "표현이 막힐 때 단어 힌트만 짧게 확인해 보세요."
                : "이 질문에는 준비된 단어 힌트가 없어요."}
          </span>
        </div>
        {showHints ? renderVocabularyHintDrawer("이 질문에는 준비된 단어 힌트가 없어요.") : null}
        {draftStatusMessage ? <p className={styles.draftStatusText}>{draftStatusMessage}</p> : null}
        {renderMobileComposerBar({
          wordCount: answerWordCount,
          secondaryLabel: "질문 목록",
          onSecondary: () => setStep("pick"),
          primaryLabel: isSubmitting ? "피드백 생성 중..." : "답변 제출",
          onPrimary: () => handleSubmit(answer, "INITIAL"),
          primaryDisabled: isSubmitting || isLoadingPrompts
        })}
        <div className={styles.stageFooter}>
          <p>
            {isLoggedIn
              ? "로그인 상태에서는 질문 수 제한 없이 계속 학습할 수 있어요."
              : "게스트는 질문 1개와 다시쓰기 1회까지만 체험할 수 있어요."}
          </p>
          <div className={`${styles.actionRow} ${styles.composerDesktopActions}`}>
            <button type="button" className={styles.ghostButton} onClick={() => setStep("pick")}>
              오늘의 질문으로
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => handleSubmit(answer, "INITIAL")}
              disabled={isSubmitting || isLoadingPrompts}
            >
              {isSubmitting ? "피드백 생성 중..." : "답변 제출하기"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderFeedbackStep() {
    return (
      <section className={styles.stage}>
        {renderStageHeader({
          stepNumber: 4,
          title: "피드백",
          description: "내가 쓴 답변에서 잘한 점과 다듬을 부분을 확인해 보세요.",
          meta: feedback ? `${feedback.attemptNo}번째 시도 · ${feedbackLevel?.label ?? "대기 중"}` : "대기 중"
        })}
        {feedback ? (
          <div className={styles.feedbackBody}>
            <div className={styles.responseCard}>
              <h3>내가 제출한 답변</h3>
              <p>{lastSubmittedAnswer}</p>
            </div>
            <InlineFeedbackPreview
              originalAnswer={lastSubmittedAnswer}
              correctedAnswer={feedback.correctedAnswer}
              inlineFeedback={feedback.inlineFeedback}
            />
            <div className={styles.feedbackBlock}>
              <h3>전체 요약</h3>
              <p>{feedback.summary}</p>
            </div>
            <div className={styles.feedbackBlock}>
              <h3>잘한 점</h3>
              <ul className={styles.list}>
                {feedback.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
            <div className={styles.feedbackBlock}>
              <h3>개선하면 좋은 점</h3>
              <ul className={styles.list}>
                {feedback.corrections.map((correction) => (
                  <li key={correction.issue}>
                    <strong>{correction.issue}</strong>
                    <span>{correction.suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.feedbackBlock}>
              <h3>모범 답안</h3>
              <p>{feedback.modelAnswer}</p>
            </div>
            <div className={styles.feedbackBlock}>
              <h3>다시쓰기 가이드</h3>
              <p>{feedback.rewriteChallenge}</p>
            </div>
          </div>
        ) : (
          <p className={styles.placeholderText}>답변을 제출하면 여기에 피드백이 표시됩니다.</p>
        )}
        <div className={styles.stageFooter}>
          {shouldSuggestFinish ? (
            <div className={styles.completionCallout}>
              <span className={styles.completionCalloutBadge}>루프 완료 가능</span>
              <strong>{feedbackLevel?.label ?? "충분히 좋음"}</strong>
              <p>
                {feedback?.completionMessage ??
                  feedbackLevel?.summary ??
                  "이 답변은 지금 단계에서 마무리해도 충분해요."}
              </p>
            </div>
          ) : (
            <p>준비가 되면 피드백을 반영해서 다시 써 보세요.</p>
          )}
          <div className={styles.actionRow}>
            {shouldSuggestFinish ? (
              <button type="button" className={styles.primaryButton} onClick={handleFinishLoop}>
                오늘 루프 완료하고 도장 받기
              </button>
            ) : null}
            <button
              type="button"
              className={shouldSuggestFinish ? styles.ghostButton : styles.primaryButton}
              onClick={() => {
                setRewrite(lastSubmittedAnswer);
                setShowHints(false);
                setShowRewriteFeedback(false);
                setShowPreviousRewriteAnswer(false);
                setStep("rewrite");
              }}
              disabled={!feedback}
            >
              {shouldSuggestFinish ? "한 번 더 다듬기" : "다시 써보기"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderRewriteStep() {
    return (
      <section className={styles.stage} style={mobileComposerBarStyle}>
        {renderStageHeader({
          stepNumber: 5,
          title: "다시쓰기",
          description: "피드백을 반영해서 더 자연스럽고 구체적으로 다듬어 보세요.",
          meta: sessionId ? "같은 질문 이어쓰기" : "다시쓰기"
        })}
        {renderWritingComposer({
          value: rewrite,
          onChange: setRewrite,
          placeholder: "피드백을 반영한 영어 답변을 다시 작성해 주세요."
        })}
        <div className={styles.responseCard}>
          <div className={styles.mobileSectionHeader}>
            <h3>이전 답변</h3>
            <button
              type="button"
              className={styles.mobileSectionToggle}
              onClick={() => setShowPreviousRewriteAnswer((current) => !current)}
            >
              {showPreviousRewriteAnswer ? "접기" : "보기"}
            </button>
          </div>
          <div
            className={`${styles.mobileSectionBody} ${
              showPreviousRewriteAnswer ? styles.mobileSectionBodyOpen : ""
            }`}
          >
            <p>{lastSubmittedAnswer || "먼저 첫 답변을 제출해 주세요."}</p>
          </div>
        </div>
        {feedback ? (
          <section className={styles.rewriteFeedbackPanel}>
            <div className={styles.rewriteFeedbackHeader}>
              <div>
                <strong>이전 피드백</strong>
                <p>
                  {feedback.rewriteChallenge ?? "첫 답변에서 받은 피드백을 다시 보면서 문장을 다듬어 보세요."}
                </p>
              </div>
              <button
                type="button"
                className={styles.rewriteFeedbackToggle}
                onClick={() => setShowRewriteFeedback((current) => !current)}
              >
                {showRewriteFeedback ? "피드백 숨기기" : "피드백 보기"}
              </button>
            </div>
            {showRewriteFeedback ? (
              <div className={styles.rewriteFeedbackBody}>
                <InlineFeedbackPreview
                  originalAnswer={lastSubmittedAnswer}
                  correctedAnswer={feedback.correctedAnswer}
                  inlineFeedback={feedback.inlineFeedback}
                  compact
                />
                <div className={styles.rewriteFeedbackBlock}>
                  <h3>전체 요약</h3>
                  <p>{feedback.summary}</p>
                </div>
                <div className={styles.rewriteFeedbackBlock}>
                  <h3>잘한 점</h3>
                  <ul className={styles.list}>
                    {feedback.strengths.map((strength) => (
                      <li key={strength}>{strength}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.rewriteFeedbackBlock}>
                  <h3>개선하면 좋은 점</h3>
                  <ul className={styles.list}>
                    {feedback.corrections.map((correction) => (
                      <li key={correction.issue}>
                        <strong>{correction.issue}</strong>
                        <span>{correction.suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={styles.rewriteFeedbackBlock}>
                  <h3>모범 답안</h3>
                  <p>{feedback.modelAnswer}</p>
                </div>
                <div className={styles.rewriteFeedbackBlock}>
                  <h3>다시쓰기 가이드</h3>
                  <p>{feedback.rewriteChallenge}</p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        <div className={styles.inlineHintRow}>
          <button
            type="button"
            className={styles.inlineHintButton}
            onClick={() => setShowHints((current) => !current)}
            disabled={isLoadingHints || vocabularyHints.length === 0}
          >
            {isLoadingHints
              ? "단어 힌트 불러오는 중..."
              : showHints
                ? "단어 힌트 숨기기"
                : "단어 힌트 보기"}
          </button>
          <span className={styles.inlineHintMeta}>
            {isLoadingHints
              ? "지금 단어 힌트를 준비하고 있어요."
              : vocabularyHints.length > 0
                ? "다시쓰기 전에 필요한 단어 표현만 가볍게 보고 이어서 써보세요."
                : "이 질문에는 준비된 단어 힌트가 없어요."}
          </span>
        </div>
        {showHints ? renderVocabularyHintDrawer("이 질문에는 준비된 단어 힌트가 없어요.") : null}
        {draftStatusMessage ? <p className={styles.draftStatusText}>{draftStatusMessage}</p> : null}
        {renderMobileComposerBar({
          wordCount: rewriteWordCount,
          secondaryLabel: "피드백",
          onSecondary: () => setStep("feedback"),
          primaryLabel: isSubmitting ? "피드백 생성 중..." : "다시쓰기 제출",
          onPrimary: () => handleSubmit(rewrite, "REWRITE"),
          primaryDisabled: isSubmitting || !feedback
        })}
        <div className={styles.stageFooter}>
          <p>표현은 유지하되, 더 자연스럽고 구체적으로 문장을 다듬어 보세요.</p>
          <div className={`${styles.actionRow} ${styles.composerDesktopActions}`}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => setStep("feedback")}
            >
              피드백으로 돌아가기
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => handleSubmit(rewrite, "REWRITE")}
              disabled={isSubmitting || !feedback}
            >
              {isSubmitting ? "피드백 생성 중..." : "다시 쓴 답변 제출하기"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderCompleteStep() {
    return (
      <section className={styles.completeStage}>
        <canvas ref={celebrationCanvasRef} className={styles.celebrationCanvas} aria-hidden="true" />
        <div className={styles.completeBadge}>오늘의 루프 완주</div>
        <h2>오늘 writeLoop를 끝까지 완주했어요.</h2>
        <p>
          질문 선택부터 첫 답변, 피드백, 다시쓰기까지 한 사이클을 모두 마쳤어요.
        </p>
        <div className={styles.completeHighlightCard}>
          <span className={styles.completeHighlightBadge}>오늘의 평가</span>
          <strong>{feedbackLevel?.label ?? "충분히 좋음"}</strong>
          <p>{feedbackLevel?.loopSummary ?? "오늘 루프를 끝까지 마친 것만으로도 충분히 의미 있어요."}</p>
        </div>
        <div className={styles.completeSummary}>
          <div>
            <span>질문 주제</span>
            <strong>{selectedPrompt?.topic ?? "선택한 질문"}</strong>
          </div>
          <div>
            <span>최종 평가</span>
            <strong>{feedbackLevel?.label ?? "-"}</strong>
          </div>
        </div>
        {isLoggedIn ? (
          <div className={styles.completionRewardCard}>
            <div className={styles.completionRewardHeader}>
              <span className={styles.completionRewardBadge}>오늘의 완료 도장</span>
              <span className={styles.completionRewardStreak}>{streakDays}일 연속 학습</span>
            </div>
            <strong>오늘의 질문을 끝까지 마쳐 완료 도장을 받았어요.</strong>
            <p>
              {streakDays > 1
                ? `${streakDays}일째 writeLoop를 이어가고 있어요. 내일도 같은 흐름으로 이어가 보세요.`
                : "오늘부터 다시 연속 학습을 시작했어요. 내일도 짧게라도 이어가 보세요."}
            </p>
          </div>
        ) : null}
        {suggestedFollowUpPrompt ? (
          <div className={styles.completeFollowUpCard}>
            <div className={styles.completeFollowUpCopy}>
              <strong>비슷한 질문 하나 더 이어서 써볼까요?</strong>
              <p>
                같은 흐름을 유지하기 좋은 다음 질문이에요. 지금 바로 이어서 쓰면 오늘의 작문 감각을 더
                길게 가져갈 수 있어요.
              </p>
            </div>
            <div className={styles.completeFollowUpPrompt}>
              <span>{suggestedFollowUpPrompt.topic}</span>
              <p>{suggestedFollowUpPrompt.questionEn}</p>
            </div>
          </div>
        ) : null}
        <div className={styles.completeActions}>
          {suggestedFollowUpPrompt ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handlePickPrompt(suggestedFollowUpPrompt.id)}
              disabled={isLoadingPrompts}
            >
              비슷한 질문에 한번 더 답변하기
            </button>
          ) : null}
          <button
            type="button"
            className={suggestedFollowUpPrompt ? styles.ghostButton : styles.primaryButton}
            onClick={handleTryAnotherPrompt}
          >
            다른 질문 보기
          </button>
          <button type="button" className={styles.ghostButton} onClick={() => setStep("feedback")}>
            마지막 피드백 다시 보기
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className={styles.main}>
      {step !== "pick" ? renderStepNavigation() : null}

      {showLoginWall ? (
        <section className={styles.loginWall}>
          <div>
            <div className={styles.loginBadge}>게스트 체험 한도 도달</div>
            <h2>로그인하면 매일 더 많은 질문과 답변 기록을 이어갈 수 있어요.</h2>
            <p>
              게스트는 한 번의 질문 루프만 체험할 수 있어요. 로그인하면 여러 질문을 계속 풀고, 내 답변
              히스토리와 피드백도 한곳에서 확인할 수 있습니다.
            </p>
          </div>
          <div className={styles.loginActions}>
            <Link
              href={`/login?returnTo=${encodeURIComponent(HOME_RETURN_TO)}`}
              className={styles.primaryLink}
              onClick={persistDraftForLogin}
            >
              로그인하러 가기
            </Link>
            <Link
              href={`/register?returnTo=${encodeURIComponent(HOME_RETURN_TO)}`}
              className={styles.ghostLink}
              onClick={persistDraftForLogin}
            >
              회원가입하러 가기
            </Link>
            <button type="button" className={styles.ghostButton} onClick={() => setShowLoginWall(false)}>
              지금은 둘러보기
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {step === "pick" && renderPickStep()}
      {step === "answer" && renderAnswerStep()}
      {step === "feedback" && renderFeedbackStep()}
      {step === "rewrite" && renderRewriteStep()}
      {step === "complete" && renderCompleteStep()}
    </main>
  );
}
