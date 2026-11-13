import type { ImageSourcePropType } from "react-native";
import type { WardrobeSlot } from "@/lib/types";

// 옷장 화면의 그림: 착용 아이템 칸 그림(scripts/lobby3d/render-wearable-icons.py로 찍음)과
// 부위 탭 아이콘(scripts/lobby3d/draw-wardrobe-slot-icons.py로 그림).

const ITEM_ICONS: Readonly<Record<string, ImageSourcePropType>> = {
  capOrange: require("../../../assets/icons/wearables/capOrange.png"),
  tshirtOrange: require("../../../assets/icons/wearables/tshirtOrange.png"),
  shortsNavy: require("../../../assets/icons/wearables/shortsNavy.png"),
  shoesBrown: require("../../../assets/icons/wearables/shoesBrown.png")
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

/** 착용 아이템 칸 그림. 그림이 없는 종류면 null. */
export function wearableIcon(type: string): ImageSourcePropType | null {
  return ITEM_ICONS[type] ?? null;
}

/** 부위 탭 아이콘. */
export function wardrobeSlotIcon(slot: WardrobeSlot): ImageSourcePropType {
  return SLOT_ICONS[slot];
}
