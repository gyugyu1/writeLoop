#!/usr/bin/env bash
# [spec] scripts/dev/work.sh check의 고치기 전 기록 확인 테스트(qa). 작업 035 시나리오 PF1~PF16(02-qa-scenarios.md)과
# 03-main-decision.md의 2(CRLF 첫 줄), 5(한글 경로를 그대로 적음).
# 임시 폴더에 가짜 공개·비공개 저장소를 git init으로 만들고, 실행 기록 폴더(NN-runner-*)는 손으로 만든다.
# work.sh는 지금 저장소의 것을 WORK_ROOT=<가짜 저장소>로 부른다. "기준 커밋의 work.sh와 같다"는
# git show 57e01a4:scripts/dev/work.sh를 임시 파일로 꺼내 같은 가짜 저장소에 돌린 출력(줄 집합)·종료 코드와 비교한다.
# 진짜 저장소와 private/는 건드리지 않는다.
#
#   bash scripts/dev/tests/work-check-prefix.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
WORK_SH="$HERE/../work.sh"
REPO=$(cd "$HERE/../../.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false "$@"; }
at() {
  local t="2026-01-01T$1:00+09:00"
  shift
  GIT_AUTHOR_DATE="$t" GIT_COMMITTER_DATE="$t" g "$@"
}

BASE_SH="$TMP/work-base.sh"
BASE_SHOW=""
git -C "$REPO" show 57e01a4:scripts/dev/work.sh > "$BASE_SH" 2> /dev/null || { echo "FAIL setup: cannot read 57e01a4:scripts/dev/work.sh"; exit 1; }

R=""
D=""
OUT=""
RC=""
N=0
PRE='before the pre-fix record'
TP=apps/backend/src/test/java/ASpecTest.java

# 새 가짜 저장소(R)와 작업 폴더(D). 기준 커밋 B(08:00)에 A.java, X.java, docs/README.md, SKILL.md, .gitignore.
# 작업 폴더에 02-qa-tests.md(시나리오 파일은 없음).
setup() {
  N=$((N + 1))
  R="$TMP/r$N"
  mkdir -p "$R/apps/backend/src/main/java" "$R/docs" "$R/.claude/skills/a"
  g -C "$R" init -q -b main
  printf '/private/\n' > "$R/.gitignore"
  echo base > "$R/apps/backend/src/main/A.java"
  echo base > "$R/apps/backend/src/main/java/X.java"
  echo base > "$R/docs/README.md"
  echo base > "$R/.claude/skills/a/SKILL.md"
  g -C "$R" add -A && at 08:00 -C "$R" commit -q -m base
  B=$(git -C "$R" rev-parse HEAD)
  mkdir -p "$R/private/work"
  g -C "$R/private" init -q -b main
  echo readme > "$R/private/README.md"
  g -C "$R/private" add -A && at 08:00 -C "$R/private" commit -q -m base
  local out
  out=$(WORK_ROOT="$R" bash "$WORK_SH" new qa 2>&1) || bad "setup $N: work.sh new 실패" "$out"
  D="$R/$out"
  echo tests > "$D/02-qa-tests.md"
}
# pubc <HH:MM> <경로>... : 경로마다 한 줄 더하고(없으면 만들고) 한 커밋으로
pubc() {
  local t=$1 p
  shift
  for p in "$@"; do
    mkdir -p "$(dirname "$R/$p")"
    echo "change $t" >> "$R/$p"
  done
  g -C "$R" add -A && at "$t" -C "$R" commit -q -m "pub $t"
}
head_of() { git -C "$R" rev-parse HEAD; }
runner() { mkdir -p "$D/$1"; printf '%s\n' "$2" > "$D/$1/summary.txt"; }
priv() {
  local t=$1 f
  shift
  for f in "$@"; do g -C "$R/private" add -- "${D#"$R/private/"}/$f"; done
  at "$t" -C "$R/private" commit -q -m "priv $t"
}
check() {
  OUT=$(cd "$R" && WORK_ROOT="$R" bash "$WORK_SH" check "$D" 2>&1)
  RC=$?
}
show() { echo "rc=$RC out=$(echo "$OUT" | tr '\n' '|')"; }
line() { echo "$OUT" | grep -qxF -- "$1"; }
no_fail() { ! echo "$OUT" | grep -q '^FAIL'; }
# 그 폴더의 새 확인 줄 수
new_lines() { echo "$OUT" | grep -cE "^(OK|FAIL) $1: (only test paths changed $PRE|non-test paths changed $PRE: |commit [0-9a-f]{7} not found)"; }
any_new() { echo "$OUT" | grep -qE "(only test paths changed $PRE|non-test paths changed $PRE|: commit [0-9a-f]{7} not found)"; }
common() {
  local id=$1
  expect "$id: 출력의 모든 줄이 OK/FAIL/NOTE로 시작" "$(! echo "$OUT" | grep -v '^$' | grep -qvE '^(OK|FAIL|NOTE)( |$)'; echo $?)" "$(show)"
  if echo "$OUT" | grep -q '^FAIL'; then
    expect "$id: FAIL 줄이 있으면 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
  else
    expect "$id: FAIL 줄이 없으면 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
  fi
}
# FAIL 줄의 경로 목록이 정확히 기대 집합인지: fail_set <폴더> <경로>...
fail_set() {
  local rn=$1 prefix l got want
  shift
  prefix="FAIL $rn: non-test paths changed $PRE: "
  l=$(echo "$OUT" | grep -F -- "$prefix")
  [ "$(printf '%s' "$l" | grep -c .)" = 1 ] || return 1
  l=${l#"$prefix"}
  # 공백 하나로 나눈다: 빈 칸(두 칸 이상, 앞뒤 공백)이 있으면 실패
  case "$l" in *"  "* | " "* | *" ") return 1 ;; esac
  got=$(printf '%s\n' "$l" | tr ' ' '\n' | sort)
  want=$(printf '%s\n' "$@" | sort)
  [ "$got" = "$want" ]
}
# 기준 커밋의 work.sh와 출력 줄 집합·종료 코드가 같은지
same_as_base() {
  local base_out base_rc
  base_out=$(cd "$R" && WORK_ROOT="$R" bash "$BASE_SH" check "$D" 2>&1)
  base_rc=$?
  BASE_SHOW="base_rc=$base_rc base_out=$(echo "$base_out" | tr '\n' '|')"
  [ "$base_rc" = "$RC" ] && [ "$(echo "$base_out" | sort)" = "$(echo "$OUT" | sort)" ]
}

# ================================================================ 대상이 되는 경우
setup
pubc 10:00 "$TP"; T=$(head_of)
pubc 11:00 apps/backend/src/main/A.java
runner 03-runner-test "HEAD $T | uncommitted 0"
check; common PF1
expect "PF1: 정확히 OK 03-runner-test: only test paths changed $PRE" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF1: 03-runner-test의 새 확인 줄은 그것 하나" "$([ "$(new_lines 03-runner-test)" = 1 ]; echo $?)" "$(show)"
expect "PF1: 기존 줄 OK 03-runner-test: uncommitted 0 그대로" "$(line "OK 03-runner-test: uncommitted 0"; echo $?)" "$(show)"
expect "PF1: FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pubc 10:00 apps/backend/src/test/resources/x.sql scripts/dev/tests/x.spec.test.sh scripts/feedback-quality/rules.test.mjs \
  docs/a.md apps/backend/README.md README.md .claude/skills/a/SKILL.md .claude/agents/qa.md .claude/CLAUDE.md
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF2
expect "PF2: 테스트 경로 셋과 문서·지침만 바뀌면 정확히 OK 줄" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF2: FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pubc 10:00 "$TP" "docs/보고서.md"
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF3
expect "PF3: 한글 이름 문서(docs/보고서.md)도 빠져 정확히 OK 줄" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF3: FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pubc 10:00 "$TP" apps/backend/src/main/A.java
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF4
expect "PF4: 정확히 FAIL 03-runner-test: non-test paths changed $PRE: apps/backend/src/main/A.java" \
  "$(line "FAIL 03-runner-test: non-test paths changed $PRE: apps/backend/src/main/A.java"; echo $?)" "$(show)"
expect "PF4: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
PF5_PATHS=(apps/backend/src/test-support/A.java apps/backend/src/main/java/FooTest.java scripts/dev/tests-old/x.sh scripts/dev/work.sh
  scripts/feedback-quality/other.test.mjs scripts/feedback-quality/rules.mjs)
pubc 10:00 "$TP" docs/a.md "${PF5_PATHS[@]}"
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF5
expect "PF5: FAIL 줄 하나, 경로가 정확히 이름이 비슷한 여섯 경로(테스트 경로·docs/a.md 없음)" "$(fail_set 03-runner-test "${PF5_PATHS[@]}"; echo $?)" "$(show)"
expect "PF5: 03-runner-test의 새 확인 줄은 그것 하나" "$([ "$(new_lines 03-runner-test)" = 1 ]; echo $?)" "$(show)"
expect "PF5: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
PF6_PATHS=(.claude/hooks/guard.py .claude/settings.json apps/backend/src/main/resources/db/migration/V200__qa.sql
  scripts/run-feedback-quality-check.mjs scripts/feedback-quality/cases.smoke.json apps/frontend/a.tsx apps/mobile/a.tsx package.json
  .github/workflows/ci.yml docker-compose.yml scripts/ops/deploy.sh infra/nginx/a.conf tools/x.txt .gitignore)
pubc 10:00 "$TP" "${PF6_PATHS[@]}"
expect "PF6: (준비) .gitignore에 /private/ 줄이 남아 있음" "$(grep -qx '/private/' "$R/.gitignore"; echo $?)"
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF6
expect "PF6: FAIL 줄 하나, 경로가 정확히 14개(그 밖의 영역과 규칙 없는 경로)" "$(fail_set 03-runner-test "${PF6_PATHS[@]}"; echo $?)" "$(show)"
expect "PF6: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
mkdir -p "$R/apps/backend/src/test/java"
g -C "$R" mv apps/backend/src/main/java/X.java apps/backend/src/test/java/X.java && at 10:00 -C "$R" commit -q -m mv
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF7
expect "PF7: 옮긴 파일은 옛 경로로 정확히 FAIL 줄(새 테스트 경로 없음)" \
  "$(line "FAIL 03-runner-test: non-test paths changed $PRE: apps/backend/src/main/java/X.java"; echo $?)" "$(show)"
expect "PF7: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
pubc 09:30 apps/backend/src/main/A.java
echo base > "$R/apps/backend/src/main/A.java"; g -C "$R" add -A && at 09:40 -C "$R" commit -q -m revert
pubc 10:00 "$TP"
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common PF8
expect "PF8: (준비) A.java가 기준 커밋과 같아짐" "$(git -C "$R" diff --quiet "$B" HEAD -- apps/backend/src/main/A.java; echo $?)"
expect "PF8: 고쳤다 되돌려 차이가 없으면 정확히 OK 줄" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF8: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

setup
runner 03-runner-test "HEAD $B | uncommitted 0"
check; common PF9
expect "PF9: 기록 HEAD = 기준 커밋이면 정확히 OK 줄" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF9: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pubc 10:00 "$TP"
runner 03-runner-test "HEAD 1234567890abcdef1234567890abcdef12345678 | uncommitted 0"
check; common PF10
expect "PF10: 정확히 FAIL 03-runner-test: commit 1234567 not found" "$(line "FAIL 03-runner-test: commit 1234567 not found"; echo $?)" "$(show)"
expect "PF10: only test paths·non-test paths 줄은 없음(새 확인 줄은 그것 하나)" "$([ "$(new_lines 03-runner-test)" = 1 ]; echo $?)" "$(show)"
expect "PF10: 기존 줄 OK 03-runner-test: uncommitted 0 그대로" "$(line "OK 03-runner-test: uncommitted 0"; echo $?)" "$(show)"
expect "PF10: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
pubc 10:00 "$TP"; T=$(head_of)
pubc 11:00 apps/backend/src/main/A.java; I=$(head_of)
runner 03-runner-test "HEAD $T | uncommitted 0"
runner 05-runner-test "HEAD $I | uncommitted 0"
check; common PF11
expect "PF11: 정확히 OK 03-runner-test 줄" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF11: 정확히 FAIL 05-runner-test 줄(A.java)" "$(line "FAIL 05-runner-test: non-test paths changed $PRE: apps/backend/src/main/A.java"; echo $?)" "$(show)"
expect "PF11: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup
pubc 10:00 "$TP"; T=$(head_of)
pubc 11:00 apps/backend/src/main/A.java
runner 03-runner-test "HEAD $T | uncommitted 2"
check; common PF12
expect "PF12: 기존 줄 FAIL 03-runner-test: uncommitted 2" "$(line "FAIL 03-runner-test: uncommitted 2"; echo $?)" "$(show)"
expect "PF12: 정확히 OK 03-runner-test: only test paths 줄도" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "PF12: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

# ================================================================ 대상이 아닌 경우(기준 커밋의 work.sh와 같음)
setup
pubc 10:00 apps/backend/src/main/A.java; I=$(head_of)
for rn in 03-runner-test-add 04-runner-testing 05-runner-test2 06-runner-impl 07-runner-fix; do runner "$rn" "HEAD $I | uncommitted 0"; done
check; common PF13
expect "PF13: 새 확인 줄이 없음" "$(! any_new; echo $?)" "$(show)"
same_as_base; SAB=$?
expect "PF13: 출력 줄 집합과 종료 코드가 기준 커밋의 work.sh와 같음" "$SAB" "$(show) $BASE_SHOW"
expect "PF13: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

setup
rm -f "$D/02-qa-tests.md"
echo s > "$D/02-qa-scenarios.md"; priv 09:00 02-qa-scenarios.md
pubc 10:00 apps/backend/src/main/A.java; I=$(head_of)
runner 03-runner-test "HEAD $I | uncommitted 0"
check; common PF14
expect "PF14: 새 기능이면 새 확인 줄이 없음" "$(! any_new; echo $?)" "$(show)"
same_as_base; SAB=$?
expect "PF14: 출력 줄 집합과 종료 코드가 기준 커밋의 work.sh와 같음" "$SAB" "$(show) $BASE_SHOW"
expect "PF14: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pubc 10:00 apps/backend/src/main/A.java
mkdir -p "$D/03-runner-test"
check; common PF15
expect "PF15: summary.txt가 없으면 새 확인 줄이 없음" "$(! any_new; echo $?)" "$(show)"
expect "PF15: 기존 줄 NOTE 03-runner-test: no summary.txt 그대로" "$(line "NOTE 03-runner-test: no summary.txt"; echo $?)" "$(show)"
same_as_base; SAB=$?
expect "PF15: 출력 줄 집합과 종료 코드가 기준 커밋의 work.sh와 같음" "$SAB" "$(show) $BASE_SHOW"
expect "PF15: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

for v in a b c; do
  setup
  pubc 10:00 apps/backend/src/main/A.java; I=$(head_of)
  case $v in
    a) runner 03-runner-test "HEAD=$I | git status --short 줄 수=0"; want="OK 03-runner-test: uncommitted 0" ;;
    b) runner 03-runner-test "결과만 있음"; want="NOTE 03-runner-test: cannot read the uncommitted count from: 결과만 있음" ;;
    c) runner 03-runner-test "HEAD ${I:0:7} | uncommitted 0"; want="OK 03-runner-test: uncommitted 0" ;;
  esac
  check; common "PF16($v)"
  expect "PF16($v): 형식이 아닌 첫 줄이면 새 확인 줄이 없음" "$(! any_new; echo $?)" "$(show)"
  expect "PF16($v): 기존 줄 '$want'" "$(line "$want"; echo $?)" "$(show)"
  same_as_base; SAB=$?
  expect "PF16($v): 출력 줄 집합과 종료 코드가 기준 커밋의 work.sh와 같음" "$SAB" "$(show) $BASE_SHOW"
  expect "PF16($v): 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
done

# ================================================================ 03-main-decision 2: CRLF 첫 줄도 형식에 맞음
setup
pubc 10:00 "$TP"; T=$(head_of)
pubc 11:00 apps/backend/src/main/A.java
mkdir -p "$D/03-runner-test"; printf 'HEAD %s | uncommitted 0\r\n' "$T" > "$D/03-runner-test/summary.txt"
check; common DEC2a
expect "DEC2: CRLF 첫 줄(테스트 경로만)도 확인해 정확히 OK 줄" "$(line "OK 03-runner-test: only test paths changed $PRE"; echo $?)" "$(show)"
expect "DEC2: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pubc 10:00 "$TP" apps/backend/src/main/A.java
mkdir -p "$D/03-runner-test"; printf 'HEAD %s | uncommitted 0\r\n' "$(head_of)" > "$D/03-runner-test/summary.txt"
check; common DEC2b
expect "DEC2: CRLF 첫 줄(운영 코드 변경)도 확인해 정확히 FAIL 줄" \
  "$(line "FAIL 03-runner-test: non-test paths changed $PRE: apps/backend/src/main/A.java"; echo $?)" "$(show)"
expect "DEC2: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

# ================================================================ 03-main-decision 5: 한글 경로는 한글 그대로
setup
pubc 10:00 "$TP" "apps/backend/src/main/한글.java"
runner 03-runner-test "HEAD $(head_of) | uncommitted 0"
check; common DEC5
expect "DEC5: 남는 한글 경로를 한글 그대로 적은 정확한 FAIL 줄" \
  "$(line "FAIL 03-runner-test: non-test paths changed $PRE: apps/backend/src/main/한글.java"; echo $?)" "$(show)"
expect "DEC5: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
