#!/usr/bin/env bash
# 운영 서버에서 실행하는 배포 스크립트. GitHub Actions의 Deploy 워크플로가 SSH로 호출한다.
# 이미지는 CI가 GHCR에 올려 두고, 서버는 받아서 실행만 한다. 서버 메모리가 작아서 서버에서는 빌드하지 않는다.
#
# 사용: 저장소를 배포할 커밋으로 맞춘 뒤
#   GHCR_USER=<github 사용자> GHCR_TOKEN=<packages:read 토큰> bash scripts/ops/deploy.sh <git-sha>
#
# 순서
#   1) 운영 DB 백업. 백엔드가 기동할 때 Flyway가 마이그레이션을 적용하므로 반드시 먼저 한다.
#   2) GHCR에서 이 커밋의 이미지를 받아 :latest로 태그한다. docker-compose.yml은 :latest를 실행한다.
#   3) 백엔드·프론트엔드를 재시작하고 백엔드 기동(Flyway 포함)과 프론트엔드 상태를 확인한다.
#   4) 지난 배포 이후 nginx 설정이 바뀌었으면 nginx를 다시 만든다.
#   5) 배포한 커밋을 기록하고, 이번·직전 커밋 이미지만 남긴 뒤 공개 주소로 응답을 확인한다.
#      더 예전 커밋은 GHCR에 남아 있어서, 그 SHA로 배포하면 다시 받는다.
set -euo pipefail

SHA="${1:?usage: deploy.sh <git-sha>}"
REGISTRY="${WRITELOOP_REGISTRY:-ghcr.io/gyugyu1}"
BACKUP_DIR="${HOME}/db-backups"
STATE_FILE="${HOME}/writeloop-deployed-sha"
SHORT_SHA="${SHA:0:7}"

cd "$(dirname "$0")/../.."
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "$SHA")" ]; then
  echo "repository is not at $SHA; check out the commit before running deploy.sh" >&2
  exit 1
fi
PREVIOUS_SHA="$(cat "$STATE_FILE" 2>/dev/null || true)"
echo "deploying $(git log --oneline -1) (previous: ${PREVIOUS_SHA:0:7})"

# 1) DB 백업
umask 077
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/writeloop-before-deploy-${SHORT_SHA}-$(date +%Y%m%d-%H%M%S).sql.gz"
bash scripts/ops/prod-db.sh mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF \
  --no-tablespaces --column-statistics=0 writeloop 2> >(grep -v "Using a password" >&2) | gzip > "$BACKUP"
if ! gunzip -c "$BACKUP" | tail -1 | grep -q "Dump completed"; then
  echo "DB backup is incomplete: $BACKUP" >&2
  exit 1
fi
chmod 600 "$BACKUP"
echo "backup: $BACKUP"
umask 022

# 2) 이미지 받기
echo "$GHCR_TOKEN" | sudo -n docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'sudo -n docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
for service in backend frontend; do
  sudo -n docker pull -q "$REGISTRY/writeloop-$service:$SHA"
  sudo -n docker tag "$REGISTRY/writeloop-$service:$SHA" "$REGISTRY/writeloop-$service:latest"
done

# 3) 재시작과 기동 확인
sudo -n docker compose up -d --no-deps --no-build writeloop-backend writeloop-frontend
START=$(date +%s)
RESULT=timeout
while [ $(( $(date +%s) - START )) -lt 180 ]; do
  LOGS="$(sudo -n docker logs --since 4m writeLoop-backend 2>&1)"
  if echo "$LOGS" | grep -q "Started WriteLoopApplication"; then RESULT=started; break; fi
  if echo "$LOGS" | grep -qE "Schema-validation|APPLICATION FAILED TO START|Application run failed|FlywayException"; then
    RESULT=failed
    break
  fi
  sleep 3
done
sudo -n docker logs --since 4m writeLoop-backend 2>&1 \
  | grep -E "baseline|Migrating|Successfully applied|Started WriteLoopApplication" | cut -c1-200 || true
if [ "$RESULT" != "started" ]; then
  echo "backend did not start ($RESULT); last log lines:" >&2
  sudo -n docker logs --tail 80 writeLoop-backend >&2 || true
  echo "DB backup before this deploy: $BACKUP" >&2
  exit 1
fi
echo "backend started after $(( $(date +%s) - START ))s"

for _ in $(seq 1 30); do
  if [ "$(sudo -n docker inspect -f '{{.State.Health.Status}}' writeLoop-frontend 2>/dev/null)" = "healthy" ]; then
    echo "frontend healthy"
    break
  fi
  sleep 3
done

# 4) nginx 설정이 바뀌었으면 nginx를 다시 만든다. 설정 파일은 bind mount라 재생성해야 새 파일을 읽는다.
if [ -n "$PREVIOUS_SHA" ] && git cat-file -e "${PREVIOUS_SHA}^{commit}" 2>/dev/null \
    && git diff --quiet "$PREVIOUS_SHA" "$SHA" -- infra/nginx; then
  echo "nginx config unchanged"
else
  sudo -n docker compose up -d --no-deps --force-recreate writeloop-nginx
  echo "nginx recreated"
fi

# 5) 기록과 확인
echo "$SHA" > "$STATE_FILE"
# 서버 디스크가 차지 않게 이번·직전 커밋 이미지만 남긴다. 직전 커밋은 서버에서 바로 되돌릴 때 쓴다.
for service in backend frontend; do
  repo="$REGISTRY/writeloop-$service"
  for tag in $(sudo -n docker images "$repo" --format '{{.Tag}}'); do
    case "$tag" in
      latest | "<none>" | "$SHA") continue ;;
    esac
    if [ -n "$PREVIOUS_SHA" ] && [ "$tag" = "$PREVIOUS_SHA" ]; then continue; fi
    sudo -n docker rmi "$repo:$tag" >/dev/null || true
    echo "removed old image: writeloop-$service:${tag:0:7}"
  done
done
sudo -n docker image prune -f >/dev/null || true
curl -fsS -o /dev/null --max-time 20 https://api.writeloop.kr/api/prompts
curl -fsS -o /dev/null --max-time 20 https://writeloop.kr/
echo "deploy complete: $SHORT_SHA"
