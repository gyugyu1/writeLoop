package com.writeloop.service;

import com.writeloop.dto.DiaryFeedbackResponseDto;

interface DiaryFeedbackLlmEngine {

    String provider();

    boolean isConfigured();

    DiaryFeedbackResponseDto review(DiaryFeedbackPromptContext context);
}
