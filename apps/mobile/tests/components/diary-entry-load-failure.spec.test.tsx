// [spec] qa 재현 테스트(작업 049 버그 수정 APP-ETC-102: 기존 일기를 불러오지 못하면 빈 편집 화면이 그 일기 id로 열려,
// 저장하면 완료된 일기를 덮어쓰는 버그).
// 영어일기 화면(src/components/diary-entry-screen.tsx)을 기존 일기(initialEntryId 있음)로 렌더하고, 불러오기(getDiaryEntry)가
// 실패(throw)하거나 일기를 찾지 못하는(null) 경우 명세의 고친 뒤 동작을 확인한다.
// - 편집 화면(머리, 소개, 날짜·제목·기분, 본문, 버튼 줄, 삭제 버튼, AI 코치) 대신 불러오기 실패 화면을 보인다.
//   오류 문구는 지금과 같다(실패: 서버 메시지 또는 "일기를 불러오지 못했어요.", 찾지 못함: "일기를 찾을 수 없어요.").
// - "다시 시도"는 같은 일기를 다시 불러오고(그동안 지금처럼 불러오는 중 표시), 성공하면 원래처럼 편집 화면이나 읽기 전용 화면을 보인다.
// - "일기 목록으로"는 일기 목록(/diary)으로 간다.
// - 이 화면에서는 일기 갱신·피드백·완료·삭제 API와 기기 임시본 저장을 부르지 않는다.
// 가짜로 두는 것은 diary-entry-screen.spec.test.tsx와 같다: API(@/lib/api), 기기 임시본(@/lib/diary-drafts), 로그인 상태(@/lib/session),
// 라우터(expo-router), Alert(spyOn), AppState(듣는 함수를 모음), 네이티브 모듈(expo-symbols, 안전 영역).
// 날짜가 오늘에 기대므로 가짜 시계로 돌린다(2026-11-12T03:00:00Z에서 멈춤).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
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
import { deleteDiaryDraft, getDiaryDraft, saveDiaryDraft } from "@/lib/diary-drafts";
import { useSession } from "@/lib/session";
import type { AuthUser, DiaryEntry } from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() }
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

const NOW = new Date("2026-11-12T03:00:00.000Z");
const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

type AlertButton = { text: string; style?: string; onPress?: () => void };

let alertSpy: jest.SpyInstance;
const appStateListeners: ((state: AppStateStatus) => void)[] = [];

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    entryId: "entry-1",
    title: "Rainy Tuesday",
    content: "I walked in the rain.",
    language: "en",
    entryDate: "2026-11-03",
    mood: null,
    tags: ["calm", "happy"],
    draft: true,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
    attempts: [],
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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

async function renderEntry(entryId = "entry-1") {
  await render(<DiaryEntryScreen initialEntryId={entryId} />);
  await flushAsync();
}

async function pressText(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

function textInputs() {
  return screen.root!.queryAll((instance: TestInstance) => instance.type === "TextInput");
}

function spinners() {
  return screen.root!.queryAll((instance: TestInstance) => instance.type === "ActivityIndicator");
}

// 불러오기 실패 화면: 오류 문구, "다시 시도", "일기 목록으로"가 보이고 편집 화면(과 읽기 전용 화면)의 요소는 없다.
function expectLoadFailureScreen(message: string) {
  expect(screen.getByText(message)).toBeOnTheScreen();
  expect(screen.getByText("다시 시도")).toBeOnTheScreen();
  expect(screen.getByText("일기 목록으로")).toBeOnTheScreen();

  // 머리(뒤로 가기 "<"와 제목 "영어일기")
  expect(screen.queryByText("<")).toBeNull();
  expect(screen.queryByText("영어일기")).toBeNull();
  // 소개
  expect(screen.queryByText("오늘을 영어로 남겨보세요.")).toBeNull();
  // 날짜·제목·기분
  expect(screen.queryByText("날짜")).toBeNull();
  expect(screen.queryByText("제목")).toBeNull();
  expect(screen.queryByText("기분 태그")).toBeNull();
  expect(screen.queryByText("calm")).toBeNull();
  // 본문(쓸 수 있는 칸이 하나도 없다)
  expect(screen.queryByText("오늘의 영어일기")).toBeNull();
  expect(textInputs()).toHaveLength(0);
  // 버튼 줄
  expect(screen.queryByText("임시저장")).toBeNull();
  expect(screen.queryByText("AI 피드백 받기")).toBeNull();
  expect(screen.queryByText("일기쓰기 완료")).toBeNull();
  // 삭제 버튼
  expect(screen.queryByRole("button", { name: "일기 삭제" })).toBeNull();
  expect(screen.queryByText("일기 삭제")).toBeNull();
  // AI 코치
  expect(screen.queryByRole("button", { name: "AI 코치 열기" })).toBeNull();
  expect(screen.queryByText("막히면 AI 코치에게 물어봐요.")).toBeNull();
  // 읽기 전용 화면도 아니다.
  expect(screen.queryByText("완료된 일기")).toBeNull();
}

function navigationCalls() {
  return [
    ...jest.mocked(router.push).mock.calls,
    ...jest.mocked(router.replace).mock.calls,
    ...jest.mocked(router.navigate).mock.calls
  ];
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  appStateListeners.length = 0;
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(((
    _type: string,
    listener: (state: AppStateStatus) => void
  ) => {
    appStateListeners.push(listener);
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.navigate).mockReset();
  jest.mocked(router.back).mockReset();
  jest.mocked(getDiaryEntry).mockReset();
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(createDiaryEntry).mockReset().mockResolvedValue(makeEntry({ entryId: "entry-new" }));
  jest.mocked(updateDiaryEntry).mockReset().mockImplementation(async (entryId) => makeEntry({ entryId }));
  jest.mocked(deleteDiaryEntry).mockReset().mockResolvedValue(undefined);
  jest.mocked(requestDiaryFeedback).mockReset();
  jest.mocked(getDiaryDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveDiaryDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteDiaryDraft).mockReset().mockResolvedValue(undefined);
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

describe("[spec] 기존 일기 불러오기 실패 화면(APP-ETC-102)", () => {
  it("[spec] 불러오기가 실패하면 편집 화면 대신 서버 메시지와 '다시 시도'·'일기 목록으로'만 보인다", async () => {
    jest.mocked(getDiaryEntry).mockRejectedValue(new Error("일기 서버 오류"));
    await renderEntry();

    expect(getDiaryEntry).toHaveBeenCalledTimes(1);
    expect(getDiaryEntry).toHaveBeenCalledWith("entry-1");
    expectLoadFailureScreen("일기 서버 오류");
  });

  it("[spec] 메시지 없이 실패하면 '일기를 불러오지 못했어요.'를 실패 화면에 보인다", async () => {
    jest.mocked(getDiaryEntry).mockRejectedValue("문자열 오류");
    await renderEntry();

    expectLoadFailureScreen("일기를 불러오지 못했어요.");
  });

  it("[spec] 일기를 찾지 못하면(null) '일기를 찾을 수 없어요.'를 실패 화면에 보인다", async () => {
    jest.mocked(getDiaryEntry).mockResolvedValue(null);
    await renderEntry();

    expectLoadFailureScreen("일기를 찾을 수 없어요.");
  });

  it.each([
    ["실패", () => jest.mocked(getDiaryEntry).mockRejectedValue(new Error("일기 서버 오류"))],
    ["찾지 못함", () => jest.mocked(getDiaryEntry).mockResolvedValue(null)]
  ])(
    "[spec] 불러오기 %s 뒤 사용자가 할 수 있는 무엇을 해도 일기 갱신·피드백·완료·삭제 API와 기기 임시본 저장을 부르지 않는다",
    async (_label, arrange) => {
      arrange();
      await renderEntry();

      // 본문 칸(편집 화면의 마지막 입력 칸)이 있으면 새 본문을 쓰고, 자동 저장 시간을 넘긴다.
      const inputs = textInputs();
      if (inputs.length > 0) {
        await fireEvent.changeText(inputs[inputs.length - 1], "I overwrote the finished diary.");
        await flushAsync();
      }
      await advance(800);
      // 저장·피드백·완료 버튼이 있으면 누른다.
      for (const label of ["임시저장", "AI 피드백 받기", "일기쓰기 완료"]) {
        if (screen.queryByText(label)) {
          await pressText(label);
        }
      }
      // 삭제 버튼이 있으면 눌러 삭제를 확정한다.
      const deleteButton = screen.queryByRole("button", { name: "일기 삭제" });
      if (deleteButton) {
        await fireEvent.press(deleteButton);
        await flushAsync();
        const confirm = alertSpy.mock.calls.find((call) => call[0] === "이 일기를 삭제할까요?");
        const deleteAction = (confirm?.[2] as AlertButton[] | undefined)?.find((button) => button.text === "삭제하기");
        await act(async () => {
          deleteAction?.onPress?.();
        });
        await flushAsync();
      }
      // 앱이 백그라운드로 가고 화면을 떠난다.
      await act(async () => {
        appStateListeners.forEach((listener) => listener("background"));
      });
      await flushAsync();
      await screen.unmount();
      await flushAsync();

      expect(updateDiaryEntry).not.toHaveBeenCalled();
      expect(createDiaryEntry).not.toHaveBeenCalled();
      expect(requestDiaryFeedback).not.toHaveBeenCalled();
      expect(deleteDiaryEntry).not.toHaveBeenCalled();
      expect(saveDiaryDraft).not.toHaveBeenCalled();
    }
  );

  it("[spec] '다시 시도'는 같은 일기를 다시 불러오고(그동안 불러오는 중 표시), 성공하면 원래처럼 편집 화면을 보인다", async () => {
    jest.mocked(getDiaryEntry).mockRejectedValueOnce(new Error("일기 서버 오류"));
    await renderEntry();
    expectLoadFailureScreen("일기 서버 오류");

    const retry = deferred<DiaryEntry | null>();
    jest.mocked(getDiaryEntry).mockReturnValueOnce(retry.promise);
    await pressText("다시 시도");

    expect(getDiaryEntry).toHaveBeenCalledTimes(2);
    expect(jest.mocked(getDiaryEntry).mock.calls).toEqual([["entry-1"], ["entry-1"]]);
    // 불러오는 동안에는 지금처럼 불러오는 중 표시만 보인다.
    const indicators = spinners();
    expect(indicators).toHaveLength(1);
    expect(indicators[0].props.color).toBe("#E38B12");
    expect(screen.queryByText("다시 시도")).toBeNull();
    expect(screen.queryByText("일기 목록으로")).toBeNull();
    expect(screen.queryByText("일기 서버 오류")).toBeNull();

    await act(async () => {
      retry.resolve(makeEntry());
    });
    await flushAsync();

    // 불러오기에 성공한 원래 편집 화면
    expect(screen.queryByText("다시 시도")).toBeNull();
    expect(screen.queryByText("일기 목록으로")).toBeNull();
    expect(screen.queryByText("일기 서버 오류")).toBeNull();
    expect(screen.getByRole("button", { name: "영어일기 기록으로 이동" })).toBeOnTheScreen();
    expect(screen.getByDisplayValue("2026-11-03")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Rainy Tuesday")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("I walked in the rain.")).toBeOnTheScreen();
    expect(screen.getByText("임시저장")).toBeOnTheScreen();
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
    expect(screen.getByRole("button", { name: "일기 삭제" })).toBeOnTheScreen();
    expect(getDiaryDraft).toHaveBeenCalledTimes(1);
    expect(getDiaryDraft).toHaveBeenCalledWith("entry-1");
  });

  it("[spec] '다시 시도'로 완료된 일기를 불러오면 원래처럼 읽기 전용 화면을 보인다", async () => {
    jest.mocked(getDiaryEntry).mockResolvedValueOnce(null);
    await renderEntry();
    expectLoadFailureScreen("일기를 찾을 수 없어요.");

    jest.mocked(getDiaryEntry).mockResolvedValueOnce(
      makeEntry({ draft: false, content: "I walked in the rain with my dog." })
    );
    await pressText("다시 시도");

    expect(getDiaryEntry).toHaveBeenCalledTimes(2);
    expect(screen.getByText("완료된 일기")).toBeOnTheScreen();
    expect(screen.getByText("I walked in the rain with my dog.")).toBeOnTheScreen();
    expect(screen.getByText("작성 완료")).toBeOnTheScreen();
    expect(screen.queryByText("일기를 찾을 수 없어요.")).toBeNull();
    expect(screen.queryByText("다시 시도")).toBeNull();
    expect(textInputs()).toHaveLength(0);
  });

  it("[spec] '다시 시도'가 또 실패하면 다시 불러오기 실패 화면을 보인다", async () => {
    jest.mocked(getDiaryEntry).mockRejectedValueOnce(new Error("일기 서버 오류"));
    await renderEntry();
    expectLoadFailureScreen("일기 서버 오류");

    jest.mocked(getDiaryEntry).mockResolvedValueOnce(null);
    await pressText("다시 시도");

    expect(getDiaryEntry).toHaveBeenCalledTimes(2);
    expectLoadFailureScreen("일기를 찾을 수 없어요.");
    expect(screen.queryByText("일기 서버 오류")).toBeNull();
  });

  it("[spec] '일기 목록으로'는 일기 목록(/diary)으로 간다", async () => {
    jest.mocked(getDiaryEntry).mockRejectedValue(new Error("일기 서버 오류"));
    await renderEntry();
    expectLoadFailureScreen("일기 서버 오류");

    await pressText("일기 목록으로");

    expect(navigationCalls()).toEqual([["/diary"]]);
    expect(router.back).not.toHaveBeenCalled();
    expect(getDiaryEntry).toHaveBeenCalledTimes(1);
  });
});
