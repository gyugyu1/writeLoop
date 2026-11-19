import { catalogItem } from "@/lib/item-catalog-store";
import { cachedItemFile, fetchItemFile, itemFileFailed, retryFailedItemFiles, type ItemFileRef } from "@/lib/item-files";
import { SHOP_PRODUCTS } from "./shop";

// 마을 가구점의 모델 파일 다섯(실내, 주인 버들, 진열 상품 셋)은 앱에 들어 있지 않고 서버 아이템 목록에서 받는다.
// 실내·버들은 애셋(kind asset), 상품은 팔지 않는 가구(kind furniture)다. 가구·옷 파일과 같이 받아 기기에 둔다(item-files).
// 마을에 나가면 미리 받기 시작하고, 가구점에 들어갈 때 다 받을 때까지 기다린다. 목록에 없거나 받지 못하면 들어가지 못한다.

/** 실내·버들의 아이템 id(서버 목록). */
export const SHOP_INTERIOR_ITEM = "shopInterior";
export const SHOPKEEPER_ITEM = "shopkeeperBeodeul";

/** 가구점이 받는 아이템 다섯: 실내, 버들, 상품 셋(SHOP_PRODUCTS 순서. 상품 id가 곧 서버 가구 id다). */
export const SHOP_FILE_ITEMS: readonly string[] = [SHOP_INTERIOR_ITEM, SHOPKEEPER_ITEM, ...SHOP_PRODUCTS.map((p) => p.id)];

/** 가구점 파일의 지금 상태. ready면 기기 주소(실내, 버들, 상품 셋은 SHOP_PRODUCTS 순서). */
export type ShopFiles =
  | { status: "ready"; interior: string; shopkeeper: string; products: string[] }
  | { status: "loading" }
  | { status: "failed" };

/** 목록에 있는 다섯 파일. 하나라도 목록에 없으면(목록을 못 받음 포함) null. */
export function shopFileRefs(): ItemFileRef[] | null {
  const refs: ItemFileRef[] = [];
  for (const id of SHOP_FILE_ITEMS) {
    const ref = catalogItem(id)?.assets?.model;
    if (!ref) return null;
    refs.push(ref);
  }
  return refs;
}

/** 지금 상태(받기를 시작하지 않는다): 목록에 없거나 이번 실행에서 받기에 실패한 파일이 있으면 failed, 다 기기에 있으면 ready, 아니면 loading. */
export function shopFilesStatus(): ShopFiles {
  const refs = shopFileRefs();
  if (!refs) return { status: "failed" };
  if (refs.some((ref) => itemFileFailed(ref))) return { status: "failed" };
  const uris = refs.map((ref) => cachedItemFile(ref));
  if (uris.some((uri) => !uri)) return { status: "loading" };
  const [interior, shopkeeper, ...products] = uris as string[];
  return { status: "ready", interior, shopkeeper, products };
}

/** 기기에 없는 파일을 받기 시작한다(이미 있거나 받는 중이면 그대로. 목록에 없으면 아무것도 하지 않는다). */
export function prefetchShopFiles(): void {
  const refs = shopFileRefs();
  if (!refs) return;
  for (const ref of refs) {
    if (!itemFileFailed(ref)) void fetchItemFile(ref);
  }
}

/** 가구점 '들어가기'를 다시 누를 때: 실패 기록을 지우고 다시 받기 시작한다. */
export function retryShopFiles(): void {
  const refs = shopFileRefs();
  if (refs?.some((ref) => itemFileFailed(ref))) retryFailedItemFiles();
  prefetchShopFiles();
}
