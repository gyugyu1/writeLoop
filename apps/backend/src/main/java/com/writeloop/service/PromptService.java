package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
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

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PromptService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final PromptHintItemRepository promptHintItemRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;
    private final PromptHintItemSupport promptHintItemSupport;
    private final PromptTaskMetaSupport promptTaskMetaSupport;

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
        LocalDate today = LocalDate.now(KOREA_ZONE);
        List<PromptEntity> activePrompts = promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        if (activePrompts.isEmpty()) {
            throw new IllegalStateException("No prompts found in database");
        }

        List<PromptEntity> exactDifficultyPrompts = activePrompts.stream()
                .filter(prompt -> difficulty.name().equalsIgnoreCase(prompt.getDifficulty()))
                .toList();

        if (exactDifficultyPrompts.isEmpty()) {
            throw new IllegalStateException("No prompts found for difficulty " + difficulty.name());
        }

        List<PromptEntity> shuffledPool = new ArrayList<>(exactDifficultyPrompts);
        Collections.shuffle(shuffledPool, new Random((today + ":" + difficulty.name()).hashCode()));

        List<PromptDto> selected = selectDistinctCategoryPrompts(shuffledPool, 3).stream()
                .map(this::toDto)
                .toList();

        return new DailyPromptRecommendationDto(today.toString(), difficulty, selected);
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
