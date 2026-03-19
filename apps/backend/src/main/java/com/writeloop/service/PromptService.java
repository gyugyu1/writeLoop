package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class PromptService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;

    public List<PromptDto> findAll() {
        return promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
                .map(this::toDto)
                .toList();
    }

    public PromptDto findById(String promptId) {
        return promptRepository.findById(promptId)
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
        return promptHintRepository.findAllByPromptIdAndActiveTrueOrderByDisplayOrderAsc(promptId).stream()
                .map(this::toHintDto)
                .toList();
    }

    private PromptDto toDto(PromptEntity prompt) {
        return new PromptDto(
                prompt.getId(),
                prompt.getTopic(),
                prompt.getDifficulty(),
                prompt.getQuestionEn(),
                prompt.getQuestionKo(),
                prompt.getTip()
        );
    }

    private PromptHintDto toHintDto(PromptHintEntity hint) {
        return new PromptHintDto(
                hint.getId(),
                hint.getPromptId(),
                hint.getHintType(),
                hint.getContent(),
                hint.getDisplayOrder()
        );
    }
}
