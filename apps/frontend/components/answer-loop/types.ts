// 웹 주 화면(AnswerLoop)과 그 화면 조각이 함께 쓰는 타입.

export type Step = "pick" | "answer" | "feedback" | "rewrite" | "complete";

export type PracticeExpressionHint = {
  expression: string;
  tag?: string | null;
  tagLabel?: string | null;
  expressions: string[];
};
