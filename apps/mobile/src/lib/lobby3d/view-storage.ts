import AsyncStorage from "@react-native-async-storage/async-storage";
import { clampViewWidth, VIEW_WIDTH_DEFAULT } from "./engine";

// 3D 로비 카메라 거리(화면 가로에 보이는 바닥 폭)는 이 기기에만 저장한다.
export const LOBBY3D_VIEW_WIDTH_KEY = "writeloop.lobby3d.viewWidth";

export async function loadLobbyViewWidth(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LOBBY3D_VIEW_WIDTH_KEY);
    if (raw === null) return VIEW_WIDTH_DEFAULT;
    const value = Number(raw);
    return Number.isFinite(value) ? clampViewWidth(value) : VIEW_WIDTH_DEFAULT;
  } catch {
    return VIEW_WIDTH_DEFAULT;
  }
}

export async function saveLobbyViewWidth(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LOBBY3D_VIEW_WIDTH_KEY, String(clampViewWidth(value)));
  } catch {
    // 저장하지 못해도 이번 화면에서는 고른 값으로 계속 보인다.
  }
}

export async function resetLobbyViewWidth(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOBBY3D_VIEW_WIDTH_KEY);
  } catch {
    // 지우지 못해도 화면은 기본값으로 돌아간다.
  }
}
