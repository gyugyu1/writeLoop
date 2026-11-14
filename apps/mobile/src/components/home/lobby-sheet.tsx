import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 홈(로비) 위로 아래에서 올라오는 판. 닫기 버튼, 뒤로가기, 판 바깥 누르기로 닫힌다.
// 판이 열린 동안 로비는 뒤에서 계속 그려지고, 바깥 판이 로비 누르기를 막는다.

interface LobbySheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function LobbySheet({ visible, title, onClose, children }: LobbySheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${title} 닫기`} style={styles.backdrop} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(43, 24, 16, 0.35)" },
  panel: {
    maxHeight: "88%",
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 6
  },
  title: { fontSize: 17, fontWeight: "800", color: "#2B1810" },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "#F4EDE4" },
  closeText: { fontSize: 14, fontWeight: "700", color: "#5A4636" },
  content: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 }
});
