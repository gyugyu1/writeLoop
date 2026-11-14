// [spec] qa 테스트(작업 089 ③ 옷장 장소와 캐릭터 꾸미기 화면, 새 기능, 모바일): 방 화면(Lobby3dScreen)의 옷장 이름표·말풍선·들어가기.
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/02-qa-scenarios.md의 P1·P2·P7·P9~P13)와
// 03-main-decision.md B(1: 옷장 가구를 누르면 걸어가고 이름표는 누르기를 받지 않는다, 2: 손님 말풍선은 로비 화면의 signedIn이 false일 때,
// 9: 개발 화면에서는 이름표·말풍선이 보이고 '들어가기'는 아무것도 열지 않는다, 10: '들어가기' 뒤 동작 없이 바로 연다),
// 06-main-decision.md(사용자 결정: 로그인한 사용자의 옷장 말풍선은 대사 없이 '들어가기' 버튼만, 손님 말풍선은 그대로)에서만 가져온다.
// 06 결정에 따라 시나리오의 "말풍선 글이 '옷장이야.\n옷을 갈아입어 볼까?'이고 버튼 '들어가기'"는 "보이는 말풍선에 글 없이 버튼 '들어가기'만"으로 옮겼다.
// 보이는 '들어가기'는 지금 장소의 말풍선 것뿐이다(다른 장소의 말풍선은 접근성에서 숨는다).
// 구현 커밋 fefbafa·43a1eeb에서 읽은 것은 부르는 방법뿐이다: Lobby3dScreen의 속성 layout·signedIn·onEnterCloset·onSaveLayout, 3D 그리기에 넘기는
// sim·onFrame·onPointer·onRoomShown·onVillageReady, 엔진의 roomPlaceIds·markInfo(옷장 장소 id를 이름표 "옷장"으로 찾는 데만).
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 받은 속성으로 장소·바닥을 누르고 프레임을 진행한다(062 책장 화면 테스트와 같은 방법).
// "보이는지"는 Testing Library 기본 질의 기준(접근성에서 숨긴 말풍선은 보이지 않음)으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import type { TestInstance } from "test-renderer";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyArea, applyLobbyLayout, markInfo, roomPlaceIds, setClosetSignedIn, type PlaceId } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

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

// ---------- 시나리오의 값 ----------

const CLOSET_LABEL = "옷장";
const CLOSET_BUTTON = "들어가기";
const GUEST_PROMPT = "로그인하면 라룹이 옷을\n갈아입힐 수 있어";
const OLD_LABELS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로", "학습 기록"];
const MENU_ORDER = ["질문에 답하기", "영어일기", "지금 생각나는대로", "학습 기록"];
const VILLAGE_LABEL_COUNT = 4;
const NOW = new Date("2026-11-13T03:00:00.000Z");
const SLOW_TEST_MS = 20_000;

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const L0 = () => copy(DEFAULT_LOBBY_LAYOUT);
const L_TWO = () =>
  makeLayout([...copy(DEFAULT_LOBBY_LAYOUT.items), { id: "wardrobe-2", type: "wardrobe", floor: { x: 6.5, z: 7.5, facing: 3 } }], []);
const L_STORED = () =>
  makeLayout(
    copy(DEFAULT_LOBBY_LAYOUT.items).filter((item: FurnitureItem) => item.id !== "wardrobe"),
    [{ id: "wardrobe", type: "wardrobe" }]
  );

// ---------- 도우미 ----------

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

/** 이름표가 "옷장"인 지금 방의 장소들(누를 장소를 찾는 데만 쓴다). */
function closets(): PlaceId[] {
  return roomPlaceIds().filter((id) => markInfo(id).label === CLOSET_LABEL);
}

async function enter(props: Lobby3dScreenProps) {
  const view = await render(<Lobby3dScreen devPanel={false} {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  await frames(0.1);
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

async function tapMark(mark: PlaceId) {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    jest.advanceTimersByTime(100);
    canvas().onPointer("up", { point: null, mark, onCharacter: false }, 200, 300);
  });
}

async function walkToMark(mark: PlaceId) {
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

function buttonIn(bubble: TestInstance | null, name: string) {
  if (!bubble) return null;
  return within(bubble).queryAllByRole("button", { name })[0] ?? null;
}

/** 보이는 '들어가기' 버튼들(지금 장소의 말풍선 것). */
function shownEnterButtons() {
  return screen.queryAllByRole("button", { name: CLOSET_BUTTON });
}

/** 버튼이 든 말풍선 판에서 버튼 글을 뺀 글들(06 결정: 옷장 말풍선은 대사가 없어 빈 목록이어야 한다). */
function bubbleTextsBesides(button: TestInstance): string[] {
  const own = new Set(button.queryAll((n) => n.type === "Text"));
  return button
    .parent!.queryAll((n) => n.type === "Text" && !own.has(n))
    .map((n) => n.children.filter((child) => typeof child === "string").join(""))
    .filter((text) => text !== "");
}

function labelTexts(name: string) {
  return screen.queryAllByText(name);
}

function labelTakesNoTouch(node: TestInstance) {
  let cur: TestInstance | null = node.parent;
  while (cur) {
    if (cur.props.pointerEvents === "none") return true;
    cur = cur.parent;
  }
  return false;
}

function routerCalls() {
  return [
    ...jest.mocked(router.push).mock.calls.map((call) => ["push", call[0]]),
    ...jest.mocked(router.replace).mock.calls.map((call) => ["replace", call[0]]),
    ...jest.mocked(router.navigate).mock.calls.map((call) => ["navigate", call[0]])
  ];
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  applyArea("room");
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.navigate).mockReset();
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  setClosetSignedIn(true);
  applyArea("room");
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
});

// ---------- P. 방 화면의 옷장 ----------

describe("[spec] 089-③ P: 방에 놓인 옷장에 이름표 '옷장'이 붙고, 누르면 걸어가 말풍선을 띄운다", () => {
  it("P1(03 결정 B1): 처음 배치(L0)에서 이름표 '옷장'이 정확히 하나 보이고 누르기를 받지 않으며, 기존 다섯 장소 이름표도 그대로 보인다", async () => {
    await enter({ layout: L0(), onEnterCloset: jest.fn() });
    const labels = labelTexts(CLOSET_LABEL);
    expect(labels).toHaveLength(1);
    expect(labelTakesNoTouch(labels[0])).toBe(true);
    expect(OLD_LABELS.map((name) => labelTexts(name).length >= 1)).toEqual(OLD_LABELS.map(() => true));
  });

  it(
    "P2(06 결정): 옷장을 누르고 도착하면 옷장 말풍선이 보이고, 그 말풍선에는 대사 없이 버튼 '들어가기'만 있다",
    async () => {
      await enter({ layout: L0(), onEnterCloset: jest.fn() });
      const [id] = closets();
      await walkToMark(id);
      expect(canvas().sim.snapshot(Date.now()).place).toBe(id);
      const buttons = shownEnterButtons();
      expect(buttons).toHaveLength(1);
      expect(bubbleTextsBesides(buttons[0])).toEqual([]);
    },
    SLOW_TEST_MS
  );

  it(
    "P3·03 결정 B10: '들어가기'를 누르면 프레임을 진행하지 않아도 바로 꾸미기 화면 열기(onEnterCloset)가 한 번 불리고, 라우터로 다른 화면에 가지 않는다",
    async () => {
      const onEnterCloset = jest.fn();
      await enter({ layout: L0(), onEnterCloset });
      const [id] = closets();
      await walkToMark(id);
      await fireEvent.press(shownEnterButtons()[0]);
      expect(onEnterCloset).toHaveBeenCalledTimes(1);
      expect(routerCalls()).toEqual([]);
    },
    SLOW_TEST_MS
  );

  it("P7: 옷장이 둘이면(L-two) 이름표 '옷장'이 정확히 둘 보인다", async () => {
    await enter({ layout: L_TWO(), onEnterCloset: jest.fn() });
    expect(labelTexts(CLOSET_LABEL)).toHaveLength(2);
  });

  it(
    "P8: 옷장이 둘이면 둘째 옷장으로도 들어갈 수 있다(도착하면 같은 말풍선, '들어가기'로 꾸미기 화면 열기가 불림)",
    async () => {
      const onEnterCloset = jest.fn();
      await enter({ layout: L_TWO(), onEnterCloset });
      const ids = closets();
      expect(ids).toHaveLength(2);
      await walkToMark(ids[1]);
      const buttons = shownEnterButtons();
      expect(buttons).toHaveLength(1);
      expect(bubbleTextsBesides(buttons[0])).toEqual([]);
      await fireEvent.press(buttons[0]);
      expect(onEnterCloset).toHaveBeenCalledTimes(1);
    },
    SLOW_TEST_MS
  );

  it("P9: 옷장을 보관함에 넣으면(L-stored) 이름표 '옷장'과 옷장 말풍선이 없고(숨긴 것까지 '들어가기'는 게시판·창가·책상·책장 넷뿐), 기존 다섯 장소 이름표는 그대로다", async () => {
    await enter({ layout: L_STORED(), onEnterCloset: jest.fn() });
    expect(labelTexts(CLOSET_LABEL)).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: CLOSET_BUTTON, includeHiddenElements: true })).toHaveLength(4);
    expect(OLD_LABELS.map((name) => labelTexts(name).length >= 1)).toEqual(OLD_LABELS.map(() => true));
  });

  it.each([
    ["L0", L0],
    ["L-stored", L_STORED]
  ])("P10: 다른 입구는 없다(%s): 아래 메뉴는 지금 넷이고 '옷장' 버튼이 어디에도 없다", async (_name, layout) => {
    await enter({ layout: layout(), onEnterCloset: jest.fn(), onSaveLayout: async (value: LobbyLayout) => value });
    expect(MENU_ORDER.map((name) => screen.queryAllByRole("button", { name }).length)).toEqual([1, 1, 1, 1]);
    expect(screen.queryAllByRole("button", { name: CLOSET_LABEL, includeHiddenElements: true })).toHaveLength(0);
  });

  it(
    "P11: 가구 꾸미기 중에는 이름표 '옷장'이 숨고 옷장을 눌러도 라룹이가 걸어가지 않으며, '취소'로 나오면 이름표가 다시 보인다",
    async () => {
      await enter({ layout: L0(), onEnterCloset: jest.fn(), onSaveLayout: async (value: LobbyLayout) => value });
      expect(labelTexts(CLOSET_LABEL)).toHaveLength(1);
      const [id] = closets();
      await fireEvent.press(screen.getByRole("button", { name: "꾸미기" }));
      await frames(0.3);
      expect(labelTexts(CLOSET_LABEL)).toHaveLength(0);
      const before = { x: canvas().sim.x, z: canvas().sim.z };
      await tapMark(id);
      await frames(3);
      expect({ x: canvas().sim.x, z: canvas().sim.z }).toEqual(before);
      expect(shownEnterButtons()).toHaveLength(0);
      await fireEvent.press(screen.getByRole("button", { name: "취소" }));
      await frames(0.5);
      expect(labelTexts(CLOSET_LABEL)).toHaveLength(1);
    },
    SLOW_TEST_MS
  );

  it(
    "P12: '밖으로' → '나가기'로 마을에 가면 이름표 '옷장'이 없고 마을 장소 이름표 넷만 있다",
    async () => {
      await enter({ layout: L0(), onEnterCloset: jest.fn() });
      await walkToMark("door");
      await fireEvent.press(buttonIn(shownBubble(MARKS.door.prompt), MARKS.door.buttonLabel)!);
      await frames(1.5);
      expect(canvas().area).toBe("village");
      expect(labelTexts(CLOSET_LABEL)).toHaveLength(0);
      const villageLabels = ["home", "furnitureShop", "cafe", "library"].map((id) => markInfo(id as PlaceId).label);
      expect(villageLabels.map((name) => labelTexts(name).length >= 1)).toEqual(Array(VILLAGE_LABEL_COUNT).fill(true));
    },
    SLOW_TEST_MS
  );

  it(
    "P13(03 결정 B2): signedIn이 false이면 옷장에 도착했을 때 말풍선 글이 로그인 안내이고 '들어가기' 버튼이 없다",
    async () => {
      const onEnterCloset = jest.fn();
      await enter({ layout: L0(), onEnterCloset, signedIn: false });
      const [id] = closets();
      await walkToMark(id);
      const bubble = shownBubble(GUEST_PROMPT);
      expect(bubble).not.toBeNull();
      expect(buttonIn(bubble, CLOSET_BUTTON)).toBeNull();
      expect(shownEnterButtons()).toHaveLength(0);
    },
    SLOW_TEST_MS
  );
});

describe("[spec] 089-③ 03 결정 B9: 개발 화면(/dev/lobby-3d)에서는 옷장 이름표·말풍선이 보이고 '들어가기'는 아무것도 열지 않는다", () => {
  it(
    "B9: 개발 화면에서 이름표 '옷장'이 보이고, 도착하면 옷장 말풍선과 '들어가기'가 보이며, 눌러도 라우터로 가지 않고 꾸미기 화면(제목 '옷장')이 열리지 않는다",
    async () => {
      devGlobal.__DEV__ = true;
      await render(<DevLobby3dRoute />);
      await act(async () => {
        await Promise.resolve();
      });
      await frames(0.1);
      expect(labelTexts(CLOSET_LABEL)).toHaveLength(1);
      const [id] = closets();
      await walkToMark(id);
      const buttons = shownEnterButtons();
      expect(buttons).toHaveLength(1);
      expect(bubbleTextsBesides(buttons[0])).toEqual([]);
      await fireEvent.press(buttons[0]);
      await frames(2);
      expect(routerCalls()).toEqual([]);
      expect(screen.queryAllByRole("header", { name: CLOSET_LABEL, includeHiddenElements: true })).toHaveLength(0);
    },
    SLOW_TEST_MS
  );
});
