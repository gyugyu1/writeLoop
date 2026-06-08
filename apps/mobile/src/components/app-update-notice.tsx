import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { InteractionManager, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import { getAppVersionStatus } from "@/lib/api";
import type { AppVersionStatus, MobilePlatform } from "@/lib/types";

const DISMISSED_UPDATE_PREFIX = "writeloop_dismissed_update";
const VERSION_CHECK_DELAY_MS = 900;

function getRuntimeVersion() {
  return Constants.expoConfig?.version ?? "0.0.0";
}

function getMobilePlatform(): MobilePlatform | null {
  if (Platform.OS === "ios") {
    return "ios";
  }

  if (Platform.OS === "android") {
    return "android";
  }

  return null;
}

function getDismissedUpdateKey(platform: MobilePlatform, latestVersion: string) {
  return `${DISMISSED_UPDATE_PREFIX}_${platform}_${latestVersion}`;
}

export default function AppUpdateNotice() {
  const [versionStatus, setVersionStatus] = useState<AppVersionStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [openingStore, setOpeningStore] = useState(false);

  useEffect(() => {
    let mounted = true;
    let interactionTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;

    async function checkVersion() {
      const platform = getMobilePlatform();
      if (!platform) {
        return;
      }

      try {
        const currentVersion = getRuntimeVersion();
        const status = await getAppVersionStatus(platform, currentVersion);
        if (!mounted || (!status.updateAvailable && !status.forceUpdate)) {
          return;
        }

        if (!status.forceUpdate) {
          const dismissed = await SecureStore.getItemAsync(
            getDismissedUpdateKey(platform, status.latestVersion)
          );
          if (dismissed === "true") {
            return;
          }
        }

        setVersionStatus(status);
        setVisible(true);
      } catch {
        // 버전 확인 실패가 앱 진입을 막지 않도록 조용히 무시합니다.
      }
    }

    const timerId = setTimeout(() => {
      interactionTask = InteractionManager.runAfterInteractions(() => {
        void checkVersion();
      });
    }, VERSION_CHECK_DELAY_MS);

    return () => {
      mounted = false;
      clearTimeout(timerId);
      interactionTask?.cancel();
    };
  }, []);

  async function handleDismiss() {
    if (!versionStatus || versionStatus.forceUpdate) {
      return;
    }

    const platform = getMobilePlatform();
    try {
      if (platform) {
        await SecureStore.setItemAsync(
          getDismissedUpdateKey(platform, versionStatus.latestVersion),
          "true"
        );
      }
    } finally {
      setVisible(false);
    }
  }

  async function handleOpenStore() {
    if (!versionStatus?.storeUrl || openingStore) {
      return;
    }

    try {
      setOpeningStore(true);
      await Linking.openURL(versionStatus.storeUrl);
    } finally {
      setOpeningStore(false);
    }
  }

  if (!versionStatus) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={versionStatus.forceUpdate ? undefined : () => void handleDismiss()}
      transparent
      visible={visible}
    >
      <ModalSafeAreaView style={styles.backdrop} minimumBottomInset={24} minimumTopInset={24}>
        <View style={styles.card}>
          <Text style={styles.title}>{versionStatus.titleKo}</Text>
          <Text style={styles.message}>{versionStatus.messageKo}</Text>
          <View style={styles.actions}>
            {!versionStatus.forceUpdate ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleDismiss()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>나중에</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!versionStatus.storeUrl || openingStore}
              onPress={() => void handleOpenStore()}
              style={({ pressed }) => [
                styles.primaryButton,
                (!versionStatus.storeUrl || openingStore) && styles.disabledButton,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {openingStore ? "이동 중..." : "업데이트하기"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ModalSafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(35, 33, 40, 0.38)"
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    padding: 24,
    backgroundColor: "#FFF9F1",
    borderWidth: 1,
    borderColor: "#EAD8C4",
    shadowColor: "#2E2116",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#232128"
  },
  message: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#6F5A44"
  },
  actions: {
    marginTop: 26,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10
  },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4CBB2",
    backgroundColor: "#FFF9F1"
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A6A4C"
  },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2993A"
  },
  primaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#FFFFFF"
  },
  disabledButton: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.82
  }
});
