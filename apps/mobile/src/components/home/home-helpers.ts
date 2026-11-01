import type { IncompleteLoopState } from "@/lib/incomplete-loop";
import type { TodayWritingStatus } from "@/lib/types";

// 홈 화면의 타입, 상수, 날짜·이어 쓰기 문구·달력·요일 줄 계산(순수 함수).
export type WeekDayChip = {
  key: string;
  label: string;
  isToday: boolean;
  isCompleted: boolean;
};

export type MonthCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isCompleted: boolean;
  isToday: boolean;
};

export type MonthCalendarData = {
  monthLabel: string;
  streakDays: number;
  completedCount: number;
  isReferenceMonth: boolean;
  cells: MonthCalendarCell[];
};

export type HomeDiaryCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntries: boolean;
  isFuture: boolean;
};

export type HomeGuideStep = {
  title: string;
  body: string;
};

export type IncompleteLoopCopy = {
  title: string;
  body: string;
  ctaLabel: string;
};

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
export const SEOUL_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
export const HOME_GUIDE_STEPS: HomeGuideStep[] = [
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

export function formatWeekDay(date: Date) {
  return WEEKDAY_LABELS[date.getDay()] ?? "";
}

export function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = SEOUL_DATE_KEY_FORMATTER.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day, 12);
}

export function getIncompleteLoopCopy(step: IncompleteLoopState["step"]): IncompleteLoopCopy {
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

export function getIncompleteLoopInlineTitle(step: IncompleteLoopState["step"]) {
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

export function formatIncompleteLoopSavedAt(updatedAt: string) {
  const savedAt = new Date(updatedAt);
  if (Number.isNaN(savedAt.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit"
  }).format(savedAt);
}

export function parseStatusDate(dateString?: string | null) {
  return dateString ? new Date(`${dateString}T12:00:00+09:00`) : new Date();
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function buildFallbackCompletedDateKeys(todayStatus: TodayWritingStatus | null) {
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

export function buildMonthCalendar(
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

export function formatDiaryMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(date);
}

export function calculateDiaryStreakDays(entryDateKeys: Set<string>, todayKey: string) {
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

export function buildHomeDiaryMonthCalendar(
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

export function buildWeekChips(todayStatus: TodayWritingStatus | null): WeekDayChip[] {
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
