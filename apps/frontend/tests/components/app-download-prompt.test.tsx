import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDownloadPrompt } from "../../components/app-download-prompt";

// next/image는 Next.js 서버 설정이 필요하므로 테스트에서는 그냥 img로 둔다.
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />
}));

const DISMISSED_STORAGE_KEY = "writeloop_app_download_prompt_dismissed_at";

// 컴포넌트를 렌더하고 사용자 조작 뒤 화면이 바뀌는 것을 보는 테스트가 도구에서 도는지 보이는 테스트.
describe("AppDownloadPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("잠시 뒤 안내가 뜨고, 웹으로 계속하기를 누르면 닫히며 닫은 시각을 남긴다", async () => {
    const closedAt = new Date("2026-10-31T09:00:00Z");
    vi.setSystemTime(closedAt);
    render(<AppDownloadPrompt />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Testing Library는 조작 뒤 setTimeout(0)을 기다리는데, Vitest의 가짜 타이머에서는 그 타이머가 돌지 않아 멈춘다.
    // 그래서 조작은 진짜 타이머로 하되, 닫은 시각을 정확히 보려고 시계만 고정한다(타이머는 진짜로 돈다).
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(closedAt);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "웹으로 계속하기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISSED_STORAGE_KEY)).toBe(String(closedAt.getTime()));
  });

  it("하루 안에 닫았으면 다시 뜨지 않는다", () => {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, String(Date.now()));
    render(<AppDownloadPrompt />);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
