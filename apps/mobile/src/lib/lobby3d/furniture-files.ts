import type { ImageSourcePropType } from "react-native";
import { catalogItem } from "@/lib/item-catalog-store";
import { cachedItemFile, fetchItemFile, itemFileFailed, type ItemFileRef } from "@/lib/item-files";

// 가구 모델(glb)·아이콘(png)을 어디서 가져올지 정한다.
// - 앱에 든 것: 처음 방 가구 일곱의 모델과 그중 치울 수 있는 셋(옷장·깔개·스탠드)의 아이콘. 서버 목록의 해시와 같으면 앱 것을 쓴다.
// - 그 밖은 서버 목록(assets)의 파일을 처음 필요할 때 받아 기기에 둔다(item-files).
//   서버가 앱에 든 가구의 파일을 바꿨으면 새 파일을 받고, 받을 때까지는 앱에 든 것을 쓴다.
// 앱 파일은 scripts/lobby3d/split-furniture.py가 만든다. 파일을 바꾸면 아래 해시도 바꾼다(서버 목록 파일과 같은 내용이다).

/** 앱에 든 가구 모델 파일의 해시(처음 방 일곱). */
const BUNDLED_MODEL_SHA: Readonly<Record<string, string>> = {
  desk: "591a20955bec80d590949c8499cdde86f780c9336ba1ff26f0fe816916e783ce",
  bookcase: "99e501451b771303240e7bc0766c9a62c2a35bfcab777da9b51d23dfcdfb9a62",
  board: "2c57ff93abcff046885c760f79775735c992ec997fde56196b221499794aafeb",
  window: "0fe395a8973bcea6162b6dc43c4c7505845e8294359c4f81f09551ef6f343f6b",
  wardrobe: "92c68377f8c9636b1029d63200beeec0d811457b6e008bc53e86bec7e1853a9f",
  rug: "33613347439658057485050aa4ab4de4ef498b828033e41005f564728e8b1d01",
  lamp: "507658743221ec7d38097cd8a9e8bf91b967cd1ae9b0385c53e3e0def3defa0b"
};

/**
 * 앱에 든 가구 모델 모듈(처음 방 일곱). 모델 파일은 3D를 그릴 때 처음 불러온다
 * (이름·아이콘만 쓰는 화면과 시험 환경이 모델 파일을 읽지 않게).
 */
let bundledModules: Readonly<Record<string, number>> | null = null;
function bundledModels(): Readonly<Record<string, number>> {
  /* eslint-disable @typescript-eslint/no-require-imports */
  bundledModules ??= {
    desk: require("../../../assets/models/furniture/desk.glb"),
    bookcase: require("../../../assets/models/furniture/bookcase.glb"),
    board: require("../../../assets/models/furniture/board.glb"),
    window: require("../../../assets/models/furniture/window.glb"),
    wardrobe: require("../../../assets/models/furniture/wardrobe.glb"),
    rug: require("../../../assets/models/furniture/rug.glb"),
    lamp: require("../../../assets/models/furniture/lamp.glb")
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
  return bundledModules;
}

const BUNDLED_ICONS: Readonly<Record<string, { source: ImageSourcePropType; sha256: string }>> = {
  wardrobe: { source: require("../../../assets/icons/furniture/wardrobe.png"), sha256: "fe559131ef3ea825e05379bcb4413b8d66e10f8d7f88b17c3b7375692c5ab386" },
  rug: { source: require("../../../assets/icons/furniture/rug.png"), sha256: "a22d40b8eee342ba7c7da14dc7760c34f9c62977fcfe68e2fa97d52b130d1768" },
  lamp: { source: require("../../../assets/icons/furniture/lamp.png"), sha256: "dcdef6cf9b4bcd1be381fe27470fdaa7a0555ef5c64dcd1e99cf0fb3bd8c0b74" }
};

/** 앱에 든 가구 종류(처음 방 일곱). bundledFurnitureModels()와 같은 순서다. */
export const BUNDLED_FURNITURE_TYPES: readonly string[] = Object.keys(BUNDLED_MODEL_SHA);
/** 앱에 든 가구 모델 모듈(처음 방 일곱, BUNDLED_FURNITURE_TYPES 순서). 3D 화면이 처음 그릴 때 미리 불러 둔다. */
export function bundledFurnitureModels(): number[] {
  const modules = bundledModels();
  return BUNDLED_FURNITURE_TYPES.map((type) => modules[type]);
}

/** 그릴 모델 파일: 앱에 든 모듈 번호나 기기 파일 주소. 같은 파일이면 같은 key다. */
export type FurnitureModelSource = { key: string; url: number | string; bundled: boolean };

const bundledSource = (type: string): FurnitureModelSource | null =>
  BUNDLED_MODEL_SHA[type] ? { key: `bundled:${type}`, url: bundledModels()[type], bundled: true } : null;

function modelRef(type: string): ItemFileRef | null {
  return catalogItem(type)?.assets?.model ?? null;
}

/**
 * 그 가구를 지금 그릴 모델. 받아야 하는데 아직 기기에 없으면, fetch가 참일 때 받기를 시작하고
 * 앱에 든 모델(처음 방 일곱)이나 null(자리 표시 상자)을 돌려준다. 받으면 item-files가 알려 다시 부르면 된다.
 */
export function furnitureModelSource(type: string, options: { fetch: boolean }): FurnitureModelSource | null {
  const ref = modelRef(type);
  const bundled = bundledSource(type);
  if (!ref) return bundled;
  if (bundled && BUNDLED_MODEL_SHA[type] === ref.sha256) return bundled;
  const uri = cachedItemFile(ref);
  if (uri) return { key: `file:${ref.sha256}`, url: uri, bundled: false };
  if (options.fetch && !itemFileFailed(ref)) void fetchItemFile(ref);
  return bundled;
}

/** 그 가구 모델을 받기 시작한다(이미 있거나 받는 중이면 아무것도 하지 않는다). 보관함에서 꺼냈을 때 등. */
export function requestFurnitureModel(type: string): void {
  furnitureModelSource(type, { fetch: true });
}

/**
 * 가구 아이콘 그림(꾸미기 보관함·홈쇼핑). 앱에 든 것과 해시가 같으면 앱 것, 아니면 기기에 받은 파일.
 * 아직 없으면 받기 시작하고 앱에 든 것이나 undefined(이름 첫 글자 칸)를 돌려준다.
 */
export function furnitureIconSource(type: string): ImageSourcePropType | undefined {
  const bundled = BUNDLED_ICONS[type];
  const ref = catalogItem(type)?.assets?.icon ?? null;
  if (!ref) return bundled?.source;
  if (bundled && bundled.sha256 === ref.sha256) return bundled.source;
  const uri = cachedItemFile(ref);
  if (uri) return { uri };
  if (!itemFileFailed(ref)) void fetchItemFile(ref);
  return bundled?.source;
}
