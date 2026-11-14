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
import com.writeloop.persistence.LobbyLayoutRepository;
import com.writeloop.persistence.LoopPointBalanceEntity;
import com.writeloop.persistence.LoopPointBalanceRepository;
import com.writeloop.persistence.LoopPointEntryEntity;
import com.writeloop.persistence.LoopPointEntryRepository;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.UserFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * [spec] 작업 086 ① 룹 장부와 적립, 시나리오 G2: 회원 탈퇴 때 룹 기록과 잔액도 지운다(명세 서버 동작 4).
 * 생성자 인자는 Mockito 생성자 주입(@InjectMocks)으로 채운다. 룹 저장소는 서비스가 필드로 받으므로
 * 생성자 주입 뒤 필드에 직접 넣는다(Spring이 넣어 주는 것과 같게).
 */
@ExtendWith(MockitoExtension.class)
class AccountDataPurgeServiceLoopPointSpecTest {

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

    @Mock private LoopPointEntryRepository loopPointEntryRepository;
    @Mock private LoopPointBalanceRepository loopPointBalanceRepository;

    @InjectMocks
    private AccountDataPurgeService accountDataPurgeService;

    @BeforeEach
    void wireLoopPointRepositories() {
        ReflectionTestUtils.setField(accountDataPurgeService, "loopPointEntryRepository", loopPointEntryRepository);
        ReflectionTestUtils.setField(accountDataPurgeService, "loopPointBalanceRepository", loopPointBalanceRepository);
    }

    @Test
    void g2_purgeUserDataDeletesTheUsersLoopPointLedgerAndBalance() {
        accountDataPurgeService.purgeUserData(42L);

        verify(loopPointEntryRepository).deleteAllByUserId(42L);
        verify(loopPointBalanceRepository).deleteAllByUserId(42L);
    }

    @Test
    void g2_loopPointEntitiesAreInThePurgedEntityList() {
        assertThat(AccountDataPurgeService.PURGED_USER_ENTITIES)
                .contains(LoopPointEntryEntity.class, LoopPointBalanceEntity.class);
    }
}
