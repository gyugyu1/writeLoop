// 난이도별 작문 가이드(쓰기 화면 안내 문구와 힌트).
import type { DailyDifficulty } from "./types";

export type WritingGuideHintItem = {
  id: string;
  content: string;
  meaningKo?: string | null;
};

export type WritingGuide = {
  title: string;
  description: string;
  sentenceRange: [number, number];
  wordRange: [number, number];
  starter: string;
  checklist: Array<{
    title: string;
    description: string;
  }>;
};

export function getWritingGuide(difficulty: DailyDifficulty, starterHint?: string | null): WritingGuide {
  switch (difficulty) {
    case "I":
      return {
        title: "짧게라도 바로 영어로 시작해 보세요.",
        description: "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각을 만드는 데 집중해 보세요.",
        sentenceRange: [1, 2],
        wordRange: [10, 25],
        starter: starterHint ?? "I usually ...",
        checklist: [
          {
            title: "질문에 바로 답하기",
            description: "질문에서 묻는 핵심만 골라 아주 짧게 먼저 적어보세요."
          },
          {
            title: "이유 한 줄 붙이기",
            description: "because 뒤에 짧은 이유를 한 문장만 더하면 답이 훨씬 자연스러워져요."
          },
          {
            title: "쉬운 표현으로 끝내기",
            description: "어려운 문장보다 내가 바로 쓸 수 있는 표현으로 마무리하는 게 더 중요해요."
          }
        ]
      };
    case "A":
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
        sentenceRange: [2, 3],
        wordRange: [20, 40],
        starter: starterHint ?? "I think ... because ...",
        checklist: [
          {
            title: "의견 한 줄 쓰기",
            description: "먼저 내 생각을 짧고 분명하게 적어보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 문장만 더해도 충분해요."
          },
          {
            title: "짧은 예시 더하기",
            description: "내 경험이나 간단한 상황을 하나 넣으면 더 자연스러워져요."
          }
        ]
      };
    case "B":
      return {
        title: "의견, 이유, 예시를 한 흐름으로 묶어보세요.",
        description: "한 문장씩 차근차근 이어 쓰면 훨씬 안정적인 답변이 돼요.",
        sentenceRange: [3, 4],
        wordRange: [35, 60],
        starter: starterHint ?? "In my opinion, ... One reason is that ...",
        checklist: [
          {
            title: "내 입장 먼저 밝히기",
            description: "질문에 대한 내 생각을 첫 문장에 분명히 적어보세요."
          },
          {
            title: "이유 하나 설명하기",
            description: "왜 그런지 구체적인 이유를 한두 문장으로 이어가세요."
          },
          {
            title: "예시나 경험 추가하기",
            description: "짧은 사례를 붙이면 답변이 더 설득력 있어져요."
          }
        ]
      };
    case "C":
      return {
        title: "주장과 근거를 구조적으로 풀어보세요.",
        description: "길게 쓰기보다 흐름이 보이게 정리하면 훨씬 강한 답변이 돼요.",
        sentenceRange: [4, 6],
        wordRange: [55, 90],
        starter: starterHint ?? "I believe ... because ... For example, ...",
        checklist: [
          {
            title: "주장을 먼저 세우기",
            description: "답변의 중심 생각을 첫 문장에 분명하게 잡아주세요."
          },
          {
            title: "근거를 두텁게 만들기",
            description: "이유를 한 문장으로 끝내지 말고 한 번 더 풀어보세요."
          },
          {
            title: "예시나 비교 넣기",
            description: "구체적인 사례나 다른 관점을 덧붙이면 답변이 깊어져요."
          }
        ]
      };
    default:
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
        sentenceRange: [2, 3],
        wordRange: [20, 40],
        starter: starterHint ?? "I think ... because ...",
        checklist: [
          {
            title: "의견 먼저 쓰기",
            description: "내 생각을 한 문장으로 먼저 적어보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 줄을 이어보세요."
          },
          {
            title: "예시 하나 더하기",
            description: "짧은 경험이나 상황을 덧붙여 답변을 완성해 보세요."
          }
        ]
      };
  }
}
