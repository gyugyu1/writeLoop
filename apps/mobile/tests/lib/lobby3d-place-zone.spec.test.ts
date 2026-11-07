// [spec] qa 테스트(작업 061, 기능 변경: 모바일 홈 로비 장소 구역 — 구역 안에서 멈추면 도착).
// 기대값은 명세(private 작업 폴더 061-2026-11-07-모바일-로비-장소-구역/01-main-spec.md)와 결정(03-main-decision.md: 일기 책상의 서는 곳을
// 의자 뒤 (1.5, 6.75) 하나로 옮겨 구역 중심도 거기가 됨, 걷거나 끌다가 멈춘 때만 도착을 보고 움직이지 않은 채로는 도착으로 바꾸지 않음,
// 끄는 손가락을 대고 있는 동안은 도착이 아님)에서만 가져온다.
// 그대로 둘 동작은 고치기 전 코드(2a2c359)의 동작을 기록한다. 구현 코드는 부르는 방법(LobbySim, MARKS, isFree)을 알려고만 읽었다.
// - 장소 구역(명세 1): 장소의 서는 자리들의 가운데를 중심으로 한 반지름 1칸 원. 중심은 아래 ZONE_CENTER에 명세·결정의 값으로 적었다
//   (고치기 전 코드의 일기 책상 서는 곳은 옛 자리라, 구현에서 읽지 않는다).
// - 구역 안 점은 중심에서 0.95칸 안, 구역 밖 점은 1.13칸(원이 아니라 2×2 네모였다면 안에 들 대각선 자리) 떨어진 곳을 고르고,
//   이 거리와 "설 수 있는 자리(isFree)"는 테스트 안에서 먼저 확인한다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): Z1~Z5.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K1~K7, 03 결정의 K8~K10(지금도 도착으로 바꾸지 않는다).
// 좌표(구현의 약속): 바닥 한 칸 = 1, x는 왼쪽→오른쪽(0..8), z는 뒷벽→앞(0..11). 바라보는 방향 0 = +z, atan2(dx, dz).
import { IDLE_LINE as ENGINE_IDLE_LINE, LobbySim, MARKS, isFree, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";

const STEP_S = 0.05;
const STEP_MS = 50;
const MARK_IDS: MarkId[] = ["board", "window", "desk", "door"];
/** 기본 말(지금 동작). */
const IDLE_LINE = "오늘은 뭘 해 볼까?\n가고 싶은 곳을 눌러 봐.";
const GREETING_LINE = "오늘도 해냈어!";
/** 지금 도착했을 때 바라보는 정도(작업 058 S23과 같은 허용치). */
const FACE_TOLERANCE = 0.15;

let now = 1_000_000;

beforeEach(() => {
  now = 1_000_000;
});

/**
 * 구역 중심 = 서는 자리들의 가운데(명세 1). 게시판 (1.6, 1.3)·(2.2, 1.3), 창가 (4.5, 1.55)·(5.1, 1.55), 밖으로 (4.0, 10.5)는 지금 서는 자리 그대로,
 * 일기 책상은 03 결정의 서는 곳 (1.5, 6.75) 하나.
 */
const ZONE_CENTER: Record<MarkId, FloorPoint> = {
  board: { x: 1.9, z: 1.3 },
  window: { x: 4.8, z: 1.55 },
  desk: { x: 1.5, z: 6.75 },
  door: { x: 4.0, z: 10.5 }
};

function zoneCenter(id: MarkId): FloorPoint {
  return ZONE_CENTER[id];
}

function distance(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleDiff(a: number, b: number) {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
}

function floorHit(point: FloorPoint | null): PointerHit {
  return { point, mark: null, onCharacter: false };
}

function markHit(mark: MarkId): PointerHit {
  return { point: null, mark, onCharacter: false };
}

/** 톡: 같은 자리에서 누르고 0.1초 뒤 뗀다. */
function tap(sim: LobbySim, hit: PointerHit) {
  sim.pointerDown(hit, 100, 100, now);
  const result = sim.pointerUp(now + 100);
  now += 100;
  return result;
}

/** seconds초 동안 0.05초씩 진행한다. 매 프레임 onFrame을 부른다. */
function run(sim: LobbySim, seconds: number, onFrame?: () => void) {
  const count = Math.round(seconds / STEP_S);
  for (let i = 0; i < count; i += 1) {
    now += STEP_MS;
    sim.update(STEP_S, now);
    onFrame?.();
  }
}

function runUntil(sim: LobbySim, maxSeconds: number, done: () => boolean, onFrame?: () => void) {
  const start = now;
  while (!done() && now - start < maxSeconds * 1000) run(sim, STEP_S, onFrame);
  return done();
}

function isStoppedAt(sim: LobbySim, p: FloorPoint) {
  return Math.abs(sim.x - p.x) < 1e-6 && Math.abs(sim.z - p.z) < 1e-6 && sim.vx === 0 && sim.vz === 0;
}

/** 바닥 점을 톡 하고 그 점에 멈출 때까지 걷는다. */
function walkToFloor(sim: LobbySim, p: FloorPoint) {
  expect(tap(sim, floorHit(p))).toBe("walk");
  expect(runUntil(sim, 15, () => isStoppedAt(sim, p))).toBe(true);
}

/** 장소를 톡 하고 도착할 때까지 걷는다. */
function walkToMark(sim: LobbySim, id: MarkId) {
  expect(tap(sim, markHit(id))).toBe("walk");
  expect(runUntil(sim, 15, () => sim.arrived === id)).toBe(true);
}

function isSitting(sim: LobbySim) {
  const kind = sim.posture?.kind;
  return kind === "sitting-down" || kind === "sitting";
}

/** 장소마다 구역 안 점. 걸어오는 방향과 장소를 바라보는 방향이 30°보다 크게 다르게 출발점을 골랐다(돌아서는지 보려고). */
const INSIDE: Record<MarkId, { start: FloorPoint; point: FloorPoint }> = {
  board: { start: { x: 3.5, z: 1.6 }, point: { x: 1.2, z: 1.6 } },
  window: { start: { x: 7.0, z: 1.8 }, point: { x: 5.5, z: 1.9 } },
  desk: { start: { x: 4.2, z: 6.2 }, point: { x: 2.2, z: 7.2 } },
  door: { start: { x: 6.5, z: 10.2 }, point: { x: 4.7, z: 10.2 } }
};

/** 장소마다 구역 밖(중심에서 대각선으로 1.13칸) 점. */
const OUTSIDE_DIAGONAL: Record<MarkId, { start: FloorPoint; point: FloorPoint }> = {
  board: { start: { x: 4.2, z: 6.2 }, point: { x: 2.7, z: 2.1 } },
  window: { start: { x: 4.2, z: 6.2 }, point: { x: 5.6, z: 2.35 } },
  desk: { start: { x: 5.5, z: 8.0 }, point: { x: 2.3, z: 7.55 } },
  door: { start: { x: 4.2, z: 6.2 }, point: { x: 4.8, z: 9.7 } }
};

/** 다른 장소 구역에도 들지 않는지. */
function inNoZone(p: FloorPoint) {
  return MARK_IDS.every((id) => distance(p, zoneCenter(id)) > 1);
}

describe("[spec] 작업 061 바뀔 동작: 장소 구역 안에서 멈추면 그 장소에 도착(명세 1·2)", () => {
  it.each(MARK_IDS)("Z1: 바닥을 눌러 장소(%s) 구역 안 점에 멈추면 그 장소에 도착하고, 지금 도착했을 때와 같은 말풍선 안내와 버튼이 나온다", (id) => {
    const { start, point } = INSIDE[id];
    expect(distance(point, zoneCenter(id))).toBeLessThan(0.95);
    expect(isFree(point.x, point.z)).toBe(true);
    expect(inNoZone(start)).toBe(true);
    const sim = new LobbySim(start);

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({
      arrived: snap.arrived,
      bubbleText: snap.bubbleText,
      bubbleButton: snap.bubbleButton,
      idleBubble: snap.idleBubble,
      enterMessage: sim.enterMessage()
    }).toEqual({
      arrived: id,
      bubbleText: MARKS[id].prompt,
      bubbleButton: MARKS[id].buttonLabel,
      idleBubble: false,
      enterMessage: MARKS[id].enterMessage
    });
  });

  it.each(MARK_IDS)("Z2: 장소(%s) 구역 안에 멈추면 그 장소(바라볼 지점) 쪽으로 돌아선다", (id) => {
    const { start, point } = INSIDE[id];
    const faceTo = MARKS[id].faceTo;
    const want = Math.atan2(faceTo.x - point.x, faceTo.z - point.z);
    const walking = Math.atan2(point.x - start.x, point.z - start.z);
    // 걸어온 방향 그대로 서 있어도 통과하지 않게, 걸어온 방향과 바라볼 방향이 충분히 다른지 먼저 본다
    expect(angleDiff(walking, want)).toBeGreaterThan(0.5);
    const sim = new LobbySim(start);

    walkToFloor(sim, point);
    run(sim, 3);

    expect(sim.arrived).toBe(id);
    expect(angleDiff(sim.heading, want)).toBeLessThanOrEqual(FACE_TOLERANCE);
  });

  it("Z3: 의자 뒤쪽에서 일기 책상 쪽으로 끌어 책상(의자) 앞에 막힌 채 손을 떼고 멈추면 일기 책상에 도착한다(끌기로 와도 같다)", () => {
    const sim = new LobbySim({ x: 1.5, z: 9.0 });
    expect(inNoZone({ x: sim.x, z: sim.z })).toBe(true);
    const finger = { x: 1.5, z: 5.5 }; // 일기 책상 칸
    sim.pointerDown(floorHit(finger), 100, 100, now);
    sim.pointerMove(floorHit(finger), 100, 113);
    expect(sim.dragging).toBe(true);
    run(sim, 2);
    expect(sim.pointerUp(now)).toBe("drag-end");
    expect(runUntil(sim, 3, () => sim.vx === 0 && sim.vz === 0)).toBe(true);
    run(sim, 0.5);

    expect(distance({ x: sim.x, z: sim.z }, zoneCenter("desk"))).toBeLessThan(1);
    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      arrived: "desk",
      bubbleText: MARKS.desk.prompt,
      bubbleButton: MARKS.desk.buttonLabel
    });
  });

  it("Z4: 구역은 칸이 아니라 원이다. 일기 책상 구역 중 막힌 칸 (2,5) 바로 아래 칸 (2,6)에 걸친 자리(중심에서 0.84칸)에 멈춰도 일기 책상에 도착한다", () => {
    const point = { x: 2.3, z: 6.5 };
    expect(distance(point, zoneCenter("desk"))).toBeLessThan(0.95);
    expect(isFree(point.x, point.z)).toBe(true);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText }).toEqual({ arrived: "desk", bubbleText: MARKS.desk.prompt });
  });

  it("Z5: 구역 안에 서서 로비 인사를 받은 뒤 같은 구역 안 다른 점을 누르면 인사 말은 거두고, 멈추면 장소 안내가 나온다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    walkToFloor(sim, INSIDE.desk.point);
    run(sim, 0.5);
    sim.greet(GREETING_LINE, "wave", now);
    run(sim, 3);
    expect(sim.snapshot(now).bubbleText).toBe(GREETING_LINE);

    const other = { x: 1.0, z: 7.3 };
    expect(distance(other, zoneCenter("desk"))).toBeLessThan(0.95);
    walkToFloor(sim, other);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      arrived: "desk",
      bubbleText: MARKS.desk.prompt,
      bubbleButton: MARKS.desk.buttonLabel
    });
  });
});

describe("[spec] 작업 061 그대로 둘 동작", () => {
  it.each(MARK_IDS)("K1: 장소(%s) 구역 밖(중심에서 대각선 1.13칸)에 멈추면 도착이 아니고 기본 말이다", (id) => {
    const { start, point } = OUTSIDE_DIAGONAL[id];
    const d = distance(point, zoneCenter(id));
    expect(d).toBeGreaterThan(1.1);
    expect(d).toBeLessThan(1.2);
    expect(inNoZone(point)).toBe(true);
    expect(isFree(point.x, point.z)).toBe(true);
    const sim = new LobbySim(start);

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, idleBubble: snap.idleBubble }).toEqual({
      arrived: null,
      bubbleText: IDLE_LINE,
      bubbleButton: null,
      idleBubble: true
    });
    expect(ENGINE_IDLE_LINE).toBe(IDLE_LINE);
  });

  const PASS_THROUGH: [MarkId, FloorPoint, FloorPoint][] = [
    ["window", { x: 3.3, z: 1.2 }, { x: 6.4, z: 1.2 }],
    ["desk", { x: 0.6, z: 7.6 }, { x: 3.0, z: 6.5 }],
    ["door", { x: 2.5, z: 10.4 }, { x: 5.5, z: 10.4 }]
  ];

  it.each(PASS_THROUGH)("K2(명세 2): 바닥을 눌러 장소(%s) 구역을 걸어서 지나가기만 하면 어느 프레임에도 도착이 아니고, 구역 밖에 멈추면 기본 말이다", (id, start, goal) => {
    expect(inNoZone(start)).toBe(true);
    expect(inNoZone(goal)).toBe(true);
    const sim = new LobbySim(start);
    let closest = Infinity;
    const arrivedSeen = new Set<string>();

    expect(tap(sim, floorHit(goal))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => isStoppedAt(sim, goal),
        () => {
          closest = Math.min(closest, distance({ x: sim.x, z: sim.z }, zoneCenter(id)));
          const seen = sim.snapshot(now).arrived;
          if (seen) arrivedSeen.add(seen);
        }
      )
    ).toBe(true);
    run(sim, 0.5, () => {
      const seen = sim.snapshot(now).arrived;
      if (seen) arrivedSeen.add(seen);
    });

    // 정말 구역 안을 지나갔는지 먼저 본다
    expect(closest).toBeLessThan(0.5);
    expect([...arrivedSeen]).toEqual([]);
    expect(sim.snapshot(now).bubbleText).toBe(IDLE_LINE);
  });

  it("K3(명세 2, 그대로: 가구를 누르면 그 장소에 도착): 의자 뒤쪽(왼쪽 앞)에서 게시판을 누르면 일기 책상 구역을 지나가도 일기 책상에 도착하지 않고 게시판에 도착한다", () => {
    const sim = new LobbySim({ x: 0.8, z: 8.2 });
    expect(inNoZone({ x: sim.x, z: sim.z })).toBe(true);
    let closestDesk = Infinity;
    const arrivedSeen = new Set<string>();

    expect(tap(sim, markHit("board"))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => sim.arrived === "board",
        () => {
          closestDesk = Math.min(closestDesk, distance({ x: sim.x, z: sim.z }, zoneCenter("desk")));
          const seen = sim.snapshot(now).arrived;
          if (seen) arrivedSeen.add(seen);
        }
      )
    ).toBe(true);

    expect(closestDesk).toBeLessThan(1);
    expect([...arrivedSeen]).toEqual(["board"]);
    const nearest = Math.min(...MARKS.board.approach.map((a) => distance(a, { x: sim.x, z: sim.z })));
    expect(nearest).toBeLessThan(0.06);
  });

  it("K4(걷기 규칙 그대로): 구역 안 바닥 점을 누르면 서는 자리로 옮겨 가지 않고 누른 점에 멈춘다", () => {
    const point = INSIDE.desk.point;
    const sim = new LobbySim(INSIDE.desk.start);

    walkToFloor(sim, point);
    run(sim, 1);

    expect({ x: sim.x, z: sim.z }).toEqual(point);
  });

  it("K5(가구를 누르면 서는 자리로 걸어가 도착): 구역 안 바닥 점에 서 있다가 그 장소를 누르면 서는 자리로 걸어가 도착하고 그 장소를 바라본다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const inZone = { x: 0.9, z: 7.3 };
    expect(distance(inZone, zoneCenter("desk"))).toBeLessThan(0.95);
    walkToFloor(sim, inZone);
    run(sim, 0.5);

    walkToMark(sim, "desk");
    run(sim, 3);

    const nearest = Math.min(...MARKS.desk.approach.map((a) => distance(a, { x: sim.x, z: sim.z })));
    expect(nearest).toBeLessThan(0.06);
    const faceTo = MARKS.desk.faceTo;
    expect(angleDiff(sim.heading, Math.atan2(faceTo.x - sim.x, faceTo.z - sim.z))).toBeLessThanOrEqual(FACE_TOLERANCE);
    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      arrived: "desk",
      bubbleText: MARKS.desk.prompt,
      bubbleButton: MARKS.desk.buttonLabel
    });
  });

  const GREET_WAYS: [string, (sim: LobbySim) => void][] = [
    ["바닥을 눌러 구역 안에 멈춘 뒤", (sim) => walkToFloor(sim, INSIDE.desk.point)],
    ["일기 책상을 눌러 서는 자리에 도착한 뒤", (sim) => walkToMark(sim, "desk")]
  ];

  it.each(GREET_WAYS)("K6(로비 인사 ③): %s 로비 인사를 하면 장소 안내를 거두고 인사 말을 보이며, 누르지 않으면 25초가 지나도(앉은 뒤에도) 인사 말이다", (_name, arrange) => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    arrange(sim);
    run(sim, 0.5);
    // 바닥으로 온 자리(INSIDE.desk)는 Z1에서 구역 안임을 확인한다. 서는 자리는 03 결정 뒤 구역 중심이다(고치기 전 코드는 옛 자리).

    sim.greet(GREETING_LINE, "wave", now);
    const first = sim.snapshot(now);
    expect({ arrived: first.arrived, bubbleText: first.bubbleText, bubbleButton: first.bubbleButton, idleBubble: first.idleBubble }).toEqual({
      arrived: null,
      bubbleText: GREETING_LINE,
      bubbleButton: null,
      idleBubble: true
    });

    const seen = new Set<string>();
    run(sim, 25, () => seen.add(sim.snapshot(now).bubbleText));

    expect([...seen]).toEqual([GREETING_LINE]);
    const last = sim.snapshot(now);
    expect({ arrived: last.arrived, bubbleButton: last.bubbleButton }).toEqual({ arrived: null, bubbleButton: null });
    expect(isSitting(sim)).toBe(true);
  });

  it("K7(오래 두면 앉기 ③): 바닥을 눌러 구역 안에 멈춘 뒤 아무것도 하지 않으면 19초에는 서 있고 21초에는 앉아 있다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    walkToFloor(sim, INSIDE.desk.point);
    // 멈춘 뒤 돌아서는 동안도 아무것도 하지 않은 시간이다(지금 장소에 도착했을 때와 같다)
    run(sim, 19);
    expect(isSitting(sim)).toBe(false);
    run(sim, 2);
    expect(isSitting(sim)).toBe(true);
  });
});

describe("[spec] 작업 061 03 결정: 걷거나 끌다가 멈춘 때만 도착을 본다(지금도 도착으로 바꾸지 않는다)", () => {
  it("K8: 끄는 손가락을 대고 있는 동안에는 라이트루프가 일기 책상 구역 안에 막혀 서 있어도 도착이 아니다", () => {
    const sim = new LobbySim({ x: 1.5, z: 9.0 });
    const finger = { x: 1.5, z: 5.5 }; // 일기 책상 칸
    const arrivedSeen = new Set<string>();
    sim.pointerDown(floorHit(finger), 100, 100, now);
    sim.pointerMove(floorHit(finger), 100, 113);
    expect(sim.dragging).toBe(true);

    run(sim, 3, () => {
      const seen = sim.snapshot(now).arrived;
      if (seen) arrivedSeen.add(seen);
    });

    // 정말 구역 안에 막혀 서 있는지 먼저 본다
    expect(distance({ x: sim.x, z: sim.z }, zoneCenter("desk"))).toBeLessThan(1);
    expect(Math.hypot(sim.vx, sim.vz)).toBeLessThan(0.3);
    expect(sim.dragging).toBe(true);
    expect([...arrivedSeen]).toEqual([]);
    expect(sim.arrived).toBeNull();
  });

  it("K9: 구역 안에서 인사를 받은 뒤 라이트루프를 눌러(움직이지 않음) 짧은 말이 끝나면 장소 안내가 아니라 기본 말이다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    walkToFloor(sim, INSIDE.desk.point);
    run(sim, 0.5);
    sim.greet(GREETING_LINE, "wave", now);
    run(sim, 3);

    expect(tap(sim, { point: null, mark: null, onCharacter: true })).toBe("poke");
    expect(sim.snapshot(now).bubbleText).toBe("헤헤, 간지러워!");
    run(sim, 3);

    expect({ x: sim.x, z: sim.z }).toEqual(INSIDE.desk.point);
    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      arrived: null,
      bubbleText: IDLE_LINE,
      bubbleButton: null
    });
  });

  it("K10: 처음부터 일기 책상 구역 안에 서 있고 움직이지 않으면 5초가 지나도 도착이 아니고 기본 말이다", () => {
    const sim = new LobbySim(INSIDE.desk.point);
    run(sim, 5);

    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      arrived: null,
      bubbleText: IDLE_LINE,
      bubbleButton: null
    });
  });
});
