// [spec] qa 테스트(작업 089 ① 착용 기술 시험, 새 기능, 모바일): 신발이 한 짝(wear-shoe-l)만 든 착용 모델에서 오른쪽 신발 경로.
// 12-main-decision.md(사용자 결정 "qa가 더함", 2026-11-13)대로 더한 테스트다. 이미 있는 동작을 지키는 테스트라 지금 구현(f6fb055)에서 통과가 맞다.
// 기대값은 시나리오(03-qa-scenarios.md W2·W6·T2)와 결정 12의 세 항목에서만 가져온다.
//   - 오른쪽 신발이 foot_r 뼈의 자손이고, 신발을 입으면 그려진다(W2: 신발 메시가 둘이고 foot_l·foot_r에 하나씩).
//   - 움직일 때(W6의 동작) foot_r 기준 자리·방향이 처음과 같다.
//   - 오른쪽 신발에도 라룹이와 같은 외곽선이 있고 굵기 설정을 따른다(T2: 색 0x3d1b0f, 굵기 2.0배에서 두께가 1.0배의 2배).
// 구현에서 읽은 것은 부르는 방법뿐이다: Character의 wear·kit·outline·handleRef, 착용 모델 안 이름(wear-hat, wear-shoe-l, wear-top, wear-bottom),
// 외곽선 재질이 셰이더 uniform outlineThickness로 굵기를 넣는 것.
// 구성(가짜 r3f useLoader, three의 SkeletonUtils.clone과 같은 방법의 가짜, 약속을 지키는 가짜 라룹이)은 lobby3d-wear-character.spec과 같다.
// 그 파일의 가짜 착용 모델은 두 짝이라 오른쪽 신발을 왼쪽에서 만드는 경로를 지나지 않는다(11-qa-verify 확실한 문제 1). 이 파일의 가짜는 실제 파일처럼 왼쪽 한 짝만 든다.
// 왼쪽 신발은 좌우가 다른 자리(x = 0.1)에 두어, 오른발 쪽 신발이 왼발 쪽과 같은 메시를 그대로 옮긴 것이 아니어도 판정이 같게 했다.
import { act, render } from "@testing-library/react-native";
import { Suspense, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { LobbySim, type ActionType } from "@/lib/lobby3d/engine";
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정 "qa가 새 동작에 맞게 고침"): 옷의 그리기 정보(붙이는 방식·뼈·뒤집을 뼈·색·몸 판)는
// 받은 아이템 목록에서만 읽고, 모델은 옷마다 서버 파일을 기기에 받아 GLTFLoader.loadAsync(기기 주소)로 읽는다(앱의 착용 모델 묶음은 쓰지 않는다).
// 그래서 테스트마다 서버 목록 파일과 같은 draw의 옷으로 목록을 두고(파일 참조는 테스트마다 새 해시: 읽은 모델이 모듈 안에 남기 때문),
// 그 파일을 기기에 둔 상태로 시작한다. 가짜 GLTFLoader는 기기 주소의 파일 이름(wear-hat.glb 등)에 맞는 노드만 이 파일의 가짜 착용 모델에서 꺼내
// 한 파일 모델로 준다(신발은 서버 파일처럼 왼쪽 한 짝). 읽기 상태(읽는 중·읽음·못 읽음)는 지금처럼 WEAR_FILE의 상태를 따르고, 읽을 때마다 WEAR_FILE을 적는다.
// 단언·입력은 바꾸지 않았다.
import { parseItemCatalog as qaParseCatalog, setItemCatalog as qaSetCatalog } from "@/lib/item-catalog-store";
import { deviceUri, fakeRef, putOnDevice, rawServerItems, resetDevice, serverWearable } from "../__fixtures__/wear-files-090";

type ModelStatus = "pending" | "loaded" | "failed";
interface MockModel {
  status: ModelStatus;
  value: unknown;
  error: Error | null;
}

const mockModels = new Map<string, MockModel>();
/** 090-③: 가짜 GLTFLoader가 읽을 때마다 적는다(이 파일은 읽은 수를 단언하지 않는다). */
const mockLoaded: string[] = [];
type MockObject3D = THREE.Object3D;
type MockSkinnedMesh = THREE.SkinnedMesh;
type MockBone = THREE.Bone;

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({
  useLoader: (_loader: unknown, url: unknown) => {
    const model = mockModels.get(String(url));
    if (!model) throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
    if (model.status === "loaded") return model.value;
    if (model.status === "failed") throw model.error;
    throw new Promise(() => {});
  }
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync(uri: string) {
      return mockLoadWear(uri);
    }
  }
}));
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
// three의 SkeletonUtils.clone과 같은 방법: 나무를 복제하고, 뼈대로 휘는 메시는 복제한 뼈로 다시 묶는다
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
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/lobby-wearables.glb", () => "lobby-wearables.glb");

// ---------- 고정 값 ----------

const CHARACTER_FILE = "writeloop.glb";
const WEAR_FILE = "lobby-wearables.glb";
const LINE_COLOR = 0x3d1b0f;
/** 가짜 신발의 점 수(BoxGeometry 2×1×1 나눔). 다른 아이템·몸과 겹치지 않는다. */
const SHOE_POINTS = 32;
const SLOW_TEST_MS = 60_000;

type Slot = "hat" | "top" | "bottom" | "shoes";
type Wear = Record<Slot, boolean>;
const NONE: Wear = { hat: false, top: false, bottom: false, shoes: false };
const ALL: Wear = { hat: true, top: true, bottom: true, shoes: true };
const SHOES: Wear = { ...NONE, shoes: true };

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

/** 클립마다 머리·척추를 돌리고 엉덩이·두 발을 옮기며 오른발을 돌리는 2초 클립. */
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
      new THREE.QuaternionKeyframeTrack("foot_r.quaternion", [0, 1, 2], quat(q0, q1, q2)),
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

/** 실제 착용 모델처럼 신발은 왼쪽 한 짝(wear-shoe-l)만 든 가짜. */
function fakeWearablesOneShoe() {
  const scene = new THREE.Group();
  const order = [...BONE_TREE.map(([name]) => name)].reverse();
  const { root, bones } = makeBones(order);
  scene.add(root);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xd9480f }));
  hat.name = "wear-hat";
  hat.position.set(0, 1.05, 0);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.2, 2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x6b3a1e }));
  shoeL.name = "wear-shoe-l";
  shoeL.position.set(0.1, 0.04, 0.03);
  const top = skinnedBox(new THREE.BoxGeometry(0.55, 0.4, 0.45, 3, 1, 1).translate(0, 0.6, 0), bones, new THREE.MeshStandardMaterial({ color: 0xe8590c }));
  top.name = "wear-top";
  const bottom = skinnedBox(new THREE.BoxGeometry(0.55, 0.3, 0.45, 4, 1, 1).translate(0, 0.3, 0), bones, new THREE.MeshStandardMaterial({ color: 0x1f2f5c }));
  bottom.name = "wear-bottom";
  scene.add(hat, shoeL, top, bottom);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  top.bind(skeleton);
  bottom.bind(skeleton);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
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

function isToon(mesh: THREE.Mesh): boolean {
  return (mesh.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial === true;
}

/** 입기 전에 없던, 신발 점 수의 메시들(겉·외곽선). */
function addedShoes(group: THREE.Object3D, baseline: Set<THREE.Mesh>) {
  const shoes = meshesUnder(group).filter((m) => !baseline.has(m) && m.geometry.attributes.position.count === SHOE_POINTS);
  return { surface: shoes.filter(isToon), outline: shoes.filter((m) => !isToon(m)) };
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

function bone(group: THREE.Object3D, name: string): THREE.Object3D {
  const found = group.getObjectByName(name);
  expect(found !== undefined).toBe(true);
  return found!;
}

function relative(a: THREE.Object3D, b: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().copy(a.matrixWorld).invert().multiply(b.matrixWorld);
}

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4, label: string) {
  const diff = Math.max(...actual.elements.map((v, i) => Math.abs(v - expected.elements[i])));
  expect({ label, close: diff < 1e-5 }).toEqual({ label, close: true });
}

interface Rig {
  handleRef: MutableRefObject<CharacterHandle | null>;
  failed: jest.Mock;
  element: (wear: Wear, outline?: number) => ReactElement;
}

function makeRig(): Rig {
  const kit: ToonKit = { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] };
  const handleRef = { current: null } as MutableRefObject<CharacterHandle | null>;
  const failed = jest.fn();
  return {
    handleRef,
    failed,
    element: (wear: Wear, outline = 1) => (
      <CharacterErrorBoundary onFailed={failed}>
        <Suspense fallback={null}>
          <Character kit={kit} outline={outline} handleRef={handleRef} wear={wear} />
        </Suspense>
      </CharacterErrorBoundary>
    )
  };
}

async function renderBare(rig: Rig) {
  const view = await render(rig.element(NONE));
  await flushAsync();
  expect(rig.handleRef.current !== null).toBe(true);
  const group = rig.handleRef.current!.group;
  return { view, group, baseline: new Set(meshesUnder(group)) };
}

async function wearOn(view: { rerender: (el: ReactElement) => unknown }, rig: Rig, wear: Wear, outline = 1) {
  await act(async () => {
    await view.rerender(rig.element(wear, outline));
  });
  await flushAsync();
}

type SimSetup = { label: string; frames: ((sim: LobbySim) => void)[] };
const at = (ts: number[], f: (t: number) => (sim: LobbySim) => void) => ts.map(f);

/** 시나리오 W6의 움직임: 걷기, 서기, 동작 시험 여섯, 오래 쉬어 앉기, 들어가기 동작 셋(생각하기·의자에 앉기·책 꺼내기). */
const MOTIONS: SimSetup[] = [
  { label: "걷기", frames: at([0, 1, 2, 3], () => (s) => ((s.vx = 2.2), (s.vz = 0.6))) },
  { label: "서기", frames: at([0, 1, 2], () => () => {}) },
  ...(["wave", "jump", "hop", "point", "spin", "look"] as ActionType[]).map((type) => ({
    label: `동작 ${type}`,
    frames: at([0.15, 0.4, 0.7, 1.0], (t) => (s: LobbySim) => (s.action = { type, t }))
  })),
  { label: "앉는 중", frames: at([0.1, 0.3, 0.5], (t) => (s) => (s.posture = { kind: "sitting-down", t })) },
  { label: "앉아 있기", frames: at([0.2, 1.0, 1.7], (t) => (s) => (s.posture = { kind: "sitting", t })) },
  { label: "일어나기", frames: at([0.1, 0.3, 0.5], (t) => (s) => (s.posture = { kind: "standing-up", t })) },
  ...(
    [
      ["생각하기", "think", "board"],
      ["의자에 앉기", "chair", "desk"],
      ["책 꺼내기", "book", "bookcase"]
    ] as const
  ).flatMap(([label, kind, markId]) =>
    (["in", "hold", "out"] as const).map((phase) => ({
      label: `${label} ${phase}`,
      frames: at([0.2, 0.7, 1.1], (t) => (s: LobbySim) => (s.scene = { kind, mark: markId, phase, t }))
    }))
  )
];

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

// ---------- 090-③: 받은 목록의 옷과 옷마다 받은 모델 파일 ----------

/** 서버 모델 파일 이름 → 이 파일의 가짜 착용 모델 안 노드 이름(신발은 왼쪽 한 짝). */
const WEAR_NODES: Record<string, string> = {
  "wear-hat.glb": "wear-hat",
  "wear-hat-blue.glb": "wear-hat-blue",
  "wear-hat-green.glb": "wear-hat-green",
  "wear-top.glb": "wear-top",
  "wear-bottom.glb": "wear-bottom",
  "wear-shoe.glb": "wear-shoe-l",
  "wear-sunglasses.glb": "wear-sunglasses",
  "wear-backpack.glb": "wear-backpack",
  "wear-muffler.glb": "wear-muffler",
  "wear-necklace.glb": "wear-necklace"
};
const WEAR_IDS = ["capOrange","tshirtOrange","shortsNavy","shoesBrown"];
/** 기기 주소 → 서버 모델 파일 이름. */
const mockWearFiles = new Map<string, string>();
let wearRound = 0;

/** 서버 목록 파일과 같은 draw의 옷으로 목록을 두고, 테스트마다 새 해시의 모델 파일을 기기에 둔다. */
function setWearCatalog() {
  wearRound += 1;
  resetDevice();
  mockWearFiles.clear();
  const raw = rawServerItems();
  const items = WEAR_IDS.map((id) => {
    const file = raw.find((item) => item.id === id)!.files!.model!;
    const ref = fakeRef(`lobby3d-wear-right-shoe-${file}-${wearRound}`, "glb");
    putOnDevice(ref);
    mockWearFiles.set(deviceUri(ref), file);
    return { ...serverWearable(id), assets: { model: ref, icon: null } };
  });
  qaSetCatalog(qaParseCatalog({ version: `qa-090-3-${wearRound}`, items })!);
}

/** 한 파일 모델: 이 파일의 가짜 착용 모델에서 그 노드만(뼈대로 휘는 껍질이면 뼈대도) 꺼낸다. */
function mockWearScene(file: string) {
  const bundle = fakeWearablesOneShoe().scene;
  const scene = new THREE.Group();
  const node = bundle.getObjectByName(WEAR_NODES[file] ?? "");
  if (node) {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) scene.add(bundle.children[0]);
    scene.add(node);
  }
  scene.updateMatrixWorld(true);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 가짜 GLTFLoader.loadAsync: 착용 모델의 읽기 상태(WEAR_FILE)를 따른다. */
function mockLoadWear(uri: string): Promise<unknown> {
  mockLoaded.push(WEAR_FILE);
  const file = mockWearFiles.get(uri);
  const model = mockModels.get(WEAR_FILE);
  if (!file || !model) return Promise.reject(new Error(`테스트가 모르는 착용 모델 파일: ${uri}`));
  const settle = (): Promise<unknown> => (model.status === "loaded" ? Promise.resolve(mockWearScene(file)) : Promise.reject(model.error ?? new Error("읽지 못했다(테스트 가짜)")));
  if (model.status === "pending") return (model as unknown as { promise: Promise<void> }).promise.then(settle);
  return settle();
}

beforeEach(() => {
  setWearCatalog();
  mockModels.clear();
  mockModels.set(CHARACTER_FILE, { status: "loaded", value: fakeCharacter(), error: null });
  mockModels.set(WEAR_FILE, { status: "loaded", value: fakeWearablesOneShoe(), error: null });
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("[spec] 신발이 한 짝만 든 착용 모델에서 오른쪽 신발(12 결정)", () => {
  it("W2(한 짝 모델): 신발을 입히면 신발 겉 메시가 둘이고, 오른쪽 신발은 foot_r, 왼쪽 신발은 foot_l의 자손이며 둘 다 그려진다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, SHOES);
    const { surface } = addedShoes(group, baseline);
    expect(surface.length).toBe(2);
    const right = surface.filter((m) => isAncestor(bone(group, "foot_r"), m));
    const left = surface.filter((m) => isAncestor(bone(group, "foot_l"), m));
    expect(right.length).toBe(1);
    expect(left.length).toBe(1);
    expect(drawn(right[0], group)).toBe(true);
    expect(drawn(left[0], group)).toBe(true);
    expect(rig.failed).not.toHaveBeenCalled();
  });

  it(
    "W6(한 짝 모델): 넷을 입힌 채 W6의 모든 움직임의 여러 프레임에서 오른쪽 신발의 foot_r 기준 자리·방향이 처음과 같다",
    async () => {
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig);
      await wearOn(view, rig, ALL);
      const handle = rig.handleRef.current!;
      const footR = bone(group, "foot_r");
      const right = addedShoes(group, baseline).surface.filter((m) => isAncestor(footR, m));
      expect(right.length).toBe(1);
      const shoe = right[0];

      group.updateMatrixWorld(true);
      const rest = relative(footR, shoe);
      const footStart = footR.getWorldPosition(new THREE.Vector3());
      let footMoved = 0;
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
          expectSameMatrix(relative(footR, shoe), rest, `${motion.label}: 오른쪽 신발`);
          expect({ label: motion.label, drawn: drawn(shoe, group) }).toEqual({ label: motion.label, drawn: true });
          footMoved = Math.max(footMoved, footR.getWorldPosition(new THREE.Vector3()).distanceTo(footStart));
        }
      }
      // 움직임이 실제로 있었다(오른발이 움직였다)
      expect(footMoved).toBeGreaterThan(0.05);
    },
    SLOW_TEST_MS
  );

  it("T2(한 짝 모델): 오른쪽 신발에도 외곽선이 그려지고 색이 라룹이 외곽선(0x3d1b0f)과 같으며, 굵기 2.0배에서 두께가 1.0배의 2배다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    const bodyShell = meshesUnder(group).find((m) => drawn(m, group) && !isToon(m));
    expect(bodyShell !== undefined).toBe(true);
    expect((bodyShell!.material as THREE.MeshBasicMaterial).color.getHex()).toBe(LINE_COLOR);

    await wearOn(view, rig, SHOES, 1);
    const footR = bone(group, "foot_r");
    const rightOutlines = () => addedShoes(group, baseline).outline.filter((m) => isAncestor(footR, m) && drawn(m, group));
    const thin = rightOutlines();
    expect(thin.length).toBeGreaterThan(0);
    for (const m of thin) expect((m.material as THREE.MeshBasicMaterial).color.getHex()).toBe(LINE_COLOR);
    const thinValues = thin.map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
    for (const v of thinValues) expect(v > 0).toBe(true);

    await wearOn(view, rig, SHOES, 2);
    const thick = rightOutlines();
    expect(thick.length).toBe(thin.length);
    thick.forEach((m, i) => expect(Number(((outlineThickness(m.material as THREE.Material) ?? NaN) / thinValues[i]).toFixed(6))).toBe(2));
  });
});

