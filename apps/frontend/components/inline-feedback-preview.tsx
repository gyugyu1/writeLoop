import type { GrammarFeedbackItem } from "../lib/types";
import styles from "./inline-feedback-preview.module.css";

type InlineFeedbackPreviewProps = {
  originalAnswer: string;
  correctedAnswer?: string | null;
  inlineFeedback?: unknown;
  grammarFeedback?: GrammarFeedbackItem[] | null;
  title?: string;
  compact?: boolean;
  variant?: "default" | "embedded";
};

function normalizeComparableText(text: string | null | undefined) {
  return (text ?? "").trim().toLowerCase();
}

function splitGrammarReasons(reasonKo: string | null | undefined) {
  return (reasonKo ?? "")
    .split(/\n+/)
    .map((reason) => reason.trim())
    .filter(Boolean);
}

function isPunctuationOnly(text: string | null | undefined) {
  const value = (text ?? "").trim();
  return Boolean(value) && !/[A-Za-z0-9\u00C0-\u024F\uAC00-\uD7AF]/.test(value);
}

function hasVisibleChange(item: GrammarFeedbackItem) {
  const originalText = item.originalText?.trim() ?? "";
  const revisedText = item.revisedText?.trim() ?? "";

  if (!originalText && !revisedText) {
    return false;
  }

  return normalizeComparableText(originalText) !== normalizeComparableText(revisedText);
}

function resolveGrammarCards(
  originalAnswer: string,
  correctedAnswer?: string | null,
  grammarFeedback?: GrammarFeedbackItem[] | null
) {
  const safeOriginal = originalAnswer.trim();
  const safeCorrected = correctedAnswer?.trim() ?? "";
  const cards =
    grammarFeedback
      ?.filter((item) => item && hasVisibleChange(item))
      .map((item) => {
        const originalText = item.originalText?.trim() ?? "";
        const revisedText = item.revisedText?.trim() ?? "";
        const punctuationOnlyChange =
          (!originalText && isPunctuationOnly(revisedText)) ||
          (!revisedText && isPunctuationOnly(originalText));

        if (
          punctuationOnlyChange &&
          safeOriginal &&
          safeCorrected &&
          normalizeComparableText(safeOriginal) !== normalizeComparableText(safeCorrected)
        ) {
          return {
            originalText: safeOriginal,
            revisedText: safeCorrected,
            reasons: splitGrammarReasons(item.reasonKo)
          };
        }

        return {
          originalText,
          revisedText,
          reasons: splitGrammarReasons(item.reasonKo)
        };
      })
      .filter((item) => item.originalText || item.revisedText) ?? [];

  if (cards.length > 0) {
    return cards;
  }

  if (
    safeOriginal &&
    safeCorrected &&
    normalizeComparableText(safeOriginal) !== normalizeComparableText(safeCorrected)
  ) {
    return [
      {
        originalText: safeOriginal,
        revisedText: safeCorrected,
        reasons: []
      }
    ];
  }

  return [];
}

export function InlineFeedbackPreview({
  originalAnswer,
  correctedAnswer,
  grammarFeedback,
  title = "\uBB38\uBC95 \uD53C\uB4DC\uBC31",
  compact = false,
  variant = "default"
}: InlineFeedbackPreviewProps) {
  if (!originalAnswer.trim()) {
    return null;
  }

  const grammarCards = resolveGrammarCards(originalAnswer, correctedAnswer, grammarFeedback);
  if (grammarCards.length === 0) {
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
      <div className={styles.grammarCards}>
        {grammarCards.map((card, index) => (
          <div
            key={`${card.originalText}-${card.revisedText}-${index}`}
            className={styles.cleanGrammarCard}
          >
            {card.originalText ? (
              <div className={styles.cleanGrammarRow}>
                <span className={styles.cleanGrammarLabel}>{"\uC6D0\uBB38"}</span>
                <p className={styles.cleanGrammarText}>{card.originalText}</p>
              </div>
            ) : null}
            {card.revisedText ? (
              <div className={styles.cleanGrammarRow}>
                <span className={styles.cleanGrammarLabel}>{"\uC218\uC815\uBB38"}</span>
                <p className={styles.cleanGrammarText}>{card.revisedText}</p>
              </div>
            ) : null}
            {card.reasons.length > 0 ? (
              <div className={styles.cleanGrammarRow}>
                <span className={styles.cleanGrammarLabel}>{"\uC774\uC720"}</span>
                <ul className={styles.cleanGrammarReasonList}>
                  {card.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
