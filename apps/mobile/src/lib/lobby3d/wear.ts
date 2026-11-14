import { catalogItem, currentItemCatalog, type CatalogItem } from "@/lib/item-catalog-store";
import type { ItemFileRef } from "@/lib/item-files";
import type { WardrobeSlot } from "@/lib/types";

// 라룹이 착용(캐릭터 꾸미기). 부위는 일곱(WardrobeSlot)이고, 부위마다 한 번에 아이템 하나를 입는다.
// 그리기에는 두 값을 넘긴다:
// - WearState: ①에서 정한 부위 넷(모자·상의·하의·신발)을 입었는지(참·거짓). 화면·테스트가 이 모양을 그대로 쓴다.
// - WearLook: 부위 일곱마다 입은 아이템 종류. 그리기는 이 값으로 아이템의 모델·색을 고른다(⑤). 없으면 WearState의 넷을 기본 아이템으로 그린다.
// 개발 화면 시험판은 서버와 상관없이 입고 벗고, 홈은 서버에 저장된 입은 아이템(GET /api/wardrobe)을 입힌다.
// 옷의 그리기 정보(붙이는 방식·뼈·색·맞춘 몸)와 모델 파일은 받은(저장한) 아이템 목록에서만 읽는다(앱에 든 옷 모델은 없다).
// 목록에 그리기 정보가 없거나, 모르는 방식이거나, 이 앱의 라룹이 몸과 판이 다르면 "그릴 줄 모르는 옷"이다(라룹이에 그리지 않고 홈쇼핑에서 숨긴다).

export type WearSlot = "hat" | "top" | "bottom" | "shoes";

/** 부위마다 입었는지(①의 부위 넷). */
export type WearState = Record<WearSlot, boolean>;

/** 부위 일곱마다 입은 아이템 종류(입지 않았으면 null). */
export type WearLook = Record<WardrobeSlot, string | null>;

/** 시험판 버튼 순서와 이름(①의 넷. 켜면 그 부위의 첫 아이템을 입는다). */
export const WEAR_SLOTS: readonly { slot: WearSlot; label: string }[] = [
  { slot: "hat", label: "모자" },
  { slot: "top", label: "상의" },
  { slot: "bottom", label: "하의" },
  { slot: "shoes", label: "신발" }
];

/** 시험판의 새 부위 버튼(⑤). */
export const EXTRA_WEAR_SLOTS: readonly { slot: Exclude<WardrobeSlot, WearSlot>; label: string }[] = [
  { slot: "face", label: "얼굴장식" },
  { slot: "back", label: "등장식" },
  { slot: "accessory", label: "액세서리" }
];

/** 아무것도 입지 않은 상태. */
export const NO_WEAR: WearState = { hat: false, top: false, bottom: false, shoes: false };

/** 아무것도 입지 않은 일곱 부위(맨얼굴). */
export const NO_LOOK: WearLook = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

/** 라룹이 기본 모습: 고글만 쓴 상태(개발 화면 시험판이 이 모습으로 시작한다). */
export const DEFAULT_LOOK: WearLook = { ...NO_LOOK, face: "goggles" };

const LOOK_SLOTS: readonly WardrobeSlot[] = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"];

/**
 * 앱에 든 착용 아이템 이름표(서버 아이템 목록을 받지 못했을 때의 이름·부위). 이름은 화면 이름, wear는 ①의 부위 넷 중 어디인지(새 부위는 없다).
 * 그리기 정보는 두지 않는다(받은 목록의 draw만 쓴다. wearDraw).
 */
export interface WearableItemInfo {
  slot: WardrobeSlot;
  label: string;
  wear?: WearSlot;
}

export const WEARABLE_ITEMS: Readonly<Record<string, WearableItemInfo>> = {
  capOrange: { slot: "hat", label: "주황 야구모자", wear: "hat" },
  tshirtOrange: { slot: "top", label: "주황 티셔츠", wear: "top" },
  shortsNavy: { slot: "bottom", label: "남색 반바지", wear: "bottom" },
  shoesBrown: { slot: "shoes", label: "갈색 운동화", wear: "shoes" },
  capBlue: { slot: "hat", label: "파랑 야구모자", wear: "hat" },
  capGreen: { slot: "hat", label: "초록 야구모자", wear: "hat" },
  tshirtWhite: { slot: "top", label: "흰 티셔츠", wear: "top" },
  tshirtYellow: { slot: "top", label: "노랑 티셔츠", wear: "top" },
  shortsBrown: { slot: "bottom", label: "갈색 반바지", wear: "bottom" },
  shortsRed: { slot: "bottom", label: "빨강 반바지", wear: "bottom" },
  shoesRed: { slot: "shoes", label: "빨강 운동화", wear: "shoes" },
  shoesWhite: { slot: "shoes", label: "흰 운동화", wear: "shoes" },
  // 라룹이 고글: 라룹이 모델에 원래 그려진 고글(착용 모델이 아니다). 얼굴장식이 고글이 아니면 라룹이 쪽에서 감춘다
  goggles: { slot: "face", label: "라룹이 고글" },
  sunglassesBlack: { slot: "face", label: "검정 선글라스" },
  backpackRed: { slot: "back", label: "빨강 백팩" },
  mufflerRed: { slot: "accessory", label: "빨강 머플러" },
  necklaceGold: { slot: "accessory", label: "금 목걸이" }
};

/** 이 앱의 라룹이 몸 판. 옷 그리기 정보의 body가 이 값과 같아야 그린다(라룹이 몸 모델을 바꾸면 올린다). */
export const WEAR_BODY = 1;

/** 받은 목록에서 읽은 옷 그리기 정보. bone은 붙일 뼈(뼈에 붙일 때), mirror는 좌우로 뒤집어 하나 더 붙일 뼈, color는 모델 색 대신 칠할 색. */
export interface WearDraw {
  type: string;
  slot: WardrobeSlot;
  attach: "bone" | "skin";
  bone: string | null;
  mirror: string | null;
  color: string | null;
  model: ItemFileRef;
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const drawCache = new WeakMap<CatalogItem, WearDraw | null>();

function isLookSlot(value: unknown): value is WardrobeSlot {
  return typeof value === "string" && (LOOK_SLOTS as readonly string[]).includes(value);
}

/** 없으면 null, 빈 글·글이 아님·모양이 틀리면 undefined. */
function optionalText(value: unknown, pattern?: RegExp): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value === "" || (pattern && !pattern.test(value))) return undefined;
  return value;
}

function readDraw(item: CatalogItem): WearDraw | null {
  if (item.kind !== "wearable" || !isLookSlot(item.slot) || !item.draw || !item.assets?.model) return null;
  const { attach, bone, mirror, color, body } = item.draw;
  if (body !== WEAR_BODY || (attach !== "bone" && attach !== "skin")) return null;
  const boneName = attach === "bone" ? optionalText(bone) : null;
  const mirrorName = optionalText(mirror);
  const tint = optionalText(color, COLOR);
  if (boneName === undefined || mirrorName === undefined || tint === undefined || (attach === "bone" && !boneName)) return null;
  return { type: item.id, slot: item.slot, attach, bone: boneName, mirror: mirrorName, color: tint, model: item.assets.model };
}

/** 그 옷을 이 앱이 그릴 수 있으면 그리기 정보, 아니면 null(목록에 없거나 그리기 정보·모델이 없거나 모르는 방식이거나 몸 판이 다름). */
export function wearDraw(type: string | null | undefined): WearDraw | null {
  if (!type) return null;
  const item = catalogItem(type);
  if (!item) return null;
  let draw = drawCache.get(item);
  if (draw === undefined) {
    draw = readDraw(item);
    drawCache.set(item, draw);
  }
  return draw;
}

/** 앱에 든 옷(라룹이 고글). 받은 목록의 그리기 정보·모델 파일 없이 앱에 든 모델(assets/models/wear-goggles.glb)로 그린다. */
export const BODY_WEARABLES: ReadonlySet<string> = new Set(["goggles"]);

/** 라룹이에 입힐 수 있는 옷인지: 받은 목록으로 그릴 수 있는 옷(wearDraw)이거나 몸에 그려진 옷. 옷장 칸은 이런 옷에만 만든다. */
export function isWearableDrawable(type: string | null | undefined): boolean {
  return Boolean(type) && (BODY_WEARABLES.has(type as string) || wearDraw(type) !== null);
}

/** 그 옷의 부위: 받은 목록에 있으면 그 부위, 목록에 없으면 앱 이름표의 부위. 옷이 아니거나 모르면 null. */
export function wearableSlotOf(type: string | null | undefined): WardrobeSlot | null {
  if (!type) return null;
  const item = catalogItem(type);
  if (item) return item.kind === "wearable" && isLookSlot(item.slot) ? item.slot : null;
  return WEARABLE_ITEMS[type]?.slot ?? null;
}

/** 그 옷의 이름: 받은 목록의 name, 목록에 없으면 앱 이름표, 둘 다 없으면 종류 id. */
export function wearableLabel(type: string): string {
  return catalogItem(type)?.name ?? WEARABLE_ITEMS[type]?.label ?? type;
}

/** 그 부위의 아이템들(받은 목록 순서의 입힐 수 있는 옷, 목록이 없으면 앱 이름표 순서). 시험판이 차례로 고를 때 쓴다. */
export function itemsInSlot(slot: WardrobeSlot): string[] {
  const catalog = currentItemCatalog();
  if (catalog) return catalog.items.filter((item) => item.kind === "wearable" && item.slot === slot && isWearableDrawable(item.id)).map((item) => item.id);
  return Object.keys(WEARABLE_ITEMS).filter((type) => WEARABLE_ITEMS[type].slot === slot);
}

const WEAR_OF: Partial<Record<WardrobeSlot, WearSlot>> = { hat: "hat", top: "top", bottom: "bottom", shoes: "shoes" };

/** 서버의 부위별 입은 아이템을 ①의 부위 넷 착용 상태로. 모르는 종류나 다른 부위에 든 아이템은 입히지 않는다. */
export function wearFromEquipped(equipped: Partial<Record<WardrobeSlot, string | null>> | null | undefined): WearState {
  const wear: WearState = { ...NO_WEAR };
  if (!equipped) return wear;
  for (const [slot, type] of Object.entries(equipped)) {
    const known = typeof type === "string" ? wearableSlotOf(type) : null;
    const place = known === slot ? WEAR_OF[known] : undefined;
    if (place) wear[place] = true;
  }
  return wear;
}

/** 서버의 부위별 입은 아이템을 일곱 부위의 그릴 아이템으로. 모르는 종류나 다른 부위에 든 아이템은 그리지 않는다. */
export function lookFromEquipped(equipped: Partial<Record<WardrobeSlot, string | null>> | null | undefined): WearLook {
  const look: WearLook = { ...NO_LOOK };
  if (!equipped || typeof equipped !== "object" || Array.isArray(equipped)) return look;
  for (const slot of LOOK_SLOTS) {
    const type = (equipped as Partial<Record<WardrobeSlot, unknown>>)[slot];
    if (typeof type === "string" && wearableSlotOf(type) === slot) look[slot] = type;
  }
  return look;
}

/** 그릴 아이템을 ①의 부위 넷 착용 상태로. */
export function wearOfLook(look: WearLook): WearState {
  return { hat: look.hat !== null, top: look.top !== null, bottom: look.bottom !== null, shoes: look.shoes !== null };
}

/** ①의 부위 넷 착용 상태를 그릴 아이템으로(입은 부위는 그 부위의 첫 아이템, 새 부위는 비움). */
export function lookOfWear(wear: WearState): WearLook {
  const look: WearLook = { ...NO_LOOK };
  for (const { slot } of WEAR_SLOTS) if (wear[slot]) look[slot] = itemsInSlot(slot)[0] ?? null;
  return look;
}

/**
 * 착용 모델로 그릴 것이 하나라도 있는지(라룹이 고글 포함). 그릴 아이템(look)을 주면 일곱 부위를 보고,
 * 주지 않으면(입은 것을 모름) 라룹이 기본 모습대로 고글을 쓴 것이라 늘 참이다.
 */
export function wearsAnything(wear: WearState, look?: WearLook | null): boolean {
  void wear;
  if (look) return LOOK_SLOTS.some((slot) => look[slot] !== null);
  return true;
}

/** 착용 모듈이 그릴 일곱 부위: look이 있으면 그대로, 없으면(입은 것을 모름) ①의 넷에 라룹이 고글을 쓴 모습. */
export function shownLook(wear: WearState, look?: WearLook | null): WearLook {
  return look ?? { ...lookOfWear(wear), face: "goggles" };
}
