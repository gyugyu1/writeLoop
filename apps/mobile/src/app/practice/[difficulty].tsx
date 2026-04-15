import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getDailyPrompts, getPrompts } from "@/lib/api";
import { getDifficultyLabel } from "@/lib/difficulty";
import {
  buildDistinctCategoryPromptSelection,
  getQuestionLabel,
  isDailyDifficulty
} from "@/lib/practice";
import type { DailyDifficulty, DailyPromptRecommendation, Prompt } from "@/lib/types";

const HERO_META_GAP = 10;

export default function PracticeQuestionScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const rawDifficulty = typeof params.difficulty === "string" ? params.difficulty : "";
  const requestedDifficulty: DailyDifficulty = isDailyDifficulty(rawDifficulty) ? rawDifficulty : "A";

  const [recommendation, setRecommendation] = useState<DailyPromptRecommendation | null>(null);
  const [allDifficultyPrompts, setAllDifficultyPrompts] = useState<Prompt[]>([]);
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingQuestions, setIsRefreshingQuestions] = useState(false);
  const [error, setError] = useState("");
  const [heroTitleWidth, setHeroTitleWidth] = useState(0);
  const [heroDifficultyLabelWidth, setHeroDifficultyLabelWidth] = useState(0);

  const availablePromptPool = useMemo(
    () => allDifficultyPrompts.filter((prompt) => prompt.difficulty === requestedDifficulty),
    [allDifficultyPrompts, requestedDifficulty]
  );
  const heroUnderlineWidth =
    heroTitleWidth > 0 && heroDifficultyLabelWidth > 0
      ? Math.max(64, heroTitleWidth - heroDifficultyLabelWidth - HERO_META_GAP)
      : 112;

  const loadPrompts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const [nextRecommendation, nextPromptPool] = await Promise.all([
        getDailyPrompts(requestedDifficulty),
        getPrompts()
      ]);
      const sameDifficultyPromptPool = nextPromptPool.filter(
        (prompt) => prompt.difficulty === requestedDifficulty
      );
      const desiredPromptCount = Math.min(3, sameDifficultyPromptPool.length);

      setRecommendation({
        ...nextRecommendation,
        prompts: buildDistinctCategoryPromptSelection(
          nextRecommendation.prompts,
          sameDifficultyPromptPool,
          desiredPromptCount
        )
      });
      setAllDifficultyPrompts(nextPromptPool);
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

  function handleStartPrompt(prompt: Prompt) {
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

      let nextPromptPool = availablePromptPool;
      if (!nextPromptPool.length) {
        const fetchedPrompts = await getPrompts();
        setAllDifficultyPrompts(fetchedPrompts);
        nextPromptPool = fetchedPrompts.filter((prompt) => prompt.difficulty === requestedDifficulty);
      }

      if (!nextPromptPool.length) {
        throw new Error("바꿀 수 있는 질문을 아직 불러오지 못했어요.");
      }

      const currentPromptIds = new Set((recommendation?.prompts ?? []).map((prompt) => prompt.id));
      const desiredPromptCount = Math.min(
        recommendation?.prompts.length || 3,
        nextPromptPool.length
      );

      const nextPrompts = [...nextPromptPool]
        .sort(() => Math.random() - 0.5)
        .filter((prompt) => !currentPromptIds.has(prompt.id));
      const fallbackPrompts = [...nextPromptPool].sort(() => Math.random() - 0.5);

      const replacementPrompts = buildDistinctCategoryPromptSelection(
        nextPrompts,
        fallbackPrompts,
        desiredPromptCount
      );

      if (!replacementPrompts.length) {
        throw new Error("다른 카테고리 질문을 아직 불러오지 못했어요.");
      }

      setRecommendation((current) =>
        current
          ? {
              ...current,
              prompts: replacementPrompts
            }
          : {
              recommendedDate: new Date().toISOString().slice(0, 10),
              difficulty: requestedDifficulty,
              prompts: replacementPrompts
            }
      );
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
            <View style={styles.heroTopRow}>
              <View style={styles.heroTitleGroup}>
                <Text
                  style={styles.heroTitle}
                  onLayout={({ nativeEvent }) => setHeroTitleWidth(nativeEvent.layout.width)}
                >
                  질문 선택
                </Text>
              </View>
              <View style={styles.heroActionGroup}>
                <Pressable style={styles.heroSecondaryButton} onPress={handleBackToDifficultySelection}>
                  <Text style={styles.heroSecondaryButtonText}>난이도 선택</Text>
                </Pressable>
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
            <View style={styles.heroMetaRow}>
              <View style={[styles.heroUnderline, { width: heroUnderlineWidth }]} />
              <Text
                style={styles.heroDifficultyLabel}
                onLayout={({ nativeEvent }) => setHeroDifficultyLabelWidth(nativeEvent.layout.width)}
              >
                {getDifficultyLabel(requestedDifficulty)}
              </Text>
            </View>
          </View>

          <View style={styles.promptSection}>
            {isLoading ? (
              <ActivityIndicator color="#E38B12" />
            ) : recommendation?.prompts.length ? (
              recommendation.prompts.map((prompt, index) => {
                const isTranslationVisible = Boolean(revealedTranslations[prompt.id]);

                return (
                  <Pressable
                    key={prompt.id}
                    style={({ pressed }) => [styles.promptCard, pressed && styles.promptCardPressed]}
                    onPress={() => handleStartPrompt(prompt)}
                  >
                    <Text style={styles.promptIndex}>{getQuestionLabel(index)}</Text>
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
    gap: 10
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  heroTitleGroup: {
    flexDirection: "column",
    alignItems: "flex-start",
    flexShrink: 1
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: HERO_META_GAP
  },
  heroActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroTitle: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "900",
    letterSpacing: -2,
    color: "#232128"
  },
  heroDifficultyLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#4A454E"
  },
  heroSecondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  heroSecondaryButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
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
  heroUnderline: {
    width: 112,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
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
  promptIndex: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#8B7457"
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
