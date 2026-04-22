import { router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  ApiError,
  completeSocialRegistration,
  getPendingSocialRegistration
} from "@/lib/api";
import { resolvePostLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";

function normalizeQueryParam(value?: string | string[] | null) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function getProviderLabel(provider: string | string[] | null | undefined) {
  switch (normalizeQueryParam(provider).toLowerCase()) {
    case "naver":
      return "네이버";
    case "google":
      return "Google";
    case "kakao":
      return "카카오";
    default:
      return "소셜";
  }
}

export default function SocialSignupScreen() {
  const params = useLocalSearchParams<{
    token?: string | string[];
    provider?: string | string[];
    redirectTo?: string | string[];
  }>();
  const { setSessionUser } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [providerLabel, setProviderLabel] = useState(() => getProviderLabel(params.provider));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = useMemo(() => normalizeQueryParam(params.token), [params.token]);
  const redirectTo = useMemo(() => normalizeQueryParam(params.redirectTo), [params.redirectTo]);
  const postLoginHref = useMemo(() => resolvePostLoginHref(redirectTo), [redirectTo]);
  const loginHref = useMemo<Href>(() => {
    return (redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login") as Href;
  }, [redirectTo]);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingRegistration() {
      if (!token) {
        if (!cancelled) {
          setError("소셜 가입 정보를 찾지 못했어요. 다시 로그인해 주세요.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const pending = await getPendingSocialRegistration(token);
        if (cancelled) {
          return;
        }

        const nextProviderLabel = getProviderLabel(pending.provider);
        setProviderLabel(nextProviderLabel);
        setDisplayName(pending.suggestedDisplayName ?? "");
        setNotice(`${nextProviderLabel} 계정으로 가입을 이어가고 있어요.`);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "소셜 가입 정보를 불러오지 못했어요."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPendingRegistration();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCompleteSignup() {
    if (!token) {
      setError("소셜 가입 정보를 찾지 못했어요. 다시 로그인해 주세요.");
      return;
    }

    if (!displayName.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const user = await completeSocialRegistration({
        token,
        displayName: displayName.trim()
      });
      setSessionUser(user);
      router.replace(postLoginHref);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "소셜 가입을 완료하지 못했어요."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable style={styles.ghostButton} onPress={() => router.replace(loginHref)}>
              <Text style={styles.ghostButtonText}>로그인으로</Text>
            </Pressable>
          </View>

          <View style={styles.heroSection}>
            <Text style={styles.pageTitle}>닉네임 설정</Text>
            <View style={styles.pageUnderline} />
            <Text style={styles.heroDescription}>
              소셜 로그인은 거의 끝났어요. 앞으로 쓸 닉네임만 정해 주세요.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.badgeWrap}>
              <Text style={styles.providerBadge}>{providerLabel}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>닉네임</Text>
              <TextInput
                style={styles.input}
                placeholder="앱에서 사용할 닉네임을 입력해 주세요."
                placeholderTextColor="#AE9A87"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!isLoading && !isSubmitting}
              />
            </View>

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, (isLoading || isSubmitting) && styles.disabledButton]}
              onPress={() => void handleCompleteSignup()}
              disabled={isLoading || isSubmitting}
            >
              {isLoading || isSubmitting ? (
                <ActivityIndicator color="#2E2416" />
              ) : (
                <Text style={styles.primaryButtonText}>가입 완료</Text>
              )}
            </Pressable>

            <Text style={styles.helperText}>
              닉네임은 다른 사용자와 중복되지 않게 확인돼요. 나중에 마이페이지에서 바꿀 수 있어요.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  keyboardFrame: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 48
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 18
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#E6CFB2",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFDFC"
  },
  ghostButtonText: {
    color: "#7D6543",
    fontSize: 15,
    fontWeight: "700"
  },
  heroSection: {
    gap: 10,
    marginBottom: 24
  },
  pageTitle: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    color: "#24232D",
    letterSpacing: -1.5
  },
  pageUnderline: {
    width: 134,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F6A340"
  },
  heroDescription: {
    color: "#7C6545",
    fontSize: 18,
    lineHeight: 29,
    fontWeight: "600"
  },
  panel: {
    borderWidth: 1,
    borderColor: "#E7CFB4",
    borderRadius: 28,
    backgroundColor: "#FFFDFB",
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 18
  },
  badgeWrap: {
    flexDirection: "row"
  },
  providerBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    color: "#B46F00",
    fontSize: 15,
    fontWeight: "800"
  },
  fieldGroup: {
    gap: 10
  },
  fieldLabel: {
    color: "#6D563A",
    fontSize: 16,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#E6D1B6",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: "#2A241C",
    fontSize: 17,
    fontWeight: "600"
  },
  noticeText: {
    color: "#7C6545",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600"
  },
  errorText: {
    color: "#C84A29",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  primaryButton: {
    minHeight: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5A11F"
  },
  primaryButtonText: {
    color: "#2E2416",
    fontSize: 22,
    fontWeight: "900"
  },
  helperText: {
    color: "#8A7457",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600"
  },
  disabledButton: {
    opacity: 0.6
  }
});
