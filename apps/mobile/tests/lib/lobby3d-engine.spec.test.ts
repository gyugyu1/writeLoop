// [spec] qa 테스트(작업 058, 새 기능: 개발용 3D 로비 시험 화면의 동작 규칙).
// 기대값은 시나리오(private 작업 폴더 02-qa-scenarios.md)와 결정(03, 05)에서만 가져온다. 구현은 부르는 방법만 본다.
// 명세에 숫자가 없는 것(막힌 칸, 장소 앞 지점, 장소 중심, 벽 높이, 카메라 거리 범위)은 구현의 방 데이터를 입력으로 읽고,
// 명세의 성질(가구·방 밖을 지나지 않는다)을 검사한다. 카메라 규칙은 작업 060-④에서 바뀌었다(아래 카메라 describe 머리말).
// 좌표(구현의 약속): 바닥 한 칸 = 1, x는 왼쪽→오른쪽(0..8), z는 뒷벽→앞(0..11). 바라보는 방향 0 = +z, atan2(dx, dz).
import {
  LobbySim,
  MARKS,
  ROOM,
  ROOM_BOUNDS,
  SOLID_TILES,
  VIEW_WIDTH_DEFAULT,
  VIEW_WIDTH_MAX,
  VIEW_WIDTH_MIN,
  cameraPose,
  clampViewWidth,
  findPath,
  isFree,
  type FloorPoint,
  type MarkId,
  type PointerHit
} from "@/lib/lobby3d/engine";

const FRAME_S = 0.05;
const FRAME_MS = 50;
const MARK_IDS: MarkId[] = ["board", "window", "desk", "door"];

function floorHit(point: FloorPoint | null): PointerHit {
  return { point, mark: null, onCharacter: false };
}

/** 명세 4: 바닥 8×11 안이고 가구 칸이 아닌지(몸 둘레는 보지 않는다). */
function inRoomAndNotFurniture(p: FloorPoint): boolean {
  if (!(p.x > 0 && p.x < 8 && p.z > 0 && p.z < 11)) return false;
  return !SOLID_TILES.has(`${Math.floor(p.x)},${Math.floor(p.z)}`);
}

function tileOf(p: FloorPoint): string {
  return `${Math.floor(p.x)},${Math.floor(p.z)}`;
}

/** 시작점부터 경로의 꺾이는 점들을 0.05 간격으로 훑은 점. */
function samplePath(from: FloorPoint, points: FloorPoint[]): FloorPoint[] {
  const samples: FloorPoint[] = [];
  let cur = from;
  for (const next of points) {
    const n = Math.max(1, Math.ceil(Math.hypot(next.x - cur.x, next.z - cur.z) / 0.05));
    for (let i = 0; i <= n; i += 1) {
      samples.push({ x: cur.x + ((next.x - cur.x) * i) / n, z: cur.z + ((next.z - cur.z) * i) / n });
    }
    cur = next;
  }
  return samples;
}

/** 톡: 같은 자리에서 누르고 0.1초 뒤 뗀다. */
function tap(sim: LobbySim, hit: PointerHit, nowMs: number) {
  sim.pointerDown(hit, 100, 100, nowMs);
  return sim.pointerUp(nowMs + 100);
}

/** frames번 진행하며 매 프레임 위치를 모은다. */
function run(sim: LobbySim, frames: number, startMs: number) {
  const positions: FloorPoint[] = [];
  let now = startMs;
  for (let i = 0; i < frames; i += 1) {
    now += FRAME_MS;
    sim.update(FRAME_S, now);
    positions.push({ x: sim.x, z: sim.z });
  }
  return { positions, now };
}

function angleDiff(a: number, b: number) {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
}

describe("[spec] 톡·꾹·끌기 판정(S7~S11, 결정 8: 누른 점에서 지금 손가락까지의 직선거리, dp)", () => {
  const T0 = 1_000_000;
  const target = floorHit({ x: 4.5, z: 9.5 });

  it("S7: 움직이지 않고 0.10초 만에 떼면 톡이라 누른 곳으로 걸어간다", () => {
    const sim = new LobbySim();
    sim.pointerDown(target, 100, 100, T0);
    sim.update(0.016, T0 + 100);
    expect(sim.dragging).toBe(false);
    expect(sim.pointerUp(T0 + 100)).toBe("walk");
  });

  it("S8: 12px 움직이고 0.21초에 떼면(경계: 12px 이하, 0.22초 미만) 톡이다", () => {
    const sim = new LobbySim();
    sim.pointerDown(target, 100, 100, T0);
    sim.pointerMove(target, 112, 100);
    sim.update(0.016, T0 + 210);
    expect(sim.dragging).toBe(false);
    expect(sim.pointerUp(T0 + 210)).toBe("walk");
  });

  it("S8(결정 8): 오간 길이의 합이 12px을 넘어도 누른 점에서 직선거리가 12px 이하면 톡이다", () => {
    const sim = new LobbySim();
    sim.pointerDown(target, 100, 100, T0);
    sim.pointerMove(target, 110, 100);
    sim.pointerMove(target, 100, 100);
    sim.pointerMove(target, 110, 100);
    sim.pointerMove(target, 100, 100);
    expect(sim.dragging).toBe(false);
    expect(sim.pointerUp(T0 + 150)).toBe("walk");
  });

  it("S9: 13px 움직이면(12px 넘음) 0.10초여도 끌기다", () => {
    const sim = new LobbySim();
    sim.pointerDown(target, 100, 100, T0);
    sim.pointerMove(target, 113, 100);
    expect(sim.dragging).toBe(true);
    expect(sim.pointerUp(T0 + 100)).toBe("drag-end");
  });

  it("S9(결정 8): 대각선으로 (9, 9)px 움직이면 직선거리 12.7px이라 끌기다", () => {
    const sim = new LobbySim();
    sim.pointerDown(target, 100, 100, T0);
    sim.pointerMove(target, 109, 109);
    expect(sim.dragging).toBe(true);
  });

  it("S10: 움직이지 않아도 0.22초가 되면 꾹이고(0.219초까지는 아님) 뗄 때 톡으로 걷지 않는다", () => {
    const sim = new LobbySim();
    sim.pointerDown(target, 100, 100, T0);
    sim.update(0.016, T0 + 219);
    expect(sim.dragging).toBe(false);
    sim.update(0.016, T0 + 220);
    expect(sim.dragging).toBe(true);
    expect(sim.pointerUp(T0 + 400)).toBe("drag-end");
  });

  it("S11: 떼지 않고 0.22초가 지나면 손가락 쪽으로 걷기 시작한다", () => {
    const sim = new LobbySim();
    const finger = { x: 4.2, z: 9.8 };
    const before = Math.hypot(finger.x - sim.x, finger.z - sim.z);
    sim.pointerDown(floorHit(finger), 100, 100, T0);
    sim.update(0.016, T0 + 220);
    run(sim, 10, T0 + 220);
    const after = Math.hypot(finger.x - sim.x, finger.z - sim.z);
    expect(after).toBeLessThan(before - 0.3);
  });
});

describe("[spec] 방 데이터와 길 찾기(S12~S16)", () => {
  it("S12: 바닥이 8×11이고 장소가 게시판·창가·일기 책상·문 네 개이며, 장소마다 서 있을 수 있는 앞 지점이 있다", () => {
    expect(ROOM.width).toBe(8);
    expect(ROOM.depth).toBe(11);
    expect(Object.keys(MARKS).sort()).toEqual(["board", "desk", "door", "window"]);
    for (const id of MARK_IDS) {
      const standable = MARKS[id].approach.filter((p) => inRoomAndNotFurniture(p) && isFree(p.x, p.z));
      expect({ id, standable: standable.length > 0 }).toEqual({ id, standable: true });
    }
  });

  it("S13: 사이에 가구가 없는 바닥을 톡 하면 경로 끝이 누른 칸 안이고, 걸어가서 그 칸에 멈춘다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const goal = { x: 4.5, z: 9.5 };
    const path = findPath({ x: sim.x, z: sim.z }, [goal]);
    expect(path).not.toBeNull();
    expect(tileOf(path![path!.length - 1])).toBe("4,9");

    expect(tap(sim, floorHit(goal), 0)).toBe("walk");
    const { positions } = run(sim, 200, 100);
    expect(positions.every(inRoomAndNotFurniture)).toBe(true);
    expect(tileOf({ x: sim.x, z: sim.z })).toBe("4,9");
    expect(sim.snapshot(20_000).moving).toBe(false);
  });

  it.each([
    ["일기 책상을 사이에 둔 위·아래", { x: 0.6, z: 4.5 }, { x: 0.6, z: 6.5 }, "0,6"],
    ["옷장을 사이에 둔 위·아래", { x: 7.3, z: 2.5 }, { x: 7.3, z: 4.5 }, "7,4"]
  ])("S14: %s 칸으로 가는 길은 가구 칸·방 밖을 지나지 않고 누른 칸에 닿는다", (_name, from, goal, goalTile) => {
    const path = findPath(from, [goal]);
    expect(path).not.toBeNull();
    expect(tileOf(path![path!.length - 1])).toBe(goalTile);
    const bad = samplePath(from, path!).filter((p) => !inRoomAndNotFurniture(p));
    expect(bad).toEqual([]);

    const sim = new LobbySim(from);
    expect(tap(sim, floorHit(goal), 0)).toBe("walk");
    const { positions } = run(sim, 300, 100);
    expect(positions.filter((p) => !inRoomAndNotFurniture(p))).toEqual([]);
    expect(tileOf({ x: sim.x, z: sim.z })).toBe(goalTile);
  });

  it.each([
    ["일기 책상 칸", { x: 1.5, z: 5.5 }],
    ["옷장 칸", { x: 7.5, z: 3.5 }]
  ])("S15: 가구가 있는 %s을 톡 하면 움직이지 않는다", (_name, point) => {
    expect(SOLID_TILES.has(tileOf(point))).toBe(true);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(tap(sim, floorHit(point), 0)).not.toBe("walk");
    run(sim, 40, 100);
    expect({ x: sim.x, z: sim.z }).toEqual({ x: 4.2, z: 6.2 });
  });

  it.each([
    ["왼쪽 벽 너머", { x: -1, z: 5 }],
    ["오른쪽 벽 너머", { x: 9, z: 5 }],
    ["뒷벽 너머", { x: 4, z: -0.5 }],
    ["앞쪽 바닥 끝(11) 너머", { x: 4, z: 12 }],
    ["바닥이 아닌 곳", null]
  ])("S16: 방 밖(%s)을 톡 하면 움직이지 않는다", (_name, point) => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(tap(sim, floorHit(point), 0)).not.toBe("walk");
    run(sim, 40, 100);
    expect({ x: sim.x, z: sim.z }).toEqual({ x: 4.2, z: 6.2 });
  });
});

describe("[spec] 손가락 따라 걷기와 충돌(S17~S21)", () => {
  /** 누르고 13px 끌어 끌기로 만든다. */
  function startDrag(sim: LobbySim, finger: FloorPoint) {
    sim.pointerDown(floorHit(finger), 100, 100, 0);
    sim.pointerMove(floorHit(finger), 100, 113);
    expect(sim.dragging).toBe(true);
  }

  it("S17: 열린 바닥에서 끌면 손가락까지 거리가 줄어든다", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const finger = { x: 4.2, z: 9.5 };
    const before = Math.hypot(finger.x - sim.x, finger.z - sim.z);
    startDrag(sim, finger);
    run(sim, 10, 0);
    expect(Math.hypot(finger.x - sim.x, finger.z - sim.z)).toBeLessThan(before - 0.5);
  });

  it.each([
    ["뒷벽을 정면으로", { x: 4, z: 2.5 }, { x: 4, z: -3 }],
    ["왼쪽 벽을 정면으로", { x: 2, z: 8 }, { x: -3, z: 8 }],
    ["오른쪽 벽을 정면으로", { x: 6, z: 8 }, { x: 11, z: 8 }],
    ["화분을 정면으로", { x: 5.5, z: 3.5 }, { x: 9, z: 3.5 }],
    ["일기 책상을 정면으로", { x: 1, z: 8 }, { x: 1, z: 3 }]
  ])("S18: %s 끌어도 어느 프레임에서도 방 밖이나 가구 칸에 들어가지 않는다", (_name, start, finger) => {
    const sim = new LobbySim(start);
    startDrag(sim, finger);
    const { positions } = run(sim, 120, 0);
    expect(positions.filter((p) => !inRoomAndNotFurniture(p))).toEqual([]);
  });

  it("S19: 왼쪽 벽에 비스듬히(45°) 끌면 벽에 닿은 뒤에도 벽을 따라 앞뒤로 미끄러져 간다", () => {
    const sim = new LobbySim({ x: 2, z: 10 });
    startDrag(sim, { x: -2, z: 6 });
    const { positions } = run(sim, 80, 0);
    expect(positions.filter((p) => !inRoomAndNotFurniture(p))).toEqual([]);
    const minX = Math.min(...positions.map((p) => p.x));
    const touch = positions.findIndex((p) => p.x <= minX + 0.01);
    expect(touch).toBeGreaterThanOrEqual(0);
    const zAtTouch = positions[touch].z;
    expect(positions[positions.length - 1].z).toBeLessThan(zAtTouch - 0.5);
  });

  it("S20: 걷는 중 손을 떼면 한 번에 멈추지 않고 속도가 줄어 결국 0이 된다", () => {
    const sim = new LobbySim({ x: 4.2, z: 5 });
    startDrag(sim, { x: 4.2, z: 10.5 });
    const { now } = run(sim, 12, 0);
    const before = sim.snapshot(now).speed;
    expect(before).toBeGreaterThan(1);
    expect(sim.pointerUp(now)).toBe("drag-end");

    const speeds: number[] = [];
    let t = now;
    for (let i = 0; i < 60; i += 1) {
      t += FRAME_MS;
      sim.update(FRAME_S, t);
      speeds.push(sim.snapshot(t).speed);
    }
    expect(speeds[0]).toBeGreaterThan(0);
    expect(speeds[0]).toBeLessThan(before);
    for (let i = 1; i < speeds.length; i += 1) expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1]);
    expect(speeds[speeds.length - 1]).toBe(0);
  });

  it("S21: 걷는 속도 값을 키우면 같은 시간에 더 멀리 간다", () => {
    const traveled = (speed: number) => {
      const sim = new LobbySim({ x: 4.2, z: 3 });
      sim.settings = { ...sim.settings, speed };
      tap(sim, floorHit({ x: 4.2, z: 10.5 }), 0);
      run(sim, 15, 100);
      return Math.hypot(sim.x - 4.2, sim.z - 3);
    };
    expect(traveled(3.5)).toBeGreaterThan(traveled(2));
  });
});

describe("[spec] 장소 도착과 바라보기(S22, S23, 결정 5)", () => {
  function walkToMark(id: MarkId) {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(tap(sim, { point: null, mark: id, onCharacter: false }, 0)).toBe("walk");
    const positions: FloorPoint[] = [];
    let now = 100;
    for (let i = 0; i < 400 && sim.snapshot(now).arrived !== id; i += 1) {
      now += FRAME_MS;
      sim.update(FRAME_S, now);
      positions.push({ x: sim.x, z: sim.z });
    }
    return { sim, positions, now };
  }

  it.each(MARK_IDS)("S22: 장소(%s)를 톡 하면 가구 칸·방 밖을 지나지 않고 그 장소 앞에 도착한다", (id) => {
    const start = { x: 4.2, z: 6.2 };
    const path = findPath(start, MARKS[id].approach);
    expect(path).not.toBeNull();
    expect(samplePath(start, path!).filter((p) => !inRoomAndNotFurniture(p))).toEqual([]);

    const { sim, positions, now } = walkToMark(id);
    expect(sim.snapshot(now).arrived).toBe(id);
    expect(positions.filter((p) => !inRoomAndNotFurniture(p))).toEqual([]);
    const nearest = Math.min(...MARKS[id].approach.map((a) => Math.hypot(a.x - sim.x, a.z - sim.z)));
    expect(nearest).toBeLessThan(0.06);
  });

  it.each(MARK_IDS)("S23: 장소(%s)에 도착하면 장소 중심 쪽을 0.15라디안 안으로 바라본다", (id) => {
    const { sim, now } = walkToMark(id);
    expect(sim.snapshot(now).arrived).toBe(id);
    run(sim, 60, now);
    const center = MARKS[id].faceTo;
    const want = Math.atan2(center.x - sim.x, center.z - sim.z);
    expect(angleDiff(sim.heading, want)).toBeLessThanOrEqual(0.15);
  });

  // 작업 060-⑤ 결정 29(문을 없앰)로 고쳤다: 벽에 붙은 장소는 게시판·창가 둘이고, "밖으로"(door)는 방 앞 입구 발판 가운데로 옮겨졌다.
  it("S23(결정 5, 060-⑤ 결정 29): 벽에 붙은 장소(게시판, 창가)의 중심은 뒷벽 위(z = 0)에 있고, 밖으로의 중심은 뒷벽이 아니라 입구 발판 가운데(바닥 앞끝 + 발판 깊이의 절반)에 있다", () => {
    expect({
      board: MARKS.board.faceTo.z,
      window: MARKS.window.faceTo.z,
      doorOnStepCenter: Math.abs(MARKS.door.faceTo.z - (ROOM.depth + ROOM.stepDepth / 2)) < 1e-9
    }).toEqual({ board: 0, window: 0, doorOnStepCenter: true });
  });
});


// 작업 060-④(방을 디오라마처럼, 기능 변경)에서 아래 카메라 테스트를 새 규칙으로 바꿨다(명세 "고칠 기존 테스트").
// 옛 규칙(정사영, 방 밖이 보이지 않는다, 그린 바닥 앞 끝 z = 24, 기울기 42°)은 없어지고, 새 규칙은 이렇다(명세 3. 카메라).
// - 원근 카메라가 방 앞쪽 위에서 비스듬히 내려다본다. 안쪽이 작게 보인다.
// - 가로·세로 각각, 방이 화면에 다 들어오면 그 방향은 방 가운데에 고정(남는 곳은 검정), 아니면 라룹이를 따라가되 방 끝 너머는 막는다.
// - 방 끝: 양옆 벽 바깥면, 뒷벽(바깥면·윗면), 앞쪽은 입구 발판 앞.
// - 가장 멀리 두면 방 전체와 둘레의 검은 곳이 함께 보인다.
// 기울기·시야각·거리는 시험판으로 사용자와 맞추므로(명세 3) 숫자로 고정하지 않는다. 구현이 내보낸 카메라 자리로
// 화면에 무엇이 보이는지를 이 테스트가 직접 계산해(three.js PerspectiveCamera와 같은 약속) 성질만 본다.
describe("[spec] 카메라(S50, S51, 결정 10 → 작업 060-④ 디오라마 새 규칙)", () => {
  type Vec3 = { x: number; y: number; z: number };
  /** 카메라 자리: position에서 lookAt을 보고, 위쪽은 +y, fovDeg는 세로 시야각(도). */
  type Pose = { position: Vec3; lookAt: Vec3; fovDeg: number };
  /** 방 끝을 둘러싼 상자(벽 바깥면, 벽 윗면, 앞쪽은 입구 발판 앞, 아래는 입구 발판 밑). */
  type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  type Screen = [number, number];

  // ---- 구현을 부르는 곳은 이 둘뿐이다(가정한 이름: cameraPose, ROOM_BOUNDS. 이름이 다르면 여기만 고친다) ----
  /** follow: 라룹이가 있는 바닥 점, viewWidth: 카메라 거리 설정 값, 화면 가로/세로 비율. */
  function poseFor(follow: FloorPoint, viewWidth: number, [w, h]: Screen): Pose {
    return cameraPose(follow, viewWidth, w / h) as Pose;
  }
  function roomEnds(): Box {
    return ROOM_BOUNDS as Box;
  }
  // -------------------------------------------------------------------------------------------------

  const EPS = 1e-6;
  /** 카메라 바로 앞 면. 이보다 가까운 곳은 화면 밖으로 크게 벗어난 것으로 본다. */
  const NEAR = 0.01;
  const screens: Screen[] = [
    [360, 640],
    [390, 844],
    [412, 915]
  ];
  const follow: FloorPoint[] = [
    { x: 0.6, z: 0.8 },
    { x: 7.4, z: 0.8 },
    { x: 0.6, z: 10.8 },
    { x: 7.4, z: 10.8 },
    { x: 4, z: 5.5 },
    ...MARK_IDS.flatMap((id) => MARKS[id].approach)
  ];
  const BACK: FloorPoint = { x: 4, z: 0.8 };
  const FRONT: FloorPoint = { x: 4, z: 10.8 };

  function viewWidths(): [string, number][] {
    const list: [string, number][] = [
      ["가장 멀리", VIEW_WIDTH_MAX],
      ["기본값", VIEW_WIDTH_DEFAULT],
      ["가장 가까이", VIEW_WIDTH_MIN]
    ];
    for (const k of [0.25, 0.5, 0.75]) list.push([`사이 ${k}`, VIEW_WIDTH_MIN + (VIEW_WIDTH_MAX - VIEW_WIDTH_MIN) * k]);
    return list;
  }

  function cases() {
    return screens.flatMap((screen) =>
      viewWidths().flatMap(([name, width]) => follow.map((p) => ({ screen, name, width, p })))
    );
  }

  function caseLabel(c: { screen: Screen; name: string; width: number; p: FloorPoint }) {
    return `${c.screen.join("x")} ${c.name}(${c.width.toFixed(2)}) 라룹이(${c.p.x},${c.p.z})`;
  }

  const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const norm = (a: Vec3): Vec3 => {
    const l = Math.hypot(a.x, a.y, a.z);
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  };
  const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

  /** 화면 좌표(가운데 0, 왼쪽·아래 끝 -1, 오른쪽·위 끝 +1)와 카메라 앞 깊이. */
  function camera(pose: Pose, [w, h]: Screen) {
    const f = norm(sub(pose.lookAt, pose.position));
    const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
    const u = cross(r, f);
    const tanV = Math.tan((pose.fovDeg * Math.PI) / 360);
    const tanH = tanV * (w / h);
    const depth = (p: Vec3) => dot(sub(p, pose.position), f);
    const project = (p: Vec3) => {
      const d = sub(p, pose.position);
      const z = dot(d, f);
      return { x: dot(d, r) / (z * tanH), y: dot(d, u) / (z * tanV), depth: z };
    };
    return { f, depth, project };
  }

  /** 방 상자가 화면에 그려지는 범위. 카메라 뒤로 넘어가는 부분은 카메라 바로 앞 면에서 자른다. */
  function roomExtent(pose: Pose, screen: Screen, box: Box) {
    const cam = camera(pose, screen);
    const xs = [box.minX, box.maxX];
    const ys = [box.minY, box.maxY];
    const zs = [box.minZ, box.maxZ];
    const corners: Vec3[] = [];
    for (const x of xs) for (const y of ys) for (const z of zs) corners.push({ x, y, z });
    const edges: [Vec3, Vec3][] = [];
    for (let i = 0; i < corners.length; i += 1) {
      for (let j = i + 1; j < corners.length; j += 1) {
        const a = corners[i];
        const b = corners[j];
        const differ = Number(a.x !== b.x) + Number(a.y !== b.y) + Number(a.z !== b.z);
        if (differ === 1) edges.push([a, b]);
      }
    }
    const points: Vec3[] = corners.filter((p) => cam.depth(p) >= NEAR);
    for (const [a, b] of edges) {
      const da = cam.depth(a);
      const db = cam.depth(b);
      if ((da < NEAR) !== (db < NEAR)) points.push(lerp3(a, b, (NEAR - da) / (db - da)));
    }
    const projected = points.map(cam.project);
    return {
      clipped: corners.some((p) => cam.depth(p) < NEAR),
      empty: projected.length === 0,
      minX: Math.min(...projected.map((p) => p.x)),
      maxX: Math.max(...projected.map((p) => p.x)),
      minY: Math.min(...projected.map((p) => p.y)),
      maxY: Math.max(...projected.map((p) => p.y))
    };
  }

  it("방 끝(명세 1·3): 벽에 두께가 있어 방 끝이 걷는 바닥 바깥이고, 앞쪽 끝은 바닥 앞끝보다 앞(입구 발판)이며 발판은 바닥보다 낮다", () => {
    const box = roomEnds();
    expect({
      leftWallOuterBeyondFloor: box.minX < 0,
      rightWallOuterBeyondFloor: box.maxX > ROOM.width,
      backWallOuterBeyondFloor: box.minZ < 0,
      stepInFrontOfFloor: box.maxZ > ROOM.depth,
      stepBelowFloor: box.minY < 0,
      wallTopIncluded: box.maxY >= ROOM.wallHeight
    }).toEqual({
      leftWallOuterBeyondFloor: true,
      rightWallOuterBeyondFloor: true,
      backWallOuterBeyondFloor: true,
      stepInFrontOfFloor: true,
      stepBelowFloor: true,
      wallTopIncluded: true
    });
  });

  it("S51(바뀜): 방 앞쪽 위에서 비스듬히 내려다본다(옆으로 돌지 않고, 아래와 뒷벽 쪽을 본다). 기울기 숫자는 시험판으로 정하므로 보지 않는다", () => {
    const bad: string[] = [];
    for (const c of cases()) {
      const pose = poseFor(c.p, c.width, c.screen);
      const f = norm(sub(pose.lookAt, pose.position));
      const ok = Math.abs(f.x) < 1e-9 && f.y < 0 && f.z < 0 && pose.fovDeg > 0 && pose.fovDeg < 180;
      if (!ok) bad.push(`${caseLabel(c)} → 보는 방향 (${f.x.toFixed(3)}, ${f.y.toFixed(3)}, ${f.z.toFixed(3)}), 시야각 ${pose.fovDeg}`);
    }
    expect(bad).toEqual([]);
  });

  it("원근(바뀜): 안쪽(뒷벽 아래 끝)이 앞쪽(바닥 앞 끝)보다 화면에서 짧게 보인다", () => {
    const bad: string[] = [];
    for (const c of cases()) {
      const cam = camera(poseFor(c.p, c.width, c.screen), c.screen);
      const len = (z: number) => cam.project({ x: ROOM.width, y: 0, z }).x - cam.project({ x: 0, y: 0, z }).x;
      const back = len(0);
      const front = len(ROOM.depth);
      if (!(back > 0 && front > 0 && back < front)) bad.push(`${caseLabel(c)} → 뒷벽 아래 ${back.toFixed(3)}, 바닥 앞 ${front.toFixed(3)}`);
    }
    expect(bad).toEqual([]);
  });

  it("S50 가로(바뀜): 방이 가로로 다 들어오면 좌우 여백이 같게 가운데에 두고, 아니면 화면 양 끝이 방 끝(양옆 벽 바깥면) 너머로 나가지 않는다", () => {
    const box = roomEnds();
    const bad: string[] = [];
    for (const c of cases()) {
      const e = roomExtent(poseFor(c.p, c.width, c.screen), c.screen, box);
      if (e.empty) {
        bad.push(`${caseLabel(c)} → 방이 카메라 뒤에 있음`);
        continue;
      }
      const fits = !e.clipped && e.minX >= -1 - EPS && e.maxX <= 1 + EPS;
      const centered = Math.abs(e.minX + e.maxX) <= EPS;
      const covers = e.minX <= -1 + EPS && e.maxX >= 1 - EPS;
      if (!((fits && centered) || covers)) {
        bad.push(`${caseLabel(c)} → 방 가로 범위 ${e.minX.toFixed(4)} ~ ${e.maxX.toFixed(4)}(화면 -1 ~ 1)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("S50 세로(바뀜): 방이 세로로 다 들어오면 라룹이가 어디 있든 세로 자리가 고정되고, 아니면 화면 위·아래 끝이 방 끝(뒷벽 윗면, 입구 발판 앞) 너머로 나가지 않는다", () => {
    const box = roomEnds();
    const bad: string[] = [];
    const verticalOf = (pose: Pose) => [pose.position.y, pose.position.z, pose.lookAt.y, pose.lookAt.z, pose.fovDeg];
    const sameVertical = (a: Pose, b: Pose) => verticalOf(a).every((v, i) => Math.abs(v - verticalOf(b)[i]) <= 1e-9);
    for (const c of cases()) {
      const pose = poseFor(c.p, c.width, c.screen);
      const e = roomExtent(pose, c.screen, box);
      if (e.empty) {
        bad.push(`${caseLabel(c)} → 방이 카메라 뒤에 있음`);
        continue;
      }
      const fits = !e.clipped && e.minY >= -1 - EPS && e.maxY <= 1 + EPS;
      const fixed =
        sameVertical(pose, poseFor(BACK, c.width, c.screen)) && sameVertical(pose, poseFor(FRONT, c.width, c.screen));
      const covers = e.minY <= -1 + EPS && e.maxY >= 1 - EPS;
      if (!((fits && fixed) || covers)) {
        bad.push(
          `${caseLabel(c)} → 방 세로 범위 ${e.minY.toFixed(4)} ~ ${e.maxY.toFixed(4)}(화면 -1 ~ 1), 세로 자리 고정 ${fixed}`
        );
      }
    }
    expect(bad).toEqual([]);
  });

  it("따라가기: 어느 화면·거리·위치에서도 라룹이(발밑)는 화면 안에 있다", () => {
    const bad: string[] = [];
    for (const c of cases()) {
      const p = camera(poseFor(c.p, c.width, c.screen), c.screen).project({ x: c.p.x, y: 0, z: c.p.z });
      if (!(p.depth > 0 && Math.abs(p.x) <= 1 + EPS && Math.abs(p.y) <= 1 + EPS)) {
        bad.push(`${caseLabel(c)} → 화면 (${p.x.toFixed(3)}, ${p.y.toFixed(3)}), 깊이 ${p.depth.toFixed(3)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("따라가기(가로): 방이 가로로 다 들어오지 않는 거리에서는 라룹이가 왼쪽·가운데·오른쪽에 있을 때 카메라도 그 순서로 옮겨 간다", () => {
    const box = roomEnds();
    const checked: string[] = [];
    const bad: string[] = [];
    for (const screen of screens) {
      for (const [name, width] of viewWidths()) {
        const mid = poseFor({ x: ROOM.width / 2, z: 5.5 }, width, screen);
        const e = roomExtent(mid, screen, box);
        if (!(e.maxX - e.minX > 2.05)) continue;
        checked.push(`${screen.join("x")} ${name}`);
        const left = poseFor({ x: 0.6, z: 5.5 }, width, screen);
        const right = poseFor({ x: 7.4, z: 5.5 }, width, screen);
        if (!(left.position.x < mid.position.x && mid.position.x < right.position.x)) {
          bad.push(`${screen.join("x")} ${name} → 카메라 x 왼쪽 ${left.position.x}, 가운데 ${mid.position.x}, 오른쪽 ${right.position.x}`);
        }
      }
    }
    // "가장 멀리 두면 방 전체가 보이게 범위를 넓힌다"(명세 3)이므로 그보다 가까운 거리에는 가로로 다 들어오지 않는 때가 있다.
    expect(checked.length).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  it("따라가기(세로): 방이 세로로 다 들어오지 않는 거리에서는 라룹이가 앞으로 가면 카메라도 앞으로 간다", () => {
    const box = roomEnds();
    const bad: string[] = [];
    for (const screen of screens) {
      for (const [name, width] of viewWidths()) {
        const e = roomExtent(poseFor({ x: 4, z: 5.5 }, width, screen), screen, box);
        if (!(e.maxY - e.minY > 2.05)) continue;
        const back = poseFor(BACK, width, screen);
        const front = poseFor(FRONT, width, screen);
        if (!(back.position.z < front.position.z)) {
          bad.push(`${screen.join("x")} ${name} → 카메라 z 뒤 ${back.position.z}, 앞 ${front.position.z}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("카메라 거리(바뀜): 가장 멀리 두면 어느 화면·위치에서도 방 전체가 화면 안에 있고 네 둘레에 검은 곳이 남는다", () => {
    const box = roomEnds();
    const bad: string[] = [];
    for (const screen of screens) {
      for (const p of follow) {
        const e = roomExtent(poseFor(p, VIEW_WIDTH_MAX, screen), screen, box);
        const inside = !e.empty && !e.clipped && e.minX > -1 + EPS && e.maxX < 1 - EPS && e.minY > -1 + EPS && e.maxY < 1 - EPS;
        if (!inside) {
          bad.push(`${screen.join("x")} 라룹이(${p.x},${p.z}) → 가로 ${e.minX.toFixed(4)} ~ ${e.maxX.toFixed(4)}, 세로 ${e.minY.toFixed(4)} ~ ${e.maxY.toFixed(4)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("카메라 거리 범위: 가장 가까이 < 기본값 < 가장 멀리이고, 범위 밖 값은 새 범위 끝으로 맞춘다", () => {
    expect(VIEW_WIDTH_MIN).toBeLessThan(VIEW_WIDTH_DEFAULT);
    expect(VIEW_WIDTH_DEFAULT).toBeLessThan(VIEW_WIDTH_MAX);
    expect(clampViewWidth(VIEW_WIDTH_MAX + 1)).toBe(VIEW_WIDTH_MAX);
    expect(clampViewWidth(VIEW_WIDTH_MIN - 1)).toBe(VIEW_WIDTH_MIN);
    expect(clampViewWidth(VIEW_WIDTH_DEFAULT)).toBe(VIEW_WIDTH_DEFAULT);
  });

  // ---- 13 결정(사용자 "더한다")으로 더한 테스트 ----

  /**
   * 방 상자 중 화면 세로 범위(위 끝~아래 끝) 안에 실제로 보이는 부분의 꼭짓점.
   * 카메라가 옆으로 돌지 않으므로(S51) 화면 위·아래 끝 면은 x축과 나란하다. 그래서 상자의 y·z 단면(사각형)을
   * 두 면과 카메라 바로 앞 면으로 자른 다각형을 구하고, 그 꼭짓점마다 x = 양옆 벽 바깥면 두 점을 만든다.
   */
  function visibleRoomPoints(pose: Pose, box: Box): Vec3[] {
    const f = norm(sub(pose.lookAt, pose.position));
    const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
    const u = cross(r, f);
    const tanV = Math.tan((pose.fovDeg * Math.PI) / 360);
    type YZ = { y: number; z: number };
    const depth = (p: YZ) => f.y * (p.y - pose.position.y) + f.z * (p.z - pose.position.z);
    const vert = (p: YZ) => u.y * (p.y - pose.position.y) + u.z * (p.z - pose.position.z);
    const keep: ((p: YZ) => number)[] = [
      (p) => tanV * depth(p) - vert(p), // 화면 위 끝 아래
      (p) => tanV * depth(p) + vert(p), // 화면 아래 끝 위
      (p) => depth(p) - NEAR // 카메라 앞
    ];
    let poly: YZ[] = [
      { y: box.minY, z: box.minZ },
      { y: box.minY, z: box.maxZ },
      { y: box.maxY, z: box.maxZ },
      { y: box.maxY, z: box.minZ }
    ];
    for (const g of keep) {
      const next: YZ[] = [];
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const ga = g(a);
        const gb = g(b);
        if (ga >= 0) next.push(a);
        if ((ga >= 0) !== (gb >= 0)) {
          const t = ga / (ga - gb);
          next.push({ y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
        }
      }
      poly = next;
    }
    return poly.flatMap((p) => [
      { x: box.minX, y: p.y, z: p.z },
      { x: box.maxX, y: p.y, z: p.z }
    ]);
  }

  // 결정 05-2(가): 화면 끝이 방의 가장 바깥만 넘지 않으면 되고, 위쪽 구석에 뒷벽 옆 검은 곳이 보이는 것은 괜찮다.
  // 12 확실한 문제 1: 화면 밖(아래)에 있는 방 모서리로 가로 제한을 계산하면, 화면에 보이는 방의 가장 바깥이 화면 끝보다 안쪽이라
  // 옆 가장자리가 위에서 아래까지 검다. 그래서 "가장 바깥"을 화면 세로 범위 안에 실제로 보이는 부분에서 구한다.
  it("S50 가로(13 결정 재현): 화면에 보이는 방이 화면 가로보다 넓으면, 보이는 방의 가장 바깥(양옆 벽 바깥면)이 화면 양 끝에 닿거나 넘는다(옆 가장자리가 위에서 아래까지 검지 않다)", () => {
    const box = roomEnds();
    const bad: string[] = [];
    // 가까이 당긴 거리에서 생기는 문제라, 공통 거리 여섯 개에 더해 가장 가까이~가장 멀리를 0.2 간격으로 훑는다.
    const fine: [string, number][] = [];
    for (let w = VIEW_WIDTH_MIN; w <= VIEW_WIDTH_MAX + 1e-9; w += 0.2) fine.push([`0.2 간격`, w]);
    const all = [
      ...cases(),
      ...screens.flatMap((screen) => fine.flatMap(([name, width]) => follow.map((p) => ({ screen, name, width, p }))))
    ];
    for (const c of all) {
      const pose = poseFor(c.p, c.width, c.screen);
      const points = visibleRoomPoints(pose, box);
      if (points.length === 0) {
        bad.push(`${caseLabel(c)} → 화면 세로 범위에 방이 보이지 않음`);
        continue;
      }
      const cam = camera(pose, c.screen);
      const xs = points.map((p) => cam.project(p).x);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      if (!(right - left > 2 + EPS)) continue;
      if (!(left <= -1 + EPS && right >= 1 - EPS)) {
        bad.push(`${caseLabel(c)} → 보이는 방 가로 ${left.toFixed(4)} ~ ${right.toFixed(4)}(화면 -1 ~ 1)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("S50 세로(13 결정, 05 결정 1): 방 상자가 세로로 다 들어오면 화면에서 방 위·아래 검은 여백의 높이가 같다", () => {
    const box = roomEnds();
    const bad: string[] = [];
    let checked = 0;
    for (const c of cases()) {
      const e = roomExtent(poseFor(c.p, c.width, c.screen), c.screen, box);
      const fits = !e.empty && !e.clipped && e.minY >= -1 - EPS && e.maxY <= 1 + EPS;
      if (!fits) continue;
      checked += 1;
      const top = 1 - e.maxY;
      const bottom = e.minY + 1;
      if (Math.abs(top - bottom) > EPS) bad.push(`${caseLabel(c)} → 위 여백 ${top.toFixed(6)}, 아래 여백 ${bottom.toFixed(6)}`);
    }
    // 가장 멀리에서는 방 전체가 보이므로(명세 3, T9) 세로로 다 들어오는 경우가 반드시 있다.
    expect(checked).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
