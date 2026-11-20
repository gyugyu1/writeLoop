import { catalogItem } from "@/lib/item-catalog-store";
import { cachedItemFile, fetchItemFile, itemFileFailed, retryFailedItemFiles, type ItemFileRef } from "@/lib/item-files";
import { SHOP_PRODUCTS, type ShopProductId } from "./shop";

// 마을 가구점의 진열 상품 여섯은 모델과 명패 그림이 앱에 들어 있지 않고 서버 아이템 목록(팔지 않는 가구)에서 받는다(실내·주인 버들은 앱에 들어 있다).
// 가구·옷 파일과 같이 받아 기기에 둔다(item-files). 마을에 나가면 미리 받기 시작한다.
// 가구점은 상품을 기다리지 않고 들어간다: 상품은 슬롯마다 받아 읽고 크기 검사를 통과하면 붙는다(lobby3d-shop).

/** 가구점이 받는 아이템: 진열 상품(SHOP_PRODUCTS 순서. 상품 id가 곧 서버 가구 id다). */
export const SHOP_FILE_ITEMS: readonly string[] = SHOP_PRODUCTS.map((p) => p.id);

type ShopFileKind = "model" | "nameplate";

/** 상품 하나의 목록 파일(모델 또는 명패 그림, 목록에 없으면 null). */
function productRef(id: ShopProductId, kind: ShopFileKind): ItemFileRef | null {
  return catalogItem(id)?.assets?.[kind] ?? null;
}

/** 파일 하나의 지금 상태: 기기 주소(있음), loading(받는 중이거나 아직 받지 않음), missing(목록에 없거나 이번 실행에서 받기 실패). */
function fileState(ref: ItemFileRef | null): string | "loading" | "missing" {
  if (!ref) return "missing";
  const uri = cachedItemFile(ref);
  if (uri) return uri;
  return itemFileFailed(ref) ? "missing" : "loading";
}

/** 상품 모델의 지금 상태: 기기 주소 / loading / missing. 받기를 시작하지 않는다. */
export function shopProductFile(id: ShopProductId): string | "loading" | "missing" {
  return fileState(productRef(id, "model"));
}

/** 상품 명패 그림의 지금 상태: 기기 주소 / loading / missing. 받기를 시작하지 않는다. */
export function shopNameplateFile(id: ShopProductId): string | "loading" | "missing" {
  return fileState(productRef(id, "nameplate"));
}

/** 상품마다 모델·명패 그림의 지금 상태(3D 그리기가 슬롯을 맞출 때 쓴다). */
export interface ShopProductFiles {
  model: string | "loading" | "missing";
  nameplate: string | "loading" | "missing";
}

export function shopProductFiles(): Record<ShopProductId, ShopProductFiles> {
  const out = {} as Record<ShopProductId, ShopProductFiles>;
  for (const product of SHOP_PRODUCTS) out[product.id] = { model: shopProductFile(product.id), nameplate: shopNameplateFile(product.id) };
  return out;
}

/** 상품마다의 모델 기기 주소(없으면 null). */
export function shopProductUris(): Record<ShopProductId, string | null> {
  const out = {} as Record<ShopProductId, string | null>;
  for (const product of SHOP_PRODUCTS) {
    const state = shopProductFile(product.id);
    out[product.id] = state === "loading" || state === "missing" ? null : state;
  }
  return out;
}

/** 상품마다의 명패 그림 기기 주소(없으면 null). */
export function shopNameplateUris(): Record<ShopProductId, string | null> {
  const out = {} as Record<ShopProductId, string | null>;
  for (const product of SHOP_PRODUCTS) {
    const state = shopNameplateFile(product.id);
    out[product.id] = state === "loading" || state === "missing" ? null : state;
  }
  return out;
}

function shopRefs(): ItemFileRef[] {
  const refs: ItemFileRef[] = [];
  for (const product of SHOP_PRODUCTS) {
    for (const kind of ["model", "nameplate"] as const) {
      const ref = productRef(product.id, kind);
      if (ref) refs.push(ref);
    }
  }
  return refs;
}

/** 기기에 없는 모델·명패 그림을 받기 시작한다(이미 있거나 받는 중이거나 실패했으면 그대로. 목록에 없는 것은 건너뛴다). */
export function prefetchShopFiles(): void {
  for (const ref of shopRefs()) {
    if (!itemFileFailed(ref)) void fetchItemFile(ref);
  }
}

/** 가구점 '들어가기'·마을에 나갈 때: 이번 실행에서 실패한 상품 파일의 실패 기록을 지우고 다시 받기 시작한다. */
export function retryShopFiles(): void {
  if (shopRefs().some((ref) => itemFileFailed(ref))) retryFailedItemFiles();
  prefetchShopFiles();
}
