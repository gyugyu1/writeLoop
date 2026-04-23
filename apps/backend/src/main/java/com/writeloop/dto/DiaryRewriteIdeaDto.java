package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DiaryRewriteIdeaDto(
        String title,
        String meaningKo,
        String noteKo,
        String exampleEn
) {
    public DiaryRewriteIdeaDto {
        title = normalize(title);
        meaningKo = normalize(meaningKo);
        noteKo = normalize(noteKo);
        exampleEn = normalize(exampleEn);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
