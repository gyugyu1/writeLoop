package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
class GeminiFeedbackEngine implements FeedbackLlmEngine {

    private final GeminiFeedbackClient delegate;

    GeminiFeedbackEngine(GeminiFeedbackClient delegate) {
        this.delegate = delegate;
    }

    @Override
    public String provider() {
        return "gemini";
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
    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer,
            String previousCoachingSummary
    ) {
        return delegate.review(prompt, answer, hints, attemptIndex, previousAnswer, previousCoachingSummary);
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
    public FeedbackExecutionTrace takeLastExecutionTrace() {
        return delegate.takeLastExecutionTrace();
    }

    @Override
    public List<InlineFeedbackSegmentDto> buildInlineFeedbackFromRevisedAnswer(String learnerAnswer, String revisedAnswer) {
        return delegate.buildInlineFeedbackFromRevisedAnswer(learnerAnswer, revisedAnswer);
    }

    @Override
    public List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String revisedAnswer) {
        return delegate.buildPreciseInlineFeedback(learnerAnswer, revisedAnswer);
    }
}
