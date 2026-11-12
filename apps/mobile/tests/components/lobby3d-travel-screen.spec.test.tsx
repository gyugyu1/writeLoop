// [spec] qa 테스트(작업 088 ② 방↔마을 오가기, 새 기능, 모바일): 로비 화면(개발 화면과 시험판 없는 로비 화면) 단위.
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/03-방-마을-오가기/02-qa-scenarios.md)와
// 03-main-decision.md(2: 동작 줄이기 + 아직 못 읽음이면 움직임 없이 바로 "마을로 나가는 중…", 다 읽으면 바로 마을.
// 4·5: 전환 중(어두워지는 동안·기다리는 동안·밝아지는 동안)에는 검은 판이 로비 맨 위를 덮어 3D·위 줄·아래 메뉴 누르기가 닿지 않는다)에서만 가져온다.
// 여기서 보는 시나리오: X1·X3(개발 화면), X5, X7~X9, N1, N3, N5~N7, C1~C4, O2(로비 화면), O4, O6, L2~L7, 결정 2(L8), 결정 4·5(B1~B3).
// 홈 화면 단위(X1·X2·X4·X6, N2·N4, H1~H6, O1~O3·O5)는 tests/app/home-lobby-travel.spec.test.tsx가 본다.
//
// 구현(d58b7ca)에서 읽은 것은 부르는 방법뿐이다: 3D 그리기가 받는 onVillageReady·onVillageFailed(마을 모델이 장면에 들어옴·못 읽음),
// 동작 줄이기는 AccessibilityInfo.isReduceMotionEnabled, 장소 말풍선 버튼, 위 줄 버튼 이름.
// 3D 그리기는 Jest에서 돌지 않으므로 가짜로 바꾼다. 가짜는 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부르고,
// 마을 모델 상태(mockVillage.mode)가 "ready"면 구역이 마을로 바뀔 때마다 onVillageReady를, "failed"면 onVillageFailed를 부른다. "pending"이면 부르지 않는다
// (테스트가 나중에 부른다).
// 프레임은 0.05초씩, 가짜 시계·타이머와 함께 넣는다. 구역이 바뀌는 때를 재야 하는 곳은 프레임마다 따로 act로 감싸 화면이 그 사이에 다시 그려지게 한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyArea, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START, type VillageBuildingId } from "@/lib/lobby3d/village";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockVillage: { mode: "ready" | "pending" | "failed" } = { mode: "ready" };

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
      if (area !== "village") return;
      if (mockVillage.mode === "ready") mockCanvas.props?.onVillageReady?.();
      else if (mockVillage.mode === "failed") mockCanvas.props?.onVillageFailed?.();
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
const DOOR_PROMPT = "밖으로 나가 볼까?";
const OLD_DOOR_MESSAGE = "마을은 다음 업데이트에서 열려요";
const HOME_PROMPT = "집으로 들어갈까?";
const CLOSED: Record<Exclude<VillageBuildingId, "home">, { label: string; prompt: string }> = {
  furnitureShop: { label: "가구점", prompt: "가구점은 곧 열려요" },
  cafe: { label: "카페", prompt: "카페는 곧 열려요" },
  library: { label: "도서관", prompt: "도서관은 곧 열려요" }
};
const LOADING = "마을로 나가는 중…";
const FAILED = "마을을 불러오지 못했어요. 잠시 뒤 다시 나가 주세요";
const VILLAGE_LABELS = ["라룹이 집", "가구점", "카페", "도서관"];
const ROOM_ONLY_LABELS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로"];
/** 방 입구 발판 안쪽 서는 자리. */
const ROOM_ENTRY: FloorPoint = { x: 4.0, z: 10.5 };
/** 방 바닥의 걸어갈 수 있는 곳(N6). */
const ROOM_FLOOR: FloorPoint = { x: 2.5, z: 8.5 };
const ALL = { includeHiddenElements: true } as const;

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

// ---------- 도우미 ----------

type UiNode = ReturnType<typeof screen.getByRole>;

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

function sim() {
  return canvas().sim;
}

function area() {
  return canvas().area ?? "room";
}

function pos(): FloorPoint {
  return { x: sim().x, z: sim().z };
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 방향 a가 b와 2π 단위로 같은지(차이). */
function angleGap(a: number, b: number) {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
}

function textCount(text: string) {
  return screen.queryAllByText(text, ALL).length;
}

async function setReduceMotion(enabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(enabled);
}

async function renderDev() {
  devGlobal.__DEV__ = true;
  await render(<DevLobby3dRoute />);
  await flushAsync();
}

async function renderLobby(props: Lobby3dScreenProps = {}) {
  const view = await render(<Lobby3dScreen devPanel={false} {...props} />);
  await flushAsync();
  return view;
}

/** seconds만큼 프레임을 한 act 안에서 돌린다(가짜 시계·타이머도 함께). */
async function frames(seconds: number, eachFrame?: () => void) {
  const count = Math.round(seconds / 0.05);
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
      eachFrame?.();
    }
  });
}

/** 프레임 하나를 따로 act로 돌린다(그 뒤 화면이 다시 그려진다). */
async function step() {
  await act(async () => {
    jest.advanceTimersByTime(50);
    canvas().onFrame(0.05, Date.now());
  });
}

/** 프레임을 하나씩 넣어 seconds초까지. 프레임마다 check를 부른다. */
async function steps(seconds: number, check?: (elapsed: number) => void) {
  const count = Math.round(seconds / 0.05);
  for (let i = 1; i <= count; i += 1) {
    await step();
    check?.(i * 0.05);
  }
}

/** 구역이 from에서 바뀔 때까지 프레임을 하나씩 넣는다(최대 limit초). 바뀐 때(누른 뒤 지난 초, 이미 지난 already 포함)를 돌려준다. */
async function untilAreaLeaves(from: "room" | "village", already: number, limit = 3): Promise<number> {
  let elapsed = already;
  while (area() === from && elapsed < limit) {
    await step();
    elapsed += 0.05;
  }
  return elapsed;
}

async function tap(point: FloorPoint | null, mark: PointerHit["mark"] = null) {
  const hit: PointerHit = { point, mark, onCharacter: false };
  await act(async () => {
    canvas().onPointer("down", hit, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
}

/** 장소를 눌러 그 서는 자리에 걸어가 멈출 때까지 프레임을 넣는다. */
async function walkTo(point: FloorPoint, mark: PointerHit["mark"] = null, seconds = 40) {
  await tap(point, mark);
  await frames(seconds);
  expect(dist(pos(), point)).toBeLessThanOrEqual(0.06);
}

/** 마을에서 걸어갈 수 있는, target에 가장 가까운 칸 가운데. */
function villageFreeNear(target: FloorPoint): FloorPoint {
  let best: FloorPoint | null = null;
  for (let c = 0; c < VILLAGE.width; c += 1) {
    for (let r = 0; r < VILLAGE.depth; r += 1) {
      const p = { x: c + 0.5, z: r + 0.5 };
      if (isFree(p.x, p.z, VILLAGE_SOLID_TILES, VILLAGE) && (!best || dist(p, target) < dist(best, target))) best = p;
    }
  }
  expect(best).not.toBeNull();
  return best!;
}

/** VILLAGE_START에서 3칸 넘게 떨어진 마을 바닥. */
function farVillageFloor(): FloorPoint {
  const p = villageFreeNear({ x: VILLAGE_START.x + 4, z: VILLAGE_START.z + 3 });
  expect(dist(p, VILLAGE_START)).toBeGreaterThan(3);
  return p;
}

/** 방의 '밖으로'에 걸어가 도착한다. */
async function arriveAtDoor() {
  await walkTo(MARKS.door.approach[0], "door", 10);
  expect(sim().snapshot(Date.now()).bubbleButton).toBe("나가기");
}

async function pressBubble(name: "나가기" | "들어가기") {
  await fireEvent.press(screen.getByRole("button", { name }));
}

/** '나가기'를 눌러 마을로 나가고 밝아짐이 끝날 때까지(1.0초 넘게) 기다린다. */
async function goOut() {
  await arriveAtDoor();
  await pressBubble("나가기");
  await steps(1.2);
  expect(area()).toBe("village");
}

/** 마을에서 라룹이 집 서는 자리가 아닌 곳으로 걸어갔다가 라룹이 집 장소에 도착한다. */
async function arriveAtHome() {
  await walkTo(farVillageFloor());
  await walkTo(VILLAGE_PLACES.home.approach[0], "home");
}

/** 꼬리 그림자: 노드 n과 그 조상이 화면 위치에서 이후(위)에 그려지는지 보려고, 루트부터의 자식 번호 길. */
function pathOf(node: UiNode): number[] {
  const path: number[] = [];
  for (let n: UiNode = node; n.parent; n = n.parent) {
    const siblings = n.parent.children.filter((child): child is UiNode => typeof child !== "string");
    path.unshift(siblings.indexOf(n));
  }
  return path;
}

function isAncestor(a: UiNode, b: UiNode) {
  for (let n: UiNode | null = b; n; n = n.parent) if (n === a) return true;
  return false;
}

function comesAfter(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return a.length > b.length;
}

/**
 * target 위를 덮어 누르기를 가로채는 판들: 누르기를 받는(pointerEvents가 none·box-none이 아닌) 화면 전체 크기의 절대 위치 판으로,
 * target을 품지 않고 target보다 뒤에(위에) 그려지며 target과 같은 부모 아래에 있는 것.
 */
function blockersOver(target: UiNode): UiNode[] {
  const targetPath = pathOf(target);
  return screen.root!.queryAll((node) => {
    if (typeof node.type !== "string") return false;
    const props = node.props as { pointerEvents?: string; style?: unknown };
    if (props.pointerEvents === "none" || props.pointerEvents === "box-none") return false;
    const style = (StyleSheet.flatten(props.style as never) ?? {}) as Record<string, unknown>;
    const fill = style.position === "absolute" && style.top === 0 && style.left === 0 && style.right === 0 && style.bottom === 0;
    if (!fill || isAncestor(node, target)) return false;
    if (!node.parent || !isAncestor(node.parent, target)) return false;
    return comesAfter(pathOf(node), targetPath);
  });
}

function canvasNode(): UiNode {
  return screen.root!.queryAll((node) => (node.type as unknown) === "Lobby3dCanvasMock")[0];
}

/**
 * Jest에는 네이티브 애니메이션 쪽이 없어, useNativeDriver: true인 움직임이 첫 프레임(약 16ms)에 바로 끝난다(기기에서는 정해진 시간만큼 걸린다).
 * 전환 시간을 재려고, 테스트에서만 움직임을 자바스크립트 쪽에서 돌리게 한다(시간·값은 그대로). 기대값과는 상관없는 시험 환경 맞춤이다.
 */
function useJsAnimation() {
  const realTiming = Animated.timing;
  jest
    .spyOn(Animated, "timing")
    .mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockVillage.mode = "ready";
  await setReduceMotion(false);
  useJsAnimation();
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- X. 방 → 마을 ----------

describe("[spec] 방 → 마을(X)", () => {
  it("X1(개발 화면): '밖으로'에 도착하면 말풍선 글이 정확히 '밖으로 나가 볼까?'이고 버튼은 '나가기', 이름표는 '밖으로'다", async () => {
    await renderDev();
    await arriveAtDoor();
    const snap = sim().snapshot(Date.now());
    expect(snap.bubbleText).toBe(DOOR_PROMPT);
    expect(snap.bubbleButton).toBe("나가기");
    expect(screen.getByText(DOOR_PROMPT)).toBeTruthy();
    expect(screen.queryByText(/마을은 다음에 열려/, ALL)).toBeNull();
    expect(screen.getByRole("button", { name: "나가기" })).toBeTruthy();
    expect(textCount("밖으로")).toBe(1);
  });

  it("X3(개발 화면): '나가기'를 누르면 0.1초에는 아직 방, 0.2~0.5초 사이에 마을로 바뀌어 VILLAGE_START에 방향 0으로 서고, 3초 뒤에도 그대로다", async () => {
    await renderDev();
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(0.1);
    expect(area()).toBe("room");

    const switched = await untilAreaLeaves("room", 0.1);
    expect(area()).toBe("village");
    expect(switched).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(switched).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);

    await frames(3);
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);
    expect(sim().snapshot(Date.now()).moving).toBe(false);
    expect(screen.queryByText(OLD_DOOR_MESSAGE, ALL)).toBeNull();
  });

  it("X5: 동작 줄이기면 '나가기'를 누르는 즉시(시간을 넣지 않고) 마을이고, 바로 마을 바닥을 누르면 걷기 시작한다", async () => {
    await setReduceMotion(true);
    await renderDev();
    await arriveAtDoor();
    await pressBubble("나가기");
    await flushAsync();
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);

    await tap(farVillageFloor());
    await frames(0.3);
    expect(sim().snapshot(Date.now()).moving).toBe(true);
  });

  it("X7: 어두워지는 동안(누른 뒤 0.1초) 방 바닥을 누르면 닿지 않아, 마을로 바뀐 뒤 라룹이는 VILLAGE_START에 그대로다", async () => {
    await renderDev();
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(0.1);
    expect(area()).toBe("room");
    await tap(ROOM_FLOOR);
    await steps(2);
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
  });

  it("X8: 밝아지는 동안(마을로 바뀐 프레임에서 0.1초 뒤) 마을 바닥을 누르면 닿지 않아 라룹이는 VILLAGE_START에 그대로다", async () => {
    await renderDev();
    await arriveAtDoor();
    await pressBubble("나가기");
    await untilAreaLeaves("room", 0);
    expect(area()).toBe("village");
    await steps(0.1);
    await tap(farVillageFloor());
    await steps(2);
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
  });

  it("X9: 누른 뒤 1.0초가 지나면 마을 바닥을 눌러 그곳까지 걸어간다", async () => {
    await renderDev();
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(1.0);
    const target = farVillageFloor();
    await tap(target);
    await frames(20);
    expect(dist(pos(), target)).toBeLessThanOrEqual(0.06);
  });
});

// ---------- N. 마을 → 방 ----------

describe("[spec] 마을 → 방(N)", () => {
  it("N1: 마을의 라룹이 집 장소에 도착하면 이름표 '라룹이 집', 말풍선 '집으로 들어갈까?', 버튼 '들어가기'다", async () => {
    await renderDev();
    await goOut();
    await arriveAtHome();
    const snap = sim().snapshot(Date.now());
    expect(snap.bubbleText).toBe(HOME_PROMPT);
    expect(snap.bubbleButton).toBe("들어가기");
    expect(textCount("라룹이 집")).toBe(1);
    expect(screen.getByText(HOME_PROMPT)).toBeTruthy();
    expect(screen.getByRole("button", { name: "들어가기" })).toBeTruthy();
  });

  it("N3(개발 화면): '들어가기'를 누르면 0.1초에는 아직 마을, 0.2~0.5초 사이에 방으로 바뀌어 (4.0, 10.5)에 방향 π로 서고, 방 이름표가 돌아온다", async () => {
    await renderDev();
    await goOut();
    await arriveAtHome();
    await pressBubble("들어가기");
    await steps(0.1);
    expect(area()).toBe("village");

    const switched = await untilAreaLeaves("village", 0.1);
    expect(area()).toBe("room");
    expect(switched).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(switched).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(dist(pos(), ROOM_ENTRY)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThanOrEqual(1e-6);

    await steps(1.0);
    for (const label of ROOM_ONLY_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 1 });
    for (const label of VILLAGE_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 0 });
  });

  it("N5: 동작 줄이기면 '들어가기'를 누르는 즉시 방의 (4.0, 10.5)에 방향 π로 선다", async () => {
    await setReduceMotion(true);
    await renderDev();
    await goOut();
    await arriveAtHome();
    await pressBubble("들어가기");
    await flushAsync();
    expect(area()).toBe("room");
    expect(dist(pos(), ROOM_ENTRY)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThanOrEqual(1e-6);
  });

  it("N6: 전환 중(누른 뒤 0.1초에 마을 바닥, 방으로 바뀐 뒤 0.1초에 방 바닥)에 누르면 닿지 않아 (4.0, 10.5)에 그대로다", async () => {
    await renderDev();
    await goOut();
    await arriveAtHome();
    await pressBubble("들어가기");
    await steps(0.1);
    await tap(farVillageFloor());
    await untilAreaLeaves("village", 0.1);
    expect(area()).toBe("room");
    await steps(0.1);
    await tap(ROOM_FLOOR);
    await steps(2);
    expect(dist(pos(), ROOM_ENTRY)).toBeLessThanOrEqual(1e-6);
  });

  it("N7: 방에 들어온 뒤 '밖으로'에서 다시 '나가기'를 누르면 다시 마을의 VILLAGE_START에 방향 0으로 선다", async () => {
    await renderDev();
    await goOut();
    await arriveAtHome();
    await pressBubble("들어가기");
    await steps(1.2);
    expect(area()).toBe("room");
    expect(isFree(ROOM_FLOOR.x, ROOM_FLOOR.z)).toBe(true);
    await walkTo(ROOM_FLOOR, null, 10);
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(1.2);
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);
  });
});

// ---------- C. 닫힌 건물 ----------

describe("[spec] 닫힌 건물(C1~C4)", () => {
  it.each(Object.entries(CLOSED))("C1~C3 화면: %s 문 앞에 도착하면 그 말풍선 글이 보이고, 그 말풍선에 버튼이 없다", async (id, { prompt }) => {
    await renderDev();
    await goOut();
    await walkTo(VILLAGE_PLACES[id as VillageBuildingId].approach[0], id as VillageBuildingId);
    expect(screen.getByText(prompt)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "들어가기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "나가기" })).toBeNull();
    // 그 글을 품은 말풍선(누르기를 받지 않는 감싸개를 건너 올라간 판) 안에 버튼이 없다
    let bubble = screen.getByText(prompt).parent!;
    while (bubble.props.pointerEvents === "none") bubble = bubble.parent!;
    expect(bubble.queryAll((node) => (node.props as { accessibilityRole?: string }).accessibilityRole === "button")).toHaveLength(0);
  });

  it.each(Object.entries(CLOSED))("C1~C3 상태: %s 문 앞에 도착하면 말풍선 글이 정확히 그 안내이고 버튼 값은 null이다", async (id, { prompt }) => {
    await renderDev();
    await goOut();
    await walkTo(VILLAGE_PLACES[id as VillageBuildingId].approach[0], id as VillageBuildingId);
    const snap = sim().snapshot(Date.now());
    expect(snap.bubbleText).toBe(prompt);
    expect(snap.bubbleButton).toBeNull();
  });

  it.each(Object.entries(CLOSED))("C4: %s 문 앞에 도착한 뒤 2초가 지나도 마을 그대로이고 라룹이는 그 서는 자리에 그대로다", async (id) => {
    await renderDev();
    await goOut();
    const spot = VILLAGE_PLACES[id as VillageBuildingId].approach[0];
    await walkTo(spot, id as VillageBuildingId);
    const before = pos();
    await steps(2);
    expect(area()).toBe("village");
    expect(dist(pos(), before)).toBeLessThanOrEqual(1e-6);
  });
});

// ---------- O. 그 밖 ----------

describe("[spec] 그 밖의 동작(O2·O4·O6)", () => {
  it("O2(로비 화면): 마을에 나온 뒤 로비 화면을 내리고 다시 그리면 방에서 시작한다", async () => {
    const view = await renderLobby();
    await goOut();
    await view.unmount();
    mockCanvas.props = null;
    await renderLobby();
    expect(area()).toBe("room");
    for (const label of ROOM_ONLY_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 1 });
    for (const label of VILLAGE_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 0 });
  });

  it("O4: 마을에서 새 인사를 받으면 마을 그대로 그 인사 글과 '이어 쓰기' 버튼이 보이고, 누르면 그 함수가 한 번 불린다", async () => {
    const onResume = jest.fn();
    const idleButton = { label: "이어 쓰기", onPress: onResume };
    const view = await renderLobby({ idleButton, greeting: null });
    await goOut();

    const line = "쓰다 만 답이 있어. 이어서 써 볼까?";
    await view.rerender(<Lobby3dScreen devPanel={false} idleButton={idleButton} greeting={{ line, action: "point", key: 2 }} />);
    await flushAsync();
    await frames(0.2);

    expect(area()).toBe("village");
    expect(screen.getByText(line)).toBeTruthy();
    const button = screen.getByRole("button", { name: "이어 쓰기" });
    await fireEvent.press(button);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("O6: 시험판의 '마을'·'방'은 누르는 즉시(시간을 넣지 않고) 바뀌고, '마을로 나가는 중…'은 보이지 않는다", async () => {
    await renderDev();
    await fireEvent.press(screen.getByText("시험판 펴기"));
    await flushAsync();

    await fireEvent.press(screen.getByRole("button", { name: "마을" }));
    await flushAsync();
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);
    expect(screen.queryByText(LOADING, ALL)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "방" }));
    await flushAsync();
    expect(area()).toBe("room");
    expect(dist(pos(), ROOM_ENTRY)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThanOrEqual(1e-6);
    expect(screen.queryByText(LOADING, ALL)).toBeNull();
  });
});

// ---------- L. 마을 모델 미리 불러오기(화면 쪽) ----------

describe("[spec] 마을 모델을 읽는 중·못 읽음(L2~L7, 결정 2)", () => {
  it("L2: 모델을 다 읽었으면 '나가기'부터 밝아짐이 끝날 때까지 '마을로 나가는 중…'이 한 번도 보이지 않는다", async () => {
    await renderLobby();
    await arriveAtDoor();
    await pressBubble("나가기");
    const seen: number[] = [];
    await steps(1.5, (elapsed) => {
      if (screen.queryAllByText(LOADING, ALL).length > 0) seen.push(Number(elapsed.toFixed(2)));
    });
    expect(area()).toBe("village");
    expect(seen).toEqual([]);
  });

  it("L3: 읽는 중에 '나가기'를 누르면 2초 동안 방이고, 누른 뒤 0.5초부터 '마을로 나가는 중…'이 보인다", async () => {
    mockVillage.mode = "pending";
    await renderLobby();
    await arriveAtDoor();
    await pressBubble("나가기");
    const areas: string[] = [];
    const missingText: number[] = [];
    await steps(2, (elapsed) => {
      areas.push(area());
      if (elapsed >= 0.5 - 1e-9 && screen.queryAllByText(LOADING).length === 0) missingText.push(Number(elapsed.toFixed(2)));
    });
    expect([...new Set(areas)]).toEqual(["room"]);
    expect(missingText).toEqual([]);
  });

  it("L4: 읽는 중에 나간 뒤 모델 읽음을 알리면 1.0초 안에 마을이 VILLAGE_START·방향 0으로 보이고, 글이 사라지며, 바닥을 누르면 걷는다", async () => {
    mockVillage.mode = "pending";
    await renderLobby();
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(2);

    await act(async () => {
      canvas().onVillageReady?.();
    });
    await steps(1.0);
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);
    expect(screen.queryAllByText(LOADING, ALL)).toHaveLength(0);

    const target = farVillageFloor();
    await tap(target);
    await frames(20);
    expect(dist(pos(), target)).toBeLessThanOrEqual(0.06);
  });

  it("L5: 읽는 중에 실패를 알리면 방 그대로, 누르기 전 자리 그대로이고, 글이 사라지며 실패 안내가 보이고, 방 바닥을 누르면 걷는다", async () => {
    mockVillage.mode = "pending";
    await renderLobby();
    await arriveAtDoor();
    const before = pos();
    await pressBubble("나가기");
    await steps(2);

    await act(async () => {
      canvas().onVillageFailed?.();
    });
    await steps(1.0);
    expect(area()).toBe("room");
    expect(dist(pos(), before)).toBeLessThanOrEqual(1e-6);
    expect(screen.queryAllByText(LOADING, ALL)).toHaveLength(0);
    expect(screen.getByText(FAILED)).toBeTruthy();

    await tap(ROOM_FLOOR);
    await frames(0.3);
    expect(sim().snapshot(Date.now()).moving).toBe(true);
  });

  it("L6: 모델을 읽지 못하는 상태에서 '나가기'를 누르면 1.0초 뒤 방 그대로, 자리 그대로, 같은 안내, '마을로 나가는 중…' 없음", async () => {
    mockVillage.mode = "failed";
    await renderLobby();
    await arriveAtDoor();
    const before = pos();
    await pressBubble("나가기");
    await steps(1.0);
    expect(area()).toBe("room");
    expect(dist(pos(), before)).toBeLessThanOrEqual(1e-6);
    expect(screen.getByText(FAILED)).toBeTruthy();
    expect(screen.queryAllByText(LOADING, ALL)).toHaveLength(0);
  });

  it("L7: 실패 뒤 라룹이가 '밖으로' 장소에 그대로 있어 말풍선 '밖으로 나가 볼까?'와 '나가기' 버튼이 다시 보인다", async () => {
    mockVillage.mode = "pending";
    await renderLobby();
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(2);
    await act(async () => {
      canvas().onVillageFailed?.();
    });
    await steps(1.0);
    expect(screen.getByText(DOOR_PROMPT)).toBeTruthy();
    expect(screen.getByRole("button", { name: "나가기" })).toBeTruthy();
  });

  it("L8(결정 2): 동작 줄이기 + 읽는 중이면 누르는 즉시 '마을로 나가는 중…'이 보이고, 읽음을 알리면 즉시 마을이 보이며 바로 누를 수 있다", async () => {
    await setReduceMotion(true);
    mockVillage.mode = "pending";
    await renderLobby();
    await arriveAtDoor();
    await pressBubble("나가기");
    await flushAsync();
    expect(screen.getByText(LOADING)).toBeTruthy();

    await act(async () => {
      canvas().onVillageReady?.();
    });
    await flushAsync();
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(screen.queryAllByText(LOADING, ALL)).toHaveLength(0);
    await tap(farVillageFloor());
    await frames(0.3);
    expect(sim().snapshot(Date.now()).moving).toBe(true);
  });
});

// ---------- B. 전환 중에는 판이 로비를 덮는다(결정 4·5) ----------

describe("[spec] 전환 중에는 3D·위 줄·아래 메뉴 위를 누르기를 받는 판이 덮는다(결정 4·5)", () => {
  function targets(): Record<string, UiNode> {
    return {
      "3D": canvasNode(),
      "카메라 거리 설정": screen.getByRole("button", { name: "카메라 거리 설정", ...ALL }),
      "질문에 답하기": screen.getByRole("button", { name: "질문에 답하기", ...ALL })
    };
  }

  function covered(): Record<string, boolean> {
    return Object.fromEntries(Object.entries(targets()).map(([name, node]) => [name, blockersOver(node).length > 0]));
  }

  const ALL_COVERED = { "3D": true, "카메라 거리 설정": true, "질문에 답하기": true };
  const NONE_COVERED = { "3D": false, "카메라 거리 설정": false, "질문에 답하기": false };

  it("B1: 전환 전에는 덮는 판이 없고, 어두워지는 동안(0.1초)과 밝아지는 동안(바뀐 뒤 0.1초)에는 덮이며, 1.0초 뒤에는 다시 없다", async () => {
    await renderLobby({ onMenu: jest.fn() });
    await arriveAtDoor();
    expect(covered()).toEqual(NONE_COVERED);
    await pressBubble("나가기");
    await steps(0.1);
    expect(covered()).toEqual(ALL_COVERED);
    await untilAreaLeaves("room", 0.1);
    await steps(0.1);
    expect(covered()).toEqual(ALL_COVERED);
    await steps(1.0);
    expect(covered()).toEqual(NONE_COVERED);
  });

  it("B2: '마을로 나가는 중…'을 기다리는 동안 덮여 있고, 읽음을 알려 밝아진 뒤에는 없다", async () => {
    mockVillage.mode = "pending";
    await renderLobby({ onMenu: jest.fn() });
    await arriveAtDoor();
    await pressBubble("나가기");
    await steps(1.5);
    expect(screen.getByText(LOADING)).toBeTruthy();
    expect(covered()).toEqual(ALL_COVERED);
    await act(async () => {
      canvas().onVillageReady?.();
    });
    await steps(1.0);
    expect(covered()).toEqual(NONE_COVERED);
  });

  it("B3: 마을 → 방 전환 중에도 덮이고, 끝나면 없다", async () => {
    await renderLobby({ onMenu: jest.fn() });
    await goOut();
    await arriveAtHome();
    await pressBubble("들어가기");
    await steps(0.1);
    expect(covered()).toEqual(ALL_COVERED);
    await steps(1.2);
    expect(area()).toBe("room");
    expect(covered()).toEqual(NONE_COVERED);
  });
});
