import * as SecureStore from "expo-secure-store";

const GUEST_ID_KEY = "writeloop_guest_id";

function createGuestId() {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOrCreateGuestId() {
  const existing = await SecureStore.getItemAsync(GUEST_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createGuestId();
  await SecureStore.setItemAsync(GUEST_ID_KEY, next);
  return next;
}
