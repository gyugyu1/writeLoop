package com.writeloop.service;

import com.writeloop.dto.AuthResponseDto;
import com.writeloop.dto.AppleTokenLoginRequestDto;
import com.writeloop.dto.CompleteSocialRegistrationRequestDto;
import com.writeloop.dto.LoginRequestDto;
import com.writeloop.dto.SocialTokenExchangeRequestDto;
import com.writeloop.dto.TokenAuthResponseDto;
import com.writeloop.dto.TokenLogoutRequestDto;
import com.writeloop.dto.TokenRefreshRequestDto;
import com.writeloop.dto.UpdateProfileRequestDto;
import com.writeloop.persistence.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TokenAuthService {

    private final AuthService authService;
    private final AccessTokenService accessTokenService;
    private final RefreshTokenService refreshTokenService;
    private final MobileSocialAuthCodeService mobileSocialAuthCodeService;
    private final AppleIdentityTokenService appleIdentityTokenService;

    public TokenAuthResponseDto login(LoginRequestDto request) {
        UserEntity user = authService.authenticateLocalUser(request);
        authService.recordSuccessfulLogin(user);
        return issueTokens(user);
    }

    // 모바일이 비밀번호를 바꿀 때 쓴다. 비밀번호를 바꾸면 모든 기기의 로그인 유지 토큰을 폐기하므로,
    // 지금 이 기기에는 새 토큰 쌍을 돌려줘 로그인이 이어지게 한다. 다른 기기는 다시 로그인해야 한다.
    public TokenAuthResponseDto updateProfile(
            UpdateProfileRequestDto request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        AuthResponseDto updatedUser = authService.updateProfile(request, httpRequest, httpResponse);
        return issueTokens(authService.findUserEntity(updatedUser.id()));
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

    public TokenAuthResponseDto loginWithApple(AppleTokenLoginRequestDto request) {
        AppleIdentityTokenService.AppleUserProfile profile = appleIdentityTokenService.verify(
                request == null ? null : request.identityToken(),
                request == null ? null : request.fullName()
        );
        UserEntity user = authService.authenticateAppleUser(
                profile.providerUserId(),
                profile.email(),
                profile.displayName()
        );
        authService.recordSuccessfulLogin(user);
        return issueTokens(user);
    }

    public TokenAuthResponseDto completeSocialRegistration(CompleteSocialRegistrationRequestDto request) {
        UserEntity user = authService.completeSocialRegistration(request);
        authService.recordSuccessfulLogin(user);
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
