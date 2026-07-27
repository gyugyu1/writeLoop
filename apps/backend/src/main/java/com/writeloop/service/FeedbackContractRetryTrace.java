package com.writeloop.service;

record FeedbackContractRetryTrace(
        boolean attempted,
        String originalErrorReason,
        Integer originalResponseStatusCode,
        String originalResponseBodyJson,
        Boolean succeeded,
        Integer retryResponseStatusCode,
        String retryResponseBodyJson
) {

    static FeedbackContractRetryTrace notAttempted() {
        return new FeedbackContractRetryTrace(false, null, null, null, null, null, null);
    }

    static FeedbackContractRetryTrace recovered(
            String originalErrorReason,
            Integer originalResponseStatusCode,
            String originalResponseBodyJson,
            Integer retryResponseStatusCode,
            String retryResponseBodyJson
    ) {
        return new FeedbackContractRetryTrace(
                true,
                normalize(originalErrorReason),
                originalResponseStatusCode,
                normalize(originalResponseBodyJson),
                true,
                retryResponseStatusCode,
                normalize(retryResponseBodyJson)
        );
    }

    FeedbackContractRetryTrace {
        originalErrorReason = normalize(originalErrorReason);
        originalResponseBodyJson = normalize(originalResponseBodyJson);
        retryResponseBodyJson = normalize(retryResponseBodyJson);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
