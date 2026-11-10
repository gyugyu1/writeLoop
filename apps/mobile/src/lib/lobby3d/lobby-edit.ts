import { MARK_ZONE_RADIUS, ROOM, TAP_MAX_MOVE_PX, findPath, isFree, zoneReachesWall, type FloorPoint, type PointerHit } from "./engine";
import { furnitureType, type FurniturePlaceId, type FurnitureType } from "./furniture-catalog";
import {
  DEFAULT_LOBBY_LAYOUT,
  floorPieceBounds,
  floorPieceSize,
  layoutGeometry,
  layoutItem,
  makeLayout,
  sameLobbyLayout,
  storedItems,
  surfaceSlotsOf,
  tabletopPose,
  withItemPlacement,
  type Facing,
  type FloorPlacementData,
  type FurnitureItem,
  type LobbyLayout,
  type StoredItem,
  type TabletopPlacementData,
  type WallPlacementData,
  type WallSide
} from "./lobby-layout";
import { currentRoom, outsidePlace, roomWallLength, type RoomSpec } from "./room";

// 홈 '꾸미기'(편집 모드)의 가구 옮기기·돌리기와, 가구를 놓을 수 있는 배치인지 판단.
// 바닥 가구는 칸에 맞춰 옮기고 돌리며, 벽 가구는 뒷벽·양옆 벽을 따라 반 칸 단위로 옮긴다. 탁상형 소품은 받침 가구의 자리 사이로 옮기고 돌린다.
// 치울 수 있는 가구는 보관함에 넣고, 보관함에서 꺼내면 방 가운데에서 가까운 놓을 수 있는 자리에 놓는다.
// 가구마다의 값(배치 유형·크기·높이·장소·치울 수 있는지)은 카탈로그에서 읽고, 가구 이름을 따로 다루지 않는다.
// 3D 그리기와 버튼은 화면이 맡고, 여기서는 편집 중인 배치와 고른 가구·빨간 가구(인스턴스 id)만 다룬다.

const EPS = 1e-6;
/** 벽 가구 앞 바닥 띠의 깊이(칸). 편집 모드에서 이 띠를 눌러도 그 벽 가구를 고른다(옆벽 가구는 화면에서 아주 좁게 보인다). */
const WALL_FRONT_DEPTH = 1;
/** 벽 가구 폭의 양 끝을 벽 끝(모서리, 옆벽 앞끝)에서 띄우는 거리(칸). */
const WALL_END_GAP = 0.2;
/** 벽 가구를 벽을 따라 맞추는 단위(칸). */
const WALL_STEP = 0.5;

/** 편집 모드에서 고르는 가구(배치한 가구의 id). */
export type EditPieceId = string;

const typeOf = (layout: LobbyLayout, id: string): FurnitureType => furnitureType(layoutItem(layout, id)!.type);

/** 벽에 거는 가구인지. */
export function isWallPiece(layout: LobbyLayout, id: string): boolean {
  return typeOf(layout, id).mount === "wall";
}

/** 받침 가구 위에 올리는 탁상형 소품인지. */
export function isTabletopPiece(layout: LobbyLayout, id: string): boolean {
  return typeOf(layout, id).mount === "tabletop";
}

type Bounds = ReturnType<typeof floorPieceBounds>;

const insideBounds = (b: Bounds, p: FloorPoint) => p.x >= b.minX - EPS && p.x <= b.maxX + EPS && p.z >= b.minZ - EPS && p.z <= b.maxZ + EPS;

const overlaps = (a: Bounds, b: Bounds) => a.minX < b.maxX - EPS && b.minX < a.maxX - EPS && a.minZ < b.maxZ - EPS && b.minZ < a.maxZ - EPS;

/** 벽 가구 바로 아래 칸: 그 벽에 붙은 첫 줄 칸 중 벽 가구 폭에 걸친 칸의 범위. */
function underWallBounds(item: FurnitureItem, type: FurnitureType, room: RoomSpec): Bounds {
  const { wall, along } = item.wall!;
  const half = type.size.width / 2;
  const from = Math.floor(along - half + EPS);
  const to = Math.ceil(along + half - EPS);
  if (wall === "back") return { minX: from, maxX: to, minZ: 0, maxZ: 1 };
  if (wall === "left") return { minX: 0, maxX: 1, minZ: from, maxZ: to };
  return { minX: room.width - 1, maxX: room.width, minZ: from, maxZ: to };
}

/**
 * 가구를 놓을 수 있는 배치인지(카탈로그 값으로만 판단한다).
 * 1. 바닥 가구(바닥형·덮개형)의 칸이 방 안이다.
 * 2. 길을 막는 가구끼리, 덮개끼리 칸이 겹치지 않는다(덮개는 바닥형과 겹쳐도 된다).
 * 3. 바닥 가구의 윗면이 벽 가구의 아래 끝보다 높으면 그 벽 가구 바로 아래 칸에 있지 않다.
 * 4. 벽 가구 폭이 벽 안(양 끝에서 띄워)이고, 같은 벽의 벽 가구끼리 겹치지 않는다.
 * 5. 장소마다 서는 자리 중 하나에 입구(밖으로의 서는 자리)에서 걸어갈 수 있다.
 * 6. 탁상형 소품은 방에 놓인 받침 가구의 있는 자리에 올라 있고, 한 자리에 하나만 있다. 탁상형은 1~5에 들지 않는다.
 * 방(크기·걸 수 있는 벽·입구)은 주지 않으면 지금 방이다. 방에 배치 맞추기는 새 방을 준다.
 */
export function isPlaceableLayout(layout: LobbyLayout, room: RoomSpec = currentRoom()): boolean {
  const typed = layout.items.map((item) => ({ item, type: furnitureType(item.type) }));
  const taken = new Set<string>();
  for (const { item } of typed) {
    if (!item.on) continue;
    if (!tabletopPose(layout, item)) return false;
    const key = `${item.on.parent}#${item.on.slot}`;
    if (taken.has(key)) return false;
    taken.add(key);
  }
  const grounded = typed.filter((t) => t.item.floor).map((t) => ({ ...t, box: floorPieceBounds(t.item.type, t.item.floor!) }));
  const walls = typed.filter((t) => t.item.wall);
  for (const { box } of grounded) {
    if (box.minX < -EPS || box.minZ < -EPS || box.maxX > room.width + EPS || box.maxZ > room.depth + EPS) return false;
  }
  for (let i = 0; i < grounded.length; i += 1) {
    for (let j = i + 1; j < grounded.length; j += 1) {
      const a = grounded[i];
      const b = grounded[j];
      const clash = (a.type.blocksWalk && b.type.blocksWalk) || (a.type.mount === "cover" && b.type.mount === "cover");
      if (clash && overlaps(a.box, b.box)) return false;
    }
  }
  for (const { item, type } of walls) {
    const { wall, along } = item.wall!;
    const half = type.size.width / 2;
    if (!room.hangWalls.includes(wall)) return false;
    if (along - half < WALL_END_GAP - EPS || along + half > roomWallLength(room, wall) - WALL_END_GAP + EPS) return false;
  }
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const a = walls[i];
      const b = walls[j];
      if (a.item.wall!.wall !== b.item.wall!.wall) continue;
      const gap = Math.abs(a.item.wall!.along - b.item.wall!.along);
      if (gap < (a.type.size.width + b.type.size.width) / 2 - EPS) return false;
    }
  }
  for (const w of walls) {
    const under = underWallBounds(w.item, w.type, room);
    for (const g of grounded) {
      if (g.type.height.top > w.type.height.bottom + EPS && overlaps(g.box, under)) return false;
    }
  }
  const geometry = layoutGeometry(layout, room.width);
  const door = outsidePlace(room).approach;
  const start = door.find((p) => isFree(p.x, p.z, geometry.solidTiles, room));
  if (!start) return false;
  return (Object.keys(geometry.places) as (keyof typeof geometry.places)[]).every(
    (id) => findPath(start, geometry.places[id].approach, geometry.solidTiles, room) !== null
  );
}

/** 칸에 맞춘 가구 가운데: 그 종류의 칸 모양이 바닥 칸에 딱 맞는, point에서 가장 가까운 자리. */
export function snapPiece(type: string, facing: Facing, point: FloorPoint): FloorPoint {
  const { width, depth } = floorPieceSize(type, facing);
  return { x: Math.round(point.x - width / 2) + width / 2, z: Math.round(point.z - depth / 2) + depth / 2 };
}

/**
 * 보관함에서 꺼낸 가구를 놓을 자리. 그 가구를 넣은 배치가 놓을 수 있는 배치인 자리 가운데
 * 바닥 가구는 앞을 보는 방향(0)으로 칸에 맞춘 자리 중 방 가운데에서 가장 가까운 자리,
 * 벽 가구는 뒷벽·왼벽·오른벽 차례로(그 방에서 걸 수 있는 벽만) 벽 가운데에서 가장 가까운 자리,
 * 탁상형은 받침 가구의 빈자리 중 첫 번째(배치의 가구 순서, 자리 번호 순서)다. 없으면 null. 방은 주지 않으면 지금 방이다.
 */
export function freeSpotFor(layout: LobbyLayout, item: StoredItem, room: RoomSpec = currentRoom()): FurnitureItem | null {
  const type = furnitureType(item.type);
  const fits = (candidate: FurnitureItem) => isPlaceableLayout(makeLayout([...layout.items, candidate], storedItems(layout)), room);
  if (type.mount === "tabletop") {
    for (const spot of surfaceSlotsOf(layout)) {
      const candidate = { id: item.id, type: item.type, on: { parent: spot.parent, slot: spot.slot, facing: 0 as Facing } };
      if (fits(candidate)) return candidate;
    }
    return null;
  }
  if (type.mount === "wall") {
    const half = type.size.width / 2;
    for (const wall of (["back", "left", "right"] as WallSide[]).filter((w) => room.hangWalls.includes(w))) {
      const length = roomWallLength(room, wall);
      const spots: number[] = [];
      for (let along = Math.ceil((half + WALL_END_GAP) / WALL_STEP) * WALL_STEP; along <= length - half - WALL_END_GAP + EPS; along += WALL_STEP) spots.push(along);
      spots.sort((a, b) => Math.abs(a - length / 2) - Math.abs(b - length / 2) || a - b);
      for (const along of spots) {
        const candidate = { id: item.id, type: item.type, wall: { wall, along } };
        if (fits(candidate)) return candidate;
      }
    }
    return null;
  }
  const { width, depth } = floorPieceSize(item.type, 0);
  const center = { x: room.width / 2, z: room.depth / 2 };
  const spots: FloorPoint[] = [];
  for (let x = width / 2; x <= room.width - width / 2 + EPS; x += 1) {
    for (let z = depth / 2; z <= room.depth - depth / 2 + EPS; z += 1) spots.push({ x, z });
  }
  // 곧은 거리를 제곱으로 비교한다(반 칸 단위라 정확하고, 같은 거리면 아래 순서로 정한다)
  const dist = (p: FloorPoint) => (p.x - center.x) ** 2 + (p.z - center.z) ** 2;
  spots.sort((a, b) => dist(a) - dist(b) || a.z - b.z || a.x - b.x);
  for (const { x, z } of spots) {
    const candidate = { id: item.id, type: item.type, floor: { x, z, facing: 0 as Facing } };
    if (fits(candidate)) return candidate;
  }
  return null;
}

/**
 * 배치를 다른 방으로 옮긴다(집 넓히기 같은 방을 바꾸는 기능이 부른다). 결과는 늘 새 방에서 놓을 수 있는 배치다.
 * 1. 새 방에서도 배치 전체가 놓을 수 있으면 그대로 둔다.
 * 2. 아니면 가구를 하나씩 다시 놓는다: 장소 가구 먼저, 그다음 나머지 가구를 배치 순서대로, 탁상형 소품은 맨 뒤에.
 *    지금 자리 그대로 넣어도 놓을 수 있으면 그 자리에 둔다. 아니면 장소 가구는 꺼낼 때와 같은 규칙으로 새 방의 놓을 수 있는 자리로 옮기고,
 *    나머지 가구는 보관함 끝에 넣는다. 받침 가구를 보관함에 넣으면 그 위 소품도 받침 가구 다음에(자리 번호 순서로) 함께 넣는다.
 * 3. 보관함에 있던 가구는 그대로 보관함에 둔다. 방에 남는 가구는 원래 배치 순서대로다.
 */
export function fitLayoutToRoom(layout: LobbyLayout, room: RoomSpec): LobbyLayout {
  if (isPlaceableLayout(layout, room)) return layout;
  const isPlace = (item: FurnitureItem) => Boolean(furnitureType(item.type).place);
  const order = [
    ...layout.items.filter((item) => isPlace(item)),
    ...layout.items.filter((item) => !isPlace(item) && !item.on),
    ...layout.items.filter((item) => item.on)
  ];
  const placed: FurnitureItem[] = [];
  const stored: StoredItem[] = [];
  const gone = new Set<string>();
  for (const item of order) {
    if (gone.has(item.id)) continue;
    if (isPlaceableLayout(makeLayout([...placed, item], []), room)) {
      placed.push(item);
      continue;
    }
    if (isPlace(item)) {
      const spot = freeSpotFor(makeLayout(placed, []), { id: item.id, type: item.type }, room);
      // 방의 최소 크기(room.ts) 덕에 장소 가구는 늘 놓을 자리가 있다
      if (!spot) throw new Error(`no spot for ${item.id} in room ${room.id}`);
      placed.push(spot);
      continue;
    }
    const onTop = layout.items.filter((p) => p.on?.parent === item.id).sort((a, b) => a.on!.slot - b.on!.slot);
    for (const p of [item, ...onTop]) {
      gone.add(p.id);
      stored.push({ id: p.id, type: p.type });
    }
  }
  // 방에 남는 가구는 원래 배치 순서를 지킨다(꺼낼 때 빈자리를 찾는 순서가 배치 순서다)
  const at = new Map(layout.items.map((item, i) => [item.id, i]));
  placed.sort((a, b) => at.get(a.id)! - at.get(b.id)!);
  return makeLayout(placed, [...storedItems(layout), ...stored]);
}

/** 바닥 점에서 가장 가까운 받침 가구의 소품 자리(같은 거리면 배치의 가구 순서, 자리 번호 순서로 앞선 것). 받침 가구가 없으면 null. */
function nearestSlot(layout: LobbyLayout, point: FloorPoint): { parent: string; slot: number } | null {
  let best: { parent: string; slot: number; dist: number } | null = null;
  for (const spot of surfaceSlotsOf(layout)) {
    const dist = (spot.x - point.x) ** 2 + (spot.z - point.z) ** 2;
    if (!best || dist < best.dist - EPS) best = { parent: spot.parent, slot: spot.slot, dist };
  }
  return best ? { parent: best.parent, slot: best.slot } : null;
}

/** 바닥 점에서 가장 가까운 벽과 그 벽을 따라간 자리. */
export function nearestWall(point: FloorPoint): { wall: WallSide; along: number } {
  const toBack = point.z;
  const toLeft = point.x;
  const toRight = ROOM.width - point.x;
  if (toBack <= toLeft && toBack <= toRight) return { wall: "back", along: point.x };
  return toLeft <= toRight ? { wall: "left", along: point.z } : { wall: "right", along: point.z };
}

/** 바닥 점에서 그 방의 걸 수 있는 벽 가운데 가장 가까운 벽과 그 벽을 따라간 자리(탭으로 벽 가구를 옮길 때). */
function nearestHangWall(point: FloorPoint, room: RoomSpec): { wall: WallSide; along: number } {
  const distance: Record<WallSide, number> = { back: point.z, left: point.x, right: ROOM.width - point.x };
  const wall = room.hangWalls.reduce((best, side) => (distance[side] < distance[best] ? side : best));
  return { wall, along: wall === "back" ? point.x : point.z };
}

/**
 * 바닥 점이 벽 가구 앞 바닥 띠(그 벽에서 WALL_FRONT_DEPTH 안, 벽 가구 폭 안)에 있으면 그 벽 가구의 id.
 * 모서리처럼 여러 띠에 들면 벽 가구가 있는 띠 가운데 가장 가까운 벽의 가구다.
 */
export function wallPieceInFront(layout: LobbyLayout, point: FloorPoint): string | null {
  let best: { id: string; depth: number } | null = null;
  for (const item of layout.items) {
    const type = furnitureType(item.type);
    if (type.mount !== "wall") continue;
    const { wall, along } = item.wall!;
    const depth = wall === "back" ? point.z : wall === "left" ? point.x : ROOM.width - point.x;
    const at = wall === "back" ? point.x : point.z;
    if (depth < -EPS || depth >= WALL_FRONT_DEPTH || Math.abs(at - along) > type.size.width / 2 + EPS) continue;
    if (!best || depth < best.depth) best = { id: item.id, depth };
  }
  return best?.id ?? null;
}

/** 누른 곳의 벽 자리: 벽 위를 눌렀으면 그 벽, 아니면 바닥 점에서 가장 가까운 벽. */
function wallPointOf(hit: PointerHit): { wall: WallSide; along: number } | null {
  if (hit.wall) return hit.wall;
  return hit.point && nearRoom(hit.point) ? nearestWall(hit.point) : null;
}

/** 끄는 가구가 옮겨 갈 자리(벽 가구는 손가락 바닥 점)가 방에서 이만큼(칸) 넘게 벗어나면 옮기지 않는다(마지막 자리에 멈춘다). */
const DRAG_REACH = 1.5;

/**
 * 끌 때 쓸 수 있는 바닥 점인지. 손가락이 벽 위나 그 위쪽으로 가면 그 방향의 바닥 점은 벽 너머 아주 먼 곳이라,
 * 그대로 쓰면 가구가 화면 밖으로 날아간다.
 */
function nearRoom(p: FloorPoint): boolean {
  return p.x >= -DRAG_REACH && p.x <= ROOM.width + DRAG_REACH && p.z >= -DRAG_REACH && p.z <= ROOM.depth + DRAG_REACH;
}

/** 바닥에 칠할 칸: 가구가 차지하는 범위와, 거기에 놓을 수 있는지(빨강이면 false). 탁상형 소품은 받침 가구 윗면의 그 자리 칸이다. */
export interface EditMark {
  piece: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  ok: boolean;
  /** 칠하는 높이(받침 가구 윗면). 없으면 바닥이다. */
  y?: number;
}

/** 벽에 칠할 자리: 벽 가구가 걸린 벽과 그 폭(벽을 따라간 범위), 거기에 놓을 수 있는지. */
export interface EditWallMark {
  piece: string;
  wall: WallSide;
  from: number;
  to: number;
  /** 칠하는 높이 범위(벽 가구가 걸린 아래 끝~위 끝). */
  bottom: number;
  top: number;
  ok: boolean;
}

/** 고른 장소 가구의 장소 구역(라이트루프가 멈추면 그 장소 안내가 뜨는 곳)과 서는 자리. 바닥에는 서는 자리만 보인다. */
export interface EditZone {
  place: FurniturePlaceId;
  /** 서는 자리들의 가운데(원의 중심). */
  center: FloorPoint;
  /** 구역이 벽까지 이어지는 장소면 바라볼 지점(그 끝), 아니면 null(원). */
  reach: FloorPoint | null;
  radius: number;
  approach: FloorPoint[];
}

/** 누른 결과. 화면이 안내를 띄운다. no-room은 보관함에서 꺼내거나 더할 자리가 없을 때, limit는 가구 수가 한도라 더할 수 없을 때다. */
export type EditNotice = "red-first" | "cannot-place" | "cannot-move-here" | "no-room" | "limit" | null;

/** 한 배치에 둘 수 있는 가구 수(방과 보관함을 합친 수, 저장 본문 검사와 같다). */
export const MAX_LAYOUT_ITEMS = 40;

interface Press {
  piece: string | null;
  x: number;
  y: number;
  point: FloorPoint | null;
  wall: { wall: WallSide; along: number } | null;
  /** 벽 위를 눌렀는지(아니면 wall은 바닥 점에서 가장 가까운 벽이다). */
  onWall: boolean;
}

type Drag =
  | {
      kind: "floor";
      piece: string;
      /** 처음 누른 바닥 점에서 가구 가운데까지. 끄는 동안 이 거리를 그대로 둔다. */
      offset: FloorPoint;
      /** 끌기 전 자리. 놓을 수 없는 곳에 놓으면 여기로 돌아간다. */
      from: FloorPlacementData;
    }
  | {
      kind: "wall";
      piece: string;
      /** 처음 누른 벽 자리에서 가구 가운데까지(벽을 따라). */
      offset: number;
      from: WallPlacementData;
    }
  | {
      kind: "tabletop";
      piece: string;
      /** 처음 누른 바닥 점에서 소품 자리까지. 끄는 동안 이 거리를 그대로 둔다. */
      offset: FloorPoint;
      from: TabletopPlacementData;
    };

/** 편집 모드 한 번. 들어갈 때의 배치에서 시작한다. */
export class LobbyEditor {
  readonly original: LobbyLayout;
  layout: LobbyLayout;
  selected: string | null = null;
  /** 돌려서 놓을 수 없는 자리가 된 바닥 가구. 있는 동안은 이 가구만 다룰 수 있다. */
  red: string | null = null;
  private press: Press | null = null;
  private drag: Drag | null = null;

  constructor(original: LobbyLayout) {
    this.original = original;
    this.layout = original;
  }

  get dragging(): string | null {
    return this.drag?.piece ?? null;
  }

  /** 편집 전 배치에서 바뀐 것이 있는지. */
  get changed(): boolean {
    return !sameLobbyLayout(this.layout, this.original);
  }

  /** 저장할 수 있는지(빨간 가구가 없어야 한다). */
  get canFinish(): boolean {
    return this.red === null;
  }

  /** '치우기' 버튼을 띄울 가구: 고른, 치울 수 있는 가구(끄는 동안은 없다). */
  get storable(): string | null {
    const id = this.selected;
    return id && typeOf(this.layout, id).removable && !this.drag ? id : null;
  }

  /** 보관함에 든 가구. */
  get stored(): StoredItem[] {
    return storedItems(this.layout);
  }

  /**
   * 고른 가구를 보관함에 넣는다(치울 수 있는 가구만). 고르기가 풀리고, 빨간 가구였으면 빨간 상태도 풀린다.
   * 받침 가구면 위에 올린 소품도 함께 보관함에 넣는다(받침 가구 다음에 자리 번호 순서로).
   */
  store(): void {
    const id = this.storable;
    if (!id) return;
    const item = layoutItem(this.layout, id)!;
    const onTop = this.layout.items.filter((p) => p.on?.parent === id).sort((a, b) => a.on!.slot - b.on!.slot);
    const gone = new Set([id, ...onTop.map((p) => p.id)]);
    this.layout = makeLayout(
      this.layout.items.filter((p) => !gone.has(p.id)),
      [...this.stored, ...[item, ...onTop].map((p) => ({ id: p.id, type: p.type }))]
    );
    this.selected = null;
    if (this.red && gone.has(this.red)) this.red = null;
  }

  /**
   * '가구 더하기': 그 종류를 새로 하나 만들어 보관함에서 꺼낼 때와 같은 자리에 놓고 고른다.
   * id는 `<종류>-<번호>`(방과 보관함에서 쓰지 않은 가장 작은 1 이상의 번호)다.
   * 빨간 가구가 있거나, 가구 수가 한도이거나, 놓을 자리가 없으면 만들지 않는다.
   */
  addNew(type: string): EditNotice {
    if (this.drag) return null;
    if (this.red) return "red-first";
    if (this.layout.items.length + this.stored.length >= MAX_LAYOUT_ITEMS) return "limit";
    const used = new Set([...this.layout.items, ...this.stored].map((p) => p.id));
    let n = 1;
    while (used.has(`${type}-${n}`)) n += 1;
    const placed = freeSpotFor(this.layout, { id: `${type}-${n}`, type });
    if (!placed) return "no-room";
    this.layout = makeLayout([...this.layout.items, placed], this.stored);
    this.selected = placed.id;
    return null;
  }

  /** 보관함에서 그 종류 하나(id를 주면 그 가구)를 꺼내 놓을 수 있는 자리에 놓고 고른다. 빨간 가구가 있거나 놓을 자리가 없으면 꺼내지 않는다. */
  takeOut(type: string, id?: string): EditNotice {
    if (this.drag) return null;
    if (this.red) return "red-first";
    const item = this.stored.find((p) => p.type === type && (id === undefined || p.id === id));
    if (!item) return null;
    const placed = freeSpotFor(makeLayout(this.layout.items, this.stored.filter((p) => p !== item)), item);
    if (!placed) return "no-room";
    this.layout = makeLayout(
      [...this.layout.items, placed],
      this.stored.filter((p) => p !== item)
    );
    this.selected = item.id;
    return null;
  }

  /** 돌리기 버튼을 띄울 가구: 고른 바닥 가구나 탁상형 소품(끄는 동안은 없다). 벽 가구는 돌리지 않는다. */
  get handle(): string | null {
    const id = this.selected;
    return id && !isWallPiece(this.layout, id) && !this.drag ? id : null;
  }

  private floorOf(id: string): FloorPlacementData {
    return layoutItem(this.layout, id)!.floor!;
  }

  private wallOf(id: string): WallPlacementData {
    return layoutItem(this.layout, id)!.wall!;
  }

  private onOf(id: string): TabletopPlacementData {
    return layoutItem(this.layout, id)!.on!;
  }

  pointerDown(hit: PointerHit, screenX: number, screenY: number): EditNotice {
    this.press = null;
    this.drag = null;
    // 배치에 없는 가구(3D가 아직 다시 만들어지기 전의 치운 가구)를 맞혔으면 가구를 맞히지 않은 것으로 본다
    if (hit.piece && !layoutItem(this.layout, hit.piece)) hit = { ...hit, piece: null };
    // 고른 바닥 가구는 떠 있어 모양을 맞히기 어렵다. 그 칸 안을 눌렀으면(덮개가 아닌 다른 가구를 직접 맞히지 않았으면) 그 가구다
    const kept = this.selected && layoutItem(this.layout, this.selected)!.floor ? this.selected : null;
    const hitCover = hit.piece ? typeOf(this.layout, hit.piece).mount === "cover" : false;
    const onKept =
      kept !== null &&
      hit.point !== null &&
      (!hit.piece || hitCover || hit.piece === kept) &&
      insideBounds(floorPieceBounds(layoutItem(this.layout, kept)!.type, this.floorOf(kept)), hit.point);
    const hitPiece = onKept ? kept : hit.piece ?? null;
    // 가구를 맞히지 않았어도 벽 가구 앞 바닥 띠를 눌렀으면 그 벽 가구다
    const fromStrip = !hitPiece && hit.point ? wallPieceInFront(this.layout, hit.point) : null;
    const piece = hitPiece ?? fromStrip;
    if (piece && this.red && piece !== this.red) return "red-first";
    // 띠로 골랐으면 누른 벽 자리는 그 가구가 걸린 벽 기준이다(모서리에서 가장 가까운 벽이 다른 벽이어도 끌 때 거리를 지킨다)
    let wall = wallPointOf(hit);
    if (fromStrip && hit.point) {
      const hung = this.wallOf(fromStrip).wall;
      wall = { wall: hung, along: hung === "back" ? hit.point.x : hit.point.z };
    }
    this.press = { piece, x: screenX, y: screenY, point: hit.point, wall, onWall: Boolean(hit.wall) };
    return null;
  }

  pointerMove(hit: PointerHit, screenX: number, screenY: number): void {
    const press = this.press;
    if (!press) return;
    if (!this.drag && !this.startDrag(press, screenX, screenY)) return;
    const drag = this.drag!;
    if (drag.kind === "wall") {
      const at = wallPointOf(hit);
      if (!at) return;
      const along = Math.round((at.along + drag.offset) / WALL_STEP) * WALL_STEP;
      const current = this.wallOf(drag.piece);
      if (current.wall === at.wall && current.along === along) return;
      this.layout = withItemPlacement(this.layout, drag.piece, { wall: { wall: at.wall, along } });
      return;
    }
    if (!hit.point) return;
    if (drag.kind === "tabletop") {
      // 손가락을 따라 받침 가구들의 자리 중 가장 가까운 자리로 옮긴다(바닥에는 놓이지 않는다)
      const target = { x: hit.point.x + drag.offset.x, z: hit.point.z + drag.offset.z };
      if (!nearRoom(target)) return;
      const spot = nearestSlot(this.layout, target);
      const current = this.onOf(drag.piece);
      if (!spot || (current.parent === spot.parent && current.slot === spot.slot)) return;
      this.layout = withItemPlacement(this.layout, drag.piece, { on: { parent: spot.parent, slot: spot.slot, facing: current.facing } });
      return;
    }
    // 가구가 옮겨 갈 자리로 본다(키 큰 가구 위쪽을 잡으면 손가락 바닥 점은 벽 너머로 떨어져도 갈 자리는 방 안일 수 있다)
    const target = { x: hit.point.x + drag.offset.x, z: hit.point.z + drag.offset.z };
    if (!nearRoom(target)) return;
    const current = this.floorOf(drag.piece);
    const at = snapPiece(layoutItem(this.layout, drag.piece)!.type, current.facing, target);
    if (current.x === at.x && current.z === at.z) return;
    this.layout = withItemPlacement(this.layout, drag.piece, { floor: { x: at.x, z: at.z, facing: current.facing } });
  }

  /** 누른 곳에서 손가락이 충분히 움직였으면 누른 가구를 끌기 시작한다. */
  private startDrag(press: Press, screenX: number, screenY: number): boolean {
    if (!press.piece) return false;
    if (Math.hypot(screenX - press.x, screenY - press.y) <= TAP_MAX_MOVE_PX) return false;
    if (isWallPiece(this.layout, press.piece)) {
      if (!press.wall) return false;
      const from = this.wallOf(press.piece);
      // 다른 벽을 눌렀다고 보이면(벽 가장자리) 거리를 두지 않는다
      const offset = press.wall.wall === from.wall ? from.along - press.wall.along : 0;
      this.drag = { kind: "wall", piece: press.piece, offset, from };
    } else if (isTabletopPiece(this.layout, press.piece)) {
      if (!press.point) return false;
      const at = tabletopPose(this.layout, layoutItem(this.layout, press.piece)!);
      if (!at) return false;
      this.drag = { kind: "tabletop", piece: press.piece, offset: { x: at.x - press.point.x, z: at.z - press.point.z }, from: this.onOf(press.piece) };
    } else {
      if (!press.point) return false;
      const from = this.floorOf(press.piece);
      this.drag = { kind: "floor", piece: press.piece, offset: { x: from.x - press.point.x, z: from.z - press.point.z }, from };
    }
    this.selected = press.piece;
    return true;
  }

  /** 손을 뗀다. 끈 가구를 놓을 수 없는 자리면 끌기 전 자리로 돌려놓고, 다른 자리에서 돌아왔으면 "cannot-place"를 돌려준다(화면이 알린다). */
  pointerUp(): EditNotice {
    const press = this.press;
    const drag = this.drag;
    this.press = null;
    this.drag = null;
    if (drag) {
      if (isPlaceableLayout(this.layout)) {
        if (this.red === drag.piece) this.red = null;
        return null;
      }
      // 끌기 전 자리에서 움직이지 않았으면(칸·벽 자리가 그대로면) 알리지 않는다
      const moved = !this.atDragStart(drag);
      this.revert(drag);
      return moved ? "cannot-place" : null;
    }
    if (!press) return null;
    // 고른 가구가 없으면 누른 가구를 고른다(빈 곳이면 그대로). 고른 가구를 다시 톡하면 자리를 확정한다(고르기를 풀고 내려앉는다)
    if (this.selected === null || press.piece === this.selected) {
      this.selected = press.piece !== null && press.piece === this.selected ? null : press.piece;
      return null;
    }
    // 고른 가구가 있으면 누른 곳으로 옮기고 고른 채 둔다(다른 가구를 누른 것도 그 자리로 옮기려는 것으로 본다)
    return this.moveSelectedTo(press);
  }

  /**
   * 고른 가구를 누른 곳으로 옮긴다. 자리는 끌기와 같게 맞춘다: 바닥 가구는 누른 바닥 점에 가운데가 오는 칸,
   * 탁상형 소품은 누른 점에서 가장 가까운 받침 가구 위 자리, 벽 가구는 누른 벽(바닥이면 가장 가까운 벽)의 그 자리.
   * 그 자리에 놓을 수 없으면 옮기지 않고 "cannot-move-here"를 돌려준다(화면이 알린다).
   */
  private moveSelectedTo(press: Press): EditNotice {
    const id = this.selected!;
    const item = layoutItem(this.layout, id)!;
    const mount = furnitureType(item.type).mount;
    let next: LobbyLayout | null = null;
    if (mount === "wall") {
      // 바닥을 눌렀으면 그 방의 걸 수 있는 벽 가운데 가장 가까운 벽으로 보낸다
      const at = press.onWall ? press.wall : press.point && nearRoom(press.point) ? nearestHangWall(press.point, currentRoom()) : null;
      if (at) next = withItemPlacement(this.layout, id, { wall: { wall: at.wall, along: Math.round(at.along / WALL_STEP) * WALL_STEP } });
    } else if (press.point && nearRoom(press.point)) {
      if (mount === "tabletop") {
        const spot = nearestSlot(this.layout, press.point);
        if (spot) next = withItemPlacement(this.layout, id, { on: { parent: spot.parent, slot: spot.slot, facing: item.on!.facing } });
      } else {
        const at = snapPiece(item.type, item.floor!.facing, press.point);
        next = withItemPlacement(this.layout, id, { floor: { x: at.x, z: at.z, facing: item.floor!.facing } });
      }
    }
    if (!next || !isPlaceableLayout(next)) return "cannot-move-here";
    this.layout = next;
    if (this.red === id) this.red = null;
    return null;
  }

  pointerCancel(): void {
    const drag = this.drag;
    this.press = null;
    this.drag = null;
    if (drag) this.revert(drag);
  }

  /** 끄는 가구가 끌기 전 자리 그대로인지. */
  private atDragStart(drag: Drag): boolean {
    if (drag.kind === "wall") {
      const now = this.wallOf(drag.piece);
      return now.wall === drag.from.wall && now.along === drag.from.along;
    }
    if (drag.kind === "tabletop") {
      const now = this.onOf(drag.piece);
      return now.parent === drag.from.parent && now.slot === drag.from.slot && now.facing === drag.from.facing;
    }
    const now = this.floorOf(drag.piece);
    return now.x === drag.from.x && now.z === drag.from.z && now.facing === drag.from.facing;
  }

  private revert(drag: Drag): void {
    this.layout = withItemPlacement(
      this.layout,
      drag.piece,
      drag.kind === "wall" ? { wall: drag.from } : drag.kind === "tabletop" ? { on: drag.from } : { floor: drag.from }
    );
  }

  /**
   * 고른 바닥 가구를 90도 돌린다(앞 → 오른쪽 → 뒤 → 왼쪽). 놓을 수 없는 모양이 되어도 돌리고 빨간 가구로 둔다.
   * 탁상형 소품은 자리는 그대로 두고 받침 가구 기준 방향만 돌린다.
   */
  rotate(): void {
    const id = this.selected;
    if (!id || isWallPiece(this.layout, id) || this.drag) return;
    if (isTabletopPiece(this.layout, id)) {
      const on = this.onOf(id);
      this.layout = withItemPlacement(this.layout, id, { on: { ...on, facing: ((on.facing + 1) % 4) as Facing } });
      return;
    }
    const current = this.floorOf(id);
    const facing = ((current.facing + 1) % 4) as Facing;
    this.layout = withItemPlacement(this.layout, id, { floor: { ...current, facing } });
    if (!isPlaceableLayout(this.layout)) this.red = id;
    else if (this.red === id) this.red = null;
  }

  /** 편집 중인 배치를 처음 배치로 되돌린다. 처음 배치에 없는 가구(방에 있든 보관함에 있든)는 버리지 않고 보관함에 넣는다. */
  resetToDefault(): void {
    this.press = null;
    this.drag = null;
    const extra = [...this.layout.items, ...this.stored]
      .filter((p) => !layoutItem(DEFAULT_LOBBY_LAYOUT, p.id))
      .map((p) => ({ id: p.id, type: p.type }));
    this.layout = extra.length > 0 ? makeLayout(DEFAULT_LOBBY_LAYOUT.items, extra) : DEFAULT_LOBBY_LAYOUT;
    this.red = null;
    // 처음 배치에 없는 가구를 골라 두었으면 고르기를 푼다
    if (this.selected && !layoutItem(this.layout, this.selected)) this.selected = null;
  }

  /** 바닥에 칠할 칸: 고른 바닥 가구와, 고르지 않았어도 빨간 가구. 고른 탁상형 소품은 받침 가구 윗면의 그 자리 칸이다. */
  marks(): EditMark[] {
    const list: EditMark[] = [];
    const id = this.selected;
    const boundsOf = (piece: string) => floorPieceBounds(layoutItem(this.layout, piece)!.type, this.floorOf(piece));
    if (id && isTabletopPiece(this.layout, id)) {
      const at = tabletopPose(this.layout, layoutItem(this.layout, id)!);
      if (at) list.push({ piece: id, minX: at.x - 0.5, maxX: at.x + 0.5, minZ: at.z - 0.5, maxZ: at.z + 0.5, y: at.y, ok: isPlaceableLayout(this.layout) });
    } else if (id && !isWallPiece(this.layout, id)) list.push({ piece: id, ...boundsOf(id), ok: isPlaceableLayout(this.layout) });
    if (this.red && this.red !== id) list.push({ piece: this.red, ...boundsOf(this.red), ok: false });
    return list;
  }

  /** 벽에 칠할 자리: 고른 벽 가구. */
  wallMarks(): EditWallMark[] {
    const id = this.selected;
    if (!id || !isWallPiece(this.layout, id)) return [];
    const type = typeOf(this.layout, id);
    const { wall, along } = this.wallOf(id);
    const half = type.size.width / 2;
    return [{ piece: id, wall, from: along - half, to: along + half, bottom: type.height.bottom, top: type.height.top, ok: isPlaceableLayout(this.layout) }];
  }

  /** 고른 가구에 딸린 장소의 구역과 서는 자리(편집 중인 배치로 계산). 장소가 없는 가구거나 고르지 않았으면 null. */
  zone(): EditZone | null {
    const id = this.selected;
    const place = id ? typeOf(this.layout, id).place?.id : undefined;
    if (!place) return null;
    const spot = layoutGeometry(this.layout, ROOM.width).places[place];
    const n = spot.approach.length;
    const center = { x: spot.approach.reduce((s, p) => s + p.x, 0) / n, z: spot.approach.reduce((s, p) => s + p.z, 0) / n };
    return { place, center, reach: zoneReachesWall(place) ? spot.faceTo : null, radius: MARK_ZONE_RADIUS, approach: spot.approach };
  }

  /** 카메라가 따라갈 점: 끄는 가구, 없으면 고른 가구. 벽 가구는 그 앞 바닥이다. */
  focus(): FloorPoint | null {
    const id = this.drag?.piece ?? this.selected;
    if (!id) return null;
    if (isWallPiece(this.layout, id)) {
      const { wall, along } = this.wallOf(id);
      if (wall === "back") return { x: along, z: 1 };
      return wall === "left" ? { x: 1, z: along } : { x: ROOM.width - 1, z: along };
    }
    if (isTabletopPiece(this.layout, id)) {
      const at = tabletopPose(this.layout, layoutItem(this.layout, id)!);
      return at ? { x: at.x, z: at.z } : null;
    }
    const p = this.floorOf(id);
    return { x: p.x, z: p.z };
  }
}
