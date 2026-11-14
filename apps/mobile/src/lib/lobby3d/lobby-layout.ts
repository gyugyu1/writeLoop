import type { FloorPoint, MarkId } from "./engine";
import { fittedModel, furnitureType, surfaceSlots, type FurniturePlaceId, type FurnitureType } from "./furniture-catalog";
import type { WallSide } from "./room";

// 방의 가구 배치(배치 데이터)와, 거기서 계산하는 값(막힌 칸, 장소의 서는 자리·바라볼 지점·이름표, 의자, 3D 자리).
// 배치는 가구 인스턴스 목록이고, 가구마다의 값(크기·장소·의자·모델)은 카탈로그(furniture-catalog)에서 읽는다.
// 좌표는 engine과 같다(바닥 한 칸 = 1, x는 왼쪽→오른쪽, z는 뒷벽→앞). 방향은 위에서 보아 반시계로 돈 각도(three.js rotY)다.
// 가구마다 앞면이 +z(방 앞쪽)를 보는 모양을 기준으로 적고, 놓인 방향만큼 돌려 방 좌표로 옮긴다.

/** 바닥 가구의 방향: 앞면이 보는 쪽. 0 앞(+z), 1 오른쪽(+x), 2 뒤(-z), 3 왼쪽(-x). */
export type Facing = 0 | 1 | 2 | 3;
/** 벽 가구를 거는 벽(방 데이터에서 정한다). */
export type { WallSide };

export interface FloorPlacementData {
  /** 가구가 차지하는 칸 모양의 가운데(바닥 좌표). 깔개처럼 칸에 맞지 않은 자리도 있다. */
  x: number;
  z: number;
  facing: Facing;
}

export interface WallPlacementData {
  wall: WallSide;
  /** 벽을 따라간 자리(뒷벽은 x, 옆벽은 z). */
  along: number;
}

/** 탁상형 소품을 올린 자리: 받침 가구(방에 놓인 가구의 id)의 몇 번 자리, 받침 가구 기준 방향(0이면 받침 가구 앞면과 같은 쪽). */
export interface TabletopPlacementData {
  parent: string;
  slot: number;
  facing: Facing;
}

/** 배치한 가구 하나. 바닥형·덮개형은 floor, 벽 부착형은 wall, 탁상형은 on 자리를 갖는다. */
export interface FurnitureItem {
  /** 배치 안에서 겹치지 않는 id. 처음 배치의 가구는 종류 id와 같다. */
  id: string;
  /** 가구 종류(카탈로그 id). */
  type: string;
  floor?: FloorPlacementData;
  wall?: WallPlacementData;
  on?: TabletopPlacementData;
}

/** 보관함에 넣은 가구: 자리 없이 id와 종류만 있다. */
export interface StoredItem {
  id: string;
  type: string;
}

/**
 * 앱이 그릴 줄 모르는 가구(서버 아이템 목록에 나중에 더해진 종류): 받은 본문 그대로의 방 가구(그 위에 올린 소품 포함)와 보관함 가구.
 * 그리지 않고 보관함에도 보이지 않지만, 배치를 저장할 때 그대로 다시 보내 서버에서 지워지지 않게 한다.
 */
export interface KeptFurniture {
  items: Record<string, unknown>[];
  stored: StoredItem[];
}

export interface LobbyLayout {
  items: FurnitureItem[];
  /** 보관함. 없으면 빈 보관함이다(빈 목록은 두지 않는다). */
  stored?: StoredItem[];
  /** 앱이 그릴 줄 모르는 가구. 없으면 두지 않는다. */
  kept?: KeptFurniture;
}

/** 처음 배치. 로비를 처음 만들 때의 자리와 같다. */
export const DEFAULT_LOBBY_LAYOUT: LobbyLayout = {
  items: [
    // 칸 "0,5"·"1,5"·"2,5"(3×1). 그림은 칸보다 커서 "2,5" 절반까지 나온다
    { id: "desk", type: "desk", floor: { x: 1.5, z: 5.5, facing: 0 } },
    // 칸 "0,2". 왼쪽 벽에 붙어 앞면이 방(+x)을 본다
    { id: "bookcase", type: "bookcase", floor: { x: 0.5, z: 2.5, facing: 1 } },
    // 칸 "7,3". 오른쪽 벽에 붙어 앞면이 방(-x)을 본다
    { id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } },
    { id: "rug", type: "rug", floor: { x: 4.6, z: 7.2, facing: 0 } },
    { id: "board", type: "board", wall: { wall: "back", along: 1.8 } },
    { id: "window", type: "window", wall: { wall: "back", along: 4.8 } },
    // 책상 왼쪽 자리
    { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } }
  ]
};

/** 붙박이 가구 종류(창문)의 자리: 처음 배치에서 그 종류가 있는 자리. 붙박이가 아니거나 처음 배치에 없으면 null. */
export function fixedPlacementOf(type: string): Pick<FurnitureItem, "floor" | "wall"> | null {
  if (furnitureType(type).fixed !== true) return null;
  const home = DEFAULT_LOBBY_LAYOUT.items.find((item) => item.type === type);
  if (!home || home.on) return null;
  return home.wall ? { wall: { ...home.wall } } : home.floor ? { floor: { ...home.floor } } : null;
}

/** 붙박이 가구(창문)를 늘 제자리(처음 배치 자리)에 둔 배치. 다른 가구와 보관함은 그대로다. 바뀐 것이 없으면 같은 배치를 돌려준다. */
export function withFixedPlacements(layout: LobbyLayout): LobbyLayout {
  let changed = false;
  const items = layout.items.map((item) => {
    const spot = item.on ? null : fixedPlacementOf(item.type);
    if (!spot) return item;
    const same = spot.wall
      ? item.wall?.wall === spot.wall.wall && item.wall?.along === spot.wall.along && !item.floor
      : item.floor?.x === spot.floor!.x && item.floor?.z === spot.floor!.z && item.floor?.facing === spot.floor!.facing && !item.wall;
    if (same) return item;
    changed = true;
    return { id: item.id, type: item.type, ...spot };
  });
  return changed ? makeLayout(items, storedItems(layout), layout.kept) : layout;
}

/** 배치 안의 가구(id로). */
export function layoutItem(layout: LobbyLayout, id: string): FurnitureItem | undefined {
  return layout.items.find((item) => item.id === id);
}

/** 배치의 보관함(없으면 빈 목록). */
export function storedItems(layout: LobbyLayout): StoredItem[] {
  return layout.stored ?? [];
}

/** 방의 가구와 보관함으로 배치를 만든다. 빈 보관함은 두지 않는다. 앱이 그릴 줄 모르는 가구는 주면 붙인다(비었으면 두지 않는다). */
export function makeLayout(items: FurnitureItem[], stored: StoredItem[], kept?: KeptFurniture): LobbyLayout {
  const layout: LobbyLayout = stored.length > 0 ? { items, stored } : { items };
  return withKept(layout, kept);
}

/** 그 배치에 앱이 그릴 줄 모르는 가구를 붙인 배치(비었거나 없으면 떼어 낸 배치). */
export function withKept(layout: LobbyLayout, kept: KeptFurniture | undefined): LobbyLayout {
  const { kept: _old, ...rest } = layout;
  return kept && keptIds(kept).length > 0 ? { ...rest, kept } : rest;
}

/** 앱이 그릴 줄 모르는 가구의 id(방과 보관함). */
export function keptIds(kept: KeptFurniture | undefined): string[] {
  if (!kept) return [];
  return [...kept.items.map((item) => item.id as string), ...kept.stored.map((item) => item.id)];
}

/** 그 가구의 id를 자리만 바꾼 새 배치. */
export function withItemPlacement(
  layout: LobbyLayout,
  id: string,
  placement: { floor?: FloorPlacementData; wall?: WallPlacementData; on?: TabletopPlacementData }
): LobbyLayout {
  return makeLayout(
    layout.items.map((item) => (item.id === id ? { ...item, ...placement } : item)),
    storedItems(layout),
    layout.kept
  );
}

/** 두 배치의 가구(id·종류)와 자리·방향·벽, 보관함(id·종류), 그릴 줄 모르는 가구(받은 그대로)가 모두 같은지. 순서는 보지 않는다. */
export function sameLobbyLayout(a: LobbyLayout, b: LobbyLayout): boolean {
  if (!sameKept(a.kept, b.kept)) return false;
  const storedA = storedItems(a);
  const storedB = storedItems(b);
  if (storedA.length !== storedB.length || !storedA.every((p) => storedB.some((q) => q.id === p.id && q.type === p.type))) return false;
  if (a.items.length !== b.items.length) return false;
  return a.items.every((p) => {
    const q = layoutItem(b, p.id);
    if (!q || q.type !== p.type) return false;
    if (p.floor || q.floor) return Boolean(p.floor && q.floor) && p.floor!.x === q.floor!.x && p.floor!.z === q.floor!.z && p.floor!.facing === q.floor!.facing;
    if (p.on || q.on) return Boolean(p.on && q.on) && p.on!.parent === q.on!.parent && p.on!.slot === q.on!.slot && p.on!.facing === q.on!.facing;
    return Boolean(p.wall && q.wall) && p.wall!.wall === q.wall!.wall && p.wall!.along === q.wall!.along;
  });
}

function sameKept(a: KeptFurniture | undefined, b: KeptFurniture | undefined): boolean {
  const key = (kept: KeptFurniture | undefined) =>
    kept ? [...kept.items.map((item) => JSON.stringify(item)), ...kept.stored.map((item) => `stored:${item.id}:${item.type}`)].sort().join("\n") : "";
  return key(a) === key(b);
}

/** 방향마다의 회전(rotY)과 그 cos·sin. 정확한 값을 써서 처음 배치의 좌표가 소수 오차 없이 나오게 한다. */
const FACING_ROT: Record<Facing, { rotY: number; cos: number; sin: number }> = {
  0: { rotY: 0, cos: 1, sin: 0 },
  1: { rotY: Math.PI / 2, cos: 0, sin: 1 },
  2: { rotY: Math.PI, cos: -1, sin: 0 },
  3: { rotY: -Math.PI / 2, cos: 0, sin: -1 }
};

/** 덧셈 오차를 지워 처음 배치의 좌표가 예전 고정값과 같게 한다. */
const round = (v: number) => Math.round(v * 1e6) / 1e6;

interface Pose {
  x: number;
  z: number;
  facing: Facing;
}

/** 가구 기준(앞면 +z) 좌표를 방 좌표로 옮긴다. */
function toRoom(pose: Pose, local: FloorPoint): FloorPoint {
  const { cos, sin } = FACING_ROT[pose.facing];
  return { x: round(pose.x + local.x * cos + local.z * sin), z: round(pose.z - local.x * sin + local.z * cos) };
}

/** 벽 가구의 기준 자리: 벽 면 위, 벽을 따라간 자리. 앞면(+z)이 방 안쪽을 본다. */
function wallPose(data: WallPlacementData, roomWidth: number): Pose {
  if (data.wall === "back") return { x: data.along, z: 0, facing: 0 };
  if (data.wall === "left") return { x: 0, z: data.along, facing: 1 };
  return { x: roomWidth, z: data.along, facing: 3 };
}

/** 벽 가구가 걸린 벽 면 위의 기준 자리(벽을 따라간 자리)와 방 안쪽을 보는 방향(rotY). 창밖 장면·창문 빛이 쓴다. */
export function wallPiecePose(data: WallPlacementData, roomWidth: number): { x: number; z: number; rotY: number } {
  const pose = wallPose(data, roomWidth);
  return { x: pose.x, z: pose.z, rotY: FACING_ROT[pose.facing].rotY };
}

/** 바닥 가구가 차지하는 칸 모양을 놓인 방향대로 돌린 가로(x)·깊이(z) 칸 수. */
export function floorPieceSize(type: string, facing: Facing): { width: number; depth: number } {
  const { width, depth } = furnitureType(type).size;
  return facing % 2 === 0 ? { width, depth } : { width: depth, depth: width };
}

/** 바닥 가구가 차지하는 칸 모양의 범위(방 좌표). 깔개처럼 칸에 맞지 않은 자리도 있다. */
export function floorPieceBounds(type: string, placement: FloorPlacementData): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const { width, depth } = floorPieceSize(type, placement.facing);
  return {
    minX: round(placement.x - width / 2),
    maxX: round(placement.x + width / 2),
    minZ: round(placement.z - depth / 2),
    maxZ: round(placement.z + depth / 2)
  };
}

type PlaceId = Exclude<MarkId, "door">;

/** 옷장 장소 id(옷장 가구마다 하나). */
export type ClosetPlaceId = `closet:${string}`;

/** 옷장 가구 id의 장소 id. */
export function closetPlaceId(itemId: string): ClosetPlaceId {
  return `closet:${itemId}`;
}

/** 옷장 장소인지. */
export function isClosetPlaceId(id: string): id is ClosetPlaceId {
  return id.startsWith("closet:");
}

/** 옷장 장소 하나(배치에 놓인 옷장 가구마다). */
export interface ClosetSpot {
  id: ClosetPlaceId;
  approach: FloorPoint[];
  faceTo: FloorPoint;
  label: { x: number; y: number; z: number };
}

export interface PlacedPiece {
  /** 배치한 가구 id. 딸린 의자는 그 책상의 id다. */
  item: string;
  /** 3D 모델 이름(가구 묶음 안의 이름). 딸린 의자는 의자 모델이다. */
  piece: string;
  /** 딸린 의자인지. */
  companion: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface LayoutGeometry {
  /** 3D에 놓는 가구(딸린 의자 포함). 입구 발판은 넣지 않는다. */
  pieces: PlacedPiece[];
  /** 가구가 있어 지나갈 수 없는 칸("열,행"). */
  solidTiles: Set<string>;
  places: Record<PlaceId, { approach: FloorPoint[]; faceTo: FloorPoint; label: { x: number; y: number; z: number } }>;
  /** 방에 놓인 옷장 장소(배치 순서). 없으면 빈 목록. */
  closets: ClosetSpot[];
  chair: {
    /** 책상 밑 의자 자리. */
    home: FloorPoint;
    /** 빼는 쪽(단위 벡터)과 거리. */
    pullDir: FloorPoint;
    pull: number;
    seat: FloorPoint;
    side: FloorPoint;
    seatHeight: number;
    /** 앉아서 책상을 보는 방향(heading). */
    heading: number;
  };
}

/** 가구 하나의 기준 자리(바닥 가구는 칸 모양 가운데, 벽 가구는 벽 면 위). 탁상형은 받침 가구에서 계산한다(tabletopPose). */
function poseOf(item: FurnitureItem, roomWidth: number): Pose {
  if (item.floor) return item.floor;
  return wallPose(item.wall!, roomWidth);
}

/**
 * 탁상형 소품의 자리(방 좌표의 바닥 점과 방향)와 놓인 높이(받침 가구 윗면). 받침 가구가 방에 없거나 그 자리가 없으면 null.
 * 받침 가구를 옮기거나 돌리면 자리도 따라 옮겨지고 돈다.
 */
export function tabletopPose(layout: LobbyLayout, item: FurnitureItem): { x: number; z: number; facing: Facing; y: number } | null {
  const on = item.on;
  const parent = on ? layoutItem(layout, on.parent) : undefined;
  if (!on || !parent?.floor) return null;
  const parentType = furnitureType(parent.type);
  const slot = surfaceSlots(parentType)[on.slot];
  if (!slot) return null;
  const at = toRoom(parent.floor, slot);
  return { x: at.x, z: at.z, facing: ((parent.floor.facing + on.facing) % 4) as Facing, y: parentType.height.top };
}

/** 받침 가구의 소품 자리 하나(방 좌표, 1칸 범위)와 윗면 높이. 편집 모드가 끌 때 가까운 자리를 찾고 자리를 칠할 때 쓴다. */
export interface SurfaceSlot {
  parent: string;
  slot: number;
  x: number;
  z: number;
  y: number;
}

/** 방의 받침 가구마다의 소품 자리(배치의 가구 순서, 그 안에서 자리 번호 순서). */
export function surfaceSlotsOf(layout: LobbyLayout): SurfaceSlot[] {
  const list: SurfaceSlot[] = [];
  for (const item of layout.items) {
    if (!item.floor) continue;
    const type = furnitureType(item.type);
    surfaceSlots(type).forEach((local, slot) => {
      const at = toRoom(item.floor!, local);
      list.push({ parent: item.id, slot, x: at.x, z: at.z, y: type.height.top });
    });
  }
  return list;
}

/** 배치 데이터에서 3D 자리·막힌 칸·장소·의자를 계산한다. 장소 가구는 배치에 하나씩 있다(불러올 때 검사한다). */
export function layoutGeometry(layout: LobbyLayout, roomWidth: number): LayoutGeometry {
  const pieces: PlacedPiece[] = [];
  const solidTiles = new Set<string>();
  const places = {} as LayoutGeometry["places"];
  const closets: ClosetSpot[] = [];
  let chair: LayoutGeometry["chair"] | null = null;

  const typed = layout.items.filter((item) => !item.on).map((item) => ({ item, type: furnitureType(item.type), pose: poseOf(item, roomWidth) }));
  // 벽 가구를 먼저 놓는다(그리는 순서를 예전과 같게). 탁상형 소품은 맨 뒤에 받침 가구 위에 놓는다
  const ordered = [...typed.filter((t) => t.type.mount === "wall"), ...typed.filter((t) => t.type.mount !== "wall")];
  for (const { item, type, pose } of ordered) {
    const rotY = FACING_ROT[pose.facing].rotY;
    if (type.mount === "wall") {
      const at = toRoom(pose, { x: 0, z: type.model.wallDepth ?? 0 });
      pieces.push({ item: item.id, piece: type.model.piece, companion: false, x: at.x, y: type.model.y, z: at.z, rotY });
    } else {
      const drawn = toRoom(pose, fittedModel(type).drawAt);
      pieces.push({ item: item.id, piece: type.model.piece, companion: false, x: drawn.x, y: type.model.y, z: drawn.z, rotY });
    }
    if (type.chair) chair = placeChair(item.id, type, pose, pieces);
    if (type.blocksWalk && type.mount !== "wall") addSolid(type, pose, solidTiles);
    if (type.place) places[type.place.id as PlaceId] = placeSpot(type, pose);
    if (type.closet) closets.push({ id: closetPlaceId(item.id), ...placeSpot({ ...type, place: { id: "bookcase", ...type.closet } }, pose) });
  }
  for (const item of layout.items) {
    const pose = item.on ? tabletopPose(layout, item) : null;
    if (!pose) continue;
    const type = furnitureType(item.type);
    const drawn = toRoom(pose, fittedModel(type).drawAt);
    pieces.push({ item: item.id, piece: type.model.piece, companion: false, x: drawn.x, y: pose.y + type.model.y, z: drawn.z, rotY: FACING_ROT[pose.facing].rotY });
  }

  return { pieces, solidTiles, places, closets, chair: chair ?? NO_CHAIR };
}

/** 책상이 없을 때의 의자 값(장소 가구는 늘 있으므로 실제로는 쓰이지 않는다). */
const NO_CHAIR: LayoutGeometry["chair"] = { home: { x: 0, z: 0 }, pullDir: { x: 0, z: 1 }, pull: 0, seat: { x: 0, z: 0 }, side: { x: 0, z: 0 }, seatHeight: 0, heading: 0 };

function placeChair(itemId: string, type: FurnitureType, pose: Pose, pieces: PlacedPiece[]): LayoutGeometry["chair"] {
  const spec = type.chair!;
  const at = toRoom(pose, spec.at);
  // 의자는 앞면이 책상을 본다
  const back = ((pose.facing + 2) % 4) as Facing;
  pieces.push({ item: itemId, piece: spec.piece, companion: true, x: at.x, y: 0, z: at.z, rotY: FACING_ROT[back].rotY });
  return {
    home: at,
    pullDir: toRoom({ x: 0, z: 0, facing: pose.facing }, { x: 0, z: 1 }),
    pull: spec.pull,
    seat: toRoom(pose, spec.seat),
    side: toRoom(pose, spec.side),
    seatHeight: spec.seatHeight,
    heading: FACING_ROT[back].rotY
  };
}

function addSolid(type: FurnitureType, pose: Pose, solidTiles: Set<string>) {
  const { width, depth } = type.size;
  const corners = [toRoom(pose, { x: -width / 2, z: -depth / 2 }), toRoom(pose, { x: width / 2, z: depth / 2 })];
  const minX = Math.min(corners[0].x, corners[1].x);
  const maxX = Math.max(corners[0].x, corners[1].x);
  const minZ = Math.min(corners[0].z, corners[1].z);
  const maxZ = Math.max(corners[0].z, corners[1].z);
  for (let c = Math.floor(minX + 1e-6); c < Math.ceil(maxX - 1e-6); c += 1) {
    for (let r = Math.floor(minZ + 1e-6); r < Math.ceil(maxZ - 1e-6); r += 1) solidTiles.add(`${c},${r}`);
  }
}

function placeSpot(type: FurnitureType, pose: Pose): LayoutGeometry["places"][PlaceId] {
  const spec = type.place!;
  const labelAt = toRoom(pose, { x: spec.label.x, z: spec.label.z });
  return {
    approach: spec.approach.map((p) => toRoom(pose, p)),
    faceTo: toRoom(pose, spec.faceTo),
    label: { x: labelAt.x, y: spec.label.y, z: labelAt.z }
  };
}

/** 창밖 장면과 바닥 창문 빛을 내는 창문의 자리(배치에서 맨 앞의 창문). 없으면 null. */
export function viewWindow(layout: LobbyLayout): WallPlacementData | null {
  return layout.items.find((item) => furnitureType(item.type).view && item.wall)?.wall ?? null;
}

/** 장소 id에 딸린 가구(배치에 하나씩 있다). */
export function placeItem(layout: LobbyLayout, place: FurniturePlaceId): FurnitureItem | undefined {
  return layout.items.find((item) => furnitureType(item.type).place?.id === place);
}
