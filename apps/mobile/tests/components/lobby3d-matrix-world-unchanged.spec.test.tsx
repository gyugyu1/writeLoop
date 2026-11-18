// [spec] qa 테스트(작업 112-③ 위치 행렬 갱신 건너뛰기, 리팩터링, 모바일): 움직이지 않는 물체의 위치 행렬을 프레임마다 다시 계산하지 않게 바꿔도
// "그릴 때 모든 물체의 세계 행렬(matrixWorld)이 지금과 같다"를 지금 동작 그대로 기록한다(고치기 전·뒤 모두 통과해야 한다).
// 명세: private 작업 폴더 112-2026-11-18-마을-그리기-JS-줄이기/03-행렬-갱신-건너뛰기/01-main-spec.md의 "그대로여야 할 동작".
// 구현 코드는 부르는 방법(lobby3d-canvas.tsx의 기본 내보내기 Lobby3dCanvas 속성, 장면을 <primitive object>와 <group visible>로 넘기는 것,
// useFrame·useThree·useLoader를 쓰는 것)을 알려고만 읽었다.
//
// 어떻게 보나:
// - three는 진짜, Jest에서 돌지 않는 react-three-fiber만 가짜다. 3D 그리기(Lobby3dCanvas)·가구 묶음(BakedFurniture)·하루 빛(DaylightRig)·
//   마을(VillageNature·VillageModel, 마을 모델은 진짜 lobby-village.glb를 푼 장면)은 진짜를 그린다.
//   라룹이(lobby3d-character)는 가짜다: 몸·입은 것(모자)을 단 묶음이고 매 프레임 sim 자리·방향으로 옮긴다. 구운 방 껍데기(lobby3d-room)는 그리지 않고,
//   창밖 장면(lobby3d-outdoor의 createOutdoor, 다른 장면)은 빈 묶음이다. 가구 모델은 어떤 이름으로 찾아도 작은 상자가 나오는 가짜(창밖 판 windowView는 없음)다.
// - 가짜 react-three-fiber는 react-three-fiber가 하는 대로 장면을 짓는다: useThree의 scene은 진짜 THREE.Scene이고, 그려진 요소 나무에서
//   <primitive object>는 그 object를, <group> 같은 three 요소는 요소마다 하나씩 만든 three 물체를 부모(가장 가까운 three 요소, 없으면 scene) 아래에 붙인다.
//   요소의 속성(visible, matrixAutoUpdate 등)은 그 물체에 넣는다(빠진 속성은 새 물체의 기본값으로 되돌린다).
// - 한 프레임 = 장면 짓기 → useFrame에 넣은 프레임 함수를 넣은 차례대로 부르기(delta 0.05초, Date.now·시계도 50ms씩) →
//   three 0.187 WebGLRenderer.render가 그리기 전에 하는 위치 행렬 갱신(scene.matrixWorldAutoUpdate면 scene.updateMatrixWorld(),
//   카메라가 부모가 없고 matrixWorldAutoUpdate면 camera.updateMatrixWorld()). 그 뒤의 matrixWorld가 "그릴 때의 세계 행렬"이다.
// - 기대값("지금과 같은 세계 행렬") = 지금 코드처럼 모든 물체를 다시 계산했을 때의 값: 장면부터 그 물체까지 각 물체의
//   position·quaternion·scale로 만든 지역 행렬을 차례로 곱한 것. 칸마다 1e-6 안이면 같다고 본다.
//   - 방에 있을 때: 장면의 모든 물체(보이지 않는 대체 가구 상자·보관함 가구 포함. 누르기 판정이 matrixWorld를 쓴다)가 기대값과 같아야 한다.
//   - 마을에 있을 때: 그려지는 물체(자신과 장면까지의 조상이 모두 visible)가 기대값과 같아야 한다. 명세대로 숨긴 방 묶음 안은 보지 않는다.
// - 움직이는 것은 값도 지금 그대로인지 따로 본다: 라룹이 묶음 = (sim.x, 0, sim.z), 발밑 그림자 = (sim.x, 0.01, sim.z),
//   풍차 날개 rotation.z가 프레임마다 delta × 2π / 14만큼 줄어든다(동작 줄이기면 그대로), 꾸미기에서 옮긴 가구는 새 자리,
//   띄운 가구는 바닥 가구면 자리 y + 0.6 + sin(초 / 1.5 × 2π) × 0.06.
//
// 그대로 둘 동작(리팩터링이라 모두 지금 통과해야 한다): K1~K9.
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(풍차 날개 돌기)로 qa가 K4·K5·K9를 고쳤다(115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md).
// 115는 마을 모델과 앱 코드에서 풍차(windmill, windmill-rotor)를 빼고 "앱은 풍차 날개가 없어도 돈다"(명세 3·4). 풍차 말고 다른 것의 기대는 그대로다:
// - K4: "풍차 날개가 프레임마다 돈다" → "그린 장면에 풍차 날개 묶음(windmill-rotor)이 없고, 프레임이 지나도 그려지는 물체의 세계 행렬이 지금과 같다"(바뀔 동작).
// - K5: 동작 줄이기에서 날개가 멈추는지는 뺐다. 동작 줄이기로 여러 프레임 지나도 그려지는 물체의 세계 행렬이 지금과 같은지는 그대로 본다.
// - K9: 다시 들어온 뒤 날개가 도는지는 뺐다. 그려지는 물체가 지금과 같고 라룹이·그림자가 따르는지는 그대로 본다.
// - 마을에서 "적어도 50개 넘는 물체를 본다"(expectWorldMatricesAsNow의 최소 수)를 빠지는 묶음의 물체 8개만큼 줄여 42로 했다(VILLAGE_MIN_CHECKED).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { useState } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as CanvasModule from "@/components/lobby3d/lobby3d-canvas";
import { daylightAt, type Daylight, type Season } from "@/lib/lobby3d/daylight";
import { LobbySim, ROOM, applyArea, applyLobbyLayout, type LobbyArea, type PointerHit } from "@/lib/lobby3d/engine";
import { furniturePlacements, placementKey, type FurniturePlacement } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { mockUnreadableAssets, sceneFromGlb } from "../__fixtures__/village-scene-101";

type FrameState = {
  gl: unknown;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  size: { width: number; height: number };
  clock: { elapsedTime: number; getElapsedTime: () => number };
};
type FramePart = (state: FrameState, delta: number) => void;

const mockFrames: { current: FramePart }[] = [];
const mockThree: { scene: THREE.Scene | null; camera: THREE.PerspectiveCamera | null; size: { width: number; height: number }; gl: unknown } = {
  scene: null,
  camera: null,
  size: { width: 400, height: 800 },
  gl: null
};
const mockLoaded = new Map<string, unknown>();
const mockVillage: { scene: unknown } = { scene: null };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "BufferGeometryUtils.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class MockGLTFLoader {
    loadAsync() {
      return Promise.reject(new Error("테스트에서는 받은 가구 모델을 읽지 않는다"));
    }
  }
}));
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const load = (loader: unknown, input: unknown): unknown => {
    const T = jest.requireMock<typeof import("three")>("three");
    const isTexture =
      typeof loader === "function" &&
      (loader === T.TextureLoader || (loader as { prototype?: unknown }).prototype instanceof T.TextureLoader || /texture/i.test((loader as { name?: string }).name ?? ""));
    // react-three-fiber처럼 같은 불러오기에는 같은 결과(목록이면 같은 배열)를 준다
    const key = `${isTexture ? "texture" : "model"}:${JSON.stringify(input)}`;
    if (mockLoaded.has(key)) return mockLoaded.get(key);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixtures = require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101");
    const one = (url: unknown): unknown => {
      if (url === "lobby-village.glb") return mockVillage.scene;
      if (isTexture) return new T.Texture();
      if (String(url).includes("flower")) return fixtures.fakeGltf();
      return mockFurnitureGltf(T);
    };
    const value = Array.isArray(input) ? input.map(one) : one(input);
    mockLoaded.set(key, value);
    return value;
  };
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: (callback: FramePart) => {
      const ref = React.useRef(callback);
      ref.current = callback;
      React.useLayoutEffect(() => {
        const entry = { current: (state: FrameState, delta: number) => ref.current(state, delta) };
        mockFrames.push(entry);
        return () => {
          const at = mockFrames.indexOf(entry);
          if (at >= 0) mockFrames.splice(at, 1);
        };
      }, []);
    },
    useLoader: Object.assign(load, { clear: () => {}, preload: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    ...jest.requireActual("@/components/lobby3d/lobby3d-outdoor"),
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-room", () => ({
  BakedRoom: () => null,
  BakedRoomErrorBoundary: ({ children }: { children: unknown }) => children
}));
// 가짜 라룹이: 몸과 입은 것(모자)을 단 묶음. 매 프레임 sim 자리·방향으로 옮기고 몸을 조금 흔든다
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    BUBBLE_HEIGHT: 2,
    CharacterErrorBoundary: ({ children }: { children: unknown }) => children,
    Character: ({ handleRef }: { handleRef: { current: unknown } }) => {
      const parts = React.useMemo(() => {
        const group = new T.Group();
        group.name = "qa-character";
        const body = new T.Mesh(new T.CapsuleGeometry(0.4, 1, 4, 8), new T.MeshBasicMaterial());
        body.name = "qa-character-body";
        body.position.y = 0.9;
        body.userData.isCharacter = true;
        group.add(body);
        const hat = new T.Mesh(new T.BoxGeometry(0.5, 0.2, 0.5), new T.MeshBasicMaterial());
        hat.name = "qa-character-hat";
        hat.position.y = 0.8;
        hat.raycast = () => {};
        body.add(hat);
        return { group, body };
      }, []);
      React.useEffect(() => {
        const handle = {
          group: parts.group,
          update: (sim: { x: number; z: number; heading: number }, _dt: number, seconds: number) => {
            parts.group.position.set(sim.x, 0, sim.z);
            parts.group.rotation.y = sim.heading;
            parts.body.rotation.z = Math.sin(seconds * 3) * 0.1;
            return 0;
          },
          bubblePoint: () => new T.Vector3(parts.group.position.x, 2, parts.group.position.z)
        };
        handleRef.current = handle;
        return () => {
          if (handleRef.current === handle) handleRef.current = null;
        };
      }, [parts, handleRef]);
      return React.createElement("primitive", { object: parts.group });
    }
  };
});
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

/** 가짜 가구 모델: 어떤 이름으로 찾아도 그 이름의 작은 상자 묶음이 나온다(창밖 판 windowView만 없다). */
function mockFurnitureGltf(T: typeof import("three")) {
  const scene = new T.Group();
  (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
    if (name === "windowView") return undefined;
    const group = new T.Group();
    group.name = name;
    const mesh = new T.Mesh(new T.BoxGeometry(0.8, 0.8, 0.8), new T.MeshStandardMaterial());
    mesh.position.y = 0.4;
    group.add(mesh);
    return group;
  };
  return { scene, animations: [] };
}

let canvasModule: typeof CanvasModule;

beforeAll(() => {
  mockUnreadableAssets();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  canvasModule = require("@/components/lobby3d/lobby3d-canvas") as typeof CanvasModule;
});

jest.setTimeout(300000);

const DELTA = 0.05;
const clock = { ms: 1_000_000, elapsed: 0 };
let nowSpy: jest.SpyInstance<number, []> | null = null;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFrames.length = 0;
  mockLoaded.clear();
  mockVillage.scene = { scene: sceneFromGlb(nowVillageGlb()) };
  mockThree.scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ROOM.fovDeg, 400 / 800, 1, 200);
  camera.position.set(4, 12, 24);
  camera.updateProjectionMatrix();
  mockThree.camera = camera;
  mockThree.gl = {
    render: () => {},
    setRenderTarget: () => {},
    getRenderTarget: () => null,
    capabilities: { getMaxAnisotropy: () => 1 }
  };
  clock.ms = 1_000_000;
  clock.elapsed = 0;
  nowSpy = jest.spyOn(Date, "now").mockImplementation(() => clock.ms);
  attached.clear();
  applyArea("room");
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  hits.length = 0;
});

afterEach(() => {
  nowSpy?.mockRestore();
  nowSpy = null;
  applyArea("room");
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

// ---------- 가짜 react-three-fiber의 장면 짓기 ----------

const hostObjects = new WeakMap<object, THREE.Object3D>();
const appliedKeys = new WeakMap<THREE.Object3D, Set<string>>();
const defaults = new Map<unknown, THREE.Object3D>();
const attached = new Set<THREE.Object3D>();
const SKIPPED_PROPS = new Set(["children", "object", "ref", "key", "args", "attach", "dispose", "onUpdate"]);

/** 요소 하나가 맡은 three 물체. <primitive>는 그 object, three 요소(<group> 등)는 요소마다 하나 만든 물체. three 요소가 아니면 null. */
function objectOf(instance: TestInstance): THREE.Object3D | null {
  if (instance.type === "primitive") return (instance.props as { object: THREE.Object3D }).object;
  const name = instance.type.charAt(0).toUpperCase() + instance.type.slice(1);
  const Ctor = (THREE as unknown as Record<string, unknown>)[name];
  if (instance.type.charAt(0) !== instance.type.charAt(0).toLowerCase() || typeof Ctor !== "function") return null;
  if (!((Ctor as { prototype: unknown }).prototype instanceof THREE.Object3D) && Ctor !== THREE.Object3D) return null;
  const key = instance.unstable_fiber!.stateNode as object;
  let object = hostObjects.get(key);
  if (!object) {
    object = new (Ctor as new () => THREE.Object3D)();
    hostObjects.set(key, object);
  }
  return object;
}

function defaultOf(object: THREE.Object3D): THREE.Object3D {
  let made = defaults.get(object.constructor);
  if (!made) {
    try {
      made = new (object.constructor as new () => THREE.Object3D)();
    } catch {
      made = new THREE.Object3D();
    }
    defaults.set(object.constructor, made);
  }
  return made;
}

/** react-three-fiber처럼 요소 속성을 물체에 넣는다(배열은 set, 값은 그대로). 앞서 넣었다가 빠진 속성은 새 물체의 기본값으로 되돌린다. */
function applyProps(object: THREE.Object3D, props: Record<string, unknown>) {
  const target = object as unknown as Record<string, unknown>;
  const before = appliedKeys.get(object) ?? new Set<string>();
  const now = new Set<string>();
  const put = (key: string, value: unknown) => {
    const path = key.split("-");
    let holder: Record<string, unknown> = target;
    for (const part of path.slice(0, -1)) holder = holder[part] as Record<string, unknown>;
    const last = path[path.length - 1];
    const current = holder[last] as { set?: (...a: unknown[]) => void; copy?: (v: unknown) => void; setScalar?: (v: number) => void } | undefined;
    if (current && typeof current === "object" && Array.isArray(value) && typeof current.set === "function") current.set(...value);
    else if (current && typeof current === "object" && value && typeof value === "object" && typeof current.copy === "function") current.copy(value);
    else if (current && typeof current === "object" && typeof value === "number" && typeof current.setScalar === "function") current.setScalar(value);
    else holder[last] = value;
  };
  for (const [key, value] of Object.entries(props)) {
    if (SKIPPED_PROPS.has(key)) continue;
    now.add(key);
    put(key, value);
  }
  for (const key of before) {
    if (now.has(key)) continue;
    const fresh = defaultOf(object) as unknown as Record<string, unknown>;
    const value = key.split("-").reduce<unknown>((v, part) => (v as Record<string, unknown> | undefined)?.[part], fresh);
    put(key, value && typeof value === "object" && typeof (value as { clone?: () => unknown }).clone === "function" ? (value as { clone: () => unknown }).clone() : value);
  }
  appliedKeys.set(object, now);
  if (typeof props.onUpdate === "function") (props.onUpdate as (o: THREE.Object3D) => void)(object);
}

let container: TestInstance | null = null;

/** 그려진 요소 나무대로 장면을 맞춘다(react-three-fiber가 커밋 때 하는 것). */
function syncScene() {
  const scene = mockThree.scene!;
  const want = new Map<THREE.Object3D, THREE.Object3D>();
  const walk = (instance: TestInstance, parent: THREE.Object3D) => {
    for (const child of instance.children) {
      if (typeof child === "string") continue;
      const object = objectOf(child);
      if (object) {
        applyProps(object, child.props as Record<string, unknown>);
        want.set(object, parent);
        walk(child, object);
      } else walk(child, parent);
    }
  };
  walk(container!, scene);
  for (const [object, parent] of want) {
    if (object.parent !== parent) parent.add(object);
    attached.add(object);
  }
  for (const object of [...attached]) {
    if (want.has(object)) continue;
    object.removeFromParent();
    attached.delete(object);
  }
}

/** three 0.187 WebGLRenderer.render가 그리기 전에 하는 위치 행렬 갱신. */
function renderUpdate() {
  const scene = mockThree.scene!;
  const camera = mockThree.camera!;
  if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
  if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
}

async function frames(count: number) {
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      syncScene();
      clock.ms += DELTA * 1000;
      clock.elapsed += DELTA;
      const state: FrameState = {
        gl: mockThree.gl,
        camera: mockThree.camera!,
        scene: mockThree.scene!,
        size: mockThree.size,
        clock: { elapsedTime: clock.elapsed, getElapsedTime: () => clock.elapsed }
      };
      for (const part of [...mockFrames]) part.current(state, DELTA);
      renderUpdate();
    });
  }
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

// ---------- 3D 그리기 ----------

const hits: { phase: string; hit: PointerHit | null }[] = [];
type Controls = { setArea: (area: LobbyArea) => void; setEdit: (edit: CanvasModule.LobbyCanvasEdit | null) => void; setDaylight: (daylight: Daylight) => void };
const controls: { current: Controls | null } = { current: null };
/** 매 프레임 sim을 이만큼(칸/초) 옮긴다(화면이 sim을 한 단계 진행하는 것 대신). */
const walk = { vx: 0, vz: 0 };

const SEASON_DATES: Record<Season, Date> = {
  spring: new Date(2026, 3, 15, 12, 30),
  summer: new Date(2026, 5, 21, 12, 30),
  autumn: new Date(2026, 9, 15, 12, 30),
  winter: new Date(2026, 0, 15, 12, 30)
};
const NIGHT = new Date(2026, 5, 21, 23, 30);

function Harness({ sim, area: firstArea, daylight: firstDaylight }: { sim: LobbySim; area: LobbyArea; daylight: Daylight }) {
  const [area, setArea] = useState<LobbyArea>(firstArea);
  const [edit, setEdit] = useState<CanvasModule.LobbyCanvasEdit | null>(null);
  const [daylight, setDaylight] = useState<Daylight>(firstDaylight);
  controls.current = { setArea, setEdit, setDaylight };
  const Canvas = canvasModule.default;
  return (
    <Canvas
      sim={sim}
      viewWidth={9.4}
      toon={{ steps: 3, outline: 1 }}
      onFrame={(dt) => {
        sim.x += walk.vx * dt;
        sim.z += walk.vz * dt;
        if (walk.vx !== 0 || walk.vz !== 0) sim.heading = Math.atan2(walk.vx, walk.vz);
      }}
      onPointer={(phase, hit) => hits.push({ phase, hit })}
      onProject={() => {}}
      daylight={daylight}
      area={area}
      edit={edit}
    />
  );
}

const ROOM_START = { x: 4.2, z: 6.2 };

async function draw(area: LobbyArea, options: { reduceMotion?: boolean; daylight?: Daylight } = {}): Promise<LobbySim> {
  applyArea(area);
  const start = area === "village" ? VILLAGE_START : ROOM_START;
  const sim = new LobbySim({ x: start.x, z: start.z, reduceMotion: options.reduceMotion ?? false, random: () => 0.5 });
  walk.vx = 0;
  walk.vz = 0;
  const view = await render(<Harness sim={sim} area={area} daylight={options.daylight ?? daylightAt(SEASON_DATES.summer)} />);
  container = view.container;
  await flush();
  await frames(3);
  return sim;
}

async function goTo(sim: LobbySim, area: LobbyArea) {
  applyArea(area);
  const start = area === "village" ? VILLAGE_START : ROOM_START;
  sim.x = start.x;
  sim.z = start.z;
  await act(async () => {
    controls.current!.setArea(area);
  });
  await flush();
}

// ---------- 기대값과 비교 ----------

/** 지금 코드처럼 모든 물체를 다시 계산했을 때의 세계 행렬. */
function expectedWorld(object: THREE.Object3D, memo: Map<THREE.Object3D, THREE.Matrix4>): THREE.Matrix4 {
  const known = memo.get(object);
  if (known) return known;
  const local = new THREE.Matrix4().compose(object.position, object.quaternion, object.scale);
  const world = object.parent ? new THREE.Matrix4().multiplyMatrices(expectedWorld(object.parent, memo), local) : local;
  memo.set(object, world);
  return world;
}

function shownChain(object: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = object; n; n = n.parent) if (!n.visible) return false;
  return true;
}

function label(object: THREE.Object3D): string {
  const names: string[] = [];
  for (let n: THREE.Object3D | null = object; n; n = n.parent) names.unshift(n.name || n.type);
  return names.join("/");
}

/** 기대값과 다른 물체(이름 경로)와 본 물체 수. 방이면 장면의 모든 물체, 마을이면 그려지는 물체만 본다. */
function mismatches(area: LobbyArea): { wrong: string[]; checked: number } {
  const memo = new Map<THREE.Object3D, THREE.Matrix4>();
  const wrong: string[] = [];
  let checked = 0;
  mockThree.scene!.traverse((o) => {
    if (area === "village" && !shownChain(o)) return;
    checked += 1;
    const want = expectedWorld(o, memo).elements;
    const got = o.matrixWorld.elements;
    if (want.some((v, i) => Math.abs(v - got[i]) > 1e-6)) wrong.push(label(o));
  });
  return { wrong, checked };
}

/**
 * 마을에서 적어도 이만큼 넘는 물체를 봐야 한다(그려지는 물체가 거의 없는데 통과하지 않게). 115 전에는 50이었다.
 * 115는 마을 모델에서 생울타리·울타리·풍차·풍차 날개 묶음(뿌리 넷과 그 아래 합친 메시 넷, 물체 8개)을 빼므로 그만큼 줄였다.
 */
const VILLAGE_MIN_CHECKED = 50 - 8;

function expectWorldMatricesAsNow(area: LobbyArea, minChecked: number) {
  const { wrong, checked } = mismatches(area);
  expect(wrong).toEqual([]);
  expect(checked).toBeGreaterThan(minChecked);
}

function worldPosition(object: THREE.Object3D): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
}

function expectAt(object: THREE.Object3D, x: number, y: number, z: number) {
  const p = worldPosition(object);
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
  expect(p.z).toBeCloseTo(z, 6);
}

function character(): THREE.Object3D {
  const found = mockThree.scene!.getObjectByName("qa-character");
  expect(found).toBeDefined();
  return found!;
}

/** 라룹이 발밑 그림자: 방 묶음(가구를 담은 묶음)과 함께 3D 그리기 뿌리에 바로 달린 메시. */
function footShadow(): THREE.Mesh {
  const roots = mockThree.scene!.children.filter((o) => o.children.some((c) => c.children.some((g) => g.children.some((p) => p.userData.furnitureOf !== undefined))));
  expect(roots).toHaveLength(1);
  const meshes = roots[0].children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
  expect(meshes).toHaveLength(1);
  return meshes[0];
}

/** 방 묶음(3D 그리기 뿌리 아래, 가구 대체 모양을 담은 묶음). */
function roomGroup(): THREE.Object3D {
  const shadow = footShadow();
  const room = shadow.parent!.children.find((o) => o !== shadow)!;
  return room;
}

/** 115: 그린 장면에서 풍차 묶음(windmill, windmill-rotor와 그 아래 이름)을 가진 물체 이름. */
function windmillObjects(): string[] {
  const out: string[] = [];
  mockThree.scene!.traverse((o) => {
    if (/^windmill(-|$)/.test(o.name)) out.push(o.name);
  });
  return out;
}

function furnitureObjects(key: string): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  mockThree.scene!.traverse((o) => {
    if (o.userData.furnitureOf === key) out.push(o);
  });
  return out;
}

function shownSet(): Set<THREE.Object3D> {
  const out = new Set<THREE.Object3D>();
  mockThree.scene!.traverse((o) => {
    if (shownChain(o)) out.add(o);
  });
  return out;
}

function placementOf(layout: LobbyLayout, item: string): FurniturePlacement {
  const place = furniturePlacements(layout).find((p) => p.item === item && !p.companion);
  expect(place).toBeDefined();
  return place!;
}

function touchView(): TestInstance {
  const views = container!.queryAll((instance: TestInstance) => typeof (instance.props as { onResponderGrant?: unknown }).onResponderGrant === "function");
  expect(views).toHaveLength(1);
  return views[0];
}

/** 화면의 그 점을 누르기 시작했다가 취소한다. 3D 그리기가 넘긴 누른 자리를 돌려준다. */
async function probe(at: { x: number; y: number }): Promise<PointerHit | null> {
  const view = touchView();
  const before = hits.length;
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>).onResponderGrant({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>).onResponderTerminate({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
  const down = hits.slice(before).find((h) => h.phase === "down");
  expect(down).toBeDefined();
  return down!.hit;
}

function toScreen(p: THREE.Vector3): { x: number; y: number } {
  const v = p.clone().project(mockThree.camera!);
  const { width, height } = mockThree.size;
  const at = { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  expect(at.x > 0 && at.x < width && at.y > 0 && at.y < height).toBe(true);
  return at;
}

// ---------- 방 ----------

describe("방", () => {
  it("K1 방에서 서 있다가 걸으면, 그릴 때 장면의 모든 물체의 세계 행렬이 지금과 같고 라룹이와 발밑 그림자가 sim을 따른다", async () => {
    const sim = await draw("room");
    expectWorldMatricesAsNow("room", 70);
    walk.vx = 1.2;
    walk.vz = -0.6;
    for (let i = 0; i < 8; i += 1) {
      await frames(1);
      expectWorldMatricesAsNow("room", 70);
      expectAt(character(), sim.x, 0, sim.z);
      expectAt(footShadow(), sim.x, 0.01, sim.z);
    }
    expect(sim.x).toBeCloseTo(ROOM_START.x + 1.2 * DELTA * 8, 6);
  });

  it("K2 꾸미기에서 가구를 옮기고 띄우면 그 가구의 세계 행렬이 새 자리·띄운 높이를 따르고, 모든 물체가 지금과 같으며 옮긴 가구를 누르면 그 가구가 골라진다", async () => {
    await draw("room");
    // 깔개를 오른쪽으로 한 칸 옮기고 책상을 띄운다(책상 위 스탠드도 함께 뜬다)
    const moved: LobbyLayout = {
      ...DEFAULT_LOBBY_LAYOUT,
      items: DEFAULT_LOBBY_LAYOUT.items.map((item) => (item.id === "rug" ? { ...item, floor: { ...item.floor!, x: item.floor!.x + 1 } } : item))
    };
    const edit = (lifted: string | null): CanvasModule.LobbyCanvasEdit => ({
      layout: moved,
      marks: [],
      wallMarks: [],
      zone: null,
      dragging: false,
      lifted,
      focus: null,
      handle: null
    });
    await act(async () => {
      controls.current!.setEdit(edit("desk"));
    });
    await flush();
    const rug = placementOf(moved, "rug");
    const desk = placementOf(moved, "desk");
    const lamp = placementOf(moved, "lamp");
    for (let i = 0; i < 6; i += 1) {
      await frames(1);
      expectWorldMatricesAsNow("room", 70);
      const bob = Math.sin((clock.ms / 1000 / 1.5) * Math.PI * 2) * 0.06;
      const rugObjects = furnitureObjects(placementKey(rug));
      expect(rugObjects.length).toBeGreaterThan(0);
      for (const o of rugObjects) expectAt(o, rug.x, rug.y, rug.z);
      const deskObjects = furnitureObjects(placementKey(desk));
      expect(deskObjects.length).toBeGreaterThan(0);
      for (const o of deskObjects) expectAt(o, desk.x, desk.y + 0.6 + bob, desk.z);
      for (const o of furnitureObjects(placementKey(lamp))) expectAt(o, lamp.x, lamp.y + 0.6 + bob, lamp.z);
    }
    // 띄우기를 풀면 제자리로 내려온다
    await act(async () => {
      controls.current!.setEdit(edit(null));
    });
    await flush();
    await frames(2);
    expectWorldMatricesAsNow("room", 70);
    for (const o of furnitureObjects(placementKey(desk))) expectAt(o, desk.x, desk.y, desk.z);
    // 옮긴 깔개를 누르면 깔개가 골라진다(누르기 판정은 보이지 않는 대체 상자의 세계 행렬을 쓴다)
    const hit = await probe(toScreen(new THREE.Vector3(rug.x, (rug.box?.height ?? 0.02) / 2, rug.z)));
    expect(hit?.piece).toBe("rug");
  });
});

// ---------- 마을 ----------

describe("마을", () => {
  it("K3 마을에서 서 있다가 걸으면, 그릴 때 그려지는 모든 물체의 세계 행렬이 지금과 같고 라룹이·그림자가 sim을 따르며 방 묶음은 숨겨져 있다", async () => {
    const sim = await draw("village");
    expect(roomGroup().visible).toBe(false);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    walk.vx = -1;
    walk.vz = 1.5;
    for (let i = 0; i < 8; i += 1) {
      await frames(1);
      expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
      expectAt(character(), sim.x, 0, sim.z);
      expectAt(footShadow(), sim.x, 0.01, sim.z);
    }
  });

  it("K4 마을에 풍차 날개(windmill-rotor)와 풍차(windmill) 묶음이 없고(115 ① 명세 3·4), 프레임이 지나도 그려지는 물체의 세계 행렬이 지금과 같다", async () => {
    await draw("village");
    expect(windmillObjects()).toEqual([]);
    for (let i = 1; i <= 6; i += 1) {
      await frames(1);
      expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    }
  });

  it("K5 동작 줄이기여도 여러 프레임 뒤 그려지는 물체의 세계 행렬이 지금과 같다(115: 풍차 날개 멈춤은 뺐다)", async () => {
    await draw("village", { reduceMotion: true });
    await frames(6);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
  });

  it("K6 마을에서 나중에 보이게 되는 물체(밤 불빛, 다른 계절 흩뿌림, 시야에 새로 든 나무)도 보이는 프레임에 세계 행렬이 지금과 같다", async () => {
    const sim = await draw("village");
    // 밤: 천장 조명이 켜지는 동안(1.5초) 넘어가면 불빛이 보인다
    let before = shownSet();
    await act(async () => {
      controls.current!.setDaylight(daylightAt(NIGHT));
    });
    await flush();
    await frames(35);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    let fresh = [...shownSet()].filter((o) => !before.has(o));
    expect(fresh.some((o) => /glow/.test(label(o)))).toBe(true);
    // 가을: 그 계절 흩뿌림이 보인다
    before = shownSet();
    await act(async () => {
      controls.current!.setDaylight(daylightAt(SEASON_DATES.autumn));
    });
    await flush();
    await frames(2);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    fresh = [...shownSet()].filter((o) => !before.has(o));
    expect(fresh.length).toBeGreaterThan(0);
    // 마을 끝 쪽으로 걸어가면 시야에 새 나무가 든다
    before = shownSet();
    walk.vx = 0;
    walk.vz = 0;
    sim.x = 1;
    sim.z = 1;
    await frames(30);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    fresh = [...shownSet()].filter((o) => !before.has(o));
    expect(fresh.some((o) => o instanceof THREE.InstancedMesh)).toBe(true);
  });

  it("K7 마을 건물을 누르면 그 건물 위의 자리를 누른 곳으로 본다(누르기 판정이 그릴 때의 세계 행렬과 같은 자리를 쓴다)", async () => {
    await draw("village");
    await frames(2);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    const building = mockThree.scene!.getObjectByName("bld-home-mesh") ?? mockThree.scene!.getObjectByName("bld-home");
    expect(building).toBeDefined();
    const box = new THREE.Box3();
    const memo = new Map<THREE.Object3D, THREE.Matrix4>();
    building!.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox!.clone().applyMatrix4(expectedWorld(o, memo)));
      }
    });
    const center = box.getCenter(new THREE.Vector3());
    const hit = await probe(toScreen(center));
    expect(hit).not.toBeNull();
    expect(hit!.onCharacter).toBe(false);
    expect(hit!.mark).toBeNull();
    expect(hit!.point).not.toBeNull();
    expect(hit!.point!.x).toBeGreaterThanOrEqual(box.min.x - 1e-3);
    expect(hit!.point!.x).toBeLessThanOrEqual(box.max.x + 1e-3);
    expect(hit!.point!.z).toBeGreaterThanOrEqual(box.min.z - 1e-3);
    expect(hit!.point!.z).toBeLessThanOrEqual(box.max.z + 1e-3);
  });
});

// ---------- 방과 마을을 오갈 때 ----------

describe("방과 마을을 오갈 때", () => {
  it("K8 마을에 있는 동안 방 가구의 자리가 바뀌었으면, 방으로 돌아온 첫 프레임에 그 자리로 그려지고 모든 물체가 지금과 같다", async () => {
    const sim = await draw("room");
    await goTo(sim, "village");
    await frames(4);
    expect(roomGroup().visible).toBe(false);
    const rug = placementOf(DEFAULT_LOBBY_LAYOUT, "rug");
    const rugObjects = furnitureObjects(placementKey(rug));
    expect(rugObjects.length).toBeGreaterThan(0);
    for (const o of rugObjects) o.position.x += 1.25;
    await frames(2);
    await goTo(sim, "room");
    await frames(1);
    expect(roomGroup().visible).toBe(true);
    expectWorldMatricesAsNow("room", 70);
    for (const o of rugObjects) expectAt(o, rug.x + 1.25, rug.y, rug.z);
    expectAt(character(), sim.x, 0, sim.z);
    expectAt(footShadow(), sim.x, 0.01, sim.z);
  });

  it("K9 마을을 나갔다가 다시 들어와도(마을을 다시 지을 때) 그려지는 물체가 지금과 같고, 라룹이가 따른다(115: 풍차 날개 돌기는 뺐다)", async () => {
    const sim = await draw("village");
    await frames(3);
    await goTo(sim, "room");
    await frames(3);
    expectWorldMatricesAsNow("room", 70);
    await goTo(sim, "village");
    await frames(1);
    expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
    walk.vx = 1;
    walk.vz = 0.5;
    for (let i = 1; i <= 4; i += 1) {
      await frames(1);
      expectWorldMatricesAsNow("village", VILLAGE_MIN_CHECKED);
      expectAt(character(), sim.x, 0, sim.z);
      expectAt(footShadow(), sim.x, 0.01, sim.z);
    }
  });
});
