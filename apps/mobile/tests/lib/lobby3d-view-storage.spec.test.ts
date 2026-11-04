// [spec] qa 테스트(작업 058, 새 기능: 3D 로비 카메라 거리 저장 규칙).
// 기대값은 시나리오(02-qa-scenarios.md S47~S49)와 결정(03의 11: 범위 밖이면 범위 안으로 맞추고, 숫자가 아니거나
// 읽지 못하면 기본값)에서만 가져온다. 기기 저장소(AsyncStorage)는 메모리 가짜로 바꾼다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VIEW_WIDTH_DEFAULT, VIEW_WIDTH_MAX, VIEW_WIDTH_MIN } from "@/lib/lobby3d/engine";
import {
  LOBBY3D_VIEW_WIDTH_KEY,
  loadLobbyViewWidth,
  resetLobbyViewWidth,
  saveLobbyViewWidth
} from "@/lib/lobby3d/view-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe("[spec] 카메라 거리 저장(S47~S49)", () => {
  it("S47: 저장된 값이 없으면 기본값이다", async () => {
    await expect(loadLobbyViewWidth()).resolves.toBe(VIEW_WIDTH_DEFAULT);
  });

  it("S48: 범위 안의 값을 저장하면 다시 읽을 때 그 값이다", async () => {
    const chosen = Number(((VIEW_WIDTH_MIN + VIEW_WIDTH_MAX) / 2 + 0.3).toFixed(1));
    expect(chosen).not.toBe(VIEW_WIDTH_DEFAULT);
    await saveLobbyViewWidth(chosen);
    await expect(loadLobbyViewWidth()).resolves.toBe(chosen);
  });

  it("S49: 기본값으로 되돌리면 다시 읽을 때 기본값이다", async () => {
    await saveLobbyViewWidth(VIEW_WIDTH_MIN);
    await resetLobbyViewWidth();
    await expect(loadLobbyViewWidth()).resolves.toBe(VIEW_WIDTH_DEFAULT);
  });
});

describe("[spec] 저장된 값이 이상할 때(결정 03-11)", () => {
  it.each([
    ["범위보다 큰 값", "100", VIEW_WIDTH_MAX],
    ["범위보다 작은 값", "-5", VIEW_WIDTH_MIN]
  ])("%s은 범위 끝으로 맞춘다", async (_name, raw, expected) => {
    await AsyncStorage.setItem(LOBBY3D_VIEW_WIDTH_KEY, raw);
    await expect(loadLobbyViewWidth()).resolves.toBe(expected);
  });

  it.each([
    ["글자", "abc"],
    ["빈 문자열", ""],
    ["숫자가 아닌 NaN", "NaN"]
  ])("숫자가 아닌 값(%s)이면 기본값이다", async (_name, raw) => {
    // 메모리 가짜는 빈 문자열을 null로 돌려주므로(`|| null`), 실제 저장소처럼 읽은 문자열을 그대로 돌려주게 한다.
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(raw);
    await expect(loadLobbyViewWidth()).resolves.toBe(VIEW_WIDTH_DEFAULT);
  });

  it("저장소를 읽지 못하면 기본값이다", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("read failed"));
    await expect(loadLobbyViewWidth()).resolves.toBe(VIEW_WIDTH_DEFAULT);
  });
});
