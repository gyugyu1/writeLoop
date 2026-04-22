package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.FeaturedDailyPromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintItemEntity;
import com.writeloop.persistence.PromptHintItemRepository;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PromptService {

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final PromptHintItemRepository promptHintItemRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;
    private final PromptHintItemSupport promptHintItemSupport;
    private final PromptTaskMetaSupport promptTaskMetaSupport;
    private final TodayQuestionRecommendationService todayQuestionRecommendationService;

    public List<PromptDto> findAll() {
        return promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
                .map(this::toDto)
                .toList();
    }

    public PromptDto findById(String promptId) {
        return promptRepository.findByIdWithCoachProfile(promptId)
                .filter(prompt -> Boolean.TRUE.equals(prompt.getActive()))
                .map(this::toDto)
                .orElseGet(() -> promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
                        .findFirst()
                        .map(this::toDto)
                        .orElseThrow(() -> new IllegalStateException("No prompts found in database")));
    }

    public DailyPromptRecommendationDto recommendDailyPrompts(DailyDifficultyDto difficulty) {
        return recommendDailyPrompts(difficulty, null, null);
    }

    public DailyPromptRecommendationDto recommendDailyPrompts(
            DailyDifficultyDto difficulty,
            Long currentUserId,
            String guestId
    ) {
        return recommendDailyPrompts(difficulty, currentUserId, guestId, List.of());
    }

    public DailyPromptRecommendationDto recommendDailyPrompts(
            DailyDifficultyDto difficulty,
            Long currentUserId,
            String guestId,
            List<String> excludePromptIds
    ) {
        return todayQuestionRecommendationService.recommend(difficulty, currentUserId, guestId, excludePromptIds);
    }

    public FeaturedDailyPromptDto recommendFeaturedDailyPrompt(
            DailyDifficultyDto difficulty,
            Long currentUserId,
            String guestId
    ) {
        return todayQuestionRecommendationService.recommendFeatured(difficulty, currentUserId, guestId);
    }

    public void recordDailyPromptClick(String promptId, Long currentUserId, String guestId) {
        todayQuestionRecommendationService.recordClick(promptId, currentUserId, guestId);
    }

    public void recordDailyPromptStart(String promptId, Long currentUserId, String guestId, String sessionId) {
        todayQuestionRecommendationService.recordStart(promptId, currentUserId, guestId, sessionId);
    }

    public void recordDailyPromptComplete(String promptId, Long currentUserId, String guestId, String sessionId) {
        todayQuestionRecommendationService.recordComplete(promptId, currentUserId, guestId, sessionId);
    }

    public List<PromptHintDto> findHintsByPromptId(String promptId) {
        List<PromptHintEntity> hints = promptHintRepository.findAllByPromptIdAndActiveTrueOrderByDisplayOrderAsc(promptId);
        Map<String, List<PromptHintItemEntity>> itemsByHintId = loadHintItems(hints);

        return hints.stream()
                .map(hint -> toHintDto(hint, itemsByHintId.get(hint.getId())))
                .toList();
    }

    private PromptDto toDto(PromptEntity prompt) {
        return new PromptDto(
                prompt.getId(),
                prompt.getTopic(),
                prompt.getTopicCategory(),
                prompt.getTopicDetail(),
                prompt.getDifficulty(),
                prompt.getQuestionEn(),
                prompt.getQuestionKo(),
                prompt.getTip(),
                promptCoachProfileSupport.toDto(prompt),
                promptTaskMetaSupport.toDto(prompt)
        );
    }

    private List<PromptEntity> selectDistinctCategoryPrompts(List<PromptEntity> prompts, int limit) {
        if (limit <= 0 || prompts.isEmpty()) {
            return List.of();
        }

        List<PromptEntity> selected = new ArrayList<>();
        Set<String> selectedCategoryKeys = new HashSet<>();

        for (PromptEntity prompt : prompts) {
            if (selected.size() >= limit) {
                break;
            }

            String categoryKey = resolvePromptCategoryKey(prompt);
            if (!categoryKey.isBlank() && selectedCategoryKeys.contains(categoryKey)) {
                continue;
            }

            selected.add(prompt);
            if (!categoryKey.isBlank()) {
                selectedCategoryKeys.add(categoryKey);
            }
        }

        return selected;
    }

    private String resolvePromptCategoryKey(PromptEntity prompt) {
        if (prompt == null) {
            return "";
        }

        String topicCategory = normalizePromptCategoryKey(prompt.getTopicCategory());
        if (!topicCategory.isBlank()) {
            return topicCategory;
        }

        String topic = normalizePromptCategoryKey(prompt.getTopic());
        if (!topic.isBlank()) {
            return topic;
        }

        return prompt.getId() == null ? "" : prompt.getId().trim().toUpperCase(Locale.ROOT);
    }

    private String normalizePromptCategoryKey(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private PromptHintDto toHintDto(PromptHintEntity hint, List<PromptHintItemEntity> persistedItems) {
        var resolvedItems = promptHintItemSupport.resolveItems(persistedItems);
        return new PromptHintDto(
                hint.getId(),
                hint.getPromptId(),
                hint.getHintType(),
                promptHintItemSupport.resolveTitle(hint),
                hint.getDisplayOrder(),
                resolvedItems
        );
    }

    private Map<String, List<PromptHintItemEntity>> loadHintItems(List<PromptHintEntity> hints) {
        if (hints.isEmpty()) {
            return Map.of();
        }

        List<String> hintIds = hints.stream()
                .map(PromptHintEntity::getId)
                .toList();

        Map<String, List<PromptHintItemEntity>> itemsByHintId = new LinkedHashMap<>();
        for (PromptHintItemEntity item : promptHintItemRepository.findAllByHintIdInAndActiveTrueOrderByDisplayOrderAsc(hintIds)) {
            itemsByHintId.computeIfAbsent(item.getHintId(), ignored -> new ArrayList<>())
                    .add(item);
        }
        return itemsByHintId;
    }
}
