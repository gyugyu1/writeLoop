// [spec] qa 테스트(작업 129 가구점 상품 없이 입장, 기능 변경, 모바일): 01-main-spec.md 명세 4(다시 받기)와 "그대로여야 할 동작"을 본다.
// 기대값은 private 작업 폴더 129-2026-11-20-가구점-상품-없이-입장/01-main-spec.md에서만 가져온다.
// 기기 파일은 expo-file-system 가짜(주소 → 크기 표, 받기는 테스트가 답을 정한다)로, 3D 그리기는 가짜로 대신한다.
// 진열 상품이 없어도 3D가 밝아지는지(명세 1·3)는 ShopLayer가 Jest에서 돌지 않아 여기서 볼 수 없다(보고에 적음). 화면 흐름은 가짜 3D가 onShopReady를 부른 것으로 본다.
// 받기 상태는 shopFilesStatus 같은 판정 함수가 아니라 실제 받기 요청(mockDevice.downloads)과 기기 파일로만 본다(판정 방식이 바뀌어도 이 테스트는 유효하다).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { SHOP_FILE_ITEMS } from "@/lib/lobby3d/shop-files";
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
jest.mock("@/lib/api", () => ({ getItemCatalog: () => Promise.reject(new Error("offline")) }));
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

/** 테스트마다 다른 해시를 쓴다(item-files가 받은 파일을 모듈 안에 기억하므로 테스트끼리 섞이지 않게). 다른 파일과 겹치지 않게 큰 수에서 시작한다. */
let seed = 5000;
const hex = (n: number) => n.toString(16).padStart(64, "0");
const BYTES = 1000;

interface Products {
  ids: string[];
  sha: string[];
  paths: string[];
}

/** 진열 상품 셋(팔지 않는 가구)이 든 목록을 넣는다. */
function putCatalog(): Products {
  seed += 1;
  const ids = [...SHOP_FILE_ITEMS];
  const sha = ids.map((_, i) => hex(seed * 100 + i + 1));
  const paths = sha.map((s) => `/api/catalog/files/${s}.glb`);
  const items = ids.map((id, i) => ({
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
  }));
  setItemCatalog(parseItemCatalog({ version: `v${seed}`, items })!);
  return { ids, sha, paths };
}

const uriOf = (sha: string) => `file:///qa-document/item-files/${sha}.glb`;
const putOnDevice = (p: Products, indexes: number[]) => indexes.forEach((i) => mockDevice.files.set(uriOf(p.sha[i]), BYTES));
const serverHas = (p: Products, indexes: number[]) => indexes.forEach((i) => mockDevice.replies.set(p.paths[i], { bytes: BYTES }));
const downloadedPaths = () => mockDevice.downloads.map((url) => url.slice(url.indexOf("/api/")));

async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const canvas = () => mockCanvas.props!;
const area = () => canvas().area ?? "room";
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};
const ALL = { includeHiddenElements: true } as const;

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
async function goToShopExit() {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark: "shopExit", onCharacter: false }, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
  await frames(25);
}
/** 방 → 마을. */
async function goOut() {
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  await settle();
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  mockDevice.files.clear();
  mockDevice.dirs.clear();
  mockDevice.downloads = [];
  mockDevice.deletes = [];
  mockDevice.replies.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
});
afterEach(() => {
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("[spec] 다시 받기(명세 4)", () => {
  it("R1(바뀔 동작): 마을에서 받기에 실패한 상품은, 방에 들어갔다 다시 마을에 나갈 때 실패 기록을 지우고 다시 받아 본다", async () => {
    const p = putCatalog();
    serverHas(p, [0, 2]); // 둘째 상품은 서버가 처음엔 못 준다
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await goOut();
    expect(downloadedPaths()).toContain(p.paths[1]);
    // 서버가 돌아왔고, 집(방)으로 들어갔다가 다시 마을에 나간다
    mockDevice.downloads = [];
    serverHas(p, [1]);
    await walkTo(VILLAGE_PLACES.home.approach[0], "home");
    await press("들어가기");
    await frames(1.2);
    expect(area()).toBe("room");
    await goOut();
    expect(downloadedPaths()).toEqual([p.paths[1]]);
    expect(mockDevice.files.get(uriOf(p.sha[1]))).toBe(BYTES);
  });

  it("R2(바뀔 동작): 가구점 안에서 받기에 실패한 상품은, 출입문 '나가기'로 마을에 나올 때 다시 받아 본다", async () => {
    const p = putCatalog();
    serverHas(p, [0, 2]);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await goOut();
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
    await press("들어가기");
    await frames(1.2);
    await settle();
    expect(area()).toBe("shop");
    // 서버는 아직 못 준다: 들어갈 때 다시 받아 봤지만 또 실패했다
    expect(downloadedPaths()).toContain(p.paths[1]);
    mockDevice.downloads = [];
    serverHas(p, [1]);
    await goToShopExit();
    await press("나가기");
    await frames(1.2);
    expect(area()).toBe("village");
    await settle();
    expect(downloadedPaths()).toEqual([p.paths[1]]);
    expect(mockDevice.files.get(uriOf(p.sha[1]))).toBe(BYTES);
  });

  it("R3(그대로 둘 동작): 마을에서 받기에 실패한 상품은 가구점 '들어가기'를 누르면 다시 받아 본다", async () => {
    const p = putCatalog();
    serverHas(p, [0, 2]);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await goOut();
    mockDevice.downloads = [];
    serverHas(p, [1]);
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
    await press("들어가기");
    await settle();
    expect(downloadedPaths()).toEqual([p.paths[1]]);
    expect(mockDevice.files.get(uriOf(p.sha[1]))).toBe(BYTES);
  });

  it("R4(그대로 둘 동작): 이미 기기에 있는 상품은 다시 받지 않는다(마을에 나갈 때·들어가기를 눌러도 없는 것만 한 번씩)", async () => {
    const p = putCatalog();
    putOnDevice(p, [0, 2]);
    serverHas(p, [1]);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await goOut();
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
    await press("들어가기");
    await settle();
    expect(downloadedPaths()).toEqual([p.paths[1]]);
  });
});

describe("[spec] 상품 파일이 없어도 입장(명세 3)", () => {
  it("E1(그대로 둘 동작): 서버 목록에 진열 상품이 하나도 없어도 '들어가기'로 가구점에 들어가고, 마을 문 앞으로 되돌아오지 않으며 안내 문구도 없다. 받기 요청은 없다", async () => {
    setItemCatalog(parseItemCatalog({ version: "empty-129", items: [] })!);
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await goOut();
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
    await press("들어가기");
    await frames(1.2);
    await settle();
    expect(area()).toBe("shop");
    expect(screen.queryAllByText("가구점을 불러오지 못했어요", ALL)).toHaveLength(0);
    expect(mockDevice.downloads).toEqual([]);
  });

  it("E2(그대로 둘 동작): 상품 받기가 실패해도 가구점에 들어가지고 안내가 없다. 받은 상품은 기기에 남는다", async () => {
    const p = putCatalog();
    serverHas(p, [0]); // 둘·셋째는 못 받음
    await render(<Lobby3dScreen devPanel={false} />);
    await settle();
    await goOut();
    await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
    await press("들어가기");
    await frames(1.2);
    await settle();
    expect(area()).toBe("shop");
    expect(screen.queryAllByText("가구점을 불러오지 못했어요", ALL)).toHaveLength(0);
    expect(mockDevice.files.get(uriOf(p.sha[0]))).toBe(BYTES);
  });
});
