// [spec] qa 테스트(작업 128 가구점 실내, 07·14 결정: 진열 상품 셋을 서버에서 받기, 모바일): 08-qa-scenarios.md의 C1~C6, D1~D6을 14 결정으로 바꾼 것.
// 기대값은 private 작업 폴더 128-2026-11-19-가구점-실내/07-main-decision.md "바뀐 명세 1"과 14-main-decision.md(실내·버들은 앱 자산, 애셋 종류 없음, 서버에서 받는 것은 상품 셋뿐)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다: item-catalog-store(parseItemCatalog·setItemCatalog), item-files(받기·기기 파일), shop-files(prefetchShopFiles·
// retryShopFiles·shopFilesStatus·SHOP_FILE_ITEMS), item-catalog(refreshItemCatalog), 로비 화면과 3D 그리기 가짜(onShopReady·onShopFailed).
// 3D 그리기(ShopLayer가 다 받을 때까지 그리지 않고 실패를 알림)는 Jest에서 돌릴 수 없어, 그 판정의 근거인 shopFilesStatus(ready·loading·failed)와
// 화면이 하는 일(마을에 나가면 받기 시작, 들어가기에서 다시 받기)을 본다. 화면이 어두운 채 기다리고 실패 시 마을로 돌아오는 것은 lobby3d-shop-flow.spec.test.tsx가 본다.
// 기기 파일은 expo-file-system 가짜(주소 → 크기 표, 받기는 테스트가 답을 정한다)로 대신한다(tests/lib/furniture-download.spec.test.ts와 같은 방식).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { refreshItemCatalog } from "@/lib/item-catalog";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { SHOP_FILE_ITEMS, prefetchShopFiles, retryShopFiles, shopFilesStatus } from "@/lib/lobby3d/shop-files";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";

type Reply = { bytes: number } | "fail";

const mockDevice = {
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  downloads: [] as string[],
  deletes: [] as string[],
  /** 파일 API 경로 → 답. 없으면 실패 */
  replies: new Map<string, Reply>()
};
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockApi: { getItemCatalog: () => Promise<unknown> } = { getItemCatalog: () => Promise.reject(new Error("offline")) };

jest.mock("expo-file-system", () => {
  const join2 = (parent: unknown, name: string) => {
    const base = typeof parent === "string" ? parent : (parent as { uri: string }).uri;
    return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
  };
  class File {
    uri: string;
    constructor(parent: unknown, name?: string) {
      this.uri = name === undefined ? (typeof parent === "string" ? parent : (parent as { uri: string }).uri) : join2(parent, name);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get exists() {
      return mockDevice.files.has(this.uri);
    }
    get size() {
      return mockDevice.files.get(this.uri) ?? 0;
    }
    delete() {
      mockDevice.files.delete(this.uri);
      mockDevice.deletes.push(this.uri);
    }
    static async downloadFileAsync(url: string, destination: { uri: string }) {
      mockDevice.downloads.push(url);
      const path = url.slice(url.indexOf("/api/"));
      const reply = mockDevice.replies.get(path);
      if (!reply || reply === "fail") throw new Error(`받지 못함(테스트 가짜): ${path}`);
      const file = new File(destination.uri);
      mockDevice.files.set(file.uri, reply.bytes);
      return file;
    }
  }
  class Directory {
    uri: string;
    constructor(parent: unknown, name: string) {
      this.uri = `${join2(parent, name)}/`;
    }
    get exists() {
      return mockDevice.dirs.has(this.uri) || [...mockDevice.files.keys()].some((key) => key.startsWith(this.uri));
    }
    create() {
      mockDevice.dirs.add(this.uri);
    }
    list() {
      return [...mockDevice.files.keys()].filter((key) => key.startsWith(this.uri) && !key.slice(this.uri.length).includes("/")).map((key) => new File(key));
    }
  }
  return { File, Directory, Paths: { document: { uri: "file:///qa-document/" }, cache: { uri: "file:///qa-cache/" } } };
});
jest.mock("@/lib/api", () => ({ getItemCatalog: () => mockApi.getItemCatalog() }));
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    const onRoomShown = props.onRoomShown;
    const sent = React.useRef(false);
    React.useEffect(() => {
      if (sent.current || !onRoomShown) return;
      sent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    const area = props.area ?? "room";
    React.useEffect(() => {
      if (area === "village") mockCanvas.props?.onVillageReady?.();
      if (area === "shop") mockCanvas.props?.onShopReady?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 준비 ----------

/** 테스트마다 다른 해시를 쓴다(item-files가 받은 파일을 모듈 안에 기억하므로 테스트끼리 섞이지 않게). */
let seed = 0;
const hex = (n: number) => n.toString(16).padStart(64, "0");
const BYTES = 1000;

interface Five {  // 상품 셋(이름은 예전 그대로)
  ids: string[];
  sha: string[];
  paths: string[];
}

/** 진열 상품 셋(팔지 않는 가구)이 든 목록을 넣는다. 해시는 이 테스트 것. */
function putCatalog(only?: readonly string[]): Five {
  seed += 1;
  const ids = [...SHOP_FILE_ITEMS];
  const sha = ids.map((_, i) => hex(seed * 100 + i + 1));
  const paths = sha.map((s) => `/api/catalog/files/${s}.glb`);
  const items = ids
    .map((id, i) => ({
      id,
      kind: "furniture",
      name: id,
      shopName: id,
      description: "",
      category: null,
      slot: null,
      price: null,
      draw: null,
      assets: { model: { url: paths[i], sha256: sha[i], bytes: BYTES }, icon: null }
    }))
    .filter((item) => !only || only.includes(item.id));
  setItemCatalog(parseItemCatalog({ version: `v${seed}`, items })!);
  return { ids, sha, paths };
}

const uriOf = (sha: string) => `file:///qa-document/item-files/${sha}.glb`;
const putOnDevice = (five: Five, indexes: number[]) => indexes.forEach((i) => mockDevice.files.set(uriOf(five.sha[i]), BYTES));
const serverHas = (five: Five, indexes: number[]) => indexes.forEach((i) => mockDevice.replies.set(five.paths[i], { bytes: BYTES }));
const downloadedPaths = () => mockDevice.downloads.map((url) => url.slice(url.indexOf("/api/")));

async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  mockDevice.files.clear();
  mockDevice.dirs.clear();
  mockDevice.downloads = [];
  mockDevice.deletes = [];
  mockDevice.replies.clear();
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 목록 읽기(C1·C6)", () => {
  it("C1(14 결정): 애셋 종류(asset)는 없어졌다. 목록이 asset 같은 모르는 종류를 건너뛰고 오류 없이 나머지(가구)를 읽는다", () => {
    const data = parseItemCatalog({
      version: "q",
      items: [
        { id: "a1", kind: "asset", name: "n", shopName: "n", description: "", category: null, slot: null, price: null, draw: null, assets: { model: { url: "/x.glb", sha256: hex(1), bytes: 3 }, icon: null } },
        { id: "z1", kind: "future-kind", name: "n", shopName: "n", description: "", category: null, slot: null, price: null, draw: null, assets: null },
        { id: "f1", kind: "furniture", name: "n", shopName: "n", description: "", category: null, slot: null, price: null, draw: null, assets: null }
      ]
    });
    expect(data?.items.map((i) => [i.id, i.kind])).toEqual([["f1", "furniture"]]);
  });

  it("C1: 가구점 상품 셋(팔지 않는 가구)이 옷 부위 목록으로 새지 않는다", () => {
    putCatalog();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wear = require("@/lib/lobby3d/wear") as typeof import("@/lib/lobby3d/wear");
    for (const slot of ["hat", "face", "top", "bottom", "shoes", "accessory", "back"] as const) {
      const ids = wear.itemsInSlot(slot);
      for (const id of SHOP_FILE_ITEMS) expect(ids).not.toContain(id);
    }
  });

  it("C6·D3: 목록이 없거나 셋 중 하나라도 없으면 받기를 시작하지 않고 실패 상태다(오류 없이)", () => {
    const five = putCatalog(SHOP_FILE_ITEMS.slice(0, 2));
    serverHas(five, [0, 1, 2]);
    expect(() => prefetchShopFiles()).not.toThrow();
    expect(shopFilesStatus()).toEqual({ status: "failed" });
    expect(mockDevice.downloads).toEqual([]);
  });
});

describe("[spec] 받기(C2~C4, D1·D2·D4~D6)", () => {
  it("C2: 미리 받기가 상품 셋 파일을 /api/catalog/files/<sha256>.glb 주소로 받아 기기 item-files 폴더에 둔다", async () => {
    const five = putCatalog();
    serverHas(five, [0, 1, 2]);
    prefetchShopFiles();
    await settle();
    expect(downloadedPaths().sort()).toEqual([...five.paths].sort());
    for (const sha of five.sha) expect(mockDevice.files.get(uriOf(sha))).toBe(BYTES);
  });

  it("C3: 기기에 이미 셋 모두 있으면 받기 요청이 0건이고 바로 ready다", () => {
    const five = putCatalog();
    putOnDevice(five, [0, 1, 2]);
    prefetchShopFiles();
    expect(mockDevice.downloads).toEqual([]);
    expect(shopFilesStatus().status).toBe("ready");
  });

  it("C3: 일부만 있으면 없는 것만 받는다", async () => {
    const five = putCatalog();
    putOnDevice(five, [0]);
    serverHas(five, [1, 2]);
    prefetchShopFiles();
    await settle();
    expect(downloadedPaths().sort()).toEqual([five.paths[1], five.paths[2]].sort());
  });

  it("D1·D2: 받는 동안은 loading, 다 받으면 ready이고 상품 셋 순서의 기기 주소가 나온다", async () => {
    const five = putCatalog();
    serverHas(five, [0, 1, 2]);
    expect(shopFilesStatus()).toEqual({ status: "loading" });
    prefetchShopFiles();
    await settle();
    expect(shopFilesStatus()).toEqual({
      status: "ready",
      products: [uriOf(five.sha[0]), uriOf(five.sha[1]), uriOf(five.sha[2])]
    });
  });

  it("D4: 받기가 실패하면(서버 오류·오프라인) 실패 상태가 된다", async () => {
    const five = putCatalog();
    serverHas(five, [0, 1]); // 셋째 상품은 서버가 못 줌
    prefetchShopFiles();
    await settle();
    expect(shopFilesStatus()).toEqual({ status: "failed" });
    void five;
  });

  it("D4: 받은 크기가 목록과 다르면(깨진 파일) 지우고 실패 상태가 된다", async () => {
    const five = putCatalog();
    serverHas(five, [0, 2]);
    mockDevice.replies.set(five.paths[1], { bytes: BYTES - 1 });
    prefetchShopFiles();
    await settle();
    expect(shopFilesStatus()).toEqual({ status: "failed" });
    expect(mockDevice.files.has(uriOf(five.sha[1]))).toBe(false);
  });

  it("D5: 실패한 뒤 다시 들어가기(retry)를 하면 다시 받아 보고, 서버가 돌아왔으면 ready가 된다", async () => {
    const five = putCatalog();
    serverHas(five, [0, 2]);
    prefetchShopFiles();
    await settle();
    expect(shopFilesStatus().status).toBe("failed");
    mockDevice.downloads = [];
    serverHas(five, [1]);
    retryShopFiles();
    await settle();
    expect(downloadedPaths()).toContain(five.paths[1]);
    expect(shopFilesStatus().status).toBe("ready");
  });

  it("D6: 같은 파일을 동시에 두 번 받지 않는다(미리 받기와 다시 받기가 겹쳐도 파일마다 한 번)", async () => {
    const five = putCatalog();
    serverHas(five, [0, 1, 2]);
    prefetchShopFiles();
    prefetchShopFiles();
    retryShopFiles();
    await settle();
    expect(downloadedPaths().sort()).toEqual([...five.paths].sort());
  });

  it("C4: 목록을 새로 받아도(목록 밖 파일 정리) 받아 둔 상품 파일은 지워지지 않고, 목록에서 빠진 옛 파일은 지워진다", async () => {
    const five = putCatalog();
    putOnDevice(five, [0, 1, 2]);
    const oldUri = uriOf(hex(999_999));
    mockDevice.files.set(oldUri, 5);
    mockApi.getItemCatalog = async () => ({
      version: "newer",
      items: five.ids.map((id, i) => ({
        id,
        kind: "furniture",
        name: id,
        shopName: id,
        description: "",
        category: null,
        slot: null,
        price: null,
        draw: null,
        assets: { model: { url: five.paths[i], sha256: five.sha[i], bytes: BYTES }, icon: null }
      }))
    });
    await refreshItemCatalog({ store: false });
    expect(mockDevice.deletes).toEqual([oldUri]);
    for (const sha of five.sha) expect(mockDevice.files.has(uriOf(sha))).toBe(true);
  });
});

describe("[spec] 화면: 마을에 나가면 미리 받기, 들어가기에서 다시 받기(C2·C5·D5)", () => {
  const canvas = () => mockCanvas.props!;
  const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);

  async function frames(seconds: number) {
    const count = Math.round(seconds / 0.05);
    for (let i = 0; i < count; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(50);
        canvas().onFrame(0.05, Date.now());
      });
    }
  }
  async function walkTo(point: FloorPoint, mark: PointerHit["mark"]) {
    await act(async () => {
      canvas().onPointer("down", { point, mark, onCharacter: false }, 100, 100);
    });
    await act(async () => {
      jest.advanceTimersByTime(30);
      canvas().onPointer("up", null, 100, 100);
    });
    await frames(25);
    expect(dist({ x: canvas().sim.x, z: canvas().sim.z }, point)).toBeLessThanOrEqual(0.06);
  }

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
    mockCanvas.props = null;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    const realTiming = Animated.timing;
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("C2: 방에 있는 동안은 받지 않고, 마을에 나가면 상품 셋 파일을 받기 시작한다. 받는 동안에도 마을에서 걸을 수 있다(C5)", async () => {
    const five = putCatalog();
    serverHas(five, [0, 1, 2]);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await frames(1);
    expect(mockDevice.downloads).toEqual([]);
    await walkTo(MARKS.door.approach[0], "door");
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await frames(1.2);
    expect(canvas().area).toBe("village");
    await settle();
    expect(downloadedPaths().sort()).toEqual([...five.paths].sort());
    // 마을 가구점 문 앞까지 걸어갈 수 있다
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
  });

  it("C3: 마을에 나가도 셋이 이미 기기에 있으면 받지 않는다", async () => {
    const five = putCatalog();
    putOnDevice(five, [0, 1, 2]);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await walkTo(MARKS.door.approach[0], "door");
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await frames(1.2);
    await settle();
    expect(mockDevice.downloads).toEqual([]);
  });

  it("C6: 목록이 없는 채(오프라인으로 처음 켠 손님) 마을에 나가도 오류 없이 지나간다", async () => {
    setItemCatalog(parseItemCatalog({ version: "empty", items: [] })!);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await walkTo(MARKS.door.approach[0], "door");
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await frames(1.2);
    expect(canvas().area).toBe("village");
    expect(mockDevice.downloads).toEqual([]);
  });

  it("D5: 받기에 실패한 뒤 가구점 '들어가기'를 다시 누르면 다시 받아 본다", async () => {
    const five = putCatalog();
    serverHas(five, [0, 2]); // 둘째는 처음에 못 받는다
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await walkTo(MARKS.door.approach[0], "door");
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await frames(1.2);
    await settle();
    expect(shopFilesStatus().status).toBe("failed");
    mockDevice.downloads = [];
    serverHas(five, [1]);
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await settle();
    expect(downloadedPaths()).toContain(five.paths[1]);
    expect(shopFilesStatus().status).toBe("ready");
  });
});
