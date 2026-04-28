import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";

void SplashScreen.hideAsync().catch(() => {
  // The native splash can already be gone during fast refresh.
});

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {
      // The native splash can already be gone during fast refresh.
    });
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: "#F7F1E8"
              }
            }}
          />
        </SessionProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F1E8"
  }
});
