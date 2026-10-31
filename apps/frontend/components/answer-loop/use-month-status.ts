"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMonthStatus } from "../../lib/api";
import type { AuthUser, HistoryMonthStatus, TodayWritingStatus } from "../../lib/types";
import {
  addMonthsToView,
  buildMonthCalendar,
  createMonthView,
  isSameMonthView,
  parseLocalDate,
  type MonthView
} from "../../lib/writing-calendar";

// 웹 주 화면의 월 학습 현황(전체 이력 달력) 모달 상태.
// 열고 닫기, 보는 달, 그 달 기록 불러오기, 열린 동안의 Escape·스크롤 잠금·포커스 처리를 맡는다.
export function useMonthStatus(currentUser: AuthUser | null, todayStatus: TodayWritingStatus | null) {
  const [showMonthStatus, setShowMonthStatus] = useState(false);
  const [monthView, setMonthView] = useState<MonthView | null>(null);
  const [monthStatus, setMonthStatus] = useState<HistoryMonthStatus | null>(null);
  const [isLoadingMonthStatus, setIsLoadingMonthStatus] = useState(false);
  const [monthStatusError, setMonthStatusError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentMonthView = useMemo(
    () => createMonthView(todayStatus?.date ? parseLocalDate(todayStatus.date) : new Date()),
    [todayStatus?.date]
  );
  const activeMonthView = monthView ?? currentMonthView;
  const isCurrentMonthView = isSameMonthView(activeMonthView, currentMonthView);
  const monthCalendar = buildMonthCalendar(monthStatus, activeMonthView, todayStatus?.date);

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
      closeButtonRef.current?.focus();
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

  function open() {
    setMonthView(currentMonthView);
    setShowMonthStatus(true);
  }

  function close() {
    setShowMonthStatus(false);
  }

  function moveMonth(delta: number) {
    setMonthView((current) => addMonthsToView(current ?? currentMonthView, delta));
  }

  return {
    isOpen: showMonthStatus,
    isVisible: showMonthStatus && Boolean(currentUser),
    isLoading: isLoadingMonthStatus,
    error: monthStatusError,
    calendar: monthCalendar,
    isCurrentMonth: isCurrentMonthView,
    // 불러오는 동안은 그 달 기록이 없으니 오늘 상태의 연속 학습일을 보여 준다.
    streakDays: isLoadingMonthStatus ? todayStatus?.streakDays ?? 0 : monthCalendar.streakDays,
    closeButtonRef,
    open,
    close,
    moveMonth
  };
}

export type MonthStatusState = ReturnType<typeof useMonthStatus>;
