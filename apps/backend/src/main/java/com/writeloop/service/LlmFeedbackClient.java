package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.stereotype.Service;

import java.util.List;

// 문장 피드백 LLM 입구. 제공자는 OpenAI 하나다(ADR-0005, ADR-0017).
@Service
public class LlmFeedbackClient {

    private final FeedbackLlmEngine engine;

    public LlmFeedbackClient(FeedbackLlmEngine engine) {
        this.engine = engine;
    }

    public boolean isConfigured() {
        return engine.isConfigured();
    }

    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex
    ) {
        return engine.review(prompt, answer, hints, attemptIndex);
    }

    public boolean isAuthoritativeFeedback(FeedbackResponseDto feedback) {
        return engine.isAuthoritativeFeedback(feedback);
    }

    public FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback) {
        return engine.clearInternalMetadata(feedback);
    }

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot() {
        return engine.takeLastAnalysisSnapshot();
    }

    FeedbackExecutionTrace takeLastExecutionTrace() {
        return engine.takeLastExecutionTrace();
    }

    public List<InlineFeedbackSegmentDto> buildInlineFeedbackFromRevisedAnswer(String learnerAnswer, String revisedAnswer) {
        return engine.buildInlineFeedbackFromRevisedAnswer(learnerAnswer, revisedAnswer);
    }

    public List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String revisedAnswer) {
        return engine.buildPreciseInlineFeedback(learnerAnswer, revisedAnswer);
    }
}
