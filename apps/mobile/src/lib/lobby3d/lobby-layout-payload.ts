import { ROOM } from "./engine";
import type { Facing, FloorPieceId, FloorPlacementData, LobbyLayout, WallPieceId, WallPlacementData, WallSide } from "./lobby-layout";

// 계정에 저장하는 가구 배치(서버 /api/lobby-layout)의 본문: 배치 데이터에 모양 버전을 붙인 것.
// 서버와 같은 기준으로 모양만 본다(아는 가구가 빠짐없이 있는지, 방 안인지, 방향·벽 값). 겹침·길 막힘은 보지 않는다.

/** 지금 앱이 아는 배치 모양 버전. */
export const LOBBY_LAYOUT_VERSION = 1;

export type LobbyLayoutPayload = LobbyLayout & { version: number };

const FLOOR_PIECES: readonly FloorPieceId[] = ["desk", "bookcase", "wardrobe", "rug"];
const WALL_PIECES: readonly WallPieceId[] = ["board", "window"];
const WALLS: readonly WallSide[] = ["back", "left", "right"];

export function toLobbyLayoutPayload(layout: LobbyLayout): LobbyLayoutPayload {
  return { version: LOBBY_LAYOUT_VERSION, floor: layout.floor, wall: layout.wall };
}

/** 받은 본문을 배치로 읽는다. 모르는 버전이거나 모양이 맞지 않으면 null이다. */
export function parseLobbyLayoutPayload(value: unknown): LobbyLayout | null {
  if (!hasExactKeys(value, ["version", "floor", "wall"]) || value.version !== LOBBY_LAYOUT_VERSION) return null;
  if (!hasExactKeys(value.floor, FLOOR_PIECES) || !hasExactKeys(value.wall, WALL_PIECES)) return null;
  const floor = {} as Record<FloorPieceId, FloorPlacementData>;
  for (const id of FLOOR_PIECES) {
    const piece = parseFloorPiece(value.floor[id]);
    if (!piece) return null;
    floor[id] = piece;
  }
  const wall = {} as Record<WallPieceId, WallPlacementData>;
  for (const id of WALL_PIECES) {
    const piece = parseWallPiece(value.wall[id]);
    if (!piece) return null;
    wall[id] = piece;
  }
  return { floor, wall };
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
