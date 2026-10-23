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
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080

ENTRYPOINT ["java", "-Duser.timezone=Asia/Seoul", "-jar", "/app/app.jar"]
