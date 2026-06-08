import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  createNowInEnglishEntry,
  getCurrentUser,
  getNowInEnglishEntries,
  syncNowInEnglishEntries
} from "./api";

export const NOW_IN_ENGLISH_TITLE = "지금 영어로";
export const NOW_IN_ENGLISH_NOTIFICATION_BODY =
  "지금 뭐하고 있나요?, 무슨 생각하고 있나요?";

const ENTRIES_KEY = "writeloop:now-in-english:entries:v1";
const ENTRIES_OWNER_KEY = "writeloop:now-in-english:entries-owner:v1";
const PENDING_SYNC_ENTRY_IDS_KEY = "writeloop:now-in-english:pending-sync-entry-ids:v1";
const SETTINGS_KEY = "writeloop:now-in-english:settings:v1";
const AI_REFLECTIONS_KEY = "writeloop:now-in-english:ai-reflections:v1";
const NOTIFICATION_CHANNEL_ID = "now-in-english-exact-v2";
const NOTIFICATION_FEATURE_KEY = "now-in-english";
const REMINDER_TIME_ZONE = "Asia/Seoul";
const REMINDER_SCHEDULE_VERSION = 2;
const MAX_STORED_ENTRIES = 120;
const MAX_STORED_AI_REFLECTIONS = 30;
const MAX_ENTRY_LENGTH = 500;
const SCHEDULED_REMINDER_COUNT = 48;

const SEOUL_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: REMINDER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const SEOUL_UTC_OFFSET_HOURS = 9;
const SEOUL_UTC_OFFSET_MS = SEOUL_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export type NowInEnglishIntervalHours = number;
export type NowInEnglishScheduleMode = "HOURLY_ANCHOR" | "FROM_NOW";
export type NowInEnglishQuietHours = {
  enabled: boolean;
  startHour: number;
  endHour: number;
};

export type NowInEnglishEntry = {
  id: string;
  text: string;
  polishedFromEntryId?: string | null;
  polishedFromText?: string | null;
  createdAt: string;
  dateKey: string;
};

export type NowInEnglishAiReflectionExpression = {
  expression: string;
  meaningKo: string;
  usageTip: string;
  example: string;
};

export type NowInEnglishAiReflection = {
  dateKey: string;
  entryCount: number;
  entrySignature: string;
  headlineKo: string;
  summaryKo: string;
  highlightsKo: string[];
  patternKo: string;
  gentleCorrectionKo: string;
  nextActionKo: string;
  nextActionExampleEn: string;
  expressions: NowInEnglishAiReflectionExpression[];
  closingKo: string;
  createdAt: string;
};

export type NowInEnglishReminderSettings = {
  enabled: boolean;
  intervalHours: NowInEnglishIntervalHours;
  scheduleMode: NowInEnglishScheduleMode;
  scheduleVersion?: number;
  scheduleTimeZone?: string;
  notificationIds: string[];
  scheduledReminderAts: string[];
  quietHours: NowInEnglishQuietHours;
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
  scheduleMode: "HOURLY_ANCHOR",
  scheduleVersion: REMINDER_SCHEDULE_VERSION,
  scheduleTimeZone: REMINDER_TIME_ZONE,
  notificationIds: [],
  scheduledReminderAts: [],
  quietHours: {
    enabled: true,
    startHour: 23,
    endHour: 8
  },
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

function getSeoulWallDate(value: Date) {
  return new Date(value.getTime() + SEOUL_UTC_OFFSET_MS);
}

function getSeoulDateParts(value: Date) {
  const seoulWallDate = getSeoulWallDate(value);
  return {
    year: seoulWallDate.getUTCFullYear(),
    monthIndex: seoulWallDate.getUTCMonth(),
    day: seoulWallDate.getUTCDate(),
    hour: seoulWallDate.getUTCHours(),
    minute: seoulWallDate.getUTCMinutes(),
    second: seoulWallDate.getUTCSeconds(),
    millisecond: seoulWallDate.getUTCMilliseconds()
  };
}

function fromSeoulDateParts(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  millisecond = 0
) {
  return new Date(Date.UTC(year, monthIndex, day, hour - SEOUL_UTC_OFFSET_HOURS, minute, second, millisecond));
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

export function getNowInEnglishDateKey(value = new Date()) {
  return toDateKey(value);
}

export function getNowInEnglishRelativeDateKey(offsetDays: number) {
  return toDateKey(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

export function formatNowInEnglishDateLabel(dateKey: string) {
  const todayKey = getNowInEnglishDateKey();
  const yesterdayKey = getNowInEnglishRelativeDateKey(-1);
  if (dateKey === todayKey) {
    return "오늘";
  }
  if (dateKey === yesterdayKey) {
    return "어제";
  }

  const date = new Date(`${dateKey}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul"
  }).format(date);
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

function isNowInEnglishAiReflectionExpression(
  value: unknown
): value is NowInEnglishAiReflectionExpression {
  if (!value || typeof value !== "object") {
    return false;
  }

  const expression = value as Partial<NowInEnglishAiReflectionExpression>;
  return (
    typeof expression.expression === "string" &&
    typeof expression.meaningKo === "string" &&
    typeof expression.usageTip === "string" &&
    typeof expression.example === "string"
  );
}

function isNowInEnglishAiReflection(value: unknown): value is NowInEnglishAiReflection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const reflection = value as Partial<NowInEnglishAiReflection>;
  return (
    typeof reflection.dateKey === "string" &&
    typeof reflection.entryCount === "number" &&
    typeof reflection.entrySignature === "string" &&
    typeof reflection.headlineKo === "string" &&
    typeof reflection.summaryKo === "string" &&
    Array.isArray(reflection.highlightsKo) &&
    reflection.highlightsKo.every((item) => typeof item === "string") &&
    typeof reflection.patternKo === "string" &&
    typeof reflection.gentleCorrectionKo === "string" &&
    typeof reflection.nextActionKo === "string" &&
    typeof reflection.nextActionExampleEn === "string" &&
    Array.isArray(reflection.expressions) &&
    reflection.expressions.every(isNowInEnglishAiReflectionExpression) &&
    typeof reflection.closingKo === "string" &&
    typeof reflection.createdAt === "string"
  );
}

function normalizeIntervalHours(value: unknown): NowInEnglishIntervalHours {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.intervalHours;
  }

  return Math.min(12, Math.max(1, Math.trunc(value)));
}

function normalizeScheduleMode(value: unknown): NowInEnglishScheduleMode {
  return value === "FROM_NOW" ? "FROM_NOW" : "HOURLY_ANCHOR";
}

function normalizeQuietHour(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(23, Math.max(0, Math.trunc(value)));
}

function normalizeQuietHours(value: unknown): NowInEnglishQuietHours {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS.quietHours;
  }

  const quietHours = value as Partial<NowInEnglishQuietHours>;
  return {
    enabled: quietHours.enabled !== false,
    startHour: normalizeQuietHour(quietHours.startHour, DEFAULT_SETTINGS.quietHours.startHour),
    endHour: normalizeQuietHour(quietHours.endHour, DEFAULT_SETTINGS.quietHours.endHour)
  };
}

function normalizeSettings(value: unknown): NowInEnglishReminderSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const settings = value as Partial<NowInEnglishReminderSettings>;
  return {
    enabled: settings.enabled === true,
    intervalHours: normalizeIntervalHours(settings.intervalHours),
    scheduleMode: normalizeScheduleMode(settings.scheduleMode),
    scheduleVersion:
      typeof settings.scheduleVersion === "number" && Number.isFinite(settings.scheduleVersion)
        ? Math.trunc(settings.scheduleVersion)
        : 1,
    scheduleTimeZone: typeof settings.scheduleTimeZone === "string" ? settings.scheduleTimeZone : undefined,
    notificationIds: Array.isArray(settings.notificationIds)
      ? settings.notificationIds.filter((item): item is string => typeof item === "string")
      : [],
    scheduledReminderAts: Array.isArray(settings.scheduledReminderAts)
      ? settings.scheduledReminderAts.filter((item): item is string => typeof item === "string")
      : [],
    quietHours: normalizeQuietHours(settings.quietHours),
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

async function getCurrentEntryOwnerId() {
  try {
    const user = await getCurrentUser();
    return user ? String(user.id) : null;
  } catch {
    return null;
  }
}

async function readEntriesForOwner(ownerId: string | null) {
  const cachedOwnerId = await AsyncStorage.getItem(ENTRIES_OWNER_KEY);
  if (ownerId) {
    if (cachedOwnerId && cachedOwnerId !== ownerId) {
      return [];
    }
    return readEntries();
  }

  if (cachedOwnerId) {
    return [];
  }

  return readEntries();
}

async function writeEntriesForOwner(entries: NowInEnglishEntry[], ownerId: string | null) {
  const nextEntries = await writeEntries(entries);
  if (ownerId) {
    await AsyncStorage.setItem(ENTRIES_OWNER_KEY, ownerId);
  } else {
    await AsyncStorage.removeItem(ENTRIES_OWNER_KEY);
  }
  return nextEntries;
}

async function readPendingSyncEntryIds() {
  const raw = await AsyncStorage.getItem(PENDING_SYNC_ENTRY_IDS_KEY);
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

async function writePendingSyncEntryIds(entryIds: Set<string>) {
  await AsyncStorage.setItem(PENDING_SYNC_ENTRY_IDS_KEY, JSON.stringify(Array.from(entryIds)));
}

async function addPendingSyncEntryId(entryId: string) {
  const pendingEntryIds = await readPendingSyncEntryIds();
  pendingEntryIds.add(entryId);
  await writePendingSyncEntryIds(pendingEntryIds);
}

async function clearPendingSyncEntryIds() {
  await AsyncStorage.removeItem(PENDING_SYNC_ENTRY_IDS_KEY);
}

function mergeEntries(...entryLists: NowInEnglishEntry[][]) {
  const entriesById = new Map<string, NowInEnglishEntry>();

  entryLists.flat().forEach((entry) => {
    if (isNowInEnglishEntry(entry) && !entriesById.has(entry.id)) {
      entriesById.set(entry.id, entry);
    }
  });

  return Array.from(entriesById.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_STORED_ENTRIES);
}

async function readEntriesWithServerSync() {
  const ownerId = await getCurrentEntryOwnerId();
  const cachedOwnerId = await AsyncStorage.getItem(ENTRIES_OWNER_KEY);
  const localEntries = await readEntriesForOwner(ownerId);
  if (!ownerId) {
    return localEntries;
  }

  try {
    const serverEntries = await getNowInEnglishEntries();
    const pendingEntryIds = await readPendingSyncEntryIds();
    const entriesToSync = cachedOwnerId
      ? localEntries.filter((entry) => pendingEntryIds.has(entry.id))
      : localEntries;
    const syncedEntries = entriesToSync.length > 0 ? await syncNowInEnglishEntries(entriesToSync) : [];
    if (entriesToSync.length > 0) {
      await clearPendingSyncEntryIds();
    }
    const mergedEntries = mergeEntries(syncedEntries, serverEntries, localEntries);
    return writeEntriesForOwner(mergedEntries, ownerId);
  } catch {
    return localEntries;
  }
}

async function readAiReflections() {
  const raw = await AsyncStorage.getItem(AI_REFLECTIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isNowInEnglishAiReflection);
  } catch {
    return [];
  }
}

async function writeAiReflections(reflections: NowInEnglishAiReflection[]) {
  const nextReflections = reflections
    .slice()
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
    .slice(0, MAX_STORED_AI_REFLECTIONS);
  await AsyncStorage.setItem(AI_REFLECTIONS_KEY, JSON.stringify(nextReflections));
  return nextReflections;
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
  const [entries, settings] = await Promise.all([readEntriesWithServerSync(), getNowInEnglishSettings()]);
  const currentSettings = await migrateReminderScheduleIfNeeded(settings);
  if (currentSettings.enabled) {
    await cancelOrphanedReminderNotifications(currentSettings.notificationIds);
  }
  const todayKey = toDateKey(new Date());
  const todayEntries = entries.filter((entry) => entry.dateKey === todayKey);

  return {
    entries,
    todayEntries,
    todayCount: todayEntries.length,
    settings: currentSettings
  };
}

export async function saveNowInEnglishEntry(
  text: string,
  options: {
    entryId?: string;
    createdAt?: string;
    dateKey?: string;
    polishedFromEntryId?: string | null;
    polishedFromText?: string | null;
  } = {}
) {
  const normalizedText = normalizeEntryText(text);
  if (!normalizedText) {
    throw new Error("영어 한 줄을 입력해 주세요.");
  }

  const polishedFromText = options.polishedFromText ? normalizeEntryText(options.polishedFromText) : "";
  const now = new Date();
  const ownerId = await getCurrentEntryOwnerId();
  const entries = await readEntriesForOwner(ownerId);
  const createdAt = options.createdAt || now.toISOString();
  const entry: NowInEnglishEntry = {
    id: options.entryId || createEntryId(),
    text: normalizedText,
    polishedFromEntryId: options.polishedFromEntryId || null,
    polishedFromText: polishedFromText || null,
    createdAt,
    dateKey: options.dateKey || toDateKey(new Date(createdAt))
  };

  if (ownerId) {
    try {
      const savedEntry = await createNowInEnglishEntry(entry);
      if (savedEntry) {
        const serverEntries = await getNowInEnglishEntries();
        await writeEntriesForOwner(mergeEntries([savedEntry], serverEntries, entries), ownerId);
        return savedEntry;
      }
      await addPendingSyncEntryId(entry.id);
    } catch {
      // Keep a local copy and sync it when the API is reachable again.
      await addPendingSyncEntryId(entry.id);
    }
  }

  await writeEntriesForOwner(mergeEntries([entry], entries), ownerId);
  return entry;
}

export function buildNowInEnglishEntrySignature(entries: NowInEnglishEntry[]) {
  return entries.map((entry) => `${entry.id}:${entry.createdAt}:${entry.text}`).join("|");
}

export async function getNowInEnglishAiReflection(dateKey: string) {
  const reflections = await readAiReflections();
  return reflections.find((reflection) => reflection.dateKey === dateKey) ?? null;
}

export async function saveNowInEnglishAiReflection(reflection: NowInEnglishAiReflection) {
  const reflections = await readAiReflections();
  const nextReflections = [
    reflection,
    ...reflections.filter((savedReflection) => savedReflection.dateKey !== reflection.dateKey)
  ];
  await writeAiReflections(nextReflections);
  return reflection;
}

function isNowInEnglishNotification(notification: { content?: { data?: unknown } }) {
  const data = notification.content?.data as Record<string, unknown> | undefined;
  return data?.feature === NOTIFICATION_FEATURE_KEY || data?.route === "/now";
}

async function findScheduledNowInEnglishNotificationIds() {
  if (Platform.OS === "web") {
    return [];
  }

  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    return scheduledNotifications
      .filter(isNowInEnglishNotification)
      .map((notification) => notification.identifier);
  } catch {
    return [];
  }
}

async function cancelReminderNotifications(notificationIds: string[]) {
  const idsToCancel = new Set([
    ...notificationIds.filter(Boolean),
    ...(await findScheduledNowInEnglishNotificationIds())
  ]);

  await Promise.allSettled(
    Array.from(idsToCancel).map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId))
  );
}

async function cancelOrphanedReminderNotifications(knownNotificationIds: string[]) {
  if (Platform.OS === "web") {
    return;
  }

  const knownIds = new Set(knownNotificationIds.filter(Boolean));
  const scheduledNowInEnglishIds = await findScheduledNowInEnglishNotificationIds();
  const orphanedIds = scheduledNowInEnglishIds.filter((notificationId) => !knownIds.has(notificationId));
  await Promise.allSettled(
    orphanedIds.map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId))
  );
}

function isDateInQuietHours(date: Date, quietHours: NowInEnglishQuietHours) {
  if (!quietHours.enabled || quietHours.startHour === quietHours.endHour) {
    return false;
  }

  const hour = getSeoulDateParts(date).hour;
  if (quietHours.startHour < quietHours.endHour) {
    return hour >= quietHours.startHour && hour < quietHours.endHour;
  }

  return hour >= quietHours.startHour || hour < quietHours.endHour;
}

function getQuietHoursEndDate(date: Date, quietHours: NowInEnglishQuietHours) {
  const parts = getSeoulDateParts(date);
  const endDay =
    quietHours.startHour > quietHours.endHour && parts.hour >= quietHours.startHour
      ? parts.day + 1
      : parts.day;

  return fromSeoulDateParts(parts.year, parts.monthIndex, endDay, quietHours.endHour);
}

function getNextHourlyAnchorDate(after: Date, intervalHours: NowInEnglishIntervalHours) {
  const parts = getSeoulDateParts(after);
  let candidate = addHours(fromSeoulDateParts(parts.year, parts.monthIndex, parts.day, parts.hour), 1);

  for (let index = 0; index < 48; index += 1) {
    if (getSeoulDateParts(candidate).hour % intervalHours === 0) {
      return candidate;
    }
    candidate = addHours(candidate, 1);
  }

  return candidate;
}

function getNextHourlyAnchorDateAtOrAfter(date: Date, intervalHours: NowInEnglishIntervalHours) {
  const parts = getSeoulDateParts(date);
  const isExactlyHour = parts.minute === 0 && parts.second === 0 && parts.millisecond === 0;
  let candidate = fromSeoulDateParts(parts.year, parts.monthIndex, parts.day, parts.hour);
  if (!isExactlyHour) {
    candidate = addHours(candidate, 1);
  }

  for (let index = 0; index < 48; index += 1) {
    if (getSeoulDateParts(candidate).hour % intervalHours === 0) {
      return candidate;
    }
    candidate = addHours(candidate, 1);
  }

  return candidate;
}

function getNextAllowedReminderDate(
  after: Date,
  intervalHours: NowInEnglishIntervalHours,
  quietHours: NowInEnglishQuietHours,
  scheduleMode: NowInEnglishScheduleMode
) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  let candidate =
    scheduleMode === "HOURLY_ANCHOR" ? getNextHourlyAnchorDate(after, intervalHours) : new Date(after.getTime() + intervalMs);

  for (let index = 0; index < 48; index += 1) {
    if (!isDateInQuietHours(candidate, quietHours)) {
      return candidate;
    }

    const quietHoursEnd = getQuietHoursEndDate(candidate, quietHours);
    candidate =
      scheduleMode === "HOURLY_ANCHOR"
        ? getNextHourlyAnchorDateAtOrAfter(quietHoursEnd, intervalHours)
        : quietHoursEnd;
    if (candidate.getTime() <= after.getTime()) {
      candidate =
        scheduleMode === "HOURLY_ANCHOR"
          ? getNextHourlyAnchorDate(after, intervalHours)
          : new Date(after.getTime() + intervalMs);
    }
  }

  return candidate;
}

function buildReminderScheduleDates(
  intervalHours: NowInEnglishIntervalHours,
  quietHours: NowInEnglishQuietHours,
  scheduleMode: NowInEnglishScheduleMode,
  scheduledFrom = new Date()
) {
  const dates: Date[] = [];
  let cursor = scheduledFrom;

  for (let index = 0; index < SCHEDULED_REMINDER_COUNT; index += 1) {
    const nextDate = getNextAllowedReminderDate(cursor, intervalHours, quietHours, scheduleMode);
    dates.push(nextDate);
    cursor = nextDate;
  }

  return dates;
}

function formatNowInEnglishNotificationTime(date: Date) {
  const parts = getSeoulDateParts(date);
  return `${parts.hour.toString().padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}`;
}

function buildNowInEnglishNotificationTitle(date: Date) {
  return `${formatNowInEnglishNotificationTime(date)} 영어 기록을 남길 시간이에요`;
}

async function scheduleReminderNotifications(
  intervalHours: NowInEnglishIntervalHours,
  quietHours: NowInEnglishQuietHours,
  scheduleMode: NowInEnglishScheduleMode
) {
  const scheduleDates = buildReminderScheduleDates(intervalHours, quietHours, scheduleMode);
  const notificationIds = await Promise.all(
    scheduleDates.map((date) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: buildNowInEnglishNotificationTitle(date),
          body: NOW_IN_ENGLISH_NOTIFICATION_BODY,
          data: {
            route: "/now",
            feature: NOTIFICATION_FEATURE_KEY
          }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: NOTIFICATION_CHANNEL_ID
        }
      })
    )
  );

  return {
    notificationIds,
    scheduledReminderAts: scheduleDates.map((date) => date.toISOString())
  };
}

async function migrateReminderScheduleIfNeeded(settings: NowInEnglishReminderSettings) {
  const needsMigration =
    settings.scheduleTimeZone !== REMINDER_TIME_ZONE || settings.scheduleVersion !== REMINDER_SCHEDULE_VERSION;

  if (!needsMigration) {
    return settings;
  }

  if (!settings.enabled) {
    return saveNowInEnglishSettings({
      ...settings,
      scheduleVersion: REMINDER_SCHEDULE_VERSION,
      scheduleTimeZone: REMINDER_TIME_ZONE
    });
  }

  try {
    await ensureAndroidNotificationChannel();
    await cancelReminderNotifications(settings.notificationIds);
    const schedule = await scheduleReminderNotifications(settings.intervalHours, settings.quietHours, settings.scheduleMode);

    return saveNowInEnglishSettings({
      ...settings,
      scheduleVersion: REMINDER_SCHEDULE_VERSION,
      scheduleTimeZone: REMINDER_TIME_ZONE,
      notificationIds: schedule.notificationIds,
      scheduledReminderAts: schedule.scheduledReminderAts,
      updatedAt: new Date().toISOString()
    });
  } catch {
    return {
      ...settings,
      scheduleVersion: REMINDER_SCHEDULE_VERSION,
      scheduleTimeZone: REMINDER_TIME_ZONE,
      scheduledReminderAts: []
    };
  }
}

export function getNextNowInEnglishReminderAt(settings: NowInEnglishReminderSettings, now = new Date()) {
  if (!settings.enabled) {
    return null;
  }

  const nowMs = now.getTime();
  const nextScheduledAt =
    settings.scheduleTimeZone === REMINDER_TIME_ZONE
      ? settings.scheduledReminderAts
          .map((value) => new Date(value))
          .filter((date) => Number.isFinite(date.getTime()) && date.getTime() > nowMs)
          .sort((left, right) => left.getTime() - right.getTime())[0]
      : undefined;

  if (nextScheduledAt) {
    return nextScheduledAt;
  }

  const updatedAt = new Date(settings.updatedAt);
  const baseDate = Number.isFinite(updatedAt.getTime()) ? updatedAt : now;
  return getNextAllowedReminderDate(
    baseDate > now ? baseDate : now,
    settings.intervalHours,
    settings.quietHours,
    settings.scheduleMode
  );
}

export function formatNowInEnglishQuietHours(quietHours: NowInEnglishQuietHours) {
  const formatHour = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;
  return `${formatHour(quietHours.startHour)}-${formatHour(quietHours.endHour)}`;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "지금 영어로",
    description: "하루 중 짧은 영어 기록을 남기도록 알려줘요.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

export async function enableNowInEnglishReminders(
  intervalHours: NowInEnglishIntervalHours,
  quietHoursOverride?: NowInEnglishQuietHours,
  scheduleModeOverride?: NowInEnglishScheduleMode
) {
  if (Platform.OS === "web") {
    throw new Error("모바일 앱에서 알림을 사용할 수 있어요.");
  }

  const currentSettings = await getNowInEnglishSettings();
  const quietHours = normalizeQuietHours(quietHoursOverride ?? currentSettings.quietHours);
  const scheduleMode = normalizeScheduleMode(scheduleModeOverride ?? currentSettings.scheduleMode);
  const permission = await requestNotificationPermission();
  if (!isPermissionGranted(permission)) {
    const nextSettings: NowInEnglishReminderSettings = {
      ...currentSettings,
      enabled: false,
      intervalHours,
      scheduleMode,
      scheduleVersion: REMINDER_SCHEDULE_VERSION,
      scheduleTimeZone: REMINDER_TIME_ZONE,
      notificationIds: [],
      scheduledReminderAts: [],
      quietHours,
      permissionStatus: getPermissionStatus(permission),
      updatedAt: new Date().toISOString()
    };
    await saveNowInEnglishSettings(nextSettings);
    throw new Error("알림 권한이 꺼져 있어요. 기기 설정에서 알림을 허용해 주세요.");
  }

  await ensureAndroidNotificationChannel();
  await cancelReminderNotifications(currentSettings.notificationIds);
  const schedule = await scheduleReminderNotifications(intervalHours, quietHours, scheduleMode);

  return saveNowInEnglishSettings({
    enabled: true,
    intervalHours,
    scheduleMode,
    scheduleVersion: REMINDER_SCHEDULE_VERSION,
    scheduleTimeZone: REMINDER_TIME_ZONE,
    notificationIds: schedule.notificationIds,
    scheduledReminderAts: schedule.scheduledReminderAts,
    quietHours,
    permissionStatus: getPermissionStatus(permission),
    updatedAt: new Date().toISOString()
  });
}

export async function updateNowInEnglishQuietHours(quietHours: NowInEnglishQuietHours) {
  if (Platform.OS === "web") {
    throw new Error("모바일 앱에서만 알림을 사용할 수 있어요.");
  }

  const currentSettings = await getNowInEnglishSettings();
  const nextQuietHours = normalizeQuietHours(quietHours);
  const updatedAt = new Date().toISOString();

  if (!currentSettings.enabled) {
    return saveNowInEnglishSettings({
      ...currentSettings,
      quietHours: nextQuietHours,
      scheduleVersion: REMINDER_SCHEDULE_VERSION,
      scheduleTimeZone: REMINDER_TIME_ZONE,
      updatedAt
    });
  }

  await ensureAndroidNotificationChannel();
  await cancelReminderNotifications(currentSettings.notificationIds);
  const schedule = await scheduleReminderNotifications(
    currentSettings.intervalHours,
    nextQuietHours,
    currentSettings.scheduleMode
  );

  return saveNowInEnglishSettings({
    ...currentSettings,
    scheduleVersion: REMINDER_SCHEDULE_VERSION,
    scheduleTimeZone: REMINDER_TIME_ZONE,
    notificationIds: schedule.notificationIds,
    scheduledReminderAts: schedule.scheduledReminderAts,
    quietHours: nextQuietHours,
    updatedAt
  });
}

export async function updateNowInEnglishScheduleMode(scheduleMode: NowInEnglishScheduleMode) {
  if (Platform.OS === "web") {
    throw new Error("모바일 앱에서만 알림을 사용할 수 있어요.");
  }

  const currentSettings = await getNowInEnglishSettings();
  const nextScheduleMode = normalizeScheduleMode(scheduleMode);
  const updatedAt = new Date().toISOString();

  if (!currentSettings.enabled) {
    return saveNowInEnglishSettings({
      ...currentSettings,
      scheduleMode: nextScheduleMode,
      scheduleVersion: REMINDER_SCHEDULE_VERSION,
      scheduleTimeZone: REMINDER_TIME_ZONE,
      updatedAt
    });
  }

  await ensureAndroidNotificationChannel();
  await cancelReminderNotifications(currentSettings.notificationIds);
  const schedule = await scheduleReminderNotifications(
    currentSettings.intervalHours,
    currentSettings.quietHours,
    nextScheduleMode
  );

  return saveNowInEnglishSettings({
    ...currentSettings,
    scheduleMode: nextScheduleMode,
    scheduleVersion: REMINDER_SCHEDULE_VERSION,
    scheduleTimeZone: REMINDER_TIME_ZONE,
    notificationIds: schedule.notificationIds,
    scheduledReminderAts: schedule.scheduledReminderAts,
    updatedAt
  });
}

export async function disableNowInEnglishReminders() {
  const currentSettings = await getNowInEnglishSettings();
  await cancelReminderNotifications(currentSettings.notificationIds);

  return saveNowInEnglishSettings({
    ...currentSettings,
    enabled: false,
    scheduleVersion: REMINDER_SCHEDULE_VERSION,
    scheduleTimeZone: REMINDER_TIME_ZONE,
    notificationIds: [],
    scheduledReminderAts: [],
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
