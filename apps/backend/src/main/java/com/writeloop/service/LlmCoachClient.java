package com.writeloop.service;

import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LlmCoachClient {

    private final GeminiCoachClient delegate;

    public LlmCoachClient(GeminiCoachClient delegate) {
        this.delegate = delegate;
    }

    public boolean isConfigured() {
        return delegate.isConfigured();
    }

    public String configuredModel() {
        return delegate.configuredModel();
    }

    public CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        return delegate.help(prompt, userQuestion, hints);
    }

    public String translateMeaningSlot(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    ) {
        return delegate.translateMeaningSlot(prompt, userQuestion, family, slot, sourceText);
    }

    public List<CoachSelfDiscoveredCandidateDto> extractSelfDiscoveredExpressions(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments
    ) {
        return delegate.extractSelfDiscoveredExpressions(prompt, answer, recommendedExpressions, preservedSegments);
    }
}
