package com.writeloop.dto;

public record AppleTokenLoginRequestDto(
        String identityToken,
        String email,
        String fullName
) {
}
