package com.writeloop.service;

import com.writeloop.persistence.CoachEvaluationStatus;
import com.writeloop.persistence.CoachInteractionEntity;
import org.springframework.stereotype.Service;

@Service
public class LlmCoachEvaluationClient {

    private final GeminiCoachEvaluationClient delegate;

    public LlmCoachEvaluationClient(GeminiCoachEvaluationClient delegate) {
        this.delegate = delegate;
    }

    public boolean isConfigured() {
        return delegate.isConfigured();
    }

    public String configuredModel() {
        return delegate.configuredModel();
    }

    public CoachEvaluationResult evaluate(CoachInteractionEntity interaction) {
        GeminiCoachEvaluationClient.CoachEvaluationResult result = delegate.evaluate(interaction);
        return new CoachEvaluationResult(
                result.evaluationStatus(),
                result.score(),
                result.verdict(),
                result.summary(),
                result.payloadJson()
        );
    }

    public record CoachEvaluationResult(
            CoachEvaluationStatus evaluationStatus,
            int score,
            String verdict,
            String summary,
            String payloadJson
    ) {
    }
}
