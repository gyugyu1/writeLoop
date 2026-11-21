import LAYOUT from "./clothing-shop-layout.json";

// 마을 옷집 실내(1층·2층)의 데이터: 층마다 크기, 걸을 수 없는 곳, 장소, 라룹이가 들어서는 자리, 카메라 끝 상자.
// 배치는 실내 모델과 함께 나온 clothing-shop-layout.json 하나에서 읽는다(모델 좌표: 미터, +Y 위, +Z 출입구 쪽).
// 층 모델(assets/models/clothing-shop/clothing-shop-interior-1f.glb·-2f.glb)의 노드 자리와 같은지는 테스트가 본다.
// 좌표: 앱 좌표 = 모델 X·Z + CLOTHING_OFFSET. 오프셋은 여기(at)에서만 더한다. 한 칸 = 모델 1m.
// 걸을 수 있는지는 가구점처럼 0.25칸 격자로 본다. 막힌 칸은 벽 밖과 막힌 사각형 그대로이고, 라룹이 반지름(0.32)만큼 떨어져야 설 수 있는지는
// 길 찾기(engine의 isFree, 몸 반지름 0.32 = playerRadiusMetres)가 본다.
// 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.

export interface ClothingPoint {
  x: number;
  z: number;
}

/** 옷집 층. */
export type ClothingFloor = 1 | 2;

type Rect = readonly number[];

/** 모델 좌표를 앱 좌표로 옮기는 거리(실내 벽 안쪽이 모두 양수가 되게). */
export const CLOTHING_OFFSET = { x: 9, z: 8 } as const;

/** 실내 바닥(칸)과 걸을 수 있는지 보는 격자 한 칸의 크기. 두 층이 같다. */
export const CLOTHING_SHOP = { width: 18, depth: 16, cell: 0.25 } as const;

/** 라룹이 반지름(배치 JSON 값. engine의 몸 반지름과 같은지는 테스트가 본다). */
export const CLOTHING_PLAYER_RADIUS: number = LAYOUT.playerRadiusMetres;

const at = (x: number, z: number): ClothingPoint => ({ x: x + CLOTHING_OFFSET.x, z: z + CLOTHING_OFFSET.z });

interface Anchor {
  node: string;
  positionXYZ: number[];
  rotationYDegrees: number;
}

type FloorKey = "1" | "2";
const floorOf = (floor: ClothingFloor) => LAYOUT.floors[String(floor) as FloorKey];

const anchor = (floor: ClothingFloor, key: string): Anchor => {
  const found = (floorOf(floor).anchors as Record<string, Anchor>)[key];
  if (!found) throw new Error(`clothing-shop-layout.json: floor ${floor} anchor ${key} missing`);
  return found;
};

/** 기준점 노드의 앱 자리와 보는 방향(0 = +z, 노드의 Y 회전 그대로). */
export interface ClothingSpot extends ClothingPoint {
  heading: number;
  node: string;
}

const spot = (floor: ClothingFloor, key: string): ClothingSpot => {
  const a = anchor(floor, key);
  return { ...at(a.positionXYZ[0], a.positionXYZ[2]), heading: (a.rotationYDegrees * Math.PI) / 180, node: a.node };
};

/** 층마다 들어서는 자리와 장소 기준점(앱 좌표). */
export const CLOTHING_NODES = {
  /** 마을에서 들어온 직후 1층 자리(F1_EntranceSpawn). */
  entranceSpawn: spot(1, "EntranceSpawn"),
  /** 출입문 안쪽 서는 자리(F1_ExitApproach)와 마을로 나가는 곳(F1_ExitTrigger). */
  exitApproach: spot(1, "ExitApproach"),
  exitTrigger: spot(1, "ExitTrigger"),
  /** 1층 계단 아래 서는 자리(F1_StairsUp)와 2층에서 내려와 서는 자리(F1_FromUpper). */
  stairsUp: spot(1, "StairsUp"),
  fromUpper: spot(1, "FromUpper"),
  /** 2층 계단 위 서는 자리(F2_StairsDown)와 1층에서 올라와 서는 자리(F2_FromLower). */
  stairsDown: spot(2, "StairsDown"),
  fromLower: spot(2, "FromLower")
} as const;

interface ClothingRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const rect = (r: Rect): ClothingRect => {
  const a = at(r[0], r[1]);
  const b = at(r[2], r[3]);
  return { x0: a.x, z0: a.z, x1: b.x, z1: b.z };
};

const inRect = (r: ClothingRect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

interface FloorGeometry {
  /** 벽 안쪽 상자(insideRectXZ. 이 밖은 걸을 수 없다). */
  inside: ClothingRect;
  /** 막힌 사각형(blockedRectsXZ). */
  blocks: readonly ClothingRect[];
}

const geometry = (floor: ClothingFloor): FloorGeometry => {
  const f = floorOf(floor);
  return {
    inside: rect(f.insideRectXZ),
    blocks: f.blockedRectsXZ.map((r) => rect(r))
  };
};

const GEOMETRY: Record<ClothingFloor, FloorGeometry> = { 1: geometry(1), 2: geometry(2) };

/** 그 층에서 그 자리가 걸을 수 없는 곳(벽 밖, 막힌 사각형)인지. 몸 둘레는 보지 않는다(길 찾기가 본다). */
export function clothingSolidAt(floor: ClothingFloor, x: number, z: number): boolean {
  const g = GEOMETRY[floor];
  if (!inRect(g.inside, x, z)) return true;
  return g.blocks.some((r) => inRect(r, x, z));
}

function buildSolidCells(floor: ClothingFloor): Set<string> {
  const solid = new Set<string>();
  const cols = Math.round(CLOTHING_SHOP.width / CLOTHING_SHOP.cell);
  const rows = Math.round(CLOTHING_SHOP.depth / CLOTHING_SHOP.cell);
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (clothingSolidAt(floor, (c + 0.5) * CLOTHING_SHOP.cell, (r + 0.5) * CLOTHING_SHOP.cell)) solid.add(`${c},${r}`);
    }
  }
  return solid;
}

/** 층마다 걸을 수 없는 격자 칸("열,행", 한 칸 = CLOTHING_SHOP.cell). 칸 가운데가 걸을 수 없는 곳이면 막힌다. 커튼이 모두 열린 때다. */
export const CLOTHING_SOLID_CELLS: Record<ClothingFloor, ReadonlySet<string>> = { 1: buildSolidCells(1), 2: buildSolidCells(2) };

// ---------- 피팅룸(층마다 하나, layout의 fittingRooms) ----------

interface FittingRoomData {
  approach: string;
  inside: string;
  curtain: string;
  closedMorph: { name: string };
  closedDoorwayBoundsXZ: number[];
}

export interface ClothingFittingRoom {
  /** 피팅룸 앞 서는 자리와 피팅룸 안 자리(앱 좌표·방향). */
  approach: ClothingSpot;
  inside: ClothingSpot;
  /** 커튼 노드와 닫힘 모프 이름(0이면 열림, 1이면 닫힘). */
  curtain: string;
  morph: string;
}

const fittingRoomOf = (floor: ClothingFloor): ClothingFittingRoom => {
  const room = (LAYOUT.fittingRooms as Record<string, FittingRoomData>)[String(floor)];
  const key = (node: string) => node.replace(/^F\d_/, "");
  return { approach: spot(floor, key(room.approach)), inside: spot(floor, key(room.inside)), curtain: room.curtain, morph: room.closedMorph.name };
};

/** 층마다 피팅룸. */
export const CLOTHING_FITTING_ROOMS: Record<ClothingFloor, ClothingFittingRoom> = { 1: fittingRoomOf(1), 2: fittingRoomOf(2) };

/** 커튼이 닫힌 동안 그 방 입구를 막는 사각형(closedDoorwayBoundsXZ)까지 막은 칸. */
function buildClosedCells(floor: ClothingFloor): Set<string> {
  const doorway = rect((LAYOUT.fittingRooms as Record<string, FittingRoomData>)[String(floor)].closedDoorwayBoundsXZ);
  const solid = new Set(CLOTHING_SOLID_CELLS[floor]);
  const cols = Math.round(CLOTHING_SHOP.width / CLOTHING_SHOP.cell);
  const rows = Math.round(CLOTHING_SHOP.depth / CLOTHING_SHOP.cell);
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (inRect(doorway, (c + 0.5) * CLOTHING_SHOP.cell, (r + 0.5) * CLOTHING_SHOP.cell)) solid.add(`${c},${r}`);
    }
  }
  return solid;
}

const CLOSED_CELLS: Record<ClothingFloor, ReadonlySet<string>> = { 1: buildClosedCells(1), 2: buildClosedCells(2) };

/** 커튼이 닫힌 피팅룸의 층(피팅 중). null이면 두 방 모두 열려 있다. */
let curtainClosedFloor: ClothingFloor | null = null;

/** 피팅룸 커튼을 닫거나(그 층) 연다(null). 닫힌 동안 그 방 입구가 걸을 수 없는 곳이 된다. */
export function setClothingCurtainClosed(floor: ClothingFloor | null): void {
  curtainClosedFloor = floor;
}

export function clothingCurtainClosed(): ClothingFloor | null {
  return curtainClosedFloor;
}

/** 지금 그 층의 걸을 수 없는 칸(커튼이 닫힌 방이면 입구까지 막는다). */
export function clothingSolidCells(floor: ClothingFloor): ReadonlySet<string> {
  return curtainClosedFloor === floor ? CLOSED_CELLS[floor] : CLOTHING_SOLID_CELLS[floor];
}

/** 실내 높이(카메라 끝 상자의 위). 층 높이(levelPitchMetres)와 같다. */
const WALL_HEIGHT: number = LAYOUT.levelPitchMetres;

const boundsOf = (floor: ClothingFloor) => {
  const [x0, z0, x1, z1] = floorOf(floor).insideRectXZ;
  const a = at(x0, z0);
  const b = at(x1, z1);
  return { minX: a.x, maxX: b.x, minY: 0, maxY: WALL_HEIGHT, minZ: a.z, maxZ: b.z };
};

/** 카메라가 넘지 않는 층마다 실내 끝 상자(벽 안쪽과 층 높이). */
export const CLOTHING_BOUNDS: Record<ClothingFloor, { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }> = {
  1: boundsOf(1),
  2: boundsOf(2)
};

/** 내려다보는 카메라에서 매장 앞쪽을 가려 숨기는 층마다 앞쪽 노드(cutawayFrontNodes). */
export const CLOTHING_HIDDEN_NODES: Record<ClothingFloor, readonly string[]> = {
  1: floorOf(1).cutawayFrontNodes,
  2: floorOf(2).cutawayFrontNodes
};

/** 층 모델의 뿌리 노드 이름. */
export const CLOTHING_FLOOR_ROOTS: Record<ClothingFloor, string> = { 1: floorOf(1).root, 2: floorOf(2).root };

// ---------- 장소 ----------

/** 옷집 장소: 1층 출입문·2층 계단·피팅룸, 2층 1층 계단·피팅룸. */
export type ClothingPlaceId = "clothingExit" | "clothingUp" | "clothingFitting1" | "clothingDown" | "clothingFitting2";

export const CLOTHING_PLACE_IDS: Record<ClothingFloor, readonly ClothingPlaceId[]> = {
  1: ["clothingExit", "clothingUp", "clothingFitting1"],
  2: ["clothingDown", "clothingFitting2"]
};

const ALL_PLACES: readonly ClothingPlaceId[] = ["clothingExit", "clothingUp", "clothingFitting1", "clothingDown", "clothingFitting2"];

/** 피팅룸 장소의 층(피팅룸이 아니면 null). */
export function clothingFittingFloorOf(id: string): ClothingFloor | null {
  if (id === "clothingFitting1") return 1;
  if (id === "clothingFitting2") return 2;
  return null;
}

export function isClothingPlaceId(id: string): id is ClothingPlaceId {
  return (ALL_PLACES as readonly string[]).includes(id);
}

/** 장소 이름표 자리(앱 좌표와 높이): 출입문은 문 위, 계단은 계단 입구 위. */
export const CLOTHING_LABEL_POINTS: Record<ClothingPlaceId, { x: number; y: number; z: number }> = {
  clothingExit: { x: CLOTHING_NODES.exitTrigger.x, y: 2.9, z: CLOTHING_NODES.exitTrigger.z - 0.4 },
  clothingUp: { x: CLOTHING_NODES.stairsUp.x, y: 2.4, z: CLOTHING_NODES.stairsUp.z - 0.6 },
  clothingDown: { x: CLOTHING_NODES.stairsDown.x, y: 2.4, z: CLOTHING_NODES.stairsDown.z + 0.6 },
  // 피팅룸 입구 위(표지 아래)
  clothingFitting1: { x: CLOTHING_FITTING_ROOMS[1].inside.x, y: 2.5, z: CLOTHING_FITTING_ROOMS[1].approach.z - 0.6 },
  clothingFitting2: { x: CLOTHING_FITTING_ROOMS[2].inside.x, y: 2.5, z: CLOTHING_FITTING_ROOMS[2].approach.z - 0.6 }
};
