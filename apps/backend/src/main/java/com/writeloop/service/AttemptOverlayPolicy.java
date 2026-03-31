package com.writeloop.service;

record AttemptOverlayPolicy(
        boolean progressAwareStrengths,
        boolean suppressResolvedGrammar,
        boolean emphasizeSingleRemainingIssue,
        int modelAnswerSentenceDelta
) {
    static final AttemptOverlayPolicy NONE = new AttemptOverlayPolicy(false, false, false, 0);
    static final AttemptOverlayPolicy PROGRESS_AWARE = new AttemptOverlayPolicy(true, true, true, 1);
}
