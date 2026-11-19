import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import LobbySheet from "@/components/home/lobby-sheet";
import { SHOP_PRODUCTS, setShopDisplay, shopDisplay, subscribeShopDisplay } from "@/lib/lobby3d/shop";

// 가구점 진열대의 진열 목록(아래에서 올라오는 판). 진열대 '바꾸기'로 연다.
// 상품을 고르면 그 진열대만 바뀌고 닫힌다. 닫기·바깥 누르기·뒤로 가기로 닫으면 아무것도 바뀌지 않는다.

const ACCENT = "#E36A00";

interface ShopDisplaySheetProps {
  /** 연 진열대 번호(0~2). null이면 닫혀 있다. */
  slot: number | null;
  onClose: () => void;
}

export default function ShopDisplaySheet({ slot, onClose }: ShopDisplaySheetProps) {
  const stock = useSyncExternalStore(subscribeShopDisplay, shopDisplay, shopDisplay);
  const current = slot === null ? null : stock[slot] ?? null;
  return (
    <LobbySheet visible={slot !== null} title={slot === null ? "진열 바꾸기" : `진열대 ${slot + 1} 바꾸기`} onClose={onClose}>
      {SHOP_PRODUCTS.map((product) => {
        const shown = product.id === current;
        return (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            accessibilityState={{ selected: shown }}
            accessibilityLabel={shown ? `${product.name}, 진열 중` : product.name}
            style={[styles.row, shown && styles.rowShown]}
            onPress={() => {
              if (slot === null) return;
              if (!shown) setShopDisplay(slot, product.id);
              onClose();
            }}
          >
            <View style={styles.texts}>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
            {shown ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>진열 중</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </LobbySheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#F8F1E8"
  },
  rowShown: { borderWidth: 2, borderColor: ACCENT, backgroundColor: "#FFF4E8" },
  texts: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "800", color: "#2B1810" },
  description: { fontSize: 13, lineHeight: 18, color: "#5A4636" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: ACCENT },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" }
});
