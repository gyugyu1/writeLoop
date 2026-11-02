// [spec] qa 재현 테스트(작업 049 버그 수정 APP-ETC-103: 기기 임시본 저장이 지우기보다 늦게 끝나 지운 임시본이 되살아나는 버그).
// 임시본 모듈(src/lib/diary-drafts.ts)의 저장(saveDiaryDraft)·읽기(getDiaryDraft)·지우기(deleteDiaryDraft)를 직접 불러,
// 명세의 고친 뒤 동작을 확인한다.
// - 부른 순서대로 하나씩 실행된다. 앞에 부른 것이 끝난 뒤 다음 것이 AsyncStorage에 닿는다.
// - 저장 뒤에 부른 지우기는 그 저장을 지우고, 지우기 뒤에 부른 저장은 남는다. 읽기는 앞서 부른 저장·지우기가 끝난 뒤의 값을 읽는다.
// - 앞의 작업이 실패해도 뒤의 작업은 실행되고, 각 함수의 결과(성공·실패, 돌려주는 값)는 지금과 같다.
// AsyncStorage는 메모리 저장소로 대신한다. hold(op)로 그 종류의 다음 호출 하나를 붙잡아 두면, 풀 때(resolve) 저장소에 반영하고
// 거부할 때(reject) 반영하지 않고 실패한다. 붙잡지 않은 호출은 부르는 순간 반영한다.
// 주인 범위(@/lib/storage-owner)는 "user:7"을 돌려주는 가짜로 둔다. 키 모양은 지금 코드의 `writeloop_diary_draft.<주인>.<entryId 또는 new>`다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteDiaryDraft, getDiaryDraft, saveDiaryDraft, type DiaryDraft } from "@/lib/diary-drafts";

type StorageOp = "getItem" | "setItem" | "removeItem";
type Hold = { promise: Promise<void>; resolve: () => void; reject: (reason: unknown) => void };
type MemoryStorageControl = {
  store: Map<string, string>;
  hold: (op: StorageOp) => Hold;
  reset: () => void;
};

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const holds: Record<string, { promise: Promise<void>; resolve: () => void; reject: (reason: unknown) => void }[]> = {
    getItem: [],
    setItem: [],
    removeItem: []
  };
  async function waitFor(op: string) {
    const next = holds[op].shift();
    if (next) {
      await next.promise;
    }
  }
  const control = {
    store,
    hold(op: string) {
      let resolve!: () => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // 거부한 붙잡기가 처리되지 않은 거부로 잡히지 않게 한다(실제 호출은 promise를 그대로 기다린다).
      promise.catch(() => undefined);
      const held = { promise, resolve, reject };
      holds[op].push(held);
      return held;
    },
    reset() {
      store.clear();
      Object.values(holds).forEach((list) => {
        list.length = 0;
      });
    }
  };
  const storage = {
    getItem: jest.fn(async (key: string) => {
      await waitFor("getItem");
      return store.has(key) ? (store.get(key) as string) : null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      await waitFor("setItem");
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      await waitFor("removeItem");
      store.delete(key);
    }),
    __control: control
  };
  return { __esModule: true, default: storage };
});
jest.mock("@/lib/storage-owner", () => ({
  getActiveStorageOwnerScope: jest.fn(async () => "user:7")
}));

const control = (AsyncStorage as unknown as { __control: MemoryStorageControl }).__control;
const NEW_KEY = "writeloop_diary_draft.user:7.new";
const ENTRY_KEY = "writeloop_diary_draft.user:7.entry-1";

function draft(overrides: Partial<DiaryDraft> = {}): DiaryDraft {
  return {
    entryId: "",
    entryDate: "2026-11-02",
    title: "2026년 11월 2일의 일기",
    moodTags: ["calm"],
    content: "I went home.",
    rewriteText: "",
    step: "write",
    updatedAt: "2026-11-02T12:00:00.000Z",
    ...overrides
  };
}

// 붙잡지 않은 약속이 모두 진행되게 한다.
async function settle() {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  control.reset();
  jest.mocked(AsyncStorage.getItem).mockClear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  jest.mocked(AsyncStorage.removeItem).mockClear();
});

describe("[spec] 임시본 저장·읽기·지우기의 순서(APP-ETC-103)", () => {
  it("[spec] 먼저 부른 저장이 늦게 끝나도 뒤에 부른 지우기가 이긴다(지운 뒤 읽으면 없음)", async () => {
    const heldSave = control.hold("setItem");
    const saving = saveDiaryDraft(draft());
    const deleting = deleteDiaryDraft("");
    await settle();

    heldSave.resolve();
    await Promise.all([saving, deleting]);

    expect(control.store.has(NEW_KEY)).toBe(false);
    await expect(getDiaryDraft("")).resolves.toBeNull();
  });

  it("[spec] 먼저 부른 지우기가 늦게 끝나도 뒤에 부른 저장은 남는다", async () => {
    const oldDraft = draft({ entryId: "entry-1", content: "Old text." });
    const nextDraft = draft({ entryId: "entry-1", content: "New text after delete." });
    control.store.set(ENTRY_KEY, JSON.stringify(oldDraft));
    const heldDelete = control.hold("removeItem");
    const deleting = deleteDiaryDraft("entry-1");
    const saving = saveDiaryDraft(nextDraft);
    await settle();

    heldDelete.resolve();
    await Promise.all([deleting, saving]);

    expect(control.store.get(ENTRY_KEY)).toBe(JSON.stringify(nextDraft));
    await expect(getDiaryDraft("entry-1")).resolves.toEqual(nextDraft);
  });

  it("[spec] 읽기는 앞서 부른 저장이 끝난 뒤의 값을 읽는다", async () => {
    const savedDraft = draft();
    const heldSave = control.hold("setItem");
    const saving = saveDiaryDraft(savedDraft);
    const reading = getDiaryDraft("");
    await settle();

    heldSave.resolve();
    await saving;

    await expect(reading).resolves.toEqual(savedDraft);
  });

  it("[spec] 읽기는 앞서 부른 지우기가 끝난 뒤의 값을 읽는다(지운 임시본은 읽히지 않는다)", async () => {
    control.store.set(NEW_KEY, JSON.stringify(draft()));
    const heldDelete = control.hold("removeItem");
    const deleting = deleteDiaryDraft("");
    const reading = getDiaryDraft("");
    await settle();

    heldDelete.resolve();
    await deleting;

    await expect(reading).resolves.toBeNull();
    expect(control.store.has(NEW_KEY)).toBe(false);
  });

  it("[spec] 앞에 부른 것이 끝나기 전에는 다음 것이 AsyncStorage에 닿지 않는다(다른 일기의 지우기도 마찬가지)", async () => {
    const heldSave = control.hold("setItem");
    const saving = saveDiaryDraft(draft());
    const deleting = deleteDiaryDraft("entry-1");
    await settle();

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    heldSave.resolve();
    await Promise.all([saving, deleting]);

    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ENTRY_KEY);
    expect(control.store.get(NEW_KEY)).toBe(JSON.stringify(draft()));
  });

  it("[spec] 앞의 저장이 실패해도 뒤에 부른 읽기는 그 뒤에 실행되고, 저장은 지금처럼 실패를 돌려준다", async () => {
    const oldDraft = draft({ content: "Stored before." });
    control.store.set(NEW_KEY, JSON.stringify(oldDraft));
    const failingSave = control.hold("setItem");
    const saving = saveDiaryDraft(draft({ content: "Will fail." }));
    const reading = getDiaryDraft("");
    await settle();

    // 저장이 끝나기 전이라 읽기는 아직 AsyncStorage에 닿지 않는다.
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();

    failingSave.reject(new Error("disk full"));
    await expect(saving).rejects.toThrow("disk full");
    await expect(reading).resolves.toEqual(oldDraft);
  });

  it("[spec] 앞의 지우기가 실패해도 뒤에 부른 저장은 그 뒤에 실행되어 남고, 지우기는 지금처럼 실패를 돌려준다", async () => {
    control.store.set(NEW_KEY, JSON.stringify(draft({ content: "Stored before." })));
    const nextDraft = draft({ content: "Saved after failed delete." });
    const failingDelete = control.hold("removeItem");
    const deleting = deleteDiaryDraft("");
    const saving = saveDiaryDraft(nextDraft);
    await settle();

    // 지우기가 끝나기 전이라 저장은 아직 AsyncStorage에 닿지 않는다.
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    failingDelete.reject(new Error("remove failed"));
    await expect(deleting).rejects.toThrow("remove failed");
    await expect(saving).resolves.toBeUndefined();
    expect(control.store.get(NEW_KEY)).toBe(JSON.stringify(nextDraft));
  });
});
