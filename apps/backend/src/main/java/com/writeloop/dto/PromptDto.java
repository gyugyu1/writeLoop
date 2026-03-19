package com.writeloop.dto;

public record PromptDto(
        String id,
        String topic,
        String difficulty,
        String questionEn,
        String questionKo,
        String tip
) {
}
