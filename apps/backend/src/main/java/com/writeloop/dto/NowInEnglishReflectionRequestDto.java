package com.writeloop.dto;

import java.util.List;

public record NowInEnglishReflectionRequestDto(
        String dateKey,
        List<NowInEnglishReflectionEntryDto> entries
) {
}
