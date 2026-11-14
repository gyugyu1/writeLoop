import { useSyncExternalStore } from "react";
import { apiBaseUrl } from "./env";

// 아이템 모델·아이콘 파일을 서버(GET /api/catalog/files/...)에서 받아 기기에 남긴다(계정과 무관한 캐시라 손님도 남긴다).
// 파일 이름은 내용 SHA-256이라, 한 번 받은 파일은 다시 받지 않고 서버가 파일을 바꾸면 새 이름으로 받는다.
// 받은 파일이 바뀌면(새로 받음·지움) 구독한 화면에 알린다. 파일 시스템은 쓸 때만 불러온다(시험 환경에서 이 모듈을 가볍게 불러오려고).

export interface ItemFileRef {
  /** 서버 주소(앞이 /면 API 주소에 붙인다). */
  url: string;
  sha256: string;
  bytes: number;
}

const FOLDER = "item-files";
const SHA = /^[0-9a-f]{64}$/;

const listeners = new Set<() => void>();
let tick = 0;
/** 받은 파일(해시 → 기기 주소). */
const ready = new Map<string, string>();
/** 받는 중인 파일(해시 → 끝나면 기기 주소, 실패면 null). */
const pending = new Map<string, Promise<string | null>>();
/** 이번 실행에서 받기에 실패한 파일(다시 홈이 보일 때 retryFailedItemFiles로 다시 받는다). */
const failed = new Set<string>();

function notify() {
  tick += 1;
  listeners.forEach((listener) => listener());
}

type FileSystem = typeof import("expo-file-system");

function fileSystem(): FileSystem | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-file-system") as FileSystem;
  } catch {
    return null;
  }
}

function extensionOf(ref: ItemFileRef): string {
  const match = /\.([a-z0-9]+)$/i.exec(ref.url);
  return match ? match[1].toLowerCase() : "bin";
}

function fileFor(fs: FileSystem, ref: ItemFileRef) {
  const folder = new fs.Directory(fs.Paths.document, FOLDER);
  return { folder, file: new fs.File(folder, `${ref.sha256}.${extensionOf(ref)}`) };
}

/** 이미 기기에 있는 그 파일의 주소. 없으면 null(받지 않는다). */
export function cachedItemFile(ref: ItemFileRef | null | undefined): string | null {
  if (!ref || !SHA.test(ref.sha256)) return null;
  const known = ready.get(ref.sha256);
  if (known) return known;
  const fs = fileSystem();
  if (!fs) return null;
  try {
    const { file } = fileFor(fs, ref);
    if (file.exists && file.size === ref.bytes) {
      ready.set(ref.sha256, file.uri);
      return file.uri;
    }
  } catch {
    // 없는 것으로 본다
  }
  return null;
}

/** 그 파일을 기기에 둔다(이미 있으면 그대로). 끝나면 기기 주소, 받지 못하면 null. 같은 파일을 동시에 두 번 받지 않는다. */
export function fetchItemFile(ref: ItemFileRef | null | undefined): Promise<string | null> {
  if (!ref || !SHA.test(ref.sha256)) return Promise.resolve(null);
  const cached = cachedItemFile(ref);
  if (cached) return Promise.resolve(cached);
  const running = pending.get(ref.sha256);
  if (running) return running;
  const job = (async () => {
    const fs = fileSystem();
    if (!fs) return null;
    try {
      const { folder, file } = fileFor(fs, ref);
      if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
      if (file.exists) file.delete();
      const url = ref.url.startsWith("/") ? `${apiBaseUrl}${ref.url}` : ref.url;
      const saved = await fs.File.downloadFileAsync(url, file);
      if (saved.size !== ref.bytes) {
        saved.delete();
        throw new Error(`size mismatch ${saved.size} != ${ref.bytes}`);
      }
      ready.set(ref.sha256, saved.uri);
      failed.delete(ref.sha256);
      return saved.uri;
    } catch {
      failed.add(ref.sha256);
      return null;
    } finally {
      pending.delete(ref.sha256);
    }
  })();
  pending.set(ref.sha256, job);
  void job.then((uri) => {
    if (uri) notify();
  });
  return job;
}

/** 이번 실행에서 받다 실패한 파일인지(자리 표시를 계속 보이고, 다음에 홈이 보일 때 다시 받는다). */
export function itemFileFailed(ref: ItemFileRef | null | undefined): boolean {
  return Boolean(ref && failed.has(ref.sha256));
}

/** 실패 기록을 지운다(홈이 다시 보일 때 부른다. 다음에 필요할 때 다시 받는다). */
export function retryFailedItemFiles(): void {
  if (failed.size === 0) return;
  failed.clear();
  notify();
}

/** 지금 목록에 없는 해시의 파일을 기기에서 지운다(받은 목록이 바뀌었을 때). */
export function pruneItemFiles(keep: ReadonlySet<string>): void {
  const fs = fileSystem();
  if (!fs) return;
  try {
    const folder = new fs.Directory(fs.Paths.document, FOLDER);
    if (!folder.exists) return;
    for (const entry of folder.list()) {
      const sha = entry.name.replace(/\.[^.]+$/, "");
      if (keep.has(sha) || pending.has(sha)) continue;
      entry.delete();
      ready.delete(sha);
    }
  } catch {
    // 다음에 다시 지운다
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => tick;

/** 받은 파일이 바뀌면 다시 그리게 한다. */
export function useItemFiles(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
