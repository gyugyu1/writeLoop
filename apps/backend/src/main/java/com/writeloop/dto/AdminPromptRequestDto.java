package com.writeloop.dto;

public record AdminPromptRequestDto(
        String topic,
        String topicCategory,
        String topicDetail,
        String difficulty,
        String questionEn,
        String questionKo,
        String tip,
        Integer displayOrder,
        Boolean active,
        PromptCoachProfileRequestDto coachProfile
) {
    public AdminPromptRequestDto(
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            Boolean active
    ) {
        this(topic, null, null, difficulty, questionEn, questionKo, tip, displayOrder, active, null);
    }
}
