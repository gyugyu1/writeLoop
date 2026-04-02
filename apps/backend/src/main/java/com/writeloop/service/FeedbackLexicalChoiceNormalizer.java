package com.writeloop.service;

import java.util.List;
import java.util.regex.Pattern;

final class FeedbackLexicalChoiceNormalizer {
    private static final List<LexicalRewrite> LEXICAL_REWRITES = List.of(
            new LexicalRewrite(Pattern.compile("(?i)\\bto diet\\b"), "to eat healthier")
    );

    String normalize(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return candidate;
        }
        String revised = candidate;
        for (LexicalRewrite rewrite : LEXICAL_REWRITES) {
            revised = rewrite.pattern().matcher(revised).replaceAll(rewrite.replacement());
        }
        return revised;
    }

    boolean changed(String original, String revised) {
        return original != null
                && revised != null
                && !normalizeForComparison(original).equals(normalizeForComparison(revised));
    }

    boolean containsAwkwardLexicalChoice(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return LEXICAL_REWRITES.stream().anyMatch(rewrite -> rewrite.pattern().matcher(text).find());
    }

    private String normalizeForComparison(String text) {
        return text == null ? "" : text.toLowerCase().replaceAll("[^a-z0-9]+", " ").trim();
    }

    private record LexicalRewrite(
            Pattern pattern,
            String replacement
    ) {
    }
}
