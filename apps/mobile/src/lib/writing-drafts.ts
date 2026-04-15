import * as SecureStore from "expo-secure-store";
import { getActiveStorageOwnerScope, isGuestStorageOwnerScope } from "./storage-owner";
import type { WritingDraft, WritingDraftType } from "./types";

const WRITING_DRAFT_KEY_PREFIX = "writeloop_mobile_draft";

type StoredWritingDraft = {
  ownerScope: string;
  draft: WritingDraft;
};

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
    if ("draft" in parsedValue && typeof parsedValue.ownerScope === "string") {
      return parsedValue.ownerScope === ownerScope ? parsedValue.draft : null;
    }

    return isGuestStorageOwnerScope(ownerScope) ? (parsedValue as WritingDraft) : null;
  } catch {
    await deleteLocalWritingDraft(promptId, draftType);
    return null;
  }
}

export async function deleteLocalWritingDraft(promptId: string, draftType: WritingDraftType) {
  await SecureStore.deleteItemAsync(buildDraftKey(promptId, draftType));
}
