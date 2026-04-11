import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import { PracticeFeedbackContent } from "@/components/practice-feedback-content";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import { getAnswerHistory, getTodayWritingStatus } from "@/lib/api";
import { getDifficultyLabel } from "@/lib/difficulty";
import { buildLoginHref } from "@/lib/login-redirect";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { Feedback, HistoryAttempt, HistorySession, Prompt, TodayWritingStatus } from "@/lib/types";

type HistoryComparisonView = {
  initialAttempt: HistoryAttempt;
  rewriteAttempt: HistoryAttempt;
  segments: RenderedInlineFeedbackSegment[];
};

type HistorySessionDetailModalProps = {
  feedbackState: PracticeFeedbackState | null;
  onClose: () => void;
  onOpenFeedback: (attempt: HistoryAttempt) => void;
  onReturnToHistory: () => void;
  session: HistorySession | null;
};

function getLatestAttempt(session: HistorySession) {
  return session.attempts[session.attempts.length - 1] ?? null;
}

function getLatestSessionTimestamp(session: HistorySession) {
  return getLatestAttempt(session)?.createdAt ?? session.updatedAt ?? session.createdAt;
}

function formatHistoryDateKey(dateTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date(dateTime));
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day", string>;

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatHistoryDateHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${dateKey}T00:00:00+09:00`));

  return `${year}년 ${month}월 ${day}일 ${weekday}`;
}

function formatHistoryTime(dateTime: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

function getHistoryWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getAttemptLabel(value?: string | null) {
  return value === "REWRITE" ? "다시쓰기" : "첫 답변";
}

function getAttemptCardLabel(attempt: HistoryAttempt) {
  return `${attempt.attemptNo}차 ${attempt.attemptType === "REWRITE" ? "다시쓰기" : "초안"}`;
}

function buildHistoryPrompt(session: HistorySession): Prompt {
  return {
    id: session.promptId,
    topic: session.topic,
    topicCategory: "",
    topicDetail: "",
    difficulty: session.difficulty,
    questionEn: session.questionEn,
    questionKo: session.questionKo,
    tip: ""
  };
}

function buildHistoryFeedback(session: HistorySession, attempt: HistoryAttempt): Feedback {
  return {
    promptId: session.promptId,
    sessionId: session.sessionId,
    attemptNo: attempt.attemptNo,
    score: attempt.score,
    loopComplete: attempt.feedback.loopComplete,
    completionMessage: attempt.feedback.completionMessage,
    summary: attempt.feedback.summary ?? attempt.feedbackSummary ?? "",
    strengths: attempt.feedback.strengths ?? [],
    inlineFeedback: attempt.feedback.inlineFeedback ?? null,
    correctedAnswer: attempt.feedback.correctedAnswer,
    usedExpressions:
      attempt.usedExpressions?.map((expression) => ({
        expression: expression.expression,
        matchedText: expression.matchedText ?? null
      })) ?? [],
    modelAnswer: attempt.feedback.modelAnswer ?? "",
    modelAnswerKo: attempt.feedback.modelAnswerKo ?? null,
    rewriteChallenge: attempt.feedback.rewriteChallenge ?? "",
    ui: attempt.feedback.ui ?? null
  };
}

function buildHistoryFeedbackState(
  session: HistorySession,
  attempt: HistoryAttempt
): PracticeFeedbackState {
  return {
    difficulty: session.difficulty,
    prompt: buildHistoryPrompt(session),
    answer: attempt.answerText,
    feedback: buildHistoryFeedback(session, attempt)
  };
}

function buildHistoryComparisonView(session: HistorySession): HistoryComparisonView | null {
  const initialAttempt =
    session.attempts.find((attempt) => attempt.attemptType === "INITIAL") ?? session.attempts[0];
  const rewriteAttempts = session.attempts.filter((attempt) => attempt.attemptType === "REWRITE");
  const rewriteAttempt = rewriteAttempts[rewriteAttempts.length - 1];

  if (!initialAttempt || !rewriteAttempt) {
    return null;
  }

  const original = initialAttempt.answerText.trim();
  const revised = rewriteAttempt.answerText.trim();

  if (!original || !revised || original === revised) {
    return null;
  }

  return {
    initialAttempt,
    rewriteAttempt,
    segments: buildInlineFeedbackSegments(initialAttempt.answerText, rewriteAttempt.answerText, null)
  };
}

function renderComparisonSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={styles.diffRemovedText}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={styles.diffAddedText}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={styles.diffRemovedText}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={styles.diffAddedText}>
          {segment.text}
        </Text>
      ) : null;
    default:
      return null;
  }
}

function HistorySessionDetailModal({
  feedbackState,
  onClose,
  onOpenFeedback,
  onReturnToHistory,
  session
}: HistorySessionDetailModalProps) {
  const orderedAttempts = useMemo(
    () =>
      session
        ? [...session.attempts].sort(
            (left, right) =>
              left.attemptNo - right.attemptNo ||
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          )
        : [],
    [session]
  );

  const latestAttempt = useMemo(() => (session ? getLatestAttempt(session) : null), [session]);
  const comparisonView = useMemo(() => (session ? buildHistoryComparisonView(session) : null), [session]);
  const isFeedbackView = Boolean(feedbackState);

  if (!session) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={isFeedbackView ? onReturnToHistory : onClose}
    >
      <SafeAreaView style={styles.modalSafeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderCopy}>
            <Text style={styles.modalEyebrow}>
              {isFeedbackView ? "ATTEMPT FEEDBACK" : "QUESTION HISTORY"}
            </Text>
            <Text style={styles.modalTitle}>{isFeedbackView ? "피드백 보기" : "질문 기록"}</Text>
          </View>
          <Pressable
            style={styles.modalCloseButton}
            onPress={isFeedbackView ? onReturnToHistory : onClose}
          >
            <Text style={styles.modalCloseText}>{isFeedbackView ? "목록으로" : "닫기"}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {feedbackState ? (
            <PracticeFeedbackContent
              feedbackState={feedbackState}
              showCompletionSummary={false}
            />
          ) : (
            <View style={styles.sessionDetailStack}>
              <View style={styles.promptCard}>
                <View style={styles.chipRow}>
                  <View style={styles.topicChip}>
                    <Text style={styles.topicChipText}>{session.topic}</Text>
                  </View>
                  <View style={styles.neutralChip}>
                    <Text style={styles.neutralChipText}>
                      {getDifficultyLabel(session.difficulty)}
                    </Text>
                  </View>
                  {latestAttempt ? (
                    <View style={styles.neutralChip}>
                      <Text style={styles.neutralChipText}>
                        {getAttemptLabel(latestAttempt.attemptType)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.promptQuestionEn}>{session.questionEn}</Text>
                <Text style={styles.promptQuestionKo}>{session.questionKo}</Text>
              </View>

              {comparisonView ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>최종 답안</Text>
                    <Text style={styles.detailMeta}>
                      {`${getHistoryWordCount(comparisonView.initialAttempt.answerText)}단어 → ${getHistoryWordCount(comparisonView.rewriteAttempt.answerText)}단어`}
                    </Text>
                  </View>
                  <View style={styles.comparisonStack}>
                    <View style={[styles.comparisonCard, styles.comparisonCardOriginal]}>
                      <Text style={styles.comparisonLabel}>내 초안</Text>
                      <Text style={styles.comparisonBody}>
                        {comparisonView.segments.map((segment, index) =>
                          renderComparisonSegment(segment, "original", index)
                        )}
                      </Text>
                    </View>
                    <View style={[styles.comparisonCard, styles.comparisonCardRevised]}>
                      <Text style={[styles.comparisonLabel, styles.comparisonLabelPrimary]}>
                        최종 답안
                      </Text>
                      <Text style={[styles.comparisonBody, styles.comparisonBodyPrimary]}>
                        {comparisonView.segments.map((segment, index) =>
                          renderComparisonSegment(segment, "revised", index)
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.detailNoticeCard}>
                  <Text style={styles.detailNoticeTitle}>아직 최종 답안이 없어요</Text>
                  <Text style={styles.detailNoticeBody}>
                    이 질문에서는 아직 다시쓰기 답변이 없어요. 아래 답변 기록에서 각 시도의
                    피드백을 열어 흐름을 확인해 보세요.
                  </Text>
                </View>
              )}

              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>이 질문에 남긴 답변</Text>
                  <Text style={styles.detailMeta}>{`${orderedAttempts.length}개 시도`}</Text>
                </View>

                <View style={styles.attemptStack}>
                  {orderedAttempts.map((attempt, attemptIndex) => {
                    const isLatest = latestAttempt?.id === attempt.id;

                    return (
                      <View
                        key={attempt.id}
                        style={[
                          styles.attemptCard,
                          attemptIndex > 0 && styles.attemptCardSeparated,
                          attempt.attemptType === "REWRITE"
                            ? styles.attemptCardRewrite
                            : styles.attemptCardInitial
                        ]}
                      >
                        <View style={styles.attemptHeader}>
                          <View style={styles.attemptHeaderCopy}>
                            <View style={styles.attemptChipRow}>
                              <View
                                style={[
                                  styles.attemptTypeChip,
                                  attempt.attemptType === "REWRITE"
                                    ? styles.attemptTypeChipRewrite
                                    : styles.attemptTypeChipInitial
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.attemptTypeChipText,
                                    attempt.attemptType === "REWRITE"
                                      ? styles.attemptTypeChipTextRewrite
                                      : styles.attemptTypeChipTextInitial
                                  ]}
                                >
                                  {getAttemptCardLabel(attempt)}
                                </Text>
                              </View>
                              {isLatest ? (
                                <View style={styles.latestChip}>
                                  <Text style={styles.latestChipText}>마지막 답변</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.attemptMeta}>
                              {`${formatHistoryTime(attempt.createdAt)} · ${getHistoryWordCount(attempt.answerText)}단어`}
                            </Text>
                          </View>

                          <Pressable
                            style={({ pressed }) => [
                              styles.inlineButton,
                              pressed && styles.inlineButtonPressed
                            ]}
                            onPress={() => onOpenFeedback(attempt)}
                          >
                            <Text style={styles.inlineButtonText}>피드백 보기</Text>
                          </Pressable>
                        </View>

                        <Text style={styles.attemptAnswer}>{attempt.answerText}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F2EB" },
  screen: { flex: 1 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 28,
    gap: 20
  },
  heroSection: { gap: 10 },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  heroUnderline: {
    width: 160,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  profileCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: "#A96C1B" },
  name: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: "#232128" },
  email: { fontSize: 15, color: "#6A5D4E" },
  metricRow: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#FBF5EE",
    paddingVertical: 14,
    alignItems: "center",
    gap: 4
  },
  metricValue: { fontSize: 20, fontWeight: "900", color: "#2A2620" },
  metricLabel: { fontSize: 12, fontWeight: "800", color: "#856C53" },
  emptyCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyBody: { fontSize: 15, lineHeight: 23, color: "#6A5D4E" },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#F5A33B",
    alignSelf: "flex-start"
  },
  primaryButtonText: { fontSize: 16, fontWeight: "900", color: "#232128" },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2"
  },
  secondaryButtonText: { fontSize: 16, fontWeight: "800", color: "#7A6244" },
  errorText: { fontSize: 14, lineHeight: 20, color: "#B34A2B" }
});
const listStyles = StyleSheet.create({
  historyBoard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 16
  },
  sectionHeader: { gap: 6 },
  sectionTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -1, color: "#232128" },
  sectionMeta: { fontSize: 14, fontWeight: "700", color: "#88745A" },
  dateFeed: { gap: 0 },
  dateGroup: {
    backgroundColor: "transparent"
  },
  dateGroupSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E7D7C4",
    marginTop: 12,
    paddingTop: 12
  },
  dateHeading: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  dateHeadingCopy: { flex: 1, gap: 4 },
  dateTitle: { fontSize: 18, fontWeight: "900", color: "#2A2520" },
  dateMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  dateToggle: { fontSize: 26, lineHeight: 28, fontWeight: "700", color: "#8C5D24" },
  questionStack: { paddingHorizontal: 0, paddingBottom: 0 },
  questionCard: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 10
  },
  questionCardSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E9DCCF"
  },
  questionCardInteractive: {},
  questionCardPressed: { opacity: 0.72 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  topicChipText: { fontSize: 12, fontWeight: "900", color: "#A76518" },
  neutralChip: {
    borderRadius: 999,
    backgroundColor: "#EFE7DD",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  neutralChipText: { fontSize: 12, fontWeight: "800", color: "#7C6B57" },
  questionEn: { fontSize: 21, lineHeight: 29, fontWeight: "800", color: "#2A2520" },
  questionKo: { fontSize: 15, lineHeight: 22, color: "#756757" }
});
const detailStyles = StyleSheet.create({
  modalSafeArea: { flex: 1, backgroundColor: "#F7F2EB" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8DACB"
  },
  modalHeaderCopy: { flex: 1, gap: 4 },
  modalEyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4, color: "#A96C1B" },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  modalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D1BD",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  modalCloseText: { fontSize: 14, fontWeight: "800", color: "#7B6752" },
  modalContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  sessionDetailStack: { gap: 16 },
  promptCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  promptQuestionEn: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  promptQuestionKo: { fontSize: 15, lineHeight: 23, color: "#6E6153" },
  detailCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900", letterSpacing: -0.6, color: "#232128" },
  detailMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  detailNoticeCard: {
    backgroundColor: "#FFF8EE",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D8C2",
    gap: 8
  },
  detailNoticeTitle: { fontSize: 18, fontWeight: "900", color: "#232128" },
  detailNoticeBody: { fontSize: 15, lineHeight: 22, color: "#6A5D4E" },
  comparisonStack: { gap: 0 },
  comparisonCard: {
    paddingVertical: 12,
    gap: 10
  },
  comparisonCardOriginal: {
    backgroundColor: "transparent"
  },
  comparisonCardRevised: {
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: "#E8DACB",
    paddingTop: 16,
    marginTop: 4
  },
  comparisonLabel: { fontSize: 14, fontWeight: "900", color: "#A06213" },
  comparisonLabelPrimary: { color: "#345891" },
  comparisonBody: { fontSize: 15, lineHeight: 24, color: "#4C4134" },
  comparisonBodyPrimary: { color: "#223654" },
  diffRemovedText: {
    color: "#8C5549",
    backgroundColor: "#F8DED7",
    textDecorationLine: "line-through"
  },
  diffAddedText: {
    color: "#244F7A",
    backgroundColor: "#DCE8FF"
  },
  attemptStack: { gap: 0 },
  attemptCard: {
    paddingVertical: 16,
    gap: 14
  },
  attemptCardInitial: {
    backgroundColor: "transparent"
  },
  attemptCardRewrite: {
    backgroundColor: "transparent"
  },
  attemptCardSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E8DACB"
  },
  attemptHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  attemptHeaderCopy: { flex: 1, gap: 8 },
  attemptChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attemptTypeChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  attemptTypeChipInitial: { backgroundColor: "#EFE7DD" },
  attemptTypeChipRewrite: { backgroundColor: "#FFF0D7" },
  attemptTypeChipText: { fontSize: 12, fontWeight: "900" },
  attemptTypeChipTextInitial: { color: "#6F6253" },
  attemptTypeChipTextRewrite: { color: "#A76518" },
  latestChip: {
    borderRadius: 999,
    backgroundColor: "#F5A33B",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  latestChipText: { fontSize: 12, fontWeight: "900", color: "#232128" },
  attemptMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  inlineButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E0D1BD",
    backgroundColor: "#FFFEFC"
  },
  inlineButtonPressed: { opacity: 0.86 },
  inlineButtonText: { fontSize: 13, fontWeight: "900", color: "#7A6244" },
  attemptAnswer: { fontSize: 16, lineHeight: 24, color: "#2C2924" }
});

const styles = {
  ...baseStyles,
  ...listStyles,
  ...detailStyles
};

export default function RecordsScreen() {
  const { currentUser, isHydrating, refreshSession, signOut } = useSession();
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);
  const [selectedHistoryFeedback, setSelectedHistoryFeedback] =
    useState<PracticeFeedbackState | null>(null);

  const groupedHistoryEntries = useMemo(() => {
    const grouped = history.reduce<Record<string, HistorySession[]>>((accumulator, session) => {
      const dateKey = formatHistoryDateKey(getLatestSessionTimestamp(session));
      accumulator[dateKey] = [...(accumulator[dateKey] ?? []), session];
      return accumulator;
    }, {});

    return Object.keys(grouped)
      .sort((left, right) => right.localeCompare(left))
      .map((dateKey) => ({
        dateKey,
        sessions: [...grouped[dateKey]].sort((left, right) =>
          getLatestSessionTimestamp(right).localeCompare(getLatestSessionTimestamp(left))
        )
      }));
  }, [history]);

  const loadHistory = useCallback(async () => {
    try {
      setError("");
      const [historyResponse, status] = await Promise.all([
        getAnswerHistory(),
        getTodayWritingStatus().catch(() => null)
      ]);
      setHistory(historyResponse);
      setTodayStatus(status);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "작문 기록을 불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setTodayStatus(null);
      setHistory([]);
      setError("");
      setSelectedSession(null);
      setSelectedHistoryFeedback(null);
      return;
    }

    void loadHistory();
  }, [currentUser, loadHistory]);

  useEffect(() => {
    setOpenDates((current) => {
      const next: Record<string, boolean> = {};
      let changed = Object.keys(current).length !== groupedHistoryEntries.length;

      groupedHistoryEntries.forEach(({ dateKey }, index) => {
        const nextValue = current[dateKey] ?? index === 0;
        next[dateKey] = nextValue;
        if (current[dateKey] !== nextValue) {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [groupedHistoryEntries]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const user = await refreshSession();
    if (user) {
      await loadHistory();
    }
    setIsRefreshing(false);
  }, [loadHistory, refreshSession]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  function handleOpenSession(session: HistorySession) {
    setSelectedSession(session);
    setSelectedHistoryFeedback(null);
  }

  function handleCloseSessionModal() {
    setSelectedHistoryFeedback(null);
    setSelectedSession(null);
  }

  function handleOpenFeedback(attempt: HistoryAttempt) {
    if (!selectedSession) {
      return;
    }

    setSelectedHistoryFeedback(buildHistoryFeedbackState(selectedSession, attempt));
  }

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <View style={styles.loadingState}>
            <ActivityIndicator color="#E38B12" />
          </View>
          <MobileNavBar activeTab="records" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
            }
          >
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>작문 기록</Text>
              <View style={styles.heroUnderline} />
            </View>

            {!currentUser ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
                <Text style={styles.emptyBody}>
                  작문 기록은 로그인한 뒤 날짜별로 모아볼 수 있어요.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push(buildLoginHref("/records"))}
                >
                  <Text style={styles.primaryButtonText}>로그인 하기</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.profileCard}>
                  <Text style={styles.eyebrow}>MY WRITELOOP</Text>
                  <Text style={styles.name}>{currentUser.displayName}</Text>
                  <Text style={styles.email}>{currentUser.email}</Text>
                  <View style={styles.metricRow}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricValue}>{todayStatus?.streakDays ?? 0}</Text>
                      <Text style={styles.metricLabel}>연속 루프</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricValue}>{history.length}</Text>
                      <Text style={styles.metricLabel}>질문 기록</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricValue}>
                        {(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}
                      </Text>
                      <Text style={styles.metricLabel}>총 문장</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.historyBoard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>날짜별 기록</Text>
                    <Text style={styles.sectionMeta}>{history.length}개의 질문</Text>
                  </View>

                  {groupedHistoryEntries.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
                      <Text style={styles.emptyBody}>오늘의 질문으로 첫 작문을 시작해 보세요.</Text>
                      <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
                        <Text style={styles.primaryButtonText}>홈으로 가기</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.dateFeed}>
                      {groupedHistoryEntries.map(({ dateKey, sessions }, groupIndex) => {
                        const isOpen = openDates[dateKey] ?? false;

                        return (
                          <View
                            key={dateKey}
                            style={[
                              styles.dateGroup,
                              groupIndex > 0 && styles.dateGroupSeparated
                            ]}
                          >
                            <Pressable
                              style={styles.dateHeading}
                              onPress={() =>
                                setOpenDates((current) => ({
                                  ...current,
                                  [dateKey]: !(current[dateKey] ?? false)
                                }))
                              }
                            >
                              <View style={styles.dateHeadingCopy}>
                                <Text style={styles.dateTitle}>{formatHistoryDateHeading(dateKey)}</Text>
                                <Text style={styles.dateMeta}>{`${sessions.length}개 질문`}</Text>
                              </View>
                              <Text style={styles.dateToggle}>{isOpen ? "-" : "+"}</Text>
                            </Pressable>

                            {isOpen ? (
                              <View style={styles.questionStack}>
                                {sessions.map((session, sessionIndex) => {
                                  const latestAttempt = getLatestAttempt(session);

                                  return (
                                    <Pressable
                                      key={session.sessionId}
                                      style={({ pressed }) => [
                                        styles.questionCard,
                                        sessionIndex > 0 && styles.questionCardSeparated,
                                        latestAttempt && styles.questionCardInteractive,
                                        pressed && latestAttempt && styles.questionCardPressed
                                      ]}
                                      disabled={!latestAttempt}
                                      onPress={() =>
                                        latestAttempt ? handleOpenSession(session) : undefined
                                      }
                                    >
                                      <View style={styles.chipRow}>
                                        <View style={styles.topicChip}>
                                          <Text style={styles.topicChipText}>{session.topic}</Text>
                                        </View>
                                        <View style={styles.neutralChip}>
                                          <Text style={styles.neutralChipText}>
                                            {getDifficultyLabel(session.difficulty)}
                                          </Text>
                                        </View>
                                        {latestAttempt ? (
                                          <View style={styles.neutralChip}>
                                            <Text style={styles.neutralChipText}>
                                              {getAttemptLabel(latestAttempt.attemptType)}
                                            </Text>
                                          </View>
                                        ) : null}
                                      </View>

                                      <Text style={styles.questionEn}>{session.questionEn}</Text>
                                      <Text style={styles.questionKo}>{session.questionKo}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable style={styles.secondaryButton} onPress={() => void handleSignOut()}>
                  <Text style={styles.secondaryButtonText}>로그아웃</Text>
                </Pressable>
              </>
            )}
          </ScrollView>

          <MobileNavBar activeTab="records" />
        </View>
      </SafeAreaView>

      <HistorySessionDetailModal
        feedbackState={selectedHistoryFeedback}
        onClose={handleCloseSessionModal}
        onOpenFeedback={handleOpenFeedback}
        onReturnToHistory={() => setSelectedHistoryFeedback(null)}
        session={selectedSession}
      />
    </>
  );
}
