import type { ImageSourcePropType } from "react-native";

// 꾸미기 보관함에 보이는 가구 아이콘 그림(가구 종류 id → 그림). 그림은 scripts/lobby3d/render-icons.py가 가구 묶음에서 찍는다.
// 가구를 더하면 그 스크립트의 PIECES와 여기에 한 줄씩 더한다. 그림이 없는 종류는 화면이 이름 첫 글자 칸으로 대신한다.
const ICONS: Record<string, ImageSourcePropType> = {
  wardrobe: require("../../../assets/icons/furniture/wardrobe.png"),
  rug: require("../../../assets/icons/furniture/rug.png"),
  lamp: require("../../../assets/icons/furniture/lamp.png"),
  bed: require("../../../assets/icons/furniture/bed.png"),
  nightstand: require("../../../assets/icons/furniture/nightstand.png"),
  floorLamp: require("../../../assets/icons/furniture/floorLamp.png"),
  plant: require("../../../assets/icons/furniture/plant.png"),
  smallPlant: require("../../../assets/icons/furniture/smallPlant.png"),
  books: require("../../../assets/icons/furniture/books.png"),
  frame: require("../../../assets/icons/furniture/frame.png")
};

/** 가구 종류의 아이콘 그림. 없으면 undefined. */
export function furnitureIcon(type: string): ImageSourcePropType | undefined {
  return ICONS[type];
}
