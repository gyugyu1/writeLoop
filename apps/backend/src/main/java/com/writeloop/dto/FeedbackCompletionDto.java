package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackCompletionDto(
        String headline,
        String improvedPoint,
        String encouragement,
        String nextTinyGoal,
        // 완성된 답변을 더 풍부하게 만드는 선택 제안. 선택 슬롯 하나에 대한 뼈대 문장과 표현을 담는다.
        FeedbackCoachMoveDto enrichment
) {
    public FeedbackCompletionDto {
        headline = normalize(headline);
        improvedPoint = normalize(improvedPoint);
        encouragement = normalize(encouragement);
        nextTinyGoal = normalize(nextTinyGoal);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
