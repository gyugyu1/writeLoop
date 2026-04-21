package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptRecommendationItemDto;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRecommendationExposureEntity;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.persistence.SavedExpressionEntity;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.SessionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TodayQuestionRecommendationService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");
    private static final int MAX_RECOMMENDATIONS = 3;

    private final PromptRepository promptRepository;
    private final PromptHintRepository promptHintRepository;
    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final SavedExpressionRepository savedExpressionRepository;
    private final PromptRecommendationExposureRepository promptRecommendationExposureRepository;
    private final PromptCoachProfileSupport promptCoachProfileSupport;
    private final PromptTaskMetaSupport promptTaskMetaSupport;

    @Transactional
    public DailyPromptRecommendationDto recommend(
            DailyDifficultyDto difficulty,
            Long currentUserId,
            String rawGuestId
    ) {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        String guestId = currentUserId == null ? GuestIdentitySupport.normalizeGuestId(rawGuestId) : null;

        List<PromptEntity> activePrompts = promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        if (activePrompts.isEmpty()) {
            throw new IllegalStateException("No prompts found in database");
        }

        List<PromptEntity> exactDifficultyPrompts = activePrompts.stream()
                .filter(prompt -> difficulty.name().equalsIgnoreCase(prompt.getDifficulty()))
                .toList();
        if (exactDifficultyPrompts.isEmpty()) {
            throw new IllegalStateException("No prompts found for difficulty " + difficulty.name());
        }

        RecommendationSnapshot snapshot = buildSnapshot(exactDifficultyPrompts, today, currentUserId, guestId);
        Map<String, HintSignals> hintSignalsByPromptId = loadHintSignals(exactDifficultyPrompts);

        List<ScoredCandidate> strictCandidates = scoreCandidates(
                exactDifficultyPrompts,
                hintSignalsByPromptId,
                snapshot,
                false
        );

        boolean fallbackUsed = false;
        List<ScoredCandidate> finalCandidates = strictCandidates;
        if (strictCandidates.size() < MAX_RECOMMENDATIONS) {
            List<ScoredCandidate> relaxedCandidates = scoreCandidates(
                    exactDifficultyPrompts,
                    hintSignalsByPromptId,
                    snapshot,
                    true
            );
            finalCandidates = mergeCandidates(strictCandidates, relaxedCandidates);
            fallbackUsed = finalCandidates.size() > strictCandidates.size();
        }

        List<PromptRecommendationItemDto> composedItems = composeRecommendationItems(finalCandidates, difficulty, snapshot);
        PromptRecommendationItemDto featured = composedItems.isEmpty() ? null : composedItems.get(0);
        List<PromptRecommendationItemDto> alternatives = composedItems.size() <= 1
                ? List.of()
                : composedItems.subList(1, composedItems.size());
        List<PromptDto> legacyPrompts = composedItems.stream()
                .map(PromptRecommendationItemDto::prompt)
                .toList();

        saveExposureLogs(today, difficulty, currentUserId, guestId, composedItems);

        return new DailyPromptRecommendationDto(
                today.toString(),
                difficulty,
                snapshot.userState().name(),
                fallbackUsed,
                featured,
                alternatives,
                legacyPrompts
        );
    }

    @Transactional
    public void recordClick(String promptId, Long currentUserId, String rawGuestId) {
        findLatestExposureForToday(promptId, currentUserId, rawGuestId)
                .ifPresent(exposure -> {
                    exposure.markClicked();
                    promptRecommendationExposureRepository.save(exposure);
                });
    }

    @Transactional
    public void recordStart(String promptId, Long currentUserId, String rawGuestId, String sessionId) {
        findLatestExposureForToday(promptId, currentUserId, rawGuestId)
                .ifPresent(exposure -> {
                    exposure.markStartedSession(sessionId);
                    promptRecommendationExposureRepository.save(exposure);
                });
    }

    @Transactional
    public void recordComplete(String promptId, Long currentUserId, String rawGuestId, String sessionId) {
        findLatestExposureForToday(promptId, currentUserId, rawGuestId)
                .ifPresent(exposure -> {
                    exposure.markCompletedSession(sessionId);
                    promptRecommendationExposureRepository.save(exposure);
                });
    }

    private RecommendationSnapshot buildSnapshot(
            List<PromptEntity> candidatePrompts,
            LocalDate today,
            Long currentUserId,
            String guestId
    ) {
        List<AnswerSessionEntity> recentSessions = loadRecentSessions(currentUserId, guestId);
        List<String> sessionIds = recentSessions.stream()
                .map(AnswerSessionEntity::getId)
                .toList();
        Map<String, List<AnswerAttemptEntity>> attemptsBySessionId = loadAttemptsBySessionId(sessionIds);

        Set<String> relatedPromptIds = new LinkedHashSet<>();
        for (PromptEntity prompt : candidatePrompts) {
            relatedPromptIds.add(prompt.getId());
        }
        for (AnswerSessionEntity session : recentSessions) {
            if (session.getPromptId() != null && !session.getPromptId().isBlank()) {
                relatedPromptIds.add(session.getPromptId());
            }
        }

        List<SavedExpressionEntity> savedExpressions = currentUserId == null
                ? List.of()
                : savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(currentUserId);
        for (SavedExpressionEntity savedExpression : savedExpressions) {
            if (savedExpression.getPromptId() != null && !savedExpression.getPromptId().isBlank()) {
                relatedPromptIds.add(savedExpression.getPromptId());
            }
        }

        Map<String, PromptEntity> promptsById = new LinkedHashMap<>();
        for (PromptEntity prompt : promptRepository.findAllById(relatedPromptIds)) {
            promptsById.put(prompt.getId(), prompt);
        }

        Map<String, LocalDate> lastCompletedPromptDates = new HashMap<>();
        Map<String, LocalDate> lastCompletedCategoryDates = new HashMap<>();
        Map<String, LocalDate> lastCompletedDetailDates = new HashMap<>();
        Set<String> inProgressPromptIds = new LinkedHashSet<>();
        Set<LocalDate> completedDates = new LinkedHashSet<>();
        long recentStartedLastSevenDays = 0;
        long recentCompletedLastSevenDays = 0;

        LocalDate sevenDaysAgo = today.minusDays(7);

        for (AnswerSessionEntity session : recentSessions) {
            LocalDate createdDate = toLocalDate(session.getCreatedAt());
            if (createdDate != null && !createdDate.isBefore(sevenDaysAgo)) {
                recentStartedLastSevenDays += 1;
            }

            if (session.getStatus() == SessionStatus.IN_PROGRESS) {
                inProgressPromptIds.add(session.getPromptId());
                continue;
            }

            LocalDate completedDate = toLocalDate(session.getUpdatedAt());
            if (completedDate == null) {
                continue;
            }

            completedDates.add(completedDate);
            if (!completedDate.isBefore(sevenDaysAgo)) {
                recentCompletedLastSevenDays += 1;
            }

            putIfLater(lastCompletedPromptDates, session.getPromptId(), completedDate);

            PromptEntity prompt = promptsById.get(session.getPromptId());
            if (prompt == null) {
                continue;
            }

            String categoryKey = normalizeKey(prompt.getTopicCategory());
            if (!categoryKey.isBlank()) {
                putIfLater(lastCompletedCategoryDates, categoryKey, completedDate);
            }

            String detailKey = normalizeKey(prompt.getTopicDetail());
            if (!detailKey.isBlank()) {
                putIfLater(lastCompletedDetailDates, detailKey, completedDate);
            }
        }

        Map<String, Integer> savedCategoryAffinity = new HashMap<>();
        Map<String, Integer> savedDifficultyAffinity = new HashMap<>();
        for (SavedExpressionEntity savedExpression : savedExpressions) {
            PromptEntity prompt = promptsById.get(savedExpression.getPromptId());
            if (prompt == null) {
                continue;
            }

            String categoryKey = normalizeKey(prompt.getTopicCategory());
            if (!categoryKey.isBlank()) {
                savedCategoryAffinity.merge(categoryKey, 1, Integer::sum);
            }

            String promptDifficulty = normalizeKey(prompt.getDifficulty());
            if (!promptDifficulty.isBlank()) {
                savedDifficultyAffinity.merge(promptDifficulty, 1, Integer::sum);
            }
        }

        Set<String> recentExposurePromptIds = loadRecentExposurePromptIds(today, currentUserId, guestId);
        double recentAverageWordCount = calculateRecentAverageWordCount(recentSessions, attemptsBySessionId);
        UserState userState = determineUserState(
                recentSessions,
                recentStartedLastSevenDays,
                recentCompletedLastSevenDays,
                recentAverageWordCount,
                completedDates,
                today
        );

        return new RecommendationSnapshot(
                today,
                userState,
                inProgressPromptIds,
                lastCompletedPromptDates,
                lastCompletedCategoryDates,
                lastCompletedDetailDates,
                recentExposurePromptIds,
                savedCategoryAffinity,
                savedDifficultyAffinity,
                recentAverageWordCount,
                recentStartedLastSevenDays,
                recentCompletedLastSevenDays,
                calculateStreakDays(completedDates, today)
        );
    }

    private List<AnswerSessionEntity> loadRecentSessions(Long currentUserId, String guestId) {
        List<AnswerSessionEntity> sessions;
        if (currentUserId != null) {
            sessions = answerSessionRepository.findByUserIdOrderByCreatedAtDesc(currentUserId);
        } else if (guestId != null) {
            sessions = answerSessionRepository.findByGuestIdOrderByCreatedAtDesc(guestId);
        } else {
            sessions = List.of();
        }

        if (sessions.size() <= 40) {
            return sessions;
        }
        return sessions.subList(0, 40);
    }

    private Map<String, List<AnswerAttemptEntity>> loadAttemptsBySessionId(List<String> sessionIds) {
        if (sessionIds.isEmpty()) {
            return Map.of();
        }

        Map<String, List<AnswerAttemptEntity>> attemptsBySessionId = new LinkedHashMap<>();
        for (AnswerAttemptEntity attempt : answerAttemptRepository.findBySessionIdInOrderByCreatedAtAsc(sessionIds)) {
            attemptsBySessionId.computeIfAbsent(attempt.getSessionId(), ignored -> new ArrayList<>())
                    .add(attempt);
        }
        return attemptsBySessionId;
    }

    private Map<String, HintSignals> loadHintSignals(List<PromptEntity> prompts) {
        List<String> promptIds = prompts.stream()
                .map(PromptEntity::getId)
                .toList();
        if (promptIds.isEmpty()) {
            return Map.of();
        }

        Map<String, HintSignals.Builder> builders = new LinkedHashMap<>();
        for (PromptHintEntity hint : promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(promptIds)) {
            builders.computeIfAbsent(hint.getPromptId(), ignored -> new HintSignals.Builder())
                    .addHint(hint.getHintType());
        }

        Map<String, HintSignals> signalsByPromptId = new LinkedHashMap<>();
        for (String promptId : promptIds) {
            signalsByPromptId.put(promptId, builders.getOrDefault(promptId, new HintSignals.Builder()).build());
        }
        return signalsByPromptId;
    }

    private Set<String> loadRecentExposurePromptIds(LocalDate today, Long currentUserId, String guestId) {
        LocalDate recentSince = today.minusDays(3);
        List<PromptRecommendationExposureEntity> exposures;
        if (currentUserId != null) {
            exposures = promptRecommendationExposureRepository
                    .findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(currentUserId, recentSince);
        } else if (guestId != null) {
            exposures = promptRecommendationExposureRepository
                    .findByGuestIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(guestId, recentSince);
        } else {
            exposures = List.of();
        }

        return exposures.stream()
                .map(PromptRecommendationExposureEntity::getPromptId)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    private java.util.Optional<PromptRecommendationExposureEntity> findLatestExposureForToday(
            String promptId,
            Long currentUserId,
            String rawGuestId
    ) {
        if (promptId == null || promptId.isBlank()) {
            return java.util.Optional.empty();
        }

        LocalDate today = LocalDate.now(KOREA_ZONE);
        if (currentUserId != null) {
            return promptRecommendationExposureRepository
                    .findFirstByUserIdAndPromptIdAndRecommendedDateOrderByShownAtDesc(
                            currentUserId,
                            promptId,
                            today
                    );
        }

        String guestId = GuestIdentitySupport.normalizeGuestId(rawGuestId);
        if (guestId == null) {
            return java.util.Optional.empty();
        }

        return promptRecommendationExposureRepository
                .findFirstByGuestIdAndPromptIdAndRecommendedDateOrderByShownAtDesc(
                        guestId,
                        promptId,
                        today
                );
    }

    private double calculateRecentAverageWordCount(
            List<AnswerSessionEntity> recentSessions,
            Map<String, List<AnswerAttemptEntity>> attemptsBySessionId
    ) {
        if (recentSessions.isEmpty() || attemptsBySessionId.isEmpty()) {
            return 0;
        }

        int samples = 0;
        int totalWordCount = 0;
        for (AnswerSessionEntity session : recentSessions) {
            List<AnswerAttemptEntity> attempts = attemptsBySessionId.get(session.getId());
            if (attempts == null || attempts.isEmpty()) {
                continue;
            }

            AnswerAttemptEntity firstAttempt = attempts.get(0);
            int wordCount = countWords(firstAttempt.getAnswerText());
            if (wordCount <= 0) {
                continue;
            }

            totalWordCount += wordCount;
            samples += 1;
            if (samples >= 6) {
                break;
            }
        }

        if (samples == 0) {
            return 0;
        }
        return (double) totalWordCount / samples;
    }

    private UserState determineUserState(
            List<AnswerSessionEntity> recentSessions,
            long recentStartedLastSevenDays,
            long recentCompletedLastSevenDays,
            double recentAverageWordCount,
            Set<LocalDate> completedDates,
            LocalDate today
    ) {
        if (recentSessions.isEmpty()) {
            return UserState.NEW;
        }

        if (recentStartedLastSevenDays >= 2 && recentCompletedLastSevenDays == 0) {
            return UserState.RECOVERY;
        }

        long streakDays = calculateStreakDays(completedDates, today);
        if (recentCompletedLastSevenDays >= 4 && streakDays >= 2 && recentAverageWordCount >= 16) {
            return UserState.GROWTH;
        }

        if (recentCompletedLastSevenDays >= 1) {
            return UserState.STEADY;
        }

        if (recentSessions.size() <= 2) {
            return UserState.NEW;
        }
        return UserState.RECOVERY;
    }

    private long calculateStreakDays(Set<LocalDate> completedDates, LocalDate today) {
        if (completedDates.isEmpty()) {
            return 0;
        }

        LocalDate cursor = completedDates.contains(today) ? today : today.minusDays(1);
        long streak = 0;
        while (completedDates.contains(cursor)) {
            streak += 1;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private List<ScoredCandidate> scoreCandidates(
            List<PromptEntity> prompts,
            Map<String, HintSignals> hintSignalsByPromptId,
            RecommendationSnapshot snapshot,
            boolean relaxed
    ) {
        List<ScoredCandidate> candidates = new ArrayList<>();
        for (PromptEntity prompt : prompts) {
            HintSignals hintSignals = hintSignalsByPromptId.getOrDefault(prompt.getId(), HintSignals.EMPTY);
            ScoredCandidate candidate = scoreCandidate(prompt, hintSignals, snapshot, relaxed);
            if (candidate != null) {
                candidates.add(candidate);
            }
        }

        candidates.sort(Comparator
                .comparingInt(ScoredCandidate::score).reversed()
                .thenComparing(candidate -> candidate.prompt().getDisplayOrder()));
        return candidates;
    }

    private ScoredCandidate scoreCandidate(
            PromptEntity prompt,
            HintSignals hintSignals,
            RecommendationSnapshot snapshot,
            boolean relaxed
    ) {
        if (snapshot.inProgressPromptIds().contains(prompt.getId())) {
            return null;
        }

        int startabilityScore = calculateStartabilityScore(prompt, hintSignals);
        if (!relaxed
                && "A".equalsIgnoreCase(prompt.getDifficulty())
                && startabilityScore < 18) {
            return null;
        }

        LocalDate recentCompletedDate = snapshot.lastCompletedPromptDates().get(prompt.getId());
        if (!relaxed && isWithinDays(recentCompletedDate, snapshot.today(), 14)) {
            return null;
        }

        if (!relaxed && snapshot.recentExposurePromptIds().contains(prompt.getId())) {
            return null;
        }

        CandidateFeatures features = buildFeatures(prompt, hintSignals, snapshot);
        int freshnessScore = calculateFreshnessScore(prompt, snapshot, features, relaxed);
        int stateFitScore = calculateStateFitScore(prompt, snapshot, features);
        int expressionReuseScore = calculateExpressionReuseScore(prompt, snapshot, features);
        int growthFitScore = calculateGrowthFitScore(prompt, snapshot, features);
        int repeatPenalty = calculateRepeatPenalty(prompt, snapshot, relaxed);
        int score = Math.max(
                0,
                20 + startabilityScore + freshnessScore + stateFitScore + expressionReuseScore + growthFitScore - repeatPenalty
        );

        RecommendationReason reason = selectReason(prompt, snapshot, features, score);
        return new ScoredCandidate(
                prompt,
                score,
                startabilityScore,
                freshnessScore,
                stateFitScore,
                expressionReuseScore,
                growthFitScore,
                repeatPenalty,
                features,
                reason
        );
    }

    private CandidateFeatures buildFeatures(
            PromptEntity prompt,
            HintSignals hintSignals,
            RecommendationSnapshot snapshot
    ) {
        int requiredSlotCount = countRequiredSlots(prompt);
        int optionalSlotCount = countOptionalSlots(prompt);
        String categoryKey = normalizeKey(prompt.getTopicCategory());
        String detailKey = normalizeKey(prompt.getTopicDetail());

        boolean quickStart = hintSignals.hasStarter() || hintSignals.hasStructure();
        boolean easyToAddReason = hasSlot(prompt, "REASON");
        boolean easyToAddExample = hasSlot(prompt, "EXAMPLE");
        boolean timeMarkerFriendly = hasSlot(prompt, "TIME_OR_PLACE");
        boolean freshTopic = !snapshot.lastCompletedDetailDates().containsKey(detailKey);
        boolean categoryBalance = !snapshot.lastCompletedCategoryDates().containsKey(categoryKey);
        boolean recoverySafe = requiredSlotCount <= 2 && (quickStart || questionWordCount(prompt) <= 18);
        boolean streakKeeper = snapshot.streakDays() >= 2 && snapshot.recentCompletedLastSevenDays() >= 2;
        boolean reuseSavedCategory = snapshot.savedCategoryAffinity().getOrDefault(categoryKey, 0) > 0;
        boolean growthFriendly = hintSignals.hasDetail() || easyToAddExample || optionalSlotCount >= 2;
        boolean lowPressureValid = requiredSlotCount <= 2 && questionWordCount(prompt) <= 18;
        boolean saveableOutput = hintSignals.hasLinker() || hintSignals.hasDetail() || hintSignals.totalHints() >= 3;

        return new CandidateFeatures(
                quickStart,
                easyToAddReason,
                easyToAddExample,
                timeMarkerFriendly,
                freshTopic,
                categoryBalance,
                recoverySafe,
                streakKeeper,
                reuseSavedCategory,
                growthFriendly,
                lowPressureValid,
                saveableOutput,
                requiredSlotCount,
                optionalSlotCount,
                categoryKey,
                detailKey
        );
    }

    private int calculateStartabilityScore(PromptEntity prompt, HintSignals hintSignals) {
        int score = 8;
        if (hintSignals.hasStarter()) {
            score += 12;
        }
        if (hintSignals.hasStructure()) {
            score += 8;
        }
        if (hintSignals.hasDetail()) {
            score += 4;
        }
        if (hintSignals.hasLinker()) {
            score += 3;
        }
        if (promptCoachProfileSupport.toDto(prompt) != null
                && promptCoachProfileSupport.toDto(prompt).starterStyle() != null
                && !promptCoachProfileSupport.toDto(prompt).starterStyle().isBlank()) {
            score += 5;
        }

        int requiredSlotCount = countRequiredSlots(prompt);
        if (requiredSlotCount <= 1) {
            score += 8;
        } else if (requiredSlotCount == 2) {
            score += 5;
        } else if (requiredSlotCount >= 4) {
            score -= 4;
        }

        int questionWordCount = questionWordCount(prompt);
        if (questionWordCount <= 12) {
            score += 6;
        } else if (questionWordCount <= 18) {
            score += 3;
        } else if (questionWordCount >= 26) {
            score -= 5;
        }

        return Math.max(0, Math.min(score, 40));
    }

    private int calculateFreshnessScore(
            PromptEntity prompt,
            RecommendationSnapshot snapshot,
            CandidateFeatures features,
            boolean relaxed
    ) {
        int score = 0;
        if (features.freshTopic()) {
            score += 10;
        }
        if (features.categoryBalance()) {
            score += 6;
        }
        if (!relaxed && !snapshot.recentExposurePromptIds().contains(prompt.getId())) {
            score += 4;
        }
        return score;
    }

    private int calculateStateFitScore(
            PromptEntity prompt,
            RecommendationSnapshot snapshot,
            CandidateFeatures features
    ) {
        return switch (snapshot.userState()) {
            case NEW -> (features.quickStart() ? 8 : 2) + (features.lowPressureValid() ? 6 : 0);
            case RECOVERY -> (features.recoverySafe() ? 12 : 1) + (features.quickStart() ? 4 : 0);
            case STEADY -> (features.categoryBalance() ? 6 : 2) + (features.growthFriendly() ? 4 : 0);
            case GROWTH -> (features.growthFriendly() ? 8 : 2) + (features.freshTopic() ? 4 : 0);
        };
    }

    private int calculateExpressionReuseScore(
            PromptEntity prompt,
            RecommendationSnapshot snapshot,
            CandidateFeatures features
    ) {
        int score = 0;
        if (features.reuseSavedCategory()) {
            score += Math.min(10, snapshot.savedCategoryAffinity().getOrDefault(features.categoryKey(), 0) * 4);
        }

        score += Math.min(3, snapshot.savedDifficultyAffinity().getOrDefault(normalizeKey(prompt.getDifficulty()), 0));
        return score;
    }

    private int calculateGrowthFitScore(
            PromptEntity prompt,
            RecommendationSnapshot snapshot,
            CandidateFeatures features
    ) {
        if (snapshot.userState() == UserState.NEW || snapshot.userState() == UserState.RECOVERY) {
            return features.easyToAddReason() ? 3 : 0;
        }

        int score = 0;
        if (features.growthFriendly()) {
            score += 6;
        }
        if (features.easyToAddExample()) {
            score += 3;
        }
        if (features.timeMarkerFriendly()) {
            score += 2;
        }
        return score;
    }

    private int calculateRepeatPenalty(
            PromptEntity prompt,
            RecommendationSnapshot snapshot,
            boolean relaxed
    ) {
        int penalty = 0;
        if (isWithinDays(snapshot.lastCompletedDetailDates().get(normalizeKey(prompt.getTopicDetail())), snapshot.today(), 7)) {
            penalty += 10;
        }
        if (isWithinDays(snapshot.lastCompletedCategoryDates().get(normalizeKey(prompt.getTopicCategory())), snapshot.today(), 3)) {
            penalty += 6;
        }
        if (relaxed && isWithinDays(snapshot.lastCompletedPromptDates().get(prompt.getId()), snapshot.today(), 14)) {
            penalty += 18;
        }
        if (relaxed && snapshot.recentExposurePromptIds().contains(prompt.getId())) {
            penalty += 12;
        }
        return penalty;
    }

    private RecommendationReason selectReason(
            PromptEntity prompt,
            RecommendationSnapshot snapshot,
            CandidateFeatures features,
            int score
    ) {
        List<String> facts = new ArrayList<>();

        if (snapshot.userState() == UserState.RECOVERY && features.recoverySafe()) {
            facts.add("recent-completion-drop");
            facts.add("required-slots<=2");
            return new RecommendationReason(
                    "RECOVERY_SAFE",
                    "Recent loops stopped mid-way, so this is a safer question to restart your rhythm without extra pressure.",
                    facts
            );
        }

        if (features.reuseSavedCategory()) {
            facts.add("saved-category-match");
            facts.add("saved-count=" + snapshot.savedCategoryAffinity().getOrDefault(features.categoryKey(), 0));
            return new RecommendationReason(
                    "REUSE_SAVED_EXPRESSION",
                    "This question fits the expressions you recently saved, so it is a good chance to reuse what you learned in a new answer.",
                    facts
            );
        }

        if (snapshot.recentAverageWordCount() > 0 && snapshot.recentAverageWordCount() < 16 && features.easyToAddReason()) {
            facts.add("recent-average-words<16");
            facts.add("reason-slot-available");
            return new RecommendationReason(
                    "ONE_REASON_UP",
                    "Your recent answers were on the shorter side, and this prompt gets better fast when you add just one clear reason.",
                    facts
            );
        }

        if (features.timeMarkerFriendly()) {
            facts.add("time-or-place-slot");
            return new RecommendationReason(
                    "TIME_MARKER_REUSE",
                    "Time or place phrases fit naturally here, so it is an easy question for practicing expressions like usually, after lunch, or at home.",
                    facts
            );
        }

        if (features.freshTopic()) {
            facts.add("topic-detail-not-used-in-7d");
            return new RecommendationReason(
                    "TOPIC_FRESH",
                    "You have not written on this topic recently, so it should feel fresher and easier to start today.",
                    facts
            );
        }

        if (snapshot.streakDays() >= 2 && features.lowPressureValid()) {
            facts.add("streak-days=" + snapshot.streakDays());
            facts.add("low-pressure-valid");
            return new RecommendationReason(
                    "STREAK_KEEPER",
                    "Your recent completion flow looks steady, and this is a strong low-friction question for keeping that streak alive today.",
                    facts
            );
        }

        if (features.growthFriendly() && (snapshot.userState() == UserState.STEADY || snapshot.userState() == UserState.GROWTH)) {
            facts.add("growth-friendly");
            facts.add("score=" + score);
            return new RecommendationReason(
                    "HALF_STEP_GROWTH",
                    "This prompt lets you go half a step further by adding detail or an example without feeling like a full difficulty jump.",
                    facts
            );
        }

        if (features.easyToAddExample()) {
            facts.add("example-slot-available");
            return new RecommendationReason(
                    "ADD_EXAMPLE",
                    "One short example fits naturally in this question, so your answer can become richer without getting much longer.",
                    facts
            );
        }

        if (features.quickStart()) {
            facts.add("starter-or-structure-hint");
            return new RecommendationReason(
                    "QUICK_START",
                    "This prompt gives you a clearer way to open the first sentence, so you can start writing before overthinking it.",
                    facts
            );
        }

        if (features.categoryBalance()) {
            facts.add("recent-category-balance");
            return new RecommendationReason(
                    "CATEGORY_BALANCE",
                    "You have been writing in a similar lane recently, so this question helps widen the rhythm with a different category.",
                    facts
            );
        }

        if (features.lowPressureValid()) {
            facts.add("required-slots<=2");
            return new RecommendationReason(
                    "LOW_PRESSURE_VALID",
                    "This question still works even with a short answer, which makes it a good option for days when you want to begin without pressure.",
                    facts
            );
        }

        if (features.saveableOutput()) {
            facts.add("hint-rich");
            return new RecommendationReason(
                    "SAVEABLE_OUTPUT",
                    "This prompt tends to produce reusable phrases and connectors, so it is a good one for collecting expressions after you write.",
                    facts
            );
        }

        return new RecommendationReason(
                "TRANSFER_PRACTICE",
                "This question is good for moving familiar expressions into a slightly different context, which builds real usage rather than repetition.",
                List.of("default-transfer-practice")
        );
    }

    private List<ScoredCandidate> mergeCandidates(
            List<ScoredCandidate> strictCandidates,
            List<ScoredCandidate> relaxedCandidates
    ) {
        Map<String, ScoredCandidate> merged = new LinkedHashMap<>();
        for (ScoredCandidate candidate : strictCandidates) {
            merged.put(candidate.prompt().getId(), candidate);
        }
        for (ScoredCandidate candidate : relaxedCandidates) {
            merged.putIfAbsent(candidate.prompt().getId(), candidate);
            if (merged.size() >= MAX_RECOMMENDATIONS * 2) {
                break;
            }
        }
        return merged.values().stream()
                .sorted(Comparator
                        .comparingInt(ScoredCandidate::score).reversed()
                        .thenComparing(candidate -> candidate.prompt().getDisplayOrder()))
                .toList();
    }

    private List<PromptRecommendationItemDto> composeRecommendationItems(
            List<ScoredCandidate> candidates,
            DailyDifficultyDto difficulty,
            RecommendationSnapshot snapshot
    ) {
        if (candidates.isEmpty()) {
            return List.of();
        }

        List<PromptRecommendationItemDto> items = new ArrayList<>();
        List<ScoredCandidate> remaining = new ArrayList<>(candidates);

        ScoredCandidate featured = remaining.remove(0);
        items.add(toItem(featured, "FEATURED"));

        ScoredCandidate freshAlternative = pickAlternative(
                remaining,
                List.of(featured),
                candidate -> !sameCategory(candidate, featured)
        );
        if (freshAlternative != null) {
            items.add(toItem(freshAlternative, "FRESH_ALTERNATIVE"));
            remaining.remove(freshAlternative);
        }

        ScoredCandidate growthAlternative = pickAlternative(
                remaining,
                items.stream().map(item -> findCandidateByPromptId(candidates, item.prompt().id())).toList(),
                snapshot.userState() == UserState.NEW || snapshot.userState() == UserState.RECOVERY
                        ? candidate -> candidate.features().lowPressureValid()
                        : candidate -> candidate.features().growthFriendly()
        );
        if (growthAlternative != null) {
            items.add(toItem(growthAlternative, "GROWTH_ALTERNATIVE"));
            remaining.remove(growthAlternative);
        }

        for (ScoredCandidate candidate : remaining) {
            if (items.size() >= MAX_RECOMMENDATIONS) {
                break;
            }
            items.add(toItem(candidate, "ALTERNATIVE"));
        }

        return items;
    }

    private ScoredCandidate findCandidateByPromptId(Collection<ScoredCandidate> candidates, String promptId) {
        for (ScoredCandidate candidate : candidates) {
            if (candidate.prompt().getId().equals(promptId)) {
                return candidate;
            }
        }
        return null;
    }

    private ScoredCandidate pickAlternative(
            List<ScoredCandidate> candidates,
            List<ScoredCandidate> selected,
            java.util.function.Predicate<ScoredCandidate> preferredPredicate
    ) {
        for (ScoredCandidate candidate : candidates) {
            if (selected.contains(candidate)) {
                continue;
            }
            if (preferredPredicate.test(candidate) && selected.stream().noneMatch(existing -> samePrompt(existing, candidate))) {
                return candidate;
            }
        }
        for (ScoredCandidate candidate : candidates) {
            if (selected.contains(candidate)) {
                continue;
            }
            if (selected.stream().noneMatch(existing -> samePrompt(existing, candidate))) {
                return candidate;
            }
        }
        return null;
    }

    private boolean samePrompt(ScoredCandidate left, ScoredCandidate right) {
        if (left == null || right == null) {
            return false;
        }
        return left.prompt().getId().equals(right.prompt().getId());
    }

    private boolean sameCategory(ScoredCandidate left, ScoredCandidate right) {
        if (left == null || right == null) {
            return false;
        }
        return left.features().categoryKey().equals(right.features().categoryKey());
    }

    private PromptRecommendationItemDto toItem(ScoredCandidate candidate, String slot) {
        return new PromptRecommendationItemDto(
                slot,
                toPromptDto(candidate.prompt()),
                candidate.reason().code(),
                translateReasonText(candidate.reason().text()),
                candidate.reason().facts(),
                candidate.score()
        );
    }

    private void saveExposureLogs(
            LocalDate today,
            DailyDifficultyDto difficulty,
            Long currentUserId,
            String guestId,
            List<PromptRecommendationItemDto> items
    ) {
        if (items.isEmpty()) {
            return;
        }

        List<PromptRecommendationExposureEntity> exposures = items.stream()
                .map(item -> new PromptRecommendationExposureEntity(
                        today,
                        currentUserId,
                        guestId,
                        difficulty.name(),
                        item.prompt().id(),
                        item.slot(),
                        item.reasonCode(),
                        item.score()
                ))
                .toList();
        promptRecommendationExposureRepository.saveAll(exposures);
    }

    private PromptDto toPromptDto(PromptEntity prompt) {
        return new PromptDto(
                prompt.getId(),
                prompt.getTopic(),
                prompt.getTopicCategory(),
                prompt.getTopicDetail(),
                prompt.getDifficulty(),
                prompt.getQuestionEn(),
                prompt.getQuestionKo(),
                prompt.getTip(),
                promptCoachProfileSupport.toDto(prompt),
                promptTaskMetaSupport.toDto(prompt)
        );
    }

    private String translateReasonText(String englishText) {
        return switch (englishText) {
            case "Recent loops stopped mid-way, so this is a safer question to restart your rhythm without extra pressure." ->
                    "최근 루프를 중간에 멈춘 적이 있어서, 오늘은 부담 없이 다시 흐름을 찾기 좋은 질문을 골랐어요.";
            case "This question fits the expressions you recently saved, so it is a good chance to reuse what you learned in a new answer." ->
                    "최근 저장한 표현과 잘 이어지는 질문이라, 배운 표현을 새로운 답변 안에서 다시 써보기 좋아요.";
            case "Your recent answers were on the shorter side, and this prompt gets better fast when you add just one clear reason." ->
                    "최근 답변이 짧은 편이라, 이번 질문은 이유 한 줄만 더해도 답이 확실히 좋아지기 쉬워요.";
            case "Time or place phrases fit naturally here, so it is an easy question for practicing expressions like usually, after lunch, or at home." ->
                    "시간이나 장소 표현이 자연스럽게 붙는 질문이라 usually, after lunch, at home 같은 표현을 다시 써보기 좋아요.";
            case "You have not written on this topic recently, so it should feel fresher and easier to start today." ->
                    "최근에 쓰지 않았던 주제라 오늘은 더 신선한 감각으로 시작하기 좋아요.";
            case "Your recent completion flow looks steady, and this is a strong low-friction question for keeping that streak alive today." ->
                    "최근 완주 흐름이 안정적이라, 오늘도 그 리듬을 이어가기 좋은 부담 적은 질문을 골랐어요.";
            case "This prompt lets you go half a step further by adding detail or an example without feeling like a full difficulty jump." ->
                    "난이도를 크게 올리지 않고도 디테일이나 예시를 반 걸음 더 붙여볼 수 있는 질문이에요.";
            case "One short example fits naturally in this question, so your answer can become richer without getting much longer." ->
                    "짧은 예시 한 줄만 더해도 답이 자연스럽게 풍부해지는 질문이에요.";
            case "This prompt gives you a clearer way to open the first sentence, so you can start writing before overthinking it." ->
                    "첫 문장을 여는 방식이 비교적 분명해서 너무 오래 고민하지 않고 바로 쓰기 좋아요.";
            case "You have been writing in a similar lane recently, so this question helps widen the rhythm with a different category." ->
                    "최근 비슷한 결의 질문이 이어졌어서, 오늘은 다른 카테고리로 흐름을 넓혀 보기 좋아요.";
            case "This question still works even with a short answer, which makes it a good option for days when you want to begin without pressure." ->
                    "짧게 답해도 성립하는 질문이라, 오늘 가볍게 시작하고 싶을 때 잘 맞아요.";
            case "This prompt tends to produce reusable phrases and connectors, so it is a good one for collecting expressions after you write." ->
                    "답을 쓰면서 건질 만한 표현이나 연결 표현이 잘 나오는 편이라 표현 저장까지 이어가기 좋아요.";
            default ->
                    "익숙한 표현을 조금 다른 문맥으로 옮겨 써보기에 좋은 질문이라 활용 연습에 잘 맞아요.";
        };
    }

    private int countRequiredSlots(PromptEntity prompt) {
        if (prompt.getTaskProfile() == null || prompt.getTaskProfile().getSlotAssignments() == null) {
            return 0;
        }
        int count = 0;
        for (var assignment : prompt.getTaskProfile().getSlotAssignments()) {
            if (assignment != null
                    && Boolean.TRUE.equals(assignment.getActive())
                    && "REQUIRED".equalsIgnoreCase(assignment.getSlotRole())) {
                count += 1;
            }
        }
        return count;
    }

    private int countOptionalSlots(PromptEntity prompt) {
        if (prompt.getTaskProfile() == null || prompt.getTaskProfile().getSlotAssignments() == null) {
            return 0;
        }
        int count = 0;
        for (var assignment : prompt.getTaskProfile().getSlotAssignments()) {
            if (assignment != null
                    && Boolean.TRUE.equals(assignment.getActive())
                    && "OPTIONAL".equalsIgnoreCase(assignment.getSlotRole())) {
                count += 1;
            }
        }
        return count;
    }

    private boolean hasSlot(PromptEntity prompt, String slotCode) {
        if (prompt.getTaskProfile() == null || prompt.getTaskProfile().getSlotAssignments() == null) {
            return false;
        }
        for (var assignment : prompt.getTaskProfile().getSlotAssignments()) {
            if (assignment == null || assignment.getSlot() == null || !Boolean.TRUE.equals(assignment.getActive())) {
                continue;
            }
            if (slotCode.equalsIgnoreCase(assignment.getSlot().getCode())) {
                return true;
            }
        }
        return false;
    }

    private int questionWordCount(PromptEntity prompt) {
        return countWords(prompt.getQuestionEn());
    }

    private int countWords(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        String[] tokens = value.trim().split("\\s+");
        int count = 0;
        for (String token : tokens) {
            if (!token.isBlank()) {
                count += 1;
            }
        }
        return count;
    }

    private boolean isWithinDays(LocalDate date, LocalDate today, int days) {
        return date != null && !date.isBefore(today.minusDays(days));
    }

    private LocalDate toLocalDate(Instant instant) {
        return instant == null ? null : instant.atZone(KOREA_ZONE).toLocalDate();
    }

    private void putIfLater(Map<String, LocalDate> target, String key, LocalDate candidate) {
        if (key == null || key.isBlank() || candidate == null) {
            return;
        }
        target.merge(key, candidate, (existing, incoming) -> incoming.isAfter(existing) ? incoming : existing);
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private enum UserState {
        NEW,
        RECOVERY,
        STEADY,
        GROWTH
    }

    private record RecommendationSnapshot(
            LocalDate today,
            UserState userState,
            Set<String> inProgressPromptIds,
            Map<String, LocalDate> lastCompletedPromptDates,
            Map<String, LocalDate> lastCompletedCategoryDates,
            Map<String, LocalDate> lastCompletedDetailDates,
            Set<String> recentExposurePromptIds,
            Map<String, Integer> savedCategoryAffinity,
            Map<String, Integer> savedDifficultyAffinity,
            double recentAverageWordCount,
            long recentStartedLastSevenDays,
            long recentCompletedLastSevenDays,
            long streakDays
    ) {
    }

    private record CandidateFeatures(
            boolean quickStart,
            boolean easyToAddReason,
            boolean easyToAddExample,
            boolean timeMarkerFriendly,
            boolean freshTopic,
            boolean categoryBalance,
            boolean recoverySafe,
            boolean streakKeeper,
            boolean reuseSavedCategory,
            boolean growthFriendly,
            boolean lowPressureValid,
            boolean saveableOutput,
            int requiredSlotCount,
            int optionalSlotCount,
            String categoryKey,
            String detailKey
    ) {
    }

    private record RecommendationReason(String code, String text, List<String> facts) {
    }

    private record ScoredCandidate(
            PromptEntity prompt,
            int score,
            int startabilityScore,
            int freshnessScore,
            int stateFitScore,
            int expressionReuseScore,
            int growthFitScore,
            int repeatPenalty,
            CandidateFeatures features,
            RecommendationReason reason
    ) {
    }

    private record HintSignals(
            boolean hasStarter,
            boolean hasStructure,
            boolean hasDetail,
            boolean hasLinker,
            int totalHints
    ) {
        private static final HintSignals EMPTY = new HintSignals(false, false, false, false, 0);

        private static final class Builder {
            private boolean hasStarter;
            private boolean hasStructure;
            private boolean hasDetail;
            private boolean hasLinker;
            private int totalHints;

            private void addHint(String hintType) {
                String normalized = hintType == null ? "" : hintType.trim().toUpperCase(Locale.ROOT);
                if (normalized.isBlank()) {
                    return;
                }

                totalHints += 1;
                switch (normalized) {
                    case PromptHintItemSupport.HINT_TYPE_STARTER -> hasStarter = true;
                    case PromptHintItemSupport.HINT_TYPE_STRUCTURE -> hasStructure = true;
                    case PromptHintItemSupport.HINT_TYPE_DETAIL -> hasDetail = true;
                    case PromptHintItemSupport.HINT_TYPE_LINKER -> hasLinker = true;
                    default -> {
                    }
                }
            }

            private HintSignals build() {
                return new HintSignals(hasStarter, hasStructure, hasDetail, hasLinker, totalHints);
            }
        }
    }
}
