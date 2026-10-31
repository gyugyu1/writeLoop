#!/usr/bin/env bash
# GitHub production 환경에서 마지막으로 배포에 성공한 커밋을 출력한다. CI의 배포 필요 판단이 비교 시작 커밋으로
# 쓴다(scripts/dev/deploy-needed.sh의 첫 인자). 직전 push가 배포됐다는 보장이 없어서 push 전 커밋을 쓰지 않는다.
#
#   GH_TOKEN=<토큰> bash scripts/dev/last-deployed-sha.sh <owner/repo>
#
# 가장 최근 배포부터 보면서, 가장 최근 상태가 success인 첫 배포의 커밋(40자)을 낸다. 찾지 못하거나 조회가 실패하면
# 아무것도 출력하지 않는다. 그러면 deploy-needed.sh가 범위를 알 수 없다고 보고 배포한다. CI 단계가 실패하지 않게
# 종료 코드는 늘 0이다. 배포 목록은 첫 쪽(30개)만 본다.
set -uo pipefail

repo=${1:-}
[ -n "$repo" ] || exit 0

list=$(gh api "repos/$repo/deployments?environment=production&per_page=30" --jq '.[] | "\(.id) \(.sha)"' 2> /dev/null) || exit 0
while read -r id sha; do
  [ -n "$id" ] || continue
  # 상태 목록은 최근 것부터 온다. 예전에 success였어도 가장 최근 상태가 다르면(inactive 등) 고르지 않는다.
  state=$(gh api "repos/$repo/deployments/$id/statuses?per_page=1" --jq '.[0].state // ""' 2> /dev/null) || exit 0
  if [ "$state" = success ]; then
    [[ $sha =~ ^[0-9a-f]{40}$ ]] && echo "$sha"
    exit 0
  fi
done <<< "$list"
exit 0
