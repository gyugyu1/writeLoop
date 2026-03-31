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
    </section>
  );
}
