package com.writeloop.dto;

public record PasswordResetAvailabilityDto(
        String email,
        boolean available,
        String message
) {
}
