package com.writeloop.dto;

import java.util.List;

public record PromptCoachProfileDto(
        String primaryCategory,
        List<String> secondaryCategories,
        List<String> preferredExpressionFamilies,
        List<String> avoidFamilies,
        String starterStyle,
        String notes
) {
}
