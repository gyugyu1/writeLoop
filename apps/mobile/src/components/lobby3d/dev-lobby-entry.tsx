import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

// 개발 빌드에서만 보이는 3D 로비 시험 화면 진입 버튼. 운영 빌드에서는 아무것도 그리지 않는다.
export default function DevLobbyEntry() {
  if (!__DEV__) return null;
  return (
    <Pressable
      accessibilityRole="button"
      style={styles.button}
      onPress={() => router.push("/dev/lobby-3d" as Href)}
    >
      <Text style={styles.text}>개발용: 3D 로비 시험</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#8A5A3B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFF6E6"
  },
  text: {
    color: "#5A3A26",
    fontSize: 15,
    fontWeight: "700"
  }
});
