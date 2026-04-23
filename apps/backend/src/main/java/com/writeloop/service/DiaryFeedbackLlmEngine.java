package com.writeloop.service;

import com.writeloop.dto.DiaryFeedbackResponseDto;

interface DiaryFeedbackLlmEngine {

    String provider();

    String model();

    boolean isConfigured();

    DiaryFeedbackResponseDto review(DiaryFeedbackPromptContext context);
}
