// 3D 로비(라이트루프의 방)의 동작 규칙. 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.
// 좌표: 바닥 한 칸 = 1. x는 왼쪽→오른쪽(0..width), z는 뒷벽→앞(0..depth). 높이는 y.

export type MarkId = "board" | "window" | "desk" | "door";
export type ActionType = "wave" | "jump" | "hop" | "point" | "spin" | "look" | "poke";

export interface FloorPoint {
  x: number;
  z: number;
}

export interface PointerHit {
  /** 누른 곳의 바닥 좌표. 바닥 밖이면 null. */
  point: FloorPoint | null;
  /** 누른 곳에 있는 장소. 없으면 null. */
  mark: MarkId | null;
  /** 라이트루프를 눌렀는지. */
  onCharacter: boolean;
}

export const ROOM = {
  width: 8,
  depth: 11,
  wallHeight: 3.2,
  /** 카메라가 바닥을 내려다보는 기울기(도). */
  pitchDeg: 42,
  /** 카메라 세로 시야각(도). 원근감의 세기. */
  fovDeg: 30,
  /** 벽 두께. 벽 바깥면까지가 방이다(그 밖은 검정). */
  wallThickness: 0.4,
  /** 앞쪽 가운데 입구 발판이 방 앞끝에서 나온 길이. */
  stepDepth: 0.7
} as const;

export interface MarkInfo {
  id: MarkId;
  label: string;
  /** 바라볼 지점. 벽에 붙은 장소는 z = 0, 밖으로 가는 입구 발판은 바닥 앞끝 너머. */
  faceTo: FloorPoint;
  /** 이 장소를 쓰려고 서는 자리(가까운 곳으로 간다). */
  approach: FloorPoint[];
  prompt: string;
  buttonLabel: string;
  enterMessage: string;
}

export const MARKS: Record<MarkId, MarkInfo> = {
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
    faceTo: { x: 1.25, z: 5.5 },
    approach: [{ x: 3.35, z: 5.2 }, { x: 3.35, z: 5.8 }],
    prompt: "일기 책상이야.\n오늘 일기를 써 볼까?",
    buttonLabel: "들어가기",
    enterMessage: "영어일기로 들어가요"
  },
  door: {
    id: "door",
    label: "밖으로",
    faceTo: { x: 4.0, z: 11.35 },
    approach: [{ x: 4.0, z: 10.5 }],
    prompt: "밖으로 나가 볼까?\n마을은 다음에 열려.",
    buttonLabel: "나가기",
    enterMessage: "마을은 다음 업데이트에서 열려요"
  }
};

/** 아래 메뉴 버튼과 장소의 짝. 도착한 장소의 메뉴 버튼을 강조한다. */
export const MENU_FOR_MARK: Partial<Record<MarkId, "question" | "diary" | "thought">> = {
  board: "question",
  desk: "diary",
  window: "thought"
};

export const IDLE_LINE = "오늘은 뭘 해 볼까?\n가고 싶은 곳을 눌러 봐.";
export const POKE_LINES = ["헤헤, 간지러워!", "응? 불렀어?", "오늘도 같이 쓰자!"];

/** 가구가 있어 지나갈 수 없는 칸("열,행"). 일기 책상, 옷장, 책장(가구 자리는 furniture-layout). */
export const SOLID_TILES: ReadonlySet<string> = new Set(["0,5", "1,5", "2,5", "7,3", "0,2"]);

const BODY_RADIUS = 0.32;
const tileKey = (c: number, r: number) => `${c},${r}`;

export function isBlocked(x: number, z: number): boolean {
  if (x < 0.25 || x > ROOM.width - 0.25 || z < 0.45 || z > ROOM.depth) return true;
  return SOLID_TILES.has(tileKey(Math.floor(x), Math.floor(z)));
}

/** 라이트루프가 그 자리에 설 수 있는지(몸 둘레까지 본다). */
export function isFree(x: number, z: number): boolean {
  return (
    !isBlocked(x - BODY_RADIUS, z) &&
    !isBlocked(x + BODY_RADIUS, z) &&
    !isBlocked(x, z - BODY_RADIUS) &&
    !isBlocked(x, z + 0.15)
  );
}

export function isClearLine(a: FloorPoint, b: FloorPoint): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.12);
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (!isFree(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

/**
 * from에서 goals 중 가장 가까운 곳까지 가는 길(꺾이는 점들). 마지막 점은 고른 goal 그대로다.
 * 칸 단위(대각선 포함)로 찾은 뒤, 막힘 없이 곧게 갈 수 있는 점은 건너뛰어 자연스럽게 편다.
 * 갈 수 없으면 null.
 */
export function findPath(from: FloorPoint, goals: FloorPoint[]): FloorPoint[] | null {
  const reachable = goals.filter((g) => isFree(g.x, g.z));
  if (reachable.length === 0) return null;
  const sc = Math.floor(from.x);
  const sr = Math.floor(from.z);
  const start = tileKey(sc, sr);
  const goalByTile = new Map<string, FloorPoint>();
  reachable.forEach((g) => {
    const k = tileKey(Math.floor(g.x), Math.floor(g.z));
    if (!goalByTile.has(k)) goalByTile.set(k, g);
  });
  let end = goalByTile.has(start) ? start : "";
  const prev = new Map<string, string>([[start, ""]]);
  const queue: [number, number][] = [[sc, sr]];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (!end && queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      const k = tileKey(nc, nr);
      if (nc < 0 || nr < 0 || nc >= ROOM.width || nr >= ROOM.depth) continue;
      if (SOLID_TILES.has(k) || prev.has(k)) continue;
      if (dc !== 0 && dr !== 0 && (SOLID_TILES.has(tileKey(c + dc, r)) || SOLID_TILES.has(tileKey(c, r + dr)))) continue;
      prev.set(k, tileKey(c, r));
      if (goalByTile.has(k)) {
        end = k;
        break;
      }
      queue.push([nc, nr]);
    }
  }
  if (!end) return null;
  const goal = goalByTile.get(end)!;
  const tiles: FloorPoint[] = [];
  let walk = end;
  while (walk && walk !== start) {
    const [c, r] = walk.split(",").map(Number);
    tiles.unshift({ x: c + 0.5, z: r + 0.5 });
    walk = prev.get(walk) ?? "";
  }
  tiles.push({ x: goal.x, z: goal.z });
  const points: FloorPoint[] = [];
  let cur: FloorPoint = from;
  let i = 0;
  while (i < tiles.length) {
    let j = tiles.length - 1;
    while (j > i && !isClearLine(cur, tiles[j])) j -= 1;
    points.push(tiles[j]);
    cur = tiles[j];
    i = j + 1;
  }
  return points;
}

/** from에서 to를 바라보는 방향(라디안). 0 = 화면 앞(+z)을 봄. */
export function headingTo(from: FloorPoint, to: FloorPoint): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** 각도 a에서 b로 k만큼(0..1) 가장 짧은 쪽으로 돈다. */
export function lerpAngle(a: number, b: number, k: number): number {
  const twoPi = Math.PI * 2;
  const d = ((((b - a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  return a + d * k;
}

// ---------- 카메라 ----------

/**
 * 보는 점 깊이에서 화면 가로에 보이는 폭(칸). 작을수록 가깝다.
 * 기본값 9.4에서는 방이 세로로 다 들어오고, 가로는 조금 넘쳐 라룹이가 양옆 끝으로 가면 벽 끝까지만 조금 따라간다
 * (방이 가로로 다 들어오는 거리는 폰 화면에서 10.6~11.0. 2026-11-07 사용자 결정).
 */
export const VIEW_WIDTH_DEFAULT = 9.4;
export const VIEW_WIDTH_MIN = 4.0;
export const VIEW_WIDTH_MAX = 12.8;

export function clampViewWidth(v: number): number {
  if (!Number.isFinite(v)) return VIEW_WIDTH_DEFAULT;
  return Math.min(VIEW_WIDTH_MAX, Math.max(VIEW_WIDTH_MIN, v));
}

/** 방 끝을 둘러싼 상자: 양옆 벽 바깥면, 뒷벽 바깥면, 벽 윗면, 앞쪽은 입구 발판 앞, 아래는 입구 발판 밑. 그 밖은 검정이다. */
export const ROOM_BOUNDS = {
  minX: -ROOM.wallThickness,
  maxX: ROOM.width + ROOM.wallThickness,
  minY: -0.25,
  maxY: ROOM.wallHeight,
  minZ: -ROOM.wallThickness,
  maxZ: ROOM.depth + ROOM.stepDepth
} as const;

export interface CameraPose {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  /** 세로 시야각(도) */
  fovDeg: number;
}

/**
 * 원근 카메라 자리. follow는 따라갈 바닥 점, viewWidth는 보는 점 깊이에서 화면 가로에 보이는 폭, aspect는 화면 가로/세로다.
 * 카메라는 옆으로 돌지 않고 앞쪽 위에서 기울기만큼 내려다보며, 보는 점과의 거리는 viewWidth로 정한다.
 * 세로를 먼저 정한다(화면 세로 자리는 x와 상관없다). 방 상자가 세로로 다 들어오면 위·아래 검은 여백이 같게 고정하고,
 * 아니면 follow를 따라가되 화면 위·아래 끝이 방 끝 너머로 나가지 않게 막는다. 가로도 같은 규칙이다.
 */
export function cameraPose(follow: FloorPoint, viewWidth: number, aspect: number): CameraPose {
  const pitch = (ROOM.pitchDeg * Math.PI) / 180;
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const tanV = Math.tan((ROOM.fovDeg * Math.PI) / 360);
  const tanH = tanV * Math.max(aspect, 0.01);
  const dist = viewWidth / (2 * tanH);
  const b = ROOM_BOUNDS;
  const corners: { y: number; z: number }[] = [];
  for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) corners.push({ y, z });
  // 보는 점 z가 cz일 때 모서리의 카메라 앞 깊이와 화면 세로 자리(-1 아래 끝 ~ 1 위 끝)
  const depthAt = (c: { y: number; z: number }, cz: number) => -sin * (c.y - dist * sin) - cos * (c.z - cz - dist * cos);
  const screenY = (c: { y: number; z: number }, cz: number) =>
    (cos * (c.y - dist * sin) - sin * (c.z - cz - dist * cos)) / (depthAt(c, cz) * tanV);
  const minY = (cz: number) => Math.min(...corners.map((c) => screenY(c, cz)));
  const maxY = (cz: number) => Math.max(...corners.map((c) => screenY(c, cz)));
  const NEAR = 0.05;
  // 모든 모서리가 카메라 앞(NEAR보다 멀리)에 있는 가장 뒤쪽 보는 점
  const czFront = Math.max(...corners.map((c) => (NEAR + sin * (c.y - dist * sin)) / cos + c.z - dist * cos));
  // 그보다 앞에서는 보는 점이 앞(+z)으로 갈수록 방이 화면 위로 올라간다. 그래서 아래 식들은 cz에 대해 늘기만 하고, 반으로 나눠 찾는다.
  const solve = (fn: (cz: number) => number, target: number) => {
    let lo = czFront;
    let hi = b.maxZ + dist + 40;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      if (fn(mid) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const centerZ = solve((cz) => minY(cz) + maxY(cz), 0);
  const fitsY = centerZ > czFront && maxY(centerZ) <= 1;
  const cz = fitsY
    ? centerZ
    : Math.min(Math.max(follow.z - 0.6, solve(maxY, 1)), Math.max(solve(minY, -1), solve(maxY, 1)));
  // 가로: 화면 가로 자리 = (x − 보는 점 x) / (깊이 · tanH). 가까운 곳일수록 같은 화면 폭에 좁은 바닥이 보인다.
  // 다 들어오는지는 방 상자에서 가장 가까운 모서리로 본다.
  const nearest = Math.min(...corners.map((c) => depthAt(c, cz)));
  const centerX = (b.minX + b.maxX) / 2;
  const fitsX = nearest > NEAR && b.maxX - centerX <= nearest * tanH;
  // 따라갈 때는 화면 아래쪽 옆 가장자리도 방 끝 너머를 보지 않게 막는다. 깊이 d에서 화면 옆 끝은 보는 점에서 d·tanH 떨어지므로,
  // 화면 아래에 보이는 방 바닥의 깊이로 막는다. 화면 아래 끝 줄이 바닥에 닿는 깊이(보는 점 z와 상관없다)가 방 안이면 그 깊이,
  // 화면 아래 끝 줄이 방 앞보다 앞이면 바닥 앞끝의 깊이다(둘 중 먼 쪽).
  const bottomRowDepth = (dist * sin) / (sin + cos * tanV);
  const floorDepth = Math.max(bottomRowDepth, depthAt({ y: 0, z: b.maxZ }, cz));
  // 화면 아래 줄의 바닥이 화면보다 좁으면(방 상자로는 화면보다 넓은 좁은 틈) 양옆이 어차피 조금 검다. 그때는 아주 조금만 따라간다.
  const halfWidth = b.maxX - centerX;
  const reach = Math.max(nearest * tanH, Math.min(Math.max(nearest, floorDepth) * tanH, halfWidth - 0.05));
  const cx = fitsX ? centerX : Math.min(Math.max(follow.x, b.minX + reach), Math.max(b.maxX - reach, centerX));
  return {
    position: { x: cx, y: dist * sin, z: cz + dist * cos },
    lookAt: { x: cx, y: 0, z: cz },
    fovDeg: ROOM.fovDeg
  };
}

// ---------- 톡·꾹·끌기와 이동 ----------

export const TAP_MAX_MOVE_PX = 12;
export const HOLD_MS = 220;

export const ACTION_SECONDS: Record<ActionType, number> = {
  wave: 2.4,
  jump: 1.6,
  hop: 1.8,
  point: 2.2,
  spin: 0.9,
  look: 2.6,
  poke: 0.8
};
/** "동작 줄이기"가 켜져 있으면 하지 않는 동작. */
export const LARGE_MOTIONS: ReadonlySet<ActionType> = new Set(["jump", "hop", "spin", "poke"]);

/** 아무것도 하지 않은 채 이만큼(밀리초) 지나면 앉는다. */
export const SIT_AFTER_MS = 20_000;
/** 앉는 데(sit_down)와 일어나는 데(stand_up) 걸리는 시간(초). */
export const SIT_DOWN_SECONDS = 0.6;
export const STAND_UP_SECONDS = 0.6;

/** 앉기 자세. 앉는 중 → 앉아 있음(반복) → 일어나는 중. 서 있으면 null. */
export type PostureKind = "sitting-down" | "sitting" | "standing-up";

export interface LobbySettings {
  /** 걷는 속도(칸/초). */
  speed: number;
  /** 돌아서는 빠르기(클수록 빨리 돈다). */
  turn: number;
}

export interface LobbySnapshot {
  x: number;
  z: number;
  heading: number;
  speed: number;
  moving: boolean;
  dragging: boolean;
  arrived: MarkId | null;
  action: { type: ActionType; t: number } | null;
  posture: { kind: PostureKind; t: number } | null;
  bubbleText: string;
  bubbleButton: string | null;
  /** 말풍선이 기본 말이나 로비 인사인지(장소 안내·짧은 말이 아님). 이어 쓰기 버튼을 붙이는 곳이다. */
  idleBubble: boolean;
}

interface PointerState {
  sx: number;
  sy: number;
  t: number;
  hit: PointerHit;
}

export class LobbySim {
  x = 4.2;
  z = 6.2;
  vx = 0;
  vz = 0;
  heading = 0;
  // 기본 걷는 속도(칸/초). 3D 모델로 바꾼 뒤 조금 빠르게 했다(2026-11-06 사용자 요청, 2.6에서).
  settings: LobbySettings = { speed: 3.2, turn: 10 };
  reduceMotion = false;
  action: { type: ActionType; t: number } | null = null;
  arrived: MarkId | null = null;
  dragging = false;
  /** 앉기 자세(서 있으면 null). 앉아 있는 동안과 일어나는 동안은 걷기·동작이 기다린다. */
  posture: { kind: PostureKind; t: number } | null = null;
  private path: FloorPoint[] = [];
  private target: MarkId | null = null;
  private goalHeading: number | null = null;
  private dragPoint: FloorPoint | null = null;
  private down: PointerState | null = null;
  private quip = "";
  private quipUntilMs = 0;
  private pokeIndex = 0;
  /** 로비에 들어올 때의 인사 말. 누르기 전까지 기본 말 대신 보인다. */
  private greeting: string | null = null;
  /** 마지막으로 무언가 한 때(밀리초). 이때부터 SIT_AFTER_MS가 지나면 앉는다. null이면 다음 프레임에 지금으로 잡는다. */
  private idleSinceMs: number | null = null;
  /** 앞 프레임의 시각(밀리초). 그리기가 멈췄다 다시 돌면(다른 화면·배경) 그 사이를 앉기까지의 시간에 넣지 않으려고 본다. */
  private lastUpdateMs: number | null = null;
  private random: () => number;

  constructor(options?: { x?: number; z?: number; reduceMotion?: boolean; random?: () => number }) {
    if (options?.x !== undefined) this.x = options.x;
    if (options?.z !== undefined) this.z = options.z;
    this.reduceMotion = options?.reduceMotion ?? false;
    this.random = options?.random ?? Math.random;
  }

  /** 동작을 시작한다. "동작 줄이기"면 큰 동작은 하지 않고 false. */
  startAction(type: ActionType): boolean {
    if (this.reduceMotion && LARGE_MOTIONS.has(type)) return false;
    this.action = { type, t: 0 };
    return true;
  }

  /** 앉아 있으면 일어나기 시작한다(일어난 뒤 하려던 일을 이어서 한다). 앉기까지의 시간도 처음부터 다시 잰다. */
  wake(nowMs?: number): void {
    if (this.posture && this.posture.kind !== "standing-up") this.posture = { kind: "standing-up", t: 0 };
    this.idleSinceMs = nowMs ?? null;
  }

  /**
   * 로비에 들어올 때의 인사. 그 자리에서 앞을 보고 말과 동작을 한다(장소 안내는 거두고, "동작 줄이기"면 큰 동작은 하지 않는다).
   * 말은 누르기 전까지 기본 말 대신 남는다.
   */
  greet(line: string, action: ActionType, nowMs: number): void {
    this.wake(nowMs);
    this.greeting = line;
    this.quipUntilMs = 0;
    if (this.path.length || this.dragging) return;
    this.target = null;
    this.arrived = null;
    this.goalHeading = 0;
    this.startAction(action);
  }

  /** 시험판 동작 버튼: 멈춰서 앞을 보고 동작한다. */
  playAction(type: ActionType): boolean {
    this.wake();
    this.greeting = null;
    this.path = [];
    this.vx = 0;
    this.vz = 0;
    this.target = null;
    this.arrived = null;
    this.goalHeading = 0;
    return this.startAction(type);
  }

  /** 바닥 점이나 장소로 걸어간다. 갈 수 없으면 false(움직이지 않는다). */
  goTo(point: FloorPoint | null, mark: MarkId | null): boolean {
    let goals: FloorPoint[];
    if (mark) goals = MARKS[mark].approach;
    else if (point && isFree(point.x, point.z)) goals = [point];
    else return false;
    const path = findPath({ x: this.x, z: this.z }, goals);
    if (!path) return false;
    this.wake();
    this.path = path;
    this.target = mark;
    this.arrived = null;
    this.action = null;
    const last = path[path.length - 1] ?? { x: this.x, z: this.z };
    this.goalHeading = mark ? headingTo(last, MARKS[mark].faceTo) : null;
    return true;
  }

  pointerDown(hit: PointerHit, screenX: number, screenY: number, nowMs: number): void {
    // 누르면 인사 말은 거두고, 앉아 있었으면 일어난다
    this.greeting = null;
    this.wake(nowMs);
    this.down = { sx: screenX, sy: screenY, t: nowMs, hit };
    this.dragging = false;
    this.dragPoint = hit.point;
  }

  pointerMove(hit: PointerHit, screenX: number, screenY: number): void {
    if (!this.down) return;
    if (hit.point) this.dragPoint = hit.point;
    if (Math.hypot(screenX - this.down.sx, screenY - this.down.sy) > TAP_MAX_MOVE_PX) this.startDrag();
  }

  /** 손을 뗐을 때. 톡이면 그에 맞는 일을 하고 무엇을 했는지 돌려준다. */
  pointerUp(nowMs: number): "drag-end" | "poke" | "walk" | "none" {
    if (!this.down) return "none";
    const { hit } = this.down;
    // 프레임이 끊겨 꾹으로 바뀌지 못했어도, 누른 시간이 길면 톡이 아니다.
    const wasDrag = this.dragging || nowMs - this.down.t >= HOLD_MS;
    this.down = null;
    this.dragging = false;
    this.dragPoint = null;
    if (wasDrag) return "drag-end";
    if (hit.onCharacter) {
      this.startAction("poke");
      this.say(POKE_LINES[this.pokeIndex % POKE_LINES.length], nowMs, 1600);
      this.pokeIndex += 1;
      return "poke";
    }
    return this.goTo(hit.point, hit.mark) ? "walk" : "none";
  }

  pointerCancel(): void {
    this.down = null;
    this.dragging = false;
    this.dragPoint = null;
  }

  say(text: string, nowMs: number, durationMs = 2500): void {
    this.quip = text;
    this.quipUntilMs = nowMs + durationMs;
  }

  private startDrag(): void {
    if (this.dragging) return;
    this.dragging = true;
    this.path = [];
    this.target = null;
    this.arrived = null;
    this.goalHeading = null;
    this.action = null;
  }

  /** 한 프레임 진행. dt는 초. */
  update(dt: number, nowMs: number): void {
    const step = Math.min(0.05, Math.max(0, dt));
    if (this.down && !this.dragging && nowMs - this.down.t >= HOLD_MS) this.startDrag();
    // 처음 프레임이거나, 다른 화면·배경에 가 있다 돌아와 프레임 사이가 길면 앉기까지의 시간을 처음부터 잰다(홈을 보는 동안만 센다).
    // 그리기 쪽이 dt를 짧게 잘라 넘기므로 공백은 시각으로 본다.
    const gap = this.lastUpdateMs === null ? 0 : nowMs - this.lastUpdateMs;
    this.lastUpdateMs = nowMs;
    if (this.idleSinceMs === null || dt > 1 || gap > 1000) this.idleSinceMs = nowMs;

    // 앉기: 오래 가만히 두면 앉고, 일어나는 중에는 걷기·동작이 기다린다
    if (this.posture) {
      this.posture.t += step;
      if (this.posture.kind === "sitting-down" && this.posture.t >= SIT_DOWN_SECONDS) this.posture = { kind: "sitting", t: 0 };
      else if (this.posture.kind === "standing-up" && this.posture.t >= STAND_UP_SECONDS) {
        this.posture = null;
        this.idleSinceMs = nowMs;
      }
      if (this.posture) {
        this.vx = 0;
        this.vz = 0;
        return;
      }
    }
    const busy = this.path.length > 0 || this.dragging || this.down !== null || this.action !== null || Math.hypot(this.vx, this.vz) > 0.05;
    if (busy) this.idleSinceMs = nowMs;
    else if (nowMs - this.idleSinceMs >= SIT_AFTER_MS) {
      this.posture = { kind: "sitting-down", t: 0 };
      return;
    }

    let desiredX = 0;
    let desiredZ = 0;
    const tgt = this.dragging ? this.dragPoint : this.path[0] ?? null;
    if (tgt) {
      const dx = tgt.x - this.x;
      const dz = tgt.z - this.z;
      const d = Math.hypot(dx, dz);
      if (!this.dragging && d < 0.06) {
        this.path.shift();
        if (!this.path.length) {
          this.x = tgt.x;
          this.z = tgt.z;
          this.vx = 0;
          this.vz = 0;
          this.arrived = this.target;
          if (!this.arrived) this.goalHeading = null;
        }
      } else if (d > (this.dragging ? 0.25 : 0)) {
        const lastLeg = !this.dragging && this.path.length === 1;
        const sp = lastLeg ? Math.min(this.settings.speed, d * 4 + 0.5) : this.settings.speed;
        desiredX = (dx / d) * sp;
        desiredZ = (dz / d) * sp;
      }
    }
    const k = Math.min(1, step * 8);
    this.vx += (desiredX - this.vx) * k;
    this.vz += (desiredZ - this.vz) * k;
    const speed = Math.hypot(this.vx, this.vz);
    if (speed > 0.05) {
      const nx = this.x + this.vx * step;
      const nz = this.z + this.vz * step;
      if (isFree(nx, nz)) {
        this.x = nx;
        this.z = nz;
      } else if (isFree(nx, this.z)) {
        this.x = nx;
        this.vz = 0;
      } else if (isFree(this.x, nz)) {
        this.z = nz;
        this.vx = 0;
      } else {
        this.vx = 0;
        this.vz = 0;
      }
    } else {
      this.vx = 0;
      this.vz = 0;
    }

    let want: number | null = null;
    if (Math.hypot(this.vx, this.vz) > 0.3) want = Math.atan2(this.vx, this.vz);
    else if (this.goalHeading !== null) want = this.goalHeading;
    if (want !== null) this.heading = lerpAngle(this.heading, want, Math.min(1, step * this.settings.turn));

    if (this.action) {
      this.action.t += step;
      if (this.action.t >= ACTION_SECONDS[this.action.type]) this.action = null;
    }
  }

  snapshot(nowMs: number): LobbySnapshot {
    const speed = Math.hypot(this.vx, this.vz);
    const moving = speed > 0.3 || this.dragging;
    let bubbleText = "";
    let bubbleButton: string | null = null;
    let idleBubble = false;
    // 움직이는 동안은 말풍선을 숨긴다(짧은 말도). 서 있으면 짧은 말 → 장소 안내 → 기본 말 순서.
    if (moving) bubbleText = "";
    else if (nowMs < this.quipUntilMs) bubbleText = this.quip;
    else if (this.arrived) {
      bubbleText = MARKS[this.arrived].prompt;
      bubbleButton = MARKS[this.arrived].buttonLabel;
    } else {
      bubbleText = this.greeting ?? IDLE_LINE;
      idleBubble = true;
    }
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed,
      moving,
      dragging: this.dragging,
      arrived: this.arrived,
      action: this.action ? { ...this.action } : null,
      posture: this.posture ? { ...this.posture } : null,
      bubbleText,
      bubbleButton,
      idleBubble
    };
  }

  /** 말풍선 버튼을 눌렀을 때 띄울 안내. 도착한 곳이 없으면 null. */
  enterMessage(): string | null {
    return this.arrived ? MARKS[this.arrived].enterMessage : null;
  }

  /** 시험용으로만 쓰는 무작위(두리번 간격 등). */
  nextRandom(): number {
    return this.random();
  }
}
