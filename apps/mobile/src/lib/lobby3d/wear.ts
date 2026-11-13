import type { WardrobeSlot } from "@/lib/types";

// 라룹이 착용(캐릭터 꾸미기). 부위는 일곱(WardrobeSlot)이고, 지금 착용 모델이 있는 부위는 모자·상의·하의·신발 넷(WearSlot)이다.
// 개발 화면 시험판은 이 넷을 서버와 상관없이 입고 벗고, 홈은 서버에 저장된 입은 아이템(GET /api/wardrobe)을 입힌다.

export type WearSlot = "hat" | "top" | "bottom" | "shoes";

/** 부위마다 입었는지. */
export type WearState = Record<WearSlot, boolean>;

/** 시험판 버튼 순서와 이름. */
export const WEAR_SLOTS: readonly { slot: WearSlot; label: string }[] = [
  { slot: "hat", label: "모자" },
  { slot: "top", label: "상의" },
  { slot: "bottom", label: "하의" },
  { slot: "shoes", label: "신발" }
];

/** 아무것도 입지 않은 상태. */
export const NO_WEAR: WearState = { hat: false, top: false, bottom: false, shoes: false };

/** 착용 아이템 목록(서버 WardrobeService와 같은 종류). 이름은 화면 이름, wear는 착용 모델에서 그리는 부위다. */
export interface WearableItemInfo {
  slot: WardrobeSlot;
  label: string;
  wear: WearSlot;
}

export const WEARABLE_ITEMS: Readonly<Record<string, WearableItemInfo>> = {
  capOrange: { slot: "hat", label: "주황 야구모자", wear: "hat" },
  tshirtOrange: { slot: "top", label: "주황 티셔츠", wear: "top" },
  shortsNavy: { slot: "bottom", label: "남색 반바지", wear: "bottom" },
  shoesBrown: { slot: "shoes", label: "갈색 운동화", wear: "shoes" }
};

/** 서버의 부위별 입은 아이템을 그릴 착용 상태로. 모르는 종류나 다른 부위에 든 아이템은 입히지 않는다. */
export function wearFromEquipped(equipped: Partial<Record<WardrobeSlot, string | null>> | null | undefined): WearState {
  const wear: WearState = { ...NO_WEAR };
  if (!equipped) return wear;
  for (const [slot, type] of Object.entries(equipped)) {
    const info = type ? WEARABLE_ITEMS[type] : undefined;
    if (info && info.slot === slot) wear[info.wear] = true;
  }
  return wear;
}

/** 입은 것이 하나라도 있는지. */
export function wearsAnything(wear: WearState): boolean {
  return wear.hat || wear.top || wear.bottom || wear.shoes;
}
