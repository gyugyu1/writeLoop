/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 060 ①, 기능 변경: 모델만 바꿔 끼울 수 있게 + 걷기 속도).
// 기대값은 명세(private 작업 폴더 02-모델-교체-쉽게/01-main-spec.md 바뀌는 동작 3)에서만 가져온다.
// - 바뀔 동작: 기본 걷기 속도(LobbySim.settings.speed)가 2.6에서 3.2(칸/초)로 오른다.
// - 그대로 둘 동작: 돌아서는 빠르기 기본값 10(지금 동작), 걷기 클립 재생 속도 식 (3 + 3.2 × 속도) ÷ (2π/0.8).
import { characterClipState } from "@/lib/lobby3d/character-clips";
import { LobbySim, type PointerHit } from "@/lib/lobby3d/engine";

const NEW_SPEED = 3.2;

describe("[spec] 기본 걷기 속도(바뀔 동작)", () => {
  it("[spec] 새 LobbySim의 기본 걷는 속도는 3.2칸/초다", () => {
    expect(new LobbySim({ random: () => 0.5 }).settings.speed).toBe(NEW_SPEED);
  });

  it("[spec] 설정을 건드리지 않고 먼 곳을 톡 하면, 걷는 동안 빨라지다가 3.2칸/초에 닿고 그보다 빨라지지 않는다", () => {
    const sim = new LobbySim({ random: () => 0.5 }); // (4.2, 6.2)에서 시작
    const hit: PointerHit = { point: { x: 4.2, z: 10.5 }, mark: null, onCharacter: false };
    sim.pointerDown(hit, 100, 100, 0);
    expect(sim.pointerUp(50)).toBe("walk");
    let fastest = 0;
    for (let i = 1; i <= 40; i += 1) {
      sim.update(0.05, 50 + i * 50);
      fastest = Math.max(fastest, sim.snapshot(50 + i * 50).speed);
    }
    expect(fastest).toBeGreaterThan(NEW_SPEED - 0.05);
    expect(fastest).toBeLessThanOrEqual(NEW_SPEED + 1e-9);
  });
});

describe("[spec] 그대로 둘 동작", () => {
  it("[spec] 돌아서는 빠르기 기본값은 10이다", () => {
    expect(new LobbySim({ random: () => 0.5 }).settings.turn).toBe(10);
  });

  it("[spec] 새 기본 속도 3.2에서 걷기 클립은 다 섞이고(1), 재생 속도는 (3 + 3.2×3.2) ÷ (2π/0.8)이다", () => {
    const s = characterClipState({ speed: NEW_SPEED, action: null });
    expect(s.walkWeight).toBe(1);
    expect(s.idleWeight).toBe(0);
    expect(s.walkTimeScale).toBeCloseTo((3 + 3.2 * NEW_SPEED) / ((2 * Math.PI) / 0.8), 10);
  });
});
