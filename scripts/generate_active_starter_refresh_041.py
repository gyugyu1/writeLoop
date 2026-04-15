from __future__ import annotations

import re
from pathlib import Path

import pymysql


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "041-refresh-active-starter-hints.sql"


def parse_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def connect_prod() -> pymysql.Connection:
    env = parse_env(ROOT / "env_files" / "for_prod" / ".env")
    raw = env["SPRING_DATASOURCE_URL"][len("jdbc:mysql://") :]
    host_port_db = raw.split("?", 1)[0]
    host_port, db = host_port_db.rsplit("/", 1)
    host, port = host_port.split(":", 1)
    return pymysql.connect(
        host=host,
        port=int(port),
        user=env["SPRING_DATASOURCE_USERNAME"],
        password=env["SPRING_DATASOURCE_PASSWORD"],
        database=db,
        charset="utf8mb4",
        autocommit=True,
    )


def sql_string(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def ensure_ellipsis(text: str) -> str:
    text = text.strip()
    if text.endswith("..."):
        return text
    if text.endswith(" .."):
        return text[:-3] + "..."
    if text.endswith("."):
        return text[:-1] + " ..."
    if text.endswith(","):
        return text + " ..."
    if text.endswith("because"):
        return text + " ..."
    return text + " ..."


def sentence_case(text: str) -> str:
    text = text.strip()
    return text[:1].upper() + text[1:] if text else text


def strip_leading_article(text: str) -> str:
    return re.sub(r"^(a|an|the)\s+", "", text.strip(), flags=re.IGNORECASE)


def to_first_person(text: str) -> str:
    text = normalize_spaces(text)
    replacements = [
        (r"\byourself\b", "myself"),
        (r"\byours\b", "mine"),
        (r"\byou are\b", "I am"),
        (r"\byou were\b", "I was"),
        (r"\byou have\b", "I have"),
        (r"\bwith you\b", "with me"),
        (r"\bto you\b", "to me"),
        (r"\bfor you\b", "for me"),
        (r"\byour\b", "my"),
        (r"\byou\b", "I"),
    ]
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    cleanup = [
        (r"\bI are\b", "I am"),
        (r"\bto I\b", "to me"),
        (r"\bfor I\b", "for me"),
        (r"\bwith I\b", "with me"),
    ]
    for pattern, replacement in cleanup:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return normalize_spaces(text)


def extract_between(question: str, prefix: str, suffix: str) -> str | None:
    if question.startswith(prefix) and question.endswith(suffix):
        return question[len(prefix) : -len(suffix)]
    return None


def build_routine_starter(question: str) -> tuple[str, str]:
    if question.startswith("How do you usually start your ") and question.endswith("?"):
        target = to_first_person(question[len("How do you usually start your ") : -1])
        return (
            f"I usually start my {target} by ...",
            f"I usually start my {target} by doing one or two simple things before the rest of my day begins.",
        )
    if question.startswith("How do you usually spend ") and question.endswith("?"):
        target = to_first_person(question[len("How do you usually spend ") : -1])
        return (
            f"I usually spend {target} by ...",
            f"I usually spend {target} by doing something simple that helps me settle into the rest of my day.",
        )
    if question.startswith("What do you usually do ") and question.endswith("?"):
        remainder = question[len("What do you usually do ") : -1]
        context = to_first_person(remainder.split(",", 1)[0].strip())
        return (
            f"{sentence_case(context)}, I usually ...",
            f"{sentence_case(context)}, I usually take care of one or two simple things and ease into the rest of my routine.",
        )
    if ", what do you usually do" in question:
        context = to_first_person(question.split(",", 1)[0])
        return (
            f"{sentence_case(context)}, I usually ...",
            f"{sentence_case(context)}, I usually take care of one or two simple things and ease into the rest of my routine.",
        )
    return (
        "I usually ...",
        "I usually do one or two simple things and then ease into the rest of my routine.",
    )


def extract_preference_subject(question: str) -> str:
    patterns = [
        ("What is your favorite ", ", and why do you like it?"),
        ("What is your favorite ", ", and why do you like it so much?"),
        ("Tell me about your favorite ", " and explain why you like it so much."),
        ("Describe your favorite ", " and explain what you like most about it."),
        ("Which type of ", " do you like most, and what makes it your favorite?"),
    ]
    for prefix, suffix in patterns:
        subject = extract_between(question, prefix, suffix)
        if subject:
            return normalize_spaces(subject)
    return "thing"


def build_preference_starter(question: str) -> tuple[str, str]:
    subject = extract_preference_subject(question)
    return (
        f"My favorite {subject} is ... because ...",
        f"My favorite {subject} is one that feels comfortable, familiar, and easy for me to enjoy.",
    )


def build_goal_starter(question: str) -> tuple[str, str]:
    if question in {
        "Tell me about a place you want to visit and what you want to do there.",
        "Describe a city you want to visit and explain what you would like to do there.",
    }:
        return (
            "One place I want to visit is ... because ...",
            "One place I want to visit is Tokyo because I want to explore the city and try the local food there.",
        )
    if question == "What is one habit you want to build this year, and why is it important to you?":
        return (
            "One habit I want to build this year is ... because ...",
            "One habit I want to build this year is reviewing my day for ten minutes each night because it helps me stay steady.",
        )
    if question == "What is one habit you want to build this month, and how will you keep it going?":
        return (
            "One habit I want to build this month is ...",
            "One habit I want to build this month is taking ten quiet minutes each evening to check in with my progress.",
        )
    if question == "What is one skill you want to improve this year, and how will you practice it?":
        return (
            "One skill I want to improve this year is ...",
            "One skill I want to improve this year is speaking more clearly in English conversations.",
        )
    if question == "What is one area where you want to build more confidence this year, and how will you work on it?":
        return (
            "One area where I want to build more confidence this year is ...",
            "One area where I want to build more confidence this year is speaking up more clearly when I have an idea to share.",
        )
    patterns = [
        (
            r"^What is one goal you have for (.+) this year, and how will you work toward it\?$",
            "One goal I have for {focus} this year is ...",
            "One goal I have for {focus} this year is making steady progress a little at a time.",
        ),
        (
            r"^Describe one plan you have for (.+) this year,? and explain how you will stay consistent\.$",
            "One plan I have for {focus} this year is ...",
            "One plan I have for {focus} this year is setting a small weekly routine I can keep.",
        ),
        (
            r"^What would you like to get better at when it comes to (.+) this year, and what steps will you take\?$",
            "One thing I want to work on this year is {focus}, so ...",
            "One thing I want to work on this year is {focus}, so I plan to practice a little every week.",
        ),
        (
            r"^What would you like to improve about (.+) this year, and what steps will you take\?$",
            "One thing I want to work on this year is {focus}, so ...",
            "One thing I want to work on this year is {focus}, so I plan to practice a little every week.",
        ),
        (
            r"^What basic design skills would you like to improve this year, and what steps will you take\?$",
            "One thing I want to work on this year is basic design skills, so ...",
            "One thing I want to work on this year is basic design skills, so I plan to practice a little every week.",
        ),
        (
            r"^What is one (.+) you want to reach this year, and how will you work toward it\?$",
            "One {focus} I want to reach this year is ...",
            "One {focus} I want to reach this year is something I can build up through steady weekly effort.",
        ),
        (
            r"^What is one (.+) you want to focus on this year, and how will you work toward it\?$",
            "One {focus} I want to focus on this year is ...",
            "One {focus} I want to focus on this year is something I can improve by staying consistent each week.",
        ),
        (
            r"^What is one (.+) you want to build this year, and how will you work toward it\?$",
            "One {focus} I want to build this year is ...",
            "One {focus} I want to build this year is something I can strengthen with a simple routine.",
        ),
        (
            r"^What is one (.+) you want to keep this year, and how will you work toward it\?$",
            "One {focus} I want to keep this year is ...",
            "One {focus} I want to keep this year is something I can protect by staying steady and realistic.",
        ),
        (
            r"^What is one (.+) you want to finish this year, and how will you work toward it\?$",
            "One {focus} I want to finish this year is ...",
            "One {focus} I want to finish this year is something I can complete by breaking it into smaller steps.",
        ),
    ]
    for pattern, content_template, example_template in patterns:
        match = re.match(pattern, question)
        if not match:
            continue
        focus = to_first_person(match.group(1)) if match.groups() else ""
        return (
            content_template.format(focus=focus),
            example_template.format(focus=focus),
        )
    return (
        "One thing I want to work on this year is ...",
        "One thing I want to work on this year is making steady progress a little at a time.",
    )


def build_problem_starter(question: str) -> tuple[str, str]:
    patterns = [
        (
            r"^What is one challenge you often face when (.+), and how do you handle it\?$",
            "One challenge I often face when {focus} is ...",
            "One challenge I often face when {focus} is that I lose focus or feel rushed.",
        ),
        (
            r"^What is one challenge you often face in (.+), and how do you handle it\?$",
            "One challenge I often face in {focus} is ...",
            "One challenge I often face in {focus} is that I lose focus or feel rushed.",
        ),
        (
            r"^What is one challenge you often face at (.+), and how do you handle it\?$",
            "One challenge I often face at {focus} is ...",
            "One challenge I often face at {focus} is that I lose focus or feel rushed.",
        ),
        (
            r"^Describe a problem you sometimes have when (.+) and explain what you do about it\.$",
            "One problem I sometimes have when {focus} is ...",
            "One problem I sometimes have when {focus} is that I get distracted more easily than I want.",
        ),
        (
            r"^Describe a problem you sometimes have in (.+), and explain what you do about it\.$",
            "One problem I sometimes have in {focus} is ...",
            "One problem I sometimes have in {focus} is that I get distracted more easily than I want.",
        ),
        (
            r"^When it is hard to (.+), what do you usually do to deal with it\?$",
            "When it is hard to {focus}, I usually ...",
            "When it is hard to {focus}, I usually slow down and handle one small step first.",
        ),
    ]
    for pattern, content_template, example_template in patterns:
        match = re.match(pattern, question)
        if match:
            focus = to_first_person(match.group(1))
            return (
                content_template.format(focus=focus),
                example_template.format(focus=focus),
            )
    return (
        "One challenge I often face is ...",
        "One challenge I often face is that I lose focus or feel rushed.",
    )


def build_balance_starter(question: str) -> tuple[str, str]:
    if question == "How has technology changed the way people build relationships, and do you think that change is mostly positive?":
        return (
            "I think technology has changed relationships in both good and bad ways because ...",
            "I think technology has changed relationships in both good and bad ways because it makes connection easier but can also make communication feel less personal.",
        )
    patterns = [
        (
            r"^What are the benefits and drawbacks of (.+), and what is your view\?$",
            "I think there are both benefits and drawbacks to {subject} because ...",
            "I think there are both benefits and drawbacks to {subject} because it can make life easier but also create new problems.",
        ),
        (
            r"^Do you think (.+) (?:is|are) more helpful or harmful overall\? Explain both sides and give your opinion\.$",
            "I think {subject} can be helpful in some ways, but there are also drawbacks because ...",
            "I think {subject} can be helpful in some ways, but there are also drawbacks because convenience does not solve every problem.",
        ),
        (
            r"^What do you see as the strengths and weaknesses of (.+), and which side seems stronger to you\?$",
            "I think there are both strengths and weaknesses in {subject}, but ...",
            "I think there are both strengths and weaknesses in {subject}, but the strengths seem a little stronger to me.",
        ),
    ]
    for pattern, content_template, example_template in patterns:
        match = re.match(pattern, question)
        if match:
            subject = to_first_person(match.group(1))
            return (
                content_template.format(subject=subject),
                example_template.format(subject=subject),
            )
    return (
        "I think this topic has both benefits and drawbacks because ...",
        "I think this topic has both benefits and drawbacks because it can help in some ways while still causing problems in others.",
    )


def build_opinion_starter(question: str) -> tuple[str, str]:
    if question == "What social responsibilities should successful companies have in modern society?":
        return (
            "I think successful companies should take social responsibility seriously because ...",
            "I think successful companies should take social responsibility seriously because their decisions affect many people every day.",
        )
    patterns = [
        (
            r"^What role should (.+) play in modern society\?$",
            "I think {subject} should play a helpful role in modern society because ...",
            "I think {subject} should play a helpful role in modern society because daily life works better when support is fair and practical.",
        ),
        (
            r"^What role should (.+) play in the community today\?$",
            "I think {subject} should play a helpful role in the community because ...",
            "I think {subject} should play a helpful role in the community because people need support that is practical and easy to trust.",
        ),
        (
            r"^What responsibilities should (.+) have in (?:modern society|the community today)\?$",
            "I think {subject} should serve people in responsible ways because ...",
            "I think {subject} should serve people in responsible ways because trust grows when support is clear and practical.",
        ),
        (
            r"^In your opinion, how should (.+) serve people(?: and communities)? today\?$",
            "In my view, {subject} should serve people in ways that are practical and fair because ...",
            "In my view, {subject} should serve people in ways that are practical and fair because support works best when it is easy to understand and use.",
        ),
        (
            r"^In your opinion, how should (.+) serve people in modern society\?$",
            "In my view, {subject} should serve people in ways that are practical and fair because ...",
            "In my view, {subject} should serve people in ways that are practical and fair because support works best when it is easy to understand and use.",
        ),
    ]
    for pattern, content_template, example_template in patterns:
        match = re.match(pattern, question)
        if match:
            subject = to_first_person(match.group(1))
            return (
                content_template.format(subject=subject),
                example_template.format(subject=subject),
            )
    return (
        "In my view, this should help people in practical ways because ...",
        "In my view, this should help people in practical ways because support works best when it feels fair and easy to use.",
    )


def build_reflection_starter(question: str) -> tuple[str, str]:
    if question == "Describe a belief or opinion of yours that has changed over time, and explain what caused that change.":
        return (
            "One belief or opinion of mine that has changed over time is ... because ...",
            "One belief or opinion of mine that has changed over time is what success means to me, because my experiences have made me see it differently.",
        )
    patterns = [
        (
            r"^How has your view of (.+) changed over time, and why\?$",
            "My view of {subject} has changed over time because ...",
            "My view of {subject} has changed over time because my experiences have made me notice different things now.",
        ),
        (
            r"^How has your understanding of (.+) changed as you have grown, and what influenced that change\?$",
            "My understanding of {subject} has changed as I have grown because ...",
            "My understanding of {subject} has changed as I have grown because experience has made me think about it more carefully.",
        ),
        (
            r"^Tell me how your opinion of (.+) has changed over time and explain why\.$",
            "My opinion of {subject} has changed over time because ...",
            "My opinion of {subject} has changed over time because real experience made my old ideas feel too simple.",
        ),
        (
            r"^Describe how your view of (.+) has changed over time(?: and explain why)?\.$",
            "My view of {subject} has changed over time because ...",
            "My view of {subject} has changed over time because my priorities have changed little by little.",
        ),
        (
            r"^Describe how your idea of (.+) has changed over time and explain why\.$",
            "My idea of {subject} has changed over time because ...",
            "My idea of {subject} has changed over time because experience has shown me a different side of it.",
        ),
        (
            r"^Describe how your opinion about (.+) has changed over time and explain why\.$",
            "My opinion about {subject} has changed over time because ...",
            "My opinion about {subject} has changed over time because my experience has become more realistic.",
        ),
        (
            r"^Describe how your understanding of (.+) has changed over time and explain why\.$",
            "My understanding of {subject} has changed over time because ...",
            "My understanding of {subject} has changed over time because I have learned from more real situations.",
        ),
    ]
    for pattern, content_template, example_template in patterns:
        match = re.match(pattern, question)
        if match:
            subject = to_first_person(match.group(1))
            return (
                content_template.format(subject=subject),
                example_template.format(subject=subject),
            )
    return (
        "My view has changed over time because ...",
        "My view has changed over time because experience has shown me a different side of the same topic.",
    )


def build_general_starter(question: str) -> tuple[str, str]:
    patterns = [
        (r"^Describe (.+) and explain why it matters to you\.$", "matters"),
        (r"^Describe (.+) and explain why it is meaningful to you\.$", "meaningful"),
        (r"^Describe (.+) and explain why that person is important to you\.$", "person"),
        (r"^Describe (.+) and explain why that person matters to you\.$", "person"),
        (r"^Tell me about (.+) and explain why it is important to you\.$", "important"),
        (r"^Tell me about (.+) and explain why it matters to you\.$", "important"),
        (r"^Tell me about (.+) and explain why it feels meaningful to you\.$", "meaningful"),
        (r"^Tell me about (.+) and explain why that person is important to you\.$", "person"),
        (r"^Tell me about (.+) and explain why that person matters to you\.$", "person"),
        (r"^Describe (.+) and explain why it stands out to you\.$", "stands_out"),
        (r"^Describe (.+) and explain why it has remained important to you\.$", "remained"),
        (r"^Describe (.+) and explain why it has stayed in your memory\.$", "memory"),
    ]
    for pattern, mode in patterns:
        match = re.match(pattern, question)
        if not match:
            continue
        subject = to_first_person(match.group(1))
        core_subject = strip_leading_article(subject)
        if mode == "person":
            return (
                "One person who influenced me is ... because ...",
                "One person who influenced me is a teacher who helped me feel more confident, because that person changed the way I think.",
            )
        if "memory" in subject:
            return (
                "One memory that still matters to me is ... because ...",
                "One memory that still matters to me is a small moment that still feels clear and meaningful whenever I think about it.",
            )
        if mode in {"important", "meaningful", "matters", "remained"}:
            return (
                f"One {core_subject} is ... because ...",
                f"One {core_subject} is something that still feels familiar and important in my daily life.",
            )
        if mode in {"stands_out", "memory"}:
            standout_subject = re.sub(
                r"\s+that stands out to me$",
                "",
                core_subject,
                flags=re.IGNORECASE,
            )
            return (
                f"One {standout_subject} stands out to me because ...",
                f"One {standout_subject} stands out to me because it is easy to remember and still feels personal to me.",
            )
    return (
        "One thing that stands out to me is ... because ...",
        "One thing that stands out to me is something familiar and personal, because it still feels connected to my daily life.",
    )


def build_starter(category_name: str, question: str) -> tuple[str, str]:
    normalized_question = normalize_spaces(question)
    if category_name == "Routine":
        return build_routine_starter(normalized_question)
    if category_name == "Preference":
        return build_preference_starter(normalized_question)
    if category_name == "Goal Plan":
        return build_goal_starter(normalized_question)
    if category_name == "Problem Solving":
        return build_problem_starter(normalized_question)
    if category_name == "Balanced Opinion":
        return build_balance_starter(normalized_question)
    if category_name == "Opinion Reason":
        return build_opinion_starter(normalized_question)
    if category_name == "Change Reflection":
        return build_reflection_starter(normalized_question)
    return build_general_starter(normalized_question)


def main() -> None:
    conn = connect_prod()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT p.id,
               c.name AS category_name,
               p.question_en,
               h.id AS hint_id,
               i.id AS item_id,
               i.content,
               i.example_en
        FROM prompts p
        JOIN prompt_topic_details d ON d.id = p.topic_detail_id
        JOIN prompt_topic_categories c ON c.id = d.category_id
        JOIN prompt_hints h
          ON h.prompt_id = p.id
         AND h.hint_type = 'STARTER'
         AND h.is_active = 1
        JOIN prompt_hint_items i
          ON i.hint_id = h.id
         AND i.is_active = 1
        WHERE p.is_active = 1
        ORDER BY p.display_order, p.id
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    statements: list[str] = [
        "-- Refresh active starter hint content/example so they align with each prompt.",
        "-- Generated by scripts/generate_active_starter_refresh_041.py",
        "",
    ]
    update_count = 0
    for prompt_id, category_name, question_en, hint_id, item_id, current_content, current_example in rows:
        new_content, new_example = build_starter(category_name, question_en)
        new_content = ensure_ellipsis(normalize_spaces(new_content))
        new_example = normalize_spaces(new_example)
        if current_content == new_content and (current_example or "") == new_example:
            continue
        update_count += 1
        statements.append("UPDATE prompt_hint_items")
        statements.append(
            f"SET content = {sql_string(new_content)},"
        )
        statements.append(
            f"    example_en = {sql_string(new_example)}"
        )
        statements.append(
            f"WHERE id = {sql_string(item_id)}"
        )
        statements.append(
            f"  AND hint_id = {sql_string(hint_id)}"
        )
        statements.append(
            f"  AND content = {sql_string(current_content)};"
        )
        statements.append("")

    OUTPUT_PATH.write_text("\n".join(statements), encoding="utf-8")
    print(f"Reviewed {len(rows)} active starters.")
    print(f"Prepared {update_count} starter updates.")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
