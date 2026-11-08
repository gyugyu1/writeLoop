package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.DiaryAttemptRepository;
import com.writeloop.persistence.DiaryEntryRepository;
import com.writeloop.persistence.EmailVerificationTokenRepository;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import com.writeloop.persistence.LobbyLayoutEntity;
import com.writeloop.persistence.LobbyLayoutRepository;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.UserFeedbackRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * [spec] 작업 064 ② 계정 저장, 시나리오 S18: 회원 탈퇴 때 가구 배치도 다른 기록처럼 지운다(명세 1).
 * 생성자 인자 순서에 묶이지 않게 Mockito 생성자 주입(@InjectMocks)으로 만든다.
 */
@ExtendWith(MockitoExtension.class)
class AccountDataPurgeServiceLobbyLayoutSpecTest {

    @Mock private AnswerAttemptRepository answerAttemptRepository;
    @Mock private AnswerSessionRepository answerSessionRepository;
    @Mock private CoachInteractionRepository coachInteractionRepository;
    @Mock private DiaryAttemptRepository diaryAttemptRepository;
    @Mock private DiaryEntryRepository diaryEntryRepository;
    @Mock private EmailVerificationTokenRepository emailVerificationTokenRepository;
    @Mock private FeedbackDiagnosisLogRepository feedbackDiagnosisLogRepository;
    @Mock private FeedbackTimingLogRepository feedbackTimingLogRepository;
    @Mock private LobbyLayoutRepository lobbyLayoutRepository;
    @Mock private NowInEnglishEntryRepository nowInEnglishEntryRepository;
    @Mock private NowInEnglishReflectionRepository nowInEnglishReflectionRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private PromptRecommendationExposureRepository promptRecommendationExposureRepository;
    @Mock private PromptRecommendationTimingLogRepository promptRecommendationTimingLogRepository;
    @Mock private RememberLoginTokenRepository rememberLoginTokenRepository;
    @Mock private SavedExpressionRepository savedExpressionRepository;
    @Mock private UserFeedbackRepository userFeedbackRepository;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private DraftService draftService;

    @InjectMocks
    private AccountDataPurgeService accountDataPurgeService;

    @Test
    void s18_purgeUserDataDeletesTheUsersLobbyLayout() {
        accountDataPurgeService.purgeUserData(7L);

        verify(lobbyLayoutRepository).deleteAllByUserId(7L);
    }

    @Test
    void s18_lobbyLayoutEntityIsInThePurgedEntityList() {
        assertThat(AccountDataPurgeService.PURGED_USER_ENTITIES).contains(LobbyLayoutEntity.class);
    }
}
