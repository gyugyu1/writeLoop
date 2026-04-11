import { Platform } from "react-native";

const localApiBaseUrl = Platform.OS === "android" ? "http://10.0.2.2" : "http://localhost";
const productionApiBaseUrl = "https://api.writeloop.kr";

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export const apiBaseUrl =
  normalizeApiBaseUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || (__DEV__ ? localApiBaseUrl : productionApiBaseUrl)
  );
