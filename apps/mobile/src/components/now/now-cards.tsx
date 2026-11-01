import { ActivityIndicator, Pressable, Text, View } from "react-native";
import ProblemReportLink from "@/components/problem-report-link";
import {
  formatNowInEnglishTime,
  type NowInEnglishAiReflection,
  type NowInEnglishAiReflectionExpression,
  type NowInEnglishEntry,
  type NowInEnglishIntervalHours
} from "@/lib/now-in-english";
import type { NowInEnglishCoachFeedbackResponse } from "@/lib/types";
import { type NowInEnglishEntryGroup, hasUsefulCoachSuggestion } from "./now-helpers";
import { styles } from "./now-styles";

// Now in English 화면의 카드와 조절 버튼: 기록 타임라인, 돌아보기 카드, 바로 코치 피드백 카드, 조용한 시간·알림 간격 조절.
export function EntryTimeline({
  groups,
  emptyTitle,
  emptyBody
}: {
  groups: NowInEnglishEntryGroup[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (groups.length === 0) {
    return (
      <View style={styles.emptyListCard}>
        <Text style={styles.emptyListTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyListBody}>{emptyBody}</Text>
      </View>
    );
  }

  return (
    <View style={styles.timelineList}>
      {groups.map((group) => (
        <View key={group.dateKey} style={styles.timelineGroup}>
          <View style={styles.timelineGroupHeader}>
            <Text style={styles.timelineDateLabel}>{group.label}</Text>
            <Text style={styles.timelineCount}>{group.entries.length}개 남겼어요</Text>
          </View>
          <View style={styles.entryList}>
            {group.entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <Text style={styles.entryTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
                {entry.polishedFromText ? (
                  <View style={styles.polishedComparison}>
                    <Text style={styles.polishedKicker}>다듬은 문장</Text>
                    <View style={styles.polishedRow}>
                      <Text style={styles.polishedLabel}>수정 전</Text>
                      <Text style={styles.polishedBeforeText}>{entry.polishedFromText}</Text>
                    </View>
                    <View style={[styles.polishedRow, styles.polishedAfterRow]}>
                      <Text style={styles.polishedLabel}>수정 후</Text>
                      <Text style={styles.polishedAfterText}>{entry.text}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.entryText}>{entry.text}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function YesterdayReflectionCard({
  entries,
  dateLabel,
  aiReflection,
  isLoadingAiReflection,
  aiReflectionError,
  onWriteToday,
  onToggleExpression,
  isExpressionSaved,
  isSavingExpression
}: {
  entries: NowInEnglishEntry[];
  dateLabel: string;
  aiReflection: NowInEnglishAiReflection | null;
  isLoadingAiReflection: boolean;
  aiReflectionError: string;
  onWriteToday: () => void;
  onToggleExpression: (expression: NowInEnglishAiReflectionExpression) => void;
  isExpressionSaved: (expression: string) => boolean;
  isSavingExpression: (expression: string) => boolean;
}) {
  const hasReflectionExpressions = (aiReflection?.expressions.length ?? 0) > 0;

  return (
    <View style={styles.reflectionStack}>
      <View style={styles.reflectionCard}>
        <Text style={styles.reflectionKicker}>{dateLabel}의 영어 조각</Text>
        <Text style={styles.reflectionTitle}>{dateLabel} {entries.length}개의 순간을 영어로 남겼어요.</Text>
        <Text style={styles.reflectionBody}>그날의 생각이 이렇게 남아 있어요.</Text>

        <View style={styles.reflectionHighlight}>
          <Text style={styles.reflectionHighlightLabel}>남긴 문장</Text>
          <View style={styles.reflectionSentenceList}>
            {entries.map((entry, index) => (
              <View
                key={entry.id}
                style={[styles.reflectionSentenceItem, index > 0 && styles.reflectionSentenceItemWithBorder]}
              >
                <Text style={styles.reflectionTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
                <Text style={styles.reflectionEntryText}>{entry.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.reflectionAiCard}>
        <View style={styles.reflectionAiHeader}>
          <Text style={styles.reflectionAiKicker}>AI 회고</Text>
          {isLoadingAiReflection ? <ActivityIndicator size="small" color="#EA920D" /> : null}
        </View>

        {aiReflection ? (
          <>
            <Text style={styles.reflectionAiTitle}>{aiReflection.headlineKo}</Text>
            <Text style={styles.reflectionAiBody}>{aiReflection.summaryKo}</Text>

            {aiReflection.highlightsKo.length > 0 ? (
              <View style={styles.reflectionFeedbackBox}>
                <Text style={styles.reflectionInsightLabel}>잘 남긴 점</Text>
                {aiReflection.highlightsKo.map((highlight, index) => (
                  <View key={`${highlight}-${index}`} style={styles.reflectionHighlightItem}>
                    <Text style={styles.reflectionHighlightBullet}>{index + 1}</Text>
                    <Text style={styles.reflectionHighlightItemText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {aiReflection.patternKo ? (
              <View style={styles.reflectionPlainSection}>
                <Text style={styles.reflectionInsightLabel}>오늘의 흐름</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.patternKo}</Text>
              </View>
            ) : null}

            {aiReflection.gentleCorrectionKo ? (
              <View style={styles.reflectionPlainSection}>
                <Text style={styles.reflectionInsightLabel}>가볍게 다듬기</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.gentleCorrectionKo}</Text>
              </View>
            ) : null}

            {aiReflection.nextActionKo ? (
              <View style={styles.reflectionPlainSection}>
                <Text style={styles.reflectionInsightLabel}>다음에 살 붙여보기</Text>
                <Text style={styles.reflectionInsightText}>{aiReflection.nextActionKo}</Text>
                {aiReflection.nextActionExampleEn ? (
                  <Text style={styles.reflectionNextActionExample}>{aiReflection.nextActionExampleEn}</Text>
                ) : null}
              </View>
            ) : null}

            {hasReflectionExpressions ? (
              <View style={styles.reflectionExpressionList}>
                <Text style={styles.reflectionExpressionTitle}>다음에 써먹을 표현</Text>
                {aiReflection.expressions.map((expression, index) => (
                  <View
                    key={`${expression.expression}-${index}`}
                    style={[
                      styles.reflectionExpressionCard,
                      index > 0 && styles.reflectionExpressionItemWithBorder
                    ]}
                  >
                    <View style={styles.reflectionExpressionHeader}>
                      <Text style={styles.reflectionExpressionText}>{expression.expression}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isExpressionSaved(expression.expression) ? "저장한 표현 취소" : "표현 저장"
                        }
                        style={[
                          styles.reflectionExpressionSaveButton,
                          isExpressionSaved(expression.expression) && styles.reflectionExpressionSaveButtonSaved
                        ]}
                        onPress={() => onToggleExpression(expression)}
                        disabled={isSavingExpression(expression.expression)}
                      >
                        <Text
                          style={[
                            styles.reflectionExpressionSaveText,
                            isExpressionSaved(expression.expression) && styles.reflectionExpressionSaveTextSaved
                          ]}
                        >
                          {isSavingExpression(expression.expression)
                            ? "저장 중"
                            : isExpressionSaved(expression.expression)
                              ? "저장됨"
                              : "저장"}
                        </Text>
                      </Pressable>
                    </View>
                    {expression.meaningKo ? (
                      <Text style={styles.reflectionExpressionMeaning}>{expression.meaningKo}</Text>
                    ) : null}
                    {expression.example ? (
                      <Text style={styles.reflectionExpressionExample}>{expression.example}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {aiReflection.closingKo ? (
              <Text style={styles.reflectionAiClosing}>{aiReflection.closingKo}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.reflectionAiBody}>
            {isLoadingAiReflection
              ? "남긴 문장들을 살펴보고 있어요."
              : "이 날의 기록을 AI가 짧게 돌아봐 줄 수 있어요."}
          </Text>
        )}

        {aiReflectionError ? (
          <View>
            <Text style={styles.reflectionAiError}>{aiReflectionError}</Text>
            <ProblemReportLink source="now_reflection" errorCode="NOW_REFLECTION_ERROR" />
          </View>
        ) : null}
      </View>

      <Pressable style={styles.reflectionButton} onPress={onWriteToday}>
        <Text style={styles.reflectionButtonText}>오늘도 한 줄 남기기</Text>
      </Pressable>
    </View>
  );
}

export function InstantCoachFeedbackCard({
  entry,
  feedback,
  isLoading,
  error,
  onAskCoach,
  onRevise,
  onKeep,
  onRetry
}: {
  entry: NowInEnglishEntry;
  feedback: NowInEnglishCoachFeedbackResponse | null;
  isLoading: boolean;
  error: string;
  onAskCoach: () => void;
  onRevise: () => void;
  onKeep: () => void;
  onRetry: () => void;
}) {
  const hasUsefulSuggestion = feedback ? hasUsefulCoachSuggestion(entry.text, feedback.suggestionEn) : false;

  return (
    <View style={styles.instantCoachCard}>
      <View style={styles.instantCoachHeader}>
        <Text style={styles.instantCoachKicker}>방금 문장 AI 코치</Text>
        {isLoading ? <ActivityIndicator size="small" color="#EA920D" /> : null}
      </View>

      <Text style={styles.instantCoachOriginal}>{entry.text}</Text>

      {feedback ? (
        <>
          <Text style={styles.instantCoachTitle}>{feedback.headlineKo}</Text>
          <Text style={styles.instantCoachBody}>{feedback.praiseKo}</Text>

          {hasUsefulSuggestion ? (
            <View style={styles.instantCoachSuggestionBox}>
              <Text style={styles.instantCoachLabel}>이렇게도 말해요</Text>
              <Text style={styles.instantCoachSuggestion}>{feedback.suggestionEn}</Text>
              {feedback.suggestionTranslationKo ? (
                <Text style={styles.instantCoachSuggestionTranslation}>{feedback.suggestionTranslationKo}</Text>
              ) : null}
            </View>
          ) : null}

          {hasUsefulSuggestion && feedback.suggestionKo ? (
            <View style={styles.instantCoachSection}>
              <Text style={styles.instantCoachSectionLabel}>왜 이렇게 말하나요</Text>
              <Text style={styles.instantCoachSectionBody}>{feedback.suggestionKo}</Text>
            </View>
          ) : null}

          {feedback.nextQuestionKo ? (
            <View style={styles.instantCoachSection}>
              <Text style={styles.instantCoachSectionLabel}>살 더 붙여보기</Text>
              <Text style={styles.instantCoachInstruction}>{feedback.nextQuestionKo}</Text>
            </View>
          ) : null}

          {feedback.expression ? (
            <View style={styles.instantCoachExpression}>
              <Text style={styles.instantCoachExpressionText}>{feedback.expression}</Text>
              {feedback.expressionMeaningKo ? (
                <Text style={styles.instantCoachExpressionMeaning}>{feedback.expressionMeaningKo}</Text>
              ) : null}
              {feedback.expressionExampleEn ? (
                <Text style={styles.instantCoachExpressionExample}>{feedback.expressionExampleEn}</Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.instantCoachBody}>
          {isLoading ? "저장은 끝났고, AI가 문장을 짧게 살펴보고 있어요." : "저장은 완료됐어요."}
        </Text>
      )}

      {error ? (
        <View>
          <Text style={styles.instantCoachError}>{error}</Text>
          <ProblemReportLink source="now_coach" errorCode="NOW_COACH_ERROR" />
        </View>
      ) : null}

      {!isLoading ? (
        <View style={styles.instantCoachActions}>
          {error ? (
            <Pressable style={styles.instantCoachRetryButton} onPress={onRetry}>
              <Text style={styles.instantCoachRetryButtonText}>AI 코치 다시 시도</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.instantCoachReviseButton} onPress={onRevise}>
            <Text style={styles.instantCoachReviseButtonText}>수정해보기</Text>
          </Pressable>
          <Pressable style={styles.instantCoachKeepButton} onPress={onKeep}>
            <Text style={styles.instantCoachKeepButtonText}>이대로 남기기</Text>
          </Pressable>
          <Pressable style={styles.instantCoachAskButton} onPress={onAskCoach}>
            <Text style={styles.instantCoachAskButtonText}>AI 코치에게 더 물어보기</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function QuietHourStepper({
  label,
  hour,
  onDecrease,
  onIncrease,
  disabled
}: {
  label: string;
  hour: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.quietHourStepper}>
      <Text style={styles.quietHourLabel}>{label}</Text>
      <View style={styles.quietHourControl}>
        <Pressable
          style={[styles.quietHourButton, disabled && styles.buttonDisabled]}
          onPress={onDecrease}
          disabled={disabled}
        >
          <Text style={styles.quietHourButtonText}>-</Text>
        </Pressable>
        <Text style={styles.quietHourValue}>{hour.toString().padStart(2, "0")}:00</Text>
        <Pressable
          style={[styles.quietHourButton, disabled && styles.buttonDisabled]}
          onPress={onIncrease}
          disabled={disabled}
        >
          <Text style={styles.quietHourButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ReminderIntervalStepper({
  intervalHours,
  onDecrease,
  onIncrease,
  disabled
}: {
  intervalHours: NowInEnglishIntervalHours;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.intervalStepper}>
      <Text style={styles.intervalStepperLabel}>알림 주기</Text>
      <View style={styles.intervalStepperControl}>
        <Pressable
          style={[styles.intervalStepperButton, disabled && styles.buttonDisabled]}
          onPress={onDecrease}
          disabled={disabled || intervalHours <= 1}
        >
          <Text style={styles.intervalStepperButtonText}>-</Text>
        </Pressable>
        <Text style={styles.intervalStepperValue}>{intervalHours}시간마다</Text>
        <Pressable
          style={[styles.intervalStepperButton, disabled && styles.buttonDisabled]}
          onPress={onIncrease}
          disabled={disabled || intervalHours >= 12}
        >
          <Text style={styles.intervalStepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
