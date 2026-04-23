import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import MobileScreenHeader from "@/components/mobile-screen-header";
import { getDiaryEntries } from "@/lib/api";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type { DiaryEntry } from "@/lib/types";

type DiaryCalendarCell = {
  key: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEntries: boolean;
  isFuture: boolean;
};

const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function formatDateKey(date: Date) {
  const parts = SEOUL_DATE_FORMATTER.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function todayDateKey() {
  return formatDateKey(new Date());
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day, 12);
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
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function formatDateHeading(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function getEntryDateKey(entry: DiaryEntry) {
  return entry.entryDate || formatDateKey(new Date(entry.createdAt));
}

function getPreview(entry: DiaryEntry) {
  const latestAttempt = entry.attempts?.[entry.attempts.length - 1];
  const text = latestAttempt?.diaryText || entry.content || "";
  return text.trim().replace(/\s+/g, " ").slice(0, 120);
}

function getAttemptLabel(entry: DiaryEntry) {
  const count = entry.attempts?.length ?? 0;
  if (count <= 0) {
    return "초안";
  }
  return `${count}번 피드백`;
}

function buildMonthCalendar(
  visibleMonth: Date,
  entryDateKeys: Set<string>,
  selectedDateKey: string,
  todayKey: string
): DiaryCalendarCell[] {
  const monthStart = getMonthStart(visibleMonth);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12);
  const calendarStart = addDays(monthStart, -monthStart.getDay());
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const cells: DiaryCalendarCell[] = [];

  for (
    let currentDate = new Date(calendarStart);
    currentDate <= calendarEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    const dateKey = formatDateKey(currentDate);
    cells.push({
      key: dateKey,
      day: currentDate.getDate(),
      isCurrentMonth: isSameMonth(currentDate, visibleMonth),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      hasEntries: entryDateKeys.has(dateKey),
      isFuture: dateKey > todayKey
    });
  }

  return cells;
}

export default function DiaryListScreen() {
  const { currentUser, isHydrating } = useSession();
  const insets = useSafeAreaInsets();
  const todayKey = useMemo(() => todayDateKey(), []);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(parseDateKey(todayKey)));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, DiaryEntry[]>();
    entries.forEach((entry) => {
      const dateKey = getEntryDateKey(entry);
      grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), entry]);
    });

    grouped.forEach((items, dateKey) => {
      grouped.set(
        dateKey,
        [...items].sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        )
      );
    });

    return grouped;
  }, [entries]);

  const entryDateKeys = useMemo(() => new Set(entriesByDate.keys()), [entriesByDate]);
  const selectedEntries = entriesByDate.get(selectedDateKey) ?? [];
  const todayEntries = entriesByDate.get(todayKey) ?? [];
  const monthCalendar = useMemo(
    () => buildMonthCalendar(visibleMonth, entryDateKeys, selectedDateKey, todayKey),
    [entryDateKeys, selectedDateKey, todayKey, visibleMonth]
  );
  const canGoToNextMonth = useMemo(
    () => !isSameMonth(visibleMonth, getMonthStart(parseDateKey(todayKey))),
    [todayKey, visibleMonth]
  );

  const loadEntries = useCallback(async () => {
    if (!currentUser) {
      setEntries([]);
      setError("");
      setIsLoading(false);
      return;
    }

    try {
      setError("");
      const nextEntries = await getDiaryEntries();
      setEntries(nextEntries);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "영어일기 기록을 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    setIsLoading(true);
    void loadEntries();
  }, [loadEntries]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadEntries();
    setIsRefreshing(false);
  }

  function handleChangeMonth(direction: -1 | 1) {
    setVisibleMonth((current) => getMonthStart(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)));
  }

  function handleSelectDate(dateKey: string) {
    if (dateKey > todayKey) {
      return;
    }

    setSelectedDateKey(dateKey);
    setVisibleMonth(getMonthStart(parseDateKey(dateKey)));
  }

  function handleOpenEntry(entry: DiaryEntry) {
    router.push({
      pathname: "/diary/[entryId]",
      params: { entryId: entry.entryId }
    });
  }

  function handleWriteToday() {
    const existingTodayEntry = todayEntries[0];
    if (existingTodayEntry) {
      handleOpenEntry(existingTodayEntry);
      return;
    }

    router.push("/diary/write");
  }

  if (isHydrating || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loadingState}>
          <ActivityIndicator color="#E38B12" />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loginGate}>
          <Text style={styles.loginTitle}>로그인이 필요해요</Text>
          <Text style={styles.loginBody}>저장한 영어일기 기록은 로그인 후 확인할 수 있어요.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push(buildLoginHref("/diary"))}>
            <Text style={styles.primaryButtonText}>로그인하기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 112 + MOBILE_NAV_BOTTOM_SPACING + Math.max(insets.bottom, 0) }
          ]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <MobileScreenHeader title="영어일기" />

          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Pressable style={styles.monthButton} onPress={() => handleChangeMonth(-1)}>
                <Text style={styles.monthButtonText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{formatMonthLabel(visibleMonth)}</Text>
              <Pressable
                style={[styles.monthButton, !canGoToNextMonth && styles.monthButtonDisabled]}
                onPress={() => handleChangeMonth(1)}
                disabled={!canGoToNextMonth}
              >
                <Text
                  style={[
                    styles.monthButtonText,
                    !canGoToNextMonth && styles.monthButtonTextDisabled
                  ]}
                >
                  {">"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {WEEK_LABELS.map((label) => (
                <Text key={label} style={styles.weekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthCalendar.map((cell) => (
                <View key={cell.key} style={styles.calendarCellWrap}>
                  <Pressable
                    style={[
                      styles.calendarCell,
                      cell.hasEntries && styles.calendarCellHasEntries,
                      cell.isToday && styles.calendarCellToday,
                      cell.isSelected && styles.calendarCellSelected,
                      !cell.isCurrentMonth && styles.calendarCellOutside,
                      cell.isFuture && styles.calendarCellFuture
                    ]}
                    onPress={() => handleSelectDate(cell.key)}
                    disabled={cell.isFuture}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.key} 일기 보기`}
                  >
                    <Text
                      style={[
                        styles.calendarCellText,
                        cell.hasEntries && styles.calendarCellTextHasEntries,
                        cell.isToday && styles.calendarCellTextToday,
                        cell.isSelected && styles.calendarCellTextSelected,
                        !cell.isCurrentMonth && styles.calendarCellTextOutside,
                        cell.isFuture && styles.calendarCellTextFuture
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {cell.hasEntries ? <View style={styles.calendarDot} /> : null}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.selectedDateSection}>
            <View style={styles.selectedDateHeader}>
              <View>
                <Text style={styles.selectedDateTitle}>{formatDateHeading(selectedDateKey)}</Text>
                <Text style={styles.selectedDateMeta}>
                  {selectedEntries.length > 0
                    ? `${selectedEntries.length}개의 일기가 있어요`
                    : selectedDateKey === todayKey
                      ? "오늘 아직 남긴 일기가 없어요"
                      : "이날 작성한 일기가 없어요"}
                </Text>
              </View>
              {selectedDateKey === todayKey ? (
                <Text style={styles.todayBadge}>오늘</Text>
              ) : null}
            </View>

            {selectedEntries.length > 0 ? (
              <View style={styles.entryList}>
                {selectedEntries.map((entry) => (
                  <Pressable
                    key={entry.entryId}
                    style={styles.entryCard}
                    onPress={() => handleOpenEntry(entry)}
                    accessibilityRole="button"
                    accessibilityLabel="영어일기 열기"
                  >
                    <View style={styles.entryHeader}>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryBadge}>{getAttemptLabel(entry)}</Text>
                        {entry.mood ? <Text style={styles.entryBadge}>{entry.mood}</Text> : null}
                      </View>
                      <Text style={styles.entryArrow}>{">"}</Text>
                    </View>
                    <Text style={styles.entryTitle}>{entry.title?.trim() || "Untitled diary"}</Text>
                    {getPreview(entry) ? <Text style={styles.entryPreview}>{getPreview(entry)}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {selectedDateKey === todayKey ? "오늘의 일기를 기다리고 있어요" : "비어 있는 날짜예요"}
                </Text>
                <Text style={styles.emptyBody}>
                  {selectedDateKey === todayKey
                    ? "하단 버튼을 눌러 오늘 하루를 영어로 짧게 남겨보세요."
                    : "이 날짜에는 저장된 영어일기가 없어요."}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { bottom: MOBILE_NAV_BOTTOM_SPACING, paddingBottom: 10 }]}>
          <Pressable style={styles.todayWriteButton} onPress={handleWriteToday}>
            <Text style={styles.todayWriteButtonText}>
              {todayEntries.length > 0 ? "오늘 일기 이어보기" : "오늘의 일기 쓰기"}
            </Text>
          </Pressable>
        </View>
        <MobileNavBar activeTab="diary" />
      </View>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 18
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loginGate: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#232128"
  },
  loginBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#756758"
  },
  calendarCard: {
    borderRadius: 30,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  monthButtonDisabled: {
    opacity: 0.35
  },
  monthButtonText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  monthButtonTextDisabled: {
    color: "#BFAE9D"
  },
  monthTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2A2521"
  },
  weekHeader: {
    flexDirection: "row"
  },
  weekLabel: {
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
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  calendarCellOutside: {
    opacity: 0.45
  },
  calendarCellFuture: {
    opacity: 0.25
  },
  calendarCellHasEntries: {
    backgroundColor: "#FFF0D7"
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  calendarCellSelected: {
    backgroundColor: "#F2A14A"
  },
  calendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  calendarCellTextOutside: {
    color: "#B4A392"
  },
  calendarCellTextFuture: {
    color: "#C4B8AC"
  },
  calendarCellTextHasEntries: {
    color: "#8A5A1E"
  },
  calendarCellTextToday: {
    color: "#2E2416"
  },
  calendarCellTextSelected: {
    color: "#21160A"
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#A76518"
  },
  errorText: {
    fontSize: 14,
    color: "#B34A2B"
  },
  selectedDateSection: {
    gap: 12
  },
  selectedDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  selectedDateTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#25211E"
  },
  selectedDateMeta: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "800",
    color: "#8A7867"
  },
  todayBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    borderWidth: 1,
    borderColor: "#F1D2A5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: "900",
    color: "#A15F10"
  },
  emptyCard: {
    borderRadius: 28,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 22,
    gap: 10
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#25211E"
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#756758"
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 22,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#21160A"
  },
  entryList: {
    gap: 12
  },
  entryCard: {
    borderRadius: 26,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 10
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  entryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1
  },
  entryBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "900",
    color: "#A15F10"
  },
  entryArrow: {
    fontSize: 18,
    fontWeight: "900",
    color: "#A15F10"
  },
  entryTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    color: "#25211E"
  },
  entryPreview: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6F5E4D"
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: "rgba(247, 242, 235, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "#EADCCB"
  },
  todayWriteButton: {
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D88416",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  todayWriteButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#21160A"
  }
});
