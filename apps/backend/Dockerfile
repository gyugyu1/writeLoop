FROM gradle:8.10-jdk21 AS builder

WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:21-jre

WORKDIR /app
ENV TZ=Asia/Seoul
# 오류 추적(Sentry)에 표시할 배포 버전. CI가 커밋 SHA를 넣는다.
ARG SENTRY_RELEASE=local
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
# root가 아닌 사용자로 실행한다. 로그 볼륨(/app/logs)은 처음 만들 때 이 디렉터리의 소유자를 물려받는다.
RUN groupadd --system writeloop \
    && useradd --system --gid writeloop --home-dir /app --shell /usr/sbin/nologin writeloop \
    && mkdir -p /app/logs \
    && chown -R writeloop:writeloop /app
COPY --from=builder --chown=writeloop:writeloop /app/build/libs/*.jar app.jar
EXPOSE 8080

USER writeloop

# 힙은 컨테이너 메모리 제한(docker-compose.yml mem_limit)의 60%까지. 나머지는 메타스페이스, 스레드, 네이티브 메모리 몫이다.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-Duser.timezone=Asia/Seoul", "-jar", "/app/app.jar"]
