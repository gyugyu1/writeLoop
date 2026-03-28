package com.writeloop.dto;

import java.util.List;

public record AdminPromptDto(
        String id,
        String topic,
        String difficulty,
        String questionEn,
        String questionKo,
        String tip,
        Integer displayOrder,
        boolean active,
        PromptCoachProfileDto coachProfile,
        List<AdminPromptHintDto> hints
) {
    public AdminPromptDto(
            String id,
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            boolean active,
            List<AdminPromptHintDto> hints
    ) {
        this(id, topic, difficulty, questionEn, questionKo, tip, displayOrder, active, null, hints);
    }
}
