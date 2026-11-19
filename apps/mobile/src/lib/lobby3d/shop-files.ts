import { catalogItem } from "@/lib/item-catalog-store";
import { cachedItemFile, fetchItemFile, itemFileFailed, retryFailedItemFiles, type ItemFileRef } from "@/lib/item-files";
import { SHOP_PRODUCTS, type ShopProductId } from "./shop";

// 마을 가구점의 진열 상품 셋 모델은 앱에 들어 있지 않고 서버 아이템 목록(팔지 않는 가구)에서 받는다(실내·주인 버들은 앱에 들어 있다).
// 가구·옷 파일과 같이 받아 기기에 둔다(item-files). 마을에 나가면 미리 받기 시작한다.
// 가구점은 상품을 기다리지 않고 들어간다: 상품은 슬롯마다 기기에 있으면 붙고, 받는 대로 나타나며, 목록에 없거나 받지 못하면 그 슬롯이 빈다.

/** 가구점이 받는 아이템 셋: 진열 상품(SHOP_PRODUCTS 순서. 상품 id가 곧 서버 가구 id다). */
export const SHOP_FILE_ITEMS: readonly string[] = SHOP_PRODUCTS.map((p) => p.id);

/** 상품 하나의 목록 파일(목록에 없으면 null). */
function productRef(id: ShopProductId): ItemFileRef | null {
  return catalogItem(id)?.assets?.model ?? null;
}

/** 상품 하나의 지금 상태: 기기 주소(있음), loading(받는 중이거나 아직 받지 않음), missing(목록에 없거나 이번 실행에서 받기 실패). 받기를 시작하지 않는다. */
export function shopProductFile(id: ShopProductId): string | "loading" | "missing" {
  const ref = productRef(id);
  if (!ref) return "missing";
  const uri = cachedItemFile(ref);
  if (uri) return uri;
  return itemFileFailed(ref) ? "missing" : "loading";
}

/** 상품마다의 기기 주소(없으면 null). SHOP_PRODUCTS 순서와 상관없이 id로 찾는다. */
export function shopProductUris(): Record<ShopProductId, string | null> {
  const out = {} as Record<ShopProductId, string | null>;
  for (const product of SHOP_PRODUCTS) {
    const state = shopProductFile(product.id);
    out[product.id] = state === "loading" || state === "missing" ? null : state;
  }
  return out;
}

/** 기기에 없는 파일을 받기 시작한다(이미 있거나 받는 중이거나 실패했으면 그대로. 목록에 없는 상품은 건너뛴다). */
export function prefetchShopFiles(): void {
  for (const product of SHOP_PRODUCTS) {
    const ref = productRef(product.id);
    if (ref && !itemFileFailed(ref)) void fetchItemFile(ref);
  }
}

/** 가구점 '들어가기'·마을에 나갈 때: 이번 실행에서 실패한 상품 파일의 실패 기록을 지우고 다시 받기 시작한다. */
export function retryShopFiles(): void {
  const failed = SHOP_PRODUCTS.some((product) => {
    const ref = productRef(product.id);
    return ref !== null && itemFileFailed(ref);
  });
  if (failed) retryFailedItemFiles();
  prefetchShopFiles();
}
