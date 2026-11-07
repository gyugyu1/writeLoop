import { ROOM, activeLobbyLayout, type MarkId } from "./engine";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, type LobbyLayout } from "./lobby-layout";

// 라룹이 방의 가구를 놓는 자리. Kenney 가구 묶음(lobby3d-furniture)과 코드로 만든 대체 모양(lobby3d-canvas)이 함께 쓴다.
// 자리는 배치 데이터(lobby-layout)에서 계산한다.
// 좌표는 앱 좌표(칸)다. 기준점은 바닥 가운데이고, 벽에 거는 창문·게시판은 가운데다.
// exit는 가구가 아니라 방 앞 입구 발판(밖으로 나가는 길)을 덮는 보이지 않는 누르는 곳이다.
// rotY는 앞면(+z, 방 앞쪽)을 위에서 보아 반시계로 돌린 각도(라디안)다. 왼쪽 벽에 붙이면 앞면이 +x를 보게 π/2, 오른쪽 벽은 -π/2.

export type FurniturePiece = "board" | "window" | "exit" | "desk" | "chair" | "bookcase" | "wardrobe" | "rug";

export interface FurniturePlacement {
  piece: FurniturePiece;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** 누르면 이 장소로 간다. */
  mark?: MarkId;
  /** 장소가 아닌 가구. 누르면 움직이지 않는다(engine의 SOLID_TILES와 칸이 맞아야 한다). */
  blocker?: boolean;
}

/** 창 안쪽(햇빛이 지나는 곳)의 크기와 창살 굵기. 창문(미닫이 창 두 벌)의 안쪽이다. 바닥의 창문 빛이 이 크기를 따른다. */
export const WINDOW_OPENING = { z: 0.05, width: 1.87, height: 1.66, bar: 0.08 } as const;

const W = ROOM.width;
const D = ROOM.depth;

/** 장소인 가구(누르면 그 장소로 간다)와 장소가 아닌 가구(누르면 움직이지 않는다). */
const MARK_OF: Partial<Record<FurniturePiece, MarkId>> = { board: "board", window: "window", desk: "desk", chair: "desk", bookcase: "bookcase" };
const BLOCKERS: ReadonlySet<FurniturePiece> = new Set<FurniturePiece>(["wardrobe"]);
/** 놓는 순서(가구 묶음·대체 모양을 만드는 순서). */
const ORDER: FurniturePiece[] = ["board", "window", "desk", "chair", "bookcase", "wardrobe", "rug"];

/**
 * 배치 데이터에서 가구를 놓는 자리를 만든다. 가구는 Kenney 크기의 2.8배(라이트루프보다 조금 크게), 창문만 2.5배다.
 * 의자는 일기 책상 밑에 대부분 밀어 넣고(앞면이 책상을 본다), 방에는 문이 없어 앞 가운데 입구 발판으로 밖에 나간다.
 */
export function furniturePlacements(layout: LobbyLayout): FurniturePlacement[] {
  const placed = layoutGeometry(layout, W).pieces;
  const list: FurniturePlacement[] = [];
  for (const piece of ORDER) {
    const p = placed.find((q) => q.piece === piece);
    if (!p) continue;
    const mark = MARK_OF[piece];
    list.push({ piece, x: p.x, y: p.y, z: p.z, rotY: p.rotY, ...(mark ? { mark } : {}), ...(BLOCKERS.has(piece) ? { blocker: true } : {}) });
  }
  list.push({ piece: "exit", x: W / 2, y: 0, z: D + ROOM.stepDepth / 2, rotY: 0, mark: "door" });
  return list;
}

/** 처음 배치의 가구 자리. */
export const FURNITURE_LAYOUT: readonly FurniturePlacement[] = furniturePlacements(DEFAULT_LOBBY_LAYOUT);

/** 지금 배치(engine의 applyLobbyLayout)의 가구 자리. */
export function currentFurnitureLayout(): FurniturePlacement[] {
  return furniturePlacements(activeLobbyLayout());
}
