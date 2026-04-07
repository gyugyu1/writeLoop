package com.writeloop.service;

import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LlmCoachClient {

    private final Map<String, CoachLlmEngine> enginesByProvider;
    private final String configuredProvider;

    public LlmCoachClient(
            List<CoachLlmEngine> engines,
            @Value("${llm.coach-provider:${llm.feedback-provider:gemini}}") String configuredProvider
    ) {
        Map<String, CoachLlmEngine> mapping = new LinkedHashMap<>();
        for (CoachLlmEngine engine : engines) {
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

    public String configuredModel() {
        return delegate().configuredModel();
    }

    public CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        return delegate().help(prompt, userQuestion, hints);
    }

    public String translateMeaningSlot(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    ) {
        return delegate().translateMeaningSlot(prompt, userQuestion, family, slot, sourceText);
    }

    public List<CoachSelfDiscoveredCandidateDto> extractSelfDiscoveredExpressions(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments
    ) {
        return delegate().extractSelfDiscoveredExpressions(prompt, answer, recommendedExpressions, preservedSegments);
    }

    private CoachLlmEngine delegate() {
        CoachLlmEngine configured = enginesByProvider.get(configuredProvider);
        if (configured != null) {
            return configured;
        }

        CoachLlmEngine defaultEngine = enginesByProvider.get("gemini");
        if (defaultEngine != null) {
            return defaultEngine;
        }

        if (!enginesByProvider.isEmpty()) {
            return enginesByProvider.values().iterator().next();
        }

        throw new IllegalStateException("No coach LLM engines are registered");
    }
}
