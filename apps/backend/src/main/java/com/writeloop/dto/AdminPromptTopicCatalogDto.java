package com.writeloop.dto;

import java.util.List;

public record AdminPromptTopicCatalogDto(
        String category,
        List<String> details
) {
}
