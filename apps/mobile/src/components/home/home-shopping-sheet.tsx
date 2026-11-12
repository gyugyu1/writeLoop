import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, getHomeShopping, orderHomeShopping } from "@/lib/api";
import { furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { furnitureIcon } from "@/lib/lobby3d/furniture-icons";
import type { HomeShopping, HomeShoppingItem, HomeShoppingOrderResult } from "@/lib/types";

// 라룹 홈쇼핑: 로비 위에 전체 화면으로 열린다. 오늘의 방송 상품과 기본 가구를 룹으로 산다.
// 산 가구는 서버가 배치의 보관함에 더하고, 주문 결과(배치·잔액)는 홈이 받아 로비에 반영한다.

const LINE = "#3D1B0F";
const ACCENT = "#E36A00";
const ORDER_FAILED = "주문하지 못했어요. 다시 시도해 주세요";
/** 오늘의 방송 상품을 소개하는 라룹이 쇼호스트 말. 화면을 열 때마다 하나를 고른다. */
export const HOST_LINES = ["오늘만 20%! 지금 주문하세요", "방송 중에만 이 가격이에요!", "매진되기 전에 서두르세요!"];

interface HomeShoppingSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 홈쇼핑 목록이나 주문으로 알게 된 잔액(로비 칩). */
  onBalance: (balance: number) => void;
  /** 주문에 성공했을 때(홈이 배치를 주문 결과로 바꾼다). */
  onOrdered: (result: HomeShoppingOrderResult) => void;
  /** 완료 판의 '바로 놓기'(홈이 홈쇼핑을 닫고 꾸미기를 그 가구를 꺼낸 채로 연다). */
  onPlaceNow: (result: HomeShoppingOrderResult) => void;
}

/** 그 가구를 지금 사는 가격(방송 상품이면 할인 가격). */
function priceOf(item: HomeShoppingItem): number {
  return item.salePrice ?? item.price;
}

/** 받침이 있는 이름(을/를). */
function withObjectParticle(name: string): string {
  const last = name.charCodeAt(name.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${name}${hasFinal ? "을" : "를"}`;
}

function FurnitureImage({ type, size }: { type: string; size: number }) {
  const icon = furnitureIcon(type);
  const { name } = furnitureType(type);
  return (
    <View style={[styles.imageBox, { width: size, height: size }]}>
      {icon ? (
        <Image source={icon} style={{ width: size - 8, height: size - 8 }} resizeMode="contain" />
      ) : (
        <Text style={styles.initial}>{name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

export default function HomeShoppingSheet({ visible, onClose, onBalance, onOrdered, onPlaceNow }: HomeShoppingSheetProps) {
  const insets = useSafeAreaInsets();
  const [shop, setShop] = useState<HomeShopping | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hostLine, setHostLine] = useState(HOST_LINES[0]);
  const [confirming, setConfirming] = useState<HomeShoppingItem | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState<HomeShoppingOrderResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const requestRef = useRef(0);
  // 열려 있는지(닫힌 뒤 온 주문 응답으로 완료 판을 열지 않게)
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const load = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const next = await getHomeShopping();
      if (request !== requestRef.current) return;
      setShop(next);
      onBalance(next.balance);
    } catch {
      if (request !== requestRef.current) return;
      setLoadFailed(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [onBalance]);

  // 열릴 때마다 목록을 새로 불러오고 쇼호스트 말을 고른다. 닫으면 판들을 닫는다
  useEffect(() => {
    if (!visible) {
      requestRef.current += 1;
      // 다시 열면 처음처럼 불러오는 동안·실패 표시부터 보이게 앞 목록을 비운다
      setShop(null);
      setLoadFailed(false);
      setConfirming(null);
      setOrdered(null);
      setOrdering(false);
      return;
    }
    setHostLine(HOST_LINES[Math.floor(Math.random() * HOST_LINES.length)]);
    void load();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const order = async (item: HomeShoppingItem) => {
    if (ordering) return;
    setOrdering(true);
    try {
      const result = await orderHomeShopping({ type: item.type, price: priceOf(item) });
      setConfirming(null);
      setShop((current) =>
        current
          ? {
              ...current,
              balance: result.balance,
              items: current.items.map((candidate) => (candidate.type === result.type ? { ...candidate, owned: result.owned } : candidate))
            }
          : current
      );
      onBalance(result.balance);
      onOrdered(result);
      // 기다리는 동안 닫았으면 완료 판은 열지 않는다(잔액·배치는 위에서 이미 반영했다)
      if (visibleRef.current) setOrdered(result);
    } catch (error) {
      setConfirming(null);
      showToast(error instanceof ApiError && error.message ? error.message : ORDER_FAILED);
      if (error instanceof ApiError && error.code === "PRICE_CHANGED") void load();
    } finally {
      setOrdering(false);
    }
  };

  const balance = shop?.balance ?? null;
  const broadcastItem = shop ? shop.items.find((item) => item.type === shop.broadcast.type) ?? null : null;

  const orderButton = (item: HomeShoppingItem, big = false) => {
    const price = priceOf(item);
    const short = balance !== null && balance < price;
    return (
      <View style={big ? styles.bigOrderWrap : styles.orderWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${furnitureType(item.type).name} 주문하기`}
          accessibilityState={{ disabled: short }}
          disabled={short}
          style={[styles.orderButton, big && styles.bigOrderButton, short && styles.orderButtonOff]}
          onPress={() => setConfirming(item)}
        >
          <Text style={[styles.orderText, big && styles.bigOrderText]}>주문하기</Text>
        </Pressable>
        {short ? <Text style={styles.shortText}>{price - (balance ?? 0)}룹 더 모으면 살 수 있어요</Text> : null}
      </View>
    );
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="홈쇼핑 닫기" hitSlop={10} style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            라룹 홈쇼핑
          </Text>
          <View style={styles.onAir}>
            <View style={styles.onAirDot} />
            <Text style={styles.onAirText}>ON AIR</Text>
          </View>
          <View style={styles.headerSpacer} />
          {balance !== null ? <Text style={styles.balance}>{balance}룹</Text> : null}
        </View>

        {shop ? (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
            {broadcastItem ? (
              <View accessibilityLabel="오늘의 방송 상품" style={styles.broadcast}>
                <Text style={styles.broadcastLabel}>오늘의 방송 상품</Text>
                <View style={styles.broadcastRow}>
                  <FurnitureImage type={broadcastItem.type} size={96} />
                  <View style={styles.broadcastInfo}>
                    <Text style={styles.broadcastName}>{furnitureType(broadcastItem.type).name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.originalPrice}>{shop.broadcast.price}룹</Text>
                      <Text style={styles.salePrice}>{shop.broadcast.salePrice}룹</Text>
                      <Text style={styles.discount}>20%</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.hostBubble}>
                  <Text style={styles.hostText}>라룹이: “{hostLine}”</Text>
                </View>
                {orderButton(broadcastItem, true)}
              </View>
            ) : null}

            {shop.items.map((item) => (
              <View key={item.type} style={styles.itemRow}>
                <FurnitureImage type={item.type} size={56} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{furnitureType(item.type).name}</Text>
                  <Text style={styles.itemPrice}>{priceOf(item)}룹</Text>
                  <Text style={styles.owned}>{item.owned}개 있음</Text>
                </View>
                {orderButton(item)}
              </View>
            ))}
          </ScrollView>
        ) : loadFailed ? (
          <View style={styles.center}>
            <Text style={styles.message}>홈쇼핑을 불러오지 못했어요</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>{loading ? <ActivityIndicator color={ACCENT} /> : null}</View>
        )}

        {confirming ? (
          <View style={styles.dim}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <Text style={styles.dialogText}>
                {withObjectParticle(furnitureType(confirming.type).name)} {priceOf(confirming)}룹에 주문할까요?
              </Text>
              <View style={styles.dialogButtons}>
                <Pressable accessibilityRole="button" style={styles.dialogCancel} disabled={ordering} onPress={() => setConfirming(null)}>
                  <Text style={styles.dialogCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: ordering }}
                  disabled={ordering}
                  style={[styles.dialogOk, ordering && styles.orderButtonOff]}
                  onPress={() => void order(confirming)}
                >
                  {ordering ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.dialogOkText}>주문</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {ordered ? (
          <View style={styles.dim}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <FurnitureImage type={ordered.type} size={72} />
              <Text style={styles.dialogText}>택배가 보관함에 도착했어요</Text>
              <View style={styles.dialogButtons}>
                <Pressable accessibilityRole="button" style={styles.dialogCancel} onPress={() => setOrdered(null)}>
                  <Text style={styles.dialogCancelText}>계속 쇼핑하기</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.dialogOk}
                  onPress={() => {
                    const result = ordered;
                    setOrdered(null);
                    onPlaceNow(result);
                  }}
                >
                  <Text style={styles.dialogOkText}>바로 놓기</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {toast ? (
          <View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 24 }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF4E6" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: LINE },
  closeButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: LINE, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  closeText: { fontSize: 16, fontWeight: "800", color: LINE },
  title: { fontSize: 18, fontWeight: "800", color: "#2B1810" },
  onAir: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "#D93A2B" },
  onAirDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
  onAirText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 },
  headerSpacer: { flex: 1 },
  balance: { fontSize: 15, fontWeight: "800", color: ACCENT },
  content: { padding: 16, gap: 12 },
  broadcast: { gap: 10, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFFFFF" },
  broadcastLabel: { alignSelf: "flex-start", fontSize: 12, fontWeight: "800", color: "#FFFFFF", backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  broadcastRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  broadcastInfo: { flex: 1, gap: 6 },
  broadcastName: { fontSize: 20, fontWeight: "800", color: "#2B1810" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  originalPrice: { fontSize: 14, color: "#8A6A55", textDecorationLine: "line-through" },
  salePrice: { fontSize: 20, fontWeight: "800", color: ACCENT },
  discount: { fontSize: 13, fontWeight: "800", color: "#D93A2B" },
  hostBubble: { padding: 10, borderRadius: 12, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFF7EE" },
  hostText: { fontSize: 14, fontWeight: "600", color: "#2B1810" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFFFFF" },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#2B1810" },
  itemPrice: { fontSize: 14, fontWeight: "800", color: ACCENT },
  owned: { fontSize: 12, color: "#8A6A55" },
  imageBox: { borderRadius: 12, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFF7EE", alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 18, fontWeight: "800", color: "#2B1810" },
  orderWrap: { alignItems: "flex-end", gap: 4, maxWidth: 120 },
  bigOrderWrap: { alignItems: "stretch", gap: 4 },
  orderButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: LINE, backgroundColor: ACCENT },
  bigOrderButton: { alignItems: "center", paddingVertical: 12 },
  orderButtonOff: { opacity: 0.45 },
  orderText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  bigOrderText: { fontSize: 16 },
  shortText: { fontSize: 11, color: "#8A6A55", textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  message: { fontSize: 15, color: "#2B1810" },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFFFFF" },
  retryText: { fontSize: 14, fontWeight: "700", color: "#2B1810" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(43, 24, 16, 0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 360, alignItems: "center", gap: 14, padding: 20, borderRadius: 18, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFFFFF" },
  dialogText: { fontSize: 16, fontWeight: "700", color: "#2B1810", textAlign: "center" },
  dialogButtons: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  dialogCancel: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 999, borderWidth: 2, borderColor: LINE, backgroundColor: "#FFFFFF" },
  dialogCancelText: { fontSize: 14, fontWeight: "700", color: "#2B1810" },
  dialogOk: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 999, borderWidth: 2, borderColor: LINE, backgroundColor: ACCENT },
  dialogOkText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  toast: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  toastText: { overflow: "hidden", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(43, 24, 16, 0.88)", color: "#FFFFFF", fontSize: 14, fontWeight: "600" }
});
