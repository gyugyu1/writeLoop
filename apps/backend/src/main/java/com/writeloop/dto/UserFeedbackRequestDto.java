package com.writeloop.dto;

public record UserFeedbackRequestDto(
        String category,
        String message,
        String contactEmail,
        String sourceScreen,
        String appVersion,
        String platform,
        String osVersion,
        String deviceModel,
        String errorCode
) {
}
