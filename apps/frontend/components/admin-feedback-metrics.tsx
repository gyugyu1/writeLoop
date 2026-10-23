"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminFeedbackMetrics } from "../lib/api";
import type { AdminFeedbackMetrics } from "../lib/types";
import authStyles from "./auth-page.module.css";
import styles from "./admin-page.module.css";

// 관리자 화면의 AI 피드백 지표. 기능별 LLM 호출 수, 실패율, 응답 시간, 토큰을 기간 단위로 본다.
const FEATURE_LABELS: Record<string, string> = {
  ANSWER: "문장 피드백",
  DIARY: "영어일기",
  NOW_IN_ENGLISH: "Now in English",
  COACH: "AI 코치"
};

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function relativeDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDateInputValue(date);
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatRate(value: number) {
  return new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 }).format(value || 0);
}

function formatSeconds(value: number | null) {
  return value === null ? "-" : `${(value / 1000).toFixed(1)}초`;
}

export function AdminFeedbackMetricsSection() {
  const [startDate, setStartDate] = useState(() => relativeDate(-13));
  const [endDate, setEndDate] = useState(() => relativeDate(0));
  const [metrics, setMetrics] = useState<AdminFeedbackMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (range: { startDate: string; endDate: string }) => {
    try {
      setIsLoading(true);
      setError("");
      setMetrics(await getAdminFeedbackMetrics(range));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI 피드백 지표를 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ startDate: relativeDate(-13), endDate: relativeDate(0) });
  }, [load]);

  return (
    <section className={styles.listSection}>
      <div className={styles.listHeaderBar}>
        <div className={styles.sectionHeaderCompact}>
          <p className={styles.sectionEyebrow}>AI 피드백</p>
          <h2>기능별 AI 호출 지표</h2>
          <p className={styles.metricsSectionDescription}>
            LLM 호출 수, 실패율, 응답 시간, 토큰을 기능별로 봐요. 토큰은 2026-10-24부터 기록했어요.
          </p>
        </div>
        <div className={styles.metricsHeaderActions}>
          <button
            type="button"
            className={styles.listSortButton}
            onClick={() => void load({ startDate, endDate })}
            disabled={isLoading}
          >
            {isLoading ? "불러오는 중..." : "새로고침"}
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div className={styles.metricsFilterGrid}>
        <label className={styles.field}>
          <span>시작일</span>
          <input className={styles.input} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>종료일</span>
          <input className={styles.input} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <div className={styles.metricsFilterActions}>
          <button
            type="button"
            className={authStyles.primaryButton}
            onClick={() => void load({ startDate, endDate })}
            disabled={isLoading}
          >
            적용
          </button>
        </div>
      </div>

      {error ? <p className={styles.metricsInlineError}>{error}</p> : null}

      {metrics ? (
        <>
          <div className={styles.metricsSummaryGrid}>
            <div className={styles.metricsSummaryCard}>
              <span>AI 호출</span>
              <strong>{formatCount(metrics.totalCalls)}</strong>
            </div>
            <div className={styles.metricsSummaryCard}>
              <span>실패</span>
              <strong>{formatCount(metrics.totalFailedCalls)}</strong>
              <small>{formatRate(metrics.failureRate)}</small>
            </div>
            <div className={styles.metricsSummaryCard}>
              <span>문장 피드백 계약 재시도</span>
              <strong>{formatCount(metrics.answerContractRetries)}</strong>
            </div>
            <div className={styles.metricsSummaryCard}>
              <span>문장 피드백 일시 오류 재시도</span>
              <strong>{formatCount(metrics.answerProviderRetries)}</strong>
            </div>
          </div>

          <p className={styles.metricsSectionDescription}>
            집계 기간 {metrics.startDate} ~ {metrics.endDate}
          </p>

          <div className={styles.metricsTableWrap}>
            <table className={styles.metricsTable}>
              <thead>
                <tr>
                  <th>기능</th>
                  <th>호출</th>
                  <th>실패</th>
                  <th>실패율</th>
                  <th>응답 p50</th>
                  <th>응답 p95</th>
                  <th>토큰 기록 호출</th>
                  <th>입력 토큰</th>
                  <th>캐시 입력</th>
                  <th>출력 토큰</th>
                </tr>
              </thead>
              <tbody>
                {metrics.items.map((item) => (
                  <tr key={item.feedbackType}>
                    <td>{FEATURE_LABELS[item.feedbackType] ?? item.feedbackType}</td>
                    <td>{formatCount(item.calls)}</td>
                    <td>{formatCount(item.failedCalls)}</td>
                    <td>{formatRate(item.failureRate)}</td>
                    <td>{formatSeconds(item.p50ElapsedMs)}</td>
                    <td>{formatSeconds(item.p95ElapsedMs)}</td>
                    <td>{formatCount(item.callsWithTokens)}</td>
                    <td>{formatCount(item.inputTokens)}</td>
                    <td>{formatCount(item.cachedInputTokens)}</td>
                    <td>{formatCount(item.outputTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
