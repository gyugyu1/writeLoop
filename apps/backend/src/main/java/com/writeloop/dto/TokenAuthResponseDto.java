package com.writeloop.dto;

public record TokenAuthResponseDto(
        AuthResponseDto user,
        String accessToken,
        String refreshToken,
        long accessTokenExpiresInSeconds,
        long refreshTokenExpiresInSeconds
) {
}
