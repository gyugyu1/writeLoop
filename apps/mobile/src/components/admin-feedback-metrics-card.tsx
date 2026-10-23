import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminFeedbackMetrics } from "@/lib/api";
import type { AdminFeedbackMetrics } from "@/lib/types";

// 관리자 화면의 AI 피드백 지표(웹 admin-feedback-metrics.tsx와 같은 데이터). 기능별 LLM 호출 수, 실패율, 응답 시간, 토큰.
const FEATURE_LABELS: Record<string, string> = {
  ANSWER: "문장 피드백",
  DIARY: "영어일기",
  NOW_IN_ENGLISH: "Now in English",
  COACH: "AI 코치"
};

const PERIOD_OPTIONS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 }
];

function dateInputValue(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatRate(value: number) {
  return `${Math.round((value || 0) * 1000) / 10}%`;
}

function formatSeconds(value: number | null) {
  return value === null ? "-" : `${(value / 1000).toFixed(1)}초`;
}

export function AdminFeedbackMetricsCard() {
  const [days, setDays] = useState(14);
  const [metrics, setMetrics] = useState<AdminFeedbackMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (periodDays: number) => {
    try {
      setIsLoading(true);
      setError("");
      setMetrics(
        await getAdminFeedbackMetrics({ startDate: dateInputValue(1 - periodDays), endDate: dateInputValue(0) })
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI 피드백 지표를 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return (
    <View style={styles.card}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>AI 피드백</Text>
        <Text style={styles.title}>기능별 AI 호출 지표</Text>
        <Text style={styles.description}>토큰은 2026-10-24부터 기록했어요.</Text>
      </View>

      <View style={styles.chipRow}>
        {PERIOD_OPTIONS.map((option) => {
          const isActive = days === option.days;
          return (
            <Pressable
              key={option.days}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setDays(option.days)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading && !metrics ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#E38B12" />
        </View>
      ) : metrics ? (
        <>
          <Text style={styles.range}>
            조회 기간 {metrics.startDate} ~ {metrics.endDate} · 호출 {formatCount(metrics.totalCalls)} · 실패{" "}
            {formatRate(metrics.failureRate)}
          </Text>
          <Text style={styles.range}>
            문장 피드백 재시도: 계약 {formatCount(metrics.answerContractRetries)} · 일시 오류{" "}
            {formatCount(metrics.answerProviderRetries)}
          </Text>
          {metrics.items.map((item) => (
            <View key={item.feedbackType} style={styles.row}>
              <Text style={styles.rowTitle}>{FEATURE_LABELS[item.feedbackType] ?? item.feedbackType}</Text>
              <Text style={styles.rowBody}>
                호출 {formatCount(item.calls)} · 실패 {formatCount(item.failedCalls)} ({formatRate(item.failureRate)})
              </Text>
              <Text style={styles.rowBody}>
                응답 p50 {formatSeconds(item.p50ElapsedMs)} · p95 {formatSeconds(item.p95ElapsedMs)}
              </Text>
              <Text style={styles.rowMeta}>
                토큰(기록 {formatCount(item.callsWithTokens)}회) 입력 {formatCount(item.inputTokens)} · 캐시{" "}
                {formatCount(item.cachedInputTokens)} · 출력 {formatCount(item.outputTokens)}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  headerCopy: {
    gap: 4
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#B27323"
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8B7865"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF8F1"
  },
  chipActive: {
    backgroundColor: "#F5A33B",
    borderColor: "#F5A33B"
  },
  chipText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  chipTextActive: {
    color: "#232128"
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B34A2B"
  },
  loading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  range: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8B7865"
  },
  row: {
    gap: 4,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FBF5EE",
    borderWidth: 1,
    borderColor: "#E8DACC"
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#232128"
  },
  rowBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#564a3f"
  },
  rowMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: "#7B684F"
  }
});
