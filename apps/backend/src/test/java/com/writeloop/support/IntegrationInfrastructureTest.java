package com.writeloop.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

// 통합 테스트 기반이 운영과 같은 방식으로 뜨는지 확인한다.
class IntegrationInfrastructureTest extends IntegrationTestSupport {

    private static final Pattern MIGRATION_VERSION = Pattern.compile("^V(\\d+)__.+\\.sql$");

    @Test
    void appliesEveryFlywayMigrationFromTheBaseline() throws IOException {
        Integer failed = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0", Integer.class);
        Integer applied = jdbc.queryForObject(
                "SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1", Integer.class);

        assertThat(failed).isZero();
        assertThat(applied).isEqualTo(latestMigrationVersion());
    }

    @Test
    void healthReportsDatabaseAndRedisUp() {
        ResponseEntity<Map> response = rest.getForEntity("/health", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("database", "up").containsEntry("redis", "up");
    }

    @Test
    void containersAreRunning() {
        assertThat(IntegrationTestContainers.mysql().isRunning()).isTrue();
        assertThat(IntegrationTestContainers.redis().isRunning()).isTrue();
    }

    private static int latestMigrationVersion() throws IOException {
        try (Stream<Path> files = Files.list(Path.of("src/main/resources/db/migration"))) {
            return files.map(path -> MIGRATION_VERSION.matcher(path.getFileName().toString()))
                    .filter(Matcher::matches)
                    .mapToInt(matcher -> Integer.parseInt(matcher.group(1)))
                    .max()
                    .orElseThrow();
        }
    }
}
