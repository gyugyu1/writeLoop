package com.writeloop.util;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

public final class UsedExpressionSanitizer {

    private static final Set<String> TRAILING_WEAK_TOKENS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "because", "for", "from", "if",
            "in", "into", "is", "my", "of", "on", "or", "our", "that", "the", "their", "to", "with", "your", "his", "her"
    );
    private static final Set<String> COORDINATING_CONJUNCTION_TOKENS = Set.of("and", "or", "but");
    private static final Set<String> LIKELY_DANGLING_VERB_TOKENS = Set.of(
            "do", "get", "have", "keep", "make", "take", "use"
    );

    private UsedExpressionSanitizer() {
    }

    public static String sanitizeCandidate(String candidate) {
        if (candidate == null) {
            return "";
        }

        String sanitized = candidate.trim()
                .replaceAll("\\s+", " ")
                .replaceAll("^[^\\p{L}\\p{N}']+|[^\\p{L}\\p{N}']+$", "");
        if (sanitized.isBlank()) {
            return "";
        }

        String[] tokens = sanitized.split("\\s+");
        int end = trimTrailingTokens(tokens, tokens.length);
        if (end <= 0) {
            return "";
        }

        return String.join(" ", Arrays.copyOf(tokens, end)).trim();
    }

    private static int trimTrailingTokens(String[] tokens, int tokenCount) {
        int end = tokenCount;
        while (end > 0) {
            boolean changed = false;

            if (end > 1 && isDanglingTail(tokens[end - 2], tokens[end - 1])) {
                end -= 1;
                changed = true;
            }

            while (end > 0 && TRAILING_WEAK_TOKENS.contains(normalize(tokens[end - 1]))) {
                end -= 1;
                changed = true;
            }

            if (!changed) {
                break;
            }
        }
        return end;
    }

    private static boolean isDanglingTail(String previousToken, String lastToken) {
        String normalizedLast = normalize(lastToken);
        if (!LIKELY_DANGLING_VERB_TOKENS.contains(normalizedLast)) {
            return false;
        }

        String normalizedPrevious = normalize(previousToken);
        return COORDINATING_CONJUNCTION_TOKENS.contains(normalizedPrevious)
                || "to".equals(normalizedPrevious);
    }

    private static String normalize(String token) {
        return token == null ? "" : token.toLowerCase(Locale.ROOT);
    }
}
