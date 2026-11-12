import { router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ApiError, resetPassword, sendPasswordResetCode, verifyPasswordResetCode } from "@/lib/api";

// 서버의 재설정 코드 유효 시간(AuthService.VERIFICATION_CODE_TTL)과 같다.
const CODE_LIMIT_MS = 3 * 60 * 1000;
const CODE_LENGTH = 6;
const MIN_PASSWORD_LENGTH = 8;
const CODE_EXPIRED_MESSAGE = "인증코드 입력 시간이 지났어요. 다시 받아 주세요.";

function normalizeQueryParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function errorMessage(caughtError: unknown, fallbackMessage: string) {
  return caughtError instanceof ApiError ? caughtError.message : fallbackMessage;
}

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string | string[]; redirectTo?: string | string[] }>();
  const redirectTo = useMemo(() => normalizeQueryParam(params.redirectTo), [params.redirectTo]);
  const [email, setEmail] = useState(() => normalizeQueryParam(params.email));
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [codeDeadline, setCodeDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // 코드 받기 요청마다, 그리고 이메일을 고치면 늘린다. 값이 다른 send-code 응답은 버린다.
  // 코드 칸을 고쳐도 늘리지 않는다. 다시 받기가 성공하면 그 칸을 비우기 때문이다.
  const sendVersionRef = useRef(0);
  // 코드 받기·이메일 고침·코드 고침·확인 요청마다 늘린다. 값이 다른 verify-code 응답은 버린다.
  const verifyVersionRef = useRef(0);

  const emailLoginHref = useMemo<Href>(() => {
    return (redirectTo
      ? `/login?mode=email&redirectTo=${encodeURIComponent(redirectTo)}`
      : "/login?mode=email") as Href;
  }, [redirectTo]);

  useEffect(() => {
    if (codeDeadline === null) {
      return;
    }

    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= codeDeadline) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [codeDeadline]);

  const remainingMs = codeDeadline === null ? 0 : Math.max(0, codeDeadline - now);
  const isCodeExpired = codeDeadline !== null && remainingMs === 0;
  const remainingLabel = `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}`;

  function handleEmailChange(nextEmail: string) {
    setEmail(nextEmail);
    if (!isCodeSent && !isSendingCode) {
      return;
    }

    sendVersionRef.current += 1;
    verifyVersionRef.current += 1;
    setIsCodeSent(false);
    setIsCodeVerified(false);
    setIsSendingCode(false);
    setIsVerifyingCode(false);
    setCodeDeadline(null);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice("");
    setError("");
  }

  async function handleSendCode() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("이메일을 입력해 주세요.");
      setNotice("");
      return;
    }

    sendVersionRef.current += 1;
    verifyVersionRef.current += 1;
    const version = sendVersionRef.current;
    setIsSendingCode(true);
    setIsVerifyingCode(false);
    setError("");
    setNotice("");

    try {
      const response = await sendPasswordResetCode({ email: trimmedEmail });
      if (version !== sendVersionRef.current) {
        return;
      }
      // 기다리는 사이 코드 칸을 고쳐 보낸 확인 요청이 있으면 그 응답은 버린다.
      verifyVersionRef.current += 1;
      setIsVerifyingCode(false);
      setError("");
      setIsCodeSent(true);
      setIsCodeVerified(false);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      const sentAt = Date.now();
      setNow(sentAt);
      setCodeDeadline(sentAt + CODE_LIMIT_MS);
      setNotice(response.message);
    } catch (caughtError: unknown) {
      if (version !== sendVersionRef.current) {
        return;
      }
      setError(errorMessage(caughtError, "인증코드를 보내지 못했어요."));
    } finally {
      if (version === sendVersionRef.current) {
        setIsSendingCode(false);
      }
    }
  }

  async function verifyCode(fullCode: string) {
    verifyVersionRef.current += 1;
    const version = verifyVersionRef.current;
    setIsVerifyingCode(true);
    setError("");
    setNotice("");

    try {
      const response = await verifyPasswordResetCode({ email: email.trim(), code: fullCode });
      if (version !== verifyVersionRef.current) {
        return;
      }
      setIsCodeVerified(true);
      setNotice(response.message);
    } catch (caughtError: unknown) {
      if (version !== verifyVersionRef.current) {
        return;
      }
      setIsCodeVerified(false);
      setError(errorMessage(caughtError, "인증코드를 확인하지 못했어요."));
    } finally {
      if (version === verifyVersionRef.current) {
        setIsVerifyingCode(false);
      }
    }
  }

  function handleCodeChange(value: string) {
    const nextCode = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (nextCode === code) {
      return;
    }

    setCode(nextCode);
    verifyVersionRef.current += 1;
    setIsVerifyingCode(false);
    if (isCodeVerified) {
      setIsCodeVerified(false);
      setNewPassword("");
      setConfirmPassword("");
      setNotice("");
    }

    if (nextCode.length === CODE_LENGTH && !isCodeExpired) {
      void verifyCode(nextCode);
    }
  }

  async function handleResetPassword() {
    if (isCodeExpired) {
      setError(CODE_EXPIRED_MESSAGE);
      setNotice("");
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError("새 비밀번호를 두 번 입력해 주세요.");
      setNotice("");
      return;
    }

    if (newPassword.trim().length < MIN_PASSWORD_LENGTH) {
      setError("비밀번호는 8자 이상이어야 해요.");
      setNotice("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호와 비밀번호 확인이 달라요.");
      setNotice("");
      return;
    }

    const trimmedEmail = email.trim();
    setIsResetting(true);
    setError("");
    setNotice("");

    try {
      // 서버에서 비밀번호가 바뀌었으면 그 사이 칸이 바뀌었어도 로그인 화면으로 보낸다.
      await resetPassword({ email: trimmedEmail, code, newPassword });
      const loginQuery = [
        "mode=email",
        "reset=done",
        `email=${encodeURIComponent(trimmedEmail)}`,
        redirectTo ? `redirectTo=${encodeURIComponent(redirectTo)}` : ""
      ]
        .filter(Boolean)
        .join("&");
      router.replace(`/login?${loginQuery}` as Href);
    } catch (caughtError: unknown) {
      setError(errorMessage(caughtError, "비밀번호를 바꾸지 못했어요."));
    } finally {
      setIsResetting(false);
    }
  }

  const codeHint = isCodeExpired
    ? CODE_EXPIRED_MESSAGE
    : isVerifyingCode
      ? "코드를 확인하고 있어요..."
      : isCodeVerified
        ? "코드를 확인했어요."
        : "6자리를 다 넣으면 바로 확인해요.";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace(emailLoginHref)}
              accessibilityRole="button"
              accessibilityLabel="뒤로"
            >
              <Text style={styles.backText}>뒤로</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>비밀번호 찾기</Text>
            <Text style={styles.description}>가입한 이메일로 인증코드를 보내드려요.</Text>
            <Text style={styles.subDescription}>
              소셜 로그인(구글·애플 등)으로 가입한 계정은 비밀번호가 없어요. 그 버튼으로 로그인해 주세요.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>이메일</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder="가입한 이메일을 입력해 주세요"
                placeholderTextColor="#AE9A87"
                value={email}
                onChangeText={handleEmailChange}
                editable={!isResetting}
              />
            </View>

            <Pressable
              style={[styles.secondaryButton, (isSendingCode || isResetting) && styles.disabledButton]}
              onPress={() => void handleSendCode()}
              disabled={isSendingCode || isResetting}
              accessibilityRole="button"
            >
              {isSendingCode ? (
                <ActivityIndicator color="#8D6B43" />
              ) : (
                <Text style={styles.secondaryButtonText}>{isCodeSent ? "인증코드 다시 받기" : "인증코드 받기"}</Text>
              )}
            </Pressable>

            {isCodeSent ? (
              <View style={styles.fieldGroup}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldLabel}>인증코드</Text>
                  {!isCodeExpired ? <Text style={styles.timerPill}>{remainingLabel}</Text> : null}
                </View>
                <TextInput
                  style={[styles.input, isCodeExpired && styles.inputDisabled]}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={CODE_LENGTH}
                  placeholder="메일로 받은 6자리 코드"
                  placeholderTextColor="#AE9A87"
                  value={code}
                  onChangeText={handleCodeChange}
                  editable={!isCodeExpired && !isResetting}
                />
                <Text style={[styles.hintText, isCodeExpired && styles.hintTextWarning]}>{codeHint}</Text>
              </View>
            ) : null}

            {isCodeVerified ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>새 비밀번호</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    placeholder="8자 이상 입력해 주세요"
                    placeholderTextColor="#AE9A87"
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>비밀번호 확인</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    placeholder="한 번 더 입력해 주세요"
                    placeholderTextColor="#AE9A87"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </>
            ) : null}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isCodeVerified ? (
              <Pressable
                style={[styles.primaryButton, isResetting && styles.disabledButton]}
                onPress={() => void handleResetPassword()}
                disabled={isResetting}
                accessibilityRole="button"
              >
                {isResetting ? (
                  <ActivityIndicator color="#2E2416" />
                ) : (
                  <Text style={styles.primaryButtonText}>비밀번호 바꾸기</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20
  },
  header: {
    width: "100%",
    minHeight: 36,
    justifyContent: "center",
    alignItems: "flex-start"
  },
  backButton: {
    minHeight: 28,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  backText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8D6B43"
  },
  hero: {
    alignItems: "flex-start",
    gap: 8
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    color: "#2A2520"
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#7A6853"
  },
  subDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#9A8670"
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
  fieldGroup: {
    gap: 8
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3D3226"
  },
  timerPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#FFF1D6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 13,
    fontWeight: "800",
    color: "#B5650A"
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
  inputDisabled: {
    backgroundColor: "#F3ECE3",
    color: "#9A8670"
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8A7761"
  },
  hintTextWarning: {
    color: "#B34A2B"
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4F6B3A"
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B34A2B"
  },
  secondaryButton: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E3C9A6",
    backgroundColor: "#FFF7EF",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8D6B43"
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
  }
});
