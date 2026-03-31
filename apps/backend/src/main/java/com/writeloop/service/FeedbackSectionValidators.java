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
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\[[^\\]\\r\\n]{1,24}\\]");
    private static final Pattern BROKEN_PATCH_PATTERN = Pattern.compile("'.+?'\\s*->\\s*'.+?'");
    private static final Set<String> GENERIC_MEANING_TEXTS = Set.of(
            "?ㅼ쓬 ?듬??먯꽌 ?쒖슜?섍린 醫뗭? ?쒗쁽",
            "?ㅼ쓬 ?듬???諛붾줈 媛?몃떎 ?????덈뒗 ?쒗쁽 ?"
    );
    private static final Set<String> GENERIC_GUIDANCE_TEXTS = Set.of(
            "?ㅼ쓬 ?듬??먯꽌 ?쒖슜?섍린 醫뗭? ?쒗쁽",
            "?ㅼ쓬 ?듬???諛붾줈 媛?몃떎 ?????덈뒗 ?쒗쁽 ?"
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
            if (GENERIC_MEANING_TEXTS.contains(normalizeText(expression.meaningKo()))) {
                continue;
            }
            if (GENERIC_GUIDANCE_TEXTS.contains(normalizeText(expression.guidanceKo()))) {
                continue;
            }
            if (isGenericMeaning(expression.meaningKo()) || isGenericGuidance(expression.guidanceKo())) {
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

        if (!isNearDuplicate(normalizedGuide, normalizedModelAnswer)) {
            return cleanGuide;
        }

        String quotedHint = extractLeadingQuotedHint(cleanGuide);
        if (grammarBlocking
                && quotedHint != null
                && hasMeaningfulGuidanceText(stripLeadingQuotedHint(cleanGuide))
                && isOneStepUpModelAnswer(quotedHint, modelAnswer)) {
            return cleanGuide;
        }

        String stripped = rewriteGuide == null
                ? null
                : rewriteGuide
                .replaceAll("\\s*\\??곕뱜[^:]*:\\s*\"[^\"]+\"", "")
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
            return "문장을 먼저 자연스럽게 고친 뒤, 이 방법이 어떻게 도움이 되는지 한 가지를 더 붙여 보세요.";
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
        if (issue.contains("臾몃쾿") || suggestion.contains("臾몃쾿") || issue.contains("?쒖젣") || suggestion.contains("?쒖젣")) {
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

    private boolean containsPlaceholder(String text) {
        return text != null && PLACEHOLDER_PATTERN.matcher(text).find();
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
        return normalized.equals("표현 설명")
                || normalized.equals("문장 설명")
                || normalized.contains("표현입니다")
                || normalized.contains("패턴입니다");
    }

    private boolean isGenericGuidance(String guidanceKo) {
        String normalized = normalizeText(guidanceKo);
        if (normalized.isBlank()) {
            return false;
        }
        return normalized.equals("다음 답변에서 자연스럽게 넣어 보면 좋은 표현이에요.")
                || normalized.equals("설명할 때 사용할 수 있어요.")
                || normalized.equals("사용할 수 있어요.");
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

    record ModelAnswerContent(
            String modelAnswer,
            String modelAnswerKo
    ) {
    }
}
