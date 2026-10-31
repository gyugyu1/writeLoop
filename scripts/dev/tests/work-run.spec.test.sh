#!/usr/bin/env bash
# [spec] scripts/dev/work.sh run 테스트(qa). 작업 034 시나리오 A~G, X(02-qa-scenarios.md)와 03-main-decision.md의 Q1~Q7.
# 임시 폴더에 가짜 공개·비공개 저장소를 만들고 지금 저장소의 scripts/dev(tests 빼고)를 복사한 뒤, 일부를 가짜로 바꾼다
# (apps/backend/gradlew, scripts/dev/ensure-docker.sh, check-db-migrations.sh, run-llm-smoke.sh, scripts/dev/tests/의 파일).
# PATH 맨 앞에 가짜 docker·node(--test만 가짜, 나머지는 진짜 node)·npm·npm.cmd를 둔다. 진짜 docker가 있는 PATH 폴더는 빼므로
# 진짜 Docker는 건드리지 않는다. claude-config는 진짜 python과 node로, ops-syntax는 진짜 bash -n으로 돈다.
# work.sh는 가짜 저장소에 복사한 사본을 WORK_ROOT=<가짜 저장소>로 부른다. 진짜 저장소, private/, .env는 건드리지 않는다.
# 가짜 도구는 호출을 저장소 밖 기록 폴더(QA_LOG)에 남기고, 모두 같은 순서 기록(seq.log)에 한 줄씩 더한다.
#
#   bash scripts/dev/tests/work-run.spec.test.sh
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
command -v python > /dev/null 2>&1 || { echo "FAIL setup: python not found (claude-config uses it)"; exit 1; }

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

IS_WINDOWS=0
case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) IS_WINDOWS=1 ;; esac
# 폴더의 Windows 모양 경로(소문자). 가짜 도구가 남기는 현재 폴더와 비교한다.
wpath() { (cd "$1" && { pwd -W 2> /dev/null || pwd -P; }) | tr '[:upper:]' '[:lower:]'; }

# ---------------------------------------------------------------- 가짜 도구(PATH)
BIN="$TMP/bin"
mkdir -p "$BIN"
cat > "$BIN/docker" << 'EOF'
#!/usr/bin/env bash
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
echo "docker $*" >> "$QA_LOG/seq.log"
echo "cwd=$cwd args=$*" >> "$QA_LOG/docker.log"
[ "${1:-}" = ps ] && exit 0
exit "${QA_DOCKER_RC:-0}"
EOF
cat > "$BIN/node" << 'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = --test ]; then
  cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
  echo "node $*" >> "$QA_LOG/seq.log"
  echo "cwd=$cwd args=$*" >> "$QA_LOG/node.log"
  echo "fake node --test"
  exit "${QA_NODE_RC:-0}"
fi
exec "$QA_REAL_NODE" "$@"
EOF
cat > "$BIN/npm-fake.sh" << 'EOF'
#!/usr/bin/env bash
as=$1
shift
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
echo "$as $*" >> "$QA_LOG/seq.log"
echo "as=$as cwd=$cwd args=$*" >> "$QA_LOG/npm.log"
exit "${QA_NPM_RC:-0}"
EOF
printf '#!/usr/bin/env bash\nexec bash "$(dirname "$0")/npm-fake.sh" npm "$@"\n' > "$BIN/npm"
# npm.cmd는 Windows에서 cmd.exe가 돌리므로 배치 파일로 만들고 bash로 가짜를 부른다.
BASH_W=$(cygpath -w "$(command -v bash)" 2> /dev/null || command -v bash)
printf '@"%s" "%%~dp0npm-fake.sh" npm.cmd %%*\r\n@exit /b %%ERRORLEVEL%%\r\n' "$BASH_W" > "$BIN/npm.cmd"
chmod +x "$BIN/docker" "$BIN/node" "$BIN/npm-fake.sh" "$BIN/npm" "$BIN/npm.cmd"

# ---------------------------------------------------------------- 가짜 저장소
put() { mkdir -p "$(dirname "$1/$2")"; printf '%s\n' "$3" > "$1/$2"; }

make_repo() {
  local r=$1
  mkdir -p "$r/scripts/dev/tests"
  g -C "$r" init -q -b main
  printf '/private/\n' > "$r/.gitignore"
  cp "$DEV"/*.sh "$r/scripts/dev/"
  cp -r "$DEV/lib" "$r/scripts/dev/"
  # 가짜 gradle(sh). 받은 인자·현재 폴더를 남기고, 환경 변수대로 멈추거나 출력하거나 실패한다.
  mkdir -p "$r/apps/backend"
  cat > "$r/apps/backend/gradlew" << 'EOF'
#!/usr/bin/env bash
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
echo "gradlew $*" >> "$QA_LOG/seq.log"
{ echo "call cwd=$cwd"; for a in "$@"; do echo "arg=$a"; done; } >> "$QA_LOG/gradlew.log"
if [ -n "${QA_GRADLE_STATUS:-}" ]; then git -C "$QA_ROOT" status --short > "$QA_LOG/status-during.txt" 2>&1; fi
if [ -n "${QA_GRADLE_BLOCK:-}" ]; then
  touch "$QA_LOG/blocked"
  for _ in $(seq 1 600); do [ -f "$QA_LOG/release" ] && break; sleep 0.2; done
fi
if [ -n "${QA_GRADLE_LINES:-}" ]; then seq -f 'line-%g' 1 "$QA_GRADLE_LINES"; echo ERR-MARKER >&2; fi
touch "$QA_LOG/gradle-done"
exit "${QA_GRADLE_RC:-0}"
EOF
  # gradlew.bat은 Git Bash에서 실패해도 0을 돌려주는 진짜 성질을 흉내 낸다.
  printf '@exit /b 0\r\n' > "$r/apps/backend/gradlew.bat"
  echo fake > "$r/apps/backend/aSpecFile"
  cat > "$r/scripts/dev/ensure-docker.sh" << 'EOF'
#!/usr/bin/env bash
echo "ensure-docker" >> "$QA_LOG/seq.log"
echo call >> "$QA_LOG/ensure.log"
if [ -n "${QA_DOCKER_FAIL:-}" ]; then echo "docker: FAIL fake cannot start"; exit 1; fi
echo "docker: already running"
EOF
  cat > "$r/scripts/dev/check-db-migrations.sh" << 'EOF'
#!/usr/bin/env bash
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
echo "check-db $*" >> "$QA_LOG/seq.log"
{ echo "call cwd=$cwd"; for a in "$@"; do echo "arg=$a"; done; } >> "$QA_LOG/checkdb.log"
out="" api=""
while [ $# -gt 0 ]; do
  case "$1" in --out) out=${2:-}; shift 2 ;; --api) api=${2:-}; shift 2 ;; *) shift ;; esac
done
[ -n "$out" ] && mkdir -p "$out" && echo fake > "$out/qa-fake-marker.txt"
[ -n "$api" ] && cp "$api" "$QA_LOG/api-copy.txt"
exit "${QA_CHECKDB_RC:-0}"
EOF
  cat > "$r/scripts/dev/run-llm-smoke.sh" << 'EOF'
#!/usr/bin/env bash
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
echo "run-llm $*" >> "$QA_LOG/seq.log"
{ echo "call cwd=$cwd"; for a in "$@"; do echo "arg=$a"; done; } >> "$QA_LOG/llm.log"
out=""
while [ $# -gt 0 ]; do
  case "$1" in --out) out=${2:-}; shift 2 ;; *) shift ;; esac
done
[ -n "$out" ] && mkdir -p "$out" && echo fake > "$out/qa-fake-marker.txt"
exit "${QA_LLM_RC:-0}"
EOF
  cat > "$r/scripts/dev/tests/a.test.sh" << 'EOF'
#!/usr/bin/env bash
echo "script a" >> "$QA_LOG/seq.log"
echo A-RAN
exit "${QA_A_RC:-0}"
EOF
  cat > "$r/scripts/dev/tests/b.spec.test.sh" << 'EOF'
#!/usr/bin/env bash
echo B-RAN
EOF
  cat > "$r/scripts/dev/tests/helper.sh" << 'EOF'
#!/usr/bin/env bash
echo HELPER-RAN
EOF
  # 실행되면 표시 파일을 만드는 훅과 운영 스크립트(문법 검사는 실행하지 않아야 한다)
  put "$r" .claude/hooks/guard.py 'import os
open(os.path.join(os.environ["QA_LOG"], "hook-executed"), "w").close()'
  put "$r" .claude/settings.json '{}'
  put "$r" scripts/ops/deploy.sh 'touch "$QA_LOG/ops-executed"'
  put "$r" scripts/ops/good.sh 'touch "$QA_LOG/ops-executed"'
  put "$r" apps/backend/src/main/java/com/writeloop/service/UserService.java 'class UserService {}'
  put "$r" apps/backend/src/main/java/com/writeloop/service/Old.java 'class Old {}'
  put "$r" apps/backend/src/main/resources/application-local.yml 'a: 1'
  put "$r" scripts/feedback-quality/rules.mjs '// rules'
  put "$r" scripts/feedback-quality/cases.smoke.json '[]'
  put "$r" scripts/run-feedback-quality-check.mjs '// check'
  put "$r" apps/frontend/app/page.tsx '// page'
  put "$r" package.json '{}'
  put "$r" package-lock.json '{}'
  put "$r" apps/mobile/src/app/a.tsx '// a'
  put "$r" apps/mobile/package.json '{}'
  put "$r" .github/workflows/ci.yml 'name: ci'
  put "$r" docker-compose.yml 'services: {}'
  put "$r" infra/nginx/prod.conf '# nginx'
  put "$r" docs/README.md 'docs'
  put "$r" README.md 'readme'
  g -C "$r" add -A && g -C "$r" commit -q -m base
  mkdir -p "$r/private/work"
  g -C "$r/private" init -q -b main
  echo readme > "$r/private/README.md"
  g -C "$r/private" add -A && g -C "$r/private" commit -q -m base
}

R=""
L=""
D=""
OUT=""
RC=""
# work.sh 사본을 부른다: wsh [VAR=값]... -- <work.sh 인자>. 출력은 OUT, 종료 코드는 RC.
wsh() {
  local envs=()
  while [ $# -gt 0 ] && [ "$1" != -- ]; do envs+=("$1"); shift; done
  [ "${1:-}" = -- ] && shift
  OUT=$(cd "$R" && env WORK_ROOT="$R" QA_ROOT="$R" QA_LOG="$L" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" "${envs[@]}" \
    bash "$R/scripts/dev/work.sh" "$@" 2>&1)
  RC=$?
}
# 새 기록 폴더(L)와 새 작업 폴더(D, 기준 커밋 = 지금 HEAD)
scenario() {
  local out
  L="$TMP/log-$1"
  mkdir -p "$L"
  out=$(cd "$R" && WORK_ROOT="$R" bash "$R/scripts/dev/work.sh" new "$1" 2>&1) || bad "$1: (준비) work.sh new 실패" "$out"
  D="$R/$out"
}
# 경로마다 주석 한 줄을 더하고(없으면 만들고) 커밋한다.
commit_paths() {
  local msg=$1 p
  shift
  for p in "$@"; do
    mkdir -p "$(dirname "$R/$p")"
    echo "# qa change $msg" >> "$R/$p"
  done
  g -C "$R" add -A && g -C "$R" commit -q -m "$msg"
}
write_commit() { put "$R" "$2" "$3"; g -C "$R" add -A && g -C "$R" commit -q -m "$1"; }

runner_dirs() { ls -d "$D"/[0-9][0-9]-runner-*/ 2> /dev/null | sort; }
runner_count() { runner_dirs | grep -c .; }
RD=""
SUM=""
load() { RD=$(runner_dirs | tail -1); RD=${RD%/}; SUM="$RD/summary.txt"; }
items() { grep -E '^(OK|FAIL) ' "$SUM" 2> /dev/null | awk '$2 != "docker:" {print $2}' | sort | tr '\n' ' ' | sed 's/ $//'; }
sorted() { printf '%s\n' "$@" | grep . | sort | tr '\n' ' ' | sed 's/ $//'; }
called() { grep -qE "$1" "$L/seq.log" 2> /dev/null; }
no_calls() { [ ! -s "$L/seq.log" ]; }
has_line() { grep -qxF "$1" "$SUM" 2> /dev/null; }
has_re() { grep -qE "$1" "$SUM" 2> /dev/null; }
show() { echo "rc=$RC out=$(echo "$OUT" | tail -12 | tr '\n' '|') summary=$(flat "$SUM") seq=$(flat "$L/seq.log")"; }
flat() { cat "$1" 2> /dev/null | tr '\n' '|'; }
args_of() { grep '^arg=' "$1" 2> /dev/null | sed 's/^arg=//' | tr '\n' '|'; }
item_pat() {
  case $1 in
    backend-test) echo '^gradlew test' ;;
    db-check) echo '^check-db ' ;;
    rules-test) echo '^node --test' ;;
    script-tests) echo '^script a' ;;
    web-build) echo '^npm(\.cmd)? run build' ;;
    mobile-typecheck) echo '^npm(\.cmd)? run typecheck' ;;
    mobile-lint) echo '^npm(\.cmd)? run lint' ;;
    actionlint) echo '^docker run .*rhysd/actionlint:1\.7\.7' ;;
    compose-config) echo '^docker compose config -q' ;;
    llm-smoke) echo '^run-llm ' ;;
    *) echo '' ;;
  esac
}

# 경로를 바꿔 커밋하고 옵션 없이 run: sel_case <번호> <기대 종료 코드> "<기대 항목>" <경로>...
sel_case() {
  local id=$1 erc=$2 eit=$3 it p
  shift 3
  scenario "$id"
  commit_paths "$id" "$@"
  wsh -- run "$D" --name impl
  load
  expect "$id: 종료 코드 $erc" "$([ "$RC" = "$erc" ]; echo $?)" "$(show)"
  # shellcheck disable=SC2086
  expect "$id: 고른 항목이 정확히 [$eit]" "$([ "$(items)" = "$(sorted $eit)" ]; echo $?)" "items=[$(items)] $(show)"
  for it in $eit; do
    p=$(item_pat "$it")
    if [ -n "$p" ]; then
      expect "$id: $it 명령이 실제로 불렸다" "$(called "$p"; echo $?)" "$(show)"
    else
      expect "$id: $it 기록 파일이 있다" "$([ -f "$RD/$it.txt" ]; echo $?)" "$(show)"
    fi
  done
}

R="$TMP/repo"
make_repo "$R"
R2="$TMP/repo2"
make_repo "$R2"
B=apps/backend/src/main/java/com/writeloop/service

# ================================================================ A. 거부
scenario a1
commit_paths a1 "$B/UserService.java"
echo dirty >> "$R/docs/README.md"
n0=$(runner_count)
wsh -- run "$D" --name impl
expect "A1: 추적 파일을 고치고 커밋하지 않았으면 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
expect "A1: 가짜 도구가 하나도 불리지 않음(ensure-docker 포함)" "$(no_calls; echo $?)" "$(show)"
expect "A1: 새 NN-runner- 폴더 없음" "$([ "$(runner_count)" = "$n0" ]; echo $?)" "$(runner_dirs | tr '\n' ' ')"
g -C "$R" checkout -q -- docs/README.md

echo new > "$R/untracked-qa.txt"
L="$TMP/log-a2"; mkdir -p "$L"
wsh -- run "$D" --name impl
expect "A2: 추적하지 않는 새 파일만 있어도 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
expect "A2: 가짜 도구가 하나도 불리지 않음" "$(no_calls; echo $?)" "$(show)"
expect "A2: 새 NN-runner- 폴더 없음" "$([ "$(runner_count)" = "$n0" ]; echo $?)" "$(runner_dirs | tr '\n' ' ')"
rm -f "$R/untracked-qa.txt"

L="$TMP/log-a3"; mkdir -p "$L"
echo draft > "$D/note-qa.md"
wsh -- run "$D" --name impl
load
expect "A3: 비공개 저장소의 작업 폴더에만 커밋하지 않은 파일이 있으면 거부하지 않고 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "A3: 항목이 돌았다(가짜 gradlew test)" "$(called '^gradlew test'; echo $?)" "$(show)"

scenario a4
commit_paths a4 "$B/UserService.java"
for nm in Impl impl_1 구현 "a b" a/b ""; do
  L="$TMP/log-a4-$(echo "$nm" | od -An -tx1 | tr -d ' \n')"; mkdir -p "$L"
  wsh -- run "$D" --name "$nm"
  expect "A4: --name '$nm'은 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
  expect "A4: --name '$nm'이면 가짜 도구 호출 없음" "$(no_calls; echo $?)" "$(show)"
  expect "A4: --name '$nm'이면 새 runner 폴더 없음" "$([ "$(runner_count)" = 0 ]; echo $?)" "$(runner_dirs | tr '\n' ' ')"
done
L="$TMP/log-a4-none"; mkdir -p "$L"
wsh -- run "$D"
expect "A4: --name이 없으면 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
expect "A4: --name이 없으면 가짜 도구 호출 없음, 새 runner 폴더 없음" "$(no_calls && [ "$(runner_count)" = 0 ]; echo $?)" "$(show)"

scenario a5
commit_paths a5 "$B/UserService.java"
wsh -- run "$D" --name fix-2
expect "A5: --name fix-2를 받아들여 02-runner-fix-2/" "$([ "$RC" = 0 ] && [ -d "$D/02-runner-fix-2" ]; echo $?)" "$(show) dirs=$(runner_dirs | tr '\n' ' ')"
wsh -- run "$D" --name 0a-b
expect "A5: --name 0a-b를 받아들여 03-runner-0a-b/" "$([ "$RC" = 0 ] && [ -d "$D/03-runner-0a-b" ]; echo $?)" "$(show) dirs=$(runner_dirs | tr '\n' ' ')"

# ================================================================ B. 잠금(work.sh run)
BG_PID=""
# 가짜 gradlew가 멈추게 해서 run을 백그라운드로 시작한다: bg_run <기록 폴더> <work.sh 인자>...
bg_run() {
  local log=$1
  shift
  env WORK_ROOT="$R" QA_ROOT="$R" QA_LOG="$log" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" QA_GRADLE_BLOCK=1 \
    bash "$R/scripts/dev/work.sh" "$@" > "$log/bg.out" 2>&1 &
  BG_PID=$!
}
wait_file() { local i; for i in $(seq 1 300); do [ -f "$1" ] && return 0; sleep 0.2; done; return 1; }

scenario b1
commit_paths b1 "$B/UserService.java"
D1=$D
L1=$L
bg_run "$L1" run "$D1" --name first
if wait_file "$L1/blocked"; then
  L="$TMP/log-b1-second"; mkdir -p "$L"
  wsh -- run "$D1" --name second
  expect "B1: 다른 run이 돌고 있으면 둘째 run은 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
  expect "B1: 둘째 run의 가짜 도구 호출 없음" "$(no_calls; echo $?)" "$(show)"
  expect "B1: 둘째 run의 새 폴더 없음(첫 run의 02-runner-first만)" "$([ "$(runner_dirs | tr '\n' ' ')" = "$D1/02-runner-first/ " ]; echo $?)" "$(runner_dirs | tr '\n' ' ')"

  scenario b2
  wsh -- run "$D" --name impl --only rules-test
  expect "B2: 같은 저장소의 다른 작업 폴더로 run해도 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
  expect "B2: 가짜 도구 호출 없음" "$(no_calls; echo $?)" "$(show)"

  D=$D1
  L="$TMP/log-b5"; mkdir -p "$L"
  wsh -- run "$D1" --name third
  expect "B5: 거부된 run 뒤에도 첫 run이 도는 동안 셋째 run은 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
  expect "B5: 셋째 run의 가짜 도구 호출 없음" "$(no_calls; echo $?)" "$(show)"

  # 03-main-decision Q1: 잠금은 저장소마다. 다른 저장소의 run은 막지 않는다.
  R_SAVE=$R; R=$R2
  scenario b6
  wsh -- run "$D" --name impl --only rules-test
  expect "Q1(B6): 다른 저장소의 run은 막히지 않고 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
  expect "Q1(B6): 다른 저장소의 run은 항목을 돌렸다" "$(called '^node --test'; echo $?)" "$(show)"
  R=$R_SAVE
else
  bad "B1: (준비) 첫 run이 가짜 gradlew에서 멈추지 않았다" "$(cat "$L1/bg.out" 2> /dev/null | tail -5 | tr '\n' '|')"
fi
touch "$L1/release"
wait "$BG_PID"
first_rc=$?
D=$D1
expect "B1: 풀어 준 첫 run은 종료 코드 0" "$([ "$first_rc" = 0 ]; echo $?)" "rc=$first_rc out=$(tail -5 "$L1/bg.out" | tr '\n' '|')"
expect "B1: 첫 run summary에 OK backend-test backend-test.txt" "$(grep -qxF "OK backend-test backend-test.txt" "$D1/02-runner-first/summary.txt"; echo $?)" \
  "$(flat "$D1/02-runner-first/summary.txt")"

L="$TMP/log-b3a"; mkdir -p "$L"
wsh -- run "$D1" --name again
expect "B3: 앞 run이 0으로 끝난 뒤 다음 run은 거부되지 않음(종료 코드 0)" "$([ "$RC" = 0 ] && called '^gradlew test'; echo $?)" "$(show)"
L="$TMP/log-b3b"; mkdir -p "$L"
wsh QA_GRADLE_RC=1 -- run "$D1" --name failing
expect "B3: (준비) 가짜 gradlew 실패로 run이 1로 끝남" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
L="$TMP/log-b3c"; mkdir -p "$L"
wsh -- run "$D1" --name after-fail
expect "B3: 앞 run이 1로 끝난 뒤 다음 run은 거부되지 않음(종료 코드 0)" "$([ "$RC" = 0 ] && called '^gradlew test'; echo $?)" "$(show)"

L7="$TMP/log-b4-killed"; mkdir -p "$L7"
bg_run "$L7" run "$D1" --name killed
if wait_file "$L7/blocked"; then
  kill -9 "$BG_PID" 2> /dev/null
  wait "$BG_PID" 2> /dev/null
  touch "$L7/release"
  wait_file "$L7/gradle-done"
  sleep 1
  L="$TMP/log-b4-next"; mkdir -p "$L"
  wsh -- run "$D1" --name after-kill
  expect "B4: kill -9로 남은 잠금은 치우고 다음 run이 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
  expect "B4: 다음 run이 항목을 돌렸다" "$(called '^gradlew test'; echo $?)" "$(show)"
else
  bad "B4: (준비) 첫 run이 가짜 gradlew에서 멈추지 않았다" "$(tail -5 "$L7/bg.out" 2> /dev/null | tr '\n' '|')"
  touch "$L7/release"
  wait "$BG_PID" 2> /dev/null
fi

# ================================================================ C. 항목 고르기
sel_case c1 0 "backend-test" "$B/UserService.java"
expect "C1(D5): summary에 정확히 OK backend-test backend-test.txt" "$(has_line "OK backend-test backend-test.txt"; echo $?)" "$(show)"
sel_case c2 0 "backend-test db-check" apps/backend/src/main/resources/db/migration/V200__qa.sql
sel_case c3 0 "backend-test db-check" apps/backend/src/main/resources/application-local.yml
sel_case c4a 0 "rules-test" scripts/feedback-quality/rules.mjs
sel_case c4b 0 "rules-test" scripts/run-feedback-quality-check.mjs
sel_case c5 0 "script-tests" scripts/dev/tests/a.test.sh
sel_case c6a 0 "web-build" apps/frontend/app/page.tsx
sel_case c6b 0 "web-build" package.json
sel_case c6c 0 "web-build" package-lock.json
sel_case c7a 0 "mobile-typecheck mobile-lint" apps/mobile/src/app/a.tsx
sel_case c7b 0 "mobile-typecheck mobile-lint" apps/mobile/package.json
sel_case c8 0 "actionlint" .github/workflows/ci.yml
expect "C8: summary에 OK docker: 로 시작하는 줄" "$(has_re '^OK docker: '; echo $?)" "$(show)"
sel_case c9 0 "ops-syntax" scripts/ops/deploy.sh
sel_case c10 0 "compose-config" docker-compose.yml
sel_case c11a 0 "claude-config" .claude/hooks/guard.py

scenario c11b
write_commit c11b .claude/settings.json '{"qa": "c11b"}'
wsh -- run "$D" --name impl
load
expect "C11: .claude/settings.json이 바뀌면 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "C11: .claude/settings.json이 바뀌면 고른 항목이 정확히 [claude-config]" "$([ "$(items)" = claude-config ]; echo $?)" "items=[$(items)] $(show)"

sel_case c12 3 "" infra/nginx/prod.conf
expect "C12: NEEDS nginx-syntax 뒤에 이유가 붙은 줄 하나" "$([ "$(grep -cE '^NEEDS nginx-syntax .+' "$SUM")" = 1 ]; echo $?)" "$(show)"
sel_case c13 0 "" docs/a.md README.md .claude/agents/qa.md .claude/skills/a/SKILL.md .claude/CLAUDE.md
expect "C13: 확인 없는 경로만 바뀌면 summary는 첫 줄뿐" "$([ "$(grep -c . "$SUM")" = 1 ]; echo $?)" "$(show)"
sel_case q6 0 "" apps/backend/README.md
expect "Q6: apps/backend/README.md(어디 있든 *.md)는 확인 없음, summary는 첫 줄뿐" "$([ "$(grep -c . "$SUM")" = 1 ]; echo $?)" "$(show)"
sel_case c14 0 "" tools/x.txt .gitignore
expect "C14: NOTE unmatched tools/x.txt" "$(has_line "NOTE unmatched tools/x.txt"; echo $?)" "$(show)"
expect "C14: NOTE unmatched .gitignore" "$(has_line "NOTE unmatched .gitignore"; echo $?)" "$(show)"

scenario c15
g -C "$R" rm -q "$B/Old.java" && g -C "$R" commit -q -m c15
wsh -- run "$D" --name impl
load
expect "C15: 기준 커밋 전부터 있던 백엔드 파일을 지우면 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "C15: 고른 항목이 정확히 [backend-test]" "$([ "$(items)" = backend-test ]; echo $?)" "items=[$(items)] $(show)"

sel_case c16 0 "backend-test rules-test web-build ops-syntax" "$B/UserService.java" scripts/feedback-quality/rules.mjs apps/frontend/app/page.tsx scripts/ops/deploy.sh docs/a.md
expect "C16: 항목마다 줄 하나" "$([ "$(grep -E '^(OK|FAIL) ' "$SUM" | grep -cv '^[A-Z]* docker:')" = 4 ]; echo $?)" "$(show)"

# ---------------------------------------------------------------- D2, D4, D6 (C16 실행의 기록)
HEADC=$(git -C "$R" rev-parse HEAD)
re='^# (.+) \| HEAD ([0-9a-f]{40}) \| uncommitted ([0-9]+)$'
for it in backend-test rules-test web-build ops-syntax; do
  first=$(head -1 "$RD/$it.txt" 2> /dev/null)
  if [[ $first =~ $re ]]; then
    expect "D2: $it.txt 첫 줄의 HEAD가 git rev-parse HEAD, uncommitted 0" \
      "$([ "${BASH_REMATCH[2]}" = "$HEADC" ] && [ "${BASH_REMATCH[3]}" = 0 ]; echo $?)" "first=$first head=$HEADC"
  else
    bad "D2: $it.txt 첫 줄이 '# <명령> | HEAD <40자리> | uncommitted <수>'" "first=$first"
  fi
done
cmd_has() { head -1 "$RD/$1.txt" 2> /dev/null | sed -E 's/ \| HEAD [0-9a-f]{40} \| uncommitted [0-9]+$//' | grep -qF -- "$2"; }
expect "D2: backend-test 명령 칸에 gradlew test --no-daemon --rerun" "$(cmd_has backend-test 'gradlew test --no-daemon --rerun'; echo $?)" "$(head -1 "$RD/backend-test.txt")"
expect "D2: rules-test 명령 칸에 node --test scripts/feedback-quality/rules.test.mjs" "$(cmd_has rules-test 'node --test scripts/feedback-quality/rules.test.mjs'; echo $?)" "$(head -1 "$RD/rules-test.txt")"
expect "D2: web-build 명령 칸에 run build --workspace @english-learning/frontend" "$(cmd_has web-build 'run build --workspace @english-learning/frontend'; echo $?)" "$(head -1 "$RD/web-build.txt")"
expect "D2: ops-syntax 명령 칸에 bash -n" "$(cmd_has ops-syntax 'bash -n'; echo $?)" "$(head -1 "$RD/ops-syntax.txt")"
expect "D4: summary 첫 줄이 정확히 HEAD <git rev-parse HEAD> | uncommitted 0" "$([ "$(head -1 "$SUM")" = "HEAD $HEADC | uncommitted 0" ]; echo $?)" "first=$(head -1 "$SUM")"
missing=""
while IFS= read -r line; do
  [ -n "$line" ] || continue
  echo "$OUT" | grep -qxF -- "$line" || missing="$missing[$line]"
done < "$SUM"
expect "D6: 끝에 summary의 모든 줄을 출력" "$([ -z "$missing" ]; echo $?)" "missing=$missing out=$(echo "$OUT" | tr '\n' '|')"

L="$TMP/log-d7"; mkdir -p "$L"
wsh QA_GRADLE_RC=1 -- run "$D" --name d7
load
expect "D7: 앞 항목(backend-test)이 실패해도 FAIL backend-test backend-test.txt" "$(has_line "FAIL backend-test backend-test.txt"; echo $?)" "$(show)"
expect "D7: 나머지는 돌아 OK rules-test·web-build·ops-syntax" \
  "$(has_line "OK rules-test rules-test.txt" && has_line "OK web-build web-build.txt" && has_line "OK ops-syntax ops-syntax.txt"; echo $?)" "$(show)"
expect "D7: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

# ---------------------------------------------------------------- D1, D3, D8
scenario d1
commit_paths d1 "$B/UserService.java"
echo x > "$D/02-qa-scenarios.md"
mkdir "$D/03-runner-test"
echo "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0" > "$D/03-runner-test/summary.txt"
before=$(find "$R" -type d -name '[0-9][0-9]-runner-*' | wc -l | tr -d ' ')
wsh -- run "$D" --name impl
after=$(find "$R" -type d -name '[0-9][0-9]-runner-*' | wc -l | tr -d ' ')
expect "D1: 작업 폴더 바로 아래 다음 번호 04-runner-impl/" "$([ "$RC" = 0 ] && [ -d "$D/04-runner-impl" ]; echo $?)" "$(show) dirs=$(runner_dirs | tr '\n' ' ')"
expect "D1: 다른 곳에 새 runner 폴더 없음(늘어난 것은 하나)" "$([ "$after" = $((before + 1)) ]; echo $?)" "before=$before after=$after"

scenario d3
commit_paths d3 "$B/UserService.java"
wsh QA_GRADLE_LINES=5000 -- run "$D" --name impl
load
F="$RD/backend-test.txt"
expect "D3: 기록 파일에 출력 전부(line-1, line-2500, line-5000, 표준 오류 ERR-MARKER)" \
  "$(grep -qx line-1 "$F" && grep -qx line-2500 "$F" && grep -qx line-5000 "$F" && grep -q ERR-MARKER "$F"; echo $?)" "lines=$(wc -l < "$F" 2> /dev/null)"
expect "D3: 기록 파일 줄 수 ≥ 5002" "$([ "$(wc -l < "$F")" -ge 5002 ]; echo $?)" "lines=$(wc -l < "$F" 2> /dev/null)"

scenario d8
commit_paths d8 "$B/UserService.java"
wsh QA_GRADLE_STATUS=1 -- run "$D" --name impl
expect "D8: 항목이 도는 중 공개 저장소 git status --short가 빔" "$([ -f "$L/status-during.txt" ] && [ ! -s "$L/status-during.txt" ]; echo $?)" \
  "status=$(cat "$L/status-during.txt" 2> /dev/null | tr '\n' '|') $(show)"
expect "D8: 끝난 뒤 공개 저장소 git status --short가 빔" "$([ -z "$(git -C "$R" status --short)" ]; echo $?)" "$(git -C "$R" status --short | tr '\n' '|')"

# ================================================================ E. Docker
scenario e1
commit_paths e1 apps/backend/src/main/resources/db/migration/V201__qa.sql .github/workflows/ci.yml
wsh -- run "$D" --name impl --llm-approved 6
load
expect "E1: ensure-docker 호출이 정확히 1회" "$([ "$(grep -c . "$L/ensure.log" 2> /dev/null)" = 1 ]; echo $?)" "$(show)"
e=$(grep -n -m1 '^ensure-docker' "$L/seq.log" | cut -d: -f1)
for pat in '^gradlew test' '^check-db ' '^docker run ' '^run-llm '; do
  n=$(grep -nE -m1 "$pat" "$L/seq.log" | cut -d: -f1)
  expect "E1: ensure-docker가 '$pat'보다 먼저" "$([ -n "$e" ] && [ -n "$n" ] && [ "$e" -lt "$n" ]; echo $?)" "ensure=$e item=$n $(show)"
done
expect "E1: summary에 OK docker: 로 시작하는 줄" "$(has_re '^OK docker: '; echo $?)" "$(show)"
expect "E1: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

scenario e2
commit_paths e2 scripts/feedback-quality/rules.mjs
wsh -- run "$D" --name impl
load
expect "E2: Docker 항목이 없으면 ensure-docker를 부르지 않음" "$([ ! -e "$L/ensure.log" ]; echo $?)" "$(show)"
expect "E2: summary에 docker: 줄 없음" "$(! grep -q 'docker:' "$SUM"; echo $?)" "$(show)"

scenario e3
commit_paths e3 docker-compose.yml
wsh -- run "$D" --name impl
load
expect "E3: compose-config만이면 ensure-docker를 부르지 않음" "$([ ! -e "$L/ensure.log" ]; echo $?)" "$(show)"
expect "E3: docker compose config -q는 부름" "$(grep -q 'args=compose config -q$' "$L/docker.log" 2> /dev/null; echo $?)" "$(show)"

scenario e4
commit_paths e4 apps/backend/src/main/resources/db/migration/V202__qa.sql .github/workflows/ci.yml scripts/feedback-quality/rules.mjs
wsh QA_DOCKER_FAIL=1 -- run "$D" --name impl --llm-approved 6
load
expect "E4: summary에 FAIL docker: 로 시작하는 줄" "$(has_re '^FAIL docker: '; echo $?)" "$(show)"
expect "E4: Docker 항목의 명령(gradlew, check-db, docker run, run-llm)이 불리지 않음" \
  "$(! called '^gradlew ' && ! called '^check-db ' && ! called '^docker run ' && ! called '^run-llm '; echo $?)" "$(show)"
for it in backend-test db-check actionlint llm-smoke; do
  expect "E4: FAIL $it 로 시작하는 줄" "$(has_re "^FAIL $it( |$)"; echo $?)" "$(show)"
done
expect "E4: 나머지(rules-test)는 돌아 OK rules-test rules-test.txt" "$(has_line "OK rules-test rules-test.txt" && called '^node --test'; echo $?)" "$(show)"
expect "E4: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

# ================================================================ F. 항목별 명령
scenario f1
commit_paths f1 "$B/UserService.java"
wsh 'WINDIR=C:\Windows' -- run "$D" --name impl --tests com.writeloop.service.MissionSelectorSpecTest --tests '*Spec*'
GA=$(args_of "$L/gradlew.log")
expect "F1: 가짜 gradlew(sh)가 apps/backend에서 불림(gradlew.bat 아님)" "$(grep -qxF "call cwd=$(wpath "$R/apps/backend")" "$L/gradlew.log" 2> /dev/null; echo $?)" \
  "log=$(flat "$L/gradlew.log") want=$(wpath "$R/apps/backend")"
expect "F1: 인자에 test, --no-daemon, --rerun" "$(case "|$GA" in *"|test|"*) ;; *) false ;; esac && case "|$GA" in *"|--no-daemon|"*) ;; *) false ;; esac && case "|$GA" in *"|--rerun|"*) ;; *) false ;; esac; echo $?)" "args=$GA"
expect "F1: --tests 패턴을 준 순서 그대로, *Spec*를 펼치지 않고" \
  "$(case "|$GA" in *"|--tests|com.writeloop.service.MissionSelectorSpecTest|--tests|*Spec*|"*) true ;; *) false ;; esac; echo $?)" "args=$GA"

scenario f2
commit_paths f2 "$B/UserService.java"
wsh QA_GRADLE_RC=1 -- run "$D" --name impl
load
expect "F2(D5): gradlew 실패면 정확히 FAIL backend-test backend-test.txt" "$(has_line "FAIL backend-test backend-test.txt"; echo $?)" "$(show)"
expect "F2(X2): 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

scenario f3
commit_paths f3 apps/backend/src/main/resources/db/migration/V203__qa.sql
printf 'GET /health\nPOST /api/x {"a":1}\n' > "$TMP/api-f3.txt"
wsh -- run "$D" --name impl --db-tables users,prompts --db-api "$TMP/api-f3.txt"
load
CA=$(args_of "$L/checkdb.log")
expect "F3: 가짜 check-db-migrations가 저장소 루트에서 불림" "$(grep -qxF "call cwd=$(wpath "$R")" "$L/checkdb.log" 2> /dev/null; echo $?)" "log=$(flat "$L/checkdb.log")"
expect "F3: --out이 <기록 폴더>/db(가짜 표시 파일이 거기 있음)" "$([ -f "$RD/db/qa-fake-marker.txt" ] && case "|$CA" in *"|--out|"*) true ;; *) false ;; esac; echo $?)" "args=$CA rd=$RD"
expect "F3: --tables users,prompts" "$(case "|$CA" in *"|--tables|users,prompts|"*) true ;; *) false ;; esac; echo $?)" "args=$CA"
expect "F3: --api 파일 내용이 요청 파일과 같음" "$(cmp -s "$TMP/api-f3.txt" "$L/api-copy.txt"; echo $?)" "args=$CA"
expect "F3: OK db-check db-check.txt" "$(has_line "OK db-check db-check.txt"; echo $?)" "$(show)"

scenario f4
commit_paths f4 apps/backend/src/main/resources/db/migration/V204__qa.sql
wsh -- run "$D" --name impl
CA=$(args_of "$L/checkdb.log")
expect "F4: --db-tables·--db-api가 없으면 --tables·--api를 넘기지 않음" \
  "$([ -n "$CA" ] && case "|$CA" in *"|--tables|"* | *"|--api|"*) false ;; *) true ;; esac; echo $?)" "args=$CA"

scenario f5
commit_paths f5 apps/backend/src/main/resources/db/migration/V205__qa.sql
wsh QA_CHECKDB_RC=1 -- run "$D" --name impl
load
expect "F5: check-db 실패면 FAIL db-check db-check.txt, 종료 코드 1" "$(has_line "FAIL db-check db-check.txt" && [ "$RC" = 1 ]; echo $?)" "$(show)"

scenario f6
commit_paths f6 scripts/feedback-quality/rules.mjs
wsh -- run "$D" --name impl
load
expect "F6: 저장소 루트에서 node --test scripts/feedback-quality/rules.test.mjs" \
  "$(grep -qxF "cwd=$(wpath "$R") args=--test scripts/feedback-quality/rules.test.mjs" "$L/node.log" 2> /dev/null; echo $?)" "log=$(flat "$L/node.log")"
expect "F6: OK rules-test rules-test.txt" "$(has_line "OK rules-test rules-test.txt"; echo $?)" "$(show)"
L="$TMP/log-f6b"; mkdir -p "$L"
wsh QA_NODE_RC=1 -- run "$D" --name fail
load
expect "F6: node 실패면 FAIL rules-test rules-test.txt" "$(has_line "FAIL rules-test rules-test.txt"; echo $?)" "$(show)"

scenario f7
commit_paths f7 scripts/dev/tests/a.test.sh
wsh -- run "$D" --name impl
load
F="$RD/script-tests.txt"
expect "F7: *.test.sh를 모두 돌림(A-RAN, B-RAN)" "$(grep -q A-RAN "$F" && grep -q B-RAN "$F"; echo $?)" "$(flat "$F")"
expect "F7: *.test.sh가 아닌 helper.sh는 돌리지 않음" "$(! grep -q HELPER-RAN "$F"; echo $?)" "$(flat "$F")"
expect "F7: OK script-tests script-tests.txt" "$(has_line "OK script-tests script-tests.txt"; echo $?)" "$(show)"

scenario f8
commit_paths f8 scripts/dev/tests/a.test.sh
wsh QA_A_RC=1 -- run "$D" --name impl
load
F="$RD/script-tests.txt"
expect "F8: 한 파일이 실패하면 FAIL script-tests script-tests.txt" "$(has_line "FAIL script-tests script-tests.txt"; echo $?)" "$(show)"
expect "Q5(F8): 한 파일(a.test.sh)이 실패해도 나머지(b.spec.test.sh)를 돌림" "$(grep -q B-RAN "$F"; echo $?)" "$(flat "$F")"
expect "F8: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

scenario f9
commit_paths f9 apps/frontend/app/page.tsx
wsh -- run "$D" --name impl
if [ "$IS_WINDOWS" = 1 ]; then want_npm=npm.cmd other_npm=npm; else want_npm=npm other_npm=npm.cmd; fi
expect "F9: 저장소 루트에서 $want_npm run build --workspace @english-learning/frontend" \
  "$(grep -qxF "as=$want_npm cwd=$(wpath "$R") args=run build --workspace @english-learning/frontend" "$L/npm.log" 2> /dev/null; echo $?)" "log=$(flat "$L/npm.log")"
expect "F9: $other_npm은 부르지 않음" "$(! grep -q "^as=$other_npm " "$L/npm.log" 2> /dev/null; echo $?)" "log=$(flat "$L/npm.log")"

scenario f10
commit_paths f10 apps/mobile/src/app/a.tsx
wsh -- run "$D" --name impl
load
MW=$(wpath "$R/apps/mobile")
expect "F10: apps/mobile에서 run typecheck" "$(grep -qE "^as=npm(\.cmd)? cwd=$MW args=run typecheck$" "$L/npm.log" 2> /dev/null; echo $?)" "log=$(flat "$L/npm.log")"
expect "F10: apps/mobile에서 run lint" "$(grep -qE "^as=npm(\.cmd)? cwd=$MW args=run lint$" "$L/npm.log" 2> /dev/null; echo $?)" "log=$(flat "$L/npm.log")"
expect "F10: 기록 mobile-typecheck.txt, mobile-lint.txt와 summary 두 줄" \
  "$([ -f "$RD/mobile-typecheck.txt" ] && [ -f "$RD/mobile-lint.txt" ] && has_line "OK mobile-typecheck mobile-typecheck.txt" && has_line "OK mobile-lint mobile-lint.txt"; echo $?)" "$(show)"

scenario f11
commit_paths f11 .github/workflows/ci.yml
wsh -- run "$D" --name impl
load
expect "F11: docker run ... rhysd/actionlint:1.7.7" "$(grep -qE '^cwd=.* args=run .*rhysd/actionlint:1\.7\.7' "$L/docker.log" 2> /dev/null; echo $?)" "log=$(flat "$L/docker.log")"
expect "F11: OK actionlint actionlint.txt" "$(has_line "OK actionlint actionlint.txt"; echo $?)" "$(show)"

scenario f13
commit_paths f13 docker-compose.yml
wsh -- run "$D" --name impl
load
expect "F13: 저장소 루트에서 docker compose config -q" "$(grep -qxF "cwd=$(wpath "$R") args=compose config -q" "$L/docker.log" 2> /dev/null; echo $?)" "log=$(flat "$L/docker.log")"
expect "F13: OK compose-config compose-config.txt" "$(has_line "OK compose-config compose-config.txt"; echo $?)" "$(show)"

scenario f14
commit_paths f14 .claude/hooks/guard.py
wsh -- run "$D" --name impl
load
expect "F14: 정상 훅·settings는 OK claude-config claude-config.txt" "$(has_line "OK claude-config claude-config.txt"; echo $?)" "$(show) rec=$(flat "$RD/claude-config.txt")"
expect "F14: .claude/hooks 아래 __pycache__·*.pyc 없음" "$([ -z "$(find "$R/.claude/hooks" -name '__pycache__' -o -name '*.pyc')" ]; echo $?)" "$(find "$R/.claude/hooks" | tr '\n' ' ')"
expect "F14: 훅을 실행하지 않음(표시 파일 없음)" "$([ ! -e "$L/hook-executed" ]; echo $?)"
expect "F14: 공개 저장소 git status --short가 빔" "$([ -z "$(git -C "$R" status --short)" ]; echo $?)" "$(git -C "$R" status --short | tr '\n' '|')"

scenario f15
write_commit f15 .claude/hooks/guard.py 'def (:'
wsh -- run "$D" --name impl
load
expect "F15: 훅 문법 오류면 FAIL claude-config claude-config.txt" "$(has_line "FAIL claude-config claude-config.txt"; echo $?)" "$(show)"
write_commit f15-restore .claude/hooks/guard.py 'import os
open(os.path.join(os.environ["QA_LOG"], "hook-executed"), "w").close()'

scenario f16
write_commit f16 .claude/settings.json '{"a":'
wsh -- run "$D" --name impl
load
expect "F16: settings.json JSON 오류면 FAIL claude-config claude-config.txt" "$(has_line "FAIL claude-config claude-config.txt"; echo $?)" "$(show)"
write_commit f16-restore .claude/settings.json '{}'

scenario f12
write_commit f12 scripts/ops/bad.sh 'touch "$QA_LOG/ops-executed"
if then'
wsh -- run "$D" --name impl
load
expect "F12: 문법 오류 스크립트가 있으면 FAIL ops-syntax ops-syntax.txt" "$(has_line "FAIL ops-syntax ops-syntax.txt"; echo $?)" "$(show)"
expect "F12: 기록에 bad.sh가 나옴" "$(grep -q 'bad.sh' "$RD/ops-syntax.txt" 2> /dev/null; echo $?)" "$(flat "$RD/ops-syntax.txt")"
expect "F12: 스크립트를 실행하지 않음(표시 파일 없음)" "$([ ! -e "$L/ops-executed" ]; echo $?)"
scenario f12b
write_commit f12b scripts/ops/bad.sh 'touch "$QA_LOG/ops-executed"'
wsh -- run "$D" --name impl
load
expect "F12: 고친 뒤에는 OK ops-syntax ops-syntax.txt" "$(has_line "OK ops-syntax ops-syntax.txt"; echo $?)" "$(show)"

# ================================================================ G. LLM 회귀
needs_llm_has() { grep -E '^NEEDS llm-smoke ' "$SUM" 2> /dev/null | grep -qF -- "$1"; }
no_needs_llm() { ! grep -qE '^NEEDS llm-smoke' "$SUM" 2> /dev/null; }

sel_case g1 3 "backend-test" "$B/MissionSelector.java"
expect "G1: OK backend-test backend-test.txt" "$(has_line "OK backend-test backend-test.txt"; echo $?)" "$(show)"
expect "G1: NEEDS llm-smoke 줄에 MissionSelector.java" "$(needs_llm_has MissionSelector.java; echo $?)" "$(show)"
expect "G1: 경로로 run-llm-smoke를 돌리지 않음" "$([ ! -e "$L/llm.log" ]; echo $?)" "$(show)"
sel_case g2a 3 "backend-test" "$B/FeedbackQaService.java"
expect "G2: NEEDS llm-smoke 줄에 FeedbackQaService.java" "$(needs_llm_has FeedbackQaService.java && [ ! -e "$L/llm.log" ]; echo $?)" "$(show)"
sel_case g2b 3 "backend-test" "$B/CanonicalQaAssembler.java"
expect "G2: NEEDS llm-smoke 줄에 CanonicalQaAssembler.java" "$(needs_llm_has CanonicalQaAssembler.java && [ ! -e "$L/llm.log" ]; echo $?)" "$(show)"
sel_case g3 3 "rules-test" scripts/feedback-quality/cases.smoke.json
expect "G3: OK rules-test rules-test.txt, NEEDS llm-smoke 줄에 cases.smoke.json" "$(has_line "OK rules-test rules-test.txt" && needs_llm_has cases.smoke.json; echo $?)" "$(show)"
sel_case g4 0 "backend-test" "$B/UserService.java"
expect "G4: 세 단어가 없는 백엔드 파일이면 NEEDS llm-smoke 없음" "$(no_needs_llm; echo $?)" "$(show)"

mkdir -p "$TMP/cases"
echo '[]' > "$TMP/cases/a.json"
echo '[]' > "$TMP/cases/b.json"
scenario g5
commit_paths g5 "$B/MissionSelector.java"
wsh -- run "$D" --name impl --llm-approved 8 --llm-cases "$TMP/cases/a.json" --llm-cases "$TMP/cases/b.json"
load
LA=$(args_of "$L/llm.log")
expect "G5: 가짜 run-llm-smoke가 저장소 루트에서 불림" "$(grep -qxF "call cwd=$(wpath "$R")" "$L/llm.log" 2> /dev/null; echo $?)" "log=$(flat "$L/llm.log")"
expect "G5: --out이 <기록 폴더>/llm(표시 파일이 거기 있음)" "$([ -f "$RD/llm/qa-fake-marker.txt" ]; echo $?)" "args=$LA rd=$RD"
expect "G5: --expect-requests 8" "$(case "|$LA" in *"|--expect-requests|8|"*) true ;; *) false ;; esac; echo $?)" "args=$LA"
mapfile -t AA < <(grep '^arg=' "$L/llm.log" 2> /dev/null | sed 's/^arg=//')
cases_seen=""
for ((i = 0; i < ${#AA[@]}; i++)); do
  if [ "${AA[$i]}" = --cases ] && [ $((i + 1)) -lt ${#AA[@]} ]; then cases_seen="$cases_seen $(basename "${AA[$((i + 1))]}")"; fi
done
expect "G5: --cases a.json --cases b.json 이 순서" "$([ "$cases_seen" = " a.json b.json" ]; echo $?)" "cases=[$cases_seen] args=$LA"
expect "G5: OK llm-smoke llm-smoke.txt, NEEDS llm-smoke 없음" "$(has_line "OK llm-smoke llm-smoke.txt" && no_needs_llm; echo $?)" "$(show)"
expect "G5: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "G5: llm-smoke.txt 명령 칸에 run-llm-smoke.sh와 --expect-requests 8" "$(cmd_has llm-smoke run-llm-smoke.sh && cmd_has llm-smoke '--expect-requests 8'; echo $?)" "$(head -1 "$RD/llm-smoke.txt" 2> /dev/null)"

scenario g6
commit_paths g6 docs/a.md
wsh -- run "$D" --name impl --llm-approved 6
load
LA=$(args_of "$L/llm.log")
expect "G6: 바뀐 경로가 docs뿐이어도 --llm-approved 6이면 --expect-requests 6으로 돎" "$(case "|$LA" in *"|--expect-requests|6|"*) true ;; *) false ;; esac; echo $?)" "args=$LA"
expect "G6: OK llm-smoke llm-smoke.txt" "$(has_line "OK llm-smoke llm-smoke.txt"; echo $?)" "$(show)"

scenario g7
commit_paths g7 "$B/MissionSelector.java"
wsh QA_LLM_RC=1 -- run "$D" --name impl --llm-approved 8
load
expect "G7: 실패면 FAIL llm-smoke llm-smoke.txt, 종료 코드 1" "$(has_line "FAIL llm-smoke llm-smoke.txt" && [ "$RC" = 1 ]; echo $?)" "$(show)"

# 03-main-decision Q7
sel_case g8 3 "backend-test" apps/backend/src/test/java/com/writeloop/FeedbackQaTest.java
expect "Q7(G8): 백엔드 테스트 파일도 NEEDS llm-smoke(FeedbackQaTest.java)" "$(needs_llm_has FeedbackQaTest.java; echo $?)" "$(show)"
sel_case g9 0 "backend-test" apps/backend/src/main/java/com/writeloop/Feedback/Plain.java
expect "Q7(G9): 폴더 이름(Feedback/)만 맞으면 NEEDS llm-smoke 없음" "$(no_needs_llm; echo $?)" "$(show)"
sel_case g10 0 "backend-test" "$B/feedbackmissionutil.java"
expect "Q7(G10): 대소문자가 다르면(feedbackmission) NEEDS llm-smoke 없음" "$(no_needs_llm; echo $?)" "$(show)"
sel_case g11 3 "backend-test" "$B/MissionA.java" "$B/FeedbackB.java"
expect "Q7(G11): 여러 파일이면 NEEDS llm-smoke 한 줄에 모두" \
  "$([ "$(grep -cE '^NEEDS llm-smoke' "$SUM")" = 1 ] && needs_llm_has MissionA.java && needs_llm_has FeedbackB.java; echo $?)" "$(show)"
sel_case g12 0 "web-build" apps/frontend/FeedbackView.tsx
expect "Q7(G12): 백엔드 밖(apps/frontend)이면 NEEDS llm-smoke 없음" "$(no_needs_llm; echo $?)" "$(show)"

# 03-main-decision Q4
scenario g13
wsh -- run "$D" --name impl --only rules-test --llm-approved 6
load
expect "Q4(G13): --only rules-test --llm-approved 6이면 rules-test와 llm-smoke" "$([ "$(items)" = "llm-smoke rules-test" ] && [ "$RC" = 0 ]; echo $?)" "items=[$(items)] $(show)"

scenario g14
commit_paths g14 "$B/UserService.java"
refuse_case() { # 라벨, 그다음 work.sh run 인자
  local label=$1 n
  shift
  L="$TMP/log-$(echo "$label" | tr -c 'a-zA-Z0-9' '-')"; mkdir -p "$L"
  n=$(runner_count)
  wsh -- run "$D" "$@"
  expect "$label: 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$(show)"
  expect "$label: 가짜 도구 호출 없음, 새 runner 폴더 없음" "$(no_calls && [ "$(runner_count)" = "$n" ]; echo $?)" "$(show) dirs=$(runner_dirs | tr '\n' ' ')"
}
refuse_case "Q4(G14) --only llm-smoke without --llm-approved" --name impl --only llm-smoke
refuse_case "Q4(G15) --llm-cases without --llm-approved" --name impl --llm-cases "$TMP/cases/a.json"
for v in 0 abc -3 1.5; do
  refuse_case "Q4(G16) --llm-approved $v" --name impl --llm-approved "$v"
done
refuse_case "Q4(G17) --llm-cases missing file" --name impl --llm-approved 6 --llm-cases "$TMP/cases/none.json"
refuse_case "Q3 --only nosuch" --name impl --only nosuch
refuse_case "Q3 --only rules-test,nosuch" --name impl --only rules-test,nosuch

# ================================================================ C18~C21, Q2 (--only, 자식 폴더)
scenario c18
commit_paths c18 "$B/UserService.java"
wsh -- run "$D" --name impl --only rules-test
load
expect "C18: --only rules-test면 경로와 관계없이 [rules-test]만" "$([ "$(items)" = rules-test ] && [ "$RC" = 0 ]; echo $?)" "items=[$(items)] $(show)"
expect "C18: 가짜 gradlew 호출 없음" "$(! called '^gradlew'; echo $?)" "$(show)"

scenario q2
commit_paths q2 infra/nginx/prod.conf "$B/MissionSelector.java" tools/y.txt
wsh -- run "$D" --name impl --only rules-test
load
expect "Q2: --only면 NEEDS·NOTE 줄 없이 summary는 첫 줄과 OK rules-test 두 줄" \
  "$([ "$(grep -c . "$SUM")" = 2 ] && has_line "OK rules-test rules-test.txt" && ! grep -qE '^(NEEDS|NOTE)' "$SUM"; echo $?)" "$(show)"
expect "Q2: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

scenario c19
wsh -- run "$D" --name impl --only backend-test,web-build
load
expect "C19: 기준 커밋 뒤 커밋이 없어도 --only backend-test,web-build를 돌림" "$([ "$(items)" = "backend-test web-build" ] && [ "$RC" = 0 ]; echo $?)" "items=[$(items)] $(show)"
expect "C19: 두 명령이 실제로 불렸다" "$(called '^gradlew test' && called '^npm(\.cmd)? run build'; echo $?)" "$(show)"

scenario c20
wsh -- run "$D" --name impl --only actionlint
load
e=$(grep -n -m1 '^ensure-docker' "$L/seq.log" | cut -d: -f1)
n=$(grep -nE -m1 '^docker run .*rhysd/actionlint:1\.7\.7' "$L/seq.log" | cut -d: -f1)
expect "C20: --only actionlint, ensure-docker 1회가 docker run보다 먼저" \
  "$([ "$(items)" = actionlint ] && [ "$(grep -c . "$L/ensure.log" 2> /dev/null)" = 1 ] && [ -n "$e" ] && [ -n "$n" ] && [ "$e" -lt "$n" ]; echo $?)" "items=[$(items)] $(show)"
expect "C20: OK docker: 줄, 종료 코드 0" "$(has_re '^OK docker: ' && [ "$RC" = 0 ]; echo $?)" "$(show)"

scenario c21
PD=$D
child=$(cd "$R" && WORK_ROOT="$R" bash "$R/scripts/dev/work.sh" new sub --parent "$PD" 2>&1)
D="$R/$child"
commit_paths c21 "$B/UserService.java"
wsh -- run "$D" --name impl
load
expect "C21: 자식 폴더 바로 아래 02-runner-impl/" "$([ -d "$D/02-runner-impl" ]; echo $?)" "child=$child $(show)"
expect "C21: 자식 01의 기준 커밋으로 골라 [backend-test], 종료 코드 0" "$([ "$(items)" = backend-test ] && [ "$RC" = 0 ]; echo $?)" "items=[$(items)] $(show)"
expect "C21: 부모 폴더에는 새 runner 폴더 없음" "$(! ls -d "$PD"/[0-9][0-9]-runner-*/ > /dev/null 2>&1; echo $?)" "$(ls "$PD" | tr '\n' ' ')"

# ---------------------------------------------------------------- C17 (기준 커밋 전 변경은 세지 않음)
commit_paths c17-before "$B/UserService.java"
scenario c17
commit_paths c17 docs/a.md
wsh -- run "$D" --name impl
load
expect "C17: 기준 커밋 앞의 백엔드 변경은 세지 않아 항목 없음, 종료 코드 0" "$([ -z "$(items)" ] && [ "$RC" = 0 ] && ! called '^gradlew'; echo $?)" "items=[$(items)] $(show)"

# ================================================================ X. 종료 코드
scenario x4
commit_paths x4 infra/nginx/prod.conf "$B/UserService.java"
wsh QA_GRADLE_RC=1 -- run "$D" --name impl
load
expect "X4: FAIL과 NEEDS가 함께면 종료 코드 1" "$([ "$RC" = 1 ] && has_re '^NEEDS nginx-syntax' && has_re '^FAIL backend-test'; echo $?)" "$(show)"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
