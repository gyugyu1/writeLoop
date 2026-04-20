package com.writeloop.service;

import com.writeloop.dto.SaveExpressionRequestDto;
import com.writeloop.dto.SavedExpressionDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.CoachInteractionEntity;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.persistence.SavedExpressionEntity;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.SavedExpressionSourceType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SavedExpressionService {

    private final SavedExpressionRepository savedExpressionRepository;
    private final PromptRepository promptRepository;
    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final CoachInteractionRepository coachInteractionRepository;

    @Transactional(readOnly = true)
    public List<SavedExpressionDto> getSavedExpressions(Long userId) {
        List<SavedExpressionEntity> expressions = savedExpressionRepository.findByUserIdOrderByLastSavedAtDesc(userId);
        Map<String, PromptEntity> promptsById = loadPrompts(expressions);
        return expressions.stream()
                .map(expression -> SavedExpressionDto.from(expression, promptsById.get(expression.getPromptId())))
                .toList();
    }

    @Transactional
    public SavedExpressionDto saveExpression(Long userId, SaveExpressionRequestDto request) {
        SaveContext context = normalizeAndValidate(userId, request);
        SavedExpressionEntity entity = savedExpressionRepository
                .findByUserIdAndNormalizedExpression(userId, context.normalizedExpression())
                .map(existing -> {
                    existing.refreshSave(
                            context.expression(),
                            context.meaningKo(),
                            context.usageTipKo(),
                            context.exampleEn(),
                            context.sourceType(),
                            context.promptId(),
                            context.answerSessionId(),
                            context.answerAttemptNo(),
                            context.coachInteractionRequestId()
                    );
                    return existing;
                })
                .orElseGet(() -> new SavedExpressionEntity(
                        userId,
                        context.expression(),
                        context.normalizedExpression(),
                        context.meaningKo(),
                        context.usageTipKo(),
                        context.exampleEn(),
                        context.sourceType(),
                        context.promptId(),
                        context.answerSessionId(),
                        context.answerAttemptNo(),
                        context.coachInteractionRequestId()
                ));

        SavedExpressionEntity saved = savedExpressionRepository.save(entity);
        PromptEntity prompt = isBlank(saved.getPromptId()) ? null : promptRepository.findById(saved.getPromptId()).orElse(null);
        return SavedExpressionDto.from(saved, prompt);
    }

    @Transactional
    public void deleteExpression(Long userId, Long savedExpressionId) {
        SavedExpressionEntity entity = savedExpressionRepository.findByIdAndUserId(savedExpressionId, userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "SAVED_EXPRESSION_NOT_FOUND",
                        "저장한 표현을 찾을 수 없어요."
                ));
        savedExpressionRepository.delete(entity);
    }

    private Map<String, PromptEntity> loadPrompts(List<SavedExpressionEntity> expressions) {
        List<String> promptIds = expressions.stream()
                .map(SavedExpressionEntity::getPromptId)
                .filter(promptId -> promptId != null && !promptId.isBlank())
                .distinct()
                .toList();
        if (promptIds.isEmpty()) {
            return Map.of();
        }

        Map<String, PromptEntity> promptsById = new LinkedHashMap<>();
        for (PromptEntity prompt : promptRepository.findAllById(promptIds)) {
            promptsById.put(prompt.getId(), prompt);
        }
        return promptsById;
    }

    private SaveContext normalizeAndValidate(Long userId, SaveExpressionRequestDto request) {
        if (request == null) {
            throw invalidRequest("표현 저장 요청이 비어 있어요.");
        }

        String expression = normalizeText(request.expression());
        if (expression.isBlank()) {
            throw invalidRequest("저장할 표현을 입력해 주세요.");
        }

        SavedExpressionSourceType sourceType = request.sourceType();
        if (sourceType == null) {
            throw invalidRequest("표현 출처를 확인할 수 없어요.");
        }

        String promptId = normalizeText(request.promptId());
        String answerSessionId = normalizeText(request.answerSessionId());
        Integer answerAttemptNo = normalizeAttemptNo(request.answerAttemptNo());
        String coachInteractionRequestId = normalizeText(request.coachInteractionId());

        if (!isBlank(answerSessionId) && answerAttemptNo != null) {
            AnswerSessionEntity session = verifyOwnedAnswerContext(userId, answerSessionId, answerAttemptNo);
            if (isBlank(promptId)) {
                promptId = session.getPromptId();
            }
        }

        if (!isBlank(coachInteractionRequestId)) {
            CoachInteractionEntity interaction = verifyOwnedCoachInteraction(userId, coachInteractionRequestId);
            if (isBlank(promptId)) {
                promptId = interaction.getPromptId();
            }
        }

        if (!isBlank(promptId) && promptRepository.findById(promptId).isEmpty()) {
            throw invalidRequest("표현과 연결된 질문을 찾을 수 없어요.");
        }

        return new SaveContext(
                expression,
                normalizeExpression(expression),
                emptyToNull(normalizeText(request.meaningKo())),
                emptyToNull(normalizeText(request.usageTipKo())),
                emptyToNull(normalizeText(request.exampleEn())),
                sourceType,
                emptyToNull(promptId),
                emptyToNull(answerSessionId),
                answerAttemptNo,
                emptyToNull(coachInteractionRequestId)
        );
    }

    private AnswerSessionEntity verifyOwnedAnswerContext(Long userId, String answerSessionId, Integer answerAttemptNo) {
        AnswerAttemptEntity attempt = answerAttemptRepository.findBySessionIdAndAttemptNo(answerSessionId, answerAttemptNo)
                .orElseThrow(() -> invalidRequest("연결된 답변 기록을 찾을 수 없어요."));
        AnswerSessionEntity session = answerSessionRepository.findById(attempt.getSessionId())
                .orElseThrow(() -> invalidRequest("연결된 답변 세션을 찾을 수 없어요."));
        if (!userId.equals(session.getUserId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SAVED_EXPRESSION_CONTEXT_FORBIDDEN", "다른 사용자의 답변 기록에는 연결할 수 없어요.");
        }
        return session;
    }

    private CoachInteractionEntity verifyOwnedCoachInteraction(Long userId, String coachInteractionRequestId) {
        CoachInteractionEntity interaction = coachInteractionRepository.findByRequestId(coachInteractionRequestId)
                .orElseThrow(() -> invalidRequest("연결된 AI 코치 기록을 찾을 수 없어요."));
        if (interaction.getUserId() == null || !userId.equals(interaction.getUserId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SAVED_EXPRESSION_CONTEXT_FORBIDDEN", "다른 사용자의 AI 코치 기록에는 연결할 수 없어요.");
        }
        return interaction;
    }

    private Integer normalizeAttemptNo(Integer attemptNo) {
        if (attemptNo == null || attemptNo < 1) {
            return null;
        }
        return attemptNo;
    }

    private String normalizeExpression(String expression) {
        return expression.trim()
                .replaceAll("\\s+", " ")
                .toLowerCase();
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private String emptyToNull(String value) {
        return isBlank(value) ? null : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private ApiException invalidRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SAVED_EXPRESSION_REQUEST", message);
    }

    private record SaveContext(
            String expression,
            String normalizedExpression,
            String meaningKo,
            String usageTipKo,
            String exampleEn,
            SavedExpressionSourceType sourceType,
            String promptId,
            String answerSessionId,
            Integer answerAttemptNo,
            String coachInteractionRequestId
    ) {
    }
}
