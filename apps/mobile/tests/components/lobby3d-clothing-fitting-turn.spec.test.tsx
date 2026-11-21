// [spec] qa 테스트(작업 133 10 피팅 회전판, 기능 변경, 모바일): 피팅 중 위쪽 화면을 옆으로 끌면 라룹이가 제자리에서 돈다(화면 폭 = 360도),
// 바깥 톡은 취소가 아님, 나올 때 걷는 길, 다시 들어가면 정면, 처음 안내 글. 기대값은 10-피팅-회전판/01-main-spec.md에서만 가져온다.
// 끌기는 응답자(responder) 이벤트를 피팅 창 본체 밖의 끌기 영역(onResponderMove/onTouchMove가 달린 요소)에 흘려 시험한다. 못 찾으면 실패한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, Dimensions } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { CLOTHING_MARKS, MARKS, applyArea, findPath, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";
import STOCK from "@/lib/lobby3d/clothing-shop-stock.json";
import { setClothingCurtainClosed } from "@/lib/lobby3d/clothing-shop";
import * as stock from "@/lib/lobby3d/clothing-stock";
import * as catalogStore from "@/lib/item-catalog-store";
import { NO_LOOK, type WearLook } from "@/lib/lobby3d/wear";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
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
      if (area === "clothing1" || area === "clothing2") mockCanvas.props?.onClothingReady?.();
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
const OFFSET = { x: 9, z: 8 };
const PRICES: Record<string, number> = {
  tshirtOrange: 80, shortsNavy: 70, shoesWhite: 90, capOrange: 60, shoesBrown: 90, capBlue: 60, mufflerRed: 90, backpackRed: 120, necklaceGold: 110
};
type Anchors = Record<string, { positionXYZ: number[]; rotationYDegrees: number }>;
const anchor = (floor: 1 | 2, key: string) => (LAYOUT.floors[String(floor) as "1" | "2"].anchors as Anchors)[key];
const appPoint = (floor: 1 | 2, key: string): FloorPoint => ({ x: anchor(floor, key).positionXYZ[0] + OFFSET.x, z: anchor(floor, key).positionXYZ[2] + OFFSET.z });
/** 그 층 피팅룸 앞에서 방 안까지 걸어갈 길이 있는지(커튼이 닫혀 입구가 막히면 없다). */
const roomReachable = (floor: 1 | 2) => findPath(appPoint(floor, "FittingApproach1"), [appPoint(floor, "Fitting1")]) !== null;
const stockRows = STOCK.products as unknown as { id: string; nameKO: string; category: string; catalogId: string | null; floor: number }[];
const UNREGISTERED = stockRows.filter((p) => p.catalogId === null).map((p) => p.id);

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const texts = (value: string) => screen.queryAllByText(value, ALL);
const look = () => canvas().look as WearLook;

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
  await frames(20);
}

async function press(name: string) {
  await fireEvent.press(screen.getAllByRole("button", { name })[0]);
}

/** 줄 이름: 상품 이름과 표시. */
const rowName = (id: string, tag: string) => `${stock.clothingProduct(id)!.name}, ${tag}`;
const rowCount = () => screen.queryAllByRole("button", { name: /, (판매 준비 중|가진 옷|\d+룹)$/ }).length;

const BASE_LOOK: WearLook = { ...NO_LOOK, top: "tshirtOrange", face: "goggles" };

async function renderHome(props: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
  await render(<Lobby3dScreen devPanel={false} look={BASE_LOOK} ownedItems={["tshirtOrange", "shortsBrown"]} {...props} />);
  await flushAsync();
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  await walkTo(VILLAGE_PLACES.clothingShop.approach[0], "clothingShop");
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
}

async function goUp() {
  await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
  await press("올라가기");
  await frames(1.2);
  expect(area()).toBe("clothing2");
}

/** 그 층 피팅룸 앞까지 가서 '들어가기'를 누르고 방 안에 설 때까지 기다린다. */
async function enterFitting(floor: 1 | 2) {
  const id = floor === 1 ? "clothingFitting1" : "clothingFitting2";
  await walkTo(CLOTHING_MARKS[id].approach[0], id);
  expect(sim().snapshot(Date.now()).bubbleText).toBe("피팅룸에 들어갈까?");
  await press("들어가기");
  await frames(6);
}

async function enterHomeFitting(floor: 1 | 2, props: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
  await renderHome(props);
  if (floor === 2) await goUp();
  await enterFitting(floor);
}

function wearable(id: string, slot: string, price: number | null) {
  const file = { url: `/api/catalog/files/${id}.glb`, sha256: id.padEnd(64, "0").slice(0, 64), size: 1 };
  return {
    id, kind: "wearable" as const, name: id, shopName: id, description: "", category: price === null ? null : ("clothes" as const), slot, price,
    draw: { attach: "bone", bone: "head", body: 2 }, assets: { model: file, icon: null }
  };
}

let catalogVersion = 0;
function setCatalog(without: string[] = []) {
  const items = stockRows
    .map((p) => wearable(p.catalogId ?? p.id, p.category, p.catalogId ? PRICES[p.catalogId] : null))
    .concat(wearable("shortsBrown", "bottom", 70), wearable("capGreen", "hat", 60))
    .filter((item) => !without.includes(item.id));
  catalogStore.setItemCatalog({ version: `spec-turn-${++catalogVersion}`, items: items as never });
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  setCatalog();
});

afterEach(() => {
  // 피팅 중에 끝난 시험이 닫힌 커튼(입구 막음)을 다음 시험에 남기지 않게 한다
  setClothingCurtainClosed(null);
  stock.resetClothingShop();
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});


const TWO_PI = Math.PI * 2;
const angleGap = (a: number, b: number) => Math.abs(((((a - b + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI);
const width = () => Dimensions.get("window").width;
const buttons = (name: string) => screen.queryAllByRole("button", { name });
const approachOf = (floor: 1 | 2) => appPoint(floor, "FittingApproach1");

type Host = NonNullable<typeof screen.root>;

/** 응답자(끌기) 처리기가 달린 요소 중 '취소' 버튼을 품은 판(창 본체, 그 스크롤)이 아닌 것. */
function dragTarget(): Host {
  const backdrop = screen.root!.queryAll((node) => node.props.testID === "lobby-sheet-backdrop");
  if (backdrop.length > 0) return backdrop[0];
  const cancel = screen.getAllByRole("button", { name: "취소", ...ALL })[0] as unknown as Host;
  const ancestors = new Set<unknown>();
  for (let node: Host | null = cancel; node; node = node.parent as Host | null) ancestors.add(node);
  const found = screen.root!.queryAll(
    (node) =>
      typeof node.type === "string" &&
      (typeof node.props.onResponderMove === "function" || typeof node.props.onTouchMove === "function") &&
      !ancestors.has(node)
  );
  if (found.length === 0) throw new Error("끌기 영역(onResponderMove/onTouchMove가 달린 요소)을 찾지 못했다");
  return found[0];
}

function touchEvent(startX: number, x: number, t: number, prevX = startX, prevT = 0) {
  const touch = { identifier: 0, pageX: x, pageY: 120, locationX: x, locationY: 120, timestamp: t, target: 1 };
  return {
    persist: () => {},
    preventDefault: () => {},
    stopPropagation: () => {},
    nativeEvent: { ...touch, touches: [touch], changedTouches: [touch] },
    touchHistory: {
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: t,
      numberActiveTouches: 1,
      touchBank: [
        { touchActive: true, startPageX: startX, startPageY: 120, startTimeStamp: 0, currentPageX: x, currentPageY: 120, currentTimeStamp: t, previousPageX: prevX, previousPageY: 120, previousTimeStamp: prevT }
      ]
    }
  };
}

type Handler = ((e: unknown) => void) | undefined;
const handlerOf = (el: Host, name: string) => (el.props as Record<string, Handler>)[name];

/** 위쪽 화면에서 dx만큼 옆으로 끌고(여러 단계) 손을 뗀다. 응답자 이벤트와 터치 이벤트 처리기 중 달린 쪽을 쓴다. */
async function drag(dx: number, steps = 8) {
  const el = dragTarget();
  const startX = width() / 2;
  const responder = typeof handlerOf(el, "onResponderMove") === "function";
  let prevX = startX;
  let prevT = 0;
  const fire = async (kind: "start" | "move" | "end", x: number, t: number) => {
    const ev = touchEvent(startX, x, t, prevX, prevT);
    prevX = x;
    prevT = t;
    await act(async () => {
      if (responder) {
        if (kind === "start") {
          (handlerOf(el, "onStartShouldSetResponder") as unknown as (e: unknown) => boolean)?.(ev);
          handlerOf(el, "onResponderGrant")?.(ev);
        } else if (kind === "move") handlerOf(el, "onResponderMove")?.(ev);
        else handlerOf(el, "onResponderRelease")?.(ev);
      } else handlerOf(el, kind === "start" ? "onTouchStart" : kind === "move" ? "onTouchMove" : "onTouchEnd")?.(ev);
    });
  };
  await fire("start", startX, 1);
  for (let i = 1; i <= steps; i += 1) await fire("move", startX + (dx * i) / steps, 1 + i * 16);
  await fire("end", startX + dx, 2 + steps * 16);
  await frames(0.5);
}

/** 끌지 않고 톡: 접근성 '피팅룸 닫기' 칸이 있으면 누르고, 끌기 영역에는 움직임 없이 누르고 뗀다. */
async function tapOutside() {
  const el = dragTarget();
  for (const b of screen.queryAllByLabelText("피팅룸 닫기", ALL)) await fireEvent.press(b);
  await act(async () => {
    const down = touchEvent(200, 200, 1);
    const up = touchEvent(200, 200, 40);
    (handlerOf(el, "onStartShouldSetResponder") as unknown as (e: unknown) => boolean)?.(down);
    handlerOf(el, "onResponderGrant")?.(down);
    handlerOf(el, "onResponderRelease")?.(up);
    handlerOf(el, "onTouchStart")?.(down);
    handlerOf(el, "onTouchEnd")?.(up);
  });
  await frames(0.5);
}

describe("[spec] 끌어서 돌리기(명세 바뀌는 동작 1)", () => {
  it("피팅 창이 열리면 라룹이는 정면(heading 0)이고, 화면 폭의 1/4을 오른쪽으로 끌면 90°(반 시계 방향 = heading +π/2) 돌아 손을 떼도 그 방향에 머문다", async () => {
    await enterHomeFitting(1);
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-2);
    await drag(width() / 4);
    await frames(2);
    expect(angleGap(sim().heading, Math.PI / 2)).toBeLessThan(0.05);
    await frames(3);
    expect(angleGap(sim().heading, Math.PI / 2)).toBeLessThan(0.05);
  });

  it("왼쪽으로 끌면 반대로 돈다(화면 폭의 1/4 -> heading -π/2)", async () => {
    await enterHomeFitting(1);
    await drag(-width() / 4);
    await frames(2);
    expect(angleGap(sim().heading, -Math.PI / 2)).toBeLessThan(0.05);
  });

  it("화면 폭의 반이면 180°, 두 번 합쳐 폭만큼이면 한 바퀴라 제자리 방향이다", async () => {
    await enterHomeFitting(1);
    await drag(width() / 2);
    await frames(2);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThan(0.05);
    await drag(width() / 2);
    await frames(2);
    expect(angleGap(sim().heading, 0)).toBeLessThan(0.05);
  });

  it("한 번 끄는 동안 한 바퀴를 넘겨도 계속 돈다(폭의 1.25배 -> 90° 지점)", async () => {
    await enterHomeFitting(1);
    await drag(width() * 1.25, 20);
    await frames(2);
    expect(angleGap(sim().heading, Math.PI / 2)).toBeLessThan(0.05);
  });

  it("돌린 뒤에도 입는 옷은 바뀌고 라룹이는 돈 방향에 머문다. 끌기만으로는 착장이 바뀌지 않는다", async () => {
    await enterHomeFitting(1);
    const before = look();
    await drag(width() / 4);
    expect(look()).toEqual(before);
    await press(rowName("capOrange", "60룹"));
    await frames(1);
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(angleGap(sim().heading, Math.PI / 2)).toBeLessThan(0.05);
  });

  it("2층 피팅룸에서도 돈다", async () => {
    await renderHome();
    await goUp();
    await enterFitting(2);
    await drag(width() / 4);
    await frames(2);
    expect(angleGap(sim().heading, Math.PI / 2)).toBeLessThan(0.05);
  });

  it("끌어도 라룹이는 제자리다(걷지 않는다)", async () => {
    await enterHomeFitting(1);
    const inside = appPoint(1, "Fitting1");
    await drag(width() / 3);
    await frames(2);
    expect(dist(pos(), inside)).toBeLessThan(0.05);
    expect(canvas().clothingCurtainClosed).toBe(1);
  });
});

describe("[spec] 바깥 톡은 취소가 아니다(명세 바뀌는 동작 2)", () => {
  it("피팅 창 바깥을 톡 눌러도 피팅이 취소되지 않는다(창·'취소' 버튼·커튼 닫힘·착장 그대로)", async () => {
    await enterHomeFitting(1);
    await press(rowName("capOrange", "60룹"));
    await tapOutside();
    await frames(6);
    expect(buttons("취소").length).toBeGreaterThan(0);
    expect(buttons("장바구니에 넣기").length).toBeGreaterThan(0);
    expect(canvas().clothingCurtainClosed).toBe(1);
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(dist(pos(), appPoint(1, "Fitting1"))).toBeLessThan(0.05);
  });

  it("'취소' 버튼으로는 지금처럼 취소된다(그대로 둘 동작)", async () => {
    await enterHomeFitting(1);
    await press(rowName("capOrange", "60룹"));
    await press("취소");
    await frames(6);
    expect(look()).toEqual(BASE_LOOK);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(buttons("취소")).toHaveLength(0);
  });
});

describe("[spec] 나올 때와 다시 들어갈 때(명세 바뀌는 동작 3)", () => {
  it("돌려 놓고 '취소'해도 지금처럼 방 앞으로 걸어 나오고, 다시 들어가면 정면(heading 0)으로 시작한다", async () => {
    await enterHomeFitting(1);
    await drag(width() / 4);
    await press("취소");
    await frames(6);
    expect(dist(pos(), approachOf(1))).toBeLessThan(0.1);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    await enterFitting(1);
    expect(canvas().clothingCurtainClosed).toBe(1);
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-2);
  });

  it("돌려 놓고 '장바구니에 넣기'로 나와도 방 앞으로 걸어 나오고, 다시 들어가면 정면이다", async () => {
    await enterHomeFitting(1);
    await drag(-width() / 3);
    await press("장바구니에 넣기");
    await frames(6);
    expect(dist(pos(), approachOf(1))).toBeLessThan(0.1);
    await enterFitting(1);
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-2);
  });
});

describe("[spec] 처음 안내(명세 바뀌는 동작 4)", () => {
  const HINT = /옆으로 밀어/;
  it("처음 들어가면 '옆으로 밀어 돌려 보세요' 같은 안내가 보이고, 한 번 돌리면 사라진다", async () => {
    await enterHomeFitting(1);
    expect(screen.queryAllByText(HINT, ALL).length).toBeGreaterThan(0);
    await drag(width() / 4);
    await frames(1);
    expect(screen.queryAllByText(HINT, ALL)).toHaveLength(0);
  });

it("결정 2: 돌려서 안내가 사라진 뒤 나갔다 다시 들어가면 안내가 다시 보이고, 또 돌리면 사라진다", async () => {
    await enterHomeFitting(1);
    await drag(width() / 4);
    await frames(1);
    expect(screen.queryAllByText(HINT, ALL)).toHaveLength(0);
    await press("취소");
    await frames(6);
    await enterFitting(1);
    expect(screen.queryAllByText(HINT, ALL).length).toBeGreaterThan(0);
    await drag(-width() / 4);
    await frames(1);
    expect(screen.queryAllByText(HINT, ALL)).toHaveLength(0);
  });

  it("결정 2: 돌리지 않고 나갔다 다시 들어가도 안내가 보인다(장바구니에 넣기로 나온 경우)", async () => {
    await enterHomeFitting(1);
    await press("장바구니에 넣기");
    await frames(6);
    await enterFitting(1);
    expect(screen.queryAllByText(HINT, ALL).length).toBeGreaterThan(0);
  });

  it("톡만 누르면 안내는 사라지지 않는다", async () => {
    await enterHomeFitting(1);
    await tapOutside();
    expect(screen.queryAllByText(HINT, ALL).length).toBeGreaterThan(0);
  });
});

describe("[spec] 그대로여야 할 동작", () => {
  it("피팅 중 로비를 눌러도 가지 않고, 입기·세트와 저장 기준(저장 호출 없음)이 그대로다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await enterHomeFitting(1, { onSaveLook });
    await drag(width() / 4);
    await press(rowName("capOrange", "60룹"));
    await press("항구 산책 · 마린");
    expect(onSaveLook).not.toHaveBeenCalled();
    const before = pos();
    await walkTo({ x: before.x + 1.5, z: before.z + 1.5 }, null);
    expect(dist(pos(), before)).toBeLessThan(1e-6);
    expect(area()).toBe("clothing1");
  });
});
