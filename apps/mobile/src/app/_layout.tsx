import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LaunchSplash from "@/components/launch-splash";
import { SessionProvider } from "@/lib/session";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isLaunchSplashVisible, setIsLaunchSplashVisible] = useState(true);
  const [hasHiddenNativeSplash, setHasHiddenNativeSplash] = useState(false);

  const handleRootLayout = useCallback(() => {
    if (hasHiddenNativeSplash) {
      return;
    }

    setHasHiddenNativeSplash(true);
    void SplashScreen.hideAsync();
  }, [hasHiddenNativeSplash]);

  return (
    <SafeAreaProvider>
      <View style={styles.root} onLayout={handleRootLayout}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: "#F7F2EB"
              }
            }}
          />
        </SessionProvider>
        {isLaunchSplashVisible ? (
          <LaunchSplash onFinish={() => setIsLaunchSplashVisible(false)} />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  }
});
