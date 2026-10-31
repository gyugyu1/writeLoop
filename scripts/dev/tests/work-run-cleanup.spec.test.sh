#!/usr/bin/env bash
# [spec] scripts/dev/work.sh run의 임시 컨테이너·백엔드 정리 확인 테스트(qa). 작업 035 시나리오 CL1~CL19(02-qa-scenarios.md)와
# 03-main-decision.md의 1(docker ps 실패와 포트를 한 줄에), 3(나누는 문자와 중복), 4(새 줄의 위치).
# 임시 폴더에 가짜 공개·비공개 저장소를 만들고 지금 저장소의 scripts/dev(tests 빼고)를 복사한 뒤 apps/backend/gradlew,
# scripts/dev/ensure-docker.sh, check-db-migrations.sh, run-llm-smoke.sh를 가짜로 바꾼다.
# PATH 맨 앞에 가짜 docker(ps는 QA_PS_LIST의 컨테이너를 진짜처럼 답한다), netstat(QA_NETSTAT_FILE을 Windows 모양으로 출력),
# taskkill, node(--test만 가짜), npm, npm.cmd를 둔다. 진짜 docker가 있는 PATH 폴더는 뺀다. "netstat이 없음"은 가짜 netstat을
# 두지 않고 netstat이 있는 PATH 폴더(System32 등)도 뺀 상태다. 진짜 Docker, 진짜 포트, 진짜 저장소·private/·.env는 건드리지 않는다.
#
#   bash scripts/dev/tests/work-run-cleanup.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
DEV=$(cd "$HERE/.." && pwd -P)
TMP=$(mktemp -d)
SLEEP_PID=""
trap '[ -n "$SLEEP_PID" ] && kill "$SLEEP_PID" 2> /dev/null; rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false "$@"; }

REAL_NODE=$(command -v node) || { echo "FAIL setup: node not found"; exit 1; }

# 진짜 docker가 있는 폴더를 뺀 PATH, 거기서 netstat이 있는 폴더도 뺀 PATH
SAFE_PATH=""
NONET_PATH=""
IFS=: read -r -a PATH_DIRS <<< "$PATH"
for d in "${PATH_DIRS[@]}"; do
  [ -n "$d" ] || continue
  if [ -e "$d/docker" ] || [ -e "$d/docker.exe" ]; then continue; fi
  SAFE_PATH="${SAFE_PATH:+$SAFE_PATH:}$d"
  if [ -e "$d/netstat" ] || [ -e "$d/netstat.exe" ] || [ -e "$d/NETSTAT.EXE" ]; then continue; fi
  NONET_PATH="${NONET_PATH:+$NONET_PATH:}$d"
done
if PATH="$SAFE_PATH" command -v docker > /dev/null 2>&1; then
  echo "FAIL setup: a real docker is still on the test PATH; refusing to run"
  exit 1
fi

# ---------------------------------------------------------------- 가짜 도구
BIN="$TMP/bin"       # netstat 있음
BIN_NONET="$TMP/bin-nonet" # netstat 없음
mkdir -p "$BIN" "$BIN_NONET"
cat > "$BIN/docker" << 'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$QA_LOG/seq.log"
echo "$*" >> "$QA_LOG/docker.log"
[ "${1:-}" = ps ] || exit 0
if [ "${QA_PS_RC:-0}" != 0 ]; then echo "fake: Cannot connect to the Docker daemon" >&2; exit "$QA_PS_RC"; fi
shift
all=0 quiet=0 fmt="" filt=""
while [ $# -gt 0 ]; do
  case "$1" in
    -a | --all) all=1 ;;
    -q | --quiet) quiet=1 ;;
    -aq | -qa) all=1 quiet=1 ;;
    --format) fmt=${2:-}; shift ;;
    --format=*) fmt=${1#--format=} ;;
    --filter | -f) filt=${2:-}; shift ;;
    --filter=*) filt=${1#--filter=} ;;
  esac
  shift
done
rows=()
for c in ${QA_PS_LIST:-}; do
  n=${c%%:*} s=${c#*:}
  [ "$all" = 1 ] || [ "$s" = up ] || continue
  case "$filt" in name=*) printf '%s\n' "$n" | grep -qE -- "${filt#name=}" || continue ;; esac
  rows+=("$n:$s")
done
i=0
if [ "$quiet" = 1 ]; then
  for r in "${rows[@]}"; do i=$((i + 1)); printf '%012d\n' "$i"; done
elif [ -n "$fmt" ]; then
  for r in "${rows[@]}"; do
    i=$((i + 1)); n=${r%%:*}; s=${r#*:}
    [ "$s" = up ] && st="Up 2 minutes" || st="Exited (0) 1 minute ago"
    o=${fmt//\{\{.Names\}\}/$n}; o=${o//\{\{.ID\}\}/$(printf '%012d' "$i")}; o=${o//\{\{.Status\}\}/$st}; o=${o//\\t/$'\t'}
    printf '%s\n' "$o"
  done
else
  printf 'CONTAINER ID   IMAGE         COMMAND   CREATED         STATUS                    PORTS   NAMES\n'
  for r in "${rows[@]}"; do
    i=$((i + 1)); n=${r%%:*}; s=${r#*:}
    [ "$s" = up ] && st="Up 2 minutes" || st="Exited (0) 1 minute ago"
    printf '%012d   mysql:8.4.8   "x"       2 minutes ago   %-25s         %s\n' "$i" "$st" "$n"
  done
fi
exit 0
EOF
cat > "$BIN/netstat" << 'EOF'
#!/usr/bin/env bash
echo "netstat $*" >> "$QA_LOG/seq.log"
printf '\r\nActive Connections\r\n\r\n  Proto  Local Address          Foreign Address        State           PID\r\n'
if [ -n "${QA_NETSTAT_FILE:-}" ] && [ -f "$QA_NETSTAT_FILE" ]; then sed 's/$/\r/' "$QA_NETSTAT_FILE"; fi
exit 0
EOF
cat > "$BIN/taskkill" << 'EOF'
#!/usr/bin/env bash
echo "taskkill $*" >> "$QA_LOG/seq.log"
echo "$*" >> "$QA_LOG/taskkill.log"
exit 0
EOF
cat > "$BIN/node" << 'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = --test ]; then echo "node $*" >> "$QA_LOG/seq.log"; echo "fake node --test"; exit 0; fi
exec "$QA_REAL_NODE" "$@"
EOF
cat > "$BIN/npm-fake.sh" << 'EOF'
#!/usr/bin/env bash
as=$1
shift
echo "$as $*" >> "$QA_LOG/seq.log"
exit 0
EOF
printf '#!/usr/bin/env bash\nexec bash "$(dirname "$0")/npm-fake.sh" npm "$@"\n' > "$BIN/npm"
BASH_W=$(cygpath -w "$(command -v bash)" 2> /dev/null || command -v bash)
printf '@"%s" "%%~dp0npm-fake.sh" npm.cmd %%*\r\n@exit /b %%ERRORLEVEL%%\r\n' "$BASH_W" > "$BIN/npm.cmd"
chmod +x "$BIN"/*
for f in docker taskkill node npm-fake.sh npm npm.cmd; do cp "$BIN/$f" "$BIN_NONET/$f"; done
chmod +x "$BIN_NONET"/*
NETSTAT_MISSING_OK=0
PATH="$BIN_NONET:$NONET_PATH" command -v netstat > /dev/null 2>&1 || NETSTAT_MISSING_OK=1

# ---------------------------------------------------------------- 가짜 저장소
put() { mkdir -p "$(dirname "$1/$2")"; printf '%s\n' "$3" > "$1/$2"; }
R="$TMP/repo"
mkdir -p "$R/scripts/dev/tests"
g -C "$R" init -q -b main
printf '/private/\n' > "$R/.gitignore"
cp "$DEV"/*.sh "$R/scripts/dev/"
cp -r "$DEV/lib" "$R/scripts/dev/"
mkdir -p "$R/apps/backend"
cat > "$R/apps/backend/gradlew" << 'EOF'
#!/usr/bin/env bash
echo "gradlew $*" >> "$QA_LOG/seq.log"
exit 0
EOF
printf '@exit /b 0\r\n' > "$R/apps/backend/gradlew.bat"
cat > "$R/scripts/dev/ensure-docker.sh" << 'EOF'
#!/usr/bin/env bash
echo "ensure-docker" >> "$QA_LOG/seq.log"
if [ -n "${QA_DOCKER_FAIL:-}" ]; then echo "docker: FAIL fake cannot start"; exit 1; fi
echo "docker: already running"
EOF
cat > "$R/scripts/dev/check-db-migrations.sh" << 'EOF'
#!/usr/bin/env bash
echo "check-db $*" >> "$QA_LOG/seq.log"
exit "${QA_CHECKDB_RC:-0}"
EOF
cat > "$R/scripts/dev/run-llm-smoke.sh" << 'EOF'
#!/usr/bin/env bash
echo "run-llm $*" >> "$QA_LOG/seq.log"
exit "${QA_LLM_RC:-0}"
EOF
put "$R" scripts/feedback-quality/rules.mjs '// rules'
put "$R" apps/frontend/app/page.tsx '// page'
put "$R" package.json '{}'
put "$R" infra/nginx/prod.conf '# nginx'
put "$R" docs/README.md 'docs'
g -C "$R" add -A && g -C "$R" commit -q -m base
mkdir -p "$R/private/work"
g -C "$R/private" init -q -b main
echo readme > "$R/private/README.md"
g -C "$R/private" add -A && g -C "$R/private" commit -q -m base

L=""
D=""
OUT=""
RC=""
SUM=""
NS_FILE=""
# 새 기록 폴더(L)와 작업 폴더(D, 기준 커밋 = 지금 HEAD). 기준 커밋 뒤에 docs/a.md 변경을 커밋한다.
scenario() {
  local out
  L="$TMP/log-$1"
  mkdir -p "$L"
  NS_FILE="$L/netstat.txt"
  : > "$NS_FILE"
  out=$(cd "$R" && WORK_ROOT="$R" bash "$R/scripts/dev/work.sh" new "$1" 2>&1) || bad "$1: (준비) work.sh new 실패" "$out"
  D="$R/$out"
  commit_paths "$1" docs/a.md
}
commit_paths() {
  local msg=$1 p
  shift
  for p in "$@"; do mkdir -p "$(dirname "$R/$p")"; echo "# qa change $msg" >> "$R/$p"; done
  g -C "$R" add -A && g -C "$R" commit -q -m "$msg"
}
# netstat 출력 줄(머리말 뒤)을 정한다
ns() { printf '%s\n' "$@" > "$NS_FILE"; }
# wsh [nonet] [VAR=값]... -- <work.sh 인자>
wsh() {
  local envs=() path="$BIN:$SAFE_PATH"
  if [ "${1:-}" = nonet ]; then path="$BIN_NONET:$NONET_PATH"; shift; fi
  while [ $# -gt 0 ] && [ "$1" != -- ]; do envs+=("$1"); shift; done
  [ "${1:-}" = -- ] && shift
  OUT=$(cd "$R" && env WORK_ROOT="$R" QA_LOG="$L" QA_REAL_NODE="$REAL_NODE" QA_NETSTAT_FILE="$NS_FILE" PATH="$path" "${envs[@]}" \
    bash "$R/scripts/dev/work.sh" "$@" 2>&1)
  RC=$?
  local rd
  rd=$(ls -d "$D"/[0-9][0-9]-runner-*/ 2> /dev/null | sort | tail -1)
  SUM="${rd%/}/summary.txt"
}
H() { git -C "$R" rev-parse HEAD; }
flat() { cat "$1" 2> /dev/null | tr '\n' '|'; }
show() { echo "rc=$RC summary=$(flat "$SUM") seq=$(flat "$L/seq.log") out-tail=$(echo "$OUT" | tail -n 6 | tr '\n' '|')"; }
has_line() { grep -qxF -- "$1" "$SUM" 2> /dev/null; }
no_cleanup() { ! grep -q cleanup "$SUM" 2> /dev/null && ! echo "$OUT" | grep -q cleanup; }
cleanup_count() { grep -c ' cleanup: ' "$SUM" 2> /dev/null; }
fail_cleanup_count() { grep -c '^FAIL cleanup: ' "$SUM" 2> /dev/null; }
# summary 줄 전체가 정확히 인자들(순서대로)
sum_exact() { [ "$(cat "$SUM" 2> /dev/null)" = "$(printf '%s\n' "$@")" ]; }
out_has() { echo "$OUT" | grep -qxF -- "$1"; }
# 정리 확인을 했다: docker ps(-a 또는 --all) 호출과 netstat 호출이 있다
ps_all_called() { grep -E '^ps( |$)' "$L/docker.log" 2> /dev/null | grep -qE '(^| )(-a|--all|-[a-zA-Z]*a[a-zA-Z]*)( |$)'; }
ps_called() { grep -qE '^ps( |$)' "$L/docker.log" 2> /dev/null; }
netstat_called() { grep -q '^netstat' "$L/seq.log" 2> /dev/null; }
checked() { ps_all_called && netstat_called; }
# seq.log에서 정리 확인 호출(docker ps, netstat)이 모두 패턴($1)의 마지막 호출보다 뒤
after() {
  local last first_check
  last=$(grep -nE "$1" "$L/seq.log" 2> /dev/null | tail -n 1 | cut -d: -f1)
  first_check=$(grep -nE '^(docker ps|netstat)( |$)' "$L/seq.log" 2> /dev/null | head -n 1 | cut -d: -f1)
  [ -n "$last" ] && [ -n "$first_check" ] && [ "$first_check" -gt "$last" ]
}

NS_4242='  TCP    0.0.0.0:18080          0.0.0.0:0              LISTENING       4242'

# ================================================================ 남은 것이 없을 때
scenario cl1
wsh -- run "$D" --name impl --only db-check
expect "CL1: summary가 정확히 HEAD·OK docker·OK db-check 세 줄" "$(sum_exact "HEAD $(H) | uncommitted 0" "OK docker: already running" "OK db-check db-check.txt"; echo $?)" "$(show)"
expect "CL1: summary와 표준 출력에 cleanup 없음" "$(no_cleanup; echo $?)" "$(show)"
expect "CL1: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "CL1: 정리 확인을 했다(docker ps -a, netstat)" "$(checked; echo $?)" "$(show) docker=$(flat "$L/docker.log")"
expect "CL1: 정리 확인이 가짜 check-db 호출보다 뒤" "$(after '^check-db '; echo $?)" "$(show)"

scenario cl2
wsh -- run "$D" --name impl --only rules-test --llm-approved 6
expect "CL2: summary가 정확히 HEAD·OK docker·OK rules-test·OK llm-smoke 네 줄" \
  "$(sum_exact "HEAD $(H) | uncommitted 0" "OK docker: already running" "OK rules-test rules-test.txt" "OK llm-smoke llm-smoke.txt"; echo $?)" "$(show)"
expect "CL2: cleanup 없음, 종료 코드 0" "$(no_cleanup && [ "$RC" = 0 ]; echo $?)" "$(show)"
expect "CL2: 정리 확인을 했고 가짜 run-llm 호출보다 뒤" "$(checked && after '^run-llm '; echo $?)" "$(show) docker=$(flat "$L/docker.log")"

scenario cl3
ns '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1111' \
  '  TCP    0.0.0.0:18081          0.0.0.0:0              LISTENING       2222' \
  '  TCP    0.0.0.0:28080          0.0.0.0:0              LISTENING       3333' \
  '  TCP    127.0.0.1:18080        127.0.0.1:50000        TIME_WAIT       0' \
  '  TCP    127.0.0.1:50002        127.0.0.1:18080        ESTABLISHED     5555'
wsh QA_PS_LIST="mysql-dev:up my-wl-check-x:exited wlcheck-old:exited" -- run "$D" --name impl --only db-check
expect "CL3: wl-check-로 시작하지 않는 컨테이너, 18080 LISTENING이 아닌 줄만 있으면 정확히 세 줄" \
  "$(sum_exact "HEAD $(H) | uncommitted 0" "OK docker: already running" "OK db-check db-check.txt"; echo $?)" "$(show)"
expect "CL3: cleanup 없음, 종료 코드 0" "$(no_cleanup && [ "$RC" = 0 ]; echo $?)" "$(show)"

# ================================================================ 남은 것이 있을 때
scenario cl4
wsh QA_PS_LIST="wl-check-mysql:exited" -- run "$D" --name impl --only db-check
expect "CL4: 멈춘 wl-check-mysql이면 summary에 정확히 FAIL cleanup: wl-check-mysql" "$(has_line "FAIL cleanup: wl-check-mysql"; echo $?)" "$(show)"
expect "CL4: cleanup 줄은 그것 하나" "$([ "$(cleanup_count)" = 1 ]; echo $?)" "$(show)"
expect "CL4: OK db-check db-check.txt 그대로" "$(has_line "OK db-check db-check.txt"; echo $?)" "$(show)"
expect "CL4: 표준 출력에도 FAIL cleanup: wl-check-mysql" "$(out_has "FAIL cleanup: wl-check-mysql"; echo $?)" "$(show)"
expect "CL4: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

scenario cl5
ns "$NS_4242"
wsh -- run "$D" --name impl --only db-check
expect "CL5: summary에 정확히 FAIL cleanup: port 18080 LISTENING pid 4242" "$(has_line "FAIL cleanup: port 18080 LISTENING pid 4242"; echo $?)" "$(show)"
expect "CL5: cleanup 줄은 그것 하나, 종료 코드 1" "$([ "$(cleanup_count)" = 1 ] && [ "$RC" = 1 ]; echo $?)" "$(show)"

scenario cl6
ns '  TCP    [::]:18080             [::]:0                 LISTENING       5151'
wsh -- run "$D" --name impl --only db-check
expect "CL6: IPv6로 듣는 줄이면 정확히 FAIL cleanup: port 18080 LISTENING pid 5151" "$(has_line "FAIL cleanup: port 18080 LISTENING pid 5151"; echo $?)" "$(show)"
expect "CL6: cleanup 줄은 그것 하나, 종료 코드 1" "$([ "$(cleanup_count)" = 1 ] && [ "$RC" = 1 ]; echo $?)" "$(show)"

CL7_LIST="wl-check-mysql:up wl-check-redis:exited mysql-dev:up"
CL7_NS1="$NS_4242"
CL7_NS2='  TCP    [::]:18080             [::]:0                 LISTENING       6262'
scenario cl7
ns "$CL7_NS1" "$CL7_NS2"
wsh QA_PS_LIST="$CL7_LIST" -- run "$D" --name impl --only db-check
FL=$(grep '^FAIL cleanup: ' "$SUM" 2> /dev/null)
expect "CL7: FAIL cleanup: 줄이 정확히 하나" "$([ "$(fail_cleanup_count)" = 1 ]; echo $?)" "$(show)"
expect "CL7: 그 줄에 wl-check-mysql, wl-check-redis, port 18080 LISTENING pid" \
  "$(case "$FL" in *wl-check-mysql*) ;; *) false ;; esac && case "$FL" in *wl-check-redis*) ;; *) false ;; esac && case "$FL" in *"port 18080 LISTENING pid"*) ;; *) false ;; esac; echo $?)" "line=$FL"
PIDPART=${FL#*port 18080 LISTENING pid}
expect "CL7: pid 뒤에 4242와 6262" "$(case "$PIDPART" in *4242*) ;; *) false ;; esac && case "$PIDPART" in *6262*) ;; *) false ;; esac; echo $?)" "line=$FL"
expect "CL7: mysql-dev는 없음" "$(case "$FL" in *mysql-dev*) false ;; esac; echo $?)" "line=$FL"
expect "CL7: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
# 03-main-decision 3: 이름끼리·pid끼리 공백 하나, 컨테이너와 포트 사이 "; "
re='^FAIL cleanup: ([^ ;]+( [^ ;]+)*); port 18080 LISTENING pid ([0-9]+( [0-9]+)*)$'
if [[ $FL =~ $re ]]; then
  names=$(printf '%s\n' "${BASH_REMATCH[1]}" | tr ' ' '\n' | sort | tr '\n' ' ')
  pids=$(printf '%s\n' "${BASH_REMATCH[3]}" | tr ' ' '\n' | sort | tr '\n' ' ')
  expect "DEC3: 컨테이너 이름이 정확히 wl-check-mysql, wl-check-redis(공백 하나로 나눔)" "$([ "$names" = "wl-check-mysql wl-check-redis " ]; echo $?)" "line=$FL"
  expect "DEC3: pid가 정확히 4242, 6262(공백 하나로 나눔)" "$([ "$pids" = "4242 6262 " ]; echo $?)" "line=$FL"
else
  bad "DEC3: 줄 모양이 'FAIL cleanup: <이름> <이름>; port 18080 LISTENING pid <pid> <pid>'" "line=$FL"
fi

scenario dec3b
ns "$NS_4242" '  TCP    [::]:18080             [::]:0                 LISTENING       4242'
wsh -- run "$D" --name impl --only db-check
expect "DEC3: IPv4·IPv6 두 줄에 같은 pid면 한 번만: 정확히 FAIL cleanup: port 18080 LISTENING pid 4242" \
  "$(has_line "FAIL cleanup: port 18080 LISTENING pid 4242"; echo $?)" "$(show)"

scenario cl8
sleep 300 &
SLEEP_PID=$!
ns "$CL7_NS1" "$CL7_NS2" "  TCP    127.0.0.1:18080        0.0.0.0:0              LISTENING       $SLEEP_PID"
wsh QA_PS_LIST="$CL7_LIST" -- run "$D" --name impl --only db-check
FL=$(grep '^FAIL cleanup: ' "$SUM" 2> /dev/null)
expect "CL8: (CL7대로) FAIL cleanup 줄 하나에 두 컨테이너와 세 pid" \
  "$([ "$(fail_cleanup_count)" = 1 ] && case "$FL" in *wl-check-mysql*wl-check-redis* | *wl-check-redis*wl-check-mysql*) ;; *) false ;; esac && case "${FL#*pid}" in *4242*) ;; *) false ;; esac && case "${FL#*pid}" in *6262*) ;; *) false ;; esac && case "${FL#*pid}" in *"$SLEEP_PID"*) ;; *) false ;; esac; echo $?)" "line=$FL"
expect "CL8: 가짜 docker에 지우거나 멈추는 호출 없음" \
  "$(! grep -qE '^((rm|stop|kill|rmi)( |$)|container (rm|stop|kill|prune)( |$)|network (rm|prune)( |$)|system prune( |$))' "$L/docker.log" 2> /dev/null; echo $?)" "docker=$(flat "$L/docker.log")"
expect "CL8: 가짜 taskkill 호출 없음" "$([ ! -e "$L/taskkill.log" ]; echo $?)" "taskkill=$(flat "$L/taskkill.log")"
expect "CL8: 18080 pid로 보고된 백그라운드 프로세스가 실행 뒤에도 살아 있음" "$(kill -0 "$SLEEP_PID" 2> /dev/null; echo $?)" "pid=$SLEEP_PID"
kill "$SLEEP_PID" 2> /dev/null
SLEEP_PID=""

scenario cl9
wsh QA_CHECKDB_RC=1 QA_PS_LIST="wl-check-mysql:exited" -- run "$D" --name impl --only db-check
expect "CL9: db-check 실패에도 FAIL db-check db-check.txt와 정확히 FAIL cleanup: wl-check-mysql" \
  "$(has_line "FAIL db-check db-check.txt" && has_line "FAIL cleanup: wl-check-mysql"; echo $?)" "$(show)"
expect "CL9: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

scenario cl10
wsh QA_CHECKDB_RC=1 -- run "$D" --name impl --only db-check
expect "CL10: FAIL db-check db-check.txt, cleanup 줄 없음" "$(has_line "FAIL db-check db-check.txt" && no_cleanup; echo $?)" "$(show)"
expect "CL10: 정리 확인은 했음" "$(checked; echo $?)" "$(show) docker=$(flat "$L/docker.log")"
expect "CL10: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

scenario cl11
wsh QA_PS_LIST="wl-check-mysql:exited" -- run "$D" --name impl --only db-check,web-build --llm-approved 6
expect "CL11: FAIL cleanup: 줄이 정확히 하나, 정확히 FAIL cleanup: wl-check-mysql" \
  "$([ "$(fail_cleanup_count)" = 1 ] && has_line "FAIL cleanup: wl-check-mysql"; echo $?)" "$(show)"
expect "CL11: (준비) 세 항목이 모두 불림" "$(grep -q '^check-db ' "$L/seq.log" && grep -qE '^npm(\.cmd)? run build' "$L/seq.log" && grep -q '^run-llm ' "$L/seq.log"; echo $?)" "$(show)"
expect "CL11: docker ps·netstat 호출이 모두 마지막 항목(run-llm) 호출보다 뒤" "$(after '^run-llm '; echo $?)" "$(show)"
expect "CL11: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

# 새 줄의 위치(03-main-decision 4): cleanup 줄들이 마지막 항목 줄 바로 뒤에 이어서, 그 밖의 NEEDS·NOTE 줄보다 앞
position_ok() {
  local last_item first_c last_c count_c first_other
  last_item=$(grep -nE '^(OK|FAIL) [a-z-]+ [a-z-]+\.txt$' "$SUM" | tail -n 1 | cut -d: -f1)
  first_c=$(grep -nE '^(FAIL|NOTE) cleanup: ' "$SUM" | head -n 1 | cut -d: -f1)
  last_c=$(grep -nE '^(FAIL|NOTE) cleanup: ' "$SUM" | tail -n 1 | cut -d: -f1)
  count_c=$(grep -cE '^(FAIL|NOTE) cleanup: ' "$SUM")
  first_other=$(grep -nE '^(NEEDS|NOTE) ' "$SUM" | grep -vE '^[0-9]+:NOTE cleanup: ' | head -n 1 | cut -d: -f1)
  [ -n "$last_item" ] && [ -n "$first_c" ] && [ "$first_c" = $((last_item + 1)) ] && [ "$last_c" = $((first_c + count_c - 1)) ] &&
    { [ -z "$first_other" ] || [ "$last_c" -lt "$first_other" ]; }
}

scenario cl12
commit_paths cl12 apps/backend/src/main/resources/db/migration/V300__qa.sql infra/nginx/prod.conf
wsh QA_PS_LIST="wl-check-mysql:exited" -- run "$D" --name impl
expect "CL12: NEEDS nginx-syntax 줄과 정확히 FAIL cleanup: wl-check-mysql" "$(grep -qE '^NEEDS nginx-syntax ' "$SUM" && has_line "FAIL cleanup: wl-check-mysql"; echo $?)" "$(show)"
expect "CL12: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
expect "DEC4(CL12): FAIL cleanup 줄이 항목 줄 바로 뒤, NEEDS 줄 앞" "$(position_ok; echo $?)" "$(show)"

# ================================================================ docker ps 실패, netstat 없음
scenario cl13
wsh QA_PS_RC=1 -- run "$D" --name impl --only db-check
expect "CL13: docker ps 실패면 정확히 FAIL cleanup: docker ps failed" "$(has_line "FAIL cleanup: docker ps failed"; echo $?)" "$(show)"
expect "CL13: 다른 cleanup 줄 없음, 종료 코드 1" "$([ "$(cleanup_count)" = 1 ] && [ "$RC" = 1 ]; echo $?)" "$(show)"

scenario dec1
ns "$NS_4242"
wsh QA_PS_RC=1 -- run "$D" --name impl --only db-check
expect "DEC1: docker ps 실패와 18080이 함께면 정확히 FAIL cleanup: docker ps failed; port 18080 LISTENING pid 4242" \
  "$(has_line "FAIL cleanup: docker ps failed; port 18080 LISTENING pid 4242"; echo $?)" "$(show)"
expect "DEC1: cleanup 줄은 그것 하나, 종료 코드 1" "$([ "$(cleanup_count)" = 1 ] && [ "$RC" = 1 ]; echo $?)" "$(show)"

NOTE_LINE="NOTE cleanup: netstat not found; port 18080 not checked"
if [ "$NETSTAT_MISSING_OK" = 1 ]; then
  scenario cl14
  wsh nonet -- run "$D" --name impl --only db-check
  expect "CL14: netstat이 없으면 summary에 정확히 NOTE cleanup 줄 하나" "$(has_line "$NOTE_LINE" && [ "$(cleanup_count)" = 1 ]; echo $?)" "$(show)"
  expect "CL14: FAIL cleanup 없음" "$([ "$(fail_cleanup_count)" = 0 ]; echo $?)" "$(show)"
  expect "CL14: 표준 출력에도 NOTE cleanup 줄" "$(out_has "$NOTE_LINE"; echo $?)" "$(show)"
  expect "CL14: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

  scenario cl15
  wsh nonet QA_PS_LIST="wl-check-redis:exited" -- run "$D" --name impl --only db-check
  expect "CL15: 정확히 FAIL cleanup: wl-check-redis와 정확히 NOTE cleanup 줄" "$(has_line "FAIL cleanup: wl-check-redis" && has_line "$NOTE_LINE"; echo $?)" "$(show)"
  expect "CL15: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

  scenario cl16
  commit_paths cl16 apps/backend/src/main/resources/db/migration/V301__qa.sql infra/nginx/prod.conf
  wsh nonet -- run "$D" --name impl
  expect "CL16: NEEDS nginx-syntax 줄과 정확히 NOTE cleanup 줄" "$(grep -qE '^NEEDS nginx-syntax ' "$SUM" && has_line "$NOTE_LINE"; echo $?)" "$(show)"
  expect "CL16: FAIL 줄 없음" "$(! grep -q '^FAIL' "$SUM"; echo $?)" "$(show)"
  expect "CL16: 종료 코드 3" "$([ "$RC" = 3 ]; echo $?)" "$(show)"
  expect "DEC4(CL16): NOTE cleanup 줄이 항목 줄 바로 뒤, NEEDS 줄 앞" "$(position_ok; echo $?)" "$(show)"

  scenario dec4
  commit_paths dec4 apps/backend/src/main/resources/db/migration/V302__qa.sql infra/nginx/prod.conf tools/x.txt
  wsh nonet QA_PS_LIST="wl-check-mysql:exited" -- run "$D" --name impl
  expect "DEC4: (준비) NEEDS nginx-syntax, NOTE unmatched tools/x.txt, FAIL cleanup, NOTE cleanup 줄이 모두 있음" \
    "$(grep -qE '^NEEDS nginx-syntax ' "$SUM" && has_line "NOTE unmatched tools/x.txt" && has_line "FAIL cleanup: wl-check-mysql" && has_line "$NOTE_LINE"; echo $?)" "$(show)"
  expect "DEC4: cleanup 두 줄이 항목 줄 바로 뒤에 이어서, NEEDS·NOTE unmatched 줄 앞" "$(position_ok; echo $?)" "$(show)"
else
  bad "CL14~CL16, DEC4(netstat 없음): (준비) netstat이 있는 PATH 폴더를 빼도 netstat이 보여 확인할 수 없음" "$(PATH="$BIN_NONET:$NONET_PATH" command -v netstat)"
fi

# ================================================================ 대상이 아닌 경우
LEFT_LIST="wl-check-mysql:up"
scenario cl17
ns "$NS_4242"
wsh QA_PS_LIST="$LEFT_LIST" -- run "$D" --name impl --only backend-test,rules-test
expect "CL17: summary가 정확히 HEAD·OK docker·OK backend-test·OK rules-test" \
  "$(sum_exact "HEAD $(H) | uncommitted 0" "OK docker: already running" "OK backend-test backend-test.txt" "OK rules-test rules-test.txt"; echo $?)" "$(show)"
expect "CL17: cleanup 없음, 종료 코드 0" "$(no_cleanup && [ "$RC" = 0 ]; echo $?)" "$(show)"
expect "CL17: docker ps와 netstat을 부르지 않음" "$(! ps_called && ! netstat_called; echo $?)" "$(show) docker=$(flat "$L/docker.log")"

scenario cl18
ns "$NS_4242"
wsh QA_DOCKER_FAIL=1 QA_PS_LIST="$LEFT_LIST" -- run "$D" --name impl --only db-check --llm-approved 6
expect "CL18: FAIL docker: 줄, FAIL db-check db-check.txt, FAIL llm-smoke llm-smoke.txt" \
  "$(grep -qE '^FAIL docker: ' "$SUM" && has_line "FAIL db-check db-check.txt" && has_line "FAIL llm-smoke llm-smoke.txt"; echo $?)" "$(show)"
expect "CL18: cleanup 없음" "$(no_cleanup; echo $?)" "$(show)"
expect "CL18: 가짜 check-db·run-llm·docker ps·netstat 호출 없음" \
  "$(! grep -qE '^(check-db|run-llm|docker ps|netstat)( |$)' "$L/seq.log" 2> /dev/null; echo $?)" "$(show)"
expect "CL18: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

if [ "$NETSTAT_MISSING_OK" = 1 ]; then
  scenario cl19
  wsh nonet QA_PS_LIST="$LEFT_LIST" -- run "$D" --name impl --only rules-test
  expect "CL19: summary가 정확히 HEAD·OK rules-test 두 줄" "$(sum_exact "HEAD $(H) | uncommitted 0" "OK rules-test rules-test.txt"; echo $?)" "$(show)"
  expect "CL19: cleanup 없음, 종료 코드 0" "$(no_cleanup && [ "$RC" = 0 ]; echo $?)" "$(show)"
else
  bad "CL19: (준비) netstat을 PATH에서 뺄 수 없어 확인할 수 없음"
fi

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
