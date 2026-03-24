package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.SaveWritingDraftRequestDto;
import com.writeloop.dto.WritingDraftDto;
import com.writeloop.dto.WritingDraftTypeDto;
import com.writeloop.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class DraftService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.drafts.ttl-days:7}")
    private long draftTtlDays;

    public WritingDraftDto saveDraft(Long userId, String promptId, SaveWritingDraftRequestDto request) {
        String normalizedPromptId = normalizePromptId(promptId);
        WritingDraftTypeDto draftType = requireDraftType(request.draftType());
        WritingDraftDto draft = new WritingDraftDto(
                normalizedPromptId,
                draftType,
                normalizeText(request.selectedDifficulty()),
                normalizeText(request.sessionId()),
                normalizeText(request.answer()),
                normalizeText(request.rewrite()),
                normalizeText(request.lastSubmittedAnswer()),
                request.feedback(),
                normalizeText(request.step()),
                Instant.now()
        );

        try {
            redisTemplate.opsForValue().set(
                    buildKey(userId, normalizedPromptId, draftType),
                    objectMapper.writeValueAsString(draft),
                    Duration.ofDays(Math.max(1, draftTtlDays))
            );
            return draft;
        } catch (JsonProcessingException exception) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "DRAFT_SERIALIZATION_FAILED",
                    "초안을 저장하지 못했어요."
            );
        }
    }

    public WritingDraftDto getDraft(Long userId, String promptId, WritingDraftTypeDto draftType) {
        String stored = redisTemplate.opsForValue().get(buildKey(userId, normalizePromptId(promptId), requireDraftType(draftType)));
        if (stored == null || stored.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(stored, WritingDraftDto.class);
        } catch (JsonProcessingException exception) {
            redisTemplate.delete(buildKey(userId, normalizePromptId(promptId), draftType));
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "DRAFT_DESERIALIZATION_FAILED",
                    "초안을 불러오지 못했어요."
            );
        }
    }

    public void deleteDraft(Long userId, String promptId, WritingDraftTypeDto draftType) {
        redisTemplate.delete(buildKey(userId, normalizePromptId(promptId), requireDraftType(draftType)));
    }

    private String buildKey(Long userId, String promptId, WritingDraftTypeDto draftType) {
        return "draft:user:%d:prompt:%s:%s".formatted(userId, promptId, draftType.name());
    }

    private WritingDraftTypeDto requireDraftType(WritingDraftTypeDto draftType) {
        if (draftType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DRAFT_TYPE_REQUIRED", "초안 종류를 알려주세요.");
        }
        return draftType;
    }

    private String normalizePromptId(String promptId) {
        if (promptId == null || promptId.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMPT_ID_REQUIRED", "질문 정보를 찾지 못했어요.");
        }
        return promptId.trim();
    }

    private String normalizeText(String value) {
        return value == null ? "" : value;
    }
}
