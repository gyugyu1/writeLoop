package com.writeloop.dto;

/** GET /api/loop-points: 잔액과 오늘(서울) 활동별 적립 횟수·한도·1번에 쌓이는 룹. */
public record LoopPointsSummaryDto(
        int balance,
        Today today
) {
    public record Today(
            Activity question,
            Activity diary,
            Activity nowInEnglish
    ) {
    }

    public record Activity(
            long count,
            int limit,
            int points
    ) {
    }
}
