"use client";

import { useMemo } from "react";
import styles from "../../app/page.module.css";
import { buildCoachQuickQuestions } from "../../lib/coach-quick-questions";
import type { Prompt } from "../../lib/types";
import type { CoachAssistantState } from "./use-coach-assistant";
import type { SavedExpressionsState } from "./use-saved-expressions";

type CoachAssistantPanelProps = {
  coach: CoachAssistantState;
  selectedPrompt: Prompt | null;
  savedExpressions: SavedExpressionsState;
  onSubmitQuestion: () => Promise<void>;
  // "문장에 넣기": 지금 쓰는 답 끝에 표현을 붙인다.
  onInsertExpression: (expression: string) => void;
  inDialog?: boolean;
};

// AI 코치 도우미 패널: 질문 입력, 빠른 질문, 코치 답변과 추천 표현(문장에 넣기, 저장).
export function CoachAssistantPanel({
  coach,
  selectedPrompt,
  savedExpressions,
  onSubmitQuestion,
  onInsertExpression,
  inDialog = false
}: CoachAssistantPanelProps) {
  const quickQuestions = useMemo(() => buildCoachQuickQuestions(selectedPrompt), [selectedPrompt]);
  const help = coach.help;

  return (
    <section className={`${styles.coachPanel} ${inDialog ? styles.coachPanelDialog : ""}`}>
      <div className={styles.coachPanelHeader}>
        <div>
          <span className={styles.coachEyebrow}>AI 코치</span>
          <strong id={inDialog ? "coach-assistant-title" : undefined}>
            AI에게 표현 물어보기
          </strong>
          <p>
            사용자가 질문을 하면, 바로 쓸 수 있는 표현과 짧은 예문을 추천해 드려요.
          </p>
        </div>
      </div>

      <div className={styles.coachPromptArea}>
        <textarea
          ref={coach.promptInputRef}
          className={styles.coachPromptInput}
          value={coach.question}
          onChange={(event) => coach.setQuestion(event.target.value)}
          placeholder={'예: "근력을 키우고 싶다"를 어떻게 말해?'}
          rows={2}
        />
        <div className={styles.coachQuickActions}>
          {quickQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className={styles.coachQuickChip}
              onClick={() => coach.setQuestion(question)}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.coachActionRow}>
        <button
          type="button"
          className={styles.coachPrimaryButton}
          onClick={() => void onSubmitQuestion()}
          disabled={coach.isLoading || !selectedPrompt}
        >
          {coach.isLoading ? "표현을 고르는 중..." : "표현 추천받기"}
        </button>
        <span className={styles.coachActionMeta}>
          표현을 그대로 붙이지 말고, 내 문장 안에서 직접 풀어 써보세요.
        </span>
      </div>

      {coach.error ? <p className={styles.coachError}>{coach.error}</p> : null}
      {savedExpressions.error ? <p className={styles.coachError}>{savedExpressions.error}</p> : null}
      {savedExpressions.notice ? <p className={styles.coachNotice}>{savedExpressions.notice}</p> : null}

      {help ? (
        <div className={styles.coachResult}>
          <div className={styles.coachReplyCard}>
            <span className={styles.coachReplyBadge}>코치 답변</span>
            <p>{help.coachReply}</p>
          </div>
          <div className={styles.coachExpressionList}>
            {help.expressions.map((expression) => (
              <article key={expression.id} className={styles.coachExpressionCard}>
                <div className={styles.coachExpressionTop}>
                  <strong>{expression.expression}</strong>
                  <span>{expression.meaningKo}</span>
                </div>
                <p>{expression.usageTip}</p>
                <small>{expression.example}</small>
                <div className={styles.coachExpressionActionRow}>
                  <button
                    type="button"
                    className={styles.coachExpressionGhostButton}
                    onClick={() => onInsertExpression(expression.expression)}
                  >
                    문장에 넣기
                  </button>
                  <button
                    type="button"
                    className={
                      savedExpressions.isSaved(expression.expression)
                        ? styles.coachExpressionSaveButtonActive
                        : styles.coachExpressionSaveButton
                    }
                    onClick={() =>
                      void savedExpressions.toggle({
                        expression: expression.expression,
                        meaningKo: expression.meaningKo,
                        exampleEn: expression.example,
                        usageTipKo: expression.usageTip,
                        tags: expression.tags,
                        sourceType: "COACH_RECOMMENDATION",
                        coachInteractionId: help.interactionId
                      })
                    }
                    disabled={savedExpressions.isSaving(expression.expression)}
                  >
                    {savedExpressions.isSaving(expression.expression)
                      ? "저장 중"
                      : savedExpressions.isSaved(expression.expression)
                        ? "저장됨"
                        : "저장"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type CoachAssistantModalProps = Omit<CoachAssistantPanelProps, "inDialog"> & {
  // 코치 창은 답 쓰기·다시 쓰기 화면에서만 보인다.
  isAvailable: boolean;
};

// AI 코치 도우미 창(덮개와 대화상자).
export function CoachAssistantModal({ isAvailable, ...panelProps }: CoachAssistantModalProps) {
  const { coach } = panelProps;
  if (!coach.isOpen || !isAvailable) {
    return null;
  }

  return (
    <div className={styles.coachOverlay} onClick={() => coach.close()}>
      <section
        className={styles.coachDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-assistant-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={coach.dialogCloseButtonRef}
          type="button"
          className={styles.coachDialogClose}
          aria-label="AI 코치 닫기"
          onClick={() => coach.close()}
        >
          ×
        </button>
        <CoachAssistantPanel {...panelProps} inDialog />
      </section>
    </div>
  );
}
