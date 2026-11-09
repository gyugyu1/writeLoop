// [spec] qa 테스트(작업 064-① 배치를 데이터로, 리팩터링: 동작은 그대로).
// 처음 배치(지금 가구 자리)에서 지금 코드가 내는 값을 좋고 나쁨과 관계없이 그대로 기록한다. 기대값은 고치기 전 코드(기준 커밋 8e6a453)를
// 돌려 얻은 값이고, 명세(private 작업 폴더 064/02-배치-데이터/01-main-spec.md)의 "그대로여야 할 것(처음 배치에서)"을 지킨다.
// 기록하는 것: 3D에 놓는 가구 자리·방향(가구 묶음과 대체 모양이 함께 쓰는 목록), 창 안쪽 크기, 막힌 칸과 방 끝, 설 수 있는 자리 지도,
// 장소 다섯의 서는 자리·바라볼 지점·문구·메뉴 짝·들어가기 동작, 장소 구역 지도, 길 찾기 결과, 장소로 걸어가 도착하는 자리와 방향,
// 일기 책상 의자 들어가기 동작(비켜서기·앉기·의자 빼기·돌아오기), 생각하기·책 동작의 방향, 뒷벽 창문의 바닥 창문 빛.
// 그리기 쪽(lobby3d-canvas·lobby3d-furniture·lobby3d-daylight) 안에만 있는 값(이름표 자리, 가구 그림자, 3D 의자를 빼는 방향,
// 창밖 장면의 창 자리, 창문 빛을 계산할 때 넘기는 창 자리)은 Jest에서 three를 돌릴 수 없어 이 파일이 보지 않는다(보고에 적음).
// 066-②(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서 바닥 가구 모델이 칸에 맞게 줄고 뒷면이 칸 뒤 끝에 붙어, 명세의 "고칠 기존 테스트"대로
// 책장·옷장 그림 자리의 기대값만 새 자리(뒤로 0.06 → 칸 뒤 끝에서 0.876/2 앞, 벽 가까이 0.44 → 0.438, 7.56 → 7.562)로 고쳤다.
// 067(private 작업 폴더 067/01-main-spec.md)에서 책상 모델이 칸 폭 3.0을 다 채워 칸 가운데에 놓이고 책상 장소의 바라볼 지점이 (1.25, 5.5) → (1.5, 5.5)로
// 옮겨져, 명세의 "고칠 기존 테스트"대로 책상 그림 자리(L1)·바라볼 지점(M2)과 그 지점을 보는 방향(P2의 desk, P3, C2의 out40)의 기대값만 고쳤다.
//
// 구현이 이름이나 부르는 방법을 바꾸면 아래 "지금 코드를 부르는 곳"만 따라 고친다. 그 아래의 기대값·단언·입력은 고치지 않는다.
import { windowLightPanes, type SunPosition, type WindowLightPane } from "@/lib/lobby3d/daylight";
import {
  CHAIR,
  LobbySim,
  MARK_ZONE_RADIUS,
  MARKS,
  MENU_FOR_MARK,
  ROOM,
  SCENE_FOR_MARK,
  findPath,
  isBlocked,
  isFree,
  markZoneAt,
  markZoneCenter,
  type FloorPoint,
  type MarkId,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { FURNITURE_LAYOUT, WINDOW_OPENING } from "@/lib/lobby3d/furniture-layout";

// ---------- 지금 코드를 부르는 곳(처음 배치) ----------

interface Placement {
  piece: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  mark?: string;
  blocker?: boolean;
}

const current = {
  /** 3D에 놓는 가구 목록(가구 묶음과 대체 모양이 함께 쓴다). 입구 발판의 누르는 곳(exit)도 들어 있다. */
  placements: (): readonly Placement[] => FURNITURE_LAYOUT,
  windowOpening: () => WINDOW_OPENING,
  marks: () => MARKS,
  menuForMark: () => MENU_FOR_MARK,
  sceneForMark: () => SCENE_FOR_MARK,
  chair: () => CHAIR,
  zoneRadius: () => MARK_ZONE_RADIUS,
  isBlocked: (x: number, z: number) => isBlocked(x, z),
  isFree: (x: number, z: number) => isFree(x, z),
  findPath: (from: FloorPoint, goals: FloorPoint[]) => findPath(from, goals),
  markZoneAt: (x: number, z: number) => markZoneAt(x, z),
  markZoneCenter: (id: MarkId) => markZoneCenter(id),
  newSim: (at: FloorPoint) => new LobbySim(at),
  /** 바닥 창문 빛. 지금 lobby3d-daylight가 하는 대로 창문 자리(x, y)와 창 안쪽 크기(가구 묶음을 불러오기 전 값)로 구한다. */
  windowLightPanes: (sun: SunPosition) => {
    const place = FURNITURE_LAYOUT.find((p) => p.piece === "window");
    return windowLightPanes(sun, { ...WINDOW_OPENING, x: place?.x ?? 4.8, y: place?.y ?? 2.05 }, ROOM.width, ROOM.depth);
  }
};

// ---------- 도우미 ----------

const MARK_IDS: MarkId[] = ["board", "window", "desk", "door", "bookcase"];
const FRAME_S = 0.05;
const FRAME_MS = 50;

/** 소수 넷째 자리로 반올림(-0은 0). */
function r4(v: number): number {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
}

/** 각도를 0 이상 2π 미만으로 맞춰 반올림한다(-π/2와 3π/2는 같은 방향이다). */
function angle(v: number): number {
  const twoPi = Math.PI * 2;
  const n = r4(((v % twoPi) + twoPi) % twoPi);
  return n === r4(twoPi) ? 0 : n;
}

function pt(p: FloorPoint): [number, number] {
  return [r4(p.x), r4(p.z)];
}

function floorHit(point: FloorPoint): PointerHit {
  return { point, mark: null, onCharacter: false };
}

function markHit(mark: MarkId): PointerHit {
  return { point: null, mark, onCharacter: false };
}

let now = 1_000_000;

function step(sim: LobbySim, frames: number) {
  for (let i = 0; i < frames; i += 1) {
    now += FRAME_MS;
    sim.update(FRAME_S, now);
  }
}

/** 0.25칸 간격 격자(칸 가운데에서 0.125씩 비낀 점). 가로 32, 세로 44. */
function gridMap(cell: (x: number, z: number) => string): string[] {
  const rows: string[] = [];
  for (let row = 0; row < 44; row += 1) {
    let line = "";
    for (let col = 0; col < 32; col += 1) line += cell(0.125 + col * 0.25, 0.125 + row * 0.25);
    rows.push(line);
  }
  return rows;
}

// ---------- 3D 가구 자리 ----------

describe("[spec] 064-① 처음 배치: 3D에 놓는 가구 자리·방향(그대로 둘 동작)", () => {
  it("L1: 가구 목록은 여덟 개(게시판·창문·일기 책상·의자·책장·옷장·깔개·입구 발판의 누르는 곳)이고 자리·높이·방향·장소·막는 가구 표시가 지금과 같다", () => {
    const list = current.placements();
    expect(list.length).toBe(8);
    const byPiece = Object.fromEntries(
      list.map((p) => [
        p.piece,
        { x: r4(p.x), y: r4(p.y), z: r4(p.z), rotY: angle(p.rotY), mark: p.mark ?? null, blocker: p.blocker ?? false }
      ])
    );
    expect(byPiece).toEqual({
      board: { x: 1.8, y: 1.75, z: 0.06, rotY: 0, mark: "board", blocker: false },
      window: { x: 4.8, y: 2.05, z: 0.17, rotY: 0, mark: "window", blocker: false },
      desk: { x: 1.5, y: 0, z: 5.5, rotY: 0, mark: "desk", blocker: false },
      chair: { x: 1.5, y: 0, z: 5.95, rotY: angle(Math.PI), mark: "desk", blocker: false },
      bookcase: { x: 0.438, y: 0, z: 2.5, rotY: angle(Math.PI / 2), mark: "bookcase", blocker: false },
      wardrobe: { x: 7.562, y: 0, z: 3.5, rotY: angle(-Math.PI / 2), mark: null, blocker: true },
      rug: { x: 4.6, y: 0.004, z: 7.2, rotY: 0, mark: null, blocker: false },
      exit: { x: 4, y: 0, z: 11.35, rotY: 0, mark: "door", blocker: false }
    });
  });

  it("L2: 창 안쪽(햇빛이 지나는 곳) 크기는 z 0.05, 가로 1.87, 세로 1.66, 창살 0.08이다", () => {
    const o = current.windowOpening();
    expect({ z: r4(o.z), width: r4(o.width), height: r4(o.height), bar: r4(o.bar) }).toEqual({ z: 0.05, width: 1.87, height: 1.66, bar: 0.08 });
  });
});

// ---------- 막힌 칸과 설 수 있는 자리 ----------

/** 지금 지나갈 수 없는 칸("열,행"). */
const SOLID = new Set(["0,2", "0,5", "1,5", "2,5", "7,3"]);

/** isFree 지도(0.25칸 격자). "#" 설 수 없음, "." 설 수 있음. 지금 코드로 그린 값. */
const FREE_MAP = [
  "################################",
  "################################",
  "################################",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "####..........................##",
  "#####.........................##",
  "#####.........................##",
  "#####.........................##",
  "#####.......................####",
  "####.......................#####",
  "##.........................#####",
  "##.........................#####",
  "##.........................#####",
  "##..........................####",
  "##............................##",
  "##............................##",
  "############..................##",
  "#############.................##",
  "#############.................##",
  "#############.................##",
  "#############.................##",
  "############..................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "##............................##",
  "################################"
];

describe("[spec] 064-① 처음 배치: 막힌 칸과 설 수 있는 자리(그대로 둘 동작)", () => {
  it("B1: 바닥 88칸 중 칸 가운데가 막힌 칸은 \"0,2\" \"0,5\" \"1,5\" \"2,5\" \"7,3\" 다섯이다", () => {
    const blocked: string[] = [];
    for (let c = 0; c < 8; c += 1) for (let r = 0; r < 11; r += 1) if (current.isBlocked(c + 0.5, r + 0.5)) blocked.push(`${c},${r}`);
    expect(blocked.sort()).toEqual([...SOLID].sort());
  });

  it.each([
    ["일기 책상이 반만 덮는 칸 \"2,5\"의 끝(2.99, 5.99)", 2.99, 5.99, true],
    ["칸 \"2,5\" 오른쪽 이웃 칸 첫 점(3.0, 5.5)", 3.0, 5.5, false],
    ["칸 \"2,5\" 바로 위(2.5, 4.99)", 2.5, 4.99, false],
    ["칸 \"2,5\" 바로 아래(2.5, 6.0)", 2.5, 6.0, false],
    ["책장 칸 \"0,2\" 오른쪽 끝(0.99, 2.5)", 0.99, 2.5, true],
    ["옷장 칸 \"7,3\" 왼쪽 끝(7.0, 3.5)", 7.0, 3.5, true],
    ["왼쪽 끝 0.25 바로 밖(0.24, 8.5)", 0.24, 8.5, true],
    ["왼쪽 끝 0.25(0.25, 8.5)", 0.25, 8.5, false],
    ["오른쪽 끝 7.75(7.75, 8.5)", 7.75, 8.5, false],
    ["오른쪽 끝 바로 밖(7.76, 8.5)", 7.76, 8.5, true],
    ["뒷벽 쪽 끝 0.45 바로 밖(3.5, 0.44)", 3.5, 0.44, true],
    ["뒷벽 쪽 끝 0.45(3.5, 0.45)", 3.5, 0.45, false],
    ["앞끝 11(3.5, 11)", 3.5, 11, false],
    ["앞끝 바로 밖(3.5, 11.01)", 3.5, 11.01, true]
  ])("B2: %s (x, z, 막힘) = (%s, %s, %s)", (_name, x, z, blocked) => {
    expect(current.isBlocked(x, z)).toBe(blocked);
  });

  it("B3: 라이트루프가 설 수 있는 자리 지도(0.25칸 격자)가 지금과 같다", () => {
    expect(gridMap((x, z) => (current.isFree(x, z) ? "." : "#"))).toEqual(FREE_MAP);
  });
});

// ---------- 장소 데이터 ----------

describe("[spec] 064-① 처음 배치: 장소 다섯의 데이터(그대로 둘 동작)", () => {
  const EXPECTED: Record<MarkId, { label: string; faceTo: [number, number]; approach: [number, number][]; prompt: string; buttonLabel: string; enterMessage: string }> = {
    board: {
      label: "오늘의 질문",
      faceTo: [1.8, 0],
      approach: [[1.6, 1.3], [2.2, 1.3]],
      prompt: "오늘의 질문 게시판이야.\n질문에 답하러 갈까?",
      buttonLabel: "들어가기",
      enterMessage: "질문에 답하기로 들어가요"
    },
    window: {
      label: "생각 창가",
      faceTo: [4.8, 0],
      approach: [[4.5, 1.55], [5.1, 1.55]],
      prompt: "생각 창가야.\n떠오르는 말을 바로 적어 볼까?",
      buttonLabel: "들어가기",
      enterMessage: "지금 생각나는대로로 들어가요"
    },
    desk: {
      label: "일기 책상",
      faceTo: [1.5, 5.5],
      approach: [[1.5, 6.75]],
      prompt: "일기 책상이야.\n오늘 일기를 써 볼까?",
      buttonLabel: "들어가기",
      enterMessage: "영어일기로 들어가요"
    },
    door: {
      label: "밖으로",
      faceTo: [4, 11.35],
      approach: [[4, 10.5]],
      prompt: "밖으로 나가 볼까?\n마을은 다음에 열려.",
      buttonLabel: "나가기",
      enterMessage: "마을은 다음 업데이트에서 열려요"
    },
    bookcase: {
      label: "학습 기록",
      faceTo: [0, 2.5],
      approach: [[1.4, 2.5]],
      prompt: "지금까지 쓴 기록이 모여 있어.\n기록을 볼까?",
      buttonLabel: "들어가기",
      enterMessage: "학습 기록으로 들어가요"
    }
  };

  it("M1: 장소는 다섯(게시판·창가·일기 책상·밖으로·책장)이다", () => {
    expect(Object.keys(current.marks()).sort()).toEqual([...MARK_IDS].sort());
  });

  it.each(MARK_IDS)("M2: %s 장소의 이름표 글·바라볼 지점·서는 자리(순서 포함)·안내 문구·버튼 글·들어갈 때 안내가 지금과 같다", (id) => {
    const m = current.marks()[id];
    expect({
      label: m.label,
      faceTo: pt(m.faceTo),
      approach: m.approach.map(pt),
      prompt: m.prompt,
      buttonLabel: m.buttonLabel,
      enterMessage: m.enterMessage
    }).toEqual(EXPECTED[id]);
  });

  it("M3: 아래 메뉴 짝(게시판-질문, 일기 책상-일기, 창가-생각, 책장-기록)과 들어가기 동작 짝(게시판·창가 생각하기, 일기 책상 의자, 책장 책)이 지금과 같다", () => {
    expect({ ...current.menuForMark() }).toEqual({ board: "question", desk: "diary", window: "thought", bookcase: "records" });
    expect({ ...current.sceneForMark() }).toEqual({ board: "think", window: "think", desk: "chair", bookcase: "book" });
  });
});

// ---------- 장소 구역 ----------

/** 장소 구역 지도(0.25칸 격자). B 게시판, W 창가, D 일기 책상, O 밖으로, K 책장, . 없음. 지금 코드로 그린 값. */
const ZONE_MAP = [
  "...BBBBBBBB....WWWWWWWW.........",
  "...BBBBBBBB....WWWWWWWW.........",
  "...BBBBBBBB....WWWWWWWW.........",
  "...BBBBBBBB....WWWWWWWW.........",
  "....BBBBBBBB...WWWWWWWW.........",
  "....BBBBBBBB...WWWWWWWW.........",
  "KKKKBBBBBBB....WWWWWWWW.........",
  "KKKKKKBBBBB....WWWWWWWW.........",
  "KKKKKKKKKB......WWWWWW..........",
  "KKKKKKKKKK.......WWWW...........",
  "KKKKKKKKKK......................",
  "KKKKKKKKK.......................",
  "KKKKKKKKK.......................",
  "KKKKKKKK........................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "....DDDD........................",
  "...DDDDDD.......................",
  "..DDDDDDDD......................",
  "..DDDDDDDD......................",
  "..DDDDDDDD......................",
  "..DDDDDDDD......................",
  "...DDDDDD.......................",
  "....DDDD........................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "..............OOOO..............",
  ".............OOOOOO.............",
  "............OOOOOOOO............",
  "............OOOOOOOO............",
  "............OOOOOOOO............",
  "............OOOOOOOO............"
];

const ZONE_LETTER: Record<MarkId, string> = { board: "B", window: "W", desk: "D", door: "O", bookcase: "K" };

describe("[spec] 064-① 처음 배치: 장소 구역(그대로 둘 동작)", () => {
  it("Z1: 구역 반지름은 1칸이고, 구역 가운데(서는 자리들의 가운데)가 지금과 같다", () => {
    expect(current.zoneRadius()).toBe(1);
    expect(Object.fromEntries(MARK_IDS.map((id) => [id, pt(current.markZoneCenter(id))]))).toEqual({
      board: [1.9, 1.3],
      window: [4.8, 1.55],
      desk: [1.5, 6.75],
      door: [4, 10.5],
      bookcase: [1.4, 2.5]
    });
  });

  it("Z2: 장소 구역 지도(0.25칸 격자. 겹치는 곳은 더 가까운 장소)가 지금과 같다", () => {
    expect(
      gridMap((x, z) => {
        const id = current.markZoneAt(x, z);
        return id ? ZONE_LETTER[id] : ".";
      })
    ).toEqual(ZONE_MAP);
  });

  it.each([
    ["게시판이 걸린 뒷벽 자리(1.8, 0)", 1.8, 0, "board"],
    ["창문이 걸린 뒷벽 자리(4.8, 0)", 4.8, 0, "window"],
    ["책장이 붙은 왼쪽 벽 자리(0, 2.5)", 0, 2.5, "bookcase"],
    ["일기 책상 구역 가장자리(1.5, 5.75): 가운데에서 1칸", 1.5, 5.75, "desk"],
    ["일기 책상 구역 바로 밖(1.5, 5.74)", 1.5, 5.74, null],
    ["밖으로 구역 가장자리(4, 9.5)", 4, 9.5, "door"],
    ["밖으로 구역 바로 밖(4, 9.49)", 4, 9.49, null],
    ["책장 구역 가장자리(1.4, 3.5)", 1.4, 3.5, "bookcase"]
  ])("Z3: %s (x, z, 구역) = (%s, %s, %s)", (_name, x, z, id) => {
    expect(current.markZoneAt(x, z)).toBe(id);
  });
});

// ---------- 길 찾기와 장소로 걸어가기 ----------

describe("[spec] 064-① 처음 배치: 장소로 가는 길(그대로 둘 동작)", () => {
  const PATHS: [string, FloorPoint, MarkId, [number, number][]][] = [
    ["방 가운데", { x: 4.2, z: 6.2 }, "board", [[2.2, 1.3]]],
    ["방 가운데", { x: 4.2, z: 6.2 }, "window", [[4.5, 1.55]]],
    ["방 가운데", { x: 4.2, z: 6.2 }, "desk", [[1.5, 6.75]]],
    ["방 가운데", { x: 4.2, z: 6.2 }, "door", [[4, 10.5]]],
    ["방 가운데", { x: 4.2, z: 6.2 }, "bookcase", [[1.4, 2.5]]],
    ["오른쪽 앞", { x: 6.5, z: 9.5 }, "board", [[2.2, 1.3]]],
    ["오른쪽 앞", { x: 6.5, z: 9.5 }, "window", [[5.1, 1.55]]],
    ["오른쪽 앞", { x: 6.5, z: 9.5 }, "desk", [[1.5, 6.75]]],
    ["오른쪽 앞", { x: 6.5, z: 9.5 }, "door", [[4, 10.5]]],
    ["오른쪽 앞", { x: 6.5, z: 9.5 }, "bookcase", [[2.5, 3.5], [1.4, 2.5]]],
    ["왼쪽 뒤 구석", { x: 0.6, z: 0.8 }, "board", [[1.6, 1.3]]],
    ["왼쪽 뒤 구석", { x: 0.6, z: 0.8 }, "window", [[4.5, 1.55]]],
    ["왼쪽 뒤 구석", { x: 0.6, z: 0.8 }, "desk", [[3.5, 4.5], [3.5, 6.5], [1.5, 6.75]]],
    ["왼쪽 뒤 구석", { x: 0.6, z: 0.8 }, "door", [[3.5, 4.5], [4, 10.5]]],
    ["왼쪽 뒤 구석", { x: 0.6, z: 0.8 }, "bookcase", [[1.5, 1.5], [1.4, 2.5]]],
    ["오른쪽 뒤", { x: 7.5, z: 1.2 }, "board", [[2.2, 1.3]]],
    ["오른쪽 뒤", { x: 7.5, z: 1.2 }, "window", [[5.1, 1.55]]],
    ["오른쪽 뒤", { x: 7.5, z: 1.2 }, "desk", [[3.5, 6.5], [1.5, 6.75]]],
    ["오른쪽 뒤", { x: 7.5, z: 1.2 }, "door", [[6.5, 2.5], [4, 10.5]]],
    ["오른쪽 뒤", { x: 7.5, z: 1.2 }, "bookcase", [[1.4, 2.5]]]
  ];

  it.each(PATHS)("P1: %s %j 에서 %s 장소로 가는 길의 꺾이는 점이 지금과 같다", (_name, from, id, expected) => {
    const path = current.findPath(from, current.marks()[id].approach);
    expect(path?.map(pt) ?? null).toEqual(expected);
  });

  it.each([
    ["board", [2.2, 1.3], Math.atan2(1.8 - 2.2, 0 - 1.3)],
    ["window", [4.5, 1.55], Math.atan2(4.8 - 4.5, 0 - 1.55)],
    ["desk", [1.5, 6.75], Math.atan2(1.5 - 1.5, 5.5 - 6.75)],
    ["door", [4, 10.5], Math.atan2(0, 11.35 - 10.5)],
    ["bookcase", [1.4, 2.5], Math.atan2(0 - 1.4, 0)]
  ] as [MarkId, [number, number], number][])("P2: 방 가운데(4.2, 6.2)에서 %s 장소를 누르면 %j 에 도착해 그 장소를 바라본다", (id, at, heading) => {
    const sim = current.newSim({ x: 4.2, z: 6.2 });
    sim.pointerDown(markHit(id), 100, 100, now);
    expect(sim.pointerUp(now + 100)).toBe("walk");
    now += 100;
    step(sim, 400);
    expect({ at: pt(sim), arrived: sim.arrived, heading: angle(sim.heading) }).toEqual({ at, arrived: id, heading: angle(heading) });
  });

  it("P3: 방 가운데에서 바닥(1.5, 6.6)을 누르면 그 자리에 서고, 일기 책상 구역 안이라 일기 책상에 도착한 것이 된다", () => {
    const sim = current.newSim({ x: 4.2, z: 6.2 });
    sim.pointerDown(floorHit({ x: 1.5, z: 6.6 }), 100, 100, now);
    expect(sim.pointerUp(now + 100)).toBe("walk");
    now += 100;
    step(sim, 400);
    expect({ at: pt(sim), arrived: sim.arrived, heading: angle(sim.heading) }).toEqual({
      at: [1.5, 6.6],
      arrived: "desk",
      heading: angle(Math.atan2(1.5 - 1.5, 5.5 - 6.6))
    });
  });
});

// ---------- 들어가기 동작 ----------

describe("[spec] 064-① 처음 배치: 일기 책상 의자 들어가기 동작(그대로 둘 동작)", () => {
  it("C1: 의자 값(빼는 거리 0.5, 앉는 자리 (1.5, 6.45), 앉는 높이 0.67, 비켜서는 자리 (2.15, 6.55))이 지금과 같다", () => {
    const c = current.chair();
    expect({ pull: r4(c.pull), seat: pt(c.seat), seatHeight: r4(c.seatHeight), side: pt(c.side) }).toEqual({
      pull: 0.5,
      seat: [1.5, 6.45],
      seatHeight: 0.67,
      side: [2.15, 6.55]
    });
  });

  it("C2: 서는 자리(1.5, 6.75)에서 들어가면 옆으로 비켜서며 의자를 빼고, 의자에 올라앉고, 판을 열 때가 되면 일기 책상을 한 번 돌려준다. 닫으면 거꾸로 돌아와 원래 자리에서 책상을 본다", () => {
    const sim = current.newSim({ x: 1.5, z: 6.75 });
    expect(sim.startScene("desk", now)).toBe(true);
    const frame = () => ({
      at: pt(sim),
      pull: r4(sim.chairPull()),
      lift: r4(sim.sceneLift()),
      phase: sim.scene?.phase ?? null,
      heading: angle(sim.heading)
    });
    const seen: Record<string, ReturnType<typeof frame>> = {};
    const entered: (string | null)[] = [];
    for (let i = 1; i <= 30; i += 1) {
      step(sim, 1);
      entered.push(sim.consumeSceneEntered());
      if ([4, 8, 14, 20, 30].includes(i)) seen[`in${i}`] = frame();
    }
    sim.endScene();
    for (let i = 1; i <= 40; i += 1) {
      step(sim, 1);
      if ([6, 12, 16, 20, 40].includes(i)) seen[`out${i}`] = frame();
    }
    // 비켜서기(0.4초) 가운데, 비켜선 자리, 올라앉기(0.6초) 가운데, 앉은 자리, 판을 연 동안
    expect(seen.in4).toMatchObject({ at: [1.825, 6.65], pull: 0.5, lift: 0, phase: "in" });
    expect(seen.in8).toMatchObject({ at: [2.15, 6.55], pull: 1, lift: 0, phase: "in" });
    expect(seen.in14).toMatchObject({ at: [1.825, 6.5], pull: 1, lift: 0.585, phase: "in" });
    expect(seen.in20).toMatchObject({ at: [1.5, 6.45], pull: 1, lift: 0.67, phase: "in" });
    expect(seen.in30).toEqual({ at: [1.5, 6.45], pull: 1, lift: 0.67, phase: "hold", heading: angle(Math.PI) });
    // 판을 열 때는 들어간 지 1.2초(24번째 프레임) 뒤 한 번만
    expect(entered.filter((v) => v !== null)).toEqual(["desk"]);
    expect(entered.indexOf("desk") + 1).toBe(24);
    // 내려와 옆에 선 자리, 의자를 넣는 중, 원래 자리
    expect(seen.out6).toMatchObject({ at: [1.825, 6.5], pull: 1, lift: 0.585, phase: "out" });
    expect(seen.out12).toMatchObject({ at: [2.15, 6.55], pull: 1, lift: 0, phase: "out" });
    expect(seen.out16).toMatchObject({ at: [1.825, 6.65], pull: 0.5, lift: 0, phase: "out" });
    expect(seen.out20).toMatchObject({ at: [1.5, 6.75], pull: 0, lift: 0, phase: null });
    expect(seen.out40).toEqual({ at: [1.5, 6.75], pull: 0, lift: 0, phase: null, heading: angle(Math.atan2(1.5 - 1.5, 5.5 - 6.75)) });
    expect(sim.arrived).toBe("desk");
  });
});

describe("[spec] 064-① 처음 배치: 생각하기·책 동작의 방향(그대로 둘 동작)", () => {
  it.each([
    ["board", { x: 1.6, z: 1.3 }, Math.atan2(1.8 - 1.6, 0 - 1.3)],
    ["window", { x: 5.1, z: 1.55 }, Math.atan2(4.8 - 5.1, 0 - 1.55)]
  ] as [MarkId, FloorPoint, number][])("S1: %s 서는 자리 %j 에서 생각하기를 하면 제자리에서 장소를 바라본 채 판을 연다", (id, at, heading) => {
    const sim = current.newSim(at);
    expect(sim.startScene(id, now)).toBe(true);
    step(sim, 30);
    expect({ at: pt(sim), phase: sim.scene?.phase ?? null, heading: angle(sim.heading) }).toEqual({
      at: [at.x, at.z],
      phase: "hold",
      heading: angle(heading)
    });
  });

  it("S2: 책장 서는 자리(1.4, 2.5)에서 책을 꺼내면 판을 연 동안 앞(0)을 보고, 닫은 뒤에는 다시 책장(왼쪽 벽)을 본다", () => {
    const sim = current.newSim({ x: 1.4, z: 2.5 });
    expect(sim.startScene("bookcase", now)).toBe(true);
    step(sim, 40);
    expect({ at: pt(sim), phase: sim.scene?.phase ?? null, heading: angle(sim.heading) }).toEqual({ at: [1.4, 2.5], phase: "hold", heading: 0 });
    sim.endScene();
    step(sim, 60);
    expect({ at: pt(sim), phase: sim.scene?.phase ?? null, arrived: sim.arrived, heading: angle(sim.heading) }).toEqual({
      at: [1.4, 2.5],
      phase: null,
      arrived: "bookcase",
      heading: angle(-Math.PI / 2)
    });
  });

  it("S3: 밖으로에는 들어가기 동작이 없다", () => {
    const sim = current.newSim({ x: 4, z: 10.5 });
    expect(sim.startScene("door", now)).toBe(false);
    expect(sim.scene).toBeNull();
  });
});

// ---------- 바닥의 창문 빛(뒷벽 창문) ----------

function panes(list: WindowLightPane[]) {
  return list.map((p) => ({ points: p.points.map(pt), origin: pt(p.origin), u: pt(p.u), v: pt(p.v) }));
}

describe("[spec] 064-① 처음 배치: 뒷벽 창문(가운데 x 4.8, 높이 2.05)의 바닥 창문 빛(그대로 둘 동작)", () => {
  it("W1: 해가 남쪽 35도(정오 무렵)면 네 칸이 창 앞 바닥에 곧게 비친다", () => {
    expect(panes(current.windowLightPanes({ elevation: 35, azimuth: 180 }))).toEqual([
      { points: [[3.865, 1.7923], [4.76, 1.7923], [4.76, 2.9206], [3.865, 2.9206]], origin: [3.865, 1.7923], u: [0.895, 0], v: [0, 1.1282] },
      { points: [[3.865, 3.0348], [4.76, 3.0348], [4.76, 4.1631], [3.865, 4.1631]], origin: [3.865, 3.0348], u: [0.895, 0], v: [0, 1.1282] },
      { points: [[4.84, 1.7923], [5.735, 1.7923], [5.735, 2.9206], [4.84, 2.9206]], origin: [4.84, 1.7923], u: [0.895, 0], v: [0, 1.1282] },
      { points: [[4.84, 3.0348], [5.735, 3.0348], [5.735, 4.1631], [4.84, 4.1631]], origin: [4.84, 3.0348], u: [0.895, 0], v: [0, 1.1282] }
    ]);
  });

  it("W2: 해가 남동쪽 낮게(방위 140도, 20도) 있으면 오른쪽으로 비껴 비치고 오른쪽 벽(x 8)에서 잘린다", () => {
    expect(panes(current.windowLightPanes({ elevation: 20, azimuth: 140 }))).toEqual([
      {
        points: [[6.0196, 2.6177], [6.9146, 2.6177], [8, 3.9113], [8, 4.2804], [7.4147, 4.2804]],
        origin: [6.0196, 2.6177],
        u: [0.895, 0],
        v: [1.3952, 1.6627]
      },
      { points: [[8, 4.9779], [7.556, 4.4488], [8, 4.4488]], origin: [7.556, 4.4488], u: [0.895, 0], v: [1.3952, 1.6627] },
      { points: [[8, 3.8159], [6.9946, 2.6177], [7.8896, 2.6177], [8, 2.7493]], origin: [6.9946, 2.6177], u: [0.895, 0], v: [1.3952, 1.6627] }
    ]);
  });

  it("W3: 해가 남서쪽(방위 230도, 30도)이면 왼쪽으로 비껴 비친다", () => {
    expect(panes(current.windowLightPanes({ elevation: 30, azimuth: 230 }))).toEqual([
      { points: [[2.2463, 1.4083], [3.1413, 1.4083], [2.0931, 2.2878], [1.1981, 2.2878]], origin: [2.2463, 1.4083], u: [0.895, 0], v: [-1.0482, 0.8795] },
      { points: [[1.0919, 2.3769], [1.9869, 2.3769], [0.9387, 3.2564], [0.0437, 3.2564]], origin: [1.0919, 2.3769], u: [0.895, 0], v: [-1.0482, 0.8795] },
      { points: [[3.2213, 1.4083], [4.1163, 1.4083], [3.0681, 2.2878], [2.1731, 2.2878]], origin: [3.2213, 1.4083], u: [0.895, 0], v: [-1.0482, 0.8795] },
      { points: [[2.0669, 2.3769], [2.9619, 2.3769], [1.9137, 3.2564], [1.0187, 3.2564]], origin: [2.0669, 2.3769], u: [0.895, 0], v: [-1.0482, 0.8795] }
    ]);
  });

  it("W4: 해가 북쪽 하늘(창 뒤)이거나 졌으면 창문 빛이 없다", () => {
    expect(current.windowLightPanes({ elevation: 30, azimuth: 0 })).toEqual([]);
    expect(current.windowLightPanes({ elevation: -1, azimuth: 180 })).toEqual([]);
  });
});
