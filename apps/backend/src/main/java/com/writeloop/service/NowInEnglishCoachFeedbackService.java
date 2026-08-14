package com.writeloop.service;

import com.writeloop.dto.NowInEnglishCoachFeedbackRequestDto;
import com.writeloop.dto.NowInEnglishCoachFeedbackResponseDto;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NowInEnglishCoachFeedbackService {

    private static final Logger LOGGER = LoggerFactory.getLogger(NowInEnglishCoachFeedbackService.class);
    private static final int MAX_TEXT_LENGTH = 500;

    private final OpenAiNowInEnglishCoachFeedbackClient openAiClient;
    private final FeedbackTimingRecorder feedbackTimingRecorder;

    public NowInEnglishCoachFeedbackResponseDto review(
            Long userId,
            NowInEnglishCoachFeedbackRequestDto request
    ) {
        long totalStartedAtNanos = System.nanoTime();
        feedbackTimingRecorder.beginNowInEnglishTrace(userId, "COACH_FEEDBACK");
        try {
            long prepareStartedAtNanos = System.nanoTime();
            String text = truncate(normalizeText(request == null ? null : request.text()), MAX_TEXT_LENGTH);
            if (text.isBlank()) {
                throw new IllegalArgumentException("text is required");
            }

            String createdAt = truncate(normalizeText(request == null ? null : request.createdAt()), 80);
            feedbackTimingRecorder.recordServicePhase("prepare", elapsedMs(prepareStartedAtNanos));

            if (openAiClient.isConfigured()) {
                try {
                    return normalizeResponse(openAiClient.review(text, createdAt), text);
                } catch (RuntimeException exception) {
                    feedbackTimingRecorder.recordPolicyEvent("fallback", Map.of(
                            "reason", "llm_failure",
                            "exceptionClass", exception.getClass().getName()
                    ));
                    LOGGER.warn(
                            "Now-in-English coach feedback fell back to deterministic response exceptionClass={}",
                            exception.getClass().getName()
                    );
                }
            } else {
                feedbackTimingRecorder.recordPolicyEvent("fallback", Map.of(
                        "reason", "provider_not_configured"
                ));
            }

            return fallbackFeedback(text);
        } finally {
            feedbackTimingRecorder.recordServicePhase("total", elapsedMs(totalStartedAtNanos));
            feedbackTimingRecorder.clearTrace();
        }
    }

    private long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private NowInEnglishCoachFeedbackResponseDto normalizeResponse(
            NowInEnglishCoachFeedbackResponseDto response,
            String originalText
    ) {
        NowInEnglishCoachFeedbackResponseDto fallback = fallbackFeedback(originalText);
        if (response == null) {
            return fallback;
        }

        String suggestionEn = truncate(response.suggestionEn(), 180);
        boolean hasDistinctSuggestion = hasDistinctSuggestion(originalText, suggestionEn);

        return new NowInEnglishCoachFeedbackResponseDto(
                firstNonBlank(truncate(response.originalText(), MAX_TEXT_LENGTH), originalText),
                firstNonBlank(truncate(response.headlineKo(), 70), fallback.headlineKo()),
                firstNonBlank(truncate(response.praiseKo(), 120), fallback.praiseKo()),
                hasDistinctSuggestion ? suggestionEn : "",
                hasDistinctSuggestion ? truncate(response.suggestionTranslationKo(), 140) : "",
                hasDistinctSuggestion ? truncate(response.suggestionKo(), 120) : "",
                firstNonBlank(truncate(response.nextQuestionKo(), 120), fallback.nextQuestionKo()),
                firstNonBlank(truncate(response.expression(), 80), fallback.expression()),
                firstNonBlank(truncate(response.expressionMeaningKo(), 100), fallback.expressionMeaningKo()),
                firstNonBlank(truncate(response.expressionExampleEn(), 160), fallback.expressionExampleEn())
        );
    }

    private NowInEnglishCoachFeedbackResponseDto fallbackFeedback(String originalText) {
        return new NowInEnglishCoachFeedbackResponseDto(
                originalText,
                "좋아요, 한 줄이 남았어요.",
                "지금 떠오른 생각을 영어로 바로 붙잡은 점이 좋아요.",
                "",
                "",
                "",
                "어디에서, 왜 그런지 하나만 더 붙여볼까요?",
                "right now",
                "바로 지금",
                "I am writing this right now."
        );
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private boolean hasDistinctSuggestion(String originalText, String suggestionEn) {
        String normalizedSuggestion = normalizeSuggestionComparison(suggestionEn);
        if (normalizedSuggestion.isBlank()) {
            return false;
        }
        return !normalizedSuggestion.equals(normalizeSuggestionComparison(originalText));
    }

    private String normalizeSuggestionComparison(String value) {
        return normalizeText(value)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[.!?]+$", "")
                .trim();
    }

    private String truncate(String value, int maxLength) {
        String normalized = normalizeText(value);
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength).trim();
    }

    private String firstNonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
