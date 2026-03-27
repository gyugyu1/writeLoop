package com.writeloop.service;

import com.writeloop.dto.AdminCoachEvaluationItemDto;
import com.writeloop.dto.AdminCoachEvaluationRunResponseDto;
import com.writeloop.dto.AdminCoachEvaluationSummaryDto;
import com.writeloop.persistence.CoachEvaluationStatus;
import com.writeloop.persistence.CoachInteractionEntity;
import com.writeloop.persistence.CoachInteractionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CoachEvaluationService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    private final CoachInteractionRepository coachInteractionRepository;
    private final OpenAiCoachEvaluationClient openAiCoachEvaluationClient;

    public AdminCoachEvaluationSummaryDto getSummary() {
        return new AdminCoachEvaluationSummaryDto(
                openAiCoachEvaluationClient.isConfigured(),
                coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.NOT_EVALUATED),
                coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.IN_REVIEW),
                coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.APPROPRIATE),
                coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.INAPPROPRIATE),
                coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.NEEDS_REVIEW)
        );
    }

    public AdminCoachEvaluationRunResponseDto evaluatePendingInteractions(Integer requestedLimit) {
        if (!openAiCoachEvaluationClient.isConfigured()) {
            throw new IllegalStateException("OpenAI coach evaluator is not configured");
        }

        int limit = normalizeLimit(requestedLimit);
        List<CoachInteractionEntity> pending = coachInteractionRepository.findByEvaluationStatusOrderByCreatedAtAsc(
                CoachEvaluationStatus.NOT_EVALUATED,
                PageRequest.of(0, limit)
        );

        List<AdminCoachEvaluationItemDto> items = new ArrayList<>();
        int appropriateCount = 0;
        int inappropriateCount = 0;
        int needsReviewCount = 0;

        for (CoachInteractionEntity interaction : pending) {
            interaction.updateEvaluation(
                    CoachEvaluationStatus.IN_REVIEW,
                    null,
                    null,
                    "평가 중입니다.",
                    openAiCoachEvaluationClient.configuredModel(),
                    null,
                    null
            );
            coachInteractionRepository.save(interaction);

            OpenAiCoachEvaluationClient.CoachEvaluationResult evaluationResult;
            try {
                evaluationResult = openAiCoachEvaluationClient.evaluate(interaction);
            } catch (RuntimeException exception) {
                interaction.updateEvaluation(
                        CoachEvaluationStatus.NEEDS_REVIEW,
                        null,
                        "INSUFFICIENT_CONTEXT",
                        "OpenAI 평가 호출에 실패해 수동 검토가 필요합니다.",
                        openAiCoachEvaluationClient.configuredModel(),
                        buildFailurePayload(exception),
                        Instant.now()
                );
                coachInteractionRepository.save(interaction);
                needsReviewCount++;
                items.add(toItem(interaction));
                continue;
            }

            interaction.updateEvaluation(
                    evaluationResult.evaluationStatus(),
                    evaluationResult.score(),
                    evaluationResult.verdict(),
                    evaluationResult.summary(),
                    openAiCoachEvaluationClient.configuredModel(),
                    evaluationResult.payloadJson(),
                    Instant.now()
            );
            coachInteractionRepository.save(interaction);

            switch (evaluationResult.evaluationStatus()) {
                case APPROPRIATE -> appropriateCount++;
                case INAPPROPRIATE -> inappropriateCount++;
                case NEEDS_REVIEW, IN_REVIEW, NOT_EVALUATED -> needsReviewCount++;
            }
            items.add(toItem(interaction));
        }

        return new AdminCoachEvaluationRunResponseDto(
                limit,
                items.size(),
                appropriateCount,
                inappropriateCount,
                needsReviewCount,
                openAiCoachEvaluationClient.configuredModel(),
                items
        );
    }

    private int normalizeLimit(Integer requestedLimit) {
        if (requestedLimit == null || requestedLimit < 1) {
            return DEFAULT_LIMIT;
        }
        return Math.min(requestedLimit, MAX_LIMIT);
    }

    private String buildFailurePayload(RuntimeException exception) {
        String message = exception.getMessage() == null ? "unknown" : exception.getMessage();
        return "{\"error\":\"" + message.replace("\"", "'") + "\"}";
    }

    private AdminCoachEvaluationItemDto toItem(CoachInteractionEntity interaction) {
        return new AdminCoachEvaluationItemDto(
                interaction.getRequestId(),
                interaction.getPromptId(),
                interaction.getQueryMode(),
                interaction.getMeaningFamily(),
                interaction.getEvaluationStatus().name(),
                interaction.getEvaluationScore(),
                interaction.getEvaluationVerdict(),
                interaction.getEvaluationSummary()
        );
    }
}
