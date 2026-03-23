"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApiError,
  checkPasswordResetEmail,
  resetPassword,
  sendPasswordResetCode,
  verifyPasswordResetCode
} from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

export function ForgotPasswordPageClient() {
  const [returnTo, setReturnTo] = useState("/");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
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
    const trimmedCode = code.trim();

    if (!isCodeSent) {
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
  }, [code, email, isCodeSent, isCodeVerified, isVerifyingCode]);

  function resetAfterEmailChange(nextEmail: string) {
    setEmail(nextEmail);
    setIsEmailChecked(false);
    setIsCodeSent(false);
    setIsCodeVerified(false);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
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

    if (!isCodeVerified) {
      setError("먼저 인증 코드를 확인해 주세요.");
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

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>비밀번호 찾기</div>
          <h1>이메일 확인부터 코드 인증까지 차례대로 진행하면 돼요.</h1>
          <p>
            등록된 이메일인지 먼저 확인한 뒤, 인증 코드를 보내고, 코드를 확인하면 새 비밀번호를 입력할 수 있어요.
          </p>
          <ul className={styles.points}>
            <li>등록된 이메일인지 확인되면 그때부터 인증 코드를 요청할 수 있어요.</li>
            <li>6자리 코드를 모두 입력하면 자동으로 코드 확인이 진행돼요.</li>
            <li>코드 확인이 끝나면 새 비밀번호 입력칸이 열립니다.</li>
          </ul>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>writeLoop 계정</div>
              <h2>비밀번호 재설정</h2>
            </div>
          </div>

          <p className={styles.subText}>
            이메일 확인부터 새 비밀번호 저장까지 차례대로 진행해 주세요.
          </p>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>이메일 확인</span>
              <div className={styles.inlineFieldRow}>
                <input
                  className={`${styles.input} ${styles.inlineFieldInput}`}
                  type="email"
                  value={email}
                  onChange={(event) => resetAfterEmailChange(event.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleCheckEmail()}
                  disabled={isCheckingEmail}
                >
                  {isCheckingEmail ? "확인 중..." : "이메일 확인"}
                </button>
              </div>
            </label>

            {isEmailChecked ? (
              <div className={styles.field}>
                <span>인증 코드 받기</span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSendCode()}
                  disabled={isSendingCode}
                >
                  {isSendingCode ? "보내는 중..." : "인증코드 보내기"}
                </button>
              </div>
            ) : null}

            {isCodeSent ? (
              <label className={styles.field}>
                <span>인증 코드 입력</span>
                <input
                  className={styles.input}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="메일로 받은 6자리 코드를 입력해 주세요"
                />
                {isVerifyingCode ? (
                  <span className={styles.subText}>코드를 확인하는 중이에요...</span>
                ) : isCodeVerified ? (
                  <span className={styles.notice}>코드 확인이 완료됐어요.</span>
                ) : null}
              </label>
            ) : null}

            {isCodeVerified ? (
              <>
                <label className={styles.field}>
                  <span>새 비밀번호 입력</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="새 비밀번호를 입력해 주세요"
                  />
                </label>

                <label className={styles.field}>
                  <span>새 비밀번호 확인</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="새 비밀번호를 한 번 더 입력해 주세요"
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleResetPassword()}
              disabled={isResettingPassword || !isCodeVerified}
            >
              {isResettingPassword ? "처리 중..." : "새 비밀번호로 변경"}
            </button>
            <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className={styles.ghostLink}>
              로그인으로 돌아가기
            </Link>
          </div>

          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>
      </section>
    </main>
  );
}
