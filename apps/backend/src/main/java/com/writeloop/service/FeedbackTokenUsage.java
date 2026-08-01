package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

record FeedbackTokenUsage(
        Long inputTokens,
        Long cachedInputTokens,
        Long outputTokens,
        Long reasoningTokens,
        Long totalTokens
) {

    private static final FeedbackTokenUsage EMPTY =
            new FeedbackTokenUsage(null, null, null, null, null);

    static FeedbackTokenUsage empty() {
        return EMPTY;
    }

    static FeedbackTokenUsage fromOpenAiResponse(ObjectMapper objectMapper, String responseBody) {
        JsonNode usage = usageNode(objectMapper, responseBody, "usage");
        if (usage == null) {
            return empty();
        }
        return new FeedbackTokenUsage(
                nonNegativeLong(usage.path("input_tokens")),
                nonNegativeLong(usage.path("input_tokens_details").path("cached_tokens")),
                nonNegativeLong(usage.path("output_tokens")),
                nonNegativeLong(usage.path("output_tokens_details").path("reasoning_tokens")),
                nonNegativeLong(usage.path("total_tokens"))
        );
    }

    static FeedbackTokenUsage fromGeminiResponse(ObjectMapper objectMapper, String responseBody) {
        JsonNode usage = usageNode(objectMapper, responseBody, "usageMetadata");
        if (usage == null) {
            return empty();
        }
        return new FeedbackTokenUsage(
                nonNegativeLong(usage.path("promptTokenCount")),
                nonNegativeLong(usage.path("cachedContentTokenCount")),
                nonNegativeLong(usage.path("candidatesTokenCount")),
                nonNegativeLong(usage.path("thoughtsTokenCount")),
                nonNegativeLong(usage.path("totalTokenCount"))
        );
    }

    FeedbackTokenUsage plus(FeedbackTokenUsage other) {
        if (other == null) {
            return this;
        }
        return new FeedbackTokenUsage(
                sum(inputTokens, other.inputTokens),
                sum(cachedInputTokens, other.cachedInputTokens),
                sum(outputTokens, other.outputTokens),
                sum(reasoningTokens, other.reasoningTokens),
                sum(totalTokens, other.totalTokens)
        );
    }

    private static JsonNode usageNode(
            ObjectMapper objectMapper,
            String responseBody,
            String fieldName
    ) {
        if (objectMapper == null || responseBody == null || responseBody.isBlank()) {
            return null;
        }
        try {
            JsonNode usage = objectMapper.readTree(responseBody).path(fieldName);
            return usage.isObject() ? usage : null;
        } catch (JsonProcessingException ignored) {
            return null;
        }
    }

    private static Long nonNegativeLong(JsonNode node) {
        if (!node.isIntegralNumber() || !node.canConvertToLong()) {
            return null;
        }
        long value = node.longValue();
        return value < 0 ? null : value;
    }

    private static Long sum(Long left, Long right) {
        if (left == null && right == null) {
            return null;
        }
        long leftValue = left == null ? 0L : left;
        long rightValue = right == null ? 0L : right;
        return leftValue > Long.MAX_VALUE - rightValue ? null : leftValue + rightValue;
    }
}
