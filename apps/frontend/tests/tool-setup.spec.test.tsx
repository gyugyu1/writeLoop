/**
 * @vitest-environment jsdom
 */
// [spec] qa 테스트(작업 037-02 시나리오 B2). 명세 1의 도구 넷(Vitest, @testing-library/react,
// @testing-library/user-event, @testing-library/jest-dom)이 jsdom에서 함께 도는지 본다.
// 설정 파일의 전역 설정(environment, setupFiles)에 기대지 않으려고 이 파일 안에서 환경과 매처를 밝힌다.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

// 앱 코드가 아니라 이 테스트만의 작은 컴포넌트: 버튼을 누르면 문구가 바뀐다.
function ToggleMessage() {
  const [opened, setOpened] = useState(false);
  return (
    <div>
      <p data-testid="message">{opened ? "열림" : "닫힘"}</p>
      <button type="button" onClick={() => setOpened((value) => !value)}>
        바꾸기
      </button>
    </div>
  );
}

describe("[spec] 웹 테스트 도구", () => {
  afterEach(() => {
    cleanup();
  });

  it("[spec] B2: jsdom에서 렌더하고 클릭하면 바뀐 문구를 jest-dom 매처로 확인할 수 있다", async () => {
    const user = userEvent.setup();
    render(<ToggleMessage />);

    expect(typeof window).toBe("object");
    expect(screen.getByTestId("message")).toBeInTheDocument();
    expect(screen.getByTestId("message")).toHaveTextContent("닫힘");

    await user.click(screen.getByRole("button", { name: "바꾸기" }));
    expect(screen.getByTestId("message")).toHaveTextContent("열림");

    await user.click(screen.getByRole("button", { name: "바꾸기" }));
    expect(screen.getByTestId("message")).toHaveTextContent("닫힘");
  });
});
