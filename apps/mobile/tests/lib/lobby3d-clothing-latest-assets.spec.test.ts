// [spec] qa 테스트(작업 133 05 최신 애셋 반영, 기능 변경, 모바일): 앱 자산 다섯이 ZIP 최신본과 같은지, 새 상품 자리·계산대·길, 빈 진열 자리 16곳.
// 기대값은 05-최신-애셋-반영/01-main-spec.md와 애셋 폴더(C:\WriteLoop-asset\마을건물\옷집\내부)의 최신 JSON·파일에서만 가져왔다(아래 해시·상수).
// 구현 코드는 부르는 방법(clothing-stock의 CLOTHING_PRODUCTS·clothingProduct, clothing-shop의 CLOTHING_NODES, engine의 applyArea·findPath·isFree)을 알려고만 읽었다.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { applyArea, findPath, isFree, type FloorPoint } from "@/lib/lobby3d/engine";
import { CLOTHING_NODES, CLOTHING_OFFSET } from "@/lib/lobby3d/clothing-shop";
import { CLOTHING_PRODUCTS, clothingProduct, clothingProductsOnFloor } from "@/lib/lobby3d/clothing-stock";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";
import STOCK from "@/lib/lobby3d/clothing-shop-stock.json";

const MOBILE = join(__dirname, "..", "..");
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const app = (x: number, z: number): FloorPoint => ({ x: x + CLOTHING_OFFSET.x, z: z + CLOTHING_OFFSET.z });
const MODELS = join(MOBILE, "assets", "models", "clothing-shop");
const LIB = join(MOBILE, "src", "lib", "lobby3d");

afterEach(() => applyArea("room"));

describe("[spec] 앱 자산 다섯이 최신 판과 같다(명세 바뀌는 동작 1)", () => {
  it.each([
    [join(MODELS, "clothing-shop-interior-1f.glb"), 2057912, "b6048fe0c841bd6842ef8b4c6f5bdd7ae6174602af5e491763e92b730bdfa24a"],
    [join(MODELS, "clothing-shop-interior-2f.glb"), 1956824, "445771225fa6bb7bb666feadc80a185f1fcf8718c9875b68ae7deaeec2b9288c"],
    [join(MODELS, "clothing-display-samples.glb"), 2694924, "b1a9078e910e00433b33e34cf353477aad2f67e33ae59ad3983c39ddb277e62f"],
    [join(LIB, "clothing-shop-layout.json"), null, "9c49ee2257ee27d285a668b65d55735d0fe07f329994c5a51dfc9b0caad51a77"],
    [join(LIB, "clothing-shop-stock.json"), null, "261420f62340e9ca0978009f2aff0162616a8c630955001816f4fb57687e71bc"]
  ])("%s 바이트 수·sha256", (path, size, hash) => {
    if (size !== null) expect(statSync(path).size).toBe(size);
    expect(sha256(path)).toBe(hash);
  });

  it("CREDITS.md의 세 모델 줄이 하나씩 있고 새 판 설명(계산대 위치, 새 진열대·행거, 2층 피팅룸)을 말한다", () => {
    const lines = readFileSync(join(MOBILE, "assets", "models", "CREDITS.md"), "utf8").split(/\r?\n/);
    const line = (name: string) => lines.filter((l) => l.includes(`\`clothing-shop/${name}\``));
    for (const name of ["clothing-shop-interior-1f.glb", "clothing-shop-interior-2f.glb", "clothing-display-samples.glb"]) {
      expect({ name, count: line(name).length }).toEqual({ name, count: 1 });
    }
    expect(line("clothing-shop-interior-1f.glb")[0]).toContain("계산대");
    expect(line("clothing-shop-interior-1f.glb")[0]).toMatch(/진열대|행거/);
    expect(line("clothing-shop-interior-2f.glb")[0]).toContain("피팅룸");
  });
});

// [id, 이름, 부위, 카탈로그 ID(없으면 null), 층, 진열대 station, 서는 자리(모델 좌표)]
const TABLE: [string, string, string, string | null, 1 | 2, string, [number, number]][] = [
  ["wear-top-kiln-jacket", "코랄 워크 재킷", "top", null, 1, "F1_Slot_WallWest", [-6.58, -5.23]],
  ["wear-bottom-sage-cargo", "세이지 카고 쇼츠", "bottom", null, 1, "F1_Slot_WallEast", [0.22, -5.23]],
  ["wear-hat-breakwater-bucket", "마린 버킷햇", "hat", null, 1, "F1_Slot_WindowJacket", [-4.96, 5.28]],
  ["wear-top-tide-sailor", "스트라이프 세일러 니트", "top", null, 1, "F1_Slot_WindowJacket", [-4.96, 5.28]],
  ["wear-bottom-jetty-denim", "인디고 데님 쇼츠", "bottom", null, 1, "F1_Slot_WindowJacket", [-4.96, 5.28]],
  ["shoesWhite", "흰 운동화", "shoes", "shoesWhite", 1, "F1_Slot_WindowJacket", [-4.96, 5.28]],
  ["capOrange", "주황 야구모자", "hat", "capOrange", 1, "F1_Slot_Table", [-5.82, 1.78]],
  ["capBlue", "파랑 야구모자", "hat", "capBlue", 1, "F1_Slot_WindowDress", [-6.68, 5.28]],
  ["mufflerRed", "빨강 머플러", "accessory", "mufflerRed", 1, "F1_Slot_RailEast", [-3.18, -5.23]],
  ["wear-face-honey-panto", "허니 팬토 선글라스", "face", null, 1, "F1_Slot_HarborTable", [3.48, 3.38]],
  ["backpackRed", "빨강 백팩", "back", "backpackRed", 1, "F1_Slot_HarborRail", [-2.97, -1.64]],
  ["wear-top-field-blouse", "디지털 무늬 전투복 상의", "top", null, 2, "F2_Slot_AtelierDress", [-5.82, -0.25]],
  ["wear-bottom-field-trousers", "카고 포켓 전투복 하의", "bottom", null, 2, "F2_Slot_AtelierDress", [-5.82, -0.25]],
  ["wear-shoe-combat-boot", "끈 전투화 한 켤레", "shoes", null, 2, "F2_Slot_AtelierDress", [-5.82, -0.25]],
  ["wear-top-quilted-liner", "군대 깔깔이", "top", null, 2, "F2_Slot_AtelierJacket", [-2.42, -5.23]],
  ["wear-hat-peddler-straw", "장돌뱅이 모자", "hat", null, 2, "F2_Slot_Peddler", [-5.82, 3.58]],
  ["wear-hat-bramble-beret", "베리 베레모", "hat", null, 2, "F2_Slot_Beret", [-1.64, 3.6]],
  ["necklaceGold", "금 목걸이", "accessory", "necklaceGold", 2, "F2_Slot_BucketHat", [-3.2, 3.6]],
  ["shoesBrown", "갈색 운동화", "shoes", "shoesBrown", 2, "F2_Slot_FieldBootTable", [-6.37, 6.76]],
  ["wear-hat-field-cap", "차양형 전투모", "hat", null, 2, "F2_Slot_FieldCapTable", [-2.97, 6.76]],
  ["tshirtOrange", "주황 티셔츠", "top", "tshirtOrange", 2, "F2_Slot_StudioRail", [0.565, 6.76]],
  ["shortsNavy", "남색 반바지", "bottom", "shortsNavy", 2, "F2_Slot_FieldRail", [0.43, -0.48]]
];

describe("[spec] 진열 상품 22종(명세 바뀌는 동작 3, 그대로 둘 동작)", () => {
  it("22종이 1층 11·2층 11이고 상품 id 집합이 같다", () => {
    expect([...CLOTHING_PRODUCTS.map((p) => p.id)].sort()).toEqual(TABLE.map((t) => t[0]).sort());
    expect(clothingProductsOnFloor(1)).toHaveLength(11);
    expect(clothingProductsOnFloor(2)).toHaveLength(11);
  });

  it("상품마다 이름·부위·카탈로그 ID·층·진열대·displayAnchor·서는 자리가 새 판 값이다", () => {
    for (const [id, name, slot, catalogId, floor, station, [ax, az]] of TABLE) {
      const p = clothingProduct(id)!;
      expect({ id, name: p.name, slot: p.slot, catalogId: p.catalogId, floor: p.floor, station: p.station }).toEqual({ id, name, slot, catalogId, floor, station });
      expect(p.displayAnchor).toBe(`F${floor}_Item_${id}`);
      expect(p.pickNode).toBe(`Stock_${id}`);
      expect(p.approach.x).toBeCloseTo(ax + CLOTHING_OFFSET.x, 6);
      expect(p.approach.z).toBeCloseTo(az + CLOTHING_OFFSET.z, 6);
    }
  });

  it("자리가 바뀐 6종: 선글라스·백팩은 1층 새 가구, 운동화·티셔츠·반바지·전투모는 2층", () => {
    expect(clothingProduct("wear-face-honey-panto")).toMatchObject({ floor: 1, station: "F1_Slot_HarborTable" });
    expect(clothingProduct("backpackRed")).toMatchObject({ floor: 1, station: "F1_Slot_HarborRail" });
    for (const id of ["shoesBrown", "tshirtOrange", "shortsNavy", "wear-hat-field-cap"]) expect(clothingProduct(id)!.floor).toBe(2);
  });

  it("이름표(명패·textAnchor)는 새 진열대의 것이다", () => {
    expect(clothingProduct("wear-face-honey-panto")).toMatchObject({ nameplate: "F1_Nameplate_HarborTable", textAnchor: "F1_ProductName_HarborTable" });
    expect(clothingProduct("backpackRed")).toMatchObject({ nameplate: "F1_Nameplate_HarborRail", textAnchor: "F1_ProductName_HarborRail" });
    expect(clothingProduct("shoesBrown")).toMatchObject({ nameplate: "F2_Nameplate_FieldBootTable", textAnchor: "F2_ProductName_FieldBootTable" });
    expect(clothingProduct("wear-hat-field-cap")).toMatchObject({ nameplate: "F2_Nameplate_FieldCapTable", textAnchor: "F2_ProductName_FieldCapTable" });
    expect(clothingProduct("tshirtOrange")).toMatchObject({ nameplate: "F2_Nameplate_StudioRail", textAnchor: "F2_ProductName_StudioRail" });
    expect(clothingProduct("shortsNavy")).toMatchObject({ nameplate: "F2_Nameplate_FieldRail", textAnchor: "F2_ProductName_FieldRail" });
  });

  it("카탈로그에 연결된 상품은 9종이고 ID가 그대로다", () => {
    expect(CLOTHING_PRODUCTS.filter((p) => p.catalogId).map((p) => p.catalogId).sort()).toEqual(
      ["backpackRed", "capBlue", "capOrange", "mufflerRed", "necklaceGold", "shoesBrown", "shoesWhite", "shortsNavy", "tshirtOrange"]
    );
  });
});

describe("[spec] 빈 진열 자리 16곳(명세 바뀌는 동작 4)", () => {
  type Mount = { node: string; occupancy?: string };
  const emptyMounts = (): string[] => {
    const out: string[] = [];
    for (const f of ["1", "2"] as const) {
      const floor = LAYOUT.floors[f] as unknown as { reserveStations: { mounts: Mount[] }[]; merchandisingFixtures: { mounts: Mount[] }[] };
      for (const s of [...floor.reserveStations, ...floor.merchandisingFixtures]) for (const m of s.mounts) if (m.occupancy === "empty") out.push(m.node);
    }
    return out;
  };

  it("layout JSON의 빈 자리는 예비 10 + 새 가구 6 = 16곳이다", () => {
    expect(emptyMounts()).toHaveLength(16);
    expect(new Set(emptyMounts()).size).toBe(16);
  });

  it("어느 상품의 displayAnchor도 빈 자리 노드가 아니다", () => {
    const empties = new Set(emptyMounts());
    for (const p of CLOTHING_PRODUCTS) expect({ id: p.id, empty: empties.has(p.displayAnchor) }).toEqual({ id: p.id, empty: false });
    expect(STOCK.products).toHaveLength(22);
  });
});

describe("[spec] 걸을 수 없는 곳(명세 바뀌는 동작 2)", () => {
  it("새 계산대 자리(boundsXZ [3.39, -2.34, 4.55, 0.66]) 가운데는 걸을 수 없고, 옛 계산대 자리(가운데 모델 (4.38, 3.8))는 걸을 수 있다", () => {
    applyArea("clothing1");
    expect(LAYOUT.checkout.boundsXZ).toEqual([3.39, -2.34, 4.55, 0.66]);
    const nc = app((3.39 + 4.55) / 2, (-2.34 + 0.66) / 2);
    expect(isFree(nc.x, nc.z)).toBe(false);
    const oc = app(4.38, 3.8);
    expect(isFree(oc.x, oc.z)).toBe(true);
  });

  it("선글라스 새 진열대(boundsXZ [2.81, 1.62, 5.25, 2.7]) 가운데는 걸을 수 없다", () => {
    applyArea("clothing1");
    const c = app((2.81 + 5.25) / 2, (1.62 + 2.7) / 2);
    expect(isFree(c.x, c.z)).toBe(false);
  });
});

describe("[spec] 사용자가 확인을 요청한 길(1층 입구 → 선글라스, 계단 통로)", () => {
  const length = (from: FloorPoint, path: FloorPoint[]) => {
    let prev = from;
    let total = 0;
    for (const p of path) {
      total += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev = p;
    }
    return total;
  };

  it("입구에서 선글라스 서는 자리까지 길이 있고 곧은 거리에 가깝다(계산대를 돌아가지 않는다)", () => {
    applyArea("clothing1");
    const from = CLOTHING_NODES.entranceSpawn;
    const goal = clothingProduct("wear-face-honey-panto")!.approach;
    expect(isFree(goal.x, goal.z)).toBe(true);
    const path = findPath(from, [goal])!;
    expect(path).not.toBeNull();
    const straight = Math.hypot(goal.x - from.x, goal.z - from.z);
    expect(length(from, path)).toBeLessThanOrEqual(straight * 1.25);
    // 계산대(모델 x 3.39..4.55, z -2.34..0.66)를 돌아 위쪽(모델 z < 1)으로 가는 점이 없다
    for (const p of path) expect(p.z - CLOTHING_OFFSET.z).toBeGreaterThan(1);
  });

  it("입구에서 1층 계단(F1_StairsUp)까지, 2층 도착 자리에서 2층 계단(F2_StairsDown)까지 길이 있다", () => {
    applyArea("clothing1");
    expect(findPath(CLOTHING_NODES.entranceSpawn, [CLOTHING_NODES.stairsUp])).not.toBeNull();
    expect(findPath(CLOTHING_NODES.fromUpper, [CLOTHING_NODES.entranceSpawn])).not.toBeNull();
    applyArea("clothing2");
    expect(findPath(CLOTHING_NODES.fromLower, [CLOTHING_NODES.stairsDown])).not.toBeNull();
  });

  it("계산대와 선글라스 진열대 사이(모델 z≈1.14)와 계산대 뒤 통로(모델 x≈5.045)가 열려 있고, 입구에서 갈 수 있다", () => {
    applyArea("clothing1");
    const between = app(4.0, 1.14);
    const behind = app(5.045, -0.84);
    for (const spot of [between, behind]) {
      expect({ spot, free: isFree(spot.x, spot.z) }).toEqual({ spot, free: true });
      expect({ spot, path: findPath(CLOTHING_NODES.entranceSpawn, [spot]) !== null }).toEqual({ spot, path: true });
    }
    expect(findPath(CLOTHING_NODES.stairsUp, [behind])).not.toBeNull();
  });

  it("각 층의 진열 상품 11종 서는 자리까지 모두 길이 있다(1층은 입구에서, 2층은 도착 자리에서)", () => {
    applyArea("clothing1");
    for (const p of clothingProductsOnFloor(1)) {
      expect({ id: p.id, path: findPath(CLOTHING_NODES.entranceSpawn, [p.approach]) !== null }).toEqual({ id: p.id, path: true });
    }
    applyArea("clothing2");
    for (const p of clothingProductsOnFloor(2)) {
      expect({ id: p.id, path: findPath(CLOTHING_NODES.fromLower, [p.approach]) !== null }).toEqual({ id: p.id, path: true });
    }
  });
});
