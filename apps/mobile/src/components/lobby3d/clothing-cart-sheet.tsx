import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import LobbySheet from "@/components/home/lobby-sheet";
import { useItemCatalog } from "@/lib/item-catalog-store";
import { clothingCart, clothingProduct, removeFromClothingCart, subscribeClothingCart } from "@/lib/lobby3d/clothing-stock";
import { clothingCatalogPrice } from "./clothing-product-sheet";

// 옷집 계산대의 장바구니 창(아래에서 올라오는 판). 계산대 '계산하기'로 연다.
// 담은 상품마다 이름·가격·'빼기', 합계, 잔액(모르면 숨김), '구매'. 비었거나 잔액이 합계보다 적으면 '구매'를 누를 수 없다.
// 구매는 로비 화면이 맡는다(홈이 서버에 주문한다). 주문하는 동안 '구매'를 다시 누를 수 없다.
// 위에는 '지금 입고 있는 옷'(옷집에서 걸쳐 본, 아직 안 가지고 장바구니에도 없는 상품)을 따로 보인다. 처음엔 모두 체크되어 함께 사고,
// 체크를 풀면 뺀다. 가격이 없는(판매 준비 중) 옷은 체크할 수 없다. 장바구니가 비어도 입은 옷만으로 살 수 있다.

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
  /** 지금 입고 있는 옷(상품 ID): 옷집 임시 착장 중 가지지 않았고 장바구니에 없는 진열 상품. */
  worn?: readonly string[];
  /** 룹 잔액(모르면 null). */
  balance: number | null;
  /** 주문하는 중인지. */
  buying: boolean;
  onClose: () => void;
  /** '구매': 주문 줄과 산 상품 ID(입은 옷 + 장바구니). */
  onBuy: (items: { type: string; price: number }[], productIds: string[]) => void;
}

const NO_WORN: readonly string[] = [];

export default function ClothingCartSheet({ visible, worn = NO_WORN, balance, buying, onClose, onBuy }: ClothingCartSheetProps) {
  useItemCatalog();
  const cart = useSyncExternalStore(subscribeClothingCart, clothingCart, clothingCart);
  // 체크를 푼 입은 옷(창을 열 때마다 모두 체크로 시작)
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (visible) setSkipped(new Set());
  }, [visible]);
  const wornRows = worn
    .filter((id) => !cart.includes(id))
    .map((id) => {
      const product = clothingProduct(id);
      return { productId: id, name: product?.name ?? id, price: clothingCatalogPrice(id), catalogId: product?.catalogId ?? null };
    });
  const order: { type: string; price: number; productId: string }[] = [];
  for (const row of wornRows) {
    if (row.price !== null && row.catalogId !== null && !skipped.has(row.productId)) order.push({ type: row.catalogId, price: row.price, productId: row.productId });
  }
  const rows = clothingCartOrder(cart);
  for (const row of rows) order.push({ type: row.type, price: row.price, productId: row.productId });
  const total = order.reduce((sum, row) => sum + row.price, 0);
  const shortage = balance !== null ? total - balance : 0;
  const blocked = order.length === 0 || shortage > 0 || buying;
  const toggle = (id: string) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <LobbySheet visible={visible} title="장바구니" onClose={onClose}>
      <View style={styles.body}>
        {wornRows.length > 0 ? <Text style={styles.section}>지금 입고 있는 옷</Text> : null}
        {wornRows.map((row) => {
          const buyable = row.price !== null && row.catalogId !== null;
          const checked = buyable && !skipped.has(row.productId);
          return (
            <Pressable
              key={row.productId}
              accessibilityRole="checkbox"
              accessibilityLabel={buyable ? `${row.name} ${row.price}룹` : `${row.name}, 판매 준비 중`}
              accessibilityState={{ checked, disabled: !buyable || buying }}
              disabled={!buyable || buying}
              style={styles.row}
              onPress={() => toggle(row.productId)}
            >
              <View style={[styles.check, checked && styles.checkOn, !buyable && styles.checkOff]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
              <Text style={[styles.name, !buyable && styles.nameOff]}>{row.name}</Text>
              <Text style={buyable ? styles.price : styles.tag}>{buyable ? `${row.price}룹` : "판매 준비 중"}</Text>
            </Pressable>
          );
        })}
        {wornRows.length > 0 ? <Text style={styles.section}>장바구니</Text> : null}
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
        {order.length > 0 ? (
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
          onPress={() =>
            onBuy(
              order.map((row) => ({ type: row.type, price: row.price })),
              order.map((row) => row.productId)
            )
          }
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
  section: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#7A6655"
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#C9B8A8",
    alignItems: "center",
    justifyContent: "center"
  },
  checkOn: {
    borderColor: ACCENT,
    backgroundColor: ACCENT
  },
  checkOff: {
    borderColor: "#E4DAD1",
    backgroundColor: "#F3ECE6"
  },
  checkMark: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  nameOff: {
    color: "#A8988A"
  },
  tag: {
    fontSize: 13,
    color: "#7A6655"
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
