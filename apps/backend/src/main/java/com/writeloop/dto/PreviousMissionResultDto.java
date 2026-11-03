package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

// 다시 쓴 답의 피드백에 붙는 "지난 미션 결과". 바로 앞 시도의 미션을 이번 답이 해결했는지 백엔드가 판정한다.
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PreviousMissionResultDto(
        String focusType,
        String title,
        String targetSlot,
        String status,
        Integer appliedCount,
        Integer totalCount,
        String message
) {
}
