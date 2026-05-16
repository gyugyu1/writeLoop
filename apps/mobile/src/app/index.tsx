import { Redirect, router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import MobileScreenHeader from "@/components/mobile-screen-header";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWritingDraft,
  trackDailyPromptClick
} from "@/lib/api";
import { difficultyDeck, getDifficultyMeta } from "@/lib/difficulty";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { getStreakMascotStage } from "@/lib/streak-mascot";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
import {
  getNowInEnglishSummary,
  NOW_IN_ENGLISH_NOTIFICATION_BODY,
  type NowInEnglishSummary
} from "@/lib/now-in-english";
import type {
  DailyDifficulty,
  DiaryCalendarSummary,
  FeaturedDailyPromptRecommendation,
  TodayWritingStatus
} from "@/lib/types";

type WeekDayChip = {
  key: string;
  label: string;
  isToday: boolean;
  isCompleted: boolean;
};

type MonthCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isCompleted: boolean;
  isToday: boolean;
};

type MonthCalendarData = {
  monthLabel: string;
  streakDays: number;
  completedCount: number;
  isReferenceMonth: boolean;
  cells: MonthCalendarCell[];
};

type HomeDiaryCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntries: boolean;
  isFuture: boolean;
};

type HomeGuideStep = {
  title: string;
  body: string;
};

type IncompleteLoopCopy = {
  title: string;
  body: string;
  ctaLabel: string;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const SEOUL_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const HOME_GUIDE_STEPS: HomeGuideStep[] = [
  {
    title: "난이도 고르기",
    body: "지금 컨디션에 맞는 난이도를 하나 고르면 오늘 질문 세트가 바로 열려요."
  },
  {
    title: "질문 하나 선택하기",
    body: "마음에 드는 질문을 고른 뒤 2~4문장 정도로 가볍게 먼저 써 보세요."
  },
  {
    title: "AI 코치 활용하기",
    body: "표현이 막히면 작문칸 안의 마스코트를 눌러 코치에게 첫 문장이나 표현을 물어볼 수 있어요."
  },
  {
    title: "피드백으로 다시 쓰기",
    body: "피드백에서 잘한 점과 다음 루프 제안을 보고 한 번 더 다듬으면 실력이 훨씬 빨리 붙어요."
  }
];

function formatWeekDay(date: Date) {
  return WEEKDAY_LABELS[date.getDay()] ?? "";
}

function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = SEOUL_DATE_KEY_FORMATTER.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day, 12);
}

function getIncompleteLoopCopy(step: IncompleteLoopState["step"]): IncompleteLoopCopy {
  switch (step) {
    case "feedback":
      return {
        title: "받아둔 피드백이 남아 있어요",
        body: "고쳐볼 점을 확인하고 다음 루프로 이어갈 수 있어요.",
        ctaLabel: "피드백 이어보기"
      };
    case "rewrite":
      return {
        title: "다시 쓰기 초안이 남아 있어요",
        body: "방금 다듬던 답안을 이어서 마무리해볼 수 있어요.",
        ctaLabel: "다시 쓰기"
      };
    case "answer":
    default:
      return {
        title: "작성하던 답안이 있어요",
        body: "멈춘 지점부터 바로 이어서 써볼 수 있어요.",
        ctaLabel: "이어서 쓰기"
      };
  }
}

function getIncompleteLoopInlineTitle(step: IncompleteLoopState["step"]) {
  switch (step) {
    case "feedback":
      return "받아둔 피드백이 있어요";
    case "rewrite":
      return "다시 쓰던 답안이 있어요";
    case "answer":
    default:
      return "쓰던 답안이 있어요";
  }
}

function formatIncompleteLoopSavedAt(updatedAt: string) {
  const savedAt = new Date(updatedAt);
  if (Number.isNaN(savedAt.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit"
  }).format(savedAt);
}

function parseStatusDate(dateString?: string | null) {
  return dateString ? new Date(`${dateString}T12:00:00+09:00`) : new Date();
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildFallbackCompletedDateKeys(todayStatus: TodayWritingStatus | null) {
  const referenceDate = parseStatusDate(todayStatus?.date);
  const streakDays = Math.max(todayStatus?.streakDays ?? 0, todayStatus?.completed ? 1 : 0);
  const streakEndDate =
    streakDays > 0 ? addDays(referenceDate, todayStatus?.completed === false ? -1 : 0) : referenceDate;
  const completedDateKeys = new Set<string>();

  for (let offset = 0; offset < streakDays; offset += 1) {
    completedDateKeys.add(toDateKey(addDays(streakEndDate, -offset)));
  }

  return completedDateKeys;
}

function buildMonthCalendar(
  todayStatus: TodayWritingStatus | null,
  completedDateKeys: Set<string>,
  visibleMonth: Date
): MonthCalendarData {
  const referenceDate = parseStatusDate(todayStatus?.date);
  const todayKey = toDateKey(referenceDate);
  const monthStart = getMonthStart(visibleMonth);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12);
  const calendarStart = addDays(monthStart, -monthStart.getDay());
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const cells: MonthCalendarCell[] = [];
  let completedCount = 0;

  for (
    let currentDate = new Date(calendarStart);
    currentDate <= calendarEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    const key = toDateKey(currentDate);
    cells.push({
      key,
      dayNumber: currentDate.getDate(),
      isCurrentMonth:
        currentDate.getFullYear() === visibleMonth.getFullYear() &&
        currentDate.getMonth() === visibleMonth.getMonth(),
      isCompleted: completedDateKeys.has(key),
      isToday: key === todayKey
    });

    if (
      completedDateKeys.has(key) &&
      currentDate.getFullYear() === visibleMonth.getFullYear() &&
      currentDate.getMonth() === visibleMonth.getMonth()
    ) {
      completedCount += 1;
    }
  }

  return {
    monthLabel: formatMonthLabel(visibleMonth),
    streakDays: Math.max(todayStatus?.streakDays ?? 0, todayStatus?.completed ? 1 : 0),
    completedCount,
    isReferenceMonth: isSameMonth(visibleMonth, referenceDate),
    cells
  };
}

function formatDiaryMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function calculateDiaryStreakDays(entryDateKeys: Set<string>, todayKey: string) {
  const today = parseDateKey(todayKey);
  const anchorDate = entryDateKeys.has(todayKey) ? today : addDays(today, -1);
  let streakDays = 0;

  for (
    let cursor = new Date(anchorDate);
    entryDateKeys.has(toDateKey(cursor));
    cursor = addDays(cursor, -1)
  ) {
    streakDays += 1;
  }

  return streakDays;
}

function buildHomeDiaryMonthCalendar(
  visibleMonth: Date,
  entryDateKeys: Set<string>,
  todayKey: string
): HomeDiaryCalendarCell[] {
  const monthStart = getMonthStart(visibleMonth);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12);
  const calendarStart = addDays(monthStart, -monthStart.getDay());
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const cells: HomeDiaryCalendarCell[] = [];

  for (
    let currentDate = new Date(calendarStart);
    currentDate <= calendarEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    const key = toDateKey(currentDate);
    cells.push({
      key,
      dayNumber: currentDate.getDate(),
      isCurrentMonth: isSameMonth(currentDate, visibleMonth),
      isToday: key === todayKey,
      hasEntries: entryDateKeys.has(key),
      isFuture: key > todayKey
    });
  }

  return cells;
}

function buildWeekChips(todayStatus: TodayWritingStatus | null): WeekDayChip[] {
  const baseDate = parseStatusDate(todayStatus?.date);
  const streakDays = Math.min(todayStatus?.streakDays ?? 0, 7);
  const lastCompletedDate = new Date(baseDate);

  if (!todayStatus?.completed) {
    lastCompletedDate.setDate(lastCompletedDate.getDate() - 1);
  }

  const completedDateKeys = new Set<string>();
  for (let index = 0; index < streakDays; index += 1) {
    const currentDate = new Date(lastCompletedDate);
    currentDate.setDate(lastCompletedDate.getDate() - index);
    completedDateKeys.add(toDateKey(currentDate));
  }

  return Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date(baseDate);
    currentDate.setDate(baseDate.getDate() - (6 - index));

    return {
      key: toDateKey(currentDate),
      label: formatWeekDay(currentDate),
      isToday: toDateKey(currentDate) === toDateKey(baseDate),
      isCompleted: completedDateKeys.has(toDateKey(currentDate))
    };
  });
}

export default function HomeScreen() {
  const { currentUser, isHydrating, refreshSession } = useSession();
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [incompleteLoop, setIncompleteLoop] = useState<IncompleteLoopState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [featuredRecommendation, setFeaturedRecommendation] =
    useState<FeaturedDailyPromptRecommendation | null>(null);
  const [isFeaturedRecommendationLoading, setIsFeaturedRecommendationLoading] = useState(false);
  const [featuredRecommendationError, setFeaturedRecommendationError] = useState("");
  const [isFeaturedRecommendationTranslationVisible, setIsFeaturedRecommendationTranslationVisible] =
    useState(false);
  const [isResolvingIncompleteLoop, setIsResolvingIncompleteLoop] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getMonthStart(new Date()));
  const [calendarCompletedDateKeys, setCalendarCompletedDateKeys] = useState<string[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [diaryCalendarSummary, setDiaryCalendarSummary] = useState<DiaryCalendarSummary | null>(null);
  const [diaryMonthCursor, setDiaryMonthCursor] = useState(() => getMonthStart(new Date()));
  const [isDiaryCalendarLoading, setIsDiaryCalendarLoading] = useState(false);
  const [diaryCalendarError, setDiaryCalendarError] = useState("");
  const [nowInEnglishSummary, setNowInEnglishSummary] = useState<NowInEnglishSummary | null>(null);
  const featuredRecommendationRequestIdRef = useRef(0);
  const homeSnapshotRequestIdRef = useRef(0);
  const diaryCalendarLoadPromiseRef = useRef<Promise<void> | null>(null);
  const hasCompletedInitialHomeLoadRef = useRef(false);
  const historyRoute: Href = currentUser ? "/records" : buildLoginHref("/records");
  const diaryOverviewRoute: Href = currentUser ? "/diary" : buildLoginHref("/diary");
  const featuredRecommendationDifficulty = incompleteLoop?.difficulty ?? "I";
  const featuredRecommendationItem = featuredRecommendation?.featured ?? null;
  const featuredRecommendationPrompt = featuredRecommendationItem?.prompt ?? null;
  const featuredDifficultyMeta = getDifficultyMeta(
    featuredRecommendation?.difficulty ?? featuredRecommendationDifficulty
  );

  useEffect(() => {
    hasCompletedInitialHomeLoadRef.current = false;
  }, [currentUser?.id]);

  const displayedStreakDays = Math.max(todayStatus?.streakDays ?? 0, todayStatus?.completed ? 1 : 0);
  const homeStatusMascot = useMemo(
    () => getStreakMascotStage(displayedStreakDays),
    [displayedStreakDays]
  );

  const weekChips = useMemo(() => buildWeekChips(todayStatus), [todayStatus]);
  const incompleteLoopCopy = useMemo(
    () => (incompleteLoop ? getIncompleteLoopCopy(incompleteLoop.step) : null),
    [incompleteLoop]
  );
  const incompleteLoopSavedAt = useMemo(
    () => (incompleteLoop ? formatIncompleteLoopSavedAt(incompleteLoop.updatedAt) : ""),
    [incompleteLoop]
  );
  const incompleteLoopInlineNote = useMemo(() => {
    if (!incompleteLoop) {
      return "";
    }

    return [getIncompleteLoopInlineTitle(incompleteLoop.step), incompleteLoopSavedAt]
      .filter(Boolean)
      .join(" · ");
  }, [incompleteLoop, incompleteLoopSavedAt]);
  const calendarCompletedDateKeySet = useMemo(() => {
    const nextSet = buildFallbackCompletedDateKeys(todayStatus);
    calendarCompletedDateKeys.forEach((key) => nextSet.add(key));
    return nextSet;
  }, [calendarCompletedDateKeys, todayStatus]);
  const calendarReferenceMonth = useMemo(
    () => getMonthStart(parseStatusDate(todayStatus?.date)),
    [todayStatus?.date]
  );
  const monthCalendar = useMemo(
    () => buildMonthCalendar(todayStatus, calendarCompletedDateKeySet, calendarMonthCursor),
    [calendarCompletedDateKeySet, calendarMonthCursor, todayStatus]
  );
  const diaryTodayKey = useMemo(() => toDateKey(new Date()), []);
  const diaryDaysByDate = useMemo(() => {
    const grouped = new Map<string, DiaryCalendarSummary["days"][number]>();
    (diaryCalendarSummary?.days ?? []).forEach((day) => {
      grouped.set(day.date, day);
    });

    return grouped;
  }, [diaryCalendarSummary?.days]);
  const diaryEntryDateKeys = useMemo(() => new Set(diaryDaysByDate.keys()), [diaryDaysByDate]);
  const nowInEnglishDateKeys = useMemo(
    () => new Set((nowInEnglishSummary?.entries ?? []).map((entry) => entry.dateKey)),
    [nowInEnglishSummary?.entries]
  );
  const diaryStreakDays = useMemo(
    () => calculateDiaryStreakDays(diaryEntryDateKeys, diaryTodayKey),
    [diaryEntryDateKeys, diaryTodayKey]
  );
  const answerHistoryCount = todayStatus?.totalAnswerSessions ?? 0;
  const writingStreakBadgeLabel =
    displayedStreakDays > 0 ? `작문 ${displayedStreakDays}일 연속` : "작문 대기 중";
  const diaryStreakBadgeLabel =
    diaryStreakDays > 0 ? `일기 ${diaryStreakDays}일 연속` : "일기 대기 중";
  const statusMetaLines = [
    `총 ${answerHistoryCount.toLocaleString("ko-KR")}문항 작성 · 총 ${(diaryCalendarSummary?.totalEntries ?? 0).toLocaleString("ko-KR")}개의 일기 작성`,
    `총 ${(nowInEnglishSummary?.entries.length ?? 0).toLocaleString("ko-KR")}개의 영어조각`
  ];
  const todayDiaryEntry = diaryDaysByDate.get(diaryTodayKey) ?? null;
  const nowInEnglishTodayCount = nowInEnglishSummary?.todayCount ?? 0;
  const nowInEnglishReminderEnabled = nowInEnglishSummary?.settings.enabled ?? false;
  const homeDiaryCalendar = useMemo(
    () => buildHomeDiaryMonthCalendar(diaryMonthCursor, diaryEntryDateKeys, diaryTodayKey),
    [diaryEntryDateKeys, diaryMonthCursor, diaryTodayKey]
  );
  const diaryMonthLabel = useMemo(() => formatDiaryMonthLabel(diaryMonthCursor), [diaryMonthCursor]);
  const canGoToNextDiaryMonth = useMemo(
    () => !isSameMonth(diaryMonthCursor, getMonthStart(parseDateKey(diaryTodayKey))),
    [diaryMonthCursor, diaryTodayKey]
  );
  const calendarFooterLabel = useMemo(() => {
    if (currentUser) {
      return `총 ${(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성`;
    }

    return "학습을 시작하면 달력에 기록이 쌓여요.";
  }, [currentUser, todayStatus?.totalWrittenSentences]);
  const calendarSummaryText = useMemo(() => {
    if (monthCalendar.isReferenceMonth && monthCalendar.streakDays > 1) {
      return `현재 ${monthCalendar.streakDays}일 연속 학습 중`;
    }

    if (monthCalendar.isReferenceMonth && todayStatus?.completed) {
      return "오늘도 학습 기록이 쌓였어요";
    }

    if (monthCalendar.completedCount > 0) {
      return `${monthCalendar.completedCount}일 기록이 있어요`;
    }

    return "기록이 없어요";
  }, [monthCalendar.completedCount, monthCalendar.isReferenceMonth, monthCalendar.streakDays, todayStatus?.completed]);
  const canGoToNextCalendarMonth = useMemo(
    () => !isSameMonth(calendarMonthCursor, calendarReferenceMonth),
    [calendarMonthCursor, calendarReferenceMonth]
  );
  const incompleteLoopRoute = useMemo<Href | null>(() => {
    if (!incompleteLoop) {
      return null;
    }

    if (incompleteLoop.step === "feedback") {
      return {
        pathname: "/practice/feedback",
        params: {
          difficulty: incompleteLoop.difficulty,
          promptId: incompleteLoop.promptId
        }
      };
    }

    if (incompleteLoop.step === "rewrite") {
      return {
        pathname: "/practice/write",
        params: {
          difficulty: incompleteLoop.difficulty,
          promptId: incompleteLoop.promptId,
          mode: "rewrite",
          resume: "1"
        }
      };
    }

    return {
      pathname: "/practice/write",
      params: {
        difficulty: incompleteLoop.difficulty,
        promptId: incompleteLoop.promptId
      }
    };
  }, [incompleteLoop]);

  const loadTodayStatus = useCallback(async () => {
    try {
      setStatusError("");
      setTodayStatus(await getTodayWritingStatus());
    } catch (caughtError) {
      setStatusError(
        caughtError instanceof Error ? caughtError.message : "학습 일지를 불러오지 못했어요."
      );
    }
  }, []);

  const loadDiaryEntries = useCallback(async () => {
    if (!currentUser) {
      setDiaryCalendarSummary(null);
      setDiaryCalendarError("");
      setIsDiaryCalendarLoading(false);
      return;
    }

    if (diaryCalendarLoadPromiseRef.current) {
      await diaryCalendarLoadPromiseRef.current;
      return;
    }

    const loadPromise = (async () => {
      try {
        setIsDiaryCalendarLoading(true);
        setDiaryCalendarError("");
        setDiaryCalendarSummary(await getDiaryCalendarSummary());
      } catch (caughtError) {
        setDiaryCalendarError(
          caughtError instanceof Error ? caughtError.message : "영어일기 달력을 불러오지 못했어요."
        );
      } finally {
        setIsDiaryCalendarLoading(false);
      }
    })();

    diaryCalendarLoadPromiseRef.current = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (diaryCalendarLoadPromiseRef.current === loadPromise) {
        diaryCalendarLoadPromiseRef.current = null;
      }
    }
  }, [currentUser]);

  const loadNowInEnglishSummary = useCallback(async () => {
    setNowInEnglishSummary(await getNowInEnglishSummary());
  }, []);

  const loadFeaturedRecommendation = useCallback(
    async (difficulty: DailyDifficulty = featuredRecommendationDifficulty) => {
      if (!currentUser) {
        setFeaturedRecommendation(null);
        setFeaturedRecommendationError("");
        setIsFeaturedRecommendationLoading(false);
        return;
      }

      if (isResolvingIncompleteLoop) {
        return;
      }

      const requestId = featuredRecommendationRequestIdRef.current + 1;
      featuredRecommendationRequestIdRef.current = requestId;

      try {
        setIsFeaturedRecommendationLoading(true);
        setFeaturedRecommendationError("");
        const nextRecommendation = await getFeaturedDailyPrompt(difficulty);
        if (featuredRecommendationRequestIdRef.current !== requestId) {
          return;
        }
        setFeaturedRecommendation(nextRecommendation);
      } catch (caughtError) {
        if (featuredRecommendationRequestIdRef.current !== requestId) {
          return;
        }
        setFeaturedRecommendation(null);
        setFeaturedRecommendationError(
          caughtError instanceof Error ? caughtError.message : "오늘의 추천 질문을 불러오지 못했어요."
        );
      } finally {
        if (featuredRecommendationRequestIdRef.current === requestId) {
          setIsFeaturedRecommendationLoading(false);
        }
      }
    },
    [currentUser, featuredRecommendationDifficulty, isResolvingIncompleteLoop]
  );

  const loadHomeSnapshot = useCallback(
    async (difficulty: DailyDifficulty = featuredRecommendationDifficulty) => {
      if (!currentUser) {
        setTodayStatus(null);
        setStatusError("");
        setFeaturedRecommendation(null);
        setFeaturedRecommendationError("");
        setDiaryCalendarSummary(null);
        setDiaryCalendarError("");
        setIsFeaturedRecommendationLoading(false);
        setIsDiaryCalendarLoading(false);
        hasCompletedInitialHomeLoadRef.current = false;
        return;
      }

      if (isResolvingIncompleteLoop) {
        return;
      }

      const requestId = homeSnapshotRequestIdRef.current + 1;
      homeSnapshotRequestIdRef.current = requestId;

      try {
        setStatusError("");
        setDiaryCalendarError("");
        setFeaturedRecommendationError("");
        setIsDiaryCalendarLoading(true);
        setIsFeaturedRecommendationLoading(true);

        const snapshot = await getMobileHomeSnapshot(difficulty);
        if (homeSnapshotRequestIdRef.current !== requestId) {
          return;
        }

        setTodayStatus(snapshot.todayStatus ?? null);
        setDiaryCalendarSummary(snapshot.diaryCalendarSummary ?? null);
        setFeaturedRecommendation(snapshot.featuredRecommendation ?? null);
      } catch {
        if (homeSnapshotRequestIdRef.current !== requestId) {
          return;
        }

        await Promise.allSettled([
          loadTodayStatus(),
          loadDiaryEntries(),
          loadFeaturedRecommendation(difficulty)
        ]);
      } finally {
        if (homeSnapshotRequestIdRef.current === requestId) {
          setIsDiaryCalendarLoading(false);
          setIsFeaturedRecommendationLoading(false);
          hasCompletedInitialHomeLoadRef.current = true;
        }
      }
    },
    [
      currentUser,
      featuredRecommendationDifficulty,
      isResolvingIncompleteLoop,
      loadDiaryEntries,
      loadFeaturedRecommendation,
      loadTodayStatus
    ]
  );

  useEffect(() => {
    if (!currentUser) {
      hasCompletedInitialHomeLoadRef.current = false;
      setTodayStatus(null);
      setStatusError("");
      setFeaturedRecommendation(null);
      setFeaturedRecommendationError("");
      setDiaryCalendarSummary(null);
      setDiaryCalendarError("");
      return;
    }

    if (isResolvingIncompleteLoop) {
      return;
    }

    void loadHomeSnapshot(featuredRecommendationDifficulty);
  }, [
    currentUser,
    featuredRecommendationDifficulty,
    isResolvingIncompleteLoop,
    loadHomeSnapshot
  ]);

  useEffect(() => {
    setIsFeaturedRecommendationTranslationVisible(false);
  }, [featuredRecommendationPrompt?.id]);

  useEffect(() => {
    void loadNowInEnglishSummary();
  }, [loadNowInEnglishSummary]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsResolvingIncompleteLoop(true);

      const loadIncompleteLoop = async () => {
        try {
          const nextLoop = await getIncompleteLoop();
          if (!nextLoop) {
            if (!cancelled) {
              setIncompleteLoop(null);
            }
            return;
          }

          if (nextLoop.step === "feedback") {
            const feedbackState = await hydratePracticeFeedbackState(nextLoop.difficulty, nextLoop.promptId);
            if (!feedbackState) {
              await clearIncompleteLoop();
              if (!cancelled) {
                setIncompleteLoop(null);
              }
              return;
            }
          } else {
            const draftType = nextLoop.draftType ?? (nextLoop.step === "rewrite" ? "REWRITE" : "ANSWER");
            const localDraft = await getLocalWritingDraft(nextLoop.promptId, draftType);

            if (currentUser) {
              try {
                const serverDraft = await getWritingDraft(nextLoop.promptId, draftType);
                if (!localDraft && !serverDraft) {
                  await clearIncompleteLoop();
                  if (!cancelled) {
                    setIncompleteLoop(null);
                  }
                  return;
                }
              } catch {
                // Keep the card when the server check fails temporarily.
              }
            } else if (!localDraft) {
              await clearIncompleteLoop();
              if (!cancelled) {
                setIncompleteLoop(null);
              }
              return;
            }
          }

          if (!cancelled) {
            setIncompleteLoop(nextLoop);
          }
        } finally {
          if (!cancelled) {
            setIsResolvingIncompleteLoop(false);
          }
        }
      };

      void loadIncompleteLoop();

      return () => {
        cancelled = true;
      };
    }, [currentUser])
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasCompletedInitialHomeLoadRef.current) {
        return;
      }

      void loadDiaryEntries();
      void loadNowInEnglishSummary();
    }, [loadDiaryEntries, loadNowInEnglishSummary])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const user = await refreshSession();
    await loadNowInEnglishSummary();
    if (user) {
      await loadHomeSnapshot();
    } else {
      setTodayStatus(null);
      setStatusError("");
      setFeaturedRecommendation(null);
      setFeaturedRecommendationError("");
      setDiaryCalendarSummary(null);
      setDiaryCalendarError("");
    }
    setIsRefreshing(false);
  }, [
    loadNowInEnglishSummary,
    loadHomeSnapshot,
    refreshSession
  ]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    if (!currentUser) {
      setCalendarCompletedDateKeys([]);
      setCalendarError("");
      setIsCalendarLoading(false);
      return;
    }

    let cancelled = false;

    const loadCalendarStatus = async () => {
      try {
        setIsCalendarLoading(true);
        setCalendarError("");
        const monthStatus = await getMonthWritingStatus(
          calendarMonthCursor.getFullYear(),
          calendarMonthCursor.getMonth() + 1
        );
        if (cancelled) {
          return;
        }

        const nextKeys = (monthStatus?.days ?? [])
          .filter((day) => day.completed)
          .map((day) => day.date);
        setCalendarCompletedDateKeys(nextKeys);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setCalendarError(caughtError instanceof Error ? caughtError.message : "달력을 불러오지 못했어요.");
      } finally {
        if (!cancelled) {
          setIsCalendarLoading(false);
        }
      }
    };

    void loadCalendarStatus();

    return () => {
      cancelled = true;
    };
  }, [calendarMonthCursor, currentUser, isCalendarOpen]);

  const handleStart = useCallback((difficulty: DailyDifficulty) => {
    router.push({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty
      }
    });
  }, []);

  const handleOpenNowInEnglish = useCallback(() => {
    router.push("/now" as Href);
  }, []);

  const handleOpenNowInEnglishRecords = useCallback(() => {
    router.push({
      pathname: "/records",
      params: { tab: "now" }
    } as Href);
  }, []);

  const handleOpenCalendar = useCallback(() => {
    setCalendarMonthCursor(calendarReferenceMonth);
    setIsCalendarOpen(true);
  }, [calendarReferenceMonth]);

  const handleCloseCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, []);

  const handleChangeCalendarMonth = useCallback((direction: -1 | 1) => {
    setCalendarMonthCursor((current) => getMonthStart(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)));
  }, []);

  const handleOpenCalendarDate = useCallback(
    (dateKey: string, hasWritingActivity: boolean, hasDiaryActivity: boolean, hasNowInEnglishActivity: boolean) => {
      setIsCalendarOpen(false);
      if (currentUser && hasDiaryActivity && !hasWritingActivity && !hasNowInEnglishActivity) {
        const diaryDay = diaryDaysByDate.get(dateKey);
        if (diaryDay) {
          router.push({
            pathname: "/diary/[entryId]",
            params: { entryId: diaryDay.entryId }
          } as Href);
          return;
        }
      }

      if (hasNowInEnglishActivity && !hasWritingActivity) {
        router.push({
          pathname: "/records",
          params: { tab: "now" }
        } as Href);
        return;
      }

      const nextHref: Href = currentUser
        ? ({
            pathname: "/records",
            params: {
              date: dateKey
            }
          } as Href)
        : buildLoginHref(`/records?date=${dateKey}`);
      router.push(nextHref);
    },
    [currentUser, diaryDaysByDate]
  );

  const handleChangeDiaryMonth = useCallback((direction: -1 | 1) => {
    setDiaryMonthCursor((current) =>
      getMonthStart(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12))
    );
  }, []);

  const handleOpenDiaryDate = useCallback(
    (cell: HomeDiaryCalendarCell) => {
      if (cell.isFuture) {
        return;
      }

      if (!currentUser) {
        router.push(buildLoginHref("/diary"));
        return;
      }

      const diaryDay = diaryDaysByDate.get(cell.key);
      if (diaryDay) {
        router.push({
          pathname: "/diary/[entryId]",
          params: { entryId: diaryDay.entryId }
        } as Href);
        return;
      }

      if (cell.isToday) {
        router.push("/diary/write" as never);
      } else {
        router.push("/diary" as never);
      }
    },
    [currentUser, diaryDaysByDate]
  );

  const handleWriteTodayDiary = useCallback(() => {
    if (!currentUser) {
      router.push(buildLoginHref("/diary"));
      return;
    }

    if (todayDiaryEntry) {
      router.push({
        pathname: "/diary/[entryId]",
        params: { entryId: todayDiaryEntry.entryId }
      } as Href);
      return;
    }

    router.push("/diary/write" as never);
  }, [currentUser, todayDiaryEntry]);

  const handleResumeLoop = useCallback(() => {
    if (!incompleteLoopRoute) {
      return;
    }

    router.push(incompleteLoopRoute);
  }, [incompleteLoopRoute]);

  const handleStartFeaturedPrompt = useCallback(() => {
    if (!featuredRecommendationPrompt) {
      return;
    }

    void trackDailyPromptClick(featuredRecommendationPrompt.id).catch(() => undefined);
    router.push({
      pathname: "/practice/write",
      params: {
        difficulty: featuredRecommendation?.difficulty ?? featuredRecommendationDifficulty,
        promptId: featuredRecommendationPrompt.id
      }
    });
  }, [
    featuredRecommendation?.difficulty,
    featuredRecommendationDifficulty,
    featuredRecommendationPrompt
  ]);

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <View style={styles.homeLoadingState}>
            <ActivityIndicator color="#E38B12" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
      >
        <View style={styles.statusPanel}>
          <Pressable style={styles.statusPanelMain} onPress={() => router.push(historyRoute)}>
          <View style={styles.statusLead}>
            <View style={styles.statusIconCircle}>
              <Image source={homeStatusMascot.source} style={styles.statusMascotImage} />
            </View>
            <View style={styles.statusCopy}>
              <View style={styles.statusTopRow}>
                <Text style={styles.statusTitle}>학습 일지</Text>
              </View>
              <View style={styles.statusBadgeRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{writingStreakBadgeLabel}</Text>
                </View>
                <View style={[styles.statusBadge, styles.statusBadgeSecondary]}>
                  <Text style={styles.statusBadgeText}>{diaryStreakBadgeLabel}</Text>
                </View>
              </View>
              <View style={styles.statusMetaGroup}>
                {statusMetaLines.map((line) => (
                  <Text key={line} style={styles.statusMeta}>
                    {line}
                  </Text>
                ))}
              </View>
              {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
            </View>
          </View>

          </Pressable>

          <Pressable style={styles.weekRowButton} onPress={handleOpenCalendar}>
          <View style={styles.weekRow}>
            {weekChips.map((chip) => (
              <View
                key={chip.key}
                style={[
                  styles.weekChip,
                  chip.isCompleted && styles.weekChipDone,
                  chip.isToday && styles.weekChipToday
                ]}
              >
                <Text
                  style={[
                    styles.weekChipText,
                    chip.isCompleted && styles.weekChipTextDone,
                    chip.isToday && styles.weekChipTextToday
                  ]}
                >
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
          </Pressable>

        {incompleteLoop && incompleteLoopCopy ? (
          <Pressable style={styles.statusResumeSection} onPress={handleResumeLoop}>
            <Text style={styles.resumeActionText}>{`${incompleteLoopCopy.ctaLabel} >`}</Text>
            <Text style={styles.resumeMeta}>{incompleteLoopInlineNote}</Text>
          </Pressable>
        ) : null}
        </View>

        <View style={styles.nowEnglishSection}>
          <MobileScreenHeader title="지금 영어로" />
          <View style={styles.nowEnglishHero}>
            <Text style={styles.nowEnglishBody}>{NOW_IN_ENGLISH_NOTIFICATION_BODY}</Text>
            <View style={styles.nowEnglishStatsRow}>
              <View style={styles.nowEnglishStatPill}>
                <Text style={styles.nowEnglishStatNumber}>{nowInEnglishTodayCount}</Text>
                <Text style={styles.nowEnglishStatLabel}>오늘 남긴 조각</Text>
              </View>
              <View style={styles.nowEnglishStatPill}>
                <Text style={styles.nowEnglishStatNumber}>{nowInEnglishReminderEnabled ? "ON" : "OFF"}</Text>
                <Text style={styles.nowEnglishStatLabel}>루프 알림</Text>
              </View>
            </View>
            <View style={styles.nowEnglishActionRow}>
              <Pressable style={styles.nowEnglishPrimaryButton} onPress={handleOpenNowInEnglish}>
                <Text style={styles.nowEnglishPrimaryButtonText}>지금 쓰기</Text>
              </Pressable>
              <Pressable style={styles.nowEnglishSecondaryButton} onPress={handleOpenNowInEnglishRecords}>
                <Text style={styles.nowEnglishSecondaryButtonText}>기록 보기</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.difficultySectionHeader}>
          <MobileScreenHeader
            title="난이도 선택"
            rightAccessory={
              <Pressable style={styles.guideButton} onPress={() => setIsGuideOpen(true)}>
                <Text style={styles.guideButtonText}>가이드 보기</Text>
              </Pressable>
            }
          />
        </View>

        <View style={styles.featuredRecommendationSection}>
          <View style={styles.featuredRecommendationHeader}>
            <Text style={styles.featuredRecommendationLabel}>오늘의 추천 질문</Text>
            <View
              style={[
                styles.featuredRecommendationDifficultyBadge,
                {
                  backgroundColor: featuredDifficultyMeta.tint,
                  borderColor: featuredDifficultyMeta.accent
                }
              ]}
            >
              <Text
                style={[
                  styles.featuredRecommendationDifficultyText,
                  { color: featuredDifficultyMeta.accent }
                ]}
              >
                {featuredDifficultyMeta.title}
              </Text>
            </View>
          </View>

          {isFeaturedRecommendationLoading ? (
            <View style={styles.featuredRecommendationLoadingCard}>
              <ActivityIndicator color="#E38B12" />
            </View>
          ) : featuredRecommendationPrompt ? (
            <Pressable style={styles.featuredRecommendationCard} onPress={handleStartFeaturedPrompt}>
              <Text style={styles.featuredRecommendationQuestion}>
                {featuredRecommendationPrompt.questionEn}
              </Text>
              {isFeaturedRecommendationTranslationVisible ? (
                <Text style={styles.featuredRecommendationTranslation}>
                  {featuredRecommendationPrompt.questionKo}
                </Text>
              ) : null}
              {featuredRecommendationItem?.reasonText ? (
                <Text style={styles.featuredRecommendationReason}>
                  {featuredRecommendationItem.reasonText}
                </Text>
              ) : null}
              <View style={styles.featuredRecommendationFooter}>
                <Text style={styles.featuredRecommendationMeta}>
                  {featuredRecommendationPrompt.topic}
                </Text>
                <View style={styles.featuredRecommendationActions}>
                  <Pressable
                    style={styles.featuredRecommendationTranslationButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      setIsFeaturedRecommendationTranslationVisible((current) => !current);
                    }}
                  >
                    <Text style={styles.featuredRecommendationTranslationButtonText}>
                      {isFeaturedRecommendationTranslationVisible ? "해석 숨기기" : "해석 보기"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ) : (
            <View style={styles.featuredRecommendationFallbackCard}>
              <Text style={styles.featuredRecommendationFallbackText}>
                {featuredRecommendationError || "오늘의 추천 질문을 준비하고 있어요."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.stageSection}>
          {difficultyDeck.map((item) => {
            return (
              <Pressable
                key={item.difficulty}
                style={styles.difficultyCard}
                onPress={() => handleStart(item.difficulty)}
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.homeDiarySection}>
          <MobileScreenHeader
            title="영어일기"
            rightAccessory={
              <Pressable style={styles.homeDiaryOverviewButton} onPress={() => router.push(diaryOverviewRoute)}>
                <Text style={styles.homeDiaryOverviewButtonText}>전체 보기</Text>
              </Pressable>
            }
          />

          <View style={styles.homeDiaryCalendarCard}>
            <View style={styles.homeDiaryMonthRow}>
              <Pressable style={styles.homeDiaryMonthButton} onPress={() => handleChangeDiaryMonth(-1)}>
                <Text style={styles.homeDiaryMonthButtonText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.homeDiaryMonthTitle}>{diaryMonthLabel}</Text>
              <Pressable
                style={[
                  styles.homeDiaryMonthButton,
                  !canGoToNextDiaryMonth && styles.homeDiaryMonthButtonDisabled
                ]}
                onPress={() => handleChangeDiaryMonth(1)}
                disabled={!canGoToNextDiaryMonth}
              >
                <Text
                  style={[
                    styles.homeDiaryMonthButtonText,
                    !canGoToNextDiaryMonth && styles.homeDiaryMonthButtonTextDisabled
                  ]}
                >
                  {">"}
                </Text>
              </Pressable>
            </View>

            {isDiaryCalendarLoading ? (
              <View style={styles.homeDiaryLoadingRow}>
                <ActivityIndicator color="#E38B12" />
              </View>
            ) : null}
            {diaryCalendarError ? <Text style={styles.homeDiaryErrorText}>{diaryCalendarError}</Text> : null}

            <View style={styles.homeDiaryWeekHeader}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={`diary-${label}`} style={styles.homeDiaryWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.homeDiaryCalendarGrid}>
              {homeDiaryCalendar.map((cell) => (
                <View key={cell.key} style={styles.homeDiaryCalendarCellWrap}>
                  <Pressable
                    style={[
                      styles.homeDiaryCalendarCell,
                      cell.hasEntries && styles.homeDiaryCalendarCellHasEntries,
                      cell.isToday && styles.homeDiaryCalendarCellToday,
                      !cell.isCurrentMonth && styles.homeDiaryCalendarCellOutside,
                      cell.isFuture && styles.homeDiaryCalendarCellFuture
                    ]}
                    onPress={() => handleOpenDiaryDate(cell)}
                    disabled={cell.isFuture}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.key} 영어일기 보기`}
                  >
                    <Text
                      style={[
                        styles.homeDiaryCalendarCellText,
                        cell.hasEntries && styles.homeDiaryCalendarCellTextHasEntries,
                        cell.isToday && styles.homeDiaryCalendarCellTextToday,
                        !cell.isCurrentMonth && styles.homeDiaryCalendarCellTextOutside,
                        cell.isFuture && styles.homeDiaryCalendarCellTextFuture
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>
                    {cell.hasEntries ? <View style={styles.homeDiaryCalendarDot} /> : null}
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable style={styles.homeDiaryWriteButton} onPress={handleWriteTodayDiary}>
              <Text style={styles.homeDiaryWriteButtonText}>
                {todayDiaryEntry ? "오늘 일기 이어보기" : "오늘의 일기 쓰기"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
        <MobileNavBar activeTab="home" />
      </View>

      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCalendar}
      >
        <View style={styles.calendarModalOverlay}>
          <Pressable style={styles.calendarModalBackdrop} onPress={handleCloseCalendar} />
          <SafeAreaView style={styles.calendarModalFrame} edges={["top", "bottom"]}>
            <View style={styles.calendarModalCard}>
              <View style={styles.calendarModalHeader}>
                <View style={styles.calendarModalHeaderCopy}>
                  <View style={styles.calendarMonthNavRow}>
                    <Pressable
                      style={styles.calendarMonthNavButton}
                      onPress={() => handleChangeCalendarMonth(-1)}
                    >
                      <Text style={styles.calendarMonthNavButtonText}>{"<"}</Text>
                    </Pressable>
                    <Text style={styles.calendarModalTitle}>{monthCalendar.monthLabel}</Text>
                    <Pressable
                      style={[
                        styles.calendarMonthNavButton,
                        !canGoToNextCalendarMonth && styles.calendarMonthNavButtonDisabled
                      ]}
                      onPress={() => handleChangeCalendarMonth(1)}
                      disabled={!canGoToNextCalendarMonth}
                    >
                      <Text
                        style={[
                          styles.calendarMonthNavButtonText,
                          !canGoToNextCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                        ]}
                      >
                        {">"}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.calendarModalSubtitle}>{calendarSummaryText}</Text>
                </View>
                <Pressable style={styles.calendarModalCloseButton} onPress={handleCloseCalendar}>
                  <Text style={styles.calendarModalCloseText}>닫기</Text>
                </Pressable>
              </View>

              {isCalendarLoading ? (
                <View style={styles.calendarLoadingRow}>
                  <ActivityIndicator color="#E38B12" />
                </View>
              ) : null}
              {calendarError ? <Text style={styles.calendarErrorText}>{calendarError}</Text> : null}

              <View style={styles.calendarWeekHeader}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.calendarWeekLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {monthCalendar.cells.map((cell) => {
                  const hasWritingActivity = cell.isCompleted;
                  const hasDiaryActivity = diaryEntryDateKeys.has(cell.key);
                  const hasNowInEnglishActivity = nowInEnglishDateKeys.has(cell.key);
                  const activityLabel = [
                    hasWritingActivity ? "작문 완료" : null,
                    hasDiaryActivity ? "일기 작성" : null
                  ]
                    .filter(Boolean)
                    .join(", ");
                  const completeActivityLabel = [activityLabel, hasNowInEnglishActivity ? "영어조각 작성" : null]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <View key={cell.key} style={styles.calendarCellWrap}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${cell.dayNumber}일${completeActivityLabel ? `, ${completeActivityLabel}` : ""}`}
                        onPress={() =>
                          handleOpenCalendarDate(
                            cell.key,
                            hasWritingActivity,
                            hasDiaryActivity,
                            hasNowInEnglishActivity
                          )
                        }
                        style={[
                          styles.calendarCell,
                          hasDiaryActivity && !hasWritingActivity && styles.calendarCellDiaryOnly,
                          cell.isCompleted && styles.calendarCellCompleted,
                          cell.isToday && styles.calendarCellToday,
                          !cell.isCurrentMonth && styles.calendarCellOutside
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarCellText,
                            hasDiaryActivity && !hasWritingActivity && styles.calendarCellTextDiaryOnly,
                            cell.isCompleted && styles.calendarCellTextCompleted,
                            cell.isToday && styles.calendarCellTextToday,
                            !cell.isCurrentMonth && styles.calendarCellTextOutside
                          ]}
                        >
                          {cell.dayNumber}
                        </Text>
                        {hasWritingActivity || hasDiaryActivity || hasNowInEnglishActivity ? (
                          <View style={styles.calendarActivityMarkers} pointerEvents="none">
                            <View style={styles.calendarActivityDotSlot}>
                              {hasWritingActivity ? (
                                <View style={[styles.calendarActivityDot, styles.calendarActivityDotWriting]} />
                              ) : null}
                            </View>
                            <View style={styles.calendarActivityDotSlot}>
                              {hasDiaryActivity ? (
                                <View style={[styles.calendarActivityDot, styles.calendarActivityDotDiary]} />
                              ) : null}
                            </View>
                            <View style={styles.calendarActivityDotSlot}>
                              {hasNowInEnglishActivity ? (
                                <View style={[styles.calendarActivityDot, styles.calendarActivityDotNow]} />
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <View style={styles.calendarActivityLegend}>
                <View style={styles.calendarActivityLegendItem}>
                  <View style={[styles.calendarActivityDot, styles.calendarActivityDotWriting]} />
                  <Text style={styles.calendarActivityLegendText}>작문</Text>
                </View>
                <View style={styles.calendarActivityLegendItem}>
                  <View style={[styles.calendarActivityDot, styles.calendarActivityDotDiary]} />
                  <Text style={styles.calendarActivityLegendText}>일기</Text>
                </View>
                <View style={styles.calendarActivityLegendItem}>
                  <View style={[styles.calendarActivityDot, styles.calendarActivityDotNow]} />
                  <Text style={styles.calendarActivityLegendText}>영어조각</Text>
                </View>
              </View>

              <Text style={styles.calendarFooterMeta}>{calendarFooterLabel}</Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={isGuideOpen} animationType="slide" onRequestClose={() => setIsGuideOpen(false)}>
        <SafeAreaView style={styles.guideModalRoot} edges={["top", "bottom"]}>
          <View style={styles.guideModalHeader}>
            <View style={styles.guideModalHeaderText}>
              <Text style={styles.guideModalTitle}>바로 보는 학습 가이드</Text>
            </View>
            <Pressable style={styles.guideModalCloseButton} onPress={() => setIsGuideOpen(false)}>
              <Text style={styles.guideModalCloseText}>닫기</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.guideModalScroll}
            contentContainerStyle={styles.guideModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.guideLeadText}>질문 선택, 코치 도움, 피드백까지 한 흐름으로 이어집니다.</Text>

            <View style={styles.guideStepList}>
              {HOME_GUIDE_STEPS.map((step, index) => (
                <View key={step.title} style={styles.guideStepCard}>
                  <View style={styles.guideStepIndex}>
                    <Text style={styles.guideStepIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.guideStepCopy}>
                    <Text style={styles.guideStepTitle}>{step.title}</Text>
                    <Text style={styles.guideStepBody}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.guideTipCard}>
              <Text style={styles.guideTipTitle}>작게 시작하는 게 가장 좋아요.</Text>
              <Text style={styles.guideTipBody}>
                완벽하게 길게 쓰려고 하기보다, 짧게 먼저 쓰고 AI 코치와 피드백으로 한 번 더 다듬는 방식이 가장 안정적으로 늘어요.
              </Text>
            </View>
          </ScrollView>
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
  screen: {
    flex: 1
  },
  homeLoadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 4,
    gap: 20
  },
  heroSection: {
    display: "none",
    gap: 10,
    paddingTop: 8
  },
  difficultySectionHeader: {
    gap: 10
  },
  nowEnglishSection: {
    gap: 12
  },
  nowEnglishHero: {
    borderRadius: 36,
    backgroundColor: "#FDFDFB",
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 16,
    shadowColor: "#D18634",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 1,
    borderColor: "#EBDCCB",
    elevation: 3
  },
  nowEnglishBody: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
    color: "#756552"
  },
  nowEnglishStatsRow: {
    flexDirection: "row",
    gap: 10
  },
  nowEnglishStatPill: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFF3E2",
    borderWidth: 1,
    borderColor: "#EED8BF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  nowEnglishStatNumber: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    color: "#E38B12"
  },
  nowEnglishStatLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: "#8B6B49"
  },
  nowEnglishActionRow: {
    flexDirection: "row",
    gap: 10
  },
  nowEnglishPrimaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center"
  },
  nowEnglishPrimaryButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#251809"
  },
  nowEnglishSecondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9AE7A",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  nowEnglishSecondaryButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  headerTitleBlock: {
    alignSelf: "flex-start",
    gap: 8
  },
  difficultySectionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  difficultySectionTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  guideButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  guideButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  heroUnderline: {
    width: 150,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F2A14A",
    marginLeft: 2
  },
  statusPanel: {
    backgroundColor: "#FDFDFB",
    borderRadius: 34,
    padding: 22,
    gap: 0,
    borderWidth: 1,
    borderColor: "#EBDCCB",
    shadowColor: "#D89A51",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  statusPanelMain: {
    gap: 18
  },
  statusLead: {
    flexDirection: "row",
    gap: 18
  },
  statusIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#FFF0DD",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  statusMascotImage: {
    width: 84,
    height: 84,
    resizeMode: "contain"
  },
  statusCopy: {
    flex: 1,
    gap: 8
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2A2620"
  },
  statusBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFE7C2",
    borderWidth: 1,
    borderColor: "#F0C586",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  statusBadgeSecondary: {
    backgroundColor: "#FFF5E8",
    borderColor: "#EAD5B9"
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  statusMetaGroup: {
    gap: 2
  },
  statusMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#6D5E4E"
  },
  statusError: {
    fontSize: 13,
    color: "#B34A2B"
  },
  statusResumeSection: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFF1DB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4
  },
  resumeActionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#9A611E"
  },
  resumeMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: "#8B7761"
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E5D4C0",
    marginVertical: 4
  },
  homeDiarySection: {
    gap: 12
  },
  homeDiaryOverviewButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  homeDiaryOverviewButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  homeDiaryCalendarCard: {
    borderRadius: 30,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14
  },
  homeDiaryMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  homeDiaryMonthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  homeDiaryMonthButtonDisabled: {
    opacity: 0.35
  },
  homeDiaryMonthButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  homeDiaryMonthButtonTextDisabled: {
    color: "#BFAE9D"
  },
  homeDiaryMonthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2A2521"
  },
  homeDiaryLoadingRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  homeDiaryErrorText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B34A2B"
  },
  homeDiaryWeekHeader: {
    flexDirection: "row"
  },
  homeDiaryWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: "#A28D78"
  },
  homeDiaryCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  homeDiaryCalendarCellWrap: {
    width: "14.285%",
    alignItems: "center"
  },
  homeDiaryCalendarCell: {
    width: 38,
    height: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  homeDiaryCalendarCellOutside: {
    opacity: 0.45
  },
  homeDiaryCalendarCellFuture: {
    opacity: 0.25
  },
  homeDiaryCalendarCellHasEntries: {
    backgroundColor: "#FFF0D7"
  },
  homeDiaryCalendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  homeDiaryCalendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  homeDiaryCalendarCellTextOutside: {
    color: "#B4A392"
  },
  homeDiaryCalendarCellTextFuture: {
    color: "#C4B8AC"
  },
  homeDiaryCalendarCellTextHasEntries: {
    color: "#8A5A1E"
  },
  homeDiaryCalendarCellTextToday: {
    color: "#2E2416"
  },
  homeDiaryCalendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#A76518"
  },
  homeDiaryWriteButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  homeDiaryWriteButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#24180B"
  },
  featuredRecommendationSection: {
    gap: 12
  },
  featuredRecommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  featuredRecommendationLabel: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128",
    letterSpacing: -0.9
  },
  featuredRecommendationDifficultyBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  featuredRecommendationDifficultyText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900"
  },
  featuredRecommendationCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
    shadowColor: "#D89A51",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2
  },
  featuredRecommendationLoadingCard: {
    minHeight: 140,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  featuredRecommendationFallbackCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  featuredRecommendationFallbackText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F6255"
  },
  featuredRecommendationQuestion: {
    fontSize: 24,
    lineHeight: 33,
    fontWeight: "900",
    color: "#2B2620",
    letterSpacing: -0.9
  },
  featuredRecommendationTranslation: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6E6254"
  },
  featuredRecommendationReason: {
    fontSize: 14,
    lineHeight: 21,
    color: "#8A6431",
    fontWeight: "700"
  },
  featuredRecommendationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4
  },
  featuredRecommendationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  featuredRecommendationMeta: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#8B7457",
    fontWeight: "700"
  },
  featuredRecommendationTranslationButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF9F2"
  },
  featuredRecommendationTranslationButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  weekRowButton: {
    marginTop: 18
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EDE6DE",
    alignItems: "center",
    justifyContent: "center"
  },
  weekChipDone: {
    backgroundColor: "#FFE8CB"
  },
  weekChipToday: {
    borderWidth: 3,
    borderColor: "#F2C28A",
    backgroundColor: "#FFF8F1"
  },
  weekChipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#A39A8F"
  },
  weekChipTextDone: {
    color: "#9A6A22"
  },
  weekChipTextToday: {
    color: "#8C6433"
  },
  stageSection: {
    flexGrow: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18
  },
  difficultyCard: {
    width: "48.5%",
    minHeight: 196,
    backgroundColor: "#FFFEFC",
    borderRadius: 34,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 3,
    borderColor: "#F0D8BF",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1.1,
    color: "#232128"
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: "#6B5E4E"
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 27, 17, 0.22)"
  },
  calendarModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  calendarModalFrame: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  calendarModalCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EBDCCB",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  calendarModalHeaderCopy: {
    flex: 1,
    gap: 4
  },
  calendarMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  calendarMonthNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarMonthNavButtonDisabled: {
    opacity: 0.45
  },
  calendarMonthNavButtonText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A6431"
  },
  calendarMonthNavButtonTextDisabled: {
    color: "#B7A38A"
  },
  calendarModalTitle: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    color: "#232128"
  },
  calendarModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#77695A"
  },
  calendarModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  calendarModalCloseText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  calendarLoadingRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  calendarErrorText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B34A2B"
  },
  calendarWeekHeader: {
    flexDirection: "row"
  },
  calendarWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: "#A28D78"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  calendarCellWrap: {
    width: "14.285%",
    alignItems: "center"
  },
  calendarCell: {
    width: 38,
    height: 42,
    borderRadius: 18,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    position: "relative"
  },
  calendarCellOutside: {
    opacity: 0.45
  },
  calendarCellDiaryOnly: {
    backgroundColor: "transparent"
  },
  calendarCellCompleted: {
    backgroundColor: "transparent"
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  calendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  calendarCellTextOutside: {
    color: "#B4A392"
  },
  calendarCellTextCompleted: {
    color: "#5E5247"
  },
  calendarCellTextDiaryOnly: {
    color: "#5E5247"
  },
  calendarCellTextToday: {
    color: "#2E2416"
  },
  calendarActivityMarkers: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 3,
    flexDirection: "row",
    justifyContent: "center",
    gap: 3
  },
  calendarActivityDotSlot: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  calendarActivityDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    borderWidth: 0
  },
  calendarActivityDotWriting: {
    backgroundColor: "#EA920D"
  },
  calendarActivityDotDiary: {
    backgroundColor: "#32835B"
  },
  calendarActivityDotNow: {
    backgroundColor: "#2F74C0"
  },
  calendarActivityLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 4,
    marginBottom: 8
  },
  calendarActivityLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  calendarActivityLegendText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7A6856"
  },
  calendarFooterMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D5E4E",
    textAlign: "center"
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
    flex: 1
  },
  guideModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  guideModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  guideModalCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  guideModalScroll: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2"
  },
  guideModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 18
  },
  guideLeadText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    color: "#2A2620"
  },
  guideStepList: {
    gap: 12
  },
  guideStepCard: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    backgroundColor: "#FFFFFF",
    padding: 16
  },
  guideStepIndex: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0D9"
  },
  guideStepIndexText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#A76518"
  },
  guideStepCopy: {
    flex: 1,
    gap: 6
  },
  guideStepTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2A2620"
  },
  guideStepBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D5E4E"
  },
  guideTipCard: {
    borderRadius: 26,
    backgroundColor: "#FFF1DB",
    padding: 18,
    gap: 8
  },
  guideTipTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7E5215"
  },
  guideTipBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6C562F"
  }
});
