// [spec] qa 테스트 도우미(작업 090-③ 옷 내려받기, 모바일). 테스트 파일이 아니다(이름이 .test로 끝나지 않아 Jest가 따로 돌리지 않는다).
// - 서버 아이템 목록 파일(apps/backend/src/main/resources/catalog/items.json)의 옷과 그 옆 files/의 실제 파일로
//   GET /api/catalog 응답 모양(assets의 url·sha256·bytes)을 만든다(서버 ItemCatalog와 같은 규칙: /api/catalog/files/<sha256>.<확장자>).
// - 가짜 expo-file-system(기기 파일·파일 받기). 090-② qa 테스트(furniture-download-home.spec)의 가짜와 같은 모양이다.
//   jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem()) 로 쓴다.
// 기대값은 넣지 않는다(입력과 관찰 도구만 둔다).
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

export const MOBILE_DIR = join(__dirname, "..", "..");
export const REPO_DIR = join(MOBILE_DIR, "..", "..");
export const SERVER_CATALOG_DIR = join(REPO_DIR, "apps", "backend", "src", "main", "resources", "catalog");
export const SERVER_FILES_DIR = join(SERVER_CATALOG_DIR, "files");

export interface FileRef {
  url: string;
  sha256: string;
  bytes: number;
}

export const sha256Of = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/** 서버 목록 폴더의 실제 파일로 만든 파일 참조(서버 응답과 같은 모양). */
export function serverRef(fileName: string): FileRef {
  const data = readFileSync(join(SERVER_FILES_DIR, fileName));
  const sha = sha256Of(data);
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return { url: `/api/catalog/files/${sha}.${ext}`, sha256: sha, bytes: data.length };
}

/** 이 테스트에서만 쓰는 가짜 파일 참조(내용 없는 해시). */
const FAKE_BYTES = new Map<string, number>();
let fakeBytes = 9000;
export function fakeRef(tag: string, ext: "glb" | "png"): FileRef {
  const sha = sha256Of(`qa-090-3-${tag}`);
  if (!FAKE_BYTES.has(sha)) {
    fakeBytes += 7;
    FAKE_BYTES.set(sha, fakeBytes);
  }
  return { url: `/api/catalog/files/${sha}.${ext}`, sha256: sha, bytes: FAKE_BYTES.get(sha)! };
}

interface RawItem {
  id: string;
  kind: string;
  name: string;
  shopName: string;
  description: string;
  category: string | null;
  price: number | null;
  slot?: string | null;
  draw?: Record<string, unknown>;
  files?: { model?: string; icon?: string };
}

/** 서버 목록 파일의 아이템(파일 그대로). */
export function rawServerItems(): RawItem[] {
  return (JSON.parse(readFileSync(join(SERVER_CATALOG_DIR, "items.json"), "utf8")) as { items: RawItem[] }).items;
}

/** 서버 목록 파일의 옷을 GET /api/catalog 응답 아이템 모양으로(파일이 없으면 assets null, draw가 없으면 null). */
export function serverWearableItems(): Record<string, unknown>[] {
  return rawServerItems()
    .filter((item) => item.kind === "wearable")
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      shopName: item.shopName,
      description: item.description,
      category: item.category,
      slot: item.slot ?? null,
      price: item.price,
      draw: item.draw ?? null,
      assets: item.files?.model ? { model: serverRef(item.files.model), icon: item.files.icon ? serverRef(item.files.icon) : null } : null
    }));
}

/** 그 옷의 응답 아이템(서버 목록 파일에서). */
export function serverWearable(id: string): Record<string, unknown> & { assets: { model: FileRef; icon: FileRef | null } | null } {
  const found = serverWearableItems().find((item) => item.id === id);
  if (!found) throw new Error(`서버 목록에 없는 옷: ${id}`);
  return found as Record<string, unknown> & { assets: { model: FileRef; icon: FileRef | null } | null };
}

/** 옷만 든 목록 응답(서버 목록 파일의 옷 그대로). */
export function serverWearCatalog(version = "qa-090-3-wear"): { version: string; items: Record<string, unknown>[] } {
  return { version, items: serverWearableItems() };
}

// ---------- 가짜 기기 파일 ----------

export type Reply = { bytes: number } | "fail" | "hold";

export const device = {
  /** 기기 파일 주소 → 크기. */
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  /** 받기를 부른 주소(차례대로). */
  downloads: [] as string[],
  /** 받아서 기기에 쓴 파일 주소. */
  writes: [] as string[],
  /** 서버 경로(/api/...) → 답. 답이 없으면 실패. */
  replies: new Map<string, Reply>(),
  held: new Map<string, { resolve: (bytes: number) => void; reject: (error: unknown) => void }>()
};

export const DOCUMENT_URI = "file:///qa-document/";
export const deviceUri = (ref: FileRef) => `${DOCUMENT_URI}item-files/${ref.sha256}.${ref.url.slice(ref.url.lastIndexOf(".") + 1)}`;
export const pathOf = (url: string) => url.slice(url.indexOf("/api/"));
export const downloadedPaths = () => device.downloads.map(pathOf);

export function resetDevice() {
  device.files.clear();
  device.dirs.clear();
  device.downloads.length = 0;
  device.writes.length = 0;
  device.replies.clear();
  device.held.clear();
}

/** 그 파일을 기기에 둔다(크기는 참조의 bytes, 따로 주면 그 크기). */
export function putOnDevice(ref: FileRef, size = ref.bytes) {
  device.files.set(deviceUri(ref), size);
}

/** 서버가 그 파일을 주게 한다(크기는 참조의 bytes, 따로 주면 그 크기). */
export function serve(ref: FileRef, bytes = ref.bytes) {
  device.replies.set(pathOf(ref.url), { bytes });
}

export function hold(ref: FileRef) {
  device.replies.set(pathOf(ref.url), "hold");
}

export function failDownload(ref: FileRef) {
  device.replies.set(pathOf(ref.url), "fail");
}

/** 붙잡아 둔 받기를 끝낸다(크기는 참조의 bytes). */
export function release(ref: FileRef, bytes = ref.bytes) {
  const waiting = device.held.get(pathOf(ref.url));
  if (!waiting) throw new Error(`붙잡아 둔 받기가 없다: ${ref.url}`);
  device.held.delete(pathOf(ref.url));
  waiting.resolve(bytes);
}

export function rejectHeld(ref: FileRef) {
  const waiting = device.held.get(pathOf(ref.url));
  if (!waiting) throw new Error(`붙잡아 둔 받기가 없다: ${ref.url}`);
  device.held.delete(pathOf(ref.url));
  waiting.reject(new Error("받지 못함(테스트 가짜)"));
}

function reply(url: string): Promise<number> {
  const path = pathOf(url);
  const answer = device.replies.get(path);
  if (answer === "hold") return new Promise((resolve, reject) => device.held.set(path, { resolve, reject }));
  if (!answer || answer === "fail") return Promise.reject(new Error(`받지 못함(테스트 가짜): ${path}`));
  return Promise.resolve(answer.bytes);
}

/** jest.mock("expo-file-system", ...)에 넘길 가짜 모듈. */
export function fakeExpoFileSystem() {
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
      return device.files.has(this.uri);
    }
    get size() {
      return device.files.get(this.uri) ?? 0;
    }
    delete() {
      device.files.delete(this.uri);
    }
    async bytes() {
      return new Uint8Array(0);
    }
    static async downloadFileAsync(url: string, destination: { uri: string }) {
      device.downloads.push(url);
      const bytes = await reply(url);
      const file = new File(destination.uri);
      device.files.set(file.uri, bytes);
      device.writes.push(file.uri);
      return file;
    }
  }
  class Directory {
    uri: string;
    constructor(parent: unknown, name: string) {
      this.uri = `${join2(parent, name)}/`;
    }
    get exists() {
      return device.dirs.has(this.uri) || [...device.files.keys()].some((key) => key.startsWith(this.uri));
    }
    create() {
      device.dirs.add(this.uri);
    }
    list() {
      return [...device.files.keys()].filter((key) => key.startsWith(this.uri)).map((key) => new File(key));
    }
  }
  return { File, Directory, Paths: { document: { uri: DOCUMENT_URI }, cache: { uri: "file:///qa-cache/" } } };
}

/** 서버 목록 파일의 옷이 가리키는 모델·그림 파일을 모두 기기에 둔다(이미 받아 둔 상태). */
export function putWearFilesOnDevice() {
  for (const item of serverWearableItems()) {
    const assets = item.assets as { model: FileRef; icon: FileRef | null } | null;
    if (!assets) continue;
    putOnDevice(assets.model);
    if (assets.icon) putOnDevice(assets.icon);
  }
}

// ---------- 시험용 목록 CAT-W(04-qa-scenarios "시험용 목록 CAT-W") ----------

export type CatWModel = "HAT_O" | "HAT_B" | "TOP" | "BOTTOM" | "SHOE" | "GLASSES" | "MUFFLER" | "BOWTIE" | "VEST" | "HAT2" | "CLOTH" | "NODRAW" | "PLAIN";

/** CAT-W 한 줄: id, 부위, 이름, draw(없으면 undefined), 모델, 아이콘 있음, 가격. */
const CAT_W_ROWS: [string, string, string, Record<string, unknown> | undefined, CatWModel | null, boolean, number | null][] = [
  ["capOrange", "hat", "주황 야구모자", { attach: "bone", bone: "head", body: 1 }, "HAT_O", true, 60],
  ["capBlue", "hat", "파랑 야구모자", { attach: "bone", bone: "head", body: 1 }, "HAT_B", true, 60],
  ["tshirtOrange", "top", "주황 티셔츠", { attach: "skin", body: 1 }, "TOP", true, 80],
  ["tshirtWhite", "top", "흰 티셔츠", { attach: "skin", color: "#F4F0E8", body: 1 }, "TOP", true, 80],
  ["shortsRed", "bottom", "빨강 반바지", { attach: "skin", color: "#C8443A", body: 1 }, "BOTTOM", true, 70],
  ["shoesBrown", "shoes", "갈색 운동화", { attach: "bone", bone: "foot_l", mirror: "foot_r", body: 1 }, "SHOE", true, 90],
  ["sunglassesBlack", "face", "검정 선글라스", { attach: "bone", bone: "head", body: 1 }, "GLASSES", true, 100],
  ["mufflerRed", "accessory", "빨강 머플러", { attach: "bone", bone: "spine", body: 1 }, "MUFFLER", true, 90],
  ["goggles", "face", "라룹이 고글", undefined, null, false, null],
  ["tshirtGreenQa", "top", "QA 초록 티", { attach: "skin", color: "#3A9A4A", body: 1 }, "TOP", true, 80],
  ["bowtieQa", "accessory", "QA 나비넥타이", { attach: "bone", bone: "spine", body: 1 }, "BOWTIE", true, 70],
  ["vestQa", "top", "QA 조끼", { attach: "skin", body: 1 }, "VEST", true, 50],
  ["hatBody2Qa", "hat", "QA 새 몸 모자", { attach: "bone", bone: "head", body: 2 }, "HAT2", true, 60],
  ["clothQa", "back", "QA 천 망토", { attach: "cloth", body: 1 }, "CLOTH", true, 60],
  ["noDrawQa", "hat", "QA 그림만 모자", undefined, "NODRAW", true, 60],
  ["plainQa", "accessory", "QA 무늬 없는 목걸이", { attach: "bone", bone: "spine", body: 1 }, "PLAIN", false, 60]
];

export interface CatW {
  catalog: { version: string; items: Record<string, unknown>[] };
  model: Record<CatWModel, FileRef>;
  icon: Record<string, FileRef>;
}

/** CAT-W를 만든다. tag가 다르면 해시가 다르다(받은 파일·읽은 모델이 모듈 안에 남으므로 테스트마다 새 tag를 쓴다). */
export function catW(tag: string, version = `w1-${tag}`): CatW {
  const model = {} as Record<CatWModel, FileRef>;
  for (const key of ["HAT_O", "HAT_B", "TOP", "BOTTOM", "SHOE", "GLASSES", "MUFFLER", "BOWTIE", "VEST", "HAT2", "CLOTH", "NODRAW", "PLAIN"] as CatWModel[]) {
    model[key] = fakeRef(`${tag}-model-${key}`, "glb");
  }
  const icon: Record<string, FileRef> = {};
  const items = CAT_W_ROWS.map(([id, slot, name, draw, modelKey, hasIcon, price]) => {
    if (hasIcon) icon[id] = fakeRef(`${tag}-icon-${id}`, "png");
    const item: Record<string, unknown> = {
      id,
      kind: "wearable",
      name,
      shopName: name,
      description: price === null ? "" : `${name} 설명이에요.`,
      category: price === null ? null : "clothes",
      slot,
      price,
      assets: modelKey ? { model: model[modelKey], icon: hasIcon ? icon[id] : null } : null
    };
    if (draw) item.draw = draw;
    return item;
  });
  return { catalog: { version, items }, model, icon };
}
