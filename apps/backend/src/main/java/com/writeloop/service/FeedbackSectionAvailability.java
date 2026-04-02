package com.writeloop.service;

record FeedbackSectionAvailability(
        boolean hasKeepWhatWorks,
        boolean hasPrimaryFix,
        boolean hasGrammarCard,
        boolean hasRewriteGuide,
        boolean hasModelAnswer,
        boolean hasDisplayableRefinement,
        boolean hasHighValueCorrection
) {
}
