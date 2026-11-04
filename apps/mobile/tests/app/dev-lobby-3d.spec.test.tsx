// [spec] qa 테스트(작업 058, 새 기능: 개발용 3D 로비 시험 화면의 진입).
// 기대값은 시나리오(02-qa-scenarios.md S1, S2)와 결정(03의 9: 운영 빌드는 뒤로 가기 기록이 남지 않게 바꿔치기로 홈에 보낸다)에서만
// 가져온다. 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 렌더됐는지만 본다.
// 개발·운영 빌드는 전역 __DEV__를 바꿔 흉내 낸다.
import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { TestInstance } from "test-renderer";
import DevLobby3dRoute from "@/app/dev/lobby-3d";

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: () => React.createElement("Lobby3dCanvasMock") };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

function findHost(type: string) {
  return screen.container.queryAll((instance: TestInstance) => instance.type === type);
}

beforeEach(() => {
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
});

describe("[spec] /dev/lobby-3d 진입(S1, S2)", () => {
  it("S1: 개발 빌드에서는 홈으로 보내지 않고 3D 화면과 겹침을 그린다", async () => {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);

    expect(findHost("Redirect")).toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(findHost("Lobby3dCanvasMock")).toHaveLength(1);
    expect(screen.getByText("연속 1일")).toBeTruthy();
  });

  it("S2: 운영 빌드에서는 화면을 그리지 않고 홈(/)으로 바꿔치기해 보낸다", async () => {
    devGlobal.__DEV__ = false;
    await render(<DevLobby3dRoute />);

    const redirects = findHost("Redirect");
    const replacedHome = jest.mocked(router.replace).mock.calls.some(([href]) => href === "/");
    expect(redirects.length === 1 ? redirects[0].props.href : replacedHome ? "/" : null).toBe("/");
    expect(router.push).not.toHaveBeenCalled();
    expect(findHost("Lobby3dCanvasMock")).toHaveLength(0);
    for (const text of ["연속 1일", "질문에 답하기", "영어일기", "지금 생각나는대로"]) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.queryByText(/오늘은 뭘 해 볼까/)).toBeNull();
  });
});
