package com.writeloop.dto;

public record DiaryFeedbackRequestDto(
        String bodyText,
        String attemptType
) {
}
