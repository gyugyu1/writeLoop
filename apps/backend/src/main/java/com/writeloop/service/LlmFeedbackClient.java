package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LlmFeedbackClient {

    private final Map<String, FeedbackLlmEngine> enginesByProvider;
    private final String configuredProvider;

    public LlmFeedbackClient(
            List<FeedbackLlmEngine> engines,
            @Value("${llm.feedback-provider:gemini}") String configuredProvider
    ) {
        Map<String, FeedbackLlmEngine> mapping = new LinkedHashMap<>();
        for (FeedbackLlmEngine engine : engines) {
            if (engine == null || engine.provider() == null || engine.provider().isBlank()) {
                continue;
            }
            mapping.put(engine.provider().trim().toLowerCase(Locale.ROOT), engine);
        }
        this.enginesByProvider = Map.copyOf(mapping);
        this.configuredProvider = configuredProvider == null ? "gemini" : configuredProvider.trim().toLowerCase(Locale.ROOT);
    }

    public boolean isConfigured() {
        return delegate().isConfigured();
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer, List<PromptHintDto> hints, int attemptIndex, String previousAnswer) {
        return delegate().review(prompt, answer, hints, attemptIndex, previousAnswer);
    }

    public boolean isAuthoritativeFeedback(FeedbackResponseDto feedback) {
        return delegate().isAuthoritativeFeedback(feedback);
    }

    public FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback) {
        return delegate().clearInternalMetadata(feedback);
    }

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot() {
        return delegate().takeLastAnalysisSnapshot();
    }

    public List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String learnerAnswer, String correctedAnswer) {
        return delegate().buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, correctedAnswer);
    }

    public List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String correctedAnswer) {
        return delegate().buildPreciseInlineFeedback(learnerAnswer, correctedAnswer);
    }

    private FeedbackLlmEngine delegate() {
        FeedbackLlmEngine configured = enginesByProvider.get(configuredProvider);
        if (configured != null) {
            return configured;
        }

        FeedbackLlmEngine defaultEngine = enginesByProvider.get("gemini");
        if (defaultEngine != null) {
            return defaultEngine;
        }

        if (!enginesByProvider.isEmpty()) {
            return enginesByProvider.values().iterator().next();
        }

        throw new IllegalStateException("No feedback LLM engines are registered");
    }
}
