/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 103 마을 흩뿌림·흙길, 기능 변경, 모바일): 계절 흩뿌림 조각 자리(villageSeasonScatter)의 계절별 규칙.
// 기대값은 명세(private 작업 폴더 103-2026-11-18-마을-흩뿌림-흙길/01-main-spec.md "바뀌는 동작" 1)에서만 가져온다.
// 함수의 모양은 qa가 정했다(tests/__fixtures__/village-ground-103.ts 머리말, 02-qa-tests.md "부르는 방법"). 구현 전에는 함수가 없어 모두 실패한다(바뀔 동작).
// 101 풀 자국 자리 규칙(정해진 씨앗값, 빽빽한 정도, 길·건물 땅 위에 두지 않음, 방향·크기·밝기)은 101 테스트 M1~M4를 계절마다 부르게 고쳐 본다
// (lobby3d-village-decor.spec.test.ts). 이 파일은 계절마다 달라지는 것만 본다.
import { SCATTER_SEASONS, SEASON_KINDS, scatterModule } from "../__fixtures__/village-ground-103";

describe("[spec] 103 바뀔 동작: 계절 흩뿌림 조각 자리(명세 1)", () => {
  it("L1 겨울에는 조각이 없다(눈). 봄·여름·가을에는 조각이 있다", () => {
    const mod = scatterModule();
    expect(typeof mod.villageSeasonScatter).toBe("function");
    expect(mod.villageSeasonScatter("winter")).toEqual([]);
    for (const season of SCATTER_SEASONS) expect({ season, some: mod.villageSeasonScatter(season).length > 0 }).toEqual({ season, some: true });
  });

  it("L2 계절마다 그림 모음의 정해진 줄만 쓰고 그 줄의 조각을 모두 쓴다: 가을 1·2줄(칸 0~7, 8가지), 봄 3줄(8~11, 4가지), 여름 4줄(12~15, 4가지)", () => {
    const mod = scatterModule();
    for (const season of SCATTER_SEASONS) {
      const pieces = mod.villageSeasonScatter(season);
      const kinds = [...new Set(pieces.map((p) => p.kind))].sort((a, b) => a - b);
      expect({ season, kinds, integers: pieces.every((p) => Number.isInteger(p.kind)) }).toEqual({ season, kinds: SEASON_KINDS[season], integers: true });
    }
  });

  it("L3 조각 수는 가을이 가장 많고, 여름은 가을·봄보다 드물다(가을 > 봄 > 여름)", () => {
    const mod = scatterModule();
    const count = Object.fromEntries(SCATTER_SEASONS.map((s) => [s, mod.villageSeasonScatter(s).length])) as Record<(typeof SCATTER_SEASONS)[number], number>;
    expect({ count, autumnMost: count.autumn > count.spring && count.autumn > count.summer, summerFewest: count.summer < count.spring && count.summer < count.autumn }).toEqual({
      count,
      autumnMost: true,
      summerFewest: true
    });
  });
});
