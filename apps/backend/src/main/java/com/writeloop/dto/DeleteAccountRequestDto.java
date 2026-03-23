package com.writeloop.dto;

public record DeleteAccountRequestDto(
        String confirmationText,
        String currentPassword
) {
}
