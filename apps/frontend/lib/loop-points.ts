import type { LoopPointsReward } from "./types";

const ACTIVITY_NAMES: Record<LoopPointsReward["activity"], string> = {
  question: "질문 답하기",
  diary: "영어일기",
  nowInEnglish: "지금 영어로"
};

/** 완료 응답의 룹 적립 결과를 안내 문구로 바꾼다. 적립했으면 "+N룹 쌓였어요", 하루 한도에 닿았으면 "오늘 <활동> 룹은 다 모았어요", 그 밖은 null. */
export function loopPointsNotice(reward: LoopPointsReward | null | undefined): string | null {
  if (!reward) return null;
  if (reward.earned > 0) return `+${reward.earned}룹 쌓였어요`;
  if (reward.dailyLimitReached) {
    const name = ACTIVITY_NAMES[reward.activity];
    return name ? `오늘 ${name} 룹은 다 모았어요` : null;
  }
  return null;
}

/** 응답의 loopPoints를 읽는다. 모양이 맞지 않으면 null. */
export function readLoopPoints(value: unknown): LoopPointsReward | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const activity = record.activity;
  if (activity !== "question" && activity !== "diary" && activity !== "nowInEnglish") return null;
  if (typeof record.earned !== "number" || typeof record.balance !== "number" || typeof record.dailyLimitReached !== "boolean") return null;
  return { activity, earned: record.earned, balance: record.balance, dailyLimitReached: record.dailyLimitReached };
}
