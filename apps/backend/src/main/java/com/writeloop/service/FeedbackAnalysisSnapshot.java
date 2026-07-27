package com.writeloop.service;

record FeedbackAnalysisSnapshot(
        String provider,
        String model,
        Integer responseStatusCode,
        String responseBodyJson,
        FeedbackDiagnosisResult diagnosis,
        GeneratedSections finalSections,
        FeedbackContractRetryTrace contractRetry
) {

    FeedbackAnalysisSnapshot(
            String provider,
            String model,
            Integer responseStatusCode,
            String responseBodyJson,
            FeedbackDiagnosisResult diagnosis,
            GeneratedSections finalSections
    ) {
        this(
                provider,
                model,
                responseStatusCode,
                responseBodyJson,
                diagnosis,
                finalSections,
                FeedbackContractRetryTrace.notAttempted()
        );
    }

    FeedbackAnalysisSnapshot {
        contractRetry = contractRetry == null
                ? FeedbackContractRetryTrace.notAttempted()
                : contractRetry;
    }
}
