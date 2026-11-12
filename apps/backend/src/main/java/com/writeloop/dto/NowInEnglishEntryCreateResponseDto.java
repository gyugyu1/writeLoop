package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/** 지금 영어로 조각 저장 응답: 조각 필드는 그대로 펼쳐 보내고 이번 적립 결과(loopPoints)를 더한다. */
public record NowInEnglishEntryCreateResponseDto(
        @JsonUnwrapped NowInEnglishEntryDto entry,
        LoopPointsRewardDto loopPoints
) {
}
