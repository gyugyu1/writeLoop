import { router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { ApiError } from "@/lib/api";
import { resolvePostLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type { SocialProvider } from "@/lib/types";

type SocialButtonConfig = {
  provider: SocialProvider;
  label: string;
  icon: number;
};

type UtilityToggleProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

const naverIcon = require("@/assets/images/login/naver.png");
const googleIcon = require("@/assets/images/login/google.png");
const kakaoIcon = require("@/assets/images/login/kakao.png");

const SOCIAL_BUTTONS: SocialButtonConfig[] = [
  {
    provider: "naver",
    label: "네이버",
    icon: naverIcon
  },
  {
    provider: "google",
    label: "Google",
    icon: googleIcon
  },
  {
    provider: "kakao",
    label: "카카오",
    icon: kakaoIcon
  }
];

function UtilityToggle({ label, active, onPress }: UtilityToggleProps) {
  return (
    <Pressable style={styles.utilityToggle} onPress={onPress}>
      <View style={[styles.utilityIndicator, active && styles.utilityIndicatorActive]}>
        {active ? <View style={styles.utilityIndicatorDot} /> : null}
      </View>
      <Text style={styles.utilityLabel}>{label}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const { signIn, signInWithSocial } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const postLoginHref = useMemo(() => resolvePostLoginHref(params.redirectTo), [params.redirectTo]);
  const signupHref = useMemo<Href>(() => {
    const redirectTo = Array.isArray(params.redirectTo) ? params.redirectTo[0] : params.redirectTo;
    return (redirectTo?.trim()
      ? `/signup?redirectTo=${encodeURIComponent(redirectTo.trim())}`
      : "/signup") as Href;
  }, [params.redirectTo]);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await signIn({
        email: email.trim(),
        password,
        rememberMe
      });
      router.replace(postLoginHref);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "지금은 로그인을 진행할 수 없어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialLogin(provider: SocialProvider) {
    try {
      setIsSubmitting(true);
      setError("");
      const user = await signInWithSocial(provider);
      if (user) {
        router.replace(postLoginHref);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError ? caughtError.message : "소셜 로그인을 완료하지 못했어요."
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
          <View style={styles.heroSection}>
            <Text style={styles.pageTitle}>로그인</Text>
            <View style={styles.pageUnderline} />
          </View>

          <View style={styles.panel}>
            <View style={styles.formSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>이메일</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="이메일을 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>비밀번호</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  placeholder="비밀번호를 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={styles.utilityRow}>
                <UtilityToggle
                  label="로그인 상태 유지"
                  active={rememberMe}
                  onPress={() => setRememberMe((current) => !current)}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
                onPress={() => void handleLogin()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#2E2416" />
                ) : (
                  <Text style={styles.primaryButtonText}>이메일로 로그인</Text>
                )}
              </Pressable>

              <View style={styles.signupRow}>
                <Text style={styles.signupHint}>계정이 아직 없나요?</Text>
                <Pressable onPress={() => router.push(signupHref)}>
                  <Text style={styles.signupLink}>회원가입</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.socialSection}>
              <View style={styles.socialDividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>소셜 로그인</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialGrid}>
                {SOCIAL_BUTTONS.map((item) => (
                  <Pressable
                    key={item.provider}
                    style={styles.socialItem}
                    onPress={() => void handleSocialLogin(item.provider)}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} 로그인`}
                  >
                    <View style={styles.socialCircle}>
                      <Image source={item.icon} style={styles.socialIconImage} resizeMode="contain" />
                    </View>
                    <Text style={styles.socialLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
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
    paddingTop: 8,
    paddingBottom: 40,
    gap: 22
  },
  heroSection: {
    gap: 10
  },
  pageTitle: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -2,
    color: "#232128"
  },
  pageUnderline: {
    width: 142,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  panel: {
    backgroundColor: "#FFFEFC",
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: "#E9DACC",
    gap: 24,
    shadowColor: "#D89A51",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  formSection: {
    gap: 14
  },
  fieldGroup: {
    gap: 8
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3D3226"
  },
  input: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E6D7C5",
    fontSize: 16,
    color: "#2A2520"
  },
  utilityRow: {
    flexDirection: "row",
    paddingTop: 4
  },
  utilityToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  utilityIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D5C1AA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFCF8"
  },
  utilityIndicatorActive: {
    borderColor: "#E38B12",
    backgroundColor: "#FFF1D6"
  },
  utilityIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E38B12"
  },
  utilityLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B5B48"
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B34A2B"
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
  disabledButton: {
    opacity: 0.7
  },
  signupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4
  },
  signupHint: {
    fontSize: 14,
    color: "#7A6853"
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "900",
    color: "#C87513"
  },
  socialSection: {
    gap: 18
  },
  socialDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E3D2BF"
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#8E7759"
  },
  socialGrid: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18
  },
  socialItem: {
    alignItems: "center",
    gap: 10
  },
  socialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  socialIconImage: {
    width: 48,
    height: 48
  },
  socialLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#615341"
  }
});
