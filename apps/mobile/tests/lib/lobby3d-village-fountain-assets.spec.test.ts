/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 118 마을 분수대 교체, 기능 변경, 모바일): 새 분수 모델 파일, 마을 모델에서 옛 Kenney 분수가 빠진 것, 만드는 스크립트, 막힌 칸, 자산 출처.
// 기대값은 명세(private 작업 폴더 118-2026-11-19-마을-분수대-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 0f80ab1의 지금 값이다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// - 자산 출처(CREDITS.md)는 코드와 따로 하는 docs 커밋이라(명세 6) 코드 커밋 시점 기록에서는 실패할 수 있다. 이름 앞에 [docs 커밋]을 붙였다.
// - 마을 모델에서 옛 분수가 빠졌는지는 소품 묶음(props)의 삼각형 가운데 점 셋이 모두 옛 분수 자리(가운데에서 1.7칸 안, 땅 높이)에 드는 것의 수로 본다
//   (tests/__fixtures__/village-fountain-118.ts. 기준 커밋 모델에서는 1628개, 가로등·벤치·바위는 이 안에 들지 않는다).
// - 다른 묶음(건물, 가로등, 벤치, 바위, 불빛 판, 길)이 그대로인지는 명세 "고칠 기존 테스트"로 고친 기존 테스트(099 K7, 101 K9, 106 K5, 107 K4, 114 K4, 115 K3, 098 K5)가
//   분수를 뺀 기준 모델과 견주어 본다. 여기서는 소품 묶음 삼각형 수가 "기준 − 분수 삼각형"과 같은지만 더 본다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { CREDITS_PATH, REPO, meshNodesUnder, nowVillageGlb, rootIndex, sceneRoots, triangleCount } from "../__fixtures__/village-glb-098";
import {
  BASE_118,
  baseVillageGlb118,
  CLIP_KEYS,
  CLIP_NAME,
  FOUNTAIN_ASSET_FILE,
  FOUNTAIN_ASSET_NAME,
  FOUNTAIN_LAYOUT,
  FOUNTAIN_SOURCE_BYTES,
  FOUNTAIN_SOURCE_SHA256,
  STONE_TRIANGLES,
  WATER_TRIANGLES,
  flowKeys,
  fountainAssetExists,
  fountainAssetGlb,
  propsTrianglesInOldFountain,
  rootNames118,
  sha256Hex
} from "../__fixtures__/village-fountain-118";
// 120(마을 가로등 교체, 명세 "고칠 기존 테스트"): 마을 모델에서 옛 Kenney 가로등 넷(소품 묶음 632 삼각형)과 가로등 불빛 판(glow-lamp-0~3)도 빠지므로 아래 견주기에 그만큼을 반영한다
import { isLampGlowRoot } from "../__fixtures__/village-streetlamp-120";
import { STALL_TRIANGLES_127 } from "../__fixtures__/village-stalls-127";
const OLD_LAMP_TRIANGLES_120 = 632;

const gitShow = (path: string) => execFileSync("git", ["show", `${BASE_118}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");

describe("[spec] 118 새 분수 모델 파일(명세 2)", () => {
  it("[바뀔] A1 apps/mobile/assets/models/village-fountain.glb가 있고, 바이트가 원본(WriteLoop_Village_Fountain.glb)과 같다(크기 143460, sha256)", () => {
    expect({ exists: fountainAssetExists() }).toEqual({ exists: true });
    const bytes = readFileSync(FOUNTAIN_ASSET_FILE);
    expect({ bytes: bytes.length, sha256: sha256Hex(bytes) }).toEqual({ bytes: FOUNTAIN_SOURCE_BYTES, sha256: FOUNTAIN_SOURCE_SHA256 });
  });

  it("[바뀔] A2 모델의 내용이 명세와 같다: 메시 둘(석재 1534·물 1186 삼각형), 물 메시 모프 타깃 셋과 기본 영향값 0, Fountain_Flow 키 25개(첫 키 0.0417초·끝 키 2.0417초, 두 키 모두 (0, 0, 0))", () => {
    expect({ exists: fountainAssetExists() }).toEqual({ exists: true });
    const glb = fountainAssetGlb();
    const nodes = glb.json.nodes.map((n) => ({ name: n.name, triangles: triangleCount(glb, glb.json.nodes.indexOf(n)) }));
    expect(nodes).toEqual([
      { name: "Fountain | carved limestone", triangles: STONE_TRIANGLES },
      { name: "Water | gentle downward trickle", triangles: WATER_TRIANGLES }
    ]);
    const water = glb.json.meshes[glb.json.nodes[1].mesh!] as unknown as { weights?: number[]; primitives: { targets?: unknown[] }[] };
    expect({ targets: water.primitives[0].targets?.length, weights: water.weights }).toEqual({ targets: 3, weights: [0, 0, 0] });
    const keys = flowKeys(glb);
    expect(keys.times).toHaveLength(CLIP_KEYS);
    expect(keys.times[0]).toBeCloseTo(0.0417, 4);
    expect(keys.times[CLIP_KEYS - 1]).toBeCloseTo(2.0417, 4);
    expect(keys.values[0]).toEqual([0, 0, 0]);
    expect(keys.values[CLIP_KEYS - 1].map((v) => Math.abs(v) < 1e-9)).toEqual([true, true, true]);
    expect(CLIP_NAME).toBe("Fountain_Flow");
  });
});

describe("[spec] 118 마을 모델에서 옛 Kenney 분수 빼기(명세 1)", () => {
  it("[바뀔] F1 마을 모델(lobby-village.glb)의 소품 묶음(props)에 옛 분수 삼각형이 없다(기준 커밋 모델에는 1628개 있었다)", () => {
    expect(propsTrianglesInOldFountain(baseVillageGlb118())).toBe(1628);
    expect(propsTrianglesInOldFountain(nowVillageGlb())).toBe(0);
  });

  it("[바뀔] F2 소품 묶음의 삼각형 수는 기준 커밋보다 옛 분수 삼각형(1628개)과 옛 가로등 삼각형(120: 632개)과 옛 노점 삼각형(127: 592개)만큼만 줄었고, 장면 뿌리 묶음 이름은 가로등 불빛 판(glow-lamp-0~3, 120)만 빠지고 그대로다(다른 소품과 묶음은 그대로)", () => {
    const propsTriangles = (glb: ReturnType<typeof nowVillageGlb>) => {
      const root = rootIndex(glb, "props");
      expect(root).toBeGreaterThanOrEqual(0);
      return meshNodesUnder(glb, root).reduce((sum, node) => sum + triangleCount(glb, node), 0);
    };
    const base = baseVillageGlb118();
    const now = nowVillageGlb();
    // 127: 옛 Kenney 노점 둘의 삼각형(592개)도 빠진다
    expect(propsTriangles(now)).toBe(propsTriangles(base) - 1628 - OLD_LAMP_TRIANGLES_120 - STALL_TRIANGLES_127);
    expect(rootNames118(now)).toEqual(rootNames118(base).filter((n) => !isLampGlowRoot(n)));
    expect(sceneRoots(now).length).toBe(sceneRoots(base).length - 4);
  });
});

describe("[spec] 118 마을 모델 만드는 스크립트(명세 바뀌는 동작 1)", () => {
  /** 주석 줄을 뺀 코드 줄(앞뒤 공백 없앰). */
  const codeLines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  const SCRIPT = "scripts/lobby3d/build-village.py";

  it("[바뀔] S1 build-village.py에서 fountain-round-detail을 놓는 코드가 없고, 그 밖의 코드 줄은 기준 커밋과 같다(분수 배치 줄과 그 자리 변수 줄만 빠질 수 있다)", () => {
    const base = codeLines(gitShow(SCRIPT));
    // 127: 노점을 놓는 코드 줄(노점 반복문과 그 안의 줄)은 양쪽에서 뺀다(노점 코드가 빠진 것은 127 테스트가 본다)
    const stall = (l: string) => /stall|LAYOUT\["stalls"\]/.test(l);
    const now = codeLines(readFileSync(join(REPO, SCRIPT), "utf8")).filter((l) => !stall(l));
    expect(base.some((l) => l.includes("fountain-round-detail"))).toBe(true);
    expect(now.filter((l) => l.includes("fountain-round-detail"))).toEqual([]);
    const placing = (l: string) => l.includes("fountain-round-detail");
    const slot = 'fx = LAYOUT["fountain"]';
    // 120: 가로등 배치 줄(등 배율·자리 반복·놓기·불빛 판 줄)도 빠진다
    const lamp = (l: string) => /lantern|LANTERN|glow-lamp|lamp = group|glow_quad\(lamp/.test(l);
    const withoutPlacing = base.filter((l) => !placing(l) && !lamp(l) && !stall(l));
    // 자리 변수 줄(fx = ...)은 쓰지 않으면 지워도 되고 남겨도 된다
    expect([withoutPlacing, withoutPlacing.filter((l) => l !== slot)]).toContainEqual(now);
  });

  it("[그대로] S2 build-village.py가 벤치·바위를 놓는 코드는 기준 커밋과 같다(120: 가로등은 뺀다. 127: 노점도 뺀다)", () => {
    const pick = (text: string) => codeLines(text).filter((l) => /place\("rock|BENCH_SCALE|LAYOUT\["(benches|rocks)"\]/.test(l));
    const base = pick(gitShow(SCRIPT));
    expect(base.length).toBeGreaterThan(0);
    expect(pick(readFileSync(join(REPO, SCRIPT), "utf8"))).toEqual(base);
  });
});

describe("[spec] 118 자리와 막힌 칸(명세 3, 그대로 둘 동작)", () => {
  it("[그대로] L1 배치 파일의 fountain은 가운데 x 35.5·z 22.5, 충돌 반지름 1.6 그대로이고, 기준 커밋과 같다", () => {
    expect(FOUNTAIN_LAYOUT).toEqual({ x: 35.5, z: 22.5, radius: 1.6 });
    const base = JSON.parse(gitShow("apps/mobile/src/lib/lobby3d/village-layout.json")) as typeof LAYOUT;
    expect(LAYOUT.fountain).toEqual(base.fountain);
  });

  it("[그대로] L2 반지름 1.6 원에 걸치는 칸이 막혀 있다(원과 칸의 가장 가까운 거리 1.6 이하인 21칸), 원 둘레 모서리 칸과 위·아래 끝 칸은 막히지 않는다(옛 분수와 같다)", () => {
    const expected: string[] = [];
    for (let c = 28; c < 44; c += 1) {
      for (let r = 15; r < 30; r += 1) {
        const dx = Math.max(c - FOUNTAIN_LAYOUT.x, 0, FOUNTAIN_LAYOUT.x - (c + 1));
        const dz = Math.max(r - FOUNTAIN_LAYOUT.z, 0, FOUNTAIN_LAYOUT.z - (r + 1));
        if (Math.hypot(dx, dz) <= FOUNTAIN_LAYOUT.radius) expected.push(`${c},${r}`);
      }
    }
    expect(expected).toHaveLength(21);
    expect(expected.filter((t) => !VILLAGE_SOLID_TILES.has(t))).toEqual([]);
    // 칸 단위로 막아, 가로·세로로는 원 테두리(x 33.9)보다 약 0.9칸 먼저(x 33) 막힌다. 모서리·끝은 막히지 않는다
    for (const free of ["33,20", "37,20", "33,24", "37,24", "35,19", "35,25"]) expect({ tile: free, solid: VILLAGE_SOLID_TILES.has(free) }).toEqual({ tile: free, solid: false });
    for (const solid of ["33,22", "37,22", "35,20", "35,24"]) expect({ tile: solid, solid: VILLAGE_SOLID_TILES.has(solid) }).toEqual({ tile: solid, solid: true });
  });
});

describe("[spec] 118 자산 출처(명세 6, docs 커밋)", () => {
  const lines = () => readFileSync(join(REPO, CREDITS_PATH), "utf8").split(/\r?\n/);

  it("[docs 커밋] C1 CREDITS.md 마을 모델(lobby-village.glb) 줄의 Kenney 부품에서 분수가 빠지고, 바위·길은 남는다(127: 노점은 보지 않는다. 120: 가로등도 빠진다. 그 줄은 120 qa 테스트가 본다)", () => {
    const village = lines().filter((l) => l.includes("`lobby-village.glb`"));
    expect(village).toHaveLength(1);
    const line = village[0];
    const from = line.indexOf("Fantasy Town Kit");
    const to = line.indexOf("`scripts/lobby3d/build-village.py`", from);
    expect({ from: from >= 0, to: to > from }).toEqual({ from: true, to: true });
    const parts = line.slice(from, to);
    expect({ parts, fountain: parts.includes("분수"), missing: ["바위", "길"].filter((w) => !parts.includes(w)) }).toEqual({ parts, fountain: false, missing: [] });
  });

  it("[docs 커밋] C2 CREDITS.md에 분수 파일(village-fountain.glb) 줄이 하나 있고 WriteLoop 제작으로 적혀 있다", () => {
    const fountain = lines().filter((l) => l.includes(`\`${FOUNTAIN_ASSET_NAME}\``));
    expect(fountain).toHaveLength(1);
    expect(fountain[0].startsWith(`| \`${FOUNTAIN_ASSET_NAME}\` |`)).toBe(true);
    expect(fountain[0]).toContain("WriteLoop");
  });

  it("[그대로] C3 CREDITS.md의 다른 줄(마을 모델 줄과 분수 줄 밖)은 기준 커밋과 같다(차례 포함)", () => {
    const others = (text: string) => text.split(/\r?\n/).filter((l) => !l.includes("`lobby-village.glb`") && !l.includes(`\`${FOUNTAIN_ASSET_NAME}\``) && !l.includes("WriteLoop_Tree") && !l.includes("`village-streetlamp.glb`"));
    expect(others(readFileSync(join(REPO, CREDITS_PATH), "utf8"))).toEqual(others(gitShow(CREDITS_PATH)));
  });
});
