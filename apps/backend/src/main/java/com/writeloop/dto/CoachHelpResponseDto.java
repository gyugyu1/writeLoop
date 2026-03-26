package com.writeloop.dto;

import java.util.List;

public record CoachHelpResponseDto(
        String promptId,
        String userQuestion,
        String coachReply,
        List<CoachExpressionDto> expressions
) {
}
