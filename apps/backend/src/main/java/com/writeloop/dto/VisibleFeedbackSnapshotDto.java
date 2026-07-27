package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record VisibleFeedbackSnapshotDto(
        int schemaVersion,
        VisibleFeedbackState state,
        String strength,
        FeedbackCoachMoveDto coachMove,
        FeedbackCompletionDto completion,
        List<RefinementExpressionDto> refinementExpressions,
        String modelAnswer,
        String modelAnswerKo,
        Boolean legacy
) {
    public VisibleFeedbackSnapshotDto {
        schemaVersion = schemaVersion <= 0 ? 1 : schemaVersion;
        strength = normalize(strength);
        refinementExpressions = refinementExpressions == null
                ? List.of()
                : refinementExpressions.stream().filter(value -> value != null).limit(2).toList();
        modelAnswer = normalize(modelAnswer);
        modelAnswerKo = normalize(modelAnswerKo);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
