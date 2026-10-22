package com.writeloop.service;

import java.time.Duration;
import java.util.function.Supplier;

// 요청 하나가 LLM 호출 전체에 쓸 수 있는 시간. 앱이 먼저 포기하기 전에 서버가 결과나 대체 응답을 돌려주게 한다.
// 서비스가 요청을 시작할 때 within()으로 열고, OpenAI 호출은 매번 남은 시간 안에서만 기다린다
// (OpenAiStructuredOutputSupport.buildResponsesRequest). 마감이 열려 있지 않으면 호출마다 정한 시간 제한만 쓴다.
final class LlmRequestDeadline {

    // 남은 시간이 이보다 적으면 호출하지 않는다. 이 정도로는 응답을 받기 어렵고 비용만 든다.
    static final Duration MINIMUM_ATTEMPT = Duration.ofSeconds(5);

    private static final ThreadLocal<Long> DEADLINE_NANOS = new ThreadLocal<>();

    private LlmRequestDeadline() {
    }

    // budget이 0 이하이면 마감 없이 실행한다(설정을 주입하지 않은 단위 테스트 등).
    static <T> T within(Duration budget, Supplier<T> work) {
        if (budget == null || budget.isZero() || budget.isNegative()) {
            return work.get();
        }
        Long outerDeadline = DEADLINE_NANOS.get();
        long deadline = System.nanoTime() + budget.toNanos();
        if (outerDeadline != null && outerDeadline - deadline < 0) {
            deadline = outerDeadline;
        }
        DEADLINE_NANOS.set(deadline);
        try {
            return work.get();
        } finally {
            if (outerDeadline == null) {
                DEADLINE_NANOS.remove();
            } else {
                DEADLINE_NANOS.set(outerDeadline);
            }
        }
    }

    // 이번 호출에 줄 시간: 호출마다 정한 시간 제한과 남은 시간 중 짧은 쪽.
    static Duration attemptTimeout(Duration configuredTimeout) {
        Long deadline = DEADLINE_NANOS.get();
        if (deadline == null) {
            return configuredTimeout;
        }
        long remainingNanos = deadline - System.nanoTime();
        if (remainingNanos < MINIMUM_ATTEMPT.toNanos()) {
            throw new ExceededException(Duration.ofNanos(Math.max(0, remainingNanos)));
        }
        Duration remaining = Duration.ofNanos(remainingNanos);
        return remaining.compareTo(configuredTimeout) < 0 ? remaining : configuredTimeout;
    }

    static final class ExceededException extends IllegalStateException {
        ExceededException(Duration remaining) {
            super("LLM request deadline reached; remaining " + remaining.toMillis() + " ms");
        }
    }
}
