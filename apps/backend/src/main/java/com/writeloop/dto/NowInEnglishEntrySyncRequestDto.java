package com.writeloop.dto;

import java.util.List;

public record NowInEnglishEntrySyncRequestDto(
        List<NowInEnglishEntryRequestDto> entries
) {
}
