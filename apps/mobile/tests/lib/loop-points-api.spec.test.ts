// [spec] qa 테스트(작업 086-④ 적립 알림, 새 기능, 모바일): 모바일 API 층이 서버 응답의 loopPoints를 버리지 않는지.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/05-적립-알림/02-qa-scenarios-mobile.md의 N1·N2)에서만 가져온다.
// 보충(QA·DA): 시나리오 Q1·D1은 화면 테스트에서 API를 가짜로 두고 "완료 API·피드백 API가 loopPoints를 담아 돌려준다"를 입력으로 쓴다.
// 실제 API 함수가 그 값을 넘기는지는 화면 테스트로 보이지 않으므로, 같은 값으로 completeFeedbackSession·requestDiaryFeedback도 본다
// (명세: "안내는 그 완료 응답의 loopPoints로 정한다", "일기 피드백을 받으면 그 피드백 결과 맨 위에 안내").
// 구현 코드(apps/mobile/src/lib/api.ts)는 함수 이름과 인자를 알려고만 읽었다.
// 네트워크는 전역 fetch를 가짜로 바꿔 실제 서버에 닿지 않는다(home-shopping-api.spec.test.ts와 같은 틀).
import * as SecureStore from "expo-secure-store";
import { completeFeedbackSession, createNowInEnglishEntry, requestDiaryFeedback } from "@/lib/api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const ACCESS_TOKEN = "access-token-086-4";

type FakeResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function respond(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      if (body === undefined) throw new SyntaxError("no body");
      return JSON.parse(JSON.stringify(body));
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body))
  };
}

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
    if (key === "writeloop_access_token") return ACCESS_TOKEN;
    return null;
  });
});

// ---------- 시나리오 0절 값 ----------

const N_EARNED = { activity: "nowInEnglish", earned: 10, balance: 270, dailyLimitReached: false };
const N_LIMIT = { activity: "nowInEnglish", earned: 0, balance: 270, dailyLimitReached: true };
const Q_EARNED = { activity: "question", earned: 30, balance: 260, dailyLimitReached: false };
const D_EARNED = { activity: "diary", earned: 30, balance: 260, dailyLimitReached: false };

const NOW_REQUEST = {
  id: "now-1",
  text: "I am reading a book.",
  createdAt: "2026-11-12T03:00:00.000Z",
  dateKey: "2026-11-12"
};

function nowEntryBody(loopPoints: unknown) {
  return {
    id: "now-1",
    text: "I am reading a book.",
    polishedFromEntryId: null,
    polishedFromText: null,
    createdAt: "2026-11-12T03:00:00.000Z",
    dateKey: "2026-11-12",
    loopPoints
  };
}

function diaryFeedbackBody(loopPoints: unknown) {
  return {
    schemaVersion: "diary-feedback-v1",
    entryId: "entry-1",
    attemptNo: 1,
    score: 72,
    finishable: true,
    diaryAnswerBand: "DIARY_CLEAR_BASIC",
    summaryKo: "흐름이 자연스러워요.",
    strengths: ["시간 순서가 분명해요."],
    fixPoints: [],
    diaryFlow: { timeFlow: "", emotion: "", detail: "", reflection: "", commentKo: "", connectionTips: [] },
    rewriteIdeas: [],
    usedDiaryExpressions: [],
    diaryExpressions: [],
    nextDiaryMission: { focus: "", titleKo: "", instructionKo: "" },
    safetyFlags: [],
    loopPoints
  };
}

describe("[spec] 086-④ 지금 영어로 저장 API는 loopPoints를 버리지 않는다(N1·N2)", () => {
  test("N1 서버 저장 응답의 loopPoints(적립 10)가 돌아온 값에 그대로 있다", async () => {
    fetchMock.mockResolvedValue(respond(200, nowEntryBody(N_EARNED)));

    const saved = await createNowInEnglishEntry(NOW_REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/now-in-english/entries");
    expect((init?.method ?? "GET").toUpperCase()).toBe("POST");
    expect(saved?.loopPoints).toEqual({ activity: "nowInEnglish", earned: 10, balance: 270, dailyLimitReached: false });
  });

  test("N2 서버 저장 응답의 loopPoints(한도)가 돌아온 값에 그대로 있다", async () => {
    fetchMock.mockResolvedValue(respond(200, nowEntryBody(N_LIMIT)));

    const saved = await createNowInEnglishEntry(NOW_REQUEST);

    expect(saved?.loopPoints).toEqual({ activity: "nowInEnglish", earned: 0, balance: 270, dailyLimitReached: true });
  });
});

describe("[spec] 086-④ 보충: 질문 완료·일기 피드백 API도 loopPoints를 넘긴다(Q1·D1의 API 층)", () => {
  test("QA 완료 API는 응답의 loopPoints(적립 30)를 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, { sessionId: "session-1", status: "COMPLETED", loopPoints: Q_EARNED }));

    const finished = await completeFeedbackSession("session-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/feedback/session-1/complete");
    expect((init?.method ?? "GET").toUpperCase()).toBe("POST");
    expect(finished.loopPoints).toEqual({ activity: "question", earned: 30, balance: 260, dailyLimitReached: false });
    expect(finished.status).toBe("COMPLETED");
  });

  test("DA 일기 피드백 API는 응답의 loopPoints(적립 30)를 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, diaryFeedbackBody(D_EARNED)));

    const feedback = await requestDiaryFeedback("entry-1", { bodyText: "Today I walked.", attemptType: "INITIAL" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/diary/entries/entry-1/feedback");
    expect((init?.method ?? "GET").toUpperCase()).toBe("POST");
    expect(feedback.loopPoints).toEqual({ activity: "diary", earned: 30, balance: 260, dailyLimitReached: false });
    expect(feedback.summaryKo).toBe("흐름이 자연스러워요.");
    expect(feedback.score).toBe(72);
  });
});
