package com.writeloop.service;

import com.writeloop.dto.AdminAppVersionSettingDto;
import com.writeloop.dto.AdminAppVersionSettingRequestDto;
import com.writeloop.dto.AppVersionStatusDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.AppVersionSettingEntity;
import com.writeloop.persistence.AppVersionSettingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class AppVersionService {

    private final AppVersionSettingRepository appVersionSettingRepository;
    private final VersionTarget iosFallback;
    private final VersionTarget androidFallback;

    public AppVersionService(
            AppVersionSettingRepository appVersionSettingRepository,
            @Value("${app.version.ios.latest:1.0.2}") String iosLatestVersion,
            @Value("${app.version.ios.minimum-supported:1.0.0}") String iosMinimumSupportedVersion,
            @Value("${app.version.ios.store-url:https://apps.apple.com/kr/app/%EB%9D%BC%EC%9D%B4%ED%8A%B8%EB%A3%A8%ED%94%84/id6763569959}") String iosStoreUrl,
            @Value("${app.version.android.latest:1.0.1}") String androidLatestVersion,
            @Value("${app.version.android.minimum-supported:1.0.0}") String androidMinimumSupportedVersion,
            @Value("${app.version.android.store-url:https://play.google.com/store/apps/details?id=kr.writeloop}") String androidStoreUrl,
            @Value("${app.version.optional-title-ko:새 버전이 나왔어요}") String optionalTitleKo,
            @Value("${app.version.forced-title-ko:업데이트가 필요해요}") String forcedTitleKo,
            @Value("${app.version.optional-message-ko:더 안정적인 학습 경험을 위해 최신 버전으로 업데이트해 주세요.}") String optionalMessageKo,
            @Value("${app.version.forced-message-ko:현재 버전에서는 일부 기능이 원활하지 않을 수 있어요. 업데이트 후 이용해 주세요.}") String forcedMessageKo,
            @Value("${app.version.release-notes-ko:안정성 개선과 사용성 개선이 포함되어 있어요.}") String releaseNotesKo
    ) {
        this.appVersionSettingRepository = appVersionSettingRepository;
        this.iosFallback = new VersionTarget(
                "ios",
                normalizeVersion(iosLatestVersion, "1.0.2"),
                normalizeVersion(iosMinimumSupportedVersion, "1.0.0"),
                trimToNull(iosStoreUrl),
                defaultIfBlank(optionalTitleKo, "새 버전이 나왔어요"),
                defaultIfBlank(forcedTitleKo, "업데이트가 필요해요"),
                defaultIfBlank(optionalMessageKo, "더 안정적인 학습 경험을 위해 최신 버전으로 업데이트해 주세요."),
                defaultIfBlank(forcedMessageKo, "현재 버전에서는 일부 기능이 원활하지 않을 수 있어요. 업데이트 후 이용해 주세요."),
                defaultIfBlank(releaseNotesKo, "안정성 개선과 사용성 개선이 포함되어 있어요."),
                false,
                null
        );
        this.androidFallback = new VersionTarget(
                "android",
                normalizeVersion(androidLatestVersion, "1.0.1"),
                normalizeVersion(androidMinimumSupportedVersion, "1.0.0"),
                trimToNull(androidStoreUrl),
                defaultIfBlank(optionalTitleKo, "새 버전이 나왔어요"),
                defaultIfBlank(forcedTitleKo, "업데이트가 필요해요"),
                defaultIfBlank(optionalMessageKo, "더 안정적인 학습 경험을 위해 최신 버전으로 업데이트해 주세요."),
                defaultIfBlank(forcedMessageKo, "현재 버전에서는 일부 기능이 원활하지 않을 수 있어요. 업데이트 후 이용해 주세요."),
                defaultIfBlank(releaseNotesKo, "안정성 개선과 사용성 개선이 포함되어 있어요."),
                false,
                null
        );
    }

    @Transactional(readOnly = true)
    public AppVersionStatusDto getStatus(String platform, String currentVersion) {
        String normalizedPlatform = normalizePlatform(platform);
        VersionTarget target = resolveTarget(normalizedPlatform);
        String normalizedCurrentVersion = trimToNull(currentVersion);
        boolean updateAvailable = normalizedCurrentVersion != null
                && compareVersions(normalizedCurrentVersion, target.latestVersion()) < 0;
        boolean forceUpdate = normalizedCurrentVersion != null
                && compareVersions(normalizedCurrentVersion, target.minimumSupportedVersion()) < 0;

        return new AppVersionStatusDto(
                normalizedPlatform,
                normalizedCurrentVersion,
                target.latestVersion(),
                target.minimumSupportedVersion(),
                updateAvailable,
                forceUpdate,
                forceUpdate ? target.forcedTitleKo() : target.optionalTitleKo(),
                forceUpdate ? target.forcedMessageKo() : target.optionalMessageKo(),
                target.releaseNotesKo(),
                target.storeUrl()
        );
    }

    @Transactional(readOnly = true)
    public List<AdminAppVersionSettingDto> findAdminSettings() {
        return List.of(toAdminDto(resolveTarget("ios")), toAdminDto(resolveTarget("android")));
    }

    @Transactional(readOnly = true)
    public AdminAppVersionSettingDto findAdminSetting(String platform) {
        return toAdminDto(resolveTarget(normalizeRequiredPlatform(platform)));
    }

    @Transactional
    public AdminAppVersionSettingDto updateAdminSetting(String platform, AdminAppVersionSettingRequestDto request) {
        String normalizedPlatform = normalizeRequiredPlatform(platform);
        VersionTarget current = resolveTarget(normalizedPlatform);

        String latestVersion = mergeRequired(request == null ? null : request.latestVersion(), current.latestVersion(), "latestVersion");
        String minimumSupportedVersion = mergeRequired(
                request == null ? null : request.minimumSupportedVersion(),
                current.minimumSupportedVersion(),
                "minimumSupportedVersion"
        );
        String storeUrl = request == null || request.storeUrl() == null
                ? current.storeUrl()
                : trimToNull(request.storeUrl());
        String optionalTitleKo = mergeRequired(
                request == null ? null : request.optionalTitleKo(),
                current.optionalTitleKo(),
                "optionalTitleKo"
        );
        String forcedTitleKo = mergeRequired(
                request == null ? null : request.forcedTitleKo(),
                current.forcedTitleKo(),
                "forcedTitleKo"
        );
        String optionalMessageKo = mergeRequired(
                request == null ? null : request.optionalMessageKo(),
                current.optionalMessageKo(),
                "optionalMessageKo"
        );
        String forcedMessageKo = mergeRequired(
                request == null ? null : request.forcedMessageKo(),
                current.forcedMessageKo(),
                "forcedMessageKo"
        );
        String releaseNotesKo = mergeRequired(
                request == null ? null : request.releaseNotesKo(),
                current.releaseNotesKo(),
                "releaseNotesKo"
        );

        AppVersionSettingEntity entity = appVersionSettingRepository.findById(normalizedPlatform)
                .orElseGet(() -> new AppVersionSettingEntity(
                        normalizedPlatform,
                        latestVersion,
                        minimumSupportedVersion,
                        storeUrl,
                        optionalTitleKo,
                        forcedTitleKo,
                        optionalMessageKo,
                        forcedMessageKo,
                        releaseNotesKo
                ));
        entity.update(
                latestVersion,
                minimumSupportedVersion,
                storeUrl,
                optionalTitleKo,
                forcedTitleKo,
                optionalMessageKo,
                forcedMessageKo,
                releaseNotesKo
        );

        return toAdminDto(toTarget(appVersionSettingRepository.save(entity)));
    }

    private VersionTarget resolveTarget(String platform) {
        VersionTarget fallback = fallbackFor(platform);

        try {
            return appVersionSettingRepository.findById(platform)
                    .map(this::toTarget)
                    .orElse(fallback);
        } catch (DataAccessException ignored) {
            // Keep the public version check alive even if the DB migration has not run yet.
            return fallback;
        }
    }

    private VersionTarget fallbackFor(String platform) {
        return "ios".equals(platform) ? iosFallback : androidFallback;
    }

    private VersionTarget toTarget(AppVersionSettingEntity entity) {
        VersionTarget fallback = fallbackFor(entity.getPlatform());
        return new VersionTarget(
                entity.getPlatform(),
                normalizeVersion(entity.getLatestVersion(), fallback.latestVersion()),
                normalizeVersion(entity.getMinimumSupportedVersion(), fallback.minimumSupportedVersion()),
                trimToNull(entity.getStoreUrl()),
                defaultIfBlank(entity.getOptionalTitleKo(), fallback.optionalTitleKo()),
                defaultIfBlank(entity.getForcedTitleKo(), fallback.forcedTitleKo()),
                defaultIfBlank(entity.getOptionalMessageKo(), fallback.optionalMessageKo()),
                defaultIfBlank(entity.getForcedMessageKo(), fallback.forcedMessageKo()),
                defaultIfBlank(entity.getReleaseNotesKo(), fallback.releaseNotesKo()),
                true,
                entity.getUpdatedAt()
        );
    }

    private AdminAppVersionSettingDto toAdminDto(VersionTarget target) {
        return new AdminAppVersionSettingDto(
                target.platform(),
                target.latestVersion(),
                target.minimumSupportedVersion(),
                target.storeUrl(),
                target.optionalTitleKo(),
                target.forcedTitleKo(),
                target.optionalMessageKo(),
                target.forcedMessageKo(),
                target.releaseNotesKo(),
                target.fromDatabase(),
                target.updatedAt()
        );
    }

    private String normalizePlatform(String platform) {
        String normalized = defaultIfBlank(platform, "android").toLowerCase(Locale.ROOT);
        return "ios".equals(normalized) ? "ios" : "android";
    }

    private String normalizeRequiredPlatform(String platform) {
        String normalized = trimToNull(platform);
        if (normalized == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_APP_PLATFORM", "platform 값이 필요해요.");
        }

        normalized = normalized.toLowerCase(Locale.ROOT);
        if (!"ios".equals(normalized) && !"android".equals(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_APP_PLATFORM", "platform은 ios 또는 android만 가능해요.");
        }
        return normalized;
    }

    private String normalizeVersion(String value, String fallback) {
        String trimmed = trimToNull(value);
        return trimmed == null ? fallback : trimmed;
    }

    private String mergeRequired(String value, String currentValue, String fieldName) {
        if (value == null) {
            return currentValue;
        }

        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_APP_VERSION_SETTING", fieldName + " 값이 필요해요.");
        }
        return trimmed;
    }

    private int compareVersions(String left, String right) {
        String[] leftParts = normalizeComparableVersion(left).split("\\.");
        String[] rightParts = normalizeComparableVersion(right).split("\\.");
        int maxLength = Math.max(leftParts.length, rightParts.length);

        for (int index = 0; index < maxLength; index += 1) {
            int leftValue = index < leftParts.length ? parseVersionPart(leftParts[index]) : 0;
            int rightValue = index < rightParts.length ? parseVersionPart(rightParts[index]) : 0;
            if (leftValue != rightValue) {
                return Integer.compare(leftValue, rightValue);
            }
        }

        return 0;
    }

    private String normalizeComparableVersion(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? "0" : trimmed;
    }

    private int parseVersionPart(String part) {
        if (part == null || part.isBlank()) {
            return 0;
        }

        StringBuilder digits = new StringBuilder();
        for (int index = 0; index < part.length(); index += 1) {
            char current = part.charAt(index);
            if (!Character.isDigit(current)) {
                break;
            }
            digits.append(current);
        }

        if (digits.length() == 0) {
            return 0;
        }

        try {
            return Integer.parseInt(digits.toString());
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String defaultIfBlank(String value, String fallback) {
        String trimmed = trimToNull(value);
        return trimmed == null ? fallback : trimmed;
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record VersionTarget(
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
}
