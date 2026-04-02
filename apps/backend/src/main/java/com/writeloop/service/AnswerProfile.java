package com.writeloop.service;

import java.util.List;

public record AnswerProfile(
        TaskProfile task,
        GrammarProfile grammar,
        ContentProfile content,
        RewriteProfile rewrite
) {
}

record TaskProfile(
        boolean onTopic,
        TaskCompletion taskCompletion,
        AnswerBand answerBand,
        boolean finishable
) {
    TaskProfile(boolean onTopic, TaskCompletion taskCompletion, AnswerBand answerBand) {
        this(onTopic, taskCompletion, answerBand, false);
    }
}

record GrammarProfile(
        GrammarSeverity severity,
        List<GrammarIssue> issues,
        String minimalCorrection,
        boolean correctionTrusted
) {
    GrammarProfile(GrammarSeverity severity, List<GrammarIssue> issues, String minimalCorrection) {
        this(severity, issues, minimalCorrection, false);
    }

    GrammarProfile {
        issues = issues == null ? List.of() : List.copyOf(issues);
        minimalCorrection = minimalCorrection == null || minimalCorrection.isBlank() ? null : minimalCorrection.trim();
    }
}

record GrammarIssue(
        String code,
        String span,
        String correction,
        boolean blocksMeaning,
        GrammarSeverity severity
) {
    GrammarIssue {
        code = code == null ? "" : code.trim();
        span = span == null ? "" : span.trim();
        correction = correction == null ? "" : correction.trim();
        severity = severity == null ? GrammarSeverity.NONE : severity;
    }
}

record ContentProfile(
        ContentLevel specificity,
        ContentSignals signals,
        List<StrengthSignal> strengths
) {
    ContentProfile {
        strengths = strengths == null ? List.of() : List.copyOf(strengths);
    }
}

record ContentSignals(
        boolean hasMainAnswer,
        boolean hasReason,
        boolean hasExample,
        boolean hasFeeling,
        boolean hasActivity,
        boolean hasTimeOrPlace
) {
}

record StrengthSignal(
        String code,
        String evidence
) {
    StrengthSignal {
        code = code == null ? "" : code.trim();
        evidence = evidence == null ? "" : evidence.trim();
    }
}

record RewriteProfile(
        String primaryIssueCode,
        String secondaryIssueCode,
        RewriteTarget target,
        ExpansionBudget expansionBudget,
        List<String> regressionSensitiveFacts,
        ProgressDelta progressDelta
) {
    RewriteProfile(String primaryIssueCode, String secondaryIssueCode, RewriteTarget target, ProgressDelta progressDelta) {
        this(primaryIssueCode, secondaryIssueCode, target, ExpansionBudget.NONE, List.of(), progressDelta);
    }

    RewriteProfile {
        primaryIssueCode = primaryIssueCode == null ? "" : primaryIssueCode.trim();
        secondaryIssueCode = secondaryIssueCode == null || secondaryIssueCode.isBlank()
                ? null
                : secondaryIssueCode.trim();
        expansionBudget = expansionBudget == null ? ExpansionBudget.NONE : expansionBudget;
        regressionSensitiveFacts = regressionSensitiveFacts == null ? List.of() : List.copyOf(regressionSensitiveFacts);
    }
}

record RewriteTarget(
        String action,
        String skeleton,
        int maxNewSentenceCount
) {
    RewriteTarget {
        action = action == null ? "" : action.trim();
        skeleton = skeleton == null || skeleton.isBlank() ? null : skeleton.trim();
    }
}

record ProgressDelta(
        List<String> improvedAreas,
        List<String> remainingAreas
) {
    ProgressDelta {
        improvedAreas = improvedAreas == null ? List.of() : List.copyOf(improvedAreas);
        remainingAreas = remainingAreas == null ? List.of() : List.copyOf(remainingAreas);
    }
}

enum TaskCompletion {
    FULL,
    PARTIAL,
    MISS
}

enum AnswerBand {
    TOO_SHORT_FRAGMENT,
    SHORT_BUT_VALID,
    GRAMMAR_BLOCKING,
    CONTENT_THIN,
    NATURAL_BUT_BASIC,
    OFF_TOPIC
}

enum GrammarSeverity {
    NONE,
    MINOR,
    MODERATE,
    MAJOR
}

enum ContentLevel {
    LOW,
    MEDIUM,
    HIGH
}
