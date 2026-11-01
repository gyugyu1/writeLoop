import {
  formatNowInEnglishDateLabel,
  getNowInEnglishDateKey,
  type NowInEnglishEntry,
  type NowInEnglishQuietHours,
  type NowInEnglishScheduleMode
} from "@/lib/now-in-english";

// Now in English 화면의 상수, 타입, 표현 키·코치 제안 비교·알림 문구·월 달력·기록 묶기 계산(순수 함수).
export const NOW_IN_ENGLISH_COACH_PROMPT_ID = "diary-free-writing";
export const DEFAULT_QUIET_HOURS: NowInEnglishQuietHours = {
  enabled: true,
  startHour: 23,
  endHour: 8
};
export const HISTORY_FILTERS = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "all", label: "전체" }
] as const;

export const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
export const NOW_IN_ENGLISH_TEXT_LIMIT = 500;

export type NowInEnglishHistoryFilter = (typeof HISTORY_FILTERS)[number]["key"] | "selected";
export type NowInEnglishEntryGroup = {
  dateKey: string;
  label: string;
  entries: NowInEnglishEntry[];
};
export type NowInEnglishCalendarCell = {
  key: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEntries: boolean;
  entryCount: number;
};
export type PendingPolishSource = {
  entryId: string;
  text: string;
  createdAt: string;
  dateKey: string;
};

export function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeCoachSuggestionComparison(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
}

export function hasUsefulCoachSuggestion(originalText: string, suggestionEn: string) {
  const normalizedSuggestion = normalizeCoachSuggestionComparison(suggestionEn);
  if (!normalizedSuggestion) {
    return false;
  }

  return normalizedSuggestion !== normalizeCoachSuggestionComparison(originalText);
}

export function buildSavedExpressionIdMap(expressions: { id: number; expression: string }[]) {
  return expressions.reduce<Record<string, number>>((map, expression) => {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (normalizedKey) {
      map[normalizedKey] = expression.id;
    }
    return map;
  }, {});
}

export function mergeSavedNowInEnglishEntry(entries: NowInEnglishEntry[], savedEntry: NowInEnglishEntry) {
  return [savedEntry, ...entries.filter((entry) => entry.id !== savedEntry.id)].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function clampReminderIntervalHours(value: number) {
  return Math.min(12, Math.max(1, Math.trunc(value)));
}

export function formatNextReminderAt(date: Date | null) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function getReminderLabel(enabled: boolean, nextReminderAt: Date | null) {
  if (!enabled) {
    return "알림이 꺼져 있어요";
  }

  const nextReminderTime = formatNextReminderAt(nextReminderAt);
  return nextReminderTime ? `다음 알림 · ${nextReminderTime}` : "다음 알림을 준비하고 있어요";
}

export function getScheduleModeBody(scheduleMode: NowInEnglishScheduleMode) {
  return scheduleMode === "HOURLY_ANCHOR"
    ? "정각 기준으로 알림을 맞춰요."
    : "설정한 순간부터 간격을 세요.";
}

export function parseNowInEnglishDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day, 12);
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getCalendarMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function formatCalendarMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(date);
}

export function buildNowInEnglishMonthCalendar(
  visibleMonth: Date,
  entryCountsByDate: Map<string, number>,
  selectedDateKey: string | null,
  todayKey: string
): NowInEnglishCalendarCell[] {
  const monthStart = getCalendarMonthStart(visibleMonth);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12);
  const calendarStart = addDays(monthStart, -monthStart.getDay());
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const cells: NowInEnglishCalendarCell[] = [];

  for (
    let currentDate = new Date(calendarStart);
    currentDate <= calendarEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    const dateKey = getNowInEnglishDateKey(currentDate);
    const entryCount = entryCountsByDate.get(dateKey) ?? 0;
    cells.push({
      key: dateKey,
      day: currentDate.getDate(),
      isCurrentMonth: isSameCalendarMonth(currentDate, visibleMonth),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      hasEntries: entryCount > 0,
      entryCount
    });
  }

  return cells;
}

export function buildEntryGroups(entries: NowInEnglishEntry[]): NowInEnglishEntryGroup[] {
  const groups = new Map<string, NowInEnglishEntry[]>();
  entries.forEach((entry) => {
    const groupedEntries = groups.get(entry.dateKey) ?? [];
    groupedEntries.push(entry);
    groups.set(entry.dateKey, groupedEntries);
  });

  return Array.from(groups.entries())
    .sort(([leftDateKey], [rightDateKey]) => rightDateKey.localeCompare(leftDateKey))
    .map(([dateKey, groupedEntries]) => ({
      dateKey,
      label: formatNowInEnglishDateLabel(dateKey),
      entries: groupedEntries
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }));
}
