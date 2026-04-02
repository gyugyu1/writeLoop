package com.writeloop.service;

import com.writeloop.dto.PromptDto;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class FeedbackDeterministicCorrectionResolver {
    private static final List<String> GERUNDABLE_VERBS = List.of(
            "build", "cook", "do", "drink", "eat", "enjoy", "exercise", "go", "help", "jog", "learn",
            "listen", "meet", "plan", "play", "practice", "read", "relax", "run", "sleep", "study",
            "take", "talk", "visit", "walk", "watch", "work", "write"
    );
    private static final Pattern GOAL_THIS_IS_TO_PATTERN = Pattern.compile(
            "\\bone\\s+((?:[a-z]+\\s+)*)goal\\s+i\\s+have\\s+this\\s+is\\s+to\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern IMPORTANT_FOR_ME_PATTERN = Pattern.compile(
            "\\bit(?:'s| is)\\s+important\\s+for\\s+me\\s+to\\s+([^.!?]+)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern BROKEN_SOLUTION_CONNECTOR_PATTERN = Pattern.compile(
            "(?:^|[,;])\\s*(?:to address|to solve|to handle)(?: this)?\\s+i\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern STRUGGLE_WITH_BARE_VERB_PATTERN = Pattern.compile(
            "\\bstruggle\\s+with\\s+([a-z]+)(\\b[^,.!?;]*)",
            Pattern.CASE_INSENSITIVE
    );

    private final FeedbackSectionValidators validators = new FeedbackSectionValidators();
    private final FeedbackLexicalChoiceNormalizer lexicalChoiceNormalizer = new FeedbackLexicalChoiceNormalizer();

    String resolveMinimalCorrection(
            PromptDto prompt,
            String learnerAnswer,
            AnswerProfile answerProfile,
            String candidate
    ) {
        String base = firstNonBlank(
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                candidate,
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton(),
                learnerAnswer
        );
        if (base == null || base.isBlank()) {
            return null;
        }
        String normalized = validators.sanitizeCorrectedSentence(base);
        if (normalized == null) {
            return null;
        }
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        normalized = normalizeCandidate(learnerAnswer, normalized, answerBand);
        normalized = validators.sanitizeCorrectedSentence(normalized);
        if (normalized == null) {
            return null;
        }
        return normalizeForComparison(normalized).equals(normalizeForComparison(learnerAnswer))
                ? null
                : normalized;
    }

    private String normalizeCandidate(
            String learnerAnswer,
            String candidate,
            AnswerBand answerBand
    ) {
        String revised = candidate;
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING
                || answerBand == AnswerBand.TOO_SHORT_FRAGMENT
                || answerBand == AnswerBand.SHORT_BUT_VALID
                || answerBand == AnswerBand.CONTENT_THIN) {
            revised = rewriteStruggleWithBareVerb(revised);
            revised = rewritePrepositionBareVerb(revised);
            revised = rewriteBrokenConnector(revised);
            revised = rewriteGoalFrame(revised);
            revised = rewriteImportantForMe(revised);
            revised = lexicalChoiceNormalizer.normalize(revised);
        }
        revised = revised
                .replaceAll("\\s+,", ",")
                .replaceAll(",(?=\\S)", ", ")
                .replaceAll("\\.\\s*,\\s*", ", ")
                .replaceAll("\\s+", " ")
                .trim();
        if (!revised.isEmpty()) {
            revised = Character.toUpperCase(revised.charAt(0)) + revised.substring(1);
        }
        return revised;
    }

    private String rewriteBrokenConnector(String candidate) {
        return BROKEN_SOLUTION_CONNECTOR_PATTERN.matcher(candidate)
                .replaceAll(match -> {
                    String text = match.group();
                    return text.startsWith(",") || text.startsWith(";")
                            ? ", so I"
                            : "So I";
                });
    }

    private String rewriteGoalFrame(String candidate) {
        Matcher matcher = GOAL_THIS_IS_TO_PATTERN.matcher(candidate);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String middle = matcher.group(1) == null ? "" : matcher.group(1).trim();
            String replacement = middle.isBlank()
                    ? "One goal I have this year is to"
                    : "One " + middle + " goal I have this year is to";
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private String rewriteImportantForMe(String candidate) {
        Matcher matcher = IMPORTANT_FOR_ME_PATTERN.matcher(candidate);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String tail = matcher.group(1) == null ? "" : matcher.group(1).trim();
            String replacement = tail.isBlank()
                    ? "It's important to me"
                    : "It's important to me because I want to " + tail;
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private String rewriteStruggleWithBareVerb(String candidate) {
        Matcher matcher = STRUGGLE_WITH_BARE_VERB_PATTERN.matcher(candidate);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String verb = matcher.group(1);
            String tail = matcher.group(2) == null ? "" : matcher.group(2);
            if (!GERUNDABLE_VERBS.contains(verb.toLowerCase(Locale.ROOT))) {
                continue;
            }
            String replacement = "struggle to " + verb + tail;
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private String rewritePrepositionBareVerb(String candidate) {
        String revised = candidate;
        for (String verb : GERUNDABLE_VERBS) {
            revised = revised.replaceAll(
                    "(?i)\\bby\\s+" + Pattern.quote(verb) + "\\b",
                    "by " + toGerund(verb)
            );
        }
        return revised;
    }
    private String toGerund(String verb) {
        String lower = verb.toLowerCase(Locale.ROOT);
        if (lower.endsWith("ie")) {
            return lower.substring(0, lower.length() - 2) + "ying";
        }
        if (lower.endsWith("e") && !lower.endsWith("ee")) {
            return lower.substring(0, lower.length() - 1) + "ing";
        }
        return lower + "ing";
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

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeForComparison(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return text.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
