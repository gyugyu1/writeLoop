// [spec] qa 테스트(작업 128 가구점 실내, 새 기능, 모바일): 엔진·데이터 단위.
// 작업 130(새 매장 18×16, 진열대 여섯, 상품 여섯, 원본 배율 크기 검사)에 맞게 고쳤다(06 결정 1). 기대값은 130 명세와 shop-layout.json에서 가져왔고,
// 좌표는 GLB 좌표에 (9, 8)을 더한 앱 좌표다.
// 기대값은 private 작업 폴더 128-2026-11-19-가구점-실내/01-main-spec.md와 02-qa-scenarios.md에서만 가져온다(S번호는 시나리오 번호).
// 좌표는 명세대로 GLB 좌표(g)에 (4.5, 0, 4.5)를 더해 앱 좌표로 쓴다. 구현 코드는 부르는 방법(이름·인자)만 읽었다.
// 화면 흐름(S10~S16, S27~S30, S44~S47, S50)은 tests/components/lobby3d-shop-flow.spec.test.tsx, 3D 장면(S19·S31~S36·S41~S43)은
// tests/components/lobby3d-shop-scene.spec.test.tsx가 본다.
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  LobbySim,
  activePlaceIds,
  applyArea,
  cameraPose,
  currentArea,
  findPath,
  isFree,
  markInfo,
  type FloorPoint,
  type PlaceId
} from "@/lib/lobby3d/engine";
import {
  SHOP_PRODUCTS,
  SHOP_SLOTS,
  fitsShopSlot,
  resetShopDisplay,
  setShopDisplay,
  shopDisplay,
  shopProduct
} from "@/lib/lobby3d/shop";

const MOBILE = join(__dirname, "../..");
// 14 결정: 실내·버들은 앱 자산(assets/models/shop), 진열 상품 셋은 서버 아이템 목록 파일 폴더
const SHOP_DIR = join(MOBILE, "assets/models/shop");
const SERVER_FILES = join(MOBILE, "../backend/src/main/resources/catalog/files");

/** GLB 좌표 → 앱 좌표(130 명세 2-2). */
const app = (x: number, z: number): FloorPoint => ({ x: x + 9, z: z + 8 });

interface GltfNode {
  name: string;
  translation?: number[];
  extras?: Record<string, number>;
}
function gltfNodes(file: string): GltfNode[] {
  const data = readFileSync(join(SHOP_DIR, file));
  const length = data.readUInt32LE(12);
  return (JSON.parse(data.subarray(20, 20 + length).toString("utf8")) as { nodes: GltfNode[] }).nodes;
}
const interiorNodes = gltfNodes("furniture-shop-interior.glb");
const glbNode = (name: string) => {
  const n = interiorNodes.find((x) => x.name === name);
  if (!n) throw new Error(`no node ${name}`);
  return n;
};
const glbPoint = (name: string): FloorPoint => {
  const t = glbNode(name).translation ?? [0, 0, 0];
  return app(t[0], t[2]);
};

const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);

let now = 1_000_000;

afterEach(() => {
  applyArea("room");
  resetShopDisplay();
});

/** 지금 구역(shop)의 장소 다섯을 이름표 글로 찾는다. */
function shopMarks() {
  applyArea("shop");
  return activePlaceIds().map((id) => ({ id, info: markInfo(id) }));
}
const byLabel = (label: string) => shopMarks().filter((m) => m.info.label === label);

describe("[spec] 애셋(S01·S02, 14 결정)", () => {
  it("S01: 실내·버들 GLB는 앱 assets/models/shop에 있고 크기가 약 2.64·1.61MB다(130: 새 매장 모델)", () => {
    for (const [file, mb] of [
      ["furniture-shop-interior.glb", 2.64],
      ["beodeul.glb", 1.61]
    ] as const) {
      expect({ file, exists: existsSync(join(SHOP_DIR, file)) }).toEqual({ file, exists: true });
      expect(statSync(join(SHOP_DIR, file)).size / 1_000_000).toBeCloseTo(mb, 1);
    }
    // 원본이 이 컴퓨터에 있으면 바이트가 같다(없는 환경에서는 크기만 본다)
    for (const [file, original] of [
      ["furniture-shop-interior.glb", "C:/WriteLoop-asset/마을건물/가구점/내부/furniture-shop-interior.glb"],
      ["beodeul.glb", "C:/WriteLoop-asset/이웃/버들-가구점_주인/3d/WriteLoop_Beodeul.glb"]
    ] as const) {
      if (existsSync(original)) expect(readFileSync(join(SHOP_DIR, file)).equals(readFileSync(original))).toBe(true);
    }
  });

  it("S01: 진열 상품 여섯은 앱에 없고(assets/models/shop에 상품 파일 없음) 서버 파일 폴더에 있다(약 0.27·0.70·0.30·0.26·1.58·0.70MB). 실내·버들은 서버 폴더에 없다", () => {
    const appFiles = readdirSync(SHOP_DIR).sort();
    expect(appFiles).toEqual(["beodeul.glb", "furniture-shop-interior.glb"]);
    for (const [file, mb] of [
      ["rainboot-planter.glb", 0.27],
      ["cat-post-desk.glb", 0.7],
      ["stargazer-bed.glb", 0.3],
      ["walnut-bed.glb", 0.26],
      ["grandmas-floor-bedding.glb", 1.58],
      ["cloud-desk.glb", 0.7]
    ] as const) {
      expect({ file, exists: existsSync(join(SERVER_FILES, file)) }).toEqual({ file, exists: true });
      expect(statSync(join(SERVER_FILES, file)).size / 1_000_000).toBeCloseTo(mb, 1);
    }
    for (const file of ["shop-interior.glb", "shopkeeper-beodeul.glb"]) expect({ file, exists: existsSync(join(SERVER_FILES, file)) }).toEqual({ file, exists: false });
  });

  it("S02: 앱 CREDITS.md에 실내·버들 두 모델 줄이 있고 WriteLoop 제작이며, 진열 상품 여섯 줄은 없다(앱에 든 파일이 아니다)", () => {
    const lines = readFileSync(join(MOBILE, "assets/models/CREDITS.md"), "utf8").split(/\r?\n/);
    for (const name of ["shop/furniture-shop-interior.glb", "shop/beodeul.glb"]) {
      const rows = lines.filter((l) => l.startsWith("| `" + name + "`"));
      expect({ name, rows: rows.length }).toEqual({ name, rows: 1 });
      expect(rows[0]).toContain("WriteLoop");
    }
    const text = lines.join("\n");
    for (const name of ["rainboot-planter", "cat-post-desk", "stargazer-bed", "walnut-bed", "grandmas-floor-bedding", "cloud-desk"]) expect({ name, listed: text.includes(name) }).toEqual({ name, listed: false });
  });
});

describe("[spec] 구역과 좌표(S03~S05, S08)", () => {
  it("S03: 구역 shop이 있고, 구역마다 장소 목록이 따로다(한 번에 구역 하나)", () => {
    expect(currentArea()).toBe("room");
    applyArea("shop");
    expect(currentArea()).toBe("shop");
    expect(activePlaceIds()).toHaveLength(8);
    applyArea("village");
    expect(currentArea()).toBe("village");
    expect(activePlaceIds()).toHaveLength(3);
    applyArea("room");
    expect(activePlaceIds().some((id) => (shopMarks().map((m) => m.id) as PlaceId[]).includes(id))).toBe(false);
  });

  it("S04: 실내 좌표 = GLB 좌표 + (9, 0, 8). PlayerSpawn (16.01, 14.65), CheckoutNPC (10.53, 14.56), CheckoutInteract (10.75, 12.47)", () => {
    const spawn = glbPoint("PlayerSpawn");
    expect(spawn.x).toBeCloseTo(16.01, 2);
    expect(spawn.z).toBeCloseTo(14.65, 2);
    const npc = glbPoint("CheckoutNPC");
    expect(npc.x).toBeCloseTo(10.53, 2);
    expect(npc.z).toBeCloseTo(14.56, 2);
    const interact = glbPoint("CheckoutInteract");
    expect(interact.x).toBeCloseTo(10.75, 2);
    expect(interact.z).toBeCloseTo(12.47, 2);
    // 앱에서 서 있는 자리: 들어와 서면 (16.01, 14.65)
    const sim = new LobbySim({ x: 16.01, z: 14.65, random: () => 0.5 });
    applyArea("shop");
    expect(isFree(sim.x, sim.z)).toBe(true);
  });

  it("S05: 실내는 0.25칸 격자로 걸을 수 있는 곳을 본다: 칸(1)보다 잘게 막힌다", () => {
    applyArea("shop");
    // 열린 초록 문짝(GLB x 7.75~8.33, z 5.45~7.21) 바로 옆: 문짝에서 0.75 떨어진 곳은 서고, 문짝 안은 못 선다. 1칸 격자라면 둘이 한 칸이라 같을 수 없다
    expect(isFree(...(Object.values(app(7.0, 6.3)) as [number, number]))).toBe(true);
    expect(isFree(...(Object.values(app(8.0, 6.3)) as [number, number]))).toBe(false);
  });

  it("S08: 스폰·버들·출입문·진열대 앞 서는 자리는 설 수 있고, 출입문 서는 자리에서 모두 걸어갈 수 있다", () => {
    applyArea("shop");
    const marks = shopMarks();
    expect(marks).toHaveLength(8);
    const exit = byLabel("마을로")[0].info.approach[0];
    const spawn = app(7.01, 6.65);
    expect(isFree(spawn.x, spawn.z)).toBe(true);
    expect(findPath(exit, [spawn])).not.toBeNull();
    for (const { id, info } of marks) {
      const goal = info.approach[0];
      expect({ id, free: isFree(goal.x, goal.z) }).toEqual({ id, free: true });
      expect({ id, reachable: findPath(exit, [goal]) !== null }).toEqual({ id, reachable: true });
    }
  });
});

describe("[spec] 걸을 수 없는 곳(S06)", () => {
  const BLOCKED: [string, number, number][] = [
    ["벽 밖 뒤 (0, -7.6)", 0, -7.6],
    ["벽 밖 오른쪽 (8.6, 0)", 8.6, 0],
    ["벽 밖 왼쪽 (-8.6, 0)", -8.6, 0],
    ["벽 밖 앞 (0, 7.6)", 0, 7.6],
    ["계산대 (1.8, 6.2)", 1.8, 6.2],
    ["계산대 가장자리 안 (0.9, 5.4)", 0.9, 5.4],
    ["오른쪽 벽 선반 (6.3, -6.8)", 6.3, -6.8],
    ["진열대 01 가운데 (-5.94, 3.0)", -5.94, 3.0],
    ["진열대 02 가운데 (-5.94, -1.38)", -5.94, -1.38],
    ["진열대 03 가운데 (-2.52, -4.98)", -2.52, -4.98],
    ["진열대 04 가운데 (1.95, -4.98)", 1.95, -4.98],
    ["진열대 05 가운데 (6.08, -2.34)", 6.08, -2.34],
    ["진열대 06 가운데 (6.08, 2.06)", 6.08, 2.06],
    ["진열대 01 둘레 안쪽 (r 1.8)", -5.94, 3.0 + 1.8],
    ["진열대 03 둘레 안쪽 (r 1.8)", -2.52 - 1.8, -4.98],
    ["진열대 06 둘레 안쪽 (r 1.8)", 6.08, 2.06 - 1.8],
    ["열린 초록 문짝 (8.0, 6.3)", 8.0, 6.3],
    ["뒷벽 간판 기둥 (0, -7.1)", 0, -7.1],
    ["서재 벽장식 (-8.1, 0)", -8.1, 0],
    ["침실 벽장식 (3.5, -7.05)", 3.5, -7.05],
    ["낮과 밤의 방 벽장식 (8.1, 0)", 8.1, 0],
    ["협탁 (-0.35, -6.15)", -0.35, -6.15],
    ["명패 03 (-2.5, -3.1)", -2.5, -3.1]
  ];
  const FREE: [string, number, number][] = [
    ["매장 가운데 (0, 0)", 0, 0],
    ["계산대 앞 통로 (1.75, 4.47)", 1.75, 4.47],
    ["들어서는 자리 (7.01, 6.65)", 7.01, 6.65],
    ["진열대 01 앞 통로 (-3.59, 3.0)", -3.59, 3.0],
    ["진열대 06 앞 통로 (3.53, 2.4)", 3.53, 2.4],
    ["침실 앞 통로 (0, -2.2)", 0, -2.2],
    ["문짝 앞 (7.0, 6.3)", 7.0, 6.3]
  ];

  it.each(BLOCKED)("S06 막힘: %s", (_name, x, z) => {
    applyArea("shop");
    const p = app(x, z);
    expect(isFree(p.x, p.z)).toBe(false);
  });

  it.each(FREE)("S06 설 수 있음: %s", (_name, x, z) => {
    applyArea("shop");
    const p = app(x, z);
    expect(isFree(p.x, p.z)).toBe(true);
  });

  it("S06 진열대 반지름: 원 바깥으로 몸 둘레(0.32)와 격자 한 칸(0.25)쯤 더 나가면 설 수 있다(진열대 여섯, 반지름 1.87)", () => {
    applyArea("shop");
    const centers = [
      [-5.94, 3.0],
      [-5.94, -1.38],
      [-2.52, -4.98],
      [1.95, -4.98],
      [6.08, -2.34],
      [6.08, 2.06]
    ] as const;
    for (const [cx, cz] of centers) {
      // 다른 진열대·벽에 걸리지 않는 위·아래 방향 중 한쪽에서 설 수 있어야 한다
      const out = 1.87 + 0.67;
      const free = [app(cx, cz - out), app(cx, cz + out)].filter((pt) => isFree(pt.x, pt.z));
      expect({ center: [cx, cz], anyFree: free.length > 0 }).toEqual({ center: [cx, cz], anyFree: true });
    }
  });
});

describe("[spec] 길 찾기와 누르기(S09, S17)", () => {
  /** 걸을 수 없는 곳을 누르고 멈출 때까지 돌린다. 지나는 모든 프레임이 설 수 있는 자리여야 한다. */
  function tapAndWalk(target: FloorPoint) {
    applyArea("shop");
    const spawn = app(7.01, 6.65);
    const sim = new LobbySim({ x: spawn.x, z: spawn.z, random: () => 0.5 });
    expect(sim.goTo(target, null)).toBe(true);
    for (let i = 0; i < 800; i += 1) {
      now += 50;
      sim.update(0.05, now);
      expect(isFree(sim.x, sim.z)).toBe(true);
    }
    return { x: sim.x, z: sim.z };
  }

  /** target에서 가장 가까운 설 수 있는 곳(0.25 격자)까지의 거리. */
  function nearestFreeDistance(target: FloorPoint): number {
    let best = Infinity;
    for (let x = 0.125; x < 18; x += 0.25) {
      for (let z = 0.125; z < 16; z += 0.25) {
        if (isFree(x, z)) best = Math.min(best, dist({ x, z }, target));
      }
    }
    return best;
  }

  it.each([
    ["진열대 02 가운데", app(-5.94, -1.38)],
    ["진열대 03 가운데", app(-2.52, -4.98)],
    ["계산대 안 (1.8, 6.2)", app(1.8, 6.2)],
    ["오른쪽 선반 (6.3, -6.8)", app(6.3, -6.8)],
    ["벽 밖 (0, 7.6)", app(0, 7.6)]
  ])("S09: %s을(를) 누르면 가장 가까운 걸을 수 있는 곳 근처로 걸어가 서고, 가는 동안 막힌 곳을 지나지 않는다", (_name, target) => {
    applyArea("shop");
    const near = nearestFreeDistance(target);
    const end = tapAndWalk(target);
    expect(dist(end, target)).toBeLessThanOrEqual(near + 0.6);
  });

  it("S17: 걷는 속도 2.4칸/초, 돌아서는 빠르기 10(방·마을과 같다)", () => {
    applyArea("shop");
    expect(new LobbySim({ x: 16.01, z: 14.65 }).settings).toEqual({ speed: 2.4, turn: 10 }); // 작업 137(08 결정): 기본 걷기 3.2 -> 2.4
  });
});

describe("[spec] 카메라(S18)", () => {
  it("S18: 기울기 42°·시야각 30°·거리가 방과 같고, 보는 점이 실내 끝 상자(중심 (9, 8) ± (8.645, 7.545))를 넘지 않는다", () => {
    applyArea("room");
    const room = cameraPose({ x: 4, z: 6 }, 9, 0.5);
    applyArea("shop");
    for (const follow of [app(0, 0), app(-7.9, -6.9), app(7.9, 6.9), app(7.9, -6.9), app(-7.9, 6.9)]) {
      const pose = cameraPose(follow, 9, 0.5);
      expect(pose.fovDeg).toBe(30);
      expect(pose.position.y).toBeCloseTo(room.position.y, 6);
      const pitch = Math.atan2(pose.position.y - pose.lookAt.y, pose.position.z - pose.lookAt.z);
      expect((pitch * 180) / Math.PI).toBeCloseTo(42, 3);
      expect(pose.lookAt.x).toBeGreaterThanOrEqual(9 - 8.645 - 1e-6);
      expect(pose.lookAt.x).toBeLessThanOrEqual(9 + 8.645 + 1e-6);
      expect(pose.lookAt.z).toBeGreaterThanOrEqual(8 - 7.545 - 1e-6);
      expect(pose.lookAt.z).toBeLessThanOrEqual(8 + 7.545 + 1e-6);
    }
  });
});

describe("[spec] 장소(S22~S26)", () => {
  it("S22: 장소 여덟: 출입문·버들·진열대 여섯의 이름표·말풍선·버튼", () => {
    const marks = shopMarks();
    expect(marks).toHaveLength(8);
    const exit = byLabel("마을로");
    expect(exit).toHaveLength(1);
    expect(exit[0].info.prompt).toBe("마을로 나갈까?");
    expect(exit[0].info.buttonLabel).toBe("나가기");
    const keeper = byLabel("버들");
    expect(keeper).toHaveLength(1);
    expect(keeper[0].info.prompt).toBe("버들에게 인사할까?");
    expect(keeper[0].info.buttonLabel).toBe("인사하기");
    const slots = byLabel("진열대");
    expect(slots).toHaveLength(6);
    for (const s of slots) expect(s.info.buttonLabel).toBe("바꾸기");
  });

  it("S23: 서는 자리: 버들은 CheckoutInteract (10.75, 12.47), 출입문은 문 안쪽 깔개 위(ExitTrigger 가까이), 진열대는 그 진열대 앞 통로", () => {
    const [keeper] = byLabel("버들");
    expect(keeper.info.approach[0].x).toBeCloseTo(10.75, 2);
    expect(keeper.info.approach[0].z).toBeCloseTo(12.47, 2);
    const [exit] = byLabel("마을로");
    const exitNode = glbPoint("ExitTrigger");
    expect(dist(exit.info.approach[0], exitNode)).toBeLessThan(1);
    // 바라볼 곳
    expect(dist(exit.info.faceTo, exitNode)).toBeLessThan(0.01);
    expect(dist(keeper.info.faceTo, glbPoint("CheckoutNPC"))).toBeLessThan(0.01);
    const slots = byLabel("진열대");
    ["DisplaySlot_01", "DisplaySlot_02", "DisplaySlot_03", "DisplaySlot_04", "DisplaySlot_05", "DisplaySlot_06"].forEach((name, i) => {
      const center = glbPoint(name);
      const info = slots[i].info;
      expect({ name, face: dist(info.faceTo, center) < 0.01 }).toEqual({ name, face: true });
      // 앞 통로: 진열대 가운데에서 멀지 않고(3칸 안), 진열대 둘레 밖
      const d = dist(info.approach[0], center);
      expect(d).toBeLessThanOrEqual(3);
      expect(d).toBeGreaterThan(SHOP_SLOTS[i].pedestalRadius);
    });
  });

  it("S24: 서는 자리에서 반지름 1 안이면 그 장소의 말풍선이 뜨고, 멀리 떨어지면 그 장소가 아니다", () => {
    applyArea("shop");
    for (const { id, info } of shopMarks()) {
      const at = info.approach[0];
      const sim = new LobbySim({ x: at.x, z: at.z, random: () => 0.5 });
      expect({ id, place: sim.snapshot(now).place }).toEqual({ id, place: id });
    }
    const [keeper] = byLabel("버들");
    const far = { x: keeper.info.approach[0].x, z: keeper.info.approach[0].z - 1.6 };
    expect(isFree(far.x, far.z)).toBe(true);
    const sim = new LobbySim({ x: far.x, z: far.z, random: () => 0.5 });
    expect(sim.snapshot(now).place).not.toBe(keeper.id);
  });

  it("S25: 입장 직후(스폰에 서면) 출입문 구역 안이라 '마을로 나갈까?'와 '나가기'가 뜬다", () => {
    applyArea("shop");
    const sim = new LobbySim({ x: 16.01, z: 14.65, random: () => 0.5 });
    const snap = sim.snapshot(now);
    expect(snap.bubbleText).toBe("마을로 나갈까?");
    expect(snap.bubbleButton).toBe("나가기");
  });

  it("S26: 처음 진열의 상품 이름: 진열대 1 장화 화분, 2 고양이 편지 책상, 3 별지기 침대, 4 호두 침대, 5 이부자리, 6 구름 책상", () => {
    expect(shopDisplay().map((id) => shopProduct(id).name)).toEqual(["장화 화분", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"]);
  });

  it("S26(06 결정 1): 진열대 말풍선은 받침에 따라 '<상품 이름>이야/야.\n다른 가구로 바꿔 볼까?'다(화분이야, 책상이야, 침대야, 이부자리야)", () => {
    const slots = byLabel("진열대");
    expect(slots.map((s) => s.info.prompt)).toEqual([
      "장화 화분이야.\n다른 가구로 바꿔 볼까?",
      "고양이 편지 책상이야.\n다른 가구로 바꿔 볼까?",
      "별지기 침대야.\n다른 가구로 바꿔 볼까?",
      "호두 침대야.\n다른 가구로 바꿔 볼까?",
      "이부자리야.\n다른 가구로 바꿔 볼까?",
      "구름 책상이야.\n다른 가구로 바꿔 볼까?"
    ]);
  });

  it("S26: 진열을 바꾸면 그 진열대 말풍선의 상품 이름이 따라가고 다른 진열대는 그대로다", () => {
    const cloud = SHOP_PRODUCTS.find((p) => p.name === "구름 책상")!;
    setShopDisplay(0, cloud.id);
    const slots = byLabel("진열대");
    expect(slots[0].info.prompt).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    expect(slots[1].info.prompt).toBe("고양이 편지 책상이야.\n다른 가구로 바꿔 볼까?");
    expect(slots[5].info.prompt).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");
    // 받침 없는 이름으로 바꾸면 '야'
    const walnut = SHOP_PRODUCTS.find((p) => p.name === "호두 침대")!;
    setShopDisplay(2, walnut.id);
    expect(byLabel("진열대")[2].info.prompt).toBe("호두 침대야.\n다른 가구로 바꿔 볼까?");
  });
});

describe("[spec] 버들 인사(S37·S38)", () => {
  const GREETING = "어서 와! 천천히 둘러보렴.";
  function keeperSim(extra: { reduceMotion?: boolean } = {}) {
    applyArea("shop");
    const at = byLabel("버들")[0].info.approach[0];
    return new LobbySim({ x: at.x, z: at.z, random: () => 0.5, ...extra });
  }

  it("S37: 인사하면 버들 말풍선이 약 3초 뜬 뒤 사라지고, 그동안 라룹이의 장소 말풍선은 숨고, 라룹이가 손을 흔든다", () => {
    const sim = keeperSim();
    expect(sim.snapshot(now).bubbleText).toBe("버들에게 인사할까?");
    sim.greetShopkeeper(now);
    let snap = sim.snapshot(now + 100);
    expect(snap.npcText).toBe(GREETING);
    expect(snap.bubbleText).toBe("");
    expect(snap.action?.type).toBe("wave");
    snap = sim.snapshot(now + 2500);
    expect(snap.npcText).toBe(GREETING);
    expect(snap.bubbleText).toBe("");
    snap = sim.snapshot(now + 3500);
    expect(snap.npcText).toBe("");
    expect(snap.bubbleText).toBe("버들에게 인사할까?");
  });

  it("S37: 동작 줄이기면 손을 흔들지 않고 말풍선만 뜬다", () => {
    const sim = keeperSim({ reduceMotion: true });
    sim.greetShopkeeper(now);
    const snap = sim.snapshot(now + 100);
    expect(snap.action).toBeNull();
    expect(snap.npcText).toBe(GREETING);
  });

  it("S38: 몇 번이든 다시 할 수 있다(3초 뒤에도, 3초 안에도 다시 시작한다)", () => {
    const sim = keeperSim();
    sim.greetShopkeeper(now);
    expect(sim.snapshot(now + 3500).npcText).toBe("");
    sim.greetShopkeeper(now + 4000);
    expect(sim.snapshot(now + 4100).npcText).toBe(GREETING);
    expect(() => sim.greetShopkeeper(now + 5000)).not.toThrow();
    // 3초 안에 다시 누르면 그때부터 3초 더
    expect(sim.snapshot(now + 7500).npcText).toBe(GREETING);
    expect(sim.snapshot(now + 8500).npcText).toBe("");
  });
});

describe("[spec] 진열(S40·S42·S45~S48)", () => {
  /** 슬롯 노드의 safe_radius_m·max_height_m은 GLB에서 읽는다(S42). */
  const slotLimits = ["DisplaySlot_01", "DisplaySlot_02", "DisplaySlot_03", "DisplaySlot_04", "DisplaySlot_05", "DisplaySlot_06"].map((name) => {
    const extras = glbNode(name).extras ?? {};
    return { safeRadius: extras.safe_radius_m, maxHeight: extras.max_height_m };
  });

  it("S42 GLB 슬롯 값: 여섯 슬롯 모두 safe_radius_m 1.79·max_height_m 2.55다", () => {
    expect(slotLimits).toHaveLength(6);
    for (const limit of slotLimits) expect(limit).toEqual({ safeRadius: 1.79, maxHeight: 2.55 });
  });

  it("S42(130): 크기 검사: 가장 먼 바닥 모서리가 safeRadius 안이고 높이가 maxHeight 안이면 진열할 수 있다", () => {
    const { safeRadius, maxHeight } = slotLimits[0];
    const box = { minX: -safeRadius / 3, maxX: safeRadius / 3, minZ: -safeRadius / 3, maxZ: safeRadius / 3, height: maxHeight / 2 };
    expect(fitsShopSlot(box, slotLimits[0])).toBe(true);
  });

  it("S42(130): 바닥 모서리가 safeRadius보다 멀면 진열할 수 없다(줄여 주지 않는다)", () => {
    const { safeRadius, maxHeight } = slotLimits[1];
    const box = { minX: -2 * safeRadius, maxX: 2 * safeRadius, minZ: 0, maxZ: 0, height: maxHeight / 4 };
    expect(fitsShopSlot(box, slotLimits[1])).toBe(false);
  });

  it("S42(130): 높이가 maxHeight보다 크면 진열할 수 없다", () => {
    const { safeRadius, maxHeight } = slotLimits[2];
    const box = { minX: -safeRadius / 10, maxX: safeRadius / 10, minZ: -safeRadius / 10, maxZ: safeRadius / 10, height: 2 * maxHeight };
    expect(fitsShopSlot(box, slotLimits[2])).toBe(false);
  });

  it("S42(130): 반지름은 바닥 윤곽의 가장 먼 모서리로 잰다(변 가운데가 안이어도 모서리가 밖이면 진열할 수 없다)", () => {
    const { safeRadius, maxHeight } = slotLimits[0];
    // 변 가운데는 둘 다 안(0.6·0.8배)이지만 모서리는 0.6 * sqrt(2) = 0.85배는 안, 0.8 * sqrt(2) = 1.13배는 밖
    const inside = safeRadius * 0.6;
    expect(fitsShopSlot({ minX: -inside, maxX: inside, minZ: -inside, maxZ: inside, height: maxHeight / 2 }, slotLimits[0])).toBe(true);
    const outside = safeRadius * 0.8;
    expect(fitsShopSlot({ minX: -outside, maxX: outside, minZ: -outside, maxZ: outside, height: maxHeight / 2 }, slotLimits[0])).toBe(false);
  });

  it("S45: 한 진열대의 상품을 바꾸면 그 진열대만 바뀐다", () => {
    const before = [...shopDisplay()];
    const target = SHOP_PRODUCTS.find((p) => p.name === "구름 책상")!;
    setShopDisplay(1, target.id);
    const after = shopDisplay();
    expect(after[1]).toBe(target.id);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
  });

  it("S46: 같은 상품을 여섯 진열대에 모두 놓을 수 있다", () => {
    const cloud = SHOP_PRODUCTS.find((p) => p.name === "구름 책상")!;
    for (let i = 0; i < 6; i += 1) setShopDisplay(i, cloud.id);
    expect(shopDisplay()).toEqual([cloud.id, cloud.id, cloud.id, cloud.id, cloud.id, cloud.id]);
  });

  it("S48: 진열은 앱을 켜 둔 동안 유지되고, 앱을 새로 켜면(모듈을 새로 읽으면) 처음 진열이다. 네트워크를 부르지 않는다", () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new Error("no network")));
    const cloud = SHOP_PRODUCTS.find((p) => p.name === "구름 책상")!;
    setShopDisplay(0, cloud.id);
    applyArea("shop");
    applyArea("village");
    applyArea("shop");
    expect(shopDisplay()[0]).toBe(cloud.id);
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require("@/lib/lobby3d/shop") as typeof import("@/lib/lobby3d/shop");
      expect(fresh.shopDisplay().map((id) => fresh.shopProduct(id).name)).toEqual(["장화 화분", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"]);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
