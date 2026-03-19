package com.writeloop.dto;

public record AuthResponseDto(
        Long id,
        String email,
        String displayName,
        String socialProvider,
        boolean admin
) {
}
