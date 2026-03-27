package com.writeloop.dto;

public record CoachHelpRequestDto(
        String promptId,
        String question,
        String sessionId,
        String answer,
        String attemptType
) {
    public CoachHelpRequestDto(String promptId, String question) {
        this(promptId, question, null, null, null);
    }
}
