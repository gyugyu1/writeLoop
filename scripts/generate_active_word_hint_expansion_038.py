from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pymysql


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "038-expand-active-prompt-word-hints.sql"
TARGET_WORD_COUNT = 11


def word(content: str, meaning_ko: str, usage_tip_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {
        "item_type": "WORD",
        "content": content,
        "meaning_ko": meaning_ko,
        "usage_tip_ko": usage_tip_ko,
        "example_en": example_en,
        "expression_family": family,
    }


WORD_CANDIDATES: dict[str, list[dict[str, str]]] = {
    "ROUTINE": [
        word("rhythm", "리듬", "루틴의 흐름을 말할 때 자연스럽게 붙여 보세요.", "The rhythm of the routine feels steady now.", "ACTIVE_VOCAB_038"),
        word("reset", "리셋", "루틴이 기분을 다시 정리해 준다는 뜻으로 써 보세요.", "This short habit gives me a quick reset.", "ACTIVE_VOCAB_038"),
        word("familiar", "익숙한", "익숙해서 편한 흐름을 표현할 때 좋아요.", "The familiar pattern helps me relax.", "ACTIVE_VOCAB_038"),
        word("deliberate", "의식적인", "의도적으로 하는 행동을 말할 때 써 보세요.", "It is a deliberate part of my evening routine.", "ACTIVE_VOCAB_038"),
        word("stable", "안정적인", "루틴이 흔들리지 않는 느낌을 말할 때 좋아요.", "A stable routine helps me focus better.", "ACTIVE_VOCAB_038"),
        word("repeat", "반복하다", "자주 되풀이되는 행동을 표현할 때 써 보세요.", "I repeat the same small steps every day.", "ACTIVE_VOCAB_038"),
        word("practical", "실용적인", "실제로 도움이 되는 루틴임을 강조할 때 좋아요.", "The routine is practical and easy to keep.", "ACTIVE_VOCAB_038"),
        word("steady", "꾸준한", "꾸준한 흐름을 말할 때 잘 어울립니다.", "A steady routine makes me feel organized.", "ACTIVE_VOCAB_038"),
    ],
    "PREFERENCE": [
        word("subtle", "은은한", "과하지 않은 매력을 말할 때 써 보세요.", "I like its subtle flavor the most.", "ACTIVE_VOCAB_038"),
        word("cozy", "아늑한", "편안한 느낌을 말할 때 잘 어울립니다.", "It feels cozy and easy to enjoy.", "ACTIVE_VOCAB_038"),
        word("refined", "세련된", "깔끔하고 정돈된 인상을 말할 때 좋아요.", "The design feels simple but refined.", "ACTIVE_VOCAB_038"),
        word("polished", "정돈된", "완성도 있는 느낌을 표현할 때 써 보세요.", "It has a polished look that I like.", "ACTIVE_VOCAB_038"),
        word("timeless", "질리지 않는", "오래 좋아할 수 있는 취향을 말할 때 좋아요.", "It has a timeless charm for me.", "ACTIVE_VOCAB_038"),
        word("versatile", "활용도 높은", "여러 상황에 잘 맞는다는 뜻으로 써 보세요.", "It is versatile enough for many situations.", "ACTIVE_VOCAB_038"),
        word("refreshing", "상쾌한", "기분이 산뜻해지는 이유를 말할 때 좋아요.", "The taste feels refreshing after lunch.", "ACTIVE_VOCAB_038"),
        word("balanced", "균형 잡힌", "무난하고 잘 맞는 느낌을 표현할 때 써 보세요.", "It feels balanced and easy to enjoy.", "ACTIVE_VOCAB_038"),
    ],
    "GOAL_PLAN": [
        word("benchmark", "기준점", "중간 목표나 점검 기준을 말할 때 써 보세요.", "A clear benchmark keeps me motivated.", "ACTIVE_VOCAB_038"),
        word("momentum", "추진력", "계속 이어 가는 힘을 말할 때 좋아요.", "Small wins help me build momentum.", "ACTIVE_VOCAB_038"),
        word("realistic", "현실적인", "무리하지 않은 목표를 강조할 때 써 보세요.", "I want to keep the goal realistic.", "ACTIVE_VOCAB_038"),
        word("checkpoint", "점검 지점", "중간 점검 계획을 말할 때 좋아요.", "I plan to set one checkpoint each month.", "ACTIVE_VOCAB_038"),
        word("measurable", "측정 가능한", "진행 정도를 확인할 수 있는 목표를 말할 때 써 보세요.", "I want the goal to feel measurable.", "ACTIVE_VOCAB_038"),
        word("sustainable", "지속 가능한", "오래 유지할 수 있는 계획을 말할 때 좋아요.", "The routine needs to be sustainable for me.", "ACTIVE_VOCAB_038"),
        word("intention", "의도", "왜 이 목표를 세우는지 강조할 때 써 보세요.", "My intention is to build a healthier pattern.", "ACTIVE_VOCAB_038"),
        word("follow-through", "실행력", "계획을 끝까지 이어 가는 힘을 말할 때 좋아요.", "The hardest part is follow-through after a busy week.", "ACTIVE_VOCAB_038"),
    ],
    "PROBLEM_SOLUTION": [
        word("trigger", "계기", "문제가 시작되는 순간을 말할 때 써 보세요.", "I notice the trigger more quickly now.", "ACTIVE_VOCAB_038"),
        word("workaround", "우회 방법", "임시로라도 문제를 푸는 방식을 말할 때 좋아요.", "A small workaround helps me move forward.", "ACTIVE_VOCAB_038"),
        word("clarify", "분명히 하다", "문제를 더 명확히 보는 과정을 말할 때 써 보세요.", "I try to clarify the real issue first.", "ACTIVE_VOCAB_038"),
        word("backup", "대안", "예비 계획을 말할 때 잘 어울립니다.", "I keep a backup plan in mind.", "ACTIVE_VOCAB_038"),
        word("resilient", "회복력 있는", "다시 버티는 힘을 말할 때 좋아요.", "I want to become more resilient in those moments.", "ACTIVE_VOCAB_038"),
        word("simplify", "단순화하다", "문제를 작게 나누는 방법을 말할 때 써 보세요.", "I simplify the task before I start again.", "ACTIVE_VOCAB_038"),
        word("pattern", "패턴", "문제가 반복되는 양상을 말할 때 좋아요.", "I can see the same pattern more clearly now.", "ACTIVE_VOCAB_038"),
        word("response", "대응", "문제에 대한 반응이나 대처를 말할 때 써 보세요.", "My response is calmer than before.", "ACTIVE_VOCAB_038"),
    ],
    "BALANCED_OPINION": [
        word("nuance", "미묘한 차이", "단순한 찬반이 아니라는 뜻을 말할 때 좋아요.", "There is more nuance to the issue than it seems.", "ACTIVE_VOCAB_038"),
        word("limitation", "한계", "단점이나 제한점을 말할 때 써 보세요.", "A clear limitation is the extra cost.", "ACTIVE_VOCAB_038"),
        word("upside", "좋은 면", "장점을 자연스럽게 말할 때 좋아요.", "One upside is that it saves time.", "ACTIVE_VOCAB_038"),
        word("downside", "아쉬운 면", "단점을 짧게 말할 때 써 보세요.", "The downside is that it can create dependence.", "ACTIVE_VOCAB_038"),
        word("consequence", "결과", "장기적인 영향이나 결과를 말할 때 좋아요.", "The consequence may be bigger over time.", "ACTIVE_VOCAB_038"),
        word("tension", "긴장 관계", "좋은 점과 나쁜 점이 부딪히는 느낌을 말할 때 써 보세요.", "There is tension between speed and quality here.", "ACTIVE_VOCAB_038"),
        word("moderate", "절제된", "극단적이지 않은 관점을 말할 때 좋아요.", "A moderate view makes more sense to me.", "ACTIVE_VOCAB_038"),
        word("complex", "복합적인", "한쪽으로만 보기 어려운 주제를 말할 때 써 보세요.", "It is a complex issue in daily life.", "ACTIVE_VOCAB_038"),
    ],
    "OPINION_REASON": [
        word("accountability", "책임성", "역할과 책임을 더 분명히 말할 때 좋아요.", "Public accountability is important here.", "ACTIVE_VOCAB_038"),
        word("inclusion", "포용", "더 많은 사람을 포함하는 방향을 말할 때 써 보세요.", "Inclusion should be part of the goal.", "ACTIVE_VOCAB_038"),
        word("transparency", "투명성", "운영 방식이 분명해야 한다는 뜻을 말할 때 좋아요.", "Transparency builds trust over time.", "ACTIVE_VOCAB_038"),
        word("protection", "보호", "사람들을 지키는 역할을 말할 때 써 보세요.", "Protection should come before convenience.", "ACTIVE_VOCAB_038"),
        word("cooperation", "협력", "여러 주체가 함께 움직여야 한다는 뜻을 말할 때 좋아요.", "Real change needs cooperation.", "ACTIVE_VOCAB_038"),
        word("outreach", "확장 지원", "더 넓게 닿아야 한다는 뜻을 말할 때 써 보세요.", "Better outreach would help more people.", "ACTIVE_VOCAB_038"),
        word("stability", "안정성", "지속적이고 안정적인 지원을 말할 때 좋아요.", "Stability matters in public support.", "ACTIVE_VOCAB_038"),
        word("constructive", "건설적인", "실질적인 도움을 주는 방향을 말할 때 써 보세요.", "We need a more constructive approach.", "ACTIVE_VOCAB_038"),
    ],
    "CHANGE_REFLECTION": [
        word("hindsight", "돌이켜보는 시선", "지나고 나서 보이는 의미를 말할 때 좋아요.", "In hindsight, I was too strict with myself.", "ACTIVE_VOCAB_038"),
        word("gradual", "점진적인", "생각이 천천히 바뀌었다는 뜻을 말할 때 써 보세요.", "The change was gradual, not sudden.", "ACTIVE_VOCAB_038"),
        word("evolving", "변해 가는", "생각이 계속 달라지는 과정을 말할 때 좋아요.", "My view is still evolving now.", "ACTIVE_VOCAB_038"),
        word("contrast", "대조", "과거와 현재를 대비할 때 써 보세요.", "The contrast is clearer to me now.", "ACTIVE_VOCAB_038"),
        word("maturity", "성숙함", "더 성숙해진 관점을 말할 때 좋아요.", "Maturity changed the way I saw it.", "ACTIVE_VOCAB_038"),
        word("patience", "인내", "조금 더 기다릴 수 있게 된 변화를 말할 때 써 보세요.", "Now I have more patience with the process.", "ACTIVE_VOCAB_038"),
        word("shifted", "달라진", "관점이 이동했다는 뜻을 짧게 말할 때 좋아요.", "My attitude shifted after that experience.", "ACTIVE_VOCAB_038"),
        word("reflective", "성찰적인", "더 깊이 생각하게 된 상태를 말할 때 써 보세요.", "I have become more reflective over time.", "ACTIVE_VOCAB_038"),
    ],
    "GENERAL_DESCRIPTION": [
        word("vivid", "생생한", "인상이 또렷하다는 뜻을 말할 때 좋아요.", "The memory still feels vivid to me.", "ACTIVE_VOCAB_038"),
        word("charming", "매력적인", "작지만 분명한 매력을 말할 때 써 보세요.", "It has a quiet but charming side.", "ACTIVE_VOCAB_038"),
        word("everyday", "일상의", "평범하지만 자주 만나는 대상을 말할 때 좋아요.", "It is part of my everyday life now.", "ACTIVE_VOCAB_038"),
        word("tucked-away", "숨어 있는 듯한", "작고 아는 사람만 아는 느낌을 말할 때 써 보세요.", "It feels like a tucked-away place.", "ACTIVE_VOCAB_038"),
        word("well-loved", "애정이 쌓인", "오래 아끼는 대상을 말할 때 좋아요.", "It feels like a well-loved part of my routine.", "ACTIVE_VOCAB_038"),
        word("thoughtful", "세심한", "섬세한 디테일을 설명할 때 써 보세요.", "There is something thoughtful about the design.", "ACTIVE_VOCAB_038"),
        word("ordinary", "평범한", "크게 특별하지 않아도 의미 있는 대상을 말할 때 좋아요.", "Even something ordinary can matter a lot.", "ACTIVE_VOCAB_038"),
        word("treasured", "소중히 여기는", "개인적으로 아끼는 대상을 말할 때 써 보세요.", "It is a treasured part of my day.", "ACTIVE_VOCAB_038"),
    ],
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def connect_db() -> pymysql.connections.Connection:
    env = load_env(ENV_PATH)
    jdbc_url = env["SPRING_DATASOURCE_URL"]
    match = re.match(r"jdbc:mysql://([^/:]+)(?::(\d+))?/([^?]+)", jdbc_url)
    if not match:
        raise ValueError(f"Unsupported datasource URL: {jdbc_url}")
    host = match.group(1)
    if host == "host.docker.internal":
        host = "127.0.0.1"
    port = int(match.group(2) or 3306)
    database = match.group(3)
    return pymysql.connect(
        host=host,
        port=port,
        user=env["SPRING_DATASOURCE_USERNAME"],
        password=env["SPRING_DATASOURCE_PASSWORD"],
        database=database,
        charset="utf8mb4",
        autocommit=False,
    )


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).lower()


def fetch_vocab_targets(connection: pymysql.connections.Connection) -> list[dict[str, Any]]:
    sql = """
        SELECT
            p.id AS prompt_id,
            p.display_order AS prompt_display_order,
            h.id AS hint_id,
            am.code AS answer_mode,
            i.content AS item_content,
            i.display_order AS item_display_order
        FROM prompts p
        JOIN prompt_hints h
          ON h.prompt_id = p.id
         AND h.hint_type = 'VOCAB_WORD'
         AND h.is_active = 1
        JOIN prompt_task_profiles tp
          ON tp.prompt_id = p.id
         AND tp.is_active = 1
        JOIN prompt_answer_modes am
          ON am.id = tp.answer_mode_id
        LEFT JOIN prompt_hint_items i
          ON i.hint_id = h.id
         AND i.is_active = 1
        WHERE p.is_active = 1
        ORDER BY p.display_order, p.id, i.display_order, i.id
    """
    with connection.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()

    grouped: dict[str, dict[str, Any]] = {}
    for prompt_id, prompt_display_order, hint_id, answer_mode, item_content, item_display_order in rows:
        record = grouped.setdefault(
            hint_id,
            {
                "prompt_id": prompt_id,
                "prompt_display_order": prompt_display_order,
                "hint_id": hint_id,
                "answer_mode": answer_mode,
                "existing_content_set": set(),
                "current_count": 0,
                "max_display_order": 0,
            },
        )
        if item_content is not None:
            record["existing_content_set"].add(normalize_text(item_content))
            record["current_count"] += 1
            record["max_display_order"] = max(record["max_display_order"], int(item_display_order or 0))

    targets = list(grouped.values())
    targets.sort(key=lambda item: (item["prompt_display_order"], item["prompt_id"]))
    return targets


def choose_extra_words(target: dict[str, Any]) -> list[dict[str, str]]:
    needed = TARGET_WORD_COUNT - int(target["current_count"])
    if needed <= 0:
        return []

    answer_mode = target["answer_mode"]
    candidates = WORD_CANDIDATES.get(answer_mode)
    if not candidates:
        raise ValueError(f"No word candidates configured for answer mode: {answer_mode}")

    existing = set(target["existing_content_set"])
    chosen: list[dict[str, str]] = []
    used: set[str] = set()
    for candidate in candidates:
        normalized = normalize_text(candidate["content"])
        if normalized in existing or normalized in used:
            continue
        chosen.append(candidate)
        used.add(normalized)
        if len(chosen) == needed:
            return chosen

    raise ValueError(
        f"Could not select {needed} unique extra words for {target['prompt_id']} ({target['hint_id']})"
    )


def build_records(targets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for target in targets:
        extra_words = choose_extra_words(target)
        next_display_order = int(target["max_display_order"]) + 1
        for offset, item in enumerate(extra_words):
            display_order = next_display_order + offset
            records.append(
                {
                    "id": f"{target['hint_id']}-item-{display_order}",
                    "hint_id": target["hint_id"],
                    "item_type": item["item_type"],
                    "content": item["content"],
                    "meaning_ko": item["meaning_ko"],
                    "usage_tip_ko": item["usage_tip_ko"],
                    "example_en": item["example_en"],
                    "expression_family": item["expression_family"],
                    "display_order": display_order,
                    "is_active": 1,
                }
            )
    return records


def escape_sql(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{text}'"


def values_insert(table: str, columns: list[str], rows: list[tuple[Any, ...]], update_columns: list[str], chunk_size: int = 250) -> list[str]:
    statements: list[str] = []
    for index in range(0, len(rows), chunk_size):
        chunk = rows[index:index + chunk_size]
        values_sql = ",\n".join(
            f"({', '.join(escape_sql(value) for value in row)})"
            for row in chunk
        )
        updates = ", ".join(f"{column}=VALUES({column})" for column in update_columns)
        statements.append(
            f"INSERT INTO {table} ({', '.join(columns)})\nVALUES\n{values_sql}\nON DUPLICATE KEY UPDATE {updates};"
        )
    return statements


def build_sql(records: list[dict[str, Any]]) -> str:
    header = [
        "-- 038-expand-active-prompt-word-hints.sql",
        "-- Adds extra VOCAB_WORD items so every active prompt word-hint set reaches eleven items.",
        "",
    ]
    statements = values_insert(
        "prompt_hint_items",
        [
            "id",
            "hint_id",
            "item_type",
            "content",
            "meaning_ko",
            "usage_tip_ko",
            "example_en",
            "expression_family",
            "display_order",
            "is_active",
        ],
        [
            (
                row["id"],
                row["hint_id"],
                row["item_type"],
                row["content"],
                row["meaning_ko"],
                row["usage_tip_ko"],
                row["example_en"],
                row["expression_family"],
                row["display_order"],
                row["is_active"],
            )
            for row in records
        ],
        [
            "item_type",
            "content",
            "meaning_ko",
            "usage_tip_ko",
            "example_en",
            "expression_family",
            "display_order",
            "is_active",
        ],
        chunk_size=250,
    )
    return "\n\n".join(header + statements) + "\n"


def validate_generated_sql(connection: pymysql.connections.Connection, targets: list[dict[str, Any]], records: list[dict[str, Any]], sql_text: str) -> None:
    sql_without_comments = "\n".join(
        line for line in sql_text.splitlines() if not line.lstrip().startswith("--")
    )
    statements = [statement.strip() for statement in sql_without_comments.split(";") if statement.strip()]
    hint_ids = [target["hint_id"] for target in targets]
    record_ids = [record["id"] for record in records]

    if len(targets) != 300:
        raise ValueError(f"Expected 300 active vocab hint groups, got {len(targets)}")
    if len(records) != 900:
        raise ValueError(f"Expected 900 new items, got {len(records)}")

    with connection.cursor() as cursor:
        try:
            for statement in statements:
                cursor.execute(statement)

            cursor.execute(
                f"SELECT COUNT(*) FROM prompt_hint_items WHERE id IN ({', '.join(['%s'] * len(record_ids))})",
                record_ids,
            )
            inserted_count = cursor.fetchone()[0]
            if inserted_count != len(record_ids):
                raise ValueError(f"Validation failed: expected {len(record_ids)} inserted items, found {inserted_count}")

            cursor.execute(
                f"""
                SELECT COUNT(*)
                FROM (
                    SELECT hint_id
                    FROM prompt_hint_items
                    WHERE hint_id IN ({', '.join(['%s'] * len(hint_ids))})
                      AND is_active = 1
                    GROUP BY hint_id
                    HAVING COUNT(*) = {TARGET_WORD_COUNT}
                ) t
                """,
                hint_ids,
            )
            complete_hint_count = cursor.fetchone()[0]
            if complete_hint_count != len(hint_ids):
                raise ValueError(
                    f"Validation failed: expected {len(hint_ids)} vocab hints to reach {TARGET_WORD_COUNT} items, found {complete_hint_count}"
                )
        finally:
            connection.rollback()


def main() -> None:
    connection = connect_db()
    try:
        targets = fetch_vocab_targets(connection)
        records = build_records(targets)
        sql_text = build_sql(records)
        OUTPUT_PATH.write_text(sql_text, encoding="utf-8")
        validate_generated_sql(connection, targets, records, sql_text)
        print(f"Generated {len(records)} new word hint items for {len(targets)} active vocab hint groups.")
        print(f"Wrote {OUTPUT_PATH}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
