import { MARKS, ROOM, TAP_MAX_MOVE_PX, findPath, isFree, type FloorPoint, type PointerHit } from "./engine";
import {
  DEFAULT_LOBBY_LAYOUT,
  WALL_PIECE_WIDTH,
  floorPieceBlocks,
  floorPieceBounds,
  floorPieceSize,
  layoutGeometry,
  sameLobbyLayout,
  type Facing,
  type FloorPieceId,
  type FloorPlacementData,
  type LobbyLayout,
  type WallPieceId
} from "./lobby-layout";

// 홈 '꾸미기'(편집 모드)의 바닥 가구 옮기기·돌리기와, 가구를 놓을 수 있는 배치인지 판단.
// 3D 그리기와 버튼은 화면이 맡고, 여기서는 편집 중인 배치와 고른 가구·빨간 가구만 다룬다.

const EPS = 1e-6;
const FLOOR_PIECES: readonly FloorPieceId[] = ["desk", "bookcase", "wardrobe", "rug"];
/** 게시판·창문 바로 아래에 놓지 못하는 키 큰 가구. */
const TALL_PIECES: ReadonlySet<FloorPieceId> = new Set<FloorPieceId>(["bookcase", "wardrobe"]);

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
  const under = (Object.keys(layout.wall) as WallPieceId[]).map((id) => underWallBounds(layout, id));
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

const withPiece = (layout: LobbyLayout, id: FloorPieceId, placement: FloorPlacementData): LobbyLayout => ({
  floor: { ...layout.floor, [id]: placement },
  wall: layout.wall
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

/** 누른 결과. 화면이 안내를 띄운다. */
export type EditNotice = "red-first" | null;

interface Press {
  piece: FloorPieceId | null;
  x: number;
  y: number;
  point: FloorPoint | null;
}

interface Drag {
  piece: FloorPieceId;
  /** 처음 누른 바닥 점에서 가구 가운데까지. 끄는 동안 이 거리를 그대로 둔다. */
  offset: FloorPoint;
  /** 끌기 전 자리. 놓을 수 없는 곳에 놓으면 여기로 돌아간다. */
  from: FloorPlacementData;
}

/** 편집 모드 한 번. 들어갈 때의 배치에서 시작한다. */
export class LobbyEditor {
  readonly original: LobbyLayout;
  layout: LobbyLayout;
  selected: FloorPieceId | null = null;
  /** 돌려서 놓을 수 없는 자리가 된 가구. 있는 동안은 이 가구만 다룰 수 있다. */
  red: FloorPieceId | null = null;
  private press: Press | null = null;
  private drag: Drag | null = null;

  constructor(original: LobbyLayout) {
    this.original = original;
    this.layout = original;
  }

  get dragging(): FloorPieceId | null {
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

  pointerDown(hit: PointerHit, screenX: number, screenY: number): EditNotice {
    this.press = null;
    this.drag = null;
    const piece = hit.piece ?? null;
    if (piece && this.red && piece !== this.red) return "red-first";
    this.press = { piece, x: screenX, y: screenY, point: hit.point };
    return null;
  }

  pointerMove(hit: PointerHit, screenX: number, screenY: number): void {
    const press = this.press;
    if (!press) return;
    if (!this.drag) {
      if (!press.piece || !press.point || !hit.point) return;
      if (Math.hypot(screenX - press.x, screenY - press.y) <= TAP_MAX_MOVE_PX) return;
      const from = this.layout.floor[press.piece];
      this.selected = press.piece;
      this.drag = { piece: press.piece, offset: { x: from.x - press.point.x, z: from.z - press.point.z }, from };
    }
    if (!hit.point) return;
    const { piece, offset } = this.drag;
    const facing = this.layout.floor[piece].facing;
    const at = snapPiece(piece, facing, { x: hit.point.x + offset.x, z: hit.point.z + offset.z });
    const current = this.layout.floor[piece];
    if (current.x === at.x && current.z === at.z) return;
    this.layout = withPiece(this.layout, piece, { x: at.x, z: at.z, facing });
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
        this.layout = withPiece(this.layout, drag.piece, drag.from);
      }
      return;
    }
    if (press) this.selected = press.piece;
  }

  pointerCancel(): void {
    const drag = this.drag;
    this.press = null;
    this.drag = null;
    if (drag) this.layout = withPiece(this.layout, drag.piece, drag.from);
  }

  /** 고른 가구를 90도 돌린다(앞 → 오른쪽 → 뒤 → 왼쪽). 놓을 수 없는 모양이 되어도 돌리고 빨간 가구로 둔다. */
  rotate(): void {
    const id = this.selected;
    if (!id || this.drag) return;
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

  /** 바닥에 칠할 칸: 고른 가구와, 고르지 않았어도 빨간 가구. */
  marks(): EditMark[] {
    const list: EditMark[] = [];
    if (this.selected) {
      list.push({ piece: this.selected, ...floorPieceBounds(this.selected, this.layout.floor[this.selected]), ok: isPlaceableLayout(this.layout) });
    }
    if (this.red && this.red !== this.selected) list.push({ piece: this.red, ...floorPieceBounds(this.red, this.layout.floor[this.red]), ok: false });
    return list;
  }

  /** 카메라가 따라갈 점: 끄는 가구, 없으면 고른 가구. */
  focus(): FloorPoint | null {
    const id = this.drag?.piece ?? this.selected;
    if (!id) return null;
    const p = this.layout.floor[id];
    return { x: p.x, z: p.z };
  }
}
