import { router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { getMonthWritingStatus } from "@/lib/api";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type { DiaryCalendarSummary, TodayWritingStatus } from "@/lib/types";
import {
  parseStatusDate,
  getMonthStart,
  isSameMonth,
  buildFallbackCompletedDateKeys,
  buildMonthCalendar
} from "./home-helpers";

// 홈 화면의 월 달력 창: 보는 달, 그 달 완료일 불러오기(효과 ⑩), 요약 문구, 달 이동, 날짜를 눌렀을 때 이동.
// 창이 열렸는지(isCalendarOpen)는 튜토리얼도 보므로 화면에 두고 받는다. 튜토리얼 훅 뒤에서 부른다.
export function useHomeMonthCalendar({
  currentUser,
  diaryDaysByDate,
  isCalendarOpen,
  setIsCalendarOpen,
  todayStatus
}: {
  currentUser: ReturnType<typeof useSession>["currentUser"];
  diaryDaysByDate: Map<string, DiaryCalendarSummary["days"][number]>;
  isCalendarOpen: boolean;
  setIsCalendarOpen: Dispatch<SetStateAction<boolean>>;
  todayStatus: TodayWritingStatus | null;
}) {
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getMonthStart(new Date()));
  const [calendarCompletedDateKeys, setCalendarCompletedDateKeys] = useState<string[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
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

  const handleOpenCalendar = useCallback(() => {
    setCalendarMonthCursor(calendarReferenceMonth);
    setIsCalendarOpen(true);
  }, [calendarReferenceMonth, setIsCalendarOpen]);

  const handleCloseCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, [setIsCalendarOpen]);

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
    [currentUser, diaryDaysByDate, setIsCalendarOpen]
  );

  return {
    calendarError,
    calendarFooterLabel,
    calendarSummaryText,
    canGoToNextCalendarMonth,
    handleChangeCalendarMonth,
    handleCloseCalendar,
    handleOpenCalendar,
    handleOpenCalendarDate,
    isCalendarLoading,
    monthCalendar
  };
}
