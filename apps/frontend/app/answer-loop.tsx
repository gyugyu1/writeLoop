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
  deleteWritingDraft,
  getCurrentUser,
  getDailyPrompts,
  getMonthStatus,
  getPrompts,
  getPromptHints,
  getTodayWritingStatus,
  getWritingDraft,
  saveWritingDraft,
  requestCoachHelp,
  submitFeedback
} from "../lib/api";
import { saveHomeDraftForLogin, takeHomeDraftForLogin } from "../lib/auth-flow";
import {
  deleteLocalWritingDraft,
  getPreferredLocalWritingDraft,
  saveLocalWritingDraft
} from "../lib/home-writing-drafts";
import { buildCoachQuickQuestions } from "../lib/coach-quick-questions";
import { filterSuggestedRefinementExpressions } from "../lib/refinement-recommendations";
import { getDifficultyLabel } from "../lib/difficulty";
import { getFeedbackLevelInfo } from "../lib/feedback-level";
import { buildInlineFeedbackSegments, type RenderedInlineFeedbackSegment } from "../lib/inline-feedback";
import { buildLocalCoachHelp, buildLocalCoachUsage } from "../lib/coach";
import type {
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  CoachHelpResponse,
  CoachUsageCheckResponse,
  Feedback,
  FeedbackLoopStatus,
  FeedbackSecondaryLearningPoint,
  FeedbackScreenPolicy,
  HistoryMonthStatus,
  HomeDraftSnapshot,
  HomeFlowStep,
  Prompt,
  PromptHint,
  TodayWritingStatus,
  WritingDraft,
  WritingDraftType
} from "../lib/types";
import { StreakSparkleEffect } from "../components/streak-sparkle-effect";
import styles from "./page.module.css";

const GUEST_ID_KEY = "writeloop_guest_id";
const GUEST_SESSION_ID_KEY = "writeloop_guest_session_id";
const GUEST_PROMPT_ID_KEY = "writeloop_guest_prompt_id";
const HOME_RETURN_TO = "/";

type Step = "pick" | "answer" | "feedback" | "rewrite" | "complete";
type PickFlowScreen = "difficulty" | "prompt";
type UsedExpressionCard = {
  key: string;
  expression: string;
  matchedText?: string | null;
  usageTip: string;
};
type NextExpressionCard = {
  key: string;
  expression: string;
  primaryText?: string | null;
  secondaryText?: string | null;
};
type WritingGuideHintItem = {
  id: string;
  content: string;
  meaningKo?: string | null;
};

type RewriteSuggestion = {
  key: string;
  english: string;
  korean?: string | null;
  note?: string | null;
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

function normalizeExpressionKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

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

function looksLikeEnglishText(value?: string | null) {
  const text = trimNullable(value);
  if (!text) {
    return false;
  }
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  const hangulCount = (text.match(/[가-힣]/g) ?? []).length;
  return latinCount > 0 && latinCount >= hangulCount;
}

function looksLikeEnglishSentence(value?: string | null) {
  const text = trimNullable(value);
  if (!text || !looksLikeEnglishText(text)) {
    return false;
  }
  if (/[.!?]/.test(text) || text.includes(",")) {
    return true;
  }
  return text.split(/\s+/).length >= 5;
}

function isGenericLearningPointTitle(value?: string | null) {
  const normalized = trimNullable(value)?.replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }
  return (
    normalized === "보조 학습 포인트" ||
    normalized === "써보면 좋은 표현" ||
    normalized === "작은 표현 다듬기"
  );
}

const REWRITE_PLACEHOLDER_PATTERN = /(?:_{3,}|\.{3,})/;
const REWRITE_CONNECTOR_WORDS = new Set([
  "because",
  "and",
  "but",
  "so",
  "or",
  "to",
  "for",
  "with",
  "in",
  "on",
  "at",
  "about",
  "after",
  "before",
  "if",
  "when",
  "that"
]);
const REWRITE_OVERLAP_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "because",
  "been",
  "being",
  "but",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "us",
  "was",
  "we",
  "were",
  "with",
  "you",
  "your"
]);

function stripRewriteSuggestionTerminalPunctuation(value: string) {
  return value.replace(/[.!?]+$/g, "").trim();
}

function extractRewriteComparisonTokens(value?: string | null) {
  const text = trimNullable(value)?.toLowerCase() ?? "";
  return text
    .match(/[a-z]+(?:'[a-z]+)?/g)
    ?.filter((token) => !REWRITE_OVERLAP_STOP_WORDS.has(token)) ?? [];
}

function canSuggestionFillRewriteStarter(english: string, starter?: string | null) {
  const normalizedStarter = trimNullable(starter);
  if (!normalizedStarter || !REWRITE_PLACEHOLDER_PATTERN.test(normalizedStarter)) {
    return false;
  }

  const cleanedEnglish = stripRewriteSuggestionTerminalPunctuation(english);
  if (!cleanedEnglish) {
    return false;
  }

  const sentenceLikeWordCount = cleanedEnglish.split(/\s+/).filter(Boolean).length;
  if (sentenceLikeWordCount > 10) {
    return false;
  }

  if (/[.!?]\s+\S/.test(cleanedEnglish)) {
    return false;
  }

  const [prefix = ""] = normalizedStarter.split(REWRITE_PLACEHOLDER_PATTERN, 2);
  const prefixLastWord = (prefix.toLowerCase().match(/[a-z]+(?:'[a-z]+)?(?=[^a-z']*$)/) ?? [null])[0];
  const candidateLower = cleanedEnglish.toLowerCase();

  if (prefixLastWord && REWRITE_CONNECTOR_WORDS.has(prefixLastWord)) {
    if (candidateLower === prefixLastWord || candidateLower.startsWith(`${prefixLastWord} `)) {
      return false;
    }
  }

  const candidateTokens = extractRewriteComparisonTokens(cleanedEnglish);
  const prefixTokens = new Set(extractRewriteComparisonTokens(prefix));
  if (candidateTokens.length >= 3) {
    const overlapCount = candidateTokens.filter((token) => prefixTokens.has(token)).length;
    if (overlapCount / candidateTokens.length >= 0.5) {
      return false;
    }
  }

  return true;
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
  const remaining = [...uniqueCandidates];

  while (selected.length < desiredCount && remaining.length > 0) {
    const anchorPrompts = [...currentPrompts, ...selected];
    const nextPrompt =
      remaining
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

function buildWelcomeWeek(todayStatus: TodayWritingStatus | null) {
  const today = todayStatus ? parseLocalDate(todayStatus.date) : new Date();
  const todayKey = formatDateKey(today);
  const completedKeys = new Set<string>();

  if (todayStatus && todayStatus.streakDays > 0) {
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
  const router = useRouter();
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
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [showRewriteFeedback, setShowRewriteFeedback] = useState(false);
  const [showPreviousRewriteAnswer, setShowPreviousRewriteAnswer] = useState(false);
  const [showAnswerTranslation, setShowAnswerTranslation] = useState(false);
  const [showMonthStatus, setShowMonthStatus] = useState(false);
  const [showCoachAssistant, setShowCoachAssistant] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [monthView, setMonthView] = useState<MonthView | null>(null);
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
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [didAttemptPersistedDraftRestore, setDidAttemptPersistedDraftRestore] = useState(false);
  const [draftStatusMessage, setDraftStatusMessage] = useState("");
  const [questionRefreshHistory, setQuestionRefreshHistory] = useState<string[]>([]);
  const [isRefreshingQuestion, setIsRefreshingQuestion] = useState(false);
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const celebrationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mobileComposerBarRef = useRef<HTMLDivElement | null>(null);
  const coachPromptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const coachDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpSheetCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const knownPersistedDraftKeysRef = useRef<Set<string>>(new Set());
  const [mobileComposerBarHeight, setMobileComposerBarHeight] = useState(0);
  const monthStatusCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentMonthView = useMemo(
    () => createMonthView(todayStatus?.date ? parseLocalDate(todayStatus.date) : new Date()),
    [todayStatus?.date]
  );
  const activeMonthView = monthView ?? currentMonthView;
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
    setShowCoachAssistant(false);
    setError("");
    setShowRewriteFeedback(false);
    setShowAnswerTranslation(false);
  }, [currentUser, didRestoreDraft]);

  useEffect(() => {
    setDidAttemptPersistedDraftRestore(false);
  }, [selectedDifficulty, currentUser?.id]);

  useEffect(() => {
    setQuestionRefreshHistory([]);
  }, [selectedDifficulty]);

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
  const pendingDifficultyOption = useMemo(
    () => DIFFICULTY_OPTIONS.find((option) => option.value === pendingDifficultySelection) ?? null,
    [pendingDifficultySelection]
  );
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
  const coachQuickQuestions = useMemo(
    () => buildCoachQuickQuestions(selectedPrompt),
    [selectedPrompt]
  );
  const rewriteWordCount = useMemo(() => countWords(rewrite), [rewrite]);
  const welcomeWeekDays = useMemo(() => buildWelcomeWeek(todayStatus), [todayStatus]);
  const monthCalendar = buildMonthCalendar(monthStatus, activeMonthView, todayStatus?.date);
  const welcomeStreakMessage = useMemo(() => {
    if (!todayStatus) {
      return "이번 주 흐름을 채워보세요.";
    }

    if (todayStatus.completed) {
      return "오늘도 연속 학습을 이어가고 있어요.";
    }

    if (todayStatus.streakDays > 0) {
      return "오늘 한 번 더 쓰면 연속 기록이 이어져요.";
    }

    return "오늘부터 다시 연속 학습을 시작해보세요.";
  }, [todayStatus]);
  const mobileComposerBarStyle = useMemo(
    () =>
      ({
        "--mobile-composer-bar-height": `${mobileComposerBarHeight}px`
      }) as CSSProperties,
    [mobileComposerBarHeight]
  );
  const fallbackUsedExpressions = useMemo<UsedExpressionCard[]>(
    () =>
      (feedback?.usedExpressions ?? []).map((expression) => ({
        key: expression.expression,
        expression: expression.expression,
        matchedText: expression.matchedText ?? null,
        usageTip: expression.usageTip ?? "답변 안에서 자연스럽게 살린 표현이에요."
      })),
    [feedback?.usedExpressions]
  );
  const usedExpressions = useMemo<UsedExpressionCard[]>(
    () =>
      (coachUsage?.usedExpressions ?? []).length > 0
        ? (coachUsage?.usedExpressions ?? []).map((expression) => ({
            key: expression.id,
            expression: expression.expression,
            matchedText: expression.matchedText ?? null,
            usageTip: expression.usageTip
          }))
        : fallbackUsedExpressions,
    [coachUsage?.usedExpressions, fallbackUsedExpressions]
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
  const completionNextExpressions = useMemo<NextExpressionCard[]>(() => {
    const nextExpressions: NextExpressionCard[] = [];
    const seen = new Set<string>();

    for (const expression of coachUsage?.unusedExpressions ?? []) {
      const key = normalizeExpressionKey(expression.expression);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      nextExpressions.push({
        key: `coach-${expression.id}`,
        expression: expression.expression,
        primaryText: expression.meaningKo,
        secondaryText: expression.usageTip
      });
    }

    const refinementExpressions = filterSuggestedRefinementExpressions(
      feedback?.refinementExpressions,
      lastSubmittedAnswer,
      feedback?.correctedAnswer
    );
    for (const expression of refinementExpressions) {
      const key = normalizeExpressionKey(expression.expression);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      nextExpressions.push({
        key: `feedback-${expression.expression}`,
        expression: expression.expression,
        primaryText: expression.meaningKo,
        secondaryText: expression.guidanceKo
      });
    }

    return nextExpressions.slice(0, 4);
  }, [coachUsage?.unusedExpressions, feedback?.correctedAnswer, feedback?.refinementExpressions, lastSubmittedAnswer]);
  const completionRelatedPrompts = useMemo(
    () => coachRelatedPrompts.slice(0, 3),
    [coachRelatedPrompts]
  );

  const isLoggedIn = Boolean(currentUser);
  const activeDraftType: WritingDraftType | null =
    step === "answer" ? "ANSWER" : step === "rewrite" ? "REWRITE" : null;
  const isGuestCycleComplete = Boolean(feedback && guestSessionId && feedback.attemptNo >= 2);
  const shouldSuggestFinish = Boolean(feedback?.ui?.screenPolicy?.showFinishCta ?? feedback?.loopComplete);
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

    const targetPrompt = promptById.get(promptId);
    if (targetPrompt && targetPrompt.difficulty !== selectedDifficulty) {
      setSelectedDifficulty(targetPrompt.difficulty);
      setPendingDifficultySelection(targetPrompt.difficulty);
    }

    if (await restorePersistedDraft(promptId)) {
      return;
    }

    resetFlowForPrompt(promptId);
  }

  function handleRefreshPromptList() {
    if (prompts.length === 0) {
      setError("질문을 먼저 불러와 주세요.");
      return;
    }

    const sourcePrompts = allPrompts.length > 0 ? allPrompts : prompts;
    const sameDifficultyCandidates = sourcePrompts.filter(
      (prompt) => prompt.difficulty === selectedDifficulty
    );
    const desiredCount = prompts.length > 0 ? prompts.length : 3;

    const nextPrompts = pickLeastOverlappingPromptSet(
      prompts,
      sameDifficultyCandidates,
      [...questionRefreshHistory, ...prompts.map((prompt) => prompt.id)],
      desiredCount
    );

    if (nextPrompts.length < desiredCount) {
      setError("이 난이도에서 새로 보여드릴 질문 3개를 아직 고르지 못했어요.");
      return;
    }

    setIsRefreshingQuestion(true);
    setQuestionRefreshHistory((current) =>
      Array.from(new Set([...current, ...prompts.map((prompt) => prompt.id), ...nextPrompts.map((prompt) => prompt.id)])).slice(-18)
    );
    setDailyRecommendation((current) =>
      current
        ? {
            ...current,
            difficulty: selectedDifficulty,
            prompts: nextPrompts
          }
        : {
            recommendedDate: new Date().toISOString().slice(0, 10),
            difficulty: selectedDifficulty,
            prompts: nextPrompts
          }
    );
    setRevealedTranslations({});
    setSelectedPromptId(nextPrompts[0]?.id ?? "");
    setError("");
    setIsRefreshingQuestion(false);
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
      clearCoachState();
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
    setShowCoachAssistant(false);
    setShowHelpSheet(false);
    setIsSubmitting(true);

    const coachHelpSnapshot = coachHelp;
    const promptSnapshot = selectedPrompt;
    const promptPoolSnapshot = allPrompts.length > 0 ? allPrompts : prompts;

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

        if (coachHelpSnapshot && promptSnapshot && coachHelpSnapshot.expressions.length > 0) {
          setIsCheckingCoachUsage(true);
          void (async () => {
            try {
              const usageRequest = {
                promptId: selectedPromptId,
                answer: nextAnswer.trim(),
                sessionId: result.sessionId,
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
                  nextAnswer.trim(),
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
    meta,
    action
  }: {
    stepNumber: number;
    title: string;
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
        </div>
        {action ? <div className={styles.stageHeaderAction}>{action}</div> : null}
      </div>
    );
  }

  function openMonthStatus() {
    setMonthView(currentMonthView);
    setShowMonthStatus(true);
  }

  function moveMonth(delta: number) {
    setMonthView((current) => addMonthsToView(current ?? currentMonthView, delta));
  }

  function renderPickStep() {
    if (pickFlowScreen === "difficulty") {
      return (
        <section className={styles.pickFlow}>
          <article className={styles.welcomeCard}>
            <h1>{currentUser ? `${currentUser.displayName}님, 반가워요.` : "오늘의 질문에 답해보세요."}</h1>
            {currentUser ? (
                <button
                  type="button"
                  className={`${styles.welcomeStreakCard} ${styles.welcomeStreakCardInteractive}`}
                  aria-label="이번 달 학습 기록 열기"
                  aria-haspopup="dialog"
                  aria-expanded={showMonthStatus}
                  onClick={openMonthStatus}
                >
                <div className={styles.welcomeStreakHeader}>
                  <div className={styles.welcomeStreakIcon} aria-hidden="true">
                    <span className={styles.welcomeStreakIconCore} />
                  </div>
                  <div className={styles.welcomeStreakCopy}>
                    <strong>연속 학습 {todayStatus?.streakDays ?? 0}일</strong>
                    <span>{welcomeStreakMessage}</span>
                  </div>
                </div>
                <div className={styles.welcomeStreakWeek}>
                  {welcomeWeekDays.map((day) => (
                    <div
                      key={day.key}
                      className={`${styles.welcomeStreakDay} ${
                        day.isCompleted ? styles.welcomeStreakDayCompleted : ""
                      } ${day.isToday ? styles.welcomeStreakDayToday : ""}`}
                    >
                      <span className={styles.welcomeStreakDayLabel}>{day.label}</span>
                      <span className={styles.welcomeStreakDayDot} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </button>
            ) : (
              <p>
                어느 정도 난이도로 시작할지 먼저 골라볼까요? 원하는 난이도를 고른 뒤 확인 버튼을 누르면
                질문 고르기로 넘어갑니다.
              </p>
            )}
          </article>

          <section className={styles.pickStage}>
            {renderStageHeader({
              stepNumber: 1,
              title: "난이도 선택"
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
          meta: getDifficultyLabel(selectedDifficulty),
          action: (
            <div className={styles.stageHeaderButtonGroup}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={handleRefreshPromptList}
                disabled={isLoadingPrompts || isRefreshingQuestion || prompts.length === 0}
              >
                {isRefreshingQuestion ? "불러오는 중..." : "새 질문"}
              </button>
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
            </div>
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

  function renderWritingComposer({
    value,
    onChange,
    placeholder,
    wordCount
  }: {
    value: string;
    onChange: (nextValue: string) => void;
    placeholder: string;
    wordCount: number;
  }) {
    return (
      <section className={styles.writingComposer}>
        <div className={styles.writingComposerQuestion}>
          <div className={styles.writingComposerHeader}>
            <span className={styles.writingComposerBadge}>{selectedPrompt?.topic ?? "오늘의 질문"}</span>
            <div className={styles.writingComposerHeaderActions}>
              <button
                type="button"
                className={`${styles.promptTranslationButton} ${styles.writingComposerToggle}`}
                onClick={() => setShowAnswerTranslation((current) => !current)}
              >
                {showAnswerTranslation ? "번역 숨기기" : "번역 보기"}
              </button>
              <button
                type="button"
                className={styles.writingComposerHelpButton}
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
                작성 가이드
              </button>
            </div>
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
          <span className={styles.composerWordCount}>{wordCount}단어</span>
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
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderCompletionNextStepPanel() {
    if (!feedback?.loopComplete) {
      return null;
    }

    if (usedExpressions.length === 0 && completionNextExpressions.length === 0 && completionRelatedPrompts.length === 0) {
      return null;
    }

    const showUsedExpressions = usedExpressions.length > 0;
    const showNextExpressions = completionNextExpressions.length > 0;

    return (
      <section className={styles.coachUsagePanel}>
        <div
          className={`${styles.coachUsageGrid} ${
            showUsedExpressions !== showNextExpressions ? styles.coachUsageGridSingle : ""
          }`}
        >
          {showUsedExpressions ? (
            <div className={styles.coachUsageColumn}>
              <strong>잘 사용한 표현</strong>
              <div className={styles.coachUsageCards}>
                {usedExpressions.map((expression) => {
                  const matchedText =
                    expression.matchedText &&
                    expression.matchedText.trim() !== "" &&
                    expression.matchedText.trim() !== expression.expression.trim()
                      ? expression.matchedText
                      : null;

                  return (
                    <article key={expression.key} className={styles.coachUsageCardUsed}>
                      <div className={styles.coachUsageCardHeader}>
                        <span>{expression.expression}</span>
                      </div>
                      {matchedText ? <p>{matchedText}</p> : null}
                      <small>{expression.usageTip}</small>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showNextExpressions ? (
            <div className={styles.coachUsageColumn}>
              <strong>다음에 써볼 표현</strong>
              <div className={styles.coachUsageCards}>
                {completionNextExpressions.map((expression) => (
                  <article key={expression.key} className={styles.coachUsageCardUnused}>
                    <span className={styles.expressionText}>{renderLocalizedExpression(expression.expression)}</span>
                    {expression.primaryText ? <p>{renderLocalizedExpression(expression.primaryText)}</p> : null}
                    {expression.secondaryText ? (
                      <small className={styles.coachUsageCardSecondary}>{expression.secondaryText}</small>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {completionRelatedPrompts.length > 0 ? (
          <div className={styles.coachRelatedSection}>
            <strong>이 표현을 더 써볼 질문</strong>
            <div className={styles.coachRelatedList}>
              {completionRelatedPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className={styles.coachRelatedCard}
                  onClick={() => void handlePickPrompt(prompt.id)}
                >
                  <span>{getDifficultyLabel(prompt.difficulty)}</span>
                  <strong>{prompt.topic}</strong>
                  <p>{prompt.questionEn}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function handleStartRewriteFromGuide() {
    const starter = feedback?.ui?.rewritePractice?.starter?.trim();
    if (starter) {
      setRewrite(starter);
    } else {
      setRewrite(lastSubmittedAnswer);
    }
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setStep("rewrite");
  }

  function handleRewriteFromCurrentAnswer() {
    setRewrite(lastSubmittedAnswer);
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setStep("rewrite");
  }

  function handleCancelSubmittedAnswer() {
    setAnswer(lastSubmittedAnswer);
    setShowRewriteFeedback(false);
    setShowPreviousRewriteAnswer(false);
    setStep("answer");
  }

  function resolveScreenPolicy(): FeedbackScreenPolicy | null {
    if (!feedback) {
      return null;
    }

    return (
      feedback.ui?.screenPolicy ?? {
        completionState: feedback.loopComplete ? "CAN_FINISH" : "NEEDS_REVISION",
        sectionOrder: [
          "QUESTION_ANSWER",
          "TOP_STATUS",
          "KEEP_WHAT_WORKS",
          "FIX_FIRST",
          "REWRITE_GUIDE",
          "MODEL_ANSWER",
          "REFINEMENT",
          "CTA"
        ],
        keepWhatWorksDisplayMode:
          feedback.strengths.length > 0 || usedExpressions.length > 0 ? "SHOW_EXPANDED" : "HIDE",
        fixFirstDisplayMode:
          feedback.grammarFeedback?.length || feedback.corrections?.length ? "SHOW_EXPANDED" : "HIDE",
        rewriteGuideDisplayMode: "SHOW_EXPANDED",
        rewriteGuideMode: feedback.loopComplete ? "OPTIONAL_POLISH" : "DETAIL_SCAFFOLD",
        modelAnswerDisplayMode: feedback.modelAnswer?.trim()
          ? feedback.loopComplete
            ? "SHOW_COLLAPSED"
            : "SHOW_EXPANDED"
          : "HIDE",
        refinementDisplayMode:
          feedback.refinementExpressions && feedback.refinementExpressions.length > 0
            ? "SHOW_COLLAPSED"
            : "HIDE",
        keepWhatWorksMaxItems: 1,
        keepExpressionChipMaxItems: 2,
        refinementMaxCards: 2,
        showFinishCta: Boolean(feedback.loopComplete),
        showRewriteCta: true,
        showCancelCta: true
      }
    );
  }

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
        rewriteCtaLabel: feedback.loopComplete ? "다시 써보기" : "다시 써보기",
        finishCtaLabel: feedback.loopComplete ? "오늘 루프 완료하고 도장 받기" : null,
        cancelCtaLabel: "답변 취소"
      }
    );
  }

  function resolveSecondaryLearningPoints(): FeedbackSecondaryLearningPoint[] {
    if (!feedback) {
      return [];
    }

    const uiPoints =
      feedback.ui?.secondaryLearningPoints?.filter((point) => {
        if (!point) {
          return false;
        }
        return Boolean(
          point.headline?.trim() ||
            point.originalText?.trim() ||
            point.revisedText?.trim() ||
            point.exampleEn?.trim()
        );
      }) ?? [];
    if (uiPoints.length > 0) {
      return uiPoints;
    }

    const fallback: FeedbackSecondaryLearningPoint[] = [];
    const microTip = feedback.ui?.microTip;
    if (microTip?.originalText?.trim() && microTip.revisedText?.trim() && microTip.reasonKo?.trim()) {
      fallback.push({
        kind: "GRAMMAR",
        title: microTip.title || "작은 표현 다듬기",
        originalText: microTip.originalText,
        revisedText: microTip.revisedText,
        supportText: microTip.reasonKo
      });
    }

    feedback.corrections?.forEach((correction) => {
      if (!correction?.issue?.trim() || !correction.suggestion?.trim()) {
        return;
      }
      fallback.push({
        kind: "CORRECTION",
        title: "보조 학습 포인트",
        headline: correction.issue,
        supportText: correction.suggestion
      });
    });

    filterSuggestedRefinementExpressions(
      feedback.refinementExpressions,
      lastSubmittedAnswer,
      feedback.correctedAnswer
    )
      .filter((expression) => expression.displayable !== false)
      .forEach((expression) => {
        if (!expression.expression?.trim()) {
          return;
        }
        fallback.push({
          kind: "EXPRESSION",
          title: "써보면 좋은 표현",
          headline: expression.expression,
          meaningKo: expression.meaningKo,
          guidanceKo: expression.guidanceKo,
          exampleEn: expression.exampleEn,
          exampleKo: expression.exampleKo
        });
      });

    return fallback;
  }

  function resolveFixPoints(): FeedbackSecondaryLearningPoint[] {
    if (!feedback) {
      return [];
    }

    return (
      feedback.ui?.fixPoints?.filter((point) => {
        if (!point || point.kind === "EXPRESSION") {
          return false;
        }
        return Boolean(
          point.headline?.trim() ||
            point.originalText?.trim() ||
            point.revisedText?.trim() ||
            point.supportText?.trim()
        );
      }) ?? []
    );
  }

  function resolveLearningPointLabel(point: FeedbackSecondaryLearningPoint) {
    const title = trimNullable(point.title);
    if (!title || isGenericLearningPointTitle(title)) {
      return null;
    }
    return title;
  }

  function resolveLearningPointLead(point: FeedbackSecondaryLearningPoint) {
    const headline = trimNullable(point.headline);
    const exampleEn = trimNullable(point.exampleEn);
    if (looksLikeEnglishText(headline)) {
      return headline;
    }
    if (looksLikeEnglishText(exampleEn)) {
      return exampleEn;
    }
    return pickFirstNonEmpty(headline, point.revisedText, point.originalText, exampleEn);
  }

  function resolveLearningPointMeaning(
    point: FeedbackSecondaryLearningPoint,
    lead: string | null
  ) {
    const headline = trimNullable(point.headline);
    const meaningKo = trimNullable(point.meaningKo);
    const exampleKo = trimNullable(point.exampleKo);
    if (meaningKo) {
      if (looksLikeEnglishSentence(lead) && exampleKo) {
        return null;
      }
      return meaningKo;
    }
    if (headline && headline !== lead && !looksLikeEnglishText(headline)) {
      return headline;
    }
    return null;
  }

  function resolveLearningPointExampleEn(
    point: FeedbackSecondaryLearningPoint,
    lead: string | null
  ) {
    const exampleEn = trimNullable(point.exampleEn);
    if (!exampleEn || exampleEn === lead) {
      return null;
    }
    return exampleEn;
  }

  function resolveLearningPointGuidance(point: FeedbackSecondaryLearningPoint) {
    return trimNullable(point.guidanceKo);
  }

  function resolveLearningPointSupport(point: FeedbackSecondaryLearningPoint) {
    return trimNullable(point.supportText);
  }

  function isLearningPointLeadFromExample(
    point: FeedbackSecondaryLearningPoint,
    lead: string | null
  ) {
    const headline = trimNullable(point.headline);
    const exampleEn = trimNullable(point.exampleEn);
    return Boolean(
      lead &&
        exampleEn &&
        lead === exampleEn &&
        !looksLikeEnglishText(headline) &&
        looksLikeEnglishText(exampleEn)
    );
  }

  function resolveRewritePracticeSuggestions(starter?: string | null): RewriteSuggestion[] {
    const uiRewriteSuggestions = feedback?.ui?.rewriteSuggestions;
    if (uiRewriteSuggestions) {
      const suggestions: RewriteSuggestion[] = [];
      const seen = new Set<string>();

      uiRewriteSuggestions.forEach((suggestion, index) => {
        const english = stripRewriteSuggestionTerminalPunctuation(suggestion?.english ?? "");
        if (!english || !canSuggestionFillRewriteStarter(english, starter)) {
          return;
        }
        const dedupeKey = `ui-${english.toLowerCase()}`;
        if (seen.has(dedupeKey)) {
          return;
        }
        seen.add(dedupeKey);
        suggestions.push({
          key: `ui-${english}-${index}`,
          english,
          korean: trimNullable(suggestion?.meaningKo),
          note: trimNullable(suggestion?.noteKo)
        });
      });

      return suggestions.slice(0, 3);
    }

    const seen = new Set<string>();
    const suggestions: RewriteSuggestion[] = [];

    [...resolveSecondaryLearningPoints()]
      .filter((point) => point.kind === "EXPRESSION")
      .sort((left, right) => {
        const leftPriority = left.kind === "EXPRESSION" ? 0 : 1;
        const rightPriority = right.kind === "EXPRESSION" ? 0 : 1;
        return leftPriority - rightPriority;
      })
      .forEach((point, index) => {
        const lead = resolveLearningPointLead(point);
        if (!lead || !looksLikeEnglishText(lead)) {
          return;
        }
        const normalizedLead = stripRewriteSuggestionTerminalPunctuation(lead);
        if (!canSuggestionFillRewriteStarter(normalizedLead, starter)) {
          return;
        }
        const korean = resolveLearningPointMeaning(point, lead) ?? trimNullable(point.exampleKo);
        const note = pickFirstNonEmpty(resolveLearningPointGuidance(point), resolveLearningPointSupport(point));
        const key = `${point.kind}-${normalizedLead}-${index}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        suggestions.push({
          key,
          english: normalizedLead,
          korean,
          note
        });
      });

    return suggestions.slice(0, 3);
  }

  function renderLearningPointTextCard(
    point: FeedbackSecondaryLearningPoint,
    index: number
  ) {
    const label = resolveLearningPointLabel(point);
    const lead = resolveLearningPointLead(point);
    const leadFromExample = isLearningPointLeadFromExample(point, lead);
    const meaning = resolveLearningPointMeaning(point, lead);
    const exampleEn = leadFromExample ? lead : resolveLearningPointExampleEn(point, lead);
    const exampleKo = trimNullable(point.exampleKo);
    const guidance = resolveLearningPointGuidance(point);
    const support = resolveLearningPointSupport(point);

    return (
      <article
        key={`${point.kind}-${point.headline ?? point.exampleEn ?? point.originalText ?? index}`}
        className={styles.secondaryLearningCard}
      >
        {label ? <span className={styles.secondaryLearningLabel}>{label}</span> : null}
        {lead && !leadFromExample ? (
          <strong className={styles.secondaryLearningHeadline}>
            {renderLocalizedExpression(lead)}
          </strong>
        ) : null}
        {meaning ? (
          <span className={styles.refinementMeaningText}>{renderLocalizedExpression(meaning)}</span>
        ) : null}
        {guidance ? <span className={styles.refinementGuidanceText}>{guidance}</span> : null}
        {support ? <p className={styles.secondaryLearningSupport}>{support}</p> : null}
        {exampleEn ? <span className={styles.refinementExpressionExample}>{exampleEn}</span> : null}
        {exampleKo ? (
          <span className={styles.refinementExpressionExampleTranslation}>
            {renderLocalizedExpression(exampleKo)}
          </span>
        ) : null}
      </article>
    );
  }

  function isDisplayVisible(mode: string | null | undefined) {
    return mode !== "HIDE";
  }

  function isCollapsedDisplay(mode: string | null | undefined) {
    return mode === "SHOW_COLLAPSED";
  }

  function renderKeepSection() {
    if (!feedback) {
      return null;
    }

    const screenPolicy = resolveScreenPolicy();
    if (!isDisplayVisible(screenPolicy?.keepWhatWorksDisplayMode)) {
      return null;
    }

    const keepStrengths = feedback.strengths.slice(0, screenPolicy?.keepWhatWorksMaxItems ?? 1);
    const expressionChips = usedExpressions.slice(0, screenPolicy?.keepExpressionChipMaxItems ?? 2);
    if (keepStrengths.length === 0 && expressionChips.length === 0) {
      return null;
    }

    return (
      <section className={styles.feedbackBlock}>
        <h3>유지할 점</h3>
        {keepStrengths.length > 0 ? (
          <ul className={styles.list}>
            {keepStrengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        ) : null}
        {expressionChips.length > 0 ? (
          <div className={styles.feedbackChipSection}>
            <span className={styles.feedbackChipLabel}>잘 쓴 표현</span>
            <div className={styles.feedbackChipList}>
              {expressionChips.map((expression) => (
                <span key={expression.key} className={styles.feedbackChip}>
                  {expression.expression}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderFixPointCard(point: FeedbackSecondaryLearningPoint, index: number) {
    const label = resolveLearningPointLabel(point);
    const lead = resolveLearningPointLead(point);
    const meaning = resolveLearningPointMeaning(point, lead);
    const guidance = resolveLearningPointGuidance(point);
    const support = resolveLearningPointSupport(point);
    const exampleEn = resolveLearningPointExampleEn(point, lead);
    const exampleKo = trimNullable(point.exampleKo);
    const hasGrammarCard = Boolean(point.originalText?.trim()) && Boolean(point.revisedText?.trim());
    const showLead =
      Boolean(lead) &&
      lead !== trimNullable(point.originalText) &&
      lead !== trimNullable(point.revisedText) &&
      !isLearningPointLeadFromExample(point, lead);

    if (!hasGrammarCard) {
      return renderLearningPointTextCard(point, index);
    }

    return (
      <article
        key={`${point.kind}-${point.headline ?? point.originalText ?? point.exampleEn ?? index}`}
        className={styles.secondaryLearningCard}
      >
        {label ? <span className={styles.secondaryLearningLabel}>{label}</span> : null}
        {showLead && lead ? (
          <strong className={styles.secondaryLearningHeadline}>
            {renderLocalizedExpression(lead)}
          </strong>
        ) : null}
        {meaning ? (
          <span className={styles.refinementMeaningText}>{renderLocalizedExpression(meaning)}</span>
        ) : null}
        <div className={`${styles.primaryFixCard} ${styles.primaryFixCardCompact}`}>
          <div className={styles.primaryFixRow}>
            <span className={styles.primaryFixLabel}>원문</span>
            <p className={styles.primaryFixDiffText}>
              {renderPrimaryFixDiff(point.originalText, point.revisedText, "original")}
            </p>
          </div>
          <div className={styles.primaryFixRow}>
            <span className={styles.primaryFixLabel}>수정문</span>
            <p className={styles.primaryFixDiffText}>
              {renderPrimaryFixDiff(point.originalText, point.revisedText, "revised")}
            </p>
          </div>
          {support ? (
            <div className={styles.primaryFixRow}>
              <span className={styles.primaryFixLabel}>이유</span>
              <p>{support}</p>
            </div>
          ) : null}
        </div>
        {guidance ? <span className={styles.refinementGuidanceText}>{guidance}</span> : null}
        {exampleEn ? <span className={styles.refinementExpressionExample}>{exampleEn}</span> : null}
        {exampleKo ? (
          <span className={styles.refinementExpressionExampleTranslation}>
            {renderLocalizedExpression(exampleKo)}
          </span>
        ) : null}
      </article>
    );
  }

  function renderPrimaryFixDiff(
    originalTextValue?: string | null,
    revisedTextValue?: string | null,
    mode: "original" | "revised" = "original"
  ) {
    const originalText = originalTextValue?.trim() ?? "";
    const revisedText = revisedTextValue?.trim() ?? "";

    if (originalText && revisedText && originalText !== revisedText) {
      const segments = buildInlineFeedbackSegments(
        originalText,
        revisedText,
        null
      );

      if (segments.length > 0) {
        return segments.map((segment, index) => renderPrimaryFixDiffSegment(segment, mode, index));
      }
    }

    return mode === "original" ? originalTextValue : revisedTextValue;
  }

  function renderPrimaryFixDiffSegment(
    segment: RenderedInlineFeedbackSegment,
    mode: "original" | "revised",
    index: number
  ) {
    switch (segment.kind) {
      case "equal":
        return <span key={`${mode}-equal-${index}`}>{segment.text}</span>;
      case "replace":
        return mode === "original" ? (
          <span key={`${mode}-replace-${index}`} className={styles.primaryFixRemoved}>
            {segment.removed}
          </span>
        ) : (
          <span key={`${mode}-replace-${index}`} className={styles.primaryFixAdded}>
            {segment.added}
          </span>
        );
      case "remove":
        return mode === "original" ? (
          <span key={`${mode}-remove-${index}`} className={styles.primaryFixRemoved}>
            {segment.text}
          </span>
        ) : null;
      case "add":
        return mode === "revised" ? (
          <span key={`${mode}-add-${index}`} className={styles.primaryFixAdded}>
            {segment.text}
          </span>
        ) : null;
      default:
        return null;
    }
  }

  function renderRewritePracticeSection() {
    const screenPolicy = resolveScreenPolicy();
    if (!isDisplayVisible(screenPolicy?.rewriteGuideDisplayMode)) {
      return null;
    }

    const rewritePractice = feedback?.ui?.rewritePractice ?? (feedback
      ? {
          title: feedback.loopComplete ? "원하면 한 번 더 다듬어 보세요" : "한번 더 써보기",
          starter: feedback.correctedAnswer?.trim() || lastSubmittedAnswer,
          instruction:
            feedback.rewriteChallenge?.trim() ||
            "이 문장을 시작점으로 삼아 다시 써 보세요.",
          ctaLabel: "이 문장으로 시작해서 다시 쓰기",
          optionalTone: Boolean(feedback.loopComplete)
        }
      : null);
    if (!rewritePractice) {
      return null;
    }

    const rewriteSuggestions = resolveRewritePracticeSuggestions(rewritePractice.starter);

    return (
      <section className={styles.feedbackBlock}>
        <h3>{rewritePractice.title}</h3>
        <div
          className={`${styles.rewriteStarterCard} ${
            rewritePractice.optionalTone ? styles.rewriteStarterCardOptional : ""
          }`}
        >
          <pre className={styles.rewriteStarterText}>{rewritePractice.starter}</pre>
          <p className={styles.rewriteStarterInstruction}>{rewritePractice.instruction}</p>
          {rewriteSuggestions.length > 0 ? (
            <div className={styles.rewriteSuggestionBlock}>
              <strong className={styles.rewriteSuggestionTitle}>
                이런 표현으로 이어 써볼 수 있어요
              </strong>
              <div className={styles.rewriteSuggestionList}>
                {rewriteSuggestions.map((suggestion) => (
                  <article key={suggestion.key} className={styles.rewriteSuggestionCard}>
                    <strong className={styles.rewriteSuggestionEnglish}>{suggestion.english}</strong>
                    {suggestion.korean ? (
                      <span className={styles.rewriteSuggestionKorean}>
                        {renderLocalizedExpression(suggestion.korean)}
                      </span>
                    ) : null}
                    {suggestion.note ? (
                      <span className={styles.rewriteSuggestionNote}>{suggestion.note}</span>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          <div className={styles.rewriteStarterActions}>
            <button
              type="button"
              className={styles.smallActionButton}
              onClick={handleStartRewriteFromGuide}
            >
              {rewritePractice.ctaLabel}
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderExampleAnswerSection() {
    const screenPolicy = resolveScreenPolicy();
    const modelAnswerMode = screenPolicy?.modelAnswerDisplayMode ?? "HIDE";
    if (!isDisplayVisible(modelAnswerMode)) {
      return null;
    }

    if (!feedback?.modelAnswer?.trim()) {
      return null;
    }

    const rewriteStarter = feedback.ui?.rewritePractice?.starter?.trim();
    if (rewriteStarter && rewriteStarter === feedback.modelAnswer.trim()) {
      return null;
    }

    const title = modelAnswerMode === "TASK_RESET_EXAMPLE" ? "질문에 맞는 예시 답변" : "예시 답변";
    if (isCollapsedDisplay(modelAnswerMode)) {
      return (
        <details className={`${styles.feedbackBlock} ${styles.expressionDrawer}`}>
          <summary className={styles.expressionDrawerSummary}>
            {screenPolicy?.completionState === "OPTIONAL_POLISH" ? "원하면 예시 답변 보기" : `${title} 보기`}
          </summary>
          <p className={styles.modelAnswerText}>{feedback.modelAnswer}</p>
          {feedback.modelAnswerKo ? (
            <p className={styles.modelAnswerTranslation}>해석: {feedback.modelAnswerKo}</p>
          ) : null}
        </details>
      );
    }

    return (
      <section className={styles.feedbackBlock}>
        <h3>{title}</h3>
        <p className={styles.modelAnswerText}>{feedback.modelAnswer}</p>
        {feedback.modelAnswerKo ? (
          <p className={styles.modelAnswerTranslation}>해석: {feedback.modelAnswerKo}</p>
        ) : null}
      </section>
    );
  }

  function renderFixPointsSection() {
    const screenPolicy = resolveScreenPolicy();
    if (!isDisplayVisible(screenPolicy?.fixFirstDisplayMode)) {
      return null;
    }

    const points = resolveFixPoints();
    if (points.length === 0) {
      return null;
    }

    return (
      <section className={`${styles.feedbackBlock} ${styles.secondaryLearningBlock}`}>
        <h3>고쳐볼 점</h3>
        <div className={styles.secondaryLearningList}>
          {points.map((point, index) => renderFixPointCard(point, index))}
        </div>
      </section>
    );
  }

  function renderExpressionLearningSection() {
    const points = resolveSecondaryLearningPoints().filter((point) => point.kind === "EXPRESSION");
    if (points.length === 0) {
      return null;
    }

    return (
      <section className={`${styles.feedbackBlock} ${styles.secondaryLearningBlock}`}>
        <h3>써보면 좋은 표현</h3>
        <div className={styles.secondaryLearningList}>
          {points.map((point, index) => renderLearningPointTextCard(point, index))}
        </div>
      </section>
    );
  }

  function renderFeedbackGroup(children: ReactNode) {
    return (
      <section className={styles.feedbackGroup}>
        <div className={styles.feedbackGroupBody}>{children}</div>
      </section>
    );
  }

  function renderFeedbackCoreSections() {
    return (
      <>
        {renderKeepSection()}
        {renderFixPointsSection()}
        {renderRewritePracticeSection()}
        {renderExampleAnswerSection()}
        {renderExpressionLearningSection()}
      </>
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
            <span className={styles.guideEyebrow}>작성 가이드</span>
            <strong id="writing-help-title">바로 참고하는 가이드</strong>
          </div>
          <div className={styles.helpSheetBody}>
            <section className={styles.helpSheetSection}>
              <strong className={styles.helpSheetSectionTitle}>가이드</strong>
              <div className={styles.helpSheetGuideList}>
                <div className={`${styles.writingGuideTipLine} ${styles.helpSheetGuideLine}`}>
                  <span className={styles.writingGuideStarterIcon} aria-hidden="true">
                    &gt;
                  </span>
                  <div className={styles.writingGuideTipCopy}>
                    <strong>첫 문장 스타터</strong>
                    <span className={styles.writingGuideStarterValue}>{answerGuide.starter}</span>
                  </div>
                </div>
                <div className={`${styles.writingGuideTipLine} ${styles.helpSheetGuideLine}`}>
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
                <div className={`${styles.writingGuideTipLine} ${styles.helpSheetGuideLine}`}>
                  <span className={styles.writingGuideTipIcon} aria-hidden="true">
                    !
                  </span>
                  <div className={styles.writingGuideTipCopy}>
                    <strong>{answerChecklistSummary}</strong>
                    <span>{answerProgressMessage}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.helpSheetSection}>
              {isLoadingHints ? (
                <p className={styles.helpSheetEmpty}>지금 단어·표현 힌트를 준비하고 있어요.</p>
              ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
                <div className={styles.helpSheetHintGroups}>
                  {vocabularyWordHintItems.length > 0 ? (
                    <div className={styles.hintGroup}>
                      <strong className={styles.hintGroupTitle}>활용 단어</strong>
                      <div className={styles.hintChipList}>
                        {vocabularyWordHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                      </div>
                    </div>
                  ) : null}
                  {vocabularyPhraseHintItems.length > 0 ? (
                    <div className={styles.hintGroup}>
                      <strong className={styles.hintGroupTitle}>활용 표현</strong>
                      <div className={styles.hintChipList}>
                        {vocabularyPhraseHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className={styles.helpSheetEmpty}>이 질문에는 준비된 단어·표현 힌트가 없어요.</p>
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
        <section className={styles.writingGuideHintSection}>
          {isLoadingHints ? (
            <p className={styles.writingGuideHintEmpty}>지금 단어·표현 힌트를 준비하고 있어요.</p>
          ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
            <div className={styles.writingGuideHintGroups}>
              {vocabularyWordHintItems.length > 0 ? (
                <div className={styles.hintGroup}>
                  <strong className={styles.hintGroupTitle}>활용 단어</strong>
                  <div className={styles.hintChipList}>
                    {vocabularyWordHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                  </div>
                </div>
              ) : null}
              {vocabularyPhraseHintItems.length > 0 ? (
                <div className={styles.hintGroup}>
                  <strong className={styles.hintGroupTitle}>활용 표현</strong>
                  <div className={styles.hintChipList}>
                    {vocabularyPhraseHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={styles.writingGuideHintEmpty}>이 질문에는 준비된 단어·표현 힌트가 없어요.</p>
          )}
        </section>
      </div>
    );
  }

  function renderAnswerStep() {
    return (
      <section className={styles.stage} style={mobileComposerBarStyle}>
        {renderStageHeader({
          stepNumber: 3,
          title: "첫 답변",
          meta: selectedPrompt ? getDifficultyLabel(selectedPrompt.difficulty) : "..."
        })}
        {renderWritingComposer({
          value: answer,
          onChange: setAnswer,
          placeholder: "여기에 영어로 첫 답변을 작성해 주세요.",
          wordCount: answerWordCount
        })}
        {!isMobileViewport && showHelpSheet ? renderWritingGuideSummary() : null}
        {draftStatusMessage ? <p className={styles.draftStatusText}>{draftStatusMessage}</p> : null}
        {renderMobileComposerBar({
          secondaryLabel: "질문 목록",
          onSecondary: () => setStep("pick"),
          primaryLabel: isSubmitting ? "피드백 생성 중..." : "답변 제출",
          onPrimary: () => handleSubmit(answer, "INITIAL"),
          primaryDisabled: isSubmitting || isLoadingPrompts
        })}
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
      </section>
    );
  }

  function renderFeedbackStep() {
    const screenPolicy = resolveScreenPolicy();
    const loopStatus = resolveLoopStatus();

    return (
      <section className={styles.stage}>
        {renderStageHeader({
          stepNumber: 4,
          title: "피드백",
          meta: feedback ? `${feedback.attemptNo}번째 시도 · ${feedbackLevel?.label ?? "대기 중"}` : "대기 중"
        })}
        {feedback ? (
          <div className={styles.feedbackBody}>
            {renderFeedbackGroup(
              <div className={styles.responseCard}>
                <div className={styles.responsePrompt}>
                  <span className={styles.responsePromptLabel}>질문</span>
                  <p>{selectedPrompt?.questionEn ?? "질문을 불러오는 중입니다."}</p>
                  {selectedPrompt?.questionKo ? (
                    <small className={styles.translationText}>{selectedPrompt.questionKo}</small>
                  ) : null}
                </div>
                <h3>내가 제출한 답변</h3>
                <p>{lastSubmittedAnswer}</p>
              </div>
            )}
            {renderFeedbackCoreSections()}
          </div>
        ) : (
          <p className={styles.placeholderText}>답변을 제출하면 여기에 피드백이 표시됩니다.</p>
        )}
        <div className={styles.stageFooter}>
          {feedback ? (
            <div className={styles.completionCallout}>
              {loopStatus?.badge ? (
                <span className={styles.completionCalloutBadge}>{loopStatus.badge}</span>
              ) : null}
              <strong>
                {loopStatus?.headline ??
                  feedback.completionMessage ??
                  feedbackLevel?.summary ??
                  "이 답변은 지금 단계에서 마무리해도 충분해요."}
              </strong>
              {loopStatus?.supportText ? <p>{loopStatus.supportText}</p> : null}
            </div>
          ) : null}
          <div className={styles.actionRow}>
            {(screenPolicy?.showRewriteCta ?? Boolean(feedback)) ? (
              <button
                type="button"
                className={shouldSuggestFinish ? styles.ghostButton : styles.primaryButton}
                onClick={handleRewriteFromCurrentAnswer}
                disabled={!feedback}
              >
                {loopStatus?.rewriteCtaLabel ?? "다시 써보기"}
              </button>
            ) : null}
            {(screenPolicy?.showCancelCta ?? Boolean(feedback)) ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={handleCancelSubmittedAnswer}
                disabled={!feedback}
              >
                {loopStatus?.cancelCtaLabel ?? "답변 취소"}
              </button>
            ) : null}
          </div>
          {(screenPolicy?.showFinishCta ?? shouldSuggestFinish) ? (
            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryButton} onClick={handleFinishLoop}>
                {loopStatus?.finishCtaLabel ?? "오늘 루프 완료하고 도장 받기"}
              </button>
            </div>
          ) : null}
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
          meta: sessionId ? "같은 질문 이어쓰기" : "다시쓰기"
        })}
        {renderWritingComposer({
          value: rewrite,
          onChange: setRewrite,
          placeholder: "피드백을 반영한 영어 답변을 다시 작성해 주세요.",
          wordCount: rewriteWordCount
        })}
        {!isMobileViewport && showHelpSheet ? renderWritingGuideSummary() : null}
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
                <p>직전 답변에서 받은 피드백을 같은 구조로 다시 보면서 문장을 다듬어 보세요.</p>
              </div>
              <button
                type="button"
                className={styles.rewriteFeedbackToggle}
                onClick={() => setShowRewriteFeedback((current) => !current)}
            >
              {showRewriteFeedback ? "피드백 숨기기" : "피드백 보기"}
            </button>
          </div>
            {showRewriteFeedback ? <div className={styles.rewriteFeedbackBody}>{renderFeedbackCoreSections()}</div> : null}
          </section>
        ) : null}
        {draftStatusMessage ? <p className={styles.draftStatusText}>{draftStatusMessage}</p> : null}
        {renderMobileComposerBar({
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
        {renderCompletionNextStepPanel()}
        <div className={styles.completeActions}>
          {completionRelatedPrompts.length > 0 ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handlePickPrompt(completionRelatedPrompts[0].id)}
              disabled={isLoadingPrompts}
            >
              추천 질문에 이어서 답변하기
            </button>
          ) : null}
          <button
            type="button"
            className={completionRelatedPrompts.length > 0 ? styles.ghostButton : styles.primaryButton}
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
      {step !== "pick" ? renderStepNavigation() : null}

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
            <div className={styles.loginWallCopy}>
              <div className={styles.loginBadge}>게스트 체험 한도 도달</div>
              <h2 id="guest-limit-title">로그인하면 지금 쓰던 흐름을 그대로 이어갈 수 있어요.</h2>
              <p>
                게스트는 한 번의 질문 루프만 체험할 수 있어요. 로그인하면 여러 질문을 계속 풀고, 내 답변
                히스토리와 피드백도 한곳에서 확인할 수 있습니다.
              </p>
              <p className={styles.loginWallHint}>작성 중이던 내용은 이어서 복원할 수 있게 저장해둘게요.</p>
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
        </div>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {step === "pick" && renderPickStep()}
      {step === "answer" && renderAnswerStep()}
      {step === "feedback" && renderFeedbackStep()}
      {step === "rewrite" && renderRewriteStep()}
      {step === "complete" && renderCompleteStep()}
      {renderHelpSheet()}
      {renderCoachAssistantModal()}
      {renderMonthStatusModal()}
    </main>
  );
}
