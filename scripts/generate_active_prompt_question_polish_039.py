from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any

import pymysql


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "039-polish-active-prompt-questions.sql"
ENV_PATH = ROOT / ".env"


def parse_env_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def load_db_config(env_path: Path) -> dict[str, Any]:
    env = parse_env_file(env_path)
    match = re.match(
        r"jdbc:mysql://(?P<host>[^:/?#]+)(?::(?P<port>\d+))?/(?P<database>[^?]+)",
        env["SPRING_DATASOURCE_URL"],
    )
    if not match:
        raise RuntimeError(f"Could not parse SPRING_DATASOURCE_URL from {env_path}")
    host = "127.0.0.1" if match.group("host") == "host.docker.internal" else match.group("host")
    return {
        "host": host,
        "port": int(match.group("port") or "3306"),
        "user": env["SPRING_DATASOURCE_USERNAME"],
        "password": env["SPRING_DATASOURCE_PASSWORD"],
        "database": match.group("database"),
        "charset": "utf8mb4",
        "autocommit": False,
        "cursorclass": pymysql.cursors.DictCursor,
    }


def sql_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def normalize_question(value: str) -> str:
    return " ".join(value.strip().lower().split())


def is_plural_subject(subject: str) -> bool:
    subject_l = subject.lower().strip()
    singular_overrides = (
        "customer service",
        "shopping",
        "hot-desking",
        "public transportation",
        "financial education",
        "local volunteering",
    )
    if any(subject_l.endswith(token) for token in singular_overrides):
        return False
    return subject_l.endswith("s") and not subject_l.endswith("ss")


def front_context(context: str) -> str:
    normalized = context.strip()
    replacements = {
        "after coming back from a shopping trip": "after a shopping trip",
        "after finishing household chores": "after finishing your household chores",
    }
    normalized = replacements.get(normalized.lower(), normalized)
    return normalized[:1].upper() + normalized[1:]


def naturalize_question(question_en: str, category_name: str, detail_name: str) -> str:
    special_by_detail = {
        ("Preference", "Weekday Breakfast Menu"): "What is your favorite weekday breakfast, and why do you like it?",
    }
    special_by_question = {
        "How do you usually spend the start of your Saturday?": "How do you usually start your Saturdays?",
        "How do you usually spend your time on your commute?": "What do you usually do during your commute?",
        "How do you usually spend your time during your lunch break?": "How do you usually spend your lunch break?",
        "How do you usually spend your time before bed?": "What do you usually do before bed?",
        "How do you usually spend your time on rainy days at home?": "What do you usually do on rainy days at home?",
        "How do you usually spend your time right after waking up?": "What do you usually do right after you wake up?",
        "What do you usually do during your weekend evening, and what part of that routine helps you most?": "What do you usually do on weekend evenings, and which part of that routine helps you the most?",
        "What kind of social responsibility should successful companies have in modern society?": "What social responsibilities should successful companies have in modern society?",
    }

    if (category_name, detail_name) in special_by_detail:
        return special_by_detail[(category_name, detail_name)]
    if question_en in special_by_question:
        return special_by_question[question_en]

    updated = question_en
    updated = re.sub(
        r"^When it is (.+), what do you normally do, and why\?$",
        lambda m: f"{front_context(m.group(1))}, what do you usually do, and why?",
        updated,
    )
    updated = re.sub(
        r"^What do you usually do (.+), and what part of that routine helps you most\?$",
        r"What do you usually do \1, and which part of that routine helps you the most?",
        updated,
    )
    updated = re.sub(
        r"^Describe what you usually do (.+), and explain why that routine works well for you\.$",
        r"What do you usually do \1, and why does that routine work well for you?",
        updated,
    )
    updated = re.sub(
        r"^What is your favorite (.+), and what makes it enjoyable for you\?$",
        r"What is your favorite \1, and why do you like it?",
        updated,
    )
    updated = re.sub(
        r"^Tell me about your favorite (.+) and explain why you keep choosing it\.$",
        r"Tell me about your favorite \1 and explain why you like it so much.",
        updated,
    )
    updated = re.sub(
        r"^Describe your favorite (.+) and say what you like most about it\.$",
        r"Describe your favorite \1 and explain what you like most about it.",
        updated,
    )
    updated = re.sub(
        r"^What is one goal you have for (.+) this year, and how will you work on it\?$",
        r"What is one goal you have for \1 this year, and how will you work toward it?",
        updated,
    )
    updated = re.sub(
        r"^What is one (.+) you want to work on this year, and how will you work on it\?$",
        r"What is one \1 you want to focus on this year, and how will you work toward it?",
        updated,
    )
    updated = re.sub(
        r"^What is one (.+) you want to (reach|build|keep|finish) this year, and how will you work on it\?$",
        r"What is one \1 you want to \2 this year, and how will you work toward it?",
        updated,
    )
    updated = re.sub(
        r"^How do you see the strengths and weaknesses of (.+), and which side seems stronger to you\?$",
        r"What do you see as the strengths and weaknesses of \1, and which side seems stronger to you?",
        updated,
    )

    balance_match = re.match(
        r"^Do you think (.+) are mostly helpful or mostly harmful\? Explain both sides and your opinion\.$",
        updated,
    )
    if balance_match:
        subject = balance_match.group(1)
        verb = "are" if is_plural_subject(subject) else "is"
        updated = (
            f"Do you think {subject} {verb} more helpful or harmful overall? "
            "Explain both sides and give your opinion."
        )

    updated = re.sub(
        r"^What role should (.+) have in modern society\?$",
        r"What role should \1 play in modern society?",
        updated,
    )
    updated = re.sub(
        r"^What responsibility should (.+) have in the community today\?$",
        r"What responsibilities should \1 have in the community today?",
        updated,
    )
    updated = re.sub(
        r"^What responsibility should (.+) have in modern society\?$",
        r"What responsibilities should \1 have in modern society?",
        updated,
    )
    updated = re.sub(
        r"^Describe how your view of (.+) has changed over time and explain why\.$",
        r"How has your view of \1 changed over time, and why?",
        updated,
    )
    updated = re.sub(
        r"^Tell me about a way your opinion of (.+) has changed over time and why it changed\.$",
        r"Tell me how your opinion of \1 has changed over time and explain why.",
        updated,
    )
    updated = re.sub(
        r"^Tell me about (.+) and say why it feels meaningful to you\.$",
        r"Tell me about \1 and explain why it feels meaningful to you.",
        updated,
    )
    updated = re.sub(
        r"^Describe (.+) that stands out to you and explain why you remember it well\.$",
        r"Describe \1 that stands out to you and explain why it has stayed in your memory.",
        updated,
    )
    return updated


def fetch_active_prompts(connection: Any) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT p.id, p.question_en, p.is_active,
                   c.name AS category_name,
                   d.name AS detail_name
            FROM prompts p
            JOIN prompt_topic_details d ON d.id = p.topic_detail_id
            JOIN prompt_topic_categories c ON c.id = d.category_id
            WHERE p.is_active = 1
            ORDER BY c.display_order, d.display_order, p.display_order, p.id
            """
        )
        return list(cursor.fetchall())


def build_updates(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    updates: list[dict[str, str]] = []
    normalized_seen: dict[str, str] = {}

    for row in rows:
        updated = naturalize_question(row["question_en"], row["category_name"], row["detail_name"])
        normalized = normalize_question(updated)
        existing = normalized_seen.get(normalized)
        if existing and existing != row["id"]:
            raise ValueError(f"Duplicate polished question between {existing} and {row['id']}: {updated}")
        normalized_seen[normalized] = row["id"]

        if updated != row["question_en"]:
            updates.append(
                {
                    "id": row["id"],
                    "old_question_en": row["question_en"],
                    "new_question_en": updated,
                }
            )
    return updates


def build_sql(updates: list[dict[str, str]]) -> str:
    lines = [
        "-- Polish active prompt question English so awkward generated phrasing reads naturally.",
        "-- Generated by scripts/generate_active_prompt_question_polish_039.py",
        "",
    ]
    for row in updates:
        lines.extend(
            [
                "UPDATE prompts",
                f"SET question_en = {sql_string(row['new_question_en'])}",
                f"WHERE id = {sql_string(row['id'])}",
                f"  AND question_en = {sql_string(row['old_question_en'])};",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-path", type=Path, default=ENV_PATH)
    args = parser.parse_args()

    connection = pymysql.connect(**load_db_config(args.env_path))
    try:
        rows = fetch_active_prompts(connection)
    finally:
        connection.close()

    updates = build_updates(rows)
    sql_text = build_sql(updates)
    OUTPUT_PATH.write_text(sql_text, encoding="utf-8")

    print(f"Reviewed {len(rows)} active prompts.")
    print(f"Prepared {len(updates)} English question updates.")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
