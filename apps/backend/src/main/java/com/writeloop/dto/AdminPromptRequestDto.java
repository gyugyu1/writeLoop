package com.writeloop.dto;

public record AdminPromptRequestDto(
        String topic,
        String difficulty,
        String questionEn,
        String questionKo,
        String tip,
        Integer displayOrder,
        Boolean active
) {
}
