// 메인 세션 테스트(작업 128 07 결정): 가구점 모델 다섯을 서버 목록에서 받는 상태(목록에 없음·받는 중·다 받음·실패)와 미리 받기.
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";

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
const { SHOP_FILE_ITEMS, prefetchShopFiles, retryShopFiles, shopFilesStatus } = require("@/lib/lobby3d/shop-files") as typeof import("@/lib/lobby3d/shop-files");
/* eslint-enable @typescript-eslint/no-require-imports */

const sha = (i: number) => String(i).repeat(64).slice(0, 64);

function catalogWith(ids: readonly string[], extra: object[] = []) {
  const data = parseItemCatalog({
    version: "v1",
    items: [
      ...ids.map((id, i) => ({
        id,
        kind: id.startsWith("shop") ? "asset" : "furniture",
        name: id,
        shopName: id,
        description: "",
        category: null,
        slot: null,
        price: null,
        draw: id.startsWith("shop") ? null : { mount: "floor" },
        assets: { model: { url: `/api/catalog/files/${sha(i + 1)}.glb`, sha256: sha(i + 1), bytes: 10 }, icon: null }
      })),
      ...extra
    ]
  });
  setItemCatalog(data!);
}

beforeEach(() => {
  mockFiles.cached.clear();
  mockFiles.failed.clear();
  mockFiles.fetched = [];
  mockFiles.retried = 0;
});

it("목록이 애셋 종류를 읽고, 모르는 종류는 그 아이템만 건너뛴다", () => {
  const data = parseItemCatalog({
    version: "v1",
    items: [
      { id: "shopInterior", kind: "asset", name: "가구점 실내", shopName: "가구점 실내", description: "", category: null, slot: null, price: null, draw: null, assets: { model: { url: "/x.glb", sha256: sha(1), bytes: 3 }, icon: null } },
      { id: "future", kind: "scene", name: "x", shopName: "x", description: "", category: null, slot: null, price: null, draw: null, assets: null }
    ]
  });
  expect(data?.items.map((i) => [i.id, i.kind])).toEqual([["shopInterior", "asset"]]);
});

it("다섯 중 하나라도 목록에 없으면 실패이고 받기를 시작하지 않는다", () => {
  catalogWith(SHOP_FILE_ITEMS.slice(0, 4));
  expect(shopFilesStatus()).toEqual({ status: "failed" });
  prefetchShopFiles();
  expect(mockFiles.fetched).toEqual([]);
});

it("목록에 다섯이 있으면 미리 받기가 다섯을 받기 시작하고, 받는 동안은 loading, 다 있으면 ready(실내·버들·상품 순서)", () => {
  catalogWith(SHOP_FILE_ITEMS);
  expect(shopFilesStatus()).toEqual({ status: "loading" });
  prefetchShopFiles();
  expect(mockFiles.fetched).toEqual([1, 2, 3, 4, 5].map(sha));
  [1, 2, 3, 4, 5].forEach((i) => mockFiles.cached.set(sha(i), `file:///${i}.glb`));
  expect(shopFilesStatus()).toEqual({
    status: "ready",
    interior: "file:///1.glb",
    shopkeeper: "file:///2.glb",
    products: ["file:///3.glb", "file:///4.glb", "file:///5.glb"]
  });
});

it("받기에 실패한 파일이 있으면 failed이고, 다시 들어가기(retry)는 실패 기록을 지우고 다시 받는다", () => {
  catalogWith(SHOP_FILE_ITEMS);
  mockFiles.failed.add(sha(3));
  expect(shopFilesStatus()).toEqual({ status: "failed" });
  prefetchShopFiles();
  expect(mockFiles.fetched).not.toContain(sha(3));
  mockFiles.fetched = [];
  retryShopFiles();
  expect(mockFiles.retried).toBe(1);
  expect(mockFiles.fetched).toEqual([1, 2, 3, 4, 5].map(sha));
  expect(shopFilesStatus()).toEqual({ status: "loading" });
});
