// [spec] qa 테스트(작업 062, 기능 변경: 모바일 홈 로비에 책장 장소 "학습 기록"과 아래 메뉴 '학습 기록' 버튼을 더함).
// 기대값은 명세(private 작업 폴더 062-2026-11-08-모바일-로비-책장-학습기록/01-main-spec.md)에서만 가져온다.
// 구현 코드는 부르는 방법(Lobby3dScreen의 속성, 3D 그리기에 넘기는 sim·onFrame·onPointer, 아래 메뉴의 accessibilityState.selected,
// 짧은 안내의 accessibilityRole "alert", 개발 화면 DevLobby3dRoute)을 알려고만 읽었다.
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 받은 속성으로 장소·바닥을 누르고 프레임을 진행한다(061 화면 테스트와 같은 방법).
// 03 결정(사용자, 2026-11-08: 명세 2에서 "이름표를 누르면"을 뺌. 책장은 가구를 누를 때만 그 앞으로 걸어가고,
// 이름표는 다른 장소처럼 누르기를 받지 않는다)을 C2와 K3에 반영했다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): C1~C8.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K3.
// 명세에 없는 이름·숫자(02-qa-tests.md "가정"):
// - 책장 장소의 id는 쓰지 않고 이름표가 "학습 기록"인 장소를 찾는다. 서는 자리·바라볼 지점은 구현의 값을 읽는다
//   (책장 앞인지는 엔진 테스트 lobby3d-bookcase-place.spec.test.ts B2가 본다).
// - 구역 모양은 엔진 테스트와 같다(서는 자리 가운데에서 바라볼 지점까지 잇는 선에서 1칸 안, 겹치면 더 가까운 장소).
//   경계 근처(0.9~1.1칸)와 두 거리 차이가 0.1칸 안인 겹치는 곳은 보지 않는다.
// - "보이는지"는 061 화면 테스트(V5~V9)와 같이 Testing Library 기본 질의 기준(접근성에서 숨긴 말풍선은 보이지 않음)으로 본다.
// - 개발 화면의 짧은 안내 글은 명세에 없어 글 내용은 보지 않고, 짧은 안내(alert)가 뜨고 다른 화면으로 가지 않는 것만 본다.
//   다만 책장의 '들어가기'는 다른 장소처럼 그 장소의 들어갈 때 안내(enterMessage)가 뜨는지 본다.
// 작업 063 03 결정 1(사용자 2026-11-08 "고치기"): '들어가기'를 누른 뒤의 확인을 동작(약 1초)이 끝난 뒤로 옮겼다(C3·C5·C8, waitEnterMotion). 단언은 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import type { TestInstance } from "test-renderer";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import { MARKS, isFree, type FloorPoint, type MarkId, type MarkInfo } from "@/lib/lobby3d/engine";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement("Lobby3dCanvasMock");
    }
  };
});
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 명세의 값 ----------

const BOOK_LABEL = "학습 기록";
const BOOK_PROMPT = "지금까지 쓴 기록이 모여 있어.\n기록을 볼까?";
const BOOK_BUTTON = "들어가기";
/** 명세 4: 아래 메뉴는 한 줄에 넷, 이 순서. */
const MENU_ORDER = ["질문에 답하기", "영어일기", "지금 생각나는대로", "학습 기록"];
/** 장소와 짝인 아래 메뉴(기존 셋은 지금 그대로, 책장은 명세 2의 '학습 기록'). 밖으로는 짝이 없다. */
const OLD_MENU: Record<"board" | "window" | "desk" | "door", string | null> = {
  board: "질문에 답하기",
  window: "지금 생각나는대로",
  desk: "영어일기",
  door: null
};
const OLD_IDS: ("board" | "window" | "desk" | "door")[] = ["board", "window", "desk", "door"];
/** 다른 네 장소의 구역(061 명세 1·03·13 결정). */
const OLD_ZONE: Record<"board" | "window" | "desk" | "door", { center: FloorPoint; wall: FloorPoint | null }> = {
  board: { center: { x: 1.9, z: 1.3 }, wall: { x: 1.8, z: 0 } },
  window: { center: { x: 4.8, z: 1.55 }, wall: { x: 4.8, z: 0 } },
  desk: { center: { x: 1.5, z: 6.75 }, wall: null },
  door: { center: { x: 4.0, z: 10.5 }, wall: null }
};

const NOW = new Date("2026-11-12T03:00:00.000Z");
/**
 * 오래 걸리는 테스트의 시간 제한(062 08 결정: 단언과 입력은 그대로 두고 시간 제한만 늘림). 바닥 격자에서 자리를 찾거나 격자 전체를 보는 테스트는
 * 따로 돌려도 1~4초 걸려, 모바일 테스트 전체와 함께 돌리면 Jest 기본 5초를 넘을 수 있다.
 */
const SLOW_TEST_MS = 20_000;

// ---------- 도우미 ----------

function bookcase(): MarkInfo {
  const found = Object.values(MARKS).filter((mark) => mark.label === BOOK_LABEL);
  expect(found.map((mark) => mark.label)).toEqual([BOOK_LABEL]);
  return found[0];
}

function menuFor(id: MarkId): string | null {
  if (id === bookcase().id) return BOOK_LABEL;
  return OLD_MENU[id as keyof typeof OLD_MENU] ?? null;
}

function distance(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distanceToSegment(p: FloorPoint, a: FloorPoint, b: FloorPoint) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq));
  return distance(p, { x: a.x + dx * t, z: a.z + dz * t });
}

function zoneDistances(p: FloorPoint): { id: MarkId; d: number }[] {
  const list: { id: MarkId; d: number }[] = OLD_IDS.map((id) => {
    const zone = OLD_ZONE[id];
    return { id, d: zone.wall ? distanceToSegment(p, zone.center, zone.wall) : distance(p, zone.center) };
  });
  const book = bookcase();
  const n = book.approach.length;
  const center = { x: book.approach.reduce((s, q) => s + q.x, 0) / n, z: book.approach.reduce((s, q) => s + q.z, 0) / n };
  list.push({ id: book.id, d: distanceToSegment(p, center, book.faceTo) });
  return list;
}

function distOf(p: FloorPoint, id: MarkId) {
  return zoneDistances(p).find((zone) => zone.id === id)!.d;
}

/** 명세대로 안내가 떠야 하는 장소. 어느 구역에서도 1.1칸 밖이면 null, 경계 근처·차이가 작은 겹치는 곳이면 "edge". */
function expectedPlace(p: FloorPoint): MarkId | null | "edge" {
  const [first, second] = zoneDistances(p).sort((a, b) => a.d - b.d);
  if (first.d > 1.1) return null;
  if (first.d >= 0.9) return "edge";
  if (second.d - first.d < 0.1) return "edge";
  return first.id;
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function bestFreePoint(score: (p: FloorPoint) => number): FloorPoint | null {
  let best: FloorPoint | null = null;
  let bestScore = 0;
  for (let x = 0.25; x <= 7.75; x += 0.05) {
    for (let z = 0.45; z <= 10.95; z += 0.05) {
      const p = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
      if (!isFree(p.x, p.z)) continue;
      const s = score(p);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
  }
  return best;
}

/** 책장 구역 한가운데 쪽(다른 구역에서 1.1칸 넘게 떨어진) 자리. */
function bookInsidePoint(): FloorPoint {
  const id = bookcase().id;
  const p = bestFreePoint((q) => (zoneDistances(q).some((zone) => zone.id !== id && zone.d <= 1.1) ? 0 : 0.6 - distOf(q, id)));
  expect(p).not.toBeNull();
  return p!;
}

/** 게시판·책장이 겹치는 곳에서 nearer 쪽이 0.1칸 넘게 가까운 자리. */
function overlapPoint(nearer: "board" | "book"): FloorPoint {
  const id = bookcase().id;
  const p = bestFreePoint((q) => {
    if (zoneDistances(q).some((zone) => zone.id !== id && zone.id !== "board" && zone.d <= 1.1)) return 0;
    const dBoard = distOf(q, "board");
    const dBook = distOf(q, id);
    const gap = nearer === "board" ? dBook - dBoard : dBoard - dBook;
    return Math.min(0.9 - dBoard, 0.9 - dBook, gap - 0.1);
  });
  expect(p).not.toBeNull();
  return p!;
}

async function enter(props: Lobby3dScreenProps) {
  const view = await render(<Lobby3dScreen devPanel={false} {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

/**
 * 작업 063 03 결정 1: '들어가기'를 누른 뒤 같은 일이 동작(약 1초)이 끝난 뒤에 일어난다. 그 일이 일어날 때까지(최대 2.5초)
 * 0.05초씩 프레임을 진행한다(타이머·시계도 함께). 이미 일어났으면 진행하지 않는다.
 */
async function waitEnterMotion(done: () => boolean) {
  for (let elapsed = 0; elapsed < 2.5 && !done(); elapsed += 0.05) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

async function tapFloor(point: FloorPoint) {
  await act(async () => {
    canvas().onPointer("down", { point, mark: null, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    jest.advanceTimersByTime(100);
    canvas().onPointer("up", { point, mark: null, onCharacter: false }, 200, 300);
  });
}

async function tapMark(mark: MarkId) {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    jest.advanceTimersByTime(100);
    canvas().onPointer("up", { point: null, mark, onCharacter: false }, 200, 300);
  });
}

function stoppedAt(point: FloorPoint) {
  const sim = canvas().sim;
  return Math.abs(sim.x - point.x) < 1e-6 && Math.abs(sim.z - point.z) < 1e-6 && sim.vx === 0 && sim.vz === 0;
}

async function walkToFloor(point: FloorPoint) {
  await tapFloor(point);
  for (let index = 0; index < 300 && !stoppedAt(point); index += 1) await frames(0.05);
  const sim = canvas().sim;
  expect({ x: sim.x, z: sim.z, vx: sim.vx, vz: sim.vz }).toEqual({ x: point.x, z: point.z, vx: 0, vz: 0 });
  await frames(0.5);
}

async function walkToMark(mark: MarkId) {
  await tapMark(mark);
  const done = () => canvas().sim.arrived === mark && canvas().sim.vx === 0 && canvas().sim.vz === 0;
  for (let index = 0; index < 300 && !done(); index += 1) await frames(0.05);
  expect(done()).toBe(true);
  await frames(0.5);
}

/** 이 글이 든 보이는 말풍선 판(접근성에서 숨긴 말풍선은 건너뛴다). 없으면 null. */
function shownBubble(line: string) {
  const text = screen.queryAllByText(line)[0];
  if (!text) return null;
  let node = text.parent!;
  while (node.props.pointerEvents === "none") node = node.parent!;
  return node;
}

function shownButton(id: MarkId) {
  const bubble = shownBubble(MARKS[id].prompt);
  if (!bubble) return null;
  return within(bubble).queryAllByRole("button", { name: MARKS[id].buttonLabel })[0] ?? null;
}

/** 강조된 아래 메뉴(네 메뉴 중). */
function selectedMenus() {
  return MENU_ORDER.filter((label) => screen.getByRole("button", { name: label }).props.accessibilityState?.selected === true);
}

function shownPrompts() {
  return (Object.keys(MARKS) as MarkId[]).filter((id) => shownBubble(MARKS[id].prompt) !== null);
}

function textOf(node: TestInstance): string {
  return node
    .queryAll((instance) => instance.type === "Text")
    .map((instance) => instance.children.filter((child) => typeof child === "string").join(""))
    .join("");
}

/** 짧은 안내(accessibilityRole "alert"인 판). 화면 읽기 질의는 View를 접근성 요소로 치지 않아 호스트 트리에서 찾는다. */
function alerts() {
  return screen.root!.queryAll((instance) => typeof instance.type === "string" && instance.props.accessibilityRole === "alert");
}

/** 이름표 글을 감싼 판 중 누르기를 받지 않는 것(pointerEvents "none")이 있는지. 03 결정: 이름표는 누르기를 받지 않고 뒤의 방이 받는다. */
function labelTakesNoTouch(node: TestInstance) {
  let cur: TestInstance | null = node.parent;
  while (cur) {
    if (cur.props.pointerEvents === "none") return true;
    cur = cur.parent;
  }
  return false;
}

function hasButtonAncestor(node: TestInstance) {
  let cur: TestInstance | null = node.parent;
  while (cur) {
    if (cur.props.accessibilityRole === "button") return true;
    cur = cur.parent;
  }
  return false;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.navigate).mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

function routerCalls() {
  return [
    ...jest.mocked(router.push).mock.calls.map((call) => ["push", call[0]]),
    ...jest.mocked(router.replace).mock.calls.map((call) => ["replace", call[0]]),
    ...jest.mocked(router.navigate).mock.calls.map((call) => ["navigate", call[0]])
  ];
}

// ---------- 바뀔 동작 ----------

describe("[spec] 작업 062 바뀔 동작: 아래 메뉴는 한 줄에 넷(명세 4)과 책장 이름표(명세 1)", () => {
  it("C1: 아래 메뉴 버튼은 질문에 답하기, 영어일기, 지금 생각나는대로, 학습 기록 넷이 이 순서로 한 줄(가로, 줄바꿈 없음)에 있다", async () => {
    await enter({ onEnterMark: jest.fn(() => true), onMenu: jest.fn() });

    const row = screen.getByRole("button", { name: "질문에 답하기" }).parent!;
    const buttons = row.children.filter((child): child is TestInstance => typeof child !== "string");
    expect(buttons.map((button) => ({ role: button.props.accessibilityRole, text: textOf(button) }))).toEqual(
      MENU_ORDER.map((text) => ({ role: "button", text }))
    );
    const style = StyleSheet.flatten(row.props.style) ?? {};
    expect({ flexDirection: style.flexDirection, wraps: style.flexWrap === "wrap" }).toEqual({ flexDirection: "row", wraps: false });
  });

  it("C2(03 결정): 방에 책장 이름표 '학습 기록'이 있고(메뉴 버튼 글과 별도), 다른 장소 이름표처럼 누르기를 받지 않는다(감싸개 pointerEvents \"none\")", async () => {
    await enter({ onEnterMark: jest.fn(() => true), onMenu: jest.fn() });

    const labels = screen.getAllByText(BOOK_LABEL).filter((node) => !hasButtonAncestor(node));
    expect(labels).toHaveLength(1);
    expect(labelTakesNoTouch(labels[0])).toBe(true);
  });
});

describe("[spec] 작업 062 그대로 둘 동작: 장소 이름표는 누르기를 받지 않는다(03 결정: 지금 동작 그대로)", () => {
  it("K3: 기존 네 장소의 이름표(오늘의 질문, 생각 창가, 일기 책상, 밖으로)는 누르기를 받지 않는다(감싸개 pointerEvents \"none\")", async () => {
    await enter({ onEnterMark: jest.fn(() => true), onMenu: jest.fn() });

    const result = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로"].map((label) => {
      const nodes = screen.getAllByText(label).filter((node) => !hasButtonAncestor(node));
      return { label, count: nodes.length, noTouch: nodes.length === 1 && labelTakesNoTouch(nodes[0]) };
    });
    expect(result).toEqual(["오늘의 질문", "생각 창가", "일기 책상", "밖으로"].map((label) => ({ label, count: 1, noTouch: true })));
  });
});

describe("[spec] 작업 062 바뀔 동작: 책장도 다른 장소와 똑같이 움직이고 짝인 '학습 기록' 메뉴가 강조된다(명세 2)", () => {
  it("C3: 책장을 누르면 걸어가 도착해 말풍선에 책장 안내와 '들어가기'가 나오고 '학습 기록' 메뉴만 강조되며, '들어가기'를 누르면 책장 장소로 들어간다", async () => {
    const book = bookcase();
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });

    await walkToMark(book.id);

    expect(shownPrompts()).toEqual([book.id]);
    expect(screen.getByText(BOOK_PROMPT)).toBeOnTheScreen();
    expect(selectedMenus()).toEqual([BOOK_LABEL]);
    const button = shownButton(book.id);
    expect(button).not.toBeNull();
    expect(textOf(button!)).toBe(BOOK_BUTTON);
    await fireEvent.press(button!);
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);
    expect(onEnterMark).toHaveBeenCalledTimes(1);
    expect(onEnterMark).toHaveBeenCalledWith(book.id);
  });

  it("C4: 바닥을 눌러 책장 구역 안에 멈추면 책장 안내와 '들어가기'가 나오고 '학습 기록' 메뉴만 강조된다", async () => {
    const book = bookcase();
    await enter({ onEnterMark: jest.fn(() => true), onMenu: jest.fn() });

    await walkToFloor(bookInsidePoint());

    expect(shownPrompts()).toEqual([book.id]);
    expect(shownButton(book.id)).not.toBeNull();
    expect(selectedMenus()).toEqual([BOOK_LABEL]);
  }, SLOW_TEST_MS);

  it("C5: 책장 쪽으로 손을 떼지 않고 끄는 동안, 구역 밖에서는 말풍선·강조가 없고, 책장 구역에 들어서면 책장 안내·버튼이 보이고 '학습 기록'만 강조된다", async () => {
    const book = bookcase();
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });
    const from = { x: 3.5, z: 2.5 };
    await walkToFloor(from);
    expect(expectedPlace(from)).toBeNull();
    const problems: string[] = [];
    let inBook = 0;

    await act(async () => {
      canvas().onPointer("down", { point: from, mark: null, onCharacter: false }, 200, 300);
    });
    await act(async () => {
      canvas().onPointer("move", { point: { x: 0.5, z: 2.5 }, mark: null, onCharacter: false }, 140, 300); // 책장 칸 쪽
    });
    for (let index = 0; index < 60; index += 1) {
      await frames(0.05);
      const sim = canvas().sim;
      const want = expectedPlace({ x: sim.x, z: sim.z });
      if (want === "edge") continue;
      const got = { prompts: shownPrompts(), menus: selectedMenus() };
      const menu = want ? menuFor(want) : null;
      const expected = { prompts: want ? [want] : [], menus: menu ? [menu] : [] };
      if (want === book.id) inBook += 1;
      if (JSON.stringify(got) !== JSON.stringify(expected)) problems.push(`(${sim.x.toFixed(2)}, ${sim.z.toFixed(2)}) ${JSON.stringify(got)}`);
    }

    expect(canvas().sim.dragging).toBe(true);
    expect(inBook).toBeGreaterThan(0);
    expect(problems).toEqual([]);
    expect({ prompts: shownPrompts(), menus: selectedMenus() }).toEqual({ prompts: [book.id], menus: [BOOK_LABEL] });
    const button = shownButton(book.id);
    expect(button).not.toBeNull();
    await fireEvent.press(button!);
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);
    expect(onEnterMark).toHaveBeenCalledWith(book.id);
  });
});

describe("[spec] 작업 062 바뀔 동작: 게시판·책장 구역이 겹치는 곳에서는 더 가까운 장소의 안내와 메뉴 강조(명세 5)", () => {
  const NEARER: ["board" | "book"][] = [["board"], ["book"]];

  it.each(NEARER)("C6: 바닥을 눌러 겹치는 곳 중 %s 쪽이 더 가까운 자리에 멈추면 그 장소 안내만 보이고 짝인 메뉴만 강조된다", async (nearer) => {
    const book = bookcase();
    const id: MarkId = nearer === "board" ? "board" : book.id;
    await enter({ onEnterMark: jest.fn(() => true), onMenu: jest.fn() });

    await walkToFloor(overlapPoint(nearer));

    expect({ prompts: shownPrompts(), menus: selectedMenus() }).toEqual({ prompts: [id], menus: [menuFor(id)] });
  }, SLOW_TEST_MS);
});

describe("[spec] 작업 062 바뀔 동작: 개발 화면(/dev/lobby-3d)에서는 다른 장소·메뉴처럼 짧은 안내만 뜬다(명세 3)", () => {
  const devGlobal = globalThis as unknown as { __DEV__: boolean };
  const originalDev = devGlobal.__DEV__;

  afterEach(() => {
    devGlobal.__DEV__ = originalDev;
  });

  async function enterDev() {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("C7: 개발 화면에서 '학습 기록' 메뉴를 누르면 짧은 안내(alert)가 뜨고 다른 화면으로 가지 않는다", async () => {
    await enterDev();
    expect(alerts()).toHaveLength(0);

    await fireEvent.press(screen.getByRole("button", { name: BOOK_LABEL }));

    const shown = alerts();
    expect(shown).toHaveLength(1);
    expect(textOf(shown[0]).length).toBeGreaterThan(0);
    expect(routerCalls()).toEqual([]);
  });

  it("C8: 개발 화면에서 책장에 도착해 '들어가기'를 누르면 다른 장소처럼 책장 장소의 들어갈 때 안내가 짧은 안내(alert)로 뜨고 다른 화면으로 가지 않는다", async () => {
    const book = bookcase();
    await enterDev();

    await walkToMark(book.id);
    const button = shownButton(book.id);
    expect(button).not.toBeNull();
    await fireEvent.press(button!);
    await waitEnterMotion(() => alerts().length > 0);

    const shown = alerts();
    expect(shown).toHaveLength(1);
    expect(book.enterMessage.length).toBeGreaterThan(0);
    expect(textOf(shown[0])).toBe(book.enterMessage);
    expect(routerCalls()).toEqual([]);
  });
});
