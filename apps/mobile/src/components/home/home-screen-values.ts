import type { Href } from "expo-router";
import type { Dispatch, SetStateAction } from "react";
import type { getDifficultyMeta } from "@/lib/difficulty";
import type { IncompleteLoopState } from "@/lib/incomplete-loop";
import type { getStreakMascotStage } from "@/lib/streak-mascot";
import type { DailyDifficulty, DiaryCalendarSummary, FeaturedDailyPromptRecommendation } from "@/lib/types";
import type {
  HomeDiaryCalendarCell,
  IncompleteLoopCopy,
  MonthCalendarData,
  WeekDayChip
} from "./home-helpers";

type FeaturedRecommendationItem = NonNullable<FeaturedDailyPromptRecommendation["featured"]>;

// 홈 화면(src/app/index.tsx)이 화면 조각에 넘기는 값. 조각마다 필요한 것만 Pick으로 받는다.
export type HomeScreenValues = {
  calendarError: string;
  calendarFooterLabel: string;
  calendarSummaryText: string;
  canGoToNextCalendarMonth: boolean;
  canGoToNextDiaryMonth: boolean;
  diaryCalendarError: string;
  diaryEntryDateKeys: Set<string>;
  diaryMonthLabel: string;
  diaryOverviewRoute: Href;
  diaryStreakBadgeLabel: string;
  featuredDifficultyMeta: ReturnType<typeof getDifficultyMeta>;
  featuredRecommendationError: string;
  featuredRecommendationItem: FeaturedRecommendationItem | null;
  featuredRecommendationPrompt: FeaturedRecommendationItem["prompt"] | null;
  handleChangeCalendarMonth: (direction: -1 | 1) => void;
  handleChangeDiaryMonth: (direction: -1 | 1) => void;
  handleCloseCalendar: () => void;
  handleOpenCalendar: () => void;
  handleOpenCalendarDate: (
    dateKey: string,
    hasWritingActivity: boolean,
    hasDiaryActivity: boolean,
    hasNowInEnglishActivity: boolean
  ) => void;
  handleOpenDiaryDate: (cell: HomeDiaryCalendarCell) => void;
  handleOpenNowInEnglish: () => void;
  handleOpenNowInEnglishRecords: () => void;
  handleOpenNowInEnglishReminder: () => void;
  handleResumeLoop: () => void;
  handleStart: (difficulty: DailyDifficulty) => void;
  handleStartFeaturedPrompt: () => void;
  handleWriteTodayDiary: () => void;
  historyRoute: Href;
  homeDiaryCalendar: HomeDiaryCalendarCell[];
  homeStatusMascot: ReturnType<typeof getStreakMascotStage>;
  incompleteLoop: IncompleteLoopState | null;
  incompleteLoopCopy: IncompleteLoopCopy | null;
  incompleteLoopInlineNote: string;
  isCalendarLoading: boolean;
  isCalendarOpen: boolean;
  isDiaryCalendarLoading: boolean;
  isFeaturedRecommendationLoading: boolean;
  isFeaturedRecommendationTranslationVisible: boolean;
  isGuideOpen: boolean;
  monthCalendar: MonthCalendarData;
  nowInEnglishDateKeys: Set<string>;
  nowInEnglishReminderEnabled: boolean;
  nowInEnglishTodayCount: number;
  setIsFeaturedRecommendationTranslationVisible: Dispatch<SetStateAction<boolean>>;
  setIsGuideOpen: Dispatch<SetStateAction<boolean>>;
  statusError: string;
  statusMetaLines: string[];
  todayDiaryEntry: DiaryCalendarSummary["days"][number] | null;
  weekChips: WeekDayChip[];
  writingStreakBadgeLabel: string;
};
