package com.writeloop.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.coach-evaluation", name = "scheduled-enabled", havingValue = "true")
public class CoachEvaluationJob {

    private final CoachEvaluationService coachEvaluationService;

    @Scheduled(fixedDelayString = "${app.coach-evaluation.fixed-delay-ms:900000}")
    public void evaluatePending() {
        coachEvaluationService.evaluatePendingInteractions(null);
    }
}
