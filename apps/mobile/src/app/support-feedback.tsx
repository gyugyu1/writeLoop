import Constants from "expo-constants";
import * as Device from "expo-device";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { submitUserFeedback } from "@/lib/api";
import type { UserFeedbackCategory } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 2_000;

const CATEGORY_OPTIONS: {
  value: UserFeedbackCategory;
  label: string;
  description: string;
}[] = [
  {
    value: "BUG",
    label: "오류 신고",
    description: "멈춤, 잘못된 화면이나 피드백을 알려주세요."
  },
  {
    value: "IDEA",
    label: "개선 아이디어",
    description: "더 편하고 유용해질 방법을 들려주세요."
  },
  {
    value: "OTHER",
    label: "기타 의견",
    description: "응원이나 그 밖의 이야기도 좋아요."
  }
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeRouteValue(value: string | string[] | undefined, maxLength: number) {
  return firstParam(value).trim().slice(0, maxLength);
}

function getInitialCategory(value: string | string[] | undefined, hasErrorCode: boolean) {
  const normalized = firstParam(value).trim().toUpperCase();
  if (normalized === "BUG" || normalized === "IDEA" || normalized === "OTHER") {
    return normalized as UserFeedbackCategory;
  }
  return hasErrorCode ? "BUG" : "IDEA";
}

export default function SupportFeedbackScreen() {
  const params = useLocalSearchParams<{
    source?: string | string[];
    errorCode?: string | string[];
    category?: string | string[];
  }>();
  const sourceScreen = useMemo(() => normalizeRouteValue(params.source, 80) || "unknown", [params.source]);
  const errorCode = useMemo(() => normalizeRouteValue(params.errorCode, 120), [params.errorCode]);
  const [category, setCategory] = useState<UserFeedbackCategory>(() =>
    getInitialCategory(params.category, Boolean(errorCode))
  );
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const trimmedMessage = message.trim();
  const canSubmit = trimmedMessage.length >= 5 && !isSubmitting;

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }

  async function handleSubmit() {
    if (!canSubmit) {
      setError("의견을 5자 이상 적어 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await submitUserFeedback({
        category,
        message: trimmedMessage,
        contactEmail: contactEmail.trim() || undefined,
        sourceScreen,
        appVersion: Constants.expoConfig?.version ?? "0.0.0",
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        deviceModel: Device.modelName ?? undefined,
        errorCode: errorCode || undefined
      });
      setIsComplete(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "의견을 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 화면으로 돌아가기"
            onPress={handleBack}
            style={styles.backButton}
          >
            <SymbolView
              name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
              size={22}
              weight="bold"
              tintColor="#27221D"
            />
          </Pressable>
          <Text style={styles.headerTitle}>의견 보내기</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isComplete ? (
          <View style={styles.completeWrap}>
            <View style={styles.completeMark}>
              <SymbolView
                name={{ ios: "checkmark", android: "check", web: "check" }}
                size={34}
                weight="bold"
                tintColor="#23663A"
              />
            </View>
            <Text style={styles.completeTitle}>소중한 의견을 받았어요</Text>
            <Text style={styles.completeBody}>
              보내주신 내용을 살펴보고 라이트루프를 더 편하게 다듬을게요.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
              <Text style={styles.primaryButtonText}>홈으로 돌아가기</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.introBlock}>
              <Text style={styles.title}>어떤 점을{`\n`}다듬으면 좋을까요?</Text>
              <Text style={styles.introBody}>
                짧은 의견도 좋아요. 보내주신 내용은 제품을 개선하는 데 직접 활용할게요.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>의견 종류</Text>
              <View style={styles.categoryList}>
                {CATEGORY_OPTIONS.map((option) => {
                  const isSelected = category === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setCategory(option.value)}
                      style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    >
                      <View style={[styles.radioDot, isSelected && styles.radioDotSelected]}>
                        {isSelected ? <View style={styles.radioDotCenter} /> : null}
                      </View>
                      <View style={styles.categoryCopy}>
                        <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                          {option.label}
                        </Text>
                        <Text style={styles.categoryDescription}>{option.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionTitle}>의견 내용</Text>
                <Text style={styles.counter}>{message.length}/{MAX_MESSAGE_LENGTH}</Text>
              </View>
              <TextInput
                accessibilityLabel="의견 내용"
                value={message}
                onChangeText={(value) => {
                  setMessage(value.slice(0, MAX_MESSAGE_LENGTH));
                  if (error) {
                    setError("");
                  }
                }}
                multiline
                textAlignVertical="top"
                placeholder="어떤 상황에서 무엇이 불편했는지, 어떻게 바뀌면 좋을지 적어 주세요."
                placeholderTextColor="#A49382"
                style={styles.messageInput}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>답변받을 이메일</Text>
              <Text style={styles.optionalLabel}>선택 사항</Text>
              <TextInput
                accessibilityLabel="답변받을 이메일"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="답변이 필요하면 입력해 주세요."
                placeholderTextColor="#A49382"
                style={styles.emailInput}
              />
            </View>

            <View style={styles.privacyCard}>
              <Text style={styles.privacyTitle}>함께 전달되는 정보</Text>
              <Text style={styles.privacyBody}>
                오류 확인을 위해 앱 버전, 기기 종류와 현재 화면이 함께 전달돼요. 작성한 영어 문장은 자동으로 보내지지 않아요.
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#2A231D" />
              ) : (
                <Text style={styles.primaryButtonText}>의견 보내기</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F1E8"
  },
  keyboardFrame: {
    flex: 1
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E9DDD0",
    backgroundColor: "#F7F1E8"
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  headerSpacer: {
    width: 42
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#27221D"
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 48,
    gap: 26
  },
  introBlock: {
    gap: 10
  },
  title: {
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.4,
    fontWeight: "900",
    color: "#25211D"
  },
  introBody: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600",
    color: "#716457"
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#3A3129"
  },
  optionalLabel: {
    position: "absolute",
    right: 0,
    top: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#9B8977"
  },
  categoryList: {
    gap: 10
  },
  categoryCard: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5D4C3",
    backgroundColor: "#FFFDFC"
  },
  categoryCardSelected: {
    borderColor: "#E78B1B",
    backgroundColor: "#FFF3DF"
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#B9A796",
    alignItems: "center",
    justifyContent: "center"
  },
  radioDotSelected: {
    borderColor: "#D8750D"
  },
  radioDotCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D8750D"
  },
  categoryCopy: {
    flex: 1,
    gap: 3
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: "#493E34"
  },
  categoryLabelSelected: {
    color: "#9C5000"
  },
  categoryDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: "#847362"
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  counter: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9B8977"
  },
  messageInput: {
    minHeight: 170,
    paddingHorizontal: 17,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#E1CEBB",
    backgroundColor: "#FFFDFC",
    fontSize: 16,
    lineHeight: 24,
    color: "#302923"
  },
  emailInput: {
    height: 56,
    paddingHorizontal: 17,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E1CEBB",
    backgroundColor: "#FFFDFC",
    fontSize: 16,
    color: "#302923"
  },
  privacyCard: {
    padding: 17,
    gap: 6,
    borderRadius: 20,
    backgroundColor: "#EEE8DD"
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#51473E"
  },
  privacyBody: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: "#74685C"
  },
  errorText: {
    marginTop: -10,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#C3432E"
  },
  primaryButton: {
    minHeight: 58,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F49A22"
  },
  primaryButtonDisabled: {
    opacity: 0.42
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#29221B"
  },
  completeWrap: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 15
  },
  completeMark: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFF0E2"
  },
  completeTitle: {
    marginTop: 8,
    fontSize: 27,
    fontWeight: "900",
    color: "#27221D",
    textAlign: "center"
  },
  completeBody: {
    marginBottom: 14,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600",
    color: "#74675B",
    textAlign: "center"
  }
});
