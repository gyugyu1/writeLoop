package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.DiaryAnswerBand;
import com.writeloop.dto.DiaryFeedbackRequestDto;
import com.writeloop.dto.DiaryFeedbackResponseDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.DiaryAttemptRepository;
import com.writeloop.persistence.DiaryEntryEntity;
import com.writeloop.persistence.DiaryEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DiaryServiceFeedbackTest {

    private static final Long USER_ID = 7L;
    private static final String ENTRY_ID = "entry-1";

    @Mock
    private DiaryEntryRepository diaryEntryRepository;

    @Mock
    private DiaryAttemptRepository diaryAttemptRepository;

    @Mock
    private LlmDiaryFeedbackClient diaryFeedbackClient;

    private DiaryService service;
    private DiaryEntryEntity entry;

    @BeforeEach
    void setUp() {
        service = new DiaryService(diaryEntryRepository, diaryAttemptRepository, diaryFeedbackClient, new ObjectMapper());
        ReflectionTestUtils.setField(service, "maxDiaryContentChars", 4000);
        entry = new DiaryEntryEntity(
                ENTRY_ID,
                USER_ID,
                "A rainy day",
                "I walked to the park.",
                "en",
                LocalDate.of(2026, 10, 22),
                "calm",
                "[]",
                true
        );
        when(diaryEntryRepository.findByIdAndUserId(ENTRY_ID, USER_ID)).thenReturn(Optional.of(entry));
        lenient().when(diaryAttemptRepository.countByEntryId(ENTRY_ID)).thenReturn(0);
        lenient().when(diaryAttemptRepository.findByEntryIdAndAttemptNo(any(), any())).thenReturn(Optional.empty());
        lenient().when(diaryAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void returnsUnavailableInsteadOfAFixedFeedbackWhenLlmFails() {
        when(diaryFeedbackClient.isConfigured()).thenReturn(true);
        when(diaryFeedbackClient.review(any())).thenThrow(new IllegalStateException("timeout"));

        assertThatThrownBy(() -> service.generateFeedback(
                USER_ID,
                ENTRY_ID,
                new DiaryFeedbackRequestDto("I walked to the park. It was raining.", "INITIAL")
        )).isInstanceOfSatisfying(ApiException.class, exception -> {
            assertThat(exception.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
            assertThat(exception.getCode()).isEqualTo("DIARY_FEEDBACK_UNAVAILABLE");
        });

        // 쓴 일기는 저장하고, 시도는 저장하지 않으며, 제출 상태로 잠그지 않는다.
        assertThat(entry.getContent()).isEqualTo("I walked to the park. It was raining.");
        assertThat(entry.isDraft()).isTrue();
        verify(diaryAttemptRepository, never()).save(any());
    }

    @Test
    void decidesFinishableFromTheBandAndPassesTheFullDiaryRequest() {
        when(diaryFeedbackClient.isConfigured()).thenReturn(true);
        when(diaryFeedbackClient.review(any())).thenReturn(llmFeedback(DiaryAnswerBand.DIARY_CLEAR_BASIC));

        DiaryFeedbackResponseDto response = service.generateFeedback(
                USER_ID,
                ENTRY_ID,
                new DiaryFeedbackRequestDto("I walked to the park. It was raining.", "INITIAL", true)
        );

        assertThat(response.finishable()).isTrue();
        assertThat(entry.isDraft()).isFalse();
        ArgumentCaptor<DiaryFeedbackPromptContext> contextCaptor =
                ArgumentCaptor.forClass(DiaryFeedbackPromptContext.class);
        verify(diaryFeedbackClient).review(contextCaptor.capture());
        assertThat(contextCaptor.getValue().includeFullDiaries()).isTrue();
    }

    @Test
    void mobileRequestsDoNotAskForFullDiaries() {
        when(diaryFeedbackClient.isConfigured()).thenReturn(true);
        when(diaryFeedbackClient.review(any())).thenReturn(llmFeedback(DiaryAnswerBand.DIARY_FLOW_THIN));

        DiaryFeedbackResponseDto response = service.generateFeedback(
                USER_ID,
                ENTRY_ID,
                new DiaryFeedbackRequestDto("I walked to the park.", "INITIAL")
        );

        assertThat(response.finishable()).isFalse();
        ArgumentCaptor<DiaryFeedbackPromptContext> contextCaptor =
                ArgumentCaptor.forClass(DiaryFeedbackPromptContext.class);
        verify(diaryFeedbackClient).review(contextCaptor.capture());
        assertThat(contextCaptor.getValue().includeFullDiaries()).isFalse();
    }

    // LLM은 finishable·schemaVersion·entryId·attemptNo를 만들지 않는다(기본값으로 들어온다).
    private DiaryFeedbackResponseDto llmFeedback(DiaryAnswerBand band) {
        return new DiaryFeedbackResponseDto(
                null,
                null,
                0,
                80,
                false,
                band,
                "흐름이 잘 보여요.",
                List.of("시간 순서가 분명해요."),
                null,
                null,
                null,
                List.of(),
                null,
                List.of(),
                List.of(),
                List.of(),
                null,
                null
        );
    }
}
