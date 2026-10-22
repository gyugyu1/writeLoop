package com.writeloop.service;

import com.writeloop.dto.NowInEnglishCoachFeedbackRequestDto;
import com.writeloop.dto.NowInEnglishCoachFeedbackResponseDto;
import com.writeloop.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
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

            // LLM이 실패하면 고정 칭찬 문구를 AI 피드백처럼 보여 주지 않고 안내를 돌려준다.
            // 문장은 /entries로 이미 저장됐고, 앱은 이 안내를 코치 카드에 보여 준다.
            if (!openAiClient.isConfigured()) {
                feedbackTimingRecorder.recordPolicyEvent("unavailable", Map.of(
                        "reason", "provider_not_configured"
                ));
                throw coachFeedbackUnavailable();
            }
            NowInEnglishCoachFeedbackResponseDto response;
            try {
                response = openAiClient.review(text, createdAt);
            } catch (RuntimeException exception) {
                feedbackTimingRecorder.recordPolicyEvent("unavailable", Map.of(
                        "reason", "llm_failure",
                        "exceptionClass", exception.getClass().getName()
                ));
                LOGGER.warn(
                        "Now-in-English coach feedback is unavailable exceptionClass={}",
                        exception.getClass().getName()
                );
                throw coachFeedbackUnavailable();
            }
            if (response == null) {
                throw coachFeedbackUnavailable();
            }
            return normalizeResponse(response, text);
        } finally {
            feedbackTimingRecorder.recordServicePhase("total", elapsedMs(totalStartedAtNanos));
            feedbackTimingRecorder.clearTrace();
        }
    }

    private long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private ApiException coachFeedbackUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "NOW_COACH_FEEDBACK_UNAVAILABLE",
                "문장은 저장됐어요. AI 코치가 지금 응답하지 않아요. 잠시 후 다시 시도해 주세요."
        );
    }

    private NowInEnglishCoachFeedbackResponseDto normalizeResponse(
            NowInEnglishCoachFeedbackResponseDto response,
            String originalText
    ) {
        // LLM 응답에서 비어 있는 칸만 기본 문구로 채운다.
        NowInEnglishCoachFeedbackResponseDto fallback = fallbackFeedback(originalText);

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
