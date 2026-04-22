import type { HomeDraftSnapshot } from "./types";
import { normalizeDailyDifficulty } from "./difficulty";

const HOME_DRAFT_KEY = "writeloop_post_login_home_draft";

export type HomeDraft = HomeDraftSnapshot;

function normalizeHomeDraft(draft: HomeDraft): HomeDraft {
  return {
    ...draft,
    selectedDifficulty: normalizeDailyDifficulty(draft.selectedDifficulty)
  };
}

export function resolveReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

export function saveHomeDraftForLogin(draft: HomeDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(HOME_DRAFT_KEY, JSON.stringify(draft));
}

export function takeHomeDraftForLogin(): HomeDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(HOME_DRAFT_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(HOME_DRAFT_KEY);

  try {
    return normalizeHomeDraft(JSON.parse(raw) as HomeDraft);
  } catch {
    return null;
  }
}

export function clearHomeDraftForLogin() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(HOME_DRAFT_KEY);
}
