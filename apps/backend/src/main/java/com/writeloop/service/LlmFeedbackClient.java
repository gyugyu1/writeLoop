package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LlmFeedbackClient {

    private final GeminiFeedbackClient delegate;

    public LlmFeedbackClient(GeminiFeedbackClient delegate) {
        this.delegate = delegate;
    }

    public boolean isConfigured() {
        return delegate.isConfigured();
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer, List<PromptHintDto> hints, int attemptIndex, String previousAnswer) {
        return delegate.review(prompt, answer, hints, attemptIndex, previousAnswer);
    }

    public boolean isAuthoritativeFeedback(FeedbackResponseDto feedback) {
        return delegate.isAuthoritativeFeedback(feedback);
    }

    public FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback) {
        return delegate.clearInternalMetadata(feedback);
    }

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot() {
        return delegate.takeLastAnalysisSnapshot();
    }

    public List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String learnerAnswer, String correctedAnswer) {
        return delegate.buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, correctedAnswer);
    }

    public List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String correctedAnswer) {
        return delegate.buildPreciseInlineFeedback(learnerAnswer, correctedAnswer);
    }
}
