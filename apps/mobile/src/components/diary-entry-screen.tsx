import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedbackLoadingOverlay from "@/components/feedback-loading-overlay";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import ProblemReportLink from "@/components/problem-report-link";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  deleteSavedExpression,
  getDiaryEntry,
  getSavedExpressions,
  requestCoachHelp,
  requestDiaryFeedback,
  saveExpression,
  updateDiaryEntry
} from "@/lib/api";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type {
  DiaryCorrectionPoint,
  CoachExpression,
  CoachHelpResponse,
  DiaryEntry,
  DiaryExpression,
  DiaryFeedback,
  DiaryRewriteIdea
} from "@/lib/types";

type DiaryEntryScreenProps = {
  initialEntryId?: string | null;
};

type DiaryStep = "write" | "feedback" | "rewrite";

const DIARY_COACH_PROMPT_ID = "diary-free-writing";
const MOOD_OPTIONS = [
  "calm",
  "happy",
  "grateful",
  "excited",
  "proud",
  "relaxed",
  "focused",
  "hopeful",
  "refreshed",
  "tired",
  "sleepy",
  "busy",
  "stressed",
  "worried",
  "sad",
  "lonely"
];
const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

function todayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function countWords(text: string) {
  const trimmed = trimText(text);
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

function getLatestFeedback(entry: DiaryEntry | null): DiaryFeedback | null {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.feedback ?? null;
}

function getLatestAttemptText(entry: DiaryEntry | null) {
  const latestAttempt = entry?.attempts?.[entry.attempts.length - 1];
  return latestAttempt?.diaryText ?? entry?.content ?? "";
}

function formatDiaryDate(value?: string | null) {
  return value || todayDateKey();
}

function buildDefaultDiaryTitle(entryDate: string) {
  const matched = entryDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return `${entryDate || todayDateKey()}의 일기`;
  }

  const [, year, month, day] = matched;
  return `${year}년 ${Number(month)}월 ${Number(day)}일의 일기`;
}

function firstText(...values: (string | null | undefined)[]) {
  return values.map((value) => trimText(value)).find(Boolean) ?? "";
}

function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeMoodTags(tags: (string | null | undefined)[]) {
  const seen = new Set<string>();
  return tags
    .map((tag) => trimText(tag))
    .filter((tag) => {
      if (!tag || seen.has(tag)) {
        return false;
      }

      seen.add(tag);
      return true;
    });
}

function getDiaryMoodTags(entry: DiaryEntry) {
  const tags = normalizeMoodTags(entry.tags ?? []);
  return tags.length > 0 ? tags : normalizeMoodTags([entry.mood]);
}

function buildSavedExpressionIdMap(expressions: { id: number; expression: string }[]) {
  return expressions.reduce<Record<string, number>>((map, expression) => {
    const key = normalizeExpressionKey(expression.expression);
    if (key) {
      map[key] = expression.id;
    }
    return map;
  }, {});
}

function isActionableFlowSuggestion(value?: string | null) {
  const text = trimText(value);
  if (!text) {
    return false;
  }

  return /(더|추가|붙|넣|써|사용|이어|정리|마무리|보세요|해보세요|바꿔|늘려|구체|try|add|use|connect|include)/i.test(text);
}

function getNextFlowSuggestion(kind: "emotion" | "reflection", value?: string | null) {
  if (isActionableFlowSuggestion(value)) {
    return trimText(value);
  }

  if (kind === "emotion") {
    return "다음에는 그때 기분이 어떻게 바뀌었는지 한 문장 더 붙여 보세요.";
  }

  return "마지막에 오늘 일로 무엇을 느꼈는지 짧게 정리해 보세요.";
}

function formatConnectionTipSuggestion(tips?: string[] | null) {
  const cleanedTips = (tips ?? []).map((tip) => trimText(tip)).filter(Boolean);
  if (cleanedTips.length === 0) {
    return "Then, after that 같은 표현으로 장면을 이어 보세요.";
  }

  const hasSentenceLikeTip = cleanedTips.some((tip) =>
    tip.length > 24 || /[가-힣].*(보세요|좋아요|자연스러워요|맞춰|이어)/.test(tip)
  );
  if (hasSentenceLikeTip) {
    return cleanedTips.join(" ");
  }

  return `다음에는 ${cleanedTips.join(" · ")} 같은 표현으로 장면을 이어 보세요.`;
}

function renderDiaryDiffSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={styles.diaryRemovedText}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={styles.diaryAddedText}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={styles.diaryRemovedText}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={styles.diaryAddedText}>
          {segment.text}
        </Text>
      ) : null;
    default:
      return null;
  }
}

function renderDiaryFixDiffText(original: string, revised: string, mode: "original" | "revised") {
  if (original && revised && original !== revised) {
    const segments = buildInlineFeedbackSegments(original, revised, null);
    if (segments.length > 0) {
      return segments.map((segment, index) => renderDiaryDiffSegment(segment, mode, index));
    }
  }

  return mode === "original" ? original : revised;
}

function renderExpressionSaveIcon(saved: boolean, saving: boolean) {
  if (saving) {
    return <ActivityIndicator color="#8A5A1E" size="small" />;
  }

  return (
    <SymbolView
      name={{
        ios: saved ? "bookmark.fill" : "bookmark",
        android: saved ? "bookmark" : "bookmark_border",
        web: saved ? "bookmark" : "bookmark_border"
      }}
      size={16}
      weight="semibold"
      tintColor={saved ? "#2F7A46" : "#8A5A1E"}
      type="hierarchical"
    />
  );
}

function getDiaryFeedbackHeadline(feedback: DiaryFeedback) {
  switch (feedback.diaryAnswerBand) {
    case "DIARY_TOO_SHORT":
      return "조금만 더 쓰면 좋은 일기가 돼요";
    case "DIARY_NOT_ENGLISH":
      return "쉬운 영어 문장으로 옮겨보면 좋아요";
    case "DIARY_GRAMMAR_BLOCKING":
      return "의미가 보이도록 문장을 먼저 정리했어요";
    case "DIARY_FLOW_THIN":
      return "일기의 흐름을 더 살릴 수 있어요";
    case "DIARY_NATURAL_COMPLETE":
      return "이미 자연스러운 일기예요";
    default:
      return "일기를 더 자연스럽게 다듬었어요";
  }
}

type DiaryFeedbackPanelProps = {
  feedback: DiaryFeedback;
  onSaveDiaryExpression?: (
    expression: string,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) => void;
  isDiaryExpressionSaved?: (expression: string) => boolean;
  isSavingDiaryExpression?: (expression: string) => boolean;
};

function DiaryFeedbackPanel({
  feedback,
  onSaveDiaryExpression,
  isDiaryExpressionSaved,
  isSavingDiaryExpression
}: DiaryFeedbackPanelProps) {
  const fixPoints = (feedback.fixPoints ?? []).filter(
    (point): point is DiaryCorrectionPoint => Boolean(point?.title || point?.reasonKo)
  );
  const rewriteIdeas = (feedback.rewriteIdeas ?? []).filter(
    (idea): idea is DiaryRewriteIdea =>
      Boolean(idea?.title || idea?.meaningKo || idea?.noteKo || idea?.exampleEn)
  );
  const diaryExpressions = [
    ...(feedback.usedDiaryExpressions ?? []),
    ...(feedback.diaryExpressions ?? [])
  ].filter((item): item is DiaryExpression => Boolean(item?.expression))
    .filter((item, index, items) => {
      const normalizedExpression = normalizeExpressionKey(item.expression);
      if (!normalizedExpression) {
        return true;
      }

      return items.findIndex((candidate) =>
        normalizeExpressionKey(candidate.expression) === normalizedExpression
      ) === index;
    });
  const summary = firstText(feedback.summaryKo, feedback.diaryFlow?.commentKo);
  const missionText = firstText(
    feedback.nextDiaryMission?.instructionKo,
    feedback.nextDiaryMission?.titleKo
  );
  const diaryFlow = feedback.diaryFlow;
  const goodFlowItems = [
    { label: "시간 흐름", value: diaryFlow?.timeFlow },
    { label: "디테일", value: diaryFlow?.detail }
  ].filter((item) => Boolean(trimText(item.value)));
  const nextFlowItems = [
    { label: "감정 더하기", value: getNextFlowSuggestion("emotion", diaryFlow?.emotion) },
    { label: "마무리 더하기", value: getNextFlowSuggestion("reflection", diaryFlow?.reflection) },
    {
      label: "연결 표현",
      value: formatConnectionTipSuggestion(diaryFlow?.connectionTips)
    }
  ].filter((item) => Boolean(trimText(item.value)));
  const hasDiaryFlow = goodFlowItems.length > 0 || nextFlowItems.length > 0;

  return (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackHeaderCopy}>
          <Text style={styles.feedbackTitle}>{getDiaryFeedbackHeadline(feedback)}</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>{feedback.score}</Text>
        </View>
      </View>

      {summary ? <Text style={styles.feedbackSummary}>{summary}</Text> : null}

      {feedback.strengths?.length ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>좋았던 점</Text>
          </View>
          <View style={styles.bulletList}>
            {feedback.strengths.slice(0, 3).map((strength, index) => (
              <Text key={`${strength}-${index}`} style={styles.bulletText}>
                • {strength}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {fixPoints.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>고치면 더 자연스러운 부분</Text>
          </View>
          {fixPoints.slice(0, 5).map((point, index) => {
            const title = firstText(point.title, `포인트 ${index + 1}`);
            const originalText = trimText(point.originalText);
            const revisedText = trimText(point.revisedText);
            const supportText = firstText(point.reasonKo);

            return (
              <View
                key={`${title}-${index}`}
                style={[styles.fixPointCard, index > 0 && styles.innerDivider]}
              >
                <Text style={styles.fixPointTitle}>{title}</Text>
                {originalText || revisedText ? (
                  <View style={styles.repairBox}>
                    {originalText ? (
                      <Text style={styles.originalText}>
                        {renderDiaryFixDiffText(originalText, revisedText, "original")}
                      </Text>
                    ) : null}
                    {revisedText ? (
                      <Text style={styles.revisedText}>
                        {renderDiaryFixDiffText(originalText, revisedText, "revised")}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {supportText ? <Text style={styles.fixPointSupport}>{supportText}</Text> : null}
                {point.exampleEn ? <Text style={styles.exampleText}>{point.exampleEn}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {hasDiaryFlow ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>일기 흐름 코칭</Text>
          </View>
          <View style={styles.flowGrid}>
            {goodFlowItems.length > 0 ? (
              <View style={styles.flowSubCard}>
                <Text style={styles.flowSubTitle}>좋았던 흐름</Text>
                {goodFlowItems.map((item) => (
                  <Text key={item.label} style={styles.flowItemText}>
                    <Text style={styles.flowItemLabel}>{item.label}: </Text>
                    {item.value}
                  </Text>
                ))}
              </View>
            ) : null}
            {nextFlowItems.length > 0 ? (
              <View style={[styles.flowSubCard, goodFlowItems.length > 0 && styles.innerDivider]}>
                <Text style={styles.flowSubTitle}>다음에 더 붙이면 좋을 흐름</Text>
                {nextFlowItems.map((item) => (
                  <Text key={item.label} style={styles.flowItemText}>
                    <Text style={styles.flowItemLabel}>{item.label}: </Text>
                    {item.value}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {diaryExpressions.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>일기에 써볼 표현</Text>
          </View>
          <View style={styles.expressionList}>
            {diaryExpressions.slice(0, 6).map((item, index) => (
              <View
                key={`${normalizeExpressionKey(item.expression)}-${index}`}
                style={[styles.expressionChip, index > 0 && styles.innerDivider]}
              >
                <View style={styles.expressionHeaderRow}>
                  <Text style={styles.expressionText}>{item.expression}</Text>
                  {onSaveDiaryExpression ? (
                    <Pressable
                      style={[
                        styles.expressionSaveButton,
                        isDiaryExpressionSaved?.(item.expression) && styles.expressionSaveButtonSaved
                      ]}
                      onPress={() =>
                        onSaveDiaryExpression(
                          item.expression,
                          item.meaningKo || undefined,
                          item.exampleEn || undefined,
                          item.usageTipKo || undefined,
                          item.tags
                        )
                      }
                      disabled={Boolean(isSavingDiaryExpression?.(item.expression))}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isDiaryExpressionSaved?.(item.expression) ? "표현 저장 취소" : "표현 저장"
                      }
                    >
                      {renderExpressionSaveIcon(
                        Boolean(isDiaryExpressionSaved?.(item.expression)),
                        Boolean(isSavingDiaryExpression?.(item.expression))
                      )}
                    </Pressable>
                  ) : null}
                </View>
                {item.meaningKo ? <Text style={styles.expressionMeaning}>{item.meaningKo}</Text> : null}
                {item.exampleEn ? <Text style={styles.expressionMeaning}>{item.exampleEn}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {rewriteIdeas.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>다시 쓸 때 붙여볼 아이디어</Text>
          </View>
          {rewriteIdeas.slice(0, 5).map((idea, index) => {
            const translation = firstText(idea.meaningKo, `아이디어 ${index + 1}`);
            const note = firstText(idea.noteKo);
            const example = firstText(idea.exampleEn);

            return (
              <View
                key={`${translation}-${example}-${index}`}
                style={[styles.ideaCard, index > 0 && styles.innerDivider]}
              >
                <Text style={styles.ideaTitle}>{translation}</Text>
                {note ? <Text style={styles.ideaNote}>{note}</Text> : null}
                {example ? <Text style={styles.exampleText}>{example}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {missionText ? (
        <View style={styles.challengeCard}>
          <Text style={styles.challengeLabel}>다시 써보기 미션</Text>
          <Text style={styles.challengeText}>{missionText}</Text>
          {feedback.nextDiaryMission?.starterEn ? (
            <Text style={styles.exampleText}>{feedback.nextDiaryMission.starterEn}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function DiaryEntryScreen({ initialEntryId = null }: DiaryEntryScreenProps) {
  const { currentUser, isHydrating } = useSession();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const diaryInputRef = useRef<TextInput | null>(null);
  const editorYRef = useRef(0);
  const [entryId, setEntryId] = useState(initialEntryId ?? "");
  const [entryDate, setEntryDate] = useState(todayDateKey());
  const [title, setTitle] = useState(() => buildDefaultDiaryTitle(todayDateKey()));
  const [selectedMoodTags, setSelectedMoodTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [rewriteText, setRewriteText] = useState("");
  const [feedback, setFeedback] = useState<DiaryFeedback | null>(null);
  const [step, setStep] = useState<DiaryStep>("write");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isReadOnlyFeedbackOpen, setIsReadOnlyFeedbackOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(initialEntryId));
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [savedCoachExpressionKeys, setSavedCoachExpressionKeys] = useState<string[]>([]);
  const [savingCoachExpressionKeys, setSavingCoachExpressionKeys] = useState<string[]>([]);
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>({});
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);

  const activeText = step === "rewrite" ? rewriteText : content;
  const wordCount = useMemo(() => countWords(activeText), [activeText]);
  const canSubmit = wordCount > 0 && !isReadOnly && !isSubmitting && !isSaving && !isCompleting && !isDeleting;
  const defaultTitle = useMemo(() => buildDefaultDiaryTitle(entryDate), [entryDate]);
  const displayTitle = title.trim() || defaultTitle;
  const displayMoodTags = useMemo(() => normalizeMoodTags(selectedMoodTags), [selectedMoodTags]);
  const readOnlyWordCount = useMemo(() => countWords(content), [content]);
  const diaryCoachQuickQuestions = useMemo(
    () => [
      "오늘 일기에 어울리는 표현 3개 알려줘.",
      "내 감정을 자연스럽게 쓰는 문장을 알려줘.",
      "마무리 문장을 어떻게 쓰면 좋을까?",
      "이 일기 문장을 조금 더 자연스럽게 만들고 싶어."
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadEntry() {
      if (!initialEntryId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const entry = await getDiaryEntry(initialEntryId);
        if (cancelled) {
          return;
        }
        if (!entry) {
          setError("일기를 찾을 수 없어요.");
          return;
        }

        setEntryId(entry.entryId);
        setEntryDate(formatDiaryDate(entry.entryDate));
        const loadedDate = formatDiaryDate(entry.entryDate);
        const loadedTitle = entry.title ?? "";
        setTitle(loadedTitle || buildDefaultDiaryTitle(loadedDate));
        setSelectedMoodTags(getDiaryMoodTags(entry));
        setContent(entry.content ?? "");
        const latestFeedback = getLatestFeedback(entry);
        const latestText = getLatestAttemptText(entry);
        setFeedback(latestFeedback);
        setRewriteText(latestText || entry.content || "");
        setIsReadOnly(!entry.draft);
        setIsReadOnlyFeedbackOpen(false);
        setStep(!entry.draft ? "write" : latestFeedback ? "feedback" : "write");
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "일기를 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [initialEntryId]);

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      setSavingExpressionKeys([]);
      setSavedCoachExpressionKeys([]);
      setSavingCoachExpressionKeys([]);
      return;
    }

    let cancelled = false;

    void getSavedExpressions()
      .then((savedExpressions) => {
        if (!cancelled) {
          setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
          setSavedCoachExpressionKeys(savedExpressions.map((item) => normalizeExpressionKey(item.expression)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedExpressionIdsByKey({});
          setSavedCoachExpressionKeys([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  function handleEntryDateChange(nextDate: string) {
    const previousDefaultTitle = buildDefaultDiaryTitle(entryDate);
    const shouldFollowDateTitle = !title.trim() || title.trim() === previousDefaultTitle;

    setEntryDate(nextDate);
    if (shouldFollowDateTitle) {
      setTitle(buildDefaultDiaryTitle(nextDate));
    }
  }

  async function saveEntry(nextContent = content, draft = true) {
    const moodTags = normalizeMoodTags(selectedMoodTags);
    const payload = {
      title: title.trim() || defaultTitle,
      content: nextContent,
      language: "en",
      entryDate,
      mood: moodTags[0] ?? "",
      tags: moodTags,
      draft
    };

    if (entryId) {
      return updateDiaryEntry(entryId, payload);
    }

    const created = await createDiaryEntry(payload);
    setEntryId(created.entryId);
    return created;
  }

  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      setError("");
      await saveEntry(content, true);
      Alert.alert("저장됐어요", "영어일기 초안을 저장했어요.");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "일기를 저장하지 못했어요.";
      setError(message);
      Alert.alert("저장 실패", message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRequestFeedback(nextAttemptType: "INITIAL" | "REWRITE") {
    const targetText = (nextAttemptType === "REWRITE" ? rewriteText : content).trim();
    if (!targetText) {
      setError("피드백을 받으려면 일기 내용을 먼저 써 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const saved = await saveEntry(targetText, true);
      const nextFeedback = await requestDiaryFeedback(saved.entryId, {
        bodyText: targetText,
        attemptType: nextAttemptType
      });
      setEntryId(saved.entryId);
      setContent(targetText);
      setFeedback(nextFeedback);
      setRewriteText(targetText);
      setStep("feedback");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "일기 피드백을 받지 못했어요.";
      setError(message);
      Alert.alert("피드백 실패", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNewDiary() {
    setEntryId("");
    const nextDate = todayDateKey();
    setEntryDate(nextDate);
    setTitle(buildDefaultDiaryTitle(nextDate));
    setSelectedMoodTags([]);
    setContent("");
    setRewriteText("");
    setFeedback(null);
    setIsReadOnly(false);
    setIsReadOnlyFeedbackOpen(false);
    setStep("write");
    setError("");
    router.replace("/diary/write");
  }

  function handleStartRewrite() {
    setRewriteText((current) => current.trim() ? current : content);
    setStep("rewrite");
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(editorYRef.current - 16, 0),
        animated: true
      });
      diaryInputRef.current?.focus();
    }, 80);
  }

  function handleToggleMoodTag(tag: string) {
    setSelectedMoodTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  function appendCoachExpression(expression: string) {
    const cleanedExpression = expression.trim();
    if (!cleanedExpression) {
      return;
    }

    const currentText = activeText.trimEnd();
    const nextText = currentText ? `${currentText} ${cleanedExpression}` : cleanedExpression;
    if (step === "rewrite") {
      setRewriteText(nextText);
    } else {
      setContent(nextText);
    }
    setIsCoachOpen(false);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(editorYRef.current - 16, 0),
        animated: true
      });
      diaryInputRef.current?.focus();
    }, 80);
  }

  async function handleRequestCoachHelp(questionOverride?: string) {
    const nextQuestion = (questionOverride ?? coachQuestion).trim();
    if (!nextQuestion) {
      setCoachHelpError("코치에게 물어볼 내용을 먼저 적어 주세요.");
      setIsCoachOpen(true);
      return;
    }

    try {
      setIsCoachOpen(true);
      setIsLoadingCoachHelp(true);
      setCoachHelp(null);
      setCoachHelpError("");
      const nextCoachHelp = await requestCoachHelp({
        promptId: DIARY_COACH_PROMPT_ID,
        question: nextQuestion,
        answer: activeText.trim() || undefined,
        attemptType: step === "rewrite" ? "REWRITE" : "INITIAL"
      });
      setCoachQuestion(nextQuestion);
      setCoachHelp(nextCoachHelp);
    } catch (caughtError) {
      setCoachHelpError(caughtError instanceof Error ? caughtError.message : "AI 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  async function handleSaveCoachExpression(expression: CoachExpression) {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey || savedCoachExpressionKeys.includes(normalizedKey) || savingCoachExpressionKeys.includes(normalizedKey)) {
      return;
    }

    if (!currentUser) {
      Alert.alert("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
        { text: "취소", style: "cancel" },
        { text: "로그인하기", onPress: () => router.push(buildLoginHref("/diary/write")) }
      ]);
      return;
    }

    try {
      setSavingCoachExpressionKeys((current) =>
        current.includes(normalizedKey) ? current : [...current, normalizedKey]
      );
      const savedExpression = await saveExpression({
        expression: expression.expression,
        meaningKo: expression.meaningKo,
        usageTipKo: expression.usageTip,
        exampleEn: expression.example,
        tags: expression.tags ?? undefined,
        sourceType: "DIARY_EXPRESSION"
      });
      setSavedCoachExpressionKeys((current) =>
        current.includes(normalizedKey) ? current : [...current, normalizedKey]
      );
      setSavedExpressionIdsByKey((current) => ({ ...current, [normalizedKey]: savedExpression.id }));
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingCoachExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
  }

  async function handleCompleteDiary() {
    if (isCompleting) {
      return;
    }

    const finalText = (content.trim() || rewriteText.trim());
    if (!finalText) {
      router.replace("/diary" as never);
      return;
    }

    try {
      setIsCompleting(true);
      setError("");
      const completedEntry = await saveEntry(finalText, false);
      setContent(finalText);
      setIsReadOnly(true);
      setIsReadOnlyFeedbackOpen(false);
      router.replace({
        pathname: "/diary/complete",
        params: { entryId: completedEntry.entryId }
      } as Href);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "일기를 완료하지 못했어요.";
      setError(message);
      Alert.alert("완료 실패", message);
    } finally {
      setIsCompleting(false);
    }
  }

  function handleHeaderBackPress() {
    if (initialEntryId) {
      router.replace("/diary" as never);
      return;
    }

    router.replace("/");
  }

  async function performDeleteEntry() {
    if (!entryId || isDeleting) {
      return;
    }

    try {
      setIsDeleting(true);
      setError("");
      await deleteDiaryEntry(entryId);
      router.replace("/diary" as never);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "일기를 삭제하지 못했어요.";
      setError(message);
      Alert.alert("삭제 실패", message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDeleteEntry() {
    if (!entryId) {
      return;
    }

    Alert.alert("이 일기를 삭제할까요?", "삭제하면 피드백 기록도 함께 사라져요.", [
      {
        text: "취소",
        style: "cancel"
      },
      {
        text: "삭제하기",
        style: "destructive",
        onPress: () => void performDeleteEntry()
      }
    ]);
  }

  async function handleToggleDiaryExpression(
    expression: string,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) {
    const normalizedKey = normalizeExpressionKey(expression);
    if (!normalizedKey) {
      return;
    }

    if (!currentUser) {
      Alert.alert("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
        { text: "취소", style: "cancel" },
        {
          text: "로그인하기",
          onPress: () => router.push(buildLoginHref(initialEntryId ? `/diary/${initialEntryId}` : "/diary"))
        }
      ]);
      return;
    }

    if (savingExpressionKeys.includes(normalizedKey)) {
      return;
    }

    const savedExpressionId = savedExpressionIdsByKey[normalizedKey];
    setSavingExpressionKeys((current) =>
      current.includes(normalizedKey) ? current : [...current, normalizedKey]
    );

    try {
      if (savedExpressionId) {
        await deleteSavedExpression(savedExpressionId);
        setSavedExpressionIdsByKey((current) => {
          const next = { ...current };
          delete next[normalizedKey];
          return next;
        });
        return;
      }

      const savedExpression = await saveExpression({
        expression,
        meaningKo: meaningKo ?? undefined,
        exampleEn: exampleEn ?? undefined,
        usageTipKo: usageTip ?? undefined,
        tags: tags?.length ? tags : undefined,
        sourceType: "DIARY_EXPRESSION"
      });
      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [normalizedKey]: savedExpression.id
      }));
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
  }

  if (isHydrating || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loadingState}>
          <ActivityIndicator color="#E38B12" />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loginGate}>
          <Text style={styles.loginTitle}>로그인이 필요해요</Text>
          <Text style={styles.loginBody}>영어일기는 계정에 저장되는 개인 기록이라 로그인 후 사용할 수 있어요.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push(buildLoginHref("/diary/write"))}>
            <Text style={styles.primaryButtonText}>로그인하고 일기 쓰기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isReadOnly) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerBackButton}
              onPress={handleHeaderBackPress}
              accessibilityRole="button"
              accessibilityLabel="영어일기 기록으로 이동"
            >
              <Text style={styles.headerBackIcon}>{"<"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>영어일기</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.readMetaCard}>
            <View style={styles.readMetaTopRow}>
              <Text style={styles.readMetaEyebrow}>완료된 일기</Text>
              <Text style={styles.readMetaDate}>{entryDate}</Text>
            </View>
            <Text style={styles.readMetaTitle}>{displayTitle}</Text>
            {displayMoodTags.length > 0 ? (
              <View style={styles.readMoodRow}>
                {displayMoodTags.map((tag) => (
                  <View key={tag} style={styles.readMoodChip}>
                    <Text style={styles.readMoodChipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.readDiaryPaper}>
            <Text style={styles.readDiaryLabel}>오늘의 영어일기</Text>
            <View style={styles.readDiaryNotebook}>
              <View pointerEvents="none" style={styles.readDiaryNotebookLines}>
                {Array.from({ length: 12 }).map((_, index) => (
                  <View key={`diary-line-${index}`} style={styles.readDiaryNotebookLine} />
                ))}
              </View>
              <Text style={styles.readDiaryText}>{content.trim() || "아직 작성된 내용이 없어요."}</Text>
            </View>
            <View style={styles.readDiaryFooter}>
              <Text style={styles.readDiaryWordCount}>{readOnlyWordCount}단어</Text>
              <Text style={styles.readDiaryStatus}>작성 완료</Text>
            </View>
          </View>

          {feedback ? (
            <View style={styles.readFeedbackArea}>
              <Pressable
                style={styles.readFeedbackToggle}
                onPress={() => setIsReadOnlyFeedbackOpen((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={isReadOnlyFeedbackOpen ? "피드백 접기" : "피드백 펼치기"}
              >
                <Text style={styles.readFeedbackToggleText}>피드백 보기</Text>
                <Text style={styles.readFeedbackToggleIcon}>{isReadOnlyFeedbackOpen ? "-" : "+"}</Text>
              </Pressable>
              {isReadOnlyFeedbackOpen ? (
                <DiaryFeedbackPanel
                  feedback={feedback}
                  onSaveDiaryExpression={handleToggleDiaryExpression}
                  isDiaryExpressionSaved={(expression) =>
                    Boolean(savedExpressionIdsByKey[normalizeExpressionKey(expression)])
                  }
                  isSavingDiaryExpression={(expression) =>
                    savingExpressionKeys.includes(normalizeExpressionKey(expression))
                  }
                />
              ) : null}
            </View>
          ) : null}

          {error ? (
            <View>
              <Text style={styles.errorText}>{error}</Text>
              <ProblemReportLink source="diary_entry" errorCode="DIARY_SCREEN_ERROR" />
            </View>
          ) : null}

          {entryId ? (
            <View style={styles.deleteArea}>
              <Pressable
                onPress={handleDeleteEntry}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="일기 삭제"
              >
                <Text style={[styles.deleteButtonText, isDeleting && styles.deleteButtonTextDisabled]}>
                  {isDeleting ? "삭제 중" : "일기 삭제"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerBackButton}
              onPress={handleHeaderBackPress}
              accessibilityRole="button"
              accessibilityLabel={initialEntryId ? "영어일기 기록으로 이동" : "홈으로 이동"}
            >
              <Text style={styles.headerBackIcon}>{"<"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>영어일기</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.introCard}>
            <Text style={styles.introTitle}>오늘을 영어로 남겨보세요.</Text>
            <Text style={styles.introBody}>
              짧게 써도 괜찮아요. AI가 자연스럽게 다듬어 줄게요.
            </Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.fieldLabel}>날짜</Text>
            <TextInput
              value={entryDate}
              onChangeText={handleEntryDateChange}
              style={styles.metaInput}
              placeholder="2026-04-23"
              placeholderTextColor="#BBAA96"
            />
            <Text style={styles.fieldLabel}>제목</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.metaInput}
              placeholder={defaultTitle}
              placeholderTextColor="#BBAA96"
            />
            <Text style={styles.fieldLabel}>기분 태그</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map((item) => {
                const selected = selectedMoodTags.includes(item);
                return (
                  <Pressable
                    key={item}
                    style={[styles.moodChip, selected && styles.moodChipActive]}
                    onPress={() => handleToggleMoodTag(item)}
                  >
                    <Text style={[styles.moodChipText, selected && styles.moodChipTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            style={styles.editorCard}
            onLayout={(event) => {
              editorYRef.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.fieldLabel}>{step === "rewrite" ? "다시 써보기" : "오늘의 영어일기"}</Text>
            <View style={styles.diaryInputWrap}>
              <TextInput
                ref={diaryInputRef}
                value={step === "rewrite" ? rewriteText : content}
                onChangeText={step === "rewrite" ? setRewriteText : setContent}
                multiline
                textAlignVertical="top"
                style={styles.diaryInput}
                placeholder={step === "rewrite" ? "피드백을 반영해서 다시 써보세요." : "Today, I..."}
                placeholderTextColor="#BBAA96"
              />
              {!isCoachOpen ? (
                <Pressable
                  style={[
                    styles.diaryCoachTrigger,
                    !(step === "rewrite" ? rewriteText : content).trim() && styles.diaryCoachTriggerWithBubble
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="AI 코치 열기"
                  accessibilityHint="일기 표현과 문장 아이디어를 물어볼 수 있어요."
                  onPress={() => setIsCoachOpen(true)}
                >
                  {!(step === "rewrite" ? rewriteText : content).trim() ? (
                    <View style={styles.diaryCoachBubble}>
                      <Text style={styles.diaryCoachBubbleText}>막히면 AI 코치에게 물어봐요.</Text>
                      <View style={styles.diaryCoachBubbleTail} />
                    </View>
                  ) : null}

                  <View style={styles.diaryCoachMascotFrame}>
                    <Image source={coachMascotImage} style={styles.diaryCoachMascot} />
                  </View>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.editorFooter}>
              <Text style={styles.wordCount}>{wordCount}단어</Text>
              {step !== "rewrite" ? (
                <Pressable style={styles.saveDraftButton} onPress={() => void handleSaveDraft()} disabled={isSaving}>
                  <Text style={styles.saveDraftButtonText}>{isSaving ? "저장 중" : "임시저장"}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {feedback ? (
            <DiaryFeedbackPanel
              feedback={feedback}
              onSaveDiaryExpression={handleToggleDiaryExpression}
              isDiaryExpressionSaved={(expression) =>
                Boolean(savedExpressionIdsByKey[normalizeExpressionKey(expression)])
              }
              isSavingDiaryExpression={(expression) =>
                savingExpressionKeys.includes(normalizeExpressionKey(expression))
              }
            />
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={step === "feedback" ? styles.feedbackActionStack : styles.actionRow}>
            {step === "feedback" ? (
              <>
                <Pressable
                  style={[styles.primaryButton, isCompleting && styles.primaryButtonDisabled]}
                  onPress={() => void handleCompleteDiary()}
                  disabled={isCompleting}
                >
                  <Text style={styles.primaryButtonText}>
                    {isCompleting ? "완료 중" : "일기쓰기 완료"}
                  </Text>
                </Pressable>
                <View style={styles.feedbackSecondaryRow}>
                  <Pressable style={styles.outlineButton} onPress={handleStartRewrite}>
                    <Text style={styles.outlineButtonText}>다시 써보기</Text>
                  </Pressable>
                  <Pressable style={styles.ghostButton} onPress={handleNewDiary}>
                    <Text style={styles.ghostButtonText}>새 일기</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                onPress={() => void handleRequestFeedback(step === "rewrite" ? "REWRITE" : "INITIAL")}
                disabled={!canSubmit}
              >
                <Text style={styles.primaryButtonText}>
                  {step === "rewrite" ? "다시 쓴 일기 피드백 받기" : "AI 피드백 받기"}
                </Text>
              </Pressable>
            )}
          </View>

          {initialEntryId && entryId ? (
            <View style={styles.deleteArea}>
              <Pressable
                onPress={handleDeleteEntry}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="일기 삭제"
              >
                <Text style={[styles.deleteButtonText, isDeleting && styles.deleteButtonTextDisabled]}>
                  {isDeleting ? "삭제 중" : "일기 삭제"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <FeedbackLoadingOverlay
        visible={isSubmitting}
        title="영어일기를 읽고 있어요"
        message="문장 흐름과 자연스러운 표현을 함께 확인할게요."
      />
      <Modal
        visible={isCoachOpen}
        animationType="slide"
        onRequestClose={() => setIsCoachOpen(false)}
      >
        <ModalSafeAreaView style={styles.coachModalRoot}>
          <KeyboardAvoidingView
            style={styles.coachModalKeyboardFrame}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
            <View style={styles.coachModalHeader}>
              <Text style={styles.coachModalTitle}>AI 코치</Text>
              <Pressable style={styles.coachModalCloseButton} onPress={() => setIsCoachOpen(false)}>
                <Text style={styles.coachCloseText}>닫기</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.coachModalScroll}
              contentContainerStyle={styles.coachModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.coachPanel}>
                <TextInput
                  style={styles.coachInput}
                  multiline
                  textAlignVertical="top"
                  placeholder='예: "아쉬웠다"를 자연스럽게 어떻게 써?'
                  placeholderTextColor="#AE9A87"
                  value={coachQuestion}
                  onChangeText={(value) => {
                    setCoachQuestion(value);
                    setCoachHelp(null);
                    setCoachHelpError("");
                  }}
                />

                <View style={styles.coachQuickActionWrap}>
                  {diaryCoachQuickQuestions.map((question) => (
                    <Pressable
                      key={question}
                      style={styles.coachQuickChip}
                      onPress={() => {
                        setCoachQuestion(question);
                        setCoachHelp(null);
                        setCoachHelpError("");
                      }}
                    >
                      <Text style={styles.coachQuickChipText}>{question}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[styles.coachPrimaryButton, isLoadingCoachHelp && styles.primaryButtonDisabled]}
                  onPress={() => void handleRequestCoachHelp()}
                  disabled={isLoadingCoachHelp}
                >
                  {isLoadingCoachHelp ? (
                    <ActivityIndicator color="#2E2416" />
                  ) : (
                    <Text style={styles.coachPrimaryButtonText}>코치에게 물어보기</Text>
                  )}
                </Pressable>

                <Text style={styles.coachMetaText}>
                  지금 쓴 일기 내용을 참고해서 표현과 문장을 추천해 줄게요.
                </Text>

                {coachHelpError ? <Text style={styles.coachErrorText}>{coachHelpError}</Text> : null}

                {coachHelp ? (
                  <View style={styles.coachResultStack}>
                    <View style={styles.coachReplyCard}>
                      <Text style={styles.coachReplyBadge}>코치 답변</Text>
                      <Text style={styles.coachReplyText}>{coachHelp.coachReply}</Text>
                    </View>

                    <View style={styles.coachExpressionList}>
                      {coachHelp.expressions.map((expression, index) => {
                        const normalizedKey = normalizeExpressionKey(expression.expression);
                        const isSaved = savedCoachExpressionKeys.includes(normalizedKey);
                        const isSaving = savingCoachExpressionKeys.includes(normalizedKey);

                        return (
                          <View key={`${expression.id}-${index}`} style={styles.coachExpressionCard}>
                            <Text style={styles.coachExpressionText}>{expression.expression}</Text>
                            <Text style={styles.coachExpressionMeaning}>{expression.meaningKo}</Text>
                            <Text style={styles.coachExpressionTip}>{expression.usageTip}</Text>
                            <Text style={styles.coachExpressionExample}>{expression.example}</Text>
                            <View style={styles.coachExpressionActionRow}>
                              <Pressable
                                style={styles.coachExpressionInsertButton}
                                onPress={() => appendCoachExpression(expression.expression)}
                              >
                                <Text style={styles.coachExpressionInsertButtonText}>일기에 넣기</Text>
                              </Pressable>
                              <Pressable
                                style={[
                                  styles.coachExpressionSaveButton,
                                  isSaved && styles.coachExpressionSaveButtonSaved
                                ]}
                                onPress={() => void handleSaveCoachExpression(expression)}
                                disabled={isSaved || isSaving}
                              >
                                <Text
                                  style={[
                                    styles.coachExpressionSaveButtonText,
                                    isSaved && styles.coachExpressionSaveButtonTextSaved
                                  ]}
                                >
                                  {isSaving ? "저장 중" : isSaved ? "저장됨" : "저장"}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </ModalSafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  keyboardFrame: {
    flex: 1
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 16
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loginGate: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#232128"
  },
  loginBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#756758"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
    color: "#2F312D"
  },
  headerSpacer: {
    width: 42,
    height: 42
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
  introCard: {
    borderRadius: 28,
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#E8D7C4",
    padding: 20,
    gap: 8
  },
  introTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    color: "#25211E",
    letterSpacing: -0.7
  },
  introBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#746656"
  },
  metaCard: {
    borderRadius: 26,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 10
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#9A611E"
  },
  metaInput: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#2A2620"
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  moodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  moodChipActive: {
    borderColor: "#F3A13E",
    backgroundColor: "#FFF0D7"
  },
  moodChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7D6A55"
  },
  moodChipTextActive: {
    color: "#A15F10"
  },
  readMetaCard: {
    borderRadius: 28,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 20,
    gap: 12
  },
  readMetaTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  readMetaEyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    color: "#9A611E",
    letterSpacing: 1.1
  },
  readMetaDate: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8D7A65"
  },
  readMetaTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900",
    color: "#25211E",
    letterSpacing: -0.7
  },
  readMoodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  readMoodChip: {
    alignSelf: "flex-start",
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 13,
    paddingVertical: 0
  },
  readMoodChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: "#7D6A55",
    includeFontPadding: false,
    textAlignVertical: "center"
  },
  readDiaryPaper: {
    borderRadius: 18,
    backgroundColor: "#FFFDF6",
    borderWidth: 1,
    borderColor: "#EEE1CE",
    borderStyle: "dashed",
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 16,
    shadowColor: "#8A6431",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  readDiaryLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#9A611E"
  },
  readDiaryNotebook: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#FFFDF7",
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 2
  },
  readDiaryNotebookLines: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 28
  },
  readDiaryNotebookLine: {
    height: 30,
    borderTopWidth: 1,
    borderTopColor: "#D8C4AA"
  },
  readDiaryText: {
    fontSize: 18,
    lineHeight: 30,
    color: "#25211E",
    letterSpacing: -0.1,
    paddingBottom: 2
  },
  readDiaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  readDiaryWordCount: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8D7A65"
  },
  readDiaryStatus: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: "900",
    color: "#A15F10",
    overflow: "hidden"
  },
  readFeedbackArea: {
    gap: 12
  },
  readFeedbackToggle: {
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  readFeedbackToggleText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  readFeedbackToggleIcon: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900",
    color: "#A15F10"
  },
  editorCard: {
    position: "relative",
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    gap: 12
  },
  diaryInputWrap: {
    position: "relative"
  },
  diaryInput: {
    minHeight: 260,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EADCCB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    lineHeight: 26,
    color: "#25211E"
  },
  editorFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  wordCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8D7A65"
  },
  diaryCoachTrigger: {
    position: "absolute",
    right: 16,
    bottom: 10,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 58,
    minHeight: 58,
    zIndex: 5
  },
  diaryCoachTriggerWithBubble: {
    minWidth: 204
  },
  diaryCoachBubble: {
    position: "absolute",
    right: 12,
    bottom: 70,
    width: 188,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    paddingHorizontal: 13,
    paddingVertical: 10,
    shadowColor: "#C1761E",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  diaryCoachBubbleText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
    color: "#7B5A35"
  },
  diaryCoachBubbleTail: {
    position: "absolute",
    right: 20,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    transform: [{ rotate: "45deg" }]
  },
  diaryCoachMascotFrame: {
    width: 58,
    height: 58,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#C1761E",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  diaryCoachMascot: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(193, 118, 30, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.96)"
  },
  saveDraftButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  saveDraftButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  feedbackCard: {
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D4BE",
    padding: 18,
    gap: 16
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  feedbackHeaderCopy: {
    flex: 1
  },
  feedbackTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    color: "#25211E"
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  scoreBadgeText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2A1603"
  },
  feedbackSummary: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6F5E4D"
  },
  feedbackSection: {
    borderTopWidth: 1,
    borderTopColor: "#DECBB5",
    paddingTop: 14,
    gap: 10
  },
  innerDivider: {
    borderTopWidth: 1,
    borderTopColor: "#E1CFBA",
    paddingTop: 14,
    marginTop: 4
  },
  sectionLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2620"
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  sectionHeadingBar: {
    width: 6,
    height: 31,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  sectionHeadingText: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    color: "#25211E"
  },
  bulletList: {
    gap: 6
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5B4A3B"
  },
  fixPointCard: {
    paddingBottom: 4,
    gap: 8
  },
  fixPointTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  repairBox: {
    gap: 6
  },
  originalText: {
    borderRadius: 14,
    backgroundColor: "#FFF0EC",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#A84228"
  },
  revisedText: {
    borderRadius: 14,
    backgroundColor: "#EEF8ED",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#2E6C35"
  },
  diaryRemovedText: {
    color: "#B23A22",
    backgroundColor: "#FFD9D2",
    borderRadius: 6,
    paddingHorizontal: 2,
    fontWeight: "900"
  },
  diaryAddedText: {
    color: "#1F6B32",
    backgroundColor: "#DDF3DF",
    borderRadius: 6,
    paddingHorizontal: 2,
    fontWeight: "900"
  },
  fixPointSupport: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F5E4D"
  },
  expressionList: {
    gap: 0
  },
  expressionChip: {
    paddingVertical: 2,
    gap: 5
  },
  expressionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  expressionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  expressionMeaning: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    color: "#7C6545"
  },
  expressionSaveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  expressionSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  ideaCard: {
    paddingBottom: 6,
    gap: 8
  },
  flowGrid: {
    gap: 0
  },
  flowSubCard: {
    paddingBottom: 4,
    gap: 7
  },
  flowSubTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  flowItemText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F5E4D"
  },
  flowItemLabel: {
    fontWeight: "900",
    color: "#8A6431"
  },
  ideaTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  ideaNote: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A6856"
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#8B735A",
    fontStyle: "italic"
  },
  variantCard: {
    borderTopWidth: 1,
    borderTopColor: "#DECBB5",
    paddingTop: 14,
    gap: 8
  },
  variantTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#C2761B"
  },
  challengeCard: {
    borderTopWidth: 1,
    borderTopColor: "#DECBB5",
    paddingTop: 14,
    gap: 4
  },
  challengeLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#C2761B"
  },
  challengeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4D4035"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F0E7"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    minHeight: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E6D8C8"
  },
  coachModalTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    color: "#25211E",
    letterSpacing: -0.6
  },
  coachModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  coachCloseText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  coachModalScroll: {
    flex: 1
  },
  coachModalScrollContent: {
    padding: 18,
    paddingBottom: 32
  },
  coachPanel: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14
  },
  coachInput: {
    minHeight: 112,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 23,
    color: "#25211E"
  },
  coachQuickActionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachQuickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  coachQuickChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#7D6A55"
  },
  coachPrimaryButton: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  coachPrimaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#21160A"
  },
  coachMetaText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8D7A65"
  },
  coachErrorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#B33A22"
  },
  coachResultStack: {
    gap: 12
  },
  coachReplyCard: {
    borderRadius: 20,
    backgroundColor: "#FFF6E8",
    borderWidth: 1,
    borderColor: "#EAD0A8",
    padding: 14,
    gap: 8
  },
  coachReplyBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "900",
    color: "#9A611E"
  },
  coachReplyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4D4035"
  },
  coachExpressionList: {
    gap: 10
  },
  coachExpressionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 14,
    gap: 7
  },
  coachExpressionText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
    color: "#25211E"
  },
  coachExpressionMeaning: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8A6431"
  },
  coachExpressionTip: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6F5E4D"
  },
  coachExpressionExample: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8B735A",
    fontStyle: "italic"
  },
  coachExpressionActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  coachExpressionInsertButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  coachExpressionInsertButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#21160A"
  },
  coachExpressionSaveButton: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  coachExpressionSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachExpressionSaveButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  coachExpressionSaveButtonTextSaved: {
    color: "#2E6C35"
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  feedbackActionStack: {
    gap: 10
  },
  feedbackSecondaryRow: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryButtonDisabled: {
    opacity: 0.45
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#21160A"
  },
  outlineButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A6431"
  },
  secondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#21160A"
  },
  ghostButton: {
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A6431"
  },
  deleteArea: {
    alignItems: "flex-end",
    paddingTop: 2,
    paddingRight: 4
  },
  deleteButtonText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#A84228",
    textDecorationLine: "underline"
  },
  deleteButtonTextDisabled: {
    opacity: 0.45
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  }
});
