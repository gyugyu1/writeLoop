import { useMemo } from "react";
import { buildInlineFeedbackSegments } from "../lib/inline-feedback";
import type { FeedbackInlineSegment, GrammarFeedbackItem } from "../lib/types";
import styles from "./inline-feedback-preview.module.css";

type InlineFeedbackPreviewProps = {
  originalAnswer: string;
  correctedAnswer?: string | null;
  inlineFeedback?: FeedbackInlineSegment[] | null;
  grammarFeedback?: GrammarFeedbackItem[] | null;
  title?: string;
  compact?: boolean;
  variant?: "default" | "embedded";
};

function normalizeComparableText(text: string | null | undefined) {
  return (text ?? "").trim().toLowerCase();
}

function countWords(text: string | null | undefined) {
  return (text ?? "").trim() ? (text ?? "").trim().split(/\s+/).length : 0;
}

function splitGrammarReasons(reasonKo: string | null | undefined) {
  return (reasonKo ?? "")
    .split(/\n+/)
    .map((reason) => reason.trim())
    .filter(Boolean);
}

function resolveCleanGrammarBlock(
  originalAnswer: string,
  grammarFeedback?: GrammarFeedbackItem[] | null
) {
  if (!grammarFeedback || grammarFeedback.length === 0) {
    return null;
  }

  const normalizedOriginalAnswer = normalizeComparableText(originalAnswer);
  return (
    grammarFeedback.find((item) => {
      const normalizedOriginal = normalizeComparableText(item.originalText);
      const normalizedRevised = normalizeComparableText(item.revisedText);
      return (
        normalizedOriginal !== "" &&
        normalizedOriginal === normalizedOriginalAnswer &&
        normalizedOriginal !== normalizedRevised &&
        countWords(item.revisedText) >= 5
      );
    }) ?? null
  );
}

function formatGrammarChange(item: GrammarFeedbackItem): string {
  const originalText = item.originalText?.trim() ?? "";
  const revisedText = item.revisedText?.trim() ?? "";

  if (originalText && revisedText) {
    return `'${originalText}' -> '${revisedText}'`;
  }
  if (originalText) {
    return `'${originalText}' 삭제`;
  }
  if (revisedText) {
    return `'${revisedText}' 추가`;
  }
  return "문법 수정";
}

export function InlineFeedbackPreview({
  originalAnswer,
  correctedAnswer,
  inlineFeedback,
  grammarFeedback,
  title = "문법 피드백",
  compact = false,
  variant = "default"
}: InlineFeedbackPreviewProps) {
  const segments = useMemo(
    () => buildInlineFeedbackSegments(originalAnswer, correctedAnswer, inlineFeedback),
    [originalAnswer, correctedAnswer, inlineFeedback]
  );
  const cleanGrammarBlock = useMemo(
    () => resolveCleanGrammarBlock(originalAnswer, grammarFeedback),
    [originalAnswer, grammarFeedback]
  );

  if (!originalAnswer.trim()) {
    return null;
  }

  return (
    <section
      className={`${styles.panel} ${compact ? styles.compact : ""} ${
        variant === "embedded" ? styles.embedded : ""
      }`}
    >
      <div className={styles.header}>
        <strong>{title}</strong>
      </div>
      {cleanGrammarBlock ? (
        <div className={styles.cleanGrammarCard}>
          <div className={styles.cleanGrammarRow}>
            <span className={styles.cleanGrammarLabel}>원문</span>
            <p className={styles.cleanGrammarText}>{cleanGrammarBlock.originalText}</p>
          </div>
          <div className={styles.cleanGrammarRow}>
            <span className={styles.cleanGrammarLabel}>수정문</span>
            <p className={styles.cleanGrammarText}>{cleanGrammarBlock.revisedText}</p>
          </div>
          {splitGrammarReasons(cleanGrammarBlock.reasonKo).length > 0 ? (
            <div className={styles.cleanGrammarRow}>
              <span className={styles.cleanGrammarLabel}>이유</span>
              <ul className={styles.cleanGrammarReasonList}>
                {splitGrammarReasons(cleanGrammarBlock.reasonKo).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <p className={styles.content}>
            {segments.map((segment, index) => {
              if (segment.kind === "equal") {
                return (
                  <span key={`equal-${index}`} className={styles.text}>
                    {segment.text}
                  </span>
                );
              }

              if (segment.kind === "replace") {
                return (
                  <span key={`replace-${index}`} className={styles.replaceGroup}>
                    <span className={styles.remove}>{segment.removed}</span>
                    <span className={styles.replaceBelow}>{segment.added}</span>
                  </span>
                );
              }

              if (segment.kind === "add") {
                return (
                  <span key={`add-${index}`} className={styles.add}>
                    {segment.text}
                  </span>
                );
              }

              return (
                <span key={`remove-${index}`} className={styles.remove}>
                  {segment.text}
                </span>
              );
            })}
          </p>
          {grammarFeedback && grammarFeedback.length > 0 ? (
            <ul className={styles.reasonList}>
              {grammarFeedback.map((item, index) => (
                <li
                  key={`${item.originalText}-${item.revisedText}-${index}`}
                  className={styles.reasonItem}
                >
                  <strong>{formatGrammarChange(item)}</strong>
                  <span>{item.reasonKo}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
