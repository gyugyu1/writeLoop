package com.writeloop.dto;

import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.SavedExpressionEntity;
import com.writeloop.persistence.SavedExpressionSourceType;
import com.writeloop.util.UsedExpressionSanitizer;

import java.time.Instant;

public record SavedExpressionDto(
        Long id,
        String expression,
        String meaningKo,
        String usageTipKo,
        String exampleEn,
        SavedExpressionSourceType sourceType,
        String promptId,
        String promptTopic,
        String promptQuestionEn,
        String promptQuestionKo,
        Integer saveCount,
        Instant lastSavedAt,
        Instant createdAt
) {
    public static SavedExpressionDto from(SavedExpressionEntity entity, PromptEntity prompt) {
        String displayExpression = entity.getSourceType() == SavedExpressionSourceType.USED_EXPRESSION
                ? UsedExpressionSanitizer.sanitizeCandidate(entity.getExpression())
                : entity.getExpression();
        return new SavedExpressionDto(
                entity.getId(),
                displayExpression,
                entity.getMeaningKo(),
                entity.getUsageTipKo(),
                entity.getExampleEn(),
                entity.getSourceType(),
                entity.getPromptId(),
                prompt == null ? null : prompt.getTopic(),
                prompt == null ? null : prompt.getQuestionEn(),
                prompt == null ? null : prompt.getQuestionKo(),
                entity.getSaveCount(),
                entity.getLastSavedAt(),
                entity.getCreatedAt()
        );
    }
}
