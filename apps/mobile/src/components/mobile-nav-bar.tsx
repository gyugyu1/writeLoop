import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const MOBILE_NAV_BOTTOM_SPACING = 72;

export type MobileNavTab = "home" | "records" | "me";

type MobileNavBarProps = {
  activeTab: MobileNavTab;
};

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type NavItem = {
  key: MobileNavTab;
  label: string;
  href: Href;
  icon: SymbolName;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    label: "홈",
    href: "/",
    icon: {
      ios: "house.fill",
      android: "home",
      web: "home"
    }
  },
  {
    key: "records",
    label: "작문기록",
    href: "/records",
    icon: {
      ios: "doc.text.fill",
      android: "article",
      web: "description"
    }
  },
  {
    key: "me",
    label: "내정보",
    href: "/me",
    icon: {
      ios: "person.crop.circle.fill",
      android: "person",
      web: "person"
    }
  }
];

export default function MobileNavBar({ activeTab }: MobileNavBarProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const bottomPadding = insets.bottom > 0 ? Math.max(insets.bottom - 24, 6) : 6;
  const canGoBack = navigation.canGoBack();

  return (
    <View style={styles.shell}>
      <View style={[styles.bar, { paddingBottom: bottomPadding }]}>
        <Pressable
          style={styles.button}
          onPress={() => {
            if (canGoBack) {
              navigation.goBack();
            }
          }}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <View style={[styles.iconFrame, styles.backIconFrame, !canGoBack && styles.backIconFrameDisabled]}>
            <SymbolView
              name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
              size={18}
              weight="semibold"
              tintColor={canGoBack ? "#8D8176" : "#C6B7A4"}
            />
          </View>
          <Text style={[styles.label, !canGoBack && styles.backLabelDisabled]}>뒤로</Text>
        </Pressable>

        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeTab;

          return (
            <Pressable
              key={item.key}
              style={styles.button}
              onPress={() => {
                if (isActive) {
                  return;
                }

                if (router.canDismiss()) {
                  router.dismissAll();
                }

                router.replace(item.href);
              }}
            >
              <View style={[styles.iconFrame, isActive && styles.iconFrameActive]}>
                <SymbolView
                  name={item.icon}
                  size={18}
                  weight="semibold"
                  tintColor={isActive ? "#C97A1E" : "#8D8176"}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent"
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEE2D9",
    backgroundColor: "#FFFDFC",
    shadowColor: "#C98F83",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8
  },
  backIconFrame: {
    backgroundColor: "#FFF4E5"
  },
  backIconFrameDisabled: {
    backgroundColor: "#F7EFE6"
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 2
  },
  iconFrame: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  iconFrameActive: {
    backgroundColor: "#FFE7C2"
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8D8176"
  },
  labelActive: {
    color: "#2B2620",
    fontWeight: "900"
  },
  backLabelDisabled: {
    color: "#C6B7A4"
  }
});
