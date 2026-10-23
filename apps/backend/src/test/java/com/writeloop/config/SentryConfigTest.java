package com.writeloop.config;

import com.writeloop.exception.ApiException;
import io.sentry.Hint;
import io.sentry.SentryEvent;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;

class SentryConfigTest {

    private final SentryConfig config = new SentryConfig();

    @Test
    void dropsClientErrors() {
        assertThat(send(new ApiException(HttpStatus.BAD_REQUEST, "INVALID", "잘못된 요청"))).isNull();
        assertThat(send(new ApiException(HttpStatus.CONFLICT, "DUPLICATE", "중복"))).isNull();
        assertThat(send(new ResponseStatusException(HttpStatus.UNAUTHORIZED))).isNull();
    }

    @Test
    void keepsServerErrorsAndUnexpectedExceptions() {
        assertThat(send(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEEDBACK_UNAVAILABLE", "잠시 뒤에"))).isNotNull();
        assertThat(send(new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR))).isNotNull();
        assertThat(send(new IllegalStateException("broken"))).isNotNull();
        assertThat(config.dropClientErrors().execute(new SentryEvent(), new Hint())).isNotNull();
    }

    private SentryEvent send(Throwable throwable) {
        return config.dropClientErrors().execute(new SentryEvent(throwable), new Hint());
    }
}
