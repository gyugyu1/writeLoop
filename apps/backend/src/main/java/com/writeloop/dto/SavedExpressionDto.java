package com.writeloop.dto;

import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.SavedExpressionEntity;
import com.writeloop.persistence.SavedExpressionSourceType;
import com.writeloop.util.ExpressionTagSupport;
import com.writeloop.util.UsedExpressionSanitizer;

import java.time.Instant;
import java.util.List;

public record SavedExpressionDto(
        Long id,
        String expression,
        String meaningKo,
        String usageTipKo,
        String exampleEn,
        SavedExpressionSourceType sourceType,
        String promptId,
        String promptDifficulty,
        String promptTopic,
        String promptQuestionEn,
        String promptQuestionKo,
        List<String> tags,
        Integer saveCount,
        Instant lastSavedAt,
        Instant createdAt
) {
    public static SavedExpressionDto from(SavedExpressionEntity entity, PromptEntity prompt) {
        String displayExpression = entity.getSourceType() == SavedExpressionSourceType.USED_EXPRESSION
                ? UsedExpressionSanitizer.sanitizeCandidate(entity.getExpression())
                : entity.getExpression();
        List<String> displayTags = ExpressionTagSupport.withSavedExpressionDefaults(
                ExpressionTagSupport.fromJson(entity.getTagsJson()),
                entity.getSourceType(),
                displayExpression
        );
        return new SavedExpressionDto(
                entity.getId(),
                displayExpression,
                entity.getMeaningKo(),
                entity.getUsageTipKo(),
                entity.getExampleEn(),
                entity.getSourceType(),
                entity.getPromptId(),
                prompt == null ? null : prompt.getDifficulty(),
                prompt == null ? null : prompt.getTopic(),
                prompt == null ? null : prompt.getQuestionEn(),
                prompt == null ? null : prompt.getQuestionKo(),
                displayTags,
                entity.getSaveCount(),
                entity.getLastSavedAt(),
                entity.getCreatedAt()
        );
    }
}
