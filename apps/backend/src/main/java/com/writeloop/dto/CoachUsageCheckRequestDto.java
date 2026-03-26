package com.writeloop.dto;

import java.util.List;

public record CoachUsageCheckRequestDto(
        String promptId,
        String answer,
        List<String> expressions
) {
}
