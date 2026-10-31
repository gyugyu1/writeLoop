"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import styles from "../../app/page.module.css";
import { getDifficultyLabel } from "../../lib/difficulty";
import type { IncompleteLoopState } from "../../lib/incomplete-loop";
import type { getIncompleteLoopCopy } from "../../lib/incomplete-loop-copy";
import type {
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  FeaturedDailyPromptRecommendation,
  Prompt,
  TodayWritingStatus
} from "../../lib/types";
import type { buildWelcomeWeek } from "../../lib/writing-calendar";
import type { MonthStatusState } from "./use-month-status";

export type PickFlowScreen = "difficulty" | "prompt";
type DifficultyStageIconName = "auto_stories" | "menu_book" | "psychology";
type LandingFeaturedPromptItem = NonNullable<FeaturedDailyPromptRecommendation["featured"]>;

const DIFFICULTY_OPTIONS: Array<{
  value: DailyDifficulty;
  label: string;
  level: string;
  icon: DifficultyStageIconName;
  description: string;
  duration: string;
  recommended?: boolean;
}> = [
  {
    value: "I",
    label: "입문",
    level: "LEVEL 01",
    icon: "auto_stories",
    description: "짧은 한두 문장으로도 바로 답할 수 있는 가장 가벼운 질문부터 시작해 보세요.",
    duration: "2-3분"
  },
  {
    value: "A",
    label: "쉬움",
    level: "LEVEL 02",
    icon: "auto_stories",
    description: "기본 어휘와 쉬운 문장 구조로 부담 없이 첫 루프를 시작해 보세요.",
    duration: "3-5분"
  },
  {
    value: "B",
    label: "보통",
    level: "LEVEL 03",
    icon: "menu_book",
    description: "일상적인 주제와 문장 구조로 표현의 폭을 차분하게 넓혀 보세요.",
    recommended: true,
    duration: "5-8분"
  },
  {
    value: "C",
    label: "어려움",
    level: "LEVEL 04",
    icon: "psychology",
    description: "한 단계 더 복잡한 내용과 논리를 담아 깊이 있는 작문에 도전해 보세요.",
    duration: "8-12분"
  }
];

// 질문 고르기 화면 안의 "이어 쓰기" 카드.
export function IncompleteLoopResumeCard({
  incompleteLoop,
  incompleteLoopCopy,
  incompleteLoopSavedAt,
  handleResumeIncompleteLoop
}: {
  incompleteLoop: IncompleteLoopState | null;
  incompleteLoopCopy: ReturnType<typeof getIncompleteLoopCopy> | null;
  incompleteLoopSavedAt: string;
  handleResumeIncompleteLoop: () => Promise<void>;
}) {
  function renderIncompleteLoopResumeCard() {
    if (!incompleteLoop || !incompleteLoopCopy) {
      return null;
    }

    const promptQuestion = incompleteLoop.promptSnapshot.questionEn.trim();
    const promptTopic = incompleteLoop.promptSnapshot.topic.trim();
    const metaParts = [promptTopic, incompleteLoopSavedAt ? `${incompleteLoopSavedAt}에 저장` : ""].filter(Boolean);

    return (
      <section className={styles.difficultyHomeResumeCard}>
        <div className={styles.difficultyHomeResumeLead}>
          <span className={styles.difficultyHomeResumeIcon} aria-hidden="true">
            <span className={`materialSymbols ${styles.difficultyHomeResumeIconGlyph}`}>
              {incompleteLoopCopy.icon}
            </span>
          </span>
          <div className={styles.difficultyHomeResumeCopy}>
            <div className={styles.difficultyHomeResumeTop}>
              <strong>{incompleteLoopCopy.title}</strong>
              <span className={styles.difficultyHomeResumeBadge}>{incompleteLoopCopy.badgeLabel}</span>
            </div>
            <p>{incompleteLoopCopy.body}</p>
            {promptQuestion ? (
              <strong className={styles.difficultyHomeResumeQuestion}>{promptQuestion}</strong>
            ) : null}
            {metaParts.length > 0 ? (
              <span className={styles.difficultyHomeResumeMeta}>{metaParts.join(" · ")}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className={styles.difficultyHomeResumeButton}
          onClick={() => void handleResumeIncompleteLoop()}
        >
          <span>{incompleteLoopCopy.ctaLabel}</span>
          <span className={`materialSymbols ${styles.difficultyHomeResumeButtonIcon}`} aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </section>
    );
  }

  return renderIncompleteLoopResumeCard();
}

export type PickStepProps = {
  clearCoachState: () => void;
  currentUser: AuthUser | null;
  featuredPromptId: string;
  handlePickPrompt: (promptId: string) => Promise<void>;
  handleRefreshPromptList: () => Promise<void>;
  isLandingFeaturedPromptTranslationVisible: boolean;
  isLoadingFeaturedPrompt: boolean;
  isLoadingPrompts: boolean;
  isRefreshingQuestion: boolean;
  landingFeaturedPrompt: LandingFeaturedPromptItem["prompt"] | null;
  landingFeaturedPromptItem: LandingFeaturedPromptItem | null;
  monthStatusModal: MonthStatusState;
  pickFlowScreen: PickFlowScreen;
  prompts: Prompt[];
  revealedTranslations: Record<string, boolean>;
  selectedDifficulty: DailyDifficulty;
  setDailyRecommendation: Dispatch<SetStateAction<DailyPromptRecommendation | null>>;
  setError: Dispatch<SetStateAction<string>>;
  setIsLandingFeaturedPromptTranslationVisible: Dispatch<SetStateAction<boolean>>;
  setIsLoadingPrompts: Dispatch<SetStateAction<boolean>>;
  setPickFlowScreen: Dispatch<SetStateAction<PickFlowScreen>>;
  setSelectedDifficulty: Dispatch<SetStateAction<DailyDifficulty>>;
  setSelectedPromptId: Dispatch<SetStateAction<string>>;
  setShowHelpSheet: Dispatch<SetStateAction<boolean>>;
  todayStatus: TodayWritingStatus | null;
  togglePromptTranslation: (promptId: string) => void;
  welcomeWeekDays: ReturnType<typeof buildWelcomeWeek>;
  incompleteLoop: IncompleteLoopState | null;
  incompleteLoopCopy: ReturnType<typeof getIncompleteLoopCopy> | null;
  incompleteLoopSavedAt: string;
  handleResumeIncompleteLoop: () => Promise<void>;
};

// 질문 고르기 단계: 난이도 고르기 화면(오늘의 추천 질문, 학습 일지 포함)과 질문 목록 화면.
// 상태와 처리 함수는 AnswerLoop에 두고 같은 이름으로 받는다.
export function PickStep({
  clearCoachState,
  currentUser,
  featuredPromptId,
  handlePickPrompt,
  handleRefreshPromptList,
  isLandingFeaturedPromptTranslationVisible,
  isLoadingFeaturedPrompt,
  isLoadingPrompts,
  isRefreshingQuestion,
  landingFeaturedPrompt,
  landingFeaturedPromptItem,
  monthStatusModal,
  pickFlowScreen,
  prompts,
  revealedTranslations,
  selectedDifficulty,
  setDailyRecommendation,
  setError,
  setIsLandingFeaturedPromptTranslationVisible,
  setIsLoadingPrompts,
  setPickFlowScreen,
  setSelectedDifficulty,
  setSelectedPromptId,
  setShowHelpSheet,
  todayStatus,
  togglePromptTranslation,
  welcomeWeekDays,
  incompleteLoop,
  incompleteLoopCopy,
  incompleteLoopSavedAt,
  handleResumeIncompleteLoop
}: PickStepProps) {
  function renderIncompleteLoopResumeCard() {
    return (
      <IncompleteLoopResumeCard
        incompleteLoop={incompleteLoop}
        incompleteLoopCopy={incompleteLoopCopy}
        incompleteLoopSavedAt={incompleteLoopSavedAt}
        handleResumeIncompleteLoop={handleResumeIncompleteLoop}
      />
    );
  }

  function renderPickStep() {
    if (pickFlowScreen === "difficulty") {
      return (
        <section className={styles.pickFlow}>
          <section className={styles.difficultyHomeHero}>
            <div className={styles.mobileSyncHeaderRow}>
              <div className={styles.mobileSyncTitleBlock}>
                <h1 className={styles.difficultyHomeTitle}>난이도 선택</h1>
                <span className={styles.difficultyHomeUnderline} aria-hidden="true" />
              </div>
              <button
                type="button"
                className={styles.mobileSyncHeaderButton}
                onClick={() => setShowHelpSheet(true)}
              >
                가이드 보기
              </button>
            </div>

            <button
              type="button"
              className={`${styles.difficultyHomeStatusPanel} ${
                currentUser ? styles.difficultyHomeStatusPanelInteractive : ""
              }`}
              disabled={!currentUser}
              aria-label={currentUser ? "이번 달 학습 기록 열기" : "학습 안내"}
              aria-haspopup={currentUser ? "dialog" : undefined}
              aria-expanded={currentUser ? monthStatusModal.isOpen : undefined}
              onClick={currentUser ? monthStatusModal.open : undefined}
            >
              <div className={styles.difficultyHomeStatusLead}>
                <span className={styles.difficultyHomeStatusIcon} aria-hidden="true">
                  <span className={`materialSymbols ${styles.difficultyHomeStatusIconGlyph}`}>
                    calendar_today
                  </span>
                </span>
                <div className={styles.difficultyHomeStatusCopy}>
                  <div className={styles.difficultyHomeStatusTop}>
                    <strong>학습 일지</strong>
                    <span className={styles.difficultyHomeStatusBadge}>
                      {currentUser ? "ACTIVE" : "START"}
                    </span>
                  </div>
                  <p>
                    {currentUser
                      ? `현재 ${todayStatus?.streakDays ?? 0}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`
                      : "부담 없이 첫 루프를 시작하고 오늘의 작문 감각을 깨워 보세요."}
                  </p>
                  {currentUser ? (
                    <span className={styles.difficultyHomeStatusMeta}>
                      총 {(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}문장 작성
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={styles.difficultyHomeWeekRow}>
                {welcomeWeekDays.map((day) => (
                  <span
                    key={day.key}
                    className={`${styles.difficultyHomeWeekDay} ${
                      day.isCompleted ? styles.difficultyHomeWeekDayDone : ""
                    } ${day.isToday ? styles.difficultyHomeWeekDayToday : ""}`}
                  >
                    <span className={styles.difficultyHomeWeekDayText}>{day.label}</span>
                  </span>
                ))}
              </div>
            </button>
          </section>

          {renderIncompleteLoopResumeCard()}

          <Link href="/diary" className={styles.difficultyHomeDiaryShortcut}>
            <span className={styles.difficultyHomeDiaryIcon} aria-hidden="true">
              <span className={`materialSymbols ${styles.difficultyHomeDiaryIconGlyph}`}>
                edit_note
              </span>
            </span>
            <span className={styles.difficultyHomeDiaryCopy}>
              <strong>자유 영어일기 쓰기</strong>
              <small>질문 없이 오늘 있었던 일을 영어로 쓰고 일기 전용 피드백을 받아보세요.</small>
            </span>
            <span className={`materialSymbols ${styles.difficultyHomeDiaryArrow}`} aria-hidden="true">
              arrow_forward
            </span>
          </Link>

          <section className={styles.prefeaturedPromptSection}>
            <div className={styles.prefeaturedPromptHeader}>
              <strong>오늘의 추천 질문</strong>
              <span className={styles.prefeaturedPromptDifficultyBadge}>
                {getDifficultyLabel(selectedDifficulty)}
              </span>
            </div>

            {isLoadingFeaturedPrompt ? (
              <div className={styles.prefeaturedPromptLoadingCard}>
                <span className={`materialSymbols ${styles.prefeaturedPromptLoadingIcon}`} aria-hidden="true">
                  hourglass_top
                </span>
                <p>추천 질문을 고르고 있어요.</p>
              </div>
            ) : landingFeaturedPrompt ? (
              <article
                role="button"
                tabIndex={0}
                className={styles.prefeaturedPromptCard}
                onClick={() => void handlePickPrompt(landingFeaturedPrompt.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void handlePickPrompt(landingFeaturedPrompt.id);
                  }
                }}
              >
                <div className={styles.prefeaturedPromptCardCopy}>
                  <strong>{landingFeaturedPrompt.questionEn}</strong>
                  {isLandingFeaturedPromptTranslationVisible ? (
                    <p>{landingFeaturedPrompt.questionKo}</p>
                  ) : null}
                  {landingFeaturedPromptItem?.reasonText ? (
                    <small>{landingFeaturedPromptItem.reasonText}</small>
                  ) : null}
                </div>
                <div className={styles.prefeaturedPromptCardFooter}>
                  <span>{landingFeaturedPrompt.topic}</span>
                  <button
                    type="button"
                    className={styles.promptTranslationButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsLandingFeaturedPromptTranslationVisible((current) => !current);
                    }}
                  >
                    {isLandingFeaturedPromptTranslationVisible ? "해석 숨기기" : "해석 보기"}
                  </button>
                </div>
              </article>
            ) : (
              <div className={styles.prefeaturedPromptFallbackCard}>
                <p>오늘의 추천 질문을 준비하지 못했어요. 아래에서 난이도를 골라 시작할 수 있어요.</p>
              </div>
            )}
          </section>

          <section className={styles.difficultyHomeStage}>
            <div className={styles.difficultyHomeCardGrid}>
              {DIFFICULTY_OPTIONS.map((option) => {
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-tone={option.value}
                    className={styles.difficultyHomeCard}
                    onClick={() => {
                      if (option.value !== selectedDifficulty) {
                        clearCoachState();
                        setDailyRecommendation(null);
                        setSelectedPromptId("");
                        setIsLoadingPrompts(true);
                      }
                      setSelectedDifficulty(option.value);
                      setPickFlowScreen("prompt");
                      setError("");
                    }}
                  >
                    <span className={styles.difficultyHomeCardLevel}>
                      {option.level}
                    </span>

                    <span className={styles.difficultyHomeCardIconWrap} aria-hidden="true">
                      <span className={`materialSymbols ${styles.difficultyHomeCardIcon}`}>
                        {option.icon}
                      </span>
                    </span>

                    <div className={styles.difficultyHomeCardCopy}>
                      <strong>{option.label}</strong>
                      <p>{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </section>
      );
    }

    return (
      <section className={styles.pickFlow}>
        <section className={styles.difficultyHomeHero}>
          <div className={styles.promptSelectionHeroCompact}>
            <div className={styles.promptSelectionHeaderRow}>
              <div className={styles.promptSelectionTitleBlock}>
                <h1 className={styles.promptSelectionTitle}>질문 선택</h1>
                <div className={styles.promptSelectionMetaRow}>
                  <span className={styles.promptSelectionMetaUnderline} aria-hidden="true" />
                  <span className={styles.promptSelectionDifficultyText}>
                    {getDifficultyLabel(selectedDifficulty)}
                  </span>
                </div>
              </div>

              <div className={styles.promptSelectionHeaderActions}>
                <button
                  type="button"
                  className={styles.promptSelectionStatusButton}
                  onClick={() => setPickFlowScreen("difficulty")}
                >
                  난이도 선택
                </button>
                <button
                  type="button"
                  className={styles.promptSelectionStatusButton}
                  onClick={handleRefreshPromptList}
                  disabled={isLoadingPrompts || isRefreshingQuestion || prompts.length === 0}
                >
                  {isRefreshingQuestion ? "불러오는 중..." : "새 질문"}
                </button>
              </div>
            </div>
          </div>

        </section>

        {renderIncompleteLoopResumeCard()}

          <section className={styles.difficultyHomeStage}>
            <div className={styles.promptSelectionCardGrid}>
              {prompts.map((prompt, index) => {
                const isTranslationVisible = Boolean(revealedTranslations[prompt.id]);
                const isFeaturedPrompt = prompt.id === featuredPromptId;

              return (
                <article
                  key={prompt.id}
                  role="button"
                  tabIndex={0}
                  data-tone={prompt.difficulty}
                  className={styles.promptSelectionCardCompact}
                  onClick={() => void handlePickPrompt(prompt.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handlePickPrompt(prompt.id);
                    }
                  }}
                >
                  <div className={styles.promptSelectionCardTopRow}>
                    <span className={styles.promptSelectionCardIndex}>
                      {`QUESTION ${String(index + 1).padStart(2, "0")}`}
                    </span>
                    {isFeaturedPrompt ? (
                      <span className={styles.promptSelectionFeaturedBadge}>오늘의 추천 질문</span>
                    ) : null}
                  </div>

                  <div className={styles.promptSelectionCardCopy}>
                    <strong>{prompt.questionEn}</strong>
                    {isTranslationVisible ? (
                      <small className={styles.translationText}>{prompt.questionKo}</small>
                    ) : null}
                  </div>

                  <div className={styles.promptSelectionCardFooter}>
                    <span className={styles.promptSelectionCardMeta}>{prompt.topic}</span>
                    <button
                      type="button"
                      className={`${styles.promptTranslationButton} ${styles.promptSelectionCardTranslateButton}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePromptTranslation(prompt.id);
                      }}
                    >
                      {isTranslationVisible ? "해석 숨기기" : "해석 보기"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    );
  }

  return renderPickStep();
}
