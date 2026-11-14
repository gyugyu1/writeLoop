/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 060 ①, 기능 변경: 모델만 바꿔 끼울 수 있게). 바뀔 동작 "외곽선 속성이 없는 모델도 외곽선을 그린다".
// 기대값은 명세(private 작업 폴더 02-모델-교체-쉽게/01-main-spec.md 바뀌는 동작 2)에서만 가져온다.
// - _OUTLINE_NORMAL이 없으면 꼭짓점 법선으로 부풀린다. 있으면 지금처럼 그 속성을 쓴다.
// - _OUTLINE_BIAS가 없으면 모든 꼭짓점을 0.008(키 1 기준)만큼 뒤로 민다. 있으면 지금처럼 그 속성을 쓴다.
// - 두 속성은 따로 고른다(하나만 있어도 그것은 쓴다).
// 명세가 그리기 모듈 밖의 순수 함수로 떼라고 한 "어떤 속성을 쓸지" 고르는 규칙을 본다.
// 가정한 부르는 방법(02-qa-tests.md에 적음. 구현이 이름만 다르게 지으면 이름·import만 따라 고친다):
//   import { outlineAttributes } from "@/lib/lobby3d/outline-attributes";
//   outlineAttributes({ hasOutlineNormal, hasOutlineBias }) →
//     { direction: "_outline_normal" | "normal",
//       bias: { source: "attribute"; attribute: "_outline_bias" } | { source: "constant"; value: number } }
//   속성 이름은 three.js가 불러온 geometry의 이름이다(규격 문서 5-1의 "three.js 이름": _OUTLINE_NORMAL → _outline_normal,
//   glTF NORMAL → normal). 셰이더가 이 이름으로 속성을 받는다.
import { outlineAttributes } from "@/lib/lobby3d/outline-attributes";

describe("[spec] 외곽선에 쓸 속성 고르기", () => {
  it("[spec] 두 속성이 다 있으면 지금처럼 _outline_normal 방향, _outline_bias 거리를 쓴다", () => {
    expect(outlineAttributes({ hasOutlineNormal: true, hasOutlineBias: true })).toEqual({
      direction: "_outline_normal",
      bias: { source: "attribute", attribute: "_outline_bias" }
    });
  });

  it("[spec] 두 속성이 다 없으면 꼭짓점 법선(normal) 방향, 상수 0.008만큼 뒤로 민다", () => {
    expect(outlineAttributes({ hasOutlineNormal: false, hasOutlineBias: false })).toEqual({
      direction: "normal",
      bias: { source: "constant", value: 0.008 }
    });
  });

  it("[spec] _OUTLINE_NORMAL만 있으면 그 방향을 쓰고, 거리는 상수 0.008이다", () => {
    expect(outlineAttributes({ hasOutlineNormal: true, hasOutlineBias: false })).toEqual({
      direction: "_outline_normal",
      bias: { source: "constant", value: 0.008 }
    });
  });

  it("[spec] _OUTLINE_BIAS만 있으면 방향은 꼭짓점 법선이고, 거리는 그 속성을 쓴다", () => {
    expect(outlineAttributes({ hasOutlineNormal: false, hasOutlineBias: true })).toEqual({
      direction: "normal",
      bias: { source: "attribute", attribute: "_outline_bias" }
    });
  });
});
