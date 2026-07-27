package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackUiDto(
        FeedbackMicroTipDto microTip,
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
        FeedbackScreenPolicyDto screenPolicy,
        FeedbackLoopStatusDto loopStatus
) {
    public FeedbackUiDto {
        rewriteSuggestions = rewriteSuggestions == null ? List.of() : List.copyOf(rewriteSuggestions);
    }
}
