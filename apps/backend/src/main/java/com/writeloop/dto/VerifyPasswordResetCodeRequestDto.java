package com.writeloop.dto;

public record VerifyPasswordResetCodeRequestDto(
        String email,
        String code
) {
}
