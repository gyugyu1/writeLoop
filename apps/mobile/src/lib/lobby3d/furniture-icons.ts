import type { ImageSourcePropType } from "react-native";
import { furnitureIconSource } from "./furniture-files";

// 꾸미기 보관함·홈쇼핑에 보이는 가구 아이콘 그림(가구 종류 id → 그림). 그림은 scripts/lobby3d/render-icons.py가 찍는다.
// 앱에는 처음 방의 치울 수 있는 가구 셋만 들어 있고, 나머지는 서버 아이템 목록의 아이콘 파일을 받아 쓴다(furniture-files).
// 그림이 아직 없으면(받는 중·실패·아이콘 없는 가구) 화면이 이름 첫 글자 칸으로 대신한다. 받으면 item-files를 구독한 화면이 다시 그린다.

/** 가구 종류의 아이콘 그림. 없으면 undefined. */
export function furnitureIcon(type: string): ImageSourcePropType | undefined {
  return furnitureIconSource(type);
}
