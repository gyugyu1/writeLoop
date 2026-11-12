import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, type LobbyLayout, type WallSide } from "./lobby-layout";
import { currentRoom, outsideExit, outsidePlace, setCurrentRoom, type RoomSpec } from "./room";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, type VillageBuildingId } from "./village";

// 3D 로비(라이트루프의 방)의 동작 규칙. 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.
// 좌표: 바닥 한 칸 = 1. x는 왼쪽→오른쪽(0..width), z는 뒷벽→앞(0..depth). 높이는 y.
// 가구에 딸린 값(장소의 서는 자리·바라볼 지점, 막힌 칸, 의자)은 지금 배치(applyLobbyLayout)에서 계산한다.

/** 방의 장소 다섯. */
export type MarkId = "board" | "window" | "desk" | "door" | "bookcase";
/** 방의 장소 다섯과 마을의 장소 넷(건물 문 앞). 지금 구역(currentArea)의 장소만 쓴다(activePlaceIds). */
export type PlaceId = MarkId | VillageBuildingId;
/** 로비의 구역: 라룹이 방, 바깥 마을. */
export type LobbyArea = "room" | "village";
export type ActionType = "wave" | "jump" | "hop" | "point" | "spin" | "look" | "poke";

export interface FloorPoint {
  x: number;
  z: number;
}

export interface PointerHit {
  /** 누른 곳의 바닥 좌표. 바닥 밖이면 null. */
  point: FloorPoint | null;
  /** 누른 곳에 있는 장소. 없으면 null. */
  mark: PlaceId | null;
  /** 라이트루프를 눌렀는지. */
  onCharacter: boolean;
  /** 누른 곳에 있는 가구(배치한 가구의 id, 딸린 의자는 그 책상). 편집 모드에서 쓴다. */
  piece?: string | null;
  /** 누른 곳이 벽 위면 그 벽과 벽을 따라간 자리. 편집 모드에서 벽 가구를 끌 때 쓴다(없으면 바닥 점에서 가장 가까운 벽으로 본다). */
  wall?: { wall: WallSide; along: number } | null;
}

/** 지금 방(room.ts의 방 데이터)의 크기·벽과, 방을 내려다보는 카메라 값. 방이 바뀌면(applyRoom) 방 값을 다시 채운다. */
export const ROOM = {
  width: currentRoom().width,
  depth: currentRoom().depth,
  wallHeight: currentRoom().wallHeight,
  /** 카메라가 바닥을 내려다보는 기울기(도). */
  pitchDeg: 42,
  /** 카메라 세로 시야각(도). 원근감의 세기. */
  fovDeg: 30,
  /** 벽 두께. 벽 바깥면까지가 방이다(그 밖은 검정). */
  wallThickness: currentRoom().wallThickness,
  /** 앞쪽 입구 발판이 방 앞끝에서 나온 길이. */
  stepDepth: outsideExit(currentRoom()).depth
};

export interface MarkInfo<I extends PlaceId = MarkId> {
  id: I;
  label: string;
  /** 바라볼 지점. 벽에 붙은 장소는 z = 0, 밖으로 가는 입구 발판은 바닥 앞끝 너머. */
  faceTo: FloorPoint;
  /** 이 장소를 쓰려고 서는 자리(가까운 곳으로 간다). */
  approach: FloorPoint[];
  prompt: string;
  buttonLabel: string;
  enterMessage: string;
}

/** 가구에 딸린 장소의 서는 자리·바라볼 지점은 지금 배치에서 채운다(applyLobbyLayout, lobby-layout). */
const PLACED = { faceTo: { x: 0, z: 0 }, approach: [] as FloorPoint[] };

export const MARKS: Record<MarkId, MarkInfo> = {
  board: {
    id: "board",
    label: "오늘의 질문",
    ...PLACED,
    prompt: "오늘의 질문 게시판이야.\n질문에 답하러 갈까?",
    buttonLabel: "들어가기",
    enterMessage: "질문에 답하기로 들어가요"
  },
  window: {
    id: "window",
    label: "생각 창가",
    ...PLACED,
    prompt: "생각 창가야.\n떠오르는 말을 바로 적어 볼까?",
    buttonLabel: "들어가기",
    enterMessage: "지금 생각나는대로로 들어가요"
  },
  desk: {
    id: "desk",
    label: "일기 책상",
    ...PLACED,
    prompt: "일기 책상이야.\n오늘 일기를 써 볼까?",
    buttonLabel: "들어가기",
    enterMessage: "영어일기로 들어가요"
  },
  door: {
    id: "door",
    label: "밖으로",
    // 지금 방의 입구 발판에서 계산한다(기본 방은 바라볼 지점 (4.0, 11.35), 서는 자리 (4.0, 10.5))
    ...outsidePlace(currentRoom()),
    prompt: "밖으로 나가 볼까?\n마을은 다음에 열려.",
    buttonLabel: "나가기",
    enterMessage: "마을은 다음 업데이트에서 열려요"
  },
  bookcase: {
    id: "bookcase",
    label: "학습 기록",
    ...PLACED,
    prompt: "지금까지 쓴 기록이 모여 있어.\n기록을 볼까?",
    buttonLabel: "들어가기",
    enterMessage: "학습 기록으로 들어가요"
  }
};

/** 마을의 장소(건물 문 앞). 지금은 이름표만 있고 말풍선·버튼이 없다(안내 글이 비어 있으면 말풍선을 띄우지 않는다). */
export const VILLAGE_MARKS: Record<VillageBuildingId, MarkInfo<VillageBuildingId>> = Object.fromEntries(
  Object.values(VILLAGE_PLACES).map((place) => [
    place.id,
    { id: place.id, label: place.label, faceTo: place.faceTo, approach: place.approach, prompt: "", buttonLabel: "", enterMessage: "" }
  ])
) as Record<VillageBuildingId, MarkInfo<VillageBuildingId>>;

/** 장소 하나의 정보(방·마을 어느 쪽이든). */
export function markInfo(id: PlaceId): MarkInfo<PlaceId> {
  return id in VILLAGE_MARKS ? VILLAGE_MARKS[id as VillageBuildingId] : MARKS[id as MarkId];
}

/** 방의 장소. */
export const ROOM_MARK_IDS: readonly MarkId[] = ["board", "window", "desk", "door", "bookcase"];
/** 마을의 장소. */
export const VILLAGE_MARK_IDS: readonly PlaceId[] = ["home", "furnitureShop", "cafe", "library"];

let area: LobbyArea = "room";

/** 지금 구역(방·마을). */
export function currentArea(): LobbyArea {
  return area;
}

/** 지금 구역의 장소들. */
export function activePlaceIds(): readonly PlaceId[] {
  return area === "village" ? VILLAGE_MARK_IDS : ROOM_MARK_IDS;
}

/** 걸어 다닐 바닥의 크기(칸). 길 찾기가 쓰는 값만 담는다. */
export type AreaSize = Pick<RoomSpec, "width" | "depth">;

/** 지금 구역의 바닥 크기: 방이면 지금 방, 마을이면 마을. */
function activeSize(): AreaSize {
  return area === "village" ? VILLAGE : currentRoom();
}

/** 지금 구역의 막힌 칸: 방이면 지금 배치의 가구, 마을이면 건물·소품·가장자리. */
function activeSolid(): ReadonlySet<string> {
  return area === "village" ? VILLAGE_SOLID_TILES : solidTiles;
}

/**
 * 장소 구역의 반지름(칸). 장소마다 서는 자리들의 가운데를 중심으로 한 원이고,
 * 벽에 붙은 장소(ZONE_REACHES_WALL)는 그 원이 바라볼 지점(벽)까지 이어진 모양이다.
 */
export const MARK_ZONE_RADIUS = 1;

/** 장소 구역이 서는 자리에서 바라볼 지점(벽)까지 이어지는 장소. 벽에 바짝 붙어도 구역 안이다. */
const ZONE_REACHES_WALL: ReadonlySet<PlaceId> = new Set<PlaceId>(["board", "window", "bookcase"]);

/** 장소 구역이 바라볼 지점(벽)까지 이어지는 장소인지. */
export function zoneReachesWall(id: PlaceId): boolean {
  return ZONE_REACHES_WALL.has(id);
}

/** 장소 구역의 가운데(서는 자리들의 가운데). */
export function markZoneCenter(id: PlaceId): FloorPoint {
  const points = markInfo(id).approach;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length
  };
}

/** 이 자리가 들어 있는 방의 장소 구역. 없으면 null. 책장과 게시판처럼 구역이 겹치는 곳에서는 구역 모양까지 더 가까운 장소다. */
export function markZoneAt(x: number, z: number): MarkId | null {
  return zoneAmong(x, z, ROOM_MARK_IDS) as MarkId | null;
}

/** 이 자리가 들어 있는 지금 구역(방·마을)의 장소 구역. 없으면 null. */
export function placeZoneAt(x: number, z: number): PlaceId | null {
  return zoneAmong(x, z, activePlaceIds());
}

function zoneAmong(x: number, z: number, ids: readonly PlaceId[]): PlaceId | null {
  let best: PlaceId | null = null;
  let bestDistance = Infinity;
  for (const id of ids) {
    const c = markZoneCenter(id);
    const end = ZONE_REACHES_WALL.has(id) ? markInfo(id).faceTo : c;
    const distance = distanceToSegment(x, z, c, end);
    if (distance <= MARK_ZONE_RADIUS && distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/** 점에서 선분 a–b까지의 거리. */
function distanceToSegment(x: number, z: number, a: FloorPoint, b: FloorPoint): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq));
  return Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
}

/** 아래 메뉴 버튼과 장소의 짝. 도착한 장소의 메뉴 버튼을 강조한다. */
export const MENU_FOR_MARK: Partial<Record<PlaceId, "question" | "diary" | "thought" | "records">> = {
  board: "question",
  desk: "diary",
  window: "thought",
  bookcase: "records"
};

export const POKE_LINES = ["헤헤, 간지러워!", "응? 불렀어?", "오늘도 같이 쓰자!"];

/** 가구가 있어 지나갈 수 없는 칸("열,행"). 일기 책상, 옷장, 책장. 지금 배치에서 계산한다(applyLobbyLayout). */
const solidTiles = new Set<string>();
export const SOLID_TILES: ReadonlySet<string> = solidTiles;

const BODY_RADIUS = 0.32;
const tileKey = (c: number, r: number) => `${c},${r}`;

// 아래 길 찾기는 막힌 칸(solid)과 방(room)을 받을 수 있다. 주지 않으면 지금 배치의 막힌 칸과 지금 방이다
// (편집 모드는 편집 중인 배치의 칸을 주고, 방에 배치 맞추기는 새 방을 준다).

export function isBlocked(x: number, z: number, solid: ReadonlySet<string> = activeSolid(), room: AreaSize = activeSize()): boolean {
  if (x < 0.25 || x > room.width - 0.25 || z < 0.45 || z > room.depth) return true;
  return solid.has(tileKey(Math.floor(x), Math.floor(z)));
}

/** 라이트루프가 그 자리에 설 수 있는지(몸 둘레까지 본다). */
export function isFree(x: number, z: number, solid: ReadonlySet<string> = activeSolid(), room: AreaSize = activeSize()): boolean {
  return (
    !isBlocked(x - BODY_RADIUS, z, solid, room) &&
    !isBlocked(x + BODY_RADIUS, z, solid, room) &&
    !isBlocked(x, z - BODY_RADIUS, solid, room) &&
    !isBlocked(x, z + 0.15, solid, room)
  );
}

export function isClearLine(a: FloorPoint, b: FloorPoint, solid: ReadonlySet<string> = activeSolid(), room: AreaSize = activeSize()): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.12);
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (!isFree(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, solid, room)) return false;
  }
  return true;
}

/**
 * from에서 goals 중 가장 가까운 곳까지 가는 길(꺾이는 점들). 마지막 점은 고른 goal 그대로다.
 * 칸 단위(대각선 포함)로 찾은 뒤, 막힘 없이 곧게 갈 수 있는 점은 건너뛰어 자연스럽게 편다.
 * 갈 수 없으면 null.
 */
export function findPath(
  from: FloorPoint,
  goals: FloorPoint[],
  solid: ReadonlySet<string> = activeSolid(),
  room: AreaSize = activeSize()
): FloorPoint[] | null {
  const reachable = goals.filter((g) => isFree(g.x, g.z, solid, room));
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
      if (nc < 0 || nr < 0 || nc >= room.width || nr >= room.depth) continue;
      if (solid.has(k) || prev.has(k)) continue;
      if (dc !== 0 && dr !== 0 && (solid.has(tileKey(c + dc, r)) || solid.has(tileKey(c, r + dr)))) continue;
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
    while (j > i && !isClearLine(cur, tiles[j], solid, room)) j -= 1;
    points.push(tiles[j]);
    cur = tiles[j];
    i = j + 1;
  }
  return points;
}

/**
 * from에서 가장 가까운, 설 수 있고 입구까지 걸어갈 수 있는 칸 가운데. 입구까지 갈 수 있는 칸이 없으면 설 수 있는 가장 가까운 칸, 그것도 없으면 null.
 */
export function nearestOpenSpot(from: FloorPoint): FloorPoint | null {
  const spots = openSpotsByDistance(from);
  // 입구: 방은 밖으로 나가는 발판 안쪽, 마을은 라룹이 집 문 앞
  const entry = area === "village" ? VILLAGE_MARKS.home.approach : MARKS.door.approach;
  return spots.find((spot) => findPath(spot, entry) !== null) ?? spots[0] ?? null;
}

/** 지금 구역에서 설 수 있는 칸 가운데들을 from에서 가까운 순으로. */
function openSpotsByDistance(from: FloorPoint): FloorPoint[] {
  const size = activeSize();
  const spots: FloorPoint[] = [];
  for (let c = 0; c < size.width; c += 1) {
    for (let r = 0; r < size.depth; r += 1) {
      if (isFree(c + 0.5, r + 0.5)) spots.push({ x: c + 0.5, z: r + 0.5 });
    }
  }
  spots.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
  return spots;
}

/** 마을에서 걸어갈 수 없는 곳을 눌렀을 때 갈 곳: point에서 가장 가까운, from에서 걸어갈 수 있는 칸 가운데. 없으면 null. */
export function nearestReachableSpot(from: FloorPoint, point: FloorPoint): FloorPoint | null {
  return openSpotsByDistance(point).find((spot) => findPath(from, [spot]) !== null) ?? null;
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
};

/**
 * 마을 끝을 둘러싼 상자: 마을 바닥 가장자리(높이 0). 화면에 보이는 바닥이 마을 끝을 넘지 않게 카메라가 멈춘다.
 * 건물·나무는 이 상자보다 높아도 화면 위로 그대로 보인다(그 너머는 풀밭·숲이라 검지 않다).
 */
export const VILLAGE_BOUNDS = {
  minX: 0,
  maxX: VILLAGE.width,
  minY: 0,
  maxY: 0,
  minZ: 0,
  maxZ: VILLAGE.depth
};

/** 지금 구역의 끝 상자(카메라가 넘지 않는다). */
export function activeBounds(): typeof ROOM_BOUNDS {
  return area === "village" ? VILLAGE_BOUNDS : ROOM_BOUNDS;
}

/**
 * 구역을 바꾼다(방 ↔ 마을). 길 찾기·장소·카메라 끝이 그 구역을 따른다. 방의 값(ROOM, ROOM_BOUNDS, 지금 배치의 막힌 칸)은 그대로 둔다.
 * 라룹이를 그 구역의 어디에 세울지는 화면이 정한다(LobbySim.placeAt).
 */
export function applyArea(next: LobbyArea): void {
  area = next;
}

/**
 * 지금 방을 바꾼다: 방 데이터와, 거기서 계산하는 방 크기(ROOM)·방 끝 상자(ROOM_BOUNDS)·밖으로 장소(MARKS.door),
 * 지금 배치에서 계산하는 값을 함께 바꾼다.
 * 앱은 아직 부르지 않는다(늘 기본 방). 집 넓히기·이층집처럼 방을 바꾸는 기능이 배치를 새 방에 맞춘(fitLayoutToRoom) 뒤 부른다.
 */
export function applyRoom(room: RoomSpec): void {
  setCurrentRoom(room);
  const step = outsideExit(room);
  Object.assign(ROOM, { width: room.width, depth: room.depth, wallHeight: room.wallHeight, wallThickness: room.wallThickness, stepDepth: step.depth });
  Object.assign(ROOM_BOUNDS, {
    minX: -room.wallThickness,
    maxX: room.width + room.wallThickness,
    maxY: room.wallHeight,
    minZ: -room.wallThickness,
    maxZ: room.depth + step.depth
  });
  Object.assign(MARKS.door, outsidePlace(room));
  // 지금 배치에서 계산하는 값(장소의 서는 자리·바라볼 지점, 막힌 칸, 의자)도 새 방으로 다시 계산한다
  applyLobbyLayout(activeLobbyLayout());
}

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
  if (area === "village") return villageCameraPose(follow, viewWidth, aspect);
  const pitch = (ROOM.pitchDeg * Math.PI) / 180;
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const tanV = Math.tan((ROOM.fovDeg * Math.PI) / 360);
  const tanH = tanV * Math.max(aspect, 0.01);
  const dist = viewWidth / (2 * tanH);
  const b = activeBounds();
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

/**
 * 마을의 카메라 자리. 방과 같은 기울기·시야각·거리로 내려다보되, 마을은 넓어서 끝 상자의 모든 모서리를 카메라 앞에 둘 수 없다.
 * 그래서 바닥으로 정한다: 화면 아래 끝에 보이는 바닥이 마을 앞끝을 넘지 않고, 화면 위 끝에 보이는 바닥이 마을 뒤끝 너머
 * VILLAGE_TOP_SLACK칸(생울타리 너머 숲)까지만 가는 범위에서 follow를 따라간다. 세로로 다 들어오면 앞끝을 화면 아래 끝에 맞춘다(넘쳐 보이는 곳은 화면 위쪽, 마을 뒤 숲이다).
 * 가로는 화면 아래 끝 줄(가장 가까워 가장 좁게 보이는 바닥)의 양 끝이 마을 옆끝을 넘지 않게 막는다.
 */
/** 마을 화면 위 끝이 마을 뒤끝 너머로 보여도 되는 칸(그 너머는 숲이다). 뒤쪽 라룹이 집 앞에서도 라룹이가 화면 위에 붙지 않게 한다. */
const VILLAGE_TOP_SLACK = 6;
/** 마을 카메라가 라룹이보다 앞(+z)을 보는 칸. */
const VILLAGE_LOOK_AHEAD = 1;

function villageCameraPose(follow: FloorPoint, viewWidth: number, aspect: number): CameraPose {
  const pitch = (ROOM.pitchDeg * Math.PI) / 180;
  const half = (ROOM.fovDeg * Math.PI) / 360;
  const tanH = Math.tan(half) * Math.max(aspect, 0.01);
  const dist = viewWidth / (2 * tanH);
  const height = dist * Math.sin(pitch);
  const back = dist * Math.cos(pitch);
  const b = VILLAGE_BOUNDS;
  // 보는 점 z가 cz면 카메라는 cz + back에 있고, 화면 아래·위 끝 줄은 카메라에서 이만큼 앞(−z)의 바닥에 닿는다
  const bottomReach = height / Math.tan(pitch + half);
  const topReach = height / Math.tan(pitch - half);
  const hi = b.maxZ - back + bottomReach;
  const lo = b.minZ - VILLAGE_TOP_SLACK - back + topReach;
  // 라룹이보다 조금 앞(카메라 쪽)을 본다. 라룹이가 화면 위쪽에 오고, 앞쪽(아래 메뉴에 가리는 쪽)이 더 넓게 보인다
  const cz = lo > hi ? hi : Math.min(Math.max(follow.z + VILLAGE_LOOK_AHEAD, lo), hi);
  // 화면 아래 끝 줄 바닥까지의 깊이(보는 방향으로 잰 거리)와 그 깊이에서 화면 옆 끝까지의 폭
  const bottomDepth = (height / Math.sin(pitch + half)) * Math.cos(half);
  const reach = bottomDepth * tanH;
  const centerX = (b.minX + b.maxX) / 2;
  const cx = b.maxX - b.minX <= reach * 2 ? centerX : Math.min(Math.max(follow.x, b.minX + reach), b.maxX - reach);
  return {
    position: { x: cx, y: height, z: cz + back },
    lookAt: { x: cx, y: 0, z: cz },
    fovDeg: ROOM.fovDeg
  };
}

/**
 * 방이 가로로 다 보이는 가장 가까운 카메라 거리(화면 가로에 보이는 폭). 편집 모드가 이 거리로 물러난다.
 * 따라갈 점이 방 양끝 어디여도 카메라가 옆으로 움직이지 않으면(cameraPose가 가로 가운데에 고정하면) 다 보이는 것이다.
 */
export function roomFitViewWidth(aspect: number): number {
  const centerX = (ROOM_BOUNDS.minX + ROOM_BOUNDS.maxX) / 2;
  const fits = (v: number) =>
    [ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX].every((x) => Math.abs(cameraPose({ x, z: ROOM.depth / 2 }, v, aspect).lookAt.x - centerX) < 1e-6);
  let lo = VIEW_WIDTH_MIN;
  let hi = VIEW_WIDTH_MAX * 3;
  if (fits(lo)) return lo;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
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

// ---------- 장소에서 '들어가기'를 누르면 하는 동작 ----------

/** 장소에서 '들어가기'를 누르면 하는 동작. 생각하기(게시판·창가), 의자에 앉기(일기 책상), 책 꺼내 펼치기(책장). */
export type SceneKind = "think" | "chair" | "book";
export const SCENE_FOR_MARK: Partial<Record<PlaceId, SceneKind>> = { board: "think", window: "think", desk: "chair", bookcase: "book" };
/** 들어가기 동작 → 판을 연 동안 유지 → 판을 닫으면(기록 화면에서 돌아오면) 제자리로. */
export type ScenePhase = "in" | "hold" | "out";
/** 들어가기 동작 시간(초). 이만큼 지나면 판을 연다(책장은 기록 화면으로 간다). */
export const SCENE_IN_SECONDS: Record<SceneKind, number> = { think: 1.0, chair: 1.2, book: 1.3 };
/** 제자리로 돌아오는 시간(초). */
export const SCENE_OUT_SECONDS: Record<SceneKind, number> = { think: 0.4, chair: 1.0, book: 1.1 };

/** 일기 책상 의자: 책상 밑에서 뒤로 빼는 거리(칸), 앉는 자리(뺀 의자 가운데)와 높이, 앉기 전에 비켜서는 의자 옆 자리. */
export const CHAIR: {
  /** 책상 밑 의자 자리. */
  home: FloorPoint;
  /** 빼는 쪽(책상 앞, 단위 벡터)과 거리. */
  pullDir: FloorPoint;
  pull: number;
  seat: FloorPoint;
  seatHeight: number;
  side: FloorPoint;
  /** 앉아서 책상을 보는 방향(heading). */
  heading: number;
} = { home: { x: 0, z: 0 }, pullDir: { x: 0, z: 1 }, pull: 0, seat: { x: 0, z: 0 }, seatHeight: 0, side: { x: 0, z: 0 }, heading: 0 };

let activeLayout: LobbyLayout = DEFAULT_LOBBY_LAYOUT;

/**
 * 가구 배치를 바꾼다. 장소의 서는 자리·바라볼 지점, 막힌 칸, 의자를 이 배치에서 다시 계산한다.
 * (안내 문구처럼 배치와 관계없는 것은 그대로다.)
 */
export function applyLobbyLayout(layout: LobbyLayout): void {
  activeLayout = layout;
  const geometry = layoutGeometry(layout, ROOM.width);
  for (const id of Object.keys(geometry.places) as (keyof typeof geometry.places)[]) {
    markInfo(id).approach = geometry.places[id].approach;
    markInfo(id).faceTo = geometry.places[id].faceTo;
  }
  solidTiles.clear();
  for (const key of geometry.solidTiles) solidTiles.add(key);
  Object.assign(CHAIR, geometry.chair);
}

/** 지금 가구 배치. */
export function activeLobbyLayout(): LobbyLayout {
  return activeLayout;
}

applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
/** 의자: 옆으로 비켜서며 의자를 빼는 시간, 올라앉는 시간(초). 일어날 때도 같다. */
const CHAIR_STEP_SECONDS = 0.4;
const CHAIR_SIT_SECONDS = 0.6;
/** 책: 손이 책장 칸에 닿는 때, 앞(카메라 쪽)으로 돌아서는 시간, 펼치는 때(초). 클립 book_take와 맞춘다. */
const BOOK_REACH_SECONDS = 0.4;
const BOOK_OPEN_FROM = 0.7;
/** 책을 다시 꽂을 때 책장 쪽으로 돌아서는 시간(초). 그 뒤 클립 book_put을 재생한다. */
export const BOOK_TURN_BACK_SECONDS = 0.3;
const BOOK_PUT_REACH = 0.35;

export interface SceneState {
  kind: SceneKind;
  mark: PlaceId;
  phase: ScenePhase;
  /** 이 단계가 시작된 뒤 지난 시간(초). */
  t: number;
}

function easeInOut(x: number): number {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
}

function lerpPoint(a: FloorPoint, b: FloorPoint, k: number): FloorPoint {
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}

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
  arrived: PlaceId | null;
  /** 지금 장소 안내(글·버튼)를 보이는 장소. 도착했거나 구역 안이면 걷는 중에도 그 장소다. 아래 메뉴 강조에 쓴다. */
  place: PlaceId | null;
  action: { type: ActionType; t: number } | null;
  posture: { kind: PostureKind; t: number } | null;
  /** 장소에서 '들어가기'를 누른 뒤의 동작. 없으면 null. */
  scene: SceneState | null;
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
  arrived: PlaceId | null = null;
  dragging = false;
  /** 앉기 자세(서 있으면 null). 앉아 있는 동안과 일어나는 동안은 걷기·동작이 기다린다. */
  posture: { kind: PostureKind; t: number } | null = null;
  /** 장소에서 '들어가기'를 누른 뒤의 동작. 하는 동안은 걷기·누르기·앉기가 기다린다. */
  scene: SceneState | null = null;
  /** 들어가기 전에 서 있던 자리(돌아올 곳). */
  private sceneFrom: FloorPoint | null = null;
  /** 들어가기 동작이 끝나 판을 열 때가 된 장소. 화면이 한 번 가져간다. */
  private sceneEntered: PlaceId | null = null;
  /** 들어가기 동작 중에 온 인사의 동작. 제자리로 돌아온 뒤 한다. */
  private greetAfterScene: ActionType | null = null;
  private path: FloorPoint[] = [];
  private target: PlaceId | null = null;
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
  /** 끌기를 마친 뒤 멈추면 장소 구역 안인지 본다. */
  private checkZoneWhenStopped = false;
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
    // '들어가기' 동작 중이면(판을 연 채 돌아왔거나 책을 꽂는 중) 동작을 마치고 제자리로 돌아온 뒤 인사한다
    if (this.scene) {
      this.greetAfterScene = action;
      return;
    }
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

  /**
   * 장소에서 '들어가기'를 눌렀을 때의 동작을 시작한다. 동작이 없는 장소이거나 "동작 줄이기"면 false(바로 들어간다).
   * 동작이 끝나면 consumeSceneEntered()가 그 장소를 한 번 돌려준다.
   */
  startScene(mark: PlaceId, nowMs: number): boolean {
    const kind = SCENE_FOR_MARK[mark];
    if (!kind || this.reduceMotion) return false;
    this.greeting = null;
    this.quipUntilMs = 0;
    this.path = [];
    this.vx = 0;
    this.vz = 0;
    this.target = null;
    this.action = null;
    this.posture = null;
    this.down = null;
    this.dragging = false;
    this.dragPoint = null;
    this.checkZoneWhenStopped = false;
    this.idleSinceMs = nowMs;
    this.arrived = mark;
    this.sceneFrom = { x: this.x, z: this.z };
    this.sceneEntered = null;
    this.scene = { kind, mark, phase: "in", t: 0 };
    this.goalHeading = kind === "chair" ? CHAIR.heading : headingTo({ x: this.x, z: this.z }, markInfo(mark).faceTo);
    return true;
  }

  /** 들어가기 동작이 끝나 판을 열 장소(한 번만 돌려준다). */
  consumeSceneEntered(): PlaceId | null {
    const mark = this.sceneEntered;
    this.sceneEntered = null;
    return mark;
  }

  /** 판을 닫았거나 기록 화면에서 돌아왔을 때: 제자리로 돌아오기 시작한다. 들어가는 중이면 바로 거둔다. */
  endScene(): void {
    if (!this.scene) return;
    if (this.scene.phase === "in") this.cancelScene();
    else if (this.scene.phase === "hold") this.scene = { ...this.scene, phase: "out", t: 0 };
  }

  /** 동작을 바로 거두고 들어가기 전 자리에 선다(아래 메뉴를 눌렀을 때). */
  cancelScene(): void {
    if (!this.scene) return;
    const mark = this.scene.mark;
    if (this.sceneFrom) {
      this.x = this.sceneFrom.x;
      this.z = this.sceneFrom.z;
    }
    this.scene = null;
    this.sceneFrom = null;
    this.sceneEntered = null;
    this.vx = 0;
    this.vz = 0;
    this.goalHeading = headingTo({ x: this.x, z: this.z }, markInfo(mark).faceTo);
    this.greetAfterSceneEnds();
  }

  /**
   * 가구 배치가 바뀐 뒤(applyLobbyLayout): 걷기·끌기·들어가기 동작·앉기를 멈춘다.
   * 서 있는 자리가 막혔으면 가장 가까운, 입구로 걸어갈 수 있는 칸 가운데로 옮긴다.
   */
  relayout(nowMs: number): void {
    if (this.scene && this.sceneFrom) {
      this.x = this.sceneFrom.x;
      this.z = this.sceneFrom.z;
    }
    this.scene = null;
    this.sceneFrom = null;
    this.sceneEntered = null;
    this.greetAfterScene = null;
    this.path = [];
    this.target = null;
    this.arrived = null;
    this.goalHeading = null;
    this.action = null;
    this.posture = null;
    this.down = null;
    this.dragging = false;
    this.dragPoint = null;
    this.vx = 0;
    this.vz = 0;
    this.idleSinceMs = nowMs;
    if (!isFree(this.x, this.z)) {
      const spot = nearestOpenSpot({ x: this.x, z: this.z });
      if (spot) {
        this.x = spot.x;
        this.z = spot.z;
      }
    }
    this.checkZoneWhenStopped = true;
  }

  /** 구역을 바꿀 때: 하던 일을 모두 멈추고 point에 heading을 보고 선다(장소 도착은 없다). */
  placeAt(point: FloorPoint, heading: number, nowMs: number): void {
    this.relayout(nowMs);
    this.x = point.x;
    this.z = point.z;
    this.heading = heading;
    this.goalHeading = heading;
    this.checkZoneWhenStopped = false;
  }

  /** 들어가기 동작 중에 왔던 인사를 한다(앞을 보고 동작한다). */
  private greetAfterSceneEnds(): void {
    const action = this.greetAfterScene;
    this.greetAfterScene = null;
    if (!action || !this.greeting) return;
    this.target = null;
    this.arrived = null;
    this.goalHeading = 0;
    this.startAction(action);
  }

  /** 의자를 책상 밑에서 뺀 정도(0 들어가 있음 ~ 1 다 뺌). */
  chairPull(): number {
    const s = this.scene;
    if (!s || s.kind !== "chair") return 0;
    if (s.phase === "in") return easeInOut(s.t / CHAIR_STEP_SECONDS);
    if (s.phase === "hold") return 1;
    // 일어나 옆으로 내려선 뒤 의자를 다시 넣는다
    return 1 - easeInOut((s.t - CHAIR_SIT_SECONDS) / CHAIR_STEP_SECONDS);
  }

  /** 의자에 올라앉아 몸 전체가 들린 높이(칸). */
  sceneLift(): number {
    const s = this.scene;
    if (!s || s.kind !== "chair") return 0;
    let k: number;
    if (s.phase === "in") k = (s.t - CHAIR_STEP_SECONDS) / CHAIR_SIT_SECONDS;
    else if (s.phase === "hold") k = 1;
    else k = 1 - s.t / CHAIR_SIT_SECONDS;
    k = Math.min(1, Math.max(0, k));
    // 폴짝 올라앉는다(내려올 때도)
    return CHAIR.seatHeight * easeInOut(k) + 0.25 * Math.sin(Math.PI * k);
  }

  /** 손에 든 책: 보이는지, 두 손으로 든 정도(0 오른손만 ~ 1 두 손), 펼친 정도(0 덮음 ~ 1 펼침). */
  sceneBook(): { visible: boolean; hold: number; open: number } {
    const s = this.scene;
    const hidden = { visible: false, hold: 0, open: 0 };
    if (!s || s.kind !== "book") return hidden;
    if (s.phase === "in") {
      if (s.t < BOOK_REACH_SECONDS) return hidden;
      return {
        visible: true,
        hold: easeInOut((s.t - BOOK_REACH_SECONDS) / 0.3),
        open: easeInOut((s.t - BOOK_OPEN_FROM) / 0.3)
      };
    }
    if (s.phase === "hold") return { visible: true, hold: 1, open: 1 };
    // 책장 쪽으로 돌아서며 덮고, 손이 칸에 닿으면 꽂혀 사라진다
    const put = s.t - BOOK_TURN_BACK_SECONDS;
    if (put >= BOOK_PUT_REACH) return hidden;
    return { visible: true, hold: 1 - easeInOut(put / BOOK_PUT_REACH), open: 1 - easeInOut(s.t / BOOK_TURN_BACK_SECONDS) };
  }

  /** 들어가기 동작을 한 프레임 진행한다. */
  private updateScene(step: number): void {
    const s = this.scene;
    if (!s || !this.sceneFrom) return;
    s.t += step;
    const mark = markInfo(s.mark);
    const prevX = this.x;
    const prevZ = this.z;
    if (s.kind === "chair") {
      // 옆으로 비켜서며 의자를 빼고, 의자에 올라앉아 책상을 본다. 돌아올 때는 거꾸로.
      let at: FloorPoint;
      if (s.phase === "in") {
        at =
          s.t < CHAIR_STEP_SECONDS
            ? lerpPoint(this.sceneFrom, CHAIR.side, easeInOut(s.t / CHAIR_STEP_SECONDS))
            : lerpPoint(CHAIR.side, CHAIR.seat, easeInOut((s.t - CHAIR_STEP_SECONDS) / CHAIR_SIT_SECONDS));
      } else if (s.phase === "hold") at = CHAIR.seat;
      else {
        at =
          s.t < CHAIR_SIT_SECONDS
            ? lerpPoint(CHAIR.seat, CHAIR.side, easeInOut(s.t / CHAIR_SIT_SECONDS))
            : lerpPoint(CHAIR.side, this.sceneFrom, easeInOut((s.t - CHAIR_SIT_SECONDS) / CHAIR_STEP_SECONDS));
      }
      this.x = at.x;
      this.z = at.z;
      this.goalHeading = CHAIR.heading;
    } else if (s.kind === "book") {
      // 책장을 보고 꺼낸 뒤 앞(카메라 쪽)으로 돌아서서 펼친다. 꽂을 때는 다시 책장 쪽으로 돌아선다.
      const facing = headingTo(this.sceneFrom, mark.faceTo);
      if (s.phase === "out") this.goalHeading = facing;
      else this.goalHeading = s.phase === "in" && s.t < BOOK_REACH_SECONDS + 0.1 ? facing : 0;
    }
    // 걷는 모습은 옮겨 간 만큼의 속도로 정한다(의자 옆으로 비켜서기·돌아가기)
    const sitting = s.kind === "chair" && this.sceneLift() > 0.01;
    this.vx = step > 0 && !sitting ? (this.x - prevX) / step : 0;
    this.vz = step > 0 && !sitting ? (this.z - prevZ) / step : 0;
    if (this.goalHeading !== null) this.heading = lerpAngle(this.heading, this.goalHeading, Math.min(1, step * this.settings.turn));

    if (s.phase === "in" && s.t >= SCENE_IN_SECONDS[s.kind]) {
      this.scene = { ...s, phase: "hold", t: 0 };
      this.sceneEntered = s.mark;
    } else if (s.phase === "out" && s.t >= SCENE_OUT_SECONDS[s.kind]) {
      this.x = this.sceneFrom.x;
      this.z = this.sceneFrom.z;
      this.vx = 0;
      this.vz = 0;
      this.scene = null;
      this.sceneFrom = null;
      this.arrived = s.mark;
      this.goalHeading = headingTo({ x: this.x, z: this.z }, mark.faceTo);
      this.greetAfterSceneEnds();
    }
  }

  /**
   * 바닥 점이나 장소로 걸어간다. 갈 수 없으면 false(움직이지 않는다).
   * 마을에서는 걸어갈 수 없는 곳(건물·분수 등)이나 마을 밖을 눌러도, 누른 곳에서 가장 가까운 걸어갈 수 있는 곳으로 간다(방은 움직이지 않는다).
   */
  goTo(point: FloorPoint | null, mark: PlaceId | null): boolean {
    let goals: FloorPoint[];
    if (mark) goals = markInfo(mark).approach;
    else if (point && isFree(point.x, point.z)) goals = [point];
    else if (point && area === "village") {
      const spot = nearestReachableSpot({ x: this.x, z: this.z }, point);
      if (!spot) return false;
      goals = [spot];
    } else return false;
    const path = findPath({ x: this.x, z: this.z }, goals);
    if (!path) return false;
    this.wake();
    this.path = path;
    this.target = mark;
    this.arrived = null;
    this.action = null;
    const last = path[path.length - 1] ?? { x: this.x, z: this.z };
    this.goalHeading = mark ? headingTo(last, markInfo(mark).faceTo) : null;
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
    if (wasDrag) {
      this.checkZoneWhenStopped = true;
      return "drag-end";
    }
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
    this.checkZoneWhenStopped = false;
    this.path = [];
    this.target = null;
    this.arrived = null;
    this.goalHeading = null;
    this.action = null;
  }

  /** 장소에 도착한다(그 장소를 바라본다). mark가 null이면 도착이 아니다. */
  private arrive(mark: PlaceId | null): void {
    this.arrived = mark;
    this.goalHeading = mark ? headingTo({ x: this.x, z: this.z }, markInfo(mark).faceTo) : null;
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

    // 장소에서 '들어가기'를 누른 뒤의 동작: 하는 동안은 걷기·앉기가 기다린다
    if (this.scene) {
      this.updateScene(step);
      this.idleSinceMs = nowMs;
      return;
    }

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
          // 장소를 눌러 왔으면 그 장소, 바닥을 눌러 왔으면 멈춘 자리의 장소 구역(없으면 도착이 아니다)
          this.arrive(this.target ?? placeZoneAt(this.x, this.z));
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

    // 끌기를 마친 뒤 멈추면, 멈춘 자리가 장소 구역 안인지 본다
    if (this.checkZoneWhenStopped && !this.dragging && !this.path.length && Math.hypot(this.vx, this.vz) <= 0.05) {
      this.checkZoneWhenStopped = false;
      this.arrive(placeZoneAt(this.x, this.z));
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
    // 장소 구역 안에 있으면 걷거나 끌리는 중에도 그 장소 안내를 보인다. 구역 밖에서 움직이는 동안은 말풍선을 숨긴다.
    // 서 있으면 짧은 말 → 로비 인사 → 장소 안내 순서이고, 셋 다 없으면 말풍선이 없다(기본 말은 없앴다).
    // 장소에서 '들어가기'를 누른 뒤에는 말풍선을 거둔다
    const place = this.scene ? null : this.currentPlace();
    if (this.scene) bubbleText = "";
    else if (moving && !place) bubbleText = "";
    else if (nowMs < this.quipUntilMs) bubbleText = this.quip;
    else if (!moving && this.greeting) {
      bubbleText = this.greeting;
      idleBubble = true;
    } else if (place && markInfo(place).prompt) {
      bubbleText = markInfo(place).prompt;
      bubbleButton = markInfo(place).buttonLabel;
    }
    const shownPlace = bubbleButton !== null ? place : null;
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed,
      moving,
      dragging: this.dragging,
      arrived: this.arrived,
      place: shownPlace,
      action: this.action ? { ...this.action } : null,
      posture: this.posture ? { ...this.posture } : null,
      scene: this.scene ? { ...this.scene } : null,
      bubbleText,
      bubbleButton,
      idleBubble
    };
  }

  /** 말풍선 버튼을 눌렀을 때 띄울 안내. 도착한 곳이 없으면 null. */
  enterMessage(): string | null {
    const place = this.currentPlace();
    return place ? markInfo(place).enterMessage : null;
  }

  /** 지금 있는 장소: 도착한 장소, 아니면 지금 서 있거나 지나는 장소 구역. 없으면 null. */
  currentPlace(): PlaceId | null {
    return this.arrived ?? placeZoneAt(this.x, this.z);
  }

  /** 시험용으로만 쓰는 무작위(두리번 간격 등). */
  nextRandom(): number {
    return this.random();
  }
}
