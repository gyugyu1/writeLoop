import type { Dispatch, SetStateAction } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { NowInEnglishEntry } from "@/lib/now-in-english";
import type { useSession } from "@/lib/session";
import type { HistorySession, SavedExpression, TodayWritingStatus } from "@/lib/types";
import type {
  NowEnglishRecordGroup,
  RecordsContentTab,
  RecordsMonthCalendarData,
  resolveSavedExpressionPracticeTarget
} from "./records-helpers";

// 기록 화면(src/app/records.tsx)이 화면 조각에 넘기는 값. 조각마다 필요한 것만 Pick으로 받는다.
export type RecordsScreenValues = {
  activeTab: RecordsContentTab;
  canGoToNextCalendarMonth: boolean;
  canGoToPreviousCalendarMonth: boolean;
  currentUser: ReturnType<typeof useSession>["currentUser"];
  deletingSavedExpressionIds: Record<number, boolean>;
  findHistorySessionForSavedExpression: (savedExpression: SavedExpression) => HistorySession | null;
  groupedHistoryEntries: { dateKey: string; sessions: HistorySession[] }[];
  handleCloseCalendar: () => void;
  handleDateGroupLayout: (dateKey: string, event: LayoutChangeEvent) => void;
  handleDateFeedLayout: (event: LayoutChangeEvent) => void;
  handleHistoryBoardLayout: (event: LayoutChangeEvent) => void;
  handleDeleteSavedExpression: (savedExpression: SavedExpression) => void;
  handleOpenCalendar: () => void;
  handleOpenSavedExpressionHistory: (savedExpression: SavedExpression) => void;
  handleOpenSession: (session: HistorySession) => void;
  handlePracticeSavedExpression: (savedExpression: SavedExpression) => void;
  handlePracticeSelectedSavedExpressionTag: () => void;
  handleResetSavedExpressionControls: () => void;
  handleSelectCalendarDate: (dateKey: string) => void;
  handleSelectSavedExpressionTag: (tag: string, anchorSavedExpressionId?: number) => void;
  hasMoreHistory: boolean;
  hiddenDateGroupCount: number;
  history: HistorySession[];
  historyError: string;
  isCalendarOpen: boolean;
  isHistoryLoading: boolean;
  isLoadingMoreHistory: boolean;
  isNowEnglishLoading: boolean;
  isSavedExpressionsLoading: boolean;
  loadMoreHistory: () => Promise<void>;
  monthCalendar: RecordsMonthCalendarData;
  normalizedSavedExpressionSearch: string;
  nowEnglishEntries: NowInEnglishEntry[];
  nowEnglishError: string;
  nowEnglishRecordGroups: NowEnglishRecordGroup[];
  openDates: Record<string, boolean>;
  openSavedExpressionPrompts: Record<number, boolean>;
  savedExpressionError: string;
  savedExpressionSearchQuery: string;
  savedExpressionSectionMeta: string;
  savedExpressionTagOptions: { tag: string; count: number; label: string }[];
  savedExpressions: SavedExpression[];
  selectedSavedExpressionTag: string | null;
  selectedSavedExpressionTagLabel: string;
  selectedTagPracticeCandidate: {
    savedExpression: SavedExpression;
    practiceTarget: NonNullable<ReturnType<typeof resolveSavedExpressionPracticeTarget>>;
    expression: string;
    expressions: string[];
  } | null;
  setActiveTab: Dispatch<SetStateAction<RecordsContentTab>>;
  setCalendarMonthCursor: Dispatch<SetStateAction<Date>>;
  setOpenDates: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSavedExpressionSearchQuery: Dispatch<SetStateAction<string>>;
  setShowAllDateGroups: Dispatch<SetStateAction<boolean>>;
  showAllDateGroups: boolean;
  todayStatus: TodayWritingStatus | null;
  toggleSavedExpressionPrompt: (savedExpressionId: number) => void;
  visibleGroupedHistoryEntries: { dateKey: string; sessions: HistorySession[] }[];
  visibleSavedExpressions: SavedExpression[];
};
