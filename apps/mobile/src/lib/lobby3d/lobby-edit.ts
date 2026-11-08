import { MARKS, ROOM, TAP_MAX_MOVE_PX, findPath, isFree, type FloorPoint, type PointerHit } from "./engine";
import {
  DEFAULT_LOBBY_LAYOUT,
  WALL_PIECE_WIDTH,
  floorPieceBlocks,
  floorPieceBounds,
  floorPieceSize,
  layoutGeometry,
  sameLobbyLayout,
  wallLength,
  type Facing,
  type FloorPieceId,
  type FloorPlacementData,
  type LobbyLayout,
  type WallPieceId,
  type WallPlacementData,
  type WallSide
} from "./lobby-layout";

// 홈 '꾸미기'(편집 모드)의 가구 옮기기·돌리기와, 가구를 놓을 수 있는 배치인지 판단.
// 바닥 가구는 칸에 맞춰 옮기고 돌리며, 벽 가구(게시판·창문)는 뒷벽·양옆 벽을 따라 반 칸 단위로 옮긴다.
// 3D 그리기와 버튼은 화면이 맡고, 여기서는 편집 중인 배치와 고른 가구·빨간 가구만 다룬다.

const EPS = 1e-6;
const FLOOR_PIECES: readonly FloorPieceId[] = ["desk", "bookcase", "wardrobe", "rug"];
const WALL_PIECES: readonly WallPieceId[] = ["board", "window"];
/** 게시판·창문 바로 아래에 놓지 못하는 키 큰 가구. */
const TALL_PIECES: ReadonlySet<FloorPieceId> = new Set<FloorPieceId>(["bookcase", "wardrobe"]);
/** 벽 가구 폭의 양 끝을 벽 끝(모서리, 옆벽 앞끝)에서 띄우는 거리(칸). */
const WALL_END_GAP = 0.2;
/** 벽 가구를 벽을 따라 맞추는 단위(칸). */
const WALL_STEP = 0.5;

/** 편집 모드에서 고르는 가구. */
export type EditPieceId = FloorPieceId | WallPieceId;

export function isWallPiece(id: EditPieceId): id is WallPieceId {
  return id === "board" || id === "window";
}

type Bounds = ReturnType<typeof floorPieceBounds>;

const overlaps = (a: Bounds, b: Bounds) => a.minX < b.maxX - EPS && b.minX < a.maxX - EPS && a.minZ < b.maxZ - EPS && b.minZ < a.maxZ - EPS;

/** 벽 가구 바로 아래 칸: 그 벽에 붙은 첫 줄 칸 중 벽 가구 폭에 걸친 칸의 범위. */
function underWallBounds(layout: LobbyLayout, id: WallPieceId): Bounds {
  const { wall, along } = layout.wall[id];
  const half = WALL_PIECE_WIDTH[id] / 2;
  const from = Math.floor(along - half + EPS);
  const to = Math.ceil(along + half - EPS);
  if (wall === "back") return { minX: from, maxX: to, minZ: 0, maxZ: 1 };
  if (wall === "left") return { minX: 0, maxX: 1, minZ: from, maxZ: to };
  return { minX: ROOM.width - 1, maxX: ROOM.width, minZ: from, maxZ: to };
}

/**
 * 가구를 놓을 수 있는 배치인지.
 * 바닥 가구가 모두 방 안이고, 막는 가구끼리 겹치지 않고, 책장·옷장이 게시판·창문 바로 아래에 있지 않고,
 * 벽 가구가 벽 안(양 끝에서 띄워)에 있고 같은 벽에서 서로 겹치지 않고,
 * 다섯 장소마다 서는 자리 중 하나에 입구(밖으로의 서는 자리)에서 걸어갈 수 있어야 한다.
 */
export function isPlaceableLayout(layout: LobbyLayout): boolean {
  const bounds = FLOOR_PIECES.map((id) => ({ id, box: floorPieceBounds(id, layout.floor[id]) }));
  for (const { box } of bounds) {
    if (box.minX < -EPS || box.minZ < -EPS || box.maxX > ROOM.width + EPS || box.maxZ > ROOM.depth + EPS) return false;
  }
  const blocking = bounds.filter((b) => floorPieceBlocks(b.id));
  for (let i = 0; i < blocking.length; i += 1) {
    for (let j = i + 1; j < blocking.length; j += 1) if (overlaps(blocking[i].box, blocking[j].box)) return false;
  }
  for (const id of WALL_PIECES) {
    const { wall, along } = layout.wall[id];
    const half = WALL_PIECE_WIDTH[id] / 2;
    if (along - half < WALL_END_GAP - EPS || along + half > wallLength(wall, ROOM.width, ROOM.depth) - WALL_END_GAP + EPS) return false;
  }
  const [a, b] = WALL_PIECES;
  if (layout.wall[a].wall === layout.wall[b].wall) {
    const gap = Math.abs(layout.wall[a].along - layout.wall[b].along);
    if (gap < (WALL_PIECE_WIDTH[a] + WALL_PIECE_WIDTH[b]) / 2 - EPS) return false;
  }
  const under = WALL_PIECES.map((id) => underWallBounds(layout, id));
  for (const { id, box } of bounds) {
    if (TALL_PIECES.has(id) && under.some((u) => overlaps(box, u))) return false;
  }
  const geometry = layoutGeometry(layout, ROOM.width);
  const door = MARKS.door.approach;
  const start = door.find((p) => isFree(p.x, p.z, geometry.solidTiles));
  if (!start) return false;
  return (Object.keys(geometry.places) as (keyof typeof geometry.places)[]).every(
    (id) => findPath(start, geometry.places[id].approach, geometry.solidTiles) !== null
  );
}

/** 칸에 맞춘 가구 가운데: 가구가 차지하는 칸 모양이 바닥 칸에 딱 맞는, point에서 가장 가까운 자리. */
export function snapPiece(id: FloorPieceId, facing: Facing, point: FloorPoint): FloorPoint {
  const { width, depth } = floorPieceSize(id, facing);
  return { x: Math.round(point.x - width / 2) + width / 2, z: Math.round(point.z - depth / 2) + depth / 2 };
}

/** 바닥 점에서 가장 가까운 벽과 그 벽을 따라간 자리. */
export function nearestWall(point: FloorPoint): { wall: WallSide; along: number } {
  const toBack = point.z;
  const toLeft = point.x;
  const toRight = ROOM.width - point.x;
  if (toBack <= toLeft && toBack <= toRight) return { wall: "back", along: point.x };
  return toLeft <= toRight ? { wall: "left", along: point.z } : { wall: "right", along: point.z };
}

/** 누른 곳의 벽 자리: 벽 위를 눌렀으면 그 벽, 아니면 바닥 점에서 가장 가까운 벽. */
function wallPointOf(hit: PointerHit): { wall: WallSide; along: number } | null {
  if (hit.wall) return hit.wall;
  return hit.point ? nearestWall(hit.point) : null;
}

const withPiece = (layout: LobbyLayout, id: FloorPieceId, placement: FloorPlacementData): LobbyLayout => ({
  floor: { ...layout.floor, [id]: placement },
  wall: layout.wall
});

const withWallPiece = (layout: LobbyLayout, id: WallPieceId, placement: WallPlacementData): LobbyLayout => ({
  floor: layout.floor,
  wall: { ...layout.wall, [id]: placement }
});

/** 바닥에 칠할 칸: 가구가 차지하는 범위와, 거기에 놓을 수 있는지(빨강이면 false). */
export interface EditMark {
  piece: FloorPieceId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  ok: boolean;
}

/** 벽에 칠할 자리: 벽 가구가 걸린 벽과 그 폭(벽을 따라간 범위), 거기에 놓을 수 있는지. */
export interface EditWallMark {
  piece: WallPieceId;
  wall: WallSide;
  from: number;
  to: number;
  ok: boolean;
}

/** 누른 결과. 화면이 안내를 띄운다. */
export type EditNotice = "red-first" | null;

interface Press {
  piece: EditPieceId | null;
  x: number;
  y: number;
  point: FloorPoint | null;
  wall: { wall: WallSide; along: number } | null;
}

type Drag =
  | {
      kind: "floor";
      piece: FloorPieceId;
      /** 처음 누른 바닥 점에서 가구 가운데까지. 끄는 동안 이 거리를 그대로 둔다. */
      offset: FloorPoint;
      /** 끌기 전 자리. 놓을 수 없는 곳에 놓으면 여기로 돌아간다. */
      from: FloorPlacementData;
    }
  | {
      kind: "wall";
      piece: WallPieceId;
      /** 처음 누른 벽 자리에서 가구 가운데까지(벽을 따라). */
      offset: number;
      from: WallPlacementData;
    };

/** 편집 모드 한 번. 들어갈 때의 배치에서 시작한다. */
export class LobbyEditor {
  readonly original: LobbyLayout;
  layout: LobbyLayout;
  selected: EditPieceId | null = null;
  /** 돌려서 놓을 수 없는 자리가 된 바닥 가구. 있는 동안은 이 가구만 다룰 수 있다. */
  red: FloorPieceId | null = null;
  private press: Press | null = null;
  private drag: Drag | null = null;

  constructor(original: LobbyLayout) {
    this.original = original;
    this.layout = original;
  }

  get dragging(): EditPieceId | null {
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

  /** 돌리기 버튼을 띄울 가구: 고른 바닥 가구(끄는 동안은 없다). 벽 가구는 돌리지 않는다. */
  get handle(): FloorPieceId | null {
    const id = this.selected;
    return id && !isWallPiece(id) && !this.drag ? id : null;
  }

  pointerDown(hit: PointerHit, screenX: number, screenY: number): EditNotice {
    this.press = null;
    this.drag = null;
    const piece = hit.piece ?? null;
    if (piece && this.red && piece !== this.red) return "red-first";
    this.press = { piece, x: screenX, y: screenY, point: hit.point, wall: wallPointOf(hit) };
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
      const current = this.layout.wall[drag.piece];
      if (current.wall === at.wall && current.along === along) return;
      this.layout = withWallPiece(this.layout, drag.piece, { wall: at.wall, along });
      return;
    }
    if (!hit.point) return;
    const facing = this.layout.floor[drag.piece].facing;
    const at = snapPiece(drag.piece, facing, { x: hit.point.x + drag.offset.x, z: hit.point.z + drag.offset.z });
    const current = this.layout.floor[drag.piece];
    if (current.x === at.x && current.z === at.z) return;
    this.layout = withPiece(this.layout, drag.piece, { x: at.x, z: at.z, facing });
  }

  /** 누른 곳에서 손가락이 충분히 움직였으면 누른 가구를 끌기 시작한다. */
  private startDrag(press: Press, screenX: number, screenY: number): boolean {
    if (!press.piece) return false;
    if (Math.hypot(screenX - press.x, screenY - press.y) <= TAP_MAX_MOVE_PX) return false;
    if (isWallPiece(press.piece)) {
      if (!press.wall) return false;
      const from = this.layout.wall[press.piece];
      // 다른 벽을 눌렀다고 보이면(벽 가장자리) 거리를 두지 않는다
      const offset = press.wall.wall === from.wall ? from.along - press.wall.along : 0;
      this.drag = { kind: "wall", piece: press.piece, offset, from };
    } else {
      if (!press.point) return false;
      const from = this.layout.floor[press.piece];
      this.drag = { kind: "floor", piece: press.piece, offset: { x: from.x - press.point.x, z: from.z - press.point.z }, from };
    }
    this.selected = press.piece;
    return true;
  }

  pointerUp(): void {
    const press = this.press;
    const drag = this.drag;
    this.press = null;
    this.drag = null;
    if (drag) {
      if (isPlaceableLayout(this.layout)) {
        if (this.red === drag.piece) this.red = null;
      } else {
        this.revert(drag);
      }
      return;
    }
    if (press) this.selected = press.piece;
  }

  pointerCancel(): void {
    const drag = this.drag;
    this.press = null;
    this.drag = null;
    if (drag) this.revert(drag);
  }

  private revert(drag: Drag): void {
    this.layout = drag.kind === "wall" ? withWallPiece(this.layout, drag.piece, drag.from) : withPiece(this.layout, drag.piece, drag.from);
  }

  /** 고른 바닥 가구를 90도 돌린다(앞 → 오른쪽 → 뒤 → 왼쪽). 놓을 수 없는 모양이 되어도 돌리고 빨간 가구로 둔다. */
  rotate(): void {
    const id = this.selected;
    if (!id || isWallPiece(id) || this.drag) return;
    const current = this.layout.floor[id];
    const facing = ((current.facing + 1) % 4) as Facing;
    this.layout = withPiece(this.layout, id, { ...current, facing });
    if (!isPlaceableLayout(this.layout)) this.red = id;
    else if (this.red === id) this.red = null;
  }

  /** 편집 중인 배치를 처음 배치로 되돌린다. */
  resetToDefault(): void {
    this.press = null;
    this.drag = null;
    this.layout = DEFAULT_LOBBY_LAYOUT;
    this.red = null;
  }

  /** 바닥에 칠할 칸: 고른 바닥 가구와, 고르지 않았어도 빨간 가구. */
  marks(): EditMark[] {
    const list: EditMark[] = [];
    const id = this.selected;
    if (id && !isWallPiece(id)) list.push({ piece: id, ...floorPieceBounds(id, this.layout.floor[id]), ok: isPlaceableLayout(this.layout) });
    if (this.red && this.red !== id) list.push({ piece: this.red, ...floorPieceBounds(this.red, this.layout.floor[this.red]), ok: false });
    return list;
  }

  /** 벽에 칠할 자리: 고른 벽 가구. */
  wallMarks(): EditWallMark[] {
    const id = this.selected;
    if (!id || !isWallPiece(id)) return [];
    const { wall, along } = this.layout.wall[id];
    const half = WALL_PIECE_WIDTH[id] / 2;
    return [{ piece: id, wall, from: along - half, to: along + half, ok: isPlaceableLayout(this.layout) }];
  }

  /** 카메라가 따라갈 점: 끄는 가구, 없으면 고른 가구. 벽 가구는 그 앞 바닥이다. */
  focus(): FloorPoint | null {
    const id = this.drag?.piece ?? this.selected;
    if (!id) return null;
    if (isWallPiece(id)) {
      const { wall, along } = this.layout.wall[id];
      if (wall === "back") return { x: along, z: 1 };
      return wall === "left" ? { x: 1, z: along } : { x: ROOM.width - 1, z: along };
    }
    const p = this.layout.floor[id];
    return { x: p.x, z: p.z };
  }
}
