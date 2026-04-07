"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "../lib/api";
import type { AuthUser } from "../lib/types";
import styles from "./top-navigation.module.css";

type MyPageTab = "account" | "writing";

function parseCurrentTab(): MyPageTab | "" {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "writing" ? "writing" : "account";
}

function buildReturnTo(pathname: string) {
  if (pathname === "/login" || pathname === "/register") {
    return "/";
  }

  if (typeof window === "undefined") {
    return pathname;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function getAvatarInitial(currentUser: AuthUser | null | undefined) {
  const initial = currentUser?.displayName?.trim().charAt(0);
  return initial ? initial.toUpperCase() : "W";
}

export function TopNavigation() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [currentTab, setCurrentTab] = useState<MyPageTab | "">("");

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
    }

    function syncCurrentTab() {
      if (pathname === "/me") {
        setCurrentTab(parseCurrentTab());
      } else {
        setCurrentTab("");
      }
    }

    function handleTabChange(event: Event) {
      const detail = (event as CustomEvent<{ tab?: MyPageTab }>).detail;
      setCurrentTab(detail?.tab === "writing" ? "writing" : "account");
    }

    syncCurrentTab();
    void loadCurrentUser();
    window.addEventListener("popstate", syncCurrentTab);
    window.addEventListener("writeloop:tab-change", handleTabChange);

    return () => {
      isMounted = false;
      window.removeEventListener("popstate", syncCurrentTab);
      window.removeEventListener("writeloop:tab-change", handleTabChange);
    };
  }, [pathname]);

  const returnTo = buildReturnTo(pathname);
  const accountHref = "/me?tab=account";
  const writingHref = "/me?tab=writing";
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;

  const menuItems = useMemo(() => {
    if (currentUser === undefined) {
      return [];
    }

    if (currentUser) {
      return [
        {
          href: "/",
          label: "레벨",
          active: pathname === "/"
        },
        {
          href: writingHref,
          label: "작문기록",
          active: pathname === "/me" && currentTab === "writing",
          onClick: () => {
            setCurrentTab("writing");
            window.dispatchEvent(
              new CustomEvent("writeloop:tab-change", { detail: { tab: "writing" } })
            );
          }
        },
        {
          href: accountHref,
          label: "내정보",
          active: pathname === "/me" && currentTab !== "writing",
          onClick: () => {
            setCurrentTab("account");
            window.dispatchEvent(
              new CustomEvent("writeloop:tab-change", { detail: { tab: "account" } })
            );
          }
        },
        ...(currentUser.admin
          ? [
              {
                href: "/admin",
                label: "관리",
                active: pathname === "/admin"
              }
            ]
          : [])
      ];
    }

    return [
      {
        href: "/",
        label: "레벨",
        active: pathname === "/"
      },
      {
        href: loginHref,
        label: "로그인",
        active: pathname === "/login"
      },
      {
        href: registerHref,
        label: "회원가입",
        active: pathname === "/register"
      }
    ];
  }, [accountHref, currentTab, currentUser, loginHref, pathname, registerHref, writingHref]);

  return (
    <header className={styles.topBar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          writeLoop
        </Link>

        <nav className={styles.menu} aria-label="Main navigation">
          {currentUser === undefined ? (
            <span className={styles.status}>불러오는 중</span>
          ) : (
            menuItems.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={item.active ? styles.menuLinkActive : styles.menuLink}
                onClick={item.onClick}
              >
                {item.label}
              </Link>
            ))
          )}
        </nav>

        <div className={styles.actions}>
          {currentUser ? (
            <Link href={accountHref} className={styles.avatarBadge} aria-label={`${currentUser.displayName} 프로필`}>
              <span className={styles.avatarInitial}>{getAvatarInitial(currentUser)}</span>
            </Link>
          ) : (
            <Link href={loginHref} className={styles.avatarBadge} aria-label="로그인하기">
              <span className={styles.avatarInitial}>W</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
