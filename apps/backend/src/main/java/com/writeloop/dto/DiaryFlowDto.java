package com.writeloop.dto;

import java.util.List;

public record DiaryFlowDto(
        String timeFlow,
        String emotion,
        String detail,
        String reflection,
        String commentKo,
        List<String> connectionTips
) {
    public DiaryFlowDto {
        timeFlow = normalize(timeFlow);
        emotion = normalize(emotion);
        detail = normalize(detail);
        reflection = normalize(reflection);
        commentKo = normalize(commentKo);
        connectionTips = connectionTips == null
                ? List.of()
                : connectionTips.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .toList();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
