import re
from pathlib import Path

import pymysql


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "infra" / "mysql" / "schema" / "062-reframe-easy-preference-prompts-as-experience.sql"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value.strip().strip('"')
    return env


def db_config(path: Path) -> dict[str, object]:
    env = load_env(path)
    match = re.match(
        r"jdbc:mysql://([^:/?#]+)(?::(\d+))?/([^?]+)",
        env["SPRING_DATASOURCE_URL"],
    )
    if not match:
        raise RuntimeError("Could not parse SPRING_DATASOURCE_URL")
    host = match.group(1)
    if host == "host.docker.internal":
        host = "127.0.0.1"
    return {
        "host": host,
        "port": int(match.group(2) or 3306),
        "user": env["SPRING_DATASOURCE_USERNAME"],
        "password": env["SPRING_DATASOURCE_PASSWORD"],
        "database": match.group(3),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def sql(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def is_target_question(question: str) -> bool:
    lower = question.lower()
    if "favorite" in lower:
        return True
    return bool(
        re.search(
            r"what kind of .*do you like|which .*do you like|what .*do you like best|"
            r"what .*feels best|what .*do you like to use",
            lower,
        )
    )


def extract_object(question: str) -> str:
    source = question.strip().rstrip("?")
    patterns = [
        r"^What is your favorite (.*?)(?:, and why.*| and why.*)?$",
        r"^What are your favorite (.*?)(?:, and why.*| and why.*)?$",
        r"^Tell me about your favorite (.*?)(?: and explain.*| and say.*)?$",
        r"^Describe your favorite (.*?)(?: and explain.*| and say.*)?$",
        r"^What kind of (.*?) do you like best to (.*?)(?:, and why.*| and why.*)?$",
        r"^What kind of (.*?) do you like best for (.*?)(?:, and why.*| and why.*)?$",
        r"^What kind of (.*?) do you like best(?:, and why.*| and why.*)?$",
        r"^Which (.*?) feels best .*$",
        r"^Which (.*?) do you like best(?:, and why.*| and why.*)?$",
        r"^What (.*?) do you like best(?:, and why.*| and why.*)?$",
        r"^What (.*?) feels best .*$",
        r"^What (.*?) do you like to use .*$",
    ]
    for pattern in patterns:
        match = re.match(pattern, source, flags=re.IGNORECASE)
        if match:
            if match.lastindex and match.lastindex >= 2:
                return f"{match.group(1).strip()} to {match.group(2).strip()}"
            return match.group(1).strip()
    return re.sub(r"^(What is|What are|Tell me about|Describe)\s+", "", source, flags=re.IGNORECASE).strip()


def article_for(phrase: str) -> str:
    return "an" if phrase[:1].lower() in {"a", "e", "i", "o", "u"} else "a"


def object_intro(object_phrase: str) -> str:
    obj = re.sub(r"\s+", " ", object_phrase.strip())
    way_match = re.match(r"^way to (.+)$", obj, flags=re.IGNORECASE)
    if way_match:
        return f"a way you like to {way_match.group(1)}"

    thing_match = re.match(r"^thing to (.+)$", obj, flags=re.IGNORECASE)
    if thing_match:
        return f"something you like to {thing_match.group(1)}"

    tool_match = re.match(r"^tool to (.+)$", obj, flags=re.IGNORECASE)
    if tool_match:
        return f"a tool you like to {tool_match.group(1)}"

    to_match = re.match(r"^(.+?) to (.+)$", obj, flags=re.IGNORECASE)
    if to_match:
        head = to_match.group(1)
        action = to_match.group(2)
        return f"{article_for(head)} {head} you like to {action}"

    if obj.lower().startswith(("pair of ", "type of ", "kind of ")):
        return f"the {obj} you like"

    if obj.endswith("s") and not obj.endswith("ss"):
        return f"the {obj} you like"

    return f"the {obj} you like"


def infer_group(detail: str, category: str, question: str) -> str:
    detail_l = (detail or "").lower()
    question_l = question.lower()
    if any(k in detail_l for k in ("drink", "bottle")) or any(
        k in question_l for k in ("drink", "tea", "coffee", "juice", "water", "tumbler", "thermos", "bottle", "straw")
    ):
        return "drink"
    if any(k in detail_l for k in ("breakfast", "meal", "snack", "sweet")) or any(
        k in question_l
        for k in (
            "bread",
            "egg",
            "fruit",
            "yogurt",
            "cereal",
            "jam",
            "toast",
            "noodle",
            "meal",
            "snack",
            "cookie",
            "chip",
            "ice cream",
            "chocolate",
            "candy",
            "cracker",
            "popcorn",
            "gummy",
            "dessert",
            "soup",
            "food",
            "porridge",
            "side dish",
            "rice bowl",
        )
    ):
        return "food"
    if any(k in detail_l for k in ("stationery", "study tools")) or any(
        k in question_l
        for k in ("pencil", "eraser", "highlighter", "sticky note", "planner", "bookmark", "ruler", "notebook", "pen", "study vocabulary")
    ):
        return "study_tool"
    if any(k in detail_l for k in ("clothes", "accessories")) or any(
        k in question_l
        for k in ("t-shirt", "hoodie", "sock", "sneaker", "hat", "scarf", "watch strap", "slippers", "jacket", "umbrella", "bag charm")
    ):
        return "wear"
    if "digital" in detail_l or any(
        k in question_l for k in ("phone", "app", "alarm sound", "calendar", "messaging", "photo filter", "map app", "widget", "lock screen")
    ):
        return "digital"
    if any(k in detail_l for k in ("nearby", "places")) or any(
        k in question_l
        for k in ("park", "aisle", "street", "stand", "bus stop", "seat near", "path", "corner", "library", "place to relax", "study spot")
    ):
        return "place"
    if "leisure" in detail_l or any(
        k in question_l
        for k in ("movie", "music", "book", "puzzle", "game", "youtube", "podcast", "coloring", "craft", "photo edit", "activity", "genre", "exercise class", "way to exercise", "weather for walking", "season")
    ):
        return "leisure"
    if any(k in detail_l for k in ("personal care", "scents")) or any(
        k in question_l
        for k in ("cream", "soap", "shampoo", "lip balm", "body wash", "lotion", "towel", "bath", "scent", "sheet mask", "comb", "hand sanitizer", "personal care")
    ):
        return "care"
    if "home comfort" in detail_l or any(
        k in question_l for k in ("blanket", "pillow", "mug", "bowl", "lamp", "desk mat", "cushion", "plant pot", "bedside")
    ):
        return "comfort"
    if any(k in detail_l for k in ("storage", "organizing")) or any(
        k in question_l for k in ("storage", "hanger", "drawer", "hook", "box", "cleaning cloth", "spray bottle", "sponge", "basket", "folder")
    ):
        return "organize"
    if "kitchen" in detail_l or any(
        k in question_l for k in ("container", "spoon", "chopsticks", "tray", "cutting board", "kitchen", "kettle", "lunch box")
    ):
        return "kitchen"
    if "gadget" in detail_l or any(
        k in question_l for k in ("charger", "cable", "speaker", "fan", "clock", "stand", "timer", "remote", "power strip", "night light")
    ):
        return "gadget"
    if any(k in detail_l for k in ("bags", "carry")) or any(
        k in question_l for k in ("backpack", "tote", "pouch", "wallet", "keychain", "bag", "cardholder", "coin purse", "strap")
    ):
        return "carry"
    return "generic"


GROUPS = {
    "food": {
        "template": "Think about {intro}. When would you usually choose it, and why would it fit that moment?",
        "ko": "좋아하는 음식이나 간식을 떠올려 보세요. 언제 주로 그것을 고르고 싶은지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.",
        "starter": "When I want something simple, I like to have ... because ...",
        "example": "When I want something simple, I like to have toast because it is quick.",
    },
    "drink": {
        "template": "Think about {intro}. When would you usually choose it, and how would it help you in that moment?",
        "ko": "좋아하는 음료나 물병을 떠올려 보세요. 언제 주로 그것을 고르는지, 그리고 그 순간에 어떻게 도움이 되는지 말해 주세요.",
        "starter": "When I need something to drink, I usually choose ... because ...",
        "example": "When I need something to drink, I usually choose iced tea because it feels refreshing.",
    },
    "study_tool": {
        "template": "Think about {intro}. When would that choice be useful for studying or working, and how would it help?",
        "ko": "좋아하는 공부 도구를 떠올려 보세요. 공부하거나 일할 때 언제 유용한지, 그리고 어떻게 도움이 되는지 말해 주세요.",
        "starter": "When I study or work, I use ... because ...",
        "example": "When I study or work, I use sticky notes because they help me remember tasks.",
    },
    "wear": {
        "template": "Think about {intro}. When would that choice feel comfortable or useful, and why?",
        "ko": "좋아하는 옷이나 액세서리를 떠올려 보세요. 언제 편하거나 유용하게 느껴지는지, 그리고 그 이유를 말해 주세요.",
        "starter": "When I go out, I like to wear or use ... because ...",
        "example": "When I go out, I like to wear a hoodie because it feels comfortable.",
    },
    "digital": {
        "template": "Think about {intro}. When would you use it, and how would it make your daily routine easier?",
        "ko": "좋아하는 디지털 기능이나 설정을 떠올려 보세요. 언제 그것을 쓰는지, 그리고 일상을 어떻게 더 편하게 해 주는지 말해 주세요.",
        "starter": "When I use my phone, I like ... because ...",
        "example": "When I use my phone, I like dark mode because it feels easier on my eyes.",
    },
    "place": {
        "template": "Think about {intro}. When would you go there or use it, and what would you enjoy about that moment?",
        "ko": "좋아하는 장소나 길을 떠올려 보세요. 언제 그곳을 이용하는지, 그리고 그 순간에 무엇이 좋은지 말해 주세요.",
        "starter": "When I need a small break, I go to ... because ...",
        "example": "When I need a small break, I go to a quiet park because it helps me relax.",
    },
    "leisure": {
        "template": "Think about {intro}. When would you enjoy it, and why would it fit your mood?",
        "ko": "좋아하는 여가 활동이나 콘텐츠를 떠올려 보세요. 언제 그것을 즐기는지, 그리고 그때의 기분과 왜 잘 맞는지 말해 주세요.",
        "starter": "When I want to relax, I enjoy ... because ...",
        "example": "When I want to relax, I enjoy a simple puzzle because it clears my mind.",
    },
    "care": {
        "template": "Think about {intro}. When would you use it, and how would it make you feel?",
        "ko": "좋아하는 관리 제품이나 향을 떠올려 보세요. 언제 그것을 쓰는지, 그리고 그때 어떤 느낌이 드는지 말해 주세요.",
        "starter": "When I get ready or rest, I use ... because ...",
        "example": "When I get ready or rest, I use hand cream because it feels gentle.",
    },
    "comfort": {
        "template": "Think about {intro}. When would you use it at home, and how would it make you feel?",
        "ko": "집에서 좋아하는 편안한 물건을 떠올려 보세요. 언제 그것을 쓰는지, 그리고 어떤 느낌을 주는지 말해 주세요.",
        "starter": "When I rest at home, I use ... because ...",
        "example": "When I rest at home, I use a soft blanket because it feels warm.",
    },
    "organize": {
        "template": "Think about {intro}. When would you use it, and how would it help you stay organized?",
        "ko": "정리할 때 좋아하는 물건을 떠올려 보세요. 언제 그것을 쓰는지, 그리고 정리에 어떻게 도움이 되는지 말해 주세요.",
        "starter": "When I organize my things, I use ... because ...",
        "example": "When I organize my things, I use a small box because it keeps my desk clean.",
    },
    "kitchen": {
        "template": "Think about {intro}. When would you use it in the kitchen, and how would it help you?",
        "ko": "주방에서 좋아하는 도구를 떠올려 보세요. 언제 그것을 쓰는지, 그리고 어떻게 도움이 되는지 말해 주세요.",
        "starter": "When I cook or prepare food, I use ... because ...",
        "example": "When I cook or prepare food, I use a food container because it keeps leftovers fresh.",
    },
    "gadget": {
        "template": "Think about {intro}. When would you use it at home, and how would it make your day easier?",
        "ko": "집에서 좋아하는 작은 기기를 떠올려 보세요. 언제 그것을 쓰는지, 그리고 하루를 어떻게 편하게 해 주는지 말해 주세요.",
        "starter": "When I am at home, I use ... because ...",
        "example": "When I am at home, I use a timer because it helps me focus.",
    },
    "carry": {
        "template": "Think about {intro}. When would you carry or use it, and how would it make your day easier?",
        "ko": "매일 들고 다니는 물건을 떠올려 보세요. 언제 그것을 쓰거나 챙기는지, 그리고 하루를 어떻게 편하게 해 주는지 말해 주세요.",
        "starter": "When I go out, I carry or use ... because ...",
        "example": "When I go out, I carry a small pouch because it keeps my things together.",
    },
    "generic": {
        "template": "Think about {intro}. When would you use or enjoy it, and why would it fit that moment?",
        "ko": "좋아하는 대상을 떠올려 보세요. 언제 그것을 쓰거나 즐기는지, 그리고 그 순간에 왜 잘 맞는지 말해 주세요.",
        "starter": "When I ..., I like ... because ...",
        "example": "When I have free time, I like this because it feels useful.",
    },
}


SPECIAL = {
    "prompt-a-2": (
        "When do you like to make a quick meal at home, and what do you usually choose?",
        "집에서 간단한 음식을 만들고 싶어지는 때는 언제이고, 보통 무엇을 선택하나요?",
        "상황을 먼저 말하고, 그때 고르는 음식과 이유를 덧붙여 보세요.",
        "When I need a quick meal at home, I usually choose ... because ...",
        "When I need a quick meal at home, I usually choose fried rice because it is easy.",
    ),
    "prompt-preference-06": (
        "When you watch a movie, what kind of story do you usually choose, and why does it fit your mood?",
        "영화를 볼 때 보통 어떤 분위기의 이야기를 고르고, 왜 그때의 기분과 잘 맞나요?",
        "영화를 보는 상황과 고르는 장르의 이유를 연결해 보세요.",
        "When I watch a movie, I usually choose ... because ...",
        "When I watch a movie, I usually choose comedy because it helps me relax.",
    ),
    "prompt-preference-11": (
        "When you need a break, where do you like to relax, and why does that place feel comfortable?",
        "쉬고 싶을 때 어디에서 쉬는 것을 좋아하고, 왜 그곳이 편안하게 느껴지나요?",
        "쉬고 싶은 상황과 장소의 느낌을 함께 말해 보세요.",
        "When I need a break, I like to relax ... because ...",
        "When I need a break, I like to relax in my room because it is quiet.",
    ),
    "prompt-preference-16": (
        "What do you like to do during the season you like most, and why does that season feel good to you?",
        "가장 좋아하는 계절에는 무엇을 하는 것을 좋아하고, 왜 그 계절이 좋게 느껴지나요?",
        "계절 자체보다 그 계절에 하는 경험을 말해 보세요.",
        "During the season I like most, I like to ... because ...",
        "During the season I like most, I like to take walks because the weather feels nice.",
    ),
    "prompt-preference-21": (
        "When do you like to listen to music, and what kind of music fits that moment?",
        "언제 음악을 듣는 것을 좋아하고, 그 순간에는 어떤 음악이 잘 맞나요?",
        "음악을 듣는 상황과 그때 어울리는 분위기를 연결해 보세요.",
        "When I listen to music, I usually choose ... because ...",
        "When I listen to music, I usually choose calm songs because they help me focus.",
    ),
    "prompt-preference-26": (
        "When do you like to order a cafe drink, and what kind of drink fits that moment?",
        "언제 카페 음료를 주문하고 싶고, 그 순간에는 어떤 음료가 잘 맞나요?",
        "카페에 가는 상황과 음료 선택 이유를 말해 보세요.",
        "When I order a cafe drink, I usually choose ... because ...",
        "When I order a cafe drink, I usually choose iced latte because it feels refreshing.",
    ),
    "prompt-preference-31": (
        "When you read for fun, what kind of book do you usually choose, and why?",
        "재미로 책을 읽을 때 보통 어떤 종류의 책을 고르고, 왜 그렇게 고르나요?",
        "책을 읽는 상황과 장르 선택 이유를 연결해 보세요.",
        "When I read for fun, I usually choose ... because ...",
        "When I read for fun, I usually choose mysteries because they keep me curious.",
    ),
    "prompt-preference-36": (
        "When do you like to eat dessert, and what makes it feel special?",
        "언제 디저트를 먹고 싶고, 그 순간에 무엇이 특별하게 느껴지나요?",
        "디저트를 먹는 상황과 기분을 함께 말해 보세요.",
        "When I eat dessert, I usually choose ... because ...",
        "When I eat dessert, I usually choose cake because it feels special.",
    ),
    "prompt-preference-41": (
        "When do you like to exercise, and what kind of exercise feels good for you?",
        "언제 운동하고 싶고, 어떤 운동이 나에게 잘 맞나요?",
        "운동하는 상황과 몸이나 기분의 변화를 말해 보세요.",
        "When I exercise, I like to ... because ...",
        "When I exercise, I like to walk because it feels simple and calm.",
    ),
    "prompt-preference-46": (
        "When do you need to focus, where do you like to study, and why?",
        "집중해야 할 때 어디에서 공부하는 것을 좋아하고, 왜 그곳이 도움이 되나요?",
        "공부하는 상황과 장소가 주는 도움을 말해 보세요.",
        "When I need to focus, I study ... because ...",
        "When I need to focus, I study at my desk because it feels organized.",
    ),
    "prompt-preference-1110": (
        "When do you study vocabulary, and what method helps you remember words?",
        "언제 단어를 공부하고, 어떤 방법이 단어를 기억하는 데 도움이 되나요?",
        "공부하는 시간과 기억에 도움이 되는 방법을 연결해 보세요.",
        "When I study vocabulary, I usually ... because ...",
        "When I study vocabulary, I usually write example sentences because they help me remember.",
    ),
    "prompt-preference-1113": (
        "When do you like to walk outside, and what kind of weather makes the walk feel better?",
        "언제 밖에서 걷는 것을 좋아하고, 어떤 날씨가 산책을 더 좋게 만들어 주나요?",
        "걷는 상황과 날씨가 주는 느낌을 함께 말해 보세요.",
        "When I walk outside, I like ... weather because ...",
        "When I walk outside, I like cool weather because it feels comfortable.",
    ),
    "prompt-preference-1116": (
        "When do you like to join an exercise class, and what kind of class helps you keep going?",
        "언제 운동 수업에 참여하고 싶고, 어떤 수업이 꾸준히 하도록 도와주나요?",
        "운동 수업을 듣는 상황과 지속하는 이유를 말해 보세요.",
        "When I join an exercise class, I like ... because ...",
        "When I join an exercise class, I like yoga because it feels calm.",
    ),
    "prompt-preference-2290": (
        "Before bed, what personal care product do you like to use, and how does it help you relax?",
        "잠들기 전에 어떤 관리 제품을 쓰는 것을 좋아하고, 그것이 어떻게 편안하게 해 주나요?",
        "잠들기 전 상황과 제품이 주는 느낌을 함께 말해 보세요.",
        "Before bed, I like to use ... because ...",
        "Before bed, I like to use hand cream because it feels gentle.",
    ),
}


def main() -> None:
    connection = pymysql.connect(**db_config(ROOT / "env_files" / "dev.env"))
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT p.id,
                   p.question_en,
                   c.name AS category,
                   d.name AS detail,
                   item.id AS starter_item_id
            FROM prompts p
            JOIN prompt_topic_details d ON d.id = p.topic_detail_id
            JOIN prompt_topic_categories c ON c.id = d.category_id
            LEFT JOIN prompt_hints hint
              ON hint.prompt_id = p.id
             AND hint.hint_type = 'STARTER'
             AND hint.is_active = 1
            LEFT JOIN prompt_hint_items item
              ON item.hint_id = hint.id
             AND item.is_active = 1
             AND item.display_order = 1
            WHERE p.is_active = 1
              AND p.difficulty IN ('I', 'A')
            ORDER BY p.display_order, p.id
            """
        )
        rows = cursor.fetchall()
    connection.close()

    targets = [row for row in rows if is_target_question(row["question_en"]) or row["id"] in SPECIAL]

    lines: list[str] = [
        "-- Reframe active intro/easy preference prompts around user experience instead of object picking.",
        "-- Keeps routine prompts intact and updates preference-like prompts plus their starter hints.",
        "",
    ]

    default_tip = "상황을 먼저 말하고, 그 순간에 도움이 되거나 기분이 좋아지는 이유를 한 문장으로 덧붙여 보세요."
    for row in targets:
        prompt_id = row["id"]
        if prompt_id in SPECIAL:
            question_en, question_ko, tip, starter, starter_example = SPECIAL[prompt_id]
        else:
            obj = extract_object(row["question_en"])
            meta = GROUPS[infer_group(row["detail"], row["category"], row["question_en"])]
            question_en = meta["template"].format(obj=obj, intro=object_intro(obj))
            question_ko = meta["ko"]
            tip = default_tip
            starter = meta["starter"]
            starter_example = meta["example"]

        lines.append(f"-- {prompt_id} | {row['category']} / {row['detail']}")
        lines.append("UPDATE prompts")
        lines.append(f"SET question_en = {sql(question_en)},")
        lines.append(f"    question_ko = {sql(question_ko)},")
        lines.append(f"    tip = {sql(tip)}")
        lines.append(f"WHERE id = {sql(prompt_id)};")

        if row["starter_item_id"]:
            lines.append("")
            lines.append("UPDATE prompt_hint_items")
            lines.append(f"SET content = {sql(starter)},")
            lines.append("    meaning_ko = '상황을 먼저 말하고, 좋아하는 대상과 이유를 이어 말하는 시작 문장',")
            lines.append("    usage_tip_ko = '질문에 바로 맞춰 경험을 시작할 때 사용하세요.',")
            lines.append(f"    example_en = {sql(starter_example)}")
            lines.append(f"WHERE id = {sql(row['starter_item_id'])};")

        lines.append("")

    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"generated {OUTPUT.relative_to(ROOT)} targets={len(targets)}")


if __name__ == "__main__":
    main()
