import { ROOM } from "./engine";
import { REQUIRED_FURNITURE_TYPES, findFurnitureType } from "./furniture-catalog";
import { makeLayout, storedItems, type Facing, type FloorPlacementData, type FurnitureItem, type LobbyLayout, type StoredItem, type WallPlacementData, type WallSide } from "./lobby-layout";

// 계정에 저장하는 가구 배치(서버 /api/lobby-layout)의 본문: 배치 데이터(가구 인스턴스 목록)에 모양 버전을 붙인 것.
// 서버와 같은 기준으로 모양만 본다(아는 종류인지, 종류에 맞는 자리가 방 안인지, 방향·벽 값, id가 겹치지 않는지, 장소 가구가 하나씩 있는지,
// 보관함에 치울 수 있는 종류만 있는지). 보관함(stored)은 없어도 되고, 빈 보관함은 보내지 않는다.
// 겹침·길 막힘은 보지 않는다(편집 모드가 막는다).

/** 지금 앱이 아는 배치 모양 버전. */
export const LOBBY_LAYOUT_VERSION = 2;

/** 한 배치에 둘 수 있는 가구 수(방과 보관함을 합친 수). */
const MAX_ITEMS = 40;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export type LobbyLayoutPayload = LobbyLayout & { version: number };

const WALLS: readonly WallSide[] = ["back", "left", "right"];

export function toLobbyLayoutPayload(layout: LobbyLayout): LobbyLayoutPayload {
  const stored = storedItems(layout);
  return stored.length > 0 ? { version: LOBBY_LAYOUT_VERSION, items: layout.items, stored } : { version: LOBBY_LAYOUT_VERSION, items: layout.items };
}

/** 받은 본문을 배치로 읽는다. 모르는 버전이거나 모양이 맞지 않으면 null이다. */
export function parseLobbyLayoutPayload(value: unknown): LobbyLayout | null {
  const withStored = typeof value === "object" && value !== null && "stored" in value;
  if (!hasExactKeys(value, withStored ? ["version", "items", "stored"] : ["version", "items"]) || value.version !== LOBBY_LAYOUT_VERSION) return null;
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
  const stored: StoredItem[] = [];
  if (withStored) {
    const rawStored = (value as Record<string, unknown>).stored;
    if (!Array.isArray(rawStored) || raw.length + rawStored.length > MAX_ITEMS) return null;
    for (const entry of rawStored) {
      const item = parseStoredItem(entry);
      if (!item || ids.has(item.id)) return null;
      ids.add(item.id);
      stored.push(item);
    }
  }
  // 장소 가구는 하나씩 꼭 있어야 한다
  for (const type of REQUIRED_FURNITURE_TYPES) {
    if (items.filter((item) => item.type === type).length !== 1) return null;
  }
  return makeLayout(items, stored);
}

/** 보관함의 가구: id와 종류만 있고, 치울 수 있는 종류여야 한다. */
function parseStoredItem(value: unknown): StoredItem | null {
  if (!hasExactKeys(value, ["id", "type"])) return null;
  const { id, type } = value;
  if (typeof id !== "string" || !ID_PATTERN.test(id) || typeof type !== "string") return null;
  return findFurnitureType(type)?.removable ? { id, type } : null;
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
