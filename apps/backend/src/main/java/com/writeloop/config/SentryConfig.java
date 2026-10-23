package com.writeloop.config;

import com.writeloop.exception.ApiException;
import io.sentry.SentryOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.ErrorResponse;

@Configuration
public class SentryConfig {

    // 잘못된 입력, 인증 실패, 중복 요청처럼 사용자 쪽 원인인 4xx는 오류 추적에 보내지 않는다.
    // 처리된 웹 예외는 원래 보내지 않고(sentry.exception-resolver-order 기본값), 이 필터는 ERROR 로그로 들어오는 경우를 막는다.
    @Bean
    public SentryOptions.BeforeSendCallback dropClientErrors() {
        return (event, hint) -> isClientError(event.getThrowable()) ? null : event;
    }

    static boolean isClientError(Throwable throwable) {
        if (throwable instanceof ApiException apiException) {
            return apiException.getStatus().is4xxClientError();
        }
        if (throwable instanceof ErrorResponse errorResponse) {
            return errorResponse.getStatusCode().is4xxClientError();
        }
        return false;
    }
}
