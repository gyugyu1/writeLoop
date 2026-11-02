import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveStorageOwnerScope } from "./storage-owner";

// 작성 중인 영어일기를 기기에 임시 저장한다. 뒤로 가기, 앱 종료, 다른 화면으로 이동해도 쓰던 글이 남게 한다.
// 일기는 길 수 있어서 값 하나에 약 2KB 제한이 있는 SecureStore 대신 AsyncStorage에 둔다.
// 키에 주인(사용자)을 넣어 다른 사용자에게 보이지 않게 한다.
export type DiaryDraft = {
  // 아직 서버에 저장하지 않은 새 일기는 빈 문자열
  entryId: string;
  entryDate: string;
  title: string;
  moodTags: string[];
  content: string;
  rewriteText: string;
  step: "write" | "rewrite";
  updatedAt: string;
};

const DIARY_DRAFT_KEY_PREFIX = "writeloop_diary_draft";

function buildDiaryDraftKey(ownerScope: string, entryId: string) {
  return `${DIARY_DRAFT_KEY_PREFIX}.${ownerScope}.${entryId || "new"}`;
}

function isDiaryDraft(value: unknown): value is DiaryDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const draft = value as Partial<DiaryDraft>;
  return (
    typeof draft.entryId === "string" &&
    typeof draft.entryDate === "string" &&
    typeof draft.title === "string" &&
    Array.isArray(draft.moodTags) &&
    typeof draft.content === "string" &&
    typeof draft.rewriteText === "string" &&
    (draft.step === "write" || draft.step === "rewrite")
  );
}

// 저장·읽기·지우기를 부른 순서대로 하나씩 실행한다. 화면은 이 함수들을 기다리지 않고 부르므로,
// 먼저 부른 저장이 나중에 부른 지우기보다 늦게 끝나 지운 임시본이 되살아나지 않게 한다.
// 화면이 바뀌어도 순서가 지켜지도록 모듈에 하나만 둔다.
let pendingDraftOperation: Promise<unknown> = Promise.resolve();

function runInCallOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingDraftOperation.then(operation);
  pendingDraftOperation = result.catch(() => undefined);
  return result;
}

export function saveDiaryDraft(draft: DiaryDraft) {
  return runInCallOrder(async () => {
    const ownerScope = await getActiveStorageOwnerScope();
    await AsyncStorage.setItem(buildDiaryDraftKey(ownerScope, draft.entryId), JSON.stringify(draft));
  });
}

export function getDiaryDraft(entryId: string): Promise<DiaryDraft | null> {
  return runInCallOrder(async () => {
    const ownerScope = await getActiveStorageOwnerScope();
    const key = buildDiaryDraftKey(ownerScope, entryId);
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (isDiaryDraft(parsed)) {
        return parsed;
      }
    } catch {
      // 읽을 수 없는 임시본은 지운다.
    }
    await AsyncStorage.removeItem(key);
    return null;
  });
}

export function deleteDiaryDraft(entryId: string) {
  return runInCallOrder(async () => {
    const ownerScope = await getActiveStorageOwnerScope();
    await AsyncStorage.removeItem(buildDiaryDraftKey(ownerScope, entryId));
  });
}
