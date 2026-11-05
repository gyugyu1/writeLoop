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
  pitchDeg: 42,
  /** 앞쪽 바닥이 이어지는 끝(화면 아래로 바닥 끝이 보이지 않게 넉넉히 깐다). */
  floorFar: 22
} as const;

export interface MarkInfo {
  id: MarkId;
  label: string;
  /** 바라볼 지점. 벽에 붙은 장소는 z = 0. */
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
    faceTo: { x: 1.15, z: 5.5 },
    approach: [{ x: 2.45, z: 5.2 }, { x: 2.45, z: 5.8 }],
    prompt: "일기 책상이야.\n오늘 일기를 써 볼까?",
    buttonLabel: "들어가기",
    enterMessage: "영어일기로 들어가요"
  },
  door: {
    id: "door",
    label: "밖으로",
    faceTo: { x: 7.0, z: 0 },
    approach: [{ x: 7.0, z: 1.1 }],
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

/** 가구가 있어 지나갈 수 없는 칸("열,행"). 창가 의자, 일기 책상, 화분. */
export const SOLID_TILES: ReadonlySet<string> = new Set(["4,0", "5,0", "0,5", "1,5", "7,3"]);

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

/** 화면 가로에 보이는 바닥 폭(칸). 작을수록 가깝다. 3D 모델로 바꾼 뒤 캐릭터가 커 보여 5.2에서 조금 뒤로 뺐다(2026-11-06 사용자 요청). */
export const VIEW_WIDTH_DEFAULT = 6.0;
export const VIEW_WIDTH_MIN = 4.0;
/** 방 너비보다 넓게 보면 방 밖이 보인다. */
export const VIEW_WIDTH_MAX = ROOM.width - 0.2;

export function clampViewWidth(v: number): number {
  if (!Number.isFinite(v)) return VIEW_WIDTH_DEFAULT;
  return Math.min(VIEW_WIDTH_MAX, Math.max(VIEW_WIDTH_MIN, v));
}

/**
 * 카메라가 보는 바닥 점(target)을 방 안으로 제한한다. viewHeight는 화면 세로에 보이는 폭(칸)이다.
 * 좌우는 방 양 끝이 화면 밖에 있게, 위쪽은 뒷벽 위 끝이 화면 위보다 높게, 아래쪽은 깔린 바닥 끝이 보이지 않게 한다.
 */
export function clampCameraTarget(target: FloorPoint, viewWidth: number, viewHeight: number): FloorPoint {
  const pitch = (ROOM.pitchDeg * Math.PI) / 180;
  const hw = viewWidth / 2;
  const hh = viewHeight / 2;
  const zMin = (hh - (ROOM.wallHeight - 0.05) * Math.cos(pitch)) / Math.sin(pitch);
  const zMax = Math.max(zMin, ROOM.floorFar - hh / Math.sin(pitch));
  const xMin = Math.min(hw, ROOM.width / 2);
  const xMax = Math.max(ROOM.width - hw, ROOM.width / 2);
  return {
    x: Math.min(Math.max(target.x, xMin), xMax),
    z: Math.min(Math.max(target.z, zMin), zMax)
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
  bubbleText: string;
  bubbleButton: string | null;
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
  private path: FloorPoint[] = [];
  private target: MarkId | null = null;
  private goalHeading: number | null = null;
  private dragPoint: FloorPoint | null = null;
  private down: PointerState | null = null;
  private quip = "";
  private quipUntilMs = 0;
  private pokeIndex = 0;
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

  /** 시험판 동작 버튼: 멈춰서 앞을 보고 동작한다. */
  playAction(type: ActionType): boolean {
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
    this.path = path;
    this.target = mark;
    this.arrived = null;
    this.action = null;
    const last = path[path.length - 1] ?? { x: this.x, z: this.z };
    this.goalHeading = mark ? headingTo(last, MARKS[mark].faceTo) : null;
    return true;
  }

  pointerDown(hit: PointerHit, screenX: number, screenY: number, nowMs: number): void {
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
    // 움직이는 동안은 말풍선을 숨긴다(짧은 말도). 서 있으면 짧은 말 → 장소 안내 → 기본 말 순서.
    if (moving) bubbleText = "";
    else if (nowMs < this.quipUntilMs) bubbleText = this.quip;
    else if (this.arrived) {
      bubbleText = MARKS[this.arrived].prompt;
      bubbleButton = MARKS[this.arrived].buttonLabel;
    } else bubbleText = IDLE_LINE;
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed,
      moving,
      dragging: this.dragging,
      arrived: this.arrived,
      action: this.action ? { ...this.action } : null,
      bubbleText,
      bubbleButton
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
