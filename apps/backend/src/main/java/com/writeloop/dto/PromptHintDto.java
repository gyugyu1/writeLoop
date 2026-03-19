package com.writeloop.dto;

public record PromptHintDto(
        String id,
        String promptId,
        String hintType,
        String content,
        Integer displayOrder
) {
}
