/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 마을 3D 모델 파일(F1~F3).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md F1~F3)에서만 가져온다.
// 기존 CREDITS 세 줄이 그대로인지는 이번 작업 전 CREDITS.md(기준 커밋 1b06dc1)의 파일 이름과 출처 글로 본다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const REPO = join(MOBILE, "..", "..");
const MODELS = join(MOBILE, "assets", "models");

describe("[spec] 마을 3D 모델 파일(F1~F3)", () => {
  it("F1: lobby-village.glb가 있고 glTF 2 바이너리다", () => {
    const file = join(MODELS, "lobby-village.glb");
    expect(existsSync(file)).toBe(true);
    const head = readFileSync(file).subarray(0, 8);
    expect(head.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(head.readUInt32LE(4)).toBe(2);
  });

  it("F2: 만드는 스크립트 scripts/lobby3d/build-village.py가 있다", () => {
    expect(existsSync(join(REPO, "scripts", "lobby3d", "build-village.py"))).toBe(true);
  });

  it("F3: CREDITS.md에 lobby-village.glb 줄(Kenney Fantasy Town Kit, CC0)이 있고 기존 세 줄은 그대로다", () => {
    const text = readFileSync(join(MODELS, "CREDITS.md"), "utf8");
    const lines = text.split(/\r?\n/);
    const village = lines.filter((line) => line.includes("`lobby-village.glb`"));
    expect(village).toHaveLength(1);
    expect(village[0]).toContain("Kenney");
    expect(village[0]).toContain("Fantasy Town Kit");
    expect(village[0]).toContain("CC0");
    expect(lines).toContain(
      "| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |"
    );
    expect(lines).toContain("| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |");
    expect(lines).toContain("| `writeloop.glb` | WriteLoop 캐릭터 모델 | 저장소와 같다 |");
  });
});
