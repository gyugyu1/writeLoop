// 메인 세션 테스트(작업 128 가구점 실내, 130 새 매장): 실내 데이터가 모델 파일·shop-layout.json과 맞는지, 실내에서 걷기·장소·버들 인사·진열 바꾸기·크기 검사.
import { readFileSync } from "fs";
import { join } from "path";
import { LobbySim, SHOP_MARKS, applyArea, findPath, isFree, markInfo, type FloorPoint } from "@/lib/lobby3d/engine";
import {
  DEFAULT_SHOP_DISPLAY,
  SHOP_NODES,
  SHOP_OFFSET,
  SHOP_SLOTS,
  SHOPKEEPER_GREETING,
  fitsShopSlot,
  resetShopDisplay,
  setShopDisplay,
  shopDisplay,
  shopSolidAt
} from "@/lib/lobby3d/shop";

// 가구점 실내 모델은 앱에 들어 있다(진열 상품은 서버 아이템 목록 파일 폴더)
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
      expect(slot.pedestalRadius).toBe(n.extras?.pedestal_radius_m);
      const approach = n.extras?.approach_xz_m as number[];
      expect(slot.approach.x).toBeCloseTo(approach[0] + SHOP_OFFSET.x, 3);
      expect(slot.approach.z).toBeCloseTo(approach[1] + SHOP_OFFSET.z, 3);
    }
  });

  it("(130) 진열대는 여섯이고, 명패 받침·새겨진 글자 노드가 모델에 있으며 오프셋은 (9, 8)이다", () => {
    expect(SHOP_SLOTS.map((s) => s.node)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `DisplaySlot_0${n}`));
    expect(SHOP_OFFSET).toEqual({ x: 9, z: 8 });
    for (const slot of SHOP_SLOTS) {
      expect(interior.nodes.some((n) => n.name === slot.nameplate)).toBe(true);
      expect(node(slot.glyph).extras?.display_name_ko).toEqual(expect.any(String));
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
    // 오른쪽 벽 선반(wallShelf)과 명패(nameplate01)
    expect(isFree(6.3 + SHOP_OFFSET.x, -6.85 + SHOP_OFFSET.z)).toBe(false);
    expect(shopSolidAt(-4.06 + SHOP_OFFSET.x, 3.0 + SHOP_OFFSET.z)).toBe(true);
  });

  it("걸어가는 동안 계산대·진열대를 뚫지 않는다(지나는 모든 프레임이 설 수 있는 자리)", () => {
    const spawn = SHOP_NODES.playerSpawn;
    const sim = new LobbySim({ x: spawn.x, z: spawn.z, random: () => 0.5 });
    for (const id of ["shopSlot6", "shopSlot5", "shopSlot4", "shopSlot3", "shopSlot2", "shopSlot1", "shopCounter", "shopExit"] as const) {
      sim.pointerDown({ point: null, mark: id, onCharacter: false }, 0, 0, now);
      sim.pointerUp(now + 10);
      for (let i = 0; i < 600; i += 1) {
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
  it("(130) 처음 진열은 장화 화분·고양이 편지 책상·별지기 침대·호두 침대·이부자리·구름 책상이고, 한 슬롯을 바꾸면 그 슬롯만 바뀐다", () => {
    expect(shopDisplay()).toEqual(["rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"]);
    expect(shopDisplay()).toEqual(DEFAULT_SHOP_DISPLAY);
    expect(markInfo("shopSlot1").prompt).toBe("장화 화분이야.\n다른 가구로 바꿔 볼까?");
    expect(markInfo("shopSlot4").prompt).toBe("호두 침대야.\n다른 가구로 바꿔 볼까?");
    setShopDisplay(1, "cloudDesk");
    expect(shopDisplay()).toEqual(["rainbootPlanter", "cloudDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"]);
    expect(markInfo("shopSlot2").prompt).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    setShopDisplay(0, "grandmasFloorBedding");
    expect(markInfo("shopSlot1").prompt).toBe("이부자리야.\n다른 가구로 바꿔 볼까?");
  });

  it("(130) 크기 검사: 가장 먼 바닥 모서리가 1.79 안이고 높이가 2.55 안이면 원본 배율로 진열할 수 있다", () => {
    const stargazer = { minX: -0.843, maxX: 0.843, minZ: -1.525, maxZ: 1.525, height: 1.895 };
    expect(fitsShopSlot(stargazer, SHOP_SLOTS[2])).toBe(true);
    expect(fitsShopSlot({ minX: -1.3, maxX: 1.3, minZ: -1.3, maxZ: 1.3, height: 1 }, SHOP_SLOTS[0])).toBe(false);
    expect(fitsShopSlot({ minX: -0.2, maxX: 0.2, minZ: -0.2, maxZ: 0.2, height: 2.6 }, SHOP_SLOTS[0])).toBe(false);
  });
});
