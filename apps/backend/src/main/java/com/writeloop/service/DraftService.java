package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.SaveWritingDraftRequestDto;
import com.writeloop.dto.WritingDraftDto;
import com.writeloop.dto.WritingDraftTypeDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DraftService {

    private static final int MAX_PROMPT_ID_CHARS = 120;
    private static final int MAX_SELECTED_DIFFICULTY_CHARS = 16;
    private static final int MAX_SESSION_ID_CHARS = 128;
    private static final int MAX_STEP_CHARS = 64;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final PromptRepository promptRepository;

    @Value("${app.drafts.ttl-days:7}")
    private long draftTtlDays;

    @Value("${app.drafts.max-per-user:50}")
    private long draftMaxPerUser;

    @Value("${app.drafts.max-payload-bytes:65536}")
    private long draftMaxPayloadBytes;

    @Value("${app.drafts.max-text-chars:4000}")
    private int draftMaxTextChars;

    public WritingDraftDto saveDraft(Long userId, String promptId, SaveWritingDraftRequestDto request) {
        SaveWritingDraftRequestDto normalizedRequest = requireRequest(request);
        String normalizedPromptId = normalizePromptId(promptId);
        WritingDraftTypeDto draftType = requireDraftType(normalizedRequest.draftType());
        WritingDraftDto draft = new WritingDraftDto(
                normalizedPromptId,
                draftType,
                normalizeShortText(
                        normalizedRequest.selectedDifficulty(),
                        MAX_SELECTED_DIFFICULTY_CHARS,
                        "SELECTED_DIFFICULTY_TOO_LONG",
                        "난이도 정보가 너무 길어요."
                ),
                normalizeShortText(
                        normalizedRequest.sessionId(),
                        MAX_SESSION_ID_CHARS,
                        "DRAFT_SESSION_ID_TOO_LONG",
                        "초안 세션 정보가 너무 길어요."
                ),
                normalizeDraftText(
                        normalizedRequest.answer(),
                        "DRAFT_ANSWER_TOO_LONG",
                        "답변 초안은 4,000자 이하로 저장해 주세요."
                ),
                normalizeDraftText(
                        normalizedRequest.rewrite(),
                        "DRAFT_REWRITE_TOO_LONG",
                        "다시쓰기 초안은 4,000자 이하로 저장해 주세요."
                ),
                normalizeDraftText(
                        normalizedRequest.lastSubmittedAnswer(),
                        "DRAFT_LAST_SUBMITTED_ANSWER_TOO_LONG",
                        "마지막 제출 답변은 4,000자 이하로 저장해 주세요."
                ),
                normalizedRequest.feedback(),
                normalizeShortText(
                        normalizedRequest.step(),
                        MAX_STEP_CHARS,
                        "DRAFT_STEP_TOO_LONG",
                        "초안 단계 정보가 너무 길어요."
                ),
                Instant.now()
        );
        Duration ttl = Duration.ofDays(Math.max(1, draftTtlDays));
        String draftKey = buildKey(userId, normalizedPromptId, draftType);

        try {
            enforceDraftQuota(userId, draftKey);
            String serializedDraft = objectMapper.writeValueAsString(draft);
            validatePayloadSize(serializedDraft);
            redisTemplate.opsForValue().set(draftKey, serializedDraft, ttl);
            trackDraftKey(userId, draftKey, ttl);
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
        String normalizedPromptId = normalizePromptId(promptId);
        WritingDraftTypeDto requiredDraftType = requireDraftType(draftType);
        String draftKey = buildKey(userId, normalizedPromptId, requiredDraftType);
        String stored = redisTemplate.opsForValue().get(draftKey);
        if (stored == null || stored.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(stored, WritingDraftDto.class);
        } catch (JsonProcessingException exception) {
            redisTemplate.delete(draftKey);
            untrackDraftKey(userId, draftKey);
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "DRAFT_DESERIALIZATION_FAILED",
                    "초안을 불러오지 못했어요."
            );
        }
    }

    public void deleteDraft(Long userId, String promptId, WritingDraftTypeDto draftType) {
        String draftKey = buildKey(userId, normalizePromptId(promptId), requireDraftType(draftType));
        redisTemplate.delete(draftKey);
        untrackDraftKey(userId, draftKey);
    }

    private String buildKey(Long userId, String promptId, WritingDraftTypeDto draftType) {
        return "draft:user:%d:prompt:%s:%s".formatted(userId, promptId, draftType.name());
    }

    private String buildIndexKey(Long userId) {
        return "draft:user:%d:keys".formatted(userId);
    }

    private WritingDraftTypeDto requireDraftType(WritingDraftTypeDto draftType) {
        if (draftType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DRAFT_TYPE_REQUIRED", "초안 종류를 알려주세요.");
        }
        return draftType;
    }

    private SaveWritingDraftRequestDto requireRequest(SaveWritingDraftRequestDto request) {
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DRAFT_REQUEST_REQUIRED", "초안 저장 내용을 보내 주세요.");
        }
        return request;
    }

    private String normalizePromptId(String promptId) {
        if (promptId == null || promptId.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMPT_ID_REQUIRED", "질문 정보를 찾지 못했어요.");
        }
        String normalizedPromptId = promptId.trim();
        if (normalizedPromptId.length() > MAX_PROMPT_ID_CHARS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMPT_ID_INVALID", "질문 정보가 올바르지 않아요.");
        }
        if (!promptRepository.existsById(normalizedPromptId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMPT_NOT_FOUND", "저장할 질문을 찾지 못했어요.");
        }
        return normalizedPromptId;
    }

    private String normalizeDraftText(String value, String code, String message) {
        String normalizedValue = normalizeText(value);
        if (normalizedValue.length() > draftMaxTextChars) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code, message);
        }
        return normalizedValue;
    }

    private String normalizeShortText(String value, int maxChars, String code, String message) {
        String normalizedValue = normalizeText(value);
        if (normalizedValue.length() > maxChars) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code, message);
        }
        return normalizedValue;
    }

    private void validatePayloadSize(String serializedDraft) {
        long maxPayloadBytes = Math.max(1024L, draftMaxPayloadBytes);
        int payloadBytes = serializedDraft.getBytes(StandardCharsets.UTF_8).length;
        if (payloadBytes > maxPayloadBytes) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "DRAFT_PAYLOAD_TOO_LARGE",
                    "초안 저장 용량이 너무 커요. 내용을 조금 줄여서 다시 저장해 주세요."
            );
        }
    }

    private void enforceDraftQuota(Long userId, String draftKey) {
        int maxDraftCount = Math.max(1, Math.toIntExact(Math.min(Integer.MAX_VALUE, draftMaxPerUser)));
        Set<String> liveDraftKeys = loadLiveDraftKeys(userId);
        if (!liveDraftKeys.contains(draftKey) && liveDraftKeys.size() >= maxDraftCount) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "DRAFT_LIMIT_EXCEEDED",
                    "임시저장은 최대 %d개까지 보관할 수 있어요. 오래된 초안을 정리해 주세요.".formatted(maxDraftCount)
            );
        }
    }

    private Set<String> loadLiveDraftKeys(Long userId) {
        String indexKey = buildIndexKey(userId);
        Set<String> trackedDraftKeys = redisTemplate.opsForSet().members(indexKey);
        if (trackedDraftKeys == null || trackedDraftKeys.isEmpty()) {
            return Set.of();
        }

        Set<String> liveDraftKeys = new LinkedHashSet<>();
        Set<String> staleDraftKeys = new LinkedHashSet<>();
        for (String trackedDraftKey : trackedDraftKeys) {
            if (trackedDraftKey == null || trackedDraftKey.isBlank()) {
                staleDraftKeys.add(trackedDraftKey);
                continue;
            }
            if (Boolean.TRUE.equals(redisTemplate.hasKey(trackedDraftKey))) {
                liveDraftKeys.add(trackedDraftKey);
            } else {
                staleDraftKeys.add(trackedDraftKey);
            }
        }

        if (!staleDraftKeys.isEmpty()) {
            redisTemplate.opsForSet().remove(indexKey, staleDraftKeys.toArray());
        }

        if (liveDraftKeys.isEmpty()) {
            redisTemplate.delete(indexKey);
        }

        return liveDraftKeys;
    }

    private void trackDraftKey(Long userId, String draftKey, Duration ttl) {
        String indexKey = buildIndexKey(userId);
        redisTemplate.opsForSet().add(indexKey, draftKey);
        redisTemplate.expire(indexKey, ttl);
    }

    private void untrackDraftKey(Long userId, String draftKey) {
        redisTemplate.opsForSet().remove(buildIndexKey(userId), draftKey);
    }

    private String normalizeText(String value) {
        return value == null ? "" : value;
    }
}
