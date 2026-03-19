"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, register, resendVerification, verifyEmail } from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

export function RegisterPageClient() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(resolveReturnTo(params.get("returnTo")));
  }, []);

  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifyStep, setIsVerifyStep] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    if (!displayName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("이름, 이메일, 비밀번호, 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않아요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const response = await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password
      });
      setEmail(response.email);
      setIsVerifyStep(true);
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "회원가입을 진행할 수 없어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!email.trim() || !verificationCode.trim()) {
      setError("이메일과 인증 코드를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await verifyEmail({
        email: email.trim(),
        code: verificationCode.trim()
      });
      router.replace(returnTo);
      router.refresh();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "이메일 인증을 완료할 수 없어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError("인증 코드를 다시 받으려면 이메일을 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const response = await resendVerification(email.trim());
      setNotice(response.message);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof ApiError ? caughtError.message : "인증 코드를 다시 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>회원가입</div>
          <h1>writeLoop 계정을 만들고 학습 루프를 이어가세요.</h1>
          <p>
            이메일 인증을 완료하면 질문 수 제한 없이 영어 문답 루프를 계속하고, 내 답변 기록을 계정 기준으로
            쌓아갈 수 있어요.
          </p>
          <ul className={styles.points}>
            <li>이메일 인증 후 바로 로그인 상태 연결</li>
            <li>여러 질문에 대한 세션 추적 가능</li>
            <li>향후 내 기록 화면과 자연스럽게 연결</li>
          </ul>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>writeLoop 계정</div>
              <h2>{isVerifyStep ? "이메일 인증" : "회원가입"}</h2>
            </div>
          </div>

          {!isVerifyStep ? (
            <>
              <p className={styles.subText}>
                학습 기록을 이어갈 수 있도록 기본 계정 정보를 입력해 주세요.
              </p>
              <div className={styles.form}>
                <label className={styles.field}>
                  <span>표시 이름</span>
                  <input
                    className={styles.input}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="앱에서 보일 이름"
                  />
                </label>
                <label className={styles.field}>
                  <span>이메일</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label className={styles.field}>
                  <span>비밀번호</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8자 이상 입력해 주세요."
                  />
                </label>
                <label className={styles.field}>
                  <span>비밀번호 확인</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="비밀번호를 한 번 더 입력해 주세요."
                  />
                </label>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleRegister()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "회원가입하고 인증 코드 받기"}
                </button>
                <Link href={loginHref} className={styles.ghostLink}>
                  로그인으로 이동
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className={styles.subText}>
                메일로 전송된 6자리 인증 코드를 입력하면 바로 로그인 상태로 이어집니다.
              </p>
              <div className={styles.form}>
                <label className={styles.field}>
                  <span>이메일</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label className={styles.field}>
                  <span>인증 코드</span>
                  <input
                    className={styles.input}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="메일로 받은 6자리 코드"
                  />
                </label>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleVerify()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "이메일 인증 완료"}
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => void handleResend()}
                  disabled={isSubmitting}
                >
                  인증 코드 다시 받기
                </button>
              </div>
            </>
          )}

          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>
      </section>
    </main>
  );
}
