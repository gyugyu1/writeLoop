// [spec] qa 테스트(작업 060-⑤ 가구·창문 디자인, 기능 변경).
// 기대값은 명세(private 작업 폴더 07-가구-디자인/01-main-spec.md)와 결정(02: 옷장은 칸 "7,3" 하나만, 06: 창가 안락의자를 빼서 칸 "4,0"·"5,0"이 열림,
// 15: 일기 책상을 1.2배로 키워 칸 "2,5"도 막히고, 일기 책상 장소의 바라볼 곳·서는 곳이 옮겨짐,
// 29: 뒷벽의 문을 없애고 "밖으로" 장소를 방 앞 가운데 입구 발판으로 옮김)와, 060-⑥(09-창문-빛-시간대)의 06 결정(스탠드를 방에서 빼
// 칸 "3,0"이 열림. 지나갈 수 없는 칸은 "0,5" "1,5" "2,5" "7,3" "0,2" 다섯 칸)에서만 가져온다.
// 그대로 둘 동작(장소 데이터, 메뉴 짝)은 고치기 전 코드의 값을 그대로 기록한다.
// - 바뀔 동작: 책장 칸 "0,2", 일기 책상이 넓어진 칸 "2,5"가 새로 지나갈 수 없는 칸이 되고, 창가 의자 칸이던 "4,0"·"5,0"과
//   스탠드 칸이던 "3,0"(060-⑥ 06 결정)은 지나갈 수 있는 칸이 된다. 일기 책상 장소의 바라볼 곳은 (1.25, 5.5), 서는 곳은 (3.35, 5.2)·(3.35, 5.8)이 된다.
//   "밖으로" 장소의 바라볼 곳은 입구 발판 가운데 (4.0, 11.35), 서는 곳은 (4.0, 10.5)가 된다(고치기 전에는 실패해야 한다).
// - 그대로 둘 동작: 지금 지나갈 수 없는 칸("0,5", "1,5", 옷장 칸이 된 "7,3"), 게시판·창가의 자리, 장소 넷의 이름표·문구와 메뉴 짝,
//   방 안 아무 바닥 칸에서 네 장소로 가는 길(고치기 전에도 통과해야 한다).
// 좌표(구현의 약속): 바닥 한 칸 = 1, x는 왼쪽→오른쪽(0..8), z는 뒷벽→앞(0..11). 칸 이름은 "열,행" = "floor(x),floor(z)".
// 3D에서 가구를 눌렀을 때 그 뒤 바닥으로 걷지 않는 판정(그리기 쪽의 누르기 판정)은 이 파일이 보지 않는다(보고에 적음).
// 067(private 작업 폴더 067/01-main-spec.md)에서 책상 장소의 바라볼 곳이 칸 가운데 (1.5, 5.5)로 옮겨져, 명세의 "고칠 기존 테스트"대로 F6의 바라볼 곳만 고쳤다.
import { FURNITURE_LAYOUT } from "@/lib/lobby3d/furniture-layout";
import {
  LobbySim,
  MARKS,
  MENU_FOR_MARK,
  ROOM,
  SOLID_TILES,
  findPath,
  isFree,
  type FloorPoint,
  type MarkId,
  type PointerHit
} from "@/lib/lobby3d/engine";

const FRAME_S = 0.05;
const FRAME_MS = 50;
const MARK_IDS: MarkId[] = ["board", "window", "desk", "door"];

/** 명세 2(결정 02로 바로잡음)와 결정 15(일기 책상 1.2배): 새로 지나갈 수 없게 되는 칸. */
const NEW_SOLID = [
  ["책장 칸 \"0,2\"", "0,2"],
  ["일기 책상이 넓어진 칸 \"2,5\"", "2,5"]
] as const;
/** 그대로여야 할 동작: 지금 지나갈 수 없는 칸. "7,3"은 화분 칸에서 옷장 칸이 된다. */
const KEPT_SOLID = [
  ["일기 책상 칸 \"0,5\"", "0,5"],
  ["일기 책상 칸 \"1,5\"", "1,5"],
  ["옷장 칸 \"7,3\"", "7,3"]
] as const;

function floorHit(point: FloorPoint | null): PointerHit {
  return { point, mark: null, onCharacter: false };
}

function tileOf(p: FloorPoint): string {
  return `${Math.floor(p.x)},${Math.floor(p.z)}`;
}

/** 칸 "c,r" 안의 점들(0.05 간격, 칸 경계에서 0.01 안쪽). */
function pointsInTile(key: string): FloorPoint[] {
  const [c, r] = key.split(",").map(Number);
  const points: FloorPoint[] = [];
  for (let i = 0; i <= 20; i += 1) {
    for (let j = 0; j <= 20; j += 1) {
      points.push({ x: c + 0.01 + i * 0.049, z: r + 0.01 + j * 0.049 });
    }
  }
  return points;
}

/** 톡: 같은 자리에서 누르고 0.1초 뒤 뗀다. */
function tap(sim: LobbySim, hit: PointerHit, nowMs: number) {
  sim.pointerDown(hit, 100, 100, nowMs);
  return sim.pointerUp(nowMs + 100);
}

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

/** 누르고 13px 끌어 끌기로 만든다. */
function startDrag(sim: LobbySim, finger: FloorPoint) {
  sim.pointerDown(floorHit(finger), 100, 100, 0);
  sim.pointerMove(floorHit(finger), 100, 113);
  expect(sim.dragging).toBe(true);
}

describe("[spec] 060-⑤ 지나갈 수 없는 칸과 일기 책상·밖으로 자리가 바뀜(바뀔 동작: 명세 2, 결정 02·06·15·29)", () => {
  it("F1: 지나갈 수 없는 칸은 일기 책상 \"0,5\"·\"1,5\"·옷장 \"7,3\"에 책장 \"0,2\", 일기 책상이 넓어진 \"2,5\"를 더한 다섯 칸이다(\"7,2\"와 창가 의자 칸이던 \"4,0\"·\"5,0\", 스탠드 칸이던 \"3,0\"은 지나갈 수 있다. 060-⑥ 06 결정)", () => {
    expect([...SOLID_TILES].sort()).toEqual(["0,2", "0,5", "1,5", "2,5", "7,3"]);
  });

  it.each(NEW_SOLID)("F2: %s 안 어디를 톡 해도 움직이지 않는다", (_name, key) => {
    const walked: string[] = [];
    for (const p of pointsInTile(key)) {
      const sim = new LobbySim({ x: 4.2, z: 6.2 });
      if (tap(sim, floorHit(p), 0) === "walk") walked.push(`(${p.x.toFixed(2)},${p.z.toFixed(2)})`);
      run(sim, 4, 100);
      if (sim.x !== 4.2 || sim.z !== 6.2) walked.push(`moved from (${p.x.toFixed(2)},${p.z.toFixed(2)})`);
    }
    expect({ count: walked.length, first: walked.slice(0, 6) }).toEqual({ count: 0, first: [] });
  });

  it.each([
    ["책장 칸 \"0,2\"를 왼쪽 벽 쪽으로", "0,2", { x: 1.6, z: 2.5 }, { x: -2, z: 2.5 }],
    ["일기 책상이 넓어진 칸 \"2,5\"를 왼쪽 벽 쪽으로", "2,5", { x: 3.5, z: 5.5 }, { x: -2, z: 5.5 }]
  ])("F3: %s 끌어도 어느 프레임에서도 그 칸에 들어가지 않는다", (_name, key, start, finger) => {
    const sim = new LobbySim(start);
    startDrag(sim, finger);
    const { positions } = run(sim, 120, 0);
    expect(positions.filter((p) => tileOf(p) === key).length).toBe(0);
  });

  it.each([
    ["책장 칸 \"0,2\"를 사이에 둔 위(0,1)·아래(0,3)", "0,2", { x: 0.8, z: 1.5 }, { x: 0.8, z: 3.5 }, "0,3"],
    ["일기 책상이 넓어진 칸 \"2,5\"를 사이에 둔 위(2,4)·아래(2,6)", "2,5", { x: 2.5, z: 4.5 }, { x: 2.5, z: 6.5 }, "2,6"]
  ])("F4: %s로 가는 길은 그 칸을 지나지 않고 누른 칸에 닿는다", (_name, key, from, goal, goalTile) => {
    const path = findPath(from, [goal]);
    expect(path).not.toBeNull();
    expect(tileOf(path![path!.length - 1])).toBe(goalTile);
    expect(samplePath(from, path!).filter((p) => tileOf(p) === key).length).toBe(0);

    const sim = new LobbySim(from);
    expect(tap(sim, floorHit(goal), 0)).toBe("walk");
    const { positions } = run(sim, 300, 100);
    expect(positions.filter((p) => tileOf(p) === key).length).toBe(0);
    expect(tileOf({ x: sim.x, z: sim.z })).toBe(goalTile);
  });

  it.each([
    ["창가 의자 칸이던 \"4,0\"", { x: 4.5, z: 0.8 }, "4,0"],
    ["창가 의자 칸이던 \"5,0\"", { x: 5.5, z: 0.8 }, "5,0"]
  ])("F5: %s을 톡 하면 걸어가 그 칸에 멈춘다(결정 06: 안락의자를 뺌)", (_name, point, key) => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(tap(sim, floorHit(point), 0)).toBe("walk");
    run(sim, 300, 100);
    expect(tileOf({ x: sim.x, z: sim.z })).toBe(key);
    expect(sim.snapshot(20_000).moving).toBe(false);
  });

  it("F5a: 스탠드 칸이던 \"3,0\"을 톡 하면 걸어가 그 칸에 멈춘다(060-⑥ 06 결정: 스탠드를 뺌)", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(tap(sim, floorHit({ x: 3.5, z: 0.8 }), 0)).toBe("walk");
    run(sim, 300, 100);
    expect(tileOf({ x: sim.x, z: sim.z })).toBe("3,0");
    expect(sim.snapshot(20_000).moving).toBe(false);
  });

  it("F5b: 방의 가구 자리에 스탠드가 없다(060-⑥ 06 결정: 스탠드를 방에서 뺌)", () => {
    expect(FURNITURE_LAYOUT.map((place) => place.piece as string)).not.toContain("lamp");
  });

  // 작업 061의 03 결정(사용자 결정 2026-11-07 "둘 다 의자 쪽으로")으로 서는 곳을 의자 뒤 (1.5, 6.75) 하나로 고쳤다.
  // 결정 15의 서는 곳 (3.35, 5.2)·(3.35, 5.8)은 없어지고, 바라볼 곳 (1.25, 5.5)은 그대로다.
  // 067 명세 3으로 바라볼 곳은 칸 가운데 (1.5, 5.5)가 된다.
  it("F6(061-03 결정, 067 명세 3): 일기 책상 장소의 바라볼 곳은 (1.5, 5.5), 서는 곳은 의자 뒤 (1.5, 6.75) 하나다(결정 15: 책상을 왼쪽 벽에 붙여 키움)", () => {
    expect({ faceTo: MARKS.desk.faceTo, approach: MARKS.desk.approach }).toEqual({
      faceTo: { x: 1.5, z: 5.5 },
      approach: [{ x: 1.5, z: 6.75 }]
    });
  });

  it("F7: \"밖으로\" 장소의 바라볼 곳은 입구 발판 가운데 (4.0, 11.35), 서는 곳은 바닥 앞끝 바로 안쪽 (4.0, 10.5) 하나다(결정 29: 문을 없애고 방 앞 입구 발판이 밖으로 나가는 길)", () => {
    expect({ faceTo: MARKS.door.faceTo, approach: MARKS.door.approach }).toEqual({
      faceTo: { x: 4.0, z: 11.35 },
      approach: [{ x: 4.0, z: 10.5 }]
    });
  });
});

describe("[spec] 060-⑤ 그대로 둘 동작(명세 \"그대로여야 할 동작\", \"테스트로 볼 것\")", () => {
  it.each(KEPT_SOLID)("G1: %s 안 어디를 톡 해도 움직이지 않는다", (_name, key) => {
    const walked: string[] = [];
    for (const p of pointsInTile(key)) {
      const sim = new LobbySim({ x: 4.2, z: 6.2 });
      if (tap(sim, floorHit(p), 0) === "walk") walked.push(`(${p.x.toFixed(2)},${p.z.toFixed(2)})`);
      run(sim, 4, 100);
      if (sim.x !== 4.2 || sim.z !== 6.2) walked.push(`moved from (${p.x.toFixed(2)},${p.z.toFixed(2)})`);
    }
    expect({ count: walked.length, first: walked.slice(0, 6) }).toEqual({ count: 0, first: [] });
  });

  it("G2: 화분 칸 위였던 \"7,2\"는 지나갈 수 있어 그 칸을 톡 하면 걸어가 그 칸에 멈춘다(결정 02)", () => {
    const sim = new LobbySim({ x: 4.2, z: 6.2 });
    expect(tap(sim, floorHit({ x: 7.3, z: 2.5 }), 0)).toBe("walk");
    run(sim, 300, 100);
    expect(tileOf({ x: sim.x, z: sim.z })).toBe("7,2");
  });

  // 작업 062(책장 장소 "학습 기록"을 더함, 04 결정 1)으로 장소 키를 넷 → 다섯으로 고쳤다. 기존 장소 넷의 값 단언은 그대로다.
  it("G3(062 04 결정): 장소는 기존 넷에 책장(이름표 '학습 기록')을 더한 다섯이고, 기존 장소 넷의 이름표, 말풍선 문구와 버튼, 들어갈 때 안내와, 게시판·창가의 위치(바라볼 지점)·서는 자리가 그대로다(일기 책상 자리는 F6·결정 15, 밖으로 자리는 F7·결정 29)", () => {
    const bookcases = (Object.keys(MARKS) as MarkId[]).filter((id) => MARKS[id].label === "학습 기록");
    expect(bookcases).toHaveLength(1);
    expect(Object.keys(MARKS).sort()).toEqual(["board", "desk", "door", "window", bookcases[0]].sort());
    const { faceTo: _deskFaceTo, approach: _deskApproach, ...deskRest } = MARKS.desk;
    const { faceTo: _doorFaceTo, approach: _doorApproach, ...doorRest } = MARKS.door;
    expect({ board: MARKS.board, window: MARKS.window, desk: deskRest, door: doorRest }).toEqual({
      board: {
        id: "board",
        label: "오늘의 질문",
        faceTo: { x: 1.8, z: 0 },
        approach: [{ x: 1.6, z: 1.3 }, { x: 2.2, z: 1.3 }],
        prompt: "오늘의 질문 게시판이야.\n질문에 답하러 갈까?",
        buttonLabel: "들어가기",
        enterMessage: "질문에 답하기로 들어가요"
      },
      window: {
        id: "window",
        label: "생각 창가",
        faceTo: { x: 4.8, z: 0 },
        approach: [{ x: 4.5, z: 1.55 }, { x: 5.1, z: 1.55 }],
        prompt: "생각 창가야.\n떠오르는 말을 바로 적어 볼까?",
        buttonLabel: "들어가기",
        enterMessage: "지금 생각나는대로로 들어가요"
      },
      desk: {
        id: "desk",
        label: "일기 책상",
        prompt: "일기 책상이야.\n오늘 일기를 써 볼까?",
        buttonLabel: "들어가기",
        enterMessage: "영어일기로 들어가요"
      },
      // 088 ② 03 결정 1(사용자, 2026-11-13 "qa가 새 동작에 맞게 고침")·3(들어갈 때 안내를 없앰)으로 밖으로의 문구와 안내만 고쳤다
      door: {
        id: "door",
        label: "밖으로",
        prompt: "밖으로 나가 볼까?",
        buttonLabel: "나가기",
        enterMessage: ""
      }
    });
  });

  // 작업 062(04 결정 1)으로 짝 셋 → 넷(책장 ↔ '학습 기록' 메뉴)으로 고쳤다. 기존 셋의 짝은 그대로다.
  // '학습 기록' 메뉴의 id는 구현이 정하므로 기존 세 메뉴와 다른 메뉴인지만 본다('학습 기록' 버튼이 강조되는지는 lobby3d-bookcase-screen C3·C4가 본다).
  it("G4(062 04 결정): 장소와 아래 메뉴의 짝은 기존 셋 그대로에 책장(이름표 '학습 기록') ↔ '학습 기록' 메뉴를 더한 넷이다", () => {
    const bookcases = (Object.keys(MARKS) as MarkId[]).filter((id) => MARKS[id].label === "학습 기록");
    expect(bookcases).toHaveLength(1);
    const pairs = MENU_FOR_MARK as Partial<Record<MarkId, string>>;
    const { [bookcases[0]]: bookMenu, ...oldPairs } = pairs;
    expect(oldPairs).toEqual({ board: "question", desk: "diary", window: "thought" });
    expect(typeof bookMenu).toBe("string");
    expect(["question", "diary", "thought"]).not.toContain(bookMenu);
  });

  it.each(MARK_IDS)("G5: 장소(%s)마다 라룹이가 설 수 있는 앞 지점이 있다", (id) => {
    const standable = MARKS[id].approach.filter((p) => !SOLID_TILES.has(tileOf(p)) && isFree(p.x, p.z));
    expect(standable.length).toBeGreaterThan(0);
  });

  it.each(MARK_IDS)("G6: 방 안 아무 바닥 칸에서 장소(%s)로 가는 길이 있고, 톡 하면 가구 칸을 지나지 않고 그 장소에 도착한다", (id) => {
    const noStandPoint: string[] = [];
    const noPath: string[] = [];
    const notArrived: string[] = [];
    const throughFurniture: string[] = [];
    for (let c = 0; c < ROOM.width; c += 1) {
      for (let r = 0; r < ROOM.depth; r += 1) {
        const key = `${c},${r}`;
        if (SOLID_TILES.has(key)) continue;
        const center = { x: c + 0.5, z: r + 0.5 };
        const start = isFree(center.x, center.z) ? center : pointsInTile(key).find((p) => isFree(p.x, p.z));
        if (!start) {
          noStandPoint.push(key);
          continue;
        }
        if (!findPath(start, MARKS[id].approach)) {
          noPath.push(key);
          continue;
        }
        const sim = new LobbySim(start);
        if (tap(sim, { point: null, mark: id, onCharacter: false }, 0) !== "walk" && sim.snapshot(0).arrived !== id) {
          noPath.push(`${key}(tap)`);
          continue;
        }
        let now = 100;
        for (let i = 0; i < 600 && sim.snapshot(now).arrived !== id; i += 1) {
          now += FRAME_MS;
          sim.update(FRAME_S, now);
          if (SOLID_TILES.has(tileOf({ x: sim.x, z: sim.z }))) throughFurniture.push(key);
        }
        if (sim.snapshot(now).arrived !== id) notArrived.push(key);
      }
    }
    expect({ noStandPoint, noPath, notArrived, throughFurniture: [...new Set(throughFurniture)] }).toEqual({
      noStandPoint: [],
      noPath: [],
      notArrived: [],
      throughFurniture: []
    });
  });
});
