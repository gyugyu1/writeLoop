/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 115 ① 경계와 마을 모델, 기능 변경, 모바일): 마을 경계를 사각형 대신 원(가운데 (29, 26), 반지름 26)으로 둔다.
// 배치 파일·막힌 칸·카메라 범위·마을 모델에서 본 것. 그리기(둘레 숲·마을 나무·풍차 묶음)는 lobby3d-village-boundary.spec.test.tsx가 본다.
// 기대값은 명세(private 작업 폴더 115-2026-11-18-마을-동그란-숲-경계/02-경계와-마을-모델/01-main-spec.md)와 부모 명세에서만 가져온다.
// 그대로 둘 동작은 기준 커밋 de49aef의 지금 값이다. 구현 코드는 부르는 방법(village.ts의 VILLAGE_SOLID_TILES·VILLAGE_TREES 등 내보내기,
// engine.ts의 VILLAGE_BOUNDS·applyArea·cameraPose·isFree, village-layout.json, lobby-village.glb의 묶음 이름)을 알려고만 읽었다.
// 도우미·값은 tests/__fixtures__/village-boundary-115.ts.
//
// 바뀔 동작(구현 전 실패): B1~B9. 그대로 둘 동작(구현 전·뒤 통과): K1~K4.
// 가정(02-qa-tests.md "가정"):
// - B1: 명세는 경계 원의 열쇠 이름을 정하지 않았다. 배치 파일 윗단계 값 가운데, village.ts 내보내기 가운데 원 하나(가운데 x·z와 반지름)를 나타내는 값을
//   모양으로 찾는다: { x, z, radius|r } 또는 { cx, cz, radius|r } 또는 { center: [x, z] | { x, z }, radius|r }.
// - B3: "원 밖 칸"은 길찾기 칸 범위(x 0~69, z 0~59) 안의 칸으로 본다(명세 2의 칸 가운데 거리 > 반지름).
// - B7: 빠지는 바위의 마을 모델 조각은 바위 가운데에서 가로·깊이 1.5칸 안의 삼각형으로 본다(지금 바위 하나는 1.11칸 안의 삼각형 200개).
// - B8: 카메라 범위 상자의 화면 아래 바닥은 "화면 아래 모서리 둘과 아래 가운데가 바닥에 닿는 점"으로 본다(카메라 테스트 C3과 같은 방법).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VIEW_WIDTH_DEFAULT, VIEW_WIDTH_MAX, VIEW_WIDTH_MIN, VILLAGE_BOUNDS, applyArea, cameraPose, isFree, type FloorPoint } from "@/lib/lobby3d/engine";
import * as villageModule from "@/lib/lobby3d/village";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_TREES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { REPO, parseGlb, type Glb } from "../__fixtures__/village-glb-098";
import { describeGroups, gitShow, rectTiles } from "../__fixtures__/village-shops-106";
import { NEW_TREES_117, trunkRect117 } from "../__fixtures__/village-trees-117";
import {
  BASE_115,
  CIRCLE_115,
  REMOVED_GROUPS_115,
  ROCKS_KEPT_115,
  SOLID_KEEP_115,
  TREES_KEPT_115,
  VILLAGE_BOUNDS_115,
  VILLAGE_GLB_PATH_115,
  VILLAGE_SIZE_115,
  baseLayout115,
  centerDistance115,
  digest115,
  edgeTile115,
  propsTrianglesAround115,
  removedFootprint115,
  removedRocks115,
  rootNamesKept115,
  solidKeep115,
  tileOutside115,
  withoutBoundary115,
  withoutBoundaryGlb115
} from "../__fixtures__/village-boundary-115";
import { withoutFountainAndLanternsGlb120 } from "../__fixtures__/village-streetlamp-120";

type Circle = { x: number; z: number; radius: number };

/** 원 하나를 나타내는 값이면 { x, z, radius }(머리말 가정 B1). */
function asCircle(value: unknown): Circle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const radius = typeof v.radius === "number" ? v.radius : typeof v.r === "number" ? v.r : null;
  if (radius === null) return null;
  if (typeof v.x === "number" && typeof v.z === "number") return { x: v.x, z: v.z, radius };
  if (typeof v.cx === "number" && typeof v.cz === "number") return { x: v.cx, z: v.cz, radius };
  const c = v.center;
  if (Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === "number")) return { x: c[0] as number, z: c[1] as number, radius };
  if (c && typeof c === "object" && typeof (c as Record<string, unknown>).x === "number" && typeof (c as Record<string, unknown>).z === "number") {
    return { x: (c as { x: number }).x, z: (c as { z: number }).z, radius };
  }
  return null;
}

/** 값들 가운데 명세의 원(가운데 (29, 26), 반지름 26)인 것의 이름. */
function circleEntries(values: Record<string, unknown>): string[] {
  return Object.entries(values)
    .filter(([, v]) => {
      const c = asCircle(v);
      return c !== null && c.x === CIRCLE_115.x && c.z === CIRCLE_115.z && c.radius === CIRCLE_115.radius;
    })
    .map(([k]) => k);
}

/** 마을 모델의 모든 노드 이름. */
const nodeNames = (glb: Glb): string[] => glb.json.nodes.map((n) => n.name ?? "");

const sortPairs = (list: readonly (readonly number[])[]) => list.map(([x, z]) => `${x},${z}`).sort();

/** 마을 칸(x 0~69, z 0~59)의 모든 칸 "열,행". */
function allTiles(): string[] {
  const out: string[] = [];
  for (let c = 0; c < VILLAGE_SIZE_115.width; c += 1) for (let r = 0; r < VILLAGE_SIZE_115.depth; r += 1) out.push(`${c},${r}`);
  return out;
}

describe("[spec] 115 ① 바뀔 동작: 경계 원, 막힌 칸, 빠지는 나무·바위·풍차, 카메라 범위, 마을 모델", () => {
  it("B1 배치 파일(명세 1): 윗단계에 경계 원(가운데 (29, 26), 반지름 26)이 하나 있고, village.ts가 같은 원을 내보낸다", () => {
    const inLayout = circleEntries(LAYOUT as unknown as Record<string, unknown>);
    const exported = circleEntries(villageModule as unknown as Record<string, unknown>);
    expect({ inLayout: inLayout.length, exported: exported.length > 0 }).toEqual({ inLayout: 1, exported: true });
  });

  it("B2 막힌 칸(명세 2): 칸 가운데가 원 밖(가운데까지 거리 > 26)인 칸은 모두 막힌다", () => {
    const outside = allTiles().filter(tileOutside115);
    expect(outside.length).toBe(2072);
    const open = outside.filter((t) => !VILLAGE_SOLID_TILES.has(t));
    expect({ open: open.length, examples: open.slice(0, 10) }).toEqual({ open: 0, examples: [] });
  });

  it("B3 막힌 칸(명세 2): 사각형 가장자리 줄을 막던 규칙이 없다. 원 안의 가장자리 줄 칸(z 0 줄의 x 24~33)과, 빠지는 나무·바위가 막던 원 안 칸은 막히지 않는다", () => {
    const insideEdge = allTiles().filter((t) => !tileOutside115(t) && edgeTile115(t));
    expect(insideEdge).toEqual(["24,0", "25,0", "26,0", "27,0", "28,0", "29,0", "30,0", "31,0", "32,0", "33,0"]);
    const insideRemoved = [...removedFootprint115()].filter((t) => !tileOutside115(t)).sort();
    expect(insideRemoved.length).toBeGreaterThan(0);
    const blocked = [...insideEdge, ...insideRemoved].filter((t) => VILLAGE_SOLID_TILES.has(t));
    expect(blocked).toEqual([]);
  });

  it("B4 막힌 칸 전체(명세 2): 원 밖 칸 + 원 안에서 그대로 둘 막힌 칸이다. 117: 마을 안 나무 28자리(새 자리)가 막는 칸을 더한 것과 개수·정렬한 목록이 같다", () => {
    // 115 전 기대값 SOLID_ALL_115 = { count: 2309, sha256: "975d2f05…" }(마을 안 나무가 옛 28자리일 때). 117: 바뀌는 나무 칸(옛·새 자리)은 solidKeep115가 빼므로 새 자리 칸을 따로 더한다
    const expected = [...new Set([...allTiles().filter(tileOutside115), ...solidKeep115(), ...rectTiles(NEW_TREES_117.map(trunkRect117))])].sort();
    expect(digest115([...VILLAGE_SOLID_TILES].sort())).toEqual(digest115(expected));
  });

  it("B5 마을 나무(명세 3, 117 명세 1): 마을 안 나무는 28자리이고 원 가운데까지 24.5(반지름 − 1.5) 안에 있으며, 자리는 117 명세 표의 28자리다. VILLAGE_TREES도 같다", () => {
    // 115 전 기대: 기준 커밋 70그루 가운데 42그루가 빠지고 28그루가 그 자리 그대로 남는다(117은 그 28자리를 표의 28자리로 바꾼다)
    const expected = NEW_TREES_117.map(([x, z]) => [x, z]);
    expect(sortPairs(LAYOUT.trees)).toEqual(sortPairs(expected));
    expect(sortPairs(VILLAGE_TREES)).toEqual(sortPairs(expected));
    expect(LAYOUT.trees).toHaveLength(TREES_KEPT_115);
    const far = LAYOUT.trees.filter(([x, z]) => centerDistance115(x, z) > CIRCLE_115.radius - 1.5);
    expect(far).toEqual([]);
  });

  it("B6 바위(명세 3): 원 밖 바위를 빼서 (46, 12) 하나만 남는다", () => {
    expect(sortPairs(LAYOUT.rocks)).toEqual(sortPairs(ROCKS_KEPT_115));
  });

  it("B7 풍차와 생울타리·울타리(명세 3·4): 배치 파일과 village.ts에 풍차가 없고, 마을 모델에 생울타리·울타리·풍차·풍차 날개 노드가 없으며, 소품 묶음에 빠지는 바위 다섯의 조각이 없고 남는 바위 (46, 12)의 조각(삼각형 200)은 그대로다", () => {
    expect({
      layoutWindmill: "windmill" in (LAYOUT as unknown as Record<string, unknown>),
      exportWindmill: Object.keys(villageModule).filter((k) => /windmill/i.test(k))
    }).toEqual({ layoutWindmill: false, exportWindmill: [] });
    const now = parseGlb(readFileSync(join(REPO, VILLAGE_GLB_PATH_115)));
    const removedNodes = nodeNames(now).filter((n) => REMOVED_GROUPS_115.some((g) => n === g || n.startsWith(`${g}-`)));
    expect(removedNodes).toEqual([]);
    expect({ removedRocks: propsTrianglesAround115(now, removedRocks115()), keptRock: propsTrianglesAround115(now, ROCKS_KEPT_115) }).toEqual({ removedRocks: 0, keptRock: 200 });
  });

  it("B8 카메라 범위(명세 5): VILLAGE_BOUNDS가 원을 감싸는 상자 x 3~55, z 0~52(높이 0)다", () => {
    expect({ ...VILLAGE_BOUNDS }).toEqual(VILLAGE_BOUNDS_115);
  });

  it("B9 카메라 범위(명세 5, 따라가는 규칙 그대로): 어느 화면·거리에서도, 원 둘레 끝 자리와 장소 셋에서 화면 아래 모서리 둘과 아래 가운데에 보이는 바닥이 새 상자(x 3~55, z 0~52) 안이다", () => {
    applyArea("village");
    try {
      // 원 둘레 끝 자리: 걸어갈 수 있는 칸 가운데 앞·뒤·왼쪽·오른쪽 끝과 네 대각선 쪽에서 가장 먼 칸
      const free: FloorPoint[] = [];
      for (let c = 0; c < VILLAGE.width; c += 1) for (let r = 0; r < VILLAGE.depth; r += 1) if (isFree(c + 0.5, r + 0.5)) free.push({ x: c + 0.5, z: r + 0.5 });
      expect(free.length).toBeGreaterThan(0);
      const farthest = (dx: number, dz: number) => free.reduce((best, p) => (p.x * dx + p.z * dz > best.x * dx + best.z * dz ? p : best));
      const follows = [
        ...[[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dz]) => farthest(dx, dz)),
        ...Object.values(VILLAGE_PLACES).map((p) => p.approach[0])
      ];
      const screens: [number, number][] = [
        [360, 640],
        [390, 844],
        [412, 915]
      ];
      const widths = [VIEW_WIDTH_MIN, VIEW_WIDTH_DEFAULT, VIEW_WIDTH_MAX, (VIEW_WIDTH_MIN + VIEW_WIDTH_MAX) / 2];
      const outside: string[] = [];
      const EPS = 1e-6;
      for (const [w, h] of screens) {
        for (const width of widths) {
          for (const follow of follows) {
            const pose = cameraPose(follow, width, w / h);
            const f = { x: pose.lookAt.x - pose.position.x, y: pose.lookAt.y - pose.position.y, z: pose.lookAt.z - pose.position.z };
            const fl = Math.hypot(f.x, f.y, f.z);
            const fw = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
            const rl = Math.hypot(fw.z, fw.x);
            const right = { x: -fw.z / rl, y: 0, z: fw.x / rl };
            const up = { x: right.y * fw.z - right.z * fw.y, y: right.z * fw.x - right.x * fw.z, z: right.x * fw.y - right.y * fw.x };
            const tanV = Math.tan((pose.fovDeg * Math.PI) / 360);
            const tanH = tanV * (w / h);
            for (const sx of [-1, 0, 1]) {
              const d = { x: fw.x + right.x * sx * tanH - up.x * tanV, y: fw.y + right.y * sx * tanH - up.y * tanV, z: fw.z + right.z * sx * tanH - up.z * tanV };
              const t = d.y < 0 ? -pose.position.y / d.y : NaN;
              const gx = pose.position.x + d.x * t;
              const gz = pose.position.z + d.z * t;
              const b = VILLAGE_BOUNDS_115;
              const ok = Number.isFinite(t) && gx >= b.minX - EPS && gx <= b.maxX + EPS && gz >= b.minZ - EPS && gz <= b.maxZ + EPS;
              if (!ok) outside.push(`${w}x${h} 폭${width.toFixed(1)} 라룹이(${follow.x},${follow.z}) 화면(${sx},-1) → ${gx.toFixed(3)},${gz.toFixed(3)}`);
            }
          }
        }
      }
      expect(outside.slice(0, 10)).toEqual([]);
    } finally {
      applyArea("room");
    }
  });
});

describe("[spec] 115 ① 그대로 둘 동작: 배치 파일의 다른 값, 원 안의 막힌 칸, 마을 모델의 다른 묶음", () => {
  it("K1 배치 파일에서 풍차·경계 원과 빠지는 나무·바위 말고는 기준 커밋과 같다(마을 크기 70×60, 건물·분수·가로등·노점·벤치·길, 원 안에 남는 나무·바위의 자리). 설명(_comment)은 보지 않는다", () => {
    const strip = (layout: Parameters<typeof withoutBoundary115>[0]) => {
      const { _comment: _c, ...rest } = withoutBoundary115(layout) as typeof layout & { _comment?: string };
      return rest;
    };
    expect(strip(LAYOUT)).toEqual(strip(baseLayout115()));
    expect({ width: LAYOUT.width, depth: LAYOUT.depth }).toEqual({ width: 70, depth: 60 });
  });

  it("K2 원 안의 막힌 칸(건물·분수·가로등·노점·벤치·남는 나무·바위) 가운데 115가 바꾸지 않는 곳(가장자리 줄·빠지는 나무·바위 칸 밖)이 기준 커밋과 같다: 개수와 목록의 sha256(117: 마을 안 나무 옛·새 자리 칸도 빼서 150개)", () => {
    expect(digest115(solidKeep115())).toEqual(SOLID_KEEP_115);
  });

  it("K3 마을 모델의 장면 뿌리 묶음 이름이 빠지는 묶음(생울타리·울타리·풍차·풍차 날개) 말고 기준 커밋과 같고, 그 밖의 모든 묶음(건물·유리·불빛·길·나무 틀, 소품의 분수·가로등·노점·벤치·남는 바위)의 메시가 기준 커밋과 같다", () => {
    const now = parseGlb(readFileSync(join(REPO, VILLAGE_GLB_PATH_115)));
    const base = parseGlb(gitShow(BASE_115, VILLAGE_GLB_PATH_115));
    expect(rootNamesKept115(now)).toEqual(rootNamesKept115(base));
    const all = () => true;
    // 118: 마을 모델에서 옛 Kenney 분수가 빠진다(명세 바뀌는 동작 1). 양쪽에서 옛 분수 삼각형(소품 묶음, 가운데에서 1.7칸 안)을 뺀 뒤 견준다
    const baseMeshes = describeGroups(withoutFountainAndLanternsGlb120(withoutBoundaryGlb115(base)), all);
    expect(Object.keys(baseMeshes).length).toBeGreaterThan(0);
    expect(describeGroups(withoutFountainAndLanternsGlb120(withoutBoundaryGlb115(now)), all)).toEqual(baseMeshes);
  });

  it("K4 장소 셋의 서는 자리는 원 안이고 걸어갈 수 있으며, 원 안에 남는 나무·바위 자리는 걸어갈 수 없다", () => {
    applyArea("village");
    try {
      for (const p of Object.values(VILLAGE_PLACES)) {
        const at = p.approach[0];
        expect({ id: p.id, inside: centerDistance115(at.x, at.z) <= CIRCLE_115.radius, free: isFree(at.x, at.z) }).toEqual({ id: p.id, inside: true, free: true });
      }
      // 117: 원 안에 남는 나무는 117 명세 표의 28자리
      const kept = [...NEW_TREES_117.map(([x, z]) => [x, z] as const), ...ROCKS_KEPT_115];
      expect(kept.length).toBe(TREES_KEPT_115 + 1);
      for (const [x, z] of kept) expect({ x, z, free: isFree(x, z) }).toEqual({ x, z, free: false });
    } finally {
      applyArea("room");
    }
  });
});
