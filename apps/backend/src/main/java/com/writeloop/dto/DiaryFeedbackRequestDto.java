package com.writeloop.dto;

public record DiaryFeedbackRequestDto(
        String bodyText,
        String attemptType,
        // 교정 일기·모범 일기·모범 일기 번역을 함께 만들지. 화면에 보여 주는 웹만 true로 보낸다.
        Boolean includeFullDiaries
) {
    public DiaryFeedbackRequestDto(String bodyText, String attemptType) {
        this(bodyText, attemptType, null);
    }

    public boolean wantsFullDiaries() {
        return Boolean.TRUE.equals(includeFullDiaries);
    }
}
