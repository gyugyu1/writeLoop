import { ROOM, activeLobbyLayout, type PlaceId } from "./engine";
import { currentRoom, outsideExit } from "./room";
import { TABLETOP_PICK_MIN, fittedModel, furnitureType, surfaceSlots, type FurnitureMount } from "./furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, closetPlaceId, layoutGeometry, makeLayout, storedItems, type FurnitureItem, type LobbyLayout } from "./lobby-layout";

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
  /** 칸에 맞춘 모델 크기(대체 모양 상자, 누르기 판정). 입구 발판은 없다. */
  box?: { width: number; height: number; depth: number };
  /** 탁상형 소품을 누르는 판정 크기(모델보다 넓힌 것). 없으면 box로 누른다. */
  pickBox?: { width: number; height: number; depth: number };
  /** 탁상형 소품이 올라간 받침 가구 id. 받침 가구를 띄우면 함께 뜬다. */
  parent?: string;
  /** 칸에 맞추려고 모델을 줄이거나 늘린 비율(가로 x·깊이 z). 입구 발판은 없다. */
  scale?: { x: number; z: number };
  /** 옅은 그림자(카탈로그 값을 모델과 같은 비율로 바꾼 것). */
  shadow?: { floor?: [number, number, number]; wall?: [number, number, number] };
  /** 창밖 장면과 창문 빛을 내는 창문인지. */
  view?: boolean;
  /** 보관함 가구(3D에 미리 만들어 숨겨 둔다). */
  stowed?: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** 누르면 이 장소로 간다(옷장은 그 옷장의 장소). */
  mark?: PlaceId;
  /** 장소가 아닌, 길을 막는 가구. 누르면 움직이지 않는다(engine의 SOLID_TILES와 칸이 맞아야 한다). */
  blocker?: boolean;
}

/** 자리를 만든 가구 id → 가구 종류(마지막으로 만든 배치 기준). 3D 가구가 그 가구의 모델 파일을 고를 때 쓴다. */
const ITEM_TYPES = new Map<string, string>();

/** 자리를 만든 적 있는 가구의 종류. 없으면 undefined. */
export function placedItemType(itemId: string): string | undefined {
  return ITEM_TYPES.get(itemId);
}

/** 창 안쪽(햇빛이 지나는 곳)의 크기와 창살 굵기. 창문(미닫이 창 두 벌)의 안쪽이다. 바닥의 창문 빛이 이 크기를 따른다. */
export const WINDOW_OPENING = { z: 0.05, width: 1.87, height: 1.66, bar: 0.08 } as const;


/**
 * 배치 데이터에서 가구를 놓는 자리를 만든다. 벽 가구, 바닥 가구(딸린 의자는 그 책상 바로 뒤) 순서이고 마지막에 입구 발판이다.
 * 장소가 딸린 가구(와 그 의자)를 누르면 그 장소로 가고, 장소가 없는 바닥 가구는 길을 막는 가구로 누르면 움직이지 않는다.
 */
export function furniturePlacements(layout: LobbyLayout): FurniturePlacement[] {
  const list: FurniturePlacement[] = layoutGeometry(layout, ROOM.width).pieces.map((p) => {
    const item = layout.items.find((it) => it.id === p.item)!;
    ITEM_TYPES.set(item.id, item.type);
    const type = furnitureType(item.type);
    // 탁상형 소품을 누르면 받침 가구를 누른 것과 같다(꾸미기 밖에서 책상 위 스탠드를 누르면 책상 장소로 간다)
    const ownerItem = item.on ? layout.items.find((it) => it.id === item.on!.parent)! : item;
    const owner = furnitureType(ownerItem.type);
    const mark: PlaceId | undefined = owner.place?.id ?? (owner.closet ? closetPlaceId(ownerItem.id) : undefined);
    const blocker = !mark && owner.mount === "floor" && owner.blocksWalk;
    const chair = p.companion ? type.chair : undefined;
    const fit = fittedModel(type);
    return {
      item: p.item,
      piece: p.piece,
      ...(p.companion ? { companion: true } : {}),
      mount: chair ? "floor" : type.mount,
      box: chair ? chair.box : fit.box,
      scale: chair ? { x: 1, z: 1 } : fit.scale,
      shadow: chair ? { floor: chair.shadow } : fit.shadow,
      ...(type.view && !chair ? { view: true } : {}),
      ...(item.on
        ? {
            parent: item.on.parent,
            pickBox: {
              width: Math.max(TABLETOP_PICK_MIN, fit.box.width),
              height: Math.max(TABLETOP_PICK_MIN, fit.box.height),
              depth: Math.max(TABLETOP_PICK_MIN, fit.box.depth)
            }
          }
        : {}),
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      ...(mark ? { mark } : {}),
      ...(blocker ? { blocker: true } : {})
    };
  });
  // 지금 방의 입구 발판 가운데
  list.push({ item: "exit", piece: "exit", mount: "floor", x: outsideExit(currentRoom()).x, y: 0, z: ROOM.depth + ROOM.stepDepth / 2, rotY: 0, mark: "door" });
  return list;
}

/**
 * 3D를 만들 가구 자리: 방에 놓인 가구와, 보관함 가구(stowed, 숨겨 둔다).
 * 꾸미기에서 치우고 꺼낼 때 3D를 다시 만들지 않고 보이기만 바꾸려고 보관함 가구도 미리 만든다.
 * 보관함 가구는 자리가 없어 방 가운데(벽 가구는 뒷벽 가운데, 탁상형은 첫 받침 가구의 첫 자리)에 만들어 두고, 꺼내면 편집 중 자리로 옮긴다.
 * 방에 받침 가구가 없으면 탁상형은 만들지 않는다(꺼낼 때 3D를 다시 만든다).
 */
export function buildPlacements(layout: LobbyLayout): FurniturePlacement[] {
  const stored = storedItems(layout);
  if (stored.length === 0) return furniturePlacements(layout);
  const base = layout.items.find((item) => item.floor && surfaceSlots(furnitureType(item.type)).length > 0);
  const parked: FurnitureItem[] = stored.flatMap((item): FurnitureItem[] => {
    const mount = furnitureType(item.type).mount;
    if (mount === "tabletop") return base ? [{ ...item, on: { parent: base.id, slot: 0, facing: 0 } }] : [];
    if (mount === "wall") return [{ ...item, wall: { wall: "back", along: ROOM.width / 2 } }];
    return [{ ...item, floor: { x: ROOM.width / 2, z: ROOM.depth / 2, facing: 0 } }];
  });
  const stowedIds = new Set(stored.map((item) => item.id));
  return furniturePlacements(makeLayout([...layout.items, ...parked], [])).map((p) =>
    stowedIds.has(p.item) && p.mark !== "door" ? { ...p, stowed: true } : p
  );
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
