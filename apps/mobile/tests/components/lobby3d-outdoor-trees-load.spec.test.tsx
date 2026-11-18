// [spec] qa 테스트(작업 113 → 116에서 A·Pine 기준으로 고침, 기능 변경, 모바일) — 새 나무 모델 불러오기의 방(창밖) 쪽.
// 기대값은 명세(private 작업 폴더 113-2026-11-18-새-나무-모델-넣기/01-main-spec.md)에서만 가져온다.
// 모든 테스트가 "바뀔 동작"이다(고치기 전에는 실패해야 한다). 03-qa-tests.md의 분류와 같다.
//
// 명세 바뀌는 동작:
//  11. (116: A·Pine GLB 4개, 로드 순서 A LOD1, A LOD2, Pine LOD1, Pine LOD2) 새 나무 GLB 4개를 앱 자산(apps/mobile/assets/models/ 아래)에 넣는다. 앱이 시작할 때 미리 읽기(lobby3d-preload.ts)에 더한다
//      (104의 같은 키로 미리 읽기 규칙). 마을과 방(창밖)에서 함께 쓴다.
//   7. 창밖 나무는 새 모델 LOD2로 그린다.
//  12. 나무 모델을 읽지 못하면 나무만 빼고 그리고, 화면이 멈추지 않게 한다(마을의 땅 꾸밈을 읽지 못할 때처럼). 오류는 개발 콘솔에 남긴다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 가정은 03-qa-tests.md에 적었다):
// - 나무 파일은 메인 세션이 알려 준 자리 apps/mobile/assets/models/trees/WriteLoop_Tree_{A,Pine}_LOD{1,2}.glb다. 아직 저장소에 없어서
//   상대 경로의 가상 가짜(virtual)로 이름 문자열을 준다(파일이 생기면 같은 파일을 부르는 모든 require에 이 가짜가 쓰인다).
// - "미리 읽기"는 lobby3d-preload의 preloadLobbyModels()를 부르는 것, "모델을 읽는다"는 GLTFLoader의 load가 그 파일로 불리는 것으로 본다.
//   읽기를 끝내는 때(성공·실패)는 테스트가 정한다. react-three-fiber는 진짜(useLoader와 그 캐시)를 쓴다(078 qa 테스트와 같은 방식).
// - "방(창밖)"은 가구 묶음(lobby3d-furniture의 BakedFurniture)을 지금 3D 화면처럼 오류 경계 > Suspense > 가구 묶음으로 그리는 것으로 본다.
//   창밖 장면(createOutdoor)은 가구 묶음이 짓는다. 그래서 가구 묶음을 그리면 창밖 나무 모델 읽기까지 이뤄진다고 가정했다.
// - 창밖 장면 모듈(lobby3d-outdoor)은 받은 것을 모두 적어 두는 가짜다. createOutdoor의 인자, 돌려준 창밖 장면의 어떤 메서드의 인자,
//   이 모듈의 다른 어떤 함수의 인자로든 LOD2 나무 모델(또는 그 장면·메시·모양·재질·그림)이 넘어오면 "창밖이 그 모델을 받았다"로 본다
//   (구현이 나무를 넘기는 방법을 모르므로 넓게 본다).
// - "가구 묶음이 그려졌다"는 코드로 지은 대체 가구(fallback)가 숨는 것(visible false)이다(078 qa 테스트와 같다).
// - "개발 콘솔에 남긴다"는 console.warn이 불린 것으로 본다(이 앱의 오류 경계들이 쓰는 방법). React가 잡은 오류를 스스로 출력하는
//   console.error는 셈하지 않는다.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { MutableRefObject } from "react";

const TREE_FILES = [
  "trees/WriteLoop_Tree_A_LOD1.glb",
  "trees/WriteLoop_Tree_A_LOD2.glb",
  "trees/WriteLoop_Tree_Pine_LOD1.glb",
  "trees/WriteLoop_Tree_Pine_LOD2.glb"
];
const LOD2_FILES = ["trees/WriteLoop_Tree_A_LOD2.glb", "trees/WriteLoop_Tree_Pine_LOD2.glb"];

type PendingLoad = { url: string; onLoad: (data: unknown) => void; onError: (error: unknown) => void; settled: boolean };

const mockLoads: PendingLoad[] = [];
const mockFailing = new Set<string>();
const mockOutdoorCalls: { name: string; args: unknown[] }[] = [];
const mockThree = { camera: null as unknown, scene: null as unknown, size: { width: 400, height: 800 } };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const actual = jest.requireActual("@react-three/fiber/native");
  const React = jest.requireActual<typeof import("react")>("react");
  // 그림 불러오기(마을 땅 그림 미리 읽기)는 끝내지 않는 가짜다(Jest에서는 기기의 그림 크기 읽기를 부르지 못한다. 078·104 qa 테스트와 같다)
  const T = jest.requireMock<typeof import("three")>("three");
  T.TextureLoader.prototype.load = function load() {
    return new T.Texture();
  } as unknown as typeof T.TextureLoader.prototype.load;
  return {
    ...actual,
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: () => {}
  };
});
// 부른 파일을 적어 두고, 끝내는 것(성공·실패)은 테스트가 정하는 GLTFLoader
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  class GLTFLoader {
    load(url: unknown, onLoad?: (data: unknown) => void, _onProgress?: unknown, onError?: (error: unknown) => void) {
      mockLoads.push({ url: String(url), onLoad: onLoad ?? (() => {}), onError: onError ?? (() => {}), settled: false });
    }
    loadAsync(url: unknown) {
      return new Promise((resolve, reject) => this.load(url, resolve, undefined, reject));
    }
    parse() {}
    setPath() {
      return this;
    }
    setResourcePath() {
      return this;
    }
    setCrossOrigin() {
      return this;
    }
    setRequestHeader() {
      return this;
    }
    setDRACOLoader() {
      return this;
    }
    setKTX2Loader() {
      return this;
    }
    setMeshoptDecoder() {
      return this;
    }
    register() {
      return this;
    }
  }
  return { GLTFLoader };
});
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (object: { clone: (recursive: boolean) => unknown }) => object.clone(true)
}));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
// 118: 새 분수 모델 파일(village-fountain.glb)도 마을·미리 읽기가 읽으므로 파일 이름 글자로 가짜로 바꾼다(파일이 아직 없어도 되는 가상 모듈이다. 단언은 그대로다)
jest.mock("../../assets/models/village-fountain.glb", () => "village-fountain.glb", { virtual: true });
// 120: 새 가로등 모델 파일(village-streetlamp.glb)도 마을·미리 읽기가 읽으므로 가짜로 바꾼다(파일이 아직 없어도 되는 가상 모듈이다. 단언은 그대로다)
jest.mock("../../assets/models/village-streetlamp.glb", () => "village-streetlamp.glb", { virtual: true });
jest.mock("@/assets/models/wear-goggles.glb", () => "wear-goggles.glb");
jest.mock("@/assets/models/village-flowers.glb", () => "village-flowers.glb");
// 새 나무 파일(아직 저장소에 없어 가상 가짜. 상대 경로여야 파일이 없을 때도 가짜를 둘 수 있다)
jest.mock("../../assets/models/trees/WriteLoop_Tree_A_LOD1.glb", () => "trees/WriteLoop_Tree_A_LOD1.glb", { virtual: true });
jest.mock("../../assets/models/trees/WriteLoop_Tree_A_LOD2.glb", () => "trees/WriteLoop_Tree_A_LOD2.glb", { virtual: true });
jest.mock("../../assets/models/trees/WriteLoop_Tree_Pine_LOD1.glb", () => "trees/WriteLoop_Tree_Pine_LOD1.glb", { virtual: true });
jest.mock("../../assets/models/trees/WriteLoop_Tree_Pine_LOD2.glb", () => "trees/WriteLoop_Tree_Pine_LOD2.glb", { virtual: true });
// 창밖 장면 모듈: 무엇을 부르든 인자를 적어 둔다
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      mockOutdoorCalls.push({ name, args });
    };
  const outdoorObject = () => {
    const known: Record<string, unknown> = { scene: new T.Scene(), setDaylight: record("outdoor.setDaylight"), update: record("outdoor.update"), dispose: record("outdoor.dispose") };
    return new Proxy(known, {
      get(target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        if (prop in target) return target[prop];
        return record(`outdoor.${prop}`);
      }
    });
  };
  const exported: Record<string, unknown> = {
    __esModule: true,
    createOutdoor: (...args: unknown[]) => {
      mockOutdoorCalls.push({ name: "createOutdoor", args });
      return outdoorObject();
    }
  };
  return new Proxy(exported, {
    get(target, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "default") return undefined;
      if (prop in target) return target[prop];
      return record(String(prop));
    }
  });
});

type Rntl = typeof import("@testing-library/react-native/pure");
type Three = typeof import("three");
let rntl: Rntl | null = null;

/** 테스트마다 새로 읽은 모듈들(useLoader 캐시도 모듈에 있다). */
function loadModules() {
  rntl = require("@testing-library/react-native/pure") as Rntl;
  return {
    lib: rntl,
    React: require("react") as typeof import("react"),
    THREE: require("three") as Three,
    preload: require("@/components/lobby3d/lobby3d-preload") as typeof import("@/components/lobby3d/lobby3d-preload"),
    furniture: require("@/components/lobby3d/lobby3d-furniture") as typeof import("@/components/lobby3d/lobby3d-furniture")
  };
}
type Modules = ReturnType<typeof loadModules>;

async function flush(lib: Rntl, steps = 10) {
  for (let step = 0; step < steps; step += 1) {
    await lib.act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
  }
}

/** 명세 "새 나무 모델"을 본뜬 가짜 나무(메시 Tree_Foliage·Tree_Wood, 각자 그림 하나). */
function fakeTree(THREE: Three, url: string) {
  // 그림은 앱의 그림 읽기(texture-file-loader)가 두는 모양({ data: { localUri }, width, height })
  const image = (name: string) => ({ data: { localUri: `file:///cache/model-image-${name}.png` }, width: 2, height: 2 });
  const plane = () => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    return g;
  };
  const foliageMap = new THREE.Texture(image(`${url}-foliage`) as never);
  const woodMap = new THREE.Texture(image(`${url}-bark`) as never);
  const foliage = new THREE.Mesh(plane(), new THREE.MeshStandardMaterial({ name: "Foliage", map: foliageMap, alphaTest: 0.5, side: THREE.DoubleSide }));
  foliage.name = "Tree_Foliage";
  const wood = new THREE.Mesh(plane(), new THREE.MeshStandardMaterial({ name: "Bark", map: woodMap }));
  wood.name = "Tree_Wood";
  const scene = new THREE.Group();
  scene.add(foliage, wood);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: { version: "2.0" }, parser: {}, userData: {} };
}

/** 끝낸 읽기의 결과(파일마다). */
const resolved = new Map<string, unknown>();

/** 아직 끝나지 않은 읽기를 모두 끝낸다(mockFailing에 든 파일은 실패, 나무는 가짜 나무, 나머지는 빈 장면). */
async function settleLoads(m: Modules) {
  for (const load of mockLoads) {
    if (load.settled) continue;
    load.settled = true;
    if (mockFailing.has(load.url)) {
      load.onError(new Error(`읽지 못했다(테스트 가짜): ${load.url}`));
    } else {
      const data = TREE_FILES.includes(load.url)
        ? fakeTree(m.THREE, load.url)
        : { scene: new m.THREE.Group(), scenes: [], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
      resolved.set(load.url, data);
      load.onLoad(data);
    }
  }
  await flush(m.lib);
}

const treeLoads = () => mockLoads.map((load) => load.url).filter((url) => url.startsWith("trees/")).sort();

/** 그 모델(과 그 장면·메시·모양·재질·그림)을 가리키는 것들. */
function marksOf(model: unknown): Set<unknown> {
  const marks = new Set<unknown>([model]);
  const scene = (model as { scene: import("three").Object3D }).scene;
  scene.traverse((o) => {
    marks.add(o);
    const mesh = o as import("three").Mesh;
    if (mesh.geometry) marks.add(mesh.geometry);
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const mat of mats) {
      marks.add(mat);
      const map = (mat as import("three").MeshStandardMaterial).map;
      if (map) marks.add(map);
    }
  });
  return marks;
}

/** 값 안(배열·객체·Map·Set·3D 물체의 자식과 모양·재질)에 marks 중 하나가 있는가. */
function contains(value: unknown, marks: Set<unknown>, seen = new Set<unknown>(), depth = 0): boolean {
  if (value === null || value === undefined || typeof value !== "object" || depth > 6 || seen.has(value)) return false;
  if (marks.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((v) => contains(v, marks, seen, depth + 1));
  if (value instanceof Map) return [...value.values()].some((v) => contains(v, marks, seen, depth + 1));
  if (value instanceof Set) return [...value].some((v) => contains(v, marks, seen, depth + 1));
  const object3d = value as import("three").Mesh;
  if (object3d.isObject3D) {
    const mats = object3d.material ? (Array.isArray(object3d.material) ? object3d.material : [object3d.material]) : [];
    return [object3d.geometry, ...mats, ...object3d.children].some((v) => contains(v, marks, seen, depth + 1));
  }
  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) return Object.values(value as Record<string, unknown>).some((v) => contains(v, marks, seen, depth + 1));
  return false;
}

/** 창밖 장면 모듈이 받은 인자 어디엔가 그 파일의 모델이 있는가. */
const outdoorReceived = (file: string) => {
  const model = resolved.get(file);
  if (!model) return false;
  const marks = marksOf(model);
  return mockOutdoorCalls.some((call) => contains(call.args, marks));
};

/** 가구 묶음(창밖 장면을 짓는 곳)을 지금 3D 화면처럼 그린다. */
async function openRoom(m: Modules) {
  const fallback = new m.THREE.Group();
  const outdoorRef: MutableRefObject<unknown> = { current: null };
  const { createElement, Suspense } = m.React;
  await m.lib.render(
    createElement(
      m.furniture.BakedFurnitureErrorBoundary,
      null,
      createElement(Suspense, { fallback: null }, createElement(m.furniture.BakedFurniture, { fallback, daylight: {} as never, outdoorRef: outdoorRef as never }))
    )
  );
  return { fallback, outdoorRef };
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockLoads.length = 0;
  mockFailing.clear();
  mockOutdoorCalls.length = 0;
  resolved.clear();
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  if (rntl) await rntl.cleanup();
  rntl = null;
  process.off("unhandledRejection", onUnhandled);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

describe("[spec] 새 나무 모델을 앱 시작 때 미리 읽고 방(창밖)이 같은 것을 쓴다(113 명세 바뀌는 동작 11·7)", () => {
  test("L1 미리 읽기(preloadLobbyModels)가 새 나무 GLB 4개를 한 번씩 읽기 시작한다", async () => {
    const m = loadModules();
    m.preload.preloadLobbyModels();
    await flush(m.lib);
    expect(treeLoads()).toEqual(TREE_FILES);
  });

  test("L2 미리 읽기가 끝난 뒤 방을 열면 나무 파일을 다시 읽지 않고, 가구 묶음이 그려지며, 창밖 장면이 A·Pine LOD2 모델을 받는다", async () => {
    const m = loadModules();
    m.preload.preloadLobbyModels();
    await flush(m.lib);
    await settleLoads(m);
    expect(treeLoads()).toEqual(TREE_FILES);

    const room = await openRoom(m);
    await settleLoads(m);
    await flush(m.lib);
    expect(treeLoads()).toEqual(TREE_FILES);
    expect(room.fallback.visible).toBe(false);
    expect(LOD2_FILES.map((file) => [file, outdoorReceived(file)])).toEqual(LOD2_FILES.map((file) => [file, true]));
  });

  test("L3 미리 읽기가 끝나기 전에 방을 열어도 나무 파일을 두 번 읽지 않고, 읽기가 끝나면 창밖 장면이 A·Pine LOD2 모델을 받는다", async () => {
    const m = loadModules();
    m.preload.preloadLobbyModels();
    await flush(m.lib);
    expect(treeLoads()).toEqual(TREE_FILES);

    const room = await openRoom(m);
    await flush(m.lib);
    expect(treeLoads()).toEqual(TREE_FILES);

    await settleLoads(m);
    await flush(m.lib);
    expect(treeLoads()).toEqual(TREE_FILES);
    expect(room.fallback.visible).toBe(false);
    expect(LOD2_FILES.map((file) => [file, outdoorReceived(file)])).toEqual(LOD2_FILES.map((file) => [file, true]));
  });
});

describe("[spec] 나무 모델을 읽지 못하면 나무만 빼고 그리고 멈추지 않는다(113 명세 바뀌는 동작 12)", () => {
  test("L4 미리 읽기에서 나무 GLB 4개를 모두 읽지 못한 뒤 방을 열어도 가구 묶음과 창밖 장면은 그려지고, 처리되지 않은 실패가 없으며, 오류를 개발 콘솔(console.warn)에 남긴다", async () => {
    TREE_FILES.forEach((file) => mockFailing.add(file));
    const m = loadModules();
    m.preload.preloadLobbyModels();
    await flush(m.lib);
    // 나무 읽기가 시작됐다(실패를 볼 수 있는 상황인지). 방을 열기 전에 미리 읽기가 끝난다(나무는 실패)
    expect(treeLoads()).toEqual(TREE_FILES);
    await settleLoads(m);

    const room = await openRoom(m);
    await settleLoads(m);
    await flush(m.lib);
    // 가구는 모델로 그려졌다(오류 경계로 넘어가 대체 가구가 남지 않았다)
    expect(room.fallback.visible).toBe(false);
    // 창밖 장면이 있다(나무만 빠진다)
    expect(room.outdoorRef.current).not.toBeNull();
    expect(mockOutdoorCalls.filter((call) => call.name === "createOutdoor").length).toBeGreaterThan(0);
    expect(unhandled).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test("L5 방을 연 뒤에 나무 GLB 읽기가 실패해도(미리 읽기가 끝나기 전에 방을 엶) 가구 묶음과 창밖 장면은 그대로 그려지고, 오류를 개발 콘솔에 남긴다", async () => {
    TREE_FILES.forEach((file) => mockFailing.add(file));
    const m = loadModules();
    m.preload.preloadLobbyModels();
    await flush(m.lib);
    expect(treeLoads()).toEqual(TREE_FILES);

    const room = await openRoom(m);
    await flush(m.lib);
    await settleLoads(m);
    await flush(m.lib);
    expect(room.fallback.visible).toBe(false);
    expect(room.outdoorRef.current).not.toBeNull();
    expect(unhandled).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});
