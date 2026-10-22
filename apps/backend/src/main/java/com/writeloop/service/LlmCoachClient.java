package com.writeloop.service;

import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.stereotype.Service;

import java.util.List;

// 코치 LLM 입구. 제공자는 OpenAI 하나다(ADR-0005, ADR-0017).
@Service
public class LlmCoachClient {

    private final CoachLlmEngine engine;

    public LlmCoachClient(CoachLlmEngine engine) {
        this.engine = engine;
    }

    public boolean isConfigured() {
        return engine.isConfigured();
    }

    public String configuredModel() {
        return engine.configuredModel();
    }

    public CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        return engine.help(prompt, userQuestion, hints);
    }

    public String translateMeaningSlot(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    ) {
        return engine.translateMeaningSlot(prompt, userQuestion, family, slot, sourceText);
    }

    public List<CoachSelfDiscoveredCandidateDto> extractSelfDiscoveredExpressions(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments
    ) {
        return engine.extractSelfDiscoveredExpressions(prompt, answer, recommendedExpressions, preservedSegments);
    }
}
