// 라룹이 착용 부위(캐릭터 꾸미기). ① 기술 시험에서는 모자·상의·하의·신발 넷을 개발 화면에서 입고 벗는다.

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

/** 입은 것이 하나라도 있는지. */
export function wearsAnything(wear: WearState): boolean {
  return wear.hat || wear.top || wear.bottom || wear.shoes;
}
