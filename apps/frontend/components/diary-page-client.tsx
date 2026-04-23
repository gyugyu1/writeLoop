"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  getCurrentUser,
  getDiaryEntries,
  requestDiaryFeedback,
  updateDiaryEntry
} from "../lib/api";
import type {
  AuthUser,
  DiaryCorrectionPoint,
  DiaryEntry,
  DiaryExpression,
  DiaryFeedback,
  DiaryRewriteIdea
} from "../lib/types";
import styles from "./diary-page.module.css";

type DiaryStep = "write" | "feedback" | "rewrite";

const MOOD_OPTIONS = ["calm", "happy", "tired", "busy", "grateful"];
const TOPIC_HINTS = [
  "What happened today?",
  "How did you feel?",
  "What was one small moment?",
  "What do you want to do tomorrow?"
];

function todayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function countWords(text: string) {
  const trimmed = trimText(text);
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

function formatDisplayDate(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function firstText(...values: (string | null | undefined)[]) {
  return values.map((value) => trimText(value)).find(Boolean) ?? "";
}

function getLatestFeedback(entry: DiaryEntry | null): DiaryFeedback | null {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.feedback ?? null;
}

function getLatestAttemptText(entry: DiaryEntry | null) {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.diaryText ?? entry?.content ?? "";
}

function getDiaryFeedbackHeadline(feedback: DiaryFeedback) {
  switch (feedback.diaryAnswerBand) {
    case "DIARY_TOO_SHORT":
      return "조금만 더 쓰면 좋은 일기가 돼요";
    case "DIARY_NOT_ENGLISH":
      return "쉬운 영어 문장으로 옮겨보면 좋아요";
    case "DIARY_GRAMMAR_BLOCKING":
      return "의미가 보이도록 문장을 먼저 정리했어요";
    case "DIARY_FLOW_THIN":
      return "일기의 흐름을 더 살릴 수 있어요";
    case "DIARY_NATURAL_COMPLETE":
      return "이미 자연스러운 일기예요";
    default:
      return "일기를 더 자연스럽게 다듬었어요";
  }
}

function buildEntryViewState(entry: DiaryEntry, sourceEntries: DiaryEntry[]) {
  const nextEntry = sourceEntries.find((item) => item.entryId === entry.entryId) ?? entry;
  const latestFeedback = getLatestFeedback(nextEntry);
  const latestText = getLatestAttemptText(nextEntry);

  return {
    entry: nextEntry,
    feedback: latestFeedback,
    rewriteText: latestFeedback?.correctedDiary ?? latestText,
    step: latestFeedback ? ("feedback" as const) : ("write" as const)
  };
}

function buildLoginHref() {
  return `/login?returnTo=${encodeURIComponent("/diary")}`;
}

function DiaryFeedbackPanel({ feedback }: { feedback: DiaryFeedback }) {
  const fixPoints = (feedback.fixPoints ?? []).filter(
    (point): point is DiaryCorrectionPoint => Boolean(point?.title || point?.reasonKo)
  );
  const rewriteIdeas = (feedback.rewriteIdeas ?? []).filter(
    (idea): idea is DiaryRewriteIdea => Boolean(idea?.title || idea?.english || idea?.noteKo)
  );
  const diaryExpressions = [
    ...(feedback.usedDiaryExpressions ?? []),
    ...(feedback.diaryExpressions ?? [])
  ].filter((item): item is DiaryExpression => Boolean(item?.expression));
  const summary = firstText(feedback.summaryKo, feedback.diaryFlow?.commentKo);
  const missionText = firstText(
    feedback.nextDiaryMission?.instructionKo,
    feedback.nextDiaryMission?.titleKo
  );

  return (
    <section className={styles.feedbackCard} aria-label="영어일기 피드백">
      <div className={styles.feedbackHeader}>
        <div>
          <span className={styles.eyebrow}>AI 피드백</span>
          <h2>{getDiaryFeedbackHeadline(feedback)}</h2>
        </div>
        <div className={styles.scoreBadge}>{feedback.score}</div>
      </div>

      {summary ? <p className={styles.feedbackSummary}>{summary}</p> : null}

      {feedback.strengths.length > 0 ? (
        <div className={styles.feedbackSection}>
          <h3>좋았던 점</h3>
          <ul className={styles.softList}>
            {feedback.strengths.slice(0, 3).map((strength, index) => (
              <li key={`${strength}-${index}`}>{strength}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {fixPoints.length > 0 ? (
        <div className={styles.feedbackSection}>
          <h3>고치면 더 자연스러운 부분</h3>
          <div className={styles.fixGrid}>
            {fixPoints.slice(0, 5).map((point, index) => {
              const title = firstText(point.title, `포인트 ${index + 1}`);
              const originalText = trimText(point.originalText);
              const revisedText = trimText(point.revisedText);

              return (
                <article key={`${title}-${index}`} className={styles.fixCard}>
                  <strong>{title}</strong>
                  {originalText || revisedText ? (
                    <div className={styles.repairBox}>
                      {originalText ? <p className={styles.originalText}>{originalText}</p> : null}
                      {revisedText ? <p className={styles.revisedText}>{revisedText}</p> : null}
                    </div>
                  ) : null}
                  {point.reasonKo ? <p>{point.reasonKo}</p> : null}
                  {point.exampleEn ? <em>{point.exampleEn}</em> : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {feedback.diaryFlow?.commentKo ? (
        <div className={styles.feedbackSection}>
          <h3>일기 흐름 코칭</h3>
          <div className={styles.flowGrid}>
            <p>{feedback.diaryFlow.commentKo}</p>
            {feedback.diaryFlow.timeFlow ? <span>시간 흐름: {feedback.diaryFlow.timeFlow}</span> : null}
            {feedback.diaryFlow.emotion ? <span>감정: {feedback.diaryFlow.emotion}</span> : null}
            {feedback.diaryFlow.detail ? <span>디테일: {feedback.diaryFlow.detail}</span> : null}
            {feedback.diaryFlow.reflection ? <span>마무리: {feedback.diaryFlow.reflection}</span> : null}
          </div>
        </div>
      ) : null}

      {feedback.correctedDiary ? (
        <div className={styles.feedbackSection}>
          <h3>다듬은 일기</h3>
          <p className={styles.diaryTextBox}>{feedback.correctedDiary}</p>
        </div>
      ) : null}

      {feedback.modelDiary ? (
        <div className={styles.feedbackSection}>
          <h3>자연스러운 예시</h3>
          <p className={styles.modelDiary}>{feedback.modelDiary}</p>
          {feedback.modelDiaryKo ? <p className={styles.mutedText}>{feedback.modelDiaryKo}</p> : null}
        </div>
      ) : null}

      {diaryExpressions.length > 0 ? (
        <div className={styles.feedbackSection}>
          <h3>일기에 써볼 표현</h3>
          <div className={styles.expressionGrid}>
            {diaryExpressions.slice(0, 8).map((item) => (
              <article key={`${item.expression}-${item.exampleEn ?? ""}`} className={styles.expressionCard}>
                <strong>{item.expression}</strong>
                <span>{item.meaningKo}</span>
                {item.exampleEn ? <p>{item.exampleEn}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {rewriteIdeas.length > 0 ? (
        <div className={styles.feedbackSection}>
          <h3>다시 쓸 때 붙여볼 아이디어</h3>
          <div className={styles.ideaGrid}>
            {rewriteIdeas.slice(0, 5).map((idea, index) => {
              const title = firstText(idea.title, idea.english, `아이디어 ${index + 1}`);
              const note = firstText(idea.meaningKo, idea.noteKo);

              return (
                <article key={`${title}-${index}`} className={styles.ideaCard}>
                  <strong>{title}</strong>
                  {idea.english ? <p className={styles.ideaEnglish}>{idea.english}</p> : null}
                  {note ? <span>{note}</span> : null}
                  {idea.exampleEn ? <em>{idea.exampleEn}</em> : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {missionText ? (
        <div className={styles.challengeCard}>
          <span>다시 써보기 미션</span>
          <p>{missionText}</p>
          {feedback.nextDiaryMission?.starterEn ? <em>{feedback.nextDiaryMission.starterEn}</em> : null}
        </div>
      ) : null}
    </section>
  );
}

export function DiaryPageClient() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateKey());
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState("");
  const [content, setContent] = useState("");
  const [rewriteText, setRewriteText] = useState("");
  const [feedback, setFeedback] = useState<DiaryFeedback | null>(null);
  const [step, setStep] = useState<DiaryStep>("write");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeText = step === "rewrite" ? rewriteText : content;
  const wordCount = useMemo(() => countWords(activeText), [activeText]);
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.entryId === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );
  const canSubmit = wordCount > 0 && !isSaving && !isSubmitting;

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      try {
        setIsLoading(true);
        setError("");
        const user = await getCurrentUser();
        if (cancelled) {
          return;
        }
        setCurrentUser(user);
        if (!user) {
          setEntries([]);
          return;
        }

        const nextEntries = await getDiaryEntries();
        if (cancelled) {
          return;
        }
        setEntries(nextEntries);
        if (nextEntries[0]) {
          const nextState = buildEntryViewState(nextEntries[0], nextEntries);
          setSelectedEntryId(nextState.entry.entryId);
          setEntryDate(nextState.entry.entryDate || todayDateKey());
          setTitle(nextState.entry.title ?? "");
          setMood(nextState.entry.mood ?? "");
          setContent(nextState.entry.content ?? "");
          setFeedback(nextState.feedback);
          setRewriteText(nextState.rewriteText);
          setStep(nextState.step);
          setError("");
          setNotice("");
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "영어일기를 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setSelectedEntryId("");
    setEntryDate(todayDateKey());
    setTitle("");
    setMood("");
    setContent("");
    setRewriteText("");
    setFeedback(null);
    setStep("write");
    setError("");
    setNotice("");
  }

  function selectEntry(entry: DiaryEntry, sourceEntries = entries) {
    const nextState = buildEntryViewState(entry, sourceEntries);

    setSelectedEntryId(nextState.entry.entryId);
    setEntryDate(nextState.entry.entryDate || todayDateKey());
    setTitle(nextState.entry.title ?? "");
    setMood(nextState.entry.mood ?? "");
    setContent(nextState.entry.content ?? "");
    setFeedback(nextState.feedback);
    setRewriteText(nextState.rewriteText);
    setStep(nextState.step);
    setError("");
    setNotice("");
  }

  async function reloadEntries(nextSelectedEntryId = selectedEntryId) {
    const nextEntries = await getDiaryEntries();
    setEntries(nextEntries);
    const nextSelectedEntry = nextEntries.find((entry) => entry.entryId === nextSelectedEntryId);
    if (nextSelectedEntry) {
      selectEntry(nextSelectedEntry, nextEntries);
    }
    return nextEntries;
  }

  async function saveEntry(nextContent = content, draft = true) {
    const payload = {
      title,
      content: nextContent,
      language: "en",
      entryDate,
      mood,
      tags: mood ? [mood] : [],
      draft
    };

    if (selectedEntryId) {
      const updated = await updateDiaryEntry(selectedEntryId, payload);
      setEntries((previous) =>
        previous.map((entry) => (entry.entryId === updated.entryId ? updated : entry))
      );
      return updated;
    }

    const created = await createDiaryEntry(payload);
    setSelectedEntryId(created.entryId);
    setEntries((previous) => [created, ...previous]);
    return created;
  }

  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      setError("");
      setNotice("");
      const saved = await saveEntry(content, true);
      await reloadEntries(saved.entryId);
      setNotice("영어일기 초안을 저장했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "영어일기를 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRequestFeedback(nextAttemptType: "INITIAL" | "REWRITE") {
    const targetText = (nextAttemptType === "REWRITE" ? rewriteText : content).trim();
    if (!targetText) {
      setError("피드백을 받으려면 일기 내용을 먼저 써 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const saved = await saveEntry(targetText, false);
      const nextFeedback = await requestDiaryFeedback(saved.entryId, {
        bodyText: targetText,
        attemptType: nextAttemptType
      });
      await reloadEntries(saved.entryId);
      setSelectedEntryId(saved.entryId);
      setContent(targetText);
      setFeedback(nextFeedback);
      setRewriteText(
        nextFeedback.nextDiaryMission?.starterEn
          ?? nextFeedback.correctedDiary
          ?? nextFeedback.modelDiary
          ?? targetText
      );
      setStep("feedback");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "영어일기 피드백을 받지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEntry() {
    if (!selectedEntryId || isDeleting) {
      return;
    }

    const confirmed = window.confirm("이 영어일기를 삭제할까요? 삭제한 일기는 되돌릴 수 없어요.");
    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setError("");
      setNotice("");
      await deleteDiaryEntry(selectedEntryId);
      const nextEntries = entries.filter((entry) => entry.entryId !== selectedEntryId);
      setEntries(nextEntries);
      if (nextEntries[0]) {
        selectEntry(nextEntries[0], nextEntries);
      } else {
        resetForm();
      }
      setNotice("영어일기를 삭제했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "영어일기를 삭제하지 못했어요.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.loadingCard}>영어일기장을 불러오는 중이에요.</div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={styles.pageShell}>
        <section className={styles.loginCard}>
          <span className={styles.eyebrow}>영어일기</span>
          <h1>로그인하고 나만의 영어일기장을 열어보세요.</h1>
          <p>영어일기는 개인 기록이라 로그인한 사용자에게만 저장돼요.</p>
          <Link className={styles.primaryButton} href={buildLoginHref()}>
            로그인하고 일기 쓰기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.pageShell}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Free English Diary</span>
          <h1>오늘 하루를 영어로 짧게 남겨보세요.</h1>
          <p>완벽한 문장보다 직접 쓰는 흐름이 더 중요해요. AI가 일기답게 자연스럽게 다듬어 줄게요.</p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={resetForm}>
          새 일기 쓰기
        </button>
      </section>

      <div className={styles.layoutGrid}>
        <aside className={styles.sidebar} aria-label="영어일기 기록">
          <div className={styles.sidebarHeader}>
            <h2>일기 기록</h2>
            <span>{entries.length}개</span>
          </div>

          {entries.length > 0 ? (
            <div className={styles.entryList}>
              {entries.map((entry) => {
                const latestFeedback = getLatestFeedback(entry);
                const selected = entry.entryId === selectedEntryId;
                return (
                  <button
                    key={entry.entryId}
                    className={selected ? styles.entryListItemActive : styles.entryListItem}
                    type="button"
                    onClick={() => selectEntry(entry)}
                  >
                    <span>{formatDisplayDate(entry.entryDate) || "날짜 없음"}</span>
                    <strong>{entry.title || entry.content.slice(0, 38) || "제목 없는 일기"}</strong>
                    <small>
                      {latestFeedback ? `최근 점수 ${latestFeedback.score}` : entry.draft ? "초안" : "피드백 전"}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyText}>아직 저장된 영어일기가 없어요. 오늘 있었던 일을 한 문장으로 시작해보세요.</p>
          )}
        </aside>

        <section className={styles.workArea}>
          <div className={styles.metaGrid}>
            <label>
              <span>날짜</span>
              <input value={entryDate} onChange={(event) => setEntryDate(event.target.value)} type="date" />
            </label>
            <label>
              <span>제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: A quiet evening"
              />
            </label>
          </div>

          <div className={styles.moodBlock}>
            <span>기분 태그</span>
            <div className={styles.moodRow}>
              {MOOD_OPTIONS.map((item) => {
                const selected = mood === item;
                return (
                  <button
                    key={item}
                    className={selected ? styles.moodChipActive : styles.moodChip}
                    type="button"
                    onClick={() => setMood(selected ? "" : item)}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <section className={styles.editorCard}>
            <div className={styles.editorHeader}>
              <div>
                <span className={styles.eyebrow}>{step === "rewrite" ? "Rewrite" : "Today's diary"}</span>
                <h2>{step === "rewrite" ? "피드백을 반영해서 다시 써보세요." : "오늘의 영어일기"}</h2>
              </div>
              <span className={styles.wordBadge}>{wordCount}단어</span>
            </div>

            <textarea
              value={step === "rewrite" ? rewriteText : content}
              onChange={(event) =>
                step === "rewrite" ? setRewriteText(event.target.value) : setContent(event.target.value)
              }
              placeholder={step === "rewrite" ? "I felt..." : "Today, I..."}
              rows={11}
            />

            {step === "write" ? (
              <div className={styles.hintRow}>
                {TOPIC_HINTS.map((hint) => (
                  <span key={hint}>{hint}</span>
                ))}
              </div>
            ) : null}

            <div className={styles.actionRow}>
              {step === "feedback" ? (
                <>
                  <button className={styles.primaryButton} type="button" onClick={() => setStep("rewrite")}>
                    다시 써보기
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={resetForm}>
                    새 일기
                  </button>
                </>
              ) : (
                <>
                  {step !== "rewrite" ? (
                    <button className={styles.secondaryButton} type="button" onClick={() => void handleSaveDraft()} disabled={isSaving}>
                      {isSaving ? "저장 중" : "임시저장"}
                    </button>
                  ) : null}
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => void handleRequestFeedback(step === "rewrite" ? "REWRITE" : "INITIAL")}
                    disabled={!canSubmit}
                  >
                    {isSubmitting
                      ? "피드백 생성 중"
                      : step === "rewrite"
                        ? "다시 쓴 일기 피드백 받기"
                        : "AI 피드백 받기"}
                  </button>
                </>
              )}
              {selectedEntry ? (
                <button className={styles.dangerButton} type="button" onClick={() => void handleDeleteEntry()} disabled={isDeleting}>
                  {isDeleting ? "삭제 중" : "삭제"}
                </button>
              ) : null}
            </div>
          </section>

          {notice ? <p className={styles.noticeText}>{notice}</p> : null}
          {error ? <p className={styles.errorText}>{error}</p> : null}

          {feedback ? <DiaryFeedbackPanel feedback={feedback} /> : null}
        </section>
      </div>
    </main>
  );
}
