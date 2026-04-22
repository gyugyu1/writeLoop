import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import { getDailyPrompts, trackDailyPromptClick } from "@/lib/api";
import { getDifficultyLabel } from "@/lib/difficulty";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { getQuestionLabel, isDailyDifficulty } from "@/lib/practice";
import type { DailyDifficulty, DailyPromptRecommendation } from "@/lib/types";

export default function PracticeQuestionScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "I";

  const [recommendation, setRecommendation] = useState<DailyPromptRecommendation | null>(null);
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingQuestions, setIsRefreshingQuestions] = useState(false);
  const [error, setError] = useState("");

  const featuredPromptId = recommendation?.featured?.prompt?.id ?? null;

  const loadPrompts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const guestId = await getOrCreateGuestId();
      const nextRecommendation = await getDailyPrompts(requestedDifficulty, guestId);
      setRecommendation(nextRecommendation);
      setRevealedTranslations({});
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "오늘의 질문을 불러오지 못했어요."
      );
    } finally {
      setIsLoading(false);
    }
  }, [requestedDifficulty]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  function togglePromptTranslation(promptId: string) {
    setRevealedTranslations((current) => ({
      ...current,
      [promptId]: !current[promptId]
    }));
  }

  function handleStartPrompt(prompt: DailyPromptRecommendation["prompts"][number]) {
    void (async () => {
      const guestId = await getOrCreateGuestId();
      await trackDailyPromptClick(prompt.id, guestId || undefined);
    })().catch(() => undefined);

    router.push({
      pathname: "/practice/write",
      params: {
        difficulty: requestedDifficulty,
        promptId: prompt.id
      }
    });
  }

  function handleBackToDifficultySelection() {
    router.replace("/");
  }

  async function handleRefreshPromptList() {
    try {
      setIsRefreshingQuestions(true);
      setError("");

      const guestId = await getOrCreateGuestId();
      const excludePromptIds = recommendation?.prompts.map((prompt) => prompt.id) ?? [];
      const nextRecommendation = await getDailyPrompts(
        requestedDifficulty,
        guestId,
        excludePromptIds
      );

      if (!nextRecommendation.prompts.length) {
        throw new Error("새 질문을 아직 불러오지 못했어요.");
      }

      setRecommendation(nextRecommendation);
      setRevealedTranslations({});
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "새 질문을 불러오지 못했어요.");
    } finally {
      setIsRefreshingQuestions(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroSection}>
            <View style={styles.header}>
              <Pressable
                style={styles.headerBackButton}
                onPress={handleBackToDifficultySelection}
                accessibilityRole="button"
                accessibilityLabel="난이도 선택으로 돌아가기"
              >
                <Text style={styles.headerBackIcon}>{"<"}</Text>
              </Pressable>
              <Text style={styles.headerTitle}>질문 선택</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.heroToolbar}>
              <Text style={styles.heroDifficultyLabel}>{getDifficultyLabel(requestedDifficulty)}</Text>
              <Pressable
                style={[styles.heroActionButton, isRefreshingQuestions && styles.disabledButton]}
                onPress={() => void handleRefreshPromptList()}
                disabled={isRefreshingQuestions}
              >
                {isRefreshingQuestions ? (
                  <ActivityIndicator color="#8A6431" size="small" />
                ) : (
                  <Text style={styles.heroActionButtonText}>새 질문</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.promptSection}>
            {isLoading ? (
              <ActivityIndicator color="#E38B12" />
            ) : recommendation?.prompts.length ? (
              recommendation.prompts.map((prompt, index) => {
                const isTranslationVisible = Boolean(revealedTranslations[prompt.id]);
                const isFeaturedPrompt = prompt.id === featuredPromptId;

                return (
                  <Pressable
                    key={prompt.id}
                    style={({ pressed }) => [styles.promptCard, pressed && styles.promptCardPressed]}
                    onPress={() => handleStartPrompt(prompt)}
                  >
                    <View style={styles.promptHeaderRow}>
                      <Text style={styles.promptIndex}>{getQuestionLabel(index)}</Text>
                      {isFeaturedPrompt ? (
                        <View style={styles.featuredBadge}>
                          <Text style={styles.featuredBadgeText}>오늘의 추천 질문</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.promptCopy}>
                      <Text style={styles.promptQuestionEn}>{prompt.questionEn}</Text>
                      {isTranslationVisible ? (
                        <Text style={styles.promptQuestionKo}>{prompt.questionKo}</Text>
                      ) : null}
                    </View>

                    <View style={styles.promptActionRow}>
                      <Text style={styles.promptMeta}>{prompt.topic}</Text>
                      <Pressable
                        style={styles.translationButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          togglePromptTranslation(prompt.id);
                        }}
                      >
                        <Text style={styles.translationButtonText}>
                          {isTranslationVisible ? "해석 숨기기" : "해석 보기"}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.helperText}>오늘의 질문이 아직 준비되지 않았어요.</Text>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
        <MobileNavBar activeTab="home" />
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
    paddingTop: 8,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 24,
    gap: 18
  },
  heroSection: {
    gap: 14
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
  heroToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  heroDifficultyLabel: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#4A454E"
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
  heroActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  heroActionButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  promptSection: {
    gap: 16
  },
  promptCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "#EADDCB",
    shadowColor: "#D89A51",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2
  },
  promptCardPressed: {
    transform: [{ translateY: 1 }],
    backgroundColor: "#FFF9F1"
  },
  promptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  promptIndex: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#8B7457"
  },
  featuredBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFF1D9",
    borderWidth: 1,
    borderColor: "#F2D2A1"
  },
  featuredBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#A56B1F",
    letterSpacing: -0.2
  },
  promptCopy: {
    gap: 8
  },
  promptQuestionEn: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: "#2B2620"
  },
  promptQuestionKo: {
    fontSize: 15,
    lineHeight: 22,
    color: "#756757"
  },
  promptActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  promptMeta: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#857161"
  },
  translationButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF9F2"
  },
  translationButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  disabledButton: {
    opacity: 0.7
  },
  helperText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6E6151"
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  }
});
