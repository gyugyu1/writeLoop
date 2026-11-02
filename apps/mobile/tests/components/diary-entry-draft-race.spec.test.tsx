// [spec] qa 재현 테스트(작업 049 버그 수정 APP-ETC-103: 새 일기 저장 직후 늦게 끝난 자동 저장이 새 일기 임시본을 되살리는 버그).
// 영어일기 화면(src/components/diary-entry-screen.tsx)을 실제 임시본 모듈(@/lib/diary-drafts)과 함께 렌더한다.
// 새 일기를 쓰다 800ms 자동 저장이 AsyncStorage에 쓰는 도중(붙잡아 둠)에 "임시저장"이나 "AI 피드백 받기"로 서버에 처음 저장하고,
// 그 뒤 자동 저장을 끝낸다. 명세의 고친 뒤 동작대로라면 새 일기 키("") 지우기가 자동 저장 뒤에 실행되어 새 일기 임시본이 남지 않고,
// 다음에 새 일기를 열어도 "저장하지 않은 일기가 있어요"를 묻지 않는다.
// AsyncStorage는 메모리 저장소로 대신한다(hold(op)로 그 종류의 다음 호출 하나를 붙잡고, 풀 때 저장소에 반영한다).
// 주인 범위(@/lib/storage-owner)는 "user:7"을 돌려주는 가짜다. 나머지 가짜(API, 로그인 상태, 라우터, Alert, AppState, 네이티브 모듈)는
// diary-entry-screen.spec.test.tsx와 같은 방식으로 둔다. 자동 저장 타이머 때문에 가짜 시계로 돌린다(2026-11-12T03:00:00Z에서 멈춤).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Alert, AppState, type AppStateStatus } from "react-native";
import type { TestInstance } from "test-renderer";
import DiaryEntryScreen from "@/components/diary-entry-screen";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntry,
  getSavedExpressions,
  requestDiaryFeedback,
  updateDiaryEntry
} from "@/lib/api";
import { useSession } from "@/lib/session";
import type { AuthUser, DiaryEntry, DiaryFeedback } from "@/lib/types";

type StorageOp = "getItem" | "setItem" | "removeItem";
type Hold = { promise: Promise<void>; resolve: () => void; reject: (reason: unknown) => void };
type MemoryStorageControl = {
  store: Map<string, string>;
  hold: (op: StorageOp) => Hold;
  reset: () => void;
};

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const holds: Record<string, { promise: Promise<void>; resolve: () => void; reject: (reason: unknown) => void }[]> = {
    getItem: [],
    setItem: [],
    removeItem: []
  };
  async function waitFor(op: string) {
    const next = holds[op].shift();
    if (next) {
      await next.promise;
    }
  }
  const control = {
    store,
    hold(op: string) {
      let resolve!: () => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      promise.catch(() => undefined);
      const held = { promise, resolve, reject };
      holds[op].push(held);
      return held;
    },
    reset() {
      store.clear();
      Object.values(holds).forEach((list) => {
        list.length = 0;
      });
    }
  };
  const storage = {
    getItem: jest.fn(async (key: string) => {
      await waitFor("getItem");
      return store.has(key) ? (store.get(key) as string) : null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      await waitFor("setItem");
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      await waitFor("removeItem");
      store.delete(key);
    }),
    __control: control
  };
  return { __esModule: true, default: storage };
});
jest.mock("@/lib/storage-owner", () => ({
  getActiveStorageOwnerScope: jest.fn(async () => "user:7")
}));
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
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

const control = (AsyncStorage as unknown as { __control: MemoryStorageControl }).__control;
const NOW = new Date("2026-11-12T03:00:00.000Z");
const NEW_KEY = "writeloop_diary_draft.user:7.new";
const DRAFT_ALERT_TITLE = "저장하지 않은 일기가 있어요";
const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    entryId: "entry-new",
    title: "2026년 11월 12일의 일기",
    content: "I went home.",
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

const feedback: DiaryFeedback = {
  schemaVersion: "diary-feedback-v1",
  entryId: "entry-new",
  attemptNo: 1,
  score: 70,
  finishable: true,
  diaryAnswerBand: "DIARY_CLEAR_BASIC",
  summaryKo: "",
  strengths: [],
  fixPoints: [],
  diaryFlow: { timeFlow: "", emotion: "", detail: "", reflection: "", commentKo: "", connectionTips: [] },
  rewriteIdeas: [],
  usedDiaryExpressions: [],
  diaryExpressions: [],
  nextDiaryMission: { focus: "", titleKo: "", instructionKo: "" },
  safetyFlags: []
};

let alertSpy: jest.SpyInstance;

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

function bodyInput() {
  return screen.root!.queryAll((instance: TestInstance) => instance.type === "TextInput")[2];
}

function draftAlertCalls() {
  return alertSpy.mock.calls.filter((call) => call[0] === DRAFT_ALERT_TITLE);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  control.reset();
  jest.mocked(AsyncStorage.getItem).mockClear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  jest.mocked(AsyncStorage.removeItem).mockClear();
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(((
    _type: string,
    _listener: (state: AppStateStatus) => void
  ) => ({ remove: jest.fn() })) as unknown as typeof AppState.addEventListener);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getDiaryEntry).mockReset();
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(createDiaryEntry).mockReset().mockResolvedValue(makeEntry());
  jest.mocked(updateDiaryEntry).mockReset().mockImplementation(async (entryId) => makeEntry({ entryId }));
  jest.mocked(deleteDiaryEntry).mockReset().mockResolvedValue(undefined);
  jest.mocked(requestDiaryFeedback).mockReset().mockResolvedValue(feedback);
  jest.mocked(useSession).mockReturnValue({
    currentUser: signedInUser,
    isHydrating: false,
    refreshSession: jest.fn(),
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

describe("[spec] 새 일기 첫 서버 저장과 자동 저장의 경쟁(APP-ETC-103)", () => {
  it.each([["임시저장"], ["AI 피드백 받기"]])(
    "[spec] 자동 저장이 도는 사이 '%s'로 서버에 처음 저장하면, 늦게 끝난 자동 저장이 새 일기 임시본을 되살리지 않는다",
    async (buttonText) => {
      await render(<DiaryEntryScreen />);
      await flushAsync();
      expect(draftAlertCalls()).toHaveLength(0);

      await fireEvent.changeText(bodyInput(), "I went home.");
      await flushAsync();

      // 800ms 자동 저장이 AsyncStorage에 쓰는 도중에 멈춰 둔다.
      const heldAutosave = control.hold("setItem");
      await advance(800);
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(jest.mocked(AsyncStorage.setItem).mock.calls[0][0]).toBe(NEW_KEY);

      // 그 사이 서버에 처음 저장한다(새 일기가 만들어져 새 일기 키 지우기가 불린다).
      await fireEvent.press(screen.getByText(buttonText));
      await flushAsync();
      expect(createDiaryEntry).toHaveBeenCalledTimes(1);

      // 자동 저장이 늦게 끝난다.
      await act(async () => {
        heldAutosave.resolve();
      });
      await flushAsync();
      await advance(800);

      expect(control.store.has(NEW_KEY)).toBe(false);

      // 다음에 새 일기를 열면 이미 저장한 글을 이어서 쓸지 묻지 않는다.
      await screen.unmount();
      await flushAsync();
      alertSpy.mockClear();
      await render(<DiaryEntryScreen />);
      await flushAsync();

      expect(draftAlertCalls()).toHaveLength(0);
    }
  );
});
