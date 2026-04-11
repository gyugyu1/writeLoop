import type { DailyDifficulty } from "./types";

export const difficultyDeck: {
  difficulty: DailyDifficulty;
  level: string;
  title: string;
  subtitle: string;
  accent: string;
  tint: string;
  duration: string;
  coachNote: string;
}[] = [
  {
    difficulty: "A",
    level: "LEVEL 01",
    title: "쉬움",
    subtitle: "기본 어휘와 쉬운 문장 구조로 부담 없이 첫 루프를 시작해 보세요.",
    accent: "#EF8A1F",
    tint: "#FFF0D8",
    duration: "약 5분",
    coachNote: "한 문장씩 또렷하게 완성하는 감각부터 잡는 데 좋아요."
  },
  {
    difficulty: "B",
    level: "LEVEL 02",
    title: "보통",
    subtitle: "이유와 예시를 조금 더 붙여 생각을 분명하게 펼쳐 보는 단계예요.",
    accent: "#2D7DA8",
    tint: "#E6F4FB",
    duration: "약 7분",
    coachNote: "핵심 문장에 근거를 덧붙이면 훨씬 설득력 있는 답안이 돼요."
  },
  {
    difficulty: "C",
    level: "LEVEL 03",
    title: "도전",
    subtitle: "비교와 전환 표현까지 살려 조금 더 길고 촘촘하게 써 보는 단계예요.",
    accent: "#8C5A30",
    tint: "#F3E4D7",
    duration: "약 10분",
    coachNote: "문장 연결과 디테일을 챙기면 완성도가 크게 올라갑니다."
  }
];

export function getDifficultyMeta(difficulty: DailyDifficulty) {
  return difficultyDeck.find((item) => item.difficulty === difficulty) ?? difficultyDeck[0];
}

export function getDifficultyLabel(difficulty: string) {
  return difficultyDeck.find((item) => item.difficulty === difficulty)?.title ?? difficulty;
}
