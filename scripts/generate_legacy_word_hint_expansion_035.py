from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import pymysql


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "035-expand-legacy-prompt-word-hints.sql"


def word(
    content: str,
    meaning_ko: str,
    usage_tip_ko: str,
    example_en: str,
    expression_family: str,
) -> dict[str, str]:
    return {
        "item_type": "WORD",
        "content": content,
        "meaning_ko": meaning_ko,
        "usage_tip_ko": usage_tip_ko,
        "example_en": example_en,
        "expression_family": expression_family,
    }


WORD_CANDIDATES: dict[str, list[dict[str, str]]] = {
    "ROUTINE": [
        word("habit", "습관", "루틴을 설명할 때 자연스럽게 넣어 보세요.", "It has become a steady habit for me.", "ROUTINE_VOCAB_EXPANSION"),
        word("regularly", "규칙적으로", "빈도나 반복성을 말할 때 써 보세요.", "I regularly review my schedule before bed.", "ROUTINE_VOCAB_EXPANSION"),
        word("sequence", "순서, 흐름", "루틴의 순서를 정리할 때 써 보세요.", "The sequence is simple, so I can follow it easily.", "ROUTINE_VOCAB_EXPANSION"),
        word("daily", "매일의", "매일 반복되는 루틴을 말할 때 어울립니다.", "This small daily routine helps me stay calm.", "ROUTINE_VOCAB_EXPANSION"),
        word("settled", "자리 잡힌", "익숙하게 굳어진 습관을 말할 때 써 보세요.", "My evening routine feels more settled now.", "ROUTINE_VOCAB_EXPANSION"),
        word("predictable", "예측 가능한", "규칙적이고 안정적인 흐름을 말할 때 어울립니다.", "The routine is predictable, which makes me feel comfortable.", "ROUTINE_VOCAB_EXPANSION"),
    ],
    "PREFERENCE": [
        word("appealing", "매력적인", "좋아하는 이유를 말할 때 활용해 보세요.", "The simple design is especially appealing to me.", "PREFERENCE_VOCAB_EXPANSION"),
        word("personal", "개인적인", "취향이 개인적이라는 점을 말할 때 어울립니다.", "It feels like a very personal choice for me.", "PREFERENCE_VOCAB_EXPANSION"),
        word("satisfying", "만족스러운", "기분 좋은 만족감을 표현할 때 써 보세요.", "It is satisfying after a long day.", "PREFERENCE_VOCAB_EXPANSION"),
        word("comforting", "편안함을 주는", "정서적인 안정감을 말할 때 좋습니다.", "The warm flavor feels comforting to me.", "PREFERENCE_VOCAB_EXPANSION"),
        word("enjoyable", "즐거운", "전반적으로 즐겁다는 느낌을 말할 때 어울립니다.", "It is enjoyable even when I am tired.", "PREFERENCE_VOCAB_EXPANSION"),
        word("distinctive", "특징적인", "다른 것과 구별되는 매력을 말할 때 써 보세요.", "Its distinctive style makes it easy to remember.", "PREFERENCE_VOCAB_EXPANSION"),
    ],
    "GOAL_PLAN": [
        word("milestone", "중간 목표", "장기 목표를 작은 단계로 나눌 때 써 보세요.", "I set one milestone for each month.", "GOAL_VOCAB_EXPANSION"),
        word("commitment", "꾸준한 의지", "목표를 계속 이어 가는 태도를 말할 때 좋습니다.", "It takes real commitment to keep going.", "GOAL_VOCAB_EXPANSION"),
        word("consistent", "꾸준한", "지속적으로 실천하는 계획을 말할 때 어울립니다.", "I want to stay consistent with my practice.", "GOAL_VOCAB_EXPANSION"),
        word("target", "목표", "달성하고 싶은 방향을 말할 때 활용해 보세요.", "My target is to feel more confident by winter.", "GOAL_VOCAB_EXPANSION"),
        word("discipline", "자기 관리, 규율", "스스로 실천하는 태도를 말할 때 좋습니다.", "This goal will teach me more discipline.", "GOAL_VOCAB_EXPANSION"),
        word("progress", "진전", "조금씩 나아지는 과정을 말할 때 어울립니다.", "I want to see clear progress every month.", "GOAL_VOCAB_EXPANSION"),
    ],
    "PROBLEM_SOLUTION": [
        word("obstacle", "장애물", "문제를 한 단어로 정리할 때 써 보세요.", "That obstacle appears when I feel rushed.", "PROBLEM_VOCAB_EXPANSION"),
        word("approach", "접근 방식", "해결 방법을 말할 때 활용해 보세요.", "My usual approach is to break the task into parts.", "PROBLEM_VOCAB_EXPANSION"),
        word("frustrating", "답답한", "문제가 주는 감정을 표현할 때 좋습니다.", "It can be frustrating at first.", "PROBLEM_VOCAB_EXPANSION"),
        word("strategy", "전략", "문제를 풀기 위한 계획을 말할 때 어울립니다.", "This strategy helps me stay focused.", "PROBLEM_VOCAB_EXPANSION"),
        word("manageable", "감당 가능한", "문제가 통제 가능해지는 느낌을 말할 때 좋습니다.", "The problem feels more manageable after I make a list.", "PROBLEM_VOCAB_EXPANSION"),
        word("pressure", "압박감", "부담이나 긴장을 말할 때 활용해 보세요.", "Too much pressure makes the problem worse.", "PROBLEM_VOCAB_EXPANSION"),
    ],
    "BALANCED_OPINION": [
        word("advantage", "장점", "긍정적인 면을 정리할 때 써 보세요.", "One clear advantage is convenience.", "BALANCE_VOCAB_EXPANSION"),
        word("trade-off", "상충 관계", "좋은 점과 아쉬운 점이 함께 있을 때 어울립니다.", "There is always some trade-off in daily use.", "BALANCE_VOCAB_EXPANSION"),
        word("concern", "우려", "부정적인 면을 부드럽게 말할 때 좋습니다.", "A common concern is overdependence.", "BALANCE_VOCAB_EXPANSION"),
        word("balanced", "균형 잡힌", "찬반을 고르게 보는 태도를 말할 때 활용해 보세요.", "We need a balanced view of the issue.", "BALANCE_VOCAB_EXPANSION"),
        word("drawback", "단점", "아쉬운 점을 말할 때 잘 어울립니다.", "One drawback is that it can cost more.", "BALANCE_VOCAB_EXPANSION"),
        word("beneficial", "유익한", "긍정적 효과를 요약할 때 써 보세요.", "It can be beneficial in the right situation.", "BALANCE_VOCAB_EXPANSION"),
    ],
    "OPINION_REASON": [
        word("society", "사회", "사회적 맥락을 말할 때 활용해 보세요.", "It matters for society as a whole.", "OPINION_VOCAB_EXPANSION"),
        word("impact", "영향", "결과나 파급효과를 말할 때 어울립니다.", "Its impact can be stronger than people expect.", "OPINION_VOCAB_EXPANSION"),
        word("necessary", "필요한", "필요성이나 당위성을 말할 때 좋습니다.", "I think this support is necessary.", "OPINION_VOCAB_EXPANSION"),
        word("responsibility", "책임", "해야 할 역할을 말할 때 써 보세요.", "They have a responsibility to act carefully.", "OPINION_VOCAB_EXPANSION"),
        word("support", "지원", "도움이나 뒷받침을 말할 때 활용해 보세요.", "Public support can make a real difference.", "OPINION_VOCAB_EXPANSION"),
        word("practical", "실질적인", "현실적인 도움을 강조할 때 어울립니다.", "We need practical solutions, not only slogans.", "OPINION_VOCAB_EXPANSION"),
    ],
    "CHANGE_REFLECTION": [
        word("realization", "깨달음", "생각이 바뀌게 된 계기를 말할 때 써 보세요.", "That experience led to an important realization.", "REFLECTION_VOCAB_EXPANSION"),
        word("perspective", "관점", "예전과 지금의 시각 차이를 말할 때 어울립니다.", "My perspective is much wider now.", "REFLECTION_VOCAB_EXPANSION"),
        word("shift", "변화", "생각이 이동한 흐름을 간단히 표현할 때 좋습니다.", "There was a clear shift in my thinking.", "REFLECTION_VOCAB_EXPANSION"),
        word("mature", "성숙해지다", "생각이 깊어졌다는 뜻으로 활용할 수 있습니다.", "As I grew older, my view became more mature.", "REFLECTION_VOCAB_EXPANSION"),
        word("reconsider", "다시 생각하다", "기존 생각을 돌아봤다는 뜻으로 좋습니다.", "That moment made me reconsider my old belief.", "REFLECTION_VOCAB_EXPANSION"),
        word("insight", "통찰", "새롭게 보게 된 점을 말할 때 활용해 보세요.", "The experience gave me useful insight.", "REFLECTION_VOCAB_EXPANSION"),
    ],
    "GENERAL_DESCRIPTION": [
        word("memorable", "기억에 남는", "인상 깊은 대상을 소개할 때 어울립니다.", "It is memorable because of its atmosphere.", "GENERAL_VOCAB_EXPANSION"),
        word("familiar", "익숙한", "편안하고 가까운 느낌을 말할 때 좋습니다.", "The place feels familiar to me.", "GENERAL_VOCAB_EXPANSION"),
        word("meaningful", "의미 있는", "개인적인 의미를 강조할 때 활용해 보세요.", "It has become meaningful in my daily life.", "GENERAL_VOCAB_EXPANSION"),
        word("reliable", "믿을 만한", "꾸준히 도움이 되는 대상을 말할 때 좋습니다.", "It is reliable when I need quick help.", "GENERAL_VOCAB_EXPANSION"),
        word("unique", "독특한", "다른 점이 돋보일 때 활용해 보세요.", "Its unique style caught my attention right away.", "GENERAL_VOCAB_EXPANSION"),
        word("welcoming", "친근한", "분위기나 인상을 묘사할 때 잘 어울립니다.", "The space feels welcoming and calm.", "GENERAL_VOCAB_EXPANSION"),
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
                "existing_contents": [],
                "existing_content_set": set(),
                "max_display_order": 0,
            },
        )
        if item_content is not None:
            record["existing_contents"].append(item_content)
            record["existing_content_set"].add(normalize_text(item_content))
            record["max_display_order"] = max(record["max_display_order"], int(item_display_order or 0))

    targets = list(grouped.values())
    targets.sort(key=lambda item: (item["prompt_display_order"], item["prompt_id"]))
    return targets


def choose_extra_words(target: dict[str, Any]) -> list[dict[str, str]]:
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
        if len(chosen) == 3:
            return chosen

    raise ValueError(
        f"Could not select 3 unique extra words for {target['prompt_id']} ({target['hint_id']}) with mode {answer_mode}"
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


def values_insert(
    table: str,
    columns: list[str],
    rows: list[tuple[Any, ...]],
    update_columns: list[str],
    chunk_size: int = 250,
) -> list[str]:
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
        "-- 035-expand-legacy-prompt-word-hints.sql",
        "-- Adds three extra VOCAB_WORD items to each legacy prompt so every legacy word-hint set reaches eight items.",
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


def validate_generated_sql(
    connection: pymysql.connections.Connection,
    targets: list[dict[str, Any]],
    records: list[dict[str, Any]],
    sql_text: str,
) -> None:
    sql_without_comments = "\n".join(
        line for line in sql_text.splitlines() if not line.lstrip().startswith("--")
    )
    statements = [statement.strip() for statement in sql_without_comments.split(";") if statement.strip()]
    hint_ids = [target["hint_id"] for target in targets]
    record_ids = [record["id"] for record in records]

    if len(records) != len(targets) * 3:
        raise ValueError(f"Expected {len(targets) * 3} new items, got {len(records)}")

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
                    GROUP BY hint_id
                    HAVING COUNT(*) = 8
                ) t
                """,
                hint_ids,
            )
            complete_hint_count = cursor.fetchone()[0]
            if complete_hint_count != len(hint_ids):
                raise ValueError(
                    f"Validation failed: expected {len(hint_ids)} vocab hints to reach 8 items, found {complete_hint_count}"
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
        print(
            f"Generated {len(records)} new word hint items for {len(targets)} legacy vocab hint groups."
        )
        print(f"Wrote {OUTPUT_PATH}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
