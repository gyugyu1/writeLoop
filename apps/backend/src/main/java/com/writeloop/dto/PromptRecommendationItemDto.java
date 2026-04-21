package com.writeloop.dto;

import java.util.List;

public record PromptRecommendationItemDto(
        String slot,
        PromptDto prompt,
        String reasonCode,
        String reasonText,
        List<String> reasonFacts,
        int score
) {
    public PromptRecommendationItemDto {
        slot = slot == null ? "" : slot.trim();
        reasonCode = reasonCode == null ? "" : reasonCode.trim();
        reasonText = reasonText == null ? "" : reasonText.trim();
        reasonFacts = reasonFacts == null ? List.of() : List.copyOf(reasonFacts);
    }
}
