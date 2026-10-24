// 홈 화면의 이번 주 기록 줄과 월 달력을 만드는 날짜 계산.
import type { CSSProperties } from "react";
import type { HistoryMonthStatus, TodayWritingStatus } from "./types";

export function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function buildWelcomeWeek(todayStatus: TodayWritingStatus | null, completedDateKeys: string[]) {
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

export type MonthCalendarCell = {
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

export type MonthView = {
  year: number;
  month: number;
};

export function buildMonthCalendar(
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

export function createMonthView(date: Date): MonthView {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

export function addMonthsToView(view: MonthView, delta: number): MonthView {
  const date = new Date(view.year, view.month - 1 + delta, 1);
  return createMonthView(date);
}

export function isSameMonthView(left: MonthView, right: MonthView) {
  return left.year === right.year && left.month === right.month;
}

export function getMonthStatusDayStyle(cell: MonthCalendarCell): CSSProperties | undefined {
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
