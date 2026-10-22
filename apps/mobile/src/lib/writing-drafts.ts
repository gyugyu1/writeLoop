import * as SecureStore from "expo-secure-store";
import { getActiveStorageOwnerScope, resolveStoredOwnership } from "./storage-owner";
import { normalizeDailyDifficulty } from "./practice";
import type { WritingDraft, WritingDraftType } from "./types";

const WRITING_DRAFT_KEY_PREFIX = "writeloop_mobile_draft";

type StoredWritingDraft = {
  ownerScope: string;
  draft: WritingDraft;
};

function normalizeWritingDraft(draft: WritingDraft): WritingDraft {
  return {
    ...draft,
    selectedDifficulty: normalizeDailyDifficulty(draft.selectedDifficulty)
  };
}

function encodeKeyPart(value: string) {
  if (!value) {
    return "empty";
  }

  return Array.from(value, (char) =>
    (char.codePointAt(0) ?? 0).toString(16).padStart(6, "0")
  ).join("_");
}

function buildDraftKey(promptId: string, draftType: WritingDraftType) {
  return `${WRITING_DRAFT_KEY_PREFIX}.${encodeKeyPart(promptId)}.${draftType}`;
}

export async function saveLocalWritingDraft(draft: WritingDraft) {
  const ownerScope = await getActiveStorageOwnerScope();
  await SecureStore.setItemAsync(
    buildDraftKey(draft.promptId, draft.draftType),
    JSON.stringify({
      ownerScope,
      draft
    } satisfies StoredWritingDraft)
  );
}

export async function getLocalWritingDraft(
  promptId: string,
  draftType: WritingDraftType
): Promise<WritingDraft | null> {
  const ownerScope = await getActiveStorageOwnerScope();
  const raw = await SecureStore.getItemAsync(buildDraftKey(promptId, draftType));
  if (!raw) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(raw) as StoredWritingDraft | WritingDraft;
    const isScoped = "draft" in parsedValue && typeof parsedValue.ownerScope === "string";
    const storedDraft = isScoped
      ? (parsedValue as StoredWritingDraft).draft
      : (parsedValue as WritingDraft);
    const ownership = resolveStoredOwnership(
      isScoped ? (parsedValue as StoredWritingDraft).ownerScope : null,
      ownerScope
    );
    if (ownership === "other") {
      return null;
    }
    if (ownership === "claim") {
      await saveLocalWritingDraft(storedDraft);
    }
    return normalizeWritingDraft(storedDraft);
  } catch {
    await deleteLocalWritingDraft(promptId, draftType);
    return null;
  }
}

export async function deleteLocalWritingDraft(promptId: string, draftType: WritingDraftType) {
  await SecureStore.deleteItemAsync(buildDraftKey(promptId, draftType));
}
