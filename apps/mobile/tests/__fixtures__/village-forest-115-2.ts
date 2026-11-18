// qa 테스트 도우미(작업 115 ② 숲과 땅 꾸밈, 기능 변경, 모바일): 마을 경계 원과 둘레 숲·흩뿌림·장식·풀밭 무늬 자리 지도를 견주는 값과 계산.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-forest.spec.test.ts(.tsx)와,
// 115 ② 명세의 "고칠 기존 테스트"로 고친 테스트가 함께 쓴다.
// 기대값은 명세(private 작업 폴더 115-2026-11-18-마을-동그란-숲-경계/03-숲과-땅-꾸밈/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 값은 기준 커밋 be29bd1의 지금 동작에서 잰 값이다.
// 명세에 수가 없어 qa가 정한 값(02-qa-tests.md "가정"):
// - "숲 가장자리 반지름 대략 반지름 + 0 ~ + 2칸" + "약 2칸 간격": 각도 15도 부채꼴마다 가장 가까운 숲 그루가 원 가운데에서 26 넘고 30 이하(가장자리 28 + 한 간격 2).
// - "약 2칸 간격": 카메라가 보여 줄 수 있는 땅 가운데 원 가운데에서 29칸 넘는 곳의 넓이를 그곳에 선 숲 그루 수로 나눈 값의 제곱근이 1.6~2.4칸.
// - "어디서 보아도 숲 너머가 빈 땅으로 보이지 않을 만큼": 카메라가 보여 줄 수 있는 땅 가운데 원 가운데에서 28.5칸 넘는 곳의 모든 점(0.5칸 격자)에서
//   가장 가까운 숲 그루 밑동까지 3칸 이하.
// - "카메라가 보여 줄 수 있는 땅": 마을 카메라(engine.ts cameraPose, 마을 구역)를 걸을 수 있는 칸 가운데마다 따라가게 두고,
//   마을 카메라 테스트(lobby3d-village-camera.spec.test.ts)의 폰 화면 셋과 보는 거리 여섯(가장 가까이·기본값·가장 멀리·사이 셋)으로 본 화면 네 모서리가
//   바닥에 닿는 사각형(사다리꼴)들을 합친 곳. 0.5칸 격자 칸 가운데로 잰다.
// - "원 안" = 자리(x, z)가 원 가운데까지 26 이하. "원 밖" = 26 넘음.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { VIEW_WIDTH_DEFAULT, VIEW_WIDTH_MAX, VIEW_WIDTH_MIN, applyArea, cameraPose, isFree } from "@/lib/lobby3d/engine";
import { VILLAGE } from "@/lib/lobby3d/village";

export const REPO_115_2 = join(__dirname, "..", "..", "..", "..");
/** 작업 115 ②의 기준 커밋(명세 첫 줄). */
export const BASE_115_2 = "be29bd1";
export const CREDITS_PATH_115_2 = "apps/mobile/assets/models/CREDITS.md";

export const gitShow115b = (commit: string, path: string): string => execFileSync("git", ["show", `${commit}:${path}`], { cwd: REPO_115_2, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
export const sha256b = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");

// ---------- 명세의 값 ----------

/** 마을 경계 원(① 그대로). */
export const CIRCLE_115_2 = { x: 29, z: 26, radius: 26 } as const;
/** 명세 1: 숲 안쪽 가장자리 반지름은 대략 반지름 + 0 ~ + 2칸. */
export const EDGE_MAX_115_2 = CIRCLE_115_2.radius + 2;
/** 명세 1: 그루 사이 약 2칸. */
export const SPACING_115_2 = 2;

export const centerDistance115b = (x: number, z: number): number => Math.hypot(x - CIRCLE_115_2.x, z - CIRCLE_115_2.z);
export const insideCircle115b = (x: number, z: number): boolean => centerDistance115b(x, z) <= CIRCLE_115_2.radius;

// ---------- 카메라가 보여 줄 수 있는 땅 ----------

const SCREENS: [number, number][] = [
  [360, 640],
  [390, 844],
  [412, 915]
];

function viewWidths(): number[] {
  const list = [VIEW_WIDTH_MIN, VIEW_WIDTH_DEFAULT, VIEW_WIDTH_MAX];
  for (const k of [0.25, 0.5, 0.75]) list.push(VIEW_WIDTH_MIN + (VIEW_WIDTH_MAX - VIEW_WIDTH_MIN) * k);
  return list;
}

type V3 = { x: number; y: number; z: number };
type Pose = { position: V3; lookAt: V3; fovDeg: number };

/** 화면 네 모서리((-1,-1), (1,-1), (1,1), (-1,1))에서 쏜 선이 바닥에 닿는 점. 하나라도 닿지 않으면 null. */
function groundQuad(p: Pose, aspect: number): { x: number; z: number }[] | null {
  const f0 = { x: p.lookAt.x - p.position.x, y: p.lookAt.y - p.position.y, z: p.lookAt.z - p.position.z };
  const fl = Math.hypot(f0.x, f0.y, f0.z);
  const f = { x: f0.x / fl, y: f0.y / fl, z: f0.z / fl };
  // 오른쪽 = f × 위(0,1,0), 위 = 오른쪽 × f
  const r0 = { x: -f.z, y: 0, z: f.x };
  const rl = Math.hypot(r0.x, r0.z);
  const r = { x: r0.x / rl, y: 0, z: r0.z / rl };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const tanV = Math.tan((p.fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  const out: { x: number; z: number }[] = [];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ]) {
    const d = { x: f.x + r.x * sx * tanH + u.x * sy * tanV, y: f.y + r.y * sx * tanH + u.y * sy * tanV, z: f.z + r.z * sx * tanH + u.z * sy * tanV };
    if (d.y >= 0) return null;
    const t = -p.position.y / d.y;
    out.push({ x: p.position.x + d.x * t, z: p.position.z + d.z * t });
  }
  return out;
}

/** 볼록 사각형(차례대로 네 점) 안인가. */
function inQuad(q: { x: number; z: number }[], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(c) < 1e-12) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** 격자 칸 크기(칸). */
export const VIEW_CELL_115_2 = 0.5;
let visibleCache: { x: number; z: number }[] | null = null;

/** 카메라가 보여 줄 수 있는 땅의 0.5칸 격자 칸 가운데들(머리말의 정의). */
export function visibleGround115b(): { x: number; z: number }[] {
  if (visibleCache) return visibleCache;
  const quads = new Map<string, { x: number; z: number }[]>();
  applyArea("village");
  try {
    for (let c = 0; c < VILLAGE.width; c += 1) {
      for (let row = 0; row < VILLAGE.depth; row += 1) {
        const follow = { x: c + 0.5, z: row + 0.5 };
        if (!isFree(follow.x, follow.z)) continue;
        for (const [w, h] of SCREENS) {
          for (const width of viewWidths()) {
            const p = cameraPose(follow, width, w / h) as Pose;
            const key = `${w}x${h} ${width} ${p.lookAt.x.toFixed(3)} ${p.lookAt.z.toFixed(3)}`;
            if (quads.has(key)) continue;
            const q = groundQuad(p, w / h);
            if (q) quads.set(key, q);
          }
        }
      }
    }
  } finally {
    applyArea("room");
  }
  const seen = new Set<string>();
  const out: { x: number; z: number }[] = [];
  for (const q of quads.values()) {
    const x0 = Math.floor(Math.min(...q.map((p) => p.x)) / VIEW_CELL_115_2);
    const x1 = Math.ceil(Math.max(...q.map((p) => p.x)) / VIEW_CELL_115_2);
    const z0 = Math.floor(Math.min(...q.map((p) => p.z)) / VIEW_CELL_115_2);
    const z1 = Math.ceil(Math.max(...q.map((p) => p.z)) / VIEW_CELL_115_2);
    for (let i = x0; i <= x1; i += 1) {
      for (let j = z0; j <= z1; j += 1) {
        const key = `${i},${j}`;
        if (seen.has(key)) continue;
        const x = (i + 0.5) * VIEW_CELL_115_2;
        const z = (j + 0.5) * VIEW_CELL_115_2;
        if (!inQuad(q, x, z)) continue;
        seen.add(key);
        out.push({ x, z });
      }
    }
  }
  visibleCache = out;
  return out;
}

/** 점에서 가장 가까운 점까지의 거리(칸별 색인). */
export function nearestFinder(points: readonly { x: number; z: number }[], cell = 2): (x: number, z: number, reach: number) => number {
  const grid = new Map<string, { x: number; z: number }[]>();
  for (const p of points) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const list = grid.get(k) ?? [];
    list.push(p);
    grid.set(k, list);
  }
  return (x, z, reach) => {
    const n = Math.ceil(reach / cell);
    const ci = Math.floor(x / cell);
    const cj = Math.floor(z / cell);
    let best = Infinity;
    for (let i = ci - n; i <= ci + n; i += 1) {
      for (let j = cj - n; j <= cj + n; j += 1) {
        for (const p of grid.get(`${i},${j}`) ?? []) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
      }
    }
    return best;
  };
}

// ---------- 흩뿌림·장식(원 안은 그대로) ----------

export type ScatterLike = { kind: number; x: number; z: number; turn: number; size: number; shade: number };
export type DecorLike = { kind: string; x: number; z: number; turn: number; scale: number };

/** 흩뿌림 조각 목록의 개수와, 조각마다 "kind,x,z,turn,size,shade"(수는 JS 기본 글자) 줄을 정렬해 줄바꿈으로 이은 글의 sha256(차례는 보지 않는다). */
export const scatterDigest115b = (pieces: readonly ScatterLike[]): { count: number; sha256: string } => ({
  count: pieces.length,
  sha256: sha256b(pieces.map((p) => [p.kind, p.x, p.z, p.turn, p.size, p.shade].join(",")).sort().join("\n"))
});
/** 장식 목록의 개수와, 장식마다 "kind,x,z,turn,scale" 줄을 정렬해 줄바꿈으로 이은 글의 sha256. */
export const decorDigest115b = (spots: readonly DecorLike[]): { count: number; sha256: string } => ({
  count: spots.length,
  sha256: sha256b(spots.map((p) => [p.kind, p.x, p.z, p.turn, p.scale].join(",")).sort().join("\n"))
});

/** 기준 커밋 be29bd1에서 잰 값: 계절마다 흩뿌림 조각 가운데 원 안(가운데까지 26 이하)의 것. */
export const SCATTER_INSIDE_115_2: Record<"autumn" | "spring" | "summer", { count: number; sha256: string }> = {
  autumn: { count: 915, sha256: "981ea556b157854fd5a22115b44ef87ec44e85e83692245a8a79679dc1643cd9" },
  spring: { count: 550, sha256: "6b75296fec052157df1533f57d547333fe99dc649bb5fb44efd60b7576a80b2d" },
  summer: { count: 288, sha256: "35c4d049f669d705c98840b18ca75bce433d555923a6077dbcaac932d7162249" }
};
/** 기준 커밋 be29bd1에서 잰 값: 장식 전부(127개, 모두 원 안이다. 원 가운데에서 가장 먼 것이 25.35). */
export const DECOR_115_2 = { count: 127, sha256: "69594c4c8b43d1c7449ca8e75d5e4cb859e5c39c72516d7f7dec3411e485fae5" };

// ---------- 풀밭 무늬 자리 지도(맨땅·마을 나무 둘레 이끼는 그대로) ----------

export type PlaceMapLike = { x0: number; z0: number; x1: number; z1: number; width: number; height: number; data: Uint8Array };

/** 지도 범위·픽셀 수. 기준 커밋 be29bd1의 값(명세가 바꾸지 않는다). */
export const PLACE_MAP_EXTENT_115_2 = { x0: -28, z0: -28, x1: 98, z1: 88, width: 252, height: 232 };
/** 이끼 그대로 볼 곳: 픽셀 가운데가 원 가운데에서 20칸 안(원 경계에서 6칸 넘게 안쪽. 옛 사각형 끝에서도 6칸 넘게 떨어진다). */
export const MOSS_KEEP_RADIUS_115_2 = 20;

/** 맨땅 몫(R) 전체의 sha256과, 원 가운데에서 20칸 안 픽셀의 이끼 몫(G, 픽셀 차례)의 개수·sha256. */
export function placeMapKeepDigest115b(map: PlaceMapLike): { bare: string; mossCount: number; moss: string } {
  const bare = Buffer.alloc(map.width * map.height);
  const moss: number[] = [];
  for (let j = 0; j < map.height; j += 1) {
    const z = map.z0 + ((j + 0.5) * (map.z1 - map.z0)) / map.height;
    for (let i = 0; i < map.width; i += 1) {
      const x = map.x0 + ((i + 0.5) * (map.x1 - map.x0)) / map.width;
      const k = (j * map.width + i) * 4;
      bare[j * map.width + i] = map.data[k];
      if (centerDistance115b(x, z) <= MOSS_KEEP_RADIUS_115_2) moss.push(map.data[k + 1]);
    }
  }
  return { bare: sha256b(bare), mossCount: moss.length, moss: sha256b(Buffer.from(moss)) };
}
/** 기준 커밋 be29bd1에서 잰 값. */
export const PLACE_MAP_KEEP_115_2 = { bare: "e4585d45f34f9405fb417d40d44d496f05fd805d3f9723b7d7954b46a3e0b185", mossCount: 5024, moss: "69e100853edaab7dd67e7203f2a9a237dcffaa2beaab8967a5ba3218e6f7d1b5" };
