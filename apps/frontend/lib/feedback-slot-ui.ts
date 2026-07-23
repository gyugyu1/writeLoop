export interface FeedbackSlotUiCopy {
  title: string;
  description: string;
  skeletonEn: string;
  skeletonKo: string;
}

const FEEDBACK_SLOT_UI_COPY: Record<string, FeedbackSlotUiCopy> = {
  ACTION: {
    title: "질문에 맞는 행동부터 답해보기",
    description: "질문에서 물은 행동이나 일상을 한 문장으로 적어 보세요.",
    skeletonEn: "I usually ____.",
    skeletonKo: "저는 보통 ____해요."
  },
  CHOICE: {
    title: "내 선택부터 답해보기",
    description: "무엇을 좋아하거나 선택하는지 먼저 분명히 적어 보세요.",
    skeletonEn: "I would choose ____.",
    skeletonKo: "저는 ____을 선택할 거예요."
  },
  GOAL: {
    title: "목표부터 답해보기",
    description: "배우거나 이루고 싶은 것을 한 문장으로 적어 보세요.",
    skeletonEn: "My goal is to ____.",
    skeletonKo: "제 목표는 ____하는 거예요."
  },
  PROBLEM: {
    title: "어려운 점부터 답해보기",
    description: "겪고 있는 문제나 어려움을 먼저 적어 보세요.",
    skeletonEn: "One challenge is ____.",
    skeletonKo: "한 가지 어려운 점은 ____예요."
  },
  OPINION: {
    title: "내 생각부터 답해보기",
    description: "질문에 대한 생각이나 판단을 먼저 분명히 적어 보세요.",
    skeletonEn: "I think ____.",
    skeletonKo: "저는 ____라고 생각해요."
  },
  PLAN: {
    title: "실행 계획 붙여보기",
    description: "목표를 위해 무엇을 할지 한 단계만 구체적으로 붙여 보세요.",
    skeletonEn: "To reach this goal, I plan to ____.",
    skeletonKo: "이 목표를 이루기 위해 ____할 계획이에요."
  },
  SOLUTION: {
    title: "해결 방법 붙여보기",
    description: "그 문제를 어떻게 해결하거나 다룰지 한 가지 붙여 보세요.",
    skeletonEn: "To handle this, I ____.",
    skeletonKo: "이 문제를 해결하려고 저는 ____해요."
  },
  ADVANTAGE: {
    title: "좋은 점 붙여보기",
    description: "선택이나 상황의 좋은 점을 하나 구체적으로 붙여 보세요.",
    skeletonEn: "One advantage is ____.",
    skeletonKo: "한 가지 좋은 점은 ____예요."
  },
  DISADVANTAGE: {
    title: "반대쪽도 붙여보기",
    description: "좋은 점을 말했다면 아쉬운 점이나 한계도 하나 붙여 보세요.",
    skeletonEn: "One drawback is ____.",
    skeletonKo: "한 가지 아쉬운 점은 ____예요."
  },
  BEFORE_STATE: {
    title: "예전 모습 붙여보기",
    description: "바뀌기 전에는 어땠는지 한 문장으로 적어 보세요.",
    skeletonEn: "I used to ____.",
    skeletonKo: "예전에는 ____하곤 했어요."
  },
  NOW_STATE: {
    title: "지금 모습도 붙여보기",
    description: "예전과 비교해 지금은 어떤지 한 문장으로 붙여 보세요.",
    skeletonEn: "Now, I ____.",
    skeletonKo: "지금은 ____해요."
  },
  CHANGE_CAUSE: {
    title: "바뀐 계기 붙여보기",
    description: "생각이나 행동이 달라진 계기를 하나 붙여 보세요.",
    skeletonEn: "This changed because ____.",
    skeletonKo: "이렇게 바뀐 이유는 ____이기 때문이에요."
  },
  ADDITIONAL_ACTION: {
    title: "다른 행동 하나 더 붙여보기",
    description: "이미 말한 행동과 별개로 하는 일을 하나 더 붙여 보세요.",
    skeletonEn: "I also ____.",
    skeletonKo: "저는 또 ____해요."
  },
  SPECIFIC_TIME: {
    title: "언제인지 붙여보기",
    description: "그 일을 하는 구체적인 시간이나 때를 붙여 보세요.",
    skeletonEn: "I usually do this ____.",
    skeletonKo: "저는 보통 ____에 이 일을 해요."
  },
  PLACE: {
    title: "어디에서인지 붙여보기",
    description: "그 일이 일어나는 장소를 하나 붙여 보세요.",
    skeletonEn: "I do this at ____.",
    skeletonKo: "저는 ____에서 이 일을 해요."
  },
  REASON: {
    title: "이유 붙여보기",
    description: "왜 그렇게 생각하거나 행동하는지 한 가지 붙여 보세요.",
    skeletonEn: "I do this because ____.",
    skeletonKo: "저는 ____해서 이렇게 해요."
  },
  DETAIL: {
    title: "구체적인 정보 붙여보기",
    description: "이미 쓴 내용이 선명해지도록 작은 정보 하나를 붙여 보세요.",
    skeletonEn: "More specifically, ____.",
    skeletonKo: "더 구체적으로 말하면, ____예요."
  },
  EXAMPLE: {
    title: "예시 하나 붙여보기",
    description: "지금 말한 내용을 보여 주는 실제 예시를 하나 붙여 보세요.",
    skeletonEn: "For example, ____.",
    skeletonKo: "예를 들면, ____예요."
  },
  FEELING: {
    title: "느낌 붙여보기",
    description: "그때 어떤 기분이나 반응이 드는지 붙여 보세요.",
    skeletonEn: "I feel ____.",
    skeletonKo: "저는 ____한 기분이 들어요."
  },
  RESULT: {
    title: "그 결과 붙여보기",
    description: "그 행동이나 상황 뒤에 생기는 결과를 하나 붙여 보세요.",
    skeletonEn: "As a result, ____.",
    skeletonKo: "그 결과, ____해요."
  }
};

export function getFeedbackSlotUiCopy(targetSlot?: string | null) {
  const normalized = targetSlot?.trim().toUpperCase();
  return normalized ? FEEDBACK_SLOT_UI_COPY[normalized] ?? null : null;
}
