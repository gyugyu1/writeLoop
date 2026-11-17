/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 103 마을 흩뿌림·흙길, 기능 변경, 모바일): 흩뿌림 조각 모음과 흙 b 그림 자산, 101 풀 자국 그림 빼기.
// 기대값은 명세(private 작업 폴더 103-2026-11-18-마을-흩뿌림-흙길/01-main-spec.md "바뀌는 동작" 4)에서만 가져온다. 견주는 기준은 명세 첫 줄의 기준 커밋 070ef33이다.
// 바뀔 동작(구현 전 실패): A6·A7.
// 앱 크기(약 1MB 안)는 101 A3(기준 25e9cc7)·102 A5(기준 bfbee1a)가 그대로 본다. 어느 그림이 조각 모음·흙 b인지는 장면 테스트 F2·P6이 본다.
// "101 풀 자국 그림은 더 쓰지 않으면 뺀다": 103은 풀 자국을 모두 흩뿌림 조각으로 바꾸므로 그 그림은 쓰이지 않는다. 그래서 빠져야 한다고 본다
// (이름을 바꿔 남겨도 잡히게, 기준 커밋의 grass-marks.png와 내용이 같은 자산 파일이 없는지 본다).
import { extname } from "node:path";
import { GRASS_MARKS_REL, baseFileSha, fileSha, newImageFiles103 } from "../__fixtures__/village-ground-103";
import { nowAssets } from "../__fixtures__/village-splat-102";

describe("[spec] 103 바뀔 동작: 그림 자산(명세 4)", () => {
  it("A6 흩뿌림 조각 모음 그림과 흙 b 그림을 앱 자산(apps/mobile/assets 아래)으로 넣었다: 기준 커밋 뒤에 새로 넣은 그림 파일(.png/.jpg/.jpeg/.webp)이 둘 이상이다", () => {
    const added = newImageFiles103();
    expect({ enough: added.length >= 2, added, exts: added.map((p) => extname(p).toLowerCase()) }).toEqual({ enough: true, added, exts: added.map((p) => extname(p).toLowerCase()) });
  });

  it("A7 101 풀 자국 그림은 뺐다: 앱 자산 폴더에 기준 커밋의 grass-marks.png와 내용이 같은 파일이 없다", () => {
    const marksSha = baseFileSha(GRASS_MARKS_REL);
    const same = [...nowAssets().keys()].filter((p) => fileSha(p) === marksSha);
    expect(same).toEqual([]);
  });
});
