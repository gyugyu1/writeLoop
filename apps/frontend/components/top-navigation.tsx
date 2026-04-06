"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

  const menuItems = currentUser
    ? [
        {
          href: "/",
          label: "Home",
          active: pathname === "/"
        },
        {
          href: "/me?tab=writing",
          label: "History",
          active: pathname === "/me" && currentTab === "writing",
          onClick: () => {
            setCurrentTab("writing");
            window.dispatchEvent(
              new CustomEvent("writeloop:tab-change", { detail: { tab: "writing" } })
            );
          }
        },
        {
          href: "/me?tab=account",
          label: "Profile",
          active: pathname === "/me" && currentTab !== "writing",
          onClick: () => {
            setCurrentTab("account");
            window.dispatchEvent(
              new CustomEvent("writeloop:tab-change", { detail: { tab: "account" } })
            );
          }
        },
        ...(currentUser.admin ? [{ href: "/admin", label: "Admin", active: pathname === "/admin" }] : [])
      ]
    : [
        {
          href: `/login?returnTo=${encodeURIComponent(returnTo)}`,
          label: "Login",
          active: pathname === "/login"
        },
        {
          href: `/register?returnTo=${encodeURIComponent(returnTo)}`,
          label: "Register",
          active: pathname === "/register"
        }
      ];

  return (
    <header className={styles.topBar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>
            <Image
              src="/brand-symbol.png"
              alt="writeLoop logo"
              width={48}
              height={48}
              className={styles.logoSymbol}
              priority
            />
          </span>
          <span className={styles.logoText}>writeLoop</span>
        </Link>
        <nav className={styles.menu} aria-label="Main navigation">
          {currentUser === undefined ? (
            <span className={styles.status}>Loading...</span>
          ) : (
            menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.active ? styles.menuLinkActive : styles.menuLink}
                onClick={item.onClick}
              >
                {item.label}
              </Link>
            ))
          )}
        </nav>
      </div>
    </header>
  );
}
