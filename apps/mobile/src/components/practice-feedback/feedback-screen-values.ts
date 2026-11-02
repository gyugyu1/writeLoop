import type { Dispatch, RefObject, SetStateAction } from "react";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import type { derivePracticeFeedbackView } from "./feedback-view";
import type { FeedbackSavedExpressionsState } from "./use-feedback-saved-expressions";

type Setter<T> = Dispatch<SetStateAction<T>>;

// 피드백 화면이 화면 조각에 넘기는 값의 타입. 조각마다 이 가운데 쓰는 것만 받는다.
export type FeedbackScreenValues = ReturnType<typeof derivePracticeFeedbackView> &
  FeedbackSavedExpressionsState & {
    feedbackState: PracticeFeedbackState | null;
    isCompletionRewriteOpen: boolean;
    isModelAnswerOpen: boolean;
    setIsModelAnswerOpen: Setter<boolean>;
    isFinishing: boolean;
    rewriteDraft: string;
    setRewriteDraft: Setter<string>;
    isRewriteDraftRestored: boolean;
    setIsRewriteDraftRestored: Setter<boolean>;
    hasEditedRewriteRef: RefObject<boolean>;
    rewriteSubmissionIdRef: RefObject<string | null>;
    rewriteError: string;
    setRewriteError: Setter<string>;
    isSubmittingRewrite: boolean;
    setInlineRewriteY: Setter<number | null>;
    areAllLanguageCorrectionsVisible: boolean;
    setAreAllLanguageCorrectionsVisible: Setter<boolean>;
    revealedLanguageCorrectionIndexes: number[];
    setRevealedLanguageCorrectionIndexes: Setter<number[]>;
    isRevisedSentenceRevealed: boolean;
    setIsRevisedSentenceRevealed: Setter<boolean>;
    handleHeaderBack: () => void;
    handleBackToQuestions: () => void;
    handleOpenCompletionRewrite: () => void;
    handleSubmitInlineRewrite: () => Promise<void>;
    handleFinishLoop: () => Promise<void>;
  };

export type SavedExpressionProps = Pick<
  FeedbackScreenValues,
  "savedExpressionIdsByKey" | "savingExpressionKeys" | "handleToggleFeedbackExpression"
>;
