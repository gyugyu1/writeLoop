package com.writeloop.dto;

public record CompleteRegistrationRequestDto(
        String email,
        String code,
        String password,
        String displayName
) {
}
