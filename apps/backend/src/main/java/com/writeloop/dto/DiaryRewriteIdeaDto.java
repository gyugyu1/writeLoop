package com.writeloop.dto;

public record DiaryRewriteIdeaDto(
        String title,
        String english,
        String meaningKo,
        String noteKo,
        String exampleEn
) {
    public DiaryRewriteIdeaDto {
        title = normalize(title);
        english = normalize(english);
        meaningKo = normalize(meaningKo);
        noteKo = normalize(noteKo);
        exampleEn = normalize(exampleEn);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
