#!/usr/bin/env bash
# [spec] scripts/dev/ensure-docker.sh 테스트(qa). 작업 032 시나리오 C1~C6.
# 가짜 docker를 PATH 맨 앞에 두고, 진짜 docker가 있는 PATH 폴더는 뺀다. 진짜 Docker는 건드리지 않는다.
# 가짜 docker는 받은 인자를 기록하고, 진짜처럼 info 성공 때는 표준 출력에 여러 줄, 실패 때는 표준 오류에 한 줄을 낸다.
# desktop start는 아무것도 출력하지 않는다.
#
#   bash scripts/dev/tests/ensure-docker.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
ENSURE="$HERE/../ensure-docker.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

# 진짜 docker가 있는 폴더를 뺀 PATH
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

# 가짜 docker. $FAKE_DOCKER_DIR의 state(up/down)와 start_mode(ok/ok-but-down/fail)대로 답한다.
make_case() {
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
    if [ "$(cat "$FAKE_DOCKER_DIR/state")" = up ]; then
      printf 'Client:\n Version:    99.0.0-fake\n\nServer:\n Containers: 0\n Server Version: 99.0.0-fake\n'
      exit 0
    fi
    echo "error during connect: fake docker daemon is not running" >&2
    exit 1 ;;
  desktop)
    case "$(cat "$FAKE_DOCKER_DIR/start_mode")" in
      ok) echo up > "$FAKE_DOCKER_DIR/state"; exit 0 ;;
      ok-but-down) exit 0 ;;
      *) echo "fake docker desktop start failed" >&2; exit 1 ;;
    esac ;;
  *) exit 0 ;;
esac
EOF
  chmod +x "$dir/bin/docker"
}

# ensure-docker.sh를 돌린다. 출력(표준 출력과 표준 오류)은 $1/out.txt, 종료 코드는 RC, 줄 수는 LINES.
run_ensure() {
  local dir=$1 path=$2
  (cd "$dir" && FAKE_DOCKER_DIR="$dir" PATH="$path" timeout 300 bash "$ENSURE") > "$dir/out.txt" 2>&1
  RC=$?
  LINES=$(grep -c '' "$dir/out.txt")
  OUT=$(cat "$dir/out.txt")
}

# calls.log에서 패턴과 정확히 같은 첫 줄의 번호(없으면 0)
line_of() { local n; n=$(grep -n -x -m1 -- "$2" "$1/calls.log" | cut -d: -f1); echo "${n:-0}"; }
last_line_of() { local n; n=$(grep -n -x -- "$2" "$1/calls.log" | tail -1 | cut -d: -f1); echo "${n:-0}"; }

# ---------------------------------------------------------------- C1 이미 켜져 있음
C1=$TMP/c1
make_case "$C1" up fail
run_ensure "$C1" "$C1/bin:$SAFE_PATH"
OUT_C1=$OUT
expect "C1: docker info 성공이면 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "rc=$RC out=$OUT"
expect "C1: docker desktop start를 부르지 않는다" "$(grep -q '^desktop' "$C1/calls.log" && echo 1 || echo 0)" "calls=$(tr '\n' '|' < "$C1/calls.log")"
expect "C1: 출력이 정확히 한 줄" "$([ "$LINES" = 1 ]; echo $?)" "lines=$LINES out=$OUT"

# ---------------------------------------------------------------- C2 꺼져 있고 켤 수 있음
C2=$TMP/c2
make_case "$C2" down ok
run_ensure "$C2" "$C2/bin:$SAFE_PATH"
OUT_C2=$OUT
expect "C2: 켠 뒤 응답하면 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "rc=$RC out=$OUT"
FIRST_INFO=$(line_of "$C2" "info")
START=$(line_of "$C2" "desktop start --timeout 180")
LAST_INFO=$(last_line_of "$C2" "info")
expect "C2: 처음에 docker info로 확인한다" "$([ "$FIRST_INFO" = 1 ]; echo $?)" "calls=$(tr '\n' '|' < "$C2/calls.log")"
expect "C2: docker desktop start --timeout 180을 인자 그대로 부른다" "$([ "$START" -gt "$FIRST_INFO" ]; echo $?)" "calls=$(tr '\n' '|' < "$C2/calls.log")"
expect "C2: 켠 뒤 docker info로 다시 확인한다" "$([ "$START" -gt 0 ] && [ "$LAST_INFO" -gt "$START" ]; echo $?)" "calls=$(tr '\n' '|' < "$C2/calls.log")"
expect "C2: 출력이 정확히 한 줄" "$([ "$LINES" = 1 ]; echo $?)" "lines=$LINES out=$OUT"

# ---------------------------------------------------------------- C3 docker 명령이 없음
C3=$TMP/c3
mkdir -p "$C3"
: > "$C3/calls.log"
run_ensure "$C3" "$SAFE_PATH"
OUT_C3=$OUT
expect "C3: docker 명령이 없으면 0이 아닌 종료 코드" "$([ "$RC" != 0 ]; echo $?)" "rc=$RC out=$OUT"
expect "C3: 출력이 정확히 한 줄(원인)" "$([ "$LINES" = 1 ]; echo $?)" "lines=$LINES out=$OUT"

# ---------------------------------------------------------------- C4 켜기 실패
C4=$TMP/c4
make_case "$C4" down fail
run_ensure "$C4" "$C4/bin:$SAFE_PATH"
OUT_C4=$OUT
expect "C4: 켜기가 실패하면 0이 아닌 종료 코드" "$([ "$RC" != 0 ]; echo $?)" "rc=$RC out=$OUT"
expect "C4: (준비 확인) desktop start를 불렀다" "$([ "$(line_of "$C4" "desktop start --timeout 180")" -gt 0 ]; echo $?)" "calls=$(tr '\n' '|' < "$C4/calls.log")"
expect "C4: 출력이 정확히 한 줄(원인)" "$([ "$LINES" = 1 ]; echo $?)" "lines=$LINES out=$OUT"

# ---------------------------------------------------------------- C5 켠 뒤에도 응답 없음
C5=$TMP/c5
make_case "$C5" down ok-but-down
run_ensure "$C5" "$C5/bin:$SAFE_PATH"
OUT_C5=$OUT
START=$(line_of "$C5" "desktop start --timeout 180")
LAST_INFO=$(last_line_of "$C5" "info")
expect "C5: 켠 뒤에도 응답하지 않으면 0이 아닌 종료 코드" "$([ "$RC" != 0 ]; echo $?)" "rc=$RC out=$OUT"
expect "C5: (준비 확인) desktop start 뒤에 다시 확인했다" "$([ "$START" -gt 0 ] && [ "$LAST_INFO" -gt "$START" ]; echo $?)" "calls=$(tr '\n' '|' < "$C5/calls.log")"
expect "C5: 출력이 정확히 한 줄(원인)" "$([ "$LINES" = 1 ]; echo $?)" "lines=$LINES out=$OUT"

# ---------------------------------------------------------------- C6 상황마다 다른 줄
expect "C6: 이미 켜져 있음(C1)과 켰음(C2)의 줄이 다르다" "$([ "$OUT_C1" != "$OUT_C2" ]; echo $?)" "C1=$OUT_C1 C2=$OUT_C2"
distinct=0
for a in "$OUT_C3" "$OUT_C4" "$OUT_C5"; do
  for b in "$OUT_C1" "$OUT_C2"; do [ "$a" = "$b" ] && distinct=1; done
done
[ "$OUT_C3" = "$OUT_C4" ] && distinct=1
[ "$OUT_C3" = "$OUT_C5" ] && distinct=1
[ "$OUT_C4" = "$OUT_C5" ] && distinct=1
expect "C6: 실패 원인 줄(C3, C4, C5)이 서로 다르고 성공 줄과도 다르다" "$distinct" "C1=$OUT_C1 | C2=$OUT_C2 | C3=$OUT_C3 | C4=$OUT_C4 | C5=$OUT_C5"
echo "     (outputs) C1=$OUT_C1 | C2=$OUT_C2 | C3=$OUT_C3 | C4=$OUT_C4 | C5=$OUT_C5"

echo "passed $PASS, failed $FAIL"
[ "$FAIL" = 0 ]
