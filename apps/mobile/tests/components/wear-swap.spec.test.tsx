// [spec] qa 테스트(작업 090-③ 옷 내려받기, 버그 수정 재현, 모바일): 옷을 바꿀 때 앞 옷이 라룹이에 남는 버그.
// 기대값은 private 작업 폴더 090-2026-11-13-아이템-목록-서버로/05-옷-내려받기/17-main-spec.md의 "기대 동작"에서만 가져온다.
// - 부위마다 지금 입은 옷 하나만 라룹이에 붙어 있다. 옷을 바꾸거나 벗기면 앞 옷의 메시(겉면·외곽선)는 라룹이에서 떨어지고 버려진다.
// - 같은 화면을 다시 그리거나 React가 그리기를 한 번 버리고 다시 해도, 라룹이에 붙은 옷 메시 수가 늘지 않는다.
// 재현 상황(17 명세): 개발 화면 시험판에서 '상의 바꾸기'를 차례로 누름(티 → … → 조끼 → 티). 상의 차례는 시나리오 04 V1의 CAT-W 순서
// (tshirtOrange → tshirtWhite → tshirtGreenQa → vestQa → tshirtOrange)를 쓴다.
// "React가 그리기를 버림"은 두 가지로 만든다.
// - 개발 모드의 두 번 그리기: <StrictMode> 안에서 그린다(React 개발판은 그리기와 effect를 한 번씩 더 돌리고 하나를 버린다).
// - 그리기 중 멈춤: 옷을 바꾸는 그 그리기에서 라룹이와 같은 Suspense 안의 다른 것이 멈추게 해(use(약속)) React가 그 그리기를 버리고, 약속이 풀리면 다시 그리게 한다.
// 어떻게 보나(같은 작업의 qa 테스트 wear-download-3d.spec과 같은 방법): react-three-fiber만 가짜로 두고, 라룹이 모델은 뼈 이름 약속을 지키는 가짜다.
// 옷 모델은 기기에 받아 둔 파일을 GLTFLoader().loadAsync(기기 주소)로 읽는 가짜다. 가짜 모델마다 점 수를 달리해 메시가 어느 모델인지 가린다
// (HAT_O 24, TOP 40, HAT_B 56, VEST 112). "붙은 메시" = 라룹이 묶음(handleRef.group) 아래에 있는, 옷 입기 전에는 없던 메시(보이는지와 상관없이).
// 겉면은 카툰 재질 메시, 외곽선은 그 밖의 메시다. 가짜 모델은 메시가 하나라 옷 하나가 붙으면 겉면 1·외곽선 1이다.
// 구현(9b8b629)에서 읽은 것은 부르는 방법뿐이다: Character의 속성 kit·outline·handleRef·wear·look, setItemCatalog(parseItemCatalog(응답)).
import { act, render } from "@testing-library/react-native";
import { StrictMode, Suspense, use, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { catW, deviceUri, putOnDevice, resetDevice, type CatW, type CatWModel, type FileRef } from "../__fixtures__/wear-files-090";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;
type MockObject3D = THREE.Object3D;
type MockSkinnedMesh = THREE.SkinnedMesh;
type MockBone = THREE.Bone;

const mockFrames = new Set<FramePart>();
const mockCharacter: { value: unknown } = { value: null };
/** 기기 주소 → 그 파일의 가짜 모델(CAT-W 모델 이름). */
const mockFiles = new Map<string, CatWModel>();

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({ camera: null, scene: null, size: { width: 400, height: 800 } }),
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
    useLoader: (_loader: unknown, url: unknown) => {
      if (String(url) !== "writeloop.glb") throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
      return mockCharacter.value;
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync(uri: string) {
      return mockRead(uri);
    }
  }
}));
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (source: MockObject3D) => {
    const sourceOf = new Map<unknown, MockObject3D>();
    const cloneOf = new Map<unknown, MockObject3D>();
    const cloned = source.clone(true);
    const walk = (a: MockObject3D, b: MockObject3D) => {
      sourceOf.set(b, a);
      cloneOf.set(a, b);
      a.children.forEach((child, i) => walk(child, b.children[i]));
    };
    walk(source, cloned);
    cloned.traverse((node) => {
      const skinned = node as MockSkinnedMesh;
      if (!skinned.isSkinnedMesh) return;
      const from = sourceOf.get(node) as MockSkinnedMesh;
      skinned.skeleton = from.skeleton.clone();
      skinned.bindMatrix.copy(from.bindMatrix);
      skinned.skeleton.bones = from.skeleton.bones.map((bone) => cloneOf.get(bone) as MockBone);
      skinned.bind(skinned.skeleton, skinned.bindMatrix);
    });
    return cloned;
  }
}));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
jest.mock("@/lib/api", () => ({ ...jest.requireActual("@/lib/api"), getItemCatalog: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 값 ----------

const SLOW_TEST_MS = 60_000;
type Slot = "hat" | "top" | "bottom" | "shoes" | "face" | "back" | "accessory";
type Look = Record<Slot, string | null>;
const NO_LOOK: Look = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const look = (partial: Partial<Look>): Look => ({ ...NO_LOOK, ...partial });
const POINTS: Record<number, CatWModel> = { 24: "HAT_O", 40: "TOP", 56: "HAT_B", 112: "VEST" };
/** 옷 하나가 붙은 모습(가짜 모델은 메시가 하나라 겉면 1·외곽선 1). */
const ONE = { surface: 1, outline: 1 };

// ---------- 가짜 모델(wear-download-3d.spec과 같은 모양) ----------

const BONE_TREE: [string, string | null, [number, number, number]][] = [
  ["root", null, [0, 0, 0]],
  ["hips", "root", [0, 0.4, 0]],
  ["leg_l", "hips", [0.1, -0.05, 0]],
  ["foot_l", "leg_l", [0, -0.3, 0.02]],
  ["leg_r", "hips", [-0.1, -0.05, 0]],
  ["foot_r", "leg_r", [0, -0.3, 0.02]],
  ["spine", "hips", [0, 0.15, 0]],
  ["arm_l", "spine", [0.18, 0.1, 0]],
  ["hand_l", "arm_l", [0.12, -0.1, 0]],
  ["arm_r", "spine", [-0.18, 0.1, 0]],
  ["hand_r", "arm_r", [-0.12, -0.1, 0]],
  ["thumb_r", "hand_r", [0, -0.03, 0.03]],
  ["head", "spine", [0, 0.2, 0]],
  ["ear_l", "head", [0.12, 0.25, 0]],
  ["ear_r", "head", [-0.12, 0.25, 0]],
  ["tail_1", "hips", [0, 0, -0.15]],
  ["tail_2", "tail_1", [0, 0.05, -0.08]],
  ["tail_3", "tail_2", [0, 0.05, -0.08]]
];

function makeBones(order: string[] = BONE_TREE.map(([name]) => name)) {
  const byName = new Map<string, THREE.Bone>();
  for (const [name, parent, [x, y, z]] of BONE_TREE) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    if (parent) byName.get(parent)!.add(bone);
    byName.set(name, bone);
  }
  return { root: byName.get("root")!, bones: order.map((name) => byName.get(name)!) };
}

function boneForPoint(x: number, y: number): string {
  return y > 0.75 ? "head" : y > 0.45 ? "spine" : y > 0.2 ? "hips" : x > 0 ? "foot_l" : "foot_r";
}

function skinnedBox(geometry: THREE.BufferGeometry, bones: THREE.Bone[], material: THREE.Material): THREE.SkinnedMesh {
  const position = geometry.attributes.position;
  const skinIndex = new THREE.Uint16BufferAttribute(new Uint16Array(position.count * 4), 4);
  const skinWeight = new THREE.Float32BufferAttribute(new Float32Array(position.count * 4), 4);
  for (let i = 0; i < position.count; i += 1) {
    skinIndex.setX(i, bones.findIndex((b) => b.name === boneForPoint(position.getX(i), position.getY(i))));
    skinWeight.setX(i, 1);
  }
  geometry.setAttribute("skinIndex", skinIndex);
  geometry.setAttribute("skinWeight", skinWeight);
  return new THREE.SkinnedMesh(geometry, material);
}

const CLIP_NAMES = [
  "idle", "walk", "wave", "jump", "hop", "point", "look_around", "poke", "sit_down", "sit_idle", "stand_up",
  "think_in", "think_idle", "think_out", "chair_sit_down", "chair_sit_idle", "chair_stand_up", "book_take", "book_put"
];

function makeClips(): THREE.AnimationClip[] {
  return CLIP_NAMES.map((name, k) => {
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3 + 0.03 * k);
    return new THREE.AnimationClip(name, 2, [
      new THREE.QuaternionKeyframeTrack("head.quaternion", [0, 1, 2], [...q0.toArray(), ...q1.toArray(), ...q0.toArray()]),
      new THREE.VectorKeyframeTrack("hips.position", [0, 1, 2], [0, 0.4, 0, 0.02, 0.45, 0.05, 0, 0.38, -0.03])
    ]);
  });
}

function fakeCharacter() {
  const { root, bones } = makeBones();
  const geometry = new THREE.BoxGeometry(0.5, 1, 0.4, 2, 2, 2).translate(0, 0.5, 0);
  const body = skinnedBox(geometry, bones, new THREE.MeshStandardMaterial({ color: 0xf0c080 }));
  body.name = "qa-body";
  const scene = new THREE.Group();
  scene.name = "writeloop";
  scene.add(root, body);
  scene.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton(bones));
  return { scene, scenes: [scene], animations: makeClips(), cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 단단한 모델(가로 칸 수로 점 수를 정한다: 8 + 8·(칸 + 1)). */
function rigidScene(segments: number, color: number, at: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1, segments, 1, 1), new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(...at);
  const scene = new THREE.Group();
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return scene;
}

/** 뼈대로 휘는 껍질 모델(라룹이와 뼈 순서가 다른 자기 뼈대). */
function skinnedScene(segments: number, color: number, y: number, height: number) {
  const scene = new THREE.Group();
  const { root, bones } = makeBones([...BONE_TREE.map(([name]) => name)].reverse());
  scene.add(root);
  const shell = skinnedBox(new THREE.BoxGeometry(0.55, height, 0.45, segments, 1, 1).translate(0, y, 0), bones, new THREE.MeshStandardMaterial({ color }));
  scene.add(shell);
  scene.updateMatrixWorld(true);
  shell.bind(new THREE.Skeleton(bones));
  return scene;
}

function sceneOf(model: CatWModel): THREE.Group {
  switch (model) {
    case "HAT_O":
      return rigidScene(1, 0xd9480f, [0, 1.05, 0]);
    case "HAT_B":
      return rigidScene(5, 0x2f6fd0, [0, 1.05, 0]);
    case "TOP":
      return skinnedScene(3, 0xe8590c, 0.6, 0.4);
    case "VEST":
      return skinnedScene(12, 0x3a7a3a, 0.62, 0.36);
    default:
      throw new Error(`이 테스트가 쓰지 않는 모델: ${model}`);
  }
}

function mockRead(uri: string): Promise<unknown> {
  const model = mockFiles.get(uri);
  if (!model) return Promise.reject(new Error(`테스트가 모르는 기기 파일: ${uri}`));
  const scene = sceneOf(model);
  return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} });
}

// ---------- 도우미 ----------

let round = 0;
/** 테스트마다 새 해시의 CAT-W를 목록으로 두고, 쓰는 모델(HAT_O·HAT_B·TOP·VEST)을 기기에 받아 둔 상태로 둔다. */
function newCatW(): CatW {
  round += 1;
  const cat = catW(`swap-${round}`);
  for (const model of ["HAT_O", "HAT_B", "TOP", "VEST"] as CatWModel[]) {
    const ref: FileRef = cat.model[model];
    mockFiles.set(deviceUri(ref), model);
    putOnDevice(ref);
  }
  setItemCatalog(parseItemCatalog(cat.catalog)!);
  return cat;
}

async function flushAsync() {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function meshesUnder(group: THREE.Object3D): THREE.Mesh[] {
  const list: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh);
  });
  return list;
}

const isToon = (mesh: THREE.Mesh) => (mesh.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial === true;

/** 라룹이 묶음 아래에 붙은 옷 메시 수(입기 전에 없던 메시, 보이는지와 상관없이). 모델 이름 → 겉면·외곽선 수. 모르는 메시는 "unknown". */
function attached(group: THREE.Object3D, baseline: Set<THREE.Mesh>): Record<string, { surface: number; outline: number }> {
  const counts: Record<string, { surface: number; outline: number }> = {};
  for (const mesh of meshesUnder(group)) {
    if (baseline.has(mesh)) continue;
    const name = POINTS[mesh.geometry.attributes.position.count] ?? "unknown";
    const entry = (counts[name] ??= { surface: 0, outline: 0 });
    entry[isToon(mesh) ? "surface" : "outline"] += 1;
  }
  return counts;
}

/** 옷 입기 전 라룹이 묶음에 있던 메시가 모두 그대로 있는지(라룹이 몸이 떨어지지 않았는지). */
function baselineKept(group: THREE.Object3D, baseline: Set<THREE.Mesh>): boolean {
  const now = new Set(meshesUnder(group));
  return [...baseline].every((m) => now.has(m));
}

/** 라룹이와 같은 Suspense 안에서, 약속이 주어지면 그 약속이 풀릴 때까지 그리기를 멈추는 것. */
function Gate({ wait }: { wait: Promise<void> | null }) {
  if (wait) use(wait);
  return null;
}

interface Rig {
  kit: ToonKit;
  handleRef: MutableRefObject<CharacterHandle | null>;
  failed: jest.Mock;
  element: (value: Look, options?: { strict?: boolean; wait?: Promise<void> | null }) => ReactElement;
}

function makeRig(): Rig {
  const rig = {
    kit: { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] } as ToonKit,
    handleRef: { current: null } as MutableRefObject<CharacterHandle | null>,
    failed: jest.fn()
  };
  const wearOf = (value: Look) => ({ hat: value.hat !== null, top: value.top !== null, bottom: value.bottom !== null, shoes: value.shoes !== null });
  return {
    ...rig,
    element: (value, options = {}) => {
      const tree = (
        <CharacterErrorBoundary onFailed={rig.failed}>
          <Suspense fallback={null}>
            <Character kit={rig.kit} outline={1} handleRef={rig.handleRef} wear={wearOf(value)} look={value} />
            <Gate wait={options.wait ?? null} />
          </Suspense>
        </CharacterErrorBoundary>
      );
      return options.strict ? <StrictMode>{tree}</StrictMode> : tree;
    }
  };
}

async function renderBare(rig: Rig, strict = false) {
  const view = await render(rig.element(NO_LOOK, { strict }));
  await flushAsync();
  expect(rig.handleRef.current !== null).toBe(true);
  const group = rig.handleRef.current!.group;
  return { view, group, baseline: new Set(meshesUnder(group)) };
}

async function wearOn(view: { rerender: (el: ReactElement) => unknown }, rig: Rig, value: Look, options: { strict?: boolean; wait?: Promise<void> | null } = {}) {
  await act(async () => {
    await view.rerender(rig.element(value, options));
  });
  await flushAsync();
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-11-14T03:00:00.000Z") });
  resetDevice();
  mockFiles.clear();
  mockFrames.clear();
  mockCharacter.value = fakeCharacter();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 재현 ----------

describe("[spec] 090-③ 17 버그: 옷을 바꿀 때 앞 옷이 라룹이에 남지 않는다", () => {
  it(
    "R1 개발 모드 두 번 그리기(StrictMode)에서 상의를 주황 티 → 흰 티 → 초록 티 → 조끼 → 주황 티로 바꾸면, 바꿀 때마다 라룹이에 붙은 것은 지금 상의 하나(겉면 1·외곽선 1)뿐이고 벗기면 하나도 없다",
    async () => {
      newCatW();
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig, true);
      const steps: [string, Look, CatWModel | null][] = [
        ["tshirtOrange", look({ top: "tshirtOrange" }), "TOP"],
        ["tshirtWhite", look({ top: "tshirtWhite" }), "TOP"],
        ["tshirtGreenQa", look({ top: "tshirtGreenQa" }), "TOP"],
        ["vestQa", look({ top: "vestQa" }), "VEST"],
        ["tshirtOrange(다시)", look({ top: "tshirtOrange" }), "TOP"],
        ["벗기", NO_LOOK, null]
      ];
      const actual: { step: string; attached: Record<string, { surface: number; outline: number }> }[] = [];
      const expected: typeof actual = [];
      for (const [step, value, model] of steps) {
        await wearOn(view, rig, value, { strict: true });
        actual.push({ step, attached: attached(group, baseline) });
        expected.push({ step, attached: model ? { [model]: ONE } : {} });
      }
      expect(actual).toEqual(expected);
      expect(baselineKept(group, baseline)).toBe(true);
      expect(rig.failed).not.toHaveBeenCalled();
    },
    SLOW_TEST_MS
  );

  it(
    "R2 개발 모드 두 번 그리기(StrictMode)에서 뼈에 붙는 모자를 주황 야구모자 → 파랑 야구모자 → 주황 야구모자로 바꾸면, 바꿀 때마다 head 아래에 붙은 것은 지금 모자 하나(겉면 1·외곽선 1)뿐이다",
    async () => {
      newCatW();
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig, true);
      const steps: [string, Look, CatWModel][] = [
        ["capOrange", look({ hat: "capOrange" }), "HAT_O"],
        ["capBlue", look({ hat: "capBlue" }), "HAT_B"],
        ["capOrange(다시)", look({ hat: "capOrange" }), "HAT_O"]
      ];
      const actual: { step: string; attached: Record<string, { surface: number; outline: number }> }[] = [];
      const expected: typeof actual = [];
      for (const [step, value, model] of steps) {
        await wearOn(view, rig, value, { strict: true });
        actual.push({ step, attached: attached(group, baseline) });
        expected.push({ step, attached: { [model]: ONE } });
      }
      expect(actual).toEqual(expected);
      const head = group.getObjectByName("head")!;
      expect(attached(head, baseline)).toEqual({ HAT_O: ONE });
      expect(rig.failed).not.toHaveBeenCalled();
    },
    SLOW_TEST_MS
  );

  it(
    "R3 상의를 주황 티에서 조끼로 바꾸는 그리기를 React가 한 번 버리고(같은 Suspense 안이 멈춤) 다시 그리면, 라룹이에 붙은 것은 조끼 하나(겉면 1·외곽선 1)뿐이고 주황 티는 없다",
    async () => {
      newCatW();
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig);
      // 두 모델을 한 번씩 읽어 두어, 조끼로 바꾸는 그 그리기에서 바로 조끼를 붙이게 한다(멈춤 없이 바꾸는 동안의 모습도 적어 둔다)
      const before: { step: string; attached: Record<string, { surface: number; outline: number }> }[] = [];
      for (const [step, value] of [
        ["tshirtOrange", look({ top: "tshirtOrange" })],
        ["vestQa", look({ top: "vestQa" })],
        ["tshirtOrange(다시)", look({ top: "tshirtOrange" })]
      ] as [string, Look][]) {
        await wearOn(view, rig, value);
        before.push({ step, attached: attached(group, baseline) });
      }
      expect(before).toEqual([
        { step: "tshirtOrange", attached: { TOP: ONE } },
        { step: "vestQa", attached: { VEST: ONE } },
        { step: "tshirtOrange(다시)", attached: { TOP: ONE } }
      ]);

      let open = () => {};
      const wait = new Promise<void>((resolve) => {
        open = resolve;
      });
      await wearOn(view, rig, look({ top: "vestQa" }), { wait });
      await act(async () => {
        open();
      });
      await flushAsync();
      await wearOn(view, rig, look({ top: "vestQa" }));
      expect(attached(group, baseline)).toEqual({ VEST: ONE });
      expect(baselineKept(group, baseline)).toBe(true);
      expect(rig.failed).not.toHaveBeenCalled();
    },
    SLOW_TEST_MS
  );

  it(
    "R4 같은 옷(모자·상의)으로 화면을 여러 번 다시 그리고 같은 목록을 다시 받아도, 라룹이에 붙은 옷 메시 수가 늘지 않는다(모자 하나·상의 하나)",
    async () => {
      const cat = newCatW();
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig);
      const value = look({ hat: "capOrange", top: "tshirtOrange" });
      const counts: Record<string, { surface: number; outline: number }>[] = [];
      for (let k = 0; k < 3; k += 1) {
        await wearOn(view, rig, { ...value });
        counts.push(attached(group, baseline));
      }
      await act(async () => {
        setItemCatalog(parseItemCatalog(cat.catalog)!);
      });
      await flushAsync();
      counts.push(attached(group, baseline));
      const want = { HAT_O: ONE, TOP: ONE };
      expect(counts).toEqual([want, want, want, want]);
    },
    SLOW_TEST_MS
  );
});
