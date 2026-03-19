package com.writeloop.dto;

public record AdminPromptHintRequestDto(
        String hintType,
        String content,
        Integer displayOrder,
        Boolean active
) {
}
