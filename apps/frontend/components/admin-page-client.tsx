"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminPromptRecommendationMetrics,
  createAdminPrompt,
  createAdminPromptHint,
  deleteAdminPrompt,
  deleteAdminPromptHint,
  getAdminPromptTopicCatalog,
  getAdminPrompts,
  getCurrentUser,
  updateAdminPrompt,
  updateAdminPromptHint
} from "../lib/api";
import type {
  AdminPromptRecommendationMetrics,
  AdminPrompt,
  AdminPromptHint,
  AdminPromptHintRequest,
  AdminPromptRequest,
  AdminPromptTopicCatalogEntry,
  AuthUser,
  DailyDifficulty,
  PromptCoachProfile,
  PromptDifficulty
} from "../lib/types";
import authStyles from "./auth-page.module.css";
import styles from "./admin-page.module.css";

const difficultyOptions: PromptDifficulty[] = ["I", "A", "B", "C"];
const hintTypeOptions = [
  "STARTER",
  "VOCAB_WORD",
  "VOCAB_PHRASE",
  "STRUCTURE",
  "DETAIL",
  "LINKER"
] as const;

const emptyCoachProfile: PromptCoachProfile = {
  primaryCategory: "GENERAL",
  secondaryCategories: [],
  preferredExpressionFamilies: [],
  avoidFamilies: [],
  starterStyle: "DIRECT",
  notes: ""
};

const emptyPromptForm: AdminPromptRequest = {
  topicCategory: "",
  topicDetail: "",
  difficulty: "A",
  questionEn: "",
  questionKo: "",
  tip: "",
  displayOrder: 0,
  active: true,
  coachProfile: { ...emptyCoachProfile }
};

const emptyHintForm: AdminPromptHintRequest = {
  hintType: "STARTER",
  title: "",
  items: [],
  displayOrder: 0,
  active: true
};

function toPromptForm(prompt: AdminPrompt): AdminPromptRequest {
  return {
    topicCategory: prompt.topicCategory,
    topicDetail: prompt.topicDetail,
    difficulty: prompt.difficulty,
    questionEn: prompt.questionEn,
    questionKo: prompt.questionKo,
    tip: prompt.tip,
    displayOrder: prompt.displayOrder,
    active: prompt.active,
    coachProfile: {
      ...emptyCoachProfile,
      ...(prompt.coachProfile ?? {})
    }
  };
}

function toHintForm(hint: AdminPromptHint): AdminPromptHintRequest {
  return {
    hintType: hint.hintType,
    title: hint.title ?? "",
    items: (hint.items ?? []).map((item) => item.content),
    displayOrder: hint.displayOrder,
    active: hint.active
  };
}

function parseHintItemsInput(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatHintItemsInput(values: string[] | undefined) {
  return (values ?? []).join("\n");
}

function parseListInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatListInput(values: string[] | undefined) {
  return (values ?? []).join(", ");
}

function updateTopicSelection(
  topicCatalog: AdminPromptTopicCatalogEntry[],
  current: AdminPromptRequest,
  nextTopicCategory: string,
  nextTopicDetail?: string
): AdminPromptRequest {
  const allowedDetails = getPromptTopicDetails(topicCatalog, nextTopicCategory);
  const resolvedTopicDetail =
    nextTopicDetail !== undefined
      ? nextTopicDetail
      : allowedDetails.includes(current.topicDetail)
        ? current.topicDetail
        : "";

  return {
    ...current,
    topicCategory: nextTopicCategory,
    topicDetail: resolvedTopicDetail
  };
}

function getPromptTopicDetails(
  topicCatalog: AdminPromptTopicCatalogEntry[],
  category: string
) {
  return [...(topicCatalog.find((entry) => entry.category === category)?.details ?? [])];
}

function getDifficultyDisplayLabel(difficulty: PromptDifficulty) {
  switch (difficulty) {
    case "I":
      return "입문";
    case "A":
      return "쉬움";
    case "B":
      return "보통";
    case "C":
      return "어려움";
    default:
      return difficulty;
  }
}

function getPromptCardIcon(topicCategory: string, topicDetail: string) {
  const source = `${topicCategory} ${topicDetail}`.toLowerCase();

  if (source.includes("travel") || source.includes("여행")) {
    return "flight_takeoff";
  }
  if (source.includes("food") || source.includes("음식") || source.includes("restaurant")) {
    return "restaurant";
  }
  if (source.includes("work") || source.includes("business") || source.includes("직장")) {
    return "work";
  }
  if (source.includes("study") || source.includes("school") || source.includes("교육")) {
    return "school";
  }

  return "edit_note";
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeDateInputValue(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDateInputValue(date);
}

function formatMetricRate(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value || 0);
}

function formatMetricCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function getRecommendationSlotLabel(slotType: string) {
  switch (slotType) {
    case "FEATURED":
      return "대표 추천";
    case "ALTERNATIVE_1":
      return "대안 1";
    case "ALTERNATIVE_2":
      return "대안 2";
    default:
      return slotType;
  }
}

function getRecommendationReasonLabel(reasonCode: string) {
  switch (reasonCode) {
    case "QUICK_START":
      return "첫 문장 시작 쉬움";
    case "REUSE_SAVED_EXPRESSION":
      return "저장 표현 재사용";
    case "ONE_REASON_UP":
      return "이유 한 줄 확장";
    case "TIME_MARKER_REUSE":
      return "시간·장소 표현 재사용";
    case "TOPIC_FRESH":
      return "새로운 주제 감각";
    case "STREAK_KEEPER":
      return "연속 학습 유지";
    case "HALF_STEP_GROWTH":
      return "반 걸음 성장";
    case "ADD_EXAMPLE":
      return "예시 붙이기";
    case "CATEGORY_BALANCE":
      return "카테고리 균형";
    case "LOW_PRESSURE_VALID":
      return "가볍게 시작 가능";
    case "SAVEABLE_OUTPUT":
      return "표현 저장 기대";
    case "TRANSFER_PRACTICE":
      return "익숙한 표현 전이";
    default:
      return reasonCode;
  }
}

export function AdminPageClient() {
  const createSectionRef = useRef<HTMLElement | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [topicCatalog, setTopicCatalog] = useState<AdminPromptTopicCatalogEntry[]>([]);
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [promptForms, setPromptForms] = useState<Record<string, AdminPromptRequest>>({});
  const [hintForms, setHintForms] = useState<Record<string, AdminPromptHintRequest>>({});
  const [newHintForms, setNewHintForms] = useState<Record<string, AdminPromptHintRequest>>({});
  const [newPromptForm, setNewPromptForm] = useState<AdminPromptRequest>(emptyPromptForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});
  const [recommendationMetrics, setRecommendationMetrics] =
    useState<AdminPromptRecommendationMetrics | null>(null);
  const [recommendationMetricsLoading, setRecommendationMetricsLoading] = useState(false);
  const [recommendationMetricsError, setRecommendationMetricsError] = useState("");
  const [metricsStartDate, setMetricsStartDate] = useState(() => getRelativeDateInputValue(-13));
  const [metricsEndDate, setMetricsEndDate] = useState(() => getRelativeDateInputValue(0));
  const [metricsDifficulty, setMetricsDifficulty] = useState<DailyDifficulty | "">("");

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        const user = await getCurrentUser();
        if (!mounted) {
          return;
        }

        setCurrentUser(user);
        if (!user?.admin) {
          setLoading(false);
          return;
        }

        const [adminPrompts, adminTopicCatalog] = await Promise.all([
          getAdminPrompts(),
          getAdminPromptTopicCatalog()
        ]);
        if (!mounted) {
          return;
        }

        setTopicCatalog(adminTopicCatalog);
        applyPromptState(adminPrompts);
        setLoading(false);
        void loadRecommendationMetrics();
      } catch {
        if (!mounted) {
          return;
        }

        setError("관리자 화면을 불러오지 못했어요.");
        setLoading(false);
      }
    }

    void loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  const activePromptCount = useMemo(
    () => prompts.filter((prompt) => prompt.active).length,
    [prompts]
  );

  async function loadRecommendationMetrics(nextFilters?: {
    startDate?: string;
    endDate?: string;
    difficulty?: DailyDifficulty | "";
  }) {
    const filters = {
      startDate: nextFilters?.startDate ?? metricsStartDate,
      endDate: nextFilters?.endDate ?? metricsEndDate,
      difficulty: nextFilters?.difficulty ?? metricsDifficulty
    };

    try {
      setRecommendationMetricsLoading(true);
      setRecommendationMetricsError("");
      const nextMetrics = await getAdminPromptRecommendationMetrics(filters);
      setRecommendationMetrics(nextMetrics);
    } catch (caughtError) {
      setRecommendationMetricsError(
        caughtError instanceof Error
          ? caughtError.message
          : "추천 성과 데이터를 불러오지 못했어요."
      );
    } finally {
      setRecommendationMetricsLoading(false);
    }
  }

  function applyPromptState(adminPrompts: AdminPrompt[]) {
    setPrompts(adminPrompts);
    setPromptForms(
      Object.fromEntries(adminPrompts.map((prompt) => [prompt.id, toPromptForm(prompt)]))
    );
    setHintForms(
      Object.fromEntries(
        adminPrompts.flatMap((prompt) =>
          prompt.hints.map((hint) => [hint.id, toHintForm(hint)] as const)
        )
      )
    );
    setNewHintForms(
      Object.fromEntries(adminPrompts.map((prompt) => [prompt.id, { ...emptyHintForm }]))
    );
    setExpandedPromptIds((current) => {
      const next = { ...current };
      for (const prompt of adminPrompts) {
        if (!(prompt.id in next)) {
          next[prompt.id] = false;
        }
      }
      for (const key of Object.keys(next)) {
        if (!adminPrompts.some((prompt) => prompt.id === key)) {
          delete next[key];
        }
      }
      return next;
    });
  }

  function updatePromptForm(promptId: string, updater: (current: AdminPromptRequest) => AdminPromptRequest) {
    setPromptForms((current) => ({
      ...current,
      [promptId]: updater(current[promptId] ?? emptyPromptForm)
    }));
  }

  function updatePromptCoachProfile(
    promptId: string,
    updater: (current: PromptCoachProfile) => PromptCoachProfile
  ) {
    updatePromptForm(promptId, (current) => ({
      ...current,
      coachProfile: updater(current.coachProfile ?? emptyCoachProfile)
    }));
  }

  function updateHintForm(hintId: string, updater: (current: AdminPromptHintRequest) => AdminPromptHintRequest) {
    setHintForms((current) => ({
      ...current,
      [hintId]: updater(current[hintId] ?? emptyHintForm)
    }));
  }

  function updateNewHintForm(
    promptId: string,
    updater: (current: AdminPromptHintRequest) => AdminPromptHintRequest
  ) {
    setNewHintForms((current) => ({
      ...current,
      [promptId]: updater(current[promptId] ?? emptyHintForm)
    }));
  }

  async function refreshPrompts(successMessage?: string) {
    const adminPrompts = await getAdminPrompts();
    applyPromptState(adminPrompts);
    if (successMessage) {
      setNotice(successMessage);
    }
  }

  async function handleCreatePrompt() {
    try {
      setError("");
      setNotice("");
      await createAdminPrompt(newPromptForm);
      setNewPromptForm({ ...emptyPromptForm, coachProfile: { ...emptyCoachProfile } });
      await refreshPrompts("질문을 추가했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 추가하지 못했어요.");
    }
  }

  async function handleSavePrompt(promptId: string) {
    try {
      setError("");
      setNotice("");
      await updateAdminPrompt(promptId, promptForms[promptId]);
      await refreshPrompts("질문을 저장했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 저장하지 못했어요.");
    }
  }

  async function handleDeletePrompt(promptId: string) {
    try {
      setError("");
      setNotice("");
      await deleteAdminPrompt(promptId);
      await refreshPrompts("질문을 비활성화했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 비활성화하지 못했어요.");
    }
  }

  async function handleCreateHint(promptId: string) {
    try {
      setError("");
      setNotice("");
      await createAdminPromptHint(promptId, newHintForms[promptId] ?? emptyHintForm);
      await refreshPrompts("힌트를 추가했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "힌트를 추가하지 못했어요.");
    }
  }

  async function handleSaveHint(promptId: string, hintId: string) {
    try {
      setError("");
      setNotice("");
      await updateAdminPromptHint(promptId, hintId, hintForms[hintId]);
      await refreshPrompts("힌트를 저장했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "힌트를 저장하지 못했어요.");
    }
  }

  async function handleDeleteHint(promptId: string, hintId: string) {
    try {
      setError("");
      setNotice("");
      await deleteAdminPromptHint(promptId, hintId);
      await refreshPrompts("힌트를 비활성화했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "힌트를 비활성화하지 못했어요.");
    }
  }

  function togglePrompt(promptId: string) {
    setExpandedPromptIds((current) => ({
      ...current,
      [promptId]: !current[promptId]
    }));
  }

  function resetNewPromptForm() {
    setNewPromptForm({ ...emptyPromptForm, coachProfile: { ...emptyCoachProfile } });
  }

  function handleResetMetricsFilters() {
    const nextStartDate = getRelativeDateInputValue(-13);
    const nextEndDate = getRelativeDateInputValue(0);
    setMetricsStartDate(nextStartDate);
    setMetricsEndDate(nextEndDate);
    setMetricsDifficulty("");
    void loadRecommendationMetrics({
      startDate: nextStartDate,
      endDate: nextEndDate,
      difficulty: ""
    });
  }

  if (loading || currentUser === undefined) {
    return (
      <main className={authStyles.page}>
        <section className={authStyles.emptyCard}>
          <h2>관리 화면을 준비하고 있어요</h2>
          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={authStyles.page}>
        <section className={authStyles.emptyCard}>
          <h2>로그인이 필요해요</h2>
          <p>관리자 화면은 로그인 후에만 열 수 있어요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser.admin) {
    return (
      <main className={authStyles.page}>
        <section className={authStyles.emptyCard}>
          <h2>관리자 권한이 필요해요</h2>
          <p>등록된 관리자 이메일로 로그인해야 질문과 힌트를 관리할 수 있어요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={authStyles.page}>
      <div className={styles.pageShell}>
        <section className={styles.pageHeader}>
          <div className={styles.pageHeaderCopy}>
            <p className={styles.pageEyebrow}>관리자 대시보드</p>
            <h1 className={styles.pageTitle}>질문 및 콘텐츠 관리</h1>
            <p className={styles.pageSubtitle}>
              시스템의 오늘의 질문과 힌트를 넓은 작업 영역에서 빠르게 관리하세요.
            </p>
          </div>
          <div className={styles.pageMetaRow}>
            <div className={styles.pageMetaChip}>
              <span>전체 질문</span>
              <strong>{prompts.length}개</strong>
            </div>
            <div className={styles.pageMetaChip}>
              <span>활성 질문</span>
              <strong>{activePromptCount}개</strong>
            </div>
          </div>
        </section>

        {notice ? <p className={authStyles.notice}>{notice}</p> : null}
        {error ? <p className={authStyles.error}>{error}</p> : null}

        <section className={styles.listSection}>
          <div className={styles.listHeaderBar}>
            <div className={styles.sectionHeaderCompact}>
              <p className={styles.sectionEyebrow}>추천 성과</p>
              <h2>오늘의 질문 추천 성과 보기</h2>
              <p className={styles.metricsSectionDescription}>
                노출부터 클릭, 첫 제출, 루프 완료까지 추천 성과를 한 화면에서 확인해요.
              </p>
            </div>
            <div className={styles.metricsHeaderActions}>
              <button
                type="button"
                className={styles.listSortButton}
                onClick={() => void loadRecommendationMetrics()}
                disabled={recommendationMetricsLoading}
              >
                {recommendationMetricsLoading ? "불러오는 중..." : "새로고침"}
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          </div>

          <div className={styles.metricsFilterGrid}>
            <label className={styles.field}>
              <span>시작일</span>
              <input
                className={styles.input}
                type="date"
                value={metricsStartDate}
                onChange={(event) => setMetricsStartDate(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>종료일</span>
              <input
                className={styles.input}
                type="date"
                value={metricsEndDate}
                onChange={(event) => setMetricsEndDate(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>난이도</span>
              <select
                className={styles.input}
                value={metricsDifficulty}
                onChange={(event) =>
                  setMetricsDifficulty((event.target.value as DailyDifficulty | "") ?? "")
                }
              >
                <option value="">전체</option>
                {difficultyOptions.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {getDifficultyDisplayLabel(difficulty)}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.metricsFilterActions}>
              <button
                type="button"
                className={authStyles.ghostButton}
                onClick={handleResetMetricsFilters}
                disabled={recommendationMetricsLoading}
              >
                최근 14일로 초기화
              </button>
              <button
                type="button"
                className={authStyles.primaryButton}
                onClick={() =>
                  void loadRecommendationMetrics({
                    startDate: metricsStartDate,
                    endDate: metricsEndDate,
                    difficulty: metricsDifficulty
                  })
                }
                disabled={recommendationMetricsLoading}
              >
                적용
              </button>
            </div>
          </div>

          {recommendationMetricsError ? (
            <p className={styles.metricsInlineError}>{recommendationMetricsError}</p>
          ) : null}

          {recommendationMetrics ? (
            <>
              <div className={styles.metricsSummaryGrid}>
                <div className={styles.metricsSummaryCard}>
                  <span>총 노출</span>
                  <strong>{formatMetricCount(recommendationMetrics.totalShownCount)}</strong>
                </div>
                <div className={styles.metricsSummaryCard}>
                  <span>총 클릭</span>
                  <strong>{formatMetricCount(recommendationMetrics.totalClickedCount)}</strong>
                  <small>{formatMetricRate(recommendationMetrics.clickRate)}</small>
                </div>
                <div className={styles.metricsSummaryCard}>
                  <span>첫 제출 시작</span>
                  <strong>{formatMetricCount(recommendationMetrics.totalStartedCount)}</strong>
                  <small>{formatMetricRate(recommendationMetrics.startRate)}</small>
                </div>
                <div className={styles.metricsSummaryCard}>
                  <span>루프 완료</span>
                  <strong>{formatMetricCount(recommendationMetrics.totalCompletedCount)}</strong>
                  <small>{formatMetricRate(recommendationMetrics.completeRate)}</small>
                </div>
              </div>

              <p className={styles.metricsSectionDescription}>
                집계 기간 {recommendationMetrics.startDate} ~ {recommendationMetrics.endDate}
                {recommendationMetrics.difficultyFilter
                  ? ` · 난이도 ${getDifficultyDisplayLabel(recommendationMetrics.difficultyFilter)}`
                  : " · 전체 난이도"}
              </p>

              {recommendationMetrics.items.length > 0 ? (
                <div className={styles.metricsTableWrap}>
                  <table className={styles.metricsTable}>
                    <thead>
                      <tr>
                        <th>질문</th>
                        <th>추천 슬롯</th>
                        <th>추천 이유</th>
                        <th>노출</th>
                        <th>클릭</th>
                        <th>시작</th>
                        <th>완료</th>
                        <th>클릭률</th>
                        <th>시작률</th>
                        <th>완료율</th>
                        <th>시작 후 완료율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendationMetrics.items.map((item) => (
                        <tr key={`${item.promptId}-${item.slotType}-${item.reasonCode}`}>
                          <td>
                            <div className={styles.metricsQuestionCell}>
                              <strong>{item.questionEn}</strong>
                              <span>
                                {item.topicCategory}
                                {item.topicDetail ? ` · ${item.topicDetail}` : ""}
                                {item.difficulty ? ` · ${getDifficultyDisplayLabel(item.difficulty)}` : ""}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.metricsBadge}>
                              {getRecommendationSlotLabel(item.slotType)}
                            </span>
                          </td>
                          <td>
                            <span className={styles.metricsBadgeMuted}>
                              {getRecommendationReasonLabel(item.reasonCode)}
                            </span>
                          </td>
                          <td>{formatMetricCount(item.shownCount)}</td>
                          <td>{formatMetricCount(item.clickedCount)}</td>
                          <td>{formatMetricCount(item.startedCount)}</td>
                          <td>{formatMetricCount(item.completedCount)}</td>
                          <td>{formatMetricRate(item.clickRate)}</td>
                          <td>{formatMetricRate(item.startRate)}</td>
                          <td>{formatMetricRate(item.completeRate)}</td>
                          <td>{formatMetricRate(item.completionAfterStartRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.metricsEmptyState}>
                  <strong>집계된 추천 로그가 아직 없어요.</strong>
                  <span>선택한 기간이나 난이도 범위를 바꿔서 다시 확인해 보세요.</span>
                </div>
              )}
            </>
          ) : recommendationMetricsLoading ? (
            <div className={styles.metricsEmptyState}>
              <strong>추천 성과를 불러오고 있어요.</strong>
              <span>최근 추천 로그와 전환 데이터를 집계하는 중이에요.</span>
            </div>
          ) : null}
        </section>

        <section ref={createSectionRef} className={styles.createCard}>
          <div className={styles.createHeader}>
            <div className={styles.createHeaderCopy}>
              <p className={styles.sectionEyebrow}>새 질문 만들기</p>
              <h2>새로운 오늘의 질문 만들기</h2>
              <p>
                사용자에게 보여 줄 질문 문장, 번역, 힌트와 코치 프로필을 한 번에 정리할 수 있어요.
              </p>
            </div>
            <div className={styles.createHeaderSparkle} aria-hidden="true">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>카테고리</span>
              <select
                className={styles.input}
                value={newPromptForm.topicCategory}
                onChange={(event) =>
                  setNewPromptForm((current) =>
                    updateTopicSelection(topicCatalog, current, event.target.value)
                  )
                }
              >
                <option value="">선택해 주세요</option>
                {topicCatalog.map((entry) => (
                  <option key={entry.category} value={entry.category}>
                    {entry.category}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>세부 주제</span>
              <select
                className={styles.input}
                value={newPromptForm.topicDetail}
                disabled={!newPromptForm.topicCategory}
                onChange={(event) =>
                  setNewPromptForm((current) =>
                    updateTopicSelection(
                      topicCatalog,
                      current,
                      current.topicCategory,
                      event.target.value
                    )
                  )
                }
              >
                <option value="">선택해 주세요</option>
                {getPromptTopicDetails(topicCatalog, newPromptForm.topicCategory).map((detail) => (
                  <option key={detail} value={detail}>
                    {detail}
                  </option>
                ))}
              </select>
            </label>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <span>난이도</span>
              <div className={styles.difficultySelector}>
                {difficultyOptions.map((difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    className={
                      newPromptForm.difficulty === difficulty
                        ? `${styles.difficultyOption} ${styles.difficultyOptionActive}`
                        : styles.difficultyOption
                    }
                    onClick={() =>
                      setNewPromptForm((current) => ({
                        ...current,
                        difficulty
                      }))
                    }
                  >
                    {getDifficultyDisplayLabel(difficulty)}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.field}>
              <span>정렬 순서</span>
              <input
                className={styles.input}
                type="number"
                value={newPromptForm.displayOrder}
                onChange={(event) =>
                  setNewPromptForm((current) => ({
                    ...current,
                    displayOrder: Number(event.target.value)
                  }))
                }
              />
            </label>

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={newPromptForm.active}
                onChange={(event) =>
                  setNewPromptForm((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>바로 활성화</span>
            </label>

            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>영어 질문</span>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder="What topic should users write about today?"
                value={newPromptForm.questionEn}
                onChange={(event) =>
                  setNewPromptForm((current) => ({ ...current, questionEn: event.target.value }))
                }
              />
            </label>

            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>한국어 질문</span>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="사용자에게 보여 줄 한국어 질문을 입력해 주세요."
                value={newPromptForm.questionKo}
                onChange={(event) =>
                  setNewPromptForm((current) => ({ ...current, questionKo: event.target.value }))
                }
              />
            </label>

            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>TIP</span>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="질문 아래에 보여 줄 짧은 작문 팁을 적어 주세요."
                value={newPromptForm.tip}
                onChange={(event) =>
                  setNewPromptForm((current) => ({ ...current, tip: event.target.value }))
                }
              />
            </label>

            <div className={`${styles.fullWidth} ${styles.profilePanel}`}>
              <div className={styles.profileHeader}>
                <strong>코치 프로필</strong>
                <span>Starter, 표현 힌트, 추천 가이드 방향을 함께 저장합니다.</span>
              </div>
              <div className={styles.profileGrid}>
                <label className={styles.field}>
                  <span>Primary Category</span>
                  <input
                    className={styles.input}
                    value={
                      newPromptForm.coachProfile?.primaryCategory ?? emptyCoachProfile.primaryCategory
                    }
                    onChange={(event) =>
                      setNewPromptForm((current) => ({
                        ...current,
                        coachProfile: {
                          ...(current.coachProfile ?? emptyCoachProfile),
                          primaryCategory: event.target.value
                        }
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>Starter Style</span>
                  <input
                    className={styles.input}
                    value={newPromptForm.coachProfile?.starterStyle ?? emptyCoachProfile.starterStyle}
                    onChange={(event) =>
                      setNewPromptForm((current) => ({
                        ...current,
                        coachProfile: {
                          ...(current.coachProfile ?? emptyCoachProfile),
                          starterStyle: event.target.value
                        }
                      }))
                    }
                  />
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Secondary Categories</span>
                  <input
                    className={styles.input}
                    value={formatListInput(newPromptForm.coachProfile?.secondaryCategories)}
                    onChange={(event) =>
                      setNewPromptForm((current) => ({
                        ...current,
                        coachProfile: {
                          ...(current.coachProfile ?? emptyCoachProfile),
                          secondaryCategories: parseListInput(event.target.value)
                        }
                      }))
                    }
                  />
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Preferred Expression Families</span>
                  <input
                    className={styles.input}
                    value={formatListInput(
                      newPromptForm.coachProfile?.preferredExpressionFamilies
                    )}
                    onChange={(event) =>
                      setNewPromptForm((current) => ({
                        ...current,
                        coachProfile: {
                          ...(current.coachProfile ?? emptyCoachProfile),
                          preferredExpressionFamilies: parseListInput(event.target.value)
                        }
                      }))
                    }
                  />
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Avoid Families</span>
                  <input
                    className={styles.input}
                    value={formatListInput(newPromptForm.coachProfile?.avoidFamilies)}
                    onChange={(event) =>
                      setNewPromptForm((current) => ({
                        ...current,
                        coachProfile: {
                          ...(current.coachProfile ?? emptyCoachProfile),
                          avoidFamilies: parseListInput(event.target.value)
                        }
                      }))
                    }
                  />
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Notes</span>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={newPromptForm.coachProfile?.notes ?? ""}
                    onChange={(event) =>
                      setNewPromptForm((current) => ({
                        ...current,
                        coachProfile: {
                          ...(current.coachProfile ?? emptyCoachProfile),
                          notes: event.target.value
                        }
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={authStyles.ghostButton}
              onClick={resetNewPromptForm}
            >
              취소
            </button>
            <button
              type="button"
              className={authStyles.primaryButton}
              onClick={() => void handleCreatePrompt()}
            >
              새 질문 추가
            </button>
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHeaderBar}>
            <div className={styles.sectionHeaderCompact}>
              <p className={styles.sectionEyebrow}>질문 수정</p>
              <h2>질문 및 힌트 수정하기</h2>
            </div>
            <button type="button" className={styles.listSortButton}>
              최신순
              <span className="material-symbols-outlined">expand_more</span>
            </button>
          </div>

          <div className={styles.promptList}>
            {prompts.map((prompt) => {
              const form = promptForms[prompt.id] ?? toPromptForm(prompt);
              const isExpanded = expandedPromptIds[prompt.id] ?? false;

              return (
                <article key={prompt.id} className={styles.promptCard}>
                  <button
                    type="button"
                    className={styles.promptToggle}
                    onClick={() => togglePrompt(prompt.id)}
                  >
                    <span className={`${styles.promptLeadingIcon} material-symbols-outlined`}>
                      {getPromptCardIcon(prompt.topicCategory, prompt.topicDetail)}
                    </span>

                    <div className={styles.promptToggleMain}>
                      <div className={styles.promptMeta}>
                        <span>{prompt.topicCategory}</span>
                        <span>{prompt.topicDetail}</span>
                        <span>{getDifficultyDisplayLabel(prompt.difficulty)}</span>
                        <span>{prompt.active ? "활성" : "비활성"}</span>
                      </div>
                      <h3>{prompt.questionEn}</h3>
                    </div>

                    <span className={`${styles.promptChevron} material-symbols-outlined`}>
                      {isExpanded ? "expand_less" : "chevron_right"}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className={styles.promptEditor}>
                      <div className={styles.formGrid}>
                        <label className={styles.field}>
                          <span>카테고리</span>
                          <select
                            className={styles.input}
                            value={form.topicCategory}
                            onChange={(event) =>
                              updatePromptForm(prompt.id, (current) =>
                                updateTopicSelection(topicCatalog, current, event.target.value)
                              )
                            }
                          >
                            <option value="">선택해 주세요</option>
                            {topicCatalog.map((entry) => (
                              <option key={entry.category} value={entry.category}>
                                {entry.category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>세부 주제</span>
                          <select
                            className={styles.input}
                            value={form.topicDetail}
                            disabled={!form.topicCategory}
                            onChange={(event) =>
                              updatePromptForm(prompt.id, (current) =>
                                updateTopicSelection(
                                  topicCatalog,
                                  current,
                                  current.topicCategory,
                                  event.target.value
                                )
                              )
                            }
                          >
                            <option value="">선택해 주세요</option>
                            {getPromptTopicDetails(topicCatalog, form.topicCategory).map((detail) => (
                              <option key={detail} value={detail}>
                                {detail}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className={`${styles.field} ${styles.fullWidth}`}>
                          <span>난이도</span>
                          <div className={styles.difficultySelector}>
                            {difficultyOptions.map((difficulty) => (
                              <button
                                key={difficulty}
                                type="button"
                                className={
                                  form.difficulty === difficulty
                                    ? `${styles.difficultyOption} ${styles.difficultyOptionActive}`
                                    : styles.difficultyOption
                                }
                                onClick={() =>
                                  updatePromptForm(prompt.id, (current) => ({
                                    ...current,
                                    difficulty
                                  }))
                                }
                              >
                                {getDifficultyDisplayLabel(difficulty)}
                              </button>
                            ))}
                          </div>
                        </div>
                      <label className={styles.field}>
                        <span>정렬 순서</span>
                        <input
                          className={styles.input}
                          type="number"
                          value={form.displayOrder}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              displayOrder: Number(event.target.value)
                            }))
                          }
                        />
                      </label>
                      <label className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              active: event.target.checked
                            }))
                          }
                        />
                        <span>활성 상태</span>
                      </label>
                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>영어 질문</span>
                        <textarea
                          className={styles.textarea}
                          rows={3}
                          value={form.questionEn}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              questionEn: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>한국어 질문</span>
                        <textarea
                          className={styles.textarea}
                          rows={3}
                          value={form.questionKo}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              questionKo: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>TIP</span>
                        <textarea
                          className={styles.textarea}
                          rows={2}
                          value={form.tip}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              tip: event.target.value
                            }))
                          }
                        />
                      </label>
                      <div className={`${styles.fullWidth} ${styles.profilePanel}`}>
                        <div className={styles.profileHeader}>
                          <strong>코치 프로필</strong>
                          <span>질문 분류와 추천 표현 방향을 저장합니다.</span>
                        </div>
                        <div className={styles.profileGrid}>
                          <label className={styles.field}>
                            <span>Primary Category</span>
                            <input
                              className={styles.input}
                              value={form.coachProfile?.primaryCategory ?? emptyCoachProfile.primaryCategory}
                              onChange={(event) =>
                                updatePromptCoachProfile(prompt.id, (current) => ({
                                  ...current,
                                  primaryCategory: event.target.value
                                }))
                              }
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Starter Style</span>
                            <input
                              className={styles.input}
                              value={form.coachProfile?.starterStyle ?? emptyCoachProfile.starterStyle}
                              onChange={(event) =>
                                updatePromptCoachProfile(prompt.id, (current) => ({
                                  ...current,
                                  starterStyle: event.target.value
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.field} ${styles.fullWidth}`}>
                            <span>Secondary Categories</span>
                            <input
                              className={styles.input}
                              value={formatListInput(form.coachProfile?.secondaryCategories)}
                              onChange={(event) =>
                                updatePromptCoachProfile(prompt.id, (current) => ({
                                  ...current,
                                  secondaryCategories: parseListInput(event.target.value)
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.field} ${styles.fullWidth}`}>
                            <span>Preferred Expression Families</span>
                            <input
                              className={styles.input}
                              value={formatListInput(form.coachProfile?.preferredExpressionFamilies)}
                              onChange={(event) =>
                                updatePromptCoachProfile(prompt.id, (current) => ({
                                  ...current,
                                  preferredExpressionFamilies: parseListInput(event.target.value)
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.field} ${styles.fullWidth}`}>
                            <span>Avoid Families</span>
                            <input
                              className={styles.input}
                              value={formatListInput(form.coachProfile?.avoidFamilies)}
                              onChange={(event) =>
                                updatePromptCoachProfile(prompt.id, (current) => ({
                                  ...current,
                                  avoidFamilies: parseListInput(event.target.value)
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.field} ${styles.fullWidth}`}>
                            <span>Notes</span>
                            <textarea
                              className={styles.textarea}
                              rows={2}
                              value={form.coachProfile?.notes ?? ""}
                              onChange={(event) =>
                                updatePromptCoachProfile(prompt.id, (current) => ({
                                  ...current,
                                  notes: event.target.value
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={authStyles.primaryButton}
                        onClick={() => void handleSavePrompt(prompt.id)}
                      >
                        질문 저장
                      </button>
                      <button
                        type="button"
                        className={authStyles.ghostButton}
                        onClick={() => void handleDeletePrompt(prompt.id)}
                      >
                        비활성화
                      </button>
                    </div>

                    <div className={styles.hintSection}>
                      <div className={styles.hintHeader}>
                        <h4>힌트 관리</h4>
                        <span>{prompt.hints.length}개</span>
                      </div>

                      <div className={styles.hintList}>
                        {prompt.hints.map((hint) => {
                          const hintForm = hintForms[hint.id] ?? toHintForm(hint);

                          return (
                            <div key={hint.id} className={styles.hintCard}>
                              <div className={styles.hintTopRow}>
                                <strong>{hint.id}</strong>
                                <label className={styles.checkboxField}>
                                  <input
                                    type="checkbox"
                                    checked={hintForm.active}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        active: event.target.checked
                                      }))
                                    }
                                  />
                                  <span>활성</span>
                                </label>
                              </div>
                              <div className={styles.hintFormGrid}>
                                <label className={styles.field}>
                                  <span>타입</span>
                                  <select
                                    className={styles.input}
                                    value={hintForm.hintType}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        hintType: event.target.value
                                      }))
                                    }
                                  >
                                    {hintTypeOptions.map((hintType) => (
                                      <option key={hintType} value={hintType}>
                                        {hintType}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className={styles.field}>
                                  <span>Title</span>
                                  <input
                                    className={styles.input}
                                    value={hintForm.title ?? ""}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        title: event.target.value
                                      }))
                                    }
                                  />
                                </label>
                                <label className={styles.field}>
                                  <span>정렬 순서</span>
                                  <input
                                    className={styles.input}
                                    type="number"
                                    value={hintForm.displayOrder}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        displayOrder: Number(event.target.value)
                                      }))
                                    }
                                  />
                                </label>
                                <label className={`${styles.field} ${styles.fullWidth}`}>
                                  <span>내용</span>
                                  <textarea
                                    className={styles.textarea}
                                    rows={4}
                                    value={formatHintItemsInput(hintForm.items)}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        items: parseHintItemsInput(event.target.value)
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                              <div className={styles.actions}>
                                <button
                                  type="button"
                                  className={authStyles.primaryButton}
                                  onClick={() => void handleSaveHint(prompt.id, hint.id)}
                                >
                                  힌트 저장
                                </button>
                                <button
                                  type="button"
                                  className={authStyles.ghostButton}
                                  onClick={() => void handleDeleteHint(prompt.id, hint.id)}
                                >
                                  비활성화
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className={styles.newHintCard}>
                        <h5>새 힌트 추가</h5>
                        <div className={styles.hintFormGrid}>
                          <label className={styles.field}>
                            <span>타입</span>
                            <select
                              className={styles.input}
                              value={newHintForms[prompt.id]?.hintType ?? emptyHintForm.hintType}
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  hintType: event.target.value
                                }))
                              }
                            >
                              {hintTypeOptions.map((hintType) => (
                                <option key={hintType} value={hintType}>
                                  {hintType}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Title</span>
                            <input
                              className={styles.input}
                              value={newHintForms[prompt.id]?.title ?? ""}
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  title: event.target.value
                                }))
                              }
                            />
                          </label>
                          <label className={styles.field}>
                            <span>정렬 순서</span>
                            <input
                              className={styles.input}
                              type="number"
                              value={
                                newHintForms[prompt.id]?.displayOrder ?? emptyHintForm.displayOrder
                              }
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  displayOrder: Number(event.target.value)
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.field} ${styles.fullWidth}`}>
                            <span>내용</span>
                            <textarea
                              className={styles.textarea}
                              rows={4}
                              value={formatHintItemsInput(newHintForms[prompt.id]?.items)}
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  items: parseHintItemsInput(event.target.value)
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={authStyles.primaryButton}
                            onClick={() => void handleCreateHint(prompt.id)}
                          >
                            힌트 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          </div>
        </section>

        <button
          type="button"
          className={styles.createFab}
          onClick={() =>
            createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          aria-label="새 질문 만들기 영역으로 이동"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </main>
  );
}
