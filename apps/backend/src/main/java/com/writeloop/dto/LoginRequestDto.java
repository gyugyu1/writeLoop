package com.writeloop.dto;

public record LoginRequestDto(
        String email,
        String password,
        Boolean rememberMe
) {
}
