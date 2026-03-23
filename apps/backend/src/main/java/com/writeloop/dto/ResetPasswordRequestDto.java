package com.writeloop.dto;

public record ResetPasswordRequestDto(
        String email,
        String code,
        String newPassword
) {
}
