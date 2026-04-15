package com.writeloop.dto;

public record FeedbackRewriteIdeaDto(
        String title,
        String english,
        String meaningKo,
        String noteKo,
        String originalText,
        String revisedText,
        boolean optionalTone
) {
    public FeedbackRewriteIdeaDto {
        title = normalize(title);
        english = normalize(english);
        meaningKo = normalize(meaningKo);
        noteKo = normalize(noteKo);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
    }

    public static FeedbackRewriteIdeaDto highlight(
            String title,
            String english,
            String meaningKo,
            String noteKo,
            String originalText,
            String revisedText,
            boolean optionalTone
    ) {
        return new FeedbackRewriteIdeaDto(
                title,
                english,
                meaningKo,
                noteKo,
                originalText,
                revisedText,
                optionalTone
        );
    }

    public static FeedbackRewriteIdeaDto suggestion(
            String english,
            String meaningKo,
            String noteKo
    ) {
        return new FeedbackRewriteIdeaDto(
                null,
                english,
                meaningKo,
                noteKo,
                null,
                null,
                false
        );
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
