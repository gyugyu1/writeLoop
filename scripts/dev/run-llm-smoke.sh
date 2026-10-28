#!/usr/bin/env bash
# 문장 피드백 LLM 회귀(작은 세트): 임시 MySQL·Redis 컨테이너의 빈 DB로 백엔드를 띄우고,
# 회귀 케이스를 실제 OpenAI로 돌려 리포트와 피드백 원문을 파일로 남긴다.
# OpenAI 키는 이 스크립트가 저장소 루트 .env에서 꺼내 백엔드 프로세스에만 넘긴다. 값은 출력하거나 파일에 남기지 않는다.
# OpenAI를 실제로 호출하므로 비용이 든다. 돌리기 전에 사용자에게 예상 호출 수를 알리고 승인받는다.
#
#   bash scripts/dev/run-llm-smoke.sh --out <저장소 밖이나 git이 무시하는 결과 폴더> [--cases <케이스 파일>]... [--dry-run]
#
# --cases    기본 세트(scripts/feedback-quality/cases.smoke.json) 뒤에 더 돌릴 케이스 파일. 여러 번 줄 수 있다.
# --dry-run  케이스 형식과 예상 호출 수만 확인하고 OpenAI는 부르지 않는다.
# 결과 폴더의 summary.txt에 단계별 OK/FAIL이 있다. 하나라도 실패하면 종료 코드가 1이다.
# 컨테이너 이름과 포트가 고정이라 scripts/dev의 확인 스크립트는 한 번에 하나만 돌린다.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
INVOCATION="$0 $*"
OUT=""
DRY_RUN=""
CASES=("$ROOT/scripts/feedback-quality/cases.smoke.json")
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT=$2; shift 2 ;;
    --cases) CASES+=("$2"); shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$OUT" ] || { echo "--out is required" >&2; exit 2; }
seen=" "
for c in "${CASES[@]}"; do
  [ -f "$c" ] || { echo "cases file not found: $c" >&2; exit 2; }
  # 결과 파일 이름을 케이스 파일 이름으로 정하므로, 이름이 겹치면 결과가 섞인다.
  n=$(basename "$c" .json)
  case "$seen" in *" $n "*) echo "cases file name is used twice: $n" >&2; exit 2 ;; esac
  seen="$seen$n "
done

HEAD_SHA=$(git -C "$ROOT" rev-parse HEAD)
DIRTY=$(git -C "$ROOT" status --short | wc -l | tr -d ' ')
# shellcheck source=lib/local-backend.sh
. "$ROOT/scripts/dev/lib/local-backend.sh"
resolve_out_dir
SUMMARY="$OUT/summary.txt"
# 회귀 스크립트가 환경 변수로도 읽는 설정(반복 수, 점검 끄기 등)이 개발자 셸에서 섞이지 않게 한다.
for v in $(compgen -e | grep -E '^WRITELOOP_FEEDBACK_'); do unset "$v"; done

header "run-llm-smoke: $INVOCATION" > "$SUMMARY"

# 1) 케이스 형식과 예상 호출 수
for c in "${CASES[@]}"; do
  name=$(basename "$c" .json)
  f="$OUT/dry-run-$name.txt"
  header "dry run: node scripts/run-feedback-quality-check.mjs --cases $c --dry-run" > "$f"
  if (cd "$ROOT" && node scripts/run-feedback-quality-check.mjs --cases "$c" --dry-run) >> "$f" 2>&1; then
    # 케이스 파일이 나중에 바뀌었는지 대조할 수 있게 해시를 남긴다.
    result OK "cases valid ($name): $(grep -o '= [0-9]* execution' "$f" | grep -o '[0-9]*') request(s), sha256 $(sha256sum "$c" | cut -d' ' -f1)"
  else
    result FAIL "cases invalid ($name): see dry-run-$name.txt"
    exit 1
  fi
done
[ -n "$DRY_RUN" ] && exit $FAILED

# 2) 백엔드: 빈 DB(V107 기준 데이터에 질문 목록이 들어 있다)와 .env의 OpenAI 설정
if [ ! -f "$ROOT/.env" ] || ! grep -q '^OPENAI_API_KEY=.' "$ROOT/.env"; then
  result FAIL "OPENAI_API_KEY is missing in .env"
  exit 1
fi
trap cleanup EXIT
ensure_docker
check_ports_free
build_jar
start_containers
reset_db
# 첫 기동은 Flyway로 DB를 만드는 것뿐이라 OpenAI 설정 없이 띄운다.
if ! start_backend migrate; then
  exit 1
fi

# 케이스가 쓰는 질문 중 운영에서 비활성화된 것이 있다. 비활성 질문으로 피드백을 요청하면 백엔드가 다른 질문으로 바꿔
# 평가가 어긋나므로, 이 임시 DB에서만 케이스의 질문을 활성화하고 질문 목록 캐시가 비도록 백엔드를 다시 띄운다.
f="$OUT/activated-prompts.txt"
header "prompts activated in the temporary DB for the cases" > "$f"
# 질문 id는 SQL에 그대로 들어가므로 영문·숫자·-·_만 허용한다.
ids=$(cd "$ROOT" && node -e '
  const fs = require("fs");
  const ids = new Set();
  for (const file of process.argv.slice(1)) for (const c of JSON.parse(fs.readFileSync(file, "utf8"))) if (c.promptId) ids.add(c.promptId);
  for (const id of ids) if (!/^[A-Za-z0-9_-]+$/.test(id)) { console.error("invalid promptId: " + id); process.exit(1); }
  console.log([...ids].map(id => "'"'"'" + id + "'"'"'").join(","));
' "${CASES[@]}" 2>> "$f")
if [ -n "$ids" ] && sql "SELECT id FROM prompts WHERE is_active = 0 AND id IN ($ids); UPDATE prompts SET is_active = 1 WHERE id IN ($ids);" >> "$f" 2>&1; then
  result OK "case prompts active in the temporary DB (see activated-prompts.txt)"
else
  result FAIL "activate case prompts: see activated-prompts.txt"
  exit 1
fi
stop_backend || exit 1
if ! start_backend llm openai; then
  exit 1
fi

# 3) 회귀 실행
for c in "${CASES[@]}"; do
  name=$(basename "$c" .json)
  f="$OUT/regression-$name.txt"
  header "regression: node scripts/run-feedback-quality-check.mjs --cases $c --base-url http://127.0.0.1:$APP_PORT --concurrency 1 --include-pass-payloads" > "$f"
  if (cd "$ROOT" && node scripts/run-feedback-quality-check.mjs --cases "$c" --base-url "http://127.0.0.1:$APP_PORT" \
      --report-dir "$OUT/reports/$name" --concurrency 1 --include-pass-payloads) >> "$f" 2>&1; then
    result OK "regression ($name): $(grep -o 'passed: [0-9]*/[0-9]*' "$f" | tail -1)"
  elif grep -q "preflight failed\|validation failed" "$f"; then
    result FAIL "regression ($name): cases or prompts do not match, nothing was sent; see regression-$name.txt"
  else
    result FAIL "regression ($name): $(grep -o '[0-9]*/[0-9]* passed' "$f" | tail -1); see regression-$name.txt"
  fi
done

# 4) 피드백 원문. 리포트는 완성 화면 데이터를 줄여 저장하므로 DB의 진단 기록을 그대로 남긴다.
f="$OUT/feedback-diagnosis-logs.tsv"
header "SELECT * FROM feedback_diagnosis_logs ORDER BY id" > "$f"
if MSYS_NO_PATHCONV=1 docker exec "$DB" mysql -uroot -B writeloop -e "SELECT * FROM feedback_diagnosis_logs ORDER BY id" >> "$f" 2>&1; then
  result OK "feedback diagnosis logs saved: $(docker exec "$DB" mysql -uroot -N writeloop -e "SELECT COUNT(*) FROM feedback_diagnosis_logs" | tr -d '\r') row(s)"
else
  result FAIL "feedback diagnosis logs: see feedback-diagnosis-logs.tsv"
fi
# 실제로 쓴 모델과 추론 레벨(.env 값은 읽어 출력하지 않고, 백엔드가 남긴 기록에서 가져온다).
if models=$(docker exec "$DB" mysql -uroot -N writeloop -e "SELECT CONCAT(llm_model, ' / ', IFNULL(reasoning_effort, '-'), ' x', COUNT(*)) FROM feedback_diagnosis_logs GROUP BY llm_model, reasoning_effort" 2>&1); then
  result OK "models used: $(echo "$models" | tr -d '\r' | paste -sd ';' -)"
else
  result FAIL "models used: query failed: $models"
fi
stop_backend

exit $FAILED
