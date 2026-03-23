package com.writeloop.dto;

public record UpdateProfileRequestDto(
        String displayName,
        String currentPassword,
        String newPassword
) {
}
