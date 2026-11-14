package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * 일기 피드백 응답에 이번 적립 결과(loopPoints)를 더한 것. 피드백 필드는 그대로 펼쳐 보낸다.
 * DiaryFeedbackResponseDto는 LLM 응답을 읽는 데도 쓰여 필드를 직접 더하지 않는다.
 */
public record DiaryFeedbackWithPointsDto(
        @JsonUnwrapped DiaryFeedbackResponseDto feedback,
        LoopPointsRewardDto loopPoints
) {
}
