import { catalogItem } from "@/lib/item-catalog-store";
import { CLOSET_SLOTS } from "@/lib/lobby3d/closet";
import { furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { WEARABLE_ITEMS, wearDraw, wearableSlotOf } from "@/lib/lobby3d/wear";

// 라룹 홈쇼핑에서만 쓰는 상품 표시 값: 홈쇼핑 이름, 분류, 짧은 설명. 가격·할인·방송 상품은 서버 목록을 따른다.
// 이름·분류·설명은 서버 아이템 목록(item-catalog)의 shopName·category·description이고, 목록에 없는 종류는 아래 표(앱에 든 기본값)다.
// 꾸미기 보관함의 이름(목록의 name, 없으면 furniture-catalog의 name)은 따로다.

export type ShopCategory = "all" | "furniture" | "lighting" | "decor" | "plants" | "clothes";

export const SHOP_CATEGORIES: { id: ShopCategory; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "furniture", label: "가구" },
  { id: "lighting", label: "조명" },
  { id: "decor", label: "장식" },
  { id: "plants", label: "식물" },
  { id: "clothes", label: "옷" }
];

interface ShopProductInfo {
  name: string;
  category: Exclude<ShopCategory, "all">;
  description: string;
}

const PRODUCT_INFO: Record<string, ShopProductInfo> = {
  bed: { name: "침대", category: "furniture", description: "하루를 마무리하는 포근한 자리예요." },
  wardrobe: { name: "옷장", category: "furniture", description: "방 한쪽을 차분하게 채우는 기본 옷장이에요." },
  nightstand: { name: "협탁", category: "furniture", description: "윗면에 조명이나 작은 소품을 올려 보세요." },
  lamp: { name: "탁상 스탠드", category: "lighting", description: "책상이나 협탁 위를 따뜻하게 밝혀 줘요." },
  floorLamp: { name: "바닥 스탠드", category: "lighting", description: "침대 옆이나 방 구석에 작은 빛을 더해요." },
  frame: { name: "액자", category: "decor", description: "허전한 벽을 채우는 작은 그림이에요." },
  rug: { name: "러그", category: "decor", description: "가구 아래에 깔아 공간을 아늑하게 묶어 줘요." },
  books: { name: "책", category: "decor", description: "책 몇 권을 쌓아 나만의 독서 분위기를 만들어요." },
  smallPlant: { name: "작은 화분", category: "plants", description: "작은 초록 하나로 책상이 산뜻해져요." },
  plant: { name: "큰 화분", category: "plants", description: "빈 공간에 싱그러운 초록을 더해 보세요." },
  // 옷(라룹이 착용 아이템): 이름은 앱 착용 아이템 이름과 같다
  capOrange: { name: WEARABLE_ITEMS.capOrange.label, category: "clothes", description: "발바닥 무늬가 들어간 산뜻한 주황 모자예요." },
  tshirtOrange: { name: WEARABLE_ITEMS.tshirtOrange.label, category: "clothes", description: "어디에나 잘 어울리는 편한 주황 티셔츠예요." },
  shortsNavy: { name: WEARABLE_ITEMS.shortsNavy.label, category: "clothes", description: "가볍게 움직이기 좋은 남색 반바지예요." },
  shoesBrown: { name: WEARABLE_ITEMS.shoesBrown.label, category: "clothes", description: "폭신하게 걷기 좋은 갈색 운동화예요." },
  capBlue: { name: WEARABLE_ITEMS.capBlue.label, category: "clothes", description: "발바닥 무늬가 들어간 시원한 파랑 모자예요." },
  capGreen: { name: WEARABLE_ITEMS.capGreen.label, category: "clothes", description: "발바닥 무늬가 들어간 싱그러운 초록 모자예요." },
  tshirtWhite: { name: WEARABLE_ITEMS.tshirtWhite.label, category: "clothes", description: "무엇과도 잘 어울리는 깔끔한 흰 티셔츠예요." },
  tshirtYellow: { name: WEARABLE_ITEMS.tshirtYellow.label, category: "clothes", description: "기분까지 밝아지는 노랑 티셔츠예요." },
  shortsBrown: { name: WEARABLE_ITEMS.shortsBrown.label, category: "clothes", description: "차분한 갈색이라 어디에나 잘 맞는 반바지예요." },
  shortsRed: { name: WEARABLE_ITEMS.shortsRed.label, category: "clothes", description: "눈에 확 띄는 빨강 반바지예요." },
  shoesRed: { name: WEARABLE_ITEMS.shoesRed.label, category: "clothes", description: "한 걸음마다 신나는 빨강 운동화예요." },
  shoesWhite: { name: WEARABLE_ITEMS.shoesWhite.label, category: "clothes", description: "어떤 옷에도 잘 어울리는 흰 운동화예요." },
  sunglassesBlack: { name: WEARABLE_ITEMS.sunglassesBlack.label, category: "clothes", description: "햇살 좋은 날 멋을 더하는 동그란 선글라스예요." },
  backpackRed: { name: WEARABLE_ITEMS.backpackRed.label, category: "clothes", description: "어디든 함께 떠날 수 있는 작은 빨강 백팩이에요." },
  mufflerRed: { name: WEARABLE_ITEMS.mufflerRed.label, category: "clothes", description: "목을 포근하게 감싸는 빨강 머플러예요." },
  necklaceGold: { name: WEARABLE_ITEMS.necklaceGold.label, category: "clothes", description: "동그란 펜던트가 반짝이는 금 목걸이예요." }
};

/** 앱 가구 목록에 있는 가구인지. */
export function isShopFurniture(type: string): boolean {
  try {
    furnitureType(type);
    return true;
  } catch {
    return false;
  }
}

/** 앱이 라룹이에 입힐 수 있는 옷인지: 받은 아이템 목록에 그리기 정보와 모델이 있고 이 앱의 몸 판에 맞는 옷이다(wearDraw). */
export function isShopWearable(type: string): boolean {
  return wearDraw(type) !== null;
}

/** 옷의 입는 곳(모자·상의·하의·신발 …). 옷이 아니면 null. */
export function shopWearPlace(type: string): string | null {
  const slot = wearableSlotOf(type);
  if (!slot) return null;
  return CLOSET_SLOTS.find((entry) => entry.slot === slot)?.label ?? null;
}

/** 앱 가구 목록에 있는 종류면 그 이름, 없으면 종류 id(서버가 새 종류를 보낸 경우). */
function catalogName(type: string): string {
  try {
    return furnitureType(type).name;
  } catch {
    return type;
  }
}

/** 홈쇼핑에 보일 수 있는 상품인지: 앱이 그릴 줄 아는 가구나 옷. 그릴 줄 모르는 상품(서버가 새로 더한 것)은 보이지 않는다. */
export function isShopKnown(type: string): boolean {
  return isShopFurniture(type) || isShopWearable(type);
}

/** 홈쇼핑 이름: 아이템 목록의 shopName. 목록에 없으면 표, 표에도 없으면 앱 가구 목록의 이름이다. */
export function shopProductName(type: string): string {
  return catalogItem(type)?.shopName ?? PRODUCT_INFO[type]?.name ?? catalogName(type);
}

/** 짧은 설명: 아이템 목록의 description. 목록에 없으면 표, 표에도 없으면 빈 글이다. */
export function shopProductDescription(type: string): string {
  return catalogItem(type)?.description ?? PRODUCT_INFO[type]?.description ?? "";
}

/** 그 종류가 그 분류에 드는지(아이템 목록의 category, 목록에 없으면 표). 분류가 없는 종류는 '전체'에만 든다. */
export function inShopCategory(type: string, category: ShopCategory): boolean {
  if (category === "all") return true;
  const item = catalogItem(type);
  return (item ? item.category : PRODUCT_INFO[type]?.category) === category;
}

/** 놓는 위치와 차지하는 크기(앱 가구 목록의 mount·size 규칙). 목록에 없는 종류면 null. */
export function shopPlacement(type: string): { where: string; size: string } | null {
  let kind;
  try {
    kind = furnitureType(type);
  } catch {
    return null;
  }
  const { width, depth } = kind.size;
  switch (kind.mount) {
    case "floor":
      return { where: "바닥에 놓기", size: `${width} × ${depth}칸` };
    case "cover":
      return { where: "바닥에 깔기", size: `${width} × ${depth}칸` };
    case "tabletop":
      return { where: "책상·협탁 위", size: "소품 자리 1칸" };
    case "wall":
      return { where: "벽에 걸기", size: `가로 ${width}칸` };
    default:
      return null;
  }
}
