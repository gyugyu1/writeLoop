// 마을 땅 꾸밈이 읽는 그림과 장식 모델(앱 번들 자산). 땅 꾸밈(lobby3d-village)과 미리 읽기(lobby3d-preload)가 이 목록 하나를 함께 써야
// 같은 읽기를 함께 쓴다(불러오기는 읽는 쪽과 파일 목록이 같아야 같은 것으로 본다).
// 쓰는 때에 불러온다: 모듈을 읽을 때 불러오지 않아, 이 자산을 모르는 화면·테스트에서도 이 모듈을 읽을 수 있다.

/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 땅 그림 여덟 장. 순서: 계절 흩뿌림 그림 모음, 흙 a, 흙 b, 풀밭 바탕에 섞는 무늬 다섯(짧은 풀, 무성한 풀, 클로버, 이끼, 맨땅).
 */
export function villageGroundTextureAssets(): string[] {
  return [
    require("../../../assets/textures/village/season-scatter.png"),
    require("../../../assets/textures/village/dirt.jpg"),
    require("../../../assets/textures/village/dirt-b.jpg"),
    require("../../../assets/textures/village/ground-grass-short.jpg"),
    require("../../../assets/textures/village/ground-grass-lush.jpg"),
    require("../../../assets/textures/village/ground-clover.jpg"),
    require("../../../assets/textures/village/ground-moss.jpg"),
    require("../../../assets/textures/village/ground-bare.jpg")
  ] as string[];
}

/** 3D 꽃·풀 장식 모델. */
export function villageFlowersAsset(): string {
  return require("../../../assets/models/village-flowers.glb") as string;
}
/* eslint-enable @typescript-eslint/no-require-imports */
