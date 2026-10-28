package com.writeloop.support;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;

/**
 * 통합 테스트가 함께 쓰는 MySQL·Redis 컨테이너.
 *
 * <p>테스트 실행(JVM) 하나에 한 번만 띄운다. Spring 컨텍스트가 테스트 클래스마다 달라도 같은 컨테이너를 쓰고,
 * 끝나면 Testcontainers가 지운다. 포트는 Docker가 고른 빈 포트라 scripts/dev 확인 스크립트(3307, 6380)나
 * 개발용 DB(3306)와 부딪히지 않는다.
 */
public final class IntegrationTestContainers {

    // scripts/dev/lib/local-backend.sh와 같은 이미지. 운영 DB 서버는 MySQL 8.4.8(sql_mode NO_ENGINE_SUBSTITUTION)이다.
    static final String MYSQL_IMAGE = "mysql:8.4.8";
    static final String REDIS_IMAGE = "redis:7-alpine";

    private static MySQLContainer<?> mysql;
    private static GenericContainer<?> redis;

    private IntegrationTestContainers() {
    }

    static synchronized MySQLContainer<?> mysql() {
        if (mysql == null) {
            MySQLContainer<?> container = new MySQLContainer<>(MYSQL_IMAGE)
                    .withDatabaseName("writeloop")
                    // 기준선(V107)의 뷰를 만들려면 root여야 한다. check-db-migrations.sh도 root로 띄운다.
                    .withUsername("root")
                    .withPassword("test")
                    .withCommand("--sql-mode=NO_ENGINE_SUBSTITUTION")
                    // application.yml의 운영 접속 주소와 같은 시간대 설정
                    .withUrlParam("useSSL", "false")
                    .withUrlParam("allowPublicKeyRetrieval", "true")
                    .withUrlParam("connectionTimeZone", "Asia/Seoul")
                    .withUrlParam("forceConnectionTimeZoneToSession", "true");
            container.start();
            mysql = container;
        }
        return mysql;
    }

    static synchronized GenericContainer<?> redis() {
        if (redis == null) {
            GenericContainer<?> container = new GenericContainer<>(REDIS_IMAGE).withExposedPorts(6379);
            container.start();
            redis = container;
        }
        return redis;
    }
}
