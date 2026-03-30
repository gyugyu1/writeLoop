package com.writeloop.dto;

import java.util.List;

public record PromptHintDto(
        String id,
        String promptId,
        String hintType,
        String title,
        Integer displayOrder,
        List<PromptHintItemDto> items
) {
    public PromptHintDto(
            String id,
            String promptId,
            String hintType,
            String singleItemContent,
            Integer displayOrder
    ) {
        this(id, promptId, hintType, null, displayOrder, wrapSingleItem(id, hintType, singleItemContent));
    }

    public PromptHintDto(
            String id,
            String promptId,
            String hintType,
            String title,
            String legacyContent,
            Integer displayOrder,
            List<PromptHintItemDto> items
    ) {
        this(
                id,
                promptId,
                hintType,
                title,
                displayOrder,
                (items == null || items.isEmpty()) ? wrapSingleItem(id, hintType, legacyContent) : items
        );
    }

    public PromptHintDto {
        items = items == null ? List.of() : List.copyOf(items);
    }

    private static List<PromptHintItemDto> wrapSingleItem(String hintId, String hintType, String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }

        String normalizedType = hintType == null ? "" : hintType.trim().toUpperCase();
        String itemType = switch (normalizedType) {
            case "VOCAB_WORD" -> "WORD";
            case "VOCAB_PHRASE", "LINKER" -> "PHRASE";
            case "VOCAB" -> content.contains(" ") ? "PHRASE" : "WORD";
            default -> "FRAME";
        };

        return List.of(new PromptHintItemDto(
                hintId + "-item-1",
                hintId,
                itemType,
                content,
                null,
                null,
                null,
                null,
                1
        ));
    }
}
