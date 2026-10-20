package com.writeloop.service;

import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.CoachInteractionEntity;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.DiaryAttemptRepository;
import com.writeloop.persistence.DiaryEntryEntity;
import com.writeloop.persistence.DiaryEntryRepository;
import com.writeloop.persistence.EmailVerificationTokenEntity;
import com.writeloop.persistence.EmailVerificationTokenRepository;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.FeedbackTimingLogEntity;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import com.writeloop.persistence.NowInEnglishEntryEntity;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionEntity;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import com.writeloop.persistence.PasswordResetTokenEntity;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.PromptRecommendationExposureEntity;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRecommendationTimingLogEntity;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import com.writeloop.persistence.RememberLoginTokenEntity;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.SavedExpressionEntity;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.UserFeedbackEntity;
import com.writeloop.persistence.UserFeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * 회원 탈퇴 시 사용자에게 연결된 데이터를 모두 삭제한다.
 * userId 컬럼을 가진 엔티티를 새로 추가하면 PURGED_USER_ENTITIES와 purgeUserData()에 함께 추가해야 한다.
 * AccountDataPurgeServiceTest가 누락을 검사한다.
 */
@Service
@RequiredArgsConstructor
public class AccountDataPurgeService {

    static final Set<Class<?>> PURGED_USER_ENTITIES = Set.of(
            AnswerSessionEntity.class,
            CoachInteractionEntity.class,
            DiaryEntryEntity.class,
            EmailVerificationTokenEntity.class,
            FeedbackDiagnosisLogEntity.class,
            FeedbackTimingLogEntity.class,
            NowInEnglishEntryEntity.class,
            NowInEnglishReflectionEntity.class,
            PasswordResetTokenEntity.class,
            PromptRecommendationExposureEntity.class,
            PromptRecommendationTimingLogEntity.class,
            RememberLoginTokenEntity.class,
            SavedExpressionEntity.class,
            UserFeedbackEntity.class
    );

    private final AnswerAttemptRepository answerAttemptRepository;
    private final AnswerSessionRepository answerSessionRepository;
    private final CoachInteractionRepository coachInteractionRepository;
    private final DiaryAttemptRepository diaryAttemptRepository;
    private final DiaryEntryRepository diaryEntryRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final FeedbackDiagnosisLogRepository feedbackDiagnosisLogRepository;
    private final FeedbackTimingLogRepository feedbackTimingLogRepository;
    private final NowInEnglishEntryRepository nowInEnglishEntryRepository;
    private final NowInEnglishReflectionRepository nowInEnglishReflectionRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PromptRecommendationExposureRepository promptRecommendationExposureRepository;
    private final PromptRecommendationTimingLogRepository promptRecommendationTimingLogRepository;
    private final RememberLoginTokenRepository rememberLoginTokenRepository;
    private final SavedExpressionRepository savedExpressionRepository;
    private final UserFeedbackRepository userFeedbackRepository;
    private final RefreshTokenService refreshTokenService;
    private final DraftService draftService;

    @Transactional
    public void purgeUserData(Long userId) {
        // 하위 기록을 먼저 지운다. DB에 ON DELETE CASCADE가 없어도 고아 행이 남지 않게 한다.
        answerAttemptRepository.purgeByUserId(userId);
        answerSessionRepository.purgeByUserId(userId);
        diaryAttemptRepository.purgeByUserId(userId);
        diaryEntryRepository.purgeByUserId(userId);
        nowInEnglishEntryRepository.purgeByUserId(userId);
        nowInEnglishReflectionRepository.purgeByUserId(userId);

        coachInteractionRepository.deleteAllByUserId(userId);
        savedExpressionRepository.deleteAllByUserId(userId);
        userFeedbackRepository.purgeByUserId(userId);

        feedbackDiagnosisLogRepository.purgeByUserId(userId);
        feedbackTimingLogRepository.purgeByUserId(userId);
        promptRecommendationExposureRepository.purgeByUserId(userId);
        promptRecommendationTimingLogRepository.purgeByUserId(userId);

        emailVerificationTokenRepository.deleteAllByUserId(userId);
        passwordResetTokenRepository.deleteAllByUserId(userId);
        rememberLoginTokenRepository.deleteAllByUserId(userId);
        refreshTokenService.revokeAllForUser(userId);
        draftService.deleteAllDrafts(userId);
    }
}
