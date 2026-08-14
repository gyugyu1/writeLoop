package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.NowInEnglishReflectionEntryDto;
import com.writeloop.dto.NowInEnglishReflectionExpressionDto;
import com.writeloop.dto.NowInEnglishReflectionRequestDto;
import com.writeloop.dto.NowInEnglishReflectionResponseDto;
import com.writeloop.persistence.NowInEnglishEntryEntity;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import com.writeloop.persistence.NowInEnglishReflectionEntity;
import com.writeloop.persistence.NowInEnglishReflectionRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class NowInEnglishReflectionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(NowInEnglishReflectionService.class);
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<NowInEnglishReflectionExpressionDto>> EXPRESSION_LIST_TYPE = new TypeReference<>() {
    };
    private static final int MAX_ENTRIES = 30;
    private static final int MAX_ENTRY_LENGTH = 500;
    private static final int MAX_TOTAL_TEXT_LENGTH = 6000;

    private final ObjectMapper objectMapper;
    private final OpenAiNowInEnglishReflectionClient openAiClient;
    private final NowInEnglishEntryRepository nowInEnglishEntryRepository;
    private final NowInEnglishReflectionRepository nowInEnglishReflectionRepository;
    private final FeedbackTimingRecorder feedbackTimingRecorder;

    @Transactional(readOnly = true)
    public Optional<NowInEnglishReflectionResponseDto> getSavedReflection(Long userId, String rawDateKey) {
        String dateKey = normalizeDateKey(rawDateKey);
        LocalDate reflectionDate = LocalDate.parse(dateKey);
        return nowInEnglishReflectionRepository.findByUserIdAndReflectionDate(userId, reflectionDate)
                .map(this::toDto);
    }

    public NowInEnglishReflectionResponseDto reflectAndStore(Long userId, NowInEnglishReflectionRequestDto request) {
        long totalStartedAtNanos = System.nanoTime();
        feedbackTimingRecorder.beginNowInEnglishTrace(userId, "REFLECTION");
        try {
            long prepareStartedAtNanos = System.nanoTime();
            String dateKey = normalizeDateKey(request == null ? null : request.dateKey());
            LocalDate reflectionDate = LocalDate.parse(dateKey);
            List<NowInEnglishReflectionEntryDto> entries = loadStoredEntries(userId, reflectionDate);
            String entrySignature = buildEntrySignature(entries);
            boolean forceRefresh = request != null && Boolean.TRUE.equals(request.forceRefresh());

            Optional<NowInEnglishReflectionEntity> existingReflection =
                    nowInEnglishReflectionRepository.findByUserIdAndReflectionDate(userId, reflectionDate);
            feedbackTimingRecorder.recordServicePhase("prepare", elapsedMs(prepareStartedAtNanos));
            if (!forceRefresh && existingReflection
                    .filter(reflection -> entrySignature.equals(reflection.getEntrySignature()))
                    .isPresent()) {
                feedbackTimingRecorder.recordPolicyEvent("cache_hit", Map.of(
                        "dateKey", dateKey,
                        "entryCount", entries.size()
                ));
                return toDto(existingReflection.get());
            }

            NowInEnglishReflectionResponseDto response = reflect(dateKey, entries);
            long persistStartedAtNanos = System.nanoTime();
            NowInEnglishReflectionEntity reflection = nowInEnglishReflectionRepository
                    .findByUserIdAndReflectionDate(userId, reflectionDate)
                    .orElseGet(() -> new NowInEnglishReflectionEntity(userId, reflectionDate));
            reflection.updateReflection(
                    entries.size(),
                    entrySignature,
                    response.headlineKo(),
                    response.summaryKo(),
                    writeJson(response.highlightsKo()),
                    response.patternKo(),
                    response.gentleCorrectionKo(),
                    response.nextActionKo(),
                    response.nextActionExampleEn(),
                    writeJson(response.expressions()),
                    response.closingKo()
            );
            NowInEnglishReflectionResponseDto savedResponse =
                    toDto(nowInEnglishReflectionRepository.save(reflection));
            feedbackTimingRecorder.recordServicePhase("persist", elapsedMs(persistStartedAtNanos));
            return savedResponse;
        } finally {
            feedbackTimingRecorder.recordServicePhase("total", elapsedMs(totalStartedAtNanos));
            feedbackTimingRecorder.clearTrace();
        }
    }

    public NowInEnglishReflectionResponseDto reflect(NowInEnglishReflectionRequestDto request) {
        long totalStartedAtNanos = System.nanoTime();
        feedbackTimingRecorder.beginNowInEnglishTrace(null, "REFLECTION");
        try {
            long prepareStartedAtNanos = System.nanoTime();
            String dateKey = normalizeDateKey(request == null ? null : request.dateKey());
            List<NowInEnglishReflectionEntryDto> entries =
                    normalizeEntries(request == null ? null : request.entries());
            feedbackTimingRecorder.recordServicePhase("prepare", elapsedMs(prepareStartedAtNanos));
            return reflect(dateKey, entries);
        } finally {
            feedbackTimingRecorder.recordServicePhase("total", elapsedMs(totalStartedAtNanos));
            feedbackTimingRecorder.clearTrace();
        }
    }

    private NowInEnglishReflectionResponseDto reflect(String dateKey, List<NowInEnglishReflectionEntryDto> entries) {
        if (openAiClient.isConfigured()) {
            try {
                return normalizeResponse(openAiClient.reflect(dateKey, entries), dateKey, entries);
            } catch (RuntimeException exception) {
                feedbackTimingRecorder.recordPolicyEvent("fallback", Map.of(
                        "reason", "llm_failure",
                        "exceptionClass", exception.getClass().getName(),
                        "dateKey", dateKey,
                        "entryCount", entries.size()
                ));
                LOGGER.warn(
                        "Now-in-English reflection fell back to deterministic response dateKey={} entryCount={} exceptionClass={}",
                        dateKey,
                        entries.size(),
                        exception.getClass().getName()
                );
            }
        } else {
            feedbackTimingRecorder.recordPolicyEvent("fallback", Map.of(
                    "reason", "provider_not_configured",
                    "dateKey", dateKey,
                    "entryCount", entries.size()
            ));
        }

        return fallbackReflection(dateKey, entries);
    }

    private long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private String normalizeDateKey(String value) {
        String normalized = value == null ? "" : value.trim();
        if (!normalized.matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new IllegalArgumentException("dateKey must be yyyy-MM-dd");
        }
        try {
            return LocalDate.parse(normalized).toString();
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("dateKey must be yyyy-MM-dd");
        }
    }

    private List<NowInEnglishReflectionEntryDto> normalizeEntries(List<NowInEnglishReflectionEntryDto> entries) {
        if (entries == null || entries.isEmpty()) {
            throw new IllegalArgumentException("entries is required");
        }

        List<NowInEnglishReflectionEntryDto> normalizedEntries = new ArrayList<>();
        int totalLength = 0;
        for (NowInEnglishReflectionEntryDto entry : entries) {
            if (entry == null) {
                continue;
            }

            String text = normalizeText(entry.text());
            if (text.isBlank()) {
                continue;
            }
            if (text.length() > MAX_ENTRY_LENGTH) {
                throw new IllegalArgumentException("entry text is too long");
            }

            totalLength += text.length();
            if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
                throw new IllegalArgumentException("entries text is too long");
            }

            normalizedEntries.add(new NowInEnglishReflectionEntryDto(text, truncate(entry.createdAt(), 80)));
            if (normalizedEntries.size() >= MAX_ENTRIES) {
                break;
            }
        }

        if (normalizedEntries.isEmpty()) {
            throw new IllegalArgumentException("entries is required");
        }

        return List.copyOf(normalizedEntries);
    }

    private List<NowInEnglishReflectionEntryDto> loadStoredEntries(Long userId, LocalDate reflectionDate) {
        List<NowInEnglishReflectionEntryDto> entries = nowInEnglishEntryRepository
                .findByUserIdAndEntryDateOrderByCreatedAtAsc(userId, reflectionDate)
                .stream()
                .map(this::toReflectionEntry)
                .toList();
        return normalizeEntries(entries);
    }

    private NowInEnglishReflectionEntryDto toReflectionEntry(NowInEnglishEntryEntity entry) {
        return new NowInEnglishReflectionEntryDto(
                entry.getText(),
                entry.getCreatedAt() == null ? "" : entry.getCreatedAt().toString()
        );
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private String truncate(String value, int maxLength) {
        String normalized = normalizeText(value);
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength).trim();
    }

    private String buildEntrySignature(List<NowInEnglishReflectionEntryDto> entries) {
        String joinedEntries = entries.stream()
                .map(entry -> normalizeText(entry.createdAt()) + "\n" + normalizeText(entry.text()))
                .reduce("", (left, right) -> left + "\u001F" + right);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(joinedEntries.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte value : hash) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to create now-in-English reflection signature", exception);
        }
    }

    private NowInEnglishReflectionResponseDto normalizeResponse(
            NowInEnglishReflectionResponseDto response,
            String dateKey,
            List<NowInEnglishReflectionEntryDto> entries
    ) {
        NowInEnglishReflectionResponseDto fallback = fallbackReflection(dateKey, entries);
        if (response == null) {
            return fallback;
        }

        List<String> highlights = response.highlightsKo().isEmpty()
                ? fallback.highlightsKo()
                : response.highlightsKo().stream()
                .map(value -> truncate(value, 90))
                .filter(value -> !value.isBlank())
                .limit(3)
                .toList();

        List<NowInEnglishReflectionExpressionDto> expressions = response.expressions().isEmpty()
                ? fallback.expressions()
                : response.expressions().stream()
                .filter(expression -> expression != null && !expression.expression().isBlank())
                .limit(3)
                .toList();

        return new NowInEnglishReflectionResponseDto(
                dateKey,
                entries.size(),
                firstNonBlank(truncate(response.headlineKo(), 32), fallback.headlineKo()),
                firstNonBlank(truncate(response.summaryKo(), 260), fallback.summaryKo()),
                highlights.isEmpty() ? fallback.highlightsKo() : highlights,
                firstNonBlank(truncate(response.patternKo(), 120), fallback.patternKo()),
                firstNonBlank(truncate(response.gentleCorrectionKo(), 140), fallback.gentleCorrectionKo()),
                firstNonBlank(truncate(response.nextActionKo(), 140), fallback.nextActionKo()),
                firstNonBlank(truncate(response.nextActionExampleEn(), 160), fallback.nextActionExampleEn()),
                expressions,
                firstNonBlank(truncate(response.closingKo(), 90), fallback.closingKo())
        );
    }

    private NowInEnglishReflectionResponseDto fallbackReflection(
            String dateKey,
            List<NowInEnglishReflectionEntryDto> entries
    ) {
        String representative = entries.stream()
                .map(NowInEnglishReflectionEntryDto::text)
                .max((left, right) -> Integer.compare(left.length(), right.length()))
                .orElse("");

        return new NowInEnglishReflectionResponseDto(
                dateKey,
                entries.size(),
                "이 날의 영어 조각",
                "이 날 남긴 짧은 문장들이 하루의 작은 흐름처럼 남아 있어요. 다음에는 그중 한 장면을 조금 더 길게 이어 써보면 좋아요.",
                List.of(
                        entries.size() + "개의 순간을 영어로 붙잡아 두었어요.",
                        representative.isBlank()
                                ? "짧게라도 영어로 꺼낸 점이 좋아요."
                                : "대표 문장은 \"" + truncate(representative, 60) + "\"예요.",
                        "다음에는 장소, 감정, 이유 중 하나를 더 붙이면 더 선명해져요."
                ),
                "짧은 현재 상황을 영어로 남기는 리듬이 보였어요.",
                "문장을 고치기보다, 다음에는 because나 when으로 이유와 상황을 하나 덧붙여 보세요.",
                "다음 한 줄에는 지금 있는 장소나 기분을 하나 더 넣어 보세요.",
                "I am taking a short break because I feel a little tired.",
                List.of(
                        new NowInEnglishReflectionExpressionDto(
                                "take a short break",
                                "잠깐 쉬다",
                                "지금 쉬고 있는 순간을 말할 때 좋아요.",
                                "I am taking a short break after lunch."
                        ),
                        new NowInEnglishReflectionExpressionDto(
                                "think about",
                                "무엇을 생각하다",
                                "떠오른 생각을 짧게 남길 때 바로 쓸 수 있어요.",
                                "I am thinking about dinner."
                        ),
                        new NowInEnglishReflectionExpressionDto(
                                "because I feel",
                                "내가 느끼기에 / 기분이 그래서",
                                "짧은 이유나 감정을 덧붙일 때 자연스러워요.",
                                "I want to rest because I feel tired."
                        )
                ),
                "완벽하게 쓰기보다 한 순간만 영어로 잡아보세요."
        );
    }

    private String firstNonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private NowInEnglishReflectionResponseDto toDto(NowInEnglishReflectionEntity reflection) {
        return new NowInEnglishReflectionResponseDto(
                reflection.getReflectionDate().toString(),
                reflection.getEntryCount(),
                reflection.getHeadlineKo(),
                reflection.getSummaryKo(),
                readStringList(reflection.getHighlightsJson()),
                reflection.getPatternKo(),
                reflection.getGentleCorrectionKo(),
                reflection.getNextActionKo(),
                reflection.getNextActionExampleEn(),
                readExpressions(reflection.getExpressionsJson()),
                reflection.getClosingKo()
        );
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? List.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize now-in-English reflection", exception);
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (Exception exception) {
            return List.of();
        }
    }

    private List<NowInEnglishReflectionExpressionDto> readExpressions(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, EXPRESSION_LIST_TYPE);
        } catch (Exception exception) {
            return List.of();
        }
    }
}
