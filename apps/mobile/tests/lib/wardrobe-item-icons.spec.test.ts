// [spec] qa 테스트(작업 089 ③ 옷장 장소와 캐릭터 꾸미기 화면, 새 기능, 모바일): 아이템 넷의 칸 그림 파일(시나리오 I1).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/02-qa-scenarios.md의 I1: 네 종류마다 그림 파일이 있고
// 서로 다르며, PNG이고 투명 채널이 있다)에서만 가져온다.
// 구현 커밋 5832ac1에서 읽은 것은 그림 파일의 자리뿐이다(assets/icons/wearables/<종류>.png). 화면이 그 그림을 칸에 쓰는지는
// 화면 테스트(home-closet.spec SC4)가 본다. 그림이 또렷한지·구도는 사용자가 직접 본다(I3).
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const TYPES = ["capOrange", "tshirtOrange", "shortsNavy", "shoesBrown"];
const DIR = join(__dirname, "..", "..", "assets", "icons", "wearables");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG에 투명 채널이 있는지: 색 형식이 알파 포함(4 회색+알파, 6 RGBA)이거나 tRNS 덩어리가 있다. */
function hasAlpha(png: Buffer): boolean {
  const colorType = png[25];
  if (colorType === 4 || colorType === 6) return true;
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString("ascii", offset + 4, offset + 8);
    if (kind === "tRNS") return true;
    if (kind === "IEND") break;
    offset += 12 + length;
  }
  return false;
}

describe("[spec] 089-③ I1: 아이템 넷마다 칸 그림(투명 배경 PNG)", () => {
  it("I1: 네 종류마다 그림 파일이 있고, PNG이며 투명 채널이 있고, 네 파일의 내용이 서로 다르다", () => {
    const seen = TYPES.map((type) => {
      const path = join(DIR, `${type}.png`);
      if (!existsSync(path)) return { type, exists: false, png: false, alpha: false, hash: "" };
      const data = readFileSync(path);
      return {
        type,
        exists: true,
        png: data.subarray(0, 8).equals(PNG_SIGNATURE),
        alpha: hasAlpha(data),
        hash: createHash("sha256").update(data).digest("hex")
      };
    });
    expect(seen.map(({ type, exists, png, alpha }) => ({ type, exists, png, alpha }))).toEqual(
      TYPES.map((type) => ({ type, exists: true, png: true, alpha: true }))
    );
    expect(new Set(seen.map((s) => s.hash)).size).toBe(4);
  });
});
