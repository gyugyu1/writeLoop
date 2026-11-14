// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 마을에서 움직이기(B1~B9), 모델 없이 데이터만으로 걷기(F4의 걷기 부분).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md)와
// 결정(04-main-decision.md 1: 마을에서 걸어갈 수 없는 곳이나 마을 밖을 누르면 누른 곳에서 가장 가까운 걸어갈 수 있는 곳으로 간다)에서만 가져온다.
// 구현 코드는 부르는 방법(engine.ts의 applyArea·LobbySim·isFree·isClearLine, village.ts의 VILLAGE_PLACES·VILLAGE_START·VILLAGE_BUILDINGS,
// 물건 자리를 담은 village-layout.json)을 알려고만 읽었다. 마을 구역을 켠 시뮬레이션에 누르기와 프레임(0.05초)을 직접 넣는다.
// 19 결정(사용자, 마을 70×60칸으로 넓힘·새 배치)으로 마을 칸 범위(가장 가까운 칸 찾기, B3의 끄는 점 찾기)를 옛 크기 28×24에서 마을 데이터의 크기로 고쳤다.
// 단언과 기대값은 그대로다.
// 088 ② 03 결정 1(사용자, 2026-11-13 "qa가 새 동작에 맞게 고침")로 B5·B6의 말풍선 기대값만 ②의 새 동작으로 고쳤다:
// 라룹이 집은 "집으로 들어갈까?"와 버튼 "들어가기", 닫힌 건물은 "<이름>은 곧 열려요"와 버튼 없음(버튼 값 null, 옛 B6과 같은 단언). 도착 자리·arrived 단언은 그대로다.
// 걷기는 3D 모델과 관계없이 데이터대로 되므로, 이 파일 전체가 F4("모델을 불러오지 못해도 걷기는 된다")의 걷기 부분이기도 하다.
import { LobbySim, applyArea, isClearLine, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_BUILDINGS, VILLAGE_PLACES, VILLAGE_START } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";

/** 088 ② 장소 말풍선(02-qa-scenarios N1·C1~C3). 버튼 없음은 null. */
const PLACE_BUBBLE: Record<PlaceKey, { text: string; button: string | null }> = {
  home: { text: "집으로 들어갈까?", button: "들어가기" },
  furnitureShop: { text: "가구점은 곧 열려요", button: null },
  cafe: { text: "카페는 곧 열려요", button: null },
  library: { text: "도서관은 곧 열려요", button: null }
};

const fountain: FloorPoint = { x: LAYOUT.fountain.x, z: LAYOUT.fountain.z };
type PlaceKey = "home" | "furnitureShop" | "cafe" | "library";

let now = 1_000_000;

function newSim(at: FloorPoint = VILLAGE_START): LobbySim {
  return new LobbySim({ x: at.x, z: at.z, random: () => 0.5 });
}

function floorHit(point: FloorPoint | null): PointerHit {
  return { point, mark: null, onCharacter: false };
}

function placeHit(id: PlaceKey): PointerHit {
  return { point: VILLAGE_PLACES[id].approach[0], mark: id, onCharacter: false };
}

function tap(sim: LobbySim, hit: PointerHit) {
  sim.pointerDown(hit, 100, 100, now);
  now += 50;
  return sim.pointerUp(now);
}

/** seconds만큼 프레임을 돌린다. eachFrame이 있으면 프레임마다 부른다. */
function run(sim: LobbySim, seconds: number, eachFrame?: () => void) {
  const frames = Math.round(seconds / 0.05);
  for (let i = 0; i < frames; i += 1) {
    now += 50;
    sim.update(0.05, now);
    eachFrame?.();
  }
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** target에서 가장 가까운, 걸어갈 수 있는 칸 가운데. */
function nearestFreeTile(target: FloorPoint): FloorPoint {
  let best: FloorPoint | null = null;
  for (let c = 0; c < VILLAGE.width; c += 1) {
    for (let r = 0; r < VILLAGE.depth; r += 1) {
      const p = { x: c + 0.5, z: r + 0.5 };
      if (isFree(p.x, p.z) && (!best || dist(p, target) < dist(best, target))) best = p;
    }
  }
  expect(best).not.toBeNull();
  return best!;
}

/** 분수 바로 앞(분수와 도서관 사이)의 걸어갈 수 있는 자리. */
function frontOfFountain(): FloorPoint {
  const libraryBack = VILLAGE_BUILDINGS.find((b) => b.id === "library")!.rect[1];
  for (let z = fountain.z + LAYOUT.fountain.radius; z < libraryBack; z += 0.1) if (isFree(fountain.x, z)) return { x: fountain.x, z };
  throw new Error("분수 앞 자리를 찾지 못함");
}

beforeEach(() => {
  applyArea("village");
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 마을에서 움직이기(B1~B9)", () => {
  it("B1: 라룹이 집 앞에서 광장 둘레의 바닥을 톡하면 그곳으로 걸어가 멈춘다", () => {
    const sim = newSim();
    const p = nearestFreeTile({ x: fountain.x - 3.5, z: fountain.z });
    expect(tap(sim, floorHit(p))).toBe("walk");
    run(sim, 20);
    expect(dist({ x: sim.x, z: sim.z }, p)).toBeLessThanOrEqual(0.06);
  });

  it("B2: 분수 건너편(분수 바로 앞)을 톡하면 걸어갈 수 없는 곳을 돌아 도착하고, 걷는 내내 걸어갈 수 있는 자리에 있다", () => {
    const sim = newSim();
    const target = frontOfFountain();
    expect(tap(sim, floorHit(target))).toBe("walk");
    const bad: string[] = [];
    run(sim, 20, () => {
      if (!isFree(sim.x, sim.z)) bad.push(`${sim.x.toFixed(2)},${sim.z.toFixed(2)}`);
    });
    expect(bad).toEqual([]);
    expect(dist({ x: sim.x, z: sim.z }, target)).toBeLessThanOrEqual(0.06);
  });

  it("B3: 누른 채 끌면 끄는 중이 되고 손가락(끄는 점)을 따라가며, 손을 떼면 drag-end", () => {
    const sim = newSim();
    const start = { x: sim.x, z: sim.z };
    // 곧게 끌어갈 수 있는, 3~5칸 떨어진 걸어갈 수 있는 자리
    let q: FloorPoint | null = null;
    for (let c = 0; c < VILLAGE.width && !q; c += 1) {
      for (let r = 0; r < VILLAGE.depth && !q; r += 1) {
        const p = { x: c + 0.5, z: r + 0.5 };
        const d = dist(p, start);
        if (d >= 3 && d <= 5 && isFree(p.x, p.z) && isClearLine(start, p)) q = p;
      }
    }
    expect(q).not.toBeNull();
    sim.pointerDown(floorHit(start), 100, 100, now);
    sim.pointerMove(floorHit(q), 130, 100);
    run(sim, 0.05);
    expect(sim.snapshot(now).dragging).toBe(true);
    const before = dist(start, q!);
    let closest = before;
    run(sim, 5, () => {
      closest = Math.min(closest, dist({ x: sim.x, z: sim.z }, q!));
    });
    expect(closest).toBeLessThan(before);
    expect(closest).toBeLessThanOrEqual(0.25);
    expect(sim.pointerUp(now)).toBe("drag-end");
  });

  it("B4: 끄는 점을 분수 가운데에 두어도 걸어갈 수 없는 곳에는 들어가지 않는다", () => {
    const sim = newSim();
    sim.pointerDown(floorHit({ x: sim.x, z: sim.z }), 100, 100, now);
    sim.pointerMove(floorHit(fountain), 140, 160);
    const bad: string[] = [];
    run(sim, 8, () => {
      if (!isFree(sim.x, sim.z)) bad.push(`${sim.x.toFixed(2)},${sim.z.toFixed(2)}`);
    });
    expect(sim.snapshot(now).dragging).toBe(true);
    expect(bad).toEqual([]);
  });

  it.each([
    ["home", "cafe"],
    ["home", "furnitureShop"],
    ["home", "library"],
    ["library", "home"]
  ] as [PlaceKey, PlaceKey][])("B5·B6(088 ② 03 결정 1): %s 앞에서 장소 %s 이름표를 누르면 그 서는 자리에 멈춰 도착하고, 그 장소의 말풍선 글·버튼이 나온다", (from, to) => {
    const sim = newSim(VILLAGE_PLACES[from].approach[0]);
    expect(tap(sim, placeHit(to))).toBe("walk");
    run(sim, 30);
    const goal = VILLAGE_PLACES[to].approach[0];
    expect(dist({ x: sim.x, z: sim.z }, goal)).toBeLessThanOrEqual(0.06);
    const snap = sim.snapshot(now);
    expect(snap.arrived).toBe(to);
    // B6(088 ② 03 결정 1): 라룹이 집은 들어가기 말풍선, 닫힌 건물은 '곧 열려요'와 버튼 없음(방 장소 안내는 나오지 않는다)
    expect(snap.bubbleText).toBe(PLACE_BUBBLE[to].text);
    expect(snap.bubbleButton).toBe(PLACE_BUBBLE[to].button);
  });

  it("B7: 걷는 속도 3.2칸/초, 돌아서는 빠르기 10(방과 같다)", () => {
    const sim = newSim();
    expect(sim.settings).toEqual({ speed: 3.2, turn: 10 });
  });

  it("B8: 아무것도 하지 않으면 20초 전에는 서 있고, 20초 뒤에 앉기 시작한다", () => {
    const sim = newSim();
    run(sim, 0.05);
    run(sim, 19.8);
    expect(sim.snapshot(now).posture).toBeNull();
    run(sim, 0.3);
    expect(sim.snapshot(now).posture?.kind).toBe("sitting-down");
  });

  const unwalkable: [string, () => FloorPoint][] = [
    ["분수 가운데", () => fountain],
    ...VILLAGE_BUILDINGS.map((b) => [`${b.label} 가운데`, () => ({ x: (b.rect[0] + b.rect[2]) / 2, z: (b.rect[1] + b.rect[3]) / 2 })] as [string, () => FloorPoint]),
    ["마을 밖 (-2, 12)", () => ({ x: -2, z: 12 })]
  ];

  it.each(unwalkable)("B9: %s을(를) 누르면 누른 곳에서 가장 가까운 걸어갈 수 있는 곳으로 걸어가 멈춘다(04 결정 1)", (_name, at) => {
    const sim = newSim();
    const pressed = at();
    expect(tap(sim, floorHit(pressed))).toBe("walk");
    run(sim, 30);
    const end = { x: sim.x, z: sim.z };
    expect(sim.snapshot(now).moving).toBe(false);
    expect(isFree(end.x, end.z)).toBe(true);
    expect(dist(end, pressed)).toBeLessThanOrEqual(dist(nearestFreeTile(pressed), pressed) + 1e-6);
  });
});
