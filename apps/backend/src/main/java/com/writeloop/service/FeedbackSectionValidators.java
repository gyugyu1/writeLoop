package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.RefinementExpressionDto;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class FeedbackSectionValidators {
    private static final Pattern QUOTED_ENGLISH_TOKEN_PATTERN = Pattern.compile("[`'\"\u2018\u2019\u201C\u201D]?([a-z]{1,12})[`'\"\u2018\u2019\u201C\u201D]?", Pattern.CASE_INSENSITIVE);
    private static final Set<String> CONNECTOR_TOKENS = Set.of("and", "because", "so", "also", "then");
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}][\\p{L}'-]*");
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\[[^\\]\\r\\n]{1,24}\\]");
    private static final Pattern BROKEN_PATCH_PATTERN = Pattern.compile("'.+?'\\s*->\\s*'.+?'");
    private static final Pattern HANGUL_PATTERN = Pattern.compile("[\\u1100-\\u11FF\\u3130-\\u318F\\uAC00-\\uD7AF]");
    private static final Pattern IT_REFERENT_PATTERN = Pattern.compile("(?i)\\b(it|it's|it is|its)\\b");
    private static final Pattern THEY_REFERENT_PATTERN = Pattern.compile("(?i)\\b(they|they're|they are|their|them)\\b");
    private static final Set<String> CONTENT_STOPWORDS = Set.of(
            "a", "an", "and", "are", "at", "be", "because", "by", "do", "for", "from", "go",
            "i", "in", "is", "it", "me", "my", "of", "on", "or", "so", "that", "the", "this",
            "to", "usually", "very", "with"
    );
    private static final Set<String> ARTICLE_TOKENS = Set.of("a", "an", "the");
    private static final Set<String> POSSESSIVE_DETERMINERS = Set.of("my", "your", "his", "her", "our", "their", "its");
    private static final Set<String> READABLE_GENERIC_MEANING_TEXTS = Set.of(
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC4F0\uBA74 \uC88B\uC740 \uD45C\uD604\uC785\uB2C8\uB2E4.",
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uBC14\uB85C \uAC00\uC838\uB2E4 \uC4F8 \uC218 \uC788\uB294 \uD45C\uD604\uC785\uB2C8\uB2E4."
    );
    private static final Set<String> READABLE_GENERIC_GUIDANCE_TEXTS = Set.of(
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC4F0\uBA74 \uC88B\uC740 \uD45C\uD604\uC785\uB2C8\uB2E4.",
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uBC14\uB85C \uAC00\uC838\uB2E4 \uC4F8 \uC218 \uC788\uB294 \uD45C\uD604\uC785\uB2C8\uB2E4."
    );
    private static final Set<String> GENERIC_MEANING_TEXTS = Set.of(
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC4F0\uBA74 \uC88B\uC740 \uD45C\uD604\uC785\uB2C8\uB2E4.",
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uBC14\uB85C \uAC00\uC838\uB2E4 \uC4F8 \uC218 \uC788\uB294 \uD45C\uD604\uC785\uB2C8\uB2E4."
    );
    private static final Set<String> GENERIC_GUIDANCE_TEXTS = Set.of(
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC4F0\uBA74 \uC88B\uC740 \uD45C\uD604\uC785\uB2C8\uB2E4.",
            "\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uBC14\uB85C \uAC00\uC838\uB2E4 \uC4F8 \uC218 \uC788\uB294 \uD45C\uD604\uC785\uB2C8\uB2E4."
    );

    List<String> dedupeStrengths(List<String> strengths) {
        if (strengths == null || strengths.isEmpty()) {
            return List.of();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String strength : strengths) {
            if (strength == null || strength.isBlank()) {
                continue;
            }
            unique.add(strength.trim());
        }
        return List.copyOf(unique);
    }

    List<String> filterKoreanStrengths(List<String> strengths) {
        if (strengths == null || strengths.isEmpty()) {
            return List.of();
        }
        List<String> filtered = new ArrayList<>();
        for (String strength : strengths) {
            if (strength == null || strength.isBlank()) {
                continue;
            }
            if (containsHangul(strength)) {
                filtered.add(strength.trim());
            }
        }
        return List.copyOf(filtered);
    }

    String filterKoreanSummary(String summary) {
        String cleanSummary = blankToNull(summary);
        if (cleanSummary == null) {
            return null;
        }
        return containsHangul(cleanSummary) ? cleanSummary : null;
    }

    List<GrammarFeedbackItemDto> validateGrammarSectionFormat(List<GrammarFeedbackItemDto> grammarFeedback) {
        if (grammarFeedback == null || grammarFeedback.isEmpty()) {
            return List.of();
        }
        List<GrammarFeedbackItemDto> sanitized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (GrammarFeedbackItemDto item : grammarFeedback) {
            if (item == null) {
                continue;
            }
            String original = item.originalText() == null ? "" : item.originalText().trim();
            String revised = item.revisedText() == null ? "" : item.revisedText().trim();
            String reason = item.reasonKo() == null ? "" : item.reasonKo().trim();
            if (reason.isBlank()) {
                continue;
            }
            if (isMalformedGrammarReason(reason)) {
                continue;
            }
            if (original.isBlank() && revised.isBlank()) {
                continue;
            }
            if (!original.isBlank() && !revised.isBlank() && original.equals(revised)) {
                continue;
            }
            String key = normalizeText(original) + "->" + normalizeText(revised) + "|" + normalizeText(reason);
            if (seen.add(key)) {
                sanitized.add(new GrammarFeedbackItemDto(original, revised, reason));
            }
        }
        return List.copyOf(sanitized);
    }

    List<GrammarFeedbackItemDto> alignGrammarFeedbackWithMinimalCorrection(
            List<GrammarFeedbackItemDto> grammarFeedback,
            String minimalCorrection
    ) {
        if (grammarFeedback == null || grammarFeedback.isEmpty()) {
            return List.of();
        }
        List<GrammarFeedbackItemDto> aligned = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (GrammarFeedbackItemDto item : grammarFeedback) {
            if (item == null) {
                continue;
            }
            GrammarFeedbackItemDto repaired = repairGrammarItemWithMinimalCorrection(item, minimalCorrection);
            if (repaired == null) {
                continue;
            }
            String key = normalizeText(repaired.originalText()) + "->" + normalizeText(repaired.revisedText()) + "|" + normalizeText(repaired.reasonKo());
            if (seen.add(key)) {
                aligned.add(repaired);
            }
        }
        return List.copyOf(aligned);
    }

    List<GrammarFeedbackItemDto> filterLowValueGrammarItems(List<GrammarFeedbackItemDto> grammarFeedback) {
        if (grammarFeedback == null || grammarFeedback.isEmpty()) {
            return List.of();
        }
        List<GrammarFeedbackItemDto> filtered = new ArrayList<>();
        for (GrammarFeedbackItemDto item : grammarFeedback) {
            if (item == null || isLowValueGrammarItem(item)) {
                continue;
            }
            filtered.add(item);
        }
        return List.copyOf(filtered);
    }

    List<CorrectionDto> reduceDuplicateCorrections(
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (corrections == null || corrections.isEmpty()) {
            return List.of();
        }
        List<CorrectionDto> reduced = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (CorrectionDto correction : corrections) {
            if (correction == null) {
                continue;
            }
            String issue = normalizeText(correction.issue());
            String suggestion = normalizeText(correction.suggestion());
            if (issue.isBlank() || suggestion.isBlank()) {
                continue;
            }
            String key = issue + "|" + suggestion;
            if (seen.add(key)) {
                reduced.add(new CorrectionDto(correction.issue().trim(), correction.suggestion().trim()));
            }
        }
        return List.copyOf(reduced);
    }

    List<RefinementExpressionDto> validateRefinementCards(List<RefinementExpressionDto> refinementExpressions) {
        if (refinementExpressions == null || refinementExpressions.isEmpty()) {
            return List.of();
        }
        List<RefinementExpressionDto> sanitized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (RefinementExpressionDto expression : refinementExpressions) {
            if (expression == null || !Boolean.TRUE.equals(expression.displayable())) {
                continue;
            }
            String normalizedExpression = normalizeText(expression.expression());
            String normalizedExample = normalizeText(expression.exampleEn());
            if (normalizedExpression.isBlank() || normalizedExample.isBlank()) {
                continue;
            }
            if (containsPlaceholder(expression.expression())
                    || containsPlaceholder(expression.meaningKo())
                    || containsPlaceholder(expression.guidanceKo())
                    || containsPlaceholder(expression.exampleEn())
                    || containsPlaceholder(expression.exampleKo())) {
                continue;
            }
            if (normalizedExpression.equals(normalizedExample)) {
                continue;
            }
            String key = normalizedExpression + "|" + normalizedExample + "|" + normalizeText(expression.guidanceKo());
            if (!seen.add(key)) {
                continue;
            }
            int overlapIndex = findOverlappingRefinementIndex(sanitized, expression);
            if (overlapIndex >= 0) {
                RefinementExpressionDto existing = sanitized.get(overlapIndex);
                if (refinementSpecificityScore(expression) > refinementSpecificityScore(existing)) {
                    sanitized.set(overlapIndex, expression);
                }
                continue;
            }
            sanitized.add(expression);
        }
        return List.copyOf(sanitized);
    }

    boolean isLowValueGrammarItem(GrammarFeedbackItemDto item) {
        if (item == null) {
            return false;
        }
        return isLowValueDefiniteArticleAddition(item.originalText(), item.revisedText());
    }

    private boolean isLowValueDefiniteArticleAddition(String originalText, String revisedText) {
        String normalizedOriginal = normalizeExpressionForOverlap(originalText);
        String normalizedRevised = normalizeExpressionForOverlap(revisedText);
        if (normalizedOriginal.isBlank() || normalizedRevised.isBlank()) {
            return false;
        }
        List<String> originalTokens = List.of(normalizedOriginal.split("\\s+"));
        List<String> revisedTokens = List.of(normalizedRevised.split("\\s+"));
        List<String> originalWithoutArticles = originalTokens.stream()
                .filter(token -> !ARTICLE_TOKENS.contains(token))
                .toList();
        List<String> revisedWithoutArticles = revisedTokens.stream()
                .filter(token -> !ARTICLE_TOKENS.contains(token))
                .toList();
        return !originalWithoutArticles.isEmpty()
                && originalWithoutArticles.equals(revisedWithoutArticles)
                && revisedTokens.size() == originalTokens.size() + 1
                && !originalTokens.contains("the")
                && revisedTokens.contains("the")
                && !revisedTokens.contains("a")
                && !revisedTokens.contains("an")
                && Math.max(originalTokens.size(), revisedTokens.size()) <= 4;
    }

    List<RefinementCard> validateRefinementCardsDomain(List<RefinementCard> refinementCards) {
        if (refinementCards == null || refinementCards.isEmpty()) {
            return List.of();
        }
        List<RefinementExpressionDto> dtos = new ArrayList<>();
        for (RefinementCard refinementCard : refinementCards) {
            if (refinementCard != null) {
                dtos.add(refinementCard.toDto());
            }
        }
        return validateRefinementCards(dtos).stream()
                .map(RefinementCard::fromDto)
                .toList();
    }

    ModelAnswerContent guardModelAnswer(
            String learnerAnswer,
            String modelAnswer,
            String modelAnswerKo,
            int maxSentences,
            ModelAnswerMode modelAnswerMode
    ) {
        String guarded = dedupeRepeatedSentences(trimToSentenceCount(modelAnswer, maxSentences));
        int learnerWordCount = countWords(learnerAnswer);
        int maxAllowedWordCount = switch (modelAnswerMode) {
            case MINIMAL_CORRECTION -> Math.max(8, learnerWordCount + 6);
            case TASK_RESET -> Math.max(10, learnerWordCount + 8);
            case ONE_STEP_UP, OPTIONAL_IF_ALREADY_GOOD -> Math.max(12, learnerWordCount + 12);
        };
        if (countWords(guarded) > maxAllowedWordCount) {
            guarded = trimToWordCount(guarded, maxAllowedWordCount);
            guarded = dedupeRepeatedSentences(guarded);
        }

        String guardedKo = modelAnswerKo;
        if (guardedKo != null && !guardedKo.isBlank()) {
            guardedKo = trimToSentenceCount(guardedKo, maxSentences);
            if (guarded == null || guarded.isBlank()) {
                guardedKo = null;
            }
        }
        return new ModelAnswerContent(blankToNull(guarded), blankToNull(guardedKo));
    }

    String dedupeRepeatedSentences(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] sentences = text.trim().split("(?<=[.!?])\\s+");
        if (sentences.length <= 1) {
            return sanitizeCorrectedSentence(text);
        }
        List<String> uniqueSentences = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String sentence : sentences) {
            String sanitizedSentence = sanitizeCorrectedSentence(sentence);
            if (sanitizedSentence == null || sanitizedSentence.isBlank()) {
                continue;
            }
            String key = normalizeExpressionForOverlap(sanitizedSentence);
            if (seen.add(key)) {
                uniqueSentences.add(sanitizedSentence);
            }
        }
        if (uniqueSentences.isEmpty()) {
            return null;
        }
        return sanitizeCorrectedSentence(String.join(" ", uniqueSentences));
    }

    String preventModelAnswerRegression(
            String learnerAnswer,
            String modelAnswer,
            String anchorText,
            AnswerBand answerBand,
            ModelAnswerMode modelAnswerMode
    ) {
        String sanitized = sanitizeFreeText(modelAnswer);
        if (sanitized == null) {
            return null;
        }
        if (answerBand == AnswerBand.OFF_TOPIC || modelAnswerMode == ModelAnswerMode.TASK_RESET) {
            return sanitized;
        }
        if (dropsProtectedMeaning(learnerAnswer, sanitized)) {
            return null;
        }
        if (omitsMajorLearnerClause(learnerAnswer, sanitized)) {
            return null;
        }
        if (omitsMajorLearnerClause(anchorText, sanitized)) {
            return null;
        }
        if ((answerBand == AnswerBand.TOO_SHORT_FRAGMENT
                || answerBand == AnswerBand.SHORT_BUT_VALID
                || answerBand == AnswerBand.CONTENT_THIN)
                && anchorText != null
                && !anchorText.isBlank()
                && !hasMinimumAnchorOverlap(sanitized, anchorText)) {
            return null;
        }
        if ((answerBand == AnswerBand.SHORT_BUT_VALID
                || answerBand == AnswerBand.CONTENT_THIN
                || answerBand == AnswerBand.NATURAL_BUT_BASIC)
                && anchorText != null
                && !anchorText.isBlank()
                && addsExcessiveNovelDetail(sanitized, anchorText, answerBand, modelAnswerMode)) {
            return null;
        }
        return sanitized;
    }

    String alignModelAnswerWithPrimaryFixReferent(
            String modelAnswer,
            FeedbackPrimaryFixDto primaryFix,
            String anchorText
    ) {
        String sanitized = blankToNull(modelAnswer);
        if (sanitized == null || primaryFix == null) {
            return sanitized;
        }
        ReferentTarget target = detectPrimaryFixReferentTarget(primaryFix);
        if (target == ReferentTarget.NONE || !conflictsWithReferentTarget(sanitized, target)) {
            return sanitized;
        }
        String anchor = sanitizeCorrectedSentence(anchorText);
        if (anchor != null && !conflictsWithReferentTarget(anchor, target)) {
            return anchor;
        }
        return null;
    }

    String alignModelAnswerWithFixPointReferent(
            String modelAnswer,
            FeedbackSecondaryLearningPointDto fixPoint,
            String anchorText
    ) {
        String sanitized = blankToNull(modelAnswer);
        if (sanitized == null || fixPoint == null) {
            return sanitized;
        }
        ReferentTarget target = detectFixPointReferentTarget(fixPoint);
        if (target == ReferentTarget.NONE || !conflictsWithReferentTarget(sanitized, target)) {
            return sanitized;
        }
        String anchor = sanitizeCorrectedSentence(anchorText);
        if (anchor != null && !conflictsWithReferentTarget(anchor, target)) {
            return anchor;
        }
        return null;
    }

    boolean losesMajorContent(String sourceText, String candidateText) {
        return omitsMajorLearnerClause(sourceText, candidateText);
    }

    String reduceSummaryDuplication(
            String summary,
            List<CorrectionDto> corrections,
            String rewriteGuide
    ) {
        String cleanSummary = blankToNull(summary);
        if (cleanSummary == null) {
            return null;
        }
        if (rewriteGuide != null
                && normalizeExpressionForOverlap(cleanSummary).equals(normalizeExpressionForOverlap(rewriteGuide))) {
            return null;
        }
        if (corrections != null) {
            for (CorrectionDto correction : corrections) {
                if (correction == null) {
                    continue;
                }
                String combined = (correction.issue() == null ? "" : correction.issue()) + " "
                        + (correction.suggestion() == null ? "" : correction.suggestion());
                if (normalizeExpressionForOverlap(cleanSummary).equals(normalizeExpressionForOverlap(combined))) {
                    return null;
                }
            }
        }
        return cleanSummary;
    }

    boolean isNearDuplicateText(String left, String right) {
        return isNearDuplicate(normalizeExpressionForOverlap(left), normalizeExpressionForOverlap(right));
    }

    String reduceRewriteGuideModelAnswerDuplication(
            String rewriteGuide,
            String modelAnswer,
            boolean grammarBlocking
    ) {
        String cleanGuide = blankToNull(rewriteGuide);
        String normalizedGuide = normalizeExpressionForOverlap(rewriteGuide);
        String normalizedModelAnswer = normalizeExpressionForOverlap(modelAnswer);
        if (normalizedGuide.isBlank() || normalizedModelAnswer.isBlank()) {
            return cleanGuide;
        }

        if (!normalizedGuide.equals(normalizedModelAnswer)) {
            return cleanGuide;
        }

        String quotedHint = extractLeadingQuotedHint(cleanGuide);
        if (grammarBlocking
                && quotedHint != null
                && hasMeaningfulGuidanceText(stripLeadingQuotedHint(cleanGuide))) {
            return cleanGuide;
        }
        if (quotedHint != null
                && hasMeaningfulGuidanceText(stripLeadingQuotedHint(cleanGuide))
                && isOneStepUpModelAnswer(quotedHint, modelAnswer)) {
            return cleanGuide;
        }

        String stripped = rewriteGuide == null
                ? null
                : rewriteGuide
                .replaceAll("\\s*\uD78C\uD2B8[^:]*:\\s*\"[^\"]+\"", "")
                .replaceAll("\\s+", " ")
                .trim();
        stripped = stripLeadingQuotedHint(cleanGuide);
        if (grammarBlocking && hasMeaningfulGuidanceText(stripped)) {
            return stripped;
        }
        if (stripped != null
                && !stripped.isBlank()
                && !isNearDuplicate(normalizeExpressionForOverlap(stripped), normalizedModelAnswer)) {
            return stripped;
        }
        if (grammarBlocking) {
            return "\uBB38\uC7A5\uC744 \uBA3C\uC800 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uACE0\uCE5C \uB4A4, \uC5B4\uB5A4 \uD45C\uD604\uC774 \uC5B4\uB5BB\uAC8C \uB2EC\uB77C\uC9C0\uB294\uC9C0 \uD55C\uB450 \uAC00\uC9C0\uB85C \uBD99\uC5EC \uBCF4\uC138\uC694.";
        }
        return stripped == null || stripped.isBlank() ? null : stripped;
    }

    String sanitizeCorrectedSentence(String correctedSentence) {
        if (correctedSentence == null || correctedSentence.isBlank()) {
            return null;
        }
        String sanitized = correctedSentence
                .replaceAll("\\s+", " ")
                .replaceAll("\\s+([,.!?])", "$1")
                .replaceAll("([,.!?])(\\p{L})", "$1 $2")
                .trim();
        if (sanitized.isBlank()) {
            return null;
        }
        if (!sanitized.endsWith(".") && !sanitized.endsWith("!") && !sanitized.endsWith("?")) {
            sanitized = sanitized + ".";
        }
        return sanitized;
    }

    private String sanitizeFreeText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return text
                .replaceAll("\\s+", " ")
                .replaceAll("\\s+([,.!?])", "$1")
                .replaceAll("([,.!?])(\\p{L})", "$1 $2")
                .trim();
    }

    private String extractLeadingQuotedHint(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = Pattern.compile("^\\s*\"([^\"]+)\"").matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String quoted = matcher.group(1);
        return quoted == null || quoted.isBlank() ? null : quoted.trim();
    }

    private String stripLeadingQuotedHint(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String stripped = text
                .replaceFirst("^\\s*\"[^\"]+\"\\s*", "")
                .replaceAll("\\s+", " ")
                .trim();
        return stripped.isBlank() ? null : stripped;
    }

    private boolean hasMeaningfulGuidanceText(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        Matcher matcher = WORD_PATTERN.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
            if (count >= 3) {
                return true;
            }
        }
        return false;
    }

    private boolean isLikelyGrammarDuplicate(
            String issue,
            String suggestion,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (grammarFeedback == null || grammarFeedback.isEmpty()) {
            return false;
        }
        if (issue.contains("\uBB38\uBC95") || suggestion.contains("\uBB38\uBC95") || issue.contains("\uAD50\uC815") || suggestion.contains("\uAD50\uC815")) {
            return true;
        }
        for (GrammarFeedbackItemDto item : grammarFeedback) {
            if (item == null) {
                continue;
            }
            String original = normalizeText(item.originalText());
            String revised = normalizeText(item.revisedText());
            if (!original.isBlank() && (issue.contains(original) || suggestion.contains(original))) {
                return true;
            }
            if (!revised.isBlank() && suggestion.contains(revised)) {
                return true;
            }
        }
        return false;
    }

    private GrammarFeedbackItemDto repairGrammarItemWithMinimalCorrection(
            GrammarFeedbackItemDto item,
            String minimalCorrection
    ) {
        String original = blankToNull(item.originalText());
        String revised = blankToNull(item.revisedText());
        String reason = blankToNull(item.reasonKo());
        if (reason == null || revised == null) {
            return null;
        }

        Set<String> requiredTokens = extractRequiredReasonTokens(reason);
        if (requiredTokens.isEmpty() || containsAllRequiredTokens(revised, requiredTokens)) {
            return item;
        }

        String normalizedMinimalCorrection = blankToNull(minimalCorrection);
        if (normalizedMinimalCorrection != null
                && containsAllRequiredTokens(normalizedMinimalCorrection, requiredTokens)
                && canPromoteMinimalCorrection(original)) {
            return new GrammarFeedbackItemDto(
                    original == null ? "" : original,
                    normalizedMinimalCorrection,
                    reason
            );
        }

        return null;
    }

    private Set<String> extractRequiredReasonTokens(String reason) {
        Set<String> tokens = new LinkedHashSet<>();
        if (reason == null || reason.isBlank()) {
            return tokens;
        }

        Matcher quotedMatcher = QUOTED_ENGLISH_TOKEN_PATTERN.matcher(reason);
        while (quotedMatcher.find()) {
            String token = quotedMatcher.group(1);
            if (token != null && !token.isBlank()) {
                tokens.add(token.toLowerCase(Locale.ROOT));
            }
        }

        String normalizedReason = normalizeText(reason);
        for (String token : CONNECTOR_TOKENS) {
            if (containsWord(normalizedReason, token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private boolean containsAllRequiredTokens(String text, Set<String> requiredTokens) {
        if (requiredTokens == null || requiredTokens.isEmpty()) {
            return true;
        }
        String normalizedText = normalizeText(text);
        if (normalizedText.isBlank()) {
            return false;
        }
        for (String token : requiredTokens) {
            if (!containsWord(normalizedText, token)) {
                return false;
            }
        }
        return true;
    }

    private boolean containsWord(String text, String token) {
        if (text == null || text.isBlank() || token == null || token.isBlank()) {
            return false;
        }
        return Pattern.compile("(?<![a-z])" + Pattern.quote(token.toLowerCase(Locale.ROOT)) + "(?![a-z])")
                .matcher(text)
                .find();
    }

    private boolean canPromoteMinimalCorrection(String originalText) {
        String normalizedOriginal = blankToNull(originalText);
        if (normalizedOriginal == null) {
            return true;
        }
        return normalizedOriginal.contains(".")
                || normalizedOriginal.contains(",")
                || normalizedOriginal.split("\\s+").length >= 4;
    }

    private boolean containsPlaceholder(String text) {
        return text != null && PLACEHOLDER_PATTERN.matcher(text).find();
    }

    private boolean containsHangul(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if ((ch >= '\u1100' && ch <= '\u11FF')
                    || (ch >= '\u3130' && ch <= '\u318F')
                    || (ch >= '\uAC00' && ch <= '\uD7AF')) {
                return true;
            }
        }
        return false;
    }

    private boolean isLowValueArticleCorrection(String originalText, String revisedText) {
        String normalizedOriginal = normalizeExpressionForOverlap(originalText);
        String normalizedRevised = normalizeExpressionForOverlap(revisedText);
        if (normalizedOriginal.isBlank() || normalizedRevised.isBlank()) {
            return false;
        }
        List<String> originalTokens = List.of(normalizedOriginal.split("\\s+"));
        List<String> revisedTokens = List.of(normalizedRevised.split("\\s+"));
        boolean articleTouched = originalTokens.stream().anyMatch(ARTICLE_TOKENS::contains)
                || revisedTokens.stream().anyMatch(ARTICLE_TOKENS::contains);
        if (!articleTouched) {
            return false;
        }
        List<String> originalWithoutArticles = originalTokens.stream()
                .filter(token -> !ARTICLE_TOKENS.contains(token))
                .toList();
        List<String> revisedWithoutArticles = revisedTokens.stream()
                .filter(token -> !ARTICLE_TOKENS.contains(token))
                .toList();
        boolean revisedAddsOnlyDefiniteArticle = revisedTokens.size() == originalTokens.size() + 1
                && !originalTokens.contains("the")
                && revisedTokens.contains("the")
                && !revisedTokens.contains("a")
                && !revisedTokens.contains("an");
        boolean originalHadArticleBeforePossessive = originalTokens.size() == revisedTokens.size() + 1
                && originalWithoutArticles.equals(revisedWithoutArticles)
                && revisedTokens.stream().anyMatch(POSSESSIVE_DETERMINERS::contains);
        return !originalWithoutArticles.isEmpty()
                && Math.max(originalTokens.size(), revisedTokens.size()) <= 4
                && (revisedAddsOnlyDefiniteArticle || originalHadArticleBeforePossessive);
    }

    private boolean dropsProtectedMeaning(String learnerAnswer, String modelAnswer) {
        String normalizedLearner = normalizeExpressionForOverlap(learnerAnswer);
        String normalizedModel = normalizeExpressionForOverlap(modelAnswer);
        if (normalizedLearner.contains("nothing") && !normalizedModel.contains("nothing")) {
            return true;
        }
        if (normalizedLearner.contains("never") && !normalizedModel.contains("never")) {
            return true;
        }
        if (normalizedLearner.contains("not") && !normalizedModel.contains("not")) {
            return true;
        }
        return false;
    }

    private boolean isCapitalizationOnlyCorrection(String originalText, String revisedText) {
        String original = blankToNull(originalText);
        String revised = blankToNull(revisedText);
        if (original == null || revised == null) {
            return false;
        }
        if (original.equals(revised)) {
            return false;
        }
        return original.equalsIgnoreCase(revised)
                && normalizeExpressionForOverlap(original).equals(normalizeExpressionForOverlap(revised));
    }

    private boolean omitsMajorLearnerClause(String learnerAnswer, String modelAnswer) {
        if (learnerAnswer == null || learnerAnswer.isBlank() || modelAnswer == null || modelAnswer.isBlank()) {
            return false;
        }
        List<Set<String>> learnerClauses = splitIntoMeaningfulClauses(learnerAnswer);
        if (learnerClauses.size() < 2) {
            return false;
        }
        Set<String> modelTokens = extractContentTokens(modelAnswer);
        if (modelTokens.isEmpty()) {
            return false;
        }
        for (Set<String> clauseTokens : learnerClauses) {
            if (clauseTokens.size() < 2) {
                continue;
            }
            Set<String> overlap = new LinkedHashSet<>(clauseTokens);
            overlap.retainAll(modelTokens);
            if (overlap.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private boolean hasMinimumAnchorOverlap(String candidate, String anchorText) {
        Set<String> candidateTokens = extractContentTokens(candidate);
        Set<String> anchorTokens = extractContentTokens(anchorText);
        if (candidateTokens.isEmpty() || anchorTokens.isEmpty()) {
            return true;
        }
        Set<String> overlap = new LinkedHashSet<>(candidateTokens);
        overlap.retainAll(anchorTokens);
        return !overlap.isEmpty();
    }

    private boolean addsExcessiveNovelDetail(
            String candidate,
            String anchorText,
            AnswerBand answerBand,
            ModelAnswerMode modelAnswerMode
    ) {
        Set<String> candidateTokens = extractContentTokens(candidate);
        Set<String> anchorTokens = extractContentTokens(anchorText);
        if (candidateTokens.isEmpty() || anchorTokens.isEmpty()) {
            return false;
        }
        Set<String> novelTokens = new LinkedHashSet<>(candidateTokens);
        novelTokens.removeAll(anchorTokens);
        if (novelTokens.isEmpty()) {
            return false;
        }
        int allowedNovelTokens = switch (answerBand) {
            case NATURAL_BUT_BASIC -> 6;
            case SHORT_BUT_VALID, CONTENT_THIN ->
                    (modelAnswerMode == ModelAnswerMode.ONE_STEP_UP
                            || modelAnswerMode == ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD) ? 8 : 5;
            default -> 6;
        };
        return novelTokens.size() > allowedNovelTokens;
    }

    private ReferentTarget detectPrimaryFixReferentTarget(FeedbackPrimaryFixDto primaryFix) {
        if (primaryFix == null) {
            return ReferentTarget.NONE;
        }
        String original = blankToNull(primaryFix.originalText());
        String revised = blankToNull(primaryFix.revisedText());
        String reason = normalizeExpressionForOverlap(primaryFix.reasonKo());
        if (revised == null) {
            return ReferentTarget.NONE;
        }

        boolean revisedHasThey = containsReferentToken(revised, THEY_REFERENT_PATTERN);
        boolean revisedHasIt = containsReferentToken(revised, IT_REFERENT_PATTERN);
        boolean originalHasThey = containsReferentToken(original, THEY_REFERENT_PATTERN);
        boolean originalHasIt = containsReferentToken(original, IT_REFERENT_PATTERN);
        boolean reasonMentionsPronounOrNumber = mentionsPronounOrNumber(reason);

        if (revisedHasThey && (originalHasIt || reasonMentionsPronounOrNumber)) {
            return ReferentTarget.PLURAL;
        }
        if (revisedHasIt && (originalHasThey || reasonMentionsPronounOrNumber)) {
            return ReferentTarget.SINGULAR;
        }
        return ReferentTarget.NONE;
    }

    private ReferentTarget detectFixPointReferentTarget(FeedbackSecondaryLearningPointDto fixPoint) {
        if (fixPoint == null) {
            return ReferentTarget.NONE;
        }
        String original = blankToNull(fixPoint.originalText());
        String revised = blankToNull(fixPoint.revisedText());
        String reason = normalizeExpressionForOverlap(fixPoint.supportText());
        if (revised == null) {
            return ReferentTarget.NONE;
        }

        boolean revisedHasThey = containsReferentToken(revised, THEY_REFERENT_PATTERN);
        boolean revisedHasIt = containsReferentToken(revised, IT_REFERENT_PATTERN);
        boolean originalHasThey = containsReferentToken(original, THEY_REFERENT_PATTERN);
        boolean originalHasIt = containsReferentToken(original, IT_REFERENT_PATTERN);
        boolean reasonMentionsPronounOrNumber = mentionsPronounOrNumber(reason);

        if (revisedHasThey && (originalHasIt || reasonMentionsPronounOrNumber)) {
            return ReferentTarget.PLURAL;
        }
        if (revisedHasIt && (originalHasThey || reasonMentionsPronounOrNumber)) {
            return ReferentTarget.SINGULAR;
        }
        return ReferentTarget.NONE;
    }

    private boolean mentionsPronounOrNumber(String reason) {
        if (reason == null || reason.isBlank()) {
            return false;
        }
        String normalized = reason.toLowerCase(Locale.ROOT);
        return normalized.contains("pronoun")
                || normalized.contains("plural")
                || normalized.contains("singular")
                || normalized.contains("\uB300\uBA85\uC0AC")
                || normalized.contains("\uBCF5\uC218")
                || normalized.contains("\uB2E8\uC218");
    }

    private boolean conflictsWithReferentTarget(String text, ReferentTarget target) {
        if (text == null || text.isBlank() || target == ReferentTarget.NONE) {
            return false;
        }
        boolean hasIt = containsReferentToken(text, IT_REFERENT_PATTERN);
        boolean hasThey = containsReferentToken(text, THEY_REFERENT_PATTERN);
        return switch (target) {
            case PLURAL -> hasIt && !hasThey;
            case SINGULAR -> hasThey && !hasIt;
            case NONE -> false;
        };
    }

    private boolean containsReferentToken(String text, Pattern pattern) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return pattern.matcher(text).find();
    }

    private List<Set<String>> splitIntoMeaningfulClauses(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<Set<String>> clauses = new ArrayList<>();
        for (String clause : text.split("(?<=[.!?])\\s+|\\b(?:and|but)\\b|[,;:]")) {
            Set<String> clauseTokens = extractContentTokens(clause);
            if (!clauseTokens.isEmpty()) {
                clauses.add(clauseTokens);
            }
        }
        return List.copyOf(clauses);
    }

    private Set<String> extractContentTokens(String text) {
        String normalized = normalizeExpressionForOverlap(text);
        if (normalized.isBlank()) {
            return Set.of();
        }
        Set<String> tokens = new LinkedHashSet<>();
        for (String token : normalized.split("\\s+")) {
            if (token.length() < 3 || CONTENT_STOPWORDS.contains(token)) {
                continue;
            }
            tokens.add(token);
        }
        return tokens;
    }

    private boolean isMalformedGrammarReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return true;
        }
        String normalized = reason.trim();
        if (BROKEN_PATCH_PATTERN.matcher(normalized).find()) {
            return true;
        }
        if (normalized.contains("->")) {
            return true;
        }
        long quoteCount = normalized.chars()
                .filter(character -> character == '\'' || character == '"')
                .count();
        return quoteCount == 1;
    }

    private boolean isGenericMeaning(String meaningKo) {
        String normalized = normalizeText(meaningKo);
        if (normalized.isBlank()) {
            return false;
        }
        return normalized.equals("\uD45C\uD604 \uC124\uBA85")
                || normalized.equals("\uBB38\uC7A5 \uC124\uBA85")
                || normalized.contains("\uD45C\uD604\uC785\uB2C8\uB2E4")
                || normalized.contains("\uB73B\uC785\uB2C8\uB2E4");
    }
    private boolean isGenericGuidance(String guidanceKo) {
        String normalized = normalizeText(guidanceKo);
        if (normalized.isBlank()) {
            return false;
        }
        return normalized.equals("\uB2E4\uC74C \uBB38\uC7A5\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC4F0\uBA74 \uC88B\uC740 \uD45C\uD604\uC785\uB2C8\uB2E4.")
                || normalized.equals("\uC124\uBA85\uACFC \uD568\uAED8 \uC4F0\uBA74 \uC720\uC6A9\uD574\uC694.")
                || normalized.equals("\uC0AC\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.");
    }
    private String trimToSentenceCount(String text, int maxSentences) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] sentences = text.trim().split("(?<=[.!?])\\s+");
        if (sentences.length <= maxSentences) {
            return text.trim();
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < maxSentences; i++) {
            if (i > 0) {
                builder.append(' ');
            }
            builder.append(sentences[i].trim());
        }
        return builder.toString().trim();
    }

    private String trimToWordCount(String text, int maxWordCount) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = WORD_PATTERN.matcher(text);
        int count = 0;
        int endIndex = -1;
        while (matcher.find()) {
            count++;
            endIndex = matcher.end();
            if (count >= maxWordCount) {
                break;
            }
        }
        if (count < maxWordCount || endIndex < 0 || endIndex >= text.length()) {
            return text.trim();
        }
        return text.substring(0, endIndex).trim();
    }

    private int countWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        Matcher matcher = WORD_PATTERN.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private int findOverlappingRefinementIndex(
            List<RefinementExpressionDto> existingExpressions,
            RefinementExpressionDto candidate
    ) {
        for (int index = 0; index < existingExpressions.size(); index++) {
            RefinementExpressionDto existing = existingExpressions.get(index);
            if (areOverlappingRefinementExpressions(existing, candidate)) {
                return index;
            }
        }
        return -1;
    }

    private boolean areOverlappingRefinementExpressions(
            RefinementExpressionDto left,
            RefinementExpressionDto right
    ) {
        String normalizedLeft = normalizeExpressionForOverlap(left == null ? null : left.expression());
        String normalizedRight = normalizeExpressionForOverlap(right == null ? null : right.expression());
        if (normalizedLeft.isBlank() || normalizedRight.isBlank()) {
            return false;
        }
        if (normalizedLeft.equals(normalizedRight)) {
            return true;
        }
        if (!hasMeaningfulTokenOverlap(normalizedLeft, normalizedRight)) {
            return false;
        }
        return normalizedLeft.startsWith(normalizedRight + " ")
                || normalizedRight.startsWith(normalizedLeft + " ");
    }

    private boolean hasMeaningfulTokenOverlap(String left, String right) {
        Set<String> leftTokens = extractMeaningfulTokens(left);
        Set<String> rightTokens = extractMeaningfulTokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return false;
        }

        Set<String> intersection = new LinkedHashSet<>(leftTokens);
        intersection.retainAll(rightTokens);
        return intersection.size() >= Math.min(2, Math.min(leftTokens.size(), rightTokens.size()));
    }

    private Set<String> extractMeaningfulTokens(String text) {
        String normalized = normalizeExpressionForOverlap(text);
        if (normalized.isBlank()) {
            return Set.of();
        }
        Set<String> tokens = new LinkedHashSet<>();
        for (String token : normalized.split("\\s+")) {
            if (token.length() >= 3) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private int refinementSpecificityScore(RefinementExpressionDto expression) {
        String normalized = normalizeExpressionForOverlap(expression == null ? null : expression.expression());
        if (normalized.isBlank()) {
            return 0;
        }
        int meaningfulTokenCount = extractMeaningfulTokens(normalized).size();
        int totalTokenCount = normalized.split("\\s+").length;
        return meaningfulTokenCount * 100 + totalTokenCount * 10 + normalized.length();
    }

    private String normalizeExpressionForOverlap(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return text.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s']", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizeText(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
    }

    private String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }

    private boolean isNearDuplicate(String left, String right) {
        if (left.isBlank() || right.isBlank()) {
            return false;
        }
        if (left.contains(right) || right.contains(left)) {
            return true;
        }

        Set<String> leftTokens = extractMeaningfulTokens(left);
        Set<String> rightTokens = extractMeaningfulTokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return false;
        }

        Set<String> overlap = new LinkedHashSet<>(leftTokens);
        overlap.retainAll(rightTokens);
        int smallerSize = Math.min(leftTokens.size(), rightTokens.size());
        return !overlap.isEmpty() && overlap.size() >= Math.max(2, smallerSize - 1);
    }

    private boolean isOneStepUpModelAnswer(String quotedGuideBase, String modelAnswer) {
        String normalizedBase = normalizeExpressionForOverlap(quotedGuideBase);
        String normalizedModelAnswer = normalizeExpressionForOverlap(modelAnswer);
        if (normalizedBase.isBlank() || normalizedModelAnswer.isBlank()) {
            return false;
        }
        if (!normalizedModelAnswer.startsWith(normalizedBase)) {
            return false;
        }
        return countWords(modelAnswer) >= countWords(quotedGuideBase) + 4;
    }

    private enum ReferentTarget {
        NONE,
        SINGULAR,
        PLURAL
    }

    record ModelAnswerContent(
            String modelAnswer,
            String modelAnswerKo
    ) {
    }
}



