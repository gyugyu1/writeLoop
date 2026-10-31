"use client";

import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import Image from "next/image";
import styles from "../../app/page.module.css";
import { getDifficultyLabel } from "../../lib/difficulty";
import type { Feedback, Prompt, TodayWritingStatus } from "../../lib/types";
import type { WritingGuide, WritingGuideHintItem } from "../../lib/writing-guide";
import { FeedbackSummary, type FeedbackSummaryProps } from "./feedback-screen";
import type { FeedbackView } from "./feedback-view";
import type { PracticeExpressionHint, Step } from "./types";
import type { CoachAssistantState } from "./use-coach-assistant";

const EXPRESSION_SLOT_LABELS: Record<string, string> = {
  action: "동사",
  actions: "동사",
  activity: "동사",
  activities: "동사",
  adj: "형용사",
  adjective: "형용사",
  adjectives: "형용사",
  detail: "세부 내용",
  details: "세부 내용",
  example: "예시",
  examples: "예시",
  how: "방법",
  issue: "문제",
  issues: "문제",
  item: "항목",
  items: "항목",
  language: "언어",
  languages: "언어",
  method: "방법",
  methods: "방법",
  noun: "명사",
  nouns: "명사",
  number: "횟수",
  numbers: "횟수",
  opinion: "의견",
  opinions: "의견",
  period: "기간",
  periods: "기간",
  place: "장소",
  places: "장소",
  process: "과정",
  processes: "과정",
  reason: "이유",
  reasons: "이유",
  result: "결과",
  results: "결과",
  thing: "내용",
  things: "내용",
  topic: "주제",
  topics: "주제",
  verb: "동사",
  verbs: "동사"
};


function renderLocalizedExpression(expression: string) {
  const parts: ReactNode[] = [];
  const pattern = /\[([A-Za-z]+)\]/g;
  let lastIndex = 0;

  for (const match of expression.matchAll(pattern)) {
    const fullMatch = match[0];
    const rawToken = match[1];
    const matchIndex = match.index ?? -1;
    if (matchIndex < 0) {
      continue;
    }

    if (matchIndex > lastIndex) {
      parts.push(expression.slice(lastIndex, matchIndex));
    }

    const normalizedToken = rawToken.trim().toLowerCase();
    const translatedToken = EXPRESSION_SLOT_LABELS[normalizedToken] ?? rawToken;
    parts.push(
      <em key={`${normalizedToken}-${matchIndex}`} className={styles.expressionSlotToken}>
        [{translatedToken}]
      </em>
    );
    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex === 0) {
    return expression;
  }

  if (lastIndex < expression.length) {
    parts.push(expression.slice(lastIndex));
  }

  return parts;
}


function renderWritingGuideHintCard(hint: WritingGuideHintItem) {
  const meaningKo = hint.meaningKo?.trim();

  return (
    <article key={hint.id} className={styles.hintChip}>
      <strong className={styles.hintChipContent}>{renderLocalizedExpression(hint.content)}</strong>
      {meaningKo ? (
        <span className={styles.hintChipMeaning}>{renderLocalizedExpression(meaningKo)}</span>
      ) : null}
    </article>
  );
}



function toDraftStatusBadgeLabel(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return "";
  }
  if (normalized.includes("실패")) {
    return "임시저장 실패";
  }
  if (normalized.startsWith("임시저장됨")) {
    return normalized;
  }
  if (normalized.includes("이 기기에 임시저장")) {
    return "이 기기에 임시저장";
  }
  return normalized;
}

type MobileComposerBarArgs = {
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled: boolean;
};

// 모바일 답 쓰기 화면 아래에 붙는 입력 막대.
export function MobileComposerBar({
  mobileComposerBarRef,
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  primaryDisabled
}: {
  mobileComposerBarRef: RefObject<HTMLDivElement | null>;
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled: boolean;
}) {
  return (
    <div ref={mobileComposerBarRef} className={styles.mobileComposerBar}>
      <div className={styles.mobileComposerActions}>
        <button type="button" className={styles.mobileComposerGhost} onClick={onSecondary}>
          {secondaryLabel}
        </button>
        <button
          type="button"
          className={styles.mobileComposerPrimary}
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

type WritingComposerArgs = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  wordCount: number;
  draftStatusMessage?: string;
  promptActionLabel?: string;
  onPromptAction?: () => void;
  desktopAction?: ReactNode;
};

// 답 입력창: 질문과 번역 보기, 입력칸, 단어 수, 초안 상태 배지, AI 코치 열기 버튼.
export function WritingComposer({
  coach,
  isMobileViewport,
  selectedPrompt,
  setShowAnswerTranslation,
  setShowHelpSheet,
  showAnswerTranslation,
  showHelpSheet,
  value,
  onChange,
  placeholder,
  wordCount,
  draftStatusMessage,
  promptActionLabel,
  onPromptAction,
  desktopAction
}: {
  coach: CoachAssistantState;
  isMobileViewport: boolean;
  selectedPrompt: Prompt | null;
  setShowAnswerTranslation: Dispatch<SetStateAction<boolean>>;
  setShowHelpSheet: Dispatch<SetStateAction<boolean>>;
  showAnswerTranslation: boolean;
  showHelpSheet: boolean;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  wordCount: number;
  draftStatusMessage?: string;
  promptActionLabel?: string;
  onPromptAction?: () => void;
  desktopAction?: ReactNode;
}) {
  const draftStatusBadgeLabel = draftStatusMessage ? toDraftStatusBadgeLabel(draftStatusMessage) : "";
  const draftStatusBadgeClassName =
    draftStatusMessage && draftStatusMessage.includes("실패")
      ? styles.composerStatusBadgeError
      : styles.composerStatusBadge;

  return (
    <section className={styles.writingComposer}>
      <div className={styles.writingComposerQuestion}>
        <p className={styles.writingComposerQuestionLabel}>질문</p>
        <p className={styles.writingComposerQuestionText}>
          {selectedPrompt?.questionEn ?? "질문을 불러오는 중입니다."}
        </p>
        {showAnswerTranslation ? (
          <small className={styles.writingComposerTranslation}>
            {selectedPrompt?.questionKo ?? "질문 해석을 불러오는 중입니다."}
          </small>
        ) : null}
        {promptActionLabel && onPromptAction ? (
          <button
            type="button"
            className={styles.writingComposerQuestionAction}
            onClick={onPromptAction}
          >
            <span className="materialSymbols" aria-hidden="true">
              refresh
            </span>
            {promptActionLabel}
          </button>
        ) : null}
      </div>
      <div className={styles.writingComposerAnswer}>
        <textarea
          className={`${styles.textarea} ${styles.composerTextarea}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={8}
        />
        <div className={styles.composerMetaBadges}>
          {draftStatusBadgeLabel ? (
            <span className={draftStatusBadgeClassName} title={draftStatusMessage}>
              {draftStatusBadgeLabel}
            </span>
          ) : null}
          <span className={styles.composerWordCount}>{wordCount}단어</span>
        </div>
        <div className={styles.coachTriggerDock}>
          {!coach.isOpen && !value.trim() ? (
            <div className={styles.coachTriggerBubble}>
              <span>표현이 막히면</span>
              <span>AI 코치에게 물어봐요.</span>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.coachTriggerButton}
            aria-label="AI 코치 열기"
            aria-haspopup="dialog"
            aria-expanded={coach.isOpen}
            onClick={() => coach.open()}
          >
            <Image
              src="/coach/mascote-face.png"
              alt=""
              width={60}
              height={60}
              sizes="(max-width: 768px) 50px, 60px"
              quality={100}
              className={styles.coachTriggerMascot}
            />
          </button>
        </div>
      </div>
      <div className={styles.writingComposerFooterRow}>
        <div className={styles.writingComposerTools}>
          <button
            type="button"
            className={styles.writingComposerToolButton}
            onClick={() => setShowAnswerTranslation((current) => !current)}
          >
            <span>{showAnswerTranslation ? "한국어 번역 숨기기" : "한국어 번역 보기"}</span>
            <span className={`materialSymbols ${styles.writingComposerToolGlyph}`} aria-hidden="true">
              translate
            </span>
          </button>
          <button
            type="button"
            className={styles.writingComposerToolButton}
            aria-haspopup={isMobileViewport ? "dialog" : undefined}
            aria-expanded={showHelpSheet}
            onClick={() => {
              if (isMobileViewport) {
                setShowHelpSheet(true);
                return;
              }

              setShowHelpSheet((current) => !current);
            }}
          >
            <span>가이드 보기</span>
            <span className={`materialSymbols ${styles.writingComposerToolGlyph}`} aria-hidden="true">
              auto_awesome
            </span>
          </button>
        </div>
        {desktopAction ? <div className={styles.composerDesktopActions}>{desktopAction}</div> : null}
      </div>
    </section>
  );
}

// 표현 연습으로 들어왔을 때 보이는 연습할 표현 카드.
export function PracticeExpressionHintCard({
  appendExpressionToCurrentDraft,
  feedback,
  practiceExpressionHint
}: {
  appendExpressionToCurrentDraft: (expression: string) => void;
  feedback: Feedback | null;
  practiceExpressionHint: PracticeExpressionHint | null;
}) {
  function renderPracticeExpressionHintCard() {
    if (!practiceExpressionHint || feedback) {
      return null;
    }

    const expressions = practiceExpressionHint.expressions.length > 0
      ? practiceExpressionHint.expressions
      : [practiceExpressionHint.expression];

    return (
      <section className={styles.practiceExpressionCard}>
        <span className={styles.practiceExpressionEyebrow}>
          {practiceExpressionHint.tagLabel ? "태그 연습" : "표현 연습"}
        </span>
        <p>
          {practiceExpressionHint.tagLabel
            ? `${practiceExpressionHint.tagLabel} 태그로 저장한 표현을 활용해 새 문장을 써보세요.`
            : "저장한 표현을 활용해 새 문장을 써보세요."}
        </p>
        <div className={styles.practiceExpressionScroller}>
          {expressions.map((expression, index) => (
            <button
              key={`${expression}-${index}`}
              type="button"
              className={`${styles.practiceExpressionChip} ${
                index === 0 ? styles.practiceExpressionChipPrimary : ""
              }`}
              onClick={() => appendExpressionToCurrentDraft(expression)}
            >
              {expression}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return renderPracticeExpressionHintCard();
}

// 넓은 화면에서 도움말을 켰을 때 화면 끝에 보이는 가이드 요약.
export function WritingGuideSummary({
  answerGuide,
  isLoadingHints,
  vocabularyPhraseHintItems,
  vocabularyWordHintItems
}: {
  answerGuide: WritingGuide;
  isLoadingHints: boolean;
  vocabularyPhraseHintItems: WritingGuideHintItem[];
  vocabularyWordHintItems: WritingGuideHintItem[];
}) {
  function renderWritingGuideSummary() {
    return (
      <div className={styles.writingGuideSummary}>
        <section className={styles.guideOverviewCard}>
          <span className={styles.guideOverviewLabel}>최고의 팁!</span>
          <strong className={styles.guideOverviewTitle}>{answerGuide.title}</strong>
          {answerGuide.description ? (
            <p className={styles.guideOverviewBody}>{answerGuide.description}</p>
          ) : null}
        </section>
        <section className={styles.guideStarterSection}>
          <strong className={styles.guideStarterSectionLabel}>첫 문장 스타터</strong>
          <div className={styles.guideStarterSurface}>
            <span className={styles.guideStarterSurfaceText}>{answerGuide.starter}</span>
          </div>
        </section>
        <section className={styles.writingGuideHintSection}>
          {isLoadingHints ? (
            <p className={styles.writingGuideHintEmpty}>지금 추천 단어와 표현을 준비하고 있어요.</p>
          ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
            <div className={styles.writingGuideHintGroups}>
              {vocabularyWordHintItems.length > 0 ? (
                <div className={styles.hintGroup}>
                  <strong className={styles.hintGroupTitle}>추천 단어</strong>
                  <div className={styles.hintChipList}>
                    {vocabularyWordHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                  </div>
                </div>
              ) : null}
              {vocabularyPhraseHintItems.length > 0 ? (
                <div className={styles.hintGroup}>
                  <strong className={styles.hintGroupTitle}>추천 표현</strong>
                  <div className={styles.hintChipList}>
                    {vocabularyPhraseHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={styles.writingGuideHintEmpty}>이 질문에는 아직 추천 단어와 표현이 없어요.</p>
          )}
        </section>
      </div>
    );
  }

  return renderWritingGuideSummary();
}

// 모바일 도움말 시트(힌트와 답 가이드).
export function HelpSheet({
  answerGuide,
  helpSheetCloseButtonRef,
  isLoadingHints,
  isMobileViewport,
  setShowHelpSheet,
  showHelpSheet,
  step,
  vocabularyPhraseHintItems,
  vocabularyWordHintItems
}: {
  answerGuide: WritingGuide;
  helpSheetCloseButtonRef: RefObject<HTMLButtonElement | null>;
  isLoadingHints: boolean;
  isMobileViewport: boolean;
  setShowHelpSheet: Dispatch<SetStateAction<boolean>>;
  showHelpSheet: boolean;
  step: Step;
  vocabularyPhraseHintItems: WritingGuideHintItem[];
  vocabularyWordHintItems: WritingGuideHintItem[];
}) {
  function renderHelpSheet() {
    if (!showHelpSheet || !isMobileViewport || (step !== "answer" && step !== "rewrite")) {
      return null;
    }

    return (
      <div className={styles.helpOverlay} onClick={() => setShowHelpSheet(false)}>
        <section
          className={styles.helpSheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby="writing-help-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            ref={helpSheetCloseButtonRef}
            type="button"
            className={styles.helpSheetClose}
            aria-label="작성 가이드 닫기"
            onClick={() => setShowHelpSheet(false)}
          >
            ×
          </button>
          <div className={styles.helpSheetHeader}>
            <strong id="writing-help-title">작성 가이드</strong>
          </div>
          <div className={styles.helpSheetBody}>
            <section className={styles.guideOverviewCard}>
              <span className={styles.guideOverviewLabel}>최고의 팁!</span>
              <strong className={styles.guideOverviewTitle}>{answerGuide.title}</strong>
              {answerGuide.description ? (
                <p className={styles.guideOverviewBody}>{answerGuide.description}</p>
              ) : null}
            </section>

            <section className={styles.guideStarterSection}>
              <strong className={styles.guideStarterSectionLabel}>첫 문장 스타터</strong>
              <div className={styles.guideStarterSurface}>
                <span className={styles.guideStarterSurfaceText}>{answerGuide.starter}</span>
              </div>
            </section>

            <section className={styles.helpSheetSection}>
              {isLoadingHints ? (
                <p className={styles.helpSheetEmpty}>지금 추천 단어와 표현을 준비하고 있어요.</p>
              ) : vocabularyWordHintItems.length > 0 || vocabularyPhraseHintItems.length > 0 ? (
                <div className={styles.helpSheetHintGroups}>
                  {vocabularyWordHintItems.length > 0 ? (
                    <div className={styles.hintGroup}>
                      <strong className={styles.hintGroupTitle}>추천 단어</strong>
                      <div className={styles.hintChipList}>
                        {vocabularyWordHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                      </div>
                    </div>
                  ) : null}
                  {vocabularyPhraseHintItems.length > 0 ? (
                    <div className={styles.hintGroup}>
                      <strong className={styles.hintGroupTitle}>추천 표현</strong>
                      <div className={styles.hintChipList}>
                        {vocabularyPhraseHintItems.map((hint) => renderWritingGuideHintCard(hint))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className={styles.helpSheetEmpty}>이 질문에는 아직 추천 단어와 표현이 없어요.</p>
              )}
            </section>
          </div>
        </section>
      </div>
    );
  }

  return renderHelpSheet();
}

// 답 쓰기 단계 화면. 상태와 처리 함수는 AnswerLoop에 두고 같은 이름으로 받는다.
export function AnswerStep({
  answer,
  answerWordCount,
  draftStatusMessage,
  handleSubmit,
  isLoadingPrompts,
  isMobileViewport,
  isSubmitting,
  mobileComposerBarStyle,
  setAnswer,
  setStep,
  showHelpSheet,
  coach,
  selectedPrompt,
  setShowAnswerTranslation,
  setShowHelpSheet,
  showAnswerTranslation,
  mobileComposerBarRef,
  appendExpressionToCurrentDraft,
  feedback,
  practiceExpressionHint,
  answerGuide,
  isLoadingHints,
  vocabularyPhraseHintItems,
  vocabularyWordHintItems
}: {
  answer: string;
  answerWordCount: number;
  draftStatusMessage: string;
  handleSubmit: (nextAnswer: string, mode: "INITIAL" | "REWRITE") => void;
  isLoadingPrompts: boolean;
  isMobileViewport: boolean;
  isSubmitting: boolean;
  mobileComposerBarStyle: CSSProperties;
  setAnswer: Dispatch<SetStateAction<string>>;
  setStep: Dispatch<SetStateAction<Step>>;
  showHelpSheet: boolean;
  coach: CoachAssistantState;
  selectedPrompt: Prompt | null;
  setShowAnswerTranslation: Dispatch<SetStateAction<boolean>>;
  setShowHelpSheet: Dispatch<SetStateAction<boolean>>;
  showAnswerTranslation: boolean;
  mobileComposerBarRef: RefObject<HTMLDivElement | null>;
  appendExpressionToCurrentDraft: (expression: string) => void;
  feedback: Feedback | null;
  practiceExpressionHint: PracticeExpressionHint | null;
  answerGuide: WritingGuide;
  isLoadingHints: boolean;
  vocabularyPhraseHintItems: WritingGuideHintItem[];
  vocabularyWordHintItems: WritingGuideHintItem[];
}) {
  function renderWritingComposer(args: WritingComposerArgs) {
    return <WritingComposer {...args} coach={coach} isMobileViewport={isMobileViewport} selectedPrompt={selectedPrompt} setShowAnswerTranslation={setShowAnswerTranslation} setShowHelpSheet={setShowHelpSheet} showAnswerTranslation={showAnswerTranslation} showHelpSheet={showHelpSheet} />;
  }

  function renderMobileComposerBar(args: MobileComposerBarArgs) {
    return <MobileComposerBar {...args} mobileComposerBarRef={mobileComposerBarRef} />;
  }

  function renderPracticeExpressionHintCard() {
    return <PracticeExpressionHintCard appendExpressionToCurrentDraft={appendExpressionToCurrentDraft} feedback={feedback} practiceExpressionHint={practiceExpressionHint} />;
  }

  function renderWritingGuideSummary() {
    return <WritingGuideSummary answerGuide={answerGuide} isLoadingHints={isLoadingHints} vocabularyPhraseHintItems={vocabularyPhraseHintItems} vocabularyWordHintItems={vocabularyWordHintItems} />;
  }

  function renderAnswerStep() {
    return (
      <section className={`${styles.stage} ${styles.writingEditorStage}`} style={mobileComposerBarStyle}>
        {renderWritingComposer({
          value: answer,
          onChange: setAnswer,
          placeholder: "여기에 영어로 첫 답변을 작성해 주세요.",
          wordCount: answerWordCount,
          draftStatusMessage,
          promptActionLabel: "질문 다시 고르기",
          onPromptAction: () => setStep("pick"),
          desktopAction: (
            <button
              type="button"
              className={styles.writingEditorPrimaryButton}
              onClick={() => handleSubmit(answer, "INITIAL")}
              disabled={isSubmitting || isLoadingPrompts}
            >
              {isSubmitting ? "피드백 생성 중..." : "답변 제출하기"}
            </button>
          )
        })}
        {renderPracticeExpressionHintCard()}
        {renderMobileComposerBar({
          secondaryLabel: "질문 목록",
          onSecondary: () => setStep("pick"),
          primaryLabel: isSubmitting ? "피드백 생성 중..." : "답변 제출",
          onPrimary: () => handleSubmit(answer, "INITIAL"),
          primaryDisabled: isSubmitting || isLoadingPrompts
        })}
        {!isMobileViewport && showHelpSheet ? renderWritingGuideSummary() : null}
      </section>
    );
  }

  return renderAnswerStep();
}

// 다시 쓰기 단계 화면.
export function RewriteStep({
  answer,
  draftStatusMessage,
  feedback,
  feedbackSummaryProps,
  handleSubmit,
  isMobileViewport,
  isSubmitting,
  lastSubmittedAnswer,
  mobileComposerBarStyle,
  rewrite,
  rewriteFeedbackPanelRef,
  rewriteWordCount,
  setRewrite,
  setShowPreviousRewriteAnswer,
  showHelpSheet,
  showPreviousRewriteAnswer,
  showRewriteFeedback,
  toggleRewriteFeedback,
  coach,
  selectedPrompt,
  setShowAnswerTranslation,
  setShowHelpSheet,
  showAnswerTranslation,
  answerGuide,
  isLoadingHints,
  vocabularyPhraseHintItems,
  vocabularyWordHintItems
}: {
  answer: string;
  draftStatusMessage: string;
  feedback: Feedback | null;
  feedbackSummaryProps: FeedbackSummaryProps;
  handleSubmit: (nextAnswer: string, mode: "INITIAL" | "REWRITE") => void;
  isMobileViewport: boolean;
  isSubmitting: boolean;
  lastSubmittedAnswer: string;
  mobileComposerBarStyle: CSSProperties;
  rewrite: string;
  rewriteFeedbackPanelRef: RefObject<HTMLElement | null>;
  rewriteWordCount: number;
  setRewrite: Dispatch<SetStateAction<string>>;
  setShowPreviousRewriteAnswer: Dispatch<SetStateAction<boolean>>;
  showHelpSheet: boolean;
  showPreviousRewriteAnswer: boolean;
  showRewriteFeedback: boolean;
  toggleRewriteFeedback: () => void;
  coach: CoachAssistantState;
  selectedPrompt: Prompt | null;
  setShowAnswerTranslation: Dispatch<SetStateAction<boolean>>;
  setShowHelpSheet: Dispatch<SetStateAction<boolean>>;
  showAnswerTranslation: boolean;
  answerGuide: WritingGuide;
  isLoadingHints: boolean;
  vocabularyPhraseHintItems: WritingGuideHintItem[];
  vocabularyWordHintItems: WritingGuideHintItem[];
}) {
  function renderWritingComposer(args: WritingComposerArgs) {
    return <WritingComposer {...args} coach={coach} isMobileViewport={isMobileViewport} selectedPrompt={selectedPrompt} setShowAnswerTranslation={setShowAnswerTranslation} setShowHelpSheet={setShowHelpSheet} showAnswerTranslation={showAnswerTranslation} showHelpSheet={showHelpSheet} />;
  }

  function renderWritingGuideSummary() {
    return <WritingGuideSummary answerGuide={answerGuide} isLoadingHints={isLoadingHints} vocabularyPhraseHintItems={vocabularyPhraseHintItems} vocabularyWordHintItems={vocabularyWordHintItems} />;
  }

  function renderRewriteStep() {
    const previousAnswerForRewrite = lastSubmittedAnswer.trim() || answer.trim() || rewrite.trim();

    return (
      <section className={`${styles.stage} ${styles.writingEditorStage}`} style={mobileComposerBarStyle}>
        {renderWritingComposer({
          value: rewrite,
          onChange: setRewrite,
          placeholder: "피드백을 반영한 영어 답변을 다시 작성해 주세요.",
          wordCount: rewriteWordCount,
          draftStatusMessage,
          promptActionLabel: showRewriteFeedback ? "이전 피드백 숨기기" : "이전 피드백 보기",
          onPromptAction: toggleRewriteFeedback
        })}
        <div className={styles.responseCard}>
          <div className={styles.mobileSectionHeader}>
            <h3>이전 답변</h3>
            <button
              type="button"
              className={styles.mobileSectionToggle}
              onClick={() => setShowPreviousRewriteAnswer((current) => !current)}
            >
              {showPreviousRewriteAnswer ? "접기" : "보기"}
            </button>
          </div>
          <div
            className={`${styles.mobileSectionBody} ${
              showPreviousRewriteAnswer ? styles.mobileSectionBodyOpen : ""
            }`}
          >
            <p>{previousAnswerForRewrite || "먼저 첫 답변을 제출해 주세요."}</p>
          </div>
        </div>
        {feedback ? (
          <section ref={rewriteFeedbackPanelRef} className={styles.rewriteFeedbackPanel}>
            <div className={styles.rewriteFeedbackHeader}>
              <div>
                <strong>이전 피드백</strong>
                <p>직전 답변에서 받은 피드백을 같은 구조로 다시 보면서 문장을 다듬어 보세요.</p>
              </div>
              <button
                type="button"
                className={styles.rewriteFeedbackToggle}
                onClick={toggleRewriteFeedback}
            >
              {showRewriteFeedback ? "피드백 숨기기" : "피드백 보기"}
            </button>
          </div>
            {showRewriteFeedback ? (
              <div className={styles.rewriteFeedbackBody}><FeedbackSummary {...feedbackSummaryProps} /></div>
            ) : null}
          </section>
        ) : null}
        <div className={styles.writingEditorFooterStack}>
          <div className={styles.writingEditorFooter}>
            <button
              type="button"
              className={styles.writingEditorPrimaryButton}
              onClick={() => handleSubmit(rewrite, "REWRITE")}
              disabled={isSubmitting || !feedback}
            >
              {isSubmitting ? "피드백 생성 중..." : "다시 쓴 답변 제출하기"}
            </button>
          </div>
        </div>
        {!isMobileViewport && showHelpSheet ? renderWritingGuideSummary() : null}
      </section>
    );
  }

  return renderRewriteStep();
}

// 완료 단계 화면(축하, 연속 학습일, 추천 질문).
export function CompleteStep({
  celebrationCanvasRef,
  completionRelatedPrompts,
  feedback,
  feedbackLevel,
  handlePickPrompt,
  handleTryAnotherPrompt,
  isLoadingPrompts,
  setStep,
  streakDays,
  todayStatus
}: {
  celebrationCanvasRef: RefObject<HTMLCanvasElement | null>;
  completionRelatedPrompts: Prompt[];
  feedback: Feedback | null;
  feedbackLevel: FeedbackView["feedbackLevel"];
  handlePickPrompt: (promptId: string) => Promise<void>;
  handleTryAnotherPrompt: () => void;
  isLoadingPrompts: boolean;
  setStep: Dispatch<SetStateAction<Step>>;
  streakDays: number;
  todayStatus: TodayWritingStatus | null;
}) {
  function renderCompleteStep() {
    const recommendedPrompts = completionRelatedPrompts.slice(0, 2);
    const completionHeading = "루프를 완주했어요!";
    const completionSubcopy =
      feedback?.completionMessage?.trim() ??
      feedbackLevel?.loopSummary ??
      "꾸준함이 실력을 만듭니다. 오늘도 멋진 글을 썼네요!";
    const streakLabel =
      streakDays > 0 ? `${streakDays}일 연속 학습 중` : "오늘 첫 루프 완료";
    const totalWrittenSentenceLabel = `총 ${(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성`;

    return (
      <section className={styles.completeStage}>
        <canvas ref={celebrationCanvasRef} className={styles.celebrationCanvas} aria-hidden="true" />
        <div className={styles.completionStoryShell}>
          <div className={styles.completionMascotStage}>
            <div className={styles.completionMascotFrame}>
              <Image
                src="/complete/excellent.png"
                alt="WriteLoop 완료 마스코트"
                width={120}
                height={120}
                className={styles.completionMascotImage}
              />
            </div>
            <span className={styles.completionMascotBadge}>SUCCESS!</span>
          </div>

          <div className={styles.completionStoryCopy}>
            <h2>{completionHeading}</h2>
            <p>{completionSubcopy}</p>
          </div>

          <div className={styles.completionStreakPanel}>
            <div className={styles.completionStreakIcon}>
              <span className="materialSymbols">local_fire_department</span>
            </div>
            <span className={styles.completionStreakEyebrow}>CURRENT STREAK</span>
            <strong>{streakLabel}</strong>
            <p className={styles.completionStreakMeta}>{totalWrittenSentenceLabel}</p>
          </div>

          {recommendedPrompts.length > 0 ? (
            <div className={styles.completionRecommendationSection}>
              <div className={styles.completionRecommendationTitle}>
                <span className="materialSymbols">timelapse</span>
                <strong>다음 질문 추천</strong>
              </div>
              <div className={styles.completionRecommendationList}>
                {recommendedPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className={styles.completionRecommendationCard}
                    onClick={() => void handlePickPrompt(prompt.id)}
                  >
                    <span>{`${getDifficultyLabel(prompt.difficulty)} • ${prompt.topic}`}</span>
                    <strong>{prompt.questionEn}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.completionActionStack}>
            {recommendedPrompts.length > 0 ? (
              <button
                type="button"
                className={`${styles.primaryButton} ${styles.completionActionPrimary}`}
                onClick={() => void handlePickPrompt(recommendedPrompts[0].id)}
                disabled={isLoadingPrompts}
              >
                추천 질문에 이어서 답변하기
              </button>
            ) : null}
            <div className={styles.completionActionRow}>
              <button
                type="button"
                className={`${styles.ghostButton} ${styles.completionActionSecondary}`}
                onClick={handleTryAnotherPrompt}
              >
                다른 질문 보기
              </button>
              <button
                type="button"
                className={`${styles.ghostButton} ${styles.completionActionSecondary}`}
                onClick={() => setStep("feedback")}
              >
                마지막 피드백 다시 보기
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return renderCompleteStep();
}
