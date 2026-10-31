#!/usr/bin/env bash
# [spec] 배포 필요 판단 테스트(qa). 작업 036 시나리오(02-qa-scenarios.md, 04-qa-scenarios.md)를 옮겼다.
#   1부  scripts/dev/deploy-needed.sh: N1~N12, E1~E3, Y1~Y12, U1~U9, A1~A4(02의 1~5절, 04에서 그대로)
#   2부  scripts/dev/last-deployed-sha.sh(시작 커밋 고르기): Q1~Q5, Q10(04의 Q절)
#   3부  ci.yml "배포 필요 판단" job의 판단 단계(run 블록)를 꺼내 실행: Q1·Q6~Q9·Q11의 결과(배포 필요/불필요),
#        CI4(github.event.before를 쓰지 않음), CI5·CI6(찾지 못하거나 조회 실패면 배포, 단계가 실패하지 않음),
#        CI7(출력과 실행 요약의 이유), CI8(스크립트 실패·빈 출력·다른 글이면 배포)
# 04의 6절 나머지(CI1~CI3의 job 조건·checkout·환경 이름, CI9~CI15)와 7·8절은 4단계에서 읽어서 확인한다.
#
# 임시 폴더에 가짜 저장소를 만들고 지금 저장소의 두 스크립트를 복사해 그 루트에서 부른다. 가짜 저장소는 CI 우분투의
# git 기본값처럼 core.quotepath true, 그리고 diff.renames true로 둔다.
# GitHub API는 PATH 맨 앞의 가짜 gh(node)가 고정된 배포 기록으로 답한다. 진짜 gh가 있는 PATH 폴더는 빼고, 그래도
# 진짜 gh가 보이면 돌리지 않는다. 가짜 gh는 GET만 받고, --jq는 jq의 일부(파이프, .a, .[n], .[], //, 문자열
# 끼워 넣기, select 등)를 직접 계산한다. 계산하지 못하는 식이 오면 그 테스트를 실패로 적고 이유를 보인다.
# 진짜 저장소, private/, 네트워크, Docker는 건드리지 않는다.
#
#   bash scripts/dev/tests/deploy-needed.spec.test.sh
#
# 하나라도 실패하면 종료 코드가 1이다.
set -u

HERE=$(cd "$(dirname "$0")" && pwd -P)
DEV=$(cd "$HERE/.." && pwd -P)
ROOT=$(cd "$DEV/../.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; [ -n "${2:-}" ] && printf '     %s\n' "$2"; }

mkdir -p "$TMP/nohooks"
g() { git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false -c core.autocrlf=false -c core.hooksPath="$TMP/nohooks" "$@"; }
winpath() { cygpath -w "$1" 2> /dev/null || printf '%s\n' "$1"; }

for f in deploy-needed.sh last-deployed-sha.sh; do
  [ -f "$DEV/$f" ] || { echo "FAIL setup: scripts/dev/$f not found"; exit 1; }
done
REAL_NODE=$(command -v node) || { echo "FAIL setup: node not found"; exit 1; }

new_repo() {
  mkdir -p "$1"
  g -C "$1" init -q -b main
  g -C "$1" config core.quotepath true
  g -C "$1" config diff.renames true
  g -C "$1" config core.autocrlf false
}
# 여러 줄 내용(옮긴 파일이 옮긴 것으로 인식될 만큼)
body() { local i; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do echo "line $i of $1"; done; }

# ================================================================ 1부: deploy-needed.sh
R="$TMP/repo"
new_repo "$R"
B_FILES=(apps/backend/src/main/java/A.java apps/frontend/app/page.tsx apps/mobile/src/a.tsx apps/mobile/package.json
  package.json package-lock.json docker-compose.yml infra/nginx/a.conf scripts/ops/deploy.sh .github/workflows/ci.yml
  scripts/dev/work.sh scripts/feedback-quality/rules.mjs scripts/run-feedback-quality-check.mjs docs/a.txt README.md
  .claude/settings.json)
for f in "${B_FILES[@]}"; do mkdir -p "$(dirname "$R/$f")"; body "$f" > "$R/$f"; done
printf '/private/\n' > "$R/.gitignore"
cp "$DEV/deploy-needed.sh" "$R/scripts/dev/deploy-needed.sh"
g -C "$R" add -A
g -C "$R" commit -q -m base
B=$(g -C "$R" rev-parse HEAD)

reset_b() { g -C "$R" checkout -q -f --detach "$B" && g -C "$R" clean -qfdx; }
# 파일을 더하거나 고친다(없으면 만든다).
edit() { mkdir -p "$(dirname "$R/$1")"; echo "changed $1" >> "$R/$1"; }
commit() { g -C "$R" add -A && g -C "$R" commit -q -m "$1" && C=$(g -C "$R" rev-parse HEAD); }
# B에서 경로들을 고친 커밋 하나를 만든다(C).
change_from_b() { local p; reset_b; for p in "$@"; do edit "$p"; done; commit change; }

# 판단 스크립트를 부른다: RC, L(표준 출력의 줄)
run_dn() {
  (cd "$R" && bash scripts/dev/deploy-needed.sh "$@") > "$TMP/out" 2> "$TMP/err"
  RC=$?
  mapfile -t L < "$TMP/out"
}
# 판단 시나리오 공통 확인과 둘째 줄 확인. 인자: 이름, 기대(true/false), [has:<문자열>] [lacks:<문자열>]...
judge() {
  local name=$1 want=$2 a why=""
  shift 2
  [ "$RC" = 0 ] || why+=" exit=$RC"
  [ "${#L[@]}" = 2 ] || why+=" stdout-lines=${#L[@]}"
  [ "${L[0]:-}" = "deploy=$want" ] || why+=" line1='${L[0]:-}'"
  [ -n "${L[1]:-}" ] || why+=" line2-empty"
  for a in "$@"; do
    case "$a" in
      has:*) [[ "${L[1]:-}" == *"${a#has:}"* ]] || why+=" line2-missing '${a#has:}'" ;;
      lacks:*) [[ "${L[1]:-}" != *"${a#lacks:}"* ]] || why+=" line2-contains '${a#lacks:}'" ;;
    esac
  done
  if [ -z "$why" ]; then
    ok "$name"
  else
    bad "$name" "expected deploy=$want:${why} | stdout: $(tr '\n' '|' < "$TMP/out") | stderr: $(head -c 300 "$TMP/err" | tr '\n' '|')"
  fi
}

# ---------------------------------------------------------------- 1절: 모두 배포와 무관 → false
for p in docs/a.txt docs/guides/b.txt docs/img/c.png; do
  change_from_b "$p"; run_dn "$B" "$C"; judge "N1 docs/ 아래: $p" false
done
for p in README.md apps/backend/README.md apps/backend/src/main/resources/notes.md infra/nginx/README.md .github/workflows/README.md; do
  change_from_b "$p"; run_dn "$B" "$C"; judge "N2 .md(어느 폴더든): $p" false
done
for p in .claude/settings.json .claude/hooks/guard.py .claude/skills/a/SKILL.md; do
  change_from_b "$p"; run_dn "$B" "$C"; judge "N3 .claude/ 아래: $p" false
done
for p in scripts/dev/work.sh scripts/dev/deploy-needed.sh scripts/dev/tests/x.spec.test.sh scripts/dev/lib/a.sh; do
  reset_b
  if [ "$p" = scripts/dev/deploy-needed.sh ]; then echo "# qa comment" >> "$R/$p"; else edit "$p"; fi
  commit change; run_dn "$B" "$C"; judge "N4 scripts/dev/ 아래: $p" false
done
N5=(scripts/feedback-quality/rules.mjs scripts/feedback-quality/cases.smoke.json scripts/feedback-quality/reports/smoke/latest.json scripts/run-feedback-quality-check.mjs)
for p in "${N5[@]}"; do
  change_from_b "$p"; run_dn "$B" "$C"; judge "N5 채점 규칙: $p" false
done
for p in apps/mobile/src/a.tsx apps/mobile/package.json apps/mobile/app.json; do
  change_from_b "$p"; run_dn "$B" "$C"; judge "N6 apps/mobile/ 아래: $p" false
done
reset_b
for p in docs/a.txt docs/guides/b.txt docs/img/c.png README.md apps/backend/README.md apps/backend/src/main/resources/notes.md \
  infra/nginx/README.md .github/workflows/README.md .claude/settings.json .claude/hooks/guard.py .claude/skills/a/SKILL.md \
  scripts/dev/work.sh scripts/dev/tests/x.spec.test.sh scripts/dev/lib/a.sh "${N5[@]}" apps/mobile/src/a.tsx \
  apps/mobile/package.json apps/mobile/app.json; do
  edit "$p"
done
echo "# qa comment" >> "$R/scripts/dev/deploy-needed.sh"
commit all; run_dn "$B" "$C"; judge "N7 N1~N6 경로를 한 커밋에" false

reset_b; g -C "$R" rm -q apps/mobile/src/a.tsx scripts/dev/work.sh; commit del
run_dn "$B" "$C"; judge "N8 목록 안 파일 지움" false

reset_b; mkdir -p "$R/apps/mobile"; g -C "$R" mv scripts/dev/work.sh apps/mobile/work.sh; commit mv
run_dn "$B" "$C"; judge "N9 목록 안에서 옮김" false

for p in "docs/보고서.txt" "apps/mobile/화면.tsx" "scripts/dev/메모.txt"; do
  change_from_b "$p"
  first=$(g -C "$R" diff --name-only "$B" "$C" | head -1)
  case "$first" in
    \"*) run_dn "$B" "$C"; judge "N10 한글 경로: $p" false ;;
    *) bad "N10 한글 경로: $p" "setup: git did not quote the path (got '$first'); core.quotepath condition not met" ;;
  esac
done
for p in "scripts/dev/my tool.sh" "docs/a b.txt"; do
  change_from_b "$p"; run_dn "$B" "$C"; judge "N11 공백 경로: $p" false
done
reset_b
edit scripts/dev/work.sh; commit c1
edit docs/a.txt; commit c2
edit apps/mobile/src/a.tsx; commit c3
run_dn "$B" "$C"; judge "N12 커밋 여럿(모두 목록 안)" false

# ---------------------------------------------------------------- 2절: 바뀐 경로 없음 → false
run_dn "$B" "$B"; judge "E1 before = after" false
reset_b; g -C "$R" commit -q --allow-empty -m empty; C=$(g -C "$R" rev-parse HEAD)
run_dn "$B" "$C"; judge "E2 빈 커밋" false
reset_b
edit apps/backend/src/main/java/A.java; commit e3a
g -C "$R" checkout -q "$B" -- apps/backend/src/main/java/A.java; commit e3b
if g -C "$R" diff --quiet "$B" "$C"; then
  run_dn "$B" "$C"; judge "E3 고쳤다가 되돌림" false
else
  bad "E3 고쳤다가 되돌림" "setup: B and C still differ"
fi

# ---------------------------------------------------------------- 3절: 목록 밖 경로가 있음 → true
Y1=(apps/backend/src/main/java/A.java apps/backend/src/test/java/ATest.java apps/backend/build.gradle.kts
  apps/frontend/app/page.tsx package.json package-lock.json docker-compose.yml docker-compose.prod.yml infra/nginx/a.conf
  scripts/ops/deploy.sh .github/workflows/ci.yml .gitignore infra/mysql/schema/001.sql scripts/other.mjs)
for x in "${Y1[@]}"; do
  change_from_b scripts/dev/work.sh "$x"; run_dn "$B" "$C"
  judge "Y1 목록 밖: $x" true "has:$x" "lacks:scripts/dev/work.sh"
done
Y2=(docs-old/a.txt apps/backend/docs/a.txt .claude-old/a.json .claude.json scripts/dev-old/a.sh scripts/devtools.sh
  apps/backend/scripts/dev/a.sh scripts/feedback-quality-old/a.json scripts/run-feedback-quality-check.mjs.bak
  scripts/run-feedback-quality-check.js apps/mobile-old/a.tsx apps/mobile.json apps/frontend/a.mdx README.md.bak)
for x in "${Y2[@]}"; do
  change_from_b scripts/dev/work.sh "$x"; run_dn "$B" "$C"
  judge "Y2 비슷한 이름(목록 밖): $x" true "has:$x" "lacks:scripts/dev/work.sh"
done

A_JAVA=apps/backend/src/main/java/A.java
reset_b; g -C "$R" rm -q "$A_JAVA"; edit scripts/dev/work.sh; commit y3
run_dn "$B" "$C"; judge "Y3 목록 밖 파일 지움" true "has:$A_JAVA" "lacks:scripts/dev/work.sh"

reset_b; g -C "$R" mv "$A_JAVA" scripts/dev/A.java; commit y4
if g -C "$R" diff --name-status "$B" "$C" | grep -q '^R'; then
  run_dn "$B" "$C"; judge "Y4 목록 밖 → 목록 안으로 옮김(옛 경로)" true "has:$A_JAVA" "lacks:scripts/dev/A.java"
else
  bad "Y4 목록 밖 → 목록 안으로 옮김(옛 경로)" "setup: git did not detect the move as a rename"
fi

reset_b; mkdir -p "$R/apps/frontend"; g -C "$R" mv scripts/dev/work.sh apps/frontend/work.sh; commit y5
run_dn "$B" "$C"; judge "Y5 목록 안 → 목록 밖으로 옮김(새 경로)" true "has:apps/frontend/work.sh" "lacks:scripts/dev/work.sh"

change_from_b .claude/settings.json apps/mobile/src/a.tsx docs/a.txt package.json; run_dn "$B" "$C"
judge "Y6 이유에는 목록 밖 경로만" true "has:package.json" "lacks:.claude/settings.json" "lacks:apps/mobile/src/a.tsx" "lacks:docs/a.txt"

change_from_b "$A_JAVA" package.json docs/a.txt; run_dn "$B" "$C"
judge "Y7 목록 밖이 여럿이면 앞의 것부터" true "has:$A_JAVA" "lacks:docs/a.txt"

reset_b
for i in $(seq 1 30); do edit "apps/backend/f$(printf '%02d' "$i").txt"; done
commit y8; run_dn "$B" "$C"; judge "Y8 목록 밖 30개(이유 한 줄)" true "has:apps/backend/f01.txt"

reset_b
edit scripts/dev/work.sh; commit y9a
edit "$A_JAVA"; commit y9b
edit docs/a.txt; commit y9c
run_dn "$B" "$C"; judge "Y9 커밋 여럿(목록 밖 포함)" true "has:$A_JAVA" "lacks:scripts/dev/work.sh" "lacks:docs/a.txt"

change_from_b "apps/backend/문서.txt"; run_dn "$B" "$C"; judge "Y10 목록 밖 한글 경로" true

change_from_b "$A_JAVA"; S1=$C
change_from_b docs/a.txt; M1=$C
run_dn "$S1" "$M1"; judge "Y11 시작 커밋이 조상이 아님(둘 다 있음)" true "has:$A_JAVA" "lacks:docs/a.txt"

change_from_b "$A_JAVA"; Y12C=$C
run_dn "$Y12C" "$B"; judge "Y12 시작 커밋이 더 나중" true "has:$A_JAVA"

# ---------------------------------------------------------------- 4절: 범위를 알 수 없음 → true
change_from_b docs/a.txt; D=$C
Z40=0000000000000000000000000000000000000000
NOPE=1234567890abcdef1234567890abcdef12345678
O="$TMP/other"
new_repo "$O"
echo other > "$O/x.txt"; g -C "$O" add -A; g -C "$O" commit -q -m other
OTHER=$(g -C "$O" rev-parse HEAD)
run_dn "" "$D"; judge "U1 시작 커밋이 빈 값" true
run_dn "$Z40" "$D"; judge "U2 시작 커밋이 0 40자" true
run_dn 0 "$D"; judge "U3 시작 커밋이 0" true
run_dn 0000000 "$D"; judge "U3 시작 커밋이 0000000" true
run_dn "$NOPE" "$D"; judge "U4 시작 커밋이 저장소에 없음" true
run_dn not-a-commit "$D"; judge "U5 시작 커밋이 커밋 이름이 아님" true
run_dn "$B" "$NOPE"; judge "U6 끝 커밋이 저장소에 없음" true
run_dn "$B" "$Z40"; judge "U7 끝 커밋이 0 40자" true
run_dn "$B" ""; judge "U8 끝 커밋이 빈 값" true
if g -C "$R" cat-file -e "$OTHER^{commit}" 2> /dev/null; then
  bad "U9 다른 저장소의 커밋" "setup: the other repository's commit exists in the test repository"
else
  run_dn "$OTHER" "$D"; judge "U9 다른 저장소의 커밋" true
fi

# ---------------------------------------------------------------- 5절: 인자 수 → 2
expect_rc2() { if [ "$RC" = 2 ]; then ok "$1"; else bad "$1" "expected exit 2, got $RC | stdout: $(tr '\n' '|' < "$TMP/out")"; fi; }
run_dn; expect_rc2 "A1 인자 없음"
run_dn "$B"; expect_rc2 "A2 인자 하나"
run_dn ""; expect_rc2 "A3 인자 하나(빈 문자열)"
run_dn "$B" "$D" "$B"; expect_rc2 "A4 인자 셋"

# ================================================================ 가짜 gh
SAFE_PATH=""
IFS=: read -r -a PATH_DIRS <<< "$PATH"
for d in "${PATH_DIRS[@]}"; do
  [ -n "$d" ] || continue
  if [ -e "$d/gh" ] || [ -e "$d/gh.exe" ]; then continue; fi
  SAFE_PATH="${SAFE_PATH:+$SAFE_PATH:}$d"
done
if PATH="$SAFE_PATH" command -v gh > /dev/null 2>&1; then
  echo "FAIL setup: a real gh is still on the test PATH; refusing to run"
  exit 1
fi
FAKEBIN="$TMP/bin"
mkdir -p "$FAKEBIN"
cat > "$FAKEBIN/fake-gh.js" << 'EOF'
'use strict';
// 가짜 gh: `gh api <endpoint> [--jq <식>]`만 받는다. 배포 기록은 QA_GH_FIXTURE(JSON)에서 읽는다.
// fixture: {repo, deployments: [{id, sha, environment, states: [오래된 것부터]}](최근 배포부터),
//           listError: <HTTP 상태>, listRaw: <JSON이 아닌 응답>, statusError: [배포 id]}
const fs = require('fs');
const [fixturePath, logPath, ...args] = process.argv.slice(2);
const log = (s) => { try { fs.appendFileSync(logPath, s + '\n'); } catch (e) { /* ignore */ } };
const out = (s) => fs.writeSync(1, s);
const err = (s) => fs.writeSync(2, s);
log('CALL ' + JSON.stringify(args));
function unsupported(why) { log('UNSUPPORTED ' + why); err('fake gh: unsupported: ' + why + '\n'); process.exit(96); }
function httpError(status, msg) { out(JSON.stringify({ message: msg, status: String(status) }) + '\n'); err(`gh: ${msg} (HTTP ${status})\n`); process.exit(1); }

class JqError extends Error {}
class Unsup extends Error {}
function parseJq(src) {
  let pos = 0;
  const ws = () => { while (pos < src.length && /\s/.test(src[pos])) pos++; };
  const at = (s) => { ws(); return src.startsWith(s, pos); };
  const eat = (s) => { if (!at(s)) throw new Unsup(`expected "${s}" at ${pos} in ${src}`); pos += s.length; };
  const identAt = () => { ws(); const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(pos)); return m ? m[0] : null; };
  function pipe() { const l = comma(); if (at('|') && !at('|=')) { pos++; return { t: 'pipe', l, r: pipe() }; } return l; }
  function comma() { let l = alt(); while (at(',')) { pos++; l = { t: 'comma', l, r: alt() }; } return l; }
  function alt() { const l = orE(); if (at('//') && !at('//=')) { pos += 2; return { t: 'alt', l, r: alt() }; } return l; }
  function orE() { let l = andE(); while (identAt() === 'or') { pos += 2; l = { t: 'or', l, r: andE() }; } return l; }
  function andE() { let l = cmp(); while (identAt() === 'and') { pos += 3; l = { t: 'and', l, r: cmp() }; } return l; }
  function cmp() { const l = postfix(); for (const op of ['==', '!=']) if (at(op)) { pos += 2; return { t: 'cmp', op, l, r: postfix() }; } return l; }
  function postfix() {
    let e = primary();
    for (;;) {
      if (src[pos] === '.' && /[A-Za-z_"]/.test(src[pos + 1] || '')) { pos++; e = field(e); continue; }
      if (src[pos] === '.' && src[pos + 1] === '[') { pos++; continue; }
      if (src[pos] === '[') { e = bracket(e); continue; }
      if (src[pos] === '?') { pos++; e = { t: 'try', e }; continue; }
      return e;
    }
  }
  function field(of) {
    if (src[pos] === '"') { const s = str(); if (s.t !== 'lit') throw new Unsup('interpolated key'); return { t: 'field', of, name: s.v }; }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(pos)); pos += m[0].length; return { t: 'field', of, name: m[0] };
  }
  function bracket(of) {
    pos++; ws();
    if (src[pos] === ']') { pos++; return { t: 'iter', of }; }
    const idx = pipe(); ws();
    if (src[pos] === ':') throw new Unsup('slice');
    eat(']');
    return { t: 'index', of, idx };
  }
  function str() {
    pos++;
    const parts = []; let cur = '';
    for (;;) {
      if (pos >= src.length) throw new Unsup('unterminated string');
      const c = src[pos];
      if (c === '"') { pos++; break; }
      if (c === '\\') {
        const n = src[pos + 1];
        if (n === '(') { pos += 2; if (cur) parts.push(cur); cur = ''; const e = pipe(); eat(')'); parts.push(e); continue; }
        if (n === 'u') { cur += String.fromCharCode(parseInt(src.slice(pos + 2, pos + 6), 16)); pos += 6; continue; }
        const map = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
        if (!(n in map)) throw new Unsup('escape \\' + n);
        cur += map[n]; pos += 2; continue;
      }
      cur += c; pos++;
    }
    if (cur || parts.length === 0) parts.push(cur);
    if (parts.length === 1 && typeof parts[0] === 'string') return { t: 'lit', v: parts[0] };
    return { t: 'str', parts };
  }
  function primary() {
    ws();
    const c = src[pos];
    if (c === undefined) throw new Unsup('unexpected end of ' + src);
    if (src.startsWith('..', pos)) throw new Unsup('recurse ..');
    if (c === '.') { pos++; if (/[A-Za-z_"]/.test(src[pos] || '')) return field({ t: 'id' }); return { t: 'id' }; }
    if (c === '"') return str();
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[pos + 1] || ''))) {
      const m = /^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?/.exec(src.slice(pos)); pos += m[0].length; return { t: 'lit', v: Number(m[0]) };
    }
    if (c === '(') { pos++; const e = pipe(); eat(')'); return e; }
    if (c === '[') { pos++; ws(); if (src[pos] === ']') { pos++; return { t: 'lit', v: [] }; } const e = pipe(); eat(']'); return { t: 'arr', e }; }
    const id = identAt();
    if (id) {
      pos += id.length;
      if (id === 'null') return { t: 'lit', v: null };
      if (id === 'true') return { t: 'lit', v: true };
      if (id === 'false') return { t: 'lit', v: false };
      if (at('(')) {
        if (!['select', 'map', 'first', 'last'].includes(id)) throw new Unsup('function ' + id + '/1');
        pos++; const a = pipe(); eat(')'); return { t: 'call1', id, a };
      }
      if (!['empty', 'not', 'length', 'tostring', 'type', 'keys', 'first', 'last'].includes(id)) throw new Unsup('function ' + id);
      return { t: 'call0', id };
    }
    throw new Unsup(`unexpected "${c}" at ${pos} in ${src}`);
  }
  const ast = pipe(); ws();
  if (pos !== src.length) throw new Unsup(`trailing input at ${pos} in ${src}`);
  return ast;
}
const truthy = (v) => v !== null && v !== false;
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v);
const tostr = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function* ev(n, x) {
  switch (n.t) {
    case 'id': yield x; return;
    case 'lit': yield n.v; return;
    case 'field':
      for (const v of ev(n.of, x)) {
        if (v === null) yield null;
        else if (typeOf(v) === 'object') yield has(v, n.name) ? v[n.name] : null;
        else throw new JqError(`Cannot index ${typeOf(v)} with "${n.name}"`);
      }
      return;
    case 'index':
      for (const v of ev(n.of, x)) for (const k of ev(n.idx, x)) {
        if (v === null) { yield null; continue; }
        if (Array.isArray(v) && typeof k === 'number') { const i = k < 0 ? v.length + k : Math.floor(k); yield i >= 0 && i < v.length ? v[i] : null; continue; }
        if (typeOf(v) === 'object' && typeof k === 'string') { yield has(v, k) ? v[k] : null; continue; }
        throw new JqError(`Cannot index ${typeOf(v)} with ${typeOf(k)}`);
      }
      return;
    case 'iter':
      for (const v of ev(n.of, x)) {
        if (Array.isArray(v)) yield* v;
        else if (typeOf(v) === 'object') yield* Object.values(v);
        else throw new JqError(`Cannot iterate over ${typeOf(v)}`);
      }
      return;
    case 'try': try { yield* ev(n.e, x); } catch (e) { if (!(e instanceof JqError)) throw e; } return;
    case 'pipe': for (const v of ev(n.l, x)) yield* ev(n.r, v); return;
    case 'comma': yield* ev(n.l, x); yield* ev(n.r, x); return;
    case 'alt': {
      let any = false;
      try { for (const v of ev(n.l, x)) if (truthy(v)) { any = true; yield v; } } catch (e) { if (!(e instanceof JqError)) throw e; }
      if (!any) yield* ev(n.r, x);
      return;
    }
    case 'or': for (const a of ev(n.l, x)) { if (truthy(a)) { yield true; continue; } for (const b of ev(n.r, x)) yield truthy(b); } return;
    case 'and': for (const a of ev(n.l, x)) { if (!truthy(a)) { yield false; continue; } for (const b of ev(n.r, x)) yield truthy(b); } return;
    case 'cmp': for (const b of ev(n.r, x)) for (const a of ev(n.l, x)) { const eq = JSON.stringify(a) === JSON.stringify(b); yield n.op === '==' ? eq : !eq; } return;
    case 'str': {
      const parts = n.parts;
      const build = function* (i, acc) {
        if (i === parts.length) { yield acc; return; }
        const p = parts[i];
        if (typeof p === 'string') { yield* build(i + 1, acc + p); return; }
        for (const v of ev(p, x)) yield* build(i + 1, acc + tostr(v));
      };
      yield* build(0, '');
      return;
    }
    case 'arr': yield [...ev(n.e, x)]; return;
    case 'call0':
      switch (n.id) {
        case 'empty': return;
        case 'not': yield !truthy(x); return;
        case 'length':
          if (x === null) yield 0;
          else if (typeof x === 'string' || Array.isArray(x)) yield x.length;
          else if (typeOf(x) === 'object') yield Object.keys(x).length;
          else if (typeof x === 'number') yield Math.abs(x);
          else throw new JqError('boolean has no length');
          return;
        case 'tostring': yield tostr(x); return;
        case 'type': yield typeOf(x); return;
        case 'keys':
          if (typeOf(x) === 'object') yield Object.keys(x).sort();
          else if (Array.isArray(x)) yield x.map((_, i) => i);
          else throw new JqError(`${typeOf(x)} has no keys`);
          return;
        case 'first': yield* ev({ t: 'index', of: { t: 'id' }, idx: { t: 'lit', v: 0 } }, x); return;
        case 'last': yield* ev({ t: 'index', of: { t: 'id' }, idx: { t: 'lit', v: -1 } }, x); return;
      }
      break;
    case 'call1':
      switch (n.id) {
        case 'select': for (const c of ev(n.a, x)) if (truthy(c)) yield x; return;
        case 'map': {
          if (!Array.isArray(x) && typeOf(x) !== 'object') throw new JqError(`Cannot iterate over ${typeOf(x)}`);
          const r = [];
          for (const el of Array.isArray(x) ? x : Object.values(x)) for (const v of ev(n.a, el)) r.push(v);
          yield r;
          return;
        }
        case 'first': for (const v of ev(n.a, x)) { yield v; return; } return;
        case 'last': { let l; let any = false; for (const v of ev(n.a, x)) { l = v; any = true; } if (any) yield l; return; }
      }
      break;
  }
  throw new Unsup('node ' + n.t);
}

if (args[0] !== 'api') unsupported('gh ' + args.join(' '));
let endpoint = null; let jq = null; let method = null; let paginate = false; let silent = false;
const fields = [];
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  const val = () => { if (i + 1 >= args.length) unsupported('missing value for ' + a); return args[++i]; };
  if (a === '--jq' || a === '-q') jq = val();
  else if (a.startsWith('--jq=')) jq = a.slice(5);
  else if (a === '-X' || a === '--method') method = val();
  else if (a.startsWith('--method=')) method = a.slice(9);
  else if (a === '--paginate') paginate = true;
  else if (a === '--silent') silent = true;
  else if (['-H', '--header', '--hostname', '--cache', '-p', '--preview'].includes(a)) val();
  else if (['-f', '--raw-field', '-F', '--field'].includes(a)) fields.push(val());
  else if (a.startsWith('-')) unsupported('flag ' + a);
  else if (endpoint === null) endpoint = a;
  else unsupported('extra argument ' + a);
}
if (endpoint === null) unsupported('no endpoint');
if (endpoint === 'graphql') unsupported('graphql');
method = (method || (fields.length ? 'POST' : 'GET')).toUpperCase();
if (method !== 'GET') { log('REFUSED ' + method + ' ' + endpoint); httpError(422, 'fake gh accepts only GET'); }
let ep = endpoint.replace(/^https:\/\/api\.github\.com\//, '').replace(/^\//, '');
if (/\{owner\}|\{repo\}/.test(ep)) {
  const r = process.env.GH_REPO || '';
  if (!r.includes('/')) { err('fake gh: could not determine base repo\n'); process.exit(1); }
  const [o, nm] = r.split('/');
  ep = ep.replace('{owner}', o).replace('{repo}', nm);
}
const qi = ep.indexOf('?');
const path = qi < 0 ? ep : ep.slice(0, qi);
const q = new URLSearchParams(qi < 0 ? '' : ep.slice(qi + 1));
for (const f of fields) { const k = f.indexOf('='); q.append(f.slice(0, k), f.slice(k + 1)); }
const fx = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const seg = path.split('/').filter(Boolean);
if (seg[0] !== 'repos' || seg.length < 4) httpError(404, 'Not Found');
const repo = seg[1] + '/' + seg[2];
if (repo.toLowerCase() !== String(fx.repo).toLowerCase()) httpError(404, 'Not Found');
const deps = fx.deployments || [];
const apiBase = 'https://api.github.com/repos/' + repo;
const iso = (n) => new Date(Date.parse('2026-10-01T00:00:00Z') + n * 60000).toISOString().replace('.000', '');
const depObj = (d) => {
  const t = iso((deps.length - deps.indexOf(d)) * 100);
  return { url: `${apiBase}/deployments/${d.id}`, id: d.id, node_id: 'DE_' + d.id, sha: d.sha, ref: d.ref || 'main', task: 'deploy',
    payload: {}, original_environment: d.environment, environment: d.environment, description: null,
    creator: { login: 'github-actions[bot]' }, created_at: t, updated_at: t, statuses_url: `${apiBase}/deployments/${d.id}/statuses`,
    repository_url: apiBase, transient_environment: false, production_environment: d.environment === 'production' };
};
const page = (arr) => {
  if (paginate) return arr;
  const per = Math.min(100, Math.max(1, parseInt(q.get('per_page') || '30', 10) || 30));
  const p = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
  return arr.slice((p - 1) * per, p * per);
};
const findDep = (id) => { const d = deps.find((x) => String(x.id) === id); if (!d) httpError(404, 'Not Found'); return d; };
let body;
if (seg[3] === 'deployments' && seg.length === 4) {
  if (fx.listError) httpError(fx.listError, 'Server Error');
  if (typeof fx.listRaw === 'string') body = { raw: fx.listRaw };
  else {
    let list = deps.map(depObj);
    for (const k of ['environment', 'sha', 'ref', 'task']) if (q.has(k)) list = list.filter((d) => d[k] === q.get(k));
    body = { json: page(list) };
  }
} else if (seg[3] === 'deployments' && seg.length === 5) {
  body = { json: depObj(findDep(seg[4])) };
} else if (seg[3] === 'deployments' && seg.length === 6 && seg[5] === 'statuses') {
  const d = findDep(seg[4]);
  if ((fx.statusError || []).includes(d.id)) httpError(502, 'Bad Gateway');
  const base = (deps.length - deps.indexOf(d)) * 100;
  const st = (d.states || []).map((s, i) => ({ url: `${apiBase}/deployments/${d.id}/statuses/${d.id * 100 + i}`, id: d.id * 100 + i,
    node_id: 'DES_' + (d.id * 100 + i), state: s, creator: { login: 'github-actions[bot]' }, description: '', environment: d.environment,
    target_url: '', log_url: '', created_at: iso(base + i + 1), updated_at: iso(base + i + 1),
    deployment_url: `${apiBase}/deployments/${d.id}`, repository_url: apiBase })).reverse();
  body = { json: page(st) };
} else {
  httpError(404, 'Not Found');
}
if (silent) process.exit(0);
if (body.raw !== undefined) {
  if (jq !== null) { err('failed to parse jq input: invalid character\n'); process.exit(1); }
  out(body.raw);
  process.exit(0);
}
if (jq === null) { out(JSON.stringify(body.json) + '\n'); process.exit(0); }
let ast;
try { ast = parseJq(jq); } catch (e) { if (e instanceof Unsup) unsupported('jq ' + e.message); throw e; }
let text = '';
try {
  for (const v of ev(ast, body.json)) text += tostr(v) + '\n';
} catch (e) {
  if (e instanceof JqError) { out(text); err('jq: error: ' + e.message + '\n'); process.exit(1); }
  if (e instanceof Unsup) unsupported('jq ' + e.message);
  throw e;
}
out(text);
process.exit(0);
EOF
cat > "$FAKEBIN/gh" << 'EOF'
#!/usr/bin/env bash
w() { cygpath -w "$1" 2> /dev/null || printf '%s\n' "$1"; }
MSYS2_ARG_CONV_EXCL='*' exec "$QA_REAL_NODE" "$(w "$QA_FAKE_GH_JS")" "$(w "$QA_GH_FIXTURE")" "$(w "$QA_GH_LOG")" "$@"
EOF
chmod +x "$FAKEBIN/gh"
export QA_REAL_NODE="$REAL_NODE" QA_FAKE_GH_JS="$FAKEBIN/fake-gh.js"
FX="$TMP/fixture.json"
GHLOG="$TMP/gh.log"
fakegh() { QA_GH_FIXTURE="$FX" QA_GH_LOG="$GHLOG" PATH="$FAKEBIN:$SAFE_PATH" gh "$@"; }

# 가짜 gh가 이 테스트가 기대하는 대로 답하는지 먼저 본다.
H40() { local i s=""; for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do s+=$1; done; echo "$s"; }
AA=$(H40 aa)
BB=$(H40 bb)
cat > "$FX" << EOF
{"repo":"qa-owner/qa-repo","deployments":[
 {"id":5,"sha":"$AA","environment":"production","states":["in_progress","success"]},
 {"id":4,"sha":"$BB","environment":"staging","states":["failure"]}]}
EOF
: > "$GHLOG"
sc_fail() { echo "FAIL setup: fake gh: $1"; exit 1; }
[ "$(PATH="$FAKEBIN:$SAFE_PATH" command -v gh)" = "$FAKEBIN/gh" ] || sc_fail "not first on PATH"
[ "$(fakegh api 'repos/qa-owner/qa-repo/deployments' --jq '.[] | "\(.id) \(.sha)"')" = "5 $AA"$'\n'"4 $BB" ] || sc_fail "list"
[ "$(fakegh api 'repos/qa-owner/qa-repo/deployments?environment=production&per_page=30' --jq '.[] | "\(.id) \(.sha)"')" = "5 $AA" ] || sc_fail "environment filter"
[ "$(fakegh api 'repos/qa-owner/qa-repo/deployments/5/statuses?per_page=1' --jq '.[0].state // ""')" = success ] || sc_fail "latest status"
[ "$(fakegh api 'repos/qa-owner/qa-repo/deployments/5/statuses' --jq '[.[] | .state]')" = '["success","in_progress"]' ] || sc_fail "status order"
[ "$(fakegh api 'repos/qa-owner/qa-repo/deployments/4/statuses?per_page=1' --jq '.[1].state // ""')" = "" ] || sc_fail "alternative"
[ "$(fakegh api 'repos/qa-owner/qa-repo/deployments' --jq '.[] | select(.environment == "staging") | .id')" = 4 ] || sc_fail "select"
fakegh api 'repos/other/repo/deployments' > /dev/null 2>&1 && sc_fail "wrong repo should fail"
fakegh api 'repos/qa-owner/qa-repo/deployments' --jq '$x' > /dev/null 2>&1; [ $? = 96 ] || sc_fail "unsupported jq should exit 96"
fakegh api -X POST 'repos/qa-owner/qa-repo/deployments' > /dev/null 2>&1 && sc_fail "POST should fail"

# ================================================================ 2부: last-deployed-sha.sh(시작 커밋 고르기)
E="$TMP/e2e"
new_repo "$E"
for f in apps/backend/src/main/java/A.java apps/frontend/app/page.tsx scripts/dev/work.sh docs/a.txt; do
  mkdir -p "$(dirname "$E/$f")"; body "$f" > "$E/$f"
done
cp "$DEV/deploy-needed.sh" "$DEV/last-deployed-sha.sh" "$E/scripts/dev/"
g -C "$E" add -A; g -C "$E" commit -q -m k0
echo k1 >> "$E/apps/backend/src/main/java/A.java"; g -C "$E" commit -qam k1; K1=$(g -C "$E" rev-parse HEAD)
echo k2 >> "$E/apps/frontend/app/page.tsx"; g -C "$E" commit -qam k2; K2=$(g -C "$E" rev-parse HEAD)
g -C "$E" checkout -q -b side
echo s > "$E/apps/backend/src/main/java/S.java"; g -C "$E" add -A; g -C "$E" commit -qm side; KS=$(g -C "$E" rev-parse HEAD)
g -C "$E" checkout -q main
echo k3 >> "$E/scripts/dev/work.sh"; g -C "$E" commit -qam k3; K3=$(g -C "$E" rev-parse HEAD)

# fixture 쓰기. 인자: 배포 줄들("id sha environment state,state,..."; 최근 배포부터). 추가 키는 FX_EXTRA(JSON 조각).
write_fx() {
  local line id sha env states first=1 st
  { printf '{"repo":"qa-owner/qa-repo"%s,"deployments":[' "${FX_EXTRA:+,$FX_EXTRA}"
    for line in "$@"; do
      read -r id sha env states <<< "$line"
      [ $first = 1 ] || printf ','
      first=0
      st=""
      [ -n "${states:-}" ] && [ "$states" != - ] && st="\"${states//,/\",\"}\""
      printf '{"id":%s,"sha":"%s","environment":"%s","states":[%s]}' "$id" "$sha" "$env" "$st"
    done
    printf ']}\n'
  } > "$FX"
}
# 시작 커밋 고르기를 부른다: QRC, QL(표준 출력의 비지 않은 줄)
run_q() {
  : > "$GHLOG"
  (cd "$E" && QA_GH_FIXTURE="$FX" QA_GH_LOG="$GHLOG" GH_TOKEN=fake-token PATH="$FAKEBIN:$SAFE_PATH" \
    bash scripts/dev/last-deployed-sha.sh qa-owner/qa-repo) > "$TMP/qout" 2> "$TMP/qerr"
  QRC=$?
  QL=()
  local l
  while IFS= read -r l || [ -n "$l" ]; do [ -n "$l" ] && QL+=("$l"); done < "$TMP/qout"
}
gh_problem() { grep -E '^(UNSUPPORTED|REFUSED)' "$GHLOG" | head -3 | tr '\n' '|'; }
expect_start() {
  local name=$1 want=$2 why=""
  [ "${#QL[@]}" = 1 ] && [ "${QL[0]}" = "$want" ] || why="expected start commit $want, got: $(tr '\n' '|' < "$TMP/qout")"
  [ -z "$(gh_problem)" ] || why+=" | fake gh could not answer: $(gh_problem)"
  if [ -z "$why" ]; then ok "$name"; else bad "$name" "$why"; fi
}
C0=$(H40 c0)
C1=$(H40 c1)
C2=$(H40 c2)
C3=$(H40 c3)
C9=$(H40 c9)
FX_EXTRA=""
write_fx "13 $C3 production in_progress,failure" "12 $C2 production in_progress,success" "11 $C1 production success"
run_q; expect_start "Q1 실패한 최근 배포를 건너뛰고 success인 것" "$C2"
write_fx "12 $C2 production queued,in_progress" "11 $C1 production in_progress,success"
run_q; expect_start "Q2 끝나지 않은 배포는 건너뜀" "$C1"
write_fx "12 $C2 production success,failure" "11 $C1 production success"
run_q; expect_start "Q3 가장 최근 상태가 success가 아니면 건너뜀" "$C1"
write_fx "12 $C2 production error" "11 $C1 production success,inactive" "10 $C0 production success"
run_q; expect_start "Q4 error와 inactive를 건너뜀" "$C0"
write_fx "12 $C2 production -" "11 $C1 production success"
run_q; expect_start "Q5 상태 기록이 없는 배포는 건너뜀" "$C1"
write_fx "14 $C9 staging success" "11 $C1 production success"
run_q; expect_start "Q10 다른 환경의 배포는 쓰지 않음" "$C1"

# ================================================================ 3부: ci.yml 판단 단계 실행
CI_YML="$ROOT/.github/workflows/ci.yml"
BLOCK="$TMP/ci-step.sh"
EXTRACT="$TMP/extract.js"
cat > "$EXTRACT" << 'EOF'
'use strict';
// ci.yml에서 이름이 "배포 필요 판단"인 job을 찾아, deploy-needed.sh를 부르는 run 블록과 job 출력이 가리키는 단계 출력 이름을 꺼낸다.
const fs = require('fs');
const [ciPath, outPath, sha, repo, before] = process.argv.slice(2);
const lines = fs.readFileSync(ciPath, 'utf8').split(/\r?\n/);
const ind = (s) => s.match(/^ */)[0].length;
const fail = (m) => { process.stderr.write('extract: ' + m + '\n'); process.exit(3); };
const nameIdx = lines.findIndex((l) => /^\s+name:\s*["']?배포 필요 판단["']?\s*$/.test(l));
if (nameIdx < 0) fail('job named 배포 필요 판단 not found');
let j = nameIdx - 1;
while (j >= 0 && !(lines[j].trim() !== '' && ind(lines[j]) < ind(lines[nameIdx]) && /^\s*[A-Za-z0-9_-]+:\s*$/.test(lines[j]))) j--;
if (j < 0) fail('job key not found');
const jobInd = ind(lines[j]);
let end = j + 1;
while (end < lines.length && (lines[end].trim() === '' || ind(lines[end]) > jobInd)) end++;
const job = lines.slice(j, end);
const outs = [];
for (const l of job) {
  const m = /^\s+[A-Za-z0-9_-]+:\s*\$\{\{\s*steps\.[A-Za-z0-9_-]+\.outputs\.([A-Za-z0-9_-]+)\s*\}\}\s*$/.exec(l);
  if (m) outs.push(m[1]);
}
if (outs.length !== 1) fail('expected one job output taken from a step, found ' + outs.length);
const blocks = [];
for (let i = 0; i < job.length; i++) {
  const m = /^(\s*)(- )?run:\s*\|[-+]?\s*$/.exec(job[i]);
  if (!m) continue;
  const keyInd = m[1].length + (m[2] ? 2 : 0);
  const b = [];
  let k = i + 1;
  while (k < job.length && (job[k].trim() === '' || ind(job[k]) > keyInd)) b.push(job[k++]);
  while (b.length && b[b.length - 1].trim() === '') b.pop();
  if (!b.length) continue;
  const bi = Math.min(...b.filter((l) => l.trim() !== '').map(ind));
  blocks.push(b.map((l) => l.slice(Math.min(bi, ind(l)))).join('\n') + '\n');
}
const target = blocks.filter((b) => b.includes('deploy-needed.sh'));
if (target.length !== 1) fail('expected one run block calling deploy-needed.sh, found ' + target.length);
const subs = { 'github.sha': sha, 'github.repository': repo, 'github.event.before': before, 'github.token': 'fake-token', 'secrets.GITHUB_TOKEN': 'fake-token' };
const script = target[0].replace(/\$\{\{\s*([^}]*?)\s*\}\}/g, (all, e) => (e in subs ? subs[e] : fail('unsupported expression ' + all)));
fs.writeFileSync(outPath, script);
process.stdout.write(outs[0] + '\n');
EOF
OUTNAME=$(MSYS2_ARG_CONV_EXCL='*' "$REAL_NODE" "$(winpath "$EXTRACT")" "$(winpath "$CI_YML")" "$(winpath "$BLOCK")" "$K3" qa-owner/qa-repo "$K1" 2> "$TMP/extract.err")
if [ $? != 0 ] || [ -z "$OUTNAME" ]; then
  bad "3부 준비: ci.yml에서 판단 단계 꺼내기" "$(cat "$TMP/extract.err")"
  echo
  echo "passed $PASS, failed $FAIL"
  exit 1
fi

# 판단 단계를 GitHub 기본 셸(bash -e)로 돌린다: CRC, OUTV(단계 출력 값), 실행 요약은 $TMP/summary
run_ci() {
  : > "$GHLOG"
  : > "$TMP/gh_output"
  : > "$TMP/summary"
  printf '{"before":"%s","after":"%s"}\n' "$K1" "$K3" > "$TMP/event.json"
  (cd "$E" && GITHUB_SHA="$K3" GITHUB_REPOSITORY=qa-owner/qa-repo GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main \
    GITHUB_OUTPUT="$TMP/gh_output" GITHUB_STEP_SUMMARY="$TMP/summary" GITHUB_EVENT_PATH="$TMP/event.json" GITHUB_TOKEN=fake-token \
    GH_TOKEN=fake-token QA_GH_FIXTURE="$FX" QA_GH_LOG="$GHLOG" PATH="$FAKEBIN:$SAFE_PATH" \
    bash --noprofile --norc -e "$BLOCK") > "$TMP/ci.out" 2> "$TMP/ci.err"
  CRC=$?
  OUTV=$(grep -E "^${OUTNAME}=" "$TMP/gh_output" | tail -1 | cut -d= -f2-)
}
# 인자: 이름, 기대 출력(true/false), [summary:<문자열>] [reason:<이유 줄>](reason은 기대한 이유 줄이 비면 그것만으로 실패)
ci_expect() {
  local name=$1 want=$2 a why=""
  shift 2
  [ "$CRC" = 0 ] || why+=" step-exit=$CRC"
  [ "$OUTV" = "$want" ] || why+=" output '$OUTNAME'='$OUTV'"
  for a in "$@"; do
    case "$a" in
      summary:*) grep -qF -- "${a#summary:}" "$TMP/summary" || why+=" summary-missing '${a#summary:}'" ;;
      reason:*)
        if [ -z "${a#reason:}" ]; then
          why+=" expected-reason-empty"
        else
          grep -qF -- "${a#reason:}" "$TMP/summary" || why+=" summary-missing-reason '${a#reason:}'"
        fi
        ;;
    esac
  done
  [ -z "$(gh_problem)" ] || why+=" fake-gh: $(gh_problem)"
  if [ -z "$why" ]; then
    ok "$name"
  else
    bad "$name" "expected output $want:${why} | GITHUB_OUTPUT: $(tr '\n' '|' < "$TMP/gh_output") | stdout: $(head -c 300 "$TMP/ci.out" | tr '\n' '|') | stderr: $(head -c 300 "$TMP/ci.err" | tr '\n' '|')"
  fi
}
reason_of() { (cd "$E" && bash scripts/dev/deploy-needed.sh "$1" "$2") 2> /dev/null | sed -n 2p; }

FX_EXTRA=""
# Q1: 맞는 시작 커밋(K2)이면 K2..K3은 scripts/dev뿐이라 불필요. KS나 K1(또는 github.event.before = K1)을 쓰면 필요가 된다.
write_fx "13 $KS production in_progress,failure" "12 $K2 production in_progress,success" "11 $K1 production success"
run_ci; ci_expect "Q1·CI4·CI7 판단 단계: 마지막 성공 배포(K2)부터 판단, 불필요" false "summary:$(reason_of "$K2" "$K3")"
write_fx "11 $K1 production success"
run_ci; ci_expect "CI7 판단 단계: 필요일 때 출력과 실행 요약의 이유" true "summary:$(reason_of "$K1" "$K3")"
# 아래는 잘못 K2를 시작 커밋으로 쓰면 불필요가 되는 배포 기록이다. 실행 요약에는 판단 스크립트가 낸 이유 줄(시나리오 04 CI7)이
# 있어야 한다. 시작 커밋을 찾지 못하면 판단 단계는 빈 시작 커밋으로, Q11은 저장소에 없는 시작 커밋으로 스크립트를 부른다.
NOBASE_REASON=$(reason_of "" "$K3")
NOPE_REASON=$(reason_of "$NOPE" "$K3")
write_fx
run_ci; ci_expect "Q6·CI5 배포 기록이 없음 → 필요" true "reason:$NOBASE_REASON"
write_fx "12 $K2 production failure" "11 $K2 production in_progress"
run_ci; ci_expect "Q7·CI5 success인 배포가 없음 → 필요" true "reason:$NOBASE_REASON"
write_fx "11 $K2 production success,inactive"
run_ci; ci_expect "Q8·CI5 가장 최근 상태가 inactive뿐 → 필요" true "reason:$NOBASE_REASON"
FX_EXTRA='"listError":500'
write_fx "11 $K2 production success"
run_ci; ci_expect "Q9a·CI6 배포 목록 조회 실패(HTTP 500) → 필요, 단계는 성공" true "reason:$NOBASE_REASON"
FX_EXTRA='"listRaw":"<html>oops</html>"'
write_fx "11 $K2 production success"
run_ci; ci_expect "Q9b·CI6 응답이 JSON이 아님 → 필요, 단계는 성공" true "reason:$NOBASE_REASON"
FX_EXTRA='"statusError":[11]'
write_fx "11 $K2 production success"
run_ci; ci_expect "Q9c·CI6 상태 조회 실패 → 필요, 단계는 성공" true "reason:$NOBASE_REASON"
FX_EXTRA=""
write_fx "11 $NOPE production success"
run_ci; ci_expect "Q11 시작 커밋이 저장소에 없음 → 필요" true "reason:$NOPE_REASON"

# CI8: 판단 스크립트를 가짜로 바꿔 실패·빈 출력·다른 글을 낸다(배포 기록은 K2가 success).
write_fx "11 $K2 production success"
stub_dn() { printf '#!/usr/bin/env bash\n%s\n' "$1" > "$E/scripts/dev/deploy-needed.sh"; }
stub_dn "printf 'deploy=false\nstub reason\n'; exit 1"
run_ci; ci_expect "CI8a 스크립트 종료 코드가 0이 아님(첫 줄 deploy=false) → 필요" true
stub_dn "exit 0"
run_ci; ci_expect "CI8b 종료 코드 0, 출력 없음 → 필요" true
stub_dn "printf 'maybe\nstub reason\n'"
run_ci; ci_expect "CI8c 첫 줄이 다른 글 → 필요" true
stub_dn "printf 'deploy=false\nstub reason\n'"
run_ci; ci_expect "CI8 종료 코드 0이고 첫 줄이 정확히 deploy=false일 때만 불필요" false "summary:stub reason"
g -C "$E" checkout -q -- scripts/dev/deploy-needed.sh

echo
echo "passed $PASS, failed $FAIL"
[ "$FAIL" = 0 ]
