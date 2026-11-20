// [spec] qa 테스트(작업 132 가구점 품절 안내판, 기능 변경, 모바일): 개발 화면 시험판의 진열대 '품절' 켜기/끄기 버튼(명세 8).
// 기대값은 private 작업 폴더 132-2026-11-20-가구점-품절-안내판/01-main-spec.md 명세 8과 "테스트가 쓸 이름"에서만 가져온다:
// 접근성 이름 "진열대 N 품절"(N = 1~6), 켜져 있으면 accessibilityState.selected. 홈 화면(devPanel=false)에는 없다.
// 3D 그리기는 Jest에서 돌지 않으므로 가짜로 바꾼다(로비 화면 흐름 테스트와 같다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import * as shop from "@/lib/lobby3d/shop";

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Redirect: (props: object) => React.createElement("Redirect", props) };
});
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function MockLobby3dCanvas(props: { onRoomShown?: () => void }) {
    const onRoomShown = props.onRoomShown;
    const sent = React.useRef(false);
    React.useEffect(() => {
      if (sent.current || !onRoomShown) return;
      sent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const ALL = { includeHiddenElements: true } as const;
const vacancy = () => [...(shop as unknown as { shopVacancy(): readonly boolean[] }).shopVacancy()];

async function flushAsync() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => {
  (shop as { resetShopVacancy?: () => void }).resetShopVacancy?.();
});

async function openPanel() {
  await render(<Lobby3dScreen />);
  await flushAsync();
  await fireEvent.press(screen.getByText("시험판 펴기"));
  await flushAsync();
}

describe("[spec] 시험판의 진열대 품절 버튼(명세 8)", () => {
  it("P1: 시험판을 펴면 진열대 1~6의 '품절' 버튼 여섯이 있고, 처음에는 모두 선택되지 않았다", async () => {
    await openPanel();
    for (let n = 1; n <= 6; n += 1) {
      const button = screen.getByRole("button", { name: `진열대 ${n} 품절`, ...ALL });
      expect({ n, selected: button.props.accessibilityState?.selected ?? false }).toEqual({ n, selected: false });
    }
  });

  it("P2: 버튼을 누르면 그 진열대만 빈 상태가 켜지고(선택 상태), 다시 누르면 꺼진다", async () => {
    await openPanel();
    for (let n = 1; n <= 6; n += 1) {
      await fireEvent.press(screen.getByRole("button", { name: `진열대 ${n} 품절`, ...ALL }));
      await flushAsync();
      expect(vacancy()).toEqual([1, 2, 3, 4, 5, 6].map((k) => k === n));
      expect(screen.getByRole("button", { name: `진열대 ${n} 품절`, selected: true, ...ALL })).toBeTruthy();
      for (let other = 1; other <= 6; other += 1) {
        if (other !== n) expect(screen.queryByRole("button", { name: `진열대 ${other} 품절`, selected: true, ...ALL })).toBeNull();
      }
      await fireEvent.press(screen.getByRole("button", { name: `진열대 ${n} 품절`, ...ALL }));
      await flushAsync();
      expect(vacancy()).toEqual([false, false, false, false, false, false]);
      expect(screen.queryByRole("button", { name: `진열대 ${n} 품절`, selected: true, ...ALL })).toBeNull();
    }
  });

  it("P3: 여러 진열대를 함께 켤 수 있다", async () => {
    await openPanel();
    await fireEvent.press(screen.getByRole("button", { name: "진열대 2 품절", ...ALL }));
    await fireEvent.press(screen.getByRole("button", { name: "진열대 5 품절", ...ALL }));
    await flushAsync();
    expect(vacancy()).toEqual([false, true, false, false, true, false]);
  });

  it("P4: 이미 빈 상태인 슬롯은 시험판을 다시 열어도 선택 상태로 보인다(표시를 읽는다)", async () => {
    (shop as unknown as { setShopSlotVacant(slot: number, vacant: boolean): void }).setShopSlotVacant(3, true);
    await openPanel();
    expect(screen.getByRole("button", { name: "진열대 4 품절", selected: true, ...ALL })).toBeTruthy();
  });

  it("P5: 홈 화면처럼 시험판이 없으면(devPanel=false) 진열대 품절 버튼이 없다", async () => {
    await render(<Lobby3dScreen devPanel={false} />);
    await flushAsync();
    for (let n = 1; n <= 6; n += 1) expect(screen.queryByRole("button", { name: `진열대 ${n} 품절`, ...ALL })).toBeNull();
  });
});
