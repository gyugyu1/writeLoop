// [spec] qa 테스트(작업 134 ② 사람형 착용물 연결, 기능 변경, 모바일): 옷을 그리는 동안 그 옷의 hide 기본 메시(본 메시와 외곽선 껍질)를 숨기고,
// 벗거나 바꾸거나 모델이 준비되지 않았거나 그릴 수 없으면 다시 보이게 하는지, 사람형 고글(wear-goggles-human.glb)을 머리 뼈에 그리는지 본다.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/03-사람형-착용물/01-main-spec.md)의 바뀌는 동작 3과 "그대로여야 할 동작"에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(03-qa-tests.md의 분류와 같다).
//
// 어떻게 보나(작업 134 ① lobby3d-player-human-character.spec, 089 lobby3d-goggles-wear.spec과 같은 방법):
// - 진짜 Character를 그린다. react-three-fiber의 useLoader와 GLTFLoader.loadAsync만 가짜다.
// - 가짜 사람형 모델: 실제 파일과 같은 뼈 이름·메시 이름 열한 개(메시마다 다른 모양). 가짜 옷 모델: 뼈대로 휘는 껍질(skin)이나 단단한 덩어리(bone).
// - "그려진다" = 그 메시가 Character 묶음 아래에서 자신과 조상이 모두 visible인 것. 기본 메시 하나는 본 메시와 외곽선 껍질이 같은 geometry를 쓰므로,
//   그 geometry를 쓰고 그려지는 뼈대 메시 수(본 2: 본 메시 하나 + 껍질 하나)로 센다. 숨음 = 0, 보임 = 2.
// 가정: 옷의 hide는 받은 목록 draw.hide 문자열 배열이다. 사람형 고글은 앱 파일 wear-goggles-human.glb(require)를 읽고, 라룹이 wear-goggles.glb는 읽지 않는다.
import { act, render } from "@testing-library/react-native";
import { Suspense, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import type { WearLook } from "@/lib/lobby3d/wear";
import { deviceUri, fakeRef, hold, putOnDevice, release, resetDevice, type FileRef } from "../__fixtures__/wear-files-090";

const mockPlayer: { value: unknown } = { value: null };
const mockGoggles: { value: unknown; fail: boolean } = { value: null, fail: false };
const mockLoaded: string[] = [];
const mockClones: THREE.Object3D[] = [];
/** 기기 주소 → 가짜 옷 모델 종류. 없으면 읽기 실패. */
const mockKinds = new Map<string, Kind>();
type Kind = "skin" | "rigid";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({
  useLoader: (_loader: unknown, url: unknown) => {
    mockLoaded.push(String(url));
    if (String(url) === "player-human.glb") return mockPlayer.value;
    if (String(url) === "wear-goggles-human.glb") {
      if (mockGoggles.fail) throw new Error("고글 모델을 읽지 못함(테스트 가짜)");
      return mockGoggles.value;
    }
    throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
  }
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync(uri: string) {
      return mockRead(uri);
    }
  }
}));
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (source: THREE.Object3D) => {
    const sourceOf = new Map<unknown, THREE.Object3D>();
    const cloneOf = new Map<unknown, THREE.Object3D>();
    const cloned = source.clone(true);
    const walk = (a: THREE.Object3D, b: THREE.Object3D) => {
      sourceOf.set(b, a);
      cloneOf.set(a, b);
      a.children.forEach((child, i) => walk(child, b.children[i]));
    };
    walk(source, cloned);
    cloned.traverse((node) => {
      const skinned = node as THREE.SkinnedMesh;
      if (!skinned.isSkinnedMesh) return;
      const from = sourceOf.get(node) as THREE.SkinnedMesh;
      skinned.skeleton = from.skeleton.clone();
      skinned.bindMatrix.copy(from.bindMatrix);
      skinned.skeleton.bones = from.skeleton.bones.map((bone) => cloneOf.get(bone) as THREE.Bone);
      skinned.bind(skinned.skeleton, skinned.bindMatrix);
    });
    mockClones.push(cloned);
    return cloned;
  }
}));
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/wear-goggles.glb", () => "wear-goggles.glb");
jest.mock("../../assets/models/player-human.glb", () => "player-human.glb", { virtual: true });
jest.mock("../../assets/models/wear-goggles-human.glb", () => "wear-goggles-human.glb", { virtual: true });
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 가짜 모델 ----------

const BONES: [string, string | null, [number, number, number]][] = [
  ["root", null, [0, 0, 0]],
  ["hips", "root", [0, 0.5, 0]],
  ["leg_l", "hips", [0.08, -0.03, 0]],
  ["shin_l", "leg_l", [0, -0.22, 0]],
  ["foot_l", "shin_l", [0, -0.22, 0]],
  ["leg_r", "hips", [-0.08, -0.03, 0]],
  ["shin_r", "leg_r", [0, -0.22, 0]],
  ["foot_r", "shin_r", [0, -0.22, 0]],
  ["spine", "hips", [0, 0.1, 0]],
  ["arm_l", "spine", [0.17, 0.12, 0]],
  ["forearm_l", "arm_l", [0.12, 0, 0]],
  ["hand_l", "forearm_l", [0.12, 0, 0]],
  ["arm_r", "spine", [-0.17, 0.12, 0]],
  ["forearm_r", "arm_r", [-0.12, 0, 0]],
  ["hand_r", "forearm_r", [-0.12, 0, 0]],
  ["head", "spine", [0, 0.28, 0]],
  ["ear_l", "head", [0.13, 0.05, 0]],
  ["ear_r", "head", [-0.13, 0.05, 0]]
];
const MESHES = [
  "body_skin", "bottom_charcoal_cuffs", "brows", "buzz_cut", "eyes", "head_skin", "mouth", "shoe_canvas_l", "shoe_canvas_r", "socks", "top_white_pocket_tee"
];
const TEE = "top_white_pocket_tee";
const SHORTS = "bottom_charcoal_cuffs";
const SHOE_L = "shoe_canvas_l";
const SHOE_R = "shoe_canvas_r";
const SOCKS = "socks";

function makeBones() {
  const byName = new Map<string, THREE.Bone>();
  for (const [name, parent, [x, y, z]] of BONES) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    if (parent) byName.get(parent)!.add(bone);
    byName.set(name, bone);
  }
  return { root: byName.get("root")!, bones: BONES.map(([name]) => byName.get(name)!) };
}

function weighted(geometry: THREE.BufferGeometry, bones: THREE.Bone[]) {
  const count = geometry.attributes.position.count;
  const hips = bones.findIndex((b) => b.name === "hips");
  const skinIndex = new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4);
  const skinWeight = new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4);
  for (let i = 0; i < count; i += 1) {
    skinIndex.setX(i, hips);
    skinWeight.setX(i, 1);
  }
  geometry.setAttribute("skinIndex", skinIndex);
  geometry.setAttribute("skinWeight", skinWeight);
}

function fakePlayer() {
  const { root, bones } = makeBones();
  const scene = new THREE.Group();
  scene.name = "fake-player";
  scene.add(root);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const material = new THREE.MeshStandardMaterial({ map: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) });
  MESHES.forEach((name, k) => {
    const geometry = new THREE.BoxGeometry(0.4 + 0.01 * k, 1, 0.3).translate(0, 0.5, 0);
    weighted(geometry, bones);
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name;
    scene.add(mesh);
    mesh.bind(skeleton);
  });
  const clip = new THREE.AnimationClip("idle", 1, [new THREE.VectorKeyframeTrack("hips.position", [0, 1], [0, 0.5, 0, 0, 0.5, 0])]);
  return { scene, scenes: [scene], animations: [clip], cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 가짜 옷 모델의 점 수(겉 메시를 가려 보려고 종류마다 다르게). */
const SKIN_POINTS = new THREE.BoxGeometry(0.5, 0.4, 0.4, 3, 1, 1).attributes.position.count;
const RIGID_POINTS = new THREE.BoxGeometry(0.2, 0.08, 0.1, 5, 1, 1).attributes.position.count;
const GOGGLES_POINTS = new THREE.BoxGeometry(0.3, 0.08, 0.1, 15, 1, 1).attributes.position.count;

function skinScene() {
  const { root, bones } = makeBones();
  const scene = new THREE.Group();
  scene.add(root);
  const geometry = new THREE.BoxGeometry(0.5, 0.4, 0.4, 3, 1, 1).translate(0, 0.6, 0);
  weighted(geometry, bones);
  const shell = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe8590c }));
  scene.add(shell);
  scene.updateMatrixWorld(true);
  shell.bind(new THREE.Skeleton(bones));
  return scene;
}

function rigidScene() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1, 5, 1, 1), new THREE.MeshStandardMaterial({ color: 0x6b3a1e }));
  mesh.position.set(0.1, 0.04, 0.03);
  const scene = new THREE.Group();
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return scene;
}

function gltfOf(scene: THREE.Group) {
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

function fakeGoggles() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1, 15, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3060c0 }));
  mesh.name = "wear-goggles";
  mesh.position.set(0, 0.9, 0.2);
  const scene = new THREE.Group();
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return gltfOf(scene);
}

function mockRead(uri: string): Promise<unknown> {
  const kind = mockKinds.get(uri);
  if (!kind) return Promise.reject(new Error(`읽지 못함(테스트 가짜): ${uri}`));
  return Promise.resolve(gltfOf(kind === "skin" ? skinScene() : rigidScene()));
}

// ---------- 목록·옷 ----------

interface QaItem {
  id: string;
  slot: string;
  kind: Kind;
  hide?: unknown;
  body?: number;
  attach?: "skin" | "bone";
  bone?: string;
  mirror?: string;
  /** 모델을 기기에 두지 않는다(받는 중이거나 못 받음). */
  notOnDevice?: boolean;
  /** 읽기를 실패시킨다. */
  unreadable?: boolean;
  /** 목록에 모델 파일이 없다. */
  noModel?: boolean;
}

let round = 0;
const refs = new Map<string, FileRef>();

/** 옷들을 받은 목록으로 둔다. 테스트마다 새 해시를 쓴다(받은 파일·읽은 모델이 모듈 안에 남는다). */
function setCatalog(items: QaItem[]) {
  round += 1;
  const list = items.map((item) => {
    const ref = fakeRef(`qa134-2-hide-${round}-${item.id}`, "glb");
    refs.set(item.id, ref);
    if (!item.notOnDevice && !item.noModel) {
      putOnDevice(ref);
      if (!item.unreadable) mockKinds.set(deviceUri(ref), item.kind);
    }
    const attach = item.attach ?? (item.kind === "skin" ? "skin" : "bone");
    const draw: Record<string, unknown> = { attach, body: item.body ?? 2 };
    if (attach === "bone") draw.bone = item.bone ?? "head";
    if (item.mirror) draw.mirror = item.mirror;
    if (item.hide !== undefined) draw.hide = item.hide;
    return {
      id: item.id,
      kind: "wearable",
      name: item.id,
      shopName: item.id,
      description: "",
      category: null,
      slot: item.slot,
      price: null,
      draw,
      assets: item.noModel ? null : { model: ref, icon: null }
    };
  });
  setItemCatalog(parseItemCatalog({ version: `qa134-2-hide-${round}`, items: list })!);
}

const NONE: WearLook = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const look = (partial: Partial<WearLook>): WearLook => ({ ...NONE, ...partial });

// ---------- 그리기 도우미 ----------

function newKit(): ToonKit {
  return { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] } as ToonKit;
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

interface Rig {
  kit: ToonKit;
  handleRef: MutableRefObject<CharacterHandle | null>;
  element: (value: WearLook | undefined) => ReactElement;
}

function makeRig(): Rig {
  const kit = newKit();
  const handleRef: MutableRefObject<CharacterHandle | null> = { current: null };
  const wearOf = (value: WearLook) => ({ hat: value.hat !== null, top: value.top !== null, bottom: value.bottom !== null, shoes: value.shoes !== null });
  return {
    kit,
    handleRef,
    element: (value) => (
      <CharacterErrorBoundary>
        <Suspense fallback={null}>
          {value === undefined ? (
            <Character kit={kit} outline={1} handleRef={handleRef} />
          ) : (
            <Character kit={kit} outline={1} handleRef={handleRef} wear={wearOf(value)} look={value} />
          )}
        </Suspense>
      </CharacterErrorBoundary>
    )
  };
}

async function draw(rig: Rig, value: WearLook | undefined) {
  const view = await render(rig.element(value));
  await flushAsync();
  expect(rig.handleRef.current).not.toBeNull();
  return view;
}

async function redraw(view: { rerender: (el: ReactElement) => unknown }, rig: Rig, value: WearLook | undefined) {
  await act(async () => {
    await view.rerender(rig.element(value));
  });
  await flushAsync();
}

function drawn(object: THREE.Object3D, group: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
    if (current === group) return true;
  }
  return false;
}

function skinnedUnder(group: THREE.Object3D): THREE.SkinnedMesh[] {
  const list: THREE.SkinnedMesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) list.push(o as THREE.SkinnedMesh);
  });
  return list;
}

function meshesUnder(group: THREE.Object3D): THREE.Mesh[] {
  const list: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh);
  });
  return list;
}

/** 기본 메시 이름마다 그려지는 뼈대 메시 수(본 메시 + 외곽선 껍질. 보임 2, 숨음 0). */
function shownCounts(rig: Rig): Record<string, number> {
  const group = rig.handleRef.current!.group;
  const model = mockClones[mockClones.length - 1];
  const result: Record<string, number> = {};
  for (const name of MESHES) {
    const source = model.getObjectByName(name) as THREE.SkinnedMesh;
    result[name] = skinnedUnder(group).filter((m) => m.geometry === source.geometry && drawn(m, group)).length;
  }
  return result;
}

/** 지금 이 hidden 이름들만 숨고 나머지 기본 메시는 모두 보인다. */
function expectOnlyHidden(rig: Rig, hidden: string[]) {
  const expected: Record<string, number> = {};
  for (const name of MESHES) expected[name] = hidden.includes(name) ? 0 : 2;
  expect(shownCounts(rig)).toEqual(expected);
}

/** 그려지는 옷 모델 메시 수(점 수로 가린다. 뼈대 껍질은 겉·외곽선 둘, 단단한 덩어리는 신발처럼 뼈마다 겉·외곽선). */
function drawnPieces(rig: Rig, points: number): number {
  const group = rig.handleRef.current!.group;
  return meshesUnder(group).filter((m) => m.geometry.attributes.position.count === points && drawn(m, group)).length;
}

function hasAncestorNamed(object: THREE.Object3D, name: string): boolean {
  for (let current: THREE.Object3D | null = object.parent; current; current = current.parent) if (current.name === name) return true;
  return false;
}

let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  resetDevice();
  mockKinds.clear();
  mockLoaded.length = 0;
  mockClones.length = 0;
  mockPlayer.value = fakePlayer();
  mockGoggles.value = fakeGoggles();
  mockGoggles.fail = false;
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------- 숨김 ----------

describe("[spec] 134-② 옷을 그리는 동안 그 옷의 hide 기본 메시를 숨긴다(본 메시와 외곽선 껍질 모두)", () => {
  it("[그대로] 아무것도 입지 않으면(look 없음·look 모두 null) 기본 메시 열한 개가 모두 보인다(본 메시와 껍질 각각)", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE] }]);
    const rigA = makeRig();
    await draw(rigA, undefined);
    expectOnlyHidden(rigA, []);
    const rigB = makeRig();
    await draw(rigB, look({}));
    expectOnlyHidden(rigB, []);
  });

  it("[그대로] hide가 없는 상의는 그려지고 기본 메시는 하나도 숨지 않는다(옷 그리기 자체는 지금 그대로)", async () => {
    setCatalog([{ id: "qaPlainTop", slot: "top", kind: "skin" }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaPlainTop" }));
    expectOnlyHidden(rig, []);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(2);
  });

  it("[바뀔] 상의를 그리는 동안 hide의 티셔츠만 숨고(본 메시와 껍질 둘 다), 나머지 열 개는 보이며, 옷 모델은 그려진다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE] }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(2);
  });

  it("[바뀔] 하의(반바지)는 반바지만 숨긴다", async () => {
    setCatalog([{ id: "qaShorts", slot: "bottom", kind: "skin", hide: [SHORTS] }]);
    const rig = makeRig();
    await draw(rig, look({ bottom: "qaShorts" }));
    expectOnlyHidden(rig, [SHORTS]);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(2);
  });

  it("[바뀔] 신발은 운동화 두 짝을 숨기고 양말은 남긴다. 신발은 왼쪽·오른쪽 둘이 그려진다", async () => {
    setCatalog([{ id: "qaShoe", slot: "shoes", kind: "rigid", bone: "foot_l", mirror: "foot_r", hide: [SHOE_L, SHOE_R] }]);
    const rig = makeRig();
    await draw(rig, look({ shoes: "qaShoe" }));
    expectOnlyHidden(rig, [SHOE_L, SHOE_R]);
    expect(drawnPieces(rig, RIGID_POINTS)).toBe(4);
  });

  it("[바뀔] 전투화는 운동화 두 짝과 양말을 숨긴다", async () => {
    setCatalog([{ id: "qaBoot", slot: "shoes", kind: "rigid", bone: "foot_l", mirror: "foot_r", hide: [SHOE_L, SHOE_R, SOCKS] }]);
    const rig = makeRig();
    await draw(rig, look({ shoes: "qaBoot" }));
    expectOnlyHidden(rig, [SHOE_L, SHOE_R, SOCKS]);
  });

  it("[그대로] hide가 없거나 빈 배열인 옷(모자)을 입어도 기본 메시는 하나도 숨지 않는다. 옷은 그려진다", async () => {
    setCatalog([
      { id: "qaHatNone", slot: "hat", kind: "rigid" },
      { id: "qaAccEmpty", slot: "accessory", kind: "rigid", bone: "spine", hide: [] }
    ]);
    const rig = makeRig();
    await draw(rig, look({ hat: "qaHatNone", accessory: "qaAccEmpty" }));
    expectOnlyHidden(rig, []);
    expect(drawnPieces(rig, RIGID_POINTS)).toBe(4);
  });

  it("[바뀔] 여러 부위를 함께 입으면 각 옷의 hide가 모두 숨는다", async () => {
    setCatalog([
      { id: "qaTee", slot: "top", kind: "skin", hide: [TEE] },
      { id: "qaShorts", slot: "bottom", kind: "skin", hide: [SHORTS] },
      { id: "qaBoot", slot: "shoes", kind: "rigid", bone: "foot_l", mirror: "foot_r", hide: [SHOE_L, SHOE_R, SOCKS] },
      { id: "qaHat", slot: "hat", kind: "rigid" }
    ]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee", bottom: "qaShorts", shoes: "qaBoot", hat: "qaHat" }));
    expectOnlyHidden(rig, [TEE, SHORTS, SHOE_L, SHOE_R, SOCKS]);
  });

  it("[바뀔] hide에 모델에 없는 이름이 들어 있어도 오류 없이 있는 이름만 숨기고, 다른 메시는 숨지 않는다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: ["no_such_mesh", TEE] }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(2);
  });

  it("[바뀔] hide에 문자열이 아닌 값이 섞여도 그 값은 무시하고 문자열 이름은 숨긴다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [7, null, TEE, { a: 1 }] }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
  });
});

describe("[spec] 134-② 옷을 벗거나 바꾸면 기본 메시가 다시 보인다", () => {
  it("[바뀔] 입었다가 벗으면(look의 그 부위 null) 티셔츠가 다시 보인다. 다시 입으면 또 숨는다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE] }]);
    const rig = makeRig();
    const view = await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
    await redraw(view, rig, look({}));
    expectOnlyHidden(rig, []);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(0);
    await redraw(view, rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
  });

  it("[바뀔] 다른 옷으로 바꾸면 그 옷의 hide를 따른다: 티셔츠 숨김 → 양말만 숨기는 옷으로 바꾸면 티셔츠가 다시 보이고 양말이 숨는다", async () => {
    setCatalog([
      { id: "qaTee", slot: "top", kind: "skin", hide: [TEE] },
      { id: "qaOther", slot: "top", kind: "skin", hide: [SOCKS] }
    ]);
    const rig = makeRig();
    const view = await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
    await redraw(view, rig, look({ top: "qaOther" }));
    expectOnlyHidden(rig, [SOCKS]);
  });

  it("[그대로] hide가 없는 옷으로 바꾸면 숨었던 것이 모두 보인다", async () => {
    setCatalog([
      { id: "qaTee", slot: "top", kind: "skin", hide: [TEE] },
      { id: "qaPlain", slot: "top", kind: "skin" }
    ]);
    const rig = makeRig();
    const view = await draw(rig, look({ top: "qaTee" }));
    await redraw(view, rig, look({ top: "qaPlain" }));
    expectOnlyHidden(rig, []);
  });

  it("[바뀔] 같은 메시를 숨기는 옷이 둘이면 하나라도 그리는 동안 숨고, 둘 다 벗으면 보인다", async () => {
    setCatalog([
      { id: "qaTee", slot: "top", kind: "skin", hide: [TEE] },
      { id: "qaScarf", slot: "accessory", kind: "rigid", bone: "spine", hide: [TEE, SOCKS] }
    ]);
    const rig = makeRig();
    const view = await draw(rig, look({ top: "qaTee", accessory: "qaScarf" }));
    expectOnlyHidden(rig, [TEE, SOCKS]);
    await redraw(view, rig, look({ accessory: "qaScarf" }));
    expectOnlyHidden(rig, [TEE, SOCKS]);
    await redraw(view, rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, [TEE]);
    await redraw(view, rig, look({}));
    expectOnlyHidden(rig, []);
  });
});

describe("[spec] 134-② 모델 파일이 아직 준비되지 않았거나 그릴 수 없으면 기본 메시가 보인다", () => {
  it("[바뀔] 모델 파일을 받는 동안은 보이고, 받아서 그려지면 숨는다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE], notOnDevice: true }]);
    const ref = refs.get("qaTee")!;
    hold(ref);
    mockKinds.set(deviceUri(ref), "skin");
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, []);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(0);
    await act(async () => {
      release(ref);
    });
    await flushAsync();
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(2);
    expectOnlyHidden(rig, [TEE]);
  });

  it("[그대로] 모델 파일을 받지 못하면 보인다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE], notOnDevice: true }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, []);
  });

  it("[그대로] 기기에 있는 모델 파일을 읽지 못하면 기본 메시가 보인다(숨기고 옷도 안 그려지는 일이 없다)", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE], unreadable: true }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaTee" }));
    expectOnlyHidden(rig, []);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(0);
  });

  it("[그대로] 그릴 줄 모르는 옷(몸판 1)은 hide가 있어도 기본 메시를 숨기지 않는다", async () => {
    setCatalog([{ id: "qaOldBody", slot: "top", kind: "skin", hide: [TEE], body: 1 }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaOldBody" }));
    expectOnlyHidden(rig, []);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(0);
  });

  it("[그대로] 목록에 모델 파일이 없는 옷이나 목록에 없는 종류는 기본 메시를 숨기지 않는다", async () => {
    setCatalog([{ id: "qaNoModel", slot: "top", kind: "skin", hide: [TEE], noModel: true }]);
    const rig = makeRig();
    await draw(rig, look({ top: "qaNoModel", bottom: "qaNotInList" }));
    expectOnlyHidden(rig, []);
  });
});

// ---------- 사람형 고글 ----------

describe("[spec] 134-② 사람형 고글: 얼굴장식이 goggles이면 앱 파일 wear-goggles-human.glb를 머리 뼈에 그린다", () => {
  function goggleMeshes(rig: Rig) {
    const group = rig.handleRef.current!.group;
    return meshesUnder(group).filter((m) => m.geometry.attributes.position.count === GOGGLES_POINTS && drawn(m, group));
  }

  it("[바뀔] 얼굴장식이 goggles이면 wear-goggles-human.glb를 읽고(라룹이 wear-goggles.glb는 읽지 않고) 겉·외곽선 하나씩을 머리 뼈 아래에 그린다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE] }]);
    const rig = makeRig();
    await draw(rig, look({ face: "goggles" }));
    expect(mockLoaded).toContain("wear-goggles-human.glb");
    expect(mockLoaded).not.toContain("wear-goggles.glb");
    const meshes = goggleMeshes(rig);
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) expect(hasAncestorNamed(mesh, "head")).toBe(true);
    const toon = meshes.filter((m) => (m.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial === true);
    expect(toon).toHaveLength(1);
  });

  it("[바뀔] 서버 목록이 없어도(받지 못한 상태) 얼굴장식이 goggles이면 그린다", async () => {
    const rig = makeRig();
    await draw(rig, look({ face: "goggles" }));
    expect(goggleMeshes(rig)).toHaveLength(2);
  });

  it("[그대로] 고글은 기본 메시를 숨기지 않는다", async () => {
    const rig = makeRig();
    await draw(rig, look({ face: "goggles" }));
    expectOnlyHidden(rig, []);
  });

  it("[바뀔] 얼굴장식을 goggles에서 없음으로 바꾸면 고글이 그려지지 않는다", async () => {
    const rig = makeRig();
    const view = await draw(rig, look({ face: "goggles" }));
    expect(goggleMeshes(rig)).toHaveLength(2);
    await redraw(view, rig, look({}));
    expect(goggleMeshes(rig)).toHaveLength(0);
  });

  it("[그대로] 얼굴장식이 없거나 입은 것을 모르면(look 없음) 고글을 읽지도 그리지도 않는다(기본으로 씌우지 않는다)", async () => {
    const rigA = makeRig();
    await draw(rigA, undefined);
    const rigB = makeRig();
    await draw(rigB, look({}));
    expect(mockLoaded).not.toContain("wear-goggles-human.glb");
    expect(mockLoaded).not.toContain("wear-goggles.glb");
    expect(goggleMeshes(rigA)).toHaveLength(0);
    expect(goggleMeshes(rigB)).toHaveLength(0);
  });

  it("[그대로] 얼굴장식이 다른 옷(선글라스)이면 고글 파일을 읽지 않는다", async () => {
    setCatalog([{ id: "qaGlasses", slot: "face", kind: "rigid" }]);
    const rig = makeRig();
    await draw(rig, look({ face: "qaGlasses" }));
    expect(mockLoaded).not.toContain("wear-goggles-human.glb");
    expect(mockLoaded).not.toContain("wear-goggles.glb");
    expect(goggleMeshes(rig)).toHaveLength(0);
    expect(drawnPieces(rig, RIGID_POINTS)).toBe(2);
  });

  it("[바뀔] 고글을 읽지 못해도 다른 옷은 그대로 그려지고 그 옷의 기본 메시 숨김도 유지된다", async () => {
    setCatalog([{ id: "qaTee", slot: "top", kind: "skin", hide: [TEE] }]);
    mockGoggles.fail = true;
    const rig = makeRig();
    await draw(rig, look({ face: "goggles", top: "qaTee" }));
    expect(goggleMeshes(rig)).toHaveLength(0);
    expect(drawnPieces(rig, SKIN_POINTS)).toBe(2);
    expectOnlyHidden(rig, [TEE]);
  });
});
