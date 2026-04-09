"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  checkPasswordResetEmail,
  resetPassword,
  sendPasswordResetCode,
  verifyPasswordResetCode
} from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

const CODE_LIMIT_MS = 3 * 60 * 1000;

export function ForgotPasswordPageClient() {
  const [returnTo, setReturnTo] = useState("/");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [codeDeadline, setCodeDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const remainingMs = codeDeadline ? Math.max(0, codeDeadline - now) : 0;
  const isCodeExpired = codeDeadline !== null && remainingMs === 0;
  const remainingMinutes = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const remainingSeconds = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  const stageMeta = isCodeVerified
    ? {
        badge: "새 비밀번호 설정",
        title: "새 비밀번호를 입력해 마무리해 주세요.",
        description: "인증이 끝났어요. 새 비밀번호를 두 번 입력하면 바로 재설정할 수 있어요."
      }
    : isCodeSent
      ? {
          badge: "인증코드 확인",
          title: "메일로 받은 인증코드를 입력해 주세요.",
          description: "인증코드는 3분 동안만 유효해요. 코드가 맞으면 새 비밀번호 입력칸이 바로 열려요."
        }
      : isEmailChecked
        ? {
            badge: "이메일 확인 완료",
            title: "이제 재설정 코드를 보내드릴게요.",
            description: "등록된 이메일이 확인됐어요. 메일로 받은 코드로 본인 확인을 이어가면 돼요."
          }
        : null;

  const primaryActionLabel = !isEmailChecked
    ? isCheckingEmail
      ? "이메일 확인 중..."
      : "이메일 확인"
    : !isCodeSent
      ? isSendingCode
        ? "인증코드 보내는 중..."
        : "인증코드 보내기"
      : isCodeVerified
        ? isResettingPassword
          ? "처리 중..."
          : "새 비밀번호로 변경"
        : null;

  const isPrimaryActionDisabled = !isEmailChecked
    ? isCheckingEmail
    : !isCodeSent
      ? isSendingCode
      : isResettingPassword || isCodeExpired;

  useEffect(() => {
    const trimmedCode = code.trim();

    if (!isCodeSent || isCodeExpired) {
      return;
    }

    if (trimmedCode.length < 6) {
      setIsCodeVerified(false);
      return;
    }

    if (trimmedCode.length !== 6 || isVerifyingCode || isCodeVerified) {
      return;
    }

    async function verifyCompletedCode() {
      try {
        setIsVerifyingCode(true);
        setError("");
        setNotice("");
        const response = await verifyPasswordResetCode({
          email: email.trim(),
          code: trimmedCode
        });
        setIsCodeVerified(true);
        setNotice(response.message);
      } catch (caughtError: unknown) {
        setIsCodeVerified(false);
        setError(caughtError instanceof ApiError ? caughtError.message : "재설정 코드를 확인하지 못했어요.");
      } finally {
        setIsVerifyingCode(false);
      }
    }

    void verifyCompletedCode();
  }, [code, email, isCodeExpired, isCodeSent, isCodeVerified, isVerifyingCode]);

  function resetAfterEmailChange(nextEmail: string) {
    setEmail(nextEmail);
    setIsEmailChecked(false);
    setIsCodeSent(false);
    setIsCodeVerified(false);
    setCodeDeadline(null);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  }

  async function handleCheckEmail() {
    if (!email.trim()) {
      setError("이메일을 먼저 입력해 주세요.");
      return;
    }

    try {
      setIsCheckingEmail(true);
      setError("");
      setNotice("");
      const response = await checkPasswordResetEmail({
        email: email.trim()
      });
      setIsEmailChecked(response.available);
      setIsCodeSent(false);
      setIsCodeVerified(false);
      setCodeDeadline(null);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setIsEmailChecked(false);
      setError(caughtError instanceof ApiError ? caughtError.message : "이메일을 확인하지 못했어요.");
    } finally {
      setIsCheckingEmail(false);
    }
  }

  async function handleSendCode() {
    if (!isEmailChecked) {
      setError("먼저 등록된 이메일인지 확인해 주세요.");
      return;
    }

    try {
      setIsSendingCode(true);
      setError("");
      setNotice("");
      const response = await sendPasswordResetCode({
        email: email.trim()
      });
      setIsCodeSent(true);
      setIsCodeVerified(false);
      setCodeDeadline(Date.now() + CODE_LIMIT_MS);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "재설정 코드를 보내지 못했어요.");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleResetPassword() {
    if (!email.trim() || !code.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("이메일, 재설정 코드, 새 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (isCodeExpired) {
      setError("인증번호 입력 시간이 만료됐어요. 다시 인증코드를 받아 주세요.");
      return;
    }

    if (!isCodeVerified) {
      setError("먼저 인증코드를 확인해 주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호와 비밀번호 확인이 일치하지 않아요.");
      return;
    }

    try {
      setIsResettingPassword(true);
      setError("");
      setNotice("");
      await resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword
      });
      window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}&reset=done`);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "비밀번호를 재설정하지 못했어요.");
    } finally {
      setIsResettingPassword(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isEmailChecked) {
      void handleCheckEmail();
      return;
    }

    if (!isCodeSent) {
      void handleSendCode();
      return;
    }

    if (isCodeVerified) {
      void handleResetPassword();
    }
  }

  return (
    <main className={`${styles.page} ${styles.authShell} ${styles.forgotPasswordPage}`}>
      <section className={styles.forgotPasswordShell}>
        <header className={styles.forgotPasswordTitleWrap}>
          <h1 className={styles.forgotPasswordPageTitle}>비밀번호 재설정</h1>
        </header>

        <section className={styles.forgotPasswordCard}>
          {stageMeta ? (
            <div className={styles.forgotPasswordStageBanner}>
              <span className={styles.forgotPasswordStageEyebrow}>{stageMeta.badge}</span>
              <div className={styles.forgotPasswordStageCopy}>
                <strong>{stageMeta.title}</strong>
                <p>{stageMeta.description}</p>
              </div>
            </div>
          ) : null}

          <form className={styles.forgotPasswordForm} onSubmit={handleSubmit}>
            <label className={`${styles.field} ${styles.forgotPasswordField}`}>
              <span className={styles.forgotPasswordFieldLabel}>이메일 확인</span>
              <div className={styles.forgotPasswordInputWrap}>
                <input
                  className={`${styles.input} ${styles.forgotPasswordInput}`}
                  type="email"
                  value={email}
                  onChange={(event) => resetAfterEmailChange(event.target.value)}
                  placeholder="example@writeloop.com"
                  autoComplete="email"
                />
                <span
                  className={`material-symbols-outlined ${styles.forgotPasswordInputIcon}`}
                  aria-hidden="true"
                >
                  mail
                </span>
              </div>
            </label>

            {isCodeSent ? (
              <label className={`${styles.field} ${styles.forgotPasswordField}`}>
                <span className={styles.forgotPasswordFieldHeader}>
                  <span className={styles.forgotPasswordFieldLabel}>인증코드 입력</span>
                  {!isCodeExpired ? (
                    <span className={styles.forgotPasswordTimerPill}>
                      {remainingMinutes}:{remainingSeconds}
                    </span>
                  ) : null}
                </span>
                <div className={styles.forgotPasswordInputWrap}>
                  <input
                    className={`${styles.input} ${styles.forgotPasswordInput}`}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="메일로 받은 6자리 코드를 입력해 주세요."
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    disabled={isCodeExpired}
                  />
                  <span
                    className={`material-symbols-outlined ${styles.forgotPasswordInputIcon}`}
                    aria-hidden="true"
                  >
                    mark_email_read
                  </span>
                </div>
                <p className={styles.forgotPasswordInlineHint}>
                  {isCodeExpired
                    ? "인증번호 입력 시간이 만료됐어요. 다시 인증코드를 받아 주세요."
                    : isVerifyingCode
                      ? "코드를 확인하는 중이에요..."
                      : isCodeVerified
                        ? "코드 확인이 완료됐어요."
                        : "코드가 맞으면 자동으로 다음 단계로 넘어가요."}
                </p>
              </label>
            ) : null}

            {isCodeVerified ? (
              <div className={styles.forgotPasswordPasswordGrid}>
                <label className={`${styles.field} ${styles.forgotPasswordField}`}>
                  <span className={styles.forgotPasswordFieldLabel}>새 비밀번호</span>
                  <div className={styles.forgotPasswordInputWrap}>
                    <input
                      className={`${styles.input} ${styles.forgotPasswordInput}`}
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="새 비밀번호를 입력해 주세요."
                      autoComplete="new-password"
                    />
                    <span
                      className={`material-symbols-outlined ${styles.forgotPasswordInputIcon}`}
                      aria-hidden="true"
                    >
                      lock
                    </span>
                  </div>
                </label>

                <label className={`${styles.field} ${styles.forgotPasswordField}`}>
                  <span className={styles.forgotPasswordFieldLabel}>비밀번호 확인</span>
                  <div className={styles.forgotPasswordInputWrap}>
                    <input
                      className={`${styles.input} ${styles.forgotPasswordInput}`}
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="비밀번호를 한 번 더 입력해 주세요."
                      autoComplete="new-password"
                    />
                    <span
                      className={`material-symbols-outlined ${styles.forgotPasswordInputIcon}`}
                      aria-hidden="true"
                    >
                      verified_user
                    </span>
                  </div>
                </label>
              </div>
            ) : null}

            <div className={styles.forgotPasswordFeedbackStack} aria-live="polite">
              {notice ? <p className={styles.forgotPasswordStatusNotice}>{notice}</p> : null}
              {error ? <p className={styles.forgotPasswordStatusError}>{error}</p> : null}
            </div>

            {primaryActionLabel ? (
              <button
                type="submit"
                className={`${styles.primaryButton} ${styles.primaryButtonWide}`}
                disabled={isPrimaryActionDisabled}
              >
                {primaryActionLabel}
              </button>
            ) : null}

            {isCodeSent && !isCodeVerified ? (
              <button
                type="button"
                className={styles.forgotPasswordResendButton}
                onClick={() => void handleSendCode()}
                disabled={isSendingCode}
              >
                {isSendingCode ? "인증코드를 다시 보내는 중..." : "인증코드 다시 받기"}
              </button>
            ) : null}
          </form>
        </section>

        <footer className={styles.forgotPasswordFooter}>
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className={styles.forgotPasswordBackLink}
          >
            <span
              className={`material-symbols-outlined ${styles.forgotPasswordBackIcon}`}
              aria-hidden="true"
            >
              arrow_back
            </span>
            로그인 페이지로 돌아가기
          </Link>
        </footer>
      </section>
    </main>
  );
}
