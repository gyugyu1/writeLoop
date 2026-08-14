package com.writeloop.service;

record FeedbackProviderRetryTrace(
        boolean attempted,
        Boolean succeeded,
        Integer initialFailureStatusCode,
        String initialFailureBodyJson
) {

    static FeedbackProviderRetryTrace notAttempted() {
        return new FeedbackProviderRetryTrace(false, null, null, null);
    }

    static FeedbackProviderRetryTrace attempted(
            Integer initialFailureStatusCode,
            String initialFailureBodyJson,
            boolean succeeded
    ) {
        return new FeedbackProviderRetryTrace(
                true,
                succeeded,
                initialFailureStatusCode,
                initialFailureBodyJson
        );
    }
}
