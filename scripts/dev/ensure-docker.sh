#!/usr/bin/env bash
# Docker가 응답하는지 보고, 꺼져 있으면 Docker Desktop을 켠다.
# scripts/dev 확인 스크립트(check-db-migrations.sh, run-llm-smoke.sh)가 컨테이너를 띄우기 전에 부르고,
# 백엔드 테스트(통합 테스트가 Docker를 쓴다) 전에도 부른다. 테스트와 Gradle 빌드는 Docker를 켜지 않는다.
#
# 무엇을 했는지 한 줄로 출력한다. 응답하면(이미 켜져 있거나 켰으면) 0, 켜지 못하면 원인을 적고 1로 끝난다.
set -u

START_TIMEOUT=180

if ! command -v docker > /dev/null 2>&1; then
  echo "docker: FAIL docker command not found"
  exit 1
fi
if docker info > /dev/null 2>&1; then
  echo "docker: already running"
  exit 0
fi
if ! docker desktop start --timeout "$START_TIMEOUT" > /dev/null 2>&1; then
  echo "docker: FAIL not responding, and docker desktop start failed or timed out (${START_TIMEOUT}s)"
  exit 1
fi
if docker info > /dev/null 2>&1; then
  echo "docker: started with docker desktop start"
  exit 0
fi
echo "docker: FAIL docker desktop start finished but docker is still not responding"
exit 1
