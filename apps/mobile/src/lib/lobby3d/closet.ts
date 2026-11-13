import { catalogItem } from "@/lib/item-catalog-store";
import type { Wardrobe, WardrobeSlot } from "@/lib/types";
import { WEARABLE_ITEMS } from "./wear";

// 옷장(캐릭터 꾸미기 화면)의 규칙: 부위 탭, 부위마다 고를 수 있는 아이템 칸, 고른 것이 처음과 다른지.
// 화면(components/home/closet-sheet)과 떨어져 있어 테스트에서 바로 부를 수 있다.

/** 부위마다 입은 아이템 종류(입지 않은 부위는 null). 서버의 equipped와 같은 모양이다. */
export type ClosetEquipped = Record<WardrobeSlot, string | null>;

/** 부위 탭 순서와 이름, 가진 아이템이 없을 때의 문구(받침에 맞춘 조사). */
export const CLOSET_SLOTS: readonly { slot: WardrobeSlot; label: string; empty: string }[] = [
  { slot: "hat", label: "모자", empty: "아직 가진 모자가 없어요" },
  { slot: "top", label: "상의", empty: "아직 가진 상의가 없어요" },
  { slot: "bottom", label: "하의", empty: "아직 가진 하의가 없어요" },
  { slot: "shoes", label: "신발", empty: "아직 가진 신발이 없어요" },
  { slot: "face", label: "얼굴장식", empty: "아직 가진 얼굴장식이 없어요" },
  { slot: "back", label: "등장식", empty: "아직 가진 등장식이 없어요" },
  { slot: "accessory", label: "액세서리", empty: "아직 가진 액세서리가 없어요" }
];

/** 아무것도 입지 않은 일곱 부위. */
export const NO_EQUIPPED: ClosetEquipped = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

/** 서버 응답의 입은 것을 일곱 부위로 맞춘다(빠진 부위나 문자열이 아닌 값은 null). 앱이 모르는 종류도 그대로 둔다(저장할 때 벗기지 않으려고). */
export function closetEquipped(wardrobe: Pick<Wardrobe, "equipped"> | null | undefined): ClosetEquipped {
  const source = wardrobe?.equipped;
  const equipped: ClosetEquipped = { ...NO_EQUIPPED };
  if (!source || typeof source !== "object" || Array.isArray(source)) return equipped;
  for (const { slot } of CLOSET_SLOTS) {
    const value = (source as Partial<Record<WardrobeSlot, unknown>>)[slot];
    equipped[slot] = typeof value === "string" && value !== "" ? value : null;
  }
  return equipped;
}

/** 부위 탭의 아이템 칸 하나(맨 앞의 "벗기"는 화면이 따로 그린다). */
export interface ClosetItem {
  type: string;
  label: string;
}

/**
 * 그 부위에서 고를 수 있는 가진 아이템(얻은 순서 = 서버 목록 순서). 앱이 모르는 종류, 앱 목록과 부위가 다르게 온 아이템은 칸을 만들지 않는다.
 * 같은 종류가 두 번 오면 한 칸만 둔다.
 */
export function closetItems(wardrobe: Pick<Wardrobe, "items"> | null | undefined, slot: WardrobeSlot): ClosetItem[] {
  const items = Array.isArray(wardrobe?.items) ? wardrobe!.items : [];
  const seen = new Set<string>();
  const list: ClosetItem[] = [];
  for (const item of items) {
    const info = item && typeof item.type === "string" ? WEARABLE_ITEMS[item.type] : undefined;
    if (!info || info.slot !== slot || item.slot !== slot || seen.has(item.type)) continue;
    seen.add(item.type);
    // 이름은 아이템 목록의 name, 목록에 없으면 앱 착용 아이템 이름
    list.push({ type: item.type, label: catalogItem(item.type)?.name ?? info.label });
  }
  return list;
}

/**
 * 그 부위 탭에서 입은 것으로 표시할 칸: 아이템 종류, 입지 않았으면 null("벗기").
 * 입은 것이 그 탭에 칸이 없는 아이템(앱이 모르는 종류 등)이면 undefined(아무 칸도 표시하지 않는다).
 */
export function closetSelection(equipped: ClosetEquipped, items: readonly ClosetItem[], slot: WardrobeSlot): string | null | undefined {
  const type = equipped[slot];
  if (type === null) return null;
  return items.some((item) => item.type === type) ? type : undefined;
}

/** 두 입은 것이 일곱 부위 모두 같은지. */
export function sameEquipped(a: ClosetEquipped, b: ClosetEquipped): boolean {
  return CLOSET_SLOTS.every(({ slot }) => a[slot] === b[slot]);
}
