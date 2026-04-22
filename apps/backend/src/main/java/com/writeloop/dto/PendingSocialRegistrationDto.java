package com.writeloop.dto;

public record PendingSocialRegistrationDto(
        String provider,
        String suggestedDisplayName,
        String returnTo
) {
}
