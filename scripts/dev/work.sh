#!/usr/bin/env bash
# 작업 폴더(private/work/) 도우미: 손으로 하던 폴더 만들기, 다음 번호, 변경분 만들기, 진행 상태 보기를 한다.
# 규칙은 .claude/skills/work-folder에 있다. 판단(끝났는지, 무엇을 고칠지)은 하지 않는다.
#
#   bash scripts/dev/work.sh new <이름> [--instr] [--parent <폴더>]
#   bash scripts/dev/work.sh next <폴더>
#   bash scripts/dev/work.sh diff <폴더> [--guide <경로>]...
#   bash scripts/dev/work.sh status [--all]
#
# new     private/work/에 <다음 세 자리 순번>-<오늘 날짜>-<이름>/ 폴더와 01 뼈대를 만들고 경로를 출력한다.
#         01 첫 줄에 두 저장소의 지금 HEAD를 기준 커밋으로 적는다.
#         --instr  지침 변경 폴더(이름 앞에 "지침-", 01-main-purpose.md)
#         --parent 그 폴더 안에 <다음 두 자리 번호>-<이름>/ 자식 폴더를 만든다(첫 줄은 부모 경로).
# next    폴더의 다음 두 자리 번호를 출력한다.
# diff    01의 기준 커밋으로 변경분 파일을 다음 번호로 만든다.
#         일반 작업: NN-main-diff-all.txt(기준..HEAD). -runner-test 기록이 있으면 NN-main-diff-tests.txt도.
#         지침 작업: NN-main-diff.txt(기준 커밋부터 커밋하지 않은 변경까지, .claude와 --guide 경로).
#                    .claude와 안내 파일의 새 파일은 git add -N 한다. private/ 안의 안내 파일은 비공개 저장소 diff를 이어 붙인다.
# status  최근 작업 폴더 5개(--all이면 전부)의 파일 수와 마지막 파일, 커밋하지 않은 작업 폴더 파일, push 안 된 커밋 수.
#
# <폴더>는 저장소 루트 기준 경로(예: private/work/026-2026-10-27-작업폴더-스크립트)나 절대경로다.
# 저장소 위치는 이 스크립트 위치로 정하고, WORK_ROOT가 있으면 그것을 쓴다(테스트가 가짜 저장소를 가리킬 때).
set -uo pipefail

ROOT=${WORK_ROOT:-$(dirname "$0")/../..}
ROOT=$(cd "$ROOT" && pwd -P) || exit 2
PRIV="$ROOT/private"
WORK="$PRIV/work"
# 테스트 변경분 경로. work-process 스킬의 verifier 절과 같게 둔다.
TEST_PATHS=(apps/backend/src/test scripts/feedback-quality scripts/run-feedback-quality-check.mjs scripts/dev)

die() { echo "work.sh: $*" >&2; exit 2; }
usage() { sed -n '4,7p' "$0" | sed 's/^# *//'; }

need_private() {
  [ -d "$PRIV/.git" ] || die "private is not cloned: $PRIV (git clone https://github.com/gyugyu1/writeloop-private.git private)"
}

# 폴더 인자를 절대경로로 바꾼다.
abs_dir() {
  local d=$1
  case "$d" in /* | [A-Za-z]:*) ;; *) d="$ROOT/$d" ;; esac
  [ -d "$d" ] || die "folder not found: $1"
  (cd "$d" && pwd -P)
}
rel() { echo "${1#"$ROOT"/}"; }

# 폴더 안 파일과 폴더 이름 앞 두 자리 번호 중 가장 큰 것 + 1
next_no() {
  local d=$1 max=0 n e
  for e in "$d"/*; do
    [ -e "$e" ] || continue
    e=$(basename "$e")
    if [[ $e =~ ^([0-9]{2})- ]]; then
      n=$((10#${BASH_REMATCH[1]}))
      [ "$n" -gt "$max" ] && max=$n
    fi
  done
  printf '%02d' $((max + 1))
}

is_runner_name() { [[ $1 =~ ^[0-9]{2}-runner- ]]; }

spec_body() {
  cat <<'EOF'

# 작업 입력

- 작업 종류: (채울 것)
- 규모: (채울 것)
- backlog 항목: (채울 것)

## 확인받은 명세 (원문)

(채울 것)
EOF
}

purpose_body() {
  cat <<'EOF'

# 변경의 목적

(채울 것)

backlog 항목: (채울 것)

# 사용자와 이미 정한 내용

(채울 것)

메인 세션: 이 대화의 메인 세션.
EOF
}

cmd_new() {
  local name="" instr=0 parent=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --instr) instr=1; shift ;;
      --parent) parent=${2:-}; [ -n "$parent" ] || die "--parent needs a folder"; shift 2 ;;
      -*) die "unknown option: $1" ;;
      *) [ -z "$name" ] || die "extra argument: $1"; name=$1; shift ;;
    esac
  done
  [ -n "$name" ] || { usage >&2; exit 2; }
  case "$name" in */* | *\\*) die "name must not contain a slash: $name" ;; esac
  # private/.gitignore가 NN-runner-로 시작하는 폴더를 runner 원본 기록으로 보고 커밋에서 뺀다.
  is_runner_name "$name" && die "name must not start with NN-runner-: $name"
  need_private

  local pub pri base_line dir
  pub=$(git -C "$ROOT" rev-parse --short HEAD) || die "cannot read HEAD of $ROOT"
  pri=$(git -C "$PRIV" rev-parse --short HEAD) || die "cannot read HEAD of $PRIV"
  base_line="기준 커밋: $pub / 비공개 저장소 첫 변경 전 HEAD: $pri"

  if [ -n "$parent" ]; then
    local pd child
    pd=$(abs_dir "$parent")
    child="$(next_no "$pd")-$name"
    is_runner_name "$child" && die "child folder name would start with NN-runner-: $child"
    dir="$pd/$child"
    mkdir "$dir" || die "cannot create $dir"
    { echo "부모: $(rel "$pd")/ · 계획 (채울 것)"; echo "$base_line"; spec_body; } > "$dir/01-main-spec.md"
  else
    local max=0 n e prefix=""
    mkdir -p "$WORK"
    for e in "$WORK"/*/; do
      e=$(basename "$e")
      if [[ $e =~ ^([0-9]{3})- ]]; then
        n=$((10#${BASH_REMATCH[1]}))
        [ "$n" -gt "$max" ] && max=$n
      fi
    done
    [ "$instr" = 1 ] && prefix="지침-"
    dir="$WORK/$(printf '%03d' $((max + 1)))-$(date +%F)-$prefix$name"
    mkdir "$dir" || die "cannot create $dir"
    if [ "$instr" = 1 ]; then
      { echo "$base_line"; purpose_body; } > "$dir/01-main-purpose.md"
    else
      { echo "$base_line"; spec_body; } > "$dir/01-main-spec.md"
    fi
  fi
  rel "$dir"
}

cmd_next() {
  [ $# = 1 ] || { usage >&2; exit 2; }
  next_no "$(abs_dir "$1")"
  echo
}

# 01 파일에서 처음 나오는 "기준 커밋:" 줄을 읽어 BASE(공개)와 PBASE(비공개, 없으면 빈 값)를 정한다.
read_base() {
  local d=$1 f line
  f=$(ls "$d"/01-main-*.md 2>/dev/null | head -1)
  [ -n "$f" ] || die "no 01-main-*.md in $(rel "$d")"
  line=$(grep -m1 '기준 커밋:' "$f") || die "no '기준 커밋:' line in $(rel "$f")"
  BASE=$(echo "$line" | sed -nE 's/.*기준 커밋:[^0-9a-f]*([0-9a-f]{7,40}).*/\1/p')
  [ -n "$BASE" ] || die "cannot read base commit from: $line"
  git -C "$ROOT" rev-parse --verify -q "$BASE^{commit}" > /dev/null || die "base commit not found: $BASE"
  PBASE=$(echo "$line" | sed -nE 's/.*비공개 저장소 첫 변경 전 HEAD:[^0-9a-f]*([0-9a-f]{7,40}).*/\1/p')
}

# 추적하지 않는 새 파일을 diff에 나오게 한다(git add -N). $1 저장소, 나머지 경로.
add_intent() {
  local repo=$1 f
  shift
  [ $# -gt 0 ] || return 0
  while IFS= read -r -d '' f; do
    git -C "$repo" add -N -- "$f"
  done < <(git -C "$repo" ls-files -z --others --exclude-standard -- "$@")
}

cmd_diff() {
  [ $# -ge 1 ] || { usage >&2; exit 2; }
  local d guides=()
  d=$(abs_dir "$1")
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --guide) [ -n "${2:-}" ] || die "--guide needs a path"; guides+=("$2"); shift 2 ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  read_base "$d"

  local no head
  no=$(next_no "$d")
  head=$(git -C "$ROOT" rev-parse --short HEAD)

  if [[ $(basename "$d") =~ ^[0-9]{3}-[0-9]{4}-[0-9]{2}-[0-9]{2}-지침- ]]; then
    local pub=() priv=() g out
    for g in "${guides[@]}"; do
      case "$g" in private/*) priv+=("${g#private/}") ;; *) pub+=("$g") ;; esac
    done
    if [ ${#priv[@]} -gt 0 ]; then
      need_private
      [ -n "$PBASE" ] || die "private base commit ('비공개 저장소 첫 변경 전 HEAD:') not found in 01 file"
      git -C "$PRIV" rev-parse --verify -q "$PBASE^{commit}" > /dev/null || die "private base commit not found: $PBASE"
    fi
    add_intent "$ROOT" .claude "${pub[@]}"
    out="$d/$no-main-diff.txt"
    {
      echo "기준 커밋: $BASE / HEAD: $head / 명령: git diff $BASE -- .claude${pub[*]:+ ${pub[*]}} (커밋하지 않은 변경 포함, 새 파일은 git add -N 뒤)"
      git -C "$ROOT" diff "$BASE" -- .claude "${pub[@]}"
    } > "$out"
    if [ ${#priv[@]} -gt 0 ]; then
      add_intent "$PRIV" "${priv[@]}"
      {
        echo
        echo "비공개 저장소 기준 커밋: $PBASE / 명령: git -C private diff $PBASE -- ${priv[*]}"
        git -C "$PRIV" diff "$PBASE" -- "${priv[@]}"
      } >> "$out"
    fi
    rel "$out"
    return
  fi

  # 일반 작업. 테스트 커밋은 번호가 가장 큰 -runner-test 기록의 summary.txt 첫 줄에서 읽는다.
  local tdir tc=""
  tdir=$(ls -d "$d"/[0-9][0-9]-runner-test*/ 2>/dev/null | sort | tail -1)
  if [ -n "$tdir" ]; then
    [ -f "$tdir/summary.txt" ] || die "no summary.txt in $(rel "${tdir%/}")"
    tc=$(head -1 "$tdir/summary.txt" | grep -oE '[0-9a-f]{40}' | head -1)
    [ -n "$tc" ] || die "no commit in the first line of $(rel "$tdir")summary.txt"
  fi
  local all="$d/$no-main-diff-all.txt"
  {
    echo "기준 커밋: $BASE / HEAD: $head / 명령: git diff $BASE..HEAD"
    git -C "$ROOT" diff "$BASE..HEAD"
  } > "$all"
  rel "$all"
  if [ -n "$tc" ]; then
    local tests="$d/$no-main-diff-tests.txt" tshort
    tshort=$(git -C "$ROOT" rev-parse --short "$tc")
    {
      echo "테스트 커밋: $tshort / HEAD: $head / 명령: git diff $tshort..HEAD -- ${TEST_PATHS[*]}"
      git -C "$ROOT" diff "$tc..HEAD" -- "${TEST_PATHS[@]}"
    } > "$tests"
    rel "$tests"
  fi
}

# 폴더 한 줄 요약: 이름, 파일 수, 마지막 파일
folder_line() {
  local f=$1 indent=$2 count last
  count=$(ls -1 "$f" | wc -l | tr -d ' ')
  last=$(ls -1 "$f" | sort | tail -1)
  echo "$indent$(basename "$f")  (${count}개, 마지막: ${last:-없음})"
}

cmd_status() {
  local all=0
  case "${1:-}" in --all) all=1 ;; "") ;; *) die "unknown argument: $1" ;; esac
  need_private

  local folders=() f c
  while IFS= read -r f; do folders+=("$f"); done < <(ls -1d "$WORK"/[0-9][0-9][0-9]-*/ 2>/dev/null | sort)
  # ${a[@]: -5}는 원소가 5개보다 적으면 빈 값이 되므로 시작 위치를 계산한다.
  if [ "$all" != 1 ] && [ ${#folders[@]} -gt 5 ]; then folders=("${folders[@]:$((${#folders[@]} - 5))}"); fi
  echo "## 작업 폴더$([ "$all" = 1 ] && echo " (전부)" || echo " (최근 5개)")"
  for f in "${folders[@]}"; do
    f=${f%/}
    folder_line "$f" ""
    # 자식 폴더(두 자리 번호, runner 기록 폴더는 빼고)
    for c in "$f"/[0-9][0-9]-*/; do
      [ -d "$c" ] || continue
      c=${c%/}
      is_runner_name "$(basename "$c")" && continue
      folder_line "$c" "    "
    done
  done

  echo
  echo "## 비공개 저장소에 커밋하지 않은 작업 폴더 파일"
  local pending
  pending=$(git -C "$PRIV" -c core.quotepath=false status --short --untracked-files=all -- work/)
  if [ -n "$pending" ]; then echo "$pending" | sed 's/^/  /'; else echo "  없음"; fi

  echo
  echo "## push 안 된 커밋"
  local repo label
  for repo in "$ROOT" "$PRIV"; do
    if [ "$repo" = "$ROOT" ]; then label="공개 저장소"; else label="비공개 저장소"; fi
    if git -C "$repo" rev-parse --verify -q origin/main > /dev/null; then
      echo "  $label: $(git -C "$repo" rev-list --count origin/main..HEAD)개"
    else
      echo "  $label: 알 수 없음(origin/main 없음)"
    fi
  done
}

cmd=${1:-}
[ $# -gt 0 ] && shift
case "$cmd" in
  new) cmd_new "$@" ;;
  next) cmd_next "$@" ;;
  diff) cmd_diff "$@" ;;
  status) cmd_status "$@" ;;
  *) usage >&2; exit 2 ;;
esac
