import { defineConfig } from "vitest/config";

// 웹 화면 테스트(tests/). Next.js 빌드와 따로 돈다.
// tsconfig는 jsx를 Next.js에 맡기므로(preserve), 테스트에서는 React 자동 런타임으로 바꾼다.
export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" }
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"]
  }
});
