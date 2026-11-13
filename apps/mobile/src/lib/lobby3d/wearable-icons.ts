import type { ImageSourcePropType } from "react-native";
import { catalogItem } from "@/lib/item-catalog-store";
import { cachedItemFile, fetchItemFile, itemFileFailed } from "@/lib/item-files";
import type { WardrobeSlot } from "@/lib/types";

// 옷장 화면의 그림: 착용 아이템 칸 그림과 부위 탭 아이콘(scripts/lobby3d/draw-wardrobe-slot-icons.py로 그림).
// 칸 그림은 서버 아이템 목록(assets.icon)의 파일을 처음 보일 때 받아 기기에 둔다(item-files. 받으면 다시 그리게 알린다).
// 앱에 든 칸 그림은 처음부터 가진 라룹이 고글뿐이다. 그림은 scripts/lobby3d/render-wearable-icons.py로 찍어 서버 목록 폴더에 둔다.

const BUNDLED_ICONS: Readonly<Record<string, ImageSourcePropType>> = {
  goggles: require("../../../assets/icons/wearables/goggles.png")
};

const SLOT_ICONS: Readonly<Record<WardrobeSlot, ImageSourcePropType>> = {
  hat: require("../../../assets/icons/wardrobe-slots/hat.png"),
  top: require("../../../assets/icons/wardrobe-slots/top.png"),
  bottom: require("../../../assets/icons/wardrobe-slots/bottom.png"),
  shoes: require("../../../assets/icons/wardrobe-slots/shoes.png"),
  face: require("../../../assets/icons/wardrobe-slots/face.png"),
  back: require("../../../assets/icons/wardrobe-slots/back.png"),
  accessory: require("../../../assets/icons/wardrobe-slots/accessory.png")
};

/**
 * 착용 아이템 칸 그림. 앱에 든 것(라룹이 고글)이 아니면 받은 목록의 그림 파일이고, 아직 기기에 없으면 받기를 시작하고 null을 돌려준다
 * (부르는 쪽은 이름 첫 글자 칸을 보이고, useItemFiles로 받은 뒤 다시 그린다). 목록에 그림이 없으면 null.
 */
export function wearableIcon(type: string): ImageSourcePropType | null {
  const bundled = BUNDLED_ICONS[type];
  if (bundled) return bundled;
  const item = catalogItem(type);
  const ref = item?.kind === "wearable" ? item.assets?.icon ?? null : null;
  if (!ref) return null;
  const uri = cachedItemFile(ref);
  if (uri) return { uri };
  if (!itemFileFailed(ref)) void fetchItemFile(ref);
  return null;
}

/** 부위 탭 아이콘. */
export function wardrobeSlotIcon(slot: WardrobeSlot): ImageSourcePropType {
  return SLOT_ICONS[slot];
}
