package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
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
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}][\\p{L}'-]*");
    private static final Set<String> GENERIC_MEANING_TEXTS = Set.of(
            "다음 답변에서 활용하기 좋은 표현",
            "다음 답변에 바로 가져다 쓸 수 있는 표현 틀"
    );
    private static final Set<String> GENERIC_GUIDANCE_TEXTS = Set.of(
            "다음 답변에서 활용하기 좋은 표현",
            "다음 답변에 바로 가져다 쓸 수 있는 표현 틀"
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
            if (isLikelyGrammarDuplicate(issue, suggestion, grammarFeedback)) {
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
        for (RefinementExpressionDto expression : refinementExpressions) {
            if (expression == null || !Boolean.TRUE.equals(expression.displayable())) {
                continue;
            }
            String normalizedExpression = normalizeText(expression.expression());
            String normalizedExample = normalizeText(expression.exampleEn());
            if (normalizedExpression.isBlank() || normalizedExample.isBlank()) {
                continue;
            }
            if (normalizedExpression.equals(normalizedExample)) {
                continue;
            }
            if (GENERIC_MEANING_TEXTS.contains(normalizeText(expression.meaningKo()))) {
                continue;
            }
            if (GENERIC_GUIDANCE_TEXTS.contains(normalizeText(expression.guidanceKo()))) {
                continue;
            }
            int overlappingIndex = findOverlappingRefinementIndex(sanitized, expression);
            if (overlappingIndex >= 0) {
                RefinementExpressionDto existing = sanitized.get(overlappingIndex);
                if (refinementSpecificityScore(expression) > refinementSpecificityScore(existing)) {
                    sanitized.set(overlappingIndex, expression);
                }
                continue;
            }
            sanitized.add(expression);
        }
        return List.copyOf(sanitized);
    }

    ModelAnswerContent guardModelAnswer(
            String learnerAnswer,
            String modelAnswer,
            String modelAnswerKo,
            int maxSentences,
            ModelAnswerMode modelAnswerMode
    ) {
        String guarded = trimToSentenceCount(modelAnswer, maxSentences);
        int learnerWordCount = countWords(learnerAnswer);
        int maxAllowedWordCount = switch (modelAnswerMode) {
            case MINIMAL_CORRECTION -> Math.max(8, learnerWordCount + 6);
            case TASK_RESET -> Math.max(10, learnerWordCount + 8);
            case ONE_STEP_UP -> Math.max(12, learnerWordCount + 12);
        };
        if (countWords(guarded) > maxAllowedWordCount) {
            guarded = trimToWordCount(guarded, maxAllowedWordCount);
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

    private boolean isLikelyGrammarDuplicate(
            String issue,
            String suggestion,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (grammarFeedback == null || grammarFeedback.isEmpty()) {
            return false;
        }
        if (issue.contains("문법") || suggestion.contains("문법") || issue.contains("시제") || suggestion.contains("시제")) {
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

    record ModelAnswerContent(
            String modelAnswer,
            String modelAnswerKo
    ) {
    }
}
