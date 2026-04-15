package com.writeloop.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RequestRateLimiter {

    private final Map<String, FixedWindowBucket> buckets = new ConcurrentHashMap<>();
    private final Clock clock;
    private final Duration staleBucketTtl;

    public RequestRateLimiter(
            @Value("${app.security.rate-limit.stale-bucket-seconds:7200}") long staleBucketSeconds
    ) {
        this(Clock.systemUTC(), Duration.ofSeconds(Math.max(staleBucketSeconds, 60)));
    }

    public RequestRateLimiter(Clock clock, Duration staleBucketTtl) {
        this.clock = clock;
        this.staleBucketTtl = staleBucketTtl == null || staleBucketTtl.isNegative() || staleBucketTtl.isZero()
                ? Duration.ofHours(2)
                : staleBucketTtl;
    }

    public RateLimitDecision tryConsume(
            String policyId,
            String subjectKey,
            int maxRequests,
            Duration window
    ) {
        Instant now = clock.instant();
        Duration safeWindow = (window == null || window.isNegative() || window.isZero())
                ? Duration.ofMinutes(1)
                : window;
        int safeMaxRequests = Math.max(1, maxRequests);
        String bucketKey = normalize(policyId) + ":" + normalize(subjectKey);
        DecisionHolder holder = new DecisionHolder();

        buckets.compute(bucketKey, (key, existing) -> {
            FixedWindowBucket activeBucket = existing;
            if (activeBucket == null || !activeBucket.windowEndsAt().isAfter(now)) {
                activeBucket = new FixedWindowBucket(0, now.plus(safeWindow), now);
            }

            int nextCount = activeBucket.count() + 1;
            FixedWindowBucket updatedBucket = new FixedWindowBucket(
                    nextCount,
                    activeBucket.windowEndsAt(),
                    now
            );
            long retryAfterSeconds = Math.max(
                    1,
                    Duration.between(now, activeBucket.windowEndsAt()).toSeconds()
            );
            holder.decision = new RateLimitDecision(
                    nextCount <= safeMaxRequests,
                    safeMaxRequests,
                    Math.max(0, safeMaxRequests - Math.min(nextCount, safeMaxRequests)),
                    activeBucket.windowEndsAt(),
                    nextCount <= safeMaxRequests ? 0 : retryAfterSeconds
            );
            return updatedBucket;
        });

        return holder.decision;
    }

    @Scheduled(fixedDelayString = "${app.security.rate-limit.cleanup-interval-ms:600000}")
    void evictStaleBuckets() {
        Instant cutoff = clock.instant().minus(staleBucketTtl);
        buckets.entrySet().removeIf(entry -> {
            FixedWindowBucket bucket = entry.getValue();
            return bucket == null
                    || bucket.lastSeenAt().isBefore(cutoff)
                    || bucket.windowEndsAt().isBefore(cutoff);
        });
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? "anonymous" : value.trim();
    }

    private static final class DecisionHolder {
        private RateLimitDecision decision;
    }

    private record FixedWindowBucket(
            int count,
            Instant windowEndsAt,
            Instant lastSeenAt
    ) {
    }

    public record RateLimitDecision(
            boolean allowed,
            int limit,
            int remaining,
            Instant resetAt,
            long retryAfterSeconds
    ) {
    }
}
