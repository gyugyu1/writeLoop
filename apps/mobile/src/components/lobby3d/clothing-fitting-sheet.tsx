import { useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import LobbySheet from "@/components/home/lobby-sheet";
import { catalogItem, useItemCatalog } from "@/lib/item-catalog-store";
import { CLOTHING_OUTFITS, CLOTHING_PRODUCTS, clothingDisplayed, subscribeClothingDisplay, type ClothingProduct } from "@/lib/lobby3d/clothing-stock";
import { BODY_WEARABLES, isWearableDrawable, wearableLabel, wearableSlotOf, type WearLook } from "@/lib/lobby3d/wear";
import type { WardrobeSlot } from "@/lib/types";

// 옷집 피팅 창(아래에서 올라오는 판). 피팅룸에 들어가 커튼이 닫히면 연다. 두 층 피팅룸이 같은 목록을 쓴다.
// 목록: 양 층에서 지금 진열 중인 상품 + 가진 옷(같은 옷이면 한 번), 부위별. 그릴 줄 모르는 옷은 뺀다.
// 줄을 누르면 그 부위에 입고, 입은 줄을 다시 누르면 벗는다. 세트는 구성품을 각 부위에 입힌다(진열 해제된 구성품은 건너뛴다).
// 착장은 로비 화면이 임시로 들고 있다(이 창은 바꾸자고 알리기만 한다). '취소'는 들어오기 전으로, '장바구니에 넣기'는 장바구니·옷장으로.
// 창은 화면 아래쪽만 덮고 바깥 판을 어둡게 하지 않는다(위쪽에 라룹이가 입은 모습이 보인다).

const ACCENT = "#E36A00";

const SLOT_ORDER: readonly { slot: WardrobeSlot; label: string }[] = [
  { slot: "hat", label: "모자" },
  { slot: "top", label: "상의" },
  { slot: "bottom", label: "하의" },
  { slot: "shoes", label: "신발" },
  { slot: "face", label: "얼굴장식" },
  { slot: "back", label: "등장식" },
  { slot: "accessory", label: "액세서리" }
];

/** 피팅 목록 한 줄: 착장에 쓰는 아이템 ID(서버 아이템 목록의 id), 이름, 부위, 표시 글. */
export interface FittingItem {
  id: string;
  name: string;
  slot: WardrobeSlot;
  tag: string | null;
}

/** 진열 상품의 착장 아이템 ID: 등록된 옷은 카탈로그 ID, 미등록은 상품 ID(서버 목록에 같은 id로 있다). */
export function fittingItemId(product: ClothingProduct): string {
  return product.catalogId ?? product.id;
}

/** 가진 옷인지(옷장에 있거나 처음부터 가진 옷). */
export function ownsWearable(id: string, owned: ReadonlySet<string>): boolean {
  return owned.has(id) || BODY_WEARABLES.has(id);
}

/** 피팅 목록: 진열 중인 상품(stock.json 순서) 다음에 가진 옷. 같은 옷은 한 번, 그릴 줄 모르는 옷은 뺀다. */
export function fittingItems(displayed: Readonly<Record<string, boolean>>, owned: ReadonlySet<string>): FittingItem[] {
  const items: FittingItem[] = [];
  const seen = new Set<string>();
  const tagOf = (id: string, registered: boolean) => {
    if (ownsWearable(id, owned)) return "가진 옷";
    if (!registered) return "판매 준비 중";
    const price = catalogItem(id)?.price;
    return typeof price === "number" ? `${price}룹` : null;
  };
  for (const product of CLOTHING_PRODUCTS) {
    if (!displayed[product.id]) continue;
    const id = fittingItemId(product);
    if (seen.has(id) || !isWearableDrawable(id)) continue;
    seen.add(id);
    items.push({ id, name: product.name, slot: wearableSlotOf(id) ?? product.slot, tag: tagOf(id, product.catalogId !== null) });
  }
  for (const id of owned) {
    if (seen.has(id) || !isWearableDrawable(id)) continue;
    const slot = wearableSlotOf(id);
    if (!slot) continue;
    seen.add(id);
    items.push({ id, name: wearableLabel(id), slot, tag: "가진 옷" });
  }
  return items;
}

/** 세트의 구성품 착장(부위 → 아이템 ID). 진열 해제된 구성품은 뺀다. */
export function outfitPieces(outfitId: string, displayed: Readonly<Record<string, boolean>>): Partial<WearLook> {
  const outfit = CLOTHING_OUTFITS.find((o) => o.id === outfitId);
  const pieces: Partial<WearLook> = {};
  if (!outfit) return pieces;
  for (const itemId of outfit.itemIds) {
    const product = CLOTHING_PRODUCTS.find((p) => p.id === itemId);
    if (!product || !displayed[product.id]) continue;
    const id = fittingItemId(product);
    pieces[wearableSlotOf(id) ?? product.slot] = id;
  }
  return pieces;
}

interface ClothingFittingSheetProps {
  visible: boolean;
  /** 지금 임시 착장. */
  look: WearLook;
  owned: ReadonlySet<string>;
  /** 그 부위에 입는다(null이면 벗는다). */
  onWear: (slot: WardrobeSlot, id: string | null) => void;
  /** 세트를 입는다. */
  onOutfit: (outfitId: string) => void;
  onCancel: () => void;
  onFinish: () => void;
}

export default function ClothingFittingSheet({ visible, look, owned, onWear, onOutfit, onCancel, onFinish }: ClothingFittingSheetProps) {
  useItemCatalog();
  const displayed = useSyncExternalStore(subscribeClothingDisplay, clothingDisplayed, clothingDisplayed);
  const items = fittingItems(displayed, owned);
  return (
    <LobbySheet visible={visible} title="피팅룸" onClose={onCancel} maxHeight="46%" dimBackdrop={false}>
      <View style={styles.outfits}>
        {CLOTHING_OUTFITS.map((outfit) => (
          <Pressable key={outfit.id} accessibilityRole="button" style={styles.outfit} onPress={() => onOutfit(outfit.id)}>
            <Text style={styles.outfitText}>{outfit.name}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.list}>
        {SLOT_ORDER.map(({ slot, label }) => {
          const rows = items.filter((item) => item.slot === slot);
          if (rows.length === 0) return null;
          return (
            <View key={slot}>
              <Text style={styles.slotLabel}>{label}</Text>
              {rows.map((item) => {
                const worn = look[slot] === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.tag ? `${item.name}, ${item.tag}` : item.name}
                    accessibilityState={{ selected: worn }}
                    style={[styles.row, worn && styles.rowWorn]}
                    onPress={() => onWear(slot, worn ? null : item.id)}
                  >
                    <Text style={styles.name}>{item.name}</Text>
                    {item.tag ? <Text style={styles.tag}>{item.tag}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={onCancel}>
          <Text style={styles.secondaryText}>취소</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.primary} onPress={onFinish}>
          <Text style={styles.primaryText}>장바구니에 넣기</Text>
        </Pressable>
      </View>
    </LobbySheet>
  );
}

const styles = StyleSheet.create({
  outfits: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  outfit: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3ECE6"
  },
  outfitText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B2A1E"
  },
  list: {
    maxHeight: 200,
    paddingHorizontal: 16
  },
  slotLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#7A6655"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10
  },
  rowWorn: {
    backgroundColor: "#FDEBDC"
  },
  name: {
    fontSize: 15,
    color: "#3B2A1E"
  },
  tag: {
    fontSize: 13,
    color: "#7A6655"
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  secondary: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3ECE6"
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B2A1E"
  }
});
