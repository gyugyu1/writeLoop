/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 121 마을 걷기 프레임 끊김, 버그 수정, 모바일): 그대로 둘 동작.
// 명세(private 작업 폴더 121-2026-11-19-마을-걷기-프레임-끊김/01-main-spec.md) 기대 동작 3: 길 찾기(findPath)와 설 자리 고르기
// (nearestOpenSpot, nearestReachableSpot)는 시간만 줄이고 결과(꺾이는 점들, 고른 칸)는 지금(63645d9)과 같다.
// 기대값은 고치기 전 코드로 돌려 얻은 값을 그대로 적었다(좋고 나쁨과 관계없다). 같은 거리의 칸이 여럿인 점(칸 모서리)도 넣어 순서를 지킨다.
// 고치기 전에도 뒤에도 통과해야 한다.
import { applyArea, findPath, MARKS, nearestOpenSpot, nearestReachableSpot, VILLAGE_MARKS } from "@/lib/lobby3d/engine";

const HOME = { x: 35.5, z: 12.9 };
const FURNITURE_DOOR = { x: 13, z: 31.9 };

describe("마을", () => {
  beforeAll(() => applyArea("village"));
  afterAll(() => applyArea("room"));

  test("P1 집에서 세 건물 문 앞까지 길의 꺾이는 점들", () => {
    expect(findPath(HOME, VILLAGE_MARKS.home.approach)).toEqual([{ x: 35.5, z: 12.9 }]);
    expect(findPath(HOME, VILLAGE_MARKS.furnitureShop.approach)).toEqual([
      { x: 24.5, z: 24.5 },
      { x: 14.5, z: 31.5 },
      { x: 13, z: 31.9 }
    ]);
    expect(findPath(HOME, VILLAGE_MARKS.clothingShop.approach)).toEqual([
      { x: 40.5, z: 17.5 },
      { x: 43.5, z: 22.5 },
      { x: 49.2, z: 22.9 }
    ]);
  });

  test("P2 가구점에서 옷집까지, 여러 목표 중 가장 가까운 곳, 제자리, 갈 수 없는 목표", () => {
    // 127(마을 노점 없애기, 03-main-decision.md): 노점이 있던 자리(x 26.5~28.5·z 28.5~30.5, x 42.5~44.5·z 28.5~30.5)가 열려 길이 더 곧아진다.
    // 새 값은 노점 칸을 비운 배치(stalls: [])로 길찾기를 돌려 얻었다(노점이 아직 있으면 이 단언은 실패한다).
    expect(findPath(FURNITURE_DOOR, VILLAGE_MARKS.clothingShop.approach)).toEqual([
      { x: 48.5, z: 23.5 },
      { x: 49.2, z: 22.9 }
    ]);
    expect(findPath(HOME, [{ x: 1.5, z: 1.5 }, { x: 20.5, z: 40.5 }, { x: 60.5, z: 50.5 }])).toEqual([
      { x: 30.5, z: 17.5 },
      { x: 20.5, z: 40.5 }
    ]);
    expect(findPath(HOME, [HOME])).toEqual([{ x: 35.5, z: 12.9 }]);
    expect(findPath(HOME, [{ x: 0.2, z: 0.2 }])).toBeNull();
  });

  test("P3 걸어갈 수 없는 곳을 눌렀을 때 설 자리(칸 모서리처럼 거리가 같은 칸이 여럿인 점 포함): nearestOpenSpot", () => {
    expect(nearestOpenSpot({ x: 0.5, z: 0.5 })).toEqual({ x: 9.5, z: 9.5 });
    expect(nearestOpenSpot({ x: 35, z: 12 })).toEqual({ x: 34.5, z: 12.5 });
    expect(nearestOpenSpot({ x: 13, z: 25 })).toEqual({ x: 12.5, z: 24.5 });
    expect(nearestOpenSpot({ x: 49, z: 20 })).toEqual({ x: 50.5, z: 19.5 });
    expect(nearestOpenSpot({ x: 69.5, z: 59.5 })).toEqual({ x: 50.5, z: 40.5 });
    expect(nearestOpenSpot({ x: 30, z: 30 })).toEqual({ x: 29.5, z: 29.5 });
  });

  test("P4 눌린 점에서 가장 가까운 걸어갈 수 있는 칸: nearestReachableSpot(집 문 앞에서, 가구점 문 앞에서)", () => {
    const cases: [{ x: number; z: number }, { x: number; z: number }][] = [
      [{ x: 0.5, z: 0.5 }, { x: 9.5, z: 9.5 }],
      [{ x: 35, z: 12 }, { x: 34.5, z: 12.5 }],
      [{ x: 13, z: 25 }, { x: 12.5, z: 24.5 }],
      [{ x: 49, z: 20 }, { x: 50.5, z: 19.5 }],
      [{ x: 69.5, z: 59.5 }, { x: 50.5, z: 40.5 }],
      [{ x: 30, z: 30 }, { x: 29.5, z: 29.5 }]
    ];
    for (const [point, expected] of cases) {
      expect(nearestReachableSpot(HOME, point)).toEqual(expected);
      expect(nearestReachableSpot(FURNITURE_DOOR, point)).toEqual(expected);
    }
  });
});

describe("방", () => {
  beforeAll(() => applyArea("room"));

  test("P5 방 장소까지 길과 설 자리", () => {
    const from = { x: 4, z: 6 };
    expect(findPath(from, MARKS.board.approach)).toEqual([{ x: 2.2, z: 1.3 }]);
    expect(findPath(from, MARKS.window.approach)).toEqual([{ x: 4.5, z: 1.55 }]);
    expect(findPath(from, MARKS.desk.approach)).toEqual([{ x: 2.5, z: 6.5 }, { x: 1.5, z: 6.75 }]);
    expect(findPath(from, MARKS.door.approach)).toEqual([{ x: 4, z: 10.5 }]);
    expect(findPath(from, MARKS.bookcase.approach)).toEqual([{ x: 2.5, z: 3.5 }, { x: 1.4, z: 2.5 }]);
    expect(findPath(MARKS.door.approach[0], MARKS.board.approach)).toEqual([{ x: 3.5, z: 2.5 }, { x: 2.2, z: 1.3 }]);
    expect(nearestOpenSpot({ x: 0.5, z: 0.5 })).toEqual({ x: 1.5, z: 1.5 });
    expect(nearestOpenSpot({ x: 4, z: 6 })).toEqual({ x: 3.5, z: 5.5 });
    expect(nearestOpenSpot({ x: 2, z: 2 })).toEqual({ x: 1.5, z: 1.5 });
    expect(nearestOpenSpot({ x: 7.9, z: 11.9 })).toEqual({ x: 6.5, z: 10.5 });
  });
});
