package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.NowInEnglishReflectionRequestDto;
import com.writeloop.dto.NowInEnglishReflectionResponseDto;
import com.writeloop.persistence.NowInEnglishEntryEntity;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionEntity;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NowInEnglishReflectionServiceTest {

    private static final Long USER_ID = 7L;
    private static final String DATE_KEY = "2026-10-22";

    @Mock
    private OpenAiNowInEnglishReflectionClient openAiClient;

    @Mock
    private NowInEnglishEntryRepository entryRepository;

    @Mock
    private NowInEnglishReflectionRepository reflectionRepository;

    @Mock
    private FeedbackTimingRecorder feedbackTimingRecorder;

    private NowInEnglishReflectionService service;

    @BeforeEach
    void setUp() {
        service = new NowInEnglishReflectionService(
                new ObjectMapper(),
                openAiClient,
                entryRepository,
                reflectionRepository,
                feedbackTimingRecorder
        );
        lenient().when(openAiClient.isConfigured()).thenReturn(true);
        lenient().when(entryRepository.findByUserIdAndEntryDateOrderByCreatedAtAsc(USER_ID, LocalDate.parse(DATE_KEY)))
                .thenReturn(List.of(new NowInEnglishEntryEntity(
                        "entry-1",
                        USER_ID,
                        "I am taking a short break.",
                        LocalDate.parse(DATE_KEY),
                        Instant.parse("2026-10-22T03:00:00Z")
                )));
        lenient().when(reflectionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void doesNotStoreFallbackReflectionWhenLlmFails() {
        when(reflectionRepository.findByUserIdAndReflectionDate(USER_ID, LocalDate.parse(DATE_KEY)))
                .thenReturn(Optional.empty());
        when(openAiClient.reflect(anyString(), anyList())).thenThrow(new IllegalStateException("timeout"));

        NowInEnglishReflectionResponseDto response = service.reflectAndStore(USER_ID, request());

        // 저장하면 다음 요청이 캐시로 받아 그날 회고가 고정 문구로 남는다.
        assertThat(response.fallback()).isTrue();
        verify(reflectionRepository, never()).save(any());
    }

    @Test
    void regeneratesStoredFallbackReflectionInsteadOfServingItFromCache() {
        when(reflectionRepository.findByUserIdAndReflectionDate(USER_ID, LocalDate.parse(DATE_KEY)))
                .thenReturn(Optional.empty());
        when(openAiClient.reflect(anyString(), anyList())).thenReturn(llmReflection());
        service.reflectAndStore(USER_ID, request());
        ArgumentCaptor<NowInEnglishReflectionEntity> savedCaptor =
                ArgumentCaptor.forClass(NowInEnglishReflectionEntity.class);
        verify(reflectionRepository).save(savedCaptor.capture());
        String entrySignature = savedCaptor.getValue().getEntrySignature();

        // 이 수정 전에 같은 항목으로 저장된 대체 회고
        NowInEnglishReflectionEntity storedFallback =
                new NowInEnglishReflectionEntity(USER_ID, LocalDate.parse(DATE_KEY));
        storedFallback.updateReflection(
                1,
                entrySignature,
                "이 날의 영어 조각",
                "이 날 남긴 짧은 문장들이 하루의 작은 흐름처럼 남아 있어요. 다음에는 그중 한 장면을 조금 더 길게 이어 써보면 좋아요.",
                "[]",
                "",
                "",
                "",
                "",
                "[]",
                ""
        );
        when(reflectionRepository.findByUserIdAndReflectionDate(USER_ID, LocalDate.parse(DATE_KEY)))
                .thenReturn(Optional.of(storedFallback));

        NowInEnglishReflectionResponseDto response = service.reflectAndStore(USER_ID, request());

        assertThat(response.fallback()).isFalse();
        assertThat(response.headlineKo()).isEqualTo("쉬는 순간을 영어로");
        verify(openAiClient, times(2)).reflect(anyString(), anyList());
    }

    @Test
    void servesStoredLlmReflectionFromCache() {
        when(reflectionRepository.findByUserIdAndReflectionDate(USER_ID, LocalDate.parse(DATE_KEY)))
                .thenReturn(Optional.empty());
        when(openAiClient.reflect(anyString(), anyList())).thenReturn(llmReflection());
        service.reflectAndStore(USER_ID, request());
        ArgumentCaptor<NowInEnglishReflectionEntity> savedCaptor =
                ArgumentCaptor.forClass(NowInEnglishReflectionEntity.class);
        verify(reflectionRepository).save(savedCaptor.capture());
        when(reflectionRepository.findByUserIdAndReflectionDate(USER_ID, LocalDate.parse(DATE_KEY)))
                .thenReturn(Optional.of(savedCaptor.getValue()));

        NowInEnglishReflectionResponseDto response = service.reflectAndStore(USER_ID, request());

        assertThat(response.fallback()).isFalse();
        assertThat(response.headlineKo()).isEqualTo("쉬는 순간을 영어로");
        verify(openAiClient, times(1)).reflect(anyString(), anyList());
    }

    private NowInEnglishReflectionRequestDto request() {
        return new NowInEnglishReflectionRequestDto(DATE_KEY, List.of(), false);
    }

    private NowInEnglishReflectionResponseDto llmReflection() {
        return new NowInEnglishReflectionResponseDto(
                DATE_KEY,
                1,
                "쉬는 순간을 영어로",
                "짧은 휴식을 영어로 남겼어요.",
                List.of("현재진행형으로 지금 하는 일을 말했어요."),
                "지금 하는 일을 말하는 패턴",
                "잘 썼어요.",
                "이유를 하나 붙여 보세요.",
                "I am taking a short break because I am tired.",
                List.of(),
                "내일도 한 줄 남겨 보세요.",
                false
        );
    }
}
