import { Platform } from "react-native";

const localApiBaseUrl = Platform.OS === "android" ? "http://10.0.2.2" : "http://localhost";
const productionApiBaseUrl = "https://api.writeloop.kr";
const androidEmulatorHosts = new Set(["10.0.2.2", "10.0.3.2"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1"]);

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function remapConfiguredApiBaseUrlForPlatform(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.trim().toLowerCase();

    if (Platform.OS === "ios" && androidEmulatorHosts.has(hostname)) {
      parsed.hostname = "localhost";
      return normalizeApiBaseUrl(parsed.toString());
    }

    if (Platform.OS === "android" && loopbackHosts.has(hostname)) {
      parsed.hostname = "10.0.2.2";
      return normalizeApiBaseUrl(parsed.toString());
    }

    return normalized;
  } catch {
    return normalized;
  }
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

const platformConfiguredApiBaseUrl =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID?.trim() ?? ""
    : Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_API_BASE_URL_IOS?.trim() ?? ""
      : "";
const configuredApiBaseUrl = platformConfiguredApiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "";
const remappedConfiguredApiBaseUrl = remapConfiguredApiBaseUrlForPlatform(configuredApiBaseUrl);
const resolvedApiBaseUrl =
  remappedConfiguredApiBaseUrl &&
  !__DEV__ &&
  shouldIgnoreConfiguredApiBaseUrlForRelease(remappedConfiguredApiBaseUrl)
    ? productionApiBaseUrl
    : remappedConfiguredApiBaseUrl || (__DEV__ ? localApiBaseUrl : productionApiBaseUrl);

export const apiBaseUrl = normalizeApiBaseUrl(resolvedApiBaseUrl);
