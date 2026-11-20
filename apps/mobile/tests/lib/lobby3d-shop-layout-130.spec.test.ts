// [spec] qa 테스트(작업 130 가구점 새 매장·명패, 기능 변경, 모바일): 새 매장 데이터(shop.ts·engine)와 상품 여섯.
// 기대값은 private 작업 폴더 130-2026-11-20-가구점-새-매장-명패/01-main-spec.md(명세 1·2)에서만 가져온다.
// 매장 좌표는 명세가 가리키는 shop-layout.json의 값(모델 좌표)을 그대로 옮겨 쓰고, 앱 좌표 = 모델 X·Z + (9, 8)을 이 테스트에서 한 번만 더한다.
// 구현에서 읽은 것은 부르는 방법뿐이다(shop.ts·engine.ts의 이름은 128·129 그대로라고 가정: SHOP, SHOP_NODES, SHOP_SLOTS, SHOP_BOUNDS, SHOP_SOLID_CELLS, shopSolidAt,
// SHOP_PLACE_IDS, SHOP_SLOT_PLACES, shopSlotIndex, SHOP_LABEL_POINTS, SHOP_PRODUCTS, DEFAULT_SHOP_DISPLAY, shopDisplay, setShopDisplay, SHOP_MARKS).
import {
  LobbySim,
  SHOP_MARKS,
  activePlaceIds,
  applyArea,
  cameraPose,
  findPath,
  isFree,
  markInfo,
  type FloorPoint
} from "@/lib/lobby3d/engine";
import * as shop from "@/lib/lobby3d/shop";

/** 모델 좌표 → 앱 좌표(명세 2-2). */
const at = (x: number, z: number): FloorPoint => ({ x: x + 9, z: z + 8 });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);

/** shop-layout.json의 blockedRectsXZ(모델 좌표 x0, z0, x1, z1). 명세는 "열여섯"이라 했지만 나열된 것은 열넷이다(보고에 적음). */
const BLOCKED: Record<string, [number, number, number, number]> = {
  checkout: [0.68, 5.21, 3.0, 7.21],
  wallShelf: [5.24, -7.21, 7.36, -6.49],
  openDoor: [7.75, 5.45, 8.33, 7.21],
  signPosts: [-2.6, -7.21, 2.6, -6.94],
  studyBacking: [-8.33, -3.8, -7.83, 5.45],
  sleepBacking: [-5.08, -7.21, 4.14, -6.93],
  bedsideCabinet: [-0.68, -6.43, -0.05, -5.88],
  dayBacking: [7.85, -4.86, 8.33, 4.65],
  nameplate01: [-4.15, 2.44, -3.98, 3.56],
  nameplate02: [-4.15, -1.94, -3.98, -0.82],
  nameplate03: [-3.08, -3.19, -1.96, -3.02],
  nameplate04: [1.39, -3.19, 2.51, -3.02],
  nameplate05: [4.12, -2.9, 4.29, -1.78],
  nameplate06: [4.12, 1.5, 4.29, 2.62]
};

/** shop-layout.json의 slots(모델 좌표). */
const SLOTS = [
  { node: "DisplaySlot_01", center: [-5.94, 3.0], approach: [-3.59, 3.0] },
  { node: "DisplaySlot_02", center: [-5.94, -1.38], approach: [-3.59, -1.38] },
  { node: "DisplaySlot_03", center: [-2.52, -4.98], approach: [-2.52, -2.2] },
  { node: "DisplaySlot_04", center: [1.95, -4.98], approach: [1.95, -2.2] },
  { node: "DisplaySlot_05", center: [6.08, -2.34], approach: [3.53, -2.13] },
  { node: "DisplaySlot_06", center: [6.08, 2.06], approach: [3.53, 2.4] }
] as const;

afterEach(() => {
  applyArea("room");
  shop.resetShopDisplay();
});

describe("[spec] 새 매장 크기와 좌표(명세 2-2, 2-4)", () => {
  it("L1: 실내 바닥 18 × 16칸, 걸을 수 있는지는 0.25칸 격자", () => {
    expect(shop.SHOP.width).toBe(18);
    expect(shop.SHOP.depth).toBe(16);
    expect(shop.SHOP.cell).toBe(0.25);
  });

  it("L2: 모델 오프셋은 (9, 8) 한 번이다(앱 좌표 = 모델 X·Z + (9, 8))", () => {
    expect(shop.SHOP_OFFSET.x).toBe(9);
    expect(shop.SHOP_OFFSET.z).toBe(8);
  });

  it("L3: 들어서는 자리 (16.01, 14.65), 출입문 서는 자리 (16.11, 14.81), 버들 (10.53, 14.56), 계산대 서는 자리 (10.75, 12.47)", () => {
    expect(shop.SHOP_NODES.playerSpawn.x).toBeCloseTo(16.01, 2);
    expect(shop.SHOP_NODES.playerSpawn.z).toBeCloseTo(14.65, 2);
    expect(shop.SHOP_NODES.exitTrigger.x).toBeCloseTo(16.17, 2);
    expect(shop.SHOP_NODES.exitTrigger.z).toBeCloseTo(15.33, 2);
    expect(shop.SHOP_NODES.checkoutNpc.x).toBeCloseTo(10.53, 2);
    expect(shop.SHOP_NODES.checkoutNpc.z).toBeCloseTo(14.56, 2);
    expect(shop.SHOP_NODES.checkoutInteract.x).toBeCloseTo(10.75, 2);
    expect(shop.SHOP_NODES.checkoutInteract.z).toBeCloseTo(12.47, 2);
    expect(shop.SHOP_EXIT_APPROACH.x).toBeCloseTo(16.11, 2);
    expect(shop.SHOP_EXIT_APPROACH.z).toBeCloseTo(14.81, 2);
  });

  it("L4: 들어서는 방향은 −Z(heading π)", () => {
    expect(shop.SHOP_SPAWN_HEADING).toBeCloseTo(Math.PI, 6);
  });

  it("L5: 카메라 끝 상자 = boundsModelXYZ(±8.645 × ±7.545, 높이 −0.332~3.878)를 앱 좌표로", () => {
    expect(shop.SHOP_BOUNDS.minX).toBeCloseTo(9 - 8.645, 3);
    expect(shop.SHOP_BOUNDS.maxX).toBeCloseTo(9 + 8.645, 3);
    expect(shop.SHOP_BOUNDS.minZ).toBeCloseTo(8 - 7.545, 3);
    expect(shop.SHOP_BOUNDS.maxZ).toBeCloseTo(8 + 7.545, 3);
    expect(shop.SHOP_BOUNDS.minY).toBeCloseTo(-0.332, 3);
    expect(shop.SHOP_BOUNDS.maxY).toBeCloseTo(3.878, 3);
  });

  it("L6: 앞쪽 창틀·유리·입구 틀은 128 그대로 숨긴다", () => {
    expect([...shop.SHOP_HIDDEN_NODES].sort()).toEqual(["ShopFront_EntryCasing", "ShopFront_Frame", "ShopFront_Glass"]);
  });
});

describe("[spec] 진열대 여섯(명세 2-3, 2-4)", () => {
  it("L7: 진열대 여섯, 슬롯 노드 이름·가운데·서는 자리가 shop-layout.json과 같고 반지름 1.87·safeRadius 1.79·maxHeight 2.55", () => {
    expect(shop.SHOP_SLOTS).toHaveLength(6);
    SLOTS.forEach((s, i) => {
      const slot = shop.SHOP_SLOTS[i];
      const center = at(s.center[0], s.center[1]);
      const approach = at(s.approach[0], s.approach[1]);
      expect({ i, node: slot.node }).toEqual({ i, node: s.node });
      expect(slot.center.x).toBeCloseTo(center.x, 2);
      expect(slot.center.z).toBeCloseTo(center.z, 2);
      expect(slot.approach.x).toBeCloseTo(approach.x, 2);
      expect(slot.approach.z).toBeCloseTo(approach.z, 2);
      expect(slot.pedestalRadius).toBe(1.87);
      expect(slot.safeRadius).toBe(1.79);
      expect(slot.maxHeight).toBe(2.55);
    });
  });

  it("L8: 걸을 수 없는 곳: 가운데와 반지름 1.87 안쪽은 막히고, 그 둘레 바깥은 열려 있다(옆 방향 중 한쪽)", () => {
    for (const s of SLOTS) {
      const c = at(s.center[0], s.center[1]);
      expect(shop.shopSolidAt(c.x, c.z)).toBe(true);
      // 가운데에서 입구 쪽으로 가지 않고 통로와 직각인 방향(x·z 두 축 네 방향)으로 잰다. 명패 칸은 통로 쪽에 있다
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ];
      const inside = dirs.filter(([dx, dz]) => shop.shopSolidAt(c.x + dx * 1.8, c.z + dz * 1.8));
      expect({ node: s.node, insideAll: inside.length }).toEqual({ node: s.node, insideAll: 4 });
      const outsideFree = dirs.filter(([dx, dz]) => !shop.shopSolidAt(c.x + dx * 1.95, c.z + dz * 1.95));
      expect({ node: s.node, someOutsideFree: outsideFree.length > 0 }).toEqual({ node: s.node, someOutsideFree: true });
    }
  });
});

describe("[spec] 걸을 수 없는 곳(명세 2-3)", () => {
  it("L9: 벽 안쪽(insideXZ ±8.33 × ±7.21) 밖은 걸을 수 없고, 매장 가운데 (9, 8)은 걸을 수 있다", () => {
    expect(shop.shopSolidAt(9, 8)).toBe(false);
    for (const [x, z] of [
      [0.5, 8],
      [17.5, 8],
      [9, 0.6],
      [9, 15.4]
    ]) {
      expect({ x, z, solid: shop.shopSolidAt(x, z) }).toEqual({ x, z, solid: true });
    }
  });

  it.each(Object.entries(BLOCKED))("L10: 막힌 직사각형 %s의 가운데는 걸을 수 없다(shopSolidAt·isFree)", (_name, [x0, z0, x1, z1]) => {
    const c = at((x0 + x1) / 2, (z0 + z1) / 2);
    applyArea("shop");
    expect(shop.shopSolidAt(c.x, c.z)).toBe(true);
    expect(isFree(c.x, c.z)).toBe(false);
  });

  it("L11: 막힌 직사각형은 열네 개이고 그 가운데는 모두 막히며, 계산대 앞 통로 (10.75, 12.47)는 막히지 않는다", () => {
    expect(Object.keys(BLOCKED)).toHaveLength(14);
    expect(shop.shopSolidAt(10.75, 12.47)).toBe(false);
  });

  it("L12: 격자 칸(열,행)은 가로 72 × 세로 64이고, 매장 가운데 칸은 열려 있으며 바깥 모서리 칸은 막힌다", () => {
    expect(shop.SHOP_SOLID_CELLS.has("36,32")).toBe(false);
    expect(shop.SHOP_SOLID_CELLS.has("0,0")).toBe(true);
    expect(shop.SHOP_SOLID_CELLS.has("71,63")).toBe(true);
    for (const key of shop.SHOP_SOLID_CELLS) {
      const [c, r] = key.split(",").map(Number);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(72);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(64);
    }
  });

  it("L13: 몸 둘레 0.32 그대로: 오른쪽 벽 선반(앱 x 14.24~16.36, z 0.79~1.51) 바로 앞 0.1은 못 서고 0.8 앞은 선다", () => {
    applyArea("shop");
    expect(isFree(15, 1.51 + 0.1)).toBe(false);
    expect(isFree(15, 1.51 + 0.8)).toBe(true);
  });
});

describe("[spec] 장소와 걷기(명세 2-4, 2-7)", () => {
  it("L14: 장소 여덟: 출입문·버들·진열대 여섯(shopSlot1~shopSlot6)", () => {
    expect([...shop.SHOP_PLACE_IDS]).toEqual(["shopExit", "shopCounter", "shopSlot1", "shopSlot2", "shopSlot3", "shopSlot4", "shopSlot5", "shopSlot6"]);
    expect([...shop.SHOP_SLOT_PLACES]).toEqual(["shopSlot1", "shopSlot2", "shopSlot3", "shopSlot4", "shopSlot5", "shopSlot6"]);
    expect(shop.shopSlotIndex("shopSlot6")).toBe(5);
    expect(shop.shopSlotIndex("shopSlot4")).toBe(3);
    expect(shop.shopSlotIndex("shopCounter")).toBe(-1);
    applyArea("shop");
    expect([...activePlaceIds()].sort()).toEqual([...shop.SHOP_PLACE_IDS].sort());
  });

  it("L15: 진열대 장소의 서는 자리는 각 슬롯의 approachXZ이고 바라볼 곳은 그 진열대 가운데다", () => {
    SLOTS.forEach((s, i) => {
      const mark = SHOP_MARKS[`shopSlot${i + 1}` as keyof typeof SHOP_MARKS];
      const approach = at(s.approach[0], s.approach[1]);
      const center = at(s.center[0], s.center[1]);
      expect(mark.approach).toHaveLength(1);
      expect(mark.approach[0].x).toBeCloseTo(approach.x, 2);
      expect(mark.approach[0].z).toBeCloseTo(approach.z, 2);
      expect(mark.faceTo.x).toBeCloseTo(center.x, 2);
      expect(mark.faceTo.z).toBeCloseTo(center.z, 2);
      expect(mark.label).toBe("진열대");
      expect(mark.buttonLabel).toBe("바꾸기");
    });
  });

  it("L16: 출입문 서는 자리 (16.11, 14.81), 버들 서는 자리는 계산대 서는 자리 (10.75, 12.47)", () => {
    expect(SHOP_MARKS.shopExit.approach[0].x).toBeCloseTo(16.11, 2);
    expect(SHOP_MARKS.shopExit.approach[0].z).toBeCloseTo(14.81, 2);
    expect(SHOP_MARKS.shopCounter.approach[0].x).toBeCloseTo(10.75, 2);
    expect(SHOP_MARKS.shopCounter.approach[0].z).toBeCloseTo(12.47, 2);
  });

  it("L17: 들어서는 자리와 모든 장소의 서는 자리에 설 수 있고, 출입문 서는 자리에서 모두 걸어갈 수 있다", () => {
    applyArea("shop");
    expect(isFree(16.01, 14.65)).toBe(true);
    const from = SHOP_MARKS.shopExit.approach[0];
    expect(findPath(from, [{ x: 16.01, z: 14.65 }])).not.toBeNull();
    for (const mark of Object.values(SHOP_MARKS)) {
      const goal = mark.approach[0];
      expect({ id: mark.id, free: isFree(goal.x, goal.z) }).toEqual({ id: mark.id, free: true });
      expect({ id: mark.id, path: findPath(from, [goal]) !== null }).toEqual({ id: mark.id, path: true });
    }
  });

  it("L18: 들어서서 장소마다 걸어가는 동안 걸을 수 없는 곳을 지나지 않고 그 장소에 닿는다(진열대 여섯·버들·출입문)", () => {
    applyArea("shop");
    const sim = new LobbySim({ x: 16.01, z: 14.65, random: () => 0.5 });
    let now = 1_000_000;
    for (const id of ["shopCounter", "shopSlot6", "shopSlot5", "shopSlot4", "shopSlot3", "shopSlot2", "shopSlot1", "shopExit"] as const) {
      sim.pointerDown({ point: null, mark: id as never, onCharacter: false }, 0, 0, now);
      sim.pointerUp(now + 10);
      for (let i = 0; i < 1000; i += 1) {
        now += 50;
        sim.update(0.05, now);
        expect({ id, free: isFree(sim.x, sim.z) }).toEqual({ id, free: true });
      }
      expect(sim.snapshot(now).arrived).toBe(id);
    }
  });

  it("L19: 들어선 자리에서는 '마을로 나갈까?'와 '나가기'가 뜬다", () => {
    applyArea("shop");
    const sim = new LobbySim({ x: 16.01, z: 14.65, random: () => 0.5 });
    const snap = sim.snapshot(1_000_000);
    expect(snap.place).toBe("shopExit");
    expect(snap.bubbleText).toBe("마을로 나갈까?");
    expect(snap.bubbleButton).toBe("나가기");
  });

  it("L20: 진열대 가운데(걸을 수 없는 곳)를 누르면 걸어갈 수 있다", () => {
    applyArea("shop");
    const sim = new LobbySim({ x: 16.01, z: 14.65, random: () => 0.5 });
    for (const s of SLOTS) expect(sim.goTo(at(s.center[0], s.center[1]), null)).toBe(true);
  });

  it("L21: 이름표 자리: 진열대 여섯 모두 이름표 자리가 있고 각 진열대 가운데 위에 뜬다", () => {
    SLOTS.forEach((s, i) => {
      const label = shop.SHOP_LABEL_POINTS[`shopSlot${i + 1}` as shop.ShopPlaceId];
      const center = at(s.center[0], s.center[1]);
      expect(label.x).toBeCloseTo(center.x, 2);
      expect(label.z).toBeCloseTo(center.z, 2);
    });
  });
});

describe("[spec] 카메라(명세 2-5)", () => {
  it("L22: 기울기 42°·시야각 30°이고, 보는 점이 새 끝 상자를 넘지 않으며, 기본 화면 폭 9.4에서 라룹이를 따라간다", () => {
    applyArea("room");
    const room = cameraPose({ x: 4, z: 6 }, 9.4, 0.5);
    applyArea("shop");
    const b = shop.SHOP_BOUNDS;
    const follows: FloorPoint[] = [at(-7.5, -6.5), at(7.5, -6.5), at(-7.5, 6.5), at(7.5, 6.5), at(0, 0)];
    for (const follow of follows) {
      const pose = cameraPose(follow, 9.4, 0.5);
      expect(pose.fovDeg).toBe(30);
      expect(pose.position.y).toBeCloseTo(room.position.y, 6);
      const pitch = Math.atan2(pose.position.y - pose.lookAt.y, pose.position.z - pose.lookAt.z);
      expect((pitch * 180) / Math.PI).toBeCloseTo(42, 3);
      expect(pose.lookAt.x).toBeGreaterThanOrEqual(b.minX - 1e-6);
      expect(pose.lookAt.x).toBeLessThanOrEqual(b.maxX + 1e-6);
      expect(pose.lookAt.z).toBeGreaterThanOrEqual(b.minZ - 1e-6);
      expect(pose.lookAt.z).toBeLessThanOrEqual(b.maxZ + 1e-6);
    }
    const left = cameraPose(at(-7.5, 0), 9.4, 0.5);
    const right = cameraPose(at(7.5, 0), 9.4, 0.5);
    expect(right.lookAt.x - left.lookAt.x).toBeGreaterThan(2);
  });
});

describe("[spec] 상품 여섯(명세 1)", () => {
  const NAMES = ["장화 화분", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"];
  const IDS = ["rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"];

  it("P1: 상품 목록은 id·이름이 표대로 여섯이고 상품 id가 서버 가구 id다", () => {
    expect(shop.SHOP_PRODUCTS.map((p) => p.id)).toEqual(IDS);
    expect(shop.SHOP_PRODUCTS.map((p) => p.name)).toEqual(NAMES);
  });

  it("P2: 처음 진열은 슬롯 01~06 = 표 차례", () => {
    expect([...shop.DEFAULT_SHOP_DISPLAY]).toEqual(IDS);
    expect([...shop.shopDisplay()]).toEqual(IDS);
    expect(shop.shopDisplay().map((id) => shop.shopProduct(id).name)).toEqual(NAMES);
  });

  it("P3: 상품 설명: 기존 셋은 지금 설명 그대로, 새 셋은 상품 README의 디자인 설명", () => {
    const desc = (id: string) => shop.SHOP_PRODUCTS.find((p) => p.id === id)!.description;
    expect(desc("walnutBed")).toBe("갈라진 호두껍질 굴곡에 파스텔 녹색 이불을 덮었어요.");
    expect(desc("grandmasFloorBedding")).toBe("방바닥에 포근한 요를 펴고 솜이불과 베개를 놓았어요.");
    expect(desc("cloudDesk")).toBe("구름 모양 상판에 하늘색으로 포인트를 줬어요.");
    expect(desc("rainbootPlanter")).toBe("장화 화분과 작은 종 모양 꽃");
    expect(desc("catPostDesk")).toBe("고양이 귀 실루엣, 편지 표식과 선반");
    expect(desc("stargazerBed")).toBe("푸른 반쪽 천막과 초승달 모빌");
  });

  it("P4: 진열대 말풍선은 '<지금 상품 이름>이야/야.\\n다른 가구로 바꿔 볼까?'(받침에 따라)", () => {
    const prompts = shop.SHOP_SLOT_PLACES.map((id) => markInfo(id as never).prompt);
    expect(prompts).toEqual([
      "장화 화분이야.\n다른 가구로 바꿔 볼까?",
      "고양이 편지 책상이야.\n다른 가구로 바꿔 볼까?",
      "별지기 침대야.\n다른 가구로 바꿔 볼까?",
      "호두 침대야.\n다른 가구로 바꿔 볼까?",
      "이부자리야.\n다른 가구로 바꿔 볼까?",
      "구름 책상이야.\n다른 가구로 바꿔 볼까?"
    ]);
  });

  it("P5: 슬롯 하나만 바꾸면 그 슬롯만 바뀌고 같은 상품을 여러 진열대에 놓아도 된다", () => {
    shop.setShopDisplay(0, "cloudDesk");
    shop.setShopDisplay(3, "cloudDesk");
    expect([...shop.shopDisplay()]).toEqual(["cloudDesk", "catPostDesk", "stargazerBed", "cloudDesk", "grandmasFloorBedding", "cloudDesk"]);
    expect(markInfo("shopSlot1").prompt).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    expect(markInfo("shopSlot6" as never).prompt).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    expect(markInfo("shopSlot2").prompt).toBe("고양이 편지 책상이야.\n다른 가구로 바꿔 볼까?");
  });

  it("P6: 진열은 앱을 켜 둔 동안 유지되고 처음 진열로 되돌릴 수 있다", () => {
    shop.setShopDisplay(5, "rainbootPlanter" as never);
    expect(shop.shopDisplay()[5]).toBe("rainbootPlanter");
    shop.resetShopDisplay();
    expect([...shop.shopDisplay()]).toEqual(IDS);
  });
});
