package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
class OpenAiFeedbackEngine implements FeedbackLlmEngine {

    private final OpenAiFeedbackClient delegate;

    OpenAiFeedbackEngine(OpenAiFeedbackClient delegate) {
        this.delegate = delegate;
    }

    @Override
    public String provider() {
        return "openai";
    }

    @Override
    public boolean isConfigured() {
        return delegate.isConfigured();
    }

    @Override
    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    ) {
        return delegate.review(prompt, answer, hints, attemptIndex, previousAnswer);
    }

    @Override
    public boolean isAuthoritativeFeedback(FeedbackResponseDto feedback) {
        return delegate.isAuthoritativeFeedback(feedback);
    }

    @Override
    public FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback) {
        return delegate.clearInternalMetadata(feedback);
    }

    @Override
    public FeedbackAnalysisSnapshot takeLastAnalysisSnapshot() {
        return delegate.takeLastAnalysisSnapshot();
    }

    @Override
    public List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String learnerAnswer, String correctedAnswer) {
        return delegate.buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, correctedAnswer);
    }

    @Override
    public List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String correctedAnswer) {
        return delegate.buildPreciseInlineFeedback(learnerAnswer, correctedAnswer);
    }
}
