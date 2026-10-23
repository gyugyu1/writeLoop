package com.writeloop.service;

import com.writeloop.dto.AdminFeedbackMetricsDto;
import com.writeloop.dto.AdminFeedbackMetricsItemDto;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.FeedbackTimingLlmCallView;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 관리자 AI 피드백 지표. 단계 시간 로그의 LLM 단계 행(호출 한 번에 한 행)으로 기능별 호출 수, 실패율,
// 응답 시간 분위수, 토큰 합계를 계산한다. 문장 피드백의 재시도 수는 진단 로그에서 센다.
@Service
@RequiredArgsConstructor
public class AdminFeedbackMetricsService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");
    private static final int DEFAULT_DAYS = 14;
    private static final int MAX_DAYS = 92;
    // 화면에 보여 줄 순서. 이 밖의 기능이 생기면 뒤에 붙는다.
    private static final List<String> FEATURE_ORDER = List.of("ANSWER", "DIARY", "NOW_IN_ENGLISH", "COACH");

    private final FeedbackTimingLogRepository feedbackTimingLogRepository;
    private final FeedbackDiagnosisLogRepository feedbackDiagnosisLogRepository;

    public AdminFeedbackMetricsDto summarize(LocalDate startDate, LocalDate endDate) {
        LocalDate end = endDate == null ? LocalDate.now(KOREA_ZONE) : endDate;
        LocalDate start = startDate == null ? end.minusDays(DEFAULT_DAYS - 1L) : startDate;
        if (start.isAfter(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "시작일이 종료일보다 늦어요.");
        }
        if (ChronoUnit.DAYS.between(start, end) >= MAX_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "기간은 최대 " + MAX_DAYS + "일까지 볼 수 있어요.");
        }
        Instant from = start.atStartOfDay(KOREA_ZONE).toInstant();
        Instant to = end.plusDays(1).atStartOfDay(KOREA_ZONE).toInstant();

        Map<String, List<FeedbackTimingLlmCallView>> callsByFeature = new LinkedHashMap<>();
        FEATURE_ORDER.forEach(feature -> callsByFeature.put(feature, new ArrayList<>()));
        for (FeedbackTimingLlmCallView call : feedbackTimingLogRepository.findLlmCalls(from, to)) {
            String feature = call.getFeedbackType() == null ? "UNKNOWN" : call.getFeedbackType();
            callsByFeature.computeIfAbsent(feature, ignored -> new ArrayList<>()).add(call);
        }

        List<AdminFeedbackMetricsItemDto> items = new ArrayList<>();
        long totalCalls = 0;
        long totalFailed = 0;
        for (Map.Entry<String, List<FeedbackTimingLlmCallView>> entry : callsByFeature.entrySet()) {
            AdminFeedbackMetricsItemDto item = summarizeFeature(entry.getKey(), entry.getValue());
            items.add(item);
            totalCalls += item.calls();
            totalFailed += item.failedCalls();
        }

        return new AdminFeedbackMetricsDto(
                start.toString(),
                end.toString(),
                totalCalls,
                totalFailed,
                rate(totalFailed, totalCalls),
                feedbackDiagnosisLogRepository.countByRetryAttemptedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to),
                feedbackDiagnosisLogRepository.countByProviderRetryAttemptedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to),
                items
        );
    }

    static AdminFeedbackMetricsItemDto summarizeFeature(String feature, List<FeedbackTimingLlmCallView> calls) {
        long failed = calls.stream().filter(call -> !Boolean.TRUE.equals(call.getSuccess())).count();
        List<Long> elapsed = calls.stream()
                .map(FeedbackTimingLlmCallView::getElapsedMs)
                .filter(value -> value != null)
                .sorted()
                .toList();
        List<FeedbackTimingLlmCallView> withTokens = calls.stream()
                .filter(call -> call.getLlmInputTokens() != null || call.getLlmOutputTokens() != null)
                .toList();
        return new AdminFeedbackMetricsItemDto(
                feature,
                calls.size(),
                failed,
                rate(failed, calls.size()),
                percentile(elapsed, 50),
                percentile(elapsed, 95),
                withTokens.size(),
                sum(withTokens, FeedbackTimingLlmCallView::getLlmInputTokens),
                sum(withTokens, FeedbackTimingLlmCallView::getLlmCachedInputTokens),
                sum(withTokens, FeedbackTimingLlmCallView::getLlmOutputTokens)
        );
    }

    // 정렬된 값의 nearest-rank 분위수. 값이 없으면 null.
    static Long percentile(List<Long> sortedValues, int percentile) {
        if (sortedValues.isEmpty()) {
            return null;
        }
        int rank = (int) Math.ceil(percentile / 100.0 * sortedValues.size());
        return sortedValues.get(Math.max(0, rank - 1));
    }

    private static long sum(List<FeedbackTimingLlmCallView> calls, java.util.function.Function<FeedbackTimingLlmCallView, Long> value) {
        return calls.stream().map(value).filter(v -> v != null).mapToLong(Long::longValue).sum();
    }

    private static double rate(long part, long total) {
        return total == 0 ? 0.0 : (double) part / total;
    }
}
