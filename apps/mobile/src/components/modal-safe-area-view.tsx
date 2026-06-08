import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ModalSafeAreaEdge = "top" | "bottom" | "left" | "right";

type ModalSafeAreaViewProps = {
  children: ReactNode;
  edges?: ModalSafeAreaEdge[];
  minimumBottomInset?: number;
  minimumHorizontalInset?: number;
  minimumTopInset?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ModalSafeAreaView({
  children,
  edges = ["top", "bottom"],
  minimumBottomInset = 0,
  minimumHorizontalInset = 0,
  minimumTopInset = 0,
  style
}: ModalSafeAreaViewProps) {
  const insets = useSafeAreaInsets();
  const safeAreaStyle: ViewStyle = {};

  if (edges.includes("top")) {
    safeAreaStyle.paddingTop = Math.max(insets.top, minimumTopInset);
  }

  if (edges.includes("bottom")) {
    safeAreaStyle.paddingBottom = Math.max(insets.bottom, minimumBottomInset);
  }

  if (edges.includes("left")) {
    safeAreaStyle.paddingLeft = Math.max(insets.left, minimumHorizontalInset);
  }

  if (edges.includes("right")) {
    safeAreaStyle.paddingRight = Math.max(insets.right, minimumHorizontalInset);
  }

  return (
    <View
      style={[
        styles.root,
        style,
        safeAreaStyle
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
