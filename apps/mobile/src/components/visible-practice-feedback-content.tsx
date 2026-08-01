import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";

type VisiblePracticeFeedbackContentProps = {
  feedbackState: PracticeFeedbackState;
};

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

export function VisiblePracticeFeedbackContent({
  feedbackState
}: VisiblePracticeFeedbackContentProps) {
  const [isModelAnswerOpen, setIsModelAnswerOpen] = useState(false);
  const [areAllLanguageCorrectionsVisible, setAreAllLanguageCorrectionsVisible] =
    useState(false);
  const snapshot = feedbackState.feedback.visibleFeedback;

  if (!snapshot) {
    return (
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          이전 형식의 피드백이라 당시 화면에 보였던 내용을 정확히 복원할 수 없어요.
        </Text>
      </View>
    );
  }

  const coachMove = snapshot.coachMove;
  const expressions = snapshot.refinementExpressions ?? [];
  const allLanguageCorrections = coachMove?.languageCorrections ?? [];
  const languageCorrections = areAllLanguageCorrectionsVisible
    ? allLanguageCorrections
    : allLanguageCorrections.slice(0, 4);
  const hiddenLanguageCorrectionCount = Math.max(
    0,
    allLanguageCorrections.length - 4
  );
  const isLanguageFix = trimText(coachMove?.focusType).toUpperCase() === "LANGUAGE_FIX";

  return (
    <View style={styles.stack}>
      {trimText(snapshot.strength) ? (
        <View style={styles.strengthCard}>
          <Text style={styles.strengthTitle}>잘한 점</Text>
          <Text style={styles.body}>{snapshot.strength}</Text>
        </View>
      ) : null}

      {snapshot.state === "NEEDS_REWRITE" && coachMove ? (
        <View style={styles.coachCard}>
          <Text style={styles.title}>{trimText(coachMove.focus) || "다음에 반영할 한 가지"}</Text>
          {trimText(coachMove.before) || trimText(coachMove.after) ? (
            <View style={styles.swapStack}>
              {trimText(coachMove.before) ? (
                <View style={styles.swapBefore}>
                  <Text style={styles.swapLabel}>지금</Text>
                  <Text style={styles.body}>{coachMove.before}</Text>
                </View>
              ) : null}
              {trimText(coachMove.after) ? (
                <View style={styles.swapAfter}>
                  <Text style={styles.swapLabel}>
                    {isLanguageFix ? "이번에 고친 문장" : "적용"}
                  </Text>
                  <Text style={styles.body}>{coachMove.after}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {languageCorrections.length > 0 ? (
            <View style={styles.correctionList}>
              {languageCorrections.map((correction, index) => (
                <View
                  key={`${correction.kind}-${correction.before ?? ""}-${index}`}
                  style={styles.correctionItem}
                >
                  <Text style={styles.correctionLabel}>{correction.label}</Text>
                  {trimText(correction.before) || trimText(correction.after) ? (
                    <Text style={styles.correctionSwap}>
                      {trimText(correction.before) ? `${correction.before} → ` : ""}
                      {correction.after}
                    </Text>
                  ) : null}
                  <Text style={styles.correctionReason}>{correction.reason}</Text>
                </View>
              ))}
              {hiddenLanguageCorrectionCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: areAllLanguageCorrectionsVisible }}
                  onPress={() =>
                    setAreAllLanguageCorrectionsVisible((current) => !current)
                  }
                  style={({ pressed }) => [
                    styles.correctionToggle,
                    pressed ? styles.correctionTogglePressed : null
                  ]}
                >
                  <Text style={styles.correctionToggleText}>
                    {areAllLanguageCorrectionsVisible
                      ? "추가 교정 접기"
                      : `교정 ${hiddenLanguageCorrectionCount}개 더 보기`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {trimText(coachMove.why) ? <Text style={styles.body}>{coachMove.why}</Text> : null}
          {trimText(coachMove.instruction) ? (
            <View style={styles.instruction}>
              <Text style={styles.eyebrow}>다시 쓸 때</Text>
              <Text style={styles.body}>{coachMove.instruction}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {snapshot.state === "READY_TO_FINISH" ? (
        <View style={styles.readyCard}>
          <Text style={styles.eyebrow}>완료할 준비가 됐어요</Text>
          <Text style={styles.title}>
            {trimText(snapshot.completion?.headline) ||
              trimText(snapshot.completion?.improvedPoint) ||
              "이 답변으로 루프를 마칠 수 있어요."}
          </Text>

          {expressions.length > 0 ? (
            <View style={styles.expressionList}>
              {expressions.map((expression) => (
                <View key={expression.expression} style={styles.expressionChip}>
                  <Text style={styles.expressionText}>{expression.expression}</Text>
                  {trimText(expression.meaningKo) ? (
                    <Text style={styles.expressionMeaning}>{expression.meaningKo}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {trimText(snapshot.modelAnswer) ? (
            <View style={styles.modelAnswer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsModelAnswerOpen((current) => !current)}
              >
                <Text style={styles.modelAnswerToggle}>
                  {isModelAnswerOpen ? "모범답안 접기" : "모범답안 펼쳐보기"}
                </Text>
              </Pressable>
              {isModelAnswerOpen ? (
                <View style={styles.modelAnswerBody}>
                  <Text style={styles.body}>{snapshot.modelAnswer}</Text>
                  {trimText(snapshot.modelAnswerKo) ? (
                    <Text style={styles.translation}>{snapshot.modelAnswerKo}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  notice: {
    borderRadius: 18,
    backgroundColor: "#fff8ef",
    padding: 18
  },
  noticeText: {
    color: "#756858",
    fontSize: 15,
    lineHeight: 23
  },
  strengthCard: {
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e9d9c6",
    backgroundColor: "#fffefc",
    padding: 20,
    shadowColor: "#c58a43",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 7
    },
    elevation: 2
  },
  strengthTitle: {
    color: "#232128",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 34
  },
  coachCard: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e8b168",
    backgroundColor: "#fff8ef",
    padding: 18
  },
  readyCard: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#bfd4ca",
    backgroundColor: "#edf6f1",
    padding: 18
  },
  eyebrow: {
    color: "#9a5c16",
    fontSize: 14,
    fontWeight: "800"
  },
  title: {
    color: "#302820",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26
  },
  body: {
    color: "#564a3f",
    fontSize: 16,
    lineHeight: 24
  },
  swapStack: {
    gap: 8
  },
  swapBefore: {
    gap: 5,
    borderRadius: 14,
    backgroundColor: "#fae9e5",
    padding: 13
  },
  swapAfter: {
    gap: 5,
    borderRadius: 14,
    backgroundColor: "#e8f4e9",
    padding: 13
  },
  swapLabel: {
    color: "#8b6138",
    fontSize: 13,
    fontWeight: "800"
  },
  correctionList: {
    gap: 9
  },
  correctionItem: {
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eadbc8",
    backgroundColor: "#ffffff",
    padding: 12
  },
  correctionLabel: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#f3e4cf",
    paddingHorizontal: 9,
    paddingVertical: 4,
    color: "#704914",
    fontSize: 12,
    fontWeight: "900"
  },
  correctionSwap: {
    color: "#3f342a",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800"
  },
  correctionReason: {
    color: "#756858",
    fontSize: 14,
    lineHeight: 21
  },
  correctionToggle: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dfbd91",
    backgroundColor: "#fff9f0",
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  correctionTogglePressed: {
    opacity: 0.72
  },
  correctionToggleText: {
    color: "#8d5617",
    fontSize: 14,
    fontWeight: "900"
  },
  instruction: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#ecd8bd",
    paddingTop: 12
  },
  expressionList: {
    gap: 8
  },
  expressionChip: {
    gap: 3,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  expressionText: {
    color: "#302820",
    fontSize: 15,
    fontWeight: "800"
  },
  expressionMeaning: {
    color: "#756858",
    fontSize: 13,
    lineHeight: 19
  },
  modelAnswer: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#cfe0d7",
    paddingTop: 12
  },
  modelAnswerToggle: {
    color: "#2f6d5b",
    fontSize: 15,
    fontWeight: "800"
  },
  modelAnswerBody: {
    gap: 8
  },
  translation: {
    color: "#756858",
    fontSize: 14,
    lineHeight: 21
  }
});
