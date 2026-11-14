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
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.UserFeedbackRepository;
import com.writeloop.persistence.WardrobeItemEntity;
import com.writeloop.persistence.WardrobeItemRepository;
import com.writeloop.persistence.WardrobeOutfitEntity;
import com.writeloop.persistence.WardrobeOutfitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * [spec] 작업 089 ② 시나리오 W2와 결정 04 G4: 회원 탈퇴의 데이터 삭제(AccountDataPurgeService)가
 * 가진 착용 아이템과 입은 것을 직접 지운다(외래 키에만 맡기지 않는다).
 * 생성자 인자는 @InjectMocks로 채우고, 착용 저장소는 서비스가 필드로 받으므로 생성자 주입 뒤 필드에 직접 넣는다.
 */
@ExtendWith(MockitoExtension.class)
class AccountDataPurgeServiceWardrobeSpecTest {

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

    @Mock private WardrobeItemRepository wardrobeItemRepository;
    @Mock private WardrobeOutfitRepository wardrobeOutfitRepository;

    @InjectMocks
    private AccountDataPurgeService accountDataPurgeService;

    @BeforeEach
    void wireWardrobeRepositories() {
        ReflectionTestUtils.setField(accountDataPurgeService, "wardrobeItemRepository", wardrobeItemRepository);
        ReflectionTestUtils.setField(accountDataPurgeService, "wardrobeOutfitRepository", wardrobeOutfitRepository);
    }

    @Test
    void w2_purgeUserDataDeletesTheUsersOwnedAndEquippedWardrobe() {
        accountDataPurgeService.purgeUserData(42L);

        verify(wardrobeItemRepository).deleteAllByUserId(42L);
        verify(wardrobeOutfitRepository).deleteAllByUserId(42L);
    }

    @Test
    void w2_wardrobeEntitiesAreInThePurgedEntityList() {
        assertThat(AccountDataPurgeService.PURGED_USER_ENTITIES)
                .contains(WardrobeItemEntity.class, WardrobeOutfitEntity.class);
    }
}
