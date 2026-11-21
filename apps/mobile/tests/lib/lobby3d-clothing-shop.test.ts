// 메인 세션 테스트(작업 133 ① 옷집 입장·두 층 이동): 층마다 걷기·장소·걸을 수 없는 곳이 clothing-shop-layout.json과 맞는지.
import { LobbySim, applyArea, findPath, isFree, markInfo, activePlaceIds, activeBounds, type FloorPoint } from "@/lib/lobby3d/engine";
import { CLOTHING_BOUNDS, CLOTHING_NODES, CLOTHING_OFFSET, CLOTHING_PLAYER_RADIUS, clothingSolidAt } from "@/lib/lobby3d/clothing-shop";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";

const now = 1_000_000;

afterEach(() => applyArea("room"));

describe("옷집 층마다 장소와 걷기", () => {
  it("1층: 입장 자리에서 출입문·2층 계단까지 길이 있다", () => {
    applyArea("clothing1");
    expect(activePlaceIds()).toEqual(["clothingExit", "clothingUp"]);
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
    expect(activePlaceIds()).toEqual(["clothingDown"]);
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
    // 계산대(F1_CheckoutCounter) 가운데
    expect(clothingSolidAt(1, 4.38 + CLOTHING_OFFSET.x, 3.8 + CLOTHING_OFFSET.z)).toBe(true);
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
