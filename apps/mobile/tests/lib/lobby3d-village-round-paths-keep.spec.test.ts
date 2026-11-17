/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 099 마을 길 둥글게, 기능 변경, 모바일): 길을 둥글게 그려도 그대로여야 할 마을 데이터와 파일.
// 기대값은 명세(private 작업 폴더 099-2026-11-17-마을-길-둥글게/01-main-spec.md "그대로여야 할 동작"과 바뀌는 동작 1·3)에서 가져오고,
// 값은 기준 커밋 1144c47의 지금 값이다(막힌 칸 목록의 sha256은 기준 커밋에서 이 테스트의 계산으로 잰 값).
// 구현 코드는 부르는 방법(village.ts의 VILLAGE·VILLAGE_SOLID_TILES·VILLAGE_PLACES·VILLAGE_START)을 알려고만 읽었다.
// 모두 그대로 둘 동작이다(구현 전·뒤 통과): K4~K7.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";

const REPO = join(__dirname, "..", "..", "..", "..");
/** 작업 099의 기준 커밋(명세 첫 줄). */
const BASE = "1144c47";
const baseFile = (path: string) => execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

describe("[spec] 099 그대로 둘 동작: 마을 데이터와 파일", () => {
  it("K4 걸어갈 수 없는 칸이 기준 커밋과 같다(마을 크기 70×60, 막힌 칸 689개와 목록의 sha256). 길은 걷기에 영향을 주지 않는다", () => {
    expect({ width: VILLAGE.width, depth: VILLAGE.depth }).toEqual({ width: 70, depth: 60 });
    const solid = [...VILLAGE_SOLID_TILES].sort();
    expect({ count: solid.length, sha256: sha256(solid.join("\n")) }).toEqual({
      count: 689,
      sha256: "f2c256b91d2a666df265b1c7f71e8103e4bbd33cde4a122094ea94d46682166b"
    });
  });

  it("K5 장소(문 앞 자리·바라볼 곳·이름표 자리)와 라룹이가 나타나는 자리가 기준 커밋과 같다", () => {
    expect(JSON.parse(JSON.stringify(VILLAGE_PLACES))).toEqual({
      home: { id: "home", label: "라룹이 집", faceTo: { x: 35.5, z: 12 }, approach: [{ x: 35.5, z: 12.9 }], labelPoint: { x: 35.5, y: 2.7600000000000002, z: 12.2 } },
      furnitureShop: { id: "furnitureShop", label: "가구점", faceTo: { x: 12.5, z: 31 }, approach: [{ x: 12.5, z: 31.9 }], labelPoint: { x: 12.5, y: 2.7600000000000002, z: 31.2 } },
      cafe: { id: "cafe", label: "카페", faceTo: { x: 57.5, z: 28 }, approach: [{ x: 57.5, z: 28.9 }], labelPoint: { x: 57.5, y: 2.7600000000000002, z: 28.2 } },
      library: { id: "library", label: "도서관", faceTo: { x: 26.5, z: 48 }, approach: [{ x: 26.5, z: 48.9 }], labelPoint: { x: 26.5, y: 2.7600000000000002, z: 48.2 } }
    });
    expect({ ...VILLAGE_START }).toEqual({ x: 35.5, z: 12.9, heading: 0 });
  });

  it("K6 길 칸은 지금처럼 배치 파일의 paths 사각형들에서 나온다: paths가 기준 커밋과 같다", () => {
    const base = JSON.parse(baseFile("apps/mobile/src/lib/lobby3d/village-layout.json").toString("utf8")) as { paths: number[][] };
    expect(LAYOUT.paths).toEqual(base.paths);
  });

  it("K7 마을 모델 파일(lobby-village.glb)은 기준 커밋과 바이트까지 같고, 그 스크립트(scripts/lobby3d/build-village.py)는 줄 끝(CRLF/LF) 말고 같다", () => {
    const glb = "apps/mobile/assets/models/lobby-village.glb";
    expect({ path: glb, sha256: sha256(readFileSync(join(REPO, glb))) }).toEqual({ path: glb, sha256: sha256(baseFile(glb)) });
    // 저장소는 LF로 두고 Windows 작업 폴더는 CRLF로 꺼낼 수 있어(core.autocrlf), 텍스트 파일은 줄 끝을 맞춰 견준다
    const script = "scripts/lobby3d/build-village.py";
    const lf = (b: Buffer) => b.toString("utf8").replace(/\r\n/g, "\n");
    expect({ path: script, sha256: sha256(lf(readFileSync(join(REPO, script)))) }).toEqual({ path: script, sha256: sha256(lf(baseFile(script))) });
  });
});
