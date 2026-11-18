// [spec] qa 테스트(작업 121 마을 걷기 프레임 끊김, 버그 수정, 모바일): 로비 화면의 다시 그리기가 3D 장면을 다시 그리게 하지 않는다.
// 기대값은 명세(private 작업 폴더 121-2026-11-19-마을-걷기-프레임-끊김/01-main-spec.md) 기대 동작 1·2와 "그대로여야 할 동작"에서만 가져온다.
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 그 가짜가 그려진 횟수를 센다(진짜 3D 장면이 다시 그려지는 것과 같다).
// 부르는 방법은 lobby3d-place-zone-screen.spec과 같다(받은 onProject·onFrame·onPointer를 부른다).
// - 바뀔 동작(고치기 전에 실패해야 한다): R1, R2, R3, R4.
// - 그대로 둘 동작(통과해야 한다): K1, K2, K3, K4.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import type { FloorPoint, MarkId } from "@/lib/lobby3d/engine";

const mockCanvas: { props: Lobby3dCanvasProps | null; renders: number } = { props: null, renders: 0 };

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

/** 화면에 그려진 글을 줄마다 이어 붙인 것(글 조각이 나뉘어 있어도 한 줄로 본다). */
function shownLines(): string[] {
  const lines: string[] = [];
  const walk = (node: unknown): string => {
    if (typeof node === "string") return node;
    if (!node || typeof node !== "object") return "";
    const n = node as { type?: string; children?: unknown[] | null };
    const text = (n.children ?? []).map(walk).join("");
    if (n.type === "Text") lines.push(text);
    return n.type === "Text" ? "" : text;
  };
  const json = screen.toJSON();
  (Array.isArray(json) ? json : [json]).forEach(walk);
  return lines;
}

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
  // 처음 그릴 때의 일(방 보임 알림 등)이 가라앉게 프레임을 몇 번 진행한다
  await frames(0.25);
  return view;
}

async function sendFps(fps: number) {
  await act(async () => {
    canvas().onProject({ bubble: { x: 100, y: 100 }, labels: {}, fps });
  });
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

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockCanvas.renders = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("초당 프레임 수", () => {
  test("R1 초당 프레임 수가 바뀌어도(표시를 켠 채) 3D 장면은 다시 그려지지 않는다", async () => {
    await enter();
    await sendFps(60);
    const before = mockCanvas.renders;
    await sendFps(55);
    await sendFps(58);
    expect(mockCanvas.renders).toBe(before);
  });

  test("R2 표시를 숨긴 채(showFps 거짓, 출시 빌드)여도 초당 프레임 수가 바뀌면 3D 장면은 다시 그려지지 않는다", async () => {
    await enter({ showFps: false });
    await sendFps(60);
    const before = mockCanvas.renders;
    await sendFps(55);
    await sendFps(58);
    expect(mockCanvas.renders).toBe(before);
  });

  test("K1 표시를 켜면 초당 프레임 수가 바뀔 때 바로 보인다(처음은 FPS -)", async () => {
    await enter();
    expect(shownLines()).toContain("FPS -");
    await sendFps(57);
    expect(shownLines()).toContain("FPS 57");
    await sendFps(42);
    expect(shownLines()).toContain("FPS 42");
    expect(shownLines()).not.toContain("FPS 57");
  });

  test("K2 표시를 숨기면(showFps 거짓) FPS·동작 표시는 어디에도 없다", async () => {
    await enter({ showFps: false });
    await sendFps(57);
    expect(shownLines().filter((line) => /FPS|동작:/.test(line))).toEqual([]);
  });
});

describe("지금 동작", () => {
  test("R3 동작이 시작하고 끝나도 3D 장면은 다시 그려지지 않는다", async () => {
    await enter();
    // 들어올 때 하던 인사 동작이 끝나도록 둔다
    await frames(5);
    const before = mockCanvas.renders;
    await act(async () => {
      expect(canvas().sim.startAction("wave")).toBe(true);
      canvas().onFrame(0.05, Date.now());
    });
    // 동작이 끝날 때까지(가장 긴 동작도 몇 초 안) 프레임을 진행한다
    await frames(5);
    expect(mockCanvas.renders).toBe(before);
  });

  test("K3 동작이 시작하면 '동작: 이름'이 바로 보이고, 끝나면 '동작: 없음'으로 돌아온다", async () => {
    await enter();
    // 들어올 때 하던 인사 동작이 끝나도록 둔다
    await frames(5);
    expect(shownLines()).toContain("동작: 없음");
    await act(async () => {
      expect(canvas().sim.startAction("wave")).toBe(true);
      canvas().onFrame(0.05, Date.now());
    });
    expect(shownLines()).toContain("동작: 손 흔들기");
    await frames(5);
    expect(shownLines()).toContain("동작: 없음");
  });
});

describe("같은 값으로 다시 그리기", () => {
  test("R4 로비 화면을 같은 값으로 다시 그려도(rerender) 3D 장면은 다시 그려지지 않는다", async () => {
    const view = await enter();
    const before = mockCanvas.renders;
    await act(async () => {
      view.rerender(<Lobby3dScreen devPanel={false} showFps />);
    });
    expect(mockCanvas.renders).toBe(before);
  });

  test("K4 화면 글이 실제로 바뀔 때(장소에 도착해 나오는 말풍선)는 지금처럼 글이 나오고 사라진다", async () => {
    await enter();
    await tapMark("board");
    for (let index = 0; index < 300 && canvas().sim.arrived !== "board"; index += 1) await frames(0.05);
    expect(canvas().sim.arrived).toBe("board");
    await frames(0.5);
    expect(screen.getByText("오늘의 질문 게시판이야.\n질문에 답하러 갈까?")).toBeTruthy();
    await tapFloor({ x: 4, z: 8 });
    await frames(1);
    expect(screen.queryByText("오늘의 질문 게시판이야.\n질문에 답하러 갈까?")).toBeNull();
  });
});
