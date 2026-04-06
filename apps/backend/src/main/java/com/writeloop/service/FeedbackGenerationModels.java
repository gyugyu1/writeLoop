package com.writeloop.service;

import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackFocusCardDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackRewritePracticeDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.RefinementExpressionDto;

import java.util.List;

enum ExpansionBudget {
    NONE,
    ONE_DETAIL,
    ONE_SUPPORT_SENTENCE
}

record DiagnosedGrammarIssue(
        String code,
        String span,
        String correction,
        String reasonKo,
        boolean blocksMeaning,
        GrammarSeverity severity
) {
    DiagnosedGrammarIssue {
        code = code == null ? "" : code.trim();
        span = span == null ? "" : span.trim();
        correction = correction == null ? "" : correction.trim();
        reasonKo = reasonKo == null ? "" : reasonKo.trim();
        severity = severity == null ? GrammarSeverity.NONE : severity;
    }
}

record FeedbackDiagnosisResult(
        int score,
        AnswerBand answerBand,
        TaskCompletion taskCompletion,
        boolean onTopic,
        boolean finishable,
        GrammarSeverity grammarSeverity,
        List<DiagnosedGrammarIssue> grammarIssues,
        String minimalCorrection,
        String primaryIssueCode,
        String secondaryIssueCode,
        RewriteTarget rewriteTarget,
        ExpansionBudget expansionBudget,
        List<String> regressionSensitiveFacts
) {
    FeedbackDiagnosisResult {
        score = Math.max(0, Math.min(100, score));
        answerBand = answerBand == null ? AnswerBand.SHORT_BUT_VALID : answerBand;
        taskCompletion = taskCompletion == null ? TaskCompletion.PARTIAL : taskCompletion;
        grammarSeverity = grammarSeverity == null ? GrammarSeverity.NONE : grammarSeverity;
        grammarIssues = grammarIssues == null ? List.of() : List.copyOf(grammarIssues);
        minimalCorrection = minimalCorrection == null || minimalCorrection.isBlank()
                ? null
                : minimalCorrection.trim();
        primaryIssueCode = primaryIssueCode == null ? "" : primaryIssueCode.trim();
        secondaryIssueCode = secondaryIssueCode == null || secondaryIssueCode.isBlank()
                ? null
                : secondaryIssueCode.trim();
        expansionBudget = expansionBudget == null ? ExpansionBudget.NONE : expansionBudget;
        regressionSensitiveFacts = regressionSensitiveFacts == null ? List.of() : List.copyOf(regressionSensitiveFacts);
    }
}

record RefinementCard(
        String expression,
        String guidanceKo,
        String exampleEn,
        String exampleKo,
        String meaningKo
) {
    RefinementCard {
        expression = expression == null ? "" : expression.trim();
        guidanceKo = guidanceKo == null ? "" : guidanceKo.trim();
        exampleEn = exampleEn == null ? "" : exampleEn.trim();
        exampleKo = blankToNull(exampleKo);
        meaningKo = blankToNull(meaningKo);
    }

    static RefinementCard fromDto(RefinementExpressionDto dto) {
        if (dto == null) {
            return null;
        }
        return new RefinementCard(
                dto.expression(),
                dto.guidanceKo(),
                dto.exampleEn(),
                dto.exampleKo(),
                dto.meaningKo()
        );
    }

    RefinementExpressionDto toDto() {
        return new RefinementExpressionDto(
                expression,
                guidanceKo,
                exampleEn,
                exampleKo,
                meaningKo
        );
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

record GeneratedSections(
        String summary,
        List<String> strengths,
        FeedbackFocusCardDto focusCard,
        FeedbackPrimaryFixDto primaryFix,
        List<GrammarFeedbackItemDto> grammarFeedback,
        List<CorrectionDto> corrections,
        List<RefinementCard> refinementExpressions,
        String rewriteGuide,
        String modelAnswer,
        String modelAnswerKo,
        List<CoachExpressionUsageDto> usedExpressions,
        List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
        FeedbackRewritePracticeDto rewritePractice,
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions
) {
    GeneratedSections(
            String summary,
            List<String> strengths,
            FeedbackPrimaryFixDto primaryFix,
            List<GrammarFeedbackItemDto> grammarFeedback,
            List<CorrectionDto> corrections,
            List<RefinementCard> refinementExpressions,
            String rewriteGuide,
            String modelAnswer,
            String modelAnswerKo,
            List<CoachExpressionUsageDto> usedExpressions
    ) {
        this(
                summary,
                strengths,
                null,
                primaryFix,
                grammarFeedback,
                corrections,
                refinementExpressions,
                rewriteGuide,
                modelAnswer,
                modelAnswerKo,
                usedExpressions,
                List.of(),
                null,
                List.of()
        );
    }

    GeneratedSections(
            String summary,
            List<String> strengths,
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            List<GrammarFeedbackItemDto> grammarFeedback,
            List<CorrectionDto> corrections,
            List<RefinementCard> refinementExpressions,
            String rewriteGuide,
            String modelAnswer,
            String modelAnswerKo,
            List<CoachExpressionUsageDto> usedExpressions
    ) {
        this(
                summary,
                strengths,
                focusCard,
                primaryFix,
                grammarFeedback,
                corrections,
                refinementExpressions,
                rewriteGuide,
                modelAnswer,
                modelAnswerKo,
                usedExpressions,
                List.of(),
                null,
                List.of()
        );
    }

    GeneratedSections(
            String summary,
            List<String> strengths,
            List<GrammarFeedbackItemDto> grammarFeedback,
            List<CorrectionDto> corrections,
            List<RefinementCard> refinementExpressions,
            String rewriteGuide,
            String modelAnswer,
            String modelAnswerKo,
            List<CoachExpressionUsageDto> usedExpressions
    ) {
        this(
                summary,
                strengths,
                null,
                null,
                grammarFeedback,
                corrections,
                refinementExpressions,
                rewriteGuide,
                modelAnswer,
                modelAnswerKo,
                usedExpressions,
                List.of(),
                null,
                List.of()
            );
    }

    GeneratedSections {
        summary = blankToNull(summary);
        strengths = strengths == null ? List.of() : List.copyOf(strengths);
        focusCard = focusCard == null ? null : new FeedbackFocusCardDto(
                focusCard.title(),
                focusCard.headline(),
                focusCard.supportText()
        );
        primaryFix = primaryFix == null ? null : new FeedbackPrimaryFixDto(
                primaryFix.title(),
                primaryFix.instruction(),
                primaryFix.originalText(),
                primaryFix.revisedText(),
                primaryFix.reasonKo()
        );
        grammarFeedback = grammarFeedback == null ? List.of() : List.copyOf(grammarFeedback);
        corrections = corrections == null ? List.of() : List.copyOf(corrections);
        refinementExpressions = refinementExpressions == null ? List.of() : List.copyOf(refinementExpressions);
        rewriteGuide = blankToNull(rewriteGuide);
        modelAnswer = blankToNull(modelAnswer);
        modelAnswerKo = blankToNull(modelAnswerKo);
        usedExpressions = usedExpressions == null ? List.of() : List.copyOf(usedExpressions);
        secondaryLearningPoints = secondaryLearningPoints == null ? List.of() : List.copyOf(secondaryLearningPoints);
        rewritePractice = rewritePractice == null ? null : new FeedbackRewritePracticeDto(
                rewritePractice.title(),
                rewritePractice.starter(),
                rewritePractice.instruction(),
                rewritePractice.ctaLabel(),
                rewritePractice.optionalTone()
        );
        rewriteSuggestions = rewriteSuggestions == null ? List.of() : List.copyOf(rewriteSuggestions);
    }

    GeneratedSections(
            String summary,
            List<String> strengths,
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            List<GrammarFeedbackItemDto> grammarFeedback,
            List<CorrectionDto> corrections,
            List<RefinementCard> refinementExpressions,
            String rewriteGuide,
            String modelAnswer,
            String modelAnswerKo,
            List<CoachExpressionUsageDto> usedExpressions,
            List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackRewritePracticeDto rewritePractice
    ) {
        this(
                summary,
                strengths,
                focusCard,
                primaryFix,
                grammarFeedback,
                corrections,
                refinementExpressions,
                rewriteGuide,
                modelAnswer,
                modelAnswerKo,
                usedExpressions,
                secondaryLearningPoints,
                rewritePractice,
                List.of()
        );
    }

    GeneratedSections merge(GeneratedSections override) {
        if (override == null) {
            return this;
        }
        return new GeneratedSections(
                override.summary != null ? override.summary : summary,
                !override.strengths.isEmpty() ? override.strengths : strengths,
                override.focusCard != null ? override.focusCard : focusCard,
                override.primaryFix != null ? override.primaryFix : primaryFix,
                !override.grammarFeedback.isEmpty() ? override.grammarFeedback : grammarFeedback,
                !override.corrections.isEmpty() ? override.corrections : corrections,
                !override.refinementExpressions.isEmpty() ? override.refinementExpressions : refinementExpressions,
                override.rewriteGuide != null ? override.rewriteGuide : rewriteGuide,
                override.modelAnswer != null ? override.modelAnswer : modelAnswer,
                override.modelAnswerKo != null ? override.modelAnswerKo : modelAnswerKo,
                !override.usedExpressions.isEmpty() ? override.usedExpressions : usedExpressions,
                !override.secondaryLearningPoints.isEmpty() ? override.secondaryLearningPoints : secondaryLearningPoints,
                override.rewritePractice != null ? override.rewritePractice : rewritePractice,
                !override.rewriteSuggestions.isEmpty() ? override.rewriteSuggestions : rewriteSuggestions
        );
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

enum SectionKey {
    STRENGTHS,
    PRIMARY_FIX,
    GRAMMAR,
    IMPROVEMENT,
    REFINEMENT,
    SUMMARY,
    REWRITE_GUIDE,
    MODEL_ANSWER,
    USED_EXPRESSIONS
}

enum ValidationFailureCode {
    EMPTY_STRENGTHS,
    EMPTY_PRIMARY_FIX,
    EMPTY_GRAMMAR,
    INVALID_GRAMMAR,
    EMPTY_IMPROVEMENT,
    EMPTY_SECTION,
    PLACEHOLDER,
    GENERIC_TEXT,
    BROKEN_SPAN_REUSE,
    NEAR_DUPLICATE,
    MEANING_DRIFT,
    MODEL_REGRESSION,
    MODEL_DUPLICATE_ANCHOR,
    REWRITE_DUPLICATE_MODEL_ANSWER,
    SUMMARY_DUPLICATES_IMPROVEMENT,
    LOW_VALUE_SECTION,
    UNALIGNED_PRIMARY_FIX,
    UNALIGNED_REWRITE_TARGET,
    LOW_VALUE_MODEL_ANSWER,
    LOW_VALUE_REFINEMENT
}

record ValidationFailure(
        SectionKey sectionKey,
        ValidationFailureCode failureCode,
        String detail
) {
    ValidationFailure {
        sectionKey = sectionKey == null ? SectionKey.SUMMARY : sectionKey;
        failureCode = failureCode == null ? ValidationFailureCode.LOW_VALUE_SECTION : failureCode;
        detail = detail == null ? "" : detail.trim();
    }
}

record ValidationResult(
        GeneratedSections sanitizedSections,
        List<ValidationFailure> failures,
        boolean shouldRetry
) {
    ValidationResult {
        sanitizedSections = sanitizedSections == null
                ? new GeneratedSections(null, List.of(), null, null, List.of(), List.of(), List.of(), null, null, null, List.of(), List.of(), null)
                : sanitizedSections;
        failures = failures == null ? List.of() : List.copyOf(failures);
    }
}

record RegenerationRequest(
        List<SectionKey> failedSections,
        AnswerProfile answerProfile,
        SectionPolicy sectionPolicy,
        List<ValidationFailureCode> failureCodes
) {
    RegenerationRequest {
        failedSections = failedSections == null ? List.of() : List.copyOf(failedSections);
        failureCodes = failureCodes == null ? List.of() : List.copyOf(failureCodes);
    }
}
