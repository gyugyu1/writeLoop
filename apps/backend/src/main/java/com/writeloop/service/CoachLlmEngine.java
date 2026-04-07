package com.writeloop.service;

import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;

import java.util.List;

interface CoachLlmEngine {

    String provider();

    boolean isConfigured();

    String configuredModel();

    CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints);

    String translateMeaningSlot(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    );

    List<CoachSelfDiscoveredCandidateDto> extractSelfDiscoveredExpressions(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments
    );
}
