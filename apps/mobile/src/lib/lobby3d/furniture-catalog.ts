// 라이트루프 방에 놓는 가구 종류(카탈로그). 가구마다의 값을 이 한 곳에 두고, 배치 규칙·3D·장소·편집 모드는 이 값만 읽는다.
// 가구를 더할 때는 여기에 한 줄을 더하고 가구 묶음(lobby-furniture.glb)에 모델을 넣는다(코드에 가구 이름을 따로 적지 않는다).
// 좌표는 가구 기준이다: 앞면이 +z(방 앞쪽)를 보고, 칸 모양의 가운데가 원점이다. 벽 가구는 벽 면 위 자리가 원점이고 앞면이 방 안쪽을 본다.

/** 가구 기준 바닥 좌표(칸). */
export interface LocalPoint {
  x: number;
  z: number;
}

/**
 * 배치 유형. floor: 바닥에 놓고 길을 막을 수 있는 가구(책상·책장). cover: 바닥에 까는 덮개(깔개), 바닥 가구와 겹쳐도 된다.
 * wall: 벽에 거는 가구(게시판·창문). tabletop: 윗면이 있는 가구(받침 가구) 위의 자리에 올리는 소품(스탠드).
 */
export type FurnitureMount = "floor" | "cover" | "wall" | "tabletop";

/** 가구에 딸린 장소(로비의 기능 입구). engine의 MarkId 중 밖으로(door)를 뺀 것이다. */
export type FurniturePlaceId = "board" | "window" | "desk" | "bookcase";

export interface FurnitureType {
  id: string;
  name: string;
  mount: FurnitureMount;
  /** 차지하는 칸. floor·cover는 가로(x)×깊이(z) 칸(앞면 기준), wall은 벽을 따라 차지하는 폭(width, depth는 쓰지 않는다), tabletop은 자리 한 칸(1×1)이다. */
  size: { width: number; depth: number };
  /** 높이(칸). floor·cover는 바닥(0)에서 윗면까지, wall은 걸린 높이의 아래 끝~위 끝, tabletop은 받침 가구 윗면(0)에서 위 끝까지다. */
  height: { bottom: number; top: number };
  /** 지나갈 수 없게 칸을 막는지. */
  blocksWalk: boolean;
  /** 딸린 장소: 서는 자리들, 바라볼 지점, 이름표(가구 기준 바닥 좌표와 높이). */
  place?: { id: FurniturePlaceId; approach: LocalPoint[]; faceTo: LocalPoint; label: { x: number; y: number; z: number } };
  /** 딸린 의자(일기 책상): 책상 밑 자리, '들어가기' 때 앞으로 빼는 거리, 앉는 자리, 앉기 전에 비켜서는 자리, 앉은 높이. */
  chair?: {
    piece: string;
    at: LocalPoint;
    pull: number;
    seat: LocalPoint;
    side: LocalPoint;
    seatHeight: number;
    /** 의자 모델 실제 크기와 바닥 그림자(가로·깊이·진하기). */
    box: { width: number; height: number; depth: number };
    shadow: [number, number, number];
  };
  /**
   * 소품(tabletop)을 올릴 수 있는 윗면. 자리는 차지한 칸마다 하나씩, 칸 가운데·윗면 높이(height.top)에 생긴다.
   * cells를 적으면 그 칸(가구 기준 칸 가운데 좌표)에만 자리가 있다(윗면이 칸 전체를 덮지 않는 가구).
   */
  surface?: { cells?: LocalPoint[] };
  /** 보관함으로 치울 수 있는지. 장소가 딸린 가구는 치울 수 없다(사용자 결정). */
  removable: boolean;
  /** 창밖 장면과 바닥 창문 빛을 내는 창문인지. */
  view?: boolean;
  model: {
    /** 가구 묶음(lobby-furniture.glb) 안의 이름. */
    piece: string;
    /** 모델 실제 크기(칸): 가로·높이·깊이. 칸보다 크면 칸에 맞춰 줄여 그린다(fittedModel). */
    box: { width: number; height: number; depth: number };
    /** 칸 모양 가운데에서 모델을 옆으로 치우쳐 놓는 거리(가구 기준 x). 맞춘 모델이 칸 밖으로 나가지 않게 줄여 쓴다. */
    offsetX?: number;
    /** 모델 가로가 칸 폭보다 작아도 칸 폭에 맞춰 늘리는지(칸을 꽉 채우는 가구). */
    fillWidth?: boolean;
    /** 모델을 놓는 높이. 벽 가구는 모델 가운데 높이, 탁상형은 받침 가구 윗면에서 잰 높이다. */
    y: number;
    /** 벽 가구가 벽 면에서 나온 거리. */
    wallDepth?: number;
    /** 옅은 그림자(실시간 아님): floor는 바닥에 닿은 넓이(가로·깊이)와 진하기, wall은 벽에 비치는 넓이(가로·세로)와 진하기. 모델을 줄인 만큼 함께 줄인다. */
    shadow?: { floor?: [number, number, number]; wall?: [number, number, number] };
  };
}

/** 칸에 맞춘 모델: 바꾼 비율(가로 x·깊이 z, 높이는 바꾸지 않는다), 바꾼 크기, 칸 모양 가운데에서 놓는 자리, 바꾼 그림자. */
export interface FittedModel {
  scale: { x: number; z: number };
  box: { width: number; height: number; depth: number };
  drawAt: LocalPoint;
  shadow?: { floor?: [number, number, number]; wall?: [number, number, number] };
}

const CATALOG: FurnitureType[] = [
  {
    id: "desk",
    name: "일기 책상",
    mount: "floor",
    size: { width: 3, depth: 1 },
    height: { bottom: 0, top: 1.292 },
    blocksWalk: true,
    // 의자 바로 뒤에 서서 책상 가운데를 본다(장소 구역도 서는 자리를 가운데로 한다)
    place: { id: "desk", approach: [{ x: 0, z: 1.25 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 2.1, z: 0 } },
    chair: {
      piece: "chair",
      at: { x: 0, z: 0.45 },
      pull: 0.5,
      seat: { x: 0, z: 0.95 },
      side: { x: 0.65, z: 1.05 },
      seatHeight: 0.67,
      box: { width: 0.56, height: 1.316, depth: 0.56 },
      shadow: [0.75, 0.75, 0.42]
    },
    // 칸마다 소품 자리가 하나씩(왼쪽·가운데·오른쪽)
    surface: {},
    removable: false,
    // 그림이 칸보다 좁아 가로를 3칸에 꽉 차게 늘린다
    model: { piece: "desk", box: { width: 2.468, height: 1.292, depth: 1.318 }, fillWidth: true, y: 0, shadow: { floor: [2.8, 1.65, 0.5] } }
  },
  {
    id: "bookcase",
    name: "책장",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 2.464 },
    blocksWalk: true,
    // 책장 앞에 서서 책장 뒤(벽 쪽)를 본다. 이름표는 방 쪽으로 조금 옮긴다(벽 가까이면 화면 끝에서 잘린다)
    place: { id: "bookcase", approach: [{ x: 0, z: 0.9 }], faceTo: { x: 0, z: -0.5 }, label: { x: 0, y: 2.3, z: 0.4 } },
    removable: false,
    model: { piece: "bookcase", box: { width: 1.12, height: 2.464, depth: 0.876 }, y: 0, shadow: { floor: [1.4, 1.2, 0.52] } }
  },
  {
    id: "wardrobe",
    name: "옷장",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 2.38 },
    blocksWalk: true,
    removable: true,
    model: { piece: "wardrobe", box: { width: 1.12, height: 2.38, depth: 0.876 }, y: 0, shadow: { floor: [1.4, 1.2, 0.52] } }
  },
  {
    id: "rug",
    name: "깔개",
    mount: "cover",
    // 모델(2.576)이 들어가게 3×3 칸을 차지한다
    size: { width: 3, depth: 3 },
    height: { bottom: 0, top: 0.028 },
    blocksWalk: false,
    removable: true,
    model: { piece: "rug", box: { width: 2.576, height: 0.028, depth: 2.576 }, y: 0.004 }
  },
  {
    id: "lamp",
    name: "스탠드",
    mount: "tabletop",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 0.88 },
    blocksWalk: false,
    removable: true,
    model: { piece: "tableLamp", box: { width: 0.418, height: 0.88, depth: 0.475 }, y: 0 }
  },
  {
    id: "board",
    name: "오늘의 질문 게시판",
    mount: "wall",
    size: { width: 1.8, depth: 0 },
    height: { bottom: 1.05, top: 2.45 },
    blocksWalk: false,
    place: { id: "board", approach: [{ x: -0.2, z: 1.3 }, { x: 0.4, z: 1.3 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 2.75, z: 0.3 } },
    removable: false,
    model: { piece: "board", box: { width: 1.792, height: 1.4, depth: 0.126 }, y: 1.75, wallDepth: 0.06, shadow: { wall: [2.0, 1.6, 0.3] } }
  },
  {
    id: "window",
    name: "창문",
    mount: "wall",
    size: { width: 2.3, depth: 0 },
    height: { bottom: 1.112, top: 2.988 },
    blocksWalk: false,
    place: { id: "window", approach: [{ x: -0.3, z: 1.55 }, { x: 0.3, z: 1.55 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 3.05, z: 0.3 } },
    removable: false,
    view: true,
    // 창문은 미닫이 창 두 벌을 나란히 놓은 넓은 창이다
    model: { piece: "window", box: { width: 2.3, height: 1.876, depth: 0.35 }, y: 2.05, wallDepth: 0.17, shadow: { wall: [2.55, 2.15, 0.3] } }
  }
];

const BY_ID = new Map(CATALOG.map((t) => [t.id, t]));

/** 아는 가구 종류 전부. */
export const FURNITURE_TYPES: readonly FurnitureType[] = CATALOG;

/** 가구 종류. 모르는 종류면 undefined. */
export function findFurnitureType(id: string): FurnitureType | undefined {
  return BY_ID.get(id);
}

/** 가구 종류(아는 종류여야 한다. 배치는 불러올 때 아는 종류만 받는다). */
export function furnitureType(id: string): FurnitureType {
  const type = BY_ID.get(id);
  if (!type) throw new Error(`unknown furniture type: ${id}`);
  return type;
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * 모델을 차지하는 칸 안에 맞춘다(모든 가구에 같은 규칙).
 * - 모델 가로가 칸 폭(벽 가구는 벽을 따라 차지하는 폭)보다 크면 칸 폭에 맞게 줄인다. fillWidth면 작아도 칸 폭에 맞게 늘린다.
 *   바닥 가구·덮개는 깊이도 넘치면 줄인다. 높이는 바꾸지 않는다.
 * - 바닥 가구는 모델 뒷면을 칸 뒤 끝에 맞춘다(뒷면을 벽에 대면 딱 붙는다). 덮개는 칸 가운데다.
 * - 옆 자리는 offsetX를 따르되 모델이 칸 밖으로 나가지 않게 한다.
 * - 그림자는 줄이거나 늘린 방향만 같은 비율로 바꾼다.
 */
export function fittedModel(type: FurnitureType): FittedModel {
  const { box } = type.model;
  const x = type.model.fillWidth ? type.size.width / box.width : Math.min(1, type.size.width / box.width);
  const z = type.mount === "wall" ? 1 : Math.min(1, type.size.depth / box.depth);
  const width = round(box.width * x);
  const depth = round(box.depth * z);
  const sideRoom = Math.max(0, (type.size.width - width) / 2);
  const drawAt = {
    x: round(Math.max(-sideRoom, Math.min(sideRoom, type.model.offsetX ?? 0))),
    z: type.mount === "floor" ? round(-(type.size.depth - depth) / 2) : 0
  };
  const { shadow } = type.model;
  return {
    scale: { x, z },
    box: { width, height: box.height, depth },
    drawAt,
    ...(shadow
      ? {
          shadow: {
            ...(shadow.floor ? { floor: [round(shadow.floor[0] * x), round(shadow.floor[1] * z), shadow.floor[2]] as [number, number, number] } : {}),
            ...(shadow.wall ? { wall: [round(shadow.wall[0] * x), shadow.wall[1], shadow.wall[2]] as [number, number, number] } : {})
          }
        }
      : {})
  };
}

/** 탁상형 소품을 누르는 판정의 가로·깊이·높이 최소값(칸). 작은 소품도 누르기 쉽게 모델보다 넓힌다. */
export const TABLETOP_PICK_MIN = 0.8;

/**
 * 윗면이 있는 가구의 소품 자리(가구 기준 바닥 좌표). 차지한 칸마다 하나씩 칸 가운데이고(카탈로그에 cells가 있으면 그 칸만),
 * 번호(목록 순서)는 뒤쪽 줄(z가 작은 쪽)부터, 줄 안에서는 왼쪽(x가 작은 쪽)부터다. 윗면이 없으면 빈 목록이다.
 */
export function surfaceSlots(type: FurnitureType): LocalPoint[] {
  if (!type.surface) return [];
  const cells = type.surface.cells;
  if (cells) return [...cells].sort((a, b) => a.z - b.z || a.x - b.x);
  const { width, depth } = type.size;
  const slots: LocalPoint[] = [];
  for (let r = 0; r < depth; r += 1) {
    for (let c = 0; c < width; c += 1) slots.push({ x: round(c + 0.5 - width / 2), z: round(r + 0.5 - depth / 2) });
  }
  return slots;
}

/** 장소가 딸려 배치에 하나씩 꼭 있어야 하는 가구 종류. */
export const REQUIRED_FURNITURE_TYPES: readonly string[] = CATALOG.filter((t) => t.place).map((t) => t.id);
