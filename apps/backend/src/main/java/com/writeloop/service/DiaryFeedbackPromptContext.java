package com.writeloop.service;

import java.time.LocalDate;

record DiaryFeedbackPromptContext(
        String entryId,
        int attemptNo,
        String title,
        LocalDate entryDate,
        String mood,
        String diaryText,
        String previousDiaryText
) {
}
