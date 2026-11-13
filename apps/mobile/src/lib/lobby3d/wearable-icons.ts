import type { ImageSourcePropType } from "react-native";
import type { WardrobeSlot } from "@/lib/types";

// 옷장 화면의 그림: 착용 아이템 칸 그림(scripts/lobby3d/render-wearable-icons.py로 찍음)과
// 부위 탭 아이콘(scripts/lobby3d/draw-wardrobe-slot-icons.py로 그림).

const ITEM_ICONS: Readonly<Record<string, ImageSourcePropType>> = {
  capOrange: require("../../../assets/icons/wearables/capOrange.png"),
  tshirtOrange: require("../../../assets/icons/wearables/tshirtOrange.png"),
  shortsNavy: require("../../../assets/icons/wearables/shortsNavy.png"),
  shoesBrown: require("../../../assets/icons/wearables/shoesBrown.png"),
  capBlue: require("../../../assets/icons/wearables/capBlue.png"),
  capGreen: require("../../../assets/icons/wearables/capGreen.png"),
  tshirtWhite: require("../../../assets/icons/wearables/tshirtWhite.png"),
  tshirtYellow: require("../../../assets/icons/wearables/tshirtYellow.png"),
  shortsBrown: require("../../../assets/icons/wearables/shortsBrown.png"),
  shortsRed: require("../../../assets/icons/wearables/shortsRed.png"),
  shoesRed: require("../../../assets/icons/wearables/shoesRed.png"),
  shoesWhite: require("../../../assets/icons/wearables/shoesWhite.png"),
  goggles: require("../../../assets/icons/wearables/goggles.png"),
  sunglassesBlack: require("../../../assets/icons/wearables/sunglassesBlack.png"),
  backpackRed: require("../../../assets/icons/wearables/backpackRed.png"),
  mufflerRed: require("../../../assets/icons/wearables/mufflerRed.png"),
  necklaceGold: require("../../../assets/icons/wearables/necklaceGold.png")
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
