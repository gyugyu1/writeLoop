package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.TodayWritingStatusDto;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnswerHistoryServiceTest {

    private static final Long USER_ID = 7L;
    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private PromptRepository promptRepository;

    private AnswerHistoryService service;

    @BeforeEach
    void setUp() {
        service = new AnswerHistoryService(answerSessionRepository, answerAttemptRepository, promptRepository, new ObjectMapper());
    }

    @Test
    void readsAtMostOnePageOfSessions() {
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(eq(USER_ID), any(Limit.class))).thenReturn(List.of());

        service.getHistory(USER_ID, 500, null);

        ArgumentCaptor<Limit> limit = ArgumentCaptor.forClass(Limit.class);
        verify(answerSessionRepository).findByUserIdOrderByCreatedAtDesc(eq(USER_ID), limit.capture());
        assertThat(limit.getValue().max()).isEqualTo(AnswerHistoryService.MAX_HISTORY_PAGE_SIZE);
    }

    @Test
    void oldClientsWithoutLimitStillGetTheLatestPage() {
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(eq(USER_ID), any(Limit.class))).thenReturn(List.of());

        service.getHistory(USER_ID);

        ArgumentCaptor<Limit> limit = ArgumentCaptor.forClass(Limit.class);
        verify(answerSessionRepository).findByUserIdOrderByCreatedAtDesc(eq(USER_ID), limit.capture());
        assertThat(limit.getValue().max()).isEqualTo(AnswerHistoryService.MAX_HISTORY_PAGE_SIZE);
    }

    @Test
    void readsTheNextPageBeforeTheGivenTime() {
        Instant before = Instant.parse("2026-10-20T00:00:00Z");
        when(answerSessionRepository.findByUserIdAndCreatedAtLessThanOrderByCreatedAtDesc(eq(USER_ID), eq(before), any(Limit.class)))
                .thenReturn(List.of());

        service.getHistory(USER_ID, 30, before);

        ArgumentCaptor<Limit> limit = ArgumentCaptor.forClass(Limit.class);
        verify(answerSessionRepository)
                .findByUserIdAndCreatedAtLessThanOrderByCreatedAtDesc(eq(USER_ID), eq(before), limit.capture());
        assertThat(limit.getValue().max()).isEqualTo(30);
    }

    @Test
    void countsConsecutiveCompletedDaysUpToToday() {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        when(answerSessionRepository.findUpdatedAtByUserIdAndStatusSince(eq(USER_ID), eq(SessionStatus.COMPLETED), any()))
                .thenReturn(List.of(noonOf(today), noonOf(today.minusDays(1)), noonOf(today.minusDays(2)), noonOf(today.minusDays(4))));

        TodayWritingStatusDto status = service.getTodayStatus(USER_ID);

        assertThat(status.streakDays()).isEqualTo(3);
    }

    @Test
    void widensTheLookbackWhenTheStreakReachesItsEdge() {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        int streakDays = 450;
        // 저장소는 since 이후의 완료 시각만 돌려준다. 첫 조회(400일)로는 연속 기록이 끝나지 않는다.
        when(answerSessionRepository.findUpdatedAtByUserIdAndStatusSince(eq(USER_ID), eq(SessionStatus.COMPLETED), any()))
                .thenAnswer(invocation -> {
                    Instant since = invocation.getArgument(2);
                    List<Instant> completed = new ArrayList<>();
                    for (int day = 0; day < streakDays; day++) {
                        Instant completedAt = noonOf(today.minusDays(day));
                        if (!completedAt.isBefore(since)) {
                            completed.add(completedAt);
                        }
                    }
                    return completed;
                });

        TodayWritingStatusDto status = service.getTodayStatus(USER_ID);

        assertThat(status.streakDays()).isEqualTo(streakDays);
    }

    private static Instant noonOf(LocalDate date) {
        return date.atTime(12, 0).atZone(KOREA_ZONE).toInstant();
    }
}
