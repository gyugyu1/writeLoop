package com.writeloop.service;

import com.writeloop.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.util.Locale;
import java.util.regex.Pattern;

final class GuestIdentitySupport {

    private static final Pattern GUEST_ID_PATTERN = Pattern.compile("^guest-[a-z0-9-]{18,120}$");

    private GuestIdentitySupport() {
    }

    static String normalizeGuestId(String guestId) {
        if (guestId == null) {
            return null;
        }

        String normalized = guestId.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }

        if (!GUEST_ID_PATTERN.matcher(normalized).matches()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_GUEST_ID",
                    "게스트 식별자가 올바르지 않아요."
            );
        }

        return normalized;
    }
}
