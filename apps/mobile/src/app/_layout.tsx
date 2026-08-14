import { router, Stack, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";
import AppUpdateNotice from "@/components/app-update-notice";
import { AppOverlayStatusProvider } from "@/lib/app-overlay-status";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

void SplashScreen.hideAsync().catch(() => {
  // The native splash can already be gone during fast refresh.
});

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {
      // The native splash can already be gone during fast refresh.
    });
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (route === "/now") {
        router.push("/now" as Href);
      }
    });

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification.request.content.data?.route === "/now") {
      router.push("/now" as Href);
      Notifications.clearLastNotificationResponse();
    }

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <SessionProvider>
          <AppOverlayStatusProvider>
            <StatusBar style="dark" />
            <AppUpdateNotice />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: "#F7F1E8"
                }
              }}
            />
          </AppOverlayStatusProvider>
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
