// [spec] qa 테스트(작업 048-04 Now in English 화면 조각, 리팩터링의 "지금 동작" 기록).
// Now in English 화면(src/app/now.tsx) 전체를 렌더하고 사용자처럼 눌러, 지금 보이는 문구·구조·접근성 속성과 부르는 API·기기
// 저장 동작을 좋고 나쁨과 관계없이 그대로 적는다. 상수·순수 함수·화면 안 컴포넌트·스타일·화면 조각을 옮긴 뒤에도, 상태·효과를
// 훅으로 옮기는 다음 단계(부모 계획 4)에서도 이 테스트가 그대로 통과해야 한다.
// 가짜로 두는 것: API(@/lib/api. 코치 도움·바로 코치 피드백·돌아보기 만들기 같은 AI 호출 포함), 로그인 상태(@/lib/session),
// Now in English 기기 저장·알림 예약(@/lib/now-in-english의 불러오기·저장·알림 켜기/끄기/기준/방해금지·회고 읽기/저장.
// 날짜 키·날짜/시각 문구·다음 알림 계산·기록 서명 함수는 실제 것), 기기 저장소(AsyncStorage 가짜, expo-secure-store),
// 알림(expo-notifications 비움), 라우터(expo-router), Alert(spyOn), 네이티브 모듈(expo-symbols, 안전 영역).
// 아래 내비게이션·모달 안전 영역·문제 보내기 링크 컴포넌트는 실제 것을 쓴다.
// 가짜 저장(saveNowInEnglishEntry 등)은 받은 값을 가짜 저장소(storedEntries, storedSettings)에 넣고, 불러오기는 그 저장소를
// 돌려준다. 화면이 저장 뒤 다시 불러올 때 기기 저장과 같은 결과가 나오게 하려는 것이다.
// 날짜 계산이 오늘에 기대므로 모든 테스트를 가짜 시계로 돌린다(2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00에서 멈춤).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, StyleSheet, TextInput } from "react-native";
import type { TestInstance } from "test-renderer";
import NowInEnglishScreen from "@/app/now";
import {
  deleteSavedExpression,
  getSavedExpressions,
  requestCoachHelp,
  requestNowInEnglishCoachFeedback,
  requestNowInEnglishReflection,
  saveExpression
} from "@/lib/api";
import {
  disableNowInEnglishReminders,
  enableNowInEnglishReminders,
  getNowInEnglishAiReflection,
  getNowInEnglishSummary,
  saveNowInEnglishAiReflection,
  saveNowInEnglishEntry,
  updateNowInEnglishQuietHours,
  updateNowInEnglishScheduleMode,
  type NowInEnglishAiReflection,
  type NowInEnglishEntry,
  type NowInEnglishReminderSettings,
  type NowInEnglishSummary
} from "@/lib/now-in-english";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  CoachHelpResponse,
  NowInEnglishCoachFeedbackResponse,
  NowInEnglishReflectionResponse,
  SavedExpression
} from "@/lib/types";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    canDismiss: jest.fn(() => false),
    dismissAll: jest.fn()
  },
  useLocalSearchParams: jest.fn()
}));
// 아이콘(SymbolView)은 네이티브 모듈이라, 받은 속성을 그대로 가진 호스트 요소로 대신한다.
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SymbolView: (props: object) => React.createElement("ExpoSymbolView", props)
  };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
// 알림(expo-notifications)은 네이티브 모듈이라 비워 둔다. 알림을 예약하는 함수는 아래에서 가짜로 둔다.
jest.mock("expo-notifications", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => ({
  deleteSavedExpression: jest.fn(),
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestNowInEnglishCoachFeedback: jest.fn(),
  requestNowInEnglishReflection: jest.fn(),
  saveExpression: jest.fn()
}));
// 날짜 키·문구, 다음 알림 계산, 기록 서명, 방해금지 문구 함수는 실제 것을 쓰고, 기기 저장·알림 예약만 가짜로 둔다.
jest.mock("@/lib/now-in-english", () => ({
  ...jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english"),
  disableNowInEnglishReminders: jest.fn(),
  enableNowInEnglishReminders: jest.fn(),
  getNowInEnglishAiReflection: jest.fn(),
  getNowInEnglishSummary: jest.fn(),
  saveNowInEnglishAiReflection: jest.fn(),
  saveNowInEnglishEntry: jest.fn(),
  updateNowInEnglishQuietHours: jest.fn(),
  updateNowInEnglishScheduleMode: jest.fn()
}));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY = "2026-11-12";
const YESTERDAY = "2026-11-11";
const MAIN_PLACEHOLDER = "I’m doing something small right now.";
const COACH_PLACEHOLDER = '예: "퇴근길에 피곤해"를 영어로 어떻게 말해?';
const PROBLEM_LINK_TEXT = "문제가 반복되나요? 문제 보내기";
const HERO_TITLE = "지금 뭐하고 있나요?, 무슨 생각하고 있나요?";
const COACH_BUBBLE = "막히면 AI 코치에게 물어봐요.";
const QUICK_QUESTIONS = [
  "지금 하고 있는 일을 영어 한 줄로 어떻게 말해?",
  "내 문장이 자연스러운지 봐줘.",
  "이 뒤에 한 문장 더 붙이고 싶어.",
  "짧고 자연스러운 표현 3개 알려줘."
];
const LABEL_1105 = "2026년 11월 5일 목요일";
const LABEL_1020 = "2026년 10월 20일 화요일";
const LABEL_1201 = "2026년 12월 1일 화요일";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function nowEntry(
  id: string,
  dateKey: string,
  createdAt: string,
  text: string,
  polishedFromText: string | null = null
): NowInEnglishEntry {
  return { id, dateKey, createdAt, text, polishedFromEntryId: polishedFromText ? id : null, polishedFromText };
}

// 기록: 오늘 둘(t1, t2), 어제 하나(y1), 11-05 둘(o1, 다듬은 p1), 10-20 하나(c1). 배열 순서는 일부러 섞었다.
const t1 = nowEntry("now-t1", TODAY, "2026-11-12T01:00:00.000Z", "I am having lunch.");
const t2 = nowEntry("now-t2", TODAY, "2026-11-12T02:30:00.000Z", "I am reading a book.");
const y1 = nowEntry("now-y1", YESTERDAY, "2026-11-11T10:00:00.000Z", "I am tired.");
const o1 = nowEntry("now-o1", "2026-11-05", "2026-11-05T03:00:00.000Z", "I am cooking.");
const p1 = nowEntry("now-p1", "2026-11-05", "2026-11-05T04:00:00.000Z", "I cooked pasta.", "I cook pasta.");
const c1 = nowEntry("now-c1", "2026-10-20", "2026-10-20T03:00:00.000Z", "I went hiking.");
const baseEntries = [t1, y1, t2, o1, p1, c1];
const TODAY_SIGNATURE =
  "now-t1:2026-11-12T01:00:00.000Z:I am having lunch.|now-t2:2026-11-12T02:30:00.000Z:I am reading a book.";

function reminderSettings(overrides: Partial<NowInEnglishReminderSettings> = {}): NowInEnglishReminderSettings {
  return {
    enabled: false,
    intervalHours: 2,
    scheduleMode: "HOURLY_ANCHOR",
    notificationIds: [],
    scheduledReminderAts: [],
    quietHours: { enabled: true, startHour: 23, endHour: 8 },
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides
  };
}

function summaryOf(entries: NowInEnglishEntry[], settings: NowInEnglishReminderSettings): NowInEnglishSummary {
  return { entries: entries.slice(), todayEntries: [], todayCount: 0, settings };
}

function reflectionResponse(
  dateKey: string,
  entryCount: number,
  overrides: Partial<NowInEnglishReflectionResponse> = {}
): NowInEnglishReflectionResponse {
  return {
    dateKey,
    entryCount,
    headlineKo: "점심과 책으로 채운 하루",
    summaryKo: "짧은 문장으로 하루의 장면을 잘 남겼어요.",
    highlightsKo: ["현재진행형을 잘 썼어요.", "핵심만 짧게 남겼어요."],
    patternKo: "먹고 읽는 일상 장면이 이어졌어요.",
    gentleCorrectionKo: "a book 대신 my book도 자연스러워요.",
    nextActionKo: "왜 그 일을 했는지 한 문장 더 붙여 보세요.",
    nextActionExampleEn: "I am reading a book because I want to relax.",
    expressions: [
      { expression: "grab a bite", meaningKo: "간단히 먹다", usageTip: "점심 이야기에", example: "I grabbed a bite at noon." },
      { expression: "curl up with a book", meaningKo: "", usageTip: "", example: "" }
    ],
    closingKo: "내일도 한 줄 남겨 봐요.",
    ...overrides
  };
}

function cachedReflection(dateKey: string, entrySignature: string, headlineKo = "저장해 둔 회고"): NowInEnglishAiReflection {
  return {
    ...reflectionResponse(dateKey, 2, { headlineKo }),
    entrySignature,
    createdAt: "2026-11-12T02:40:00.000Z"
  };
}

function coachFeedback(overrides: Partial<NowInEnglishCoachFeedbackResponse> = {}): NowInEnglishCoachFeedbackResponse {
  return {
    originalText: "I am walking.",
    headlineKo: "산책 장면이 잘 보여요",
    praiseKo: "현재진행형으로 지금을 잘 담았어요.",
    suggestionEn: "I'm taking a walk.",
    suggestionTranslationKo: "산책하고 있어요.",
    suggestionKo: "take a walk가 더 자연스러워요.",
    nextQuestionKo: "어디를 걷고 있나요?",
    expression: "take a walk",
    expressionMeaningKo: "산책하다",
    expressionExampleEn: "I take a walk after lunch.",
    ...overrides
  };
}

const coachHelp: CoachHelpResponse = {
  promptId: "diary-free-writing",
  userQuestion: "피곤하다를 어떻게 말해?",
  coachReply: "지친 느낌은 이렇게 말해 보세요.",
  expressions: [
    { id: "ex-1", expression: "feel drained", meaningKo: "기운이 빠지다", usageTip: "많이 지쳤을 때", example: "I feel drained after work." },
    { id: "ex-2", expression: "call it a day", meaningKo: "오늘은 그만하다", usageTip: "일을 마칠 때", example: "Let's call it a day." }
  ]
};

function savedExpression(id: number, expression: string): SavedExpression {
  return {
    id,
    expression,
    sourceType: "COACH_RECOMMENDATION",
    saveCount: 1,
    lastSavedAt: "2026-11-01T03:00:00.000Z",
    createdAt: "2026-11-01T03:00:00.000Z"
  };
}

// 실행 환경의 ko-KR 형식과 시간대에 따라 달라지는 문구는 화면과 같은 방식으로 기대값을 만든다.
function seoulTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}
function deviceTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function monthLabel(year: number, monthIndex: number) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(year, monthIndex, 1, 12));
}

// 스냅샷에서는 위 시각 문구를 자리 표시로 바꿔, 실행 환경과 관계없이 같은 결과가 나오게 한다.
const VOLATILE_TEXT: [string, string][] = [
  ...[...baseEntries.map((entry) => entry.createdAt), NOW.toISOString()].map((iso): [string, string] => [
    deviceTime(iso),
    "<시각>"
  ]),
  ...["2026-11-12T05:00:00.000Z", "2026-11-12T05:01:00.000Z", "2026-11-12T15:00:00.000Z"].map((iso): [string, string] => [seoulTime(iso), "<시각>"])
].sort((left, right) => right[0].length - left[0].length);

function normalizeText(value: string) {
  return VOLATILE_TEXT.reduce((text, [from, to]) => text.split(from).join(to), value);
}

// ---------- 도우미 ----------

type AlertButton = { text: string; style?: string; onPress?: () => void };

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
const scrollViewScrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;
const textInputFocus = (TextInput as unknown as { prototype: { focus: jest.Mock } }).prototype.focus;
let alertSpy: jest.SpyInstance;
let storedEntries: NowInEnglishEntry[] = [];
let storedSettings: NowInEnglishReminderSettings = reminderSettings();
let savedEntryCount = 0;

function setSessionUser(currentUser: AuthUser | null) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating: false,
    refreshSession,
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
}

function setParams(params: { reminder?: string }) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flushAsync();
}

async function renderScreen() {
  await render(<NowInEnglishScreen />);
  await flushAsync();
}

async function rerenderScreen() {
  await screen.rerender(<NowInEnglishScreen />);
  await flushAsync();
}

async function press(element: TestInstance) {
  await fireEvent.press(element);
  await flushAsync();
}

async function pressText(text: string | RegExp, index = 0) {
  await press(screen.getAllByText(text)[index]);
}

async function pressLabel(label: string) {
  await press(screen.getByLabelText(label));
}

function textOf(node: TestInstance) {
  return node.children.filter((child): child is string => typeof child === "string").join("");
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function spinners(root: TestInstance = screen.container) {
  return findHost(root, "ActivityIndicator");
}

function modalHosts() {
  return findHost(screen.container, "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

// 투명 모달(알림 설정, 달력)의 바깥 어두운 칸: 모달 안 첫 View의 첫 자식.
function modalBackdrop() {
  return (openModal().children[0] as TestInstance).children[0] as TestInstance;
}

async function requestCloseModal() {
  await act(async () => {
    (openModal().props.onRequestClose as () => void)();
  });
  await flushAsync();
}

function mainInput() {
  return screen.getByPlaceholderText(MAIN_PLACEHOLDER);
}

function coachInput() {
  return screen.getByPlaceholderText(COACH_PLACEHOLDER);
}

async function typeInto(input: TestInstance, value: string) {
  await fireEvent.changeText(input, value);
  await flushAsync();
}

async function saveText(value: string) {
  await typeInto(mainInput(), value);
  await pressText("저장하기");
}

function instantCard() {
  return screen.getByText("방금 문장 AI 코치").parent!.parent!;
}

// 돌아보기 카드 머리 글자("오늘의 영어 조각" 같은 것). 기록 보기의 "총 N개의 영어 조각"과 가린다.
const REFLECTION_KICKER = /^(오늘|어제|\d{4}년 \d{1,2}월 \d{1,2}일 \S+요일)의 영어 조각$/;

function reflectionCard() {
  return screen.getByText(REFLECTION_KICKER).parent!;
}

function reflectionAiCard() {
  return screen.getByText("AI 회고").parent!.parent!;
}

function reflectionSaveButtons() {
  return screen.getAllByLabelText(/^(표현 저장|저장한 표현 취소)$/);
}

function reflectionSaveState() {
  return reflectionSaveButtons().map((button) => [
    button.props.accessibilityLabel as string,
    findHost(button, "Text").map(textOf).join("")
  ]);
}

// 기록 타임라인의 날짜 묶음마다 그 안의 글자를 순서대로 모은다.
function timelineGroups() {
  return screen.queryAllByText(/^\d+개 남겼어요$/).map((countNode) =>
    findHost(countNode.parent!.parent!, "Text").map(textOf)
  );
}

// 돌아보기 카드의 "남긴 문장" 목록 글자.
function reflectionSentences() {
  const label = screen.getByText("남긴 문장");
  return findHost(label.parent!, "Text").map(textOf).slice(1);
}

function historyHeader() {
  const title = screen.getByText("달력").parent!.parent!;
  return findHost(title, "Text").map(textOf);
}

// 알림 설정 창의 조절 칸(알림 주기·시작·종료)의 버튼과 값.
function stepper(label: "알림 주기" | "시작" | "종료") {
  const box = within(openModal()).getByText(label).parent!;
  return {
    minus: within(box).getByText("-"),
    plus: within(box).getByText("+"),
    value: textOf(within(box).getByText(/(시간마다|:00)$/))
  };
}

function calendarDays() {
  return within(openModal())
    .queryAllByText(/^\d{1,2}$/)
    .map((node) => Number(textOf(node)));
}

function calendarCell(day: number, index = 0) {
  return within(openModal()).getAllByText(String(day))[index].parent!;
}

function hasDot(cell: TestInstance) {
  return cell.children.length === 2;
}

function lastAlert() {
  const call = alertSpy.mock.calls.at(-1) as [string, string, AlertButton[] | undefined];
  return { title: call[0], message: call[1], buttons: call[2] };
}

async function pressAlertButton(text: string) {
  const button = lastAlert().buttons!.find((item) => item.text === text)!;
  await act(async () => {
    button.onPress?.();
  });
  await flushAsync();
}

// 화면 구조 기록용: 호스트 요소의 종류, 이 화면이 정하는 속성(스타일은 펼친 값), 자식만 남긴다.
// React Native 안쪽에서 붙는 속성과 함수는 빼서, 화면 코드가 그대로면 같은 결과가 나오게 한다.
const STRUCTURE_PROPS = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "accessibilityViewIsModal",
  "accessible",
  "animationType",
  "autoCapitalize",
  "autoCorrect",
  "collapsable",
  "color",
  "contentContainerStyle",
  "edges",
  "keyboardShouldPersistTaps",
  "maxLength",
  "multiline",
  "name",
  "placeholder",
  "placeholderTextColor",
  "pointerEvents",
  "showsVerticalScrollIndicator",
  "size",
  "source",
  "style",
  "textAlignVertical",
  "tintColor",
  "transparent",
  "type",
  "value",
  "visible",
  "weight"
]);
const TEST_JSON = Symbol.for("react.test.json");

type StructureNode = {
  $$typeof: symbol;
  type: string;
  props: Record<string, unknown>;
  children: (StructureNode | string)[] | null;
};

function structureOf(node: TestInstance): StructureNode {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (value === undefined || typeof value === "function") {
      continue;
    }
    if (STRUCTURE_PROPS.has(key)) {
      props[key] = key.endsWith("tyle") ? StyleSheet.flatten(value) : value;
    }
  }
  if (typeof node.props.onLayout === "function") {
    props.onLayout = "(있음)";
  }
  const children = node.children.map((child) => (typeof child === "string" ? normalizeText(child) : structureOf(child)));
  return { $$typeof: TEST_JSON, type: node.type, props, children: children.length > 0 ? children : null };
}

function screenStructure() {
  return structureOf(screen.container);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  storedEntries = baseEntries.slice();
  storedSettings = reminderSettings();
  savedEntryCount = 0;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.back).mockReset();
  jest.mocked(router.canGoBack).mockReset().mockReturnValue(true);
  jest.mocked(getNowInEnglishSummary).mockReset().mockImplementation(async () => summaryOf(storedEntries, storedSettings));
  jest.mocked(saveNowInEnglishEntry).mockReset().mockImplementation(async (text, options = {}) => {
    savedEntryCount += 1;
    const entry: NowInEnglishEntry = {
      id: options.entryId ?? `now-new-${savedEntryCount}`,
      text,
      polishedFromEntryId: options.polishedFromEntryId ?? null,
      polishedFromText: options.polishedFromText ?? null,
      createdAt: options.createdAt ?? new Date().toISOString(),
      dateKey: options.dateKey ?? TODAY
    };
    storedEntries = [entry, ...storedEntries.filter((item) => item.id !== entry.id)];
    return entry;
  });
  jest.mocked(enableNowInEnglishReminders).mockReset().mockImplementation(async (intervalHours, quietHours, scheduleMode) => {
    storedSettings = {
      ...storedSettings,
      enabled: true,
      intervalHours,
      quietHours: quietHours ?? storedSettings.quietHours,
      scheduleMode: scheduleMode ?? storedSettings.scheduleMode,
      updatedAt: new Date().toISOString()
    };
    return storedSettings;
  });
  jest.mocked(disableNowInEnglishReminders).mockReset().mockImplementation(async () => {
    storedSettings = { ...storedSettings, enabled: false, updatedAt: new Date().toISOString() };
    return storedSettings;
  });
  jest.mocked(updateNowInEnglishScheduleMode).mockReset().mockImplementation(async (scheduleMode) => {
    storedSettings = { ...storedSettings, scheduleMode };
    return storedSettings;
  });
  jest.mocked(updateNowInEnglishQuietHours).mockReset().mockImplementation(async (quietHours) => {
    storedSettings = { ...storedSettings, quietHours };
    return storedSettings;
  });
  jest.mocked(getNowInEnglishAiReflection).mockReset().mockResolvedValue(null);
  jest.mocked(saveNowInEnglishAiReflection).mockReset().mockImplementation(async (reflection) => reflection);
  jest
    .mocked(requestNowInEnglishReflection)
    .mockReset()
    .mockImplementation(async (request) => reflectionResponse(request.dateKey, request.entries.length));
  jest.mocked(requestNowInEnglishCoachFeedback).mockReset().mockResolvedValue(coachFeedback());
  jest.mocked(requestCoachHelp).mockReset().mockResolvedValue(coachHelp);
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(saveExpression).mockReset().mockImplementation(async (request) => savedExpression(77, request.expression));
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  scrollViewScrollTo.mockClear();
  textInputFocus.mockClear();
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  setParams({});
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 진입과 불러오기 ----------

describe("[spec] 진입과 불러오기", () => {
  it("[spec] 요약을 받는 동안 쓰기 구역에 불러오는 중 표시가 있고 저장·알림 설정 버튼이 막히며, 돌아보기를 확인하지 않는다", async () => {
    const summary = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(summary.promise);
    await renderScreen();

    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(spinners()).toHaveLength(1);
    expect(spinners()[0].props.color).toBe("#EA920D");
    expect(screen.getByText("저장하기")).toBeDisabled();
    expect(screen.getByLabelText("알림 설정 열기")).toBeDisabled();
    expect(screen.getByText("알림이 꺼져 있어요")).toBeOnTheScreen();
    expect(screen.getByText("OFF")).toBeOnTheScreen();
    expect(screen.getByText("오늘의 첫 영어 조각을 남겨보세요.")).toBeOnTheScreen();
    expect(screen.queryByText(REFLECTION_KICKER)).toBeNull();
    expect(getNowInEnglishAiReflection).not.toHaveBeenCalled();
    expect(requestNowInEnglishReflection).not.toHaveBeenCalled();

    await act(async () => {
      summary.resolve(summaryOf(baseEntries, reminderSettings()));
    });
    await flushAsync();

    expect(spinners()).toHaveLength(0);
    expect(screen.getByText("저장하기")).not.toBeDisabled();
    expect(screen.getByLabelText("알림 설정 열기")).not.toBeDisabled();
    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishAiReflection).toHaveBeenCalledWith(TODAY);
  });

  it("[spec] 불러온 기록과 알림 설정을 보여 준다(오늘 보기, 돌아보기 카드가 타임라인보다 위)", async () => {
    storedSettings = reminderSettings({ enabled: true });
    await renderScreen();

    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(historyHeader()).toEqual(["오늘 남긴 문장", "2개를 남겼어요", "달력"]);
    expect(timelineGroups()).toEqual([
      ["오늘", "2개 남겼어요", deviceTime(t2.createdAt), t2.text, deviceTime(t1.createdAt), t1.text]
    ]);
    expect(screen.getAllByText(/^I am (having lunch|reading a book)\.$/).map(textOf)).toEqual([
      t1.text,
      t2.text,
      t2.text,
      t1.text
    ]);
    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T05:00:00.000Z")}`)).toBeOnTheScreen();
    expect(screen.getByText("ON")).toBeOnTheScreen();
    expect(screen.queryByText("기록을 불러오지 못했어요. 잠시 후 다시 열어 확인해 주세요.")).toBeNull();
  });

  it("[spec] 요약을 받지 못하면 실패 문구를 보이고 불러오는 중 표시를 끈다", async () => {
    jest.mocked(getNowInEnglishSummary).mockRejectedValueOnce(new Error("저장소 오류"));
    await renderScreen();

    expect(screen.getByText("기록을 불러오지 못했어요. 잠시 후 다시 열어 확인해 주세요.")).toBeOnTheScreen();
    expect(spinners()).toHaveLength(0);
    expect(screen.getByText("저장하기")).not.toBeDisabled();
    expect(screen.getByLabelText("알림 설정 열기")).not.toBeDisabled();
    expect(screen.getByText("오늘의 첫 영어 조각을 남겨보세요.")).toBeOnTheScreen();
    expect(screen.getByText("알림이 꺼져 있어요")).toBeOnTheScreen();
  });

  it("[spec] 로그인 사용자면 저장 표현을 한 번 불러와, 같은 표현(공백·대소문자 무시)을 돌아보기 카드에 저장됨으로 표시한다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(31, "  Grab A   Bite ")]);
    await renderScreen();

    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(getSavedExpressions).toHaveBeenCalledWith();
    expect(reflectionSaveState()).toEqual([
      ["저장한 표현 취소", "저장됨"],
      ["표현 저장", "저장"]
    ]);
  });

  it("[spec] 저장 표현을 불러오지 못하면 저장 표시를 비운다", async () => {
    jest.mocked(getSavedExpressions).mockRejectedValue(new Error("표현 서버 오류"));
    await renderScreen();

    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["표현 저장", "저장"]
    ]);
  });

  it("[spec] 로그인하지 않았으면 저장 표현을 부르지 않는다", async () => {
    setSessionUser(null);
    await renderScreen();

    expect(getSavedExpressions).not.toHaveBeenCalled();
    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["표현 저장", "저장"]
    ]);
  });

  it("[spec] 로그아웃하면 저장 표시를 비우고 다시 부르지 않는다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(31, "grab a bite")]);
    await renderScreen();
    expect(reflectionSaveState()[0]).toEqual(["저장한 표현 취소", "저장됨"]);

    setSessionUser(null);
    await rerenderScreen();

    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["표현 저장", "저장"]
    ]);
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
  });

  it("[spec] 경로 값 reminder=open이면 불러오기가 끝난 뒤 알림 설정 창을 한 번만 연다", async () => {
    setParams({ reminder: "open" });
    const summary = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(summary.promise);
    await renderScreen();

    expect(modalHosts()).toHaveLength(0);

    await act(async () => {
      summary.resolve(summaryOf(baseEntries, reminderSettings()));
    });
    await flushAsync();

    expect(within(openModal()).getByText("언제마다 알려드릴까요?")).toBeOnTheScreen();

    await press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);

    await rerenderScreen();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 경로 값 reminder가 open이 아니면 알림 설정 창을 열지 않는다", async () => {
    setParams({ reminder: "settings" });
    await renderScreen();

    expect(modalHosts()).toHaveLength(0);
  });
});

// ---------- 머리 줄 ----------

describe("[spec] 머리 줄", () => {
  it("[spec] 제목은 '지금 영어로'이고, 뒤로 갈 곳이 있으면 뒤로 간다", async () => {
    await renderScreen();

    expect(screen.getByText("지금 영어로")).toBeOnTheScreen();
    await pressText("<");

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("[spec] 뒤로 갈 곳이 없으면 홈('/')으로 바꾼다", async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await renderScreen();
    await pressText("<");

    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });
});

// ---------- 쓰기와 저장 ----------

describe("[spec] 쓰기와 저장", () => {
  it("[spec] 입력하면 글자 수가 바뀌고, 입력이 비어 있을(공백만 포함) 때만 코치 말풍선이 보인다", async () => {
    await renderScreen();

    expect(mainInput().props.maxLength).toBe(500);
    expect(screen.getByText("0/500")).toBeOnTheScreen();
    expect(screen.getByText(COACH_BUBBLE)).toBeOnTheScreen();

    await typeInto(mainInput(), "  ");
    expect(screen.getByText("2/500")).toBeOnTheScreen();
    expect(screen.getByText(COACH_BUBBLE)).toBeOnTheScreen();

    await typeInto(mainInput(), "I am walking.");
    expect(screen.getByText("13/500")).toBeOnTheScreen();
    expect(screen.queryByText(COACH_BUBBLE)).toBeNull();
    expect(screen.getByLabelText("AI 코치 열기")).toBeOnTheScreen();
  });

  it("[spec] 공백만 있으면 저장하지 않고 안내 Alert를 띄운다", async () => {
    await renderScreen();
    await saveText("   ");

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      "한 줄을 적어볼까요?",
      "지금 하고 있는 일이나 떠오른 생각을 영어로 짧게 남겨보세요."
    );
    expect(saveNowInEnglishEntry).not.toHaveBeenCalled();
  });

  it("[spec] 저장 중에는 버튼이 '저장 중...'으로 막히고, 저장 뒤 입력칸을 비우고 기록·상태 문구를 바꾸며 바로 코치와 목록 갱신을 부른다", async () => {
    const save = deferred<NowInEnglishEntry>();
    jest.mocked(saveNowInEnglishEntry).mockReturnValueOnce(save.promise);
    await renderScreen();
    const refresh = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(refresh.promise);

    await saveText("  I am walking.  ");

    expect(saveNowInEnglishEntry).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveNowInEnglishEntry).mock.calls[0]).toStrictEqual([
      "I am walking.",
      {
        entryId: undefined,
        createdAt: undefined,
        dateKey: undefined,
        polishedFromEntryId: null,
        polishedFromText: null
      }
    ]);
    expect(screen.getByText("저장 중...")).toBeDisabled();
    expect(mainInput().props.value).toBe("  I am walking.  ");

    const savedEntry = nowEntry("now-new", TODAY, NOW.toISOString(), "I am walking.");
    await act(async () => {
      save.resolve(savedEntry);
    });
    await flushAsync();

    expect(mainInput().props.value).toBe("");
    expect(screen.getByText("좋아요. 오늘의 영어 조각이 하나 쌓였어요.")).toBeOnTheScreen();
    // 목록 갱신을 기다리는 동안 버튼은 계속 막혀 있다.
    expect(screen.getByText("저장 중...")).toBeDisabled();
    expect(historyHeader()).toEqual(["오늘 남긴 문장", "3개를 남겼어요", "달력"]);
    expect(timelineGroups()[0]).toEqual([
      "오늘",
      "3개 남겼어요",
      deviceTime(savedEntry.createdAt),
      savedEntry.text,
      deviceTime(t2.createdAt),
      t2.text,
      deviceTime(t1.createdAt),
      t1.text
    ]);
    expect(requestNowInEnglishCoachFeedback).toHaveBeenCalledTimes(1);
    expect(requestNowInEnglishCoachFeedback).toHaveBeenCalledWith({ text: "I am walking.", createdAt: NOW.toISOString() });
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);

    await act(async () => {
      refresh.resolve(summaryOf([savedEntry, ...baseEntries], reminderSettings()));
    });
    await flushAsync();

    expect(screen.getByText("저장하기")).not.toBeDisabled();
    expect(historyHeader()).toEqual(["오늘 남긴 문장", "3개를 남겼어요", "달력"]);
    expect(screen.getByText("좋아요. 오늘의 영어 조각이 하나 쌓였어요.")).toBeOnTheScreen();
  });

  it("[spec] 저장 뒤 목록을 다시 받지 못하면 상태 문구를 바꾸고, 저장한 기록은 목록에 남긴다", async () => {
    await renderScreen();
    jest.mocked(getNowInEnglishSummary).mockRejectedValueOnce(new Error("목록 오류"));
    await saveText("I am walking.");

    expect(screen.getByText("저장은 됐어요. 기록 목록은 잠시 후 다시 갱신해 주세요.")).toBeOnTheScreen();
    expect(screen.queryByText("좋아요. 오늘의 영어 조각이 하나 쌓였어요.")).toBeNull();
    expect(historyHeader()[1]).toBe("3개를 남겼어요");
    expect(screen.getByText("저장하기")).not.toBeDisabled();
  });

  it.each([
    [new Error("저장 서버 오류"), "저장 서버 오류"],
    ["문자열 오류", "잠시 후 다시 시도해 주세요."]
  ])("[spec] 저장에 실패하면(%p) Alert를 띄우고 입력을 남긴다", async (error, message) => {
    jest.mocked(saveNowInEnglishEntry).mockRejectedValueOnce(error);
    await renderScreen();
    await saveText("I am walking.");

    expect(alertSpy).toHaveBeenCalledWith("저장하지 못했어요", message);
    expect(mainInput().props.value).toBe("I am walking.");
    expect(screen.getByText("저장하기")).not.toBeDisabled();
    expect(requestNowInEnglishCoachFeedback).not.toHaveBeenCalled();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("방금 문장 AI 코치")).toBeNull();
  });

  it("[spec] 바로 코치 카드: 불러오는 중에는 원문·표시·안내만 있고 버튼이 없다가, 결과가 오면 모든 칸과 버튼을 보인다", async () => {
    const feedback = deferred<NowInEnglishCoachFeedbackResponse>();
    jest.mocked(requestNowInEnglishCoachFeedback).mockReturnValueOnce(feedback.promise);
    await renderScreen();
    await saveText("I am walking.");

    let card = instantCard();
    expect(findHost(card, "Text").map(textOf)).toEqual([
      "방금 문장 AI 코치",
      "I am walking.",
      "저장은 끝났고, AI가 문장을 짧게 살펴보고 있어요."
    ]);
    expect(spinners(card)).toHaveLength(1);
    expect(spinners(card)[0].props.color).toBe("#EA920D");

    await act(async () => {
      feedback.resolve(coachFeedback());
    });
    await flushAsync();

    card = instantCard();
    expect(spinners(card)).toHaveLength(0);
    expect(findHost(card, "Text").map(textOf)).toEqual([
      "방금 문장 AI 코치",
      "I am walking.",
      "산책 장면이 잘 보여요",
      "현재진행형으로 지금을 잘 담았어요.",
      "이렇게도 말해요",
      "I'm taking a walk.",
      "산책하고 있어요.",
      "왜 이렇게 말하나요",
      "take a walk가 더 자연스러워요.",
      "살 더 붙여보기",
      "어디를 걷고 있나요?",
      "take a walk",
      "산책하다",
      "I take a walk after lunch.",
      "수정해보기",
      "이대로 남기기",
      "AI 코치에게 더 물어보기"
    ]);
  });

  it("[spec] 바로 코치 제안이 원문과 같으면(대소문자·끝 문장부호·공백 무시) 제안과 이유 칸을 숨긴다", async () => {
    jest.mocked(requestNowInEnglishCoachFeedback).mockResolvedValueOnce(coachFeedback({ suggestionEn: "  i am   WALKING!! " }));
    await renderScreen();
    await saveText("I am walking.");

    const texts = findHost(instantCard(), "Text").map(textOf);
    expect(texts).not.toContain("이렇게도 말해요");
    expect(texts).not.toContain("왜 이렇게 말하나요");
    expect(texts).not.toContain("산책하고 있어요.");
    expect(texts).toContain("살 더 붙여보기");
    expect(texts).toContain("take a walk");
  });

  it("[spec] 바로 코치 결과의 빈 칸(번역·이유·다음 질문·표현)은 숨긴다", async () => {
    jest.mocked(requestNowInEnglishCoachFeedback).mockResolvedValueOnce(
      coachFeedback({
        suggestionTranslationKo: "",
        suggestionKo: "",
        nextQuestionKo: "",
        expression: "",
        expressionMeaningKo: "뜻만 있음",
        expressionExampleEn: "Example only."
      })
    );
    await renderScreen();
    await saveText("I am walking.");

    expect(findHost(instantCard(), "Text").map(textOf)).toEqual([
      "방금 문장 AI 코치",
      "I am walking.",
      "산책 장면이 잘 보여요",
      "현재진행형으로 지금을 잘 담았어요.",
      "이렇게도 말해요",
      "I'm taking a walk.",
      "수정해보기",
      "이대로 남기기",
      "AI 코치에게 더 물어보기"
    ]);
  });

  it("[spec] 바로 코치 표현 칸에서 뜻·예문이 비면 그 줄만 숨긴다", async () => {
    jest
      .mocked(requestNowInEnglishCoachFeedback)
      .mockResolvedValueOnce(coachFeedback({ expressionMeaningKo: "", expressionExampleEn: "" }));
    await renderScreen();
    await saveText("I am walking.");

    const texts = findHost(instantCard(), "Text").map(textOf);
    expect(texts).toContain("take a walk");
    expect(texts).not.toContain("산책하다");
    expect(texts).not.toContain("I take a walk after lunch.");
  });

  it("[spec] 바로 코치 오류: 오류 문구·문제 보내기·다시 시도가 보이고, 다시 시도하면 같은 기록으로 다시 부른다", async () => {
    jest.mocked(requestNowInEnglishCoachFeedback).mockRejectedValueOnce(new Error("코치 서버 오류"));
    await renderScreen();
    await saveText("I am walking.");

    expect(findHost(instantCard(), "Text").map(textOf)).toEqual([
      "방금 문장 AI 코치",
      "I am walking.",
      "저장은 완료됐어요.",
      "코치 서버 오류",
      PROBLEM_LINK_TEXT,
      "AI 코치 다시 시도",
      "수정해보기",
      "이대로 남기기",
      "AI 코치에게 더 물어보기"
    ]);

    await pressText(PROBLEM_LINK_TEXT);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/support-feedback",
      params: { source: "now_coach", errorCode: "NOW_COACH_ERROR", category: "BUG" }
    });

    const retry = deferred<NowInEnglishCoachFeedbackResponse>();
    jest.mocked(requestNowInEnglishCoachFeedback).mockReturnValueOnce(retry.promise);
    await pressText("AI 코치 다시 시도");

    expect(requestNowInEnglishCoachFeedback).toHaveBeenCalledTimes(2);
    expect(jest.mocked(requestNowInEnglishCoachFeedback).mock.calls[1]).toEqual([
      { text: "I am walking.", createdAt: NOW.toISOString() }
    ]);
    expect(findHost(instantCard(), "Text").map(textOf)).toEqual([
      "방금 문장 AI 코치",
      "I am walking.",
      "저장은 끝났고, AI가 문장을 짧게 살펴보고 있어요."
    ]);

    await act(async () => {
      retry.resolve(coachFeedback());
    });
    await flushAsync();
    expect(within(instantCard()).getByText("산책 장면이 잘 보여요")).toBeOnTheScreen();
    expect(within(instantCard()).queryByText("코치 서버 오류")).toBeNull();
  });

  it("[spec] 바로 코치 오류가 Error가 아니면 기본 문구를 보인다", async () => {
    jest.mocked(requestNowInEnglishCoachFeedback).mockRejectedValueOnce("이상한 오류");
    await renderScreen();
    await saveText("I am walking.");

    expect(within(instantCard()).getByText("저장은 완료됐어요. AI 코치는 잠시 후 다시 시도해 주세요.")).toBeOnTheScreen();
  });

  it("[spec] 바로 코치를 다시 부르면 앞 요청의 늦은 응답·오류는 버린다", async () => {
    const first = deferred<NowInEnglishCoachFeedbackResponse>();
    const second = deferred<NowInEnglishCoachFeedbackResponse>();
    jest.mocked(requestNowInEnglishCoachFeedback).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await renderScreen();
    await saveText("I am walking.");
    await saveText("I am running.");

    expect(requestNowInEnglishCoachFeedback).toHaveBeenCalledTimes(2);
    await act(async () => {
      first.resolve(coachFeedback({ headlineKo: "첫 응답" }));
    });
    await flushAsync();

    expect(findHost(instantCard(), "Text").map(textOf)).toEqual([
      "방금 문장 AI 코치",
      "I am running.",
      "저장은 끝났고, AI가 문장을 짧게 살펴보고 있어요."
    ]);
    expect(spinners(instantCard())).toHaveLength(1);

    await act(async () => {
      second.resolve(coachFeedback({ headlineKo: "둘째 응답" }));
    });
    await flushAsync();
    expect(within(instantCard()).getByText("둘째 응답")).toBeOnTheScreen();

    const third = deferred<NowInEnglishCoachFeedbackResponse>();
    const fourth = deferred<NowInEnglishCoachFeedbackResponse>();
    jest.mocked(requestNowInEnglishCoachFeedback).mockReturnValueOnce(third.promise).mockReturnValueOnce(fourth.promise);
    await saveText("I am swimming.");
    await saveText("I am sleeping.");
    await act(async () => {
      fourth.resolve(coachFeedback({ headlineKo: "넷째 응답" }));
    });
    await flushAsync();
    await act(async () => {
      third.reject(new Error("늦은 오류"));
    });
    await flushAsync();

    expect(within(instantCard()).getByText("넷째 응답")).toBeOnTheScreen();
    expect(screen.queryByText("늦은 오류")).toBeNull();
    expect(spinners(instantCard())).toHaveLength(0);
  });

  it("[spec] 이대로 남기기: 카드를 닫고 상태 문구를 바꾼다", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await pressText("이대로 남기기");

    expect(screen.queryByText("방금 문장 AI 코치")).toBeNull();
    expect(screen.getByText("좋아요. 이 문장은 그대로 남겨둘게요.")).toBeOnTheScreen();
  });

  it("[spec] 수정해보기: 입력칸에 문장을 넣고 다듬기 표시·버튼 문구·상태 문구를 바꾸며, 쓰기 구역으로 스크롤하고 다음 프레임에 입력칸에 초점을 준다", async () => {
    await renderScreen();
    await act(async () => {
      fireEvent(screen.getByText(HERO_TITLE), "layout", { nativeEvent: { layout: { x: 0, y: 300, width: 320, height: 400 } } });
    });
    await saveText("I am walking.");
    textInputFocus.mockClear();
    await pressText("수정해보기");

    expect(mainInput().props.value).toBe("I am walking.");
    expect(screen.getByText("기존 기록 수정 중")).toBeOnTheScreen();
    expect(screen.getByText("저장하면 방금 남긴 문장이 수정되고 전후 비교가 남아요.")).toBeOnTheScreen();
    expect(screen.getByText("수정 저장하기")).not.toBeDisabled();
    expect(screen.queryByText("저장하기")).toBeNull();
    expect(screen.getByText("AI 제안을 참고해서 직접 다듬어 보세요.")).toBeOnTheScreen();
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 292, animated: true });
    expect(textInputFocus).not.toHaveBeenCalled();

    await advance(0);
    expect(textInputFocus).toHaveBeenCalledTimes(1);
    expect((textInputFocus.mock.contexts[0] as { props: { placeholder: string } }).props.placeholder).toBe(MAIN_PLACEHOLDER);
    // 카드는 그대로 남는다.
    expect(screen.getByText("방금 문장 AI 코치")).toBeOnTheScreen();
  });

  it("[spec] 쓰기 구역 위치를 모르면(0) 맨 위(0)로 스크롤한다", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await pressText("수정해보기");

    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it("[spec] 다듬은 문장을 저장하면 같은 기록을 전후 비교로 바꾸고, 저장 중에는 '수정 저장 중...'으로 막힌다", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await pressText("수정해보기");
    await typeInto(mainInput(), " I am taking a walk. ");

    const save = deferred<NowInEnglishEntry>();
    jest.mocked(saveNowInEnglishEntry).mockReturnValueOnce(save.promise);
    await pressText("수정 저장하기");

    expect(jest.mocked(saveNowInEnglishEntry).mock.calls[1]).toStrictEqual([
      "I am taking a walk.",
      {
        entryId: "now-new-1",
        createdAt: NOW.toISOString(),
        dateKey: TODAY,
        polishedFromEntryId: "now-new-1",
        polishedFromText: "I am walking."
      }
    ]);
    expect(screen.getByText("수정 저장 중...")).toBeDisabled();

    const polished: NowInEnglishEntry = {
      id: "now-new-1",
      text: "I am taking a walk.",
      polishedFromEntryId: "now-new-1",
      polishedFromText: "I am walking.",
      createdAt: NOW.toISOString(),
      dateKey: TODAY
    };
    storedEntries = [polished, ...baseEntries];
    await act(async () => {
      save.resolve(polished);
    });
    await flushAsync();

    expect(screen.getByText("좋아요. 다듬은 문장의 전후를 기록했어요.")).toBeOnTheScreen();
    expect(screen.queryByText("기존 기록 수정 중")).toBeNull();
    expect(screen.getByText("저장하기")).not.toBeDisabled();
    expect(mainInput().props.value).toBe("");
    expect(historyHeader()[1]).toBe("3개를 남겼어요");
    expect(timelineGroups()[0]).toEqual([
      "오늘",
      "3개 남겼어요",
      deviceTime(NOW.toISOString()),
      "다듬은 문장",
      "수정 전",
      "I am walking.",
      "수정 후",
      "I am taking a walk.",
      deviceTime(t2.createdAt),
      t2.text,
      deviceTime(t1.createdAt),
      t1.text
    ]);
    expect(requestNowInEnglishCoachFeedback).toHaveBeenLastCalledWith({
      text: "I am taking a walk.",
      createdAt: NOW.toISOString()
    });
  });

  it("[spec] 다듬기 취소: 입력칸을 비우고 다듬기 표시를 끄며 상태 문구를 바꾼다(카드는 남는다)", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await pressText("수정해보기");
    await pressText("취소");

    expect(mainInput().props.value).toBe("");
    expect(screen.queryByText("기존 기록 수정 중")).toBeNull();
    expect(screen.getByText("저장하기")).toBeOnTheScreen();
    expect(screen.getByText("수정을 취소했어요. 새 영어 조각을 남겨볼까요?")).toBeOnTheScreen();
    expect(screen.getByText("방금 문장 AI 코치")).toBeOnTheScreen();
  });

  it("[spec] 다듬는 중 이대로 남기기: 다듬기 표시를 끄지만 입력칸의 문장은 남긴다", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await pressText("수정해보기");
    await pressText("이대로 남기기");

    expect(screen.queryByText("기존 기록 수정 중")).toBeNull();
    expect(screen.queryByText("방금 문장 AI 코치")).toBeNull();
    expect(mainInput().props.value).toBe("I am walking.");
    expect(screen.getByText("저장하기")).toBeOnTheScreen();
    expect(screen.getByText("좋아요. 이 문장은 그대로 남겨둘게요.")).toBeOnTheScreen();
  });

  it("[spec] AI 코치에게 더 물어보기: 앞 질문·답을 지운 코치 창을 열고 코치를 부르지 않는다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "피곤하다를 어떻게 말해?");
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();
    await press(within(openModal()).getByText("닫기"));

    await saveText("I am walking.");
    await pressText("AI 코치에게 더 물어보기");

    expect(within(openModal()).getByText("AI 코치")).toBeOnTheScreen();
    expect(coachInput().props.value).toBe("");
    expect(screen.queryByText("코치 답변")).toBeNull();
    expect(requestCoachHelp).toHaveBeenCalledTimes(1);
  });
});

// ---------- AI 코치 창 ----------

describe("[spec] AI 코치 창", () => {
  it("[spec] 코치 열기 버튼(역할·이름·힌트)을 누르면 창이 열리고 버튼이 사라지며, 닫기·뒤로 가기로 닫는다", async () => {
    await renderScreen();
    const trigger = screen.getByLabelText("AI 코치 열기");
    expect(trigger.props.accessibilityRole).toBe("button");
    expect(trigger.props.accessibilityHint).toBe("지금 영어로 한 줄 기록을 도와주는 AI 코치를 엽니다.");

    await press(trigger);
    const modal = openModal();
    expect(modal.props.animationType).toBe("slide");
    expect(findHost(modal, "Text").map(textOf)).toEqual([
      "AI 코치",
      "닫기",
      "지금 상황을 영어로 쓰는 걸 도와드릴게요.",
      ...QUICK_QUESTIONS,
      "코치에게 물어보기",
      "코치 답변은 힌트예요. 그대로 복사하기보다 지금 내 상황에 맞게 한 줄로 바꿔 보세요."
    ]);
    expect(screen.queryByLabelText("AI 코치 열기")).toBeNull();

    await press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);
    expect(screen.getByLabelText("AI 코치 열기")).toBeOnTheScreen();

    await pressLabel("AI 코치 열기");
    await requestCloseModal();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 빠른 질문을 누르면 질문칸에 넣는다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await pressText(QUICK_QUESTIONS[2]);

    expect(coachInput().props.value).toBe(QUICK_QUESTIONS[2]);
    expect(requestCoachHelp).not.toHaveBeenCalled();
  });

  it("[spec] 질문이 비면 묻지 않고 오류를 보이며, 질문을 고치면 오류를 지운다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "   ");
    await pressText("코치에게 물어보기");

    expect(screen.getByText("코치에게 물어볼 내용을 먼저 적어 주세요.")).toBeOnTheScreen();
    expect(requestCoachHelp).not.toHaveBeenCalled();

    await typeInto(coachInput(), "어떻게 말해?");
    expect(screen.queryByText("코치에게 물어볼 내용을 먼저 적어 주세요.")).toBeNull();
  });

  it("[spec] 묻는 동안 버튼이 불러오는 중으로 막히고, 다듬은 질문과 입력칸 문장을 보내며, 답과 표현을 보인다", async () => {
    await renderScreen();
    await typeInto(mainInput(), "  I am tired.  ");
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "  피곤하다를 어떻게 말해?  ");

    const help = deferred<CoachHelpResponse>();
    jest.mocked(requestCoachHelp).mockReturnValueOnce(help.promise);
    await pressText("코치에게 물어보기");

    expect(jest.mocked(requestCoachHelp).mock.calls[0]).toStrictEqual([
      { promptId: "diary-free-writing", question: "피곤하다를 어떻게 말해?", answer: "I am tired.", attemptType: "INITIAL" }
    ]);
    const modalSpinners = spinners(openModal());
    expect(modalSpinners).toHaveLength(1);
    expect(modalSpinners[0].props.color).toBe("#24180B");
    expect(modalSpinners[0].parent!).toBeDisabled();
    expect(within(openModal()).queryByText("코치에게 물어보기")).toBeNull();

    await act(async () => {
      help.resolve(coachHelp);
    });
    await flushAsync();

    expect(coachInput().props.value).toBe("피곤하다를 어떻게 말해?");
    expect(spinners(openModal())).toHaveLength(0);
    const texts = findHost(openModal(), "Text").map(textOf);
    expect(texts.slice(texts.indexOf("코치 답변"))).toEqual([
      "코치 답변",
      "지친 느낌은 이렇게 말해 보세요.",
      "feel drained",
      "기운이 빠지다",
      "많이 지쳤을 때",
      "I feel drained after work.",
      "한 줄에 넣기",
      "call it a day",
      "오늘은 그만하다",
      "일을 마칠 때",
      "Let's call it a day.",
      "한 줄에 넣기"
    ]);
  });

  it("[spec] 입력칸이 비어 있으면 answer 없이 묻는다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await pressText(QUICK_QUESTIONS[0]);
    await pressText("코치에게 물어보기");

    expect(jest.mocked(requestCoachHelp).mock.calls[0]).toStrictEqual([
      { promptId: "diary-free-writing", question: QUICK_QUESTIONS[0], answer: undefined, attemptType: "INITIAL" }
    ]);
  });

  it.each([
    [new Error("코치 서버 오류"), "코치 서버 오류"],
    ["문자열 오류", "AI 코치를 불러오지 못했어요."]
  ])("[spec] 묻기에 실패하면(%p) 오류 문구를 보인다", async (error, message) => {
    jest.mocked(requestCoachHelp).mockRejectedValueOnce(error);
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "어떻게 말해?");
    await pressText("코치에게 물어보기");

    expect(within(openModal()).getByText(message)).toBeOnTheScreen();
    expect(within(openModal()).getByText("코치에게 물어보기")).not.toBeDisabled();
    expect(coachInput().props.value).toBe("어떻게 말해?");
  });

  it("[spec] 다시 물으면 앞 답을 지운다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "어떻게 말해?");
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();

    jest.mocked(requestCoachHelp).mockReturnValueOnce(new Promise(() => undefined));
    await pressText("코치에게 물어보기");
    expect(screen.queryByText("코치 답변")).toBeNull();
    expect(requestCoachHelp).toHaveBeenCalledTimes(2);
  });

  it("[spec] 질문을 고치면 답을, 빠른 질문을 누르면 오류를 지운다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "어떻게 말해?");
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();
    await typeInto(coachInput(), "어떻게 말해요?");
    expect(screen.queryByText("코치 답변")).toBeNull();

    jest.mocked(requestCoachHelp).mockRejectedValueOnce(new Error("코치 서버 오류"));
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 서버 오류")).toBeOnTheScreen();
    await pressText(QUICK_QUESTIONS[1]);
    expect(screen.queryByText("코치 서버 오류")).toBeNull();
    expect(coachInput().props.value).toBe(QUICK_QUESTIONS[1]);
  });

  it("[spec] 빠른 질문을 누르면 앞 답을 지운다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "어떻게 말해?");
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();
    await pressText(QUICK_QUESTIONS[3]);
    expect(screen.queryByText("코치 답변")).toBeNull();
  });

  it("[spec] 한 줄에 넣기: 입력칸이 비면 표현만, 아니면 다듬은 입력 뒤 줄바꿈으로 붙이고 창을 닫으며 상태 문구를 바꾼다", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "어떻게 말해?");
    await pressText("코치에게 물어보기");
    await pressText("한 줄에 넣기", 0);

    expect(modalHosts()).toHaveLength(0);
    expect(mainInput().props.value).toBe("feel drained");
    expect(screen.getByText("코치 표현을 한 줄 기록에 넣었어요.")).toBeOnTheScreen();

    await typeInto(mainInput(), "  I am tired.  ");
    await pressLabel("AI 코치 열기");
    // 창을 다시 열어도 앞 답은 남아 있다.
    await pressText("한 줄에 넣기", 1);
    expect(mainInput().props.value).toBe("I am tired.\ncall it a day");
  });
});

// ---------- 알림 ----------

describe("[spec] 알림", () => {
  it("[spec] 요약 버튼(역할·이름): 꺼져 있으면 '알림이 꺼져 있어요'와 OFF", async () => {
    await renderScreen();

    const button = screen.getByLabelText("알림 설정 열기");
    expect(button.props.accessibilityRole).toBe("button");
    expect(findHost(button, "Text").map(textOf)).toEqual(["알림 설정", "알림이 꺼져 있어요", "OFF"]);
  });

  it("[spec] 요약 버튼: 켜져 있으면 다음 알림 시각(정각 기준 2시간: 서울 14:00)과 ON", async () => {
    storedSettings = reminderSettings({ enabled: true });
    await renderScreen();

    expect(findHost(screen.getByLabelText("알림 설정 열기"), "Text").map(textOf)).toEqual([
      "알림 설정",
      `다음 알림 · ${seoulTime("2026-11-12T05:00:00.000Z")}`,
      "ON"
    ]);
  });

  it("[spec] 다음 알림 시각은 방해금지 시간을 건너뛴다(서울 22:30, 1시간, 23-08 → 다음 날 08:00)", async () => {
    jest.setSystemTime(new Date("2026-11-12T13:30:00.000Z"));
    storedSettings = reminderSettings({ enabled: true, intervalHours: 1 });
    await renderScreen();

    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T23:00:00.000Z")}`)).toBeOnTheScreen();
  });

  it("[spec] 다음 알림 시각은 설정 시각이 지금보다 뒤면 그 시각부터 센다(지금부터 2시간, 설정 서울 13:00 → 15:00)", async () => {
    storedSettings = reminderSettings({ enabled: true, scheduleMode: "FROM_NOW", updatedAt: "2026-11-12T04:00:00.000Z" });
    await renderScreen();

    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T06:00:00.000Z")}`)).toBeOnTheScreen();
  });

  it("[spec] 다음 알림 시각은 저장된 예약 시각 목록을 쓰지 않고 설정으로 계산한다", async () => {
    storedSettings = reminderSettings({
      enabled: true,
      scheduleTimeZone: "Asia/Seoul",
      scheduleVersion: 2,
      scheduledReminderAts: ["2026-11-12T03:30:00.000Z"]
    });
    await renderScreen();

    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T05:00:00.000Z")}`)).toBeOnTheScreen();
  });

  it("[spec] 켜져 있으면 1분마다 다음 알림 시각을 다시 계산한다(지금부터 2시간)", async () => {
    storedSettings = reminderSettings({ enabled: true, scheduleMode: "FROM_NOW" });
    await renderScreen();
    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T05:00:00.000Z")}`)).toBeOnTheScreen();

    await advance(59_000);
    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T05:00:00.000Z")}`)).toBeOnTheScreen();

    await advance(1_000);
    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T05:01:00.000Z")}`)).toBeOnTheScreen();

    await advance(60_000);
    expect(screen.getByText(`다음 알림 · ${seoulTime("2026-11-12T05:02:00.000Z")}`)).toBeOnTheScreen();
  });

  it("[spec] 설정 창: 요약 버튼으로 열고 내용(간격·켜기·기준·방해금지)을 보이며, 닫기·바깥·뒤로 가기로 닫는다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    const modal = openModal();
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe("fade");
    expect(findHost(modal, "Text").map(textOf)).toEqual([
      "언제마다 알려드릴까요?",
      "닫기",
      "지금 하고 있는 일이나 떠오른 생각을 영어로 남길 수 있게 가볍게 알려드릴게요.",
      "알림이 꺼져 있어요",
      "알림 주기",
      "-",
      "2시간마다",
      "+",
      "알림 켜기",
      "알림 기준",
      "정각 기준으로 알림을 맞춰요.",
      "정각 기준",
      "지금부터",
      "방해금지 시간",
      "23:00-08:00에는 알림을 쉬어요.",
      "ON",
      "시작",
      "-",
      "23:00",
      "+",
      "종료",
      "-",
      "08:00",
      "+"
    ]);

    await press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);

    await pressLabel("알림 설정 열기");
    await press(modalBackdrop());
    expect(modalHosts()).toHaveLength(0);

    await pressLabel("알림 설정 열기");
    await requestCloseModal();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 알림 켜기: 바꾸는 중에는 모든 조절이 막히고, 켠 뒤 버튼·요약·상태 문구를 바꾼다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");
    const pending = deferred<NowInEnglishReminderSettings>();
    jest.mocked(enableNowInEnglishReminders).mockReturnValueOnce(pending.promise);
    await press(within(openModal()).getByText("알림 켜기"));

    expect(enableNowInEnglishReminders).toHaveBeenCalledWith(2, { enabled: true, startHour: 23, endHour: 8 }, "HOURLY_ANCHOR");
    const modal = within(openModal());
    expect(modal.getByText("알림 켜기")).toBeDisabled();
    expect(stepper("알림 주기").minus).toBeDisabled();
    expect(stepper("알림 주기").plus).toBeDisabled();
    expect(modal.getByText("정각 기준")).toBeDisabled();
    expect(modal.getByText("지금부터")).toBeDisabled();
    expect(modal.getByText("ON")).toBeDisabled();
    expect(stepper("시작").minus).toBeDisabled();
    expect(stepper("시작").plus).toBeDisabled();
    expect(stepper("종료").minus).toBeDisabled();
    expect(stepper("종료").plus).toBeDisabled();
    expect(screen.getByLabelText("알림 설정 열기")).toBeDisabled();

    await act(async () => {
      pending.resolve(reminderSettings({ enabled: true, updatedAt: NOW.toISOString() }));
    });
    await flushAsync();

    expect(within(openModal()).getByText("알림 끄기")).not.toBeDisabled();
    expect(within(openModal()).getByText(`다음 알림 · ${seoulTime("2026-11-12T05:00:00.000Z")}`)).toBeOnTheScreen();
    expect(screen.getByText("2시간마다 지금 영어로 알림을 보내드릴게요.")).toBeOnTheScreen();
    expect(findHost(screen.getByLabelText("알림 설정 열기"), "Text").map(textOf)[2]).toBe("ON");
    expect(screen.getByLabelText("알림 설정 열기")).not.toBeDisabled();
  });

  it("[spec] 알림 끄기: 끈 뒤 버튼·요약·상태 문구를 바꾼다", async () => {
    storedSettings = reminderSettings({ enabled: true });
    await renderScreen();
    await pressLabel("알림 설정 열기");
    await press(within(openModal()).getByText("알림 끄기"));

    expect(disableNowInEnglishReminders).toHaveBeenCalledTimes(1);
    expect(disableNowInEnglishReminders).toHaveBeenCalledWith();
    expect(within(openModal()).getByText("알림 켜기")).toBeOnTheScreen();
    expect(within(openModal()).getByText("알림이 꺼져 있어요")).toBeOnTheScreen();
    expect(screen.getByText("지금 영어로 알림을 껐어요.")).toBeOnTheScreen();
  });

  it("[spec] 간격 조절(꺼짐): API 없이 값만 바꾸고 1시간 아래로는 막히며, 켜면 그 값으로 켠다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    await press(stepper("알림 주기").plus);
    expect(stepper("알림 주기").value).toBe("3시간마다");
    await press(stepper("알림 주기").minus);
    await press(stepper("알림 주기").minus);
    expect(stepper("알림 주기").value).toBe("1시간마다");
    expect(stepper("알림 주기").minus).toBeDisabled();
    expect(stepper("알림 주기").plus).not.toBeDisabled();
    expect(enableNowInEnglishReminders).not.toHaveBeenCalled();

    await press(within(openModal()).getByText("알림 켜기"));
    expect(enableNowInEnglishReminders).toHaveBeenCalledWith(1, { enabled: true, startHour: 23, endHour: 8 }, "HOURLY_ANCHOR");
    expect(screen.getByText("1시간마다 지금 영어로 알림을 보내드릴게요.")).toBeOnTheScreen();
  });

  it("[spec] 간격 조절: 12시간이면 + 가 막힌다", async () => {
    storedSettings = reminderSettings({ intervalHours: 12 });
    await renderScreen();
    await pressLabel("알림 설정 열기");

    expect(stepper("알림 주기").value).toBe("12시간마다");
    expect(stepper("알림 주기").plus).toBeDisabled();
    expect(stepper("알림 주기").minus).not.toBeDisabled();
  });

  it("[spec] 간격 조절(켜짐): 바뀐 간격으로 다시 켜고 상태 문구를 바꾼다", async () => {
    storedSettings = reminderSettings({ enabled: true, scheduleMode: "FROM_NOW" });
    await renderScreen();
    await pressLabel("알림 설정 열기");
    await press(stepper("알림 주기").plus);

    expect(enableNowInEnglishReminders).toHaveBeenCalledWith(3, { enabled: true, startHour: 23, endHour: 8 }, "FROM_NOW");
    expect(stepper("알림 주기").value).toBe("3시간마다");
    expect(screen.getByText("3시간마다 지금 영어로 알림을 보내드릴게요.")).toBeOnTheScreen();
  });

  it("[spec] 알림 기준 바꾸기: 지금부터·정각 기준(이미 고른 것도) 모두 API를 부르고 설명·상태 문구를 바꾼다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    await press(within(openModal()).getByText("지금부터"));
    expect(updateNowInEnglishScheduleMode).toHaveBeenLastCalledWith("FROM_NOW");
    expect(within(openModal()).getByText("설정한 순간부터 간격을 세요.")).toBeOnTheScreen();
    expect(screen.getByText("지금부터 n시간마다 알림을 맞췄어요.")).toBeOnTheScreen();

    await press(within(openModal()).getByText("지금부터"));
    expect(updateNowInEnglishScheduleMode).toHaveBeenCalledTimes(2);

    await press(within(openModal()).getByText("정각 기준"));
    expect(updateNowInEnglishScheduleMode).toHaveBeenLastCalledWith("HOURLY_ANCHOR");
    expect(within(openModal()).getByText("정각 기준으로 알림을 맞춰요.")).toBeOnTheScreen();
    expect(screen.getByText("정각 기준으로 알림을 맞췄어요.")).toBeOnTheScreen();
  });

  it("[spec] 방해금지 끄기·켜기: 받은 설정으로 설명·표시·조절 칸을 바꾸고 상태 문구를 바꾼다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    await press(within(openModal()).getByText("ON"));
    expect(updateNowInEnglishQuietHours).toHaveBeenLastCalledWith({ enabled: false, startHour: 23, endHour: 8 });
    expect(within(openModal()).getByText("밤에도 알림을 받을 수 있어요.")).toBeOnTheScreen();
    expect(within(openModal()).getByText("OFF")).toBeOnTheScreen();
    expect(within(openModal()).queryByText("시작")).toBeNull();
    expect(within(openModal()).queryByText("종료")).toBeNull();
    expect(screen.getByText("방해금지 시간을 껐어요.")).toBeOnTheScreen();

    await press(within(openModal()).getByText("OFF"));
    expect(updateNowInEnglishQuietHours).toHaveBeenLastCalledWith({ enabled: true, startHour: 23, endHour: 8 });
    expect(within(openModal()).getByText("23:00-08:00에는 알림을 쉬어요.")).toBeOnTheScreen();
    expect(screen.getByText("방해금지 시간을 23:00-08:00로 설정했어요.")).toBeOnTheScreen();
  });

  it("[spec] 방해금지 시간 조절: 시작·종료를 한 시간씩(24시간 돌아감) 바꾸고 상태 문구를 바꾼다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    await press(stepper("시작").plus);
    expect(updateNowInEnglishQuietHours).toHaveBeenLastCalledWith({ enabled: true, startHour: 0, endHour: 8 });
    expect(stepper("시작").value).toBe("00:00");
    expect(within(openModal()).getByText("00:00-08:00에는 알림을 쉬어요.")).toBeOnTheScreen();
    expect(screen.getByText("방해금지 시간을 00:00-08:00로 설정했어요.")).toBeOnTheScreen();

    await press(stepper("시작").minus);
    expect(updateNowInEnglishQuietHours).toHaveBeenLastCalledWith({ enabled: true, startHour: 23, endHour: 8 });

    await press(stepper("종료").minus);
    expect(updateNowInEnglishQuietHours).toHaveBeenLastCalledWith({ enabled: true, startHour: 23, endHour: 7 });
    expect(stepper("종료").value).toBe("07:00");
    expect(screen.getByText("방해금지 시간을 23:00-07:00로 설정했어요.")).toBeOnTheScreen();

    await press(stepper("종료").plus);
    expect(updateNowInEnglishQuietHours).toHaveBeenLastCalledWith({ enabled: true, startHour: 23, endHour: 8 });
  });

  it.each([
    ["알림 켜기", "알림을 켜지 못했어요", false],
    ["알림 끄기", "알림을 끄지 못했어요", true],
    ["지금부터", "알림 기준을 바꾸지 못했어요", false],
    ["ON", "방해금지 시간을 바꾸지 못했어요", false]
  ] as const)("[spec] '%s'에 실패하면 '%s' Alert를 띄우고(Error는 그 문구, 아니면 기본 문구) 조절을 다시 연다", async (buttonText, title, enabled) => {
    storedSettings = reminderSettings({ enabled });
    const failing = {
      "알림 켜기": enableNowInEnglishReminders,
      "알림 끄기": disableNowInEnglishReminders,
      지금부터: updateNowInEnglishScheduleMode,
      ON: updateNowInEnglishQuietHours
    }[buttonText] as unknown as jest.Mock;
    failing.mockRejectedValueOnce(new Error("알림 권한이 필요해요")).mockRejectedValueOnce("문자열 오류");
    await renderScreen();
    await pressLabel("알림 설정 열기");

    await press(within(openModal()).getByText(buttonText));
    expect(alertSpy).toHaveBeenLastCalledWith(title, "알림 권한이 필요해요");
    expect(within(openModal()).getByText(buttonText)).not.toBeDisabled();

    await press(within(openModal()).getByText(buttonText));
    expect(alertSpy).toHaveBeenLastCalledWith(title, "잠시 후 다시 시도해 주세요.");
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(within(openModal()).getByText(enabled ? "알림 끄기" : "알림 켜기")).toBeOnTheScreen();
    expect(screen.queryByText(/알림을 보내드릴게요|알림을 껐어요|알림을 맞췄어요|방해금지 시간을/)).toBeNull();
  });
});

// ---------- 기록 보기 ----------

describe("[spec] 기록 보기", () => {
  it("[spec] 보기 탭(오늘·어제·전체)마다 제목·개수 문구·타임라인 묶음을 바꾼다", async () => {
    await renderScreen();

    await pressText("어제");
    expect(historyHeader()).toEqual(["어제 남긴 문장", "1개를 남겼어요", "달력"]);
    expect(timelineGroups()).toEqual([["어제", "1개 남겼어요", deviceTime(y1.createdAt), y1.text]]);

    await pressText("전체");
    expect(historyHeader()).toEqual(["영어 조각 기록", "총 6개의 영어 조각", "달력"]);
    expect(timelineGroups()).toEqual([
      ["오늘", "2개 남겼어요", deviceTime(t2.createdAt), t2.text, deviceTime(t1.createdAt), t1.text],
      ["어제", "1개 남겼어요", deviceTime(y1.createdAt), y1.text],
      [
        LABEL_1105,
        "2개 남겼어요",
        deviceTime(p1.createdAt),
        "다듬은 문장",
        "수정 전",
        "I cook pasta.",
        "수정 후",
        "I cooked pasta.",
        deviceTime(o1.createdAt),
        o1.text
      ],
      [LABEL_1020, "1개 남겼어요", deviceTime(c1.createdAt), c1.text]
    ]);

    await pressText("오늘", 0);
    expect(historyHeader()).toEqual(["오늘 남긴 문장", "2개를 남겼어요", "달력"]);
  });

  it("[spec] 탭 글자 순서는 오늘·어제·전체이고, 고른 탭만 강조한다", async () => {
    await renderScreen();
    const tabTexts = () => screen.getByText("전체").parent!.parent!.children.map((tab) => findHost(tab as TestInstance, "Text")[0]);

    expect(tabTexts().map(textOf)).toEqual(["오늘", "어제", "전체"]);
    const activeColor = StyleSheet.flatten(tabTexts()[0].props.style).color;
    const inactiveColor = StyleSheet.flatten(tabTexts()[1].props.style).color;
    expect(activeColor).not.toBe(inactiveColor);

    await pressText("전체");
    expect(tabTexts().map((node) => StyleSheet.flatten(node.props.style).color)).toEqual([
      inactiveColor,
      inactiveColor,
      activeColor
    ]);
  });

  it.each([
    ["오늘", "오늘의 첫 영어 조각을 남겨보세요.", "완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요.", "0개를 남겼어요"],
    ["어제", "어제 남긴 문장이 없어요.", "괜찮아요. 오늘 지금 떠오른 생각부터 다시 한 줄로 꺼내 보면 돼요.", "0개를 남겼어요"],
    ["전체", "아직 쌓인 영어 조각이 없어요.", "완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요.", "총 0개의 영어 조각"]
  ])("[spec] 기록이 없으면 '%s' 탭에 빈 상태 문구를 보인다", async (tab, title, body, meta) => {
    storedEntries = [];
    await renderScreen();
    await pressText(tab, 0);

    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(body)).toBeOnTheScreen();
    expect(historyHeader()[1]).toBe(meta);
    expect(timelineGroups()).toEqual([]);
    expect(screen.queryByText(REFLECTION_KICKER)).toBeNull();
  });

  it("[spec] 달력 창: 이번 달(11월)을 그 달을 덮는 주(일요일 시작)로 채우고, 기록 있는 날에 점을 찍으며 이전/다음 달로 넘긴다", async () => {
    await renderScreen();
    await pressText("달력");

    const modal = openModal();
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe("fade");
    expect(within(modal).getByText(monthLabel(2026, 10))).toBeOnTheScreen();
    expect(within(modal).getByText("일").parent!.children.map((node) => textOf(node as TestInstance))).toEqual([
      "일",
      "월",
      "화",
      "수",
      "목",
      "금",
      "토"
    ]);
    expect(calendarDays()).toEqual([...Array.from({ length: 30 }, (_, index) => index + 1), 1, 2, 3, 4, 5]);
    expect(hasDot(calendarCell(12))).toBe(true);
    expect(hasDot(calendarCell(11))).toBe(true);
    expect(hasDot(calendarCell(5))).toBe(true);
    expect(hasDot(calendarCell(10))).toBe(false);
    expect(hasDot(calendarCell(5, 1))).toBe(false);
    expect(within(modal).getByText("날짜를 누르면 그날 남긴 영어 조각을 바로 볼 수 있어요.")).toBeOnTheScreen();

    await press(within(openModal()).getByText("<"));
    expect(within(openModal()).getByText(monthLabel(2026, 9))).toBeOnTheScreen();
    expect(calendarDays()).toEqual([27, 28, 29, 30, ...Array.from({ length: 31 }, (_, index) => index + 1)]);
    expect(hasDot(calendarCell(20))).toBe(true);
    expect(hasDot(calendarCell(21))).toBe(false);

    await press(within(openModal()).getByText(">"));
    await press(within(openModal()).getByText(">"));
    expect(within(openModal()).getByText(monthLabel(2026, 11))).toBeOnTheScreen();
    expect(calendarDays()).toEqual([29, 30, ...Array.from({ length: 31 }, (_, index) => index + 1), 1, 2]);
  });

  it("[spec] 달력 날짜 칸은 오늘·기록 있음·고른 날·다른 달을 서로 다른 모양으로 그린다", async () => {
    await renderScreen();
    await pressText("달력");
    await press(calendarCell(5));
    await pressText("달력");

    const style = (cell: TestInstance) => StyleSheet.flatten(cell.props.style);
    const plain = style(calendarCell(10));
    const today = style(calendarCell(12));
    const hasEntries = style(calendarCell(11));
    const selected = style(calendarCell(5));
    const outside = style(calendarCell(1, 1));
    expect(new Set([JSON.stringify(plain), JSON.stringify(today), JSON.stringify(hasEntries), JSON.stringify(selected), JSON.stringify(outside)]).size).toBe(5);
  });

  it("[spec] 달력에서 날짜를 누르면 창을 닫고 그 날짜 보기(제목·개수·묶음·돌아보기 카드)로 바꾸며, 탭 강조를 끈다", async () => {
    await renderScreen();
    await pressText("달력");
    await press(calendarCell(5));

    expect(modalHosts()).toHaveLength(0);
    expect(historyHeader()).toEqual([LABEL_1105, "2개를 남겼어요", "달력"]);
    expect(timelineGroups()).toEqual([
      [
        LABEL_1105,
        "2개 남겼어요",
        deviceTime(p1.createdAt),
        "다듬은 문장",
        "수정 전",
        "I cook pasta.",
        "수정 후",
        "I cooked pasta.",
        deviceTime(o1.createdAt),
        o1.text
      ]
    ]);
    expect(screen.getByText(`${LABEL_1105}의 영어 조각`)).toBeOnTheScreen();
    expect(getNowInEnglishAiReflection).toHaveBeenLastCalledWith("2026-11-05");
    const tabs = screen.getByText("전체").parent!.parent!.children.map((tab) => findHost(tab as TestInstance, "Text")[0]);
    const colors = tabs.map((node) => StyleSheet.flatten(node.props.style).color);
    expect(new Set(colors).size).toBe(1);
  });

  it("[spec] 고른 날짜가 있으면 달력을 그 달로 열고, 탭을 누르면 고른 날짜를 지워 이번 달로 연다", async () => {
    await renderScreen();
    await pressText("달력");
    await press(within(openModal()).getByText("<"));
    await press(calendarCell(20));

    expect(historyHeader()).toEqual([LABEL_1020, "1개를 남겼어요", "달력"]);
    await pressText("달력");
    expect(within(openModal()).getByText(monthLabel(2026, 9))).toBeOnTheScreen();
    await press(within(openModal()).getByText("닫기"));

    await pressText("오늘", 0);
    expect(historyHeader()).toEqual(["오늘 남긴 문장", "2개를 남겼어요", "달력"]);
    await pressText("달력");
    expect(within(openModal()).getByText(monthLabel(2026, 10))).toBeOnTheScreen();
  });

  it("[spec] 달력을 넘긴 뒤 닫았다 다시 열면 이번 달로 연다", async () => {
    await renderScreen();
    await pressText("달력");
    await press(within(openModal()).getByText(">"));
    await press(modalBackdrop());
    expect(modalHosts()).toHaveLength(0);

    await pressText("달력");
    expect(within(openModal()).getByText(monthLabel(2026, 10))).toBeOnTheScreen();
    await requestCloseModal();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 달력에서 오늘·어제를 고르면 제목과 돌아보기 이름이 '오늘'·'어제'다", async () => {
    await renderScreen();
    await pressText("달력");
    await press(calendarCell(12));
    expect(historyHeader()).toEqual(["오늘", "2개를 남겼어요", "달력"]);
    expect(screen.getByText("오늘의 영어 조각")).toBeOnTheScreen();

    await pressText("달력");
    await press(calendarCell(11));
    expect(historyHeader()).toEqual(["어제", "1개를 남겼어요", "달력"]);
    expect(screen.getByText("어제의 영어 조각")).toBeOnTheScreen();
  });

  it("[spec] 기록 없는 날(다른 달 칸 포함)을 고르면 그 날짜 빈 상태 문구를 보인다", async () => {
    await renderScreen();
    await pressText("달력");
    await press(calendarCell(1, 1));

    expect(historyHeader()).toEqual([LABEL_1201, "0개를 남겼어요", "달력"]);
    expect(screen.getByText("이 날짜에는 남긴 문장이 없어요.")).toBeOnTheScreen();
    expect(screen.getByText("달력에서 다른 날짜를 골라보거나, 오늘의 한 줄을 새로 남겨보세요.")).toBeOnTheScreen();
    expect(screen.queryByText(REFLECTION_KICKER)).toBeNull();
  });
});

// ---------- 돌아보기 카드 ----------

describe("[spec] 돌아보기 카드", () => {
  it("[spec] 그 날짜 기록(시각 오름차순)을 보이고, 서명이 같은 저장된 돌아보기가 있으면 새로 만들지 않고 쓴다", async () => {
    jest.mocked(getNowInEnglishAiReflection).mockResolvedValue(cachedReflection(TODAY, TODAY_SIGNATURE));
    await renderScreen();

    expect(findHost(reflectionCard(), "Text").map(textOf).slice(0, 3)).toEqual([
      "오늘의 영어 조각",
      "오늘 2개의 순간을 영어로 남겼어요.",
      "그날의 생각이 이렇게 남아 있어요."
    ]);
    expect(reflectionSentences()).toEqual([deviceTime(t1.createdAt), t1.text, deviceTime(t2.createdAt), t2.text]);
    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishAiReflection).toHaveBeenCalledWith(TODAY);
    expect(requestNowInEnglishReflection).not.toHaveBeenCalled();
    expect(saveNowInEnglishAiReflection).not.toHaveBeenCalled();
    expect(within(reflectionAiCard()).getByText("저장해 둔 회고")).toBeOnTheScreen();
  });

  it("[spec] 저장된 것의 서명이 다르면 새로 만들고(불러오는 중 표시), 받은 것을 서명·시각과 함께 저장해 모든 칸을 보인다", async () => {
    jest.mocked(getNowInEnglishAiReflection).mockResolvedValue(cachedReflection(TODAY, "old-signature"));
    const pending = deferred<NowInEnglishReflectionResponse>();
    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(pending.promise);
    await renderScreen();

    expect(jest.mocked(requestNowInEnglishReflection).mock.calls[0]).toStrictEqual([
      {
        dateKey: TODAY,
        forceRefresh: false,
        entries: [
          { text: t1.text, createdAt: t1.createdAt },
          { text: t2.text, createdAt: t2.createdAt }
        ]
      }
    ]);
    expect(findHost(reflectionAiCard(), "Text").map(textOf)).toEqual(["AI 회고", "남긴 문장들을 살펴보고 있어요."]);
    expect(spinners(reflectionAiCard())).toHaveLength(1);
    expect(spinners(reflectionAiCard())[0].props.color).toBe("#EA920D");

    const response = reflectionResponse(TODAY, 2);
    await act(async () => {
      pending.resolve(response);
    });
    await flushAsync();

    expect(saveNowInEnglishAiReflection).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveNowInEnglishAiReflection).mock.calls[0]).toStrictEqual([
      { ...response, entrySignature: TODAY_SIGNATURE, createdAt: NOW.toISOString() }
    ]);
    expect(spinners(reflectionAiCard())).toHaveLength(0);
    expect(findHost(reflectionAiCard(), "Text").map(textOf)).toEqual([
      "AI 회고",
      "점심과 책으로 채운 하루",
      "짧은 문장으로 하루의 장면을 잘 남겼어요.",
      "잘 남긴 점",
      "1",
      "현재진행형을 잘 썼어요.",
      "2",
      "핵심만 짧게 남겼어요.",
      "오늘의 흐름",
      "먹고 읽는 일상 장면이 이어졌어요.",
      "가볍게 다듬기",
      "a book 대신 my book도 자연스러워요.",
      "다음에 살 붙여보기",
      "왜 그 일을 했는지 한 문장 더 붙여 보세요.",
      "I am reading a book because I want to relax.",
      "다음에 써먹을 표현",
      "grab a bite",
      "저장",
      "간단히 먹다",
      "I grabbed a bite at noon.",
      "curl up with a book",
      "저장",
      "내일도 한 줄 남겨 봐요."
    ]);
    expect(screen.getByText("오늘도 한 줄 남기기")).toBeOnTheScreen();
  });

  it("[spec] 돌아보기의 빈 칸(잘 남긴 점·흐름·다듬기·다음 행동·예문·표현·마무리)은 숨긴다", async () => {
    jest.mocked(requestNowInEnglishReflection).mockResolvedValueOnce(
      reflectionResponse(TODAY, 2, {
        highlightsKo: [],
        patternKo: "",
        gentleCorrectionKo: "",
        nextActionKo: "",
        nextActionExampleEn: "예문만 있음",
        expressions: [],
        closingKo: ""
      })
    );
    await renderScreen();

    expect(findHost(reflectionAiCard(), "Text").map(textOf)).toEqual([
      "AI 회고",
      "점심과 책으로 채운 하루",
      "짧은 문장으로 하루의 장면을 잘 남겼어요."
    ]);
  });

  it("[spec] 다음 행동이 있고 예문이 비면 예문 줄만 숨긴다", async () => {
    jest.mocked(requestNowInEnglishReflection).mockResolvedValueOnce(reflectionResponse(TODAY, 2, { nextActionExampleEn: "" }));
    await renderScreen();

    const texts = findHost(reflectionAiCard(), "Text").map(textOf);
    expect(texts).toContain("다음에 살 붙여보기");
    expect(texts).not.toContain("I am reading a book because I want to relax.");
  });

  it.each([
    [new Error("회고 서버 오류"), "회고 서버 오류"],
    ["문자열 오류", "AI 회고를 불러오지 못했어요."]
  ])("[spec] 새로 만들기에 실패하고(%p) 저장된 것도 없으면 안내·오류·문제 보내기를 보인다", async (error, message) => {
    jest.mocked(requestNowInEnglishReflection).mockRejectedValueOnce(error);
    await renderScreen();

    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(2);
    expect(spinners(reflectionAiCard())).toHaveLength(0);
    expect(findHost(reflectionAiCard(), "Text").map(textOf)).toEqual([
      "AI 회고",
      "이 날의 기록을 AI가 짧게 돌아봐 줄 수 있어요.",
      message,
      PROBLEM_LINK_TEXT
    ]);

    await pressText(PROBLEM_LINK_TEXT);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/support-feedback",
      params: { source: "now_reflection", errorCode: "NOW_REFLECTION_ERROR", category: "BUG" }
    });
  });

  it("[spec] 새로 만들기에 실패해도 다시 읽은 저장본의 서명이 같으면 그것과 오류를 함께 보인다", async () => {
    jest
      .mocked(getNowInEnglishAiReflection)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cachedReflection(TODAY, TODAY_SIGNATURE, "다시 읽은 회고"));
    jest.mocked(requestNowInEnglishReflection).mockRejectedValueOnce(new Error("회고 서버 오류"));
    await renderScreen();

    expect(within(reflectionAiCard()).getByText("다시 읽은 회고")).toBeOnTheScreen();
    expect(within(reflectionAiCard()).getByText("회고 서버 오류")).toBeOnTheScreen();
  });

  it("[spec] 보는 날짜가 바뀌면 그 날짜로 다시 확인하고, 날짜가 없는 전체 보기에서는 카드를 숨긴다", async () => {
    jest
      .mocked(requestNowInEnglishReflection)
      .mockImplementation(async (request) => reflectionResponse(request.dateKey, request.entries.length, { headlineKo: `${request.dateKey} 회고` }));
    await renderScreen();
    expect(within(reflectionAiCard()).getByText(`${TODAY} 회고`)).toBeOnTheScreen();

    await pressText("어제");
    expect(getNowInEnglishAiReflection).toHaveBeenLastCalledWith(YESTERDAY);
    expect(jest.mocked(requestNowInEnglishReflection).mock.calls.at(-1)).toStrictEqual([
      { dateKey: YESTERDAY, forceRefresh: false, entries: [{ text: y1.text, createdAt: y1.createdAt }] }
    ]);
    expect(findHost(reflectionCard(), "Text").map(textOf).slice(0, 2)).toEqual([
      "어제의 영어 조각",
      "어제 1개의 순간을 영어로 남겼어요."
    ]);
    expect(within(reflectionAiCard()).getByText(`${YESTERDAY} 회고`)).toBeOnTheScreen();

    const callsBeforeAll = jest.mocked(getNowInEnglishAiReflection).mock.calls.length;
    await pressText("전체");
    expect(screen.queryByText(REFLECTION_KICKER)).toBeNull();
    expect(screen.queryByText("AI 회고")).toBeNull();
    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(callsBeforeAll);

    await pressText("오늘", 0);
    expect(getNowInEnglishAiReflection).toHaveBeenLastCalledWith(TODAY);
    expect(within(reflectionAiCard()).getByText(`${TODAY} 회고`)).toBeOnTheScreen();
  });

  it("[spec] 받는 사이 날짜가 바뀌면 앞 날짜의 늦은 응답은 화면에 두지 않는다(받은 것은 저장한다)", async () => {
    const todayPending = deferred<NowInEnglishReflectionResponse>();
    jest
      .mocked(requestNowInEnglishReflection)
      .mockImplementation(async (request) => reflectionResponse(request.dateKey, request.entries.length, { headlineKo: `${request.dateKey} 회고` }));
    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(todayPending.promise);
    await renderScreen();
    expect(spinners(reflectionAiCard())).toHaveLength(1);

    await pressText("어제");
    expect(within(reflectionAiCard()).getByText(`${YESTERDAY} 회고`)).toBeOnTheScreen();
    expect(spinners(reflectionAiCard())).toHaveLength(0);

    await act(async () => {
      todayPending.resolve(reflectionResponse(TODAY, 2, { headlineKo: "늦은 오늘 회고" }));
    });
    await flushAsync();

    expect(screen.queryByText("늦은 오늘 회고")).toBeNull();
    expect(within(reflectionAiCard()).getByText(`${YESTERDAY} 회고`)).toBeOnTheScreen();
    expect(saveNowInEnglishAiReflection).toHaveBeenCalledWith(
      expect.objectContaining({ dateKey: TODAY, headlineKo: "늦은 오늘 회고", entrySignature: TODAY_SIGNATURE })
    );
  });

  it("[spec] 받는 사이 날짜가 바뀌면 앞 날짜의 늦은 오류도 화면에 두지 않는다", async () => {
    const todayPending = deferred<NowInEnglishReflectionResponse>();
    jest
      .mocked(requestNowInEnglishReflection)
      .mockImplementation(async (request) => reflectionResponse(request.dateKey, request.entries.length, { headlineKo: `${request.dateKey} 회고` }));
    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(todayPending.promise);
    await renderScreen();
    await pressText("어제");

    await act(async () => {
      todayPending.reject(new Error("늦은 오류"));
    });
    await flushAsync();

    expect(screen.queryByText("늦은 오류")).toBeNull();
    expect(within(reflectionAiCard()).getByText(`${YESTERDAY} 회고`)).toBeOnTheScreen();
    expect(spinners(reflectionAiCard())).toHaveLength(0);
  });

  it("[spec] 다른 날짜를 받는 동안에는 앞 날짜의 돌아보기를 그대로 둔 채 불러오는 중 표시를 한다", async () => {
    await renderScreen();
    expect(within(reflectionAiCard()).getByText("점심과 책으로 채운 하루")).toBeOnTheScreen();
    const yesterdayPending = deferred<NowInEnglishReflectionResponse>();
    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(yesterdayPending.promise);
    await pressText("어제");

    expect(screen.getByText("어제의 영어 조각")).toBeOnTheScreen();
    expect(within(reflectionAiCard()).getByText("점심과 책으로 채운 하루")).toBeOnTheScreen();
    expect(spinners(reflectionAiCard())).toHaveLength(1);

    await act(async () => {
      yesterdayPending.resolve(reflectionResponse(YESTERDAY, 1, { headlineKo: "어제 회고" }));
    });
    await flushAsync();
    expect(within(reflectionAiCard()).getByText("어제 회고")).toBeOnTheScreen();
    expect(within(reflectionAiCard()).queryByText("점심과 책으로 채운 하루")).toBeNull();
  });

  it("[spec] 그 날짜 기록 목록이 바뀌면(새로 저장, 다시 받은 목록) 그때마다 다시 확인한다", async () => {
    await renderScreen();
    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(1);
    expect(requestNowInEnglishReflection).toHaveBeenCalledTimes(1);
    const refresh = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(refresh.promise);

    await saveText("I am walking.");

    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(2);
    expect(requestNowInEnglishReflection).toHaveBeenCalledTimes(2);
    expect(jest.mocked(requestNowInEnglishReflection).mock.calls.at(-1)).toStrictEqual([
      {
        dateKey: TODAY,
        forceRefresh: false,
        entries: [
          { text: t1.text, createdAt: t1.createdAt },
          { text: t2.text, createdAt: t2.createdAt },
          { text: "I am walking.", createdAt: NOW.toISOString() }
        ]
      }
    ]);
    expect(screen.getByText("오늘 3개의 순간을 영어로 남겼어요.")).toBeOnTheScreen();

    // 다시 받은 목록은 내용이 같아도 새 목록이라 한 번 더 확인한다.
    await act(async () => {
      refresh.resolve(summaryOf(storedEntries, storedSettings));
    });
    await flushAsync();
    expect(getNowInEnglishAiReflection).toHaveBeenCalledTimes(3);
    expect(requestNowInEnglishReflection).toHaveBeenCalledTimes(3);
    expect(jest.mocked(requestNowInEnglishReflection).mock.calls[2]).toStrictEqual(
      jest.mocked(requestNowInEnglishReflection).mock.calls[1]
    );
  });

  it("[spec] 그 날짜 기록이 없으면 카드를 숨기고 확인하지 않는다", async () => {
    storedEntries = [t1, t2];
    await renderScreen();
    await pressText("어제");

    expect(screen.queryByText(REFLECTION_KICKER)).toBeNull();
    expect(getNowInEnglishAiReflection).not.toHaveBeenCalledWith(YESTERDAY);
  });

  it("[spec] 오늘도 한 줄 남기기: 오늘 보기로 바꾸고 입력칸에 초점을 준다", async () => {
    await renderScreen();
    await pressText("어제");
    textInputFocus.mockClear();
    await pressText("오늘도 한 줄 남기기");

    expect(historyHeader()).toEqual(["오늘 남긴 문장", "2개를 남겼어요", "달력"]);
    expect(textInputFocus).toHaveBeenCalledTimes(1);
    expect((textInputFocus.mock.contexts[0] as { props: { placeholder: string } }).props.placeholder).toBe(MAIN_PLACEHOLDER);
  });

  it("[spec] 표현 저장: 저장 중에는 '저장 중'으로 막히고, 저장 뒤 '저장됨'(저장한 표현 취소), 다시 누르면 지운다", async () => {
    await renderScreen();
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValueOnce(pending.promise);
    await press(reflectionSaveButtons()[0]);

    expect(jest.mocked(saveExpression).mock.calls[0]).toStrictEqual([
      {
        expression: "grab a bite",
        meaningKo: "간단히 먹다",
        usageTipKo: "점심 이야기에",
        exampleEn: "I grabbed a bite at noon.",
        sourceType: "COACH_RECOMMENDATION"
      }
    ]);
    expect(reflectionSaveState()[0]).toEqual(["표현 저장", "저장 중"]);
    expect(reflectionSaveButtons()[0]).toBeDisabled();
    expect(reflectionSaveButtons()[1]).not.toBeDisabled();

    await act(async () => {
      pending.resolve(savedExpression(77, "grab a bite"));
    });
    await flushAsync();
    expect(reflectionSaveState()[0]).toEqual(["저장한 표현 취소", "저장됨"]);
    expect(reflectionSaveButtons()[0]).not.toBeDisabled();

    await press(reflectionSaveButtons()[0]);
    expect(deleteSavedExpression).toHaveBeenCalledWith(77);
    expect(reflectionSaveState()[0]).toEqual(["표현 저장", "저장"]);
  });

  it("[spec] 표현 저장: 빈 뜻·팁·예문은 보내지 않는다(undefined)", async () => {
    await renderScreen();
    await press(reflectionSaveButtons()[1]);

    expect(jest.mocked(saveExpression).mock.calls[0]).toStrictEqual([
      {
        expression: "curl up with a book",
        meaningKo: undefined,
        usageTipKo: undefined,
        exampleEn: undefined,
        sourceType: "COACH_RECOMMENDATION"
      }
    ]);
  });

  it.each([
    [new Error("표현 서버 오류"), "표현 서버 오류"],
    ["문자열 오류", "잠시 후 다시 시도해 주세요."]
  ])("[spec] 표현 저장·취소에 실패하면(%p) Alert를 띄우고 표시를 그대로 둔다", async (error, message) => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(31, "grab a bite")]);
    jest.mocked(saveExpression).mockRejectedValueOnce(error);
    jest.mocked(deleteSavedExpression).mockRejectedValueOnce(error);
    await renderScreen();

    await press(reflectionSaveButtons()[1]);
    expect(alertSpy).toHaveBeenLastCalledWith("표현 저장에 실패했어요", message);
    expect(reflectionSaveState()[1]).toEqual(["표현 저장", "저장"]);

    await press(reflectionSaveButtons()[0]);
    expect(deleteSavedExpression).toHaveBeenCalledWith(31);
    expect(alertSpy).toHaveBeenLastCalledWith("표현 저장에 실패했어요", message);
    expect(reflectionSaveState()[0]).toEqual(["저장한 표현 취소", "저장됨"]);
  });

  it("[spec] 로그인하지 않았으면 표현 저장 대신 로그인 안내 Alert를 띄우고, 로그인하기를 누르면 로그인 화면으로 간다", async () => {
    setSessionUser(null);
    await renderScreen();
    await press(reflectionSaveButtons()[0]);

    expect(saveExpression).not.toHaveBeenCalled();
    const alert = lastAlert();
    expect(alert.title).toBe("로그인이 필요해요");
    expect(alert.message).toBe("표현 저장은 로그인 후 사용할 수 있어요.");
    expect(alert.buttons!.map((button) => [button.text, button.style])).toEqual([
      ["취소", "cancel"],
      ["로그인하기", undefined]
    ]);

    await pressAlertButton("로그인하기");
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});

// ---------- 화면 구조 ----------

describe("[spec] 화면 구조(문구·구조·접근성 속성)", () => {
  it("[spec] 불러오는 중", async () => {
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(new Promise(() => undefined));
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 불러온 뒤(오늘 보기, 돌아보기 결과, 알림 켜짐)", async () => {
    storedSettings = reminderSettings({ enabled: true });
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 전체 보기(다듬은 문장 비교 포함), 알림 꺼짐", async () => {
    await renderScreen();
    await pressText("전체");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 바로 코치 결과와 입력 중(말풍선 없음)", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await typeInto(mainInput(), "Next line.");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 바로 코치 불러오는 중과 저장 중", async () => {
    jest.mocked(requestNowInEnglishCoachFeedback).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    await saveText("I am walking.");
    jest.mocked(saveNowInEnglishEntry).mockReturnValueOnce(new Promise(() => undefined));
    await saveText("I am running.");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 바로 코치 오류와 다듬기 중", async () => {
    jest.mocked(requestNowInEnglishCoachFeedback).mockRejectedValueOnce(new Error("코치 서버 오류"));
    await renderScreen();
    await saveText("I am walking.");
    await pressText("수정해보기");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 돌아보기 오류(어제 보기)", async () => {
    await renderScreen();
    jest.mocked(requestNowInEnglishReflection).mockRejectedValueOnce(new Error("회고 서버 오류"));
    await pressText("어제");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 다른 날짜 돌아보기를 받는 중(앞 날짜 돌아보기가 남은 채), 저장된 표현 표시", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(31, "grab a bite")]);
    await renderScreen();
    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(new Promise(() => undefined));
    await pressText("달력");
    await press(calendarCell(5));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 기록 없음(오늘 보기)과 불러오기 실패", async () => {
    jest.mocked(getNowInEnglishSummary).mockRejectedValueOnce(new Error("저장소 오류"));
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 알림 설정 창(꺼짐, 방해금지 켜짐)", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 알림 설정 창(켜짐, 지금부터, 방해금지 꺼짐, 12시간)", async () => {
    storedSettings = reminderSettings({
      enabled: true,
      intervalHours: 12,
      scheduleMode: "FROM_NOW",
      quietHours: { enabled: false, startHour: 22, endHour: 7 },
      updatedAt: NOW.toISOString()
    });
    await renderScreen();
    await pressLabel("알림 설정 열기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 알림 설정 창(바꾸는 중, 1시간)", async () => {
    storedSettings = reminderSettings({ intervalHours: 1 });
    jest.mocked(enableNowInEnglishReminders).mockReturnValueOnce(new Promise(() => undefined));
    await renderScreen();
    await pressLabel("알림 설정 열기");
    await press(within(openModal()).getByText("알림 켜기"));

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(처음)", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(답)", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "피곤하다를 어떻게 말해?");
    await pressText("코치에게 물어보기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(묻는 중)", async () => {
    jest.mocked(requestCoachHelp).mockReturnValueOnce(new Promise(() => undefined));
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await typeInto(coachInput(), "피곤하다를 어떻게 말해?");
    await pressText("코치에게 물어보기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(오류)", async () => {
    await renderScreen();
    await pressLabel("AI 코치 열기");
    await pressText("코치에게 물어보기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 월 달력 창(이번 달, 고른 날짜)", async () => {
    await renderScreen();
    await pressText("달력");
    await press(calendarCell(5));
    await pressText("달력");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 월 달력 창(이전 달)", async () => {
    await renderScreen();
    await pressText("달력");
    await press(within(openModal()).getByText("<"));

    expect(structureOf(openModal())).toMatchSnapshot();
  });
});
