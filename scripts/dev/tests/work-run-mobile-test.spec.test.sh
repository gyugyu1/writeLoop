#!/usr/bin/env bash
# [spec] work.sh run의 mobile-test 항목 테스트(qa). 작업 039-02 시나리오 D1~D11(02-qa-scenarios.md).
# 임시 폴더에 가짜 공개·비공개 저장소를 만들고, 지금 저장소의 work.sh를 WORK_ROOT=<가짜 저장소>로 부른다.
# 가짜 저장소에는 가짜 apps/backend/gradlew와 scripts/dev/ensure-docker.sh만 둔다(run이 저장소 안의 것을 부른다).
# PATH 맨 앞에 가짜 npm·npm.cmd를 둔다. 받은 인자와 현재 폴더를 저장소 밖 기록 폴더(QA_LOG)에 남기고, QA_NPM_TEST_RC가 있으면
# `run test`에만 그 종료 코드를 돌려준다. 진짜 docker가 있는 PATH 폴더는 빼므로 진짜 Docker는 건드리지 않는다.
# 진짜 저장소, private/, .env는 건드리지 않는다.
#
#   bash scripts/dev/tests/work-run-mobile-test.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
WORK_SH="$HERE/../work.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false "$@"; }

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
if [ "$IS_WINDOWS" = 1 ]; then WANT_NPM=npm.cmd OTHER_NPM=npm; else WANT_NPM=npm OTHER_NPM=npm.cmd; fi
# 폴더의 Windows 모양 경로(소문자). 가짜 도구가 남기는 현재 폴더와 비교한다.
wpath() { (cd "$1" && { pwd -W 2> /dev/null || pwd -P; }) | tr '[:upper:]' '[:lower:]'; }

# ---------------------------------------------------------------- 가짜 npm(PATH)
BIN="$TMP/bin"
mkdir -p "$BIN"
cat > "$BIN/npm-fake.sh" << 'EOF'
#!/usr/bin/env bash
as=$1
shift
cwd=$({ pwd -W 2> /dev/null || pwd -P; } | tr '[:upper:]' '[:lower:]')
echo "as=$as cwd=$cwd args=$*" >> "$QA_LOG/npm.log"
echo "FAKE-NPM-OUT args=$*"
if [ "${1:-}" = run ] && [ "${2:-}" = test ]; then exit "${QA_NPM_TEST_RC:-0}"; fi
exit 0
EOF
printf '#!/usr/bin/env bash\nexec bash "$(dirname "$0")/npm-fake.sh" npm "$@"\n' > "$BIN/npm"
# npm.cmd는 Windows에서 cmd.exe가 돌리므로 배치 파일로 만들고 bash로 가짜를 부른다.
BASH_W=$(cygpath -w "$(command -v bash)" 2> /dev/null || command -v bash)
printf '@"%s" "%%~dp0npm-fake.sh" npm.cmd %%*\r\n@exit /b %%ERRORLEVEL%%\r\n' "$BASH_W" > "$BIN/npm.cmd"
chmod +x "$BIN/npm-fake.sh" "$BIN/npm" "$BIN/npm.cmd"

# ---------------------------------------------------------------- 가짜 저장소
R="$TMP/repo"
put() { mkdir -p "$(dirname "$R/$1")"; printf '%s\n' "$2" > "$R/$1"; }
mkdir -p "$R"
g -C "$R" init -q -b main
printf '/private/\n' > "$R/.gitignore"
put apps/backend/gradlew '#!/usr/bin/env bash
echo "gradlew $*" >> "$QA_LOG/gradlew.log"
exit 0'
put scripts/dev/ensure-docker.sh '#!/usr/bin/env bash
echo "docker: already running"'
put apps/backend/src/main/java/A.java 'class A {}'
put apps/frontend/app/page.tsx '// page'
put apps/frontend/package.json '{}'
put package.json '{}'
put package-lock.json '{}'
put apps/mobile/src/app/a.tsx '// a'
put apps/mobile/package.json '{}'
put apps/mobile/package-lock.json '{}'
put apps/mobile/README.md 'mobile readme'
put docs/a.md 'docs'
g -C "$R" add -A && g -C "$R" commit -q -m base
mkdir -p "$R/private/work"
g -C "$R/private" init -q -b main
echo readme > "$R/private/README.md"
g -C "$R/private" add -A && g -C "$R/private" commit -q -m base
RW=$(wpath "$R")
MW=$(wpath "$R/apps/mobile")

L=""
D=""
OUT=""
RC=""
# 새 기록 폴더(L)와 새 작업 폴더(D, 기준 커밋 = 지금 HEAD)
scenario() {
  local out
  L="$TMP/log-$1"
  mkdir -p "$L"
  out=$(cd "$R" && WORK_ROOT="$R" bash "$WORK_SH" new "$1" 2>&1) || bad "$1: (준비) work.sh new 실패" "$out"
  D="$R/$out"
}
commit_paths() {
  local msg=$1 p
  shift
  for p in "$@"; do
    mkdir -p "$(dirname "$R/$p")"
    echo "// qa change $msg" >> "$R/$p"
  done
  g -C "$R" add -A && g -C "$R" commit -q -m "$msg"
}
# work.sh를 부른다: wsh [VAR=값]... -- <work.sh 인자>. 출력은 OUT, 종료 코드는 RC.
wsh() {
  local envs=()
  while [ $# -gt 0 ] && [ "$1" != -- ]; do envs+=("$1"); shift; done
  [ "${1:-}" = -- ] && shift
  OUT=$(cd "$R" && env WORK_ROOT="$R" QA_LOG="$L" PATH="$BIN:$SAFE_PATH" "${envs[@]}" bash "$WORK_SH" "$@" 2>&1)
  RC=$?
}
RD=""
SUM=""
load() { RD=$(ls -d "$D"/[0-9][0-9]-runner-*/ 2> /dev/null | sort | tail -1); RD=${RD%/}; SUM="$RD/summary.txt"; }
items() { grep -E '^(OK|FAIL) ' "$SUM" 2> /dev/null | awk '$2 != "docker:" {print $2}' | sort | tr '\n' ' ' | sed 's/ $//'; }
has_line() { grep -qxF -- "$1" "$SUM" 2> /dev/null; }
npm_has() { grep -qxF -- "$1" "$L/npm.log" 2> /dev/null; }
npm_re() { grep -qE -- "$1" "$L/npm.log" 2> /dev/null; }
npm_count() { grep -cxF -- "$1" "$L/npm.log" 2> /dev/null; }
flat() { cat "$1" 2> /dev/null | tr '\n' '|'; }
show() { echo "rc=$RC out=$(echo "$OUT" | tail -8 | tr '\n' '|') summary=$(flat "$SUM") npm=$(flat "$L/npm.log")"; }
TEST_CALL="as=$WANT_NPM cwd=$MW args=run test"
TYPECHECK_CALL="as=$WANT_NPM cwd=$MW args=run typecheck"
LINT_CALL="as=$WANT_NPM cwd=$MW args=run lint"
MOBILE_ITEMS="mobile-lint mobile-test mobile-typecheck"

# 모바일 경로를 바꿔 커밋하고 옵션 없이 run: mobile_case <번호> <경로>...
mobile_case() {
  local id=$1
  shift
  scenario "$id"
  commit_paths "$id" "$@"
  wsh -- run "$D" --name impl
  load
  expect "$id: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
  expect "$id: 고른 항목이 정확히 [$MOBILE_ITEMS]" "$([ "$(items)" = "$MOBILE_ITEMS" ]; echo $?)" "items=[$(items)] $(show)"
  expect "$id: summary에 OK mobile-typecheck, OK mobile-lint, OK mobile-test 줄" \
    "$(has_line "OK mobile-typecheck mobile-typecheck.txt" && has_line "OK mobile-lint mobile-lint.txt" && has_line "OK mobile-test mobile-test.txt"; echo $?)" "$(show)"
  expect "$id: apps/mobile에서 인자 정확히 run test로 한 번 불렸다" "$([ "$(npm_count "$TEST_CALL")" = 1 ]; echo $?)" "$(show)"
  expect "$id: apps/mobile에서 run typecheck와 run lint도 불렸다" "$(npm_has "$TYPECHECK_CALL" && npm_has "$LINT_CALL"; echo $?)" "$(show)"
}

# ================================================================ D1~D5
mobile_case D1 apps/mobile/src/app/a.tsx
# D10: D1 실행의 mobile-test.txt
HEADC=$(git -C "$R" rev-parse HEAD)
F="$RD/mobile-test.txt"
first=$(head -1 "$F" 2> /dev/null)
re='^# (.+) \| HEAD ([0-9a-f]{40}) \| uncommitted ([0-9]+)$'
if [[ $first =~ $re ]]; then
  cmd=${BASH_REMATCH[1]}
  expect "D10: mobile-test.txt 첫 줄의 HEAD가 git rev-parse HEAD, uncommitted 0" \
    "$([ "${BASH_REMATCH[2]}" = "$HEADC" ] && [ "${BASH_REMATCH[3]}" = 0 ]; echo $?)" "first=$first head=$HEADC"
  expect "D10: 명령 칸에 run test" "$(echo "$cmd" | grep -qF -- 'run test'; echo $?)" "first=$first"
else
  bad "D10: mobile-test.txt 첫 줄이 '# <명령> | HEAD <40자리> | uncommitted <수>'" "first=$first"
fi
expect "D10: 모바일 테스트를 $WANT_NPM으로 불렀다" "$(npm_has "$TEST_CALL"; echo $?)" "npm=$(flat "$L/npm.log")"
expect "D10: 모바일 테스트를 $OTHER_NPM으로 부르지 않았다" "$(! npm_re "^as=$OTHER_NPM .* args=run test"; echo $?)" "npm=$(flat "$L/npm.log")"
expect "D10: 둘째 줄부터 가짜 npm의 출력이 남아 있다" \
  "$(tail -n +2 "$F" 2> /dev/null | grep -qxF 'FAKE-NPM-OUT args=run test'; echo $?)" "file=$(flat "$F")"

mobile_case D2 apps/mobile/package.json
mobile_case D3 apps/mobile/package-lock.json
mobile_case D4 apps/mobile/tests/qa.spec.test.tsx
expect "D4: script-tests 줄이 없다" "$(! grep -q ' script-tests ' "$SUM"; echo $?)" "$(show)"
mobile_case D5 apps/mobile/jest.config.js

# ================================================================ D6, D7 (모바일 밖의 경로)
scenario D6
commit_paths D6 apps/frontend/app/page.tsx
wsh -- run "$D" --name impl
load
expect "D6: 웹 파일만이면 항목이 정확히 [web-build web-test]" "$([ "$(items)" = "web-build web-test" ]; echo $?)" "items=[$(items)] $(show)"
expect "D6: mobile-test 줄이 없다" "$(! grep -q ' mobile-test ' "$SUM"; echo $?)" "$(show)"
expect "D6: apps/mobile에서 npm이 불리지 않았다" "$(! npm_re "^as=[^ ]+ cwd=$MW "; echo $?)" "$(show)"

scenario D7a
commit_paths D7a apps/backend/src/main/java/A.java
wsh -- run "$D" --name impl
load
expect "D7(a): 백엔드 파일만이면 항목이 정확히 [backend-test]" "$([ "$(items)" = "backend-test" ]; echo $?)" "items=[$(items)] $(show)"
expect "D7(a): mobile-test 줄이 없다" "$(! grep -q ' mobile-test ' "$SUM"; echo $?)" "$(show)"

scenario D7b
commit_paths D7b docs/a.md
wsh -- run "$D" --name impl
load
expect "D7(b): 문서만이면 summary는 첫 줄뿐" "$([ "$(grep -c . "$SUM")" = 1 ]; echo $?)" "$(show)"

scenario D7c
commit_paths D7c apps/mobile/README.md
wsh -- run "$D" --name impl
load
expect "D7(c): apps/mobile/README.md만이면 summary는 첫 줄뿐(mobile-test 없음)" "$([ "$(grep -c . "$SUM")" = 1 ]; echo $?)" "$(show)"
expect "D7(c): npm이 불리지 않았다" "$([ ! -s "$L/npm.log" ]; echo $?)" "$(show)"

# ================================================================ D8, D9 (--only mobile-test)
scenario D8
commit_paths D8 apps/backend/src/main/java/A.java
wsh -- run "$D" --name impl --only mobile-test
load
HEADC=$(git -C "$R" rev-parse HEAD)
expect "D8: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "D8: summary가 정확히 두 줄(HEAD 줄, OK mobile-test mobile-test.txt)" \
  "$([ "$(grep -c . "$SUM")" = 2 ] && [ "$(sed -n 1p "$SUM")" = "HEAD $HEADC | uncommitted 0" ] && [ "$(sed -n 2p "$SUM")" = "OK mobile-test mobile-test.txt" ]; echo $?)" "$(show)"
expect "D8: run typecheck와 run lint는 불리지 않았다" "$(! npm_re 'args=run (typecheck|lint)$'; echo $?)" "$(show)"
expect "D8: gradlew는 불리지 않았다" "$([ ! -s "$L/gradlew.log" ]; echo $?)" "gradlew=$(flat "$L/gradlew.log")"
expect "D8: apps/mobile에서 run test가 불렸다" "$(npm_has "$TEST_CALL"; echo $?)" "$(show)"

scenario D9
wsh -- run "$D" --name impl --only mobile-test
load
expect "D9: 기준 커밋 뒤 커밋이 없어도 종료 코드 0, 항목이 정확히 [mobile-test]" "$([ "$RC" = 0 ] && [ "$(items)" = mobile-test ]; echo $?)" "items=[$(items)] $(show)"
expect "D9: apps/mobile에서 run test가 불렸다" "$(npm_has "$TEST_CALL"; echo $?)" "$(show)"

# ================================================================ D11 (모바일 테스트 실패)
scenario D11
commit_paths D11 apps/mobile/src/app/a.tsx
wsh QA_NPM_TEST_RC=1 -- run "$D" --name impl
load
expect "D11: summary에 FAIL mobile-test mobile-test.txt" "$(has_line "FAIL mobile-test mobile-test.txt"; echo $?)" "$(show)"
expect "D11: run 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
expect "D11: mobile-typecheck와 mobile-lint는 그래도 돌아 각각 OK" \
  "$(has_line "OK mobile-typecheck mobile-typecheck.txt" && has_line "OK mobile-lint mobile-lint.txt" && npm_has "$TYPECHECK_CALL" && npm_has "$LINT_CALL"; echo $?)" "$(show)"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
