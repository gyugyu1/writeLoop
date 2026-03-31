package com.writeloop.service;

import com.writeloop.persistence.RememberLoginTokenEntity;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.UserEntity;
import com.writeloop.persistence.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RememberLoginServiceTest {

    @Mock
    private RememberLoginTokenRepository rememberLoginTokenRepository;

    @Mock
    private UserRepository userRepository;

    private RememberLoginService rememberLoginService;

    @BeforeEach
    void setUp() {
        rememberLoginService = new RememberLoginService(rememberLoginTokenRepository, userRepository);
        ReflectionTestUtils.setField(rememberLoginService, "rememberMeDays", 30L);
    }

    @Test
    void tryAuthenticateFromCookie_records_last_login_at_for_restored_session() {
        String rawToken = "remember-token";
        String tokenHash = ReflectionTestUtils.invokeMethod(rememberLoginService, "hash", rawToken);
        RememberLoginTokenEntity token = new RememberLoginTokenEntity(
                11L,
                tokenHash,
                Instant.now().plusSeconds(3600)
        );
        UserEntity user = new UserEntity("user@example.com", "encoded", "Writer");
        ReflectionTestUtils.setField(user, "id", 11L);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(RememberLoginService.COOKIE_NAME, rawToken));
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(rememberLoginTokenRepository.findFirstByTokenHashAndRevokedAtIsNull(tokenHash))
                .thenReturn(Optional.of(token));
        when(userRepository.findById(11L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenAnswer(invocation -> invocation.getArgument(0));

        rememberLoginService.tryAuthenticateFromCookie(request, response);

        HttpSession session = request.getSession(false);
        assertThat(session).isNotNull();
        assertThat(session.getAttribute(AuthService.SESSION_USER_ID)).isEqualTo(11L);

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getLastLoginAt()).isNotNull();
    }
}
