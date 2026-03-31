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
import { filterSuggestedRefinementExpressions } from "../lib/refinement-recommendations";
import { InlineFeedbackPreview } from "./inline-feedback-preview";
import { getDifficultyLabel } from "../lib/difficulty";
import { getFeedbackLevelInfo } from "../lib/feedback-level";
import type { AuthUser, CommonMistake, HistorySession, TodayWritingStatus } from "../lib/types";
import styles from "./auth-page.module.css";

type MyPageTab = "account" | "writing";
type HistoryDiffSegment = {
  text: string;
  changed: boolean;
};

type HistoryComparisonView = {
  initialAttempt: HistorySession["attempts"][number];
  rewriteAttempt: HistorySession["attempts"][number];
  initialSegments: HistoryDiffSegment[];
  rewriteSegments: HistoryDiffSegment[];
  changedChunkCount: number;
  addedWordCount: number;
  removedWordCount: number;
  beforeWordCount: number;
  afterWordCount: number;
};

type UsedExpressionHistoryItem = {
  expression: string;
  count: number;
  lastUsedAt: string;
  latestTopic: string;
  latestQuestionKo: string;
  matchedText: string | null;
};

function formatHistoryDateKey(dateTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date(dateTime));
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatHistoryDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12)));
}

function formatHistoryTime(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

function formatExpressionHistoryDate(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric"
  }).format(new Date(dateTime));
}

function buildHistoryDiffUnits(text: string) {
  const tokens = text.match(/\s+|[^\s]+/g) ?? [];
  const units: Array<{ text: string; token: string }> = [];
  let pendingWhitespace = "";

  for (const part of tokens) {
    if (/^\s+$/.test(part)) {
      pendingWhitespace += part;
      continue;
    }

    units.push({
      text: pendingWhitespace + part,
      token: part
    });
    pendingWhitespace = "";
  }

  if (pendingWhitespace && units.length > 0) {
    units[units.length - 1] = {
      ...units[units.length - 1],
      text: units[units.length - 1].text + pendingWhitespace
    };
  }

  return units;
}

function mergeHistoryDiffSegments(segments: HistoryDiffSegment[]) {
  return segments.reduce<HistoryDiffSegment[]>((accumulator, segment) => {
    if (!segment.text) {
      return accumulator;
    }

    const previous = accumulator[accumulator.length - 1];
    if (previous && previous.changed === segment.changed) {
      previous.text += segment.text;
      return accumulator;
    }

    accumulator.push({ ...segment });
    return accumulator;
  }, []);
}

function buildHistoryComparisonView(session: HistorySession): HistoryComparisonView | null {
  const initialAttempt =
    session.attempts.find((attempt) => attempt.attemptType === "INITIAL") ?? session.attempts[0];
  const rewriteAttempts = session.attempts.filter((attempt) => attempt.attemptType === "REWRITE");
  const rewriteAttempt = rewriteAttempts[rewriteAttempts.length - 1];

  if (!initialAttempt || !rewriteAttempt) {
    return null;
  }

  const initialUnits = buildHistoryDiffUnits(initialAttempt.answerText);
  const rewriteUnits = buildHistoryDiffUnits(rewriteAttempt.answerText);
  const lcs = Array.from({ length: initialUnits.length + 1 }, () =>
    Array<number>(rewriteUnits.length + 1).fill(0)
  );

  for (let leftIndex = initialUnits.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rewriteUnits.length - 1; rightIndex >= 0; rightIndex -= 1) {
      if (initialUnits[leftIndex].token === rewriteUnits[rightIndex].token) {
        lcs[leftIndex][rightIndex] = lcs[leftIndex + 1][rightIndex + 1] + 1;
      } else {
        lcs[leftIndex][rightIndex] = Math.max(
          lcs[leftIndex + 1][rightIndex],
          lcs[leftIndex][rightIndex + 1]
        );
      }
    }
  }

  const initialSegments: HistoryDiffSegment[] = [];
  const rewriteSegments: HistoryDiffSegment[] = [];
  let changedChunkCount = 0;
  let addedWordCount = 0;
  let removedWordCount = 0;
  let leftCursor = 0;
  let rightCursor = 0;

  while (leftCursor < initialUnits.length && rightCursor < rewriteUnits.length) {
    if (initialUnits[leftCursor].token === rewriteUnits[rightCursor].token) {
      initialSegments.push({ text: initialUnits[leftCursor].text, changed: false });
      rewriteSegments.push({ text: rewriteUnits[rightCursor].text, changed: false });
      leftCursor += 1;
      rightCursor += 1;
      continue;
    }

    if (lcs[leftCursor + 1][rightCursor] >= lcs[leftCursor][rightCursor + 1]) {
      initialSegments.push({ text: initialUnits[leftCursor].text, changed: true });
      changedChunkCount += 1;
      removedWordCount += 1;
      leftCursor += 1;
      continue;
    }

    rewriteSegments.push({ text: rewriteUnits[rightCursor].text, changed: true });
    changedChunkCount += 1;
    addedWordCount += 1;
    rightCursor += 1;
  }

  while (leftCursor < initialUnits.length) {
    initialSegments.push({ text: initialUnits[leftCursor].text, changed: true });
    changedChunkCount += 1;
    removedWordCount += 1;
    leftCursor += 1;
  }

  while (rightCursor < rewriteUnits.length) {
    rewriteSegments.push({ text: rewriteUnits[rightCursor].text, changed: true });
    changedChunkCount += 1;
    addedWordCount += 1;
    rightCursor += 1;
  }

  return {
    initialAttempt,
    rewriteAttempt,
    initialSegments: mergeHistoryDiffSegments(initialSegments),
    rewriteSegments: mergeHistoryDiffSegments(rewriteSegments),
    changedChunkCount,
    addedWordCount,
    removedWordCount,
    beforeWordCount: initialUnits.length,
    afterWordCount: rewriteUnits.length
  };
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

function parseHistoryDateParam() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const date = params.get("date") ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
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
  const [openSessions, setOpenSessions] = useState<Record<string, boolean>>({});
  const [selectedHistoryDate, setSelectedHistoryDate] = useState("");
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
      setSelectedHistoryDate(parseHistoryDateParam());
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

  const usedExpressionHistory = useMemo(() => {
    const items = new Map<string, UsedExpressionHistoryItem>();

    for (const session of history) {
      for (const attempt of session.attempts) {
        for (const expression of attempt.usedExpressions ?? []) {
          const key = expression.expression.trim().toLowerCase();
          if (!key) {
            continue;
          }

          const existing = items.get(key);
          if (!existing) {
            items.set(key, {
              expression: expression.expression,
              count: 1,
              lastUsedAt: attempt.createdAt,
              latestTopic: session.topic,
              latestQuestionKo: session.questionKo,
              matchedText: expression.matchedText ?? null
            });
            continue;
          }

          existing.count += 1;
          if (attempt.createdAt > existing.lastUsedAt) {
            existing.lastUsedAt = attempt.createdAt;
            existing.latestTopic = session.topic;
            existing.latestQuestionKo = session.questionKo;
            existing.matchedText = expression.matchedText ?? null;
          }
        }
      }
    }

    return Array.from(items.values()).sort(
      (left, right) => right.count - left.count || right.lastUsedAt.localeCompare(left.lastUsedAt)
    );
  }, [history]);

  const historyByDate = useMemo(() => {
    return history.reduce<Record<string, HistorySession[]>>((accumulator, session) => {
      const dateKeys = new Set<string>([
        formatHistoryDateKey(session.createdAt),
        ...session.attempts.map((attempt) => formatHistoryDateKey(attempt.createdAt))
      ]);

      for (const dateKey of dateKeys) {
        if (!accumulator[dateKey]) {
          accumulator[dateKey] = [];
        }

        if (!accumulator[dateKey].some((existingSession) => existingSession.sessionId === session.sessionId)) {
          accumulator[dateKey].push(session);
        }
      }

      return accumulator;
    }, {});
  }, [history]);

  const historyDates = useMemo(
    () => Object.keys(historyByDate).sort((left, right) => right.localeCompare(left)),
    [historyByDate]
  );

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

  useEffect(() => {
    if (history.length === 0) {
      setOpenSessions({});
      return;
    }

    setOpenSessions((current) => {
      const next = { ...current };
      let changed = false;

      for (const session of history) {
        if (!(session.sessionId in next)) {
          next[session.sessionId] = false;
          changed = true;
        }
      }

      for (const existingKey of Object.keys(next)) {
        if (!history.some((session) => session.sessionId === existingKey)) {
          delete next[existingKey];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [history]);

  useEffect(() => {
    if (!selectedHistoryDate || !historyDates.includes(selectedHistoryDate)) {
      return;
    }

    setOpenDates((current) => {
      if (current[selectedHistoryDate]) {
        return current;
      }

      return {
        ...current,
        [selectedHistoryDate]: true
      };
    });

    setOpenSessions((current) => {
      const next = { ...current };
      let changed = false;

      for (const session of historyByDate[selectedHistoryDate] ?? []) {
        if (!next[session.sessionId]) {
          next[session.sessionId] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-history-date="${selectedHistoryDate}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [historyByDate, historyDates, selectedHistoryDate]);

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

  function toggleSession(sessionId: string) {
    setOpenSessions((current) => ({
      ...current,
      [sessionId]: !current[sessionId]
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
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span>표시 이름</span>
            <strong>{currentUser?.displayName}</strong>
          </div>
          <div className={styles.infoCard}>
            <span>이메일</span>
            <strong>{currentUser?.email}</strong>
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
              <span className={styles.historyEyebrow}>표현 히스토리</span>
              <h3>내가 실제로 써본 표현</h3>
            </div>
            <strong>{usedExpressionHistory.length}개 표현</strong>
          </div>

          {usedExpressionHistory.length === 0 ? (
            <div className={styles.historyEmpty}>
              <p>AI 코치가 추천한 표현을 실제 답변에 쓰면, 여기서 내가 써본 표현이 차곡차곡 쌓여요.</p>
            </div>
          ) : (
            <div className={styles.expressionHistoryGrid}>
              {usedExpressionHistory.map((expression) => (
                <article key={expression.expression} className={styles.expressionHistoryCard}>
                  <div className={styles.expressionHistoryCardTop}>
                    <strong>{expression.expression}</strong>
                    <span>{expression.count}회 사용</span>
                  </div>
                  <p>{expression.matchedText ?? expression.latestQuestionKo}</p>
                  <small>
                    {formatExpressionHistoryDate(expression.lastUsedAt)} · {expression.latestTopic}
                  </small>
                </article>
              ))}
            </div>
          )}
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
                <section
                  key={dateKey}
                  className={styles.historyDateGroup}
                  data-history-date={dateKey}
                >
                  <button
                    type="button"
                    className={styles.historyDateButton}
                    onClick={() => toggleDate(dateKey)}
                  >
                    <span className={styles.historyDateTitle}>{formatHistoryDateLabel(dateKey)}</span>
                    <span className={styles.historyDateToggle}>
                      {openDates[dateKey] ? "접기" : "펼치기"}
                    </span>
                  </button>

                  {openDates[dateKey] ? (
                    <div className={styles.historySessionList}>
                      {historyByDate[dateKey].map((session) => {
                        const comparisonView = buildHistoryComparisonView(session);

                        return (
                        <article key={session.sessionId} className={styles.historySessionCard}>
                          <button
                            type="button"
                            className={styles.historySessionButton}
                            onClick={() => toggleSession(session.sessionId)}
                          >
                            <div className={styles.historySessionInfo}>
                              <span className={styles.historyMeta}>
                                {session.topic} · {getDifficultyLabel(session.difficulty)}
                              </span>
                              <h4>{session.questionKo}</h4>
                              <p>{session.questionEn}</p>
                            </div>
                            <span className={styles.historySessionToggle}>
                              {openSessions[session.sessionId]
                                ? "답변 접기"
                                : `답변 ${session.attempts.length}개 보기`}
                            </span>
                          </button>
                          {openSessions[session.sessionId] ? (
                            <div className={styles.historySessionBody}>
                              {comparisonView ? (
                                <section className={styles.historyComparisonPanel}>
                                  <div className={styles.historyComparisonHeader}>
                                    <div>
                                      <strong>다시쓰기로 달라진 부분</strong>
                                      <p>
                                        첫 답변과 최근 다시쓰기를 나란히 보면서 바뀐 표현을 바로 확인해보세요.
                                      </p>
                                    </div>
                                    <span className={styles.historyComparisonCount}>
                                      바뀐 표현 {comparisonView.changedChunkCount}곳
                                    </span>
                                  </div>
                                  <div className={styles.historyComparisonStats}>
                                    <div className={styles.historyComparisonStat}>
                                      <strong>+{comparisonView.addedWordCount}</strong>
                                      <span>추가한 표현</span>
                                    </div>
                                    <div className={styles.historyComparisonStat}>
                                      <strong>-{comparisonView.removedWordCount}</strong>
                                      <span>정리한 표현</span>
                                    </div>
                                    <div className={styles.historyComparisonStat}>
                                      <strong>
                                        {comparisonView.afterWordCount - comparisonView.beforeWordCount >= 0
                                          ? "+"
                                          : ""}
                                        {comparisonView.afterWordCount - comparisonView.beforeWordCount}
                                      </strong>
                                      <span>전체 길이 변화</span>
                                    </div>
                                  </div>
                                  <div className={styles.historyComparisonGrid}>
                                    <section className={styles.historyComparisonColumn}>
                                      <div className={styles.historyComparisonMeta}>
                                        <strong className={styles.historyAttemptTypeInitial}>
                                          첫 답변 {comparisonView.initialAttempt.attemptNo}차
                                        </strong>
                                        <span>{formatHistoryTime(comparisonView.initialAttempt.createdAt)}</span>
                                      </div>
                                      <div className={styles.historyComparisonAnswer}>
                                        {comparisonView.initialSegments.map((segment, index) => (
                                          <span
                                            key={`initial-${comparisonView.initialAttempt.id}-${index}`}
                                            className={
                                              segment.changed
                                                ? styles.historyComparisonChangedBefore
                                                : undefined
                                            }
                                          >
                                            {segment.text}
                                          </span>
                                        ))}
                                      </div>
                                    </section>
                                    <section className={styles.historyComparisonColumn}>
                                      <div className={styles.historyComparisonMeta}>
                                        <strong className={styles.historyAttemptTypeRewrite}>
                                          다시쓰기 {comparisonView.rewriteAttempt.attemptNo}차
                                        </strong>
                                        <span>{formatHistoryTime(comparisonView.rewriteAttempt.createdAt)}</span>
                                      </div>
                                      <div className={styles.historyComparisonAnswer}>
                                        {comparisonView.rewriteSegments.map((segment, index) => (
                                          <span
                                            key={`rewrite-${comparisonView.rewriteAttempt.id}-${index}`}
                                            className={
                                              segment.changed
                                                ? styles.historyComparisonChangedAfter
                                                : undefined
                                            }
                                          >
                                            {segment.text}
                                          </span>
                                        ))}
                                      </div>
                                    </section>
                                  </div>
                                </section>
                              ) : null}
                              <div className={styles.historyAttemptList}>
                            {session.attempts.map((attempt) => (
                              <div
                                key={attempt.id}
                                className={`${styles.historyAttemptCard} ${
                                  attempt.attemptType === "INITIAL"
                                    ? styles.historyAttemptInitial
                                    : styles.historyAttemptRewrite
                                }`}
                              >
                                <div className={styles.historyAttemptMeta}>
                                  <strong
                                    className={
                                      attempt.attemptType === "INITIAL"
                                        ? styles.historyAttemptTypeInitial
                                        : styles.historyAttemptTypeRewrite
                                    }
                                  >
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
                                {attempt.usedExpressions.length > 0 ? (
                                  <div className={styles.historyUsedExpressionSection}>
                                    <span className={styles.historyUsedExpressionLabel}>
                                      이번에 실제로 써본 표현
                                    </span>
                                    <div className={styles.historyUsedExpressionList}>
                                      {attempt.usedExpressions.map((expression) => (
                                        <span
                                          key={`${attempt.id}-${expression.expression}`}
                                          className={styles.historyUsedExpressionChip}
                                        >
                                          {expression.expression}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                <details className={styles.historyFeedbackDetails}>
                                  <summary>피드백 전문 보기</summary>
                                  <div className={styles.historyFeedbackBody}>
                                    <InlineFeedbackPreview
                                      originalAnswer={attempt.answerText}
                                      correctedAnswer={attempt.feedback.correctedAnswer}
                                      inlineFeedback={attempt.feedback.inlineFeedback}
                                      grammarFeedback={attempt.feedback.grammarFeedback}
                                      compact
                                      variant="embedded"
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
                                      {filterSuggestedRefinementExpressions(
                                        attempt.feedback.refinementExpressions,
                                        attempt.answerText,
                                        attempt.feedback.correctedAnswer
                                      ).length > 0 ? (
                                        <div className={styles.historyFeedbackBlock}>
                                          <h5>모범답안에서 가져오면 좋은 표현</h5>
                                          <ul>
                                            {filterSuggestedRefinementExpressions(
                                              attempt.feedback.refinementExpressions,
                                              attempt.answerText,
                                              attempt.feedback.correctedAnswer
                                            ).map((expression, index) => (
                                              <li key={`${expression.expression}-${index}`}>
                                                <strong>{expression.expression}</strong>
                                                {expression.meaningKo ? <span>해석: {expression.meaningKo}</span> : null}
                                                {expression.guidanceKo ? <span>활용: {expression.guidanceKo}</span> : null}
                                                {expression.exampleEn ? (
                                                  <span className={styles.historyRefinementExample}>
                                                    예문: {expression.exampleEn}
                                                  </span>
                                                ) : null}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      <p className={styles.historyModelAnswer}>
                                        {attempt.feedback.modelAnswer}
                                      </p>
                                      {attempt.feedback.modelAnswerKo ? (
                                        <p className={styles.historyModelAnswerKo}>
                                          해석: {attempt.feedback.modelAnswerKo}
                                        </p>
                                      ) : null}
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
                            </div>
                          ) : null}
                        </article>
                        );
                      })}
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
      <main className={`${styles.page} ${styles.myPageShell}`}>
        <section className={styles.emptyCard}>
          <h2>내정보를 불러오는 중이에요</h2>
          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={`${styles.page} ${styles.myPageShell}`}>
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
    <main className={`${styles.page} ${styles.myPageShell}`}>
      <section className={styles.stackedHero}>
        <div className={styles.intro}>
          <div className={styles.eyebrow}>{activeTab === "account" ? "내 계정" : "작문 기록"}</div>
          <h1>
            {activeTab === "account"
              ? `${currentUser.displayName}님의 계정 설정`
              : `${currentUser.displayName}님의 작문 기록`}
          </h1>
          <p>
            {activeTab === "account"
              ? "표시 이름, 이메일, 로그인 방식과 비밀번호 변경처럼 계정 관련 설정만 이 화면에서 관리할 수 있어요."
              : "날짜별 작문 히스토리와 자주 받은 피드백을 모아 보고, 반복되는 패턴을 한눈에 확인할 수 있어요."}
          </p>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>
                {activeTab === "account" ? "계정 설정" : "학습 기록"}
              </div>
              <h2>{activeTab === "account" ? "내 계정" : "작문 기록"}</h2>
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
