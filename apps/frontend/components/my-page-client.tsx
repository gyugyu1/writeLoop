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
import { getFeedbackLevelInfo } from "../lib/feedback-level";
import type { AuthUser, CommonMistake, HistorySession, TodayWritingStatus } from "../lib/types";
import styles from "./auth-page.module.css";

type MyPageTab = "account" | "writing";
type AccountSectionKey = "profile" | "delete";
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

type WritingSectionKey = "expressions" | "feedback" | "history";

const EXPRESSION_HISTORY_PREVIEW_COUNT = 8;
const ATTEMPT_USED_EXPRESSION_PREVIEW_COUNT = 4;

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

/*
function getLoginMethodLabel(user: AuthUser) {
  switch (user.socialProvider) {
    case "NAVER":
      return "??쇱뵠甕?;
    case "GOOGLE":
      return "?닌?";
    case "KAKAO":
      return "燁삳똻萸??;
    default:
      return user.email;
  }
}

*/

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

function getProfileBadgeText(name: string) {
  const normalized = Array.from(name.trim().replace(/\s+/g, ""));
  if (normalized.length === 0) {
    return "WL";
  }

  return normalized.slice(0, 2).join("").toUpperCase();
}

function formatHistoryCardDate(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateTime));
}

function getHistoryWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getLatestSessionTimestamp(session: HistorySession) {
  return session.attempts[session.attempts.length - 1]?.createdAt ?? session.updatedAt ?? session.createdAt;
}

function getHistoryStatusVariant(score: number, loopComplete: boolean) {
  if (loopComplete || score >= 92) {
    return "perfect";
  }

  if (score >= 80) {
    return "good";
  }

  return "warm";
}

function parseMyPageTab(): MyPageTab {
  if (typeof window === "undefined") {
    return "writing";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "account" ? "account" : "writing";
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
  const [activeTab, setActiveTab] = useState<MyPageTab>("writing");
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [commonMistakes, setCommonMistakes] = useState<CommonMistake[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [mistakeError, setMistakeError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setOpenDates] = useState<Record<string, boolean>>({});
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
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [showAllExpressionHistory, setShowAllExpressionHistory] = useState(false);
  const [expandedAttemptExpressions, setExpandedAttemptExpressions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    function syncTabFromUrl() {
      setActiveTab(parseMyPageTab());
      setSelectedHistoryDate(parseHistoryDateParam());
    }

    function handleTabChange(event: Event) {
      const detail = (event as CustomEvent<{ tab?: MyPageTab }>).detail;
      const nextTab = detail?.tab === "account" ? "account" : "writing";
      setActiveTab(nextTab);
      setSelectedHistoryDate(parseHistoryDateParam());
    }

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    window.addEventListener("writeloop:tab-change", handleTabChange);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
      window.removeEventListener("writeloop:tab-change", handleTabChange);
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
          setHistoryError("작문 기록을 아직 불러오지 못했어요.");
          setMistakeError("자주 받은 피드백을 아직 불러오지 못했어요.");
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

  const visibleExpressionHistory = useMemo(
    () =>
      showAllExpressionHistory
        ? usedExpressionHistory
        : usedExpressionHistory.slice(0, EXPRESSION_HISTORY_PREVIEW_COUNT),
    [showAllExpressionHistory, usedExpressionHistory]
  );

  const hiddenExpressionHistoryCount = Math.max(
    0,
    usedExpressionHistory.length - visibleExpressionHistory.length
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
    if (usedExpressionHistory.length <= EXPRESSION_HISTORY_PREVIEW_COUNT && showAllExpressionHistory) {
      setShowAllExpressionHistory(false);
    }
  }, [showAllExpressionHistory, usedExpressionHistory.length]);

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
    const validAttemptIds = new Set<string>(
      history.flatMap((session) => session.attempts.map((attempt) => String(attempt.id)))
    );

    setExpandedAttemptExpressions((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([attemptId]) => validAttemptIds.has(attemptId))
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
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

  function toggleSession(sessionId: string) {
    setOpenSessions((current) => ({
      ...current,
      [sessionId]: !current[sessionId]
    }));
  }

  function toggleAttemptExpressions(attemptId: string) {
    setExpandedAttemptExpressions((current) => ({
      ...current,
      [attemptId]: !current[attemptId]
    }));
  }

  function shouldCollapseAttemptExpressions(attempt: HistorySession["attempts"][number]) {
    return attempt.usedExpressions.length > ATTEMPT_USED_EXPRESSION_PREVIEW_COUNT;
  }

  function getVisibleAttemptExpressions(attempt: HistorySession["attempts"][number]) {
    const attemptKey = String(attempt.id);
    if (!shouldCollapseAttemptExpressions(attempt) || expandedAttemptExpressions[attemptKey]) {
      return attempt.usedExpressions;
    }
    return attempt.usedExpressions.slice(0, ATTEMPT_USED_EXPRESSION_PREVIEW_COUNT);
  }

  function getHiddenAttemptExpressionCount(attempt: HistorySession["attempts"][number]) {
    return Math.max(0, attempt.usedExpressions.length - getVisibleAttemptExpressions(attempt).length);
  }

  /*
  function renderWritingHistoryFeedbackDetails(attempt?: HistorySession["attempts"][number]) {
    if (!attempt) {
      return null;
    }

    const suggestedExpressions = filterSuggestedRefinementExpressions(
      attempt.feedback.refinementExpressions,
      attempt.answerText,
      attempt.feedback.correctedAnswer
    );
    const rewriteSuggestions = attempt.feedback.ui?.rewriteSuggestions ?? [];
    const fixPoints =
      attempt.feedback.ui?.fixPoints?.filter((point) => {
        if (!point || point.kind === "EXPRESSION") {
          return false;
        }
        return Boolean(
          point.headline?.trim() ||
            point.originalText?.trim() ||
            point.revisedText?.trim() ||
            point.supportText?.trim()
        );
      }) ?? [];
    const feedbackSummary = attempt.feedback.summary?.trim() ?? "";
    const modelAnswer = attempt.feedback.modelAnswer?.trim() ?? "";
    const modelAnswerKo = attempt.feedback.modelAnswerKo?.trim() ?? "";
    const rewriteChallenge = attempt.feedback.rewriteChallenge?.trim() ?? "";
    const completionMessage = attempt.feedback.completionMessage?.trim() ?? "";
    const hasModelAnswerSection = Boolean(modelAnswer) || Boolean(modelAnswerKo) || suggestedExpressions.length > 0;
    const hasRefineSection = fixPoints.length > 0;
    const hasStrengthsSection = attempt.feedback.strengths.length > 0;
    const hasNextLoopSection =
      Boolean(rewriteChallenge) || rewriteSuggestions.length > 0 || Boolean(completionMessage);

    return (
      <details className={styles.writingHistoryFeedbackDetails}>
        <summary>
          <span>??곕굡獄??袁ⓓ?癰귣떯由?/span>
          <span className={`material-symbols-outlined ${styles.writingHistoryFeedbackSummaryIcon}`}>
            expand_more
          </span>
        </summary>

        <div className={styles.writingHistoryFeedbackBody}>
          <div className={styles.writingHistoryFeedbackPreview}>
            <InlineFeedbackPreview
              originalAnswer={attempt.answerText}
              correctedAnswer={attempt.feedback.correctedAnswer}
              fixPoints={fixPoints}
              compact
              variant="embedded"
            />
          </div>

          <div className={styles.writingHistoryFeedbackGrid}>
            {feedbackSummary ? (
              <section className={styles.writingHistoryFeedbackCard}>
                <span className={styles.writingHistoryFeedbackLabel}>Summary</span>
                <h5>?袁⑷퍥 ?遺용튋</h5>
                <p>{feedbackSummary}</p>
              </section>
            ) : null}

            {attempt.feedback.strengths.length > 0 ? (
              <section className={styles.writingHistoryFeedbackCard}>
                <span className={styles.writingHistoryFeedbackLabel}>Strengths</span>
                <h5>??묐립 ??/h5>
                <ul className={styles.writingHistoryFeedbackBulletList}>
                  {attempt.feedback.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {fixPoints.length > 0 ? (
              <section className={styles.writingHistoryFeedbackCard}>
                <span className={styles.writingHistoryFeedbackLabel}>Refine</span>
                <h5>?⑥쥙?쒑퉪???/h5>
                <div className={styles.writingHistoryFeedbackCorrectionList}>
                  {fixPoints.map((point, index) => (
                    <article
                      key={`${point.headline ?? point.originalText ?? point.revisedText ?? index}`}
                      className={styles.writingHistoryFeedbackCorrectionItem}
                    >
                      <strong>{point.headline ?? point.originalText ?? "??甕?????삳쾳??癰귣떯由?}</strong>
                      {point.supportText?.trim() ? <p>{point.supportText}</p> : null}
                      {!point.supportText?.trim() && point.revisedText?.trim() ? <p>{point.revisedText}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : attempt.feedback.corrections.length > 0 ? (
              <section className={styles.writingHistoryFeedbackCard}>
                <span className={styles.writingHistoryFeedbackLabel}>Refine</span>
                <h5>?⑥쥙?쒑퉪???/h5>
                <div className={styles.writingHistoryFeedbackCorrectionList}>
                  {attempt.feedback.corrections.map((correction) => (
                    <article
                      key={`${correction.issue}-${correction.suggestion}`}
                      className={styles.writingHistoryFeedbackCorrectionItem}
                    >
                      <strong>{correction.issue}</strong>
                      <p>{correction.suggestion}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {hasModelAnswerSection ? (
              <section className={styles.writingHistoryFeedbackCard}>
                <span className={styles.writingHistoryFeedbackLabel}>Model Answer</span>
                <h5>筌뤴뫀苡????툧</h5>
                {modelAnswer ? <p className={styles.writingHistoryFeedbackModelAnswer}>{modelAnswer}</p> : null}
                {modelAnswerKo ? (
                  <p className={styles.writingHistoryFeedbackModelAnswerKo}>??곴퐤: {modelAnswerKo}</p>
                ) : null}
                {suggestedExpressions.length > 0 ? (
                  <div className={styles.writingHistoryFeedbackSuggestionSection}>
                    <strong>揶쎛?紐꾩궎筌??ル뿭? ??쀬겱</strong>
                    <div className={styles.writingHistoryFeedbackSuggestionList}>
                      {suggestedExpressions.map((expression, index) => (
                        <span
                          key={`${expression.expression}-${index}`}
                          className={styles.writingHistoryFeedbackSuggestionChip}
                        >
                          {expression.expression}
                        </span>
                      ))}
                    </div>
                    <div className={styles.writingHistoryFeedbackExpressionList}>
                      {suggestedExpressions.map((expression, index) => (
                        <article
                          key={`${expression.expression}-detail-${index}`}
                          className={styles.writingHistoryFeedbackExpressionItem}
                        >
                          <strong>{expression.expression}</strong>
                          {expression.meaningKo ? (
                            <p className={styles.writingHistoryFeedbackExpressionMeaning}>
                              {expression.meaningKo}
                            </p>
                          ) : null}
                          {expression.guidanceKo ? <p>{expression.guidanceKo}</p> : null}
                          {expression.exampleEn ? (
                            <p className={styles.writingHistoryFeedbackExpressionExample}>
                              {expression.exampleEn}
                            </p>
                          ) : null}
                          {expression.exampleKo ? <p>{expression.exampleKo}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {hasNextLoopSection ? (
              <section className={styles.writingHistoryFeedbackCard}>
                <span className={styles.writingHistoryFeedbackLabel}>Next Loop</span>
                {rewriteChallenge ? (
                  <>
                    <h5>??쇰뻻?怨뚮┛ 揶쎛??諭?/h5>
                    <p>{rewriteChallenge}</p>
                  </>
                ) : null}
                {rewriteSuggestions.length > 0 ? (
                  <div className={styles.writingHistoryFeedbackRewriteSuggestions}>
                    <strong>?????얜챷???곗쨮 ?類ㅼ삢??癰귣똻苑??/strong>
                    <ul className={styles.writingHistoryFeedbackBulletList}>
                      {rewriteSuggestions.map((suggestion, index) => (
                        <li key={`${suggestion.english}-${index}`}>
                          <span className={styles.writingHistoryFeedbackRewriteSuggestionEn}>
                            {suggestion.english}
                          </span>
                          {suggestion.meaningKo ? <span>{suggestion.meaningKo}</span> : null}
                          {suggestion.noteKo ? <span>{suggestion.noteKo}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {completionMessage ? (
                  <div className={styles.writingHistoryFeedbackCompletion}>
                    <strong>?袁⑥┷ ??덇땀</strong>
                    <p>{completionMessage}</p>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </details>
    );
  }

  */

  function renderWritingHistoryFeedbackDetails(attempt?: HistorySession["attempts"][number]) {
    if (!attempt) {
      return null;
    }

    const suggestedExpressions = filterSuggestedRefinementExpressions(
      attempt.feedback.refinementExpressions,
      attempt.answerText,
      attempt.feedback.correctedAnswer
    );
    const rewriteSuggestions = attempt.feedback.ui?.rewriteSuggestions ?? [];
    const fixPoints =
      attempt.feedback.ui?.fixPoints?.filter((point) => {
        if (!point || point.kind === "EXPRESSION") {
          return false;
        }

        return Boolean(
          point.headline?.trim() ||
            point.originalText?.trim() ||
            point.revisedText?.trim() ||
            point.supportText?.trim()
        );
      }) ?? [];
    const feedbackSummary = attempt.feedback.summary?.trim() ?? "";
    const modelAnswer = attempt.feedback.modelAnswer?.trim() ?? "";
    const modelAnswerKo = attempt.feedback.modelAnswerKo?.trim() ?? "";
    const rewriteChallenge = attempt.feedback.rewriteChallenge?.trim() ?? "";
    const completionMessage = attempt.feedback.completionMessage?.trim() ?? "";
    const hasModelAnswerSection = Boolean(modelAnswer) || Boolean(modelAnswerKo) || suggestedExpressions.length > 0;
    const hasRefineSection = fixPoints.length > 0;
    const hasStrengthsSection = attempt.feedback.strengths.length > 0;
    const hasNextLoopSection =
      Boolean(rewriteChallenge) || rewriteSuggestions.length > 0 || Boolean(completionMessage);

    return (
      <details className={styles.writingHistoryFeedbackDetails}>
        <summary>
          <span>피드백 전문 보기</span>
          <span className={`material-symbols-outlined ${styles.writingHistoryFeedbackSummaryIcon}`}>
            expand_more
          </span>
        </summary>

        <div className={styles.writingHistoryFeedbackBody}>
          <div className={styles.writingHistoryFeedbackGrid}>
            {feedbackSummary ? (
              <section
                className={`${styles.writingHistoryFeedbackCard} ${styles.writingHistoryFeedbackCardFull}`}
              >
                <span className={styles.writingHistoryFeedbackLabel}>요약</span>
                <p>{feedbackSummary}</p>
              </section>
            ) : null}

            {hasStrengthsSection || hasRefineSection ? (
              <div className={styles.writingHistoryFeedbackColumn}>
                {hasStrengthsSection ? (
                  <section className={styles.writingHistoryFeedbackCard}>
                    <span className={styles.writingHistoryFeedbackLabel}>잘한 점</span>
                    <ul className={styles.writingHistoryFeedbackBulletList}>
                      {attempt.feedback.strengths.map((strength) => (
                        <li key={strength}>{strength}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {fixPoints.length > 0 ? (
                  <section className={styles.writingHistoryFeedbackCard}>
                    <span className={styles.writingHistoryFeedbackLabel}>고쳐야 할 점</span>
                    <div className={styles.writingHistoryFeedbackCorrectionList}>
                      {fixPoints.map((point, index) => (
                        <article
                          key={`${point.headline ?? point.originalText ?? point.revisedText ?? index}`}
                          className={styles.writingHistoryFeedbackCorrectionItem}
                        >
                          <strong>{point.headline ?? point.originalText ?? "한 번 더 다듬어 보기"}</strong>
                          {point.supportText?.trim() ? <p>{point.supportText}</p> : null}
                          {!point.supportText?.trim() && point.revisedText?.trim() ? <p>{point.revisedText}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {hasModelAnswerSection || hasNextLoopSection ? (
              <div className={styles.writingHistoryFeedbackColumn}>
                {hasModelAnswerSection ? (
                  <section className={styles.writingHistoryFeedbackCard}>
                    <span className={styles.writingHistoryFeedbackLabel}>예시 답변</span>
                    {modelAnswer ? <p className={styles.writingHistoryFeedbackModelAnswer}>{modelAnswer}</p> : null}
                    {modelAnswerKo ? (
                      <p className={styles.writingHistoryFeedbackModelAnswerKo}>{`해석: ${modelAnswerKo}`}</p>
                    ) : null}
                    {suggestedExpressions.length > 0 ? (
                      <div className={styles.writingHistoryFeedbackSuggestionSection}>
                        <strong>가져오면 좋은 표현</strong>
                        <div className={styles.writingHistoryFeedbackSuggestionList}>
                          {suggestedExpressions.map((expression, index) => (
                            <span
                              key={`${expression.expression}-${index}`}
                              className={styles.writingHistoryFeedbackSuggestionChip}
                            >
                              {expression.expression}
                            </span>
                          ))}
                        </div>
                        <div className={styles.writingHistoryFeedbackExpressionList}>
                          {suggestedExpressions.map((expression, index) => (
                            <article
                              key={`${expression.expression}-detail-${index}`}
                              className={styles.writingHistoryFeedbackExpressionItem}
                            >
                              <strong>{expression.expression}</strong>
                              {expression.meaningKo ? (
                                <p className={styles.writingHistoryFeedbackExpressionMeaning}>
                                  {expression.meaningKo}
                                </p>
                              ) : null}
                              {expression.guidanceKo ? <p>{expression.guidanceKo}</p> : null}
                              {expression.exampleEn ? (
                                <p className={styles.writingHistoryFeedbackExpressionExample}>
                                  {expression.exampleEn}
                                </p>
                              ) : null}
                              {expression.exampleKo ? <p>{expression.exampleKo}</p> : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {hasNextLoopSection ? (
                  <section className={styles.writingHistoryFeedbackCard}>
                    <span className={styles.writingHistoryFeedbackLabel}>다시쓰기 가이드</span>
                    {rewriteChallenge ? <p>{rewriteChallenge}</p> : null}
                    {rewriteSuggestions.length > 0 ? (
                      <div className={styles.writingHistoryFeedbackRewriteSuggestions}>
                        <strong>이런 문장으로 확장해 보세요</strong>
                        <ul className={styles.writingHistoryFeedbackBulletList}>
                          {rewriteSuggestions.map((suggestion, index) => (
                            <li key={`${suggestion.english}-${index}`}>
                              <span className={styles.writingHistoryFeedbackRewriteSuggestionEn}>
                                {suggestion.english}
                              </span>
                              {suggestion.meaningKo ? <span>{suggestion.meaningKo}</span> : null}
                              {suggestion.noteKo ? <span>{suggestion.noteKo}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {completionMessage ? (
                      <div className={styles.writingHistoryFeedbackCompletion}>
                        <strong>완료 안내</strong>
                        <p>{completionMessage}</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </details>
    );
  }

  /*
  function renderWritingHistoryAttemptTimeline(session: HistorySession) {
    return (
      <div className={styles.historyAttemptList}>
        {session.attempts.map((attempt) => (
          <article
            key={attempt.id}
            className={`${styles.historyAttemptCard} ${
              attempt.attemptType === "INITIAL" ? styles.historyAttemptInitial : styles.historyAttemptRewrite
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
                {attempt.attemptNo}筌???곕굡獄?              </strong>
              <span>
                {attempt.attemptType === "INITIAL" ? "筌????" : "??쇰뻻?怨뚮┛"} 夷?" "}
                {getFeedbackLevelInfo(attempt.score, attempt.feedback.loopComplete).label} 夷?" "}
                {formatHistoryTime(attempt.createdAt)}
              </span>
            </div>

            <p className={styles.historyAnswer}>{attempt.answerText}</p>
            {attempt.feedbackSummary ? <p className={styles.historySummary}>{attempt.feedbackSummary}</p> : null}

            {attempt.usedExpressions.length > 0 ? (
              <div className={styles.historyUsedExpressionSection}>
                <span className={styles.historyUsedExpressionLabel}>??苡????쇱젫嚥???癰???쀬겱</span>
                <div className={styles.historyUsedExpressionList}>
                  {getVisibleAttemptExpressions(attempt).map((expression) => (
                    <span
                      key={`${attempt.id}-${expression.expression}`}
                      className={styles.historyUsedExpressionChip}
                    >
                      {expression.expression}
                    </span>
                  ))}
                </div>
                {shouldCollapseAttemptExpressions(attempt) ? (
                  <button
                    type="button"
                    className={styles.historyInlineToggle}
                    onClick={() => toggleAttemptExpressions(String(attempt.id))}
                  >
                    {expandedAttemptExpressions[String(attempt.id)]
                      ? "??쀬겱 ?臾믩선?癒?┛"
                      : `??쀬겱 ${getHiddenAttemptExpressionCount(attempt)}揶???癰귣떯由?}
                  </button>
                ) : null}
              </div>
            ) : null}

            {renderWritingHistoryFeedbackDetails(attempt)}
          </article>
        ))}
      </div>
    );
  }

  */

  function renderWritingHistoryAttemptTimeline(session: HistorySession) {
    return (
      <div className={styles.historyAttemptList}>
        {session.attempts.map((attempt) => (
          <article
            key={attempt.id}
            className={`${styles.historyAttemptCard} ${
              attempt.attemptType === "INITIAL" ? styles.historyAttemptInitial : styles.historyAttemptRewrite
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
                {`${attempt.attemptNo}차 피드백`}
              </strong>
              <span>
                {attempt.attemptType === "INITIAL" ? "초안" : "다시쓰기"} ·{" "}
                {getFeedbackLevelInfo(attempt.score, attempt.feedback.loopComplete).label} ·{" "}
                {formatHistoryTime(attempt.createdAt)}
              </span>
            </div>

            <p className={styles.historyAnswer}>{attempt.answerText}</p>
            {attempt.feedbackSummary ? <p className={styles.historySummary}>{attempt.feedbackSummary}</p> : null}

            {attempt.usedExpressions.length > 0 ? (
              <div className={styles.historyUsedExpressionSection}>
                <span className={styles.historyUsedExpressionLabel}>이번 답변에서 쓴 표현</span>
                <div className={styles.historyUsedExpressionList}>
                  {getVisibleAttemptExpressions(attempt).map((expression) => (
                    <span key={`${attempt.id}-${expression.expression}`} className={styles.historyUsedExpressionChip}>
                      {expression.expression}
                    </span>
                  ))}
                </div>
                {shouldCollapseAttemptExpressions(attempt) ? (
                  <button
                    type="button"
                    className={styles.historyInlineToggle}
                    onClick={() => toggleAttemptExpressions(String(attempt.id))}
                  >
                    {expandedAttemptExpressions[String(attempt.id)]
                      ? "표현 접기"
                      : `표현 ${getHiddenAttemptExpressionCount(attempt)}개 더 보기`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {renderWritingHistoryFeedbackDetails(attempt)}
          </article>
        ))}
      </div>
    );
  }

  /*
  function renderWritingHistoryExpandedContent(
    session: HistorySession,
    comparisonView: HistoryComparisonView | null,
    latestAttempt: HistorySession["attempts"][number] | undefined,
    improvedText: string,
    promptLabel: string,
    promptText: string,
    containerClassName: string
  ) {
    return (
      <div className={containerClassName}>
        <div className={styles.writingHistoryPromptCard}>
          <span>{promptLabel}</span>
          <p>{promptText}</p>
        </div>

        <div className={styles.writingHistoryFeaturedColumns}>
          <section className={styles.writingHistoryDraftColumn}>
            <h4>???λ뜆釉?/h4>
            <div className={styles.writingHistoryDraftBody}>
              {comparisonView
                ? comparisonView.initialSegments.map((segment, index) => (
                    <span
                      key={`initial-row-${comparisonView.initialAttempt.id}-${index}`}
                      className={segment.changed ? styles.historyComparisonChangedBefore : undefined}
                    >
                      {segment.text}
                    </span>
                  ))
                : session.attempts[0]?.answerText}
            </div>
          </section>

          <section className={styles.writingHistoryDraftColumn}>
            <h4>
              <span className="material-symbols-outlined">magic_button</span>
              揶쏆뮇苑?甕곌쑴??            </h4>
            <div className={`${styles.writingHistoryDraftBody} ${styles.writingHistoryDraftBodyImproved}`}>
              {comparisonView
                ? comparisonView.rewriteSegments.map((segment, index) => (
                    <span
                      key={`rewrite-row-${comparisonView.rewriteAttempt.id}-${index}`}
                      className={segment.changed ? styles.historyComparisonChangedAfter : undefined}
                    >
                      {segment.text}
                    </span>
                  ))
                : improvedText}
            </div>
          </section>
        </div>

        {latestAttempt?.feedbackSummary ? (
          <div className={styles.writingHistoryExpandedSummary}>
            <span className="material-symbols-outlined">auto_awesome</span>
            <p>{latestAttempt.feedbackSummary}</p>
          </div>
        ) : null}

        {renderWritingHistoryAttemptTimeline(session)}
      </div>
    );
  }

  */

  function renderWritingHistoryExpandedContent(
    session: HistorySession,
    comparisonView: HistoryComparisonView | null,
    latestAttempt: HistorySession["attempts"][number] | undefined,
    improvedText: string,
    promptLabel: string,
    promptText: string,
    containerClassName: string
  ) {
    return (
      <div className={containerClassName}>
        <div className={styles.writingHistoryPromptCard}>
          <span>{promptLabel}</span>
          <p>{promptText}</p>
        </div>

        <div className={styles.writingHistoryFeaturedColumns}>
          <section className={styles.writingHistoryDraftColumn}>
            <h4>내 초안</h4>
            <div className={styles.writingHistoryDraftBody}>
              {comparisonView
                ? comparisonView.initialSegments.map((segment, index) => (
                    <span
                      key={`initial-row-${comparisonView.initialAttempt.id}-${index}`}
                      className={segment.changed ? styles.historyComparisonChangedBefore : undefined}
                    >
                      {segment.text}
                    </span>
                  ))
                : session.attempts[0]?.answerText}
            </div>
          </section>

          <section className={styles.writingHistoryDraftColumn}>
            <h4>
              <span className="material-symbols-outlined">magic_button</span>
              개선 버전
            </h4>
            <div className={`${styles.writingHistoryDraftBody} ${styles.writingHistoryDraftBodyImproved}`}>
              {comparisonView
                ? comparisonView.rewriteSegments.map((segment, index) => (
                    <span
                      key={`rewrite-row-${comparisonView.rewriteAttempt.id}-${index}`}
                      className={segment.changed ? styles.historyComparisonChangedAfter : undefined}
                    >
                      {segment.text}
                    </span>
                  ))
                : improvedText}
            </div>
          </section>
        </div>

        {latestAttempt?.feedbackSummary ? (
          <div className={styles.writingHistoryExpandedSummary}>
            <span className="material-symbols-outlined">auto_awesome</span>
            <p>{latestAttempt.feedbackSummary}</p>
          </div>
        ) : null}

        {renderWritingHistoryAttemptTimeline(session)}
      </div>
    );
  }

  function goHome() {
    window.location.assign("/");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function scrollToWritingSection(section: WritingSectionKey) {
    const sectionId =
      section === "expressions"
        ? "writing-expressions-section"
        : section === "feedback"
          ? "writing-feedback-section"
          : "writing-history-section";

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function scrollToAccountSection(section: AccountSectionKey) {
    const sectionId =
      section === "profile" ? "account-profile-section" : "account-delete-section";

    if (section === "delete") {
      setIsDangerZoneOpen(true);
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function setTab(tab: MyPageTab) {
    setActiveTab(tab);
    window.history.replaceState({}, "", `/me?tab=${tab}`);
    notifyTabChange(tab);
  }

  async function handleSaveProfile() {
    if (!currentUser) {
      return;
    }

    if (!profileDisplayName.trim()) {
      setProfileError("표시 이름을 입력해 주세요.");
      return;
    }

    const wantsPasswordChange =
      Boolean(currentPassword.trim()) ||
      Boolean(newPassword.trim()) ||
      Boolean(confirmNewPassword.trim());

    if (wantsPasswordChange) {
      if (currentUser.socialProvider) {
        setProfileError("소셜 로그인 계정은 이 화면에서 비밀번호를 변경할 수 없어요.");
        return;
      }

      if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
        setProfileError("비밀번호를 바꾸려면 현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setProfileError("새 비밀번호와 확인 비밀번호가 서로 다릅니다.");
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
      setProfileNotice("프로필 설정을 저장했어요.");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setProfileError(caughtError.message);
      } else {
        setProfileError("프로필 설정을 저장하지 못했어요.");
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
      setDeleteError("계정을 삭제하려면 확인 문구에 '탈퇴'를 입력해 주세요.");
      return;
    }

    if (!currentUser.socialProvider && !deletePassword.trim()) {
      setDeleteError("계정을 삭제하려면 현재 비밀번호를 입력해 주세요.");
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
        setDeleteError("계정을 삭제하지 못했어요.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  }

  /*
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderAccountTab() {
    return (
      <>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span>??뽯뻻 ??已?/span>
            <strong>{currentUser?.displayName}</strong>
          </div>
          <div className={styles.infoCard}>
            <span>??李??/span>
            <strong>{currentUser?.email}</strong>
          </div>
          <div className={styles.infoCard}>
            <span>嚥≪뮄???獄쎻뫗??/span>
            <strong>{currentUser ? getLoginMethodLabel(currentUser) : "-"}</strong>
          </div>
        </div>

        <div
          id="account-profile-section"
          className={`${styles.historySection} ${styles.historySectionAnchor}`}
        >
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.historyEyebrow}>?④쑴????쇱젟</span>
              <h3>???④쑴????륁젟</h3>
            </div>
          </div>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>??已?/span>
              <input
                className={styles.input}
                value={profileDisplayName}
                onChange={(event) => setProfileDisplayName(event.target.value)}
                placeholder="??뽯뻻 ??已????낆젾??雅뚯눘苑??
              />
            </label>

            {currentUser?.socialProvider ? (
              <p className={styles.subText}>????嚥≪뮄????④쑴??? ?袁⑹삺 ??已ワ쭕???륁젟??????됰선??</p>
            ) : (
              <>
                <label className={styles.field}>
                  <span>?袁⑹삺 ??쑬?甕곕뜇??/span>
                  <input
                    className={styles.input}
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="??쑬?甕곕뜇?뉒몴?獄쏅떽? ???춸 ??낆젾??雅뚯눘苑??
                  />
                </label>
                <label className={styles.field}>
                  <span>????쑬?甕곕뜇??/span>
                  <input
                    className={styles.input}
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="????쑬?甕곕뜇?뉒몴???낆젾??雅뚯눘苑??
                  />
                </label>
                <label className={styles.field}>
                  <span>????쑬?甕곕뜇???類ㅼ뵥</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="????쑬?甕곕뜇?뉒몴???甕?????낆젾??雅뚯눘苑??
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
              {isSavingProfile ? "????餓?.." : "???④쑴??????}
            </button>
            <button type="button" className={styles.ghostButton} onClick={goHome}>
              ??됱몵嚥????툡揶쎛疫?            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "筌ｌ꼶??餓?.." : "嚥≪뮄??袁⑹뜍"}
            </button>
          </div>

          {profileNotice ? <p className={styles.notice}>{profileNotice}</p> : null}
          {profileError ? <p className={styles.error}>{profileError}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div
          id="account-delete-section"
          className={`${styles.historySection} ${styles.historySectionAnchor}`}
        >
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.historyEyebrow}>?袁る퓮 ?닌딅열</span>
              <h3>???뜚 ??딅닚</h3>
            </div>
          </div>

          <p className={styles.subText}>
            ???뜚 ??딅닚??筌욊쑵六??롢늺 ?④쑴???類ｋ궖, ?臾먒?疫꿸퀡以? ?癒?짗 嚥≪뮄????類ｋ궖揶쎛 ??ｍ뜞 ?????랁???쇰뻻 癰귣벀???????곷선??
          </p>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>?類ㅼ뵥 ?얜㈇??/span>
              <input
                className={styles.input}
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                placeholder="??딅닚 ??⑦???낆젾??雅뚯눘苑??
              />
            </label>

            {!currentUser?.socialProvider ? (
              <label className={styles.field}>
                <span>?袁⑹삺 ??쑬?甕곕뜇??/span>
                <input
                  className={styles.input}
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="???뜚 ??딅닚 ?類ㅼ뵥????쑬?甕곕뜇?뉒몴???낆젾??雅뚯눘苑??
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
              {isDeletingAccount ? "筌ｌ꼶??餓?.." : "???뜚 ??딅닚"}
            </button>
          </div>

          {deleteError ? <p className={styles.error}>{deleteError}</p> : null}
        </div>
      </>
    );
  }

  */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderAccountTab() {
    return renderAccountSettingsPage();
  }

  function renderAccountSettingsPage() {
    const loginMethodLabel = currentUser
      ? currentUser.socialProvider
        ? getLoginMethodLabel(currentUser)
        : "이메일 로그인"
      : "-";

    return (
      <section className={styles.accountSettingsLayout}>
        <div className={styles.accountPageTitle}>
          <h1>내 정보</h1>
          <p>프로필과 계정 보안 설정을 한 곳에서 관리해 보세요.</p>
        </div>

        <div className={styles.accountSettingsGrid}>
          <aside className={styles.accountSidebarCard}>
            <div className={styles.accountAvatarWrap}>
              <div className={styles.accountAvatarBadge}>{getProfileBadgeText(currentUser?.displayName ?? "")}</div>
              <span className={styles.accountAvatarStatus}>
                <span className="material-symbols-outlined">edit</span>
              </span>
            </div>
            <h2 className={styles.accountSidebarName}>{currentUser?.displayName}</h2>
            <p className={styles.accountSidebarEmail}>{currentUser?.email}</p>

            <div className={styles.accountSidebarMeta}>
              <span>로그인 방식</span>
              <strong>{loginMethodLabel}</strong>
            </div>

            <div className={styles.accountSidebarActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => scrollToAccountSection("profile")}
              >
                프로필 수정
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => scrollToAccountSection("delete")}
              >
                회원 탈퇴
              </button>
            </div>
          </aside>

          <div className={styles.accountSettingsMain}>
            <section
              id="account-profile-section"
              className={`${styles.accountFormCard} ${styles.historySectionAnchor}`}
            >
              <div className={styles.accountSectionHeader}>
                <h3>
                  <span className="material-symbols-outlined">person_edit</span>
                  프로필과 보안 설정
                </h3>
                <p>표시 이름과 비밀번호를 이곳에서 수정할 수 있어요.</p>
              </div>

              <div className={`${styles.form} ${styles.accountFieldGrid}`}>
                <label className={styles.field}>
                  <span>표시 이름</span>
                  <input
                    className={styles.input}
                    value={profileDisplayName}
                    onChange={(event) => setProfileDisplayName(event.target.value)}
                    placeholder="표시 이름을 입력해 주세요."
                  />
                </label>

                {currentUser?.socialProvider ? (
                  <div className={styles.accountReadonlyNotice}>
                    <strong>소셜 로그인 계정</strong>
                    <p>소셜 로그인 계정은 이 화면에서 비밀번호를 변경할 수 없어요.</p>
                  </div>
                ) : (
                  <>
                    <label className={styles.field}>
                      <span>현재 비밀번호</span>
                      <input
                        className={styles.input}
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        placeholder="현재 비밀번호를 입력해 주세요."
                      />
                    </label>
                    <label className={styles.field}>
                      <span>새 비밀번호</span>
                      <input
                        className={styles.input}
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="새 비밀번호를 입력해 주세요."
                      />
                    </label>
                    <label className={styles.field}>
                      <span>새 비밀번호 확인</span>
                      <input
                        className={styles.input}
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="새 비밀번호를 한 번 더 입력해 주세요."
                      />
                    </label>
                  </>
                )}
              </div>

              <div className={styles.accountPrimaryAction}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSaveProfile()}
                  disabled={isSavingProfile}
                >
                  <span className="material-symbols-outlined">save</span>
                  {isSavingProfile ? "저장 중..." : "프로필 저장"}
                </button>
              </div>

              {profileNotice ? <p className={styles.notice}>{profileNotice}</p> : null}
              {profileError ? <p className={styles.error}>{profileError}</p> : null}
              {error ? <p className={styles.error}>{error}</p> : null}
            </section>

            <section
              id="account-delete-section"
              className={`${styles.accountDangerCard} ${styles.historySectionAnchor}`}
            >
              <button
                type="button"
                className={styles.accountDangerToggle}
                onClick={() => setIsDangerZoneOpen((current) => !current)}
                aria-expanded={isDangerZoneOpen}
                aria-controls="account-danger-panel"
              >
                <div className={styles.accountDangerHeader}>
                  <div>
                    <h3>
                      <span className="material-symbols-outlined">warning</span>
                      위험 구역
                    </h3>
                    <p>계정을 삭제하면 작문 기록과 계정 정보가 함께 사라져요.</p>
                  </div>
                </div>
                <span className={styles.accountDangerToggleBadge}>
                  {isDangerZoneOpen ? "접기" : "펼치기"}
                  <span className="material-symbols-outlined">
                    {isDangerZoneOpen ? "expand_less" : "expand_more"}
                  </span>
                </span>
              </button>

              {isDangerZoneOpen ? (
                <div id="account-danger-panel" className={styles.accountDangerPanel}>
                  <div className={`${styles.form} ${styles.accountDangerForm}`}>
                    <label className={styles.field}>
                      <span>확인 문구</span>
                      <input
                        className={styles.input}
                        value={deleteConfirmationText}
                        onChange={(event) => setDeleteConfirmationText(event.target.value)}
                        placeholder="확인 문구로 '탈퇴'를 입력해 주세요."
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
                          placeholder="현재 비밀번호를 입력해 주세요."
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className={styles.accountDangerAction}>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => void handleDeleteAccount()}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? "삭제 중..." : "계정 영구 삭제"}
                    </button>
                  </div>

                  {deleteError ? <p className={styles.error}>{deleteError}</p> : null}
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <div className={styles.accountFooterActions}>
          <button type="button" className={styles.ghostButton} onClick={goHome}>
            <span className="material-symbols-outlined">home</span>
            홈으로 이동
          </button>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => void handleLogout()}
            disabled={isSubmitting}
          >
            <span className="material-symbols-outlined">logout</span>
            {isSubmitting ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </section>
    );
  }

  function renderWritingTab() {
    const sortedHistory = [...history].sort((left, right) =>
      getLatestSessionTimestamp(right).localeCompare(getLatestSessionTimestamp(left))
    );
    const remainingSessions = sortedHistory;
    const expressionCards = visibleExpressionHistory.slice(
      0,
      showAllExpressionHistory ? visibleExpressionHistory.length : 5
    );

    return (
      <section className={styles.writingHistoryLayout}>
        <div className={styles.writingDashboardHeader}>
          <h1>작문 기록</h1>
          <div className={styles.writingStatsGrid}>
            <article className={styles.writingStatCard}>
              <div className={`${styles.writingStatIcon} ${styles.writingStatIconWarm}`}>
                <span className="material-symbols-outlined">local_fire_department</span>
              </div>
              <div>
                <span className={styles.writingStatLabel}>연속 학습</span>
                <strong>{`${todayStatus?.streakDays ?? 0}일째`}</strong>
                <p>오늘도 루프를 이어가며 작문 감각을 꾸준히 쌓고 있어요.</p>
              </div>
            </article>

            <article className={styles.writingStatCard}>
              <div className={`${styles.writingStatIcon} ${styles.writingStatIconMint}`}>
                <span className="material-symbols-outlined">edit_square</span>
              </div>
              <div>
                <span className={styles.writingStatLabel}>총 작문 수</span>
                <strong>{`${history.length}회`}</strong>
                <p>초안부터 다시쓰기까지 누적된 연습 기록을 한눈에 살펴보세요.</p>
              </div>
            </article>

            <article className={styles.writingStatCard}>
              <div className={`${styles.writingStatIcon} ${styles.writingStatIconAmber}`}>
                <span className="material-symbols-outlined">verified</span>
              </div>
              <div>
                <span className={styles.writingStatLabel}>반복 실수</span>
                <strong>{`${commonMistakes.length}건`}</strong>
                <p>자주 헷갈린 포인트를 모아 다음 루프에서 더 빠르게 고칠 수 있어요.</p>
              </div>
            </article>
          </div>
        </div>

        <div className={styles.writingBentoGrid}>
          <section
            id="writing-expressions-section"
            className={`${styles.writingExpressionsPanel} ${styles.historySectionAnchor}`}
          >
            <div className={styles.writingPanelHeader}>
              <div>
                <h2>자주 꺼내 쓴 표현</h2>
                <p>작문에서 여러 번 사용한 표현을 모아 다음 답변에서도 바로 활용해 보세요.</p>
              </div>
              {usedExpressionHistory.length > EXPRESSION_HISTORY_PREVIEW_COUNT ? (
                <button
                  type="button"
                  className={styles.writingPanelLink}
                  onClick={() => setShowAllExpressionHistory((current) => !current)}
                >
                  {showAllExpressionHistory ? "접어두기" : "모두 보기"}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              ) : null}
            </div>

            {usedExpressionHistory.length === 0 ? (
              <div className={styles.writingPanelEmpty}>
                <p>아직 기록된 표현이 없어요. 작문을 이어가면 자주 쓰는 표현이 여기에 쌓여요.</p>
              </div>
            ) : (
              <div className={styles.writingExpressionsGrid}>
                {expressionCards.map((expression, index) => (
                  <article key={expression.expression} className={styles.writingExpressionCard}>
                    <span className={styles.writingExpressionTag}>
                      {index % 3 === 0 ? "표현" : index % 3 === 1 ? "주제" : "패턴"}
                    </span>
                    <strong>{expression.expression}</strong>
                    <p>{expression.matchedText ?? expression.latestQuestionKo}</p>
                    <small>
                      {formatExpressionHistoryDate(expression.lastUsedAt)} · {expression.count}회 사용
                    </small>
                  </article>
                ))}
                {hiddenExpressionHistoryCount > 0 && !showAllExpressionHistory ? (
                  <button
                    type="button"
                    className={styles.writingExpressionMoreCard}
                    onClick={() => setShowAllExpressionHistory(true)}
                  >
                    <span className="material-symbols-outlined">add_circle</span>
                    <span>{`표현 ${hiddenExpressionHistoryCount}개 더 보기`}</span>
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <aside
            id="writing-feedback-section"
            className={`${styles.writingFeedbackPanel} ${styles.historySectionAnchor}`}
          >
            <div className={styles.writingFeedbackHeader}>
              <h2>
                <span className="material-symbols-outlined">psychology</span>
                자주 고친 포인트
              </h2>
            </div>
            {mistakeError ? <p className={styles.error}>{mistakeError}</p> : null}
            {commonMistakes.length === 0 ? (
              <div className={styles.writingPanelEmpty}>
                <p>아직 반복해서 잡힌 실수가 없어요. 작문을 이어가면 자주 고치는 포인트가 여기에 모여요.</p>
              </div>
            ) : (
              <div className={styles.writingFeedbackList}>
                {commonMistakes.slice(0, 3).map((mistake, index) => (
                  <article key={mistake.issue} className={styles.writingFeedbackItem}>
                    <span
                      className={`${styles.writingFeedbackMarker} ${
                        index === 0
                          ? styles.writingFeedbackMarkerAlert
                          : index === 1
                            ? styles.writingFeedbackMarkerTip
                            : styles.writingFeedbackMarkerGuide
                      }`}
                    >
                      {index === 0 ? "!" : index === 1 ? "TIP" : "가이드"}
                    </span>
                    <div>
                      <strong>{mistake.displayLabel}</strong>
                      <p>{mistake.latestSuggestion}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>

        <section
          id="writing-history-section"
          className={`${styles.writingHistoryBoard} ${styles.historySectionAnchor}`}
        >
          <div className={styles.writingHistoryHeader}>
            <h2>최근 작문 기록</h2>
            <p>최근 기록부터 다시 훑어보며 어떤 표현과 수정이 쌓였는지 확인해 보세요.</p>
          </div>

          {historyError ? <p className={styles.error}>{historyError}</p> : null}

          {remainingSessions.length === 0 ? (
            <div className={styles.writingPanelEmpty}>
              <p>아직 저장된 작문 기록이 없어요. 오늘의 질문으로 첫 작문을 시작해 보세요.</p>
              <button type="button" className={styles.primaryButton} onClick={goHome}>
                홈으로 이동
              </button>
            </div>
          ) : (
            <div className={styles.writingHistoryList} id="writing-history-list">
              {remainingSessions.map((session) => {
                const latestAttempt = session.attempts[session.attempts.length - 1];
                const comparisonView = buildHistoryComparisonView(session);
                const badgeLabel = getFeedbackLevelInfo(
                  latestAttempt?.score ?? 0,
                  latestAttempt?.feedback.loopComplete ?? false
                ).label;
                const badgeVariant = getHistoryStatusVariant(
                  latestAttempt?.score ?? 0,
                  latestAttempt?.feedback.loopComplete ?? false
                );
                const improvedText =
                  comparisonView?.rewriteAttempt.answerText ??
                  latestAttempt?.feedback.correctedAnswer ??
                  latestAttempt?.answerText ??
                  "";

                return (
                  <article key={session.sessionId} className={styles.writingHistoryListItem}>
                    <button
                      type="button"
                      className={styles.writingHistoryListButton}
                      onClick={() => toggleSession(session.sessionId)}
                    >
                      <div className={styles.writingHistoryListMeta}>
                        <span>{formatHistoryCardDate(getLatestSessionTimestamp(session))}</span>
                        {openSessions[session.sessionId] ? <h4>{session.questionKo}</h4> : null}
                        <div className={styles.writingHistoryRowBadges}>
                          <span
                            className={`${styles.writingHistoryStatusBadge} ${
                              badgeVariant === "perfect"
                                ? styles.writingHistoryStatusPerfect
                                : badgeVariant === "good"
                                  ? styles.writingHistoryStatusGood
                                  : styles.writingHistoryStatusWarm
                            }`}
                          >
                            {badgeLabel}
                          </span>
                          <span className={styles.writingHistoryWordBadge}>
                            {getHistoryWordCount(latestAttempt?.answerText ?? "")} words
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined">
                        {openSessions[session.sessionId] ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {openSessions[session.sessionId]
                      ? renderWritingHistoryExpandedContent(
                          session,
                          comparisonView,
                          latestAttempt,
                          improvedText,
                          "질문",
                          session.questionKo,
                          styles.writingHistoryExpanded
                        )
                      : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    );
  }

  if (currentUser === undefined) {
    return (
      <main className={`${styles.page} ${styles.myPageShell}`}>
        <section className={styles.emptyCard}>
          <h2>내 정보를 불러오는 중이에요</h2>
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
          <p>내 정보와 작문 기록은 로그인한 뒤에 확인할 수 있어요.</p>
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

  if (activeTab === "account") {
    return (
      <main className={`${styles.page} ${styles.myPageShell} ${styles.myPageAccountShell}`}>
        {renderAccountSettingsPage()}
      </main>
    );
  }

  return (
    <main className={`${styles.page} ${styles.myPageShell} ${styles.myPageWritingShell}`}>
      {renderWritingTab()}
    </main>
  );
}




