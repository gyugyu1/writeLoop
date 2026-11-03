#!/usr/bin/env bash
# [spec] run-llm-smoke.sh가 이어 쓴 답(followUps)이 있는 케이스의 요청 수를 1 + followUps 개수로 세는지(qa).
# 작업 055 ① 시나리오 S1~S5(02-qa-scenarios.md).
# 임시 폴더에 가짜 저장소(git init)를 만들고 지금 저장소의 scripts/dev(tests 빼고), run-feedback-quality-check.mjs,
# feedback-quality의 rules.mjs·report-writer.mjs·cases.smoke.json을 복사해 진짜 스크립트와 진짜 node로 돌린다.
# .env는 두지 않는다(실제 실행 단계에 가면 OPENAI_API_KEY가 없어 멈춘다).
# PATH 맨 앞에 호출만 기록하는 가짜 docker와, 받은 인자를 기록하고 진짜 node를 부르는 node를 둔다.
# 진짜 docker가 있는 PATH 폴더는 빼므로 진짜 Docker, 진짜 .env, OpenAI는 건드리지 않는다.
#
#   bash scripts/dev/tests/run-llm-smoke-followups.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
DEV=$(cd "$HERE/.." && pwd -P)
SRC=$(cd "$DEV/../.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }
expect() { if [ "$2" = 0 ]; then ok "$1"; else bad "$1" "${3:-}"; fi; }

g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false "$@"; }

REAL_NODE=$(command -v node) || { echo "FAIL setup: node not found"; exit 1; }
SAFE_PATH=""
IFS=: read -r -a PATH_DIRS <<< "$PATH"
for d in "${PATH_DIRS[@]}"; do
  [ -n "$d" ] || continue
  if [ -e "$d/docker" ] || [ -e "$d/docker.exe" ]; then continue; fi
  SAFE_PATH="${SAFE_PATH:+$SAFE_PATH:}$d"
done
if PATH="$SAFE_PATH" command -v docker > /dev/null 2>&1; then
  echo "FAIL setup: a real docker is still on the test PATH; refusing to run"
  exit 1
fi

# ---------------------------------------------------------------- 가짜 도구
BIN="$TMP/bin"
mkdir -p "$BIN"
cat > "$BIN/docker" << 'EOF'
#!/usr/bin/env bash
echo "args=$*" >> "$QA_LOG/docker.log"
exit 1
EOF
cat > "$BIN/node" << 'EOF'
#!/usr/bin/env bash
echo "node $*" >> "$QA_LOG/node.log"
exec "$QA_REAL_NODE" "$@"
EOF
chmod +x "$BIN/docker" "$BIN/node"

R="$TMP/repo"
mkdir -p "$R/scripts/dev" "$R/scripts/feedback-quality"
g -C "$R" init -q -b main
printf '/private/\n/.env\n' > "$R/.gitignore"
cp "$DEV"/*.sh "$R/scripts/dev/"
cp -r "$DEV/lib" "$R/scripts/dev/"
cp "$SRC/scripts/run-feedback-quality-check.mjs" "$R/scripts/"
cp "$SRC/scripts/feedback-quality/rules.mjs" "$SRC/scripts/feedback-quality/report-writer.mjs" \
  "$SRC/scripts/feedback-quality/cases.smoke.json" "$R/scripts/feedback-quality/"
g -C "$R" add -A && g -C "$R" commit -q -m base

# 더할 케이스 파일(임시 저장소 밖): followUps 없음, 2개, 3개 → 요청 1 + 3 + 4 = 8
CASES_DIR="$TMP/cases"
mkdir -p "$CASES_DIR"
FU="$CASES_DIR/cases.qa-followups.json"
cat > "$FU" << 'EOF'
[
  {
    "name": "qa followups none",
    "promptId": "prompt-spec-followup",
    "answer": "I like hiking.",
    "expectedMissionKinds": ["SLOT"]
  },
  {
    "name": "qa followups two",
    "promptId": "prompt-spec-followup",
    "answer": "I like reading.",
    "expectedMissionKinds": ["SLOT"],
    "followUps": [
      { "answer": "I like reading because it is fun.", "expectedMissionKinds": ["SLOT"], "expectedPreviousMissionStatus": "PARTIAL" },
      { "answer": "I like reading because it helps me relax at night.", "expectedMissionKinds": ["COMPLETE"], "expectedLoopComplete": true }
    ]
  },
  {
    "name": "qa followups three",
    "promptId": "prompt-spec-followup",
    "answer": "I like cooking.",
    "expectedMissionKinds": ["SLOT"],
    "followUps": [
      { "answer": "I like cooking because it is fun.", "expectedMissionKinds": ["SLOT"] },
      { "answer": "I like cooking because it makes my family happy.", "expectedMissionKinds": ["SLOT", "COMPLETE"] },
      { "answer": "I like cooking on weekends because it makes my family happy.", "expectedMissionKinds": ["COMPLETE"], "expectedPreviousMissionStatus": ["RESOLVED", "PARTIAL"] }
    ]
  }
]
EOF
PLAIN="$CASES_DIR/cases.qa-plain.json"
cat > "$PLAIN" << 'EOF'
[
  { "name": "qa plain 1", "promptId": "prompt-spec-followup", "answer": "I like hiking.", "expectedMissionKinds": ["SLOT"] },
  { "name": "qa plain 2", "promptId": "prompt-spec-followup", "answer": "I like reading.", "expectedMissionKinds": ["SLOT"] },
  { "name": "qa plain 3", "promptId": "prompt-spec-followup", "answer": "I like cooking.", "expectedMissionKinds": ["SLOT"] }
]
EOF
FU_SHA=$(sha256sum "$FU" | cut -d' ' -f1)

L=""
O=""
RC=""
N=0
newlog() { N=$((N + 1)); L="$TMP/log$N-$1"; mkdir -p "$L"; O="$TMP/out$N-$1"; }
run_smoke() {
  env QA_LOG="$L" QA_REAL_NODE="$REAL_NODE" PATH="$BIN:$SAFE_PATH" \
    timeout 300 bash "$R/scripts/dev/run-llm-smoke.sh" "$@" > "$L/run.txt" 2>&1
  RC=$?
}
show() { echo "rc=$RC summary=$(cat "$O/summary.txt" 2> /dev/null | tr '\n' '|') docker=$(cat "$L/docker.log" 2> /dev/null | tr '\n' '|') run=$(tail -4 "$L/run.txt" 2> /dev/null | tr '\n' '|')"; }
no_docker() { [ ! -s "$L/docker.log" ]; }
no_regression_run() { ! grep -q -- '--base-url' "$L/node.log" 2> /dev/null; }
has_line() { grep -qxF -- "$1" "$O/summary.txt" 2> /dev/null; }

# ================================================================ S1 --dry-run이 1 + followUps 개수를 센다
newlog s1
run_smoke --out "$O" --cases "$FU" --dry-run
SMOKE_SHA=$(sha256sum "$R/scripts/feedback-quality/cases.smoke.json" | cut -d' ' -f1)
expect "S1: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "S1: OK cases valid (cases.smoke): 6 request(s), sha256 <64자>" \
  "$(has_line "OK cases valid (cases.smoke): 6 request(s), sha256 $SMOKE_SHA" && [ ${#SMOKE_SHA} = 64 ]; echo $?)" "$(show)"
expect "S1: OK cases valid (cases.qa-followups): 8 request(s), sha256 <그 파일의 sha256sum>" \
  "$(has_line "OK cases valid (cases.qa-followups): 8 request(s), sha256 $FU_SHA"; echo $?)" "$(show)"
expect "S1: 가짜 docker 호출 0회" "$(no_docker; echo $?)" "$(show)"
expect "S1: --base-url이 든 회귀 실행 없음" "$(no_regression_run; echo $?)" "node=$(cat "$L/node.log" 2> /dev/null | tr '\n' '|')"
# 위 확인이 기록 없는 상태로 통과하지 않게, 기록용 node가 실제로 불렸는지(케이스 파일 2개의 dry-run) 본다.
expect "S1: (준비 확인) 기록용 node로 --dry-run이 2번 불림" \
  "$([ "$(grep -c -- '--dry-run' "$L/node.log" 2> /dev/null)" = 2 ]; echo $?)" "node=$(cat "$L/node.log" 2> /dev/null | tr '\n' '|')"

# ================================================================ S2 --expect-requests가 맞을 때(6 + 8)
newlog s2
run_smoke --out "$O" --cases "$FU" --expect-requests 14
expect "S2: summary에 OK requests: 14, as approved" "$(has_line "OK requests: 14, as approved"; echo $?)" "$(show)"
expect "S2: .env가 없어 FAIL OPENAI_API_KEY is missing in .env로 끝남(종료 1)" \
  "$(has_line "FAIL OPENAI_API_KEY is missing in .env" && [ "$RC" = 1 ]; echo $?)" "$(show)"
expect "S2: 가짜 docker 호출 0회" "$(no_docker; echo $?)" "$(show)"
expect "S2: --base-url이 든 회귀 실행 없음" "$(no_regression_run; echo $?)" "node=$(cat "$L/node.log" 2> /dev/null | tr '\n' '|')"

# ================================================================ S3 다를 때(케이스 수로 센 값 6 + 3)
newlog s3
run_smoke --out "$O" --cases "$FU" --expect-requests 9
expect "S3: 종료 코드 1" "$([ "$RC" = 1 ]; echo $?)" "$(show)"
expect "S3: FAIL requests: the cases have 14, but 9 were approved (--expect-requests); OpenAI was not called" \
  "$(has_line "FAIL requests: the cases have 14, but 9 were approved (--expect-requests); OpenAI was not called"; echo $?)" "$(show)"
expect "S3: OK requests 줄 없음" "$(! grep -q '^OK requests' "$O/summary.txt" 2> /dev/null; echo $?)" "$(show)"
expect "S3: 가짜 docker 호출 0회" "$(no_docker; echo $?)" "$(show)"
expect "S3: --base-url이 든 회귀 실행 없음" "$(no_regression_run; echo $?)" "node=$(cat "$L/node.log" 2> /dev/null | tr '\n' '|')"

# ================================================================ S4 followUps 없는 파일은 그대로 케이스 수
newlog s4
run_smoke --out "$O" --cases "$PLAIN" --dry-run
expect "S4: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "$(show)"
expect "S4: OK cases valid (cases.qa-plain): 3 request(s), 기본 세트는 6 request(s)" \
  "$(grep -qF 'OK cases valid (cases.qa-plain): 3 request(s), sha256 ' "$O/summary.txt" && grep -qF 'OK cases valid (cases.smoke): 6 request(s), sha256 ' "$O/summary.txt"; echo $?)" "$(show)"
expect "S4: 가짜 docker 호출 0회" "$(no_docker; echo $?)" "$(show)"

# ================================================================ S5 run-feedback-quality-check.mjs --dry-run을 직접
newlog s5
(cd "$R" && env -u WRITELOOP_FEEDBACK_API_BASE_URL "$REAL_NODE" scripts/run-feedback-quality-check.mjs --cases "$FU" --dry-run) > "$L/run.txt" 2>&1
RC=$?
expect "S5: 종료 코드 0" "$([ "$RC" = 0 ]; echo $?)" "rc=$RC $(cat "$L/run.txt" | tr '\n' '|')"
expect "S5: 출력에 요청 수 8" "$(grep -q '\b8 request(s)' "$L/run.txt"; echo $?)" "$(cat "$L/run.txt" | tr '\n' '|')"

echo
echo "passed $PASS, failed $FAIL"
[ "$FAIL" = 0 ]
