import { useCallback, useEffect, useRef } from "react";
import { type LayoutChangeEvent, ScrollView } from "react-native";
import type { HistorySession } from "@/lib/types";

// 기록 화면의 고른 날짜로 스크롤: 스크롤 ref, 날짜 묶음 위치 기록, 날짜가 바뀌면 다시 스크롤할 수 있게(E7),
// 열린 고른 날짜로 스크롤(E8), 날짜 묶음 onLayout 처리.
export function useRecordsDateScroll({
  groupedHistoryEntries,
  openDates,
  selectedDateKey
}: {
  groupedHistoryEntries: { dateKey: string; sessions: HistorySession[] }[];
  openDates: Record<string, boolean>;
  selectedDateKey: string;
}) {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const dateGroupOffsetsRef = useRef<Record<string, number>>({});
  const lastScrolledDateRef = useRef("");

  useEffect(() => {
    lastScrolledDateRef.current = "";
  }, [selectedDateKey]);

  useEffect(() => {
    if (!selectedDateKey) {
      return;
    }

    if (!groupedHistoryEntries.some((entry) => entry.dateKey === selectedDateKey)) {
      return;
    }

    if (!(openDates[selectedDateKey] ?? false)) {
      return;
    }

    const targetOffset = dateGroupOffsetsRef.current[selectedDateKey];
    if (typeof targetOffset !== "number" || lastScrolledDateRef.current === selectedDateKey) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(targetOffset - 12, 0),
        animated: true
      });
      lastScrolledDateRef.current = selectedDateKey;
    }, 80);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [groupedHistoryEntries, openDates, selectedDateKey]);

  const handleDateGroupLayout = useCallback(
    (dateKey: string, event: LayoutChangeEvent) => {
      const nextOffset = event.nativeEvent.layout.y;
      dateGroupOffsetsRef.current[dateKey] = nextOffset;

      if (dateKey !== selectedDateKey || !(openDates[dateKey] ?? false)) {
        return;
      }

      if (lastScrolledDateRef.current === selectedDateKey) {
        return;
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(nextOffset - 12, 0),
          animated: true
        });
        lastScrolledDateRef.current = selectedDateKey;
      }, 80);
    },
    [openDates, selectedDateKey]
  );

  return {
    handleDateGroupLayout,
    scrollViewRef
  };
}
