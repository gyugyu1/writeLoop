package com.writeloop.dto;

public record DiaryCorrectionPointDto(
        String kind,
        String title,
        String originalText,
        String revisedText,
        String reasonKo,
        String exampleEn
) {
    public DiaryCorrectionPointDto {
        kind = normalize(kind);
        title = normalize(title);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
        reasonKo = normalize(reasonKo);
        exampleEn = normalize(exampleEn);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
