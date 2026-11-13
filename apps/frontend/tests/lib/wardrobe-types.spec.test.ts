/**
 * @vitest-environment node
 */
// [spec] qa 테스트(작업 089 ② 착용 아이템 목록과 저장, 새 기능, 웹 타입): 웹 apps/frontend/lib/types.ts의 옷장 응답 타입(T2·T3).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/04-아이템-목록과-저장/03-qa-scenarios.md T2·T3)에서만 가져온다.
// 구현 커밋 e98ad44에서 읽은 것은 타입 이름뿐이다(Wardrobe, WardrobeSlot).
// 타입 확인은 웹 빌드의 타입 검사(Next.js, tsconfig가 tests/도 포함)가 한다. 아래 상수가 컴파일되는 것이 단언이다(Vitest는 타입을 보지 않는다).
import { describe, expect, it } from "vitest";
import type { Wardrobe, WardrobeSlot } from "../../lib/types";

// T2: 명세 JSON 예
const R1: Wardrobe = {
  items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" }],
  equipped: { hat: "capOrange", top: null, bottom: null, shoes: null, face: null, back: null, accessory: null }
};

// T3: 입지 않은 부위는 null
const R0: Wardrobe = {
  items: [],
  equipped: { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null }
};

// 부위가 정확히 일곱이다(모자라거나 남는 키가 있으면 컴파일되지 않는다)
const SEVEN_SLOTS: Record<WardrobeSlot, true> = {
  hat: true,
  top: true,
  bottom: true,
  shoes: true,
  face: true,
  back: true,
  accessory: true
};

describe("[spec] 웹 옷장 응답 타입(T2·T3)", () => {
  it("T2: 명세 JSON 예(R1)가 웹 응답 타입으로 적히고 equipped에 일곱 부위가 있다", () => {
    expect(R1.items[0]).toEqual({ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" });
    expect(Object.keys(R1.equipped)).toEqual(["hat", "top", "bottom", "shoes", "face", "back", "accessory"]);
    expect(Object.keys(SEVEN_SLOTS)).toEqual(["hat", "top", "bottom", "shoes", "face", "back", "accessory"]);
  });

  it("T3: 일곱 부위가 모두 null인 값(R0)도 웹 응답 타입으로 적힌다", () => {
    expect(Object.values(R0.equipped)).toEqual([null, null, null, null, null, null, null]);
  });
});
