"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, completeRegistration, resendVerification, sendRegistrationCode } from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

const CODE_LIMIT_MS = 3 * 60 * 1000;

export function RegisterPageClient() {
  const [returnTo, setReturnTo] = useState("/");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [codeDeadline, setCodeDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(resolveReturnTo(params.get("returnTo")));
  }, []);

  useEffect(() => {
    if (!codeDeadline) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [codeDeadline]);

  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const remainingMs = codeDeadline ? Math.max(0, codeDeadline - now) : 0;
  const isCodeExpired = codeDeadline !== null && remainingMs === 0;
  const remainingMinutes = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const remainingSeconds = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  async function handleSendVerificationCode() {
    if (!email.trim()) {
      setError("이메일을 먼저 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const response = await sendRegistrationCode({
        email: email.trim()
      });
      setIsCodeSent(true);
      setCodeDeadline(Date.now() + CODE_LIMIT_MS);
      setVerificationCode("");
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "인증코드를 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!displayName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("이름, 이메일, 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (!verificationCode.trim()) {
      setError("인증코드를 입력해 주세요.");
      return;
    }

    if (isCodeExpired) {
      setError("인증번호 입력 시간이 만료됐어요. 다시 인증코드를 받아 주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않아요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      await completeRegistration({
        email: email.trim(),
        code: verificationCode.trim(),
        password,
        displayName: displayName.trim()
      });
      window.location.assign(returnTo);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "회원가입을 완료하지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError("인증코드를 다시 받으려면 이메일을 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const response = await resendVerification(email.trim());
      setIsCodeSent(true);
      setCodeDeadline(Date.now() + CODE_LIMIT_MS);
      setVerificationCode("");
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "인증코드를 다시 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`${styles.page} ${styles.authShell} ${styles.loginPage} ${styles.registerPage}`}>
      <section className={styles.loginHero}>
        <div className={styles.loginPageTitleWrap}>
          <h1 className={styles.loginPageTitle}>회원가입</h1>
        </div>

        <section className={`${styles.loginPanel} ${styles.registerPanel}`}>
          <div className={styles.registerBrandHeader}>
            <span className={styles.registerIntroPill}>writeLoop 계정 만들기</span>
            <div className={styles.registerBrandCopy}>
              <h2 className={styles.registerWelcomeHeading}>지금부터 나만의 작문 루프를 시작해 볼까요?</h2>
              <p className={styles.registerWelcomeCopy}>
                이메일 인증을 마치면 오늘의 질문, 다시쓰기, 피드백 기록을 한 흐름으로 이어서 쓸 수 있어요.
              </p>
            </div>
          </div>

          <form
            className={`${styles.form} ${styles.loginForm} ${styles.registerForm}`}
            onSubmit={(event) => {
              event.preventDefault();
              void handleVerify();
            }}
          >
            <label className={`${styles.field} ${styles.loginField} ${styles.registerField}`}>
              <span>이메일</span>
              <div className={styles.registerEmailRow}>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.registerSendButton}`}
                  onClick={() => void handleSendVerificationCode()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "보내는 중..." : "인증코드 받기"}
                </button>
              </div>
            </label>

            {isCodeSent ? (
              <label className={`${styles.field} ${styles.loginField} ${styles.registerField}`}>
                <span className={styles.registerFieldHeader}>
                  <span>인증코드</span>
                  {!isCodeExpired ? (
                    <span className={styles.registerTimerPill}>
                      남은 시간 {remainingMinutes}:{remainingSeconds}
                    </span>
                  ) : null}
                </span>
                <input
                  className={styles.input}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="메일로 받은 6자리 코드를 입력해 주세요."
                  disabled={isCodeExpired}
                />
                {isCodeExpired ? (
                  <span className={styles.errorText}>인증번호 입력 시간이 만료됐어요. 다시 받아 주세요.</span>
                ) : null}
              </label>
            ) : null}

            <label className={`${styles.field} ${styles.loginField} ${styles.registerField}`}>
              <span>이름</span>
              <input
                className={styles.input}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="표시 이름을 입력해 주세요."
              />
            </label>

            <label className={`${styles.field} ${styles.loginField} ${styles.registerField}`}>
              <span className={styles.loginFieldHeader}>
                <span>비밀번호</span>
                <button
                  type="button"
                  className={styles.loginInlineAction}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "숨기기" : "보기"}
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

            <label className={`${styles.field} ${styles.loginField} ${styles.registerField}`}>
              <span className={styles.loginFieldHeader}>
                <span>비밀번호 확인</span>
                <button
                  type="button"
                  className={styles.loginInlineAction}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? "숨기기" : "보기"}
                </button>
              </span>
              <input
                className={styles.input}
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="비밀번호를 한 번 더 입력해 주세요."
              />
            </label>

            {notice ? <p className={styles.notice}>{notice}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.registerPrimaryActionRow}>
              <button
                type="submit"
                className={`${styles.primaryButton} ${styles.primaryButtonWide}`}
                disabled={isSubmitting || !isCodeSent || isCodeExpired}
              >
                {isSubmitting ? "처리 중..." : "회원가입 완료하기"}
              </button>
            </div>

            <div className={styles.registerSecondaryActions}>
              {isCodeSent ? (
                <button
                  type="button"
                  className={`${styles.ghostButton} ${styles.registerResendButton}`}
                  onClick={() => void handleResend()}
                  disabled={isSubmitting}
                >
                  인증코드 다시 받기
                </button>
              ) : null}

              <p className={styles.registerLoginPrompt}>
                이미 계정이 있으신가요?
                <Link href={loginHref} className={styles.loginRegisterLink}>
                  로그인
                </Link>
              </p>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
