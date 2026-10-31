#!/usr/bin/env bash
# main push가 운영 배포를 해야 하는지 정한다. CI(.github/workflows/ci.yml)가 이미지 빌드 전에 부른다.
# 운영 이미지에는 apps/backend와 package*.json·apps/frontend만 들어가므로, 개발 도구·채점 규칙·모바일·문서만 바뀐
# push는 배포하지 않는다. 범위를 알 수 없으면 배포한다(안전한 쪽).
#
#   bash scripts/dev/deploy-needed.sh <before> <after>
#
# 현재 폴더의 저장소에서 <before>부터 <after>까지 바뀐 경로를 본다(CI는 저장소 루트에서 부른다).
# CI는 <before>에 마지막으로 운영 배포에 성공한 커밋을 넘긴다. 찾지 못하면 빈 값을 넘겨 배포하게 한다.
# 출력: 첫 줄은 deploy=true 또는 deploy=false, 둘째 줄은 이유. 종료 코드: 판단했으면 0, 인자가 둘이 아니면 2.
set -uo pipefail

[ $# = 2 ] || { echo "usage: bash scripts/dev/deploy-needed.sh <before> <after>" >&2; exit 2; }
before=$1
after=$2

decide() { echo "deploy=$1"; echo "$2"; exit 0; }

# 배포와 무관한 경로. case의 *는 /도 맞추므로 하위 폴더와 어느 폴더의 .md든 맞춘다.
irrelevant() {
  case "$1" in
    docs/* | *.md | .claude/* | scripts/dev/* | scripts/feedback-quality/* | scripts/run-feedback-quality-check.mjs | apps/mobile/*) return 0 ;;
  esac
  return 1
}

# 비교 시작이 없으면(마지막 성공 배포를 찾지 못함, 새 브랜치의 0으로만 된 값) 범위를 알 수 없다.
[[ $before =~ ^0*$ ]] && decide true "no base commit to compare (got '${before}')"
for c in "$before" "$after"; do
  git cat-file -e "$c^{commit}" 2> /dev/null || decide true "commit $c not found in the repository (force push?)"
done

# --no-renames: 옮긴 파일은 옛 경로와 새 경로가 모두 나와, 앱에서 빼낸 파일도 배포로 친다.
paths=$(git -c core.quotepath=false diff --no-renames --name-only "$before" "$after") ||
  decide true "git diff $before $after failed"

needed=()
while IFS= read -r p; do
  [ -n "$p" ] || continue
  irrelevant "$p" || needed+=("$p")
done <<< "$paths"

[ -n "$paths" ] || decide false "no paths changed"
if [ ${#needed[@]} = 0 ]; then
  decide false "all changed paths are deploy-irrelevant (dev tools, feedback rules, mobile, docs)"
fi
shown="${needed[*]:0:5}"
[ ${#needed[@]} -gt 5 ] && shown="$shown (and $((${#needed[@]} - 5)) more)"
decide true "deploy-relevant paths changed: $shown"
