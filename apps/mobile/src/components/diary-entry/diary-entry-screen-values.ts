import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TextInput } from "react-native";
import type { CoachExpression, CoachHelpResponse, DiaryFeedback } from "@/lib/types";
import type { DiaryStep } from "./diary-entry-helpers";

// 영어일기 화면(src/components/diary-entry-screen.tsx)이 화면 조각에 넘기는 값. 조각마다 필요한 것만 Pick으로 받는다.
export type DiaryEntryScreenValues = {
  appendCoachExpression: (expression: string) => void;
  canSubmit: boolean;
  coachHelp: CoachHelpResponse | null;
  coachHelpError: string;
  coachQuestion: string;
  content: string;
  defaultTitle: string;
  diaryCoachQuickQuestions: string[];
  diaryInputRef: RefObject<TextInput | null>;
  displayMoodTags: string[];
  displayTitle: string;
  editorYRef: RefObject<number>;
  entryDate: string;
  error: string;
  feedback: DiaryFeedback | null;
  handleBackToDiaryList: () => void;
  handleCompleteDiary: () => Promise<void>;
  handleDeleteEntry: () => void;
  handleEntryDateChange: (nextDate: string) => void;
  handleHeaderBackPress: () => void;
  handleNewDiary: () => void;
  handleRequestCoachHelp: (questionOverride?: string) => Promise<void>;
  handleRequestFeedback: (nextAttemptType: "INITIAL" | "REWRITE") => Promise<void>;
  handleRetryLoadEntry: () => void;
  handleSaveCoachExpression: (expression: CoachExpression) => Promise<void>;
  handleSaveDraft: () => Promise<void>;
  handleStartRewrite: () => void;
  handleToggleDiaryExpression: (
    expression: string,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) => Promise<void>;
  handleToggleMoodTag: (tag: string) => void;
  initialEntryId: string | null;
  isCoachOpen: boolean;
  isCompleting: boolean;
  isDeleting: boolean;
  isLoadingCoachHelp: boolean;
  isReadOnlyFeedbackOpen: boolean;
  isSaving: boolean;
  readOnlyWordCount: number;
  rewriteText: string;
  savedCoachExpressionKeys: string[];
  savedExpressionIdsByKey: Record<string, number>;
  savingCoachExpressionKeys: string[];
  savingExpressionKeys: string[];
  selectedMoodTags: string[];
  setCoachHelp: Dispatch<SetStateAction<CoachHelpResponse | null>>;
  setCoachHelpError: Dispatch<SetStateAction<string>>;
  setCoachQuestion: Dispatch<SetStateAction<string>>;
  setContent: Dispatch<SetStateAction<string>>;
  setIsCoachOpen: Dispatch<SetStateAction<boolean>>;
  setIsReadOnlyFeedbackOpen: Dispatch<SetStateAction<boolean>>;
  setRewriteText: Dispatch<SetStateAction<string>>;
  setTitle: Dispatch<SetStateAction<string>>;
  step: DiaryStep;
  title: string;
  wordCount: number;
};
