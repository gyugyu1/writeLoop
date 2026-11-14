// [spec] qa 테스트(작업 060-09, 새 기능: 라룹이 방의 창문 빛과 시간대).
// 기대값은 시나리오(060-09의 02-qa-scenarios.md S1·S2, S5~S21, T1~T11, L1~L6)와 결정(03-main-decision.md: 스탠드는 새벽이 끝날 때
// 꺼지고 해 뜨는 순간에는 켜져 있음 → L7, 창문 빛은 바닥 앞끝 z = 11에서 자름 → T6b,
// 06-main-decision.md: 스탠드를 빼고 보이지 않는 천장 조명을 둠. 켜지고 꺼지는 때는 스탠드와 같음 → L1~L7의 대상이 천장 조명)에서만 가져온다.
// 구현 코드(daylight.ts)는 부르는 방법(함수 이름, 인자, 반환 모양)을 알려고만 읽었다.
// 날짜는 모두 폰 시간대의 시각(new Date(년, 월-1, 일, 시, 분))이다. 방위는 북 0°, 동 90°, 남 180°, 서 270°.
import {
  ambienceAt,
  dayPhaseWeights,
  daylightAt,
  seasonOf,
  sunPosition,
  windowLightPanes,
  type DayPhase,
  type SunPosition,
  type WindowLightPane,
  type WindowOpening
} from "@/lib/lobby3d/daylight";

const at = (month: number, day: number, hours: number, minutes = 0) => new Date(2026, month - 1, day, hours, minutes);
const PHASES: DayPhase[] = ["dawn", "day", "sunset", "dusk", "night"];

function mainPhase(date: Date): DayPhase {
  const weights = dayPhaseWeights(sunPosition(date));
  return PHASES.reduce((best, phase) => (weights[phase] > weights[best] ? phase : best), PHASES[0]);
}

function weightsAt(date: Date) {
  return dayPhaseWeights(sunPosition(date));
}

function minutesOfDay(month: number, day: number): Date[] {
  return Array.from({ length: 24 * 60 }, (_, index) => at(month, day, Math.floor(index / 60), index % 60));
}

/** 고도가 0°를 지나는 분(오르는 때, 내리는 때). 시나리오 S11의 "해 뜨는·지는 시각". */
function sunriseSunset(month: number, day: number): { rise: number; set: number } {
  let rise = NaN;
  let set = NaN;
  let prev = sunPosition(at(month, day, 0, 0)).elevation;
  for (let minute = 1; minute < 24 * 60; minute += 1) {
    const e = sunPosition(at(month, day, Math.floor(minute / 60), minute % 60)).elevation;
    if (prev < 0 && e >= 0) rise = minute;
    if (prev >= 0 && e < 0) set = minute;
    prev = e;
  }
  return { rise, set };
}

// ---------- 1. 계절 ----------

describe("[spec] 계절(S1, S2)", () => {
  it("S1: 각 달 15일 12:00의 계절은 봄 3~5월, 여름 6~8월, 가을 9~11월, 겨울 12~2월", () => {
    const expected = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    expect(Array.from({ length: 12 }, (_, index) => daylightAt(at(index + 1, 15, 12)).season)).toEqual(expected);
    expect(Array.from({ length: 12 }, (_, index) => seasonOf(index + 1))).toEqual(expected);
  });

  it("S2: 계절 경계의 앞뒤 1분", () => {
    const cases: [Date, string][] = [
      [at(2, 28, 23, 59), "winter"],
      [at(3, 1, 0, 0), "spring"],
      [at(5, 31, 23, 59), "spring"],
      [at(6, 1, 0, 0), "summer"],
      [at(8, 31, 23, 59), "summer"],
      [at(9, 1, 0, 0), "autumn"],
      [at(11, 30, 23, 59), "autumn"],
      [at(12, 1, 0, 0), "winter"]
    ];
    expect(cases.map(([date]) => daylightAt(date).season)).toEqual(cases.map(([, season]) => season));
  });
});

// ---------- 2. 해의 자리 ----------

describe("[spec] 해의 자리(S5~S12)", () => {
  it("S5: 2026-06-21 12:30은 고도 75.9°, 방위 180°(±1°)", () => {
    const sun = sunPosition(at(6, 21, 12, 30));
    expect(Math.abs(sun.elevation - 75.9)).toBeLessThanOrEqual(1);
    expect(Math.abs(sun.azimuth - 180)).toBeLessThanOrEqual(1);
  });

  it("S6: 2026-12-21 12:30은 고도 29.1°, 방위 180°(±1°)", () => {
    const sun = sunPosition(at(12, 21, 12, 30));
    expect(Math.abs(sun.elevation - 29.1)).toBeLessThanOrEqual(1);
    expect(Math.abs(sun.azimuth - 180)).toBeLessThanOrEqual(1);
  });

  it("S6a: 3월 20일·9월 23일 12:30은 고도 51.0°~53.0°, 방위 180°", () => {
    for (const date of [at(3, 20, 12, 30), at(9, 23, 12, 30)]) {
      const sun = sunPosition(date);
      expect(sun.elevation).toBeGreaterThanOrEqual(51);
      expect(sun.elevation).toBeLessThanOrEqual(53);
      expect(Math.abs(sun.azimuth - 180)).toBeLessThanOrEqual(1);
    }
  });

  it("S7: 남중은 12:30이다(2월 11일·11월 3일에도 방위 180° ± 0.5°). 12:00은 180° 미만", () => {
    for (const [month, day] of [[2, 11], [11, 3]]) {
      expect(Math.abs(sunPosition(at(month, day, 12, 30)).azimuth - 180)).toBeLessThanOrEqual(0.5);
      expect(sunPosition(at(month, day, 12, 0)).azimuth).toBeLessThan(180);
    }
  });

  it("S8: 3월 20일 09:30과 15:30은 고도 약 33.6°로 같고, 방위는 약 122°와 약 238°(합 360°)", () => {
    const morning = sunPosition(at(3, 20, 9, 30));
    const afternoon = sunPosition(at(3, 20, 15, 30));
    expect(Math.abs(morning.elevation - 33.6)).toBeLessThanOrEqual(1);
    expect(Math.abs(afternoon.elevation - 33.6)).toBeLessThanOrEqual(1);
    expect(Math.abs(morning.azimuth - 122)).toBeLessThanOrEqual(1);
    expect(Math.abs(afternoon.azimuth - 238)).toBeLessThanOrEqual(1);
    expect(Math.abs(morning.azimuth + afternoon.azimuth - 360)).toBeLessThanOrEqual(1);
    expect(morning.azimuth).toBeLessThan(180);
    expect(afternoon.azimuth).toBeGreaterThan(180);
  });

  it("S9: 12:30 − h와 12:30 + h(h = 1, 3, 5)는 고도가 같고 방위의 합이 360°(±0.1°)", () => {
    for (const [month, day] of [[1, 15], [3, 20], [6, 21], [10, 10], [12, 21]]) {
      for (const h of [1, 3, 5]) {
        const before = sunPosition(at(month, day, 12 - h, 30));
        const after = sunPosition(at(month, day, 12 + h, 30));
        expect(Math.abs(before.elevation - after.elevation)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(before.azimuth + after.azimuth - 360)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("S10: 6월 21일 00:00, 12월 21일 22:00은 고도 0° 미만", () => {
    expect(sunPosition(at(6, 21, 0, 0)).elevation).toBeLessThan(0);
    expect(sunPosition(at(12, 21, 22, 0)).elevation).toBeLessThan(0);
  });

  it("S11: 해 뜨고 지는 시각(±10분)과 낮의 길이(6월 21일 > 3월 20일 > 12월 21일)", () => {
    const hm = (h: number, m: number) => h * 60 + m;
    const cases: [number, number, number, number][] = [
      [3, 20, hm(6, 30), hm(18, 30)],
      [6, 21, hm(5, 12), hm(19, 48)],
      [12, 21, hm(7, 48), hm(17, 12)]
    ];
    const lengths: number[] = [];
    for (const [month, day, rise, set] of cases) {
      const found = sunriseSunset(month, day);
      expect(Math.abs(found.rise - rise)).toBeLessThanOrEqual(10);
      expect(Math.abs(found.set - set)).toBeLessThanOrEqual(10);
      lengths.push(found.set - found.rise);
    }
    const [march, june, december] = lengths;
    expect(june).toBeGreaterThan(march);
    expect(march).toBeGreaterThan(december);
  });

  it("S12: 6월 21일 07:00은 고도 약 19.7°·방위 약 75°(동쪽보다 북쪽), 18:00은 고도 약 19.7°·방위 약 285°", () => {
    const morning = sunPosition(at(6, 21, 7, 0));
    const evening = sunPosition(at(6, 21, 18, 0));
    expect(Math.abs(morning.elevation - 19.7)).toBeLessThanOrEqual(1);
    expect(Math.abs(morning.azimuth - 75)).toBeLessThanOrEqual(1);
    expect(morning.azimuth).toBeLessThan(90);
    expect(Math.abs(evening.elevation - 19.7)).toBeLessThanOrEqual(1);
    expect(Math.abs(evening.azimuth - 285)).toBeLessThanOrEqual(1);
    expect(evening.azimuth).toBeGreaterThan(270);
  });
});

// ---------- 3. 하루의 때 ----------

describe("[spec] 하루의 때와 섞는 비율(S13~S21)", () => {
  const DAYS: [number, number][] = [[3, 20], [6, 21], [12, 21]];

  it("S13: 매 분 다섯 비율이 0 이상 1 이하이고 합이 1", () => {
    for (const [month, day] of DAYS) {
      for (const date of minutesOfDay(month, day)) {
        const weights = weightsAt(date);
        let sum = 0;
        for (const phase of PHASES) {
          expect(weights[phase]).toBeGreaterThanOrEqual(0);
          expect(weights[phase]).toBeLessThanOrEqual(1);
          sum += weights[phase];
        }
        expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it("S14: 3월 20일 12:30, 09:00, 16:30은 낮 = 1", () => {
    for (const date of [at(3, 20, 12, 30), at(3, 20, 9, 0), at(3, 20, 16, 30)]) {
      expect(weightsAt(date).day).toBeCloseTo(1, 9);
    }
  });

  it("S15: 3월 20일 00:00, 03:00, 21:00은 밤 = 1", () => {
    for (const date of [at(3, 20, 0, 0), at(3, 20, 3, 0), at(3, 20, 21, 0)]) {
      expect(weightsAt(date).night).toBeCloseTo(1, 9);
    }
  });

  it("S16: 해 뜨는 때(약 06:30)는 새벽이 주된 때, 2시간 전(04:30)은 밤 = 1, 2시간 뒤(08:30)는 낮 = 1", () => {
    expect(mainPhase(at(3, 20, 6, 30))).toBe("dawn");
    expect(weightsAt(at(3, 20, 4, 30)).night).toBeCloseTo(1, 9);
    expect(weightsAt(at(3, 20, 8, 30)).day).toBeCloseTo(1, 9);
  });

  it("S17: 해 지기 20분 전(약 18:10)은 노을이 주된 때, 2시간 전(16:30)은 낮 = 1", () => {
    expect(mainPhase(at(3, 20, 18, 10))).toBe("sunset");
    expect(weightsAt(at(3, 20, 16, 30)).day).toBeCloseTo(1, 9);
  });

  it("S18: 해 진 20분 뒤(약 18:50)는 어스름이 주된 때, 90분 뒤(20:00)는 밤 = 1", () => {
    expect(mainPhase(at(3, 20, 18, 50))).toBe("dusk");
    expect(weightsAt(at(3, 20, 20, 0)).night).toBeCloseTo(1, 9);
  });

  it("S19: 하루 동안 주된 때는 밤 → 새벽 → 낮 → 노을 → 어스름 → 밤 차례로 바뀐다", () => {
    for (const [month, day] of DAYS) {
      const order: DayPhase[] = [];
      for (const date of minutesOfDay(month, day)) {
        const phase = mainPhase(date);
        if (order[order.length - 1] !== phase) order.push(phase);
      }
      expect(order).toEqual(["night", "dawn", "day", "sunset", "dusk", "night"]);
    }
  });

  it("S20: 경계마다 두 때가 함께 0과 1 사이인 분이 있고, 이웃한 두 분 사이에 어떤 비율도 0.5 넘게 바뀌지 않는다", () => {
    const pairs: [DayPhase, DayPhase][] = [["dawn", "day"], ["day", "sunset"], ["sunset", "dusk"], ["dusk", "night"]];
    for (const [month, day] of DAYS) {
      const all = minutesOfDay(month, day).map(weightsAt);
      for (const [a, b] of pairs) {
        const mixed = all.some((w) => w[a] > 0 && w[a] < 1 && w[b] > 0 && w[b] < 1);
        expect({ pair: `${a}-${b}`, mixed }).toEqual({ pair: `${a}-${b}`, mixed: true });
      }
      let biggest = 0;
      for (let index = 1; index < all.length; index += 1) {
        for (const phase of PHASES) biggest = Math.max(biggest, Math.abs(all[index][phase] - all[index - 1][phase]));
      }
      expect(biggest).toBeLessThanOrEqual(0.5);
    }
  });

  it("S21: 같은 시각도 여름(6월 21일)과 겨울(12월 21일)은 때가 다르다", () => {
    expect(mainPhase(at(6, 21, 19, 25))).toBe("sunset");
    expect(weightsAt(at(12, 21, 19, 25)).night).toBeCloseTo(1, 9);
    expect(weightsAt(at(6, 21, 16, 50)).day).toBeCloseTo(1, 9);
    expect(mainPhase(at(12, 21, 16, 50))).toBe("sunset");
    expect(mainPhase(at(6, 21, 5, 12))).toBe("dawn");
    expect(weightsAt(at(12, 21, 5, 12)).night).toBeCloseTo(1, 9);
    expect(weightsAt(at(6, 21, 7, 48)).day).toBeCloseTo(1, 9);
    expect(mainPhase(at(12, 21, 7, 48))).toBe("dawn");
  });
});

// ---------- 4. 창문 빛 ----------

// 시험용 창: 창 면 z = 0, 창 안쪽 x 3.8~5.8, 높이 y 1.2~2.8, 가운데 창살 x = 4.8, 가로 창살 y = 2.0, 창살 두께 0.
const TEST_WINDOW: WindowOpening = { x: 4.8, y: 2.0, z: 0, width: 2.0, height: 1.6, bar: 0 };
const FLOOR_W = 8;
const FLOOR_D = 11;
const TOL = 0.01;

type P = { x: number; z: number };

/** 시나리오의 식: 창 면의 점 (x, y)를 지난 햇빛이 바닥에 닿는 점. */
function project(x: number, y: number, sun: SunPosition, windowZ = 0): P {
  const a = (sun.elevation * Math.PI) / 180;
  const A = (sun.azimuth * Math.PI) / 180;
  return { x: x + (y * Math.sin(A)) / Math.tan(a), z: windowZ + (y * -Math.cos(A)) / Math.tan(a) };
}

/** 창의 네 칸(창살 두께 0)의 창 면 사각형 [x0, x1, y0, y1]. */
function windowPanes(opening: WindowOpening): [number, number, number, number][] {
  const left = opening.x - opening.width / 2;
  const right = opening.x + opening.width / 2;
  const bottom = opening.y - opening.height / 2;
  const top = opening.y + opening.height / 2;
  return [
    [left, opening.x, bottom, opening.y],
    [opening.x, right, bottom, opening.y],
    [left, opening.x, opening.y, top],
    [opening.x, right, opening.y, top]
  ];
}

function expectedQuad([x0, x1, y0, y1]: [number, number, number, number], sun: SunPosition, windowZ = 0): P[] {
  return [project(x0, y0, sun, windowZ), project(x1, y0, sun, windowZ), project(x1, y1, sun, windowZ), project(x0, y1, sun, windowZ)];
}

const near = (a: P, b: P, tol = TOL) => Math.abs(a.x - b.x) <= tol && Math.abs(a.z - b.z) <= tol;

/** 꼭짓점 목록이 순서와 관계없이 같은지(±TOL). 같은 자리의 꼭짓점이 겹쳐 있으면 하나로 본다. */
function sameVertexSet(actual: P[], expected: P[]) {
  return expected.every((e) => actual.some((a) => near(a, e))) && actual.every((a) => expected.some((e) => near(a, e)));
}

function unclippedQuad(pane: WindowLightPane): P[] {
  const { origin: o, u, v } = pane;
  return [o, { x: o.x + u.x, z: o.z + u.z }, { x: o.x + u.x + v.x, z: o.z + u.z + v.z }, { x: o.x + v.x, z: o.z + v.z }];
}

function allPoints(panes: WindowLightPane[]): P[] {
  return panes.flatMap((pane) => pane.points);
}

/** 자르지 않은 네 칸이 시나리오 식의 바닥 사각형과 같은지. */
function expectFourFullPanes(panes: WindowLightPane[], sun: SunPosition, opening: WindowOpening = TEST_WINDOW) {
  expect(panes).toHaveLength(4);
  for (const rect of windowPanes(opening)) {
    const quad = expectedQuad(rect, sun, opening.z);
    const matched = panes.filter((pane) => sameVertexSet(pane.points, quad));
    expect({ rect, matched: matched.length }).toEqual({ rect, matched: 1 });
  }
}

function hasPoint(points: P[], target: P) {
  return points.some((p) => near(p, target));
}

describe("[spec] 창문 빛이 바닥에 닿는 모양(T1~T11)", () => {
  it("T1: 고도 45°·방위 180°는 네 칸이 창 바로 앞 x 3.8~5.8, z 1.2~2.8에 비친다", () => {
    const sun = { elevation: 45, azimuth: 180 };
    const panes = windowLightPanes(sun, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expectFourFullPanes(panes, sun);
    const points = allPoints(panes);
    for (const corner of [{ x: 3.8, z: 1.2 }, { x: 5.8, z: 1.2 }, { x: 5.8, z: 2.8 }, { x: 3.8, z: 2.8 }, { x: 4.8, z: 2.0 }]) {
      expect({ corner, found: hasPoint(points, corner) }).toEqual({ corner, found: true });
    }
    expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(3.8, 2);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(5.8, 2);
    expect(Math.min(...points.map((p) => p.z))).toBeCloseTo(1.2, 2);
    expect(Math.max(...points.map((p) => p.z))).toBeCloseTo(2.8, 2);
  });

  it("T2: 아침(고도 45°·방위 135°)에는 창보다 +x 쪽으로 비스듬히 비친다", () => {
    const sun = { elevation: 45, azimuth: 135 };
    const panes = windowLightPanes(sun, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expectFourFullPanes(panes, sun);
    const points = allPoints(panes);
    for (const corner of [{ x: 4.65, z: 0.85 }, { x: 6.65, z: 0.85 }, { x: 7.78, z: 1.98 }, { x: 5.78, z: 1.98 }, { x: 6.21, z: 1.41 }]) {
      expect({ corner, found: hasPoint(points, corner) }).toEqual({ corner, found: true });
    }
  });

  it("T3: 저녁(고도 45°·방위 225°)에는 반대쪽(−x)으로 비스듬히 비친다", () => {
    const sun = { elevation: 45, azimuth: 225 };
    const panes = windowLightPanes(sun, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expectFourFullPanes(panes, sun);
    const points = allPoints(panes);
    for (const corner of [{ x: 2.95, z: 0.85 }, { x: 4.95, z: 0.85 }, { x: 3.82, z: 1.98 }, { x: 1.82, z: 1.98 }, { x: 3.39, z: 1.41 }]) {
      expect({ corner, found: hasPoint(points, corner) }).toEqual({ corner, found: true });
    }
  });

  it("T4·T5: 해가 높으면(76°) z 0.30~0.70으로 짧고, 낮으면(29°) z 2.16~5.05로 안쪽까지 길다", () => {
    const high = { elevation: 76, azimuth: 180 };
    const low = { elevation: 29, azimuth: 180 };
    const highPanes = windowLightPanes(high, TEST_WINDOW, FLOOR_W, FLOOR_D);
    const lowPanes = windowLightPanes(low, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expectFourFullPanes(highPanes, high);
    expectFourFullPanes(lowPanes, low);
    const zs = (panes: WindowLightPane[]) => allPoints(panes).map((p) => p.z);
    const xs = (panes: WindowLightPane[]) => allPoints(panes).map((p) => p.x);
    expect(Math.abs(Math.min(...zs(highPanes)) - 0.3)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(Math.max(...zs(highPanes)) - 0.7)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(Math.min(...zs(lowPanes)) - 2.16)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(Math.max(...zs(lowPanes)) - 5.05)).toBeLessThanOrEqual(TOL);
    for (const panes of [highPanes, lowPanes]) {
      expect(Math.abs(Math.min(...xs(panes)) - 3.8)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(Math.max(...xs(panes)) - 5.8)).toBeLessThanOrEqual(TOL);
    }
  });

  it("T6: 고도 20°·방위 120°는 위 두 칸이 방 밖이라 없고, 아래 두 칸은 x = 8에서 잘린다", () => {
    const sun = { elevation: 20, azimuth: 120 };
    const panes = windowLightPanes(sun, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expect(panes).toHaveLength(2);
    const [lowerLeft, lowerRight] = windowPanes(TEST_WINDOW);
    const lowerLeftQuad = expectedQuad(lowerLeft, sun);
    const lowerRightQuad = expectedQuad(lowerRight, sun);
    expect(panes.filter((pane) => sameVertexSet(unclippedQuad(pane), lowerLeftQuad))).toHaveLength(1);
    expect(panes.filter((pane) => sameVertexSet(unclippedQuad(pane), lowerRightQuad))).toHaveLength(1);
    // 자르기 전 바깥 꼭짓점 중 아래쪽 둘
    expect(hasPoint(lowerLeftQuad, { x: 6.66, z: 1.65 })).toBe(true);
    expect(hasPoint(lowerRightQuad, { x: 8.66, z: 1.65 })).toBe(true);
    const points = allPoints(panes);
    for (const p of points) {
      expect(p.x).toBeLessThanOrEqual(8 + 1e-9);
      expect(p.z).toBeGreaterThanOrEqual(-1e-9);
      expect(p.z).toBeLessThanOrEqual(11 + 1e-9);
    }
    expect(points.some((p) => Math.abs(p.x - 8) <= 1e-6)).toBe(true);
  });

  it("T6a: 고도 20°·방위 240°는 x = 0에서 잘리고, 위 두 칸도 x 0~1.04에 조금 남는다", () => {
    const sun = { elevation: 20, azimuth: 240 };
    const panes = windowLightPanes(sun, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expect(panes).toHaveLength(4);
    for (const rect of windowPanes(TEST_WINDOW)) {
      const quad = expectedQuad(rect, sun);
      expect(panes.filter((pane) => sameVertexSet(unclippedQuad(pane), quad))).toHaveLength(1);
    }
    const whole = expectedQuad([3.8, 5.8, 1.2, 2.8], sun);
    for (const corner of [{ x: 0.94, z: 1.65 }, { x: 2.94, z: 1.65 }, { x: -0.86, z: 3.85 }, { x: -2.86, z: 3.85 }]) {
      expect({ corner, found: hasPoint(whole, corner) }).toEqual({ corner, found: true });
    }
    const points = allPoints(panes);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.z).toBeGreaterThanOrEqual(-1e-9);
      expect(p.z).toBeLessThanOrEqual(11 + 1e-9);
    }
    expect(points.some((p) => Math.abs(p.x) <= 1e-6)).toBe(true);
    expect(Math.max(...points.map((p) => p.x))).toBeLessThanOrEqual(2.94 + TOL);
  });

  it("T6b: 고도 10°·방위 180°는 바닥 앞끝 z = 11에서 잘린다(03 결정). 아래 두 칸은 z 6.81~11, 위 두 칸은 없음", () => {
    const sun = { elevation: 10, azimuth: 180 };
    const panes = windowLightPanes(sun, TEST_WINDOW, FLOOR_W, FLOOR_D);
    expect(panes).toHaveLength(2);
    const [lowerLeft, lowerRight] = windowPanes(TEST_WINDOW);
    expect(panes.filter((pane) => sameVertexSet(unclippedQuad(pane), expectedQuad(lowerLeft, sun)))).toHaveLength(1);
    expect(panes.filter((pane) => sameVertexSet(unclippedQuad(pane), expectedQuad(lowerRight, sun)))).toHaveLength(1);
    const points = allPoints(panes);
    for (const p of points) {
      expect(p.z).toBeLessThanOrEqual(11 + 1e-9);
      expect(p.x).toBeGreaterThanOrEqual(3.8 - TOL);
      expect(p.x).toBeLessThanOrEqual(5.8 + TOL);
    }
    expect(points.some((p) => Math.abs(p.z - 11) <= 1e-6)).toBe(true);
    expect(Math.abs(Math.min(...points.map((p) => p.z)) - 6.81)).toBeLessThanOrEqual(TOL);
  });

  it("T7: 창을 키우면(x 3.3~6.3, y 1.0~3.0) 같은 해(45°, 180°)에서 창문 빛도 그만큼 넓고 길다", () => {
    const sun = { elevation: 45, azimuth: 180 };
    const bigger: WindowOpening = { x: 4.8, y: 2.0, z: 0, width: 3.0, height: 2.0, bar: 0 };
    const panes = windowLightPanes(sun, bigger, FLOOR_W, FLOOR_D);
    expectFourFullPanes(panes, sun, bigger);
    const points = allPoints(panes);
    for (const corner of [{ x: 3.3, z: 1.0 }, { x: 6.3, z: 1.0 }, { x: 6.3, z: 3.0 }, { x: 3.3, z: 3.0 }]) {
      expect({ corner, found: hasPoint(points, corner) }).toEqual({ corner, found: true });
    }
  });

  it("T8: 6월 21일 07:00과 18:00(해가 북쪽 하늘)은 비치지 않는다", () => {
    expect(windowLightPanes(sunPosition(at(6, 21, 7, 0)), TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
    expect(windowLightPanes(sunPosition(at(6, 21, 18, 0)), TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
  });

  it("T8a: 해가 정동(90°)·정서(270°)에 있으면(고도 30°) 비치지 않는다", () => {
    expect(windowLightPanes({ elevation: 30, azimuth: 90 }, TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
    expect(windowLightPanes({ elevation: 30, azimuth: 270 }, TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
  });

  it("T9: 밤(고도 0° 이하)이면 비치지 않는다", () => {
    expect(windowLightPanes(sunPosition(at(6, 21, 0, 0)), TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
    expect(windowLightPanes({ elevation: -5, azimuth: 180 }, TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
    expect(windowLightPanes({ elevation: 0, azimuth: 180 }, TEST_WINDOW, FLOOR_W, FLOOR_D)).toEqual([]);
  });

  it("T10: 6월 21일 12:30은 z 약 0.30~0.70, 12월 21일 12:30은 z 약 2.16~5.05(±0.1)", () => {
    const summer = allPoints(windowLightPanes(sunPosition(at(6, 21, 12, 30)), TEST_WINDOW, FLOOR_W, FLOOR_D));
    const winter = allPoints(windowLightPanes(sunPosition(at(12, 21, 12, 30)), TEST_WINDOW, FLOOR_W, FLOOR_D));
    expect(summer.length).toBeGreaterThan(0);
    expect(winter.length).toBeGreaterThan(0);
    const zs = (points: P[]) => points.map((p) => p.z);
    expect(Math.abs(Math.min(...zs(summer)) - 0.3)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(Math.max(...zs(summer)) - 0.7)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(Math.min(...zs(winter)) - 2.16)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(Math.max(...zs(winter)) - 5.05)).toBeLessThanOrEqual(0.1);
    expect(Math.max(...zs(winter)) - Math.min(...zs(winter))).toBeGreaterThan(Math.max(...zs(summer)) - Math.min(...zs(summer)));
  });

  it("T11: 방위 180°에서 해가 낮을수록 창문 빛이 옅다(세기 10° < 30° < 60°)", () => {
    const strength = (elevation: number) => ambienceAt({ elevation, azimuth: 180 }).windowStrength;
    expect(strength(10)).toBeLessThan(strength(30));
    expect(strength(30)).toBeLessThan(strength(60));
  });
});

// ---------- 5. 천장 조명(06 결정: 스탠드 대신. 켜지고 꺼지는 때는 같다) ----------

describe("[spec] 천장 조명 켜짐(L1~L7, 06 결정)", () => {
  it("L1: 3월 20일 00:00, 21:00은 켜짐", () => {
    expect(daylightAt(at(3, 20, 0, 0)).ceilingLight).toBe(true);
    expect(daylightAt(at(3, 20, 21, 0)).ceilingLight).toBe(true);
  });

  it("L2: 3월 20일 12:30, 해 뜬 2시간 뒤(08:30)는 꺼짐", () => {
    expect(daylightAt(at(3, 20, 12, 30)).ceilingLight).toBe(false);
    expect(daylightAt(at(3, 20, 8, 30)).ceilingLight).toBe(false);
  });

  it("L3: 3월 20일 해 지기 20분 전(18:10, 노을)은 꺼짐", () => {
    expect(daylightAt(at(3, 20, 18, 10)).ceilingLight).toBe(false);
  });

  it("L4: 3월 20일 해 진 20분 뒤(18:50, 어스름)는 켜짐", () => {
    expect(daylightAt(at(3, 20, 18, 50)).ceilingLight).toBe(true);
  });

  it("L5: 3월 20일 해 뜨기 2시간 전(04:30)은 켜짐", () => {
    expect(daylightAt(at(3, 20, 4, 30)).ceilingLight).toBe(true);
  });

  it("L6: 19:25에 6월 21일(노을)은 꺼짐, 12월 21일(밤)은 켜짐", () => {
    expect(daylightAt(at(6, 21, 19, 25)).ceilingLight).toBe(false);
    expect(daylightAt(at(12, 21, 19, 25)).ceilingLight).toBe(true);
  });

  it("L7(03 결정): 해 뜨는 순간에는 아직 켜져 있고, 새벽이 끝난 뒤(해 뜨고 45분, 3월 20일 07:16)는 꺼짐", () => {
    const { rise } = sunriseSunset(3, 20);
    expect(daylightAt(at(3, 20, Math.floor(rise / 60), rise % 60)).ceilingLight).toBe(true);
    expect(daylightAt(at(3, 20, 7, 16)).ceilingLight).toBe(false);
  });
});
