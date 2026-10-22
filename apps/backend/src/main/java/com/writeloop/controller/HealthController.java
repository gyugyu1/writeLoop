package com.writeloop.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

// Docker 헬스체크가 호출한다. DB와 Redis에 실제로 닿는지 확인하고, 하나라도 실패하면 503을 돌려준다.
@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController {

    private static final int DATABASE_VALIDATION_TIMEOUT_SECONDS = 2;

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        boolean databaseUp = isDatabaseUp();
        boolean redisUp = isRedisUp();
        boolean healthy = databaseUp && redisUp;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", healthy ? "ok" : "degraded");
        body.put("service", "english-learning-backend");
        body.put("database", databaseUp ? "up" : "down");
        body.put("redis", redisUp ? "up" : "down");
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    private boolean isDatabaseUp() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(DATABASE_VALIDATION_TIMEOUT_SECONDS);
        } catch (Exception exception) {
            return false;
        }
    }

    private boolean isRedisUp() {
        try {
            String reply = redisTemplate.execute((RedisCallback<String>) RedisConnection::ping);
            return "PONG".equalsIgnoreCase(reply);
        } catch (Exception exception) {
            return false;
        }
    }
}
