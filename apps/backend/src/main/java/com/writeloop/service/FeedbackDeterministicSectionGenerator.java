package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.PromptDto;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class FeedbackDeterministicSectionGenerator {
    private static final Pattern STRUGGLE_TO_PATTERN = Pattern.compile("\\bstruggle to [^,.!?;]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern BY_ING_PATTERN = Pattern.compile("\\bby [a-z]+ing [^,.!?;]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern BECAUSE_PATTERN = Pattern.compile("\\bbecause [^,.!?;]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern HELPS_PATTERN = Pattern.compile("\\b(?:this helps me|it helps me|it makes me feel) [^,.!?;]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern STAY_ON_TRACK_PATTERN = Pattern.compile("\\bstay on track\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern BECAUSE_I_WANT_TO_PATTERN = Pattern.compile("(?i)\\bbecause I want to ([^.?!]+)");
    private static final Pattern THIS_HELPS_ME_PATTERN = Pattern.compile("(?i)^(?:this|it) helps me ([^.?!]+)\\.?$");
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}][\\p{L}'-]*");

    private final FeedbackSectionValidators validators = new FeedbackSectionValidators();

    CorrectionDto buildSingleImprovement(
            PromptDto prompt,
            AnswerProfile answerProfile,
            AnswerBand answerBand,
            String correctedBase
    ) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return null;
        }

        String action = answerProfile.rewrite().target() == null ? "" : safe(answerProfile.rewrite().target().action());
        return switch (action) {
            case "ADD_REASON" -> new CorrectionDto(
                    "이유를 한 가지 더 분명하게 써 보세요.",
                    "왜 중요한지 보여 주는 이유 한 문장을 더 붙여 보세요."
            );
            case "ADD_EXAMPLE" -> new CorrectionDto(
                    "짧은 예시를 넣으면 답이 더 구체적으로 보여요.",
                    "내용을 보여 주는 예시 한 문장을 더 붙여 보세요."
            );
            case "ADD_DETAIL" -> new CorrectionDto(
                    "답의 방향은 맞지만 아직 조금 얇아요.",
                    detailInstruction(prompt, answerProfile, answerBand, correctedBase)
            );
            case "FIX_BLOCKING_GRAMMAR" -> new CorrectionDto(
                    "문장을 막는 핵심 문법부터 먼저 바로잡아 보세요.",
                    detailInstruction(prompt, answerProfile, answerBand, correctedBase)
            );
            case "FIX_LOCAL_GRAMMAR" -> new CorrectionDto(
                    "표현을 조금 더 자연스럽게 다듬어 보세요.",
                    detailInstruction(prompt, answerProfile, answerBand, correctedBase)
            );
            default -> fallbackImprovement(prompt, answerProfile, answerBand, correctedBase);
        };
    }

    String buildRewriteGuide(
            PromptDto prompt,
            AnswerProfile answerProfile,
            AnswerBand answerBand,
            String correctedBase,
            String minimalCorrection,
            String skeleton
    ) {
        String base = firstNonBlank(correctedBase, minimalCorrection, skeleton);
        if (base == null) {
            return null;
        }

        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            if (minimalCorrection != null && skeleton != null && !normalize(minimalCorrection).equals(normalize(skeleton))) {
                return "\"" + minimalCorrection + "\"처럼 먼저 문장을 완성하고, \"" + skeleton + "\" 틀로 다시 써 보세요. "
                        + detailInstruction(prompt, answerProfile, answerBand, base);
            }
            if (skeleton != null) {
                return "\"" + skeleton + "\" 틀에 맞춰 문장을 다시 써 보세요. "
                        + detailInstruction(prompt, answerProfile, answerBand, base);
            }
        }

        return "\"" + base + "\" " + detailInstruction(prompt, answerProfile, answerBand, base);
    }

    String buildOneStepUpModelAnswer(
            PromptDto prompt,
            AnswerProfile answerProfile,
            AnswerBand answerBand,
            String correctedBase,
            String fallbackModelAnswer
    ) {
        String base = validators.dedupeRepeatedSentences(validators.sanitizeCorrectedSentence(correctedBase));
        if (base == null) {
            return null;
        }

        String preferredFallback = validators.dedupeRepeatedSentences(
                validators.sanitizeCorrectedSentence(trimToSentenceCount(fallbackModelAnswer, 2))
        );
        String baseSentence = firstSentence(base);
        if (preferredFallback != null
                && baseSentence != null
                && normalize(preferredFallback).startsWith(normalize(baseSentence))
                && countWords(preferredFallback) >= countWords(baseSentence) + 3
                && !validators.losesMajorContent(base, preferredFallback)
                && hasNovelSentence(preferredFallback, base)) {
            return preferredFallback;
        }

        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            return preferredFallback == null ? base : preferredFallback;
        }

        if (answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN) {
            String condensedSequence = buildCondensedSequenceOneStepUp(base);
            if (condensedSequence != null && !validators.losesMajorContent(base, condensedSequence)) {
                return validators.dedupeRepeatedSentences(condensedSequence);
            }
        }

        String detailSentence = extractHelpfulDetailSentence(fallbackModelAnswer, base);
        if (detailSentence == null) {
            detailSentence = inferSupportSentence(prompt, answerProfile, answerBand, base);
        }
        if (detailSentence == null || containsEquivalentSentence(base, detailSentence)) {
            return validators.dedupeRepeatedSentences(base);
        }

        String merged = mergeDetailIntoBase(base, detailSentence);
        if (merged == null) {
            merged = mergeHelpSentenceIntoBase(base, detailSentence);
        }
        if (merged != null) {
            return validators.dedupeRepeatedSentences(merged);
        }
        return validators.dedupeRepeatedSentences(base + " " + detailSentence);
    }

    List<RefinementCard> buildRepairRefinements(String correctedBase, int maxCount) {
        if (correctedBase == null || correctedBase.isBlank() || maxCount <= 0) {
            return List.of();
        }
        List<RefinementCard> cards = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        addPatternCard(cards, seen, STRUGGLE_TO_PATTERN, correctedBase, "마감일을 맞추는 데 어려움을 겪다", "자주 겪는 어려움을 말할 때 쓸 수 있어요.");
        addPatternCard(cards, seen, BY_ING_PATTERN, correctedBase, "~해서, ~하는 방식으로", "해결 방법이나 실천 방식을 자연스럽게 잇는 데 좋아요.");
        addPatternCard(cards, seen, BECAUSE_PATTERN, correctedBase, "~때문에", "이유를 짧고 자연스럽게 덧붙일 때 쓸 수 있어요.");
        addPatternCard(cards, seen, HELPS_PATTERN, correctedBase, "~하는 데 도움이 되다", "효과나 변화를 설명할 때 쓸 수 있어요.");
        addPatternCard(cards, seen, STAY_ON_TRACK_PATTERN, correctedBase, "계획대로 유지하다", "일정이나 계획을 지킨다고 말할 때 자연스럽게 쓸 수 있어요.");
        return List.copyOf(cards.subList(0, Math.min(cards.size(), maxCount)));
    }

    String buildSummary(
            AnswerProfile answerProfile,
            List<String> strengths,
            List<CorrectionDto> corrections,
            AnswerBand answerBand
    ) {
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING) {
            return "문제와 해결 방법을 함께 제시한 점은 좋아요. 먼저 뜻을 막는 핵심 문법을 바로잡아야 해요.";
        }
        String strengthClause = strengths == null || strengths.isEmpty()
                ? fallbackStrengthClause(answerProfile)
                : stripTrailingSentencePunctuation(strengths.get(0));
        String correctionClause = null;
        if (corrections != null && !corrections.isEmpty() && corrections.get(0) != null) {
            correctionClause = stripTrailingSentencePunctuation(corrections.get(0).suggestion());
        }
        if (strengthClause != null && correctionClause != null) {
            return strengthClause + " " + correctionClause;
        }
        if (strengthClause != null) {
            return strengthClause + ".";
        }
        return correctionClause == null ? null : correctionClause + ".";
    }

    private CorrectionDto fallbackImprovement(
            PromptDto prompt,
            AnswerProfile answerProfile,
            AnswerBand answerBand,
            String correctedBase
    ) {
        if (answerBand == AnswerBand.NATURAL_BUT_BASIC
                && answerProfile != null
                && answerProfile.task() != null
                && answerProfile.task().finishable()) {
            return null;
        }
        return new CorrectionDto(
                answerBand == AnswerBand.GRAMMAR_BLOCKING
                        ? "수정문을 먼저 자연스럽게 고쳐 보세요."
                        : "답의 방향은 맞지만 한 단계만 더 확장하면 좋아요.",
                detailInstruction(prompt, answerProfile, answerBand, correctedBase)
        );
    }

    private String detailInstruction(
            PromptDto prompt,
            AnswerProfile answerProfile,
            AnswerBand answerBand,
            String correctedBase
    ) {
        String action = answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                ? ""
                : safe(answerProfile.rewrite().target().action());
        return switch (action) {
            case "ADD_REASON" -> "여기에 이유 한 가지를 더 붙여 보세요.";
            case "ADD_EXAMPLE" -> "여기에 짧은 예시 한 문장을 더 붙여 보세요.";
            case "ADD_DETAIL" -> inferredDetailInstruction(correctedBase);
            case "FIX_BLOCKING_GRAMMAR" -> correctedBase == null || correctedBase.isBlank()
                    ? "문장을 먼저 자연스럽게 고쳐서 다시 써 보세요."
                    : "이 수정문을 기준으로 다시 쓰고, 가능하면 이 방법이 어떻게 도움이 되는지 한 가지를 더 붙여 보세요.";
            case "FIX_LOCAL_GRAMMAR" -> "표현을 조금 더 자연스럽게 고친 뒤, 이유나 방법 한 가지를 더 붙여 보세요.";
            case "STATE_MAIN_ANSWER" -> "질문에 바로 답하는 완전한 문장부터 먼저 써 보세요.";
            case "MAKE_ON_TOPIC" -> "질문이 묻는 내용에 직접 답하는 문장부터 다시 써 보세요.";
            default -> answerBand == AnswerBand.TOO_SHORT_FRAGMENT
                    ? "먼저 한 문장을 완성하고, 필요하면 이유나 디테일을 한 가지 더 붙여 보세요."
                    : "여기에 이유나 구체적인 설명을 한 가지 더 붙여 보세요.";
        };
    }

    private String inferredDetailInstruction(String correctedBase) {
        return "여기에 이유나 구체적인 설명을 한 가지 더 붙여 보세요.";
    }

    private String inferSupportSentence(
            PromptDto prompt,
            AnswerProfile answerProfile,
            AnswerBand answerBand,
            String baseText
    ) {
        if (answerBand == AnswerBand.NATURAL_BUT_BASIC
                && answerProfile != null
                && answerProfile.task() != null
                && answerProfile.task().finishable()) {
            return null;
        }
        String normalized = normalize(baseText);
        if (normalized.contains("because ")
                || normalized.contains("important to me because")
                || normalized.contains("helps me")
                || normalized.contains("want to")) {
            return "This would make a positive difference in my daily life.";
        }
        if (normalized.contains("by ")
                || normalized.contains("struggle to")
                || normalized.contains("difficult")
                || normalized.contains("hard")) {
            return "This makes the situation easier to handle.";
        }
        if (answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN) {
            return "This would make a positive difference for me.";
        }
        return null;
    }

    private void addPatternCard(
            List<RefinementCard> cards,
            Set<String> seen,
            Pattern pattern,
            String correctedBase,
            String meaningKo,
            String guidanceKo
    ) {
        Matcher matcher = pattern.matcher(correctedBase);
        if (!matcher.find()) {
            return;
        }
        String expression = matcher.group().trim();
        String key = normalize(expression);
        if (!seen.add(key)) {
            return;
        }
        cards.add(new RefinementCard(
                expression,
                guidanceKo,
                buildExample(expression),
                null,
                meaningKo
        ));
    }

    private String buildExample(String expression) {
        String normalized = normalize(expression);
        if (normalized.startsWith("by ")) {
            return "I stay organized " + expression + ".";
        }
        if (normalized.startsWith("because ")) {
            return "I like it " + expression + ".";
        }
        if (normalized.contains("struggle to")) {
            return "I often " + expression + ".";
        }
        if (normalized.contains("stay on track")) {
            return "A clear plan helps me stay on track.";
        }
        if (normalized.contains("helps me")) {
            return "This routine " + expression + ".";
        }
        return "I can use this expression in my answer.";
    }

    private String extractHelpfulDetailSentence(String fallbackModelAnswer, String baseText) {
        if (fallbackModelAnswer == null || fallbackModelAnswer.isBlank()) {
            return null;
        }
        String[] sentences = fallbackModelAnswer.trim().split("(?<=[.!?])\\s+");
        for (String sentence : sentences) {
            String trimmed = sentence == null ? null : sentence.trim();
            if (trimmed == null || trimmed.isBlank()) {
                continue;
            }
            String sanitized = validators.sanitizeCorrectedSentence(trimmed);
            if (sanitized == null || sanitized.isBlank()) {
                continue;
            }
            if (containsEquivalentSentence(baseText, sanitized)) {
                continue;
            }
            if (!isSupportStyleSentence(sanitized) && countWords(sanitized) < 4) {
                continue;
            }
            if (countWords(sanitized) >= 4) {
                return sanitized;
            }
        }
        return null;
    }

    private boolean isSupportStyleSentence(String sentence) {
        String normalized = normalize(sentence);
        return normalized.startsWith("this helps")
                || normalized.startsWith("it helps")
                || normalized.startsWith("it makes me feel")
                || normalized.startsWith("this makes me feel")
                || normalized.startsWith("because ")
                || normalized.startsWith("by ")
                || normalized.startsWith("so ")
                || normalized.startsWith("that way");
    }

    private boolean hasNovelSentence(String candidateText, String baseText) {
        List<String> candidateSentences = splitSentences(candidateText);
        List<String> baseSentences = splitSentences(baseText);
        if (candidateSentences.size() > baseSentences.size()) {
            return true;
        }
        for (String candidateSentence : candidateSentences) {
            if (!containsEquivalentSentence(baseText, candidateSentence) && countWords(candidateSentence) >= 4) {
                return true;
            }
        }
        return false;
    }

    private String mergeDetailIntoBase(String base, String detailSentence) {
        Matcher reasonMatcher = BECAUSE_I_WANT_TO_PATTERN.matcher(base);
        Matcher helpMatcher = THIS_HELPS_ME_PATTERN.matcher(detailSentence);
        if (!reasonMatcher.find() || !helpMatcher.find()) {
            return null;
        }

        String currentReason = reasonMatcher.group(1).trim();
        String supportedReason = helpMatcher.group(1).trim();
        if (currentReason.isBlank() || supportedReason.isBlank()) {
            return null;
        }
        if (!normalize(supportedReason).startsWith(normalize(currentReason))) {
            return null;
        }

        String mergedReason = supportedReason.replaceFirst("[.!?]+$", "").trim();
        return base.substring(0, reasonMatcher.start(1))
                + mergedReason
                + base.substring(reasonMatcher.end(1));
    }

    private String mergeHelpSentenceIntoBase(String base, String detailSentence) {
        List<String> sentences = new ArrayList<>(splitSentences(base));
        if (sentences.isEmpty()) {
            return null;
        }

        String lastSentence = sentences.get(sentences.size() - 1);
        Matcher baseHelpMatcher = THIS_HELPS_ME_PATTERN.matcher(lastSentence);
        Matcher detailHelpMatcher = THIS_HELPS_ME_PATTERN.matcher(detailSentence);
        if (!baseHelpMatcher.find() || !detailHelpMatcher.find()) {
            return null;
        }

        String baseTail = baseHelpMatcher.group(1).trim();
        String detailTail = detailHelpMatcher.group(1).trim();
        String combinedTail = combineHelpTails(baseTail, detailTail);
        if (combinedTail == null) {
            return null;
        }

        sentences.set(sentences.size() - 1, "This helps me " + combinedTail + ".");
        return String.join(" ", sentences);
    }

    private String combineHelpTails(String baseTail, String detailTail) {
        String normalizedBase = normalizeSentenceBody(baseTail);
        String normalizedDetail = normalizeSentenceBody(detailTail);
        if (normalizedBase.equals(normalizedDetail)) {
            return baseTail;
        }
        if (normalizedDetail.startsWith(normalizedBase + " and ")) {
            return detailTail;
        }
        if (normalizedBase.startsWith(normalizedDetail + " and ")) {
            return baseTail;
        }
        if (normalizedBase.contains(normalizedDetail) || normalizedDetail.contains(normalizedBase)) {
            return detailTail.length() >= baseTail.length() ? detailTail : baseTail;
        }
        return baseTail + " and " + lowerCaseFirst(detailTail);
    }

    private boolean containsEquivalentSentence(String baseText, String sentence) {
        if (baseText == null || sentence == null) {
            return false;
        }
        for (String existing : splitSentences(baseText)) {
            if (normalizeSentenceBody(existing).equals(normalizeSentenceBody(sentence))) {
                return true;
            }
        }
        return false;
    }

    private List<String> splitSentences(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<String> sentences = new ArrayList<>();
        for (String sentence : text.trim().split("(?<=[.!?])\\s+")) {
            String sanitized = validators.sanitizeCorrectedSentence(sentence);
            if (sanitized != null && !sanitized.isBlank()) {
                sentences.add(sanitized);
            }
        }
        return List.copyOf(sentences);
    }

    private String normalizeSentenceBody(String text) {
        return normalize(text).replaceAll("[.!?]+$", "").trim();
    }

    private String buildCondensedSequenceOneStepUp(String base) {
        List<String> sentences = splitSentences(base);
        if (sentences.size() < 3) {
            return null;
        }

        List<String> tailClauses = new ArrayList<>();
        for (int index = 1; index < sentences.size(); index++) {
            String clause = toJoinableClause(sentences.get(index), tailClauses.isEmpty());
            if (clause != null) {
                tailClauses.add(clause);
            }
        }
        if (tailClauses.size() < 2) {
            return null;
        }

        StringBuilder secondSentence = new StringBuilder();
        for (int index = 0; index < tailClauses.size(); index++) {
            String clause = index == 0 ? tailClauses.get(index) : normalizeJoinedClause(tailClauses.get(index));
            if (index == 0) {
                secondSentence.append(clause);
            } else if (index == tailClauses.size() - 1) {
                secondSentence.append(tailClauses.size() == 2 ? " and " : ", and ").append(clause);
            } else {
                secondSentence.append(", ").append(clause);
            }
        }
        if (!secondSentence.toString().startsWith("I ")) {
            secondSentence.insert(0, "Then, ");
        }
        secondSentence.append('.');
        return sentences.get(0) + " " + secondSentence;
    }

    private String toJoinableClause(String sentence, boolean keepSubject) {
        String sanitized = validators.sanitizeCorrectedSentence(sentence);
        if (sanitized == null || sanitized.isBlank()) {
            return null;
        }
        String clause = sanitized
                .replaceFirst("[.!?]+$", "")
                .replaceFirst("(?i)^(?:for that|after that|afterwards|then|next|also),?\\s*", "")
                .trim();
        clause = clause.trim();
        if (clause.isBlank() || countWords(clause) < 2) {
            return null;
        }
        return clause;
    }

    private String normalizeJoinedClause(String clause) {
        if (clause == null || clause.isBlank()) {
            return clause;
        }
        if (clause.startsWith("I ")) {
            return clause;
        }
        return lowerCaseFirst(clause);
    }

    private String fallbackStrengthClause(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return "질문에 맞게 답하려는 방향은 좋아요";
        }
        ContentSignals signals = answerProfile.content().signals();
        if (signals.hasMainAnswer() && signals.hasReason()) {
            return "질문에 맞는 답과 이유를 함께 말한 점이 좋아요";
        }
        if (signals.hasMainAnswer() && signals.hasActivity()) {
            return "문제와 해결 방법을 함께 제시한 점이 좋아요";
        }
        if (signals.hasMainAnswer()) {
            return "질문에 맞는 핵심 답을 분명하게 말한 점이 좋아요";
        }
        return "질문에 맞게 답하려는 방향은 좋아요";
    }

    private String stripTrailingSentencePunctuation(String text) {
        String clean = text == null ? null : text.trim();
        if (clean == null || clean.isBlank()) {
            return null;
        }
        return clean.replaceFirst("[.!?]+$", "");
    }

    private String firstSentence(String text) {
        List<String> sentences = splitSentences(text);
        return sentences.isEmpty() ? null : sentences.get(0);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
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
        for (int index = 0; index < maxSentences; index++) {
            if (index > 0) {
                builder.append(' ');
            }
            builder.append(sentences[index].trim());
        }
        return builder.toString().trim();
    }

    private int countWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        int count = 0;
        Matcher matcher = WORD_PATTERN.matcher(text);
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private String normalize(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
    }

    private String safe(String text) {
        return text == null ? "" : text.trim();
    }

    private String lowerCaseFirst(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return text.substring(0, 1).toLowerCase(Locale.ROOT) + text.substring(1);
    }
}
