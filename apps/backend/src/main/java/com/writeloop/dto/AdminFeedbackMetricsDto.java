package com.writeloop.dto;

import java.util.List;

// 관리자 화면의 AI 피드백 지표. 기능별 LLM 호출 수, 실패율, 응답 시간, 토큰을 기간 단위로 보여 준다.
public record AdminFeedbackMetricsDto(
        String startDate,
        String endDate,
        long totalCalls,
        long totalFailedCalls,
        double failureRate,
        long answerContractRetries,
        long answerProviderRetries,
        List<AdminFeedbackMetricsItemDto> items
) {
}
