from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import pymysql


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_PATH = ROOT / ".env"
DEFAULT_OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "044-refresh-active-mixed-word-hints.sql"
DEFAULT_PREVIEW_PATH = ROOT / "tmp" / "044-mixed-word-preview.json"

TARGET_ITEM_COUNT = 10
GENERIC_FAMILIES = {
    "ACTIVE_VOCAB_038",
    "ROUTINE_BANK",
    "PREFERENCE_BANK",
    "GOAL_BANK",
    "PROBLEM_BANK",
    "BALANCE_BANK",
    "OPINION_BANK",
    "REFLECTION_BANK",
    "GENERAL_BANK",
    "ROUTINE_BONUS",
    "PREFERENCE_BONUS",
    "GOAL_BONUS",
    "PROBLEM_BONUS",
    "BALANCE_BONUS",
    "OPINION_BONUS",
    "REFLECTION_BONUS",
    "GENERAL_BONUS",
    "ROUTINE_VOCAB_EXPANSION",
    "PREFERENCE_VOCAB_EXPANSION",
    "GOAL_VOCAB_EXPANSION",
    "PROBLEM_VOCAB_EXPANSION",
    "BALANCE_VOCAB_EXPANSION",
    "OPINION_VOCAB_EXPANSION",
    "REFLECTION_VOCAB_EXPANSION",
    "GENERAL_VOCAB_EXPANSION",
}
GENERIC_CONTENTS = {
    "habit",
    "regularly",
    "sequence",
    "rhythm",
    "reset",
    "familiar",
    "appealing",
    "personal",
    "satisfying",
    "subtle",
    "refined",
    "polished",
    "vivid",
    "charming",
    "everyday",
    "meaningful",
    "thing",
    "things",
    "useful",
    "before",
    "now",
    "nowadays",
    "gradually",
    "home",
    "indoors",
    "morning",
    "afternoon",
    "evening",
    "night",
    "weekday",
    "weekdays",
    "weekend",
    "weekends",
    "saturday",
    "sundays",
    "sunday",
    "issue",
    "issues",
    "aspect",
    "aspects",
    "factor",
    "factors",
    "change",
    "changes",
    "problem",
    "problems",
    "solution",
    "solutions",
    "way",
    "ways",
    "important",
    "helpful",
    "positive",
    "negative",
    "impact",
    "role",
    "roles",
    "responsibility",
    "responsibilities",
    "benefit",
    "benefits",
    "drawback",
    "drawbacks",
    "advantage",
    "advantages",
    "people",
    "society",
}
ACTION_PHRASE_PREFIXES = (
    "go ",
    "get ",
    "take ",
    "make ",
    "watch ",
    "stay ",
    "work ",
    "meet ",
    "grab ",
    "wake ",
    "tidy ",
    "clean ",
    "cook ",
    "scroll ",
    "read ",
    "write ",
    "listen ",
    "talk ",
    "hang ",
    "ask ",
    "deal ",
)
GENERATION_FAMILY = "DIRECT_REFRESH_044"
CATEGORY_MIX_POLICIES: dict[str, dict[str, Any]] = {
    "ROUTINE": {
        "mix_policy": "focus/context 3 + concrete detail 7",
        "avoid_words": [
            "habit",
            "routine",
            "regularly",
            "sequence",
            "rhythm",
            "reset",
            "familiar",
            "daily",
        ],
        "notes": [
            "favor objects, time, place, and routine details over meta routine words",
            "activity chunks should stay in VOCAB_PHRASE, not VOCAB_WORD",
        ],
    },
    "PREFERENCE": {
        "mix_policy": "evaluation/sensory 4 + target detail 6",
        "avoid_words": [
            "good",
            "nice",
            "best",
            "favorite",
            "interesting",
            "great",
            "thing",
            "kind",
        ],
        "notes": [
            "mix why-it-is-good words with target-specific detail words",
            "avoid generic praise that fits any preference prompt",
        ],
    },
    "GOAL_PLAN": {
        "mix_policy": "goal/execution frame 4 + concrete action/measurement 6",
        "avoid_words": [
            "better",
            "future",
            "success",
            "important",
            "helpful",
            "improve",
            "change",
            "result",
            "goal",
        ],
        "notes": [
            "show target, execution, and measurement together",
            "concept words are allowed, but only when anchored to the goal itself",
        ],
    },
    "PROBLEM_SOLVING": {
        "mix_policy": "issue/cause 4 + concrete context/tool/detail 6",
        "avoid_words": [
            "solution",
            "strategy",
            "approach",
            "method",
            "issue",
            "situation",
            "problem",
        ],
        "notes": [
            "mix obstacle words with concrete scene nouns",
            "avoid generic problem-solving jargon unless the question directly needs it",
        ],
    },
    "BALANCED_OPINION": {
        "mix_policy": "issue axis 5 + concrete system/user detail 5",
        "avoid_words": [
            "benefit",
            "drawback",
            "positive",
            "negative",
            "issue",
            "aspect",
            "change",
            "impact",
        ],
        "notes": [
            "include both pro-side and con-side issue words",
            "pair the debate axis with device, service, or user-context nouns",
        ],
    },
    "OPINION_REASON": {
        "mix_policy": "public-value issue 5 + stakeholder/resource detail 5",
        "avoid_words": [
            "role",
            "responsibility",
            "society",
            "people",
            "important",
            "service",
            "change",
        ],
        "notes": [
            "favor public-value nouns plus concrete stakeholder or resource nouns",
            "avoid prompt-echo words unless anchored as a more specific compound noun",
        ],
    },
    "CHANGE_REFLECTION": {
        "mix_policy": "perspective/shift 3 + topic direct 5 + trigger/result 2",
        "avoid_words": [
            "change",
            "thing",
            "stuff",
            "experience",
            "growth",
            "issue",
            "reason",
            "important",
        ],
        "notes": [
            "keep concept words limited and make most items topic-specific",
            "show what changed, what caused it, and what the result was",
        ],
    },
    "GENERAL": {
        "mix_policy": "meaning/impression 2 + target/sensory/action detail 6 + usage/memory 2",
        "avoid_words": [
            "nice",
            "good",
            "special",
            "interesting",
            "meaningful",
            "useful",
            "thing",
            "object",
        ],
        "notes": [
            "describe the actual object, place, sound, or memory first",
            "use only a small number of impression words and anchor them to concrete details",
        ],
    },
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def connect_db(env: dict[str, str]) -> pymysql.connections.Connection:
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


def is_direct_existing_word(item: dict[str, Any]) -> bool:
    family = (item.get("expression_family") or "").strip()
    content = normalize_text(item.get("content"))
    if family in GENERIC_FAMILIES:
        return False
    if content in GENERIC_CONTENTS:
        return False
    if content.startswith(ACTION_PHRASE_PREFIXES):
        return False
    return True


def get_category_mix_policy(category_name: str) -> dict[str, Any]:
    normalized = re.sub(r"[^a-z0-9]+", "_", normalize_text(category_name)).strip("_").upper()
    return CATEGORY_MIX_POLICIES.get(
        normalized,
        {
            "mix_policy": "focus word 3 + concrete detail 7",
            "avoid_words": sorted(GENERIC_CONTENTS),
            "notes": [
                "mix a small number of focus words with mostly direct concrete words",
                "avoid generic filler and phrase-like chunks",
            ],
        },
    )


def fetch_active_prompt_data(connection: pymysql.connections.Connection) -> list[dict[str, Any]]:
    sql = """
        SELECT
            p.id AS prompt_id,
            p.display_order AS prompt_display_order,
            p.question_en,
            tc.name AS category_name,
            td.name AS detail_name,
            wh.id AS word_hint_id,
            wi.id AS word_item_id,
            wi.content AS word_content,
            wi.meaning_ko AS word_meaning_ko,
            wi.usage_tip_ko AS word_usage_tip_ko,
            wi.example_en AS word_example_en,
            wi.expression_family AS word_expression_family,
            wi.display_order AS word_display_order
        FROM prompts p
        JOIN prompt_hints wh
          ON wh.prompt_id = p.id
         AND wh.hint_type = 'VOCAB_WORD'
         AND wh.is_active = 1
        LEFT JOIN prompt_hint_items wi
          ON wi.hint_id = wh.id
         AND wi.is_active = 1
        LEFT JOIN prompt_topic_details td
          ON td.id = p.topic_detail_id
        LEFT JOIN prompt_topic_categories tc
          ON tc.id = td.category_id
        WHERE p.is_active = 1
        ORDER BY p.display_order, p.id, wi.display_order, wi.id
    """
    phrase_sql = """
        SELECT
            h.prompt_id,
            i.content
        FROM prompt_hints h
        JOIN prompt_hint_items i
          ON i.hint_id = h.id
         AND i.is_active = 1
        WHERE h.hint_type = 'VOCAB_PHRASE'
          AND h.is_active = 1
    """
    with connection.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()
        cursor.execute(phrase_sql)
        phrase_rows = cursor.fetchall()

    phrase_map: dict[str, set[str]] = {}
    for prompt_id, content in phrase_rows:
        phrase_map.setdefault(prompt_id, set()).add(normalize_text(content))

    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        (
            prompt_id,
            prompt_display_order,
            question_en,
            category_name,
            detail_name,
            word_hint_id,
            word_item_id,
            word_content,
            word_meaning_ko,
            word_usage_tip_ko,
            word_example_en,
            word_expression_family,
            word_display_order,
        ) = row
        record = grouped.setdefault(
            prompt_id,
            {
                "prompt_id": prompt_id,
                "prompt_display_order": int(prompt_display_order or 0),
                "question_en": question_en,
                "category_name": category_name or "",
                "detail_name": detail_name or "",
                "word_hint_id": word_hint_id,
                "existing_items": [],
                "phrase_contents": sorted(phrase_map.get(prompt_id, set())),
            },
        )
        if word_item_id is None:
            continue
        record["existing_items"].append(
            {
                "id": word_item_id,
                "content": word_content or "",
                "meaning_ko": word_meaning_ko or "",
                "usage_tip_ko": word_usage_tip_ko or "",
                "example_en": word_example_en or "",
                "expression_family": word_expression_family or "",
                "display_order": int(word_display_order or 0),
            }
        )

    prompts = list(grouped.values())
    prompts.sort(key=lambda item: (item["prompt_display_order"], item["prompt_id"]))
    for prompt in prompts:
        prompt["direct_existing_items"] = [
            item for item in prompt["existing_items"] if is_direct_existing_word(item)
        ]
    return prompts


def build_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "prompts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "promptId": {"type": "string"},
                        "items": {
                            "type": "array",
                            "minItems": TARGET_ITEM_COUNT,
                            "maxItems": TARGET_ITEM_COUNT,
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "content": {"type": "string"},
                                    "meaningKo": {"type": "string"},
                                    "usageTipKo": {"type": "string"},
                                    "exampleEn": {"type": "string"},
                                    "expressionFamily": {"type": "string"},
                                },
                                "required": [
                                    "content",
                                    "meaningKo",
                                    "usageTipKo",
                                    "exampleEn",
                                    "expressionFamily",
                                ],
                            },
                        },
                    },
                    "required": ["promptId", "items"],
                },
            }
        },
        "required": ["prompts"],
    }


def build_request_prompt(batch: list[dict[str, Any]], retry_note: str = "") -> str:
    guidance = """
You are refreshing VOCAB_WORD hints for Korean learners in WriteLoop.
Return valid JSON only.

You must output exactly 10 WORD items for each prompt.

Goal:
- Give a balanced mix of core focus words and concrete detail words that help the learner answer this exact question immediately.
- Prefer nouns, adjectives, or short concept nouns tied to the topic.
- Reuse the strongest current direct words when they still fit, then expand the set to a fuller and more useful 10-item list.

Word-vs-phrase rules:
- VOCAB_WORD should be a word or short concept noun that can slot into an answer.
- A two-word item is allowed only when it acts like one concept noun, such as "screen time", "local food", or "delivery fee".
- Do NOT output action phrases or predicate chunks such as "watch shows", "take a walk", "stay home", "get ready", or "ask for help".
- Do not overfill the list with two-word items. Prefer single words when they are natural and direct.

Directness rules:
- The item should make the learner think, "I can use this right away for this question."
- Avoid generic filler words that fit many unrelated prompts.
- Avoid meta words like habit, sequence, rhythm, reset, familiar, appealing, personal, satisfying, vivid, charming, thing, issue, aspect, factor, change, problem, solution, way, impact, positive, or negative unless the question itself directly needs that concept and it is clearly anchored.
- Never output generic umbrella nouns such as benefit, benefits, drawback, drawbacks, advantage, advantages, role, roles, responsibility, responsibilities, people, or society.
- If a word feels like a summary label instead of a word the learner would actually use in an answer, replace it with a more direct topic word.
- Avoid repeating obvious question scaffolding such as home, free time, morning, afternoon, evening, night, weekend, weekdays, before, now, or nowadays unless that token is genuinely one of the best answer-building words.
- Do not make a "menu list" of many unrelated example answers. The 10 words should support one coherent answer direction, not many different possible answers.

Category mix rules:
- Routine: mix 3 focus/context words with 7 concrete routine details. Favor objects, time, place, and everyday details.
- Preference: mix 4 evaluation/sensory words with 6 target details. Favor why-it-is-good words plus concrete target details.
- Goal Plan: mix 4 goal/execution frame words with 6 concrete action or measurement words.
- Problem Solving: mix 4 issue/cause words with 6 concrete context, tool, or scene words.
- Balanced Opinion: mix 5 issue-axis words with 5 concrete system, device, or user-context words. Include both pro-side and con-side issue words.
- Opinion Reason: mix 5 public-value issue words with 5 stakeholder, resource, or institution detail words.
- Change Reflection: mix 3 perspective/shift words with 5 topic-direct words and 2 trigger/result words.
- General: mix 2 meaning/impression words with 6 target or sensory details and 2 usage or memory words.

Formatting rules:
- content: English only, lowercase unless a proper noun is unavoidable.
- meaningKo and usageTipKo: Korean only.
- exampleEn: natural English under 120 characters when possible.
- expressionFamily: always DIRECT_REFRESH_044.
- Keep items distinct. No duplicates or near-duplicates.
- Do not repeat any current VOCAB_PHRASE entry as a VOCAB_WORD item.
- General prompts that ask for one item, one feature, one hobby, or one topic should not list many unrelated examples. Instead, give descriptive words, qualities, situations, and supporting details for one answer path.
- Reflection prompts should emphasize what changed and why it changed. Avoid empty timeline markers such as before, now, nowadays, or gradually.
""".strip()

    prompt_payload = []
    for prompt in batch:
        policy = get_category_mix_policy(prompt["category_name"])
        prompt_payload.append(
            {
                "promptId": prompt["prompt_id"],
                "category": prompt["category_name"],
                "detailName": prompt["detail_name"],
                "questionEn": prompt["question_en"],
                "mixPolicy": policy["mix_policy"],
                "avoidWords": policy["avoid_words"],
                "categoryNotes": policy["notes"],
                "reviewNotes": prompt.get("review_notes", ""),
                "currentDirectWords": [item["content"] for item in prompt["direct_existing_items"]],
                "currentAllWords": [item["content"] for item in prompt["existing_items"]],
                "currentPhraseItems": prompt["phrase_contents"],
            }
        )

    prompt_text = guidance + "\n\nInput:\n" + json.dumps({"prompts": prompt_payload}, ensure_ascii=False, indent=2)
    if retry_note:
        prompt_text += "\n\nRetry note:\n" + retry_note.strip()
    return prompt_text


def build_responses_payload(model: str, prompt_text: str, reasoning_effort: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "input": [
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt_text,
                    }
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "direct_word_hint_refresh_043",
                "schema": build_schema(),
                "strict": True,
            }
        },
    }
    if reasoning_effort:
        payload["reasoning"] = {"effort": reasoning_effort}
    return payload


def extract_output_text(body: str) -> str:
    parsed = json.loads(body)
    output_text = parsed.get("output_text", "")
    if output_text:
        return output_text
    for item in parsed.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") == "output_text" and part.get("text"):
                return part["text"]
    raise ValueError("OpenAI response did not contain structured output text")


def call_openai_batch(
    env: dict[str, str],
    batch: list[dict[str, Any]],
    retry_note: str = "",
) -> dict[str, Any]:
    payload = build_responses_payload(
        model=env.get("OPENAI_FEEDBACK_MODEL") or env.get("OPENAI_MODEL") or "gpt-5.4-mini",
        prompt_text=build_request_prompt(batch, retry_note=retry_note),
        reasoning_effort=(env.get("OPENAI_FEEDBACK_REASONING_EFFORT") or "low").strip() or "low",
    )
    request = urllib.request.Request(
        env.get("OPENAI_API_URL") or "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {env['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        body = response.read().decode("utf-8")
    return json.loads(extract_output_text(body))


def is_action_phrase(content: str) -> bool:
    normalized = normalize_text(content)
    if normalized.startswith(ACTION_PHRASE_PREFIXES):
        return True
    if len(normalized.split()) > 2:
        return True
    return False


def validate_batch_result(batch: list[dict[str, Any]], response_payload: dict[str, Any]) -> list[dict[str, Any]]:
    returned_prompts = response_payload.get("prompts")
    if not isinstance(returned_prompts, list):
        raise ValueError("Response payload is missing prompts")

    by_prompt_id = {prompt["prompt_id"]: prompt for prompt in batch}
    returned_ids = [item.get("promptId", "").strip() for item in returned_prompts]
    expected_ids = [prompt["prompt_id"] for prompt in batch]
    if sorted(returned_ids) != sorted(expected_ids):
        raise ValueError(f"Prompt ids do not match. expected={expected_ids} returned={returned_ids}")

    normalized_results: list[dict[str, Any]] = []
    for prompt_payload in returned_prompts:
        prompt_id = prompt_payload["promptId"].strip()
        source_prompt = by_prompt_id[prompt_id]
        items = prompt_payload.get("items") or []
        if len(items) != TARGET_ITEM_COUNT:
            raise ValueError(f"{prompt_id} returned {len(items)} items instead of {TARGET_ITEM_COUNT}")

        seen_contents: set[str] = set()
        normalized_items: list[dict[str, str]] = []
        for raw_item in items:
            content = re.sub(r"\s+", " ", raw_item.get("content", "")).strip()
            normalized_content = normalize_text(content)
            if not normalized_content:
                raise ValueError(f"{prompt_id} returned a blank content item")
            if normalized_content in seen_contents:
                raise ValueError(f"{prompt_id} returned duplicate content: {content}")
            if normalized_content in source_prompt["phrase_contents"]:
                raise ValueError(f"{prompt_id} repeated a phrase item as a word: {content}")
            if normalized_content in GENERIC_CONTENTS:
                raise ValueError(f"{prompt_id} returned a banned generic content: {content}")
            if is_action_phrase(content):
                raise ValueError(f"{prompt_id} returned an action phrase instead of a word: {content}")

            seen_contents.add(normalized_content)
            normalized_items.append(
                {
                    "content": content,
                    "meaning_ko": raw_item.get("meaningKo", "").strip(),
                    "usage_tip_ko": raw_item.get("usageTipKo", "").strip(),
                    "example_en": raw_item.get("exampleEn", "").strip(),
                    "expression_family": GENERATION_FAMILY,
                }
            )

        normalized_results.append(
            {
                "prompt_id": prompt_id,
                "word_hint_id": source_prompt["word_hint_id"],
                "items": normalized_items,
            }
        )

    normalized_results.sort(key=lambda item: expected_ids.index(item["prompt_id"]))
    return normalized_results


def generate_refresh_records(
    env: dict[str, str],
    prompts: list[dict[str, Any]],
    batch_size: int,
    pause_seconds: float,
) -> list[dict[str, Any]]:
    generated_records: list[dict[str, Any]] = []
    total = len(prompts)
    for index in range(0, total, batch_size):
        batch = prompts[index:index + batch_size]
        print(f"Generating direct words {index + 1}-{index + len(batch)} / {total}")
        last_error: Exception | None = None
        retry_note = ""
        for attempt in range(4):
            try:
                response_payload = call_openai_batch(env, batch, retry_note=retry_note)
                generated_records.extend(validate_batch_result(batch, response_payload))
                last_error = None
                break
            except (
                urllib.error.URLError,
                TimeoutError,
                json.JSONDecodeError,
                KeyError,
                ValueError,
            ) as exc:
                last_error = exc
                retry_note = (
                    "The previous attempt failed validation. Fix the offending items and regenerate the full batch.\n"
                    f"Validation error: {exc}\n"
                    "Pay extra attention to banned generic words, phrase-vs-word violations, duplicates, and exact prompt fit."
                )
                if attempt == 3:
                    break
                time.sleep(2 + attempt)
        if last_error is not None:
            raise last_error
        if pause_seconds > 0:
            time.sleep(pause_seconds)
    return generated_records


def sql_escape(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def build_sql(refresh_records: list[dict[str, Any]]) -> str:
    lines = [
        "-- Refresh active VOCAB_WORD items so recommended words mix focus or issue words with concrete details.",
        "-- Generated by scripts/generate_active_direct_word_hint_refresh_043.py",
        "",
        "SET NAMES utf8mb4;",
        "",
        "START TRANSACTION;",
        "",
    ]

    for record in refresh_records:
        hint_id = record["word_hint_id"]
        lines.append(
            f"UPDATE prompt_hint_items SET is_active = 0 WHERE hint_id = {sql_escape(hint_id)} AND is_active = 1;"
        )
        for display_order, item in enumerate(record["items"], start=1):
            item_id = f"{hint_id}-mixed-044-item-{display_order}"
            lines.append(
                "INSERT INTO prompt_hint_items "
                "(id, hint_id, item_type, content, meaning_ko, usage_tip_ko, example_en, expression_family, display_order, is_active) "
                f"VALUES ({sql_escape(item_id)}, {sql_escape(hint_id)}, 'WORD', {sql_escape(item['content'])}, "
                f"{sql_escape(item['meaning_ko'])}, {sql_escape(item['usage_tip_ko'])}, {sql_escape(item['example_en'])}, "
                f"{sql_escape(item['expression_family'])}, {display_order}, 1) "
                "ON DUPLICATE KEY UPDATE "
                "hint_id = VALUES(hint_id), "
                "item_type = VALUES(item_type), "
                "content = VALUES(content), "
                "meaning_ko = VALUES(meaning_ko), "
                "usage_tip_ko = VALUES(usage_tip_ko), "
                "example_en = VALUES(example_en), "
                "expression_family = VALUES(expression_family), "
                "display_order = VALUES(display_order), "
                "is_active = VALUES(is_active);"
            )
        lines.append("")

    lines.extend(["COMMIT;", ""])
    return "\n".join(lines)


def write_preview(preview_path: Path, refresh_records: list[dict[str, Any]], prompts: list[dict[str, Any]]) -> None:
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    prompt_lookup = {prompt["prompt_id"]: prompt for prompt in prompts}
    preview_rows = []
    for record in refresh_records:
        prompt = prompt_lookup[record["prompt_id"]]
        policy = get_category_mix_policy(prompt["category_name"])
        preview_rows.append(
            {
                "promptId": record["prompt_id"],
                "category": prompt["category_name"],
                "detailName": prompt["detail_name"],
                "questionEn": prompt["question_en"],
                "mixPolicy": policy["mix_policy"],
                "currentDirectWords": [item["content"] for item in prompt["direct_existing_items"]],
                "newWords": [item["content"] for item in record["items"]],
                "phraseItems": prompt["phrase_contents"],
            }
        )
    preview_path.write_text(json.dumps(preview_rows, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--preview", type=Path, default=DEFAULT_PREVIEW_PATH)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--pause-seconds", type=float, default=0.0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--prompt-ids-file", type=Path, default=None)
    parser.add_argument("--review-notes-file", type=Path, default=None)
    args = parser.parse_args()

    env = load_env(args.env)
    if "OPENAI_API_KEY" not in env or not env["OPENAI_API_KEY"].strip():
        raise ValueError("OPENAI_API_KEY is not configured")

    connection = connect_db(env)
    try:
        prompts = fetch_active_prompt_data(connection)
    finally:
        connection.close()

    if args.limit > 0:
        prompts = prompts[:args.limit]

    if args.prompt_ids_file is not None:
        prompt_ids = [
            line.strip()
            for line in args.prompt_ids_file.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        prompt_id_set = set(prompt_ids)
        prompts = [prompt for prompt in prompts if prompt["prompt_id"] in prompt_id_set]
        missing_ids = [prompt_id for prompt_id in prompt_ids if prompt_id not in {prompt["prompt_id"] for prompt in prompts}]
        if missing_ids:
            raise ValueError(f"Unknown prompt ids in {args.prompt_ids_file}: {missing_ids}")

    review_notes: dict[str, str] = {}
    if args.review_notes_file is not None:
        raw_notes = json.loads(args.review_notes_file.read_text(encoding="utf-8"))
        if not isinstance(raw_notes, dict):
            raise ValueError(f"Expected JSON object in {args.review_notes_file}")
        review_notes = {
            str(prompt_id): str(note).strip()
            for prompt_id, note in raw_notes.items()
            if str(note).strip()
        }

    for prompt in prompts:
        prompt["review_notes"] = review_notes.get(prompt["prompt_id"], "")

    refresh_records = generate_refresh_records(
        env=env,
        prompts=prompts,
        batch_size=max(1, args.batch_size),
        pause_seconds=max(0.0, args.pause_seconds),
    )
    sql_text = build_sql(refresh_records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql_text, encoding="utf-8")
    write_preview(args.preview, refresh_records, prompts)
    print(f"Wrote SQL to {args.output}")
    print(f"Wrote preview to {args.preview}")


if __name__ == "__main__":
    main()
