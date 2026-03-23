package com.writeloop.controller;

import com.writeloop.dto.AuthNoticeDto;
import com.writeloop.dto.AuthResponseDto;
import com.writeloop.dto.LoginRequestDto;
import com.writeloop.dto.PasswordResetAvailabilityDto;
import com.writeloop.dto.ResetPasswordRequestDto;
import com.writeloop.dto.RegisterRequestDto;
import com.writeloop.dto.ResendVerificationRequestDto;
import com.writeloop.dto.SendPasswordResetCodeRequestDto;
import com.writeloop.dto.UpdateProfileRequestDto;
import com.writeloop.dto.VerifyPasswordResetCodeRequestDto;
import com.writeloop.dto.VerifyEmailRequestDto;
import com.writeloop.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
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

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthNoticeDto register(@RequestBody RegisterRequestDto request) {
        return authService.register(request);
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
    public AuthResponseDto me(HttpSession session) {
        return authService.getCurrentUser(session);
    }

    @PostMapping("/profile")
    @ResponseStatus(HttpStatus.OK)
    public AuthResponseDto updateProfile(
            @RequestBody UpdateProfileRequestDto request,
            HttpSession session
    ) {
        return authService.updateProfile(request, session);
    }
    @GetMapping("/social/naver/start")
    public void startNaverLogin(
            @RequestParam(name = "returnTo", required = false) String returnTo,
            @RequestParam(name = "remember", defaultValue = "false") boolean rememberMe,
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        authService.startNaverLogin(returnTo, rememberMe, session, response);
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
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        authService.startGoogleLogin(returnTo, rememberMe, session, response);
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
            HttpSession session,
            HttpServletResponse response
    ) throws IOException {
        authService.startKakaoLogin(returnTo, rememberMe, session, response);
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
