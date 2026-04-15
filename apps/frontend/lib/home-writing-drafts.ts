import type { HomeDraftSnapshot, WritingDraft, WritingDraftType } from "./types";

const HOME_WRITING_DRAFT_KEY_PREFIX = "writeloop_home_writing_draft";

function buildDraftKey(promptId: string, draftType: WritingDraftType, ownerId?: number | null) {
  const ownerScope =
    typeof ownerId === "number" && Number.isFinite(ownerId) && ownerId > 0
      ? `user:${ownerId}`
      : "guest";
  return `${HOME_WRITING_DRAFT_KEY_PREFIX}:${ownerScope}:${promptId}:${draftType}`;
}

export function saveLocalWritingDraft(
  promptId: string,
  draftType: WritingDraftType,
  draft: HomeDraftSnapshot,
  ownerId?: number | null
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: WritingDraft = {
    promptId,
    draftType,
    updatedAt: new Date().toISOString(),
    ...draft
  };

  window.localStorage.setItem(buildDraftKey(promptId, draftType, ownerId), JSON.stringify(payload));
}

export function getLocalWritingDraft(
  promptId: string,
  draftType: WritingDraftType,
  ownerId?: number | null
): WritingDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(buildDraftKey(promptId, draftType, ownerId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as WritingDraft;
  } catch {
    window.localStorage.removeItem(buildDraftKey(promptId, draftType, ownerId));
    return null;
  }
}

export function getPreferredLocalWritingDraft(promptId: string, ownerId?: number | null): WritingDraft | null {
  return getLocalWritingDraft(promptId, "REWRITE", ownerId) ?? getLocalWritingDraft(promptId, "ANSWER", ownerId);
}

export function deleteLocalWritingDraft(promptId: string, draftType: WritingDraftType, ownerId?: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(buildDraftKey(promptId, draftType, ownerId));
}

export function clearAllLocalWritingDrafts() {
  if (typeof window === "undefined") {
    return;
  }

  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(`${HOME_WRITING_DRAFT_KEY_PREFIX}:`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
