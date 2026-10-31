#!/usr/bin/env bash
# [spec] 확인 스크립트(check-db-migrations.sh, run-llm-smoke.sh)의 잠금, --expect-requests, bootJar 테스트(qa).
# 작업 034 시나리오 H1~H6, K1~K9, GR1~GR2(02-qa-scenarios.md).
# 임시 폴더에 가짜 공개·비공개 저장소(git init)를 만들고 지금 저장소의 scripts/dev(tests 빼고)를 복사해, 진짜 스크립트를 돌린다.
# apps/backend/gradlew는 가짜(받은 인자를 남기고, 환경 변수대로 멈추거나 실패한다), gradlew.bat은 늘 0을 돌려준다.
# PATH 맨 앞에 가짜 docker·node를 둔다. 가짜 docker는 info에 성공하고 ps에 wl-check 컨테이너가 없다고 답하며,
# network create와 run을 거부한다(컨테이너 단계에서 스크립트가 FAIL로 멈춘다). 가짜 node는 케이스 형식 확인에서
# 기본 세트는 6, 이름에 extra가 든 파일은 3을 내고, --base-url을 받으면(= OpenAI를 부르는 회귀) 기록만 남긴다.
# 진짜 docker가 있는 PATH 폴더는 빼므로 진짜 Docker, 진짜 .env, 진짜 private/는 건드리지 않는다.
# 스크립트가 bootJar·컨테이너 단계까지 가려면 이 컴퓨터의 3307, 6380, 18080 포트가 비어 있어야 한다. 쓰이고 있으면
# 그 시나리오는 "확인할 수 없음"으로 FAIL을 남긴다.
#
#   bash scripts/dev/tests/check-scripts-lock.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
DEV=$(cd "$HERE/.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false "$@"; }

REAL_NODE=$(command -v node) || { echo "FAIL setup: node not found"; exit 1; }
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
wpath() { (cd "$1" && { pwd -W 2> /dev/null || pwd -P; }) | tr '[:upper:]' '[:lower:]'; }
port_in_use() { (exec 3<> "/dev/tcp/127.0.0.1/$1") 2> /dev/null; }
PORTS_BUSY=""
for p in 3307 6380 18080; do port_in_use "$p" && PORTS_BUSY="$PORTS_BUSY $p"; done

# ---------------------------------------------------------------- 가짜 도구
BIN="$TMP/bin"
mkdir -p "$BIN"
cat > "$BIN/docker" << 'EOF'
#!/usr/bin/env bash
echo "args=$*" >> "$QA_LOG/docker.log"
case "${1:-}" in
  info) printf 'Server:\n Server Version: 99.0.0-fake\n'; exit 0 ;;
  ps) exit 0 ;;
  network) [ "${2:-}" = create ] && { echo "fake: network create refused" >&2; exit 1; }; exit 0 ;;
  run) echo "fake: run refused" >&2; exit 1 ;;
  exec) exit 1 ;;
  *) exit 0 ;;
esac
EOF
cat > "$BIN/node" << 'EOF'
#!/usr/bin/env bash
case " $* " in
  *" --base-url "*)
    echo "node $*" >> "$QA_LOG/openai.log"
    exit 0 ;;
  *"run-feedback-quality-check.mjs"*" --dry-run "*)
    echo "node $*" >> "$QA_LOG/node.log"
    case "$*" in
      *extra*) echo "planned: 3 case(s) x 1 = 3 execution(s)" ;;
      *) echo "planned: 6 case(s) x 1 = 6 execution(s)" ;;
    esac
    exit 0 ;;
esac
exec "$QA_REAL_NODE" "$@"
EOF
chmod +x "$BIN/docker" "$BIN/node"

R="$TMP/repo"
mkdir -p "$R/scripts/dev" "$R/apps/backend" "$R/scripts/feedback-quality"
g -C "$R" init -q -b main
printf '/private/\n/.env\n/apps/backend/build/\n' > "$R/.gitignore"
cp "$DEV"/*.sh "$R/scripts/dev/"
cp -r "$DEV/lib" "$R/scripts/dev/"
cat > "$R/apps/backend/gradlew" << 'EOF'
#!/usr/bin/env bash
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
{ echo "call cwd=$cwd"; for a in "$@"; do echo "arg=$a"; done; } >> "$QA_LOG/gradlew.log"
if [ -n "${QA_GRADLE_STATUS:-}" ]; then git -C "$QA_ROOT" status --short > "$QA_LOG/status-during.txt" 2>&1; fi
if [ -n "${QA_GRADLE_BLOCK:-}" ]; then
  touch "$QA_LOG/blocked"
  for _ in $(seq 1 600); do [ -f "$QA_LOG/release" ] && break; sleep 0.2; done
fi
touch "$QA_LOG/gradle-done"
exit "${QA_GRADLE_RC:-0}"
EOF
printf '@exit /b 0\r\n' > "$R/apps/backend/gradlew.bat"
echo '[]' > "$R/scripts/feedback-quality/cases.smoke.json"
g -C "$R" add -A && g -C "$R" commit -q -m base
# run-llm-smoke.sh가 키가 있는지만 본다. 가짜 값이고 .gitignore에 있다.
printf 'OPENAI_API_KEY=qa-fake-not-a-real-key\n' > "$R/.env"
mkdir -p "$R/private/work"
g -C "$R/private" init -q -b main
echo readme > "$R/private/README.md"
g -C "$R/private" add -A && g -C "$R/private" commit -q -m base
mkdir -p "$TMP/cases"
echo '[]' > "$TMP/cases/extra-qa.json"
EXTRA="$TMP/cases/extra-qa.json"

L=""
RC=""
N=0
newlog() { N=$((N + 1)); L="$TMP/log$N-$1"; mkdir -p "$L"; O="$TMP/out$N-$1"; }
# run_check [VAR=값]... -- <스크립트> <인자>... : 진짜 스크립트 사본을 돌린다. 결과 폴더는 O, 종료 코드는 RC.
run_check() {
  local e=()
  while [ $# -gt 0 ] && [ "$1" != -- ]; do e+=("$1"); shift; done
  shift
  local script=$1
  shift
  env QA_LOG="$L" QA_ROOT="$R" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" 'WINDIR=C:\Windows' "${e[@]}" \
    timeout 300 bash "$R/scripts/dev/$script" "$@" > "$L/run.txt" 2>&1
  RC=$?
}
BG_PID=""
BG_LOG=""
# 가짜 gradlew가 bootJar에서 멈추게 해 백그라운드로 시작한다: bg_check <스크립트> <인자>...
bg_check() {
  local script=$1
  shift
  BG_LOG=$L
  env QA_LOG="$L" QA_ROOT="$R" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" 'WINDIR=C:\Windows' QA_GRADLE_BLOCK=1 QA_GRADLE_STATUS=1 \
    bash "$R/scripts/dev/$script" "$@" > "$L/run.txt" 2>&1 &
  BG_PID=$!
}
wait_file() { local i; for i in $(seq 1 300); do [ -f "$1" ] && return 0; sleep 0.2; done; return 1; }
release_bg() { touch "$BG_LOG/release"; wait "$BG_PID" 2> /dev/null; }
show() { echo "rc=$RC summary=$(cat "$O/summary.txt" 2> /dev/null | tr '\n' '|') docker=$(cat "$L/docker.log" 2> /dev/null | tr '\n' '|') run=$(tail -4 "$L/run.txt" 2> /dev/null | tr '\n' '|')"; }
container_calls() { grep -qE '^args=(network create|run)( |$)' "$L/docker.log" 2> /dev/null; }
touched_containers() { grep -qE '^args=(rm|network rm|network create|run)( |$)' "$L/docker.log" 2> /dev/null; }
bootjar_called() { grep -qx 'arg=bootJar' "$L/gradlew.log" 2> /dev/null; }
summary_fail() { grep -q '^FAIL' "$O/summary.txt" 2> /dev/null; }
ports_needed() {
  if [ -n "$PORTS_BUSY" ]; then
    bad "$1: 확인할 수 없음(이 컴퓨터의 포트$PORTS_BUSY가 쓰이고 있어 bootJar·컨테이너 단계까지 가지 못한다)"
    return 1
  fi
}

# ================================================================ H. run-llm-smoke.sh --expect-requests
newlog h1
run_check -- run-llm-smoke.sh --out "$O"
expect "H1: 실제 실행에 --expect-requests가 없으면 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
expect "H1: docker 호출 없음(info 포함), gradlew 호출 없음" "$([ ! -s "$L/docker.log" ] && [ ! -e "$L/gradlew.log" ]; echo $?)" "$(show)"
expect "H1: OpenAI 호출(--base-url) 없음" "$([ ! -e "$L/openai.log" ]; echo $?)" "$(show)"

for n in 6 12; do
  newlog "h-$n"
  run_check -- run-llm-smoke.sh --out "$O" --cases "$EXTRA" --expect-requests "$n"
  id=H2; [ "$n" = 12 ] && id=H3
  expect "$id: 합이 9인데 --expect-requests $n이면 종료 코드 1, summary에 FAIL 줄" "$([ "$RC" = 1 ] && summary_fail; echo $?)" "$(show)"
  expect "$id: OpenAI 호출(--base-url) 없음" "$([ ! -e "$L/openai.log" ]; echo $?)" "$(show)"
  expect "$id: 컨테이너를 띄우는 docker 호출(network create, run)과 gradlew 호출 없음" "$(! container_calls && [ ! -e "$L/gradlew.log" ]; echo $?)" "$(show)"
done

newlog h5
run_check -- run-llm-smoke.sh --out "$O" --cases "$EXTRA" --dry-run
expect "H5: --dry-run에는 --expect-requests가 없어도 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "H5: OK cases valid (cases.smoke): 6 request(s)와 OK cases valid (extra-qa): 3 request(s)" \
  "$(grep -q '^OK cases valid (cases.smoke): 6 request(s)' "$O/summary.txt" && grep -q '^OK cases valid (extra-qa): 3 request(s)' "$O/summary.txt"; echo $?)" "$(show)"
expect "H5: docker·gradlew 호출 없음" "$([ ! -s "$L/docker.log" ] && [ ! -e "$L/gradlew.log" ]; echo $?)" "$(show)"

if ports_needed "H4"; then
  newlog h4
  run_check -- run-llm-smoke.sh --out "$O" --cases "$EXTRA" --expect-requests 9
  expect "H4: 합 9 = --expect-requests 9면 수 확인을 지나 컨테이너 단계까지 감" "$(container_calls; echo $?)" "$(show)"
fi
if ports_needed "H6"; then
  newlog h6
  run_check -- run-llm-smoke.sh --out "$O" --expect-requests 6
  expect "H6: 기본 세트만, --expect-requests 6이면 컨테이너 단계까지 감" "$(container_calls; echo $?)" "$(show)"
fi

# ================================================================ GR. bootJar
if ports_needed "GR1"; then
  newlog gr1
  run_check QA_GRADLE_RC=1 -- check-db-migrations.sh --out "$O"
  expect "GR1: gradlew(sh)가 실패하면(gradlew.bat은 0) summary에 FAIL bootJar로 시작하는 줄" "$(grep -q '^FAIL bootJar' "$O/summary.txt" 2> /dev/null; echo $?)" "$(show)"
  expect "GR1: 종료 코드 1, 컨테이너를 띄우는 docker 호출 없음" "$([ "$RC" = 1 ] && ! container_calls; echo $?)" "$(show)"
fi
if ports_needed "GR2"; then
  newlog gr2
  run_check -- check-db-migrations.sh --out "$O"
  expect "GR2: 가짜 gradlew(sh)가 apps/backend에서 bootJar로 불림" \
    "$(grep -qxF "call cwd=$(wpath "$R/apps/backend")" "$L/gradlew.log" 2> /dev/null && bootjar_called; echo $?)" "gradlew=$(cat "$L/gradlew.log" 2> /dev/null | tr '\n' '|') $(show)"
  expect "GR2: summary에 OK bootJar 줄" "$(grep -qx 'OK bootJar' "$O/summary.txt" 2> /dev/null; echo $?)" "$(show)"
fi

# ================================================================ K. 잠금
# 둘째 실행이 막혔는지: 종료 코드 1, summary FAIL, 컨테이너를 건드리는 docker 호출 없음, bootJar 없음
blocked_checks() {
  local id=$1
  expect "$id: 종료 코드 1, summary에 FAIL 줄" "$([ "$RC" = 1 ] && summary_fail; echo $?)" "$(show)"
  expect "$id: 다른 실행의 컨테이너를 건드리는 docker 호출(rm, network rm, network create, run) 없음" "$(! touched_containers; echo $?)" "$(show)"
  expect "$id: bootJar(가짜 gradlew) 호출 없음" "$([ ! -e "$L/gradlew.log" ]; echo $?)" "$(show)"
}
# 막히지 않았는지: bootJar가 불리고 컨테이너 단계까지 감
went_through() {
  local id=$1
  expect "$id: 잠금에 막히지 않고 bootJar가 불림" "$(bootjar_called; echo $?)" "$(show)"
  expect "$id: 컨테이너 단계(network create 또는 run)까지 감" "$(container_calls; echo $?)" "$(show)"
}

if ports_needed "K1·K3·K4·K5·K7·K9"; then
  # work.sh run(K9)을 쓸 작업 폴더. private/는 공개 저장소가 무시한다.
  WD="$R/$(cd "$R" && WORK_ROOT="$R" bash "$R/scripts/dev/work.sh" new lock 2>&1)"
  newlog k1-first
  FIRST_O=$O
  bg_check check-db-migrations.sh --out "$O"
  if wait_file "$BG_LOG/blocked"; then
    newlog k1-second
    run_check -- run-llm-smoke.sh --out "$O" --expect-requests 6
    blocked_checks "K1(첫째 check-db가 bootJar 중, 둘째 run-llm-smoke)"
    newlog k4-third
    run_check -- check-db-migrations.sh --out "$O"
    blocked_checks "K3·K4(첫째가 아직 bootJar 중, 셋째 check-db)"
    expect "K7: 잠금을 잡은 동안 공개 저장소 git status --short가 빔" \
      "$([ -f "$BG_LOG/status-during.txt" ] && [ ! -s "$BG_LOG/status-during.txt" ]; echo $?)" "status=$(cat "$BG_LOG/status-during.txt" 2> /dev/null | tr '\n' '|')"
    expect "K7: 첫째 summary.txt 첫 줄이 uncommitted 0으로 끝남" "$(head -1 "$FIRST_O/summary.txt" 2> /dev/null | grep -q 'uncommitted 0$'; echo $?)" "first=$(head -1 "$FIRST_O/summary.txt" 2> /dev/null)"
    newlog k9
    out=$(cd "$R" && env WORK_ROOT="$R" QA_LOG="$L" QA_ROOT="$R" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" 'WINDIR=C:\Windows' \
      bash "$R/scripts/dev/work.sh" run "$WD" --name k9 --only db-check 2>&1)
    RC=$?
    expect "K9: 직접 돌린 check-db가 잡고 있으면 work.sh run의 db-check는 FAIL db-check db-check.txt, 종료 코드 1" \
      "$(grep -qxF 'FAIL db-check db-check.txt' "$WD"/[0-9][0-9]-runner-k9/summary.txt 2> /dev/null && [ "$RC" = 1 ]; echo $?)" "rc=$RC out=$(echo "$out" | tr '\n' '|')"
    expect "K9: 그 db-check의 docker 호출에 rm, network rm, network create, run 없음" "$(! touched_containers; echo $?)" "docker=$(cat "$L/docker.log" 2> /dev/null | tr '\n' '|')"
  else
    bad "K1: (준비) 첫째 check-db가 bootJar에서 멈추지 않았다" "run=$(tail -5 "$BG_LOG/run.txt" 2> /dev/null | tr '\n' '|') summary=$(cat "$FIRST_O/summary.txt" 2> /dev/null | tr '\n' '|')"
  fi
  release_bg
  expect "K5: (준비) 풀어 준 첫째는 컨테이너 단계에서 FAIL로 끝남" "$(grep -q '^FAIL' "$FIRST_O/summary.txt" 2> /dev/null; echo $?)" "summary=$(cat "$FIRST_O/summary.txt" 2> /dev/null | tr '\n' '|')"
  newlog k5-next
  run_check -- check-db-migrations.sh --out "$O"
  went_through "K5(첫째가 FAIL로 끝난 뒤 다음 check-db)"

  # K8: work.sh run의 db-check가 work.sh run 자기 잠금에 막히지 않는다.
  newlog k8
  out=$(cd "$R" && env WORK_ROOT="$R" QA_LOG="$L" QA_ROOT="$R" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" 'WINDIR=C:\Windows' \
    bash "$R/scripts/dev/work.sh" run "$WD" --name k8 --only db-check 2>&1)
  RC=$?
  went_through "K8(work.sh run --only db-check)"
  expect "K8: summary의 db-check 줄은 가짜 docker 거부 때문에 FAIL db-check db-check.txt" \
    "$(grep -qxF 'FAIL db-check db-check.txt' "$WD"/[0-9][0-9]-runner-k8/summary.txt 2> /dev/null; echo $?)" "rc=$RC out=$(echo "$out" | tr '\n' '|')"
fi

if ports_needed "K2"; then
  newlog k2-first
  FIRST_O=$O
  bg_check run-llm-smoke.sh --out "$O" --expect-requests 6
  if wait_file "$BG_LOG/blocked"; then
    newlog k2-second
    run_check -- check-db-migrations.sh --out "$O"
    blocked_checks "K2(첫째 run-llm-smoke가 bootJar 중, 둘째 check-db)"
  else
    bad "K2: (준비) 첫째 run-llm-smoke가 bootJar에서 멈추지 않았다" "run=$(tail -5 "$BG_LOG/run.txt" 2> /dev/null | tr '\n' '|') summary=$(cat "$FIRST_O/summary.txt" 2> /dev/null | tr '\n' '|')"
  fi
  release_bg
fi

if ports_needed "K6"; then
  newlog k6-killed
  bg_check check-db-migrations.sh --out "$O"
  if wait_file "$BG_LOG/blocked"; then
    kill -9 "$BG_PID" 2> /dev/null
    wait "$BG_PID" 2> /dev/null
    touch "$BG_LOG/release"
    wait_file "$BG_LOG/gradle-done"
    sleep 1
    newlog k6-next
    run_check -- check-db-migrations.sh --out "$O"
    went_through "K6(kill -9로 남은 잠금 뒤 다음 check-db)"
  else
    bad "K6: (준비) 첫째 check-db가 bootJar에서 멈추지 않았다" "run=$(tail -5 "$BG_LOG/run.txt" 2> /dev/null | tr '\n' '|')"
    release_bg
  fi
fi

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
