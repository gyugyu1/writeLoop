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

// 저장된 항목을 지금 사용자에게 보여 줄지 정한다.
// - owned: 지금 주인의 항목
// - claim: 이 기기에서 게스트로 저장한 항목. 로그인한 사용자가 이어받으므로, 주인을 바꿔 다시 저장한 뒤 보여 준다.
//   서버도 guestId를 함께 받으면 게스트 세션을 이 사용자에게 넘겨준다.
// - other: 다른 사용자의 항목
// storedOwnerScope가 null이면 주인을 적지 않던 예전 형식이라 게스트 항목으로 본다.
export function resolveStoredOwnership(
  storedOwnerScope: string | null,
  activeOwnerScope: string
): "owned" | "claim" | "other" {
  if (storedOwnerScope === activeOwnerScope) {
    return "owned";
  }
  if (storedOwnerScope === null || isGuestStorageOwnerScope(storedOwnerScope)) {
    return isGuestStorageOwnerScope(activeOwnerScope) ? "owned" : "claim";
  }
  return "other";
}

export function setActiveStorageOwnerScope(userId?: number | null) {
  activeOwnerScopeCache =
    typeof userId === "number" && Number.isFinite(userId) && userId > 0
      ? `user:${userId}`
      : GUEST_STORAGE_OWNER_SCOPE;
}
