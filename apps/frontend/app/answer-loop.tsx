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
  type CSSProperties,
  type ReactNode
} from "react";
import {
  checkCoachExpressionUsage,
  ApiError,
  completeFeedbackSession,
  deleteSavedExpression,
  deleteWritingDraft,
  getFeaturedDailyPrompt,
  getCurrentUser,
  getDailyPrompts,
  getMonthStatus,
  getPrompts,
  getPromptHints,
  getSavedExpressions,
  getTodayWritingStatus,
  getWritingDraft,
  saveExpression,
  saveWritingDraft,
  requestCoachHelp,
  submitFeedback,
  trackDailyPromptClick
} from "../lib/api";
import { saveHomeDraftForLogin, takeHomeDraftForLogin } from "../lib/auth-flow";
import {
  deleteLocalWritingDraft,
  getPreferredLocalWritingDraft,
  saveLocalWritingDraft
} from "../lib/home-writing-drafts";
import {
  buildIncompleteLoopPromptSnapshot,
  clearIncompleteLoopForPrompt,
  getIncompleteLoop,
  saveIncompleteLoop,
  type IncompleteLoopState,
  type IncompleteLoopStep
} from "../lib/incomplete-loop";
import { buildCoachQuickQuestions } from "../lib/coach-quick-questions";
import { filterSuggestedRefinementExpressions } from "../lib/refinement-recommendations";
import { getDifficultyLabel, resolvePracticeDifficulty } from "../lib/difficulty";
import { getFeedbackLevelInfo } from "../lib/feedback-level";
import { getFeedbackSlotUiCopy } from "../lib/feedback-slot-ui";
import { getOrCreateGuestId } from "../lib/guest-id";
import { buildInlineFeedbackSegments, type RenderedInlineFeedbackSegment } from "../lib/inline-feedback";
import { buildLocalCoachHelp, buildLocalCoachUsage } from "../lib/coach";
import type {
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  FeaturedDailyPromptRecommendation,
  CoachHelpResponse,
  CoachUsageCheckResponse,
  Feedback,
  FeedbackCoachMove,
  FeedbackLoopStatus,
  HistoryMonthStatus,
  HomeDraftSnapshot,
  HomeFlowStep,
  Prompt,
  PromptHint,
  SavedExpression,
  SavedExpressionSourceType,
  TodayWritingStatus,
  WritingDraft,
  WritingDraftType
} from "../lib/types";
import { StreakSparkleEffect } from "../components/streak-sparkle-effect";
import styles from "./page.module.css";

const GUEST_SESSION_ID_KEY = "writeloop_guest_session_id";
const GUEST_PROMPT_ID_KEY = "writeloop_guest_prompt_id";
const HOME_RETURN_TO = "/";

function createSubmissionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Step = "pick" | "answer" | "feedback" | "rewrite" | "complete";
type PickFlowScreen = "difficulty" | "prompt";
type WritingGuideHintItem = {
  id: string;
  content: string;
  meaningKo?: string | null;
};
type DifficultyStageIconName = "auto_stories" | "menu_book" | "psychology";

type PracticeExpressionHint = {
  expression: string;
  tag?: string | null;
  tagLabel?: string | null;
  expressions: string[];
};
type IncompleteLoopCopy = {
  title: string;
  body: string;
  ctaLabel: string;
  badgeLabel: string;
  icon: string;
};
const EXPRESSION_SLOT_LABELS: Record<string, string> = {
  action: "동사",
  actions: "동사",
  activity: "동사",
  activities: "동사",
  adj: "형용사",
  adjective: "형용사",
  adjectives: "형용사",
  detail: "세부 내용",
  details: "세부 내용",
  example: "예시",
  examples: "예시",
  how: "방법",
  issue: "문제",
  issues: "문제",
  item: "항목",
  items: "항목",
  language: "언어",
  languages: "언어",
  method: "방법",
  methods: "방법",
  noun: "명사",
  nouns: "명사",
  number: "횟수",
  numbers: "횟수",
  opinion: "의견",
  opinions: "의견",
  period: "기간",
  periods: "기간",
  place: "장소",
  places: "장소",
  process: "과정",
  processes: "과정",
  reason: "이유",
  reasons: "이유",
  result: "결과",
  results: "결과",
  thing: "내용",
  things: "내용",
  topic: "주제",
  topics: "주제",
  verb: "동사",
  verbs: "동사"
};


const COACH_MOVE_DIFF_MAX_CHARS = 700;
const COACH_MOVE_DIFF_MAX_TOKENS = 140;

function trimNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = trimNullable(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

function normalizeSuggestedPhrase(value: unknown) {
  if (typeof value === "string") {
    const phrase = trimNullable(value);
    return phrase ? { phrase, meaningKo: "" } : null;
  }

  if (value && typeof value === "object") {
    const candidate = value as { phrase?: unknown; meaningKo?: unknown };
    const phrase = typeof candidate.phrase === "string" ? trimNullable(candidate.phrase) : null;
    const meaningKo = typeof candidate.meaningKo === "string" ? trimNullable(candidate.meaningKo) : "";
    return phrase ? { phrase, meaningKo } : null;
  }

  return null;
}

function hasCoachMove(coachMove?: FeedbackCoachMove | null) {
  return Boolean(
    trimNullable(coachMove?.focus) ||
      trimNullable(coachMove?.why) ||
      trimNullable(coachMove?.before) ||
      trimNullable(coachMove?.after) ||
      trimNullable(coachMove?.instruction) ||
      trimNullable(coachMove?.exampleEn) ||
      trimNullable(coachMove?.skeletonEn) ||
      (Array.isArray(coachMove?.languageCorrections) &&
        coachMove.languageCorrections.length > 0) ||
      (Array.isArray(coachMove?.suggestedPhrases) &&
        coachMove.suggestedPhrases.some((phrase) => normalizeSuggestedPhrase(phrase)))
  );
}

function isCoachMoveComparison(coachMove?: FeedbackCoachMove | null) {
  const before = trimNullable(coachMove?.before);
  const after = trimNullable(coachMove?.after);
  if (!before || !after) {
    return false;
  }

  const focusType = trimNullable(coachMove?.focusType)?.toUpperCase();
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
  const focusType = trimNullable(coachMove?.focusType)?.toUpperCase();
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
  ].includes(focusType ?? "");
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


function normalizeSavedExpressionKey(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function normalizeExpressionTagList(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  );
}

function buildSavedExpressionIdMap(savedExpressions: SavedExpression[]) {
  return savedExpressions.reduce<Record<string, number>>((accumulator, item) => {
    const key = normalizeSavedExpressionKey(item.expression);
    if (key) {
      accumulator[key] = item.id;
    }
    return accumulator;
  }, {});
}

function isDailyDifficulty(value?: string | null): value is DailyDifficulty {
  return value === "I" || value === "A" || value === "B" || value === "C";
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


function renderLocalizedExpression(expression: string) {
  const parts: ReactNode[] = [];
  const pattern = /\[([A-Za-z]+)\]/g;
  let lastIndex = 0;

  for (const match of expression.matchAll(pattern)) {
    const fullMatch = match[0];
    const rawToken = match[1];
    const matchIndex = match.index ?? -1;
    if (matchIndex < 0) {
      continue;
    }

    if (matchIndex > lastIndex) {
      parts.push(expression.slice(lastIndex, matchIndex));
    }

    const normalizedToken = rawToken.trim().toLowerCase();
    const translatedToken = EXPRESSION_SLOT_LABELS[normalizedToken] ?? rawToken;
    parts.push(
      <em key={`${normalizedToken}-${matchIndex}`} className={styles.expressionSlotToken}>
        [{translatedToken}]
      </em>
    );
    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex === 0) {
    return expression;
  }

  if (lastIndex < expression.length) {
    parts.push(expression.slice(lastIndex));
  }

  return parts;
}

function renderWritingGuideHintCard(hint: WritingGuideHintItem) {
  const meaningKo = hint.meaningKo?.trim();

  return (
    <article key={hint.id} className={styles.hintChip}>
      <strong className={styles.hintChipContent}>{renderLocalizedExpression(hint.content)}</strong>
      {meaningKo ? (
        <span className={styles.hintChipMeaning}>{renderLocalizedExpression(meaningKo)}</span>
      ) : null}
    </article>
  );
}

function normalizePromptCategory(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function normalizePromptTopicKey(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function getPromptCategoryKey(prompt: Prompt | null | undefined) {
  return (
    normalizePromptTopicKey(prompt?.topicCategory) ||
    normalizePromptTopicKey(prompt?.topic) ||
    (prompt?.id ?? "")
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function countDistinctPromptCategories(prompts: Prompt[]) {
  return new Set(
    prompts
      .map((prompt) => getPromptCategoryKey(prompt))
      .filter((categoryKey) => categoryKey !== "")
  ).size;
}

function getPromptCoachCategories(prompt: Prompt | null | undefined) {
  if (!prompt?.coachProfile) {
    return [];
  }

  const categories = [
    prompt.coachProfile.primaryCategory,
    ...(prompt.coachProfile.secondaryCategories ?? [])
  ]
    .map(normalizePromptCategory)
    .filter((category) => category !== "" && category !== "GENERAL");

  return Array.from(new Set(categories));
}

function getPromptCoachCategoryOverlapScore(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  if (!currentPrompt || !candidate) {
    return 0;
  }

  const currentCategories = getPromptCoachCategories(currentPrompt);
  if (currentCategories.length === 0) {
    return 0;
  }

  const candidateCategories = new Set(getPromptCoachCategories(candidate));
  let score = 0;

  currentCategories.forEach((category, index) => {
    if (candidateCategories.has(category)) {
      score += index === 0 ? 3 : 1;
    }
  });

  return score;
}

function getPromptTopicMatch(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  const currentCategory = normalizePromptTopicKey(currentPrompt?.topicCategory);
  const candidateCategory = normalizePromptTopicKey(candidate?.topicCategory);
  const currentDetail = normalizePromptTopicKey(currentPrompt?.topicDetail);
  const candidateDetail = normalizePromptTopicKey(candidate?.topicDetail);

  const sameCategory = currentCategory !== "" && currentCategory === candidateCategory;
  const sameTopicDetail =
    sameCategory && currentDetail !== "" && currentDetail === candidateDetail;

  return {
    sameCategory,
    sameTopicDetail
  };
}

function buildRelatedPromptRecommendations(
  currentPrompt: Prompt | null | undefined,
  candidates: Prompt[],
  selectedPromptId: string
) {
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidate.id !== selectedPromptId &&
      candidates.findIndex((item) => item.id === candidate.id) === index
  );

  if (!currentPrompt) {
    return uniqueCandidates.slice(0, 3);
  }

  const rankedCandidates = uniqueCandidates
    .map((prompt, index) => {
      const topicMatch = getPromptTopicMatch(currentPrompt, prompt);
      const coachCategoryScore = getPromptCoachCategoryOverlapScore(currentPrompt, prompt);
      const sameDifficulty = prompt.difficulty === currentPrompt.difficulty;
      const priority =
        (topicMatch.sameTopicDetail ? 1_000 : 0) +
        (topicMatch.sameCategory ? 100 : 0) +
        (sameDifficulty ? 10 : 0) +
        coachCategoryScore;

      return {
        prompt,
        index,
        sameDifficulty,
        coachCategoryScore,
        ...topicMatch,
        priority
      };
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.index - right.index;
    });

  const sameTopicDetail = rankedCandidates.filter((candidate) => candidate.sameTopicDetail);
  const sameCategory = rankedCandidates.filter(
    (candidate) => candidate.sameCategory && !candidate.sameTopicDetail
  );
  const others = rankedCandidates.filter((candidate) => !candidate.sameCategory);

  const selected: Prompt[] = [];
  const selectedIds = new Set<string>();

  const addCandidate = (candidate?: (typeof rankedCandidates)[number]) => {
    if (!candidate || selectedIds.has(candidate.prompt.id) || selected.length >= 3) {
      return;
    }
    selected.push(candidate.prompt);
    selectedIds.add(candidate.prompt.id);
  };

  addCandidate(sameTopicDetail[0]);
  addCandidate(sameCategory[0]);

  [...sameTopicDetail, ...sameCategory, ...others].forEach((candidate) => addCandidate(candidate));

  return selected.slice(0, 3);
}

const PROMPT_DIVERSITY_STOPWORDS = new Set([
  "about",
  "after",
  "and",
  "are",
  "because",
  "describe",
  "does",
  "during",
  "each",
  "english",
  "every",
  "explain",
  "favorite",
  "from",
  "have",
  "how",
  "important",
  "into",
  "like",
  "make",
  "matters",
  "one",
  "reach",
  "related",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "usually",
  "want",
  "what",
  "when",
  "which",
  "why",
  "with",
  "year",
  "you",
  "your"
]);

function extractPromptDiversityTokens(prompt: Prompt | null | undefined) {
  if (!prompt) {
    return [];
  }

  const rawText = [
    prompt.topic,
    prompt.topicCategory,
    prompt.topicDetail,
    prompt.questionEn
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();

  const tokens = rawText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) => token.length >= 3 && !PROMPT_DIVERSITY_STOPWORDS.has(token)
    );

  return Array.from(new Set(tokens));
}

function getPromptSharedTokenCount(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  if (!currentPrompt || !candidate) {
    return 0;
  }

  const currentTokens = new Set(extractPromptDiversityTokens(currentPrompt));
  let sharedCount = 0;

  for (const token of extractPromptDiversityTokens(candidate)) {
    if (currentTokens.has(token)) {
      sharedCount += 1;
    }
  }

  return sharedCount;
}

function calculatePromptOverlapPenalty(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  if (!currentPrompt || !candidate) {
    return 0;
  }

  const topicMatch = getPromptTopicMatch(currentPrompt, candidate);
  const coachCategoryScore = getPromptCoachCategoryOverlapScore(currentPrompt, candidate);
  const sharedTokenCount = getPromptSharedTokenCount(currentPrompt, candidate);
  const sameTopic =
    normalizePromptTopicKey(currentPrompt.topic) !== "" &&
    normalizePromptTopicKey(currentPrompt.topic) === normalizePromptTopicKey(candidate.topic);

  return (
    (sameTopic ? 8_000 : 0) +
    (topicMatch.sameTopicDetail ? 4_000 : 0) +
    (topicMatch.sameCategory ? 1_000 : 0) +
    coachCategoryScore * 180 +
    sharedTokenCount * 55
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pickLeastOverlappingPromptSet(
  currentPrompts: Prompt[],
  candidates: Prompt[],
  seenPromptIds: Iterable<string>,
  desiredCount: number
) {
  const currentPromptIds = new Set(currentPrompts.map((prompt) => prompt.id));
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      !currentPromptIds.has(candidate.id) &&
      candidates.findIndex((item) => item.id === candidate.id) === index
  );

  if (uniqueCandidates.length < desiredCount) {
    return [];
  }

  const selected: Prompt[] = [];
  const seenSet = new Set(seenPromptIds);
  const selectedCategoryKeys = new Set<string>();
  const remaining = [...uniqueCandidates];

  while (selected.length < desiredCount && remaining.length > 0) {
    const eligibleCandidates = remaining.filter(
      (candidate) => !selectedCategoryKeys.has(getPromptCategoryKey(candidate))
    );

    if (eligibleCandidates.length === 0) {
      break;
    }

    const anchorPrompts = [...currentPrompts, ...selected];
    const nextPrompt =
      eligibleCandidates
        .map((candidate, index) => ({
          candidate,
          index,
          seenPenalty: seenSet.has(candidate.id) ? 1 : 0,
          overlapPenalty: anchorPrompts.reduce(
            (sum, anchorPrompt) => sum + calculatePromptOverlapPenalty(anchorPrompt, candidate),
            0
          )
        }))
        .sort((left, right) => {
          if (left.seenPenalty !== right.seenPenalty) {
            return left.seenPenalty - right.seenPenalty;
          }

          if (left.overlapPenalty !== right.overlapPenalty) {
            return left.overlapPenalty - right.overlapPenalty;
          }

          return left.index - right.index;
        })[0]?.candidate ?? null;

    if (!nextPrompt) {
      break;
    }

    selected.push(nextPrompt);
    selectedCategoryKeys.add(getPromptCategoryKey(nextPrompt));
    const nextPromptIndex = remaining.findIndex((prompt) => prompt.id === nextPrompt.id);
    if (nextPromptIndex >= 0) {
      remaining.splice(nextPromptIndex, 1);
    }
  }

  return selected.length === desiredCount ? selected : [];
}

const DIFFICULTY_OPTIONS: Array<{
  value: DailyDifficulty;
  label: string;
  level: string;
  icon: DifficultyStageIconName;
  description: string;
  duration: string;
  recommended?: boolean;
}> = [
  {
    value: "I",
    label: "입문",
    level: "LEVEL 01",
    icon: "auto_stories",
    description: "짧은 한두 문장으로도 바로 답할 수 있는 가장 가벼운 질문부터 시작해 보세요.",
    duration: "2-3분"
  },
  {
    value: "A",
    label: "쉬움",
    level: "LEVEL 02",
    icon: "auto_stories",
    description: "기본 어휘와 쉬운 문장 구조로 부담 없이 첫 루프를 시작해 보세요.",
    duration: "3-5분"
  },
  {
    value: "B",
    label: "보통",
    level: "LEVEL 03",
    icon: "menu_book",
    description: "일상적인 주제와 문장 구조로 표현의 폭을 차분하게 넓혀 보세요.",
    recommended: true,
    duration: "5-8분"
  },
  {
    value: "C",
    label: "어려움",
    level: "LEVEL 04",
    icon: "psychology",
    description: "한 단계 더 복잡한 내용과 논리를 담아 깊이 있는 작문에 도전해 보세요.",
    duration: "8-12분"
  }
];

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

function getIncompleteLoopCopy(step: IncompleteLoopStep): IncompleteLoopCopy {
  switch (step) {
    case "feedback":
      return {
        title: "받아둔 피드백이 남아 있어요",
        body: "코치가 남긴 포인트를 확인하고 다음 루프로 자연스럽게 이어가 볼 수 있어요.",
        ctaLabel: "피드백 이어보기",
        badgeLabel: "FEEDBACK",
        icon: "chat"
      };
    case "rewrite":
      return {
        title: "다시쓰기 초안이 남아 있어요",
        body: "방금 다듬던 문장을 이어서 마무리하고 한 번 더 정리해 볼 수 있어요.",
        ctaLabel: "다시 쓰러 가기",
        badgeLabel: "REWRITE",
        icon: "edit_note"
      };
    case "answer":
    default:
      return {
        title: "작성하던 초안이 남아 있어요",
        body: "멈춘 지점부터 바로 이어서 쓰고 오늘의 루프를 계속 진행할 수 있어요.",
        ctaLabel: "이어서 쓰기",
        badgeLabel: "DRAFT",
        icon: "edit"
      };
  }
}

function formatIncompleteLoopSavedAt(updatedAt: string) {
  const savedAt = new Date(updatedAt);
  if (Number.isNaN(savedAt.getTime())) {
    return "";
  }

  return savedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function buildWelcomeWeek(todayStatus: TodayWritingStatus | null, completedDateKeys: string[]) {
  const today = todayStatus ? parseLocalDate(todayStatus.date) : new Date();
  const todayKey = formatDateKey(today);
  const completedKeys = new Set<string>(completedDateKeys);

  if (completedKeys.size === 0 && todayStatus && todayStatus.streakDays > 0) {
    const streakEndDate = todayStatus.completed ? today : addDays(today, -1);
    for (let offset = 0; offset < todayStatus.streakDays; offset += 1) {
      completedKeys.add(formatDateKey(addDays(streakEndDate, -offset)));
    }
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const dateKey = formatDateKey(date);
    return {
      key: dateKey,
      label: WEEKDAY_LABELS[date.getDay()] ?? "",
      isToday: dateKey === todayKey,
      isCompleted: completedKeys.has(dateKey)
    };
  });
}

type MonthCalendarCell = {
  key: string;
  dayNumber: number;
  status: {
    started: boolean;
    completed: boolean;
    startedSessions: number;
    completedSessions: number;
    isToday: boolean;
  } | null;
  isFuture: boolean;
};

type MonthView = {
  year: number;
  month: number;
};

function buildMonthCalendar(
  monthStatus: HistoryMonthStatus | null,
  monthView: MonthView | null,
  referenceDateString?: string | null
) {
  const referenceDate = referenceDateString ? parseLocalDate(referenceDateString) : new Date();
  const year = monthStatus?.year ?? monthView?.year ?? referenceDate.getFullYear();
  const month = monthStatus?.month ?? monthView?.month ?? referenceDate.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = formatDateKey(referenceDate);
  const dayMap = new Map((monthStatus?.days ?? []).map((day) => [day.date, day]));
  const cells: Array<MonthCalendarCell | null> = Array.from({ length: monthStart.getDay() }, () => null);

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, month - 1, dayNumber);
    const key = formatDateKey(date);
    const status = dayMap.get(key) ?? null;

    cells.push({
      key,
      dayNumber,
      status,
      isFuture: key > todayKey
    });
  }

  return {
    year,
    month,
    monthLabel: new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(monthStart),
    streakDays: monthStatus?.streakDays ?? 0,
    cells
  };
}

function createMonthView(date: Date): MonthView {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

function addMonthsToView(view: MonthView, delta: number): MonthView {
  const date = new Date(view.year, view.month - 1 + delta, 1);
  return createMonthView(date);
}

function isSameMonthView(left: MonthView, right: MonthView) {
  return left.year === right.year && left.month === right.month;
}

function getMonthStatusDayStyle(cell: MonthCalendarCell): CSSProperties | undefined {
  if (cell.status?.completed) {
    const count = Math.max(cell.status.completedSessions, 1);
    const clampedCount = Math.min(count, 5);
    const backgroundAlpha = Math.min(0.18 + clampedCount * 0.09, 0.6);
    const borderAlpha = Math.min(0.24 + clampedCount * 0.12, 0.78);
    const numberColor =
      clampedCount >= 4 ? "#6e2904" : clampedCount === 3 ? "#7b3510" : clampedCount === 2 ? "#8c4617" : "#9d5a25";
    const stateColor =
      clampedCount >= 4 ? "#7a3410" : clampedCount === 3 ? "#8a4218" : clampedCount === 2 ? "#9a5425" : "#9f6b3b";

    return {
      "--month-status-day-bg": `rgba(229, 106, 31, ${backgroundAlpha})`,
      "--month-status-day-border": `rgba(229, 106, 31, ${borderAlpha})`,
      "--month-status-day-number-color": numberColor,
      "--month-status-day-state-color": stateColor
    } as CSSProperties;
  }

  if (cell.status?.started) {
    const count = Math.max(cell.status.startedSessions, 1);
    const background =
      count >= 3
        ? "rgba(255, 196, 94, 0.34)"
        : count === 2
          ? "rgba(255, 208, 123, 0.24)"
          : "rgba(255, 229, 179, 0.18)";
    const border =
      count >= 3
        ? "rgba(217, 132, 35, 0.44)"
        : count === 2
          ? "rgba(217, 132, 35, 0.32)"
          : "rgba(217, 132, 35, 0.22)";

    return {
      "--month-status-day-bg": background,
      "--month-status-day-border": border
    } as CSSProperties;
  }

  return undefined;
}

function getWritingGuide(difficulty: DailyDifficulty, starterHint?: string | null): WritingGuide {
  switch (difficulty) {
    case "I":
      return {
        title: "짧게라도 바로 영어로 시작해 보세요.",
        description: "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각을 만드는 데 집중해 보세요.",
        sentenceRange: [1, 2],
        wordRange: [10, 25],
        starter: starterHint ?? "I usually ...",
        checklist: [
          {
            title: "질문에 바로 답하기",
            description: "질문에서 묻는 핵심만 골라 아주 짧게 먼저 적어보세요."
          },
          {
            title: "이유 한 줄 붙이기",
            description: "because 뒤에 짧은 이유를 한 문장만 더하면 답이 훨씬 자연스러워져요."
          },
          {
            title: "쉬운 표현으로 끝내기",
            description: "어려운 문장보다 내가 바로 쓸 수 있는 표현으로 마무리하는 게 더 중요해요."
          }
        ]
      };
    case "A":
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
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
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
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
  const [showMonthStatus, setShowMonthStatus] = useState(false);
  const [showCoachAssistant, setShowCoachAssistant] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [monthView, setMonthView] = useState<MonthView | null>(null);
  const rewriteFeedbackPanelRef = useRef<HTMLElement | null>(null);
  const [hints, setHints] = useState<PromptHint[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [monthStatus, setMonthStatus] = useState<HistoryMonthStatus | null>(null);
  const [isLoadingMonthStatus, setIsLoadingMonthStatus] = useState(false);
  const [monthStatusError, setMonthStatusError] = useState("");
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [coachUsage, setCoachUsage] = useState<CoachUsageCheckResponse | null>(null);
  const [, setIsCheckingCoachUsage] = useState(false);
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>({});
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);
  const [expressionSaveNotice, setExpressionSaveNotice] = useState("");
  const [expressionSaveError, setExpressionSaveError] = useState("");
  const [practiceExpressionHint, setPracticeExpressionHint] = useState<PracticeExpressionHint | null>(null);
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [didAttemptPersistedDraftRestore, setDidAttemptPersistedDraftRestore] = useState(false);
  const [draftStatusMessage, setDraftStatusMessage] = useState("");
  const [incompleteLoop, setIncompleteLoop] = useState<IncompleteLoopState | null>(null);
  const [isLoadingIncompleteLoop, setIsLoadingIncompleteLoop] = useState(true);
  const [questionRefreshHistory, setQuestionRefreshHistory] = useState<string[]>([]);
  const [isRefreshingQuestion, setIsRefreshingQuestion] = useState(false);
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const [isFinishingLoop, setIsFinishingLoop] = useState(false);
  const celebrationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mobileComposerBarRef = useRef<HTMLDivElement | null>(null);
  const coachPromptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const coachDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpSheetCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const knownPersistedDraftKeysRef = useRef<Set<string>>(new Set());
  const pendingSubmissionRef = useRef<{
    promptId: string;
    answer: string;
    mode: "INITIAL" | "REWRITE";
    submissionId: string;
  } | null>(null);
  const practiceParamsAppliedRef = useRef(false);
  const [mobileComposerBarHeight, setMobileComposerBarHeight] = useState(0);
  const monthStatusCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentMonthView = useMemo(
    () => createMonthView(todayStatus?.date ? parseLocalDate(todayStatus.date) : new Date()),
    [todayStatus?.date]
  );
  const activeMonthView = monthView ?? currentMonthView;

  useEffect(() => {
    if (step === "feedback" || step === "rewrite") {
    }
  }, [feedback?.attemptNo, step]);

  const isCurrentMonthView = isSameMonthView(activeMonthView, currentMonthView);

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
    setShowCoachAssistant(false);
    setError("");
    setShowRewriteFeedback(false);
    setShowAnswerTranslation(false);
  }, [currentUser, didRestoreDraft]);

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      return;
    }

    let cancelled = false;

    async function loadSavedExpressionIds() {
      try {
        const savedExpressions = await getSavedExpressions();
        if (!cancelled) {
          setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
        }
      } catch {
        if (!cancelled) {
          setSavedExpressionIdsByKey({});
        }
      }
    }

    void loadSavedExpressionIds();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

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

  useEffect(() => {
    if (!showMonthStatus) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMonthStatus(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      monthStatusCloseButtonRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        window.requestAnimationFrame(() => {
          previousActiveElement.focus();
        });
      }
    };
  }, [showMonthStatus]);

  useEffect(() => {
    if (!showCoachAssistant || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCoachAssistant(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      coachPromptInputRef.current?.focus();
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
  }, [showCoachAssistant]);

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

    async function loadMonthStatus() {
      if (!currentUser || !showMonthStatus) {
        return;
      }

      try {
        setIsLoadingMonthStatus(true);
        setMonthStatusError("");
        setMonthStatus(null);
        const targetView = monthView ?? currentMonthView;
        const status = await getMonthStatus(targetView.year, targetView.month);
        if (isMounted) {
          setMonthStatus(status);
        }
      } catch {
        if (isMounted) {
          setMonthStatus(null);
          setMonthStatusError("학습 기록을 불러오지 못했어요.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingMonthStatus(false);
        }
      }
    }

    void loadMonthStatus();

    return () => {
      isMounted = false;
    };
  }, [currentMonthView, currentUser, monthView, showMonthStatus]);

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
  const coachQuickQuestions = useMemo(
    () => buildCoachQuickQuestions(selectedPrompt),
    [selectedPrompt]
  );
  const rewriteWordCount = useMemo(() => countWords(rewrite), [rewrite]);
  const welcomeWeekDays = useMemo(
    () => buildWelcomeWeek(todayStatus, welcomeCompletedDateKeys),
    [todayStatus, welcomeCompletedDateKeys]
  );
  const incompleteLoopCopy = useMemo(
    () => (incompleteLoop ? getIncompleteLoopCopy(incompleteLoop.step) : null),
    [incompleteLoop]
  );
  const incompleteLoopSavedAt = useMemo(
    () => (incompleteLoop ? formatIncompleteLoopSavedAt(incompleteLoop.updatedAt) : ""),
    [incompleteLoop]
  );
  const monthCalendar = buildMonthCalendar(monthStatus, activeMonthView, todayStatus?.date);
  const mobileComposerBarStyle = useMemo(
    () =>
      ({
        "--mobile-composer-bar-height": `${mobileComposerBarHeight}px`
      }) as CSSProperties,
    [mobileComposerBarHeight]
  );
  const coachRelatedPrompts = useMemo(() => {
    const sourceIds = coachUsage?.relatedPromptIds ?? [];
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
  }, [allPrompts, coachUsage?.relatedPromptIds, promptById, prompts, selectedPrompt, selectedPromptId]);
  const completionRelatedPrompts = useMemo(
    () => coachRelatedPrompts.slice(0, 3),
    [coachRelatedPrompts]
  );

  const isLoggedIn = Boolean(currentUser);
  const activeDraftType: WritingDraftType | null =
    step === "answer" ? "ANSWER" : step === "rewrite" ? "REWRITE" : null;
  const isGuestCycleComplete = Boolean(feedback && guestSessionId && feedback.attemptNo >= 2);
  const feedbackLevel = feedback ? getFeedbackLevelInfo(feedback.loopComplete) : null;
  const visibleFeedback = feedback?.visibleFeedback ?? null;
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
  const isLanguageFix = trimNullable(coachMove?.focusType)?.toUpperCase() === "LANGUAGE_FIX";
  const rewriteWorkspace = feedback?.rewriteWorkspace ?? null;
  const isLoopReadyToFinish =
    visibleFeedback?.state === "READY_TO_FINISH" ||
    Boolean(feedback?.loopComplete) ||
    loopExperience?.nextAction === "finish" ||
    loopExperience?.status === "READY_TO_FINISH";
  const visibleStrength = pickFirstNonEmpty(visibleFeedback?.strength, feedback?.strengths?.[0]);
  const completionRefinementExpressions = filterSuggestedRefinementExpressions(
    visibleFeedback?.refinementExpressions ?? feedback?.refinementExpressions,
    lastSubmittedAnswer,
    feedback?.revisedAnswer
  ).slice(0, 2);
  const visibleModelAnswer = pickFirstNonEmpty(visibleFeedback?.modelAnswer, feedback?.modelAnswer);
  const visibleModelAnswerKo = pickFirstNonEmpty(
    visibleFeedback?.modelAnswerKo,
    feedback?.modelAnswerKo
  );
  const shouldShowCoachMoveCard = !isLoopReadyToFinish && hasCoachMove(coachMove);
  const shouldShowCoachMoveComparison = isCoachMoveComparison(coachMove);
  const shouldShowCorrectionReasonLabel = isDirectCorrectionCoachMove(coachMove);
  const coachSlotUiCopy = getFeedbackSlotUiCopy(coachMove?.targetSlot);
  const coachHeadline = pickFirstNonEmpty(
    coachSlotUiCopy?.title,
    coachMove?.focus,
    loopExperience?.headline,
    isLoopReadyToFinish
      ? "좋아요. 지금 단계에서 마무리해도 충분해요."
      : "지금은 한 가지만 먼저 고쳐서 다시 써 보세요."
  );
  const coachInstruction = pickFirstNonEmpty(
    coachMove?.instruction,
    rewriteWorkspace?.targetTextHint,
    feedback?.rewriteChallenge,
    isLoopReadyToFinish
      ? "이미 충분히 좋아요. 원하면 표현 하나만 가볍게 다듬어 보세요."
      : "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영해 다시 써 보세요."
  );
  const coachSkeleton = shouldShowCorrectionReasonLabel
    ? null
    : pickFirstNonEmpty(coachMove?.skeletonEn, coachSlotUiCopy?.skeletonEn);
  const coachSkeletonKo = shouldShowCorrectionReasonLabel
    ? null
    : pickFirstNonEmpty(coachMove?.skeletonKo, coachSlotUiCopy?.skeletonKo);
  const coachSuggestedPhrases =
    !shouldShowCorrectionReasonLabel && Array.isArray(coachMove?.suggestedPhrases)
      ? coachMove.suggestedPhrases.map(normalizeSuggestedPhrase).filter((phrase) => phrase !== null).slice(0, 6)
      : [];
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
    setShowCoachAssistant(false);
    setShowHelpSheet(false);
    setError("");
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setShowAnswerTranslation(false);
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

  function clearCoachState() {
    setShowCoachAssistant(false);
    setShowHelpSheet(false);
    setCoachQuestion("");
    setCoachHelp(null);
    setCoachHelpError("");
    setCoachUsage(null);
    setIsLoadingCoachHelp(false);
    setIsCheckingCoachUsage(false);
  }

  function isExpressionSaved(expression: string) {
    return Boolean(savedExpressionIdsByKey[normalizeSavedExpressionKey(expression)]);
  }

  function isExpressionSaving(expression: string) {
    return savingExpressionKeys.includes(normalizeSavedExpressionKey(expression));
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

  async function handleToggleSavedExpression({
    expression,
    meaningKo,
    exampleEn,
    usageTipKo,
    tags,
    sourceType,
    coachInteractionId
  }: {
    expression: string;
    meaningKo?: string | null;
    exampleEn?: string | null;
    usageTipKo?: string | null;
    tags?: string[] | null;
    sourceType: SavedExpressionSourceType;
    coachInteractionId?: string | null;
  }) {
    const trimmedExpression = expression.trim();
    const key = normalizeSavedExpressionKey(trimmedExpression);
    if (!key) {
      return;
    }

    if (!currentUser) {
      setShowLoginWall(true);
      setExpressionSaveError("표현 저장은 로그인 후 사용할 수 있어요.");
      setExpressionSaveNotice("");
      return;
    }

    if (savingExpressionKeys.includes(key)) {
      return;
    }

    const existingSavedExpressionId = savedExpressionIdsByKey[key];
    setSavingExpressionKeys((current) => [...current, key]);
    setExpressionSaveError("");
    setExpressionSaveNotice("");

    try {
      if (existingSavedExpressionId) {
        await deleteSavedExpression(existingSavedExpressionId);
        setSavedExpressionIdsByKey((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        setExpressionSaveNotice("저장을 취소했어요.");
        return;
      }

      const savedExpression = await saveExpression({
        expression: trimmedExpression,
        meaningKo: trimNullable(meaningKo) ?? undefined,
        exampleEn: trimNullable(exampleEn) ?? undefined,
        usageTipKo: trimNullable(usageTipKo) ?? undefined,
        tags: normalizeExpressionTagList(tags),
        sourceType,
        promptId: selectedPromptId || selectedPrompt?.id,
        answerSessionId: feedback?.sessionId || sessionId || undefined,
        answerAttemptNo: feedback?.attemptNo,
        coachInteractionId: trimNullable(coachInteractionId) ?? undefined
      });

      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [key]: savedExpression.id
      }));
      setExpressionSaveNotice("표현을 저장했어요.");
    } catch (caughtError) {
      setExpressionSaveError(
        caughtError instanceof Error ? caughtError.message : "표현을 저장하지 못했어요."
      );
    } finally {
      setSavingExpressionKeys((current) => current.filter((item) => item !== key));
    }
  }

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
    setDraftStatusMessage("");
    setExpressionSaveNotice("");
    setExpressionSaveError("");
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

    if (await restorePersistedDraft(promptId)) {
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

    try {
      setIsFinishingLoop(true);
      setError("");
      await completeFeedbackSession(sessionId, guestId || undefined);
      if (selectedPromptId) {
        clearVisibleIncompleteLoop(selectedPromptId);
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
      clearVisibleIncompleteLoop(selectedPromptId);
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
    setDraftStatusMessage("");
    setExpressionSaveNotice("");
    setExpressionSaveError("");
    setPracticeExpressionHint(null);
    setPickFlowScreen("prompt");
    setStep("pick");
  }

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
  }, [applyDraftSnapshot, incompleteLoop, restorePersistedDraft]);

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
    currentUser?.id,
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
    setShowCoachAssistant(false);
    setShowHelpSheet(false);
    setIsSubmitting(true);

    const coachHelpSnapshot = coachHelp;
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
        setDraftStatusMessage("");

        void clearPersistedDraft(selectedPromptId, mode === "INITIAL" ? "ANSWER" : "REWRITE").catch(
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

        if (coachHelpSnapshot && promptSnapshot && coachHelpSnapshot.expressions.length > 0) {
          setIsCheckingCoachUsage(true);
          void (async () => {
            try {
              const usageRequest = {
                promptId: selectedPromptId,
                answer: trimmedAnswer,
                sessionId: result.sessionId,
                guestId: guestId || undefined,
                attemptNo: result.attemptNo,
                attemptType: mode,
                expressions: coachHelpSnapshot.expressions,
                interactionId: coachHelpSnapshot.interactionId
              };

              let usageResult: CoachUsageCheckResponse;
              try {
                usageResult = await checkCoachExpressionUsage(usageRequest);
              } catch {
                usageResult = buildLocalCoachUsage(
                  promptSnapshot,
                  trimmedAnswer,
                  coachHelpSnapshot.expressions,
                  promptPoolSnapshot
                );
              }

              setCoachUsage(usageResult);
            } finally {
              setIsCheckingCoachUsage(false);
            }
          })();
        } else {
          setCoachUsage(null);
        }
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

  function openMonthStatus() {
    setMonthView(currentMonthView);
    setShowMonthStatus(true);
  }

  function moveMonth(delta: number) {
    setMonthView((current) => addMonthsToView(current ?? currentMonthView, delta));
  }

  function renderIncompleteLoopResumeCard() {
    if (!incompleteLoop || !incompleteLoopCopy) {
      return null;
    }

    const promptQuestion = incompleteLoop.promptSnapshot.questionEn.trim();
    const promptTopic = incompleteLoop.promptSnapshot.topic.trim();
    const metaParts = [promptTopic, incompleteLoopSavedAt ? `${incompleteLoopSavedAt}에 저장` : ""].filter(Boolean);

    return (
      <section className={styles.difficultyHomeResumeCard}>
        <div className={styles.difficultyHomeResumeLead}>
          <span className={styles.difficultyHomeResumeIcon} aria-hidden="true">
            <span className={`materialSymbols ${styles.difficultyHomeResumeIconGlyph}`}>
              {incompleteLoopCopy.icon}
            </span>
          </span>
          <div className={styles.difficultyHomeResumeCopy}>
            <div className={styles.difficultyHomeResumeTop}>
              <strong>{incompleteLoopCopy.title}</strong>
              <span className={styles.difficultyHomeResumeBadge}>{incompleteLoopCopy.badgeLabel}</span>
            </div>
            <p>{incompleteLoopCopy.body}</p>
            {promptQuestion ? (
              <strong className={styles.difficultyHomeResumeQuestion}>{promptQuestion}</strong>
            ) : null}
            {metaParts.length > 0 ? (
              <span className={styles.difficultyHomeResumeMeta}>{metaParts.join(" · ")}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className={styles.difficultyHomeResumeButton}
          onClick={() => void handleResumeIncompleteLoop()}
        >
          <span>{incompleteLoopCopy.ctaLabel}</span>
          <span className={`materialSymbols ${styles.difficultyHomeResumeButtonIcon}`} aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </section>
    );
  }

  function renderPickStep() {
    if (pickFlowScreen === "difficulty") {
      return (
        <section className={styles.pickFlow}>
          <section className={styles.difficultyHomeHero}>
            <div className={styles.mobileSyncHeaderRow}>
              <div className={styles.mobileSyncTitleBlock}>
                <h1 className={styles.difficultyHomeTitle}>난이도 선택</h1>
                <span className={styles.difficultyHomeUnderline} aria-hidden="true" />
              </div>
              <button
                type="button"
                className={styles.mobileSyncHeaderButton}
                onClick={() => setShowHelpSheet(true)}
              >
                가이드 보기
              </button>
            </div>

            <button
              type="button"
              className={`${styles.difficultyHomeStatusPanel} ${
                currentUser ? styles.difficultyHomeStatusPanelInteractive : ""
              }`}
              disabled={!currentUser}
              aria-label={currentUser ? "이번 달 학습 기록 열기" : "학습 안내"}
              aria-haspopup={currentUser ? "dialog" : undefined}
              aria-expanded={currentUser ? showMonthStatus : undefined}
              onClick={currentUser ? openMonthStatus : undefined}
            >
              <div className={styles.difficultyHomeStatusLead}>
                <span className={styles.difficultyHomeStatusIcon} aria-hidden="true">
                  <span className={`materialSymbols ${styles.difficultyHomeStatusIconGlyph}`}>
                    calendar_today
                  </span>
                </span>
                <div className={styles.difficultyHomeStatusCopy}>
                  <div className={styles.difficultyHomeStatusTop}>
                    <strong>학습 일지</strong>
                    <span className={styles.difficultyHomeStatusBadge}>
                      {currentUser ? "ACTIVE" : "START"}
                    </span>
                  </div>
                  <p>
                    {currentUser
                      ? `현재 ${todayStatus?.streakDays ?? 0}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`
                      : "부담 없이 첫 루프를 시작하고 오늘의 작문 감각을 깨워 보세요."}
                  </p>
                  {currentUser ? (
                    <span className={styles.difficultyHomeStatusMeta}>
                      총 {(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={styles.difficultyHomeWeekRow}>
                {welcomeWeekDays.map((day) => (
                  <span
                    key={day.key}
                    className={`${styles.difficultyHomeWeekDay} ${
                      day.isCompleted ? styles.difficultyHomeWeekDayDone : ""
                    } ${day.isToday ? styles.difficultyHomeWeekDayToday : ""}`}
                  >
                    <span className={styles.difficultyHomeWeekDayText}>{day.label}</span>
                  </span>
                ))}
              </div>
            </button>
          </section>

          {renderIncompleteLoopResumeCard()}

          <Link href="/diary" className={styles.difficultyHomeDiaryShortcut}>
            <span className={styles.difficultyHomeDiaryIcon} aria-hidden="true">
              <span className={`materialSymbols ${styles.difficultyHomeDiaryIconGlyph}`}>
                edit_note
              </span>
            </span>
            <span className={styles.difficultyHomeDiaryCopy}>
              <strong>자유 영어일기 쓰기</strong>
              <small>질문 없이 오늘 있었던 일을 영어로 쓰고 일기 전용 피드백을 받아보세요.</small>
            </span>
            <span className={`materialSymbols ${styles.difficultyHomeDiaryArrow}`} aria-hidden="true">
              arrow_forward
            </span>
          </Link>

          <section className={styles.prefeaturedPromptSection}>
            <div className={styles.prefeaturedPromptHeader}>
              <strong>오늘의 추천 질문</strong>
              <span className={styles.prefeaturedPromptDifficultyBadge}>
                {getDifficultyLabel(selectedDifficulty)}
              </span>
            </div>

            {isLoadingFeaturedPrompt ? (
              <div className={styles.prefeaturedPromptLoadingCard}>
                <span className={`materialSymbols ${styles.prefeaturedPromptLoadingIcon}`} aria-hidden="true">
                  hourglass_top
                </span>
                <p>추천 질문을 고르고 있어요.</p>
              </div>
            ) : landingFeaturedPrompt ? (
              <article
                role="button"
                tabIndex={0}
                className={styles.prefeaturedPromptCard}
                onClick={() => void handlePickPrompt(landingFeaturedPrompt.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void handlePickPrompt(landingFeaturedPrompt.id);
                  }
                }}
              >
                <div className={styles.prefeaturedPromptCardCopy}>
                  <strong>{landingFeaturedPrompt.questionEn}</strong>
                  {isLandingFeaturedPromptTranslationVisible ? (
                    <p>{landingFeaturedPrompt.questionKo}</p>
                  ) : null}
                  {landingFeaturedPromptItem?.reasonText ? (
                    <small>{landingFeaturedPromptItem.reasonText}</small>
                  ) : null}
                </div>
                <div className={styles.prefeaturedPromptCardFooter}>
                  <span>{landingFeaturedPrompt.topic}</span>
                  <button
                    type="button"
                    className={styles.promptTranslationButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsLandingFeaturedPromptTranslationVisible((current) => !current);
                    }}
                  >
                    {isLandingFeaturedPromptTranslationVisible ? "해석 숨기기" : "해석 보기"}
                  </button>
                </div>
              </article>
            ) : (
              <div className={styles.prefeaturedPromptFallbackCard}>
                <p>오늘의 추천 질문을 준비하지 못했어요. 아래에서 난이도를 골라 시작할 수 있어요.</p>
              </div>
            )}
          </section>

          <section className={styles.difficultyHomeStage}>
            <div className={styles.difficultyHomeCardGrid}>
              {DIFFICULTY_OPTIONS.map((option) => {
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-tone={option.value}
                    className={styles.difficultyHomeCard}
                    onClick={() => {
                      if (option.value !== selectedDifficulty) {
                        clearCoachState();
                        setDailyRecommendation(null);
                        setSelectedPromptId("");
                        setIsLoadingPrompts(true);
                      }
                      setSelectedDifficulty(option.value);
                      setPickFlowScreen("prompt");
                      setError("");
                    }}
                  >
                    <span className={styles.difficultyHomeCardLevel}>
                      {option.level}
                    </span>

                    <span className={styles.difficultyHomeCardIconWrap} aria-hidden="true">
                      <span className={`materialSymbols ${styles.difficultyHomeCardIcon}`}>
                        {option.icon}
                      </span>
                    </span>

                    <div className={styles.difficultyHomeCardCopy}>
                      <strong>{option.label}</strong>
                      <p>{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </section>
      );
    }

    return (
      <section className={styles.pickFlow}>
        <section className={styles.difficultyHomeHero}>
          <div className={styles.promptSelectionHeroCompact}>
            <div className={styles.promptSelectionHeaderRow}>
              <div className={styles.promptSelectionTitleBlock}>
                <h1 className={styles.promptSelectionTitle}>질문 선택</h1>
                <div className={styles.promptSelectionMetaRow}>
                  <span className={styles.promptSelectionMetaUnderline} aria-hidden="true" />
                  <span className={styles.promptSelectionDifficultyText}>
                    {getDifficultyLabel(selectedDifficulty)}
                  </span>
                </div>
              </div>

              <div className={styles.promptSelectionHeaderActions}>
                <button
                  type="button"
                  className={styles.promptSelectionStatusButton}
                  onClick={() => setPickFlowScreen("difficulty")}
                >
                  난이도 선택
                </button>
                <button
                  type="button"
                  className={styles.promptSelectionStatusButton}
                  onClick={handleRefreshPromptList}
                  disabled={isLoadingPrompts || isRefreshingQuestion || prompts.length === 0}
                >
                  {isRefreshingQuestion ? "불러오는 중..." : "새 질문"}
                </button>
              </div>
            </div>
          </div>

        </section>

        {renderIncompleteLoopResumeCard()}

          <section className={styles.difficultyHomeStage}>
            <div className={styles.promptSelectionCardGrid}>
              {prompts.map((prompt, index) => {
                const isTranslationVisible = Boolean(revealedTranslations[prompt.id]);
                const isFeaturedPrompt = prompt.id === featuredPromptId;

              return (
                <article
                  key={prompt.id}
                  role="button"
                  tabIndex={0}
                  data-tone={prompt.difficulty}
                  className={styles.promptSelectionCardCompact}
                  onClick={() => void handlePickPrompt(prompt.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handlePickPrompt(prompt.id);
                    }
                  }}
                >
                  <div className={styles.promptSelectionCardTopRow}>
                    <span className={styles.promptSelectionCardIndex}>
                      {`QUESTION ${String(index + 1).padStart(2, "0")}`}
                    </span>
                    {isFeaturedPrompt ? (
                      <span className={styles.promptSelectionFeaturedBadge}>오늘의 추천 질문</span>
                    ) : null}
                  </div>

                  <div className={styles.promptSelectionCardCopy}>
                    <strong>{prompt.questionEn}</strong>
                    {isTranslationVisible ? (
                      <small className={styles.translationText}>{prompt.questionKo}</small>
                    ) : null}
                  </div>

                  <div className={styles.promptSelectionCardFooter}>
                    <span className={styles.promptSelectionCardMeta}>{prompt.topic}</span>
                    <button
                      type="button"
                      className={`${styles.promptTranslationButton} ${styles.promptSelectionCardTranslateButton}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePromptTranslation(prompt.id);
                      }}
                    >
                      {isTranslationVisible ? "해석 숨기기" : "해석 보기"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    );
  }

  function renderMobileComposerBar({
    secondaryLabel,
    onSecondary,
    primaryLabel,
    onPrimary,
    primaryDisabled
  }: {
    secondaryLabel: string;
    onSecondary: () => void;
    primaryLabel: string;
    onPrimary: () => void;
    primaryDisabled: boolean;
  }) {
    return (
      <div ref={mobileComposerBarRef} className={styles.mobileComposerBar}>
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

  function renderWritingComposer({
    value,
    onChange,
    placeholder,
    wordCount,
    draftStatusMessage,
    promptActionLabel,
    onPromptAction,
    desktopAction
  }: {
    value: string;
    onChange: (nextValue: string) => void;
    placeholder: string;
    wordCount: number;
    draftStatusMessage?: string;
    promptActionLabel?: string;
    onPromptAction?: () => void;
    desktopAction?: ReactNode;
  }) {
    const draftStatusBadgeLabel = draftStatusMessage ? toDraftStatusBadgeLabel(draftStatusMessage) : "";
    const draftStatusBadgeClassName =
      draftStatusMessage && draftStatusMessage.includes("실패")
        ? styles.composerStatusBadgeError
        : styles.composerStatusBadge;

    return (
      <section className={styles.writingComposer}>
        <div className={styles.writingComposerQuestion}>
          <p className={styles.writingComposerQuestionLabel}>질문</p>
          <p className={styles.writingComposerQuestionText}>
            {selectedPrompt?.questionEn ?? "질문을 불러오는 중입니다."}
          </p>
          {showAnswerTranslation ? (
            <small className={styles.writingComposerTranslation}>
              {selectedPrompt?.questionKo ?? "질문 해석을 불러오는 중입니다."}
            </small>
          ) : null}
          {promptActionLabel && onPromptAction ? (
            <button
              type="button"
              className={styles.writingComposerQuestionAction}
              onClick={onPromptAction}
            >
              <span className="materialSymbols" aria-hidden="true">
                refresh
              </span>
              {promptActionLabel}
            </button>
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
          <div className={styles.composerMetaBadges}>
            {draftStatusBadgeLabel ? (
              <span className={draftStatusBadgeClassName} title={draftStatusMessage}>
                {draftStatusBadgeLabel}
              </span>
            ) : null}
            <span className={styles.composerWordCount}>{wordCount}단어</span>
          </div>
          <div className={styles.coachTriggerDock}>
            {!showCoachAssistant && !value.trim() ? (
              <div className={styles.coachTriggerBubble}>
                <span>표현이 막히면</span>
                <span>AI 코치에게 물어봐요.</span>
              </div>
            ) : null}
            <button
              type="button"
              className={styles.coachTriggerButton}
              aria-label="AI 코치 열기"
              aria-haspopup="dialog"
              aria-expanded={showCoachAssistant}
              onClick={() => setShowCoachAssistant(true)}
            >
              <Image
                src="/coach/mascote-face.png"
                alt=""
                width={60}
                height={60}
                sizes="(max-width: 768px) 50px, 60px"
                quality={100}
                className={styles.coachTriggerMascot}
              />
            </button>
          </div>
        </div>
        <div className={styles.writingComposerFooterRow}>
          <div className={styles.writingComposerTools}>
            <button
              type="button"
              className={styles.writingComposerToolButton}
              onClick={() => setShowAnswerTranslation((current) => !current)}
            >
              <span>{showAnswerTranslation ? "한국어 번역 숨기기" : "한국어 번역 보기"}</span>
              <span className={`materialSymbols ${styles.writingComposerToolGlyph}`} aria-hidden="true">
                translate
              </span>
            </button>
            <button
              type="button"
              className={styles.writingComposerToolButton}
              aria-haspopup={isMobileViewport ? "dialog" : undefined}
              aria-expanded={showHelpSheet}
              onClick={() => {
                if (isMobileViewport) {
                  setShowHelpSheet(true);
                  return;
                }

                setShowHelpSheet((current) => !current);
              }}
            >
              <span>가이드 보기</span>
              <span className={`materialSymbols ${styles.writingComposerToolGlyph}`} aria-hidden="true">
                auto_awesome
              </span>
            </button>
          </div>
          {desktopAction ? <div className={styles.composerDesktopActions}>{desktopAction}</div> : null}
        </div>
      </section>
    );
  }

  function renderPracticeExpressionHintCard() {
    if (!practiceExpressionHint || feedback) {
      return null;
    }

    const expressions = practiceExpressionHint.expressions.length > 0
      ? practiceExpressionHint.expressions
      : [practiceExpressionHint.expression];

    return (
      <section className={styles.practiceExpressionCard}>
        <span className={styles.practiceExpressionEyebrow}>
          {practiceExpressionHint.tagLabel ? "태그 연습" : "표현 연습"}
        </span>
        <p>
          {practiceExpressionHint.tagLabel
            ? `${practiceExpressionHint.tagLabel} 태그로 저장한 표현을 활용해 새 문장을 써보세요.`
            : "저장한 표현을 활용해 새 문장을 써보세요."}
        </p>
        <div className={styles.practiceExpressionScroller}>
          {expressions.map((expression, index) => (
            <button
              key={`${expression}-${index}`}
              type="button"
              className={`${styles.practiceExpressionChip} ${
                index === 0 ? styles.practiceExpressionChipPrimary : ""
              }`}
              onClick={() => appendExpressionToCurrentDraft(expression)}
            >
              {expression}
            </button>
          ))}
        </div>
      </section>
    );
  }

  async function handleCoachQuestionSubmit() {
    if (!selectedPrompt) {
      setCoachHelpError("질문을 먼저 선택해 주세요.");
      return;
    }

    const question = coachQuestion.trim();
    if (!question) {
      setCoachHelpError("AI에게 물어볼 표현 질문을 입력해 주세요.");
      return;
    }

    setIsLoadingCoachHelp(true);
    setCoachHelpError("");
    setCoachUsage(null);

    try {
      const request = {
        promptId: selectedPrompt.id,
        question,
        sessionId: sessionId || undefined,
        answer: (step === "rewrite" ? rewrite : answer).trim() || undefined,
        attemptType: step === "rewrite" ? ("REWRITE" as const) : ("INITIAL" as const)
      };

      let result: CoachHelpResponse;
      try {
        result = await requestCoachHelp(request);
      } catch {
        result = buildLocalCoachHelp(selectedPrompt, question);
      }

      setCoachHelp(result);
    } catch {
      setCoachHelpError("표현 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  function renderCoachAssistantPanel({ inDialog = false }: { inDialog?: boolean } = {}) {
    return (
      <section className={`${styles.coachPanel} ${inDialog ? styles.coachPanelDialog : ""}`}>
        <div className={styles.coachPanelHeader}>
          <div>
            <span className={styles.coachEyebrow}>AI 코치</span>
            <strong id={inDialog ? "coach-assistant-title" : undefined}>
              AI에게 표현 물어보기
            </strong>
            <p>
              사용자가 질문을 하면, 바로 쓸 수 있는 표현과 짧은 예문을 추천해 드려요.
            </p>
          </div>
        </div>

        <div className={styles.coachPromptArea}>
          <textarea
            ref={coachPromptInputRef}
            className={styles.coachPromptInput}
            value={coachQuestion}
            onChange={(event) => setCoachQuestion(event.target.value)}
            placeholder={'예: "근력을 키우고 싶다"를 어떻게 말해?'}
            rows={2}
          />
          <div className={styles.coachQuickActions}>
            {coachQuickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                className={styles.coachQuickChip}
                onClick={() => setCoachQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.coachActionRow}>
          <button
            type="button"
            className={styles.coachPrimaryButton}
            onClick={() => void handleCoachQuestionSubmit()}
            disabled={isLoadingCoachHelp || !selectedPrompt}
          >
            {isLoadingCoachHelp ? "표현을 고르는 중..." : "표현 추천받기"}
          </button>
          <span className={styles.coachActionMeta}>
            표현을 그대로 붙이지 말고, 내 문장 안에서 직접 풀어 써보세요.
          </span>
        </div>

        {coachHelpError ? <p className={styles.coachError}>{coachHelpError}</p> : null}
        {expressionSaveError ? <p className={styles.coachError}>{expressionSaveError}</p> : null}
        {expressionSaveNotice ? <p className={styles.coachNotice}>{expressionSaveNotice}</p> : null}

        {coachHelp ? (
          <div className={styles.coachResult}>
            <div className={styles.coachReplyCard}>
              <span className={styles.coachReplyBadge}>코치 답변</span>
              <p>{coachHelp.coachReply}</p>
            </div>
            <div className={styles.coachExpressionList}>
              {coachHelp.expressions.map((expression) => (
                <article key={expression.id} className={styles.coachExpressionCard}>
                  <div className={styles.coachExpressionTop}>
                    <strong>{expression.expression}</strong>
                    <span>{expression.meaningKo}</span>
                  </div>
                  <p>{expression.usageTip}</p>
                  <small>{expression.example}</small>
                  <div className={styles.coachExpressionActionRow}>
                    <button
                      type="button"
                      className={styles.coachExpressionGhostButton}
                      onClick={() => appendExpressionToCurrentDraft(expression.expression)}
                    >
                      문장에 넣기
                    </button>
                    <button
                      type="button"
                      className={
                        isExpressionSaved(expression.expression)
                          ? styles.coachExpressionSaveButtonActive
                          : styles.coachExpressionSaveButton
                      }
                      onClick={() =>
                        void handleToggleSavedExpression({
                          expression: expression.expression,
                          meaningKo: expression.meaningKo,
                          exampleEn: expression.example,
                          usageTipKo: expression.usageTip,
                          tags: expression.tags,
                          sourceType: "COACH_RECOMMENDATION",
                          coachInteractionId: coachHelp.interactionId
                        })
                      }
                      disabled={isExpressionSaving(expression.expression)}
                    >
                      {isExpressionSaving(expression.expression)
                        ? "저장 중"
                        : isExpressionSaved(expression.expression)
                          ? "저장됨"
                          : "저장"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
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


  function resolveLoopStatus(): FeedbackLoopStatus | null {
    if (!feedback) {
      return null;
    }

    return (
      feedback.ui?.loopStatus ?? {
        badge: feedback.loopComplete ? "루프 완료 가능" : "다시 써보기 추천",
        headline:
          feedback.completionMessage?.trim() ??
          (feedback.loopComplete
            ? "지금 단계에서 마무리해도 괜찮아요."
            : "지금은 한 가지만 먼저 고쳐서 다시 써 보세요."),
        supportText: feedback.loopComplete
          ? "원하면 한 번 더 다듬어 볼 수 있어요."
          : "위 starter를 바탕으로 바로 다시 써 볼 수 있어요.",
        rewriteCtaLabel: feedback.loopComplete ? "그래도 더 다듬어서 써보기" : "다시 써보기",
        finishCtaLabel: feedback.loopComplete ? "오늘 루프 완료하고 도장 받기" : null,
        cancelCtaLabel: "답변 취소"
      }
    );
  }


  function renderCoachMoveDiffSegment(
    segment: RenderedInlineFeedbackSegment,
    mode: "original" | "revised",
    index: number
  ) {
    switch (segment.kind) {
      case "equal":
        return <span key={`${mode}-equal-${index}`}>{segment.text}</span>;
      case "replace":
        return mode === "original" ? (
          <span key={`${mode}-replace-${index}`} className={styles.coachMoveBeforeHighlight}>
            {segment.removed}
          </span>
        ) : (
          <span key={`${mode}-replace-${index}`} className={styles.coachMoveAfterHighlight}>
            {segment.added}
          </span>
        );
      case "remove":
        return mode === "original" ? (
          <span key={`${mode}-remove-${index}`} className={styles.coachMoveBeforeHighlight}>
            {segment.text}
          </span>
        ) : null;
      case "add":
        return mode === "revised" ? (
          <span key={`${mode}-add-${index}`} className={styles.coachMoveAfterHighlight}>
            {segment.text}
          </span>
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

  function renderCoachMoveSection() {
    if (!shouldShowCoachMoveCard) {
      return null;
    }

    const before = trimNullable(coachMove?.before);
    const after = trimNullable(coachMove?.after);

    return (
      <section className={styles.coachMoveCard}>
        <h2 className={styles.coachMoveHeadline}>{coachHeadline}</h2>

        {hasCoachMove(coachMove) ? (
          <div className={styles.coachMoveBody}>
            {shouldShowCoachMoveComparison ? (
              <div className={styles.coachMoveSwap}>
                {before ? (
                  <div className={`${styles.coachMoveSwapRow} ${styles.coachMoveBeforeRow}`}>
                    <span className={styles.coachMoveSwapLabel}>지금</span>
                    <p className={styles.coachMoveBefore}>{renderCoachMoveDiffText(before, after ?? "", "original")}</p>
                  </div>
                ) : null}
                {after ? (
                  <div className={`${styles.coachMoveSwapRow} ${styles.coachMoveAfterRow}`}>
                    <span className={styles.coachMoveSwapLabel}>
                      {isLanguageFix ? "이번에 고친 문장" : "적용"}
                    </span>
                    <p className={styles.coachMoveAfter}>{renderCoachMoveDiffText(before ?? "", after, "revised")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {languageCorrections.length > 0 ? (
              <div className={styles.languageCorrectionList}>
                {languageCorrections.map((correction, index) => (
                  <article
                    key={`${correction.kind}-${correction.before ?? ""}-${index}`}
                    className={styles.languageCorrectionItem}
                  >
                    <span
                      className={`${styles.languageCorrectionBadge} ${
                        correction.kind === "STRUCTURE"
                          ? styles.languageCorrectionBadgeStructure
                          : correction.kind === "GRAMMAR_BLOCKING"
                            ? styles.languageCorrectionBadgeCore
                            : styles.languageCorrectionBadgeDetail
                      }`}
                    >
                      {correction.label}
                    </span>
                    {trimNullable(correction.before) || trimNullable(correction.after) ? (
                      <p className={styles.languageCorrectionSwap}>
                        {trimNullable(correction.before) ? (
                          <del>{correction.before}</del>
                        ) : null}
                        <span aria-hidden="true">→</span>
                        {trimNullable(correction.after) ? (
                          <strong>{correction.after}</strong>
                        ) : null}
                      </p>
                    ) : null}
                    <p className={styles.languageCorrectionReason}>{correction.reason}</p>
                  </article>
                ))}
                {hiddenLanguageCorrectionCount > 0 ? (
                  <button
                    type="button"
                    className={styles.languageCorrectionToggle}
                    aria-expanded={areAllLanguageCorrectionsVisible}
                    onClick={() =>
                      setAreAllLanguageCorrectionsVisible((current) => !current)
                    }
                  >
                    {areAllLanguageCorrectionsVisible
                      ? "추가 교정 접기"
                      : `교정 ${hiddenLanguageCorrectionCount}개 더 보기`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {trimNullable(coachMove?.why) ? (
              <div className={styles.coachMoveWhyBox}>
                {shouldShowCorrectionReasonLabel ? (
                  <span className={styles.coachMoveWhyLabel}>왜 고치나요</span>
                ) : null}
                <p className={styles.coachMoveWhy}>{coachMove?.why}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {false && trimNullable(coachMove?.successCheck) ? (
          <div className={styles.coachMoveSuccessBox}>
            <span className={styles.coachMoveSuccessLabel}>성공 기준</span>
            <p className={styles.coachMoveSuccess}>{coachMove?.successCheck}</p>
          </div>
        ) : null}

        <div className={styles.coachMoveInstructionBox}>
          <span className={styles.coachMoveInstructionLabel}>다시 쓸 때</span>
          <p className={styles.coachMoveInstruction}>{coachInstruction}</p>
          {coachSkeleton ? (
            <div className={styles.coachMoveSkeletonBox}>
              <span className={styles.coachMoveSkeletonLabel}>문장 틀</span>
              <p className={styles.coachMoveSkeleton}>{coachSkeleton}</p>
              {coachSkeletonKo ? <p className={styles.coachMoveSkeletonMeaning}>{coachSkeletonKo}</p> : null}
            </div>
          ) : null}
          {coachSuggestedPhrases.length > 0 ? (
            <div className={styles.coachMovePhraseBox}>
              <span className={styles.coachMovePhraseLabel}>넣어볼 표현</span>
              <div className={styles.coachMovePhraseList}>
                {coachSuggestedPhrases.map((phrase, index) => (
                  <span key={`${phrase.phrase}-${index}`} className={styles.coachMovePhraseChip}>
                    <strong>{phrase.phrase}</strong>
                    {phrase.meaningKo ? <small>{phrase.meaningKo}</small> : null}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderVisibleFeedbackSummary() {
    if (!feedback) {
      return null;
    }

    return (
      <div className={styles.visibleFeedbackStack}>
        {visibleStrength ? (
          <section className={styles.visibleStrengthCard}>
            <span>잘한 점</span>
            <p>{visibleStrength}</p>
          </section>
        ) : null}

        {renderCoachMoveSection()}

        {isLoopReadyToFinish && completionRefinementExpressions.length > 0 ? (
          <section className={styles.visibleExpressionCard}>
            <span className={styles.visibleExpressionLabel}>가볍게 넣어볼 표현</span>
            <div className={styles.visibleExpressionList}>
              {completionRefinementExpressions.map((expression) => {
                const saved = isExpressionSaved(expression.expression);
                const saving = isExpressionSaving(expression.expression);
                return (
                  <button
                    key={expression.expression}
                    type="button"
                    className={`${styles.visibleExpressionChip} ${
                      saved ? styles.visibleExpressionChipSaved : ""
                    }`}
                    onClick={() =>
                      void handleToggleSavedExpression({
                        expression: expression.expression,
                        meaningKo: expression.meaningKo,
                        exampleEn: expression.exampleEn,
                        usageTipKo: expression.guidanceKo,
                        tags: ["표현 더하기"],
                        sourceType: "REFINEMENT_EXPRESSION"
                      })
                    }
                    disabled={saving}
                  >
                    <strong>{expression.expression}</strong>
                    {expression.meaningKo ? <small>{expression.meaningKo}</small> : null}
                    <em>{saving ? "저장 중" : saved ? "저장됨" : "저장"}</em>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {isLoopReadyToFinish && visibleModelAnswer ? (
          <details className={styles.visibleModelAnswerCard}>
            <summary>
              <span>
                <small>참고용</small>
                <strong>모범답안</strong>
              </span>
              <span className={styles.visibleModelAnswerToggle}>펼쳐보기</span>
            </summary>
            <div className={styles.visibleModelAnswerBody}>
              <p>{visibleModelAnswer}</p>
              {visibleModelAnswerKo ? <p>{visibleModelAnswerKo}</p> : null}
            </div>
          </details>
        ) : null}
      </div>
    );
  }


  function renderHelpSheet() {
    if (!showHelpSheet || !isMobileViewport || (step !== "answer" && step !== "rewrite")) {
      return null;
    }

    return (
      <div className={styles.helpOverlay} onClick={() => setShowHelpSheet(false)}>
        <section
          className={styles.helpSheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby="writing-help-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            ref={helpSheetCloseButtonRef}
            type="button"
            className={styles.helpSheetClose}
            aria-label="작성 가이드 닫기"
            onClick={() => setShowHelpSheet(false)}
          >
            ×
          </button>
          <div className={styles.helpSheetHeader}>
            <strong id="writing-help-title">작성 가이드</strong>
          </div>
          <div className={styles.helpSheetBody}>
            <section className={styles.guideOverviewCard}>
              <span className={styles.guideOverviewLabel}>최고의 팁!</span>
              <strong className={styles.guideOverviewTitle}>{answerGuide.title}</strong>
              {answerGuide.description ? (
                <p className={styles.guideOverviewBody}>{answerGuide.description}</p>
              ) : null}
            </section>

            <section className={styles.guideStarterSection}>
              <strong className={styles.guideStarterSectionLabel}>첫 문장 스타터</strong>
              <div className={styles.guideStarterSurface}>
                <span className={styles.guideStarterSurfaceText}>{answerGuide.starter}</span>
              </div>
            </section>

            <section className={styles.helpSheetSection}>
              {isLoadingHints ? (
                <p className={styles.helpSheetEmpty}>지금 추천 단어와 표현을 준비하고 있어요.</p>
              ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
                <div className={styles.helpSheetHintGroups}>
                  {vocabularyWordHintItems.length > 0 ? (
                    <div className={styles.hintGroup}>
                      <strong className={styles.hintGroupTitle}>추천 단어</strong>
                      <div className={styles.hintChipList}>
                        {vocabularyWordHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                      </div>
                    </div>
                  ) : null}
                  {vocabularyPhraseHintItems.length > 0 ? (
                    <div className={styles.hintGroup}>
                      <strong className={styles.hintGroupTitle}>추천 표현</strong>
                      <div className={styles.hintChipList}>
                        {vocabularyPhraseHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className={styles.helpSheetEmpty}>이 질문에는 아직 추천 단어와 표현이 없어요.</p>
              )}
            </section>
          </div>
        </section>
      </div>
    );
  }

  function renderWritingGuideSummary() {
    return (
      <div className={styles.writingGuideSummary}>
        <section className={styles.guideOverviewCard}>
          <span className={styles.guideOverviewLabel}>최고의 팁!</span>
          <strong className={styles.guideOverviewTitle}>{answerGuide.title}</strong>
          {answerGuide.description ? (
            <p className={styles.guideOverviewBody}>{answerGuide.description}</p>
          ) : null}
        </section>
        <section className={styles.guideStarterSection}>
          <strong className={styles.guideStarterSectionLabel}>첫 문장 스타터</strong>
          <div className={styles.guideStarterSurface}>
            <span className={styles.guideStarterSurfaceText}>{answerGuide.starter}</span>
          </div>
        </section>
        <section className={styles.writingGuideHintSection}>
          {isLoadingHints ? (
            <p className={styles.writingGuideHintEmpty}>지금 추천 단어와 표현을 준비하고 있어요.</p>
          ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
            <div className={styles.writingGuideHintGroups}>
              {vocabularyWordHintItems.length > 0 ? (
                <div className={styles.hintGroup}>
                  <strong className={styles.hintGroupTitle}>추천 단어</strong>
                  <div className={styles.hintChipList}>
                    {vocabularyWordHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                  </div>
                </div>
              ) : null}
              {vocabularyPhraseHintItems.length > 0 ? (
                <div className={styles.hintGroup}>
                  <strong className={styles.hintGroupTitle}>추천 표현</strong>
                  <div className={styles.hintChipList}>
                    {vocabularyPhraseHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={styles.writingGuideHintEmpty}>이 질문에는 아직 추천 단어와 표현이 없어요.</p>
          )}
        </section>
      </div>
    );
  }

  function renderAnswerStep() {
    return (
      <section className={`${styles.stage} ${styles.writingEditorStage}`} style={mobileComposerBarStyle}>
        {renderWritingComposer({
          value: answer,
          onChange: setAnswer,
          placeholder: "여기에 영어로 첫 답변을 작성해 주세요.",
          wordCount: answerWordCount,
          draftStatusMessage,
          promptActionLabel: "질문 다시 고르기",
          onPromptAction: () => setStep("pick"),
          desktopAction: (
            <button
              type="button"
              className={styles.writingEditorPrimaryButton}
              onClick={() => handleSubmit(answer, "INITIAL")}
              disabled={isSubmitting || isLoadingPrompts}
            >
              {isSubmitting ? "피드백 생성 중..." : "답변 제출하기"}
            </button>
          )
        })}
        {renderPracticeExpressionHintCard()}
        {renderMobileComposerBar({
          secondaryLabel: "질문 목록",
          onSecondary: () => setStep("pick"),
          primaryLabel: isSubmitting ? "피드백 생성 중..." : "답변 제출",
          onPrimary: () => handleSubmit(answer, "INITIAL"),
          primaryDisabled: isSubmitting || isLoadingPrompts
        })}
        {!isMobileViewport && showHelpSheet ? renderWritingGuideSummary() : null}
      </section>
    );
  }

  function renderFeedbackStep() {
    const resolvedLoopStatus = resolveLoopStatus();
    const showRewriteCta = Boolean(feedback);
    const showFinishCta = isLoopReadyToFinish;
    const completionHeadline =
      visibleFeedback?.completion?.headline ??
      resolvedLoopStatus?.headline ??
      feedback?.completionMessage ??
      feedbackLevel?.summary ??
      "좋아요. 지금 단계에서 마무리해도 충분해요.";

    return (
      <section className={`${styles.stage} ${styles.premiumFeedbackTheme}`}>
        {feedback ? (
          <div className={styles.feedbackBody}>
            <div className={styles.feedbackAttemptMetaRow}>
              <span className={styles.feedbackAttemptMetaOnly}>{`${feedback.attemptNo}번째 시도`}</span>
            </div>
            {renderVisibleFeedbackSummary()}
          </div>
        ) : (
          <p className={styles.placeholderText}>답변을 제출하면 여기에 피드백이 표시됩니다.</p>
        )}
        {feedback ? (
          <div className={`${styles.stageFooter} ${styles.feedbackCompletionFooter}`}>
            {showFinishCta ? (
              <div className={styles.feedbackCompletionCard}>
                <div className={styles.feedbackCompletionSpeechRow}>
                  <div className={styles.feedbackCompletionBubble}>
                    <strong className={styles.feedbackCompletionHeadline}>{completionHeadline}</strong>
                  </div>
                  <div className={styles.feedbackCompletionMascotFrame}>
                    <Image
                      src="/feedback/good.png"
                      alt=""
                      width={88}
                      height={88}
                      className={styles.feedbackCompletionMascot}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {showFinishCta ? (
              <button
                type="button"
                className={styles.footerButtonRewrite}
                onClick={() => void handleFinishLoop()}
                disabled={isFinishingLoop}
              >
                {isFinishingLoop
                  ? "완료하는 중..."
                  : resolvedLoopStatus?.finishCtaLabel ?? "루프 완료하기"}
              </button>
            ) : null}
            {showRewriteCta ? (
              <button
                type="button"
                className={
                  showFinishCta
                    ? `${styles.footerButtonSecondary} ${styles.footerButtonOutline}`
                    : styles.footerButtonRewrite
                }
                onClick={handleRewriteFromCurrentAnswer}
                disabled={!feedback}
              >
                {resolvedLoopStatus?.rewriteCtaLabel ??
                  (showFinishCta ? "그래도 더 다듬어서 써보기" : "다시 써보기")}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  function renderRewriteStep() {
    const previousAnswerForRewrite = lastSubmittedAnswer.trim() || answer.trim() || rewrite.trim();

    return (
      <section className={`${styles.stage} ${styles.writingEditorStage}`} style={mobileComposerBarStyle}>
        {renderWritingComposer({
          value: rewrite,
          onChange: setRewrite,
          placeholder: "피드백을 반영한 영어 답변을 다시 작성해 주세요.",
          wordCount: rewriteWordCount,
          draftStatusMessage,
          promptActionLabel: showRewriteFeedback ? "이전 피드백 숨기기" : "이전 피드백 보기",
          onPromptAction: toggleRewriteFeedback
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
            <p>{previousAnswerForRewrite || "먼저 첫 답변을 제출해 주세요."}</p>
          </div>
        </div>
        {feedback ? (
          <section ref={rewriteFeedbackPanelRef} className={styles.rewriteFeedbackPanel}>
            <div className={styles.rewriteFeedbackHeader}>
              <div>
                <strong>이전 피드백</strong>
                <p>직전 답변에서 받은 피드백을 같은 구조로 다시 보면서 문장을 다듬어 보세요.</p>
              </div>
              <button
                type="button"
                className={styles.rewriteFeedbackToggle}
                onClick={toggleRewriteFeedback}
            >
              {showRewriteFeedback ? "피드백 숨기기" : "피드백 보기"}
            </button>
          </div>
            {showRewriteFeedback ? (
              <div className={styles.rewriteFeedbackBody}>{renderVisibleFeedbackSummary()}</div>
            ) : null}
          </section>
        ) : null}
        <div className={styles.writingEditorFooterStack}>
          <div className={styles.writingEditorFooter}>
            <button
              type="button"
              className={styles.writingEditorPrimaryButton}
              onClick={() => handleSubmit(rewrite, "REWRITE")}
              disabled={isSubmitting || !feedback}
            >
              {isSubmitting ? "피드백 생성 중..." : "다시 쓴 답변 제출하기"}
            </button>
          </div>
        </div>
        {!isMobileViewport && showHelpSheet ? renderWritingGuideSummary() : null}
      </section>
    );
  }

  function renderCompleteStep() {
    const recommendedPrompts = completionRelatedPrompts.slice(0, 2);
    const completionHeading = "루프를 완주했어요!";
    const completionSubcopy =
      feedback?.completionMessage?.trim() ??
      feedbackLevel?.loopSummary ??
      "꾸준함이 실력을 만듭니다. 오늘도 멋진 글을 썼네요!";
    const streakLabel =
      streakDays > 0 ? `${streakDays}일 연속 학습 중` : "오늘 첫 루프 완료";
    const totalWrittenSentenceLabel = `총 ${(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성`;

    return (
      <section className={styles.completeStage}>
        <canvas ref={celebrationCanvasRef} className={styles.celebrationCanvas} aria-hidden="true" />
        <div className={styles.completionStoryShell}>
          <div className={styles.completionMascotStage}>
            <div className={styles.completionMascotFrame}>
              <Image
                src="/complete/excellent.png"
                alt="WriteLoop 완료 마스코트"
                width={120}
                height={120}
                className={styles.completionMascotImage}
              />
            </div>
            <span className={styles.completionMascotBadge}>SUCCESS!</span>
          </div>

          <div className={styles.completionStoryCopy}>
            <h2>{completionHeading}</h2>
            <p>{completionSubcopy}</p>
          </div>

          <div className={styles.completionStreakPanel}>
            <div className={styles.completionStreakIcon}>
              <span className="materialSymbols">local_fire_department</span>
            </div>
            <span className={styles.completionStreakEyebrow}>CURRENT STREAK</span>
            <strong>{streakLabel}</strong>
            <p className={styles.completionStreakMeta}>{totalWrittenSentenceLabel}</p>
          </div>

          {recommendedPrompts.length > 0 ? (
            <div className={styles.completionRecommendationSection}>
              <div className={styles.completionRecommendationTitle}>
                <span className="materialSymbols">timelapse</span>
                <strong>다음 질문 추천</strong>
              </div>
              <div className={styles.completionRecommendationList}>
                {recommendedPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className={styles.completionRecommendationCard}
                    onClick={() => void handlePickPrompt(prompt.id)}
                  >
                    <span>{`${getDifficultyLabel(prompt.difficulty)} • ${prompt.topic}`}</span>
                    <strong>{prompt.questionEn}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.completionActionStack}>
            {recommendedPrompts.length > 0 ? (
              <button
                type="button"
                className={`${styles.primaryButton} ${styles.completionActionPrimary}`}
                onClick={() => void handlePickPrompt(recommendedPrompts[0].id)}
                disabled={isLoadingPrompts}
              >
                추천 질문에 이어서 답변하기
              </button>
            ) : null}
            <div className={styles.completionActionRow}>
              <button
                type="button"
                className={`${styles.ghostButton} ${styles.completionActionSecondary}`}
                onClick={handleTryAnotherPrompt}
              >
                다른 질문 보기
              </button>
              <button
                type="button"
                className={`${styles.ghostButton} ${styles.completionActionSecondary}`}
                onClick={() => setStep("feedback")}
              >
                마지막 피드백 다시 보기
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderMonthStatusModal() {
    if (!showMonthStatus || !currentUser) {
      return null;
    }

    const streakDays = isLoadingMonthStatus ? todayStatus?.streakDays ?? 0 : monthCalendar.streakDays;

    return (
      <div className={styles.monthStatusOverlay} onClick={() => setShowMonthStatus(false)}>
        <section
          className={styles.monthStatusDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="month-status-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={styles.monthStatusClose}
            ref={monthStatusCloseButtonRef}
            aria-label="학습 캘린더 닫기"
            onClick={() => setShowMonthStatus(false)}
          >
            ×
          </button>
          <div className={styles.monthStatusCopy}>
            <div className={styles.monthStatusBadge}>전체 이력 달력</div>
            <h2 id="month-status-title">학습 캘린더</h2>
            <div className={styles.monthStatusMonthRail} aria-label="달 이동">
              <button
                type="button"
                className={styles.monthStatusNavButton}
                aria-label="이전 달 보기"
                onClick={() => moveMonth(-1)}
              >
                ‹
              </button>
              <div className={styles.monthStatusMonthDisplay} aria-live="polite">
                <span className={styles.monthStatusMonthYear}>{monthCalendar.year}</span>
                <strong className={styles.monthStatusMonthValue}>{monthCalendar.month}</strong>
              </div>
              <button
                type="button"
                className={styles.monthStatusNavButton}
                aria-label={isCurrentMonthView ? "다음 달은 아직 볼 수 없어요" : "다음 달 보기"}
                onClick={() => moveMonth(1)}
                disabled={isCurrentMonthView}
              >
                ›
              </button>
            </div>
            <div className={styles.monthStatusSummary}>
              <div className={styles.monthStatusSummaryItem}>
                <div className={styles.monthStatusSummaryCard}>
                  <StreakSparkleEffect
                    className={styles.monthStatusSummarySparkleLayer}
                    streakDays={streakDays}
                  />
                  <div className={styles.monthStatusSummaryCopy}>
                    <span>현재 연속 학습일</span>
                    <strong>{streakDays}일</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.monthStatusBody}>
            {isLoadingMonthStatus ? (
              <div className={styles.monthStatusStatePanel}>
                <strong>달력을 불러오는 중이에요.</strong>
                <p>선택한 달의 학습 흐름을 정리하고 있어요. 잠시만 기다려 주세요.</p>
              </div>
            ) : monthStatusError ? (
              <div className={styles.monthStatusStatePanel}>
                <strong>달력을 불러오지 못했어요.</strong>
                <p>{monthStatusError}</p>
              </div>
            ) : (
              <>
                <div className={styles.monthStatusWeekdays} aria-hidden="true">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className={styles.monthStatusCalendar} aria-label={`${monthCalendar.monthLabel} 달력`}>
                  {monthCalendar.cells.map((cell, index) =>
                    cell ? (
                      (() => {
                        const statusLabel = cell.status?.completed
                          ? cell.status.isToday
                            ? "오늘 완료"
                            : "완료"
                          : cell.status?.started
                            ? cell.status.isToday
                              ? "오늘 진행 중"
                              : "진행 중"
                            : cell.status?.isToday
                              ? "오늘"
                              : cell.isFuture
                                ? ""
                                : "기록 없음";
                        const visibleStatusLabel = statusLabel === "기록 없음" ? "" : statusLabel;
                        const canOpenHistory = Boolean(cell.status?.started || cell.status?.completed);
                        const className = `${styles.monthStatusDay} ${
                          cell.status?.completed ? styles.monthStatusDayCompleted : ""
                        } ${cell.status?.started && !cell.status.completed ? styles.monthStatusDayStarted : ""} ${
                          cell.status?.isToday ? styles.monthStatusDayToday : ""
                        } ${cell.isFuture ? styles.monthStatusDayFuture : ""} ${
                          !cell.status && !cell.isFuture ? styles.monthStatusDayIdle : ""
                        } ${canOpenHistory ? styles.monthStatusDayInteractive : ""}`;

                        if (canOpenHistory) {
                          return (
                            <button
                              key={cell.key}
                              type="button"
                              className={className}
                              style={getMonthStatusDayStyle(cell)}
                              aria-label={`${monthCalendar.monthLabel} ${cell.dayNumber}일, ${statusLabel} 기록 보기`}
                              onClick={() => {
                                setShowMonthStatus(false);
                                router.push(`/me?tab=writing&date=${cell.key}`);
                              }}
                            >
                              <span className={styles.monthStatusDayHeader}>
                                <span className={styles.monthStatusDayNumber}>{cell.dayNumber}</span>
                              </span>
                              {visibleStatusLabel ? (
                                <span className={styles.monthStatusDayState}>{visibleStatusLabel}</span>
                              ) : null}
                            </button>
                          );
                        }

                        return (
                          <div
                            key={cell.key}
                            className={className}
                            style={getMonthStatusDayStyle(cell)}
                            aria-label={`${monthCalendar.monthLabel} ${cell.dayNumber}일, ${statusLabel}`}
                          >
                            <span className={styles.monthStatusDayHeader}>
                              <span className={styles.monthStatusDayNumber}>{cell.dayNumber}</span>
                            </span>
                            {visibleStatusLabel ? (
                              <span className={styles.monthStatusDayState}>{visibleStatusLabel}</span>
                            ) : null}
                          </div>
                        );
                      })()
                    ) : (
                      <span key={`month-empty-${index}`} className={styles.monthStatusEmptyCell} aria-hidden="true" />
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderFeedbackLoadingOverlay() {
    if (!isSubmitting) {
      return null;
    }

    const activeStage =
      feedbackLoadingStages[Math.min(activeFeedbackLoadingStageIndex, feedbackLoadingStages.length - 1)] ??
      feedbackLoadingStages[0] ?? {
        title: "피드백을 만들고 있어요",
        message: "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."
      };

    return (
      <div className={styles.feedbackLoadingOverlay} role="status" aria-live="polite" aria-busy="true">
        <div className={styles.feedbackLoadingCard}>
          <div className={styles.feedbackLoadingIllustration}>
            <div className={styles.feedbackLoadingHalo} aria-hidden="true" />
            <div className={styles.feedbackLoadingMascotFrame}>
              <Image
                src="/coach/mascote-face.png"
                alt=""
                width={132}
                height={132}
                className={styles.feedbackLoadingMascot}
              />
            </div>
          </div>
          <strong className={styles.feedbackLoadingTitle}>{activeStage.title}</strong>
          <p className={styles.feedbackLoadingMessage}>{activeStage.message}</p>
          <div className={styles.feedbackLoadingDots} aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={`feedback-loading-dot-${index}`}
                className={styles.feedbackLoadingDot}
                style={{ animationDelay: `${index * 0.14}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderCoachAssistantModal() {
    if (!showCoachAssistant || (step !== "answer" && step !== "rewrite")) {
      return null;
    }

    return (
      <div className={styles.coachOverlay} onClick={() => setShowCoachAssistant(false)}>
        <section
          className={styles.coachDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="coach-assistant-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            ref={coachDialogCloseButtonRef}
            type="button"
            className={styles.coachDialogClose}
            aria-label="AI 코치 닫기"
            onClick={() => setShowCoachAssistant(false)}
          >
            ×
          </button>
          {renderCoachAssistantPanel({ inDialog: true })}
        </section>
      </div>
    );
  }

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
                onClick={persistDraftForLogin}
              >
                로그인하러 가기
              </Link>
              <Link
                href={`/register?returnTo=${encodeURIComponent(HOME_RETURN_TO)}`}
                className={`${styles.ghostLink} ${styles.loginWallSecondaryAction}`}
                onClick={persistDraftForLogin}
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

      {step === "pick" && renderPickStep()}
      {step === "answer" && renderAnswerStep()}
      {step === "feedback" && renderFeedbackStep()}
      {step === "rewrite" && renderRewriteStep()}
      {step === "complete" && renderCompleteStep()}
      {renderFeedbackLoadingOverlay()}
      {renderHelpSheet()}
      {renderCoachAssistantModal()}
      {renderMonthStatusModal()}
    </main>
  );
}
