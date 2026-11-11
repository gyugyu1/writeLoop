import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "./lobby-layout-payload";
import type { LobbyLayout } from "./lobby-layout";

// 홈 로비가 마지막으로 받은 계정의 가구 배치를 이 기기에만 기억해 둔다(계정마다 따로). 다음에 로비를 열 때 처음부터 그 배치로 지으려는 것이다
// (기본 배치로 지었다가 서버 배치가 오면 방 전체를 다시 짓는 일을 없앤다). 서버로 보내지 않고, 로그아웃하면 모두 지운다.
const LAYOUT_KEY_PREFIX = "writeloop.lobby3d.layout.v1.";

const layoutKey = (userId: number) => `${LAYOUT_KEY_PREFIX}${userId}`;

/** 그 계정 몫으로 기억해 둔 배치. 없거나, 읽지 못했거나, 모양이 맞지 않으면(서버 배치를 받을 때와 같은 검사) null. */
export async function loadRememberedLayout(userId: number): Promise<LobbyLayout | null> {
  try {
    const raw = await AsyncStorage.getItem(layoutKey(userId));
    if (raw === null) return null;
    return parseLobbyLayoutPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 그 계정 몫으로 배치를 기억해 둔다(이전 값을 덮어쓴다). 적지 못해도 이번 화면은 그대로다. */
export async function rememberLayout(userId: number, layout: LobbyLayout): Promise<void> {
  try {
    await AsyncStorage.setItem(layoutKey(userId), JSON.stringify(toLobbyLayoutPayload(layout)));
  } catch {
    // 다음에 로비를 열 때 기본 배치로 먼저 지을 뿐이다.
  }
}

/** 이 기기에 기억해 둔 로비 배치를 모든 계정 몫 지운다(로그아웃). */
export async function forgetRememberedLayouts(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(LAYOUT_KEY_PREFIX));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // 지우지 못해도 다음 계정은 자기 몫만 읽는다.
  }
}
