// [spec] qa 테스트(작업 080, 리팩터링, 모바일): 로비 모델 파일을 읽는 방법만 바꾼다 — 지금 동작을 그대로 적는다.
// 기대값은 명세(private 작업 폴더 080-2026-11-11-로비-모델-파일-읽기-바꾸기/01-main-spec.md)의 "바꾸지 않는 것"과
// 지금 코드(@react-three/fiber 9.8.2의 native 진입점이 불러올 때 바꿔 두는 THREE.FileLoader.prototype.load·TextureLoader.prototype.load)의 동작에서 가져온다.
// 리팩터링이므로 모든 테스트는 지금 코드에서 통과해야 하고, 바꾼 뒤에도 통과해야 한다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다):
// - 앱이 로비 모델을 읽는 모듈(lobby3d-preload, lobby3d-room, lobby3d-furniture, lobby3d-character)을 불러온 뒤의
//   THREE.FileLoader.prototype.load를 쓴다. 앱의 바꾼 읽기도 이 모듈들을 불러오면 걸려 있다고 가정한다.
// - 파일 시스템은 가짜다. 주소(uri)마다 바이트를 두는 표를 하나 두고, 옛 API(expo-file-system/legacy)와
//   새 API(expo-file-system의 File·Directory·Paths)가 같은 표를 읽고 쓴다. 어느 API로 읽든 "어느 주소에서 몇 번 읽었나"를 적는다.
// - 파일 위치는 expo-asset의 Asset.fromModule(...).downloadAsync()가 주는 값(localUri, uri, hash, type)을 테스트가 정한다.
// - 기기에서는 Metro가 'buffer'를 npm 패키지 buffer로 풀므로 테스트도 같은 패키지를 쓴다(Node 내장 Buffer는 작은 값을 공용 풀에 담아
//   .buffer가 파일보다 커진다. 기기에서는 일어나지 않는 일이라 기기와 같게 맞췄다).
/* eslint-disable @typescript-eslint/no-require-imports */

const CACHE = "file:///data/user/0/kr.writeloop/cache/";

type MockFs = {
  files: Map<string, Uint8Array>;
  /** 내용을 읽은 주소(옛 API·새 API 모두) */
  reads: string[];
  /** 읽을 때 던질 오류(정하면 어느 API로 읽든 이 오류를 던진다) */
  readError: unknown;
  /** 복사할 때 던질 오류 */
  copyError: unknown;
};

const mockFs: MockFs = { files: new Map(), reads: [], readError: null, copyError: null };

type AssetInfo = { localUri: string | null; uri: string; hash: string; type: string };
const mockAssets: { byInput: Map<unknown, AssetInfo>; error: unknown; inputs: unknown[] } = {
  byInput: new Map(),
  error: null,
  inputs: []
};

function mockBuffer() {
  return jest.requireActual("../../node_modules/buffer/index.js").Buffer as {
    from(data: unknown, encoding?: string): Uint8Array & { toString(encoding?: string): string };
  };
}

function mockToBytes(content: string | Uint8Array, encoding?: string): Uint8Array {
  if (typeof content !== "string") return new Uint8Array(content);
  return new Uint8Array(mockBuffer().from(content, encoding === "base64" ? "base64" : "utf8"));
}

function mockReadBytes(uri: string): Uint8Array {
  mockFs.reads.push(uri);
  if (mockFs.readError) throw mockFs.readError;
  const data = mockFs.files.get(uri);
  if (!data) throw new Error(`가짜 파일 시스템에 없는 파일: ${uri}`);
  return new Uint8Array(data);
}

function mockCopy(from: string, to: string) {
  if (mockFs.copyError) throw mockFs.copyError;
  const data = mockFs.files.get(from);
  if (!data) throw new Error(`가짜 파일 시스템에 없는 파일: ${from}`);
  mockFs.files.set(to, new Uint8Array(data));
}

function mockJoin(parts: unknown[]): string {
  const strings = parts.map((p) => (typeof p === "string" ? p : String((p as { uri: string }).uri)));
  return strings.reduce((acc, part) => {
    if (!acc) return part;
    return acc.replace(/\/+$/, "") + "/" + part.replace(/^\/+/, "");
  }, "");
}

jest.mock("buffer", () => jest.requireActual("../../node_modules/buffer/index.js"));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: CACHE,
  documentDirectory: "file:///data/user/0/kr.writeloop/files/",
  bundleDirectory: null,
  EncodingType: { UTF8: "utf8", Base64: "base64" },
  readAsStringAsync: jest.fn(async (uri: string, options?: { encoding?: string }) => {
    const bytes = mockReadBytes(uri);
    return mockBuffer().from(bytes).toString(options?.encoding === "base64" ? "base64" : "utf8");
  }),
  writeAsStringAsync: jest.fn(async (uri: string, data: string, options?: { encoding?: string }) => {
    mockFs.files.set(uri, mockToBytes(data, options?.encoding));
  }),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => mockCopy(from, to)),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFs.files.has(uri), uri, isDirectory: false })),
  deleteAsync: jest.fn(async (uri: string) => {
    mockFs.files.delete(uri);
  }),
  makeDirectoryAsync: jest.fn(async () => {})
}));

jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = mockJoin(parts).replace(/\/?$/, "/");
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = mockJoin(parts);
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    get size() {
      return mockFs.files.get(this.uri)?.byteLength ?? 0;
    }
    get name() {
      return this.uri.split("/").pop() ?? "";
    }
    async bytes() {
      return mockReadBytes(this.uri);
    }
    bytesSync() {
      return mockReadBytes(this.uri);
    }
    async arrayBuffer() {
      const bytes = mockReadBytes(this.uri);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    async base64() {
      return mockBuffer().from(mockReadBytes(this.uri)).toString("base64");
    }
    base64Sync() {
      return mockBuffer().from(mockReadBytes(this.uri)).toString("base64");
    }
    async text() {
      return mockBuffer().from(mockReadBytes(this.uri)).toString("utf8");
    }
    textSync() {
      return mockBuffer().from(mockReadBytes(this.uri)).toString("utf8");
    }
    write(content: string | Uint8Array, options?: { encoding?: string }) {
      mockFs.files.set(this.uri, mockToBytes(content, options?.encoding));
    }
    create() {
      if (!mockFs.files.has(this.uri)) mockFs.files.set(this.uri, new Uint8Array(0));
    }
    delete() {
      mockFs.files.delete(this.uri);
    }
    copy(destination: { uri: string }) {
      const to = destination instanceof Directory ? destination.uri + this.name : destination.uri;
      mockCopy(this.uri, to);
    }
  }
  return {
    File,
    Directory,
    Paths: {
      get cache() {
        return new Directory(CACHE);
      },
      get document() {
        return new Directory("file:///data/user/0/kr.writeloop/files/");
      }
    },
    EncodingType: { UTF8: "utf8", Base64: "base64" }
  };
});

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn((input: unknown) => {
      mockAssets.inputs.push(input);
      return {
        downloadAsync: async () => {
          if (mockAssets.error) throw mockAssets.error;
          const info = mockAssets.byInput.get(input);
          if (!info) throw new Error(`테스트가 정하지 않은 자산: ${String(input)}`);
          return { ...info, downloadAsync: async () => info };
        }
      };
    })
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
// 090-② 05 결정 3(사용자 2026-11-13 "qa가 새 동작에 맞게 고침"): 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱의 파일이다(준비 변경. 단언은 그대로다)
jest.mock("@/assets/models/furniture/desk.glb", () => 9011);
jest.mock("@/assets/models/furniture/bookcase.glb", () => 9012);
jest.mock("@/assets/models/furniture/board.glb", () => 9013);
jest.mock("@/assets/models/furniture/window.glb", () => 9014);
jest.mock("@/assets/models/furniture/wardrobe.glb", () => 9015);
jest.mock("@/assets/models/furniture/rug.glb", () => 9016);
jest.mock("@/assets/models/furniture/lamp.glb", () => 9017);
// 088 ② 06 결정 2(사용자 2026-11-13 "둘 다 qa가 고침"): 미리 읽기에 마을 모델이 더해져, 그 파일의 가짜만 더했다(준비 변경. 단언은 그대로다)
jest.mock("@/assets/models/lobby-village.glb", () => 9004);
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => ({ createOutdoor: () => ({}) }));

// 앱이 로비 모델을 읽는 모듈을 불러온다(여기서 FileLoader·TextureLoader가 기기용 읽기로 바뀐다)
require("@/components/lobby3d/lobby3d-preload");
require("@/components/lobby3d/lobby3d-room");
require("@/components/lobby3d/lobby3d-furniture");
require("@/components/lobby3d/lobby3d-character");

const THREE = require("three") as typeof import("three");
const RN = require("react-native") as typeof import("react-native");
const nodeFs = jest.requireActual("fs") as typeof import("fs");
const nodePath = jest.requireActual("path") as typeof import("path");

/** 0..255가 돌아가는 바이트 n개(첫 바이트는 seed) */
function pattern(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (seed + i * 7) & 0xff;
  return out;
}

function bytesOf(value: unknown): number[] {
  return Array.from(new Uint8Array(value as ArrayBuffer));
}

/** 두 바이트 열이 처음 다른 자리(같으면 -1). 큰 파일을 배열로 바꿔 비교하면 느려서 따로 둔다. */
function firstDifference(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

function isArrayBuffer(value: unknown): boolean {
  return Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

type Run = {
  events: string[];
  onLoad: jest.Mock;
  onProgress: jest.Mock;
  onError: jest.Mock;
  returned: unknown;
  manager: import("three").LoadingManager;
};

/** GLTFLoader가 하는 것처럼 FileLoader를 만들어 load를 부른다. 관리자(LoadingManager)는 진짜이고 부른 순서를 적는다. */
function startLoad(url: unknown, options: { path?: string; callbacks?: boolean; onLoadThrows?: unknown } = {}): Run {
  const events: string[] = [];
  const manager = new THREE.LoadingManager();
  const start = manager.itemStart.bind(manager);
  const end = manager.itemEnd.bind(manager);
  const error = manager.itemError.bind(manager);
  manager.itemStart = (u: string) => {
    events.push(`itemStart:${String(u)}`);
    start(u);
  };
  manager.itemEnd = (u: string) => {
    events.push(`itemEnd:${String(u)}`);
    end(u);
  };
  manager.itemError = (u: string) => {
    events.push(`itemError:${String(u)}`);
    error(u);
  };
  const loader = new THREE.FileLoader(manager);
  loader.setPath(options.path ?? "");
  loader.setResponseType("arraybuffer");
  loader.setRequestHeader({});
  loader.setWithCredentials(false);
  const onLoad = jest.fn((_data: unknown) => {
    events.push("onLoad");
    if (options.onLoadThrows) throw options.onLoadThrows;
  });
  const onProgress = jest.fn(() => {
    events.push("onProgress");
  });
  const onError = jest.fn((_e: unknown) => {
    events.push("onError");
  });
  const returned =
    options.callbacks === false
      ? loader.load(url as string)
      : loader.load(url as string, onLoad, onProgress as never, onError);
  return { events, onLoad, onProgress, onError, returned, manager };
}

/** 관리자가 그 주소를 끝냈다고 알릴 때까지(또는 오래 걸리면) 기다린다 */
async function settle(run: Run, url: unknown) {
  for (let i = 0; i < 500; i++) {
    if (run.events.includes(`itemEnd:${String(url)}`)) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`읽기가 끝나지 않았다: ${run.events.join(", ")}`);
}

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\./;

beforeEach(() => {
  mockFs.files.clear();
  mockFs.reads.length = 0;
  mockFs.readError = null;
  mockFs.copyError = null;
  mockAssets.byInput.clear();
  mockAssets.error = null;
  mockAssets.inputs.length = 0;
});

describe("[그대로] 로비 모델 파일 읽기(THREE.FileLoader.prototype.load) — 파일 위치", () => {
  test("번들 모듈 번호: expo-asset으로 받은 로컬 경로(':'가 있음)에서 그대로 읽고, 파일과 같은 바이트의 ArrayBuffer를 onLoad로 준다", async () => {
    const content = pattern(5000, 3);
    mockAssets.byInput.set(101, { localUri: "file:///bundle/lobby-room.glb", uri: "http://localhost:8081/assets/lobby-room.glb", hash: "h101", type: "glb" });
    mockFs.files.set("file:///bundle/lobby-room.glb", content);

    const run = startLoad(101);
    await settle(run, 101);

    expect(mockAssets.inputs).toEqual([101]);
    expect(mockFs.reads).toEqual(["file:///bundle/lobby-room.glb"]);
    expect(run.onLoad).toHaveBeenCalledTimes(1);
    const data = run.onLoad.mock.calls[0][0];
    expect(isArrayBuffer(data)).toBe(true);
    expect((data as ArrayBuffer).byteLength).toBe(5000);
    expect(bytesOf(data)).toEqual(Array.from(content));
    expect(run.onError).not.toHaveBeenCalled();
    // 캐시 폴더로 복사하지 않는다
    expect([...mockFs.files.keys()]).toEqual(["file:///bundle/lobby-room.glb"]);
  });

  test("로컬 경로가 없으면(localUri null) 자산의 uri에서 읽는다", async () => {
    const content = pattern(4100, 11);
    mockAssets.byInput.set(102, { localUri: null, uri: "file:///assets/writeloop.glb", hash: "h102", type: "glb" });
    mockFs.files.set("file:///assets/writeloop.glb", content);

    const run = startLoad(102);
    await settle(run, 102);

    expect(mockFs.reads).toEqual(["file:///assets/writeloop.glb"]);
    expect(bytesOf(run.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
    expect(run.onError).not.toHaveBeenCalled();
  });

  test("경로에 ':'가 없으면(안드로이드 출시 빌드) 캐시 폴더의 ExponentAsset-<hash>.<type>으로 복사해 그 파일에서 읽는다", async () => {
    const content = pattern(6000, 29);
    mockAssets.byInput.set(103, { localUri: "assets_models_lobbyfurniture", uri: "assets_models_lobbyfurniture", hash: "abc123", type: "glb" });
    mockFs.files.set("assets_models_lobbyfurniture", content);

    const run = startLoad(103);
    await settle(run, 103);

    const cached = `${CACHE}ExponentAsset-abc123.glb`;
    expect(mockFs.files.has(cached)).toBe(true);
    expect(Array.from(mockFs.files.get(cached)!)).toEqual(Array.from(content));
    expect(mockFs.reads).toEqual([cached]);
    expect(bytesOf(run.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
    expect(run.onError).not.toHaveBeenCalled();
  });

  test("'file:'로 시작하는 문자열은 expo-asset을 거치지 않고 그 주소에서 읽는다", async () => {
    const content = pattern(4500, 5);
    mockFs.files.set("file:///data/models/a.glb", content);

    const run = startLoad("file:///data/models/a.glb");
    await settle(run, "file:///data/models/a.glb");

    expect(mockAssets.inputs).toEqual([]);
    expect(mockFs.reads).toEqual(["file:///data/models/a.glb"]);
    expect(bytesOf(run.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
  });

  test("'data:...;base64,' 문자열은 캐시 폴더의 <uuid>.<형식 뒤쪽> 파일로 풀어 그 파일에서 읽는다", async () => {
    const url = "data:application/octet-stream;base64,AAECAwT/";

    const run = startLoad(url);
    await settle(run, url);

    expect(mockAssets.inputs).toEqual([]);
    const created = [...mockFs.files.keys()];
    expect(created).toHaveLength(1);
    expect(created[0].startsWith(CACHE)).toBe(true);
    const name = created[0].slice(CACHE.length);
    expect(name).toMatch(UUID_FILE);
    expect(name.endsWith(".octet-stream")).toBe(true);
    expect(Array.from(mockFs.files.get(created[0])!)).toEqual([0, 1, 2, 3, 4, 255]);
    expect(mockFs.reads).toEqual([created[0]]);
    const data = run.onLoad.mock.calls[0][0];
    expect(isArrayBuffer(data)).toBe(true);
    expect(bytesOf(data)).toEqual([0, 1, 2, 3, 4, 255]);
  });

  test("'blob:' 문자열은 XMLHttpRequest로 blob을 받아 글자로 읽은 것을 base64로 보고 캐시 폴더의 <uuid>.<형식 뒤쪽> 파일로 풀어 읽는다", async () => {
    const g = globalThis as unknown as { XMLHttpRequest: unknown; FileReader: unknown };
    const savedXhr = g.XMLHttpRequest;
    const savedReader = g.FileReader;
    const requests: { method: string; url: string; responseType: string }[] = [];
    g.XMLHttpRequest = class {
      responseType = "";
      response: unknown = null;
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      private method = "";
      private url = "";
      open(method: string, url: string) {
        this.method = method;
        this.url = url;
      }
      send() {
        requests.push({ method: this.method, url: this.url, responseType: this.responseType });
        this.response = { type: "model/gltf-binary" };
        this.onload?.();
      }
    };
    const readAs: unknown[] = [];
    g.FileReader = class {
      result: unknown = null;
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      readAsText(blob: unknown) {
        readAs.push(blob);
        this.result = "CQgHBg==";
        this.onload?.();
      }
    };
    try {
      const url = "blob:7d4c1a2e-0000-4000-8000-000000000001?offset=0&size=4";
      const run = startLoad(url);
      await settle(run, url);

      expect(requests).toEqual([{ method: "GET", url, responseType: "blob" }]);
      expect(readAs).toEqual([{ type: "model/gltf-binary" }]);
      const created = [...mockFs.files.keys()];
      expect(created).toHaveLength(1);
      const name = created[0].slice(CACHE.length);
      expect(created[0].startsWith(CACHE)).toBe(true);
      expect(name).toMatch(UUID_FILE);
      expect(name.endsWith(".gltf-binary")).toBe(true);
      expect(mockFs.reads).toEqual([created[0]]);
      expect(bytesOf(run.onLoad.mock.calls[0][0])).toEqual([9, 8, 7, 6]);
      expect(run.onError).not.toHaveBeenCalled();
    } finally {
      g.XMLHttpRequest = savedXhr;
      g.FileReader = savedReader;
    }
  });

  test("그 밖의 문자열(https 주소)은 expo-asset에 그 문자열을 넘겨 받은 로컬 경로에서 읽는다", async () => {
    const content = pattern(4200, 77);
    const url = "https://example.com/models/x.glb";
    mockAssets.byInput.set(url, { localUri: "file:///cache/ExpoAsset/x.glb", uri: url, hash: "hx", type: "glb" });
    mockFs.files.set("file:///cache/ExpoAsset/x.glb", content);

    const run = startLoad(url);
    await settle(run, url);

    expect(mockAssets.inputs).toEqual([url]);
    expect(mockFs.reads).toEqual(["file:///cache/ExpoAsset/x.glb"]);
    expect(bytesOf(run.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
  });

  test("this.path가 있고 주소가 문자열이면 앞에 붙여 읽고, 관리자에게도 붙인 주소로 알린다", async () => {
    const content = pattern(4300, 1);
    mockFs.files.set("file:///data/models/b.glb", content);

    const run = startLoad("b.glb", { path: "file:///data/models/" });
    await settle(run, "file:///data/models/b.glb");

    expect(mockFs.reads).toEqual(["file:///data/models/b.glb"]);
    expect(run.events).toEqual(["itemStart:file:///data/models/b.glb", "onLoad", "itemEnd:file:///data/models/b.glb"]);
    expect(bytesOf(run.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
  });

  test("this.path가 있어도 주소가 번호(번들 모듈)면 붙이지 않는다", async () => {
    const content = pattern(4400, 2);
    mockAssets.byInput.set(104, { localUri: "file:///bundle/c.glb", uri: "file:///bundle/c.glb", hash: "h104", type: "glb" });
    mockFs.files.set("file:///bundle/c.glb", content);

    const run = startLoad(104, { path: "file:///data/models/" });
    await settle(run, 104);

    expect(mockAssets.inputs).toEqual([104]);
    expect(mockFs.reads).toEqual(["file:///bundle/c.glb"]);
    expect(run.events).toEqual(["itemStart:104", "onLoad", "itemEnd:104"]);
  });

  test("로비의 세 모델 파일(진짜 파일 바이트)을 읽으면 각각 파일과 같은 바이트의 ArrayBuffer를 준다", async () => {
    const dir = nodePath.join(__dirname, "..", "..", "assets", "models");
    // 090-② 05 결정 3: 가구 묶음 대신 앱에 든 처음 방 가구 일곱의 파일(furniture/<id>.glb)을 읽는다
    const files = ["lobby-room.glb", "writeloop.glb", "furniture/desk.glb", "furniture/bookcase.glb", "furniture/board.glb", "furniture/window.glb", "furniture/wardrobe.glb", "furniture/rug.glb", "furniture/lamp.glb"];
    const contents = files.map((f) => new Uint8Array(nodeFs.readFileSync(nodePath.join(dir, f))));
    files.forEach((f, i) => {
      mockAssets.byInput.set(201 + i, { localUri: `file:///bundle/${f}`, uri: `file:///bundle/${f}`, hash: `h${i}`, type: "glb" });
      mockFs.files.set(`file:///bundle/${f}`, contents[i]);
    });

    const runs = files.map((_, i) => startLoad(201 + i));
    for (let i = 0; i < runs.length; i++) await settle(runs[i], 201 + i);

    runs.forEach((run, i) => {
      expect(run.onLoad).toHaveBeenCalledTimes(1);
      const data = run.onLoad.mock.calls[0][0] as ArrayBuffer;
      expect(isArrayBuffer(data)).toBe(true);
      expect(data.byteLength).toBe(contents[i].byteLength);
      expect(firstDifference(new Uint8Array(data), contents[i])).toBe(-1);
      expect(run.onError).not.toHaveBeenCalled();
    });
  }, 60000);
});

describe("[그대로] 로비 모델 파일 읽기 — 관리자(LoadingManager)와 콜백", () => {
  test("성공: load를 부르는 순간 itemStart, 읽은 뒤 onLoad, 그다음 itemEnd. itemError·onProgress는 부르지 않고 load는 아무것도 돌려주지 않는다", async () => {
    mockFs.files.set("file:///m/a.glb", pattern(4096, 9));

    const run = startLoad("file:///m/a.glb");
    // 부른 바로 뒤(아직 읽기 전)
    expect(run.events).toEqual(["itemStart:file:///m/a.glb"]);
    expect(run.returned).toBeUndefined();
    await settle(run, "file:///m/a.glb");

    expect(run.events).toEqual(["itemStart:file:///m/a.glb", "onLoad", "itemEnd:file:///m/a.glb"]);
    expect(run.onProgress).not.toHaveBeenCalled();
    expect(run.onError).not.toHaveBeenCalled();
  });

  test("파일 위치를 받지 못하면(expo-asset 실패) 그 오류로 onError, 그다음 itemError, itemEnd. onLoad는 부르지 않는다", async () => {
    const failure = new Error("download failed");
    mockAssets.error = failure;

    const run = startLoad(105);
    await settle(run, 105);

    expect(run.events).toEqual(["itemStart:105", "onError", "itemError:105", "itemEnd:105"]);
    expect(run.onError).toHaveBeenCalledWith(failure);
    expect(run.onLoad).not.toHaveBeenCalled();
    expect(mockFs.reads).toEqual([]);
  });

  test("파일을 읽지 못하면 그 오류로 onError, 그다음 itemError, itemEnd. onLoad는 부르지 않는다", async () => {
    const failure = new Error("read failed");
    mockFs.files.set("file:///m/broken.glb", pattern(4096, 1));
    mockFs.readError = failure;

    const run = startLoad("file:///m/broken.glb");
    await settle(run, "file:///m/broken.glb");

    expect(run.events).toEqual(["itemStart:file:///m/broken.glb", "onError", "itemError:file:///m/broken.glb", "itemEnd:file:///m/broken.glb"]);
    expect(run.onError).toHaveBeenCalledWith(failure);
    expect(run.onLoad).not.toHaveBeenCalled();
  });

  test("캐시 폴더로 복사하지 못하면(안드로이드 출시 빌드) 그 오류로 onError, itemError, itemEnd", async () => {
    const failure = new Error("copy failed");
    mockAssets.byInput.set(106, { localUri: "assets_models_x", uri: "assets_models_x", hash: "h106", type: "glb" });
    mockFs.files.set("assets_models_x", pattern(4096, 4));
    mockFs.copyError = failure;

    const run = startLoad(106);
    await settle(run, 106);

    expect(run.events).toEqual(["itemStart:106", "onError", "itemError:106", "itemEnd:106"]);
    expect(run.onError).toHaveBeenCalledWith(failure);
    expect(run.onLoad).not.toHaveBeenCalled();
  });

  test("onLoad가 오류를 던지면 그 오류로 onError, itemError, itemEnd가 이어서 불린다", async () => {
    const thrown = new Error("parse failed in onLoad");
    mockFs.files.set("file:///m/c.glb", pattern(4096, 6));

    const run = startLoad("file:///m/c.glb", { onLoadThrows: thrown });
    await settle(run, "file:///m/c.glb");

    expect(run.events).toEqual(["itemStart:file:///m/c.glb", "onLoad", "onError", "itemError:file:///m/c.glb", "itemEnd:file:///m/c.glb"]);
    expect(run.onError).toHaveBeenCalledWith(thrown);
  });

  test("콜백 없이 불러도 성공·실패 모두 관리자에게 알리고 끝난다", async () => {
    mockFs.files.set("file:///m/d.glb", pattern(4096, 8));
    const ok = startLoad("file:///m/d.glb", { callbacks: false });
    await settle(ok, "file:///m/d.glb");
    expect(ok.events).toEqual(["itemStart:file:///m/d.glb", "itemEnd:file:///m/d.glb"]);

    const failing = startLoad("file:///m/missing.glb", { callbacks: false });
    await settle(failing, "file:///m/missing.glb");
    expect(failing.events).toEqual(["itemStart:file:///m/missing.glb", "itemError:file:///m/missing.glb", "itemEnd:file:///m/missing.glb"]);
  });

  test("같은 주소를 두 번 load하면 두 번 읽고(three의 Cache를 쓰지 않는다) 둘 다 onLoad를 받는다", async () => {
    const content = pattern(4096, 12);
    mockFs.files.set("file:///m/e.glb", content);

    const first = startLoad("file:///m/e.glb");
    const second = startLoad("file:///m/e.glb");
    await settle(first, "file:///m/e.glb");
    await settle(second, "file:///m/e.glb");

    expect(mockFs.reads).toEqual(["file:///m/e.glb", "file:///m/e.glb"]);
    expect(bytesOf(first.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
    expect(bytesOf(second.onLoad.mock.calls[0][0])).toEqual(Array.from(content));
  });
});

describe("[그대로] 그림 읽기(TextureLoader)와 주소 기준(LoaderUtils.extractUrlBase)", () => {
  test("TextureLoader는 파일 내용을 읽지 않고, 위치와 크기만으로 텍스처를 만들어 onLoad로 준다", async () => {
    const getSize = jest.spyOn(RN.Image, "getSize").mockImplementation(((uri: string, ok: (w: number, h: number) => void) => {
      if (uri === "file:///tex/wood.png") ok(64, 32);
    }) as never);
    try {
      const onLoad = jest.fn();
      const onError = jest.fn();
      const loader = new THREE.TextureLoader();
      const returned = loader.load("file:///tex/wood.png", onLoad, undefined, onError);
      for (let i = 0; i < 100 && onLoad.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 0));

      expect(onLoad).toHaveBeenCalledTimes(1);
      const texture = onLoad.mock.calls[0][0];
      expect(texture).toBe(returned);
      expect(texture.image).toEqual({ data: { localUri: "file:///tex/wood.png" }, width: 64, height: 32 });
      expect(texture.flipY).toBe(true);
      expect(texture.isDataTexture).toBe(true);
      expect(texture.version).toBeGreaterThan(0);
      expect(onError).not.toHaveBeenCalled();
      expect(mockFs.reads).toEqual([]);
    } finally {
      getSize.mockRestore();
    }
  });

  test("LoaderUtils.extractUrlBase는 문자열이 아니면 './', 문자열이면 마지막 '/'까지를 준다", () => {
    expect(THREE.LoaderUtils.extractUrlBase(101 as unknown as string)).toBe("./");
    expect(THREE.LoaderUtils.extractUrlBase("file:///data/models/a.glb")).toBe("file:///data/models/");
  });
});
