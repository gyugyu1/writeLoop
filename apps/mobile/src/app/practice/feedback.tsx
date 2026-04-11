import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PracticeFeedbackContent } from "@/components/practice-feedback-content";
import { buildLoginHref } from "@/lib/login-redirect";
import {
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { isDailyDifficulty } from "@/lib/practice";
import { useSession } from "@/lib/session";
import type { DailyDifficulty } from "@/lib/types";

const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

export default function PracticeFeedbackScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; promptId?: string }>();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "A";
  const requestedPromptId = typeof params.promptId === "string" ? params.promptId : "";
  const { currentUser } = useSession();
  const [feedbackState, setFeedbackState] = useState<PracticeFeedbackState | null>(() =>
    getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [isHydratingFeedbackState, setIsHydratingFeedbackState] = useState(
    () => !getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const loopStatus = feedbackState?.feedback.ui?.loopStatus ?? null;
  const rewriteButtonLabel = pickFirstNonEmpty(loopStatus?.rewriteCtaLabel, "다시 써보기");
  const finishButtonLabel = pickFirstNonEmpty(
    loopStatus?.finishCtaLabel,
    feedbackState?.feedback.loopComplete ? "루프 완료하기" : ""
  );
  const shouldShowFinishButton = Boolean(finishButtonLabel);
  const shouldShowCompletionFooter = shouldShowFinishButton;
  const completionHeadline = pickFirstNonEmpty(
    loopStatus?.headline,
    feedbackState?.feedback.completionMessage,
    feedbackState?.feedback.summary,
    "좋아요. 지금 단계에서 마무리해도 충분해요."
  );

  useEffect(() => {
    const inMemoryState = getPracticeFeedbackState(requestedDifficulty, requestedPromptId);
    if (inMemoryState) {
      setFeedbackState(inMemoryState);
      setIsHydratingFeedbackState(false);
      return;
    }

    let cancelled = false;
    setIsHydratingFeedbackState(true);

    void hydratePracticeFeedbackState(requestedDifficulty, requestedPromptId).then((nextState) => {
      if (cancelled) {
        return;
      }

      setFeedbackState(nextState);
      setIsHydratingFeedbackState(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requestedDifficulty, requestedPromptId]);

  function handleBackToQuestions() {
    router.replace({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty: requestedDifficulty
      }
    });
  }

  function handleRewrite() {
    if (!feedbackState) {
      handleBackToQuestions();
      return;
    }

    router.push({
      pathname: "/practice/write",
      params: {
        difficulty: requestedDifficulty,
        promptId: feedbackState.prompt.id,
        mode: "rewrite"
      }
    });
  }

  function handleFinishLoop() {
    if (!feedbackState) {
      handleBackToQuestions();
      return;
    }

    router.push({
      pathname: "/practice/complete",
      params: {
        difficulty: requestedDifficulty,
        promptId: feedbackState.prompt.id
      }
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.ghostButton} onPress={handleBackToQuestions}>
            <Text style={styles.ghostButtonText}>질문 목록으로</Text>
          </Pressable>
          {feedbackState ? (
            <Pressable style={styles.ghostButton} onPress={handleRewrite}>
              <Text style={styles.ghostButtonText}>다시 써보기</Text>
            </Pressable>
          ) : null}
          {!feedbackState ? null : (
            <Pressable
              style={styles.ghostButton}
              onPress={() =>
                router.push(
                  currentUser
                    ? "/me"
                    : buildLoginHref(
                        `/practice/feedback?difficulty=${requestedDifficulty}&promptId=${requestedPromptId}`
                      )
                )
              }
            >
              <Text style={styles.ghostButtonText}>{currentUser ? "마이페이지" : "로그인"}</Text>
            </Pressable>
          )}
        </View>

        {isHydratingFeedbackState ? (
          <View style={styles.emptyStateCard}>
            <ActivityIndicator color="#E38B12" />
          </View>
        ) : feedbackState ? (
          <>
            <PracticeFeedbackContent feedbackState={feedbackState} showCompletionSummary={false} />

            <View style={styles.completionFooter}>
              {shouldShowCompletionFooter ? (
                <View style={styles.completionCard}>
                  <View style={styles.completionSpeechRow}>
                    <View style={styles.completionBubbleWrap}>
                      <View style={styles.completionBubble}>
                        <Text style={styles.completionHeadline}>{completionHeadline}</Text>
                      </View>
                      <View style={styles.completionBubbleTail} />
                    </View>

                    <View style={styles.completionMascotFrame}>
                      <Image source={coachMascotImage} style={styles.completionMascot} />
                    </View>
                  </View>
                </View>
              ) : null}

              <Pressable style={styles.primaryButton} onPress={handleRewrite}>
                <Text style={styles.primaryButtonText}>{rewriteButtonLabel}</Text>
              </Pressable>

              {shouldShowFinishButton ? (
                <Pressable style={styles.secondaryButton} onPress={handleFinishLoop}>
                  <Text style={styles.secondaryButtonText}>{finishButtonLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>피드백을 찾지 못했어요</Text>
            <Text style={styles.emptyStateBody}>
              방금 작성한 피드백이 초기화되었을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleBackToQuestions}>
              <Text style={styles.primaryButtonText}>질문 목록으로 돌아가기</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16
  },
  topBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  ghostButton: {
    borderRadius: 999,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#75624B"
  },
  completionFooter: {
    gap: 14
  },
  completionCard: {
    paddingTop: 4
  },
  completionSpeechRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  completionBubbleWrap: {
    flex: 1,
    position: "relative"
  },
  completionBubble: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#F2994A",
    paddingHorizontal: 22,
    paddingVertical: 20
  },
  completionBubbleTail: {
    position: "absolute",
    right: -8,
    bottom: 18,
    width: 18,
    height: 18,
    backgroundColor: "#FFFEFC",
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#F2994A",
    transform: [{ rotate: "-45deg" }]
  },
  completionHeadline: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "900",
    color: "#2F312D"
  },
  completionMascotFrame: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: "#E0A45E",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 6
  },
  completionMascot: {
    width: 64,
    height: 64,
    resizeMode: "contain"
  },
  primaryButton: {
    borderRadius: 22,
    backgroundColor: "#E38B12",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  secondaryButton: {
    borderRadius: 22,
    backgroundColor: "#FFFBF4",
    borderWidth: 1,
    borderColor: "#D8B17A",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A5A19"
  },
  emptyStateCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyStateBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  }
});
