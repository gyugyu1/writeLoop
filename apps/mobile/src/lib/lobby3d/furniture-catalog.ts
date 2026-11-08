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
 * wall: 벽에 거는 가구(게시판·창문). 탁상형(가구 위에 올리는 소품)은 뒤에 더한다.
 */
export type FurnitureMount = "floor" | "cover" | "wall";

/** 가구에 딸린 장소(로비의 기능 입구). engine의 MarkId 중 밖으로(door)를 뺀 것이다. */
export type FurniturePlaceId = "board" | "window" | "desk" | "bookcase";

export interface FurnitureType {
  id: string;
  name: string;
  mount: FurnitureMount;
  /** 차지하는 칸. floor·cover는 가로(x)×깊이(z) 칸(앞면 기준), wall은 벽을 따라 차지하는 폭(width, depth는 쓰지 않는다). */
  size: { width: number; depth: number };
  /** 높이(칸). floor·cover는 바닥(0)에서 윗면까지, wall은 걸린 높이의 아래 끝~위 끝이다. */
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
  /** 보관함으로 치울 수 있는지. 장소가 딸린 가구는 치울 수 없다(사용자 결정). */
  removable: boolean;
  /** 창밖 장면과 바닥 창문 빛을 내는 창문인지. */
  view?: boolean;
  model: {
    /** 가구 묶음(lobby-furniture.glb) 안의 이름. */
    piece: string;
    /** 모델 실제 크기(칸): 가로·높이·깊이. 대체 모양 상자와 3D 판정이 쓴다. */
    box: { width: number; height: number; depth: number };
    /** 칸 모양 가운데에서 모델을 놓는 자리(가구 기준). */
    drawAt: LocalPoint;
    /** 모델을 놓는 높이. 벽 가구는 모델 가운데 높이다. */
    y: number;
    /** 벽 가구가 벽 면에서 나온 거리. */
    wallDepth?: number;
    /** 옅은 그림자(실시간 아님): floor는 바닥에 닿은 넓이(가로·깊이)와 진하기, wall은 벽에 비치는 넓이(가로·세로)와 진하기. */
    shadow?: { floor?: [number, number, number]; wall?: [number, number, number] };
  };
}

const CATALOG: FurnitureType[] = [
  {
    id: "desk",
    name: "일기 책상",
    mount: "floor",
    size: { width: 3, depth: 1 },
    height: { bottom: 0, top: 1.292 },
    blocksWalk: true,
    // 의자 바로 뒤에 서서 책상(그림 가운데)을 본다(장소 구역도 서는 자리를 가운데로 한다)
    place: { id: "desk", approach: [{ x: 0, z: 1.25 }], faceTo: { x: -0.25, z: 0 }, label: { x: -0.25, y: 2.1, z: 0 } },
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
    removable: false,
    // 그림이 칸보다 커서 왼쪽으로 조금 치우쳐 놓는다
    model: { piece: "desk", box: { width: 2.468, height: 1.292, depth: 1.318 }, drawAt: { x: -0.25, z: 0 }, y: 0, shadow: { floor: [2.8, 1.65, 0.5] } }
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
    // 벽에 붙게 칸 안에서 뒤로 조금 민다
    model: { piece: "bookcase", box: { width: 1.12, height: 2.464, depth: 0.876 }, drawAt: { x: 0, z: -0.06 }, y: 0, shadow: { floor: [1.4, 1.2, 0.52] } }
  },
  {
    id: "wardrobe",
    name: "옷장",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 2.38 },
    blocksWalk: true,
    removable: true,
    model: { piece: "wardrobe", box: { width: 1.12, height: 2.38, depth: 0.876 }, drawAt: { x: 0, z: -0.06 }, y: 0, shadow: { floor: [1.4, 1.2, 0.52] } }
  },
  {
    id: "rug",
    name: "깔개",
    mount: "cover",
    size: { width: 2, depth: 2 },
    height: { bottom: 0, top: 0.028 },
    blocksWalk: false,
    removable: true,
    model: { piece: "rug", box: { width: 2.576, height: 0.028, depth: 2.576 }, drawAt: { x: 0, z: 0 }, y: 0.004 }
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
    model: { piece: "board", box: { width: 1.792, height: 1.4, depth: 0.126 }, drawAt: { x: 0, z: 0 }, y: 1.75, wallDepth: 0.06, shadow: { wall: [2.0, 1.6, 0.3] } }
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
    model: { piece: "window", box: { width: 2.3, height: 1.876, depth: 0.35 }, drawAt: { x: 0, z: 0 }, y: 2.05, wallDepth: 0.17, shadow: { wall: [2.55, 2.15, 0.3] } }
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

/** 장소가 딸려 배치에 하나씩 꼭 있어야 하는 가구 종류. */
export const REQUIRED_FURNITURE_TYPES: readonly string[] = CATALOG.filter((t) => t.place).map((t) => t.id);
