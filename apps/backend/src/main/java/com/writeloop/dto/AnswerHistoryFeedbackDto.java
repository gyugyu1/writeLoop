package com.writeloop.dto;

import java.util.List;

public record AnswerHistoryFeedbackDto(
        Integer score,
        Boolean loopComplete,
        String completionMessage,
        String summary,
        List<String> strengths,
        List<CorrectionDto> corrections,
        String modelAnswer,
        String rewriteChallenge
) {
}
