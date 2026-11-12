import LAYOUT from "./village-layout.json";

// 바깥 마을의 데이터: 크기, 걸어갈 수 없는 칸, 장소(건물 문 앞), 라룹이가 나타나는 자리, 라룹이를 가리는 건물.
// 배치는 village-layout.json 하나에서 읽는다(마을 모델을 만드는 scripts/lobby3d/build-village.py도 같은 파일을 읽는다).
// 좌표는 방과 같은 칸 단위(x 왼쪽→오른쪽, z 뒤→앞, 앞이 카메라 쪽). 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.

export type VillageBuildingId = "home" | "furnitureShop" | "cafe" | "library";

export interface VillagePoint {
  x: number;
  z: number;
}

export interface VillageBuilding {
  id: VillageBuildingId;
  label: string;
  /** 땅 [x0, z0, x1, z1] (x1·z1은 들지 않음). */
  rect: readonly [number, number, number, number];
  floors: number;
  /** 문 가운데 x. 문은 모두 앞(카메라 쪽, z1)을 본다. */
  doorX: number;
  /** 지붕 꼭대기까지의 높이(칸). 라룹이를 가리는지 볼 때 쓴다. */
  height: number;
}

/** Kenney 한 칸 = 3칸. 한 층 높이도 3칸이다. */
const STORY = 3;
/** 지붕 높이(칸). 박공 지붕 부품 높이(0.57~0.63)에 3을 곱한 값보다 조금 넉넉하다. */
const ROOF_HEIGHT = 2;

export const VILLAGE = {
  width: LAYOUT.width,
  depth: LAYOUT.depth
} as const;

export const VILLAGE_BUILDINGS: readonly VillageBuilding[] = LAYOUT.buildings.map((b) => ({
  id: b.id as VillageBuildingId,
  label: b.label,
  rect: b.rect as unknown as readonly [number, number, number, number],
  floors: b.floors,
  doorX: b.door,
  height: b.floors * STORY + ROOF_HEIGHT
}));

const key = (c: number, r: number) => `${c},${r}`;

/** 마을 안 나무 자리(가운데 x·z). 그리기(lobby3d-village)가 이 자리에 나무를 짓는다. */
export const VILLAGE_TREES: readonly (readonly [number, number])[] = LAYOUT.trees as unknown as [number, number][];

/** 원(가운데 cx·cz, 반지름 r)과 겹치는 칸들. */
function circleTiles(cx: number, cz: number, r: number): string[] {
  const out: string[] = [];
  for (let c = Math.floor(cx - r); c <= Math.floor(cx + r); c += 1) {
    for (let row = Math.floor(cz - r); row <= Math.floor(cz + r); row += 1) {
      // 칸 안에서 원 가운데에 가장 가까운 점이 원 안이면 겹친다
      const nx = Math.min(Math.max(cx, c), c + 1);
      const nz = Math.min(Math.max(cz, row), row + 1);
      if (Math.hypot(nx - cx, nz - cz) < r) out.push(key(c, row));
    }
  }
  return out;
}

/** 사각형(x0..x1, z0..z1, 끝 포함하지 않음)의 칸들. */
function rectTiles(x0: number, z0: number, x1: number, z1: number): string[] {
  const out: string[] = [];
  for (let c = Math.floor(x0); c < Math.ceil(x1); c += 1) for (let r = Math.floor(z0); r < Math.ceil(z1); r += 1) out.push(key(c, r));
  return out;
}

/** 물건 하나가 차지하는 칸(가운데 x·z, 가로·깊이 크기). */
function propTiles(x: number, z: number, w: number, d: number): string[] {
  return rectTiles(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
}

function buildSolidTiles(): Set<string> {
  const solid = new Set<string>();
  const add = (tiles: string[]) => tiles.forEach((t) => solid.add(t));
  // 가장자리 한 줄: 생울타리
  for (let c = 0; c < LAYOUT.width; c += 1) add([key(c, 0), key(c, LAYOUT.depth - 1)]);
  for (let r = 0; r < LAYOUT.depth; r += 1) add([key(0, r), key(LAYOUT.width - 1, r)]);
  for (const b of VILLAGE_BUILDINGS) add(rectTiles(...b.rect));
  add(circleTiles(LAYOUT.fountain.x, LAYOUT.fountain.z, LAYOUT.fountain.radius));
  for (const [x, z] of LAYOUT.lanterns) add(propTiles(x, z, 0.6, 0.6));
  // 노점(Kenney 한 칸을 2배로 놓았다: 2×2칸), 벤치(약 0.6×2.2칸, 돌려 놓으면 가로세로가 바뀐다)
  for (const s of LAYOUT.stalls) add(propTiles(s.x, s.z, 2, 2));
  for (const b of LAYOUT.benches) add(Math.abs(b.rot) === 90 ? propTiles(b.x, b.z, 0.6, 2.2) : propTiles(b.x, b.z, 2.2, 0.6));
  for (const [x, z] of LAYOUT.trees) add(propTiles(x, z, 0.8, 0.8));
  for (const [x, z] of LAYOUT.rocks) add(propTiles(x, z, 1.8, 1.8));
  return solid;
}

/** 걸어갈 수 없는 칸("열,행"): 가장자리 생울타리, 건물, 분수, 가로등, 노점, 벤치, 나무, 바위. */
export const VILLAGE_SOLID_TILES: ReadonlySet<string> = buildSolidTiles();

export interface VillagePlace {
  id: VillageBuildingId;
  label: string;
  /** 바라볼 지점: 문 가운데. */
  faceTo: VillagePoint;
  /** 서는 자리: 문 바로 앞. */
  approach: VillagePoint[];
  /** 이름표 자리(문 위). */
  labelPoint: { x: number; y: number; z: number };
}

/** 장소 넷: 건물마다 문 앞. */
export const VILLAGE_PLACES: Record<VillageBuildingId, VillagePlace> = Object.fromEntries(
  VILLAGE_BUILDINGS.map((b) => {
    const front = b.rect[3];
    return [
      b.id,
      {
        id: b.id,
        label: b.label,
        faceTo: { x: b.doorX, z: front },
        approach: [{ x: b.doorX, z: front + 0.9 }],
        labelPoint: { x: b.doorX, y: STORY * 0.92, z: front + 0.2 }
      }
    ];
  })
) as Record<VillageBuildingId, VillagePlace>;

/** 라룹이가 마을에 나타나는 자리(라룹이 집 문 앞)와 방향(0 = 카메라 쪽). */
export const VILLAGE_START = { ...VILLAGE_PLACES.home.approach[0], heading: 0 } as const;

/** 카메라를 내려다보는 기울기(도). 로비와 같다(engine의 ROOM.pitchDeg). */
const PITCH_DEG = 42;
/** 라룹이 몸 둘레(칸). 몸이 조금이라도 건물 뒤에 들어가면 가리는 것으로 본다. */
const CHARACTER_HALF_WIDTH = 0.45;

/**
 * 카메라와 라룹이 사이에 있어 라룹이를 가리는 건물들. 카메라는 옆으로 돌지 않고 앞(+z)에서 기울기만큼 내려다보므로,
 * 라룹이가 건물 앞면보다 뒤에 있고(가로로 건물 폭 안), 라룹이 발에서 카메라 쪽으로 올라가는 시선이 건물 뒷면에서
 * 건물 높이보다 낮으면(발부터 가려지기 시작하면) 가린다.
 */
export function occludingBuildings(point: VillagePoint, pitchDeg = PITCH_DEG): VillageBuildingId[] {
  const tan = Math.tan((pitchDeg * Math.PI) / 180);
  return VILLAGE_BUILDINGS.filter((b) => {
    const [x0, z0, x1, z1] = b.rect;
    if (point.x + CHARACTER_HALF_WIDTH < x0 || point.x - CHARACTER_HALF_WIDTH > x1) return false;
    if (point.z >= z1) return false;
    // 라룹이 발에서 카메라 쪽으로 가는 시선이 건물 뒷면(z0)에 닿는 높이가 건물 높이보다 낮으면 가린다.
    // 지붕 꼭대기는 건물 가운데쯤이지만 뒷면에 지붕 높이를 두고 넉넉하게 본다(조금 일찍 옅어지는 편이 가려진 채 있는 것보다 낫다)
    return Math.max(0, z0 - point.z) * tan < b.height;
  }).map((b) => b.id);
}
