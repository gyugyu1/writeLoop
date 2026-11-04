// [spec] qa 테스트(작업 058, 새 기능: 3D 로비 카메라 거리를 이 기기에 저장해 다시 들어와도 유지).
// 기대값은 시나리오(02-qa-scenarios.md S47~S49)에서만 가져온다. 카메라 거리 창을 여는 것(S45)은 조작 수단으로만 쓰고 단언하지 않는다
// (05 결정: 겹침 세부는 테스트하지 않음).
// 3D 그리기(lobby3d-canvas)는 가짜로 바꿔 받은 viewWidth(3D가 실제로 쓰는 거리)를 본다. 기기 저장소는 메모리 가짜이고
// 한 테스트 안에서 화면을 내렸다 다시 그려도 유지된다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement("Lobby3dCanvasMock");
    }
  };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

async function enter() {
  mockCanvas.props = null;
  const view = await render(<Lobby3dScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

function viewWidth() {
  return mockCanvas.props!.viewWidth;
}

async function openCameraWindow() {
  await fireEvent.press(screen.getByRole("button", { name: /카메라 거리/ }));
}

function zoomSlider() {
  return screen.getByRole("adjustable", { name: "카메라 거리" });
}

async function nudgeSlider(action: "increment" | "decrement", times: number) {
  for (let i = 0; i < times; i += 1) {
    await fireEvent(zoomSlider(), "accessibilityAction", { nativeEvent: { actionName: action } });
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("[spec] 카메라 거리 저장(S47~S49)", () => {
  it("S47~S49: 저장 없이 들어오면 기본값, 바꾼 값은 다시 들어와도 유지, 기본값을 누르면 다시 들어와도 기본값", async () => {
    // S47: 저장된 값 없이 들어옴 → 기본값(= 저장 없을 때의 값). 아래에서 "기본값" 버튼 결과와 같아야 한다.
    const first = await enter();
    const defaultWidth = viewWidth();

    // S48: 슬라이더를 기본값과 다른 값으로 바꿈 → 화면을 내렸다 다시 들어오면 바꾼 값이다.
    await openCameraWindow();
    await nudgeSlider("increment", 5);
    const changedWidth = viewWidth();
    const changedSliderValue = zoomSlider().props.accessibilityValue?.now;
    expect(changedWidth).not.toBe(defaultWidth);
    await act(async () => {
      first.unmount();
    });

    const second = await enter();
    expect(viewWidth()).toBe(changedWidth);
    await openCameraWindow();
    expect(zoomSlider().props.accessibilityValue?.now).toBe(changedSliderValue);

    // S49: "기본값"을 누르면 바로 기본값이고, 다시 들어와도 기본값이다.
    await fireEvent.press(screen.getByRole("button", { name: "기본값" }));
    expect(viewWidth()).toBe(defaultWidth);
    await act(async () => {
      second.unmount();
    });

    await enter();
    expect(viewWidth()).toBe(defaultWidth);
  });

  it("S48: 반대쪽(멀리)으로 바꾼 값도 다시 들어오면 유지된다", async () => {
    const first = await enter();
    const defaultWidth = viewWidth();
    await openCameraWindow();
    await nudgeSlider("decrement", 4);
    const changedWidth = viewWidth();
    expect(changedWidth).not.toBe(defaultWidth);
    await act(async () => {
      first.unmount();
    });

    await enter();
    expect(viewWidth()).toBe(changedWidth);
  });
});
