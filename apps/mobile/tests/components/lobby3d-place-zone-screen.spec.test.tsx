// [spec] qa 테스트(작업 061, 기능 변경: 모바일 홈 로비 장소 구역 — 구역 안에서 멈추면 도착).
// 기대값은 명세(private 작업 폴더 061-2026-11-07-모바일-로비-장소-구역/01-main-spec.md)와 결정(03-main-decision.md: 일기 책상 구역을 의자 쪽으로)에서만 가져온다.
// 그대로 둘 동작은 고치기 전 코드(2a2c359)의 동작을 기록한다. 구현 코드는 부르는 방법(Lobby3dScreen의 속성, 3D 그리기에 넘기는
// sim·onFrame·onPointer, 아래 메뉴의 accessibilityState.selected)을 알려고만 읽었다.
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 받은 속성으로 바닥을 누르고 프레임을 진행한다.
// 프레임마다 가짜 시계도 0.05초씩 옮긴다. 홈과 같게 시험판 없이(devPanel=false) 그린다.
// - 바뀔 동작(061 첫 구현 전에 실패해야 했다): V1, V2.
// - 그대로 둘 동작(통과해야 한다): V3, V4.
// - 061-10 결정(사용자, 2026-11-07: 라이트루프가 구역 안에 있기만 해도 걷거나 끌려 가는 중에도 그 장소 안내 말풍선과 버튼을 보이고 아래 메뉴를
//   강조하며 걸음은 멈추지 않는다. 구역을 벗어나면 걷는 중엔 말풍선이 숨고 멈췄으면 기본 말. 걷는 중에도 구역 안에서는 말풍선 버튼을 누를 수 있다)으로
//   바뀔 동작(df42aae에서 실패해야 한다): V5, V6, V7. 061-12 결정(기본 말을 없앰. 짧은 말·인사·장소 안내가 없으면 말풍선 없음)으로 V5의 끝은 말풍선 없음.
//   구역 경계(1칸) 근처는 보지 않는다(안: 구역에서 0.95칸 안, 밖: 모든 구역에서 1.05칸 밖).
// - 061-13 결정(끄는 중에도 안내·메뉴 강조가 바로 바뀌고 다른 장소 글은 보이지 않음, 게시판·창가 구역은 벽 위의 점까지 잇는 선에서 1칸 안)으로
//   바뀔 동작: V8, V9. V5~V9의 "보이는지"는 아래 061-10 머리말 참고. V1~V4는 찾는 법을 바꾸지 않았다(14 보고 참고).
// 작업 063 03 결정 1(사용자 2026-11-08 "고치기"): '들어가기'를 누른 뒤의 확인을 동작(약 1초)이 끝난 뒤로 옮겼다(V2·V4·V6·V7·V8, waitEnterMotion). 단언은 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import type { FloorPoint, MarkId } from "@/lib/lobby3d/engine";

/** 기존 네 장소. 작업 062(책장 장소를 더함) 04 결정 2로, 장소마다 값을 적어 둔 테스트 데이터의 타입만 이 넷으로 좁혔다(값과 단언은 그대로). */
type PlaceId = "board" | "window" | "desk" | "door";

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
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 기대 문구(지금 장소 안내 그대로) ----------

const PROMPTS: Record<PlaceId, string> = {
  board: "오늘의 질문 게시판이야.\n질문에 답하러 갈까?",
  window: "생각 창가야.\n떠오르는 말을 바로 적어 볼까?",
  desk: "일기 책상이야.\n오늘 일기를 써 볼까?",
  door: "밖으로 나가 볼까?\n마을은 다음에 열려."
};
const BUTTONS: Record<PlaceId, string> = { board: "들어가기", window: "들어가기", desk: "들어가기", door: "나가기" };
/** 장소와 아래 메뉴의 짝(지금 그대로). 밖으로는 짝이 없다. */
const MENU_LABEL: Record<PlaceId, string | null> = {
  board: "질문에 답하기",
  window: "지금 생각나는대로",
  desk: "영어일기",
  door: null
};
const ALL_MENUS = ["질문에 답하기", "영어일기", "지금 생각나는대로"];
const GREETING_LINE = "오늘도 해냈어!";

/**
 * 장소마다 구역 안 바닥 점(서는 자리가 아님). 구역 = 서는 자리들의 가운데를 중심으로 한 반지름 1칸 원(명세 1).
 * 중심: 게시판 (1.9, 1.3), 창가 (4.8, 1.55), 일기 책상 (1.5, 6.75)(03 결정: 서는 곳을 의자 뒤 하나로 옮김), 밖으로 (4.0, 10.5). 아래 점은 모두 중심에서 0.9칸 안이다.
 */
const INSIDE: Record<PlaceId, FloorPoint> = {
  board: { x: 2.5, z: 1.9 },
  window: { x: 5.4, z: 2.0 },
  desk: { x: 2.2, z: 7.2 },
  door: { x: 4.6, z: 10.0 }
};

/** 구역 중심(명세 1, 03 결정). 위 INSIDE의 설명과 같은 값이다. */
const ZONE_CENTER: Record<PlaceId, FloorPoint> = {
  board: { x: 1.9, z: 1.3 },
  window: { x: 4.8, z: 1.55 },
  desk: { x: 1.5, z: 6.75 },
  door: { x: 4.0, z: 10.5 }
};
/** 061-12 결정으로 없앤 기본 말. 어디에도 나오지 않아야 한다. */
const REMOVED_IDLE_LINE = "오늘은 뭘 해 볼까?\n가고 싶은 곳을 눌러 봐.";

/** 장소마다 구역을 곧게 지나가는 길(엔진 테스트 Z6과 같은 길). 시작과 끝은 어느 구역에도 들지 않는다. */
const PASS: Record<PlaceId, { start: FloorPoint; goal: FloorPoint }> = {
  board: { start: { x: 0.6, z: 1.2 }, goal: { x: 3.3, z: 1.2 } },
  window: { start: { x: 3.3, z: 1.2 }, goal: { x: 6.4, z: 1.2 } },
  desk: { start: { x: 0.6, z: 7.6 }, goal: { x: 3.0, z: 6.5 } },
  door: { start: { x: 2.5, z: 10.4 }, goal: { x: 5.5, z: 10.4 } }
};

const NOW = new Date("2026-11-12T03:00:00.000Z");

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

async function enter(props: Lobby3dScreenProps) {
  const view = await render(<Lobby3dScreen devPanel={false} {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

/** seconds초 동안 0.05초씩 프레임을 진행한다(시계도 함께). */
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

/** 바닥 점을 눌러 그 점에 멈출 때까지 걷고, 0.5초 더 둔다. */
async function walkToFloor(point: FloorPoint) {
  await tapFloor(point);
  for (let index = 0; index < 300; index += 1) {
    const sim = canvas().sim;
    if (Math.abs(sim.x - point.x) < 1e-6 && Math.abs(sim.z - point.z) < 1e-6 && sim.vx === 0 && sim.vz === 0) break;
    await frames(0.05);
  }
  const sim = canvas().sim;
  expect({ x: sim.x, z: sim.z, vx: sim.vx, vz: sim.vz }).toEqual({ x: point.x, z: point.z, vx: 0, vz: 0 });
  await frames(0.5);
}

/**
 * 장소를 눌러 도착할 때까지 걷고, 0.5초 더 둔다. 061-10 결정으로 구역 안에서는 걷는 중에도 안내가 나오므로,
 * 도착은 그 장소에 도착했다고 나오고 걸음이 멈춘 때로 본다(확인 내용은 그대로, 찾는 도우미만 고침).
 */
async function walkToMark(mark: MarkId) {
  await tapMark(mark);
  const done = () => canvas().sim.arrived === mark && canvas().sim.vx === 0 && canvas().sim.vz === 0;
  for (let index = 0; index < 300 && !done(); index += 1) {
    await frames(0.05);
  }
  expect(canvas().sim.arrived).toBe(mark);
  expect(done()).toBe(true);
  await frames(0.5);
}

function bubbleOf(line: string) {
  // 말풍선 글이 든 말풍선 판. 글은 누르기를 받지 않는 감싸개(pointerEvents "none") 안에 있으므로 그 감싸개를 건너 올라간다
  let node = screen.getByText(line).parent!;
  while (node.props.pointerEvents === "none") node = node.parent!;
  return node;
}

function selectedMenus() {
  return ALL_MENUS.filter((label) => screen.getByRole("button", { name: label }).props.accessibilityState?.selected === true);
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
});

afterEach(() => {
  jest.useRealTimers();
});

const MARK_IDS: PlaceId[] = ["board", "window", "desk", "door"];

describe("[spec] 작업 061 바뀔 동작: 구역 안에서 멈추면 장소 안내·버튼·메뉴 강조(명세 2)", () => {
  it.each(MARK_IDS)("V1: 바닥을 눌러 장소(%s) 구역 안에 멈추면 말풍선에 그 장소 안내와 버튼이 나오고, 짝인 아래 메뉴만 강조된다", async (mark) => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });

    await walkToFloor(INSIDE[mark]);

    expect(screen.getByText(PROMPTS[mark])).toBeOnTheScreen();
    expect(within(bubbleOf(PROMPTS[mark])).getByRole("button", { name: BUTTONS[mark] })).toBeOnTheScreen();
    const lit = MENU_LABEL[mark];
    expect(selectedMenus()).toEqual(lit ? [lit] : []);
  });

  it.each(MARK_IDS)("V2: 장소(%s) 구역 안에 멈춰 나온 말풍선 버튼을 누르면 그 장소로 들어간다(가구를 눌러 도착했을 때와 같다)", async (mark) => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });

    await walkToFloor(INSIDE[mark]);
    await fireEvent.press(within(bubbleOf(PROMPTS[mark])).getByRole("button", { name: BUTTONS[mark] }));
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);

    expect(onEnterMark).toHaveBeenCalledTimes(1);
    expect(onEnterMark).toHaveBeenCalledWith(mark);
  });
});

describe("[spec] 작업 061 그대로 둘 동작: 가구·이름표를 누르면 서는 자리로 걸어가 도착하고 안내가 나온다", () => {
  it.each(MARK_IDS)("V4: 장소(%s)를 누르면 걸어가 도착해 말풍선에 그 장소 안내와 버튼이 나오고, 짝인 아래 메뉴만 강조되며, 버튼을 누르면 그 장소로 들어간다", async (mark) => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });

    await walkToMark(mark);

    expect(screen.getByText(PROMPTS[mark])).toBeOnTheScreen();
    const lit = MENU_LABEL[mark];
    expect(selectedMenus()).toEqual(lit ? [lit] : []);
    await fireEvent.press(within(bubbleOf(PROMPTS[mark])).getByRole("button", { name: BUTTONS[mark] }));
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);
    expect(onEnterMark).toHaveBeenCalledTimes(1);
    expect(onEnterMark).toHaveBeenCalledWith(mark);
  });
});

describe("[spec] 작업 061 그대로 둘 동작: 로비 인사(③)는 구역 안에 서 있어도 장소 안내를 거둔다", () => {
  const WAYS: [string, () => Promise<void>][] = [
    ["바닥을 눌러 일기 책상 구역 안에 멈춘 뒤", () => walkToFloor(INSIDE.desk)],
    ["일기 책상을 눌러 도착한 뒤", () => walkToMark("desk")]
  ];

  it.each(WAYS)("V3: %s 홈에 들어올 때의 인사를 받으면 인사 말을 보이고, 장소 안내·버튼·메뉴 강조가 없으며 5초 뒤에도 그대로다", async (_name, arrange) => {
    const onEnterMark = jest.fn(() => true);
    const view = await enter({ onEnterMark, onMenu: jest.fn() });
    await arrange();

    await view.rerender(
      <Lobby3dScreen devPanel={false} onEnterMark={onEnterMark} onMenu={jest.fn()} greeting={{ line: GREETING_LINE, action: "jump", key: 1 }} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    const check = () => {
      expect(screen.getByText(GREETING_LINE)).toBeOnTheScreen();
      expect(screen.queryByText(PROMPTS.desk)).toBeNull();
      expect(screen.queryByRole("button", { name: BUTTONS.desk })).toBeNull();
      expect(selectedMenus()).toEqual([]);
    };
    check();
    await frames(5);
    check();
  });
});

// ---------- 061-10 결정: 구역 안에 있기만 해도(걷거나 끌려 가는 중에도) 장소 안내 ----------
// 061-13 결정: 끄는 중에도 장소 안내와 메뉴 강조가 바로 바뀌고 다른 장소의 글은 보이지 않는다. 게시판·창가의 구역은 가운데에서 벽 위의 점까지 잇는 선에서 1칸 안.
// 13 결정으로 보이지 않는 장소 말풍선도 화면 구조에 남아 있을 수 있다. 아래 새 테스트(V5~V9)는 "보이는지"를 Testing Library의 기본 질의 기준으로 본다.
// 화면 구조에 있어도 접근성에서 숨긴 것(aria-hidden, accessibilityElementsHidden, importantForAccessibility "no-hide-descendants", display none)은
// 보이지 않는 것으로 친다. 투명도는 보지 않는다. 네이티브 애니메이션 쪽(useNativeDriver) 값은 Jest의 화면 구조에 바로 반영되지 않아
// 실제 보임과 어긋나기 때문이다(14 보고에 확인한 내용).

function distance(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 13 결정: 벽에 붙은 장소의 구역은 가운데에서 벽 위의 이 점(그 장소를 바라보는 점, 060-⑤ G3이 기록한 값)까지 잇는 선에서 1칸 안. */
const WALL_POINT: Partial<Record<MarkId, FloorPoint>> = {
  board: { x: 1.8, z: 0 },
  window: { x: 4.8, z: 0 }
};

/** 장소 구역까지의 거리(1 이하면 구역 안). 게시판·창가는 가운데에서 벽 위의 점까지 잇는 선, 일기 책상·밖으로는 가운데까지. */
function zoneDistance(id: PlaceId, p: FloorPoint) {
  const a = ZONE_CENTER[id];
  const b = WALL_POINT[id];
  if (!b) return distance(p, a);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return distance(p, { x: a.x + dx * t, z: a.z + dz * t });
}

/** 라이트루프 자리가 확실히 들어 있는 장소 구역. 모든 구역에서 1.05칸 밖이면 null, 경계 근처면 "edge"(보지 않음). */
function zoneNow(): PlaceId | null | "edge" {
  const sim = canvas().sim;
  const p = { x: sim.x, z: sim.z };
  for (const id of MARK_IDS) if (zoneDistance(id, p) < 0.95) return id;
  return MARK_IDS.every((id) => zoneDistance(id, p) > 1.05) ? null : "edge";
}

/** 걷거나 끌려 가는 중인지(걷는 속도가 있거나 끄는 중). */
function movingNow() {
  const sim = canvas().sim;
  return Math.hypot(sim.vx, sim.vz) > 0.3 || sim.dragging;
}

/** 이 글이 든 보이는 말풍선 판(기본 질의라 접근성에서 숨긴 말풍선은 건너뛴다). 없으면 null. */
function shownBubble(line: string) {
  const text = screen.queryAllByText(line)[0];
  if (!text) return null;
  let node = text.parent!;
  while (node.props.pointerEvents === "none") node = node.parent!;
  return node;
}

/** 이 글의 말풍선이 보이는지. */
function bubbleShown(line: string) {
  return shownBubble(line) !== null;
}

/** 이 장소의 보이는 말풍선 안의 보이는 버튼. 없으면 null. */
function shownButton(mark: PlaceId) {
  const bubble = shownBubble(PROMPTS[mark]);
  if (!bubble) return null;
  return within(bubble).queryAllByRole("button", { name: BUTTONS[mark] })[0] ?? null;
}

/**
 * 걷거나 끌려 가는 중 프레임마다 본다. 어느 장소 구역 안이면 그 장소 안내가 보이고 그 말풍선 안에 버튼이 보이며, 다른 장소의 글은 보이지 않고,
 * 짝인 메뉴만 강조된다(밖으로는 강조 없음). 구역 밖이면 어느 장소 안내도 없앤 기본 말도 보이지 않고 강조된 메뉴가 없다. 어긋난 프레임을 글로 모은다.
 */
function frameChecker() {
  const problems: string[] = [];
  const movingInZone: Partial<Record<MarkId, number>> = {};
  const check = () => {
    const zone = zoneNow();
    if (zone === "edge" || !movingNow()) return;
    const sim = canvas().sim;
    const where = `(${sim.x.toFixed(2)}, ${sim.z.toFixed(2)})`;
    if (zone) {
      movingInZone[zone] = (movingInZone[zone] ?? 0) + 1;
      const lit = MENU_LABEL[zone];
      const got = {
        shown: bubbleShown(PROMPTS[zone]),
        button: shownButton(zone) !== null,
        others: MARK_IDS.filter((id) => id !== zone && bubbleShown(PROMPTS[id])),
        menus: selectedMenus()
      };
      const want = { shown: true, button: true, others: [], menus: lit ? [lit] : [] };
      if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${where} ${zone} 구역 안 이동 중: ${JSON.stringify(got)}`);
    } else {
      const got = { prompts: MARK_IDS.filter((id) => bubbleShown(PROMPTS[id])), idle: bubbleShown(REMOVED_IDLE_LINE), menus: selectedMenus() };
      if (got.prompts.length || got.idle || got.menus.length) problems.push(`${where} 구역 밖 이동 중: ${JSON.stringify(got)}`);
    }
  };
  return { check, problems, inZone: (mark: MarkId) => movingInZone[mark] ?? 0 };
}

function stoppedAt(point: FloorPoint) {
  const sim = canvas().sim;
  return Math.abs(sim.x - point.x) < 1e-6 && Math.abs(sim.z - point.z) < 1e-6 && sim.vx === 0 && sim.vz === 0;
}

/** 손을 대고 to 쪽으로 끌기 시작한다(화면에서 60픽셀 움직여 끌기가 된다). 손은 떼지 않는다. */
async function startDrag(from: FloorPoint, to: FloorPoint) {
  await act(async () => {
    canvas().onPointer("down", { point: from, mark: null, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("move", { point: to, mark: null, onCharacter: false }, 200, 240);
  });
}

describe("[spec] 작업 061 10 결정(바뀔 동작): 구역 안에 있기만 해도 걷거나 끌려 가는 중에도 장소 안내·버튼·메뉴 강조", () => {
  it.each(MARK_IDS)(
    "V5: 바닥을 눌러 장소(%s) 구역을 지나가면, 구역 안에 있는 동안 걷는 중에도 그 장소 안내와 버튼이 보이고 짝인 메뉴만 강조되며, 벗어나면 말풍선과 강조가 사라지고, 구역 밖에 멈추면 말풍선이 없다(12 결정)",
    async (mark) => {
      const onEnterMark = jest.fn(() => true);
      await enter({ onEnterMark, onMenu: jest.fn() });
      const { start, goal } = PASS[mark];
      await walkToFloor(start);
      const frame = frameChecker();

      await tapFloor(goal);
      for (let index = 0; index < 300 && !stoppedAt(goal); index += 1) {
        await frames(0.05);
        if (!stoppedAt(goal)) frame.check();
      }
      expect(stoppedAt(goal)).toBe(true);
      await frames(0.5);

      expect(frame.inZone(mark)).toBeGreaterThan(0);
      expect(frame.problems).toEqual([]);
      // 12 결정: 짧은 말·인사·장소 안내가 없으면 말풍선이 없다(기본 말을 없앰)
      expect({ prompts: MARK_IDS.filter((id) => bubbleShown(PROMPTS[id])), idle: bubbleShown(REMOVED_IDLE_LINE) }).toEqual({ prompts: [], idle: false });
      expect(selectedMenus()).toEqual([]);
      expect(onEnterMark).not.toHaveBeenCalled();
    }
  );

  it.each(MARK_IDS)("V6: 장소(%s) 구역을 걸어서 지나는 중에 말풍선 버튼을 누르면 그 장소로 들어간다", async (mark) => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });
    const { start, goal } = PASS[mark];
    await walkToFloor(start);

    await tapFloor(goal);
    for (let index = 0; index < 300 && !(zoneNow() === mark && distance(canvas().sim, ZONE_CENTER[mark]) < 0.9 && movingNow()); index += 1) {
      await frames(0.05);
    }
    // 정말 걷는 중에 구역 안에 있는지 먼저 본다
    expect(distance(canvas().sim, ZONE_CENTER[mark])).toBeLessThan(0.9);
    expect(movingNow()).toBe(true);

    const button = shownButton(mark);
    expect(button).not.toBeNull();
    await fireEvent.press(button!);
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);

    expect(onEnterMark).toHaveBeenCalledTimes(1);
    expect(onEnterMark).toHaveBeenCalledWith(mark);
  });

  it("V7: 의자 뒤쪽에서 일기 책상 쪽으로 끄는 동안, 구역 밖에서는 말풍선이 숨고, 손가락을 댄 채 구역 안에 들어오면 일기 책상 안내와 버튼이 보이고 '영어일기' 메뉴만 강조되며, 버튼을 누르면 일기 책상으로 들어간다", async () => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });
    const from = { x: 1.5, z: 9.0 };
    await walkToFloor(from);
    const frame = frameChecker();

    await startDrag(from, { x: 1.5, z: 5.5 }); // 일기 책상 칸
    for (let index = 0; index < 60; index += 1) {
      await frames(0.05);
      frame.check();
    }

    // 정말 손가락을 댄 채 구역 안에 있는지 먼저 본다
    expect(canvas().sim.dragging).toBe(true);
    expect(distance(canvas().sim, ZONE_CENTER.desk)).toBeLessThan(0.95);
    expect(frame.inZone("desk")).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
    expect(bubbleShown(PROMPTS.desk)).toBe(true);
    expect(selectedMenus()).toEqual(["영어일기"]);
    const button = shownButton("desk");
    expect(button).not.toBeNull();
    await fireEvent.press(button!);
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);
    expect(onEnterMark).toHaveBeenCalledTimes(1);
    expect(onEnterMark).toHaveBeenCalledWith("desk");
  });
});

describe("[spec] 작업 061 13 결정(바뀔 동작): 손을 떼지 않고 끄는 중에도 장소 안내와 메뉴 강조가 바로 바뀌고, 다른 장소의 글은 보이지 않는다", () => {
  it("V8: 게시판 구역에서 손을 떼지 않고 창가 쪽으로 끌면, 게시판 구역에서는 게시판 안내와 '질문에 답하기' 강조, 사이에서는 말풍선과 강조가 없고, 창가 구역에 들어서면 바로 창가 안내와 '지금 생각나는대로' 강조이며 게시판 글은 보이지 않는다", async () => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });
    const from = INSIDE.board;
    await walkToFloor(from);
    expect(zoneNow()).toBe("board");
    const frame = frameChecker();

    await startDrag(from, { x: 4.8, z: 1.55 }); // 창가 서는 자리 가운데
    for (let index = 0; index < 60; index += 1) {
      await frames(0.05);
      frame.check();
    }

    // 정말 손가락을 댄 채 게시판 구역을 지나 창가 구역에 있는지 먼저 본다
    expect(canvas().sim.dragging).toBe(true);
    expect(zoneNow()).toBe("window");
    expect(frame.inZone("board")).toBeGreaterThan(0);
    expect(frame.inZone("window")).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
    expect({ window: bubbleShown(PROMPTS.window), board: bubbleShown(PROMPTS.board), menus: selectedMenus() }).toEqual({
      window: true,
      board: false,
      menus: ["지금 생각나는대로"]
    });
    const button = shownButton("window");
    expect(button).not.toBeNull();
    await fireEvent.press(button!);
    await waitEnterMotion(() => onEnterMark.mock.calls.length > 0);
    expect(onEnterMark).toHaveBeenCalledTimes(1);
    expect(onEnterMark).toHaveBeenCalledWith("window");
  });

  it("V9: 게시판 벽 쪽(가운데에서 1칸 넘게, 벽 위의 점까지 잇는 선에서 1칸 안)으로 끌고 손을 댄 채 있으면 게시판 안내와 버튼이 보이고 '질문에 답하기'만 강조된다", async () => {
    const onEnterMark = jest.fn(() => true);
    await enter({ onEnterMark, onMenu: jest.fn() });
    const from = { x: 0.94, z: 1.7 };
    await walkToFloor(from);
    const wallSide = { x: 0.94, z: 0.78 };
    expect(distance(wallSide, ZONE_CENTER.board)).toBeGreaterThan(1.05);
    expect(zoneDistance("board", wallSide)).toBeLessThan(0.95);

    await startDrag(from, { x: 0.94, z: 0.2 }); // 벽 쪽으로 곧게 끌어 벽 앞에 막힌다
    await frames(3);

    expect(canvas().sim.dragging).toBe(true);
    const at = { x: canvas().sim.x, z: canvas().sim.z };
    // 정말 원 밖이고 벽 쪽 구역 안에 있는지 먼저 본다
    expect(distance(at, ZONE_CENTER.board)).toBeGreaterThan(1.05);
    expect(zoneDistance("board", at)).toBeLessThan(0.95);
    expect({ board: bubbleShown(PROMPTS.board), button: shownButton("board") !== null, menus: selectedMenus() }).toEqual({
      board: true,
      button: true,
      menus: ["질문에 답하기"]
    });
  });
});
