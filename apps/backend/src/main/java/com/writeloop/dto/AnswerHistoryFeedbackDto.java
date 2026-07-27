package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

public record AnswerHistoryFeedbackDto(
        Boolean loopComplete,
        String completionMessage,
        String summary,
        List<String> strengths,
        List<InlineFeedbackSegmentDto> inlineFeedback,
        @JsonAlias("correctedAnswer") String revisedAnswer,
        List<RefinementExpressionDto> refinementExpressions,
        String modelAnswer,
        String modelAnswerKo,
        String rewriteChallenge,
        FeedbackUiDto ui
) {
}
