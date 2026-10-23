package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CreateDiaryEntryRequestDto;
import com.writeloop.dto.DiaryAnswerBand;
import com.writeloop.dto.DiaryAttemptDto;
import com.writeloop.dto.DiaryCalendarDayDto;
import com.writeloop.dto.DiaryCalendarSummaryDto;
import com.writeloop.dto.DiaryCorrectionPointDto;
import com.writeloop.dto.DiaryEntryDto;
import com.writeloop.dto.DiaryFeedbackRequestDto;
import com.writeloop.dto.DiaryFeedbackResponseDto;
import com.writeloop.dto.DiaryFlowDto;
import com.writeloop.dto.DiaryMissionDto;
import com.writeloop.dto.UpdateDiaryEntryRequestDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.DiaryAttemptEntity;
import com.writeloop.persistence.DiaryAttemptRepository;
import com.writeloop.persistence.DiaryCalendarEntryProjection;
import com.writeloop.persistence.DiaryEntryEntity;
import com.writeloop.persistence.DiaryEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiaryService {

    private static final String DIARY_SCHEMA_VERSION = "diary-feedback-v1";
    private static final int MAX_ATTEMPT_SAVE_TRIES = 3;
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<DiaryCorrectionPointDto>> DIARY_CORRECTION_LIST_TYPE =
            new TypeReference<>() {
            };
    private static final ZoneId SEOUL_ZONE_ID = ZoneId.of("Asia/Seoul");

    private final DiaryEntryRepository diaryEntryRepository;
    private final DiaryAttemptRepository diaryAttemptRepository;
    private final LlmDiaryFeedbackClient diaryFeedbackClient;
    private final ObjectMapper objectMapper;
    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    @Value("${app.diary.max-content-chars:4000}")
    private int maxDiaryContentChars;

    public DiaryEntryDto createEntry(Long userId, CreateDiaryEntryRequestDto request) {
        DiaryEntryEntity entry = new DiaryEntryEntity(
                UUID.randomUUID().toString(),
                userId,
                normalizeText(request.title()),
                normalizeDiaryContent(request.content()),
                normalizeLanguage(request.language()),
                request.entryDate(),
                normalizeText(request.mood()),
                serializeTags(request.tags()),
                request.draft() == null || request.draft()
        );
        DiaryEntryEntity savedEntry = diaryEntryRepository.save(entry);
        return toEntryDto(savedEntry, List.of());
    }

    public DiaryEntryDto updateEntry(Long userId, String entryId, UpdateDiaryEntryRequestDto request) {
        DiaryEntryEntity entry = requireOwnedEntry(userId, entryId);

        if (request.title() != null) {
            entry.setTitle(normalizeText(request.title()));
        }
        if (request.content() != null) {
            entry.setContent(normalizeDiaryContent(request.content()));
        }
        if (request.language() != null) {
            entry.setLanguage(normalizeLanguage(request.language()));
        }
        if (request.entryDate() != null) {
            entry.setEntryDate(request.entryDate());
        }
        if (request.mood() != null) {
            entry.setMood(normalizeText(request.mood()));
        }
        if (request.tags() != null) {
            entry.setTagsJson(serializeTags(request.tags()));
        }
        if (request.draft() != null) {
            entry.setDraft(request.draft());
        }

        DiaryEntryEntity savedEntry = diaryEntryRepository.save(entry);
        return toEntryDto(savedEntry, loadAttemptsForEntry(savedEntry.getId()));
    }

    public List<DiaryEntryDto> listEntries(Long userId) {
        List<DiaryEntryEntity> entries = diaryEntryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (entries.isEmpty()) {
            return List.of();
        }

        Map<String, List<DiaryAttemptEntity>> attemptsByEntryId = loadAttemptsByEntryIds(
                entries.stream().map(DiaryEntryEntity::getId).toList()
        );

        return entries.stream()
                .map(entry -> toEntryDto(entry, attemptsByEntryId.getOrDefault(entry.getId(), List.of())))
                .toList();
    }

    public DiaryEntryDto getEntry(Long userId, String entryId) {
        DiaryEntryEntity entry = requireOwnedEntry(userId, entryId);
        return toEntryDto(entry, loadAttemptsForEntry(entryId));
    }

    public DiaryCalendarSummaryDto getCalendarSummary(Long userId) {
        long totalEntries = diaryEntryRepository.countByUserId(userId);
        Map<LocalDate, DiaryCalendarDayAccumulator> daysByDate = new java.util.LinkedHashMap<>();

        for (DiaryCalendarEntryProjection entry : diaryEntryRepository.findCalendarEntriesByUserId(userId)) {
            LocalDate date = resolveDiaryCalendarDate(entry);
            daysByDate.compute(date, (key, current) -> {
                if (current == null) {
                    return new DiaryCalendarDayAccumulator(entry.getId(), 1);
                }
                current.increment();
                return current;
            });
        }

        List<DiaryCalendarDayDto> days = daysByDate.entrySet().stream()
                .map(item -> new DiaryCalendarDayDto(
                        item.getKey(),
                        item.getValue().entryId(),
                        item.getValue().entryCount()
                ))
                .toList();

        return new DiaryCalendarSummaryDto(totalEntries, days);
    }

    public void deleteEntry(Long userId, String entryId) {
        DiaryEntryEntity entry = requireOwnedEntry(userId, entryId);
        diaryEntryRepository.delete(entry);
    }

    public DiaryFeedbackResponseDto generateFeedback(
            Long userId,
            String entryId,
            DiaryFeedbackRequestDto request
    ) {
        long totalStartedAtNanos = System.nanoTime();
        long phaseStartedAtNanos = totalStartedAtNanos;
        DiaryEntryEntity entry = requireOwnedEntry(userId, entryId);
        String requestedText = request == null ? "" : normalizeDiaryContent(request.bodyText());
        String diaryText = requestedText.isBlank() ? normalizeDiaryContent(entry.getContent()) : requestedText;
        if (diaryText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Diary text is required for feedback");
        }

        // 쓴 일기는 피드백 결과와 관계없이 먼저 저장한다. 제출 상태(draft=false)는 피드백을 받은 뒤에 바꾼다.
        // LLM이 실패했을 때 일기가 제출 상태로 잠기지 않게 하려는 것이다.
        if (!diaryText.equals(normalizeContent(entry.getContent()))) {
            entry.setContent(diaryText);
            diaryEntryRepository.save(entry);
        }

        int attemptNo = diaryAttemptRepository.countByEntryId(entryId) + 1;
        String previousText = diaryAttemptRepository.findByEntryIdAndAttemptNo(entryId, attemptNo - 1)
                .map(DiaryAttemptEntity::getDiaryText)
                .orElse(null);
        beginDiaryTimingTrace(userId, entryId, attemptNo);
        try {
        logDiaryFeedbackTiming("prepare", entryId, attemptNo, phaseStartedAtNanos);

        phaseStartedAtNanos = System.nanoTime();
        DiaryFeedbackResponseDto feedback = reviewDiaryEntry(
                entry,
                diaryText,
                attemptNo,
                previousText,
                request != null && request.wantsFullDiaries()
        )
                .withIdentity(entryId, attemptNo)
                .withFinishableFromBand();
        logDiaryFeedbackTiming("llm_feedback", entryId, attemptNo, phaseStartedAtNanos);
        if (entry.isDraft()) {
            entry.setDraft(false);
            diaryEntryRepository.save(entry);
        }

        phaseStartedAtNanos = System.nanoTime();
        DiaryFeedbackResponseDto response = persistAttempt(entryId, diaryText, feedback, attemptNo);
        logDiaryFeedbackTiming("persist", entryId, attemptNo, phaseStartedAtNanos);
        logDiaryFeedbackTiming("total", entryId, attemptNo, totalStartedAtNanos);
        return response;
        } finally {
            clearDiaryTimingTrace();
        }
    }

    // 시도 번호는 저장할 때 다시 정한다. 앱이 시간 초과로 끊은 뒤 다시 보내면 첫 요청이 아직 돌고 있어서,
    // LLM을 부르기 전에 정한 번호를 그 요청이 먼저 쓸 수 있다(uq_diary_attempts_entry_attempt_no).
    // 겹친 요청이 같은 일기로 먼저 저장했으면 하나 더 저장하지 않고 그 시도를 돌려준다.
    private DiaryFeedbackResponseDto persistAttempt(
            String entryId,
            String diaryText,
            DiaryFeedbackResponseDto feedback,
            int plannedAttemptNo
    ) {
        for (int tries = 0; tries < MAX_ATTEMPT_SAVE_TRIES; tries++) {
            int attemptNo = Math.max(plannedAttemptNo, diaryAttemptRepository.countByEntryId(entryId) + 1);
            if (attemptNo > plannedAttemptNo) {
                Optional<DiaryFeedbackResponseDto> concurrent = diaryAttemptRepository
                        .findByEntryIdAndAttemptNo(entryId, attemptNo - 1)
                        .filter(saved -> diaryText.equals(saved.getDiaryText()))
                        .flatMap(this::readFeedbackPayload);
                if (concurrent.isPresent()) {
                    return concurrent.get();
                }
            }
            try {
                DiaryAttemptEntity savedAttempt = diaryAttemptRepository.save(newAttempt(entryId, attemptNo, diaryText, feedback));
                setDiaryTimingAttemptId(savedAttempt.getId());
                return feedback.withIdentity(entryId, savedAttempt.getAttemptNo());
            } catch (DataIntegrityViolationException exception) {
                log.info("Diary attempt number {} for entry {} was taken by a concurrent request; retrying", attemptNo, entryId);
            }
        }
        throw new ApiException(
                HttpStatus.CONFLICT,
                "DIARY_FEEDBACK_CONFLICT",
                "다른 요청과 겹쳐 피드백을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
        );
    }

    private DiaryAttemptEntity newAttempt(String entryId, int attemptNo, String diaryText, DiaryFeedbackResponseDto feedback) {
        return new DiaryAttemptEntity(
                entryId,
                attemptNo,
                diaryText,
                feedback.score(),
                feedback.diaryAnswerBand().name(),
                feedback.schemaVersion(),
                resolveFeedbackProvider(),
                resolveFeedbackModel(),
                safeText(feedback.summaryKo()),
                toJsonString(feedback.strengths()),
                toJsonString(feedback.fixPoints()),
                safeText(firstNonBlank(feedback.modelDiary(), feedback.correctedDiary(), diaryText)),
                safeText(feedback.nextDiaryMission().instructionKo()),
                toJsonString(feedback)
        );
    }

    private void beginDiaryTimingTrace(Long userId, String entryId, int attemptNo) {
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.beginDiaryTrace(userId, entryId, attemptNo);
        }
    }

    private void setDiaryTimingAttemptId(Long diaryAttemptId) {
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.setDiaryAttemptId(diaryAttemptId);
        }
    }

    private void clearDiaryTimingTrace() {
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.clearTrace();
        }
    }

    private void logDiaryFeedbackTiming(String phase, String entryId, int attemptNo, long startedAtNanos) {
        long elapsedMs = elapsedMs(startedAtNanos);
        log.info(
                "Diary feedback timing phase={} entryId={} attemptNo={} elapsedMs={}",
                phase,
                entryId,
                attemptNo,
                elapsedMs
        );
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.recordServicePhase(phase, elapsedMs);
        }
    }

    private static long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    // LLM이 실패하면 단어 수로 점수를 매긴 고정 문구 피드백을 만들지 않고 안내 오류를 돌려준다.
    // 쓴 일기는 이미 저장됐고 시도도 저장하지 않으므로, 학습자는 그대로 다시 요청할 수 있다.
    private DiaryFeedbackResponseDto reviewDiaryEntry(
            DiaryEntryEntity entry,
            String diaryText,
            int attemptNo,
            String previousText,
            boolean includeFullDiaries
    ) {
        DiaryFeedbackPromptContext context = new DiaryFeedbackPromptContext(
                entry.getId(),
                attemptNo,
                entry.getTitle(),
                entry.getEntryDate(),
                entry.getMood(),
                diaryText,
                previousText,
                includeFullDiaries
        );

        if (!diaryFeedbackClient.isConfigured()) {
            throw diaryFeedbackUnavailable();
        }
        try {
            return diaryFeedbackClient.review(context);
        } catch (RuntimeException exception) {
            log.warn("Diary feedback LLM failed for entry {}", entry.getId(), exception);
            throw diaryFeedbackUnavailable();
        }
    }

    private ApiException diaryFeedbackUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "DIARY_FEEDBACK_UNAVAILABLE",
                "지금은 일기 피드백을 만들 수 없어요. 쓴 일기는 저장됐으니 잠시 후 다시 요청해 주세요."
        );
    }

    private Map<String, List<DiaryAttemptEntity>> loadAttemptsByEntryIds(List<String> entryIds) {
        if (entryIds == null || entryIds.isEmpty()) {
            return Map.of();
        }

        return diaryAttemptRepository.findByEntryIdInOrderByCreatedAtAsc(entryIds).stream()
                .collect(Collectors.groupingBy(
                        DiaryAttemptEntity::getEntryId,
                        Collectors.toList()
                ));
    }

    private List<DiaryAttemptEntity> loadAttemptsForEntry(String entryId) {
        return diaryAttemptRepository.findByEntryIdOrderByCreatedAtAsc(entryId);
    }

    private LocalDate resolveDiaryCalendarDate(DiaryCalendarEntryProjection entry) {
        if (entry.getEntryDate() != null) {
            return entry.getEntryDate();
        }
        if (entry.getCreatedAt() != null) {
            return LocalDate.ofInstant(entry.getCreatedAt(), SEOUL_ZONE_ID);
        }
        return LocalDate.now(SEOUL_ZONE_ID);
    }

    private DiaryEntryEntity requireOwnedEntry(Long userId, String entryId) {
        return diaryEntryRepository.findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary entry not found"));
    }

    private DiaryEntryDto toEntryDto(DiaryEntryEntity entry, List<DiaryAttemptEntity> attempts) {
        List<DiaryAttemptDto> attemptDtos = attempts == null ? List.of() : attempts.stream()
                .map(this::toAttemptDto)
                .toList();

        return new DiaryEntryDto(
                entry.getId(),
                entry.getTitle(),
                entry.getContent(),
                entry.getLanguage(),
                entry.getEntryDate(),
                entry.getMood(),
                parseTags(entry.getTagsJson()),
                entry.isDraft(),
                entry.getCreatedAt(),
                entry.getUpdatedAt(),
                attemptDtos
        );
    }

    private DiaryAttemptDto toAttemptDto(DiaryAttemptEntity attempt) {
        DiaryFeedbackResponseDto feedback = readFeedbackPayload(attempt)
                .orElseGet(() -> buildStoredFeedback(attempt));

        return new DiaryAttemptDto(
                attempt.getId(),
                attempt.getAttemptNo(),
                attempt.getDiaryText(),
                attempt.getScore(),
                attempt.getFeedbackSummary(),
                feedback,
                attempt.getCreatedAt()
        );
    }

    private DiaryFeedbackResponseDto buildStoredFeedback(DiaryAttemptEntity attempt) {
        DiaryAnswerBand answerBand = parseDiaryAnswerBand(attempt.getAnswerBand());
        return new DiaryFeedbackResponseDto(
                firstNonBlank(attempt.getFeedbackSchemaVersion(), DIARY_SCHEMA_VERSION),
                attempt.getEntryId(),
                attempt.getAttemptNo() == null ? 0 : attempt.getAttemptNo(),
                attempt.getScore() == null ? 0 : attempt.getScore(),
                answerBand == DiaryAnswerBand.DIARY_CLEAR_BASIC
                        || answerBand == DiaryAnswerBand.DIARY_NATURAL_COMPLETE,
                answerBand,
                safeText(attempt.getFeedbackSummary()),
                parseStringList(attempt.getStrengthsJson()),
                safeText(attempt.getModelAnswer()),
                safeText(attempt.getModelAnswer()),
                "",
                parseCorrectionPoints(attempt.getCorrectionsJson()),
                new DiaryFlowDto("", "", "", "", "", List.of()),
                List.of(),
                List.of(),
                List.of(),
                new DiaryMissionDto("", "다시 써보기", safeText(attempt.getRewriteChallenge()), ""),
                List.of("LEGACY_PAYLOAD")
        );
    }

    private Optional<DiaryFeedbackResponseDto> readFeedbackPayload(DiaryAttemptEntity attempt) {
        if (attempt.getFeedbackPayloadJson() == null || attempt.getFeedbackPayloadJson().isBlank()) {
            return Optional.empty();
        }

        try {
            return Optional.of(objectMapper.readValue(attempt.getFeedbackPayloadJson(), DiaryFeedbackResponseDto.class)
                    .withIdentity(attempt.getEntryId(), attempt.getAttemptNo()));
        } catch (Exception exception) {
            log.warn("Failed to read diary feedback payload for attempt {}", attempt.getId(), exception);
            return Optional.empty();
        }
    }

    private List<String> parseTags(String tagsJson) {
        return parseStringList(tagsJson);
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            List<String> values = objectMapper.readValue(json, STRING_LIST_TYPE);
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .filter(this::isNotBlank)
                    .map(String::trim)
                    .toList();
        } catch (Exception exception) {
            return List.of();
        }
    }

    private List<DiaryCorrectionPointDto> parseCorrectionPoints(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            List<DiaryCorrectionPointDto> values = objectMapper.readValue(json, DIARY_CORRECTION_LIST_TYPE);
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .filter(value -> value != null)
                    .toList();
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String serializeTags(List<String> tags) {
        if (tags == null) {
            return null;
        }

        List<String> normalizedTags = tags.stream()
                .filter(this::isNotBlank)
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .toList();

        return toJsonString(normalizedTags);
    }

    private String toJsonString(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialize diary data", exception);
        }
    }

    private String resolveFeedbackProvider() {
        try {
            return diaryFeedbackClient.provider();
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private String resolveFeedbackModel() {
        try {
            return diaryFeedbackClient.model();
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static final class DiaryCalendarDayAccumulator {
        private final String entryId;
        private int entryCount;

        private DiaryCalendarDayAccumulator(String entryId, int entryCount) {
            this.entryId = entryId;
            this.entryCount = entryCount;
        }

        private String entryId() {
            return entryId;
        }

        private int entryCount() {
            return entryCount;
        }

        private void increment() {
            entryCount += 1;
        }
    }

    private DiaryAnswerBand parseDiaryAnswerBand(String value) {
        if (value == null || value.isBlank()) {
            return DiaryAnswerBand.DIARY_CLEAR_BASIC;
        }

        try {
            return DiaryAnswerBand.valueOf(value.trim());
        } catch (IllegalArgumentException exception) {
            return DiaryAnswerBand.DIARY_CLEAR_BASIC;
        }
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeContent(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeDiaryContent(String value) {
        String normalized = normalizeContent(value);
        int maxContentChars = Math.max(1, maxDiaryContentChars);
        if (normalized.length() > maxContentChars) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "일기는 %,d자 이하로 작성해 주세요.".formatted(maxContentChars)
            );
        }
        return normalized;
    }

    private String normalizeLanguage(String value) {
        if (value == null || value.isBlank()) {
            return "en";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (isNotBlank(value)) {
                return value.trim();
            }
        }
        return "";
    }
}
