package com.writeloop.dto;

import java.util.List;

public record AdminPromptHintDto(
        String id,
        String promptId,
        String hintType,
        String title,
        Integer displayOrder,
        boolean active,
        List<PromptHintItemDto> items
) {
    public AdminPromptHintDto {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
