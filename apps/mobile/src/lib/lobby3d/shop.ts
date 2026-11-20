import LAYOUT from "./shop-layout.json";

// 마을 가구점 실내(생활 쇼룸)의 데이터: 크기, 걸을 수 없는 곳, 장소, 라룹이가 들어서는 자리, 진열 상품과 지금 진열.
// 배치는 매장 모델과 함께 나온 shop-layout.json 하나에서 읽는다(모델 좌표: 미터, +Y 위, +Z 출입구 쪽).
// 실내 모델(assets/models/shop/furniture-shop-interior.glb)의 노드 자리와 같은지는 테스트가 본다.
// 좌표: 앱 좌표 = 모델 X·Z + 오프셋(LAYOUT.grid.offsetXZ). 오프셋은 여기(at)에서만 한 번 더한다. 한 칸 = 모델 1m.
// 실내는 진열대가 둥글어서, 걸을 수 있는지는 방·마을(1칸)보다 잘게 0.25칸 격자로 본다.
// 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.

export interface ShopPoint {
  x: number;
  z: number;
}

type XZ = readonly [number, number];
type Rect = readonly [number, number, number, number];

/** 모델 좌표를 앱 좌표로 옮기는 거리. */
export const SHOP_OFFSET = { x: LAYOUT.grid.offsetXZ[0], z: LAYOUT.grid.offsetXZ[1] } as const;

/** 실내 바닥(칸)과 걸을 수 있는지 보는 격자 한 칸의 크기. */
export const SHOP = { width: LAYOUT.grid.width, depth: LAYOUT.grid.depth, cell: LAYOUT.grid.cell } as const;

/** 모델 X·Z를 앱 좌표로(오프셋을 한 번 더한다). */
const at = (x: number, z: number): ShopPoint => ({ x: x + SHOP_OFFSET.x, z: z + SHOP_OFFSET.z });
const atXZ = (p: XZ | readonly number[]): ShopPoint => at(p[0], p[1]);
const NODES = LAYOUT.nodesXYZ;

/** 실내 모델의 자리 노드(앱 좌표). */
export const SHOP_NODES = {
  /** 들어온 직후 라룹이 발 자리(PlayerSpawn). 매장 안쪽(−z)을 본다. */
  playerSpawn: at(NODES.PlayerSpawn[0], NODES.PlayerSpawn[2]),
  /** 오른쪽 초록 문을 지나 마을로 나가는 곳(ExitTrigger). */
  exitTrigger: at(NODES.ExitTrigger[0], NODES.ExitTrigger[2]),
  /** 계산대 뒤 버들의 발 자리(CheckoutNPC). */
  checkoutNpc: at(NODES.CheckoutNPC[0], NODES.CheckoutNPC[2]),
  /** 계산대 앞에서 손님이 서는 자리(CheckoutInteract). */
  checkoutInteract: at(NODES.CheckoutInteract[0], NODES.CheckoutInteract[2])
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
  /** 모델의 슬롯 노드 이름(상품을 붙이는 곳). */
  node: string;
  /** 진열대 받침 노드 이름(누르기 대상)과 명패 받침·새겨진 글자 노드 이름. */
  pedestal: string;
  nameplate: string;
  glyph: string;
  /** 진열대(원) 가운데와 걷기를 막는 반지름. */
  center: ShopPoint;
  pedestalRadius: number;
  /** 상품 크기 검사(원본 배율): 바닥 중앙에서 가장 먼 바닥 모서리까지 safeRadius, 높이 maxHeight 안이어야 진열한다. */
  safeRadius: number;
  maxHeight: number;
  /** 진열대 앞 통로의 서는 자리. */
  approach: ShopPoint;
}

export const SHOP_SLOTS: readonly ShopSlot[] = LAYOUT.slots.map((slot, i) => ({
  node: slot.node,
  pedestal: slot.pedestal,
  nameplate: LAYOUT.nameplates[i].holder,
  glyph: LAYOUT.nameplates[i].glyph,
  center: atXZ(slot.centerXZ),
  pedestalRadius: slot.pedestalRadius,
  safeRadius: slot.safeRadius,
  maxHeight: slot.maxHeight,
  approach: atXZ(slot.approachXZ)
}));

/** 출입문 장소의 서는 자리: 문 안쪽. */
export const SHOP_EXIT_APPROACH = atXZ(LAYOUT.exitApproachXZ);

/** 걸을 수 없는 곳(앱 좌표 사각형). */
interface ShopRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const rect = (r: Rect | readonly number[]): ShopRect => {
  const a = at(r[0], r[1]);
  const b = at(r[2], r[3]);
  return { x0: a.x, z0: a.z, x1: b.x, z1: b.z };
};

/** 벽 안쪽(이 밖은 걸을 수 없다). */
const INSIDE = rect(LAYOUT.insideXZ);

/** 계산대, 열린 문, 선반, 간판 기둥, 쇼룸 벽장식, 협탁, 명패 여섯(shop-layout.json의 blockedRectsXZ). */
const SHOP_BLOCKS: readonly ShopRect[] = Object.values(LAYOUT.blockedRectsXZ).map(rect);

const inRect = (r: ShopRect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** 그 자리가 걸을 수 없는 곳(벽 밖, 계산대, 선반, 문짝, 간판 기둥, 벽장식, 협탁, 명패, 진열대)인지. 몸 둘레는 보지 않는다. */
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

const [BOUNDS_MIN, BOUNDS_MAX] = LAYOUT.boundsModelXYZ;

/** 카메라가 넘지 않는 실내 끝 상자: 바닥 판과 벽 높이(shop-layout.json의 boundsModelXYZ). */
export const SHOP_BOUNDS = {
  minX: BOUNDS_MIN[0] + SHOP_OFFSET.x,
  maxX: BOUNDS_MAX[0] + SHOP_OFFSET.x,
  minY: BOUNDS_MIN[1],
  maxY: BOUNDS_MAX[1],
  minZ: BOUNDS_MIN[2] + SHOP_OFFSET.z,
  maxZ: BOUNDS_MAX[2] + SHOP_OFFSET.z
};

/** 내려다보는 카메라에서 매장 앞쪽을 가로로 가려 숨기는 앞쪽 노드. */
export const SHOP_HIDDEN_NODES: readonly string[] = LAYOUT.hiddenFrontNodes;

// ---------- 장소 ----------

export type ShopPlaceId = "shopExit" | "shopCounter" | "shopSlot1" | "shopSlot2" | "shopSlot3" | "shopSlot4" | "shopSlot5" | "shopSlot6";

export const SHOP_SLOT_PLACES: readonly ShopPlaceId[] = SHOP_SLOTS.map((_, i) => `shopSlot${i + 1}` as ShopPlaceId);

export const SHOP_PLACE_IDS: readonly ShopPlaceId[] = ["shopExit", "shopCounter", ...SHOP_SLOT_PLACES];

export function isShopPlaceId(id: string): id is ShopPlaceId {
  return (SHOP_PLACE_IDS as readonly string[]).includes(id);
}

/** 진열대 장소의 슬롯 번호(0~5). 진열대가 아니면 -1. */
export function shopSlotIndex(id: string): number {
  return (SHOP_SLOT_PLACES as readonly string[]).indexOf(id);
}

/** 장소 이름표 자리(앱 좌표와 높이): 출입문은 문 위, 버들은 머리 위, 진열대는 상품 위. 버들 인사 말풍선도 버들 이름표 위에 뜬다. */
export const SHOP_LABEL_POINTS: Record<ShopPlaceId, { x: number; y: number; z: number }> = {
  shopExit: { x: SHOP_NODES.exitTrigger.x, y: 2.9, z: SHOP_NODES.exitTrigger.z - 0.4 },
  shopCounter: { x: SHOP_NODES.checkoutNpc.x, y: SHOPKEEPER_SCALE + 0.45, z: SHOP_NODES.checkoutNpc.z },
  ...(Object.fromEntries(SHOP_SLOTS.map((slot, i) => [`shopSlot${i + 1}`, { x: slot.center.x, y: 2.6, z: slot.center.z }])) as Record<
    Exclude<ShopPlaceId, "shopExit" | "shopCounter">,
    { x: number; y: number; z: number }
  >)
};

/** 버들 인사 말풍선과 보이는 시간. */
export const SHOPKEEPER_GREETING = "어서 와! 천천히 둘러보렴.";
export const SHOPKEEPER_GREETING_MS = 3000;

// ---------- 진열 상품 ----------

export type ShopProductId = "rainbootPlanter" | "catPostDesk" | "stargazerBed" | "walnutBed" | "grandmasFloorBedding" | "cloudDesk";

export interface ShopProduct {
  id: ShopProductId;
  /** 이름(애셋 폴더 이름을 띄어 씀). 서버 목록에 이름이 있으면 그것을 쓴다(shopProductName). */
  name: string;
  description: string;
}

export const SHOP_PRODUCTS: readonly ShopProduct[] = [
  { id: "rainbootPlanter", name: "장화 화분", description: "장화 화분과 작은 종 모양 꽃" },
  { id: "catPostDesk", name: "고양이 편지 책상", description: "고양이 귀 실루엣, 편지 표식과 선반" },
  { id: "stargazerBed", name: "별지기 침대", description: "푸른 반쪽 천막과 초승달 모빌" },
  { id: "walnutBed", name: "호두 침대", description: "갈라진 호두껍질 굴곡에 파스텔 녹색 이불을 덮었어요." },
  { id: "grandmasFloorBedding", name: "이부자리", description: "방바닥에 포근한 요를 펴고 솜이불과 베개를 놓았어요." },
  { id: "cloudDesk", name: "구름 책상", description: "구름 모양 상판에 하늘색으로 포인트를 줬어요." }
];

export function shopProduct(id: ShopProductId): ShopProduct {
  return SHOP_PRODUCTS.find((p) => p.id === id) ?? SHOP_PRODUCTS[0];
}

/** 처음 진열: 슬롯 01~06. */
export const DEFAULT_SHOP_DISPLAY: readonly ShopProductId[] = SHOP_PRODUCTS.map((p) => p.id);

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

/** 진열 교체에 실패했을 때 알림(3D 그리기가 보내고 로비 화면이 안내를 띄운다). */
const swapFailedListeners = new Set<(slot: number) => void>();

export function onShopSwapFailed(listener: (slot: number) => void): () => void {
  swapFailedListeners.add(listener);
  return () => {
    swapFailedListeners.delete(listener);
  };
}

export function notifyShopSwapFailed(slot: number): void {
  for (const listener of [...swapFailedListeners]) listener(slot);
}

/** 진열 교체에 실패했을 때의 안내. */
export const SHOP_SWAP_FAILED = "이 상품은 지금 진열할 수 없어요";

/** 상품 모델의 크기(바닥 중앙 기준): 바닥 윤곽 상자와 높이. */
export interface ProductBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** 원본 배율로 그 슬롯에 진열할 수 있는지: 가장 먼 바닥 모서리가 safeRadius 안이고 높이가 maxHeight 안이다. */
export function fitsShopSlot(box: ProductBox, slot: Pick<ShopSlot, "safeRadius" | "maxHeight">): boolean {
  const radius = Math.max(...[box.minX, box.maxX].flatMap((x) => [box.minZ, box.maxZ].map((z) => Math.hypot(x, z))));
  return radius <= slot.safeRadius && box.height <= slot.maxHeight;
}
