import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { catalogItem, useItemCatalog } from "@/lib/item-catalog-store";
import { isWearableDrawable } from "@/lib/lobby3d/wear";
import { fittingItemId } from "./clothing-fitting-sheet";
import {
  addToClothingCart,
  clothingCart,
  clothingCartBlock,
  clothingPriceText,
  clothingProduct,
  subscribeClothingCart,
  type ClothingCartBlock
} from "@/lib/lobby3d/clothing-stock";

// 옷집 진열대 앞 상호작용 칸(로비를 막지 않는 화면 아래 작은 칸). 진열 상품의 서는 자리 가까이 멈춰 서면(또는 상품을 눌러 그 앞에 도착하면) 뜬다.
// 이름, 이름표와 같은 가격 글, '입어보기'(입고 있으면 '벗기'), '장바구니'. 멀어지면 로비 화면이 칸을 거둔다.
// 입어보기는 옷집 임시 착장에 바로 입힌다(로비 화면이 맡는다). 그릴 줄 모르는 옷은 입어 볼 수 없다.
// 담을 수 없으면(판매 준비 중·가진 옷·이미 담음) '장바구니'를 막고 이유를 보인다.

const ACCENT = "#E36A00";

/** 담을 수 없는 이유 글. */
const BLOCK_TEXT: Record<Exclude<ClothingCartBlock, null>, string> = {
  "not-for-sale": "판매 준비 중인 옷이에요",
  "no-price": "가격을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요",
  owned: "이미 가진 옷이에요",
  "in-cart": "장바구니에 담았어요",
  "not-displayed": "지금은 진열하지 않는 옷이에요"
};

interface ClothingProductSheetProps {
  /** 연 상품(상품 ID). null이면 닫혀 있다. */
  productId: string | null;
  /** 가진 옷(아이템 ID). */
  owned: ReadonlySet<string>;
  /** 칸 아래 여백(로비 아래 메뉴·탭바 위에 띄운다). */
  bottom?: number;
  /** 장바구니에 담았을 때(로비 화면이 안내를 띄운다). */
  onAdded: (id: string) => void;
  /** 지금 옷집 임시 착장에 이 상품을 입고 있는지. */
  worn?: boolean;
  /** '입어보기'(상품 ID). */
  onTry?: (id: string) => void;
  /** '벗기'(상품 ID). */
  onUntry?: (id: string) => void;
}

/** 서버 아이템 목록의 가격(등록된 상품만). */
export function clothingCatalogPrice(id: string): number | null {
  const product = clothingProduct(id);
  if (!product?.catalogId) return null;
  return catalogItem(product.catalogId)?.price ?? null;
}

export default function ClothingProductSheet({ productId, owned, bottom = 16, onAdded, worn = false, onTry, onUntry }: ClothingProductSheetProps) {
  useItemCatalog();
  // 장바구니가 바뀌면 다시 그린다(담은 뒤 '장바구니에 담았어요')
  useSyncExternalStore(subscribeClothingCart, clothingCart, clothingCart);
  const product = productId ? clothingProduct(productId) : undefined;
  const price = product ? clothingCatalogPrice(product.id) : null;
  const isOwned = Boolean(product?.catalogId && owned.has(product.catalogId));
  const priceText = product ? clothingPriceText(product, price, isOwned) : null;
  const block = product ? clothingCartBlock(product, price, isOwned) : "not-for-sale";
  const canTry = product ? isWearableDrawable(fittingItemId(product)) : false;
  if (!product) return null;
  return (
    <View style={[styles.panel, { bottom }]} pointerEvents="box-none">
      {(
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {product.name}
          </Text>
          {priceText ? <Text style={styles.price}>{priceText}</Text> : null}
          {block ? <Text style={styles.reason}>{BLOCK_TEXT[block]}</Text> : null}
          {!canTry ? <Text style={styles.reason}>입어 볼 수 없는 옷이에요</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canTry }}
              disabled={!canTry}
              style={[styles.secondary, styles.grow, !canTry && styles.primaryOff]}
              onPress={() => {
                if (!canTry) return;
                if (worn) onUntry?.(product.id);
                else onTry?.(product.id);
              }}
            >
              <Text style={styles.secondaryText}>{worn ? "벗기" : "입어보기"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: block !== null }}
              disabled={block !== null}
              style={[styles.primary, block !== null && styles.primaryOff]}
              onPress={() => {
                if (block !== null) return;
                if (addToClothingCart(product.id)) onAdded(product.id);
              }}
            >
              <Text style={styles.primaryText}>장바구니</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 12,
    right: 12
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 253, 248, 0.97)",
    borderWidth: 1,
    borderColor: "#E6D7C7"
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2B1810"
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3B2A1E"
  },
  reason: {
    fontSize: 14,
    color: "#7A6655"
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT
  },
  primaryOff: {
    backgroundColor: "#D9CFC6"
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
  grow: {
    flex: 1
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B2A1E"
  }
});
