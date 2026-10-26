#!/usr/bin/env bash
# scripts/dev/work.sh 테스트. 임시 폴더에 가짜 공개·비공개 저장소를 git init으로 만들어 네 명령(new, next, diff, status)을 확인한다.
# 실제 저장소와 private/는 건드리지 않는다. work.sh가 WORK_ROOT 환경 변수의 저장소를 쓰는 것을 이용한다.
#
#   bash scripts/dev/tests/work.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
WORK_SH="$HERE/../work.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TODAY=$(date +%F)
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false "$@"; }

# 가짜 공개 저장소($1)와 그 안의 비공개 저장소(private/)를 만든다.
make_repo() {
  local r=$1
  mkdir -p "$r"
  g -C "$r" init -q -b main
  printf '/private/\n' > "$r/.gitignore"
  mkdir -p "$r/apps/backend/src/main" "$r/apps/backend/src/test" "$r/.claude/skills/a" "$r/docs"
  echo base > "$r/apps/backend/src/main/A.java"
  echo base > "$r/apps/backend/src/test/ATest.java"
  echo skill > "$r/.claude/skills/a/SKILL.md"
  echo readme > "$r/docs/README.md"
  g -C "$r" add -A && g -C "$r" commit -q -m base
  mkdir -p "$r/private/work"
  g -C "$r/private" init -q -b main
  echo readme > "$r/private/README.md"
  g -C "$r/private" add -A && g -C "$r/private" commit -q -m base
}

# 저장소 루트에서 work.sh를 부른다. 출력은 OUT에, 종료 코드는 RC에 남긴다.
run() {
  OUT=$(cd "$R" && WORK_ROOT="$R" bash "$WORK_SH" "$@" 2>&1)
  RC=$?
}

short() { git -C "$1" rev-parse --short HEAD; }

# ---------------------------------------------------------------- new
R=$TMP/r1
make_repo "$R"
PUB=$(short "$R")
PRI=$(short "$R/private")

run new 첫작업
D1="private/work/001-$TODAY-첫작업"
expect "new: 첫 폴더는 001" "$([ "$RC" = 0 ] && [ -d "$R/$D1" ]; echo $?)" "rc=$RC out=$OUT"
expect "new: 만든 폴더 경로를 출력" "$(echo "$OUT" | grep -qF "$D1"; echo $?)" "out=$OUT"
expect "new: 01-main-spec.md 뼈대" "$([ -f "$R/$D1/01-main-spec.md" ]; echo $?)"
expect "new: 첫 줄에 두 저장소의 HEAD" \
  "$(head -1 "$R/$D1/01-main-spec.md" | grep -qF "기준 커밋: $PUB / 비공개 저장소 첫 변경 전 HEAD: $PRI"; echo $?)" \
  "first line: $(head -1 "$R/$D1/01-main-spec.md" 2>/dev/null)"

mkdir -p "$R/private/work/004-2026-01-01-옛작업" "$R/private/work/002-2026-01-01-더옛작업"
run new 다음작업
expect "new: 가장 큰 순번 다음 번호" "$([ "$RC" = 0 ] && [ -d "$R/private/work/005-$TODAY-다음작업" ]; echo $?)" "rc=$RC out=$OUT"

run new 규칙 --instr
DI="private/work/006-$TODAY-지침-규칙"
expect "new --instr: 이름 앞에 지침-" "$([ "$RC" = 0 ] && [ -d "$R/$DI" ]; echo $?)" "rc=$RC out=$OUT"
expect "new --instr: 01-main-purpose.md 뼈대" "$([ -f "$R/$DI/01-main-purpose.md" ] && [ ! -e "$R/$DI/01-main-spec.md" ]; echo $?)"
expect "new --instr: 첫 줄에 두 저장소의 HEAD" \
  "$(head -1 "$R/$DI/01-main-purpose.md" | grep -qF "기준 커밋: $PUB / 비공개 저장소 첫 변경 전 HEAD: $PRI"; echo $?)"

touch "$R/$D1/02-main-decision.md"
mkdir -p "$R/$D1/03-runner-test"
run new 목록 --parent "$D1"
DC="$D1/04-목록"
expect "new --parent: 부모의 다음 두 자리 번호로 자식 폴더" "$([ "$RC" = 0 ] && [ -d "$R/$DC" ]; echo $?)" "rc=$RC out=$OUT"
expect "new --parent: 자식 01 첫 줄은 부모 경로" "$(head -1 "$R/$DC/01-main-spec.md" | grep -q "^부모: $D1"; echo $?)" \
  "first line: $(head -1 "$R/$DC/01-main-spec.md" 2>/dev/null)"
expect "new --parent: 자식 01 둘째 줄은 기준 커밋" "$(sed -n 2p "$R/$DC/01-main-spec.md" | grep -qF "기준 커밋: $PUB"; echo $?)"

before=$(ls "$R/private/work" | wc -l)
run new 05-runner-x
expect "new: NN-runner-로 시작하는 이름은 거부" "$([ "$RC" != 0 ] && [ "$(ls "$R/private/work" | wc -l)" = "$before" ]; echo $?)" "rc=$RC out=$OUT"
run new runner-y --parent "$D1"
expect "new --parent: 자식 폴더 이름이 NN-runner-가 되면 거부" "$([ "$RC" != 0 ] && [ ! -e "$R/$D1/05-runner-y" ]; echo $?)" "rc=$RC out=$OUT"

R=$TMP/r2
make_repo "$R"
rm -rf "$R/private"
run new 작업
expect "new: private가 없으면 거부하고 아무것도 만들지 않음" "$([ "$RC" != 0 ] && [ ! -e "$R/private" ]; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- next
R=$TMP/r1
mkdir -p "$R/private/work/007-2026-01-01-번호"
touch "$R/private/work/007-2026-01-01-번호/01-main-spec.md" "$R/private/work/007-2026-01-01-번호/02-main-tests.md"
mkdir -p "$R/private/work/007-2026-01-01-번호/03-runner-test"
run next private/work/007-2026-01-01-번호
expect "next: 파일과 폴더 번호 중 가장 큰 것 + 1" "$([ "$RC" = 0 ] && [ "$OUT" = 04 ]; echo $?)" "rc=$RC out=$OUT"
mkdir -p "$R/private/work/008-2026-01-01-빈폴더"
run next private/work/008-2026-01-01-빈폴더
expect "next: 빈 폴더는 01" "$([ "$RC" = 0 ] && [ "$OUT" = 01 ]; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- diff (일반 작업)
R=$TMP/r3
make_repo "$R"
BASE=$(short "$R")
run new 기능
D="private/work/001-$TODAY-기능"
echo test2 >> "$R/apps/backend/src/test/ATest.java"
g -C "$R" commit -q -am "test"
TC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$D/02-runner-test"
echo "HEAD=$TC | git status --short 줄 수=0" > "$R/$D/02-runner-test/summary.txt"
echo impl >> "$R/apps/backend/src/main/A.java"
echo test3 >> "$R/apps/backend/src/test/ATest.java"
g -C "$R" commit -q -am "impl"
HEADS=$(short "$R")

run diff "$D"
ALL="$R/$D/03-main-diff-all.txt"
TESTS="$R/$D/03-main-diff-tests.txt"
expect "diff: 다음 번호로 전체 변경분" "$([ "$RC" = 0 ] && [ -f "$ALL" ]; echo $?)" "rc=$RC out=$OUT"
expect "diff: 전체 변경분 머리줄에 기준 커밋·HEAD·명령" \
  "$(head -1 "$ALL" | grep -qF "$BASE" && head -1 "$ALL" | grep -qF "$HEADS" && head -1 "$ALL" | grep -qF "git diff"; echo $?)" \
  "first line: $(head -1 "$ALL" 2>/dev/null)"
expect "diff: 전체 변경분에 기준 커밋 뒤의 모든 변경" "$(grep -q "src/main/A.java" "$ALL" && grep -q "src/test/ATest.java" "$ALL"; echo $?)"
expect "diff: runner-test 기록이 있으면 테스트 변경분" "$([ -f "$TESTS" ]; echo $?)"
expect "diff: 테스트 변경분 머리줄에 테스트 커밋" "$(head -1 "$TESTS" | grep -qF "${TC:0:7}"; echo $?)" \
  "first line: $(head -1 "$TESTS" 2>/dev/null)"
expect "diff: 테스트 변경분은 테스트 경로만" "$(grep -q "src/test/ATest.java" "$TESTS" && ! grep -q "src/main/A.java" "$TESTS"; echo $?)"
expect "diff: 테스트 변경분은 테스트 커밋 뒤만" "$(grep -q "+test3" "$TESTS" && ! grep -q "+test2" "$TESTS"; echo $?)"

run new 기능2
D2="private/work/002-$TODAY-기능2"
echo more >> "$R/apps/backend/src/main/A.java"
g -C "$R" commit -q -am "more"
run diff "$D2"
expect "diff: runner-test 기록이 없으면 전체 변경분만" \
  "$([ "$RC" = 0 ] && [ -f "$R/$D2/02-main-diff-all.txt" ] && ! ls "$R/$D2" | grep -q "diff-tests"; echo $?)" "rc=$RC out=$OUT"

mkdir -p "$R/private/work/003-2026-01-01-기준없음"
echo "# 작업 입력" > "$R/private/work/003-2026-01-01-기준없음/01-main-spec.md"
run diff private/work/003-2026-01-01-기준없음
expect "diff: 01에 기준 커밋이 없으면 거부하고 파일을 만들지 않음" \
  "$([ "$RC" != 0 ] && ! ls "$R/private/work/003-2026-01-01-기준없음" | grep -q diff; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- diff (지침 변경)
R=$TMP/r4
make_repo "$R"
PBASE=$(short "$R/private")
run new 규칙 --instr
DI="private/work/001-$TODAY-지침-규칙"
echo skill-changed >> "$R/.claude/skills/a/SKILL.md"
mkdir -p "$R/.claude/skills/b"
echo new-skill > "$R/.claude/skills/b/SKILL.md"
echo docs-changed >> "$R/docs/README.md"
echo outside-guide >> "$R/apps/backend/src/main/A.java"
echo private-readme-changed >> "$R/private/README.md"

run diff "$DI" --guide docs/README.md --guide private/README.md
F="$R/$DI/02-main-diff.txt"
expect "diff 지침: 변경분 이름은 NN-main-diff.txt" "$([ "$RC" = 0 ] && [ -f "$F" ] && [ ! -e "$R/$DI/02-main-diff-all.txt" ]; echo $?)" "rc=$RC out=$OUT"
expect "diff 지침: .claude의 바뀐 파일" "$(grep -q "skills/a/SKILL.md" "$F" && grep -q "+skill-changed" "$F"; echo $?)"
expect "diff 지침: .claude의 새 파일(git add -N)" "$(grep -q "skills/b/SKILL.md" "$F" && grep -q "+new-skill" "$F"; echo $?)"
expect "diff 지침: --guide로 준 공개 안내 파일" "$(grep -q "+docs-changed" "$F"; echo $?)"
expect "diff 지침: 안내 파일이 아닌 변경은 넣지 않음" "$([ -f "$F" ] && ! grep -q "outside-guide" "$F"; echo $?)"
expect "diff 지침: 비공개 안내 파일을 머리줄과 함께 이어 붙임" \
  "$(grep -q "+private-readme-changed" "$F" && grep "비공개 저장소" "$F" | grep -qF "$PBASE"; echo $?)"

# 아래는 08-main-decision.md에서 더한 테스트(잘못된 인자는 오류로 끝내고 파일을 만들지 않는다)
count_diff() { ls "$1" | grep -c diff; }
n=$(count_diff "$R/$DI")
run diff "$DI" --guide docs/없는파일.md
expect "diff 지침: 어디에도 없는 --guide 경로는 거부" "$([ "$RC" != 0 ] && [ "$(count_diff "$R/$DI")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"
run diff "$DI" --guide private/없는파일.md
expect "diff 지침: 비공개 저장소에 없는 --guide 경로는 거부" "$([ "$RC" != 0 ] && [ "$(count_diff "$R/$DI")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"

mkdir -p "$R/private/work/002-2026-01-01-지침-비공개기준없음"
echo "기준 커밋: $(short "$R")" > "$R/private/work/002-2026-01-01-지침-비공개기준없음/01-main-purpose.md"
run diff private/work/002-2026-01-01-지침-비공개기준없음 --guide private/README.md
expect "diff 지침: 01에 비공개 기준 커밋이 없는데 비공개 안내 파일을 주면 거부" \
  "$([ "$RC" != 0 ] && ! ls "$R/private/work/002-2026-01-01-지침-비공개기준없음" | grep -q diff; echo $?)" "rc=$RC out=$OUT"

run new 기능
DN="private/work/003-$TODAY-기능"
run diff "$DN" --guide docs/README.md
expect "diff: 지침이 아닌 폴더에 --guide를 주면 거부" "$([ "$RC" != 0 ] && [ "$(count_diff "$R/$DN")" = 0 ]; echo $?)" "rc=$RC out=$OUT"

before=$(ls "$R/$DN" | wc -l)
run new 자식 --instr --parent "$DN"
expect "new: --instr와 --parent를 함께 주면 거부" "$([ "$RC" != 0 ] && [ "$(ls "$R/$DN" | wc -l)" = "$before" ]; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- status
R=$TMP/r3
echo draft > "$R/$D2/03-main-note.md"
run status
expect "status: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "rc=$RC out=$OUT"
expect "status: 최근 작업 폴더 이름" "$(echo "$OUT" | grep -qF "001-$TODAY-기능" && echo "$OUT" | grep -qF "002-$TODAY-기능2"; echo $?)" "out=$OUT"
expect "status: 폴더의 마지막 파일 이름" "$(echo "$OUT" | grep -qF "03-main-note.md"; echo $?)" "out=$OUT"
expect "status: 커밋하지 않은 작업 폴더 파일" "$(echo "$OUT" | grep -q "커밋하지 않은" && echo "$OUT" | grep -qF "03-main-note.md"; echo $?)" "out=$OUT"
expect "status: origin이 없으면 push 안 된 커밋 수는 알 수 없음" "$(echo "$OUT" | grep -q "알 수 없음"; echo $?)" "out=$OUT"

R=$TMP/r1
run status --all
expect "status: 자식 폴더도 보인다" "$(echo "$OUT" | grep -qF "04-목록"; echo $?)" "out=$OUT"

# 아래는 08-main-decision.md에서 더한 테스트
R=$TMP/r5
make_repo "$R"
for i in 1 2 3 4 5 6 7; do mkdir -p "$R/private/work/00$i-2026-01-01-f$i"; done
touch "$R/private/work/007-2026-01-01-f7/01-a.md" "$R/private/work/007-2026-01-01-f7/02-b.md" "$R/private/work/007-2026-01-01-f7/03-c.md"
g init -q --bare "$TMP/remote.git"
g -C "$R" remote add origin "$TMP/remote.git"
g -C "$R" push -q origin main
echo x >> "$R/docs/README.md" && g -C "$R" commit -q -am one
echo y >> "$R/docs/README.md" && g -C "$R" commit -q -am two
g -C "$R" fetch -q origin
run status
expect "status: --all 없이는 최근 5개만" \
  "$(echo "$OUT" | grep -qF "003-2026-01-01-f3" && echo "$OUT" | grep -qF "007-2026-01-01-f7" && ! echo "$OUT" | grep -qF "002-2026-01-01-f2" && ! echo "$OUT" | grep -qF "001-2026-01-01-f1"; echo $?)" "out=$OUT"
expect "status: 폴더별 파일 수" "$(echo "$OUT" | grep -F "007-2026-01-01-f7" | grep -q "3개"; echo $?)" "out=$OUT"
expect "status: origin/main이 있으면 push 안 된 커밋 수" "$(echo "$OUT" | grep -q "^  공개 저장소: 2개"; echo $?)" "out=$OUT"
run status --all
expect "status --all: 전부 보인다" "$(echo "$OUT" | grep -qF "001-2026-01-01-f1"; echo $?)" "out=$OUT"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
