import LAYOUT from "./clothing-shop-layout.json";
import STOCK from "./clothing-shop-stock.json";
import { CLOTHING_OFFSET, type ClothingFloor, type ClothingPoint } from "./clothing-shop";
import type { WardrobeSlot } from "@/lib/types";

// 마을 옷집의 진열 상품 22종과 옷집 안의 상태(상품별 진열 여부, 장바구니).
// 상품은 실내 모델과 함께 나온 clothing-shop-stock.json에서, 진열대의 명패·이름표 자리는 clothing-shop-layout.json의 층별 slots에서 읽는다.
// 이름은 stock.json의 nameKO, 가격은 서버 아이템 목록(카탈로그에 연결된 9종의 catalogId)의 가격만 쓴다. 미등록(catalogId 없음)은 팔지 않는다.
// 상태는 앱을 켜 둔 동안 남는다(층을 오가도·옷집을 나갔다 와도). 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.

interface StockRow {
  id: string;
  nameKO: string;
  category: string;
  catalogId: string | null;
  floor: number;
  station: string;
  pickNode: string;
  displayAnchor: string;
  playerApproachXZ: number[];
  positionXYZ: number[];
  outfitIds: string[];
}

interface LayoutSlot {
  node: string;
  nameplate: string;
  textAnchor: string;
}

export interface ClothingProduct {
  /** 상품 ID(stock.json의 id). 장바구니·진열 여부의 열쇠. */
  id: string;
  name: string;
  /** 입는 부위. */
  slot: WardrobeSlot;
  /** 서버 아이템 목록의 아이템 ID(카탈로그에 연결된 상품만). null이면 판매 준비 중(미등록). */
  catalogId: string | null;
  floor: ClothingFloor;
  /** 진열대 노드(층 모델). */
  station: string;
  /** 진열 상품 모델(clothing-display-samples.glb)에서 복제할 노드. */
  pickNode: string;
  /** 층 모델에서 상품을 붙일 노드(로컬 위치·회전 0, 배율 1). */
  displayAnchor: string;
  /** 상품을 누르면 걸어가 서는 자리(앱 좌표). */
  approach: ClothingPoint;
  /** 진열된 상품의 자리(앱 좌표, 바닥 평면). */
  item: ClothingPoint;
  /** 그 진열대의 명패 노드와 이름표 자리 노드(층 모델). */
  nameplate: string;
  textAnchor: string;
  /** 속한 세트(outfits의 id). */
  outfitIds: readonly string[];
}

const SLOT_OF: Record<string, WardrobeSlot> = {
  hat: "hat",
  top: "top",
  bottom: "bottom",
  shoes: "shoes",
  face: "face",
  back: "back",
  accessory: "accessory"
};

const slotsOfFloor = (floor: ClothingFloor): readonly LayoutSlot[] => LAYOUT.floors[String(floor) as "1" | "2"].slots;

function productOf(row: StockRow): ClothingProduct {
  const floor = row.floor === 2 ? 2 : 1;
  const station = slotsOfFloor(floor).find((s) => s.node === row.station);
  if (!station) throw new Error(`clothing-shop-layout.json: station ${row.station} missing`);
  const slot = SLOT_OF[row.category];
  if (!slot) throw new Error(`clothing-shop-stock.json: unknown category ${row.category}`);
  return {
    id: row.id,
    name: row.nameKO,
    slot,
    catalogId: row.catalogId,
    floor,
    station: row.station,
    pickNode: row.pickNode,
    displayAnchor: row.displayAnchor,
    approach: { x: row.playerApproachXZ[0] + CLOTHING_OFFSET.x, z: row.playerApproachXZ[1] + CLOTHING_OFFSET.z },
    item: { x: row.positionXYZ[0] + CLOTHING_OFFSET.x, z: row.positionXYZ[2] + CLOTHING_OFFSET.z },
    nameplate: station.nameplate,
    textAnchor: station.textAnchor,
    outfitIds: row.outfitIds
  };
}

/**
 * 진열대 앞 상호작용 칸의 거리: 상품 자리와 서는 자리를 잇는 선분에서 이 점까지(m).
 * 벽에 걸린 옷은 서는 자리가 벽에서 1.45m 앞이라, 서는 자리만 재면 옷 바로 밑에 붙어 서도 멀다고 나왔다.
 */
export function clothingInteractDistance(product: ClothingProduct, point: ClothingPoint): number {
  const ax = product.item.x;
  const az = product.item.z;
  const dx = product.approach.x - ax;
  const dz = product.approach.z - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.z - az) * dz) / len2)) : 0;
  return Math.hypot(point.x - (ax + dx * t), point.z - (az + dz * t));
}

/** 진열 상품 22종(stock.json 순서). */
export const CLOTHING_PRODUCTS: readonly ClothingProduct[] = (STOCK.products as StockRow[]).map(productOf);

const BY_ID = new Map(CLOTHING_PRODUCTS.map((p) => [p.id, p]));

export function clothingProduct(id: string): ClothingProduct | undefined {
  return BY_ID.get(id);
}

/** 그 층의 상품(진열 여부와 상관없이). */
export function clothingProductsOnFloor(floor: ClothingFloor): readonly ClothingProduct[] {
  return CLOTHING_PRODUCTS.filter((p) => p.floor === floor);
}

/** 세트(outfits): 구성품 상품 ID. 세트 자체는 팔지 않는다. */
export interface ClothingOutfit {
  id: string;
  name: string;
  itemIds: readonly string[];
}

export const CLOTHING_OUTFITS: readonly ClothingOutfit[] = STOCK.outfits.map((o) => ({ id: o.id, name: o.nameKO, itemIds: o.itemIds }));

/** 진열 상품 모델의 뿌리 노드 이름. */
export const CLOTHING_STOCK_ROOT: string = STOCK.displayRules.stockRoot;

/**
 * 빈 진열 자리 노드: 층마다 예비 집기(진열대·마네킹·벽걸이)의 자리와, 새 가구(merchandisingFixtures)에서 비워 둔 자리.
 * 비어 있는 동안 상품이 붙지 않고 누르기·판매·피팅 대상이 아니다(상품은 stock.json의 displayAnchor에만 붙는다).
 */
const emptyMounts = (floor: "1" | "2"): string[] => [
  ...LAYOUT.floors[floor].reserveStations.flatMap((s) => s.mounts.map((m) => m.node)),
  ...LAYOUT.floors[floor].merchandisingFixtures.flatMap((f) => f.mounts.filter((m) => m.occupancy === "empty").map((m) => m.node))
];

export const CLOTHING_RESERVE_MOUNTS: Record<ClothingFloor, readonly string[]> = { 1: emptyMounts("1"), 2: emptyMounts("2") };

// ---------- 가격 글 ----------

/** 상품의 가격 글: 가진 옷 "가진 옷", 미등록 "판매 준비 중", 등록된 옷은 서버 가격 "80룹"(가격을 아직 모르면 null). */
export function clothingPriceText(product: ClothingProduct, catalogPrice: number | null | undefined, owned: boolean): string | null {
  if (product.catalogId && owned) return "가진 옷";
  if (!product.catalogId) return "판매 준비 중";
  return typeof catalogPrice === "number" ? `${catalogPrice}룹` : null;
}

/** 장바구니에 담을 수 있는지: 진열 중이고, 등록된(가격이 있는) 옷이고, 가지지 않았고, 아직 담지 않았을 때. */
export type ClothingCartBlock = "not-for-sale" | "no-price" | "owned" | "in-cart" | "not-displayed" | null;

/** 담을 수 없는 이유(null이면 담을 수 있다). 등록된 옷인데 서버 가격을 아직 모르면(아이템 목록을 받지 못함) no-price. */
export function clothingCartBlock(product: ClothingProduct, catalogPrice: number | null | undefined, owned: boolean): ClothingCartBlock {
  if (!isClothingDisplayed(product.id)) return "not-displayed";
  if (!product.catalogId) return "not-for-sale";
  if (typeof catalogPrice !== "number") return "no-price";
  if (owned) return "owned";
  if (cart.includes(product.id)) return "in-cart";
  return null;
}

// ---------- 상태: 진열 여부 ----------

const ALL_DISPLAYED: Readonly<Record<string, boolean>> = Object.fromEntries(CLOTHING_PRODUCTS.map((p) => [p.id, true]));
let displayed: Readonly<Record<string, boolean>> = ALL_DISPLAYED;
const displayListeners = new Set<() => void>();

/** 상품별 진열 여부(바뀔 때마다 새 객체). */
export function clothingDisplayed(): Readonly<Record<string, boolean>> {
  return displayed;
}

export function isClothingDisplayed(id: string): boolean {
  return displayed[id] === true;
}

/** 진열 여부를 바꾼다. 끄면 장바구니에서도 뺀다(다시 켜도 장바구니에는 돌아오지 않는다). 모르는 상품이나 같은 값이면 아무것도 하지 않는다. */
export function setClothingDisplayed(id: string, on: boolean): void {
  if (!BY_ID.has(id) || displayed[id] === on) return;
  displayed = { ...displayed, [id]: on };
  for (const listener of [...displayListeners]) listener();
  if (!on) removeFromClothingCart(id);
}

export function subscribeClothingDisplay(listener: () => void): () => void {
  displayListeners.add(listener);
  return () => {
    displayListeners.delete(listener);
  };
}

// ---------- 상태: 장바구니 ----------

const NO_CART: readonly string[] = [];
let cart: readonly string[] = NO_CART;
const cartListeners = new Set<() => void>();

/** 장바구니(상품 ID, 담은 순서. 바뀔 때마다 새 배열). */
export function clothingCart(): readonly string[] {
  return cart;
}

function setCart(next: readonly string[]): void {
  cart = next;
  for (const listener of [...cartListeners]) listener();
}

/** 장바구니에 담는다. 이미 담았거나 모르는 상품이면 false. 담을 수 있는지(가격·소유)는 부르는 쪽이 clothingCartBlock으로 본다. */
export function addToClothingCart(id: string): boolean {
  if (!BY_ID.has(id) || cart.includes(id)) return false;
  setCart([...cart, id]);
  return true;
}

export function removeFromClothingCart(id: string): void {
  if (!cart.includes(id)) return;
  setCart(cart.filter((c) => c !== id));
}

/** 장바구니를 비운다(산 뒤). */
export function clearClothingCart(): void {
  if (cart.length === 0) return;
  setCart(NO_CART);
}

export function subscribeClothingCart(listener: () => void): () => void {
  cartListeners.add(listener);
  return () => {
    cartListeners.delete(listener);
  };
}

/** 처음 상태로(모두 진열, 빈 장바구니). 시험용. */
export function resetClothingShop(): void {
  displayed = ALL_DISPLAYED;
  for (const listener of [...displayListeners]) listener();
  setCart(NO_CART);
}
