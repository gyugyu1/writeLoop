// 메인 세션 테스트(작업 089 ③, 09-qa-verify 확실한 문제 1): 꾸미기 화면이 열린 동안 홈이 다시 그려져
// 닫기·저장 함수가 새로 와도, 옷장을 다시 불러오지 않고 고른 것을 그대로 둔다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import ClosetSheet from "@/components/home/closet-sheet";
import { getWardrobe } from "@/lib/api";
import type { Wardrobe } from "@/lib/types";

jest.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
  },
  getWardrobe: jest.fn(),
  saveWardrobeEquipped: jest.fn()
}));
jest.mock("@/components/home/closet-preview", () => ({ __esModule: true, default: () => null }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const WARDROBE: Wardrobe = {
  items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T00:00:00Z" }],
  equipped: { hat: "capOrange", top: null, bottom: null, shoes: null, face: null, back: null, accessory: null }
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("꾸미기 화면이 열린 동안 홈이 다시 그려질 때", () => {
  beforeEach(() => {
    jest.mocked(getWardrobe).mockReset().mockResolvedValue(WARDROBE);
  });

  it("새 닫기·저장 함수가 와도 다시 불러오지 않고 고른 것을 그대로 둔다", async () => {
    const { rerender } = await render(<ClosetSheet visible onClose={() => {}} onSaved={() => {}} />);
    await flush();
    expect(getWardrobe).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "벗기" }));
    expect(screen.getByRole("button", { name: "벗기" }).props.accessibilityState).toMatchObject({ selected: true });

    await rerender(<ClosetSheet visible onClose={() => {}} onSaved={() => {}} />);
    await flush();

    expect(getWardrobe).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "벗기" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole("button", { name: "저장" }).props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("닫았다 다시 열면 그때는 처음부터 다시 불러온다", async () => {
    const { rerender } = await render(<ClosetSheet visible onClose={() => {}} onSaved={() => {}} />);
    await flush();
    await rerender(<ClosetSheet visible={false} onClose={() => {}} onSaved={() => {}} />);
    await rerender(<ClosetSheet visible onClose={() => {}} onSaved={() => {}} />);
    await flush();
    expect(getWardrobe).toHaveBeenCalledTimes(2);
  });
});
