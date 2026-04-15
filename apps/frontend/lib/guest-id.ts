const GUEST_ID_KEY = "writeloop_guest_id";
const GUEST_ID_COOKIE = "writeloop_guest_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function isValidGuestId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^guest-[a-z0-9-]{18,120}$/.test(value.trim().toLowerCase());
}

function createGuestId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `guest-${uuid}`;
  }

  return [
    "guest",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 14),
    Math.random().toString(36).slice(2, 14)
  ].join("-");
}

function readCookieGuestId() {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GUEST_ID_COOKIE}=`))
    ?.slice(GUEST_ID_COOKIE.length + 1);

  return cookieValue ? decodeURIComponent(cookieValue) : null;
}

function writeCookieGuestId(guestId: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${GUEST_ID_COOKIE}=${encodeURIComponent(guestId)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function writeLocalGuestId(guestId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GUEST_ID_KEY, guestId);
}

export function getOrCreateGuestId() {
  if (typeof window === "undefined") {
    return "";
  }

  const localGuestId = window.localStorage.getItem(GUEST_ID_KEY);
  const cookieGuestId = readCookieGuestId();

  if (isValidGuestId(localGuestId)) {
    writeCookieGuestId(localGuestId);
    return localGuestId;
  }

  if (isValidGuestId(cookieGuestId)) {
    writeLocalGuestId(cookieGuestId);
    return cookieGuestId;
  }

  const nextGuestId = createGuestId().toLowerCase();
  writeLocalGuestId(nextGuestId);
  writeCookieGuestId(nextGuestId);
  return nextGuestId;
}
