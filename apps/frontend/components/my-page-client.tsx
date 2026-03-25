"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  deleteAccount,
  getAnswerHistory,
  getCommonMistakes,
  getCurrentUser,
  getTodayWritingStatus,
  logout,
  updateProfile
} from "../lib/api";
import { InlineFeedbackPreview } from "./inline-feedback-preview";
import { getDifficultyLabel } from "../lib/difficulty";
import { getFeedbackLevelInfo } from "../lib/feedback-level";
import type { AuthUser, CommonMistake, HistorySession, TodayWritingStatus } from "../lib/types";
import styles from "./auth-page.module.css";

type MyPageTab = "account" | "writing";

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

function parseMyPageTab(): MyPageTab {
  if (typeof window === "undefined") {
    return "account";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "writing" ? "writing" : "account";
}

function notifyTabChange(tab: MyPageTab) {
  window.dispatchEvent(new CustomEvent("writeloop:tab-change", { detail: { tab } }));
}

export function MyPageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MyPageTab>("account");
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [commonMistakes, setCommonMistakes] = useState<CommonMistake[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [mistakeError, setMistakeError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    function syncTabFromUrl() {
      setActiveTab(parseMyPageTab());
    }

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
    };
  }, []);

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

  useEffect(() => {
    if (!currentUser) {
      setProfileDisplayName("");
      return;
    }

    setProfileDisplayName(currentUser.displayName);
  }, [currentUser]);

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

  const historyDates = useMemo(() => Object.keys(historyByDate), [historyByDate]);

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

  function setTab(tab: MyPageTab) {
    setActiveTab(tab);
    window.history.replaceState({}, "", `/me?tab=${tab}`);
    notifyTabChange(tab);
  }

  function toggleDate(dateKey: string) {
    setOpenDates((current) => ({
      ...current,
      [dateKey]: !current[dateKey]
    }));
  }

  function goHome() {
    window.location.assign("/");
  }

  async function handleSaveProfile() {
    if (!currentUser) {
      return;
    }

    if (!profileDisplayName.trim()) {
      setProfileError("이름을 입력해 주세요.");
      return;
    }

    const wantsPasswordChange =
      Boolean(currentPassword.trim()) ||
      Boolean(newPassword.trim()) ||
      Boolean(confirmNewPassword.trim());

    if (wantsPasswordChange) {
      if (currentUser.socialProvider) {
        setProfileError("소셜 로그인 계정은 비밀번호를 변경할 수 없어요.");
        return;
      }

      if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
        setProfileError("비밀번호를 바꾸려면 현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setProfileError("새 비밀번호와 비밀번호 확인이 일치하지 않아요.");
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      setProfileError("");
      setProfileNotice("");

      const updatedUser = await updateProfile({
        displayName: profileDisplayName.trim(),
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim() || undefined
      });

      setCurrentUser(updatedUser);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setProfileNotice("계정 정보를 저장했어요.");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setProfileError(caughtError.message);
      } else {
        setProfileError("계정 정보를 저장하지 못했어요.");
      }
    } finally {
      setIsSavingProfile(false);
    }
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

  async function handleDeleteAccount() {
    if (!currentUser) {
      return;
    }

    if (deleteConfirmationText.trim() !== "탈퇴") {
      setDeleteError("회원 탈퇴를 진행하려면 확인 문구에 '탈퇴'를 입력해 주세요.");
      return;
    }

    if (!currentUser.socialProvider && !deletePassword.trim()) {
      setDeleteError("회원 탈퇴를 진행하려면 현재 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsDeletingAccount(true);
      setDeleteError("");
      await deleteAccount({
        confirmationText: deleteConfirmationText.trim(),
        currentPassword: deletePassword.trim() || undefined
      });
      window.location.assign("/");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setDeleteError(caughtError.message);
      } else {
        setDeleteError("회원 탈퇴를 완료하지 못했어요.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function renderAccountTab() {
    return (
      <>
        <p className={styles.subText}>
          로그인 방식과 이름을 확인하고, 필요할 때 바로 내 계정 정보를 수정할 수 있어요.
        </p>

        <div className={styles.streakBanner}>
          <span className={styles.streakLabel}>
            {todayStatus?.completed ? "오늘의 완료 도장 획득" : "오늘의 완료 도장 진행 중"}
          </span>
          <strong>{todayStatus?.streakDays ?? 0}일 연속으로 writeLoop를 이어가고 있어요.</strong>
          <p>
            {todayStatus?.completed
              ? "오늘의 작문을 끝까지 마쳐 도장을 받았어요. 지금 흐름을 내일도 이어가 보세요."
              : "오늘의 질문 하나만 마쳐도 완료 도장을 받고 연속 학습일을 더 길게 이어갈 수 있어요."}
          </p>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span>표시 이름</span>
            <strong>{currentUser?.displayName}</strong>
          </div>
          <div className={styles.infoCard}>
            <span>로그인 방식</span>
            <strong>{currentUser ? getLoginMethodLabel(currentUser) : "-"}</strong>
          </div>
        </div>

        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.historyEyebrow}>계정 설정</span>
              <h3>내 계정 수정</h3>
            </div>
          </div>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>이름</span>
              <input
                className={styles.input}
                value={profileDisplayName}
                onChange={(event) => setProfileDisplayName(event.target.value)}
                placeholder="표시 이름을 입력해 주세요"
              />
            </label>

            {currentUser?.socialProvider ? (
              <p className={styles.subText}>소셜 로그인 계정은 현재 이름만 수정할 수 있어요.</p>
            ) : (
              <>
                <label className={styles.field}>
                  <span>현재 비밀번호</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="비밀번호를 바꿀 때만 입력해 주세요"
                  />
                </label>
                <label className={styles.field}>
                  <span>새 비밀번호</span>
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
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="새 비밀번호를 한 번 더 입력해 주세요"
                  />
                </label>
              </>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleSaveProfile()}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "저장 중..." : "내 계정 저장"}
            </button>
            <button type="button" className={styles.ghostButton} onClick={goHome}>
              홈으로 돌아가기
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "처리 중..." : "로그아웃"}
            </button>
          </div>

          {profileNotice ? <p className={styles.notice}>{profileNotice}</p> : null}
          {profileError ? <p className={styles.error}>{profileError}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.historyEyebrow}>위험 구역</span>
              <h3>회원 탈퇴</h3>
            </div>
          </div>

          <p className={styles.subText}>
            회원 탈퇴를 진행하면 계정 정보, 작문 기록, 자동 로그인 정보가 함께 삭제되고 다시 복구할 수 없어요.
          </p>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>확인 문구</span>
              <input
                className={styles.input}
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                placeholder="탈퇴 라고 입력해 주세요"
              />
            </label>

            {!currentUser?.socialProvider ? (
              <label className={styles.field}>
                <span>현재 비밀번호</span>
                <input
                  className={styles.input}
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="회원 탈퇴 확인용 비밀번호를 입력해 주세요"
                />
              </label>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => void handleDeleteAccount()}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "처리 중..." : "회원 탈퇴"}
            </button>
          </div>

          {deleteError ? <p className={styles.error}>{deleteError}</p> : null}
        </div>
      </>
    );
  }

  function renderWritingTab() {
    return (
      <>
        <p className={styles.subText}>
          연속 작문 상태, 자주 받은 피드백, 날짜별 작문 히스토리를 한 번에 모아 볼 수 있어요.
        </p>

        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span>연속 작문</span>
            <strong>{todayStatus?.streakDays ?? 0}일</strong>
          </div>
          <div className={styles.infoCard}>
            <span>오늘 상태</span>
            <strong>{todayStatus?.completed ? "완료" : "진행 중"}</strong>
          </div>
          <div className={styles.infoCard}>
            <span>작문 기록</span>
            <strong>{history.length}개</strong>
          </div>
          <div className={styles.infoCard}>
            <span>자주 받은 피드백</span>
            <strong>{commonMistakes.length}개</strong>
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
              <p>아직 누적된 피드백이 많지 않아요. 몇 번 더 작문하면 자주 나오는 패턴을 모아 보여드릴게요.</p>
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
                                    {getFeedbackLevelInfo(
                                      attempt.score,
                                      attempt.feedback.loopComplete
                                    ).label} · {formatHistoryTime(attempt.createdAt)}
                                  </span>
                                </div>
                                <p className={styles.historyAnswer}>{attempt.answerText}</p>
                                <p className={styles.historySummary}>{attempt.feedbackSummary}</p>
                                <details className={styles.historyFeedbackDetails}>
                                  <summary>피드백 전문 보기</summary>
                                  <div className={styles.historyFeedbackBody}>
                                    <InlineFeedbackPreview
                                      originalAnswer={attempt.answerText}
                                      correctedAnswer={attempt.feedback.correctedAnswer}
                                      inlineFeedback={attempt.feedback.inlineFeedback}
                                      compact
                                    />
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
      </>
    );
  }

  if (currentUser === undefined) {
    return (
      <main className={styles.page}>
        <section className={styles.emptyCard}>
          <h2>내정보를 불러오는 중이에요</h2>
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
            <button type="button" className={styles.ghostButton} onClick={() => router.push("/register")}>
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
            계정 설정과 작문 기록을 한곳에서 관리할 수 있어요. 헤더의 <strong>작문기록</strong>과{" "}
            <strong>내정보</strong> 버튼으로 필요한 탭으로 바로 이동할 수 있습니다.
          </p>
          <ul className={styles.points}>
            <li>내 계정 탭에서는 이름과 비밀번호 같은 계정 정보를 관리할 수 있어요.</li>
            <li>작문 기록 탭에서는 연속 작문, 자주 받은 피드백, 날짜별 히스토리를 확인할 수 있어요.</li>
            <li>필요한 정보만 빠르게 볼 수 있도록 계정 정보와 학습 기록을 분리해 두었어요.</li>
          </ul>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>마이 페이지</div>
              <h2>계정과 학습 기록</h2>
            </div>
          </div>

          <div className={styles.tabRow}>
            <button
              type="button"
              className={activeTab === "account" ? styles.tabButtonActive : styles.tabButton}
              onClick={() => setTab("account")}
            >
              내 계정
            </button>
            <button
              type="button"
              className={activeTab === "writing" ? styles.tabButtonActive : styles.tabButton}
              onClick={() => setTab("writing")}
            >
              작문 기록
            </button>
          </div>

          {activeTab === "account" ? renderAccountTab() : renderWritingTab()}
        </section>
      </section>
    </main>
  );
}
