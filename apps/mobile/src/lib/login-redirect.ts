import type { Href } from "expo-router";

const DEFAULT_POST_LOGIN_ROUTE: Href = "/";

function normalizeRedirectTo(redirectTo?: string | string[]) {
  if (Array.isArray(redirectTo)) {
    return redirectTo[0]?.trim() ?? "";
  }

  return redirectTo?.trim() ?? "";
}

export function buildLoginHref(redirectTo: string): Href {
  return `/login?redirectTo=${encodeURIComponent(redirectTo)}` as Href;
}

export function resolvePostLoginHref(redirectTo?: string | string[]): Href {
  const nextRoute = normalizeRedirectTo(redirectTo);
  if (!nextRoute || !nextRoute.startsWith("/") || nextRoute.startsWith("//")) {
    return DEFAULT_POST_LOGIN_ROUTE;
  }

  return nextRoute as Href;
}
