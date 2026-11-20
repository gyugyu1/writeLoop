// [spec] qa 테스트(작업 130 가구점 새 매장·명패, 기능 변경, 모바일): 상품 여섯과 명패 그림 파일 받기(명세 1, 4-3, 4-5).
// 기대값은 private 작업 폴더 130-2026-11-20-가구점-새-매장-명패/01-main-spec.md에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다(item-catalog-store·item-files·item-catalog는 그대로). 새로 가정한 것(구현과 다르면 이 부분만 고친다):
//  - 목록 아이템의 assets에 nameplate(주소·sha256·크기)가 있다(서버 응답 필드, 명세 4-5).
//  - shop-files에 명패 그림의 상태를 보는 shopNameplateFile(id) = 기기 주소 | "loading" | "missing"(shopProductFile과 같은 뜻)과 shopNameplateUris()(상품 id → 주소 | null)가 있다.
//  - prefetchShopFiles·retryShopFiles는 상품 모델과 함께 명패 그림도 받는다.
import { catalogItem, parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";

const mockFiles = {
  cached: new Map<string, string>(),
  failed: new Set<string>(),
  fetched: [] as string[],
  retried: 0,
  pruned: [] as ReadonlySet<string>[]
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
  },
  pruneItemFiles: (keep: ReadonlySet<string>) => {
    mockFiles.pruned.push(keep);
  }
}));
jest.mock("@/lib/api", () => ({ getItemCatalog: () => mockApi.get() }));
jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const mockApi: { get: () => Promise<unknown> } = { get: () => Promise.reject(new Error("offline")) };

/* eslint-disable @typescript-eslint/no-require-imports */
const files = require("@/lib/lobby3d/shop-files") as typeof import("@/lib/lobby3d/shop-files");
const { refreshItemCatalog } = require("@/lib/item-catalog") as typeof import("@/lib/item-catalog");
/* eslint-enable @typescript-eslint/no-require-imports */

interface NameplateFiles {
  shopNameplateFile(id: string): string;
  shopNameplateUris(): Record<string, string | null>;
}
const nameplate = files as unknown as NameplateFiles;

const IDS = ["rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"];
const hex = (n: number) => n.toString(16).padStart(64, "0");
const modelSha = (i: number) => hex(100 + i);
const plateSha = (i: number) => hex(200 + i);

/** 지정한 상품만 목록에 넣는다. withPlate에 든 상품만 명패 그림 항목이 있다. */
function catalogWith(ids: readonly string[], withPlate: readonly string[] = ids) {
  const data = parseItemCatalog({
    version: "v1",
    items: ids.map((id) => {
      const i = IDS.indexOf(id);
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
        assets: {
          model: { url: `/api/catalog/files/${modelSha(i)}.glb`, sha256: modelSha(i), bytes: 10 },
          icon: null,
          ...(withPlate.includes(id) ? { nameplate: { url: `/api/catalog/files/${plateSha(i)}.png`, sha256: plateSha(i), bytes: 20 } } : {})
        }
      };
    })
  });
  setItemCatalog(data!);
  return data!;
}

beforeEach(() => {
  mockFiles.cached.clear();
  mockFiles.failed.clear();
  mockFiles.fetched = [];
  mockFiles.retried = 0;
  mockFiles.pruned = [];
  mockApi.get = () => Promise.reject(new Error("offline"));
});

describe("[spec] 상품 여섯(명세 1)", () => {
  it("F1: 받는 것은 진열 상품 여섯(서버 가구 id, 표 차례)이다", () => {
    expect([...files.SHOP_FILE_ITEMS]).toEqual(IDS);
  });

  it("F2: 상품 모델 상태는 상품마다다: 없는 상품은 missing, 있으면 loading, 기기에 있으면 그 주소", () => {
    catalogWith(["rainbootPlanter", "walnutBed", "cloudDesk"]);
    mockFiles.cached.set(modelSha(5), "file:///cloud.glb");
    expect(files.shopProductFile("catPostDesk" as never)).toBe("missing");
    expect(files.shopProductFile("rainbootPlanter" as never)).toBe("loading");
    expect(files.shopProductFile("cloudDesk")).toBe("file:///cloud.glb");
    expect(files.shopProductUris()).toEqual({
      rainbootPlanter: null,
      catPostDesk: null,
      stargazerBed: null,
      walnutBed: null,
      grandmasFloorBedding: null,
      cloudDesk: "file:///cloud.glb"
    });
  });
});

describe("[spec] 명패 그림 파일(명세 4-3, 4-5)", () => {
  it("F3: 목록 아이템의 assets.nameplate(주소·sha256·크기)을 읽는다. 없는 아이템은 nameplate가 없다(오류 없이)", () => {
    catalogWith(["walnutBed", "cloudDesk"], ["walnutBed"]);
    const withPlate = catalogItem("walnutBed")?.assets as { nameplate?: { url: string; sha256: string; bytes: number } | null } | null;
    expect(withPlate?.nameplate).toEqual({ url: `/api/catalog/files/${plateSha(3)}.png`, sha256: plateSha(3), bytes: 20 });
    const without = catalogItem("cloudDesk")?.assets as { nameplate?: unknown } | null;
    expect(without?.nameplate ?? null).toBeNull();
  });

  it("F4: 미리 받기는 상품 모델과 명패 그림을 함께 받기 시작한다(목록에 있는 것만)", () => {
    catalogWith(["rainbootPlanter", "cloudDesk"]);
    files.prefetchShopFiles();
    expect([...mockFiles.fetched].sort()).toEqual([modelSha(0), modelSha(5), plateSha(0), plateSha(5)].sort());
  });

  it("F5: 명패 그림이 목록에 없는 상품은 그림만 받지 않고(오류 없이) 모델은 받는다. 그 명패는 missing이다", () => {
    catalogWith(["rainbootPlanter", "cloudDesk"], ["cloudDesk"]);
    files.prefetchShopFiles();
    expect([...mockFiles.fetched].sort()).toEqual([modelSha(0), modelSha(5), plateSha(5)].sort());
    expect(nameplate.shopNameplateFile("rainbootPlanter")).toBe("missing");
    expect(nameplate.shopNameplateFile("cloudDesk")).toBe("loading");
  });

  it("F6: 명패 그림 상태: 받는 중은 loading, 기기에 있으면 그 주소, 목록에 없는 상품은 missing이고 주소 표는 없는 것을 null로 둔다", () => {
    catalogWith(["rainbootPlanter", "stargazerBed"]);
    mockFiles.cached.set(plateSha(2), "file:///star.png");
    expect(nameplate.shopNameplateFile("stargazerBed")).toBe("file:///star.png");
    expect(nameplate.shopNameplateFile("rainbootPlanter")).toBe("loading");
    expect(nameplate.shopNameplateFile("walnutBed")).toBe("missing");
    expect(nameplate.shopNameplateUris()).toEqual({
      rainbootPlanter: null,
      catPostDesk: null,
      stargazerBed: "file:///star.png",
      walnutBed: null,
      grandmasFloorBedding: null,
      cloudDesk: null
    });
  });

  it("F7: 명패 그림 받기가 실패해도 상품 모델 상태는 그대로다(모델은 있음, 명패만 missing). 미리 받기는 실패한 그림을 건너뛴다", () => {
    catalogWith(["cloudDesk"]);
    mockFiles.cached.set(modelSha(5), "file:///cloud.glb");
    mockFiles.failed.add(plateSha(5));
    expect(files.shopProductFile("cloudDesk")).toBe("file:///cloud.glb");
    expect(nameplate.shopNameplateFile("cloudDesk")).toBe("missing");
    files.prefetchShopFiles();
    expect(mockFiles.fetched).not.toContain(plateSha(5));
  });

  it("F8: 다시 받기(들어가기·마을에 나가기)는 실패한 명패 그림의 실패 기록도 지우고 다시 받는다", () => {
    catalogWith(["cloudDesk"]);
    mockFiles.cached.set(modelSha(5), "file:///cloud.glb");
    mockFiles.failed.add(plateSha(5));
    files.retryShopFiles();
    expect(mockFiles.retried).toBe(1);
    expect(mockFiles.fetched).toContain(plateSha(5));
    expect(nameplate.shopNameplateFile("cloudDesk")).toBe("loading");
  });

  it("F9: 이미 기기에 있는 명패 그림은 다시 받지 않는다는 판단은 기기 주소가 있으면 상태가 그 주소라는 것으로 본다(받은 뒤에도 loading으로 돌아가지 않는다)", () => {
    catalogWith(["catPostDesk"]);
    mockFiles.cached.set(plateSha(1), "file:///cat.png");
    mockFiles.cached.set(modelSha(1), "file:///cat.glb");
    expect(nameplate.shopNameplateFile("catPostDesk")).toBe("file:///cat.png");
    expect(files.shopProductFile("catPostDesk" as never)).toBe("file:///cat.glb");
  });
});

describe("[spec] 목록 파일 정리에서 명패 그림을 지우지 않는다(명세 4-5)", () => {
  it("F10: 목록을 새로 받아 파일을 정리할 때 남길 목록에 상품 모델과 명패 그림 해시가 모두 들어 있다", async () => {
    const data = catalogWith(["rainbootPlanter", "cloudDesk"]);
    mockApi.get = async () => data;
    await refreshItemCatalog({ store: false });
    expect(mockFiles.pruned).toHaveLength(1);
    const keep = mockFiles.pruned[0];
    for (const sha of [modelSha(0), modelSha(5), plateSha(0), plateSha(5)]) expect({ sha, kept: keep.has(sha) }).toEqual({ sha, kept: true });
  });
});
