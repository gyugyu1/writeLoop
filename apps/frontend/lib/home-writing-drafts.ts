import type { HomeDraftSnapshot, WritingDraft, WritingDraftType } from "./types";

const HOME_WRITING_DRAFT_KEY_PREFIX = "writeloop_home_writing_draft";

function buildDraftKey(promptId: string, draftType: WritingDraftType) {
  return `${HOME_WRITING_DRAFT_KEY_PREFIX}:${promptId}:${draftType}`;
}

export function saveLocalWritingDraft(
  promptId: string,
  draftType: WritingDraftType,
  draft: HomeDraftSnapshot
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

  window.localStorage.setItem(buildDraftKey(promptId, draftType), JSON.stringify(payload));
}

export function getLocalWritingDraft(
  promptId: string,
  draftType: WritingDraftType
): WritingDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(buildDraftKey(promptId, draftType));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as WritingDraft;
  } catch {
    window.localStorage.removeItem(buildDraftKey(promptId, draftType));
    return null;
  }
}

export function getPreferredLocalWritingDraft(promptId: string): WritingDraft | null {
  return getLocalWritingDraft(promptId, "REWRITE") ?? getLocalWritingDraft(promptId, "ANSWER");
}

export function deleteLocalWritingDraft(promptId: string, draftType: WritingDraftType) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(buildDraftKey(promptId, draftType));
}
