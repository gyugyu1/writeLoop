// [spec] qa 테스트(작업 089 ⑤ 새 몸 넣기, 새 기능, 모바일): 라룹이 고글을 머리 뼈에 붙는 착용 모델로 그리는지(시나리오 NR1~NR20).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/23-qa-scenarios.md의 NR와 "용어와 가정")와
// 22-main-decision.md(고글은 앱에 든 모델로 그리고 내려받지 않는다, look이 있으면 face가 goggles일 때만, 없으면 늘 보인다),
// 24-main-decision.md(4: 고글 파일은 apps/mobile/assets/models/wear-goggles.glb)에서만 가져온다.
// 구현 커밋 d6338fa에서 읽은 것은 부르는 방법뿐이다: 라룹이(Character)의 속성 look·wear·kit·outline·handleRef, 고글 모델은 앱이
// assets/models/wear-goggles.glb를 require해 react-three-fiber useLoader로 읽는다(그래서 가짜 useLoader가 그 파일에 가짜 고글 모델을 준다).
// 어떻게 보나(090-③ qa 테스트 wear-download-3d.spec과 같은 방법):
// - react-three-fiber만 가짜로 두고 진짜 Character를 그린다. 가짜 라룹이 모델은 뼈 열여덟과 뼈대로 휘는 몸 하나(점 54개, noGoggles 변형 없음)이다.
// - 가짜 고글 모델은 skin 없는 메시 wear-goggles 하나(점 136개)다. 받은 옷 모델은 GLTFLoader.loadAsync(기기 주소)가 주는 가짜다(점 수로 가린다).
// - "고글 보임" = 그 라룹이 묶음 아래 그려지는(자신과 묶음까지 조상이 모두 visible) 고글 메시가 겉 하나·외곽선 하나.
//   "고글 숨김" = 그려지는 고글 메시가 없다.
// - 받은 파일과 읽은 모델은 모듈 안에 남으므로 테스트마다 새 해시의 CAT-W(tests/__fixtures__/wear-files-090.ts)를 쓴다.
import { act, render } from "@testing-library/react-native";
import { Suspense, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { currentItemCatalog, parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { LobbySim, type ActionType } from "@/lib/lobby3d/engine";
import {
  catW,
  device,
  deviceUri,
  failDownload,
  hold,
  putOnDevice,
  resetDevice,
  type CatW,
  type CatWModel,
  type FileRef
} from "../__fixtures__/wear-files-090";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;
type MockObject3D = THREE.Object3D;
type MockSkinnedMesh = THREE.SkinnedMesh;
type MockBone = THREE.Bone;

const mockCharacter: { value: unknown } = { value: null };
const mockGoggles: { value: unknown; fail: boolean } = { value: null, fail: false };
/** useLoader로 읽은 파일(차례대로). */
const mockLoaderCalls: string[] = [];
/** 기기 주소 → 그 파일의 가짜 모델. */
const mockFiles = new Map<string, CatWModel>();
/** 받은 옷 모델을 읽은 기기 주소(차례대로). */
const mockReads: string[] = [];

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
    },
    useLoader: (_loader: unknown, url: unknown) => {
      mockLoaderCalls.push(String(url));
      if (String(url) === "writeloop.glb") return mockCharacter.value;
      if (String(url) === "wear-goggles.glb") {
        if (mockGoggles.fail) throw new Error("고글 모델을 읽지 못함(테스트 가짜)");
        return mockGoggles.value;
      }
      throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
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
jest.mock("@/assets/models/wear-goggles.glb", () => "wear-goggles.glb");
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 시나리오의 값 ----------

const SLOW_TEST_MS = 60_000;
const LINE_COLOR = 0x3d1b0f;
type Slot = "hat" | "top" | "bottom" | "shoes" | "face" | "back" | "accessory";
type Look = Record<Slot, string | null>;
/** 시나리오 ALL_NULL. */
const ALL_NULL: Look = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const look = (partial: Partial<Look>): Look => ({ ...ALL_NULL, ...partial });
/** 03-qa-scenarios의 WB를 CAT-W에 있는 옷으로(일곱 부위 모두 입음, face sunglassesBlack). */
const WB: Look = {
  hat: "capOrange",
  top: "tshirtOrange",
  bottom: "shortsRed",
  shoes: "shoesBrown",
  face: "sunglassesBlack",
  back: null,
  accessory: "mufflerRed"
};

const GOGGLES_POINTS = 136;
const BODY_POINTS = 54;
const POINTS: Record<number, CatWModel> = { 24: "HAT_O", 32: "SHOE", 40: "TOP", 48: "BOTTOM", 56: "HAT_B", 72: "GLASSES", 88: "MUFFLER", 104: "BOWTIE", 112: "VEST", 120: "PLAIN" };

// ---------- 가짜 모델 ----------

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
    const axis = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)][k % 3];
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion().setFromAxisAngle(axis, 0.3 + 0.03 * k);
    const q2 = new THREE.Quaternion().setFromAxisAngle(axis, -0.2 - 0.02 * k);
    const quat = (a: THREE.Quaternion, b: THREE.Quaternion, c: THREE.Quaternion) => [...a.toArray(), ...b.toArray(), ...c.toArray()];
    return new THREE.AnimationClip(name, 2, [
      new THREE.QuaternionKeyframeTrack("head.quaternion", [0, 1, 2], quat(q0, q1, q2)),
      new THREE.QuaternionKeyframeTrack("spine.quaternion", [0, 1, 2], quat(q0, q2, q1)),
      new THREE.VectorKeyframeTrack("hips.position", [0, 1, 2], [0, 0.4, 0, 0.02, 0.45 + 0.01 * k, 0.05, 0, 0.38, -0.03]),
      new THREE.VectorKeyframeTrack("foot_l.position", [0, 1, 2], [0, -0.3, 0.02, 0.04, -0.24, 0.1 + 0.01 * k, 0, -0.3, -0.06]),
      new THREE.VectorKeyframeTrack("foot_r.position", [0, 1, 2], [0, -0.3, 0.02, -0.04, -0.27, -0.08, 0, -0.25, 0.09 + 0.01 * k])
    ]);
  });
}

/** 몸 그림(NR18에서 몸 겉 재질의 그림이 바뀌지 않는지 보려고 둔다). */
const BODY_MAP = new THREE.DataTexture(new Uint8Array([240, 200, 150, 255]), 1, 1);

function fakeCharacter() {
  const { root, bones } = makeBones();
  const geometry = new THREE.BoxGeometry(0.5, 1, 0.4, 2, 2, 2).translate(0, 0.5, 0);
  const body = skinnedBox(geometry, bones, new THREE.MeshStandardMaterial({ map: BODY_MAP }));
  body.name = "qa-body";
  const scene = new THREE.Group();
  scene.name = "writeloop";
  scene.add(root, body);
  scene.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton(bones));
  return { scene, scenes: [scene], animations: makeClips(), cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 가짜 고글 모델: skin 없는 메시 wear-goggles 하나(라룹이 쉬는 자세 좌표, 이마 높이). 점 136개(8 + 8·16). */
function fakeGoggles() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1, 15, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3060c0 }));
  mesh.name = "wear-goggles";
  mesh.position.set(0.01, 0.9, 0.21);
  mesh.rotation.set(0.1, 0, 0);
  const scene = new THREE.Group();
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

function rigidScene(segments: number, color: number, at: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1, segments, 1, 1), new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(...at);
  const scene = new THREE.Group();
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return scene;
}

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
    case "SHOE":
      return rigidScene(2, 0x6b3a1e, [0.1, 0.04, 0.03]);
    case "TOP":
      return skinnedScene(3, 0xe8590c, 0.6, 0.4);
    case "BOTTOM":
      return skinnedScene(4, 0x1f2f5c, 0.3, 0.3);
    case "GLASSES":
      return rigidScene(7, 0x101014, [0, 0.9, 0.22]);
    case "MUFFLER":
      return rigidScene(9, 0xc0302c, [0, 0.72, 0.05]);
    default:
      return rigidScene(13, 0xe0b040, [0, 0.66, 0.21]);
  }
}

function mockRead(uri: string): Promise<unknown> {
  mockReads.push(uri);
  const model = mockFiles.get(uri);
  if (!model) return Promise.reject(new Error(`테스트가 모르는 기기 파일: ${uri}`));
  const scene = sceneOf(model);
  return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} });
}

// ---------- 도우미 ----------

let round = 0;
/** 테스트마다 새 해시의 CAT-W. without에 든 종류는 목록에서 뺀다. setNow면 바로 목록으로 둔다. */
function newCatW(options: { without?: string[]; setNow?: boolean } = {}): CatW {
  round += 1;
  const cat = catW(`goggles-${round}`);
  if (options.without) cat.catalog.items = cat.catalog.items.filter((item) => !options.without!.includes(item.id as string));
  for (const [model, ref] of Object.entries(cat.model) as [CatWModel, FileRef][]) mockFiles.set(deviceUri(ref), model);
  if (options.setNow !== false) setItemCatalog(parseItemCatalog(cat.catalog)!);
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

function drawn(object: THREE.Object3D, group: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
    if (current === group) return true;
  }
  return false;
}

function isAncestor(ancestor: THREE.Object3D, object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object.parent; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

const isToon = (mesh: THREE.Mesh) => (mesh.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial === true;
const shownMeshes = (group: THREE.Object3D) => meshesUnder(group).filter((m) => drawn(m, group));

/** 그 라룹이에 그려지는 고글 메시(겉·외곽선). */
function goggles(group: THREE.Object3D) {
  const list = shownMeshes(group).filter((m) => m.geometry.attributes.position.count === GOGGLES_POINTS);
  return { surface: list.filter(isToon), outline: list.filter((m) => !isToon(m)), all: list };
}

/** 고글 보임: 겉 하나·외곽선 하나. */
function expectGogglesShown(group: THREE.Object3D, label: string) {
  const g = goggles(group);
  expect({ label, surface: g.surface.length, outline: g.outline.length }).toEqual({ label, surface: 1, outline: 1 });
  return g;
}

function expectGogglesHidden(group: THREE.Object3D, label: string) {
  expect({ label, goggles: goggles(group).all.length }).toEqual({ label, goggles: 0 });
}

/** 그려지는 받은 옷 메시(점 수로 가린 모델 이름들, 겉만). */
function drawnClothes(group: THREE.Object3D): CatWModel[] {
  return shownMeshes(group)
    .filter(isToon)
    .map((m) => POINTS[m.geometry.attributes.position.count])
    .filter((model): model is CatWModel => model !== undefined)
    .sort();
}

function bone(group: THREE.Object3D, name: string): THREE.Object3D {
  const found = group.getObjectByName(name);
  expect(found !== undefined).toBe(true);
  return found!;
}

function outlineThickness(material: THREE.Material): number | undefined {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: "#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>",
    fragmentShader: ""
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader.uniforms.outlineThickness?.value as number | undefined;
}

/** look이 undefined면 look 없이(wear 모두 거짓) 그린다. */
type LookArg = Look | undefined;

interface Rig {
  kit: ToonKit;
  handleRef: MutableRefObject<CharacterHandle | null>;
  failed: jest.Mock;
  element: (value: LookArg, options?: { outline?: number; kit?: ToonKit }) => ReactElement;
}

function newKit(): ToonKit {
  return { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] } as ToonKit;
}

const NO_WEAR = { hat: false, top: false, bottom: false, shoes: false };

function makeRig(): Rig {
  const rig = { kit: newKit(), handleRef: { current: null } as MutableRefObject<CharacterHandle | null>, failed: jest.fn() };
  const wearOf = (value: LookArg) =>
    value ? { hat: value.hat !== null, top: value.top !== null, bottom: value.bottom !== null, shoes: value.shoes !== null } : NO_WEAR;
  return {
    ...rig,
    element: (value, options = {}) => (
      <CharacterErrorBoundary onFailed={rig.failed}>
        <Suspense fallback={null}>
          {value === undefined ? (
            <Character kit={options.kit ?? rig.kit} outline={options.outline ?? 1} handleRef={rig.handleRef} wear={NO_WEAR} />
          ) : (
            <Character kit={options.kit ?? rig.kit} outline={options.outline ?? 1} handleRef={rig.handleRef} wear={wearOf(value)} look={value} />
          )}
        </Suspense>
      </CharacterErrorBoundary>
    )
  };
}

async function draw(rig: Rig, value: LookArg, options?: { outline?: number; kit?: ToonKit }) {
  const view = await render(rig.element(value, options));
  await flushAsync();
  expect(rig.handleRef.current !== null).toBe(true);
  return { view, group: rig.handleRef.current!.group };
}

async function redraw(view: { rerender: (el: ReactElement) => unknown }, rig: Rig, value: LookArg, options?: { outline?: number; kit?: ToonKit }) {
  await act(async () => {
    await view.rerender(rig.element(value, options));
  });
  await flushAsync();
}

/** 그 라룹이 묶음 안의 라룹이 모델 복제본(가짜 모델 이름 writeloop). */
function modelRoot(group: THREE.Object3D): THREE.Object3D {
  const found = group.getObjectByName("writeloop");
  expect(found !== undefined).toBe(true);
  return found!;
}

function relative(base: THREE.Object3D, mesh: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().copy(base.matrixWorld).invert().multiply(mesh.matrixWorld);
}

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4, label: string, tolerance = 1e-5) {
  const diff = actual.elements.reduce((max, v, i) => Math.max(max, Math.abs(v - expected.elements[i])), 0);
  expect({ label, close: diff <= tolerance }).toEqual({ label, close: true });
}

const CHARACTER_FILE = "writeloop.glb";
const GOGGLES_FILE = "wear-goggles.glb";

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-11-14T03:00:00.000Z") });
  resetDevice();
  mockFiles.clear();
  mockReads.length = 0;
  mockLoaderCalls.length = 0;
  mockCharacter.value = fakeCharacter();
  mockGoggles.value = fakeGoggles();
  mockGoggles.fail = false;
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- NR3(목록 없음): 이 파일 맨 앞(아직 목록이 없는 상태에서 시작한다) ----------

describe("[spec] 089-⑤ 23 NR3(받은 목록 없음)", () => {
  it("NR3 받은 목록이 없을 때 face goggles면 고글 보임, 옷 파일 받기 요청 0건, 받은 옷 모델 읽기 0건", async () => {
    expect(currentItemCatalog()).toBeNull();
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    expectGogglesShown(group, "목록 없음");
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
  });
});

// ---------- NR1~NR4 ----------

describe("[spec] 089-⑤ 23 NR1~NR4: look이 없거나 face가 goggles면 고글이 머리 뼈에", () => {
  it("NR1·NR4 look 없이(wear 모두 거짓) 그리면 고글 보임이고 고글 메시는 그 라룹이의 head 뼈 자손이며, 옷 받기·받은 옷 읽기가 0건이고 읽는 모델은 라룹이와 고글뿐이다", async () => {
    newCatW();
    const rig = makeRig();
    const { group } = await draw(rig, undefined);
    const g = expectGogglesShown(group, "NR1");
    const head = bone(group, "head");
    expect(g.all.every((m) => isAncestor(head, m))).toBe(true);
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
    expect([...new Set(mockLoaderCalls)].sort()).toEqual([CHARACTER_FILE, GOGGLES_FILE].sort());
  });

  it("NR2·NR4 look { ...ALL_NULL, face: goggles }이면 고글 보임(head 자손)이고 고글 말고 더해진 메시가 없으며, 옷 받기·받은 옷 읽기가 0건이고 읽는 모델은 라룹이와 고글뿐이다", async () => {
    newCatW();
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    const g = expectGogglesShown(group, "NR2");
    expect(g.all.every((m) => isAncestor(bone(group, "head"), m))).toBe(true);
    const others = shownMeshes(group).filter((m) => m.geometry.attributes.position.count !== GOGGLES_POINTS);
    expect(others.length).toBe(2);
    expect(others.every((m) => m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
    expect([...new Set(mockLoaderCalls)].sort()).toEqual([CHARACTER_FILE, GOGGLES_FILE].sort());
  });

  it.each([
    ["목록의 goggles가 draw·assets null", [] as string[]],
    ["목록에 goggles가 없음", ["goggles"]]
  ])("NR3 %s이어도 face goggles면 고글 보임, 옷 받기 0건, 받은 옷 읽기 0건", async (_label, without) => {
    const cat = newCatW({ without });
    if (without.length === 0) {
      const item = cat.catalog.items.find((i) => i.id === "goggles")!;
      expect({ draw: item.draw ?? null, assets: item.assets }).toEqual({ draw: null, assets: null });
    } else {
      expect(cat.catalog.items.some((i) => i.id === "goggles")).toBe(false);
    }
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    expectGogglesShown(group, _label);
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
  });
});

// ---------- NR5~NR10 ----------

describe("[spec] 089-⑤ 23 NR5~NR10: 다른 얼굴장식·맨얼굴·모르는 종류면 숨김, 바로 바뀜, 다른 옷과 함께", () => {
  it("NR5 face sunglassesBlack(선글라스 모델이 기기에 있음)이면 고글 숨김이고 선글라스 모델이 head 자손으로 그려진다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.GLASSES);
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "sunglassesBlack" }));
    expectGogglesHidden(group, "NR5");
    const glasses = shownMeshes(group).filter((m) => isToon(m) && m.geometry.attributes.position.count === 72);
    expect(glasses.length).toBe(1);
    expect(isAncestor(bone(group, "head"), glasses[0])).toBe(true);
  });

  it("NR6 선글라스 모델을 아직 받는 중이면 고글 숨김이고 선글라스도 아직 그려지지 않는다", async () => {
    const cat = newCatW();
    hold(cat.model.GLASSES);
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "sunglassesBlack" }));
    expect(device.downloads.length).toBe(1);
    expectGogglesHidden(group, "NR6");
    expect(drawnClothes(group)).toEqual([]);
  });

  it("NR7 look ALL_NULL이면 고글 숨김이고 그려지는 메시가 몸과 그 외곽선 둘뿐이다. WB에서 face만 null이어도 고글 숨김이다", async () => {
    const cat = newCatW();
    for (const ref of Object.values(cat.model)) putOnDevice(ref);
    const rig = makeRig();
    const { view, group } = await draw(rig, ALL_NULL);
    expectGogglesHidden(group, "ALL_NULL");
    const shown = shownMeshes(group);
    expect(shown.length).toBe(2);
    expect(shown.every((m) => (m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
    await redraw(view, rig, { ...WB, face: null });
    expectGogglesHidden(group, "WB face null");
    expect(drawnClothes(group).length).toBeGreaterThan(0);
  });

  it("NR8 face glassesRound(모르는 종류)면 고글 숨김이고 더해진 메시가 없다", async () => {
    newCatW();
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "glassesRound" }));
    expectGogglesHidden(group, "NR8");
    const shown = shownMeshes(group);
    expect(shown.length).toBe(2);
    expect(shown.every((m) => m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
  });

  it("NR9 goggles → sunglassesBlack → goggles → ALL_NULL → 모름 → ALL_NULL로 바꿀 때마다 바로 보임 → 숨김(선글라스) → 보임(선글라스 없음) → 숨김 → 보임 → 숨김이고, 보일 때마다 고글은 겉 하나·외곽선 하나다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.GLASSES);
    const rig = makeRig();
    const { view, group } = await draw(rig, look({ face: "goggles" }));
    const steps: [LookArg, boolean, boolean][] = [
      [look({ face: "goggles" }), true, false],
      [look({ face: "sunglassesBlack" }), false, true],
      [look({ face: "goggles" }), true, false],
      [ALL_NULL, false, false],
      [undefined, true, false],
      [ALL_NULL, false, false]
    ];
    for (const [i, [value, shown, glasses]] of steps.entries()) {
      if (i > 0) await redraw(view, rig, value);
      const label = `${i + 1}번째(${value === undefined ? "모름" : value.face ?? "null"})`;
      if (shown) expectGogglesShown(group, label);
      else expectGogglesHidden(group, label);
      expect({ label, glasses: drawnClothes(group).includes("GLASSES") }).toEqual({ label, glasses });
    }
  });

  it("NR10 face goggles와 hat capOrange(모자 모델 기기에 있음)면 고글과 모자가 모두 head 자손으로 그려진다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.HAT_O);
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles", hat: "capOrange" }));
    const head = bone(group, "head");
    const g = expectGogglesShown(group, "NR10");
    expect(g.all.every((m) => isAncestor(head, m))).toBe(true);
    const hats = shownMeshes(group).filter((m) => isToon(m) && m.geometry.attributes.position.count === 24);
    expect(hats.length).toBe(1);
    expect(isAncestor(head, hats[0])).toBe(true);
  });
});

// ---------- NR11~NR14 ----------

type SimSetup = { label: string; frames: ((sim: LobbySim) => void)[] };
const at = (ts: number[], f: (t: number) => (sim: LobbySim) => void) => ts.map(f);
/** 시나리오 NR13의 걷기·서기·앉기·점프·생각하기·책 꺼내기. */
const MOTIONS: SimSetup[] = [
  { label: "걷기", frames: at([0, 1, 2, 3], () => (s) => ((s.vx = 2.2), (s.vz = 0.6))) },
  { label: "서기", frames: at([0, 1, 2], () => () => {}) },
  ...(["jump"] as ActionType[]).map((type) => ({
    label: `점프`,
    frames: at([0.15, 0.4, 0.7, 1.0], (t) => (s: LobbySim) => (s.action = { type, t }))
  })),
  { label: "앉는 중", frames: at([0.1, 0.3, 0.5], (t) => (s) => (s.posture = { kind: "sitting-down", t })) },
  { label: "앉아 있기", frames: at([0.2, 1.0, 1.7], (t) => (s) => (s.posture = { kind: "sitting", t })) },
  { label: "생각하기", frames: at([0.2, 0.6, 0.9], (t) => (s) => (s.scene = { kind: "think", mark: "board", phase: "in", t })) },
  { label: "생각 유지", frames: at([0.2, 1.0], (t) => (s) => (s.scene = { kind: "think", mark: "board", phase: "hold", t })) },
  { label: "책 꺼내기", frames: at([0.2, 0.7, 1.2], (t) => (s) => (s.scene = { kind: "book", mark: "bookcase", phase: "in", t })) }
];

describe("[spec] 089-⑤ 23 NR11~NR14: 카툰 명암·갈색 외곽선, 움직임 따라가기, 쉬는 자세 자리", () => {
  it("NR11 고글 겉 재질은 카툰 재질이고 명암 그림이 그 라룹이의 kit.gradient이며 kit.toonMaterials에 들어 있다", async () => {
    newCatW();
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    const material = expectGogglesShown(group, "NR11").surface[0].material as THREE.MeshToonMaterial;
    expect(material.isMeshToonMaterial).toBe(true);
    expect(material.gradientMap === rig.kit.gradient).toBe(true);
    expect(rig.kit.toonMaterials.includes(material)).toBe(true);
  });

  it("NR12 고글 외곽선이 그려지고 색이 0x3d1b0f이며, 굵기 2.0에서 두께가 1.0의 2배다", async () => {
    newCatW();
    const rig = makeRig();
    const { view, group } = await draw(rig, look({ face: "goggles" }), { outline: 1 });
    const line = expectGogglesShown(group, "NR12 1.0").outline[0];
    expect((line.material as THREE.MeshBasicMaterial).color.getHex()).toBe(LINE_COLOR);
    const thin = outlineThickness(line.material as THREE.Material);
    expect(typeof thin).toBe("number");
    expect(thin!).toBeGreaterThan(0);
    await redraw(view, rig, look({ face: "goggles" }), { outline: 2 });
    const thick = outlineThickness(expectGogglesShown(group, "NR12 2.0").outline[0].material as THREE.Material);
    expect(thick).toBeCloseTo(thin! * 2, 6);
  });

  it(
    "NR13 걷기·서기·앉기·점프·생각하기·책 꺼내기의 여러 프레임에서 고글 메시의 head 기준 자리·방향이 처음과 같다",
    async () => {
      newCatW();
      const rig = makeRig();
      const { group } = await draw(rig, look({ face: "goggles" }));
      const handle = rig.handleRef.current!;
      const head = bone(group, "head");
      const mesh = expectGogglesShown(group, "NR13").surface[0];
      group.updateMatrixWorld(true);
      const rest = relative(head, mesh);
      const headStart = head.getWorldPosition(new THREE.Vector3());
      let headMoved = 0;
      const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
      let now = 1;
      for (const motion of MOTIONS) {
        for (const setup of motion.frames) {
          sim.vx = 0;
          sim.vz = 0;
          sim.action = null;
          sim.posture = null;
          sim.scene = null;
          setup(sim);
          now += 1 / 30;
          handle.update(sim, 1 / 30, now);
          group.updateMatrixWorld(true);
          expectSameMatrix(relative(head, mesh), rest, motion.label);
          headMoved = Math.max(headMoved, head.getWorldPosition(new THREE.Vector3()).distanceTo(headStart));
        }
      }
      expect(headMoved).toBeGreaterThan(0.05);
    },
    SLOW_TEST_MS
  );

  it("NR14 쉬는 자세(동작 무게 0)에서 고글 메시의 월드 자리가 고글 모델 파일의 wear-goggles 자리를 라룹이 모델과 같은 변환으로 둔 자리와 같다(오차 1e-4)", async () => {
    newCatW();
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    const mesh = expectGogglesShown(group, "NR14").surface[0];
    group.updateMatrixWorld(true);
    const source = (mockGoggles.value as { scene: THREE.Group }).scene.getObjectByName("wear-goggles")!;
    source.updateWorldMatrix(true, false);
    const expected = new THREE.Matrix4().multiplyMatrices(modelRoot(group).matrixWorld, source.matrixWorld);
    expectSameMatrix(mesh.matrixWorld, expected, "NR14", 1e-4);
  });
});

// ---------- NR15~NR20 ----------

describe("[spec] 089-⑤ 23 NR15~NR20: 누르기 판정, 실패해도 라룹이는 그대로, 몸 그림, 새 kit, 라룹이마다", () => {
  it("NR15 앞·위에서 라룹이 머리를 누르면 맞는 것은 보이지 않는 통(isCharacter)뿐이고 고글 메시는 맞지 않는다", async () => {
    newCatW();
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    const g = expectGogglesShown(group, "NR15");
    group.updateMatrixWorld(true);
    const gogglesAt = g.surface[0].getWorldPosition(new THREE.Vector3());
    for (const [origin, direction] of [
      [new THREE.Vector3(gogglesAt.x, gogglesAt.y, gogglesAt.z + 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(gogglesAt.x, gogglesAt.y + 12, gogglesAt.z), new THREE.Vector3(0, -1, 0)]
    ] as const) {
      const hits = new THREE.Raycaster(origin, direction.clone().normalize()).intersectObject(group, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => (h.object.userData as { isCharacter?: boolean }).isCharacter === true)).toBe(true);
      expect(hits.some((h) => g.all.includes(h.object as THREE.Mesh))).toBe(false);
    }
  });

  it("NR16 고글 모델 파일만 못 읽으면 오류가 밖으로 나오지 않고 라룹이(몸·외곽선)가 그대로 보이며 라룹이 손잡이도 그대로다", async () => {
    newCatW();
    mockGoggles.fail = true;
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles" }));
    expect(rig.failed).not.toHaveBeenCalled();
    expect(rig.handleRef.current !== null && rig.handleRef.current.group === group).toBe(true);
    const shown = shownMeshes(group);
    expect(shown.length).toBe(2);
    expect(shown.every((m) => m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
    expect(shown.filter(isToon).length).toBe(1);
  });

  it("NR17 face goggles·hat capOrange에서 모자 파일 받기가 실패하면 고글 보임, 모자는 그려지지 않고, 오류가 밖으로 나오지 않는다", async () => {
    const cat = newCatW();
    failDownload(cat.model.HAT_O);
    const rig = makeRig();
    const { group } = await draw(rig, look({ face: "goggles", hat: "capOrange" }));
    expect(device.downloads.length).toBe(1);
    expectGogglesShown(group, "NR17");
    expect(drawnClothes(group)).toEqual([]);
    expect(rig.failed).not.toHaveBeenCalled();
  });

  it("NR18 NR2(고글)와 NR5(선글라스)에서 몸 겉 재질의 그림이 같은 그림이고 몸 메시에 모양 변형 값이 없다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.GLASSES);
    const rig = makeRig();
    const { view, group } = await draw(rig, look({ face: "goggles" }));
    const body = () => shownMeshes(group).find((m) => isToon(m) && m.geometry.attributes.position.count === BODY_POINTS)!;
    expectGogglesShown(group, "NR18 고글");
    const mapWithGoggles = (body().material as THREE.MeshToonMaterial).map;
    expect(mapWithGoggles !== null).toBe(true);
    const influencesWith = body().morphTargetInfluences;
    await redraw(view, rig, look({ face: "sunglassesBlack" }));
    expectGogglesHidden(group, "NR18 선글라스");
    expect((body().material as THREE.MeshToonMaterial).map === mapWithGoggles).toBe(true);
    for (const influences of [influencesWith, body().morphTargetInfluences]) {
      expect(influences === undefined || influences.length === 0).toBe(true);
    }
  });

  it("NR19 그린 뒤 새 kit으로 다시 그리면 고글 메시는 여전히 하나이고, 고글 겉 재질이 새 kit의 명암 목록에 있고 옛 kit 목록에는 없다", async () => {
    newCatW();
    const rig = makeRig();
    const { view, group } = await draw(rig, look({ face: "goggles" }));
    expectGogglesShown(group, "NR19 처음");
    const oldKit = rig.kit;
    const kit2 = newKit();
    await redraw(view, rig, look({ face: "goggles" }), { kit: kit2 });
    const material = expectGogglesShown(group, "NR19 새 kit").surface[0].material as THREE.MeshToonMaterial;
    expect(kit2.toonMaterials.includes(material)).toBe(true);
    expect(oldKit.toonMaterials.includes(material)).toBe(false);
  });

  it("NR20 라룹이 둘을 각각 look 없음 / look ALL_NULL로 그리면 첫째만 고글 보임, 둘째는 숨김이고 고글 메시는 첫째의 head 자손이다", async () => {
    newCatW();
    const first = makeRig();
    const second = makeRig();
    await render(
      <>
        {first.element(undefined)}
        {second.element(ALL_NULL)}
      </>
    );
    await flushAsync();
    expect(first.handleRef.current !== null && second.handleRef.current !== null).toBe(true);
    const a = first.handleRef.current!.group;
    const b = second.handleRef.current!.group;
    expect(a === b).toBe(false);
    const g = expectGogglesShown(a, "NR20 첫째");
    expectGogglesHidden(b, "NR20 둘째");
    expect(g.all.every((m) => isAncestor(bone(a, "head"), m))).toBe(true);
  });
});
