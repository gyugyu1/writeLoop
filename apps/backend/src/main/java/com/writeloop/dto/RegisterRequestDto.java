package com.writeloop.dto;

public record RegisterRequestDto(
        String email,
        String password,
        String displayName
) {
}
