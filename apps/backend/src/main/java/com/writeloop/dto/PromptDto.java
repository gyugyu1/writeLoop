package com.writeloop.dto;

public record PromptDto(
        String id,
        String topic,
        String difficulty,
        String questionEn,
        String questionKo,
        String tip,
        PromptCoachProfileDto coachProfile
) {
    public PromptDto(
            String id,
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip
    ) {
        this(id, topic, difficulty, questionEn, questionKo, tip, null);
    }
}
