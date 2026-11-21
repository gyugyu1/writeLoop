// [spec] qa 테스트(작업 134 ① 플레이어 교체, 기능 변경, 모바일): 로비 캐릭터(Character)가 사람형 모델(player-human.glb)을 1.513배로 그리고,
// 체형에 맞춘 값(말풍선·누르기 판정·손에 드는 책)과 동작 연결·첫 그릴 때 자세·재질·기본 착장·고글을 지금 규칙대로 다루는지 본다.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/02-플레이어-교체/01-main-spec.md)의 바뀌는 동작 1~6과 "그대로여야 할 동작"에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나(작업 091 qa 테스트 lobby3d-character-handle-remount.spec과 같은 방법):
// - 진짜 Character를 그린다. Jest에서 돌지 않는 react-three-fiber의 useLoader만 가짜로 둔다. 가짜 useLoader는 "player-human.glb"와 "writeloop.glb" 둘 다에
//   같은 가짜 사람형 모델을 준다(그래서 어느 파일을 읽든 동작·자세 테스트는 같은 모델로 돈다. 어느 파일을 읽었는지는 [바뀔] 테스트가 따로 본다).
//   "wear-goggles.glb"를 읽으면 적어 두고 읽기를 실패시킨다(읽었는지만 본다).
// - 가짜 사람형 모델: 실제 파일(WriteLoop_Player_Human.glb)과 같은 뼈 이름·부모, 뼈대로 휘는 메시 열한 개(이름도 같다), 키 1.0·발밑 원점이다.
//   쉬는 자세는 팔을 벌린 T자이고, 모든 클립은 두 팔을 아래로 돌린 값이다(실제 파일의 idle 첫 키처럼). jump·hop 클립은 엉덩이를 실제 파일과 같은 높이
//   (키 1.0 기준 0.112, 0.067)만큼 든다. 클립 22개(실제 파일과 같은 이름. sleep·surprised·talk 포함).
// - 재질: 실제 파일은 그림 한 장을 메시 열한 개가 함께 쓴다. 가짜도 한 장을 함께 쓴다.
// - 모델을 복제하는 SkeletonUtils.clone 가짜는 복제본을 적어 둔다(첫 그릴 때 자세를 보려고).
// 가정(명세에 숫자가 없는 것): 말풍선 꼬리는 머리 꼭대기(1.513) 위 0.4칸 안, 누르기 통의 폭은 머리 폭 62% ±(0.80~1.08칸), 책 높이는 키 대비 0.273 ±25%
//   (지금 라룹이: 책 0.62 / 키 2.27). 손에 든 책의 자리는 손 사이 가운데·몸 앞쪽·머리 꼭대기 아래.
import { act, render } from "@testing-library/react-native";
import { Suspense, useLayoutEffect, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import { BUBBLE_HEIGHT, Character, CharacterErrorBoundary, MODEL_SCALE, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { ACTION_SECONDS, BOOK_TURN_BACK_SECONDS, LobbySim, type ActionType, type PostureKind, type SceneKind, type ScenePhase } from "@/lib/lobby3d/engine";
import type { WearLook } from "@/lib/lobby3d/wear";

const mockLoaded: string[] = [];
const mockClones: THREE.Object3D[] = [];
const mockActions = new Map<string, THREE.AnimationAction>();

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({
  useLoader: (_loader: unknown, url: unknown) => {
    mockLoaded.push(String(url));
    if (String(url) === "player-human.glb" || String(url) === "writeloop.glb") return mockModel.value;
    throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
  }
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync() {
      return new Promise(() => {});
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
// 구현이 새 파일을 require하므로 가상 모듈로 이름만 준다(파일이 아직 없어도 된다)
jest.mock("../../assets/models/player-human.glb", () => "player-human.glb", { virtual: true });

const mockModel: { value: unknown } = { value: null };

// ---------- 가짜 사람형 모델 ----------

/** [뼈, 부모, 쉬는 자세의 부모 기준 자리(키 1.0 모델)]. 이름·부모는 WriteLoop_Player_Human.glb와 같고 자리는 키 1에 맞춘 대강의 값이다. */
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
const CLIPS = [
  "book_put", "book_take", "chair_sit_down", "chair_sit_idle", "chair_stand_up", "hop", "idle", "jump", "look_around", "point", "poke", "sit_down",
  "sit_idle", "sleep", "stand_up", "surprised", "talk", "think_idle", "think_in", "think_out", "walk", "wave"
];
const NEW_CLIPS = ["sleep", "surprised", "talk"];
const REST_HIPS_Y = 0.5;
const LIFT = { jump: 0.112, hop: 0.067 } as Record<string, number>;

const ARM_DOWN = 80 * (Math.PI / 180);
function armQuat(side: "l" | "r") {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side === "l" ? -ARM_DOWN : ARM_DOWN);
}

function makeClips(): THREE.AnimationClip[] {
  return CLIPS.map((name) => {
    const duration = name in ACTION_SECONDS ? ACTION_SECONDS[name as ActionType] : 2;
    const times = [0, duration / 2, duration];
    const lift = LIFT[name] ?? 0;
    const q = (side: "l" | "r") => [...armQuat(side).toArray(), ...armQuat(side).toArray(), ...armQuat(side).toArray()];
    return new THREE.AnimationClip(name, duration, [
      new THREE.QuaternionKeyframeTrack("arm_l.quaternion", times, q("l")),
      new THREE.QuaternionKeyframeTrack("arm_r.quaternion", times, q("r")),
      new THREE.VectorKeyframeTrack("hips.position", times, [0, REST_HIPS_Y, 0, 0, REST_HIPS_Y + lift, 0, 0, REST_HIPS_Y, 0])
    ]);
  });
}

function fakePlayer() {
  const byName = new Map<string, THREE.Bone>();
  for (const [name, parent, [x, y, z]] of BONES) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    if (parent) byName.get(parent)!.add(bone);
    byName.set(name, bone);
  }
  const bones = BONES.map(([name]) => byName.get(name)!);
  const scene = new THREE.Group();
  scene.name = "fake-player";
  scene.add(byName.get("root")!);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.name = "fake-player-atlas";
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const hipsIndex = bones.findIndex((b) => b.name === "hips");
  for (const name of MESHES) {
    const geometry = new THREE.BoxGeometry(0.4, 1, 0.3).translate(0, 0.5, 0);
    const count = geometry.attributes.position.count;
    const skinIndex = new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4);
    const skinWeight = new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4);
    for (let i = 0; i < count; i += 1) {
      skinIndex.setX(i, hipsIndex);
      skinWeight.setX(i, 1);
    }
    geometry.setAttribute("skinIndex", skinIndex);
    geometry.setAttribute("skinWeight", skinWeight);
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name;
    scene.add(mesh);
    mesh.bind(skeleton);
  }
  return { scene, scenes: [scene], animations: makeClips(), cameras: [], asset: {}, parser: {}, userData: {}, texture, material };
}

// ---------- 그리기 도우미 ----------

function newKit(): ToonKit {
  return { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] };
}

async function flushAsync() {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

interface Drawn {
  handle: CharacterHandle;
  model: THREE.Object3D;
  bone: (name: string) => THREE.Object3D;
}

function element(handleRef: MutableRefObject<CharacterHandle | null>, look?: WearLook | null, probe?: () => void): ReactElement {
  return (
    <>
      <CharacterErrorBoundary>
        <Suspense fallback={null}>
          <Character kit={newKit()} outline={1} handleRef={handleRef} look={look} />
        </Suspense>
      </CharacterErrorBoundary>
      {probe ? <Probe run={probe} /> : null}
    </>
  );
}

/** 같은 커밋의 배치 효과(layout effect)에서 부른다. Character의 일반 효과(useEffect)보다 먼저 돈다. */
function Probe({ run }: { run: () => void }) {
  useLayoutEffect(() => {
    run();
  }, [run]);
  return null;
}

async function draw(look?: WearLook | null, probe?: () => void): Promise<Drawn> {
  const handleRef: MutableRefObject<CharacterHandle | null> = { current: null };
  await render(element(handleRef, look, probe));
  await flushAsync();
  const model = mockClones[mockClones.length - 1];
  expect(handleRef.current).not.toBeNull();
  return { handle: handleRef.current!, model, bone: (name) => model.getObjectByName(name)! };
}

function armAngle(model: THREE.Object3D): number {
  return model.getObjectByName("arm_l")!.quaternion.angleTo(new THREE.Quaternion());
}

const childrenOf = (handle: CharacterHandle) => handle.group.children;
function hitCapsule(handle: CharacterHandle): THREE.Mesh {
  return childrenOf(handle).find((child) => (child as THREE.Mesh).isMesh && child.userData.isCharacter) as THREE.Mesh;
}

let spy: jest.SpyInstance;
beforeEach(() => {
  mockLoaded.length = 0;
  mockClones.length = 0;
  mockActions.clear();
  mockModel.value = fakePlayer();
  const original = THREE.AnimationMixer.prototype.clipAction;
  spy = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction").mockImplementation(function (this: THREE.AnimationMixer, clip: never, root?: never) {
    const action = original.call(this, clip, root);
    mockActions.set((clip as THREE.AnimationClip).name, action as THREE.AnimationAction);
    return action;
  } as never);
});
afterEach(() => spy.mockRestore());

// ---------- 모델 파일·배율 ----------

describe("[spec] 134-① 플레이어 모델 파일과 배율", () => {
  it("[바뀔] 플레이어는 player-human.glb를 읽고, 라룹이 writeloop.glb는 읽지 않는다", async () => {
    await draw();
    expect(mockLoaded).toContain("player-human.glb");
    expect(mockLoaded).not.toContain("writeloop.glb");
  });

  it("[바뀔] 배율은 1.513이다(MODEL_SCALE, 모델 뿌리의 배율)", async () => {
    const { model } = await draw();
    expect(MODEL_SCALE).toBe(1.513);
    expect(model.scale.x).toBeCloseTo(1.513, 9);
    expect(model.scale.y).toBeCloseTo(1.513, 9);
    expect(model.scale.z).toBeCloseTo(1.513, 9);
  });
});

// ---------- 재질 ----------

describe("[spec] 134-① 재질: 메시 열한 개 모두 카툰 명암과 갈색 외곽선 껍질", () => {
  it("[그대로] 뼈대 메시 열한 개가 모두 카툰 재질(그림은 원래 그림 그대로)이고, 각각 뒷면만 그리는 외곽선 껍질이 하나씩 붙고, 모두 보인다", async () => {
    const { model } = await draw();
    const source = mockModel.value as ReturnType<typeof fakePlayer>;
    const skinned: THREE.SkinnedMesh[] = [];
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
    });
    // 몸 메시 11 + 외곽선 껍질 11
    expect(skinned).toHaveLength(22);
    const shells = skinned.filter((m) => (m.material as THREE.Material).side === THREE.BackSide);
    const bodies = skinned.filter((m) => (m.material as THREE.Material).side !== THREE.BackSide);
    expect(shells).toHaveLength(11);
    expect(bodies).toHaveLength(11);
    for (const mesh of bodies) {
      expect((mesh.material as THREE.MeshToonMaterial).isMeshToonMaterial).toBe(true);
      expect((mesh.material as THREE.MeshToonMaterial).map).toBe(source.texture);
      expect(mesh.visible).toBe(true);
    }
    for (const shell of shells) {
      expect((shell.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x3d1b0f);
      expect(shell.visible).toBe(true);
    }
    expect(bodies.map((m) => m.name).sort()).toEqual([...MESHES].sort());
  });
});

// ---------- 첫 그릴 때 자세 ----------

describe("[spec] 134-① 첫 그릴 때부터 팔을 내린 idle이다", () => {
  it("[그대로] 그린 뒤(update를 부르기 전) 두 팔은 쉬는 자세(T자)가 아니라 내린 자세다", async () => {
    const { model } = await draw();
    // 쉬는 자세는 회전 0. 내린 자세는 80도(1.396라디안)
    expect(armAngle(model)).toBeGreaterThan(1.2);
    expect(model.getObjectByName("arm_r")!.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(1.2);
  });

  it("[바뀔] 모델을 장면에 붙이는 같은 커밋의 배치 효과 시점에도 이미 팔이 내려가 있다(T포즈가 한 프레임도 보이지 않는다)", async () => {
    let atLayout: number | null = null;
    const probe = () => {
      const model = mockClones[mockClones.length - 1];
      if (model && atLayout === null) atLayout = armAngle(model);
    };
    await draw(undefined, probe);
    expect(atLayout).not.toBeNull();
    expect(atLayout!).toBeGreaterThan(1.2);
  });
});

// ---------- 동작 연결 ----------

type Setup = (sim: LobbySim) => void;
const action = (type: ActionType, t: number): Setup => (sim) => {
  sim.action = { type, t };
};
const posture = (kind: PostureKind, t: number): Setup => (sim) => {
  sim.posture = { kind, t };
};
const scene = (kind: SceneKind, phase: ScenePhase, t: number): Setup => (sim) => {
  sim.scene = { kind, mark: kind === "think" ? "board" : kind === "chair" ? "desk" : "bookcase", phase, t };
};

describe("[spec] 134-① GLB 클립을 지금 동작 상태에 그대로 잇는다", () => {
  it("[그대로] 서 있으면 idle만 재생한다", async () => {
    const { handle } = await draw();
    handle.update(new LobbySim({ x: 4, z: 6, random: () => 0.5 }), 1 / 30, 1);
    expect(mockActions.get("idle")!.getEffectiveWeight()).toBeCloseTo(1, 6);
    for (const [name, a] of mockActions) if (name !== "idle") expect({ name, w: a.getEffectiveWeight() }).toEqual({ name, w: 0 });
  });

  it("[그대로] 빠르게 걸으면(속력 1.6) walk만 재생한다", async () => {
    const { handle } = await draw();
    const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
    sim.vx = 1.6;
    handle.update(sim, 1 / 30, 1);
    expect(mockActions.get("walk")!.getEffectiveWeight()).toBeCloseTo(1, 6);
    expect(mockActions.get("idle")!.getEffectiveWeight()).toBeCloseTo(0, 6);
  });

  it.each<[string, string, Setup]>([
    ["인사", "wave", action("wave", 1)],
    ["점프", "jump", action("jump", 0.8)],
    ["폴짝", "hop", action("hop", 0.9)],
    ["가리키기", "point", action("point", 1)],
    ["두리번", "look_around", action("look", 1)],
    ["콕", "poke", action("poke", 0.4)],
    ["바닥에 앉는 중", "sit_down", posture("sitting-down", 0.4)],
    ["바닥에 앉아 있기", "sit_idle", posture("sitting", 0.5)],
    ["바닥에서 일어나는 중", "stand_up", posture("standing-up", 0.1)],
    ["생각하기 들어가기", "think_in", scene("think", "in", 0.4)],
    ["생각하기 유지", "think_idle", scene("think", "hold", 0.5)],
    ["생각하기 나오기", "think_out", scene("think", "out", 0.1)],
    ["의자에 앉는 중", "chair_sit_down", scene("chair", "in", 0.8)],
    ["의자에 앉아 있기", "chair_sit_idle", scene("chair", "hold", 0.5)],
    ["의자에서 일어나기", "chair_stand_up", scene("chair", "out", 0.1)],
    ["책 꺼내기", "book_take", scene("book", "in", 0.8)],
    ["책 꺼낸 채 유지", "book_take", scene("book", "hold", 0.5)],
    ["책 넣기", "book_put", scene("book", "out", BOOK_TURN_BACK_SECONDS + 0.1)]
  ])("[그대로] %s: 클립 %s가 재생되고, 새 클립(sleep·surprised·talk)과 그 밖의 한 번 하는 클립은 재생하지 않는다", async (_label, clip, setup) => {
    const { handle } = await draw();
    const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
    setup(sim);
    handle.update(sim, 1 / 30, 1);
    expect(mockActions.get(clip)!.getEffectiveWeight()).toBeGreaterThan(0.5);
    const others = [...mockActions].filter(([name]) => name !== clip && name !== "idle" && name !== "walk");
    expect(others.filter(([, a]) => a.getEffectiveWeight() !== 0).map(([name]) => name)).toEqual([]);
    for (const name of NEW_CLIPS) expect({ name, w: mockActions.get(name)!.getEffectiveWeight() }).toEqual({ name, w: 0 });
  });
});

// ---------- 말풍선 ----------

describe("[spec] 134-① 말풍선 꼬리: 서 있을 때 머리 꼭대기(1.513) 바로 위, 머리를 따라 움직인다", () => {
  const TOP = 1.513;

  it("[바뀔] 서 있을 때 꼬리 높이는 머리 꼭대기보다 높고 0.4칸 안이다", async () => {
    const { handle } = await draw();
    const y = handle.bubblePoint().y;
    expect(y).toBeGreaterThan(TOP);
    expect(y).toBeLessThanOrEqual(TOP + 0.4);
  });

  it("[바뀔] 머리·엉덩이 뼈를 못 찾을 때 쓰는 높이(BUBBLE_HEIGHT)도 같은 범위다", () => {
    expect(BUBBLE_HEIGHT).toBeGreaterThan(TOP);
    expect(BUBBLE_HEIGHT).toBeLessThanOrEqual(TOP + 0.4);
  });

  it("[그대로] 점프로 몸이 들리면 꼬리도 update가 돌려준 들린 높이만큼 함께 올라간다", async () => {
    const { handle } = await draw();
    const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
    const rest = handle.bubblePoint().y;
    sim.action = { type: "jump", t: ACTION_SECONDS.jump / 2 };
    const lifted = handle.update(sim, 1 / 30, 1);
    expect(lifted).toBeGreaterThan(0.1);
    expect(handle.bubblePoint().y - rest).toBeCloseTo(lifted, 3);
  });
});

// ---------- 누르기 판정 ----------

describe("[spec] 134-① 누르기 판정(보이지 않는 통): 발바닥에서 머리 꼭대기까지, 폭은 머리 폭(키의 약 62%)", () => {
  function extents(handle: CharacterHandle) {
    const hit = hitCapsule(handle);
    hit.geometry.computeBoundingBox();
    const box = hit.geometry.boundingBox!.clone();
    box.translate(hit.position);
    return { hit, minY: box.min.y, maxY: box.max.y, width: box.max.x - box.min.x };
  }

  it("[그대로] 보이지 않고 캐릭터 판정 표시가 붙은 통이 하나 있다", async () => {
    const { handle } = await draw();
    const hit = hitCapsule(handle);
    expect(hit).toBeDefined();
    expect(hit.visible).toBe(false);
    expect(hit.userData.isCharacter).toBe(true);
  });

  it("[바뀔] 통은 발바닥(0)에서 시작해 머리 꼭대기(1.513)보다 위까지 닿되, 2.27칸을 넘지 않는다", async () => {
    const { handle } = await draw();
    const { minY, maxY } = extents(handle);
    expect(minY).toBeLessThanOrEqual(0.02);
    expect(maxY).toBeGreaterThanOrEqual(1.513);
    expect(maxY).toBeLessThanOrEqual(1.513 * 1.5);
  });

  it("[바뀔] 통의 폭은 머리 폭(키 1.513의 62% = 0.938칸) 정도, 0.80~1.08칸이다", async () => {
    const { handle } = await draw();
    const { width } = extents(handle);
    expect(width).toBeGreaterThanOrEqual(0.8);
    expect(width).toBeLessThanOrEqual(1.08);
  });

  it("[그대로] 점프·폴짝으로 몸이 들려도 머리 꼭대기까지 통이 닿는다", async () => {
    const { handle } = await draw();
    const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
    let maxLift = 0;
    for (const type of ["jump", "hop"] as const) {
      for (let step = 0; step <= 20; step += 1) {
        sim.action = { type, t: (ACTION_SECONDS[type] * step) / 20 };
        maxLift = Math.max(maxLift, handle.update(sim, 1 / 30, 1 + step));
      }
    }
    expect(maxLift).toBeGreaterThan(0.1);
    expect(extents(handle).maxY).toBeGreaterThanOrEqual(1.513 + maxLift);
  });
});

// ---------- 손에 드는 책 ----------

describe("[spec] 134-① 손에 드는 책: 두 손 사이, 머리에 가리지 않는 자리, 체형에 맞는 크기", () => {
  async function holdBook() {
    const drawn = await draw();
    const sim = new LobbySim({ x: 4, z: 6, random: () => 0.5 });
    scene("book", "hold", 3)(sim);
    drawn.handle.update(sim, 1 / 30, 1);
    drawn.handle.group.updateMatrixWorld(true);
    const book = childrenOf(drawn.handle)[childrenOf(drawn.handle).length - 1];
    return { ...drawn, book, sim };
  }

  it("[그대로] 책이 보인다(책 꺼낸 채 유지하는 동안)", async () => {
    const { book } = await holdBook();
    expect(book.visible).toBe(true);
  });

  it("[바뀔] 책의 맨 위는 머리 꼭대기(1.513) 아래라 머리를 가리지 않는다(가짜 모델의 손 높이 0.73 기준)", async () => {
    const { book } = await holdBook();
    expect(new THREE.Box3().setFromObject(book).max.y).toBeLessThan(1.513);
  });

  it("[그대로] 책은 두 손의 가운데에서 좌우로 0.1칸 안이고, 손보다 앞(+z)이다", async () => {
    const { bone, book, handle } = await holdBook();
    const right = bone("hand_r").getWorldPosition(new THREE.Vector3());
    const left = bone("hand_l").getWorldPosition(new THREE.Vector3());
    const mid = right.clone().add(left).multiplyScalar(0.5);
    const at = book.getWorldPosition(new THREE.Vector3());
    expect(Math.abs(at.x - mid.x)).toBeLessThanOrEqual(0.1);
    expect(at.z).toBeGreaterThan(mid.z);
    expect(handle.group.position.x).toBe(4);
  });

  it("[바뀔] 책 크기는 체형에 맞춘다: 덮개 높이가 키의 0.273배(지금 라룹이: 0.62 / 2.27) ±25%다", async () => {
    const { book } = await holdBook();
    let height = 0;
    book.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh.material as THREE.Material).side === THREE.BackSide) return;
      const parameters = (mesh.geometry as THREE.BoxGeometry).parameters;
      const scale = new THREE.Vector3();
      mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      height = Math.max(height, parameters.height * scale.y);
    });
    const expected = 0.273 * 1.513;
    expect(height).toBeGreaterThanOrEqual(expected * 0.75);
    expect(height).toBeLessThanOrEqual(expected * 1.25);
  });
});

// ---------- 기본 착장과 고글 ----------

describe("[spec] 134-① 기본 착장은 GLB의 티셔츠·반바지·양말·운동화이고, 라룹이 고글은 그리지 않는다", () => {
  const NO_LOOK_ALL: WearLook = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

  it("[바뀔] 입은 것을 모를 때(look 없음) 라룹이 고글(wear-goggles.glb)을 읽지도 그리지도 않는다", async () => {
    const { model } = await draw(undefined);
    expect(mockLoaded).not.toContain("wear-goggles.glb");
    expect(model.getObjectByName("wear-goggles")).toBeUndefined();
  });

  it("[바뀔] 입은 것의 얼굴장식이 goggles여도 라룹이 고글을 읽지 않는다", async () => {
    await draw({ ...NO_LOOK_ALL, face: "goggles" });
    expect(mockLoaded).not.toContain("wear-goggles.glb");
  });

  it("[그대로] 아무것도 입지 않아도(look이 모두 없음) 기본 착장 메시 열한 개가 모두 보이고 읽는 모델 파일은 플레이어 하나뿐이다", async () => {
    const { model } = await draw(NO_LOOK_ALL);
    const shown = MESHES.filter((name) => model.getObjectByName(name)?.visible === true);
    expect(shown.sort()).toEqual([...MESHES].sort());
    expect(new Set(mockLoaded).size).toBe(1);
  });
});
