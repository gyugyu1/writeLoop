import type { FloorPoint, MarkId } from "./engine";

// 방의 가구 배치(배치 데이터)와, 거기서 계산하는 값(막힌 칸, 장소의 서는 자리·바라볼 지점·이름표, 의자, 3D 자리).
// 좌표는 engine과 같다(바닥 한 칸 = 1, x는 왼쪽→오른쪽, z는 뒷벽→앞). 방향은 위에서 보아 반시계로 돈 각도(three.js rotY)다.
// 가구마다 앞면이 +z(방 앞쪽)를 보는 모양을 기준으로 적고, 놓인 방향만큼 돌려 방 좌표로 옮긴다.

export type FloorPieceId = "desk" | "bookcase" | "wardrobe" | "rug";
export type WallPieceId = "board" | "window";
/** 바닥 가구의 방향: 앞면이 보는 쪽. 0 앞(+z), 1 오른쪽(+x), 2 뒤(-z), 3 왼쪽(-x). */
export type Facing = 0 | 1 | 2 | 3;
/** 벽 가구를 거는 벽. 앞쪽은 열려 있어(카메라 쪽) 걸 수 없다. */
export type WallSide = "back" | "left" | "right";

export interface FloorPlacementData {
  /** 가구가 차지하는 칸 모양의 가운데(바닥 좌표). 깔개는 칸을 막지 않아 그림 가운데다. */
  x: number;
  z: number;
  facing: Facing;
}

export interface WallPlacementData {
  wall: WallSide;
  /** 벽을 따라간 자리(뒷벽은 x, 옆벽은 z). */
  along: number;
}

export interface LobbyLayout {
  floor: Record<FloorPieceId, FloorPlacementData>;
  wall: Record<WallPieceId, WallPlacementData>;
}

/** 처음 배치. 로비를 처음 만들 때의 자리와 같다. */
export const DEFAULT_LOBBY_LAYOUT: LobbyLayout = {
  floor: {
    // 칸 "0,5"·"1,5"·"2,5"(3×1). 그림은 1.2배 커서 "2,5" 절반까지 나온다
    desk: { x: 1.5, z: 5.5, facing: 0 },
    // 칸 "0,2". 왼쪽 벽에 붙어 앞면이 방(+x)을 본다
    bookcase: { x: 0.5, z: 2.5, facing: 1 },
    // 칸 "7,3". 오른쪽 벽에 붙어 앞면이 방(-x)을 본다
    wardrobe: { x: 7.5, z: 3.5, facing: 3 },
    rug: { x: 4.6, z: 7.2, facing: 0 }
  },
  wall: {
    board: { wall: "back", along: 1.8 },
    // 창문은 미닫이 창 두 벌을 나란히 놓은 넓은 창이다
    window: { wall: "back", along: 4.8 }
  }
};

/** 두 배치의 가구 자리·방향·벽이 모두 같은지. */
export function sameLobbyLayout(a: LobbyLayout, b: LobbyLayout): boolean {
  const floorSame = (Object.keys(a.floor) as FloorPieceId[]).every((id) => {
    const p = a.floor[id];
    const q = b.floor[id];
    return p.x === q.x && p.z === q.z && p.facing === q.facing;
  });
  const wallSame = (Object.keys(a.wall) as WallPieceId[]).every(
    (id) => a.wall[id].wall === b.wall[id].wall && a.wall[id].along === b.wall[id].along
  );
  return floorSame && wallSame;
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

/**
 * 바닥 가구가 차지하는 칸 모양(가구 기준, 앞면 +z: 가로 칸 × 깊이 칸)과, 그 안에서 그림을 놓는 자리(칸 모양 가운데에서 옮긴 만큼).
 * 막는 가구는 칸 모양의 칸을 막는다. 돌리면 칸 모양이 가운데를 중심으로 돈다.
 */
const FLOOR_SHAPE: Record<FloorPieceId, { width: number; depth: number; blocks: boolean; drawAt: FloorPoint }> = {
  // 그림이 칸보다 1.2배 커서 왼쪽으로 조금 치우쳐 놓는다
  desk: { width: 3, depth: 1, blocks: true, drawAt: { x: -0.25, z: 0 } },
  // 책장·옷장은 벽에 붙게 칸 안에서 뒤로 조금 민다
  bookcase: { width: 1, depth: 1, blocks: true, drawAt: { x: 0, z: -0.06 } },
  wardrobe: { width: 1, depth: 1, blocks: true, drawAt: { x: 0, z: -0.06 } },
  // 깔개는 걸어 다니는 바닥 장식이라 칸을 막지 않는다
  rug: { width: 2, depth: 2, blocks: false, drawAt: { x: 0, z: 0 } }
};

/** 바닥 가구가 차지하는 칸 모양을 놓인 방향대로 돌린 가로(x)·깊이(z) 칸 수. */
export function floorPieceSize(id: FloorPieceId, facing: Facing): { width: number; depth: number } {
  const { width, depth } = FLOOR_SHAPE[id];
  return facing % 2 === 0 ? { width, depth } : { width: depth, depth: width };
}

/** 바닥 가구가 차지하는 칸 모양의 범위(방 좌표). 깔개처럼 칸에 맞지 않은 자리도 있다. */
export function floorPieceBounds(id: FloorPieceId, placement: FloorPlacementData): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const { width, depth } = floorPieceSize(id, placement.facing);
  return {
    minX: round(placement.x - width / 2),
    maxX: round(placement.x + width / 2),
    minZ: round(placement.z - depth / 2),
    maxZ: round(placement.z + depth / 2)
  };
}

/** 지나갈 수 없게 칸을 막는 바닥 가구인지(깔개는 막지 않는다). */
export function floorPieceBlocks(id: FloorPieceId): boolean {
  return FLOOR_SHAPE[id].blocks;
}

/** 벽 가구가 벽을 따라 차지하는 폭(칸). 바로 아래 칸에는 키 큰 가구를 놓지 못한다(편집 모드). */
export const WALL_PIECE_WIDTH: Record<WallPieceId, number> = { board: 1.8, window: 2.3 };

/** 벽 가구를 거는 높이와 벽에서 나온 거리. */
const WALL_MOUNT: Record<WallPieceId, { y: number; depth: number }> = {
  board: { y: 1.75, depth: 0.06 },
  window: { y: 2.05, depth: 0.17 }
};

type PlaceId = Exclude<MarkId, "door">;

/**
 * 가구에 딸린 장소(가구 기준 좌표). 서는 자리, 바라볼 지점, 이름표(바닥 좌표와 높이).
 * 벽 가구는 벽 면 위 자리가 기준이다.
 */
const PLACE_OF: Record<PlaceId, { piece: FloorPieceId | WallPieceId; approach: FloorPoint[]; faceTo: FloorPoint; label: { x: number; y: number; z: number } }> = {
  board: { piece: "board", approach: [{ x: -0.2, z: 1.3 }, { x: 0.4, z: 1.3 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 2.75, z: 0.3 } },
  window: { piece: "window", approach: [{ x: -0.3, z: 1.55 }, { x: 0.3, z: 1.55 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 3.05, z: 0.3 } },
  // 의자 바로 뒤에 서서 책상(그림 가운데)을 본다(장소 구역도 서는 자리를 가운데로 한다)
  desk: { piece: "desk", approach: [{ x: 0, z: 1.25 }], faceTo: { x: -0.25, z: 0 }, label: { x: -0.25, y: 2.1, z: 0 } },
  // 책장 앞에 서서 책장 뒤(벽 쪽)를 본다. 이름표는 방 쪽으로 조금 옮긴다(벽 가까이면 화면 끝에서 잘린다)
  bookcase: { piece: "bookcase", approach: [{ x: 0, z: 0.9 }], faceTo: { x: 0, z: -0.5 }, label: { x: 0, y: 2.3, z: 0.4 } }
};

/** 일기 책상 의자(책상 기준). 책상 밑 자리와, '들어가기' 때 빼는 쪽(앞), 앉는 자리, 비켜서는 옆 자리. */
const DESK_CHAIR = {
  at: { x: 0, z: 0.45 },
  pull: 0.5,
  seat: { x: 0, z: 0.95 },
  side: { x: 0.65, z: 1.05 },
  seatHeight: 0.67
};

export interface PlacedPiece {
  piece: FloorPieceId | WallPieceId | "chair";
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface LayoutGeometry {
  /** 3D에 놓는 가구(의자 포함). 입구 발판은 넣지 않는다. */
  pieces: PlacedPiece[];
  /** 가구가 있어 지나갈 수 없는 칸("열,행"). */
  solidTiles: Set<string>;
  places: Record<PlaceId, { approach: FloorPoint[]; faceTo: FloorPoint; label: { x: number; y: number; z: number } }>;
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

/** 배치 데이터에서 3D 자리·막힌 칸·장소·의자를 계산한다. */
export function layoutGeometry(layout: LobbyLayout, roomWidth: number): LayoutGeometry {
  const poseOf = (piece: FloorPieceId | WallPieceId): Pose =>
    piece in layout.floor ? layout.floor[piece as FloorPieceId] : wallPose(layout.wall[piece as WallPieceId], roomWidth);

  const pieces: PlacedPiece[] = [];
  for (const id of Object.keys(layout.wall) as WallPieceId[]) {
    const pose = poseOf(id);
    const at = toRoom(pose, { x: 0, z: WALL_MOUNT[id].depth });
    pieces.push({ piece: id, x: at.x, y: WALL_MOUNT[id].y, z: at.z, rotY: FACING_ROT[pose.facing].rotY });
  }
  for (const id of Object.keys(layout.floor) as FloorPieceId[]) {
    const pose = poseOf(id);
    const drawn = toRoom(pose, FLOOR_SHAPE[id].drawAt);
    pieces.push({ piece: id, x: drawn.x, y: id === "rug" ? 0.004 : 0, z: drawn.z, rotY: FACING_ROT[pose.facing].rotY });
  }
  const desk = layout.floor.desk;
  const chairAt = toRoom(desk, DESK_CHAIR.at);
  // 의자는 앞면이 책상을 본다
  const deskBack = ((desk.facing + 2) % 4) as Facing;
  pieces.push({ piece: "chair", x: chairAt.x, y: 0, z: chairAt.z, rotY: FACING_ROT[deskBack].rotY });

  const solidTiles = new Set<string>();
  for (const id of Object.keys(layout.floor) as FloorPieceId[]) {
    const f = FLOOR_SHAPE[id];
    if (!f.blocks) continue;
    const pose = layout.floor[id];
    const corners = [
      toRoom(pose, { x: -f.width / 2, z: -f.depth / 2 }),
      toRoom(pose, { x: f.width / 2, z: f.depth / 2 })
    ];
    const minX = Math.min(corners[0].x, corners[1].x);
    const maxX = Math.max(corners[0].x, corners[1].x);
    const minZ = Math.min(corners[0].z, corners[1].z);
    const maxZ = Math.max(corners[0].z, corners[1].z);
    for (let c = Math.floor(minX + 1e-6); c < Math.ceil(maxX - 1e-6); c += 1) {
      for (let r = Math.floor(minZ + 1e-6); r < Math.ceil(maxZ - 1e-6); r += 1) solidTiles.add(`${c},${r}`);
    }
  }

  const places = {} as LayoutGeometry["places"];
  for (const id of Object.keys(PLACE_OF) as PlaceId[]) {
    const spec = PLACE_OF[id];
    const pose = poseOf(spec.piece);
    const labelAt = toRoom(pose, { x: spec.label.x, z: spec.label.z });
    places[id] = {
      approach: spec.approach.map((p) => toRoom(pose, p)),
      faceTo: toRoom(pose, spec.faceTo),
      label: { x: labelAt.x, y: spec.label.y, z: labelAt.z }
    };
  }

  const front = toRoom({ x: 0, z: 0, facing: desk.facing }, { x: 0, z: 1 });
  return {
    pieces,
    solidTiles,
    places,
    chair: {
      home: chairAt,
      pullDir: front,
      pull: DESK_CHAIR.pull,
      seat: toRoom(desk, DESK_CHAIR.seat),
      side: toRoom(desk, DESK_CHAIR.side),
      seatHeight: DESK_CHAIR.seatHeight,
      heading: FACING_ROT[deskBack].rotY
    }
  };
}
