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
            int attemptIndex
    );

    // 다시 쓴 답: 바로 앞 시도의 답·미션·판정을 함께 넘긴다.
    FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            PreviousAttemptContext previousAttempt
    );

    boolean isAuthoritativeFeedback(FeedbackResponseDto feedback);

    FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback);

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot();

    FeedbackExecutionTrace takeLastExecutionTrace();

    List<InlineFeedbackSegmentDto> buildInlineFeedbackFromRevisedAnswer(String learnerAnswer, String revisedAnswer);

    List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String revisedAnswer);
}
