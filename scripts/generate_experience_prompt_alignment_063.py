from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCE_SQL = ROOT / "infra/mysql/schema/062-reframe-easy-preference-prompts-as-experience.sql"
OUTPUT_SQL = ROOT / "infra/mysql/schema/063-align-experience-prompt-starters.sql"


SPECIAL_STARTERS = {
    "prompt-a-2": (
        "When I need a quick meal at home, I usually choose ... because ...",
        "When I need a quick meal at home, I usually choose fried rice because it is easy.",
    ),
    "prompt-preference-06": (
        "When I watch a movie, I usually choose ... because ...",
        "When I watch a movie, I usually choose comedy because it helps me relax.",
    ),
    "prompt-preference-11": (
        "When I need a break, I like to relax at ... because ...",
        "When I need a break, I like to relax at a quiet cafe because it feels peaceful.",
    ),
    "prompt-preference-16": (
        "During ..., I like to ... because ...",
        "During spring, I like to take walks because the weather feels fresh.",
    ),
    "prompt-preference-21": (
        "When I ..., I like to listen to ... because ...",
        "When I study, I like to listen to calm music because it helps me focus.",
    ),
    "prompt-preference-26": (
        "When I go to a cafe, I usually order ... because ...",
        "When I go to a cafe, I usually order iced tea because it feels refreshing.",
    ),
    "prompt-preference-31": (
        "When I read for fun, I usually choose ... because ...",
        "When I read for fun, I usually choose mystery books because they keep me curious.",
    ),
    "prompt-preference-36": (
        "When I want dessert, I usually choose ... because ...",
        "When I want dessert, I usually choose cheesecake because it feels special.",
    ),
    "prompt-preference-41": (
        "When I want to exercise, I usually ... because ...",
        "When I want to exercise, I usually take a walk because it is simple.",
    ),
    "prompt-preference-46": (
        "When I need to focus, I study at ... because ...",
        "When I need to focus, I study at my desk because it is quiet.",
    ),
    "prompt-preference-1110": (
        "When I study vocabulary, I use ... because ...",
        "When I study vocabulary, I use example sentences because they help me remember words.",
    ),
    "prompt-preference-1113": (
        "When I walk outside, I like ... weather because ...",
        "When I walk outside, I like cool weather because it feels comfortable.",
    ),
    "prompt-preference-1116": (
        "When I join an exercise class, I choose ... because ...",
        "When I join an exercise class, I choose yoga because it helps me keep going.",
    ),
    "prompt-preference-2290": (
        "Before bed, I use ... because it helps me ...",
        "Before bed, I use hand cream because it helps me relax.",
    ),
    "prompt-preference-2514": (
        "When I carry a bottle, I choose ... because ...",
        "When I carry a bottle, I choose a slim bottle because it is easy to hold.",
    ),
}


def sql(value: str) -> str:
    return value.replace("'", "''")


def extract_pairs():
    text = SOURCE_SQL.read_text(encoding="utf-8")
    pattern = re.compile(
        r"UPDATE prompts\s+SET question_en = '((?:''|[^'])*)'.*?WHERE id = '([^']+)';\s+"
        r"UPDATE prompt_hint_items\s+SET content = '((?:''|[^'])*)'.*?WHERE id = '([^']+)';",
        re.S,
    )
    return [
        (prompt_id, hint_id, question_en.replace("''", "'"))
        for question_en, prompt_id, _old_content, hint_id in pattern.findall(text)
    ]


def indefinite_article(phrase: str) -> str:
    if re.match(r"^(a|an|the|some|my|fried)\b", phrase):
        return phrase
    if phrase in {"soup", "tea", "cereal", "weather", "music", "water", "chocolate"}:
        return phrase
    article = "an" if re.match(r"^[aeiou]", phrase) else "a"
    return f"{article} {phrase}"


def normalize_object(intro: str) -> str:
    value = intro.strip()
    value = re.sub(r"^a way you like to (.+)$", r"a way to \1", value)
    value = re.sub(r"^a bottle you like to carry around$", "a bottle", value)
    value = re.sub(r"^something you like to (.+)$", r"something to \1", value)
    value = re.sub(r"^a place you like to (.+)$", r"a place to \1", value)
    value = re.sub(r"\s+you like to .+$", "", value)
    value = re.sub(r"\s+that you like$", "", value)
    value = re.sub(r"\s+you like$", "", value)
    value = re.sub(r"\bwhen you\b", "when I", value)
    value = re.sub(r"\byour\b", "my", value)
    value = re.sub(r"\byou\b", "me", value)
    value = re.sub(r"\byourself\b", "myself", value)
    kind_match = re.match(r"^the kind of (.+)$", value)
    if kind_match:
        value = indefinite_article(kind_match.group(1))
    value = re.sub(r"^the type of ", "a ", value)
    value = re.sub(r"^the pair of ", "a pair of ", value)
    value = re.sub(r"^the ", "a ", value)
    value = re.sub(r"^a fried eggs$", "fried eggs", value)
    value = re.sub(r"^a [Ww]hich .*$", "a slim bottle", value)
    value = re.sub(r"^a eraser$", "an eraser", value)
    value = re.sub(r"^a aisle\b", "an aisle", value)
    return value


def has_any(text: str, tokens: list[str]) -> bool:
    for token in tokens:
        if " " in token or "-" in token:
            if token in text:
                return True
        elif re.search(rf"\b{re.escape(token)}s?\b", text):
            return True
    return False


def context_for(question: str) -> str:
    lower = question.lower()
    if "studying or working" in lower:
        return "study"
    if "carry around" in lower or "daily use" in lower and "bottle" in lower:
        return "carry"
    if has_any(lower, ["drink", "water bottle", "tumbler", "bottle", "tea", "cafe", "juice"]):
        return "drink"
    if has_any(lower, ["breakfast", "fruit", "soup", "sandwich", "snack", "dessert", "bread", "eggs", "yogurt", "cereal", "jam", "toast", "noodle", "cookie", "chip", "ice cream", "chocolate", "candy", "cracker", "popcorn", "meal", "bakery", "food", "side dish", "lunchbox", "lunch box"]):
        return "food"
    if has_any(lower, ["bag", "pouch", "wallet", "cardholder", "strap", "shopping bag", "keychain", "portable charger"]):
        return "carry"
    if has_any(lower, ["scent", "cream", "soap", "shampoo", "balm", "body wash", "lotion", "mask", "toothpaste", "sunscreen", "towels", "bath"]):
        return "care"
    if has_any(lower, ["phone", "app", "widget", "playlist", "filter", "keyboard theme", "shortcut", "alarm sound", "creator", "podcast", "video"]):
        return "digital"
    if has_any(lower, ["park", "store", "stand", "bus stop", "train", "vending machine", "playground", "place", "bench", "seat", "street", "path", "market"]):
        return "place"
    if has_any(lower, ["t-shirt", "hoodie", "sock", "sneakers", "hat", "scarf", "watch strap", "slippers", "raincoat", "pajama", "hair tie", "umbrella", "jacket", "ring", "bracelet", "wear"]):
        return "wear"
    if has_any(lower, ["blanket", "pillow", "mug", "lamp", "desk mat", "chair cushion", "calendar", "fan", "basket", "room", "bedside", "storage", "drawer", "hanger", "shelf", "hook", "charger", "speaker", "humidifier", "power strip", "tablet stand", "mirror", "box", "label"]):
        return "home"
    if has_any(lower, ["game", "puzzle", "coloring", "craft", "photo edit", "hobby", "sound", "activity"]):
        return "leisure"
    if has_any(lower, ["kitchen", "container", "tray", "cutting board", "towel", "kettle", "thermos", "sponge", "spoon", "chopsticks", "bowl", "plate"]):
        return "kitchen"
    return "generic"


def starter_from_question(question: str) -> tuple[str, str]:
    match = re.search(r"Think about (.+?)\. When", question)
    if not match:
        return (
            "When I need it, I choose ... because ...",
            "When I need it, I choose a simple option because it helps me.",
        )

    obj = normalize_object(match.group(1))
    context = context_for(question)
    if obj.startswith("a way to keep papers organized"):
        return (
            "When I study or work, I keep papers organized by ... because ...",
            "When I study or work, I keep papers organized by using folders because it helps me find things.",
        )
    if context == "study":
        return (
            f"When I study or work, I use {obj} because ...",
            f"When I study or work, I use {obj} because it helps me stay organized.",
        )
    if context == "drink":
        return (
            f"When I need something to drink, I choose {obj} because ...",
            f"When I need something to drink, I choose {obj} because it feels refreshing.",
        )
    if context == "food":
        return (
            f"When I want something to eat, I choose {obj} because ...",
            f"When I want something to eat, I choose {obj} because it fits that moment.",
        )
    if context == "carry":
        return (
            f"When I go out, I carry {obj} because ...",
            f"When I go out, I carry {obj} because it makes my day easier.",
        )
    if context == "care":
        return (
            f"When I take care of myself, I use {obj} because ...",
            f"When I take care of myself, I use {obj} because it helps me feel relaxed.",
        )
    if context == "digital":
        return (
            f"When I use my phone or an app, I choose {obj} because ...",
            f"When I use my phone or an app, I choose {obj} because it feels easy to use.",
        )
    if context == "place":
        return (
            f"When I need a short break, I choose {obj} because ...",
            f"When I need a short break, I choose {obj} because it feels comfortable.",
        )
    if context == "wear":
        return (
            f"When I get dressed, I choose {obj} because ...",
            f"When I get dressed, I choose {obj} because it feels comfortable.",
        )
    if context == "home":
        return (
            f"At home, I use {obj} because ...",
            f"At home, I use {obj} because it makes my space more comfortable.",
        )
    if context == "leisure":
        return (
            f"When I take a break, I choose {obj} because ...",
            f"When I take a break, I choose {obj} because it helps me relax.",
        )
    if context == "kitchen":
        return (
            f"When I cook or eat at home, I use {obj} because ...",
            f"When I cook or eat at home, I use {obj} because it is convenient.",
        )
    return (
        f"When I need it, I choose {obj} because ...",
        f"When I need it, I choose {obj} because it helps me.",
    )


def main():
    lines = [
        "-- Re-align experience-style prompt starters with the exact prompt topic.",
        "-- Generated by scripts/generate_experience_prompt_alignment_063.py.",
        "",
        "UPDATE prompts",
        "SET question_en = 'Think about a bottle shape that feels comfortable in your hand. When would you choose that bottle, and how would it help you in that moment?',",
        "    question_ko = '손에 잡기 편한 물병 모양을 떠올려 보세요. 언제 그 물병을 고르고, 그 순간에 어떻게 도움이 되나요?',",
        "    tip = '물병의 모양 자체보다 실제로 들고 다니는 상황과 편한 이유를 말해 보세요.'",
        "WHERE id = 'prompt-preference-2514';",
        "",
    ]
    for prompt_id, hint_id, question in extract_pairs():
        content, example = SPECIAL_STARTERS.get(prompt_id, starter_from_question(question))
        lines.extend(
            [
                "UPDATE prompt_hint_items",
                f"SET content = '{sql(content)}',",
                f"    example_en = '{sql(example)}'",
                f"WHERE id = '{hint_id}';",
                "",
            ]
        )
    OUTPUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"generated {OUTPUT_SQL} starter_updates={len(extract_pairs())}")


if __name__ == "__main__":
    main()
