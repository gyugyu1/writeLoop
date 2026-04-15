from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable

import pymysql


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "034-seed-expanded-prompts-and-hints.sql"
ENV_PATH = ROOT / ".env"

CATEGORY_ORDER = ["routine", "preference", "goal", "problem", "balance", "opinion", "reflection", "general"]
ANSWER_MODE_IDS = {
    "ROUTINE": 1,
    "PREFERENCE": 2,
    "GOAL_PLAN": 3,
    "PROBLEM_SOLUTION": 4,
    "BALANCED_OPINION": 5,
    "OPINION_REASON": 6,
    "CHANGE_REFLECTION": 7,
    "GENERAL_DESCRIPTION": 8,
}
SLOT_IDS = {
    "MAIN_ANSWER": 1,
    "REASON": 2,
    "EXAMPLE": 3,
    "FEELING": 4,
    "ACTIVITY": 5,
    "TIME_OR_PLACE": 6,
}


def word(content: str, meaning_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {"item_type": "WORD", "content": content, "meaning_ko": meaning_ko, "example_en": example_en, "expression_family": family}


def phrase(content: str, meaning_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {"item_type": "PHRASE", "content": content, "meaning_ko": meaning_ko, "example_en": example_en, "expression_family": family}


def frame(content: str, meaning_ko: str, usage_tip_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {
        "item_type": "FRAME",
        "content": content,
        "meaning_ko": meaning_ko,
        "usage_tip_ko": usage_tip_ko,
        "example_en": example_en,
        "expression_family": family,
    }


def topic(detail_name: str, **kwargs: Any) -> dict[str, Any]:
    return {"detail_name": detail_name, **kwargs}


def routine_slots(_: int) -> tuple[list[str], list[str]]:
    return ["MAIN_ANSWER", "ACTIVITY"], ["TIME_OR_PLACE", "FEELING"]


def preference_slots(_: int) -> tuple[list[str], list[str]]:
    return ["MAIN_ANSWER", "REASON"], ["FEELING", "EXAMPLE"]


def goal_slots(template_index: int) -> tuple[list[str], list[str]]:
    return (["MAIN_ANSWER", "REASON"], ["ACTIVITY", "TIME_OR_PLACE"]) if template_index == 5 else (["MAIN_ANSWER", "ACTIVITY"], ["REASON", "TIME_OR_PLACE"])


def problem_slots(_: int) -> tuple[list[str], list[str]]:
    return ["MAIN_ANSWER", "ACTIVITY"], ["REASON", "EXAMPLE"]


def balance_slots(_: int) -> tuple[list[str], list[str]]:
    return ["MAIN_ANSWER", "REASON"], ["EXAMPLE", "FEELING"]


def opinion_slots(_: int) -> tuple[list[str], list[str]]:
    return ["MAIN_ANSWER", "REASON"], ["EXAMPLE"]


def reflection_slots(template_index: int) -> tuple[list[str], list[str]]:
    return (["MAIN_ANSWER"], ["REASON", "FEELING"]) if template_index == 5 else (["MAIN_ANSWER", "REASON"], ["TIME_OR_PLACE", "FEELING"])


def general_slots(_: int) -> tuple[list[str], list[str]]:
    return ["MAIN_ANSWER", "REASON"], ["EXAMPLE", "FEELING"]


def routine_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"{topic_row['starter_en']}, I usually ...",
        f"{topic_row['starter_ko']} 저는 보통 ...",
        "루틴을 자연스럽게 시작할 때 쓰세요.",
        f"{topic_row['starter_en']}, I usually make tea and get ready for tomorrow.",
        "ROUTINE_STARTER",
    )


def routine_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("First, I ...", "먼저 저는 ...", "첫 행동을 말할 때 좋아요.", "First, I wash up and sit down for a moment.", "ROUTINE_STRUCTURE"),
        phrase("after that", "그다음에", "After that, I check a few things for tomorrow.", "ROUTINE_STRUCTURE"),
        phrase("before I ...", "~하기 전에", "Before I go to sleep, I set my alarm.", "ROUTINE_STRUCTURE"),
        frame("It helps me feel ...", "그렇게 하면 저는 ...한 기분이 들어요.", "느낌을 덧붙이면 더 자연스러워져요.", "It helps me feel calm and ready for the next day.", "ROUTINE_FEELING"),
    ]


def preference_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"My favorite {topic_row['subject_en']} is ... because ...",
        f"제가 가장 좋아하는 {topic_row['subject_ko']}는 ...인데, 이유는 ...예요.",
        "좋아하는 대상과 이유를 함께 시작할 때 좋아요.",
        f"My favorite {topic_row['subject_en']} is cold brew because it tastes clean and refreshing.",
        "PREFERENCE_STARTER",
    )


def preference_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("One reason I like it is ...", "제가 그걸 좋아하는 이유 중 하나는 ...예요.", "이유를 분명하게 이어 갈 때 쓰세요.", "One reason I like it is that it feels relaxing.", "PREFERENCE_REASON"),
        phrase("what I like most is", "제가 가장 좋아하는 점은", "What I like most is the soft texture.", "PREFERENCE_REASON"),
        phrase("it makes me feel", "그것은 저를 ...하게 해요.", "It makes me feel comfortable and focused.", "PREFERENCE_FEELING"),
        frame("I enjoy it especially when ...", "저는 특히 ...할 때 그걸 즐겨요.", "즐기는 상황을 더해 보세요.", "I enjoy it especially when I need a quiet break.", "PREFERENCE_DETAIL"),
    ]


def goal_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"One {topic_row['focus_en']} I want to work on this year is ...",
        f"제가 올해 더 노력하고 싶은 {topic_row['focus_ko']} 한 가지는 ...예요.",
        "목표를 먼저 분명하게 꺼낼 때 좋아요.",
        f"One {topic_row['focus_en']} I want to work on this year is building stronger presentation skills.",
        "GOAL_STARTER",
    )


def goal_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("I plan to ... every week.", "저는 매주 ...할 계획이에요.", "실행 계획을 구체적으로 말할 때 쓰세요.", "I plan to review my progress every week.", "GOAL_PLAN"),
        phrase("little by little", "조금씩", "I want to improve little by little.", "GOAL_PROGRESS"),
        phrase("by the end of the year", "올해 말까지", "By the end of the year, I want to feel much more confident.", "GOAL_TIME"),
        frame("This matters to me because ...", "이 목표가 저에게 중요한 이유는 ...예요.", "개인적인 이유를 붙일 때 좋아요.", "This matters to me because it will help me in my future work.", "GOAL_REASON"),
    ]


def problem_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"One challenge I often face when {topic_row['topic_en']} is ...",
        f"{topic_row['topic_ko']} 할 때 제가 자주 겪는 어려움 하나는 ...예요.",
        "문제 상황을 먼저 분명하게 소개할 때 좋아요.",
        f"One challenge I often face when {topic_row['topic_en']} is keeping my thoughts organized.",
        "PROBLEM_STARTER",
    )


def problem_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("When that happens, I usually ...", "그럴 때 저는 보통 ...해요.", "대처 방법을 바로 이어서 말할 때 쓰세요.", "When that happens, I usually slow down and make a list.", "PROBLEM_RESPONSE"),
        phrase("step by step", "한 단계씩", "I try to solve it step by step.", "PROBLEM_RESPONSE"),
        phrase("in the end", "결국에는", "In the end, it helps me stay on track.", "PROBLEM_RESULT"),
        frame("It works better because ...", "그 방법이 더 잘 통하는 이유는 ...예요.", "해결 방식의 이유를 붙일 때 좋아요.", "It works better because I feel less pressure that way.", "PROBLEM_REASON"),
    ]


def balance_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"I think {topic_row['subject_en']} have both strengths and weaknesses.",
        f"저는 {topic_row['subject_ko']}에 장점과 단점이 모두 있다고 생각해요.",
        "찬반을 균형 있게 시작할 때 좋아요.",
        f"I think {topic_row['subject_en']} have both strengths and weaknesses in daily life.",
        "BALANCED_STARTER",
    )


def balance_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        phrase("on the one hand", "한편으로는", "On the one hand, they save people time.", "BALANCE_LINKER"),
        phrase("on the other hand", "반면에", "On the other hand, they can create new habits people may not want.", "BALANCE_LINKER"),
        phrase("for example", "예를 들어", "For example, some people depend on them too much.", "BALANCE_EXAMPLE"),
        frame("Overall, I would say ...", "전반적으로 저는 ...라고 말하고 싶어요.", "마지막 입장을 정리할 때 좋아요.", "Overall, I would say the benefits are a little stronger.", "BALANCE_CONCLUSION"),
    ]


def opinion_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"I believe {topic_row['subject_en']} are important because ...",
        f"저는 {topic_row['subject_ko']}이 중요한 이유가 ...라고 생각해요.",
        "입장과 이유를 한 번에 시작할 때 좋아요.",
        f"I believe {topic_row['subject_en']} are important because they support people in practical ways.",
        "OPINION_STARTER",
    )


def opinion_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("In my view, ...", "제 생각에는 ...", "입장을 분명하게 시작할 때 좋아요.", "In my view, they deserve much more attention.", "OPINION_VIEW"),
        phrase("one reason is that", "한 가지 이유는 ...라는 점이에요.", "One reason is that they help people learn useful habits.", "OPINION_REASON"),
        phrase("for example", "예를 들어", "For example, they can support people who do not have many choices nearby.", "OPINION_EXAMPLE"),
        frame("That is why I think ...", "그래서 저는 ...라고 생각해요.", "결론 문장을 마무리할 때 좋아요.", "That is why I think communities should support them more.", "OPINION_CONCLUSION"),
    ]


def reflection_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"My view of {topic_row['subject_en']} has changed over time.",
        f"저의 {topic_row['subject_ko']}에 대한 생각은 시간이 지나며 바뀌었어요.",
        "과거와 현재의 차이를 여는 문장으로 좋아요.",
        f"My view of {topic_row['subject_en']} has changed a lot over the past few years.",
        "REFLECTION_STARTER",
    )


def reflection_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("I used to think ..., but now I think ...", "예전에는 ...라고 생각했지만, 지금은 ...라고 생각해요.", "과거와 현재를 대비할 때 가장 직접적이에요.", "I used to think failure was only negative, but now I think it can teach us a lot.", "REFLECTION_CONTRAST"),
        phrase("over time", "시간이 지나면서", "Over time, I became more open to new ideas.", "REFLECTION_TIME"),
        phrase("because of that experience", "그 경험 때문에", "Because of that experience, I became much more careful.", "REFLECTION_CAUSE"),
        frame("Now I value ... more.", "이제 저는 ...를 더 중요하게 여겨요.", "현재의 관점을 또렷하게 정리할 때 좋아요.", "Now I value honest communication more.", "REFLECTION_RESULT"),
    ]


def general_starter(topic_row: dict[str, Any]) -> dict[str, str]:
    return frame(
        f"One {topic_row['subject_en']} that stands out to me is ...",
        f"저에게 특히 떠오르는 {topic_row['subject_ko']} 하나는 ...예요.",
        "대상을 자연스럽게 소개할 때 좋아요.",
        f"One {topic_row['subject_en']} that stands out to me is a small bookstore near my home.",
        "GENERAL_STARTER",
    )


def general_extra(_: dict[str, Any]) -> list[dict[str, str]]:
    return [
        frame("What I like most about it is ...", "그것에서 제가 가장 좋아하는 점은 ...예요.", "핵심 매력을 말할 때 좋아요.", "What I like most about it is the warm atmosphere.", "GENERAL_REASON"),
        phrase("for example", "예를 들어", "For example, the owner always recommends interesting new books.", "GENERAL_EXAMPLE"),
        phrase("because of that", "그 때문에", "Because of that, I keep going back there.", "GENERAL_LINKER"),
        frame("It feels ... to me.", "저에게는 ...하게 느껴져요.", "개인적인 느낌을 붙이면 더 자연스러워져요.", "It feels calm and familiar to me.", "GENERAL_FEELING"),
    ]


ROUTINE_TEMPLATES = [
    lambda topic_row: (f"How do you usually spend your time {topic_row['context_en']}?", f"{topic_row['context_ko']} 시간은 보통 어떻게 보내나요?"),
    lambda topic_row: (f"What do you often do {topic_row['context_en']}?", f"{topic_row['context_ko']}에는 주로 무엇을 하나요?"),
    lambda topic_row: (f"Describe your routine {topic_row['context_en']}.", f"{topic_row['context_ko']} 루틴을 설명해 주세요."),
    lambda topic_row: (f"What is one thing you usually do {topic_row['context_en']}, and why?", f"{topic_row['context_ko']}에 보통 하는 일 한 가지와 그 이유를 말해 주세요."),
    lambda topic_row: (f"When it is {topic_row['context_en']}, what do you normally do?", f"{topic_row['context_ko']}이 되면 보통 무엇을 하나요?"),
]

PREFERENCE_TEMPLATES = [
    lambda topic_row: (f"What is your favorite {topic_row['subject_en']}, and why do you like it?", f"가장 좋아하는 {topic_row['subject_ko']}는 무엇이고, 왜 좋아하나요?"),
    lambda topic_row: (f"Tell me about your favorite {topic_row['subject_en']} and explain why it appeals to you.", f"가장 좋아하는 {topic_row['subject_ko']}에 대해 말하고, 왜 끌리는지 설명해 주세요."),
    lambda topic_row: (f"Describe your favorite {topic_row['subject_en']} and give two reasons you enjoy it.", f"가장 좋아하는 {topic_row['subject_ko']}를 설명하고, 즐기는 이유 두 가지를 말해 주세요."),
    lambda topic_row: (f"What do you like most about your favorite {topic_row['subject_en']}, and why?", f"가장 좋아하는 {topic_row['subject_ko']}에서 가장 마음에 드는 점은 무엇이며, 왜 그런가요?"),
    lambda topic_row: (f"Introduce your favorite {topic_row['subject_en']} and explain what makes it special to you.", f"가장 좋아하는 {topic_row['subject_ko']}를 소개하고, 무엇이 특별한지 설명해 주세요."),
]

GOAL_TEMPLATES = [
    lambda topic_row: (f"What is one {topic_row['focus_en']}, and how will you work on it?", f"{topic_row['focus_ko']} 한 가지는 무엇이고, 어떻게 노력할 건가요?"),
    lambda topic_row: (f"Describe one {topic_row['focus_en']} and explain your plan.", f"{topic_row['focus_ko']} 한 가지를 설명하고 계획을 말해 주세요."),
    lambda topic_row: (f"Tell me about one {topic_row['focus_en']} and how you will make progress.", f"{topic_row['focus_ko']} 한 가지와 어떻게 발전시킬지 말해 주세요."),
    lambda topic_row: (f"What steps will you take for one {topic_row['focus_en']}?", f"{topic_row['focus_ko']} 한 가지를 위해 어떤 단계를 밟을 건가요?"),
    lambda topic_row: (f"Explain one {topic_row['focus_en']} and why it matters to you.", f"{topic_row['focus_ko']} 한 가지를 설명하고 왜 중요한지 말해 주세요."),
]

PROBLEM_TEMPLATES = [
    lambda topic_row: (f"What is one challenge you often face when {topic_row['topic_en']}, and how do you handle it?", f"{topic_row['topic_ko']}할 때 자주 겪는 어려움 한 가지와 그 대처 방법을 말해 주세요."),
    lambda topic_row: (f"Describe a problem you have when {topic_row['topic_en']} and explain how you deal with it.", f"{topic_row['topic_ko']}할 때 생기는 문제를 설명하고 어떻게 해결하는지 말해 주세요."),
    lambda topic_row: (f"Tell me about a difficulty related to {topic_row['topic_en']} and what you do about it.", f"{topic_row['topic_ko']}와 관련된 어려움과 그에 대해 무엇을 하는지 말해 주세요."),
    lambda topic_row: (f"What is challenging for you about {topic_row['topic_en']}, and how do you respond?", f"{topic_row['topic_ko']}에서 무엇이 어렵고, 그럴 때 어떻게 대응하나요?"),
    lambda topic_row: (f"Explain a common problem you face when {topic_row['topic_en']} and how you try to solve it.", f"{topic_row['topic_ko']}할 때 자주 생기는 문제와 이를 풀기 위해 하는 일을 설명해 주세요."),
]

BALANCE_TEMPLATES = [
    lambda topic_row: (f"What are the benefits and drawbacks of {topic_row['subject_en']}, and what is your view?", f"{topic_row['subject_ko']}의 장점과 단점은 무엇이며, 당신의 생각은 어떤가요?"),
    lambda topic_row: (f"How have {topic_row['subject_en']} changed daily life, and is that change mostly positive?", f"{topic_row['subject_ko']}이 일상을 어떻게 바꾸었고, 그 변화가 대체로 긍정적인가요?"),
    lambda topic_row: (f"In what ways have {topic_row['subject_en']} affected people, and is that effect mostly good?", f"{topic_row['subject_ko']}이 사람들에게 어떤 영향을 주었고, 그 영향은 대체로 좋은가요?"),
    lambda topic_row: (f"Do you think {topic_row['subject_en']} help people more than they harm them? Why?", f"{topic_row['subject_ko']}이 사람들에게 해보다 도움이 더 된다고 보나요? 왜 그런가요?"),
    lambda topic_row: (f"What is your overall opinion on {topic_row['subject_en']}, considering both their advantages and disadvantages?", f"{topic_row['subject_ko']}의 장단점을 모두 고려했을 때 전체적인 의견은 어떤가요?"),
]

OPINION_TEMPLATES = [
    lambda topic_row: (f"What role should {topic_row['subject_en']} have in modern society?", f"{topic_row['subject_ko']}이 현대 사회에서 어떤 역할을 해야 하는지 말해 주세요."),
    lambda topic_row: (f"Do you think {topic_row['subject_en']} should receive more support? Why or why not?", f"{topic_row['subject_ko']}이 더 많은 지원을 받아야 한다고 보나요? 왜 그런가요?"),
    lambda topic_row: (f"How important are {topic_row['subject_en']} for communities today?", f"{topic_row['subject_ko']}이 오늘날 공동체에 얼마나 중요하다고 생각하나요?"),
    lambda topic_row: (f"What responsibility do people or institutions have to support {topic_row['subject_en']}?", f"사람들이나 기관은 {topic_row['subject_ko']}을 지원하기 위해 어떤 책임을 가져야 하나요?"),
    lambda topic_row: (f"What is your opinion on expanding {topic_row['subject_en']}, and why?", f"{topic_row['subject_ko']}을 확대하는 것에 대한 당신의 의견은 무엇이며, 그 이유는 무엇인가요?"),
]

REFLECTION_TEMPLATES = [
    lambda topic_row: (f"Describe how your view of {topic_row['subject_en']} has changed over time.", f"{topic_row['subject_ko']}에 대한 생각이 시간이 지나며 어떻게 바뀌었는지 설명해 주세요."),
    lambda topic_row: (f"What is one change in your thinking about {topic_row['subject_en']}, and what caused it?", f"{topic_row['subject_ko']}에 대한 생각에서 바뀐 점 한 가지와 그 이유를 말해 주세요."),
    lambda topic_row: (f"Tell me about an opinion you used to have about {topic_row['subject_en']} and how it changed.", f"{topic_row['subject_ko']}에 대해 예전에 가졌던 생각과 그것이 어떻게 바뀌었는지 말해 주세요."),
    lambda topic_row: (f"How is your current view of {topic_row['subject_en']} different from the past?", f"{topic_row['subject_ko']}에 대한 현재의 생각은 과거와 어떻게 다른가요?"),
    lambda topic_row: (f"What experience changed the way you think about {topic_row['subject_en']}?", f"{topic_row['subject_ko']}에 대한 생각을 바꾼 경험은 무엇이었나요?"),
]

GENERAL_TEMPLATES = [
    lambda topic_row: (f"Describe {topic_row['subject_en']} and explain why it matters to you.", f"{topic_row['subject_ko']}를 설명하고 왜 중요하게 느끼는지 말해 주세요."),
    lambda topic_row: (f"Tell me about {topic_row['subject_en']} and why you recommend it.", f"{topic_row['subject_ko']}에 대해 말하고 왜 추천하는지 설명해 주세요."),
    lambda topic_row: (f"What do you like most about {topic_row['subject_en']}?", f"{topic_row['subject_ko']}에서 가장 좋아하는 점은 무엇인가요?"),
    lambda topic_row: (f"Why is {topic_row['subject_en']} important in your daily life?", f"{topic_row['subject_ko']}가 일상에서 왜 중요한가요?"),
    lambda topic_row: (f"Describe {topic_row['subject_en']} and share one memorable detail about it.", f"{topic_row['subject_ko']}를 설명하고 기억에 남는 디테일 한 가지를 덧붙여 주세요."),
]


CATEGORY_SPECS = {
    "routine": {"category_name": "Routine", "difficulty": "A", "prompt_prefix": "prompt-routine", "hint_prefix": "hint-rtn", "tip": "시간 표현과 순서를 함께 넣어서 루틴을 설명해 보세요.", "answer_mode": "ROUTINE", "expected_tense": "PRESENT_SIMPLE", "expected_pov": "FIRST_PERSON", "hint4_type": "STRUCTURE", "hint4_title": "구조 힌트", "templates": ROUTINE_TEMPLATES, "starter_factory": routine_starter, "extra_factory": routine_extra, "slot_factory": routine_slots},
    "preference": {"category_name": "Preference", "difficulty": "A", "prompt_prefix": "prompt-preference", "hint_prefix": "hint-pref", "tip": "좋아하는 이유를 감정이나 상황과 함께 설명해 보세요.", "answer_mode": "PREFERENCE", "expected_tense": "PRESENT_SIMPLE", "expected_pov": "FIRST_PERSON", "hint4_type": "DETAIL", "hint4_title": "디테일 힌트", "templates": PREFERENCE_TEMPLATES, "starter_factory": preference_starter, "extra_factory": preference_extra, "slot_factory": preference_slots},
    "goal": {"category_name": "Goal Plan", "difficulty": "B", "prompt_prefix": "prompt-goal", "hint_prefix": "hint-goal", "tip": "목표와 실행 계획을 함께 말하면 답이 더 탄탄해져요.", "answer_mode": "GOAL_PLAN", "expected_tense": "FUTURE_PLAN", "expected_pov": "FIRST_PERSON", "hint4_type": "STRUCTURE", "hint4_title": "구조 힌트", "templates": GOAL_TEMPLATES, "starter_factory": goal_starter, "extra_factory": goal_extra, "slot_factory": goal_slots},
    "problem": {"category_name": "Problem Solving", "difficulty": "B", "prompt_prefix": "prompt-problem", "hint_prefix": "hint-prob", "tip": "문제와 해결 과정을 순서대로 설명해 보세요.", "answer_mode": "PROBLEM_SOLUTION", "expected_tense": "PRESENT_SIMPLE", "expected_pov": "FIRST_PERSON", "hint4_type": "STRUCTURE", "hint4_title": "구조 힌트", "templates": PROBLEM_TEMPLATES, "starter_factory": problem_starter, "extra_factory": problem_extra, "slot_factory": problem_slots},
    "balance": {"category_name": "Balanced Opinion", "difficulty": "C", "prompt_prefix": "prompt-balance", "hint_prefix": "hint-bal", "tip": "장점과 단점을 모두 짚은 뒤 마지막 입장을 정리해 보세요.", "answer_mode": "BALANCED_OPINION", "expected_tense": "PRESENT_SIMPLE", "expected_pov": "GENERAL_OR_FIRST_PERSON", "hint4_type": "LINKER", "hint4_title": "연결 힌트", "templates": BALANCE_TEMPLATES, "starter_factory": balance_starter, "extra_factory": balance_extra, "slot_factory": balance_slots},
    "opinion": {"category_name": "Opinion Reason", "difficulty": "C", "prompt_prefix": "prompt-opinion", "hint_prefix": "hint-opin", "tip": "입장과 이유를 분명히 나누어 말해 보세요.", "answer_mode": "OPINION_REASON", "expected_tense": "PRESENT_SIMPLE", "expected_pov": "GENERAL_OR_FIRST_PERSON", "hint4_type": "DETAIL", "hint4_title": "근거 힌트", "templates": OPINION_TEMPLATES, "starter_factory": opinion_starter, "extra_factory": opinion_extra, "slot_factory": opinion_slots},
    "reflection": {"category_name": "Change Reflection", "difficulty": "C", "prompt_prefix": "prompt-reflection", "hint_prefix": "hint-refl", "tip": "과거와 현재를 비교하고 생각이 바뀐 계기를 함께 넣어 보세요.", "answer_mode": "CHANGE_REFLECTION", "expected_tense": "MIXED_PAST_PRESENT", "expected_pov": "FIRST_PERSON", "hint4_type": "STRUCTURE", "hint4_title": "전환 힌트", "templates": REFLECTION_TEMPLATES, "starter_factory": reflection_starter, "extra_factory": reflection_extra, "slot_factory": reflection_slots},
    "general": {"category_name": "General", "difficulty": "B", "prompt_prefix": "prompt-general", "hint_prefix": "hint-gen", "tip": "대상 설명에 이유와 느낌을 함께 더해 보세요.", "answer_mode": "GENERAL_DESCRIPTION", "expected_tense": "PRESENT_SIMPLE", "expected_pov": "FIRST_PERSON", "hint4_type": "DETAIL", "hint4_title": "설명 힌트", "templates": GENERAL_TEMPLATES, "starter_factory": general_starter, "extra_factory": general_extra, "slot_factory": general_slots},
}

CATEGORY_EXTRA_WORDS = {
    "routine": [
        word("habit", "습관", "A small habit can shape the rest of the day.", "ROUTINE_BONUS"),
        word("regularly", "규칙적으로", "I do it regularly, even on busy days.", "ROUTINE_BONUS"),
        word("sequence", "순서", "The sequence is simple, so I can keep it easily.", "ROUTINE_BONUS"),
    ],
    "preference": [
        word("appealing", "매력적인", "That part feels especially appealing to me.", "PREFERENCE_BONUS"),
        word("comforting", "편안함을 주는", "It is comforting after a long day.", "PREFERENCE_BONUS"),
        word("personal", "개인적인", "It feels personal because it matches my taste.", "PREFERENCE_BONUS"),
    ],
    "goal": [
        word("milestone", "중간 목표", "A small milestone keeps me motivated.", "GOAL_BONUS"),
        word("consistent", "꾸준한", "I want to stay consistent throughout the year.", "GOAL_BONUS"),
        word("commitment", "의지, 전념", "This goal needs real commitment from me.", "GOAL_BONUS"),
    ],
    "problem": [
        word("obstacle", "장애물", "This obstacle appears when I feel rushed.", "PROBLEM_BONUS"),
        word("approach", "접근 방식", "I changed my approach after a few bad results.", "PROBLEM_BONUS"),
        word("frustrating", "답답한", "It feels frustrating when the same issue returns.", "PROBLEM_BONUS"),
    ],
    "balance": [
        word("advantage", "장점", "One advantage is that it saves time.", "BALANCE_BONUS"),
        word("concern", "우려", "A major concern is how people may depend on it.", "BALANCE_BONUS"),
        word("trade-off", "상충 관계", "There is always some trade-off in daily life.", "BALANCE_BONUS"),
    ],
    "opinion": [
        word("society", "사회", "I think society benefits when this is supported well.", "OPINION_BONUS"),
        word("impact", "영향", "Its impact can be larger than people expect.", "OPINION_BONUS"),
        word("necessary", "필요한", "I believe this is still necessary today.", "OPINION_BONUS"),
    ],
    "reflection": [
        word("realization", "깨달음", "That realization changed the way I think now.", "REFLECTION_BONUS"),
        word("perspective", "관점", "My perspective is much wider than before.", "REFLECTION_BONUS"),
        word("shift", "변화, 전환", "There was a clear shift in my thinking after that.", "REFLECTION_BONUS"),
    ],
    "general": [
        word("memorable", "기억에 남는", "It is memorable for a simple reason.", "GENERAL_BONUS"),
        word("familiar", "익숙한", "It feels familiar in a comforting way.", "GENERAL_BONUS"),
        word("meaningful", "의미 있는", "It became meaningful to me over time.", "GENERAL_BONUS"),
    ],
}

TOPICS = {
    "routine": [
        topic("Before Bed", context_en="before bed", context_ko="잠들기 전", starter_en="Before bed", starter_ko="잠들기 전에는", words=[word("stretch", "가볍게 몸을 풀다", "I stretch for a few minutes before bed.", "BEDTIME_ROUTINE"), word("journal", "일기를 쓰다", "I journal for a few minutes at night.", "BEDTIME_ROUTINE"), word("alarm", "알람", "I always check my alarm before I sleep.", "BEDTIME_ROUTINE"), word("pajamas", "잠옷", "I change into my pajamas after washing up.", "BEDTIME_ROUTINE"), word("sleepy", "졸린", "By then, I already feel sleepy.", "BEDTIME_FEELING")], phrases=[phrase("brush my teeth", "양치하다", "I brush my teeth and wash my face before I sleep.", "BEDTIME_ACTION"), phrase("turn off the lights", "불을 끄다", "I turn off the lights around eleven.", "BEDTIME_ACTION"), phrase("get ready for tomorrow", "내일을 준비하다", "I get ready for tomorrow before I sleep.", "BEDTIME_PREP"), phrase("calm down", "마음을 가라앉히다", "Reading helps me calm down before bed.", "BEDTIME_FEELING")]),
        topic("On My Commute", context_en="on your commute", context_ko="출퇴근길에", starter_en="On my commute", starter_ko="출퇴근길에는", words=[word("commute", "통근, 통학", "My commute takes about forty minutes.", "COMMUTE_ROUTINE"), word("podcast", "팟캐스트", "I listen to a podcast on the bus.", "COMMUTE_ACTIVITY"), word("transfer", "갈아타기", "I have one transfer on my way to work.", "COMMUTE_TIME"), word("earphones", "이어폰", "I put on my earphones as soon as I get on.", "COMMUTE_ACTIVITY"), word("crowded", "붐비는", "The train is usually crowded in the morning.", "COMMUTE_FEELING")], phrases=[phrase("on my way to work", "출근하는 길에", "On my way to work, I usually read short articles.", "COMMUTE_TIME"), phrase("on the bus or subway", "버스나 지하철에서", "On the bus or subway, I try to stay relaxed.", "COMMUTE_PLACE"), phrase("check the route", "경로를 확인하다", "I check the route before leaving home.", "COMMUTE_ACTION"), phrase("pass the time", "시간을 보내다", "Music helps me pass the time on the train.", "COMMUTE_FEELING")]),
        topic("Lunch Break", context_en="during your lunch break", context_ko="점심시간에는", starter_en="During my lunch break", starter_ko="점심시간에는", words=[word("cafeteria", "구내식당, 식당", "I usually eat in the cafeteria with coworkers.", "LUNCH_BREAK"), word("recharge", "재충전하다", "A quiet lunch break helps me recharge.", "LUNCH_BREAK_FEELING"), word("stroll", "산책", "I take a short stroll after eating.", "LUNCH_BREAK_ACTIVITY"), word("coworker", "동료", "Sometimes I have lunch with a coworker.", "LUNCH_BREAK_COMPANION"), word("snack", "간식", "I buy a small snack before going back.", "LUNCH_BREAK_ACTION")], phrases=[phrase("grab a quick meal", "간단히 식사하다", "I usually grab a quick meal near the office.", "LUNCH_BREAK_ACTION"), phrase("take a short walk", "짧게 걷다", "After lunch, I take a short walk outside.", "LUNCH_BREAK_ACTIVITY"), phrase("go back to work", "다시 일하러 돌아가다", "Then I go back to work with more energy.", "LUNCH_BREAK_SEQUENCE"), phrase("clear my head", "머리를 식히다", "Fresh air helps me clear my head.", "LUNCH_BREAK_FEELING")]),
        topic("Rainy Day at Home", context_en="on rainy days at home", context_ko="비 오는 날 집에 있을 때", starter_en="On rainy days at home", starter_ko="비 오는 날 집에 있으면", words=[word("blanket", "담요", "I sit under a blanket and read.", "RAINY_DAY"), word("playlist", "재생목록", "I play a calm playlist when it rains.", "RAINY_DAY_ACTIVITY"), word("indoors", "실내에서", "I stay indoors most of the day.", "RAINY_DAY_PLACE"), word("cozy", "아늑한", "The room feels cozy when it rains outside.", "RAINY_DAY_FEELING"), word("window", "창문", "I look out the window while drinking tea.", "RAINY_DAY_DETAIL")], phrases=[phrase("stay in", "집에 머물다", "I usually stay in when the weather is bad.", "RAINY_DAY_ACTION"), phrase("make a cup of tea", "차 한 잔을 만들다", "I make a cup of tea and sit by the window.", "RAINY_DAY_ACTION"), phrase("watch the rain", "비 오는 모습을 보다", "Sometimes I just watch the rain for a while.", "RAINY_DAY_DETAIL"), phrase("slow down", "천천히 쉬다", "Rainy weather helps me slow down a little.", "RAINY_DAY_FEELING")]),
        topic("After Waking Up", context_en="right after waking up", context_ko="막 일어난 직후에는", starter_en="Right after waking up", starter_ko="막 일어나면", words=[word("alarm", "알람", "I turn off the alarm and sit up slowly.", "MORNING_ROUTINE"), word("sunlight", "햇빛", "I open the curtains to let in some sunlight.", "MORNING_DETAIL"), word("water", "물", "The first thing I do is drink water.", "MORNING_ACTION"), word("stretch", "스트레칭하다", "I stretch for a minute before getting dressed.", "MORNING_ACTION"), word("groggy", "멍한", "I feel groggy if I wake up too early.", "MORNING_FEELING")], phrases=[phrase("get out of bed", "침대에서 일어나다", "I get out of bed as soon as the alarm rings.", "MORNING_ACTION"), phrase("open the curtains", "커튼을 열다", "I open the curtains to wake myself up.", "MORNING_ACTION"), phrase("wash my face", "세수하다", "Then I wash my face and brush my teeth.", "MORNING_ACTION"), phrase("wake up properly", "완전히 잠을 깨다", "Cold water helps me wake up properly.", "MORNING_FEELING")]),
    ],
    "preference": [
        topic("Cafe Drink", subject_en="cafe drink", subject_ko="카페 음료", words=[word("latte", "라테", "My favorite cafe drink is an iced latte.", "CAFE_DRINK"), word("aroma", "향", "I love the aroma of freshly brewed coffee.", "CAFE_DRINK_REASON"), word("refreshing", "상쾌한", "It tastes light and refreshing in the afternoon.", "CAFE_DRINK_FEELING"), word("foam", "거품", "The soft foam makes the drink feel smoother.", "CAFE_DRINK_DETAIL"), word("caffeine", "카페인", "A little caffeine helps me stay focused.", "CAFE_DRINK_REASON")], phrases=[phrase("my go-to drink", "제가 자주 고르는 음료", "My go-to drink is still a vanilla latte.", "CAFE_DRINK_REASON"), phrase("not too sweet", "너무 달지 않은", "I like it because it is not too sweet.", "CAFE_DRINK_TASTE"), phrase("when I need a boost", "기운이 필요할 때", "I usually order it when I need a boost.", "CAFE_DRINK_TIME"), phrase("goes well with", "~와 잘 어울리다", "It goes well with a simple sandwich.", "CAFE_DRINK_PAIRING")]),
        topic("Book Genre", subject_en="book genre", subject_ko="책 장르", words=[word("mystery", "미스터리", "Mystery is still my favorite genre.", "BOOK_GENRE"), word("plot", "줄거리", "A strong plot keeps me interested.", "BOOK_GENRE_REASON"), word("character", "인물", "The characters often feel very real.", "BOOK_GENRE_DETAIL"), word("suspense", "긴장감", "The suspense makes the story hard to put down.", "BOOK_GENRE_FEELING"), word("twist", "반전", "I love a story with a surprising twist.", "BOOK_GENRE_REASON")], phrases=[phrase("keep me curious", "호기심을 유지하게 하다", "These stories keep me curious until the end.", "BOOK_GENRE_REASON"), phrase("turn the pages", "계속 페이지를 넘기다", "A good mystery makes me turn the pages quickly.", "BOOK_GENRE_FEELING"), phrase("get absorbed in", "푹 빠지다", "I can get absorbed in that kind of story for hours.", "BOOK_GENRE_FEELING"), phrase("at the end of each chapter", "매 장 끝에서", "At the end of each chapter, I want to know more.", "BOOK_GENRE_DETAIL")]),
        topic("Dessert", subject_en="dessert", subject_ko="디저트", words=[word("creamy", "부드러운", "I like creamy desserts after dinner.", "DESSERT_TASTE"), word("chewy", "쫀득한", "A chewy texture makes it more fun to eat.", "DESSERT_TASTE"), word("bakery", "빵집", "There is a great bakery near my house.", "DESSERT_PLACE"), word("topping", "토핑", "Fresh fruit toppings make it even better.", "DESSERT_DETAIL"), word("portion", "양", "I like desserts that come in a small portion.", "DESSERT_REASON")], phrases=[phrase("after a meal", "식사 후에", "I usually eat it after a meal.", "DESSERT_TIME"), phrase("not overly sweet", "지나치게 달지 않은", "I prefer desserts that are not overly sweet.", "DESSERT_TASTE"), phrase("melt in my mouth", "입에서 사르르 녹다", "I love desserts that melt in my mouth.", "DESSERT_FEELING"), phrase("with a cup of tea", "차 한 잔과 함께", "It tastes even better with a cup of tea.", "DESSERT_PAIRING")]),
        topic("Way to Exercise", subject_en="way to exercise", subject_ko="운동 방식", words=[word("jogging", "조깅", "Jogging is still my favorite way to exercise.", "EXERCISE_STYLE"), word("stamina", "체력", "It helps me build my stamina slowly.", "EXERCISE_REASON"), word("routine", "루틴", "A simple routine works best for me.", "EXERCISE_DETAIL"), word("stretching", "스트레칭", "I always start with some stretching.", "EXERCISE_ACTION"), word("mood", "기분", "Exercise improves my mood a lot.", "EXERCISE_FEELING")], phrases=[phrase("clear my mind", "머리를 맑게 하다", "A short run helps me clear my mind.", "EXERCISE_FEELING"), phrase("fit into my schedule", "일정에 잘 맞다", "It fits into my schedule more easily than other workouts.", "EXERCISE_REASON"), phrase("without too much pressure", "큰 부담 없이", "I can do it regularly without too much pressure.", "EXERCISE_REASON"), phrase("little by little", "조금씩", "It helps me get stronger little by little.", "EXERCISE_PROGRESS")]),
        topic("Study Spot", subject_en="study spot", subject_ko="공부 장소", words=[word("quiet", "조용한", "A quiet place helps me focus for longer.", "STUDY_SPOT"), word("lighting", "조명", "Good lighting makes reading easier.", "STUDY_SPOT_DETAIL"), word("desk", "책상", "A wide desk gives me enough space to work.", "STUDY_SPOT_DETAIL"), word("outlet", "콘센트", "An outlet nearby is very convenient.", "STUDY_SPOT_REASON"), word("concentration", "집중", "That place helps my concentration a lot.", "STUDY_SPOT_REASON")], phrases=[phrase("help me focus", "집중하게 도와주다", "The atmosphere helps me focus right away.", "STUDY_SPOT_REASON"), phrase("stay there for hours", "몇 시간씩 머물다", "I can stay there for hours without feeling tired.", "STUDY_SPOT_DETAIL"), phrase("feel comfortable", "편안하게 느끼다", "I feel comfortable there, so I study better.", "STUDY_SPOT_FEELING"), phrase("avoid distractions", "방해 요소를 피하다", "It helps me avoid distractions from home.", "STUDY_SPOT_REASON")]),
    ],
    "goal": [
        topic("Career Skill", focus_en="career skill you want to build this year", focus_ko="올해 키우고 싶은 커리어 역량", words=[word("presentation", "발표", "I want to become better at presentations.", "CAREER_SKILL"), word("portfolio", "포트폴리오", "I also want to improve my portfolio this year.", "CAREER_SKILL_DETAIL"), word("mentor", "멘토", "A mentor can give me useful advice.", "CAREER_SKILL_SUPPORT"), word("feedback", "피드백", "I learn a lot from detailed feedback.", "CAREER_SKILL_PLAN"), word("confidence", "자신감", "Better speaking skills will give me more confidence.", "CAREER_SKILL_REASON")], phrases=[phrase("step out of my comfort zone", "익숙한 범위를 벗어나다", "I need to step out of my comfort zone more often.", "CAREER_SKILL_ACTION"), phrase("practice in real situations", "실제 상황에서 연습하다", "I want to practice in real situations at work.", "CAREER_SKILL_PLAN"), phrase("track my progress", "진행 상황을 기록하다", "I will track my progress every month.", "CAREER_SKILL_PLAN"), phrase("by the end of the year", "올해 말까지", "By the end of the year, I want to speak more clearly.", "CAREER_SKILL_TIME")]),
        topic("Reading Habit", focus_en="reading habit you want to build this year", focus_ko="올해 만들고 싶은 독서 습관", words=[word("chapter", "한 장", "I want to read one chapter a day.", "READING_HABIT"), word("consistency", "꾸준함", "Consistency matters more than speed.", "READING_HABIT_REASON"), word("bedtime", "잠들기 전 시간", "Bedtime is the best time for reading.", "READING_HABIT_TIME"), word("paperback", "종이책", "A paperback feels easier on my eyes.", "READING_HABIT_DETAIL"), word("bookmark", "책갈피", "I keep a bookmark in my bag all the time.", "READING_HABIT_DETAIL")], phrases=[phrase("read a few pages", "몇 쪽 읽다", "I can always read a few pages before bed.", "READING_HABIT_PLAN"), phrase("set aside time", "따로 시간을 떼어 두다", "I need to set aside time every evening.", "READING_HABIT_PLAN"), phrase("instead of scrolling", "스크롤하는 대신", "I want to read instead of scrolling on my phone.", "READING_HABIT_REASON"), phrase("keep the habit going", "습관을 계속 이어 가다", "A simple schedule helps me keep the habit going.", "READING_HABIT_PROGRESS")]),
        topic("Savings Goal", focus_en="savings goal you want to reach this year", focus_ko="올해 이루고 싶은 저축 목표", words=[word("budget", "예산", "I need a realistic budget for each month.", "SAVINGS_GOAL"), word("expense", "지출", "I want to reduce small unnecessary expenses.", "SAVINGS_GOAL_REASON"), word("emergency fund", "비상금", "An emergency fund would make me feel safer.", "SAVINGS_GOAL_REASON"), word("salary", "월급", "I will save part of my salary every month.", "SAVINGS_GOAL_PLAN"), word("target", "목표 금액", "My target is to save a clear amount by winter.", "SAVINGS_GOAL_TIME")], phrases=[phrase("put money aside", "돈을 따로 빼 두다", "I want to put money aside right after payday.", "SAVINGS_GOAL_PLAN"), phrase("cut back on", "~을 줄이다", "I will cut back on unnecessary delivery orders.", "SAVINGS_GOAL_ACTION"), phrase("keep track of spending", "지출을 기록하다", "I need to keep track of spending more carefully.", "SAVINGS_GOAL_PLAN"), phrase("reach my target", "목표에 도달하다", "I hope to reach my target before the end of the year.", "SAVINGS_GOAL_PROGRESS")]),
        topic("Fitness Routine", focus_en="fitness routine you want to keep this year", focus_ko="올해 유지하고 싶은 운동 루틴", words=[word("stamina", "체력", "I want to improve my stamina first.", "FITNESS_GOAL"), word("workout", "운동", "A short workout is better than skipping it.", "FITNESS_GOAL_ACTION"), word("recovery", "회복", "Recovery is part of a good fitness routine.", "FITNESS_GOAL_DETAIL"), word("schedule", "일정", "A fixed schedule helps me stay consistent.", "FITNESS_GOAL_PLAN"), word("motivation", "동기", "Music gives me motivation to keep going.", "FITNESS_GOAL_REASON")], phrases=[phrase("stay active", "활동적으로 지내다", "I want to stay active throughout the year.", "FITNESS_GOAL_REASON"), phrase("build up slowly", "천천히 늘려 가다", "I plan to build up slowly instead of doing too much at once.", "FITNESS_GOAL_PLAN"), phrase("three times a week", "일주일에 세 번", "I want to exercise three times a week.", "FITNESS_GOAL_TIME"), phrase("keep myself accountable", "스스로 꾸준히 지키다", "A written plan helps me keep myself accountable.", "FITNESS_GOAL_PROGRESS")]),
        topic("Creative Project", focus_en="creative project you want to finish this year", focus_ko="올해 끝내고 싶은 창작 프로젝트", words=[word("draft", "초안", "I want to finish a strong first draft soon.", "CREATIVE_PROJECT"), word("inspiration", "영감", "Travel gives me a lot of inspiration.", "CREATIVE_PROJECT_REASON"), word("deadline", "마감", "A deadline helps me stay focused.", "CREATIVE_PROJECT_PLAN"), word("sketch", "스케치", "I usually begin with a quick sketch.", "CREATIVE_PROJECT_ACTION"), word("portfolio", "포트폴리오", "I want to add it to my portfolio later.", "CREATIVE_PROJECT_RESULT")], phrases=[phrase("work on it regularly", "꾸준히 작업하다", "I want to work on it regularly every weekend.", "CREATIVE_PROJECT_PLAN"), phrase("finish a small part", "작은 부분부터 끝내다", "I will finish a small part each week.", "CREATIVE_PROJECT_PLAN"), phrase("turn an idea into something real", "아이디어를 실제 결과물로 만들다", "I want to turn an idea into something real this year.", "CREATIVE_PROJECT_REASON"), phrase("share the result", "결과물을 공유하다", "In the end, I hope to share the result online.", "CREATIVE_PROJECT_RESULT")]),
    ],
    "problem": [
        topic("Decision Making", topic_en="making decisions quickly", topic_ko="빨리 결정을 내려야 할 때", words=[word("option", "선택지", "I often have too many options at once.", "DECISION_MAKING"), word("priority", "우선순위", "Setting a priority helps me decide faster.", "DECISION_MAKING_REASON"), word("deadline", "마감", "A short deadline makes it harder to think clearly.", "DECISION_MAKING_DETAIL"), word("regret", "후회", "Sometimes I worry that I will regret my choice.", "DECISION_MAKING_FEELING"), word("compare", "비교하다", "I compare two main options first.", "DECISION_MAKING_ACTION")], phrases=[phrase("weigh the pros and cons", "장단점을 따져 보다", "I try to weigh the pros and cons before choosing.", "DECISION_MAKING_ACTION"), phrase("set a time limit", "시간 제한을 두다", "I set a time limit so I do not overthink.", "DECISION_MAKING_ACTION"), phrase("ask for advice", "조언을 구하다", "If I feel stuck, I ask for advice.", "DECISION_MAKING_SUPPORT"), phrase("make a quick choice", "빠르게 선택하다", "Sometimes I have to make a quick choice at work.", "DECISION_MAKING_DETAIL")]),
        topic("Group Projects", topic_en="working on group projects", topic_ko="조별 과제나 팀 프로젝트를 할 때", words=[word("coordination", "조율", "Coordination is often the hardest part.", "GROUP_PROJECT"), word("role", "역할", "Clear roles make the project smoother.", "GROUP_PROJECT_REASON"), word("conflict", "갈등", "Small conflicts can slow everyone down.", "GROUP_PROJECT_DETAIL"), word("deadline", "마감", "We all feel pressure before the deadline.", "GROUP_PROJECT_DETAIL"), word("communication", "소통", "Good communication solves many problems.", "GROUP_PROJECT_ACTION")], phrases=[phrase("divide the work", "일을 나누다", "We divide the work early in the project.", "GROUP_PROJECT_ACTION"), phrase("keep everyone on the same page", "모두가 같은 방향을 보게 하다", "A shared document helps keep everyone on the same page.", "GROUP_PROJECT_ACTION"), phrase("run into delays", "지연이 생기다", "We sometimes run into delays when someone is busy.", "GROUP_PROJECT_DETAIL"), phrase("check in regularly", "정기적으로 확인하다", "I try to check in regularly with my teammates.", "GROUP_PROJECT_ACTION")]),
        topic("Staying Focused", topic_en="trying to stay focused", topic_ko="집중을 유지하려고 할 때", words=[word("distraction", "방해 요소", "Phone notifications are a big distraction for me.", "FOCUS_PROBLEM"), word("timer", "타이머", "A timer helps me stay on one task.", "FOCUS_SOLUTION"), word("task list", "할 일 목록", "A short task list makes things clearer.", "FOCUS_SOLUTION"), word("concentration", "집중력", "My concentration drops in the afternoon.", "FOCUS_DETAIL"), word("break", "휴식", "A short break helps me reset my mind.", "FOCUS_SOLUTION")], phrases=[phrase("put my phone away", "휴대폰을 치워 두다", "I put my phone away before I start working.", "FOCUS_SOLUTION"), phrase("focus on one task", "한 가지 일에만 집중하다", "It is easier when I focus on one task at a time.", "FOCUS_SOLUTION"), phrase("lose my concentration", "집중이 흐트러지다", "I lose my concentration when the room is noisy.", "FOCUS_DETAIL"), phrase("take a short break", "짧게 쉬다", "If I feel tired, I take a short break and come back.", "FOCUS_SOLUTION")]),
        topic("Unexpected Changes", topic_en="dealing with unexpected changes", topic_ko="예상치 못한 변화에 대응할 때", words=[word("schedule", "일정", "My schedule changes suddenly from time to time.", "UNEXPECTED_CHANGES"), word("delay", "지연", "A delay can affect everything else that day.", "UNEXPECTED_CHANGES_DETAIL"), word("backup", "대안", "A backup plan makes me feel safer.", "UNEXPECTED_CHANGES_SOLUTION"), word("adapt", "적응하다", "I try to adapt instead of panicking.", "UNEXPECTED_CHANGES_SOLUTION"), word("stress", "스트레스", "Too many changes create a lot of stress.", "UNEXPECTED_CHANGES_FEELING")], phrases=[phrase("at the last minute", "마지막 순간에", "Plans sometimes change at the last minute.", "UNEXPECTED_CHANGES_DETAIL"), phrase("come up with a backup plan", "대안을 마련하다", "I come up with a backup plan as quickly as possible.", "UNEXPECTED_CHANGES_SOLUTION"), phrase("adjust my schedule", "일정을 조정하다", "Then I adjust my schedule and keep going.", "UNEXPECTED_CHANGES_SOLUTION"), phrase("stay calm", "침착함을 유지하다", "I try to stay calm before making a new plan.", "UNEXPECTED_CHANGES_FEELING")]),
        topic("Overthinking", topic_en="overthinking small mistakes", topic_ko="작은 실수를 지나치게 곱씹을 때", words=[word("doubt", "의심", "A small mistake can create a lot of doubt.", "OVERTHINKING"), word("scenario", "상황을 머릿속으로 그린 경우", "I imagine too many negative scenarios.", "OVERTHINKING_DETAIL"), word("pressure", "압박", "That habit puts extra pressure on me.", "OVERTHINKING_FEELING"), word("confidence", "자신감", "Overthinking lowers my confidence.", "OVERTHINKING_RESULT"), word("mistake", "실수", "Even a small mistake can stay in my mind for hours.", "OVERTHINKING_DETAIL")], phrases=[phrase("get stuck in my head", "생각 속에 갇히다", "I get stuck in my head after a small mistake.", "OVERTHINKING_FEELING"), phrase("worry too much", "너무 걱정하다", "I sometimes worry too much about what others think.", "OVERTHINKING_DETAIL"), phrase("remind myself", "스스로에게 다시 말해 주다", "I remind myself that one mistake is not everything.", "OVERTHINKING_SOLUTION"), phrase("take action first", "먼저 행동하다", "It helps to take action first instead of thinking in circles.", "OVERTHINKING_SOLUTION")]),
    ],
    "balance": [
        topic("Cashless Payments", subject_en="cashless payments", subject_ko="현금 없는 결제 방식", words=[word("convenience", "편리함", "Convenience is the biggest reason people use them.", "CASHLESS_PAYMENTS"), word("privacy", "사생활 보호", "Some people worry about privacy issues.", "CASHLESS_PAYMENTS_CON"), word("transaction", "거래", "Each transaction is recorded automatically.", "CASHLESS_PAYMENTS_DETAIL"), word("spending", "지출", "Easy payments can increase careless spending.", "CASHLESS_PAYMENTS_CON"), word("security", "보안", "Security is very important for digital payments.", "CASHLESS_PAYMENTS_PRO")], phrases=[phrase("make payments quickly", "빠르게 결제하다", "People can make payments quickly with just a phone.", "CASHLESS_PAYMENTS_PRO"), phrase("leave a digital record", "디지털 기록을 남기다", "They leave a digital record of every purchase.", "CASHLESS_PAYMENTS_DETAIL"), phrase("lose track of spending", "지출 감각을 잃다", "Some people lose track of spending more easily.", "CASHLESS_PAYMENTS_CON"), phrase("depend on a device", "기기에 의존하다", "You also depend on a device or network connection.", "CASHLESS_PAYMENTS_CON")]),
        topic("Short-Form Videos", subject_en="short-form videos", subject_ko="숏폼 영상", words=[word("trend", "유행", "Short-form videos spread trends very fast.", "SHORT_FORM_VIDEO"), word("clip", "짧은 영상 클립", "A single clip can reach millions of viewers.", "SHORT_FORM_VIDEO_DETAIL"), word("distraction", "주의 산만", "They can become a strong distraction.", "SHORT_FORM_VIDEO_CON"), word("creativity", "창의성", "They also allow creative people to share ideas.", "SHORT_FORM_VIDEO_PRO"), word("attention span", "집중 시간", "Some people think they reduce attention span.", "SHORT_FORM_VIDEO_CON")], phrases=[phrase("in a short time", "짧은 시간 안에", "People can learn or laugh in a short time.", "SHORT_FORM_VIDEO_PRO"), phrase("keep people entertained", "사람들을 즐겁게 하다", "They keep people entertained during breaks.", "SHORT_FORM_VIDEO_PRO"), phrase("reduce attention span", "집중 시간을 줄이다", "Watching too many clips may reduce attention span.", "SHORT_FORM_VIDEO_CON"), phrase("find new ideas", "새로운 아이디어를 찾다", "I sometimes find new ideas through short videos.", "SHORT_FORM_VIDEO_PRO")]),
        topic("Food Delivery Apps", subject_en="food delivery apps", subject_ko="배달 앱", words=[word("fee", "수수료", "High delivery fees can be frustrating.", "DELIVERY_APP_CON"), word("restaurant", "식당", "The app connects many local restaurants.", "DELIVERY_APP_DETAIL"), word("delivery", "배달", "Fast delivery is the main attraction for many users.", "DELIVERY_APP_PRO"), word("habit", "습관", "Using it too often can become an expensive habit.", "DELIVERY_APP_CON"), word("convenience", "편리함", "Convenience is the biggest benefit of delivery apps.", "DELIVERY_APP_PRO")], phrases=[phrase("order food easily", "쉽게 음식을 주문하다", "People can order food easily after a long day.", "DELIVERY_APP_PRO"), phrase("save time", "시간을 절약하다", "It saves time when people are busy.", "DELIVERY_APP_PRO"), phrase("cost extra money", "추가 비용이 들다", "Still, it can cost extra money every time.", "DELIVERY_APP_CON"), phrase("rely on them too much", "너무 의존하다", "Some people rely on them too much instead of cooking.", "DELIVERY_APP_CON")]),
        topic("Online Reviews", subject_en="online reviews", subject_ko="온라인 후기", words=[word("rating", "평점", "A high rating often attracts more customers.", "ONLINE_REVIEWS"), word("trust", "신뢰", "People often trust reviews from real users.", "ONLINE_REVIEWS_PRO"), word("bias", "편향", "Some reviews show a strong personal bias.", "ONLINE_REVIEWS_CON"), word("experience", "경험", "Good reviews usually describe a clear experience.", "ONLINE_REVIEWS_DETAIL"), word("choice", "선택", "Reviews influence people's choices every day.", "ONLINE_REVIEWS_PRO")], phrases=[phrase("help people decide", "사람들이 결정하게 돕다", "They help people decide more quickly.", "ONLINE_REVIEWS_PRO"), phrase("be misleading", "오해를 줄 수 있다", "Some reviews can be misleading or incomplete.", "ONLINE_REVIEWS_CON"), phrase("based on real experience", "실제 경험에 바탕을 둔", "The best ones are based on real experience.", "ONLINE_REVIEWS_DETAIL"), phrase("shape people's choices", "사람들의 선택에 영향을 주다", "A few comments can shape people's choices a lot.", "ONLINE_REVIEWS_PRO")]),
        topic("Wearable Devices", subject_en="wearable devices", subject_ko="웨어러블 기기", words=[word("motivation", "동기부여", "Step counts can give people motivation.", "WEARABLE_DEVICES_PRO"), word("accuracy", "정확도", "The accuracy is not always perfect.", "WEARABLE_DEVICES_CON"), word("privacy", "사생활", "Some people worry about privacy and data sharing.", "WEARABLE_DEVICES_CON"), word("step count", "걸음 수", "Many users check their step count every day.", "WEARABLE_DEVICES_DETAIL"), word("health data", "건강 데이터", "Health data can be useful when it is used carefully.", "WEARABLE_DEVICES_DETAIL")], phrases=[phrase("track daily habits", "하루 습관을 추적하다", "They help people track daily habits more easily.", "WEARABLE_DEVICES_PRO"), phrase("encourage healthier choices", "더 건강한 선택을 하게 하다", "The reminders encourage healthier choices.", "WEARABLE_DEVICES_PRO"), phrase("depend on numbers", "숫자에 지나치게 의존하다", "Some people depend on numbers too much.", "WEARABLE_DEVICES_CON"), phrase("share personal data", "개인 데이터를 공유하다", "Users may not want to share personal data.", "WEARABLE_DEVICES_CON")]),
    ],
    "opinion": [
        topic("Public Libraries", subject_en="public libraries", subject_ko="공공도서관", words=[word("resource", "자원", "Libraries are valuable resources for many people.", "PUBLIC_LIBRARIES"), word("community", "공동체", "A library can strengthen a local community.", "PUBLIC_LIBRARIES_REASON"), word("access", "접근성", "They give people access to books and information.", "PUBLIC_LIBRARIES_REASON"), word("budget", "예산", "Libraries need stable budgets to stay useful.", "PUBLIC_LIBRARIES_SUPPORT"), word("learning", "배움", "They support learning at every age.", "PUBLIC_LIBRARIES_REASON")], phrases=[phrase("remain open to everyone", "모두에게 열려 있다", "I think libraries should remain open to everyone.", "PUBLIC_LIBRARIES_VIEW"), phrase("support lifelong learning", "평생학습을 지원하다", "They support lifelong learning in practical ways.", "PUBLIC_LIBRARIES_REASON"), phrase("offer more than books", "책 이상의 것을 제공하다", "Modern libraries offer more than books.", "PUBLIC_LIBRARIES_DETAIL"), phrase("deserve public support", "공적 지원을 받을 가치가 있다", "That is why they deserve public support.", "PUBLIC_LIBRARIES_CONCLUSION")]),
        topic("School Uniforms", subject_en="school uniforms in public schools", subject_ko="공립학교 교복", words=[word("equality", "평등", "Some people say uniforms create a sense of equality.", "SCHOOL_UNIFORMS"), word("discipline", "규율", "Uniforms may help build discipline at school.", "SCHOOL_UNIFORMS_REASON"), word("expression", "표현", "Others think they limit personal expression.", "SCHOOL_UNIFORMS_CON"), word("identity", "정체성", "A uniform can create a shared school identity.", "SCHOOL_UNIFORMS_REASON"), word("rule", "규칙", "Clear rules can reduce daily confusion.", "SCHOOL_UNIFORMS_DETAIL")], phrases=[phrase("create a sense of unity", "일체감을 만들다", "Uniforms can create a sense of unity among students.", "SCHOOL_UNIFORMS_REASON"), phrase("limit self-expression", "자기표현을 제한하다", "At the same time, they can limit self-expression.", "SCHOOL_UNIFORMS_CON"), phrase("reduce peer pressure", "또래 압박을 줄이다", "They may reduce peer pressure about fashion.", "SCHOOL_UNIFORMS_REASON"), phrase("need flexible rules", "유연한 규칙이 필요하다", "If schools use uniforms, they still need flexible rules.", "SCHOOL_UNIFORMS_VIEW")]),
        topic("Recycling Programs", subject_en="recycling programs", subject_ko="재활용 프로그램", words=[word("waste", "쓰레기", "Good recycling programs can reduce waste.", "RECYCLING_PROGRAMS"), word("sorting", "분리배출", "Sorting takes effort, but it matters.", "RECYCLING_PROGRAMS_DETAIL"), word("participation", "참여", "Programs only work with active participation.", "RECYCLING_PROGRAMS_REASON"), word("environment", "환경", "They can help protect the environment.", "RECYCLING_PROGRAMS_REASON"), word("habit", "습관", "Recycling should become a daily habit.", "RECYCLING_PROGRAMS_VIEW")], phrases=[phrase("make recycling easier", "재활용을 더 쉽게 만들다", "Clear labels make recycling easier for everyone.", "RECYCLING_PROGRAMS_REASON"), phrase("reduce unnecessary waste", "불필요한 쓰레기를 줄이다", "Strong programs reduce unnecessary waste.", "RECYCLING_PROGRAMS_REASON"), phrase("need public education", "공공 교육이 필요하다", "They also need public education to work well.", "RECYCLING_PROGRAMS_SUPPORT"), phrase("be part of daily life", "일상의 일부가 되다", "In my opinion, they should be part of daily life.", "RECYCLING_PROGRAMS_VIEW")]),
        topic("Teenagers' Part-Time Jobs", subject_en="part-time jobs for teenagers", subject_ko="청소년의 아르바이트", words=[word("responsibility", "책임감", "Part-time work can build responsibility.", "TEEN_PART_TIME"), word("income", "수입", "Some teenagers want extra income for practical reasons.", "TEEN_PART_TIME_REASON"), word("balance", "균형", "The real issue is finding a healthy balance.", "TEEN_PART_TIME_VIEW"), word("experience", "경험", "Work experience can teach useful social skills.", "TEEN_PART_TIME_REASON"), word("schedule", "일정", "A busy schedule can become stressful.", "TEEN_PART_TIME_CON")], phrases=[phrase("teach practical skills", "실용적인 기술을 가르치다", "A job can teach practical skills early on.", "TEEN_PART_TIME_REASON"), phrase("take too much time", "너무 많은 시간을 빼앗다", "It can take too much time during school terms.", "TEEN_PART_TIME_CON"), phrase("help teenagers mature", "청소년이 성숙해지도록 돕다", "It may help teenagers mature more quickly.", "TEEN_PART_TIME_REASON"), phrase("need clear limits", "분명한 제한이 필요하다", "That is why I think they need clear limits.", "TEEN_PART_TIME_VIEW")]),
        topic("Community Arts Programs", subject_en="community arts programs", subject_ko="지역 예술 프로그램", words=[word("creativity", "창의성", "Arts programs can strengthen creativity.", "COMMUNITY_ARTS"), word("funding", "지원금", "Stable funding is important for these programs.", "COMMUNITY_ARTS_SUPPORT"), word("participation", "참여", "Higher participation makes the program more meaningful.", "COMMUNITY_ARTS_DETAIL"), word("talent", "재능", "These programs can help young people discover talent.", "COMMUNITY_ARTS_REASON"), word("neighborhood", "동네", "They can make a neighborhood feel more alive.", "COMMUNITY_ARTS_REASON")], phrases=[phrase("bring people together", "사람들을 모으다", "They can bring people together in a natural way.", "COMMUNITY_ARTS_REASON"), phrase("need local support", "지역의 지원이 필요하다", "They need local support to continue.", "COMMUNITY_ARTS_SUPPORT"), phrase("give young people opportunities", "청소년에게 기회를 주다", "They give young people opportunities to grow.", "COMMUNITY_ARTS_REASON"), phrase("make communities more vibrant", "공동체를 더 활기차게 만들다", "In the long run, they make communities more vibrant.", "COMMUNITY_ARTS_CONCLUSION")]),
    ],
    "reflection": [
        topic("Friendship", subject_en="friendship", subject_ko="우정", words=[word("trust", "신뢰", "Trust matters much more to me now.", "FRIENDSHIP_REFLECTION"), word("boundary", "경계", "Healthy boundaries are part of real friendship.", "FRIENDSHIP_REFLECTION_REASON"), word("support", "지지", "Good friends offer honest support.", "FRIENDSHIP_REFLECTION_DETAIL"), word("connection", "연결감", "I value a deeper connection now.", "FRIENDSHIP_REFLECTION_RESULT"), word("effort", "노력", "Friendship takes effort from both sides.", "FRIENDSHIP_REFLECTION_REASON")], phrases=[phrase("used to think", "예전에는 ...라고 생각했다", "I used to think more friends always meant better friendships.", "FRIENDSHIP_REFLECTION_CONTRAST"), phrase("over time, I realized", "시간이 지나며 ...를 깨달았다", "Over time, I realized that trust matters more.", "FRIENDSHIP_REFLECTION_CAUSE"), phrase("stay close to", "~와 가까이 지내다", "Now I try to stay close to a few trusted people.", "FRIENDSHIP_REFLECTION_RESULT"), phrase("value quality over quantity", "양보다 질을 더 중요하게 여기다", "Now I value quality over quantity in friendship.", "FRIENDSHIP_REFLECTION_RESULT")]),
        topic("Healthy Eating", subject_en="healthy eating", subject_ko="건강한 식습관", words=[word("nutrition", "영양", "I pay more attention to nutrition now.", "HEALTHY_EATING_REFLECTION"), word("balance", "균형", "Balance matters more than strict rules for me.", "HEALTHY_EATING_REFLECTION_RESULT"), word("energy", "에너지", "Better meals give me more energy during the day.", "HEALTHY_EATING_REFLECTION_REASON"), word("portion", "양", "I also think more about portion size now.", "HEALTHY_EATING_REFLECTION_DETAIL"), word("habit", "습관", "Healthy eating is more about habit than willpower.", "HEALTHY_EATING_REFLECTION_REASON")], phrases=[phrase("pay more attention to", "~에 더 신경 쓰다", "I pay more attention to what I eat now.", "HEALTHY_EATING_REFLECTION_RESULT"), phrase("used to ignore", "예전에는 신경 쓰지 않았다", "I used to ignore how food affected my body.", "HEALTHY_EATING_REFLECTION_CONTRAST"), phrase("feel the difference", "차이를 느끼다", "After a few months, I could feel the difference.", "HEALTHY_EATING_REFLECTION_CAUSE"), phrase("make better choices", "더 나은 선택을 하다", "Now I try to make better choices each day.", "HEALTHY_EATING_REFLECTION_RESULT")]),
        topic("News Consumption", subject_en="news consumption", subject_ko="뉴스를 보는 방식", words=[word("headline", "기사 제목", "I no longer trust a headline alone.", "NEWS_REFLECTION"), word("source", "출처", "Now I check the source much more carefully.", "NEWS_REFLECTION_REASON"), word("bias", "편향", "Bias is easier to notice once you look for it.", "NEWS_REFLECTION_DETAIL"), word("update", "업데이트", "I do not need every update right away anymore.", "NEWS_REFLECTION_RESULT"), word("verification", "확인, 검증", "Verification matters more to me now.", "NEWS_REFLECTION_REASON")], phrases=[phrase("check different sources", "여러 출처를 확인하다", "Now I check different sources before forming an opinion.", "NEWS_REFLECTION_RESULT"), phrase("avoid reacting too quickly", "너무 빨리 반응하지 않다", "I try to avoid reacting too quickly to breaking news.", "NEWS_REFLECTION_RESULT"), phrase("used to believe", "예전에는 믿었다", "I used to believe the first version I saw.", "NEWS_REFLECTION_CONTRAST"), phrase("be more careful", "더 신중해지다", "That experience taught me to be more careful.", "NEWS_REFLECTION_CAUSE")]),
        topic("Travel", subject_en="travel", subject_ko="여행", words=[word("itinerary", "여행 일정", "I used to care too much about a perfect itinerary.", "TRAVEL_REFLECTION"), word("culture", "문화", "Now I value local culture more than shopping.", "TRAVEL_REFLECTION_RESULT"), word("experience", "경험", "Travel feels more like an experience to me now.", "TRAVEL_REFLECTION_REASON"), word("comfort zone", "안전한 범위", "Travel helped me step outside my comfort zone.", "TRAVEL_REFLECTION_CAUSE"), word("perspective", "시각", "It changed my perspective in a positive way.", "TRAVEL_REFLECTION_RESULT")], phrases=[phrase("step outside my comfort zone", "익숙한 범위를 벗어나다", "Travel helped me step outside my comfort zone.", "TRAVEL_REFLECTION_CAUSE"), phrase("used to think of travel as", "예전에는 여행을 ...라고 생각했다", "I used to think of travel as simple fun.", "TRAVEL_REFLECTION_CONTRAST"), phrase("changed my perspective", "시각을 바꾸었다", "Meeting new people changed my perspective.", "TRAVEL_REFLECTION_RESULT"), phrase("value the experience more", "경험 자체를 더 중요하게 여기다", "Now I value the experience more than the plan.", "TRAVEL_REFLECTION_RESULT")]),
        topic("Failure", subject_en="failure", subject_ko="실패", words=[word("setback", "좌절, 차질", "I now see failure as a setback, not the end.", "FAILURE_REFLECTION"), word("lesson", "교훈", "A failure can become a useful lesson.", "FAILURE_REFLECTION_REASON"), word("growth", "성장", "Growth often comes after difficult moments.", "FAILURE_REFLECTION_RESULT"), word("pressure", "압박", "I used to feel strong pressure after every mistake.", "FAILURE_REFLECTION_CONTRAST"), word("resilience", "회복력", "Now I think resilience is more important than perfection.", "FAILURE_REFLECTION_RESULT")], phrases=[phrase("used to fear", "예전에는 두려워했다", "I used to fear failure more than I do now.", "FAILURE_REFLECTION_CONTRAST"), phrase("learn from mistakes", "실수에서 배우다", "I try to learn from mistakes instead of hiding them.", "FAILURE_REFLECTION_RESULT"), phrase("bounce back", "다시 일어나다", "The important thing is how quickly you bounce back.", "FAILURE_REFLECTION_RESULT"), phrase("part of growth", "성장의 일부", "Now I see failure as part of growth.", "FAILURE_REFLECTION_RESULT")]),
    ],
    "general": [
        topic("Favorite Small Shop", subject_en="small shop you like", subject_ko="좋아하는 작은 가게", words=[word("owner", "주인", "The owner is always warm and welcoming.", "SMALL_SHOP"), word("shelf", "진열대", "The shelves are always neatly arranged.", "SMALL_SHOP_DETAIL"), word("atmosphere", "분위기", "I love the calm atmosphere there.", "SMALL_SHOP_REASON"), word("regular", "단골", "I became a regular customer last year.", "SMALL_SHOP_DETAIL"), word("neighborhood", "동네", "It is one of my favorite places in the neighborhood.", "SMALL_SHOP_PLACE")], phrases=[phrase("drop by often", "자주 들르다", "I drop by often after work.", "SMALL_SHOP_ACTION"), phrase("know the owner", "주인을 알다", "I know the owner well enough to chat for a minute.", "SMALL_SHOP_DETAIL"), phrase("feel welcome", "환영받는 느낌이 들다", "I always feel welcome when I visit.", "SMALL_SHOP_FEELING"), phrase("support local businesses", "지역 가게를 응원하다", "I like supporting local businesses like this one.", "SMALL_SHOP_REASON")]),
        topic("Useful Website", subject_en="website you find useful", subject_ko="유용하게 쓰는 웹사이트", words=[word("tutorial", "설명 자료, 튜토리얼", "The site has many clear tutorials.", "USEFUL_WEBSITE"), word("resource", "자료", "It is one of my best study resources.", "USEFUL_WEBSITE_REASON"), word("bookmark", "북마크하다", "I bookmarked it a long time ago.", "USEFUL_WEBSITE_DETAIL"), word("feature", "기능", "One feature saves me a lot of time.", "USEFUL_WEBSITE_DETAIL"), word("search", "검색", "The search function works very well.", "USEFUL_WEBSITE_ACTION")], phrases=[phrase("use it whenever I need", "필요할 때마다 쓰다", "I use it whenever I need quick information.", "USEFUL_WEBSITE_ACTION"), phrase("easy to navigate", "둘러보기 쉽다", "The website is easy to navigate, even for beginners.", "USEFUL_WEBSITE_REASON"), phrase("save me a lot of time", "시간을 많이 절약해 주다", "It saves me a lot of time when I study.", "USEFUL_WEBSITE_REASON"), phrase("recommend it to others", "다른 사람에게 추천하다", "I often recommend it to friends.", "USEFUL_WEBSITE_CONCLUSION")]),
        topic("Family Tradition", subject_en="family tradition you value", subject_ko="소중하게 여기는 가족 전통", words=[word("gathering", "모임", "The tradition usually begins with a family gathering.", "FAMILY_TRADITION"), word("recipe", "요리법", "We still use the same recipe every year.", "FAMILY_TRADITION_DETAIL"), word("holiday", "명절, 기념일", "We do it during a holiday season.", "FAMILY_TRADITION_TIME"), word("memory", "추억", "It brings back warm memories for everyone.", "FAMILY_TRADITION_REASON"), word("generation", "세대", "The tradition connects different generations.", "FAMILY_TRADITION_REASON")], phrases=[phrase("look forward to it", "그날을 기다리다", "I always look forward to it every year.", "FAMILY_TRADITION_FEELING"), phrase("pass it down", "물려주다", "My parents want to pass it down to us.", "FAMILY_TRADITION_DETAIL"), phrase("bring everyone together", "모두를 한자리에 모으다", "It brings everyone together, even when we are busy.", "FAMILY_TRADITION_REASON"), phrase("make it feel special", "특별하게 느끼게 하다", "Small details make it feel special every time.", "FAMILY_TRADITION_REASON")]),
        topic("Place to Walk", subject_en="place where you like to walk", subject_ko="걷기 좋아하는 장소", words=[word("path", "길, 산책로", "There is a quiet path near the river.", "WALKING_PLACE"), word("breeze", "산들바람", "A cool breeze makes the walk even better.", "WALKING_PLACE_FEELING"), word("bench", "벤치", "There are a few benches along the path.", "WALKING_PLACE_DETAIL"), word("view", "풍경", "The view changes beautifully at sunset.", "WALKING_PLACE_REASON"), word("trees", "나무", "Tall trees make the whole place feel calm.", "WALKING_PLACE_DETAIL")], phrases=[phrase("clear my mind", "머리를 맑게 하다", "Walking there helps me clear my mind.", "WALKING_PLACE_REASON"), phrase("go there in the evening", "저녁에 그곳에 가다", "I usually go there in the evening.", "WALKING_PLACE_TIME"), phrase("enjoy the view", "풍경을 즐기다", "I slow down and enjoy the view.", "WALKING_PLACE_REASON"), phrase("feel calm there", "거기 가면 차분해지다", "I always feel calm there.", "WALKING_PLACE_FEELING")]),
        topic("Household Item", subject_en="household item you use often", subject_ko="자주 쓰는 생활용품", words=[word("container", "용기", "A simple container can be more useful than expected.", "HOUSEHOLD_ITEM"), word("drawer", "서랍", "I keep it in a kitchen drawer.", "HOUSEHOLD_ITEM_DETAIL"), word("charger", "충전기", "A good charger is essential in daily life.", "HOUSEHOLD_ITEM_REASON"), word("organized", "정돈된", "It helps me stay organized every day.", "HOUSEHOLD_ITEM_REASON"), word("convenient", "편리한", "It is convenient because I use it all the time.", "HOUSEHOLD_ITEM_REASON")], phrases=[phrase("use it every day", "매일 쓰다", "I use it every day without even thinking about it.", "HOUSEHOLD_ITEM_DETAIL"), phrase("make life easier", "생활을 더 편하게 만들다", "It really makes life easier.", "HOUSEHOLD_ITEM_REASON"), phrase("keep things organized", "물건을 정리된 상태로 두다", "It helps me keep things organized in one place.", "HOUSEHOLD_ITEM_REASON"), phrase("can't imagine living without it", "그것 없이 사는 걸 상상하기 어렵다", "Now I cannot imagine living without it.", "HOUSEHOLD_ITEM_FEELING")]),
    ],
}


def sql_string(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def normalize_question(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def parse_env_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def load_db_config() -> dict[str, Any]:
    env = parse_env_file(ENV_PATH)
    match = re.match(r"jdbc:mysql://(?P<host>[^:/?#]+)(?::(?P<port>\d+))?/(?P<database>[^?]+)", env["SPRING_DATASOURCE_URL"])
    if not match:
        raise RuntimeError("Could not parse SPRING_DATASOURCE_URL from .env")
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


def fetch_existing_state(connection: Any) -> dict[str, Any]:
    state: dict[str, Any] = {
        "max_prompt_display_order": 1200,
        "max_detail_order_by_category": {},
        "question_to_ids": defaultdict(set),
        "detail_names_by_category": defaultdict(set),
    }
    with connection.cursor() as cursor:
        cursor.execute("SELECT COALESCE(MAX(display_order), 1200) AS max_order FROM prompts")
        state["max_prompt_display_order"] = int(cursor.fetchone()["max_order"] or 1200)
        cursor.execute(
            """
            SELECT c.name AS category_name, COALESCE(MAX(d.display_order), 0) AS max_order
            FROM prompt_topic_categories c
            LEFT JOIN prompt_topic_details d ON d.category_id = c.id
            GROUP BY c.id, c.name
            """
        )
        for row in cursor.fetchall():
            state["max_detail_order_by_category"][row["category_name"]] = int(row["max_order"] or 0)
        cursor.execute("SELECT id, question_en FROM prompts")
        for row in cursor.fetchall():
            normalized = normalize_question(row["question_en"])
            if normalized:
                state["question_to_ids"][normalized].add(row["id"])
        cursor.execute(
            """
            SELECT c.name AS category_name, d.name AS detail_name
            FROM prompt_topic_details d
            JOIN prompt_topic_categories c ON c.id = d.category_id
            """
        )
        for row in cursor.fetchall():
            state["detail_names_by_category"][row["category_name"]].add(row["detail_name"])
    return state


def build_item(item: dict[str, str], category_name: str, detail_name: str) -> dict[str, str]:
    usage_tip = item.get("usage_tip_ko") or f"{category_name} 카테고리의 {detail_name} 질문에서 자연스럽게 써 보세요."
    return {
        "item_type": item["item_type"],
        "content": item["content"],
        "meaning_ko": item["meaning_ko"],
        "usage_tip_ko": usage_tip,
        "example_en": item["example_en"],
        "expression_family": item["expression_family"],
    }


def build_records(existing_state: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    records = {"topics": [], "prompts": [], "task_profiles": [], "task_slots": [], "hints": [], "hint_items": []}
    next_prompt_order = int(existing_state["max_prompt_display_order"]) + 1
    detail_order_by_category = defaultdict(int, existing_state["max_detail_order_by_category"])

    for category_key in CATEGORY_ORDER:
        spec = CATEGORY_SPECS[category_key]
        topics = TOPICS[category_key]
        if len(topics) != 5:
            raise ValueError(f"{category_key} must have exactly 5 topics.")

        next_detail_order = detail_order_by_category[spec["category_name"]] + 1
        for topic_index, topic_row in enumerate(topics):
            records["topics"].append({"category_name": spec["category_name"], "detail_name": topic_row["detail_name"], "display_order": next_detail_order + topic_index})
            if len(topic_row["words"]) != 5 or len(topic_row["phrases"]) != 4:
                raise ValueError(f"{spec['category_name']} / {topic_row['detail_name']} must have 5 base words and 4 phrases.")
            for template_index, template in enumerate(spec["templates"], start=1):
                serial = 25 + (topic_index * 5) + template_index
                serial_token = f"{serial:02d}"
                prompt_id = f"{spec['prompt_prefix']}-{serial_token}"
                question_en, question_ko = template(topic_row)
                hint_prefix = f"{spec['hint_prefix']}-{serial_token}"
                records["prompts"].append({"id": prompt_id, "category_name": spec["category_name"], "detail_name": topic_row["detail_name"], "question_en": question_en, "question_ko": question_ko, "difficulty": spec["difficulty"], "tip": spec["tip"], "display_order": next_prompt_order, "is_active": 1})
                next_prompt_order += 1

                required_slots, optional_slots = spec["slot_factory"](template_index)
                records["task_profiles"].append({"prompt_id": prompt_id, "answer_mode_id": ANSWER_MODE_IDS[spec["answer_mode"]], "expected_tense": spec["expected_tense"], "expected_pov": spec["expected_pov"], "is_active": 1})
                slot_order = 1
                for slot_code in required_slots:
                    records["task_slots"].append({"prompt_id": prompt_id, "slot_id": SLOT_IDS[slot_code], "slot_role": "REQUIRED", "display_order": slot_order, "is_active": 1})
                    slot_order += 1
                for slot_code in optional_slots:
                    records["task_slots"].append({"prompt_id": prompt_id, "slot_id": SLOT_IDS[slot_code], "slot_role": "OPTIONAL", "display_order": slot_order, "is_active": 1})
                    slot_order += 1

                word_items = [build_item(item, spec["category_name"], topic_row["detail_name"]) for item in topic_row["words"]]
                word_items.extend(build_item(item, spec["category_name"], topic_row["detail_name"]) for item in CATEGORY_EXTRA_WORDS[category_key])

                hint_rows = [
                    {"id": f"{hint_prefix}-1", "prompt_id": prompt_id, "hint_type": "STARTER", "title": "시작 문장", "display_order": 1, "items": [build_item(spec["starter_factory"](topic_row), spec["category_name"], topic_row["detail_name"])]},
                    {"id": f"{hint_prefix}-2", "prompt_id": prompt_id, "hint_type": "VOCAB_WORD", "title": "단어 힌트", "display_order": 2, "items": word_items},
                    {"id": f"{hint_prefix}-3", "prompt_id": prompt_id, "hint_type": "VOCAB_PHRASE", "title": "표현 힌트", "display_order": 3, "items": [build_item(item, spec["category_name"], topic_row["detail_name"]) for item in topic_row["phrases"]]},
                    {"id": f"{hint_prefix}-4", "prompt_id": prompt_id, "hint_type": spec["hint4_type"], "title": spec["hint4_title"], "display_order": 4, "items": [build_item(item, spec["category_name"], topic_row["detail_name"]) for item in spec["extra_factory"](topic_row)]},
                ]
                for hint_row in hint_rows:
                    records["hints"].append({"id": hint_row["id"], "prompt_id": hint_row["prompt_id"], "hint_type": hint_row["hint_type"], "title": hint_row["title"], "display_order": hint_row["display_order"], "is_active": 1})
                    for item_index, item in enumerate(hint_row["items"], start=1):
                        records["hint_items"].append({"id": f"{hint_row['id']}-item-{item_index}", "hint_id": hint_row["id"], "display_order": item_index, "is_active": 1, **item})
    return records


def validate_records(records: dict[str, list[dict[str, Any]]], existing_state: dict[str, Any]) -> None:
    if len(records["topics"]) != 40 or len(records["prompts"]) != 200 or len(records["task_profiles"]) != 200 or len(records["hints"]) != 800 or len(records["hint_items"]) != 3400:
        raise ValueError("Generated counts do not match expected totals.")
    if len(records["task_slots"]) != 770:
        raise ValueError("Task slot row count must be 770.")

    seen_questions: dict[str, str] = {}
    for prompt_row in records["prompts"]:
        normalized = normalize_question(prompt_row["question_en"])
        existing_ids = existing_state["question_to_ids"].get(normalized, set())
        if existing_ids and prompt_row["id"] not in existing_ids:
            raise ValueError(f"Question already exists under different prompt: {prompt_row['question_en']}")
        if normalized in seen_questions and seen_questions[normalized] != prompt_row["id"]:
            raise ValueError(f"Duplicate generated question: {prompt_row['question_en']}")
        seen_questions[normalized] = prompt_row["id"]


def values_insert(table: str, columns: list[str], rows: list[tuple[Any, ...]], updates: list[str], chunk_size: int) -> list[str]:
    statements: list[str] = []
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start:start + chunk_size]
        values_sql = ",\n".join("(" + ", ".join(sql_string(value) if isinstance(value, str) or value is None else str(value) for value in row) + ")" for row in chunk)
        update_sql = ", ".join(f"{column}=VALUES({column})" for column in updates)
        statements.append(f"INSERT INTO {table} ({', '.join(columns)})\nVALUES\n{values_sql}\nON DUPLICATE KEY UPDATE {update_sql};")
    return statements


def build_sql(records: dict[str, list[dict[str, Any]]]) -> tuple[str, list[str]]:
    statements: list[str] = []
    statements.extend(values_insert("prompt_topic_categories", ["name", "display_order", "is_active"], [("Routine", 1, 1), ("Preference", 2, 1), ("Goal Plan", 3, 1), ("Problem Solving", 4, 1), ("Balanced Opinion", 5, 1), ("Opinion Reason", 6, 1), ("Change Reflection", 7, 1), ("General", 8, 1)], ["display_order", "is_active"], 50))

    for topic_row in records["topics"]:
        statements.append("\n".join(["INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)", f"SELECT c.id, {sql_string(topic_row['detail_name'])}, {topic_row['display_order']}, 1", "FROM prompt_topic_categories c", f"WHERE c.name = {sql_string(topic_row['category_name'])}", "ON DUPLICATE KEY UPDATE", "display_order = VALUES(display_order),", "is_active = VALUES(is_active);"]))

    for prompt_row in records["prompts"]:
        statements.append("\n".join(["INSERT INTO prompts (id, question_en, question_ko, difficulty, tip, display_order, is_active, topic_detail_id)", "SELECT", f"    {sql_string(prompt_row['id'])},", f"    {sql_string(prompt_row['question_en'])},", f"    {sql_string(prompt_row['question_ko'])},", f"    {sql_string(prompt_row['difficulty'])},", f"    {sql_string(prompt_row['tip'])},", f"    {prompt_row['display_order']},", "    1,", "    d.id", "FROM prompt_topic_details d", "JOIN prompt_topic_categories c ON c.id = d.category_id", f"WHERE c.name = {sql_string(prompt_row['category_name'])}", f"  AND d.name = {sql_string(prompt_row['detail_name'])}", "ON DUPLICATE KEY UPDATE", "question_en = VALUES(question_en),", "question_ko = VALUES(question_ko),", "difficulty = VALUES(difficulty),", "tip = VALUES(tip),", "display_order = VALUES(display_order),", "is_active = VALUES(is_active),", "topic_detail_id = VALUES(topic_detail_id);"]))

    statements.extend(values_insert("prompt_task_profiles", ["prompt_id", "answer_mode_id", "expected_tense", "expected_pov", "is_active"], [(row["prompt_id"], row["answer_mode_id"], row["expected_tense"], row["expected_pov"], row["is_active"]) for row in records["task_profiles"]], ["answer_mode_id", "expected_tense", "expected_pov", "is_active"], 200))
    statements.extend(values_insert("prompt_task_profile_slots", ["prompt_id", "slot_id", "slot_role", "display_order", "is_active"], [(row["prompt_id"], row["slot_id"], row["slot_role"], row["display_order"], row["is_active"]) for row in records["task_slots"]], ["display_order", "is_active"], 300))
    statements.extend(values_insert("prompt_hints", ["id", "prompt_id", "hint_type", "title", "display_order", "is_active"], [(row["id"], row["prompt_id"], row["hint_type"], row["title"], row["display_order"], row["is_active"]) for row in records["hints"]], ["hint_type", "title", "display_order", "is_active"], 250))
    statements.extend(values_insert("prompt_hint_items", ["id", "hint_id", "item_type", "content", "meaning_ko", "usage_tip_ko", "example_en", "expression_family", "display_order", "is_active"], [(row["id"], row["hint_id"], row["item_type"], row["content"], row["meaning_ko"], row["usage_tip_ko"], row["example_en"], row["expression_family"], row["display_order"], row["is_active"]) for row in records["hint_items"]], ["item_type", "content", "meaning_ko", "usage_tip_ko", "example_en", "expression_family", "display_order", "is_active"], 250))
    sql = "\n\n".join(["-- Seed 200 additional prompts with full task metadata and rich hint items.", "-- Generated by scripts/generate_prompt_batch_034.py", ""] + statements)
    return sql, statements


def validate_against_db(statements: list[str], records: dict[str, list[dict[str, Any]]]) -> None:
    connection = pymysql.connect(**load_db_config())
    prompt_ids = [row["id"] for row in records["prompts"]]
    hint_ids = [row["id"] for row in records["hints"]]
    try:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            cursor.execute(f"SELECT COUNT(*) AS count FROM prompts WHERE id IN ({', '.join(['%s'] * len(prompt_ids))})", prompt_ids)
            if int(cursor.fetchone()["count"]) != 200:
                raise ValueError("Prompt validation count mismatch.")
            cursor.execute(f"SELECT COUNT(*) AS count FROM prompt_task_profiles WHERE prompt_id IN ({', '.join(['%s'] * len(prompt_ids))})", prompt_ids)
            if int(cursor.fetchone()["count"]) != 200:
                raise ValueError("Task profile validation count mismatch.")
            cursor.execute(f"SELECT COUNT(*) AS count FROM prompt_task_profile_slots WHERE prompt_id IN ({', '.join(['%s'] * len(prompt_ids))})", prompt_ids)
            if int(cursor.fetchone()["count"]) != 770:
                raise ValueError("Task slot validation count mismatch.")
            cursor.execute(f"SELECT COUNT(*) AS count FROM prompt_hints WHERE prompt_id IN ({', '.join(['%s'] * len(prompt_ids))})", prompt_ids)
            if int(cursor.fetchone()["count"]) != 800:
                raise ValueError("Hint validation count mismatch.")
            cursor.execute(f"SELECT COUNT(*) AS count FROM prompt_hint_items WHERE hint_id IN ({', '.join(['%s'] * len(hint_ids))})", hint_ids)
            if int(cursor.fetchone()["count"]) != 3400:
                raise ValueError("Hint item validation count mismatch.")
    finally:
        connection.rollback()
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-db-validation", action="store_true")
    args = parser.parse_args()

    connection = pymysql.connect(**load_db_config())
    try:
        existing_state = fetch_existing_state(connection)
    finally:
        connection.close()

    records = build_records(existing_state)
    validate_records(records, existing_state)
    sql_text, statements = build_sql(records)
    if not args.skip_db_validation:
        validate_against_db(statements, records)
    OUTPUT_PATH.write_text(sql_text, encoding="utf-8")
    print(f"Generated {len(records['prompts'])} prompts, {len(records['topics'])} topics, {len(records['task_slots'])} task slots, {len(records['hints'])} hints, {len(records['hint_items'])} hint items.")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
