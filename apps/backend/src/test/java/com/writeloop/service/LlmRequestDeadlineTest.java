package com.writeloop.service;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LlmRequestDeadlineTest {

    @Test
    void usesTheConfiguredTimeoutWithoutADeadline() {
        assertThat(LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))).isEqualTo(Duration.ofSeconds(40));
    }

    @Test
    void shortensTheAttemptToTheRemainingTime() {
        Duration timeout = LlmRequestDeadline.within(
                Duration.ofSeconds(20),
                () -> LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))
        );

        assertThat(timeout).isLessThanOrEqualTo(Duration.ofSeconds(20)).isGreaterThan(Duration.ofSeconds(19));
    }

    @Test
    void keepsTheConfiguredTimeoutWhenItIsShorterThanTheRemainingTime() {
        Duration timeout = LlmRequestDeadline.within(
                Duration.ofSeconds(80),
                () -> LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))
        );

        assertThat(timeout).isEqualTo(Duration.ofSeconds(40));
    }

    @Test
    void refusesAnAttemptWhenTooLittleTimeIsLeft() {
        assertThatThrownBy(() -> LlmRequestDeadline.within(
                Duration.ofSeconds(3),
                () -> LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))
        )).isInstanceOf(LlmRequestDeadline.ExceededException.class);
    }

    @Test
    void anInnerBudgetCannotExtendTheOuterDeadline() {
        Duration timeout = LlmRequestDeadline.within(
                Duration.ofSeconds(10),
                () -> LlmRequestDeadline.within(
                        Duration.ofSeconds(60),
                        () -> LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))
                )
        );

        assertThat(timeout).isLessThanOrEqualTo(Duration.ofSeconds(10));
    }

    @Test
    void clearsTheDeadlineAfterTheRequest() {
        LlmRequestDeadline.within(Duration.ofSeconds(10), () -> null);

        assertThat(LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))).isEqualTo(Duration.ofSeconds(40));
    }

    @Test
    void runsWithoutADeadlineWhenTheBudgetIsNotConfigured() {
        Duration timeout = LlmRequestDeadline.within(
                Duration.ZERO,
                () -> LlmRequestDeadline.attemptTimeout(Duration.ofSeconds(40))
        );

        assertThat(timeout).isEqualTo(Duration.ofSeconds(40));
    }
}
