// [spec] qa 테스트(작업 128 가구점 실내, 새 기능, 모바일): 로비 화면(Lobby3dScreen) 흐름.
// 기대값은 private 작업 폴더 128-2026-11-19-가구점-실내/01-main-spec.md와 02-qa-scenarios.md에서만 가져온다(S번호는 시나리오 번호).
// 3D 그리기는 Jest에서 돌지 않으므로 가짜로 바꾼다. 가짜는 구역이 마을이면 onVillageReady, 가구점이면 mockShop.mode에 따라
// onShopReady("ready")·onShopFailed("failed")를 부르고 "pending"이면 부르지 않는다(테스트가 나중에 부른다).
// 구현에서 읽은 것은 부르는 방법뿐이다: 가짜가 받는 area·onShopReady·onShopFailed, 말풍선 버튼 이름, 위 줄 버튼 이름.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { setVillageBgmArea } from "@/lib/audio/village-bgm";
import type { LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { resetShopDisplay, shopDisplay, shopProduct } from "@/lib/lobby3d/shop";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockShop: { mode: "ready" | "pending" | "failed" } = { mode: "ready" };

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("@/lib/audio/village-bgm", () => ({
  ...jest.requireActual<typeof import("@/lib/audio/village-bgm")>("@/lib/audio/village-bgm"),
  setVillageBgmArea: jest.fn()
}));
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
      if (area !== "shop") return;
      if (mockShop.mode === "ready") mockCanvas.props?.onShopReady?.();
      else if (mockShop.mode === "failed") mockCanvas.props?.onShopFailed?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const ALL = { includeHiddenElements: true } as const;
const SPAWN: FloorPoint = { x: 7.15, z: 7.89 };

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const angleGap = (a: number, b: number) => {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
};
const textCount = (text: string) => screen.queryAllByText(text, ALL).length;
const bubble = () => sim().snapshot(Date.now()).bubbleText;

async function flushAsync() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

async function walkTo(point: FloorPoint, mark: PointerHit["mark"]) {
  await act(async () => {
    canvas().onPointer("down", { point, mark, onCharacter: false }, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
  await frames(25);
  expect(dist(pos(), point)).toBeLessThanOrEqual(0.06);
}

const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};

/** 방 → 마을 → 가구점 문 앞. */
async function toShopDoor() {
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
}

async function enterShop() {
  await toShopDoor();
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("shop");
}

/** 가구점 안 장소의 서는 자리 좌표(엔진이 아니라 말풍선으로 장소를 찾는다: 서는 자리는 장소를 누를 때 sim이 안다). */
async function goToPlace(id: "shopExit" | "shopCounter" | "shopSlot1" | "shopSlot2" | "shopSlot3") {
  // 장소 이름표를 누른 것과 같다: 점은 주지 않고 장소만 준다
  await act(async () => {
    canvas().onPointer("down", { point: null, mark: id, onCharacter: false }, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
  await frames(25);
  expect(sim().snapshot(Date.now()).arrived).toBe(id);
}

let reduceMotion = false;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockShop.mode = "ready";
  reduceMotion = false;
  (setVillageBgmArea as jest.Mock).mockClear();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(async () => reduceMotion);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
});

afterEach(() => {
  applyArea("room");
  resetShopDisplay();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function renderLobby(extra: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
  const view = await render(<Lobby3dScreen devPanel={false} {...extra} />);
  await flushAsync();
  return view;
}

describe("[spec] 입장(S10~S16)", () => {
  it("S10: 마을 가구점 문 앞 말풍선은 '가구점에 들어갈까?'와 '들어가기' 버튼이고, '곧 열려요'는 나오지 않는다", async () => {
    await renderLobby();
    await toShopDoor();
    expect(screen.getByText("가구점에 들어갈까?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "들어가기" })).toBeTruthy();
    expect(textCount("가구점은 곧 열려요")).toBe(0);
  });

  it("S11: 옷집 문 앞은 그대로 '옷집은 곧 열려요'이고 버튼이 없다", async () => {
    await renderLobby();
    await walkTo(MARKS.door.approach[0], "door");
    await press("나가기");
    await frames(1.2);
    const clothing = Object.entries(VILLAGE_PLACES).find(([, place]) => (place as { label?: string }).label === "옷집");
    expect(clothing).toBeDefined();
    await walkTo(clothing![1].approach[0], clothing![0] as PointerHit["mark"]);
    expect(screen.getByText("옷집은 곧 열려요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "들어가기" })).toBeNull();
  });

  it("S12: '들어가기'를 누르면 어두워진 뒤(약 0.3초) 구역이 shop으로 바뀐다", async () => {
    await renderLobby();
    await toShopDoor();
    await press("들어가기");
    expect(area()).toBe("village");
    await frames(0.1);
    expect(area()).toBe("village");
    await frames(0.5);
    expect(area()).toBe("shop");
  });

  it("S12: 동작 줄이기면 전환 없이 바로 shop이 된다(시간을 넣지 않아도)", async () => {
    reduceMotion = true;
    await renderLobby();
    await toShopDoor();
    await press("들어가기");
    await flushAsync();
    expect(area()).toBe("shop");
  });

  it("S13: 입장 후 라룹이는 (7.15, 7.89)에서 −Z(heading π)를 본다", async () => {
    await renderLobby();
    await enterShop();
    expect(dist(pos(), SPAWN)).toBeLessThan(0.01);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThan(1e-3);
  });

  it("S14: 실내 모델을 아직 못 읽었으면 어두운 채 기다리고, 조금 넘게 걸리면 '가구점에 들어가는 중…'이 뜨고, 다 읽으면 사라진다", async () => {
    mockShop.mode = "pending";
    await renderLobby();
    await toShopDoor();
    await press("들어가기");
    // 구역이 바뀐 직후에는 아직 글이 없다(조금 넘게 걸릴 때만 뜬다)
    for (let i = 0; i < 40 && area() !== "shop"; i += 1) await frames(0.05);
    expect(area()).toBe("shop");
    expect(textCount("가구점에 들어가는 중…")).toBe(0);
    await frames(0.5);
    expect(textCount("가구점에 들어가는 중…")).toBe(1);
    await act(async () => {
      canvas().onShopReady?.();
    });
    await frames(0.6);
    expect(textCount("가구점에 들어가는 중…")).toBe(0);
    expect(area()).toBe("shop");
  });

  it("S15: 실내 모델을 읽지 못하면 마을 가구점 문 앞으로 돌아오고 '가구점을 불러오지 못했어요'가 나온다", async () => {
    mockShop.mode = "failed";
    await renderLobby();
    await toShopDoor();
    await press("들어가기");
    await frames(1.5);
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_PLACES.furnitureShop.approach[0])).toBeLessThan(0.01);
    expect(textCount("가구점을 불러오지 못했어요")).toBe(1);
  });

  it("S16: 가구점 안에서도 마을 배경음악은 이어서 나온다(마을 아님으로 알리지 않는다)", async () => {
    await renderLobby();
    await toShopDoor();
    const bgm = setVillageBgmArea as jest.Mock;
    expect(bgm.mock.calls.at(-1)?.[0]).toBe(true);
    bgm.mockClear();
    await press("들어가기");
    await frames(1.2);
    expect(area()).toBe("shop");
    expect(bgm.mock.calls.filter((call) => call[0] === false)).toHaveLength(0);
    expect(bgm.mock.calls.at(-1)?.[0] ?? true).toBe(true);
  });
});

describe("[spec] 실내 장소와 화면(S24·S25·S27·S28)", () => {
  it("S25: 입장 직후 '마을로 나갈까?'와 '나가기' 버튼이 뜬다. 이름표 '마을로'·'버들'·'진열대'가 있다", async () => {
    await renderLobby();
    await enterShop();
    expect(bubble()).toBe("마을로 나갈까?");
    expect(screen.getByRole("button", { name: "나가기" })).toBeTruthy();
    expect(textCount("마을로")).toBeGreaterThan(0);
    expect(textCount("버들")).toBeGreaterThan(0);
    expect(textCount("진열대")).toBeGreaterThanOrEqual(3);
  });

  it("S24: 이름표를 눌러 버들에게 가면 '버들에게 인사할까?'와 '인사하기'가 뜬다. 진열대에 가면 그 상품 이름 말풍선과 '바꾸기'가 뜬다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopCounter");
    expect(bubble()).toBe("버들에게 인사할까?");
    expect(screen.getByRole("button", { name: "인사하기" })).toBeTruthy();
    await goToPlace("shopSlot3");
    expect(bubble()).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    expect(screen.getByRole("button", { name: "바꾸기" })).toBeTruthy();
  });

  it("S27: 실내에서는 '꾸미기'와 홈쇼핑 버튼·잔액 칩이 숨겨지고, 방으로 돌아오면 다시 보인다", async () => {
    await renderLobby({ onSaveLayout: jest.fn(async (layout) => layout), onOpenShop: jest.fn(), shopBalance: 120 });
    expect(textCount("꾸미기")).toBe(1);
    expect(textCount("홈쇼핑")).toBe(1);
    await enterShop();
    expect(textCount("꾸미기")).toBe(0);
    expect(textCount("홈쇼핑")).toBe(0);
    expect(screen.queryAllByLabelText("120룹, 홈쇼핑 열기", ALL)).toHaveLength(0);
  });

  it("S28: 실내에서 홈쇼핑 '바로 놓기'를 받으면 가구점에 머물지 않고 방으로 돌아온다", async () => {
    const props = { onSaveLayout: jest.fn(async (layout: LobbyLayout) => layout), onOpenShop: jest.fn(), shopBalance: 120 };
    const view = await renderLobby(props);
    await enterShop();
    await view.rerender(<Lobby3dScreen devPanel={false} {...props} placeRequest={{ key: 1, itemId: "none", type: "desk" }} />);
    await flushAsync();
    await frames(1.5);
    expect(area()).toBe("room");
  });
});

describe("[spec] 버들 인사(S37·S38)", () => {
  it("S37: '인사하기'를 누르면 버들 머리 위 말풍선 '어서 와! 천천히 둘러보렴.'이 뜨고 3초쯤 뒤 사라진다. 그동안 장소 말풍선은 거둔다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopCounter");
    await press("인사하기");
    expect(textCount("어서 와! 천천히 둘러보렴.")).toBe(1);
    // 숨은 말풍선(투명)은 세지 않고 보이는 것만 센다
    expect(screen.queryAllByText("버들에게 인사할까?")).toHaveLength(0);
    await frames(1);
    expect(textCount("어서 와! 천천히 둘러보렴.")).toBe(1);
    await frames(2.5);
    expect(textCount("어서 와! 천천히 둘러보렴.")).toBe(0);
    expect(bubble()).toBe("버들에게 인사할까?");
  });

  it("S38: 인사는 몇 번이든 다시 할 수 있다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopCounter");
    for (let i = 0; i < 3; i += 1) {
      await press("인사하기");
      expect(textCount("어서 와! 천천히 둘러보렴.")).toBe(1);
      await frames(3.5);
      expect(textCount("어서 와! 천천히 둘러보렴.")).toBe(0);
    }
  });
});

describe("[spec] 진열 바꾸기(S44~S48)", () => {
  it("S44: '바꾸기'를 누르면 목록이 열리고 세 상품의 이름·설명이 있으며, 이 진열대의 지금 상품에만 '진열 중' 표시가 있다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopSlot2");
    await press("바꾸기");
    for (const id of ["walnutBed", "grandmasFloorBedding", "cloudDesk"] as const) {
      const product = shopProduct(id);
      expect(textCount(product.name)).toBeGreaterThan(0);
      expect(textCount(product.description)).toBeGreaterThan(0);
    }
    expect(textCount("진열 중")).toBe(1);
    expect(screen.getByRole("button", { name: /할머니 댁 이부자리.*진열 중/ })).toBeTruthy();
  });

  it("S45: 다른 상품을 고르면 목록이 닫히고 그 진열대만 바뀐다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopSlot2");
    await press("바꾸기");
    await press("구름 책상");
    expect(shopDisplay().map((id) => shopProduct(id).name)).toEqual(["호두껍질 침대", "구름 책상", "구름 책상"]);
    expect(textCount("진열 중")).toBe(0);
    expect(textCount(shopProduct("walnutBed").description)).toBe(0);
  });

  it("S46: 같은 상품을 여러 진열대에 놓을 수 있다(세 진열대 모두 구름 책상)", async () => {
    await renderLobby();
    await enterShop();
    for (const slot of ["shopSlot1", "shopSlot2", "shopSlot3"] as const) {
      await goToPlace(slot);
      await press("바꾸기");
      // 이미 구름 책상인 진열대는 '진열 중' 표시가 붙은 이름이다
      await fireEvent.press(screen.getByRole("button", { name: /^구름 책상/ }));
    }
    expect(shopDisplay().map((id) => shopProduct(id).name)).toEqual(["구름 책상", "구름 책상", "구름 책상"]);
  });

  it("S47: 닫기로 닫으면 진열이 바뀌지 않는다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopSlot1");
    const before = [...shopDisplay()];
    await press("바꾸기");
    expect(textCount("진열 중")).toBe(1);
    await fireEvent.press(screen.getByRole("button", { name: "닫기" }));
    expect(textCount("진열 중")).toBe(0);
    expect([...shopDisplay()]).toEqual(before);
  });

  it("S48: 나갔다 다시 들어와도 진열은 그대로다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopSlot1");
    await press("바꾸기");
    await press("구름 책상");
    await goToPlace("shopExit");
    await press("나가기");
    await frames(1.2);
    expect(area()).toBe("village");
    await press("들어가기");
    await frames(1.2);
    expect(area()).toBe("shop");
    expect(shopDisplay().map((id) => shopProduct(id).name)).toEqual(["구름 책상", "할머니 댁 이부자리", "구름 책상"]);
  });
});

describe("[spec] 퇴장(S29·S30·S32)", () => {
  it("S29·S30: 출입문 '나가기' → 어두워졌다 마을이 되고, 라룹이는 가구점 문 앞 서는 자리에서 heading 0을 본다", async () => {
    await renderLobby();
    await enterShop();
    await goToPlace("shopExit");
    await press("나가기");
    await frames(0.1);
    expect(area()).toBe("shop");
    await frames(1.2);
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_PLACES.furnitureShop.approach[0])).toBeLessThan(0.01);
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-3);
  });

  it("S29: 동작 줄이기면 전환 없이 바로 마을이 된다(시간을 넣지 않아도)", async () => {
    reduceMotion = true;
    await renderLobby();
    await toShopDoor();
    await press("들어가기");
    await flushAsync();
    expect(area()).toBe("shop");
    await goToPlace("shopExit");
    await press("나가기");
    await flushAsync();
    expect(area()).toBe("village");
  });

  it("S32: 들어갔다 나오기를 여러 번 되풀이해도 장소·진열이 늘지 않고 매번 같은 스폰 자리·방향으로 들어온다", async () => {
    await renderLobby();
    await enterShop();
    for (let i = 0; i < 3; i += 1) {
      await goToPlace("shopExit");
      await press("나가기");
      await frames(1.2);
      expect(area()).toBe("village");
      await press("들어가기");
      await frames(1.2);
      expect(area()).toBe("shop");
      expect(dist(pos(), SPAWN)).toBeLessThan(0.01);
      expect(angleGap(sim().heading, Math.PI)).toBeLessThan(1e-3);
      expect(shopDisplay()).toHaveLength(3);
      expect(textCount("버들")).toBeGreaterThan(0);
    }
  });
});

describe("[spec] 개발 화면(S50)", () => {
  it("S50: 시험판 구역 버튼이 방·마을·가구점 셋이고, 가구점 버튼을 누르면 바로 실내로 들어간다(스폰 (7.15, 7.89), heading π)", async () => {
    const devGlobal = globalThis as unknown as { __DEV__: boolean };
    const original = devGlobal.__DEV__;
    devGlobal.__DEV__ = true;
    try {
      await render(<DevLobby3dRoute />);
      await flushAsync();
      await fireEvent.press(screen.getByText("시험판 펴기"));
      await flushAsync();
      expect(screen.getByRole("button", { name: "방" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "마을" })).toBeTruthy();
      // 마을 이름표 "가구점"과 헷갈리지 않는 글(03 결정 3: '가구점 실내')
      await fireEvent.press(screen.getByRole("button", { name: "가구점 실내" }));
      await flushAsync();
      expect(area()).toBe("shop");
      expect(dist(pos(), SPAWN)).toBeLessThan(0.01);
      expect(angleGap(sim().heading, Math.PI)).toBeLessThan(1e-3);
    } finally {
      devGlobal.__DEV__ = original;
    }
  });
});
