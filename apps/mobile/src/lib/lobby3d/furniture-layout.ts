import { ROOM, activeLobbyLayout, type MarkId } from "./engine";
import { furnitureType, type FurnitureMount } from "./furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, type LobbyLayout } from "./lobby-layout";

// 라룹이 방의 가구를 놓는 자리. Kenney 가구 묶음(lobby3d-furniture)과 코드로 만든 대체 모양(lobby3d-canvas)이 함께 쓴다.
// 자리는 배치 데이터(lobby-layout)에서, 장소·막는 가구인지는 카탈로그(furniture-catalog)에서 계산한다.
// 좌표는 앱 좌표(칸)다. 기준점은 바닥 가운데이고, 벽에 거는 창문·게시판은 가운데다.
// exit는 가구가 아니라 방 앞 입구 발판(밖으로 나가는 길)을 덮는 보이지 않는 누르는 곳이다.
// rotY는 앞면(+z, 방 앞쪽)을 위에서 보아 반시계로 돌린 각도(라디안)다. 왼쪽 벽에 붙이면 앞면이 +x를 보게 π/2, 오른쪽 벽은 -π/2.

export interface FurniturePlacement {
  /** 배치한 가구 id. 딸린 의자는 그 책상의 id이고, 입구 발판은 "exit"다. */
  item: string;
  /** 3D 모델 이름(가구 묶음 안의 이름). 입구 발판은 "exit"다. */
  piece: string;
  /** 딸린 의자인지. */
  companion?: boolean;
  /** 배치 유형(입구 발판은 floor). 벽 가구는 기준점이 모델 가운데다. */
  mount: FurnitureMount;
  /** 모델 실제 크기(대체 모양 상자). 입구 발판은 없다. */
  box?: { width: number; height: number; depth: number };
  /** 옅은 그림자(카탈로그). */
  shadow?: { floor?: [number, number, number]; wall?: [number, number, number] };
  /** 창밖 장면과 창문 빛을 내는 창문인지. */
  view?: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** 누르면 이 장소로 간다. */
  mark?: MarkId;
  /** 장소가 아닌, 길을 막는 가구. 누르면 움직이지 않는다(engine의 SOLID_TILES와 칸이 맞아야 한다). */
  blocker?: boolean;
}

/** 창 안쪽(햇빛이 지나는 곳)의 크기와 창살 굵기. 창문(미닫이 창 두 벌)의 안쪽이다. 바닥의 창문 빛이 이 크기를 따른다. */
export const WINDOW_OPENING = { z: 0.05, width: 1.87, height: 1.66, bar: 0.08 } as const;

const W = ROOM.width;
const D = ROOM.depth;

/**
 * 배치 데이터에서 가구를 놓는 자리를 만든다. 벽 가구, 바닥 가구(딸린 의자는 그 책상 바로 뒤) 순서이고 마지막에 입구 발판이다.
 * 장소가 딸린 가구(와 그 의자)를 누르면 그 장소로 가고, 장소가 없는 바닥 가구는 길을 막는 가구로 누르면 움직이지 않는다.
 */
export function furniturePlacements(layout: LobbyLayout): FurniturePlacement[] {
  const list: FurniturePlacement[] = layoutGeometry(layout, W).pieces.map((p) => {
    const type = furnitureType(layout.items.find((item) => item.id === p.item)!.type);
    const mark = type.place?.id;
    const blocker = !mark && type.mount === "floor" && type.blocksWalk;
    const chair = p.companion ? type.chair : undefined;
    return {
      item: p.item,
      piece: p.piece,
      ...(p.companion ? { companion: true } : {}),
      mount: chair ? "floor" : type.mount,
      box: chair ? chair.box : type.model.box,
      shadow: chair ? { floor: chair.shadow } : type.model.shadow,
      ...(type.view && !chair ? { view: true } : {}),
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      ...(mark ? { mark } : {}),
      ...(blocker ? { blocker: true } : {})
    };
  });
  list.push({ item: "exit", piece: "exit", mount: "floor", x: W / 2, y: 0, z: D + ROOM.stepDepth / 2, rotY: 0, mark: "door" });
  return list;
}

/** 처음 배치의 가구 자리. */
export const FURNITURE_LAYOUT: readonly FurniturePlacement[] = furniturePlacements(DEFAULT_LOBBY_LAYOUT);

/**
 * 3D 물체를 가구 자리와 맞출 때 쓰는 이름: 배치한 가구 id, 딸린 의자는 그 뒤에 "#chair"를 붙인다.
 * 입구 발판은 가구 id로 만들 수 없는 "#exit"다(가구 id에는 "#"를 쓸 수 없어 겹치지 않는다).
 */
export function placementKey(place: FurniturePlacement): string {
  if (place.piece === "exit" && place.mark === "door") return "#exit";
  return place.companion ? `${place.item}#chair` : place.item;
}

/** 지금 배치(engine의 applyLobbyLayout)의 가구 자리. */
export function currentFurnitureLayout(): FurniturePlacement[] {
  return furniturePlacements(activeLobbyLayout());
}
