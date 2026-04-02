package com.writeloop.service;

record FeedbackAnalysisSnapshot(
        String provider,
        String model,
        Integer diagnosisResponseStatusCode,
        Integer generationResponseStatusCode,
        Integer regenerationResponseStatusCode,
        FeedbackDiagnosisResult diagnosis,
        AnswerProfile answerProfile,
        SectionPolicy sectionPolicy,
        GeneratedSections finalSections,
        boolean diagnosisFallbackUsed,
        boolean deterministicResponseFallbackUsed,
        boolean retryAttempted
) {
}
