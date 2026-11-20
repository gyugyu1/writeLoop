// [spec] qa 테스트(작업 130 가구점 새 매장·명패, 09 결정으로 구현 뒤에 더함, 모바일): 명세 3-4 교체 실패.
// 기대값은 private 작업 폴더 130-2026-11-20-가구점-새-매장-명패/01-main-spec.md 3-3·3-4·3-5에서만 가져온다.
//  - 새 상품을 받는 동안·읽는 동안에는 이전 상품과 명패가 그대로 보이고 안내도 진열 되돌림도 없다.
//  - 교체 실패(새 상품이 목록에 없음, 받기 실패, 읽기 실패, 크기 검사 실패): 그 슬롯의 이전 상품과 명패를 그대로 두고,
//    진열 상태도 이전 상품으로 되돌리며, 안내 "이 상품은 지금 진열할 수 없어요"를 띄운다.
//  - 처음 진열 상품을 못 받는 것은 교체 실패가 아니다(진열 상태는 처음 그대로, 안내 없음. 129와 같다).
// 구현에서 읽은 것은 부르는 방법뿐이다: ShopModel(products·daylight·kit·outline·pickTargets), 상품마다 {model, nameplate}(주소 | "loading" | "missing"),
// onShopSwapFailed(알림 받기)·SHOP_SWAP_FAILED(안내 글)·setShopDisplay·shopDisplay.
// 3D 그리기 본체(ShopModel)는 3D 라이브러리(react-three-fiber)를 가짜로 바꿔 렌더하고, 상품·명패 파일 읽기(GLTFLoader·TextureLoader의 loadAsync)는 가짜 답으로 바꾼다.
// 안내가 화면에 뜨는 것은 로비 화면(Lobby3dScreen)에서 알림을 보내 확인한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { readFileSync } from "fs";
import { join } from "path";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import type { ShopProductId } from "@/lib/lobby3d/shop";

const mockGltf: { interior: GLTF | null; keeper: GLTF | null } = { interior: null, keeper: null };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "three.module.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "loaders", "GLTFLoader.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "SkeletonUtils.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({
  useFrame: () => {},
  useLoader: Object.assign((_loader: unknown, url: string) => (url === "interior.glb" ? mockGltf.interior : mockGltf.keeper), { clear: () => {} }),
  useThree: () => ({ scene: {} })
}));
jest.mock("../../assets/models/shop/furniture-shop-interior.glb", () => "interior.glb");
jest.mock("../../assets/models/shop/beodeul.glb", () => "beodeul.glb");
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require("three") as typeof import("three");
  return { OUTLINE_THICKNESS: 0.012, characterOutlineMaterial: () => new three.MeshBasicMaterial({ side: three.BackSide }) };
});
// 로비 화면(안내 확인용): 3D 그리기는 가짜
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Redirect: (props: object) => React.createElement("Redirect", props) };
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
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));

/* eslint-disable @typescript-eslint/no-require-imports */
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js") as typeof import("three/examples/jsm/loaders/GLTFLoader.js");
const { ShopModel } = require("@/components/lobby3d/lobby3d-shop") as typeof import("@/components/lobby3d/lobby3d-shop");
const Lobby3dScreen = (require("@/components/lobby3d/lobby3d-screen") as typeof import("@/components/lobby3d/lobby3d-screen")).default;
const shop = require("@/lib/lobby3d/shop") as typeof import("@/lib/lobby3d/shop");
/* eslint-enable @typescript-eslint/no-require-imports */

const APP_MODELS = join(__dirname, "../../assets/models/shop");
const SERVER_FILES = join(__dirname, "../../../backend/src/main/resources/catalog/files");
const IDS: ShopProductId[] = ["rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"];
const FILES: Record<ShopProductId, string> = {
  rainbootPlanter: "rainboot-planter.glb",
  catPostDesk: "cat-post-desk.glb",
  stargazerBed: "stargazer-bed.glb",
  walnutBed: "walnut-bed.glb",
  grandmasFloorBedding: "grandmas-floor-bedding.glb",
  cloudDesk: "cloud-desk.glb"
} as never;

function withoutImages(data: Buffer): ArrayBuffer {
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.toString("utf8", 20, 20 + jsonLength)) as {
    images?: unknown;
    textures?: unknown;
    samplers?: unknown;
    materials?: { pbrMetallicRoughness?: Record<string, unknown>; normalTexture?: unknown; emissiveTexture?: unknown; occlusionTexture?: unknown }[];
  };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.emissiveTexture;
    delete m.occlusionTexture;
  }
  let text = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const bin = data.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + bin.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([header, text, bin]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function load(dir: string, file: string): Promise<GLTF> {
  return new GLTFLoader().parseAsync(withoutImages(readFileSync(join(dir, file))), "");
}

function boxProduct(w: number, d: number, h: number): GLTF {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(0, h / 2, 0);
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x888888 })));
  return { scene } as unknown as GLTF;
}

const loaded: Record<string, GLTF> = {};
beforeAll(async () => {
  mockGltf.interior = await load(APP_MODELS, "furniture-shop-interior.glb");
  mockGltf.keeper = await load(APP_MODELS, "beodeul.glb");
  for (const id of IDS) loaded[id] = await load(SERVER_FILES, FILES[id]);
}, 90000);

/** 주소 → 읽은 결과의 가짜 표(없으면 읽기 실패). 테스트마다 다른 주소를 쓴다(앱이 주소마다 읽기 결과를 기억하므로). */
const replies = new Map<string, GLTF | "fail">();
let run = 0;

beforeEach(() => {
  run += 1;
  replies.clear();
  jest.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async (url: string) => {
    const reply = replies.get(url);
    if (!reply || reply === "fail") throw new Error(`읽지 못함(테스트 가짜): ${url}`);
    return reply;
  });
  jest.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(async () => new THREE.Texture());
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  shop.resetShopDisplay();
  jest.restoreAllMocks();
});

type FileState = { model: string; nameplate: string };
type FileMap = Record<ShopProductId, FileState>;

const uriOf = (id: ShopProductId) => `file:///run${run}/${id}.glb`;
const plateOf = (id: ShopProductId) => `file:///run${run}/${id}.png`;

/** 상품마다 기기 주소(받음)로 채운 파일 표. override로 상품 하나의 상태를 바꾼다. */
function fileMap(override: Partial<Record<ShopProductId, Partial<FileState>>> = {}): FileMap {
  const out = {} as FileMap;
  for (const id of IDS) {
    out[id] = { model: uriOf(id), nameplate: plateOf(id), ...(override[id] ?? {}) };
    if (out[id].model.startsWith("file:") && !replies.has(out[id].model)) replies.set(out[id].model, loaded[id]);
  }
  return out;
}

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });
const daylight = { ambience: { ambientColor: 0xffffff, ambientIntensity: 1, sunColor: 0xffffff, sunIntensity: 1 } } as never;

const lastPick = { current: [] as THREE.Object3D[] };

async function renderShop(files: FileMap) {
  const k = kit();
  const pickTargets = lastPick;
  pickTargets.current = [];
  const view = await render(<ShopModel products={files} daylight={daylight} kit={k} outline={1} pickTargets={pickTargets} />);
  const again = async (next: FileMap) => view.rerender(<ShopModel products={next} daylight={daylight} kit={k} outline={1} pickTargets={pickTargets} />);
  return { view, again };
}

async function settle() {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** 가구점 장면의 뿌리: 누르기 대상(ShopModel이 pickTargets에 채운 물체)의 조상을 따라 올라가 찾는다. */
function shopRoot(): THREE.Object3D {
  for (let n: THREE.Object3D | null = lastPick.current[0] ?? null; n; n = n.parent) if (n.name === "shop-root") return n;
  throw new Error("가구점 장면이 그려지지 않았습니다");
}
const slotItem = (slot: number) => shopRoot().getObjectByName(`DisplaySlot_0${slot + 1}`)!.children.find((c) => c.name.startsWith("shop-display-")) ?? null;
const holder = (slot: number) => shopRoot().getObjectByName(`Station_0${slot + 1}_Nameplate`)!;
const glyph = (slot: number) => shopRoot().getObjectByName(`Station_0${slot + 1}_Nameplate_Default`)!;
function shown(o: THREE.Object3D | null | undefined): boolean {
  for (let n = o ?? null; n; n = n.parent) if (!n.visible) return false;
  return Boolean(o);
}
function imageShown(slot: number): boolean {
  let any = false;
  const g = glyph(slot);
  holder(slot).traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o === g || g.getObjectById(o.id)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((m) => (m as THREE.MeshBasicMaterial).map) && shown(mesh)) any = true;
  });
  return any;
}

let failures: number[];
let unsubscribe: () => void;
beforeEach(() => {
  failures = [];
  unsubscribe = shop.onShopSwapFailed((slot) => failures.push(slot));
});
afterEach(() => unsubscribe());

describe("[spec] 진열 처음 붙이기(129 그대로, 130 여섯)", () => {
  it("W0: 여섯 상품과 명패 그림을 읽으면 여섯 슬롯에 붙고, 진열 되돌림·안내는 없다", async () => {
    await renderShop(fileMap());
    await settle();
    for (let i = 0; i < 6; i += 1) expect({ i, item: slotItem(i) !== null }).toEqual({ i, item: true });
    expect(failures).toEqual([]);
    expect([...shop.shopDisplay()]).toEqual(IDS);
  });

  it("W1: 처음 진열 상품을 못 받아도(목록에 없음) 교체 실패가 아니다: 그 슬롯만 비고 진열 상태는 처음 그대로이며 안내가 없다", async () => {
    await renderShop(fileMap({ catPostDesk: { model: "missing" } }));
    await settle();
    expect(slotItem(1)).toBeNull();
    expect(shown(holder(1))).toBe(false);
    for (const i of [0, 2, 3, 4, 5]) expect(slotItem(i)).not.toBeNull();
    expect(failures).toEqual([]);
    expect([...shop.shopDisplay()]).toEqual(IDS);
  });
});

describe("[spec] 교체 실패 → 이전 상품·명패 유지, 진열 상태 되돌림, 안내(3-4)", () => {
  async function swapToFailing(files: FileMap, after?: () => void) {
    await renderShop(files);
    await settle();
    const before = slotItem(0);
    expect(before).not.toBeNull();
    expect(shown(holder(0))).toBe(true);
    const plateBefore = imageShown(0);
    await act(async () => {
      shop.setShopDisplay(0, "catPostDesk");
    });
    after?.();
    await settle();
    return { before, plateBefore };
  }

  const expectKept = (before: THREE.Object3D | null, plateBefore: boolean) => {
    expect(slotItem(0)).toBe(before);
    expect(shown(holder(0))).toBe(true);
    expect(imageShown(0)).toBe(plateBefore);
    expect(glyph(0).visible).toBe(false);
    expect(shop.shopDisplay()[0]).toBe("rainbootPlanter");
    expect(failures).toEqual([0]);
  };

  it("F1: 새 상품이 목록에 없으면(missing) 이전 상품과 명패를 그대로 두고 진열 상태를 되돌리고 안내를 한 번 보낸다", async () => {
    const { before, plateBefore } = await swapToFailing(fileMap({ catPostDesk: { model: "missing" } }));
    expect(plateBefore).toBe(true);
    expectKept(before, plateBefore);
  });

  it("F3: 새 상품을 읽지 못하면(받은 파일이 깨짐) 이전 상품·명패 유지, 진열 되돌림, 안내", async () => {
    const files = fileMap();
    replies.set(files.catPostDesk.model, "fail");
    const { before, plateBefore } = await swapToFailing(files);
    expectKept(before, plateBefore);
  });

  it("F5: 크기 검사에 걸리면(반지름 1.79 밖) 이전 상품·명패 유지, 진열 되돌림, 안내. 줄여 붙이지 않는다", async () => {
    const files = fileMap();
    replies.set(files.catPostDesk.model, boxProduct(8, 8, 1));
    const { before, plateBefore } = await swapToFailing(files);
    expectKept(before, plateBefore);
    expect(slotItem(0)!.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("F6: 높이가 2.55를 넘으면 이전 상품·명패 유지, 진열 되돌림, 안내", async () => {
    const files = fileMap();
    replies.set(files.catPostDesk.model, boxProduct(1, 1, 3));
    const { before, plateBefore } = await swapToFailing(files);
    expectKept(before, plateBefore);
  });

  it("F7: 되돌린 진열 상태는 진열대 말풍선 이름과 맞는다(장화 화분이야.)", async () => {
    await swapToFailing(fileMap({ catPostDesk: { model: "missing" } }));
    expect(shop.shopDisplay().map((id) => shop.shopProduct(id).name)[0]).toBe("장화 화분");
  });

  it("F8: 실패한 슬롯만 되돌리고 다른 슬롯의 진열·상품은 건드리지 않는다", async () => {
    await renderShop(fileMap({ catPostDesk: { model: "missing" } }));
    await settle();
    const others = [2, 3, 4, 5].map((i) => slotItem(i));
    await act(async () => {
      shop.setShopDisplay(0, "catPostDesk");
      shop.setShopDisplay(2, "cloudDesk");
    });
    await settle();
    expect(shop.shopDisplay()[0]).toBe("rainbootPlanter");
    expect(shop.shopDisplay()[2]).toBe("cloudDesk");
    expect(failures).toEqual([0]);
    expect(slotItem(2)).not.toBe(others[0]);
    [3, 4, 5].forEach((i, k) => expect(slotItem(i)).toBe(others[k + 1]));
  });
});

describe("[spec] 교체 기다리기와 성공(3-3)", () => {
  it("W2: 새 상품을 받는 중(loading)이면 이전 상품·명패가 그대로 보이고 안내·되돌림이 없다. 다 받으면 상품과 명패가 함께 바뀐다", async () => {
    const files = fileMap({ cloudDesk: { model: "loading", nameplate: "loading" } });
    const { again } = await renderShop(files);
    await settle();
    // 슬롯 6(구름 책상)은 아직 비어 있다. 슬롯 1(장화 화분)을 구름 책상으로 바꾼다
    const before = slotItem(0);
    expect(slotItem(5)).toBeNull();
    await act(async () => {
      shop.setShopDisplay(0, "cloudDesk");
    });
    await settle();
    expect(slotItem(0)).toBe(before);
    expect(shown(holder(0))).toBe(true);
    expect(imageShown(0)).toBe(true);
    expect(failures).toEqual([]);
    expect(shop.shopDisplay()[0]).toBe("cloudDesk");
    // 구름 책상 모델과 명패 그림이 들어온다
    await act(async () => {
      await again(fileMap());
    });
    await settle();
    expect(slotItem(0)).not.toBe(before);
    expect(slotItem(0)!.parent!.name).toBe("DisplaySlot_01");
    expect(failures).toEqual([]);
    expect(shop.shopDisplay()[0]).toBe("cloudDesk");
    // 01의 새겨진 글자(달토끼 화분)와 이름이 다르니 그림을 쓴다
    expect(glyph(0).visible).toBe(false);
    expect(imageShown(0)).toBe(true);
  });

  it("W3: 받는 중이다가 받기에 실패(missing)하면 그때 교체 실패로 처리한다: 이전 상품·명패 유지, 진열 되돌림, 안내 한 번", async () => {
    const files = fileMap({ cloudDesk: { model: "loading", nameplate: "loading" } });
    const { again } = await renderShop(files);
    await settle();
    const before = slotItem(0);
    await act(async () => {
      shop.setShopDisplay(0, "cloudDesk");
    });
    await settle();
    expect(failures).toEqual([]);
    await act(async () => {
      await again(fileMap({ cloudDesk: { model: "missing", nameplate: "missing" } }));
    });
    await settle();
    expect(slotItem(0)).toBe(before);
    expect(shown(holder(0))).toBe(true);
    expect(shop.shopDisplay()[0]).toBe("rainbootPlanter");
    expect(failures).toEqual([0]);
  });

  it("W4: 성공한 교체(받은 상품이 크기 검사를 통과)는 안내도 되돌림도 없다", async () => {
    await renderShop(fileMap());
    await settle();
    const before = slotItem(0);
    await act(async () => {
      shop.setShopDisplay(0, "cloudDesk");
    });
    await settle();
    expect(slotItem(0)).not.toBe(before);
    expect(failures).toEqual([]);
    expect(shop.shopDisplay()[0]).toBe("cloudDesk");
    expect(shown(holder(0))).toBe(true);
  });
});

describe("[spec] 안내 글(3-4)", () => {
  it("N1: 교체 실패 알림이 오면 로비 화면에 '이 상품은 지금 진열할 수 없어요'가 뜬다", async () => {
    await AsyncStorage.clear();
    const Screen = Lobby3dScreen;
    await render(<Screen devPanel={false} />);
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(screen.queryAllByText("이 상품은 지금 진열할 수 없어요", { includeHiddenElements: true })).toHaveLength(0);
    await act(async () => {
      shop.notifyShopSwapFailed(0);
    });
    expect(screen.queryAllByText("이 상품은 지금 진열할 수 없어요", { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(shop.SHOP_SWAP_FAILED).toBe("이 상품은 지금 진열할 수 없어요");
  });
});
