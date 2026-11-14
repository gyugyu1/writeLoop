/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 마을 3D 모델 파일(F1~F3).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md F1~F3)에서만 가져온다.
// 18 결정(사용자: 풍차를 더함, 마을 나무를 Kenney 나무로 바꾸고 잎에 계절 색)으로 W2·T1을 더했다. 모델 안 이름(windmill, windmill-rotor,
// tree-templates, tpl-<나무>-leaf/trunk)은 구현 커밋 63c0bc4의 모델과 그리기 코드에서 부르는 이름만 확인했다.
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
    // 090-② 05 결정 3(사용자 2026-11-13 "qa가 새 동작에 맞게 고침"): 가구 묶음을 가구마다 나눠 앱·서버에 두게 되어 lobby-furniture.glb 줄에
    // 그 설명이 더해질 수 있다. 그 줄이 하나이고, 기존 줄의 글(출처·만든 스크립트·라이선스)이 앞뒤 그대로인지 본다.
    const furnitureLines = lines.filter((line) => line.includes("`lobby-furniture.glb`"));
    expect(furnitureLines).toHaveLength(1);
    expect(furnitureLines[0].startsWith(
      "| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. "
    )).toBe(true);
    expect(furnitureLines[0].endsWith(" 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |")).toBe(true);
    expect(lines).toContain("| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |");
    // 작업 089 ⑤ 24-main-decision.md(사용자 결정 "qa가 새 동작에 맞게 고침", 답 2): 22 결정으로 라룹이 몸을 Tripo 웹으로 만든 고글 없는 새 몸으로
    // 바꿔 writeloop.glb 줄이 새 몸 설명이 되었다. 그 줄이 하나이고 앞(파일 이름·"WriteLoop 캐릭터 모델")과 끝(라이선스)이 그대로이며 새 몸 설명(Tripo, 고글 없는 몸)이 있는지 본다.
    const characterLines = lines.filter((line) => line.includes("`writeloop.glb`"));
    expect(characterLines).toHaveLength(1);
    expect(characterLines[0].startsWith("| `writeloop.glb` | WriteLoop 캐릭터 모델")).toBe(true);
    expect(characterLines[0].endsWith(" | 저장소와 같다 |")).toBe(true);
    expect(characterLines[0]).toContain("Tripo");
    expect(characterLines[0]).toContain("고글 없는 몸");
  });
});

/** glb의 JSON 덩어리에서 노드 이름들. */
function glbNodeNames(file: string): string[] {
  const buf = readFileSync(file);
  const length = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + length).toString("utf8")) as { nodes?: { name?: string }[] };
  return (json.nodes ?? []).map((n) => n.name ?? "");
}

describe("[spec] 풍차와 Kenney 나무(W2, T1, 18 결정)", () => {
  const names = () => glbNodeNames(join(MODELS, "lobby-village.glb"));

  it("W2: 마을 모델에 풍차와, 따로 돌릴 수 있는 풍차 날개가 있다", () => {
    expect(names()).toEqual(expect.arrayContaining(["windmill", "windmill-rotor"]));
  });

  it("T1: 마을 모델에 Kenney 나무 틀이 있고, 나무마다 잎(계절 색을 칠할 곳)과 줄기가 따로 있다", () => {
    const all = names();
    expect(all).toContain("tree-templates");
    const leaves = all.filter((n) => /^tpl-.+-leaf$/.test(n)).map((n) => n.slice(4, -5));
    const trunks = all.filter((n) => /^tpl-.+-trunk$/.test(n)).map((n) => n.slice(4, -6));
    expect(leaves.length).toBeGreaterThan(0);
    expect([...leaves].sort()).toEqual([...trunks].sort());
  });
});
