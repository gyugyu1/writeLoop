package com.writeloop.service;

import com.writeloop.dto.AuthResponseDto;
import com.writeloop.dto.TokenAuthResponseDto;
import com.writeloop.dto.UpdateProfileRequestDto;
import com.writeloop.persistence.UserEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenAuthServiceTest {

    @Mock
    private AuthService authService;

    @Mock
    private AccessTokenService accessTokenService;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private MobileSocialAuthCodeService mobileSocialAuthCodeService;

    @Mock
    private AppleIdentityTokenService appleIdentityTokenService;

    @InjectMocks
    private TokenAuthService tokenAuthService;

    @Test
    void passwordChangeFromMobileReturnsFreshTokensForThisDevice() {
        UserEntity user = new UserEntity("user@example.com", "encoded-password", "Writer");
        ReflectionTestUtils.setField(user, "id", 7L);
        AuthResponseDto authUser = new AuthResponseDto(7L, "user@example.com", "Writer", null, false);
        UpdateProfileRequestDto request = new UpdateProfileRequestDto("Writer", "old-password", "new-password");
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        MockHttpServletResponse httpResponse = new MockHttpServletResponse();
        when(authService.updateProfile(eq(request), any(), any())).thenReturn(authUser);
        when(authService.findUserEntity(7L)).thenReturn(user);
        when(authService.toAuthResponse(user)).thenReturn(authUser);
        when(accessTokenService.issueAccessToken(7L)).thenReturn("new-access-token");
        when(refreshTokenService.issue(7L)).thenReturn(new RefreshTokenService.IssuedRefreshToken("new-refresh-token", 2_592_000L));

        // 비밀번호 변경은 모든 기기의 로그인 유지 토큰을 폐기한다. 이 기기는 새 토큰으로 로그인을 이어 간다.
        TokenAuthResponseDto response = tokenAuthService.updateProfile(request, httpRequest, httpResponse);

        assertThat(response.user()).isEqualTo(authUser);
        assertThat(response.accessToken()).isEqualTo("new-access-token");
        assertThat(response.refreshToken()).isEqualTo("new-refresh-token");
    }
}
