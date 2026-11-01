import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedbackLoadingOverlay from "@/components/feedback-loading-overlay";
import {
  DiaryActionRow,
  DiaryCoachModal,
  DiaryDeleteArea,
  DiaryEditorCard,
  DiaryEditorHeader,
  DiaryIntroCard,
  DiaryLoadingState,
  DiaryLoginGate,
  DiaryMetaCard,
  DiaryReadOnlyContent
} from "@/components/diary-entry/diary-entry-sections";
import { DiaryFeedbackPanel } from "@/components/diary-entry/diary-feedback-panel";
import {
  type DiaryEntryScreenProps,
  type DiaryStep,
  type DiaryEditableState,
  buildDiaryEditableSignature,
  todayDateKey,
  countWords,
  getLatestFeedback,
  getLatestAttemptText,
  formatDiaryDate,
  buildDefaultDiaryTitle,
  normalizeExpressionKey,
  normalizeMoodTags,
  getDiaryMoodTags
} from "@/components/diary-entry/diary-entry-helpers";
import { styles } from "@/components/diary-entry/diary-entry-styles";
import { useDiaryCoach } from "@/components/diary-entry/use-diary-coach";
import { useDiaryExpressions } from "@/components/diary-entry/use-diary-expressions";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntry,
  requestDiaryFeedback,
  updateDiaryEntry
} from "@/lib/api";
import { deleteDiaryDraft, getDiaryDraft, saveDiaryDraft, type DiaryDraft } from "@/lib/diary-drafts";
import { useSession } from "@/lib/session";
import type { DiaryFeedback } from "@/lib/types";

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
  // 임시 저장: 서버에 저장된 상태의 서명, 화면을 떠날 때 저장할 최신 임시본, 불러오기를 마쳤는지
  const savedSignatureRef = useRef("");
  const latestDraftRef = useRef<DiaryDraft | null>(null);
  const isDraftReadyRef = useRef(false);

  const activeText = step === "rewrite" ? rewriteText : content;
  const wordCount = useMemo(() => countWords(activeText), [activeText]);
  const canSubmit = wordCount > 0 && !isReadOnly && !isSubmitting && !isSaving && !isCompleting && !isDeleting;
  const defaultTitle = useMemo(() => buildDefaultDiaryTitle(entryDate), [entryDate]);
  const displayTitle = title.trim() || defaultTitle;
  const displayMoodTags = useMemo(() => normalizeMoodTags(selectedMoodTags), [selectedMoodTags]);
  const readOnlyWordCount = useMemo(() => countWords(content), [content]);
  const {
    coachHelp,
    coachHelpError,
    coachQuestion,
    diaryCoachQuickQuestions,
    handleRequestCoachHelp,
    isLoadingCoachHelp,
    setCoachHelp,
    setCoachHelpError,
    setCoachQuestion
  } = useDiaryCoach({
    activeText,
    setIsCoachOpen,
    step
  });

  useEffect(() => {
    let cancelled = false;

    async function loadEntry() {
      if (!initialEntryId) {
        setIsLoading(false);
        const today = todayDateKey();
        await prepareDiaryDraft(
          "",
          { entryDate: today, title: buildDefaultDiaryTitle(today), moodTags: [], content: "", rewriteText: "" },
          false,
          () => cancelled
        );
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
        if (entry.draft) {
          await prepareDiaryDraft(
            entry.entryId,
            {
              entryDate: loadedDate,
              title: loadedTitle || buildDefaultDiaryTitle(loadedDate),
              moodTags: getDiaryMoodTags(entry),
              content: entry.content ?? "",
              rewriteText: latestText || entry.content || ""
            },
            Boolean(latestFeedback),
            () => cancelled
          );
        }
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

  const {
    handleSaveCoachExpression,
    handleToggleDiaryExpression,
    savedCoachExpressionKeys,
    savedExpressionIdsByKey,
    savingCoachExpressionKeys,
    savingExpressionKeys
  } = useDiaryExpressions({
    currentUser,
    initialEntryId
  });

  // 쓰는 동안 잠깐 멈추면 기기에 임시 저장한다. 서버에 저장된 상태와 같아지면 임시본을 지운다.
  useEffect(() => {
    if (isLoading || isReadOnly || !isDraftReadyRef.current) {
      return undefined;
    }

    const draft: DiaryDraft = {
      entryId,
      entryDate,
      title,
      moodTags: selectedMoodTags,
      content,
      rewriteText,
      step: step === "rewrite" ? "rewrite" : "write",
      updatedAt: new Date().toISOString()
    };
    const hasUnsavedChanges = buildDiaryEditableSignature(draft) !== savedSignatureRef.current;
    latestDraftRef.current = hasUnsavedChanges ? draft : null;
    const timer = setTimeout(() => {
      if (hasUnsavedChanges) {
        void saveDiaryDraft(draft).catch(() => undefined);
      } else {
        void deleteDiaryDraft(entryId).catch(() => undefined);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [entryId, entryDate, title, selectedMoodTags, content, rewriteText, step, isLoading, isReadOnly]);

  // 앱이 백그라운드로 가거나 화면을 떠날 때는 기다리지 않고 바로 저장한다.
  useEffect(() => {
    function flushDiaryDraft() {
      const draft = latestDraftRef.current;
      if (draft) {
        void saveDiaryDraft(draft).catch(() => undefined);
      }
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        flushDiaryDraft();
      }
    });
    return () => {
      subscription.remove();
      flushDiaryDraft();
    };
  }, []);

  // 서버에 저장된 상태를 기준으로 잡고, 이 기기에 저장하지 않은 임시본이 있으면 이어서 쓸지 묻는다.
  async function prepareDiaryDraft(
    draftEntryId: string,
    savedState: DiaryEditableState,
    canRewrite: boolean,
    isCancelled: () => boolean
  ) {
    savedSignatureRef.current = buildDiaryEditableSignature(savedState);
    const draft = await getDiaryDraft(draftEntryId).catch(() => null);
    if (isCancelled()) {
      return;
    }
    if (!draft || buildDiaryEditableSignature(draft) === savedSignatureRef.current) {
      if (draft) {
        void deleteDiaryDraft(draftEntryId).catch(() => undefined);
      }
      isDraftReadyRef.current = true;
      return;
    }

    Alert.alert(
      "저장하지 않은 일기가 있어요",
      "이 기기에 임시 저장된 내용을 이어서 쓸까요?",
      [
        {
          text: "버리기",
          style: "destructive",
          onPress: () => {
            void deleteDiaryDraft(draftEntryId).catch(() => undefined);
            isDraftReadyRef.current = true;
          }
        },
        {
          text: "이어서 쓰기",
          onPress: () => {
            isDraftReadyRef.current = true;
            setEntryDate(draft.entryDate);
            setTitle(draft.title);
            setSelectedMoodTags(draft.moodTags);
            setContent(draft.content);
            setRewriteText(draft.rewriteText);
            setStep(draft.step === "rewrite" && canRewrite ? "rewrite" : "write");
          }
        }
      ],
      { cancelable: false }
    );
  }

  // 서버에 저장한 뒤 기준점을 새로 잡고 임시본을 지운다.
  function markDiarySaved(savedEntryId: string, savedState: DiaryEditableState) {
    savedSignatureRef.current = buildDiaryEditableSignature(savedState);
    latestDraftRef.current = null;
    void deleteDiaryDraft(savedEntryId).catch(() => undefined);
  }

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
    // 새 일기로 쓰던 임시본은 이제 이 일기의 것이다. 이후 임시본은 새 entryId로 저장한다.
    void deleteDiaryDraft("").catch(() => undefined);
    return created;
  }

  function currentEditableState(overrides: Partial<DiaryEditableState> = {}): DiaryEditableState {
    return {
      entryDate,
      title,
      moodTags: selectedMoodTags,
      content,
      rewriteText,
      ...overrides
    };
  }

  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      setError("");
      const saved = await saveEntry(content, true);
      markDiarySaved(saved.entryId, currentEditableState());
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
      markDiarySaved(saved.entryId, currentEditableState({ content: targetText, rewriteText: targetText }));
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
    latestDraftRef.current = null;
    isDraftReadyRef.current = false;
    void prepareDiaryDraft(
      "",
      { entryDate: nextDate, title: buildDefaultDiaryTitle(nextDate), moodTags: [], content: "", rewriteText: "" },
      false,
      () => false
    );
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
      markDiarySaved(completedEntry.entryId, currentEditableState({ content: finalText }));
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
      latestDraftRef.current = null;
      void deleteDiaryDraft(entryId).catch(() => undefined);
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

  if (isHydrating || isLoading) {
    return (
      <DiaryLoadingState />
    );
  }

  if (!currentUser) {
    return (
      <DiaryLoginGate />
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
          <DiaryReadOnlyContent
            content={content}
            displayMoodTags={displayMoodTags}
            displayTitle={displayTitle}
            entryDate={entryDate}
            error={error}
            feedback={feedback}
            handleHeaderBackPress={handleHeaderBackPress}
            handleToggleDiaryExpression={handleToggleDiaryExpression}
            isReadOnlyFeedbackOpen={isReadOnlyFeedbackOpen}
            readOnlyWordCount={readOnlyWordCount}
            savedExpressionIdsByKey={savedExpressionIdsByKey}
            savingExpressionKeys={savingExpressionKeys}
            setIsReadOnlyFeedbackOpen={setIsReadOnlyFeedbackOpen}
          />

          {entryId ? (
            <DiaryDeleteArea
              handleDeleteEntry={handleDeleteEntry}
              isDeleting={isDeleting}
            />
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
          <DiaryEditorHeader
            handleHeaderBackPress={handleHeaderBackPress}
            initialEntryId={initialEntryId}
          />

          <DiaryIntroCard />

          <DiaryMetaCard
            defaultTitle={defaultTitle}
            entryDate={entryDate}
            handleEntryDateChange={handleEntryDateChange}
            handleToggleMoodTag={handleToggleMoodTag}
            selectedMoodTags={selectedMoodTags}
            setTitle={setTitle}
            title={title}
          />

          <DiaryEditorCard
            content={content}
            diaryInputRef={diaryInputRef}
            editorYRef={editorYRef}
            handleSaveDraft={handleSaveDraft}
            isCoachOpen={isCoachOpen}
            isSaving={isSaving}
            rewriteText={rewriteText}
            setContent={setContent}
            setIsCoachOpen={setIsCoachOpen}
            setRewriteText={setRewriteText}
            step={step}
            wordCount={wordCount}
          />

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

          <DiaryActionRow
            canSubmit={canSubmit}
            feedback={feedback}
            handleCompleteDiary={handleCompleteDiary}
            handleNewDiary={handleNewDiary}
            handleRequestFeedback={handleRequestFeedback}
            handleStartRewrite={handleStartRewrite}
            isCompleting={isCompleting}
            step={step}
          />

          {initialEntryId && entryId ? (
            <DiaryDeleteArea
              handleDeleteEntry={handleDeleteEntry}
              isDeleting={isDeleting}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <FeedbackLoadingOverlay
        visible={isSubmitting}
        title="영어일기를 읽고 있어요"
        message="문장 흐름과 자연스러운 표현을 함께 확인할게요."
      />
      <DiaryCoachModal
        appendCoachExpression={appendCoachExpression}
        coachHelp={coachHelp}
        coachHelpError={coachHelpError}
        coachQuestion={coachQuestion}
        diaryCoachQuickQuestions={diaryCoachQuickQuestions}
        handleRequestCoachHelp={handleRequestCoachHelp}
        handleSaveCoachExpression={handleSaveCoachExpression}
        isCoachOpen={isCoachOpen}
        isLoadingCoachHelp={isLoadingCoachHelp}
        savedCoachExpressionKeys={savedCoachExpressionKeys}
        savingCoachExpressionKeys={savingCoachExpressionKeys}
        setCoachHelp={setCoachHelp}
        setCoachHelpError={setCoachHelpError}
        setCoachQuestion={setCoachQuestion}
        setIsCoachOpen={setIsCoachOpen}
      />
    </SafeAreaView>
  );
}

