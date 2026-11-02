import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import ProblemReportLink from "@/components/problem-report-link";
import { buildLoginHref } from "@/lib/login-redirect";
import { MOOD_OPTIONS, normalizeExpressionKey } from "./diary-entry-helpers";
import { DiaryFeedbackPanel } from "./diary-feedback-panel";
import type { DiaryEntryScreenValues } from "./diary-entry-screen-values";
import { styles } from "./diary-entry-styles";

const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

type DiaryReadOnlyContentProps = Pick<
  DiaryEntryScreenValues,
  | "content"
  | "displayMoodTags"
  | "displayTitle"
  | "entryDate"
  | "error"
  | "feedback"
  | "handleHeaderBackPress"
  | "handleToggleDiaryExpression"
  | "isReadOnlyFeedbackOpen"
  | "readOnlyWordCount"
  | "savedExpressionIdsByKey"
  | "savingExpressionKeys"
  | "setIsReadOnlyFeedbackOpen"
>;
type DiaryLoadFailedStateProps = Pick<
  DiaryEntryScreenValues,
  | "error"
  | "handleBackToDiaryList"
  | "handleRetryLoadEntry"
>;
type DiaryDeleteAreaProps = Pick<
  DiaryEntryScreenValues,
  | "handleDeleteEntry"
  | "isDeleting"
>;
type DiaryEditorHeaderProps = Pick<
  DiaryEntryScreenValues,
  | "handleHeaderBackPress"
  | "initialEntryId"
>;
type DiaryMetaCardProps = Pick<
  DiaryEntryScreenValues,
  | "defaultTitle"
  | "entryDate"
  | "handleEntryDateChange"
  | "handleToggleMoodTag"
  | "selectedMoodTags"
  | "setTitle"
  | "title"
>;
type DiaryEditorCardProps = Pick<
  DiaryEntryScreenValues,
  | "content"
  | "diaryInputRef"
  | "editorYRef"
  | "handleSaveDraft"
  | "isCoachOpen"
  | "isSaving"
  | "rewriteText"
  | "setContent"
  | "setIsCoachOpen"
  | "setRewriteText"
  | "step"
  | "wordCount"
>;
type DiaryActionRowProps = Pick<
  DiaryEntryScreenValues,
  | "canSubmit"
  | "feedback"
  | "handleCompleteDiary"
  | "handleNewDiary"
  | "handleRequestFeedback"
  | "handleStartRewrite"
  | "isCompleting"
  | "step"
>;
type DiaryCoachModalProps = Pick<
  DiaryEntryScreenValues,
  | "appendCoachExpression"
  | "coachHelp"
  | "coachHelpError"
  | "coachQuestion"
  | "diaryCoachQuickQuestions"
  | "handleRequestCoachHelp"
  | "handleSaveCoachExpression"
  | "isCoachOpen"
  | "isLoadingCoachHelp"
  | "savedCoachExpressionKeys"
  | "savingCoachExpressionKeys"
  | "setCoachHelp"
  | "setCoachHelpError"
  | "setCoachQuestion"
  | "setIsCoachOpen"
>;

// 불러오는 중 표시
export function DiaryLoadingState() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.loadingState}>
        <ActivityIndicator color="#E38B12" />
      </View>
    </SafeAreaView>
  );
}

// 로그인 안내
export function DiaryLoginGate() {
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

// 기존 일기를 불러오지 못했을 때: 오류 문구, 다시 시도, 일기 목록으로. 편집 화면을 보이지 않아
// 불러오지 못한 일기를 빈 내용으로 덮어쓰지 않게 한다.
export function DiaryLoadFailedState({
  error,
  handleBackToDiaryList,
  handleRetryLoadEntry
}: DiaryLoadFailedStateProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.loginGate}>
        <Text style={styles.loginTitle}>일기를 열지 못했어요</Text>
        <Text style={styles.loginBody}>{error}</Text>
        <View style={styles.loadFailedActions}>
          <Pressable accessibilityRole="button" style={styles.ghostButton} onPress={handleBackToDiaryList}>
            <Text style={styles.ghostButtonText}>일기 목록으로</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={handleRetryLoadEntry}>
            <Text style={styles.primaryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// 읽기 전용 화면: 머리, 날짜·제목·기분, 공책 본문, 피드백 펼치기, 오류
export function DiaryReadOnlyContent({
  content,
  displayMoodTags,
  displayTitle,
  entryDate,
  error,
  feedback,
  handleHeaderBackPress,
  handleToggleDiaryExpression,
  isReadOnlyFeedbackOpen,
  readOnlyWordCount,
  savedExpressionIdsByKey,
  savingExpressionKeys,
  setIsReadOnlyFeedbackOpen
}: DiaryReadOnlyContentProps) {
  return (
    <>
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
    </>
  );
}

// 일기 삭제(읽기 전용과 편집 화면에서 같이 쓴다)
export function DiaryDeleteArea({
  handleDeleteEntry,
  isDeleting
}: DiaryDeleteAreaProps) {
  return (
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
  );
}

// 편집 화면 머리
export function DiaryEditorHeader({
  handleHeaderBackPress,
  initialEntryId
}: DiaryEditorHeaderProps) {
  return (
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
  );
}

// 소개 카드
export function DiaryIntroCard() {
  return (
    <View style={styles.introCard}>
      <Text style={styles.introTitle}>오늘을 영어로 남겨보세요.</Text>
      <Text style={styles.introBody}>
        짧게 써도 괜찮아요. AI가 자연스럽게 다듬어 줄게요.
      </Text>
    </View>
  );
}

// 날짜·제목·기분 입력
export function DiaryMetaCard({
  defaultTitle,
  entryDate,
  handleEntryDateChange,
  handleToggleMoodTag,
  selectedMoodTags,
  setTitle,
  title
}: DiaryMetaCardProps) {
  return (
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
  );
}

// 본문 입력, AI 코치 열기, 단어 수와 임시저장
export function DiaryEditorCard({
  content,
  diaryInputRef,
  editorYRef,
  handleSaveDraft,
  isCoachOpen,
  isSaving,
  rewriteText,
  setContent,
  setIsCoachOpen,
  setRewriteText,
  step,
  wordCount
}: DiaryEditorCardProps) {
  return (
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
  );
}

// 버튼 줄: 피드백 받기 또는 완료·다시 써보기·새 일기
export function DiaryActionRow({
  canSubmit,
  feedback,
  handleCompleteDiary,
  handleNewDiary,
  handleRequestFeedback,
  handleStartRewrite,
  isCompleting,
  step
}: DiaryActionRowProps) {
  return (
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
  );
}

// AI 코치 창
export function DiaryCoachModal({
  appendCoachExpression,
  coachHelp,
  coachHelpError,
  coachQuestion,
  diaryCoachQuickQuestions,
  handleRequestCoachHelp,
  handleSaveCoachExpression,
  isCoachOpen,
  isLoadingCoachHelp,
  savedCoachExpressionKeys,
  savingCoachExpressionKeys,
  setCoachHelp,
  setCoachHelpError,
  setCoachQuestion,
  setIsCoachOpen
}: DiaryCoachModalProps) {
  return (
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
  );
}
