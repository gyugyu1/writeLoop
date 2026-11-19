// qa 테스트 도우미(작업 127 마을 노점 없애기, 기능 변경, 모바일). 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다).
// 기준 커밋 e17b97c의 마을에는 Kenney 노점 둘이 있었고, 127이 이를 없앤다(명세 1·2·2-1). 기존 테스트가 "기준 커밋과 같다"를 볼 때
// 양쪽에서 노점을 빼고 견주도록 돕는다(114·115·118·120이 벤치·바위·분수·가로등을 뺀 것과 같은 방식).
// 값은 기준 커밋에서 쟀다: 노점 둘은 배치 파일의 stalls(x 27.5·z 29.5 초록, x 43.5·z 29.5 빨강)이고, 마을 모델 소품 묶음(props)에서
// 점 셋이 모두 각 가운데에서 가로·깊이 1칸 안(노점은 2×2칸)인 삼각형이 초록 322개, 빨강 270개다(1.0~4칸으로 넓혀도 같다. 다른 소품이 안 든다).
import { rectTiles, type Rect } from "./village-shops-106";

export const BASE_127 = "e17b97c";
/** 노점 둘의 가운데(x, z). */
export const STALLS_127: readonly (readonly [number, number])[] = [
  [27.5, 29.5],
  [43.5, 29.5]
];
/** 기준 커밋 모델의 소품 묶음에서 노점 삼각형 수: 초록 322 + 빨강 270. */
export const STALL_TRIANGLES_127 = 592;

/** 노점이 막던 칸(village.ts의 옛 규칙: 가운데에서 2×2칸 사각형이 걸치는 칸). */
export const stallRects127 = (): Rect[] => STALLS_127.map(([x, z]) => [x - 1, z - 1, x + 1, z + 1] as const);
let tilesCache: Set<string> | null = null;
export function stallTiles127(): Set<string> {
  if (!tilesCache) tilesCache = rectTiles(stallRects127());
  return tilesCache;
}

/** 노점 둘레: 가운데에서 가로·깊이 1.2칸 안(노점 2×2칸에 여유 0.2). 높이는 땅 아래 −0.01부터. */
export function inStallArea127([x, y, z]: readonly number[]): boolean {
  return y >= -0.01 && STALLS_127.some(([sx, sz]) => Math.abs(x - sx) <= 1.2 && Math.abs(z - sz) <= 1.2);
}
