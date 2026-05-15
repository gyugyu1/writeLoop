package com.writeloop.dto;

public record AppVersionStatusDto(
        String platform,
        String currentVersion,
        String latestVersion,
        String minimumSupportedVersion,
        boolean updateAvailable,
        boolean forceUpdate,
        String titleKo,
        String messageKo,
        String releaseNotesKo,
        String storeUrl
) {
}
