import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(r"C:\WriteLoop")
ENV_PATH = ROOT / ".env"
DEFAULT_OUTPUT_SQL_PATH = ROOT / "infra" / "mysql" / "schema" / "025-fill-prompt-hint-item-metadata.sql"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def query_db(env: dict[str, str], sql: str) -> list[dict]:
    command = [
        "docker",
        "run",
        "--rm",
        "mysql:8",
        "mysql",
        "-h",
        "host.docker.internal",
        "-P",
        "3306",
        "-u",
        env["SPRING_DATASOURCE_USERNAME"],
        f"-p{env['SPRING_DATASOURCE_PASSWORD']}",
        "-D",
        "writeloop",
        "--batch",
        "--raw",
        "--skip-column-names",
        "-e",
        sql,
    ]
    completed = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    output = completed.stdout
    rows: list[dict] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        rows.append(parts)
    return rows


def fetch_hint_items(env: dict[str, str]) -> list[dict[str, str]]:
    sql = r"""
SELECT
  i.id,
  h.prompt_id,
  h.hint_type,
  i.item_type,
  REPLACE(REPLACE(REPLACE(i.content, '\\', '\\\\'), '\r', ' '), '\n', ' ') AS content,
  REPLACE(REPLACE(REPLACE(p.question_en, '\\', '\\\\'), '\r', ' '), '\n', ' ') AS question_en,
  REPLACE(REPLACE(REPLACE(p.question_ko, '\\', '\\\\'), '\r', ' '), '\n', ' ') AS question_ko,
  REPLACE(REPLACE(REPLACE(p.tip, '\\', '\\\\'), '\r', ' '), '\n', ' ') AS tip,
  REPLACE(
    REPLACE(
      REPLACE(
        CONCAT(tc.name, ' - ', td.name),
        '\\',
        '\\\\'
      ),
      '\r',
      ' '
    ),
    '\n',
    ' '
  ) AS topic
FROM prompt_hint_items i
JOIN prompt_hints h ON h.id = i.hint_id
JOIN prompts p ON p.id = h.prompt_id
JOIN prompt_topic_details td ON td.id = p.topic_detail_id
JOIN prompt_topic_categories tc ON tc.id = td.category_id
WHERE (i.example_en IS NULL OR TRIM(i.example_en) = '')
   OR (i.expression_family IS NULL OR TRIM(i.expression_family) = '')
   OR (i.meaning_ko IS NULL OR TRIM(i.meaning_ko) = '')
   OR (i.usage_tip_ko IS NULL OR TRIM(i.usage_tip_ko) = '')
ORDER BY h.prompt_id, h.display_order, i.display_order, i.id
"""
    raw_rows = query_db(env, sql)
    items: list[dict[str, str]] = []
    for parts in raw_rows:
        if len(parts) != 9:
            continue
        items.append(
            {
                "id": parts[0],
                "promptId": parts[1],
                "hintType": parts[2],
                "itemType": parts[3],
                "content": parts[4],
                "questionEn": parts[5],
                "questionKo": parts[6],
                "tip": parts[7],
                "topic": parts[8],
            }
        )
    return items


def call_openai(env: dict[str, str], items: list[dict[str, str]]) -> list[dict[str, str]]:
    api_key = env["OPENAI_API_KEY"]
    model = env.get("OPENAI_MODEL", "gpt-4o")
    url = "https://api.openai.com/v1/chat/completions"

    system_prompt = """
You generate metadata for English writing prompt hint items.

Return JSON only in this shape:
{"items":[
  {
    "id":"...",
    "meaningKo":"...",
    "usageTipKo":"...",
    "exampleEn":"...",
    "expressionFamily":"..."
  }
]}

Rules:
- meaningKo and usageTipKo must be Korean.
- exampleEn must be natural English.
- expressionFamily must be ONE uppercase snake-style label using only A-Z and underscore.
- Prefer practical, learner-friendly metadata for immediate writing reuse.
- WORD: meaningKo should be a short gloss. exampleEn must use the word naturally.
- PHRASE: meaningKo should explain the phrase briefly. exampleEn must include the phrase.
- FRAME with English content: exampleEn can complete the frame into a natural sentence relevant to the prompt.
- FRAME with Korean instructional content: infer a usable English example sentence or sentence pattern relevant to the prompt.
- usageTipKo should be one short sentence about how to use the item in the current prompt.
- Do not leave any field blank.
- Keep exampleEn under 140 characters when possible.
- Keep meaningKo under 80 characters when possible.
- Keep usageTipKo under 120 characters when possible.
""".strip()

    user_prompt = json.dumps({"items": items}, ensure_ascii=False)
    payload = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        body = json.loads(response.read().decode("utf-8"))
    content = body["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    result_items = parsed["items"]
    if len(result_items) != len(items):
        raise ValueError(f"Expected {len(items)} metadata items, got {len(result_items)}")

    expected_ids = {item["id"] for item in items}
    returned_ids = {item.get("id", "").strip() for item in result_items}
    if expected_ids != returned_ids:
        missing = sorted(expected_ids - returned_ids)
        extra = sorted(returned_ids - expected_ids)
        raise ValueError(f"Mismatched ids. missing={missing[:5]} extra={extra[:5]}")

    return result_items


def sql_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''")


def normalize_metadata(item: dict[str, str]) -> dict[str, str]:
    family = item.get("expressionFamily", "GENERAL").strip().upper().replace("-", "_").replace(" ", "_")
    family = "".join(ch for ch in family if ch == "_" or ("A" <= ch <= "Z"))
    if not family:
        family = "GENERAL"
    return {
        "id": item["id"].strip(),
        "meaningKo": item.get("meaningKo", "").strip(),
        "usageTipKo": item.get("usageTipKo", "").strip(),
        "exampleEn": item.get("exampleEn", "").strip(),
        "expressionFamily": family,
    }


def build_sql(items: list[dict[str, str]]) -> str:
    lines = [
        "-- Fill prompt_hint_items metadata.",
        "-- Generated from current prompt/hint data.",
        "",
        "SET NAMES utf8mb4;",
        "",
        "START TRANSACTION;",
        "",
    ]
    for item in items:
        metadata = normalize_metadata(item)
        lines.append(
            "UPDATE prompt_hint_items "
            f"SET meaning_ko = '{sql_escape(metadata['meaningKo'])}', "
            f"usage_tip_ko = '{sql_escape(metadata['usageTipKo'])}', "
            f"example_en = '{sql_escape(metadata['exampleEn'])}', "
            f"expression_family = '{sql_escape(metadata['expressionFamily'])}' "
            f"WHERE id = '{sql_escape(metadata['id'])}';"
        )
    lines.extend(["", "COMMIT;", ""])
    return "\n".join(lines)


def main() -> None:
    env = load_env(ENV_PATH)
    output_sql_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT_SQL_PATH
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    items = fetch_hint_items(env)
    if not items:
        print("No missing prompt_hint_items metadata found.")
        return

    generated: list[dict[str, str]] = []

    for index in range(0, len(items), batch_size):
        batch = items[index:index + batch_size]
        print(f"Generating metadata {index + 1}-{index + len(batch)} / {len(items)}")
        for attempt in range(3):
            try:
                generated.extend(call_openai(env, batch))
                break
            except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, ValueError) as exc:
                if attempt == 2:
                    raise
                print(f"Retrying batch due to: {exc}")
                time.sleep(2)

    sql_text = build_sql(generated)
    output_sql_path.write_text(sql_text, encoding="utf-8")
    print(f"Wrote SQL to {output_sql_path}")


if __name__ == "__main__":
    main()
