// [spec] qa 테스트(작업 132 가구점 품절 안내판, 기능 변경, 모바일): 앱 자산과 진열 상태 곁의 '빈 상태 확정' 표시.
// 기대값은 private 작업 폴더 132-2026-11-20-가구점-품절-안내판/01-main-spec.md(명세 1, 2)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다(명세 "테스트가 쓸 이름"): shopVacancy·setShopSlotVacant·subscribeShopVacancy·resetShopVacancy·isShopSlotVacant.
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { applyArea } from "@/lib/lobby3d/engine";
import * as shop from "@/lib/lobby3d/shop";

const MOBILE = join(__dirname, "../..");
const ORIGINAL_DIR = "C:/WriteLoop-asset/마을건물/가구점/내부";
const APP_GLB = join(MOBILE, "assets/models/shop/furniture-shop-interior.glb");
const APP_JSON = join(MOBILE, "src/lib/lobby3d/shop-layout.json");

interface RawNode {
  name: string;
  translation?: number[];
  rotation?: number[];
  children?: number[];
}
interface RawGltf {
  nodes: RawNode[];
  scenes: { name?: string; nodes: number[] }[];
}
function rawGltf(file: string): RawGltf {
  const data = readFileSync(file);
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString("utf8")) as RawGltf;
}

afterEach(() => {
  (shop as { resetShopVacancy?: () => void }).resetShopVacancy?.();
  applyArea("room");
});

describe("[spec] 앱 자산이 애셋 폴더의 새 버전이다(명세 1)", () => {
  it("A1: 실내 모델은 2,678,352바이트다", () => {
    expect(statSync(APP_GLB).size).toBe(2678352);
  });

  it("A2: 원본(C:/WriteLoop-asset)이 이 컴퓨터에 있으면 GLB와 shop-layout.json이 원본과 바이트가 같다(없으면 건너뜀)", () => {
    if (!existsSync(ORIGINAL_DIR)) return;
    expect(readFileSync(APP_GLB).equals(readFileSync(join(ORIGINAL_DIR, "furniture-shop-interior.glb")))).toBe(true);
    expect(readFileSync(APP_JSON).equals(readFileSync(join(ORIGINAL_DIR, "shop-layout.json")))).toBe(true);
  });

  it("A3: GLB에 ShopNameplateTemplates 장면이 있고 그 안에 ShopDisplay_SoldOutBoard가 있다. 기본 장면(매장)은 따로 있다", () => {
    const gltf = rawGltf(APP_GLB);
    const templates = gltf.scenes.find((s) => s.name === "ShopNameplateTemplates");
    expect(templates).toBeDefined();
    expect(templates!.nodes.map((i) => gltf.nodes[i].name)).toContain("ShopDisplay_SoldOutBoard");
    expect(gltf.scenes.length).toBeGreaterThanOrEqual(2);
    const main = gltf.scenes[0];
    expect(main.name).not.toBe("ShopNameplateTemplates");
  });

  it("A4: 명찰 05는 명찰 01보다 22cm 높고(앞 책상에 가려지지 않게), 양옆 명찰 01·02·05·06은 같은 회전(카메라 정면)이다", () => {
    const gltf = rawGltf(APP_GLB);
    const byName = (n: string) => gltf.nodes.find((x) => x.name === n)!;
    const y = (n: string) => byName(n).translation![1];
    expect(y("Station_05_Nameplate") - y("Station_01_Nameplate")).toBeCloseTo(0.22, 3);
    const q = byName("Station_01_Nameplate").rotation!;
    for (const n of ["02", "05", "06"]) byName(`Station_${n}_Nameplate`).rotation!.forEach((v, k) => expect(v).toBeCloseTo(q[k], 5));
  });

  it("A5: 걸을 수 없는 곳은 새 JSON의 blockedRectsXZ를 따른다: 명찰 넷(01·02·05·06)의 새 사각형 가운데가 막힌다", () => {
    applyArea("shop");
    const rects: Record<string, [number, number, number, number]> = {
      nameplate01: [-6.5, 4.79, -5.38, 4.96],
      nameplate02: [-6.5, 0.41, -5.38, 0.58],
      nameplate05: [5.52, -0.55, 6.64, -0.38],
      nameplate06: [5.52, 3.85, 6.64, 4.02]
    };
    for (const [name, [x0, z0, x1, z1]] of Object.entries(rects)) {
      const x = (x0 + x1) / 2 + 9;
      const z = (z0 + z1) / 2 + 8;
      expect({ name, solid: shop.shopSolidAt(x, z) }).toEqual({ name, solid: true });
    }
  });

  it("A6: 앱 CREDITS.md의 실내 모델 줄에 품절 안내판이 적혀 있다", () => {
    const credits = readFileSync(join(MOBILE, "assets/models/CREDITS.md"), "utf8");
    const line = credits.split("\n").find((l) => l.includes("furniture-shop-interior.glb"));
    expect(line).toBeDefined();
    expect(line!).toContain("품절 안내판");
  });
});

describe("[spec] 슬롯별 빈 상태 확정 표시(명세 2)", () => {
  it("V1: 처음에는 여섯 슬롯 모두 false이고 isShopSlotVacant도 모두 false다", () => {
    expect([...shop.shopVacancy()]).toEqual([false, false, false, false, false, false]);
    for (let i = 0; i < 6; i += 1) expect(shop.isShopSlotVacant(i)).toBe(false);
  });

  it("V2: setShopSlotVacant는 그 슬롯만 바꾸고, 바뀔 때마다 새 배열을 돌려준다(이전 배열은 그대로)", () => {
    const before = shop.shopVacancy();
    shop.setShopSlotVacant(2, true);
    const after = shop.shopVacancy();
    expect(after).not.toBe(before);
    expect([...after]).toEqual([false, false, true, false, false, false]);
    expect([...before]).toEqual([false, false, false, false, false, false]);
    expect(shop.isShopSlotVacant(2)).toBe(true);
    expect(shop.isShopSlotVacant(1)).toBe(false);
    shop.setShopSlotVacant(2, false);
    expect([...shop.shopVacancy()]).toEqual([false, false, false, false, false, false]);
    expect(shop.isShopSlotVacant(2)).toBe(false);
  });

  it("V3: 같은 값으로 바꾸면 아무것도 하지 않는다(구독자를 부르지 않고 배열도 그대로)", () => {
    const listener = jest.fn();
    const off = shop.subscribeShopVacancy(listener);
    const before = shop.shopVacancy();
    shop.setShopSlotVacant(0, false);
    expect(listener).not.toHaveBeenCalled();
    expect(shop.shopVacancy()).toBe(before);
    shop.setShopSlotVacant(0, true);
    expect(listener).toHaveBeenCalledTimes(1);
    shop.setShopSlotVacant(0, true);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("V4: 구독을 풀면 더는 부르지 않는다. 구독 해제 함수를 돌려준다", () => {
    const listener = jest.fn();
    const off = shop.subscribeShopVacancy(listener);
    expect(typeof off).toBe("function");
    off();
    shop.setShopSlotVacant(4, true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("V5: resetShopVacancy는 모두 false로 되돌린다", () => {
    shop.setShopSlotVacant(1, true);
    shop.setShopSlotVacant(5, true);
    shop.resetShopVacancy();
    expect([...shop.shopVacancy()]).toEqual([false, false, false, false, false, false]);
    for (let i = 0; i < 6; i += 1) expect(shop.isShopSlotVacant(i)).toBe(false);
  });

  it("V6: 빈 상태 표시는 진열 상태와 따로다: 빈 상태로 바꿔도 진열은 그대로고, 진열을 바꿔도 빈 상태는 그대로다(명세 7)", () => {
    shop.setShopSlotVacant(0, true);
    expect([...shop.shopDisplay()]).toEqual(shop.DEFAULT_SHOP_DISPLAY);
    shop.setShopDisplay(0, "cloudDesk");
    expect(shop.shopDisplay()[0]).toBe("cloudDesk");
    expect(shop.isShopSlotVacant(0)).toBe(true);
    shop.resetShopDisplay();
  });
});
