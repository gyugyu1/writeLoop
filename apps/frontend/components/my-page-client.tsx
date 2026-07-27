"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAccount,
  deleteSavedExpression,
  getAnswerHistory,
  getCurrentUser,
  getSavedExpressions,
  getTodayWritingStatus,
  logout,
  updateProfile
} from "../lib/api";
import { clearHomeDraftForLogin } from "../lib/auth-flow";
import { getDifficultyLabel, normalizeDailyDifficulty } from "../lib/difficulty";
import { clearAllLocalWritingDrafts } from "../lib/home-writing-drafts";
import { clearAllIncompleteLoops, saveIncompleteLoop } from "../lib/incomplete-loop";
import type {
  AuthUser,
  DailyDifficulty,
  Feedback,
  HistorySession,
  SavedExpression,
  TodayWritingStatus
} from "../lib/types";
import styles from "./auth-page.module.css";

type MyPageTab = "account" | "writing";
type WritingContentTab = "history" | "expressions";
const TAG_PRACTICE_EXPRESSION_LIMIT = 5;

function formatHistoryDateKey(dateTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date(dateTime));
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatHistoryTime(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

function getLoginMethodLabel(user: AuthUser) {
  switch (user.socialProvider) {
    case "NAVER":
      return "네이버";
    case "GOOGLE":
      return "구글";
    case "KAKAO":
      return "카카오";
    default:
      return user.email;
  }
}

function getAccountEmailLabel(user: AuthUser) {
  if (!user.socialProvider) {
    return user.email;
  }

  switch (user.socialProvider) {
    case "NAVER":
      return "네이버 이메일";
    case "GOOGLE":
      return "구글 이메일";
    case "KAKAO":
      return "카카오 이메일";
    default:
      return "소셜 로그인 이메일";
  }
}

function formatHistoryDateHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${dateKey}T00:00:00+09:00`));

  return `${year}년 ${month}월 ${day}일 ${weekday}`;
}

function getLatestAttempt(session: HistorySession) {
  return session.attempts[session.attempts.length - 1];
}

function buildHistoryFeedback(session: HistorySession): Feedback | null {
  const attempt = getLatestAttempt(session);
  if (!attempt?.visibleFeedback) {
    return null;
  }

  const visibleFeedback = attempt.visibleFeedback;
  const readyToFinish = visibleFeedback.state === "READY_TO_FINISH";
  return {
    promptId: session.promptId,
    sessionId: session.sessionId,
    attemptNo: attempt.attemptNo,
    loopComplete: readyToFinish,
    completionMessage: visibleFeedback.completion?.headline ?? null,
    summary: attempt.feedbackSummary ?? "",
    strengths: visibleFeedback.strength ? [visibleFeedback.strength] : [],
    inlineFeedback: null,
    revisedAnswer: null,
    refinementExpressions: visibleFeedback.refinementExpressions ?? [],
    modelAnswer: visibleFeedback.modelAnswer ?? "",
    modelAnswerKo: visibleFeedback.modelAnswerKo ?? null,
    rewriteChallenge:
      visibleFeedback.coachMove?.instruction ?? visibleFeedback.coachMove?.focus ?? "",
    coachMove: visibleFeedback.coachMove ?? null,
    completion: visibleFeedback.completion ?? null,
    visibleFeedback,
    loop: {
      status: visibleFeedback.state,
      nextAction: readyToFinish ? "finish" : "rewrite",
      nextActionLabel: readyToFinish ? "루프 완료하기" : "다시 써보기"
    }
  };
}

function getAttemptLabel(value?: string | null) {
  return value === "REWRITE" ? "다시쓰기" : "첫 답변";
}

function getSavedExpressionSourceLabel(sourceType: SavedExpression["sourceType"]) {
  switch (sourceType) {
    case "USED_EXPRESSION":
      return "내가 쓴 표현";
    case "COACH_RECOMMENDATION":
      return "AI 코치 추천";
    default:
      return "저장한 표현";
  }
}

function normalizeSavedExpressionTag(tag?: string | null) {
  return tag?.trim().toLowerCase() ?? "";
}

function normalizeSavedExpressionTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(tags.map((tag) => normalizeSavedExpressionTag(tag)).filter(Boolean))
  );
}

function getSavedExpressionSourceTag(sourceType: SavedExpression["sourceType"]) {
  switch (sourceType) {
    case "USED_EXPRESSION":
      return "used_expression";
    case "COACH_RECOMMENDATION":
      return "coach_recommendation";
    case "REFINEMENT_EXPRESSION":
      return "refinement_expression";
    default:
      return null;
  }
}

const SAVED_EXPRESSION_TAG_LABELS: Record<string, string> = {
  used_expression: "내가 쓴 표현",
  refinement_expression: "표현 더하기",
  coach_recommendation: "AI 코치 추천",
  verb_phrase: "동사 표현",
  noun_phrase: "명사 표현",
  adjective_phrase: "형용사 표현",
  sentence_starter: "첫 문장 스타터",
  frequency_expression: "빈도 표현",
  time_expression: "시간 표현",
  place_expression: "장소 표현",
  reason_expression: "이유 표현",
  example_expression: "예시 표현",
  opinion_expression: "의견 표현",
  comparison_expression: "비교 표현",
  feeling_expression: "감정 표현",
  daily_routine: "일상 루틴",
  home: "집",
  school: "학교",
  work: "일",
  study: "공부",
  meal: "식사",
  exercise: "운동",
  hobby: "취미",
  travel: "여행",
  shopping: "쇼핑",
  sleep: "수면",
  health: "건강",
  relationship: "관계",
  technology: "기술",
  present_habit: "현재 습관",
  past_experience: "과거 경험",
  future_plan: "미래 계획"
};

function formatSavedExpressionTagLabel(tag: string) {
  const normalizedTag = tag.trim().toLowerCase();
  return SAVED_EXPRESSION_TAG_LABELS[normalizedTag] ?? tag.trim().replace(/[_-]+/g, " ");
}

function getVisibleSavedExpressionTags(savedExpression: SavedExpression) {
  const sourceTag = getSavedExpressionSourceTag(savedExpression.sourceType);
  return normalizeSavedExpressionTags(savedExpression.tags).filter((tag) => tag !== sourceTag);
}

function normalizeSavedExpressionSearchValue(value?: string | null) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function normalizeSavedExpressionTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const TAG_PRACTICE_TRAILING_WEAK_TOKENS = new Set([
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

function isEligibleTagPracticeExpression(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const tokens = normalized.toLowerCase().split(" ");
  return !TAG_PRACTICE_TRAILING_WEAK_TOKENS.has(tokens[tokens.length - 1]);
}

function buildSavedExpressionSearchText(savedExpression: SavedExpression) {
  const visibleTags = getVisibleSavedExpressionTags(savedExpression);
  const sourceTag = getSavedExpressionSourceTag(savedExpression.sourceType);

  return [
    savedExpression.expression,
    savedExpression.meaningKo,
    savedExpression.exampleEn,
    savedExpression.promptQuestionEn,
    savedExpression.promptQuestionKo,
    savedExpression.promptTopic,
    sourceTag,
    getSavedExpressionSourceLabel(savedExpression.sourceType),
    ...visibleTags,
    ...visibleTags.map((tag) => formatSavedExpressionTagLabel(tag))
  ]
    .map((value) => normalizeSavedExpressionSearchValue(value))
    .filter(Boolean)
    .join(" ");
}

function collectTagPracticeExpressions(
  tag: string,
  anchorExpression: SavedExpression,
  savedExpressions: SavedExpression[]
) {
  const normalizedTag = normalizeSavedExpressionTag(tag);
  const anchorPromptId = trimSavedExpressionLookupValue(anchorExpression.promptId);
  const uniqueExpressions = new Set<string>();
  const collectedExpressions: string[] = [];
  const prioritizedExpressions = [
    anchorExpression,
    ...savedExpressions.filter(
      (item) =>
        item.id !== anchorExpression.id &&
        getVisibleSavedExpressionTags(item).includes(normalizedTag) &&
        trimSavedExpressionLookupValue(item.promptId) === anchorPromptId
    ),
    ...savedExpressions.filter(
      (item) =>
        item.id !== anchorExpression.id &&
        getVisibleSavedExpressionTags(item).includes(normalizedTag) &&
        trimSavedExpressionLookupValue(item.promptId) !== anchorPromptId
    )
  ];

  for (const item of prioritizedExpressions) {
    const expression = item.expression.trim();
    const normalizedExpression = normalizeSavedExpressionTextKey(expression);
    if (
      !expression ||
      uniqueExpressions.has(normalizedExpression) ||
      !isEligibleTagPracticeExpression(expression)
    ) {
      continue;
    }

    uniqueExpressions.add(normalizedExpression);
    collectedExpressions.push(expression);

    if (collectedExpressions.length >= TAG_PRACTICE_EXPRESSION_LIMIT) {
      break;
    }
  }

  return collectedExpressions;
}

function formatSavedExpressionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderSavedExpressionExample(exampleEn?: string | null, expression?: string | null) {
  const trimmedExample = exampleEn?.trim() ?? "";
  const trimmedExpression = expression?.trim() ?? "";

  if (!trimmedExample) {
    return null;
  }

  if (!trimmedExpression) {
    return trimmedExample;
  }

  const expressionPattern = new RegExp(`(${escapeRegExp(trimmedExpression)})`, "gi");
  if (!expressionPattern.test(trimmedExample)) {
    return trimmedExample;
  }

  const segments = trimmedExample.split(expressionPattern);

  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      <mark key={`saved-expression-example-match-${index}`} className={styles.savedExpressionExampleHighlight}>
        {segment}
      </mark>
    ) : (
      <span key={`saved-expression-example-${index}`}>{segment}</span>
    )
  );
}

function getSavedExpressionPromptText(savedExpression: SavedExpression) {
  return (
    savedExpression.promptQuestionEn?.trim() ||
    savedExpression.promptQuestionKo?.trim() ||
    savedExpression.promptTopic?.trim() ||
    ""
  );
}

function trimSavedExpressionLookupValue(value?: string | null) {
  return value?.trim() ?? "";
}

function isDailyDifficulty(value?: string | null): value is DailyDifficulty {
  return value === "I" || value === "A" || value === "B" || value === "C";
}

function resolveSavedExpressionPracticeTarget(
  savedExpression: SavedExpression,
  linkedSession?: HistorySession | null
) {
  const promptId =
    trimSavedExpressionLookupValue(savedExpression.promptId) ||
    trimSavedExpressionLookupValue(linkedSession?.promptId);
  const difficultyCandidate =
    trimSavedExpressionLookupValue(savedExpression.promptDifficulty) ||
    trimSavedExpressionLookupValue(linkedSession?.difficulty);
  const normalizedDifficulty = normalizeDailyDifficulty(difficultyCandidate, "I");

  if (!promptId || !isDailyDifficulty(normalizedDifficulty)) {
    return null;
  }

  return {
    promptId,
    difficulty: normalizedDifficulty
  };
}

function getLatestSessionTimestamp(session: HistorySession) {
  return session.attempts[session.attempts.length - 1]?.createdAt ?? session.updatedAt ?? session.createdAt;
}

function parseMyPageTab(): MyPageTab {
  if (typeof window === "undefined") {
    return "writing";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "account" ? "account" : "writing";
}

function parseHistoryDateParam() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const date = params.get("date") ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function notifyTabChange(tab: MyPageTab) {
  window.dispatchEvent(new CustomEvent("writeloop:tab-change", { detail: { tab } }));
}

export function MyPageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MyPageTab>("writing");
  const [activeWritingTab, setActiveWritingTab] = useState<WritingContentTab>("history");
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isSavedExpressionsLoading, setIsSavedExpressionsLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [savedExpressionError, setSavedExpressionError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [expandedLanguageCorrectionAttempts, setExpandedLanguageCorrectionAttempts] =
    useState<Record<number, boolean>>({});
  const [selectedHistoryDate, setSelectedHistoryDate] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isDeleteFormOpen, setIsDeleteFormOpen] = useState(false);
  const [deletingSavedExpressionId, setDeletingSavedExpressionId] = useState<number | null>(null);
  const [openSavedExpressionPrompts, setOpenSavedExpressionPrompts] = useState<Record<number, boolean>>({});
  const [savedExpressionSearchQuery, setSavedExpressionSearchQuery] = useState("");
  const [selectedSavedExpressionTag, setSelectedSavedExpressionTag] = useState<string | null>(null);
  const [selectedSavedExpressionTagAnchorId, setSelectedSavedExpressionTagAnchorId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);

  useEffect(() => {
    function syncTabFromUrl() {
      setActiveTab(parseMyPageTab());
      setSelectedHistoryDate(parseHistoryDateParam());
    }

    function handleTabChange(event: Event) {
      const detail = (event as CustomEvent<{ tab?: MyPageTab }>).detail;
      const nextTab = detail?.tab === "account" ? "account" : "writing";
      setActiveTab(nextTab);
      setSelectedHistoryDate(parseHistoryDateParam());
    }

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    window.addEventListener("writeloop:tab-change", handleTabChange);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
      window.removeEventListener("writeloop:tab-change", handleTabChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        setIsHistoryLoading(true);
        setIsSavedExpressionsLoading(true);
        const user = await getCurrentUser();
        if (!isMounted) {
          return;
        }

        setCurrentUser(user);

        if (!user) {
          setTodayStatus(null);
          setHistory([]);
          setSavedExpressions([]);
          setSavedExpressionSearchQuery("");
          setSelectedSavedExpressionTag(null);
          setSelectedSavedExpressionTagAnchorId(null);
          setHistoryError("");
          setSavedExpressionError("");
          setIsHistoryLoading(false);
          setIsSavedExpressionsLoading(false);
          return;
        }

        const [statusResult, sessionsResult, savedExpressionsResult] = await Promise.allSettled([
          getTodayWritingStatus(),
          getAnswerHistory(),
          getSavedExpressions()
        ]);

        if (!isMounted) {
          return;
        }

        if (statusResult.status === "fulfilled") {
          setTodayStatus(statusResult.value);
        } else {
          setTodayStatus(null);
        }

        if (sessionsResult.status === "fulfilled") {
          setHistory(sessionsResult.value);
          setHistoryError("");
        } else {
          setHistory([]);
          setHistoryError("작문 기록을 아직 불러오지 못했어요.");
        }
        setIsHistoryLoading(false);

        if (savedExpressionsResult.status === "fulfilled") {
          setSavedExpressions(savedExpressionsResult.value);
          setSavedExpressionError("");
        } else {
          setSavedExpressions([]);
          setSavedExpressionError("저장한 표현을 아직 불러오지 못했어요.");
        }
        setIsSavedExpressionsLoading(false);
      } catch {
        if (!isMounted) {
          return;
        }

        setCurrentUser(null);
        setTodayStatus(null);
        setHistory([]);
        setSavedExpressions([]);
        setSavedExpressionSearchQuery("");
        setSelectedSavedExpressionTag(null);
        setSelectedSavedExpressionTagAnchorId(null);
        setHistoryError("");
        setSavedExpressionError("");
        setIsHistoryLoading(false);
        setIsSavedExpressionsLoading(false);
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfileDisplayName("");
      return;
    }

    setProfileDisplayName(currentUser.displayName);
  }, [currentUser]);

  const historyByDate = useMemo(() => {
    return history.reduce<Record<string, HistorySession[]>>((accumulator, session) => {
      const dateKeys = new Set<string>([
        formatHistoryDateKey(session.createdAt),
        ...session.attempts.map((attempt) => formatHistoryDateKey(attempt.createdAt))
      ]);

      for (const dateKey of dateKeys) {
        if (!accumulator[dateKey]) {
          accumulator[dateKey] = [];
        }

        if (!accumulator[dateKey].some((existingSession) => existingSession.sessionId === session.sessionId)) {
          accumulator[dateKey].push(session);
        }
      }

      return accumulator;
    }, {});
  }, [history]);

  const historyDates = useMemo(
    () => Object.keys(historyByDate).sort((left, right) => right.localeCompare(left)),
    [historyByDate]
  );

  const groupedHistoryEntries = useMemo(
    () =>
      historyDates.map((dateKey) => ({
        dateKey,
        sessions: [...(historyByDate[dateKey] ?? [])].sort((left, right) =>
          getLatestSessionTimestamp(right).localeCompare(getLatestSessionTimestamp(left))
        )
      })),
    [historyByDate, historyDates]
  );

  const normalizedSavedExpressionSearch = useMemo(
    () => normalizeSavedExpressionSearchValue(savedExpressionSearchQuery),
    [savedExpressionSearchQuery]
  );

  const savedExpressionTagOptions = useMemo(() => {
    const counts = new Map<string, number>();

    savedExpressions.forEach((item) => {
      getVisibleSavedExpressionTags(item).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((left, right) => {
        const countCompare = right[1] - left[1];
        if (countCompare !== 0) {
          return countCompare;
        }

        return formatSavedExpressionTagLabel(left[0]).localeCompare(
          formatSavedExpressionTagLabel(right[0]),
          "ko"
        );
      })
      .map(([tag, count]) => ({
        tag,
        count,
        label: formatSavedExpressionTagLabel(tag)
      }));
  }, [savedExpressions]);

  const visibleSavedExpressions = useMemo(() => {
    const sortedByLatest = [...savedExpressions].sort((left, right) => {
      const timeCompare = right.lastSavedAt.localeCompare(left.lastSavedAt);
      if (timeCompare !== 0) {
        return timeCompare;
      }
      return right.id - left.id;
    });

    const filteredExpressions = normalizedSavedExpressionSearch
      ? sortedByLatest.filter((item) =>
          buildSavedExpressionSearchText(item).includes(normalizedSavedExpressionSearch)
        )
      : sortedByLatest;

    if (!selectedSavedExpressionTag) {
      return filteredExpressions;
    }

    return [...filteredExpressions].sort((left, right) => {
      const leftMatchesTag = getVisibleSavedExpressionTags(left).includes(selectedSavedExpressionTag);
      const rightMatchesTag = getVisibleSavedExpressionTags(right).includes(selectedSavedExpressionTag);

      if (leftMatchesTag !== rightMatchesTag) {
        return leftMatchesTag ? -1 : 1;
      }

      const timeCompare = right.lastSavedAt.localeCompare(left.lastSavedAt);
      if (timeCompare !== 0) {
        return timeCompare;
      }
      return right.id - left.id;
    });
  }, [normalizedSavedExpressionSearch, savedExpressions, selectedSavedExpressionTag]);

  const savedExpressionSectionMeta = useMemo(() => {
    if (!normalizedSavedExpressionSearch && !selectedSavedExpressionTag) {
      return `${savedExpressions.length}개의 표현`;
    }

    return `${visibleSavedExpressions.length}개 결과 · 전체 ${savedExpressions.length}개`;
  }, [
    normalizedSavedExpressionSearch,
    savedExpressions.length,
    selectedSavedExpressionTag,
    visibleSavedExpressions.length
  ]);

  const selectedSavedExpressionTagLabel = selectedSavedExpressionTag
    ? formatSavedExpressionTagLabel(selectedSavedExpressionTag)
    : "";

  useEffect(() => {
    if (historyDates.length === 0) {
      setOpenDates({});
      return;
    }

    setOpenDates((current) => {
      const next = { ...current };
      let changed = false;

      const defaultOpenDateKey = selectedHistoryDate && historyDates.includes(selectedHistoryDate)
        ? selectedHistoryDate
        : historyDates[0];

      for (const dateKey of historyDates) {
        const nextValue = current[dateKey] ?? dateKey === defaultOpenDateKey;
        if (current[dateKey] !== nextValue) {
          next[dateKey] = nextValue;
          changed = true;
        }
      }

      for (const existingKey of Object.keys(next)) {
        if (!historyDates.includes(existingKey)) {
          delete next[existingKey];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [historyDates, selectedHistoryDate]);

  useEffect(() => {
    const validSavedExpressionIds = new Set(savedExpressions.map((item) => String(item.id)));

    setOpenSavedExpressionPrompts((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([savedExpressionId]) => validSavedExpressionIds.has(savedExpressionId))
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [savedExpressions]);

  useEffect(() => {
    if (!selectedSavedExpressionTag) {
      setSelectedSavedExpressionTagAnchorId(null);
      return;
    }

    if (savedExpressionTagOptions.some((option) => option.tag === selectedSavedExpressionTag)) {
      return;
    }

    setSelectedSavedExpressionTag(null);
    setSelectedSavedExpressionTagAnchorId(null);
  }, [savedExpressionTagOptions, selectedSavedExpressionTag]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    if (!history.some((session) => session.sessionId === selectedSession.sessionId)) {
      setSelectedSession(null);
    }
  }, [history, selectedSession]);

  useEffect(() => {
    if (!selectedHistoryDate || !historyDates.includes(selectedHistoryDate)) {
      return;
    }

    setOpenDates((current) => {
      if (current[selectedHistoryDate]) {
        return current;
      }

      return {
        ...current,
        [selectedHistoryDate]: true
      };
    });

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-history-date="${selectedHistoryDate}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [historyDates, selectedHistoryDate]);

  function toggleDateGroup(dateKey: string) {
    setOpenDates((current) => ({
      ...current,
      [dateKey]: !current[dateKey]
    }));
  }

function renderWritingHistoryVisibleFeedback(attempt: HistorySession["attempts"][number]) {
  const snapshot = attempt.visibleFeedback;
  if (!snapshot) {
    return (
      <div className={styles.historyVisibleFeedbackNotice}>
        이전 형식의 기록이라 당시 노출된 피드백을 정확히 복원할 수 없어요.
      </div>
    );
  }

  const coachMove = snapshot.coachMove;
  const expressions = (snapshot.refinementExpressions ?? []).slice(0, 2);
  const allLanguageCorrections = coachMove?.languageCorrections ?? [];
  const areAllLanguageCorrectionsVisible =
    expandedLanguageCorrectionAttempts[attempt.id] ?? false;
  const languageCorrections = areAllLanguageCorrectionsVisible
    ? allLanguageCorrections
    : allLanguageCorrections.slice(0, 4);
  const hiddenLanguageCorrectionCount = Math.max(
    0,
    allLanguageCorrections.length - 4
  );
  const isLanguageFix = coachMove?.focusType?.trim().toUpperCase() === "LANGUAGE_FIX";
  const coachPhrases = (coachMove?.suggestedPhrases ?? [])
    .map((phrase) =>
      typeof phrase === "string"
        ? { phrase: phrase.trim(), meaningKo: "" }
        : {
            phrase: phrase?.phrase?.trim() ?? "",
            meaningKo: phrase?.meaningKo?.trim() ?? ""
          }
    )
    .filter((phrase) => phrase.phrase);

  return (
    <div className={styles.historyVisibleFeedbackStack}>
      {snapshot.strength ? (
        <section className={styles.historyVisibleStrength}>
          <span>잘한 점</span>
          <p>{snapshot.strength}</p>
        </section>
      ) : null}

      {snapshot.state === "NEEDS_REWRITE" && coachMove ? (
        <section className={styles.historyVisibleCoach}>
          <strong>{coachMove.focus?.trim() || "다음에 반영할 한 가지"}</strong>
          {coachMove.before?.trim() || coachMove.after?.trim() ? (
            <div className={styles.historyVisibleCoachSwap}>
              {coachMove.before?.trim() ? (
                <div>
                  <span>지금</span>
                  <p>{coachMove.before}</p>
                </div>
              ) : null}
              {coachMove.after?.trim() ? (
                <div>
                  <span>{isLanguageFix ? "이번에 고친 문장" : "적용"}</span>
                  <p>{coachMove.after}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {languageCorrections.length > 0 ? (
            <div className={styles.historyVisibleCorrectionList}>
              {languageCorrections.map((correction, index) => (
                <article key={`${correction.kind}-${correction.before ?? ""}-${index}`}>
                  <span>{correction.label}</span>
                  <strong>
                    {correction.before?.trim() ? `${correction.before} → ` : ""}
                    {correction.after}
                  </strong>
                  <p>{correction.reason}</p>
                </article>
              ))}
              {hiddenLanguageCorrectionCount > 0 ? (
                <button
                  type="button"
                  className={styles.historyVisibleCorrectionToggle}
                  aria-expanded={areAllLanguageCorrectionsVisible}
                  onClick={() =>
                    setExpandedLanguageCorrectionAttempts((current) => ({
                      ...current,
                      [attempt.id]: !areAllLanguageCorrectionsVisible
                    }))
                  }
                >
                  {areAllLanguageCorrectionsVisible
                    ? "추가 교정 접기"
                    : `교정 ${hiddenLanguageCorrectionCount}개 더 보기`}
                </button>
              ) : null}
            </div>
          ) : null}
          {coachMove.why?.trim() ? <p>{coachMove.why}</p> : null}
          {coachMove.instruction?.trim() ? (
            <div className={styles.historyVisibleInstruction}>
              <span>다시 쓸 때</span>
              <p>{coachMove.instruction}</p>
            </div>
          ) : null}
          {coachMove.skeletonEn?.trim() ? (
            <div className={styles.historyVisibleInstruction}>
              <span>문장 틀</span>
              <p>{coachMove.skeletonEn}</p>
              {coachMove.skeletonKo?.trim() ? <p>{coachMove.skeletonKo}</p> : null}
            </div>
          ) : null}
          {coachPhrases.length > 0 ? (
            <div className={styles.historyVisibleExpressionList}>
              {coachPhrases.map((phrase) => (
                <span key={phrase.phrase}>
                  <strong>{phrase.phrase}</strong>
                  {phrase.meaningKo ? <small>{phrase.meaningKo}</small> : null}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {snapshot.state === "READY_TO_FINISH" ? (
        <section className={styles.historyVisibleReady}>
          <span>완료할 준비가 됐어요</span>
          <strong>
            {snapshot.completion?.headline?.trim() ||
              snapshot.completion?.improvedPoint?.trim() ||
              "이 답변으로 루프를 마칠 수 있어요."}
          </strong>
          {expressions.length > 0 ? (
            <div className={styles.historyVisibleExpressionList}>
              {expressions.map((expression) => (
                <span key={expression.expression}>
                  <strong>{expression.expression}</strong>
                  {expression.meaningKo ? <small>{expression.meaningKo}</small> : null}
                </span>
              ))}
            </div>
          ) : null}
          {snapshot.modelAnswer?.trim() ? (
            <details className={styles.historyVisibleModelAnswer}>
              <summary>모범답안 펼쳐보기</summary>
              <p>{snapshot.modelAnswer}</p>
              {snapshot.modelAnswerKo ? <p>{snapshot.modelAnswerKo}</p> : null}
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function renderWritingHistoryAttemptTimeline(session: HistorySession) {
    return (
      <div className={styles.historyAttemptList}>
        {session.attempts.map((attempt) => (
          <article
            key={attempt.id}
            className={`${styles.historyAttemptCard} ${
              attempt.attemptType === "INITIAL" ? styles.historyAttemptInitial : styles.historyAttemptRewrite
            }`}
          >
            <div className={styles.historyAttemptMeta}>
              <strong
                className={
                  attempt.attemptType === "INITIAL"
                    ? styles.historyAttemptTypeInitial
                    : styles.historyAttemptTypeRewrite
                }
              >
                {`${attempt.attemptNo}차 피드백`}
              </strong>
              <span>
                {attempt.attemptType === "INITIAL" ? "초안" : "다시쓰기"} ·{" "}
                {attempt.visibleFeedback?.state === "READY_TO_FINISH"
                  ? "완료 준비"
                  : "한 번 더 쓰기"}{" "}
                ·{" "}
                {formatHistoryTime(attempt.createdAt)}
              </span>
            </div>

            <p className={styles.historyAnswer}>{attempt.answerText}</p>
            {renderWritingHistoryVisibleFeedback(attempt)}
          </article>
        ))}
      </div>
    );
  }
function renderWritingHistoryExpandedContent(
    session: HistorySession,
    promptLabel: string,
    promptText: string,
    containerClassName: string
  ) {
    return (
      <div className={containerClassName}>
        <div className={styles.writingHistoryPromptCard}>
          <span>{promptLabel}</span>
          <p>{promptText}</p>
        </div>

        {renderWritingHistoryAttemptTimeline(session)}

        {session.status !== "COMPLETED" && getLatestAttempt(session)?.visibleFeedback ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => handleResumeHistorySession(session)}
          >
            {session.status === "READY_TO_FINISH" ? "완료 화면으로 이어가기" : "이어서 다시 쓰기"}
          </button>
        ) : null}
      </div>
    );
  }

  function goHome() {
    window.location.assign("/");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function setTab(tab: MyPageTab) {
    setActiveTab(tab);
    window.history.replaceState({}, "", `/me?tab=${tab}`);
    notifyTabChange(tab);
  }

  async function handleSaveProfile() {
    if (!currentUser) {
      return;
    }

    if (!profileDisplayName.trim()) {
      setProfileError("표시 이름을 입력해 주세요.");
      return;
    }

    const wantsPasswordChange =
      Boolean(currentPassword.trim()) ||
      Boolean(newPassword.trim()) ||
      Boolean(confirmNewPassword.trim());

    if (wantsPasswordChange) {
      if (currentUser.socialProvider) {
        setProfileError("소셜 로그인 계정은 이 화면에서 비밀번호를 변경할 수 없어요.");
        return;
      }

      if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
        setProfileError("비밀번호를 바꾸려면 현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setProfileError("새 비밀번호와 확인 비밀번호가 서로 다릅니다.");
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      setProfileError("");
      setProfileNotice("");

      const updatedUser = await updateProfile({
        displayName: profileDisplayName.trim(),
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim() || undefined
      });

      setCurrentUser(updatedUser);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setProfileNotice("프로필 설정을 저장했어요.");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setProfileError(caughtError.message);
      } else {
        setProfileError("프로필 설정을 저장하지 못했어요.");
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleLogout() {
    try {
      setIsSubmitting(true);
      setError("");
      await logout();
      clearAllIncompleteLoops();
      clearAllLocalWritingDrafts();
      clearHomeDraftForLogin();
      setCurrentUser(null);
      setTodayStatus(null);
      setHistory([]);
      setSavedExpressions([]);
      setOpenSavedExpressionPrompts({});
      setSelectedSession(null);
      window.location.assign("/");
    } catch {
      setError("로그아웃하지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!currentUser) {
      return;
    }

    if (deleteConfirmationText.trim() !== "탈퇴") {
      setDeleteError("계정을 삭제하려면 확인 문구에 '탈퇴'를 입력해 주세요.");
      return;
    }

    if (!currentUser.socialProvider && !deletePassword.trim()) {
      setDeleteError("계정을 삭제하려면 현재 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsDeletingAccount(true);
      setDeleteError("");
      await deleteAccount({
        confirmationText: deleteConfirmationText.trim(),
        currentPassword: deletePassword.trim() || undefined
      });
      clearAllIncompleteLoops();
      clearAllLocalWritingDrafts();
      clearHomeDraftForLogin();
      window.location.assign("/");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setDeleteError(caughtError.message);
      } else {
        setDeleteError("계정을 삭제하지 못했어요.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function handleOpenSession(session: HistorySession) {
    setSelectedSession(session);
  }

  function handleCloseSelectedSession() {
    setSelectedSession(null);
  }

  function handleResumeHistorySession(session: HistorySession) {
    if (!currentUser) {
      return;
    }

    const latestAttempt = getLatestAttempt(session);
    const restoredFeedback = buildHistoryFeedback(session);
    if (!latestAttempt || !restoredFeedback) {
      setHistoryError("이전 형식의 기록은 당시 피드백을 정확히 복원할 수 없어요.");
      return;
    }

    saveIncompleteLoop(
      {
        promptId: session.promptId,
        difficulty: normalizeDailyDifficulty(session.difficulty),
        step: "feedback",
        sessionId: session.sessionId,
        updatedAt: new Date().toISOString(),
        promptSnapshot: {
          topic: session.topic,
          questionEn: session.questionEn,
          questionKo: session.questionKo
        },
        snapshot: {
          selectedDifficulty: normalizeDailyDifficulty(session.difficulty),
          selectedPromptId: session.promptId,
          sessionId: session.sessionId,
          answer: latestAttempt.answerText,
          rewrite: latestAttempt.answerText,
          lastSubmittedAnswer: latestAttempt.answerText,
          feedback: restoredFeedback,
          step: "feedback"
        }
      },
      currentUser.id
    );

    setSelectedSession(null);
    router.push("/");
  }

  async function confirmDeleteSavedExpression(savedExpressionId: number) {
    try {
      setDeletingSavedExpressionId(savedExpressionId);
      setSavedExpressionError("");
      await deleteSavedExpression(savedExpressionId);
      setSavedExpressions((current) => current.filter((item) => item.id !== savedExpressionId));
      setOpenSavedExpressionPrompts((current) => {
        const next = { ...current };
        delete next[savedExpressionId];
        return next;
      });
    } catch (caughtError) {
      setSavedExpressionError(
        caughtError instanceof Error ? caughtError.message : "저장한 표현을 삭제하지 못했어요."
      );
    } finally {
      setDeletingSavedExpressionId(null);
    }
  }

  function handleDeleteSavedExpression(savedExpression: SavedExpression) {
    const shouldDelete = window.confirm(`'${savedExpression.expression}' 표현을 저장 목록에서 삭제할까요?`);
    if (!shouldDelete) {
      return;
    }

    void confirmDeleteSavedExpression(savedExpression.id);
  }

  function toggleSavedExpressionPrompt(savedExpressionId: number) {
    setOpenSavedExpressionPrompts((current) => ({
      ...current,
      [savedExpressionId]: !current[savedExpressionId]
    }));
  }

  function handleResetSavedExpressionControls() {
    setSavedExpressionSearchQuery("");
    setSelectedSavedExpressionTag(null);
    setSelectedSavedExpressionTagAnchorId(null);
  }

  function handleSelectSavedExpressionTag(tag: string, anchorSavedExpressionId?: number) {
    const normalizedTag = normalizeSavedExpressionTag(tag);
    if (!normalizedTag) {
      return;
    }

    setSelectedSavedExpressionTag((current) => {
      if (current === normalizedTag) {
        setSelectedSavedExpressionTagAnchorId(null);
        return null;
      }

      setSelectedSavedExpressionTagAnchorId(anchorSavedExpressionId ?? null);
      return normalizedTag;
    });
  }

  const findHistorySessionForSavedExpression = useCallback((savedExpression: SavedExpression) => {
    const promptId = trimSavedExpressionLookupValue(savedExpression.promptId);
    const promptQuestionEn = trimSavedExpressionLookupValue(savedExpression.promptQuestionEn);
    const promptQuestionKo = trimSavedExpressionLookupValue(savedExpression.promptQuestionKo);
    const promptTopic = trimSavedExpressionLookupValue(savedExpression.promptTopic);

    const matches = history.filter((session) => {
      if (promptId && session.promptId === promptId) {
        return true;
      }
      if (promptQuestionEn && session.questionEn.trim() === promptQuestionEn) {
        return true;
      }
      if (promptQuestionKo && session.questionKo.trim() === promptQuestionKo) {
        return true;
      }
      return Boolean(promptTopic && session.topic.trim() === promptTopic);
    });

    if (matches.length === 0) {
      return null;
    }

    return [...matches].sort((left, right) =>
      getLatestSessionTimestamp(right).localeCompare(getLatestSessionTimestamp(left))
    )[0];
  }, [history]);

  function handlePracticeSavedExpression(savedExpression: SavedExpression) {
    const linkedSession = findHistorySessionForSavedExpression(savedExpression);
    const practiceTarget = resolveSavedExpressionPracticeTarget(savedExpression, linkedSession);
    const expression = savedExpression.expression.trim();

    if (!practiceTarget || !expression) {
      setSavedExpressionError("이 표현을 다시 써볼 질문 정보를 아직 찾지 못했어요.");
      return;
    }

    const params = new URLSearchParams({
      difficulty: practiceTarget.difficulty,
      promptId: practiceTarget.promptId,
      prefillExpression: expression
    });
    router.push(`/?${params.toString()}`);
  }

  const selectedTagPracticeCandidate = useMemo(() => {
    if (!selectedSavedExpressionTag) {
      return null;
    }

    const anchorSavedExpression =
      selectedSavedExpressionTagAnchorId == null
        ? null
        : visibleSavedExpressions.find((item) => item.id === selectedSavedExpressionTagAnchorId) ?? null;
    const prioritizedSavedExpressions = anchorSavedExpression
      ? [
          anchorSavedExpression,
          ...visibleSavedExpressions.filter((item) => item.id !== anchorSavedExpression.id)
        ]
      : visibleSavedExpressions;

    for (const savedExpression of prioritizedSavedExpressions) {
      if (!getVisibleSavedExpressionTags(savedExpression).includes(selectedSavedExpressionTag)) {
        continue;
      }

      const linkedSession = findHistorySessionForSavedExpression(savedExpression);
      const practiceTarget = resolveSavedExpressionPracticeTarget(savedExpression, linkedSession);
      const expression = savedExpression.expression.trim();
      const expressions = collectTagPracticeExpressions(
        selectedSavedExpressionTag,
        savedExpression,
        visibleSavedExpressions
      );

      if (practiceTarget && expression && isEligibleTagPracticeExpression(expression) && expressions.length > 0) {
        return {
          practiceTarget,
          expressions
        };
      }
    }

    return null;
  }, [
    findHistorySessionForSavedExpression,
    selectedSavedExpressionTag,
    selectedSavedExpressionTagAnchorId,
    visibleSavedExpressions
  ]);

  function handlePracticeSelectedSavedExpressionTag() {
    if (!selectedSavedExpressionTag || !selectedTagPracticeCandidate) {
      setSavedExpressionError("이 태그에 연결된 다시 써보기 표현을 아직 찾지 못했어요.");
      return;
    }

    const params = new URLSearchParams({
      difficulty: selectedTagPracticeCandidate.practiceTarget.difficulty,
      promptId: selectedTagPracticeCandidate.practiceTarget.promptId,
      prefillExpression: selectedTagPracticeCandidate.expressions[0],
      practiceTag: selectedSavedExpressionTag,
      practiceTagLabel: selectedSavedExpressionTagLabel,
      practiceExpressions: JSON.stringify(selectedTagPracticeCandidate.expressions)
    });
    router.push(`/?${params.toString()}`);
  }

  function handleOpenSavedExpressionHistory(savedExpression: SavedExpression) {
    const targetSession = findHistorySessionForSavedExpression(savedExpression);
    if (!targetSession) {
      setSavedExpressionError("연결된 질문 기록을 아직 찾지 못했어요.");
      return;
    }

    const dateKey = formatHistoryDateKey(getLatestSessionTimestamp(targetSession));
    setSavedExpressionError("");
    setActiveTab("writing");
    setActiveWritingTab("history");
    setSelectedHistoryDate(dateKey);
    setOpenDates((current) => ({
      ...current,
      [dateKey]: true
    }));
    setSelectedSession(targetSession);
  }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderAccountTab() {
    return renderAccountSettingsPage();
  }

  function renderAccountSettingsPage() {
    const loginMethodLabel = currentUser
      ? currentUser.socialProvider
        ? getLoginMethodLabel(currentUser)
        : "이메일 로그인"
      : "-";
    const accountEmailLabel = currentUser ? getAccountEmailLabel(currentUser) : "-";

    return (
      <section className={styles.accountSettingsLayout}>
        <div className={styles.accountPageTitle}>
          <h1>
            <span className={styles.accountPageTitleSubject}>
              <span className={styles.accountPageTitleSubjectText}>계정 설정</span>
              <span className={styles.accountPageTitleUnderline} aria-hidden="true" />
            </span>
          </h1>
        </div>

        <div className={styles.accountSettingsStack}>
          <section className={styles.accountInfoCard}>
            <div className={styles.accountInfoHeader}>
              <div className={styles.accountInfoHeaderTitle}>
                <h2>내 계정 정보</h2>
              </div>
            </div>

            <div className={styles.accountInfoFieldList}>
              <div className={styles.accountInfoField}>
                <span>이름</span>
                <div className={styles.accountInfoValue}>{currentUser?.displayName || "-"}</div>
              </div>
              <div className={styles.accountInfoField}>
                <span>이메일 주소</span>
                <div className={styles.accountInfoValue}>{accountEmailLabel}</div>
              </div>
              <div className={styles.accountInfoField}>
                <span>로그인 방식</span>
                <div className={`${styles.accountInfoValue} ${styles.accountInfoValueInline}`}>
                  <span>{loginMethodLabel}</span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.accountFormCard}>
            <div className={styles.accountSectionHeader}>
              <h3>계정 수정</h3>
            </div>

            <div className={`${styles.form} ${styles.accountFieldStack}`}>
              <label className={styles.field}>
                <span>이름</span>
                <input
                  className={styles.input}
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  placeholder="이름을 입력해 주세요."
                />
              </label>

              {currentUser?.socialProvider ? (
                <div className={styles.accountReadonlyNotice}>
                  <strong>소셜 로그인 계정</strong>
                  <p>소셜 로그인 계정은 이 화면에서 비밀번호를 변경할 수 없어요.</p>
                </div>
              ) : (
                <>
                  <label className={styles.field}>
                    <span>현재 비밀번호</span>
                    <input
                      className={styles.input}
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="현재 비밀번호를 입력해 주세요."
                    />
                  </label>
                  <label className={styles.field}>
                    <span>새 비밀번호</span>
                    <input
                      className={styles.input}
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="새 비밀번호를 입력해 주세요."
                    />
                  </label>
                  <label className={styles.field}>
                    <span>새 비밀번호 확인</span>
                    <input
                      className={styles.input}
                      type="password"
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      placeholder="새 비밀번호를 한 번 더 입력해 주세요."
                    />
                  </label>
                </>
              )}
            </div>

            <div className={styles.accountPrimaryAction}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSaveProfile()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "변경사항 저장 중..." : "변경사항 저장"}
              </button>
            </div>

            {profileNotice ? <p className={styles.notice}>{profileNotice}</p> : null}
            {profileError ? <p className={styles.error}>{profileError}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
          </section>

          <div className={styles.accountFooterActions}>
            <button type="button" className={styles.ghostButton} onClick={goHome}>
              홈으로 이동
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>

          <div className={styles.accountDangerLinkRow}>
            <button
              type="button"
              className={styles.accountDangerLinkButton}
              onClick={() =>
                setIsDangerZoneOpen((current) => {
                  const next = !current;
                  if (!next) {
                    setIsDeleteFormOpen(false);
                    setDeleteError("");
                  }
                  return next;
                })
              }
            >
              위험 구역
            </button>
          </div>

          {isDangerZoneOpen ? (
            <section className={styles.accountDangerInlinePanel}>
              {!isDeleteFormOpen ? (
                <button
                  type="button"
                  className={styles.accountDangerEntryButton}
                  onClick={() => {
                    setDeleteError("");
                    setIsDeleteFormOpen(true);
                  }}
                >
                  회원탈퇴
                </button>
              ) : (
                <>
                  <div className={`${styles.form} ${styles.accountFieldStack}`}>
                    <label className={styles.field}>
                      <span>확인 문구</span>
                      <input
                        className={styles.input}
                        value={deleteConfirmationText}
                        onChange={(event) => setDeleteConfirmationText(event.target.value)}
                        placeholder="확인 문구로 '탈퇴'를 입력해 주세요."
                      />
                    </label>

                    {!currentUser?.socialProvider ? (
                      <label className={styles.field}>
                        <span>현재 비밀번호</span>
                        <input
                          className={styles.input}
                          type="password"
                          value={deletePassword}
                          onChange={(event) => setDeletePassword(event.target.value)}
                          placeholder="현재 비밀번호를 입력해 주세요."
                        />
                      </label>
                    ) : (
                      <p className={styles.accountDangerHelper}>
                        소셜 로그인 계정은 현재 비밀번호 없이 회원탈퇴할 수 있어요.
                      </p>
                    )}
                  </div>

                  <div className={styles.accountDangerAction}>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => void handleDeleteAccount()}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? "회원탈퇴 처리 중..." : "회원탈퇴"}
                    </button>
                  </div>

                  {deleteError ? <p className={styles.error}>{deleteError}</p> : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      </section>
    );
  }

  function renderWritingTab() {
    return (
      <section className={styles.writingHistoryLayout}>
        <div className={styles.writingDashboardHeader}>
          <h1 className={styles.writingDashboardTitle}>
            <span className={styles.writingDashboardTitleLead}>
              <span className={styles.writingDashboardTitleLeadText}>작문 기록</span>
              <span className={styles.writingDashboardUnderline} aria-hidden="true" />
            </span>
          </h1>
        </div>

        <section className={styles.writingProfileCard}>
          <div className={styles.writingProfileIdentity}>
            <strong>{currentUser?.displayName || "-"}</strong>
            <p>{currentUser?.email || "-"}</p>
          </div>
          <div className={styles.writingProfileMetricRow}>
            <article className={styles.writingProfileMetricCard}>
              <span>{todayStatus?.streakDays ?? 0}</span>
              <p>연속 루프</p>
            </article>
            <article className={styles.writingProfileMetricCard}>
              <span>{history.length}</span>
              <p>질문 기록</p>
            </article>
            <article className={styles.writingProfileMetricCard}>
              <span>{(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}</span>
              <p>총 문장</p>
            </article>
          </div>
        </section>

        <div className={styles.writingContentTabRow}>
          <button
            type="button"
            className={activeWritingTab === "history" ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setActiveWritingTab("history")}
          >
            기록
          </button>
          <button
            type="button"
            className={activeWritingTab === "expressions" ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setActiveWritingTab("expressions")}
          >
            저장한 표현
          </button>
        </div>

        {activeWritingTab === "history" ? (
          <section className={styles.writingHistoryBoard}>
            <div className={styles.writingPanelHeader}>
              <div>
                <h2>날짜별 기록</h2>
                <p>{history.length}개의 질문</p>
              </div>
            </div>

            {isHistoryLoading ? (
              <div className={styles.writingPanelEmpty}>
                <p>작문 기록을 불러오고 있어요.</p>
              </div>
            ) : groupedHistoryEntries.length === 0 ? (
              <div className={styles.writingPanelEmpty}>
                <p>아직 기록이 없어요. 오늘의 질문으로 첫 작문을 시작해 보세요.</p>
                <button type="button" className={styles.primaryButton} onClick={goHome}>
                  홈으로 이동
                </button>
              </div>
            ) : (
              <div className={styles.writingHistoryDateFeed}>
                {groupedHistoryEntries.map(({ dateKey, sessions }) => {
                  const isOpen = openDates[dateKey] ?? false;

                  return (
                    <section
                      key={dateKey}
                      className={styles.writingHistoryDateGroup}
                      data-history-date={dateKey}
                    >
                      <button
                        type="button"
                        className={styles.writingHistoryDateHeading}
                        onClick={() => toggleDateGroup(dateKey)}
                        aria-expanded={isOpen}
                      >
                        <h3>{formatHistoryDateHeading(dateKey)}</h3>
                        <span aria-hidden="true" />
                        <span className={`material-symbols-outlined ${styles.writingHistoryDateToggleIcon}`}>
                          {isOpen ? "remove" : "add"}
                        </span>
                      </button>

                      {isOpen ? (
                        <div className={styles.writingHistoryDateStack}>
                          {sessions.map((session) => {
                            const latestAttempt = getLatestAttempt(session);

                            return (
                              <article key={session.sessionId} className={styles.writingHistoryListItem}>
                                <button
                                  type="button"
                                  className={styles.writingHistoryQuestionButton}
                                  onClick={() => handleOpenSession(session)}
                                >
                                  <div className={styles.writingHistoryListMeta}>
                                    <div className={styles.writingHistoryQuestionChips}>
                                      <span className={styles.writingHistoryQuestionChipPrimary}>
                                        {session.topic}
                                      </span>
                                      <span className={styles.writingHistoryQuestionChipNeutral}>
                                        {getDifficultyLabel(session.difficulty)}
                                      </span>
                                      {latestAttempt ? (
                                        <span className={styles.writingHistoryQuestionChipAccent}>
                                          {getAttemptLabel(latestAttempt.attemptType)}
                                        </span>
                                      ) : null}
                                    </div>
                                    <h4>{session.questionEn}</h4>
                                    <p>{session.questionKo}</p>
                                  </div>
                                  <span className="material-symbols-outlined">open_in_new</span>
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}

            {historyError ? <p className={styles.error}>{historyError}</p> : null}
          </section>
        ) : (
          <section className={styles.writingHistoryBoard}>
            <div className={styles.writingPanelHeader}>
              <div>
                <h2>저장한 표현</h2>
                <p>{savedExpressionSectionMeta}</p>
              </div>
            </div>

            {savedExpressions.length > 0 ? (
              <div className={styles.savedExpressionControls}>
                <input
                  className={styles.savedExpressionSearchInput}
                  value={savedExpressionSearchQuery}
                  onChange={(event) => setSavedExpressionSearchQuery(event.target.value)}
                  placeholder="표현, 뜻, 예문, 질문, 태그 검색"
                />

                {savedExpressionTagOptions.length > 0 ? (
                  <div className={styles.savedExpressionFilterScroller}>
                    {savedExpressionTagOptions.map((tagOption) => {
                      const isSelected = selectedSavedExpressionTag === tagOption.tag;

                      return (
                        <button
                          key={tagOption.tag}
                          type="button"
                          className={
                            isSelected
                              ? styles.savedExpressionFilterChipActive
                              : styles.savedExpressionFilterChip
                          }
                          onClick={() => handleSelectSavedExpressionTag(tagOption.tag)}
                        >
                          <span>{tagOption.label}</span>
                          <small>{tagOption.count}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {normalizedSavedExpressionSearch || selectedSavedExpressionTag ? (
                  <div className={styles.savedExpressionFilterSummary}>
                    <span>
                      {[
                        normalizedSavedExpressionSearch
                          ? `"${savedExpressionSearchQuery.trim()}" 검색`
                          : null,
                        selectedSavedExpressionTag
                          ? `${selectedSavedExpressionTagLabel} 상단 우선 정렬`
                          : null
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <div className={styles.savedExpressionFilterSummaryActions}>
                      {selectedSavedExpressionTag ? (
                        <button
                          type="button"
                          className={styles.savedExpressionTextLinkButton}
                          onClick={handlePracticeSelectedSavedExpressionTag}
                          disabled={!selectedTagPracticeCandidate}
                        >
                          이 태그로 다시 써보기
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.savedExpressionTextLinkButton}
                        onClick={handleResetSavedExpressionControls}
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isSavedExpressionsLoading ? (
              <div className={styles.writingPanelEmpty}>
                <p>저장한 표현을 불러오고 있어요.</p>
              </div>
            ) : savedExpressions.length === 0 ? (
              <div className={styles.writingPanelEmpty}>
                <p>아직 저장한 표현이 없어요. 피드백 카드에서 마음에 드는 표현을 저장해 보세요.</p>
                <button type="button" className={styles.primaryButton} onClick={goHome}>
                  질문으로 이동
                </button>
              </div>
            ) : visibleSavedExpressions.length === 0 ? (
              <div className={styles.writingPanelEmpty}>
                <p>검색 결과가 없어요. 다른 검색어나 태그로 다시 찾아보세요.</p>
                <button type="button" className={styles.primaryButton} onClick={handleResetSavedExpressionControls}>
                  검색 초기화
                </button>
              </div>
            ) : (
              <div className={styles.savedExpressionGrid}>
                {visibleSavedExpressions.map((item) => {
                  const promptText = getSavedExpressionPromptText(item);
                  const linkedHistorySession = findHistorySessionForSavedExpression(item);
                  const practiceTarget = resolveSavedExpressionPracticeTarget(item, linkedHistorySession);
                  const savedExpressionTags = getVisibleSavedExpressionTags(item);
                  const isPromptOpen = Boolean(openSavedExpressionPrompts[item.id]);
                  const hasLinkedHistory = Boolean(linkedHistorySession);

                  return (
                    <article key={item.id} className={styles.savedExpressionCard}>
                      <div className={styles.savedExpressionHeaderRow}>
                        <div className={styles.savedExpressionMetaWrap}>
                          {savedExpressionTags.length > 0 || item.saveCount > 1 ? (
                            <div className={styles.savedExpressionBadgeRow}>
                              {savedExpressionTags.map((tag) => {
                                const isSelected = selectedSavedExpressionTag === tag;

                                return (
                                  <button
                                    key={`${item.id}-${tag}`}
                                    type="button"
                                    className={
                                      isSelected
                                        ? styles.savedExpressionTagBadgeActive
                                        : styles.savedExpressionTagBadge
                                    }
                                    onClick={() => handleSelectSavedExpressionTag(tag, item.id)}
                                  >
                                    {formatSavedExpressionTagLabel(tag)}
                                  </button>
                                );
                              })}
                            {item.saveCount > 1 ? (
                              <span className={styles.savedExpressionSaveCount}>{`${item.saveCount}번 저장`}</span>
                            ) : null}
                            </div>
                          ) : null}
                          <strong className={styles.savedExpressionText}>{item.expression}</strong>
                        </div>

                        <div className={styles.savedExpressionHeaderAside}>
                          <span className={styles.savedExpressionDate}>{formatSavedExpressionDate(item.lastSavedAt)}</span>
                          <button
                            type="button"
                            className={styles.savedExpressionDeleteButton}
                            onClick={() => handleDeleteSavedExpression(item)}
                            disabled={deletingSavedExpressionId === item.id}
                            aria-label={`${item.expression} 삭제`}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {deletingSavedExpressionId === item.id ? "hourglass_top" : "delete"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {item.meaningKo ? <p className={styles.savedExpressionMeaning}>{item.meaningKo}</p> : null}
                      {item.exampleEn ? (
                        <p className={styles.savedExpressionExample}>
                          {renderSavedExpressionExample(item.exampleEn, item.expression)}
                        </p>
                      ) : null}

                      {!promptText && practiceTarget ? (
                        <button
                          type="button"
                          className={styles.savedExpressionTextLinkButton}
                          onClick={() => handlePracticeSavedExpression(item)}
                        >
                          이 표현으로 한 문장 써보기
                        </button>
                      ) : null}

                      {promptText ? (
                        <div className={styles.savedExpressionPromptSection}>
                          <div className={styles.savedExpressionActionRow}>
                            <button
                              type="button"
                              className={styles.savedExpressionPromptLink}
                              onClick={() => toggleSavedExpressionPrompt(item.id)}
                            >
                              {isPromptOpen ? "질문 숨기기" : "어떤 질문에서 저장했는지 보기"}
                            </button>
                            {practiceTarget ? (
                              <button
                                type="button"
                                className={styles.savedExpressionTextLinkButton}
                                onClick={() => handlePracticeSavedExpression(item)}
                              >
                                이 표현으로 한 문장 써보기
                              </button>
                            ) : null}
                          </div>

                          {isPromptOpen ? (
                            <div className={styles.savedExpressionPromptBox}>
                              <p className={styles.savedExpressionPrompt}>{promptText}</p>
                              <button
                                type="button"
                                className={styles.savedExpressionHistoryButton}
                                onClick={() => handleOpenSavedExpressionHistory(item)}
                                disabled={!hasLinkedHistory}
                              >
                                {hasLinkedHistory ? "질문 기록으로 가기" : "연결된 기록이 없어요"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            {savedExpressionError ? <p className={styles.error}>{savedExpressionError}</p> : null}
          </section>
        )}
      </section>
    );
  }

  function renderSelectedSessionModal() {
    if (!selectedSession) {
      return null;
    }

    return (
      <div
        className={styles.writingSessionModalOverlay}
        role="dialog"
        aria-modal="true"
        aria-label="작문 기록 상세"
        onClick={handleCloseSelectedSession}
      >
        <div
          className={styles.writingSessionModalDialog}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.writingSessionModalHeader}>
            <div className={styles.writingSessionModalTitleBlock}>
              <span>질문 상세</span>
              <h2>{selectedSession.questionEn}</h2>
              <p>{selectedSession.questionKo}</p>
            </div>
            <button
              type="button"
              className={styles.writingSessionModalCloseButton}
              onClick={handleCloseSelectedSession}
            >
              닫기
            </button>
          </div>

          {renderWritingHistoryExpandedContent(
            selectedSession,
            "질문 해석",
            selectedSession.questionKo,
            styles.writingSessionModalContent
          )}
        </div>
      </div>
    );
  }

  if (currentUser === undefined) {
    return (
      <main className={`${styles.page} ${styles.myPageShell}`}>
        <section className={styles.emptyCard}>
          <h2>{activeTab === "account" ? "계정 정보를 불러오고 있어요" : "작문 기록을 불러오고 있어요"}</h2>
          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={`${styles.page} ${styles.myPageShell}`}>
        <section className={styles.emptyCard}>
          <h2>로그인이 필요해요</h2>
          <p>
            {activeTab === "account"
              ? "여기에서는 닉네임과 비밀번호를 바꾸고, 로그아웃이나 회원탈퇴를 할 수 있어요."
              : "작문 기록은 로그인한 뒤 날짜별로 모아볼 수 있어요."}
          </p>
          <div className={styles.linkRow}>
            <button type="button" className={styles.primaryButton} onClick={() => router.push("/login")}>
              로그인
            </button>
            <button type="button" className={styles.ghostButton} onClick={() => router.push("/register")}>
              회원가입
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (activeTab === "account") {
    return (
      <main className={`${styles.page} ${styles.myPageShell} ${styles.myPageAccountShell}`}>
        {renderAccountSettingsPage()}
      </main>
    );
  }

  return (
    <>
      <main className={`${styles.page} ${styles.myPageShell} ${styles.myPageWritingShell}`}>
        {renderWritingTab()}
      </main>
      {renderSelectedSessionModal()}
    </>
  );
}




