package com.writeloop.dto;

public record FeedbackModelAnswerVariantDto(
        String kind,
        String answer,
        String answerKo,
        String reasonKo
) {
    public FeedbackModelAnswerVariantDto {
        kind = normalizeKind(kind);
        answer = normalize(answer);
        answerKo = normalizeKoreanTranslation(answerKo, answer);
        reasonKo = normalize(reasonKo);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeKind(String value) {
        String normalized = normalize(value);
        return normalized == null ? null : normalized.toUpperCase(java.util.Locale.ROOT);
    }

    private static String normalizeKoreanTranslation(String value, String answer) {
        String normalized = normalize(value);
        if (normalized == null) {
            return null;
        }

        if (!containsHangul(normalized)) {
            return null;
        }

        String normalizedAnswer = normalizeComparable(answer);
        String normalizedTranslation = normalizeComparable(normalized);
        if (normalizedAnswer != null && normalizedAnswer.equals(normalizedTranslation)) {
            return null;
        }

        return normalized;
    }

    private static boolean containsHangul(String value) {
        if (value == null) {
            return false;
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if ((character >= '\uAC00' && character <= '\uD7A3')
                    || (character >= '\u3131' && character <= '\u318E')) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeComparable(String value) {
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
}
