package com.writeloop.service;

import com.writeloop.dto.DiaryFeedbackResponseDto;
import org.springframework.stereotype.Service;

// 영어일기 피드백 LLM 입구. 제공자는 OpenAI 하나다(ADR-0005, ADR-0017).
@Service
public class LlmDiaryFeedbackClient {

    private final DiaryFeedbackLlmEngine engine;

    public LlmDiaryFeedbackClient(DiaryFeedbackLlmEngine engine) {
        this.engine = engine;
    }

    public boolean isConfigured() {
        return engine.isConfigured();
    }

    public String provider() {
        return engine.provider();
    }

    public String model() {
        return engine.model();
    }

    public DiaryFeedbackResponseDto review(DiaryFeedbackPromptContext context) {
        return engine.review(context).withIdentity(context.entryId(), context.attemptNo());
    }
}
