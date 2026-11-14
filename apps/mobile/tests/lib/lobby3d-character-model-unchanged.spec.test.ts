/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 059, 기능 변경: 3D 로비 캐릭터를 확정 3D 모델로 바꾼다). 그대로 둘 동작.
// 기대값은 지금 동작(기준 커밋 aac4a6a)에서 가져온다.
// - 시뮬레이션(engine.ts)은 바꾸지 않는다: 동작 길이(ACTION_SECONDS)와, 클립 규칙이 받을 상태(snapshot의 speed·action)의 모양.
// - Metro 설정에 glb를 더해도 기존 자산 확장자와 three 모듈판 고르기는 그대로다.
import { join } from "node:path";
import { ACTION_SECONDS, LARGE_MOTIONS, LobbySim } from "@/lib/lobby3d/engine";

const MOBILE = join(__dirname, "..", "..");

describe("[spec] 시뮬레이션의 동작 길이와 상태 모양", () => {
  it("[spec] ACTION_SECONDS는 wave 2.4, jump 1.6, hop 1.8, point 2.2, spin 0.9, look 2.6, poke 0.8초다", () => {
    expect(ACTION_SECONDS).toEqual({ wave: 2.4, jump: 1.6, hop: 1.8, point: 2.2, spin: 0.9, look: 2.6, poke: 0.8 });
  });

  it("[spec] 동작 줄이기에서 빼는 큰 동작은 jump, hop, spin, poke다", () => {
    expect([...LARGE_MOTIONS].sort()).toEqual(["hop", "jump", "poke", "spin"]);
  });

  it("[spec] snapshot의 speed는 hypot(vx, vz)이고 action은 { type, t } 복사본이다", () => {
    const sim = new LobbySim({ random: () => 0.5 });
    sim.vx = 0.6;
    sim.vz = 0.8;
    sim.startAction("wave");
    const snap = sim.snapshot(0);
    expect(snap.speed).toBeCloseTo(1, 10);
    expect(snap.action).toEqual({ type: "wave", t: 0 });
    expect(snap.action).not.toBe(sim.action);
  });

  it("[spec] 동작의 지난 시간은 update의 dt(최대 0.05초)만큼 늘고, 길이에 닿으면 동작이 끝난다", () => {
    const sim = new LobbySim({ random: () => 0.5 });
    sim.playAction("poke");
    sim.update(0.05, 0);
    expect(sim.action).toEqual({ type: "poke", t: 0.05 });
    sim.update(0.2, 50); // 한 번에 0.05초까지만 진행한다
    expect(sim.action?.t).toBeCloseTo(0.1, 10);
    for (let i = 0; i < 13; i += 1) sim.update(0.05, 100 + i * 50);
    expect(sim.action?.t).toBeCloseTo(0.75, 10);
    sim.update(0.05, 800);
    expect(sim.action).toBeNull();
  });
});

describe("[spec] Metro 설정의 그대로 둘 부분", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loadConfig = () => require(join(MOBILE, "metro.config.js")) as {
    resolver?: {
      assetExts?: string[];
      resolveRequest?: (context: unknown, moduleName: string, platform: string | null) => unknown;
    };
  };

  it("[spec] 기본 자산 확장자(png, jpg, ttf)를 그대로 받는다", () => {
    expect(loadConfig().resolver?.assetExts).toEqual(expect.arrayContaining(["png", "jpg", "ttf"]));
  });

  it("[spec] three는 늘 모듈판(three.module.js)으로 푼다", () => {
    const resolved = loadConfig().resolver?.resolveRequest?.({}, "three", "android");
    expect(resolved).toEqual({
      type: "sourceFile",
      filePath: join(MOBILE, "node_modules", "three", "build", "three.module.js")
    });
  });
});
