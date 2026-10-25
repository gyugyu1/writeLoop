# scripts/dev의 확인 스크립트가 함께 쓰는 부분: 임시 MySQL·Redis 컨테이너와 로컬 백엔드를 띄우고 정리한다.
# 운영 DB와 개발용 로컬 DB(3306)에는 접속하지 않는다.
# 쓰기 전에 ROOT, OUT, SUMMARY, HEAD_SHA, DIRTY를 정하고 이 파일을 source한다.

NET=wl-check-net
DB=wl-check-mysql
REDIS=wl-check-redis
DB_PORT=3307
REDIS_PORT=6380
APP_PORT=18080
# 운영 DB 서버는 MySQL 8.4.8(sql_mode NO_ENGINE_SUBSTITUTION, 시간대 UTC)이다.
SERVER_IMAGE=mysql:8.4.8
FAILED=0
BACKEND_PID=""
JAR=""

header() { echo "# $1 | HEAD $HEAD_SHA | uncommitted $DIRTY"; }
result() {
  echo "$1 $2" >> "$SUMMARY"
  echo "$1 $2"
  [ "$1" = OK ] || FAILED=1
}
sql() { MSYS_NO_PATHCONV=1 docker exec "$DB" mysql -uroot -t writeloop -e "$1"; }
port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# 결과 폴더를 절대경로로 바꾼다. 저장소 안에서 git이 추적하는 곳이면 결과 파일이 "커밋하지 않은 변경"으로 잡혀
# 기록이 어긋나므로 거부한다. git이 무시하는 폴더(docs/private 등)는 괜찮다.
resolve_out_dir() {
  # 거부할 때 이번에 새로 만든 폴더만 지우도록, 아직 없는 가장 위 폴더를 기억해 둔다.
  local probe="$OUT" created_top=""
  while [ ! -e "$probe" ]; do
    created_top="$probe"
    probe=$(dirname "$probe")
  done
  mkdir -p "$OUT" || exit 2
  [ -n "$created_top" ] && created_top=$(cd "$created_top" && pwd -P)
  OUT=$(cd "$OUT" && pwd -P)

  local reason=""
  # Windows 경로는 대소문자를 가리지 않으므로 소문자로 비교한다.
  local out_lc root_lc rel rel_lc
  out_lc=$(printf '%s/' "$OUT" | tr '[:upper:]' '[:lower:]')
  root_lc=$(printf '%s/' "$ROOT" | tr '[:upper:]' '[:lower:]')
  case "$out_lc" in
    "$root_lc"*)
      rel=${OUT:${#ROOT}}
      rel=${rel#/}
      rel_lc=$(printf '%s/' "$rel" | tr '[:upper:]' '[:lower:]')
      if [ -z "$rel" ]; then
        reason="--out must not be the repository itself: $OUT"
      elif [ "${rel_lc#docs/private/}" != "$rel_lc" ] && [ ! -d "$ROOT/docs/private/.git" ]; then
        # docs/private를 clone하기 전에 이 폴더를 만들면, 나중에 clone이 빈 폴더가 아니라며 실패한다.
        reason="docs/private is not cloned yet; clone it first (see .claude/CLAUDE.md): $OUT"
      elif ! git -C "$ROOT" check-ignore -q -- "$rel/"; then
        reason="--out must be outside the repository or in a git-ignored folder: $OUT"
      fi
      ;;
  esac
  if [ -n "$reason" ]; then
    if [ -n "$created_top" ]; then
      local d="$OUT"
      # 새로 만든 가장 위 폴더(created_top)와 그 아래만 지운다. 경로에 ..가 있어도 원래 있던 폴더는 건드리지 않는다.
      while :; do
        case "$d/" in "$created_top"/*) ;; *) break ;; esac
        rmdir "$d" 2>/dev/null || break
        [ "$d" = "$created_top" ] && break
        d=$(dirname "$d")
      done
    fi
    echo "$reason" >&2
    exit 2
  fi
}

# 백엔드를 끈다. 포트가 비지 않으면 FAIL을 남기고 1을 돌려준다. 끝낼지는 부른 쪽이 정한다.
stop_backend() {
  [ -n "$BACKEND_PID" ] || return 0
  kill "$BACKEND_PID" 2>/dev/null
  # Windows에서는 kill이 java 프로세스까지 닿지 않을 수 있어, 이 스크립트가 띄운 포트의 프로세스를 끈다.
  # 시작 전에 이 포트가 비어 있는 것을 확인했으므로 다른 프로세스는 아니다. wait보다 먼저 해야 wait에서 멈추지 않는다.
  if command -v taskkill >/dev/null 2>&1; then
    for pid in $(netstat -ano 2>/dev/null | grep ":$APP_PORT .*LISTENING" | awk '{print $NF}' | sort -u); do
      taskkill //PID "$pid" //F >/dev/null 2>&1
    done
  fi
  wait "$BACKEND_PID" 2>/dev/null
  BACKEND_PID=""
  # 다음 기동이 남은 프로세스의 /health에 속지 않도록 포트가 빌 때까지 기다린다.
  for _ in $(seq 1 30); do
    port_in_use "$APP_PORT" || return 0
    sleep 1
  done
  result FAIL "backend on port $APP_PORT did not stop"
  return 1
}
remove_containers() {
  docker rm -f "$DB" "$REDIS" >/dev/null 2>&1
  docker network rm "$NET" >/dev/null 2>&1
}
# EXIT trap. 백엔드가 멈추지 않아도 컨테이너는 지운다.
cleanup() {
  stop_backend
  remove_containers
}

# 포트가 비어 있어야 다른 프로세스에 붙거나 그 프로세스를 끄지 않는다.
check_ports_free() {
  # 다른 확인이 돌고 있으면 그 컨테이너를 지우지 않고 바로 멈춘다. 멈춰 있는 이전 컨테이너만 지운다.
  if [ -n "$(docker ps -q --filter "name=^wl-check-" 2>/dev/null)" ]; then
    result FAIL "another scripts/dev check is running (wl-check-* containers are up)"
    # 종료 정리(trap)가 그 실행의 컨테이너를 지우지 않게 끈다.
    trap - EXIT
    exit 1
  fi
  remove_containers
  local p
  for p in $DB_PORT $REDIS_PORT $APP_PORT; do
    if port_in_use "$p"; then result FAIL "port $p is already in use"; exit 1; fi
  done
}

# 백엔드 jar. 예전 jar로 띄우지 않도록 지우고 새로 만든다.
build_jar() {
  local gradle
  rm -f "$ROOT"/apps/backend/build/libs/*.jar
  if [ -n "${WINDIR:-}" ]; then gradle=./gradlew.bat; else gradle=./gradlew; fi
  header "bootJar: $gradle bootJar --no-daemon -q" > "$OUT/build.txt"
  if (cd "$ROOT/apps/backend" && $gradle bootJar --no-daemon -q) >> "$OUT/build.txt" 2>&1; then
    result OK "bootJar"
  else
    result FAIL "bootJar: see build.txt"
    exit 1
  fi
  JAR=$(ls "$ROOT"/apps/backend/build/libs/*.jar | grep -v -- '-plain\.jar$' | head -1)
}

start_containers() {
  if ! docker network create "$NET" >/dev/null; then result FAIL "docker network create"; exit 1; fi
  if ! docker run -d --name "$DB" --network "$NET" -p 127.0.0.1:$DB_PORT:3306 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
    "$SERVER_IMAGE" --sql-mode=NO_ENGINE_SUBSTITUTION >/dev/null; then result FAIL "mysql container"; exit 1; fi
  if ! docker run -d --name "$REDIS" -p 127.0.0.1:$REDIS_PORT:6379 redis:7-alpine >/dev/null; then result FAIL "redis container"; exit 1; fi
  # 초기화 중인 임시 서버는 TCP를 받지 않으므로 TCP로 확인해야 실제 서버가 뜬 뒤에 진행한다.
  local ready=0
  for _ in $(seq 1 90); do
    if docker exec "$DB" mysqladmin ping -h127.0.0.1 -uroot --silent >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
  done
  if [ $ready = 1 ]; then result OK "containers"; else result FAIL "mysql container did not become ready"; exit 1; fi
}

reset_db() {
  docker exec "$DB" mysql -uroot -e "DROP DATABASE IF EXISTS writeloop; CREATE DATABASE writeloop DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

# 저장소 루트 .env의 OPENAI_* 변수를 현재 셸에 내보낸다. 값은 출력하지 않는다. 서브셸 안에서만 부른다.
export_openai_env() {
  # 값이 추적 출력(bash -x)이나 오류 메시지로 새지 않게 한다.
  { set +x; } 2>/dev/null
  local env_file="$ROOT/.env" key value
  [ -f "$env_file" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in OPENAI_*=*) ;; *) continue ;; esac
    key=${line%%=*}
    [[ $key =~ ^[A-Z0-9_]+$ ]] || continue
    value=${line#*=}
    value=${value#\"}; value=${value%\"}
    value=${value#\'}; value=${value%\'}
    [ -n "$value" ] && export "$key=$value" 2>/dev/null
  done < "$env_file"
  [ -n "${OPENAI_API_KEY:-}" ]
}

# start_backend <이름> [openai]
# openai를 주면 .env의 OpenAI 설정을 넘긴다. 주지 않으면 OpenAI 키 없이 띄운다.
start_backend() {
  local name=$1 with_openai=${2:-}
  local log="$OUT/boot-$name.txt"
  header "backend boot ($name): java -jar $(basename "$JAR")${with_openai:+ with OpenAI settings from .env}" > "$log"
  (
    cd "$ROOT/apps/backend" || exit 1
    # 개발자 셸의 설정이 섞이지 않게 백엔드 설정 변수를 지우고 필요한 것만 넘긴다.
    for v in $(compgen -e | grep -E '^(SPRING_|APP_|SERVER_|OPENAI|SENTRY|WRITELOOP_|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$)'); do unset "$v"; done
    if [ -n "$with_openai" ]; then
      export_openai_env || { echo "OPENAI_API_KEY is missing in .env"; exit 3; }
    fi
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
