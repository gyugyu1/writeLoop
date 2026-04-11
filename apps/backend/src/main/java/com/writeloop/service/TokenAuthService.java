package com.writeloop.service;

import com.writeloop.dto.AuthResponseDto;
import com.writeloop.dto.LoginRequestDto;
import com.writeloop.dto.SocialTokenExchangeRequestDto;
import com.writeloop.dto.TokenAuthResponseDto;
import com.writeloop.dto.TokenLogoutRequestDto;
import com.writeloop.dto.TokenRefreshRequestDto;
import com.writeloop.persistence.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TokenAuthService {

    private final AuthService authService;
    private final AccessTokenService accessTokenService;
    private final RefreshTokenService refreshTokenService;
    private final MobileSocialAuthCodeService mobileSocialAuthCodeService;

    public TokenAuthResponseDto login(LoginRequestDto request) {
        UserEntity user = authService.authenticateLocalUser(request);
        authService.recordSuccessfulLogin(user);
        return issueTokens(user);
    }

    public TokenAuthResponseDto refresh(TokenRefreshRequestDto request) {
        Long userId = refreshTokenService.requireUserId(request == null ? null : request.refreshToken());
        UserEntity user = authService.findUserEntity(userId);
        refreshTokenService.revoke(request.refreshToken());
        return issueTokens(user);
    }

    public void logout(TokenLogoutRequestDto request) {
        refreshTokenService.revoke(request == null ? null : request.refreshToken());
    }

    public TokenAuthResponseDto exchangeSocialCode(SocialTokenExchangeRequestDto request) {
        Long userId = mobileSocialAuthCodeService.consume(request == null ? null : request.code());
        UserEntity user = authService.findUserEntity(userId);
        return issueTokens(user);
    }

    public void authenticateRequest(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || authorization.isBlank() || !authorization.startsWith("Bearer ")) {
            return;
        }

        Long userId = accessTokenService.parseUserId(authorization.substring("Bearer ".length()).trim());
        request.setAttribute(AuthService.REQUEST_USER_ID_ATTRIBUTE, userId);
    }

    private TokenAuthResponseDto issueTokens(UserEntity user) {
        AuthResponseDto authUser = authService.toAuthResponse(user);
        String accessToken = accessTokenService.issueAccessToken(user.getId());
        RefreshTokenService.IssuedRefreshToken refreshToken = refreshTokenService.issue(user.getId());

        return new TokenAuthResponseDto(
                authUser,
                accessToken,
                refreshToken.token(),
                accessTokenService.getAccessTokenExpiresInSeconds(),
                refreshToken.expiresInSeconds()
        );
    }
}
