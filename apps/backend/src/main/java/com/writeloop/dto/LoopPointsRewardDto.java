package com.writeloop.dto;

/**
 * 완료 응답에 붙는 이번 적립 결과. activity는 question | diary | nowInEnglish.
 * 하루 한도에 닿아 0룹이면 earned 0, dailyLimitReached true다. balance는 적립 뒤 잔액이다.
 */
public record LoopPointsRewardDto(
        String activity,
        int earned,
        int balance,
        boolean dailyLimitReached
) {
}
