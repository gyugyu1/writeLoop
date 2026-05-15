package com.writeloop.dto;

import java.time.Instant;

public record AdminAppVersionSettingDto(
        String platform,
        String latestVersion,
        String minimumSupportedVersion,
        String storeUrl,
        String optionalTitleKo,
        String forcedTitleKo,
        String optionalMessageKo,
        String forcedMessageKo,
        String releaseNotesKo,
        boolean fromDatabase,
        Instant updatedAt
) {
}
