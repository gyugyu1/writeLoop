import { useMemo, useState, type RefObject } from "react";
import { TextInput } from "react-native";
import {
  HISTORY_FILTERS,
  type NowInEnglishHistoryFilter,
  parseNowInEnglishDateKey,
  getCalendarMonthStart,
  buildNowInEnglishMonthCalendar,
  buildEntryGroups
} from "./now-helpers";
import {
  formatNowInEnglishDateLabel,
  buildNowInEnglishEntrySignature,
  getNowInEnglishDateKey,
  getNowInEnglishRelativeDateKey,
  type NowInEnglishEntry
} from "@/lib/now-in-english";

// Now in English 화면의 기록 보기: 보기 탭·고른 날짜, 돌아보기 날짜와 그 날짜 기록, 월 달력 창, 타임라인 묶음과
// 제목·개수·빈 상태 문구, 탭·달력·오늘 쓰러 가기 처리. 효과가 없다.
export function useNowHistoryView({
  entries,
  inputRef
}: {
  entries: NowInEnglishEntry[];
  inputRef: RefObject<TextInput | null>;
}) {
  const [historyFilter, setHistoryFilter] = useState<NowInEnglishHistoryFilter>("today");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getCalendarMonthStart(new Date()));

  const todayKey = getNowInEnglishDateKey();
  const yesterdayKey = getNowInEnglishRelativeDateKey(-1);
  const reflectionDateKey =
    historyFilter === "today"
      ? todayKey
      : historyFilter === "yesterday"
        ? yesterdayKey
        : historyFilter === "selected" && selectedDateKey
          ? selectedDateKey
          : null;
  const reflectionDateLabel = reflectionDateKey
    ? reflectionDateKey === todayKey
      ? "오늘"
      : reflectionDateKey === yesterdayKey
        ? "어제"
        : formatNowInEnglishDateLabel(reflectionDateKey)
    : "";
  const entryCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      counts.set(entry.dateKey, (counts.get(entry.dateKey) ?? 0) + 1);
    });
    return counts;
  }, [entries]);
  const calendarCells = useMemo(
    () => buildNowInEnglishMonthCalendar(calendarMonthCursor, entryCountsByDate, selectedDateKey, todayKey),
    [calendarMonthCursor, entryCountsByDate, selectedDateKey, todayKey]
  );
  const yesterdayEntries = useMemo(
    () =>
      reflectionDateKey
        ? entries
            .filter((entry) => entry.dateKey === reflectionDateKey)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        : [],
    [entries, reflectionDateKey]
  );
  const yesterdayEntrySignature = useMemo(
    () => buildNowInEnglishEntrySignature(yesterdayEntries),
    [yesterdayEntries]
  );
  const filteredEntries = useMemo(() => {
    if (historyFilter === "today") {
      return entries.filter((entry) => entry.dateKey === todayKey);
    }
    if (historyFilter === "yesterday") {
      return entries.filter((entry) => entry.dateKey === yesterdayKey);
    }
    if (historyFilter === "selected" && selectedDateKey) {
      return entries.filter((entry) => entry.dateKey === selectedDateKey);
    }

    return entries;
  }, [entries, historyFilter, selectedDateKey, todayKey, yesterdayKey]);
  const entryGroups = useMemo(() => buildEntryGroups(filteredEntries), [filteredEntries]);
  const historyMeta = useMemo(() => {
    if (historyFilter === "all") {
      return `총 ${entries.length}개의 영어 조각`;
    }

    return `${filteredEntries.length}개를 남겼어요`;
  }, [entries.length, filteredEntries.length, historyFilter]);
  const historyTitle = useMemo(() => {
    if (historyFilter === "yesterday") {
      return "어제 남긴 문장";
    }
    if (historyFilter === "selected" && selectedDateKey) {
      return formatNowInEnglishDateLabel(selectedDateKey);
    }
    if (historyFilter === "all") {
      return "영어 조각 기록";
    }

    return "오늘 남긴 문장";
  }, [historyFilter, selectedDateKey]);
  const emptyTimelineCopy = useMemo(() => {
    if (historyFilter === "yesterday") {
      return {
        title: "어제 남긴 문장이 없어요.",
        body: "괜찮아요. 오늘 지금 떠오른 생각부터 다시 한 줄로 꺼내 보면 돼요."
      };
    }
    if (historyFilter === "selected") {
      return {
        title: "이 날짜에는 남긴 문장이 없어요.",
        body: "달력에서 다른 날짜를 골라보거나, 오늘의 한 줄을 새로 남겨보세요."
      };
    }
    if (historyFilter === "all") {
      return {
        title: "아직 쌓인 영어 조각이 없어요.",
        body: "완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요."
      };
    }

    return {
      title: "오늘의 첫 영어 조각을 남겨보세요.",
      body: "완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요."
    };
  }, [historyFilter]);

  function handleSelectHistoryFilter(nextFilter: (typeof HISTORY_FILTERS)[number]["key"]) {
    setHistoryFilter(nextFilter);
    setSelectedDateKey(null);
  }

  function handleOpenCalendar() {
    const baseDate = selectedDateKey ? parseNowInEnglishDateKey(selectedDateKey) : new Date();
    setCalendarMonthCursor(getCalendarMonthStart(baseDate));
    setIsCalendarOpen(true);
  }

  function handleSelectCalendarDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setHistoryFilter("selected");
    setIsCalendarOpen(false);
  }

  function handleWriteTodayFromReflection() {
    setHistoryFilter("today");
    setSelectedDateKey(null);
    inputRef.current?.focus();
  }

  return {
    calendarCells,
    calendarMonthCursor,
    emptyTimelineCopy,
    entryGroups,
    handleOpenCalendar,
    handleSelectCalendarDate,
    handleSelectHistoryFilter,
    handleWriteTodayFromReflection,
    historyFilter,
    historyMeta,
    historyTitle,
    isCalendarOpen,
    reflectionDateKey,
    reflectionDateLabel,
    setCalendarMonthCursor,
    setIsCalendarOpen,
    yesterdayEntries,
    yesterdayEntrySignature
  };
}
