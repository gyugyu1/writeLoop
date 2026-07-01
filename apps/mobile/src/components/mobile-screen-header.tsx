import { type ReactNode, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

type MobileScreenHeaderProps = {
  title: string;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
};

export default function MobileScreenHeader({
  title,
  leftAccessory,
  rightAccessory
}: MobileScreenHeaderProps) {
  const [titleWidth, setTitleWidth] = useState<number | null>(null);

  function handleTitleLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.ceil(event.nativeEvent.layout.width);
    setTitleWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leadingGroup}>
          {leftAccessory ? <View style={styles.leftAccessory}>{leftAccessory}</View> : null}
          <View style={styles.titleBlock}>
            <Text onLayout={handleTitleLayout} style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </Text>
            <View style={[styles.underline, titleWidth ? { width: titleWidth } : null]} />
          </View>
        </View>
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%"
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  leadingGroup: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
    flexShrink: 1
  },
  leftAccessory: {
    flexShrink: 0,
    alignSelf: "flex-start"
  },
  titleBlock: {
    alignSelf: "flex-start",
    flexShrink: 1,
    gap: 8
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  underline: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  accessory: {
    flexShrink: 0,
    alignSelf: "flex-start"
  }
});
