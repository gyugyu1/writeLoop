package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public record PromptTaskMetaDto(
        String answerMode,
        List<String> requiredSlots,
        List<String> optionalSlots,
        String expectedTense,
        String expectedPov,
        int minimumDepthSlots,
        @JsonIgnore
        Map<String, PromptSlotContractDto> slotContracts
) {
    public PromptTaskMetaDto(
            String answerMode,
            List<String> requiredSlots,
            List<String> optionalSlots
    ) {
        this(answerMode, requiredSlots, optionalSlots, null, null, 0, Map.of());
    }

    public PromptTaskMetaDto(
            String answerMode,
            List<String> requiredSlots,
            List<String> optionalSlots,
            String expectedTense,
            String expectedPov
    ) {
        this(answerMode, requiredSlots, optionalSlots, expectedTense, expectedPov, 0, Map.of());
    }

    public PromptTaskMetaDto(
            String answerMode,
            List<String> requiredSlots,
            List<String> optionalSlots,
            String expectedTense,
            String expectedPov,
            int minimumDepthSlots
    ) {
        this(
                answerMode,
                requiredSlots,
                optionalSlots,
                expectedTense,
                expectedPov,
                minimumDepthSlots,
                Map.of()
        );
    }

    public PromptTaskMetaDto {
        answerMode = answerMode == null ? "" : answerMode.trim();
        requiredSlots = requiredSlots == null ? List.of() : List.copyOf(requiredSlots);
        optionalSlots = optionalSlots == null ? List.of() : List.copyOf(optionalSlots);
        expectedTense = expectedTense == null ? "" : expectedTense.trim();
        expectedPov = expectedPov == null ? "" : expectedPov.trim();
        minimumDepthSlots = Math.max(0, Math.min(minimumDepthSlots, optionalSlots.size()));
        Map<String, PromptSlotContractDto> normalizedContracts = new LinkedHashMap<>();
        if (slotContracts != null) {
            slotContracts.forEach((slot, contract) -> {
                if (slot == null || slot.isBlank() || contract == null) {
                    return;
                }
                normalizedContracts.put(slot.trim().toUpperCase(Locale.ROOT), contract);
            });
        }
        slotContracts = Map.copyOf(normalizedContracts);
    }
}
