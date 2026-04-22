"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  completeSocialRegistration,
  getPendingSocialRegistration
} from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

function getProviderLabel(provider: string) {
  switch ((provider ?? "").trim().toUpperCase()) {
    case "NAVER":
      return "네이버";
    case "GOOGLE":
      return "Google";
    case "KAKAO":
      return "카카오";
    default:
      return "소셜";
  }
}

export function SocialSignupPageClient() {
  const [token, setToken] = useState("");
  const [returnTo, setReturnTo] = useState("/");
  const [providerLabel, setProviderLabel] = useState("소셜");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPendingSocialRegistration() {
      const params = new URLSearchParams(window.location.search);
      const nextToken = params.get("token")?.trim() ?? "";
      const nextReturnTo = resolveReturnTo(params.get("returnTo"));

      setToken(nextToken);
      setReturnTo(nextReturnTo);

      if (!nextToken) {
        if (isMounted) {
          setError("소셜 가입 정보를 찾지 못했어요. 다시 로그인해 주세요.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const pending = await getPendingSocialRegistration(nextToken);
        if (!isMounted) {
          return;
        }
        setProviderLabel(getProviderLabel(pending.provider));
        setDisplayName((current) => current || pending.suggestedDisplayName || "");
        setNotice(`${getProviderLabel(pending.provider)} 계정으로 가입을 이어갈게요.`);
        setReturnTo(resolveReturnTo(pending.returnTo || nextReturnTo));
      } catch (caughtError: unknown) {
        if (!isMounted) {
          return;
        }
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "소셜 가입 정보를 불러오지 못했어요."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPendingSocialRegistration();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginHref = useMemo(
    () => `/login?returnTo=${encodeURIComponent(returnTo)}`,
    [returnTo]
  );

  async function handleCompleteSocialSignup() {
    if (!token) {
      setError("소셜 가입 정보를 찾지 못했어요. 다시 로그인해 주세요.");
      return;
    }

    if (!displayName.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await completeSocialRegistration({
        token,
        displayName: displayName.trim()
      });
      window.location.assign(returnTo);
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "소셜 회원가입을 완료하지 못했어요."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`${styles.page} ${styles.authShell} ${styles.loginPage} ${styles.registerPage}`}>
      <section className={styles.loginHero}>
        <div className={styles.loginPageTitleWrap}>
          <h1 className={styles.loginPageTitle}>닉네임 설정</h1>
        </div>

        <section className={`${styles.loginPanel} ${styles.registerPanel}`}>
          <div className={`${styles.form} ${styles.loginForm} ${styles.registerForm}`}>
            <p className={styles.subText}>
              {providerLabel} 로그인은 거의 끝났어요. 먼저 사용할 닉네임을 정해 주세요.
            </p>

            <label className={`${styles.field} ${styles.loginField} ${styles.registerField}`}>
              <span>닉네임</span>
              <input
                className={styles.input}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="앱에서 사용할 닉네임을 입력해 주세요."
                disabled={isLoading || isSubmitting}
              />
            </label>

            {notice ? <p className={styles.notice}>{notice}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.registerPrimaryActionRow}>
              <button
                type="button"
                className={`${styles.primaryButton} ${styles.primaryButtonWide}`}
                onClick={() => void handleCompleteSocialSignup()}
                disabled={isLoading || isSubmitting}
              >
                {isLoading ? "불러오는 중..." : isSubmitting ? "처리 중..." : "가입 완료"}
              </button>
            </div>

            <div className={styles.registerSecondaryActions}>
              <p className={styles.registerLoginPrompt}>
                다시 로그인부터 시작할까요?
                <Link href={loginHref} className={styles.loginRegisterLink}>
                  로그인
                </Link>
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
