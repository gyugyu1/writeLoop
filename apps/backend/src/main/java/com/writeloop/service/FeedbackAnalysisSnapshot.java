package com.writeloop.service;

record FeedbackAnalysisSnapshot(
        String provider,
        String model,
        Integer responseStatusCode,
        String responseBodyJson,
        FeedbackDiagnosisResult diagnosis,
        GeneratedSections finalSections
) {
}
