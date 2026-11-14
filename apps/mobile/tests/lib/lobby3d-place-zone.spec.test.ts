// [spec] qa 테스트(작업 061, 기능 변경: 모바일 홈 로비 장소 구역 — 구역 안에서 멈추면 도착).
// 기대값은 명세(private 작업 폴더 061-2026-11-07-모바일-로비-장소-구역/01-main-spec.md)와 결정(03-main-decision.md: 일기 책상의 서는 곳을
// 의자 뒤 (1.5, 6.75) 하나로 옮겨 구역 중심도 거기가 됨. 그 결정의 멈춤 판정은 아래 10 결정이 바꿨다)와 10-main-decision.md에서만 가져온다.
// 그대로 둘 동작은 고치기 전 코드(2a2c359)의 동작을 기록한다. 구현 코드는 부르는 방법(LobbySim, MARKS, isFree)을 알려고만 읽었다.
// - 장소 구역(명세 1): 장소의 서는 자리들의 가운데를 중심으로 한 반지름 1칸 원. 중심은 아래 ZONE_CENTER에 명세·결정의 값으로 적었다
//   (고치기 전 코드의 일기 책상 서는 곳은 옛 자리라, 구현에서 읽지 않는다).
// - 구역 안 점은 중심에서 0.95칸 안, 구역 밖 점은 1.13칸(원이 아니라 2×2 네모였다면 안에 들 대각선 자리) 떨어진 곳을 고르고,
//   이 거리와 "설 수 있는 자리(isFree)"는 테스트 안에서 먼저 확인한다.
// - 바뀔 동작(061 첫 구현 전에 실패해야 했다): Z1~Z5. 10·12 결정으로 바뀔 동작(df42aae에서 실패해야 한다): Z6~Z12, K1(12 결정: 구역 밖에 멈추면 말풍선 없음).
// - 그대로 둘 동작(통과해야 한다): K4~K7.
// 061-10 결정(사용자, 2026-11-07: 구역 표시를 빼고, 라이트루프가 구역 안에 있기만 해도 걷거나 끌려 가는 중에도 그 장소 안내·버튼을 보이며
// 걸음은 멈추지 않는다. 구역을 벗어나면 걷는 중엔 말풍선이 숨고 멈췄으면 기본 말. 구역 안에서 멈추면 그 장소를 바라본다. 장소를 눌러 가는 길에
// 다른 장소 구역을 지나면 지나는 동안 그 장소 안내. 짧은 말은 안내보다 먼저, 로비 인사는 구역 안에 서 있어도 인사 말)로 고쳤다.
// - 옛 K2(지나가기만 하면 도착 아님) → Z6, 옛 K3(게시판으로 가는 길에 일기 책상 구역을 지나도 일기 책상 아님) → Z7,
//   옛 K8(끄는 동안 도착 아님) → Z8, 옛 K9(짧은 말 뒤 기본 말) → Z9, 옛 K10(처음부터 구역 안이면 기본 말) → Z10. 새로 더함: Z11.
// - 걷는 중의 장소 안내는 말풍선(bubbleText·bubbleButton)과 버튼을 눌렀을 때의 안내(enterMessage)로 본다. 걷는 중의 arrived 값은 결정에 없어 보지 않는다.
// - 구역 경계(1칸) 근처는 판정이 갈리므로 보지 않는다. 구역 안은 중심에서 0.95칸 안, 구역 밖은 모든 구역 중심에서 1.05칸 밖일 때만 본다.
// 061-12 결정(사용자, 2026-11-07: 기본 말 "오늘은 뭘 해 볼까?…"를 없앰. 짧은 말·인사·장소 안내가 없으면 말풍선이 없고, 인사를 거두면 다음에 홈에
// 들어올 때까지 말풍선이 없다)으로 기본 말을 기대하던 K1·Z6·Z11의 끝을 "말풍선 없음"(빈 글, 버튼 없음)으로 고치고 Z12를 더했다.
// 061-13 결정(사용자, 2026-11-07: 벽에 붙은 장소(게시판, 창가)의 구역은 서는 자리 가운데에서 그 장소를 바라보는 벽 위의 점까지 잇는 선에서 1칸 안.
// 일기 책상과 밖으로는 반지름 1칸 원 그대로. 끄는 중에도 장소 안내가 바로 바뀌고 다른 장소의 글은 보이지 않는다)으로 구역 판정 도우미를 이 모양으로 바꾸고
// W1·W2와 Z13을 더했다. 벽 위의 점은 지금 장소의 바라볼 지점(게시판 (1.8, 0), 창가 (4.8, 0). 060-⑤ G3이 기록한 값)이다.
// 좌표(구현의 약속): 바닥 한 칸 = 1, x는 왼쪽→오른쪽(0..8), z는 뒷벽→앞(0..11). 바라보는 방향 0 = +z, atan2(dx, dz).
import { LobbySim, MARKS, isFree, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";

/** 기존 네 장소. 작업 062(책장 장소를 더함) 04 결정 2로, 장소마다 값을 적어 둔 테스트 데이터의 타입만 이 넷으로 좁혔다(값과 단언은 그대로). */
type PlaceId = "board" | "window" | "desk" | "door";

const STEP_S = 0.05;
const STEP_MS = 50;
const MARK_IDS: PlaceId[] = ["board", "window", "desk", "door"];
/** 말풍선 없음(061-12 결정: 기본 말을 없애고, 짧은 말·인사·장소 안내가 없으면 말풍선이 없다). 걷는 중 숨긴 말풍선과 같은 모양으로 본다. */
const NO_BUBBLE = { bubbleText: "", bubbleButton: null };
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
const ZONE_CENTER: Record<PlaceId, FloorPoint> = {
  board: { x: 1.9, z: 1.3 },
  window: { x: 4.8, z: 1.55 },
  desk: { x: 1.5, z: 6.75 },
  door: { x: 4.0, z: 10.5 }
};

function zoneCenter(id: PlaceId): FloorPoint {
  return ZONE_CENTER[id];
}

function distance(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 13 결정: 벽에 붙은 장소의 구역은 서는 자리 가운데에서 벽 위의 이 점(그 장소를 바라보는 점)까지 잇는 선에서 1칸 안. */
const WALL_POINT: Partial<Record<MarkId, FloorPoint>> = {
  board: { x: 1.8, z: 0 },
  window: { x: 4.8, z: 0 }
};

function distanceToSegment(p: FloorPoint, a: FloorPoint, b: FloorPoint) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return distance(p, { x: a.x + dx * t, z: a.z + dz * t });
}

/** 장소 구역까지의 거리(1 이하면 구역 안). 게시판·창가는 가운데에서 벽 위의 점까지 잇는 선, 일기 책상·밖으로는 가운데까지(13 결정). */
function zoneDistance(id: PlaceId, p: FloorPoint) {
  const wall = WALL_POINT[id];
  return wall ? distanceToSegment(p, zoneCenter(id), wall) : distance(p, zoneCenter(id));
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

/**
 * 장소를 톡 하고 도착할 때까지 걷는다. 061-10 결정으로 구역 안에서는 걷는 중에도 안내가 나오므로,
 * 도착은 그 장소에 도착했다고 나오고 걸음이 멈춘 때로 본다(확인 내용은 그대로, 찾는 도우미만 고침).
 */
function walkToMark(sim: LobbySim, id: MarkId) {
  expect(tap(sim, markHit(id))).toBe("walk");
  expect(runUntil(sim, 15, () => sim.arrived === id && sim.vx === 0 && sim.vz === 0)).toBe(true);
}

/** 그 자리가 확실히 들어 있는 장소 구역(중심에서 0.95칸 안). 모든 구역에서 1.05칸 밖이면 null, 경계 근처면 "edge"(보지 않음). */
function zoneClearlyAt(p: FloorPoint): PlaceId | null | "edge" {
  for (const id of MARK_IDS) if (zoneDistance(id, p) < 0.95) return id;
  return MARK_IDS.every((id) => zoneDistance(id, p) > 1.05) ? null : "edge";
}

/**
 * 걷거나 끌려 가는 중(moving) 프레임마다 061-10 결정대로인지 본다.
 * 구역 안이면 그 장소 안내와 버튼(누르면 그 장소 안내), 구역 밖이면 말풍선이 숨는다(빈 글, 버튼 없음).
 * 어긋난 프레임을 글로 모으고, 장소별로 구역 안에서 움직인 프레임 수와 구역 안에서 멈춰 있던 프레임 수를 센다.
 */
function frameChecker(sim: LobbySim) {
  const problems: string[] = [];
  const movingInZone: Partial<Record<MarkId, number>> = {};
  const stillInZone: Partial<Record<MarkId, number>> = {};
  const check = () => {
    const snap = sim.snapshot(now);
    const zone = zoneClearlyAt({ x: sim.x, z: sim.z });
    if (zone === "edge") return;
    const where = `(${sim.x.toFixed(2)}, ${sim.z.toFixed(2)})`;
    if (!snap.moving) {
      if (zone) stillInZone[zone] = (stillInZone[zone] ?? 0) + 1;
      return;
    }
    if (zone) {
      movingInZone[zone] = (movingInZone[zone] ?? 0) + 1;
      const got = { bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() };
      const want = { bubbleText: MARKS[zone].prompt, bubbleButton: MARKS[zone].buttonLabel, enterMessage: MARKS[zone].enterMessage };
      if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${where} ${zone} 구역 안 이동 중: ${JSON.stringify(got)}`);
    } else if (snap.bubbleText !== "" || snap.bubbleButton !== null) {
      problems.push(`${where} 구역 밖 이동 중: ${JSON.stringify({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton })}`);
    }
  };
  return { check, problems, movingInZone, stillInZone };
}

function isSitting(sim: LobbySim) {
  const kind = sim.posture?.kind;
  return kind === "sitting-down" || kind === "sitting";
}

/** 장소마다 구역 안 점. 걸어오는 방향과 장소를 바라보는 방향이 30°보다 크게 다르게 출발점을 골랐다(돌아서는지 보려고). */
const INSIDE: Record<PlaceId, { start: FloorPoint; point: FloorPoint }> = {
  board: { start: { x: 3.5, z: 1.6 }, point: { x: 1.2, z: 1.6 } },
  window: { start: { x: 7.0, z: 1.8 }, point: { x: 5.5, z: 1.9 } },
  desk: { start: { x: 4.2, z: 6.2 }, point: { x: 2.2, z: 7.2 } },
  door: { start: { x: 6.5, z: 10.2 }, point: { x: 4.7, z: 10.2 } }
};

/** 장소마다 구역 밖(중심에서 대각선으로 1.13칸) 점. */
const OUTSIDE_DIAGONAL: Record<PlaceId, { start: FloorPoint; point: FloorPoint }> = {
  board: { start: { x: 4.2, z: 6.2 }, point: { x: 2.7, z: 2.1 } },
  window: { start: { x: 4.2, z: 6.2 }, point: { x: 5.6, z: 2.35 } },
  desk: { start: { x: 5.5, z: 8.0 }, point: { x: 2.3, z: 7.55 } },
  door: { start: { x: 4.2, z: 6.2 }, point: { x: 4.8, z: 9.7 } }
};

/** 다른 장소 구역에도 들지 않는지. */
function inNoZone(p: FloorPoint) {
  return MARK_IDS.every((id) => zoneDistance(id, p) > 1);
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
  it.each(MARK_IDS)("K1(061-12 결정): 장소(%s) 구역 밖(중심에서 대각선 1.13칸)에 멈추면 도착이 아니고 말풍선이 없다", (id) => {
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
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({ arrived: null, ...NO_BUBBLE });
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

describe("[spec] 작업 061 10 결정(바뀔 동작): 구역 안에 있기만 해도 걷거나 끌려 가는 중에도 그 장소 안내, 벗어나면 사라짐", () => {
  // 옛 K2의 길(창가, 일기 책상, 밖으로)에 게시판 길을 더했다. 시작과 끝은 어느 구역에도 들지 않고, 길이 구역 한가운데(0.5칸 안)를 지난다.
  const PASS_THROUGH: [PlaceId, FloorPoint, FloorPoint][] = [
    ["board", { x: 0.6, z: 1.2 }, { x: 3.3, z: 1.2 }],
    ["window", { x: 3.3, z: 1.2 }, { x: 6.4, z: 1.2 }],
    ["desk", { x: 0.6, z: 7.6 }, { x: 3.0, z: 6.5 }],
    ["door", { x: 2.5, z: 10.4 }, { x: 5.5, z: 10.4 }]
  ];

  it.each(PASS_THROUGH)(
    "Z6(옛 K2): 바닥을 눌러 장소(%s) 구역을 지나가면, 구역 안에 있는 동안 걸음은 멈추지 않고 그 장소 안내와 버튼이 보이며, 벗어나면 말풍선이 숨고, 구역 밖에 멈추면 말풍선이 없다(12 결정)",
    (id, start, goal) => {
      expect(inNoZone(start)).toBe(true);
      expect(inNoZone(goal)).toBe(true);
      expect(isFree(start.x, start.z)).toBe(true);
      expect(isFree(goal.x, goal.z)).toBe(true);
      const sim = new LobbySim(start);
      const frame = frameChecker(sim);
      let closest = Infinity;

      expect(tap(sim, floorHit(goal))).toBe("walk");
      expect(
        runUntil(
          sim,
          15,
          () => isStoppedAt(sim, goal),
          () => {
            closest = Math.min(closest, distance({ x: sim.x, z: sim.z }, zoneCenter(id)));
            if (!isStoppedAt(sim, goal)) frame.check();
          }
        )
      ).toBe(true);
      run(sim, 0.5);

      // 정말 구역 한가운데를 지나갔는지 먼저 본다
      expect(closest).toBeLessThan(0.5);
      expect(frame.movingInZone[id] ?? 0).toBeGreaterThan(0);
      // 구역 안에서 걸음을 멈추지 않는다(멈춰 선 프레임이 없다)
      expect(frame.stillInZone).toEqual({});
      expect(frame.problems).toEqual([]);
      const snap = sim.snapshot(now);
      expect({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual(NO_BUBBLE);
    }
  );

  it("Z7(옛 K3): 의자 뒤쪽(왼쪽 앞)에서 게시판을 누르면, 가는 길에 일기 책상 구역을 지나는 동안 일기 책상 안내가 잠깐 보이고, 게시판 서는 자리에 도착해 게시판 안내가 나온다", () => {
    const sim = new LobbySim({ x: 0.8, z: 8.2 });
    expect(inNoZone({ x: sim.x, z: sim.z })).toBe(true);
    const frame = frameChecker(sim);
    let closestDesk = Infinity;

    expect(tap(sim, markHit("board"))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => sim.arrived === "board" && sim.vx === 0 && sim.vz === 0,
        () => {
          closestDesk = Math.min(closestDesk, distance({ x: sim.x, z: sim.z }, zoneCenter("desk")));
          if (!(sim.vx === 0 && sim.vz === 0)) frame.check();
        }
      )
    ).toBe(true);
    run(sim, 0.5);

    expect(closestDesk).toBeLessThan(0.95);
    expect(frame.movingInZone.desk ?? 0).toBeGreaterThan(0);
    expect(frame.stillInZone).toEqual({});
    expect(frame.problems).toEqual([]);
    const nearest = Math.min(...MARKS.board.approach.map((a) => distance(a, { x: sim.x, z: sim.z })));
    expect(nearest).toBeLessThan(0.06);
    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      arrived: "board",
      bubbleText: MARKS.board.prompt,
      bubbleButton: MARKS.board.buttonLabel
    });
  });

  it("Z8(옛 K8): 의자 뒤쪽에서 일기 책상 쪽으로 끄는 동안, 구역 밖에서는 말풍선이 숨고, 구역 안에 들어오면 손가락을 대고 있어도(막혀 서 있어도) 일기 책상 안내와 버튼이 보인다", () => {
    const sim = new LobbySim({ x: 1.5, z: 9.0 });
    expect(inNoZone({ x: sim.x, z: sim.z })).toBe(true);
    const frame = frameChecker(sim);
    const finger = { x: 1.5, z: 5.5 }; // 일기 책상 칸
    sim.pointerDown(floorHit(finger), 100, 100, now);
    sim.pointerMove(floorHit(finger), 100, 113);
    expect(sim.dragging).toBe(true);

    run(sim, 3, frame.check);

    // 정말 손가락을 댄 채 구역 안에 막혀 서 있는지 먼저 본다
    expect(distance({ x: sim.x, z: sim.z }, zoneCenter("desk"))).toBeLessThan(0.95);
    expect(Math.hypot(sim.vx, sim.vz)).toBeLessThan(0.3);
    expect(sim.dragging).toBe(true);
    expect(frame.movingInZone.desk ?? 0).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
    const snap = sim.snapshot(now);
    expect({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      bubbleText: MARKS.desk.prompt,
      bubbleButton: MARKS.desk.buttonLabel,
      enterMessage: MARKS.desk.enterMessage
    });
  });

  it("Z9(옛 K9): 구역 안에서 인사를 받은 뒤 라이트루프를 누르면(움직이지 않음) 짧은 말이 안내보다 먼저 나오고, 짧은 말이 끝나면 일기 책상 안내와 버튼이다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    walkToFloor(sim, INSIDE.desk.point);
    run(sim, 0.5);
    sim.greet(GREETING_LINE, "wave", now);
    run(sim, 3);
    expect(sim.snapshot(now).bubbleText).toBe(GREETING_LINE);

    expect(tap(sim, { point: null, mark: null, onCharacter: true })).toBe("poke");
    expect(sim.snapshot(now).bubbleText).toBe("헤헤, 간지러워!");
    run(sim, 3);

    expect({ x: sim.x, z: sim.z }).toEqual(INSIDE.desk.point);
    const snap = sim.snapshot(now);
    expect({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      bubbleText: MARKS.desk.prompt,
      bubbleButton: MARKS.desk.buttonLabel,
      enterMessage: MARKS.desk.enterMessage
    });
  });

  it("Z10(옛 K10): 처음부터 일기 책상 구역 안에 서 있으면 움직이지 않아도 5초 뒤 일기 책상 안내와 버튼이다", () => {
    const sim = new LobbySim(INSIDE.desk.point);
    run(sim, 5);

    const snap = sim.snapshot(now);
    expect({
      bubbleText: snap.bubbleText,
      bubbleButton: snap.bubbleButton,
      idleBubble: snap.idleBubble,
      enterMessage: sim.enterMessage()
    }).toEqual({
      bubbleText: MARKS.desk.prompt,
      bubbleButton: MARKS.desk.buttonLabel,
      idleBubble: false,
      enterMessage: MARKS.desk.enterMessage
    });
  });

  it("Z11: 일기 책상 구역 안에 멈춰 안내가 나온 뒤 구역 밖 바닥을 누르면, 구역 안에서 걷는 동안은 안내가 남고, 벗어나면 말풍선이 숨고, 밖에 멈추면 말풍선이 없다(12 결정)", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    walkToFloor(sim, INSIDE.desk.point);
    run(sim, 0.5);
    expect(sim.snapshot(now).bubbleText).toBe(MARKS.desk.prompt);

    const outside = { x: 4.2, z: 6.2 };
    expect(inNoZone(outside)).toBe(true);
    const frame = frameChecker(sim);
    expect(tap(sim, floorHit(outside))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => isStoppedAt(sim, outside),
        () => {
          if (!isStoppedAt(sim, outside)) frame.check();
        }
      )
    ).toBe(true);
    run(sim, 0.5);

    expect(frame.movingInZone.desk ?? 0).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
    const snap = sim.snapshot(now);
    expect({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual(NO_BUBBLE);
  });

  it("Z12(12 결정): 구역 밖에서 로비 인사를 받은 뒤 라이트루프를 누르면, 짧은 말이 끝난 뒤 말풍선이 없고(인사도 기본 말도 다시 나오지 않는다) 10초 뒤에도 없다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(inNoZone({ x: sim.x, z: sim.z })).toBe(true);
    run(sim, 0.5);
    sim.greet(GREETING_LINE, "wave", now);
    run(sim, 3);
    expect(sim.snapshot(now).bubbleText).toBe(GREETING_LINE);

    expect(tap(sim, { point: null, mark: null, onCharacter: true })).toBe("poke");
    expect(sim.snapshot(now).bubbleText).toBe("헤헤, 간지러워!");
    run(sim, 3);

    expect({ x: sim.x, z: sim.z }).toEqual({ x: 4.2, z: 6.2 });
    const seen = new Set<string>();
    run(sim, 10, () => seen.add(JSON.stringify({ bubbleText: sim.snapshot(now).bubbleText, bubbleButton: sim.snapshot(now).bubbleButton })));
    expect([...seen]).toEqual([JSON.stringify(NO_BUBBLE)]);
  });
});

describe("[spec] 작업 061 13 결정: 벽에 붙은 장소(게시판, 창가)의 구역은 가운데에서 벽 위의 점까지 잇는 선에서 1칸 안", () => {
  // 가운데에서는 1칸 넘게 떨어졌지만(원이었다면 밖) 벽 위의 점까지 잇는 선에서는 1칸 안인, 벽에 붙은 자리
  const WALL_INSIDE: [PlaceId, FloorPoint, FloorPoint][] = [
    ["board", { x: 4.2, z: 6.2 }, { x: 0.94, z: 0.78 }],
    ["window", { x: 4.2, z: 6.2 }, { x: 5.6, z: 0.8 }]
  ];

  it.each(WALL_INSIDE)("W1(바뀔 동작): 장소(%s) 가운데에서 1칸 넘게 떨어진 벽 쪽 자리라도 벽 위의 점까지 잇는 선에서 1칸 안이면, 바닥을 눌러 멈췄을 때 그 장소 안내와 버튼이 나온다", (id, start, point) => {
    expect(distance(point, zoneCenter(id))).toBeGreaterThan(1.05);
    expect(zoneDistance(id, point)).toBeLessThan(0.95);
    expect(isFree(point.x, point.z)).toBe(true);
    expect(MARK_IDS.filter((other) => other !== id).every((other) => zoneDistance(other, point) > 1)).toBe(true);
    const sim = new LobbySim(start);

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      arrived: id,
      bubbleText: MARKS[id].prompt,
      bubbleButton: MARKS[id].buttonLabel,
      enterMessage: MARKS[id].enterMessage
    });
  });

  // 벽 쪽이어도 선에서 1칸 넘게 옆으로 떨어진 자리(구역이 벽을 따라 넓은 네모가 아니다)
  const WALL_OUTSIDE: [MarkId, FloorPoint, FloorPoint][] = [
    ["board", { x: 4.2, z: 6.2 }, { x: 0.73, z: 0.8 }],
    ["window", { x: 4.2, z: 6.2 }, { x: 5.93, z: 0.8 }]
  ];

  it.each(WALL_OUTSIDE)("W2(12 결정의 말풍선 없음 때문에 df42aae에서는 실패, 도착이 아닌 것은 지금도 그대로): 장소(%s) 벽 쪽이라도 벽 위의 점까지 잇는 선에서 1칸 넘게 옆이면, 멈췄을 때 도착이 아니고 말풍선이 없다", (_id, start, point) => {
    expect(inNoZone(point)).toBe(true);
    expect(MARK_IDS.every((id) => zoneDistance(id, point) > 1.1)).toBe(true);
    expect(isFree(point.x, point.z)).toBe(true);
    const sim = new LobbySim(start);

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({ arrived: null, ...NO_BUBBLE });
  });

  it("Z13(바뀔 동작, 13 결정): 게시판 구역 안에서 손을 떼지 않고 창가 쪽으로 끌면, 게시판 구역에 있는 동안은 게시판 안내, 창가 구역에 들어서면 바로 창가 안내이고, 그 사이 구역 밖에서는 말풍선이 숨는다", () => {
    const sim = new LobbySim({ x: 2.5, z: 1.9 });
    expect(zoneClearlyAt({ x: sim.x, z: sim.z })).toBe("board");
    const frame = frameChecker(sim);
    const finger = { x: 4.8, z: 1.55 }; // 창가 서는 자리 가운데
    sim.pointerDown(floorHit({ x: 2.5, z: 1.9 }), 100, 100, now);
    sim.pointerMove(floorHit(finger), 160, 100);
    expect(sim.dragging).toBe(true);

    run(sim, 3, frame.check);

    expect(sim.dragging).toBe(true);
    expect(zoneClearlyAt({ x: sim.x, z: sim.z })).toBe("window");
    expect(frame.movingInZone.board ?? 0).toBeGreaterThan(0);
    expect(frame.movingInZone.window ?? 0).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
    const snap = sim.snapshot(now);
    expect({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      bubbleText: MARKS.window.prompt,
      bubbleButton: MARKS.window.buttonLabel,
      enterMessage: MARKS.window.enterMessage
    });
  });
});
