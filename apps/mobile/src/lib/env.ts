import * as Device from "expo-device";
import { Platform } from "react-native";

const productionApiBaseUrl = "https://api.writeloop.kr";
const androidEmulatorHosts = new Set(["10.0.2.2", "10.0.3.2"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1"]);
const localProxyHosts = new Set(["api.localtest.me", "writeloop.localtest.me"]);
const isPhysicalAndroidDevice = Platform.OS === "android" && Device.isDevice;
const isPhysicalIosDevice = Platform.OS === "ios" && Device.isDevice;
const localApiBaseUrl =
  Platform.OS === "android"
    ? isPhysicalAndroidDevice
      ? "http://localhost:8080"
      : "http://10.0.2.2"
    : isPhysicalIosDevice
      ? productionApiBaseUrl
      : "http://localhost";

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

    if (Platform.OS === "ios" && !Device.isDevice && androidEmulatorHosts.has(hostname)) {
      parsed.hostname = "localhost";
      return normalizeApiBaseUrl(parsed.toString());
    }

    if (Platform.OS === "android" && !Device.isDevice && loopbackHosts.has(hostname)) {
      parsed.hostname = "10.0.2.2";
      return normalizeApiBaseUrl(parsed.toString());
    }

    return normalized;
  } catch {
    return normalized;
  }
}

function shouldPreferProductionApiBaseUrlForPhysicalIos(value: string) {
  if (!isPhysicalIosDevice) {
    return false;
  }

  try {
    const normalized = normalizeApiBaseUrl(value);
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.trim().toLowerCase();

    return (
      parsed.protocol !== "https:" &&
      (loopbackHosts.has(hostname) ||
        androidEmulatorHosts.has(hostname) ||
        localProxyHosts.has(hostname))
    );
  } catch {
    return false;
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
  shouldPreferProductionApiBaseUrlForPhysicalIos(remappedConfiguredApiBaseUrl)
    ? productionApiBaseUrl
    : remappedConfiguredApiBaseUrl &&
        !__DEV__ &&
        shouldIgnoreConfiguredApiBaseUrlForRelease(remappedConfiguredApiBaseUrl)
      ? productionApiBaseUrl
      : remappedConfiguredApiBaseUrl || (__DEV__ ? localApiBaseUrl : productionApiBaseUrl);

export const apiBaseUrl = normalizeApiBaseUrl(resolvedApiBaseUrl);
