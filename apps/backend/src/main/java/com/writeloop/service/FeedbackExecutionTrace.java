package com.writeloop.service;

record FeedbackExecutionTrace(
        String provider,
        String model,
        String reasoningEffort,
        Integer thinkingBudget,
        Integer initialResponseStatusCode,
        String initialResponseBodyJson,
        Integer retryResponseStatusCode,
        String retryResponseBodyJson,
        boolean contractViolationDetected,
        boolean retryAttempted,
        Boolean retrySucceeded,
        boolean finalSuccess,
        String originalContractErrorReason,
        String finalErrorReason,
        FeedbackTokenUsage tokenUsage,
        long elapsedMs
) {

    FeedbackExecutionTrace {
        tokenUsage = tokenUsage == null ? FeedbackTokenUsage.empty() : tokenUsage;
    }

    FeedbackExecutionTrace(
            String provider,
            String model,
            String reasoningEffort,
            Integer thinkingBudget,
            Integer initialResponseStatusCode,
            String initialResponseBodyJson,
            Integer retryResponseStatusCode,
            String retryResponseBodyJson,
            boolean contractViolationDetected,
            boolean retryAttempted,
            Boolean retrySucceeded,
            boolean finalSuccess,
            String originalContractErrorReason,
            String finalErrorReason,
            long elapsedMs
    ) {
        this(
                provider,
                model,
                reasoningEffort,
                thinkingBudget,
                initialResponseStatusCode,
                initialResponseBodyJson,
                retryResponseStatusCode,
                retryResponseBodyJson,
                contractViolationDetected,
                retryAttempted,
                retrySucceeded,
                finalSuccess,
                originalContractErrorReason,
                finalErrorReason,
                FeedbackTokenUsage.empty(),
                elapsedMs
        );
    }

    FeedbackExecutionTrace asFailure(String errorReason) {
        return new FeedbackExecutionTrace(
                provider,
                model,
                reasoningEffort,
                thinkingBudget,
                initialResponseStatusCode,
                initialResponseBodyJson,
                retryResponseStatusCode,
                retryResponseBodyJson,
                contractViolationDetected,
                retryAttempted,
                retrySucceeded,
                false,
                originalContractErrorReason,
                errorReason,
                tokenUsage,
                elapsedMs
        );
    }

    static FeedbackExecutionTrace successful(FeedbackAnalysisSnapshot snapshot) {
        return successful(snapshot, FeedbackTokenUsage.empty());
    }

    static FeedbackExecutionTrace successful(
            FeedbackAnalysisSnapshot snapshot,
            FeedbackTokenUsage tokenUsage
    ) {
        FeedbackContractRetryTrace retry = snapshot.contractRetry();
        return new FeedbackExecutionTrace(
                snapshot.provider(),
                snapshot.model(),
                null,
                null,
                retry.attempted() ? retry.originalResponseStatusCode() : snapshot.responseStatusCode(),
                retry.attempted() ? retry.originalResponseBodyJson() : snapshot.responseBodyJson(),
                retry.retryResponseStatusCode(),
                retry.retryResponseBodyJson(),
                retry.attempted(),
                retry.attempted(),
                retry.succeeded(),
                true,
                retry.originalErrorReason(),
                null,
                tokenUsage,
                0L
        );
    }
}
