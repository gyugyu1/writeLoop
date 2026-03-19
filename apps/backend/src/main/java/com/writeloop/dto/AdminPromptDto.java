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
        List<AdminPromptHintDto> hints
) {
}
