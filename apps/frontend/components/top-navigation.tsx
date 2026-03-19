"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "../lib/api";
import type { AuthUser } from "../lib/types";
import styles from "./top-navigation.module.css";

function buildReturnTo(pathname: string) {
  if (pathname === "/login" || pathname === "/register") {
    return "/";
  }

  return pathname;
}

export function TopNavigation() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);

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

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const returnTo = buildReturnTo(pathname);

  const menuItems = currentUser
    ? [
        ...(currentUser.admin ? [{ href: "/admin", label: "관리" }] : []),
        { href: "/me", label: "내정보" }
      ]
    : [
        {
          href: `/login?returnTo=${encodeURIComponent(returnTo)}`,
          label: "로그인"
        },
        {
          href: `/register?returnTo=${encodeURIComponent(returnTo)}`,
          label: "회원가입"
        }
      ];

  return (
    <header className={styles.topBar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>W</span>
          <span className={styles.logoText}>writeLoop</span>
        </Link>
        <nav className={styles.menu} aria-label="상단 메뉴">
          {currentUser === undefined ? (
            <span className={styles.status}>확인 중...</span>
          ) : (
            menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? styles.menuLinkActive : styles.menuLink}
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
