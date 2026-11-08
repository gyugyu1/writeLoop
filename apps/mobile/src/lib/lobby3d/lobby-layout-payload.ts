import { ROOM } from "./engine";
import { REQUIRED_FURNITURE_TYPES, findFurnitureType } from "./furniture-catalog";
import type { Facing, FloorPlacementData, FurnitureItem, LobbyLayout, WallPlacementData, WallSide } from "./lobby-layout";

// 계정에 저장하는 가구 배치(서버 /api/lobby-layout)의 본문: 배치 데이터(가구 인스턴스 목록)에 모양 버전을 붙인 것.
// 서버와 같은 기준으로 모양만 본다(아는 종류인지, 종류에 맞는 자리가 방 안인지, 방향·벽 값, id가 겹치지 않는지, 장소 가구가 하나씩 있는지).
// 겹침·길 막힘은 보지 않는다(편집 모드가 막는다).

/** 지금 앱이 아는 배치 모양 버전. */
export const LOBBY_LAYOUT_VERSION = 2;

/** 한 배치에 둘 수 있는 가구 수. */
const MAX_ITEMS = 40;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export type LobbyLayoutPayload = LobbyLayout & { version: number };

const WALLS: readonly WallSide[] = ["back", "left", "right"];

export function toLobbyLayoutPayload(layout: LobbyLayout): LobbyLayoutPayload {
  return { version: LOBBY_LAYOUT_VERSION, items: layout.items };
}

/** 받은 본문을 배치로 읽는다. 모르는 버전이거나 모양이 맞지 않으면 null이다. */
export function parseLobbyLayoutPayload(value: unknown): LobbyLayout | null {
  if (!hasExactKeys(value, ["version", "items"]) || value.version !== LOBBY_LAYOUT_VERSION) return null;
  const raw = value.items;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_ITEMS) return null;
  const items: FurnitureItem[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    const item = parseItem(entry);
    if (!item || ids.has(item.id)) return null;
    ids.add(item.id);
    items.push(item);
  }
  // 장소 가구는 하나씩 꼭 있어야 한다
  for (const type of REQUIRED_FURNITURE_TYPES) {
    if (items.filter((item) => item.type === type).length !== 1) return null;
  }
  return { items };
}

function parseItem(value: unknown): FurnitureItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { id, type } = record;
  if (typeof id !== "string" || !ID_PATTERN.test(id) || typeof type !== "string") return null;
  const kind = findFurnitureType(type);
  if (!kind) return null;
  if (kind.mount === "wall") {
    if (!hasExactKeys(value, ["id", "type", "wall"])) return null;
    const wall = parseWallPiece(record.wall);
    return wall ? { id, type, wall } : null;
  }
  if (!hasExactKeys(value, ["id", "type", "floor"])) return null;
  const floor = parseFloorPiece(record.floor);
  return floor ? { id, type, floor } : null;
}

function parseFloorPiece(value: unknown): FloorPlacementData | null {
  if (!hasExactKeys(value, ["x", "z", "facing"])) return null;
  const { x, z, facing } = value;
  if (!isWithin(x, ROOM.width) || !isWithin(z, ROOM.depth)) return null;
  if (facing !== 0 && facing !== 1 && facing !== 2 && facing !== 3) return null;
  return { x, z, facing: facing as Facing };
}

function parseWallPiece(value: unknown): WallPlacementData | null {
  if (!hasExactKeys(value, ["wall", "along"])) return null;
  const { wall, along } = value;
  if (typeof wall !== "string" || !(WALLS as readonly string[]).includes(wall)) return null;
  if (!isWithin(along, wall === "back" ? ROOM.width : ROOM.depth)) return null;
  return { wall: wall as WallSide, along };
}

/** 방 안(경계 포함)의 수인지. */
function isWithin(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

/** 객체이고 키가 정확히 keys와 같은지(모르는 키도, 빠진 키도 없다). */
function hasExactKeys<K extends string>(value: unknown, keys: readonly K[]): value is Record<K, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}
