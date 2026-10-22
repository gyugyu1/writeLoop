package com.writeloop.service;

import java.time.LocalDate;

record DiaryFeedbackPromptContext(
        String entryId,
        int attemptNo,
        String title,
        LocalDate entryDate,
        String mood,
        String diaryText,
        String previousDiaryText,
        // 교정 일기·모범 일기·모범 일기 번역을 생성할지(웹 요청만 true)
        boolean includeFullDiaries
) {
}
