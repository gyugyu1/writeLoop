import type { Prompt, PromptDifficulty } from "./types";

type QuickQuestionSeed = {
  question: string;
  categories: string[];
  families: string[];
  starterStyles?: string[];
  difficulties?: PromptDifficulty[];
};

function seeds(
  questions: string[],
  config: Omit<QuickQuestionSeed, "question">
): QuickQuestionSeed[] {
  return questions.map((question) => ({
    question,
    categories: config.categories,
    families: config.families,
    starterStyles: config.starterStyles,
    difficulties: config.difficulties
  }));
}

const COACH_QUICK_QUESTION_BANK: QuickQuestionSeed[] = [
  ...seeds(
    [
      '"근력을 키우고 싶다"를 어떻게 말해?',
      "이 답변 첫 문장 뭐라고 시작해?",
      "내 의견을 부드럽게 시작하는 표현 알려줘",
      "짧은 예시 하나 넣고 싶은데 어떻게 말해?",
      "이유를 한 문장으로 붙이는 표현 알려줘",
      "문장을 더 자연스럽게 이어주는 표현 알려줘",
      "더 구체적으로 말하는 표현 알려줘",
      "결론을 짧게 마무리하는 표현 알려줘",
      "이 질문에 쓸 이유 아이디어 뭐가 있을까?",
      "문장 구조를 단순하게 잡아줘",
      "부담 없이 시작하는 표현 알려줘",
      "내가 말하고 싶은 뜻에 가까운 표현 추천해줘",
      "짧고 쉬운 표현으로 바꿔줘",
      "한 문장 더 덧붙이고 싶은데 어떤 표현이 좋아?",
      "내 경험을 자연스럽게 꺼내는 표현 알려줘",
      "답변 흐름을 정리하는 표현 알려줘"
    ],
    {
      categories: ["GENERAL"],
      families: ["starter", "meaning_lookup", "reason", "example", "detail"]
    }
  ),
  ...seeds(
    [
      "주말엔 보통 친구를 만난다고 어떻게 말해?",
      "집에서 쉬는 편이라고 자연스럽게 말하고 싶어",
      "주말 루틴 첫 문장 뭐라고 시작해?",
      "빈도를 자연스럽게 말하는 표현 알려줘",
      "아침에는 운동하고 오후에는 쉰다고 어떻게 말해?",
      "가끔 가족이랑 시간을 보낸다고 어떻게 말해?",
      "주말에 보통 늦게 일어난다고 어떻게 말해?",
      "하루 순서대로 말하는 표현 알려줘",
      "저녁에는 산책한다고 어떻게 말해?",
      "평소 습관처럼 들리게 말하는 표현 알려줘",
      "주말에 밖에 나가서 시간을 보낸다고 어떻게 말해?",
      "친구들이랑 어울린다고 더 자연스럽게 말해줘",
      "토요일과 일요일을 나눠서 말하는 표현 알려줘",
      "자주/가끔/보통을 자연스럽게 넣는 법 알려줘",
      "주말에 영화를 본다고 어떻게 말해?",
      "집에서 쉬면서 재충전한다고 어떻게 말해?",
      "여가 시간을 보내는 표현 알려줘",
      "반복되는 일상을 말하는 틀 알려줘"
    ],
    {
      categories: ["ROUTINE"],
      families: ["starter_routine", "frequency", "activity", "companion", "time_marker", "place"],
      starterStyles: ["DIRECT"]
    }
  ),
  ...seeds(
    [
      "제일 좋아하는 음식이 피자라고 어떻게 말해?",
      "왜 좋아하는지 부드럽게 붙이고 싶어",
      "취향을 분명하게 말하는 첫 문장 알려줘",
      "좋아하는 이유를 두 가지 말하는 틀 알려줘",
      "맛이 진하고 달콤하다고 어떻게 말해?",
      "내 최애가 뭐라고 자연스럽게 말해?",
      "가장 좋아하는 이유를 강조하는 표현 알려줘",
      "구체적인 예를 붙이는 표현 알려줘",
      "좋아하는 음식/영화/음악에 다 쓸 수 있는 틀 알려줘",
      "이게 나를 편하게 해준다고 어떻게 말해?",
      "선호를 말할 때 쓸 형용사 표현 알려줘",
      "좋아하지만 자주 먹진 않는다고 어떻게 말해?",
      "이유 뒤에 경험을 짧게 덧붙이고 싶어",
      "가장 좋아하는 걸 소개하는 자연스러운 시작 알려줘",
      "향이나 맛을 묘사하는 표현 알려줘",
      "취향이 바뀌었다고도 말하고 싶어"
    ],
    {
      categories: ["PREFERENCE"],
      families: ["favorite", "reason", "adjective", "example"],
      starterStyles: ["DIRECT"]
    }
  ),
  ...seeds(
    [
      "올해 영어를 더 잘하고 싶다고 어떻게 말해?",
      "근력을 키우고 싶다고 어떻게 말해?",
      "새 습관을 만들고 싶다고 자연스럽게 말해줘",
      "목표를 먼저 말하는 첫 문장 알려줘",
      "어떻게 연습할지 이어서 말하는 표현 알려줘",
      "조금씩 꾸준히 하겠다고 어떻게 말해?",
      "계획을 실천하는 과정을 말하는 틀 알려줘",
      "결국 도움이 될 거라고 어떻게 말해?",
      "운동을 더 자주 하려고 한다고 어떻게 말해?",
      "매일 30분씩 연습할 계획이라고 말하고 싶어",
      "목표 + 이유 + 실천을 한 번에 묶는 표현 알려줘",
      "새로운 기술을 익히고 싶다고 어떻게 말해?",
      "집중력을 높이고 싶다고 어떻게 말해?",
      "불필요한 지출을 줄이고 싶다고 어떻게 말해?",
      "practice 말고 연습 계획을 말하는 표현 알려줘",
      "in the long run 같은 결과 표현도 알려줘",
      "습관을 유지하겠다고 말하는 표현 알려줘",
      "계획을 세우고 따라가겠다고 어떻게 말해?"
    ],
    {
      categories: ["GOAL_PLAN"],
      families: ["goal", "plan", "process", "result", "desire", "reason"],
      starterStyles: ["DIRECT"]
    }
  ),
  ...seeds(
    [
      "학교에서 시간 관리가 어렵다고 어떻게 말해?",
      "업무량이 많아서 힘들다고 자연스럽게 말해줘",
      "문제를 소개하는 첫 문장 알려줘",
      "어떻게 해결하는지 이어주는 표현 알려줘",
      "압박감을 느낀다고 어떻게 말해?",
      "팀워크 때문에 어려움을 겪는다고 말하고 싶어",
      "문제 -> 해결 순서로 말하는 틀 알려줘",
      "그래서 이렇게 대응한다고 어떻게 말해?",
      "스트레스를 관리한다고 자연스럽게 말해줘",
      "기한이 촉박할 때 어떻게 대처하는지 말하고 싶어",
      "문제를 줄이기 위해 하는 행동을 말하는 표현 알려줘",
      "결과적으로 도움이 된다고 덧붙이고 싶어",
      "직장/학교 둘 다에 쓸 수 있는 문제 해결 표현 알려줘",
      "어려움을 인정하면서도 긍정적으로 마무리하는 표현 알려줘",
      "실수를 통해 배운다고 어떻게 말해?",
      "도움을 요청한다고 어떻게 말해?"
    ],
    {
      categories: ["PROBLEM_SOLUTION"],
      families: ["problem", "response", "sequence", "result"],
      starterStyles: ["REFLECTIVE"]
    }
  ),
  ...seeds(
    [
      "기술은 관계를 더 쉽게 만들어줬다고 어떻게 말해?",
      "하지만 사람들을 더 멀어지게 하기도 한다고 말하고 싶어",
      "장점과 단점을 균형 있게 시작하는 표현 알려줘",
      "한편으로는/다른 한편으로는 말고 다른 표현 알려줘",
      "대체로 긍정적이라고 어떻게 말해?",
      "완전히 긍정적이진 않다고 부드럽게 말해줘",
      "균형 잡힌 의견을 말하는 구조 알려줘",
      "장점 먼저 말하고 단점으로 넘어가는 표현 알려줘",
      "조건에 따라 다르다고 어떻게 말해?",
      "내 입장을 너무 강하지 않게 말하는 표현 알려줘",
      "기술 변화가 관계 방식 자체를 바꿨다고 어떻게 말해?",
      "긍정적이지만 걱정도 있다고 말하고 싶어",
      "찬반을 다룬 뒤 결론 내리는 표현 알려줘",
      "사회 이슈에 대해 균형 있게 말하는 표현 알려줘",
      "전반적으로는 도움이 된다고 어떻게 말해?",
      "관계를 맺는 방식이 달라졌다고 자연스럽게 말해줘",
      "비교/대조 표현을 더 알려줘",
      "중립적으로 시작하는 첫 문장 알려줘"
    ],
    {
      categories: ["BALANCED_OPINION"],
      families: ["starter_topic", "contrast", "opinion", "qualification"],
      starterStyles: ["BALANCED"],
      difficulties: ["C"]
    }
  ),
  ...seeds(
    [
      "기업은 사회적 책임을 져야 한다고 어떻게 말해?",
      "그 이유를 설득력 있게 붙이는 표현 알려줘",
      "이 질문에 쓸 이유 아이디어 뭐가 있을까?",
      "구체적인 예 하나 넣고 싶은데 어떤 식으로 말해?",
      "직원과 지역사회를 함께 언급하고 싶어",
      "공정하게 대해야 한다고 어떻게 말해?",
      "환경까지 책임져야 한다고 자연스럽게 말해줘",
      "내 입장을 분명하게 시작하는 표현 알려줘",
      "사회 문제 질문에 쓸 예시 표현 알려줘",
      "근거를 두 가지로 나누는 틀 알려줘",
      "기업의 신뢰와 책임을 연결해서 말하고 싶어",
      "소외된 사람들을 돕는다고 어떻게 말해?",
      "이 주제에 맞는 단어 추천해줘",
      "정책/지원/기회 제공을 말하는 표현 알려줘",
      "왜 중요한지 마무리하는 표현 알려줘",
      "찬성 입장을 조금 더 강하게 말하는 표현 알려줘"
    ],
    {
      categories: ["OPINION_REASON"],
      families: ["opinion", "responsibility", "reason", "example"],
      starterStyles: ["DIRECT"],
      difficulties: ["C"]
    }
  ),
  ...seeds(
    [
      "예전엔 그렇게 생각했지만 지금은 아니라고 어떻게 말해?",
      "시간이 지나면서 생각이 바뀌었다고 말하고 싶어",
      "과거와 현재를 비교하는 첫 문장 알려줘",
      "생각이 바뀐 계기를 말하는 표현 알려줘",
      "경험 덕분에 깨달았다고 어떻게 말해?",
      "어릴 때와 지금을 대비해서 말하고 싶어",
      "예전에는 성공이 제일 중요하다고 생각했다고 어떻게 말해?",
      "지금은 균형이 더 중요하다고 말하고 싶어",
      "한 사건이 내 관점을 바꿨다고 자연스럽게 말해줘",
      "과거 belief를 소개하는 표현 알려줘",
      "지금은 다르게 본다고 부드럽게 말해줘",
      "realize 말고 깨달음을 말하는 표현 알려줘",
      "변화의 이유를 한 문장으로 정리하는 틀 알려줘",
      "과거-현재-계기 순서로 말하는 구조 알려줘",
      "생각이 점점 바뀌었다고 어떻게 말해?",
      "지금 가치관을 마무리로 말하는 표현 알려줘"
    ],
    {
      categories: ["CHANGE_REFLECTION"],
      families: ["past_present", "change", "cause", "realization"],
      starterStyles: ["REFLECTIVE"],
      difficulties: ["C"]
    }
  )
];

function uniqueQuestions(questions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  questions.forEach((question) => {
    if (seen.has(question)) {
      return;
    }
    seen.add(question);
    result.push(question);
  });
  return result;
}

function scoreSeed(seed: QuickQuestionSeed, prompt: Prompt | null): number {
  const category = prompt?.coachProfile?.primaryCategory ?? "GENERAL";
  const preferredFamilies = new Set(prompt?.coachProfile?.preferredExpressionFamilies ?? []);
  const avoidFamilies = new Set(prompt?.coachProfile?.avoidFamilies ?? []);
  const starterStyle = prompt?.coachProfile?.starterStyle;
  const difficulty = prompt?.difficulty;

  let score = 0;

  if (seed.categories.includes(category)) {
    score += 12;
  } else if (seed.categories.includes("GENERAL")) {
    score += 6;
  } else if (category === "GENERAL") {
    score += 2;
  }

  seed.families.forEach((family) => {
    if (preferredFamilies.has(family)) {
      score += 4;
    }
    if (avoidFamilies.has(family)) {
      score -= 6;
    }
  });

  if (starterStyle && seed.starterStyles?.includes(starterStyle)) {
    score += 3;
  }

  if (!seed.difficulties || !difficulty || seed.difficulties.includes(difficulty)) {
    score += 1;
  } else {
    score -= 2;
  }

  return score;
}

export function buildCoachQuickQuestions(prompt: Prompt | null, limit = 6): string[] {
  const ranked = COACH_QUICK_QUESTION_BANK
    .map((seed, index) => ({
      question: seed.question,
      score: scoreSeed(seed, prompt),
      index
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.index - b.index;
    })
    .map((item) => item.question);

  return uniqueQuestions(ranked).slice(0, limit);
}
