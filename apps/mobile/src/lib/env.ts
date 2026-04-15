import { Platform } from "react-native";

const localApiBaseUrl = Platform.OS === "android" ? "http://10.0.2.2" : "http://localhost";
const productionApiBaseUrl = "https://api.writeloop.kr";

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function shouldIgnoreConfiguredApiBaseUrlForRelease(value: string) {
  try {
    const normalized = normalizeApiBaseUrl(value);
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.trim().toLowerCase();

    if (parsed.protocol !== "https:") {
      return true;
    }

    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "10.0.2.2" || hostname === "10.0.3.2";
  } catch {
    return true;
  }
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
const resolvedApiBaseUrl =
  configuredApiBaseUrl && !__DEV__ && shouldIgnoreConfiguredApiBaseUrlForRelease(configuredApiBaseUrl)
    ? productionApiBaseUrl
    : configuredApiBaseUrl || (__DEV__ ? localApiBaseUrl : productionApiBaseUrl);

export const apiBaseUrl =
  normalizeApiBaseUrl(resolvedApiBaseUrl);
