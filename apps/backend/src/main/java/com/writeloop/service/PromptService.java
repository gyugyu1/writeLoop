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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class PromptService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final PromptHintItemRepository promptHintItemRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;
    private final PromptHintItemSupport promptHintItemSupport;

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

        List<PromptDto> selected = shuffledPool.stream()
                .limit(3)
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
                prompt.getDifficulty(),
                prompt.getQuestionEn(),
                prompt.getQuestionKo(),
                prompt.getTip(),
                promptCoachProfileSupport.toDto(prompt)
        );
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
