/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 137 이동 세 모드, 기능 변경, 모바일): 거리로 목표 속도를 정한다.
// 기대값은 명세(private 작업 폴더 137-2026-11-23-이동-세-모드/01-main-spec.md 바뀌는 동작 1·4, 그대로 둘 동작)와 04 결정(속도 값 그대로)에서만 가져온다.
// - 누른 곳으로 가는 동안 d = 남은 길 길이, 끌기 중 d = 캐릭터에서 손가락이 가리키는 바닥 점까지 거리.
// - d < 4: 2.4(걷기), 4 <= d < 10: 3.6, 10 <= d < 16: 3.6에서 5.0까지 d에 따라 고르게, d >= 16: 5.0.
// - 마지막 칸 도착 감속(min(목표, d * 4 + 0.5))은 그대로. 개발 패널 값(settings.speed)은 걷기 모드 속도만 바꾼다.
// - 어디서나(방·마을) 같은 규칙.
// 방법: 마을에서 시작점으로부터 막힘 없는 일직선(isClearLine) 위로 거리 D만큼 떨어진 바닥 점을 찾아 누르고, 프레임(0.05초)마다
// 속도가 "이전 속도와 그 순간 목표 속도(남은 직선 거리 기준) 중 큰 값"을 넘지 않는지(속도가 목표를 따라 부드럽게 가속하므로) 본다.
import { LobbySim, applyArea, isClearLine, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_START } from "@/lib/lobby3d/village";

let now = 1_000_000;

beforeEach(() => {
  applyArea("village");
});
afterEach(() => {
  applyArea("room");
});

/** 명세의 거리별 목표 속도(칸/초). walk는 걷기 모드 속도(기본 2.4). */
function modeSpeed(d: number, walk = 2.4): number {
  if (d < 4) return walk;
  if (d < 10) return 3.6;
  if (d < 16) return 3.6 + ((d - 10) / 6) * (5.0 - 3.6);
  return 5.0;
}
/** 마지막 칸 도착 감속까지 더한 한 칸 길의 목표 속도. */
const legSpeed = (d: number, walk = 2.4) => Math.min(modeSpeed(d, walk), d * 4 + 0.5);

function floorHit(point: FloorPoint): PointerHit {
  return { point, mark: null, onCharacter: false };
}

/** from에서 거리 dist만큼, 막힘 없는 일직선으로 갈 수 있는 바닥 점. */
function clearPointAt(from: FloorPoint, dist: number): FloorPoint {
  for (let deg = 0; deg < 360; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const p = { x: from.x + Math.cos(a) * dist, z: from.z + Math.sin(a) * dist };
    if (p.x < 1 || p.z < 1 || p.x > VILLAGE.width - 1 || p.z > VILLAGE.depth - 1) continue;
    if (isFree(p.x, p.z) && isClearLine(from, p)) return p;
  }
  throw new Error(`막힘 없는 ${dist}칸 일직선이 없다`);
}

function newSim(): LobbySim {
  return new LobbySim({ x: VILLAGE_START.x, z: VILLAGE_START.z, random: () => 0.5 });
}

function tap(sim: LobbySim, point: FloorPoint) {
  sim.pointerDown(floorHit(point), 100, 100, now);
  now += 50;
  expect(sim.pointerUp(now)).toBe("walk");
}

/** 누른 곳까지 걸으며 프레임마다 (직전 속도, 그때 남은 직선 거리, 지금 속도)를 모은다. */
function walkAndLog(sim: LobbySim, goal: FloorPoint, seconds: number) {
  const log: { prev: number; d: number; speed: number }[] = [];
  let prev = 0;
  for (let i = 0; i < Math.round(seconds / 0.05); i += 1) {
    const s0 = sim.snapshot(now);
    const d = Math.hypot(goal.x - s0.x, goal.z - s0.z);
    now += 50;
    sim.update(0.05, now);
    const speed = sim.snapshot(now).speed;
    log.push({ prev, d, speed });
    prev = speed;
  }
  return log;
}

const peak = (log: { speed: number }[]) => Math.max(...log.map((l) => l.speed));

describe("[spec] 137 거리별 걷는 속도(바뀔 동작)", () => {
  it("[spec] 기본 걷기 속도는 2.4다", () => {
    expect(newSim().settings.speed).toBe(2.4);
  });

  it("[spec] d=3(4 미만): 걷기. 2.4를 넘지 않는다", () => {
    const sim = newSim();
    const goal = clearPointAt(VILLAGE_START, 3);
    tap(sim, goal);
    const log = walkAndLog(sim, goal, 4);
    expect(peak(log)).toBeLessThanOrEqual(2.4 + 1e-9);
    expect(peak(log)).toBeGreaterThan(2.0);
  });

  it("[spec] d=8(4~10): 3.6까지 오르고 넘지 않는다", () => {
    const sim = newSim();
    const goal = clearPointAt(VILLAGE_START, 8);
    tap(sim, goal);
    const log = walkAndLog(sim, goal, 6);
    expect(peak(log)).toBeGreaterThan(3.5);
    expect(peak(log)).toBeLessThanOrEqual(3.6 + 1e-9);
  });

  it("[spec] d=20(16 이상): 5.0까지 오르고 넘지 않는다", () => {
    const sim = newSim();
    const goal = clearPointAt(VILLAGE_START, 20);
    tap(sim, goal);
    const log = walkAndLog(sim, goal, 8);
    expect(peak(log)).toBeGreaterThan(4.9);
    expect(peak(log)).toBeLessThanOrEqual(5.0 + 1e-9);
  });

  it("[spec] d=13(10~16): 3.6보다 빠르고 5.0보다 느리게, 남은 거리에 따라 고르게 정한다", () => {
    const sim = newSim();
    const goal = clearPointAt(VILLAGE_START, 13);
    tap(sim, goal);
    const log = walkAndLog(sim, goal, 6);
    expect(peak(log)).toBeGreaterThan(3.6);
    expect(peak(log)).toBeLessThan(5.0);
  });

  it.each([3, 8, 13, 20])("[spec] d=%s: 속도는 직전 속도와 그때 남은 거리의 목표 속도(마지막 칸 감속 포함) 중 큰 값을 넘지 않는다", (dist) => {
    const sim = newSim();
    const goal = clearPointAt(VILLAGE_START, dist);
    tap(sim, goal);
    for (const { prev, d, speed } of walkAndLog(sim, goal, 10)) {
      expect(speed).toBeLessThanOrEqual(Math.max(prev, legSpeed(d)) + 1e-3);
    }
  });

  it("[spec] 멀리 누르면 줄여 멈춘다: 도착해 서고, 남은 거리가 줄면 3.6을 넘지 않는다", () => {
    const sim = newSim();
    const goal = clearPointAt(VILLAGE_START, 20);
    tap(sim, goal);
    const log = walkAndLog(sim, goal, 12);
    expect(log[log.length - 1].speed).toBeLessThan(0.1);
    const s = sim.snapshot(now);
    expect(Math.hypot(goal.x - s.x, goal.z - s.z)).toBeLessThan(0.3);
    for (const l of log) if (l.d < 3) expect(l.speed).toBeLessThanOrEqual(3.6 + 1e-6);
  });

  it("[spec] 개발 패널 값(settings.speed)은 걷기 모드만 바꾼다: 1.5로 낮추면 가까운 곳은 1.5, 먼 곳(d=8)은 그래도 3.6", () => {
    const near = newSim();
    near.settings.speed = 1.5;
    const nearGoal = clearPointAt(VILLAGE_START, 3);
    tap(near, nearGoal);
    expect(peak(walkAndLog(near, nearGoal, 4))).toBeLessThanOrEqual(1.5 + 1e-9);

    const far = newSim();
    far.settings.speed = 1.5;
    const farGoal = clearPointAt(VILLAGE_START, 8);
    tap(far, farGoal);
    const p = peak(walkAndLog(far, farGoal, 6));
    expect(p).toBeGreaterThan(3.5);
    expect(p).toBeLessThanOrEqual(3.6 + 1e-9);
  });
});

describe("[spec] 137 끌기도 캐릭터에서 손가락까지 거리로(바뀔 동작)", () => {
  /** 손가락을 캐릭터에서 늘 거리 dist만큼 앞에 두고 끈다. */
  function dragAt(dist: number, seconds: number) {
    const sim = newSim();
    const start = sim.snapshot(now);
    const finger = clearPointAt({ x: start.x, z: start.z }, dist);
    const dir = { x: (finger.x - start.x) / dist, z: (finger.z - start.z) / dist };
    sim.pointerDown(floorHit(finger), 100, 100, now);
    now += 50;
    sim.pointerMove(floorHit(finger), 100 + 40, 100);
    expect(sim.snapshot(now).dragging).toBe(true);
    const log: { speed: number }[] = [];
    for (let i = 0; i < Math.round(seconds / 0.05); i += 1) {
      const s0 = sim.snapshot(now);
      const p = { x: s0.x + dir.x * dist, z: s0.z + dir.z * dist };
      if (isFree(p.x, p.z)) sim.pointerMove(floorHit(p), 140, 100);
      now += 50;
      sim.update(0.05, now);
      log.push({ speed: sim.snapshot(now).speed });
    }
    return log;
  }

  it("[spec] 손가락이 3칸(4 미만): 2.4를 넘지 않는다", () => {
    const log = dragAt(3, 3);
    expect(peak(log)).toBeLessThanOrEqual(2.4 + 1e-9);
    expect(peak(log)).toBeGreaterThan(2.3);
  });

  it("[spec] 손가락이 7칸(4~10): 3.6까지 오르고 넘지 않는다", () => {
    const log = dragAt(7, 3);
    expect(peak(log)).toBeGreaterThan(3.5);
    expect(peak(log)).toBeLessThanOrEqual(3.6 + 1e-9);
  });

  it("[spec] 손가락이 13칸(10~16): 3.6 + 3/6 x 1.4 = 4.3까지 오르고 넘지 않는다", () => {
    const log = dragAt(13, 3);
    expect(peak(log)).toBeGreaterThan(4.2);
    expect(peak(log)).toBeLessThanOrEqual(4.3 + 1e-6);
  });

  it("[spec] 손가락이 20칸(16 이상): 5.0까지 오르고 넘지 않는다", () => {
    const log = dragAt(20, 3);
    expect(peak(log)).toBeGreaterThan(4.9);
    expect(peak(log)).toBeLessThanOrEqual(5.0 + 1e-9);
  });
});

describe("[spec] 137 방에서도 같은 규칙(그대로 둘 동작: 장소마다 다르게 하지 않는다)", () => {
  beforeEach(() => {
    applyArea("room");
  });

  it("[spec] 방에서 가까운 곳(3.3칸)을 누르면 걷기 2.4를 넘지 않는다", () => {
    const sim = new LobbySim({ random: () => 0.5 });
    const goal = { x: 4.2, z: 9.5 };
    tap(sim, goal);
    expect(peak(walkAndLog(sim, goal, 4))).toBeLessThanOrEqual(2.4 + 1e-9);
  });
});
