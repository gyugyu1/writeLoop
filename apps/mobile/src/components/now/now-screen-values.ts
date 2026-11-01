import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TextInput } from "react-native";
import type {
  NowInEnglishAiReflection,
  NowInEnglishAiReflectionExpression,
  NowInEnglishEntry,
  NowInEnglishIntervalHours,
  NowInEnglishQuietHours,
  NowInEnglishScheduleMode
} from "@/lib/now-in-english";
import type { CoachHelpResponse, NowInEnglishCoachFeedbackResponse } from "@/lib/types";
import type {
  HISTORY_FILTERS,
  NowInEnglishCalendarCell,
  NowInEnglishEntryGroup,
  NowInEnglishHistoryFilter
} from "./now-helpers";

// Now in English 화면(src/app/now.tsx)이 화면 조각에 넘기는 값. 조각마다 필요한 것만 Pick으로 받는다.
export type NowScreenValues = {
  appendCoachExpression: (expression: string) => void;
  calendarCells: NowInEnglishCalendarCell[];
  calendarMonthCursor: Date;
  coachHelp: CoachHelpResponse | null;
  coachHelpError: string;
  coachQuestion: string;
  coachQuickQuestions: string[];
  emptyTimelineCopy: { title: string; body: string };
  entryGroups: NowInEnglishEntryGroup[];
  handleAskCoachAboutInstantEntry: () => void;
  handleCancelPolish: () => void;
  handleDisableReminder: () => Promise<void>;
  handleEnableReminder: (nextIntervalHours: NowInEnglishIntervalHours) => Promise<void>;
  handleKeepInstantEntry: () => void;
  handleOpenCalendar: () => void;
  handleRequestCoachHelp: (questionOverride?: string, answerOverride?: string) => Promise<void>;
  handleRetryInstantCoachFeedback: () => void;
  handleReviseInstantEntry: () => void;
  handleSave: () => Promise<void>;
  handleSelectCalendarDate: (dateKey: string) => void;
  handleSelectHistoryFilter: (nextFilter: (typeof HISTORY_FILTERS)[number]["key"]) => void;
  handleToggleReflectionExpression: (expression: NowInEnglishAiReflectionExpression) => Promise<void>;
  handleUpdateQuietHours: (nextQuietHours: NowInEnglishQuietHours) => Promise<void>;
  handleUpdateScheduleMode: (nextScheduleMode: NowInEnglishScheduleMode) => Promise<void>;
  handleWriteTodayFromReflection: () => void;
  historyFilter: NowInEnglishHistoryFilter;
  historyMeta: string;
  historyTitle: string;
  inputRef: RefObject<TextInput | null>;
  instantCoachEntry: NowInEnglishEntry | null;
  instantCoachFeedback: NowInEnglishCoachFeedbackResponse | null;
  instantCoachFeedbackError: string;
  intervalHours: NowInEnglishIntervalHours;
  isCalendarOpen: boolean;
  isCoachOpen: boolean;
  isLoading: boolean;
  isLoadingCoachHelp: boolean;
  isLoadingInstantCoachFeedback: boolean;
  isLoadingYesterdayAiReflection: boolean;
  isPolishingEntry: boolean;
  isReminderSettingsOpen: boolean;
  isSaveDisabled: boolean;
  isScheduling: boolean;
  quietHours: NowInEnglishQuietHours;
  reflectionDateKey: string | null;
  reflectionDateLabel: string;
  reminderLabel: string;
  remindersEnabled: boolean;
  saveButtonLabel: string;
  savedExpressionIdsByKey: Record<string, number>;
  savingExpressionKeys: string[];
  scheduleMode: NowInEnglishScheduleMode;
  setCalendarMonthCursor: Dispatch<SetStateAction<Date>>;
  setCoachHelp: Dispatch<SetStateAction<CoachHelpResponse | null>>;
  setCoachHelpError: Dispatch<SetStateAction<string>>;
  setCoachQuestion: Dispatch<SetStateAction<string>>;
  setIsCalendarOpen: Dispatch<SetStateAction<boolean>>;
  setIsCoachOpen: Dispatch<SetStateAction<boolean>>;
  setIsReminderSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setText: Dispatch<SetStateAction<string>>;
  shiftQuietHour: (kind: "start" | "end", direction: -1 | 1) => void;
  shiftReminderInterval: (direction: -1 | 1) => void;
  statusMessage: string;
  text: string;
  yesterdayAiReflection: NowInEnglishAiReflection | null;
  yesterdayAiReflectionError: string;
  yesterdayEntries: NowInEnglishEntry[];
};
