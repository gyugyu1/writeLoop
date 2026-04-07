"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, login, resendVerification, verifyEmail } from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const SAVED_LOGIN_ID_KEY = "writeloop_saved_login_id";

export function LoginPageClient() {
  const [returnTo, setReturnTo] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [saveLoginId, setSaveLoginId] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(resolveReturnTo(params.get("returnTo")));

    if (params.get("reset") === "done") {
      setNotice("비밀번호를 재설정했어요. 새 비밀번호로 로그인해 주세요.");
    }

    try {
      const savedLoginId = window.localStorage.getItem(SAVED_LOGIN_ID_KEY)?.trim() ?? "";
      if (savedLoginId) {
        setEmail(savedLoginId);
        setPendingEmail(savedLoginId);
        setSaveLoginId(true);
      }
    } catch {
      // Ignore storage access issues and keep the login form usable.
    } finally {
      setIsStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    try {
      if (saveLoginId && email.trim()) {
        window.localStorage.setItem(SAVED_LOGIN_ID_KEY, email.trim());
        return;
      }
      window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
    } catch {
      // Ignore storage access issues and keep the login flow usable.
    }
  }, [email, isStorageReady, saveLoginId]);

  const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;
  const forgotPasswordHref = `/forgot-password?returnTo=${encodeURIComponent(returnTo)}`;
  const socialLoginQuery = useMemo(() => {
    const params = new URLSearchParams({
      returnTo,
      remember: String(rememberMe)
    });
    return params.toString();
  }, [rememberMe, returnTo]);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const trimmedEmail = email.trim();
      await login({
        email: trimmedEmail,
        password,
        rememberMe
      });
      if (saveLoginId && trimmedEmail) {
        try {
          window.localStorage.setItem(SAVED_LOGIN_ID_KEY, trimmedEmail);
        } catch {
          // Ignore storage write errors during login success handling.
        }
      }
      window.location.assign(returnTo);
    } catch (caughtError: unknown) {
      if (caughtError instanceof ApiError && caughtError.code === "EMAIL_NOT_VERIFIED") {
        setPendingEmail(email.trim());
        setShowVerify(true);
        setNotice("이메일 인증이 아직 완료되지 않았어요. 인증 코드를 입력해 주세요.");
        return;
      }

      setError(caughtError instanceof ApiError ? caughtError.message : "지금은 로그인할 수 없어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify() {
    const targetEmail = pendingEmail.trim() || email.trim();
    if (!targetEmail || !verificationCode.trim()) {
      setError("이메일과 인증 코드를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      await verifyEmail({
        email: targetEmail,
        code: verificationCode.trim()
      });
      if (saveLoginId && targetEmail) {
        try {
          window.localStorage.setItem(SAVED_LOGIN_ID_KEY, targetEmail);
        } catch {
          // Ignore storage write errors during verification success handling.
        }
      }
      window.location.assign(returnTo);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "이메일 인증을 완료할 수 없어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    const targetEmail = pendingEmail.trim() || email.trim();
    if (!targetEmail) {
      setError("인증 코드를 다시 받으려면 이메일을 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const response = await resendVerification(targetEmail);
      setPendingEmail(response.email);
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "인증 코드를 다시 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`${styles.page} ${styles.authShell} ${styles.loginPage}`}>
      <section className={styles.loginHero}>
        <section className={styles.loginPanel}>
          <Link href="/" className={styles.loginBrandWordmark}>
            writeLoop
          </Link>

          <nav className={styles.loginSegmentedTabs} aria-label="로그인 이동">
            <Link href="/login" className={styles.loginSegmentedTabActive} aria-current="page">
              로그인
            </Link>
            <Link href={registerHref} className={styles.loginSegmentedTab}>
              회원가입
            </Link>
          </nav>

          {!showVerify ? (
            <>
              <form
                className={`${styles.form} ${styles.loginForm}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleLogin();
                }}
              >
                <label className={`${styles.field} ${styles.loginField}`}>
                  <span>이메일</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="이메일을 입력해 주세요."
                  />
                </label>
                <label className={`${styles.field} ${styles.loginField}`}>
                  <span className={styles.loginFieldHeader}>
                    <span>비밀번호</span>
                    <button
                      type="button"
                      className={styles.loginInlineAction}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    </button>
                  </span>
                  <input
                    className={styles.input}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호를 입력해 주세요."
                  />
                </label>

                <div className={styles.loginUtilityRow}>
                  <div className={`${styles.checkboxGroup} ${styles.loginCheckboxGroup}`}>
                    <label className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={saveLoginId}
                        onChange={(event) => setSaveLoginId(event.target.checked)}
                      />
                      <span>ID 저장하기</span>
                    </label>
                    <label className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                      />
                      <span>로그인 상태 유지</span>
                    </label>
                  </div>
                  <Link href={forgotPasswordHref} className={styles.loginSupportLink}>
                    비밀번호를 잊으셨나요?
                  </Link>
                </div>

                {error ? <p className={styles.error}>{error}</p> : null}

                <div className={`${styles.primaryActionRow} ${styles.loginPrimaryActionRow}`}>
                  <button
                    type="submit"
                    className={`${styles.primaryButton} ${styles.primaryButtonWide}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "처리 중..." : "이메일로 로그인"}
                  </button>
                </div>
              </form>

              <div className={`${styles.socialSection} ${styles.loginSocialSection}`}>
                <div className={styles.socialDivider}>
                  <span>소셜 로그인</span>
                </div>
                <div className={styles.socialGrid}>
                  <a
                    href={`${API_BASE}/api/auth/social/naver/start?${socialLoginQuery}`}
                    className={styles.naverButton}
                    aria-label="네이버 로그인"
                    title="네이버 로그인"
                  >
                    <span className={styles.socialButtonIcon}>
                      <img src="/login/naver.png" alt="" />
                    </span>
                  </a>
                  <a
                    href={`${API_BASE}/api/auth/social/google/start?${socialLoginQuery}`}
                    className={styles.googleButton}
                    aria-label="Google 로그인"
                    title="Google 로그인"
                  >
                    <span className={styles.socialButtonIcon}>
                      <img src="/login/google.png" alt="" />
                    </span>
                  </a>
                  <a
                    href={`${API_BASE}/api/auth/social/kakao/start?${socialLoginQuery}`}
                    className={styles.kakaoButton}
                    aria-label="카카오 로그인"
                    title="카카오 로그인"
                  >
                    <span className={styles.socialButtonIcon}>
                      <img src="/login/kakao.png" alt="" />
                    </span>
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.loginPanelHeader}>
                <h2>이메일 인증</h2>
                <p>메일로 받은 6자리 코드를 입력하면 바로 로그인돼요.</p>
              </div>
              <p className={`${styles.subText} ${styles.loginVerifyCopy}`}>
                학습을 이어가기 전에 받은 인증 코드를 먼저 확인해 주세요.
              </p>
              <div className={`${styles.form} ${styles.loginForm}`}>
                <label className={styles.field}>
                  <span>이메일</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={pendingEmail || email}
                    onChange={(event) => {
                      setPendingEmail(event.target.value);
                      setEmail(event.target.value);
                    }}
                    placeholder="이메일을 입력해 주세요."
                  />
                </label>
                <label className={styles.field}>
                  <span>인증 코드</span>
                  <input
                    className={styles.input}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="메일로 받은 6자리 코드를 입력해 주세요."
                  />
                </label>
              </div>
              <div className={`${styles.actions} ${styles.loginVerifyActions}`}>
                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.primaryButtonWide}`}
                  onClick={() => void handleVerify()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "인증 완료"}
                </button>
                <button
                  type="button"
                  className={`${styles.ghostButton} ${styles.primaryButtonWide}`}
                  onClick={() => void handleResend()}
                  disabled={isSubmitting}
                >
                  인증 코드 다시 받기
                </button>
              </div>
              <div className={styles.loginVerifyFooter}>
                <Link href={registerHref} className={styles.loginRegisterLink}>
                  회원가입으로 이동
                </Link>
              </div>
            </>
          )}

          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {showVerify && error ? <p className={styles.error}>{error}</p> : null}
        </section>
      </section>
      <div className={styles.loginMetaFooter}>
        <span>© 2026 writeLoop. Built for the scholarly mind.</span>
      </div>
    </main>
  );
}
