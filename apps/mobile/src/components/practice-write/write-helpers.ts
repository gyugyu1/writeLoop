import type { DailyDifficulty } from "@/lib/types";

// 작문 화면의 순수 함수와 타입.
export function getPromptNotFoundMessage() {
  return "선택한 질문을 찾지 못했어요. 질문 목록으로 돌아가 다시 골라 주세요.";
}

export type WritingGuideChecklistItem = {
  title: string;
  description: string;
};

export type WritingGuide = {
  title: string;
  description: string;
  starter: string;
  checklist: WritingGuideChecklistItem[];
};

export type WritingGuideHintCard = {
  id: string;
  content: string;
  meaningKo?: string | null;
};

export function getWritingGuide(difficulty: DailyDifficulty, starterHint?: string | null): WritingGuide {
  switch (difficulty) {
    case "I":
      return {
        title: "짧게라도 바로 영어로 시작해 보세요.",
        description: "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각부터 익히면 됩니다.",
        starter: starterHint ?? "I usually ...",
        checklist: [
          {
            title: "핵심 답 한 줄 쓰기",
            description: "질문에 대한 내 답을 아주 짧게 먼저 써 보세요."
          },
          {
            title: "이유 한 줄 붙이기",
            description: "because 뒤에 짧은 이유만 더해도 훨씬 자연스러워져요."
          },
          {
            title: "쉬운 표현으로 끝내기",
            description: "어려운 문장보다 익숙한 표현으로 끝까지 써 보는 게 더 중요해요."
          }
        ]
      };
    case "A":
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
        starter: starterHint ?? "I think ... because ...",
        checklist: [
          {
            title: "생각 먼저 적기",
            description: "먼저 내 생각을 짧고 분명하게 적어 보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 문장만 덧붙여도 충분해요."
          },
          {
            title: "짧은 예시 더하기",
            description: "간단한 경험이나 상황을 하나 넣으면 더 자연스러워져요."
          }
        ]
      };
    case "B":
      return {
        title: "생각, 이유, 예시를 흐름 있게 적어 보세요.",
        description: "한 문장씩 차근차근 이어 가면 답이 더 안정적으로 들려요.",
        starter: starterHint ?? "In my opinion, ... One reason is that ...",
        checklist: [
          {
            title: "내 입장 먼저 밝히기",
            description: "질문에 대한 내 생각을 첫 문장에 분명하게 적어 보세요."
          },
          {
            title: "이유 하나 설명하기",
            description: "왜 그런지 구체적인 이유를 한두 문장으로 이어 가요."
          },
          {
            title: "예시나 경험 붙이기",
            description: "짧은 예시를 붙이면 답이 더 살아 있는 느낌이 나요."
          }
        ]
      };
    case "C":
      return {
        title: "주장과 근거를 구조적으로 보여 주세요.",
        description: "길게 쓰기보다 흐름이 보이게 정리하면 더 설득력 있어요.",
        starter: starterHint ?? "I believe ... because ... For example, ...",
        checklist: [
          {
            title: "주장 먼저 세우기",
            description: "답의 중심 생각을 첫 문장에 분명하게 적어 주세요."
          },
          {
            title: "근거를 한 단계 더 풀기",
            description: "이유를 한 문장으로 끝내지 말고 한 번 더 풀어 보세요."
          },
          {
            title: "예시나 비교 붙이기",
            description: "구체적인 예시나 비교를 더하면 답이 더 탄탄해져요."
          }
        ]
      };
    default:
      return {
        title: "완벽하지 않아도 일단 쓰는 것!",
        description: "",
        starter: starterHint ?? "I think ... because ...",
        checklist: [
          {
            title: "생각 먼저 적기",
            description: "내 생각을 한 문장으로 먼저 적어 보세요."
          },
          {
            title: "이유 하나 붙이기",
            description: "왜 그렇게 생각하는지 한 줄을 이어 보세요."
          },
          {
            title: "짧은 예시 더하기",
            description: "짧은 경험이나 상황을 더해 답을 완성해 보세요."
          }
        ]
      };
  }
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

export const PRACTICE_EXPRESSION_TRAILING_WEAK_TOKENS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "to",
  "with",
  "your",
  "his",
  "her"
]);

export function isLikelyCompletePracticeExpression(expression: string) {
  const normalized = expression.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const tokens = normalized.toLowerCase().split(" ");
  const lastToken = tokens[tokens.length - 1];
  return !PRACTICE_EXPRESSION_TRAILING_WEAK_TOKENS.has(lastToken);
}

export function parsePracticeExpressionsParam(value?: string | string[]) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const dedupedExpressions = new Set<string>();
    const expressions: string[] = [];

    parsed.forEach((item) => {
      if (typeof item !== "string") {
        return;
      }

      const normalized = normalizeExpressionKey(item);
      if (
        !normalized ||
        dedupedExpressions.has(normalized) ||
        !isLikelyCompletePracticeExpression(item)
      ) {
        return;
      }

      dedupedExpressions.add(normalized);
      expressions.push(item.trim());
    });

    return expressions;
  } catch {
    return [];
  }
}

export function formatDraftSavedAt(updatedAt: string) {
  return new Date(updatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function toDraftStatusBadgeLabel(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("실패")) {
    return "임시저장 실패";
  }

  if (normalized.startsWith("임시저장됨")) {
    return normalized;
  }

  if (normalized.includes("이 기기에 저장됨") || normalized.includes("이 기기에 임시저장됨")) {
    return "이 기기에 저장됨";
  }

  return normalized;
}

export function trimNullableText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimNullableText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}
