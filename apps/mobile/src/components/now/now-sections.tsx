import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import { formatNowInEnglishQuietHours } from "@/lib/now-in-english";
import type { CoachExpression } from "@/lib/types";
import {
  EntryTimeline,
  YesterdayReflectionCard,
  InstantCoachFeedbackCard,
  QuietHourStepper,
  ReminderIntervalStepper
} from "./now-cards";
import {
  HISTORY_FILTERS,
  WEEK_LABELS,
  NOW_IN_ENGLISH_TEXT_LIMIT,
  normalizeExpressionKey,
  getScheduleModeBody,
  getCalendarMonthStart,
  formatCalendarMonthLabel
} from "./now-helpers";
import type { NowScreenValues } from "./now-screen-values";
import { styles } from "./now-styles";

const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

type NowComposerCardProps = Pick<
  NowScreenValues,
  | "handleCancelPolish"
  | "inputRef"
  | "isCoachOpen"
  | "isLoading"
  | "isPolishingEntry"
  | "setIsCoachOpen"
  | "setText"
  | "text"
>;
type NowSaveAreaProps = Pick<
  NowScreenValues,
  | "handleAskCoachAboutInstantEntry"
  | "handleKeepInstantEntry"
  | "handleRetryInstantCoachFeedback"
  | "handleReviseInstantEntry"
  | "handleSave"
  | "instantCoachEntry"
  | "instantCoachFeedback"
  | "instantCoachFeedbackError"
  | "isLoadingInstantCoachFeedback"
  | "isSaveDisabled"
  | "saveButtonLabel"
  | "statusMessage"
>;
type NowReminderSummaryButtonProps = Pick<
  NowScreenValues,
  | "isLoading"
  | "isScheduling"
  | "reminderLabel"
  | "remindersEnabled"
  | "setIsReminderSettingsOpen"
>;
type NowHistorySectionProps = Pick<
  NowScreenValues,
  | "emptyTimelineCopy"
  | "entryGroups"
  | "handleOpenCalendar"
  | "handleSelectHistoryFilter"
  | "handleToggleReflectionExpression"
  | "handleWriteTodayFromReflection"
  | "historyFilter"
  | "historyMeta"
  | "historyTitle"
  | "isLoadingYesterdayAiReflection"
  | "reflectionDateKey"
  | "reflectionDateLabel"
  | "savedExpressionIdsByKey"
  | "savingExpressionKeys"
  | "yesterdayAiReflection"
  | "yesterdayAiReflectionError"
  | "yesterdayEntries"
>;
type NowReminderSettingsModalProps = Pick<
  NowScreenValues,
  | "handleDisableReminder"
  | "handleEnableReminder"
  | "handleUpdateQuietHours"
  | "handleUpdateScheduleMode"
  | "intervalHours"
  | "isReminderSettingsOpen"
  | "isScheduling"
  | "quietHours"
  | "reminderLabel"
  | "remindersEnabled"
  | "scheduleMode"
  | "setIsReminderSettingsOpen"
  | "shiftQuietHour"
  | "shiftReminderInterval"
>;
type NowCoachModalProps = Pick<
  NowScreenValues,
  | "appendCoachExpression"
  | "coachHelp"
  | "coachHelpError"
  | "coachQuestion"
  | "coachQuickQuestions"
  | "handleRequestCoachHelp"
  | "isCoachOpen"
  | "isLoadingCoachHelp"
  | "setCoachHelp"
  | "setCoachHelpError"
  | "setCoachQuestion"
  | "setIsCoachOpen"
>;
type NowCalendarModalProps = Pick<
  NowScreenValues,
  | "calendarCells"
  | "calendarMonthCursor"
  | "handleSelectCalendarDate"
  | "isCalendarOpen"
  | "setCalendarMonthCursor"
  | "setIsCalendarOpen"
>;

// 머리 줄(뒤로 가기)
export function NowHeaderRow() {
  return (
    <View style={styles.headerRow}>
      <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
        <Text style={styles.backButtonText}>{"<"}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>지금 영어로</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// 불러오는 중 표시와 쓰기 카드(입력칸, AI 코치 열기)
export function NowComposerCard({
  handleCancelPolish,
  inputRef,
  isCoachOpen,
  isLoading,
  isPolishingEntry,
  setIsCoachOpen,
  setText,
  text
}: NowComposerCardProps) {
  return (
    <>
      {isLoading ? (
        <View style={styles.writeHeader}>
          <ActivityIndicator color="#EA920D" />
        </View>
      ) : null}

      <View style={styles.composerCard}>
        <Text style={styles.heroTitle}>지금 뭐하고 있나요?, 무슨 생각하고 있나요?</Text>
        <View style={styles.composerDivider} />
        {isPolishingEntry ? (
          <View style={styles.polishModeBanner}>
            <View style={styles.polishModeCopy}>
              <Text style={styles.polishModeLabel}>기존 기록 수정 중</Text>
              <Text style={styles.polishModeBody}>저장하면 방금 남긴 문장이 수정되고 전후 비교가 남아요.</Text>
            </View>
            <Pressable style={styles.polishCancelButton} onPress={handleCancelPolish}>
              <Text style={styles.polishCancelButtonText}>취소</Text>
            </Pressable>
          </View>
        ) : null}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          maxLength={NOW_IN_ENGLISH_TEXT_LIMIT}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoCorrect
          placeholder="I’m doing something small right now."
          placeholderTextColor="#B7A693"
          style={styles.input}
        />

        {!isCoachOpen ? (
          <Pressable
            style={[styles.coachTriggerDock, !text.trim() && styles.coachTriggerDockWithBubble]}
            accessibilityRole="button"
            accessibilityLabel="AI 코치 열기"
            accessibilityHint="지금 영어로 한 줄 기록을 도와주는 AI 코치를 엽니다."
            onPress={() => setIsCoachOpen(true)}
          >
            {!text.trim() ? (
              <View style={styles.coachTriggerBubble}>
                <Text style={styles.coachTriggerBubbleText}>막히면 AI 코치에게 물어봐요.</Text>
                <View style={styles.coachTriggerBubbleTail} />
              </View>
            ) : null}

            <View style={styles.coachTriggerMascotFrame}>
              <Image source={coachMascotImage} style={styles.coachTriggerMascot} />
            </View>
          </Pressable>
        ) : null}
        <Text style={styles.inputCounter}>{text.length}/{NOW_IN_ENGLISH_TEXT_LIMIT}</Text>
      </View>
    </>
  );
}

// 상태 문구, 저장 버튼, 바로 코치 피드백 카드
export function NowSaveArea({
  handleAskCoachAboutInstantEntry,
  handleKeepInstantEntry,
  handleRetryInstantCoachFeedback,
  handleReviseInstantEntry,
  handleSave,
  instantCoachEntry,
  instantCoachFeedback,
  instantCoachFeedbackError,
  isLoadingInstantCoachFeedback,
  isSaveDisabled,
  saveButtonLabel,
  statusMessage
}: NowSaveAreaProps) {
  return (
    <>
      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

      <Pressable
        style={[styles.primaryButton, isSaveDisabled && styles.buttonDisabled]}
        onPress={() => void handleSave()}
        disabled={isSaveDisabled}
      >
        <Text style={styles.primaryButtonText}>{saveButtonLabel}</Text>
      </Pressable>

      {instantCoachEntry ? (
        <InstantCoachFeedbackCard
          entry={instantCoachEntry}
          feedback={instantCoachFeedback}
          isLoading={isLoadingInstantCoachFeedback}
          error={instantCoachFeedbackError}
          onAskCoach={handleAskCoachAboutInstantEntry}
          onRevise={handleReviseInstantEntry}
          onKeep={handleKeepInstantEntry}
          onRetry={handleRetryInstantCoachFeedback}
        />
      ) : null}
    </>
  );
}

// 알림 요약 버튼
export function NowReminderSummaryButton({
  isLoading,
  isScheduling,
  reminderLabel,
  remindersEnabled,
  setIsReminderSettingsOpen
}: NowReminderSummaryButtonProps) {
  return (
    <Pressable
      style={[styles.reminderSummaryButton, (isScheduling || isLoading) && styles.buttonDisabled]}
      accessibilityRole="button"
      accessibilityLabel="알림 설정 열기"
      onPress={() => setIsReminderSettingsOpen(true)}
      disabled={isScheduling || isLoading}
    >
      <View style={styles.reminderSummaryCopy}>
        <Text style={styles.reminderSummaryTitle}>알림 설정</Text>
        <Text style={styles.reminderSummaryMeta}>{reminderLabel}</Text>
      </View>
      <View style={[styles.reminderBadge, remindersEnabled && styles.reminderBadgeOn]}>
        <Text style={[styles.reminderBadgeText, remindersEnabled && styles.reminderBadgeTextOn]}>
          {remindersEnabled ? "ON" : "OFF"}
        </Text>
      </View>
    </Pressable>
  );
}

// 기록 보기: 머리와 달력 버튼, 보기 탭, 돌아보기 카드, 타임라인
export function NowHistorySection({
  emptyTimelineCopy,
  entryGroups,
  handleOpenCalendar,
  handleSelectHistoryFilter,
  handleToggleReflectionExpression,
  handleWriteTodayFromReflection,
  historyFilter,
  historyMeta,
  historyTitle,
  isLoadingYesterdayAiReflection,
  reflectionDateKey,
  reflectionDateLabel,
  savedExpressionIdsByKey,
  savingExpressionKeys,
  yesterdayAiReflection,
  yesterdayAiReflectionError,
  yesterdayEntries
}: NowHistorySectionProps) {
  return (
    <View style={styles.listSection}>
      <View style={styles.listHeaderRow}>
        <View style={styles.listHeaderCopy}>
          <Text style={styles.sectionTitle}>{historyTitle}</Text>
          <Text style={styles.listMeta}>{historyMeta}</Text>
        </View>
        <Pressable style={styles.calendarOpenButton} onPress={handleOpenCalendar}>
          <Text style={styles.calendarOpenButtonText}>달력</Text>
        </Pressable>
      </View>
      <View style={styles.historyTabs}>
        {HISTORY_FILTERS.map((filter) => {
          const isActive = historyFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[styles.historyTab, isActive && styles.historyTabActive]}
              onPress={() => handleSelectHistoryFilter(filter.key)}
            >
              <Text style={[styles.historyTabText, isActive && styles.historyTabTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {reflectionDateKey && yesterdayEntries.length > 0 ? (
        <YesterdayReflectionCard
          entries={yesterdayEntries}
          dateLabel={reflectionDateLabel}
          aiReflection={yesterdayAiReflection}
          isLoadingAiReflection={isLoadingYesterdayAiReflection}
          aiReflectionError={yesterdayAiReflectionError}
          onWriteToday={handleWriteTodayFromReflection}
          onToggleExpression={(expression) => void handleToggleReflectionExpression(expression)}
          isExpressionSaved={(expression) => Boolean(savedExpressionIdsByKey[normalizeExpressionKey(expression)])}
          isSavingExpression={(expression) => savingExpressionKeys.includes(normalizeExpressionKey(expression))}
        />
      ) : null}
      <EntryTimeline
        groups={entryGroups}
        emptyTitle={emptyTimelineCopy.title}
        emptyBody={emptyTimelineCopy.body}
      />
    </View>
  );
}

// 알림 설정 창
export function NowReminderSettingsModal({
  handleDisableReminder,
  handleEnableReminder,
  handleUpdateQuietHours,
  handleUpdateScheduleMode,
  intervalHours,
  isReminderSettingsOpen,
  isScheduling,
  quietHours,
  reminderLabel,
  remindersEnabled,
  scheduleMode,
  setIsReminderSettingsOpen,
  shiftQuietHour,
  shiftReminderInterval
}: NowReminderSettingsModalProps) {
  return (
    <Modal
      visible={isReminderSettingsOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsReminderSettingsOpen(false)}
    >
      <View style={styles.reminderSettingsOverlay}>
        <Pressable style={styles.reminderSettingsBackdrop} onPress={() => setIsReminderSettingsOpen(false)} />
        <ModalSafeAreaView style={styles.reminderSettingsFrame}>
          <View style={styles.reminderSettingsCard}>
            <View style={styles.reminderSettingsHeader}>
              <View style={styles.reminderSettingsHeaderCopy}>
                <Text style={styles.reminderSettingsTitle}>언제마다 알려드릴까요?</Text>
              </View>
              <Pressable
                style={styles.reminderSettingsCloseButton}
                onPress={() => setIsReminderSettingsOpen(false)}
              >
                <Text style={styles.reminderSettingsCloseText}>닫기</Text>
              </Pressable>
            </View>

            <Text style={styles.reminderSettingsBody}>
              지금 하고 있는 일이나 떠오른 생각을 영어로 남길 수 있게 가볍게 알려드릴게요.
            </Text>
            <Text style={styles.reminderMeta}>{reminderLabel}</Text>

            <View style={styles.reminderSettingsActions}>
              <ReminderIntervalStepper
                intervalHours={intervalHours}
                onDecrease={() => shiftReminderInterval(-1)}
                onIncrease={() => shiftReminderInterval(1)}
                disabled={isScheduling}
              />
              <Pressable
                style={[
                  styles.reminderPowerButton,
                  !remindersEnabled && styles.reminderPowerButtonOn,
                  isScheduling && styles.buttonDisabled
                ]}
                onPress={() => void (remindersEnabled ? handleDisableReminder() : handleEnableReminder(intervalHours))}
                disabled={isScheduling}
              >
                <Text
                  style={[
                    styles.reminderPowerButtonText,
                    !remindersEnabled && styles.reminderPowerButtonTextOn
                  ]}
                >
                  {remindersEnabled ? "알림 끄기" : "알림 켜기"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.scheduleModeCard}>
              <View style={styles.scheduleModeHeader}>
                <View style={styles.scheduleModeCopy}>
                  <Text style={styles.scheduleModeTitle}>알림 기준</Text>
                  <Text style={styles.scheduleModeBody}>{getScheduleModeBody(scheduleMode)}</Text>
                </View>
              </View>
              <View style={styles.scheduleModeOptions}>
                <Pressable
                  style={[
                    styles.scheduleModeOption,
                    scheduleMode === "HOURLY_ANCHOR" && styles.scheduleModeOptionActive
                  ]}
                  onPress={() => void handleUpdateScheduleMode("HOURLY_ANCHOR")}
                  disabled={isScheduling}
                >
                  <Text
                    style={[
                      styles.scheduleModeOptionText,
                      scheduleMode === "HOURLY_ANCHOR" && styles.scheduleModeOptionTextActive
                    ]}
                  >
                    정각 기준
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.scheduleModeOption,
                    scheduleMode === "FROM_NOW" && styles.scheduleModeOptionActive
                  ]}
                  onPress={() => void handleUpdateScheduleMode("FROM_NOW")}
                  disabled={isScheduling}
                >
                  <Text
                    style={[
                      styles.scheduleModeOptionText,
                      scheduleMode === "FROM_NOW" && styles.scheduleModeOptionTextActive
                    ]}
                  >
                    지금부터
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.quietHoursCard}>
              <View style={styles.quietHoursHeader}>
                <View style={styles.quietHoursCopy}>
                  <Text style={styles.quietHoursTitle}>방해금지 시간</Text>
                  <Text style={styles.quietHoursBody}>
                    {quietHours.enabled
                      ? `${formatNowInEnglishQuietHours(quietHours)}에는 알림을 쉬어요.`
                      : "밤에도 알림을 받을 수 있어요."}
                  </Text>
                </View>
                <Pressable
                  style={[styles.quietHoursToggle, quietHours.enabled && styles.quietHoursToggleActive]}
                  onPress={() => void handleUpdateQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
                  disabled={isScheduling}
                >
                  <Text
                    style={[
                      styles.quietHoursToggleText,
                      quietHours.enabled && styles.quietHoursToggleTextActive
                    ]}
                  >
                    {quietHours.enabled ? "ON" : "OFF"}
                  </Text>
                </Pressable>
              </View>

              {quietHours.enabled ? (
                <View style={styles.quietHourStepperRow}>
                  <QuietHourStepper
                    label="시작"
                    hour={quietHours.startHour}
                    onDecrease={() => shiftQuietHour("start", -1)}
                    onIncrease={() => shiftQuietHour("start", 1)}
                    disabled={isScheduling}
                  />
                  <QuietHourStepper
                    label="종료"
                    hour={quietHours.endHour}
                    onDecrease={() => shiftQuietHour("end", -1)}
                    onIncrease={() => shiftQuietHour("end", 1)}
                    disabled={isScheduling}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </ModalSafeAreaView>
      </View>
    </Modal>
  );
}

// AI 코치 창
export function NowCoachModal({
  appendCoachExpression,
  coachHelp,
  coachHelpError,
  coachQuestion,
  coachQuickQuestions,
  handleRequestCoachHelp,
  isCoachOpen,
  isLoadingCoachHelp,
  setCoachHelp,
  setCoachHelpError,
  setCoachQuestion,
  setIsCoachOpen
}: NowCoachModalProps) {
  return (
    <Modal visible={isCoachOpen} animationType="slide" onRequestClose={() => setIsCoachOpen(false)}>
      <ModalSafeAreaView style={styles.coachModalRoot}>
        <KeyboardAvoidingView
          style={styles.coachModalKeyboardFrame}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View style={styles.coachModalHeader}>
            <Text style={styles.coachModalTitle}>AI 코치</Text>
            <Pressable style={styles.coachModalCloseButton} onPress={() => setIsCoachOpen(false)}>
              <Text style={styles.coachCloseText}>닫기</Text>
            </Pressable>
          </View>

          <View style={styles.coachModalBody}>
            <ScrollView
              style={styles.coachModalScroll}
              contentContainerStyle={styles.coachModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.coachPanel}>
                <Text style={styles.coachPanelTitle}>지금 상황을 영어로 쓰는 걸 도와드릴게요.</Text>
                <TextInput
                  style={styles.coachInput}
                  multiline
                  textAlignVertical="top"
                  placeholder='예: "퇴근길에 피곤해"를 영어로 어떻게 말해?'
                  placeholderTextColor="#AE9A87"
                  value={coachQuestion}
                  onChangeText={(value) => {
                    setCoachQuestion(value);
                    setCoachHelp(null);
                    setCoachHelpError("");
                  }}
                />

                <View style={styles.coachQuickActionWrap}>
                  {coachQuickQuestions.map((question) => (
                    <Pressable
                      key={question}
                      style={styles.coachQuickChip}
                      onPress={() => {
                        setCoachQuestion(question);
                        setCoachHelp(null);
                        setCoachHelpError("");
                      }}
                    >
                      <Text style={styles.coachQuickChipText}>{question}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[styles.coachPrimaryButton, isLoadingCoachHelp && styles.buttonDisabled]}
                  onPress={() => void handleRequestCoachHelp()}
                  disabled={isLoadingCoachHelp}
                >
                  {isLoadingCoachHelp ? (
                    <ActivityIndicator color="#24180B" />
                  ) : (
                    <Text style={styles.coachPrimaryButtonText}>코치에게 물어보기</Text>
                  )}
                </Pressable>

                <Text style={styles.coachMetaText}>
                  코치 답변은 힌트예요. 그대로 복사하기보다 지금 내 상황에 맞게 한 줄로 바꿔 보세요.
                </Text>

                {coachHelpError ? <Text style={styles.coachErrorText}>{coachHelpError}</Text> : null}

                {coachHelp ? (
                  <View style={styles.coachResultStack}>
                    <View style={styles.coachReplyCard}>
                      <Text style={styles.coachReplyBadge}>코치 답변</Text>
                      <Text style={styles.coachReplyText}>{coachHelp.coachReply}</Text>
                    </View>

                    <View style={styles.coachExpressionList}>
                      {coachHelp.expressions.map((expression: CoachExpression) => (
                        <View key={expression.id} style={styles.coachExpressionCard}>
                          <Text style={styles.coachExpressionText}>{expression.expression}</Text>
                          <Text style={styles.coachExpressionMeaning}>{expression.meaningKo}</Text>
                          <Text style={styles.coachExpressionTip}>{expression.usageTip}</Text>
                          <Text style={styles.coachExpressionExample}>{expression.example}</Text>
                          <Pressable
                            style={styles.coachExpressionInsertButton}
                            onPress={() => appendCoachExpression(expression.expression)}
                          >
                            <Text style={styles.coachExpressionInsertButtonText}>한 줄에 넣기</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </ModalSafeAreaView>
    </Modal>
  );
}

// 월 달력 창
export function NowCalendarModal({
  calendarCells,
  calendarMonthCursor,
  handleSelectCalendarDate,
  isCalendarOpen,
  setCalendarMonthCursor,
  setIsCalendarOpen
}: NowCalendarModalProps) {
  return (
    <Modal
      visible={isCalendarOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsCalendarOpen(false)}
    >
      <View style={styles.calendarModalOverlay}>
        <Pressable style={styles.calendarModalBackdrop} onPress={() => setIsCalendarOpen(false)} />
        <ModalSafeAreaView style={styles.calendarModalFrame}>
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarModalHeader}>
              <Pressable
                style={styles.monthButton}
                onPress={() =>
                  setCalendarMonthCursor((current) =>
                    getCalendarMonthStart(new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))
                  )
                }
              >
                <Text style={styles.monthButtonText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{formatCalendarMonthLabel(calendarMonthCursor)}</Text>
              <Pressable
                style={styles.monthButton}
                onPress={() =>
                  setCalendarMonthCursor((current) =>
                    getCalendarMonthStart(new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))
                  )
                }
              >
                <Text style={styles.monthButtonText}>{">"}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarWeekHeader}>
              {WEEK_LABELS.map((label) => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => (
                <View key={cell.key} style={styles.calendarCellWrap}>
                  <Pressable
                    style={[
                      styles.calendarCell,
                      cell.hasEntries && styles.calendarCellHasEntries,
                      cell.isToday && styles.calendarCellToday,
                      cell.isSelected && styles.calendarCellSelected,
                      !cell.isCurrentMonth && styles.calendarCellOutside
                    ]}
                    onPress={() => handleSelectCalendarDate(cell.key)}
                  >
                    <Text
                      style={[
                        styles.calendarCellText,
                        cell.hasEntries && styles.calendarCellTextHasEntries,
                        cell.isToday && styles.calendarCellTextToday,
                        cell.isSelected && styles.calendarCellTextSelected,
                        !cell.isCurrentMonth && styles.calendarCellTextOutside
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {cell.hasEntries ? <View style={styles.calendarDot} /> : null}
                  </Pressable>
                </View>
              ))}
            </View>

            <Text style={styles.calendarFooterMeta}>날짜를 누르면 그날 남긴 영어 조각을 바로 볼 수 있어요.</Text>
            <Pressable style={styles.calendarCloseButton} onPress={() => setIsCalendarOpen(false)}>
              <Text style={styles.calendarCloseButtonText}>닫기</Text>
            </Pressable>
          </View>
        </ModalSafeAreaView>
      </View>
    </Modal>
  );
}
