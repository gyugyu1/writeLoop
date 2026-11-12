import { useCallback, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, ScrollView } from "react-native";
import type { HistorySession } from "@/lib/types";

// 기록 화면의 고른 날짜로 스크롤: 스크롤 ref, 날짜 묶음 위치 기록, 날짜가 바뀌면 다시 스크롤할 수 있게(E7),
// 열린 고른 날짜로 스크롤(E8), 작문 기록 판·날짜 목록·날짜 묶음 onLayout 처리.
// 날짜 묶음의 onLayout y는 날짜 목록 안의 위치라, 작문 기록 판과 날짜 목록의 위치를 더해 스크롤 내용 전체의 위치로 쓴다.
// 스크롤 예약은 아래 효과 한 곳에서만 하므로 고른 날짜 하나에 한 번만 스크롤한다.
export function useRecordsDateScroll({
  groupedHistoryEntries,
  openDates,
  renderedDateKeys,
  selectedDateKey
}: {
  groupedHistoryEntries: { dateKey: string; sessions: HistorySession[] }[];
  openDates: Record<string, boolean>;
  // 지금 화면에 그려진 날짜 묶음(작문 기록 탭이 아니거나 불러오는 중이면 빈 목록).
  renderedDateKeys: string[];
  selectedDateKey: string;
}) {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const dateGroupOffsetsRef = useRef<Record<string, number>>({});
  const historyBoardOffsetRef = useRef(0);
  const dateFeedOffsetRef = useRef(0);
  const lastScrolledDateRef = useRef("");
  // 고른 날짜의 위치를 알게 되거나 바뀌면 늘려 스크롤 효과를 다시 돌린다.
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    lastScrolledDateRef.current = "";
  }, [selectedDateKey]);

  // 화면에서 빠진 날짜 묶음(목록에서 없어짐, 모두 보기를 접음, 다른 탭, 불러오는 중)의 옛 위치는 지운다.
  // 다시 그려지면 onLayout이 새 위치를 알린다.
  const renderedDateKeysValue = renderedDateKeys.join("|");
  useEffect(() => {
    const rendered = new Set(renderedDateKeysValue ? renderedDateKeysValue.split("|") : []);
    for (const dateKey of Object.keys(dateGroupOffsetsRef.current)) {
      if (!rendered.has(dateKey)) {
        delete dateGroupOffsetsRef.current[dateKey];
      }
    }
  }, [renderedDateKeysValue]);

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

    const groupOffset = dateGroupOffsetsRef.current[selectedDateKey];
    if (typeof groupOffset !== "number" || lastScrolledDateRef.current === selectedDateKey) {
      return;
    }

    const targetOffset = historyBoardOffsetRef.current + dateFeedOffsetRef.current + groupOffset;
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
  }, [groupedHistoryEntries, layoutVersion, openDates, selectedDateKey]);

  const handleDateGroupLayout = useCallback(
    (dateKey: string, event: LayoutChangeEvent) => {
      const nextOffset = event.nativeEvent.layout.y;
      if (dateGroupOffsetsRef.current[dateKey] === nextOffset) {
        return;
      }
      dateGroupOffsetsRef.current[dateKey] = nextOffset;
      if (dateKey === selectedDateKey) {
        setLayoutVersion((current) => current + 1);
      }
    },
    [selectedDateKey]
  );

  const handleHistoryBoardLayout = useCallback((event: LayoutChangeEvent) => {
    const nextOffset = event.nativeEvent.layout.y;
    if (historyBoardOffsetRef.current === nextOffset) {
      return;
    }
    historyBoardOffsetRef.current = nextOffset;
    setLayoutVersion((current) => current + 1);
  }, []);

  const handleDateFeedLayout = useCallback((event: LayoutChangeEvent) => {
    const nextOffset = event.nativeEvent.layout.y;
    if (dateFeedOffsetRef.current === nextOffset) {
      return;
    }
    dateFeedOffsetRef.current = nextOffset;
    setLayoutVersion((current) => current + 1);
  }, []);

  return {
    handleDateFeedLayout,
    handleDateGroupLayout,
    handleHistoryBoardLayout,
    scrollViewRef
  };
}
