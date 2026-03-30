package com.writeloop.dto;

import java.util.List;

public record AdminPromptHintRequestDto(
        String hintType,
        String title,
        List<String> items,
        Integer displayOrder,
        Boolean active
) {
    public AdminPromptHintRequestDto {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
