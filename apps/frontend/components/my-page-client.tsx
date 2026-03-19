"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getAnswerHistory,
  getCommonMistakes,
  getCurrentUser,
  getTodayWritingStatus,
  logout
} from "../lib/api";
import { getDifficultyLabel } from "../lib/difficulty";
import type { AuthUser, CommonMistake, HistorySession, TodayWritingStatus } from "../lib/types";
import styles from "./auth-page.module.css";

function formatHistoryDate(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(dateTime));
}

function formatHistoryTime(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

function getLoginMethodLabel(user: AuthUser) {
  switch (user.socialProvider) {
    case "NAVER":
      return "네이버";
    case "GOOGLE":
      return "구글";
    case "KAKAO":
      return "카카오";
    default:
      return user.email;
  }
}

export function MyPageClient() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [commonMistakes, setCommonMistakes] = useState<CommonMistake[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [mistakeError, setMistakeError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        const user = await getCurrentUser();
        if (!isMounted) {
          return;
        }

        setCurrentUser(user);

        if (!user) {
          setTodayStatus(null);
          setHistory([]);
          setCommonMistakes([]);
          setHistoryError("");
          setMistakeError("");
          return;
        }

        try {
          const [status, sessions, mistakes] = await Promise.all([
            getTodayWritingStatus(),
            getAnswerHistory(),
            getCommonMistakes()
          ]);

          if (!isMounted) {
            return;
          }

          setTodayStatus(status);
          setHistory(sessions);
          setCommonMistakes(mistakes);
          setHistoryError("");
          setMistakeError("");
        } catch {
          if (!isMounted) {
            return;
          }

          setTodayStatus(null);
          setHistory([]);
          setCommonMistakes([]);
          setHistoryError("학습 기록을 아직 불러오지 못했어요.");
          setMistakeError("자주 나오는 피드백을 아직 불러오지 못했어요.");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setCurrentUser(null);
        setTodayStatus(null);
        setHistory([]);
        setCommonMistakes([]);
        setHistoryError("");
        setMistakeError("");
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  const historyByDate = useMemo(() => {
    return history.reduce<Record<string, HistorySession[]>>((accumulator, session) => {
      const dateKey = formatHistoryDate(session.createdAt);

      if (!accumulator[dateKey]) {
        accumulator[dateKey] = [];
      }

      accumulator[dateKey].push(session);
      return accumulator;
    }, {});
  }, [history]);

  const historyDates = Object.keys(historyByDate);

  useEffect(() => {
    if (historyDates.length === 0) {
      setOpenDates({});
      return;
    }

    setOpenDates((current) => {
      const next = { ...current };
      let changed = false;

      for (const dateKey of historyDates) {
        if (!(dateKey in next)) {
          next[dateKey] = false;
          changed = true;
        }
      }

      for (const existingKey of Object.keys(next)) {
        if (!historyDates.includes(existingKey)) {
          delete next[existingKey];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [historyDates]);

  function toggleDate(dateKey: string) {
    setOpenDates((current) => ({
      ...current,
      [dateKey]: !current[dateKey]
    }));
  }

  function goHome() {
    window.location.assign("/");
  }

  async function handleLogout() {
    try {
      setIsSubmitting(true);
      setError("");
      await logout();
      setCurrentUser(null);
      setTodayStatus(null);
      setHistory([]);
      setCommonMistakes([]);
      window.location.assign("/");
    } catch {
      setError("로그아웃하지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (currentUser === undefined) {
    return (
      <main className={styles.page}>
        <section className={styles.emptyCard}>
          <h2>내 정보를 불러오는 중이에요</h2>
          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={styles.page}>
        <section className={styles.emptyCard}>
          <h2>로그인이 필요해요</h2>
          <p>내정보 페이지는 로그인한 뒤에 확인할 수 있어요.</p>
          <div className={styles.linkRow}>
            <button type="button" className={styles.primaryButton} onClick={() => router.push("/login")}>
              로그인
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => router.push("/register")}
            >
              회원가입
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.stackedHero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>내정보</div>
          <h1>{currentUser.displayName}님의 학습 공간</h1>
          <p>
            계정 정보와 날짜별 작문 히스토리를 한 번에 볼 수 있어요. 매일 어떤 질문에 답했고,
            어떤 피드백을 받았는지 차근차근 돌아보세요.
          </p>
          <ul className={styles.points}>
            <li>날짜별로 작문 기록을 다시 펼쳐볼 수 있어요.</li>
            <li>자주 나오는 피드백을 모아서 약한 포인트를 확인할 수 있어요.</li>
            <li>연속 작문 일수를 보며 매일 쓰는 흐름을 이어갈 수 있어요.</li>
          </ul>
          <div className={styles.streakBanner}>
            <span className={styles.streakLabel}>연속 작문</span>
            <strong>{todayStatus?.streakDays ?? 0}일째</strong>
            <p>
              {todayStatus?.streakDays
                ? "오늘도 이어 쓰면 학습 리듬을 더 단단하게 만들 수 있어요."
                : "오늘 첫 작문을 시작하면 연속 기록이 시작돼요."}
            </p>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>계정 정보</div>
              <h2>내 계정</h2>
            </div>
          </div>
          <p className={styles.subText}>
            현재 로그인한 계정 정보와 오늘의 학습 상태를 함께 확인할 수 있어요.
          </p>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <span>표시 이름</span>
              <strong>{currentUser.displayName}</strong>
            </div>
            <div className={styles.infoCard}>
              <span>로그인 방식</span>
              <strong>{getLoginMethodLabel(currentUser)}</strong>
            </div>
            <div className={styles.infoCard}>
              <span>연속 작문</span>
              <strong>{todayStatus?.streakDays ?? 0}일</strong>
            </div>
            <div className={styles.infoCard}>
              <span>오늘 상태</span>
              <strong>{todayStatus?.completed ? "완료" : "진행 전"}</strong>
            </div>
          </div>

          <div className={styles.historySection}>
            <div className={styles.historyHeader}>
              <div>
                <span className={styles.historyEyebrow}>학습 분석</span>
                <h3>자주 나오는 피드백</h3>
              </div>
              <strong>{commonMistakes.length}개 항목</strong>
            </div>

            {mistakeError ? <p className={styles.error}>{mistakeError}</p> : null}

            {commonMistakes.length === 0 ? (
              <div className={styles.historyEmpty}>
                <p>아직 누적된 피드백이 많지 않아요. 몇 번 더 작문하면 자주 나오는 패턴을 모아드릴게요.</p>
              </div>
            ) : (
              <div className={styles.mistakeGrid}>
                {commonMistakes.map((mistake) => (
                  <article key={mistake.issue} className={styles.mistakeCard}>
                    <div className={styles.mistakeHeader}>
                      <strong>{mistake.displayLabel}</strong>
                      <span>{mistake.count}회</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={styles.historySection}>
            <div className={styles.historyHeader}>
              <div>
                <span className={styles.historyEyebrow}>학습 기록</span>
                <h3>날짜별 작문 히스토리</h3>
              </div>
              <strong>{history.length}개의 질문 기록</strong>
            </div>

            {historyError ? <p className={styles.error}>{historyError}</p> : null}

            {historyDates.length === 0 ? (
              <div className={styles.historyEmpty}>
                <p>아직 저장된 작문 기록이 없어요. 오늘의 질문으로 첫 작문을 시작해 볼까요?</p>
                <button type="button" className={styles.primaryButton} onClick={goHome}>
                  첫 작문 시작하기
                </button>
              </div>
            ) : (
              <div className={styles.historyDateList}>
                {historyDates.map((dateKey) => (
                  <section key={dateKey} className={styles.historyDateGroup}>
                    <button
                      type="button"
                      className={styles.historyDateButton}
                      onClick={() => toggleDate(dateKey)}
                    >
                      <span className={styles.historyDateTitle}>{dateKey}</span>
                      <span className={styles.historyDateToggle}>
                        {openDates[dateKey] ? "접기" : "펼치기"}
                      </span>
                    </button>

                    {openDates[dateKey] ? (
                      <div className={styles.historySessionList}>
                        {historyByDate[dateKey].map((session) => (
                          <article key={session.sessionId} className={styles.historySessionCard}>
                            <div className={styles.historySessionHeader}>
                              <div>
                                <span className={styles.historyMeta}>
                                  {session.topic} · {getDifficultyLabel(session.difficulty)}
                                </span>
                                <h4>{session.questionKo}</h4>
                                <p>{session.questionEn}</p>
                              </div>
                            </div>

                            <div className={styles.historyAttemptList}>
                              {session.attempts.map((attempt) => (
                                <div key={attempt.id} className={styles.historyAttemptCard}>
                                  <div className={styles.historyAttemptMeta}>
                                    <strong>
                                      {attempt.attemptType === "INITIAL"
                                        ? `첫 답변 ${attempt.attemptNo}차`
                                        : `다시쓰기 ${attempt.attemptNo}차`}
                                    </strong>
                                    <span>
                                      점수 {attempt.score} · {formatHistoryTime(attempt.createdAt)}
                                    </span>
                                  </div>
                                  <p className={styles.historyAnswer}>{attempt.answerText}</p>
                                  <p className={styles.historySummary}>{attempt.feedbackSummary}</p>
                                  <details className={styles.historyFeedbackDetails}>
                                    <summary>피드백 전문 보기</summary>
                                    <div className={styles.historyFeedbackBody}>
                                      <div className={styles.historyFeedbackBlock}>
                                        <h5>전체 요약</h5>
                                        <p>{attempt.feedback.summary}</p>
                                      </div>
                                      <div className={styles.historyFeedbackBlock}>
                                        <h5>잘한 점</h5>
                                        <ul>
                                          {attempt.feedback.strengths.map((strength) => (
                                            <li key={strength}>{strength}</li>
                                          ))}
                                        </ul>
                                      </div>
                                      <div className={styles.historyFeedbackBlock}>
                                        <h5>개선하면 좋은 점</h5>
                                        <ul>
                                          {attempt.feedback.corrections.map((correction) => (
                                            <li key={`${correction.issue}-${correction.suggestion}`}>
                                              <strong>{correction.issue}</strong>
                                              <span>{correction.suggestion}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                      <div className={styles.historyFeedbackBlock}>
                                        <h5>모범 답안</h5>
                                        <p>{attempt.feedback.modelAnswer}</p>
                                      </div>
                                      <div className={styles.historyFeedbackBlock}>
                                        <h5>다시쓰기 가이드</h5>
                                        <p>{attempt.feedback.rewriteChallenge}</p>
                                      </div>
                                      {attempt.feedback.completionMessage ? (
                                        <div className={styles.historyFeedbackBlock}>
                                          <h5>완료 안내</h5>
                                          <p>{attempt.feedback.completionMessage}</p>
                                        </div>
                                      ) : null}
                                    </div>
                                  </details>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.ghostButton} onClick={goHome}>
              홈으로 돌아가기
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "처리 중..." : "로그아웃"}
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>
      </section>
    </main>
  );
}
