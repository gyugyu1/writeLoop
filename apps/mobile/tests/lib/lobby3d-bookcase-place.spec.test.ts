// [spec] qa 테스트(작업 062, 기능 변경: 모바일 홈 로비에 책장 장소 "학습 기록"을 더함).
// 기대값은 명세(private 작업 폴더 062-2026-11-08-모바일-로비-책장-학습기록/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작은 고치기 전 코드(b705103)의 동작을 기록한다. 구현 코드는 부르는 방법(LobbySim, MARKS, markZoneAt, isFree, findPath,
// FURNITURE_LAYOUT)을 알려고만 읽었다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): B1~B12.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K1, K2.
// 명세에 없는 이름·숫자는 이렇게 다룬다(02-qa-tests.md "가정"):
// - 책장 장소의 id는 구현이 정하므로 쓰지 않고, 이름표가 "학습 기록"인 장소를 찾는다.
// - 서는 자리 좌표는 명세에 "책장 앞"만 있어 구현의 값을 입력으로 읽고, 책장 앞인지(책장 칸 "0,2"의 줄 z 2~3, 책장 앞쪽 x 1~2.5,
//   설 수 있는 자리)를 검사한다. 책장 가구 자리(x 0.44, z 2.5, 앞면 +x)는 지금 그대로다(K2).
// - 구역 모양은 명세 1("게시판·창가처럼 벽까지 이어진다", 061 13 결정)대로 서는 자리 가운데에서 바라볼 지점까지 잇는 선에서 1칸 안으로
//   이 테스트가 계산한다. 바라볼 지점은 구현의 값을 읽고, 책장(벽) 쪽인지(x 0~0.44, z 2~3)를 검사한다.
// - 다른 네 장소의 구역은 061 테스트(lobby3d-place-zone.spec.test.ts)와 같은 값이다.
// - 구역 경계 근처는 판정이 갈리므로 보지 않는다: 확실히 안 = 0.9칸 안, 확실히 밖 = 1.1칸 밖, 겹치는 곳은 두 거리 차이가 0.1칸 넘을 때만 본다.
// 03 결정(2026-11-08): 명세 2에서 "이름표를 누르면"을 뺐다. 책장은 가구를 누를 때만 걸어간다(B3). 이름표가 누르기를 받지 않는 것은 화면 테스트 C2·K3가 본다.
// 좌표(구현의 약속): 바닥 한 칸 = 1, x는 왼쪽→오른쪽(0..8), z는 뒷벽→앞(0..11). 바라보는 방향 0 = +z, atan2(dx, dz).
// 066-②(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서 바닥 가구 모델이 칸에 맞게 줄고 뒷면이 칸 뒤 끝에 붙어, 명세의 "고칠 기존 테스트"대로
// 책장·옷장 그림 자리의 기대값만 새 자리(뒤로 0.06 → 칸 뒤 끝에서 0.876/2 앞, 벽 가까이 0.44 → 0.438, 7.56 → 7.562)로 고쳤다.
import { FURNITURE_LAYOUT } from "@/lib/lobby3d/furniture-layout";
import {
  LobbySim,
  MARKS,
  ROOM,
  SOLID_TILES,
  findPath,
  isFree,
  markZoneAt,
  type FloorPoint,
  type MarkId,
  type MarkInfo,
  type PointerHit
} from "@/lib/lobby3d/engine";

const STEP_S = 0.05;
const STEP_MS = 50;
const OLD_IDS: MarkId[] = ["board", "window", "desk", "door"];

// ---------- 명세의 값 ----------

const BOOK_LABEL = "학습 기록";
const BOOK_PROMPT = "지금까지 쓴 기록이 모여 있어.\n기록을 볼까?";
const BOOK_BUTTON = "들어가기";
/** 책장 가구 자리(지금 그대로, K2). */
const BOOKCASE_SPOT = { x: 0.438, z: 2.5 };
/** 지금 도착했을 때 바라보는 정도(작업 058 S23과 같은 허용치). */
const FACE_TOLERANCE = 0.15;
/**
 * 오래 걸리는 테스트의 시간 제한(062 08 결정: 단언과 입력은 그대로 두고 시간 제한만 늘림). 바닥 격자에서 자리를 찾거나 격자 전체를 보는 테스트는
 * 따로 돌려도 1~4초 걸려, 모바일 테스트 전체와 함께 돌리면 Jest 기본 5초를 넘을 수 있다.
 */
const SLOW_TEST_MS = 20_000;

/** 다른 네 장소의 구역(061 명세 1·03·13 결정): 가운데, 벽에 붙은 장소는 벽 위의 점까지. */
const OLD_ZONE: Record<"board" | "window" | "desk" | "door", { center: FloorPoint; wall: FloorPoint | null }> = {
  board: { center: { x: 1.9, z: 1.3 }, wall: { x: 1.8, z: 0 } },
  window: { center: { x: 4.8, z: 1.55 }, wall: { x: 4.8, z: 0 } },
  desk: { center: { x: 1.5, z: 6.75 }, wall: null },
  door: { center: { x: 4.0, z: 10.5 }, wall: null }
};

let now = 1_000_000;

beforeEach(() => {
  now = 1_000_000;
});

// ---------- 도우미 ----------

/** 이름표가 "학습 기록"인 장소. 없거나 둘 이상이면 실패한다. */
function bookcase(): MarkInfo {
  const found = Object.values(MARKS).filter((mark) => mark.label === BOOK_LABEL);
  expect(found.map((mark) => mark.label)).toEqual([BOOK_LABEL]);
  return found[0];
}

function distance(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distanceToSegment(p: FloorPoint, a: FloorPoint, b: FloorPoint) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq));
  return distance(p, { x: a.x + dx * t, z: a.z + dz * t });
}

function centerOf(points: FloorPoint[]): FloorPoint {
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length
  };
}

/** 책장 구역: 서는 자리 가운데에서 바라볼 지점(벽 쪽)까지 잇는 선(명세 1). */
function bookZone() {
  const book = bookcase();
  return { id: book.id, center: centerOf(book.approach), wall: book.faceTo };
}

/** 장소마다 구역까지의 거리(1 이하면 구역 안). 다섯 장소. */
function zoneDistances(p: FloorPoint): { id: MarkId; d: number }[] {
  const list = OLD_IDS.map((id) => {
    const zone = OLD_ZONE[id as keyof typeof OLD_ZONE];
    return { id, d: zone.wall ? distanceToSegment(p, zone.center, zone.wall) : distance(p, zone.center) };
  });
  const book = bookZone();
  list.push({ id: book.id, d: distanceToSegment(p, book.center, book.wall) });
  return list;
}

/**
 * 명세대로 이 자리에서 안내가 떠야 하는 장소(구역 안이면 그 장소, 겹치면 더 가까운 장소). 어느 구역에서도 1.1칸 밖이면 null,
 * 경계 근처이거나 겹치는 곳에서 두 거리 차이가 0.1칸 안이면 "edge"(보지 않음).
 */
function expectedPlace(p: FloorPoint): MarkId | null | "edge" {
  const sorted = zoneDistances(p).sort((a, b) => a.d - b.d);
  const [first, second] = sorted;
  if (first.d > 1.1) return null;
  if (first.d >= 0.9) return "edge";
  if (second.d - first.d < 0.1) return "edge";
  return first.id;
}

function inNoZone(p: FloorPoint) {
  return zoneDistances(p).every((zone) => zone.d > 1.1);
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

function tap(sim: LobbySim, hit: PointerHit) {
  sim.pointerDown(hit, 100, 100, now);
  const result = sim.pointerUp(now + 100);
  now += 100;
  return result;
}

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

function walkToFloor(sim: LobbySim, p: FloorPoint) {
  expect(tap(sim, floorHit(p))).toBe("walk");
  expect(runUntil(sim, 15, () => isStoppedAt(sim, p))).toBe(true);
}

/** 방 바닥 위 점들(0.05칸 간격). */
function floorGrid(step = 0.05): FloorPoint[] {
  const points: FloorPoint[] = [];
  for (let x = 0.25; x <= ROOM.width - 0.25 + 1e-9; x += step) {
    for (let z = 0.45; z <= ROOM.depth - 0.05 + 1e-9; z += step) points.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }
  return points;
}

/** 조건을 만족하는 설 수 있는 자리 중 점수가 가장 높은 곳. 없으면 null. */
function bestFreePoint(score: (p: FloorPoint) => number): FloorPoint | null {
  let best: FloorPoint | null = null;
  let bestScore = 0;
  for (const p of floorGrid()) {
    if (!isFree(p.x, p.z)) continue;
    const s = score(p);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

function distOf(p: FloorPoint, id: MarkId) {
  return zoneDistances(p).find((zone) => zone.id === id)!.d;
}

function othersThan(p: FloorPoint, ids: MarkId[]) {
  return zoneDistances(p).filter((zone) => !ids.includes(zone.id));
}

/** 책장 구역 한가운데 쪽(다른 구역에서 1.1칸 넘게 떨어진) 자리. */
function bookInsidePoint(): FloorPoint {
  const book = bookZone();
  const p = bestFreePoint((q) => {
    if (othersThan(q, [book.id]).some((zone) => zone.d <= 1.1)) return 0;
    return 0.6 - distOf(q, book.id);
  });
  expect(p).not.toBeNull();
  return p!;
}

/** 책장 벽 쪽 자리: 서는 자리 가운데에서 1.1칸 넘게 떨어졌지만 벽까지 잇는 선에서 0.9칸 안(원이었다면 밖). */
function bookWallSidePoint(): FloorPoint {
  const book = bookZone();
  const p = bestFreePoint((q) => {
    if (othersThan(q, [book.id]).some((zone) => zone.d <= 1.1)) return 0;
    return Math.min(distance(q, book.center) - 1.1, 0.9 - distOf(q, book.id));
  });
  expect(p).not.toBeNull();
  return p!;
}

/** 게시판·책장 구역이 겹치는 곳에서, nearer 쪽이 다른 쪽보다 0.1칸 넘게 가까운 자리(두 거리 모두 0.9칸 안, 나머지 구역에서 1.1칸 밖). */
function overlapPoint(nearer: "board" | "book"): FloorPoint {
  const book = bookZone();
  const p = bestFreePoint((q) => {
    if (othersThan(q, ["board", book.id]).some((zone) => zone.d <= 1.1)) return 0;
    const dBoard = distOf(q, "board");
    const dBook = distOf(q, book.id);
    const gap = nearer === "board" ? dBook - dBoard : dBoard - dBook;
    return Math.min(0.9 - dBoard, 0.9 - dBook, gap - 0.1);
  });
  expect(p).not.toBeNull();
  return p!;
}

/**
 * 걷거나 끌려 가는 중(moving) 프레임마다 명세대로인지 본다. 안내가 떠야 할 장소가 있으면 그 장소 안내·버튼·누르면 안내, 없으면 말풍선이 숨는다.
 * 어긋난 프레임을 글로 모으고, 장소별로 움직이는 중에 안내가 떠야 했던 프레임 수를 센다.
 */
function frameChecker(sim: LobbySim) {
  const problems: string[] = [];
  const movingIn: Partial<Record<MarkId, number>> = {};
  const check = () => {
    const snap = sim.snapshot(now);
    if (!snap.moving) return;
    const want = expectedPlace({ x: sim.x, z: sim.z });
    if (want === "edge") return;
    const where = `(${sim.x.toFixed(2)}, ${sim.z.toFixed(2)})`;
    if (want) {
      movingIn[want] = (movingIn[want] ?? 0) + 1;
      const got = { bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() };
      const expected = { bubbleText: MARKS[want].prompt, bubbleButton: MARKS[want].buttonLabel, enterMessage: MARKS[want].enterMessage };
      if (JSON.stringify(got) !== JSON.stringify(expected)) problems.push(`${where} ${want} 안내여야 함: ${JSON.stringify(got)}`);
    } else if (snap.bubbleText !== "" || snap.bubbleButton !== null) {
      problems.push(`${where} 구역 밖 이동 중: ${JSON.stringify({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton })}`);
    }
  };
  return { check, problems, movingIn };
}

/** 어느 구역에도 들지 않는 출발점(책장·게시판 구역 아래쪽 열린 바닥). */
const START = { x: 3.5, z: 3.5 };

// ---------- 바뀔 동작 ----------

describe("[spec] 작업 062 바뀔 동작: 책장이 장소 '학습 기록'이 된다(명세 1)", () => {
  it("B1: 장소가 다섯이다(기존 넷과 이름표가 '학습 기록'인 장소). 책장 장소의 말풍선은 '지금까지 쓴 기록이 모여 있어.\\n기록을 볼까?'와 '들어가기' 버튼이다", () => {
    const ids = Object.keys(MARKS);
    expect(ids).toHaveLength(5);
    expect(OLD_IDS.every((id) => ids.includes(id))).toBe(true);
    const book = bookcase();
    expect(OLD_IDS).not.toContain(book.id);
    expect(MARKS[book.id]).toBe(book);
    expect({ label: book.label, prompt: book.prompt, buttonLabel: book.buttonLabel }).toEqual({
      label: BOOK_LABEL,
      prompt: BOOK_PROMPT,
      buttonLabel: BOOK_BUTTON
    });
  });

  it("B2: 서는 자리는 책장 앞(책장 칸 \"0,2\"의 줄 z 2~3, 책장 앞쪽 x 1~2.5)의 설 수 있는 자리이고, 바라볼 지점은 책장(벽) 쪽(x 0~0.44, z 2~3)이다", () => {
    const book = bookcase();
    expect(book.approach.length).toBeGreaterThan(0);
    const bad = book.approach.filter((p) => !(isFree(p.x, p.z) && p.x > 1 && p.x <= 2.5 && p.z >= 2 && p.z <= 3));
    expect(bad).toEqual([]);
    const f = book.faceTo;
    expect({ x: f.x >= 0 && f.x <= BOOKCASE_SPOT.x, z: f.z >= 2 && f.z <= 3 }).toEqual({ x: true, z: true });
  });

  it("B3(03 결정: 가구를 누를 때만 걸어감): 책장(가구)을 누르면 그 장소로 간다(가구 자리의 장소가 책장 장소이고, 누르면 움직이지 않는 가구가 아니다)", () => {
    const book = bookcase();
    const pieces = FURNITURE_LAYOUT.filter((place) => place.piece === "bookcase");
    expect(pieces).toHaveLength(1);
    expect({ mark: pieces[0].mark ?? null, blocker: pieces[0].blocker ?? false }).toEqual({ mark: book.id, blocker: false });
  });
});

describe("[spec] 작업 062 바뀔 동작: 책장도 다른 장소와 똑같이 움직인다(명세 2)", () => {
  it("B4: 책장을 누르면 가구 칸·방 밖을 지나지 않고 책장 앞 서는 자리에 도착해 책장 쪽을 바라보고, 책장 안내와 '들어가기' 버튼이 나온다", () => {
    const book = bookcase();
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const throughFurniture: string[] = [];

    expect(tap(sim, markHit(book.id))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => sim.arrived === book.id && sim.vx === 0 && sim.vz === 0,
        () => {
          if (SOLID_TILES.has(`${Math.floor(sim.x)},${Math.floor(sim.z)}`)) throughFurniture.push(`(${sim.x.toFixed(2)},${sim.z.toFixed(2)})`);
        }
      )
    ).toBe(true);
    run(sim, 3);

    expect(throughFurniture).toEqual([]);
    const nearest = Math.min(...book.approach.map((a) => distance(a, { x: sim.x, z: sim.z })));
    expect(nearest).toBeLessThan(0.06);
    expect(angleDiff(sim.heading, Math.atan2(book.faceTo.x - sim.x, book.faceTo.z - sim.z))).toBeLessThanOrEqual(FACE_TOLERANCE);
    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, place: snap.place, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      arrived: book.id,
      place: book.id,
      bubbleText: BOOK_PROMPT,
      bubbleButton: BOOK_BUTTON,
      enterMessage: book.enterMessage
    });
  });

  it("B5: 방 안 아무 바닥 칸에서 책장으로 가는 길이 있고, 누르면 가구 칸을 지나지 않고 책장에 도착한다", () => {
    const book = bookcase();
    const noPath: string[] = [];
    const notArrived: string[] = [];
    const throughFurniture = new Set<string>();
    for (let c = 0; c < ROOM.width; c += 1) {
      for (let r = 0; r < ROOM.depth; r += 1) {
        const key = `${c},${r}`;
        if (SOLID_TILES.has(key)) continue;
        const center = { x: c + 0.5, z: r + 0.5 };
        if (!isFree(center.x, center.z)) continue;
        if (!findPath(center, book.approach)) {
          noPath.push(key);
          continue;
        }
        const sim = new LobbySim(center);
        tap(sim, markHit(book.id));
        const ok = runUntil(sim, 30, () => sim.arrived === book.id, () => {
          if (SOLID_TILES.has(`${Math.floor(sim.x)},${Math.floor(sim.z)}`)) throughFurniture.add(key);
        });
        if (!ok) notArrived.push(key);
      }
    }
    expect({ noPath, notArrived, throughFurniture: [...throughFurniture] }).toEqual({ noPath: [], notArrived: [], throughFurniture: [] });
  });

  it("B6: 바닥을 눌러 책장 구역 안(다른 구역과 떨어진 곳)에 멈추면 책장에 도착해 책장 쪽으로 돌아서고, 책장 안내와 버튼이 나온다", () => {
    const book = bookcase();
    const point = bookInsidePoint();
    expect(inNoZone(START)).toBe(true);
    const sim = new LobbySim(START);

    walkToFloor(sim, point);
    run(sim, 3);

    expect(angleDiff(sim.heading, Math.atan2(book.faceTo.x - point.x, book.faceTo.z - point.z))).toBeLessThanOrEqual(FACE_TOLERANCE);
    const snap = sim.snapshot(now);
    expect({ point, arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      point,
      arrived: book.id,
      bubbleText: BOOK_PROMPT,
      bubbleButton: BOOK_BUTTON,
      enterMessage: book.enterMessage
    });
  }, SLOW_TEST_MS);

  it("B7: 책장 구역은 벽까지 이어진다. 서는 자리 가운데에서 1.1칸 넘게 떨어진 벽 쪽 자리라도 벽까지 잇는 선에서 0.9칸 안이면, 바닥을 눌러 멈췄을 때 책장 안내와 버튼이 나온다", () => {
    const book = bookcase();
    const point = bookWallSidePoint();
    const sim = new LobbySim(START);

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ point, arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton }).toEqual({
      point,
      arrived: book.id,
      bubbleText: BOOK_PROMPT,
      bubbleButton: BOOK_BUTTON
    });
  }, SLOW_TEST_MS);

  it("B8: 책장을 눌러 걸어가는 동안, 책장 구역에 들어서면 걷는 중에도 책장 안내와 버튼이 보이고, 구역 밖에서는 말풍선이 숨는다(다른 구역을 지나면 그 장소 안내)", () => {
    const book = bookcase();
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const frame = frameChecker(sim);

    expect(tap(sim, markHit(book.id))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => sim.arrived === book.id && sim.vx === 0 && sim.vz === 0,
        () => {
          if (!(sim.vx === 0 && sim.vz === 0)) frame.check();
        }
      )
    ).toBe(true);

    expect(frame.movingIn[book.id] ?? 0).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
  });

  it("B9: 책장 쪽으로 손을 떼지 않고 끌면, 구역 밖에서는 말풍선이 숨고, 책장 구역에 들어서면(책장 앞에 막혀 서 있어도) 책장 안내·버튼이 보이고 누르면 책장 안내다", () => {
    const book = bookcase();
    const start = { x: 3.5, z: 2.5 };
    expect(inNoZone(start)).toBe(true);
    const sim = new LobbySim(start);
    const frame = frameChecker(sim);
    const finger = { x: 0.5, z: 2.5 }; // 책장 칸
    sim.pointerDown(floorHit(finger), 100, 100, now);
    sim.pointerMove(floorHit(finger), 160, 100);
    expect(sim.dragging).toBe(true);

    run(sim, 3, frame.check);

    expect(sim.dragging).toBe(true);
    expect(expectedPlace({ x: sim.x, z: sim.z })).toBe(book.id);
    expect(frame.movingIn[book.id] ?? 0).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
    const snap = sim.snapshot(now);
    expect({ bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, place: snap.place, enterMessage: sim.enterMessage() }).toEqual({
      bubbleText: BOOK_PROMPT,
      bubbleButton: BOOK_BUTTON,
      place: book.id,
      enterMessage: book.enterMessage
    });
  });
});

describe("[spec] 작업 062 바뀔 동작: 게시판·책장 구역이 겹치는 곳에서는 더 가까운 장소(명세 5)", () => {
  it("B10: 게시판과 책장 구역(각 1칸)이 일부 겹친다(두 구역 모두에서 0.95칸 안인 설 수 있는 자리가 있다)", () => {
    const book = bookZone();
    const shared = floorGrid().filter((p) => isFree(p.x, p.z) && distOf(p, "board") < 0.95 && distOf(p, book.id) < 0.95);
    expect(shared.length).toBeGreaterThan(0);
  }, SLOW_TEST_MS);

  it("B11: 겹치는 곳에서 장소 판정(markZoneAt)은 구역 모양까지의 거리가 더 가까운 장소이고, 책장 구역에만 드는 곳은 책장이다", () => {
    const book = bookZone();
    const wrong: string[] = [];
    let overlapCount = 0;
    let bookOnlyCount = 0;
    for (const p of floorGrid()) {
      const dBoard = distOf(p, "board");
      const dBook = distOf(p, book.id);
      const others = othersThan(p, ["board", book.id]);
      if (others.some((zone) => zone.d <= 1.1)) continue;
      let want: MarkId | null = null;
      if (dBoard < 0.9 && dBook < 0.9 && Math.abs(dBoard - dBook) > 0.1) {
        want = dBoard < dBook ? "board" : book.id;
        overlapCount += 1;
      } else if (dBook < 0.9 && dBoard > 1.1) {
        want = book.id;
        bookOnlyCount += 1;
      } else continue;
      const got = markZoneAt(p.x, p.z);
      if (got !== want) wrong.push(`(${p.x},${p.z}) 기대 ${want} 실제 ${got}`);
    }
    expect(overlapCount).toBeGreaterThan(0);
    expect(bookOnlyCount).toBeGreaterThan(0);
    expect({ count: wrong.length, first: wrong.slice(0, 8) }).toEqual({ count: 0, first: [] });
  }, SLOW_TEST_MS);

  const NEARER: ["board" | "book"][] = [["board"], ["book"]];

  it.each(NEARER)("B12: 바닥을 눌러 겹치는 곳 중 %s 쪽이 더 가까운 자리에 멈추면 그 장소에 도착하고 그 장소 안내가 나온다", (nearer) => {
    const book = bookcase();
    const id = nearer === "board" ? "board" : book.id;
    const point = overlapPoint(nearer);
    const sim = new LobbySim(START);

    walkToFloor(sim, point);
    run(sim, 0.5);

    const snap = sim.snapshot(now);
    expect({ point, arrived: snap.arrived, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton, enterMessage: sim.enterMessage() }).toEqual({
      point,
      arrived: id,
      bubbleText: MARKS[id].prompt,
      bubbleButton: MARKS[id].buttonLabel,
      enterMessage: MARKS[id].enterMessage
    });
  }, SLOW_TEST_MS);

  it("B12 이동: 게시판 서는 자리에서 책장 구역 안 자리로 걸어가는 동안, 프레임마다 더 가까운 장소의 안내가 보인다(겹치는 곳 포함)", () => {
    const book = bookcase();
    const start = { x: 1.9, z: 1.3 };
    expect(expectedPlace(start)).toBe("board");
    const goal = bookInsidePoint();
    const sim = new LobbySim(start);
    const frame = frameChecker(sim);

    expect(tap(sim, floorHit(goal))).toBe("walk");
    expect(
      runUntil(
        sim,
        15,
        () => isStoppedAt(sim, goal),
        () => {
          if (!isStoppedAt(sim, goal)) frame.check();
        }
      )
    ).toBe(true);

    expect(frame.movingIn[book.id] ?? 0).toBeGreaterThan(0);
    expect(frame.problems).toEqual([]);
  }, SLOW_TEST_MS);
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 작업 062 그대로 둘 동작", () => {
  it("K1: 책장 둘레(책장 줄 x 0~2.5, z 2~3에서 1.3칸 안) 밖에서는 장소 판정(markZoneAt)이 기존 네 장소의 구역 그대로다", () => {
    const nearBookcase = (p: FloorPoint) => {
      const dx = Math.max(0 - p.x, 0, p.x - 2.5);
      const dz = Math.max(2 - p.z, 0, p.z - 3);
      return Math.hypot(dx, dz) <= 1.3;
    };
    const wrong: string[] = [];
    let checked = 0;
    for (const p of floorGrid(0.1)) {
      if (nearBookcase(p)) continue;
      const distances = OLD_IDS.map((id) => {
        const zone = OLD_ZONE[id as keyof typeof OLD_ZONE];
        return { id, d: zone.wall ? distanceToSegment(p, zone.center, zone.wall) : distance(p, zone.center) };
      });
      const inside = distances.filter((zone) => zone.d < 0.95);
      const want = inside.length === 1 ? inside[0].id : distances.every((zone) => zone.d > 1.05) ? null : "edge";
      if (want === "edge") continue;
      checked += 1;
      const got = markZoneAt(p.x, p.z);
      if (got !== want) wrong.push(`(${p.x},${p.z}) 기대 ${want} 실제 ${got}`);
    }
    expect(checked).toBeGreaterThan(1000);
    expect({ count: wrong.length, first: wrong.slice(0, 8) }).toEqual({ count: 0, first: [] });
  });

  it("K2: 책장 가구는 왼쪽 벽 x 0.438, z 2.5에 앞면이 방 쪽(+x)을 보게 그대로 있고, 책장 칸 \"0,2\"는 지나갈 수 없다", () => {
    const pieces = FURNITURE_LAYOUT.filter((place) => place.piece === "bookcase");
    expect(pieces).toHaveLength(1);
    expect({ x: pieces[0].x, y: pieces[0].y, z: pieces[0].z, rotY: pieces[0].rotY }).toEqual({ x: 0.438, y: 0, z: 2.5, rotY: Math.PI / 2 });
    expect(SOLID_TILES.has("0,2")).toBe(true);
  });
});
