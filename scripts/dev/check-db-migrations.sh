#!/usr/bin/env bash
# 마이그레이션 확인: 임시 MySQL·Redis 컨테이너에서 빈 DB와 기존 DB(기준선 107)로 백엔드를 띄우고,
# Flyway 기록, 테이블 구조, 뷰가 쓰는 테이블과 뷰 조회 결과, 운영 배포와 같은 방식의 백업(mysqldump) 결과를 파일로 남긴다.
# 운영 DB와 개발용 로컬 DB에는 접속하지 않고, 비밀 파일도 읽지 않는다. OpenAI 키는 넘기지 않는다.
#
#   bash scripts/dev/check-db-migrations.sh --out <저장소 밖 결과 폴더> [--tables a,b] [--api <요청 파일>]
#
# --tables  마이그레이션이 바꾼 테이블. SHOW CREATE TABLE을 남긴다.
# --api     한 줄에 "METHOD PATH [JSON 본문]". #으로 시작하는 줄은 건너뛴다.
#           빈 DB로 띄운 백엔드에 보내고 요청과 응답을 api.txt에 남긴다.
# 결과 폴더의 summary.txt에 단계별 OK/FAIL이 있다. 하나라도 실패하면 종료 코드가 1이다.
# 컨테이너 이름과 포트가 고정이라 한 번에 하나만 돌린다.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
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
mkdir -p "$OUT" || exit 2
OUT=$(cd "$OUT" && pwd)
# 결과 폴더가 저장소 안에 있으면 그 자체가 "커밋하지 않은 변경"으로 잡혀 기록이 어긋난다.
case "$OUT/" in "$ROOT"/*) rmdir "$OUT" 2>/dev/null; echo "--out must be outside the repository: $OUT" >&2; exit 2 ;; esac

NET=wl-check-net
DB=wl-check-mysql
REDIS=wl-check-redis
DB_PORT=3307
REDIS_PORT=6380
APP_PORT=18080
# 운영 DB 서버는 MySQL 8.4.8(sql_mode NO_ENGINE_SUBSTITUTION, 시간대 UTC)이고,
# 배포 전 백업(scripts/ops/prod-db.sh)은 mysql:8.0 클라이언트로 한다. 둘 다 같게 맞춘다.
SERVER_IMAGE=mysql:8.4.8
DUMP_IMAGE=mysql:8.0
BASELINE="$ROOT/apps/backend/src/main/resources/db/migration/V107__baseline.sql"

HEAD_SHA=$(git -C "$ROOT" rev-parse HEAD)
DIRTY=$(git -C "$ROOT" status --short | wc -l | tr -d ' ')
SUMMARY="$OUT/summary.txt"
FAILED=0
BACKEND_PID=""

header() { echo "# $1 | HEAD $HEAD_SHA | uncommitted $DIRTY"; }
result() {
  echo "$1 $2" >> "$SUMMARY"
  echo "$1 $2"
  [ "$1" = OK ] || FAILED=1
}
sql() { MSYS_NO_PATHCONV=1 docker exec "$DB" mysql -uroot -t writeloop -e "$1"; }
port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

stop_backend() {
  [ -n "$BACKEND_PID" ] || return 0
  kill "$BACKEND_PID" 2>/dev/null
  wait "$BACKEND_PID" 2>/dev/null
  BACKEND_PID=""
  # Windows에서는 kill이 java 프로세스까지 닿지 않을 수 있어, 이 스크립트가 띄운 포트의 프로세스를 끈다.
  # 시작 전에 이 포트가 비어 있는 것을 확인했으므로 다른 프로세스는 아니다.
  if command -v taskkill >/dev/null 2>&1; then
    for pid in $(netstat -ano 2>/dev/null | grep ":$APP_PORT .*LISTENING" | awk '{print $NF}' | sort -u); do
      taskkill //PID "$pid" //F >/dev/null 2>&1
    done
  fi
}
remove_containers() {
  docker rm -f "$DB" "$REDIS" >/dev/null 2>&1
  docker network rm "$NET" >/dev/null 2>&1
}
cleanup() {
  stop_backend
  remove_containers
}
trap cleanup EXIT

reset_db() {
  docker exec "$DB" mysql -uroot -e "DROP DATABASE IF EXISTS writeloop; CREATE DATABASE writeloop DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

start_backend() {
  local name=$1
  local log="$OUT/boot-$name.txt"
  header "backend boot ($name): java -jar $(basename "$JAR")" > "$log"
  (
    cd "$ROOT/apps/backend" || exit 1
    # 개발자 셸의 설정이 섞이지 않게 백엔드 설정 변수를 지우고 필요한 것만 넘긴다.
    for v in $(compgen -e | grep -E '^(SPRING_|APP_|SERVER_|OPENAI|SENTRY|JAVA_TOOL_OPTIONS)'); do unset "$v"; done
    export SPRING_PROFILES_ACTIVE=local
    export SERVER_PORT=$APP_PORT
    export SPRING_DATASOURCE_URL="jdbc:mysql://127.0.0.1:$DB_PORT/writeloop?useSSL=false&allowPublicKeyRetrieval=true&connectionTimeZone=Asia/Seoul&forceConnectionTimeZoneToSession=true"
    export SPRING_DATASOURCE_USERNAME=root
    export SPRING_DATASOURCE_PASSWORD=
    export SPRING_DATA_REDIS_HOST=127.0.0.1
    export SPRING_DATA_REDIS_PORT=$REDIS_PORT
    export APP_SECURITY_RATE_LIMIT_ENABLED=false
    exec java -jar "$JAR"
  ) >> "$log" 2>&1 &
  BACKEND_PID=$!
  local health="$OUT/health-$name.txt"
  header "GET http://127.0.0.1:$APP_PORT/health ($name)" > "$health"
  for _ in $(seq 1 90); do
    if curl -sf --max-time 5 "http://127.0.0.1:$APP_PORT/health" >> "$health" 2>/dev/null; then
      result OK "backend boot ($name)"
      return 0
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      break
    fi
    sleep 2
  done
  result FAIL "backend boot ($name): see boot-$name.txt"
  return 1
}

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

# 0) 포트가 비어 있어야 다른 프로세스에 붙거나 그 프로세스를 끄지 않는다.
remove_containers
for p in $DB_PORT $REDIS_PORT $APP_PORT; do
  if port_in_use "$p"; then result FAIL "port $p is already in use"; exit 1; fi
done

# 1) 백엔드 jar. 예전 jar로 띄우지 않도록 지우고 새로 만든다.
rm -f "$ROOT"/apps/backend/build/libs/*.jar
if [ -n "${WINDIR:-}" ]; then GRADLE=./gradlew.bat; else GRADLE=./gradlew; fi
header "bootJar: $GRADLE bootJar --no-daemon -q" > "$OUT/build.txt"
if (cd "$ROOT/apps/backend" && $GRADLE bootJar --no-daemon -q) >> "$OUT/build.txt" 2>&1; then
  result OK "bootJar"
else
  result FAIL "bootJar: see build.txt"
  exit 1
fi
JAR=$(ls "$ROOT"/apps/backend/build/libs/*.jar | grep -v -- '-plain\.jar$' | head -1)

# 2) 임시 컨테이너
if ! docker network create "$NET" >/dev/null; then result FAIL "docker network create"; exit 1; fi
if ! docker run -d --name "$DB" --network "$NET" -p 127.0.0.1:$DB_PORT:3306 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  "$SERVER_IMAGE" --sql-mode=NO_ENGINE_SUBSTITUTION >/dev/null; then result FAIL "mysql container"; exit 1; fi
if ! docker run -d --name "$REDIS" -p 127.0.0.1:$REDIS_PORT:6379 redis:7-alpine >/dev/null; then result FAIL "redis container"; exit 1; fi
# 초기화 중인 임시 서버는 TCP를 받지 않으므로 TCP로 확인해야 실제 서버가 뜬 뒤에 진행한다.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$DB" mysqladmin ping -h127.0.0.1 -uroot --silent >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
if [ $ready = 1 ]; then result OK "containers"; else result FAIL "mysql container did not become ready"; exit 1; fi

# 3) 빈 DB: Flyway가 V107부터 전부 적용한다.
reset_db
if start_backend empty; then
  record_db empty
  [ -n "$API" ] && call_api
fi
stop_backend

# 4) 기존 DB: Flyway 기록 없이 V107 구조만 넣는다. Flyway 도입 전 DB와 같은 상태라,
#    기동하면 107로 기준선을 표시하고 108 이후를 한꺼번에 적용한다.
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
