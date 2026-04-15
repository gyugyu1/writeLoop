import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MobileNavBar, { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";
import MobileScreenHeader from "@/components/mobile-screen-header";
import { deleteAccount, updateProfile } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { AuthUser } from "@/lib/types";

function getLoginMethodLabel(user: AuthUser) {
  switch ((user.socialProvider ?? "").trim().toUpperCase()) {
    case "NAVER":
      return "네이버";
    case "GOOGLE":
      return "구글";
    case "KAKAO":
      return "카카오";
    default:
      return "이메일 로그인";
  }
}

export default function MeScreen() {
  const { currentUser, isHydrating, refreshSession, setSessionUser, signOut } = useSession();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isDeleteFormOpen, setIsDeleteFormOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setProfileDisplayName(currentUser?.displayName ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setDeleteConfirmationText("");
    setDeletePassword("");
    setDeleteError("");
    setIsDangerZoneOpen(false);
    setIsDeleteFormOpen(false);

    if (!currentUser) {
      setProfileNotice("");
      setProfileError("");
    }
  }, [currentUser]);

  const loginMethodLabel = useMemo(
    () => (currentUser ? getLoginMethodLabel(currentUser) : "-"),
    [currentUser]
  );

  const isSocialAccount = Boolean(currentUser?.socialProvider);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshSession();
    setIsRefreshing(false);
  }, [refreshSession]);

  async function handleSaveProfile() {
    if (!currentUser) {
      return;
    }

    if (!profileDisplayName.trim()) {
      setProfileError("이름을 입력해 주세요.");
      setProfileNotice("");
      return;
    }

    const wantsPasswordChange =
      Boolean(currentPassword.trim()) ||
      Boolean(newPassword.trim()) ||
      Boolean(confirmNewPassword.trim());

    if (wantsPasswordChange) {
      if (isSocialAccount) {
        setProfileError("소셜 로그인 계정은 비밀번호를 변경할 수 없어요.");
        setProfileNotice("");
        return;
      }

      if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
        setProfileError("비밀번호를 바꾸려면 현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
        setProfileNotice("");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setProfileError("새 비밀번호와 확인 비밀번호가 서로 다릅니다.");
        setProfileNotice("");
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      setProfileError("");
      setProfileNotice("");

      const updatedUser = await updateProfile({
        displayName: profileDisplayName.trim(),
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim() || undefined
      });

      setSessionUser(updatedUser);
      setProfileDisplayName(updatedUser.displayName);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setProfileNotice("변경사항을 저장했어요.");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setProfileError(caughtError.message);
      } else {
        setProfileError("프로필 설정을 저장하지 못했어요.");
      }
      setProfileNotice("");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
      router.replace("/");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (!currentUser) {
      return;
    }

    if (deleteConfirmationText.trim() !== "탈퇴") {
      setDeleteError("계정을 삭제하려면 확인 문구에 '탈퇴'를 입력해 주세요.");
      return;
    }

    if (!isSocialAccount && !deletePassword.trim()) {
      setDeleteError("계정을 삭제하려면 현재 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsDeletingAccount(true);
      setDeleteError("");

      await deleteAccount({
        confirmationText: deleteConfirmationText.trim(),
        currentPassword: deletePassword.trim() || undefined
      });

      await signOut();
      router.replace("/");
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setDeleteError(caughtError.message);
      } else {
        setDeleteError("계정을 삭제하지 못했어요.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  }

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <View style={styles.loadingState}>
            <ActivityIndicator color="#E38B12" />
          </View>
          <MobileNavBar activeTab="me" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.keyboardFrame}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
          >
            <MobileScreenHeader title="계정 설정" />

            {!currentUser ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>로그인이 필요해요</Text>
                <Text style={styles.sectionBody}>
                  내정보 화면에서 계정 설정과 작문 기록을 확인하려면 먼저 로그인해 주세요.
                </Text>
                <Pressable style={styles.primaryButton} onPress={() => router.push("/login")}>
                  <Text style={styles.primaryButtonText}>로그인하러 가기</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>내 계정 정보</Text>

                  <View style={styles.infoField}>
                    <Text style={styles.infoLabel}>이름</Text>
                    <View style={styles.infoValueBox}>
                      <Text style={styles.infoValue}>{currentUser.displayName || "-"}</Text>
                    </View>
                  </View>

                  <View style={styles.infoField}>
                    <Text style={styles.infoLabel}>이메일 주소</Text>
                    <View style={styles.infoValueBox}>
                      <Text style={styles.infoValue}>{currentUser.email || "-"}</Text>
                    </View>
                  </View>

                  <View style={styles.infoField}>
                    <Text style={styles.infoLabel}>로그인 방식</Text>
                    <View style={styles.infoValueBox}>
                      <Text style={styles.infoValue}>{loginMethodLabel}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>계정 수정</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>닉네임</Text>
                    <TextInput
                      style={styles.input}
                      value={profileDisplayName}
                      onChangeText={setProfileDisplayName}
                      placeholder="닉네임을 입력해 주세요."
                      placeholderTextColor="#AE9A87"
                    />
                  </View>

                  {isSocialAccount ? (
                    <View style={styles.noticeCard}>
                      <Text style={styles.noticeCardTitle}>소셜 로그인 계정</Text>
                      <Text style={styles.noticeCardBody}>
                        소셜 로그인 계정은 이 화면에서 비밀번호를 변경할 수 없어요.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>현재 비밀번호</Text>
                        <TextInput
                          style={styles.input}
                          secureTextEntry
                          autoCapitalize="none"
                          value={currentPassword}
                          onChangeText={setCurrentPassword}
                          placeholder="현재 비밀번호를 입력해 주세요."
                          placeholderTextColor="#AE9A87"
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>새 비밀번호</Text>
                        <TextInput
                          style={styles.input}
                          secureTextEntry
                          autoCapitalize="none"
                          value={newPassword}
                          onChangeText={setNewPassword}
                          placeholder="새 비밀번호를 입력해 주세요."
                          placeholderTextColor="#AE9A87"
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>새 비밀번호 확인</Text>
                        <TextInput
                          style={styles.input}
                          secureTextEntry
                          autoCapitalize="none"
                          value={confirmNewPassword}
                          onChangeText={setConfirmNewPassword}
                          placeholder="새 비밀번호를 한 번 더 입력해 주세요."
                          placeholderTextColor="#AE9A87"
                        />
                      </View>
                    </>
                  )}

                  <Pressable
                    style={[styles.primaryButton, isSavingProfile && styles.disabledButton]}
                    onPress={() => void handleSaveProfile()}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator color="#232128" />
                    ) : (
                      <Text style={styles.primaryButtonText}>변경사항 저장</Text>
                    )}
                  </Pressable>

                  {profileNotice ? <Text style={styles.noticeText}>{profileNotice}</Text> : null}
                  {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
                </View>

                <View style={styles.footerActionRow}>
                  <Pressable
                    style={[styles.footerButton, styles.footerGhostButton]}
                    onPress={() => router.replace("/")}
                  >
                    <Text style={styles.footerGhostButtonText}>홈으로 이동</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.footerButton, styles.footerPrimaryButton, isSigningOut && styles.disabledButton]}
                    onPress={() => void handleSignOut()}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? (
                      <ActivityIndicator color="#232128" />
                    ) : (
                      <Text style={styles.footerPrimaryButtonText}>로그아웃</Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.dangerSection}>
                  <Pressable
                    style={styles.dangerLink}
                    onPress={() => {
                      setIsDangerZoneOpen((current) => {
                        const next = !current;
                        if (!next) {
                          setIsDeleteFormOpen(false);
                          setDeleteError("");
                        }
                        return next;
                      });
                    }}
                  >
                    <Text style={styles.dangerLinkText}>위험 구역</Text>
                  </Pressable>

                  {isDangerZoneOpen ? (
                    <View style={styles.dangerPanel}>
                      {!isDeleteFormOpen ? (
                        <Pressable
                          style={styles.dangerEntryButton}
                          onPress={() => {
                            setDeleteError("");
                            setIsDeleteFormOpen(true);
                          }}
                        >
                          <Text style={styles.dangerEntryButtonText}>회원탈퇴</Text>
                        </Pressable>
                      ) : (
                        <>
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>확인 문구</Text>
                            <TextInput
                              style={styles.input}
                              value={deleteConfirmationText}
                              onChangeText={setDeleteConfirmationText}
                              placeholder="확인 문구로 '탈퇴'를 입력해 주세요."
                              placeholderTextColor="#AE9A87"
                            />
                          </View>

                          {!isSocialAccount ? (
                            <View style={styles.fieldGroup}>
                              <Text style={styles.fieldLabel}>현재 비밀번호</Text>
                              <TextInput
                                style={styles.input}
                                secureTextEntry
                                autoCapitalize="none"
                                value={deletePassword}
                                onChangeText={setDeletePassword}
                                placeholder="현재 비밀번호를 입력해 주세요."
                                placeholderTextColor="#AE9A87"
                              />
                            </View>
                          ) : (
                            <Text style={styles.dangerHelperText}>
                              소셜 로그인 계정은 현재 비밀번호 없이 계정을 삭제할 수 있어요.
                            </Text>
                          )}

                          <Pressable
                            style={[styles.dangerButton, isDeletingAccount && styles.disabledButton]}
                            onPress={() => void handleDeleteAccount()}
                            disabled={isDeletingAccount}
                          >
                            {isDeletingAccount ? (
                              <ActivityIndicator color="#A3371A" />
                            ) : (
                              <Text style={styles.dangerButtonText}>회원탈퇴</Text>
                            )}
                          </Pressable>

                          {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <MobileNavBar activeTab="me" />
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
  keyboardFrame: {
    flex: 1
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 24,
    gap: 18
  },
  heroSection: {
    gap: 8
  },
  heroEyebrow: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7A6244"
  },
  heroTitleBlock: {
    alignSelf: "flex-start",
    gap: 8
  },
  heroTitle: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  heroUnderline: {
    width: 126,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F2A14A",
    marginLeft: 2
  },
  sectionCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14,
    shadowColor: "#D89A51",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6A5D4E"
  },
  infoField: {
    gap: 8
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#534535"
  },
  infoValueBox: {
    borderRadius: 18,
    backgroundColor: "#FBF5EE",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2A2520"
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
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#E6D7C5",
    fontSize: 16,
    color: "#2A2520"
  },
  noticeCard: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#E8D6C1",
    padding: 16,
    gap: 6
  },
  noticeCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A6431"
  },
  noticeCardBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#745E44"
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 16,
    backgroundColor: "#F5A33B"
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#232128"
  },
  disabledButton: {
    opacity: 0.72
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#7B682F"
  },
  dangerSection: {
    width: "100%",
    alignItems: "stretch",
    gap: 12
  },
  dangerLink: {
    alignSelf: "flex-end"
  },
  dangerLinkText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#7A6244",
    paddingBottom: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: "#C9B7A1"
  },
  dangerPanel: {
    gap: 12
  },
  dangerEntryButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF0EA",
    borderWidth: 1,
    borderColor: "#F0C5B4"
  },
  dangerEntryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#B95A36"
  },
  dangerHelperText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7D5A49"
  },
  dangerButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 16,
    backgroundColor: "#FFE0D5",
    borderWidth: 1,
    borderColor: "#F0B9A6"
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#A3371A"
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B34A2B"
  },
  footerActionRow: {
    flexDirection: "row",
    gap: 12
  },
  footerButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 16
  },
  footerGhostButton: {
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2"
  },
  footerGhostButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7A6244"
  },
  footerPrimaryButton: {
    backgroundColor: "#FFC04E"
  },
  footerPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#232128"
  }
});
