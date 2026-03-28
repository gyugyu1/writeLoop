package com.writeloop.service;

import com.writeloop.dto.AdminPromptDto;
import com.writeloop.dto.AdminPromptHintDto;
import com.writeloop.dto.AdminPromptHintRequestDto;
import com.writeloop.dto.AdminPromptRequestDto;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminPromptService {

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;

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
                normalizeRequiredText(request.topic(), "주제를 입력해 주세요."),
                difficulty,
                normalizeRequiredText(request.questionEn(), "영어 질문을 입력해 주세요."),
                normalizeRequiredText(request.questionKo(), "한국어 질문을 입력해 주세요."),
                normalizeRequiredText(request.tip(), "팁을 입력해 주세요."),
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
                normalizeRequiredText(request.topic(), "주제를 입력해 주세요."),
                normalizeDifficulty(request.difficulty()),
                normalizeRequiredText(request.questionEn(), "영어 질문을 입력해 주세요."),
                normalizeRequiredText(request.questionKo(), "한국어 질문을 입력해 주세요."),
                normalizeRequiredText(request.tip(), "팁을 입력해 주세요."),
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
            hint.update(hint.getHintType(), hint.getContent(), hint.getDisplayOrder(), false);
        }
        promptHintRepository.saveAll(hints);
    }

    public AdminPromptHintDto createHint(String promptId, AdminPromptHintRequestDto request) {
        findPrompt(promptId);
        PromptHintEntity hint = promptHintRepository.save(new PromptHintEntity(
                generateHintId(promptId),
                promptId,
                normalizeRequiredText(request.hintType(), "힌트 타입을 입력해 주세요.").toUpperCase(Locale.ROOT),
                normalizeRequiredText(request.content(), "힌트 내용을 입력해 주세요."),
                normalizeDisplayOrder(request.displayOrder()),
                request.active() == null || request.active()
        ));

        return toHintDto(hint);
    }

    public AdminPromptHintDto updateHint(String promptId, String hintId, AdminPromptHintRequestDto request) {
        findPrompt(promptId);
        PromptHintEntity hint = promptHintRepository.findById(hintId)
                .filter(value -> promptId.equals(value.getPromptId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "힌트를 찾을 수 없어요."));

        hint.update(
                normalizeRequiredText(request.hintType(), "힌트 타입을 입력해 주세요.").toUpperCase(Locale.ROOT),
                normalizeRequiredText(request.content(), "힌트 내용을 입력해 주세요."),
                normalizeDisplayOrder(request.displayOrder()),
                request.active() == null || request.active()
        );

        return toHintDto(promptHintRepository.save(hint));
    }

    public void deleteHint(String promptId, String hintId) {
        findPrompt(promptId);
        PromptHintEntity hint = promptHintRepository.findById(hintId)
                .filter(value -> promptId.equals(value.getPromptId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "힌트를 찾을 수 없어요."));

        hint.update(hint.getHintType(), hint.getContent(), hint.getDisplayOrder(), false);
        promptHintRepository.save(hint);
    }

    private PromptEntity findPrompt(String promptId) {
        return promptRepository.findByIdWithCoachProfile(promptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "질문을 찾을 수 없어요."));
    }

    private AdminPromptDto toDto(PromptEntity prompt, List<PromptHintEntity> hints) {
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
                        .map(this::toHintDto)
                        .toList()
        );
    }

    private AdminPromptHintDto toHintDto(PromptHintEntity hint) {
        return new AdminPromptHintDto(
                hint.getId(),
                hint.getPromptId(),
                hint.getHintType(),
                hint.getContent(),
                hint.getDisplayOrder(),
                Boolean.TRUE.equals(hint.getActive())
        );
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
        String normalized = normalizeRequiredText(difficulty, "난이도를 입력해 주세요.").toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "난이도는 A, B, C 중 하나여야 해요.");
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
