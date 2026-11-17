/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 102 마을 땅 무늬 섞기, 기능 변경, 모바일): 섞을 무늬 그림 자산과 앱 크기.
// 기대값은 명세(private 작업 폴더 102-2026-11-17-마을-땅-무늬-섞기/01-main-spec.md "바뀌는 동작" 3)에서만 가져온다. 견주는 기준은 명세 첫 줄의 기준 커밋 bfbee1a다.
// 바뀔 동작(구현 전 실패): A4. 그대로 둘 동작(구현 전·뒤 통과): A5.
// "약 1MB 안"은 작업 101과 같게 1,100,000바이트 이하로 정했다(02-qa-tests.md "가정"). 그림이 어느 무늬에 쓰이는지와 크기(512 안팎)는 장면 테스트 R2가 본다.
import { extname } from "node:path";
import { baseAssets, newImageFiles, nowAssets } from "../__fixtures__/village-splat-102";

const LIMIT_BYTES = 1_100_000;

describe("[spec] 102 바뀔 동작: 섞을 무늬 그림 자산(명세 3)", () => {
  it("A4 섞을 무늬 그림을 앱 자산(apps/mobile/assets 아래)으로 넣었다: 기준 커밋 뒤에 새로 넣은 그림 파일(.png/.jpg/.jpeg/.webp)이 넷 이상이다(풀 무늬 넷)", () => {
    const added = newImageFiles();
    expect({ enough: added.length >= 4, added, exts: added.map((p) => extname(p).toLowerCase()) }).toEqual({
      enough: true,
      added,
      exts: added.map((p) => extname(p).toLowerCase())
    });
  });
});

describe("[spec] 102 그대로 둘 동작: 앱 크기", () => {
  it("A5 앱 자산 폴더(apps/mobile/assets)의 크기 증가가 기준 커밋보다 1,100,000바이트 이하다(약 1MB 안)", () => {
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const base = baseAssets();
    expect(base.size).toBeGreaterThan(0);
    const growth = sum(nowAssets()) - sum(base);
    expect({ growth, within: growth <= LIMIT_BYTES }).toEqual({ growth, within: true });
  });
});
