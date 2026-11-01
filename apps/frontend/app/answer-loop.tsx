"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import {
  ApiError,
  completeFeedbackSession,
  getFeaturedDailyPrompt,
  getCurrentUser,
  getDailyPrompts,
  getMonthStatus,
  getPrompts,
  getPromptHints,
  getTodayWritingStatus,
  submitFeedback,
  trackDailyPromptClick
} from "../lib/api";
import { isDailyDifficulty, resolvePracticeDifficulty } from "../lib/difficulty";
import { getOrCreateGuestId } from "../lib/guest-id";
import type {
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  FeaturedDailyPromptRecommendation,
  Feedback,
  Prompt,
  PromptHint,
  TodayWritingStatus
} from "../lib/types";
import { MonthStatusModal } from "../components/answer-loop/month-status-modal";
import { useMonthStatus } from "../components/answer-loop/use-month-status";
import { useSavedExpressions } from "../components/answer-loop/use-saved-expressions";
import { CoachAssistantModal } from "../components/answer-loop/coach-assistant-modal";
import { useCoachAssistant, useCoachAssistantDialogEffect } from "../components/answer-loop/use-coach-assistant";
import { deriveFeedbackView } from "../components/answer-loop/feedback-view";
import { FeedbackLoadingOverlay, FeedbackStep } from "../components/answer-loop/feedback-screen";
import { PickStep, type PickFlowScreen } from "../components/answer-loop/pick-step";
import { AnswerStep, CompleteStep, HelpSheet, RewriteStep } from "../components/answer-loop/writing-steps";
import {
  useWritingDraftAutosave,
  useWritingDrafts,
  type WritingDraftFlow
} from "../components/answer-loop/use-writing-drafts";
import type { PracticeExpressionHint, Step } from "../components/answer-loop/types";
import { countWords } from "../lib/text";
import { buildRelatedPromptRecommendations } from "../lib/prompt-recommendations";
import { parseLocalDate, addDays, formatDateKey, buildWelcomeWeek, MonthView, createMonthView } from "../lib/writing-calendar";
import { getWritingGuide } from "../lib/writing-guide";
import styles from "./page.module.css";

const GUEST_SESSION_ID_KEY = "writeloop_guest_session_id";
const GUEST_PROMPT_ID_KEY = "writeloop_guest_prompt_id";
const HOME_RETURN_TO = "/";

function createSubmissionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parsePracticeExpressionsParam(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function AnswerLoop() {
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<DailyDifficulty>("I");
  const [dailyRecommendation, setDailyRecommendation] =
    useState<DailyPromptRecommendation | null>(null);
  const [featuredDailyPrompt, setFeaturedDailyPrompt] =
    useState<FeaturedDailyPromptRecommendation | null>(null);
  const [isLandingFeaturedPromptTranslationVisible, setIsLandingFeaturedPromptTranslationVisible] =
    useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [sessionId, setSessionId] = useState("");
  // 서버에서 완료한 세션. 완료 화면에서 피드백을 다시 볼 때 다시쓰기를 막는다(서버가 409로 거부).
  const [completedSessionId, setCompletedSessionId] = useState("");
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
  const [isLoadingFeaturedPrompt, setIsLoadingFeaturedPrompt] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [pickFlowScreen, setPickFlowScreen] = useState<PickFlowScreen>("difficulty");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isResolvingCurrentUser, setIsResolvingCurrentUser] = useState(true);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [welcomeCompletedDateKeys, setWelcomeCompletedDateKeys] = useState<string[]>([]);
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [showRewriteFeedback, setShowRewriteFeedback] = useState(false);
  const [showPreviousRewriteAnswer, setShowPreviousRewriteAnswer] = useState(false);
  const [areAllLanguageCorrectionsVisible, setAreAllLanguageCorrectionsVisible] =
    useState(false);
  const [showAnswerTranslation, setShowAnswerTranslation] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const rewriteFeedbackPanelRef = useRef<HTMLElement | null>(null);
  const [hints, setHints] = useState<PromptHint[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const coach = useCoachAssistant();
  const closeCoachAssistant = coach.close;
  const [practiceExpressionHint, setPracticeExpressionHint] = useState<PracticeExpressionHint | null>(null);
  const [questionRefreshHistory, setQuestionRefreshHistory] = useState<string[]>([]);
  const [isRefreshingQuestion, setIsRefreshingQuestion] = useState(false);
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const [isFinishingLoop, setIsFinishingLoop] = useState(false);
  const celebrationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mobileComposerBarRef = useRef<HTMLDivElement | null>(null);
  const helpSheetCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingSubmissionRef = useRef<{
    promptId: string;
    answer: string;
    mode: "INITIAL" | "REWRITE";
    submissionId: string;
  } | null>(null);
  const practiceParamsAppliedRef = useRef(false);
  const [mobileComposerBarHeight, setMobileComposerBarHeight] = useState(0);

  useEffect(() => {
    if (step === "feedback" || step === "rewrite") {
    }
  }, [feedback?.attemptNo, step]);

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
    if (typeof window === "undefined" || practiceParamsAppliedRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const promptId = params.get("promptId")?.trim() ?? "";
    const rawDifficulty = params.get("difficulty")?.trim().toUpperCase() ?? "";
    const prefillExpression = params.get("prefillExpression")?.trim() ?? "";
    const practiceTag = params.get("practiceTag")?.trim() ?? "";
    const practiceTagLabel = params.get("practiceTagLabel")?.trim() ?? "";
    const practiceExpressions = parsePracticeExpressionsParam(params.get("practiceExpressions"));
    const expressionList = practiceExpressions.length > 0
      ? practiceExpressions
      : prefillExpression
        ? [prefillExpression]
        : [];

    if (!promptId || !isDailyDifficulty(rawDifficulty) || expressionList.length === 0) {
      return;
    }

    practiceParamsAppliedRef.current = true;
    setSelectedDifficulty(rawDifficulty);
    setSelectedPromptId(promptId);
    setPracticeExpressionHint({
      expression: expressionList[0],
      tag: practiceTag || null,
      tagLabel: practiceTagLabel || null,
      expressions: expressionList
    });
    setPickFlowScreen("prompt");
    setStep("answer");
    setError("");
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

  const draftFlow: WritingDraftFlow = {
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
  };
  const drafts = useWritingDrafts(draftFlow);

  useEffect(() => {
    setQuestionRefreshHistory([]);
  }, [selectedDifficulty, guestId, currentUser?.id]);

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

    async function loadWelcomeHistory() {
      if (!currentUser) {
        if (isMounted) {
          setWelcomeCompletedDateKeys([]);
        }
        return;
      }

      const referenceDate = todayStatus?.date ? parseLocalDate(todayStatus.date) : new Date();
      const startDate = addDays(referenceDate, -6);
      const targetMonths = new Map<string, MonthView>();

      [startDate, referenceDate].forEach((date) => {
        const view = createMonthView(date);
        targetMonths.set(`${view.year}-${view.month}`, view);
      });

      try {
        const monthResults = await Promise.all(
          Array.from(targetMonths.values()).map((view) => getMonthStatus(view.year, view.month))
        );
        if (!isMounted) {
          return;
        }

        const completedKeys = monthResults
          .flatMap((status) => status.days)
          .filter((day) => day.completed)
          .map((day) => day.date);

        setWelcomeCompletedDateKeys(Array.from(new Set(completedKeys)));
      } catch {
        if (isMounted) {
          setWelcomeCompletedDateKeys([]);
        }
      }
    }

    void loadWelcomeHistory();

    return () => {
      isMounted = false;
    };
  }, [currentUser, todayStatus?.date]);

  useEffect(() => {
    let isMounted = true;

    async function loadAllPrompts() {
      try {
        const nextPrompts = await getPrompts();
        if (isMounted) {
          setAllPrompts(nextPrompts);
        }
      } catch {
        if (isMounted) {
          setAllPrompts([]);
        }
      }
    }

    void loadAllPrompts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  const monthStatusModal = useMonthStatus(currentUser, todayStatus);
  useCoachAssistantDialogEffect(coach);

  useEffect(() => {
    if (
      !showHelpSheet ||
      !isMobileViewport ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowHelpSheet(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      helpSheetCloseButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        window.requestAnimationFrame(() => {
          previousActiveElement.focus();
        });
      }
    };
  }, [showHelpSheet, isMobileViewport]);

  useEffect(() => {
    let isMounted = true;

    async function loadFeaturedPrompt() {
      if (pickFlowScreen !== "difficulty" || isResolvingCurrentUser) {
        return;
      }

      if (!currentUser && !guestId) {
        return;
      }

      try {
        setIsLoadingFeaturedPrompt(true);
        const recommendation = await getFeaturedDailyPrompt(selectedDifficulty, guestId || undefined);
        if (!isMounted) {
          return;
        }
        setFeaturedDailyPrompt(recommendation);
      } catch {
        if (isMounted) {
          setFeaturedDailyPrompt(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingFeaturedPrompt(false);
        }
      }
    }

    void loadFeaturedPrompt();

    return () => {
      isMounted = false;
    };
  }, [currentUser, currentUser?.id, guestId, isResolvingCurrentUser, pickFlowScreen, selectedDifficulty]);

  // 추천 질문 목록이 도착했을 때 지금 단계와 전체 질문 목록을 읽으려고 둔다.
  // 효과의 의존성에 넣으면 단계가 바뀔 때마다 목록을 다시 부르게 된다.
  const stepRef = useRef(step);
  const allPromptsRef = useRef(allPrompts);
  useEffect(() => {
    stepRef.current = step;
    allPromptsRef.current = allPrompts;
  }, [step, allPrompts]);

  useEffect(() => {
    let isMounted = true;

    async function loadDailyPrompts() {
      if (pickFlowScreen !== "prompt" || isResolvingCurrentUser) {
        if (isMounted) {
          setIsLoadingPrompts(false);
        }
        return;
      }

      if (!currentUser && !guestId) {
        if (isMounted) {
          setIsLoadingPrompts(true);
        }
        return;
      }

      try {
        setIsLoadingPrompts(true);
        setError("");
        const recommendation = await getDailyPrompts(selectedDifficulty, guestId || undefined);
        if (!isMounted) {
          return;
        }

        setDailyRecommendation(recommendation);
        setRevealedTranslations({});
        setSelectedPromptId((current) => {
          if (recommendation.prompts.some((prompt) => prompt.id === current)) {
            return current;
          }
          // 답 쓰기·피드백·다시 쓰기·완료 화면에서는 이어 쓰던 질문을 그대로 둔다(그날 추천 목록에 없어도).
          // 전체 질문 목록에도 없는 잘못된 질문이면 지금처럼 첫 질문을 고른다. 전체 목록을 아직 못 받았으면 그대로 두고,
          // 전체 목록이 나중에 와도 다시 판단하지 않는다.
          const knownPrompts = allPromptsRef.current;
          if (
            current &&
            stepRef.current !== "pick" &&
            (knownPrompts.length === 0 || knownPrompts.some((prompt) => prompt.id === current))
          ) {
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
  }, [currentUser, currentUser?.id, guestId, isResolvingCurrentUser, pickFlowScreen, selectedDifficulty]);

  useEffect(() => {
    let isMounted = true;

    async function loadHints() {
      if (!selectedPromptId) {
        if (isMounted) {
          setHints([]);
          setIsLoadingHints(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setIsLoadingHints(true);
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
  const landingFeaturedPromptItem = featuredDailyPrompt?.featured ?? null;
  const landingFeaturedPrompt = landingFeaturedPromptItem?.prompt ?? null;
  const featuredPromptId = dailyRecommendation?.featured?.prompt?.id ?? "";
  useEffect(() => {
    setIsLandingFeaturedPromptTranslationVisible(false);
  }, [landingFeaturedPrompt?.id]);
  const selectedPrompt = useMemo(
    () =>
      prompts.find((prompt) => prompt.id === selectedPromptId) ??
      allPrompts.find((prompt) => prompt.id === selectedPromptId) ??
      null,
    [allPrompts, prompts, selectedPromptId]
  );
  const savedExpressions = useSavedExpressions({
    currentUser,
    saveContext: {
      promptId: selectedPromptId || selectedPrompt?.id,
      answerSessionId: feedback?.sessionId || sessionId || undefined,
      answerAttemptNo: feedback?.attemptNo
    },
    onLoginRequired: () => setShowLoginWall(true)
  });
  const promptById = useMemo(() => {
    return new Map(allPrompts.map((prompt) => [prompt.id, prompt] as const));
  }, [allPrompts]);
  const vocabularyWordHintItems = useMemo(
    () =>
      hints
        .filter((hint) => hint.hintType === "VOCAB_WORD")
        .flatMap((hint) => {
          if (!hint.items || hint.items.length === 0) {
            return [];
          }

          return hint.items
            .filter((item) => item.content.trim().length > 0)
            .map((item) => ({
              id: item.id,
              content: item.content,
              meaningKo: item.meaningKo ?? null
            }));
        }),
    [hints]
  );
  const vocabularyPhraseHintItems = useMemo(
    () =>
      hints
        .filter((hint) => hint.hintType === "VOCAB_PHRASE")
        .flatMap((hint) => {
          if (!hint.items || hint.items.length === 0) {
            return [];
          }

          return hint.items
            .filter((item) => item.content.trim().length > 0)
            .map((item) => ({
              id: item.id,
              content: item.content,
              meaningKo: item.meaningKo ?? null
            }));
        }),
    [hints]
  );
  const starterHint = useMemo(
    () =>
      hints
        .filter((hint) => hint.hintType === "STARTER")
        .flatMap((hint) => hint.items?.map((item) => item.content) ?? [])
        .find((content) => content.trim().length > 0) ?? null,
    [hints]
  );
  const answerGuide = useMemo(
    () => getWritingGuide(resolvePracticeDifficulty(selectedDifficulty, selectedPrompt?.difficulty), starterHint),
    [selectedDifficulty, selectedPrompt?.difficulty, starterHint]
  );
  const feedbackLoadingStages = useMemo(
    () =>
      feedback
        ? [
            {
              title: "다시 쓴 답변을 읽고 있어요",
              message: "이전 피드백이 얼마나 반영됐는지 살펴보고 있어요. 잠시만 기다려 주세요."
            },
            {
              title: "문장을 한 줄씩 비교하고 있어요",
              message: "좋아진 부분과 아직 다듬을 부분을 함께 찾고 있어요."
            },
            {
              title: "더 자연스럽게 들리도록 다듬는 중이에요",
              message: "흐름이 매끄러워지는 표현도 함께 고르고 있어요."
            },
            {
              title: "이번 다시쓰기의 포인트를 정리하고 있어요",
              message: "한 번 더 성장한 답안이 되도록 핵심 힌트를 정리하고 있어요."
            }
          ]
        : [
            {
              title: "피드백을 만들고 있어요",
              message: "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."
            },
            {
              title: "문장을 찬찬히 읽고 있어요",
              message: "좋은 점과 먼저 고칠 점을 나눠 보고 있어요."
            },
            {
              title: "더 자연스럽게 들리도록 다듬는 중이에요",
              message: "바로 써볼 수 있는 표현도 함께 고르고 있어요."
            },
            {
              title: "표현을 하나 더 붙일 곳도 찾고 있어요",
              message: "다음 다시쓰기에 도움이 될 힌트까지 챙기고 있어요."
            }
          ],
    [feedback]
  );
  const [activeFeedbackLoadingStageIndex, setActiveFeedbackLoadingStageIndex] = useState(0);
  useEffect(() => {
    setActiveFeedbackLoadingStageIndex(0);

    if (!isSubmitting || feedbackLoadingStages.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveFeedbackLoadingStageIndex((current) => (current + 1) % feedbackLoadingStages.length);
    }, 2300);

    return () => {
      window.clearInterval(interval);
    };
  }, [feedbackLoadingStages, isSubmitting]);
  const answerWordCount = useMemo(() => countWords(answer), [answer]);
  const rewriteWordCount = useMemo(() => countWords(rewrite), [rewrite]);
  const welcomeWeekDays = useMemo(
    () => buildWelcomeWeek(todayStatus, welcomeCompletedDateKeys),
    [todayStatus, welcomeCompletedDateKeys]
  );
  const mobileComposerBarStyle = useMemo(
    () =>
      ({
        "--mobile-composer-bar-height": `${mobileComposerBarHeight}px`
      }) as CSSProperties,
    [mobileComposerBarHeight]
  );
  const coachRelatedPrompts = useMemo(() => {
    const sourceIds = coach.usage?.relatedPromptIds ?? [];
    const sourcePrompts = allPrompts.length > 0 ? allPrompts : prompts;
    const related = sourceIds
      .map((promptId) => promptById.get(promptId) ?? sourcePrompts.find((prompt) => prompt.id === promptId))
      .filter((candidate): candidate is Prompt => {
        if (!candidate) {
          return false;
        }

        return candidate.id !== selectedPromptId;
      });

    if (related.length > 0) {
      return buildRelatedPromptRecommendations(selectedPrompt, related, selectedPromptId);
    }

    if (!selectedPrompt) {
      return sourcePrompts.filter((prompt) => prompt.id !== selectedPromptId).slice(0, 3);
    }

    return buildRelatedPromptRecommendations(selectedPrompt, sourcePrompts, selectedPromptId);
  }, [allPrompts, coach.usage?.relatedPromptIds, promptById, prompts, selectedPrompt, selectedPromptId]);
  const completionRelatedPrompts = useMemo(
    () => coachRelatedPrompts.slice(0, 3),
    [coachRelatedPrompts]
  );

  const isLoggedIn = Boolean(currentUser);
  const isGuestCycleComplete = Boolean(feedback && guestSessionId && feedback.attemptNo >= 2);
  const feedbackView = deriveFeedbackView({
    feedback,
    areAllLanguageCorrectionsVisible,
    sessionId,
    completedSessionId,
    lastSubmittedAnswer
  });
  const { feedbackLevel, isSessionCompleted } = feedbackView;
  const feedbackSummaryProps = {
    feedback,
    view: feedbackView,
    savedExpressions,
    areAllLanguageCorrectionsVisible,
    setAreAllLanguageCorrectionsVisible
  };
  const streakDays = todayStatus?.streakDays ?? 0;
  useEffect(() => {
    setAreAllLanguageCorrectionsVisible(false);
  }, [feedback?.attemptNo]);

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
    if (!showLoginWall || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowLoginWall(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showLoginWall]);

  useEffect(() => {
    if (step !== "answer" && step !== "rewrite") {
      setShowHelpSheet(false);
    }
  }, [step]);

  function togglePromptTranslation(promptId: string) {
    setRevealedTranslations((current) => ({
      ...current,
      [promptId]: !current[promptId]
    }));
  }

  function clearCoachState() {
    coach.reset();
    setShowHelpSheet(false);
  }

  function appendExpressionToCurrentDraft(expression: string) {
    const trimmedExpression = expression.trim();
    if (!trimmedExpression) {
      return;
    }

    if (step === "rewrite") {
      setRewrite((current) => (current.trim() ? `${current.trimEnd()} ${trimmedExpression}` : trimmedExpression));
      return;
    }

    setAnswer((current) => (current.trim() ? `${current.trimEnd()} ${trimmedExpression}` : trimmedExpression));
  }

  function resetFlowForPrompt(promptId: string) {
    setSelectedPromptId(promptId);
    setSessionId(promptId === guestPromptId ? guestSessionId : "");
    setFeedback(null);
    clearCoachState();
    setAnswer("");
    setRewrite("");
    setLastSubmittedAnswer("");
    setError("");
    setShowLoginWall(false);
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
    drafts.setDraftStatusMessage("");
    savedExpressions.clearMessages();
    setPracticeExpressionHint(null);
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

    if (promptId !== selectedPromptId) {
      clearCoachState();
    }

    void trackDailyPromptClick(promptId, guestId || undefined).catch(() => undefined);

    const targetPrompt = promptById.get(promptId);
    if (targetPrompt && targetPrompt.difficulty !== selectedDifficulty) {
      setSelectedDifficulty(targetPrompt.difficulty);
    }

    if (await drafts.restorePersistedDraft(promptId)) {
      return;
    }

    resetFlowForPrompt(promptId);
  }

  async function handleRefreshPromptList() {
    if (prompts.length === 0) {
      setError("질문을 먼저 불러와 주세요.");
      return;
    }

    try {
      setIsRefreshingQuestion(true);
      const excludePromptIds = Array.from(
        new Set([...questionRefreshHistory, ...prompts.map((prompt) => prompt.id)])
      );
      const nextRecommendation = await getDailyPrompts(
        selectedDifficulty,
        guestId || undefined,
        excludePromptIds
      );

      if (nextRecommendation.prompts.length === 0) {
        setError("이 난이도에서 새로 보여드릴 질문을 아직 고르지 못했어요.");
        return;
      }

      setQuestionRefreshHistory((current) =>
        Array.from(
          new Set([
            ...current,
            ...prompts.map((prompt) => prompt.id),
            ...nextRecommendation.prompts.map((prompt) => prompt.id)
          ])
        ).slice(-18)
      );
      setDailyRecommendation(nextRecommendation);
      setRevealedTranslations({});
      setSelectedPromptId(nextRecommendation.prompts[0]?.id ?? "");
      setError("");
    } catch {
      setError("이 난이도에서 새로 보여드릴 질문을 아직 고르지 못했어요.");
    } finally {
      setIsRefreshingQuestion(false);
    }
  }

  async function handleFinishLoop() {
    if (!sessionId || isFinishingLoop) {
      return;
    }
    if (isSessionCompleted) {
      setStep("complete");
      return;
    }

    try {
      setIsFinishingLoop(true);
      setError("");
      await completeFeedbackSession(sessionId, guestId || undefined);
      setCompletedSessionId(sessionId);
      if (selectedPromptId) {
        drafts.clearVisibleIncompleteLoop(selectedPromptId);
      }
      setShowLoginWall(false);
      setStep("complete");

      if (isLoggedIn) {
        setTodayStatus((current) => ({
          date: current?.date ?? new Date().toISOString().slice(0, 10),
          completed: true,
          completedSessions: Math.max(1, current?.completedSessions ?? 0),
          startedSessions: Math.max(1, current?.startedSessions ?? 0),
          streakDays: Math.max(1, current?.streakDays ?? 0),
          totalWrittenSentences: current?.totalWrittenSentences ?? 0,
          totalAnswerSessions: current?.totalAnswerSessions ?? 0
        }));
        setWelcomeCompletedDateKeys((current) => {
          const todayKey = formatDateKey(new Date());
          return current.includes(todayKey) ? current : [...current, todayKey];
        });
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "지금은 루프를 완료할 수 없어요."
      );
    } finally {
      setIsFinishingLoop(false);
    }
  }

  function handleTryAnotherPrompt() {
    if (selectedPromptId) {
      drafts.clearVisibleIncompleteLoop(selectedPromptId);
    }
    setFeedback(null);
    clearCoachState();
    setAnswer("");
    setRewrite("");
    setLastSubmittedAnswer("");
    setError("");
    setShowLoginWall(false);
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
    drafts.setDraftStatusMessage("");
    savedExpressions.clearMessages();
    setPracticeExpressionHint(null);
    setPickFlowScreen("prompt");
    setStep("pick");
  }

  useWritingDraftAutosave(drafts, draftFlow, selectedPrompt);

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
    coach.close();
    setShowHelpSheet(false);
    setIsSubmitting(true);

    const coachHelpSnapshot = coach.help;
    const promptSnapshot = selectedPrompt;
    const promptPoolSnapshot = allPrompts.length > 0 ? allPrompts : prompts;
    const trimmedAnswer = nextAnswer.trim();
    const pendingSubmission =
      pendingSubmissionRef.current?.promptId === selectedPromptId &&
      pendingSubmissionRef.current.answer === trimmedAnswer &&
      pendingSubmissionRef.current.mode === mode
        ? pendingSubmissionRef.current
        : {
            promptId: selectedPromptId,
            answer: trimmedAnswer,
            mode,
            submissionId: createSubmissionId()
          };
    pendingSubmissionRef.current = pendingSubmission;

    void submitFeedback({
      promptId: selectedPromptId,
      answer: trimmedAnswer,
      sessionId: sessionId || undefined,
      attemptType: mode,
      guestId: guestId || undefined,
      submissionId: pendingSubmission.submissionId
    })
      .then((result) => {
        pendingSubmissionRef.current = null;
        setFeedback(result);
        setSessionId(result.sessionId);
        setLastSubmittedAnswer(trimmedAnswer);
        setStep("feedback");
        drafts.setDraftStatusMessage("");

        void drafts.clearPersistedDraft(selectedPromptId, mode === "INITIAL" ? "ANSWER" : "REWRITE").catch(
          () => undefined
        );

        if (!isLoggedIn && !guestSessionId) {
          setGuestSessionId(result.sessionId);
          setGuestPromptId(selectedPromptId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(GUEST_SESSION_ID_KEY, result.sessionId);
            window.localStorage.setItem(GUEST_PROMPT_ID_KEY, selectedPromptId);
          }
        }

        setShowLoginWall(false);

        coach.checkUsageAfterSubmit({
          coachHelpSnapshot,
          promptSnapshot,
          promptPoolSnapshot,
          promptId: selectedPromptId,
          answer: trimmedAnswer,
          sessionId: result.sessionId,
          guestId,
          attemptNo: result.attemptNo,
          attemptType: mode
        });
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof ApiError && caughtError.code === "GUEST_LIMIT_REACHED") {
          setShowLoginWall(true);
          setError(caughtError.message);
          return;
        }

        // 서버가 준 안내(답변 길이, 요청 제한, 중복 제출, 일시 장애)를 그대로 보여 준다.
        // 서버 메시지가 없거나(네트워크 오류 등) 영어 기본 문구뿐이면 일반 안내를 보여 준다.
        setError(
          caughtError instanceof ApiError && caughtError.message && caughtError.message !== "Failed to submit feedback"
            ? caughtError.message
            : "지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요."
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  function handleRewriteFromCurrentAnswer() {
    setRewrite(lastSubmittedAnswer.trim() || answer.trim() || rewrite.trim());
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setStep("rewrite");
  }

  const scrollRewriteFeedbackIntoView = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      rewriteFeedbackPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
  }, []);

  const toggleRewriteFeedback = useCallback(() => {
    setShowRewriteFeedback((current) => {
      const next = !current;
      if (next) {
        scrollRewriteFeedbackIntoView();
      }
      return next;
    });
  }, [scrollRewriteFeedbackIntoView]);

  return (
    <main className={styles.main}>
      {showLoginWall ? (
        <div className={styles.loginWallOverlay} onClick={() => setShowLoginWall(false)}>
          <section
            className={styles.loginWall}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-limit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.loginWallClose}
              aria-label="로그인 안내 닫기"
              onClick={() => setShowLoginWall(false)}
            >
              ×
            </button>
            <div className={styles.loginWallMascotWrap} aria-hidden="true">
              <div className={styles.loginWallMascotFrame}>
                <Image
                  src="/login/welcome.png"
                  alt=""
                  width={128}
                  height={128}
                  className={styles.loginWallMascot}
                />
              </div>
            </div>
            <div className={styles.loginWallCopy}>
              <h2 id="guest-limit-title">로그인하면 계속 학습할 수 있어요</h2>
              <p>
                지금까지 완료한 문장과 피드백, 작성 중인 흐름을 안전하게 이어서 저장해 드릴게요.
              </p>
            </div>
            <div className={styles.loginWallBenefits}>
              <div className={styles.loginWallBenefit}>
                <span className={`material-symbols-outlined ${styles.loginWallBenefitIcon}`} aria-hidden="true">
                  cloud_done
                </span>
                <span>모든 기기에서 기록 자동 이어쓰기</span>
              </div>
              <div className={styles.loginWallBenefit}>
                <span className={`material-symbols-outlined ${styles.loginWallBenefitIcon}`} aria-hidden="true">
                  auto_graph
                </span>
                <span>내 답변과 성장 기록 계속 확인</span>
              </div>
            </div>
            <div className={styles.loginActions}>
              <Link
                href={`/login?returnTo=${encodeURIComponent(HOME_RETURN_TO)}`}
                className={`${styles.primaryLink} ${styles.loginWallPrimaryAction}`}
                onClick={drafts.persistDraftForLogin}
              >
                로그인하러 가기
              </Link>
              <Link
                href={`/register?returnTo=${encodeURIComponent(HOME_RETURN_TO)}`}
                className={`${styles.ghostLink} ${styles.loginWallSecondaryAction}`}
                onClick={drafts.persistDraftForLogin}
              >
                회원가입하러 가기
              </Link>
              <button
                type="button"
                className={styles.loginWallDismiss}
                onClick={() => setShowLoginWall(false)}
              >
                지금은 둘러보기
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {step === "pick" && (
        <PickStep
          clearCoachState={clearCoachState}
          currentUser={currentUser}
          featuredPromptId={featuredPromptId}
          handlePickPrompt={handlePickPrompt}
          handleRefreshPromptList={handleRefreshPromptList}
          isLandingFeaturedPromptTranslationVisible={isLandingFeaturedPromptTranslationVisible}
          isLoadingFeaturedPrompt={isLoadingFeaturedPrompt}
          isLoadingPrompts={isLoadingPrompts}
          isRefreshingQuestion={isRefreshingQuestion}
          landingFeaturedPrompt={landingFeaturedPrompt}
          landingFeaturedPromptItem={landingFeaturedPromptItem}
          monthStatusModal={monthStatusModal}
          pickFlowScreen={pickFlowScreen}
          prompts={prompts}
          revealedTranslations={revealedTranslations}
          selectedDifficulty={selectedDifficulty}
          setDailyRecommendation={setDailyRecommendation}
          setError={setError}
          setIsLandingFeaturedPromptTranslationVisible={setIsLandingFeaturedPromptTranslationVisible}
          setIsLoadingPrompts={setIsLoadingPrompts}
          setPickFlowScreen={setPickFlowScreen}
          setSelectedDifficulty={setSelectedDifficulty}
          setSelectedPromptId={setSelectedPromptId}
          setShowHelpSheet={setShowHelpSheet}
          todayStatus={todayStatus}
          togglePromptTranslation={togglePromptTranslation}
          welcomeWeekDays={welcomeWeekDays}
          incompleteLoop={drafts.incompleteLoop}
          incompleteLoopCopy={drafts.incompleteLoopCopy}
          incompleteLoopSavedAt={drafts.incompleteLoopSavedAt}
          handleResumeIncompleteLoop={drafts.handleResumeIncompleteLoop}
        />
      )}
      {step === "answer" && (
        <AnswerStep
          answer={answer}
          answerWordCount={answerWordCount}
          draftStatusMessage={drafts.draftStatusMessage}
          handleSubmit={handleSubmit}
          isLoadingPrompts={isLoadingPrompts}
          isMobileViewport={isMobileViewport}
          isSubmitting={isSubmitting}
          mobileComposerBarStyle={mobileComposerBarStyle}
          setAnswer={setAnswer}
          setStep={setStep}
          showHelpSheet={showHelpSheet}
          coach={coach}
          selectedPrompt={selectedPrompt}
          setShowAnswerTranslation={setShowAnswerTranslation}
          setShowHelpSheet={setShowHelpSheet}
          showAnswerTranslation={showAnswerTranslation}
          mobileComposerBarRef={mobileComposerBarRef}
          appendExpressionToCurrentDraft={appendExpressionToCurrentDraft}
          feedback={feedback}
          practiceExpressionHint={practiceExpressionHint}
          answerGuide={answerGuide}
          isLoadingHints={isLoadingHints}
          vocabularyPhraseHintItems={vocabularyPhraseHintItems}
          vocabularyWordHintItems={vocabularyWordHintItems}
        />
      )}
      {step === "feedback" && (
        <FeedbackStep
          summaryProps={feedbackSummaryProps}
          isFinishingLoop={isFinishingLoop}
          onFinishLoop={handleFinishLoop}
          onRewriteFromCurrentAnswer={handleRewriteFromCurrentAnswer}
        />
      )}
      {step === "rewrite" && (
        <RewriteStep
          answer={answer}
          draftStatusMessage={drafts.draftStatusMessage}
          feedback={feedback}
          feedbackSummaryProps={feedbackSummaryProps}
          handleSubmit={handleSubmit}
          isMobileViewport={isMobileViewport}
          isSubmitting={isSubmitting}
          lastSubmittedAnswer={lastSubmittedAnswer}
          mobileComposerBarStyle={mobileComposerBarStyle}
          rewrite={rewrite}
          rewriteFeedbackPanelRef={rewriteFeedbackPanelRef}
          rewriteWordCount={rewriteWordCount}
          setRewrite={setRewrite}
          setShowPreviousRewriteAnswer={setShowPreviousRewriteAnswer}
          showHelpSheet={showHelpSheet}
          showPreviousRewriteAnswer={showPreviousRewriteAnswer}
          showRewriteFeedback={showRewriteFeedback}
          toggleRewriteFeedback={toggleRewriteFeedback}
          coach={coach}
          selectedPrompt={selectedPrompt}
          setShowAnswerTranslation={setShowAnswerTranslation}
          setShowHelpSheet={setShowHelpSheet}
          showAnswerTranslation={showAnswerTranslation}
          answerGuide={answerGuide}
          isLoadingHints={isLoadingHints}
          vocabularyPhraseHintItems={vocabularyPhraseHintItems}
          vocabularyWordHintItems={vocabularyWordHintItems}
        />
      )}
      {step === "complete" && (
        <CompleteStep
          celebrationCanvasRef={celebrationCanvasRef}
          completionRelatedPrompts={completionRelatedPrompts}
          feedback={feedback}
          feedbackLevel={feedbackLevel}
          handlePickPrompt={handlePickPrompt}
          handleTryAnotherPrompt={handleTryAnotherPrompt}
          isLoadingPrompts={isLoadingPrompts}
          setStep={setStep}
          streakDays={streakDays}
          todayStatus={todayStatus}
        />
      )}
      <FeedbackLoadingOverlay
        isSubmitting={isSubmitting}
        feedbackLoadingStages={feedbackLoadingStages}
        activeFeedbackLoadingStageIndex={activeFeedbackLoadingStageIndex}
      />
      <HelpSheet
        answerGuide={answerGuide}
        helpSheetCloseButtonRef={helpSheetCloseButtonRef}
        isLoadingHints={isLoadingHints}
        isMobileViewport={isMobileViewport}
        setShowHelpSheet={setShowHelpSheet}
        showHelpSheet={showHelpSheet}
        step={step}
        vocabularyPhraseHintItems={vocabularyPhraseHintItems}
        vocabularyWordHintItems={vocabularyWordHintItems}
      />
      <CoachAssistantModal
        coach={coach}
        isAvailable={step === "answer" || step === "rewrite"}
        selectedPrompt={selectedPrompt}
        savedExpressions={savedExpressions}
        onSubmitQuestion={() => coach.submitQuestion({ selectedPrompt, sessionId, step, answer, rewrite })}
        onInsertExpression={appendExpressionToCurrentDraft}
      />
      <MonthStatusModal
        monthStatus={monthStatusModal}
        onSelectDate={(dateKey) => router.push(`/me?tab=writing&date=${dateKey}`)}
      />
    </main>
  );
}
