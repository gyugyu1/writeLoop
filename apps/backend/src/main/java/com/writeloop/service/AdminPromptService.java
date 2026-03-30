package com.writeloop.service;

import com.writeloop.dto.AdminPromptDto;
import com.writeloop.dto.AdminPromptHintDto;
import com.writeloop.dto.AdminPromptHintRequestDto;
import com.writeloop.dto.AdminPromptRequestDto;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintItemEntity;
import com.writeloop.persistence.PromptHintItemRepository;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminPromptService {

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final PromptHintItemRepository promptHintItemRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;
    private final PromptHintItemSupport promptHintItemSupport;

    public List<AdminPromptDto> findAll() {
        List<PromptEntity> prompts = promptRepository.findAllByOrderByDisplayOrderAsc();
        return prompts.stream()
                .map(prompt -> toDto(prompt, promptHintRepository.findAllByPromptIdOrderByDisplayOrderAsc(prompt.getId())))
                .toList();
    }

    public AdminPromptDto createPrompt(AdminPromptRequestDto request) {
        String difficulty = normalizeDifficulty(request.difficulty());
        PromptEntity prompt = new PromptEntity(
                generatePromptId(difficulty),
                normalizeRequiredText(request.topic(), "Topic is required."),
                difficulty,
                normalizeRequiredText(request.questionEn(), "English question is required."),
                normalizeRequiredText(request.questionKo(), "Korean question is required."),
                normalizeRequiredText(request.tip(), "Tip is required."),
                normalizeDisplayOrder(request.displayOrder()),
                request.active() == null || request.active()
        );
        promptCoachProfileSupport.upsertProfile(prompt, request.coachProfile());
        prompt = promptRepository.save(prompt);

        return toDto(prompt, List.of());
    }

    public AdminPromptDto updatePrompt(String promptId, AdminPromptRequestDto request) {
        PromptEntity prompt = findPrompt(promptId);

        prompt.update(
                normalizeRequiredText(request.topic(), "Topic is required."),
                normalizeDifficulty(request.difficulty()),
                normalizeRequiredText(request.questionEn(), "English question is required."),
                normalizeRequiredText(request.questionKo(), "Korean question is required."),
                normalizeRequiredText(request.tip(), "Tip is required."),
                normalizeDisplayOrder(request.displayOrder()),
                request.active() == null || request.active()
        );
        promptCoachProfileSupport.upsertProfile(prompt, request.coachProfile());

        PromptEntity saved = promptRepository.save(prompt);
        return toDto(saved, promptHintRepository.findAllByPromptIdOrderByDisplayOrderAsc(promptId));
    }

    public void deletePrompt(String promptId) {
        PromptEntity prompt = findPrompt(promptId);
        prompt.update(
                prompt.getTopic(),
                prompt.getDifficulty(),
                prompt.getQuestionEn(),
                prompt.getQuestionKo(),
                prompt.getTip(),
                prompt.getDisplayOrder(),
                false
        );
        promptRepository.save(prompt);

        List<PromptHintEntity> hints = promptHintRepository.findAllByPromptIdOrderByDisplayOrderAsc(promptId);
        for (PromptHintEntity hint : hints) {
            hint.update(hint.getHintType(), hint.getTitle(), hint.getDisplayOrder(), false);
        }
        promptHintRepository.saveAll(hints);
    }

    public AdminPromptHintDto createHint(String promptId, AdminPromptHintRequestDto request) {
        findPrompt(promptId);

        List<String> normalizedItems = promptHintItemSupport.normalizeItemContents(request.items());
        if (normalizedItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one hint item is required.");
        }

        String hintType = promptHintItemSupport.normalizeHintType(
                normalizeRequiredText(request.hintType(), "Hint type is required."),
                request.title(),
                normalizedItems
        );

        PromptHintEntity hint = promptHintRepository.save(new PromptHintEntity(
                generateHintId(promptId),
                promptId,
                hintType,
                promptHintItemSupport.resolveTitle(request.title(), hintType),
                normalizeDisplayOrder(request.displayOrder()),
                request.active() == null || request.active()
        ));
        promptHintItemSupport.syncHintItems(hint, normalizedItems);

        return toHintDto(hint);
    }

    public AdminPromptHintDto updateHint(String promptId, String hintId, AdminPromptHintRequestDto request) {
        findPrompt(promptId);
        PromptHintEntity hint = promptHintRepository.findById(hintId)
                .filter(value -> promptId.equals(value.getPromptId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hint not found."));

        List<String> normalizedItems = promptHintItemSupport.normalizeItemContents(request.items());
        if (normalizedItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one hint item is required.");
        }

        String hintType = promptHintItemSupport.normalizeHintType(
                normalizeRequiredText(request.hintType(), "Hint type is required."),
                request.title(),
                normalizedItems
        );

        hint.update(
                hintType,
                promptHintItemSupport.resolveTitle(request.title(), hintType),
                normalizeDisplayOrder(request.displayOrder()),
                request.active() == null || request.active()
        );

        PromptHintEntity savedHint = promptHintRepository.save(hint);
        promptHintItemSupport.syncHintItems(savedHint, normalizedItems);
        return toHintDto(savedHint);
    }

    public void deleteHint(String promptId, String hintId) {
        findPrompt(promptId);
        PromptHintEntity hint = promptHintRepository.findById(hintId)
                .filter(value -> promptId.equals(value.getPromptId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hint not found."));

        hint.update(hint.getHintType(), hint.getTitle(), hint.getDisplayOrder(), false);
        promptHintRepository.save(hint);
        promptHintItemSupport.deleteHintItems(hintId);
    }

    private PromptEntity findPrompt(String promptId) {
        return promptRepository.findByIdWithCoachProfile(promptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prompt not found."));
    }

    private AdminPromptDto toDto(PromptEntity prompt, List<PromptHintEntity> hints) {
        Map<String, List<PromptHintItemEntity>> itemsByHintId = loadHintItems(hints);
        return new AdminPromptDto(
                prompt.getId(),
                prompt.getTopic(),
                prompt.getDifficulty(),
                prompt.getQuestionEn(),
                prompt.getQuestionKo(),
                prompt.getTip(),
                prompt.getDisplayOrder(),
                Boolean.TRUE.equals(prompt.getActive()),
                promptCoachProfileSupport.toDto(prompt),
                hints.stream()
                        .sorted(Comparator.comparing(PromptHintEntity::getDisplayOrder).thenComparing(PromptHintEntity::getId))
                        .map(hint -> toHintDto(hint, itemsByHintId.get(hint.getId())))
                        .toList()
        );
    }

    private AdminPromptHintDto toHintDto(PromptHintEntity hint) {
        return toHintDto(
                hint,
                promptHintItemRepository.findAllByHintIdInOrderByDisplayOrderAsc(List.of(hint.getId()))
        );
    }

    private AdminPromptHintDto toHintDto(PromptHintEntity hint, List<PromptHintItemEntity> persistedItems) {
        var resolvedItems = promptHintItemSupport.resolveItems(persistedItems);
        return new AdminPromptHintDto(
                hint.getId(),
                hint.getPromptId(),
                hint.getHintType(),
                promptHintItemSupport.resolveTitle(hint),
                hint.getDisplayOrder(),
                Boolean.TRUE.equals(hint.getActive()),
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
        for (PromptHintItemEntity item : promptHintItemRepository.findAllByHintIdInOrderByDisplayOrderAsc(hintIds)) {
            itemsByHintId.computeIfAbsent(item.getHintId(), ignored -> new java.util.ArrayList<>())
                    .add(item);
        }
        return itemsByHintId;
    }

    private String generatePromptId(String difficulty) {
        String prefix = "prompt-" + difficulty.toLowerCase(Locale.ROOT) + "-";

        int nextNumber = promptRepository.findAllByOrderByDisplayOrderAsc().stream()
                .map(PromptEntity::getId)
                .filter(id -> id != null && id.startsWith(prefix))
                .map(id -> id.substring(prefix.length()))
                .map(this::parseTrailingNumber)
                .filter(number -> number >= 0)
                .max(Integer::compareTo)
                .orElse(0) + 1;

        return prefix + nextNumber;
    }

    private String generateHintId(String promptId) {
        String prefix = promptId + "-hint-";

        int nextNumber = promptHintRepository.findAllByPromptIdOrderByDisplayOrderAsc(promptId).stream()
                .map(PromptHintEntity::getId)
                .filter(id -> id != null && id.startsWith(prefix))
                .map(id -> id.substring(prefix.length()))
                .map(this::parseTrailingNumber)
                .filter(number -> number >= 0)
                .max(Integer::compareTo)
                .orElse(0) + 1;

        return prefix + nextNumber;
    }

    private int parseTrailingNumber(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return -1;
        }
    }

    private String normalizeDifficulty(String difficulty) {
        String normalized = normalizeRequiredText(difficulty, "Difficulty is required.").toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Difficulty must be A, B, or C.");
        }
        return normalized;
    }

    private String normalizeRequiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private int normalizeDisplayOrder(Integer displayOrder) {
        return displayOrder == null ? 0 : displayOrder;
    }
}
