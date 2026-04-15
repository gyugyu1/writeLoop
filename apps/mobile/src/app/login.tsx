import { router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  iconSize: number;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
};

type UtilityToggleProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

const writeLoopLogo = require("@/assets/images/main-logo.png");
const emailMascotIcon = require("@/assets/images/login/email-mascot.png");
const naverIcon = require("@/assets/images/login/naver-symbol.png");
const googleIcon = require("@/assets/images/login/google-symbol.png");
const kakaoIcon = require("@/assets/images/login/kakao-symbol.png");

const SOCIAL_BUTTONS: SocialButtonConfig[] = [
  {
    provider: "naver",
    label: "네이버로 계속하기",
    icon: naverIcon,
    iconSize: 31,
    backgroundColor: "#03A94D",
    textColor: "#FFFFFF"
  },
  {
    provider: "google",
    label: "구글로 계속하기",
    icon: googleIcon,
    iconSize: 30,
    backgroundColor: "#FFFFFF",
    textColor: "#1F1F1F",
    borderColor: "#747775"
  },
  {
    provider: "kakao",
    label: "카카오로 계속하기",
    icon: kakaoIcon,
    iconSize: 31,
    backgroundColor: "#FEE500",
    textColor: "rgba(0, 0, 0, 0.85)"
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

function normalizeQueryParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ redirectTo?: string | string[]; mode?: string | string[] }>();
  const { currentUser, isHydrating, signIn, signInWithSocial } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const isEmailFormOpen = false;
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<"email" | SocialProvider | null>(null);
  const postLoginHref = useMemo(() => resolvePostLoginHref(params.redirectTo), [params.redirectTo]);
  const loginMode = useMemo(() => normalizeQueryParam(params.mode), [params.mode]);
  const redirectTo = useMemo(() => normalizeQueryParam(params.redirectTo), [params.redirectTo]);
  const signupHref = useMemo<Href>(() => {
    return (redirectTo
      ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/signup") as Href;
  }, [redirectTo]);
  const baseLoginHref = useMemo<Href>(() => {
    return (redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login") as Href;
  }, [redirectTo]);
  const emailLoginHref = useMemo<Href>(() => {
    return (redirectTo
      ? `/login?mode=email&redirectTo=${encodeURIComponent(redirectTo)}`
      : "/login?mode=email") as Href;
  }, [redirectTo]);

  function openLegalDocument(document: "privacy-policy" | "privacy-consent") {
    router.push({
      pathname: "/legal/[document]",
      params: { document }
    });
  }

  useEffect(() => {
    if (!isHydrating && currentUser) {
      router.replace(postLoginHref);
    }
  }, [currentUser, isHydrating, postLoginHref]);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setActiveAction("email");
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
      setActiveAction(null);
    }
  }

  async function handleSocialLogin(provider: SocialProvider) {
    try {
      setIsSubmitting(true);
      setActiveAction(provider);
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
      setActiveAction(null);
    }
  }

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loadingState}>
          <ActivityIndicator color="#E38B12" />
        </View>
      </SafeAreaView>
    );
  }

  if (loginMode === "email") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          style={styles.keyboardFrame}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.emailPageContent} keyboardShouldPersistTaps="handled">
            <View style={styles.emailPageHeader}>
              <Pressable
                style={styles.backIconButton}
                onPress={() => router.replace(baseLoginHref)}
                accessibilityRole="button"
                accessibilityLabel="뒤로"
              >
                <Text style={styles.backIconText}>뒤로</Text>
              </Pressable>
            </View>

            <View style={styles.emailPageHero}>
              <Text style={styles.emailPageTitle}>이메일 로그인</Text>
            </View>

            <View style={styles.authSection}>
              <View style={styles.panel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>이메일</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="이메일을 입력해 주세요"
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
                    placeholder="비밀번호를 입력해 주세요"
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
                  style={[styles.formSubmitButton, isSubmitting && styles.disabledButton]}
                  onPress={() => void handleLogin()}
                  disabled={isSubmitting}
                >
                  {activeAction === "email" ? (
                    <ActivityIndicator color="#2E2416" />
                  ) : (
                    <Text style={styles.formSubmitButtonText}>로그인하기</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.legalLinksRow}>
                <Pressable onPress={() => openLegalDocument("privacy-policy")}>
                  <Text style={styles.legalLinkText}>개인정보처리방침</Text>
                </Pressable>
                <Text style={styles.legalLinkDivider}>·</Text>
                <Pressable onPress={() => openLegalDocument("privacy-consent")}>
                  <Text style={styles.legalLinkText}>개인정보 수집·이용</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroSection}>
            <View style={styles.heroCopy}>
              <Text style={styles.pageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                <Text style={styles.pageTitleBlue}>쓰고, 고치고, 쌓이는 </Text>
                <Text style={styles.pageTitleOrange}>영어 루프</Text>
              </Text>
            </View>

            <View style={styles.logoWrap}>
              <Image source={writeLoopLogo} style={styles.logoImage} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.authSection}>
            <View style={styles.panel}>
              <View style={styles.buttonStack}>
                <Pressable
                  style={[
                    styles.authButton,
                    styles.emailEntryButton,
                    isSubmitting && styles.disabledButton
                  ]}
	                  onPress={() => {
	                    setError("");
	                    router.push(emailLoginHref);
	                  }}
	                  disabled={isSubmitting}
	                >
	                  <View style={styles.emailButtonIconWrap}>
	                    <Image source={emailMascotIcon} style={styles.emailButtonIcon} resizeMode="contain" />
	                  </View>
	                  <View style={styles.authButtonTextWrap}>
	                    <Text style={styles.emailEntryButtonText}>로그인하기</Text>
	                  </View>
	                  <View style={styles.emailButtonSpacer} />
	                </Pressable>

                {isEmailFormOpen ? (
                  <View style={styles.formCard}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>이메일</Text>
                      <TextInput
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="이메일을 입력해 주세요"
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
                        placeholder="비밀번호를 입력해 주세요"
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
                      style={[styles.formSubmitButton, isSubmitting && styles.disabledButton]}
                      onPress={() => void handleLogin()}
                      disabled={isSubmitting}
                    >
                      {activeAction === "email" ? (
                        <ActivityIndicator color="#2E2416" />
                      ) : (
                        <Text style={styles.formSubmitButtonText}>이메일로 로그인</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {SOCIAL_BUTTONS.map((item) => (
                  <Pressable
                    key={item.provider}
                    style={[
                      styles.authButton,
                      styles.socialButton,
                      {
                        backgroundColor: item.backgroundColor,
                        borderColor: item.borderColor ?? item.backgroundColor
                      },
                      isSubmitting && styles.disabledButton
                    ]}
                    onPress={() => void handleSocialLogin(item.provider)}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <View style={[styles.socialButtonIconWrap, { backgroundColor: item.backgroundColor }]}>
                      <Image
                        source={item.icon}
                        style={[styles.socialButtonIcon, { width: item.iconSize, height: item.iconSize }]}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.authButtonTextWrap}>
                      {activeAction === item.provider ? (
                        <ActivityIndicator color={item.textColor} />
                      ) : (
                        <Text style={[styles.socialButtonText, { color: item.textColor }]}>{item.label}</Text>
                      )}
                    </View>
                    <View style={styles.socialButtonSpacer} />
                  </Pressable>
                ))}
              </View>

              {error && !isEmailFormOpen ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.signupRow}>
                <Text style={styles.signupHint}>계정이 아직 없나요?</Text>
                <Pressable onPress={() => router.push(signupHref)}>
                  <Text style={styles.signupLink}>회원가입</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.legalLinksRow}>
              <Pressable onPress={() => openLegalDocument("privacy-policy")}>
                <Text style={styles.legalLinkText}>개인정보처리방침</Text>
              </Pressable>
              <Text style={styles.legalLinkDivider}>·</Text>
              <Pressable onPress={() => openLegalDocument("privacy-consent")}>
                <Text style={styles.legalLinkText}>개인정보 수집·이용</Text>
              </Pressable>
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
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  keyboardFrame: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 28
  },
  emailPageContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20
  },
  heroSection: {
    alignItems: "center",
    gap: 4
  },
  logoWrap: {
    width: 240,
    height: 220,
    alignItems: "center",
    justifyContent: "center"
  },
  logoImage: {
    width: 224,
    height: 224
  },
  heroCopy: {
    width: 240,
    alignItems: "center"
  },
  pageTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center"
  },
  pageTitleBlue: {
    color: "#3074C2"
  },
  pageTitleOrange: {
    color: "#F2A14A"
  },
  emailPageHeader: {
    width: "100%",
    minHeight: 36,
    justifyContent: "center",
    alignItems: "flex-start"
  },
  backIconButton: {
    minHeight: 28,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  backIconText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8D6B43"
  },
  emailPageHero: {
    alignItems: "flex-start",
    gap: 8
  },
  emailPageTitle: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    color: "#2A2520"
  },
  emailPageDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: "#7A6853"
  },
  authSection: {
    gap: 14
  },
  panel: {
    backgroundColor: "#FFFEFC",
    borderRadius: 36,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: "#E9DACC",
    gap: 16,
    shadowColor: "#D89A51",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  buttonStack: {
    gap: 12
  },
  authButton: {
    minHeight: 58,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18
  },
  authButtonTextWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emailEntryButton: {
    backgroundColor: "#F2A14A",
    borderColor: "#F2A14A"
  },
  emailButtonIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 237, 0.36)"
  },
  emailButtonIcon: {
    width: 30,
    height: 30
  },
  emailButtonSpacer: {
    width: 36,
    height: 36
  },
  emailEntryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#2E2416"
  },
  formCard: {
    borderRadius: 26,
    backgroundColor: "#FFF7EF",
    borderWidth: 1,
    borderColor: "#E9DACC",
    padding: 16,
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
  formSubmitButton: {
    borderRadius: 22,
    backgroundColor: "#E38B12",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  formSubmitButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  disabledButton: {
    opacity: 0.7
  },
  socialButton: {
    gap: 14
  },
  socialButtonIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  socialButtonIcon: {
    width: 30,
    height: 30
  },
  socialButtonSpacer: {
    width: 36,
    height: 36
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "900"
  },
  signupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 2
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
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 2
  },
  legalLinkText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9A8672"
  },
  legalLinkDivider: {
    fontSize: 12,
    color: "#C0AF9D"
  }
});
