import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  parseHistoryDateKeyAsDate,
  getCalendarMonthStart,
  isSameCalendarMonth,
  buildRecordsMonthCalendar
} from "./records-helpers";
import type { HistorySession } from "@/lib/types";

// 기록 화면의 월 달력: 창 열림, 보는 달, 기록 있는 날짜와 이동 가능한 범위, 열기·닫기·날짜 고르기. 효과가 없다.
export function useRecordsMonthCalendar({
  groupedHistoryEntries,
  selectedDateKey,
  setOpenDates,
  setSelectedDateKey
}: {
  groupedHistoryEntries: { dateKey: string; sessions: HistorySession[] }[];
  selectedDateKey: string;
  setOpenDates: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSelectedDateKey: Dispatch<SetStateAction<string>>;
}) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() =>
    getCalendarMonthStart(new Date())
  );

  const recordDateKeySet = useMemo(() => {
    const next = new Set<string>();
    groupedHistoryEntries.forEach((entry) => next.add(entry.dateKey));
    return next;
  }, [groupedHistoryEntries]);
  const latestRecordMonth = useMemo(
    () =>
      groupedHistoryEntries.length > 0
        ? getCalendarMonthStart(parseHistoryDateKeyAsDate(groupedHistoryEntries[0].dateKey))
        : getCalendarMonthStart(new Date()),
    [groupedHistoryEntries]
  );
  const earliestRecordMonth = useMemo(
    () =>
      groupedHistoryEntries.length > 0
        ? getCalendarMonthStart(
            parseHistoryDateKeyAsDate(
              groupedHistoryEntries[groupedHistoryEntries.length - 1].dateKey
            )
          )
        : getCalendarMonthStart(new Date()),
    [groupedHistoryEntries]
  );
  const monthCalendar = useMemo(
    () => buildRecordsMonthCalendar(recordDateKeySet, calendarMonthCursor, selectedDateKey),
    [calendarMonthCursor, recordDateKeySet, selectedDateKey]
  );
  const canGoToPreviousCalendarMonth = useMemo(
    () => !isSameCalendarMonth(calendarMonthCursor, earliestRecordMonth),
    [calendarMonthCursor, earliestRecordMonth]
  );
  const canGoToNextCalendarMonth = useMemo(
    () => !isSameCalendarMonth(calendarMonthCursor, latestRecordMonth),
    [calendarMonthCursor, latestRecordMonth]
  );

  function handleOpenCalendar() {
    const baseDate =
      selectedDateKey && recordDateKeySet.has(selectedDateKey)
        ? parseHistoryDateKeyAsDate(selectedDateKey)
        : groupedHistoryEntries.length > 0
          ? parseHistoryDateKeyAsDate(groupedHistoryEntries[0].dateKey)
          : new Date();
    setCalendarMonthCursor(getCalendarMonthStart(baseDate));
    setIsCalendarOpen(true);
  }

  function handleCloseCalendar() {
    setIsCalendarOpen(false);
  }

  function handleSelectCalendarDate(dateKey: string) {
    if (!recordDateKeySet.has(dateKey)) {
      return;
    }

    setSelectedDateKey(dateKey);
    setOpenDates((current) => ({
      ...current,
      [dateKey]: true
    }));
    setIsCalendarOpen(false);
  }

  return {
    canGoToNextCalendarMonth,
    canGoToPreviousCalendarMonth,
    handleCloseCalendar,
    handleOpenCalendar,
    handleSelectCalendarDate,
    isCalendarOpen,
    monthCalendar,
    setCalendarMonthCursor
  };
}
