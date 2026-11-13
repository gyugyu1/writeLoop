// [spec] qa 테스트(작업 089 ⑤ 아이템 늘리기, 새 기능, 모바일): 라룹이가 부위 일곱의 아이템마다 그 모델·색으로 그리는지(시나리오 R1~R4, R6~R15).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/03-qa-scenarios.md의 R)와
// 04-main-decision.md B(A-4: 그리기에는 wear(①의 넷 참·거짓)와 따로 look(부위 일곱의 종류)을 넘긴다, B-2: 몸통 뼈는 spine,
// B-3: 머플러는 몸통 뼈에 단단히, B-4: 색 값 흰 티셔츠 #F4F0E8, 노랑 티셔츠 #F2C440, 갈색 반바지 #8A5A3B, 빨강 반바지·빨강 운동화 #C8443A,
// 흰 운동화 #DCD8CF, 기존 넷은 모델 색 그대로)에서만 가져온다.
// 구현 커밋 59b34f2·cb62c3b에서 읽은 것은 부르는 방법뿐이다:
// - 라룹이(Character)의 속성 look(부위 일곱 → 종류, 없으면 null)과 wear(①의 넷), kit·outline·handleRef
// - 착용 모델 안 이름(04 결정 A-5): wear-hat, wear-hat-blue, wear-hat-green, wear-top, wear-bottom, wear-shoe-l, wear-sunglasses, wear-backpack, wear-muffler, wear-necklace
// 어떻게 보나(① qa 테스트 lobby3d-wear-character.spec과 같은 방법):
// - react-three-fiber만 가짜로 두고, 라룹이 모델·착용 모델은 약속(뼈 이름, 모델 안 이름)을 지키는 가짜다.
// - 착용 모델의 아이템마다 점 수를 달리해 붙은 메시가 어느 모델인지 가린다(모자 24, 파랑 모자 56, 초록 모자 64, 신발 32, 상의 40, 하의 48,
//   선글라스 72, 백팩 80, 머플러 88, 목걸이 96, 라룹이 몸 54). 신발은 실제 파일처럼 왼쪽 한 짝만 둔다.
// - 파랑·초록 모자가 주황 모자와 같은 모양인지와 무늬의 주황 부분만 바뀌는지(R2·R5의 모자), 새 넷의 색 이름(R3의 새 넷)은
//   실제 파일에서 보아야 하므로 tests/lib/lobby3d-wearables-expand-model.spec.test.ts가 본다.
// - "붙은 메시" = 입기 전 라룹이 묶음에 없던 메시. "그려진다" = 자신과 묶음까지의 조상이 모두 visible.
import { act, render, screen } from "@testing-library/react-native";
import { Suspense, useEffect, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { LobbySim, type ActionType } from "@/lib/lobby3d/engine";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;
type ModelStatus = "pending" | "loaded" | "failed";
interface MockModel {
  status: ModelStatus;
  promise: Promise<void>;
  resolve: () => void;
  value: unknown;
  error: Error | null;
}

const mockFrames = new Set<FramePart>();
const mockModels = new Map<string, MockModel>();
const mockLoaded: string[] = [];
type MockObject3D = THREE.Object3D;
type MockSkinnedMesh = THREE.SkinnedMesh;
type MockBone = THREE.Bone;

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
      mockLoaded.push(String(url));
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
jest.mock("@/assets/models/lobby-wearables.glb", () => "lobby-wearables.glb");

// ---------- 시나리오의 값 ----------

const CHARACTER_FILE = "writeloop.glb";
const WEAR_FILE = "lobby-wearables.glb";
const SLOW_TEST_MS = 60_000;
const LINE_COLOR = 0x3d1b0f;

type Slot = "hat" | "top" | "bottom" | "shoes" | "face" | "back" | "accessory";
type Look = Record<Slot, string | null>;
const NO_LOOK: Look = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const look = (partial: Partial<Look>): Look => ({ ...NO_LOOK, ...partial });
/** 시나리오 WB의 입은 것. */
const WB: Look = {
  hat: "capGreen",
  top: "tshirtYellow",
  bottom: "shortsRed",
  shoes: "shoesWhite",
  face: "sunglassesBlack",
  back: "backpackRed",
  accessory: "necklaceGold"
};

type Model = "hat" | "hatBlue" | "hatGreen" | "shoe" | "top" | "bottom" | "sunglasses" | "backpack" | "muffler" | "necklace";
const MODEL_BY_POINTS: Record<number, Model> = {
  24: "hat",
  56: "hatBlue",
  64: "hatGreen",
  32: "shoe",
  40: "top",
  48: "bottom",
  72: "sunglasses",
  80: "backpack",
  88: "muffler",
  96: "necklace"
};
const BODY_POINTS = 54;
/** 가짜 착용 모델의 원래 색(지금 넷과 새 넷은 모델 색 그대로 그린다). */
const MODEL_COLOR: Record<Model, number> = {
  hat: 0xd9480f,
  hatBlue: 0x2f6fd0,
  hatGreen: 0x2f9a4a,
  shoe: 0x6b3a1e,
  top: 0xe8590c,
  bottom: 0x1f2f5c,
  sunglasses: 0x101014,
  backpack: 0xb8322a,
  muffler: 0xc0302c,
  necklace: 0xe0b040
};
const hex = (value: number) => value.toString(16).padStart(6, "0");

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

function skinnedBox(geometry: THREE.BufferGeometry, bones: THREE.Bone[], material: THREE.Material): THREE.SkinnedMesh {
  const index = (name: string) => bones.findIndex((b) => b.name === name);
  const position = geometry.attributes.position;
  const skinIndex = new THREE.Uint16BufferAttribute(new Uint16Array(position.count * 4), 4);
  const skinWeight = new THREE.Float32BufferAttribute(new Float32Array(position.count * 4), 4);
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const bone = y > 0.75 ? index("head") : y > 0.45 ? index("spine") : y > 0.2 ? index("hips") : position.getX(i) > 0 ? index("foot_l") : index("foot_r");
    skinIndex.setX(i, bone);
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

/** 클립마다 머리·척추를 돌리고 엉덩이·두 발을 옮기는 2초 클립. */
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

/** 단단한 아이템 메시: 가로 칸 수 segments로 점 수를 정한다(2 × ((s+1)·2 + 4 + (s+1)·2)). */
function rigid(name: string, segments: number, color: number, at: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1, segments, 1, 1), new THREE.MeshStandardMaterial({ color }));
  mesh.name = name;
  mesh.position.set(...at);
  return mesh;
}

/** 가짜 착용 모델. 상의·하의는 뼈 이름이 같은 자기 뼈대에, 라룹이와 다른 뼈 순서로 묶는다. 신발은 왼쪽 한 짝만. */
function fakeWearables() {
  const scene = new THREE.Group();
  const order = [...BONE_TREE.map(([name]) => name)].reverse();
  const { root, bones } = makeBones(order);
  scene.add(root);
  const hat = rigid("wear-hat", 1, MODEL_COLOR.hat, [0, 1.05, 0]);
  const hatBlue = rigid("wear-hat-blue", 5, MODEL_COLOR.hatBlue, [0, 1.05, 0]);
  const hatGreen = rigid("wear-hat-green", 6, MODEL_COLOR.hatGreen, [0, 1.05, 0]);
  const shoeL = rigid("wear-shoe-l", 2, MODEL_COLOR.shoe, [0.1, 0.04, 0.03]);
  const sunglasses = rigid("wear-sunglasses", 7, MODEL_COLOR.sunglasses, [0, 0.9, 0.22]);
  const backpack = rigid("wear-backpack", 8, MODEL_COLOR.backpack, [0, 0.6, -0.26]);
  const muffler = rigid("wear-muffler", 9, MODEL_COLOR.muffler, [0, 0.72, 0.05]);
  const necklace = rigid("wear-necklace", 10, MODEL_COLOR.necklace, [0, 0.66, 0.21]);
  const top = skinnedBox(new THREE.BoxGeometry(0.55, 0.4, 0.45, 3, 1, 1).translate(0, 0.6, 0), bones, new THREE.MeshStandardMaterial({ color: MODEL_COLOR.top }));
  top.name = "wear-top";
  const bottom = skinnedBox(new THREE.BoxGeometry(0.55, 0.3, 0.45, 4, 1, 1).translate(0, 0.3, 0), bones, new THREE.MeshStandardMaterial({ color: MODEL_COLOR.bottom }));
  bottom.name = "wear-bottom";
  scene.add(hat, hatBlue, hatGreen, shoeL, sunglasses, backpack, muffler, necklace, top, bottom);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  top.bind(skeleton);
  bottom.bind(skeleton);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

function pendingModel(): MockModel {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { status: "pending", promise, resolve, value: null, error: null };
}

function mark(status: "loaded" | "failed", ...files: string[]) {
  for (const file of files) {
    const model = mockModels.get(file)!;
    model.status = status;
    if (status === "loaded") model.value = file === CHARACTER_FILE ? fakeCharacter() : fakeWearables();
    else model.error = new Error(`읽지 못했다(테스트 가짜): ${file}`);
    model.resolve();
  }
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function wearLoads(): number {
  return mockLoaded.filter((url) => url === WEAR_FILE).length;
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

function isToon(mesh: THREE.Mesh): boolean {
  return (mesh.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial === true;
}

/** 입기 전 메시 목록 baseline에 없던 group 아래의 메시 가운데 그려지는 것을 모델별로(surface는 카툰 재질, outline은 그 밖). */
function drawnItems(group: THREE.Object3D, baseline: Set<THREE.Mesh>) {
  const items: Partial<Record<Model, { surface: THREE.Mesh[]; outline: THREE.Mesh[] }>> = {};
  const unknown: THREE.Mesh[] = [];
  for (const mesh of meshesUnder(group)) {
    if (baseline.has(mesh) || !drawn(mesh, group)) continue;
    const model = MODEL_BY_POINTS[mesh.geometry.attributes.position.count];
    if (!model) {
      unknown.push(mesh);
      continue;
    }
    const entry = (items[model] ??= { surface: [], outline: [] });
    entry[isToon(mesh) ? "surface" : "outline"].push(mesh);
  }
  return { items, unknown, models: (Object.keys(items) as Model[]).sort() };
}

/** 모델별 그려진 겉면 수. */
function surfaceCounts(group: THREE.Object3D, baseline: Set<THREE.Mesh>): Partial<Record<Model, number>> {
  const { items } = drawnItems(group, baseline);
  return Object.fromEntries(Object.entries(items).map(([model, entry]) => [model, entry!.surface.length]));
}

/** 그려진 그 모델 겉면들의 색(sRGB 16진). */
function surfaceColors(group: THREE.Object3D, baseline: Set<THREE.Mesh>, model: Model): string[] {
  const entry = drawnItems(group, baseline).items[model];
  return (entry?.surface ?? []).map((m) => (m.material as THREE.MeshToonMaterial).color.getHexString());
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

function newKit(): ToonKit {
  return { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] };
}

interface Rig {
  kit: ToonKit;
  handleRef: MutableRefObject<CharacterHandle | null>;
  failed: jest.Mock;
  element: (value: Look, outline?: number) => ReactElement;
}

function SettledMark({ onSettled }: { onSettled: () => void }) {
  useEffect(() => {
    onSettled();
  }, [onSettled]);
  return null;
}

/** 그리기에 넘기는 ①의 넷(참·거짓)은 look에 맞춘다(04 결정 A-4: 화면은 둘을 함께 넘긴다). */
function wearOf(value: Look) {
  return { hat: value.hat !== null, top: value.top !== null, bottom: value.bottom !== null, shoes: value.shoes !== null };
}

function makeRig(): Rig {
  const rig = { kit: newKit(), handleRef: { current: null } as MutableRefObject<CharacterHandle | null>, failed: jest.fn() };
  const settled = jest.fn();
  return {
    ...rig,
    element: (value: Look, outline = 1) => (
      <CharacterErrorBoundary onFailed={rig.failed}>
        <Suspense fallback={null}>
          <Character kit={rig.kit} outline={outline} handleRef={rig.handleRef} wear={wearOf(value)} look={value} />
          <SettledMark onSettled={settled} />
        </Suspense>
      </CharacterErrorBoundary>
    )
  };
}

async function renderBare(rig: Rig) {
  const view = await render(rig.element(NO_LOOK));
  await flushAsync();
  expect(rig.handleRef.current !== null).toBe(true);
  const group = rig.handleRef.current!.group;
  return { view, group, baseline: new Set(meshesUnder(group)) };
}

async function wearOn(view: { rerender: (el: ReactElement) => unknown }, rig: Rig, value: Look, outline = 1) {
  await act(async () => {
    await view.rerender(rig.element(value, outline));
  });
  await flushAsync();
}

function bone(group: THREE.Object3D, name: string): THREE.Object3D {
  const found = group.getObjectByName(name);
  expect(found !== undefined).toBe(true);
  return found!;
}

function bonesAreCharacters(mesh: THREE.Mesh, group: THREE.Object3D): boolean {
  const skinned = mesh as THREE.SkinnedMesh;
  if (!skinned.isSkinnedMesh || !skinned.skeleton || skinned.skeleton.bones.length === 0) return false;
  return skinned.skeleton.bones.every((b) => b === group.getObjectByName(b.name) && isAncestor(group, b));
}

function relative(a: THREE.Object3D, b: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().copy(a.matrixWorld).invert().multiply(b.matrixWorld);
}

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4, label: string) {
  const diff = Math.max(...actual.elements.map((v, i) => Math.abs(v - expected.elements[i])));
  expect({ label, close: diff < 1e-5 }).toEqual({ label, close: true });
}

function positionsOf(mesh: THREE.Mesh): number[] {
  return Array.from(mesh.geometry.attributes.position.array as ArrayLike<number>);
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockFrames.clear();
  mockModels.clear();
  mockLoaded.length = 0;
  for (const file of [CHARACTER_FILE, WEAR_FILE]) mockModels.set(file, pendingModel());
  mark("loaded", CHARACTER_FILE);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- R1·R2. 붙는 뼈와 같은 모양 ----------

describe("[spec] 089-⑤ R1·R2: 아이템마다 그 모델이 그 뼈에 붙는다", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it.each([
    ["검정 선글라스", "head", { face: "sunglassesBlack" }, "sunglasses"],
    ["빨강 백팩", "spine", { back: "backpackRed" }, "backpack"],
    ["빨강 머플러", "spine", { accessory: "mufflerRed" }, "muffler"],
    ["금 목걸이", "spine", { accessory: "necklaceGold" }, "necklace"]
  ] as const)("R1 %s: 그 모델 하나와 외곽선만 그려지고 %s 뼈의 자손이다", async (_name, boneName, partial, model) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look(partial));
    const { items, models, unknown } = drawnItems(group, baseline);
    expect(models).toEqual([model]);
    expect(unknown).toEqual([]);
    expect(items[model]!.surface).toHaveLength(1);
    expect(items[model]!.outline).toHaveLength(1);
    const target = bone(group, boneName);
    expect([...items[model]!.surface, ...items[model]!.outline].every((m) => isAncestor(target, m))).toBe(true);
  });

  it.each([
    ["파랑 야구모자", { hat: "capBlue" }, "hatBlue"],
    ["초록 야구모자", { hat: "capGreen" }, "hatGreen"]
  ] as const)("R2 %s: 그 모자 모델 하나가 head 뼈 자손으로 그려지고 다른 모자는 그려지지 않는다", async (_name, partial, model) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look(partial));
    const { items, models } = drawnItems(group, baseline);
    expect(models).toEqual([model]);
    expect(items[model]!.surface).toHaveLength(1);
    expect(items[model]!.surface.every((m) => isAncestor(bone(group, "head"), m))).toBe(true);
  });

  it.each([
    ["흰 티셔츠", "top", "tshirtOrange", "tshirtWhite"],
    ["노랑 티셔츠", "top", "tshirtOrange", "tshirtYellow"],
    ["갈색 반바지", "bottom", "shortsNavy", "shortsBrown"],
    ["빨강 반바지", "bottom", "shortsNavy", "shortsRed"]
  ] as const)("R2 %s: 라룹이 뼈대에 묶인 껍질 하나가 그려지고(부위 %s), 점 수·점 자리가 지금 아이템 %s와 같다", async (_name, slot, base, type) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ [slot]: base }));
    const before = drawnItems(group, baseline).items[slot]!.surface;
    expect(before).toHaveLength(1);
    const basePositions = positionsOf(before[0]);
    await wearOn(view, rig, look({ [slot]: type }));
    const { items, models } = drawnItems(group, baseline);
    expect(models).toEqual([slot]);
    expect(items[slot]!.surface).toHaveLength(1);
    expect(bonesAreCharacters(items[slot]!.surface[0], group)).toBe(true);
    expect(positionsOf(items[slot]!.surface[0])).toEqual(basePositions);
  });

  it.each([
    ["빨강 운동화", "shoesRed"],
    ["흰 운동화", "shoesWhite"]
  ] as const)("R2 %s: 신발 두 짝이 foot_l·foot_r에 하나씩 그려지고, 점 자리가 갈색 운동화와 같다", async (_name, type) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ shoes: "shoesBrown" }));
    const baseShoes = drawnItems(group, baseline).items.shoe!.surface;
    expect(baseShoes).toHaveLength(2);
    const footL = bone(group, "foot_l");
    const footR = bone(group, "foot_r");
    const baseL = positionsOf(baseShoes.find((m) => isAncestor(footL, m))!);
    await wearOn(view, rig, look({ shoes: type }));
    const { items, models } = drawnItems(group, baseline);
    expect(models).toEqual(["shoe"]);
    const shoes = items.shoe!.surface;
    expect(shoes).toHaveLength(2);
    expect(shoes.filter((m) => isAncestor(footL, m))).toHaveLength(1);
    expect(shoes.filter((m) => isAncestor(footR, m))).toHaveLength(1);
    expect(positionsOf(shoes.find((m) => isAncestor(footL, m))!)).toEqual(baseL);
  });
});

// ---------- R3·R4. 색 ----------

describe("[spec] 089-⑤ R3·R4: 아이템의 색(04 결정 B-4)", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it.each([
    ["흰 티셔츠", "f4f0e8", { top: "tshirtWhite" }, "top", 1],
    ["노랑 티셔츠", "f2c440", { top: "tshirtYellow" }, "top", 1],
    ["갈색 반바지", "8a5a3b", { bottom: "shortsBrown" }, "bottom", 1],
    ["빨강 반바지", "c8443a", { bottom: "shortsRed" }, "bottom", 1],
    ["빨강 운동화", "c8443a", { shoes: "shoesRed" }, "shoe", 2],
    ["흰 운동화", "dcd8cf", { shoes: "shoesWhite" }, "shoe", 2]
  ] as const)("R3 %s의 그려진 겉 색은 #%s다", async (_name, color, partial, model, count) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look(partial));
    expect(surfaceColors(group, baseline, model)).toEqual(Array.from({ length: count }, () => color));
  });

  it.each([
    ["주황 야구모자", { hat: "capOrange" }, "hat", 1],
    ["주황 티셔츠", { top: "tshirtOrange" }, "top", 1],
    ["남색 반바지", { bottom: "shortsNavy" }, "bottom", 1],
    ["갈색 운동화", { shoes: "shoesBrown" }, "shoe", 2],
    ["파랑 야구모자", { hat: "capBlue" }, "hatBlue", 1],
    ["초록 야구모자", { hat: "capGreen" }, "hatGreen", 1],
    ["검정 선글라스", { face: "sunglassesBlack" }, "sunglasses", 1],
    ["빨강 백팩", { back: "backpackRed" }, "backpack", 1],
    ["빨강 머플러", { accessory: "mufflerRed" }, "muffler", 1],
    ["금 목걸이", { accessory: "necklaceGold" }, "necklace", 1]
  ] as const)("R3 %s: 모델 색 그대로 그린다", async (_name, partial, model, count) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look(partial));
    expect(surfaceColors(group, baseline, model)).toEqual(Array.from({ length: count }, () => hex(MODEL_COLOR[model])));
  });

  it("R3 색을 칠한 아이템에서 지금 아이템으로 돌아오면 모델 색으로 돌아간다(흰 티셔츠 → 주황 티셔츠, 흰 운동화 → 갈색 운동화)", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ top: "tshirtWhite", shoes: "shoesWhite" }));
    await wearOn(view, rig, look({ top: "tshirtOrange", shoes: "shoesBrown" }));
    expect(surfaceColors(group, baseline, "top")).toEqual([hex(MODEL_COLOR.top)]);
    expect(surfaceColors(group, baseline, "shoe")).toEqual([hex(MODEL_COLOR.shoe), hex(MODEL_COLOR.shoe)]);
  });

  it.each([
    ["상의", "top", ["tshirtOrange", "tshirtWhite", "tshirtYellow"], "top"],
    ["하의", "bottom", ["shortsNavy", "shortsBrown", "shortsRed"], "bottom"],
    ["신발", "shoes", ["shoesBrown", "shoesRed", "shoesWhite"], "shoe"]
  ] as const)("R4 %s 세 아이템의 그려진 색이 서로 다르다", async (_name, slot, types, model) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    const colors: string[] = [];
    for (const type of types) {
      await wearOn(view, rig, look({ [slot]: type }));
      colors.push(surfaceColors(group, baseline, model)[0]);
    }
    expect(new Set(colors).size).toBe(3);
  });
});

// ---------- R6~R8. 바꾸기·한꺼번에·벗기 ----------

describe("[spec] 089-⑤ R6~R8: 같은 부위 바꾸기, 일곱 한꺼번에, 벗기", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it("R6 같은 부위의 다른 아이템으로 바꾸면 벗기를 거치지 않고 바로 새 아이템 하나만 그려진다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange", accessory: "mufflerRed", top: "tshirtOrange", shoes: "shoesBrown" }));
    expect(drawnItems(group, baseline).models).toEqual(["hat", "muffler", "shoe", "top"]);

    await wearOn(view, rig, look({ hat: "capBlue", accessory: "mufflerRed", top: "tshirtOrange", shoes: "shoesBrown" }));
    expect(drawnItems(group, baseline).models).toEqual(["hatBlue", "muffler", "shoe", "top"]);
    expect(surfaceCounts(group, baseline).hatBlue).toBe(1);

    await wearOn(view, rig, look({ hat: "capBlue", accessory: "necklaceGold", top: "tshirtOrange", shoes: "shoesBrown" }));
    expect(drawnItems(group, baseline).models).toEqual(["hatBlue", "necklace", "shoe", "top"]);

    await wearOn(view, rig, look({ hat: "capBlue", accessory: "necklaceGold", top: "tshirtWhite", shoes: "shoesRed" }));
    expect(drawnItems(group, baseline).models).toEqual(["hatBlue", "necklace", "shoe", "top"]);
    expect(surfaceColors(group, baseline, "top")).toEqual(["f4f0e8"]);
    expect(surfaceColors(group, baseline, "shoe")).toEqual(["c8443a", "c8443a"]);
  });

  it("R7 WB(일곱 부위)를 입히면 일곱 아이템이 모두 그려지고(모자 1, 상의 1, 하의 1, 신발 2, 선글라스 1, 백팩 1, 목걸이 1) 색이 R3과 같다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, WB);
    expect(surfaceCounts(group, baseline)).toEqual({ hatGreen: 1, top: 1, bottom: 1, shoe: 2, sunglasses: 1, backpack: 1, necklace: 1 });
    expect(drawnItems(group, baseline).unknown).toEqual([]);
    expect(surfaceColors(group, baseline, "top")).toEqual(["f2c440"]);
    expect(surfaceColors(group, baseline, "bottom")).toEqual(["c8443a"]);
    expect(surfaceColors(group, baseline, "shoe")).toEqual(["dcd8cf", "dcd8cf"]);
  });

  it("R8 WB에서 얼굴장식·등장식·액세서리를 하나씩 빼면 뺀 아이템만 그려지지 않는다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, WB);
    await wearOn(view, rig, { ...WB, face: null });
    expect(drawnItems(group, baseline).models).toEqual(["backpack", "bottom", "hatGreen", "necklace", "shoe", "top"]);
    await wearOn(view, rig, { ...WB, face: null, back: null });
    expect(drawnItems(group, baseline).models).toEqual(["bottom", "hatGreen", "necklace", "shoe", "top"]);
    await wearOn(view, rig, { ...WB, face: null, back: null, accessory: null });
    expect(drawnItems(group, baseline).models).toEqual(["bottom", "hatGreen", "shoe", "top"]);
  });
});

// ---------- R9. 움직임 ----------

type SimSetup = { label: string; frames: ((sim: LobbySim) => void)[] };
const at = (ts: number[], f: (t: number) => (sim: LobbySim) => void) => ts.map(f);
/** 명세의 걷기·앉기·점프(와 서기·깡충). */
const MOTIONS: SimSetup[] = [
  { label: "걷기", frames: at([0, 1, 2, 3], () => (s) => ((s.vx = 2.2), (s.vz = 0.6))) },
  { label: "서기", frames: at([0, 1, 2], () => () => {}) },
  ...(["jump", "hop"] as ActionType[]).map((type) => ({
    label: `동작 ${type}`,
    frames: at([0.15, 0.4, 0.7, 1.0], (t) => (s: LobbySim) => (s.action = { type, t }))
  })),
  { label: "앉는 중", frames: at([0.1, 0.3, 0.5], (t) => (s) => (s.posture = { kind: "sitting-down", t })) },
  { label: "앉아 있기", frames: at([0.2, 1.0, 1.7], (t) => (s) => (s.posture = { kind: "sitting", t })) },
  { label: "일어나기", frames: at([0.1, 0.3, 0.5], (t) => (s) => (s.posture = { kind: "standing-up", t })) }
];

describe("[spec] 089-⑤ R9: 새 아이템은 움직임을 따라간다", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it(
    "R9 WB를 입힌 채 걷기·서기·점프·깡충·앉기의 여러 프레임에서 선글라스의 head 기준, 백팩·목걸이의 spine 기준 자리·방향이 처음과 같다(머플러도 같은 시험)",
    async () => {
      for (const value of [WB, { ...WB, accessory: "mufflerRed" }]) {
        const rig = makeRig();
        const { view, group, baseline } = await renderBare(rig);
        await wearOn(view, rig, value);
        const handle = rig.handleRef.current!;
        const { items } = drawnItems(group, baseline);
        const head = bone(group, "head");
        const spine = bone(group, "spine");
        const pairs: [string, THREE.Object3D, THREE.Mesh][] = [
          ["선글라스", head, items.sunglasses!.surface[0]],
          ["백팩", spine, items.backpack!.surface[0]],
          value.accessory === "mufflerRed" ? ["머플러", spine, items.muffler!.surface[0]] : ["목걸이", spine, items.necklace!.surface[0]]
        ];
        for (const [label, , mesh] of pairs) expect({ label, found: mesh !== undefined }).toEqual({ label, found: true });
        group.updateMatrixWorld(true);
        const rest = pairs.map(([, b, mesh]) => relative(b, mesh));
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
            pairs.forEach(([label, b, mesh], i) => expectSameMatrix(relative(b, mesh), rest[i], `${motion.label}: ${label}`));
            headMoved = Math.max(headMoved, head.getWorldPosition(new THREE.Vector3()).distanceTo(headStart));
          }
        }
        expect(headMoved).toBeGreaterThan(0.05);
      }
    },
    SLOW_TEST_MS
  );
});

// ---------- R10·R11. 명암·외곽선 ----------

describe("[spec] 089-⑤ R10·R11: 카툰 명암과 갈색 외곽선", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it("R10 WB의 새 아이템(선글라스·백팩·목걸이)과 색 바꾼 아이템(초록 모자·노랑 티셔츠·빨강 반바지·흰 운동화)의 겉 재질은 카툰 재질이고 명암 그림을 쓰며 명암 목록에 들어 있다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, WB);
    const { items } = drawnItems(group, baseline);
    for (const model of ["sunglasses", "backpack", "necklace", "hatGreen", "top", "bottom", "shoe"] as Model[]) {
      const surfaces = items[model]?.surface ?? [];
      expect({ model, some: surfaces.length > 0 }).toEqual({ model, some: true });
      for (const m of surfaces) {
        const material = m.material as THREE.MeshToonMaterial;
        expect({ model, gradient: material.gradientMap === rig.kit.gradient, listed: rig.kit.toonMaterials.includes(material) }).toEqual({
          model,
          gradient: true,
          listed: true
        });
      }
    }
  });

  it("R11 새 넷과 색 바꾼 아이템마다 외곽선이 그려지고 색이 0x3d1b0f이며, 굵기 2.0에서 두께가 1.0의 2배다", async () => {
    for (const value of [WB, look({ hat: "capBlue", accessory: "mufflerRed", top: "tshirtWhite", bottom: "shortsBrown", shoes: "shoesRed" })]) {
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig);
      await wearOn(view, rig, value, 1);
      const thin = drawnItems(group, baseline).items;
      const models = (Object.keys(thin) as Model[]).sort();
      const thinValues: Record<string, number[]> = {};
      for (const model of models) {
        const outlines = thin[model]!.outline;
        expect({ model, outlines: outlines.length }).toEqual({ model, outlines: thin[model]!.surface.length });
        for (const m of outlines) expect({ model, color: (m.material as THREE.MeshBasicMaterial).color.getHex() }).toEqual({ model, color: LINE_COLOR });
        thinValues[model] = outlines.map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
        for (const v of thinValues[model]) expect({ model, positive: v > 0 }).toEqual({ model, positive: true });
      }
      await wearOn(view, rig, value, 2);
      const thick = drawnItems(group, baseline).items;
      for (const model of models) {
        const values = thick[model]!.outline.map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
        expect(values.length).toBe(thinValues[model].length);
        values.forEach((v, i) => expect({ model, ratio: Number((v / thinValues[model][i]).toFixed(6)) }).toEqual({ model, ratio: 2 }));
      }
    }
  });
});

// ---------- R12~R15. 누르기, 못 읽을 때, 입지 않음, 모르는 종류 ----------

describe("[spec] 089-⑤ R12~R15", () => {
  function hitsOf(group: THREE.Object3D, origin: THREE.Vector3, direction: THREE.Vector3) {
    group.updateMatrixWorld(true);
    return new THREE.Raycaster(origin, direction.normalize()).intersectObject(group, true);
  }

  it("R12 WB를 입혀도 앞·위·뒤에서 누를 때 맞는 것은 보이지 않는 통뿐이고 새 아이템은 맞지 않는다", async () => {
    mark("loaded", WEAR_FILE);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, WB);
    expect(drawnItems(group, baseline).items.backpack?.surface.length).toBe(1);
    const added = new Set(meshesUnder(group).filter((m) => !baseline.has(m)));
    for (const [origin, direction] of [
      [new THREE.Vector3(0, 0.9, 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0, 0.66, 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0, 0.6, -6), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(0.05, 12, 0.03), new THREE.Vector3(0, -1, 0)]
    ] as const) {
      const hits = hitsOf(group, origin.clone(), direction.clone());
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.filter((h) => added.has(h.object as THREE.Mesh)).length).toBe(0);
      expect(hits.every((h) => (h.object.userData as { isCharacter?: boolean }).isCharacter === true)).toBe(true);
    }
  });

  it("R13 착용 모델만 못 읽으면 빈 것 → WB → 빈 것 → WB로 바꿔도 오류가 밖으로 나오지 않고 라룹이는 그대로이며 메시가 더해지지 않는다", async () => {
    mark("failed", WEAR_FILE);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    for (const value of [WB, NO_LOOK, WB]) {
      await wearOn(view, rig, value);
      expect(rig.handleRef.current!.group === group).toBe(true);
      expect(rig.failed).not.toHaveBeenCalled();
      const primitives = screen.container.queryAll((i: TestInstance) => (i.type as unknown) === "primitive" && i.props.object === group);
      expect(primitives.length).toBe(1);
      expect(meshesUnder(group).filter((m) => !baseline.has(m)).length).toBe(0);
    }
    expect(wearLoads()).toBeGreaterThan(0);
  });

  it("R14 일곱 부위 모두 입지 않으면 그려지는 메시는 몸과 그 외곽선 둘뿐이고 착용 모델을 읽지 않는다", async () => {
    mark("loaded", WEAR_FILE);
    const rig = makeRig();
    const { group } = await renderBare(rig);
    const shown = meshesUnder(group).filter((m) => drawn(m, group));
    expect(shown.length).toBe(2);
    expect(shown.every((m) => m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
    expect(wearLoads()).toBe(0);
  });

  it("R15 모르는 종류(얼굴장식 glassesRound)와 다른 부위 아이템(등장식에 mufflerRed)은 그리지 않고 모자(파랑)만 그린다", async () => {
    mark("loaded", WEAR_FILE);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capBlue", face: "glassesRound", back: "mufflerRed" }));
    expect(surfaceCounts(group, baseline)).toEqual({ hatBlue: 1 });
    expect(drawnItems(group, baseline).unknown).toEqual([]);
  });
});
