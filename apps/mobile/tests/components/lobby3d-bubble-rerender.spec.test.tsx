// [spec] qa 테스트(작업 126 마을 말풍선 다시 그리기, 버그 수정(성능), 모바일): 말풍선·장소 안내·아래 메뉴 강조가 바뀌어도 로비 화면 본체는 다시 그려지지 않는다.
// 기대값은 명세(private 작업 폴더 126-2026-11-19-마을-말풍선-다시그리기/01-main-spec.md) 기대 동작 1·2·3과 "그대로여야 할 동작"에서만 가져온다.
// 본체가 그려진 횟수는 본체가 그릴 때마다 한 번 부르는 useLobbyClock 훅 호출을 세어 본다(가정: 말풍선 묶음·아래 메뉴를 떼어도 이 훅은 본체에만 있다).
// - 바뀔 동작(고치기 전에 실패해야 한다): R1(장소에 도착하고 떠남), R2(인사 말풍선이 뜨고 사라짐).
// - 그대로 둘 동작(통과해야 한다): K1(장소 안내 글·버튼), K2(아래 메뉴 강조·selected), K3(인사 말풍선 글·버튼), K4(꾸미기 중 말풍선 숨김).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import type { FloorPoint, MarkId } from "@/lib/lobby3d/engine";

const mockCanvas: { props: Lobby3dCanvasProps | null; renders: number } = { props: null, renders: 0 };
/** 로비 화면 본체가 그려진 횟수(본체가 그릴 때마다 부르는 useLobbyClock 호출 수). */
const mockBody = { renders: 0 };

jest.mock("@/lib/lobby3d/use-lobby-clock", () => {
  const actual = jest.requireActual<typeof import("@/lib/lobby3d/use-lobby-clock")>("@/lib/lobby3d/use-lobby-clock");
  return {
    ...actual,
    useLobbyClock: (override: Parameters<typeof actual.useLobbyClock>[0]) => {
      mockBody.renders += 1;
      return actual.useLobbyClock(override);
    }
  };
});
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    mockCanvas.renders += 1;
    const onRoomShown = props.onRoomShown;
    const roomShownSent = React.useRef(false);
    React.useEffect(() => {
      if (roomShownSent.current || !onRoomShown) return;
      roomShownSent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const NOW = new Date("2026-11-19T03:00:00.000Z");
const BOARD_TEXT = "오늘의 질문 게시판이야.\n질문에 답하러 갈까?";

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
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

async function enter(props: Partial<Lobby3dScreenProps> = {}) {
  const view = await render(<Lobby3dScreen devPanel={false} showFps {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  await frames(0.25);
  return view;
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

async function arriveAtBoard() {
  await tapMark("board");
  for (let index = 0; index < 300 && canvas().sim.arrived !== "board"; index += 1) await frames(0.05);
  expect(canvas().sim.arrived).toBe("board");
  await frames(0.5);
}

function menuButton(label: string) {
  return screen.getByRole("button", { name: label });
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockCanvas.renders = 0;
  mockBody.renders = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("장소 안내 말풍선", () => {
  test("R1 장소에 도착하고 떠나 말풍선·메뉴 강조가 바뀌어도 로비 화면 본체는 다시 그려지지 않는다", async () => {
    await enter();
    // 들어올 때 하던 인사 동작이 가라앉게 둔다
    await frames(5);
    await tapMark("board");
    // 걷기 시작 뒤(걷는 동안은 말풍선 상태가 바뀌지 않는다고 보고) 기준을 잡는다
    await frames(0.1);
    const before = mockBody.renders;
    for (let index = 0; index < 300 && canvas().sim.arrived !== "board"; index += 1) await frames(0.05);
    expect(canvas().sim.arrived).toBe("board");
    await frames(0.5);
    expect(screen.getByText(BOARD_TEXT)).toBeTruthy();
    await tapFloor({ x: 4, z: 8 });
    await frames(1);
    expect(screen.queryByText(BOARD_TEXT)).toBeNull();
    expect(mockBody.renders).toBe(before);
  });

  test("K1 장소에 도착하면 장소 안내 글과 버튼이 나오고, 떠나면 사라진다", async () => {
    await enter();
    await arriveAtBoard();
    expect(screen.getByText(BOARD_TEXT)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /들어가기|답하러|질문/ }).length).toBeGreaterThan(0);
    await tapFloor({ x: 4, z: 8 });
    await frames(1);
    expect(screen.queryByText(BOARD_TEXT)).toBeNull();
  });

  test("K2 장소에 도착하면 아래 메뉴 한 칸이 selected로 켜지고, 떠나면 모두 꺼진다", async () => {
    await enter();
    await frames(5);
    const selectedCount = () => screen.getAllByRole("button").filter((node) => node.props.accessibilityState?.selected === true).length;
    const base = selectedCount();
    await arriveAtBoard();
    expect(selectedCount()).toBe(base + 1);
    await tapFloor({ x: 4, z: 8 });
    await frames(1);
    expect(selectedCount()).toBe(base);
  });
});

describe("인사 말풍선", () => {
  const greeting = { line: "안녕! 오늘도 써 볼까?", action: "jump" as const, key: 1 };
  const idleButton = { label: "인사 버튼", onPress: jest.fn() };

  test("R2 인사 말풍선이 걷기 시작해 사라져도 로비 화면 본체는 다시 그려지지 않는다", async () => {
    await enter({ greeting, idleButton });
    expect(screen.getByText(greeting.line)).toBeTruthy();
    const before = mockBody.renders;
    // 인사 말풍선은 걷기 시작하면 사라진다
    await tapFloor({ x: 4, z: 8 });
    await frames(1);
    expect(screen.queryByText(greeting.line)).toBeNull();
    expect(mockBody.renders).toBe(before);
  });

  test("K3 인사 말풍선이 뜨면 글과 버튼이 나온다", async () => {
    await enter({ greeting, idleButton });
    expect(screen.getByText(greeting.line)).toBeTruthy();
    expect(screen.getByRole("button", { name: "인사 버튼" })).toBeTruthy();
  });
});

describe("꾸미기·로딩 중 숨김", () => {
  test("K4 장소 안내 말풍선은 방이 보인 뒤에만 나온다(방을 준비하는 동안에는 없다)", async () => {
    await render(<Lobby3dScreen devPanel={false} showFps={false} />);
    expect(screen.queryByText(BOARD_TEXT)).toBeNull();
  });
});
