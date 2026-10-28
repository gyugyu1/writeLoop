package com.writeloop.support;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * [spec] 작업 032 시나리오 A7: 컨테이너는 테스트 실행에 한 번만 띄워 여러 통합 테스트 클래스가 함께 쓴다.
 * {@link IntegrationTestSupportSpecTest}와 다른 클래스에서 같은 MySQL·Redis를 보는지 확인한다. 데이터를 쓰지 않는다.
 */
class IntegrationTestContainersSpecTest extends IntegrationTestSupport {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Test
    void a7_seesTheSameMysqlAndRedisAsOtherIntegrationTestClasses() {
        System.out.println("[qa-spec A7] mysql container " + IntegrationTestContainers.mysql().getContainerId()
                + ", redis container " + IntegrationTestContainers.redis().getContainerId());
        IntegrationTestSupportSpecTest.ServerIdentity.recordAndAssertSame(getClass().getSimpleName(), jdbc, redisTemplate);
    }
}
