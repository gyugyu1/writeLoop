package com.writeloop.dto;

public record AdminPromptHintDto(
        String id,
        String promptId,
        String hintType,
        String content,
        Integer displayOrder,
        boolean active
) {
}
