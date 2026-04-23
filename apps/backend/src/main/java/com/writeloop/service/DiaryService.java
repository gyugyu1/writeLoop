package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CreateDiaryEntryRequestDto;
import com.writeloop.dto.DiaryAnswerBand;
import com.writeloop.dto.DiaryAttemptDto;
import com.writeloop.dto.DiaryCorrectionPointDto;
import com.writeloop.dto.DiaryEntryDto;
import com.writeloop.dto.DiaryExpressionDto;
import com.writeloop.dto.DiaryFeedbackRequestDto;
import com.writeloop.dto.DiaryFeedbackResponseDto;
import com.writeloop.dto.DiaryFlowDto;
import com.writeloop.dto.DiaryMissionDto;
import com.writeloop.dto.DiaryRewriteIdeaDto;
import com.writeloop.dto.UpdateDiaryEntryRequestDto;
import com.writeloop.persistence.DiaryAttemptEntity;
import com.writeloop.persistence.DiaryAttemptRepository;
import com.writeloop.persistence.DiaryEntryEntity;
import com.writeloop.persistence.DiaryEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<DiaryCorrectionPointDto>> DIARY_CORRECTION_LIST_TYPE =
            new TypeReference<>() {
            };

    private final DiaryEntryRepository diaryEntryRepository;
    private final DiaryAttemptRepository diaryAttemptRepository;
    private final LlmDiaryFeedbackClient diaryFeedbackClient;
    private final ObjectMapper objectMapper;
    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    public DiaryEntryDto createEntry(Long userId, CreateDiaryEntryRequestDto request) {
        DiaryEntryEntity entry = new DiaryEntryEntity(
                UUID.randomUUID().toString(),
                userId,
                normalizeText(request.title()),
                normalizeContent(request.content()),
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
            entry.setContent(normalizeContent(request.content()));
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
        String requestedText = request == null ? "" : normalizeContent(request.bodyText());
        String diaryText = requestedText.isBlank() ? normalizeContent(entry.getContent()) : requestedText;
        if (diaryText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Diary text is required for feedback");
        }

        if (!diaryText.equals(normalizeContent(entry.getContent())) || entry.isDraft()) {
            entry.setContent(diaryText);
            entry.setDraft(false);
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
        DiaryFeedbackResponseDto feedback = reviewDiaryEntry(entry, diaryText, attemptNo, previousText)
                .withIdentity(entryId, attemptNo);
        logDiaryFeedbackTiming("llm_feedback", entryId, attemptNo, phaseStartedAtNanos);

        phaseStartedAtNanos = System.nanoTime();
        DiaryAttemptEntity savedAttempt = diaryAttemptRepository.save(new DiaryAttemptEntity(
                entryId,
                attemptNo,
                diaryText,
                feedback.score(),
                feedback.diaryAnswerBand().name(),
                feedback.schemaVersion(),
                resolveFeedbackProvider(),
                null,
                safeText(feedback.summaryKo()),
                toJsonString(feedback.strengths()),
                toJsonString(feedback.fixPoints()),
                safeText(firstNonBlank(feedback.modelDiary(), feedback.correctedDiary(), diaryText)),
                safeText(feedback.nextDiaryMission().instructionKo()),
                toJsonString(feedback)
        ));
        setDiaryTimingAttemptId(savedAttempt.getId());
        logDiaryFeedbackTiming("persist", entryId, attemptNo, phaseStartedAtNanos);

        DiaryFeedbackResponseDto response = feedback.withIdentity(entryId, savedAttempt.getAttemptNo());
        logDiaryFeedbackTiming("total", entryId, attemptNo, totalStartedAtNanos);
        return response;
        } finally {
            clearDiaryTimingTrace();
        }
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

    private DiaryFeedbackResponseDto reviewDiaryEntry(
            DiaryEntryEntity entry,
            String diaryText,
            int attemptNo,
            String previousText
    ) {
        DiaryFeedbackPromptContext context = new DiaryFeedbackPromptContext(
                entry.getId(),
                attemptNo,
                entry.getTitle(),
                entry.getEntryDate(),
                entry.getMood(),
                diaryText,
                previousText
        );

        if (diaryFeedbackClient.isConfigured()) {
            try {
                return diaryFeedbackClient.review(context);
            } catch (RuntimeException exception) {
                log.warn("Diary feedback LLM failed for entry {}. Falling back to local diary feedback.",
                        entry.getId(), exception);
            }
        }
        return buildFallbackFeedback(entry.getId(), diaryText, attemptNo);
    }

    private DiaryFeedbackResponseDto buildFallbackFeedback(String entryId, String diaryText, int attemptNo) {
        int wordCount = countWords(diaryText);
        DiaryAnswerBand answerBand = resolveFallbackAnswerBand(diaryText, wordCount);
        int score = Math.max(20, Math.min(92, 52 + Math.min(wordCount, 25)));
        boolean finishable = answerBand == DiaryAnswerBand.DIARY_CLEAR_BASIC
                || answerBand == DiaryAnswerBand.DIARY_NATURAL_COMPLETE;
        String summary = switch (answerBand) {
            case DIARY_TOO_SHORT -> "아직 일기로 보기에는 짧아요. 오늘 한 일과 기분을 한 문장씩 더 붙여보면 좋아요.";
            case DIARY_NOT_ENGLISH -> "영어 문장이 충분하지 않아요. 오늘 있었던 일을 쉬운 영어 한두 문장으로 먼저 바꿔보세요.";
            case DIARY_FLOW_THIN -> "핵심 내용은 보이지만 시간 흐름이나 감정이 조금 더 들어가면 일기답게 좋아져요.";
            default -> "일기의 흐름이 잘 보입니다. 몇 군데 표현만 더 자연스럽게 다듬으면 좋아요.";
        };
        List<String> strengths = wordCount < 8
                ? List.of("오늘의 내용을 영어로 시작한 점이 좋아요.")
                : List.of("하루에 있었던 일을 직접 영어로 정리했어요.", "문장의 기본 의미가 잘 전달돼요.");
        List<DiaryCorrectionPointDto> fixPoints = wordCount < 8
                ? List.of(new DiaryCorrectionPointDto(
                "DETAIL",
                "일기 내용 늘리기",
                diaryText,
                diaryText,
                "일기는 사건, 기분, 결과 중 한 가지를 더 붙이면 훨씬 자연스러워져요.",
                "Today, I stayed home and felt relaxed."
        ))
                : List.of();

        return new DiaryFeedbackResponseDto(
                DIARY_SCHEMA_VERSION,
                entryId,
                attemptNo,
                score,
                finishable,
                answerBand,
                summary,
                strengths,
                diaryText,
                diaryText,
                "",
                fixPoints,
                new DiaryFlowDto(
                        "오늘 있었던 일을 시간 순서로 조금 더 이어보세요.",
                        "그때 느낀 감정을 한 단어라도 넣어보세요.",
                        "장소, 사람, 이유 중 하나를 더하면 장면이 선명해져요.",
                        "마지막에 배운 점이나 내일 하고 싶은 일을 붙이면 일기답게 마무리돼요.",
                        "일기에서는 사건만 나열하기보다 감정과 결과가 함께 있으면 더 자연스러워요.",
                        List.of("After that", "Then", "When I got home")
                ),
                List.of(new DiaryRewriteIdeaDto(
                        "감정 한 문장 더하기",
                        "I felt a little better after that.",
                        "그 후에 조금 나아졌어요.",
                        "오늘 일어난 일 뒤에 느낀 점을 붙여보세요.",
                        "I felt tired, but I was happy to finish my day."
                )),
                List.of(),
                List.of(
                        new DiaryExpressionDto(
                                "After that",
                                "그 후에",
                                "After that, I went home and rested.",
                                "일기에서 다음 일을 이어 말할 때 좋아요.",
                                List.of("시간 흐름", "일기 표현")
                        ),
                        new DiaryExpressionDto(
                                "I felt",
                                "나는 ~하게 느꼈다",
                                "I felt tired but happy.",
                                "하루의 감정을 짧게 말할 때 쓸 수 있어요.",
                                List.of("감정 표현", "일기 표현")
                        )
                ),
                new DiaryMissionDto(
                        "DETAIL",
                        "디테일 한 문장 추가",
                        "오늘 있었던 일 뒤에 기분이나 이유를 한 문장 더 붙여 다시 써보세요.",
                        "After that, I felt..."
                ),
                List.of("LOCAL_FALLBACK")
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
            return diaryFeedbackClient.isConfigured() ? diaryFeedbackClient.provider() : "local-fallback";
        } catch (RuntimeException exception) {
            return "local-fallback";
        }
    }

    private DiaryAnswerBand resolveFallbackAnswerBand(String diaryText, int wordCount) {
        if (wordCount < 4) {
            return DiaryAnswerBand.DIARY_TOO_SHORT;
        }
        if (!containsAsciiLetter(diaryText)) {
            return DiaryAnswerBand.DIARY_NOT_ENGLISH;
        }
        if (wordCount < 16) {
            return DiaryAnswerBand.DIARY_FLOW_THIN;
        }
        return DiaryAnswerBand.DIARY_CLEAR_BASIC;
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

    private boolean containsAsciiLetter(String value) {
        return value != null && value.chars().anyMatch(character ->
                (character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z'));
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

    private int countWords(String value) {
        if (value == null) {
            return 0;
        }
        String normalized = value.trim();
        if (normalized.isBlank()) {
            return 0;
        }
        return normalized.split("\\s+").length;
    }
}
