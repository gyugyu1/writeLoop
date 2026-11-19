// 메인 세션 테스트(작업 128 14 결정, 129): 가구점 진열 상품 셋을 서버 목록(팔지 않는 가구)에서 받는 상품마다의 상태(있음·받는 중·없음)와 미리 받기·다시 받기.
// 실내·주인 버들은 앱에 들어 있어 받지 않는다. 가구점은 상품을 기다리지 않고 들어가고, 없는 상품의 진열대만 빈다(129).
import { setItemCatalog, parseItemCatalog } from "@/lib/item-catalog-store";

const mockFiles = {
  cached: new Map<string, string>(),
  failed: new Set<string>(),
  fetched: [] as string[],
  retried: 0
};

jest.mock("@/lib/item-files", () => ({
  cachedItemFile: (ref: { sha256: string } | null) => (ref ? mockFiles.cached.get(ref.sha256) ?? null : null),
  itemFileFailed: (ref: { sha256: string } | null) => Boolean(ref && mockFiles.failed.has(ref.sha256)),
  fetchItemFile: (ref: { sha256: string }) => {
    mockFiles.fetched.push(ref.sha256);
    return Promise.resolve(null);
  },
  retryFailedItemFiles: () => {
    mockFiles.retried += 1;
    mockFiles.failed.clear();
  }
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { SHOP_FILE_ITEMS, prefetchShopFiles, retryShopFiles, shopProductFile, shopProductUris } = require("@/lib/lobby3d/shop-files") as typeof import("@/lib/lobby3d/shop-files");
/* eslint-enable @typescript-eslint/no-require-imports */

const sha = (i: number) => String(i).repeat(64).slice(0, 64);

function catalogWith(ids: readonly string[]) {
  const data = parseItemCatalog({
    version: "v1",
    items: ids.map((id) => {
      const i = SHOP_FILE_ITEMS.indexOf(id) + 1;
      return {
        id,
        kind: "furniture",
        name: id,
        shopName: id,
        description: "",
        category: null,
        slot: null,
        price: null,
        draw: { mount: "floor" },
        assets: { model: { url: `/api/catalog/files/${sha(i)}.glb`, sha256: sha(i), bytes: 10 }, icon: null }
      };
    })
  });
  setItemCatalog(data!);
}

beforeEach(() => {
  mockFiles.cached.clear();
  mockFiles.failed.clear();
  mockFiles.fetched = [];
  mockFiles.retried = 0;
});

it("받는 것은 진열 상품 셋(서버 가구 id)뿐이다", () => {
  expect(SHOP_FILE_ITEMS).toEqual(["walnutBed", "grandmasFloorBedding", "cloudDesk"]);
});

it("목록에 없는 상품은 없음이고 받지 않지만, 있는 상품은 받기 시작한다(129: 하나가 없어도 나머지는 받는다)", () => {
  catalogWith(["walnutBed", "cloudDesk"]);
  expect(shopProductFile("grandmasFloorBedding")).toBe("missing");
  expect(shopProductFile("walnutBed")).toBe("loading");
  prefetchShopFiles();
  expect(mockFiles.fetched).toEqual([sha(1), sha(3)]);
});

it("받는 동안은 받는 중, 기기에 있으면 그 주소이고, 주소 표는 없는 상품을 null로 둔다", () => {
  catalogWith(SHOP_FILE_ITEMS);
  mockFiles.cached.set(sha(3), "file:///3.glb");
  expect(shopProductFile("cloudDesk")).toBe("file:///3.glb");
  expect(shopProductFile("walnutBed")).toBe("loading");
  expect(shopProductUris()).toEqual({ walnutBed: null, grandmasFloorBedding: null, cloudDesk: "file:///3.glb" });
});

it("받기에 실패한 상품은 없음이고 미리 받기가 건너뛰며, 다시 받기(들어가기·마을에 나가기)는 실패 기록을 지우고 다시 받는다", () => {
  catalogWith(SHOP_FILE_ITEMS);
  mockFiles.failed.add(sha(2));
  expect(shopProductFile("grandmasFloorBedding")).toBe("missing");
  prefetchShopFiles();
  expect(mockFiles.fetched).toEqual([sha(1), sha(3)]);
  mockFiles.fetched = [];
  retryShopFiles();
  expect(mockFiles.retried).toBe(1);
  expect(mockFiles.fetched).toEqual([1, 2, 3].map(sha));
  expect(shopProductFile("grandmasFloorBedding")).toBe("loading");
});
