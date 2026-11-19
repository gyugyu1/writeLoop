// 메인 세션 테스트(작업 128 가구점 실내): 실내 데이터가 모델 파일과 맞는지, 실내에서 걷기·장소·버들 인사·진열 바꾸기.
import { readFileSync } from "fs";
import { join } from "path";
import { LobbySim, SHOP_MARKS, applyArea, findPath, isFree, markInfo, type FloorPoint } from "@/lib/lobby3d/engine";
import {
  DEFAULT_SHOP_DISPLAY,
  SHOP_NODES,
  SHOP_OFFSET,
  SHOP_SLOTS,
  SHOPKEEPER_GREETING,
  displayScale,
  resetShopDisplay,
  setShopDisplay,
  shopDisplay,
  shopSolidAt
} from "@/lib/lobby3d/shop";

const MODELS = join(__dirname, "../../assets/models/shop");

interface GltfNode {
  name: string;
  translation?: number[];
  extras?: Record<string, unknown>;
  mesh?: number;
}
interface Gltf {
  nodes: GltfNode[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { min?: number[]; max?: number[] }[];
}

function gltfJson(file: string): Gltf {
  const data = readFileSync(join(MODELS, file));
  const length = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + length).toString("utf8")) as Gltf;
}

const interior = gltfJson("furniture-shop-interior.glb");
const node = (name: string) => {
  const found = interior.nodes.find((n) => n.name === name);
  if (!found) throw new Error(`no node ${name}`);
  return found;
};
const appPoint = (name: string): FloorPoint => {
  const t = node(name).translation ?? [0, 0, 0];
  return { x: t[0] + SHOP_OFFSET.x, z: t[2] + SHOP_OFFSET.z };
};

let now = 1_000_000;

afterEach(() => {
  applyArea("room");
  resetShopDisplay();
});

describe("실내 데이터와 모델 파일", () => {
  it("자리 노드(PlayerSpawn·ExitTrigger·CheckoutNPC·CheckoutInteract)가 모델과 같은 자리다", () => {
    for (const [key, name] of [
      ["playerSpawn", "PlayerSpawn"],
      ["exitTrigger", "ExitTrigger"],
      ["checkoutNpc", "CheckoutNPC"],
      ["checkoutInteract", "CheckoutInteract"]
    ] as const) {
      const p = appPoint(name);
      expect(SHOP_NODES[key].x).toBeCloseTo(p.x, 3);
      expect(SHOP_NODES[key].z).toBeCloseTo(p.z, 3);
    }
  });

  it("진열대 슬롯의 자리와 safe_radius_m·max_height_m이 모델 메타데이터와 같다", () => {
    for (const slot of SHOP_SLOTS) {
      const n = node(slot.node);
      const p = appPoint(slot.node);
      expect(slot.center.x).toBeCloseTo(p.x, 3);
      expect(slot.center.z).toBeCloseTo(p.z, 3);
      expect(slot.safeRadius).toBe(n.extras?.safe_radius_m);
      expect(slot.maxHeight).toBe(n.extras?.max_height_m);
    }
  });

  it("앞쪽에서 숨길 노드와 문짝이 모델에 있다", () => {
    for (const name of ["ShopFront_Frame", "ShopFront_Glass", "ShopFront_EntryCasing", "ShopLeft_Frame", "ShopLeft_Glass", "ShopDoor"]) {
      expect(interior.nodes.some((n) => n.name === name)).toBe(true);
    }
  });
});

describe("실내 걷기", () => {
  beforeEach(() => applyArea("shop"));

  it("들어서는 자리와 모든 장소의 서는 자리에 설 수 있고, 출입문에서 모두 걸어갈 수 있다", () => {
    expect(isFree(SHOP_NODES.playerSpawn.x, SHOP_NODES.playerSpawn.z)).toBe(true);
    const from = SHOP_MARKS.shopExit.approach[0];
    for (const mark of Object.values(SHOP_MARKS)) {
      const goal = mark.approach[0];
      expect({ id: mark.id, free: isFree(goal.x, goal.z) }).toEqual({ id: mark.id, free: true });
      expect({ id: mark.id, path: findPath(from, [goal]) !== null }).toEqual({ id: mark.id, path: true });
    }
  });

  it("계산대·진열대·선반은 걸을 수 없는 곳이다", () => {
    expect(shopSolidAt(SHOP_NODES.checkoutNpc.x, SHOP_NODES.checkoutNpc.z)).toBe(true);
    for (const slot of SHOP_SLOTS) expect(isFree(slot.center.x, slot.center.z)).toBe(false);
    expect(isFree(3.5 + SHOP_OFFSET.x, -0.1 + SHOP_OFFSET.z)).toBe(false);
  });

  it("걸어가는 동안 계산대·진열대를 뚫지 않는다(지나는 모든 프레임이 설 수 있는 자리)", () => {
    const spawn = SHOP_NODES.playerSpawn;
    const sim = new LobbySim({ x: spawn.x, z: spawn.z, random: () => 0.5 });
    for (const id of ["shopCounter", "shopSlot1", "shopSlot3", "shopSlot2", "shopExit"] as const) {
      sim.pointerDown({ point: null, mark: id, onCharacter: false }, 0, 0, now);
      sim.pointerUp(now + 10);
      for (let i = 0; i < 400; i += 1) {
        now += 50;
        sim.update(0.05, now);
        expect(isFree(sim.x, sim.z)).toBe(true);
      }
      expect(sim.snapshot(now).arrived).toBe(id);
    }
  });

  it("진열대를 누르면(걸을 수 없는 곳) 가까운 걸을 수 있는 곳으로 간다", () => {
    const spawn = SHOP_NODES.playerSpawn;
    const sim = new LobbySim({ x: spawn.x, z: spawn.z, random: () => 0.5 });
    const target = SHOP_SLOTS[1].center;
    expect(sim.goTo(target, null)).toBe(true);
  });
});

describe("실내 장소와 버들 인사", () => {
  beforeEach(() => applyArea("shop"));

  it("들어선 자리에서는 출입문 안내가 뜬다", () => {
    const spawn = SHOP_NODES.playerSpawn;
    const sim = new LobbySim({ x: spawn.x, z: spawn.z, random: () => 0.5 });
    const snap = sim.snapshot(now);
    expect(snap.place).toBe("shopExit");
    expect(snap.bubbleText).toBe("마을로 나갈까?");
    expect(snap.bubbleButton).toBe("나가기");
  });

  it("인사하기: 버들 말풍선이 3초 뜨고 그동안 라룹이 장소 말풍선은 거둔다", () => {
    const at = SHOP_NODES.checkoutInteract;
    const sim = new LobbySim({ x: at.x, z: at.z, random: () => 0.5 });
    expect(sim.snapshot(now).place).toBe("shopCounter");
    sim.greetShopkeeper(now);
    let snap = sim.snapshot(now);
    expect(snap.npcText).toBe(SHOPKEEPER_GREETING);
    expect(snap.place).toBeNull();
    expect(snap.bubbleText).toBe("");
    expect(snap.action?.type).toBe("wave");
    snap = sim.snapshot(now + 3001);
    expect(snap.npcText).toBe("");
    expect(snap.place).toBe("shopCounter");
  });

  it("동작 줄이기면 손을 흔들지 않고 말풍선만 뜬다", () => {
    const at = SHOP_NODES.checkoutInteract;
    const sim = new LobbySim({ x: at.x, z: at.z, reduceMotion: true, random: () => 0.5 });
    sim.greetShopkeeper(now);
    expect(sim.snapshot(now).action).toBeNull();
    expect(sim.snapshot(now).npcText).toBe(SHOPKEEPER_GREETING);
  });
});

describe("진열", () => {
  it("처음 진열은 호두껍질 침대·이부자리·구름 책상이고, 한 슬롯을 바꾸면 그 슬롯만 바뀐다", () => {
    expect(shopDisplay()).toEqual(["walnutBed", "grandmasFloorBedding", "cloudDesk"]);
    expect(shopDisplay()).toEqual(DEFAULT_SHOP_DISPLAY);
    setShopDisplay(1, "cloudDesk");
    expect(shopDisplay()).toEqual(["walnutBed", "cloudDesk", "cloudDesk"]);
    expect(markInfo("shopSlot2").prompt).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    expect(markInfo("shopSlot1").prompt).toBe("호두껍질 침대야.\n다른 가구로 바꿔 볼까?");
    setShopDisplay(0, "grandmasFloorBedding");
    expect(markInfo("shopSlot1").prompt).toBe("할머니 댁 이부자리야.\n다른 가구로 바꿔 볼까?");
  });

  it("큰 상품은 슬롯 반경·높이에 들게 균일 축소하고, 작은 상품은 키우지 않는다", () => {
    const bed = { minX: -0.805, maxX: 0.805, minZ: -1.486, maxZ: 1.486, height: 1.296 };
    const scale = displayScale(bed, SHOP_SLOTS[0]);
    expect(Math.hypot(0.805, 1.486) * scale).toBeCloseTo(0.9, 5);
    expect(displayScale({ minX: -0.1, maxX: 0.1, minZ: -0.1, maxZ: 0.1, height: 0.2 }, SHOP_SLOTS[0])).toBe(1);
    expect(displayScale({ minX: -0.1, maxX: 0.1, minZ: -0.1, maxZ: 0.1, height: 3.6 }, SHOP_SLOTS[2])).toBeCloseTo(0.5, 5);
  });
});
