package com.writeloop.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.AnswerHistoryAttemptDto;
import com.writeloop.dto.AnswerHistoryFeedbackDto;
import com.writeloop.dto.AnswerHistorySessionDto;
import com.writeloop.dto.CommonMistakeDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.MonthWritingStatusDayDto;
import com.writeloop.dto.MonthWritingStatusDto;
import com.writeloop.dto.TodayWritingStatusDto;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.persistence.SessionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnswerHistoryService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<CorrectionDto>> CORRECTION_LIST_TYPE = new TypeReference<>() {
    };

    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final PromptRepository promptRepository;
    private final ObjectMapper objectMapper;

    public List<AnswerHistorySessionDto> getHistory(Long userId) {
        List<AnswerSessionEntity> sessions = answerSessionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (sessions.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> sessionIds = sessions.stream()
                .map(AnswerSessionEntity::getId)
                .toList();

        Map<String, List<AnswerAttemptEntity>> attemptsBySessionId = answerAttemptRepository
                .findBySessionIdInOrderByCreatedAtAsc(sessionIds)
                .stream()
                .collect(Collectors.groupingBy(AnswerAttemptEntity::getSessionId));

        Map<String, PromptEntity> promptsById = promptRepository.findAllById(
                        sessions.stream().map(AnswerSessionEntity::getPromptId).toList()
                ).stream()
                .collect(Collectors.toMap(PromptEntity::getId, Function.identity()));

        return sessions.stream()
                .map(session -> toHistorySession(
                        session,
                        promptsById.get(session.getPromptId()),
                        attemptsBySessionId.get(session.getId())
                ))
                .toList();
    }

    public TodayWritingStatusDto getTodayStatus(Long userId) {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        Instant start = today.atStartOfDay(KOREA_ZONE).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(KOREA_ZONE).toInstant();

        long startedSessions = answerSessionRepository.countByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                userId,
                start,
                end
        );
        long completedSessions = answerSessionRepository.countByUserIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThan(
                userId,
                SessionStatus.COMPLETED,
                start,
                end
        );

        return new TodayWritingStatusDto(
                today.toString(),
                completedSessions > 0,
                completedSessions,
                startedSessions,
                calculateStreakDays(userId, today)
        );
    }

    public MonthWritingStatusDto getMonthStatus(Long userId, int year, int month) {
        YearMonth yearMonth;
        try {
            yearMonth = YearMonth.of(year, month);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid year or month", exception);
        }

        LocalDate monthStart = yearMonth.atDay(1);
        LocalDate monthEnd = yearMonth.atEndOfMonth();
        Instant start = monthStart.atStartOfDay(KOREA_ZONE).toInstant();
        Instant end = monthEnd.plusDays(1).atStartOfDay(KOREA_ZONE).toInstant();
        LocalDate today = LocalDate.now(KOREA_ZONE);

        List<AnswerSessionEntity> startedSessions = answerSessionRepository
                .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(userId, start, end);
        List<AnswerSessionEntity> completedSessions = answerSessionRepository
                .findByUserIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtAsc(
                        userId,
                        SessionStatus.COMPLETED,
                        start,
                        end
                );

        Map<LocalDate, DayAggregate> aggregates = new LinkedHashMap<>();
        LocalDate cursor = monthStart;
        while (!cursor.isAfter(monthEnd)) {
            aggregates.put(cursor, new DayAggregate(cursor.equals(today)));
            cursor = cursor.plusDays(1);
        }

        for (AnswerSessionEntity session : startedSessions) {
            LocalDate sessionDate = session.getCreatedAt().atZone(KOREA_ZONE).toLocalDate();
            DayAggregate aggregate = aggregates.get(sessionDate);
            if (aggregate == null) {
                continue;
            }

            aggregate.startedSessions += 1;
            aggregate.started = true;
        }

        for (AnswerSessionEntity session : completedSessions) {
            LocalDate sessionDate = session.getUpdatedAt().atZone(KOREA_ZONE).toLocalDate();
            DayAggregate aggregate = aggregates.get(sessionDate);
            if (aggregate == null) {
                continue;
            }

            aggregate.completedSessions += 1;
            aggregate.completed = true;
        }

        return new MonthWritingStatusDto(
                yearMonth.getYear(),
                yearMonth.getMonthValue(),
                calculateStreakDays(userId, today),
                aggregates.entrySet().stream()
                        .map(entry -> new MonthWritingStatusDayDto(
                                entry.getKey().toString(),
                                entry.getValue().started,
                                entry.getValue().completed,
                                entry.getValue().startedSessions,
                                entry.getValue().completedSessions,
                                entry.getValue().isToday
                        ))
                        .toList()
        );
    }

    public List<CommonMistakeDto> getCommonMistakes(Long userId) {
        List<AnswerSessionEntity> sessions = answerSessionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (sessions.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> sessionIds = sessions.stream()
                .map(AnswerSessionEntity::getId)
                .toList();

        Map<String, MistakeAggregate> aggregates = new LinkedHashMap<>();

        answerAttemptRepository.findBySessionIdInOrderByCreatedAtAsc(sessionIds)
                .forEach(attempt -> extractCorrections(attempt).forEach(correction -> {
                    if (correction == null) {
                        return;
                    }

                    String issue = correction.issue() == null ? "" : correction.issue().trim();
                    String suggestion = correction.suggestion() == null ? "" : correction.suggestion().trim();
                    if (issue.isBlank() && suggestion.isBlank()) {
                        return;
                    }

                    MistakeCategory category = categorizeCorrection(issue, suggestion);
                    MistakeAggregate aggregate = aggregates.computeIfAbsent(
                            category.key(),
                            ignored -> new MistakeAggregate(category.key(), category.displayLabel())
                    );
                    aggregate.increment(suggestion, attempt.getCreatedAt());
                }));

        return aggregates.values().stream()
                .sorted(Comparator
                        .comparingLong(MistakeAggregate::count).reversed()
                        .thenComparing(MistakeAggregate::latestSeenAt, Comparator.reverseOrder()))
                .limit(5)
                .map(aggregate -> new CommonMistakeDto(
                        aggregate.issue(),
                        aggregate.displayLabel(),
                        aggregate.count(),
                        aggregate.latestSuggestion()
                ))
                .toList();
    }

    private long calculateStreakDays(Long userId, LocalDate today) {
        List<AnswerSessionEntity> completedSessions = answerSessionRepository
                .findByUserIdAndStatusOrderByUpdatedAtDesc(userId, SessionStatus.COMPLETED);

        if (completedSessions.isEmpty()) {
            return 0;
        }

        Set<LocalDate> completedDates = completedSessions.stream()
                .map(session -> session.getUpdatedAt().atZone(KOREA_ZONE).toLocalDate())
                .collect(Collectors.toCollection(LinkedHashSet::new));

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

    private static final class DayAggregate {
        private boolean started;
        private boolean completed;
        private long startedSessions;
        private long completedSessions;
        private final boolean isToday;

        private DayAggregate(boolean isToday) {
            this.isToday = isToday;
        }
    }

    private List<CorrectionDto> extractCorrections(AnswerAttemptEntity attempt) {
        if (attempt.getFeedbackPayloadJson() != null && !attempt.getFeedbackPayloadJson().isBlank()) {
            try {
                FeedbackResponseDto feedback = objectMapper.readValue(
                        attempt.getFeedbackPayloadJson(),
                        FeedbackResponseDto.class
                );
                return feedback.corrections();
            } catch (Exception ignored) {
                // Fall back to legacy correction columns below.
            }
        }

        try {
            return objectMapper.readValue(attempt.getCorrectionsJson(), CORRECTION_LIST_TYPE);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to deserialize stored corrections", exception);
        }
    }

    private MistakeCategory categorizeCorrection(String issue, String suggestion) {
        String normalized = normalize(issue + " " + suggestion);

        if (containsAny(normalized, "관사", "article", "articles", "a/an/the", "a ", "an ", "the ")) {
            return new MistakeCategory("articles", "관사 사용");
        }
        if (containsAny(normalized, "시제", "tense", "현재형", "과거형", "동사 형태")) {
            return new MistakeCategory("tense", "시제");
        }
        if (containsAny(normalized, "전치사", "preposition")) {
            return new MistakeCategory("preposition", "전치사");
        }
        if (containsAny(normalized, "복수", "단수", "plural", "singular")) {
            return new MistakeCategory("number", "단수·복수 표현");
        }
        if (containsAny(normalized, "어순", "word order", "문장 순서")) {
            return new MistakeCategory("word-order", "어순");
        }
        if (containsAny(normalized, "문장 구조", "sentence structure", "structure")) {
            return new MistakeCategory("sentence-structure", "문장 구조");
        }
        if (containsAny(normalized, "어휘", "단어 선택", "word choice", "vocabulary")) {
            return new MistakeCategory("vocabulary", "어휘 선택");
        }
        if (containsAny(normalized, "자연", "awkward", "natural", "원어민")) {
            return new MistakeCategory("naturalness", "더 자연스러운 표현");
        }
        if (containsAny(normalized, "문법", "grammar")) {
            return new MistakeCategory("grammar", "문법 정확성");
        }
        if (containsAny(normalized, "철자", "spelling", "오타")) {
            return new MistakeCategory("spelling", "철자");
        }
        if (containsAny(normalized, "마침표", "구두점", "punctuation")) {
            return new MistakeCategory("punctuation", "문장 마무리");
        }
        if (containsAny(normalized, "연결어", "connect", "transition", "because", "so", "and", "but")) {
            return new MistakeCategory("coherence", "문장 연결");
        }
        if (containsAny(normalized, "구체", "예시", "detail", "example", "expand")) {
            return new MistakeCategory("detail", "내용 확장");
        }
        if (containsAny(normalized, "대문자", "capital letter", "capitalize", "uppercase", "start with a capital")) {
            return new MistakeCategory("capitalization", "대문자 시작");
        }
        if (containsAny(normalized, "명확", "clarity", "clearer", "clearly", "의미 전달", "의미가", "more specific")) {
            return new MistakeCategory("clarity", "의미 명확성");
        }

        String trimmedIssue = issue == null ? "" : issue.trim();
        if (!trimmedIssue.isBlank()) {
            return new MistakeCategory(trimmedIssue.toLowerCase(), trimmedIssue);
        }

        return new MistakeCategory("general", "표현 다듬기");
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase();
    }

    private boolean containsAny(String source, String... tokens) {
        for (String token : tokens) {
            if (source.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private AnswerHistorySessionDto toHistorySession(
            AnswerSessionEntity session,
            PromptEntity prompt,
            List<AnswerAttemptEntity> attempts
    ) {
        List<AnswerHistoryAttemptDto> attemptDtos = attempts == null
                ? Collections.emptyList()
                : attempts.stream().map(this::toHistoryAttempt).toList();

        return new AnswerHistorySessionDto(
                session.getId(),
                session.getPromptId(),
                prompt == null ? "" : prompt.getTopic(),
                prompt == null ? "" : prompt.getDifficulty(),
                prompt == null ? "" : prompt.getQuestionEn(),
                prompt == null ? "" : prompt.getQuestionKo(),
                session.getCreatedAt(),
                session.getUpdatedAt(),
                attemptDtos
        );
    }

    private AnswerHistoryAttemptDto toHistoryAttempt(AnswerAttemptEntity attempt) {
        return new AnswerHistoryAttemptDto(
                attempt.getId(),
                attempt.getAttemptNo(),
                attempt.getAttemptType().name(),
                attempt.getAnswerText(),
                attempt.getScore(),
                attempt.getFeedbackSummary(),
                toHistoryFeedback(attempt),
                attempt.getCreatedAt()
        );
    }

    private AnswerHistoryFeedbackDto toHistoryFeedback(AnswerAttemptEntity attempt) {
        if (attempt.getFeedbackPayloadJson() != null && !attempt.getFeedbackPayloadJson().isBlank()) {
            try {
                FeedbackResponseDto feedback = objectMapper.readValue(
                        attempt.getFeedbackPayloadJson(),
                        FeedbackResponseDto.class
                );
                return new AnswerHistoryFeedbackDto(
                        feedback.score(),
                        feedback.loopComplete(),
                        feedback.completionMessage(),
                        feedback.summary(),
                        feedback.strengths(),
                        feedback.corrections(),
                        feedback.inlineFeedback(),
                        feedback.correctedAnswer(),
                        feedback.modelAnswer(),
                        feedback.rewriteChallenge()
                );
            } catch (Exception ignored) {
                // Fall back to legacy feedback columns below.
            }
        }

        try {
            return new AnswerHistoryFeedbackDto(
                    attempt.getScore(),
                    false,
                    null,
                    attempt.getFeedbackSummary(),
                    objectMapper.readValue(attempt.getStrengthsJson(), STRING_LIST_TYPE),
                    objectMapper.readValue(attempt.getCorrectionsJson(), CORRECTION_LIST_TYPE),
                    List.of(),
                    attempt.getAnswerText(),
                    attempt.getModelAnswer(),
                    attempt.getRewriteChallenge()
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to deserialize stored feedback", exception);
        }
    }

    private static final class MistakeAggregate {
        private final String issue;
        private final String displayLabel;
        private long count;
        private String latestSuggestion = "";
        private Instant latestSeenAt = Instant.EPOCH;

        private MistakeAggregate(String issue, String displayLabel) {
            this.issue = issue;
            this.displayLabel = displayLabel;
        }

        private void increment(String suggestion, Instant seenAt) {
            count += 1;
            if (seenAt != null && seenAt.isAfter(latestSeenAt)) {
                latestSeenAt = seenAt;
                latestSuggestion = suggestion == null ? "" : suggestion;
            }
        }

        private String issue() {
            return issue;
        }

        private String displayLabel() {
            return displayLabel;
        }

        private long count() {
            return count;
        }

        private String latestSuggestion() {
            return latestSuggestion;
        }

        private Instant latestSeenAt() {
            return latestSeenAt;
        }
    }

    private record MistakeCategory(String key, String displayLabel) {
    }
}
