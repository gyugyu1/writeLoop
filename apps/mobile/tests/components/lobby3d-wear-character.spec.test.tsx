// [spec] qa 테스트(작업 089 ① 착용 기술 시험, 새 기능, 모바일): 라룹이에 붙는 자리와 움직임 따라가기(W1~W7), 누르기 판정(결정 3),
// 카툰 명암·외곽선(T1~T3), 착용 모델을 못 읽을 때(F1·F2), 읽는 때(결정 4·5), 그대로여야 할 모양·판정(U1·U2).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/02-착용-기술-시험/03-qa-scenarios.md)와
// 04-main-decision.md(2: 못 읽어도 버튼은 눌린 대로 켜지고 꺼진다, 3: 착용 아이템은 누르기 판정에 넣지 않는다,
// 4: 처음 입을 때 읽고 홈에서는 읽지 않는다, 5: 읽는 동안에도 라룹이는 보인다)에서만 가져온다.
//
// 구현 커밋 fbaec64에서 읽은 것은 부르는 방법뿐이다:
// - 라룹이(Character)의 속성 wear(부위 hat·top·bottom·shoes마다 참·거짓), kit·outline·handleRef, 오류 경계 CharacterErrorBoundary
// - 착용 모델 파일 lobby-wearables.glb 안의 이름(wear-hat, wear-shoe-l, wear-shoe-r, wear-top, wear-bottom)
// - 외곽선 재질은 onBeforeCompile에서 셰이더 uniform outlineThickness로 굵기를 넣는다(굵기를 읽는 데만 쓴다)
//
// 어떻게 보나:
// - Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다(lobby3d-room-ready-indicator.spec과 같은 구성). useLoader는 파일마다
//   테스트가 정한 상태(읽는 중·읽음·못 읽음)대로 답하고, 불린 파일을 적어 둔다("모델을 읽는다" = useLoader가 그 파일로 불림).
// - 라룹이 모델과 착용 모델은 약속(뼈 이름, 모델 안 이름)을 지키는 가짜다. 실제 파일의 약속은 tests/lib/lobby3d-wearables-model.spec이 본다.
//   - 라룹이: writeloop.glb와 같은 뼈 18개, 뼈대로 휘는 몸 하나, 동작 클립 19개(머리·척추·엉덩이·두 발을 움직임)
//   - 착용: 모자·신발 두 짝(단단한 메시), 상의·하의(뼈 이름이 같은 자기 뼈대에 묶인 메시. 뼈 순서는 라룹이와 다르게 섞음)
//   - 아이템마다 점 수가 달라(모자 24, 신발 32, 상의 40, 하의 48, 라룹이 몸 54) 붙은 메시가 어느 아이템인지 점 수로 가린다.
// - SkeletonUtils.clone은 three의 것과 같은 방법(나무를 복제하고 복제한 뼈로 다시 묶음)의 가짜다(three/examples는 ES 모듈이라 Jest에서 못 읽는다).
// - "붙은 메시" = 입기 전 라룹이 묶음(CharacterHandle.group)에 없던 메시. "그려진다" = 자신과 묶음까지의 조상이 모두 visible.
// - 화면 단위(F1·F2·T1·W7·결정 4·5의 홈)는 화면·3D 그리기·라룹이를 진짜로 그리고, 라룹이 묶음은 3D 그리기가 넘긴 primitive의 object로 찾는다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Suspense, useEffect, type MutableRefObject, type ReactElement } from "react";
import { StyleSheet } from "react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { LobbySim, applyArea, applyLobbyLayout, applyRoom, type ActionType } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM } from "@/lib/lobby3d/room";
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정 "qa가 새 동작에 맞게 고침"): 옷의 그리기 정보(붙이는 방식·뼈·뒤집을 뼈·색·몸 판)는
// 받은 아이템 목록에서만 읽고, 모델은 옷마다 서버 파일을 기기에 받아 GLTFLoader.loadAsync(기기 주소)로 읽는다(앱의 착용 모델 묶음은 쓰지 않는다).
// 그래서 테스트마다 서버 목록 파일과 같은 draw의 옷으로 목록을 두고(파일 참조는 테스트마다 새 해시: 읽은 모델이 모듈 안에 남기 때문),
// 그 파일을 기기에 둔 상태로 시작한다. 가짜 GLTFLoader는 기기 주소의 파일 이름(wear-hat.glb 등)에 맞는 노드만 이 파일의 가짜 착용 모델에서 꺼내
// 한 파일 모델로 준다(신발은 서버 파일처럼 왼쪽 한 짝). 읽기 상태(읽는 중·읽음·못 읽음)는 지금처럼 WEAR_FILE의 상태를 따르고, 읽을 때마다 WEAR_FILE을 적는다.
// 단언·입력은 바꾸지 않았다.
import { parseItemCatalog as qaParseCatalog, setItemCatalog as qaSetCatalog } from "@/lib/item-catalog-store";
import { deviceUri, fakeRef, putOnDevice, rawServerItems, resetDevice, serverWearable } from "../__fixtures__/wear-files-090";

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
const mockLoaded: string[] = [];
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
type MockObject3D = THREE.Object3D;
type MockSkinnedMesh = THREE.SkinnedMesh;
type MockBone = THREE.Bone;

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
        mockLoaded.push(String(url));
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
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
jest.mock("@/assets/models/lobby-wearables.glb", () => "lobby-wearables.glb");
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

const NOW = new Date("2026-11-13T03:00:00.000Z");
const ROOM_FILE = "lobby-room.glb";
const CHARACTER_FILE = "writeloop.glb";
// 090-② 05 결정 3: 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱 파일(목록)이다. 그 목록을 이 이름 하나로 본다
const FURNITURE_FILE = "furniture/처음-방-일곱";
const VILLAGE_FILE = "lobby-village.glb";
const WEAR_FILE = "lobby-wearables.glb";
const INDICATOR = "방을 준비하고 있어요";
const SLOW_TEST_MS = 60_000;

type Slot = "hat" | "top" | "bottom" | "shoes";
type Wear = Record<Slot, boolean>;
const NONE: Wear = { hat: false, top: false, bottom: false, shoes: false };
const ALL: Wear = { hat: true, top: true, bottom: true, shoes: true };
const only = (...slots: Slot[]): Wear => ({ ...NONE, ...Object.fromEntries(slots.map((s) => [s, true])) });

/** 붙은 메시의 점 수 → 아이템. */
const ITEM_BY_POINTS: Record<number, "hat" | "shoe" | "top" | "bottom"> = { 24: "hat", 32: "shoe", 40: "top", 48: "bottom" };
const BODY_POINTS = 54;
const WEAR_BUTTONS = ["모자", "상의", "하의", "신발"];

// ---------- 가짜 모델 ----------

/** writeloop.glb와 같은 뼈 이름과 부모. 자리는 키 1 모델에 맞춘 대강의 값. */
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

/** 뼈 나무를 만든다. order 순서로 뼈 배열을 돌려준다(뼈대 번호 순서). */
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

/** 점마다 높이로 뼈 하나에 묶은 뼈대 메시. */
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

/** 가짜 라룹이 모델(gltf 모양). */
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

/** 가짜 착용 모델(gltf 모양). 상의·하의는 뼈 이름이 같은 자기 뼈대에, 라룹이와 다른 뼈 순서로 묶는다. */
function fakeWearables() {
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
  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.2, 2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x6b3a1e }));
  shoeR.name = "wear-shoe-r";
  shoeR.position.set(-0.1, 0.04, 0.03);
  const top = skinnedBox(new THREE.BoxGeometry(0.55, 0.4, 0.45, 3, 1, 1).translate(0, 0.6, 0), bones, new THREE.MeshStandardMaterial({ color: 0xe8590c }));
  top.name = "wear-top";
  const bottom = skinnedBox(new THREE.BoxGeometry(0.55, 0.3, 0.45, 4, 1, 1).translate(0, 0.3, 0), bones, new THREE.MeshStandardMaterial({ color: 0x1f2f5c }));
  bottom.name = "wear-bottom";
  scene.add(hat, shoeL, shoeR, top, bottom);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  top.bind(skeleton);
  bottom.bind(skeleton);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 가구 묶음·방 껍데기·마을: 화면 단위 시험에서 쓰는 단순한 가짜(lobby3d-room-ready-indicator.spec과 같다). */
function fakeModelFor(file: string): unknown {
  if (file === CHARACTER_FILE) return fakeCharacter();
  if (file === WEAR_FILE) return fakeWearables();
  if (file === FURNITURE_FILE) {
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
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene, animations: [] };
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
    if (status === "loaded") model.value = fakeModelFor(file);
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

async function frame(count = 1, ms = 50) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      for (const part of [...mockFrames]) part({ camera: mockThree.camera!, gl: {}, clock: { elapsedTime: 0 }, scene: mockThree.scene! }, ms / 1000);
      jest.advanceTimersByTime(ms);
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

function indicatorShown(): boolean {
  return screen.queryAllByText(INDICATOR).some((node) => !hiddenByStyle(node));
}

async function framesUntilRoomShown() {
  for (let index = 0; index < 60; index += 1) {
    await frame(1, 16);
    if (!indicatorShown()) break;
  }
}

function wearLoads(): number {
  return mockLoaded.filter((url) => url === WEAR_FILE).length;
}

/** 묶음 아래 메시들. */
function meshesUnder(group: THREE.Object3D): THREE.Mesh[] {
  const list: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh);
  });
  return list;
}

/** 자신과 group까지의 조상이 모두 visible인지. */
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

/** 입기 전 메시 목록 baseline에 없던, group 아래의 메시를 아이템별로. surface는 카툰 재질, outline은 그 밖. */
function addedItems(group: THREE.Object3D, baseline: Set<THREE.Mesh>) {
  const items: Record<"hat" | "shoe" | "top" | "bottom", { surface: THREE.Mesh[]; outline: THREE.Mesh[] }> = {
    hat: { surface: [], outline: [] },
    shoe: { surface: [], outline: [] },
    top: { surface: [], outline: [] },
    bottom: { surface: [], outline: [] }
  };
  const unknown: THREE.Mesh[] = [];
  for (const mesh of meshesUnder(group)) {
    if (baseline.has(mesh)) continue;
    const item = ITEM_BY_POINTS[mesh.geometry.attributes.position.count];
    if (!item) {
      unknown.push(mesh);
      continue;
    }
    items[item][isToon(mesh) ? "surface" : "outline"].push(mesh);
  }
  return { items, unknown };
}

/** 셰이더를 흉내 내 외곽선 재질이 넣는 굵기(outlineThickness)를 읽는다. */
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

/** 3D 그리기 끝부분과 같은 모양(오류 경계 > Suspense > 라룹이 + 같은 Suspense 안의 '다 그려짐' 표시)으로 라룹이를 그린다. */
interface Rig {
  kit: ToonKit;
  handleRef: MutableRefObject<CharacterHandle | null>;
  failed: jest.Mock;
  settled: jest.Mock;
  element: (wear: Wear, outline?: number) => ReactElement;
}

function SettledMark({ onSettled }: { onSettled: () => void }) {
  useEffect(() => {
    onSettled();
  }, [onSettled]);
  return null;
}

function makeRig(): Rig {
  const rig = {
    kit: newKit(),
    handleRef: { current: null } as MutableRefObject<CharacterHandle | null>,
    failed: jest.fn(),
    settled: jest.fn()
  };
  return {
    ...rig,
    element: (wear: Wear, outline = 1) => (
      <CharacterErrorBoundary onFailed={rig.failed}>
        <Suspense fallback={null}>
          <Character kit={rig.kit} outline={outline} handleRef={rig.handleRef} wear={wear} />
          <SettledMark onSettled={rig.settled} />
        </Suspense>
      </CharacterErrorBoundary>
    )
  };
}

/** 라룹이를 아무것도 입히지 않고 그린 뒤, 입기 전 메시 목록을 돌려준다. */
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

function bone(group: THREE.Object3D, name: string): THREE.Object3D {
  const found = group.getObjectByName(name);
  expect(found !== undefined).toBe(true);
  return found!;
}

/** 상의·하의 껍질의 뼈가 모두 라룹이 복제본의 그 이름 뼈 객체인지. */
function bonesAreCharacters(mesh: THREE.Mesh, group: THREE.Object3D): boolean {
  const skinned = mesh as THREE.SkinnedMesh;
  if (!skinned.isSkinnedMesh || !skinned.skeleton || skinned.skeleton.bones.length === 0) return false;
  return skinned.skeleton.bones.every((b) => b === group.getObjectByName(b.name) && isAncestor(group, b));
}

/** a 기준 b의 자리·방향(행렬). */
function relative(a: THREE.Object3D, b: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().copy(a.matrixWorld).invert().multiply(b.matrixWorld);
}

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4, label: string) {
  const diff = Math.max(...actual.elements.map((v, i) => Math.abs(v - expected.elements[i])));
  expect({ label, close: diff < 1e-5 }).toEqual({ label, close: true });
}

/** 화면 단위: 3D 그리기가 넘긴 primitive 가운데 가짜 라룹이 몸을 품은 묶음. */
function characterGroupOnScreen(): THREE.Object3D | null {
  const primitives = screen.container.queryAll((i: TestInstance) => (i.type as unknown) === "primitive");
  for (const p of primitives) {
    const object = p.props.object as THREE.Object3D | undefined;
    if (object?.getObjectByName?.("qa-body") && object.getObjectByName("head")) return object;
  }
  return null;
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;
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
    const ref = fakeRef(`lobby3d-wear-character-${file}-${wearRound}`, "glb");
    putOnDevice(ref);
    mockWearFiles.set(deviceUri(ref), file);
    return { ...serverWearable(id), assets: { model: ref, icon: null } };
  });
  qaSetCatalog(qaParseCatalog({ version: `qa-090-3-${wearRound}`, items })!);
}

/** 한 파일 모델: 이 파일의 가짜 착용 모델에서 그 노드만(뼈대로 휘는 껍질이면 뼈대도) 꺼낸다. */
function mockWearScene(file: string) {
  const bundle = fakeWearables().scene;
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

beforeEach(async () => {
  setWearCatalog();
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockCanvas.props = null;
  mockModels.clear();
  mockLoaded.length = 0;
  for (const file of [ROOM_FILE, CHARACTER_FILE, FURNITURE_FILE, VILLAGE_FILE, WEAR_FILE]) mockModels.set(file, pendingModel());
  mark("loaded", CHARACTER_FILE);
  // 못 읽은 모델을 오류 경계가 잡을 때 React와 경계가 남기는 출력은 출력만 막는다
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  applyArea("room");
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- W. 붙는 자리 ----------

describe("[spec] 라룹이에 붙는 자리(W1~W5)", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it("W1: 모자를 입히면 모자 메시가 그 라룹이 복제본의 head 뼈 자손이고 그려진다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, only("hat"));
    const { items } = addedItems(group, baseline);
    const hats = [...items.hat.surface, ...items.hat.outline];
    expect(items.hat.surface.length).toBeGreaterThan(0);
    const head = bone(group, "head");
    expect(hats.every((m) => isAncestor(head, m))).toBe(true);
    expect(items.hat.surface.every((m) => drawn(m, group))).toBe(true);
  });

  it("W2: 신발을 입히면 신발 메시가 둘이고 하나는 foot_l, 하나는 foot_r의 자손이며 둘 다 그려진다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, only("shoes"));
    const { items } = addedItems(group, baseline);
    const shoes = items.shoe.surface;
    expect(shoes.length).toBe(2);
    const footL = bone(group, "foot_l");
    const footR = bone(group, "foot_r");
    expect(shoes.filter((m) => isAncestor(footL, m)).length).toBe(1);
    expect(shoes.filter((m) => isAncestor(footR, m)).length).toBe(1);
    expect(shoes.every((m) => drawn(m, group))).toBe(true);
  });

  it.each([
    ["W3", "top"],
    ["W4", "bottom"]
  ] as const)("%s: %s 껍질을 입히면 뼈대로 휘는 메시이고, 그 뼈가 모두 라룹이 복제본의 뼈 객체 그대로이며 그려진다", async (_id, slot) => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, only(slot));
    const { items } = addedItems(group, baseline);
    const surfaces = items[slot].surface;
    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces.every((m) => bonesAreCharacters(m, group))).toBe(true);
    expect(surfaces.every((m) => drawn(m, group))).toBe(true);
  });

  it("W5: 넷을 입힌 뒤 하나씩 벗기면 벗긴 아이템은 그려지지 않고, 벗기지 않은 아이템은 그대로 그려진다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, ALL);
    const order: [Slot, "hat" | "shoe" | "top" | "bottom"][] = [
      ["hat", "hat"],
      ["top", "top"],
      ["bottom", "bottom"],
      ["shoes", "shoe"]
    ];
    const wear: Wear = { ...ALL };
    for (const [slot] of order) {
      wear[slot] = false;
      await wearOn(view, rig, { ...wear });
      const { items } = addedItems(group, baseline);
      for (const [s, item] of order) {
        const meshes = [...items[item].surface, ...items[item].outline];
        const shown = meshes.filter((m) => drawn(m, group)).length;
        if (wear[s]) expect({ item, shown: shown > 0 }).toEqual({ item, shown: true });
        else expect({ item, shown }).toEqual({ item, shown: 0 });
      }
    }
  });
});

// ---------- W6. 움직임 따라가기 ----------

type SimSetup = { label: string; frames: ((sim: LobbySim) => void)[] };

const at = (ts: number[], f: (t: number) => (sim: LobbySim) => void) => ts.map(f);

/** 명세의 모든 움직임: 걷기, 서기, 동작 시험 여섯, 오래 쉬어 앉기, 들어가기 동작 셋(생각하기·의자에 앉기·책 꺼내기). */
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

describe("[spec] 입은 아이템은 라룹이의 모든 움직임을 따라간다(W6)", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it(
    "W6: 넷을 입힌 채 모든 움직임의 여러 프레임에서 모자는 head, 신발은 foot_l·foot_r 기준 자리·방향이 처음과 같고, 상의·하의 껍질의 뼈는 라룹이 뼈 그대로다",
    async () => {
      const rig = makeRig();
      const { view, group, baseline } = await renderBare(rig);
      await wearOn(view, rig, ALL);
      const handle = rig.handleRef.current!;
      const { items } = addedItems(group, baseline);
      const hat = items.hat.surface[0];
      const head = bone(group, "head");
      const footL = bone(group, "foot_l");
      const footR = bone(group, "foot_r");
      const shoeL = items.shoe.surface.find((m) => isAncestor(footL, m));
      const shoeR = items.shoe.surface.find((m) => isAncestor(footR, m));
      expect(hat !== undefined).toBe(true);
      expect(shoeL !== undefined).toBe(true);
      expect(shoeR !== undefined).toBe(true);
      const shells = [...items.top.surface, ...items.bottom.surface];
      expect(shells.length).toBeGreaterThanOrEqual(2);

      group.updateMatrixWorld(true);
      const hatRest = relative(head, hat);
      const shoeLRest = relative(footL, shoeL!);
      const shoeRRest = relative(footR, shoeR!);
      const headStart = head.getWorldPosition(new THREE.Vector3());
      let headMoved = 0;
      let liftSeen = 0;
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
          expectSameMatrix(relative(head, hat), hatRest, `${motion.label}: 모자`);
          expectSameMatrix(relative(footL, shoeL!), shoeLRest, `${motion.label}: 왼 신발`);
          expectSameMatrix(relative(footR, shoeR!), shoeRRest, `${motion.label}: 오른 신발`);
          expect({ label: motion.label, shells: shells.every((m) => bonesAreCharacters(m, group)) }).toEqual({ label: motion.label, shells: true });
          headMoved = Math.max(headMoved, head.getWorldPosition(new THREE.Vector3()).distanceTo(headStart));
          liftSeen = Math.max(liftSeen, (group.children[0]?.position.y ?? 0));
        }
      }
      // 움직임이 실제로 있었다(머리가 움직였고, 의자에 앉기로 몸이 들렸다)
      expect(headMoved).toBeGreaterThan(0.05);
      expect(liftSeen).toBeGreaterThan(0);
    },
    SLOW_TEST_MS
  );
});

// ---------- 누르기 판정(결정 3), 그대로(U1·U2) ----------

describe("[spec] 누르기 판정과 착용하지 않은 라룹이(U1, U2, 결정 3)", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  function hitsOf(group: THREE.Object3D, origin: THREE.Vector3, direction: THREE.Vector3) {
    group.updateMatrixWorld(true);
    return new THREE.Raycaster(origin, direction.normalize()).intersectObject(group, true);
  }

  it("U1: 아무것도 입히지 않으면 그려지는 메시는 몸과 그 외곽선 껍질 둘뿐이고, 착용 모델을 읽지 않는다", async () => {
    const rig = makeRig();
    const { group } = await renderBare(rig);
    const shown = meshesUnder(group).filter((m) => drawn(m, group));
    expect(shown.length).toBe(2);
    expect(shown.every((m) => (m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry.attributes.position.count === BODY_POINTS)).toBe(true);
    expect(shown.filter(isToon).length).toBe(1);
    expect(wearLoads()).toBe(0);
  });

  it("U2: 아무것도 입히지 않은 라룹이를 앞·위에서 누르면 보이지 않는 통(isCharacter)이 맞는다", async () => {
    const rig = makeRig();
    const { group } = await renderBare(rig);
    for (const [origin, direction] of [
      [new THREE.Vector3(0, 1, 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0.05, 12, 0.03), new THREE.Vector3(0, -1, 0)]
    ] as const) {
      const hits = hitsOf(group, origin.clone(), direction.clone());
      expect(hits.length).toBeGreaterThan(0);
      expect((hits[0].object.userData as { isCharacter?: boolean }).isCharacter).toBe(true);
    }
  });

  it("결정 3: 넷을 입혀도 앞·위에서 누를 때 맞는 것은 보이지 않는 통뿐이고 착용 아이템은 맞지 않는다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, ALL);
    const { items } = addedItems(group, baseline);
    expect(items.hat.surface.length).toBeGreaterThan(0);
    const added = new Set(meshesUnder(group).filter((m) => !baseline.has(m)));
    for (const [origin, direction] of [
      [new THREE.Vector3(0, 1, 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0.05, 12, 0.03), new THREE.Vector3(0, -1, 0)],
      [new THREE.Vector3(0.15, 0.7, 6), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0.2, 0.15, 6), new THREE.Vector3(0, 0, -1)]
    ] as const) {
      const hits = hitsOf(group, origin.clone(), direction.clone());
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.filter((h) => added.has(h.object as THREE.Mesh)).length).toBe(0);
      expect(hits.every((h) => (h.object.userData as { isCharacter?: boolean }).isCharacter === true)).toBe(true);
    }
  });
});

// ---------- T. 명암·외곽선 ----------

describe("[spec] 카툰 명암과 외곽선(T2, T3)", () => {
  beforeEach(() => mark("loaded", WEAR_FILE));

  it("T2: 네 아이템마다 외곽선이 그려지고 색이 라룹이 외곽선(0x3d1b0f)과 같으며, 굵기 2.0배에서 외곽선 두께가 1.0배의 2배다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    const bodyShell = meshesUnder(group).find((m) => drawn(m, group) && !isToon(m))!;
    expect(bodyShell !== undefined).toBe(true);
    const lineColor = (bodyShell.material as THREE.MeshBasicMaterial).color.getHex();
    expect(lineColor).toBe(0x3d1b0f);

    await wearOn(view, rig, ALL, 1);
    const { items } = addedItems(group, baseline);
    const thin: Record<string, number[]> = {};
    for (const item of ["hat", "shoe", "top", "bottom"] as const) {
      const outlines = items[item].outline.filter((m) => drawn(m, group));
      expect({ item, outlines: outlines.length > 0 }).toEqual({ item, outlines: true });
      for (const m of outlines) expect({ item, color: (m.material as THREE.MeshBasicMaterial).color.getHex() }).toEqual({ item, color: lineColor });
      thin[item] = outlines.map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
      for (const v of thin[item]) expect({ item, positive: v > 0 }).toEqual({ item, positive: true });
    }

    await wearOn(view, rig, ALL, 2);
    const after = addedItems(group, baseline).items;
    for (const item of ["hat", "shoe", "top", "bottom"] as const) {
      const thick = after[item].outline.filter((m) => drawn(m, group)).map((m) => outlineThickness(m.material as THREE.Material) ?? NaN);
      expect(thick.length).toBe(thin[item].length);
      thick.forEach((v, i) => expect({ item, ratio: Number((v / thin[item][i]).toFixed(6)) }).toEqual({ item, ratio: 2 }));
    }
  });

  it("T3: 상의 껍질의 겉 재질 색이 한 가지, 하의도 한 가지이고 두 색이 다르다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    await wearOn(view, rig, only("top", "bottom"));
    const { items } = addedItems(group, baseline);
    const colors = (meshes: THREE.Mesh[]) => new Set(meshes.map((m) => (m.material as THREE.MeshToonMaterial).color.getHex()));
    const top = colors(items.top.surface);
    const bottom = colors(items.bottom.surface);
    expect(top.size).toBe(1);
    expect(bottom.size).toBe(1);
    expect([...top][0]).not.toBe([...bottom][0]);
  });
});

// ---------- 읽는 때(결정 4·5)와 못 읽을 때(F1) ----------

describe("[spec] 착용 모델을 읽는 때와 못 읽을 때(결정 4·5, F1)", () => {
  it("결정 4: 아무것도 입지 않은 동안에는 착용 모델을 읽지 않고, 처음 입을 때 읽는다", async () => {
    mark("loaded", WEAR_FILE);
    const rig = makeRig();
    const { view } = await renderBare(rig);
    await flushAsync();
    expect(wearLoads()).toBe(0);
    await wearOn(view, rig, only("top"));
    expect(wearLoads()).toBeGreaterThan(0);
  });

  it("결정 5: 착용 모델을 읽는 동안에도 라룹이는 그대로 보이고(같은 Suspense의 '다 그려짐'도 남음), 다 읽으면 아이템이 붙는다", async () => {
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    expect(rig.settled).toHaveBeenCalled();
    await wearOn(view, rig, ALL);
    expect(wearLoads()).toBeGreaterThan(0);
    // 읽는 중: 라룹이 손잡이·묶음이 그대로이고, 라룹이 쪽 Suspense가 대체(null)로 바뀌지 않았다
    expect(rig.handleRef.current !== null).toBe(true);
    expect(rig.handleRef.current!.group === group).toBe(true);
    expect(rig.failed).not.toHaveBeenCalled();
    const primitives = screen.container.queryAll((i: TestInstance) => (i.type as unknown) === "primitive" && i.props.object === group);
    expect(primitives.length).toBe(1);
    expect(meshesUnder(group).filter((m) => drawn(m, group)).length).toBe(2);

    await act(async () => {
      mark("loaded", WEAR_FILE);
    });
    await flushAsync();
    const { items } = addedItems(group, baseline);
    expect(items.hat.surface.filter((m) => drawn(m, group)).length).toBeGreaterThan(0);
    expect(rig.handleRef.current!.group === group).toBe(true);
  });

  it("F1: 착용 모델만 못 읽으면 입힘→넷→비움으로 바꿔도 오류가 밖으로 나오지 않고 라룹이는 그대로이며 메시가 더해지지 않는다", async () => {
    mark("failed", WEAR_FILE);
    const rig = makeRig();
    const { view, group, baseline } = await renderBare(rig);
    for (const wear of [ALL, NONE, ALL, only("hat")]) {
      await wearOn(view, rig, wear);
      expect(rig.handleRef.current !== null).toBe(true);
      expect(rig.handleRef.current!.group === group).toBe(true);
      expect(rig.failed).not.toHaveBeenCalled();
      const primitives = screen.container.queryAll((i: TestInstance) => (i.type as unknown) === "primitive" && i.props.object === group);
      expect(primitives.length).toBe(1);
      expect(meshesUnder(group).filter((m) => !baseline.has(m)).length).toBe(0);
    }
    expect(wearLoads()).toBeGreaterThan(0);
  });
});

// ---------- 화면 단위(F1·F2, 결정 4·5, T1, W7) ----------

describe("[spec] 화면 단위: 개발 화면에서 입고 벗기(F1·F2, 결정 2·4·5, T1, W7)", () => {
  async function openDev() {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);
    await flushAsync();
  }

  it(
    "F1·F2(결정 2): 착용 모델을 못 읽어도, 방이 보이기 전에 넷을 눌러 켜면 버튼은 켜지고 방은 보이며 라룹이에는 아무것도 붙지 않고 다른 시험판 버튼도 눌린다",
    async () => {
      mark("loaded", ROOM_FILE, FURNITURE_FILE);
      mark("failed", WEAR_FILE);
      await openDev();
      // 장면을 그리기 전이라 방이 아직 보이지 않았다(준비 표시가 있다)
      expect(indicatorShown()).toBe(true);
      await press("시험판 펴기");
      for (const name of WEAR_BUTTONS) await press(name);
      for (const name of WEAR_BUTTONS) expect(screen.getByRole("button", { name }).props.accessibilityState?.selected).toBe(true);
      expect(indicatorShown()).toBe(true);

      await framesUntilRoomShown();
      expect(indicatorShown()).toBe(false);
      const group = characterGroupOnScreen();
      expect(group !== null).toBe(true);
      expect(meshesUnder(group!).filter((m) => drawn(m, group!)).length).toBe(2);

      // 끄고 다시 켜도 눌린 대로 바뀐다
      await press("모자");
      expect(screen.getByRole("button", { name: "모자" }).props.accessibilityState?.selected).toBe(false);
      await press("모자");
      expect(screen.getByRole("button", { name: "모자" }).props.accessibilityState?.selected).toBe(true);
      await frame(3);
      expect(meshesUnder(group!).filter((m) => drawn(m, group!)).length).toBe(2);

      await press("신나게 점프");
      expect(mockCanvas.props!.sim.action?.type).toBe("jump");
    },
    SLOW_TEST_MS
  );

  it(
    "결정 5(화면): 착용 모델을 읽는 중이어도 방이 보이기 전에 넷을 켜면 방이 보이고 라룹이가 그려진다",
    async () => {
      mark("loaded", ROOM_FILE, FURNITURE_FILE);
      await openDev();
      expect(indicatorShown()).toBe(true);
      await press("시험판 펴기");
      for (const name of WEAR_BUTTONS) await press(name);
      expect(indicatorShown()).toBe(true);
      expect(wearLoads()).toBeGreaterThan(0);
      await framesUntilRoomShown();
      expect(indicatorShown()).toBe(false);
      const group = characterGroupOnScreen();
      expect(group !== null).toBe(true);
      expect(meshesUnder(group!).filter((m) => drawn(m, group!)).length).toBe(2);
    },
    SLOW_TEST_MS
  );

  it(
    "결정 4(홈): 시험판 없는 로비(홈이 그리는 모양)는 방이 보이고 장면을 그려도 착용 모델을 읽지 않는다",
    async () => {
      mark("loaded", ROOM_FILE, FURNITURE_FILE, WEAR_FILE);
      await render(
        <Lobby3dScreen devPanel={false} layout={DEFAULT_LOBBY_LAYOUT} onSaveLayout={async (value: LobbyLayout) => value} />
      );
      await flushAsync();
      await framesUntilRoomShown();
      expect(indicatorShown()).toBe(false);
      await frame(10);
      expect(characterGroupOnScreen() !== null).toBe(true);
      expect(wearLoads()).toBe(0);
    },
    SLOW_TEST_MS
  );

  it(
    "T1: 넷을 입히면 겉 재질이 모두 카툰 재질이고 그라디언트가 라룹이 몸 재질과 같으며, 명암 단계를 2단으로 바꾼 뒤에도 몸과 같은 새 그라디언트다",
    async () => {
      mark("loaded", ROOM_FILE, FURNITURE_FILE, WEAR_FILE);
      await openDev();
      await framesUntilRoomShown();
      const group = characterGroupOnScreen()!;
      expect(group !== null).toBe(true);
      const baseline = new Set(meshesUnder(group));
      const body = meshesUnder(group).find((m) => drawn(m, group) && isToon(m))!;
      expect(body !== undefined).toBe(true);
      await press("시험판 펴기");
      for (const name of WEAR_BUTTONS) await press(name);
      await frame(2);
      const surfaces = () => {
        const { items } = addedItems(group, baseline);
        return [...items.hat.surface, ...items.shoe.surface, ...items.top.surface, ...items.bottom.surface];
      };
      const before = surfaces();
      expect(before.length).toBeGreaterThanOrEqual(5);
      const oldGradient = (body.material as THREE.MeshToonMaterial).gradientMap;
      expect(Boolean(oldGradient)).toBe(true);
      expect(before.filter((m) => (m.material as THREE.MeshToonMaterial).gradientMap !== oldGradient).length).toBe(0);

      await press("2단");
      await frame(2);
      const newGradient = (body.material as THREE.MeshToonMaterial).gradientMap;
      expect(newGradient === oldGradient).toBe(false);
      expect(surfaces().filter((m) => (m.material as THREE.MeshToonMaterial).gradientMap !== newGradient).length).toBe(0);
    },
    SLOW_TEST_MS
  );

  it(
    "W7: 시험판 '마을'로 바꾼 뒤 넷을 입히면 모자는 head, 신발은 두 발, 상의·하의는 라룹이 뼈로 붙어 그려진다",
    async () => {
      mark("loaded", ROOM_FILE, FURNITURE_FILE, WEAR_FILE);
      await openDev();
      await framesUntilRoomShown();
      const group = characterGroupOnScreen()!;
      expect(group !== null).toBe(true);
      const baseline = new Set(meshesUnder(group));
      await press("시험판 펴기");
      await press("마을");
      expect(mockCanvas.props!.area).toBe("village");
      for (const name of WEAR_BUTTONS) await press(name);
      await flushAsync();
      expect(mockCanvas.props!.area).toBe("village");
      const { items } = addedItems(group, baseline);
      expect(items.hat.surface.length).toBeGreaterThan(0);
      expect(items.hat.surface.every((m) => isAncestor(bone(group, "head"), m) && drawn(m, group))).toBe(true);
      expect(items.shoe.surface.filter((m) => isAncestor(bone(group, "foot_l"), m) && drawn(m, group)).length).toBe(1);
      expect(items.shoe.surface.filter((m) => isAncestor(bone(group, "foot_r"), m) && drawn(m, group)).length).toBe(1);
      for (const item of ["top", "bottom"] as const) {
        expect(items[item].surface.length).toBeGreaterThan(0);
        expect(items[item].surface.every((m) => bonesAreCharacters(m, group) && drawn(m, group))).toBe(true);
      }
    },
    SLOW_TEST_MS
  );
});
