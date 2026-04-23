package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.SaveWritingDraftRequestDto;
import com.writeloop.dto.WritingDraftDto;
import com.writeloop.dto.WritingDraftTypeDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.PromptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DraftServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private SetOperations<String, String> setOperations;

    @Mock
    private PromptRepository promptRepository;

    private DraftService draftService;

    @BeforeEach
    void setUp() {
        draftService = new DraftService(
                redisTemplate,
                new ObjectMapper().findAndRegisterModules(),
                promptRepository
        );
        ReflectionTestUtils.setField(draftService, "draftTtlDays", 7L);
        ReflectionTestUtils.setField(draftService, "draftMaxPerUser", 50L);
        ReflectionTestUtils.setField(draftService, "draftMaxPayloadBytes", 65536L);
        ReflectionTestUtils.setField(draftService, "draftMaxTextChars", 4000);

        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(redisTemplate.opsForSet()).thenReturn(setOperations);
    }

    @Test
    void saveDraft_rejects_unknown_prompt_id() {
        when(promptRepository.existsById("unknown-prompt")).thenReturn(false);

        assertThatThrownBy(() -> draftService.saveDraft(1L, "unknown-prompt", validRequest("hello")))
                .isInstanceOf(ApiException.class)
                .satisfies(exception -> {
                    ApiException apiException = (ApiException) exception;
                    assertThat(apiException.getStatus()).isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);
                    assertThat(apiException.getCode()).isEqualTo("PROMPT_NOT_FOUND");
                });

        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void saveDraft_rejects_when_user_draft_quota_is_exceeded() {
        ReflectionTestUtils.setField(draftService, "draftMaxPerUser", 1L);
        String indexKey = "draft:user:7:keys";
        String existingDraftKey = "draft:user:7:prompt:prompt-1:ANSWER";

        when(promptRepository.existsById("prompt-2")).thenReturn(true);
        when(setOperations.members(indexKey)).thenReturn(Set.of(existingDraftKey));
        when(redisTemplate.hasKey(existingDraftKey)).thenReturn(true);

        assertThatThrownBy(() -> draftService.saveDraft(7L, "prompt-2", validRequest("new draft")))
                .isInstanceOf(ApiException.class)
                .satisfies(exception -> {
                    ApiException apiException = (ApiException) exception;
                    assertThat(apiException.getStatus()).isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
                    assertThat(apiException.getCode()).isEqualTo("DRAFT_LIMIT_EXCEEDED");
                });

        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void saveDraft_rejects_oversized_payload() {
        ReflectionTestUtils.setField(draftService, "draftMaxPayloadBytes", 1024L);

        when(promptRepository.existsById("prompt-1")).thenReturn(true);
        when(setOperations.members("draft:user:1:keys")).thenReturn(Set.of());

        assertThatThrownBy(() -> draftService.saveDraft(1L, "prompt-1", validRequest("a".repeat(2000))))
                .isInstanceOf(ApiException.class)
                .satisfies(exception -> {
                    ApiException apiException = (ApiException) exception;
                    assertThat(apiException.getStatus()).isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);
                    assertThat(apiException.getCode()).isEqualTo("DRAFT_PAYLOAD_TOO_LARGE");
                });

        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void saveDraft_tracks_saved_key_when_request_is_valid() {
        when(promptRepository.existsById("prompt-1")).thenReturn(true);
        when(setOperations.members("draft:user:3:keys")).thenReturn(Set.of());

        WritingDraftDto savedDraft = draftService.saveDraft(3L, "prompt-1", validRequest("hello there"));

        assertThat(savedDraft.promptId()).isEqualTo("prompt-1");
        assertThat(savedDraft.answer()).isEqualTo("hello there");
        verify(valueOperations).set(eq("draft:user:3:prompt:prompt-1:ANSWER"), anyString(), eq(Duration.ofDays(7)));
        verify(setOperations).add("draft:user:3:keys", "draft:user:3:prompt:prompt-1:ANSWER");
        verify(redisTemplate).expire("draft:user:3:keys", Duration.ofDays(7));
    }

    private SaveWritingDraftRequestDto validRequest(String answer) {
        return new SaveWritingDraftRequestDto(
                WritingDraftTypeDto.ANSWER,
                "A",
                "session-1",
                answer,
                "",
                "",
                null,
                "write"
        );
    }
}
