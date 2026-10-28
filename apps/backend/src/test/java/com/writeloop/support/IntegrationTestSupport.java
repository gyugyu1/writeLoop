package com.writeloop.support;

import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 실제 MySQL·Redis로 앱 전체를 띄우는 통합 테스트의 부모 클래스.
 *
 * <ul>
 *   <li>스키마는 운영과 같은 Flyway 마이그레이션(빈 DB에서 V107__baseline.sql부터)으로 만들고, JPA 검사(validate)도 켠 채로 뜬다.</li>
 *   <li>앱은 임의 포트로 뜨고, {@link #rest}로 실제 HTTP 요청을 보낸다. 준비와 확인은 {@link #jdbc}로 DB를 직접 읽고 쓴다.</li>
 *   <li>설정은 check-db-migrations.sh가 백엔드를 띄울 때와 같다: local 프로필, 요청 수 제한 끔.
 *       OpenAI 키, Sentry DSN, 메일 서버는 개발자 셸에 값이 있어도 비워서 부르지 않는다.</li>
 *   <li>컨테이너와 DB는 모든 통합 테스트가 함께 쓰고, 기반은 테스트 사이에 데이터를 되돌리지 않는다. 그래서
 *       테스트 메서드마다 고유한 데이터(이메일, guestId, Redis 키)를 만들고 자기가 만든 데이터만 확인한다.
 *       기준 데이터(마이그레이션이 넣은 질문 등)를 바꾸는 테스트는 끝에 되돌린다.</li>
 *   <li>Docker가 꺼져 있으면 {@link DockerRequiredExtension}이 원인과 켜는 방법을 담아 실패시킨다.</li>
 * </ul>
 */
@ExtendWith(DockerRequiredExtension.class)
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.security.rate-limit.enabled=false",
                // 셸 환경 변수보다 앞서므로, 셸에 값이 있어도 외부 서비스를 부르지 않는다.
                "openai.api-key=",
                "sentry.dsn=",
                "spring.mail.host="
        }
)
@ActiveProfiles("local")
public abstract class IntegrationTestSupport {

    @Autowired
    protected TestRestTemplate rest;

    @Autowired
    protected JdbcTemplate jdbc;

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> IntegrationTestContainers.mysql().getJdbcUrl());
        registry.add("spring.datasource.username", () -> IntegrationTestContainers.mysql().getUsername());
        registry.add("spring.datasource.password", () -> IntegrationTestContainers.mysql().getPassword());
        registry.add("spring.data.redis.host", () -> IntegrationTestContainers.redis().getHost());
        registry.add("spring.data.redis.port", () -> IntegrationTestContainers.redis().getMappedPort(6379));
    }
}
 