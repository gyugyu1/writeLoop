package com.writeloop.dto;

import java.util.List;

public record AdminPromptDto(
        String id,
        String topic,
        String topicCategory,
        String topicDetail,
        String difficulty,
        String questionEn,
        String questionKo,
        String tip,
        Integer displayOrder,
        boolean active,
        PromptCoachProfileDto coachProfile,
        List<AdminPromptHintDto> hints
) {
    public AdminPromptDto(
            String id,
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            boolean active,
            List<AdminPromptHintDto> hints
    ) {
        this(id, topic, null, null, difficulty, questionEn, questionKo, tip, displayOrder, active, null, hints);
    }

    public AdminPromptDto {
        String resolvedTopicCategory = topicCategory;
        String resolvedTopicDetail = topicDetail;
        if ((resolvedTopicCategory == null || resolvedTopicCategory.isBlank())
                && (resolvedTopicDetail == null || resolvedTopicDetail.isBlank())
                && topic != null
                && !topic.isBlank()) {
            String[] parts = topic.split("\\s+-\\s+", 2);
            resolvedTopicCategory = parts[0].trim();
            resolvedTopicDetail = parts.length > 1 ? parts[1].trim() : "";
        }

        topicCategory = resolvedTopicCategory == null ? "" : resolvedTopicCategory.trim();
        topicDetail = resolvedTopicDetail == null ? "" : resolvedTopicDetail.trim();
        topic = combineTopic(topic, topicCategory, topicDetail);
    }

    private static String combineTopic(String topic, String topicCategory, String topicDetail) {
        if (topic != null && !topic.isBlank()) {
            return topic.trim();
        }
        if (topicCategory == null || topicCategory.isBlank()) {
            return topicDetail == null ? "" : topicDetail.trim();
        }
        if (topicDetail == null || topicDetail.isBlank()) {
            return topicCategory.trim();
        }
        return topicCategory.trim() + " - " + topicDetail.trim();
    }
}
