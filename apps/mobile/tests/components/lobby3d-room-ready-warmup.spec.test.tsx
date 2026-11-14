// [spec] qa 테스트(작업 082, 기능 변경, 모바일): 로비의 '방을 준비하고 있어요' 표시를 방의 모든 부분이 들어온 뒤에도 바로 내리지 않고,
// 표시 뒤에서 셰이더 미리 만들기·그림 미리 올리기를 마친 뒤 연달아 5프레임이 각각 34ms 안에 그려지면(상한 3초) 내린다.
// 표시가 떠 있는 동안 3D 자리를 불투명한 검은 판으로 가린다.
// 기대값은 명세(private 작업 폴더 082-2026-11-12-로비-준비-표시-뒤에서-다-끝내기/01-main-spec.md)에서만 가져온다.
// 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 명세 "바뀌는 동작":
//   - 방의 모든 부분이 들어온 뒤(079의 "방이 보였다" 조건)에도 표시를 내리지 않고, 표시 뒤에서
//     1) 방 장면과 창밖 풍경 장면이 쓰는 재질의 셰이더를 미리 만들고, 2) 두 장면이 쓰는 그림을 그래픽 메모리에 미리 올리고,
//     3) 그 뒤 계속 그리면서 연달아 5프레임이 각각 34ms 안에 그려지면(프레임 사이 간격이 34ms 이하) "방이 보였다"를 알린다.
//   - 상한: 방의 모든 부분이 들어온 때부터 3초가 지나면 기준을 채우지 못했어도 알린다.
//   - 표시가 떠 있는 동안 3D 자리를 불투명한 검은 판으로 가린다. 회전 표시와 문구는 그 위 가운데에 지금처럼 둔다.
// 명세 "그대로여야 할 동작": 표시의 모양과 자리, 위아래 버튼은 표시가 떠 있는 동안에도 보이고 누를 수 있다(검은 판은 누르기를 받지 않는다),
//   표시 동안 이름표·장소 안내·인사 말풍선을 숨기고 표시를 내리면 함께 보인다, 표시는 처음 한 번만 띄운다,
//   모델을 읽지 못해 대신 그린 부분도 들어온 것으로 센다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen), 3D 그리기(Lobby3dCanvas), 방 껍데기·가구 묶음·라룹이는 모두 진짜를 쓴다(079 테스트와 같은 구성).
//   Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다. useFrame은 테스트가 부를 때 한 번씩 돈다.
// - 한 프레임(frameAfter(ms))은 "ms만큼 시간이 지난 뒤 장면을 한 번 그린다"이다: 가짜 시계(Date.now·performance.now)를 ms만큼 돌리고,
//   r3f 시계(clock.elapsedTime)도 ms만큼 늘린 뒤, 등록된 useFrame을 모두 delta = ms/1000초로 한 번 부른다.
//   그래서 구현이 프레임 사이 간격을 delta·clock·Date.now·performance.now 가운데 무엇으로 재든 같은 간격을 본다.
// - 그래픽 장치(gl)는 가짜다. 실제 three의 WebGLRenderer에서 "셰이더 미리 만들기"는 compile 또는 compileAsync,
//   "그림을 그래픽 메모리에 올리기"는 initTexture라고 가정하고, 부른 순서·장면·그림·그때의 프레임 번호를 적어 둔다.
//   gl은 useFrame의 state.gl, useThree().gl, Canvas의 onCreated가 받는 state.gl로 모두 같은 것을 준다. 모르는 메서드는 아무것도 하지 않는다.
// - r3f는 <primitive object>를 장면에 붙인다. 가짜 Canvas는 붙이지 않으므로, 테스트가 그려진 primitive를 r3f 장면(useThree().scene)에
//   붙여 둔다(프레임마다, 그리고 구현이 장면을 훑거나 compile에 넘길 때). 그래서 "방 장면" = useThree().scene이고,
//   방 장면이 쓰는 그림으로 가짜 방 껍데기 모델의 그림(ROOM_TEXTURE)을, 창밖 풍경 장면이 쓰는 그림으로 가짜 창밖 장면의 그림을 쓴다.
// - "보인다"·"보이지 않는다", 이름표·말풍선·버튼 찾기는 079 테스트와 같다.
// - "검은 판"은 화면 맨 바깥(3D 자리) 말고, 화면 맨 바깥을 꽉 채우고(absolute로 위·아래·왼쪽·오른쪽 0) 바탕이 불투명한 검정이며
//   투명도로 숨지 않은 View다. 3D 그리기보다 뒤에(위에 그려지게) 있어야 하고, 회전 표시와 문구는 그보다 뒤에(또는 안에) 있어야 한다.
// - 한계: 실제 GPU에서 셰이더가 만들어졌는지, 끊김이 없는지는 볼 수 없다(사용자가 폰에서 본다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM } from "@/lib/lobby3d/room";

type FrameState = {
  camera: THREE.Camera;
  gl: unknown;
  clock: { elapsedTime: number; getElapsedTime: () => number; getDelta: () => number };
  scene: THREE.Scene;
  size: { width: number; height: number };
};
type FramePart = (state: FrameState, delta: number) => void;
type ModelStatus = "pending" | "loaded" | "failed";
interface MockModel {
  status: ModelStatus;
  promise: Promise<void>;
  resolve: () => void;
  value: unknown;
  error: Error | null;
}
/** 가짜 gl이 받은 것. frame은 그때까지 그린 프레임 수다. */
type GlCall = { kind: "compile"; scene: unknown; frame: number } | { kind: "initTexture"; texture: unknown; frame: number };

const mockThree: {
  camera: THREE.PerspectiveCamera | null;
  scene: THREE.Scene | null;
  size: { width: number; height: number };
  gl: unknown;
} = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 },
  gl: null
};
const mockFrames = new Set<FramePart>();
const mockModels = new Map<string, MockModel>();
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockGlLog: GlCall[] = [];
const mockClock = {
  elapsedTime: 0,
  lastDelta: 0,
  getElapsedTime() {
    return mockClock.elapsedTime;
  },
  getDelta() {
    return mockClock.lastDelta;
  }
};
/** 그린 프레임 수. */
const mockFrameCount = { value: 0 };
/** 가짜 창밖 장면(가장 최근에 만든 것)과 그 장면이 쓰는 그림. */
const mockOutdoor: { scene: THREE.Scene | null; texture: THREE.Texture | null } = { scene: null, texture: null };
/** primitive를 r3f 장면에 붙이는 일(테스트가 정의한다). */
const mockAttach: { sync: () => void } = { sync: () => {} };

/** 090-② 05 결정 3: 가구 일곱 파일 목록에 주는 가짜 모델 배열(같은 모델이면 같은 배열). */
const mockFurnitureLists = new Map<unknown, unknown[]>();
function mockFurnitureListOf(value: unknown, length: number): unknown[] {
  let list = mockFurnitureLists.get(value);
  if (!list || list.length !== length) {
    list = Array.from({ length }, () => value);
    mockFurnitureLists.set(value, list);
  }
  return list;
}

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(lobby3d-edit-scene-rebuild.spec과 같다)
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const frameState = () => ({ ...mockThree, clock: mockClock });
  return {
    // 자식을 그대로 그린다. onCreated가 있으면 처음 한 번 r3f 상태(gl 포함)를 준다
    Canvas: ({ children, onCreated }: { children: React.ReactNode; onCreated?: (state: unknown) => void }) => {
      React.useEffect(() => {
        onCreated?.(frameState());
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return React.createElement(React.Fragment, null, children);
    },
    useThree: (selector?: (state: unknown) => unknown) => (selector ? selector(frameState()) : frameState()),
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
    // 090-② 05 결정 3: 가구는 앱에 든 처음 방 일곱 파일을 목록으로 한 번에 읽는다. 그 목록은 FURNITURE_FILE("furniture/처음-방-일곱") 하나로 보고,
    // 읽은 값은 파일마다 같은 가짜 모델의 배열이다(진짜 useLoader처럼 같은 모델이면 같은 배열)
    useLoader: (_loader: unknown, input: unknown) => {
      const furnitureList = Array.isArray(input);
      const value = ((url: unknown) => {
        const model = mockModels.get(String(url));
        if (!model) throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
        if (model.status === "loaded") return model.value;
        if (model.status === "failed") throw model.error;
        throw model.promise;
      })(furnitureList ? "furniture/처음-방-일곱" : input);
      return furnitureList ? mockFurnitureListOf(value, (input as unknown[]).length) : value;
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
// 090-② 05 결정 3: 가구 묶음 대신 앱에 든 처음 방 가구 일곱의 파일이다(Jest가 읽지 못하는 파일이라 이름만 준다)
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
// 창밖 풍경: 그림(map) 하나를 쓰는 판 하나가 든 장면
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => {
      const scene = new T.Scene();
      const texture = new T.DataTexture(new Uint8Array([10, 200, 30, 255]), 1, 1, T.RGBAFormat);
      texture.needsUpdate = true;
      scene.add(new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: texture })));
      mockOutdoor.scene = scene;
      mockOutdoor.texture = texture;
      return { scene, setDaylight: () => {}, update: () => {}, dispose: () => {} };
    }
  };
});
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
// 3D 그리기는 진짜를 그리고 받은 속성을 그대로 넘긴다. 화면이 넘긴 속성만 적어 둔다
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
const HEADER_BUTTONS = [STREAK, "꾸미기", "카메라 거리 설정"];
const ROOM_FILE = "lobby-room.glb";
const CHARACTER_FILE = "writeloop.glb";
// 090-② 05 결정 3: 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱 파일(목록)이다. 그 목록을 이 이름 하나로 본다
const FURNITURE_FILE = "furniture/처음-방-일곱";
const ALL_FILES = [ROOM_FILE, CHARACTER_FILE, FURNITURE_FILE];
const SLOW_TEST_MS = 60_000;

/** 명세의 값: 고르게 그려졌다고 보는 프레임 사이 간격(이하)과 연달아 그려야 할 프레임 수, 상한(방의 모든 부분이 들어온 때부터). */
const STEADY_MS = 34;
const STEADY_FRAMES = 5;
const CAP_MS = 3000;
/** 기준을 채우는 빠른 프레임 간격과 채우지 못하는 느린 프레임 간격. */
const FAST_MS = 16;
const SLOW_MS = 50;

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** 처음 배치에서 책상만 (1.5, 6.5)로 옮긴 배치(서버에서 다른 배치가 온 것으로 쓴다). */
const MOVED_DESK: LobbyLayout = {
  ...copy(DEFAULT_LOBBY_LAYOUT),
  items: copy(DEFAULT_LOBBY_LAYOUT).items.map((item) => (item.id === "desk" ? { ...item, floor: { x: 1.5, z: 6.5, facing: 0 } } : item))
};

// ---------- 가짜 모델 ----------

/** 방 껍데기 모델이 쓰는 그림(방 장면이 쓰는 그림). 테스트마다 새로 만든다. */
let roomTexture: THREE.Texture;

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
    // 그림(map)을 쓰는 판 하나. 구운 방 껍데기는 이 그림을 그대로 쓴다
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: roomTexture })));
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

/** 로비를 열기 전에 그 파일을 읽지 못한 것으로 둔다. */
function failedBeforeOpen(...files: string[]) {
  mark("failed", files);
}

/** 읽는 중이던 파일 읽기를 끝낸다(읽음 또는 읽지 못함). 장면은 그리지 않는다. 이 뒤로 방의 모든 부분이 들어온 것이다. 돌려주는 값은 그때의 gl 기록 길이다. */
async function settle(status: "loaded" | "failed", ...files: string[]): Promise<number> {
  const at = mockGlLog.length;
  mark(status, files);
  await flushAsync();
  return at;
}

// ---------- 가짜 gl ----------

function makeGl(): unknown {
  const known: Record<string, unknown> = {
    compile: (scene: unknown) => {
      mockAttach.sync();
      mockGlLog.push({ kind: "compile", scene, frame: mockFrameCount.value });
      return new Set();
    },
    compileAsync: (scene: unknown) => {
      mockAttach.sync();
      mockGlLog.push({ kind: "compile", scene, frame: mockFrameCount.value });
      return Promise.resolve(scene);
    },
    initTexture: (texture: unknown) => {
      mockGlLog.push({ kind: "initTexture", texture, frame: mockFrameCount.value });
    },
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    render: () => {}
  };
  return new Proxy(known, {
    get(target, property) {
      if (typeof property === "symbol" || property === "then") return undefined;
      if (property in target) return target[property];
      return () => {};
    }
  });
}

// ---------- r3f 장면에 primitive 붙이기 ----------

const attached = new Set<THREE.Object3D>();

/** 그려진 primitive를 r3f처럼 장면(또는 감싼 primitive)에 붙이고, 사라진 것은 뗀다. */
function syncPrimitives() {
  const scene = mockThree.scene;
  if (!scene) return;
  let nodes: TestInstance[];
  try {
    nodes = screen.container.queryAll((node) => node.type === "primitive");
  } catch {
    return;
  }
  const want = new Set<THREE.Object3D>();
  for (const node of nodes) {
    const object = node.props.object as THREE.Object3D | undefined;
    if (!object) continue;
    let parent: THREE.Object3D = scene;
    for (let up = node.parent; up; up = up.parent) {
      if (up.type === "primitive" && up.props.object) {
        parent = up.props.object as THREE.Object3D;
        break;
      }
    }
    want.add(object);
    if (object.parent !== parent) parent.add(object);
    attached.add(object);
  }
  for (const object of [...attached]) {
    if (!want.has(object)) {
      object.parent?.remove(object);
      attached.delete(object);
    }
  }
}

/** 장면을 훑을 때도 먼저 붙인다(r3f에서는 그려지면 이미 장면에 붙어 있다). */
function makeScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const traverse = THREE.Object3D.prototype.traverse;
  const traverseVisible = THREE.Object3D.prototype.traverseVisible;
  scene.traverse = function (this: THREE.Object3D, callback: (object: THREE.Object3D) => unknown) {
    syncPrimitives();
    traverse.call(this, callback);
  };
  scene.traverseVisible = function (this: THREE.Object3D, callback: (object: THREE.Object3D) => unknown) {
    syncPrimitives();
    traverseVisible.call(this, callback);
  };
  return scene;
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** ms만큼 시간이 지난 뒤 3D 장면을 한 번 그린다(프레임 사이 간격 = ms). count번 되풀이한다. */
async function frameAfter(ms: number, count = 1) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      mockClock.elapsedTime += ms / 1000;
      mockClock.lastDelta = ms / 1000;
      mockFrameCount.value += 1;
      syncPrimitives();
      const state: FrameState = {
        camera: mockThree.camera!,
        gl: mockThree.gl,
        clock: mockClock,
        scene: mockThree.scene!,
        size: mockThree.size
      };
      for (const part of [...mockFrames]) part(state, ms / 1000);
      await Promise.resolve();
      await Promise.resolve();
      // 그 프레임에서 바로 하라고 맡긴 일(0초 타이머)은 시간을 더 돌리지 않고 끝낸다
      jest.advanceTimersByTime(0);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }
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

/** 표시가 떠 있는 모습: 표시가 있고, 이름표·인사 말풍선·장소 안내가 없다(검은 판은 B8·B9에서 따로 본다). */
function preparingView() {
  return {
    indicator: indicatorShown(),
    tags: shownTags(),
    greeting: textShown(GREETING_LINE),
    boardPrompt: textShown(MARKS.board.prompt)
  };
}
const PREPARING = { indicator: true, tags: [], greeting: false, boardPrompt: false };

/** 표시를 내린 뒤 모습(인사 직후): 표시가 없고, 이름표 다섯과 인사 말풍선이 보인다. */
function shownView() {
  return { indicator: indicatorShown(), tags: shownTags(), greeting: textShown(GREETING_LINE) };
}
const SHOWN = { indicator: false, tags: NAME_TAGS, greeting: true };

// ---------- 검은 판 찾기 ----------

/** 화면 맨 바깥(3D 자리). */
function rootView(): TestInstance {
  return screen.container.children[0] as TestInstance;
}

/** 모든 요소를 앞에서부터(먼저 그려지는 것부터) 늘어놓은 것. 뒤에 있을수록 위에 그려진다. */
function inOrder(): TestInstance[] {
  const list: TestInstance[] = [];
  const walk = (node: TestInstance) => {
    list.push(node);
    for (const child of node.children) if (typeof child !== "string") walk(child);
  };
  walk(screen.container);
  return list;
}

const BLACK = new Set(["#000", "#000000", "#000f", "#000000ff", "black", "rgb(0,0,0)", "rgba(0,0,0,1)"]);

function isOpaqueBlack(color: unknown): boolean {
  return typeof color === "string" && BLACK.has(color.replace(/\s+/g, "").toLowerCase());
}

/** 감싼 것(화면 맨 바깥)을 꽉 채우는지: absolute로 위·아래·왼쪽·오른쪽 0(또는 inset 0). */
function fillsParent(node: TestInstance): boolean {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
  if (style.position !== "absolute") return false;
  if (style.inset === 0) return true;
  return style.top === 0 && style.bottom === 0 && style.left === 0 && style.right === 0;
}

/** 투명도가 1보다 작은 곳이 그 요소나 감싼 것에 있는지. */
function seeThrough(node: TestInstance): boolean {
  for (let current: TestInstance | null = node; current; current = current.parent) {
    const style = (StyleSheet.flatten(current.props.style) ?? {}) as { opacity?: unknown; display?: unknown };
    if (typeof style.opacity === "number" && style.opacity < 1) return true;
    if (style.display === "none") return true;
  }
  return false;
}

/** 3D 자리를 가리는 검은 판: 화면 맨 바깥이 아니고, 맨 바깥까지 감싼 것이 모두 꽉 채우며, 불투명한 검정 바탕이고 비치지 않는 View. */
function coverPanels(): TestInstance[] {
  const root = rootView();
  return inOrder().filter((node) => {
    if (node === root || node.type !== "View") return false;
    const style = (StyleSheet.flatten(node.props.style) ?? {}) as { backgroundColor?: unknown };
    if (!isOpaqueBlack(style.backgroundColor)) return false;
    if (seeThrough(node)) return false;
    for (let current: TestInstance | null = node; current && current !== root; current = current.parent) {
      if (!fillsParent(current)) return false;
    }
    return true;
  });
}

/** 3D 그리기가 깔린 View(누르기를 먼저 잡는 판. 버튼(Pressable)과 달리 onStartShouldSetResponderCapture가 있다). */
function canvasView(): TestInstance | null {
  return inOrder().find((node) => typeof node.props.onStartShouldSetResponderCapture === "function") ?? null;
}

/** 누르기를 받지 않는지: 그 요소나 맨 바깥까지 감싼 것에 pointerEvents "none"이 있거나, 그 요소가 "box-none"이고 안에 누를 것이 없다. */
function ignoresTouches(node: TestInstance): boolean {
  const root = rootView();
  for (let current: TestInstance | null = node; current && current !== root; current = current.parent) {
    if (current.props.pointerEvents === "none") return true;
  }
  if (node.props.pointerEvents !== "box-none") return false;
  const pressable = node.queryAll(
    (inner) => inner !== node && (typeof inner.props.onPress === "function" || typeof inner.props.onResponderGrant === "function" || typeof inner.props.onStartShouldSetResponder === "function")
  );
  return pressable.length === 0;
}

function indicatorNodes(): { spinner: TestInstance | undefined; text: TestInstance | undefined } {
  return {
    spinner: inOrder().find((node) => node.type === "ActivityIndicator"),
    text: screen.queryAllByText(INDICATOR)[0]
  };
}

/** 3D 그리기 위에 있고 누르기를 받지 않으며, 회전 표시와 문구가 그 위(뒤 또는 안)에 있는 검은 판의 수. */
function goodPanels(): number {
  const order = inOrder();
  const canvas = canvasView();
  const { spinner, text } = indicatorNodes();
  if (!spinner || !text) return 0;
  return coverPanels().filter(
    (panel) =>
      (canvas === null || order.indexOf(panel) > order.indexOf(canvas)) &&
      ignoresTouches(panel) &&
      order.indexOf(spinner) > order.indexOf(panel) &&
      order.indexOf(text) > order.indexOf(panel)
  ).length;
}

// ---------- 화면 ----------

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

/** 표시가 사라질 때까지 ms 간격으로 그린다(최대 limit프레임). 사라질 때까지 그린 프레임 수를 돌려준다(못 사라지면 null). */
async function framesUntilShown(ms: number, limit: number): Promise<number | null> {
  for (let index = 1; index <= limit; index += 1) {
    await frameAfter(ms);
    if (!indicatorShown()) return index;
  }
  return null;
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = makeScene();
  mockThree.gl = makeGl();
  mockAttach.sync = syncPrimitives;
  attached.clear();
  mockGlLog.length = 0;
  mockClock.elapsedTime = 0;
  mockClock.lastDelta = 0;
  mockFrameCount.value = 0;
  mockOutdoor.scene = null;
  mockOutdoor.texture = null;
  mockFrames.clear();
  mockCanvas.props = null;
  mockModels.clear();
  for (const file of ALL_FILES) mockModels.set(file, pendingModel());
  roomTexture = new THREE.DataTexture(new Uint8Array([200, 150, 100, 255]), 1, 1, THREE.RGBAFormat);
  roomTexture.needsUpdate = true;
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

describe("[spec] 082 바뀌는 동작: 방의 모든 부분이 들어온 뒤에도 표시 뒤에서 준비를 마치고 고르게 그려질 때(상한 3초) 표시를 내린다", () => {
  test(
    "[바뀔] B1 모든 부분이 들어온 뒤 16ms 간격으로 4프레임을 그려도 표시가 남고 이름표·인사 말풍선이 없다. 계속 16ms로 그리면 3초 전에 표시가 사라지고 이름표 다섯과 인사 말풍선이 보인다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      expect(preparingView()).toEqual(PREPARING);

      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      expect(preparingView()).toEqual(PREPARING);
      for (let index = 1; index <= STEADY_FRAMES - 1; index += 1) {
        await frameAfter(FAST_MS);
        expect({ frame: index, ...preparingView() }).toEqual({ frame: index, ...PREPARING });
      }

      // 16ms × 40 = 640ms(상한 3초보다 한참 앞)
      const more = await framesUntilShown(FAST_MS, 40);
      expect(more).not.toBeNull();
      expect(shownView()).toEqual(SHOWN);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B2 프레임 사이 간격이 정확히 34ms면 기준을 채운다: 4프레임 뒤에도 표시가 남고, 30프레임(1.02초) 안에 표시가 사라진다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      await frameAfter(STEADY_MS, STEADY_FRAMES - 1);
      expect(preparingView()).toEqual(PREPARING);

      const more = await framesUntilShown(STEADY_MS, 30 - (STEADY_FRAMES - 1));
      expect(more).not.toBeNull();
      expect(shownView()).toEqual(SHOWN);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B3 프레임 사이 간격이 35ms면 기준을 채우지 못한다: 모든 부분이 들어온 뒤 40프레임(1.4초)을 그려도 표시가 남고 이름표·인사 말풍선이 없다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      for (let index = 1; index <= 40; index += 1) {
        await frameAfter(STEADY_MS + 1);
        if (!indicatorShown()) break;
      }
      expect(preparingView()).toEqual(PREPARING);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B4 '연달아'가 아니면 기준을 채우지 못한다: 16ms 4프레임 뒤 50ms 1프레임을 되풀이하면 모든 부분이 들어온 뒤 2.6초까지 표시가 남는다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      let elapsed = 0;
      let shownAt: number | null = null;
      while (elapsed + FAST_MS * 4 + SLOW_MS <= 2600 && shownAt === null) {
        for (const ms of [FAST_MS, FAST_MS, FAST_MS, FAST_MS, SLOW_MS]) {
          await frameAfter(ms);
          elapsed += ms;
          if (!indicatorShown()) {
            shownAt = elapsed;
            break;
          }
        }
      }
      expect({ shownAt, ...preparingView() }).toEqual({ shownAt: null, ...PREPARING });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B5 16ms 5프레임 뒤 50ms 1프레임을 되풀이하면 연달아 5프레임을 채우므로 2.6초 안에 표시가 사라진다(처음 4프레임 뒤에는 남아 있다)",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      await frameAfter(FAST_MS, STEADY_FRAMES - 1);
      expect(preparingView()).toEqual(PREPARING);
      let elapsed = FAST_MS * (STEADY_FRAMES - 1);
      // 이어서 16ms 1프레임으로 첫 묶음(16ms × 5)을 마치고, 50ms 1프레임 + 16ms 5프레임을 되풀이한다
      const pattern = [FAST_MS, SLOW_MS, FAST_MS, FAST_MS, FAST_MS, FAST_MS];
      let shownAt: number | null = null;
      for (let step = 0; elapsed < 2600 && shownAt === null; step += 1) {
        const ms = pattern[step % pattern.length];
        await frameAfter(ms);
        elapsed += ms;
        if (!indicatorShown()) shownAt = elapsed;
      }
      expect(shownAt).not.toBeNull();
      expect(shownView()).toEqual(SHOWN);
    },
    SLOW_TEST_MS
  );

  test.each([
    // [이름, 방 껍데기를 로비를 열기 전에 읽음/못 읽음, 가구·라룹이를 연 뒤 읽음/못 읽음]
    ["모두 읽음", "loaded", "loaded"],
    ["모두 읽지 못함(대신 그림)", "failed", "failed"]
  ] as const)(
    "[바뀔] B6 상한(%s): 모델을 기다리며 2초를 그린 뒤 모든 부분이 들어오고, 그 뒤 50ms 간격(기준 못 채움)으로 그리면 2.8초에는 표시가 남고, 3.2초까지는 표시가 사라지고 이름표 다섯과 인사 말풍선이 보인다",
    async (_name, roomStatus, restStatus) => {
      if (roomStatus === "loaded") preloaded(ROOM_FILE);
      else failedBeforeOpen(ROOM_FILE);
      await openLobby();
      // 들어오기 전 2초: 상한은 들어온 때부터 잰다
      await frameAfter(SLOW_MS, 40);
      expect(preparingView()).toEqual(PREPARING);

      await settle(restStatus, FURNITURE_FILE, CHARACTER_FILE);
      let elapsed = 0;
      let shownAt: number | null = null;
      while (elapsed < 2800) {
        await frameAfter(SLOW_MS);
        elapsed += SLOW_MS;
        if (shownAt === null && !indicatorShown()) shownAt = elapsed;
      }
      expect({ elapsed, shownAt, ...preparingView() }).toEqual({ elapsed: 2800, shownAt: null, ...PREPARING });

      while (elapsed < CAP_MS + 200 && indicatorShown()) {
        await frameAfter(SLOW_MS);
        elapsed += SLOW_MS;
      }
      expect({ hiddenBy3200: elapsed <= CAP_MS + 200, ...shownView() }).toEqual({ hiddenBy3200: true, ...SHOWN });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B7 표시를 내리기 전에, 모든 부분이 들어온 뒤 방 장면(r3f 장면)과 창밖 풍경 장면의 셰이더를 만들고(compile/compileAsync) 두 장면의 그림(방 껍데기 그림, 창밖 그림)을 올리며(initTexture), 표시는 그 마지막 일로부터 5프레임 이상 지나서 사라진다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      const settledAt = await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      const outdoorScene = mockOutdoor.scene;
      const outdoorTexture = mockOutdoor.texture;
      expect({ outdoorScene: outdoorScene !== null, outdoorTexture: outdoorTexture !== null }).toEqual({ outdoorScene: true, outdoorTexture: true });

      const more = await framesUntilShown(FAST_MS, 60);
      expect(more).not.toBeNull();
      const hiddenFrame = mockFrameCount.value;
      const after = mockGlLog.slice(settledAt);
      const roomCompile = after.filter((call) => call.kind === "compile" && call.scene === mockThree.scene);
      const outdoorCompile = after.filter((call) => call.kind === "compile" && call.scene === outdoorScene);
      const roomUpload = after.filter((call) => call.kind === "initTexture" && call.texture === roomTexture);
      const outdoorUpload = after.filter((call) => call.kind === "initTexture" && call.texture === outdoorTexture);
      expect({
        roomCompile: roomCompile.length > 0,
        outdoorCompile: outdoorCompile.length > 0,
        roomUpload: roomUpload.length > 0,
        outdoorUpload: outdoorUpload.length > 0
      }).toEqual({ roomCompile: true, outdoorCompile: true, roomUpload: true, outdoorUpload: true });
      // 미리 만들기·올리기를 마친 뒤(각 일의 첫 번) 연달아 5프레임을 그리고서 사라진다
      const prepared = Math.max(roomCompile[0].frame, outdoorCompile[0].frame, roomUpload[0].frame, outdoorUpload[0].frame);
      expect(hiddenFrame - prepared).toBeGreaterThanOrEqual(STEADY_FRAMES);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B8 표시가 떠 있는 동안(모델을 읽는 동안과, 모든 부분이 들어온 뒤 16ms 4프레임 동안) 3D 자리를 불투명한 검은 판이 꽉 채워 가린다: 판은 3D 그리기보다 위(뒤)에 있고 누르기를 받지 않으며, 회전 표시와 문구는 판보다 위(뒤 또는 안)에 있다. 표시를 내리면 판도 없다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      expect({ canvas: canvasView() !== null, indicator: indicatorShown(), coveringPanels: goodPanels() > 0 }).toEqual({
        canvas: true,
        indicator: true,
        coveringPanels: true
      });

      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      for (let index = 1; index <= STEADY_FRAMES - 1; index += 1) {
        await frameAfter(FAST_MS);
        expect({ frame: index, indicator: indicatorShown(), coveringPanels: goodPanels() > 0 }).toEqual({ frame: index, indicator: true, coveringPanels: true });
      }

      const more = await framesUntilShown(FAST_MS, 60);
      expect(more).not.toBeNull();
      expect({ indicator: indicatorShown(), panels: coverPanels().length }).toEqual({ indicator: false, panels: 0 });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B9 처음 지을 배치가 정해지기 전(layoutReady false, 3D 그림판이 없음)에도 표시와 검은 판이 3D 자리를 가린다",
    async () => {
      preloaded(...ALL_FILES);
      await openLobby({ layoutReady: false });
      await frameAfter(SLOW_MS, 3);
      expect({ canvas: canvasView() !== null, coveringPanels: goodPanels() > 0, ...preparingView() }).toEqual({ canvas: false, coveringPanels: true, ...PREPARING });
    },
    SLOW_TEST_MS
  );
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 082 그대로여야 할 동작", () => {
  test(
    "[그대로] K1 표시의 모양과 자리: 흰 회전 표시(color #FFFFFF)와 문구 '방을 준비하고 있어요'(14·600·#FFFFFF)가 3D 자리를 꽉 채운 같은 칸의 가로·세로 가운데에, 회전 표시가 위·문구가 아래로 있다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      const { spinner, text } = indicatorNodes();
      expect({ spinner: spinner !== undefined, text: text !== undefined }).toEqual({ spinner: true, text: true });
      const textStyle = StyleSheet.flatten(text!.props.style) as { fontSize?: unknown; fontWeight?: unknown; color?: unknown };
      expect({ spinnerColor: spinner!.props.color, fontSize: textStyle.fontSize, fontWeight: textStyle.fontWeight, color: textStyle.color }).toEqual({
        spinnerColor: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
        color: "#FFFFFF"
      });
      // 회전 표시와 문구를 함께 담은 가장 가까운 칸
      const holder = (() => {
        for (let current = spinner!.parent; current; current = current.parent) {
          if (current.queryAll((node) => node === text).length > 0) return current;
        }
        return null;
      })();
      expect(holder).not.toBeNull();
      const style = (StyleSheet.flatten(holder!.props.style) ?? {}) as Record<string, unknown>;
      const root = rootView();
      let fills = true;
      for (let current: TestInstance | null = holder; current && current !== root; current = current.parent) fills = fills && fillsParent(current);
      expect({ fills, alignItems: style.alignItems, justifyContent: style.justifyContent, direction: style.flexDirection ?? "column" }).toEqual({
        fills: true,
        alignItems: "center",
        justifyContent: "center",
        direction: "column"
      });
      const order = inOrder();
      expect(order.indexOf(spinner!)).toBeLessThan(order.indexOf(text!));
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K2 표시가 떠 있는 동안 아래 메뉴 넷과 머리 줄 버튼 셋이 보이고 검은 판보다 위(뒤)에 있으며 누를 수 있다(메뉴는 onMenu, 연속 칩은 onStreakPress). 3D 자리를 가리는 판은 모두 누르기를 받지 않는다",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      expect(indicatorShown()).toBe(true);
      const names = [...MENU.map(({ label }) => label), ...HEADER_BUTTONS];
      expect(names.map((name) => ({ name, shown: buttonShown(name) }))).toEqual(names.map((name) => ({ name, shown: true })));

      const order = inOrder();
      const panels = coverPanels();
      const lastPanel = Math.max(-1, ...panels.map((panel) => order.indexOf(panel)));
      const buttons = names.map((name) => ({ name, above: screen.getAllByRole("button", { name }).every((node) => order.indexOf(node) > lastPanel) }));
      expect(buttons).toEqual(names.map((name) => ({ name, above: true })));
      expect(panels.map((panel) => ignoresTouches(panel))).toEqual(panels.map(() => true));

      for (const { label } of MENU) {
        await fireEvent.press(screen.getByRole("button", { name: label }));
      }
      expect(onMenu.mock.calls.map(([id]) => id)).toEqual(MENU.map(({ id }) => id));
      await fireEvent.press(screen.getByRole("button", { name: STREAK }));
      expect(onStreakPress).toHaveBeenCalledTimes(1);
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K3 표시는 처음 한 번만: 표시가 사라진 뒤 배치가 바뀌어 방을 다시 지어도, 꾸미기에 들어갔다 '취소'로 나와도 표시·검은 판이 다시 뜨지 않고 이름표가 보인다(빠른 프레임·느린 프레임 모두)",
    async () => {
      preloaded(ROOM_FILE);
      await openLobby();
      await settle("loaded", FURNITURE_FILE, CHARACTER_FILE);
      expect(await framesUntilShown(FAST_MS, 60)).not.toBeNull();
      expect(shownView()).toEqual(SHOWN);

      const quiet = () => ({ indicator: indicatorShown(), blackCover: coverPanels().length > 0, tags: shownTags() });
      const QUIET = { indicator: false, blackCover: false, tags: NAME_TAGS };
      await screen.rerender(lobby({ layout: MOVED_DESK }));
      expect(quiet()).toEqual(QUIET);
      await flushAsync();
      expect(quiet()).toEqual(QUIET);
      await frameAfter(SLOW_MS, 3);
      expect(quiet()).toEqual(QUIET);
      await frameAfter(FAST_MS, 10);
      expect(quiet()).toEqual(QUIET);

      await fireEvent.press(screen.getByRole("button", { name: "꾸미기" }));
      await flushAsync();
      expect({ cancel: buttonShown("취소"), indicator: indicatorShown(), blackCover: coverPanels().length > 0 }).toEqual({
        cancel: true,
        indicator: false,
        blackCover: false
      });
      await frameAfter(SLOW_MS, 3);
      expect({ indicator: indicatorShown(), blackCover: coverPanels().length > 0 }).toEqual({ indicator: false, blackCover: false });

      await fireEvent.press(screen.getByRole("button", { name: "취소" }));
      await flushAsync();
      expect(quiet()).toEqual(QUIET);
      await frameAfter(FAST_MS, 10);
      expect(quiet()).toEqual(QUIET);
    },
    SLOW_TEST_MS
  );

  test.each([
    // [이름, 로비를 열기 전에 읽힌 파일, 로비를 연 뒤 읽지 못하는 파일, 로비를 연 뒤 읽히는 파일]
    ["방 껍데기만", [CHARACTER_FILE], [ROOM_FILE], [FURNITURE_FILE]],
    ["라룹이만", [ROOM_FILE], [CHARACTER_FILE], [FURNITURE_FILE]],
    ["가구 묶음만", [ROOM_FILE], [FURNITURE_FILE], [CHARACTER_FILE]]
  ])(
    "[그대로] K4 %s 읽지 못해도(그 부분은 대신 그림) 들어온 것으로 세어, 16ms 간격으로 그리면 60프레임 안에 표시가 사라지고 이름표 다섯과 인사 말풍선이 보인다",
    async (_name, before, failing, loading) => {
      preloaded(...before);
      await openLobby();
      await frameAfter(SLOW_MS, 3);
      expect(preparingView().indicator).toBe(true);

      await settle("failed", ...failing);
      await settle("loaded", ...loading);
      expect(await framesUntilShown(FAST_MS, 60)).not.toBeNull();
      expect({ indicator: indicatorShown(), tags: shownTags(), greeting: textShown(GREETING_LINE) }).toEqual({
        indicator: false,
        tags: NAME_TAGS,
        greeting: true
      });
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K5 한 모델이라도 읽는 중이면 16ms 간격으로 오래(3.2초) 그려도 표시가 남고 이름표·인사 말풍선·장소 안내가 없다",
    async () => {
      preloaded(ROOM_FILE, CHARACTER_FILE);
      await openLobby();
      await frameAfter(FAST_MS, 200);
      expect({ indicator: indicatorShown(), tags: shownTags(), greeting: textShown(GREETING_LINE), boardPrompt: textShown(MARKS.board.prompt) }).toEqual({
        indicator: true,
        tags: [],
        greeting: false,
        boardPrompt: false
      });
    },
    SLOW_TEST_MS
  );
});
