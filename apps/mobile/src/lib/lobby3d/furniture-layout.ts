import { ROOM, type MarkId } from "./engine";

// 라룹이 방의 가구를 놓는 자리. Kenney 가구 묶음(lobby3d-furniture)과 코드로 만든 대체 모양(lobby3d-canvas)이 함께 쓴다.
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

// 가구는 Kenney 크기의 2.8배(라이트루프보다 조금 크게), 창문만 2.5배다.
export const FURNITURE_LAYOUT: readonly FurniturePlacement[] = [
  { piece: "board", x: 1.8, y: 1.75, z: 0.06, rotY: 0, mark: "board" },
  // 창문은 뒷벽에 하나만 둔다. 미닫이 창 두 벌을 나란히 놓은 넓은 창이다.
  { piece: "window", x: 4.8, y: 2.05, z: 0.17, rotY: 0, mark: "window" },
  // 일기 책상은 다른 가구보다 1.2배 커서 칸 "0,5"·"1,5"에 더해 "2,5" 절반까지 나온다
  { piece: "desk", x: 1.25, y: 0, z: 5.5, rotY: 0, mark: "desk" },
  // 의자는 책상 밑으로 대부분 밀어 넣는다(앞면이 책상을 본다). 등받이 쪽만 책상 앞(칸 "1,6")으로 조금 나온다
  { piece: "chair", x: 1.5, y: 0, z: 5.95, rotY: Math.PI, mark: "desk" },
  { piece: "bookcase", x: 0.44, y: 0, z: 2.5, rotY: Math.PI / 2, blocker: true },
  { piece: "wardrobe", x: W - 0.44, y: 0, z: 3.5, rotY: -Math.PI / 2, blocker: true },
  { piece: "rug", x: 4.6, y: 0.004, z: 7.2, rotY: 0 },
  // 방에는 문이 없고, 앞 가운데 입구 발판으로 밖에 나간다
  { piece: "exit", x: W / 2, y: 0, z: D + ROOM.stepDepth / 2, rotY: 0, mark: "door" }
];
