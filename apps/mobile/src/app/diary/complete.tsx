import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDiaryEntry } from "@/lib/api";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type { DiaryEntry } from "@/lib/types";

const completionMascotImage = require("@/assets/images/complete-excellent-cutout.png");

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function countWords(text: string) {
  const trimmed = trimText(text);
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

function getLatestAttemptText(entry: DiaryEntry | null) {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.diaryText ?? entry?.content ?? "";
}

function formatDiaryDate(value?: string | null) {
  if (!value) {
    return "오늘의 일기";
  }

  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return value;
  }

  const [, year, month, day] = matched;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function getFeedbackSummary(entry: DiaryEntry | null) {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.feedback?.summaryKo || latestAttempt?.feedbackSummary || "";
}

export default function DiaryCompleteScreen() {
  const params = useLocalSearchParams<{ entryId?: string }>();
  const { currentUser, isHydrating } = useSession();
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const diaryText = useMemo(() => getLatestAttemptText(entry), [entry]);
  const wordCount = useMemo(() => countWords(diaryText), [diaryText]);
  const attemptCount = entry?.attempts?.length ?? 0;
  const feedbackSummary = useMemo(() => getFeedbackSummary(entry), [entry]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntry() {
      if (isHydrating) {
        return;
      }

      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      if (!entryId) {
        setError("완료한 일기를 찾지 못했어요.");
        setIsLoading(false);
        return;
      }

      try {
        setError("");
        setIsLoading(true);
        const nextEntry = await getDiaryEntry(entryId);
        if (!cancelled) {
          setEntry(nextEntry);
          if (!nextEntry) {
            setError("완료한 일기를 찾지 못했어요.");
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "완료 화면 정보를 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [currentUser, entryId, isHydrating]);

  function handleOpenDiary() {
    if (!entryId) {
      router.replace("/diary" as Href);
      return;
    }

    router.replace({
      pathname: "/diary/[entryId]",
      params: { entryId }
    } as Href);
  }

  function handleGoDiaryList() {
    router.replace("/diary" as Href);
  }

  function handleWriteAnotherDiary() {
    router.replace("/diary/write" as Href);
  }

  function handleGoHome() {
    router.replace("/" as Href);
  }

  if (isHydrating || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator color="#E38B12" />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
          <Text style={styles.emptyBody}>완료한 영어일기는 로그인 후 다시 확인할 수 있어요.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace(buildLoginHref("/diary"))}>
            <Text style={styles.primaryButtonText}>로그인하기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !entry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>완료 화면을 찾지 못했어요</Text>
          <Text style={styles.emptyBody}>{error || "방금 쓴 일기 정보가 초기화됐을 수 있어요."}</Text>
          <Pressable style={styles.primaryButton} onPress={handleGoDiaryList}>
            <Text style={styles.primaryButtonText}>일기 기록으로 가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.storyShell}>
          <View style={styles.mascotStage}>
            <View style={[styles.confettiDot, styles.confettiDotOne]} />
            <View style={[styles.confettiDot, styles.confettiDotTwo]} />
            <View style={[styles.confettiDot, styles.confettiDotThree]} />
            <View style={[styles.confettiLine, styles.confettiLineOne]} />
            <View style={[styles.confettiLine, styles.confettiLineTwo]} />
            <View style={styles.mascotFrame}>
              <Image source={completionMascotImage} style={styles.mascotImage} />
            </View>
          </View>

          <View style={styles.storyCopy}>
            <Text style={styles.storyHeading}>영어일기 완료!</Text>
            <Text style={styles.storyBody}>
              오늘의 생각을 영어로 남겼어요. 짧아도 직접 쓴 기록이 쌓이고 있어요.
            </Text>
          </View>

          <View style={styles.summaryPanel}>
            <Text style={styles.summaryDate}>{formatDiaryDate(entry.entryDate)}</Text>
            <Text style={styles.summaryTitle}>{entry.title?.trim() || "오늘의 영어일기"}</Text>
            <View style={styles.summaryMetricRow}>
              <View style={[styles.summaryMetric, styles.summaryMetricDivider]}>
                <Text style={styles.summaryMetricValue}>{wordCount}</Text>
                <Text style={styles.summaryMetricLabel}>단어</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricValue}>{attemptCount}</Text>
                <Text style={styles.summaryMetricLabel}>피드백</Text>
              </View>
            </View>
            {feedbackSummary ? <Text style={styles.feedbackSummary}>{feedbackSummary}</Text> : null}
          </View>

          <View style={styles.actionStack}>
            <Pressable style={styles.primaryButton} onPress={handleOpenDiary}>
              <Text style={styles.primaryButtonText}>방금 쓴 일기 보기</Text>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable style={styles.ghostButton} onPress={handleGoHome}>
                <Text style={styles.ghostButtonText}>홈으로</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={handleGoDiaryList}>
                <Text style={styles.ghostButtonText}>일기 기록</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={handleWriteAnotherDiary}>
                <Text style={styles.ghostButtonText}>새 일기</Text>
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
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  emptyTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    color: "#25211E",
    textAlign: "center"
  },
  emptyBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#746655",
    textAlign: "center"
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
  mascotFrame: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
    borderColor: "#F09A28",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D88A2A",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  mascotImage: {
    width: 120,
    height: 120,
    resizeMode: "contain"
  },
  confettiDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5
  },
  confettiDotOne: {
    top: 18,
    left: 36,
    backgroundColor: "#FF9F1A"
  },
  confettiDotTwo: {
    top: 48,
    right: 40,
    backgroundColor: "#2F7CF6"
  },
  confettiDotThree: {
    top: 2,
    right: 88,
    backgroundColor: "#FFD166"
  },
  confettiLine: {
    position: "absolute",
    width: 8,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#FFB347"
  },
  confettiLineOne: {
    top: 42,
    left: 68,
    transform: [{ rotate: "-24deg" }]
  },
  confettiLineTwo: {
    top: 20,
    right: 66,
    backgroundColor: "#2251A5",
    transform: [{ rotate: "28deg" }]
  },
  storyCopy: {
    gap: 10,
    alignItems: "center"
  },
  storyHeading: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.3,
    color: "#2B2114",
    textAlign: "center"
  },
  storyBody: {
    fontSize: 16,
    lineHeight: 25,
    color: "#695845",
    textAlign: "center"
  },
  summaryPanel: {
    width: "100%",
    gap: 12
  },
  summaryDate: {
    fontSize: 13,
    fontWeight: "900",
    color: "#A76518"
  },
  summaryTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    color: "#2A241D"
  },
  summaryMetricRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E7D2AF",
    paddingVertical: 12
  },
  summaryMetric: {
    flex: 1,
    alignItems: "center",
    gap: 3
  },
  summaryMetricDivider: {
    borderRightWidth: 1,
    borderRightColor: "#E7D2AF"
  },
  summaryMetricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2B2114"
  },
  summaryMetricLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A6127"
  },
  feedbackSummary: {
    fontSize: 15,
    lineHeight: 23,
    color: "#715C43"
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
    backgroundColor: "#F2A14A",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#21160A"
  },
  ghostButton: {
    flexGrow: 1,
    minHeight: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E1C9A8",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#7A5930"
  }
});
