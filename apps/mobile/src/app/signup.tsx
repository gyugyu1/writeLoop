import { router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
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
import { ApiError, completeRegistration, sendRegistrationCode } from "@/lib/api";
import { resolvePostLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";

type ConsentToggleProps = {
  label: string;
  description?: string;
  active: boolean;
  onPress: () => void;
  onView?: () => void;
  viewLabel?: string;
};

function ConsentToggle({
  label,
  description,
  active,
  onPress,
  onView,
  viewLabel = "보기"
}: ConsentToggleProps) {
  return (
    <View style={styles.consentCard}>
      <Pressable style={styles.consentMainRow} onPress={onPress}>
        <View style={[styles.checkbox, active && styles.checkboxActive]}>
          {active ? <View style={styles.checkboxDot} /> : null}
        </View>
        <View style={styles.consentTextWrap}>
          <Text style={styles.consentLabel}>{label}</Text>
          {description ? <Text style={styles.consentDescription}>{description}</Text> : null}
        </View>
      </Pressable>

      {onView ? (
        <Pressable style={styles.viewButton} onPress={onView}>
          <Text style={styles.viewButtonText}>{viewLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function normalizeQueryParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export default function SignupScreen() {
  const params = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const { signIn } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [isPrivacyConsentChecked, setIsPrivacyConsentChecked] = useState(false);
  const [isPrivacyPolicyChecked, setIsPrivacyPolicyChecked] = useState(false);
  const [codeNotice, setCodeNotice] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasSentVerificationCode, setHasSentVerificationCode] = useState(false);
  const postLoginHref = useMemo(() => resolvePostLoginHref(params.redirectTo), [params.redirectTo]);
  const loginHref = useMemo<Href>(() => {
    const redirectTo = normalizeQueryParam(params.redirectTo);
    return (redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login") as Href;
  }, [params.redirectTo]);

  function validateRequiredConsents() {
    if (!isAgeConfirmed) {
      return "만 14세 이상인지 먼저 확인해 주세요.";
    }

    if (!isPrivacyConsentChecked) {
      return "개인정보 수집·이용 동의가 필요해요.";
    }

    if (!isPrivacyPolicyChecked) {
      return "개인정보처리방침 확인이 필요해요.";
    }

    return "";
  }

  async function handleSendCode() {
    const consentError = validateRequiredConsents();
    if (consentError) {
      setError(consentError);
      return;
    }

    if (!email.trim()) {
      setError("이메일 주소를 입력해 주세요.");
      return;
    }

    try {
      setIsSendingCode(true);
      setError("");
      const notice = await sendRegistrationCode({
        email: email.trim()
      });
      setHasSentVerificationCode(true);
      setCodeNotice(notice.message || "인증코드를 이메일로 보냈어요.");
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "인증코드를 보내지 못했어요.");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleCompleteSignup() {
    const consentError = validateRequiredConsents();
    if (consentError) {
      setError(consentError);
      return;
    }

    if (!displayName.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    if (!email.trim()) {
      setError("이메일 주소를 입력해 주세요.");
      return;
    }

    if (!verificationCode.trim()) {
      setError("인증코드를 입력해 주세요.");
      return;
    }

    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }

    if (password.trim().length < 8) {
      setError("비밀번호는 8자 이상이어야 해요.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await completeRegistration({
        email: email.trim(),
        code: verificationCode.trim(),
        password,
        displayName: displayName.trim()
      });
      await signIn({
        email: email.trim(),
        password,
        rememberMe: true
      });
      router.replace(postLoginHref);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "회원가입을 완료하지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openLegalDocument(document: "privacy-policy" | "privacy-consent") {
    router.push({
      pathname: "/legal/[document]",
      params: {
        document
      }
    });
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
            <Text style={styles.pageTitle}>회원가입</Text>
            <View style={styles.pageUnderline} />
            <Text style={styles.heroDescription}>
              이메일 인증을 마치면 바로 WriteLoop를 시작할 수 있어요.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.formSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>닉네임</Text>
                <TextInput
                  style={styles.input}
                  placeholder="앱에서 보여질 이름을 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>이메일</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="이메일 주소를 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Pressable
                style={[styles.secondaryButton, isSendingCode && styles.disabledButton]}
                onPress={() => void handleSendCode()}
                disabled={isSendingCode}
              >
                {isSendingCode ? (
                  <ActivityIndicator color="#7C6545" />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {hasSentVerificationCode ? "인증코드 다시 받기" : "인증코드 받기"}
                  </Text>
                )}
              </Pressable>

              {codeNotice ? <Text style={styles.noticeText}>{codeNotice}</Text> : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>인증코드</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="이메일로 받은 6자리 코드를 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  maxLength={6}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>비밀번호</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  placeholder="8자 이상 비밀번호를 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>비밀번호 확인</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  placeholder="비밀번호를 한 번 더 입력해 주세요."
                  placeholderTextColor="#AE9A87"
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                />
              </View>
            </View>

            <View style={styles.consentSection}>
              <Text style={styles.consentSectionTitle}>필수 확인</Text>

              <ConsentToggle
                label="[필수] 만 14세 이상입니다."
                description="만 14세 미만은 현재 가입할 수 없어요."
                active={isAgeConfirmed}
                onPress={() => setIsAgeConfirmed((current) => !current)}
              />

              <ConsentToggle
                label="[필수] 개인정보 수집·이용에 동의합니다."
                description="회원가입과 계정 관리, 학습 기록 제공을 위한 최소 정보 처리에 동의해 주세요."
                active={isPrivacyConsentChecked}
                onPress={() => setIsPrivacyConsentChecked((current) => !current)}
                onView={() => openLegalDocument("privacy-consent")}
              />

              <ConsentToggle
                label="[필수] 개인정보처리방침을 확인했습니다."
                description="개인정보 처리 항목, 보관 기간, AI 기능 관련 안내를 확인해 주세요."
                active={isPrivacyPolicyChecked}
                onPress={() => setIsPrivacyPolicyChecked((current) => !current)}
                onView={() => openLegalDocument("privacy-policy")}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
              onPress={() => void handleCompleteSignup()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#2E2416" />
              ) : (
                <Text style={styles.primaryButtonText}>회원가입 완료</Text>
              )}
            </Pressable>

            <Text style={styles.helperText}>
              인증코드는 3분 동안 유효해요. 코드를 받은 뒤 회원가입 완료를 눌러 주세요.
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
    paddingTop: 8,
    paddingBottom: 40,
    gap: 22
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-start"
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
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6E6153"
  },
  panel: {
    backgroundColor: "#FFFEFC",
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: "#E9DACC",
    gap: 22,
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
  secondaryButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    backgroundColor: "#FFF9F2",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#7C6545"
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
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7B603A"
  },
  consentSection: {
    gap: 12
  },
  consentSectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#3B2F22"
  },
  consentCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7D7C4",
    backgroundColor: "#FFFDFC",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  consentMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#D5C1AA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFCF8",
    marginTop: 1
  },
  checkboxActive: {
    borderColor: "#E38B12",
    backgroundColor: "#FFF1D6"
  },
  checkboxDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E38B12"
  },
  consentTextWrap: {
    flex: 1,
    gap: 4
  },
  consentLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#392F23"
  },
  consentDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#756757"
  },
  viewButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFF3DA",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8E652E"
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B34A2B"
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6853"
  }
});
