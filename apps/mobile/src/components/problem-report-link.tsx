import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

type ProblemReportLinkProps = {
  source: string;
  errorCode: string;
};

export default function ProblemReportLink({ source, errorCode }: ProblemReportLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="반복되는 문제 보내기"
      onPress={() =>
        router.push({
          pathname: "/support-feedback",
          params: {
            source,
            errorCode,
            category: "BUG"
          }
        } as never)
      }
      style={styles.button}
    >
      <Text style={styles.text}>문제가 반복되나요? 문제 보내기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    paddingVertical: 7
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
    color: "#9B5C17",
    textDecorationLine: "underline"
  }
});
