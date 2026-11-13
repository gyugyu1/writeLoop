import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, getHomeShopping, getWardrobe, orderHomeShopping, orderHomeShoppingAny, orderHomeShoppingWearable, saveWardrobeEquipped } from "@/lib/api";
import { useItemCatalog } from "@/lib/item-catalog-store";
import { useItemFiles } from "@/lib/item-files";
import { closetEquipped } from "@/lib/lobby3d/closet";
import { furnitureIcon } from "@/lib/lobby3d/furniture-icons";
import { wearableSlotOf } from "@/lib/lobby3d/wear";
import { wearableIcon } from "@/lib/lobby3d/wearable-icons";
import type { HomeShopping, HomeShoppingAnyOrderResult, HomeShoppingItem, HomeShoppingOrderResult, HomeShoppingWearableOrderResult, Wardrobe } from "@/lib/types";
import {
  SHOP_CATEGORIES,
  inShopCategory,
  isShopFurniture,
  isShopKnown,
  isShopWearable,
  shopPlacement,
  shopProductDescription,
  shopProductName,
  shopWearPlace,
  type ShopCategory
} from "./home-shopping-catalog";

// 라룹 홈쇼핑: 로비 위에 전체 화면으로 열린다. 위 줄(닫기·제목·잔액)은 늘 보이고, 그 아래로 오늘의 방송,
// 분류 탭, 2열 상품 카드가 스크롤된다. 상품을 누르면 아래에서 상세창이 올라오고 거기서 주문한다.
// 산 가구는 서버가 배치의 보관함에 더하고, 주문 결과(배치·잔액)는 홈이 받아 로비에 반영한다.
// 보유 개수는 보이지 않는다(데이터와 주문 처리는 그대로).

const C = {
  bg: "#FFF8EE",
  paper: "#FFFEFB",
  ink: "#3D291C",
  muted: "#796655",
  line: "#E7D9C5",
  soft: "#F4E8D6",
  accent: "#BF4C13",
  button: "#C85720",
  buttonText: "#FFFAF4",
  live: "#D93A2B"
};
const ORDER_FAILED = "주문하지 못했어요. 다시 시도해 주세요";
const WEAR_FAILED = "입지 못했어요. 다시 시도해 주세요";
const OWNED_LABEL = "가진 옷";
const DAY_MS = 24 * 60 * 60 * 1000;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
/** 오늘의 방송 상품을 소개하는 라룹이 쇼호스트 말. 화면을 열 때마다 하나를 고른다. */
export const HOST_LINES = ["오늘만 20%! 지금 주문하세요", "방송 중에만 이 가격이에요!", "매진되기 전에 서두르세요!"];

interface HomeShoppingSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 홈쇼핑 목록이나 주문으로 알게 된 잔액(로비 칩). */
  onBalance: (balance: number) => void;
  /** 주문에 성공했을 때(가구면 홈이 배치를 주문 결과로 바꾼다. 옷은 배치가 null이다). */
  onOrdered: (result: HomeShoppingAnyOrderResult) => void;
  /** 완료 판의 '바로 놓기'(홈이 홈쇼핑을 닫고 꾸미기를 그 가구를 꺼낸 채로 연다). */
  onPlaceNow: (result: HomeShoppingOrderResult) => void;
  /** 옷 완료 판의 '바로 입기'가 저장됐을 때(홈이 홈쇼핑을 닫고 라룹이에게 바로 입힌다). */
  onWore?: (wardrobe: Wardrobe) => void;
}

/** 가진 옷인지(가구는 늘 false). */
function ownedWearable(item: HomeShoppingItem): boolean {
  return isShopWearable(item.type) && item.owned > 0;
}

/** 그 가구를 지금 사는 가격(방송 상품이면 할인 가격). */
function priceOf(item: HomeShoppingItem): number {
  return item.salePrice ?? item.price;
}

/** 할인율(%, 정수). 할인이 없으면 null. */
function discountOf(item: HomeShoppingItem): number | null {
  if (item.salePrice === null || item.price <= 0 || item.salePrice >= item.price) return null;
  return Math.round(((item.price - item.salePrice) / item.price) * 100);
}

/** 서울 자정(오늘의 방송이 끝나는 때)까지 남은 시간 "H:MM:SS". */
function untilSeoulMidnight(nowMs: number): string {
  // 자정 정각은 "24:00:00"이 아니라 "0:00:00"(곧 다음 날 방송으로 바뀐다)
  const left = (DAY_MS - ((nowMs + SEOUL_OFFSET_MS) % DAY_MS)) % DAY_MS;
  const total = Math.floor(left / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 서울 날짜 번호(하루에 1씩 는다). 방송 상품이 바뀌는 날을 알아보는 데 쓴다. */
function seoulDayOf(nowMs: number): number {
  return Math.floor((nowMs + SEOUL_OFFSET_MS) / DAY_MS);
}

function ProductImage({ type, size }: { type: string; size: number }) {
  // 가구 아이콘은 홈쇼핑을 열 때 받는다(받으면 다시 그린다. 그 전에는 이름 첫 글자 칸)
  useItemFiles();
  const icon = furnitureIcon(type) ?? wearableIcon(type);
  return icon ? (
    <Image source={icon} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
  ) : (
    <Text style={[styles.initial, { fontSize: Math.max(18, size / 3) }]}>{shopProductName(type).slice(0, 1)}</Text>
  );
}

/** 깜빡이는 방송 점. 동작 줄이기면 깜빡이지 않는다. */
function LiveDot({ reduceMotion }: { reduceMotion: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

export default function HomeShoppingSheet({ visible, onClose, onBalance, onOrdered, onPlaceNow, onWore }: HomeShoppingSheetProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // 아이템 목록이 바뀌면(받으면) 이름·설명·분류를 다시 그린다
  useItemCatalog();
  const [shop, setShop] = useState<HomeShopping | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hostLine, setHostLine] = useState(HOST_LINES[0]);
  const [category, setCategory] = useState<ShopCategory>("all");
  /** 상세창에 연 상품 종류(없으면 상세창이 닫혀 있다). */
  const [detailType, setDetailType] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  /** 주문 성공 결과(있으면 상세창 자리에 완료 판이 보인다). */
  const [ordered, setOrdered] = useState<HomeShoppingAnyOrderResult | null>(null);
  /** 옷 완료 판의 '바로 입기'를 저장하는 중(그동안 닫기·뒤로 가기를 받지 않는다). */
  const [wearing, setWearing] = useState(false);
  const wearingRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reduceMotion, setReduceMotion] = useState(false);
  const requestRef = useRef(0);
  // 닫힐 때마다 1씩 는다. 주문은 시작할 때의 값을 기억해, 그사이 닫혔으면(다시 열었어도) 응답으로 화면을 바꾸지 않는다
  const openRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 같은 렌더 안에서 두 번 눌러도 주문은 한 번(상태는 다음 렌더에야 바뀐다)
  const orderingRef = useRef(false);
  // 마지막으로 목록을 불러온 서울 날짜. 열어 둔 채 자정을 넘기면 새 방송으로 다시 불러온다
  const loadedDayRef = useRef(0);
  const sheetY = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    // 앱을 켜 둔 채 설정을 바꿔도 따른다(홈쇼핑은 홈과 함께 늘 마운트되어 있다)
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (alive) setReduceMotion(enabled);
    });
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);

  // 방송 종료까지 남은 시간: 열려 있는 동안 1초마다
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const load = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    loadedDayRef.current = seoulDayOf(Date.now());
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

  // 열릴 때마다 목록을 새로 불러오고 쇼호스트 말을 고른다. 닫으면 판들을 닫고 목록·분류를 처음으로 돌린다
  useEffect(() => {
    if (!visible) {
      requestRef.current += 1;
      openRef.current += 1;
      setShop(null);
      setLoadFailed(false);
      setDetailType(null);
      setOrdered(null);
      setOrdering(false);
      setWearing(false);
      wearingRef.current = false;
      // 기다리던 주문의 응답은 openRef로 버리므로, 다시 열면 바로 주문할 수 있게 막기도 푼다
      orderingRef.current = false;
      setCategory("all");
      return;
    }
    setHostLine(HOST_LINES[Math.floor(Math.random() * HOST_LINES.length)]);
    void load();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // 열어 둔 채 서울 자정을 넘기면 오늘의 방송이 바뀌었으니 목록을 다시 불러온다
  const seoulDay = seoulDayOf(now);
  useEffect(() => {
    if (!visible || seoulDay <= loadedDayRef.current) return;
    void load();
  }, [visible, seoulDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = (type: string) => {
    setOrdered(null);
    setDetailType(type);
    if (reduceMotion) {
      sheetY.setValue(0);
      return;
    }
    sheetY.setValue(320);
    Animated.timing(sheetY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  /** 상세창(또는 완료 판)을 닫는다. 목록·분류·스크롤은 그대로다. 주문 중이면 닫지 않는다. */
  const closeDetail = () => {
    if (ordering || wearingRef.current) return;
    setDetailType(null);
    setOrdered(null);
  };

  const order = async (item: HomeShoppingItem) => {
    if (orderingRef.current) return;
    orderingRef.current = true;
    const opened = openRef.current;
    setOrdering(true);
    try {
      const request = { type: item.type, price: priceOf(item) };
      // 앱이 아는 옷·가구는 그 함수로, 모르는 상품(서버가 나중에 더한 것)은 응답 모양으로 가린다(룹이 쓰였는데 실패로 보이지 않게)
      const result: HomeShoppingAnyOrderResult = isShopWearable(item.type)
        ? await orderHomeShoppingWearable(request)
        : isShopFurniture(item.type)
          ? await orderHomeShopping(request)
          : await orderHomeShoppingAny(request);
      // 주문은 서버에서 됐으니 잔액·로비 배치는 늘 반영한다
      onBalance(result.balance);
      onOrdered(result);
      // 기다리는 동안 닫았으면(다시 열었어도) 이 화면의 판·목록은 바꾸지 않는다
      if (opened !== openRef.current) return;
      setShop((current) =>
        current
          ? {
              ...current,
              balance: result.balance,
              items: current.items.map((candidate) => (candidate.type === result.type ? { ...candidate, owned: result.owned } : candidate))
            }
          : current
      );
      setOrdered(result);
    } catch (error) {
      if (opened !== openRef.current) return;
      showToast(error instanceof ApiError && error.message ? error.message : ORDER_FAILED);
      // 가격이 바뀌었거나 이미 가진 옷이면 목록을 다시 불러온다. 상세창은 열린 채 새 값으로 바뀐다
      if (error instanceof ApiError && (error.code === "PRICE_CHANGED" || error.code === "ALREADY_OWNED")) void load();
    } finally {
      // 그사이 닫혔으면 막기는 닫을 때 이미 풀었다(다시 연 화면의 새 주문 막기를 풀지 않는다)
      if (opened === openRef.current) {
        orderingRef.current = false;
        setOrdering(false);
      }
    }
  };

  // 기기 뒤로 가기: 주문을 기다리는 중이면 홈쇼핑을 닫고(늦은 응답은 openRef로 버린다),
  // 상세창(완료 판)이 열려 있으면 그것만 닫고, 아니면 홈쇼핑을 닫는다
  const handleBack = () => {
    if (wearingRef.current) return;
    if (ordering) {
      onClose();
      return;
    }
    if (detailType !== null || ordered !== null) {
      closeDetail();
      return;
    }
    onClose();
  };

  /** 옷 완료 판의 '바로 입기': 주문 결과의 입은 것(없거나 깨졌으면 옷장을 불러와서)에서 그 옷의 부위만 바꿔 저장한다. */
  const wearNow = async (result: HomeShoppingWearableOrderResult) => {
    const slot = wearableSlotOf(result.type);
    if (!slot || wearingRef.current) return;
    wearingRef.current = true;
    const opened = openRef.current;
    setWearing(true);
    try {
      const base = result.wardrobe && result.wardrobe.equipped && typeof result.wardrobe.equipped === "object" ? result.wardrobe : await getWardrobe();
      if (!base) throw new Error(WEAR_FAILED);
      const saved = await saveWardrobeEquipped({ ...closetEquipped(base), [slot]: result.type });
      if (opened !== openRef.current) return;
      wearingRef.current = false;
      setWearing(false);
      setOrdered(null);
      setDetailType(null);
      onWore?.(saved);
    } catch {
      if (opened !== openRef.current) return;
      wearingRef.current = false;
      setWearing(false);
      showToast(WEAR_FAILED);
    }
  };

  const balance = shop?.balance ?? null;
  // 앱이 그릴 줄 모르는 상품(서버가 새로 더한 것)은 보이지 않는다. 방송 상품이 그런 것이면 방송 칸을 숨긴다
  const knownItems = shop ? shop.items.filter((item) => isShopKnown(item.type)) : [];
  const broadcastItem = shop ? knownItems.find((item) => item.type === shop.broadcast.type) ?? null : null;
  const visibleItems = knownItems.filter((item) => inShopCategory(item.type, category));
  const categoryInfo = SHOP_CATEGORIES.find((entry) => entry.id === category) ?? SHOP_CATEGORIES[0];
  const detailItem = shop && detailType ? shop.items.find((item) => item.type === detailType) ?? null : null;
  const sheetOpen = detailItem !== null || ordered !== null;

  // 2열 카드 폭: 화면 폭에서 좌우 여백(16)과 칸 사이(12)를 뺀 절반
  const sidePad = screenWidth < 360 ? 12 : 16;
  const cardWidth = Math.floor((screenWidth - sidePad * 2 - 12) / 2);
  const cardArt = Math.max(84, Math.min(150, cardWidth - 28));
  // 방송 그림: 넉넉하게(작은 화면에서는 줄인다)
  const featureArt = Math.max(130, Math.min(184, Math.floor((screenWidth - sidePad * 2) * 0.46)));

  const renderDetail = (item: HomeShoppingItem) => {
    const price = priceOf(item);
    const shortage = balance === null ? 0 : Math.max(0, price - balance);
    const wearPlace = shopWearPlace(item.type);
    const placement = wearPlace ? null : shopPlacement(item.type);
    const description = shopProductDescription(item.type);
    const discount = discountOf(item);
    const owned = ownedWearable(item);
    // 가진 옷이면 룹이 모자라도 이 글이 먼저다
    const orderLabel = owned ? "이미 가진 옷이에요" : shortage > 0 ? `${shortage}룹 더 필요해요` : `${price}룹에 주문하기`;
    const orderOff = owned || shortage > 0 || ordering;
    return (
      <>
        <View style={styles.detailArt}>
          <ProductImage type={item.type} size={170} />
          {discount !== null ? (
            <View style={styles.saleBadge}>
              <Text style={styles.saleBadgeText}>{discount}%</Text>
            </View>
          ) : null}
          {owned ? (
            <View style={styles.ownedBadge}>
              <Text style={styles.ownedBadgeText}>{OWNED_LABEL}</Text>
            </View>
          ) : null}
        </View>
        <Text accessibilityRole="header" style={styles.detailTitle}>
          {shopProductName(item.type)}
        </Text>
        {description ? <Text style={styles.detailDescription}>{description}</Text> : null}
        {wearPlace ? (
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>입는 곳</Text>
              <Text style={styles.factValue}>{wearPlace}</Text>
            </View>
          </View>
        ) : null}
        {placement ? (
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>놓는 위치</Text>
              <Text style={styles.factValue}>{placement.where}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>차지하는 크기</Text>
              <Text style={styles.factValue}>{placement.size}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.checkout}>
          <View style={styles.balanceLine}>
            <Text style={styles.balanceLabel}>{owned ? "옷장에 있는 옷이에요" : shortage > 0 ? "조금만 더 모으면 살 수 있어요" : "주문 후 남는 룹"}</Text>
            <Text style={[styles.balanceValue, !owned && shortage > 0 && styles.shortValue]}>
              {owned ? "" : shortage > 0 ? `${shortage}룹 부족` : balance === null ? "" : `${balance - price}룹`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={orderLabel}
            accessibilityState={{ disabled: orderOff, busy: ordering }}
            disabled={orderOff}
            style={[styles.primary, orderOff && styles.primaryOff]}
            onPress={() => void order(item)}
          >
            {ordering ? <ActivityIndicator color={C.buttonText} /> : <Text style={styles.primaryText}>{orderLabel}</Text>}
          </Pressable>
        </View>
      </>
    );
  };

  const renderSuccess = (result: HomeShoppingAnyOrderResult) => (result.layout === null ? renderWearableSuccess(result) : renderFurnitureSuccess(result));

  // 옷 완료 판: 옷장에 도착, '계속 구경하기'와 '바로 입기'(저장하는 동안 둘 다 쓸 수 없다)
  const renderWearableSuccess = (result: HomeShoppingWearableOrderResult) => (
    <View style={styles.success}>
      <View style={styles.detailArt}>
        <ProductImage type={result.type} size={150} />
      </View>
      <Text accessibilityRole="header" style={styles.successTitle}>
        옷장에 도착했어요
      </Text>
      <Text style={styles.successMessage}>
        {shopProductName(result.type)} · 남은 룹 {result.balance}
      </Text>
      <View style={styles.successActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: wearing }}
          disabled={wearing}
          style={[styles.secondary, wearing && styles.primaryOff]}
          onPress={closeDetail}
        >
          <Text style={styles.secondaryText}>계속 구경하기</Text>
        </Pressable>
        {/* 앱이 그릴 줄 모르는 옷(받은 목록에 그리기 정보가 없거나 몸 판이 다름)은 '바로 입기'를 두지 않는다 */}
        {isShopWearable(result.type) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="바로 입기"
            accessibilityState={{ disabled: wearing, busy: wearing }}
            disabled={wearing}
            style={[styles.primaryFlex, wearing && styles.primaryOff]}
            onPress={() => void wearNow(result)}
          >
            {wearing ? <ActivityIndicator color={C.buttonText} /> : <Text style={styles.primaryText}>바로 입기</Text>}
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderFurnitureSuccess = (result: HomeShoppingOrderResult) => (
    <View style={styles.success}>
      <View style={styles.detailArt}>
        <ProductImage type={result.type} size={150} />
      </View>
      <Text accessibilityRole="header" style={styles.successTitle}>
        보관함에 도착했어요
      </Text>
      <Text style={styles.successMessage}>
        {shopProductName(result.type)} 1개 · 남은 룹 {result.balance}
      </Text>
      <View style={styles.successActions}>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={closeDetail}>
          <Text style={styles.secondaryText}>계속 구경하기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.primaryFlex}
          onPress={() => {
            setOrdered(null);
            setDetailType(null);
            onPlaceNow(result);
          }}
        >
          <Text style={styles.primaryText}>바로 놓기</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={handleBack} statusBarTranslucent>
      <View style={styles.root}>
        {/* 위 줄: 스크롤해도 늘 보인다 */}
        <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: Math.max(8, insets.left + 4), paddingRight: Math.max(14, insets.right + 10) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="홈쇼핑 닫기" hitSlop={6} style={styles.iconButton} onPress={() => {
              if (!wearingRef.current) onClose();
            }}>
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            라룹 홈쇼핑
          </Text>
          {balance !== null ? (
            <View accessibilityLabel={`잔액 ${balance}룹`} style={styles.wallet}>
              <View style={styles.coin} />
              <Text style={styles.walletText}>{balance}룹</Text>
            </View>
          ) : null}
        </View>

        {shop ? (
          <ScrollView
            accessibilityElementsHidden={sheetOpen}
            importantForAccessibility={sheetOpen ? "no-hide-descendants" : "auto"}
            contentContainerStyle={[styles.content, { paddingHorizontal: sidePad, paddingBottom: insets.bottom + 28 }]}
          >
            {broadcastItem ? (
              // 방송 칸 전체가 버튼이다(ON AIR 줄, 남은 시간, 라룹이 소개를 눌러도 상세창이 열린다)
              <Pressable
                accessibilityRole="button"
                // 칸 전체가 한 버튼이라 할인율도 이름에 넣는다(1초마다 바뀌는 남은 시간은 넣지 않는다. 계속 다시 읽힌다)
                accessibilityLabel={`오늘의 방송 상품 ${shopProductName(broadcastItem.type)}, ${shop.broadcast.salePrice}룹, ${discountOf(broadcastItem) ?? 20}% 할인, 자세히 보기`}
                style={styles.broadcast}
                onPress={() => openDetail(broadcastItem.type)}
              >
                <View style={styles.broadcastTop}>
                  <View style={styles.onAir}>
                    <LiveDot reduceMotion={reduceMotion} />
                    <Text style={styles.onAirText}>ON AIR</Text>
                  </View>
                  <Text style={styles.broadcastKicker}>오늘은 {discountOf(broadcastItem) ?? 20}% 할인</Text>
                </View>
                <View style={styles.feature}>
                  <View style={[styles.featureArt, { width: featureArt, height: featureArt }]}>
                    <View style={[styles.featureHalo, { width: featureArt - 18, height: featureArt - 18, borderRadius: (featureArt - 18) / 2 }]} />
                    <ProductImage type={broadcastItem.type} size={featureArt - 10} />
                    {ownedWearable(broadcastItem) ? (
                      <View style={styles.ownedBadge}>
                        <Text style={styles.ownedBadgeText}>{OWNED_LABEL}</Text>
                      </View>
                    ) : (
                      <View style={styles.soldOutSoon}>
                        <Text style={styles.soldOutSoonText}>품절 임박</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureLabel}>오늘의 방송 상품</Text>
                    <Text style={styles.featureName}>{shopProductName(broadcastItem.type)}</Text>
                    <View style={styles.prices}>
                      <Text style={styles.originalPrice}>{shop.broadcast.price}룹</Text>
                      <Text style={styles.salePrice}>{shop.broadcast.salePrice}룹</Text>
                    </View>
                    <Text style={styles.discount}>{discountOf(broadcastItem) ?? 20}%</Text>
                    <View style={styles.rushChip}>
                      <Text style={styles.rushText}>주문 폭주 중</Text>
                    </View>
                    <View style={styles.linkRow}>
                      <Text style={styles.link}>자세히 보기</Text>
                      <Text style={styles.link}>›</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.countdown}>
                  <Text style={styles.countdownText}>방송 종료까지 {untilSeoulMidnight(now)}</Text>
                </View>
                <View style={styles.host}>
                  <Text style={styles.hostText}>라룹이: “{hostLine}”</Text>
                </View>
              </Pressable>
            ) : null}

            <View accessibilityRole="tablist" style={styles.categories}>
              {SHOP_CATEGORIES.map((entry) => {
                const selected = entry.id === category;
                return (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[styles.categoryButton, selected && styles.categoryButtonOn]}
                    onPress={() => setCategory(entry.id)}
                  >
                    <Text style={[styles.categoryText, selected && styles.categoryTextOn]}>{entry.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.listLabel}>
              <Text style={styles.listTitle}>{categoryInfo.label}</Text>
              <Text style={styles.listCount}>{visibleItems.length}가지</Text>
            </View>

            <View style={styles.grid}>
              {visibleItems.map((item) => {
                const discount = discountOf(item);
                const name = shopProductName(item.type);
                const label = discount !== null ? `${name}, ${priceOf(item)}룹, ${discount}% 할인, 자세히 보기` : `${name}, ${priceOf(item)}룹, 자세히 보기`;
                return (
                  <Pressable key={item.type} accessibilityRole="button" accessibilityLabel={label} style={{ width: cardWidth }} onPress={() => openDetail(item.type)}>
                    <View style={[styles.cardArt, { height: Math.round(cardWidth / 1.15) }]}>
                      <ProductImage type={item.type} size={cardArt} />
                      {discount !== null ? (
                        <View style={styles.saleBadge}>
                          <Text style={styles.saleBadgeText}>{discount}%</Text>
                        </View>
                      ) : null}
                      {ownedWearable(item) ? (
                        <View style={styles.ownedBadge}>
                          <Text style={styles.ownedBadgeText}>{OWNED_LABEL}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={styles.cardName}>
                      {name}
                    </Text>
                    <Text style={styles.cardPrice}>{priceOf(item)}룹</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : loadFailed ? (
          <View style={styles.center}>
            <Text style={styles.message}>홈쇼핑을 불러오지 못했어요</Text>
            <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>{loading ? <ActivityIndicator color={C.accent} /> : null}</View>
        )}

        {sheetOpen ? (
          <View style={styles.shade}>
            {/* 어두운 뒤를 누르면 닫힌다(화면 읽기에서는 판의 닫기 버튼을 쓴다) */}
            <Pressable accessible={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={closeDetail} />
            <Animated.View
              accessibilityViewIsModal
              style={[styles.sheet, { paddingBottom: insets.bottom + 18, transform: [{ translateY: sheetY }] }]}
            >
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetLabel}>{ordered ? "주문 완료" : "상품 자세히 보기"}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="상품 상세 닫기" hitSlop={6} style={styles.iconButton} onPress={closeDetail}>
                  <Text style={styles.iconText}>✕</Text>
                </Pressable>
              </View>
              <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
                {ordered ? renderSuccess(ordered) : detailItem ? renderDetail(detailItem) : null}
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}

        {toast ? (
          <View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 24 }]}>
            <Text accessibilityLiveRegion="polite" style={styles.toastText}>
              {toast}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.paper },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 18, fontWeight: "700", color: C.ink },
  title: { flex: 1, fontSize: 17, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  wallet: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: C.soft },
  coin: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#F2A93B", borderWidth: 2, borderColor: "#D98A1C" },
  walletText: { fontSize: 13, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] },
  content: { paddingTop: 16, gap: 0 },
  broadcast: { borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 18, overflow: "hidden", marginBottom: 18 },
  broadcastTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 12 },
  onAir: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: C.live },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
  onAirText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.6 },
  broadcastKicker: { fontSize: 12, fontWeight: "700", color: C.accent },
  feature: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  featureArt: { alignItems: "center", justifyContent: "center" },
  featureHalo: { position: "absolute", backgroundColor: C.soft },
  soldOutSoon: { position: "absolute", top: 4, left: 0, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.ink },
  soldOutSoonText: { fontSize: 11, fontWeight: "800", color: "#FFF4E0" },
  featureInfo: { flex: 1, minWidth: 0, gap: 4 },
  featureLabel: { fontSize: 12, color: C.muted },
  featureName: { fontSize: 19, fontWeight: "800", color: C.ink },
  prices: { flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  originalPrice: { fontSize: 13, color: C.muted, textDecorationLine: "line-through" },
  salePrice: { fontSize: 22, fontWeight: "800", color: C.accent },
  discount: { fontSize: 12, fontWeight: "800", color: C.live },
  rushChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: C.live },
  rushText: { fontSize: 11, fontWeight: "800", color: C.live },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  link: { fontSize: 12, fontWeight: "800", color: C.ink },
  countdown: { marginHorizontal: 14, marginBottom: 10, paddingVertical: 6, borderRadius: 10, alignItems: "center", backgroundColor: C.soft },
  countdownText: { fontSize: 12, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] },
  host: { borderTopWidth: 1, borderTopColor: C.line, borderStyle: "dashed", paddingHorizontal: 14, paddingVertical: 10 },
  hostText: { fontSize: 13, color: C.muted },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  categoryButton: { minHeight: 44, paddingHorizontal: 13, justifyContent: "center", borderRadius: 22 },
  categoryButtonOn: { backgroundColor: C.ink },
  categoryText: { fontSize: 14, color: C.muted },
  categoryTextOn: { color: C.bg, fontWeight: "800" },
  listLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11 },
  listTitle: { fontSize: 15, fontWeight: "800", color: C.ink },
  listCount: { fontSize: 12, color: C.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  cardArt: { alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, marginBottom: 7 },
  cardName: { marginHorizontal: 2, fontSize: 14, fontWeight: "700", color: C.ink },
  cardPrice: { marginHorizontal: 2, marginTop: 1, fontSize: 14, fontWeight: "800", color: C.accent, fontVariant: ["tabular-nums"] },
  saleBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: C.accent },
  ownedBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: C.ink },
  ownedBadgeText: { fontSize: 11, fontWeight: "700", color: C.buttonText },
  saleBadgeText: { fontSize: 11, fontWeight: "800", color: C.buttonText },
  initial: { fontWeight: "800", color: C.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  message: { fontSize: 15, color: C.ink },
  retryButton: { minHeight: 44, paddingHorizontal: 18, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  retryText: { fontSize: 14, fontWeight: "700", color: C.ink },
  shade: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(44, 32, 25, 0.38)" },
  sheet: { maxHeight: "88%", paddingHorizontal: 20, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: C.paper },
  handle: { alignSelf: "center", width: 34, height: 4, borderRadius: 2, backgroundColor: C.line },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sheetLabel: { fontSize: 12, color: C.muted },
  sheetBody: { paddingBottom: 4 },
  detailArt: { height: 180, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: C.bg },
  detailTitle: { marginTop: 15, fontSize: 21, fontWeight: "800", color: C.ink },
  detailDescription: { marginTop: 5, fontSize: 14, lineHeight: 20, color: C.muted },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  fact: { flexGrow: 1, flexBasis: 120, gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.soft },
  factLabel: { fontSize: 11, color: C.muted },
  factValue: { fontSize: 14, fontWeight: "700", color: C.ink },
  checkout: { marginTop: 16, paddingTop: 15, borderTopWidth: 1, borderTopColor: C.line },
  balanceLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  balanceLabel: { flexShrink: 1, fontSize: 13, color: C.muted },
  balanceValue: { fontSize: 14, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] },
  shortValue: { color: C.live },
  primary: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 14, backgroundColor: C.button },
  primaryFlex: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 14, backgroundColor: C.button },
  primaryOff: { opacity: 0.55 },
  primaryText: { fontSize: 15, fontWeight: "800", color: C.buttonText },
  secondary: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 14, backgroundColor: C.soft },
  secondaryText: { fontSize: 15, fontWeight: "800", color: C.ink },
  success: { paddingTop: 8, alignItems: "stretch" },
  successTitle: { marginTop: 16, marginBottom: 6, fontSize: 20, fontWeight: "800", color: C.ink, textAlign: "center" },
  successMessage: { fontSize: 14, color: C.muted, textAlign: "center" },
  successActions: { flexDirection: "row", gap: 8, marginTop: 22 },
  toast: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toastText: { overflow: "hidden", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: C.ink, color: C.bg, fontSize: 13, textAlign: "center" }
});
