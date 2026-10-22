#!/usr/bin/env bash
# 운영 서버에서 운영 DB에 mysql·mysqldump를 실행한다.
# 접속 정보는 실행 중인 백엔드 컨테이너의 환경변수에서 읽는다. 비밀번호는 권한 600 임시 파일로만 넘기고
# 화면이나 저장소에 남기지 않는다. DB 주소도 저장소에 적지 않는다.
#
# 사용 예:
#   bash scripts/ops/prod-db.sh mysql writeloop -e "SELECT COUNT(*) FROM prompts"
#   bash scripts/ops/prod-db.sh mysqldump --single-transaction writeloop | gzip > backup.sql.gz
set -euo pipefail

CONTAINER="${WRITELOOP_BACKEND_CONTAINER:-writeLoop-backend}"

umask 077
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT

CONTAINER_ENV="$(sudo -n docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}')"
JDBC_URL="$(printf '%s\n' "$CONTAINER_ENV" | sed -n 's/^SPRING_DATASOURCE_URL=//p')"
DB_USER="$(printf '%s\n' "$CONTAINER_ENV" | sed -n 's/^SPRING_DATASOURCE_USERNAME=//p')"
printf '%s\n' "$CONTAINER_ENV" | sed -n 's/^SPRING_DATASOURCE_PASSWORD=/MYSQL_PWD=/p' > "$ENV_FILE"

HOST_PORT="${JDBC_URL#jdbc:mysql://}"
HOST_PORT="${HOST_PORT%%/*}"
DB_HOST="${HOST_PORT%%:*}"
DB_PORT=3306
if [[ "$HOST_PORT" == *:* ]]; then
  DB_PORT="${HOST_PORT##*:}"
fi

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ ! -s "$ENV_FILE" ]; then
  echo "DB connection info not found in the $CONTAINER container environment" >&2
  exit 1
fi

TOOL="${1:?usage: prod-db.sh <mysql|mysqldump> [args...]}"
shift
sudo -n docker run --rm -i --env-file "$ENV_FILE" mysql:8.0 \
  "$TOOL" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --default-character-set=utf8mb4 "$@"
