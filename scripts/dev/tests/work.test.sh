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

# 아래는 026 19-main-decision.md에서 더한 테스트(없는 폴더는 오류로 끝나고 아무것도 내거나 만들지 않는다)
before_root=$(ls -A "$R" | wc -l)
before_work=$(ls "$R/private/work" | wc -l)
run next private/work/없는폴더
expect "next: 없는 폴더는 거부하고 번호를 내지 않음" \
  "$([ "$RC" != 0 ] && ! echo "$OUT" | grep -qE '^[0-9]{2}$'; echo $?)" "rc=$RC out=$OUT"
run new 자식 --parent private/work/없는폴더
expect "new --parent: 없는 부모 폴더는 거부하고 아무것도 만들지 않음" \
  "$([ "$RC" != 0 ] && ! echo "$OUT" | grep -q '01-자식' && [ "$(ls -A "$R" | wc -l)" = "$before_root" ] && [ "$(ls "$R/private/work" | wc -l)" = "$before_work" ]; echo $?)" "rc=$RC out=$OUT"
run diff private/work/없는폴더
expect "diff: 없는 폴더는 거부하고 아무것도 만들지 않음" \
  "$([ "$RC" != 0 ] && ! echo "$OUT" | grep -q 'main-diff' && [ "$(ls "$R/private/work" | wc -l)" = "$before_work" ]; echo $?)" "rc=$RC out=$OUT"

# ================================================================ 028: 안내 파일 기억, 끝 커밋, 끼어든 커밋 목록
latest_diff() { ls "$1"/[0-9][0-9]-main-diff.txt 2>/dev/null | sort | tail -1; }
count_d() { ls "$1" | grep -c "main-diff"; }

# ---------------------------------------------------------------- 안내 파일 기억 (지침 작업)
R=$TMP/r6
make_repo "$R"
run new 기억 --instr
DG="$R/private/work/001-$TODAY-지침-기억"
run diff "private/work/001-$TODAY-지침-기억"
F=$(latest_diff "$DG")
expect "diff 지침: 안내 파일이 없으면 둘째 줄 '안내 파일: 없음'" "$([ "$RC" = 0 ] && sed -n 2p "$F" | grep -qx "안내 파일: 없음"; echo $?)" "rc=$RC line2=$(sed -n 2p "$F" 2>/dev/null)"
expect "diff 지침: 끼어든 커밋이 없으면 '없음'" "$(grep -A1 "^기준 커밋 뒤 커밋:" "$F" | grep -q "^  없음"; echo $?)" "file=$(head -5 "$F" 2>/dev/null)"

echo docs-changed >> "$R/docs/README.md"
run diff "private/work/001-$TODAY-지침-기억" --guide docs/README.md
F=$(latest_diff "$DG")
expect "diff 지침: 준 안내 파일을 둘째 줄에 적음" "$([ "$RC" = 0 ] && sed -n 2p "$F" | grep -qx "안내 파일: docs/README.md"; echo $?)" "rc=$RC line2=$(sed -n 2p "$F" 2>/dev/null)"

n=$(count_d "$DG")
run diff "private/work/001-$TODAY-지침-기억"
F=$(latest_diff "$DG")
expect "diff 지침: --guide 없이 다시 만들면 앞 목록을 다시 씀" \
  "$([ "$RC" = 0 ] && [ "$(count_d "$DG")" = $((n + 1)) ] && sed -n 2p "$F" | grep -qx "안내 파일: docs/README.md" && grep -q "+docs-changed" "$F"; echo $?)" "rc=$RC line2=$(sed -n 2p "$F" 2>/dev/null)"

echo private-changed >> "$R/private/README.md"
run diff "private/work/001-$TODAY-지침-기억" --guide private/README.md
F=$(latest_diff "$DG")
expect "diff 지침: 새 --guide는 앞 목록 뒤에 더함(비공개는 private/ 경로)" \
  "$([ "$RC" = 0 ] && sed -n 2p "$F" | grep -qx "안내 파일: docs/README.md private/README.md" && grep -q "+private-changed" "$F" && grep -q "+docs-changed" "$F"; echo $?)" "rc=$RC line2=$(sed -n 2p "$F" 2>/dev/null)"

run diff "private/work/001-$TODAY-지침-기억" --guide docs/README.md
F=$(latest_diff "$DG")
expect "diff 지침: 이미 있는 --guide는 한 번만" "$([ "$RC" = 0 ] && sed -n 2p "$F" | grep -qx "안내 파일: docs/README.md private/README.md"; echo $?)" "rc=$RC line2=$(sed -n 2p "$F" 2>/dev/null)"

run diff "private/work/001-$TODAY-지침-기억" --drop-guide docs/README.md
F=$(latest_diff "$DG")
expect "diff 지침: --drop-guide로 목록에서 뺌" \
  "$([ "$RC" = 0 ] && sed -n 2p "$F" | grep -qx "안내 파일: private/README.md" && ! grep -q "+docs-changed" "$F" && grep -q "+private-changed" "$F"; echo $?)" "rc=$RC line2=$(sed -n 2p "$F" 2>/dev/null)"

n=$(count_d "$DG")
run diff "private/work/001-$TODAY-지침-기억" --drop-guide docs/없는.md
expect "diff 지침: 목록에 없는 --drop-guide는 거부" "$([ "$RC" != 0 ] && [ "$(count_d "$DG")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"

# 다른 컴퓨터처럼 변경분 파일이 없고 검토 보고만 있는 경우
run new 이어서 --instr
DL="$R/private/work/002-$TODAY-지침-이어서"
echo "# 검토" > "$DL/03-instruction-reviewer-review.md"
run diff "private/work/002-$TODAY-지침-이어서"
expect "diff 지침: 검토 보고는 있는데 앞 변경분이 없으면 거부" "$([ "$RC" != 0 ] && [ "$(count_d "$DL")" = 0 ]; echo $?)" "rc=$RC out=$OUT"
run diff "private/work/002-$TODAY-지침-이어서" --no-guides
expect "diff 지침: --no-guides면 안내 파일 없이 만듦" "$([ "$RC" = 0 ] && sed -n 2p "$(latest_diff "$DL")" | grep -qx "안내 파일: 없음"; echo $?)" "rc=$RC out=$OUT"
run new 이어서2 --instr
DL2="$R/private/work/003-$TODAY-지침-이어서2"
echo "# 검토" > "$DL2/02-instruction-reviewer-review.md"
run diff "private/work/003-$TODAY-지침-이어서2" --guide docs/README.md
expect "diff 지침: 목록을 잃었어도 --guide를 다시 주면 만듦" "$([ "$RC" = 0 ] && sed -n 2p "$(latest_diff "$DL2")" | grep -qx "안내 파일: docs/README.md"; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- 끼어든 커밋 목록 (지침 작업)
run new 목록 --instr
DK="$R/private/work/004-$TODAY-지침-목록"
echo other-work >> "$R/.claude/skills/a/SKILL.md"
g -C "$R" commit -q -am "다른 작업의 지침 커밋"
echo priv-commit >> "$R/private/README.md"
g -C "$R/private" commit -q -am "비공개 안내 커밋"
run diff "private/work/004-$TODAY-지침-목록" --guide private/README.md
F=$(latest_diff "$DK")
expect "diff 지침: 기준 커밋 뒤 지침 커밋 목록" "$([ "$RC" = 0 ] && grep -A3 "^기준 커밋 뒤 커밋:" "$F" | grep -q "다른 작업의 지침 커밋"; echo $?)" "rc=$RC file=$(head -6 "$F" 2>/dev/null)"
expect "diff 지침: 비공개 기준 커밋 뒤 커밋 목록" "$(grep -A3 "^비공개 기준 커밋 뒤 커밋:" "$F" | grep -q "비공개 안내 커밋"; echo $?)" "file=$(cat "$F" 2>/dev/null | head -40)"
n=$(count_d "$DK")
run diff "private/work/004-$TODAY-지침-목록" --head HEAD
expect "diff 지침: --head는 거부" "$([ "$RC" != 0 ] && [ "$(count_d "$DK")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- 끝 커밋 (일반 작업)
R=$TMP/r7
make_repo "$R"
run new 끝커밋
DE="private/work/001-$TODAY-끝커밋"
echo t1 >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "test"
TC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DE/02-runner-test"; echo "HEAD=$TC" > "$R/$DE/02-runner-test/summary.txt"
echo impl >> "$R/apps/backend/src/main/A.java"; echo t2 >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "impl"
IC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DE/03-runner-impl"; echo "HEAD: $IC | status 0" > "$R/$DE/03-runner-impl/summary.txt"
echo later >> "$R/docs/README.md"; echo later-test >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "다른 작업"
run diff "$DE"
ALL="$R/$DE/04-main-diff-all.txt"; TST="$R/$DE/04-main-diff-tests.txt"
expect "diff: 끝 커밋은 가장 최근 runner 기록의 커밋" \
  "$([ "$RC" = 0 ] && head -1 "$ALL" | grep -qF "HEAD: ${IC:0:7}" && grep -q "+impl" "$ALL" && ! grep -q "+later" "$ALL"; echo $?)" "rc=$RC first=$(head -1 "$ALL" 2>/dev/null)"
expect "diff: 테스트 변경분도 같은 끝 커밋까지" \
  "$(head -1 "$TST" | grep -qF "HEAD: ${IC:0:7}" && grep -q "+t2" "$TST" && ! grep -q "+later-test" "$TST"; echo $?)" "first=$(head -1 "$TST" 2>/dev/null)"

run diff "$DE" --head "$TC"
ALL="$R/$DE/05-main-diff-all.txt"
expect "diff: --head로 끝 커밋을 정함" "$([ "$RC" = 0 ] && head -1 "$ALL" | grep -qF "HEAD: ${TC:0:7}" && ! grep -q "+impl" "$ALL"; echo $?)" "rc=$RC first=$(head -1 "$ALL" 2>/dev/null)"
n=$(count_d "$R/$DE")
run diff "$DE" --head 없는커밋
expect "diff: 커밋이 아닌 --head는 거부" "$([ "$RC" != 0 ] && [ "$(count_d "$R/$DE")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"
mkdir -p "$R/$DE/06-runner-fix"
run diff "$DE"
expect "diff: 끝 커밋을 읽을 runner 기록에 summary.txt가 없으면 거부" "$([ "$RC" != 0 ] && [ "$(count_d "$R/$DE")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"

# ================================================================ 028 검증 뒤 결정(10-main-decision)
# ---------------------------------------------------------------- 구현 기록 뒤에 테스트를 더한 경우의 끝 커밋
R=$TMP/r8
make_repo "$R"
run new 테스트더함
DT="private/work/001-$TODAY-테스트더함"
echo t1 >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "test"
TC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DT/02-runner-test"; echo "HEAD=$TC" > "$R/$DT/02-runner-test/summary.txt"
echo impl >> "$R/apps/backend/src/main/A.java"; g -C "$R" commit -q -am "impl"
IC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DT/03-runner-impl"; echo "HEAD=$IC" > "$R/$DT/03-runner-impl/summary.txt"
echo t3 >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "test2"
T2=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DT/04-runner-test2"; echo "HEAD=$T2" > "$R/$DT/04-runner-test2/summary.txt"
echo later >> "$R/docs/README.md"; g -C "$R" commit -q -am "다른 작업"
run diff "$DT"
ALL="$R/$DT/05-main-diff-all.txt"; TST="$R/$DT/05-main-diff-tests.txt"
expect "diff: 구현 기록 뒤에 테스트 기록이 있으면 끝 커밋은 그 테스트 기록의 커밋" \
  "$([ "$RC" = 0 ] && head -1 "$ALL" | grep -qF "HEAD: ${T2:0:7}" && grep -q "+t3" "$ALL" && ! grep -q "+later" "$ALL"; echo $?)" "rc=$RC first=$(head -1 "$ALL" 2>/dev/null)"
expect "diff: 그때 테스트 변경분은 그 테스트 커밋부터 같은 커밋까지라 비어 있음" \
  "$(head -1 "$TST" | grep -qF "테스트 커밋: ${T2:0:7} / HEAD: ${T2:0:7}" && [ "$(wc -l < "$TST")" = 1 ]; echo $?)" "file=$(cat "$TST" 2>/dev/null | head -5)"

mkdir -p "$R/$DT/06-runner-fix"; echo "결과만 있음 PASS 1" > "$R/$DT/06-runner-fix/summary.txt"
n=$(count_d "$R/$DT")
run diff "$DT"
expect "diff: 끝 커밋을 읽을 runner 기록 첫 줄에 커밋이 없으면 거부" "$([ "$RC" != 0 ] && [ "$(count_d "$R/$DT")" = "$n" ]; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- 끼어든 커밋 목록이 상관없는 커밋을 뺌
R=$TMP/r9
make_repo "$R"
run new 거름 --instr
DF="$R/private/work/001-$TODAY-지침-거름"
echo app-only >> "$R/apps/backend/src/main/A.java"; g -C "$R" commit -q -am "앱만 바꾼 커밋"
echo instr >> "$R/.claude/skills/a/SKILL.md"; g -C "$R" commit -q -am "지침만 바꾼 커밋"
echo other > "$R/private/other.md"; g -C "$R/private" add other.md; g -C "$R/private" commit -q -m "비공개 다른 파일 커밋"
run diff "private/work/001-$TODAY-지침-거름" --guide private/README.md
F=$(latest_diff "$DF")
expect "diff 지침: 끼어든 커밋 목록은 .claude·안내 파일과 상관없는 커밋을 뺌" \
  "$([ "$RC" = 0 ] && grep -q "지침만 바꾼 커밋" "$F" && ! grep -q "앱만 바꾼 커밋" "$F"; echo $?)" "rc=$RC file=$(head -6 "$F" 2>/dev/null)"
expect "diff 지침: 비공개 쪽도 안내 파일과 상관없는 커밋은 빼고, 없으면 '없음'" \
  "$(grep -A1 "^비공개 기준 커밋 뒤 커밋:" "$F" | grep -q "^  없음" && ! grep -q "비공개 다른 파일 커밋" "$F"; echo $?)" "file=$(cat "$F" 2>/dev/null | head -40)"

# ---------------------------------------------------------------- 앞 목록이 있으면 --no-guides 거부
R=$TMP/r10
make_repo "$R"
run new 목록지킴 --instr
DN="$R/private/work/001-$TODAY-지침-목록지킴"
run diff "private/work/001-$TODAY-지침-목록지킴" --guide docs/README.md
n=$(count_d "$DN")
run diff "private/work/001-$TODAY-지침-목록지킴" --no-guides
expect "diff 지침: 앞 변경분에 안내 파일 목록이 있으면 --no-guides는 거부하고 --drop-guide를 안내" \
  "$([ "$RC" != 0 ] && [ "$(count_d "$DN")" = "$n" ] && echo "$OUT" | grep -q -- "--drop-guide"; echo $?)" "rc=$RC out=$OUT"
run new 빈목록 --instr
DN2="$R/private/work/002-$TODAY-지침-빈목록"
run diff "private/work/002-$TODAY-지침-빈목록"
run diff "private/work/002-$TODAY-지침-빈목록" --no-guides
expect "diff 지침: 앞 목록이 '없음'이면 --no-guides를 받아들임" \
  "$([ "$RC" = 0 ] && [ "$(count_d "$DN2")" = 2 ] && sed -n 2p "$(latest_diff "$DN2")" | grep -qx "안내 파일: 없음"; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- 공백이 든 --guide 경로 거부
echo spaced > "$R/docs/a b.md"; g -C "$R" add "docs/a b.md"; g -C "$R" commit -q -m "공백 이름 파일"
run new 공백 --instr
DS="$R/private/work/003-$TODAY-지침-공백"
run diff "private/work/003-$TODAY-지침-공백" --guide "docs/a b.md"
expect "diff 지침: 공백이 든 --guide 경로는 있는 파일이어도 거부" \
  "$([ "$RC" != 0 ] && [ "$(count_d "$DS")" = 0 ] && echo "$OUT" | grep -qi "space"; echo $?)" "rc=$RC out=$OUT"

# ================================================================ 028 다시 검증(16) 의심 1
# ---------------------------------------------------------------- 작업 폴더 이름에 -runner-test가 들어 있어도 구현 기록을 알아봄
R=$TMP/r11
make_repo "$R"
run new runner-test-정리
DR="private/work/001-$TODAY-runner-test-정리"
echo t1 >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "test"
TC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DR/02-runner-test"; echo "HEAD=$TC" > "$R/$DR/02-runner-test/summary.txt"
echo impl >> "$R/apps/backend/src/main/A.java"; g -C "$R" commit -q -am "impl"
IC=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DR/03-runner-impl"; echo "HEAD=$IC" > "$R/$DR/03-runner-impl/summary.txt"
echo later >> "$R/docs/README.md"; g -C "$R" commit -q -am "다른 작업"
run diff "$DR"
ALL="$R/$DR/04-main-diff-all.txt"
expect "diff: 작업 폴더 이름에 -runner-test가 있어도 끝 커밋은 runner 기록의 커밋" \
  "$([ "$RC" = 0 ] && head -1 "$ALL" | grep -qF "HEAD: ${IC:0:7}" && ! grep -q "+later" "$ALL"; echo $?)" "rc=$RC first=$(head -1 "$ALL" 2>/dev/null)"

# ================================================================ 034 실행 기록 도구(메인 세션의 테스트)
# ---------------------------------------------------------------- run
# 가짜 gradlew와 ensure-docker.sh: 부른 인자를 파일에 남기고 FAKE_*_RC로 종료 코드를 정한다.
R=$TMP/r12
make_repo "$R"
printf '#!/usr/bin/env bash\necho "$*" >> "%s"\nexit ${FAKE_GRADLE_RC:-0}\n' "$TMP/r12-gradle-calls" > "$R/apps/backend/gradlew"
mkdir -p "$R/scripts/dev"
printf '#!/usr/bin/env bash\nif [ "${FAKE_DOCKER_RC:-0}" = 0 ]; then echo "docker: already running"; else echo "docker: FAIL fake"; fi\nexit ${FAKE_DOCKER_RC:-0}\n' > "$R/scripts/dev/ensure-docker.sh"
g -C "$R" add -A && g -C "$R" commit -q -m tools
run new 실행
DX="private/work/001-$TODAY-실행"
calls() { cat "$TMP/r12-gradle-calls" 2>/dev/null; }

echo dirty >> "$R/apps/backend/src/main/A.java"
run run "$DX" --name impl
expect "run: 커밋하지 않은 변경이 있으면 거부하고 기록 폴더를 만들지 않는다" \
  "$([ "$RC" = 2 ] && ! ls -d "$R/$DX"/[0-9][0-9]-runner-* > /dev/null 2>&1; echo $?)" "rc=$RC out=$OUT"
g -C "$R" checkout -q -- apps/backend/src/main/A.java

echo impl >> "$R/apps/backend/src/main/A.java"; g -C "$R" commit -q -am impl
H=$(git -C "$R" rev-parse HEAD)
run run "$DX" --name impl
S="$R/$DX/02-runner-impl/summary.txt"
expect "run: 백엔드가 바뀌면 Docker를 켜고 backend-test를 돌려 다음 번호 기록에 남긴다" \
  "$([ "$RC" = 0 ] && [ "$(head -1 "$S")" = "HEAD $H | uncommitted 0" ] && grep -qx "OK docker: already running" "$S" && grep -qx "OK backend-test backend-test.txt" "$S"; echo $?)" "rc=$RC out=$OUT"
expect "run: backend-test는 ./gradlew test --no-daemon --rerun이고 기록 첫 줄에 명령·HEAD가 있다" \
  "$(calls | grep -qx "test --no-daemon --rerun" && head -1 "$R/$DX/02-runner-impl/backend-test.txt" | grep -qF "bash ./gradlew test --no-daemon --rerun | HEAD $H | uncommitted 0"; echo $?)" "calls=$(calls)"

FAKE_GRADLE_RC=1 run run "$DX" --name fix
expect "run: 항목이 실패하면 FAIL을 적고 종료 코드 1" \
  "$([ "$RC" = 1 ] && grep -qx "FAIL backend-test backend-test.txt" "$R/$DX/03-runner-fix/summary.txt"; echo $?)" "rc=$RC out=$OUT"

rm -f "$TMP/r12-gradle-calls"
FAKE_DOCKER_RC=1 run run "$DX" --name nodocker
expect "run: Docker를 켜지 못하면 Docker 항목을 돌리지 않고 FAIL" \
  "$([ "$RC" = 1 ] && grep -q "^FAIL docker:" "$R/$DX/04-runner-nodocker/summary.txt" && grep -qx "FAIL backend-test backend-test.txt" "$R/$DX/04-runner-nodocker/summary.txt" && grep -q "^not run: docker is not available" "$R/$DX/04-runner-nodocker/backend-test.txt" && [ -z "$(calls)" ]; echo $?)" "rc=$RC calls=$(calls)"

mkdir -p "$R/weird"; echo w > "$R/weird/file.txt"; echo more >> "$R/docs/README.md"
g -C "$R" add -A && g -C "$R" commit -q -m "기타"
run run "$DX" --name note
S="$R/$DX/05-runner-note/summary.txt"
expect "run: 표에 없는 경로는 NOTE unmatched, 문서는 아무것도 적지 않는다" \
  "$([ "$RC" = 0 ] && grep -qx "NOTE unmatched weird/file.txt" "$S" && ! grep -q "docs/README.md" "$S"; echo $?)" "rc=$RC out=$OUT"

echo f > "$R/apps/backend/src/main/FooFeedbackService.java"; g -C "$R" add -A && g -C "$R" commit -q -m feedback
run run "$DX" --name llm
expect "run: 문장 피드백 파일이 바뀌었는데 승인이 없으면 NEEDS llm-smoke와 종료 코드 3" \
  "$([ "$RC" = 3 ] && grep -q "^NEEDS llm-smoke " "$R/$DX/06-runner-llm/summary.txt"; echo $?)" "rc=$RC out=$OUT"

run run "$DX" --name x --only rules-test --tests FooTest
expect "run: backend-test를 돌리지 않는데 --tests를 주면 거부" "$([ "$RC" = 2 ]; echo $?)" "rc=$RC out=$OUT"
run run "$DX" --name x --only nope
expect "run: --only에 없는 항목은 거부" "$([ "$RC" = 2 ] && echo "$OUT" | grep -q "unknown item"; echo $?)" "rc=$RC out=$OUT"
run run "$DX" --name Bad_Name
expect "run: 이름은 소문자·숫자·-만" "$([ "$RC" = 2 ]; echo $?)" "rc=$RC out=$OUT"

mkdir "$R/.git/work-run.lock"; echo $$ > "$R/.git/work-run.lock/pid"
run run "$DX" --name locked
expect "run: 살아 있는 프로세스가 잡은 잠금이 있으면 거부" \
  "$([ "$RC" = 2 ] && echo "$OUT" | grep -q "another work.sh run" && ! [ -d "$R/$DX/07-runner-locked" ]; echo $?)" "rc=$RC out=$OUT"
echo 999999 > "$R/.git/work-run.lock/pid"
run run "$DX" --name stale --only backend-test
expect "run: 잡은 프로세스가 없는 잠금은 치우고 돌린다, 끝나면 잠금을 푼다" \
  "$([ "$RC" = 0 ] && [ -d "$R/$DX/07-runner-stale" ] && ! [ -e "$R/.git/work-run.lock" ]; echo $?)" "rc=$RC out=$OUT"

R=$TMP/r14
make_repo "$R"
mkdir -p "$R/scripts/feedback-quality"; echo x > "$R/scripts/feedback-quality/x.mjs"
g -C "$R" add -A && g -C "$R" commit -q -m rules
run new 이동
mkdir -p "$R/tools"; g -C "$R" mv scripts/feedback-quality/x.mjs tools/x.mjs; g -C "$R" commit -q -m move
run run "private/work/001-$TODAY-이동" --name mv
S="$R/private/work/001-$TODAY-이동/02-runner-mv/summary.txt"
expect "run: 다른 영역으로 옮긴 파일은 옛 경로의 확인도 고른다(--no-renames)" \
  "$(grep -q " rules-test " "$S" && grep -qx "NOTE unmatched tools/x.mjs" "$S"; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- check
gd() { GIT_COMMITTER_DATE="$1" GIT_AUTHOR_DATE="$1" g "${@:2}"; }
R=$TMP/r13
make_repo "$R"
run new 대조
DC="private/work/001-$TODAY-대조"
# 시나리오보다 먼저 지침만 바꾼 공개 커밋이 끼어도 구현 커밋과 비교한다(034 결정 M).
echo guide >> "$R/.claude/skills/a/SKILL.md"; gd "2025-12-31T23:00:00" -C "$R" commit -q -am "지침"
echo scenario > "$R/$DC/02-qa-scenarios.md"
gd "2026-01-01T00:00:00" -C "$R/private" add -A && gd "2026-01-01T00:00:00" -C "$R/private" commit -q -m scen
echo impl >> "$R/apps/backend/src/main/A.java"; gd "2026-01-01T01:00:00" -C "$R" commit -q -am impl
H=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DC/03-runner-impl"; echo "HEAD $H | uncommitted 0" > "$R/$DC/03-runner-impl/summary.txt"
echo "기준 커밋: x / HEAD: ${H:0:7} / 명령: git diff" > "$R/$DC/04-main-diff-all.txt"
run check "$DC"
expect "check: 시나리오가 (지침 커밋을 뺀) 첫 구현 커밋보다 먼저 한 번만 커밋, 기록 깨끗, 기록 커밋 = 변경분 HEAD면 모두 OK" \
  "$([ "$RC" = 0 ] && ! echo "$OUT" | grep -q "^FAIL" && [ "$(echo "$OUT" | grep -c "^OK")" = 3 ] && echo "$OUT" | grep -q "first implementation commit ${H:0:7}"; echo $?)" "rc=$RC out=$OUT"

echo changed >> "$R/$DC/02-qa-scenarios.md"; gd "2026-01-01T02:00:00" -C "$R/private" commit -q -am scen2
mkdir -p "$R/$DC/05-runner-fix"; echo "HEAD $H | uncommitted 1" > "$R/$DC/05-runner-fix/summary.txt"
mkdir -p "$R/$DC/06-runner-empty"
run check "$DC"
expect "check: 시나리오를 다시 고쳤거나, 기록에 커밋하지 않은 변경이 있으면 FAIL과 종료 코드 1" \
  "$([ "$RC" = 1 ] && echo "$OUT" | grep -q "^FAIL 02-qa-scenarios.md: changed after" && echo "$OUT" | grep -q "^FAIL 05-runner-fix: uncommitted 1"; echo $?)" "rc=$RC out=$OUT"
expect "check: summary.txt가 없는 실행 기록 폴더는 NOTE" "$(echo "$OUT" | grep -qx "NOTE 06-runner-empty: no summary.txt"; echo $?)" "out=$OUT"

# ================================================================ 035 실행 기록 대조 보강(메인 세션의 테스트)
# ---------------------------------------------------------------- check: 고치기 전 기록보다 먼저 바뀐 경로
R=$TMP/r20
make_repo "$R"
run new 고치기전
DP="private/work/001-$TODAY-고치기전"
echo guide >> "$R/.claude/skills/a/SKILL.md"; g -C "$R" commit -q -am "지침"
echo spec >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "test: 재현"
T=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DP/02-runner-test"; echo "HEAD $T | uncommitted 0" > "$R/$DP/02-runner-test/summary.txt"
run check "$DP"
expect "check: 고치기 전 기록 앞에 테스트·지침만 바뀌었으면 OK" \
  "$([ "$RC" = 0 ] && echo "$OUT" | grep -qx "OK 02-runner-test: only test paths changed before the pre-fix record"; echo $?)" "rc=$RC out=$OUT"

run new 늦은기록
DL="private/work/002-$TODAY-늦은기록"
echo spec2 >> "$R/apps/backend/src/test/ATest.java"; g -C "$R" commit -q -am "test: 재현"
echo fix >> "$R/apps/backend/src/main/A.java"; g -C "$R" commit -q -am "fix: 구현"
L=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DL/02-runner-test"; echo "HEAD $L | uncommitted 0" > "$R/$DL/02-runner-test/summary.txt"
run check "$DL"
expect "check: 고치기 전 기록 앞에 운영 코드가 바뀌었으면 그 경로만 적어 FAIL, 종료 코드 1" \
  "$([ "$RC" = 1 ] && echo "$OUT" | grep -qx "FAIL 02-runner-test: non-test paths changed before the pre-fix record: apps/backend/src/main/A.java"; echo $?)" "rc=$RC out=$OUT"

echo "HEAD=$L | git status --short 줄 수=0" > "$R/$DL/02-runner-test/summary.txt"
run check "$DL"
expect "check: 옛 형식 기록이면 이 확인을 하지 않는다" "$(! echo "$OUT" | grep -q "pre-fix record"; echo $?)" "out=$OUT"

echo "HEAD $L | uncommitted 0" > "$R/$DL/02-runner-test/summary.txt"
echo scenario > "$R/$DL/01-qa-scenarios.md"
run check "$DL"
expect "check: 새 기능(시나리오가 있음)이면 이 확인을 하지 않는다" "$(! echo "$OUT" | grep -q "pre-fix record"; echo $?)" "out=$OUT"
rm -f "$R/$DL/01-qa-scenarios.md"

echo "HEAD 0123456789abcdef0123456789abcdef01234567 | uncommitted 0" > "$R/$DL/02-runner-test/summary.txt"
run check "$DL"
expect "check: 기록의 커밋이 저장소에 없으면 FAIL" \
  "$([ "$RC" = 1 ] && echo "$OUT" | grep -qx "FAIL 02-runner-test: commit 0123456 not found"; echo $?)" "rc=$RC out=$OUT"

# ---------------------------------------------------------------- run: 임시 컨테이너와 18080 정리 확인
# 가짜 docker는 FAKE_PS를 ps 출력으로, FAKE_PS_RC를 종료 코드로 쓴다. 가짜 netstat은 FAKE_NETSTAT을 출력한다.
R=$TMP/r21
make_repo "$R"
mkdir -p "$R/scripts/dev"
printf '#!/usr/bin/env bash\necho "docker: already running"\n' > "$R/scripts/dev/ensure-docker.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "$R/scripts/dev/check-db-migrations.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "$R/apps/backend/gradlew"
g -C "$R" add -A && g -C "$R" commit -q -m tools
run new 정리
DN="private/work/001-$TODAY-정리"
B15="$TMP/bin15"
mkdir -p "$B15"
printf '#!/usr/bin/env bash\nif [ "$1" = ps ]; then printf "%%b" "${FAKE_PS:-}"; exit ${FAKE_PS_RC:-0}; fi\nexit 0\n' > "$B15/docker"
printf '#!/usr/bin/env bash\nprintf "%%b" "${FAKE_NETSTAT:-}"\n' > "$B15/netstat"
chmod +x "$B15/docker" "$B15/netstat"
last_sum() { ls -d "$R/$DN"/[0-9][0-9]-runner-*/ | sort | tail -1 | sed 's|/$|/summary.txt|'; }

PATH="$B15:$PATH" run run "$DN" --name clean --only db-check
expect "run: 마이그레이션 확인 뒤 남은 것이 없으면 cleanup 줄 없이 종료 코드 0" \
  "$([ "$RC" = 0 ] && ! grep -q cleanup "$(last_sum)"; echo $?)" "rc=$RC out=$OUT"

FAKE_PS='other\nwl-check-mysql\nwl-check-redis\n' FAKE_NETSTAT='  TCP    0.0.0.0:18080   0.0.0.0:0   LISTENING   4321\r\n' \
  PATH="$B15:$PATH" run run "$DN" --name left --only db-check
expect "run: 남은 컨테이너와 18080 프로세스를 FAIL cleanup 한 줄에 적고 종료 코드 1" \
  "$([ "$RC" = 1 ] && grep -qx "FAIL cleanup: wl-check-mysql wl-check-redis; port 18080 LISTENING pid 4321" "$(last_sum)"; echo $?)" "rc=$RC out=$OUT"

FAKE_PS_RC=1 PATH="$B15:$PATH" run run "$DN" --name psfail --only db-check
expect "run: docker ps가 실패하면 FAIL cleanup: docker ps failed" \
  "$([ "$RC" = 1 ] && grep -qx "FAIL cleanup: docker ps failed" "$(last_sum)"; echo $?)" "rc=$RC out=$OUT"

FAKE_PS='wl-check-mysql\n' PATH="$B15:$PATH" run run "$DN" --name nodb --only backend-test
expect "run: 마이그레이션 확인·LLM 회귀를 돌리지 않았으면 정리 확인을 하지 않는다" \
  "$([ "$RC" = 0 ] && ! grep -q cleanup "$(last_sum)"; echo $?)" "rc=$RC out=$OUT"

# netstat이 있는 폴더를 뺀 PATH
NO_NETSTAT=""
IFS=: read -r -a DIRS15 <<< "$PATH"
for d in "${DIRS15[@]}"; do
  [ -n "$d" ] || continue
  { [ -e "$d/netstat" ] || [ -e "$d/netstat.exe" ] || [ -e "$d/NETSTAT.EXE" ]; } && continue
  NO_NETSTAT="${NO_NETSTAT:+$NO_NETSTAT:}$d"
done
rm -f "$B15/netstat"
PATH="$B15:$NO_NETSTAT" run run "$DN" --name nonetstat --only db-check
expect "run: netstat이 없으면 NOTE cleanup 줄, 종료 코드는 0 그대로" \
  "$([ "$RC" = 0 ] && grep -qx "NOTE cleanup: netstat not found; port 18080 not checked" "$(last_sum)"; echo $?)" "rc=$RC out=$OUT"

# ================================================================ 037 웹 테스트 기반(메인 세션의 테스트)
# ---------------------------------------------------------------- run: web-test
# 가짜 npm·npm.cmd: 부른 인자를 남기고, test면 FAKE_NPM_TEST_RC를 종료 코드로 쓴다.
# Windows의 work.sh는 npm.cmd를 부르고 cmd.exe가 돌리므로, npm.cmd는 bash로 가짜를 부르는 배치 파일로 만든다.
R=$TMP/r22
make_repo "$R"
run new 웹테스트
DW="private/work/001-$TODAY-웹테스트"
B22="$TMP/bin22"
NPM_CALLS="$TMP/r22-npm-calls"
mkdir -p "$B22"
printf '#!/usr/bin/env bash\necho "$*" >> "%s"\n[ "$2" = test ] && exit ${FAKE_NPM_TEST_RC:-0}\nexit 0\n' "$NPM_CALLS" > "$B22/npm-fake.sh"
printf '#!/usr/bin/env bash\nexec bash "$(dirname "$0")/npm-fake.sh" "$@"\n' > "$B22/npm"
BASH_W=$(cygpath -w "$(command -v bash)" 2> /dev/null || command -v bash)
printf '@"%s" "%%~dp0npm-fake.sh" %%*\r\n@exit /b %%ERRORLEVEL%%\r\n' "$BASH_W" > "$B22/npm.cmd"
chmod +x "$B22/npm-fake.sh" "$B22/npm" "$B22/npm.cmd"
mkdir -p "$R/apps/frontend/app"; echo page > "$R/apps/frontend/app/page.tsx"
g -C "$R" add -A && g -C "$R" commit -q -m web

PATH="$B22:$PATH" run run "$DW" --name impl
S="$R/$DW/02-runner-impl/summary.txt"
expect "run: 웹이 바뀌면 web-test와 web-build를 고르고 web-test를 먼저 돌린다" \
  "$([ "$RC" = 0 ] && grep -qx "OK web-test web-test.txt" "$S" && grep -qx "OK web-build web-build.txt" "$S" && [ "$(head -1 "$NPM_CALLS" | tr -d '\r')" = "run test --workspace @english-learning/frontend" ]; echo $?)" "rc=$RC out=$OUT calls=$(cat "$NPM_CALLS" 2>/dev/null)"
expect "run: web-test 기록 첫 줄에 명령과 HEAD" \
  "$(head -1 "$R/$DW/02-runner-impl/web-test.txt" | grep -qE "^# npm(\.cmd)? run test --workspace @english-learning/frontend \| HEAD $(git -C "$R" rev-parse HEAD) "; echo $?)" "$(head -1 "$R/$DW/02-runner-impl/web-test.txt" 2>/dev/null)"

: > "$NPM_CALLS"
FAKE_NPM_TEST_RC=1 PATH="$B22:$PATH" run run "$DW" --name fix --only web-test
expect "run: --only web-test이고 테스트가 실패하면 FAIL web-test, 종료 코드 1" \
  "$([ "$RC" = 1 ] && grep -qx "FAIL web-test web-test.txt" "$R/$DW/03-runner-fix/summary.txt" && ! grep -q web-build "$R/$DW/03-runner-fix/summary.txt" && grep -q "run test" "$NPM_CALLS"; echo $?)" "rc=$RC out=$OUT calls=$(cat "$NPM_CALLS" 2>/dev/null)"

# ---------------------------------------------------------------- check·diff: 웹 테스트 경로(apps/frontend/tests)
R=$TMP/r23
make_repo "$R"
run new 웹리팩터링
DF="private/work/001-$TODAY-웹리팩터링"
mkdir -p "$R/apps/frontend/tests" "$R/apps/frontend/app"
echo spec > "$R/apps/frontend/tests/loop.spec.test.tsx"; g -C "$R" add -A && g -C "$R" commit -q -m "test: 지금 동작"
T=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DF/02-runner-test"; echo "HEAD $T | uncommitted 0" > "$R/$DF/02-runner-test/summary.txt"
run check "$DF"
expect "check: 고치기 전 기록 앞에 웹 테스트만 바뀌었으면 OK" \
  "$(echo "$OUT" | grep -qx "OK 02-runner-test: only test paths changed before the pre-fix record"; echo $?)" "rc=$RC out=$OUT"

echo page > "$R/apps/frontend/app/page.tsx"; echo more >> "$R/apps/frontend/tests/loop.spec.test.tsx"
g -C "$R" add -A && g -C "$R" commit -q -m "refactor: 나눔"
I=$(git -C "$R" rev-parse HEAD)
mkdir -p "$R/$DF/03-runner-impl"; echo "HEAD $I | uncommitted 0" > "$R/$DF/03-runner-impl/summary.txt"
run diff "$DF"
expect "diff: 테스트 커밋 뒤에 바뀐 웹 테스트가 테스트 변경분에 나온다" \
  "$([ "$RC" = 0 ] && grep -q "apps/frontend/tests/loop.spec.test.tsx" "$R/$DF/04-main-diff-tests.txt" && ! grep -q "apps/frontend/app/page.tsx" "$R/$DF/04-main-diff-tests.txt"; echo $?)" "rc=$RC out=$OUT"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
