package com.writeloop.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HealthControllerTest {

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Test
    void health_is_ok_when_database_and_redis_respond() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(anyInt())).thenReturn(true);
        when(redisTemplate.execute(any(RedisCallback.class))).thenReturn("PONG");

        ResponseEntity<Map<String, Object>> response = new HealthController(dataSource, redisTemplate).health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "ok")
                .containsEntry("database", "up")
                .containsEntry("redis", "up");
    }

    @Test
    void health_is_unavailable_when_database_is_down() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));
        when(redisTemplate.execute(any(RedisCallback.class))).thenReturn("PONG");

        ResponseEntity<Map<String, Object>> response = new HealthController(dataSource, redisTemplate).health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("status", "degraded")
                .containsEntry("database", "down")
                .containsEntry("redis", "up");
    }

    @Test
    void health_is_unavailable_when_redis_is_down() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(anyInt())).thenReturn(true);
        when(redisTemplate.execute(any(RedisCallback.class)))
                .thenThrow(new RedisConnectionFailureException("connection refused"));

        ResponseEntity<Map<String, Object>> response = new HealthController(dataSource, redisTemplate).health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("database", "up")
                .containsEntry("redis", "down");
    }
}
