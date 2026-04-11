package com.writeloop.controller;

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
import com.writeloop.dto.SocialTokenExchangeRequestDto;
import com.writeloop.dto.TokenAuthResponseDto;
import com.writeloop.dto.TokenLogoutRequestDto;
import com.writeloop.dto.TokenRefreshRequestDto;
import com.writeloop.dto.UpdateProfileRequestDto;
import com.writeloop.dto.VerifyPasswordResetCodeRequestDto;
import com.writeloop.dto.VerifyEmailRequestDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.TokenAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TokenAuthService tokenAuthService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthNoticeDto register(@RequestBody RegisterRequestDto request) {
        return authService.register(request);
    }

    @PostMapping("/register/send-code")
    @ResponseStatus(HttpStatus.OK)
    public AuthNoticeDto sendRegistrationCode(@RequestBody SendRegistrationCodeRequestDto request) {
        return authService.sendRegistrationCode(request);
    }

    @PostMapping("/register/complete")
    @ResponseStatus(HttpStatus.OK)
    public AuthResponseDto completeRegistration(
            @RequestBody CompleteRegistrationRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        return authService.completeRegistration(request, session, httpRequest, httpResponse);
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public AuthResponseDto login(
            @RequestBody LoginRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        return authService.login(request, session, httpRequest, httpResponse);
    }

    @PostMapping("/token/login")
    @ResponseStatus(HttpStatus.OK)
    public TokenAuthResponseDto tokenLogin(@RequestBody LoginRequestDto request) {
        return tokenAuthService.login(request);
    }

    @PostMapping("/token/refresh")
    @ResponseStatus(HttpStatus.OK)
    public TokenAuthResponseDto refreshToken(@RequestBody TokenRefreshRequestDto request) {
        return tokenAuthService.refresh(request);
    }

    @PostMapping("/token/social/exchange")
    @ResponseStatus(HttpStatus.OK)
    public TokenAuthResponseDto exchangeSocialToken(@RequestBody SocialTokenExchangeRequestDto request) {
        return tokenAuthService.exchangeSocialCode(request);
    }

    @PostMapping("/token/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void tokenLogout(@RequestBody(required = false) TokenLogoutRequestDto request) {
        tokenAuthService.logout(request);
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.OK)
    public AuthResponseDto verifyEmail(
            @RequestBody VerifyEmailRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        return authService.verifyEmail(request, session, httpRequest, httpResponse);
    }

    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.OK)
    public AuthNoticeDto resendVerification(@RequestBody ResendVerificationRequestDto request) {
        return authService.resendVerificationEmail(request);
    }

    @PostMapping("/password-reset/check-email")
    @ResponseStatus(HttpStatus.OK)
    public PasswordResetAvailabilityDto checkPasswordResetEmail(
            @RequestBody SendPasswordResetCodeRequestDto request
    ) {
        return authService.checkPasswordResetEmail(request);
    }

    @PostMapping("/password-reset/send-code")
    @ResponseStatus(HttpStatus.OK)
    public AuthNoticeDto sendPasswordResetCode(@RequestBody SendPasswordResetCodeRequestDto request) {
        return authService.sendPasswordResetCode(request);
    }

    @PostMapping("/password-reset/verify-code")
    @ResponseStatus(HttpStatus.OK)
    public AuthNoticeDto verifyPasswordResetCode(@RequestBody VerifyPasswordResetCodeRequestDto request) {
        return authService.verifyPasswordResetCode(request);
    }

    @PostMapping("/password-reset/complete")
    @ResponseStatus(HttpStatus.OK)
    public AuthNoticeDto resetPassword(@RequestBody ResetPasswordRequestDto request) {
        return authService.resetPassword(request);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        authService.logout(session, request, response);
    }

    @GetMapping("/me")
    @ResponseStatus(HttpStatus.OK)
    public AuthResponseDto me(HttpServletRequest request) {
        return authService.getCurrentUser(request);
    }

    @PostMapping("/profile")
    @ResponseStatus(HttpStatus.OK)
    public AuthResponseDto updateProfile(
            @RequestBody UpdateProfileRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return authService.updateProfile(request, httpRequest);
    }

    @DeleteMapping("/account")
    @ResponseStatus(HttpStatus.OK)
    public AuthNoticeDto deleteAccount(
            @RequestBody DeleteAccountRequestDto request,
            HttpSession session,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        return authService.deleteAccount(request, session, httpRequest, httpResponse);
    }

    @GetMapping("/social/naver/start")
    public void startNaverLogin(
            @RequestParam(name = "returnTo", required = false) String returnTo,
            @RequestParam(name = "remember", defaultValue = "false") boolean rememberMe,
            @RequestParam(name = "appRedirect", required = false) String appRedirect,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        authService.startNaverLogin(returnTo, rememberMe, appRedirect, session, response);
    }

    @GetMapping("/social/naver/callback")
    public void finishNaverLogin(
            @RequestParam("code") String code,
            @RequestParam("state") String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        authService.finishNaverLogin(code, state, session, request, response);
    }

    @GetMapping("/social/google/start")
    public void startGoogleLogin(
            @RequestParam(name = "returnTo", required = false) String returnTo,
            @RequestParam(name = "remember", defaultValue = "false") boolean rememberMe,
            @RequestParam(name = "appRedirect", required = false) String appRedirect,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        authService.startGoogleLogin(returnTo, rememberMe, appRedirect, session, response);
    }

    @GetMapping("/social/google/callback")
    public void finishGoogleLogin(
            @RequestParam("code") String code,
            @RequestParam("state") String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        authService.finishGoogleLogin(code, state, session, request, response);
    }

    @GetMapping("/social/kakao/start")
    public void startKakaoLogin(
            @RequestParam(name = "returnTo", required = false) String returnTo,
            @RequestParam(name = "remember", defaultValue = "false") boolean rememberMe,
            @RequestParam(name = "appRedirect", required = false) String appRedirect,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        authService.startKakaoLogin(returnTo, rememberMe, appRedirect, session, response);
    }

    @GetMapping("/social/kakao/callback")
    public void finishKakaoLogin(
            @RequestParam("code") String code,
            @RequestParam("state") String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        authService.finishKakaoLogin(code, state, session, request, response);
    }
}
