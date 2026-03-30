package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PromptService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");
    private static final Pattern QUOTED_HINT_ITEM_PATTERN = Pattern.compile("\"([^\"]+)\"");

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final PromptHintItemRepository promptHintItemRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;

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
        Map<String, List<PromptHintItemDto>> itemsByHintId = loadHintItems(hints);

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

    private PromptHintDto toHintDto(PromptHintEntity hint, List<PromptHintItemDto> persistedItems) {
        List<PromptHintItemDto> items = (persistedItems == null || persistedItems.isEmpty())
                ? deriveLegacyItems(hint)
                : persistedItems;

        return new PromptHintDto(
                hint.getId(),
                hint.getPromptId(),
                hint.getHintType(),
                hint.getContent(),
                hint.getDisplayOrder(),
                items
        );
    }

    private Map<String, List<PromptHintItemDto>> loadHintItems(List<PromptHintEntity> hints) {
        if (hints.isEmpty()) {
            return Map.of();
        }

        List<String> hintIds = hints.stream()
                .map(PromptHintEntity::getId)
                .toList();

        Map<String, List<PromptHintItemDto>> itemsByHintId = new LinkedHashMap<>();
        for (PromptHintItemEntity item : promptHintItemRepository.findAllByHintIdInAndActiveTrueOrderByDisplayOrderAsc(hintIds)) {
            itemsByHintId.computeIfAbsent(item.getHintId(), ignored -> new ArrayList<>())
                    .add(toHintItemDto(item));
        }
        return itemsByHintId;
    }

    private PromptHintItemDto toHintItemDto(PromptHintItemEntity item) {
        return new PromptHintItemDto(
                item.getId(),
                item.getHintId(),
                item.getItemType(),
                item.getContent(),
                item.getMeaningKo(),
                item.getUsageTipKo(),
                item.getExampleEn(),
                item.getExpressionFamily(),
                item.getDisplayOrder()
        );
    }

    private List<PromptHintItemDto> deriveLegacyItems(PromptHintEntity hint) {
        String content = hint.getContent() == null ? "" : hint.getContent().trim();
        if (content.isBlank()) {
            return List.of();
        }

        String hintType = hint.getHintType() == null ? "" : hint.getHintType().trim().toUpperCase(Locale.ROOT);
        List<String> candidates = new ArrayList<>();

        Matcher quotedMatcher = QUOTED_HINT_ITEM_PATTERN.matcher(content);
        while (quotedMatcher.find()) {
            String candidate = normalizeHintItemContent(quotedMatcher.group(1));
            if (!candidate.isBlank()) {
                candidates.add(candidate);
            }
        }

        if (candidates.isEmpty() && isSplitFriendlyHintType(hintType)) {
            String hintText = content.replaceFirst("^[^:]*:\\s*", "");
            for (String part : hintText.split(",")) {
                String candidate = normalizeHintItemContent(part);
                if (!candidate.isBlank()) {
                    candidates.add(candidate);
                }
            }
        }

        if (candidates.isEmpty()) {
            candidates.add(content);
        }

        List<PromptHintItemDto> items = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        int displayOrder = 1;

        for (String candidate : candidates) {
            String normalized = normalizeHintItemContent(candidate);
            String normalizedKey = normalized.toLowerCase(Locale.ROOT);
            if (normalized.isBlank() || !seen.add(normalizedKey)) {
                continue;
            }

            items.add(new PromptHintItemDto(
                    hint.getId() + "-legacy-" + displayOrder,
                    hint.getId(),
                    defaultItemType(hintType),
                    normalized,
                    null,
                    null,
                    null,
                    null,
                    displayOrder
            ));
            displayOrder += 1;
        }

        return items;
    }

    private boolean isSplitFriendlyHintType(String hintType) {
        return hintType.contains("VOCAB") || hintType.contains("LINKER");
    }

    private String defaultItemType(String hintType) {
        if (hintType.contains("VOCAB")) {
            return "WORD";
        }
        if (hintType.contains("STARTER") || hintType.contains("STRUCTURE") || hintType.contains("DETAIL")) {
            return "FRAME";
        }
        return "PHRASE";
    }

    private String normalizeHintItemContent(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
