import type { WardrobeSlot } from "@/lib/types";

// 라룹이 착용(캐릭터 꾸미기). 부위는 일곱(WardrobeSlot)이고, 부위마다 한 번에 아이템 하나를 입는다.
// 그리기에는 두 값을 넘긴다:
// - WearState: ①에서 정한 부위 넷(모자·상의·하의·신발)을 입었는지(참·거짓). 화면·테스트가 이 모양을 그대로 쓴다.
// - WearLook: 부위 일곱마다 입은 아이템 종류. 그리기는 이 값으로 아이템의 모델·색을 고른다(⑤). 없으면 WearState의 넷을 기본 아이템으로 그린다.
// 개발 화면 시험판은 서버와 상관없이 입고 벗고, 홈은 서버에 저장된 입은 아이템(GET /api/wardrobe)을 입힌다.

export type WearSlot = "hat" | "top" | "bottom" | "shoes";

/** 부위마다 입었는지(①의 부위 넷). */
export type WearState = Record<WearSlot, boolean>;

/** 부위 일곱마다 입은 아이템 종류(입지 않았으면 null). */
export type WearLook = Record<WardrobeSlot, string | null>;

/** 시험판 버튼 순서와 이름(①의 넷. 켜면 그 부위의 첫 아이템을 입는다). */
export const WEAR_SLOTS: readonly { slot: WearSlot; label: string }[] = [
  { slot: "hat", label: "모자" },
  { slot: "top", label: "상의" },
  { slot: "bottom", label: "하의" },
  { slot: "shoes", label: "신발" }
];

/** 시험판의 새 부위 버튼(⑤). */
export const EXTRA_WEAR_SLOTS: readonly { slot: Exclude<WardrobeSlot, WearSlot>; label: string }[] = [
  { slot: "face", label: "얼굴장식" },
  { slot: "back", label: "등장식" },
  { slot: "accessory", label: "액세서리" }
];

/** 아무것도 입지 않은 상태. */
export const NO_WEAR: WearState = { hat: false, top: false, bottom: false, shoes: false };

/** 아무것도 입지 않은 일곱 부위. */
export const NO_LOOK: WearLook = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

const LOOK_SLOTS: readonly WardrobeSlot[] = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"];

/**
 * 착용 아이템 목록(서버 WardrobeService와 같은 종류). 이름은 화면 이름, wear는 ①의 부위 넷 중 어디인지(새 부위는 없다),
 * model은 착용 모델(lobby-wearables.glb) 안의 이름(신발은 한 짝 이름에서 -l/-r를 뺀 것), color는 모델 색 대신 칠할 색(없으면 모델 색).
 */
export interface WearableItemInfo {
  slot: WardrobeSlot;
  label: string;
  wear?: WearSlot;
  model: string;
  color?: string;
}

export const WEARABLE_ITEMS: Readonly<Record<string, WearableItemInfo>> = {
  capOrange: { slot: "hat", label: "주황 야구모자", wear: "hat", model: "wear-hat" },
  tshirtOrange: { slot: "top", label: "주황 티셔츠", wear: "top", model: "wear-top" },
  shortsNavy: { slot: "bottom", label: "남색 반바지", wear: "bottom", model: "wear-bottom" },
  shoesBrown: { slot: "shoes", label: "갈색 운동화", wear: "shoes", model: "wear-shoe" },
  capBlue: { slot: "hat", label: "파랑 야구모자", wear: "hat", model: "wear-hat-blue" },
  capGreen: { slot: "hat", label: "초록 야구모자", wear: "hat", model: "wear-hat-green" },
  tshirtWhite: { slot: "top", label: "흰 티셔츠", wear: "top", model: "wear-top", color: "#F4F0E8" },
  tshirtYellow: { slot: "top", label: "노랑 티셔츠", wear: "top", model: "wear-top", color: "#F2C440" },
  shortsBrown: { slot: "bottom", label: "갈색 반바지", wear: "bottom", model: "wear-bottom", color: "#8A5A3B" },
  shortsRed: { slot: "bottom", label: "빨강 반바지", wear: "bottom", model: "wear-bottom", color: "#C8443A" },
  shoesRed: { slot: "shoes", label: "빨강 운동화", wear: "shoes", model: "wear-shoe", color: "#C8443A" },
  shoesWhite: { slot: "shoes", label: "흰 운동화", wear: "shoes", model: "wear-shoe", color: "#DCD8CF" },
  sunglassesBlack: { slot: "face", label: "검정 선글라스", model: "wear-sunglasses" },
  backpackRed: { slot: "back", label: "빨강 백팩", model: "wear-backpack" },
  mufflerRed: { slot: "accessory", label: "빨강 머플러", model: "wear-muffler" },
  necklaceGold: { slot: "accessory", label: "금 목걸이", model: "wear-necklace" }
};

/** 그 부위의 아이템들(목록 순서). 시험판이 차례로 고를 때 쓴다. */
export function itemsInSlot(slot: WardrobeSlot): string[] {
  return Object.keys(WEARABLE_ITEMS).filter((type) => WEARABLE_ITEMS[type].slot === slot);
}

/** 서버의 부위별 입은 아이템을 ①의 부위 넷 착용 상태로. 모르는 종류나 다른 부위에 든 아이템은 입히지 않는다. */
export function wearFromEquipped(equipped: Partial<Record<WardrobeSlot, string | null>> | null | undefined): WearState {
  const wear: WearState = { ...NO_WEAR };
  if (!equipped) return wear;
  for (const [slot, type] of Object.entries(equipped)) {
    const info = type ? WEARABLE_ITEMS[type] : undefined;
    if (info && info.slot === slot && info.wear) wear[info.wear] = true;
  }
  return wear;
}

/** 서버의 부위별 입은 아이템을 일곱 부위의 그릴 아이템으로. 모르는 종류나 다른 부위에 든 아이템은 그리지 않는다. */
export function lookFromEquipped(equipped: Partial<Record<WardrobeSlot, string | null>> | null | undefined): WearLook {
  const look: WearLook = { ...NO_LOOK };
  if (!equipped || typeof equipped !== "object" || Array.isArray(equipped)) return look;
  for (const slot of LOOK_SLOTS) {
    const type = (equipped as Partial<Record<WardrobeSlot, unknown>>)[slot];
    if (typeof type === "string" && WEARABLE_ITEMS[type]?.slot === slot) look[slot] = type;
  }
  return look;
}

/** 그릴 아이템을 ①의 부위 넷 착용 상태로. */
export function wearOfLook(look: WearLook): WearState {
  return { hat: look.hat !== null, top: look.top !== null, bottom: look.bottom !== null, shoes: look.shoes !== null };
}

/** ①의 부위 넷 착용 상태를 그릴 아이템으로(입은 부위는 그 부위의 첫 아이템, 새 부위는 비움). */
export function lookOfWear(wear: WearState): WearLook {
  const look: WearLook = { ...NO_LOOK };
  for (const { slot } of WEAR_SLOTS) if (wear[slot]) look[slot] = itemsInSlot(slot)[0] ?? null;
  return look;
}

/** 입은 것이 하나라도 있는지(그릴 아이템을 주면 새 부위도 본다). */
export function wearsAnything(wear: WearState, look?: WearLook | null): boolean {
  if (look) return LOOK_SLOTS.some((slot) => look[slot] !== null);
  return wear.hat || wear.top || wear.bottom || wear.shoes;
}
