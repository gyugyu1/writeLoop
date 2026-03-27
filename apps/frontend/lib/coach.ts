import type {
  CoachExpression,
  CoachExpressionMatchType,
  CoachHelpResponse,
  CoachUsageCheckResponse,
  CoachUsageExpression,
  Prompt
} from "./types";

type CoachIntent = "starter" | "reason" | "example" | "compare" | "opinion" | "structure";

type TopicExpressionSeed = Pick<CoachExpression, "expression" | "meaningKo" | "usageTip" | "example">;

type ExpressionTopicBundle = {
  key: string;
  labelKo: string;
  keywords: string[];
  expressions: TopicExpressionSeed[];
};

const COACH_INTENT_ORDER: CoachIntent[] = ["starter", "reason", "example", "compare", "opinion", "structure"];

const COACH_INTENT_KEYWORDS: Record<CoachIntent, string[]> = {
  starter: [
    "starter",
    "first sentence",
    "opening sentence",
    "open with",
    "how should i start",
    "start with",
    "\uBB50\uB77C \uC2DC\uC791",
    "\uBB50\uB85C \uC2DC\uC791",
    "\uCCAB \uC904",
    "\uCCAB\uC904",
    "\uCCAB \uBB38\uC7A5 \uBB50\uB77C",
    "\uCCAB \uBB38\uC7A5 \uBB50\uB85C",
    "\uB3C4\uC785 \uBB50\uB77C",
    "\uB3C4\uC785 \uC5B4\uB5BB\uAC8C",
    "첫 문장",
    "첫문장",
    "문장 시작",
    "시작 문장",
    "도입",
    "오프닝",
    "스타터",
    "어떻게 시작"
  ],
  reason: ["reason", "why", "because", "이유", "왜", "왜냐하면", "때문", "근거"],
  example: ["example", "for instance", "for example", "예시", "예를 들어", "예를들어", "경험"],
  compare: ["compare", "difference", "on the other hand", "비교", "반면", "반대로", "차이"],
  opinion: ["opinion", "think", "view", "의견", "생각", "입장", "주장"],
  structure: ["structure", "organize", "flow", "구조", "흐름", "정리", "이어"]
};

const LEARN_TARGET_TRANSLATIONS: Record<string, string> = {
  "\uC720\uB3C4": "judo",
  "\uD0DC\uAD8C\uB3C4": "taekwondo",
  "\uAC80\uB3C4": "kendo",
  "\uC218\uC601": "swimming",
  "\uD53C\uC544\uB178": "piano",
  "\uAE30\uD0C0": "guitar",
  "\uCF54\uB529": "coding",
  "\uD504\uB85C\uADF8\uB798\uBC0D": "programming",
  "\uC601\uC5B4": "English",
  "\uC77C\uBCF8\uC5B4": "Japanese",
  "\uC911\uAD6D\uC5B4": "Chinese",
  "\uC2A4\uD398\uC778\uC5B4": "Spanish",
  "\uD504\uB791\uC2A4\uC5B4": "French",
  "\uB3C5\uC77C\uC5B4": "German",
  "\uC694\uB9AC": "cooking",
  "\uCD95\uAD6C": "soccer",
  "\uB18D\uAD6C": "basketball",
  "\uD14C\uB2C8\uC2A4": "tennis"
};

const GROWTH_TARGET_TRANSLATIONS: Record<string, string> = {
  "근력": "strength",
  "체력": "stamina",
  "지구력": "endurance",
  "유연성": "flexibility",
  "자신감": "confidence",
  "집중력": "focus",
  "영향력": "influence",
  "면역력": "immunity",
  "근육": "muscle",
  "실력": "skills",
  "영어 실력": "English skills",
  "말하기 실력": "speaking skills",
  "발음": "pronunciation"
};

const REDUCE_TARGET_TRANSLATIONS: Record<string, string> = {
  "스트레스": "stress",
  "불안": "anxiety",
  "걱정": "worry",
  "지출": "spending",
  "소비": "spending",
  "스크린 타임": "screen time",
  "체지방": "body fat",
  "체중": "weight",
  "피로": "fatigue",
  "압박감": "pressure"
};

const EXPRESSION_TOPIC_BUNDLES: ExpressionTopicBundle[] = [
  {
    key: "sleep",
    labelKo: "잠",
    keywords: ["잠", "자다", "잔다", "잠들", "취침", "수면", "sleep", "asleep", "bed"],
    expressions: [
      {
        expression: "go to bed",
        meaningKo: "잠자리에 들 때 가장 기본적으로 쓸 수 있는 표현이에요.",
        usageTip: "몇 시에 자러 가는지 말할 때 제일 무난하게 쓸 수 있어요.",
        example: "I usually go to bed around eleven."
      },
      {
        expression: "go to sleep",
        meaningKo: "자러 가거나 잠이 들기 직전 상황을 말할 때 좋아요.",
        usageTip: "go to bed보다 실제로 잠드는 느낌이 더 가까워요.",
        example: "I go to sleep right after reading."
      },
      {
        expression: "fall asleep",
        meaningKo: "잠이 드는 순간이나 과정 자체를 말할 때 쓰는 표현이에요.",
        usageTip: "쉽게 잠드는지, 늦게 잠드는지 말할 때 특히 잘 맞아요.",
        example: "I fall asleep quickly after a shower."
      },
      {
        expression: "get some sleep",
        meaningKo: "잠을 좀 자야 한다는 느낌으로 말할 때 유용해요.",
        usageTip: "조언하거나 피곤한 상황을 말할 때 자연스럽게 들려요.",
        example: "I need to get some sleep tonight."
      },
      {
        expression: "sleep well",
        meaningKo: "푹 자다, 잠을 잘 자다를 말할 때 쓰는 표현이에요.",
        usageTip: "잠의 질이나 컨디션과 연결해서 말하기 좋아요.",
        example: "I sleep well when the room is quiet."
      }
    ]
  },
  {
    key: "study",
    labelKo: "공부",
    keywords: ["공부", "공부하다", "배우다", "학습", "study", "learn", "practice"],
    expressions: [
      {
        expression: "study for",
        meaningKo: "무엇을 위해 공부하는지 말할 때 좋아요.",
        usageTip: "시험, 목표, 과목과 함께 붙이면 자연스러워요.",
        example: "I study for my English test every night."
      },
      {
        expression: "work on",
        meaningKo: "어떤 부분을 집중해서 연습하거나 다듬는다는 뜻으로 좋아요.",
        usageTip: "skills, pronunciation, writing 같은 말과 잘 어울려요.",
        example: "I work on my pronunciation every day."
      },
      {
        expression: "practice by ...ing",
        meaningKo: "어떤 방식으로 연습하는지 구체적으로 말할 때 유용해요.",
        usageTip: "공부 방법을 함께 말하고 싶을 때 자연스러워요.",
        example: "I practice by rewriting my answers."
      },
      {
        expression: "review",
        meaningKo: "복습하다를 짧고 자연스럽게 말할 때 쓰는 표현이에요.",
        usageTip: "notes, words, mistakes와 함께 쓰면 좋아요.",
        example: "I review new words before bed."
      },
      {
        expression: "keep studying",
        meaningKo: "계속 공부한다는 흐름을 말할 때 좋아요.",
        usageTip: "습관이나 꾸준함을 강조할 때 잘 맞아요.",
        example: "I want to keep studying every day."
      }
    ]
  },
  {
    key: "rest",
    labelKo: "쉬다",
    keywords: ["쉬다", "휴식", "휴가", "rest", "relax", "break"],
    expressions: [
      {
        expression: "take a break",
        meaningKo: "잠깐 쉬다를 가장 자연스럽게 말할 때 쓰는 표현이에요.",
        usageTip: "공부나 일 사이에 쉬는 상황에 특히 잘 맞아요.",
        example: "I take a short break after lunch."
      },
      {
        expression: "get some rest",
        meaningKo: "충분히 쉬다, 좀 쉬다를 말할 때 좋아요.",
        usageTip: "피곤한 상황이나 건강과 연결해 말하기 좋아요.",
        example: "I need to get some rest this weekend."
      },
      {
        expression: "relax at home",
        meaningKo: "집에서 편하게 쉰다는 느낌을 줄 때 쓰는 표현이에요.",
        usageTip: "주말 루틴을 말할 때 잘 어울려요.",
        example: "I usually relax at home on Sundays."
      },
      {
        expression: "rest for a while",
        meaningKo: "잠깐 쉬고 있다는 흐름을 말할 때 자연스러워요.",
        usageTip: "짧은 휴식을 설명할 때 부담 없이 쓸 수 있어요.",
        example: "I rest for a while before dinner."
      },
      {
        expression: "unwind",
        meaningKo: "긴장을 풀고 쉬다를 조금 더 자연스럽게 말할 때 좋아요.",
        usageTip: "하루를 마무리하며 쉬는 장면에 잘 맞아요.",
        example: "I unwind by listening to music."
      }
    ]
  }
];

const DEFAULT_HELP_EXPRESSIONS: TopicExpressionSeed[] = [
  {
    expression: "One reason is that ...",
    meaningKo: "이유를 자연스럽게 이어 말할 때 쓰는 표현이에요.",
    usageTip: "의견 뒤에 이유를 하나 붙일 때 가장 무난하게 쓸 수 있어요.",
    example: "One reason is that it helps me stay focused."
  },
  {
    expression: "I think ...",
    meaningKo: "내 생각이나 입장을 먼저 꺼낼 때 쓰는 표현이에요.",
    usageTip: "답변을 시작할 때 부담 없이 의견을 열어주기 좋아요.",
    example: "I think learning English every day is important."
  },
  {
    expression: "For example, ...",
    meaningKo: "예시를 붙여 설명을 더 구체적으로 만들 때 써요.",
    usageTip: "이유 뒤에 짧은 경험이나 사례를 덧붙일 때 좋아요.",
    example: "For example, I practice speaking with my friends."
  },
  {
    expression: "On the other hand, ...",
    meaningKo: "반대 관점이나 다른 면을 이어 말할 때 쓰는 표현이에요.",
    usageTip: "비교하거나 균형 있게 답하고 싶을 때 유용해요.",
    example: "On the other hand, some people prefer studying alone."
  }
];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\.\.\./g, " ")
    .replace(/[^a-z0-9\s가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalized(answer: string, expression: string) {
  const normalizedAnswer = normalizeText(answer);
  const normalizedExpression = normalizeText(expression);
  if (!normalizedAnswer || !normalizedExpression) {
    return false;
  }

  return normalizedAnswer.includes(normalizedExpression);
}

function markUsage(answer: string, expression: CoachExpression): CoachUsageExpression {
  const exactMatch = answer.includes(expression.expression);
  const normalizedMatch = !exactMatch && includesNormalized(answer, expression.expression);

  let matchType: CoachExpressionMatchType = "UNUSED";
  let matched = false;

  if (exactMatch) {
    matchType = "EXACT";
    matched = true;
  } else if (normalizedMatch) {
    matchType = "NORMALIZED";
    matched = true;
  }

  return {
    ...expression,
    matched,
    matchType,
    matchedText: matched ? expression.expression : null,
    source: "RECOMMENDED"
  };
}

function addExpression(bucket: TopicExpressionSeed[], expression: TopicExpressionSeed) {
  if (bucket.some((item) => item.expression === expression.expression)) {
    return;
  }

  bucket.push(expression);
}

function includesKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isMeaningLookupQuestion(normalizedQuestion: string) {
  if (
    includesKeyword(normalizedQuestion, [
      "영어로",
      "표현",
      "말하고 싶어",
      "말하고 싶",
      "어떻게 말",
      "뭐라고",
      "라고 말",
      "라고 하고",
      "단어",
      "how do i say",
      "want to say",
      "expression",
      "phrase",
      "word"
    ])
  ) {
    return true;
  }

  if (looksLikeImplicitMeaningLookup(normalizedQuestion)) {
    return true;
  }

  return normalizedQuestion.split(/\s+/).length <= 2 && /[가-힣]/.test(normalizedQuestion);
}

function looksLikeExpressionLookup(normalizedQuestion: string) {
  return isMeaningLookupQuestion(normalizedQuestion);
}

function resolveExpressionTopic(question: string) {
  const normalized = normalizeText(question);
  if (!normalized || !looksLikeExpressionLookup(normalized)) {
    return null;
  }

  return (
    EXPRESSION_TOPIC_BUNDLES.find((bundle) => bundle.keywords.some((keyword) => normalized.includes(keyword))) ?? null
  );
}

function extractMeaningLookupTarget(question: string) {
  const normalized = normalizeText(question);
  if (!normalized) {
    return "";
  }

  const extracted = normalized
    .replace(/영어로/g, " ")
    .replace(/표현/g, " ")
    .replace(/말하고 싶어/g, " ")
    .replace(/말하고 싶/g, " ")
    .replace(/어떻게 말/g, " ")
    .replace(/뭐라고/g, " ")
    .replace(/라고 말/g, " ")
    .replace(/라고 하고/g, " ")
    .replace(/단어/g, " ")
    .replace(/how do i say/g, " ")
    .replace(/want to say/g, " ")
    .replace(/expression/g, " ")
    .replace(/phrase/g, " ")
    .replace(/word/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return extracted || normalized;
}

function looksLikeGrowthMeaning(normalizedTarget: string) {
  const hasGrowthVerb = includesKeyword(normalizedTarget, [
    "키우",
    "늘리",
    "높이",
    "기르",
    "강화",
    "향상",
    "개선",
    "발전",
    "발달",
    "boost",
    "build up",
    "increase",
    "improve",
    "develop"
  ]);
  const hasGrowthTarget = includesKeyword(normalizedTarget, [
    "근력",
    "체력",
    "지구력",
    "유연성",
    "자신감",
    "집중력",
    "영향력",
    "면역력",
    "근육",
    "실력",
    "발음",
    "strength",
    "stamina",
    "endurance",
    "flexibility",
    "confidence",
    "focus",
    "influence",
    "immunity",
    "muscle",
    "skills",
    "skill",
    "pronunciation"
  ]);

  return hasGrowthVerb && (hasGrowthTarget || normalizedTarget.includes("싶"));
}

function looksLikeReduceManageMeaning(normalizedTarget: string) {
  const hasReduceVerb = includesKeyword(normalizedTarget, [
    "줄이",
    "낮추",
    "완화",
    "관리",
    "조절",
    "통제",
    "억제",
    "cut down",
    "reduce",
    "lower",
    "manage",
    "control"
  ]);
  const hasReduceTarget = includesKeyword(normalizedTarget, [
    "스트레스",
    "불안",
    "걱정",
    "지출",
    "소비",
    "스크린 타임",
    "체지방",
    "체중",
    "피로",
    "압박감",
    "stress",
    "anxiety",
    "worry",
    "spending",
    "screen time",
    "body fat",
    "weight",
    "fatigue",
    "pressure"
  ]);

  return hasReduceVerb && (hasReduceTarget || normalizedTarget.includes("싶"));
}

function looksLikeImplicitMeaningLookup(normalizedQuestion: string) {
  if (!/[가-힣]/.test(normalizedQuestion)) {
    return false;
  }

  if (normalizedQuestion.split(/\s+/).length > 8) {
    return false;
  }

  return (
    looksLikeLearningMeaning(normalizedQuestion) ||
    looksLikeGrowthMeaning(normalizedQuestion) ||
    looksLikeReduceManageMeaning(normalizedQuestion) ||
    looksLikeGenericDesireStateMeaning(normalizedQuestion) ||
    includesKeyword(normalizedQuestion, [
      "잠",
      "자다",
      "잔다",
      "잠들",
      "취침",
      "수면",
      "공부",
      "쉬다",
      "휴식",
      "친구",
      "만남",
      "온라인",
      "인터넷",
      "가보고 싶",
      "관심",
      "궁금"
    ])
  );
}

function looksLikeGenericDesireStateMeaning(normalizedQuestion: string) {
  const compactQuestion = normalizedQuestion.replace(/\s+/g, "");
  const hasDesireEnding =
    includesKeyword(normalizedQuestion, [
      "고 싶다",
      "고 싶어",
      "고 싶",
      "싶다",
      "싶어",
      "되고 싶",
      "보이고 싶",
      "느껴지고 싶",
      "want to",
      "would like to"
    ]) ||
    includesKeyword(compactQuestion, ["고싶다", "고싶어", "되고싶", "보이고싶", "느껴지고싶"]);

  const hasMeaningContent = includesKeyword(normalizedQuestion, [
    "보이",
    "되",
    "느껴지",
    "같아 보이",
    "매력적",
    "자연스러",
    "편안",
    "건강해",
    "성숙해",
    "professional",
    "confident",
    "attractive",
    "natural",
    "comfortable",
    "healthy",
    "mature"
  ]);

  return hasDesireEnding && hasMeaningContent;
}

function isMeetFriendsMeaning(normalizedTarget: string) {
  if (!normalizedTarget) {
    return false;
  }

  const hasFriend = includesKeyword(normalizedTarget, ["친구", "friend", "friends", "buddy", "buddies"]);
  const hasMeet = includesKeyword(normalizedTarget, [
    "만나",
    "만날",
    "만남",
    "어울",
    "놀",
    "보러",
    "보다",
    "meet",
    "see",
    "hang out",
    "catch up",
    "get together"
  ]);

  return hasFriend && hasMeet;
}

function buildMeaningLookupExpressions(question: string): TopicExpressionSeed[] {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion || !looksLikeExpressionLookup(normalizedQuestion)) {
    return [];
  }

  if (looksLikeMeetFriendsLookup(question)) {
    return buildMeetFriendsExpressions();
  }

  const normalizedTarget = extractMeaningLookupTarget(question);
  if (isMeetFriendsMeaning(normalizedQuestion) || isMeetFriendsMeaning(normalizedTarget)) {
    return buildMeetFriendsExpressions();
  }

  const learnExpressions = buildLearnTargetExpressions(normalizedTarget);
  if (learnExpressions.length > 0) {
    return learnExpressions;
  }

  const growthExpressions = buildGrowthExpressions(normalizedTarget);
  if (growthExpressions.length > 0) {
    return growthExpressions;
  }

  const reduceExpressions = buildReduceExpressions(normalizedTarget);
  if (reduceExpressions.length > 0) {
    return reduceExpressions;
  }

  return [];
}

function buildMeetFriendsExpressions(): TopicExpressionSeed[] {
  return [
    {
      expression: "meet my friends",
      meaningKo: "친구들을 만난다고 가장 기본적으로 말할 때 쓰기 좋아요.",
      usageTip: "일정이나 평소 루틴을 담백하게 말할 때 자연스럽습니다.",
      example: "I usually meet my friends after work."
    },
    {
      expression: "hang out with my friends",
      meaningKo: "친구들과 어울리거나 같이 시간을 보낸다고 말할 때 잘 맞아요.",
      usageTip: "조금 더 편하고 일상적인 분위기로 말하고 싶을 때 써 보세요.",
      example: "I like to hang out with my friends on weekends."
    },
    {
      expression: "catch up with my friends",
      meaningKo: "오랜만에 친구들과 만나 근황을 나눈다는 느낌이 있을 때 좋아요.",
      usageTip: "그냥 만나는 것보다 대화와 근황 공유를 강조할 때 자연스럽습니다.",
      example: "I catch up with my friends over coffee."
    },
    {
      expression: "get together with my friends",
      meaningKo: "친구들과 한자리에 모인다고 말할 때 쓰기 좋아요.",
      usageTip: "약속을 잡거나 같이 모이는 상황을 설명할 때 잘 어울립니다.",
      example: "I get together with my friends once or twice a month."
    },
    {
      expression: "spend time with my friends",
      meaningKo: "친구들과 시간을 보낸다는 의미를 가장 넓게 담을 수 있어요.",
      usageTip: "꼭 만나기뿐 아니라 같이 놀고 이야기하는 느낌까지 폭넓게 담습니다.",
      example: "I spend time with my friends after class."
    }
  ];
}

function looksLikeMeetFriendsLookup(question: string) {
  return /(친구|friend|friends).*(만나|만날|만난|어울|놀|meet|see|hang out|catch up|get together)/.test(
    question
  );
}

function detectCoachIntentsFromText(text: string) {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/\s+/g, "");

  return COACH_INTENT_ORDER.filter((intent) => {
    if (includesKeyword(normalized, COACH_INTENT_KEYWORDS[intent])) {
      return true;
    }

    if (intent !== "starter") {
      return false;
    }

    return includesKeyword(compact, [
      "\uBB50\uB77C\uC2DC\uC791",
      "\uBB50\uB85C\uC2DC\uC791",
      "\uBB50\uB77C\uC2DC\uC791\uD574",
      "\uBB50\uB85C\uC2DC\uC791\uD574",
      "\uCCAB\uC904",
      "\uCCAB\uC904\uBB50\uB77C",
      "\uCCAB\uC904\uBB50\uB85C",
      "\uCCAB\uBB38\uC7A5\uBB50\uB77C",
      "\uCCAB\uBB38\uC7A5\uBB50\uB85C",
      "\uB3C4\uC785\uBB50\uB77C",
      "\uB3C4\uC785\uC5B4\uB5BB\uAC8C"
    ]);
  });
}

function buildLearnTargetExpressions(normalizedTarget: string): TopicExpressionSeed[] {
  if (!looksLikeLearningMeaning(normalizedTarget)) {
    return [];
  }

  const translatedTarget = resolveLearnTargetTranslation(normalizedTarget);
  if (!translatedTarget) {
    return [];
  }

  const capitalizedTarget = translatedTarget.charAt(0).toUpperCase() + translatedTarget.slice(1);

  return [
    {
      expression: `I want to learn ${translatedTarget}.`,
      meaningKo: "'~를 배우고 싶다'를 가장 직접적으로 말할 때 쓰기 좋아요.",
      usageTip: "올해 새로 배우고 싶은 기술이나 취미를 말할 때 바로 쓰기 좋습니다.",
      example: `I want to learn ${translatedTarget} this year.`
    },
    {
      expression: `I want to start learning ${translatedTarget}.`,
      meaningKo: "지금부터 배우기 시작하고 싶다는 느낌을 주기 좋아요.",
      usageTip: "처음 시작하는 목표나 계획을 말할 때 자연스럽습니다.",
      example: `I want to start learning ${translatedTarget} after work.`
    },
    {
      expression: translatedTarget,
      meaningKo: "핵심 단어 자체를 먼저 확인하고 싶을 때 보기 좋아요.",
      usageTip: "앞에 want to learn, practice, get better at 같은 표현을 붙여 보세요.",
      example: `${capitalizedTarget} is a skill I want to learn.`
    },
    {
      expression: `practice ${translatedTarget}`,
      meaningKo: "배운 것을 연습한다는 흐름으로 이어 말할 때 좋아요.",
      usageTip: "어떻게 연습할지 함께 말하고 싶을 때 잘 맞습니다.",
      example: `I plan to practice ${translatedTarget} every weekend.`
    },
    {
      expression: `get better at ${translatedTarget}`,
      meaningKo: "실력을 늘리고 싶다는 느낌까지 함께 담고 싶을 때 유용해요.",
      usageTip: "단순히 배우는 것을 넘어 늘고 싶다는 목표를 말하기 좋습니다.",
      example: `I want to get better at ${translatedTarget} this year.`
    }
  ];
}

function looksLikeLearningMeaning(normalizedTarget: string) {
  return includesKeyword(normalizedTarget, [
    "\uBC30\uC6B0\uACE0 \uC2F6",
    "\uBC30\uC6B0\uACE0",
    "\uBC30\uC6B0\uB2E4",
    "want to learn",
    "start learning",
    "learn"
  ]);
}

function resolveLearnTargetTranslation(normalizedTarget: string) {
  const candidate = normalizedTarget
    .replace(/\uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uACE0/g, " ")
    .replace(/\uBC30\uC6B0\uACE0 \uC2F6\uC5B4\uC11C/g, " ")
    .replace(/\uBC30\uC6B0\uACE0 \uC2F6\uC5B4/g, " ")
    .replace(/\uBC30\uC6B0\uACE0 \uC2F6/g, " ")
    .replace(/\uBC30\uC6B0\uACE0/g, " ")
    .replace(/\uBC30\uC6B0\uB2E4/g, " ")
    .replace(/want to learn/g, " ")
    .replace(/start learning/g, " ")
    .replace(/learn/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(\uC744|\uB97C|\uC740|\uB294|\uC774|\uAC00|\uACFC|\uC640)$/g, "")
    .trim();

  for (const [key, value] of Object.entries(LEARN_TARGET_TRANSLATIONS)) {
    if (candidate.includes(key)) {
      return value;
    }
  }

  const englishMatch = candidate.match(/[A-Za-z][A-Za-z0-9' -]{1,}/);
  return englishMatch?.[0]?.trim() ?? "";
}

function buildGrowthExpressions(normalizedTarget: string): TopicExpressionSeed[] {
  if (!looksLikeGrowthMeaning(normalizedTarget)) {
    return [];
  }

  const translatedTarget = resolveMappedTranslation(normalizedTarget, GROWTH_TARGET_TRANSLATIONS, [
    "키우고 싶다",
    "키우고 싶어",
    "키우고 싶",
    "키우고",
    "키우다",
    "늘리고 싶다",
    "늘리고 싶어",
    "늘리고 싶",
    "늘리고",
    "늘리다",
    "높이고 싶다",
    "높이고 싶어",
    "높이고 싶",
    "높이고",
    "높이다",
    "기르고 싶다",
    "기르고 싶어",
    "기르고 싶",
    "기르고",
    "기르다",
    "강화하고 싶다",
    "강화하고 싶어",
    "강화하고",
    "향상시키고 싶다",
    "향상시키고 싶어",
    "향상시키고",
    "개선하고 싶다",
    "개선하고 싶어",
    "개선하고",
    "build up",
    "boost",
    "increase",
    "improve",
    "develop"
  ]);
  if (!translatedTarget) {
    return [];
  }

  const possessiveTarget = withMyPrefix(translatedTarget);
  const capitalizedTarget = translatedTarget.charAt(0).toUpperCase() + translatedTarget.slice(1);

  return [
    {
      expression: `I want to improve ${possessiveTarget}.`,
      meaningKo: "'~을 더 키우고 싶다'를 가장 무난하게 말할 때 쓰기 좋아요.",
      usageTip: "근력, 체력, 자신감, 실력처럼 더 좋아지고 싶은 능력이나 상태를 말할 때 잘 맞습니다.",
      example: `I want to improve ${possessiveTarget} this year.`
    },
    {
      expression: `I want to work on ${possessiveTarget}.`,
      meaningKo: "조금씩 다듬고 키워 가고 있다는 느낌을 줄 때 자연스러워요.",
      usageTip: "당장 완벽해지기보다 꾸준히 관리하고 키워 가는 흐름을 말할 때 유용합니다.",
      example: `I want to work on ${possessiveTarget} every week.`
    },
    {
      expression: `I want to develop ${possessiveTarget}.`,
      meaningKo: "조금 더 성장과 발전의 느낌을 강조하고 싶을 때 쓰기 좋아요.",
      usageTip: "실력이나 자신감처럼 시간이 지나면서 더 단단해지는 대상을 말할 때 잘 어울립니다.",
      example: `I want to develop ${possessiveTarget} through regular practice.`
    },
    {
      expression: `I want to build up ${possessiveTarget}.`,
      meaningKo: "기초부터 차근차근 쌓아 올리고 싶다는 느낌을 줄 때 좋아요.",
      usageTip: "근력, 체력, 집중력처럼 꾸준히 쌓아 가는 느낌의 목표와 특히 잘 맞습니다.",
      example: `I want to build up ${possessiveTarget} little by little.`
    },
    {
      expression: capitalizedTarget,
      meaningKo: "핵심 단어 자체를 먼저 확인해 두고 싶을 때 보기 좋은 표현이에요.",
      usageTip: "이 단어를 기억해 두면 improve, build up, work on 같은 표현과 자연스럽게 이어 쓸 수 있어요.",
      example: `${capitalizedTarget} is something I want to improve.`
    }
  ];
}

function buildReduceExpressions(normalizedTarget: string): TopicExpressionSeed[] {
  if (!looksLikeReduceManageMeaning(normalizedTarget)) {
    return [];
  }

  const translatedTarget = resolveMappedTranslation(normalizedTarget, REDUCE_TARGET_TRANSLATIONS, [
    "줄이고 싶다",
    "줄이고 싶어",
    "줄이고 싶",
    "줄이고",
    "줄이다",
    "낮추고 싶다",
    "낮추고 싶어",
    "낮추고 싶",
    "낮추고",
    "낮추다",
    "완화하고 싶다",
    "완화하고 싶어",
    "완화하고",
    "관리하고 싶다",
    "관리하고 싶어",
    "관리하고",
    "조절하고 싶다",
    "조절하고 싶어",
    "조절하고",
    "cut down on",
    "cut down",
    "reduce",
    "lower",
    "manage",
    "control"
  ]);
  if (!translatedTarget) {
    return [];
  }

  const possessiveTarget = withMyPrefix(translatedTarget);

  return [
    {
      expression: `I want to reduce ${possessiveTarget}.`,
      meaningKo: "'~을 줄이고 싶다'를 가장 직접적으로 말할 때 쓰기 좋아요.",
      usageTip: "스트레스, 지출, 스크린 타임처럼 줄이고 싶은 대상을 간단하게 말할 수 있어요.",
      example: `I want to reduce ${possessiveTarget} this year.`
    },
    {
      expression: `I want to manage ${possessiveTarget} better.`,
      meaningKo: "단순히 줄이는 것보다 더 잘 다루고 싶다는 느낌을 줄 때 자연스러워요.",
      usageTip: "스트레스나 불안처럼 완전히 없애기보다 조절하고 싶은 대상을 말할 때 특히 잘 맞습니다.",
      example: `I want to manage ${possessiveTarget} better in my daily life.`
    },
    {
      expression: `I want to work on lowering ${possessiveTarget}.`,
      meaningKo: "꾸준히 줄여 가는 과정에 초점을 둘 때 쓰기 좋아요.",
      usageTip: "습관이나 생활 패턴을 조금씩 바꾸면서 낮추고 싶은 목표와 잘 어울립니다.",
      example: `I want to work on lowering ${possessiveTarget} little by little.`
    },
    {
      expression: `I want to cut down on ${possessiveTarget}.`,
      meaningKo: "일상에서 소비하거나 너무 많이 하는 것을 줄이고 싶을 때 자연스러워요.",
      usageTip: "지출, 사용 시간, 간식처럼 생활 습관과 연결된 대상을 말할 때 특히 많이 씁니다.",
      example: `I want to cut down on ${possessiveTarget} after work.`
    }
  ];
}

function resolveMappedTranslation(normalizedTarget: string, dictionary: Record<string, string>, scaffoldTokens: string[]) {
  const candidate = scaffoldTokens
    .reduce((value, token) => value.replace(new RegExp(token, "g"), " "), normalizedTarget)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(을|를|은|는|이|가|과|와)$/g, "")
    .trim();

  for (const [key, value] of Object.entries(dictionary)) {
    if (candidate.includes(key)) {
      return value;
    }
  }

  const englishMatch = candidate.match(/[A-Za-z][A-Za-z0-9' -]{1,}/);
  return englishMatch?.[0]?.trim() ?? "";
}

function withMyPrefix(target: string) {
  return target.startsWith("my ") ? target : `my ${target}`;
}

function detectCoachIntents(question: string, prompt: Prompt) {
  const explicitIntents = detectCoachIntentsFromText(question);
  if (explicitIntents.length > 0) {
    return explicitIntents;
  }

  return detectCoachIntentsFromText(`${prompt.questionEn} ${prompt.questionKo} ${prompt.tip}`);
}

function buildIntentExpressions(intent: CoachIntent) {
  switch (intent) {
    case "starter":
      return [
        {
          expression: "These days, ...",
          meaningKo: "첫 문장을 부담 없이 자연스럽게 열 때 쓰기 좋은 표현이에요.",
          usageTip: "질문 주제로 바로 들어가기 전에 배경을 짧게 깔아 주고 싶을 때 좋아요.",
          example: "These days, technology plays a big role in how people connect."
        },
        {
          expression: "In modern society, ...",
          meaningKo: "조금 더 정리된 톤으로 첫 문장을 시작하고 싶을 때 잘 맞아요.",
          usageTip: "사회 변화나 일반적인 현상을 다루는 질문에서 특히 무난하게 쓸 수 있어요.",
          example: "In modern society, people often build relationships online."
        },
        {
          expression: "I think ...",
          meaningKo: "의견형 질문에서 첫 문장을 바로 시작할 때 가장 기본적으로 쓰기 좋아요.",
          usageTip: "입장을 먼저 또렷하게 보여 주고 싶을 때 부담 없이 열 수 있어요.",
          example: "I think technology has changed relationships in both good and bad ways."
        }
      ];
    case "reason":
      return [
        {
          expression: "One reason is that ...",
          meaningKo: "이유를 하나 분명하게 제시할 때 쓰는 표현이에요.",
          usageTip: "의견을 먼저 말한 뒤 바로 이유를 붙이고 싶을 때 좋아요.",
          example: "One reason is that it helps me stay focused."
        },
        {
          expression: "This is because ...",
          meaningKo: "앞문장의 이유를 바로 이어 설명할 때 쓰는 표현이에요.",
          usageTip: "짧고 직접적으로 이유를 붙이고 싶을 때 잘 맞아요.",
          example: "This is because it saves time."
        },
        {
          expression: "The main reason is that ...",
          meaningKo: "가장 중요한 이유를 강조할 때 쓰는 표현이에요.",
          usageTip: "이유가 여러 개 있을 수 있어도 핵심 한 가지를 먼저 잡아줄 수 있어요.",
          example: "The main reason is that it gives me more confidence."
        }
      ];
    case "example":
      return [
        {
          expression: "For example, ...",
          meaningKo: "예시를 바로 덧붙일 때 쓰는 표현이에요.",
          usageTip: "이유 뒤에 짧은 사례를 이어주면 답변이 더 구체적으로 보여요.",
          example: "For example, I practice speaking with my friends."
        },
        {
          expression: "For instance, ...",
          meaningKo: "예시를 조금 더 자연스럽게 이어줄 때 쓰는 표현이에요.",
          usageTip: "같은 예시 표현이지만 문장이 덜 반복되게 바꿔 쓰기 좋아요.",
          example: "For instance, I read English articles every morning."
        },
        {
          expression: "A good example is ...",
          meaningKo: "대표적인 사례를 소개할 때 쓰는 표현이에요.",
          usageTip: "짧은 경험보다 구체적 사례를 강조하고 싶을 때 좋아요.",
          example: "A good example is studying with a friend."
        }
      ];
    case "compare":
      return [
        {
          expression: "On the other hand, ...",
          meaningKo: "반대되는 면이나 다른 관점을 이어 말할 때 쓰는 표현이에요.",
          usageTip: "한쪽 의견만 말하지 않고 균형 있게 보여주고 싶을 때 좋아요.",
          example: "On the other hand, some people prefer studying alone."
        },
        {
          expression: "Compared with ...",
          meaningKo: "무언가와 비교해 차이를 보여줄 때 쓰는 표현이에요.",
          usageTip: "과거와 현재, 두 선택지를 비교할 때 자연스럽게 쓸 수 있어요.",
          example: "Compared with last year, I speak more confidently now."
        },
        {
          expression: "In contrast, ...",
          meaningKo: "대조되는 내용을 또렷하게 이어줄 때 쓰는 표현이에요.",
          usageTip: "비슷한 점보다 차이점을 선명하게 보여주고 싶을 때 좋아요.",
          example: "In contrast, I prefer quiet places."
        }
      ];
    case "opinion":
      return [
        {
          expression: "I think ...",
          meaningKo: "내 생각을 가장 가볍게 시작할 수 있는 표현이에요.",
          usageTip: "첫 문장을 열 때 부담이 적어서 거의 모든 질문에 무난해요.",
          example: "I think this habit is helpful."
        },
        {
          expression: "In my opinion, ...",
          meaningKo: "조금 더 분명하게 내 입장을 밝힐 때 쓰는 표현이에요.",
          usageTip: "의견형 질문에서 답변의 방향을 처음부터 또렷하게 잡아줘요.",
          example: "In my opinion, exercising every day is important."
        },
        {
          expression: "From my perspective, ...",
          meaningKo: "내 관점에서 말한다는 느낌을 줄 때 쓰는 표현이에요.",
          usageTip: "조금 더 자연스럽고 성숙한 톤으로 의견을 말하고 싶을 때 좋아요.",
          example: "From my perspective, reading every day is worth it."
        }
      ];
    case "structure":
      return [
        {
          expression: "First, ...",
          meaningKo: "답변의 흐름을 차례대로 열어줄 때 쓰는 표현이에요.",
          usageTip: "생각이 길어질 때 첫 포인트를 잡아주면 문장이 훨씬 쓰기 쉬워져요.",
          example: "First, I try to understand the topic clearly."
        },
        {
          expression: "Another point is that ...",
          meaningKo: "다른 포인트를 하나 더 이어 말할 때 쓰는 표현이에요.",
          usageTip: "두 번째 이유나 보충 포인트를 자연스럽게 붙일 수 있어요.",
          example: "Another point is that it saves time."
        },
        {
          expression: "As a result, ...",
          meaningKo: "앞의 이유가 어떤 결과로 이어지는지 보여줄 때 쓰는 표현이에요.",
          usageTip: "이유와 결과를 연결하면 답변이 더 논리적으로 보여요.",
          example: "As a result, I feel more confident when I speak."
        }
      ];
    default:
      return [];
  }
}

function buildIntentFirstExpressions(prompt: Prompt, question: string) {
  const detectedIntents = detectCoachIntents(question, prompt);
  const bucket: TopicExpressionSeed[] = [];

  if (detectedIntents.length > 0) {
    for (const intent of detectedIntents) {
      for (const expression of buildIntentExpressions(intent)) {
        addExpression(bucket, expression);
      }
    }
    return bucket;
  }

  return DEFAULT_HELP_EXPRESSIONS.slice(0, 4);
}

function buildCoachExpressions(prompt: Prompt, question: string): CoachExpression[] {
  const meaningLookupExpressions = buildMeaningLookupExpressions(question);
  const topicBundle = meaningLookupExpressions.length === 0 ? resolveExpressionTopic(question) : null;

  const bucket =
    meaningLookupExpressions.length > 0
      ? [...meaningLookupExpressions]
      : topicBundle
        ? [...topicBundle.expressions]
        : buildIntentFirstExpressions(prompt, question);

  if (bucket.length === 0) {
    bucket.push(...DEFAULT_HELP_EXPRESSIONS.slice(0, 4));
  }

  const unique = new Map<string, CoachExpression>();
  for (const item of bucket) {
    if (!unique.has(item.expression)) {
      unique.set(item.expression, {
        id: `coach-${topicBundle?.key ?? prompt.id}-${unique.size + 1}`,
        ...item
      });
    }
  }

  return Array.from(unique.values()).slice(0, 5);
}

function buildRelatedPromptIds(prompts: Prompt[], promptId: string, limit = 3) {
  const current = prompts.find((prompt) => prompt.id === promptId);
  const primaryPool = current
    ? prompts.filter((prompt) => prompt.id !== promptId && prompt.difficulty === current.difficulty)
    : prompts.filter((prompt) => prompt.id !== promptId);

  const fallbackPool = primaryPool.length > 0 ? primaryPool : prompts.filter((prompt) => prompt.id !== promptId);

  return fallbackPool.slice(0, limit).map((prompt) => prompt.id);
}

function buildCoachReply(
  intentLabel: CoachIntent | "general",
  topicBundle: ExpressionTopicBundle | null,
  question: string
) {
  if (looksLikeExpressionLookup(normalizeText(question))) {
    return "표현하고 싶은 뜻에 바로 가까운 표현을 먼저 골랐어요. 예문을 같이 보면서 내 문장에 맞는 걸 골라보세요.";
  }

  if (topicBundle) {
    return `${topicBundle.labelKo}을(를) 말할 때 바로 가져다 쓸 수 있는 표현을 중심으로 골랐어요. 비슷해 보여도 쓰임이 조금씩 다르니 예문까지 같이 보고 골라보세요.`;
  }

  switch (intentLabel) {
    case "starter":
      return "첫 문장을 자연스럽게 열 수 있는 표현부터 골랐어요. 도입 한 줄로 바로 시작해 보세요.";
    case "reason":
      return "이유를 말할 때 바로 쓸 수 있는 표현부터 골랐어요. 그대로 붙이지 말고 내 문장 안에서 자연스럽게 풀어 써보세요.";
    case "example":
      return "예시를 붙일 때 잘 맞는 표현을 먼저 골랐어요. 이유 뒤에 짧게 붙이면 답변이 더 구체적으로 보여요.";
    case "compare":
      return "비교나 반대 관점을 보여줄 때 쓸 수 있는 표현을 모았어요. 한쪽만 말하지 않고 균형을 줄 때 좋아요.";
    case "opinion":
      return "의견을 또렷하게 시작할 수 있는 표현부터 골랐어요. 첫 문장을 열 때 써보면 편해요.";
    case "structure":
      return "답변 흐름을 정리할 때 도움이 되는 표현을 먼저 골랐어요. 문장 순서를 잡고 싶을 때 써보세요.";
    default:
      return "이 질문에 맞는 표현을 먼저 골랐어요. 내 문장 안에서 자연스럽게 풀어 써보세요.";
  }
}

export function buildLocalCoachHelp(prompt: Prompt, question: string): CoachHelpResponse {
  const meaningLookupExpressions = buildMeaningLookupExpressions(question);
  const topicBundle = meaningLookupExpressions.length === 0 ? resolveExpressionTopic(question) : null;
  const expressions = buildCoachExpressions(prompt, question);
  const detectedIntents = detectCoachIntents(question, prompt);
  const intentLabel = detectedIntents[0] ?? "general";

  return {
    promptId: prompt.id,
    userQuestion: question,
    coachReply: buildCoachReply(intentLabel, topicBundle, question),
    expressions
  };
}

export function buildLocalCoachUsage(
  prompt: Prompt,
  answer: string,
  expressions: CoachExpression[],
  prompts: Prompt[]
): CoachUsageCheckResponse {
  const marked = expressions.map((expression) => markUsage(answer, expression));
  const usedExpressions = marked.filter((expression) => expression.matched);
  const unusedExpressions = marked.filter((expression) => !expression.matched);
  const praiseMessage =
    usedExpressions.length > 0
      ? `${usedExpressions[0].expression} 표현을 자연스럽게 살렸어요.`
      : "추천 표현이 아직 직접 보이진 않지만, 답변 방향은 잘 잡혀 있어요.";

  return {
    promptId: prompt.id,
    praiseMessage,
    usedExpressions,
    unusedExpressions,
    relatedPromptIds: buildRelatedPromptIds(prompts, prompt.id)
  };
}
