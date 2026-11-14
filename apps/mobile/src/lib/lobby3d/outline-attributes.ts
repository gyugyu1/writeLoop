// 외곽선 껍질에 쓸 꼭짓점 속성 고르기. 규격(docs/guides/character-3d-model-spec.ko.md 5-1)의 외곽선 속성이 없는 모델도
// 외곽선이 그려지게, 없으면 꼭짓점 법선과 고정 거리로 대신한다. 이름은 three.js가 불러온 geometry의 속성 이름이다.

/** 외곽선 속성이 없을 때 껍질을 카메라에서 뒤로 미는 거리(키 1 기준). */
export const OUTLINE_BIAS_FALLBACK = 0.008;

export interface OutlineAttributeChoice {
  direction: "_outline_normal" | "normal";
  bias: { source: "attribute"; attribute: "_outline_bias" } | { source: "constant"; value: number };
}

export function outlineAttributes({
  hasOutlineNormal,
  hasOutlineBias
}: {
  hasOutlineNormal: boolean;
  hasOutlineBias: boolean;
}): OutlineAttributeChoice {
  return {
    direction: hasOutlineNormal ? "_outline_normal" : "normal",
    bias: hasOutlineBias ? { source: "attribute", attribute: "_outline_bias" } : { source: "constant", value: OUTLINE_BIAS_FALLBACK }
  };
}
