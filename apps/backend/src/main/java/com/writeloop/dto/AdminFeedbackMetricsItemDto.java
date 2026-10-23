package com.writeloop.dto;

// 기능 하나(ANSWER, DIARY, NOW_IN_ENGLISH, COACH)의 LLM 호출 지표. 토큰 합계는 토큰을 기록한 호출만 더한다.
public record AdminFeedbackMetricsItemDto(
        String feedbackType,
        long calls,
        long failedCalls,
        double failureRate,
        Long p50ElapsedMs,
        Long p95ElapsedMs,
        long callsWithTokens,
        long inputTokens,
        long cachedInputTokens,
        long outputTokens
) {
}
