package com.writeloop.dto;

import java.util.List;

public record CoachUsageCheckResponseDto(
        String promptId,
        String coachReply,
        List<CoachExpressionUsageDto> usedExpressions,
        List<CoachExpressionUsageDto> unusedExpressions,
        List<String> suggestedPromptIds
) {
}
