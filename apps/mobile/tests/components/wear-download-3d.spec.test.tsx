// [spec] qa 테스트(작업 090-③ 옷 내려받기, 새 기능, 모바일): 받은 목록의 그리기 정보로 라룹이에 옷을 그리는지(C1~C10), 옷 모델을 필요할 때 받아
// 기기에 두고 받는 동안 그 부위 없이 그리다 받으면 입히는지(D1~D7, D10~D12), 목록이 늦게 와도 입히는지(H1).
// 기대값은 시나리오(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/05-옷-내려받기/04-qa-scenarios.md의 C·D·H1)와 같은 폴더 05-main-decision.md에서만 가져온다.
// 테스트 이름 앞의 번호가 시나리오 번호다. 입력 목록은 시나리오의 CAT-W(tests/__fixtures__/wear-files-090.ts의 catW)다.
// 구현 커밋 2c23e2c에서 읽은 것은 부르는 방법뿐이다:
// - 라룹이(Character)의 속성 look(부위 일곱 → 종류)·wear·kit·outline·handleRef, 목록 두기 setItemCatalog(parseItemCatalog(응답)),
//   목록 받기 refreshItemCatalog({ store })(api getItemCatalog를 부른다), 홈이 다시 보일 때 부르는 retryFailedItemFiles().
// - 옷 모델 파일은 item-files가 expo-file-system의 File.downloadFileAsync로 받아 기기에 두고, GLTFLoader().loadAsync(기기 주소)로 읽는다.
// 어떻게 보나(090-① qa 테스트 lobby3d-wear-look.spec과 같은 방법):
// - react-three-fiber만 가짜로 두고, 라룹이 모델은 약속(뼈 이름)을 지키는 가짜다. GLTFLoader.loadAsync는 기기 주소의 파일에 맞는 가짜 한 파일 모델을 준다.
// - 가짜 모델마다 점 수를 달리해 붙은 메시가 어느 모델인지 가린다(HAT_O 24, SHOE 32, TOP 40, BOTTOM 48, HAT_B 56, GLASSES 72, MUFFLER 88,
//   BOWTIE 104, VEST 112, PLAIN 120, 라룹이 몸 54). 신발 모델은 왼쪽 한 짝만 든다. TOP·BOTTOM·VEST는 라룹이와 뼈 순서가 다른 자기 뼈대에 묶였다.
// - "붙은 메시" = 입기 전 라룹이 묶음에 없던 메시. "그려진다" = 자신과 묶음까지의 조상이 모두 visible. "자리 표시 모양이 없다" = 붙은 메시가 받은 모델의 것뿐.
// - 받은 파일과 읽은 모델은 모듈 안에 남으므로 테스트마다 새 해시의 CAT-W를 쓴다.
import { act, render, screen } from "@testing-library/react-native";
import { Suspense, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { getItemCatalog } from "@/lib/api";
import { apiBaseUrl } from "@/lib/env";
import { refreshItemCatalog } from "@/lib/item-catalog";
import { currentItemCatalog, parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { retryFailedItemFiles } from "@/lib/item-files";
import { LobbySim } from "@/lib/lobby3d/engine";
import {
  catW,
  device,
  deviceUri,
  downloadedPaths,
  failDownload,
  fakeRef,
  hold,
  pathOf,
  putOnDevice,
  release,
  resetDevice,
  serve,
  type CatW,
  type CatWModel,
  type FileRef
} from "../__fixtures__/wear-files-090";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;
type MockObject3D = THREE.Object3D;
type MockSkinnedMesh = THREE.SkinnedMesh;
type MockBone = THREE.Bone;

const mockFrames = new Set<FramePart>();
const mockCharacter: { value: unknown } = { value: null };
/** 기기 주소 → 그 파일의 가짜 모델(CAT-W 모델 이름)과 읽기 답. */
const mockFiles = new Map<string, { model: CatWModel; answer: "loaded" | "failed" }>();
/** 읽은 기기 주소(차례대로). */
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

// ---------- 시나리오의 값 ----------

const SLOW_TEST_MS = 60_000;
const LINE_COLOR = 0x3d1b0f;
type Slot = "hat" | "top" | "bottom" | "shoes" | "face" | "back" | "accessory";
type Look = Record<Slot, string | null>;
const NO_LOOK: Look = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const look = (partial: Partial<Look>): Look => ({ ...NO_LOOK, ...partial });

const POINTS: Record<number, CatWModel> = { 24: "HAT_O", 32: "SHOE", 40: "TOP", 48: "BOTTOM", 56: "HAT_B", 72: "GLASSES", 88: "MUFFLER", 104: "BOWTIE", 112: "VEST", 120: "PLAIN" };
const BODY_POINTS = 54;
const MODEL_COLOR = { TOP: "e8590c", BOTTOM: "1f2f5c" };

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

/** 점의 높이로 고른 뼈 이름(가짜 껍질이 점마다 묶인 뼈). */
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
  mesh.name = `qa-rigid-${segments}`;
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
  shell.name = `qa-shell-${segments}`;
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
    case "HAT_B":
      return rigidScene(5, 0x2f6fd0, [0, 1.05, 0]);
    case "GLASSES":
      return rigidScene(7, 0x101014, [0, 0.9, 0.22]);
    case "MUFFLER":
      return rigidScene(9, 0xc0302c, [0, 0.72, 0.05]);
    case "BOWTIE":
      return rigidScene(11, 0x8030a0, [0, 0.7, 0.2]);
    case "VEST":
      return skinnedScene(12, 0x3a7a3a, 0.62, 0.36);
    default:
      return rigidScene(13, 0xe0b040, [0, 0.66, 0.21]);
  }
}

function mockRead(uri: string): Promise<unknown> {
  mockReads.push(uri);
  const file = mockFiles.get(uri);
  if (!file) return Promise.reject(new Error(`테스트가 모르는 기기 파일: ${uri}`));
  if (file.answer === "failed") return Promise.reject(new Error(`깨진 모델(테스트 가짜): ${uri}`));
  const scene = sceneOf(file.model);
  return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} });
}

// ---------- 도우미 ----------

let round = 0;
/** 테스트마다 새 해시의 CAT-W(기기 파일과 가짜 모델의 짝을 적어 둔다). setNow면 바로 목록으로 둔다. */
function newCatW(setNow = true, version?: string): CatW {
  round += 1;
  const cat = catW(`3d-${round}`, version);
  for (const [model, ref] of Object.entries(cat.model) as [CatWModel, FileRef][]) mockFiles.set(deviceUri(ref), { model, answer: "loaded" });
  if (setNow) setItemCatalog(parseItemCatalog(cat.catalog)!);
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

/** 입기 전 baseline에 없던, group 아래에서 그려지는 메시를 모델별로(surface는 카툰 재질, outline은 그 밖). */
function drawnItems(group: THREE.Object3D, baseline: Set<THREE.Mesh>) {
  const items: Partial<Record<CatWModel, { surface: THREE.Mesh[]; outline: THREE.Mesh[] }>> = {};
  const unknown: THREE.Mesh[] = [];
  for (const mesh of meshesUnder(group)) {
    if (baseline.has(mesh) || !drawn(mesh, group)) continue;
    const model = POINTS[mesh.geometry.attributes.position.count];
    if (!model) {
      unknown.push(mesh);
      continue;
    }
    const entry = (items[model] ??= { surface: [], outline: [] });
    entry[isToon(mesh) ? "surface" : "outline"].push(mesh);
  }
  return { items, unknown, models: (Object.keys(items) as CatWModel[]).sort() };
}

function surfaceColors(group: THREE.Object3D, baseline: Set<THREE.Mesh>, model: CatWModel): string[] {
  return (drawnItems(group, baseline).items[model]?.surface ?? []).map((m) => (m.material as THREE.MeshToonMaterial).color.getHexString());
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

interface Rig {
  kit: ToonKit;
  handleRef: MutableRefObject<CharacterHandle | null>;
  failed: jest.Mock;
  element: (value: Look, outline?: number) => ReactElement;
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
    element: (value: Look, outline = 1) => (
      <CharacterErrorBoundary onFailed={rig.failed}>
        <Suspense fallback={null}>
          <Character kit={rig.kit} outline={outline} handleRef={rig.handleRef} wear={wearOf(value)} look={value} />
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

/** 그 파일 받기를 부른 수. */
const requestsOf = (ref: FileRef) => downloadedPaths().filter((path) => path === pathOf(ref.url)).length;
/** 그 파일을 읽은 수. */
const readsOf = (ref: FileRef) => mockReads.filter((uri) => uri === deviceUri(ref)).length;

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-11-14T03:00:00.000Z") });
  resetDevice();
  mockFiles.clear();
  mockReads.length = 0;
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

// ---------- H1(이 파일 맨 앞: 아직 목록이 없는 상태에서 시작한다) ----------

describe("[spec] 090-③ H1: 입은 것이 목록보다 먼저 와도 목록이 오면 입힌다", () => {
  it("H1 목록이 없을 때 hat capOrange를 넘기면 받기·읽기·붙은 메시가 없고, 목록(CAT-W)이 오면 HAT_O를 요청해 받으면 다시 넘기지 않아도 모자를 그린다", async () => {
    expect(currentItemCatalog()).toBeNull();
    const cat = newCatW(false);
    serve(cat.model.HAT_O);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
    expect(drawnItems(group, baseline).models).toEqual([]);

    await act(async () => {
      setItemCatalog(parseItemCatalog(cat.catalog)!);
    });
    await flushAsync();
    expect(requestsOf(cat.model.HAT_O)).toBe(1);
    const { items, models } = drawnItems(group, baseline);
    expect(models).toEqual(["HAT_O"]);
    expect(items.HAT_O!.surface.every((m) => isAncestor(bone(group, "head"), m))).toBe(true);
  });
});

// ---------- C. 그리기 ----------

describe("[spec] 090-③ C: 받은 목록의 그리기 정보로 라룹이에 그린다(파일은 기기에 있음)", () => {
  function allOnDevice(cat: CatW) {
    for (const ref of Object.values(cat.model)) putOnDevice(ref);
  }

  it.each([
    ["capOrange", "hat", "head", "HAT_O"],
    ["sunglassesBlack", "face", "head", "GLASSES"],
    ["mufflerRed", "accessory", "spine", "MUFFLER"],
    ["bowtieQa", "accessory", "spine", "BOWTIE"]
  ] as const)("C1 %s(%s)는 그 모델 메시가 draw의 뼈 %s의 자손이고 그려진다", async (type, slot, boneName, model) => {
    const cat = newCatW();
    allOnDevice(cat);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ [slot]: type }));
    const { items, models } = drawnItems(group, baseline);
    expect(models).toEqual([model]);
    expect(items[model]!.surface.length).toBe(1);
    expect([...items[model]!.surface, ...items[model]!.outline].every((m) => isAncestor(bone(group, boneName), m))).toBe(true);
  });

  it("C2 신발(bone foot_l, mirror foot_r)은 겉 메시가 둘이고 foot_l·foot_r에 하나씩이며, 쉬는 자세에서 두 자리는 x 부호만 반대다. mirror가 없는 capOrange는 겉 메시가 하나다", async () => {
    const cat = newCatW();
    allOnDevice(cat);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ shoes: "shoesBrown" }));
    const shoes = drawnItems(group, baseline).items.SHOE!.surface;
    expect(shoes.length).toBe(2);
    const left = shoes.filter((m) => isAncestor(bone(group, "foot_l"), m));
    const right = shoes.filter((m) => isAncestor(bone(group, "foot_r"), m));
    expect([left.length, right.length]).toEqual([1, 1]);
    group.updateMatrixWorld(true);
    const centre = (m: THREE.Mesh) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
    };
    const l = centre(left[0]);
    const r = centre(right[0]);
    expect(Math.abs(l.x)).toBeGreaterThan(0.01);
    expect({ x: Number((l.x + r.x).toFixed(5)), y: Number((l.y - r.y).toFixed(5)), z: Number((l.z - r.z).toFixed(5)) }).toEqual({ x: 0, y: 0, z: 0 });

    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(drawnItems(group, baseline).items.HAT_O!.surface.length).toBe(1);
  });

  it.each([
    ["tshirtOrange", "TOP"],
    ["vestQa", "VEST"]
  ] as const)(
    "C3 %s(skin)은 라룹이 몸과 같은 뼈대에 묶인 뼈대 메시이고, 점마다 묶인 뼈 이름이 모델 파일의 그 점의 뼈 이름과 같으며, 걷는 동안에도 라룹이 뼈를 따른다",
    async (type, model) => {
      const cat = newCatW();
      allOnDevice(cat);
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig);
      await wearOn(view, rig, look({ top: type }));
      const surfaces = drawnItems(group, baseline).items[model]!.surface;
      expect(surfaces.length).toBe(1);
      const shell = surfaces[0] as THREE.SkinnedMesh;
      expect(shell.isSkinnedMesh).toBe(true);
      expect(bonesAreCharacters(shell, group)).toBe(true);
      const position = shell.geometry.attributes.position;
      const skinIndex = shell.geometry.attributes.skinIndex;
      const mismatched: number[] = [];
      for (let i = 0; i < position.count; i += 1) {
        if (shell.skeleton.bones[skinIndex.getX(i)].name !== boneForPoint(position.getX(i), position.getY(i))) mismatched.push(i);
      }
      expect(mismatched).toEqual([]);
      const head = bone(group, "head");
      const before = head.getWorldPosition(new THREE.Vector3());
      const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
      for (let k = 1; k <= 20; k += 1) {
        sim.vx = 2.2;
        sim.vz = 0.6;
        rig.handleRef.current!.update(sim, 1 / 30, k / 30);
      }
      group.updateMatrixWorld(true);
      expect(head.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(0.001);
      expect(bonesAreCharacters(shell, group)).toBe(true);
    },
    SLOW_TEST_MS
  );

  it("C4 흰 티셔츠는 #F4F0E8, 주황 티셔츠로 바꾸면 모델 색, QA 초록 티는 #3A9A4A, 빨강 반바지는 #C8443A이고, 상의 셋은 같은 TOP 파일이라 TOP 요청은 1건이다", async () => {
    const cat = newCatW();
    serve(cat.model.TOP);
    putOnDevice(cat.model.BOTTOM);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ top: "tshirtWhite" }));
    expect(surfaceColors(group, baseline, "TOP")).toEqual(["f4f0e8"]);
    await wearOn(view, rig, look({ top: "tshirtOrange" }));
    expect(surfaceColors(group, baseline, "TOP")).toEqual([MODEL_COLOR.TOP]);
    await wearOn(view, rig, look({ top: "tshirtGreenQa" }));
    expect(surfaceColors(group, baseline, "TOP")).toEqual(["3a9a4a"]);
    await wearOn(view, rig, look({ top: "tshirtGreenQa", bottom: "shortsRed" }));
    expect(surfaceColors(group, baseline, "BOTTOM")).toEqual(["c8443a"]);
    expect(requestsOf(cat.model.TOP)).toBe(1);
  });

  it("C5 C1~C3 옷의 겉 재질은 카툰 재질이고 명암 그림이 라룹이 것이며 명암 목록에 있다. 외곽선은 색 0x3d1b0f이고 굵기 2.0의 두께가 1.0의 2배다", async () => {
    const cat = newCatW();
    allOnDevice(cat);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    const value = look({ hat: "capOrange", top: "tshirtOrange", shoes: "shoesBrown", accessory: "bowtieQa" });
    await wearOn(view, rig, value, 1);
    const { items, models } = drawnItems(group, baseline);
    expect(models).toEqual(["BOWTIE", "HAT_O", "SHOE", "TOP"]);
    const thin: Record<string, number[]> = {};
    for (const model of models) {
      const entry = items[model]!;
      for (const m of entry.surface) {
        const material = m.material as THREE.MeshToonMaterial;
        expect({ model, toon: isToon(m), gradient: material.gradientMap === rig.kit.gradient, listed: rig.kit.toonMaterials.includes(material) }).toEqual({ model, toon: true, gradient: true, listed: true });
      }
      expect({ model, outlines: entry.outline.length > 0 }).toEqual({ model, outlines: true });
      for (const m of entry.outline) expect({ model, color: (m.material as THREE.MeshBasicMaterial).color.getHex() }).toEqual({ model, color: LINE_COLOR });
      thin[model] = entry.outline.map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
    }
    await wearOn(view, rig, value, 2);
    const after = drawnItems(group, baseline).items;
    for (const model of models) {
      const thick = after[model]!.outline.map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
      expect(thick.length).toBe(thin[model].length);
      thick.forEach((v, i) => expect({ model, ratio: Number((v / thin[model][i]).toFixed(6)) }).toEqual({ model, ratio: 2 }));
    }
  });

  it("C6 일곱 부위를 입혀도 앞·위에서 누를 때 맞는 것은 보이지 않는 통뿐이고 옷 메시는 맞지 않는다", async () => {
    const cat = newCatW();
    allOnDevice(cat);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange", top: "tshirtOrange", bottom: "shortsRed", shoes: "shoesBrown", face: "sunglassesBlack", accessory: "mufflerRed" }));
    const added = new Set(meshesUnder(group).filter((m) => !baseline.has(m)));
    expect(added.size).toBeGreaterThan(0);
    for (const [origin, direction] of [
      [new THREE.Vector3(0, 1, 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0.05, 12, 0.03), new THREE.Vector3(0, -1, 0)],
      [new THREE.Vector3(0.15, 0.7, 6), new THREE.Vector3(0, 0, -1)]
    ] as const) {
      group.updateMatrixWorld(true);
      const hits = new THREE.Raycaster(origin.clone(), direction.clone().normalize()).intersectObject(group, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.filter((h) => added.has(h.object as THREE.Mesh)).length).toBe(0);
      expect(hits.every((h) => (h.object.userData as { isCharacter?: boolean }).isCharacter === true)).toBe(true);
    }
  });

  it("C7·D11 그릴 줄 모르는 옷(hatBody2Qa·clothQa)과 다른 부위에 든 옷(face에 mufflerRed)은 그리지 않고 그 모델을 요청도 읽기도 하지 않으며, 상의만 그린다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.TOP);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "hatBody2Qa", back: "clothQa", face: "mufflerRed", top: "tshirtOrange" }));
    expect(drawnItems(group, baseline).models).toEqual(["TOP"]);
    expect(device.downloads).toEqual([]);
    for (const model of ["HAT2", "CLOTH", "MUFFLER"] as const) expect({ model, reads: readsOf(cat.model[model]) }).toEqual({ model, reads: 0 });
  });

  it("C8 얼굴장식이 goggles면 착용 모델 요청·읽기가 없고, sunglassesBlack이면 선글라스가 head에 붙는다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.GLASSES);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ face: "goggles" }));
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
    expect(drawnItems(group, baseline).models).toEqual([]);
    await wearOn(view, rig, look({ face: "sunglassesBlack" }));
    const glasses = drawnItems(group, baseline).items.GLASSES!.surface;
    expect(glasses.length).toBe(1);
    expect(isAncestor(bone(group, "head"), glasses[0])).toBe(true);
  });

  it("C9 일곱 부위가 null이거나 고글만이면 착용 모델 요청·읽기가 0건이고 라룹이 메시는 몸과 외곽선 둘뿐이다", async () => {
    newCatW();
    const rig = makeRig();
    const { view, group } = await renderBare(rig);
    await wearOn(view, rig, NO_LOOK);
    await wearOn(view, rig, look({ face: "goggles" }));
    expect(device.downloads).toEqual([]);
    expect(mockReads).toEqual([]);
    const shown = meshesUnder(group).filter((m) => drawn(m, group));
    expect(shown.length).toBe(2);
    expect(shown.every((m) => m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
  });

  it("C10 받은 파일이 깨진 모델이면 오류가 밖으로 나오지 않고 라룹이가 그대로 보인다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.HAT_O);
    mockFiles.set(deviceUri(cat.model.HAT_O), { model: "HAT_O", answer: "failed" });
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(readsOf(cat.model.HAT_O)).toBeGreaterThan(0);
    expect(rig.failed).not.toHaveBeenCalled();
    expect(rig.handleRef.current!.group === group).toBe(true);
    expect(screen.container.queryAll((i: TestInstance) => (i.type as unknown) === "primitive" && i.props.object === group).length).toBe(1);
    expect(meshesUnder(group).filter((m) => !baseline.has(m)).length).toBe(0);
  });
});

// ---------- D. 받기와 기기 저장 ----------

describe("[spec] 090-③ D: 옷 모델을 필요할 때 받아 기기에 두고, 받는 동안 그 부위 없이 그린다", () => {
  it("D1 기기에 없는 HAT_O는 목록 url(API 주소에 붙임)로 한 번 요청하고, 받기 전에는 상의만(자리 표시 없이), 받으면 다시 넘기지 않아도 모자를 그리며 기기에 <HAT_O>.glb로 남는다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.TOP);
    hold(cat.model.HAT_O);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange", top: "tshirtOrange" }));
    expect(device.downloads).toEqual([`${apiBaseUrl}${cat.model.HAT_O.url}`]);
    const before = drawnItems(group, baseline);
    expect(before.models).toEqual(["TOP"]);
    expect(before.unknown).toEqual([]);

    await act(async () => {
      release(cat.model.HAT_O);
    });
    await flushAsync();
    const after = drawnItems(group, baseline);
    expect(after.models).toEqual(["HAT_O", "TOP"]);
    expect(after.items.HAT_O!.surface.every((m) => isAncestor(bone(group, "head"), m))).toBe(true);
    expect(device.files.get(`file:///qa-document/item-files/${cat.model.HAT_O.sha256}.glb`)).toBe(cat.model.HAT_O.bytes);
    expect(requestsOf(cat.model.HAT_O)).toBe(1);
  });

  it("D2 기기에 <HAT_O>.glb가 목록 bytes와 같은 크기로 있으면 요청 0건이고 처음 그릴 때부터 모자를 그린다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.HAT_O);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(device.downloads).toEqual([]);
    expect(drawnItems(group, baseline).models).toEqual(["HAT_O"]);
  });

  it("D3 기기의 <HAT_O>.glb 크기가 목록 bytes와 다르면 없는 것으로 보고 HAT_O를 한 번 요청한다", async () => {
    const cat = newCatW();
    putOnDevice(cat.model.HAT_O, cat.model.HAT_O.bytes - 1);
    serve(cat.model.HAT_O);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(requestsOf(cat.model.HAT_O)).toBe(1);
    expect(drawnItems(group, baseline).models).toEqual(["HAT_O"]);
  });

  it("D4 받은 파일 크기가 목록 bytes와 다르면 기기에 남기지 않고 모자를 그리지 않는다", async () => {
    const cat = newCatW();
    serve(cat.model.HAT_O, cat.model.HAT_O.bytes + 5);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(requestsOf(cat.model.HAT_O)).toBe(1);
    expect(device.files.has(deviceUri(cat.model.HAT_O))).toBe(false);
    expect(drawnItems(group, baseline).models).toEqual([]);
  });

  it("D5 받기에 실패하면 모자 없이 그리고 같은 홈 표시 동안에는 다시 요청하지 않으며, 홈이 다시 보이면(retryFailedItemFiles) 한 번 더 요청해 받으면 모자를 그린다", async () => {
    const cat = newCatW();
    failDownload(cat.model.HAT_O);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ hat: "capOrange" }));
    expect(requestsOf(cat.model.HAT_O)).toBe(1);
    expect(drawnItems(group, baseline).models).toEqual([]);
    await wearOn(view, rig, look({ hat: "capOrange" }), 2);
    await wearOn(view, rig, look({ hat: "capOrange" }), 1);
    expect(requestsOf(cat.model.HAT_O)).toBe(1);

    serve(cat.model.HAT_O);
    await act(async () => {
      retryFailedItemFiles();
    });
    await flushAsync();
    expect(requestsOf(cat.model.HAT_O)).toBe(2);
    expect(drawnItems(group, baseline).models).toEqual(["HAT_O"]);
  });

  it("D6 TOP을 받는 동안 상의를 tshirtOrange → tshirtWhite → tshirtGreenQa로 바꿔도 TOP 요청은 1건이고, 신발은 두 발을 그려도 SHOE 요청 1건이다", async () => {
    const cat = newCatW();
    hold(cat.model.TOP);
    serve(cat.model.SHOE);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ top: "tshirtOrange" }));
    await wearOn(view, rig, look({ top: "tshirtWhite" }));
    await wearOn(view, rig, look({ top: "tshirtGreenQa", shoes: "shoesBrown" }));
    await act(async () => {
      release(cat.model.TOP);
    });
    await flushAsync();
    expect(requestsOf(cat.model.TOP)).toBe(1);
    expect(requestsOf(cat.model.SHOE)).toBe(1);
    expect(surfaceColors(group, baseline, "TOP")).toEqual(["3a9a4a"]);
    expect(drawnItems(group, baseline).items.SHOE!.surface.length).toBe(2);
  });

  it("D7(그리기) 미리보기에 넘긴 shortsRed의 BOTTOM이 기기에 없으면 한 번 요청하고, 받기 전에는 하의 없이, 받으면 빨강 반바지(#C8443A)를 그린다", async () => {
    const cat = newCatW();
    hold(cat.model.BOTTOM);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ bottom: "shortsRed" }));
    expect(requestsOf(cat.model.BOTTOM)).toBe(1);
    expect(drawnItems(group, baseline).models).toEqual([]);
    await act(async () => {
      release(cat.model.BOTTOM);
    });
    await flushAsync();
    expect(surfaceColors(group, baseline, "BOTTOM")).toEqual(["c8443a"]);
  });

  it("D10 목록 version이 바뀌어 상의 셋의 모델이 TOP2가 되면 기기의 <TOP>.glb는 지우고 <HAT_O>.glb는 남기며, TOP2를 받기 전 상의 없이, 받으면 상의를 그린다. 목록 받기에 실패한 날은 아무 파일도 지우지 않는다", async () => {
    jest.setSystemTime(new Date("2026-11-20T03:00:00.000Z"));
    const cat = newCatW(true, "w1-d10");
    putOnDevice(cat.model.TOP);
    putOnDevice(cat.model.HAT_O);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ top: "tshirtOrange" }));
    expect(drawnItems(group, baseline).models).toEqual(["TOP"]);

    // 목록 받기 실패: 아무것도 지우지 않는다
    jest.mocked(getItemCatalog).mockRejectedValueOnce(new Error("목록 없음"));
    await act(async () => {
      await refreshItemCatalog({ store: false });
    });
    expect([device.files.has(deviceUri(cat.model.TOP)), device.files.has(deviceUri(cat.model.HAT_O))]).toEqual([true, true]);

    // 다음 날: 상의 셋의 모델만 TOP2로 바뀐 목록
    jest.setSystemTime(new Date("2026-11-21T03:00:00.000Z"));
    const top2 = fakeRef(`3d-${round}-TOP2`, "glb");
    mockFiles.set(deviceUri(top2), { model: "TOP", answer: "loaded" });
    hold(top2);
    const next = JSON.parse(JSON.stringify(cat.catalog)) as CatW["catalog"];
    next.version = "w2-d10";
    for (const item of next.items as { id: string; assets: { model: FileRef } | null }[]) {
      if (["tshirtOrange", "tshirtWhite", "tshirtGreenQa"].includes(item.id)) item.assets!.model = top2;
    }
    jest.mocked(getItemCatalog).mockResolvedValueOnce(next as never);
    await act(async () => {
      await refreshItemCatalog({ store: false });
    });
    await flushAsync();
    expect(device.files.has(deviceUri(cat.model.TOP))).toBe(false);
    expect(device.files.has(deviceUri(cat.model.HAT_O))).toBe(true);
    expect(requestsOf(top2)).toBe(1);
    expect(drawnItems(group, baseline).models).toEqual([]);
    await act(async () => {
      release(top2);
    });
    await flushAsync();
    expect(drawnItems(group, baseline).models).toEqual(["TOP"]);
  });

  it("D12 서버가 더한 vestQa를 입으면 VEST를 한 번 요청하고, 받으면 라룹이 뼈대에 묶인 조끼 껍질을 그린다", async () => {
    const cat = newCatW();
    serve(cat.model.VEST);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, look({ top: "vestQa" }));
    expect(requestsOf(cat.model.VEST)).toBe(1);
    const vest = drawnItems(group, baseline).items.VEST!.surface;
    expect(vest.length).toBe(1);
    expect(bonesAreCharacters(vest[0], group)).toBe(true);
  });
});
