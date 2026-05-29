package com.writeloop.service;

import com.writeloop.dto.NowInEnglishReflectionEntryDto;
import com.writeloop.dto.NowInEnglishReflectionExpressionDto;
import com.writeloop.dto.NowInEnglishReflectionRequestDto;
import com.writeloop.dto.NowInEnglishReflectionResponseDto;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NowInEnglishReflectionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(NowInEnglishReflectionService.class);
    private static final int MAX_ENTRIES = 30;
    private static final int MAX_ENTRY_LENGTH = 500;
    private static final int MAX_TOTAL_TEXT_LENGTH = 6000;

    private final OpenAiNowInEnglishReflectionClient openAiClient;

    public NowInEnglishReflectionResponseDto reflect(NowInEnglishReflectionRequestDto request) {
        String dateKey = normalizeDateKey(request == null ? null : request.dateKey());
        List<NowInEnglishReflectionEntryDto> entries = normalizeEntries(request == null ? null : request.entries());

        if (openAiClient.isConfigured()) {
            try {
                return normalizeResponse(openAiClient.reflect(dateKey, entries), dateKey, entries);
            } catch (RuntimeException exception) {
                LOGGER.warn(
                        "Now-in-English reflection fell back to deterministic response dateKey={} entryCount={} exceptionClass={}",
                        dateKey,
                        entries.size(),
                        exception.getClass().getName()
                );
            }
        }

        return fallbackReflection(dateKey, entries);
    }

    private String normalizeDateKey(String value) {
        String normalized = value == null ? "" : value.trim();
        if (!normalized.matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new IllegalArgumentException("dateKey must be yyyy-MM-dd");
        }
        return normalized;
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

            totalLength += text.length();
            if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
                throw new IllegalArgumentException("entries text is too long");
            }

            normalizedEntries.add(new NowInEnglishReflectionEntryDto(text, normalizeText(entry.createdAt())));
            if (normalizedEntries.size() >= MAX_ENTRIES) {
                break;
            }
        }

        if (normalizedEntries.isEmpty()) {
            throw new IllegalArgumentException("entries is required");
        }

        return List.copyOf(normalizedEntries);
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
                "어제의 영어 조각",
                "어제 남긴 짧은 문장들이 하루의 작은 흐름처럼 남아 있어요. 오늘은 그중 한 장면을 조금 더 길게 이어 써보면 좋아요.",
                List.of(
                        entries.size() + "개의 순간을 영어로 붙잡아 두었어요.",
                        representative.isBlank()
                                ? "짧게라도 영어로 꺼낸 점이 좋아요."
                                : "대표 문장은 \"" + truncate(representative, 60) + "\"예요.",
                        "오늘은 장소, 감정, 이유 중 하나를 더 붙이면 더 선명해져요."
                ),
                "짧은 현재 상황을 영어로 남기는 리듬이 보였어요.",
                "문장을 고치기보다, 다음에는 because나 when으로 이유와 상황을 하나 덧붙여 보세요.",
                "오늘 첫 문장에는 지금 있는 장소나 기분을 하나 더 넣어 보세요.",
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
                "오늘도 완벽하게 쓰기보다 한 순간만 영어로 잡아보세요."
        );
    }

    private String firstNonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
