import * as SecureStore from "expo-secure-store";

const GUEST_ID_KEY = "writeloop_guest_id";
const GUEST_INSTALLATION_KEY = "writeloop_guest_installation_id";

function getCryptoRandomUuid() {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return cryptoRef?.randomUUID?.() ?? null;
}

function createOpaqueInstallationId() {
  return (
    getCryptoRandomUuid() ??
    [
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 14),
      Math.random().toString(36).slice(2, 14)
    ].join("-")
  ).toLowerCase();
}

function isValidGuestId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^guest-[a-z0-9-]{18,120}$/.test(value.trim().toLowerCase());
}

async function getOrCreateInstallationId() {
  const existing = await SecureStore.getItemAsync(GUEST_INSTALLATION_KEY);
  if (existing) {
    return existing.toLowerCase();
  }

  const next = createOpaqueInstallationId();
  await SecureStore.setItemAsync(GUEST_INSTALLATION_KEY, next);
  return next;
}

export async function getOrCreateGuestId() {
  const existing = await SecureStore.getItemAsync(GUEST_ID_KEY);
  if (isValidGuestId(existing)) {
    return existing.toLowerCase();
  }

  const installationId = await getOrCreateInstallationId();
  const next = `guest-${installationId}`;
  await SecureStore.setItemAsync(GUEST_ID_KEY, next);
  return next;
}
