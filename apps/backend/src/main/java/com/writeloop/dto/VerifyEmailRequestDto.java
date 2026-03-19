package com.writeloop.dto;

public record VerifyEmailRequestDto(
        String email,
        String code
) {
}
