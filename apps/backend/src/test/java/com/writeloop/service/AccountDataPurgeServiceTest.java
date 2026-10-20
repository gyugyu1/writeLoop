package com.writeloop.service;

import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.DiaryAttemptRepository;
import com.writeloop.persistence.DiaryEntryRepository;
import com.writeloop.persistence.EmailVerificationTokenRepository;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import com.writeloop.persistence.PasswordResetTokenRepository;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.UserFeedbackRepository;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AccountDataPurgeServiceTest {

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private CoachInteractionRepository coachInteractionRepository;

    @Mock
    private DiaryAttemptRepository diaryAttemptRepository;

    @Mock
    private DiaryEntryRepository diaryEntryRepository;

    @Mock
    private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Mock
    private FeedbackDiagnosisLogRepository feedbackDiagnosisLogRepository;

    @Mock
    private FeedbackTimingLogRepository feedbackTimingLogRepository;

    @Mock
    private NowInEnglishEntryRepository nowInEnglishEntryRepository;

    @Mock
    private NowInEnglishReflectionRepository nowInEnglishReflectionRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private PromptRecommendationExposureRepository promptRecommendationExposureRepository;

    @Mock
    private PromptRecommendationTimingLogRepository promptRecommendationTimingLogRepository;

    @Mock
    private RememberLoginTokenRepository rememberLoginTokenRepository;

    @Mock
    private SavedExpressionRepository savedExpressionRepository;

    @Mock
    private UserFeedbackRepository userFeedbackRepository;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private DraftService draftService;

    private AccountDataPurgeService accountDataPurgeService;

    @BeforeEach
    void setUp() {
        accountDataPurgeService = new AccountDataPurgeService(
                answerAttemptRepository,
                answerSessionRepository,
                coachInteractionRepository,
                diaryAttemptRepository,
                diaryEntryRepository,
                emailVerificationTokenRepository,
                feedbackDiagnosisLogRepository,
                feedbackTimingLogRepository,
                nowInEnglishEntryRepository,
                nowInEnglishReflectionRepository,
                passwordResetTokenRepository,
                promptRecommendationExposureRepository,
                promptRecommendationTimingLogRepository,
                rememberLoginTokenRepository,
                savedExpressionRepository,
                userFeedbackRepository,
                refreshTokenService,
                draftService
        );
    }

    @Test
    void everyEntityWithUserIdIsPurgedOnAccountDeletion() throws Exception {
        Set<String> entitiesWithUserId = findEntitiesWithUserIdColumn();
        Set<String> purgedEntities = AccountDataPurgeService.PURGED_USER_ENTITIES.stream()
                .map(Class::getSimpleName)
                .collect(Collectors.toCollection(TreeSet::new));

        assertThat(entitiesWithUserId).isNotEmpty();
        assertThat(purgedEntities)
                .as("user_id 컬럼이 있는 엔티티는 AccountDataPurgeService에서 탈퇴 시 삭제해야 합니다")
                .containsAll(entitiesWithUserId);
    }

    @Test
    void purgeUserData_deletesEveryUserLinkedStore() {
        accountDataPurgeService.purgeUserData(7L);

        InOrder childBeforeParent = inOrder(
                answerAttemptRepository,
                answerSessionRepository,
                diaryAttemptRepository,
                diaryEntryRepository
        );
        childBeforeParent.verify(answerAttemptRepository).purgeByUserId(7L);
        childBeforeParent.verify(answerSessionRepository).purgeByUserId(7L);
        childBeforeParent.verify(diaryAttemptRepository).purgeByUserId(7L);
        childBeforeParent.verify(diaryEntryRepository).purgeByUserId(7L);

        verify(nowInEnglishEntryRepository).purgeByUserId(7L);
        verify(nowInEnglishReflectionRepository).purgeByUserId(7L);
        verify(coachInteractionRepository).deleteAllByUserId(7L);
        verify(savedExpressionRepository).deleteAllByUserId(7L);
        verify(userFeedbackRepository).purgeByUserId(7L);
        verify(feedbackDiagnosisLogRepository).purgeByUserId(7L);
        verify(feedbackTimingLogRepository).purgeByUserId(7L);
        verify(promptRecommendationExposureRepository).purgeByUserId(7L);
        verify(promptRecommendationTimingLogRepository).purgeByUserId(7L);
        verify(emailVerificationTokenRepository).deleteAllByUserId(7L);
        verify(passwordResetTokenRepository).deleteAllByUserId(7L);
        verify(rememberLoginTokenRepository).deleteAllByUserId(7L);
        verify(refreshTokenService).revokeAllForUser(7L);
        verify(draftService).deleteAllDrafts(7L);
    }

    private Set<String> findEntitiesWithUserIdColumn() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

        Set<String> entityNames = new TreeSet<>();
        for (BeanDefinition candidate : scanner.findCandidateComponents("com.writeloop")) {
            Class<?> entityType = Class.forName(candidate.getBeanClassName());
            if (Arrays.stream(entityType.getDeclaredFields()).anyMatch(this::isUserIdColumn)) {
                entityNames.add(entityType.getSimpleName());
            }
        }
        return entityNames;
    }

    private boolean isUserIdColumn(Field field) {
        Column column = field.getAnnotation(Column.class);
        JoinColumn joinColumn = field.getAnnotation(JoinColumn.class);
        return "userId".equals(field.getName())
                || (column != null && "user_id".equals(column.name()))
                || (joinColumn != null && "user_id".equals(joinColumn.name()));
    }
}
