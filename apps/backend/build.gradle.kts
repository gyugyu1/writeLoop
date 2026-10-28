plugins {
    id("java")
    id("org.springframework.boot") version "3.4.3"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.writeloop"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// Spring Boot 3.4.3이 정한 1.20.x는 Docker Engine 29의 최소 API 버전에 맞지 않는다. CI 러너의 Docker가 올라가도 통합 테스트가 뜨게 한다.
extra["testcontainers.version"] = "1.21.4"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-mail")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-mysql")
    implementation("com.nimbusds:nimbus-jose-jwt:9.47")
    implementation("org.springframework.security:spring-security-core")
    implementation("org.springframework.security:spring-security-crypto")
    implementation("io.sentry:sentry-spring-boot-starter-jakarta:8.60.0")
    implementation("io.sentry:sentry-logback:8.60.0")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    runtimeOnly("com.mysql:mysql-connector-j")
    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    // 통합 테스트(com.writeloop.support.IntegrationTestSupport): 실제 MySQL·Redis 컨테이너를 띄운다. Docker가 필요하다.
    testImplementation("org.testcontainers:mysql")
}

tasks.withType<Test> {
    useJUnitPlatform()
    // 실패 원인을 콘솔에서 바로 보게 한다(예: Docker가 꺼져 통합 테스트가 실패할 때 켜는 방법). 스택은 결과 보고서에 있다.
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        showStackTraces = false
    }
}
