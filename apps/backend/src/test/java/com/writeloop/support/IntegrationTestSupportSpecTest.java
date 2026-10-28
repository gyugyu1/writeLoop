package com.writeloop.support;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManagerFactory;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.Container;

/**
 * [spec] 작업 032 시나리오(private/work/032-2026-10-28-DB-통합테스트-기반/02-qa-scenarios.md)의
 * A1, A2, A3, A4, A6, A7, A13(1). 기대값은 시나리오에서 가져왔다.
 * 데이터를 쓰지 않는다(결정 03의 격리 규칙).
 */
public class IntegrationTestSupportSpecTest extends IntegrationTestSupport {

    private static final Pattern MIGRATION_FILE = Pattern.compile("^V(\\d+)__.+\\.sql$");
    private static final Pattern JDBC_MYSQL_PORT = Pattern.compile("^jdbc:mysql://[^:/]+:(\\d+)/");

    @Autowired
    private Environment environment;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    // A1: 앱 전체를 띄우고 실제 HTTP로 API를 부른다
    @Test
    void a1_realHttpHealthReportsOkWithDatabaseAndRedisUp() {
        ResponseEntity<Map> response = rest.getForEntity("/health", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("status", "ok")
                .containsEntry("database", "up")
                .containsEntry("redis", "up");
    }

    // A2: 이미지는 mysql:8.4.8, redis:7-alpine
    @Test
    void a2_usesMysql848AndRedis7Images() {
        String mysqlVersion = jdbc.queryForObject("SELECT VERSION()", String.class);
        String redisVersion = ServerIdentity.redisInfoServer(redisTemplate).getProperty("redis_version");

        assertThat(mysqlVersion).isEqualTo("8.4.8");
        assertThat(redisVersion).startsWith("7.");
        assertThat(IntegrationTestContainers.mysql().getDockerImageName()).isEqualTo("mysql:8.4.8");
        assertThat(IntegrationTestContainers.redis().getDockerImageName()).isEqualTo("redis:7-alpine");
    }

    // A3: 스키마는 Flyway 마이그레이션으로, 빈 DB에서 V107__baseline.sql부터
    @Test
    void a3_flywayAppliedEveryMigrationFileFromV107OnAnEmptyDatabase() throws IOException {
        List<Integer> fileVersions = migrationFileVersions();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT version, type, script, success FROM flyway_schema_history ORDER BY installed_rank");

        List<Integer> appliedVersions = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            // 버전이 없는 행(기준선 표시가 아닌 스키마 생성 표시 등)은 -1로 남겨 비교에서 드러나게 한다.
            Object version = row.get("version");
            appliedVersions.add(version == null ? -1 : Integer.parseInt(String.valueOf(version)));
        }

        assertThat(fileVersions).as("classpath db/migration V files").isNotEmpty();
        assertThat(appliedVersions).containsExactlyElementsOf(fileVersions);
        assertThat(rows).allSatisfy(row -> assertThat(isTrue(row.get("success")))
                .as("success of %s", row.get("version")).isTrue());

        Map<String, Object> baseline = rows.get(0);
        assertThat(String.valueOf(baseline.get("version"))).isEqualTo("107");
        assertThat(baseline.get("type")).isEqualTo("SQL");
        assertThat(baseline.get("script")).isEqualTo("V107__baseline.sql");
    }

    // A4: JPA 검사(ddl-auto: validate)를 켠 채로 뜬다
    @Test
    void a4_jpaValidateAndFlywayAreOnAsInProduction() {
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.flyway.enabled")).isEqualTo("true");
        assertThat(entityManagerFactory.getProperties().get("hibernate.hbm2ddl.auto")).isEqualTo("validate");
    }

    // A6: OpenAI, 메일, Sentry를 부르지 않는다. 키 없이 뜬다(셸에 값이 있어도 비운다: 결정 03-1)
    @Test
    void a6_externalServiceSettingsAreEmpty() {
        assertThat(environment.getProperty("openai.api-key")).isEmpty();
        assertThat(environment.getProperty("sentry.dsn")).isEmpty();
        assertThat(environment.getProperty("spring.mail.host")).isIn("", "localhost", "127.0.0.1");
    }

    // A7: 컨테이너는 테스트 실행에 한 번만 띄워 여러 통합 테스트 클래스가 함께 쓴다
    @Test
    void a7_sharesTheSameMysqlAndRedisWithOtherIntegrationTestClasses() {
        System.out.println("[qa-spec A7] mysql container " + IntegrationTestContainers.mysql().getContainerId()
                + ", redis container " + IntegrationTestContainers.redis().getContainerId());
        ServerIdentity.recordAndAssertSame(getClass().getSimpleName(), jdbc, redisTemplate);
    }

    // A13(1): 컨테이너는 임의 포트를 써서 3307, 6380, 18080, 3306과 부딪히지 않는다(Redis는 6379도 아니다)
    @Test
    void a13_appUsesTheContainersOnRandomPortsNotTheFixedLocalOnes() throws Exception {
        String url = environment.getProperty("spring.datasource.url");
        Matcher matcher = JDBC_MYSQL_PORT.matcher(url == null ? "" : url);
        assertThat(matcher.find()).as("spring.datasource.url %s", url).isTrue();
        int databasePort = Integer.parseInt(matcher.group(1));
        int redisPort = Integer.parseInt(environment.getProperty("spring.data.redis.port", "-1"));

        assertThat(databasePort).isEqualTo(IntegrationTestContainers.mysql().getMappedPort(3306));
        assertThat(redisPort).isEqualTo(IntegrationTestContainers.redis().getMappedPort(6379));
        assertThat(databasePort).isNotIn(3306, 3307, 6380, 18080);
        assertThat(redisPort).isNotIn(3306, 3307, 6380, 18080, 6379);

        // 앱이 쓰는 DB와 Redis가 그 컨테이너인지: 컨테이너에 직접 붙어 읽은 값과 앱의 연결로 읽은 값이 같다.
        assertThat(jdbc.queryForObject("SELECT @@server_uuid", String.class))
                .isEqualTo(serverUuidDirectlyFromContainer());
        assertThat(ServerIdentity.redisInfoServer(redisTemplate).getProperty("run_id"))
                .isEqualTo(redisRunIdDirectlyFromContainer());
    }

    private static String serverUuidDirectlyFromContainer() throws SQLException {
        var mysql = IntegrationTestContainers.mysql();
        try (Connection connection = DriverManager.getConnection(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword());
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT @@server_uuid")) {
            resultSet.next();
            return resultSet.getString(1);
        }
    }

    private static String redisRunIdDirectlyFromContainer() throws Exception {
        Container.ExecResult result = IntegrationTestContainers.redis().execInContainer("redis-cli", "INFO", "server");
        for (String line : result.getStdout().split("\\r?\\n")) {
            if (line.startsWith("run_id:")) {
                return line.substring("run_id:".length()).trim();
            }
        }
        throw new IllegalStateException("run_id not found in redis-cli INFO server: " + result.getStdout());
    }

    private static List<Integer> migrationFileVersions() throws IOException {
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath*:db/migration/V*.sql");
        List<Integer> versions = new ArrayList<>();
        for (Resource resource : resources) {
            Matcher matcher = MIGRATION_FILE.matcher(String.valueOf(resource.getFilename()));
            if (matcher.matches()) {
                versions.add(Integer.parseInt(matcher.group(1)));
            }
        }
        versions.sort(Integer::compareTo);
        return versions;
    }

    private static boolean isTrue(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof Number number) {
            return number.intValue() == 1;
        }
        return false;
    }

    /**
     * A7: 통합 테스트 클래스마다 앱이 쓰는 MySQL의 server_uuid와 Redis의 run_id를 기록하고, 먼저 기록한 클래스의 값과 같은지 본다.
     * 컨테이너를 새로 띄우면 두 값이 바뀐다. 다른 패키지의 qa 통합 테스트도 이것을 부른다.
     */
    public static final class ServerIdentity {

        private static String firstMysqlServerUuid;
        private static String firstRedisRunId;
        private static String firstClass;

        private ServerIdentity() {
        }

        public static synchronized void recordAndAssertSame(
                String testClass,
                JdbcTemplate jdbc,
                StringRedisTemplate redisTemplate
        ) {
            String mysqlServerUuid = jdbc.queryForObject("SELECT @@server_uuid", String.class);
            String redisRunId = redisInfoServer(redisTemplate).getProperty("run_id");
            System.out.println("[qa-spec A7] class=" + testClass
                    + " mysql_server_uuid=" + mysqlServerUuid + " redis_run_id=" + redisRunId);
            assertThat(mysqlServerUuid).as("server_uuid read").isNotBlank();
            assertThat(redisRunId).as("run_id read").isNotBlank();

            if (firstClass == null) {
                firstClass = testClass;
                firstMysqlServerUuid = mysqlServerUuid;
                firstRedisRunId = redisRunId;
                return;
            }
            assertThat(mysqlServerUuid).as("A7: MySQL seen by %s vs %s", testClass, firstClass)
                    .isEqualTo(firstMysqlServerUuid);
            assertThat(redisRunId).as("A7: Redis seen by %s vs %s", testClass, firstClass)
                    .isEqualTo(firstRedisRunId);
        }

        public static Properties redisInfoServer(StringRedisTemplate redisTemplate) {
            return redisTemplate.execute((RedisCallback<Properties>) connection -> connection.serverCommands().info("server"));
        }
    }
}
