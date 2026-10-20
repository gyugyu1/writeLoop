"""WriteLoop Claude Code hook guard.

Modes (first CLI argument):
  pre-edit   PreToolUse on Edit/Write/MultiEdit/NotebookEdit
             (1) deny edits to migration files already pushed to origin/main
             (2) deny writing ddl-auto=update/create into config files
  pre-shell  PreToolUse on Bash/PowerShell
             (3) ask for confirmation on commands that may change production;
                 deny them in modes where nobody sees the prompt (auto, bypass)
  stop       Stop
             (4) block finishing when entity schema changes lack a new migration,
                 when migration numbers collide, or when pushed migrations were modified

The hook reads the event JSON from stdin and writes a JSON decision to stdout.
Any internal error is reported as a warning and never blocks work.
"""

import json
import os
import re
import subprocess
import sys

MIGRATION_DIR = "infra/mysql/schema"
MIGRATION_RE = re.compile(r"^infra/mysql/schema/(\d{3})-[^/]+\.sql$")
# 061 was duplicated before this guard existed; keep it as a known exception.
KNOWN_DUPLICATE_NUMBERS = {"061"}

CONFIG_FILE_RE = re.compile(
    r"(^|/)(application[^/]*\.(ya?ml|properties)|docker-compose[^/]*\.ya?ml|\.env[^/]*)$",
    re.IGNORECASE,
)
DDL_AUTO_RE = re.compile(
    r"(ddl-auto\s*[:=]\s*(\$\{[^}:]*:)?\s*['\"]?(update|create|create-drop)\b"
    r"|SPRING_JPA_HIBERNATE_DDL_AUTO\s*[:=]\s*['\"]?(\$\{[^}:]*:)?\s*(update|create|create-drop)\b)",
    re.IGNORECASE,
)

PRODUCTION_MARKERS = (
    "api.writeloop.kr",
    ".rds.amazonaws.com",
    "was-key.pem",
)
PRODUCTION_CHANGE_PATTERNS = (
    (r"\b(ALTER|DROP|DELETE|UPDATE|INSERT|TRUNCATE|CREATE|RENAME|REPLACE|GRANT|REVOKE)\b", "SQL 변경 구문"),
    (r"\b(mysql|mysqlsh)\b[^|;&]*<", "SQL 파일 실행"),
    (r"\bdocker\s+compose\s+(up|down|build|restart|rm|stop|start|pull|run|create)\b", "docker compose 변경"),
    (r"\bdocker\s+(rm|rmi|stop|kill|restart|run|exec|tag|system\s+prune|volume\s+rm)\b", "docker 변경"),
    (r"\bgit\s+(pull|reset|checkout|switch|merge|rebase|clean|stash|restore|apply)\b", "서버 코드 변경"),
    (r"(^|[\s;&|'\"])(rm|mv|chmod|chown|truncate)\s", "서버 파일 변경"),
    (r"\b(systemctl|service)\s+\S+", "서비스 제어"),
    (r"\bnginx\s+-s\b", "nginx 제어"),
    (r"\bscp\b[^|;&]*\S+@\S+:", "서버로 파일 업로드"),
)

# 확인 요청(ask)이 사람에게 승인 창으로 전달되는 권한 모드
INTERACTIVE_PERMISSION_MODES = {"default", "plan", "acceptEdits"}

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


def ask(reason):
    emit({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    })


def handle_pre_edit(event):
    root = project_dir(event)
    tool_input = event.get("tool_input") or {}
    rel = relative_path(root, tool_input.get("file_path") or tool_input.get("notebook_path"))
    if not rel:
        return

    # (1) 이미 공유된 마이그레이션 수정 금지
    if MIGRATION_RE.match(rel):
        ref = shared_ref(root)
        if ref and git(root, "cat-file", "-e", f"{ref}:{rel}")[0] == 0:
            deny(
                f"이미 {ref}에 올라간 마이그레이션({rel})은 수정할 수 없습니다. "
                "운영 DB에 적용됐을 수 있으므로 변경 사항은 다음 번호의 새 마이그레이션 파일로 작성하세요."
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
                "스키마 변경은 infra/mysql/schema의 번호 SQL로 하고, 일시적으로 필요하면 "
                "설정 파일 대신 실행할 때 SPRING_JPA_HIBERNATE_DDL_AUTO 환경변수를 지정하세요."
            )


def handle_pre_shell(event):
    command = (event.get("tool_input") or {}).get("command") or ""
    lowered = command.lower()
    markers = [marker for marker in PRODUCTION_MARKERS if marker in lowered]
    if not markers:
        return

    reasons = []
    for pattern, label in PRODUCTION_CHANGE_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE) and label not in reasons:
            reasons.append(label)
    if not reasons:
        return
    summary = f"(대상: {', '.join(markers)} / 감지: {', '.join(reasons)})"
    mode = event.get("permission_mode")
    if mode in INTERACTIVE_PERMISSION_MODES:
        ask(f"운영 환경 변경 가능성이 있는 명령입니다 {summary}. 내용을 확인한 뒤 승인하세요.")
    else:
        # auto·bypassPermissions 등에서는 확인 요청이 사람에게 전달되지 않으므로 차단한다.
        deny(
            f"운영 환경 변경 가능성이 있는 명령입니다 {summary}. 현재 권한 모드({mode or '알 수 없음'})에서는 "
            "사람이 확인할 수 없으므로 실행하지 않습니다. 사용자에게 Shift+Tab으로 기본 모드로 바꾼 뒤 "
            "다시 요청해 달라고 안내하고, 승인 창에서 확인을 받아 실행하세요."
        )


def changed_entries(root, base):
    """Return {path: status} for changes between base and the working tree, plus untracked files."""
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
    modified_migrations = [p for p, s in entries.items() if s in ("M", "D") and MIGRATION_RE.match(p)]

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
            "엔티티 구조가 바뀌었지만 새 마이그레이션 SQL이 없습니다 "
            f"({detail}). infra/mysql/schema에 다음 번호의 SQL을 추가하거나, "
            "스키마 변경이 아닌 이유를 답변에 설명하세요."
        )

    # (4-b) 마이그레이션 번호 중복
    numbers = {}
    schema_dir = os.path.join(root, MIGRATION_DIR)
    if os.path.isdir(schema_dir):
        for name in os.listdir(schema_dir):
            match = MIGRATION_RE.match(f"{MIGRATION_DIR}/{name}")
            if match:
                numbers.setdefault(match.group(1), []).append(name)
    for path in new_migrations:
        number = MIGRATION_RE.match(path).group(1)
        files = numbers.get(number, [])
        if len(files) > 1 and number not in KNOWN_DUPLICATE_NUMBERS:
            problems.append(f"마이그레이션 번호 {number}가 중복됩니다: {', '.join(sorted(files))}.")

    # (4-c) 공유된 마이그레이션 수정
    for path in sorted(modified_migrations):
        problems.append(
            f"이미 공유된 마이그레이션 {path}가 수정되거나 삭제됐습니다. "
            "되돌리고 변경 사항은 새 번호의 마이그레이션으로 작성하세요."
        )

    if problems:
        emit({"decision": "block", "reason": "WriteLoop 스키마 가드: " + " ".join(problems)})


HANDLERS = {
    "pre-edit": handle_pre_edit,
    "pre-shell": handle_pre_shell,
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
