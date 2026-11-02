import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Alert } from "react-native";
import {
  DEFAULT_QUIET_HOURS,
  clampReminderIntervalHours,
  getReminderLabel
} from "./now-helpers";
import {
  disableNowInEnglishReminders,
  enableNowInEnglishReminders,
  formatNowInEnglishQuietHours,
  getNextNowInEnglishReminderAt,
  type NowInEnglishIntervalHours,
  type NowInEnglishQuietHours,
  type NowInEnglishReminderSettings,
  type NowInEnglishScheduleMode,
  updateNowInEnglishScheduleMode,
  updateNowInEnglishQuietHours
} from "@/lib/now-in-english";

// Now in English 화면의 알림 설정: 켜짐·간격·예약 방식·방해금지 시간과 바꾸는 중 상태, 설정 반영, 다음 알림 문구,
// 켜기·끄기·예약 방식·방해금지 바꾸기와 조절 버튼. 효과가 없다(설정 창 열기 E4와 1분 시계 E6은 화면에 있다).
export function useNowReminderSettings({
  setStatusMessage
}: {
  setStatusMessage: Dispatch<SetStateAction<string>>;
}) {
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState<NowInEnglishIntervalHours>(2);
  const [scheduleMode, setScheduleMode] = useState<NowInEnglishScheduleMode>("HOURLY_ANCHOR");
  const [reminderUpdatedAt, setReminderUpdatedAt] = useState("");
  const [scheduledReminderAts, setScheduledReminderAts] = useState<string[]>([]);
  const [quietHours, setQuietHours] = useState<NowInEnglishQuietHours>(DEFAULT_QUIET_HOURS);
  const [reminderClockTick, setReminderClockTick] = useState(() => Date.now());
  const [isScheduling, setIsScheduling] = useState(false);

  const applyReminderSettings = useCallback((settings: NowInEnglishReminderSettings) => {
    setRemindersEnabled(settings.enabled);
    setIntervalHours(settings.intervalHours);
    setScheduleMode(settings.scheduleMode);
    setReminderUpdatedAt(settings.updatedAt);
    setScheduledReminderAts(settings.scheduledReminderAts);
    setQuietHours(settings.quietHours);
  }, []);

  const nextReminderAt = useMemo(
    () =>
      getNextNowInEnglishReminderAt(
        {
          enabled: remindersEnabled,
          intervalHours,
          scheduleMode,
          notificationIds: [],
          scheduledReminderAts,
          quietHours,
          updatedAt: reminderUpdatedAt
        },
        new Date(reminderClockTick)
      ),
    [intervalHours, quietHours, reminderClockTick, reminderUpdatedAt, remindersEnabled, scheduleMode, scheduledReminderAts]
  );
  const reminderLabel = useMemo(
    () => getReminderLabel(remindersEnabled, nextReminderAt),
    [nextReminderAt, remindersEnabled]
  );

  async function handleEnableReminder(nextIntervalHours: NowInEnglishIntervalHours) {
    try {
      setIsScheduling(true);
      const normalizedIntervalHours = clampReminderIntervalHours(nextIntervalHours);
      const settings = await enableNowInEnglishReminders(normalizedIntervalHours, quietHours, scheduleMode);
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage(`${normalizedIntervalHours}시간마다 지금 영어로 알림을 보내드릴게요.`);
    } catch (error) {
      Alert.alert("알림을 켜지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleDisableReminder() {
    try {
      setIsScheduling(true);
      const settings = await disableNowInEnglishReminders();
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage("지금 영어로 알림을 껐어요.");
    } catch (error) {
      Alert.alert("알림을 끄지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleUpdateScheduleMode(nextScheduleMode: NowInEnglishScheduleMode) {
    try {
      setIsScheduling(true);
      const settings = await updateNowInEnglishScheduleMode(nextScheduleMode);
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage(
        nextScheduleMode === "HOURLY_ANCHOR"
          ? "정각 기준으로 알림을 맞췄어요."
          : "지금부터 n시간마다 알림을 맞췄어요."
      );
    } catch (error) {
      Alert.alert("알림 기준을 바꾸지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleUpdateQuietHours(nextQuietHours: NowInEnglishQuietHours) {
    try {
      setIsScheduling(true);
      const settings = await updateNowInEnglishQuietHours(nextQuietHours);
      applyReminderSettings(settings);
      setReminderClockTick(Date.now());
      setStatusMessage(
        nextQuietHours.enabled
          ? `방해금지 시간을 ${formatNowInEnglishQuietHours(nextQuietHours)}로 설정했어요.`
          : "방해금지 시간을 껐어요."
      );
    } catch (error) {
      Alert.alert("방해금지 시간을 바꾸지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  function shiftQuietHour(kind: "start" | "end", direction: -1 | 1) {
    const key = kind === "start" ? "startHour" : "endHour";
    const nextQuietHours = {
      ...quietHours,
      [key]: (quietHours[key] + direction + 24) % 24
    };
    void handleUpdateQuietHours(nextQuietHours);
  }

  function shiftReminderInterval(direction: -1 | 1) {
    const nextIntervalHours = clampReminderIntervalHours(intervalHours + direction);
    if (!remindersEnabled) {
      setIntervalHours(nextIntervalHours);
      return;
    }

    void handleEnableReminder(nextIntervalHours);
  }

  return {
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
  };
}
