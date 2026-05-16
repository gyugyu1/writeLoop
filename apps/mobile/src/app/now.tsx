import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import { requestCoachHelp } from "@/lib/api";
import {
  disableNowInEnglishReminders,
  enableNowInEnglishReminders,
  formatNowInEnglishTime,
  getNowInEnglishSummary,
  type NowInEnglishEntry,
  type NowInEnglishIntervalHours,
  saveNowInEnglishEntry
} from "@/lib/now-in-english";
import type { CoachExpression, CoachHelpResponse } from "@/lib/types";

const NOW_IN_ENGLISH_COACH_PROMPT_ID = "diary-free-writing";
const coachMascotImage = require("@/assets/images/coach-mascote-face.png");

function getReminderLabel(enabled: boolean, intervalHours: NowInEnglishIntervalHours) {
  if (!enabled) {
    return "알림이 꺼져 있어요";
  }

  return `${intervalHours}시간마다 알려드릴게요`;
}

function TodayEntryList({ entries }: { entries: NowInEnglishEntry[] }) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyListCard}>
        <Text style={styles.emptyListTitle}>오늘의 첫 영어 조각을 남겨보세요.</Text>
        <Text style={styles.emptyListBody}>완벽한 문장일 필요 없어요. 지금 순간을 영어로 꺼내는 게 먼저예요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.entryList}>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.entryCard}>
          <Text style={styles.entryTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
          <Text style={styles.entryText}>{entry.text}</Text>
        </View>
      ))}
    </View>
  );
}

export default function NowInEnglishScreen() {
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<NowInEnglishEntry[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState<NowInEnglishIntervalHours>(2);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);

  const sortedTodayEntries = useMemo(
    () => entries.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [entries]
  );

  const reminderLabel = useMemo(
    () => getReminderLabel(remindersEnabled, intervalHours),
    [intervalHours, remindersEnabled]
  );
  const coachQuickQuestions = useMemo(
    () => [
      "지금 하고 있는 일을 영어 한 줄로 어떻게 말해?",
      "내 문장이 자연스러운지 봐줘.",
      "이 뒤에 한 문장 더 붙이고 싶어.",
      "짧고 자연스러운 표현 3개 알려줘."
    ],
    []
  );

  const loadSummary = useCallback(async () => {
    const summary = await getNowInEnglishSummary();
    setEntries(summary.todayEntries);
    setTodayCount(summary.todayCount);
    setRemindersEnabled(summary.settings.enabled);
    setIntervalHours(summary.settings.intervalHours);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const summary = await getNowInEnglishSummary();
        if (cancelled) {
          return;
        }
        setEntries(summary.todayEntries);
        setTodayCount(summary.todayCount);
        setRemindersEnabled(summary.settings.enabled);
        setIntervalHours(summary.settings.intervalHours);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert("한 줄을 적어볼까요?", "지금 하고 있는 일이나 떠오른 생각을 영어로 짧게 남겨보세요.");
      return;
    }

    try {
      setIsSaving(true);
      await saveNowInEnglishEntry(trimmed);
      setText("");
      setStatusMessage("좋아요. 오늘의 영어 조각이 하나 쌓였어요.");
      await loadSummary();
    } catch (error) {
      Alert.alert("저장하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEnableReminder(nextIntervalHours: NowInEnglishIntervalHours) {
    try {
      setIsScheduling(true);
      const settings = await enableNowInEnglishReminders(nextIntervalHours);
      setRemindersEnabled(settings.enabled);
      setIntervalHours(settings.intervalHours);
      setStatusMessage(`${nextIntervalHours}시간마다 지금 영어로 알림을 보내드릴게요.`);
    } catch (error) {
      Alert.alert("알림을 켜지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleDisableReminder() {
    try {
      setIsScheduling(true);
      const settings = await disableNowInEnglishReminders();
      setRemindersEnabled(settings.enabled);
      setIntervalHours(settings.intervalHours);
      setStatusMessage("지금 영어로 알림을 껐어요.");
    } catch (error) {
      Alert.alert("알림을 끄지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsScheduling(false);
    }
  }

  function appendCoachExpression(expression: string) {
    const normalizedExpression = expression.trim();
    if (!normalizedExpression) {
      return;
    }

    setText((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent) {
        return normalizedExpression;
      }

      return `${trimmedCurrent}\n${normalizedExpression}`;
    });
    setIsCoachOpen(false);
    setStatusMessage("코치 표현을 한 줄 기록에 넣었어요.");
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
        promptId: NOW_IN_ENGLISH_COACH_PROMPT_ID,
        question: nextQuestion,
        answer: text.trim() || undefined,
        attemptType: "INITIAL"
      });
      setCoachQuestion(nextQuestion);
      setCoachHelp(nextCoachHelp);
    } catch (error) {
      setCoachHelpError(error instanceof Error ? error.message : "AI 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
              <Text style={styles.backButtonText}>{"<"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>지금 영어로</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.writeSection}>
            {isLoading ? (
              <View style={styles.writeHeader}>
                <ActivityIndicator color="#EA920D" />
              </View>
            ) : null}

            <View style={styles.composerCard}>
              <Text style={styles.heroTitle}>지금 뭐하고 있나요, 무슨 생각하고 있나요?</Text>
              <View style={styles.composerDivider} />
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                autoCapitalize="sentences"
                autoCorrect
                placeholder="I’m drinking coffee and thinking about dinner."
                placeholderTextColor="#B7A693"
                style={styles.input}
              />

              {!isCoachOpen ? (
                <Pressable
                  style={[styles.coachTriggerDock, !text.trim() && styles.coachTriggerDockWithBubble]}
                  accessibilityRole="button"
                  accessibilityLabel="AI 코치 열기"
                  accessibilityHint="지금 영어로 한 줄 기록을 도와주는 AI 코치를 엽니다."
                  onPress={() => setIsCoachOpen(true)}
                >
                  {!text.trim() ? (
                    <View style={styles.coachTriggerBubble}>
                      <Text style={styles.coachTriggerBubbleText}>막히면 AI 코치에게 물어봐요.</Text>
                      <View style={styles.coachTriggerBubbleTail} />
                    </View>
                  ) : null}

                  <View style={styles.coachTriggerMascotFrame}>
                    <Image source={coachMascotImage} style={styles.coachTriggerMascot} />
                  </View>
                </Pressable>
              ) : null}
            </View>

            {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={isSaving}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? "저장 중..." : "저장하기"}</Text>
            </Pressable>
          </View>

          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <View>
                <Text style={styles.sectionLabel}>알림</Text>
                <Text style={styles.reminderTitle}>1-2시간마다 영어로 생각 꺼내기</Text>
              </View>
              <View style={[styles.reminderBadge, remindersEnabled && styles.reminderBadgeOn]}>
                <Text style={[styles.reminderBadgeText, remindersEnabled && styles.reminderBadgeTextOn]}>
                  {remindersEnabled ? "ON" : "OFF"}
                </Text>
              </View>
            </View>
            <Text style={styles.reminderMeta}>{reminderLabel}</Text>

            <View style={styles.reminderActions}>
              <Pressable
                style={[styles.intervalButton, intervalHours === 1 && remindersEnabled && styles.intervalButtonActive]}
                onPress={() => void handleEnableReminder(1)}
                disabled={isScheduling}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    intervalHours === 1 && remindersEnabled && styles.intervalButtonTextActive
                  ]}
                >
                  1시간마다
                </Text>
              </Pressable>
              <Pressable
                style={[styles.intervalButton, intervalHours === 2 && remindersEnabled && styles.intervalButtonActive]}
                onPress={() => void handleEnableReminder(2)}
                disabled={isScheduling}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    intervalHours === 2 && remindersEnabled && styles.intervalButtonTextActive
                  ]}
                >
                  2시간마다
                </Text>
              </Pressable>
              {remindersEnabled ? (
                <Pressable style={styles.secondaryButton} onPress={() => void handleDisableReminder()} disabled={isScheduling}>
                  <Text style={styles.secondaryButtonText}>알림 끄기</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>오늘 남긴 문장</Text>
              <Text style={styles.listMeta}>{todayCount}개를 남겼어요</Text>
            </View>
            <TodayEntryList entries={sortedTodayEntries} />
          </View>
        </ScrollView>
        <MobileNavBar activeTab="home" />
      </KeyboardAvoidingView>

      <Modal visible={isCoachOpen} animationType="slide" onRequestClose={() => setIsCoachOpen(false)}>
        <SafeAreaView style={styles.coachModalRoot} edges={["top", "bottom"]}>
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

            <View style={styles.coachModalBody}>
              <ScrollView
                style={styles.coachModalScroll}
                contentContainerStyle={styles.coachModalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.coachPanel}>
                  <Text style={styles.coachPanelTitle}>지금 상황을 영어로 쓰는 걸 도와드릴게요.</Text>
                  <TextInput
                    style={styles.coachInput}
                    multiline
                    textAlignVertical="top"
                    placeholder='예: "퇴근길에 피곤해"를 영어로 어떻게 말해?'
                    placeholderTextColor="#AE9A87"
                    value={coachQuestion}
                    onChangeText={(value) => {
                      setCoachQuestion(value);
                      setCoachHelp(null);
                      setCoachHelpError("");
                    }}
                  />

                  <View style={styles.coachQuickActionWrap}>
                    {coachQuickQuestions.map((question) => (
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
                    style={[styles.coachPrimaryButton, isLoadingCoachHelp && styles.buttonDisabled]}
                    onPress={() => void handleRequestCoachHelp()}
                    disabled={isLoadingCoachHelp}
                  >
                    {isLoadingCoachHelp ? (
                      <ActivityIndicator color="#24180B" />
                    ) : (
                      <Text style={styles.coachPrimaryButtonText}>코치에게 물어보기</Text>
                    )}
                  </Pressable>

                  <Text style={styles.coachMetaText}>
                    코치 답변은 힌트예요. 그대로 복사하기보다 지금 내 상황에 맞게 한 줄로 바꿔 보세요.
                  </Text>

                  {coachHelpError ? <Text style={styles.coachErrorText}>{coachHelpError}</Text> : null}

                  {coachHelp ? (
                    <View style={styles.coachResultStack}>
                      <View style={styles.coachReplyCard}>
                        <Text style={styles.coachReplyBadge}>코치 답변</Text>
                        <Text style={styles.coachReplyText}>{coachHelp.coachReply}</Text>
                      </View>

                      <View style={styles.coachExpressionList}>
                        {coachHelp.expressions.map((expression: CoachExpression) => (
                          <View key={expression.id} style={styles.coachExpressionCard}>
                            <Text style={styles.coachExpressionText}>{expression.expression}</Text>
                            <Text style={styles.coachExpressionMeaning}>{expression.meaningKo}</Text>
                            <Text style={styles.coachExpressionTip}>{expression.usageTip}</Text>
                            <Text style={styles.coachExpressionExample}>{expression.example}</Text>
                            <Pressable
                              style={styles.coachExpressionInsertButton}
                              onPress={() => appendCoachExpression(expression.expression)}
                            >
                              <Text style={styles.coachExpressionInsertButtonText}>한 줄에 넣기</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 24,
    gap: 18
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    color: "#4A4035"
  },
  headerTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "900",
    color: "#2A2521"
  },
  headerSpacer: {
    width: 42
  },
  composerCard: {
    position: "relative",
    borderRadius: 34,
    backgroundColor: "#FDFDFB",
    borderWidth: 1,
    borderColor: "#EBDCCB",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 0,
    gap: 18,
    overflow: "hidden",
    shadowColor: "#D18634",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontWeight: "900",
    color: "#25211D"
  },
  composerDivider: {
    height: 1,
    backgroundColor: "#EAD8C2"
  },
  writeSection: {
    gap: 14
  },
  writeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  input: {
    minHeight: 230,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 82,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "800",
    color: "#2B2620"
  },
  coachTriggerDock: {
    position: "absolute",
    right: 14,
    bottom: 14,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 54,
    minHeight: 54
  },
  coachTriggerDockWithBubble: {
    minWidth: 216
  },
  coachTriggerBubble: {
    position: "absolute",
    right: 44,
    bottom: 48,
    width: 166,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#C1761E",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  coachTriggerBubbleText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#7B5A35"
  },
  coachTriggerBubbleTail: {
    position: "absolute",
    right: 18,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    transform: [{ rotate: "45deg" }]
  },
  coachTriggerMascotFrame: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#C1761E",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  coachTriggerMascot: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(193, 118, 30, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.96)"
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#2F7A54"
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: "#24180B"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  reminderCard: {
    borderRadius: 30,
    backgroundColor: "#FFF4DF",
    borderWidth: 1,
    borderColor: "#F0C993",
    padding: 20,
    gap: 14
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  reminderTitle: {
    marginTop: 5,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#2B241D"
  },
  reminderBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  reminderBadgeOn: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  reminderBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8B6B49"
  },
  reminderBadgeTextOn: {
    color: "#24180B"
  },
  reminderMeta: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reminderActions: {
    flexDirection: "row",
    gap: 10
  },
  intervalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5C49F",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  intervalButtonActive: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  intervalButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalButtonTextActive: {
    color: "#24180B"
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9F2"
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#805D37"
  },
  listSection: {
    gap: 12
  },
  listHeader: {
    gap: 4
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#27231F"
  },
  listMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8A6F52"
  },
  entryList: {
    gap: 10
  },
  entryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8
  },
  entryTime: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A26A25"
  },
  entryText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    color: "#2B2620"
  },
  emptyListCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8
  },
  emptyListTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  emptyListBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#786858"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  coachModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  coachModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  coachCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  coachModalBody: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  coachModalScroll: {
    flex: 1
  },
  coachModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28
  },
  coachPanel: {
    gap: 14
  },
  coachPanelTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    color: "#232128"
  },
  coachInput: {
    minHeight: 96,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    color: "#232128"
  },
  coachQuickActionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachQuickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  coachQuickChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#6D5A45"
  },
  coachPrimaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFD08A",
    alignItems: "center",
    justifyContent: "center"
  },
  coachPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5A3A00"
  },
  coachMetaText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6B58"
  },
  coachErrorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  },
  coachResultStack: {
    gap: 12
  },
  coachReplyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachReplyBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  coachReplyText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2F2A23"
  },
  coachExpressionList: {
    gap: 10
  },
  coachExpressionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachExpressionText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2620"
  },
  coachExpressionMeaning: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8C7355"
  },
  coachExpressionTip: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5D5143"
  },
  coachExpressionExample: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8A775E"
  },
  coachExpressionInsertButton: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFF4E2",
    borderWidth: 1,
    borderColor: "#EBCB97",
    paddingVertical: 12
  },
  coachExpressionInsertButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A5A19"
  }
});
