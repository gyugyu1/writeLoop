// [spec] qa 테스트(작업 131 ① 버들 모델·동작, 기능 변경, 모바일): 사람형 버들 모델, Idle 첫 프레임·믹서 갱신·정리, 걷기 클립.
// 기대값은 private 작업 폴더 131-2026-11-20-가구점-버들-구매/02-버들-모델-동작/01-main-spec.md(와 부모 01-main-spec.md의 A)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다: buildShop(실내, 버들, 상품 배열, kit).shopkeeper, ShopModel(products·daylight·kit·outline·pickTargets).
// 새 이름을 가정하지 않으려고 THREE.AnimationMixer 원형(update·clipAction·stopAllAction·uncacheRoot)을 지켜보고,
// 프레임 갱신은 useFrame(callback(state, delta))을 가짜로 받아 직접 부른다.
// 걷기 클립은 "Idle 말고 clipAction으로 만든 클립"으로 찾는다(가정: 버들 믹서에 clipAction(AnimationClip 객체)으로 붙이며, 장면을 짓거나 첫 프레임을 돌릴 때까지는 붙인다).
// 걷기↔Idle 전환(약 0.2초)은 ①에서 버들이 걷지 않아 이름 없이는 부를 수 없어 여기서 보지 못한다(보고에 적음).
import { act, render } from "@testing-library/react-native";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const mockGltf: { interior: GLTF | null; keeper: GLTF | null } = { interior: null, keeper: null };
const mockFrames = new Set<(state: unknown, delta: number) => void>();

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "three.module.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "loaders", "GLTFLoader.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "SkeletonUtils.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({
  // 켜져 있는 동안(마운트된 동안)만 프레임 콜백을 받는다
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const ref = React.useRef(callback);
    ref.current = callback;
    React.useEffect(() => {
      const tick = (state: unknown, delta: number) => ref.current(state, delta);
      mockFrames.add(tick);
      return () => {
        mockFrames.delete(tick);
      };
    }, []);
  },
  useLoader: Object.assign((_loader: unknown, url: string) => (url === "interior.glb" ? mockGltf.interior : mockGltf.keeper), { clear: () => {} }),
  useThree: () => ({ scene: {} })
}));
jest.mock("../../assets/models/shop/furniture-shop-interior.glb", () => "interior.glb");
jest.mock("../../assets/models/shop/beodeul.glb", () => "beodeul.glb");
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require("three") as typeof import("three");
  return { OUTLINE_THICKNESS: 0.012, characterOutlineMaterial: () => new three.MeshBasicMaterial({ side: three.BackSide }) };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js") as typeof import("three/examples/jsm/loaders/GLTFLoader.js");
const { clone: cloneSkinned } = require("three/examples/jsm/utils/SkeletonUtils.js") as typeof import("three/examples/jsm/utils/SkeletonUtils.js");
const { buildShop, ShopModel } = require("@/components/lobby3d/lobby3d-shop") as typeof import("@/components/lobby3d/lobby3d-shop");
const shop = require("@/lib/lobby3d/shop") as typeof import("@/lib/lobby3d/shop");
/* eslint-enable @typescript-eslint/no-require-imports */

const MOBILE = join(__dirname, "../..");
const APP_MODELS = join(MOBILE, "assets/models/shop");
const ORIGINAL = "C:/WriteLoop-asset/이웃/버들-가구점_주인_사람형/3d/WriteLoop_Beodeul_Human.glb";

function withoutImages(data: Buffer): ArrayBuffer {
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.toString("utf8", 20, 20 + jsonLength)) as {
    images?: unknown;
    textures?: unknown;
    samplers?: unknown;
    materials?: { pbrMetallicRoughness?: Record<string, unknown>; normalTexture?: unknown; emissiveTexture?: unknown; occlusionTexture?: unknown }[];
  };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.emissiveTexture;
    delete m.occlusionTexture;
  }
  let text = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const bin = data.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + bin.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([header, text, bin]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function load(file: string): Promise<GLTF> {
  return new GLTFLoader().parseAsync(withoutImages(readFileSync(join(APP_MODELS, file))), "");
}

function rawJson(file: string): { nodes: { name: string }[]; skins: { joints: number[] }[]; animations: { name: string }[] } {
  const data = readFileSync(file);
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString("utf8"));
}

let keeper: GLTF;
beforeAll(async () => {
  mockGltf.interior = await load("furniture-shop-interior.glb");
  mockGltf.keeper = await load("beodeul.glb");
  keeper = mockGltf.keeper;
}, 60000);

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });
const daylight = { ambience: { ambientColor: 0xffffff, ambientIntensity: 1, sunColor: 0xffffff, sunIntensity: 1 } } as never;

// 믹서 원형을 지켜본다: 누가 갱신됐고, 멈춰 정리됐고, 어떤 클립이 붙었는지
const updated = new Set<THREE.AnimationMixer>();
const stopped = new Set<THREE.AnimationMixer>();
const uncached = new Set<THREE.AnimationMixer>();
const clips: { mixer: THREE.AnimationMixer; clip: THREE.AnimationClip; action: THREE.AnimationAction }[] = [];
beforeEach(() => {
  updated.clear();
  stopped.clear();
  uncached.clear();
  clips.length = 0;
  mockFrames.clear();
  const proto = THREE.AnimationMixer.prototype;
  const update = proto.update;
  const stopAll = proto.stopAllAction;
  const uncache = proto.uncacheRoot;
  const clipAction = proto.clipAction;
  jest.spyOn(proto, "update").mockImplementation(function (this: THREE.AnimationMixer, delta: number) {
    updated.add(this);
    return update.call(this, delta);
  });
  jest.spyOn(proto, "stopAllAction").mockImplementation(function (this: THREE.AnimationMixer) {
    stopped.add(this);
    return stopAll.call(this);
  });
  jest.spyOn(proto, "uncacheRoot").mockImplementation(function (this: THREE.AnimationMixer, root: THREE.Object3D | THREE.AnimationObjectGroup) {
    uncached.add(this);
    return uncache.call(this, root);
  });
  jest.spyOn(proto, "clipAction").mockImplementation(function (this: THREE.AnimationMixer, clip: THREE.AnimationClip | string, root?: THREE.Object3D | THREE.AnimationObjectGroup, blendMode?: THREE.AnimationBlendMode) {
    const action = clipAction.call(this, clip as THREE.AnimationClip, root, blendMode);
    if (typeof clip !== "string" && action) clips.push({ mixer: this, clip, action });
    return action;
  });
});
afterEach(() => {
  shop.resetShopDisplay();
  jest.restoreAllMocks();
});

/** 뼈 이름 → 뼈. */
function bonesOf(root: THREE.Object3D): Map<string, THREE.Bone> {
  const out = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) out.set(o.name, o as THREE.Bone);
  });
  return out;
}

/** 모델 원본의 Idle을 다른 구현과 상관없이 직접 적용한 기준 자세(시각 t초). 원본을 복제해서 만든다. */
function referenceIdle(t: number): THREE.Object3D {
  const model = cloneSkinned(keeper.scene);
  const idle = keeper.animations.find((a) => a.name === "Idle")!;
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(idle).play();
  mixer.setTime(t);
  return model;
}

/** 두 모델의 뼈 자세(자리·회전·크기)가 같은지. 다르면 어느 뼈인지 알리도록 이름과 차이를 돌려준다. */
function poseDiff(a: THREE.Object3D, b: THREE.Object3D): { name: string; position: number; rotation: number; scale: number } | null {
  const bb = bonesOf(b);
  for (const [name, bone] of bonesOf(a)) {
    const other = bb.get(name);
    if (!other) return { name, position: Infinity, rotation: Infinity, scale: Infinity };
    const position = bone.position.distanceTo(other.position);
    const rotation = 1 - Math.abs(bone.quaternion.dot(other.quaternion));
    const scale = bone.scale.distanceTo(other.scale);
    if (position > 1e-4 || rotation > 1e-9 || scale > 1e-4) return { name, position, rotation, scale };
  }
  return null;
}

/** 버들 모델(복제, 배율 2.27을 쓴 묶음 안쪽). */
const modelOf = (shopkeeper: THREE.Object3D) => shopkeeper.children[0];

describe("[spec] 사람형 버들 모델 파일(명세 1)", () => {
  it("M1: 앱 beodeul.glb는 사람형 원본(1,624,544바이트, 뼈 16개, 클립 Idle 하나)이고 원본이 이 컴퓨터에 있으면 바이트가 같다", () => {
    const file = join(APP_MODELS, "beodeul.glb");
    expect(statSync(file).size).toBe(1624544);
    const json = rawJson(file);
    expect(json.skins[0].joints).toHaveLength(16);
    expect(json.animations.map((a) => a.name)).toEqual(["Idle"]);
    if (existsSync(ORIGINAL)) expect(readFileSync(file).equals(readFileSync(ORIGINAL))).toBe(true);
  });

  it("M2: 읽은 모델의 Idle은 약 4초, 뼈 이름에 다리(leg_l·leg_r)와 팔(arm_l·arm_r)이 있다", () => {
    const idle = keeper.animations.find((a) => a.name === "Idle")!;
    expect(idle.duration).toBeGreaterThan(3.9);
    expect(idle.duration).toBeLessThan(4.1);
    const names = [...bonesOf(keeper.scene).keys()];
    for (const name of ["leg_l", "leg_r", "arm_l", "arm_r"]) expect(names).toContain(name);
  });

  it("M3: 앱 CREDITS.md의 버들 줄은 한 줄이고 WriteLoop 제작이며, 옛 비버·19개 본 설명이 없고 사람형 모델로 적혀 있다", () => {
    const lines = readFileSync(join(MOBILE, "assets/models/CREDITS.md"), "utf8").split(/\r?\n/);
    const rows = lines.filter((l) => l.startsWith("| `shop/beodeul.glb`"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("WriteLoop");
    expect(rows[0]).not.toContain("비버");
    expect(rows[0]).not.toContain("19개");
    expect(rows[0]).toContain("사람");
  });
});

describe("[spec] 그대로여야 할 버들(명세 '그대로')", () => {
  it("K1: 자리 CheckoutNPC·방향 SHOPKEEPER_HEADING·배율 2.27·카툰 재질과 외곽선 껍질·재입장 때 1명·누르기 통(계산대 장소)", () => {
    const built = buildShop(mockGltf.interior!, keeper, [], kit());
    built.root.updateMatrixWorld(true);
    const at = built.shopkeeper.getWorldPosition(new THREE.Vector3());
    expect(at.x).toBeCloseTo(shop.SHOP_NODES.checkoutNpc.x, 3);
    expect(at.z).toBeCloseTo(shop.SHOP_NODES.checkoutNpc.z, 3);
    expect(at.y).toBeCloseTo(0, 3);
    expect(built.shopkeeper.rotation.y).toBeCloseTo(shop.SHOPKEEPER_HEADING, 6);
    expect(modelOf(built.shopkeeper).scale.x).toBeCloseTo(2.27, 6);
    const bodies: THREE.SkinnedMesh[] = [];
    const shells: THREE.SkinnedMesh[] = [];
    built.shopkeeper.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      if (mesh.material instanceof THREE.MeshToonMaterial) bodies.push(mesh);
      else if (mesh.material instanceof THREE.MeshBasicMaterial && mesh.material.side === THREE.BackSide) shells.push(mesh);
    });
    expect(bodies.length).toBeGreaterThan(0);
    expect(shells).toHaveLength(bodies.length);
    const hits = built.pickTargets.filter((t) => (t.userData as { shopPlace?: string }).shopPlace === "shopCounter" && t.parent === built.shopkeeper);
    expect(hits).toHaveLength(1);
    const again = buildShop(mockGltf.interior!, keeper, [], kit());
    let n = 0;
    again.root.traverse((o) => {
      if (o.name === "shopkeeper") n += 1;
    });
    expect(n).toBe(1);
  });

  it("K2: 몸 높이가 라룹이와 같은 2.27이고 발이 바닥에 닿는다(사람형 모델, 팔을 내린 Idle 자세)", () => {
    const built = buildShop(mockGltf.interior!, keeper, [], kit());
    built.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modelOf(built.shopkeeper));
    expect(box.min.y).toBeCloseTo(0, 1);
    expect(box.max.y - box.min.y).toBeCloseTo(2.27, 1);
  });
});

describe("[spec] Idle 첫 프레임과 믹서(명세 2·3)", () => {
  it("I1: 장면을 짓자마자(프레임을 한 번도 돌리지 않고) 버들의 뼈 자세가 Idle의 첫 프레임이다(T포즈가 아니다)", () => {
    const built = buildShop(mockGltf.interior!, keeper, [], kit());
    const reference = referenceIdle(0);
    expect(poseDiff(modelOf(built.shopkeeper), reference)).toBeNull();
    // 기준이 T포즈와 다른지(기준이 엉뚱하게 T포즈로 나오지 않았는지): 팔이 어깨보다 한참 아래로 처진다
    const ref = bonesOf(reference);
    reference.updateMatrixWorld(true);
    const arm = ref.get("arm_l")!.getWorldPosition(new THREE.Vector3());
    const forearm = ref.get("forearm_l")!.getWorldPosition(new THREE.Vector3());
    expect(arm.y - forearm.y).toBeGreaterThan(0.05);
    // 지은 장면의 버들도 팔이 아래로 처진다
    built.root.updateMatrixWorld(true);
    const bones = bonesOf(built.shopkeeper);
    const a = bones.get("arm_l")!.getWorldPosition(new THREE.Vector3());
    const f = bones.get("forearm_l")!.getWorldPosition(new THREE.Vector3());
    expect(a.y - f.y).toBeGreaterThan(0.05 * 2.27);
  });

  it("I2: 버들 복제본에만 자세를 적용한다: 읽어 둔 모델 원본(앱 전체가 함께 쓰는 것)의 뼈는 그대로 T포즈다", () => {
    const before = new Map<string, THREE.Quaternion>();
    bonesOf(keeper.scene).forEach((b, name) => before.set(name, b.quaternion.clone()));
    buildShop(mockGltf.interior!, keeper, [], kit());
    bonesOf(keeper.scene).forEach((b, name) => expect({ name, same: b.quaternion.equals(before.get(name)!) }).toEqual({ name, same: true }));
  });

  it("I3: ShopModel은 가게에 있는 동안 프레임마다 믹서를 갱신해 Idle이 되풀이된다(1초 뒤 Idle 1초 자세, 4초 지나 처음 자세로 돌아와 5초 뒤는 1초 뒤와 같다)", async () => {
    const lastPick = { current: [] as THREE.Object3D[] };
    await render(<ShopModel products={emptyProducts()} daylight={daylight} kit={kit()} outline={1} pickTargets={lastPick} />);
    await settle();
    const shopkeeper = lastPick.current.find((t) => t.parent?.name === "shopkeeper")!.parent!;
    const model = modelOf(shopkeeper);
    expect(poseDiff(model, referenceIdle(0))).toBeNull();
    expect(mockFrames.size).toBeGreaterThan(0);
    const step = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / 0.05); i += 1) for (const frame of mockFrames) frame({ clock: { elapsedTime: 0 } }, 0.05);
    };
    step(1);
    const atOne = referenceIdle(1);
    // Idle이 실제로 움직인다(1초 자세가 0초 자세와 다르다는 것을 기준에서 확인한다)
    expect(poseDiff(referenceIdle(0), atOne)).not.toBeNull();
    expect(poseDiff(model, atOne)).toBeNull();
    step(4);
    expect(poseDiff(model, atOne)).toBeNull();
    expect(updated.size).toBe(1);
  });

  it("I4: 가게를 나가면(ShopModel이 빠지면) 믹서를 멈추고 정리한다. 다시 들어오면 새 버들에 새 믹서가 붙어 Idle이고, 갱신되는 믹서는 하나뿐이다", async () => {
    const pickA = { current: [] as THREE.Object3D[] };
    const first = await render(<ShopModel products={emptyProducts()} daylight={daylight} kit={kit()} outline={1} pickTargets={pickA} />);
    await settle();
    for (const frame of mockFrames) frame({}, 0.05);
    expect(updated.size).toBe(1);
    const firstMixer = [...updated][0];
    await act(async () => {
      first.unmount();
    });
    expect(mockFrames.size).toBe(0);
    expect(stopped.has(firstMixer) || uncached.has(firstMixer)).toBe(true);

    updated.clear();
    const pickB = { current: [] as THREE.Object3D[] };
    await render(<ShopModel products={emptyProducts()} daylight={daylight} kit={kit()} outline={1} pickTargets={pickB} />);
    await settle();
    const shopkeeperB = pickB.current.find((t) => t.parent?.name === "shopkeeper")!.parent!;
    expect(poseDiff(modelOf(shopkeeperB), referenceIdle(0))).toBeNull();
    for (const frame of mockFrames) frame({}, 0.05);
    expect(updated.size).toBe(1);
    expect(updated.has(firstMixer)).toBe(false);
  });
});

describe("[spec] 걷기 클립(명세 4)", () => {
  /** 장면을 짓고 첫 프레임까지 돌려 붙은 걷기 클립(Idle이 아닌 클립)을 찾는다. */
  async function walkClip(): Promise<{ clip: THREE.AnimationClip; action: THREE.AnimationAction }> {
    const lastPick = { current: [] as THREE.Object3D[] };
    await render(<ShopModel products={emptyProducts()} daylight={daylight} kit={kit()} outline={1} pickTargets={lastPick} />);
    await settle();
    for (const frame of mockFrames) frame({}, 0.05);
    const walks = clips.filter((c) => c.clip.name.toLowerCase() !== "idle");
    expect(walks.map((c) => c.clip.name)).toHaveLength(1);
    return walks[0];
  }

  /** Idle 첫 프레임 위에 걷기 클립의 시각 t 값을 얹은 자세(트랙 값을 직접 읽어 적용한다). */
  function walkPose(clip: THREE.AnimationClip, t: number): THREE.Object3D {
    const model = referenceIdle(0);
    for (const track of clip.tracks) {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
      const node = model.getObjectByName(nodeName);
      if (!node) throw new Error(`걷기 클립이 없는 뼈를 가리킵니다: ${track.name}`);
      const value = (track as unknown as { createInterpolant(): { evaluate(t: number): ArrayLike<number> } }).createInterpolant().evaluate(t);
      if (propertyName === "quaternion") node.quaternion.fromArray(value as unknown as number[]);
      else if (propertyName === "position") node.position.fromArray(value as unknown as number[]);
      else if (propertyName === "scale") node.scale.fromArray(value as unknown as number[]);
    }
    model.updateMatrixWorld(true);
    return model;
  }

  /** 모델 앞쪽(+Z)으로 본 발·손 앞뒤 위치 차(왼쪽 − 오른쪽). */
  function swing(model: THREE.Object3D): { feet: number; hands: number } {
    const bones = bonesOf(model);
    const z = (name: string) => bones.get(name)!.getWorldPosition(new THREE.Vector3()).z;
    return { feet: z("foot_l") - z("foot_r"), hands: z("hand_l") - z("hand_r") };
  }

  it("W1: 걷기 클립은 한 걸음 주기 약 0.8초이고 되풀이한다", async () => {
    const { clip, action } = await walkClip();
    expect(clip.duration).toBeGreaterThan(0.75);
    expect(clip.duration).toBeLessThan(0.85);
    expect(action.loop).toBe(THREE.LoopRepeat);
  });

  it("W2: 걷기 클립은 다리(leg_l·leg_r)와 팔(arm_l·arm_r)을 움직이고, 모델에 없는 뼈를 가리키지 않는다", async () => {
    const { clip } = await walkClip();
    const targets = new Set(clip.tracks.map((t) => THREE.PropertyBinding.parseTrackName(t.name).nodeName));
    for (const name of ["leg_l", "leg_r", "arm_l", "arm_r"]) expect(targets.has(name)).toBe(true);
    const names = new Set(bonesOf(keeper.scene).keys());
    for (const name of targets) expect({ name, exists: names.has(name) }).toEqual({ name, exists: true });
  });

  it("W3: 두 다리가 앞뒤로 엇갈리고(왼발이 앞이면 오른발이 뒤, 반 주기 뒤 반대), 팔은 같은 때 다리와 반대로 흔든다", async () => {
    const { clip } = await walkClip();
    const quarter = clip.duration / 4;
    const a = swing(walkPose(clip, quarter));
    const b = swing(walkPose(clip, quarter * 3));
    // 다리는 눈에 띄게(키 1.0 모델에서 발 사이가 0.05 넘게) 엇갈리고 반 주기 뒤 부호가 뒤집힌다
    expect(Math.abs(a.feet)).toBeGreaterThan(0.05);
    expect(Math.abs(b.feet)).toBeGreaterThan(0.05);
    expect(Math.sign(a.feet)).toBe(-Math.sign(b.feet));
    // 팔은 다리와 반대: 왼발이 앞이면 왼손은 뒤
    expect(Math.abs(a.hands)).toBeGreaterThan(0.005);
    expect(Math.abs(b.hands)).toBeGreaterThan(0.005);
    expect(Math.sign(a.hands)).toBe(-Math.sign(a.feet));
    expect(Math.sign(b.hands)).toBe(-Math.sign(b.feet));
  });

  it("W4: 걷기 클립은 Idle 첫 프레임 자세를 바탕으로 해서 팔이 T포즈로 벌어지지 않는다(걷는 동안 팔이 어깨 아래에 있다)", async () => {
    const { clip } = await walkClip();
    for (const t of [0, clip.duration / 4, clip.duration / 2, (clip.duration * 3) / 4]) {
      const bones = bonesOf(walkPose(clip, t));
      for (const side of ["l", "r"]) {
        const arm = bones.get(`arm_${side}`)!.getWorldPosition(new THREE.Vector3());
        const hand = bones.get(`hand_${side}`)!.getWorldPosition(new THREE.Vector3());
        expect({ t, side, droops: arm.y - hand.y > 0.1 }).toEqual({ t, side, droops: true });
      }
    }
  });

  it("W5: 한 주기가 끝나면 처음 자세로 돌아와 이어진다(처음과 한 주기 뒤의 발·손 위치가 같다)", async () => {
    const { clip } = await walkClip();
    const start = swing(walkPose(clip, 0));
    const end = swing(walkPose(clip, clip.duration));
    expect(end.feet).toBeCloseTo(start.feet, 2);
    expect(end.hands).toBeCloseTo(start.hands, 2);
  });
});

describe("[spec] ①에서는 버들이 늘 Idle(명세 4 끝)", () => {
  it("N1: 가게에 있는 동안 몇 초가 지나도 버들의 자리·방향은 그대로이고 몸은 Idle 자세를 따른다(걷는 자세로 바뀌지 않는다)", async () => {
    const lastPick = { current: [] as THREE.Object3D[] };
    await render(<ShopModel products={emptyProducts()} daylight={daylight} kit={kit()} outline={1} pickTargets={lastPick} />);
    await settle();
    const shopkeeper = lastPick.current.find((t) => t.parent?.name === "shopkeeper")!.parent!;
    const position = shopkeeper.position.clone();
    const rotation = shopkeeper.rotation.y;
    for (let i = 0; i < 60; i += 1) for (const frame of mockFrames) frame({}, 0.05);
    expect(shopkeeper.position.toArray()).toEqual(position.toArray());
    expect(shopkeeper.rotation.y).toBe(rotation);
    // 3초 뒤: Idle 3초 자세와 같다
    expect(poseDiff(modelOf(shopkeeper), referenceIdle(3))).toBeNull();
  });
});

function emptyProducts() {
  const out = {} as Record<string, { model: string; nameplate: string }>;
  for (const p of shop.SHOP_PRODUCTS) out[p.id] = { model: "missing", nameplate: "missing" };
  return out as never;
}

async function settle() {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}
