package com.writeloop.dto;

public record FeedbackRewriteIdeaDto(
        String title,
        String english,
        String meaningKo,
        String noteKo,
        String exampleEn,
        String originalText,
        String revisedText,
        boolean optionalTone
) {
    public FeedbackRewriteIdeaDto {
        title = normalize(title);
        english = normalize(english);
        meaningKo = normalize(meaningKo);
        noteKo = normalize(noteKo);
        exampleEn = normalize(exampleEn);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
    }

    public static FeedbackRewriteIdeaDto highlight(
            String title,
            String english,
            String meaningKo,
            String noteKo,
            String exampleEn,
            String originalText,
            String revisedText,
            boolean optionalTone
    ) {
        return new FeedbackRewriteIdeaDto(
                title,
                english,
                meaningKo,
                noteKo,
                exampleEn,
                originalText,
                revisedText,
                optionalTone
        );
    }

    public static FeedbackRewriteIdeaDto suggestion(
            String english,
            String meaningKo,
            String noteKo,
            String exampleEn
    ) {
        return new FeedbackRewriteIdeaDto(
                null,
                english,
                meaningKo,
                noteKo,
                exampleEn,
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
