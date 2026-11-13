import { useSyncExternalStore } from "react";

// 라이트루프 아이템 목록(가구·옷)의 지금 값: 서버 GET /api/catalog가 주는 이름·홈쇼핑 이름·설명·분류·부위·정가.
// 받기·기기 저장은 item-catalog.ts가 한다. 여기는 지금 목록을 들고 있다가 이름을 찾아 주고, 바뀌면 화면에 알린다.
// 목록이 없거나 목록에 없는 아이템은 undefined를 돌려주고, 부르는 쪽이 앱에 든 기본값(furniture-catalog·home-shopping-catalog·wear)을 쓴다.

export type ItemCategory = "furniture" | "lighting" | "decor" | "plants" | "clothes";

export interface CatalogItem {
  id: string;
  kind: "furniture" | "wearable";
  /** 꾸미기 보관함·옷장의 이름. */
  name: string;
  /** 홈쇼핑 이름. */
  shopName: string;
  description: string;
  /** 홈쇼핑 분류(팔지 않으면 null). */
  category: ItemCategory | null;
  slot: string | null;
  price: number | null;
}

export interface ItemCatalogData {
  version: string;
  items: CatalogItem[];
}

const CATEGORIES: readonly string[] = ["furniture", "lighting", "decor", "plants", "clothes"];

interface State {
  data: ItemCatalogData | null;
  byId: Map<string, CatalogItem>;
}

let state: State = { data: null, byId: new Map() };
const listeners = new Set<() => void>();

/** 지금 목록(없으면 null). */
export function currentItemCatalog(): ItemCatalogData | null {
  return state.data;
}

/** 지금 목록을 바꾸고 화면에 알린다. */
export function setItemCatalog(data: ItemCatalogData): void {
  state = { data, byId: new Map(data.items.map((item) => [item.id, item])) };
  listeners.forEach((listener) => listener());
}

/**
 * 받은(저장한) 목록을 읽는다. 응답 모양이 틀리면(version이 없거나 빈 글, items가 목록이 아님) null(못 받은 것으로 본다).
 * 칸 값이 틀리거나 이 앱이 모르는 값(새 종류·분류)이 든 아이템은 그 아이템만 건너뛴다(그 아이템은 앱 기본값으로 보인다).
 */
export function parseItemCatalog(value: unknown): ItemCatalogData | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { version, items } = value as Record<string, unknown>;
  if (typeof version !== "string" || version === "" || !Array.isArray(items)) return null;
  const list: CatalogItem[] = [];
  for (const entry of items) {
    const item = parseItem(entry);
    if (item) list.push(item);
  }
  return { version, items: list };
}

function parseItem(value: unknown): CatalogItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { id, kind, name, shopName, description, category, slot, price } = value as Record<string, unknown>;
  if (typeof id !== "string" || id === "" || (kind !== "furniture" && kind !== "wearable")) return null;
  if (typeof name !== "string" || typeof shopName !== "string" || typeof description !== "string") return null;
  if (category !== null && (typeof category !== "string" || !CATEGORIES.includes(category))) return null;
  if (slot !== null && typeof slot !== "string") return null;
  if (price !== null && (typeof price !== "number" || !Number.isFinite(price))) return null;
  return { id, kind, name, shopName, description, category: category as ItemCategory | null, slot, price };
}

/** 지금 목록의 그 아이템. 목록이 없거나 그 아이템이 없으면 undefined(부르는 쪽이 앱 기본값을 쓴다). */
export function catalogItem(id: string): CatalogItem | undefined {
  return state.byId.get(id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 목록이 바뀌면 다시 그리게 한다(이름을 목록에서 읽는 화면이 쓴다). 지금 목록(없으면 null)을 돌려준다. */
export function useItemCatalog(): ItemCatalogData | null {
  return useSyncExternalStore(subscribe, currentItemCatalog, currentItemCatalog);
}
