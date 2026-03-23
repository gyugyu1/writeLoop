package com.writeloop.service;

import com.writeloop.dto.AuthNoticeDto;
import com.writeloop.dto.AuthResponseDto;
import com.writeloop.dto.CompleteRegistrationRequestDto;
import com.writeloop.dto.DeleteAccountRequestDto;
import com.writeloop.dto.LoginRequestDto;
import com.writeloop.dto.PasswordResetAvailabilityDto;
import com.writeloop.dto.ResetPasswordRequestDto;
import com.writeloop.dto.RegisterRequestDto;
import com.writeloop.dto.ResendVerificationRequestDto;
import com.writeloop.dto.SendPasswordResetCodeRequestDto;
import com.writeloop.dto.SendRegistrationCodeRequestDto;
import com.writeloop.dto.UpdateProfileRequestDto;
import com.writeloop.dto.VerifyPasswordResetCodeRequestDto;
import com.writeloop.dto.VerifyEmailRequestDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.EmailVerificationTokenEntity;
import com.writeloop.persistence.EmailVerificationTokenRepository;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.PasswordResetTokenEntity;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.UserEntity;
import com.writeloop.persistence.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    public static final String SESSION_USER_ID = "AUTH_USER_ID";
    private static final Duration VERIFICATION_CODE_TTL = Duration.ofMinutes(3);
    private static final String SESSION_NAVER_STATE = "NAVER_OAUTH_STATE";
    private static final String SESSION_NAVER_RETURN_TO = "NAVER_OAUTH_RETURN_TO";
    private static final String SESSION_NAVER_REMEMBER_ME = "NAVER_OAUTH_REMEMBER_ME";
    private static final String SESSION_GOOGLE_STATE = "GOOGLE_OAUTH_STATE";
    private static final String SESSION_GOOGLE_RETURN_TO = "GOOGLE_OAUTH_RETURN_TO";
    private static final String SESSION_GOOGLE_REMEMBER_ME = "GOOGLE_OAUTH_REMEMBER_ME";
    private static final String SESSION_KAKAO_STATE = "KAKAO_OAUTH_STATE";
    private static final String SESSION_KAKAO_RETURN_TO = "KAKAO_OAUTH_RETURN_TO";
    private static final String SESSION_KAKAO_REMEMBER_ME = "KAKAO_OAUTH_REMEMBER_ME";

    private final UserRepository userRepository;
    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationMailService verificationMailService;
    private final RememberLoginService rememberLoginService;
    private final NaverOAuthService naverOAuthService;
    private final GoogleOAuthService googleOAuthService;
    private final KakaoOAuthService kakaoOAuthService;

    @Value("${app.frontend-base-url:http://writeloop.localtest.me}")
    private String frontendBaseUrl;

    @Value("${app.admin.emails:}")
    private String adminEmails;

    public AuthNoticeDto register(RegisterRequestDto request) {
        String email = normalizeEmail(request.email());
        String password = normalizePassword(request.password());
        String displayName = normalizeDisplayName(request.displayName());

        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일이에요.");
        }

        UserEntity user = userRepository.save(new UserEntity(
                email,
                passwordEncoder.encode(password),
                displayName
        ));

        issueVerificationCode(user);
        return new AuthNoticeDto(
                user.getEmail(),
                "인증 코드를 이메일로 보냈어요. 코드를 입력하면 바로 로그인할 수 있어요."
        );
    }

    public AuthNoticeDto sendRegistrationCode(SendRegistrationCodeRequestDto request) {
        String email = normalizeEmail(request.email());

        UserEntity user = userRepository.findByEmail(email)
                .map(existing -> {
                    if (existing.isEmailVerified()) {
                        throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일이에요.");
                    }
                    return existing;
                })
                .orElseGet(() -> userRepository.save(new UserEntity(
                        email,
                        passwordEncoder.encode(UUID.randomUUID().toString()),
                        defaultPendingDisplayName(email)
                )));

        issueVerificationCode(user);
        return new AuthNoticeDto(
                user.getEmail(),
                "인증코드를 이메일로 보냈어요. 코드를 입력하고 회원가입을 마무리해 주세요."
        );
    }

    public AuthResponseDto completeRegistration(
            CompleteRegistrationRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String email = normalizeEmail(request.email());
        String code = normalizeVerificationCode(request.code());
        String password = normalizePassword(request.password());
        String displayName = normalizeDisplayName(request.displayName());

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "가입 중인 사용자를 찾을 수 없어요."));

        if (user.isEmailVerified()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_ALREADY_VERIFIED", "이미 이메일 인증이 완료된 계정이에요.");
        }

        EmailVerificationTokenEntity token = emailVerificationTokenRepository
                .findFirstByEmailAndVerificationCodeAndUsedAtIsNullOrderByCreatedAtDesc(email, code)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_VERIFICATION_CODE",
                        "인증코드가 올바르지 않아요."
                ));

        if (token.isExpired()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VERIFICATION_CODE_EXPIRED", "인증코드가 만료됐어요. 다시 받아 주세요.");
        }

        user.completeLocalRegistration(passwordEncoder.encode(password), displayName);
        user.markEmailVerified();
        userRepository.save(user);

        token.markUsed();
        emailVerificationTokenRepository.save(token);

        completeLogin(user, session, httpRequest, httpResponse, false);
        return toResponse(user);
    }

    public AuthResponseDto login(
            LoginRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String email = normalizeEmail(request.email());
        String password = normalizePassword(request.password());

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED,
                        "INVALID_CREDENTIALS",
                        "이메일 또는 비밀번호가 올바르지 않아요."
                ));

        if (!user.isEmailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "이메일 인증을 먼저 완료해 주세요.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않아요.");
        }

        completeLogin(user, session, httpRequest, httpResponse, Boolean.TRUE.equals(request.rememberMe()));
        return toResponse(user);
    }

    public AuthResponseDto verifyEmail(
            VerifyEmailRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String email = normalizeEmail(request.email());
        String code = normalizeVerificationCode(request.code());

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "가입한 사용자를 찾을 수 없어요."));

        EmailVerificationTokenEntity token = emailVerificationTokenRepository
                .findFirstByEmailAndVerificationCodeAndUsedAtIsNullOrderByCreatedAtDesc(email, code)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_VERIFICATION_CODE",
                        "인증 코드가 올바르지 않아요."
                ));

        if (token.isExpired()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VERIFICATION_CODE_EXPIRED", "인증 코드가 만료됐어요. 다시 받아 주세요.");
        }

        token.markUsed();
        emailVerificationTokenRepository.save(token);

        if (!user.isEmailVerified()) {
            user.markEmailVerified();
            userRepository.save(user);
        }

        completeLogin(user, session, httpRequest, httpResponse, false);
        return toResponse(user);
    }

    public AuthNoticeDto resendVerificationEmail(ResendVerificationRequestDto request) {
        String email = normalizeEmail(request.email());
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "가입한 사용자를 찾을 수 없어요."));

        if (user.isEmailVerified()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_ALREADY_VERIFIED", "이미 이메일 인증이 완료된 계정이에요.");
        }

        issueVerificationCode(user);
        return new AuthNoticeDto(user.getEmail(), "인증 코드를 다시 보냈어요.");
    }

    public PasswordResetAvailabilityDto checkPasswordResetEmail(SendPasswordResetCodeRequestDto request) {
        String email = normalizeEmail(request.email());

        return userRepository.findByEmail(email)
                .map(this::toPasswordResetAvailability)
                .orElseGet(() -> new PasswordResetAvailabilityDto(
                        email,
                        false,
                        "등록된 이메일을 찾지 못했어요."
                ));
    }

    public AuthNoticeDto sendPasswordResetCode(SendPasswordResetCodeRequestDto request) {
        String email = normalizeEmail(request.email());
        UserEntity user = requirePasswordResetEligibleUser(email);
        issuePasswordResetCode(user);

        return new AuthNoticeDto(
                email,
                "비밀번호 재설정 코드를 보냈어요."
        );
    }

    public AuthNoticeDto verifyPasswordResetCode(VerifyPasswordResetCodeRequestDto request) {
        String email = normalizeEmail(request.email());
        String code = normalizeVerificationCode(request.code());

        requirePasswordResetEligibleUser(email);
        PasswordResetTokenEntity token = findValidPasswordResetToken(email, code);

        if (token.isExpired()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "PASSWORD_RESET_CODE_EXPIRED",
                    "재설정 코드가 만료되었어요. 다시 받아 주세요."
            );
        }

        return new AuthNoticeDto(
                email,
                "코드를 확인했어요. 새 비밀번호를 입력해 주세요."
        );
    }

    public AuthNoticeDto resetPassword(ResetPasswordRequestDto request) {
        String email = normalizeEmail(request.email());
        String code = normalizeVerificationCode(request.code());
        String newPassword = normalizePassword(request.newPassword());

        UserEntity user = requirePasswordResetEligibleUser(email);
        PasswordResetTokenEntity token = findValidPasswordResetToken(email, code);

        if (token.isExpired()) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "PASSWORD_RESET_CODE_EXPIRED",
                    "재설정 코드가 만료되었어요. 다시 받아 주세요."
            );
        }

        user.updatePasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        var activeTokens = passwordResetTokenRepository.findAllByEmailAndUsedAtIsNull(email);
        for (PasswordResetTokenEntity activeToken : activeTokens) {
            activeToken.markUsed();
        }
        if (!activeTokens.isEmpty()) {
            passwordResetTokenRepository.saveAll(activeTokens);
        }
        rememberLoginService.revokeAllForUser(user.getId());

        return new AuthNoticeDto(
                user.getEmail(),
                "비밀번호를 재설정했어요. 새 비밀번호로 로그인해 주세요."
        );
    }

    public void logout(HttpSession session, HttpServletRequest request, HttpServletResponse response) {
        rememberLoginService.clearRememberedLogin(request, response);
        session.invalidate();
    }

    public AuthResponseDto getCurrentUser(HttpSession session) {
        Long userId = getCurrentUserId(session);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return toResponse(findUserEntity(userId));
    }

    public AuthResponseDto updateProfile(UpdateProfileRequestDto request, HttpSession session) {
        Long userId = getCurrentUserId(session);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "濡쒓렇?몄씠 ?꾩슂?댁슂.");
        }

        UserEntity user = findUserEntity(userId);
        user.updateDisplayName(normalizeDisplayName(request.displayName()));

        boolean wantsPasswordChange = request.newPassword() != null && !request.newPassword().isBlank();
        if (wantsPasswordChange) {
            if (user.getSocialProvider() != null && !user.getSocialProvider().isBlank()) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "SOCIAL_PASSWORD_CHANGE_UNSUPPORTED",
                        "소셜 로그인 계정은 비밀번호를 변경할 수 없어요."
                );
            }

            if (request.currentPassword() == null || request.currentPassword().isBlank()) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "CURRENT_PASSWORD_REQUIRED",
                        "현재 비밀번호를 입력해 주세요."
                );
            }

            if (!passwordEncoder.matches(request.currentPassword().trim(), user.getPasswordHash())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_CURRENT_PASSWORD",
                        "현재 비밀번호가 올바르지 않아요."
                );
            }

            user.updatePasswordHash(passwordEncoder.encode(normalizePassword(request.newPassword())));
        }

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AuthNoticeDto deleteAccount(
            DeleteAccountRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        Long userId = getCurrentUserId(session);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        UserEntity user = findUserEntity(userId);
        String confirmationText = request.confirmationText() == null ? "" : request.confirmationText().trim();
        if (!"탈퇴".equals(confirmationText)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "ACCOUNT_DELETE_CONFIRMATION_REQUIRED",
                    "회원 탈퇴를 진행하려면 확인 문구에 '탈퇴'를 입력해 주세요."
            );
        }

        if (user.getSocialProvider() == null || user.getSocialProvider().isBlank()) {
            if (request.currentPassword() == null || request.currentPassword().isBlank()) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "CURRENT_PASSWORD_REQUIRED",
                        "회원 탈퇴를 진행하려면 현재 비밀번호를 입력해 주세요."
                );
            }

            if (!passwordEncoder.matches(request.currentPassword().trim(), user.getPasswordHash())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_CURRENT_PASSWORD",
                        "현재 비밀번호가 올바르지 않아요."
                );
            }
        }

        var sessions = answerSessionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        var sessionIds = sessions.stream()
                .map(AnswerSessionEntity::getId)
                .toList();

        if (!sessionIds.isEmpty()) {
            answerAttemptRepository.deleteBySessionIdIn(sessionIds);
        }
        if (!sessions.isEmpty()) {
            answerSessionRepository.deleteAll(sessions);
        }

        emailVerificationTokenRepository.deleteAllByUserId(userId);
        passwordResetTokenRepository.deleteAllByUserId(userId);
        rememberLoginService.revokeAllForUser(userId);
        userRepository.delete(user);

        rememberLoginService.clearRememberedLogin(httpRequest, httpResponse);
        session.invalidate();

        return new AuthNoticeDto(user.getEmail(), "회원 탈퇴가 완료되었어요.");
    }

    public Long getCurrentUserIdOrNull(HttpSession session) {
        return getCurrentUserId(session);
    }

    public UserEntity findUserEntity(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자 정보를 찾을 수 없어요."));
    }

    public void requireAdmin(HttpSession session) {
        Long userId = getCurrentUserId(session);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        UserEntity user = findUserEntity(userId);
        if (!isAdminUser(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "관리자 권한이 필요해요.");
        }
    }

    public boolean isAdminUser(UserEntity user) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return false;
        }

        return resolveAdminEmails().contains(user.getEmail().trim().toLowerCase(Locale.ROOT));
    }

    public void startNaverLogin(
            String returnTo,
            boolean rememberMe,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        if (!naverOAuthService.isConfigured()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NAVER_LOGIN_NOT_CONFIGURED", "네이버 로그인이 아직 설정되지 않았어요.");
        }

        String state = UUID.randomUUID().toString();
        session.setAttribute(SESSION_NAVER_STATE, state);
        session.setAttribute(SESSION_NAVER_RETURN_TO, normalizeReturnTo(returnTo));
        session.setAttribute(SESSION_NAVER_REMEMBER_ME, rememberMe);

        response.sendRedirect(naverOAuthService.buildAuthorizationUrl(state));
    }

    public void finishNaverLogin(
            String code,
            String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String expectedState = (String) session.getAttribute(SESSION_NAVER_STATE);
        String returnTo = (String) session.getAttribute(SESSION_NAVER_RETURN_TO);
        boolean rememberMe = Boolean.TRUE.equals(session.getAttribute(SESSION_NAVER_REMEMBER_ME));

        session.removeAttribute(SESSION_NAVER_STATE);
        session.removeAttribute(SESSION_NAVER_RETURN_TO);
        session.removeAttribute(SESSION_NAVER_REMEMBER_ME);

        if (expectedState == null || !expectedState.equals(state)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SOCIAL_STATE", "소셜 로그인 상태 검증에 실패했어요.");
        }

        NaverOAuthService.NaverUserProfile profile = naverOAuthService.fetchUserProfile(code, state);
        UserEntity user = upsertSocialUser("NAVER", profile.providerUserId(), profile.email(), profile.displayName());
        completeLogin(user, session, request, response, rememberMe);

        response.sendRedirect(frontendBaseUrl + normalizeReturnTo(returnTo));
    }

    public void startGoogleLogin(
            String returnTo,
            boolean rememberMe,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        if (!googleOAuthService.isConfigured()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GOOGLE_LOGIN_NOT_CONFIGURED", "구글 로그인이 아직 설정되지 않았어요.");
        }

        String state = UUID.randomUUID().toString();
        session.setAttribute(SESSION_GOOGLE_STATE, state);
        session.setAttribute(SESSION_GOOGLE_RETURN_TO, normalizeReturnTo(returnTo));
        session.setAttribute(SESSION_GOOGLE_REMEMBER_ME, rememberMe);

        response.sendRedirect(googleOAuthService.buildAuthorizationUrl(state));
    }

    public void finishGoogleLogin(
            String code,
            String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String expectedState = (String) session.getAttribute(SESSION_GOOGLE_STATE);
        String returnTo = (String) session.getAttribute(SESSION_GOOGLE_RETURN_TO);
        boolean rememberMe = Boolean.TRUE.equals(session.getAttribute(SESSION_GOOGLE_REMEMBER_ME));

        session.removeAttribute(SESSION_GOOGLE_STATE);
        session.removeAttribute(SESSION_GOOGLE_RETURN_TO);
        session.removeAttribute(SESSION_GOOGLE_REMEMBER_ME);

        if (expectedState == null || !expectedState.equals(state)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SOCIAL_STATE", "소셜 로그인 상태 검증에 실패했어요.");
        }

        GoogleOAuthService.GoogleUserProfile profile = googleOAuthService.fetchUserProfile(code);
        UserEntity user = upsertSocialUser("GOOGLE", profile.providerUserId(), profile.email(), profile.displayName());
        completeLogin(user, session, request, response, rememberMe);

        response.sendRedirect(frontendBaseUrl + normalizeReturnTo(returnTo));
    }

    public void startKakaoLogin(
            String returnTo,
            boolean rememberMe,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        if (!kakaoOAuthService.isConfigured()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KAKAO_LOGIN_NOT_CONFIGURED", "카카오 로그인이 아직 설정되지 않았어요.");
        }

        String state = UUID.randomUUID().toString();
        session.setAttribute(SESSION_KAKAO_STATE, state);
        session.setAttribute(SESSION_KAKAO_RETURN_TO, normalizeReturnTo(returnTo));
        session.setAttribute(SESSION_KAKAO_REMEMBER_ME, rememberMe);

        response.sendRedirect(kakaoOAuthService.buildAuthorizationUrl(state));
    }

    public void finishKakaoLogin(
            String code,
            String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String expectedState = (String) session.getAttribute(SESSION_KAKAO_STATE);
        String returnTo = (String) session.getAttribute(SESSION_KAKAO_RETURN_TO);
        boolean rememberMe = Boolean.TRUE.equals(session.getAttribute(SESSION_KAKAO_REMEMBER_ME));

        session.removeAttribute(SESSION_KAKAO_STATE);
        session.removeAttribute(SESSION_KAKAO_RETURN_TO);
        session.removeAttribute(SESSION_KAKAO_REMEMBER_ME);

        if (expectedState == null || !expectedState.equals(state)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SOCIAL_STATE", "소셜 로그인 상태 검증에 실패했어요.");
        }

        KakaoOAuthService.KakaoUserProfile profile = kakaoOAuthService.fetchUserProfile(code);
        UserEntity user = upsertSocialUser("KAKAO", profile.providerUserId(), profile.email(), profile.displayName());
        completeLogin(user, session, request, response, rememberMe);

        response.sendRedirect(frontendBaseUrl + normalizeReturnTo(returnTo));
    }

    private UserEntity upsertSocialUser(
            String provider,
            String providerUserId,
            String email,
            String displayName
    ) {
        String normalizedEmail = normalizeSocialEmail(provider, providerUserId);

        return userRepository.findBySocialProviderAndSocialProviderUserId(provider, providerUserId)
                .map(existing -> updateSocialUser(existing, provider, providerUserId, displayName))
                .orElseGet(() -> createSocialUser(provider, providerUserId, normalizedEmail, displayName));
    }

    private UserEntity updateSocialUser(
            UserEntity existing,
            String provider,
            String providerUserId,
            String displayName
    ) {
        existing.linkSocialAccount(provider, providerUserId);
        if (!existing.isEmailVerified()) {
            existing.markEmailVerified();
        }
        existing.updateDisplayName(displayName);
        return userRepository.save(existing);
    }

    private UserEntity createSocialUser(
            String provider,
            String providerUserId,
            String email,
            String displayName
    ) {
        String resolvedDisplayName = (displayName == null || displayName.isBlank())
                ? "writeLoop user"
                : displayName.trim();

        UserEntity user = new UserEntity(
                email,
                passwordEncoder.encode(UUID.randomUUID().toString()),
                resolvedDisplayName
        );
        user.linkSocialAccount(provider, providerUserId);
        user.markEmailVerified();
        return userRepository.save(user);
    }

    private String normalizeSocialEmail(String provider, String providerUserId) {
        String normalizedProvider = provider == null || provider.isBlank()
                ? "social"
                : provider.trim().toLowerCase(Locale.ROOT);
        String normalizedProviderUserId = providerUserId == null || providerUserId.isBlank()
                ? UUID.randomUUID().toString()
                : providerUserId.trim().toLowerCase(Locale.ROOT);
        String localPart = ("social+" + normalizedProvider + "-" + normalizedProviderUserId)
                .replaceAll("[^a-z0-9+._-]", "");

        return localPart + "@writeloop.local";
    }

    private void completeLogin(
            UserEntity user,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response,
            boolean rememberMe
    ) {
        session.setAttribute(SESSION_USER_ID, user.getId());

        if (rememberMe) {
            rememberLoginService.rememberUser(user.getId(), response);
        } else {
            rememberLoginService.clearRememberedLogin(request, response);
        }
    }

    private Long getCurrentUserId(HttpSession session) {
        Object value = session.getAttribute(SESSION_USER_ID);
        if (value instanceof Long longValue) {
            return longValue;
        }
        if (value instanceof Integer intValue) {
            return intValue.longValue();
        }
        return null;
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일을 입력해 주세요.");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해 주세요.");
        }
        String trimmed = password.trim();
        if (trimmed.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 8자 이상이어야 해요.");
        }
        return trimmed;
    }

    private String normalizeDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "표시 이름을 입력해 주세요.");
        }
        String trimmed = displayName.trim();
        if (trimmed.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "표시 이름은 2자 이상이어야 해요.");
        }
        return trimmed;
    }

    private String normalizeVerificationCode(String code) {
        if (code == null || code.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VERIFICATION_CODE_REQUIRED", "인증 코드를 입력해 주세요.");
        }
        String trimmed = code.trim();
        if (trimmed.length() != 6) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_VERIFICATION_CODE", "인증 코드는 6자리여야 해요.");
        }
        return trimmed;
    }

    private String normalizeReturnTo(String returnTo) {
        if (returnTo == null || returnTo.isBlank() || !returnTo.startsWith("/")) {
            return "/";
        }
        return returnTo;
    }

    private String defaultPendingDisplayName(String email) {
        String localPart = email == null ? "" : email.split("@", 2)[0].trim();
        if (localPart.length() >= 2) {
            return localPart;
        }
        return "writeLoop user";
    }

    private PasswordResetAvailabilityDto toPasswordResetAvailability(UserEntity user) {
        String email = user.getEmail();

        if (!user.isEmailVerified()) {
            return new PasswordResetAvailabilityDto(
                    email,
                    false,
                    "이메일 인증이 아직 완료되지 않은 계정이에요."
            );
        }

        if (user.getSocialProvider() != null && !user.getSocialProvider().isBlank()) {
            return new PasswordResetAvailabilityDto(
                    email,
                    false,
                    "소셜 로그인 계정은 해당 서비스에서 비밀번호를 재설정해 주세요."
            );
        }

        return new PasswordResetAvailabilityDto(
                email,
                true,
                "등록된 이메일을 확인했어요. 인증 코드를 보낼 수 있어요."
        );
    }

    private UserEntity requirePasswordResetEligibleUser(String email) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_PASSWORD_RESET_REQUEST",
                        "비밀번호 재설정 요청이 올바르지 않아요."
                ));

        if (!user.isEmailVerified()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "EMAIL_NOT_VERIFIED",
                    "이메일 인증이 아직 완료되지 않은 계정이에요."
            );
        }

        if (user.getSocialProvider() != null && !user.getSocialProvider().isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "SOCIAL_PASSWORD_RESET_UNSUPPORTED",
                    "소셜 로그인 계정은 해당 서비스에서 비밀번호를 재설정해 주세요."
            );
        }

        return user;
    }

    private PasswordResetTokenEntity findValidPasswordResetToken(String email, String code) {
        return passwordResetTokenRepository
                .findFirstByEmailAndResetCodeAndUsedAtIsNullOrderByCreatedAtDesc(email, code)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_PASSWORD_RESET_CODE",
                        "재설정 코드가 올바르지 않아요."
                ));
    }

    private void issuePasswordResetCode(UserEntity user) {
        var existingTokens = passwordResetTokenRepository.findAllByEmailAndUsedAtIsNull(user.getEmail());
        for (PasswordResetTokenEntity existingToken : existingTokens) {
            existingToken.markUsed();
        }

        String code = generateVerificationCode();
        PasswordResetTokenEntity token = new PasswordResetTokenEntity(
                user.getId(),
                user.getEmail(),
                code,
                Instant.now().plus(VERIFICATION_CODE_TTL)
        );

        if (!existingTokens.isEmpty()) {
            passwordResetTokenRepository.saveAll(existingTokens);
        }
        passwordResetTokenRepository.save(token);
        verificationMailService.sendPasswordResetCode(user.getEmail(), code);
    }

    private void issueVerificationCode(UserEntity user) {
        String code = generateVerificationCode();
        EmailVerificationTokenEntity token = new EmailVerificationTokenEntity(
                user.getId(),
                user.getEmail(),
                code,
                Instant.now().plus(VERIFICATION_CODE_TTL)
        );
        emailVerificationTokenRepository.save(token);
        verificationMailService.sendVerificationCode(user.getEmail(), code);
    }

    private String generateVerificationCode() {
        return String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
    }

    private AuthResponseDto toResponse(UserEntity user) {
        return new AuthResponseDto(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getSocialProvider(),
                isAdminUser(user)
        );
    }

    private Set<String> resolveAdminEmails() {
        if (adminEmails == null || adminEmails.isBlank()) {
            return Set.of();
        }

        return Arrays.stream(adminEmails.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }
}
