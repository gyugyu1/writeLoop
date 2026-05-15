package com.writeloop.dto;

public record AdminAppVersionSettingRequestDto(
        String latestVersion,
        String minimumSupportedVersion,
        String storeUrl,
        String optionalTitleKo,
        String forcedTitleKo,
        String optionalMessageKo,
        String forcedMessageKo,
        String releaseNotesKo
) {
}
