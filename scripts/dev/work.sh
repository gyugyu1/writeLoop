#!/usr/bin/env bash
# 작업 폴더(private/work/) 도우미: 손으로 하던 폴더 만들기, 다음 번호, 변경분 만들기, 진행 상태 보기를 한다.
# 규칙은 .claude/skills/work-folder에 있다. 판단(끝났는지, 무엇을 고칠지)은 하지 않는다.
#
#   bash scripts/dev/work.sh new <이름> [--instr] [--parent <폴더>]
#   bash scripts/dev/work.sh next <폴더>
#   bash scripts/dev/work.sh diff <폴더> [--guide <경로>]... [--drop-guide <경로>]... [--no-guides] [--head <커밋>]
#   bash scripts/dev/work.sh status [--all]
#   bash scripts/dev/work.sh run <폴더> --name <이름> [--only <항목>[,<항목>...]] [--tests <패턴>]... [--db-tables <a,b>] [--db-api <파일>] [--llm-approved <요청 수>] [--llm-cases <파일>]...
#   bash scripts/dev/work.sh check <폴더>
#
# new     private/work/에 <다음 세 자리 순번>-<오늘 날짜>-<이름>/ 폴더와 01 뼈대를 만들고 경로를 출력한다.
#         01 첫 줄에 두 저장소의 지금 HEAD를 기준 커밋으로 적는다.
#         --instr  지침 변경 폴더(이름 앞에 "지침-", 01-main-purpose.md)
#         --parent 그 폴더 안에 <다음 두 자리 번호>-<이름>/ 자식 폴더를 만든다(첫 줄은 부모 경로).
# next    폴더의 다음 두 자리 번호를 출력한다.
# diff    01의 기준 커밋으로 변경분 파일을 다음 번호로 만든다.
#         일반 작업: NN-main-diff-all.txt(기준..끝 커밋). -runner-test 기록이 있으면 NN-main-diff-tests.txt(테스트 커밋..끝 커밋)도.
#                    끝 커밋은 --head, 없으면 구현 기록(-runner-test가 아닌 것)이 있을 때 번호가 가장 큰 runner 기록
#                    summary.txt의 커밋, 구현 기록이 아직 없으면 HEAD.
#         지침 작업: NN-main-diff.txt(기준 커밋부터 커밋하지 않은 변경까지, .claude와 안내 파일).
#                    둘째 줄에 안내 파일 목록, 그 아래 기준 커밋 뒤 커밋 목록을 적는다. 다음 diff는 앞 목록을 다시 쓰고
#                    --guide를 더하고 --drop-guide를 뺀다. 목록을 잃었을 수 있으면(검토 보고만 있음) --guide나 --no-guides가 필요하다.
#                    앞 목록이 남아 있으면 --no-guides는 거부한다(빼려면 --drop-guide). 공백이 든 --guide 경로는 거부한다.
#                    .claude와 안내 파일의 새 파일은 git add -N 한다. private/ 안의 안내 파일은 비공개 저장소 diff를 이어 붙인다.
# status  최근 작업 폴더 5개(--all이면 전부)의 파일 수와 마지막 파일, 커밋하지 않은 작업 폴더 파일, push 안 된 커밋 수.
# run     실행 기록 도구. 커밋하지 않은 변경이 있거나 다른 run이 돌고 있으면 거부한다. 기준 커밋부터 HEAD까지 바뀐 경로로
#         돌릴 항목을 고르고(--only면 그 항목만), 다음 번호의 NN-runner-<이름>/에 항목별 기록과 summary.txt를 남긴다.
#         Docker가 필요한 항목이 있으면 먼저 ensure-docker.sh로 켠다. LLM 회귀는 --llm-approved를 줄 때만 돌린다.
#         종료 코드: 모두 OK 0, FAIL이 있으면 1, FAIL 없이 NEEDS(돌리지 않은 필요 확인)가 있으면 3, 쓰임 잘못 2.
# check   기록 대조: qa 시나리오·겨냥 케이스가 첫 공개 커밋보다 먼저 한 번만 커밋됐는지, 겨냥 케이스 sha256이 보고·기록과
#         같은지, 실행 기록마다 커밋하지 않은 변경이 0인지, 가장 큰 실행 기록의 커밋이 가장 최근 변경분의 HEAD인지.
#         한 줄씩 OK/FAIL/NOTE를 출력하고 FAIL이 있으면 종료 코드 1.
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
usage() { sed -n '5,10p' "$0" | sed 's/^# *//'; }

need_private() {
  [ -d "$PRIV/.git" ] || die "private is not cloned: $PRIV (git clone https://github.com/gyugyu1/writeloop-private.git private)"
}

# 폴더 인자를 절대경로로 바꾼다. $(...) 안에서 부르면 die가 서브셸만 끝내므로 부른 쪽에서 || exit 2로 받는다.
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
  # 자식 폴더는 부모 작업의 일부라 지침 폴더로 따로 만들지 않는다. 함께 주면 한쪽이 조용히 무시되므로 막는다.
  [ "$instr" = 1 ] && [ -n "$parent" ] && die "--instr and --parent cannot be used together"
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
    pd=$(abs_dir "$parent") || exit 2
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
  local d
  d=$(abs_dir "$1") || exit 2
  next_no "$d"
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

is_instr() { [[ $(basename "$1") =~ ^[0-9]{3}-[0-9]{4}-[0-9]{2}-[0-9]{2}-지침- ]]; }

# 커밋 목록을 두 칸 들여 쓴다. 비면 "  없음".
indent_log() { if [ -n "$1" ]; then echo "$1" | sed 's/^/  /'; else echo "  없음"; fi; }

cmd_diff() {
  [ $# -ge 1 ] || { usage >&2; exit 2; }
  local d guides=() drops=() no_guides=0 endarg=""
  d=$(abs_dir "$1") || exit 2
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --guide) [ -n "${2:-}" ] || die "--guide needs a path"; guides+=("$2"); shift 2 ;;
      --drop-guide) [ -n "${2:-}" ] || die "--drop-guide needs a path"; drops+=("$2"); shift 2 ;;
      --no-guides) no_guides=1; shift ;;
      --head) [ -n "${2:-}" ] || die "--head needs a commit"; endarg=$2; shift 2 ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  read_base "$d"
  local no
  no=$(next_no "$d")
  if is_instr "$d"; then
    # 지침 변경분은 커밋하지 않은 변경까지 담으므로 끝 커밋이 없다.
    [ -z "$endarg" ] || die "--head is only for non-instruction folders"
    instr_diff "$d" "$no"
  else
    # 안내 파일은 지침 작업에만 쓴다(일반 작업의 변경분은 기준 커밋부터 끝 커밋까지 전부다).
    { [ ${#guides[@]} = 0 ] && [ ${#drops[@]} = 0 ] && [ "$no_guides" = 0 ]; } ||
      die "--guide, --drop-guide, --no-guides are only for instruction folders (지침-)"
    work_diff "$d" "$no"
  fi
}

# 지침 작업 변경분. 안내 파일 목록은 둘째 줄에 적고, 다음 diff 때 가장 최근 변경분의 둘째 줄에서 다시 읽는다.
# 변경분 파일은 커밋되지 않아 다른 컴퓨터에는 없다. 검토 보고는 있는데 읽을 목록이 없으면 목록을 잃었을 수 있으므로
# --guide를 다시 주거나 --no-guides로 없다고 밝혀야 만든다.
instr_diff() {
  local d=$1 no=$2 prev line g x keep found list=() pub=() priv=() out log
  [ "$no_guides" = 1 ] && [ ${#guides[@]} -gt 0 ] && die "--no-guides cannot be used with --guide"
  # 목록은 둘째 줄에 공백으로 나눠 적으므로, 공백이 든 경로는 다음 diff에서 쪼개진다.
  for g in "${guides[@]}"; do
    [[ $g =~ [[:space:]] ]] && die "--guide path must not contain spaces: $g"
  done
  prev=$(ls "$d"/[0-9][0-9]-main-diff.txt 2> /dev/null | sort | tail -1)
  line=""
  [ -n "$prev" ] && line=$(sed -n 2p "$prev")
  if [ "$no_guides" = 1 ]; then
    # --no-guides는 목록을 잃었을 때 안내 파일이 없다고 밝히는 용도다. 앞 목록이 남아 있으면 실수로 비우지 않게 막는다.
    [[ $line == "안내 파일: "* ]] && [ "$line" != "안내 파일: 없음" ] &&
      die "the previous diff has a guide list (${line#안내 파일: }). Use --drop-guide <path> to remove a guide; --no-guides is only for a lost list"
    list=()
  elif [[ $line == "안내 파일: "* ]]; then
    [ "$line" = "안내 파일: 없음" ] || read -r -a list <<< "${line#안내 파일: }"
  elif ls "$d"/*-instruction-reviewer-review.md > /dev/null 2>&1 && [ ${#guides[@]} = 0 ]; then
    die "the guide list may be lost (a review exists but no previous diff with '안내 파일:' on line 2). Give --guide <path>... again, or --no-guides"
  fi
  for g in "${guides[@]}"; do
    found=0
    for x in "${list[@]}"; do [ "$x" = "$g" ] && found=1; done
    [ "$found" = 1 ] || list+=("$g")
  done
  for g in "${drops[@]}"; do
    keep=() found=0
    for x in "${list[@]}"; do if [ "$x" = "$g" ]; then found=1; else keep+=("$x"); fi; done
    [ "$found" = 1 ] || die "--drop-guide path is not in the guide list: $g"
    list=("${keep[@]}")
  done
  for g in "${list[@]}"; do
    case "$g" in private/*) priv+=("${g#private/}") ;; *) pub+=("$g") ;; esac
  done
  if [ ${#priv[@]} -gt 0 ]; then
    need_private
    [ -n "$PBASE" ] || die "private base commit ('비공개 저장소 첫 변경 전 HEAD:') not found in 01 file"
    git -C "$PRIV" rev-parse --verify -q "$PBASE^{commit}" > /dev/null || die "private base commit not found: $PBASE"
  fi
  # 잘못 적은 경로는 git diff가 빈 결과로 조용히 넘어가므로, 작업 트리에도 기준 커밋에도 없으면 막는다.
  for g in "${pub[@]}"; do
    [ -e "$ROOT/$g" ] || git -C "$ROOT" cat-file -e "$BASE:$g" 2> /dev/null || die "--guide path not found: $g"
  done
  for g in "${priv[@]}"; do
    [ -e "$PRIV/$g" ] || git -C "$PRIV" cat-file -e "$PBASE:$g" 2> /dev/null || die "--guide path not found: private/$g"
  done

  add_intent "$ROOT" .claude "${pub[@]}"
  out="$d/$no-main-diff.txt"
  log=$(git -C "$ROOT" log --oneline "$BASE..HEAD" -- .claude "${pub[@]}")
  {
    echo "기준 커밋: $BASE / HEAD: $(git -C "$ROOT" rev-parse --short HEAD) / 명령: git diff $BASE -- .claude${pub[*]:+ ${pub[*]}} (커밋하지 않은 변경 포함, 새 파일은 git add -N 뒤)"
    if [ ${#list[@]} -gt 0 ]; then echo "안내 파일: ${list[*]}"; else echo "안내 파일: 없음"; fi
    echo "기준 커밋 뒤 커밋:"
    indent_log "$log"
    git -C "$ROOT" diff "$BASE" -- .claude "${pub[@]}"
  } > "$out"
  if [ ${#priv[@]} -gt 0 ]; then
    add_intent "$PRIV" "${priv[@]}"
    log=$(git -C "$PRIV" log --oneline "$PBASE..HEAD" -- "${priv[@]}")
    {
      echo
      echo "비공개 저장소 기준 커밋: $PBASE / 명령: git -C private diff $PBASE -- ${priv[*]}"
      echo "비공개 기준 커밋 뒤 커밋:"
      indent_log "$log"
      git -C "$PRIV" diff "$PBASE" -- "${priv[@]}"
    } >> "$out"
  fi
  rel "$out"
}

# runner 결과 폴더 summary.txt 첫 줄의 40자리 커밋
summary_commit() {
  local r=${1%/} c
  [ -f "$r/summary.txt" ] || die "no summary.txt in $(rel "$r")"
  c=$(head -1 "$r/summary.txt" | grep -oE '[0-9a-f]{40}' | head -1)
  [ -n "$c" ] || die "no commit in the first line of $(rel "$r")/summary.txt"
  git -C "$ROOT" cat-file -e "$c^{commit}" 2> /dev/null || die "commit in $(rel "$r")/summary.txt not found: $c"
  echo "$c"
}

# 일반 작업 변경분. 끝 커밋은 --head, 없으면 구현 기록이 있을 때 번호가 가장 큰 runner 기록의 커밋, 그 전에는 HEAD.
# 다른 작업의 커밋이 뒤에 쌓여도 변경분이 runner 기록과 같은 코드를 가리키게 하려는 것이다.
work_diff() {
  local d=$1 no=$2 end r rdir tdir tc="" impl=0 es all tests tshort
  if [ -n "$endarg" ]; then
    end=$(git -C "$ROOT" rev-parse --verify -q "$endarg^{commit}") || die "--head is not a commit: $endarg"
  else
    # 구현 기록(-runner-test가 아닌 기록)이 생긴 뒤에만 runner 기록에서 정한다. 그 뒤에 테스트를 더했으면
    # 그 테스트 기록이 가장 최근이므로 종류와 관계없이 번호가 가장 큰 기록을 쓴다.
    # 작업 폴더 이름이나 저장소 경로에 -runner-test가 들어 있을 수 있으므로 runner 폴더 이름만 본다.
    for r in "$d"/[0-9][0-9]-runner-*/; do
      [ -d "$r" ] || continue
      case $(basename "$r") in [0-9][0-9]-runner-test*) ;; *) impl=1 ;; esac
    done
    rdir=""
    [ "$impl" = 1 ] && rdir=$(ls -d "$d"/[0-9][0-9]-runner-*/ 2> /dev/null | sort | tail -1)
    if [ -n "$rdir" ]; then
      end=$(summary_commit "$rdir") || exit 2
    else
      end=$(git -C "$ROOT" rev-parse HEAD)
    fi
  fi
  es=$(git -C "$ROOT" rev-parse --short "$end")
  # 테스트 커밋은 번호가 가장 큰 -runner-test 기록의 summary.txt 첫 줄에서 읽는다.
  tdir=$(ls -d "$d"/[0-9][0-9]-runner-test*/ 2> /dev/null | sort | tail -1)
  if [ -n "$tdir" ]; then
    tc=$(summary_commit "$tdir") || exit 2
  fi
  all="$d/$no-main-diff-all.txt"
  {
    echo "기준 커밋: $BASE / HEAD: $es / 명령: git diff $BASE..$es"
    git -C "$ROOT" diff "$BASE..$end"
  } > "$all"
  rel "$all"
  if [ -n "$tc" ]; then
    tests="$d/$no-main-diff-tests.txt"
    tshort=$(git -C "$ROOT" rev-parse --short "$tc")
    {
      echo "테스트 커밋: $tshort / HEAD: $es / 명령: git diff $tshort..$es -- ${TEST_PATHS[*]}"
      git -C "$ROOT" diff "$tc..$end" -- "${TEST_PATHS[@]}"
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

# ---------------------------------------------------------------- run

# run이 고르는 항목. 이 순서로 돌린다.
RUN_ITEMS=(backend-test db-check rules-test script-tests web-build mobile-typecheck mobile-lint actionlint ops-syntax compose-config claude-config llm-smoke)
# Docker가 있어야 하는 항목
DOCKER_ITEMS=" backend-test db-check llm-smoke actionlint "

# 바뀐 경로 하나에 해당하는 항목(공백으로 나눔). 확인이 필요 없는 경로는 "-", nginx는 "nginx", 규칙이 없으면 빈 값.
# case의 *는 /도 맞추므로 하위 폴더까지 포함한다.
path_items() {
  case "$1" in
    docs/* | *.md | .claude/agents/* | .claude/skills/* | .claude/CLAUDE.md | private/*) echo - ;;
    apps/backend/src/main/resources/db/migration/* | apps/backend/src/main/resources/application*.yml) echo "backend-test db-check" ;;
    apps/backend/*) echo backend-test ;;
    scripts/feedback-quality/* | scripts/run-feedback-quality-check.mjs) echo rules-test ;;
    scripts/dev/*) echo script-tests ;;
    apps/frontend/* | package.json | package-lock.json) echo web-build ;;
    apps/mobile/*) echo "mobile-typecheck mobile-lint" ;;
    .github/workflows/*) echo actionlint ;;
    scripts/ops/*) echo ops-syntax ;;
    docker-compose*.yml) echo compose-config ;;
    .claude/hooks/* | .claude/settings.json) echo claude-config ;;
    infra/nginx/*) echo nginx ;;
    *) echo "" ;;
  esac
}

# 문장 피드백 LLM이 바뀌었을 수 있는 경로. LLM 회귀는 비용과 사용자 승인 때문에 경로로 돌리지 않고 NEEDS로만 알린다.
llm_path() {
  case "$1" in
    scripts/feedback-quality/cases.smoke.json) return 0 ;;
    apps/backend/*) case "${1##*/}" in *Feedback* | *Mission* | *Canonical*) return 0 ;; esac ;;
  esac
  return 1
}

# 잠금 폴더 경로($1 이름). mkdir이 원자적이라 둘이 함께 잡지 못한다. 저장소의 .git 안에 둔다.
lock_path() {
  local g
  g=$(git -C "$ROOT" rev-parse --git-common-dir 2> /dev/null) || die "not a git repository: $ROOT"
  case "$g" in /* | [A-Za-z]:*) ;; *) g="$ROOT/$g" ;; esac
  echo "$g/$1"
}

# 잠금을 잡는다. 다른 프로세스가 잡고 있으면 1. 잡은 프로세스가 이미 없으면(남은 잠금) 치우고 잡는다.
# pid 파일이 아직 없으면 방금 잡은 참일 수 있으므로 잡혀 있는 것으로 본다.
acquire_lock() {
  local l=$1 pid
  if mkdir "$l" 2> /dev/null; then echo $$ > "$l/pid"; return 0; fi
  pid=$(cat "$l/pid" 2> /dev/null)
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2> /dev/null && return 1
  rm -rf "$l"
  mkdir "$l" 2> /dev/null || return 1
  echo $$ > "$l/pid"
}

# 경로 인자를 절대경로로(저장소 루트 기준). 파일이 없으면 멈춘다.
abs_file() {
  local f=$1
  case "$f" in /* | [A-Za-z]:*) ;; *) f="$ROOT/$f" ;; esac
  [ -f "$f" ] || die "file not found: $1"
  echo "$f"
}

# 항목 하나를 돌려 기록 파일($2)에 남긴다. 첫 줄은 명령, HEAD, 커밋하지 않은 변경 수.
run_item() {
  local it=$1 f=$2 rc=0 t npm=npm
  # Windows에서는 npm.cmd(Git Bash에서도 종료 코드가 제대로 나온다)
  [ -n "${WINDIR:-}" ] && npm=npm.cmd
  hdr() { echo "# $1 | HEAD $RUN_HEAD | uncommitted $RUN_DIRTY" > "$f"; }
  case "$it" in
    backend-test)
      # Git Bash에서 gradlew.bat은 실패해도 종료 코드 0이라 ./gradlew를 쓴다. --rerun이 없으면 앞 결과가 남아 있을 때
      # Gradle이 테스트를 돌리지 않는다(UP-TO-DATE).
      hdr "cd apps/backend && bash ./gradlew test --no-daemon --rerun${RUN_TESTS[*]:+ ${RUN_TESTS[*]}}"
      (cd "$ROOT/apps/backend" && bash ./gradlew test --no-daemon --rerun "${RUN_TESTS[@]}") >> "$f" 2>&1 || rc=1
      ;;
    db-check)
      hdr "bash scripts/dev/check-db-migrations.sh --out <기록 폴더>/db${RUN_DB_ARGS[*]:+ ${RUN_DB_ARGS[*]}}"
      (cd "$ROOT" && bash scripts/dev/check-db-migrations.sh --out "$RUN_DIR/db" "${RUN_DB_ARGS[@]}") >> "$f" 2>&1 || rc=1
      ;;
    rules-test)
      hdr "node --test scripts/feedback-quality/rules.test.mjs"
      (cd "$ROOT" && node --test scripts/feedback-quality/rules.test.mjs) >> "$f" 2>&1 || rc=1
      ;;
    script-tests)
      hdr "bash scripts/dev/tests/*.test.sh (하나씩)"
      for t in "$ROOT"/scripts/dev/tests/*.test.sh; do
        [ -f "$t" ] || continue
        echo "## bash ${t#"$ROOT"/}" >> "$f"
        (cd "$ROOT" && bash "$t") >> "$f" 2>&1 || { rc=1; echo "## FAIL ${t#"$ROOT"/}" >> "$f"; }
      done
      ;;
    web-build)
      hdr "$npm run build --workspace @english-learning/frontend"
      (cd "$ROOT" && $npm run build --workspace @english-learning/frontend) >> "$f" 2>&1 || rc=1
      ;;
    mobile-typecheck)
      hdr "cd apps/mobile && $npm run typecheck"
      (cd "$ROOT/apps/mobile" && $npm run typecheck) >> "$f" 2>&1 || rc=1
      ;;
    mobile-lint)
      hdr "cd apps/mobile && $npm run lint"
      (cd "$ROOT/apps/mobile" && $npm run lint) >> "$f" 2>&1 || rc=1
      ;;
    actionlint)
      hdr "docker run --rm -v <저장소>:/repo -w /repo rhysd/actionlint:1.7.7 -no-color"
      (cd "$ROOT" && MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2> /dev/null || pwd)":/repo -w /repo rhysd/actionlint:1.7.7 -no-color) >> "$f" 2>&1 || rc=1
      ;;
    ops-syntax)
      hdr "bash -n scripts/ops/*.sh"
      for t in "$ROOT"/scripts/ops/*.sh; do
        [ -f "$t" ] || continue
        bash -n "$t" >> "$f" 2>&1 || { rc=1; echo "FAIL ${t#"$ROOT"/}" >> "$f"; }
      done
      ;;
    compose-config)
      hdr "docker compose config -q"
      (cd "$ROOT" && docker compose config -q) >> "$f" 2>&1 || rc=1
      ;;
    claude-config)
      # ast.parse는 캐시 파일을 남기지 않는다.
      hdr "python ast.parse(.claude/hooks/*.py) && node JSON.parse(.claude/settings.json)"
      (cd "$ROOT" && python -c "import ast, sys; [ast.parse(open(p, encoding='utf-8').read(), p) for p in sys.argv[1:]]" .claude/hooks/*.py &&
        node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8'))") >> "$f" 2>&1 || rc=1
      ;;
    llm-smoke)
      hdr "bash scripts/dev/run-llm-smoke.sh --out <기록 폴더>/llm --expect-requests $RUN_APPROVED${RUN_LLM_ARGS[*]:+ ${RUN_LLM_ARGS[*]}}"
      (cd "$ROOT" && bash scripts/dev/run-llm-smoke.sh --out "$RUN_DIR/llm" --expect-requests "$RUN_APPROVED" "${RUN_LLM_ARGS[@]}") >> "$f" 2>&1 || rc=1
      ;;
  esac
  return $rc
}

cmd_run() {
  [ $# -ge 1 ] || { usage >&2; exit 2; }
  local d name="" only="" tables="" api="" t it p its x
  RUN_TESTS=() RUN_DB_ARGS=() RUN_LLM_ARGS=() RUN_APPROVED=""
  d=$(abs_dir "$1") || exit 2
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --name | --only | --tests | --db-tables | --db-api | --llm-approved | --llm-cases)
        [ -n "${2:-}" ] || die "$1 needs a value"
        case "$1" in
          --name) name=$2 ;;
          --only) only=$2 ;;
          --tests) RUN_TESTS+=(--tests "$2") ;;
          --db-tables) tables=$2 ;;
          --db-api) api=$(abs_file "$2") || exit 2 ;;
          --llm-approved) RUN_APPROVED=$2 ;;
          --llm-cases) x=$(abs_file "$2") || exit 2; RUN_LLM_ARGS+=(--cases "$x") ;;
        esac
        shift 2
        ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  [ -n "$name" ] || die "--name is required (NN-runner-<name>/)"
  [[ $name =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "--name must use lowercase letters, digits and -: $name"
  if [ -n "$RUN_APPROVED" ]; then
    [[ $RUN_APPROVED =~ ^[1-9][0-9]*$ ]] || die "--llm-approved needs a positive number of requests: $RUN_APPROVED"
  else
    [ ${#RUN_LLM_ARGS[@]} = 0 ] || die "--llm-cases needs --llm-approved"
  fi
  read_base "$d"
  [ -z "$(git -C "$ROOT" status --short)" ] || die "uncommitted changes in the repository; commit them before run"

  RUN_LOCK=$(lock_path work-run.lock) || exit 2
  acquire_lock "$RUN_LOCK" || die "another work.sh run is running (pid $(cat "$RUN_LOCK/pid" 2> /dev/null), lock $RUN_LOCK)"
  # 끝나면(멈춰도) 이 프로세스가 잡은 잠금만 푼다.
  trap '[ "$(cat "$RUN_LOCK/pid" 2> /dev/null)" = "$$" ] && rm -rf "$RUN_LOCK"' EXIT

  # 항목 고르기
  local selected=" " needs=() notes=() llm_files=() nginx=0
  if [ -n "$only" ]; then
    for it in ${only//,/ }; do
      case " ${RUN_ITEMS[*]} " in *" $it "*) ;; *) die "unknown item in --only: $it (items: ${RUN_ITEMS[*]})" ;; esac
      [ "$it" = llm-smoke ] && [ -z "$RUN_APPROVED" ] && die "--only llm-smoke needs --llm-approved"
      selected+="$it "
    done
  else
    while IFS= read -r p; do
      [ -n "$p" ] || continue
      its=$(path_items "$p")
      case "$its" in
        -) ;;
        nginx) nginx=1 ;;
        "") notes+=("NOTE unmatched $p") ;;
        *) for it in $its; do case "$selected" in *" $it "*) ;; *) selected+="$it " ;; esac; done ;;
      esac
      llm_path "$p" && llm_files+=("$p")
    done < <(git -C "$ROOT" -c core.quotepath=false diff --name-only "$BASE..HEAD")
    [ "$nginx" = 1 ] && needs+=("NEEDS nginx-syntax infra/nginx changed; nginx -t is not run automatically")
    [ -z "$RUN_APPROVED" ] && [ ${#llm_files[@]} -gt 0 ] &&
      needs+=("NEEDS llm-smoke sentence feedback LLM may have changed (${llm_files[*]}); run with --llm-approved <requests> after user approval")
  fi
  if [ -n "$RUN_APPROVED" ]; then
    case "$selected" in *" llm-smoke "*) ;; *) selected+="llm-smoke " ;; esac
  fi
  if [ ${#RUN_TESTS[@]} -gt 0 ]; then
    case "$selected" in *" backend-test "*) ;; *) die "--tests needs backend-test to be run" ;; esac
  fi
  if [ -n "$tables" ] || [ -n "$api" ]; then
    case "$selected" in *" db-check "*) ;; *) die "--db-tables and --db-api need db-check to be run" ;; esac
    [ -n "$tables" ] && RUN_DB_ARGS+=(--tables "$tables")
    [ -n "$api" ] && RUN_DB_ARGS+=(--api "$api")
  fi

  # 기록 폴더
  RUN_DIR="$d/$(next_no "$d")-runner-$name"
  mkdir "$RUN_DIR" || die "cannot create $RUN_DIR"
  RUN_HEAD=$(git -C "$ROOT" rev-parse HEAD)
  RUN_DIRTY=$(git -C "$ROOT" status --short | wc -l | tr -d ' ')
  local summary="$RUN_DIR/summary.txt" failed=0 docker_ok=1 need_docker=0 msg
  echo "HEAD $RUN_HEAD | uncommitted $RUN_DIRTY" > "$summary"

  for it in $selected; do case "$DOCKER_ITEMS" in *" $it "*) need_docker=1 ;; esac; done
  if [ "$need_docker" = 1 ]; then
    if msg=$(bash "$ROOT/scripts/dev/ensure-docker.sh" 2>&1); then
      echo "OK $msg" >> "$summary"
    else
      echo "FAIL $msg" >> "$summary"
      docker_ok=0 failed=1
    fi
  fi

  for it in "${RUN_ITEMS[@]}"; do
    case "$selected" in *" $it "*) ;; *) continue ;; esac
    if [ "$docker_ok" = 0 ] && [[ $DOCKER_ITEMS == *" $it "* ]]; then
      echo "FAIL $it not run: docker is not available" >> "$summary"
      continue
    fi
    echo "running $it ..."
    if run_item "$it" "$RUN_DIR/$it.txt"; then
      echo "OK $it $it.txt" >> "$summary"
    else
      echo "FAIL $it $it.txt" >> "$summary"
      failed=1
    fi
  done
  for x in "${needs[@]}" "${notes[@]}"; do echo "$x" >> "$summary"; done

  rel "$RUN_DIR"
  cat "$summary"
  [ "$failed" = 1 ] && exit 1
  [ ${#needs[@]} -gt 0 ] && exit 3
  exit 0
}

# ---------------------------------------------------------------- check

cmd_check() {
  [ $# = 1 ] || { usage >&2; exit 2; }
  local d f rp lines n pc pts piso fc fts fiso cur name s rec rn line rdir diff rcommit dhead failed=0 first
  d=$(abs_dir "$1") || exit 2
  need_private
  read_base "$d"
  say() { echo "$*"; [ "$1" = FAIL ] && failed=1; return 0; }

  # qa의 1단계 결과는 구현보다 먼저 한 번만 커밋돼야 한다. 구현 커밋은 기준 커밋 뒤 커밋 중 확인이 필요 없는
  # 경로(문서·지침)만 바꾼 커밋을 뺀 첫 커밋이다(034 결정 M: 그 사이에 지침 커밋이 끼어도 잘못 FAIL하지 않게).
  local c cts ciso p docs_only
  first=""
  while read -r c cts ciso; do
    [ -n "$c" ] || continue
    docs_only=1
    while IFS= read -r p; do
      [ -n "$p" ] || continue
      [ "$(path_items "$p")" = - ] || { docs_only=0; break; }
    done < <(git -C "$ROOT" -c core.quotepath=false diff-tree --no-commit-id --name-only -r "$c")
    if [ "$docs_only" = 0 ]; then first="$c $cts $ciso"; break; fi
  done < <(git -C "$ROOT" log --reverse --format='%H %ct %cI' "$BASE..HEAD")
  for f in "$d"/[0-9][0-9]-qa-scenarios.md "$d"/[0-9][0-9]-qa-cases-target.json; do
    [ -f "$f" ] || continue
    rp=${f#"$PRIV"/}
    lines=$(git -C "$PRIV" log --format='%H %ct %cI' -- "$rp")
    n=$(printf '%s' "$lines" | grep -c .)
    if [ "$n" = 0 ]; then
      say FAIL "$(basename "$f"): not committed in private"
      continue
    fi
    if [ "$n" -gt 1 ]; then
      say FAIL "$(basename "$f"): changed after its first commit ($n commits)"
      continue
    fi
    read -r pc pts piso <<< "$lines"
    if [ -z "$first" ]; then
      say OK "$(basename "$f"): committed ${pc:0:7} $piso; no implementation commit after the base yet"
      continue
    fi
    read -r fc fts fiso <<< "$first"
    if [ "$pts" -lt "$fts" ]; then
      say OK "$(basename "$f"): committed ${pc:0:7} $piso, before the first implementation commit ${fc:0:7} $fiso"
    else
      say FAIL "$(basename "$f"): committed ${pc:0:7} $piso, not before the first implementation commit ${fc:0:7} $fiso"
    fi
  done

  # 겨냥 케이스 sha256: 지금 파일 = 1단계 보고에 적은 값 = 실행 기록에 남은 값
  for f in "$d"/[0-9][0-9]-qa-cases-target.json; do
    [ -f "$f" ] || continue
    cur=$(sha256sum "$f" | cut -d' ' -f1)
    if cat "$d"/[0-9][0-9]-qa-scenarios.md "$d"/[0-9][0-9]-qa-tests.md 2> /dev/null | grep -q "$cur"; then
      say OK "$(basename "$f"): sha256 $cur is in the phase-1 report"
    else
      say FAIL "$(basename "$f"): sha256 $cur is not in -qa-scenarios.md or -qa-tests.md"
    fi
    name=$(basename "$f" .json)
    local seen=0
    for s in "$d"/[0-9][0-9]-runner-*/llm/summary.txt; do
      [ -f "$s" ] || continue
      rec=$(grep -F "cases valid ($name)" "$s" | grep -oE '[0-9a-f]{64}' | head -1)
      [ -n "$rec" ] || continue
      seen=1
      rn=$(basename "$(dirname "$(dirname "$s")")")
      if [ "$rec" = "$cur" ]; then
        say OK "$(basename "$f"): $rn ran the same file"
      else
        say FAIL "$(basename "$f"): $rn ran sha256 $rec, the file is now $cur"
      fi
    done
    [ "$seen" = 1 ] || say NOTE "$(basename "$f"): no LLM run record yet"
  done

  # 실행 기록마다 커밋하지 않은 변경 수(첫 줄의 마지막 숫자)가 0
  for rdir in "$d"/[0-9][0-9]-runner-*/; do
    [ -d "$rdir" ] || continue
    rn=$(basename "$rdir")
    s="$rdir/summary.txt"
    if [ ! -f "$s" ]; then
      say NOTE "$rn: no summary.txt"
      continue
    fi
    line=$(head -1 "$s" | tr -d '\r')
    n=$(echo "$line" | sed -nE 's/.*[^0-9a-f]([0-9]+)[^0-9]*$/\1/p')
    if [ -z "$n" ]; then
      say NOTE "$rn: cannot read the uncommitted count from: $line"
    elif [ "$n" = 0 ]; then
      say OK "$rn: uncommitted 0"
    else
      say FAIL "$rn: uncommitted $n"
    fi
  done

  # 가장 큰 실행 기록의 커밋 = 가장 최근 전체 변경분의 HEAD
  rdir=$(ls -d "$d"/[0-9][0-9]-runner-*/ 2> /dev/null | sort | tail -1)
  diff=$(ls "$d"/[0-9][0-9]-main-diff-all.txt 2> /dev/null | sort | tail -1)
  if [ -n "$rdir" ] && [ -n "$diff" ]; then
    rcommit=$(head -1 "$rdir/summary.txt" 2> /dev/null | grep -oE '[0-9a-f]{40}' | head -1)
    dhead=$(head -1 "$diff" | sed -nE 's/.*HEAD: ([0-9a-f]+).*/\1/p')
    if [ -n "$rcommit" ] && [ -n "$dhead" ] && [ "${rcommit#"$dhead"}" != "$rcommit" ]; then
      say OK "$(basename "$rdir") commit ${rcommit:0:7} = HEAD of $(basename "$diff")"
    else
      say FAIL "$(basename "$rdir") commit ${rcommit:-?} != HEAD of $(basename "$diff") (${dhead:-?})"
    fi
  fi
  [ "$failed" = 1 ] && exit 1
  exit 0
}

cmd=${1:-}
[ $# -gt 0 ] && shift
case "$cmd" in
  new) cmd_new "$@" ;;
  next) cmd_next "$@" ;;
  diff) cmd_diff "$@" ;;
  status) cmd_status "$@" ;;
  run) cmd_run "$@" ;;
  check) cmd_check "$@" ;;
  *) usage >&2; exit 2 ;;
esac
