package com.writeloop.service;

import com.writeloop.dto.DiaryFeedbackResponseDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LlmDiaryFeedbackClient {

    private final Map<String, DiaryFeedbackLlmEngine> enginesByProvider;
    private final String configuredProvider;

    public LlmDiaryFeedbackClient(
            List<DiaryFeedbackLlmEngine> engines,
            @Value("${llm.diary-feedback-provider:${llm.feedback-provider:gemini}}") String configuredProvider
    ) {
        Map<String, DiaryFeedbackLlmEngine> mapping = new LinkedHashMap<>();
        for (DiaryFeedbackLlmEngine engine : engines) {
            if (engine == null || engine.provider() == null || engine.provider().isBlank()) {
                continue;
            }
            mapping.put(engine.provider().trim().toLowerCase(Locale.ROOT), engine);
        }
        this.enginesByProvider = Map.copyOf(mapping);
        this.configuredProvider = configuredProvider == null
                ? "gemini"
                : configuredProvider.trim().toLowerCase(Locale.ROOT);
    }

    public boolean isConfigured() {
        return delegate().isConfigured();
    }

    public String provider() {
        return delegate().provider();
    }

    public DiaryFeedbackResponseDto review(DiaryFeedbackPromptContext context) {
        return delegate().review(context).withIdentity(context.entryId(), context.attemptNo());
    }

    private DiaryFeedbackLlmEngine delegate() {
        DiaryFeedbackLlmEngine configured = enginesByProvider.get(configuredProvider);
        if (configured != null) {
            return configured;
        }

        DiaryFeedbackLlmEngine defaultEngine = enginesByProvider.get("gemini");
        if (defaultEngine != null) {
            return defaultEngine;
        }

        if (!enginesByProvider.isEmpty()) {
            return enginesByProvider.values().iterator().next();
        }

        throw new IllegalStateException("No diary feedback LLM engines are registered");
    }
}
