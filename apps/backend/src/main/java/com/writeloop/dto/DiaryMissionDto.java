package com.writeloop.dto;

public record DiaryMissionDto(
        String focus,
        String titleKo,
        String instructionKo,
        String starterEn
) {
    public DiaryMissionDto {
        focus = normalize(focus);
        titleKo = normalize(titleKo);
        instructionKo = normalize(instructionKo);
        starterEn = normalize(starterEn);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
