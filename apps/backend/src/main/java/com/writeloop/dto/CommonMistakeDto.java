package com.writeloop.dto;

public record CommonMistakeDto(
        String issue,
        String displayLabel,
        long count,
        String latestSuggestion
) {
}
