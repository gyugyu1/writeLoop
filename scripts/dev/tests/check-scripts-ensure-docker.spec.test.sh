#!/usr/bin/env bash
# [spec] check-db-migrations.sh와 run-llm-smoke.sh가 컨테이너를 띄우기 전에 Docker를 켜는지 테스트(qa). 작업 032 시나리오 D1~D4.
# 임시 폴더에 저장소 구조를 흉내 낸 사본(지금 저장소의 스크립트, 가짜 gradlew, 가짜 .env와 케이스 파일)을 만들고,
# 가짜 docker·node를 PATH 맨 앞에 두고 돌린다. 진짜 docker가 있는 PATH 폴더는 빼므로 진짜 Docker와 wl-check-* 컨테이너는 건드리지 않는다.
# 진짜 저장소의 .env와 빌드 폴더도 건드리지 않는다. 가짜 docker는 network create와 run을 거부해, 컨테이너 단계에서 스크립트가 멈춘다.
# D2·D4는 이 컴퓨터의 3307, 6380, 18080 포트가 비어 있어야 컨테이너 단계까지 간다(스크립트의 포트 확인).
#
#   bash scripts/dev/tests/check-scripts-ensure-docker.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
DEV="$HERE/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

SAFE_PATH=""
IFS=: read -r -a PATH_DIRS <<< "$PATH"
for d in "${PATH_DIRS[@]}"; do
  [ -n "$d" ] || continue
  if [ -e "$d/docker" ] || [ -e "$d/docker.exe" ]; then continue; fi
  SAFE_PATH="${SAFE_PATH:+$SAFE_PATH:}$d"
done
if PATH="$SAFE_PATH" command -v docker > /dev/null 2>&1; then
  echo "FAIL setup: a real docker is still on the test PATH; refusing to run"
  exit 1
fi

# 저장소 사본($1)
make_root() {
  local r=$1
  mkdir -p "$r/scripts/dev/lib" "$r/apps/backend" "$r/scripts/feedback-quality"
  cp "$DEV/check-db-migrations.sh" "$DEV/run-llm-smoke.sh" "$DEV/ensure-docker.sh" "$r/scripts/dev/"
  cp "$DEV/lib/local-backend.sh" "$r/scripts/dev/lib/"
  # 가짜 gradle: 아무것도 만들지 않고 성공한다. 컨테이너 단계에서 멈추므로 jar는 쓰이지 않는다.
  # 스크립트는 Windows(WINDIR 있음)면 gradlew.bat, 아니면 gradlew를 부른다.
  printf '#!/usr/bin/env bash\nexit 0\n' > "$r/apps/backend/gradlew"
  printf '@exit /b 0\r\n' > "$r/apps/backend/gradlew.bat"
  chmod +x "$r/apps/backend/gradlew" "$r/apps/backend/gradlew.bat"
  echo '[]' > "$r/scripts/feedback-quality/cases.smoke.json"
  # run-llm-smoke.sh가 키가 있는지만 본다. 가짜 값이다.
  printf 'OPENAI_API_KEY=qa-fake-not-a-real-key\n' > "$r/.env"
}

# 가짜 docker와 node($1/bin). state(up/down)와 start_mode(ok/fail)대로 답한다.
make_fakes() {
  local dir=$1 state=$2 start_mode=$3
  mkdir -p "$dir/bin"
  echo "$state" > "$dir/state"
  echo "$start_mode" > "$dir/start_mode"
  : > "$dir/calls.log"
  cat > "$dir/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_DOCKER_DIR/calls.log"
case "${1:-}" in
  info)
    if [ "$(cat "$FAKE_DOCKER_DIR/state")" = up ]; then printf 'Server:\n Server Version: 99.0.0-fake\n'; exit 0; fi
    echo "error during connect: fake docker daemon is not running" >&2; exit 1 ;;
  desktop)
    if [ "$(cat "$FAKE_DOCKER_DIR/start_mode")" = ok ]; then echo up > "$FAKE_DOCKER_DIR/state"; exit 0; fi
    echo "fake docker desktop start failed" >&2; exit 1 ;;
  network)
    if [ "${2:-}" = create ]; then echo "fake: network create refused" >&2; exit 1; fi
    exit 0 ;;
  run) echo "fake: run refused" >&2; exit 1 ;;
  *) exit 0 ;;
esac
EOF
  # run-llm-smoke.sh의 케이스 형식 확인(dry run)만 통과시킨다.
  cat > "$dir/bin/node" <<'EOF'
#!/usr/bin/env bash
echo "node $*" >> "$FAKE_DOCKER_DIR/node.log"
echo "planned: 6 case(s) x 1 = 6 execution(s)"
EOF
  chmod +x "$dir/bin/docker" "$dir/bin/node"
}

# $1 스크립트 이름, $2 사례 폴더. 종료 코드는 RC, summary.txt는 $2/out/summary.txt.
run_script() {
  local script=$1 dir=$2
  (cd "$dir/root" && FAKE_DOCKER_DIR="$dir" PATH="$dir/bin:$SAFE_PATH" \
    timeout 300 bash "$dir/root/scripts/dev/$script" --out "$dir/out") > "$dir/run.txt" 2>&1
  RC=$?
}

first_line_matching() { local n; n=$(grep -n -E -m1 -- "$2" "$1/calls.log" | cut -d: -f1); echo "${n:-0}"; }
container_start_line() { first_line_matching "$1" '^(network create|run)( |$)'; }
show() { echo "rc=$RC calls=$(tr '\n' '|' < "$1/calls.log") summary=$(tr '\n' '|' < "$1/out/summary.txt" 2>/dev/null) run=$(tail -5 "$1/run.txt" | tr '\n' '|')"; }

# Docker를 켜지 못할 때(D1, D3)
check_cannot_start() {
  local label=$1 script=$2 dir=$3
  make_root "$dir/root"
  make_fakes "$dir" down fail
  run_script "$script" "$dir"
  expect "$label: (준비 확인) Docker를 확인했다(docker info)" "$([ "$(first_line_matching "$dir" '^info$')" -gt 0 ]; echo $?)" "$(show "$dir")"
  expect "$label: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show "$dir")"
  expect "$label: summary.txt에 FAIL 줄이 있다" "$(grep -q '^FAIL ' "$dir/out/summary.txt" 2>/dev/null; echo $?)" "$(show "$dir")"
  expect "$label: 컨테이너를 띄우는 docker 호출(network create, run)이 없다" "$([ "$(container_start_line "$dir")" = 0 ]; echo $?)" "$(show "$dir")"
}

# Docker가 꺼져 있고 켤 수 있을 때(D2, D4)
check_starts_first() {
  local label=$1 script=$2 dir=$3
  make_root "$dir/root"
  make_fakes "$dir" down ok
  run_script "$script" "$dir"
  local start container
  start=$(first_line_matching "$dir" '^desktop start --timeout 180$')
  container=$(container_start_line "$dir")
  if [ "$container" = 0 ] && grep -q 'already in use\|another scripts/dev check' "$dir/out/summary.txt" 2>/dev/null; then
    bad "$label: 확인할 수 없음(이 컴퓨터의 포트가 쓰이고 있어 컨테이너 단계 전에 멈췄다)" "$(show "$dir")"
    return
  fi
  expect "$label: (준비 확인) 컨테이너를 띄우는 호출까지 갔다" "$([ "$container" -gt 0 ]; echo $?)" "$(show "$dir")"
  expect "$label: docker desktop start --timeout 180이 첫 network create·run보다 앞이다" "$([ "$start" -gt 0 ] && [ "$start" -lt "$container" ]; echo $?)" "$(show "$dir")"
}

check_cannot_start "D1 check-db-migrations.sh" check-db-migrations.sh "$TMP/d1"
check_starts_first "D2 check-db-migrations.sh" check-db-migrations.sh "$TMP/d2"
check_cannot_start "D3 run-llm-smoke.sh" run-llm-smoke.sh "$TMP/d3"
expect "D3: (준비 확인) 케이스 형식 확인을 통과해 Docker 단계까지 갔다" "$(grep -q '^OK cases valid' "$TMP/d3/out/summary.txt" 2>/dev/null; echo $?)" "$(show "$TMP/d3")"
check_starts_first "D4 run-llm-smoke.sh" run-llm-smoke.sh "$TMP/d4"

echo "passed $PASS, failed $FAIL"
[ "$FAIL" = 0 ]
