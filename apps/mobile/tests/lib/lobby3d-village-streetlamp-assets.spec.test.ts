/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 120 마을 가로등 교체, 기능 변경, 모바일): 새 가로등 모델 파일, 마을 모델에서 옛 Kenney 가로등·가로등 불빛 판이 빠진 것, 만드는 스크립트, 배치·막힌 칸, 자산 출처.
// 기대값은 명세(private 작업 폴더 120-2026-11-19-마을-가로등-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 703bef8의 지금 값이다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// - 자산 출처(CREDITS.md)는 코드와 따로 하는 docs 커밋이라(명세 6) 코드 커밋 시점 기록에서는 실패할 수 있다. 이름 앞에 [docs 커밋]을 붙였다.
// - 마을 모델에서 옛 가로등이 빠졌는지는 소품 묶음(props)의 삼각형 가운데 점 셋이 모두 옛 가로등 자리(배치 파일 lanterns에서 0.9칸 안, 땅 높이)에 드는 것의 수로 본다
//   (tests/__fixtures__/village-streetlamp-120.ts. 기준 커밋 모델에서는 632개, 분수·벤치·바위는 이 안에 들지 않는다).
// - 다른 묶음(건물, 벤치, 바위, 창 불빛 판, 길)이 그대로인지는 명세 "고칠 기존 테스트"로 고친 기존 테스트(099 K7, 101 K9, 106 K5, 107 K4, 114 K4, 115 K3, 098 K5 등)가
//   옛 가로등을 뺀 기준 모델과 견주어 본다. 여기서는 소품 묶음 삼각형 수가 "기준 − 분수 삼각형 − 가로등 삼각형"과 같은지와 창 불빛 판이 그대로인지만 더 본다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { CREDITS_PATH, REPO, meshNodesUnder, nowVillageGlb, rootIndex, sceneRoots, triangleCount } from "../__fixtures__/village-glb-098";
import { describeGroups } from "../__fixtures__/village-shops-106";
import { STALL_TRIANGLES_127 } from "../__fixtures__/village-stalls-127";
import {
  BASE_120,
  LAMP_ASSET_FILE,
  LAMP_ASSET_NAME,
  LAMP_BLOCK,
  LAMP_NODE_NAME,
  LAMP_ROUGHNESS,
  LAMP_SOURCE_BYTES,
  LAMP_SOURCE_SHA256,
  LAMP_TRIANGLES,
  LANTERNS,
  baseVillageGlb120,
  isLampGlowRoot,
  lampAssetExists,
  lampAssetGlb,
  propsTrianglesInOldLamps,
  rootNames120,
  sha256Hex
} from "../__fixtures__/village-streetlamp-120";

const gitShow = (path: string) => execFileSync("git", ["show", `${BASE_120}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");

describe("[spec] 120 새 가로등 모델 파일(명세 2)", () => {
  it("[바뀔] A1 apps/mobile/assets/models/village-streetlamp.glb가 있고, 바이트가 원본(WriteLoop_Village_Streetlamp.glb)과 같다(크기 61536, sha256)", () => {
    expect({ exists: lampAssetExists() }).toEqual({ exists: true });
    const bytes = readFileSync(LAMP_ASSET_FILE);
    expect({ bytes: bytes.length, sha256: sha256Hex(bytes) }).toEqual({ bytes: LAMP_SOURCE_BYTES, sha256: LAMP_SOURCE_SHA256 });
  });

  it("[바뀔] A2 모델의 내용이 명세와 같다: 메시 하나(WriteLoop_Village_Streetlamp, 삼각형 930개), 재질 하나(발광 그림·색 그림, emissiveFactor (1, 1, 1), 거칠기 0.7, 금속 0), 높이 0~2.571", () => {
    expect({ exists: lampAssetExists() }).toEqual({ exists: true });
    const glb = lampAssetGlb();
    expect(glb.json.nodes.map((n, i) => ({ name: n.name, triangles: triangleCount(glb, i) }))).toEqual([{ name: LAMP_NODE_NAME, triangles: LAMP_TRIANGLES }]);
    expect(glb.json.meshes).toHaveLength(1);
    const materials = (glb.json.materials ?? []) as unknown as {
      emissiveFactor?: number[];
      emissiveTexture?: unknown;
      pbrMetallicRoughness?: { baseColorTexture?: unknown; metallicFactor?: number; roughnessFactor?: number };
    }[];
    expect(materials).toHaveLength(1);
    const m = materials[0];
    expect({
      emissiveFactor: m.emissiveFactor,
      hasEmissiveTexture: m.emissiveTexture !== undefined,
      hasColorTexture: m.pbrMetallicRoughness?.baseColorTexture !== undefined,
      metallic: m.pbrMetallicRoughness?.metallicFactor,
      roughness: Math.round((m.pbrMetallicRoughness?.roughnessFactor ?? -1) * 1e3) / 1e3
    }).toEqual({ emissiveFactor: [1, 1, 1], hasEmissiveTexture: true, hasColorTexture: true, metallic: 0, roughness: LAMP_ROUGHNESS });
    const position = glb.json.accessors[glb.json.meshes[0].primitives[0].attributes.POSITION];
    expect({ minY: position.min![1], maxY: Math.round(position.max![1] * 1e3) / 1e3 }).toEqual({ minY: 0, maxY: 2.571 });
  });
});

describe("[spec] 120 마을 모델에서 옛 Kenney 가로등과 불빛 판 빼기(명세 1)", () => {
  it("[바뀔] F1 마을 모델(lobby-village.glb)의 소품 묶음(props)에 옛 가로등 삼각형이 없다(기준 커밋 모델에는 632개 있었다)", () => {
    expect(propsTrianglesInOldLamps(baseVillageGlb120())).toBe(632);
    expect(propsTrianglesInOldLamps(nowVillageGlb())).toBe(0);
  });

  it("[바뀔] F2 장면 뿌리에 가로등 불빛 판(glow-lamp-0~3)이 없다(기준 커밋 모델에는 넷 있었다). 건물 창 불빛 판(glow-windows)은 있다", () => {
    expect(rootNames120(baseVillageGlb120()).filter(isLampGlowRoot)).toEqual(["glow-lamp-0", "glow-lamp-1", "glow-lamp-2", "glow-lamp-3"]);
    const now = nowVillageGlb();
    expect(rootNames120(now).filter(isLampGlowRoot)).toEqual([]);
    expect(rootNames120(now)).toContain("glow-windows");
    // 노드 이름으로도 없다(장면 뿌리에서 빼기만 한 것이 아니다)
    expect(now.json.nodes.map((n) => n.name ?? "").filter(isLampGlowRoot)).toEqual([]);
  });

  it("[바뀔] F3 소품 묶음의 삼각형 수는 기준 커밋보다 옛 가로등 삼각형(632개)과 옛 노점 삼각형(127: 592개)만큼만 줄었고, 장면 뿌리 묶음 이름은 가로등 불빛 판 넷만 빠지고 그대로다(다른 소품과 묶음은 그대로)", () => {
    const propsTriangles = (glb: ReturnType<typeof nowVillageGlb>) => {
      const root = rootIndex(glb, "props");
      expect(root).toBeGreaterThanOrEqual(0);
      return meshNodesUnder(glb, root).reduce((sum, node) => sum + triangleCount(glb, node), 0);
    };
    const base = baseVillageGlb120();
    const now = nowVillageGlb();
    // 127: 옛 Kenney 노점 둘의 삼각형(592개)도 빠진다
    expect(propsTriangles(now)).toBe(propsTriangles(base) - 632 - STALL_TRIANGLES_127);
    expect(rootNames120(now)).toEqual(rootNames120(base).filter((n) => !isLampGlowRoot(n)));
    expect(sceneRoots(now).length).toBe(sceneRoots(base).length - 4);
  });

  it("[그대로] F4 건물 창 불빛 묶음(glow-windows)은 기준 커밋과 같다: 장면 뿌리에 있고, 메시는 기준 커밋과 같다(지금은 메시가 없다)", () => {
    const only = (name: string) => name === "glow-windows";
    expect(rootNames120(baseVillageGlb120())).toContain("glow-windows");
    expect(rootNames120(nowVillageGlb())).toContain("glow-windows");
    expect(describeGroups(nowVillageGlb(), only)).toEqual(describeGroups(baseVillageGlb120(), only));
  });
});

describe("[spec] 120 마을 모델 만드는 스크립트(명세 바뀌는 동작 1)", () => {
  /** 주석 줄을 뺀 코드 줄(앞뒤 공백 없앰). */
  const codeLines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  const SCRIPT = "scripts/lobby3d/build-village.py";
  const lampLine = (l: string) => /lantern|LANTERN|glow-lamp|lamp = group|glow_quad\(lamp/.test(l);

  it("[바뀔] S1 build-village.py에 Kenney 가로등을 놓는 코드(place(\"lantern\")·LANTERN_SCALE)와 가로등 불빛 판(glow-lamp-) 코드가 없다", () => {
    const base = codeLines(gitShow(SCRIPT));
    const now = codeLines(readFileSync(join(REPO, SCRIPT), "utf8"));
    expect(base.filter(lampLine).length).toBeGreaterThan(0);
    expect(now.filter(lampLine)).toEqual([]);
  });

  it("[그대로] S2 build-village.py의 가로등 줄 밖의 코드 줄(건물·벤치·바위·길·창 불빛·나무 틀)은 기준 커밋과 같다(분수 줄은 118이 뺐다. 127: 노점 줄도 양쪽에서 뺀다)", () => {
    const base = codeLines(gitShow(SCRIPT));
    const now = codeLines(readFileSync(join(REPO, SCRIPT), "utf8"));
    const stallLine = (l: string) => /stall|LAYOUT\["stalls"\]/.test(l);
    expect(now.filter((l) => !lampLine(l) && !stallLine(l))).toEqual(base.filter((l) => !lampLine(l) && !stallLine(l)));
  });
});

describe("[spec] 120 자리와 막힌 칸(명세 3, 그대로 둘 동작)", () => {
  it("[그대로] L1 배치 파일의 lanterns는 네 자리 (31.5, 18.5), (39.5, 18.5), (31.5, 26.5), (39.5, 26.5) 그대로이고, 배치 파일의 다른 값도 기준 커밋과 같다(설명 _comment는 보지 않는다)", () => {
    expect(LANTERNS).toEqual([
      [31.5, 18.5],
      [39.5, 18.5],
      [31.5, 26.5],
      [39.5, 26.5]
    ]);
    const base = JSON.parse(gitShow("apps/mobile/src/lib/lobby3d/village-layout.json")) as Record<string, unknown>;
    const strip = (layout: Record<string, unknown>) => {
      // 127: 노점(stalls)은 없어지므로 양쪽에서 뺀다
      const { _comment: _c, stalls: _s, ...rest } = layout;
      return rest;
    };
    expect(strip(LAYOUT as unknown as Record<string, unknown>)).toEqual(strip(base));
  });

  it("[그대로] L2 가로등이 걷기를 막는 넓이는 각 자리 0.6 × 0.6칸이다: 가로등이 선 칸 하나씩(31,18 · 39,18 · 31,26 · 39,26)이 막혀 있고, 그 칸 둘레 여덟 칸은 막히지 않는다", () => {
    expect(LAMP_BLOCK).toBe(0.6);
    // 0.6 × 0.6 사각형(자리 가운데 ±0.3)은 한 칸 안에 든다
    for (const [x, z] of LANTERNS) {
      expect({ x, z, inOneTile: Math.floor(x - 0.3) === Math.floor(x + 0.3) && Math.floor(z - 0.3) === Math.floor(z + 0.3) }).toEqual({ x, z, inOneTile: true });
    }
    const solid = (c: number, r: number) => VILLAGE_SOLID_TILES.has(`${c},${r}`);
    for (const [x, z] of LANTERNS) {
      const c = Math.floor(x);
      const r = Math.floor(z);
      expect({ tile: `${c},${r}`, solid: solid(c, r) }).toEqual({ tile: `${c},${r}`, solid: true });
      const around: string[] = [];
      for (let dc = -1; dc <= 1; dc += 1) for (let dr = -1; dr <= 1; dr += 1) if ((dc !== 0 || dr !== 0) && solid(c + dc, r + dr)) around.push(`${c + dc},${r + dr}`);
      expect(around).toEqual([]);
    }
  });
});

describe("[spec] 120 자산 출처(명세 6, docs 커밋)", () => {
  const lines = () => readFileSync(join(REPO, CREDITS_PATH), "utf8").split(/\r?\n/);

  it("[docs 커밋] C1 CREDITS.md 마을 모델(lobby-village.glb) 줄의 Kenney 부품에서 가로등이 빠지고, 바위·길은 남는다(127: 노점은 보지 않는다)", () => {
    const village = lines().filter((l) => l.includes("`lobby-village.glb`"));
    expect(village).toHaveLength(1);
    const line = village[0];
    const from = line.indexOf("Fantasy Town Kit");
    const to = line.indexOf("`scripts/lobby3d/build-village.py`", from);
    expect({ from: from >= 0, to: to > from }).toEqual({ from: true, to: true });
    const parts = line.slice(from, to);
    expect({ parts, lantern: parts.includes("가로등"), missing: ["바위", "길"].filter((w) => !parts.includes(w)) }).toEqual({ parts, lantern: false, missing: [] });
  });

  it("[docs 커밋] C2 CREDITS.md에 가로등 파일(village-streetlamp.glb) 줄이 하나 있고 WriteLoop 제작으로 적혀 있다", () => {
    const lamp = lines().filter((l) => l.includes(`\`${LAMP_ASSET_NAME}\``));
    expect(lamp).toHaveLength(1);
    expect(lamp[0].startsWith(`| \`${LAMP_ASSET_NAME}\` |`)).toBe(true);
    expect(lamp[0]).toContain("WriteLoop");
  });

  it("[그대로] C3 CREDITS.md의 다른 줄(마을 모델 줄과 가로등 줄 밖)은 기준 커밋과 같다(차례 포함). 마을 모델 줄은 Kenney 부품 목록 밖의 글이 같다", () => {
    const others = (text: string) => text.split(/\r?\n/).filter((l) => !l.includes("`lobby-village.glb`") && !l.includes(`\`${LAMP_ASSET_NAME}\``) && !l.includes("WriteLoop_Tree") && !l.includes("`village-fountain.glb`"));
    expect(others(readFileSync(join(REPO, CREDITS_PATH), "utf8"))).toEqual(others(gitShow(CREDITS_PATH)));
    const rest = (text: string) => {
      const line = text.split(/\r?\n/).filter((l) => l.includes("`lobby-village.glb`"))[0];
      const from = line.indexOf("Fantasy Town Kit");
      const to = line.indexOf("`scripts/lobby3d/build-village.py`", from);
      return line.slice(0, from) + line.slice(to);
    };
    expect(rest(readFileSync(join(REPO, CREDITS_PATH), "utf8"))).toBe(rest(gitShow(CREDITS_PATH)));
  });
});
