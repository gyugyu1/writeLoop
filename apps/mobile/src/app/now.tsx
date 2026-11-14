import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar from "@/components/mobile-nav-bar";
import { loopPointsNotice } from "@/lib/loop-points";
import {
  NowCalendarModal,
  NowCoachModal,
  NowComposerCard,
  NowHeaderRow,
  NowHistorySection,
  NowReminderSettingsModal,
  NowReminderSummaryButton,
  NowSaveArea
} from "@/components/now/now-sections";
import {
  type PendingPolishSource,
  mergeSavedNowInEnglishEntry
} from "@/components/now/now-helpers";
import { styles } from "@/components/now/now-styles";
import { useNowCoach } from "@/components/now/use-now-coach";
import { useNowHistoryView } from "@/components/now/use-now-history-view";
import { useNowInstantCoachFeedback } from "@/components/now/use-now-instant-coach-feedback";
import { useNowReminderSettings } from "@/components/now/use-now-reminder-settings";
import { useNowSavedExpressions } from "@/components/now/use-now-saved-expressions";
import { useNowYesterdayReflection } from "@/components/now/use-now-yesterday-reflection";
import {
  getNowInEnglishSummary,
  type NowInEnglishEntry,
  saveNowInEnglishEntry
} from "@/lib/now-in-english";
import { useSession } from "@/lib/session";

export default function NowInEnglishScreen() {
  const params = useLocalSearchParams<{ reminder?: string }>();
  const { currentUser } = useSession();
  const shouldOpenReminderSettings = params.reminder === "open";
  const scrollViewRef = useRef<ScrollView | null>(null);
  const writeSectionYRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<NowInEnglishEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingPolishSource, setPendingPolishSource] = useState<PendingPolishSource | null>(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const didOpenReminderSettingsFromParamRef = useRef(false);

  const {
    applyReminderSettings,
    handleDisableReminder,
    handleEnableReminder,
    handleUpdateQuietHours,
    handleUpdateScheduleMode,
    intervalHours,
    isScheduling,
    quietHours,
    reminderLabel,
    remindersEnabled,
    scheduleMode,
    setReminderClockTick,
    shiftQuietHour,
    shiftReminderInterval
  } = useNowReminderSettings({
    setStatusMessage
  });

  const {
    appendCoachExpression,
    coachHelp,
    coachHelpError,
    coachQuestion,
    coachQuickQuestions,
    handleAskCoachAboutInstantEntry,
    handleRequestCoachHelp,
    isCoachOpen,
    isLoadingCoachHelp,
    setCoachHelp,
    setCoachHelpError,
    setCoachQuestion,
    setIsCoachOpen
  } = useNowCoach({
    setStatusMessage,
    setText,
    text
  });

  const {
    handleKeepInstantEntry,
    handleRetryInstantCoachFeedback,
    instantCoachEntry,
    instantCoachFeedback,
    instantCoachFeedbackError,
    isLoadingInstantCoachFeedback,
    loadInstantCoachFeedback
  } = useNowInstantCoachFeedback({
    setPendingPolishSource,
    setStatusMessage
  });

  const {
    calendarCells,
    calendarMonthCursor,
    emptyTimelineCopy,
    entryGroups,
    handleOpenCalendar,
    handleSelectCalendarDate,
    handleSelectHistoryFilter,
    handleWriteTodayFromReflection,
    historyFilter,
    historyMeta,
    historyTitle,
    isCalendarOpen,
    reflectionDateKey,
    reflectionDateLabel,
    setCalendarMonthCursor,
    setIsCalendarOpen,
    yesterdayEntries,
    yesterdayEntrySignature
  } = useNowHistoryView({
    entries,
    inputRef
  });

  const {
    isLoadingYesterdayAiReflection,
    loadOrCreateYesterdayAiReflection,
    setYesterdayAiReflection,
    setYesterdayAiReflectionError,
    yesterdayAiReflection,
    yesterdayAiReflectionError
  } = useNowYesterdayReflection({
    reflectionDateKey,
    yesterdayEntries,
    yesterdayEntrySignature
  });

  const loadSummary = useCallback(async () => {
    const summary = await getNowInEnglishSummary();
    setEntries(summary.entries);
    applyReminderSettings(summary.settings);
  }, [applyReminderSettings]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const summary = await getNowInEnglishSummary();
        if (cancelled) {
          return;
        }
        setEntries(summary.entries);
        applyReminderSettings(summary.settings);
      } catch {
        if (!cancelled) {
          setStatusMessage("기록을 불러오지 못했어요. 잠시 후 다시 열어 확인해 주세요.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [applyReminderSettings]);

  const {
    handleToggleReflectionExpression,
    savedExpressionIdsByKey,
    savingExpressionKeys
  } = useNowSavedExpressions({
    currentUser
  });

  useEffect(() => {
    if (!shouldOpenReminderSettings || didOpenReminderSettingsFromParamRef.current || isLoading) {
      return;
    }

    didOpenReminderSettingsFromParamRef.current = true;
    setIsReminderSettingsOpen(true);
  }, [isLoading, shouldOpenReminderSettings]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (yesterdayEntries.length === 0) {
      setYesterdayAiReflection(null);
      setYesterdayAiReflectionError("");
      return;
    }

    void loadOrCreateYesterdayAiReflection(false);
  }, [
    isLoading,
    loadOrCreateYesterdayAiReflection,
    setYesterdayAiReflection,
    setYesterdayAiReflectionError,
    yesterdayEntries.length
  ]);

  useEffect(() => {
    if (!remindersEnabled) {
      return undefined;
    }

    const timerId = setInterval(() => {
      setReminderClockTick(Date.now());
    }, 60 * 1000);

    return () => clearInterval(timerId);
  }, [remindersEnabled, setReminderClockTick]);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert("한 줄을 적어볼까요?", "지금 하고 있는 일이나 떠오른 생각을 영어로 짧게 남겨보세요.");
      return;
    }

    try {
      setIsSaving(true);
      const polishSource = pendingPolishSource;
      let savedEntry: NowInEnglishEntry;
      try {
        savedEntry = await saveNowInEnglishEntry(trimmed, {
          entryId: polishSource?.entryId ?? undefined,
          createdAt: polishSource?.createdAt ?? undefined,
          dateKey: polishSource?.dateKey ?? undefined,
          polishedFromEntryId: polishSource?.entryId ?? null,
          polishedFromText: polishSource?.text ?? null
        });
      } catch (error) {
        Alert.alert("저장하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
        return;
      }

      setText("");
      setPendingPolishSource(null);
      setEntries((current) => mergeSavedNowInEnglishEntry(current, savedEntry));
      const savedMessage = polishSource ? "좋아요. 다듬은 문장의 전후를 기록했어요." : "좋아요. 오늘의 영어 조각이 하나 쌓였어요.";
      const loopNotice = loopPointsNotice(savedEntry.loopPoints);
      setStatusMessage(loopNotice ? `${savedMessage} ${loopNotice}` : savedMessage);
      void loadInstantCoachFeedback(savedEntry);
      try {
        await loadSummary();
      } catch {
        const refreshFailed = "저장은 됐어요. 기록 목록은 잠시 후 다시 갱신해 주세요.";
        setStatusMessage(loopNotice ? `${refreshFailed} ${loopNotice}` : refreshFailed);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleReviseInstantEntry() {
    if (!instantCoachEntry) {
      return;
    }

    setText(instantCoachEntry.text);
    setPendingPolishSource({
      entryId: instantCoachEntry.id,
      text: instantCoachEntry.text,
      createdAt: instantCoachEntry.createdAt,
      dateKey: instantCoachEntry.dateKey
    });
    setIsCoachOpen(false);
    setStatusMessage("AI 제안을 참고해서 직접 다듬어 보세요.");
    scrollViewRef.current?.scrollTo({
      y: Math.max(writeSectionYRef.current - 8, 0),
      animated: true
    });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleCancelPolish() {
    setText("");
    setPendingPolishSource(null);
    setStatusMessage("수정을 취소했어요. 새 영어 조각을 남겨볼까요?");
  }

  const isPolishingEntry = pendingPolishSource !== null;
  const isSaveDisabled = isSaving || isLoading;
  const saveButtonLabel = isSaving
    ? isPolishingEntry
      ? "수정 저장 중..."
      : "저장 중..."
    : isPolishingEntry
      ? "수정 저장하기"
      : "저장하기";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <NowHeaderRow />

          <View
            style={styles.writeSection}
            onLayout={(event) => {
              writeSectionYRef.current = event.nativeEvent.layout.y;
            }}
          >
            <NowComposerCard
              handleCancelPolish={handleCancelPolish}
              inputRef={inputRef}
              isCoachOpen={isCoachOpen}
              isLoading={isLoading}
              isPolishingEntry={isPolishingEntry}
              setIsCoachOpen={setIsCoachOpen}
              setText={setText}
              text={text}
            />

            <NowSaveArea
              handleAskCoachAboutInstantEntry={handleAskCoachAboutInstantEntry}
              handleKeepInstantEntry={handleKeepInstantEntry}
              handleRetryInstantCoachFeedback={handleRetryInstantCoachFeedback}
              handleReviseInstantEntry={handleReviseInstantEntry}
              handleSave={handleSave}
              instantCoachEntry={instantCoachEntry}
              instantCoachFeedback={instantCoachFeedback}
              instantCoachFeedbackError={instantCoachFeedbackError}
              isLoadingInstantCoachFeedback={isLoadingInstantCoachFeedback}
              isSaveDisabled={isSaveDisabled}
              saveButtonLabel={saveButtonLabel}
              statusMessage={statusMessage}
            />
          </View>

          <NowReminderSummaryButton
            isLoading={isLoading}
            isScheduling={isScheduling}
            reminderLabel={reminderLabel}
            remindersEnabled={remindersEnabled}
            setIsReminderSettingsOpen={setIsReminderSettingsOpen}
          />

          <NowHistorySection
            emptyTimelineCopy={emptyTimelineCopy}
            entryGroups={entryGroups}
            handleOpenCalendar={handleOpenCalendar}
            handleSelectHistoryFilter={handleSelectHistoryFilter}
            handleToggleReflectionExpression={handleToggleReflectionExpression}
            handleWriteTodayFromReflection={handleWriteTodayFromReflection}
            historyFilter={historyFilter}
            historyMeta={historyMeta}
            historyTitle={historyTitle}
            isLoadingYesterdayAiReflection={isLoadingYesterdayAiReflection}
            reflectionDateKey={reflectionDateKey}
            reflectionDateLabel={reflectionDateLabel}
            savedExpressionIdsByKey={savedExpressionIdsByKey}
            savingExpressionKeys={savingExpressionKeys}
            yesterdayAiReflection={yesterdayAiReflection}
            yesterdayAiReflectionError={yesterdayAiReflectionError}
            yesterdayEntries={yesterdayEntries}
          />
        </ScrollView>
        <MobileNavBar activeTab="home" />
      </KeyboardAvoidingView>

      <NowReminderSettingsModal
        handleDisableReminder={handleDisableReminder}
        handleEnableReminder={handleEnableReminder}
        handleUpdateQuietHours={handleUpdateQuietHours}
        handleUpdateScheduleMode={handleUpdateScheduleMode}
        intervalHours={intervalHours}
        isReminderSettingsOpen={isReminderSettingsOpen}
        isScheduling={isScheduling}
        quietHours={quietHours}
        reminderLabel={reminderLabel}
        remindersEnabled={remindersEnabled}
        scheduleMode={scheduleMode}
        setIsReminderSettingsOpen={setIsReminderSettingsOpen}
        shiftQuietHour={shiftQuietHour}
        shiftReminderInterval={shiftReminderInterval}
      />

      <NowCoachModal
        appendCoachExpression={appendCoachExpression}
        coachHelp={coachHelp}
        coachHelpError={coachHelpError}
        coachQuestion={coachQuestion}
        coachQuickQuestions={coachQuickQuestions}
        handleRequestCoachHelp={handleRequestCoachHelp}
        isCoachOpen={isCoachOpen}
        isLoadingCoachHelp={isLoadingCoachHelp}
        setCoachHelp={setCoachHelp}
        setCoachHelpError={setCoachHelpError}
        setCoachQuestion={setCoachQuestion}
        setIsCoachOpen={setIsCoachOpen}
      />

      <NowCalendarModal
        calendarCells={calendarCells}
        calendarMonthCursor={calendarMonthCursor}
        handleSelectCalendarDate={handleSelectCalendarDate}
        isCalendarOpen={isCalendarOpen}
        setCalendarMonthCursor={setCalendarMonthCursor}
        setIsCalendarOpen={setIsCalendarOpen}
      />
    </SafeAreaView>
  );
}

