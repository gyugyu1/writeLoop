// 모든 테스트 파일 앞에 돈다. toBeInTheDocument 같은 화면 단언을 더하고, 테스트마다 렌더한 화면을 지운다.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
