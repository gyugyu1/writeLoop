#!/usr/bin/env bash
# [spec] scripts/dev/work.sh check 테스트(qa). 작업 034 시나리오 CH0~CH14(02-qa-scenarios.md)와 03-main-decision.md의 Q8, Q9, M.
# 임시 폴더에 가짜 공개·비공개 저장소를 git init으로 만들고, 커밋 시각을 GIT_AUTHOR_DATE·GIT_COMMITTER_DATE로 같게 정한다.
# 공개 저장소의 기준 커밋은 08:00, 그 뒤 구현 커밋은 C1 10:00, C2 12:00(같은 날)이다. 진짜 저장소와 private/는 건드리지 않는다.
# work.sh는 지금 저장소의 것을 WORK_ROOT=<가짜 저장소>로 부른다.
#
#   bash scripts/dev/tests/work-check.spec.test.sh
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
# at <HH:MM> <git 인자>... : 그 시각(2026-01-01, +09:00)으로 커밋한다.
at() {
  local t="2026-01-01T$1:00+09:00"
  shift
  GIT_AUTHOR_DATE="$t" GIT_COMMITTER_DATE="$t" g "$@"
}

R=""
D=""
OUT=""
ERR=""
RC=""
N=0

# 새 가짜 저장소(R)와 작업 폴더(D, 기준 커밋 = 08:00 커밋)
setup() {
  N=$((N + 1))
  R="$TMP/r$N"
  mkdir -p "$R/apps/backend/src/main" "$R/docs" "$R/.claude/skills/a"
  g -C "$R" init -q -b main
  printf '/private/\n' > "$R/.gitignore"
  echo base > "$R/apps/backend/src/main/A.java"
  echo base > "$R/docs/README.md"
  echo base > "$R/.claude/skills/a/SKILL.md"
  g -C "$R" add -A && at 08:00 -C "$R" commit -q -m base
  mkdir -p "$R/private/work"
  g -C "$R/private" init -q -b main
  echo readme > "$R/private/README.md"
  g -C "$R/private" add -A && at 08:00 -C "$R/private" commit -q -m base
  local out
  out=$(WORK_ROOT="$R" bash "$WORK_SH" new qa 2>&1) || bad "setup $N: work.sh new 실패" "$out"
  D="$R/$out"
}
# 공개 저장소 커밋: pub <HH:MM> <경로> (그 파일에 한 줄 더함)
pub() {
  mkdir -p "$(dirname "$R/$2")"
  echo "change $1" >> "$R/$2"
  g -C "$R" add -A && at "$1" -C "$R" commit -q -m "pub $1 $2"
}
impl_commits() { pub 10:00 apps/backend/src/main/A.java; C1=$(git -C "$R" rev-parse HEAD); pub 12:00 apps/backend/src/main/A.java; C2=$(git -C "$R" rev-parse HEAD); }
# 비공개 저장소 커밋: priv <HH:MM> <작업 폴더 안 파일>...
priv() {
  local t=$1 f rel
  shift
  for f in "$@"; do
    rel=${D#"$R/private/"}/$f
    g -C "$R/private" add -- "$rel"
  done
  at "$t" -C "$R/private" commit -q -m "priv $t"
}
check() {
  OUT=$(cd "$R" && WORK_ROOT="$R" bash "$WORK_SH" check "$D" 2> "$TMP/err")
  RC=$?
  ERR=$(cat "$TMP/err")
}
show() { echo "rc=$RC out=$(echo "$OUT" | tr '\n' '|') err=$(echo "$ERR" | tr '\n' '|')"; }
has() { echo "$OUT" | grep -E "^$1 " | grep -qF -- "$2"; }
no_fail() { ! echo "$OUT" | grep -q '^FAIL'; }
# CH0: 비지 않은 줄은 모두 OK/FAIL/NOTE로 시작하고, FAIL 줄이 있으면 종료 코드 1, 없으면 0
common() {
  local id=$1
  expect "$id(CH0): 출력의 모든 줄이 OK/FAIL/NOTE로 시작" "$(! echo "$OUT" | grep -v '^$' | grep -qvE '^(OK|FAIL|NOTE)( |$)'; echo $?)" "$(show)"
  if echo "$OUT" | grep -q '^FAIL'; then
    expect "$id(CH0): FAIL 줄이 있으면 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
  else
    expect "$id(CH0): FAIL 줄이 없으면 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
  fi
}
sha() { sha256sum "$1" | cut -d' ' -f1; }
OTHER_SHA=0000000000000000000000000000000000000000000000000000000000000000
# 1단계 보고(시나리오 파일)에 겨냥 케이스 sha256을 적는다.
report_with() { printf '# 시나리오\n\n- `02-qa-cases-target.json` sha256: `%s`\n' "$1" > "$D/02-qa-scenarios.md"; }
# 실행 기록: runner <폴더 이름> <첫 줄>
runner() { mkdir -p "$D/$1"; echo "$2" > "$D/$1/summary.txt"; }
llm_record() { mkdir -p "$D/$1/llm"; printf '# run-llm-smoke: x | HEAD %s | uncommitted 0\nOK cases valid (02-qa-cases-target): 2 request(s), sha256 %s\n' "$(git -C "$R" rev-parse HEAD)" "$2" > "$D/$1/llm/summary.txt"; }

# ================================================================ 시나리오 파일의 커밋 시각
setup; impl_commits
echo s > "$D/02-qa-scenarios.md"; priv 09:00 02-qa-scenarios.md
check; common CH1
expect "CH1: 첫 구현 커밋보다 앞에 한 번 커밋한 시나리오는 OK" "$(has OK 02-qa-scenarios.md; echo $?)" "$(show)"
expect "CH1: 출력에 첫 구현 커밋 C1의 짧은 해시" "$(echo "$OUT" | grep -qF "${C1:0:7}"; echo $?)" "C1=${C1:0:7} $(show)"
expect "CH1: FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup; impl_commits
echo s > "$D/02-qa-scenarios.md"; priv 11:00 02-qa-scenarios.md
check; common CH2
expect "CH2: 첫 구현 커밋(10:00)보다 뒤(11:00)면 FAIL" "$(has FAIL 02-qa-scenarios.md; echo $?)" "$(show)"
expect "CH2: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
echo s > "$D/02-qa-scenarios.md"; priv 09:00 02-qa-scenarios.md
echo s2 >> "$D/02-qa-scenarios.md"; priv 09:30 02-qa-scenarios.md
check; common CH3
expect "CH3: 두 번 커밋되면 FAIL, 종료 코드 1" "$(has FAIL 02-qa-scenarios.md && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
echo s > "$D/02-qa-scenarios.md"
check; common CH4
expect "CH4: 커밋되지 않았으면 FAIL, 종료 코드 1" "$(has FAIL 02-qa-scenarios.md && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup
echo s > "$D/02-qa-scenarios.md"; priv 09:00 02-qa-scenarios.md
check; common CH5
expect "CH5: 기준 커밋 뒤 공개 커밋이 없으면 OK, 종료 코드 0" "$(has OK 02-qa-scenarios.md && no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

# 03-main-decision M: 문서·지침만 바꾼 커밋은 빼고 첫 구현 커밋과 비교한다.
setup
pub 10:00 docs/README.md
pub 10:30 .claude/skills/a/SKILL.md
pub 12:00 apps/backend/src/main/A.java; IC=$(git -C "$R" rev-parse HEAD)
echo s > "$D/02-qa-scenarios.md"; priv 11:00 02-qa-scenarios.md
check; common M1
expect "M1: 문서·지침 커밋(10:00, 10:30) 뒤, 첫 구현 커밋(12:00) 앞이면 OK" "$(has OK 02-qa-scenarios.md && no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"
expect "M1: 출력에 첫 구현 커밋의 짧은 해시" "$(echo "$OUT" | grep -qF "${IC:0:7}"; echo $?)" "impl=${IC:0:7} $(show)"

setup
pub 10:00 docs/README.md
echo s > "$D/02-qa-scenarios.md"; priv 11:00 02-qa-scenarios.md
check; common M2
expect "M2: 기준 커밋 뒤 커밋이 문서뿐이면(구현 커밋 없음) OK, 종료 코드 0" "$(has OK 02-qa-scenarios.md && no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup
pub 10:00 docs/README.md
pub 12:00 apps/backend/src/main/A.java
echo s > "$D/02-qa-scenarios.md"; priv 13:00 02-qa-scenarios.md
check; common M3
expect "M3: 첫 구현 커밋(12:00)보다 뒤(13:00)면 FAIL" "$(has FAIL 02-qa-scenarios.md && [ "$RC" = 1 ]; echo $?)" "$(show)"

# ================================================================ 겨냥 케이스
setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
report_with "$(sha "$D/02-qa-cases-target.json")"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 03-runner-impl "$(sha "$D/02-qa-cases-target.json")"
check; common CH7
expect "CH6·CH7: 한 번 커밋, sha256이 파일 = 보고 = 실행 기록이면 FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"
expect "CH6: 겨냥 케이스 커밋 시각 OK 줄" "$(has OK 02-qa-cases-target.json; echo $?)" "$(show)"

setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
FINAL='[{"id":"y"}]'
printf '%s\n' "$FINAL" > "$TMP/final.json"
report_with "$(sha "$TMP/final.json")"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
printf '%s\n' "$FINAL" > "$D/02-qa-cases-target.json"; priv 09:30 02-qa-cases-target.json
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 03-runner-impl "$(sha "$D/02-qa-cases-target.json")"
check; common CH6b
expect "CH6: 겨냥 케이스가 두 번 커밋되면 그 파일의 FAIL 줄(그것 하나), 종료 코드 1" \
  "$(has FAIL 02-qa-cases-target.json && [ "$(echo "$OUT" | grep -c '^FAIL')" = 1 ] && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
report_with "$OTHER_SHA"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 03-runner-impl "$(sha "$D/02-qa-cases-target.json")"
check; common CH8
expect "CH8: 보고의 sha256이 다르면 겨냥 케이스 FAIL, 종료 코드 1" "$(has FAIL 02-qa-cases-target.json && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
report_with "$(sha "$D/02-qa-cases-target.json")"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 03-runner-impl "$OTHER_SHA"
check; common CH9
expect "CH9: 실행 기록의 sha256이 다르면 겨냥 케이스 FAIL, 종료 코드 1" "$(has FAIL 02-qa-cases-target.json && [ "$RC" = 1 ]; echo $?)" "$(show)"

# 03-main-decision Q8
setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
printf '# 시나리오\n\n(sha256을 적지 않음)\n' > "$D/02-qa-scenarios.md"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 03-runner-impl "$(sha "$D/02-qa-cases-target.json")"
check; common Q8a
expect "Q8: 1단계 보고에 sha256이 없으면 겨냥 케이스 FAIL, 종료 코드 1" "$(has FAIL 02-qa-cases-target.json && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
report_with "$(sha "$D/02-qa-cases-target.json")"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
check; common Q8b
expect "Q8: LLM 실행 기록이 없으면 겨냥 케이스 NOTE" "$(has NOTE 02-qa-cases-target.json; echo $?)" "$(show)"
expect "Q8: 그때 FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup; impl_commits
echo '[{"id":"x"}]' > "$D/02-qa-cases-target.json"
report_with "$(sha "$D/02-qa-cases-target.json")"
priv 09:00 02-qa-cases-target.json 02-qa-scenarios.md
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 03-runner-impl "$(sha "$D/02-qa-cases-target.json")"
runner 04-runner-fix "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
llm_record 04-runner-fix "$OTHER_SHA"
check; common Q8c
expect "Q8: 실행 기록이 여럿이면 하나씩 대조해, 하나라도 다르면 FAIL, 종료 코드 1" "$(has FAIL 02-qa-cases-target.json && [ "$RC" = 1 ]; echo $?)" "$(show)"

# ================================================================ 실행 기록의 커밋하지 않은 변경 수
setup; impl_commits
H=$(git -C "$R" rev-parse HEAD)
runner 03-runner-impl "HEAD $H | uncommitted 0"
runner 04-runner-fix "HEAD $H | uncommitted 2"
check; common CH10
expect "CH10: uncommitted 2인 기록(04-runner-fix)은 FAIL" "$(has FAIL 04-runner-fix; echo $?)" "$(show)"
expect "CH10: uncommitted 0인 기록(03-runner-impl)의 FAIL 줄은 없음" "$(! has FAIL 03-runner-impl; echo $?)" "$(show)"
expect "CH10: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"

# 03-main-decision Q9
setup; impl_commits
H=$(git -C "$R" rev-parse HEAD)
runner 03-runner-test "HEAD=$H | git status --short 줄 수=0"
check; common Q9a
expect "Q9: 옛 형식 첫 줄의 마지막 숫자 0이면 FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"
runner 04-runner-impl "HEAD=$H | git status --short 줄 수=3"
check; common Q9a2
expect "Q9: 옛 형식 첫 줄의 마지막 숫자 3이면 그 기록 FAIL, 종료 코드 1" "$(has FAIL 04-runner-impl && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
mkdir -p "$D/03-runner-impl"
runner 04-runner-fix "결과만 있음"
check; common Q9b
expect "Q9: summary.txt가 없는 기록 폴더는 NOTE" "$(has NOTE 03-runner-impl; echo $?)" "$(show)"
expect "Q9: 첫 줄에서 수를 읽지 못하는 기록은 NOTE" "$(has NOTE 04-runner-fix; echo $?)" "$(show)"
expect "Q9: 그때 FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

# ================================================================ 실행 기록 커밋 = 최근 변경분 HEAD
setup; impl_commits
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
dout=$(WORK_ROOT="$R" bash "$WORK_SH" diff "$D" 2>&1) || bad "CH11: (준비) work.sh diff 실패" "$dout"
check; common CH11
expect "CH11: 가장 큰 실행 기록의 커밋 = 가장 최근 diff-all의 HEAD면 FAIL 없음, 종료 코드 0" "$([ -f "$D/04-main-diff-all.txt" ] && no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"
pub 13:00 apps/backend/src/main/A.java
runner 05-runner-fix "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
check; common CH12
expect "CH12: 그 뒤 더 큰 번호의 실행 기록(새 커밋)이 생겼는데 diff를 다시 만들지 않았으면 FAIL, 종료 코드 1" "$(echo "$OUT" | grep -q '^FAIL' && [ "$RC" = 1 ]; echo $?)" "$(show)"

setup; impl_commits
runner 03-runner-impl "HEAD $(git -C "$R" rev-parse HEAD) | uncommitted 0"
check; common CH13a
expect "CH13: 실행 기록만 있고 diff-all이 없으면 FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup; impl_commits
dout=$(WORK_ROOT="$R" bash "$WORK_SH" diff "$D" 2>&1) || bad "CH13: (준비) work.sh diff 실패" "$dout"
check; common CH13b
expect "CH13: diff-all만 있고 실행 기록이 없으면 FAIL 없음, 종료 코드 0" "$([ -f "$D/02-main-diff-all.txt" ] && no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

setup; impl_commits
check; common CH14
expect "CH14: 01만 있는 폴더는 FAIL 없음, 종료 코드 0" "$(no_fail && [ "$RC" = 0 ]; echo $?)" "$(show)"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
