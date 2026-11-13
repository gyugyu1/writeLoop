// [spec] qa 테스트(작업 081, 리팩터링: 로비 장면 짓기 빠르게, 모바일): 코드로 지은 방(lobby3d-canvas의 world.shell)이 그려질 때의
// 모양과 바닥 그림을 고치기 전 코드 그대로 적어 둔다. 좋고 나쁨과 관계없이 지금 값이 기대값이고, 고치기 전에도 뒤에도 통과해야 한다.
// 명세(private 작업 폴더 081-2026-11-12-로비-장면-짓기-빠르게/01-main-spec.md) "바꾸지 않는 것"의 코드로 지은 방:
//   그려질 때의 모양과 바닥 그림(같은 픽셀 값, 같은 반복·필터 설정), 구운 방 껍데기를 못 읽었을 때 코드로 지은 방이 보이는 것.
// 바닥 그림을 언제 만드는지(범위 2)는 이번 리팩터링이 바꾸는 것이라 보지 않는다. 그래서 바닥 그림은 늘 "코드로 지은 방이 보이는 채로
// 한 프레임을 그린 뒤"에만 읽는다(그리기 전에 그림이 있는지·없는지는 단언하지 않는다).
//
// 어떻게 보나(지금 코드는 부르는 방법을 알려고만 읽었다. 가짜 모듈 구성은 lobby3d-room-ready-indicator.spec과 같다):
// - 화면(Lobby3dScreen), 3D 그리기(Lobby3dCanvas), 구운 방(BakedRoom)·가구 묶음(BakedFurniture)은 진짜를 쓰고,
//   Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다. 창밖 장면·라룹이·햇빛 조명은 빈 것으로 바꾼다.
// - useLoader는 파일마다 테스트가 정한 대로 가짜 모델을 주거나(읽음) 오류를 던진다(읽지 못함. 오류 경계가 지금처럼 대신 그리게 한다).
// - "한 프레임을 그린다"(drawFrame)는 실제 r3f·three가 하는 순서를 따른다: 등록된 useFrame을 모두 한 번 부른 뒤, 3D 그리기가 내놓은
//   방(world.root)에서 보이는 것만(traverseVisible) 그리는 물체마다 three의 WebGLRenderer가 그리기 직전에 부르는
//   object.onBeforeRender와 material.onBeforeRender를 같은 인자 순서로 부른다. 지금 코드에는 둘 다 빈 함수다.
// - 바닥은 방 안에서 PlaneGeometry(방 폭, 방 깊이, 32, 44)를 쓰는 물체로 찾는다. 코드로 지은 방은 그 부모다.
// - 바닥 그림의 픽셀은 image.data의 sha256(64자)과 몇 점의 값으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, currentRoom, type RoomSpec } from "@/lib/lobby3d/room";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
/** 파일마다 읽음(모델) 또는 읽지 못함(오류). */
const mockFiles = new Map<string, { value: unknown } | { error: Error }>();

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

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(다른 lobby3d spec과 같다)
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
    // 090-② 05 결정 3: 가구는 앱에 든 처음 방 일곱 파일을 목록으로 한 번에 읽는다. 그 목록은 FURNITURE_FILE("furniture/처음-방-일곱") 하나로 보고,
    // 읽은 값은 파일마다 같은 가짜 모델의 배열이다(진짜 useLoader처럼 같은 모델이면 같은 배열)
    useLoader: (_loader: unknown, input: unknown) => {
      const furnitureList = Array.isArray(input);
      const value = ((url: unknown) => {
        const file = mockFiles.get(String(url));
        if (!file) throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
        if ("error" in file) throw file.error;
        return file.value;
      })(furnitureList ? "furniture/처음-방-일곱" : input);
      return furnitureList ? mockFurnitureListOf(value, (input as unknown[]).length) : value;
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
// 090-② 05 결정 3: 가구 묶음 대신 앱에 든 처음 방 가구 일곱의 파일이다(Jest가 읽지 못하는 파일이라 이름만 준다)
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-character", () => ({
  BUBBLE_HEIGHT: 2,
  Character: () => null,
  CharacterErrorBoundary: ({ children }: { children: unknown }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
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

const nodeCrypto = (process as unknown as { getBuiltinModule: (id: string) => typeof import("crypto") }).getBuiltinModule("crypto");

// ---------- 고정 값(고치기 전 코드에서 읽은 값) ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const ROOM_FILE = "lobby-room.glb";
// 090-② 05 결정 3: 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱 파일(목록)이다. 그 목록을 이 이름 하나로 본다
const FURNITURE_FILE = "furniture/처음-방-일곱";

/** 바닥 그림 image.data(512×512×4 바이트)의 sha256. 방 크기와 관계없이 같다. */
const FLOOR_PIXELS_SHA256 = "4ee7f5a2f9e35acd085bfcc4b0ea14e9006e2e8fad33caf68be9e7d33ddc6bdc";
/** 몇 점의 RGBA 값([x, y] → [r, g, b, a]). */
const FLOOR_PIXEL_SAMPLES: [number, number, number[]][] = [
  [0, 0, [161, 114, 72, 255]],
  [5, 1, [164, 116, 73, 255]],
  [37, 2, [234, 166, 104, 255]],
  [200, 10, [226, 160, 101, 255]],
  [160, 30, [224, 159, 100, 255]],
  [300, 64, [156, 111, 70, 255]],
  [511, 300, [223, 158, 99, 255]],
  [511, 511, [213, 151, 95, 255]]
];

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

// ---------- 가짜 모델 ----------

/** 모델 이름마다 0.8칸 상자 하나를 주는 가구 묶음(창밖 판은 없다). */
function fakeFurnitureGltf() {
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

function fakeRoomGltf() {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene, animations: [] };
}

function roomLoads() {
  mockFiles.set(ROOM_FILE, { value: fakeRoomGltf() });
}

function roomFails() {
  mockFiles.set(ROOM_FILE, { error: new Error("구운 방을 읽지 못했다(테스트 가짜)") });
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function lobby(layout: LobbyLayout) {
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={async (value: LobbyLayout) => value} />;
}

async function renderLobby(layout: LobbyLayout) {
  await render(lobby(layout));
  await flushAsync();
}

/** 3D 그리기가 내놓은 <primitive>의 three 물체들. */
function primitives(): THREE.Object3D[] {
  return screen.container.queryAll((instance: TestInstance) => instance.type === "primitive").map((instance) => instance.props.object as THREE.Object3D);
}

function isFloor(o: THREE.Object3D, width: number, depth: number): boolean {
  const geometry = (o as THREE.Mesh).geometry as THREE.PlaneGeometry | undefined;
  if (!(o as THREE.Mesh).isMesh || !geometry || geometry.type !== "PlaneGeometry") return false;
  const p = geometry.parameters;
  return p.width === width && p.height === depth && p.widthSegments === 32 && p.heightSegments === 44;
}

/** 방(world.root), 코드로 지은 방(world.shell), 바닥. */
function codeRoom(width: number, depth: number): { root: THREE.Object3D; shell: THREE.Object3D; floor: THREE.Mesh } {
  const found: { root: THREE.Object3D; floor: THREE.Mesh }[] = [];
  for (const root of primitives()) {
    root.traverse((o) => {
      if (isFloor(o, width, depth)) found.push({ root, floor: o as THREE.Mesh });
    });
  }
  expect(found).toHaveLength(1);
  const { root, floor } = found[0];
  return { root, shell: floor.parent!, floor };
}

/** 물체와 그 위 조상이 방(root)까지 모두 보이는지. */
function shownUpTo(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) return true;
  }
  return false;
}

/**
 * 한 프레임을 그린다: useFrame을 모두 부른 뒤, 방에서 보이는 것만 훑어 그리는 물체마다
 * WebGLRenderer.renderObject처럼 object.onBeforeRender, material.onBeforeRender를 부른다.
 */
async function drawFrame() {
  await act(async () => {
    const state = { camera: mockThree.camera!, gl: {}, clock: { elapsedTime: 0 }, scene: mockThree.scene! };
    for (const part of [...mockFrames]) part(state, 0.05);
    const renderer = {} as THREE.WebGLRenderer;
    for (const root of primitives()) {
      root.traverseVisible((o) => {
        const mesh = o as THREE.Mesh;
        if (!(mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine)) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          o.onBeforeRender(renderer, mockThree.scene!, mockThree.camera!, mesh.geometry, material, null as unknown as THREE.Group);
          material.onBeforeRender(renderer, mockThree.scene!, mockThree.camera!, mesh.geometry, o, null as unknown as THREE.Group);
        }
      });
    }
  });
  await flushAsync();
}

async function drawFrames(n: number) {
  for (let index = 0; index < n; index += 1) await drawFrame();
}

function pixelsSha256(texture: THREE.DataTexture): string {
  const data = texture.image.data as Uint8Array;
  return nodeCrypto.createHash("sha256").update(data).digest("hex");
}

function pixelAt(texture: THREE.DataTexture, x: number, y: number): number[] {
  const data = texture.image.data as Uint8Array;
  const i = (y * texture.image.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

/** 바닥 재질과 바닥 그림이 고치기 전과 같은지(반복 수는 방마다 다르다). */
function expectFloorAsBefore(floor: THREE.Mesh, repeat: { x: number; y: number }) {
  const material = floor.material as THREE.MeshLambertMaterial;
  expect(Array.isArray(floor.material)).toBe(false);
  expect(material.type).toBe("MeshLambertMaterial");
  expect(material.vertexColors).toBe(true);
  expect(material.color.getHex()).toBe(0xffffff);
  expect(material.transparent).toBe(false);
  expect(material.side).toBe(THREE.FrontSide);
  const map = material.map as THREE.DataTexture;
  expect(map).toBeInstanceOf(THREE.DataTexture);
  expect(map.image.width).toBe(512);
  expect(map.image.height).toBe(512);
  expect(map.image.data).toBeInstanceOf(Uint8Array);
  expect((map.image.data as Uint8Array).length).toBe(512 * 512 * 4);
  expect(pixelsSha256(map)).toBe(FLOOR_PIXELS_SHA256);
  for (const [x, y, rgba] of FLOOR_PIXEL_SAMPLES) expect([x, y, pixelAt(map, x, y)]).toEqual([x, y, rgba]);
  expect(map.format).toBe(THREE.RGBAFormat);
  expect(map.type).toBe(THREE.UnsignedByteType);
  expect(map.wrapS).toBe(THREE.RepeatWrapping);
  expect(map.wrapT).toBe(THREE.RepeatWrapping);
  expect(map.magFilter).toBe(THREE.LinearFilter);
  expect(map.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  expect(map.generateMipmaps).toBe(true);
  expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(map.flipY).toBe(false);
  expect(map.unpackAlignment).toBe(1);
  expect(map.anisotropy).toBe(1);
  expect(map.mapping).toBe(THREE.UVMapping);
  expect([map.repeat.x, map.repeat.y]).toEqual([repeat.x, repeat.y]);
  expect([map.offset.x, map.offset.y]).toEqual([0, 0]);
  expect([map.center.x, map.center.y]).toEqual([0, 0]);
  expect(map.rotation).toBe(0);
  // 그림을 GPU에 올리라고 표시했다(needsUpdate = true면 version이 1 이상이 된다)
  expect(map.version).toBeGreaterThan(0);
}

// ---------- 준비 ----------

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockFiles.clear();
  mockFiles.set(FURNITURE_FILE, { value: fakeFurnitureGltf() });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------- 테스트 ----------

describe("[spec] 코드로 지은 방이 그려질 때의 모양과 바닥 그림은 고치기 전과 같다(081 리팩터링)", () => {
  test("K-F1 기본 방에서 구운 방 껍데기를 못 읽으면 코드로 지은 방이 보이고, 그린 바닥 그림은 고치기 전과 같다(반복 2 × 2.75)", async () => {
    roomFails();
    expect(currentRoom().id).toBe("basic");
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    await drawFrames(2);
    const { root, shell, floor } = codeRoom(8, 11);
    expect(shell.visible).toBe(true);
    expect(shownUpTo(floor, root)).toBe(true);
    expectFloorAsBefore(floor, { x: 2, y: 2.75 });
    // 프레임마다 다시 만들지 않는다(같은 재질·같은 그림)
    const material = floor.material;
    const map = (floor.material as THREE.MeshLambertMaterial).map;
    await drawFrames(3);
    expect(floor.material).toBe(material);
    expect((floor.material as THREE.MeshLambertMaterial).map).toBe(map);
  });

  test("K-F2 구운 방 껍데기를 쓰지 않는 방(시험용 방 T 9×13)에서도 코드로 지은 방이 보이고, 그린 바닥 그림은 같은 픽셀이다(반복 2.25 × 3.25)", async () => {
    roomLoads();
    applyRoom(ROOM_T);
    applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
    expect(currentRoom().id).toBe("qa-test");
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    await drawFrames(2);
    const { root, shell, floor } = codeRoom(9, 13);
    expect(shell.visible).toBe(true);
    expect(shownUpTo(floor, root)).toBe(true);
    expectFloorAsBefore(floor, { x: 2.25, y: 3.25 });
  });

  test("K-F3 기본 방에서 구운 방 껍데기를 읽으면 코드로 지은 방은 숨는다", async () => {
    roomLoads();
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    await drawFrames(2);
    const { root, shell, floor } = codeRoom(8, 11);
    expect(shell.visible).toBe(false);
    expect(shownUpTo(floor, root)).toBe(false);
  });

  test("K-F4 구운 방 껍데기로 숨었던 코드로 지은 방이 나중에 보이게 되면(구운 방이 오류로 빠짐), 그때 그린 바닥 그림은 고치기 전과 같다", async () => {
    roomLoads();
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    await drawFrames(2);
    const before = codeRoom(8, 11);
    expect(before.shell.visible).toBe(false);
    // 다시 그릴 때 구운 방을 읽지 못하게 해 오류 경계가 구운 방을 빼게 한다(같은 방을 다시 짓지는 않는다)
    roomFails();
    await act(async () => {
      screen.rerender(lobby(DEFAULT_LOBBY_LAYOUT));
    });
    await flushAsync();
    await drawFrames(2);
    const after = codeRoom(8, 11);
    expect(after.floor).toBe(before.floor);
    expect(after.shell.visible).toBe(true);
    expect(shownUpTo(after.floor, after.root)).toBe(true);
    expectFloorAsBefore(after.floor, { x: 2, y: 2.75 });
  });

  test("K-F5 로비를 닫으면 그렸던 바닥의 모양·재질·바닥 그림이 한 번씩 정리된다", async () => {
    roomFails();
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    await drawFrames(2);
    const { floor } = codeRoom(8, 11);
    const material = floor.material as THREE.MeshLambertMaterial;
    const map = material.map!;
    const disposed = { geometry: 0, material: 0, map: 0 };
    floor.geometry.addEventListener("dispose", () => {
      disposed.geometry += 1;
    });
    material.addEventListener("dispose", () => {
      disposed.material += 1;
    });
    map.addEventListener("dispose", () => {
      disposed.map += 1;
    });
    await act(async () => {
      screen.unmount();
    });
    expect(disposed).toEqual({ geometry: 1, material: 1, map: 1 });
  });

  test("K-F6 코드로 지은 방(바닥·벽·걸레받이·바닥판·입구 발판)의 물체·모양·재질은 고치기 전과 같다(그린 뒤)", async () => {
    roomFails();
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    await drawFrames(2);
    const { shell } = codeRoom(8, 11);
    expect(describeShell(shell)).toMatchSnapshot();
  });
});

// ---------- 코드로 지은 방 적기 ----------

const num = (n: number) => String(n === 0 ? 0 : n);
const v3 = (v: { x: number; y: number; z: number }) => `(${num(v.x)},${num(v.y)},${num(v.z)})`;

function arrayHash(array: ArrayLike<number>): string {
  let bytes: Uint8Array;
  if (array instanceof Float32Array) {
    const copy = array.slice();
    for (let i = 0; i < copy.length; i += 1) if (copy[i] === 0) copy[i] = 0;
    bytes = new Uint8Array(copy.buffer);
  } else {
    bytes = new Uint8Array(Uint32Array.from(array).buffer);
  }
  return nodeCrypto.createHash("sha256").update(bytes).digest("hex").slice(0, 24);
}

function textureLine(t: THREE.Texture | null): string {
  if (!t) return "none";
  const image = t.image as { width?: number; height?: number; data?: Uint8Array } | undefined;
  return [
    t.constructor.name,
    `size=${image?.width}x${image?.height}`,
    `pixels=${image?.data ? nodeCrypto.createHash("sha256").update(image.data).digest("hex").slice(0, 24) : "none"}`,
    `wrap=${t.wrapS},${t.wrapT}`,
    `filter=${t.magFilter},${t.minFilter}`,
    `mipmaps=${t.generateMipmaps}`,
    `colorSpace=${t.colorSpace}`,
    `repeat=(${num(t.repeat.x)},${num(t.repeat.y)})`,
    `offset=(${num(t.offset.x)},${num(t.offset.y)})`
  ].join(" ");
}

function describeShell(shell: THREE.Object3D) {
  const lines: string[] = [];
  shell.traverse((o) => {
    let depth = 0;
    for (let p = o; p !== shell && p.parent; p = p.parent) depth += 1;
    const parts = [`${"  ".repeat(depth)}${o.type}`, `visible=${o.visible}`, `pos=${v3(o.position)}`, `rot=(${num(o.rotation.x)},${num(o.rotation.y)},${num(o.rotation.z)})`, `scale=${v3(o.scale)}`, `renderOrder=${o.renderOrder}`];
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const g = mesh.geometry;
      const attrs = Object.keys(g.attributes)
        .sort()
        .map((name) => `${name}:${g.attributes[name].itemSize}x${g.attributes[name].count}:${arrayHash(g.attributes[name].array as Float32Array)}`)
        .join(" ");
      parts.push(`geo=${g.type} index=${g.index ? arrayHash(g.index.array as ArrayLike<number>) : "none"} [${attrs}] groups=${JSON.stringify(g.groups)}`);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      parts.push(
        `mat=[${materials
          .map((m) => {
            const lm = m as THREE.MeshLambertMaterial;
            return `${m.type} color=${lm.color ? lm.color.getHexString() : "none"} vertexColors=${m.vertexColors} side=${m.side} map=${textureLine(lm.map ?? null)}`;
          })
          .join(" | ")}]`
      );
    }
    lines.push(parts.join(" "));
  });
  return lines;
}
