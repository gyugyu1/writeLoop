// [spec] qa 테스트(작업 133 ① 옷집 입장·두 층 이동, 새 기능, 모바일): 앱 자산, 층 장소, 걷기, 애셋 배치 값.
// 기대값은 private 작업 폴더 133-2026-11-21-옷가게-실내-구매/02-입장-두층-이동/02-qa-scenarios.md(S번호)와 애셋 clothing-shop-layout.json의 값에서만 가져온다.
// 구현 코드는 부르는 방법(engine의 applyArea·LobbySim·isFree·markInfo·activePlaceIds, 앱 좌표 = 모델 좌표 + (9, 8))을 알려고만 읽었다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LobbySim, activePlaceIds, applyArea, isFree, markInfo, type FloorPoint } from "@/lib/lobby3d/engine";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";

const MOBILE = join(__dirname, "..", "..");
const OFFSET = { x: 9, z: 8 };
const app = (x: number, z: number): FloorPoint => ({ x: x + OFFSET.x, z: z + OFFSET.z });
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const floor = (n: 1 | 2) => LAYOUT.floors[String(n) as "1" | "2"];
type Anchors = Record<string, { node: string; positionXYZ: number[]; rotationYDegrees: number }>;
const anchor = (n: 1 | 2, key: string) => (floor(n).anchors as Anchors)[key];
const FILE_1F = join(MOBILE, "assets", "models", "clothing-shop", "clothing-shop-interior-1f.glb");
const FILE_2F = join(MOBILE, "assets", "models", "clothing-shop", "clothing-shop-interior-2f.glb");

function glbJson(path: string): { nodes: { name?: string }[] } {
  const buf = readFileSync(path);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
}

afterEach(() => applyArea("room"));

describe("[spec] 앱 자산(S1~S3)", () => {
  it("S1: 두 층 GLB와 배치 JSON이 애셋 최종본과 바이트가 같다(sha256)", () => {
    expect(sha256(FILE_1F)).toBe("2e033e1408c9352b02580d1151b7b4182989eb8bb38eae4d2e9485228d3f82e9");
    expect(sha256(FILE_2F)).toBe("9ef05a10a5e8078d3b0bc67ff7b247735ceb36373fcd3bc763400d7fdf06d20f");
    expect(sha256(join(MOBILE, "src", "lib", "lobby3d", "clothing-shop-layout.json"))).toBe("4cf72eb6d16c9cab5af2f00eeaf8b23324a5dd2d620691560587437d979eaa87");
  });

  it("S2: CREDITS.md에 두 층 모델 줄이 하나씩 있고 WriteLoop이 Blender로 만들었다고 적혀 있다", () => {
    const lines = readFileSync(join(MOBILE, "assets", "models", "CREDITS.md"), "utf8").split(/\r?\n/);
    for (const name of ["clothing-shop/clothing-shop-interior-1f.glb", "clothing-shop/clothing-shop-interior-2f.glb"]) {
      const found = lines.filter((l) => l.includes(`\`${name}\``));
      expect({ name, count: found.length }).toEqual({ name, count: 1 });
      expect(found[0]).toContain("WriteLoop");
      expect(found[0]).toContain("Blender");
      expect(found[0].toLowerCase()).toContain("json");
    }
  });

  it("S3: 층 모델에 배치 JSON이 말하는 뿌리·앞쪽 가림 노드·기준점 노드가 있고, 가림 노드는 명세의 이름이다", () => {
    for (const [n, file] of [[1, FILE_1F], [2, FILE_2F]] as const) {
      const names = new Set(glbJson(file).nodes.map((node) => node.name));
      const wanted = [floor(n).root, ...floor(n).cutawayFrontNodes];
      for (const key of Object.keys(floor(n).anchors)) wanted.push((floor(n).anchors as Anchors)[key].node);
      expect({ n, missing: wanted.filter((w) => !names.has(w)) }).toEqual({ n, missing: [] });
    }
    expect(floor(1).cutawayFrontNodes).toEqual(["F1_FrontFrame", "F1_FrontGlass"]);
    expect(floor(2).cutawayFrontNodes).toEqual(["F2_FrontFrame", "F2_FrontGlass"]);
  });
});

describe("[spec] 층 장소(S11·S14·S16)", () => {
  it("S11: 1층 장소는 '마을로'와 '2층' 둘이고, 서는 자리는 F1_ExitApproach·F1_StairsUp이다", () => {
    applyArea("clothing1");
    const ids = [...activePlaceIds()];
    expect(ids).toHaveLength(2);
    const byLabel = Object.fromEntries(ids.map((id) => [markInfo(id).label, markInfo(id)]));
    expect(Object.keys(byLabel).sort()).toEqual(["2층", "마을로"]);
    const exit = anchor(1, "ExitApproach").positionXYZ;
    const up = anchor(1, "StairsUp").positionXYZ;
    expect(byLabel["마을로"].approach[0]).toEqual(app(exit[0], exit[2]));
    expect(byLabel["2층"].approach[0]).toEqual(app(up[0], up[2]));
    expect({ prompt: byLabel["마을로"].prompt, button: byLabel["마을로"].buttonLabel }).toEqual({ prompt: "마을로 나갈까?", button: "나가기" });
    expect({ prompt: byLabel["2층"].prompt, button: byLabel["2층"].buttonLabel }).toEqual({ prompt: "2층으로 올라갈까?", button: "올라가기" });
  });

  it("S16: 2층 장소는 '1층' 하나이고 서는 자리는 F2_StairsDown, 말풍선은 '1층으로 내려갈까?'/'내려가기'다", () => {
    applyArea("clothing2");
    const ids = [...activePlaceIds()];
    expect(ids).toHaveLength(1);
    const info = markInfo(ids[0]);
    const down = anchor(2, "StairsDown").positionXYZ;
    expect(info.label).toBe("1층");
    expect(info.approach[0]).toEqual(app(down[0], down[2]));
    expect({ prompt: info.prompt, button: info.buttonLabel }).toEqual({ prompt: "1층으로 내려갈까?", button: "내려가기" });
  });
});

describe("[spec] 걷기(S9·S10·S26)", () => {
  const inRect = (r: number[], x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

  function walkAfterTap(n: 1 | 2, from: FloorPoint, tap: FloorPoint): FloorPoint {
    applyArea(n === 1 ? "clothing1" : "clothing2");
    const sim = new LobbySim({ x: from.x, z: from.z, random: () => 0.5 });
    let t = 1_000_000;
    sim.pointerDown({ point: tap, mark: null, onCharacter: false }, 0, 0, t);
    t += 30;
    sim.pointerUp(t);
    for (let i = 0; i < 1200; i += 1) {
      t += 16;
      sim.update(0.016, t);
    }
    return { x: sim.x, z: sim.z };
  }

  it.each([1, 2] as const)("S9: %s층 막힌 사각형 안과 벽 밖을 누르면 막힌 곳·벽 밖에 서지 않고 걸을 수 있는 곳에 선다", (n) => {
    const start = n === 1 ? anchor(1, "EntranceSpawn").positionXYZ : anchor(2, "FromLower").positionXYZ;
    const from = app(start[0], start[2]);
    const taps: FloorPoint[] = floor(n).blockedRectsXZ.map((r) => app((r[0] + r[2]) / 2, (r[1] + r[3]) / 2));
    taps.push(app(9.5, 0), app(0, -8.5));
    for (const tap of taps) {
      const end = walkAfterTap(n, from, tap);
      const m = { x: end.x - OFFSET.x, z: end.z - OFFSET.z };
      const result = {
        n,
        tap,
        free: isFree(end.x, end.z),
        inside: inRect(floor(n).insideRectXZ, m.x, m.z),
        blocked: floor(n).blockedRectsXZ.some((r) => inRect(r, m.x, m.z))
      };
      expect(result).toEqual({ n, tap, free: true, inside: true, blocked: false });
    }
  });

  it("S10: 1층 빈 바닥을 누르면 그 지점까지 걷는다", () => {
    const s = anchor(1, "EntranceSpawn").positionXYZ;
    const target = app(0, 0);
    applyArea("clothing1");
    expect(isFree(target.x, target.z)).toBe(true);
    const end = walkAfterTap(1, app(s[0], s[2]), target);
    expect(Math.hypot(end.x - target.x, end.z - target.z)).toBeLessThanOrEqual(0.06);
  });

  it("S26: 계산대(F1_CheckoutCounter 둘레의 막힌 사각형) 가운데는 걸을 수 없다", () => {
    applyArea("clothing1");
    const counter = floor(1).blockedRectsXZ.find((r) => r[0] === 5.54 && r[1] === -4.53);
    expect(counter).toBeDefined();
    const c = app((counter![0] + counter![2]) / 2, (counter![1] + counter![3]) / 2);
    expect(isFree(c.x, c.z)).toBe(false);
  });

  it("S9: 벽 가까이(0.32m 안쪽)에는 설 수 없다", () => {
    applyArea("clothing1");
    const [x0, z0] = floor(1).insideRectXZ;
    expect(floor(1).insideRectXZ).toEqual([-8.26, -7.15, 8.26, 7.15]);
    expect(LAYOUT.playerRadiusMetres).toBe(0.32);
    expect(isFree(x0 + 0.1 + OFFSET.x, OFFSET.z - 0.3)).toBe(false);
    expect(isFree(OFFSET.x + 1.2, z0 + 0.1 + OFFSET.z)).toBe(false);
  });
});
