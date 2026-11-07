// [spec] qa 테스트(작업 061, 기능 변경: 모바일 홈 로비 장소 구역 — 구역 안에서 멈추면 도착).
// 기대값은 명세(private 작업 폴더 061-2026-11-07-모바일-로비-장소-구역/01-main-spec.md)와 결정(03-main-decision.md: 일기 책상 구역을 의자 쪽으로)에서만 가져온다.
// 그대로 둘 동작은 고치기 전 코드(2a2c359)의 동작을 기록한다. 구현 코드는 부르는 방법(Lobby3dScreen의 속성, 3D 그리기에 넘기는
// sim·onFrame·onPointer, 아래 메뉴의 accessibilityState.selected)을 알려고만 읽었다.
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 받은 속성으로 바닥을 누르고 프레임을 진행한다.
// 프레임마다 가짜 시계도 0.05초씩 옮긴다. 홈과 같게 시험판 없이(devPanel=false) 그린다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): V1, V2.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): V3, V4.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import type { FloorPoint, MarkId } from "@/lib/lobby3d/engine";

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

const PROMPTS: Record<MarkId, string> = {
  board: "오늘의 질문 게시판이야.\n질문에 답하러 갈까?",
  window: "생각 창가야.\n떠오르는 말을 바로 적어 볼까?",
  desk: "일기 책상이야.\n오늘 일기를 써 볼까?",
  door: "밖으로 나가 볼까?\n마을은 다음에 열려."
};
const BUTTONS: Record<MarkId, string> = { board: "들어가기", window: "들어가기", desk: "들어가기", door: "나가기" };
/** 장소와 아래 메뉴의 짝(지금 그대로). 밖으로는 짝이 없다. */
const MENU_LABEL: Record<MarkId, string | null> = {
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
const INSIDE: Record<MarkId, FloorPoint> = {
  board: { x: 2.5, z: 1.9 },
  window: { x: 5.4, z: 2.0 },
  desk: { x: 2.2, z: 7.2 },
  door: { x: 4.6, z: 10.0 }
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

async function walkToMark(mark: MarkId) {
  await tapMark(mark);
  for (let index = 0; index < 300 && canvas().sim.arrived !== mark; index += 1) {
    await frames(0.05);
  }
  expect(canvas().sim.arrived).toBe(mark);
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

const MARK_IDS: MarkId[] = ["board", "window", "desk", "door"];

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
