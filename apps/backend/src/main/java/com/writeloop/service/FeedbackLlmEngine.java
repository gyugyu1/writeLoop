package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;

import java.util.List;

interface FeedbackLlmEngine {

    String provider();

    boolean isConfigured();

    FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    );

    boolean isAuthoritativeFeedback(FeedbackResponseDto feedback);

    FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback);

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot();

    List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String learnerAnswer, String correctedAnswer);

    List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String correctedAnswer);
}
