package com.writeloop.dto;

/** 답 세션 상태. loopPoints는 이번 완료 요청으로 룹을 적립하는 때에만 있고, 그 밖에는 null이다. */
public record FeedbackSessionStatusDto(
        String sessionId,
        String status,
        LoopPointsRewardDto loopPoints
) {
}
