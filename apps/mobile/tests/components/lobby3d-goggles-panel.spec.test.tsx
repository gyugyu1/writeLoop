// [spec] qa 테스트(작업 089 ⑤ 라룹이 고글, 새 기능, 모바일): 개발 화면 '착용 시험'이 고글을 쓴 채 시작하고 끄기·바꾸기가 고글을 따르는지(시나리오 GP1~GP6).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/10-qa-scenarios.md의 GP, 23-qa-scenarios.md "10 GP 그대로 쓴다")와
// 11-main-decision.md B6(처음 얼굴장식은 고글(켜짐), '얼굴장식' 끄기 = 맨얼굴, '얼굴장식 바꾸기'는 고글 → 선글라스 → 고글), B1(고글은 얼굴장식의 첫 아이템),
// 04-main-decision.md B-1(켜면 그 부위 첫 아이템, 바꾸기는 입지 않았으면 첫 아이템)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다: 3D 그리기(Lobby3dCanvas, 가짜)가 받는 look(부위 일곱 → 종류·null), 버튼 글과 accessibilityState.selected.
// 화면 조작 도우미는 ⑤ qa 테스트 lobby3d-wear-panel-expand.spec과 같다.
// 090-③ 뒤로 시험판의 부위 아이템 차례는 받은 아이템 목록을 따르므로(받은 목록이 없으면 앱 이름표 순서), 같은 시험을 "받은 목록 없음"과
// "서버 목록 파일의 옷을 받음" 두 상태로 돌린다(앞 상태가 먼저 돈다. 목록은 모듈 안에 남는다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import { applyArea } from "@/lib/lobby3d/engine";
import { currentItemCatalog, parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { serverWearCatalog } from "../__fixtures__/wear-files-090";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    const onRoomShown = props.onRoomShown;
    const sent = React.useRef(false);
    React.useEffect(() => {
      if (sent.current || !onRoomShown) return;
      sent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    const area = props.area ?? "room";
    React.useEffect(() => {
      if (area === "village") mockCanvas.props?.onVillageReady?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 시나리오의 값 ----------

const NOW = new Date(2026, 5, 21, 12, 30);
const NAMES = ["모자", "상의", "하의", "신발", "얼굴장식", "등장식", "액세서리"];
const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

// ---------- 도우미 ----------

async function flushAsync() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function canvas(): Lobby3dCanvasProps {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function area() {
  return canvas().area ?? "room";
}

/** 3D 그리기가 받은 look 그대로(일곱 부위). */
function drawnLook(): unknown {
  return (canvas() as { look?: unknown }).look;
}

function toggle(name: string) {
  return screen.getByRole("button", { name });
}

/** 켜진(selected) 부위 버튼 이름들(부위 순서). */
function selected(): string[] {
  return NAMES.filter((name) => toggle(name).props.accessibilityState?.selected === true);
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

async function renderDevWithPanel() {
  devGlobal.__DEV__ = true;
  await render(<DevLobby3dRoute />);
  await flushAsync();
  await press("시험판 펴기");
}

function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- GP ----------

function gpTests(state: string) {
  it(`GP1(${state}) 시험판을 펴면 '얼굴장식' 버튼만 켜져 있고 그릴 look이 { ...ALL_NULL, face: goggles }다`, async () => {
    await renderDevWithPanel();
    expect(selected()).toEqual(["얼굴장식"]);
    expect(drawnLook()).toEqual({ ...ALL_NULL, face: "goggles" });
  });

  it(`GP2(${state}) '얼굴장식'을 누르면 face null(버튼 꺼짐), 다시 누르면 goggles(버튼 켜짐, 첫 아이템)다`, async () => {
    await renderDevWithPanel();
    await press("얼굴장식");
    expect(drawnLook()).toEqual(ALL_NULL);
    expect(selected()).toEqual([]);
    await press("얼굴장식");
    expect(drawnLook()).toEqual({ ...ALL_NULL, face: "goggles" });
    expect(selected()).toEqual(["얼굴장식"]);
  });

  it(`GP3(${state}) '얼굴장식 바꾸기'를 세 번 누르면 face가 sunglassesBlack → goggles → sunglassesBlack이고 다른 부위는 null 그대로다`, async () => {
    await renderDevWithPanel();
    const seen: unknown[] = [];
    for (let i = 0; i < 3; i += 1) {
      await press("얼굴장식 바꾸기");
      seen.push(drawnLook());
    }
    expect(seen).toEqual([
      { ...ALL_NULL, face: "sunglassesBlack" },
      { ...ALL_NULL, face: "goggles" },
      { ...ALL_NULL, face: "sunglassesBlack" }
    ]);
  });

  it(`GP4(${state}) '얼굴장식'으로 끈 뒤 '얼굴장식 바꾸기'를 누르면 face가 goggles(입지 않았으면 첫 아이템)다`, async () => {
    await renderDevWithPanel();
    await press("얼굴장식");
    expect(drawnLook()).toEqual(ALL_NULL);
    await press("얼굴장식 바꾸기");
    expect(drawnLook()).toEqual({ ...ALL_NULL, face: "goggles" });
  });

  it(`GP5(${state}) '모자' 켜기와 '액세서리 바꾸기' 한 번이면 look이 { ...ALL_NULL, face: goggles, hat: capOrange, accessory: mufflerRed }다`, async () => {
    await renderDevWithPanel();
    await press("모자");
    await press("액세서리 바꾸기");
    expect(drawnLook()).toEqual({ ...ALL_NULL, face: "goggles", hat: "capOrange", accessory: "mufflerRed" });
  });

  it(`GP6(${state}) '얼굴장식'으로 끈 뒤 시험판 '마을' → '방', 접었다 펴도 face는 null이고 '얼굴장식' 버튼도 꺼진 그대로다`, async () => {
    await renderDevWithPanel();
    await press("얼굴장식");
    await press("마을");
    expect(area()).toBe("village");
    await press("방");
    expect(area()).toBe("room");
    expect(drawnLook()).toEqual(ALL_NULL);
    expect(selected()).toEqual([]);
    await press("시험판 접기");
    await press("시험판 펴기");
    expect(drawnLook()).toEqual(ALL_NULL);
    expect(selected()).toEqual([]);
  });
}

describe("[spec] 089-⑤ 10 GP: 개발 화면 '착용 시험'(받은 목록 없음)", () => {
  beforeAll(() => {
    expect(currentItemCatalog()).toBeNull();
  });
  gpTests("받은 목록 없음");
});

describe("[spec] 089-⑤ 10 GP: 개발 화면 '착용 시험'(서버 목록 파일의 옷을 받음)", () => {
  beforeAll(() => {
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-089-gp"))!);
  });
  gpTests("서버 목록");
});
