// [spec] qa 테스트(작업 089 ⑤ 아이템 늘리기, 새 기능, 모바일): 개발 화면 시험판 '착용 시험'의 부위 일곱 켜기·끄기와 부위별 아이템 바꾸기(시나리오 P1~P9).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/03-qa-scenarios.md의 P)와
// 04-main-decision.md B(B-1: ①의 버튼 넷(모자·상의·하의·신발, 켜면 그 부위 첫 아이템·끄기)은 그대로 두고 같은 줄에 '얼굴장식'·'등장식'·'액세서리'
// 켜기·끄기를 더한다. 새 줄 "착용 바꾸기"의 '<부위> 바꾸기'(일곱)는 누를 때마다 그 부위 아이템을 목록 순서로 돈다: 입지 않았으면 첫 아이템,
// 마지막 다음은 첫 아이템. A-4: 그리기에는 부위 일곱의 종류를 look으로 넘긴다)에서만 가져온다.
// 목록 순서는 시나리오 "부위 차례"(지금 아이템 다음 명세 표 순서)다.
// 구현 커밋 59b34f2에서 읽은 것은 부르는 방법뿐이다: 3D 그리기가 받는 look(부위 일곱 → 종류·null), 버튼의 글과 accessibilityState.selected.
// "그리는 착용" = 3D 그리기(가짜)가 받은 look에서 null이 아닌 부위들. ①의 방↔마을 전환 도우미는 lobby3d-wear-panel.spec과 같은 방법이다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyArea } from "@/lib/lobby3d/engine";

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
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 시나리오의 값 ----------

const NOW = new Date(2026, 5, 21, 12, 30);
const ROW_LABEL = "착용 시험";
const CHANGE_LABEL = "착용 바꾸기";
const SLOTS = [
  { name: "모자", slot: "hat", items: ["capOrange", "capBlue", "capGreen"] },
  { name: "상의", slot: "top", items: ["tshirtOrange", "tshirtWhite", "tshirtYellow"] },
  { name: "하의", slot: "bottom", items: ["shortsNavy", "shortsBrown", "shortsRed"] },
  { name: "신발", slot: "shoes", items: ["shoesBrown", "shoesRed", "shoesWhite"] },
  { name: "얼굴장식", slot: "face", items: ["sunglassesBlack"] },
  { name: "등장식", slot: "back", items: ["backpackRed"] },
  { name: "액세서리", slot: "accessory", items: ["mufflerRed", "necklaceGold"] }
] as const;
type Slot = (typeof SLOTS)[number]["slot"];
const NAMES = SLOTS.map((s) => s.name);
const WB = {
  hat: "capGreen",
  top: "tshirtYellow",
  bottom: "shortsRed",
  shoes: "shoesWhite",
  face: "sunglassesBlack",
  back: "backpackRed",
  accessory: "necklaceGold"
};

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

/** 그리는 착용: 3D 그리기가 받은 look에서 입은 부위만(부위 → 종류). */
function drawnLook(): Partial<Record<Slot, string>> {
  const value = (canvas() as { look?: Partial<Record<string, string | null>> | null }).look ?? {};
  const out: Partial<Record<Slot, string>> = {};
  for (const { slot } of SLOTS) if (typeof value[slot] === "string") out[slot] = value[slot] as string;
  return out;
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

/** WB가 되도록 '<부위> 바꾸기'를 누른다(입지 않은 상태에서 그 아이템의 차례만큼). */
async function wearWB() {
  for (const { name, slot, items } of SLOTS) {
    const times = (items as readonly string[]).indexOf(WB[slot]) + 1;
    for (let i = 0; i < times; i += 1) await press(`${name} 바꾸기`);
  }
  expect(drawnLook()).toEqual(WB);
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

// ---------- P. 개발 화면 ----------

describe("[spec] 089-⑤ P: 개발 화면 '착용 시험'", () => {
  it("P1 '착용 시험'과 부위 일곱 버튼(모자·상의·하의·신발·얼굴장식·등장식·액세서리)이 하나씩, '착용 바꾸기'와 '<부위> 바꾸기' 일곱이 하나씩 있다", async () => {
    await renderDevWithPanel();
    expect(screen.getAllByText(ROW_LABEL)).toHaveLength(1);
    expect(screen.getAllByText(CHANGE_LABEL)).toHaveLength(1);
    for (const name of NAMES) {
      expect({ name, count: screen.getAllByRole("button", { name }).length }).toEqual({ name, count: 1 });
      expect({ name, count: screen.getAllByRole("button", { name: `${name} 바꾸기` }).length }).toEqual({ name, count: 1 });
    }
  });

  it("P2 처음에는 일곱 버튼 모두 꺼져 있고 그리는 착용이 비어 있다", async () => {
    await renderDevWithPanel();
    expect(selected()).toEqual([]);
    expect(drawnLook()).toEqual({});
  });

  it.each(SLOTS.map((s) => [s.name, s.slot, s.items] as const))(
    "P3 '%s 바꾸기'를 누를 때마다 그 부위 아이템이 목록 순서로 돌고(마지막 다음은 첫 아이템) 다른 부위는 바뀌지 않는다",
    async (name, slot, items) => {
      await renderDevWithPanel();
      const seen: (string | undefined)[] = [];
      for (let i = 0; i < items.length + 1; i += 1) {
        await press(`${name} 바꾸기`);
        const look = drawnLook();
        seen.push(look[slot]);
        expect(Object.keys(look)).toEqual([slot]);
      }
      expect(seen).toEqual([...items, items[0]]);
    }
  );

  it.each(SLOTS.map((s) => [s.name, s.slot, s.items[0]] as const))("P3·P6 '%s' 버튼을 켜면 그 부위 첫 아이템을 입고 켜짐으로 보이며, 다시 누르면 벗는다", async (name, slot, first) => {
    await renderDevWithPanel();
    await press(name);
    expect(drawnLook()).toEqual({ [slot]: first });
    expect(selected()).toEqual([name]);
    await press(name);
    expect(drawnLook()).toEqual({});
    expect(selected()).toEqual([]);
  });

  it("P4 일곱을 모두 입힌 뒤 '액세서리'를 끄면 액세서리만 빠지고 나머지 여섯은 그대로다", async () => {
    await renderDevWithPanel();
    await wearWB();
    expect(selected()).toEqual(NAMES);
    await press("액세서리");
    const { accessory: _gone, ...rest } = WB;
    expect(drawnLook()).toEqual(rest);
    expect(selected()).toEqual(NAMES.filter((n) => n !== "액세서리"));
  });

  it("P5 액세서리에서 빨강 머플러를 고른 뒤 바꾸면 금 목걸이 하나만 입는다", async () => {
    await renderDevWithPanel();
    await press("액세서리 바꾸기");
    expect(drawnLook()).toEqual({ accessory: "mufflerRed" });
    await press("액세서리 바꾸기");
    expect(drawnLook()).toEqual({ accessory: "necklaceGold" });
  });

  it("P6 '<부위> 바꾸기'로 입은 부위의 버튼은 켜짐으로 보인다", async () => {
    await renderDevWithPanel();
    await press("얼굴장식 바꾸기");
    await press("모자 바꾸기");
    await press("모자 바꾸기");
    expect(selected()).toEqual(["모자", "얼굴장식"]);
    expect(drawnLook()).toEqual({ hat: "capBlue", face: "sunglassesBlack" });
  });

  it("P7 WB를 입고 시험판 '마을'로, 다시 '방'으로 바꿔도 그리는 착용이 WB 그대로다", async () => {
    await renderDevWithPanel();
    await wearWB();
    await press("마을");
    expect(area()).toBe("village");
    expect(drawnLook()).toEqual(WB);
    await press("방");
    expect(area()).toBe("room");
    expect(drawnLook()).toEqual(WB);
    expect(selected()).toEqual(NAMES);
  });

  it("P8 파랑 야구모자·검정 선글라스를 고르고 시험판을 접었다 펴도 그리는 착용과 켜짐 표시가 그대로다", async () => {
    await renderDevWithPanel();
    await press("모자 바꾸기");
    await press("모자 바꾸기");
    await press("얼굴장식 바꾸기");
    await press("시험판 접기");
    expect(drawnLook()).toEqual({ hat: "capBlue", face: "sunglassesBlack" });
    await press("시험판 펴기");
    expect(drawnLook()).toEqual({ hat: "capBlue", face: "sunglassesBlack" });
    expect(selected()).toEqual(["모자", "얼굴장식"]);
  });

  it("P9 시험판 없는 로비(devPanel=false)에는 '착용 시험'·'착용 바꾸기'와 그 버튼이 없다", async () => {
    await render(<Lobby3dScreen devPanel={false} />);
    await flushAsync();
    expect(screen.queryByText(ROW_LABEL)).toBeNull();
    expect(screen.queryByText(CHANGE_LABEL)).toBeNull();
    for (const name of NAMES) {
      expect(screen.queryByRole("button", { name })).toBeNull();
      expect(screen.queryByRole("button", { name: `${name} 바꾸기` })).toBeNull();
    }
  });
});
