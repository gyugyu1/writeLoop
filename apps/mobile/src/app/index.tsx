import { router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import { getAnswerHistory, getTodayWritingStatus, getWritingDraft } from "@/lib/api";
import { difficultyDeck } from "@/lib/difficulty";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
import type { DailyDifficulty, HistorySession, TodayWritingStatus } from "@/lib/types";

type WeekDayChip = {
  key: string;
  label: string;
  isToday: boolean;
  isCompleted: boolean;
};

type MonthCalendarCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isCompleted: boolean;
  isToday: boolean;
};

type MonthCalendarData = {
  monthLabel: string;
  streakDays: number;
  completedCount: number;
  isReferenceMonth: boolean;
  cells: MonthCalendarCell[];
};

type HomeGuideStep = {
  title: string;
  body: string;
};

type IncompleteLoopCopy = {
  title: string;
  body: string;
  ctaLabel: string;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const SEOUL_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const homeGuidePreviewImage = require("@/assets/images/tutorial-web.png");
const homeStatusMascotImage = require("@/assets/images/main-mascote.png");
const HOME_GUIDE_STEPS: HomeGuideStep[] = [
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

function formatWeekDay(date: Date) {
  return WEEKDAY_LABELS[date.getDay()] ?? "";
}

function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = SEOUL_DATE_KEY_FORMATTER.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function getIncompleteLoopCopy(step: IncompleteLoopState["step"]): IncompleteLoopCopy {
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

function getIncompleteLoopInlineTitle(step: IncompleteLoopState["step"]) {
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

function formatIncompleteLoopSavedAt(updatedAt: string) {
  const savedAt = new Date(updatedAt);
  if (Number.isNaN(savedAt.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit"
  }).format(savedAt);
}

function parseStatusDate(dateString?: string | null) {
  return dateString ? new Date(`${dateString}T12:00:00+09:00`) : new Date();
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
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getLatestHistoryTimestamp(session: HistorySession) {
  return session.attempts[session.attempts.length - 1]?.createdAt ?? session.updatedAt ?? session.createdAt;
}

function buildFallbackCompletedDateKeys(todayStatus: TodayWritingStatus | null) {
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

function buildMonthCalendar(
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

function buildWeekChips(todayStatus: TodayWritingStatus | null): WeekDayChip[] {
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

export default function HomeScreen() {
  const { currentUser, refreshSession } = useSession();
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [incompleteLoop, setIncompleteLoop] = useState<IncompleteLoopState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => getMonthStart(new Date()));
  const [calendarCompletedDateKeys, setCalendarCompletedDateKeys] = useState<string[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const historyRoute: Href = currentUser ? "/records" : buildLoginHref("/records");

  const weekChips = useMemo(() => buildWeekChips(todayStatus), [todayStatus]);
  const incompleteLoopCopy = useMemo(
    () => (incompleteLoop ? getIncompleteLoopCopy(incompleteLoop.step) : null),
    [incompleteLoop]
  );
  const incompleteLoopSavedAt = useMemo(
    () => (incompleteLoop ? formatIncompleteLoopSavedAt(incompleteLoop.updatedAt) : ""),
    [incompleteLoop]
  );
  const incompleteLoopInlineNote = useMemo(() => {
    if (!incompleteLoop) {
      return "";
    }

    return [getIncompleteLoopInlineTitle(incompleteLoop.step), incompleteLoopSavedAt]
      .filter(Boolean)
      .join(" · ");
  }, [incompleteLoop, incompleteLoopSavedAt]);
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
  const calendarSummaryLabel = useMemo(() => {
    if (monthCalendar.streakDays > 1) {
      return `현재 ${monthCalendar.streakDays}일 연속 학습 중`;
    }

    if (todayStatus?.completed) {
      return "오늘도 학습 기록이 쌓였어요";
    }

    return "이번 달 학습 기록";
  }, [monthCalendar.streakDays, todayStatus?.completed]);
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
  const incompleteLoopRoute = useMemo<Href | null>(() => {
    if (!incompleteLoop) {
      return null;
    }

    if (incompleteLoop.step === "feedback") {
      return {
        pathname: "/practice/feedback",
        params: {
          difficulty: incompleteLoop.difficulty,
          promptId: incompleteLoop.promptId
        }
      };
    }

    if (incompleteLoop.step === "rewrite") {
      return {
        pathname: "/practice/write",
        params: {
          difficulty: incompleteLoop.difficulty,
          promptId: incompleteLoop.promptId,
          mode: "rewrite"
        }
      };
    }

    return {
      pathname: "/practice/write",
      params: {
        difficulty: incompleteLoop.difficulty,
        promptId: incompleteLoop.promptId
      }
    };
  }, [incompleteLoop]);

  const loadTodayStatus = useCallback(async () => {
    try {
      setStatusError("");
      setTodayStatus(await getTodayWritingStatus());
    } catch (caughtError) {
      setStatusError(
        caughtError instanceof Error ? caughtError.message : "학습 일지를 불러오지 못했어요."
      );
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setTodayStatus(null);
      setStatusError("");
      return;
    }

    void loadTodayStatus();
  }, [currentUser, loadTodayStatus]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadIncompleteLoop = async () => {
        const nextLoop = await getIncompleteLoop();
        if (!nextLoop) {
          if (!cancelled) {
            setIncompleteLoop(null);
          }
          return;
        }

        if (nextLoop.step === "feedback") {
          const feedbackState = await hydratePracticeFeedbackState(nextLoop.difficulty, nextLoop.promptId);
          if (!feedbackState) {
            await clearIncompleteLoop();
            if (!cancelled) {
              setIncompleteLoop(null);
            }
            return;
          }
        } else {
          const draftType = nextLoop.draftType ?? (nextLoop.step === "rewrite" ? "REWRITE" : "ANSWER");
          const localDraft = await getLocalWritingDraft(nextLoop.promptId, draftType);

          if (currentUser) {
            try {
              const serverDraft = await getWritingDraft(nextLoop.promptId, draftType);
              if (!localDraft && !serverDraft) {
                await clearIncompleteLoop();
                if (!cancelled) {
                  setIncompleteLoop(null);
                }
                return;
              }
            } catch {
              // Keep the card when the server check fails temporarily.
            }
          } else if (!localDraft) {
            await clearIncompleteLoop();
            if (!cancelled) {
              setIncompleteLoop(null);
            }
            return;
          }
        }

        if (!cancelled) {
          setIncompleteLoop(nextLoop);
        }
      };

      void loadIncompleteLoop();

      return () => {
        cancelled = true;
      };
    }, [currentUser])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const user = await refreshSession();
    if (user) {
      await loadTodayStatus();
    } else {
      setTodayStatus(null);
      setStatusError("");
    }
    setIsRefreshing(false);
  }, [loadTodayStatus, refreshSession]);

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

    const loadCalendarHistory = async () => {
      try {
        setIsCalendarLoading(true);
        setCalendarError("");
        const history = await getAnswerHistory();
        if (cancelled) {
          return;
        }

        const nextKeys = Array.from(
          new Set(history.map((session) => toDateKey(getLatestHistoryTimestamp(session))))
        );
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

    void loadCalendarHistory();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isCalendarOpen]);

  const handleStart = useCallback((difficulty: DailyDifficulty) => {
    router.push({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty
      }
    });
  }, []);

  const handleOpenCalendar = useCallback(() => {
    setCalendarMonthCursor(calendarReferenceMonth);
    setIsCalendarOpen(true);
  }, [calendarReferenceMonth]);

  const handleCloseCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, []);

  const handleChangeCalendarMonth = useCallback((direction: -1 | 1) => {
    setCalendarMonthCursor((current) => getMonthStart(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)));
  }, []);

  const handleOpenHistoryDate = useCallback(
    (dateKey: string) => {
      setIsCalendarOpen(false);
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
    [currentUser]
  );

  const handleResumeLoop = useCallback(() => {
    if (!incompleteLoopRoute) {
      return;
    }

    router.push(incompleteLoopRoute);
  }, [incompleteLoopRoute]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.heroTitle}>난이도 선택</Text>
              <View style={styles.heroUnderline} />
            </View>
            <Pressable style={styles.guideButton} onPress={() => setIsGuideOpen(true)}>
              <Text style={styles.guideButtonText}>가이드 보기</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statusPanel}>
          <Pressable style={styles.statusPanelMain} onPress={() => router.push(historyRoute)}>
          <View style={styles.statusLead}>
            <View style={styles.statusIconCircle}>
              <Image source={homeStatusMascotImage} style={styles.statusMascotImage} />
            </View>
            <View style={styles.statusCopy}>
              <View style={styles.statusTopRow}>
                <Text style={styles.statusTitle}>학습 일지</Text>
              </View>
              <Text style={styles.statusDescription}>
                {currentUser
                  ? `현재 ${todayStatus?.streakDays ?? 0}일 연속으로 문장을 차분하게 쌓아가고 있어요.`
                  : "부담 없이 첫 루프를 시작하고 오늘의 작문 감각을 깨워 보세요."}
              </Text>
              {currentUser ? (
                <Text style={styles.statusMeta}>
                  총 {(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성
                </Text>
              ) : null}
              {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
            </View>
          </View>

          </Pressable>

          <Pressable style={styles.weekRowButton} onPress={handleOpenCalendar}>
          <View style={styles.weekRow}>
            {weekChips.map((chip) => (
              <View
                key={chip.key}
                style={[
                  styles.weekChip,
                  chip.isCompleted && styles.weekChipDone,
                  chip.isToday && styles.weekChipToday
                ]}
              >
                <Text
                  style={[
                    styles.weekChipText,
                    chip.isCompleted && styles.weekChipTextDone,
                    chip.isToday && styles.weekChipTextToday
                  ]}
                >
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
          </Pressable>

        {incompleteLoop && incompleteLoopCopy ? (
          <Pressable style={styles.statusResumeSection} onPress={handleResumeLoop}>
            <Text style={styles.resumeActionText}>{`${incompleteLoopCopy.ctaLabel} >`}</Text>
            <Text style={styles.resumeMeta}>{incompleteLoopInlineNote}</Text>
          </Pressable>
        ) : null}
        </View>

        <View style={styles.difficultySectionHeader}>
          <View style={styles.difficultySectionTopRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.difficultySectionTitle}>난이도 선택</Text>
              <View style={styles.heroUnderline} />
            </View>
            <Pressable style={styles.guideButton} onPress={() => setIsGuideOpen(true)}>
              <Text style={styles.guideButtonText}>가이드 보기</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stageSection}>
          {difficultyDeck.map((item) => {
            return (
              <Pressable
                key={item.difficulty}
                style={styles.difficultyCard}
                onPress={() => handleStart(item.difficulty)}
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
        <MobileNavBar activeTab="home" />
      </View>

      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCalendar}
      >
        <View style={styles.calendarModalOverlay}>
          <Pressable style={styles.calendarModalBackdrop} onPress={handleCloseCalendar} />
          <SafeAreaView style={styles.calendarModalFrame} edges={["top", "bottom"]}>
            <View style={styles.calendarModalCard}>
              <View style={styles.calendarModalHeader}>
                <View style={styles.calendarModalHeaderCopy}>
                  <View style={styles.calendarMonthNavRow}>
                    <Pressable
                      style={styles.calendarMonthNavButton}
                      onPress={() => handleChangeCalendarMonth(-1)}
                    >
                      <Text style={styles.calendarMonthNavButtonText}>{"<"}</Text>
                    </Pressable>
                    <Text style={styles.calendarModalTitle}>{monthCalendar.monthLabel}</Text>
                    <Pressable
                      style={[
                        styles.calendarMonthNavButton,
                        !canGoToNextCalendarMonth && styles.calendarMonthNavButtonDisabled
                      ]}
                      onPress={() => handleChangeCalendarMonth(1)}
                      disabled={!canGoToNextCalendarMonth}
                    >
                      <Text
                        style={[
                          styles.calendarMonthNavButtonText,
                          !canGoToNextCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                        ]}
                      >
                        {">"}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.calendarModalSubtitle}>{calendarSummaryText}</Text>
                </View>
                <Pressable style={styles.calendarModalCloseButton} onPress={handleCloseCalendar}>
                  <Text style={styles.calendarModalCloseText}>닫기</Text>
                </Pressable>
              </View>

              {isCalendarLoading ? (
                <View style={styles.calendarLoadingRow}>
                  <ActivityIndicator color="#E38B12" />
                </View>
              ) : null}
              {calendarError ? <Text style={styles.calendarErrorText}>{calendarError}</Text> : null}

              <View style={styles.calendarWeekHeader}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.calendarWeekLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {monthCalendar.cells.map((cell) => (
                  <View key={cell.key} style={styles.calendarCellWrap}>
                    <Pressable
                      onPress={() => handleOpenHistoryDate(cell.key)}
                      style={[
                        styles.calendarCell,
                        cell.isCompleted && styles.calendarCellCompleted,
                        cell.isToday && styles.calendarCellToday,
                        !cell.isCurrentMonth && styles.calendarCellOutside
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          cell.isCompleted && styles.calendarCellTextCompleted,
                          cell.isToday && styles.calendarCellTextToday,
                          !cell.isCurrentMonth && styles.calendarCellTextOutside
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <Text style={styles.calendarFooterMeta}>{calendarFooterLabel}</Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={isGuideOpen} animationType="slide" onRequestClose={() => setIsGuideOpen(false)}>
        <SafeAreaView style={styles.guideModalRoot} edges={["top", "bottom"]}>
          <View style={styles.guideModalHeader}>
            <View style={styles.guideModalHeaderText}>
              <Text style={styles.guideEyebrow}>QUICK GUIDE</Text>
              <Text style={styles.guideModalTitle}>바로 보는 학습 가이드</Text>
            </View>
            <Pressable style={styles.guideModalCloseButton} onPress={() => setIsGuideOpen(false)}>
              <Text style={styles.guideModalCloseText}>닫기</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.guideModalScroll}
            contentContainerStyle={styles.guideModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.guidePreviewCard}>
              <Image source={homeGuidePreviewImage} style={styles.guidePreviewImage} resizeMode="cover" />
              <View style={styles.guidePreviewOverlay}>
                <Text style={styles.guidePreviewBadge}>START FLOW</Text>
                <Text style={styles.guidePreviewTitle}>질문 선택, 코치 도움, 피드백까지 한 흐름으로 이어집니다.</Text>
              </View>
            </View>

            <View style={styles.guideStepList}>
              {HOME_GUIDE_STEPS.map((step, index) => (
                <View key={step.title} style={styles.guideStepCard}>
                  <View style={styles.guideStepIndex}>
                    <Text style={styles.guideStepIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.guideStepCopy}>
                    <Text style={styles.guideStepTitle}>{step.title}</Text>
                    <Text style={styles.guideStepBody}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.guideTipCard}>
              <Text style={styles.guideTipTitle}>작게 시작하는 게 가장 좋아요.</Text>
              <Text style={styles.guideTipBody}>
                완벽하게 길게 쓰려고 하기보다, 짧게 먼저 쓰고 AI 코치와 피드백으로 한 번 더 다듬는 방식이 가장 안정적으로 늘어요.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 4,
    gap: 20
  },
  heroSection: {
    display: "none",
    gap: 10,
    paddingTop: 8
  },
  difficultySectionHeader: {
    gap: 10
  },
  headerTitleBlock: {
    alignSelf: "flex-start",
    gap: 8
  },
  difficultySectionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  difficultySectionTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  guideButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  guideButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  heroUnderline: {
    width: 150,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F2A14A",
    marginLeft: 2
  },
  statusPanel: {
    backgroundColor: "#FDFDFB",
    borderRadius: 34,
    padding: 22,
    gap: 0,
    borderWidth: 1,
    borderColor: "#EBDCCB",
    shadowColor: "#D89A51",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  statusPanelMain: {
    gap: 18
  },
  statusLead: {
    flexDirection: "row",
    gap: 18
  },
  statusIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#FFF0DD",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  statusMascotImage: {
    width: 84,
    height: 84,
    resizeMode: "contain"
  },
  statusCopy: {
    flex: 1,
    gap: 8
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2A2620"
  },
  statusDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: "#77695A"
  },
  statusMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D5E4E"
  },
  statusError: {
    fontSize: 13,
    color: "#B34A2B"
  },
  statusResumeSection: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFF1DB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4
  },
  resumeActionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#9A611E"
  },
  resumeMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: "#8B7761"
  },
  weekRowButton: {
    marginTop: 18
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EDE6DE",
    alignItems: "center",
    justifyContent: "center"
  },
  weekChipDone: {
    backgroundColor: "#FFE8CB"
  },
  weekChipToday: {
    borderWidth: 3,
    borderColor: "#F2C28A",
    backgroundColor: "#FFF8F1"
  },
  weekChipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#A39A8F"
  },
  weekChipTextDone: {
    color: "#9A6A22"
  },
  weekChipTextToday: {
    color: "#8C6433"
  },
  stageSection: {
    flexGrow: 1,
    justifyContent: "flex-end",
    gap: 18
  },
  difficultyCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 34,
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderWidth: 3,
    borderColor: "#F0D8BF",
    alignItems: "center",
    gap: 14
  },
  cardTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  cardDescription: {
    fontSize: 16,
    lineHeight: 25,
    textAlign: "center",
    color: "#6B5E4E"
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 27, 17, 0.22)"
  },
  calendarModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  calendarModalFrame: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  calendarModalCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EBDCCB",
    backgroundColor: "#FFF9F1",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    shadowColor: "#D89A51",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  calendarModalHeaderCopy: {
    flex: 1,
    gap: 4
  },
  calendarMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  calendarMonthNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarMonthNavButtonDisabled: {
    opacity: 0.45
  },
  calendarMonthNavButtonText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A6431"
  },
  calendarMonthNavButtonTextDisabled: {
    color: "#B7A38A"
  },
  calendarModalTitle: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    color: "#232128"
  },
  calendarModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#77695A"
  },
  calendarModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  calendarModalCloseText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  calendarLoadingRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  calendarErrorText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B34A2B"
  },
  calendarWeekHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  calendarWeekLabel: {
    width: 40,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    color: "#A17A42"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarCellWrap: {
    width: "14.285%",
    alignItems: "center",
    marginBottom: 10
  },
  calendarCell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EADDCB",
    backgroundColor: "#FFFDF9",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarCellOutside: {
    backgroundColor: "#F8F1E7",
    borderColor: "#F1E4D4"
  },
  calendarCellCompleted: {
    backgroundColor: "#FFB347",
    borderColor: "#E48B21"
  },
  calendarCellToday: {
    borderWidth: 3,
    borderColor: "#C4832F"
  },
  calendarCellText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7D6750"
  },
  calendarCellTextOutside: {
    color: "#C6B8A6"
  },
  calendarCellTextCompleted: {
    color: "#FFFDFB"
  },
  calendarCellTextToday: {
    color: "#7D531D"
  },
  calendarFooterMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D5E4E",
    textAlign: "center"
  },
  guideModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  guideModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  guideModalHeaderText: {
    gap: 4,
    flex: 1
  },
  guideEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#B27B2E"
  },
  guideModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  guideModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  guideModalCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  guideModalScroll: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2"
  },
  guideModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 18
  },
  guidePreviewCard: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#F2E6D9",
    borderWidth: 1,
    borderColor: "#E8DACB"
  },
  guidePreviewImage: {
    width: "100%",
    height: 210
  },
  guidePreviewOverlay: {
    gap: 8,
    padding: 18,
    backgroundColor: "#FFFDF9"
  },
  guidePreviewBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFE8CB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  guidePreviewTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    color: "#2A2620"
  },
  guideStepList: {
    gap: 12
  },
  guideStepCard: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    backgroundColor: "#FFFFFF",
    padding: 16
  },
  guideStepIndex: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0D9"
  },
  guideStepIndexText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#A76518"
  },
  guideStepCopy: {
    flex: 1,
    gap: 6
  },
  guideStepTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2A2620"
  },
  guideStepBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D5E4E"
  },
  guideTipCard: {
    borderRadius: 26,
    backgroundColor: "#FFF1DB",
    padding: 18,
    gap: 8
  },
  guideTipTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7E5215"
  },
  guideTipBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6C562F"
  }
});
