package com.writeloop.service;

import com.writeloop.dto.UserFeedbackRequestDto;
import com.writeloop.dto.UserFeedbackResponseDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.UserFeedbackEntity;
import com.writeloop.persistence.UserFeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class UserFeedbackService {

    private static final Set<String> CATEGORIES = Set.of("BUG", "IDEA", "OTHER");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int MIN_MESSAGE_LENGTH = 5;
    private static final int MAX_MESSAGE_LENGTH = 2_000;

    private final UserFeedbackRepository userFeedbackRepository;

    @Transactional
    public UserFeedbackResponseDto submit(Long userId, UserFeedbackRequestDto request) {
        if (request == null) {
            throw invalidRequest("의견 내용을 입력해 주세요.");
        }

        String category = normalizeCategory(request.category());
        String message = normalizeMessage(request.message());
        String contactEmail = normalizeOptional(request.contactEmail(), 320, "이메일이 너무 길어요.");
        if (contactEmail != null && !EMAIL_PATTERN.matcher(contactEmail).matches()) {
            throw invalidRequest("답변받을 이메일 주소를 확인해 주세요.");
        }

        UserFeedbackEntity saved = userFeedbackRepository.save(new UserFeedbackEntity(
                userId,
                category,
                message,
                contactEmail,
                normalizeOptional(request.sourceScreen(), 80, "화면 정보가 너무 길어요."),
                normalizeOptional(request.appVersion(), 32, "앱 버전 정보가 너무 길어요."),
                normalizePlatform(request.platform()),
                normalizeOptional(request.osVersion(), 64, "운영체제 정보가 너무 길어요."),
                normalizeOptional(request.deviceModel(), 120, "기기 정보가 너무 길어요."),
                normalizeOptional(request.errorCode(), 120, "오류 정보가 너무 길어요.")
        ));
        return new UserFeedbackResponseDto(saved.getId(), true);
    }

    private String normalizeCategory(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!CATEGORIES.contains(normalized)) {
            throw invalidRequest("의견 종류를 선택해 주세요.");
        }
        return normalized;
    }

    private String normalizeMessage(String value) {
        String normalized = value == null
                ? ""
                : value.replace("\r\n", "\n").replace('\r', '\n').trim();
        if (normalized.length() < MIN_MESSAGE_LENGTH) {
            throw invalidRequest("의견을 5자 이상 입력해 주세요.");
        }
        if (normalized.length() > MAX_MESSAGE_LENGTH) {
            throw invalidRequest("의견은 2,000자까지 입력할 수 있어요.");
        }
        return normalized;
    }

    private String normalizePlatform(String value) {
        String normalized = normalizeOptional(value, 16, "플랫폼 정보가 너무 길어요.");
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        return "ios".equals(normalized) || "android".equals(normalized) || "web".equals(normalized)
                ? normalized
                : "other";
    }

    private String normalizeOptional(String value, int maxLength, String errorMessage) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        if (normalized.length() > maxLength) {
            throw invalidRequest(errorMessage);
        }
        return normalized;
    }

    private ApiException invalidRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USER_FEEDBACK", message);
    }
}
