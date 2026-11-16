import { NavigationContext } from "@react-navigation/native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useContext } from "react";

// 로그인 관련 화면(루트 Stack의 화면 이름). 로그인·가입을 마치고 갈 곳으로 갈 때 쌓임에서 모두 치운다.
const AUTH_ROUTES = new Set(["login", "forgot-password", "signup", "social-signup"]);

type StackState = { index?: number; routes: { name: string; key?: string }[] };
export type AuthNavigation = { getState?: () => StackState | undefined; isFocused?: () => boolean } | undefined;

/** 이 화면이 든 Stack의 navigation. 화면 밖(테스트의 가짜 router 등)에서는 undefined다. */
export function useAuthNavigation(): AuthNavigation {
  return useContext(NavigationContext) as AuthNavigation;
}

/** 이 화면이 지금 맨 위(보이는) 화면인가. 알 수 없으면 true. */
export function isTopScreen(navigation: AuthNavigation): boolean {
  try {
    return navigation?.isFocused?.() ?? true;
  } catch {
    return true;
  }
}

function readStack(navigation: AuthNavigation) {
  try {
    const state = navigation?.getState?.();
    if (!state || !Array.isArray(state.routes)) return null;
    return state.routes.slice(0, (state.index ?? state.routes.length - 1) + 1);
  } catch {
    return null;
  }
}

// href의 경로를 루트 Stack 화면 이름으로("/" → "index", "/records" → "records"). 물음표 뒤 값이 있으면 null(같은 화면이라 보지 않는다).
function routeNameOf(href: Href): string | null {
  if (typeof href !== "string" || href.includes("?")) return null;
  const path = href.replace(/^\/+/, "").replace(/\/+$/, "");
  return path === "" ? "index" : path;
}

// 마지막으로 치운 맨 위 화면. 같은 화면에서 버튼과 효과가 잇달아 부르면(쌓임이 아직 바뀌기 전) 한 번만 치운다.
let lastLeftKey: string | undefined;

/**
 * 로그인·가입을 마치고 갈 곳(href)으로 간다. 맨 위에 쌓인 로그인 관련 화면을 모두 치워,
 * 그 뒤 Android 뒤로를 눌러도 로그인 화면이 다시 나오지 않게 한다.
 * - 치운 아래 화면이 갈 곳과 같으면 그 화면으로 돌아간다(같은 화면을 둘 쌓지 않는다).
 * - 아니면 맨 아래 로그인 화면 하나만 남기고 치운 뒤 그 화면을 갈 곳으로 바꾼다.
 * - 쌓임을 읽지 못하면(화면 밖) 지금처럼 맨 위 화면을 갈 곳으로 바꾼다.
 * - 이미 로그인 화면을 떠났으면(맨 위가 로그인 관련 화면이 아님) 아무것도 하지 않는다.
 */
export function leaveAuthScreens(navigation: AuthNavigation, href: Href) {
  const routes = readStack(navigation);
  if (!routes) {
    router.replace(href);
    return;
  }
  let count = 0;
  for (let i = routes.length - 1; i >= 0 && AUTH_ROUTES.has(routes[i].name); i -= 1) count += 1;
  if (count === 0) return;
  const topKey = routes[routes.length - 1].key;
  if (topKey !== undefined && topKey === lastLeftKey) return;
  lastLeftKey = topKey;
  const canDismiss = typeof router.dismiss === "function";
  const below = routes[routes.length - 1 - count];
  if (canDismiss && below && below.name === routeNameOf(href)) {
    router.dismiss(count);
    return;
  }
  if (canDismiss && count > 1) router.dismiss(count - 1);
  router.replace(href);
}
