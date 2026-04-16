package com.writeloop.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class RequestRateLimiter {

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestRateLimiter.class);
    private static final DefaultRedisScript<List> REDIS_FIXED_WINDOW_SCRIPT = new DefaultRedisScript<>();

    static {
        REDIS_FIXED_WINDOW_SCRIPT.setScriptText(
                "local current = redis.call('INCR', KEYS[1]) "
                        + "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end "
                        + "local ttl = redis.call('TTL', KEYS[1]) "
                        + "return {current, ttl}"
        );
        REDIS_FIXED_WINDOW_SCRIPT.setResultType(List.class);
    }

    private final Map<String, FixedWindowBucket> buckets = new ConcurrentHashMap<>();
    private final Clock clock;
    private final Duration staleBucketTtl;
    private final StringRedisTemplate redisTemplate;
    private final AtomicBoolean redisFallbackLogged = new AtomicBoolean(false);

    @Autowired
    public RequestRateLimiter(
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            @Value("${app.security.rate-limit.stale-bucket-seconds:7200}") long staleBucketSeconds
    ) {
        this(
                redisTemplateProvider.getIfAvailable(),
                Clock.systemUTC(),
                Duration.ofSeconds(Math.max(staleBucketSeconds, 60))
        );
    }

    public RequestRateLimiter(Clock clock, Duration staleBucketTtl) {
        this(null, clock, staleBucketTtl);
    }

    RequestRateLimiter(StringRedisTemplate redisTemplate, Clock clock, Duration staleBucketTtl) {
        this.redisTemplate = redisTemplate;
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

        if (redisTemplate != null) {
            try {
                RateLimitDecision redisDecision = tryConsumeWithRedis(
                        policyId,
                        subjectKey,
                        safeMaxRequests,
                        safeWindow,
                        now
                );
                redisFallbackLogged.set(false);
                return redisDecision;
            } catch (Exception exception) {
                if (redisFallbackLogged.compareAndSet(false, true)) {
                    LOGGER.warn("Redis-backed request rate limiting is unavailable. Falling back to in-memory buckets.", exception);
                }
            }
        }

        return tryConsumeInMemory(policyId, subjectKey, safeMaxRequests, safeWindow, now);
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

    private RateLimitDecision tryConsumeWithRedis(
            String policyId,
            String subjectKey,
            int safeMaxRequests,
            Duration safeWindow,
            Instant now
    ) {
        long windowSeconds = Math.max(1, safeWindow.getSeconds());
        long nowEpochSeconds = now.getEpochSecond();
        long windowStartEpochSeconds = (nowEpochSeconds / windowSeconds) * windowSeconds;
        long windowEndEpochSeconds = windowStartEpochSeconds + windowSeconds;
        long ttlSeconds = Math.max(1, windowEndEpochSeconds - nowEpochSeconds + 1);
        String redisKey = buildRedisKey(policyId, subjectKey, windowStartEpochSeconds);

        List<?> scriptResult = redisTemplate.execute(
                REDIS_FIXED_WINDOW_SCRIPT,
                Collections.singletonList(redisKey),
                Long.toString(ttlSeconds)
        );
        if (scriptResult == null || scriptResult.size() < 2) {
            throw new IllegalStateException("Redis rate-limit script returned an empty response");
        }

        long currentCount = asLong(scriptResult.get(0), 1L);
        long redisTtlSeconds = Math.max(1, asLong(scriptResult.get(1), ttlSeconds));
        Instant resetAt = Instant.ofEpochSecond(windowEndEpochSeconds);
        boolean allowed = currentCount <= safeMaxRequests;
        return new RateLimitDecision(
                allowed,
                safeMaxRequests,
                Math.max(0, safeMaxRequests - (int) Math.min(currentCount, safeMaxRequests)),
                resetAt,
                allowed ? 0 : redisTtlSeconds
        );
    }

    private RateLimitDecision tryConsumeInMemory(
            String policyId,
            String subjectKey,
            int safeMaxRequests,
            Duration safeWindow,
            Instant now
    ) {
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

    private String buildRedisKey(String policyId, String subjectKey, long windowStartEpochSeconds) {
        return "rate-limit:%s:%s:%d".formatted(
                normalize(policyId),
                normalize(subjectKey),
                windowStartEpochSeconds
        );
    }

    private long asLong(Object value, long defaultValue) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String stringValue) {
            try {
                return Long.parseLong(stringValue);
            } catch (NumberFormatException ignored) {
                return defaultValue;
            }
        }
        return defaultValue;
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
