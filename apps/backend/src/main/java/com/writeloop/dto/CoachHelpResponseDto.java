package com.writeloop.dto;

import java.util.List;

public record CoachHelpResponseDto(
        String promptId,
        String userQuestion,
        String coachReply,
        List<CoachExpressionDto> expressions,
        String interactionId
) {
    public CoachHelpResponseDto(
            String promptId,
            String userQuestion,
            String coachReply,
            List<CoachExpressionDto> expressions
    ) {
        this(promptId, userQuestion, coachReply, expressions, null);
    }
}
