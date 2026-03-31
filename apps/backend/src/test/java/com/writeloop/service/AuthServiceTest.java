package com.writeloop.service;

import com.writeloop.dto.AuthResponseDto;
import com.writeloop.dto.LoginRequestDto;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.EmailVerificationTokenRepository;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.UserEntity;
import com.writeloop.persistence.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private CoachInteractionRepository coachInteractionRepository;

    @Mock
    private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private VerificationMailService verificationMailService;

    @Mock
    private RememberLoginService rememberLoginService;

    @Mock
    private NaverOAuthService naverOAuthService;

    @Mock
    private GoogleOAuthService googleOAuthService;

    @Mock
    private KakaoOAuthService kakaoOAuthService;

    @Mock
    private HttpSession session;

    @Mock
    private HttpServletRequest httpRequest;

    @Mock
    private HttpServletResponse httpResponse;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                answerSessionRepository,
                answerAttemptRepository,
                coachInteractionRepository,
                emailVerificationTokenRepository,
                passwordResetTokenRepository,
                passwordEncoder,
                verificationMailService,
                rememberLoginService,
                naverOAuthService,
                googleOAuthService,
                kakaoOAuthService
        );
        ReflectionTestUtils.setField(authService, "adminEmails", "");
    }

    @Test
    void login_records_last_login_at_when_credentials_are_valid() {
        UserEntity user = new UserEntity("user@example.com", "encoded-password", "Writer");
        user.markEmailVerified();
        ReflectionTestUtils.setField(user, "id", 7L);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
        when(userRepository.save(user)).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponseDto response = authService.login(
                new LoginRequestDto("user@example.com", "password123", false),
                session,
                httpRequest,
                httpResponse
        );

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        verify(session).setAttribute(AuthService.SESSION_USER_ID, 7L);

        UserEntity savedUser = userCaptor.getValue();
        assertThat(savedUser.getLastLoginAt()).isNotNull();
        assertThat(savedUser.getLastLoginAt()).isAfterOrEqualTo(savedUser.getVerifiedAt());
        assertThat(response.id()).isEqualTo(7L);
        assertThat(response.email()).isEqualTo("user@example.com");
    }
}
