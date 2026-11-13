// [spec] qa 테스트(작업 089 ③ 옷장 장소와 캐릭터 꾸미기 화면, 새 기능, 모바일): 방의 옷장이 장소가 되는 규칙(엔진).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/02-qa-scenarios.md의 P2·P4~P9·P12·P13)와
// 03-main-decision.md B(1: 옷장 가구를 누르면 걸어간다, 2: 손님 말풍선은 로비 화면의 signedIn이 false일 때,
// 8: 옷장 구역은 다른 장소와 같이 서는 자리에서 옷장까지 이어지는 모양), 06-main-decision.md(사용자 결정: 로그인한 사용자의 옷장 말풍선은
// 대사 없이 '들어가기' 버튼만, 손님 말풍선은 그대로)에서만 가져온다. 06 결정에 따라 시나리오의 대사 "옷장이야.\n옷을 갈아입어 볼까?"는 빈 글로 옮겼다.
// 구현 커밋 fefbafa에서 읽은 것은 부르는 방법뿐이다: applyLobbyLayout, roomPlaceIds, activePlaceIds, applyArea, markInfo,
// setClosetSignedIn, LobbySim(pointerDown·pointerUp·update·snapshot·arrived·heading), isFree, PointerHit.
// 옷장 장소의 id는 쓰지 않고 이름표 "옷장"인 방의 장소로 찾는다(시나리오 "용어와 가정").
// 서는 자리 "옷장 앞 한 칸"은 옷장 칸에서 앞면 쪽으로 붙은 칸(가로 1×세로 1) 안의 설 수 있는 자리인지로 본다.
// 바라보는 방향은 서는 자리에서 옷장 칸 가운데로 향한 방향과 0.15 라디안 안이다(atan2(dx, dz), 0 = +z).
import {
  LobbySim,
  activePlaceIds,
  applyArea,
  applyLobbyLayout,
  isFree,
  markInfo,
  roomPlaceIds,
  setClosetSignedIn,
  type FloorPoint,
  type PlaceId,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

const STEP_S = 0.05;
const STEP_MS = 50;
const FACE_TOLERANCE = 0.15;
const CLOSET_LABEL = "옷장";
/** 06 결정: 로그인한 사용자의 옷장 말풍선은 대사가 없다(버튼 '들어가기'만). */
const CLOSET_PROMPT = "";
const CLOSET_BUTTON = "들어가기";
const GUEST_PROMPT = "로그인하면 라룹이 옷을\n갈아입힐 수 있어";

// ---------- 시나리오의 배치 값 ----------

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** L0의 옷장 대신 이 자리에 둔 배치. */
function withWardrobe(floor: { x: number; z: number; facing: 0 | 1 | 2 | 3 }): LobbyLayout {
  const items = copy(DEFAULT_LOBBY_LAYOUT.items).map((item: FurnitureItem) => (item.id === "wardrobe" ? { ...item, floor } : item));
  return makeLayout(items, []);
}

const L0 = () => copy(DEFAULT_LOBBY_LAYOUT);
const L_MOVE = () => withWardrobe({ x: 6.5, z: 7.5, facing: 3 });
const L_TURN = () => withWardrobe({ x: 6.5, z: 7.5, facing: 0 });
const L_TWO = () =>
  makeLayout([...copy(DEFAULT_LOBBY_LAYOUT.items), { id: "wardrobe-2", type: "wardrobe", floor: { x: 6.5, z: 7.5, facing: 3 } }], []);
const L_STORED = () =>
  makeLayout(
    copy(DEFAULT_LOBBY_LAYOUT.items).filter((item: FurnitureItem) => item.id !== "wardrobe"),
    [{ id: "wardrobe", type: "wardrobe" }]
  );

/** 앞 한 칸(칸 "열,행")과 옷장 칸 가운데. */
interface Front {
  cell: [number, number];
  wardrobe: FloorPoint;
}
const FRONT_L0: Front = { cell: [6, 3], wardrobe: { x: 7.5, z: 3.5 } };
const FRONT_MOVE: Front = { cell: [5, 7], wardrobe: { x: 6.5, z: 7.5 } };
const FRONT_TURN: Front = { cell: [6, 8], wardrobe: { x: 6.5, z: 7.5 } };

let now = 1_000_000;

beforeEach(() => {
  now = 1_000_000;
  applyArea("room");
  setClosetSignedIn(true);
});

afterEach(() => {
  setClosetSignedIn(true);
  applyArea("room");
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

// ---------- 도우미 ----------

/** 이름표가 "옷장"인 지금 방의 장소들. */
function closets(): PlaceId[] {
  return roomPlaceIds().filter((id) => markInfo(id).label === CLOSET_LABEL);
}

function angleDiff(a: number, b: number) {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
}

function tap(sim: LobbySim, hit: PointerHit) {
  sim.pointerDown(hit, 100, 100, now);
  const result = sim.pointerUp(now + 100);
  now += 100;
  return result;
}

function run(sim: LobbySim, seconds: number) {
  const count = Math.round(seconds / STEP_S);
  for (let i = 0; i < count; i += 1) {
    now += STEP_MS;
    sim.update(STEP_S, now);
  }
}

function runUntil(sim: LobbySim, maxSeconds: number, done: () => boolean) {
  const start = now;
  while (!done() && now - start < maxSeconds * 1000) run(sim, STEP_S);
  return done();
}

/** 옷장(가구)을 눌러 도착할 때까지 걷고, 돌아서는 시간을 조금 더 준다. */
function pressAndArrive(sim: LobbySim, id: PlaceId) {
  expect(tap(sim, { point: null, mark: id, onCharacter: false })).toBe("walk");
  expect(runUntil(sim, 20, () => sim.arrived === id && sim.vx === 0 && sim.vz === 0)).toBe(true);
  run(sim, 2);
}

/** 도착한 자리가 앞 한 칸 안의 설 수 있는 자리이고, 옷장 칸 가운데를 바라보는지. */
function standsInFront(sim: LobbySim, front: Front) {
  const [c, r] = front.cell;
  return {
    inCell: sim.x >= c && sim.x <= c + 1 && sim.z >= r && sim.z <= r + 1,
    free: isFree(sim.x, sim.z),
    facing: angleDiff(sim.heading, Math.atan2(front.wardrobe.x - sim.x, front.wardrobe.z - sim.z)) <= FACE_TOLERANCE
  };
}

const IN_FRONT = { inCell: true, free: true, facing: true };

function bubble(sim: LobbySim) {
  const snap = sim.snapshot(now);
  return { place: snap.place, bubbleText: snap.bubbleText, bubbleButton: snap.bubbleButton };
}

// ---------- P. 방의 옷장이 장소가 된다 ----------

describe("[spec] 089-③ P: 옷장을 누르면 옷장 앞 한 칸으로 걸어가 옷장을 바라보고 말풍선을 띄운다", () => {
  it("P2: 처음 배치(L0)에서 옷장을 누르면 칸 6,3 안의 설 수 있는 자리에 멈춰 +x(옷장)를 바라보고, 말풍선이 대사 없이 '들어가기'만이다(06 결정)", () => {
    applyLobbyLayout(L0());
    const ids = closets();
    expect(ids).toHaveLength(1);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    pressAndArrive(sim, ids[0]);
    expect(standsInFront(sim, FRONT_L0)).toEqual(IN_FRONT);
    expect(angleDiff(sim.heading, Math.PI / 2)).toBeLessThanOrEqual(FACE_TOLERANCE);
    expect(bubble(sim)).toEqual({ place: ids[0], bubbleText: CLOSET_PROMPT, bubbleButton: CLOSET_BUTTON });
  });

  it("P4: 옷장을 (6.5, 7.5) 앞면 -x로 옮기면(L-move) 칸 5,7 안에 멈춰 +x를 바라보고, 말풍선이 P2와 같다", () => {
    applyLobbyLayout(L_MOVE());
    const ids = closets();
    expect(ids).toHaveLength(1);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    pressAndArrive(sim, ids[0]);
    expect(standsInFront(sim, FRONT_MOVE)).toEqual(IN_FRONT);
    expect(angleDiff(sim.heading, Math.PI / 2)).toBeLessThanOrEqual(FACE_TOLERANCE);
    expect(bubble(sim)).toEqual({ place: ids[0], bubbleText: CLOSET_PROMPT, bubbleButton: CLOSET_BUTTON });
  });

  it("P5: 같은 자리에서 앞면을 +z로 돌리면(L-turn) 칸 6,8 안에 멈춰 -z(±π)를 바라보고, 말풍선이 P2와 같다", () => {
    applyLobbyLayout(L_TURN());
    const ids = closets();
    expect(ids).toHaveLength(1);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    pressAndArrive(sim, ids[0]);
    expect(standsInFront(sim, FRONT_TURN)).toEqual(IN_FRONT);
    expect(angleDiff(sim.heading, Math.PI)).toBeLessThanOrEqual(FACE_TOLERANCE);
    expect(bubble(sim)).toEqual({ place: ids[0], bubbleText: CLOSET_PROMPT, bubbleButton: CLOSET_BUTTON });
  });

  it("P6: L0을 넣은 뒤 배치를 L-move로 바꾸면 옷장을 눌렀을 때 옛 자리(칸 6,3)가 아니라 칸 5,7 안에 멈춘다", () => {
    applyLobbyLayout(L0());
    expect(closets()).toHaveLength(1);
    applyLobbyLayout(L_MOVE());
    const ids = closets();
    expect(ids).toHaveLength(1);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    pressAndArrive(sim, ids[0]);
    expect(standsInFront(sim, FRONT_MOVE)).toEqual(IN_FRONT);
    expect(sim.x >= 6 && sim.x <= 7 && sim.z >= 3 && sim.z <= 4).toBe(false);
  });

  it("P7·P8: 옷장이 둘이면(L-two) 옷장 장소가 둘이고, 각각 누르면 그 옷장 앞(칸 6,3 / 칸 5,7)에 멈춰 같은 말풍선과 '들어가기'가 나온다", () => {
    applyLobbyLayout(L_TWO());
    const ids = closets();
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    const reached = ids.map((id) => {
      const sim = new LobbySim({ x: 4.2, z: 6.2 });
      pressAndArrive(sim, id);
      return { id, sim };
    });
    // 어느 옷장 앞에 섰는지(두 옷장의 앞 칸 하나씩)
    const fronts = reached.map(({ sim }) =>
      standsInFront(sim, FRONT_L0).inCell ? "L0" : standsInFront(sim, FRONT_MOVE).inCell ? "MOVE" : "none"
    );
    expect([...fronts].sort()).toEqual(["L0", "MOVE"]);
    for (const { id, sim } of reached) {
      const front = standsInFront(sim, FRONT_L0).inCell ? FRONT_L0 : FRONT_MOVE;
      expect(standsInFront(sim, front)).toEqual(IN_FRONT);
      expect(bubble(sim)).toEqual({ place: id, bubbleText: CLOSET_PROMPT, bubbleButton: CLOSET_BUTTON });
    }
  });

  it("P9: 옷장을 보관함에 넣으면(L-stored) 옷장 장소가 없고, 옷장 자리 앞(6.6, 3.5)까지 바닥을 눌러 걸어가 멈춰도 옷장 말풍선이 뜨지 않는다", () => {
    applyLobbyLayout(L_STORED());
    expect(closets()).toEqual([]);
    // 기존 다섯 장소는 그대로다
    expect(roomPlaceIds().map((id) => markInfo(id).label)).toEqual(["오늘의 질문", "생각 창가", "일기 책상", "밖으로", "학습 기록"]);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const target = { x: 6.6, z: 3.5 };
    expect(tap(sim, { point: target, mark: null, onCharacter: false })).toBe("walk");
    expect(runUntil(sim, 20, () => Math.hypot(sim.x - target.x, sim.z - target.z) < 1e-6 && sim.vx === 0 && sim.vz === 0)).toBe(true);
    run(sim, 1);
    expect({ place: sim.snapshot(now).place, bubbleButton: sim.snapshot(now).bubbleButton }).toEqual({ place: null, bubbleButton: null });
  });

  it("P12: 마을에서는 지금 구역의 장소에 이름표 '옷장'이 없다", () => {
    applyLobbyLayout(L0());
    expect(closets()).toHaveLength(1);
    applyArea("village");
    expect(activePlaceIds().filter((id) => markInfo(id).label === CLOSET_LABEL)).toEqual([]);
  });

  it("P13(03 결정 B2): 손님(setClosetSignedIn(false))이면 옷장에 도착했을 때 말풍선이 로그인 안내이고 버튼이 없다", () => {
    applyLobbyLayout(L0());
    setClosetSignedIn(false);
    const ids = closets();
    expect(ids).toHaveLength(1);
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    pressAndArrive(sim, ids[0]);
    expect(bubble(sim)).toEqual({ place: ids[0], bubbleText: GUEST_PROMPT, bubbleButton: null });
  });
});

describe("[spec] 089-③ 03 결정 B8: 옷장 구역은 다른 장소와 같다(서는 자리에서 옷장까지 이어지는 모양)", () => {
  it("B8-1: 바닥을 눌러 옷장 앞 칸 6,3의 가운데(6.5, 3.5)에 멈추면 옷장 말풍선과 '들어가기'가 뜬다", () => {
    applyLobbyLayout(L0());
    const [id] = closets();
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    const target = { x: 6.5, z: 3.5 };
    expect(tap(sim, { point: target, mark: null, onCharacter: false })).toBe("walk");
    expect(runUntil(sim, 20, () => Math.hypot(sim.x - target.x, sim.z - target.z) < 1e-6 && sim.vx === 0 && sim.vz === 0)).toBe(true);
    run(sim, 1);
    expect(bubble(sim)).toEqual({ place: id, bubbleText: CLOSET_PROMPT, bubbleButton: CLOSET_BUTTON });
  });

  it("B8-2: 옷장 구역에서 2칸 넘게 떨어진 곳(4.2, 6.2)에 서 있으면 옷장 말풍선이 없다", () => {
    applyLobbyLayout(L0());
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    run(sim, 1);
    expect({ place: sim.snapshot(now).place, bubbleButton: sim.snapshot(now).bubbleButton }).toEqual({ place: null, bubbleButton: null });
  });
});
