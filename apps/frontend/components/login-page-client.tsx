"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, login, resendVerification, verifyEmail } from "../lib/api";
import { resolveReturnTo } from "../lib/auth-flow";
import styles from "./auth-page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export function LoginPageClient() {
  const [returnTo, setReturnTo] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(resolveReturnTo(params.get("returnTo")));
  }, []);

  const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;
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
      await login({
        email: email.trim(),
        password,
        rememberMe
      });
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
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>로그인</div>
          <h1>기존 학습 흐름을 그대로 이어서 다시 써보세요.</h1>
          <p>
            로그인하면 오늘의 질문, 내 작문 히스토리, 자주 받는 피드백까지 한 흐름으로 이어서 볼 수 있어요.
          </p>
          <ul className={styles.points}>
            <li>일반 로그인과 네이버 로그인을 모두 지원해요.</li>
            <li>로그인 상태 유지로 브라우저를 다시 열어도 이어서 시작할 수 있어요.</li>
            <li>로그인 후에는 원래 보던 화면으로 자연스럽게 돌아가요.</li>
          </ul>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>writeLoop 계정</div>
              <h2>{showVerify ? "이메일 인증" : "로그인"}</h2>
            </div>
          </div>

          {!showVerify ? (
            <>
              <p className={styles.subText}>등록한 이메일과 비밀번호를 입력해 주세요.</p>
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
                  <span>비밀번호</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호를 입력해 주세요"
                  />
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

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleLogin()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "이메일로 로그인"}
                </button>
                <Link href={registerHref} className={styles.ghostLink}>
                  회원가입으로 이동
                </Link>
              </div>

              <div className={styles.socialSection}>
                <div className={styles.socialDivider}>
                  <span>또는</span>
                </div>
                <div className={styles.socialGrid}>
                  <a href={`${API_BASE}/api/auth/social/naver/start?${socialLoginQuery}`} className={styles.naverButton}>
                    네이버
                  </a>
                  <a href={`${API_BASE}/api/auth/social/google/start?${socialLoginQuery}`} className={styles.googleButton}>
                    구글
                  </a>
                  <a href={`${API_BASE}/api/auth/social/kakao/start?${socialLoginQuery}`} className={styles.kakaoButton}>
                    카카오
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className={styles.subText}>
                이메일 인증을 완료하면 바로 로그인돼요. 메일로 받은 6자리 코드를 입력해 주세요.
              </p>
              <div className={styles.form}>
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
                  {isSubmitting ? "처리 중..." : "인증 완료"}
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
