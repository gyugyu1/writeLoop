// [spec] qa 테스트(작업 058, 새 기능: 개발용 3D 로비 시험 화면의 동작 규칙).
// 기대값은 시나리오(private 작업 폴더 02-qa-scenarios.md)와 결정(03, 05)에서만 가져온다. 구현은 부르는 방법만 본다.
// 명세에 숫자가 없는 것(막힌 칸, 장소 앞 지점, 장소 중심, 벽 높이, 카메라 거리 범위)은 구현의 방 데이터를 입력으로 읽고,
// 명세의 성질(가구·방 밖을 지나지 않는다, 방 밖이 보이지 않는다)을 검사한다.
// 좌표(구현의 약속): 바닥 한 칸 = 1, x는 왼쪽→오른쪽(0..8), z는 뒷벽→앞(0..11). 바라보는 방향 0 = +z, atan2(dx, dz).
import {
  LobbySim,
  MARKS,
  ROOM,
  SOLID_TILES,
  VIEW_WIDTH_DEFAULT,
  VIEW_WIDTH_MAX,
  VIEW_WIDTH_MIN,
  clampCameraTarget,
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
    ["화분을 사이에 둔 위·아래", { x: 7.3, z: 2.5 }, { x: 7.3, z: 4.5 }, "7,4"]
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
    ["화분 칸", { x: 7.5, z: 3.5 }],
    ["창가 의자 칸", { x: 4.5, z: 0.5 }]
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

  it("S23(결정 5): 벽에 붙은 장소(게시판, 창가, 문)의 중심은 뒷벽 위(z = 0)에 있다", () => {
    expect([MARKS.board.faceTo.z, MARKS.window.faceTo.z, MARKS.door.faceTo.z]).toEqual([0, 0, 0]);
  });
});

describe("[spec] 카메라(S50, S51, 결정 10)", () => {
  // 카메라 모형(구현의 약속): 정사영, 화면 가로에 viewWidth 칸, 세로에 viewWidth × 높이/너비 칸이 보이고,
  // clampCameraTarget이 돌려준 바닥 점을 화면 가운데에 두고 42°로 내려다본다.
  const pitch = (ROOM.pitchDeg * Math.PI) / 180;
  const screens: [number, number][] = [
    [360, 640],
    [390, 844],
    [412, 915]
  ];
  const widths: [string, number][] = [
    ["가장 멀리", VIEW_WIDTH_MAX],
    ["기본값", VIEW_WIDTH_DEFAULT],
    ["가장 가까이", VIEW_WIDTH_MIN]
  ];
  const follow: FloorPoint[] = [
    { x: 0.6, z: 0.8 },
    { x: 7.4, z: 0.8 },
    { x: 0.6, z: 10.8 },
    { x: 7.4, z: 10.8 },
    { x: 4, z: 5.5 },
    ...MARK_IDS.flatMap((id) => MARKS[id].approach)
  ];

  type Hit = { surface: "floor" | "backWall"; x: number; y: number; z: number };

  /** 화면 네 모서리와 네 변 가운데에서 쏜 시선이 처음 닿는 곳(바닥 y=0 또는 뒷벽 z=0). */
  function screenHits(viewWidth: number, [w, h]: [number, number], follow: FloorPoint): Hit[] {
    const viewHeight = (viewWidth * h) / w;
    const t = clampCameraTarget(follow, viewWidth, viewHeight);
    const hits: Hit[] = [];
    for (const u of [-1, 0, 1]) {
      for (const v of [-1, 0, 1]) {
        if (u === 0 && v === 0) continue;
        const a = (u * viewWidth) / 2;
        const b = (v * viewHeight) / 2;
        // 화면 위 점의 시선: 지나는 점 + s × 앞 방향(0, -sin, -cos)
        const px = t.x + a;
        const py = b * Math.cos(pitch);
        const pz = t.z - b * Math.sin(pitch);
        const sFloor = py / Math.sin(pitch);
        const sWall = pz / Math.cos(pitch);
        if (sFloor <= sWall) hits.push({ surface: "floor", x: px, y: 0, z: pz - sFloor * Math.cos(pitch) });
        else hits.push({ surface: "backWall", x: px, y: py - sWall * Math.sin(pitch), z: 0 });
      }
    }
    return hits;
  }

  const cases = screens.flatMap((screen) =>
    widths.flatMap(([name, width]) => follow.map((p) => ({ screen, name, width, p })))
  );

  it("S50: 어느 화면·거리·위치에서도 화면 가장자리가 양옆 벽 너머나 뒷벽 위 빈 곳에 닿지 않는다", () => {
    const bad: string[] = [];
    for (const { screen, name, width, p } of cases) {
      for (const hit of screenHits(width, screen, p)) {
        const ok = hit.x >= 0 && hit.x <= ROOM.width && (hit.surface === "floor" || (hit.y >= 0 && hit.y <= ROOM.wallHeight));
        if (!ok) bad.push(`${screen.join("x")} ${name} (${p.x},${p.z}) → ${hit.surface} (${hit.x.toFixed(2)}, ${hit.y.toFixed(2)}, ${hit.z.toFixed(2)})`);
      }
    }
    expect(bad).toEqual([]);
  });

  // 앞쪽 경계는 결정 07-1(사용자 결정, 명세를 바꿈)을 따른다: 걸을 수 없는 바닥을 앞쪽에 이어 깔아도 되고,
  // 그린 바닥 끝(z = 24)과 그 너머 빈 곳만 보이지 않으면 된다. 처음에는 시나리오 S50대로 z = 11이었다.
  const DRAWN_FLOOR_FRONT_Z = 24;

  it("S50(결정 07-1): 어느 화면·거리·위치에서도 화면 아래가 그린 바닥 앞 끝(z = 24) 너머에 닿지 않는다", () => {
    const bad: string[] = [];
    for (const { screen, name, width, p } of cases) {
      for (const hit of screenHits(width, screen, p)) {
        if (hit.surface === "floor" && (hit.z < 0 || hit.z > DRAWN_FLOOR_FRONT_Z)) {
          bad.push(`${screen.join("x")} ${name} (${p.x},${p.z}) → z ${hit.z.toFixed(2)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("S51: 내려다보는 각이 42°다", () => {
    expect(ROOM.pitchDeg).toBe(42);
  });
});
