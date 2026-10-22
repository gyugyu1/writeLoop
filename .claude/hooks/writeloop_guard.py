"""WriteLoop Claude Code 훅 검사 스크립트.

Claude Code가 이 저장소에서 작업할 때 DB 스키마와 운영 환경을 지키는 규칙을 자동으로 적용한다.
.claude/settings.json에 등록되어 있으며, 첫 번째 인자로 실행 시점(모드)을 받는다.

모드
  pre-edit   파일을 수정하기 직전 (PreToolUse: Edit/Write/MultiEdit/NotebookEdit)
             (1) 마이그레이션 SQL을 지킨다.
                 - Flyway 마이그레이션(apps/backend/src/main/resources/db/migration/V번호__설명.sql) 중
                   origin/main에 이미 올라간 파일은 수정을 막는다. 적용된 DB의 체크섬과 어긋나기 때문이다.
                 - 예전 폴더(infra/mysql/schema)는 107번에서 동결했으므로 새 파일 추가와 수정을 모두 막는다.
             (2) 설정 파일(application*.yml, docker-compose*.yml, .env*)에
                 ddl-auto update/create 를 쓰는 것을 막는다. Hibernate 자동 DDL은 SQL 파일과
                 다른 테이블 구조를 만들기 때문이다.
  stop       답변을 끝내려 할 때 (Stop)
             (3) origin/main 이후 바뀐 내용(작업 트리, 스테이징, push하지 않은 커밋)을 검사한다.
                 엔티티 구조(@Column, @Table, 필드 등)가 바뀌었는데 새 Flyway 마이그레이션이 없거나,
                 새 마이그레이션 버전이 기존 버전과 겹치거나, 공유된 마이그레이션이 수정되면
                 종료를 막고 이유를 전달한다. 같은 답변에서 두 번째 종료 시도는 통과시킨다.

동작 방식
  - 훅 입력 JSON을 표준 입력으로 받고, 판정 JSON을 표준 출력으로 낸다. 문제가 없으면 아무것도 출력하지 않는다.
  - 스크립트 자체에 오류가 나면 경고만 표시하고 작업은 막지 않는다.
  - Claude Code의 작업에만 적용되며, 사람이 직접 하는 편집이나 커밋은 검사하지 않는다.
  - 잠시 끄려면 Claude Code의 /hooks 메뉴를 사용한다.
"""

import json
import os
import re
import subprocess
import sys

# Flyway 마이그레이션 폴더. 새 스키마 변경은 여기에 V번호__설명.sql로 추가한다(docs/decisions/0013).
MIGRATION_DIR = "apps/backend/src/main/resources/db/migration"
MIGRATION_RE = re.compile(r"^apps/backend/src/main/resources/db/migration/V(\d+)__[^/]+\.sql$")
# 107번까지 손으로 적용하던 예전 폴더. Flyway 도입과 함께 동결했다.
LEGACY_MIGRATION_RE = re.compile(r"^infra/mysql/schema/[^/]+\.sql$")
# 중복 검사에서 제외할 버전.
KNOWN_DUPLICATE_NUMBERS = set()

CONFIG_FILE_RE = re.compile(
    r"(^|/)(application[^/]*\.(ya?ml|properties)|docker-compose[^/]*\.ya?ml|\.env[^/]*)$",
    re.IGNORECASE,
)
DDL_AUTO_RE = re.compile(
    r"(ddl-auto\s*[:=]\s*(\$\{[^}:]*:)?\s*['\"]?(update|create|create-drop)\b"
    r"|SPRING_JPA_HIBERNATE_DDL_AUTO\s*[:=]\s*['\"]?(\$\{[^}:]*:)?\s*(update|create|create-drop)\b)",
    re.IGNORECASE,
)

ENTITY_RE = re.compile(r"^apps/backend/src/main/java/.+Entity\.java$")
ENTITY_STRUCTURE_LINE_RE = re.compile(
    r"@(Column|Table|JoinColumn|JoinColumns|Id|EmbeddedId|Enumerated|ManyToOne|OneToOne|OneToMany|ManyToMany"
    r"|GeneratedValue|Lob|Index|UniqueConstraint|Embedded|Convert|Transient|MapsId|SecondaryTable)\b"
    r"|^\s*(private|protected)\s+(?!static\b)(final\s+)?[\w<>,.?\[\] ]+\s+\w+\s*(=[^;]*)?;\s*$"
)


def read_event():
    raw = sys.stdin.buffer.read()
    if not raw.strip():
        return {}
    return json.loads(raw.decode("utf-8"))


def emit(payload):
    sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=True).encode("ascii"))
    sys.stdout.flush()


def project_dir(event):
    return os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or os.getcwd()


def git(root, *args):
    result = subprocess.run(
        ["git", "-C", root, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.returncode, result.stdout


def shared_ref(root):
    for ref in ("origin/main", "HEAD"):
        code, _ = git(root, "rev-parse", "--verify", "--quiet", ref)
        if code == 0:
            return ref
    return None


def relative_path(root, file_path):
    if not file_path:
        return None
    absolute = os.path.abspath(os.path.join(root, file_path))
    try:
        rel = os.path.relpath(absolute, os.path.abspath(root))
    except ValueError:
        return None
    rel = rel.replace("\\", "/")
    if rel.startswith("../"):
        return None
    return rel


def new_text_of(tool_input):
    parts = []
    for key in ("content", "new_string", "new_source"):
        value = tool_input.get(key)
        if isinstance(value, str):
            parts.append(value)
    for edit in tool_input.get("edits") or []:
        if isinstance(edit, dict) and isinstance(edit.get("new_string"), str):
            parts.append(edit["new_string"])
    return "\n".join(parts)


def deny(reason):
    emit({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    })


def handle_pre_edit(event):
    root = project_dir(event)
    tool_input = event.get("tool_input") or {}
    rel = relative_path(root, tool_input.get("file_path") or tool_input.get("notebook_path"))
    if not rel:
        return

    # (1) 동결한 예전 마이그레이션 폴더
    if LEGACY_MIGRATION_RE.match(rel):
        deny(
            f"{rel}: infra/mysql/schema는 107번에서 동결했습니다. "
            f"새 스키마 변경은 {MIGRATION_DIR}에 다음 버전의 V번호__설명.sql로 추가하세요."
        )
        return

    # (1) 이미 공유된 Flyway 마이그레이션 수정 금지
    if MIGRATION_RE.match(rel):
        ref = shared_ref(root)
        if ref and git(root, "cat-file", "-e", f"{ref}:{rel}")[0] == 0:
            deny(
                f"이미 {ref}에 올라간 마이그레이션({rel})은 수정할 수 없습니다. "
                "적용된 DB의 Flyway 체크섬과 어긋나므로 변경 사항은 다음 버전의 새 마이그레이션 파일로 작성하세요."
            )
            return

    # (2) 설정 파일에 자동 DDL 금지
    if CONFIG_FILE_RE.search(rel):
        text = new_text_of(tool_input)
        match = DDL_AUTO_RE.search(text)
        if match:
            deny(
                f"{rel}에 '{match.group(0).strip()}'를 쓸 수 없습니다. "
                "Hibernate 자동 DDL은 SQL 파일과 다른 테이블 구조를 만듭니다. "
                f"스키마 변경은 {MIGRATION_DIR}의 Flyway 마이그레이션으로 하고, 일시적으로 필요하면 "
                "설정 파일 대신 실행할 때 SPRING_JPA_HIBERNATE_DDL_AUTO 환경변수를 지정하세요."
            )


def changed_entries(root, base):
    """기준 커밋과 작업 트리 사이의 변경 파일과 추적되지 않는 새 파일을 {경로: 상태(A/M/D)}로 돌려준다."""
    entries = {}
    _, out = git(root, "diff", "--name-status", "--no-renames", base, "--")
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            entries[parts[-1]] = parts[0][:1]
    _, out = git(root, "ls-files", "--others", "--exclude-standard")
    for line in out.splitlines():
        if line:
            entries[line] = "A"
    return entries


def entity_structure_changes(root, base, path, status):
    if status == "A":
        return ["새 엔티티 파일"]
    _, diff = git(root, "diff", "-U0", base, "--", path)
    changed = []
    for line in diff.splitlines():
        if line.startswith(("+++", "---")) or not line.startswith(("+", "-")):
            continue
        body = line[1:]
        if ENTITY_STRUCTURE_LINE_RE.search(body):
            changed.append(f"{line[0]} {body.strip()}")
    return changed


def handle_stop(event):
    if event.get("stop_hook_active"):
        return
    root = project_dir(event)
    base = shared_ref(root)
    if not base:
        return
    code, merge_base = git(root, "merge-base", "HEAD", base)
    if code == 0 and merge_base.strip():
        base = merge_base.strip()

    entries = changed_entries(root, base)
    problems = []

    new_migrations = [p for p, s in entries.items() if s == "A" and MIGRATION_RE.match(p)]
    modified_migrations = [
        p for p, s in entries.items()
        if (s in ("M", "D") and MIGRATION_RE.match(p)) or LEGACY_MIGRATION_RE.match(p)
    ]

    # (4-a) 엔티티 구조 변경에 마이그레이션 누락
    entity_details = []
    for path, status in sorted(entries.items()):
        if status == "D" or not ENTITY_RE.match(path):
            continue
        lines = entity_structure_changes(root, base, path, status)
        if lines:
            entity_details.append((path, lines[:3]))
    if entity_details and not new_migrations:
        detail = "; ".join(f"{os.path.basename(p)}: {' | '.join(lines)}" for p, lines in entity_details)
        problems.append(
            "엔티티 구조가 바뀌었지만 새 Flyway 마이그레이션이 없습니다 "
            f"({detail}). {MIGRATION_DIR}에 다음 버전의 V번호__설명.sql을 추가하거나, "
            "스키마 변경이 아닌 이유를 답변에 설명하세요."
        )

    # (4-b) 마이그레이션 버전 중복. Flyway는 V108과 V0108을 같은 버전으로 보므로 숫자로 비교한다.
    numbers = {}
    schema_dir = os.path.join(root, MIGRATION_DIR)
    if os.path.isdir(schema_dir):
        for name in os.listdir(schema_dir):
            match = MIGRATION_RE.match(f"{MIGRATION_DIR}/{name}")
            if match:
                numbers.setdefault(int(match.group(1)), []).append(name)
    for path in new_migrations:
        number = int(MIGRATION_RE.match(path).group(1))
        files = numbers.get(number, [])
        if len(files) > 1 and number not in KNOWN_DUPLICATE_NUMBERS:
            problems.append(f"마이그레이션 버전 {number}가 중복됩니다: {', '.join(sorted(files))}.")

    # (4-c) 공유된 마이그레이션 수정
    for path in sorted(modified_migrations):
        problems.append(
            f"이미 공유되거나 동결된 마이그레이션 {path}가 바뀌었습니다. "
            f"되돌리고 변경 사항은 {MIGRATION_DIR}에 새 버전의 마이그레이션으로 작성하세요."
        )

    if problems:
        emit({"decision": "block", "reason": "WriteLoop 스키마 가드: " + " ".join(problems)})


HANDLERS = {
    "pre-edit": handle_pre_edit,
    "stop": handle_stop,
}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    handler = HANDLERS.get(mode)
    if handler is None:
        return
    try:
        handler(read_event())
    except Exception as exc:  # 가드 자체의 오류로 작업을 막지 않는다.
        emit({"systemMessage": f"WriteLoop hook guard ({mode}) error: {exc}"})


if __name__ == "__main__":
    main()
