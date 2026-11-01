import type { Dispatch, SetStateAction } from "react";
import type { DailyDifficulty, Feedback, Prompt } from "@/lib/types";
import type { useWriteCoach } from "./use-write-coach";
import type { WritingGuide, WritingGuideHintCard } from "./write-helpers";

type Setter<T> = Dispatch<SetStateAction<T>>;

// 작문 화면이 화면 조각에 넘기는 값의 타입. 조각마다 이 가운데 쓰는 것만 받는다.
export type WriteScreenValues = ReturnType<typeof useWriteCoach> & {
  answer: string;
  answerGuide: WritingGuide;
  answerWordCount: number;
  appendCoachExpression: (expression: string) => void;
  canViewLatestFeedback: boolean;
  draftStatusBadgeLabel: string;
  draftStatusMessage: string;
  error: string;
  feedback: Feedback | null;
  feedbackReferenceLabel: string;
  handleAnswerChange: (nextValue: string) => void;
  handleBackToQuestions: () => void;
  handleCancelWriting: () => void;
  handleHeaderBack: () => void;
  handleOpenLatestFeedback: () => void;
  handleSubmit: () => Promise<void>;
  isAnswerLocked: boolean;
  isCoachOpen: boolean;
  isGuideOpen: boolean;
  isLoadingPromptHints: boolean;
  isPreviousFeedbackOpen: boolean;
  isSubmitting: boolean;
  isTranslationVisible: boolean;
  practiceExpressions: string[];
  practiceTagLabel: string;
  previousFeedbackState: {
    difficulty: DailyDifficulty;
    prompt: Prompt;
    initialAnswer: string;
    answer: string;
    feedback: Feedback;
  } | null;
  primaryActionLabel: string;
  rewriteCoachBody: string;
  rewriteCoachTitle: string;
  selectedPrompt: Prompt | null;
  setIsCoachOpen: Setter<boolean>;
  setIsGuideOpen: Setter<boolean>;
  setIsPreviousFeedbackOpen: Setter<boolean>;
  setIsTranslationVisible: Setter<boolean>;
  vocabularyPhraseHintItems: WritingGuideHintCard[];
  vocabularyWordHintItems: WritingGuideHintCard[];
};
