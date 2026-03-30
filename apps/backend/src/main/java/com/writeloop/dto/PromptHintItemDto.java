package com.writeloop.dto;

public record PromptHintItemDto(
        String id,
        String hintId,
        String itemType,
        String content,
        String meaningKo,
        String usageTipKo,
        String exampleEn,
        String expressionFamily,
        Integer displayOrder
) {
}
