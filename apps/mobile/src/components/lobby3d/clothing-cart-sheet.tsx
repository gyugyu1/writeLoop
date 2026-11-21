import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import LobbySheet from "@/components/home/lobby-sheet";
import { useItemCatalog } from "@/lib/item-catalog-store";
import { clothingCart, clothingProduct, removeFromClothingCart, subscribeClothingCart } from "@/lib/lobby3d/clothing-stock";
import { clothingCatalogPrice } from "./clothing-product-sheet";

// 옷집 계산대의 장바구니 창(아래에서 올라오는 판). 계산대 '계산하기'로 연다.
// 담은 상품마다 이름·가격·'빼기', 합계, 잔액(모르면 숨김), '구매'. 비었거나 잔액이 합계보다 적으면 '구매'를 누를 수 없다.
// 구매는 로비 화면이 맡는다(홈이 서버에 주문한다). 주문하는 동안 '구매'를 다시 누를 수 없다.

const ACCENT = "#E36A00";

/** 장바구니 상품의 주문 줄(아이템 ID = 카탈로그 ID, 가격). 가격을 모르는 상품은 뺀다. */
export function clothingCartOrder(cart: readonly string[]): { type: string; price: number; name: string; productId: string }[] {
  const rows: { type: string; price: number; name: string; productId: string }[] = [];
  for (const id of cart) {
    const product = clothingProduct(id);
    const price = clothingCatalogPrice(id);
    if (!product?.catalogId || price === null) continue;
    rows.push({ type: product.catalogId, price, name: product.name, productId: id });
  }
  return rows;
}

interface ClothingCartSheetProps {
  visible: boolean;
  /** 룹 잔액(모르면 null). */
  balance: number | null;
  /** 주문하는 중인지. */
  buying: boolean;
  onClose: () => void;
  onBuy: (items: { type: string; price: number }[]) => void;
}

export default function ClothingCartSheet({ visible, balance, buying, onClose, onBuy }: ClothingCartSheetProps) {
  useItemCatalog();
  const cart = useSyncExternalStore(subscribeClothingCart, clothingCart, clothingCart);
  const rows = clothingCartOrder(cart);
  const total = rows.reduce((sum, row) => sum + row.price, 0);
  const shortage = balance !== null ? total - balance : 0;
  const blocked = rows.length === 0 || shortage > 0 || buying;
  return (
    <LobbySheet visible={visible} title="장바구니" onClose={onClose}>
      <View style={styles.body}>
        {rows.length === 0 ? <Text style={styles.empty}>장바구니가 비었어요</Text> : null}
        {rows.map((row) => (
          <View key={row.productId} style={styles.row}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.price}>{row.price}룹</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${row.name} 빼기`}
              style={styles.remove}
              disabled={buying}
              onPress={() => removeFromClothingCart(row.productId)}
            >
              <Text style={styles.removeText}>빼기</Text>
            </Pressable>
          </View>
        ))}
        {rows.length > 0 ? (
          <View style={styles.summary}>
            <Text style={styles.total}>합계 {total}룹</Text>
            {balance !== null ? <Text style={styles.balance}>잔액 {balance}룹</Text> : null}
            {shortage > 0 ? <Text style={styles.shortage}>룹이 {shortage} 모자라요</Text> : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked, busy: buying }}
          disabled={blocked}
          style={[styles.primary, blocked && styles.primaryOff]}
          onPress={() => onBuy(rows.map((row) => ({ type: row.type, price: row.price })))}
        >
          <Text style={styles.primaryText}>{buying ? "사는 중…" : "구매"}</Text>
        </Pressable>
      </View>
    </LobbySheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8
  },
  empty: {
    fontSize: 15,
    color: "#7A6655",
    paddingVertical: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: "#3B2A1E"
  },
  price: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3B2A1E"
  },
  remove: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3ECE6"
  },
  removeText: {
    fontSize: 14,
    color: "#3B2A1E"
  },
  summary: {
    marginTop: 4,
    gap: 2
  },
  total: {
    fontSize: 17,
    fontWeight: "700",
    color: "#3B2A1E"
  },
  balance: {
    fontSize: 14,
    color: "#7A6655"
  },
  shortage: {
    fontSize: 14,
    color: "#B4441C"
  },
  primary: {
    marginTop: 8,
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
  }
});
