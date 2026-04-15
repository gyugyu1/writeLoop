import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { deleteWritingDraft, getPrompts, getTodayWritingStatus } from "@/lib/api";
import { getDifficultyLabel } from "@/lib/difficulty";
import {
  clearPracticeFeedbackState,
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { clearIncompleteLoop } from "@/lib/incomplete-loop";
import { isDailyDifficulty } from "@/lib/practice";
import { useSession } from "@/lib/session";
import { deleteLocalWritingDraft } from "@/lib/writing-drafts";
import type { DailyDifficulty, Prompt, TodayWritingStatus } from "@/lib/types";

const completionMascotImage = require("@/assets/images/complete-excellent-cutout.png");
const CONFETTI_COLORS = ["#FF9F1A", "#FFD166", "#2F7CF6", "#2251A5", "#FFF4CC"] as const;
const CONFETTI_BURST_DELAYS = [0, 320, 760, 1220] as const;
const CONFETTI_CYCLE_DURATION = 4300;
const CONFETTI_EMITTERS = [
  { key: "left", originX: 18, originY: 130, angle: 58, spread: 70, count: 10, power: 158, delay: 0 },
  { key: "right", originX: 262, originY: 130, angle: 122, spread: 70, count: 10, power: 158, delay: 0 },
  {
    key: "center",
    originX: 140,
    originY: 98,
    angle: 90,
    spread: 92,
    count: 6,
    power: 124,
    delay: 120
  }
] as const;

type CelebrationConfettiPiece = {
  key: string;
  originX: number;
  originY: number;
  color: string;
  width: number;
  height: number;
  apexX: number;
  apexY: number;
  midX: number;
  midY: number;
  endX: number;
  endY: number;
  rotationStart: number;
  rotationEnd: number;
  duration: number;
  delay: number;
  isRound: boolean;
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function buildCelebrationConfettiPieces(): CelebrationConfettiPiece[] {
  return CONFETTI_BURST_DELAYS.flatMap((burstDelay, burstIndex) =>
    CONFETTI_EMITTERS.flatMap((emitter, emitterIndex) => {
      return Array.from({ length: emitter.count }, (_, pieceIndex) => {
        const progress = pieceIndex / Math.max(emitter.count - 1, 1);
        const wave = Math.sin((pieceIndex + 1) * 1.35 + burstIndex * 0.9 + emitterIndex * 0.7);
        const drift = Math.cos((pieceIndex + 1) * 0.92 + burstIndex * 1.1 - emitterIndex * 0.5);
        const angleJitter = wave * (emitter.key === "center" ? 8 : 6);
        const angle = toRadians(
          emitter.angle - emitter.spread / 2 + emitter.spread * progress + angleJitter
        );
        const travel = emitter.power * (0.86 + ((drift + 1) / 2) * 0.26);
        const burstOffsetX =
          emitter.key === "center"
            ? drift * 8 + (burstIndex - 1.5) * 3
            : emitter.key === "left"
              ? -burstIndex * 4 + drift * 3
              : burstIndex * 4 + drift * 3;
        const burstOffsetY = Math.sin((burstIndex + 1) * 1.4 + pieceIndex * 0.55) * 3 + (burstIndex % 2) * 2;
        const apexX = Math.cos(angle) * travel * (emitter.key === "center" ? 0.76 : 1);
        const apexY = -Math.sin(angle) * travel * (emitter.key === "center" ? 0.88 : 1);
        const midX = apexX * (0.76 + drift * 0.08);
        const midY = apexY * (0.9 + ((wave + 1) / 2) * 0.08) - 6;
        const endX = apexX * (1.08 + drift * 0.18);
        const endY = Math.abs(apexY) * (0.9 + ((wave + 1) / 2) * 0.16) + 44 + burstIndex * 8;
        const isRound = pieceIndex % 6 === 0;
        const width = isRound ? 7 + (pieceIndex % 3) : pieceIndex % 4 === 0 ? 5 : pieceIndex % 3 === 0 ? 13 : 11;
        const height = isRound ? width : pieceIndex % 4 === 0 ? 18 : pieceIndex % 2 === 0 ? 16 : 12;
        const rotationStart = wave * 34 + (pieceIndex % 2 === 0 ? -16 : 16);
        const rotationEnd = rotationStart + (pieceIndex % 2 === 0 ? 300 + burstIndex * 22 : -300 - burstIndex * 22);

        return {
          key: `${emitter.key}-${burstIndex}-${pieceIndex}`,
          originX: emitter.originX + burstOffsetX,
          originY: emitter.originY + burstOffsetY,
          color: CONFETTI_COLORS[(emitterIndex + burstIndex + pieceIndex) % CONFETTI_COLORS.length],
          width,
          height,
          apexX,
          apexY,
          midX,
          midY,
          endX,
          endY,
          rotationStart,
          rotationEnd,
          duration: 1260 + burstIndex * 110 + (pieceIndex % 4) * 90,
          delay: burstDelay + emitter.delay + pieceIndex * 16,
          isRound
        };
      });
    })
  );
}

const CELEBRATION_CONFETTI_PIECES = buildCelebrationConfettiPieces();

type FeedbackLevelInfo = {
  label: "매우 자연스러움" | "충분히 좋음" | "한 번 더 다듬기";
  loopSummary: string;
};

type StreakWeekCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isCompleted: boolean;
  isToday: boolean;
};

type StreakWeekData = {
  monthLabel: string;
  rangeLabel: string;
  streakDays: number;
  cells: StreakWeekCell[];
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function getFeedbackLevelInfo(score: number, loopComplete?: boolean | null): FeedbackLevelInfo {
  if (score >= 90) {
    return {
      label: "매우 자연스러움",
      loopSummary: "오늘 루프를 아주 자연스럽게 마무리했어요."
    };
  }

  if (loopComplete || score >= 75) {
    return {
      label: "충분히 좋음",
      loopSummary: "오늘 루프를 충분히 좋은 흐름으로 마무리했어요."
    };
  }

  return {
    label: "한 번 더 다듬기",
    loopSummary: "한 번 더 다듬으면 더 자연스러운 답변이 될 수 있어요."
  };
}

function parseStatusDate(dateString?: string | null) {
  return dateString ? new Date(`${dateString}T00:00:00`) : new Date();
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getWeekStart(date: Date) {
  return addDays(date, -date.getDay());
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatDateLabel(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function buildStreakWeek(todayStatus: TodayWritingStatus | null): StreakWeekData {
  const referenceDate = parseStatusDate(todayStatus?.date);
  const todayKey = formatDateKey(referenceDate);
  const streakDays = Math.max(todayStatus?.streakDays ?? 0, todayStatus?.completed ? 1 : 0);
  const streakEndDate =
    streakDays > 0
      ? addDays(referenceDate, todayStatus?.completed === false ? -1 : 0)
      : referenceDate;
  const highlightedDateKeys = new Set<string>();

  if (streakDays > 0) {
    for (let offset = 0; offset < streakDays; offset += 1) {
      highlightedDateKeys.add(formatDateKey(addDays(streakEndDate, -offset)));
    }
  }

  const weekStartDate = getWeekStart(referenceDate);
  const weekEndDate = addDays(weekStartDate, 6);
  const cells: StreakWeekCell[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStartDate, offset);
    const key = formatDateKey(date);
    cells.push({
      key,
      dayNumber: date.getDate(),
      isCurrentMonth:
        date.getFullYear() === referenceDate.getFullYear() &&
        date.getMonth() === referenceDate.getMonth(),
      isCompleted: highlightedDateKeys.has(key),
      isToday: key === todayKey
    });
  }

  return {
    monthLabel: formatMonthLabel(referenceDate),
    rangeLabel: `${formatDateLabel(weekStartDate)} - ${formatDateLabel(weekEndDate)}`,
    streakDays,
    cells
  };
}

function buildRecommendedPrompts(currentPrompt: Prompt, prompts: Prompt[]) {
  const sameDifficulty = prompts.filter(
    (prompt) => prompt.difficulty === currentPrompt.difficulty && prompt.id !== currentPrompt.id
  );
  const sameCategory = sameDifficulty.filter(
    (prompt) => prompt.topicCategory === currentPrompt.topicCategory
  );
  const sameTopic = sameDifficulty.filter((prompt) => prompt.topic === currentPrompt.topic);
  const ordered = [...sameCategory, ...sameTopic, ...sameDifficulty];
  const deduped: Prompt[] = [];
  const seen = new Set<string>();

  ordered.forEach((prompt) => {
    if (seen.has(prompt.id)) {
      return;
    }

    seen.add(prompt.id);
    deduped.push(prompt);
  });

  return deduped.slice(0, 2);
}

function CelebrationFireworks() {
  const progressValues = useRef(
    CELEBRATION_CONFETTI_PIECES.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = progressValues.map((value, index) => {
      const piece = CELEBRATION_CONFETTI_PIECES[index];
      const resetDelay = Math.max(0, CONFETTI_CYCLE_DURATION - piece.delay - piece.duration);

      return (
      Animated.loop(
        Animated.sequence([
          Animated.delay(piece.delay),
          Animated.timing(value, {
            toValue: 1,
            duration: piece.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true
          }),
          Animated.delay(resetDelay)
        ])
      )
      );
    });

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [progressValues]);

  return (
    <View pointerEvents="none" style={styles.fireworksLayer}>
      {CELEBRATION_CONFETTI_PIECES.map((piece, index) => {
        const progress = progressValues[index];
        const translateX = progress.interpolate({
          inputRange: [0, 0.58, 1],
          outputRange: [piece.midX, piece.endX * 0.88, piece.endX]
        });
        const translateY = progress.interpolate({
          inputRange: [0, 0.58, 1],
          outputRange: [piece.midY, piece.endY * 0.56, piece.endY]
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${piece.rotationStart}deg`, `${piece.rotationEnd}deg`]
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.04, 0.82, 1],
          outputRange: [0, 1, 0.72, 0]
        });
        const scale = progress.interpolate({
          inputRange: [0, 0.12, 0.72, 1],
          outputRange: [0.86, 1.04, 0.96, 0.8]
        });

        return (
          <Animated.View
            key={piece.key}
            style={[
              styles.confettiPiece,
              {
                left: piece.originX - piece.width / 2,
                top: piece.originY - piece.height / 2,
                width: piece.width,
                height: piece.height,
                borderRadius: piece.isRound ? piece.width / 2 : 4,
                backgroundColor: piece.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }]
              }
            ]}
          />
        );
      })}
    </View>
  );
}

export default function PracticeCompleteScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; promptId?: string }>();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "A";
  const requestedPromptId = typeof params.promptId === "string" ? params.promptId : "";
  const { currentUser } = useSession();
  const [feedbackState, setFeedbackState] = useState<PracticeFeedbackState | null>(() =>
    getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [isHydratingFeedbackState, setIsHydratingFeedbackState] = useState(
    () => !getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [recommendedPrompts, setRecommendedPrompts] = useState<Prompt[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [loadError, setLoadError] = useState("");

  const feedbackLevel = useMemo(
    () =>
      feedbackState
        ? getFeedbackLevelInfo(feedbackState.feedback.score, feedbackState.feedback.loopComplete)
        : null,
    [feedbackState]
  );
  const streakCalendar = useMemo(() => buildStreakWeek(todayStatus), [todayStatus]);

  useEffect(() => {
    const inMemoryState = getPracticeFeedbackState(requestedDifficulty, requestedPromptId);
    if (inMemoryState) {
      setFeedbackState(inMemoryState);
      setIsHydratingFeedbackState(false);
      return;
    }

    let cancelled = false;
    setIsHydratingFeedbackState(true);

    void hydratePracticeFeedbackState(requestedDifficulty, requestedPromptId).then((nextState) => {
      if (cancelled) {
        return;
      }

      setFeedbackState(nextState);
      setIsHydratingFeedbackState(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requestedDifficulty, requestedPromptId]);

  useEffect(() => {
    if (!feedbackState) {
      return;
    }

    let cancelled = false;

    const loadCompletionData = async () => {
      try {
        setIsLoadingRecommendations(true);
        setLoadError("");

        const [allPrompts, nextTodayStatus] = await Promise.all([
          getPrompts(),
          getTodayWritingStatus().catch(() => null)
        ]);

        if (cancelled) {
          return;
        }

        setRecommendedPrompts(buildRecommendedPrompts(feedbackState.prompt, allPrompts));
        setTodayStatus(nextTodayStatus);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setLoadError(
          caughtError instanceof Error ? caughtError.message : "완료 화면 정보를 불러오지 못했어요."
        );
      } finally {
        if (!cancelled) {
          setIsLoadingRecommendations(false);
        }
      }
    };

    void loadCompletionData();

    return () => {
      cancelled = true;
    };
  }, [feedbackState]);

  useEffect(() => {
    if (!feedbackState) {
      return;
    }

    const promptId = feedbackState.prompt.id;

    const clearCompletedDrafts = async () => {
      await clearIncompleteLoop();

      if (currentUser) {
        await Promise.allSettled([
          deleteWritingDraft(promptId, "ANSWER"),
          deleteWritingDraft(promptId, "REWRITE")
        ]);
      }

      await Promise.allSettled([
        deleteLocalWritingDraft(promptId, "ANSWER"),
        deleteLocalWritingDraft(promptId, "REWRITE")
      ]);
    };

    void clearCompletedDrafts();
  }, [currentUser, feedbackState]);

  const completionHeading = "루프를 완주했어요!";
  const completionSubcopy = pickFirstNonEmpty(
    feedbackState?.feedback.completionMessage,
    feedbackLevel?.loopSummary,
    "꾸준함이 실력을 만듭니다. 오늘도 멋진 글을 썼네요!"
  );
  const streakLabel =
    streakCalendar.streakDays > 1 ? `${streakCalendar.streakDays}일 연속 학습 중` : "오늘 첫 루프 완료";
  const totalWrittenSentenceLabel = todayStatus
    ? `총 ${(todayStatus.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성`
    : "오늘도 한 걸음 더 자연스러워졌어요.";

  function handleGoToQuestions() {
    clearPracticeFeedbackState();
    router.replace({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty: requestedDifficulty
      }
    });
  }

  function handleSeeFeedbackAgain() {
    if (!feedbackState) {
      handleGoToQuestions();
      return;
    }

    router.replace({
      pathname: "/practice/feedback",
      params: {
        difficulty: requestedDifficulty,
        promptId: feedbackState.prompt.id
      }
    });
  }

  function handleStartPrompt(prompt: Prompt) {
    clearPracticeFeedbackState();
    router.replace({
      pathname: "/practice/write",
      params: {
        difficulty: prompt.difficulty,
        promptId: prompt.id
      }
    });
  }

  function handleGoHome() {
    clearPracticeFeedbackState();
    router.replace("/");
  }

  if (isHydratingFeedbackState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyStateShell}>
          <View style={styles.emptyStateCard}>
            <ActivityIndicator color="#E38B12" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!feedbackState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyStateShell}>
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>완료 화면을 찾지 못했어요</Text>
            <Text style={styles.emptyStateBody}>
              방금 마친 루프 정보가 초기화되었을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleGoToQuestions}>
              <Text style={styles.primaryButtonText}>질문 목록으로 돌아가기</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.storyShell}>
          <View style={styles.mascotStage}>
            <CelebrationFireworks />
            <View style={styles.mascotFrame}>
              <Image source={completionMascotImage} style={styles.mascotImage} />
            </View>
            <View style={styles.mascotBadge}>
              <Text style={styles.mascotBadgeText}>SUCCESS!</Text>
            </View>
          </View>

          <View style={styles.storyCopy}>
            <Text style={styles.storyHeading}>{completionHeading}</Text>
            <Text style={styles.storyBody}>{completionSubcopy}</Text>
          </View>

          <View style={styles.streakPanel}>
            <Text style={styles.streakValue}>{streakLabel}</Text>
            <Text style={styles.streakMonthLabel}>{streakCalendar.monthLabel}</Text>

            <View style={styles.streakWeekHeader}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.streakWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.streakCalendarGrid}>
              {streakCalendar.cells.map((cell) => (
                <View key={cell.key} style={styles.streakCalendarCellWrap}>
                  <View
                    style={[
                      styles.streakCalendarCell,
                      cell.isCompleted && styles.streakCalendarCellCompleted,
                      cell.isToday && styles.streakCalendarCellToday,
                      !cell.isCurrentMonth &&
                        !cell.isCompleted &&
                        styles.streakCalendarCellOutside
                    ]}
                  >
                    <Text
                      style={[
                        styles.streakCalendarCellText,
                        cell.isCompleted && styles.streakCalendarCellTextCompleted,
                        cell.isToday && styles.streakCalendarCellTextToday,
                        !cell.isCurrentMonth &&
                          !cell.isCompleted &&
                          styles.streakCalendarCellTextOutside
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.streakMeta}>{totalWrittenSentenceLabel}</Text>
          </View>

          <View style={styles.recommendationSection}>
            <View style={styles.recommendationTitleRow}>
              <Text style={styles.recommendationTitle}>다음 질문 추천</Text>
              {isLoadingRecommendations ? <ActivityIndicator size="small" color="#C87513" /> : null}
            </View>

            {recommendedPrompts.length > 0 ? (
              <View style={styles.recommendationList}>
                {recommendedPrompts.map((prompt) => (
                  <Pressable
                    key={prompt.id}
                    style={styles.recommendationCard}
                    onPress={() => handleStartPrompt(prompt)}
                  >
                    <Text style={styles.recommendationMeta}>
                      {`${getDifficultyLabel(prompt.difficulty)} • ${prompt.topic}`}
                    </Text>
                    <Text style={styles.recommendationQuestion}>{prompt.questionEn}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.recommendationEmptyCard}>
                <Text style={styles.recommendationEmptyText}>
                  {loadError || "이어서 도전할 질문을 준비하는 중이에요."}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionStack}>
            {recommendedPrompts.length > 0 ? (
              <Pressable
                style={styles.primaryButton}
                onPress={() => handleStartPrompt(recommendedPrompts[0])}
              >
                <Text style={styles.primaryButtonText}>추천 질문에 이어서 답변하기</Text>
              </Pressable>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable style={styles.ghostButton} onPress={handleGoHome}>
                <Text style={styles.ghostButtonText}>홈으로 가기</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={handleGoToQuestions}>
                <Text style={styles.ghostButtonText}>다른 질문 보기</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={handleSeeFeedbackAgain}>
                <Text style={styles.ghostButtonText}>마지막 피드백 다시 보기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40
  },
  storyShell: {
    borderRadius: 34,
    backgroundColor: "#FFF9EF",
    borderWidth: 1,
    borderColor: "#F0D8B0",
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 22
  },
  mascotStage: {
    position: "relative",
    alignSelf: "center",
    width: 260,
    alignItems: "center",
    gap: 10,
    paddingTop: 8
  },
  fireworksLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible"
  },
  confettiPiece: {
    position: "absolute",
    opacity: 0
  },
  mascotFrame: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "transparent",
    borderWidth: 4,
    borderColor: "#F09A28",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D88A2A",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10
    },
    elevation: 6
  },
  mascotImage: {
    width: 120,
    height: 120,
    resizeMode: "contain"
  },
  mascotBadge: {
    borderRadius: 999,
    backgroundColor: "#EF8A1F",
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  mascotBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#FFFDF7"
  },
  storyCopy: {
    gap: 10,
    alignItems: "center"
  },
  storyHeading: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#2B2114",
    textAlign: "center"
  },
  storyBody: {
    fontSize: 16,
    lineHeight: 25,
    color: "#695845",
    textAlign: "center"
  },
  streakPanel: {
    borderRadius: 28,
    backgroundColor: "#FFF1D3",
    borderWidth: 1,
    borderColor: "#E8C688",
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8
  },
  streakValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#3A2B18",
    textAlign: "center"
  },
  streakMonthLabel: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: "#8A6127"
  },
  streakWeekHeader: {
    flexDirection: "row",
    width: "100%",
    marginTop: 6
  },
  streakWeekLabel: {
    width: "14.2857%",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#9C7A49",
    textAlign: "center"
  },
  streakCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%"
  },
  streakCalendarCellWrap: {
    width: "14.2857%",
    padding: 3
  },
  streakCalendarCell: {
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(216, 185, 133, 0.45)"
  },
  streakCalendarCellOutside: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderColor: "rgba(216, 185, 133, 0.22)"
  },
  streakCalendarCellCompleted: {
    backgroundColor: "#F6A43B",
    borderColor: "#DC8414"
  },
  streakCalendarCellToday: {
    borderWidth: 2,
    borderColor: "#8B5A16"
  },
  streakCalendarCellText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6E573A"
  },
  streakCalendarCellTextOutside: {
    color: "#BCA98B"
  },
  streakCalendarCellTextCompleted: {
    color: "#FFF9EF"
  },
  streakCalendarCellTextToday: {
    fontWeight: "900"
  },
  streakMeta: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A654D",
    textAlign: "center"
  },
  recommendationSection: {
    gap: 12
  },
  recommendationTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  recommendationTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#2A241D"
  },
  recommendationList: {
    gap: 12
  },
  recommendationCard: {
    borderRadius: 24,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8
  },
  recommendationMeta: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: "#A76518"
  },
  recommendationQuestion: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    color: "#2C2520"
  },
  recommendationEmptyCard: {
    borderRadius: 22,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  recommendationEmptyText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6F6254"
  },
  actionStack: {
    gap: 12
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  primaryButton: {
    borderRadius: 24,
    backgroundColor: "#E38B12",
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  ghostButton: {
    flexGrow: 1,
    borderRadius: 24,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#DABB8A",
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7A5A2D"
  },
  emptyStateShell: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center"
  },
  emptyStateCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyStateBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  }
});
