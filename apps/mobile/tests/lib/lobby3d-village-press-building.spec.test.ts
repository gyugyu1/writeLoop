// [spec] qa 테스트(작업 125 마을 건물 누르기 동작, 기능 변경, 모바일): 마을에서 건물·소품을 누르고 있어도 시간으로는 끌기가 되지 않고,
// 손가락을 크게 움직이면(TAP_MAX_MOVE_PX 초과) 끌기가 되며, 끌기가 되지 않은 채 떼면 톡처럼 처리한다
// (건물은 그 건물의 문 앞으로, 소품은 누른 자리에서 가장 가까운 걸을 수 있는 곳으로).
// 기대값은 명세(private 작업 폴더 125-2026-11-19-마을-건물-누르기-동작/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 8b37853의 지금 동작이다.
//
// 가정(명세에 모양이 없음, 구현 뒤 맞추어야 할 곳은 아래 buildingHit·propHit 두 함수뿐):
// 건물·소품 위를 누른 판정(PointerHit)은 onScenery: true를 갖고, 건물이면 building에 장소 id(home·furnitureShop·clothingShop)를 갖는다.
// 누른 자리(point)는 걸을 수 없는 칸이다(건물 안쪽·분수). mark는 이름표를 누른 판정에만 쓰므로 null이다.
//
// 바뀔 동작(구현 전 실패): H1~H4, H6. 그대로 둘 동작(구현 전·뒤 통과): H5(지금도 시간 끌기라 통과하지만, 새 동작에서도 크게 움직이면 끌기여야 한다), U1~U5.
import { HOLD_MS, LobbySim, TAP_MAX_MOVE_PX, applyArea, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_BUILDINGS, VILLAGE_PLACES, VILLAGE_START, VILLAGE_FOUNTAIN, type VillageBuildingId } from "@/lib/lobby3d/village";

let now = 1_000_000;

function newSim(at: FloorPoint = VILLAGE_START): LobbySim {
  return new LobbySim({ x: at.x, z: at.z, random: () => 0.5 });
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function floorHit(point: FloorPoint | null): PointerHit {
  return { point, mark: null, onCharacter: false };
}

/** 건물 위를 누른 판정(가정: onScenery·building). 누른 자리는 건물 안쪽. */
function buildingHit(id: VillageBuildingId): PointerHit {
  const b = VILLAGE_BUILDINGS.find((x) => x.id === id);
  expect({ id, found: b !== undefined }).toEqual({ id, found: true });
  const point = { x: (b!.rect[0] + b!.rect[2]) / 2, z: (b!.rect[1] + b!.rect[3]) / 2 };
  return { point, mark: null, onCharacter: false, onScenery: true, building: id } as PointerHit;
}

/** 소품(분수) 위를 누른 판정(가정: onScenery). */
function propHit(): PointerHit {
  return { point: { x: VILLAGE_FOUNTAIN.x, z: VILLAGE_FOUNTAIN.z }, mark: null, onCharacter: false, onScenery: true } as PointerHit;
}

function run(sim: LobbySim, seconds: number) {
  const frames = Math.round(seconds / 0.05);
  for (let i = 0; i < frames; i += 1) {
    now += 50;
    sim.update(0.05, now);
  }
}

function nearestFreeTile(target: FloorPoint): FloorPoint {
  let best: FloorPoint | null = null;
  for (let c = 0; c < VILLAGE.width; c += 1) {
    for (let r = 0; r < VILLAGE.depth; r += 1) {
      const p = { x: c + 0.5, z: r + 0.5 };
      if (isFree(p.x, p.z) && (!best || dist(p, target) < dist(best, target))) best = p;
    }
  }
  return best!;
}

const IDS: VillageBuildingId[] = ["home", "furnitureShop", "clothingShop"];
/** 그 건물이 아닌 다른 장소의 문 앞에서 시작한다. */
function startFor(id: VillageBuildingId): FloorPoint {
  const other = IDS.find((x) => x !== id)!;
  return VILLAGE_PLACES[other].approach[0];
}

beforeEach(() => {
  applyArea("village");
});
afterEach(() => {
  applyArea("room");
});

describe("[spec] 마을 건물·소품 누르기(125)", () => {
  it.each(IDS)("H1(바뀜 1·3): %s 위를 누르고 0.22초가 지나도 끌기가 아니고, 떼면 그 건물 문 앞으로 걸어가 도착한다", (id) => {
    const sim = newSim(startFor(id));
    sim.pointerDown(buildingHit(id), 100, 100, now);
    run(sim, (HOLD_MS / 1000) * 3);
    expect(sim.snapshot(now).dragging).toBe(false);
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 40);
    expect(dist({ x: sim.x, z: sim.z }, VILLAGE_PLACES[id].approach[0])).toBeLessThanOrEqual(0.06);
    expect(sim.snapshot(now).arrived).toBe(id);
  });

  it("H2(바뀜 1·3): 소품(분수) 위를 오래 누르고 있어도 끌기가 아니고, 떼면 누른 자리에서 가장 가까운 걸을 수 있는 곳으로 걸어가 멈춘다", () => {
    const sim = newSim();
    sim.pointerDown(propHit(), 100, 100, now);
    run(sim, 1);
    expect(sim.snapshot(now).dragging).toBe(false);
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 40);
    const end = { x: sim.x, z: sim.z };
    const pressed = propHit().point!;
    expect(sim.snapshot(now).moving).toBe(false);
    expect(isFree(end.x, end.z)).toBe(true);
    expect(dist(end, pressed)).toBeLessThanOrEqual(dist(nearestFreeTile(pressed), pressed) + 1e-6);
  });

  it("H3(바뀜 4): 건물을 빨리 톡하면 누른 자리 근처가 아니라 그 건물 문 앞으로 간다", () => {
    const sim = newSim(startFor("furnitureShop"));
    sim.pointerDown(buildingHit("furnitureShop"), 100, 100, now);
    now += 50;
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 40);
    expect(dist({ x: sim.x, z: sim.z }, VILLAGE_PLACES.furnitureShop.approach[0])).toBeLessThanOrEqual(0.06);
    expect(sim.snapshot(now).arrived).toBe("furnitureShop");
  });

  it("H4(바뀜 3): 건물을 오래 누르고 프레임 없이 뗄 때(누른 시간이 길어도) 끌기 끝이 아니라 문 앞으로 간다", () => {
    const sim = newSim(startFor("home"));
    sim.pointerDown(buildingHit("home"), 100, 100, now);
    now += 5000;
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 40);
    expect(sim.snapshot(now).arrived).toBe("home");
  });

  it("H5(그대로, 2): 건물을 누른 채 손가락을 TAP_MAX_MOVE_PX보다 크게 움직이면 끌기가 되고, 떼면 drag-end(문 앞으로 가지 않는다)", () => {
    const sim = newSim(startFor("home"));
    sim.pointerDown(buildingHit("home"), 100, 100, now);
    sim.pointerMove(floorHit({ x: sim.x, z: sim.z }), 100 + TAP_MAX_MOVE_PX + 1, 100);
    run(sim, 0.05);
    expect(sim.snapshot(now).dragging).toBe(true);
    expect(sim.pointerUp(now)).toBe("drag-end");
    run(sim, 10);
    expect(sim.snapshot(now).arrived).not.toBe("home");
  });

  it("H6(바뀜 1·2): 건물을 누른 채 TAP_MAX_MOVE_PX 이하로만 움직이면 오래 눌러도 끌기가 아니다", () => {
    const sim = newSim(startFor("clothingShop"));
    sim.pointerDown(buildingHit("clothingShop"), 100, 100, now);
    sim.pointerMove(floorHit({ x: sim.x, z: sim.z }), 100 + TAP_MAX_MOVE_PX, 100);
    run(sim, 1);
    expect(sim.snapshot(now).dragging).toBe(false);
    expect(sim.pointerUp(now)).toBe("walk");
  });

  it("U1(그대로, 5): 마을 바닥(풀밭·길)에서 누르기 시작해 0.22초가 지나면 끌기가 되고, 떼면 drag-end", () => {
    const sim = newSim();
    sim.pointerDown(floorHit({ x: sim.x, z: sim.z }), 100, 100, now);
    run(sim, (HOLD_MS / 1000) * 2);
    expect(sim.snapshot(now).dragging).toBe(true);
    expect(sim.pointerUp(now)).toBe("drag-end");
  });

  it("U2(그대로): 마을 바닥을 빨리 톡하면 그곳으로 걸어간다", () => {
    const sim = newSim();
    const p = nearestFreeTile({ x: VILLAGE_FOUNTAIN.x - 3.5, z: VILLAGE_FOUNTAIN.z });
    sim.pointerDown(floorHit(p), 100, 100, now);
    now += 50;
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 30);
    expect(dist({ x: sim.x, z: sim.z }, p)).toBeLessThanOrEqual(0.06);
  });

  it("U3(그대로): 소품(분수)을 빨리 톡하면 누른 자리에서 가장 가까운 걸을 수 있는 곳으로 간다", () => {
    const sim = newSim();
    sim.pointerDown(propHit(), 100, 100, now);
    now += 50;
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 40);
    const pressed = propHit().point!;
    const end = { x: sim.x, z: sim.z };
    expect(isFree(end.x, end.z)).toBe(true);
    expect(dist(end, pressed)).toBeLessThanOrEqual(dist(nearestFreeTile(pressed), pressed) + 1e-6);
  });

  it("U4(그대로): 이름표(장소)를 빨리 톡하면 그 장소 문 앞으로 간다", () => {
    const sim = newSim(startFor("home"));
    const place = VILLAGE_PLACES.home;
    sim.pointerDown({ point: place.approach[0], mark: "home", onCharacter: false }, 100, 100, now);
    now += 50;
    expect(sim.pointerUp(now)).toBe("walk");
    run(sim, 40);
    expect(sim.snapshot(now).arrived).toBe("home");
  });

  it("U5(그대로): 라룹이를 톡하면 찌르기(poke)", () => {
    const sim = newSim();
    sim.pointerDown({ point: { x: sim.x, z: sim.z }, mark: null, onCharacter: true }, 100, 100, now);
    now += 50;
    expect(sim.pointerUp(now)).toBe("poke");
  });
});
