"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, completeRegistration, resendVerification, sendRegistrationCode } from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

export function RegisterPageClient() {
  const [returnTo, setReturnTo] = useState("/");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(resolveReturnTo(params.get("returnTo")));
  }, []);

  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;

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
      setError(caughtError instanceof ApiError ? caughtError.message : "이메일 인증을 완료하지 못했어요.");
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
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "인증코드를 다시 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>회원가입</div>
          <h1>이메일 인증을 마치면 바로 나만의 작문 기록이 시작돼요.</h1>
          <p>
            writeLoop 계정을 만들면 오늘의 질문, 다시쓰기 기록, 자주 받는 피드백과 연속 학습일을
            내 정보에서 계속 이어서 볼 수 있어요.
          </p>
          <ul className={styles.points}>
            <li>이메일만 먼저 입력하고 인증코드를 받아 둘 수 있어요.</li>
            <li>코드를 받은 뒤 이름과 비밀번호를 입력해 가입을 마무리해요.</li>
            <li>가입이 끝나면 바로 로그인된 상태로 홈으로 돌아가요.</li>
          </ul>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>writeLoop 계정</div>
              <h2>회원가입</h2>
            </div>
          </div>

          <p className={styles.subText}>
            이메일로 인증코드를 먼저 받은 뒤, 필요한 정보를 입력하고 가입을 완료해 주세요.
          </p>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>이메일</span>
              <div className={styles.inlineFieldRow}>
                <input
                  className={`${styles.input} ${styles.inlineFieldInput}`}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSendVerificationCode()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "보내는 중..." : "인증코드 받기"}
                </button>
              </div>
            </label>

            {isCodeSent ? (
              <label className={styles.field}>
                <span>인증코드</span>
                <input
                  className={styles.input}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="메일로 받은 6자리 코드를 입력해 주세요"
                />
              </label>
            ) : null}

            <label className={styles.field}>
              <span>이름</span>
              <input
                className={styles.input}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="표시 이름을 입력해 주세요"
              />
            </label>

            <label className={styles.field}>
              <span>비밀번호</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력해 주세요"
              />
            </label>

            <label className={styles.field}>
              <span>비밀번호 확인</span>
              <input
                className={styles.input}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="비밀번호를 한 번 더 입력해 주세요"
              />
            </label>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleVerify()}
              disabled={isSubmitting || !isCodeSent}
            >
              {isSubmitting ? "처리 중..." : "회원가입 완료하기"}
            </button>
            {isCodeSent ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => void handleResend()}
                disabled={isSubmitting}
              >
                인증코드 다시 받기
              </button>
            ) : null}
            <Link href={loginHref} className={styles.ghostLink}>
              로그인으로 이동
            </Link>
          </div>

          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>
      </section>
    </main>
  );
}
