// 마을 가구점 실내의 데이터: 크기, 걸을 수 없는 곳, 장소, 라룹이가 들어서는 자리, 진열 상품과 지금 진열.
// 실내 모델(서버 아이템 목록의 애셋 shopInterior, 파일 apps/backend/src/main/resources/catalog/files/shop-interior.glb)의 노드 자리를 앱 좌표로 옮겨 둔다(모델 파일과 같은지 테스트가 본다).
// 좌표: 앱 좌표 = 모델 좌표 + (4.5, 0, 4.5). 한 칸 = 모델 1m. 모델 +Z(정면)가 앱 +z(카메라 쪽)다.
// 실내는 좁고 진열대가 둥글어서, 걸을 수 있는지는 방·마을(1칸)보다 잘게 0.25칸 격자로 본다.
// 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.

export interface ShopPoint {
  x: number;
  z: number;
}

/** 모델 좌표를 앱 좌표로 옮기는 거리. */
export const SHOP_OFFSET = { x: 4.5, z: 4.5 } as const;

/** 실내 바닥(칸)과 걸을 수 있는지 보는 격자 한 칸의 크기. */
export const SHOP = { width: 9, depth: 9, cell: 0.25 } as const;

const at = (x: number, z: number): ShopPoint => ({ x: x + SHOP_OFFSET.x, z: z + SHOP_OFFSET.z });

/** 실내 모델의 자리 노드(앱 좌표). */
export const SHOP_NODES = {
  /** 들어온 직후 라룹이 발 자리(PlayerSpawn). 매장 안쪽(−z)을 본다. */
  playerSpawn: at(2.65, 3.39),
  /** 오른쪽 초록 문을 지나 마을로 나가는 곳(ExitTrigger). */
  exitTrigger: at(2.81, 4.07),
  /** 계산대 뒤 버들의 발 자리(CheckoutNPC). */
  checkoutNpc: at(-2.42, -2.96),
  /** 계산대 앞에서 손님이 서는 자리(CheckoutInteract). */
  checkoutInteract: at(-2.6, -1.25)
} as const;

/** 들어설 때 라룹이가 보는 방향: 매장 안쪽(−z). */
export const SHOP_SPAWN_HEADING = Math.PI;

/** 버들이 보는 방향(계산대 앞 손님 쪽). 0 = +z. */
export const SHOPKEEPER_HEADING = Math.atan2(
  SHOP_NODES.checkoutInteract.x - SHOP_NODES.checkoutNpc.x,
  SHOP_NODES.checkoutInteract.z - SHOP_NODES.checkoutNpc.z
);

/** 버들 배율(키 1인 모델). 라룹이 그림 키(2.27)와 같다. */
export const SHOPKEEPER_SCALE = 2.27;

export interface ShopSlot {
  /** 모델의 슬롯 노드 이름. */
  node: "DisplaySlot_01" | "DisplaySlot_02" | "DisplaySlot_03";
  /** 진열대(원) 가운데와 걷기를 막는 반지름. */
  center: ShopPoint;
  pedestalRadius: number;
  /** 모델의 슬롯 노드 메타데이터(safe_radius_m, max_height_m). 상품이 넘으면 그 진열 인스턴스만 줄인다. */
  safeRadius: number;
  maxHeight: number;
  /** 진열대 앞 통로의 서는 자리. */
  approach: ShopPoint;
}

export const SHOP_SLOTS: readonly ShopSlot[] = [
  { node: "DisplaySlot_01", center: at(-2.781, 2.765), pedestalRadius: 1.05, safeRadius: 0.9, maxHeight: 2.3, approach: at(-1.3, 2.95) },
  { node: "DisplaySlot_02", center: at(-0.769, -0.008), pedestalRadius: 1.35, safeRadius: 1.2, maxHeight: 2.25, approach: at(-0.6, 1.8) },
  { node: "DisplaySlot_03", center: at(1.668, -2.795), pedestalRadius: 1.24, safeRadius: 1.08, maxHeight: 1.8, approach: at(1.8, -1.1) }
];

/** 출입문 장소의 서는 자리: 문 안쪽 깔개 위. */
export const SHOP_EXIT_APPROACH = at(2.75, 3.55);

/** 걸을 수 없는 곳(모델 좌표 → 앱 좌표). */
interface ShopRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const rect = (x0: number, z0: number, x1: number, z1: number): ShopRect => {
  const a = at(x0, z0);
  const b = at(x1, z1);
  return { x0: a.x, z0: a.z, x1: b.x, z1: b.z };
};

/** 벽 안쪽(이 밖은 걸을 수 없다). */
const INSIDE = rect(-3.97, -3.95, 3.97, 3.95);

const SHOP_BLOCKS: readonly ShopRect[] = [
  // 계산대와 그 뒤(화분·의자·버들)
  rect(-3.97, -3.95, -1.62, -1.63),
  // 오른쪽 벽 선반
  rect(3.08, -1.13, 3.97, 0.93),
  // 열린 초록 문짝
  rect(3.4, 2.2, 3.97, 3.95),
  // 뒷벽 간판 기둥
  rect(-2.6, -3.95, 2.6, -3.7)
];

const inRect = (r: ShopRect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** 그 자리가 걸을 수 없는 곳(벽 밖, 계산대, 선반, 문짝, 간판 기둥, 진열대)인지. 몸 둘레는 보지 않는다. */
export function shopSolidAt(x: number, z: number): boolean {
  if (!inRect(INSIDE, x, z)) return true;
  if (SHOP_BLOCKS.some((r) => inRect(r, x, z))) return true;
  return SHOP_SLOTS.some((s) => Math.hypot(x - s.center.x, z - s.center.z) <= s.pedestalRadius);
}

function buildSolidCells(): Set<string> {
  const solid = new Set<string>();
  const cols = Math.round(SHOP.width / SHOP.cell);
  const rows = Math.round(SHOP.depth / SHOP.cell);
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (shopSolidAt((c + 0.5) * SHOP.cell, (r + 0.5) * SHOP.cell)) solid.add(`${c},${r}`);
    }
  }
  return solid;
}

/** 걸을 수 없는 격자 칸("열,행", 한 칸 = SHOP.cell). 칸 가운데가 걸을 수 없는 곳이면 막힌다. */
export const SHOP_SOLID_CELLS: ReadonlySet<string> = buildSolidCells();

/** 카메라가 넘지 않는 실내 끝 상자: 바닥 판(모델 ±4.28)과 벽 높이(3.88). */
export const SHOP_BOUNDS = {
  minX: SHOP_OFFSET.x - 4.28,
  maxX: SHOP_OFFSET.x + 4.28,
  minY: -0.25,
  maxY: 3.88,
  minZ: SHOP_OFFSET.z - 4.28,
  maxZ: SHOP_OFFSET.z + 4.28
};

/** 내려다보는 카메라에서 매장 가운데를 가로로 가려 숨기는 앞쪽 노드. */
export const SHOP_HIDDEN_NODES: readonly string[] = ["ShopFront_Frame", "ShopFront_Glass", "ShopFront_EntryCasing"];

// ---------- 장소 ----------

export type ShopPlaceId = "shopExit" | "shopCounter" | "shopSlot1" | "shopSlot2" | "shopSlot3";

export const SHOP_PLACE_IDS: readonly ShopPlaceId[] = ["shopExit", "shopCounter", "shopSlot1", "shopSlot2", "shopSlot3"];

export const SHOP_SLOT_PLACES: readonly ShopPlaceId[] = ["shopSlot1", "shopSlot2", "shopSlot3"];

export function isShopPlaceId(id: string): id is ShopPlaceId {
  return (SHOP_PLACE_IDS as readonly string[]).includes(id);
}

/** 진열대 장소의 슬롯 번호(0~2). 진열대가 아니면 -1. */
export function shopSlotIndex(id: string): number {
  return (SHOP_SLOT_PLACES as readonly string[]).indexOf(id);
}

/** 장소 이름표 자리(앱 좌표와 높이): 출입문은 문 위, 버들은 머리 위, 진열대는 상품 위. 버들 인사 말풍선도 버들 이름표 위에 뜬다. */
export const SHOP_LABEL_POINTS: Record<ShopPlaceId, { x: number; y: number; z: number }> = {
  shopExit: { x: SHOP_NODES.exitTrigger.x, y: 2.9, z: SHOP_NODES.exitTrigger.z - 0.4 },
  shopCounter: { x: SHOP_NODES.checkoutNpc.x, y: SHOPKEEPER_SCALE + 0.45, z: SHOP_NODES.checkoutNpc.z },
  shopSlot1: { x: SHOP_SLOTS[0].center.x, y: 2.1, z: SHOP_SLOTS[0].center.z },
  shopSlot2: { x: SHOP_SLOTS[1].center.x, y: 2.1, z: SHOP_SLOTS[1].center.z },
  shopSlot3: { x: SHOP_SLOTS[2].center.x, y: 2.1, z: SHOP_SLOTS[2].center.z }
};

/** 버들 인사 말풍선과 보이는 시간. */
export const SHOPKEEPER_GREETING = "어서 와! 천천히 둘러보렴.";
export const SHOPKEEPER_GREETING_MS = 3000;

// ---------- 진열 상품 ----------

export type ShopProductId = "walnutBed" | "grandmasFloorBedding" | "cloudDesk";

export interface ShopProduct {
  id: ShopProductId;
  name: string;
  description: string;
}

export const SHOP_PRODUCTS: readonly ShopProduct[] = [
  { id: "walnutBed", name: "호두껍질 침대", description: "갈라진 호두껍질 굴곡에 파스텔 녹색 이불을 덮었어요." },
  { id: "grandmasFloorBedding", name: "할머니 댁 이부자리", description: "방바닥에 포근한 요를 펴고 솜이불과 베개를 놓았어요." },
  { id: "cloudDesk", name: "구름 책상", description: "구름 모양 상판에 하늘색으로 포인트를 줬어요." }
];

export function shopProduct(id: ShopProductId): ShopProduct {
  return SHOP_PRODUCTS.find((p) => p.id === id) ?? SHOP_PRODUCTS[0];
}

/** 처음 진열: 슬롯 01·02·03. */
export const DEFAULT_SHOP_DISPLAY: readonly ShopProductId[] = ["walnutBed", "grandmasFloorBedding", "cloudDesk"];

let display: readonly ShopProductId[] = DEFAULT_SHOP_DISPLAY;
const displayListeners = new Set<() => void>();

/** 지금 진열(슬롯 순서). 앱을 켜 둔 동안 유지되고 서버에 저장하지 않는다. */
export function shopDisplay(): readonly ShopProductId[] {
  return display;
}

/** 슬롯 하나의 상품을 바꾼다(다른 슬롯은 그대로). 같은 상품이면 아무것도 하지 않는다. */
export function setShopDisplay(slot: number, product: ShopProductId): void {
  if (slot < 0 || slot >= SHOP_SLOTS.length || display[slot] === product) return;
  const next = [...display];
  next[slot] = product;
  display = next;
  for (const listener of [...displayListeners]) listener();
}

export function subscribeShopDisplay(listener: () => void): () => void {
  displayListeners.add(listener);
  return () => {
    displayListeners.delete(listener);
  };
}

/** 처음 진열로 되돌린다(시험용). */
export function resetShopDisplay(): void {
  display = DEFAULT_SHOP_DISPLAY;
  for (const listener of [...displayListeners]) listener();
}

/** 상품 모델의 크기(바닥 중앙 기준): 바닥 윤곽 상자와 높이. */
export interface ProductBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/**
 * 진열 인스턴스의 균일 배율. 바닥 반경(바닥 중앙에서 바닥 윤곽 가장 먼 모서리까지)이 슬롯의 safeRadius,
 * 높이가 maxHeight 안에 들게 줄인다. 이미 들면 1(키우지 않는다).
 */
export function displayScale(box: ProductBox, slot: Pick<ShopSlot, "safeRadius" | "maxHeight">): number {
  const radius = Math.max(...[box.minX, box.maxX].flatMap((x) => [box.minZ, box.maxZ].map((z) => Math.hypot(x, z))));
  let scale = 1;
  if (radius > slot.safeRadius) scale = Math.min(scale, slot.safeRadius / radius);
  if (box.height > slot.maxHeight) scale = Math.min(scale, slot.maxHeight / box.height);
  return scale;
}
