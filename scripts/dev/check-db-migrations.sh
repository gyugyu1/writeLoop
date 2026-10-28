#!/usr/bin/env bash
# 마이그레이션 확인: 임시 MySQL·Redis 컨테이너에서 빈 DB와 기존 DB(기준선 107)로 백엔드를 띄우고,
# Flyway 기록, 테이블 구조, 뷰가 쓰는 테이블과 뷰 조회 결과, 운영 배포와 같은 방식의 백업(mysqldump) 결과를 파일로 남긴다.
# 운영 DB와 개발용 로컬 DB에는 접속하지 않고, 비밀 파일도 읽지 않는다. OpenAI 키는 넘기지 않는다.
#
#   bash scripts/dev/check-db-migrations.sh --out <저장소 밖이나 git이 무시하는 결과 폴더> [--tables a,b] [--api <요청 파일>]
#
# --tables  마이그레이션이 바꾼 테이블. SHOW CREATE TABLE을 남긴다.
# --api     한 줄에 "METHOD PATH [JSON 본문]". #으로 시작하는 줄은 건너뛴다. 로그인 없는 API만 부를 수 있다.
#           빈 DB로 띄운 백엔드에 보내고 요청과 응답을 api.txt에 남긴다.
# 결과 폴더의 summary.txt에 단계별 OK/FAIL이 있다. 하나라도 실패하면 종료 코드가 1이다.
# 컨테이너 이름과 포트가 고정이라 scripts/dev의 확인 스크립트는 한 번에 하나만 돌린다.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
INVOCATION="$0 $*"
OUT=""
TABLES=""
API=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT=$2; shift 2 ;;
    --tables) TABLES=$2; shift 2 ;;
    --api) API=$2; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$OUT" ] || { echo "--out is required" >&2; exit 2; }
if [ -n "$API" ] && [ ! -f "$API" ]; then echo "api request file not found: $API" >&2; exit 2; fi

HEAD_SHA=$(git -C "$ROOT" rev-parse HEAD)
DIRTY=$(git -C "$ROOT" status --short | wc -l | tr -d ' ')
# shellcheck source=lib/local-backend.sh
. "$ROOT/scripts/dev/lib/local-backend.sh"
resolve_out_dir
SUMMARY="$OUT/summary.txt"
trap cleanup EXIT

# 배포 전 백업(scripts/ops/prod-db.sh)은 mysql:8.0 클라이언트로 한다. 같게 맞춘다.
DUMP_IMAGE=mysql:8.0
BASELINE="$ROOT/apps/backend/src/main/resources/db/migration/V107__baseline.sql"

record_db() {
  local name=$1
  local f="$OUT/db-$name.txt"
  header "db state ($name)" > "$f"
  { echo "## flyway_schema_history"; sql "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank"; } >> "$f" 2>&1
  if [ -n "$TABLES" ]; then
    for t in ${TABLES//,/ }; do
      { echo "## SHOW CREATE TABLE $t"; sql "SHOW CREATE TABLE \`$t\`\\G"; } >> "$f" 2>&1
    done
  fi

  # MySQL에는 뷰가 쓰는 열 목록(VIEW_COLUMN_USAGE)이 없다. 뷰가 쓰는 테이블을 남기고, 뷰마다 실제로 조회되는지 본다.
  { echo "## tables used by views"; sql "SELECT VIEW_NAME, TABLE_NAME FROM information_schema.VIEW_TABLE_USAGE WHERE VIEW_SCHEMA = 'writeloop' ORDER BY 1, 2"; } >> "$f" 2>&1
  local views v out broken=0 count=0
  if ! views=$(docker exec "$DB" mysql -uroot -N -e "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'writeloop'" 2>&1); then
    echo "## views: listing failed: $views" >> "$f"
    result FAIL "views ($name): listing failed, see db-$name.txt"
  else
    views=$(echo "$views" | tr -d '\r')
    for v in $views; do
      count=$((count + 1))
      if out=$(sql "SELECT 1 FROM \`$v\` LIMIT 0" 2>&1); then
        echo "ok $v" >> "$f"
      else
        echo "BROKEN $v: $out" >> "$f"
        broken=1
      fi
    done
    echo "## views: $count" >> "$f"
    if [ $broken = 0 ]; then result OK "views ($name): $count checked"; else result FAIL "views ($name): see db-$name.txt"; fi
  fi

  # 운영 배포(deploy.sh, prod-db.sh)와 같은 클라이언트와 옵션으로 백업해 보고, 마지막 줄의 "Dump completed"를 확인한다.
  local d="$OUT/dump-$name.txt"
  header "mysqldump ($name) with $DUMP_IMAGE, same options as scripts/ops/deploy.sh and prod-db.sh" > "$d"
  local last
  last=$(MSYS_NO_PATHCONV=1 docker run --rm --network "$NET" "$DUMP_IMAGE" mysqldump -h "$DB" -uroot \
    --default-character-set=utf8mb4 \
    --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces --column-statistics=0 \
    writeloop 2>> "$d" | tail -1)
  echo "last line: $last" >> "$d"
  if echo "$last" | grep -q "Dump completed"; then
    result OK "mysqldump ($name)"
  else
    result FAIL "mysqldump ($name): see dump-$name.txt"
  fi
}

call_api() {
  local f="$OUT/api.txt"
  local failed=0 n=0 line method path body
  header "api calls to http://127.0.0.1:$APP_PORT (empty DB), requests from $API" > "$f"
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in ''|'#'*) continue ;; esac
    read -r method path body <<< "$line"
    n=$((n + 1))
    echo "## $method $path $body" >> "$f"
    if [ -n "$body" ]; then
      curl -s -i --max-time 30 -X "$method" "http://127.0.0.1:$APP_PORT$path" -H 'Content-Type: application/json' -d "$body" >> "$f" 2>&1 || { echo "(curl failed: $?)" >> "$f"; failed=1; }
    else
      curl -s -i --max-time 30 -X "$method" "http://127.0.0.1:$APP_PORT$path" >> "$f" 2>&1 || { echo "(curl failed: $?)" >> "$f"; failed=1; }
    fi
    echo >> "$f"
  done < "$API"
  if [ $failed = 0 ] && [ $n -gt 0 ]; then
    result OK "api calls: $n sent, judge the responses in api.txt"
  else
    result FAIL "api calls: $n sent, connection failed or no requests, see api.txt"
  fi
}

header "check-db-migrations: $INVOCATION" > "$SUMMARY"
ensure_docker
check_ports_free
build_jar
start_containers

# 빈 DB: Flyway가 V107부터 전부 적용한다.
reset_db
if start_backend empty; then
  record_db empty
  [ -n "$API" ] && call_api
fi
stop_backend || exit 1

# 기존 DB: Flyway 기록 없이 V107 구조만 넣는다. Flyway 도입 전 DB와 같은 상태라,
# 기동하면 107로 기준선을 표시하고 108 이후를 한꺼번에 적용한다.
reset_db
header "load V107 baseline without Flyway" > "$OUT/load-baseline.txt"
if docker exec -i "$DB" mysql -uroot --default-character-set=utf8mb4 writeloop < "$BASELINE" >> "$OUT/load-baseline.txt" 2>&1; then
  result OK "load V107 baseline without Flyway"
  if start_backend existing; then
    record_db existing
  fi
else
  result FAIL "load V107 baseline: see load-baseline.txt"
fi
stop_backend

exit $FAILED
