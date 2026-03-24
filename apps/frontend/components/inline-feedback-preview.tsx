import { useMemo } from "react";
import { buildInlineFeedbackSegments } from "../lib/inline-feedback";
import type { FeedbackInlineSegment } from "../lib/types";
import styles from "./inline-feedback-preview.module.css";

type InlineFeedbackPreviewProps = {
  originalAnswer: string;
  correctedAnswer?: string | null;
  inlineFeedback?: FeedbackInlineSegment[] | null;
  title?: string;
  description?: string;
  compact?: boolean;
};

export function InlineFeedbackPreview({
  originalAnswer,
  correctedAnswer,
  inlineFeedback,
  title = "문장별 피드백",
  description = "검정은 유지, 빨강은 수정, 파랑은 추가 표현이에요.",
  compact = false
}: InlineFeedbackPreviewProps) {
  const segments = useMemo(
    () => buildInlineFeedbackSegments(originalAnswer, correctedAnswer, inlineFeedback),
    [originalAnswer, correctedAnswer, inlineFeedback]
  );

  if (!originalAnswer.trim()) {
    return null;
  }

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSample}>현재 문장</span>
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendRemove}>삭제/교체 전</span>
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendReplace}>수정 표현</span>
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendAdd}>추가 표현</span>
        </span>
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
              <span key={`replace-${index}`}>
                <span className={styles.remove}>{segment.removed}</span>
                <span className={styles.arrow}>→</span>
                <span className={styles.replace}>{segment.added}</span>
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
    </section>
  );
}
