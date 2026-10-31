#!/usr/bin/env bash
# scripts/dev/deploy-needed.sh 테스트. 임시 폴더에 가짜 저장소를 만들어 경로별 판단을 확인한다.
#
#   bash scripts/dev/tests/deploy-needed.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
SCRIPT="$HERE/../deploy-needed.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false -C "$R" "$@"; }
R=$TMP/repo
mkdir -p "$R"
g init -q
echo base > "$R/base.txt"
g add -A && g commit -q -m base

# 파일들을 바꿔 커밋하고, 그 커밋 하나의 판단을 OUT·RC에 남긴다.
change() {
  local f before
  before=$(g rev-parse HEAD)
  for f in "$@"; do mkdir -p "$(dirname "$R/$f")"; echo "x$RANDOM" >> "$R/$f"; done
  g add -A && g commit -q -m change
  OUT=$(cd "$R" && bash "$SCRIPT" "$before" "$(g rev-parse HEAD)" 2>&1)
  RC=$?
}
first() { echo "$OUT" | head -1; }

change scripts/dev/a.sh scripts/dev/tests/b.test.sh
expect "scripts/dev만 바뀌면 deploy=false" "$([ "$RC" = 0 ] && [ "$(first)" = deploy=false ]; echo $?)" "$OUT"

change scripts/feedback-quality/rules.mjs scripts/run-feedback-quality-check.mjs apps/mobile/src/app/x.tsx docs/x.txt apps/backend/README.md .claude/skills/a/SKILL.md
expect "채점 규칙·모바일·문서·.md·.claude만 바뀌면 deploy=false" "$([ "$(first)" = deploy=false ]; echo $?)" "$OUT"

change scripts/dev/a.sh apps/backend/src/main/A.java
expect "백엔드가 하나라도 섞이면 deploy=true와 그 경로" \
  "$([ "$(first)" = deploy=true ] && echo "$OUT" | sed -n 2p | grep -qF apps/backend/src/main/A.java && ! echo "$OUT" | grep -qF scripts/dev/a.sh; echo $?)" "$OUT"

for f in apps/frontend/app/page.tsx package.json package-lock.json apps/backend/build.gradle.kts apps/backend/Dockerfile apps/frontend/Dockerfile docker-compose.yml infra/nginx/a.conf scripts/ops/deploy.sh .github/workflows/ci.yml apps/mobile-web/x.ts scripts/other.mjs; do
  change "$f"
  expect "$f가 바뀌면 deploy=true" "$([ "$(first)" = deploy=true ]; echo $?)" "$OUT"
done

before=$(g rev-parse HEAD)
g mv scripts/other.mjs scripts/dev/other.mjs && g commit -q -m mv
OUT=$(cd "$R" && bash "$SCRIPT" "$before" "$(g rev-parse HEAD)" 2>&1)
expect "배포 경로에서 scripts/dev로 옮기면 옛 경로 때문에 deploy=true" "$([ "$(first)" = deploy=true ]; echo $?)" "$OUT"

H=$(g rev-parse HEAD)
OUT=$(cd "$R" && bash "$SCRIPT" 0000000000000000000000000000000000000000 "$H" 2>&1)
expect "before가 0이면 deploy=true" "$([ "$(first)" = deploy=true ]; echo $?)" "$OUT"
OUT=$(cd "$R" && bash "$SCRIPT" "" "$H" 2>&1)
expect "before가 비었으면 deploy=true" "$([ "$(first)" = deploy=true ]; echo $?)" "$OUT"
OUT=$(cd "$R" && bash "$SCRIPT" 0123456789abcdef0123456789abcdef01234567 "$H" 2>&1)
expect "before 커밋이 없으면 deploy=true" "$([ "$(first)" = deploy=true ]; echo $?)" "$OUT"
OUT=$(cd "$R" && bash "$SCRIPT" "$H" "$H" 2>&1)
expect "바뀐 경로가 없으면 deploy=false" "$([ "$(first)" = deploy=false ]; echo $?)" "$OUT"
OUT=$(cd "$R" && bash "$SCRIPT" "$H" 2>&1)
RC=$?
expect "인자가 하나면 종료 코드 2" "$([ "$RC" = 2 ]; echo $?)" "$OUT"

# ---------------------------------------------------------------- last-deployed-sha.sh
# 가짜 gh: 배포 목록은 $FK/list(없으면 실패), 배포 상태는 $FK/status-<id>(없으면 실패)를 그대로 낸다(--jq 결과처럼).
LAST="$HERE/../last-deployed-sha.sh"
FK=$TMP/fake
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" << 'EOF'
#!/usr/bin/env bash
case "$2" in
  */statuses*) id=${2%/statuses*}; id=${id##*/}; f="$FK/status-$id" ;;
  *) f="$FK/list" ;;
esac
[ -f "$f" ] || exit 1
cat "$f"
EOF
chmod +x "$TMP/bin/gh"
A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
B=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
C=cccccccccccccccccccccccccccccccccccccccc
last() { OUT=$(FK=$FK PATH="$TMP/bin:$PATH" bash "$LAST" owner/repo 2>&1); RC=$?; }
reset_fake() { rm -rf "$FK"; mkdir -p "$FK"; }

reset_fake; printf '3 %s\n2 %s\n1 %s\n' "$C" "$B" "$A" > "$FK/list"
echo in_progress > "$FK/status-3"; echo failure > "$FK/status-2"; echo success > "$FK/status-1"
last
expect "last-deployed-sha: 진행 중·실패한 배포를 건너뛰고 가장 최근 success 배포의 커밋" "$([ "$RC" = 0 ] && [ "$OUT" = "$A" ]; echo $?)" "rc=$RC out=$OUT"

reset_fake; printf '2 %s\n1 %s\n' "$B" "$A" > "$FK/list"; echo inactive > "$FK/status-2"; : > "$FK/status-1"
last
expect "last-deployed-sha: success가 없으면(inactive, 상태 없음) 아무것도 내지 않고 종료 코드 0" "$([ "$RC" = 0 ] && [ -z "$OUT" ]; echo $?)" "rc=$RC out=$OUT"

reset_fake
last
expect "last-deployed-sha: 목록 조회가 실패하면 아무것도 내지 않고 종료 코드 0" "$([ "$RC" = 0 ] && [ -z "$OUT" ]; echo $?)" "rc=$RC out=$OUT"

reset_fake; printf '2 %s\n1 %s\n' "$B" "$A" > "$FK/list"; echo success > "$FK/status-1"
last
expect "last-deployed-sha: 상태 조회가 실패하면 더 예전 배포로 가지 않고 아무것도 내지 않는다" "$([ "$RC" = 0 ] && [ -z "$OUT" ]; echo $?)" "rc=$RC out=$OUT"

echo
echo "PASS $PASS FAIL $FAIL"
[ "$FAIL" = 0 ]
