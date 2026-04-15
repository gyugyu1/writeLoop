package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackUiDto(
        @Deprecated @JsonIgnore FeedbackFocusCardDto focusCard,
        @Deprecated @JsonIgnore FeedbackPrimaryFixDto primaryFix,
        FeedbackMicroTipDto microTip,
        java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
        java.util.List<FeedbackSecondaryLearningPointDto> fixPoints,
        FeedbackNextStepPracticeDto nextStepPractice,
        java.util.List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
        java.util.List<FeedbackRewriteIdeaDto> rewriteIdeas,
        java.util.List<FeedbackModelAnswerVariantDto> modelAnswerVariants,
        FeedbackScreenPolicyDto screenPolicy,
        FeedbackLoopStatusDto loopStatus
) {
    public FeedbackUiDto {
        secondaryLearningPoints = secondaryLearningPoints == null ? java.util.List.of() : java.util.List.copyOf(secondaryLearningPoints);
        fixPoints = fixPoints == null ? java.util.List.of() : java.util.List.copyOf(fixPoints);
        rewriteSuggestions = rewriteSuggestions == null ? java.util.List.of() : java.util.List.copyOf(rewriteSuggestions);
        rewriteIdeas = mergeRewriteIdeas(rewriteIdeas, nextStepPractice, rewriteSuggestions);
        modelAnswerVariants = sanitizeModelAnswerVariants(modelAnswerVariants);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackNextStepPracticeDto nextStepPractice
    ) {
        this(focusCard, primaryFix, null, java.util.List.of(), java.util.List.of(), nextStepPractice, java.util.List.of(), null, null, null, null);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackNextStepPracticeDto nextStepPractice,
            java.util.List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(
                focusCard,
                primaryFix,
                microTip,
                secondaryLearningPoints,
                java.util.List.of(),
                nextStepPractice,
                rewriteSuggestions,
                null,
                null,
                screenPolicy,
                loopStatus
        );
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackNextStepPracticeDto nextStepPractice
    ) {
        this(focusCard, primaryFix, microTip, secondaryLearningPoints, java.util.List.of(), nextStepPractice, java.util.List.of(), null, null, null, null);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackNextStepPracticeDto nextStepPractice,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(focusCard, primaryFix, microTip, secondaryLearningPoints, java.util.List.of(), nextStepPractice, java.util.List.of(), null, null, screenPolicy, loopStatus);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            java.util.List<FeedbackSecondaryLearningPointDto> fixPoints,
            FeedbackNextStepPracticeDto nextStepPractice,
            java.util.List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
            java.util.List<FeedbackRewriteIdeaDto> rewriteIdeas,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(
                focusCard,
                primaryFix,
                microTip,
                secondaryLearningPoints,
                fixPoints,
                nextStepPractice,
                rewriteSuggestions,
                rewriteIdeas,
                null,
                screenPolicy,
                loopStatus
        );
    }

    private static java.util.List<FeedbackRewriteIdeaDto> mergeRewriteIdeas(
            java.util.List<FeedbackRewriteIdeaDto> rewriteIdeas,
            FeedbackNextStepPracticeDto nextStepPractice,
            java.util.List<FeedbackRewriteSuggestionDto> rewriteSuggestions
    ) {
        java.util.LinkedHashMap<String, FeedbackRewriteIdeaDto> merged = new java.util.LinkedHashMap<>();

        if (rewriteIdeas != null) {
            for (FeedbackRewriteIdeaDto rewriteIdea : rewriteIdeas) {
                if (rewriteIdea == null || !hasMeaningfulIdea(
                        rewriteIdea.english(),
                        rewriteIdea.noteKo(),
                        rewriteIdea.originalText(),
                        rewriteIdea.revisedText()
                )) {
                    continue;
                }
                merged.putIfAbsent(dedupeKey(rewriteIdea), rewriteIdea);
            }
        }

        if (!merged.isEmpty()) {
            return java.util.List.copyOf(merged.values());
        }

        if (nextStepPractice != null) {
            String english = firstNonBlank(
                    nextStepPractice.revisedText(),
                    nextStepPractice.headline(),
                    nextStepPractice.exampleEn()
            );
            String meaningKo = firstNonBlank(nextStepPractice.exampleKo(), nextStepPractice.meaningKo());
            String noteKo = firstNonBlank(nextStepPractice.supportText(), nextStepPractice.guidanceKo());
            if (hasMeaningfulIdea(english, noteKo, nextStepPractice.originalText(), nextStepPractice.revisedText())) {
                FeedbackRewriteIdeaDto highlight = FeedbackRewriteIdeaDto.highlight(
                        nextStepPractice.title(),
                        english,
                        meaningKo,
                        noteKo,
                        nextStepPractice.originalText(),
                        nextStepPractice.revisedText(),
                        nextStepPractice.optionalTone()
                );
                merged.putIfAbsent(dedupeKey(highlight), highlight);
            }
        }

        if (rewriteSuggestions != null) {
            for (FeedbackRewriteSuggestionDto suggestion : rewriteSuggestions) {
                if (suggestion == null || normalize(suggestion.english()) == null) {
                    continue;
                }
                FeedbackRewriteIdeaDto item = FeedbackRewriteIdeaDto.suggestion(
                        suggestion.english(),
                        suggestion.meaningKo(),
                        suggestion.noteKo()
                );
                merged.putIfAbsent(dedupeKey(item), item);
            }
        }

        return java.util.List.copyOf(merged.values());
    }

    private static boolean hasMeaningfulIdea(
            String english,
            String noteKo,
            String originalText,
            String revisedText
    ) {
        return normalize(english) != null
                || normalize(noteKo) != null
                || normalize(originalText) != null
                || normalize(revisedText) != null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private static String dedupeKey(FeedbackRewriteIdeaDto item) {
        String englishAnchor = normalizeIdeaAnchor(firstNonBlank(item.english(), item.revisedText()));
        if (englishAnchor != null) {
            return englishAnchor;
        }

        return (firstNonBlank(normalizeIdeaAnchor(item.originalText()), "")
                + "|"
                + firstNonBlank(normalizeIdeaAnchor(item.revisedText()), ""))
                .toLowerCase(java.util.Locale.ROOT);
    }

    private static String normalizeIdeaAnchor(String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return null;
        }

        return normalized
                .replaceAll("[.!?]+$", "")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(java.util.Locale.ROOT);
    }

    private static java.util.List<FeedbackModelAnswerVariantDto> sanitizeModelAnswerVariants(
            java.util.List<FeedbackModelAnswerVariantDto> modelAnswerVariants
    ) {
        if (modelAnswerVariants == null || modelAnswerVariants.isEmpty()) {
            return java.util.List.of();
        }

        java.util.LinkedHashMap<String, FeedbackModelAnswerVariantDto> byAnswer = new java.util.LinkedHashMap<>();
        java.util.LinkedHashSet<String> usedKinds = new java.util.LinkedHashSet<>();
        for (FeedbackModelAnswerVariantDto variant : modelAnswerVariants) {
            if (variant == null || normalize(variant.answer()) == null) {
                continue;
            }

            String normalizedAnswer = normalizeIdeaAnchor(variant.answer());
            if (normalizedAnswer == null || byAnswer.containsKey(normalizedAnswer)) {
                continue;
            }

            String kind = normalize(variant.kind());
            if (kind != null && usedKinds.contains(kind)) {
                continue;
            }

            byAnswer.put(normalizedAnswer, variant);
            if (kind != null) {
                usedKinds.add(kind);
            }
        }

        return java.util.List.copyOf(byAnswer.values());
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
