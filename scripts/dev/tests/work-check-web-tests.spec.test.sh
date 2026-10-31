#!/usr/bin/env bash
# [spec] work.sh check·diff가 웹 테스트 경로(apps/frontend/tests)를 테스트 경로로 보는지(qa). 작업 037-02
# 시나리오 H1~H7, J1~J5(05-qa-scenarios.md, 03-main-decision.md의 3).
# 임시 폴더에 가짜 공개·비공개 저장소를 git init으로 만들고, 실행 기록 폴더(NN-runner-*)는 손으로 만든다.
# work.sh는 지금 저장소의 것을 WORK_ROOT=<가짜 저장소>로 부른다(check·diff는 바깥 도구를 부르지 않는다).
# 진짜 저장소와 private/는 건드리지 않는다.
#
#   bash scripts/dev/tests/work-check-web-tests.spec.test.sh
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

R=""
D=""
OUT=""
RC=""
N=0
PRE='before the pre-fix record'

# 새 가짜 저장소(R)와 기존 코드 흐름 작업 폴더(D, 시나리오 파일 없음). 기준 커밋에 웹·백엔드·문서 파일을 둔다.
setup() {
  N=$((N + 1))
  R="$TMP/r$N"
  mkdir -p "$R"
  g -C "$R" init -q -b main
  printf '/private/\n' > "$R/.gitignore"
  local p
  for p in apps/frontend/app/page.tsx apps/frontend/package.json apps/frontend/vitest.config.ts \
    apps/backend/src/main/java/A.java docs/a.md README.md; do
    mkdir -p "$(dirname "$R/$p")"
    echo base > "$R/$p"
  done
  g -C "$R" add -A && g -C "$R" commit -q -m base
  mkdir -p "$R/private/work"
  g -C "$R/private" init -q -b main
  echo readme > "$R/private/README.md"
  g -C "$R/private" add -A && g -C "$R/private" commit -q -m base
  local out
  out=$(WORK_ROOT="$R" bash "$WORK_SH" new qa 2>&1) || bad "setup $N: work.sh new 실패" "$out"
  D="$R/$out"
  echo tests > "$D/02-qa-tests.md"
}
# pubc <메시지> <경로>... : 경로마다 한 줄 더하고(없으면 만들고) 한 커밋으로
pubc() {
  local m=$1 p
  shift
  for p in "$@"; do
    mkdir -p "$(dirname "$R/$p")"
    echo "change $m" >> "$R/$p"
  done
  g -C "$R" add -A && g -C "$R" commit -q -m "$m"
}
head_of() { git -C "$R" rev-parse HEAD; }
runner() { mkdir -p "$D/$1"; printf '%s\n' "$2" > "$D/$1/summary.txt"; }
check() {
  OUT=$(cd "$R" && WORK_ROOT="$R" bash "$WORK_SH" check "$D" 2>&1)
  RC=$?
}
show() { echo "rc=$RC out=$(echo "$OUT" | tr '\n' '|')"; }
line() { echo "$OUT" | grep -qxF -- "$1"; }
no_nontest() { ! echo "$OUT" | grep -qF -- "non-test paths changed $PRE"; }
# FAIL 줄의 경로 목록이 정확히 기대 집합인지: fail_set <폴더> <경로>...
fail_set() {
  local rn=$1 prefix l got want
  shift
  prefix="FAIL $rn: non-test paths changed $PRE: "
  l=$(echo "$OUT" | grep -F -- "$prefix")
  [ "$(printf '%s' "$l" | grep -c .)" = 1 ] || return 1
  l=${l#"$prefix"}
  case "$l" in *"  "* | " "* | *" ") return 1 ;; esac
  got=$(printf '%s\n' "$l" | tr ' ' '\n' | sort)
  want=$(printf '%s\n' "$@" | sort)
  [ "$got" = "$want" ]
}

OKLINE="OK 03-runner-test: only test paths changed $PRE"

# 경로만 바꾼 뒤 고치기 전 기록을 만들고 check: ok_case <번호> <경로>...
ok_case() {
  local id=$1
  shift
  setup
  pubc "$id" "$@"
  runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
  check
  expect "$id: '$OKLINE' 줄이 있다" "$(line "$OKLINE"; echo $?)" "$(show)"
  expect "$id: non-test paths FAIL 줄이 없다" "$(no_nontest; echo $?)" "$(show)"
  expect "$id: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
}

# ================================================================ H. check
ok_case H1 apps/frontend/tests/answer-loop.spec.test.tsx
ok_case H2 apps/frontend/tests/sub/deep.spec.test.ts
ok_case H3 apps/frontend/tests/a.test.tsx apps/frontend/tests/b.spec.test.ts docs/a.md README.md
ok_case H6 apps/frontend/tests/a.spec.test.ts apps/backend/src/test/java/XSpecTest.java scripts/dev/tests/x.spec.test.sh \
  scripts/feedback-quality/rules.test.mjs

setup
pubc H4 apps/frontend/tests/a.spec.test.tsx apps/frontend/app/page.tsx
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check
expect "H4: FAIL 줄 하나, 경로가 정확히 apps/frontend/app/page.tsx" "$(fail_set 03-runner-test apps/frontend/app/page.tsx; echo $?)" "$(show)"
expect "H4: only test paths 줄이 없다" "$(! line "$OKLINE"; echo $?)" "$(show)"
expect "H4: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

H5_PATHS=(apps/frontend/tests.ts apps/frontend/tests-old/a.spec.test.ts apps/frontend/testsuite/a.test.ts
  apps/frontend/app/tests/a.test.tsx apps/frontend/vitest.config.ts apps/frontend/package.json)
setup
pubc H5 "${H5_PATHS[@]}"
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check
expect "H5: FAIL 줄 하나, 경로가 정확히 이름만 비슷한 여섯" "$(fail_set 03-runner-test "${H5_PATHS[@]}"; echo $?)" "$(show)"
expect "H5: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
echo scenarios > "$D/02-qa-scenarios.md"
pubc H7 apps/frontend/tests/a.spec.test.tsx apps/frontend/app/page.tsx
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check
expect "H7: 새 기능 폴더(시나리오 있음)는 03-runner-test의 only test paths·non-test paths 줄이 둘 다 없다" \
  "$(! echo "$OUT" | grep -qE "^(OK|FAIL) 03-runner-test: (only test paths changed $PRE|non-test paths changed $PRE)"; echo $?)" "$(show)"

# ================================================================ J. diff
TESTS=""
ALL=""
T=""
E=""
# 테스트 커밋 T(02-runner-test) 뒤에 경로를 바꿔 E(03-runner-impl)를 만들고 diff: diff_case <번호> <경로>...
diff_case() {
  local id=$1 out
  shift
  setup
  pubc "$id-test" apps/frontend/tests/t0.test.ts
  T=$(head_of)
  runner 02-runner-test "HEAD $T | uncommitted 0"
  pubc "$id-impl" "$@"
  E=$(head_of)
  runner 03-runner-impl "HEAD $E | uncommitted 0"
  out=$(cd "$R" && WORK_ROOT="$R" bash "$WORK_SH" diff "$D" 2>&1)
  RC=$?
  OUT=$out
  ALL="$D/04-main-diff-all.txt"
  TESTS="$D/04-main-diff-tests.txt"
  expect "$id: (준비) diff 종료 코드 0, 04-main-diff-tests.txt가 생김" "$([ "$RC" = 0 ] && [ -f "$TESTS" ]; echo $?)" "$(show)"
}
has_hdr() { grep -qxF -- "diff --git a/$2 b/$2" "$1" 2> /dev/null; }

diff_case J1 apps/frontend/tests/a.spec.test.tsx apps/frontend/app/page.tsx
expect "J1: 테스트 변경분에 apps/frontend/tests/a.spec.test.tsx diff가 있다" "$(has_hdr "$TESTS" apps/frontend/tests/a.spec.test.tsx; echo $?)" "$(head -20 "$TESTS" 2> /dev/null | tr '\n' '|')"
expect "J1: 테스트 변경분에 apps/frontend/app/page.tsx diff가 없다" "$(! has_hdr "$TESTS" apps/frontend/app/page.tsx; echo $?)" "$(head -20 "$TESTS" 2> /dev/null | tr '\n' '|')"
expect "J1: 전체 변경분에는 둘 다 있다" "$(has_hdr "$ALL" apps/frontend/tests/a.spec.test.tsx && has_hdr "$ALL" apps/frontend/app/page.tsx; echo $?)" "$(grep '^diff --git' "$ALL" 2> /dev/null | tr '\n' '|')"

# J2: J1의 테스트 변경분 첫 줄
first=$(head -1 "$TESTS" 2> /dev/null | tr -d '\r')
want_prefix="테스트 커밋: ${T:0:7} / HEAD: ${E:0:7} / 명령: git diff ${T:0:7}..${E:0:7} -- "
if [ "${first#"$want_prefix"}" != "$first" ]; then
  ok "J2: 첫 줄이 '테스트 커밋: <T> / HEAD: <E> / 명령: git diff <T>..<E> -- '로 시작"
  words=" ${first#"$want_prefix"} "
  for w in apps/frontend/tests apps/backend/src/test scripts/feedback-quality scripts/run-feedback-quality-check.mjs scripts/dev; do
    expect "J2: 명령의 경로에 $w가 낱말로 있다" "$(case "$words" in *" $w "*) echo 0 ;; *) echo 1 ;; esac)" "first=$first"
  done
else
  bad "J2: 첫 줄이 '테스트 커밋: <T> / HEAD: <E> / 명령: git diff <T>..<E> -- '로 시작" "first=$first want_prefix=$want_prefix"
fi

diff_case J3 apps/frontend/tests/sub/deep.test.ts
expect "J3: 테스트 변경분에 apps/frontend/tests/sub/deep.test.ts diff가 있다" "$(has_hdr "$TESTS" apps/frontend/tests/sub/deep.test.ts; echo $?)" "$(grep '^diff --git' "$TESTS" 2> /dev/null | tr '\n' '|')"

diff_case J4 apps/frontend/tests-old/a.ts apps/frontend/vitest.config.ts apps/frontend/app/tests/a.test.tsx
for p in apps/frontend/tests-old/a.ts apps/frontend/vitest.config.ts apps/frontend/app/tests/a.test.tsx; do
  expect "J4: 테스트 변경분에 $p diff가 없다" "$(! has_hdr "$TESTS" "$p"; echo $?)" "$(grep '^diff --git' "$TESTS" 2> /dev/null | tr '\n' '|')"
done

diff_case J5 apps/frontend/tests/a.test.tsx scripts/dev/tests/x.spec.test.sh apps/backend/src/test/java/XSpecTest.java
for p in apps/frontend/tests/a.test.tsx scripts/dev/tests/x.spec.test.sh apps/backend/src/test/java/XSpecTest.java; do
  expect "J5: 테스트 변경분에 $p diff가 있다" "$(has_hdr "$TESTS" "$p"; echo $?)" "$(grep '^diff --git' "$TESTS" 2> /dev/null | tr '\n' '|')"
done

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
