// [spec] qa 테스트(작업 060-10, 새 기능: 로비에서 오래 두면 앉기).
// 기대값은 시나리오(060-10의 02-qa-scenarios.md K1~K10)와 결정(04-main-decision.md M7: 앉은 채 끌면 일어난 뒤 끌기를 이어서 한다)에서만
// 가져온다. 구현 코드는 부르는 방법(LobbySim의 update·pointerDown/Up/Move, 앉기 자세 posture, 클립을 고르는 characterClipState)을 알려고만 읽었다.
// "앉아 있다" = 라이트루프가 sit_down 또는 sit_idle 클립을 하고 있음, "일어난다" = stand_up 클립. 클립 이름은 모델 규격 문서의 이름이다.
// 프레임은 0.05초씩, 시각(밀리초)도 같이 진행한다.
import { characterClipState } from "@/lib/lobby3d/character-clips";
import { LobbySim, MARKS, type PointerHit } from "@/lib/lobby3d/engine";

const STEP = 0.05;
const BOARD_PROMPT = "오늘의 질문 게시판이야.\n질문에 답하러 갈까?";

let now = 1_000_000;

function run(sim: LobbySim, seconds: number) {
  const count = Math.round(seconds / STEP);
  for (let i = 0; i < count; i += 1) {
    now += STEP * 1000;
    sim.update(STEP, now);
  }
}

/** 지금 재생하는 동작 클립(앉기 자세가 있으면 그 클립). */
function clip(sim: LobbySim) {
  return characterClipState({ speed: Math.hypot(sim.vx, sim.vz), action: sim.action, posture: sim.posture }).actionClip;
}

function isSitting(sim: LobbySim) {
  const c = clip(sim);
  return c === "sit_down" || c === "sit_idle";
}

function floor(x: number, z: number): PointerHit {
  return { point: { x, z }, mark: null, onCharacter: false };
}

function tap(sim: LobbySim, hit: PointerHit) {
  sim.pointerDown(hit, 100, 100, now);
  return sim.pointerUp(now);
}

/** 처음 앉기 시작하는 프레임까지 진행하고, 앉기까지 걸린 시간(초)을 돌려준다. */
function runUntilSitting(sim: LobbySim, maxSeconds: number) {
  const start = now;
  while (!isSitting(sim) && now - start < maxSeconds * 1000) run(sim, STEP);
  return (now - start) / 1000;
}

function sitDown(sim: LobbySim) {
  run(sim, 21);
  run(sim, 2);
  expect(isSitting(sim)).toBe(true);
}

function runUntil(sim: LobbySim, maxSeconds: number, done: () => boolean) {
  const start = now;
  while (!done() && now - start < maxSeconds * 1000) run(sim, STEP);
  return done();
}

beforeEach(() => {
  now = 1_000_000;
});

describe("[spec] 오래 두면 앉기(K1~K5)", () => {
  it("K1: 아무것도 하지 않으면 19초에는 서 있고 21초에는 앉아 있다. 처음은 sit_down, 그 뒤 sit_idle", () => {
    const sim = new LobbySim();
    run(sim, 19);
    expect(isSitting(sim)).toBe(false);

    runUntilSitting(sim, 2);
    expect(clip(sim)).toBe("sit_down");
    run(sim, 2);
    expect(clip(sim)).toBe("sit_idle");
  });

  it("K2: 동작(wave)이 끝난 뒤부터 센다: 끝난 뒤 19초에는 서 있고 21초에는 앉아 있다", () => {
    const sim = new LobbySim();
    expect(sim.startAction("wave")).toBe(true);
    expect(runUntil(sim, 3, () => sim.action === null)).toBe(true);

    run(sim, 19);
    expect(isSitting(sim)).toBe(false);
    run(sim, 2);
    expect(isSitting(sim)).toBe(true);
  });

  it("K3: 걷기가 멈춘 뒤부터 센다: 멈춘 뒤 19초에는 서 있고 21초에는 앉아 있다", () => {
    const sim = new LobbySim();
    expect(tap(sim, floor(4.5, 9.5))).toBe("walk");
    expect(
      runUntil(sim, 10, () => Math.abs(sim.x - 4.5) < 1e-6 && Math.abs(sim.z - 9.5) < 1e-6 && sim.vx === 0 && sim.vz === 0)
    ).toBe(true);

    run(sim, 19);
    expect(isSitting(sim)).toBe(false);
    run(sim, 2);
    expect(isSitting(sim)).toBe(true);
  });

  it("K4: 갈 수 없는 곳을 눌러도(움직이지 않아도) 누른 때부터 다시 센다", () => {
    const sim = new LobbySim();
    run(sim, 15);
    const before = { x: sim.x, z: sim.z };
    // 일기 책상 칸(1,5)은 가구가 있어 갈 수 없다
    tap(sim, floor(1.5, 5.5));
    run(sim, 0.5);
    expect({ x: sim.x, z: sim.z }).toEqual(before);

    run(sim, 14.5);
    expect(isSitting(sim)).toBe(false);
    run(sim, 6);
    expect(isSitting(sim)).toBe(true);
  });

  it("K5: 앉은 뒤 누르지 않으면 30초가 더 지나도 sit_idle 그대로이고 일어나지 않으며 위치도 그대로다", () => {
    const sim = new LobbySim();
    sitDown(sim);
    const before = { x: sim.x, z: sim.z };

    for (let i = 0; i < 30; i += 1) {
      run(sim, 1);
      expect(clip(sim)).toBe("sit_idle");
    }
    expect({ x: sim.x, z: sim.z }).toEqual(before);
  });
});

describe("[spec] 누르거나 움직이게 하면 일어나 하려던 일을 이어서(K6~K10, 결정 M7)", () => {
  it("K6: 앉은 채 바닥을 누르면 먼저 stand_up(위치 그대로), 그 뒤 5초 안에 그 점에 도착한다", () => {
    const sim = new LobbySim();
    sitDown(sim);
    const before = { x: sim.x, z: sim.z };

    tap(sim, floor(4.5, 9.5));
    run(sim, 0.2);
    expect(clip(sim)).toBe("stand_up");
    expect({ x: sim.x, z: sim.z }).toEqual(before);

    run(sim, 5);
    expect(sim.x).toBeCloseTo(4.5, 6);
    expect(sim.z).toBeCloseTo(9.5, 6);
  });

  it("K7: 앉은 채 게시판을 누르면 stand_up(위치 그대로) 뒤 게시판에 도착하고 게시판 안내와 들어가기 버튼이 나온다", () => {
    const sim = new LobbySim();
    sitDown(sim);
    const before = { x: sim.x, z: sim.z };

    tap(sim, { point: null, mark: "board", onCharacter: false });
    run(sim, 0.2);
    expect(clip(sim)).toBe("stand_up");
    expect({ x: sim.x, z: sim.z }).toEqual(before);

    expect(runUntil(sim, 10, () => sim.arrived === "board")).toBe(true);
    run(sim, 0.5);
    const snap = sim.snapshot(now);
    expect(snap.arrived).toBe("board");
    expect(snap.bubbleText).toBe(BOARD_PROMPT);
    expect(snap.bubbleText).toBe(MARKS.board.prompt);
    expect(snap.bubbleButton).toBe("들어가기");
  });

  it("K8: 앉은 채 라이트루프를 누르면 먼저 stand_up, 일어난 뒤 poke 동작과 '헤헤, 간지러워!'가 나온다", () => {
    const sim = new LobbySim();
    sitDown(sim);

    tap(sim, { point: null, mark: null, onCharacter: true });
    run(sim, STEP);
    expect(clip(sim)).toBe("stand_up");

    let pokedAfterStanding = false;
    const start = now;
    while (now - start < 3000 && !pokedAfterStanding) {
      run(sim, STEP);
      const snap = sim.snapshot(now);
      if (clip(sim) === "poke" && snap.action?.type === "poke" && snap.bubbleText === "헤헤, 간지러워!") pokedAfterStanding = true;
    }
    expect(pokedAfterStanding).toBe(true);
  });

  it("K9·M7: 앉은 채 누른 손을 12px 넘게 끌면 stand_up을 하고, 일어난 뒤 끄는 곳으로 따라간다", () => {
    const sim = new LobbySim();
    sitDown(sim);
    const start = { x: sim.x, z: sim.z };

    sim.pointerDown(floor(start.x, start.z), 100, 100, now);
    sim.pointerMove(floor(start.x, 9.0), 100, 140);
    run(sim, 0.1);
    expect(clip(sim)).toBe("stand_up");
    expect({ x: sim.x, z: sim.z }).toEqual(start);

    run(sim, 3);
    expect(sim.dragging).toBe(true);
    expect(sim.z).toBeGreaterThan(8.5);
    sim.pointerUp(now);
  });

  it("K10: 동작 줄이기가 켜져 있어도 21초에 앉고, 바닥을 누르면 stand_up 뒤 그 점에 도착한다", () => {
    const sim = new LobbySim({ reduceMotion: true });
    run(sim, 21);
    expect(isSitting(sim)).toBe(true);

    tap(sim, floor(4.5, 9.5));
    run(sim, 0.2);
    expect(clip(sim)).toBe("stand_up");
    run(sim, 5);
    expect(sim.x).toBeCloseTo(4.5, 6);
    expect(sim.z).toBeCloseTo(9.5, 6);
  });
});
