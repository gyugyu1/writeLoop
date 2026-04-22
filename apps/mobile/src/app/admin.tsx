import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import MobileScreenHeader from "@/components/mobile-screen-header";
import {
  createAdminPrompt,
  createAdminPromptHint,
  deleteAdminPrompt,
  deleteAdminPromptHint,
  getAdminPromptRecommendationMetrics,
  getAdminPromptTopicCatalog,
  getAdminPrompts,
  updateAdminPrompt,
  updateAdminPromptHint
} from "@/lib/api";
import { useSession } from "@/lib/session";
import type {
  AdminPrompt,
  AdminPromptHint,
  AdminPromptHintRequest,
  AdminPromptRecommendationMetrics,
  AdminPromptRequest,
  AdminPromptTopicCatalogEntry,
  DailyDifficulty,
  PromptCoachProfile,
  PromptDifficulty
} from "@/lib/types";

const PERIOD_OPTIONS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 }
] as const;

const DIFFICULTY_FILTER_OPTIONS: { label: string; value: DailyDifficulty | "" }[] = [
  { label: "전체", value: "" },
  { label: "입문", value: "I" },
  { label: "쉬움", value: "A" },
  { label: "보통", value: "B" },
  { label: "도전", value: "C" }
];

const PROMPT_DIFFICULTY_OPTIONS: PromptDifficulty[] = ["I", "A", "B", "C"];
const HINT_TYPE_OPTIONS = [
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

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRangeStartDate(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return formatDateInputValue(date);
}

function getRangeEndDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return formatDateInputValue(date);
}

function getDifficultyLabel(difficulty: PromptDifficulty | DailyDifficulty) {
  switch (difficulty) {
    case "I":
      return "입문";
    case "A":
      return "쉬움";
    case "B":
      return "보통";
    case "C":
      return "도전";
    default:
      return difficulty;
  }
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
      return "첫 문장 시작이 쉬워요";
    case "REUSE_SAVED_EXPRESSION":
      return "저장 표현을 다시 써볼 수 있어요";
    case "ONE_REASON_UP":
      return "이유를 한 단계 더 확장해요";
    case "TIME_MARKER_REUSE":
      return "시간 표현을 붙이기 좋아요";
    case "TOPIC_FRESH":
      return "최근에 덜 푼 주제예요";
    case "STREAK_KEEPER":
      return "부담 없이 연속 학습을 이어가요";
    case "HALF_STEP_GROWTH":
      return "반 걸음 성장용 질문이에요";
    case "ADD_EXAMPLE":
      return "예시를 붙이기 쉬워요";
    case "CATEGORY_BALANCE":
      return "주제 균형을 맞춰줘요";
    case "LOW_PRESSURE_VALID":
      return "가볍지만 답안은 충분히 만들 수 있어요";
    case "SAVEABLE_OUTPUT":
      return "저장할 표현이 나오기 쉬워요";
    case "TRANSFER_PRACTICE":
      return "다른 질문에도 옮겨 쓰기 좋아요";
    default:
      return reasonCode;
  }
}

function formatMetricRate(value: number) {
  return `${Math.round((value || 0) * 1000) / 10}%`;
}

function formatMetricCount(value: number) {
  return (value || 0).toLocaleString("ko-KR");
}

function parseHintItemsInput(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatHintItemsInput(values?: string[]) {
  return (values ?? []).join("\n");
}

function parseListInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatListInput(values?: string[]) {
  return (values ?? []).join(", ");
}

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

function getPromptTopicDetails(
  topicCatalog: AdminPromptTopicCatalogEntry[],
  topicCategory: string
) {
  return topicCatalog.find((entry) => entry.category === topicCategory)?.details ?? [];
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

function EmptyState({
  title,
  body,
  actionLabel,
  onPress
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onPress ? (
        <Pressable style={styles.emptyButton} onPress={onPress}>
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({
  label,
  children,
  helper
}: {
  label: string;
  children: ReactNode;
  helper?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

function SectionMessage({
  notice,
  error
}: {
  notice?: string;
  error?: string;
}) {
  if (!notice && !error) {
    return null;
  }

  return (
    <View style={styles.messageWrap}>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function AdminScreen() {
  const { currentUser, isHydrating } = useSession();

  const [selectedPeriodDays, setSelectedPeriodDays] = useState<
    (typeof PERIOD_OPTIONS)[number]["days"]
  >(14);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DailyDifficulty | "">("");

  const [topicCatalog, setTopicCatalog] = useState<AdminPromptTopicCatalogEntry[]>([]);
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [promptForms, setPromptForms] = useState<Record<string, AdminPromptRequest>>({});
  const [hintForms, setHintForms] = useState<Record<string, AdminPromptHintRequest>>({});
  const [newHintForms, setNewHintForms] = useState<Record<string, AdminPromptHintRequest>>({});
  const [newPromptForm, setNewPromptForm] = useState<AdminPromptRequest>({
    ...emptyPromptForm,
    coachProfile: { ...emptyCoachProfile }
  });

  const [metrics, setMetrics] = useState<AdminPromptRecommendationMetrics | null>(null);
  const [promptError, setPromptError] = useState("");
  const [metricsError, setMetricsError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const isActionPending = useCallback(
    (actionKey: string) => pendingActionKey === actionKey,
    [pendingActionKey]
  );

  const applyPromptState = useCallback((adminPrompts: AdminPrompt[]) => {
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
      Object.fromEntries(
        adminPrompts.map((prompt) => [prompt.id, { ...emptyHintForm } as AdminPromptHintRequest])
      )
    );
    setExpandedPromptIds((current) => {
      const next: Record<string, boolean> = {};
      for (const prompt of adminPrompts) {
        next[prompt.id] = current[prompt.id] ?? false;
      }
      return next;
    });
  }, []);

  const loadPromptManagement = useCallback(async () => {
    try {
      setIsLoadingPrompts(true);
      setPromptError("");
      const [nextPrompts, nextTopicCatalog] = await Promise.all([
        getAdminPrompts(),
        getAdminPromptTopicCatalog()
      ]);
      setTopicCatalog(nextTopicCatalog);
      applyPromptState(nextPrompts);
    } catch (caughtError) {
      setPromptError(
        caughtError instanceof Error ? caughtError.message : "관리자 질문 데이터를 불러오지 못했어요."
      );
    } finally {
      setIsLoadingPrompts(false);
    }
  }, [applyPromptState]);

  const loadMetrics = useCallback(
    async (days = selectedPeriodDays, difficulty = selectedDifficulty) => {
      try {
        setIsLoadingMetrics(true);
        setMetricsError("");
        const nextMetrics = await getAdminPromptRecommendationMetrics({
          startDate: getRangeStartDate(days),
          endDate: getRangeEndDate(),
          difficulty
        });
        setMetrics(nextMetrics);
      } catch (caughtError) {
        setMetricsError(
          caughtError instanceof Error ? caughtError.message : "추천 지표를 불러오지 못했어요."
        );
      } finally {
        setIsLoadingMetrics(false);
      }
    },
    [selectedDifficulty, selectedPeriodDays]
  );

  const refreshPrompts = useCallback(
    async (successMessage?: string) => {
      await loadPromptManagement();
      if (successMessage) {
        setNotice(successMessage);
      }
    },
    [loadPromptManagement]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadPromptManagement(), loadMetrics()]);
    setIsRefreshing(false);
  }, [loadMetrics, loadPromptManagement]);

  useEffect(() => {
    if (isHydrating || !currentUser?.admin) {
      return;
    }

    void loadPromptManagement();
  }, [currentUser?.admin, isHydrating, loadPromptManagement]);

  useEffect(() => {
    if (isHydrating || !currentUser?.admin) {
      return;
    }

    void loadMetrics();
  }, [currentUser?.admin, isHydrating, loadMetrics]);

  const activePromptCount = useMemo(
    () => prompts.filter((prompt) => prompt.active).length,
    [prompts]
  );
  const totalHintCount = useMemo(
    () => prompts.reduce((sum, prompt) => sum + prompt.hints.length, 0),
    [prompts]
  );
  const promptsByDifficulty = useMemo(
    () => ({
      I: prompts.filter((prompt) => prompt.difficulty === "I").length,
      A: prompts.filter((prompt) => prompt.difficulty === "A").length,
      B: prompts.filter((prompt) => prompt.difficulty === "B").length,
      C: prompts.filter((prompt) => prompt.difficulty === "C").length
    }),
    [prompts]
  );
  const sortedPrompts = useMemo(
    () =>
      [...prompts].sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1;
        }

        if (left.displayOrder !== right.displayOrder) {
          return left.displayOrder - right.displayOrder;
        }

        return left.questionEn.localeCompare(right.questionEn);
      }),
    [prompts]
  );

  function updatePromptForm(
    promptId: string,
    updater: (current: AdminPromptRequest) => AdminPromptRequest
  ) {
    setPromptForms((current) => ({
      ...current,
      [promptId]: updater(current[promptId] ?? { ...emptyPromptForm, coachProfile: { ...emptyCoachProfile } })
    }));
  }

  function updatePromptCoachProfile(
    promptId: string,
    updater: (current: PromptCoachProfile) => PromptCoachProfile
  ) {
    updatePromptForm(promptId, (current) => ({
      ...current,
      coachProfile: updater(current.coachProfile ?? { ...emptyCoachProfile })
    }));
  }

  function updateHintForm(
    hintId: string,
    updater: (current: AdminPromptHintRequest) => AdminPromptHintRequest
  ) {
    setHintForms((current) => ({
      ...current,
      [hintId]: updater(current[hintId] ?? { ...emptyHintForm })
    }));
  }

  function updateNewHintForm(
    promptId: string,
    updater: (current: AdminPromptHintRequest) => AdminPromptHintRequest
  ) {
    setNewHintForms((current) => ({
      ...current,
      [promptId]: updater(current[promptId] ?? { ...emptyHintForm })
    }));
  }

  function resetNewPromptForm() {
    setNewPromptForm({
      ...emptyPromptForm,
      coachProfile: { ...emptyCoachProfile }
    });
  }

  async function handleCreatePrompt() {
    try {
      setPendingActionKey("create-prompt");
      setPromptError("");
      setNotice("");
      await createAdminPrompt(newPromptForm);
      resetNewPromptForm();
      setIsCreatePromptOpen(false);
      await refreshPrompts("새 질문을 추가했어요.");
    } catch (caughtError) {
      setPromptError(
        caughtError instanceof Error ? caughtError.message : "질문을 추가하지 못했어요."
      );
    } finally {
      setPendingActionKey(null);
    }
  }

  async function handleSavePrompt(promptId: string) {
    try {
      setPendingActionKey(`save-prompt:${promptId}`);
      setPromptError("");
      setNotice("");
      await updateAdminPrompt(promptId, promptForms[promptId]);
      await refreshPrompts("질문을 저장했어요.");
    } catch (caughtError) {
      setPromptError(
        caughtError instanceof Error ? caughtError.message : "질문을 저장하지 못했어요."
      );
    } finally {
      setPendingActionKey(null);
    }
  }

  function handleDeactivatePrompt(promptId: string) {
    Alert.alert("질문 비활성화", "이 질문과 연결된 힌트를 비활성화할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "비활성화",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setPendingActionKey(`delete-prompt:${promptId}`);
              setPromptError("");
              setNotice("");
              await deleteAdminPrompt(promptId);
              await refreshPrompts("질문을 비활성화했어요.");
            } catch (caughtError) {
              setPromptError(
                caughtError instanceof Error
                  ? caughtError.message
                  : "질문을 비활성화하지 못했어요."
              );
            } finally {
              setPendingActionKey(null);
            }
          })();
        }
      }
    ]);
  }

  async function handleCreateHint(promptId: string) {
    try {
      setPendingActionKey(`create-hint:${promptId}`);
      setPromptError("");
      setNotice("");
      await createAdminPromptHint(promptId, newHintForms[promptId] ?? { ...emptyHintForm });
      await refreshPrompts("힌트를 추가했어요.");
      setExpandedPromptIds((current) => ({
        ...current,
        [promptId]: true
      }));
    } catch (caughtError) {
      setPromptError(
        caughtError instanceof Error ? caughtError.message : "힌트를 추가하지 못했어요."
      );
    } finally {
      setPendingActionKey(null);
    }
  }

  async function handleSaveHint(promptId: string, hintId: string) {
    try {
      setPendingActionKey(`save-hint:${hintId}`);
      setPromptError("");
      setNotice("");
      await updateAdminPromptHint(promptId, hintId, hintForms[hintId]);
      await refreshPrompts("힌트를 저장했어요.");
      setExpandedPromptIds((current) => ({
        ...current,
        [promptId]: true
      }));
    } catch (caughtError) {
      setPromptError(
        caughtError instanceof Error ? caughtError.message : "힌트를 저장하지 못했어요."
      );
    } finally {
      setPendingActionKey(null);
    }
  }

  function handleDeactivateHint(promptId: string, hintId: string) {
    Alert.alert("힌트 비활성화", "이 힌트를 비활성화할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "비활성화",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setPendingActionKey(`delete-hint:${hintId}`);
              setPromptError("");
              setNotice("");
              await deleteAdminPromptHint(promptId, hintId);
              await refreshPrompts("힌트를 비활성화했어요.");
              setExpandedPromptIds((current) => ({
                ...current,
                [promptId]: true
              }));
            } catch (caughtError) {
              setPromptError(
                caughtError instanceof Error
                  ? caughtError.message
                  : "힌트를 비활성화하지 못했어요."
              );
            } finally {
              setPendingActionKey(null);
            }
          })();
        }
      }
    ]);
  }

  const isInitialLoading =
    currentUser?.admin &&
    !prompts.length &&
    !metrics &&
    (isLoadingPrompts || isLoadingMetrics);

  if (isHydrating || isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <View style={styles.loadingState}>
            <ActivityIndicator color="#E38B12" />
          </View>
          <MobileNavBar activeTab="me" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            currentUser?.admin ? (
              <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
            ) : undefined
          }
        >
          <MobileScreenHeader
            title="관리자 도구"
            leftAccessory={
              <Pressable
                style={styles.headerBackButton}
                onPress={() => router.replace("/me")}
                accessibilityRole="button"
                accessibilityLabel="내정보로 돌아가기"
              >
                <Text style={styles.headerBackIcon}>{"<"}</Text>
              </Pressable>
            }
            rightAccessory={
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>ADMIN</Text>
              </View>
            }
          />

          {!currentUser ? (
            <EmptyState
              title="로그인이 필요해요"
              body="관리자 화면은 로그인한 뒤에만 들어올 수 있어요."
              actionLabel="로그인하러 가기"
              onPress={() => router.replace("/login")}
            />
          ) : !currentUser.admin ? (
            <EmptyState
              title="관리자 권한이 필요해요"
              body="이 계정은 모바일 관리자 화면에 접근할 수 없어요."
              actionLabel="마이페이지로 돌아가기"
              onPress={() => router.replace("/me")}
            />
          ) : (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>MOBILE ADMIN</Text>
                <Text style={styles.heroTitle}>조회만 하던 화면을 편집형 관리자 도구로 확장했어요.</Text>
                <Text style={styles.heroBody}>
                  휴대폰에서 추천 성과를 확인하고, 바로 질문과 힌트를 생성하거나 수정할 수 있어요.
                </Text>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>추천 지표</Text>
                    <Text style={styles.sectionTitle}>오늘의 질문 성과</Text>
                  </View>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void loadMetrics()}
                    disabled={isLoadingMetrics}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isLoadingMetrics ? "불러오는 중" : "새로고침"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.filterWrap}>
                  <View style={styles.chipRow}>
                    {PERIOD_OPTIONS.map((option) => {
                      const isActive = selectedPeriodDays === option.days;
                      return (
                        <Pressable
                          key={option.days}
                          style={[styles.filterChip, isActive && styles.filterChipActive]}
                          onPress={() => setSelectedPeriodDays(option.days)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive && styles.filterChipTextActive
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.chipRow}>
                    {DIFFICULTY_FILTER_OPTIONS.map((option) => {
                      const isActive = selectedDifficulty === option.value;
                      return (
                        <Pressable
                          key={option.label}
                          style={[styles.filterChip, isActive && styles.filterChipActive]}
                          onPress={() => setSelectedDifficulty(option.value)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive && styles.filterChipTextActive
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {metrics ? (
                  <Text style={styles.rangeText}>
                    조회 기간 {metrics.startDate} ~ {metrics.endDate}
                  </Text>
                ) : null}
                {metricsError ? <Text style={styles.errorText}>{metricsError}</Text> : null}

                {isLoadingMetrics && !metrics ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator color="#E38B12" />
                  </View>
                ) : metrics ? (
                  <>
                    <View style={styles.metricGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>노출</Text>
                        <Text style={styles.metricValue}>
                          {formatMetricCount(metrics.totalShownCount)}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>클릭</Text>
                        <Text style={styles.metricValue}>
                          {formatMetricCount(metrics.totalClickedCount)}
                        </Text>
                        <Text style={styles.metricRate}>{formatMetricRate(metrics.clickRate)}</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>시작</Text>
                        <Text style={styles.metricValue}>
                          {formatMetricCount(metrics.totalStartedCount)}
                        </Text>
                        <Text style={styles.metricRate}>{formatMetricRate(metrics.startRate)}</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>완료</Text>
                        <Text style={styles.metricValue}>
                          {formatMetricCount(metrics.totalCompletedCount)}
                        </Text>
                        <Text style={styles.metricRate}>
                          {formatMetricRate(metrics.completeRate)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metricList}>
                      {metrics.items.length ? (
                        metrics.items.map((item) => (
                          <View key={`${item.promptId}-${item.slotType}`} style={styles.metricItemCard}>
                            <View style={styles.metricItemTopRow}>
                              <View style={styles.metricItemBadgeRow}>
                                <View style={styles.slotBadge}>
                                  <Text style={styles.slotBadgeText}>
                                    {getRecommendationSlotLabel(item.slotType)}
                                  </Text>
                                </View>
                                <View style={styles.difficultyBadge}>
                                  <Text style={styles.difficultyBadgeText}>
                                    {getDifficultyLabel(item.difficulty)}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.metricItemReason}>
                                {getRecommendationReasonLabel(item.reasonCode)}
                              </Text>
                            </View>

                            <Text style={styles.metricItemTopic}>{item.topic}</Text>
                            <Text style={styles.metricItemQuestion}>{item.questionEn}</Text>

                            <View style={styles.metricRow}>
                              <Text style={styles.metricRowLabel}>노출 {formatMetricCount(item.shownCount)}</Text>
                              <Text style={styles.metricRowLabel}>클릭 {formatMetricCount(item.clickedCount)}</Text>
                              <Text style={styles.metricRowLabel}>시작 {formatMetricCount(item.startedCount)}</Text>
                              <Text style={styles.metricRowLabel}>완료 {formatMetricCount(item.completedCount)}</Text>
                            </View>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricRowSecondary}>
                                클릭률 {formatMetricRate(item.clickRate)}
                              </Text>
                              <Text style={styles.metricRowSecondary}>
                                시작률 {formatMetricRate(item.startRate)}
                              </Text>
                              <Text style={styles.metricRowSecondary}>
                                완료률 {formatMetricRate(item.completeRate)}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyInnerCard}>
                          <Text style={styles.emptyInnerText}>아직 집계된 추천 성과가 없어요.</Text>
                        </View>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyInnerCard}>
                    <Text style={styles.emptyInnerText}>추천 지표를 아직 불러오지 못했어요.</Text>
                  </View>
                )}
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>질문 편집</Text>
                    <Text style={styles.sectionTitle}>모바일 질문 관리자</Text>
                  </View>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setIsCreatePromptOpen((current) => !current)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isCreatePromptOpen ? "닫기" : "새 질문"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>전체 질문</Text>
                    <Text style={styles.metricValue}>{formatMetricCount(prompts.length)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>활성 질문</Text>
                    <Text style={styles.metricValue}>{formatMetricCount(activePromptCount)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>힌트 수</Text>
                    <Text style={styles.metricValue}>{formatMetricCount(totalHintCount)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>난이도 분포</Text>
                    <Text style={styles.metricRate}>
                      입문 {promptsByDifficulty.I} · A {promptsByDifficulty.A} · B {promptsByDifficulty.B} · C {promptsByDifficulty.C}
                    </Text>
                  </View>
                </View>

                <SectionMessage notice={notice} error={promptError} />

                {isCreatePromptOpen ? (
                  <View style={styles.editorCard}>
                    <Text style={styles.editorTitle}>새 질문 만들기</Text>

                    <Field label="주제 카테고리">
                      <TextInput
                        style={styles.input}
                        value={newPromptForm.topicCategory}
                        onChangeText={(value) =>
                          setNewPromptForm((current) => ({
                            ...current,
                            topicCategory: value
                          }))
                        }
                        placeholder="예: Routine"
                        placeholderTextColor="#AE9A87"
                      />
                      <View style={styles.chipRow}>
                        {topicCatalog.map((entry) => (
                          <Pressable
                            key={entry.category}
                            style={[
                              styles.optionChip,
                              newPromptForm.topicCategory === entry.category && styles.optionChipActive
                            ]}
                            onPress={() =>
                              setNewPromptForm((current) =>
                                updateTopicSelection(topicCatalog, current, entry.category)
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.optionChipText,
                                newPromptForm.topicCategory === entry.category &&
                                  styles.optionChipTextActive
                              ]}
                            >
                              {entry.category}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </Field>

                    <Field
                      label="세부 주제"
                      helper={
                        newPromptForm.topicCategory
                          ? "선택한 카테고리에 맞는 detail만 저장할 수 있어요."
                          : "먼저 카테고리를 고르면 detail 추천이 나와요."
                      }
                    >
                      <TextInput
                        style={styles.input}
                        value={newPromptForm.topicDetail}
                        onChangeText={(value) =>
                          setNewPromptForm((current) => ({
                            ...current,
                            topicDetail: value
                          }))
                        }
                        placeholder="예: Free Time at Home"
                        placeholderTextColor="#AE9A87"
                      />
                      <View style={styles.chipRow}>
                        {getPromptTopicDetails(topicCatalog, newPromptForm.topicCategory).map((detail) => (
                          <Pressable
                            key={detail}
                            style={[
                              styles.optionChip,
                              newPromptForm.topicDetail === detail && styles.optionChipActive
                            ]}
                            onPress={() =>
                              setNewPromptForm((current) => ({
                                ...current,
                                topicDetail: detail
                              }))
                            }
                          >
                            <Text
                              style={[
                                styles.optionChipText,
                                newPromptForm.topicDetail === detail && styles.optionChipTextActive
                              ]}
                            >
                              {detail}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </Field>

                    <Field label="난이도">
                      <View style={styles.chipRow}>
                        {PROMPT_DIFFICULTY_OPTIONS.map((difficulty) => {
                          const isActive = newPromptForm.difficulty === difficulty;
                          return (
                            <Pressable
                              key={difficulty}
                              style={[styles.optionChip, isActive && styles.optionChipActive]}
                              onPress={() =>
                                setNewPromptForm((current) => ({
                                  ...current,
                                  difficulty
                                }))
                              }
                            >
                              <Text
                                style={[
                                  styles.optionChipText,
                                  isActive && styles.optionChipTextActive
                                ]}
                              >
                                {getDifficultyLabel(difficulty)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Field>

                    <Field label="정렬 순서">
                      <TextInput
                        style={styles.input}
                        value={String(newPromptForm.displayOrder)}
                        onChangeText={(value) =>
                          setNewPromptForm((current) => ({
                            ...current,
                            displayOrder: Number(value.replace(/[^0-9-]/g, "")) || 0
                          }))
                        }
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#AE9A87"
                      />
                    </Field>

                    <Field label="영어 질문">
                      <TextInput
                        style={[styles.input, styles.textarea]}
                        value={newPromptForm.questionEn}
                        onChangeText={(value) =>
                          setNewPromptForm((current) => ({
                            ...current,
                            questionEn: value
                          }))
                        }
                        placeholder="영어 질문을 입력해 주세요."
                        placeholderTextColor="#AE9A87"
                        multiline
                        textAlignVertical="top"
                      />
                    </Field>

                    <Field label="한국어 질문">
                      <TextInput
                        style={[styles.input, styles.textarea]}
                        value={newPromptForm.questionKo}
                        onChangeText={(value) =>
                          setNewPromptForm((current) => ({
                            ...current,
                            questionKo: value
                          }))
                        }
                        placeholder="한국어 질문을 입력해 주세요."
                        placeholderTextColor="#AE9A87"
                        multiline
                        textAlignVertical="top"
                      />
                    </Field>

                    <Field label="TIP">
                      <TextInput
                        style={[styles.input, styles.textareaSmall]}
                        value={newPromptForm.tip}
                        onChangeText={(value) =>
                          setNewPromptForm((current) => ({
                            ...current,
                            tip: value
                          }))
                        }
                        placeholder="가이드에 보일 TIP을 입력해 주세요."
                        placeholderTextColor="#AE9A87"
                        multiline
                        textAlignVertical="top"
                      />
                    </Field>

                    <View style={styles.advancedPanel}>
                      <Text style={styles.advancedTitle}>코치 프로필</Text>

                      <Field label="Primary Category">
                        <TextInput
                          style={styles.input}
                          value={newPromptForm.coachProfile?.primaryCategory ?? ""}
                          onChangeText={(value) =>
                            setNewPromptForm((current) => ({
                              ...current,
                              coachProfile: {
                                ...(current.coachProfile ?? { ...emptyCoachProfile }),
                                primaryCategory: value
                              }
                            }))
                          }
                          placeholder="GENERAL"
                          placeholderTextColor="#AE9A87"
                        />
                      </Field>

                      <Field label="Starter Style">
                        <TextInput
                          style={styles.input}
                          value={newPromptForm.coachProfile?.starterStyle ?? ""}
                          onChangeText={(value) =>
                            setNewPromptForm((current) => ({
                              ...current,
                              coachProfile: {
                                ...(current.coachProfile ?? { ...emptyCoachProfile }),
                                starterStyle: value
                              }
                            }))
                          }
                          placeholder="DIRECT"
                          placeholderTextColor="#AE9A87"
                        />
                      </Field>

                      <Field label="Secondary Categories">
                        <TextInput
                          style={styles.input}
                          value={formatListInput(newPromptForm.coachProfile?.secondaryCategories)}
                          onChangeText={(value) =>
                            setNewPromptForm((current) => ({
                              ...current,
                              coachProfile: {
                                ...(current.coachProfile ?? { ...emptyCoachProfile }),
                                secondaryCategories: parseListInput(value)
                              }
                            }))
                          }
                          placeholder="comma separated"
                          placeholderTextColor="#AE9A87"
                        />
                      </Field>

                      <Field label="Preferred Expression Families">
                        <TextInput
                          style={styles.input}
                          value={formatListInput(
                            newPromptForm.coachProfile?.preferredExpressionFamilies
                          )}
                          onChangeText={(value) =>
                            setNewPromptForm((current) => ({
                              ...current,
                              coachProfile: {
                                ...(current.coachProfile ?? { ...emptyCoachProfile }),
                                preferredExpressionFamilies: parseListInput(value)
                              }
                            }))
                          }
                          placeholder="comma separated"
                          placeholderTextColor="#AE9A87"
                        />
                      </Field>

                      <Field label="Avoid Families">
                        <TextInput
                          style={styles.input}
                          value={formatListInput(newPromptForm.coachProfile?.avoidFamilies)}
                          onChangeText={(value) =>
                            setNewPromptForm((current) => ({
                              ...current,
                              coachProfile: {
                                ...(current.coachProfile ?? { ...emptyCoachProfile }),
                                avoidFamilies: parseListInput(value)
                              }
                            }))
                          }
                          placeholder="comma separated"
                          placeholderTextColor="#AE9A87"
                        />
                      </Field>

                      <Field label="Notes">
                        <TextInput
                          style={[styles.input, styles.textareaSmall]}
                          value={newPromptForm.coachProfile?.notes ?? ""}
                          onChangeText={(value) =>
                            setNewPromptForm((current) => ({
                              ...current,
                              coachProfile: {
                                ...(current.coachProfile ?? { ...emptyCoachProfile }),
                                notes: value
                              }
                            }))
                          }
                          placeholder="코치 프로필 메모"
                          placeholderTextColor="#AE9A87"
                          multiline
                          textAlignVertical="top"
                        />
                      </Field>
                    </View>

                    <View style={styles.editorActions}>
                      <Pressable
                        style={[
                          styles.primaryButton,
                          isActionPending("create-prompt") && styles.disabledButton
                        ]}
                        onPress={() => void handleCreatePrompt()}
                        disabled={isActionPending("create-prompt")}
                      >
                        {isActionPending("create-prompt") ? (
                          <ActivityIndicator color="#232128" />
                        ) : (
                          <Text style={styles.primaryButtonText}>질문 추가</Text>
                        )}
                      </Pressable>

                      <Pressable
                        style={styles.ghostButton}
                        onPress={() => {
                          resetNewPromptForm();
                          setIsCreatePromptOpen(false);
                        }}
                      >
                        <Text style={styles.ghostButtonText}>취소</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {isLoadingPrompts && !prompts.length ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator color="#E38B12" />
                  </View>
                ) : (
                  <View style={styles.promptList}>
                    {sortedPrompts.length ? (
                      sortedPrompts.map((prompt) => {
                        const isExpanded = expandedPromptIds[prompt.id] ?? false;
                        const promptForm = promptForms[prompt.id] ?? toPromptForm(prompt);
                        const availableDetails = getPromptTopicDetails(
                          topicCatalog,
                          promptForm.topicCategory
                        );

                        return (
                          <View key={prompt.id} style={styles.promptCard}>
                            <Pressable
                              style={styles.promptCardHeader}
                              onPress={() =>
                                setExpandedPromptIds((current) => ({
                                  ...current,
                                  [prompt.id]: !current[prompt.id]
                                }))
                              }
                            >
                              <View style={styles.promptCardTopRow}>
                                <View style={styles.promptBadgeRow}>
                                  <View
                                    style={[
                                      styles.promptStateBadge,
                                      prompt.active
                                        ? styles.promptStateBadgeActive
                                        : styles.promptStateBadgeInactive
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.promptStateBadgeText,
                                        prompt.active
                                          ? styles.promptStateBadgeTextActive
                                          : styles.promptStateBadgeTextInactive
                                      ]}
                                    >
                                      {prompt.active ? "활성" : "비활성"}
                                    </Text>
                                  </View>
                                  <View style={styles.difficultyBadge}>
                                    <Text style={styles.difficultyBadgeText}>
                                      {getDifficultyLabel(prompt.difficulty)}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.promptExpandText}>
                                  {isExpanded ? "접기" : "펼치기"}
                                </Text>
                              </View>

                              <Text style={styles.promptTopic}>{prompt.topic}</Text>
                              <Text style={styles.promptQuestion}>{prompt.questionEn}</Text>
                              <Text style={styles.promptMeta}>
                                {prompt.topicCategory} · {prompt.topicDetail} · 힌트 {prompt.hints.length}개 · 정렬{" "}
                                {prompt.displayOrder}
                              </Text>
                            </Pressable>

                            {isExpanded ? (
                              <View style={styles.promptEditorBody}>
                                <Field label="주제 카테고리">
                                  <TextInput
                                    style={styles.input}
                                    value={promptForm.topicCategory}
                                    onChangeText={(value) =>
                                      updatePromptForm(prompt.id, (current) => ({
                                        ...current,
                                        topicCategory: value
                                      }))
                                    }
                                    placeholder="예: Routine"
                                    placeholderTextColor="#AE9A87"
                                  />
                                  <View style={styles.chipRow}>
                                    {topicCatalog.map((entry) => (
                                      <Pressable
                                        key={entry.category}
                                        style={[
                                          styles.optionChip,
                                          promptForm.topicCategory === entry.category &&
                                            styles.optionChipActive
                                        ]}
                                        onPress={() =>
                                          updatePromptForm(prompt.id, (current) =>
                                            updateTopicSelection(topicCatalog, current, entry.category)
                                          )
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.optionChipText,
                                            promptForm.topicCategory === entry.category &&
                                              styles.optionChipTextActive
                                          ]}
                                        >
                                          {entry.category}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                </Field>

                                <Field label="세부 주제">
                                  <TextInput
                                    style={styles.input}
                                    value={promptForm.topicDetail}
                                    onChangeText={(value) =>
                                      updatePromptForm(prompt.id, (current) => ({
                                        ...current,
                                        topicDetail: value
                                      }))
                                    }
                                    placeholder="예: Free Time at Home"
                                    placeholderTextColor="#AE9A87"
                                  />
                                  <View style={styles.chipRow}>
                                    {availableDetails.map((detail) => (
                                      <Pressable
                                        key={detail}
                                        style={[
                                          styles.optionChip,
                                          promptForm.topicDetail === detail && styles.optionChipActive
                                        ]}
                                        onPress={() =>
                                          updatePromptForm(prompt.id, (current) => ({
                                            ...current,
                                            topicDetail: detail
                                          }))
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.optionChipText,
                                            promptForm.topicDetail === detail && styles.optionChipTextActive
                                          ]}
                                        >
                                          {detail}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                </Field>

                                <Field label="난이도">
                                  <View style={styles.chipRow}>
                                    {PROMPT_DIFFICULTY_OPTIONS.map((difficulty) => {
                                      const isActive = promptForm.difficulty === difficulty;
                                      return (
                                        <Pressable
                                          key={difficulty}
                                          style={[
                                            styles.optionChip,
                                            isActive && styles.optionChipActive
                                          ]}
                                          onPress={() =>
                                            updatePromptForm(prompt.id, (current) => ({
                                              ...current,
                                              difficulty
                                            }))
                                          }
                                        >
                                          <Text
                                            style={[
                                              styles.optionChipText,
                                              isActive && styles.optionChipTextActive
                                            ]}
                                          >
                                            {getDifficultyLabel(difficulty)}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </Field>

                                <Field label="정렬 순서">
                                  <TextInput
                                    style={styles.input}
                                    value={String(promptForm.displayOrder)}
                                    onChangeText={(value) =>
                                      updatePromptForm(prompt.id, (current) => ({
                                        ...current,
                                        displayOrder: Number(value.replace(/[^0-9-]/g, "")) || 0
                                      }))
                                    }
                                    keyboardType="number-pad"
                                    placeholder="0"
                                    placeholderTextColor="#AE9A87"
                                  />
                                </Field>

                                <Field label="영어 질문">
                                  <TextInput
                                    style={[styles.input, styles.textarea]}
                                    value={promptForm.questionEn}
                                    onChangeText={(value) =>
                                      updatePromptForm(prompt.id, (current) => ({
                                        ...current,
                                        questionEn: value
                                      }))
                                    }
                                    placeholder="영어 질문을 입력해 주세요."
                                    placeholderTextColor="#AE9A87"
                                    multiline
                                    textAlignVertical="top"
                                  />
                                </Field>

                                <Field label="한국어 질문">
                                  <TextInput
                                    style={[styles.input, styles.textarea]}
                                    value={promptForm.questionKo}
                                    onChangeText={(value) =>
                                      updatePromptForm(prompt.id, (current) => ({
                                        ...current,
                                        questionKo: value
                                      }))
                                    }
                                    placeholder="한국어 질문을 입력해 주세요."
                                    placeholderTextColor="#AE9A87"
                                    multiline
                                    textAlignVertical="top"
                                  />
                                </Field>

                                <Field label="TIP">
                                  <TextInput
                                    style={[styles.input, styles.textareaSmall]}
                                    value={promptForm.tip}
                                    onChangeText={(value) =>
                                      updatePromptForm(prompt.id, (current) => ({
                                        ...current,
                                        tip: value
                                      }))
                                    }
                                    placeholder="가이드에 보일 TIP을 입력해 주세요."
                                    placeholderTextColor="#AE9A87"
                                    multiline
                                    textAlignVertical="top"
                                  />
                                </Field>

                                <View style={styles.chipSplitRow}>
                                  <Text style={styles.fieldLabel}>활성 상태</Text>
                                  <View style={styles.chipRow}>
                                    <Pressable
                                      style={[
                                        styles.optionChip,
                                        promptForm.active && styles.optionChipActive
                                      ]}
                                      onPress={() =>
                                        updatePromptForm(prompt.id, (current) => ({
                                          ...current,
                                          active: true
                                        }))
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.optionChipText,
                                          promptForm.active && styles.optionChipTextActive
                                        ]}
                                      >
                                        활성
                                      </Text>
                                    </Pressable>
                                    <Pressable
                                      style={[
                                        styles.optionChip,
                                        !promptForm.active && styles.optionChipActive
                                      ]}
                                      onPress={() =>
                                        updatePromptForm(prompt.id, (current) => ({
                                          ...current,
                                          active: false
                                        }))
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.optionChipText,
                                          !promptForm.active && styles.optionChipTextActive
                                        ]}
                                      >
                                        비활성
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>

                                <View style={styles.advancedPanel}>
                                  <Text style={styles.advancedTitle}>코치 프로필</Text>

                                  <Field label="Primary Category">
                                    <TextInput
                                      style={styles.input}
                                      value={promptForm.coachProfile?.primaryCategory ?? ""}
                                      onChangeText={(value) =>
                                        updatePromptCoachProfile(prompt.id, (current) => ({
                                          ...current,
                                          primaryCategory: value
                                        }))
                                      }
                                      placeholder="GENERAL"
                                      placeholderTextColor="#AE9A87"
                                    />
                                  </Field>

                                  <Field label="Starter Style">
                                    <TextInput
                                      style={styles.input}
                                      value={promptForm.coachProfile?.starterStyle ?? ""}
                                      onChangeText={(value) =>
                                        updatePromptCoachProfile(prompt.id, (current) => ({
                                          ...current,
                                          starterStyle: value
                                        }))
                                      }
                                      placeholder="DIRECT"
                                      placeholderTextColor="#AE9A87"
                                    />
                                  </Field>

                                  <Field label="Secondary Categories">
                                    <TextInput
                                      style={styles.input}
                                      value={formatListInput(promptForm.coachProfile?.secondaryCategories)}
                                      onChangeText={(value) =>
                                        updatePromptCoachProfile(prompt.id, (current) => ({
                                          ...current,
                                          secondaryCategories: parseListInput(value)
                                        }))
                                      }
                                      placeholder="comma separated"
                                      placeholderTextColor="#AE9A87"
                                    />
                                  </Field>

                                  <Field label="Preferred Expression Families">
                                    <TextInput
                                      style={styles.input}
                                      value={formatListInput(
                                        promptForm.coachProfile?.preferredExpressionFamilies
                                      )}
                                      onChangeText={(value) =>
                                        updatePromptCoachProfile(prompt.id, (current) => ({
                                          ...current,
                                          preferredExpressionFamilies: parseListInput(value)
                                        }))
                                      }
                                      placeholder="comma separated"
                                      placeholderTextColor="#AE9A87"
                                    />
                                  </Field>

                                  <Field label="Avoid Families">
                                    <TextInput
                                      style={styles.input}
                                      value={formatListInput(promptForm.coachProfile?.avoidFamilies)}
                                      onChangeText={(value) =>
                                        updatePromptCoachProfile(prompt.id, (current) => ({
                                          ...current,
                                          avoidFamilies: parseListInput(value)
                                        }))
                                      }
                                      placeholder="comma separated"
                                      placeholderTextColor="#AE9A87"
                                    />
                                  </Field>

                                  <Field label="Notes">
                                    <TextInput
                                      style={[styles.input, styles.textareaSmall]}
                                      value={promptForm.coachProfile?.notes ?? ""}
                                      onChangeText={(value) =>
                                        updatePromptCoachProfile(prompt.id, (current) => ({
                                          ...current,
                                          notes: value
                                        }))
                                      }
                                      placeholder="코치 프로필 메모"
                                      placeholderTextColor="#AE9A87"
                                      multiline
                                      textAlignVertical="top"
                                    />
                                  </Field>
                                </View>

                                <View style={styles.editorActions}>
                                  <Pressable
                                    style={[
                                      styles.primaryButton,
                                      isActionPending(`save-prompt:${prompt.id}`) && styles.disabledButton
                                    ]}
                                    onPress={() => void handleSavePrompt(prompt.id)}
                                    disabled={isActionPending(`save-prompt:${prompt.id}`)}
                                  >
                                    {isActionPending(`save-prompt:${prompt.id}`) ? (
                                      <ActivityIndicator color="#232128" />
                                    ) : (
                                      <Text style={styles.primaryButtonText}>질문 저장</Text>
                                    )}
                                  </Pressable>

                                  <Pressable
                                    style={[
                                      styles.ghostButton,
                                      isActionPending(`delete-prompt:${prompt.id}`) && styles.disabledButton
                                    ]}
                                    onPress={() => handleDeactivatePrompt(prompt.id)}
                                    disabled={isActionPending(`delete-prompt:${prompt.id}`)}
                                  >
                                    <Text style={styles.ghostButtonText}>비활성화</Text>
                                  </Pressable>
                                </View>

                                <View style={styles.hintSection}>
                                  <Text style={styles.hintSectionTitle}>힌트 관리</Text>

                                  {prompt.hints.length ? (
                                    prompt.hints.map((hint) => {
                                      const hintForm = hintForms[hint.id] ?? toHintForm(hint);

                                      return (
                                        <View key={hint.id} style={styles.hintCard}>
                                          <Text style={styles.hintCardTitle}>{hint.id}</Text>

                                          <Field label="힌트 타입">
                                            <View style={styles.chipRow}>
                                              {HINT_TYPE_OPTIONS.map((hintType) => {
                                                const isActive = hintForm.hintType === hintType;
                                                return (
                                                  <Pressable
                                                    key={hintType}
                                                    style={[
                                                      styles.optionChip,
                                                      isActive && styles.optionChipActive
                                                    ]}
                                                    onPress={() =>
                                                      updateHintForm(hint.id, (current) => ({
                                                        ...current,
                                                        hintType
                                                      }))
                                                    }
                                                  >
                                                    <Text
                                                      style={[
                                                        styles.optionChipText,
                                                        isActive && styles.optionChipTextActive
                                                      ]}
                                                    >
                                                      {hintType}
                                                    </Text>
                                                  </Pressable>
                                                );
                                              })}
                                            </View>
                                          </Field>

                                          <Field label="제목">
                                            <TextInput
                                              style={styles.input}
                                              value={hintForm.title ?? ""}
                                              onChangeText={(value) =>
                                                updateHintForm(hint.id, (current) => ({
                                                  ...current,
                                                  title: value
                                                }))
                                              }
                                              placeholder="비워두면 자동 제목이 들어가요."
                                              placeholderTextColor="#AE9A87"
                                            />
                                          </Field>

                                          <Field label="정렬 순서">
                                            <TextInput
                                              style={styles.input}
                                              value={String(hintForm.displayOrder)}
                                              onChangeText={(value) =>
                                                updateHintForm(hint.id, (current) => ({
                                                  ...current,
                                                  displayOrder:
                                                    Number(value.replace(/[^0-9-]/g, "")) || 0
                                                }))
                                              }
                                              keyboardType="number-pad"
                                              placeholder="0"
                                              placeholderTextColor="#AE9A87"
                                            />
                                          </Field>

                                          <Field label="활성 상태">
                                            <View style={styles.chipRow}>
                                              <Pressable
                                                style={[
                                                  styles.optionChip,
                                                  hintForm.active && styles.optionChipActive
                                                ]}
                                                onPress={() =>
                                                  updateHintForm(hint.id, (current) => ({
                                                    ...current,
                                                    active: true
                                                  }))
                                                }
                                              >
                                                <Text
                                                  style={[
                                                    styles.optionChipText,
                                                    hintForm.active && styles.optionChipTextActive
                                                  ]}
                                                >
                                                  활성
                                                </Text>
                                              </Pressable>
                                              <Pressable
                                                style={[
                                                  styles.optionChip,
                                                  !hintForm.active && styles.optionChipActive
                                                ]}
                                                onPress={() =>
                                                  updateHintForm(hint.id, (current) => ({
                                                    ...current,
                                                    active: false
                                                  }))
                                                }
                                              >
                                                <Text
                                                  style={[
                                                    styles.optionChipText,
                                                    !hintForm.active && styles.optionChipTextActive
                                                  ]}
                                                >
                                                  비활성
                                                </Text>
                                              </Pressable>
                                            </View>
                                          </Field>

                                          <Field label="힌트 내용" helper="한 줄에 하나씩 입력해 주세요.">
                                            <TextInput
                                              style={[styles.input, styles.textareaTall]}
                                              value={formatHintItemsInput(hintForm.items)}
                                              onChangeText={(value) =>
                                                updateHintForm(hint.id, (current) => ({
                                                  ...current,
                                                  items: parseHintItemsInput(value)
                                                }))
                                              }
                                              placeholder={"첫 번째 힌트\n두 번째 힌트"}
                                              placeholderTextColor="#AE9A87"
                                              multiline
                                              textAlignVertical="top"
                                            />
                                          </Field>

                                          <View style={styles.editorActions}>
                                            <Pressable
                                              style={[
                                                styles.primaryButton,
                                                isActionPending(`save-hint:${hint.id}`) &&
                                                  styles.disabledButton
                                              ]}
                                              onPress={() => void handleSaveHint(prompt.id, hint.id)}
                                              disabled={isActionPending(`save-hint:${hint.id}`)}
                                            >
                                              {isActionPending(`save-hint:${hint.id}`) ? (
                                                <ActivityIndicator color="#232128" />
                                              ) : (
                                                <Text style={styles.primaryButtonText}>힌트 저장</Text>
                                              )}
                                            </Pressable>

                                            <Pressable
                                              style={[
                                                styles.ghostButton,
                                                isActionPending(`delete-hint:${hint.id}`) &&
                                                  styles.disabledButton
                                              ]}
                                              onPress={() => handleDeactivateHint(prompt.id, hint.id)}
                                              disabled={isActionPending(`delete-hint:${hint.id}`)}
                                            >
                                              <Text style={styles.ghostButtonText}>비활성화</Text>
                                            </Pressable>
                                          </View>
                                        </View>
                                      );
                                    })
                                  ) : (
                                    <View style={styles.emptyInnerCard}>
                                      <Text style={styles.emptyInnerText}>아직 등록된 힌트가 없어요.</Text>
                                    </View>
                                  )}

                                  <View style={styles.newHintCard}>
                                    <Text style={styles.newHintTitle}>새 힌트 추가</Text>

                                    <Field label="힌트 타입">
                                      <View style={styles.chipRow}>
                                        {HINT_TYPE_OPTIONS.map((hintType) => {
                                          const isActive =
                                            (newHintForms[prompt.id] ?? emptyHintForm).hintType === hintType;
                                          return (
                                            <Pressable
                                              key={hintType}
                                              style={[
                                                styles.optionChip,
                                                isActive && styles.optionChipActive
                                              ]}
                                              onPress={() =>
                                                updateNewHintForm(prompt.id, (current) => ({
                                                  ...current,
                                                  hintType
                                                }))
                                              }
                                            >
                                              <Text
                                                style={[
                                                  styles.optionChipText,
                                                  isActive && styles.optionChipTextActive
                                                ]}
                                              >
                                                {hintType}
                                              </Text>
                                            </Pressable>
                                          );
                                        })}
                                      </View>
                                    </Field>

                                    <Field label="제목">
                                      <TextInput
                                        style={styles.input}
                                        value={(newHintForms[prompt.id] ?? emptyHintForm).title ?? ""}
                                        onChangeText={(value) =>
                                          updateNewHintForm(prompt.id, (current) => ({
                                            ...current,
                                            title: value
                                          }))
                                        }
                                        placeholder="비워두면 자동 제목이 들어가요."
                                        placeholderTextColor="#AE9A87"
                                      />
                                    </Field>

                                    <Field label="정렬 순서">
                                      <TextInput
                                        style={styles.input}
                                        value={String(
                                          (newHintForms[prompt.id] ?? emptyHintForm).displayOrder
                                        )}
                                        onChangeText={(value) =>
                                          updateNewHintForm(prompt.id, (current) => ({
                                            ...current,
                                            displayOrder: Number(value.replace(/[^0-9-]/g, "")) || 0
                                          }))
                                        }
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor="#AE9A87"
                                      />
                                    </Field>

                                    <Field label="힌트 내용" helper="한 줄에 하나씩 입력해 주세요.">
                                      <TextInput
                                        style={[styles.input, styles.textareaTall]}
                                        value={formatHintItemsInput(
                                          (newHintForms[prompt.id] ?? emptyHintForm).items
                                        )}
                                        onChangeText={(value) =>
                                          updateNewHintForm(prompt.id, (current) => ({
                                            ...current,
                                            items: parseHintItemsInput(value)
                                          }))
                                        }
                                        placeholder={"첫 번째 힌트\n두 번째 힌트"}
                                        placeholderTextColor="#AE9A87"
                                        multiline
                                        textAlignVertical="top"
                                      />
                                    </Field>

                                    <View style={styles.editorActions}>
                                      <Pressable
                                        style={[
                                          styles.primaryButton,
                                          isActionPending(`create-hint:${prompt.id}`) &&
                                            styles.disabledButton
                                        ]}
                                        onPress={() => void handleCreateHint(prompt.id)}
                                        disabled={isActionPending(`create-hint:${prompt.id}`)}
                                      >
                                        {isActionPending(`create-hint:${prompt.id}`) ? (
                                          <ActivityIndicator color="#232128" />
                                        ) : (
                                          <Text style={styles.primaryButtonText}>힌트 추가</Text>
                                        )}
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.emptyInnerCard}>
                        <Text style={styles.emptyInnerText}>관리할 질문이 아직 없어요.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <MobileNavBar activeTab="me" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  screen: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 28,
    gap: 18
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBackButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBackIcon: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700",
    color: "#4A4033"
  },
  headerBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFF4E3",
    borderWidth: 1,
    borderColor: "#E7D0B2"
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#A76A18",
    letterSpacing: 0.8
  },
  heroCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 10
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#B27323"
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    color: "#232128"
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6C5C4B"
  },
  sectionCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#B27323"
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF7EC",
    borderWidth: 1,
    borderColor: "#E4D6C5"
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  filterWrap: {
    gap: 10
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chipSplitRow: {
    gap: 8
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF8F1"
  },
  filterChipActive: {
    backgroundColor: "#F5A33B",
    borderColor: "#F5A33B"
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  filterChipTextActive: {
    color: "#232128"
  },
  optionChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E4D6C5",
    backgroundColor: "#FFF8F1"
  },
  optionChipActive: {
    backgroundColor: "#FFE2B1",
    borderColor: "#F0B86A"
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7A6244"
  },
  optionChipTextActive: {
    color: "#5A3C15"
  },
  rangeText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8B7865"
  },
  messageWrap: {
    gap: 6
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#7B682F"
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B34A2B"
  },
  inlineLoading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCard: {
    width: "47%",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FBF5EE",
    borderWidth: 1,
    borderColor: "#E8DACC",
    gap: 6
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7B684F"
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: "#232128"
  },
  metricRate: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8C6A34"
  },
  metricList: {
    gap: 12
  },
  metricItemCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 10
  },
  metricItemTopRow: {
    gap: 10
  },
  metricItemBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  slotBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFE7C2"
  },
  slotBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8C5C16"
  },
  difficultyBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3ECE2"
  },
  difficultyBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#6C5B49"
  },
  metricItemReason: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8C6A34"
  },
  metricItemTopic: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  metricItemQuestion: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    color: "#232128"
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricRowLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: "#5F5142"
  },
  metricRowSecondary: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8B7865"
  },
  editorCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  editorTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#232128"
  },
  fieldGroup: {
    gap: 8
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3D3226"
  },
  fieldHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8B7865"
  },
  input: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E6D7C5",
    fontSize: 16,
    color: "#2A2520"
  },
  textarea: {
    minHeight: 108
  },
  textareaSmall: {
    minHeight: 86
  },
  textareaTall: {
    minHeight: 132
  },
  advancedPanel: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FBF5EE",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A6431"
  },
  editorActions: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 15,
    backgroundColor: "#F5A33B"
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#232128"
  },
  ghostButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 15,
    backgroundColor: "#FFF8F1",
    borderWidth: 1,
    borderColor: "#E3D3BF"
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7A6244"
  },
  disabledButton: {
    opacity: 0.72
  },
  promptList: {
    gap: 12
  },
  promptCard: {
    borderRadius: 24,
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#E8DACB",
    overflow: "hidden"
  },
  promptCardHeader: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10
  },
  promptCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  promptBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  promptStateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  promptStateBadgeActive: {
    backgroundColor: "#EAF7EC"
  },
  promptStateBadgeInactive: {
    backgroundColor: "#F4ECE7"
  },
  promptStateBadgeText: {
    fontSize: 12,
    fontWeight: "900"
  },
  promptStateBadgeTextActive: {
    color: "#2E7D47"
  },
  promptStateBadgeTextInactive: {
    color: "#8A7464"
  },
  promptExpandText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8B7865"
  },
  promptTopic: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  promptQuestion: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  promptMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8B7865"
  },
  promptEditorBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0E4D8"
  },
  hintSection: {
    gap: 12
  },
  hintSectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#232128"
  },
  hintCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FBF5EE",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  hintCardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A6431"
  },
  newHintCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFF8F1",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  newHintTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#232128"
  },
  emptyCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 24,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6C5C4B"
  },
  emptyButton: {
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#F5A33B"
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#232128"
  },
  emptyInnerCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#FBF5EE",
    borderWidth: 1,
    borderColor: "#E8DACC"
  },
  emptyInnerText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#7A6244"
  }
});
