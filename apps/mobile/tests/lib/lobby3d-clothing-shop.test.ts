// 메인 세션 테스트(작업 133 ① 옷집 입장·두 층 이동): 층마다 걷기·장소·걸을 수 없는 곳이 clothing-shop-layout.json과 맞는지.
import { LobbySim, applyArea, findPath, isFree, markInfo, activePlaceIds, activeBounds, type FloorPoint } from "@/lib/lobby3d/engine";
import { CLOTHING_BOUNDS, CLOTHING_NODES, CLOTHING_OFFSET, CLOTHING_PLAYER_RADIUS, clothingSolidAt } from "@/lib/lobby3d/clothing-shop";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";

const now = 1_000_000;

afterEach(() => applyArea("room"));

describe("옷집 층마다 장소와 걷기", () => {
  it("1층: 입장 자리에서 출입문·2층 계단까지 길이 있다", () => {
    applyArea("clothing1");
    expect(activePlaceIds()).toEqual(["clothingExit", "clothingUp", "clothingFitting1", "clothingCheckout"]);
    const from: FloorPoint = CLOTHING_NODES.entranceSpawn;
    expect(isFree(from.x, from.z)).toBe(true);
    for (const id of ["clothingExit", "clothingUp"] as const) {
      const goal = markInfo(id).approach[0];
      expect({ id, free: isFree(goal.x, goal.z) }).toEqual({ id, free: true });
      expect({ id, path: findPath(from, [goal]) !== null }).toEqual({ id, path: true });
    }
    // 2층에서 내려와 서는 자리에서도 출입문까지 간다
    expect(findPath(CLOTHING_NODES.fromUpper, markInfo("clothingExit").approach)).not.toBeNull();
  });

  it("2층: 올라와 서는 자리에서 1층 계단까지 길이 있다", () => {
    applyArea("clothing2");
    expect(activePlaceIds()).toEqual(["clothingDown", "clothingFitting2"]);
    const from = CLOTHING_NODES.fromLower;
    expect(isFree(from.x, from.z)).toBe(true);
    expect(findPath(from, markInfo("clothingDown").approach)).not.toBeNull();
  });

  it("막힌 사각형 가운데는 걸을 수 없고, 벽에서 라룹이 반지름(0.32) 안쪽에는 설 수 없다", () => {
    expect(CLOTHING_PLAYER_RADIUS).toBe(0.32);
    for (const floor of [1, 2] as const) {
      applyArea(floor === 1 ? "clothing1" : "clothing2");
      for (const r of LAYOUT.floors[String(floor) as "1" | "2"].blockedRectsXZ) {
        expect(clothingSolidAt(floor, (r[0] + r[2]) / 2 + CLOTHING_OFFSET.x, (r[1] + r[3]) / 2 + CLOTHING_OFFSET.z)).toBe(true);
      }
      const [x0, z0] = LAYOUT.floors[String(floor) as "1" | "2"].insideRectXZ;
      expect(isFree(x0 + 0.1 + CLOTHING_OFFSET.x, 0.3 + CLOTHING_OFFSET.z)).toBe(false);
      expect(isFree(1.2 + CLOTHING_OFFSET.x, z0 + 0.1 + CLOTHING_OFFSET.z)).toBe(false);
    }
    // 계산대(F1_CheckoutCounter, layout checkout.positionXYZ) 가운데
    const [cx, , cz] = LAYOUT.checkout.positionXYZ;
    expect(clothingSolidAt(1, cx + CLOTHING_OFFSET.x, cz + CLOTHING_OFFSET.z)).toBe(true);
  });

  it("층마다 카메라 끝 상자는 그 층 벽 안쪽이다", () => {
    applyArea("clothing2");
    expect(activeBounds()).toBe(CLOTHING_BOUNDS[2]);
    expect(CLOTHING_BOUNDS[1].minX).toBeCloseTo(-8.26 + CLOTHING_OFFSET.x);
  });

  it("1층에서 출입문 장소로 걸어가 문 쪽을 보고 선다(지나는 모든 자리가 설 수 있는 곳)", () => {
    applyArea("clothing1");
    const sim = new LobbySim({ x: CLOTHING_NODES.entranceSpawn.x, z: CLOTHING_NODES.entranceSpawn.z, random: () => 0.5 });
    for (const id of ["clothingUp", "clothingExit"] as const) {
      sim.pointerDown({ point: null, mark: id, onCharacter: false }, 0, 0, now);
      sim.pointerUp(now + 10);
      let t = now + 10;
      for (let i = 0; i < 1200 && sim.snapshot(t).place !== id; i += 1) {
        t += 16;
        sim.update(0.016, t);
        expect(isFree(sim.x, sim.z) || Math.hypot(sim.x - markInfo(id).approach[0].x, sim.z - markInfo(id).approach[0].z) < 0.3).toBe(true);
      }
      expect(sim.snapshot(t).place).toBe(id);
    }
  });
});

// 최신 애셋(2026-11-21 17:58 판): 입구에서 선글라스 진열대까지 곧게, 계단 통로가 막히지 않는다
describe("옷집 최신 배치", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { clothingProduct, CLOTHING_PRODUCTS } = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const pathLength = (path: FloorPoint[], from: FloorPoint) => {
    let d = 0;
    let a = from;
    for (const b of path) {
      d += Math.hypot(b.x - a.x, b.z - a.z);
      a = b;
    }
    return d;
  };

  it("1층 입구에서 선글라스 서는 자리까지 계산대를 돌아가지 않는다(길이 곧은 거리의 1.15배 안)", () => {
    applyArea("clothing1");
    const from = CLOTHING_NODES.entranceSpawn;
    const goal = clothingProduct("wear-face-honey-panto")!.approach;
    const path = findPath(from, [goal]);
    expect(path).not.toBeNull();
    expect(pathLength(path!, from)).toBeLessThanOrEqual(Math.hypot(goal.x - from.x, goal.z - from.z) * 1.15);
  });

  it("1층 입구에서 계단까지, 2층 도착 자리에서 1층 계단까지 막히지 않고 곧게 간다", () => {
    applyArea("clothing1");
    const up = markInfo("clothingUp").approach[0];
    const a = findPath(CLOTHING_NODES.entranceSpawn, [up]);
    expect(a).not.toBeNull();
    expect(pathLength(a!, CLOTHING_NODES.entranceSpawn)).toBeLessThanOrEqual(Math.hypot(up.x - CLOTHING_NODES.entranceSpawn.x, up.z - CLOTHING_NODES.entranceSpawn.z) * 1.15);
    applyArea("clothing2");
    expect(findPath(CLOTHING_NODES.fromLower, markInfo("clothingDown").approach)).not.toBeNull();
  });

  it("층마다 모든 진열 상품의 서는 자리에 들어온 곳에서 걸어갈 수 있다", () => {
    for (const floor of [1, 2] as const) {
      applyArea(floor === 1 ? "clothing1" : "clothing2");
      const from = floor === 1 ? CLOTHING_NODES.entranceSpawn : CLOTHING_NODES.fromLower;
      for (const product of CLOTHING_PRODUCTS.filter((p) => p.floor === floor)) {
        expect({ id: product.id, path: findPath(from, [product.approach]) !== null }).toEqual({ id: product.id, path: true });
      }
    }
  });
});

// 작업 133 ③: 층마다 피팅룸 장소, 커튼이 닫힌 동안 그 방 입구가 막힌다
describe("옷집 피팅룸 장소와 임시 충돌", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const shop = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
  /* eslint-enable @typescript-eslint/no-require-imports */
  afterEach(() => shop.setClothingCurtainClosed(null));

  it("층마다 피팅룸 앞에서 방 안까지 갈 수 있고, 그 층 커튼이 닫히면 막히며 다른 층은 그대로다", () => {
    for (const floor of [1, 2] as const) {
      applyArea(floor === 1 ? "clothing1" : "clothing2");
      const id = floor === 1 ? "clothingFitting1" : "clothingFitting2";
      expect(activePlaceIds()).toContain(id);
      const room = shop.CLOTHING_FITTING_ROOMS[floor];
      const from = markInfo(id).approach[0];
      expect(findPath(from, [room.inside])).not.toBeNull();
      shop.setClothingCurtainClosed(floor);
      expect(findPath(from, [room.inside])).toBeNull();
      shop.setClothingCurtainClosed(floor === 1 ? 2 : 1);
      expect(findPath(from, [room.inside])).not.toBeNull();
      shop.setClothingCurtainClosed(null);
    }
  });
});

// 작업 133 피팅 카메라 전신: 화면 비율마다 발끝·머리 위가 피팅 창(아래 절반) 위 화면 안에 들어온다
describe("피팅 카메라 전신", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const engine = require("@/lib/lobby3d/engine") as typeof import("@/lib/lobby3d/engine");
  /* eslint-enable @typescript-eslint/no-require-imports */
  it("세로로 긴 폰부터 태블릿 비율까지 전신이 창 위에 들어오고, 가까운 자르는 면은 라룹이 바로 앞이다", () => {
    for (const aspect of [0.42, 0.46, 0.5, 0.56, 0.75]) {
      const pose = engine.fittingCameraPose({ x: 3, z: 4 }, aspect, 0.5);
      const d = pose.position.z - 4;
      const pitch = Math.atan((pose.position.y - pose.lookAt.y) / d);
      const tanV = Math.tan((pose.fovDeg * Math.PI) / 360);
      const ndc = (y: number) => Math.tan(Math.atan((y - pose.position.y) / d) + pitch) / tanV;
      expect(ndc(0)).toBeGreaterThanOrEqual(0);
      expect(ndc(engine.FITTING_VIEW.bodyHeight)).toBeLessThanOrEqual(1);
      expect(Math.abs(engine.FITTING_VIEW.bodyHalfWidth / (d * tanV * aspect))).toBeLessThanOrEqual(1);
      expect(pose.near).toBeCloseTo(d - engine.FITTING_VIEW.nearAhead, 6);
      expect(pose.position.x).toBe(3);
    }
  });
});
