import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const NOW_IN_ENGLISH_TITLE = "지금 영어로";
export const NOW_IN_ENGLISH_NOTIFICATION_BODY =
  "지금 하고 있는 일이나 떠오른 생각을 영어로 짧게 남겨보세요.";

const ENTRIES_KEY = "writeloop:now-in-english:entries:v1";
const SETTINGS_KEY = "writeloop:now-in-english:settings:v1";
const NOTIFICATION_CHANNEL_ID = "now-in-english";
const MAX_STORED_ENTRIES = 120;
const MAX_ENTRY_LENGTH = 500;

const SEOUL_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export type NowInEnglishIntervalHours = 1 | 2;

export type NowInEnglishEntry = {
  id: string;
  text: string;
  createdAt: string;
  dateKey: string;
};

export type NowInEnglishReminderSettings = {
  enabled: boolean;
  intervalHours: NowInEnglishIntervalHours;
  notificationIds: string[];
  permissionStatus?: string;
  updatedAt: string;
};

export type NowInEnglishSummary = {
  entries: NowInEnglishEntry[];
  todayEntries: NowInEnglishEntry[];
  todayCount: number;
  settings: NowInEnglishReminderSettings;
};

const DEFAULT_SETTINGS: NowInEnglishReminderSettings = {
  enabled: false,
  intervalHours: 2,
  notificationIds: [],
  updatedAt: new Date(0).toISOString()
};

function toDateKey(value: Date) {
  const parts = SEOUL_DATE_KEY_FORMATTER.formatToParts(value);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function createEntryId() {
  return `now-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntryText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_ENTRY_LENGTH);
}

function isNowInEnglishEntry(value: unknown): value is NowInEnglishEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<NowInEnglishEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.text === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.dateKey === "string"
  );
}

function normalizeIntervalHours(value: unknown): NowInEnglishIntervalHours {
  return value === 1 ? 1 : 2;
}

function normalizeSettings(value: unknown): NowInEnglishReminderSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const settings = value as Partial<NowInEnglishReminderSettings>;
  return {
    enabled: settings.enabled === true,
    intervalHours: normalizeIntervalHours(settings.intervalHours),
    notificationIds: Array.isArray(settings.notificationIds)
      ? settings.notificationIds.filter((item): item is string => typeof item === "string")
      : [],
    permissionStatus: typeof settings.permissionStatus === "string" ? settings.permissionStatus : undefined,
    updatedAt: typeof settings.updatedAt === "string" ? settings.updatedAt : new Date().toISOString()
  };
}

function isPermissionGranted(permission: unknown) {
  if (!permission || typeof permission !== "object") {
    return false;
  }

  const value = permission as { granted?: unknown; status?: unknown };
  return value.granted === true || value.status === "granted";
}

function getPermissionStatus(permission: unknown) {
  if (!permission || typeof permission !== "object") {
    return "unknown";
  }

  const value = permission as { status?: unknown };
  if (typeof value.status === "string") {
    return value.status;
  }

  return isPermissionGranted(permission) ? "granted" : "unknown";
}

async function readEntries() {
  const raw = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isNowInEnglishEntry);
  } catch {
    return [];
  }
}

async function writeEntries(entries: NowInEnglishEntry[]) {
  const nextEntries = entries
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_STORED_ENTRIES);
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(nextEntries));
  return nextEntries;
}

export async function getNowInEnglishSettings() {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveNowInEnglishSettings(settings: NowInEnglishReminderSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export async function getNowInEnglishSummary(): Promise<NowInEnglishSummary> {
  const [entries, settings] = await Promise.all([readEntries(), getNowInEnglishSettings()]);
  const todayKey = toDateKey(new Date());
  const todayEntries = entries.filter((entry) => entry.dateKey === todayKey);

  return {
    entries,
    todayEntries,
    todayCount: todayEntries.length,
    settings
  };
}

export async function saveNowInEnglishEntry(text: string) {
  const normalizedText = normalizeEntryText(text);
  if (!normalizedText) {
    throw new Error("영어 한 줄을 입력해 주세요.");
  }

  const now = new Date();
  const entries = await readEntries();
  const entry: NowInEnglishEntry = {
    id: createEntryId(),
    text: normalizedText,
    createdAt: now.toISOString(),
    dateKey: toDateKey(now)
  };
  await writeEntries([entry, ...entries]);
  return entry;
}

async function cancelReminderNotifications(notificationIds: string[]) {
  await Promise.allSettled(
    notificationIds.map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId))
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "지금 영어로",
    description: "하루 중 짧은 영어 기록을 남기도록 알려줘요.",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: "#EA920D"
  });
}

async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (isPermissionGranted(current)) {
    return current;
  }

  return Notifications.requestPermissionsAsync();
}

export async function enableNowInEnglishReminders(intervalHours: NowInEnglishIntervalHours) {
  if (Platform.OS === "web") {
    throw new Error("모바일 앱에서 알림을 사용할 수 있어요.");
  }

  const currentSettings = await getNowInEnglishSettings();
  const permission = await requestNotificationPermission();
  if (!isPermissionGranted(permission)) {
    const nextSettings: NowInEnglishReminderSettings = {
      ...currentSettings,
      enabled: false,
      intervalHours,
      permissionStatus: getPermissionStatus(permission),
      updatedAt: new Date().toISOString()
    };
    await saveNowInEnglishSettings(nextSettings);
    throw new Error("알림 권한이 꺼져 있어요. 기기 설정에서 알림을 허용해 주세요.");
  }

  await ensureAndroidNotificationChannel();
  await cancelReminderNotifications(currentSettings.notificationIds);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: NOW_IN_ENGLISH_TITLE,
      body: NOW_IN_ENGLISH_NOTIFICATION_BODY,
      data: {
        route: "/now",
        feature: "now-in-english"
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalHours * 60 * 60,
      repeats: true,
      channelId: NOTIFICATION_CHANNEL_ID
    }
  });

  return saveNowInEnglishSettings({
    enabled: true,
    intervalHours,
    notificationIds: [notificationId],
    permissionStatus: getPermissionStatus(permission),
    updatedAt: new Date().toISOString()
  });
}

export async function disableNowInEnglishReminders() {
  const currentSettings = await getNowInEnglishSettings();
  await cancelReminderNotifications(currentSettings.notificationIds);

  return saveNowInEnglishSettings({
    ...currentSettings,
    enabled: false,
    notificationIds: [],
    updatedAt: new Date().toISOString()
  });
}

export function formatNowInEnglishTime(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
