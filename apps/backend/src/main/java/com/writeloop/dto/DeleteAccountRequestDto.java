package com.writeloop.dto;

public record DeleteAccountRequestDto(
        String confirmationText,
        String currentPassword,
        // Apple 로그인 계정이 탈퇴할 때 앱이 Apple 로그인을 다시 받아 보내는 일회용 코드. 이 코드로 Apple 토큰을 해지한다.
        String appleAuthorizationCode
) {
    public DeleteAccountRequestDto(String confirmationText, String currentPassword) {
        this(confirmationText, currentPassword, null);
    }
}
