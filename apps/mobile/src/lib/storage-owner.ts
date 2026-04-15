import * as SecureStore from "expo-secure-store";

const SESSION_USER_CACHE_KEY = "writeloop_session_user";
const GUEST_STORAGE_OWNER_SCOPE = "guest";
let activeOwnerScopeCache: string | null = null;

type CachedSessionUser = {
  id?: number | null;
};

function parseCachedSessionUser(rawValue: string | null): CachedSessionUser | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as CachedSessionUser;
  } catch {
    return null;
  }
}

export async function getActiveStorageOwnerScope() {
  if (activeOwnerScopeCache) {
    return activeOwnerScopeCache;
  }

  const rawValue = await SecureStore.getItemAsync(SESSION_USER_CACHE_KEY);
  const cachedUser = parseCachedSessionUser(rawValue);
  const userId = cachedUser?.id;

  activeOwnerScopeCache =
    typeof userId === "number" && Number.isFinite(userId) && userId > 0
    ? `user:${userId}`
    : GUEST_STORAGE_OWNER_SCOPE;

  return activeOwnerScopeCache;
}

export function isGuestStorageOwnerScope(ownerScope: string) {
  return ownerScope === GUEST_STORAGE_OWNER_SCOPE;
}

export function setActiveStorageOwnerScope(userId?: number | null) {
  activeOwnerScopeCache =
    typeof userId === "number" && Number.isFinite(userId) && userId > 0
      ? `user:${userId}`
      : GUEST_STORAGE_OWNER_SCOPE;
}
