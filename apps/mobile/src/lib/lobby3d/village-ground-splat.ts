// 마을 풀밭 바탕에 섞을 맨땅·이끼 자리 지도. 셰이더가 이 지도(R = 맨땅 몫, G = 이끼 몫)와 잡음 그림으로 무늬 다섯(짧은 풀·무성한 풀·클로버·이끼·맨땅)을 섞는다.
// 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다. 좌표는 마을 칸 단위(x 왼쪽→오른쪽, z 뒤→앞). 늘 같은 결과다.
// - 맨땅: 둥근 길 경계 둘레(밖으로 약 1.2칸)와 건물 문 앞(약 2.4칸 안)에 바래며 섞인다(많이 다니는 곳). 경계가 딱 끊기지 않게 1칸에 0.5보다 빨리 바뀌지 않는다.
// - 이끼: 마을 나무 둘레와 마을 경계 원(숲 가장자리) 둘레에 바래며 섞인다.
import { VILLAGE, VILLAGE_BOUNDARY, VILLAGE_PLACES, VILLAGE_TREES } from "./village";
import { villagePathIndex } from "./village-decor";

export interface VillageGroundPlaceMap {
  /** 지도가 덮는 땅(마을 칸 좌표). 풀밭 판 전체(마을 밖 둘레 포함)를 덮는다. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** 픽셀 수. */
  width: number;
  height: number;
  /** RGBA 8비트(R = 맨땅 몫, G = 이끼 몫, B = 0, A = 255). 픽셀 (i, j)는 (j × width + i) × 4. */
  data: Uint8Array;
}

/** 풀밭 판이 덮는 땅(lobby3d-village의 풀밭 판: 마을 둘레로 숲 너비 9칸 × 3씩)보다 조금 넓게. */
const MARGIN = 28;
/** 한 칸에 픽셀 몇 개. */
const PIXELS_PER_CELL = 2;
/** 맨땅 몫: 길 경계에서의 몫과 1칸에 줄어드는 양(길 안쪽으로는 늘어 1까지), 문 앞 둘레 반지름(칸)과 1칸에 줄어드는 양. */
const BARE_AT_PATH_EDGE = 0.6;
const BARE_SLOPE = 0.5;
const BARE_DOOR_RADIUS = 2.4;
/** 이끼: 나무 가운데에서 바래는 거리, 경계 원(숲 가장자리)에서 바래는 거리(칸). */
const MOSS_TREE_RADIUS = 2.2;
const MOSS_TREE_FADE = 2;
const MOSS_EDGE_RADIUS = 3;
const MOSS_EDGE_FADE = 2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

let cache: VillageGroundPlaceMap | null = null;

/** 섞을 자리 지도. 처음 부를 때 계산해 두고, 부를 때마다 복사본을 준다. */
export function villageGroundPlaceMap(): VillageGroundPlaceMap {
  if (!cache) cache = build();
  return { ...cache, data: new Uint8Array(cache.data) };
}

function build(): VillageGroundPlaceMap {
  const x0 = -MARGIN;
  const z0 = -MARGIN;
  const x1 = VILLAGE.width + MARGIN;
  const z1 = VILLAGE.depth + MARGIN;
  const width = (x1 - x0) * PIXELS_PER_CELL;
  const height = (z1 - z0) * PIXELS_PER_CELL;
  const data = new Uint8Array(width * height * 4);
  const paths = villagePathIndex();
  const doors = Object.values(VILLAGE_PLACES).map((p) => p.faceTo);
  for (let j = 0; j < height; j += 1) {
    const z = z0 + (j + 0.5) / PIXELS_PER_CELL;
    for (let i = 0; i < width; i += 1) {
      const x = x0 + (i + 0.5) / PIXELS_PER_CELL;
      // 맨땅: 길 경계까지의 부호 있는 거리(길 안은 음수)로 정한다. 경계에서 BARE_AT_PATH_EDGE, 밖으로 멀어질수록 바래고 안으로는 1까지 는다. 문 앞 둘레도 더한다
      const inPath = paths.inside(x, z);
      const edgeDist = paths.distance(x, z);
      const signed = inPath ? -edgeDist : edgeDist;
      let bare = Number.isFinite(signed) ? clamp01(BARE_AT_PATH_EDGE - signed * BARE_SLOPE) : inPath ? 1 : 0;
      for (const d of doors) bare = Math.max(bare, clamp01((BARE_DOOR_RADIUS - Math.hypot(x - d.x, z - d.z)) * BARE_SLOPE));
      // 이끼: 마을 나무 둘레와 마을 경계 원(숲 가장자리) 둘레
      let moss = 0;
      for (const [tx, tz] of VILLAGE_TREES) {
        if (Math.abs(tx - x) > MOSS_TREE_RADIUS || Math.abs(tz - z) > MOSS_TREE_RADIUS) continue;
        moss = Math.max(moss, clamp01((MOSS_TREE_RADIUS - Math.hypot(x - tx, z - tz)) / MOSS_TREE_FADE));
      }
      const edge = Math.abs(VILLAGE_BOUNDARY.radius - Math.hypot(x - VILLAGE_BOUNDARY.x, z - VILLAGE_BOUNDARY.z));
      moss = Math.max(moss, clamp01((MOSS_EDGE_RADIUS - edge) / MOSS_EDGE_FADE));
      // 두 몫의 합이 1을 넘지 않게 이끼를 줄인다(맨땅이 먼저)
      moss = Math.min(moss, 1 - bare);
      const k = (j * width + i) * 4;
      data[k] = Math.round(bare * 255);
      data[k + 1] = Math.round(moss * 255);
      data[k + 2] = 0;
      data[k + 3] = 255;
    }
  }
  return { x0, z0, x1, z1, width, height, data };
}
