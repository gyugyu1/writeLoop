export type FeedbackLevelLabel = "매우 자연스러움" | "충분히 좋음" | "한 번 더 다듬기";

export interface FeedbackLevelInfo {
  label: FeedbackLevelLabel;
  summary: string;
  loopSummary: string;
}

export function getFeedbackLevelInfo(
  score: number,
  loopComplete?: boolean | null
): FeedbackLevelInfo {
  if (score >= 90) {
    return {
      label: "매우 자연스러움",
      summary: "지금 표현 그대로도 꽤 자연스럽게 읽혀요.",
      loopSummary: "오늘 루프를 아주 자연스럽게 마무리했어요."
    };
  }

  if (loopComplete || score >= 75) {
    return {
      label: "충분히 좋음",
      summary: "핵심이 잘 전달됐어요. 여기서 마무리해도 충분해요.",
      loopSummary: "오늘 루프를 충분히 좋은 흐름으로 마무리했어요."
    };
  }

  return {
    label: "한 번 더 다듬기",
    summary: "표현을 한 번 더 다듬으면 훨씬 자연스러워져요.",
    loopSummary: "한 번 더 다듬으면 더 자연스러운 답변이 될 수 있어요."
  };
}
