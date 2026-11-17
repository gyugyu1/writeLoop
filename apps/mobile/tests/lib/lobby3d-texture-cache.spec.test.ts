// [spec] qa 테스트(작업 105, 버그 수정, 모바일): 3D 모델 안 그림을 읽을 때마다 캐시 폴더에 새 그림 파일이 쌓이는 문제 — 그림 읽기 쪽.
// 기대값은 명세(private 작업 폴더 105-2026-11-18-3D-그림-캐시-파일/01-main-spec.md)의 "기대 동작 1"과 "그대로여야 할 동작",
// 그리고 그대로 둘 동작은 지금 코드(@react-three/fiber 9.8.2의 native 진입점이 바꿔 두는 THREE.TextureLoader.prototype.load)의 동작에서 가져온다.
// 테스트마다 이름 앞에 [재현]·[그대로]를 붙였다. [재현]은 고치기 전 코드에서 버그 증상으로 실패해야 하고, [그대로]는 고치기 전과 뒤 모두 통과해야 한다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - 앱이 3D 모델을 읽는 모듈(lobby3d-preload, lobby3d-room, lobby3d-furniture, lobby3d-character)을 불러온 뒤의
//   THREE.TextureLoader.prototype.load를 쓴다. 앱이 바꿔 둔 그림 읽기도 이 모듈들을 불러오면 걸려 있다고 가정한다
//   (명세 "고치는 곳": model-file-loader가 FileLoader를 덮어쓰는 방식처럼 r3f가 바꾼 뒤에 앱 쪽에서 덮어쓴다).
// - "GLB 안 그림"은 GLTFLoader가 r3f의 Blob 대체로 만드는 주소 모양(data:image/png;base64,...)으로 TextureLoader.load를 부르는 것으로 본다.
// - 파일 시스템과 expo-crypto는 가짜다(tests/__fixtures__/texture-cache-105.ts). 옛 API와 새 API가 같은 표를 읽고 쓴다.
// - 그림 크기는 react-native의 Image.getSize를 바꿔, 가짜 파일 시스템에 있는 주소면 64x32를 주고 없으면 오류를 준다.
// - "앱을 다시 연다"는 모듈을 새로 읽는 것(jest.resetModules)으로 흉내 낸다. 기기 파일(가짜 표)은 그대로 남는다.
// - 캐시 파일 이름은 명세가 "그림 내용의 SHA-256"이라고만 해서(내용이 바이트인지 base64 글자인지, hex인지 base64인지, 확장자를 어떻게
//   붙이는지 정하지 않았다) 이름 글자를 맞추지 않는다. 대신 "같은 내용이면 같은 파일 하나, 다시 쓰지 않음, 다른 내용이면 다른 파일"과
//   "옛 방식(uuid v4 모양) 이름이 아님"을 본다. SHA-256으로 만든 이름은 uuid v4 모양이 될 수 없다.
// - blob: 주소는 r3f가 XMLHttpRequest·FileReader로 푸는데, 구현이 이를 어떻게 풀지 몰라 여기서는 보지 않는다(보고에 적었다).
/* eslint-disable @typescript-eslint/no-require-imports */
import {
  CACHE,
  LEGACY_UUID_NAME,
  base64Of,
  cacheFiles,
  cacheWrites,
  fsState,
  resetFs
} from "../__fixtures__/texture-cache-105";

jest.mock("expo-file-system/legacy", () => require("../__fixtures__/texture-cache-105").legacyFsModule());
jest.mock("expo-file-system", () => require("../__fixtures__/texture-cache-105").newFsModule());
jest.mock("expo-crypto", () => require("../__fixtures__/texture-cache-105").cryptoModule());

type AssetInfo = { localUri: string | null; uri: string; hash: string; type: string };
const mockAssets: { byInput: Map<unknown, AssetInfo> } = { byInput: new Map() };

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn((input: unknown) => ({
      downloadAsync: async () => {
        const info = mockAssets.byInput.get(input);
        if (!info) throw new Error(`테스트가 정하지 않은 자산: ${String(input)}`);
        return { ...info, downloadAsync: async () => info };
      }
    }))
  }
}));

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(다른 로비 테스트와 같다)
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({ clone: (o: { clone: (r: boolean) => unknown }) => o.clone(true) }));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => ({ RoundedBoxGeometry: class {} }));
jest.mock("@/assets/models/lobby-room.glb", () => 9001);
jest.mock("@/assets/models/writeloop.glb", () => 9002);
jest.mock("@/assets/models/furniture/desk.glb", () => 9011);
jest.mock("@/assets/models/furniture/bookcase.glb", () => 9012);
jest.mock("@/assets/models/furniture/board.glb", () => 9013);
jest.mock("@/assets/models/furniture/window.glb", () => 9014);
jest.mock("@/assets/models/furniture/wardrobe.glb", () => 9015);
jest.mock("@/assets/models/furniture/rug.glb", () => 9016);
jest.mock("@/assets/models/furniture/lamp.glb", () => 9017);
jest.mock("@/assets/models/lobby-village.glb", () => 9004);
jest.mock("@/assets/models/wear-goggles.glb", () => 9005);
jest.mock("@/assets/models/village-flowers.glb", () => 9006);
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => ({ createOutdoor: () => ({}) }));

let THREE: typeof import("three");
let getSizeCalls: string[] = [];

/** 앱을 연다: 모듈을 새로 읽고(기기 파일은 그대로), 3D 모델을 읽는 모듈을 불러온다. 그림 크기 읽기를 가짜로 바꾼다. */
function openApp() {
  jest.resetModules();
  require("@/components/lobby3d/lobby3d-preload");
  require("@/components/lobby3d/lobby3d-room");
  require("@/components/lobby3d/lobby3d-furniture");
  require("@/components/lobby3d/lobby3d-character");
  THREE = require("three") as typeof import("three");
  const RN = require("react-native") as typeof import("react-native");
  getSizeCalls = [];
  jest.spyOn(RN.Image, "getSize").mockImplementation(((uri: string, ok: (w: number, h: number) => void, fail?: (e: unknown) => void) => {
    getSizeCalls.push(uri);
    if (fsState().files.has(uri)) ok(64, 32);
    else fail?.(new Error(`그림 크기를 읽지 못함: ${uri}`));
  }) as never);
}

/** 0..255가 돌아가는 바이트 n개(첫 바이트는 seed) */
function pattern(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (seed + i * 7) & 0xff;
  return out;
}

/** GLB 안 그림을 GLTFLoader가 TextureLoader에 넘기는 주소 모양 */
function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${base64Of(bytes)}`;
}

type TextureLike = {
  image: { data: { localUri: string }; width: number; height: number } | null;
  flipY: boolean;
  isDataTexture?: boolean;
  version: number;
};

type Loaded = { returned: TextureLike; onLoad: jest.Mock; onError: jest.Mock };

/** TextureLoader로 그림 하나를 읽고, onLoad나 onError가 불릴 때까지(또는 오래 걸리면) 기다린다 */
async function loadTexture(url: unknown, path?: string): Promise<Loaded> {
  const onLoad = jest.fn();
  const onError = jest.fn();
  const loader = new THREE.TextureLoader();
  if (path) loader.setPath(path);
  const returned = loader.load(url as string, onLoad, undefined, onError) as unknown as TextureLike;
  for (let i = 0; i < 500 && onLoad.mock.calls.length + onError.mock.calls.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { returned, onLoad, onError };
}

function localUriOf(loaded: Loaded): string {
  expect(loaded.onError).not.toHaveBeenCalled();
  expect(loaded.onLoad).toHaveBeenCalledTimes(1);
  return (loaded.onLoad.mock.calls[0][0] as TextureLike).image!.data.localUri;
}

function fileName(uri: string): string {
  return uri.split("/").pop() ?? "";
}

beforeEach(() => {
  resetFs();
  mockAssets.byInput.clear();
  openApp();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("[spec] GLB 안 그림(data:)은 내용으로 정해지는 이름 하나로 캐시에 둔다(105 명세 기대 동작 1)", () => {
  test("[재현] 같은 그림을 두 번 차례로 읽으면 캐시의 그림 파일은 하나이고, 두 텍스처가 같은 파일을 쓰며, 두 번째 읽기는 다시 쓰지 않는다", async () => {
    const image = pattern(300, 3);
    const url = dataUrl("image/png", image);

    const first = await loadTexture(url);
    const firstUri = localUriOf(first);
    const writesAfterFirst = cacheWrites().length;
    const second = await loadTexture(url);
    const secondUri = localUriOf(second);

    expect(cacheFiles()).toEqual([firstUri]);
    expect(secondUri).toBe(firstUri);
    expect(cacheWrites().length).toBe(writesAfterFirst);
    expect(Array.from(fsState().files.get(firstUri)!)).toEqual(Array.from(image));
  });

  test("[재현] 앱을 다시 열어 같은 그림을 읽어도 캐시의 그림 파일이 늘지 않고, 이미 있는 그 파일을 다시 쓰지 않고 쓴다", async () => {
    const image = pattern(500, 11);
    const url = dataUrl("image/jpeg", image);

    const firstUri = localUriOf(await loadTexture(url));
    const filesBefore = cacheFiles();
    const writesBefore = cacheWrites().length;

    openApp();
    const againUri = localUriOf(await loadTexture(url));
    openApp();
    const thirdUri = localUriOf(await loadTexture(url));

    expect(filesBefore).toEqual([firstUri]);
    expect(cacheFiles()).toEqual([firstUri]);
    expect(againUri).toBe(firstUri);
    expect(thirdUri).toBe(firstUri);
    expect(cacheWrites().length).toBe(writesBefore);
  });

  test("[재현] 같은 그림을 동시에 세 번 읽어도 끝난 뒤 캐시의 그림 파일은 하나이고, 세 텍스처가 같은 파일을 쓴다", async () => {
    const image = pattern(400, 5);
    const url = dataUrl("image/png", image);

    const loads = await Promise.all([loadTexture(url), loadTexture(url), loadTexture(url)]);
    const uris = loads.map(localUriOf);

    expect(cacheFiles()).toEqual([uris[0]]);
    expect(uris).toEqual([uris[0], uris[0], uris[0]]);
    expect(Array.from(fsState().files.get(uris[0])!)).toEqual(Array.from(image));
  });

  test("[재현] 새로 둔 캐시 그림 파일의 이름은 옛 방식(uuid v4 모양) 이름이 아니다(내용의 SHA-256으로 정한 이름)", async () => {
    const png = localUriOf(await loadTexture(dataUrl("image/png", pattern(200, 1))));
    const jpeg = localUriOf(await loadTexture(dataUrl("image/jpeg", pattern(200, 2))));

    expect(png.startsWith(CACHE)).toBe(true);
    expect(jpeg.startsWith(CACHE)).toBe(true);
    expect(fileName(png)).not.toMatch(LEGACY_UUID_NAME);
    expect(fileName(jpeg)).not.toMatch(LEGACY_UUID_NAME);
  });

  test("[그대로] 내용이 다른 두 그림은 서로 다른 파일 둘이 되고, 각 파일에는 그 그림의 바이트가 그대로 들어 있다", async () => {
    const a = pattern(256, 20);
    const b = pattern(256, 21);

    const aUri = localUriOf(await loadTexture(dataUrl("image/png", a)));
    const bUri = localUriOf(await loadTexture(dataUrl("image/png", b)));

    expect(aUri).not.toBe(bUri);
    expect(cacheFiles()).toEqual([aUri, bUri].sort());
    expect(Array.from(fsState().files.get(aUri)!)).toEqual(Array.from(a));
    expect(Array.from(fsState().files.get(bUri)!)).toEqual(Array.from(b));
  });

  test("[그대로] data: 그림의 텍스처 모양: 부를 때 돌려준 텍스처를 onLoad로 주고, 캐시 파일 위치와 크기, flipY, 데이터 텍스처 표시가 전과 같다", async () => {
    const image = pattern(128, 9);
    const loaded = await loadTexture(dataUrl("image/png", image));
    const uri = localUriOf(loaded);

    const texture = loaded.onLoad.mock.calls[0][0] as TextureLike;
    expect(texture).toBe(loaded.returned);
    expect(texture.image).toEqual({ data: { localUri: uri }, width: 64, height: 32 });
    expect(texture.flipY).toBe(true);
    expect(texture.isDataTexture).toBe(true);
    expect(texture.version).toBeGreaterThan(0);
    expect(uri.startsWith(CACHE)).toBe(true);
    expect(getSizeCalls).toContain(uri);
  });

  test("[그대로] data: 그림의 크기를 읽지 못하면 onError가 한 번 불리고 onLoad는 불리지 않는다", async () => {
    const RN = require("react-native") as typeof import("react-native");
    const failure = new Error("그림 크기 실패");
    (RN.Image.getSize as unknown as jest.Mock).mockImplementation(((_uri: string, _ok: unknown, fail?: (e: unknown) => void) => {
      fail?.(failure);
    }) as never);

    const loaded = await loadTexture(dataUrl("image/png", pattern(64, 4)));

    expect(loaded.onError).toHaveBeenCalledTimes(1);
    expect(loaded.onError.mock.calls[0][0]).toBe(failure);
    expect(loaded.onLoad).not.toHaveBeenCalled();
  });
});

describe("[spec] data:·blob:가 아닌 그림 주소는 r3f의 방법을 그대로 쓴다(105 명세 고치는 곳, 그대로여야 할 동작)", () => {
  test("[그대로] 번들 그림(require 번호)은 expo-asset이 준 위치를 그대로 쓰고 캐시에 쓰지 않는다", async () => {
    fsState().files.set("file:///bundle/grass.png", pattern(16, 3));
    mockAssets.byInput.set(7001, { localUri: "file:///bundle/grass.png", uri: "http://localhost:8081/assets/grass.png", hash: "aa11", type: "png" });

    const loaded = await loadTexture(7001);

    expect(localUriOf(loaded)).toBe("file:///bundle/grass.png");
    expect(cacheWrites()).toEqual([]);
    expect(cacheFiles()).toEqual([]);
  });

  test("[그대로] 안드로이드 출시 빌드의 번들 그림(위치에 ':'가 없음)은 캐시의 ExponentAsset-<해시>.<확장자>로 꺼내 쓴다", async () => {
    fsState().files.set("asset_village_grass", pattern(32, 7));
    mockAssets.byInput.set(7002, { localUri: null, uri: "asset_village_grass", hash: "bb22", type: "png" });

    const loaded = await loadTexture(7002);

    expect(localUriOf(loaded)).toBe(`${CACHE}ExponentAsset-bb22.png`);
    expect(cacheFiles()).toEqual([`${CACHE}ExponentAsset-bb22.png`]);
    expect(Array.from(fsState().files.get(`${CACHE}ExponentAsset-bb22.png`)!)).toEqual(Array.from(pattern(32, 7)));
  });

  test("[그대로] file: 주소는 그 위치를 그대로 쓰고 캐시에 쓰지 않는다. setPath를 주면 앞에 붙인다", async () => {
    fsState().files.set("file:///tex/wood.png", pattern(16, 1));
    fsState().files.set("file:///tex/stone.png", pattern(16, 2));

    const direct = await loadTexture("file:///tex/wood.png");
    const withPath = await loadTexture("stone.png", "file:///tex/");

    expect(localUriOf(direct)).toBe("file:///tex/wood.png");
    expect(localUriOf(withPath)).toBe("file:///tex/stone.png");
    expect(cacheWrites()).toEqual([]);
  });

  test("[그대로] 외부 주소는 expo-asset이 받아 준 위치를 쓴다", async () => {
    const url = "https://cdn.example.com/tex/sky.png";
    fsState().files.set("file:///downloaded/sky.png", pattern(16, 4));
    mockAssets.byInput.set(url, { localUri: "file:///downloaded/sky.png", uri: url, hash: "cc33", type: "png" });

    const loaded = await loadTexture(url);

    expect(localUriOf(loaded)).toBe("file:///downloaded/sky.png");
    expect(cacheWrites()).toEqual([]);
  });

  test("[그대로] 번들 그림의 위치를 얻지 못하면 onError가 한 번 불리고 onLoad는 불리지 않는다", async () => {
    const loaded = await loadTexture(7999);

    expect(loaded.onError).toHaveBeenCalledTimes(1);
    expect(loaded.onLoad).not.toHaveBeenCalled();
  });
});
