import { router } from "expo-router";
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import MobileScreenHeader from "@/components/mobile-screen-header";
import { difficultyDeck } from "@/lib/difficulty";
import { NOW_IN_ENGLISH_NOTIFICATION_BODY } from "@/lib/now-in-english";
import { WEEKDAY_LABELS } from "./home-helpers";
import type { HomeScreenValues } from "./home-screen-values";
import { styles } from "./home-styles";

type HomeStatusPanelProps = Pick<
  HomeScreenValues,
  | "diaryStreakBadgeLabel"
  | "handleOpenCalendar"
  | "handleResumeLoop"
  | "historyRoute"
  | "homeStatusMascot"
  | "incompleteLoop"
  | "incompleteLoopCopy"
  | "incompleteLoopInlineNote"
  | "statusError"
  | "statusMetaLines"
  | "weekChips"
  | "writingStreakBadgeLabel"
>;
type NowInEnglishSectionContentProps = Pick<
  HomeScreenValues,
  | "handleOpenNowInEnglish"
  | "handleOpenNowInEnglishRecords"
  | "handleOpenNowInEnglishReminder"
  | "nowInEnglishReminderEnabled"
  | "nowInEnglishTodayCount"
>;
type FeaturedRecommendationContentProps = Pick<
  HomeScreenValues,
  | "featuredDifficultyMeta"
  | "featuredRecommendationError"
  | "featuredRecommendationItem"
  | "featuredRecommendationPrompt"
  | "handleStartFeaturedPrompt"
  | "isFeaturedRecommendationLoading"
  | "isFeaturedRecommendationTranslationVisible"
  | "setIsFeaturedRecommendationTranslationVisible"
>;
type DifficultySectionContentProps = Pick<HomeScreenValues, "handleStart">;
type HomeDiarySectionContentProps = Pick<
  HomeScreenValues,
  | "canGoToNextDiaryMonth"
  | "diaryCalendarError"
  | "diaryMonthLabel"
  | "diaryOverviewRoute"
  | "handleChangeDiaryMonth"
  | "handleOpenDiaryDate"
  | "handleWriteTodayDiary"
  | "homeDiaryCalendar"
  | "isDiaryCalendarLoading"
  | "todayDiaryEntry"
>;
type MonthCalendarModalProps = Pick<
  HomeScreenValues,
  | "calendarError"
  | "calendarFooterLabel"
  | "calendarSummaryText"
  | "canGoToNextCalendarMonth"
  | "diaryEntryDateKeys"
  | "handleChangeCalendarMonth"
  | "handleCloseCalendar"
  | "handleOpenCalendarDate"
  | "isCalendarLoading"
  | "isCalendarOpen"
  | "monthCalendar"
  | "nowInEnglishDateKeys"
>;
// 세션 확인 중 표시
export function HomeLoadingState() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.homeLoadingState}>
          <ActivityIndicator color="#E38B12" />
        </View>
      </View>
    </SafeAreaView>
  );
}

// 머리 줄: 의견 보내기
// 학습 일지 카드: 마스코트·연속 배지·통계, 요일 줄, 이어 쓰기 줄
export function HomeStatusPanel({
  diaryStreakBadgeLabel,
  handleOpenCalendar,
  handleResumeLoop,
  historyRoute,
  homeStatusMascot,
  incompleteLoop,
  incompleteLoopCopy,
  incompleteLoopInlineNote,
  statusError,
  statusMetaLines,
  weekChips,
  writingStreakBadgeLabel
}: HomeStatusPanelProps) {
  return (
    <View style={styles.statusPanel}>
      <Pressable style={styles.statusPanelMain} onPress={() => router.push(historyRoute)}>
      <View style={styles.statusLead}>
        <View style={styles.statusIconCircle}>
          <Image source={homeStatusMascot.source} style={styles.statusMascotImage} />
        </View>
        <View style={styles.statusCopy}>
          <View style={styles.statusTopRow}>
            <Text style={styles.statusTitle}>학습 일지</Text>
          </View>
          <View style={styles.statusBadgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{writingStreakBadgeLabel}</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusBadgeSecondary]}>
              <Text style={styles.statusBadgeText}>{diaryStreakBadgeLabel}</Text>
            </View>
          </View>
          <View style={styles.statusMetaGroup}>
            {statusMetaLines.map((line) => (
              <Text key={line} style={styles.statusMeta}>
                {line}
              </Text>
            ))}
          </View>
          {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
        </View>
      </View>

      </Pressable>

      <Pressable style={styles.weekRowButton} onPress={handleOpenCalendar}>
      <View style={styles.weekRow}>
        {weekChips.map((chip) => (
          <View
            key={chip.key}
            style={[
              styles.weekChip,
              chip.isCompleted && styles.weekChipDone,
              chip.isToday && styles.weekChipToday
            ]}
          >
            <Text
              style={[
                styles.weekChipText,
                chip.isCompleted && styles.weekChipTextDone,
                chip.isToday && styles.weekChipTextToday
              ]}
            >
              {chip.label}
            </Text>
          </View>
        ))}
      </View>
      </Pressable>

    {incompleteLoop && incompleteLoopCopy ? (
      <Pressable style={styles.statusResumeSection} onPress={handleResumeLoop}>
        <Text style={styles.resumeActionText}>{`${incompleteLoopCopy.ctaLabel} >`}</Text>
        <Text style={styles.resumeMeta}>{incompleteLoopInlineNote}</Text>
      </Pressable>
    ) : null}
    </View>
  );
}

// 지금 영어로 섹션 안쪽(바깥 View는 튜토리얼 측정 대상이라 화면에 남는다)
export function NowInEnglishSectionContent({
  handleOpenNowInEnglish,
  handleOpenNowInEnglishRecords,
  handleOpenNowInEnglishReminder,
  nowInEnglishReminderEnabled,
  nowInEnglishTodayCount
}: NowInEnglishSectionContentProps) {
  return (
    <>
      <MobileScreenHeader title="지금 영어로" />
      <View style={styles.nowEnglishHero}>
        <Text style={styles.nowEnglishBody}>{NOW_IN_ENGLISH_NOTIFICATION_BODY}</Text>
        <View style={styles.nowEnglishStatsRow}>
          <View style={styles.nowEnglishStatPill}>
            <Text style={styles.nowEnglishStatNumber}>{nowInEnglishTodayCount}</Text>
            <Text style={styles.nowEnglishStatLabel}>오늘 남긴 조각</Text>
          </View>
          <Pressable
            style={styles.nowEnglishStatPill}
            accessibilityRole="button"
            accessibilityLabel="루프 알림 설정 열기"
            onPress={handleOpenNowInEnglishReminder}
          >
            <Text style={styles.nowEnglishStatNumber}>{nowInEnglishReminderEnabled ? "ON" : "OFF"}</Text>
            <Text style={styles.nowEnglishStatLabel}>루프 알림</Text>
          </Pressable>
        </View>
        <View style={styles.nowEnglishActionRow}>
          <Pressable style={styles.nowEnglishPrimaryButton} onPress={handleOpenNowInEnglish}>
            <Text style={styles.nowEnglishPrimaryButtonText}>지금 쓰기</Text>
          </Pressable>
          <Pressable style={styles.nowEnglishSecondaryButton} onPress={handleOpenNowInEnglishRecords}>
            <Text style={styles.nowEnglishSecondaryButtonText}>기록 보기</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

// 질문 답하기 머리와 가이드 보기
// 오늘의 추천 질문 안쪽(바깥 View는 튜토리얼 측정 대상)
export function FeaturedRecommendationContent({
  featuredDifficultyMeta,
  featuredRecommendationError,
  featuredRecommendationItem,
  featuredRecommendationPrompt,
  handleStartFeaturedPrompt,
  isFeaturedRecommendationLoading,
  isFeaturedRecommendationTranslationVisible,
  setIsFeaturedRecommendationTranslationVisible
}: FeaturedRecommendationContentProps) {
  return (
    <>
      <View style={styles.featuredRecommendationHeader}>
        <Text style={styles.featuredRecommendationLabel}>오늘의 추천 질문</Text>
        <View
          style={[
            styles.featuredRecommendationDifficultyBadge,
            {
              backgroundColor: featuredDifficultyMeta.tint,
              borderColor: featuredDifficultyMeta.accent
            }
          ]}
        >
          <Text
            style={[
              styles.featuredRecommendationDifficultyText,
              { color: featuredDifficultyMeta.accent }
            ]}
          >
            {featuredDifficultyMeta.title}
          </Text>
        </View>
      </View>

      {isFeaturedRecommendationLoading ? (
        <View style={styles.featuredRecommendationLoadingCard}>
          <ActivityIndicator color="#E38B12" />
        </View>
      ) : featuredRecommendationPrompt ? (
        <Pressable style={styles.featuredRecommendationCard} onPress={handleStartFeaturedPrompt}>
            <Text style={styles.featuredRecommendationQuestion}>
              {featuredRecommendationPrompt.questionEn}
            </Text>
            {isFeaturedRecommendationTranslationVisible ? (
              <Text style={styles.featuredRecommendationTranslation}>
                {featuredRecommendationPrompt.questionKo}
              </Text>
            ) : null}
            {featuredRecommendationItem?.reasonText ? (
              <Text style={styles.featuredRecommendationReason}>
                {featuredRecommendationItem.reasonText}
              </Text>
            ) : null}
            <View style={styles.featuredRecommendationFooter}>
              <Text style={styles.featuredRecommendationMeta}>
                {featuredRecommendationPrompt.topic}
              </Text>
              <View style={styles.featuredRecommendationActions}>
                <Pressable
                  style={styles.featuredRecommendationTranslationButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    setIsFeaturedRecommendationTranslationVisible((current) => !current);
                  }}
                >
                  <Text style={styles.featuredRecommendationTranslationButtonText}>
                    {isFeaturedRecommendationTranslationVisible ? "해석 숨기기" : "해석 보기"}
                  </Text>
                </Pressable>
              </View>
            </View>
        </Pressable>
      ) : (
        <View style={styles.featuredRecommendationFallbackCard}>
          <Text style={styles.featuredRecommendationFallbackText}>
            {featuredRecommendationError || "오늘의 추천 질문을 준비하고 있어요."}
          </Text>
        </View>
      )}
    </>
  );
}

// 난이도별 질문 안쪽(바깥 View는 튜토리얼 측정 대상)
export function DifficultySectionContent({
  handleStart
}: DifficultySectionContentProps) {
  return (
    <>
      <View style={styles.difficultyChoiceHeader}>
        <Text style={styles.difficultyChoiceTitle}>난이도별 질문</Text>
        <Text style={styles.difficultyChoiceDescription}>내 수준에 맞게 골라 보세요.</Text>
      </View>
      <View style={styles.stageSection}>
        {difficultyDeck.map((item) => {
          return (
            <Pressable
              key={item.difficulty}
              style={styles.difficultyCard}
              onPress={() => handleStart(item.difficulty)}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// 영어일기 섹션과 달력 안쪽(바깥 View는 튜토리얼 측정 대상)
export function HomeDiarySectionContent({
  canGoToNextDiaryMonth,
  diaryCalendarError,
  diaryMonthLabel,
  diaryOverviewRoute,
  handleChangeDiaryMonth,
  handleOpenDiaryDate,
  handleWriteTodayDiary,
  homeDiaryCalendar,
  isDiaryCalendarLoading,
  todayDiaryEntry
}: HomeDiarySectionContentProps) {
  return (
    <>
      <MobileScreenHeader
        title="영어일기"
        rightAccessory={
          <Pressable style={styles.homeDiaryOverviewButton} onPress={() => router.push(diaryOverviewRoute)}>
            <Text style={styles.homeDiaryOverviewButtonText}>전체 보기</Text>
          </Pressable>
        }
      />

      <View style={styles.homeDiaryCalendarCard}>
        <View style={styles.homeDiaryMonthRow}>
          <Pressable style={styles.homeDiaryMonthButton} onPress={() => handleChangeDiaryMonth(-1)}>
            <Text style={styles.homeDiaryMonthButtonText}>{"<"}</Text>
          </Pressable>
          <Text style={styles.homeDiaryMonthTitle}>{diaryMonthLabel}</Text>
          <Pressable
            style={[
              styles.homeDiaryMonthButton,
              !canGoToNextDiaryMonth && styles.homeDiaryMonthButtonDisabled
            ]}
            onPress={() => handleChangeDiaryMonth(1)}
            disabled={!canGoToNextDiaryMonth}
          >
            <Text
              style={[
                styles.homeDiaryMonthButtonText,
                !canGoToNextDiaryMonth && styles.homeDiaryMonthButtonTextDisabled
              ]}
            >
              {">"}
            </Text>
          </Pressable>
        </View>

        {isDiaryCalendarLoading ? (
          <View style={styles.homeDiaryLoadingRow}>
            <ActivityIndicator color="#E38B12" />
          </View>
        ) : null}
        {diaryCalendarError ? <Text style={styles.homeDiaryErrorText}>{diaryCalendarError}</Text> : null}

        <View style={styles.homeDiaryWeekHeader}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={`diary-${label}`} style={styles.homeDiaryWeekLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.homeDiaryCalendarGrid}>
          {homeDiaryCalendar.map((cell) => (
            <View key={cell.key} style={styles.homeDiaryCalendarCellWrap}>
              <Pressable
                style={[
                  styles.homeDiaryCalendarCell,
                  cell.hasEntries && styles.homeDiaryCalendarCellHasEntries,
                  cell.isToday && styles.homeDiaryCalendarCellToday,
                  !cell.isCurrentMonth && styles.homeDiaryCalendarCellOutside,
                  cell.isFuture && styles.homeDiaryCalendarCellFuture
                ]}
                onPress={() => handleOpenDiaryDate(cell)}
                disabled={cell.isFuture}
                accessibilityRole="button"
                accessibilityLabel={`${cell.key} 영어일기 보기`}
              >
                <Text
                  style={[
                    styles.homeDiaryCalendarCellText,
                    cell.hasEntries && styles.homeDiaryCalendarCellTextHasEntries,
                    cell.isToday && styles.homeDiaryCalendarCellTextToday,
                    !cell.isCurrentMonth && styles.homeDiaryCalendarCellTextOutside,
                    cell.isFuture && styles.homeDiaryCalendarCellTextFuture
                  ]}
                >
                  {cell.dayNumber}
                </Text>
                {cell.hasEntries ? <View style={styles.homeDiaryCalendarDot} /> : null}
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable style={styles.homeDiaryWriteButton} onPress={handleWriteTodayDiary}>
          <Text style={styles.homeDiaryWriteButtonText}>
            {todayDiaryEntry ? "오늘 일기 이어보기" : "오늘의 일기 쓰기"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

// 월 달력 창
export function MonthCalendarModal({
  calendarError,
  calendarFooterLabel,
  calendarSummaryText,
  canGoToNextCalendarMonth,
  diaryEntryDateKeys,
  handleChangeCalendarMonth,
  handleCloseCalendar,
  handleOpenCalendarDate,
  isCalendarLoading,
  isCalendarOpen,
  monthCalendar,
  nowInEnglishDateKeys
}: MonthCalendarModalProps) {
  return (
    <Modal
      visible={isCalendarOpen}
      transparent
      animationType="fade"
      onRequestClose={handleCloseCalendar}
    >
      <View style={styles.calendarModalOverlay}>
        <Pressable style={styles.calendarModalBackdrop} onPress={handleCloseCalendar} />
        <ModalSafeAreaView
          style={styles.calendarModalFrame}
          minimumBottomInset={24}
          minimumTopInset={24}
        >
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarModalHeader}>
              <View style={styles.calendarModalHeaderCopy}>
                <View style={styles.calendarMonthNavRow}>
                  <Pressable
                    style={styles.calendarMonthNavButton}
                    onPress={() => handleChangeCalendarMonth(-1)}
                  >
                    <Text style={styles.calendarMonthNavButtonText}>{"<"}</Text>
                  </Pressable>
                  <Text style={styles.calendarModalTitle}>{monthCalendar.monthLabel}</Text>
                  <Pressable
                    style={[
                      styles.calendarMonthNavButton,
                      !canGoToNextCalendarMonth && styles.calendarMonthNavButtonDisabled
                    ]}
                    onPress={() => handleChangeCalendarMonth(1)}
                    disabled={!canGoToNextCalendarMonth}
                  >
                    <Text
                      style={[
                        styles.calendarMonthNavButtonText,
                        !canGoToNextCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                      ]}
                    >
                      {">"}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.calendarModalSubtitle}>{calendarSummaryText}</Text>
              </View>
              <Pressable style={styles.calendarModalCloseButton} onPress={handleCloseCalendar}>
                <Text style={styles.calendarModalCloseText}>닫기</Text>
              </Pressable>
            </View>

            {isCalendarLoading ? (
              <View style={styles.calendarLoadingRow}>
                <ActivityIndicator color="#E38B12" />
              </View>
            ) : null}
            {calendarError ? <Text style={styles.calendarErrorText}>{calendarError}</Text> : null}

            <View style={styles.calendarWeekHeader}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthCalendar.cells.map((cell) => {
                const hasWritingActivity = cell.isCompleted;
                const hasDiaryActivity = diaryEntryDateKeys.has(cell.key);
                const hasNowInEnglishActivity = nowInEnglishDateKeys.has(cell.key);
                const activityLabel = [
                  hasWritingActivity ? "작문 완료" : null,
                  hasDiaryActivity ? "일기 작성" : null
                ]
                  .filter(Boolean)
                  .join(", ");
                const completeActivityLabel = [activityLabel, hasNowInEnglishActivity ? "영어조각 작성" : null]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <View key={cell.key} style={styles.calendarCellWrap}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${cell.dayNumber}일${completeActivityLabel ? `, ${completeActivityLabel}` : ""}`}
                      onPress={() =>
                        handleOpenCalendarDate(
                          cell.key,
                          hasWritingActivity,
                          hasDiaryActivity,
                          hasNowInEnglishActivity
                        )
                      }
                      style={[
                        styles.calendarCell,
                        hasDiaryActivity && !hasWritingActivity && styles.calendarCellDiaryOnly,
                        cell.isCompleted && styles.calendarCellCompleted,
                        cell.isToday && styles.calendarCellToday,
                        !cell.isCurrentMonth && styles.calendarCellOutside
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          hasDiaryActivity && !hasWritingActivity && styles.calendarCellTextDiaryOnly,
                          cell.isCompleted && styles.calendarCellTextCompleted,
                          cell.isToday && styles.calendarCellTextToday,
                          !cell.isCurrentMonth && styles.calendarCellTextOutside
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                      {hasWritingActivity || hasDiaryActivity || hasNowInEnglishActivity ? (
                        <View style={styles.calendarActivityMarkers} pointerEvents="none">
                          <View style={styles.calendarActivityDotSlot}>
                            {hasWritingActivity ? (
                              <View style={[styles.calendarActivityDot, styles.calendarActivityDotWriting]} />
                            ) : null}
                          </View>
                          <View style={styles.calendarActivityDotSlot}>
                            {hasDiaryActivity ? (
                              <View style={[styles.calendarActivityDot, styles.calendarActivityDotDiary]} />
                            ) : null}
                          </View>
                          <View style={styles.calendarActivityDotSlot}>
                            {hasNowInEnglishActivity ? (
                              <View style={[styles.calendarActivityDot, styles.calendarActivityDotNow]} />
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.calendarActivityLegend}>
              <View style={styles.calendarActivityLegendItem}>
                <View style={[styles.calendarActivityDot, styles.calendarActivityDotWriting]} />
                <Text style={styles.calendarActivityLegendText}>작문</Text>
              </View>
              <View style={styles.calendarActivityLegendItem}>
                <View style={[styles.calendarActivityDot, styles.calendarActivityDotDiary]} />
                <Text style={styles.calendarActivityLegendText}>일기</Text>
              </View>
              <View style={styles.calendarActivityLegendItem}>
                <View style={[styles.calendarActivityDot, styles.calendarActivityDotNow]} />
                <Text style={styles.calendarActivityLegendText}>영어조각</Text>
              </View>
            </View>

            <Text style={styles.calendarFooterMeta}>{calendarFooterLabel}</Text>
          </View>
        </ModalSafeAreaView>
      </View>
    </Modal>
  );
}

// 학습 가이드 창
