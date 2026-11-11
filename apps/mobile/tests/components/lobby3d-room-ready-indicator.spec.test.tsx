// [spec] qa 테스트(작업 079, 기능 변경, 모바일): 로비를 열고 방이 처음 보일 때까지 3D 자리에 준비 표시를 띄우고 이름표·장소 안내·말풍선을 숨긴다.
// 기대값은 명세(private 작업 폴더 079-2026-11-11-로비-방-준비-표시/01-main-spec.md)에서만 가져온다.
// 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 명세 "바뀌는 동작":
//   - 방이 처음 보일 때까지 3D 자리 가운데에 작은 회전 표시와 "방을 준비하고 있어요"를 띄운다. 바탕은 지금처럼 검정이다.
//   - "방이 보인다" = (1) 처음 지을 배치가 정해져 3D 그림판이 생겼고, (2) 방 껍데기(구운 방 껍데기를 쓰는 기본 방일 때)·가구·라룹이가
//     각각 모델로 그려졌거나 모델을 읽지 못해 지금처럼 대신 그려졌고, (3) 그 상태로 3D 장면을 한 번 그렸다.
//   - 방이 보이기 전에는 이름표·장소 안내·말풍선을 보이지 않고, 방이 보이면 지금처럼 보인다.
//   - 표시는 로비를 연 뒤 처음 한 번만 띄운다. 방이 한 번 보인 뒤에는 배치가 바뀌어 방을 다시 짓거나 편집 모드에 들어가도 다시 띄우지 않는다.
// 명세 "그대로여야 할 동작": 위아래 버튼(메뉴, 머리 줄 버튼)은 표시가 떠 있는 동안에도 지금처럼 보이고 누를 수 있다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen), 3D 그리기(Lobby3dCanvas), 방 껍데기(BakedRoom)·가구 묶음(BakedFurniture)·라룹이(Character)는 모두 진짜를 쓴다.
//   그래서 "방이 보였다"는 신호를 구현이 어떤 이름·길로 보내든 이 테스트는 그 이름을 모른 채 화면에서 결과만 본다.
// - Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다(lobby3d-edit-scene-rebuild.spec과 같은 구성): Canvas는 자식을 그대로 그리고,
//   useThree는 고정 카메라·화면 크기·장면을 준다. useFrame은 테스트가 부를 때 한 번씩 돈다.
//   "3D 장면을 한 번 그렸다"는 등록된 useFrame을 모두 한 번 부르고 가짜 시계를 0.05초 돌리는 것(frame())으로 본다.
// - useLoader는 테스트가 끝내는 때를 정하는 가짜다. 파일마다 "읽는 중"(Suspense로 기다리게 함), "읽음"(가짜 모델을 줌),
//   "읽지 못함"(오류를 던져 각 부분의 오류 경계가 지금처럼 대신 그리게 함) 셋 중 하나다. 078로 모델은 앱 전체에서 한 번만 읽어 두므로,
//   방을 다시 지을 때 이미 읽은 파일은 기다리지 않고 바로 준다.
// - 한계: 세 부분이 모두 "읽는 중"인 채로 로비를 그리면, 이 Jest 구성(진짜 r3f useLoader로 바꿔도 같다)에서 React가 기다리는 세 부분을
//   끝없이 다시 그려 메모리가 넘친다(지금 코드에서도 같다. 실제 앱의 r3f 그리기와는 다른 테스트 환경의 일이다).
//   그래서 "읽는 중"으로 시작하는 테스트는 한 파일을 미리 읽힌 채(또는 읽지 못한 채) 두고 시작한다.
// - "보인다"는 Testing Library의 기본 질의(화면 읽기에서 숨긴 것은 찾지 않는다)로 찾히고, 그 요소와 조상 어디에도
//   투명도 0이나 display "none" 스타일이 없는 것으로 본다. "보이지 않는다"는 그 반대다.
//   이름표 "학습 기록"은 아래 메뉴 버튼 "학습 기록"과 글이 같아, 버튼 안에 든 글은 이름표로 치지 않는다.
// - 장소 안내는 라룹이가 장소에 도착했을 때 뜨므로, 3D 그리기가 화면에 넘긴 누르기 함수(onPointer)로 게시판을 누르고 프레임을 진행해 도착시킨다.
// - 회전 표시의 모양, 표시의 크기·위치·글자 밝기는 화면 구조로 판단할 기준이 명세에 없어 보지 않는다(사용자가 폰에서 본다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, type RoomSpec } from "@/lib/lobby3d/room";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;
type ModelStatus = "pending" | "loaded" | "failed";
interface MockModel {
  status: ModelStatus;
  promise: Promise<void>;
  resolve: () => void;
  value: unknown;
  error: Error | null;
}

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
const mockModels = new Map<string, MockModel>();
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(lobby3d-edit-scene-rebuild.spec과 같다)
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: (callback: FramePart) => {
      const ref = React.useRef(callback);
      ref.current = callback;
      React.useEffect(() => {
        const entry: FramePart = (state, delta) => ref.current(state, delta);
        mockFrames.add(entry);
        return () => {
          mockFrames.delete(entry);
        };
      }, []);
    },
    // 파일마다 테스트가 정한 상태대로: 읽는 중이면 기다리게 하고(Suspense), 읽었으면 모델을, 읽지 못했으면 오류를 던진다
    useLoader: (_loader: unknown, url: unknown) => {
      const model = mockModels.get(String(url));
      if (!model) throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
      if (model.status === "loaded") return model.value;
      if (model.status === "failed") throw model.error;
      throw model.promise;
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (object: { clone: (recursive: boolean) => unknown }) => object.clone(true)
}));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/lobby-furniture.glb", () => "lobby-furniture.glb");
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
// 3D 그리기는 진짜를 그리고 받은 속성을 그대로 넘긴다. 화면이 넘긴 속성(누르기 함수, 시뮬레이션)만 적어 둔다
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual("@/components/lobby3d/lobby3d-canvas");
  return {
    ...actual,
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement(actual.default, props);
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

// ---------- 고정 값 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const INDICATOR = "방을 준비하고 있어요";
/** 장소 이름표(지금 화면의 글). "학습 기록"은 아래 메뉴 버튼과 글이 같다. */
const NAME_TAGS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로", "학습 기록"];
const MENU: { label: string; id: string }[] = [
  { label: "질문에 답하기", id: "question" },
  { label: "영어일기", id: "diary" },
  { label: "지금 생각나는대로", id: "thought" },
  { label: "학습 기록", id: "records" }
];
const GREETING_LINE = "오늘도 해냈어!";
const STREAK = "연속 3일";
const ROOM_FILE = "lobby-room.glb";
const CHARACTER_FILE = "writeloop.glb";
const FURNITURE_FILE = "lobby-furniture.glb";
const ALL_FILES = [ROOM_FILE, CHARACTER_FILE, FURNITURE_FILE];
const SLOW_TEST_MS = 30_000;

/** 시험용 방 T(066-⑥ 시나리오의 방): 구운 방 껍데기를 쓰지 않는 방. */
const ROOM_T: RoomSpec = {
  id: "qa-test",
  width: 9,
  depth: 13,
  wallHeight: 3.6,
  wallThickness: 0.5,
  hangWalls: ["back", "left", "right"],
  exits: [{ kind: "outside", x: 3.0, width: 2.0, depth: 0.7 }]
};

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** 처음 배치에서 책상만 (1.5, 6.5)로 옮긴 배치(서버에서 다른 배치가 온 것으로 쓴다). */
const MOVED_DESK: LobbyLayout = {
  ...copy(DEFAULT_LOBBY_LAYOUT),
  items: copy(DEFAULT_LOBBY_LAYOUT).items.map((item) => (item.id === "desk" ? { ...item, floor: { x: 1.5, z: 6.5, facing: 0 } } : item))
};

// ---------- 가짜 모델 ----------

function fakeModelFor(file: string): unknown {
  if (file === FURNITURE_FILE) {
    // 모델 이름마다 0.8칸 상자 하나를 주는 가구 묶음(창밖 판은 없다)
    const scene = new THREE.Group();
    (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
      if (name === "windowView") return undefined;
      const group = new THREE.Group();
      group.name = name;
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial()));
      return group;
    };
    return { scene, animations: [] };
  }
  if (file === ROOM_FILE) {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    return { scene, animations: [] };
  }
  // 라룹이: 078 테스트와 같이 빈 장면(뼈대·클립 없음)
  return { scene: new THREE.Group(), animations: [] };
}

function pendingModel(): MockModel {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { status: "pending", promise, resolve, value: null, error: null };
}

function mark(status: "loaded" | "failed", files: string[]) {
  for (const file of files) {
    const model = mockModels.get(file)!;
    model.status = status;
    if (status === "loaded") model.value = fakeModelFor(file);
    else model.error = new Error(`읽지 못했다(테스트 가짜): ${file}`);
    model.resolve();
  }
}

/** 로비를 열기 전에 그 파일을 읽어 둔다(앱 시작 때 미리 읽기가 끝난 것). */
function preloaded(...files: string[]) {
  mark("loaded", files);
}

/** 로비를 열기 전에 그 파일을 읽지 못한 것으로 둔다(앱 시작 때 미리 읽기가 실패한 것). */
function failedBeforeOpen(...files: string[]) {
  mark("failed", files);
}

/** 읽는 중이던 파일 읽기를 끝낸다(읽음 또는 읽지 못함). 장면은 그리지 않는다. */
async function settle(status: "loaded" | "failed", ...files: string[]) {
  mark(status, files);
  await flushAsync();
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** 3D 장면을 한 번 그린다: 등록된 useFrame을 모두 한 번 부르고 시계를 0.05초 돌린다. */
async function frame(count = 1) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      for (const part of [...mockFrames]) part({ camera: mockThree.camera!, gl: {}, clock: { elapsedTime: 0 }, scene: mockThree.scene! }, 0.05);
      jest.advanceTimersByTime(50);
    });
  }
  await flushAsync();
}

function hiddenByStyle(node: TestInstance | null): boolean {
  for (let current = node; current; current = current.parent) {
    const style = StyleSheet.flatten(current.props.style) as { opacity?: unknown; display?: unknown } | undefined;
    if (style?.opacity === 0 || style?.display === "none") return true;
  }
  return false;
}

function insideButton(node: TestInstance): boolean {
  for (let current: TestInstance | null = node; current; current = current.parent) {
    if (current.props.accessibilityRole === "button") return true;
  }
  return false;
}

/** 이 글이 보이는지(기본 질의로 찾히고 스타일로 숨지 않음). 버튼 안의 글은 빼고 볼 수 있다. */
function textShown(text: string, options: { skipButtons?: boolean } = {}): boolean {
  return screen.queryAllByText(text).some((node) => !(options.skipButtons && insideButton(node)) && !hiddenByStyle(node));
}

function indicatorShown(): boolean {
  return textShown(INDICATOR);
}

/** 보이는 장소 이름표(메뉴 버튼의 글은 빼고). */
function shownTags(): string[] {
  return NAME_TAGS.filter((tag) => textShown(tag, { skipButtons: true }));
}

function buttonShown(name: string): boolean {
  return screen.queryAllByRole("button", { name }).some((node) => !hiddenByStyle(node));
}

/** 방이 보이기 전 모습: 표시가 있고, 이름표·인사 말풍선·장소 안내가 없다. */
function beforeRoomView() {
  return {
    indicator: indicatorShown(),
    tags: shownTags(),
    greeting: textShown(GREETING_LINE),
    boardPrompt: textShown(MARKS.board.prompt)
  };
}
const BEFORE_ROOM = { indicator: true, tags: [], greeting: false, boardPrompt: false };

/** 방이 보인 뒤 모습(인사 직후): 표시가 없고, 이름표 다섯과 인사 말풍선이 보인다. */
function afterRoomView() {
  return { indicator: indicatorShown(), tags: shownTags(), greeting: textShown(GREETING_LINE) };
}
const AFTER_ROOM = { indicator: false, tags: NAME_TAGS, greeting: true };

const onMenu = jest.fn();
const onStreakPress = jest.fn();

function lobby(props: Partial<Lobby3dScreenProps> = {}) {
  return (
    <Lobby3dScreen
      devPanel={false}
      streakLabel={STREAK}
      onStreakPress={onStreakPress}
      onMenu={onMenu}
      greeting={{ line: GREETING_LINE, action: "wave", key: 1 }}
      layout={DEFAULT_LOBBY_LAYOUT}
      onSaveLayout={async (value: LobbyLayout) => value}
      {...props}
    />
  );
}

async function openLobby(props: Partial<Lobby3dScreenProps> = {}) {
  await render(lobby(props));
  await flushAsync();
}

async function tapBoard() {
  await act(async () => {
    mockCanvas.props!.onPointer("down", { point: null, mark: "board", onCharacter: false }, 200, 300);
  });
  await act(async () => {
    mockCanvas.props!.onPointer("up", { point: null, mark: "board", onCharacter: false }, 200, 300);
  });
}

/** 게시판을 눌러 라룹이가 도착할 때까지 장면을 그린다(최대 15초). */
async function walkToBoard() {
  await tapBoard();
  for (let index = 0; index < 300 && mockCanvas.props!.sim.arrived !== "board"; index += 1) await frame();
  expect(mockCanvas.props!.sim.arrived).toBe("board");
  await frame(5);
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockCanvas.props = null;
  mockModels.clear();
  for (const file of ALL_FILES) mockModels.set(file, pendingModel());
  onMenu.mockReset();
  onStreakPress.mockReset();
  // 읽지 못한 모델을 오류 경계가 잡을 때 React와 경계가 남기는 출력(지금 동작)은 출력만 막는다
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 바뀔 동작 ----------

describe("[spec] 079 바뀌는 동작: 방이 처음 보일 때까지 준비 표시를 띄우고 이름표·장소 안내·말풍선을 숨긴다", () => {
  test(
    "[바뀔] R1 로비를 열면 가구·라룹이 모델을 읽는 동안(방 껍데기는 미리 읽힘, 장면을 여러 번 그려도) 표시 '방을 준비하고 있어요'가 있고 이름표·인사 말풍선이 없다. 두 모델이 그려지고 장면을 한 번 그리면 표시가 사라지고 이름표 다섯과 인사 말풍선이 보인다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);
      await frame(10);
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R2 세 모델이 다 그려져도 그 상태로 장면을 한 번 그리기 전에는 표시가 남고 이름표가 없다. 한 번 그리면 표시가 사라지고 이름표가 보인다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      // 모델은 다 그려졌지만 아직 장면을 그리지 않았다
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test.each([
    ["방 껍데기", ROOM_FILE],
    ["라룹이", CHARACTER_FILE],
    ["가구 묶음", FURNITURE_FILE]
  ])(
    "[바뀔] R3 %s 모델만 아직 읽는 중이면 나머지 둘이 그려지고 장면을 여러 번 그려도 표시가 남고 이름표가 없다. 그 모델까지 그려지고 한 번 그리면 표시가 사라진다",
    async (_name, waiting) => {
      preloaded(...ALL_FILES.filter((file) => file !== waiting));
      await openLobby();
      await frame(10);
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await settle("loaded", waiting);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test.each([
    // [이름, 로비를 열기 전에 읽힌 파일, 로비를 연 뒤 읽지 못하는 파일, 로비를 연 뒤 읽히는 파일]
    ["방 껍데기만", [CHARACTER_FILE], [ROOM_FILE], [FURNITURE_FILE]],
    ["라룹이만", [ROOM_FILE], [CHARACTER_FILE], [FURNITURE_FILE]],
    ["가구 묶음만", [ROOM_FILE], [FURNITURE_FILE], [CHARACTER_FILE]]
  ])(
    "[바뀔] R4 %s 읽지 못하면(그 부분은 지금처럼 대신 그림) 그때까지 표시가 있고, 나머지가 그려지고 장면을 한 번 그린 뒤 표시가 사라지고 이름표가 보인다",
    async (_name, before, failing, loading) => {
      preloaded(...before);
      await openLobby();
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await settle("failed", ...failing);
      await settle("loaded", ...loading);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R4b 세 모델 모두 읽지 못하면(방 껍데기는 로비를 열기 전에 실패, 가구·라룹이는 연 뒤 실패) 그때까지 표시가 있고, 장면을 한 번 그린 뒤 표시가 사라지고 이름표가 보인다",
    async () => {
      failedBeforeOpen(ROOM_FILE);
      await openLobby();
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await settle("failed", FURNITURE_FILE, CHARACTER_FILE);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R5 구운 방 껍데기를 쓰지 않는 방(시험용 방 T)에서는 방 껍데기 모델을 기다리지 않는다: 가구 모델을 읽는 동안 표시가 있고, 가구·라룹이가 그려지고 한 번 그리면 표시가 사라진다",
    async () => {
      applyRoom(ROOM_T);
      applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
      // 방 껍데기 파일은 끝까지 읽는 중으로 둔다
      preloaded(CHARACTER_FILE);
      await openLobby();
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await settle("loaded", FURNITURE_FILE);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R6 처음 지을 배치가 정해지기 전(layoutReady false, 3D 그림판이 없음)에는 세 모델이 미리 읽혀 있어도 표시가 있고 이름표·인사 말풍선이 없다. 배치가 정해져 그림판이 생기고 한 번 그리면 표시가 사라진다",
    async () => {
      preloaded(...ALL_FILES);
      await openLobby({ layoutReady: false });
      await frame(10);
      expect(beforeRoomView()).toEqual(BEFORE_ROOM);

      await screen.rerender(lobby({ layoutReady: true }));
      await flushAsync();
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R7 방이 보이기 전에 게시판을 눌러 도착해도 장소 안내와 '들어가기' 버튼이 없다. 방이 보이면 게시판 안내와 '들어가기'가 보인다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await walkToBoard();
      expect({ prompt: textShown(MARKS.board.prompt), enter: buttonShown(MARKS.board.buttonLabel), indicator: indicatorShown() }).toEqual({
        prompt: false,
        enter: false,
        indicator: true
      });

      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      await frame();
      expect({ prompt: textShown(MARKS.board.prompt), enter: buttonShown(MARKS.board.buttonLabel), indicator: indicatorShown() }).toEqual({
        prompt: true,
        enter: true,
        indicator: false
      });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R8 방이 한 번 보인 뒤 배치가 바뀌어 방을 다시 지어도(서버 배치 도착) 표시를 다시 띄우지 않고 이름표가 그대로 보인다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      expect(indicatorShown()).toBe(true);
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);

      await screen.rerender(lobby({ layout: MOVED_DESK }));
      // 다시 지은 직후(장면을 아직 그리기 전)에도 표시가 없다
      expect({ indicator: indicatorShown(), tags: shownTags() }).toEqual({ indicator: false, tags: NAME_TAGS });
      await flushAsync();
      expect({ indicator: indicatorShown(), tags: shownTags() }).toEqual({ indicator: false, tags: NAME_TAGS });
      await frame(3);
      expect({ indicator: indicatorShown(), tags: shownTags() }).toEqual({ indicator: false, tags: NAME_TAGS });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] R9 방이 한 번 보인 뒤 편집 모드('꾸미기')에 들어가도 표시를 다시 띄우지 않고, '취소'로 나오면 표시 없이 이름표가 보인다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      expect(indicatorShown()).toBe(true);
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      await frame();
      expect(afterRoomView()).toEqual(AFTER_ROOM);

      await fireEvent.press(screen.getByRole("button", { name: "꾸미기" }));
      await flushAsync();
      expect(buttonShown("취소")).toBe(true);
      expect(indicatorShown()).toBe(false);
      await frame(3);
      expect(indicatorShown()).toBe(false);

      await fireEvent.press(screen.getByRole("button", { name: "취소" }));
      await flushAsync();
      expect({ indicator: indicatorShown(), tags: shownTags() }).toEqual({ indicator: false, tags: NAME_TAGS });
      await frame(3);
      expect({ indicator: indicatorShown(), tags: shownTags() }).toEqual({ indicator: false, tags: NAME_TAGS });
    },
    SLOW_TEST_MS
  );
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 079 그대로여야 할 동작: 방을 준비하는 동안에도 위아래 버튼은 보이고 누를 수 있다", () => {
  test(
    "[그대로] K1 모델을 읽는 동안 아래 메뉴 넷이 보이고, 누르면 그 메뉴로 간다(onMenu)",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frame(3);
      expect(MENU.map(({ label }) => ({ label, shown: buttonShown(label) }))).toEqual(MENU.map(({ label }) => ({ label, shown: true })));
      for (const { label } of MENU) {
        await fireEvent.press(screen.getByRole("button", { name: label }));
      }
      expect(onMenu.mock.calls.map(([id]) => id)).toEqual(MENU.map(({ id }) => id));
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K2 모델을 읽는 동안 머리 줄의 연속 칩·'꾸미기'·카메라 거리 버튼이 보이고 누를 수 있다(칩은 onStreakPress, 카메라는 거리 판을 열고, '꾸미기'는 편집 모드로 들어간다)",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frame(3);
      expect({ chip: buttonShown(STREAK), decorate: buttonShown("꾸미기"), camera: buttonShown("카메라 거리 설정") }).toEqual({
        chip: true,
        decorate: true,
        camera: true
      });

      await fireEvent.press(screen.getByRole("button", { name: STREAK }));
      expect(onStreakPress).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByRole("button", { name: "카메라 거리 설정" }));
      expect(textShown("카메라 거리")).toBe(true);
      await fireEvent.press(screen.getByRole("button", { name: "닫기" }));
      expect(textShown("카메라 거리")).toBe(false);

      await fireEvent.press(screen.getByRole("button", { name: "꾸미기" }));
      await flushAsync();
      expect({ cancel: buttonShown("취소"), done: buttonShown("완료") }).toEqual({ cancel: true, done: true });
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K3 모델을 읽는 동안에도 화면 바탕은 검정(#000000)이다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frame(3);
      const root = screen.container.children[0] as TestInstance;
      expect(StyleSheet.flatten(root.props.style)?.backgroundColor).toBe("#000000");
    },
    SLOW_TEST_MS
  );
});
