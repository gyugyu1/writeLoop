package com.writeloop.dto;

import java.util.List;

public record PromptTaskMetaDto(
        String answerMode,
        List<String> requiredSlots,
        List<String> optionalSlots,
        String expectedTense,
        String expectedPov
) {
    public PromptTaskMetaDto(
            String answerMode,
            List<String> requiredSlots,
            List<String> optionalSlots
    ) {
        this(answerMode, requiredSlots, optionalSlots, null, null);
    }

    public PromptTaskMetaDto {
        answerMode = answerMode == null ? "" : answerMode.trim();
        requiredSlots = requiredSlots == null ? List.of() : List.copyOf(requiredSlots);
        optionalSlots = optionalSlots == null ? List.of() : List.copyOf(optionalSlots);
        expectedTense = expectedTense == null ? "" : expectedTense.trim();
        expectedPov = expectedPov == null ? "" : expectedPov.trim();
    }
}
