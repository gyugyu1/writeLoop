// qa 테스트 도우미(작업 105, 3D 그림 캐시 파일): 기기 파일 시스템(expo-file-system의 옛 API와 새 API)과 expo-crypto의 가짜.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-texture-cache.spec.test.ts와 texture-cache-cleanup-start.spec.test.tsx가 함께 쓴다.
//
// - 파일 시스템은 주소(uri)마다 바이트를 두는 표 하나와 폴더 주소 모음 하나다. 옛 API(expo-file-system/legacy)와
//   새 API(expo-file-system의 File·Directory·Paths)가 같은 표를 읽고 쓴다. 구현이 어느 API를 쓰든 같은 결과가 나온다.
// - 표는 globalThis에 둔다. 테스트가 "앱을 다시 연다"를 모듈을 새로 읽는 것(jest.resetModules)으로 흉내 낼 때도
//   기기 파일은 그대로 남아야 하기 때문이다(가짜 모듈 공장이 이 파일을 다시 읽어도 같은 표를 쓴다).
// - 캐시 폴더 아래에 쓴 주소(writes)와 지운 주소(deletes)를 적는다. 지우기·목록 읽기 오류를 정할 수 있다.
// - expo-crypto의 해시(digestStringAsync, digest)는 Node의 crypto로 실제 값을 계산한다. 구현이 어느 쪽을 쓰든 같은 내용이면 같은 값이 나온다.

export const CACHE = "file:///data/user/0/kr.writeloop/cache/";
export const DOCUMENT = "file:///data/user/0/kr.writeloop/files/";

export type FsState = {
  files: Map<string, Uint8Array>;
  /** 캐시 폴더 밖의 폴더를 빼고, 만든 폴더(끝에 '/'를 붙인 주소). 캐시 폴더 자체는 늘 있다. */
  dirs: Set<string>;
  /** 쓰기(옛 API writeAsStringAsync·copyAsync·moveAsync, 새 API write·create·copy·move)의 대상 주소 */
  writes: string[];
  /** 지운 주소(파일·폴더) */
  deletes: string[];
  /** 정하면 지우기(옛 API deleteAsync, 새 API delete)가 이 오류를 던진다 */
  deleteError: unknown;
  /** 정하면 폴더 목록 읽기(옛 API readDirectoryAsync, 새 API list·listAsRecords)가 이 오류를 던진다 */
  listError: unknown;
};

export function fsState(): FsState {
  const g = globalThis as unknown as { __qa105Fs?: FsState };
  if (!g.__qa105Fs) {
    g.__qa105Fs = { files: new Map(), dirs: new Set(), writes: [], deletes: [], deleteError: null, listError: null };
  }
  return g.__qa105Fs;
}

export function resetFs(): void {
  const s = fsState();
  s.files.clear();
  s.dirs.clear();
  s.writes.length = 0;
  s.deletes.length = 0;
  s.deleteError = null;
  s.listError = null;
}

function nodeBuffer(): typeof Buffer {
  return (jest.requireActual("buffer") as typeof import("buffer")).Buffer;
}

export function toBytes(content: string | Uint8Array | ArrayBuffer, encoding?: string): Uint8Array {
  if (typeof content === "string") return new Uint8Array(nodeBuffer().from(content, encoding === "base64" ? "base64" : "utf8"));
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
  return new Uint8Array(content.slice(0));
}

export function base64Of(bytes: Uint8Array): string {
  return nodeBuffer().from(bytes).toString("base64");
}

function asDir(uri: string): string {
  return uri.endsWith("/") ? uri : uri + "/";
}

export function isDir(uri: string): boolean {
  const d = asDir(uri);
  return d === CACHE || d === DOCUMENT || fsState().dirs.has(d);
}

function join(parts: unknown[]): string {
  const strings = parts.map((p) => (typeof p === "string" ? p : String((p as { uri: string }).uri)));
  return strings.reduce((acc, part) => {
    if (!acc) return part;
    return acc.replace(/\/+$/, "") + "/" + part.replace(/^\/+/, "");
  }, "");
}

/** 폴더 바로 아래의 이름들(파일은 이름, 폴더는 이름. 끝 '/' 없이) */
function childNames(dirUri: string): { name: string; dir: boolean }[] {
  const s = fsState();
  const d = asDir(dirUri);
  const out = new Map<string, boolean>();
  for (const key of s.files.keys()) {
    if (!key.startsWith(d)) continue;
    const rest = key.slice(d.length);
    const slash = rest.indexOf("/");
    if (slash < 0) out.set(rest, false);
    else out.set(rest.slice(0, slash), true);
  }
  for (const key of s.dirs) {
    if (!key.startsWith(d) || key === d) continue;
    const rest = key.slice(d.length);
    out.set(rest.slice(0, rest.indexOf("/")), true);
  }
  return [...out.entries()].map(([name, dir]) => ({ name, dir }));
}

function deletePath(uri: string, idempotent: boolean) {
  const s = fsState();
  if (s.deleteError) throw s.deleteError;
  if (s.files.has(uri)) {
    s.files.delete(uri);
    s.deletes.push(uri);
    return;
  }
  if (isDir(uri)) {
    const d = asDir(uri);
    for (const key of [...s.files.keys()]) if (key.startsWith(d)) s.files.delete(key);
    for (const key of [...s.dirs]) if (key.startsWith(d)) s.dirs.delete(key);
    s.deletes.push(d);
    return;
  }
  if (!idempotent) throw new Error(`가짜 파일 시스템에 없는 것: ${uri}`);
}

function readBytes(uri: string): Uint8Array {
  const data = fsState().files.get(uri);
  if (!data) throw new Error(`가짜 파일 시스템에 없는 파일: ${uri}`);
  return new Uint8Array(data);
}

function writeBytes(uri: string, bytes: Uint8Array) {
  const s = fsState();
  s.files.set(uri, bytes);
  s.writes.push(uri);
}

/** expo-file-system/legacy의 가짜 */
export function legacyFsModule() {
  return {
    cacheDirectory: CACHE,
    documentDirectory: DOCUMENT,
    bundleDirectory: null,
    EncodingType: { UTF8: "utf8", Base64: "base64" },
    readAsStringAsync: jest.fn(async (uri: string, options?: { encoding?: string }) =>
      nodeBuffer().from(readBytes(uri)).toString(options?.encoding === "base64" ? "base64" : "utf8")
    ),
    writeAsStringAsync: jest.fn(async (uri: string, data: string, options?: { encoding?: string }) => {
      writeBytes(uri, toBytes(data, options?.encoding));
    }),
    copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      writeBytes(to, readBytes(from));
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      const bytes = readBytes(from);
      fsState().files.delete(from);
      writeBytes(to, bytes);
    }),
    getInfoAsync: jest.fn(async (uri: string) => {
      const s = fsState();
      if (s.files.has(uri)) {
        return { exists: true, isDirectory: false, uri, size: s.files.get(uri)!.byteLength, modificationTime: 0 };
      }
      if (isDir(uri)) return { exists: true, isDirectory: true, uri: asDir(uri), size: 0, modificationTime: 0 };
      return { exists: false, isDirectory: false, uri };
    }),
    deleteAsync: jest.fn(async (uri: string, options?: { idempotent?: boolean }) => {
      deletePath(uri, options?.idempotent === true);
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
      fsState().dirs.add(asDir(uri));
    }),
    readDirectoryAsync: jest.fn(async (uri: string) => {
      const s = fsState();
      if (s.listError) throw s.listError;
      if (!isDir(uri)) throw new Error(`가짜 파일 시스템에 없는 폴더: ${uri}`);
      return childNames(uri).map((c) => c.name);
    })
  };
}

/** expo-file-system(새 API)의 가짜 */
export function newFsModule() {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = asDir(join(parts));
    }
    get exists() {
      return isDir(this.uri);
    }
    get name() {
      return this.uri.replace(/\/$/, "").split("/").pop() ?? "";
    }
    create() {
      fsState().dirs.add(this.uri);
    }
    delete() {
      deletePath(this.uri, false);
    }
    info() {
      return { exists: this.exists, uri: this.uri };
    }
    list(): (Directory | File)[] {
      const s = fsState();
      if (s.listError) throw s.listError;
      return childNames(this.uri).map((c) => (c.dir ? new Directory(this.uri + c.name) : new File(this.uri + c.name)));
    }
    listAsRecords() {
      return this.list().map((entry) => ({ isDirectory: entry instanceof Directory, uri: entry.uri }));
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return fsState().files.has(this.uri);
    }
    get size() {
      return fsState().files.get(this.uri)?.byteLength ?? 0;
    }
    get name() {
      return this.uri.split("/").pop() ?? "";
    }
    get extension() {
      const name = this.name;
      const dot = name.lastIndexOf(".");
      return dot < 0 ? "" : name.slice(dot);
    }
    get parentDirectory() {
      return new Directory(this.uri.slice(0, this.uri.lastIndexOf("/") + 1));
    }
    info() {
      const exists = this.exists;
      return exists ? { exists, uri: this.uri, size: this.size, modificationTime: 0 } : { exists, uri: this.uri };
    }
    async bytes() {
      return readBytes(this.uri);
    }
    bytesSync() {
      return readBytes(this.uri);
    }
    async base64() {
      return base64Of(readBytes(this.uri));
    }
    base64Sync() {
      return base64Of(readBytes(this.uri));
    }
    async text() {
      return nodeBuffer().from(readBytes(this.uri)).toString("utf8");
    }
    textSync() {
      return nodeBuffer().from(readBytes(this.uri)).toString("utf8");
    }
    async arrayBuffer() {
      const bytes = readBytes(this.uri);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    write(content: string | Uint8Array, options?: { encoding?: string }) {
      writeBytes(this.uri, toBytes(content, options?.encoding));
    }
    create() {
      if (!fsState().files.has(this.uri)) writeBytes(this.uri, new Uint8Array(0));
    }
    delete() {
      deletePath(this.uri, false);
    }
    copy(destination: { uri: string }) {
      const to = destination instanceof Directory ? destination.uri + this.name : destination.uri;
      writeBytes(to, readBytes(this.uri));
    }
    move(destination: { uri: string }) {
      const to = destination instanceof Directory ? destination.uri + this.name : destination.uri;
      const bytes = readBytes(this.uri);
      fsState().files.delete(this.uri);
      writeBytes(to, bytes);
      this.uri = to;
    }
  }
  const Paths = {
    get cache() {
      return new Directory(CACHE);
    },
    get document() {
      return new Directory(DOCUMENT);
    },
    join: (...parts: unknown[]) => join(parts),
    basename: (path: string, ext?: string) => {
      const base = String(path).replace(/\/$/, "").split("/").pop() ?? "";
      return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    },
    dirname: (path: string) => String(path).replace(/\/$/, "").split("/").slice(0, -1).join("/"),
    extname: (path: string) => {
      const base = String(path).split("/").pop() ?? "";
      const dot = base.lastIndexOf(".");
      return dot <= 0 ? "" : base.slice(dot);
    },
    info: (...uris: string[]) => {
      const uri = join(uris);
      const s = fsState();
      if (s.files.has(uri)) return { exists: true, isDirectory: false };
      if (isDir(uri)) return { exists: true, isDirectory: true };
      return { exists: false, isDirectory: null };
    }
  };
  return { File, Directory, Paths, EncodingType: { UTF8: "utf8", Base64: "base64" } };
}

/** expo-crypto의 가짜(해시는 Node crypto로 실제 값을 계산한다) */
export function cryptoModule() {
  const nodeCrypto = jest.requireActual("crypto") as typeof import("crypto");
  const algorithms: Record<string, string> = { "SHA-1": "sha1", "SHA-256": "sha256", "SHA-384": "sha384", "SHA-512": "sha512", MD5: "md5" };
  const hashName = (algorithm: string) => {
    const name = algorithms[algorithm];
    if (!name) throw new Error(`가짜 expo-crypto가 모르는 해시: ${algorithm}`);
    return name;
  };
  const toInput = (data: unknown): Uint8Array => {
    if (typeof data === "string") return new Uint8Array(nodeBuffer().from(data, "utf8"));
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(data as ArrayBuffer);
  };
  return {
    CryptoDigestAlgorithm: { SHA1: "SHA-1", SHA256: "SHA-256", SHA384: "SHA-384", SHA512: "SHA-512", MD2: "MD2", MD4: "MD4", MD5: "MD5" },
    CryptoEncoding: { HEX: "hex", BASE64: "base64" },
    digestStringAsync: jest.fn(async (algorithm: string, data: string, options?: { encoding?: string }) =>
      nodeCrypto
        .createHash(hashName(algorithm))
        .update(nodeBuffer().from(data, "utf8"))
        .digest(options?.encoding === "base64" ? "base64" : "hex")
    ),
    digest: jest.fn(async (algorithm: string, data: unknown) => {
      const out = nodeCrypto.createHash(hashName(algorithm)).update(toInput(data)).digest();
      const copy = new Uint8Array(out.byteLength);
      copy.set(out);
      return copy.buffer;
    }),
    randomUUID: jest.fn(() => nodeCrypto.randomUUID()),
    getRandomBytes: jest.fn((n: number) => new Uint8Array(nodeCrypto.randomBytes(n))),
    getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(nodeCrypto.randomBytes(n))),
    getRandomValues: jest.fn(<T extends ArrayBufferView>(array: T) => {
      nodeCrypto.randomFillSync(array as unknown as Uint8Array);
      return array;
    })
  };
}

/** r3f가 쓰던 옛 캐시 그림 이름(uuid v4 모양)인가. 명세 기대 동작 2의 "옛 방식 파일" 모양(확장자는 따로 본다). */
export const LEGACY_UUID_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/;

/** 캐시 폴더 아래(하위 폴더 포함)의 파일 주소들, 정렬 */
export function cacheFiles(): string[] {
  return [...fsState().files.keys()].filter((k) => k.startsWith(CACHE)).sort();
}

/** 캐시 폴더 아래에 쓴 주소들 */
export function cacheWrites(): string[] {
  return fsState().writes.filter((k) => k.startsWith(CACHE));
}
