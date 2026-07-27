export interface FeedbackSlotUiCopy {
  title: string;
  skeletonEn: string;
  skeletonKo: string;
}

const FEEDBACK_SLOT_UI_COPY: Record<string, FeedbackSlotUiCopy> = {
  ACTION: {
    title: "질문에 맞는 행동부터 답해보기",
    skeletonEn: "I usually ____.",
    skeletonKo: "저는 보통 ____해요."
  },
  CHOICE: {
    title: "내 선택부터 답해보기",
    skeletonEn: "I would choose ____.",
    skeletonKo: "저는 ____을 선택할 거예요."
  },
  GOAL: {
    title: "목표부터 답해보기",
    skeletonEn: "My goal is to ____.",
    skeletonKo: "제 목표는 ____하는 거예요."
  },
  PROBLEM: {
    title: "어려운 점부터 답해보기",
    skeletonEn: "One challenge is ____.",
    skeletonKo: "한 가지 어려운 점은 ____예요."
  },
  OPINION: {
    title: "내 생각부터 답해보기",
    skeletonEn: "I think ____.",
    skeletonKo: "저는 ____라고 생각해요."
  },
  PLAN: {
    title: "실행 계획 붙여보기",
    skeletonEn: "To reach this goal, I plan to ____.",
    skeletonKo: "이 목표를 이루기 위해 ____할 계획이에요."
  },
  SOLUTION: {
    title: "해결 방법 붙여보기",
    skeletonEn: "To handle this, I ____.",
    skeletonKo: "이 문제를 해결하려고 저는 ____해요."
  },
  ADVANTAGE: {
    title: "좋은 점 붙여보기",
    skeletonEn: "One advantage is ____.",
    skeletonKo: "한 가지 좋은 점은 ____예요."
  },
  DISADVANTAGE: {
    title: "반대쪽도 붙여보기",
    skeletonEn: "One drawback is ____.",
    skeletonKo: "한 가지 아쉬운 점은 ____예요."
  },
  BEFORE_STATE: {
    title: "예전 모습 붙여보기",
    skeletonEn: "I used to ____.",
    skeletonKo: "예전에는 ____하곤 했어요."
  },
  NOW_STATE: {
    title: "지금 모습도 붙여보기",
    skeletonEn: "Now, I ____.",
    skeletonKo: "지금은 ____해요."
  },
  CHANGE_CAUSE: {
    title: "바뀐 계기 붙여보기",
    skeletonEn: "This changed because ____.",
    skeletonKo: "이렇게 바뀐 이유는 ____이기 때문이에요."
  },
  ADDITIONAL_ACTION: {
    title: "다른 행동 하나 더 붙여보기",
    skeletonEn: "I also ____.",
    skeletonKo: "저는 또 ____해요."
  },
  SPECIFIC_TIME: {
    title: "언제인지 붙여보기",
    skeletonEn: "I usually do this ____.",
    skeletonKo: "저는 보통 ____에 이 일을 해요."
  },
  PLACE: {
    title: "어디에서인지 붙여보기",
    skeletonEn: "I do this at ____.",
    skeletonKo: "저는 ____에서 이 일을 해요."
  },
  REASON: {
    title: "이유 붙여보기",
    skeletonEn: "I do this because ____.",
    skeletonKo: "저는 ____해서 이렇게 해요."
  },
  DETAIL: {
    title: "구체적인 정보 붙여보기",
    skeletonEn: "More specifically, ____.",
    skeletonKo: "더 구체적으로 말하면, ____예요."
  },
  EXAMPLE: {
    title: "예시 하나 붙여보기",
    skeletonEn: "For example, ____.",
    skeletonKo: "예를 들면, ____예요."
  },
  FEELING: {
    title: "느낌 붙여보기",
    skeletonEn: "I feel ____.",
    skeletonKo: "저는 ____한 기분이 들어요."
  },
  RESULT: {
    title: "그 결과 붙여보기",
    skeletonEn: "As a result, ____.",
    skeletonKo: "그 결과, ____해요."
  }
};

export function getFeedbackSlotUiCopy(targetSlot?: string | null) {
  const normalized = targetSlot?.trim().toUpperCase();
  return normalized ? FEEDBACK_SLOT_UI_COPY[normalized] ?? null : null;
}
