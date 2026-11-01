import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import AppUpdateNotice from "@/components/app-update-notice";
import { getAppVersionStatus } from "@/lib/api";
import { AppOverlayStatusProvider } from "@/lib/app-overlay-status";
import type { AppVersionStatus } from "@/lib/types";

// 컴포넌트 테스트가 도구에서 도는지 보이는 테스트. API와 기기 저장소는 가짜로 두고 지금 동작을 그대로 적는다.
jest.mock("@/lib/api", () => ({ getAppVersionStatus: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

const status: AppVersionStatus = {
  platform: "ios",
  latestVersion: "1.0.7",
  minimumSupportedVersion: "1.0.0",
  updateAvailable: true,
  forceUpdate: false,
  titleKo: "새 버전이 나왔어요",
  messageKo: "업데이트하면 새 기능을 쓸 수 있어요.",
  storeUrl: "https://apps.apple.com/app/id0"
};

async function renderAfterVersionCheck() {
  await render(
    <AppOverlayStatusProvider>
      <AppUpdateNotice />
    </AppOverlayStatusProvider>
  );
  // 앱이 뜬 뒤 900ms를 기다렸다가 버전을 확인한다.
  await act(async () => {
    jest.advanceTimersByTime(900);
  });
}

describe("AppUpdateNotice", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(getAppVersionStatus).mockReset();
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("새 버전이 있으면 안내를 보이고, 나중에를 누르면 닫고 그 버전을 넘긴 것으로 저장한다", async () => {
    jest.mocked(getAppVersionStatus).mockResolvedValue(status);

    await renderAfterVersionCheck();

    expect(await screen.findByText("새 버전이 나왔어요")).toBeOnTheScreen();
    expect(screen.getByText("업데이트하면 새 기능을 쓸 수 있어요.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "나중에" }));

    await waitFor(() => expect(screen.queryByText("새 버전이 나왔어요")).toBeNull());
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("writeloop_dismissed_update_ios_1.0.7", "true");
  });

  it("새 버전이 없으면 아무것도 보이지 않는다", async () => {
    jest.mocked(getAppVersionStatus).mockResolvedValue({ ...status, updateAvailable: false });

    await renderAfterVersionCheck();

    // 타이머 뒤 InteractionManager가 미뤄 둔 확인을 부른다.
    await waitFor(() => expect(getAppVersionStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("새 버전이 나왔어요")).toBeNull();
  });
});
