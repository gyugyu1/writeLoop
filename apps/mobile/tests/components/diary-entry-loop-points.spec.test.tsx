// [spec] qa 테스트(작업 086-④ 적립 알림, 새 기능, 모바일): 영어일기 피드백 결과 맨 위의 룹 적립 안내.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/05-적립-알림/02-qa-scenarios-mobile.md 2절 D1~D9)와
// 결정 파일(04-main-decision.md 2번: 안내는 그 피드백이 보이는 동안('다시 써보기' 중 포함) 남고, '새 일기'로 피드백이 사라지면
// 함께 사라진다 → D8, D10)에서만 가져온다.
// 영어일기 화면(src/components/diary-entry-screen.tsx의 DiaryEntryScreen)을 렌더하고 사용자처럼 누른다. 구현 코드는 화면 이름과
// 속성(initialEntryId), 버튼 문구를 알려고만 읽었다.
// 가짜로 두는 것: API(@/lib/api), 이 기기 임시저장(@/lib/diary-drafts), 로그인 상태(@/lib/session), 라우터, Alert(spyOn),
// 네이티브 모듈(expo-symbols, 안전 영역). 날짜가 오늘에 기대므로 가짜 시계(2026-11-12T03:00:00Z)로 돌린다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, AppState, type AppStateStatus } from "react-native";
import type { TestInstance } from "test-renderer";
import DiaryEntryScreen from "@/components/diary-entry-screen";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  deleteSavedExpression,
  getDiaryEntry,
  getSavedExpressions,
  requestCoachHelp,
  requestDiaryFeedback,
  saveExpression,
  updateDiaryEntry
} from "@/lib/api";
import { deleteDiaryDraft, getDiaryDraft, saveDiaryDraft } from "@/lib/diary-drafts";
import { useSession } from "@/lib/session";
import type { AuthUser, DiaryEntry, DiaryFeedback, LoopPointsReward } from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() }
}));
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
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => ({
  createDiaryEntry: jest.fn(),
  deleteDiaryEntry: jest.fn(),
  deleteSavedExpression: jest.fn(),
  getDiaryEntry: jest.fn(),
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestDiaryFeedback: jest.fn(),
  saveExpression: jest.fn(),
  updateDiaryEntry: jest.fn()
}));
jest.mock("@/lib/diary-drafts", () => ({
  deleteDiaryDraft: jest.fn(),
  getDiaryDraft: jest.fn(),
  saveDiaryDraft: jest.fn()
}));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const signedInUser: AuthUser = { id: 864, email: "diary-loop@example.com", displayName: "학습자", admin: false };

// 시나리오 0절의 loopPoints 값
const D_EARNED: LoopPointsReward = { activity: "diary", earned: 30, balance: 260, dailyLimitReached: false };
const D_LIMIT: LoopPointsReward = { activity: "diary", earned: 0, balance: 260, dailyLimitReached: true };
const D_NEITHER: LoopPointsReward = { activity: "diary", earned: 0, balance: 260, dailyLimitReached: false };

const EARNED_30 = "+30룹 쌓였어요";
const LIMIT_DIARY = "오늘 영어일기 룹은 다 모았어요";
const ANY_EARNED = /룹 쌓였어요/;
const ANY_LIMIT = /룹은 다 모았어요/;

// 첫 피드백: 제목 문구(DIARY_FLOW_THIN의 제목), 점수 84, 요약.
const FIRST_HEADLINE = "일기의 흐름을 더 살릴 수 있어요";
const FIRST_SCORE = "84";
const FIRST_SUMMARY = "하루의 흐름이 잘 보여요.";
// 두 번째 피드백(다시 쓰기)
const SECOND_SUMMARY = "다시 쓴 일기가 더 자연스러워요.";
// 다른 일기 B의 지난 피드백
const OTHER_SUMMARY = "다른 일기의 지난 피드백이에요.";

function makeFeedback(overrides: Partial<DiaryFeedback> = {}): DiaryFeedback {
  return {
    schemaVersion: "diary-feedback-v1",
    entryId: "entry-new",
    attemptNo: 1,
    score: 84,
    finishable: true,
    diaryAnswerBand: "DIARY_FLOW_THIN",
    summaryKo: FIRST_SUMMARY,
    strengths: [],
    fixPoints: [],
    diaryFlow: { timeFlow: "", emotion: "", detail: "", reflection: "", commentKo: "", connectionTips: [] },
    rewriteIdeas: [],
    usedDiaryExpressions: [],
    diaryExpressions: [],
    nextDiaryMission: { focus: "", titleKo: "", instructionKo: "" },
    safetyFlags: [],
    ...overrides
  };
}

function withLoopPoints(loopPoints: LoopPointsReward | null) {
  return makeFeedback({ loopPoints });
}

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    entryId: "entry-new",
    title: "",
    content: "I went to the park.",
    language: "en",
    entryDate: "2026-11-12",
    mood: null,
    tags: [],
    draft: true,
    createdAt: "2026-11-12T03:00:00.000Z",
    updatedAt: "2026-11-12T03:00:00.000Z",
    attempts: [],
    ...overrides
  };
}

// 다른 일기 B: 피드백이 있는 임시 저장 일기. 불러온 피드백에는 loopPoints가 없다.
const otherEntry = makeEntry({
  entryId: "entry-b",
  title: "Other day",
  content: "I read a book.",
  entryDate: "2026-11-10",
  attempts: [
    {
      id: 1,
      attemptNo: 1,
      diaryText: "I read a book.",
      score: 66,
      feedback: makeFeedback({ entryId: "entry-b", score: 66, diaryAnswerBand: "DIARY_CLEAR_BASIC", summaryKo: OTHER_SUMMARY }),
      createdAt: "2026-11-10T00:00:00.000Z"
    }
  ]
});

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;

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

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function textInputs() {
  return screen.root!.queryAll((instance) => instance.type === "TextInput");
}

// 편집 화면의 입력 칸 순서: 날짜, 제목, 본문.
function bodyInput() {
  return textInputs()[2];
}

async function pressText(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

async function typeInto(input: TestInstance, value: string) {
  await fireEvent.changeText(input, value);
  await flushAsync();
}

// 화면에 그려진 글자를 그려진 순서대로 모은다.
function textsInOrder() {
  return screen
    .root!.queryAll((instance) => instance.type === "Text")
    .map((node) => node.children.filter((child): child is string => typeof child === "string").join(""));
}

function expectNoNotice() {
  expect(screen.queryAllByText(ANY_EARNED)).toHaveLength(0);
  expect(screen.queryAllByText(ANY_LIMIT)).toHaveLength(0);
}

// 새 일기에서 본문을 쓰고 첫 피드백을 받는다.
async function getFirstFeedback(feedback: DiaryFeedback) {
  jest.mocked(requestDiaryFeedback).mockResolvedValueOnce(feedback);
  const view = await render(<DiaryEntryScreen />);
  await flushAsync();
  await typeInto(bodyInput(), "I went to the park.");
  await pressText("AI 피드백 받기");
  expect(requestDiaryFeedback).toHaveBeenLastCalledWith("entry-new", {
    bodyText: "I went to the park.",
    attemptType: "INITIAL"
  });
  return view;
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(((
    _type: string,
    _listener: (state: AppStateStatus) => void
  ) => ({ remove: jest.fn() })) as unknown as typeof AppState.addEventListener);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getDiaryEntry).mockReset().mockResolvedValue(otherEntry);
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(createDiaryEntry).mockReset().mockResolvedValue(makeEntry());
  jest.mocked(updateDiaryEntry).mockReset().mockImplementation(async (entryId) => makeEntry({ entryId }));
  jest.mocked(deleteDiaryEntry).mockReset().mockResolvedValue(undefined);
  jest.mocked(requestDiaryFeedback).mockReset();
  jest.mocked(requestCoachHelp).mockReset();
  jest.mocked(saveExpression).mockReset();
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  jest.mocked(getDiaryDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveDiaryDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteDiaryDraft).mockReset().mockResolvedValue(undefined);
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 2절 ----------

describe("[spec] 086-④ 영어일기 피드백 결과 맨 위의 룹 적립 안내(시나리오 2절)", () => {
  it("[spec] D1 첫 피드백이 적립 30이면 '+30룹 쌓였어요'가 보이고, 피드백 결과의 제목·점수·요약보다 먼저 그려진다", async () => {
    await getFirstFeedback(withLoopPoints(D_EARNED));

    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();
    const texts = textsInOrder();
    const noticeIndex = texts.indexOf(EARNED_30);
    expect(noticeIndex).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf(FIRST_HEADLINE)).toBeGreaterThan(noticeIndex);
    expect(texts.indexOf(FIRST_SCORE)).toBeGreaterThan(noticeIndex);
    expect(texts.indexOf(FIRST_SUMMARY)).toBeGreaterThan(noticeIndex);
  });

  it("[spec] D2 첫 피드백이 한도(적립 0)면 '오늘 영어일기 룹은 다 모았어요'가 보이고 적립 문구는 없다", async () => {
    await getFirstFeedback(withLoopPoints(D_LIMIT));

    expect(screen.getByText(LIMIT_DIARY)).toBeOnTheScreen();
    expect(screen.queryAllByText(ANY_EARNED)).toHaveLength(0);
  });

  it("[spec] D3 첫 피드백의 loopPoints가 null이면 안내가 없고 피드백 결과(요약)는 보인다", async () => {
    await getFirstFeedback(withLoopPoints(null));

    expectNoNotice();
    expect(screen.getByText(FIRST_SUMMARY)).toBeOnTheScreen();
  });

  it("[spec] D4 피드백 응답에 loopPoints 키가 없으면 안내가 없다", async () => {
    await getFirstFeedback(makeFeedback());

    expectNoNotice();
    expect(screen.getByText(FIRST_SUMMARY)).toBeOnTheScreen();
  });

  it("[spec] D5 적립 0이고 한도도 아니면 안내가 없다", async () => {
    await getFirstFeedback(withLoopPoints(D_NEITHER));

    expectNoNotice();
  });

  it("[spec] D6 같은 일기의 다시 쓰기 피드백이 null이면 '+30룹 쌓였어요'가 사라지고 새 피드백이 보인다", async () => {
    await getFirstFeedback(withLoopPoints(D_EARNED));
    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();

    await pressText("다시 써보기");
    await typeInto(bodyInput(), "I went to the park and felt calm.");
    jest
      .mocked(requestDiaryFeedback)
      .mockResolvedValueOnce(makeFeedback({ attemptNo: 2, summaryKo: SECOND_SUMMARY, loopPoints: null }));
    await pressText("다시 쓴 일기 피드백 받기");

    expect(requestDiaryFeedback).toHaveBeenLastCalledWith("entry-new", {
      bodyText: "I went to the park and felt calm.",
      attemptType: "REWRITE"
    });
    expect(screen.getByText(SECOND_SUMMARY)).toBeOnTheScreen();
    expectNoNotice();
  });

  it("[spec] D7 일기 A에서 안내를 본 뒤 다른 일기 B를 열면 B의 피드백은 보이고 안내는 없다", async () => {
    // 일기 A를 연 화면에서 첫 피드백을 받는다(A는 피드백이 없는 임시 저장 일기).
    jest.mocked(getDiaryEntry).mockResolvedValueOnce(makeEntry({ entryId: "entry-a" }));
    jest.mocked(requestDiaryFeedback).mockResolvedValueOnce(makeFeedback({ entryId: "entry-a", loopPoints: D_EARNED }));
    await render(<DiaryEntryScreen initialEntryId="entry-a" />);
    await flushAsync();
    await pressText("AI 피드백 받기");
    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();

    jest.mocked(getDiaryEntry).mockResolvedValueOnce(otherEntry);
    await screen.rerender(<DiaryEntryScreen initialEntryId="entry-b" />);
    await flushAsync();

    expect(getDiaryEntry).toHaveBeenLastCalledWith("entry-b");
    expect(screen.getByText(OTHER_SUMMARY)).toBeOnTheScreen();
    expectNoNotice();
  });

  it("[spec] D8(04 결정 2) '새 일기'로 넘어가 피드백이 사라지면 안내도 사라진다", async () => {
    await getFirstFeedback(withLoopPoints(D_EARNED));
    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();

    await pressText("새 일기");

    expect(router.replace).toHaveBeenCalledWith("/diary/write");
    expectNoNotice();
  });

  it("[spec] D9 피드백 API가 실패하면 '피드백 실패' 알림을 띄우고 안내가 없다", async () => {
    jest.mocked(requestDiaryFeedback).mockRejectedValueOnce(new Error("피드백 서버 오류"));
    await render(<DiaryEntryScreen />);
    await flushAsync();
    await typeInto(bodyInput(), "I went to the park.");
    await pressText("AI 피드백 받기");

    expect(alertSpy).toHaveBeenCalledWith("피드백 실패", "피드백 서버 오류");
    expectNoNotice();
  });

  it("[spec] D10(04 결정 2) 첫 피드백의 안내는 '다시 써보기' 중에도 그 피드백이 보이는 동안 남는다", async () => {
    await getFirstFeedback(withLoopPoints(D_EARNED));
    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();

    await pressText("다시 써보기");

    expect(screen.getByText(FIRST_SUMMARY)).toBeOnTheScreen();
    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();
  });
});
