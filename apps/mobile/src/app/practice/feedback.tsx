import { router, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PracticeFeedbackContent,
  type FeedbackTabKey
} from "@/components/practice-feedback-content";
import { buildIncompleteLoopPromptSnapshot, saveIncompleteLoop } from "@/lib/incomplete-loop";
import {
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { isDailyDifficulty } from "@/lib/practice";
import type { DailyDifficulty } from "@/lib/types";

const completionMascotImage = require("@/assets/images/feedback-completion-mascot.png");

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
  const navigation = useNavigation();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "A";
  const requestedPromptId = typeof params.promptId === "string" ? params.promptId : "";
  const [feedbackState, setFeedbackState] = useState<PracticeFeedbackState | null>(() =>
    getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [isHydratingFeedbackState, setIsHydratingFeedbackState] = useState(
    () => !getPracticeFeedbackState(requestedDifficulty, requestedPromptId)
  );
  const [activeTab, setActiveTab] = useState<FeedbackTabKey>("feedback");
  const [tabBarY, setTabBarY] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);

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

  useEffect(() => {
    setActiveTab("feedback");
    setTabBarY(null);
    setScrollY(0);
  }, [requestedDifficulty, requestedPromptId]);

  function handleBackToQuestions() {
    router.replace({
      pathname: "/practice/[difficulty]",
      params: {
        difficulty: requestedDifficulty
      }
    });
  }

  function handleHeaderBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    handleBackToQuestions();
  }

  async function handleRewrite() {
    if (!feedbackState) {
      handleBackToQuestions();
      return;
    }

    await saveIncompleteLoop({
      promptId: feedbackState.prompt.id,
      difficulty: requestedDifficulty,
      step: "rewrite",
      draftType: "REWRITE",
      sessionId: feedbackState.feedback.sessionId,
      updatedAt: new Date().toISOString(),
      promptSnapshot: buildIncompleteLoopPromptSnapshot(feedbackState.prompt)
    });

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

  const stickyThreshold = tabBarY === null ? Number.POSITIVE_INFINITY : Math.max(tabBarY - 8, 0);
  const shouldShowStickyTabBar = Boolean(feedbackState) && scrollY >= stickyThreshold;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerBackButton}
              onPress={handleHeaderBack}
              accessibilityRole="button"
              accessibilityLabel="뒤로가기"
            >
              <Text style={styles.headerBackIcon}>{"<"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>피드백</Text>
            <View style={styles.headerSpacer} />
          </View>

          {isHydratingFeedbackState ? (
            <View style={styles.emptyStateCard}>
              <ActivityIndicator color="#E38B12" />
            </View>
          ) : feedbackState ? (
            <>
              <PracticeFeedbackContent
                feedbackState={feedbackState}
                showCompletionSummary={false}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                onTabBarLayout={setTabBarY}
              />

              <View style={styles.completionFooter}>
                {shouldShowCompletionFooter ? (
                  <View style={styles.completionCard}>
                    <View style={styles.completionSpeechRow}>
                      <View style={styles.completionBubbleWrap}>
                        <View style={styles.completionBubble}>
                          <Text style={styles.completionHeadline}>{completionHeadline}</Text>
                        </View>
                      </View>

                      <View style={styles.completionMascotFrame}>
                        <Image source={completionMascotImage} style={styles.completionMascot} />
                      </View>
                    </View>
                  </View>
                ) : null}

                <Pressable style={styles.primaryButton} onPress={() => void handleRewrite()}>
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

        {shouldShowStickyTabBar ? (
          <View pointerEvents="box-none" style={styles.stickyTabOverlay}>
            <View style={styles.stickyTabBar}>
              <Pressable
                style={[
                  styles.stickyTabButton,
                  activeTab === "feedback" && styles.stickyTabButtonActive
                ]}
                onPress={() => setActiveTab("feedback")}
              >
                <Text
                  style={[
                    styles.stickyTabButtonText,
                    activeTab === "feedback" && styles.stickyTabButtonTextActive
                  ]}
                >
                  피드백
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.stickyTabButton,
                  activeTab === "improve" && styles.stickyTabButtonActive
                ]}
                onPress={() => setActiveTab("improve")}
              >
                <Text
                  style={[
                    styles.stickyTabButtonText,
                    activeTab === "improve" && styles.stickyTabButtonTextActive
                  ]}
                >
                  표현 더하기
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
    flex: 1,
    position: "relative"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
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
  stickyTabOverlay: {
    position: "absolute",
    top: 8,
    left: 20,
    right: 20,
    zIndex: 20
  },
  stickyTabBar: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
    backgroundColor: "#F7F2EB"
  },
  stickyTabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    backgroundColor: "#FFFBF4",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D89A51",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  },
  stickyTabButtonActive: {
    backgroundColor: "#F2A14A",
    borderColor: "#E09128"
  },
  stickyTabButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#7A6244"
  },
  stickyTabButtonTextActive: {
    color: "#2E2416"
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
    gap: 14
  },
  completionBubbleWrap: {
    flex: 1
  },
  completionBubble: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#F2994A",
    paddingHorizontal: 22,
    paddingVertical: 20
  },
  completionHeadline: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "900",
    color: "#2F312D"
  },
  completionMascotFrame: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: "#E0A45E",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    flexShrink: 0
  },
  completionMascot: {
    width: 104,
    height: 104,
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
